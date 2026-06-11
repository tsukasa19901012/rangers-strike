import { getZordCondition, isSendSUnitZordCondition } from "@rangers-strike/cards";
import type {
  ResolveZordSetupAction,
  ZordMaterialDestination,
  RushAction,
} from "../types/actions";
import type { GameState, PendingZordSetup, PlayerId, PlayerState } from "../types/game";
import { isCostWindowSatisfied } from "../core/costWindow";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  canRushUnit,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  isUnit,
  parsePowerCost,
} from "../core/catalog";
import { isShironLightRushTarget } from "./shironLight";
import { findInZone } from "../core/helpers";
import { buildCategoryPayment, buildMothershipHoldPayment } from "./commandPayment";
import type { PendingCommandPayment } from "../types/game";
import { MOTHERSHIP_CONFIG } from "@rangers-strike/cards";
import {
  canPayZordWithMothership,
  canUseMothershipForZordRush,
  collectMothershipEligibleCommands,
  listZordRushPaymentVariants,
  validateZordAdditionalPayment,
} from "./mothership";
import {
  collectZordMaterials,
  hasAllRequiredFusionMaterials,
  needsZordMaterial,
  requiresAllFusionPartners,
} from "./zord";

export type ZordSetupResolveInput = {
  materialInstanceId?: string;
  destination?: ZordMaterialDestination;
  /** Sユニット素材の代わりに母艦ホールドを使用（両方合法な場合）。 */
  paymentPath?: "material" | "mothership";
};

export type ZordSetupAdvanceResult =
  | { kind: "continue"; setup: PendingZordSetup }
  | { kind: "payment"; payment: PendingCommandPayment }
  | { kind: "rush"; action: RushAction }
  | { kind: "error"; error: string };

export function hasLegalZordRush(
  state: GameState,
  playerId: PlayerId,
  zordInstanceId: string,
): boolean {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", zordInstanceId);
  if (!found) return false;
  const def = getDefinition(state.definitions, found.card.cardId);
  if (!isUnit(def)) return false;

  if (requiresAllFusionPartners(found.card.cardId)) {
    return canRushUnit(player, state.definitions, def!, found.card.instanceId);
  }

  const materials = collectZordMaterials(
    player,
    state.definitions,
    found.card.cardId,
    found.card.instanceId,
  );
  const variants = listZordRushPaymentVariants(
    player,
    state.definitions,
    found.card.cardId,
    found.card.instanceId,
    materials,
    player.command.length < COMMAND_ZONE_MAX,
  );
  return variants.some((variant) =>
    canRushUnit(
      player,
      state.definitions,
      def!,
      found.card.instanceId,
      variant.zordMaterialInstanceId,
      variant.zordMothershipHoldInstanceIds,
      variant.zordMaterialDestination,
    ),
  );
}

function canAffordZordPower(
  player: PlayerState,
  def: NonNullable<ReturnType<typeof getDefinition>>,
): boolean {
  const cost = parsePowerCost(def.powerCost);
  return player.power.length >= cost;
}

/** advanceZordSetup が現在のウィザードステップで受け付ける解決。 */
export function listZordSetupResolveActions(
  state: GameState,
  setup: PendingZordSetup,
): ResolveZordSetupAction[] {
  const { playerId } = setup;
  const actions: ResolveZordSetupAction[] = [];

  if (setup.step === "destination") {
    for (const destination of ["command", "discard"] as const) {
      const advanced = advanceZordSetup(state, setup, { destination });
      if (advanced.kind !== "error") {
        actions.push({ type: "resolve_zord_setup", playerId, destination });
      }
    }
    return actions;
  }

  if (setup.step === "material") {
    for (const materialInstanceId of setup.validInstanceIds) {
      const advanced = advanceZordSetup(state, setup, { materialInstanceId });
      if (advanced.kind !== "error") {
        actions.push({ type: "resolve_zord_setup", playerId, materialInstanceId });
      }
    }
    if (setup.mothershipAvailable) {
      const advanced = advanceZordSetup(state, setup, { paymentPath: "mothership" });
      if (advanced.kind !== "error") {
        actions.push({ type: "resolve_zord_setup", playerId, paymentPath: "mothership" });
      }
    }
    return actions;
  }

  if (setup.step === "mothership") {
    const advanced = advanceZordSetup(state, setup, {});
    if (advanced.kind !== "error") {
      actions.push({ type: "resolve_zord_setup", playerId });
    }
  }

  return actions;
}

