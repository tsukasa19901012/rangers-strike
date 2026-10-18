import { redRacerPowerCostBonus } from "../core/power";
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
  isVehicle,
  parsePowerCost,
} from "../core/catalog";
import { isShironLightRushTarget } from "./shironLight";
import { rushPowerBudget } from "./rushDeclaration";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { findInZone } from "../core/helpers";
import {
  buildCategoryPayment,
  buildMothershipHoldPayment,
  buildPartialMothershipHoldPayment,
} from "./commandPayment";
import type { PendingCommandPayment } from "../types/game";
import { MOTHERSHIP_CONFIG } from "@rangers-strike/cards";
import {
  canPayZordWithMothership,
  canUseMothershipForZordRush,
  listMothershipHoldSets,
  mothershipSelfHoldMaterialIds,
  collectMothershipEligibleCommands,
  listZordRushPaymentVariants,
  validateZordAdditionalPayment,
} from "./mothership";
import {
  collectZordDownMaterials,
  needsZordDownDestinationChoice,
  needsZordDownPayment,
} from "./zordDown";
import {
  collectZordMaterials,
  hasAllRequiredFusionMaterials,
  needsZordMaterial,
  requiresAllFusionPartners,
  zordOffersCommandOrDiscard,
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
  if (!def || (!isUnit(def) && !isVehicle(def))) return false;

  if (requiresAllFusionPartners(found.card.cardId)) {
    return canRushUnit(
      player,
      state.definitions,
      def!,
      found.card.instanceId,
      undefined,
      undefined,
      undefined,
      rushPowerBudget(state, playerId, player, def!),
      { ...state, playerId },
    );
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
      rushPowerBudget(state, playerId, player, def!),
      { ...state, playerId },
    ),
  );
}