/** 解決シーケンスのいずれかがラッシュまたはコマンド支払いで終了するとき true。 */
export function canFinishZordSetup(
  state: GameState,
  setup: PendingZordSetup,
): boolean {
  for (const action of listZordSetupResolveActions(state, setup)) {
    const advanced = advanceZordSetup(state, setup, {
      materialInstanceId: action.materialInstanceId,
      destination: action.destination,
      paymentPath: action.paymentPath,
    });
    if (advanced.kind === "error") continue;
    if (advanced.kind === "rush" || advanced.kind === "payment") return true;
    if (advanced.kind === "continue" && canFinishZordSetup(state, advanced.setup)) {
      return true;
    }
  }
  return false;
}

export function canBeginZordSetup(
  state: GameState,
  playerId: PlayerId,
  zordInstanceId: string,
): boolean {
  const setup = createZordSetup(state, playerId, zordInstanceId);
  if (!setup) return false;
  return canFinishZordSetup(state, setup);
}

export function createZordSetup(
  state: GameState,
  playerId: PlayerId,
  zordInstanceId: string,
): PendingZordSetup | null {
  if (state.phase !== "rush") return null;

  const player = state.players[playerId];
  const found = findInZone(player, "hand", zordInstanceId);
  if (!found) return null;
  const def = getDefinition(state.definitions, found.card.cardId);
  if (!isUnit(def) || !needsZordMaterial(state.definitions, found.card.cardId)) {
    return null;
  }

  if (requiresAllFusionPartners(found.card.cardId)) {
    if (
      !hasAllRequiredFusionMaterials(
        player,
        found.card.cardId,
        found.card.instanceId,
      )
    ) {
      return null;
    }
  }

  const materials = collectZordMaterials(
    player,
    state.definitions,
    found.card.cardId,
    found.card.instanceId,
  );
  if (materials.length > 0) {
    if (!canAffordZordPower(player, def!)) return null;
  } else if (canPayZordWithMothership(player, state.definitions, found.card.cardId)) {
    if (!canAffordZordPower(player, def!)) return null;
  } else {
    return null;
  }

  if (materials.length > 0) {
    const materialIds = materials.map((c) => c.instanceId);
    const commandZoneHasSpace = player.command.length < COMMAND_ZONE_MAX;
    const mothershipAvailable = canPayZordWithMothership(
      player,
      state.definitions,
      found.card.cardId,
    );
    if (needsDestinationChoice(found.card.cardId, commandZoneHasSpace)) {
      return {
        playerId,
        zordInstanceId,
        zordCardId: found.card.cardId,
        step: "destination",
        validInstanceIds: materialIds,
        mothershipAvailable,
      };
    }
    return {
      playerId,
      zordInstanceId,
      zordCardId: found.card.cardId,
      step: "material",
      validInstanceIds: materialIds,
      mothershipAvailable,
    };
  }

  return {
    playerId,
    zordInstanceId,
    zordCardId: found.card.cardId,
    step: "mothership",
    validInstanceIds: collectMothershipTargetIds(state, playerId, found.card.cardId),
    mothershipAvailable: true,
  };
}

function collectMothershipTargetIds(
  state: GameState,
  playerId: PlayerId,
  zordCardId: string,
): string[] {
  const player = state.players[playerId];
  const mothershipKind = canUseMothershipForZordRush(
    state.definitions,
    player,
    zordCardId,
  );
  if (!mothershipKind) return [];
  const category = MOTHERSHIP_CONFIG[mothershipKind].commandCategory;
  return collectMothershipEligibleCommands(player, state.definitions, category).map(
    (e) => e.card.instanceId,
  );
}

function needsDestinationChoice(
  zordCardId: string,
  commandZoneHasSpace: boolean,
): boolean {
  return (
    getZordCondition(zordCardId) === "send_s_unit_to_command_or_discard" &&
    commandZoneHasSpace
  );
}