function canAffordZordPower(
  state: GameState,
  playerId: PlayerId,
  def: NonNullable<ReturnType<typeof getDefinition>>,
): boolean {
  const cost = effectivePowerCost(state, playerId, parsePowerCost(def.powerCost) + redRacerPowerCostBonus(state, playerId, def.id));
  // ルール: R-RUSH-11 — アブレラ【闇の取引】等の補填を含めて、追加条件の実行前に確認する。
  return rushPowerBudget(state, playerId, state.players[playerId], def) >= cost;
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
    if ((setup.chosenMaterialIds?.length ?? 0) > 0) {
      // 「それぞれ」の2体目以降: 行き先を選ばずに素材を選ぶと直前と同じ行き先になる。
      for (const materialInstanceId of setup.validInstanceIds) {
        const advanced = advanceZordSetup(state, setup, { materialInstanceId });
        if (advanced.kind !== "error") {
          actions.push({ type: "resolve_zord_setup", playerId, materialInstanceId });
        }
      }
      // 残りを【母艦】ホールドで代えることもできる（RS-076 Q7・RS-075 Q2）。
      const advanced = advanceZordSetup(state, setup, { paymentPath: "mothership" });
      if (advanced.kind !== "error") {
        actions.push({ type: "resolve_zord_setup", playerId, paymentPath: "mothership" });
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
    if (setup.mothershipAvailable || (setup.chosenMaterialIds?.length ?? 0) > 0) {
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
  if (!def || (!isUnit(def) && !isVehicle(def))) return null;

  if (needsZordDownPayment(found.card.cardId, def.powerCost, def)) {
    return createZordDownSetup(state, playerId, found.card);
  }

  if (!needsZordMaterial(state.definitions, found.card.cardId)) {
    return null;
  }

  if (requiresAllFusionPartners(found.card.cardId)) {
    if (
      !hasAllRequiredFusionMaterials(
        player,
        state.definitions,
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
    if (!canAffordZordPower(state, playerId, def!)) return null;
  } else if (canPayZordWithMothership(player, state.definitions, found.card.cardId)) {
    if (!canAffordZordPower(state, playerId, def!)) return null;
  } else {
    return null;
  }

  if (materials.length > 0) {
    const materialIds = materials.map((c) => c.instanceId);
    const commandZoneHasSpace = commandZoneFitsMaterials(state, player.command.length, found.card.cardId);
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
  const category = mothershipKind.commandCategory;
  return collectMothershipEligibleCommands(player, state.definitions, category).map(
    (e) => e.card.instanceId,
  );
}

/**
 * 「自軍Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする」（RS-196 等）は1体ごとに行き先を選ぶ（grnrngr/faq-card-4 RS-196 Q2）。
 * 「それぞれ」の無い「自軍Sユニットを2体コマンドゾーンに送るか捨札にする」（RS-531・RS-532）は、2体とも同じ行き先
 * （atwiki/page-1158 Q1・page-1159 Q2「両方コマンドゾーン」か「両方捨札」）。
 */
function destinationPerUnit(state: GameState, zordCardId: string): boolean {
  return /それぞれ/.test(getDefinition(state.definitions, zordCardId)?.rushAdditionalCondition?.text ?? "");
}

/** コマンドゾーンを行き先に選べるか（同じ行き先なら素材すべてが入る空きが要る）。 */
function commandZoneFitsMaterials(state: GameState, commandCount: number, zordCardId: string): boolean {
  if (destinationPerUnit(state, zordCardId)) return commandCount < COMMAND_ZONE_MAX;
  return commandCount + Math.max(1, zordMaterialUnitCount(state, zordCardId)) <= COMMAND_ZONE_MAX;
}

function needsDestinationChoice(
  zordCardId: string,
  commandZoneHasSpace: boolean,
): boolean {
  return zordOffersCommandOrDiscard(zordCardId, getZordCondition(zordCardId)) && commandZoneHasSpace;
}

function createZordDownSetup(
  state: GameState,
  playerId: PlayerId,
  rushingCard: { cardId: string; instanceId: string },
): PendingZordSetup | null {
  const player = state.players[playerId];
  const materials = collectZordDownMaterials(
    player,
    state.definitions,
    rushingCard.cardId,
    rushingCard.instanceId,
  );
  if (materials.length === 0) return null;

  const commandZoneHasSpace = player.command.length < COMMAND_ZONE_MAX;
  const base = {
    playerId,
    zordInstanceId: rushingCard.instanceId,
    zordCardId: rushingCard.cardId,
    direction: "down" as const,
    validInstanceIds: materials.map((c) => c.instanceId),
    mothershipAvailable: false,
  };

  if (
    needsZordDownDestinationChoice(
      rushingCard.cardId,
      state.definitions,
      commandZoneHasSpace,
    )
  ) {
    return { ...base, step: "destination" };
  }

  return { ...base, step: "material" };
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
    if (
      input.destination === undefined &&
      (setup.chosenMaterialIds?.length ?? 0) > 0 &&
      (input.materialInstanceId !== undefined || input.paymentPath === "mothership")
    ) {
      // 2体目以降で行き先を選ばずに素材（または母艦）を選んだ — 直前と同じ行き先にする。
      const prev = setup.chosenMaterialDestinations?.at(-1) ?? "discard";
      return advanceZordSetup(state, { ...setup, step: "material", materialDestination: prev }, input);
    }
    const dest = input.destination;
    if (dest !== "command" && dest !== "discard") {
      return { kind: "error", error: "invalid_destination" };
    }
    if (
      dest === "command" &&
      setup.direction !== "down" &&
      (setup.chosenMaterialIds?.length ?? 0) === 0 &&
      !commandZoneFitsMaterials(state, player.command.length, setup.zordCardId)
    ) {
      return { kind: "error", error: "invalid_destination" };
    }

    const materialIds =
      setup.validInstanceIds.length > 0 || (setup.chosenMaterialIds?.length ?? 0) > 0
        ? setup.validInstanceIds
        : setup.direction === "down"
          ? collectZordDownMaterials(
              player,
              state.definitions,
              setup.zordCardId,
              setup.zordInstanceId,
            ).map((c) => c.instanceId)
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
    if (setup.direction === "down") {
      const materialId = input.materialInstanceId;
      if (!materialId || !setup.validInstanceIds.includes(materialId)) {
        return { kind: "error", error: "invalid_material" };
      }
      const destination =
        setup.materialDestination ??
        (needsZordDownDestinationChoice(
          setup.zordCardId,
          state.definitions,
          player.command.length < COMMAND_ZONE_MAX,
        )
          ? undefined
          : "discard");
      if (
        needsZordDownDestinationChoice(
          setup.zordCardId,
          state.definitions,
          player.command.length < COMMAND_ZONE_MAX,
        ) &&
        !destination
      ) {
        return { kind: "error", error: "invalid_destination" };
      }
      return completeZordDownPayment(state, setup, materialId, destination);
    }

    if (input.paymentPath === "mothership") {
      if ((setup.chosenMaterialIds?.length ?? 0) > 0) {
        // faq-card-2 RS-076 Q7・RS-075 Q2 — 一部を素材で満たし、残りを【母艦】ホールドで代える。
        return partialMothershipStep(state, setup);
      }
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

    const commandZoneHasSpace = commandZoneFitsMaterials(state, player.command.length, setup.zordCardId);
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

    // ルール: R-ADD-04 — 「Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする」（RS-197 等）は
    // 必要な体数だけ素材を選ぶ。
    const needed = zordMaterialUnitCount(state, setup.zordCardId);
    if (needed > 1) {
      const chosen = [...(setup.chosenMaterialIds ?? []), materialId];
      // 「それぞれ」— 行き先は1体ごとに選ぶ（grnrngr/faq-card-4 RS-196 Q2）。
      const perUnitDestination =
        needsDestinationChoice(setup.zordCardId, commandZoneHasSpace) && destinationPerUnit(state, setup.zordCardId);
      const chosenDestinations =
        destination && (perUnitDestination || (setup.chosenMaterialDestinations?.length ?? 0) > 0)
          ? [...(setup.chosenMaterialDestinations ?? []), destination]
          : setup.chosenMaterialDestinations;
      if (chosen.length < needed) {
        const remaining = setup.validInstanceIds.filter((id) => !chosen.includes(id));
        if (
          remaining.length < needed - chosen.length &&
          partialMothershipStep(state, { ...setup, chosenMaterialIds: chosen, materialDestination: destination })
            .kind === "error"
        ) {
          return { kind: "error", error: "invalid_material" };
        }
        const commandCount = (chosenDestinations ?? []).filter((d) => d === "command").length;
        const askNextDestination =
          perUnitDestination &&
          remaining.length > 0 &&
          player.command.length + commandCount < COMMAND_ZONE_MAX;
        return {
          kind: "continue",
          setup: {
            ...setup,
            step: askNextDestination ? "destination" : "material",
            chosenMaterialIds: chosen,
            chosenMaterialDestinations: chosenDestinations,
            materialDestination: askNextDestination
              ? undefined
              : perUnitDestination && remaining.length > 0
                ? "discard" // コマンドゾーンが埋まった — 残りは捨札にするしかない
                : destination,
            validInstanceIds: remaining,
          },
        };
      }
      return completeMultiZordPayment(state, setup, chosen, destination, chosenDestinations);
    }

    return completeZordPayment(state, setup, materialId, destination);
  }

  if (setup.step === "mothership") {
    if ((setup.chosenMaterialIds?.length ?? 0) > 0) {
      return completePartialMothershipPayment(state, setup);
    }
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

/** 選んだ素材で足りない体数を【母艦】ホールドで代えられるとき、母艦ステップへ進む。 */
function partialMothershipStep(
  state: GameState,
  setup: PendingZordSetup,
): ZordSetupAdvanceResult {
  const chosen = setup.chosenMaterialIds ?? [];
  const player = state.players[setup.playerId];
  const kind = canUseMothershipForZordRush(state.definitions, player, setup.zordCardId);
  // ルール: 母艦は「コマンドゾーンに送るかわりに」なので、素材を捨札にする経路とは併用できない（RS-076 Q5）。
  if (!kind || chosen.length === 0 || setup.materialDestination !== "command") {
    return { kind: "error", error: "invalid_mothership" };
  }
  if (player.command.length + chosen.length > COMMAND_ZONE_MAX) {
    return { kind: "error", error: "invalid_destination" };
  }
  const holdsRequired = zordMaterialUnitCount(state, setup.zordCardId) - chosen.length;
  if (holdsRequired <= 0) return { kind: "error", error: "invalid_mothership" };
  const selfHolds = mothershipSelfHoldMaterialIds(
    player,
    state.definitions,
    kind,
    chosen,
    setup.materialDestination,
  );
  // カテゴリのホールドを先に行うので、同じカテゴリならその1つ分を残しておく必要がある。
  const def = getDefinition(state.definitions, setup.zordCardId);
  const categoryPending =
    !isCostWindowSatisfied(player, "rush_category") &&
    !isShironLightRushTarget(player, setup.zordInstanceId) &&
    def !== undefined &&
    cardCategories(def).includes(kind.commandCategory);
  const commandHolds = listMothershipHoldSets(
    player,
    state.definitions,
    setup.zordCardId,
    kind,
    Math.max(0, holdsRequired - selfHolds.length) + (categoryPending ? 1 : 0),
  );
  if (commandHolds.length === 0) return { kind: "error", error: "invalid_mothership" };
  return {
    kind: "continue",
    setup: {
      ...setup,
      step: "mothership",
      validInstanceIds: collectMothershipTargetIds(state, setup.playerId, setup.zordCardId),
    },
  };
}

function completePartialMothershipPayment(
  state: GameState,
  setup: PendingZordSetup,
): ZordSetupAdvanceResult {
  const playerId = setup.playerId;
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, setup.zordCardId);
  if (!def) return { kind: "error", error: "invalid_card" };
  const chosen = setup.chosenMaterialIds ?? [];
  const destination = setup.materialDestination;
  const holdsRequired = zordMaterialUnitCount(state, setup.zordCardId) - chosen.length;
  const shironRush = isShironLightRushTarget(player, setup.zordInstanceId);
  // カテゴリのホールドが済んでいれば（またはシロンの光）すぐ母艦ホールドを選ぶ。
  if (shironRush || isCostWindowSatisfied(player, "rush_category")) {
    const mothership = buildPartialMothershipHoldPayment(
      state,
      playerId,
      setup.zordInstanceId,
      setup.zordCardId,
      chosen,
      destination,
      holdsRequired,
    );
    return mothership
      ? { kind: "payment", payment: mothership }
      : { kind: "error", error: "cannot_complete_zord" };
  }
  // faq-card-2 RS-075 Q2 — まずカテゴリのコマンドをホールドし、その後に追加条件（素材・母艦ホールド）。
  const payment = buildCategoryPayment(
    state,
    playerId,
    setup.zordInstanceId,
    setup.zordCardId,
    cardCategories(def),
    {
      type: "rush",
      zordMaterialInstanceIds: chosen,
      zordMaterialDestination: destination,
      zordMothershipHoldsPending: holdsRequired,
    },
    false,
    { perRushPayment: true },
  );
  if (payment) return { kind: "payment", payment };
  return { kind: "error", error: "cannot_complete_zord" };
}

function zordMaterialUnitCount(state: GameState, zordCardId: string): number {
  const def = getDefinition(state.definitions, zordCardId);
  const condition = getZordCondition(zordCardId);
  if (!condition || !isSendSUnitZordCondition(condition)) return 1;
  const count = def?.rushAdditionalCondition?.unitCount;
  return typeof count === "number" && count > 1 ? count : 1;
}

function completeMultiZordPayment(
  state: GameState,
  setup: PendingZordSetup,
  materialInstanceIds: string[],
  singleDestination: ZordMaterialDestination | undefined,
  perMaterialDestinations?: ZordMaterialDestination[],
): ZordSetupAdvanceResult {
  const playerId = setup.playerId;
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, setup.zordCardId);
  if (!def) return { kind: "error", error: "invalid_card" };
  const destinations =
    perMaterialDestinations && perMaterialDestinations.length === materialInstanceIds.length
      ? perMaterialDestinations
      : undefined;
  // 行き先が混在するときは、コマンドゾーンの空き確認のため「command」を代表にする。
  const materialDestination = destinations
    ? destinations.includes("command")
      ? "command"
      : "discard"
    : singleDestination;
  const commandCount = destinations
    ? destinations.filter((d) => d === "command").length
    : materialDestination === "command"
      ? materialInstanceIds.length
      : 0;
  if (player.command.length + commandCount > COMMAND_ZONE_MAX) {
    return { kind: "error", error: "invalid_destination" };
  }
  const shironRush = isShironLightRushTarget(player, setup.zordInstanceId);
  if (shironRush || isCostWindowSatisfied(player, "rush_category")) {
    return {
      kind: "rush",
      action: {
        type: "rush",
        playerId,
        instanceId: setup.zordInstanceId,
        zordMaterialInstanceIds: materialInstanceIds,
        zordMaterialDestination: materialDestination,
        ...(destinations ? { zordMaterialDestinations: destinations } : {}),
      },
    };
  }
  const payment = buildCategoryPayment(
    state,
    playerId,
    setup.zordInstanceId,
    setup.zordCardId,
    cardCategories(def),
    {
      type: "rush",
      zordMaterialInstanceIds: materialInstanceIds,
      zordMaterialDestination: materialDestination,
      ...(destinations ? { zordMaterialDestinations: destinations } : {}),
    },
    false,
    { perRushPayment: true },
  );
  if (payment) return { kind: "payment", payment };
  return { kind: "error", error: "cannot_complete_zord" };
}

function completeZordDownPayment(
  state: GameState,
  setup: PendingZordSetup,
  materialInstanceId: string,
  materialDestination: ZordMaterialDestination | undefined,
): ZordSetupAdvanceResult {
  const playerId = setup.playerId;
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, setup.zordCardId);
  if (!def) return { kind: "error", error: "invalid_card" };

  const shironRush = isShironLightRushTarget(player, setup.zordInstanceId);
  const canRush = shironRush
    ? canRushUnitExceptCommandHold(
        player,
        state.definitions,
        def,
        setup.zordInstanceId,
        materialInstanceId,
        undefined,
        materialDestination,
        rushPowerBudget(state, playerId, player, def!),
        { ...state, playerId },
      )
    : canRushUnit(
        player,
        state.definitions,
        def,
        setup.zordInstanceId,
        materialInstanceId,
        undefined,
        materialDestination,
        rushPowerBudget(state, playerId, player, def!),
        { ...state, playerId },
      );

  if (!canRush) return { kind: "error", error: "cannot_complete_zord" };

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
  return { kind: "error", error: "cannot_complete_zord" };
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
          rushPowerBudget(state, playerId, player, def!),
          { ...state, playerId },
        )
      : canRushUnit(
          player,
          state.definitions,
          def,
          setup.zordInstanceId,
          materialInstanceId,
          undefined,
          materialDestination,
          rushPowerBudget(state, playerId, player, def!),
          { ...state, playerId },
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