export function advanceZordSetup(
  state: GameState,
  setup: PendingZordSetup,
  input: ZordSetupResolveInput,
): ZordSetupAdvanceResult {
  const playerId = setup.playerId;
  const player = state.players[playerId];
  const found = findInZone(player, "hand", setup.zordInstanceId);
  if (!found) return { kind: "error", error: "card_not_in_hand" };

  if (setup.step === "destination") {
    const dest = input.destination;
    if (dest !== "command" && dest !== "discard") {
      return { kind: "error", error: "invalid_destination" };
    }

    const materialIds =
      setup.validInstanceIds.length > 0
        ? setup.validInstanceIds
        : collectZordMaterials(
            player,
            state.definitions,
            setup.zordCardId,
            setup.zordInstanceId,
          ).map((c) => c.instanceId);

    if (materialIds.length === 0) {
      return { kind: "error", error: "invalid_material" };
    }

    return {
      kind: "continue",
      setup: {
        ...setup,
        step: "material",
        materialDestination: dest,
        validInstanceIds: materialIds,
      },
    };
  }

  if (setup.step === "material") {
    if (input.paymentPath === "mothership") {
      if (!setup.mothershipAvailable) {
        return { kind: "error", error: "invalid_mothership" };
      }
      return {
        kind: "continue",
        setup: {
          ...setup,
          step: "mothership",
          validInstanceIds: collectMothershipTargetIds(
            state,
            playerId,
            setup.zordCardId,
          ),
        },
      };
    }

    const materialId = input.materialInstanceId;
    if (!materialId || !setup.validInstanceIds.includes(materialId)) {
      return { kind: "error", error: "invalid_material" };
    }

    const commandZoneHasSpace = player.command.length < COMMAND_ZONE_MAX;
    const condition = getZordCondition(setup.zordCardId);
    const destination =
      setup.materialDestination ??
      (needsDestinationChoice(setup.zordCardId, commandZoneHasSpace)
        ? undefined
        : condition &&
            isSendSUnitZordCondition(condition) &&
            condition !== "send_s_unit_to_command_or_discard"
          ? undefined
          : "discard");

    if (
      needsDestinationChoice(setup.zordCardId, commandZoneHasSpace) &&
      !destination
    ) {
      return { kind: "error", error: "invalid_destination" };
    }

    return completeZordPayment(state, setup, materialId, destination);
  }

  if (setup.step === "mothership") {
    const payment = buildMothershipHoldPayment(
      state,
      playerId,
      setup,
      setup.materialInstanceId,
      undefined,
    );
    if (payment) return { kind: "payment", payment };
    return completeZordPayment(state, setup, undefined, undefined);
  }

  return { kind: "error", error: "invalid_step" };
}

function completeZordPayment(
  state: GameState,
  setup: PendingZordSetup,
  materialInstanceId: string | undefined,
  materialDestination: ZordMaterialDestination | undefined,
): ZordSetupAdvanceResult {
  const playerId = setup.playerId;
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, setup.zordCardId);
  if (!def) return { kind: "error", error: "invalid_card" };

  const variants = listZordRushPaymentVariants(
    player,
    state.definitions,
    setup.zordCardId,
    setup.zordInstanceId,
    materialInstanceId
      ? collectZordMaterials(
          player,
          state.definitions,
          setup.zordCardId,
          setup.zordInstanceId,
        ).filter((c) => c.instanceId === materialInstanceId)
      : [],
    player.command.length < COMMAND_ZONE_MAX,
  );

  const matching = variants.filter(
    (v) =>
      (v.zordMaterialInstanceId ?? "") === (materialInstanceId ?? "") &&
      (v.zordMaterialDestination ?? "") === (materialDestination ?? "") &&
      (v.zordMothershipHoldInstanceIds?.length ?? 0) === 0,
  );

  const shironRush = isShironLightRushTarget(player, setup.zordInstanceId);
  if (
    matching.length > 0 &&
    (shironRush
      ? canRushUnitExceptCommandHold(
          player,
          state.definitions,
          def,
          setup.zordInstanceId,
          materialInstanceId,
          undefined,
          materialDestination,
        )
      : canRushUnit(
          player,
          state.definitions,
          def,
          setup.zordInstanceId,
          materialInstanceId,
          undefined,
          materialDestination,
        ))
  ) {
    if (isCostWindowSatisfied(player, "rush_category") || shironRush) {
      return {
        kind: "rush",
        action: {
          type: "rush",
          playerId,
          instanceId: setup.zordInstanceId,
          zordMaterialInstanceId: materialInstanceId,
          zordMaterialDestination: materialDestination,
        },
      };
    }
    const categories = cardCategories(def);
    const payment = buildCategoryPayment(
      state,
      playerId,
      setup.zordInstanceId,
      setup.zordCardId,
      categories,
      {
        type: "rush",
        zordMaterialInstanceId: materialInstanceId,
        zordMaterialDestination: materialDestination,
      },
      false,
      { perRushPayment: true },
    );
    if (payment) return { kind: "payment", payment };
  }

  const mothershipPayment = buildMothershipHoldPayment(
    state,
    playerId,
    setup,
    materialInstanceId,
    materialDestination,
  );
  if (mothershipPayment) return { kind: "payment", payment: mothershipPayment };

  if (
    !validateZordAdditionalPayment(
      player,
      state.definitions,
      setup.zordCardId,
      setup.zordInstanceId,
      materialInstanceId,
      materialDestination,
    )
  ) {
    return { kind: "error", error: "cannot_complete_zord" };
  }

  const categories = cardCategories(def);
  const categoryPayment = buildCategoryPayment(
    state,
    playerId,
    setup.zordInstanceId,
    setup.zordCardId,
    categories,
    {
      type: "rush",
      zordMaterialInstanceId: materialInstanceId,
      zordMaterialDestination: materialDestination,
    },
    false,
    { perRushPayment: true },
  );
  if (categoryPayment) return { kind: "payment", payment: categoryPayment };

  return { kind: "error", error: "cannot_complete_zord" };
}
