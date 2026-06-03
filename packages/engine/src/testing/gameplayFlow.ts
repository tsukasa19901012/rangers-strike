import {
  getZordCondition,
  isSendSUnitZordCondition,
  isZordUpCost,
  listZordFusionPartnerIds,
  mothershipSubstitutesCondition,
  MOTHERSHIP_CONFIG,
  type CardDefinition,
  type ZordConditionId,
} from "@rangers-strike/cards";
import { expect } from "vitest";
import type { ZordMaterialDestination } from "../types/actions";
import { applyAction } from "../core/applyAction";
import {
  cardCategories,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { getLegalActions } from "../core/legalActions";
import { opponent } from "../core/helpers";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getBattleEntryPaymentNeeds } from "../rules/commandPayment";
import { canUseMothershipForZordRush, listZordRushPaymentVariants } from "../rules/mothership";
import { needsEffectHoldPayment } from "../rules/commandPayment";
import { collectZordMaterials, requiresAllFusionPartners } from "../rules/zord";
import { createTestState, inst } from "./fixtures";
import { rushWithCategoryHold } from "./rushPayment";

export type ZordRushPaymentVariant = {
  zordMaterialInstanceId?: string;
  zordMaterialDestination?: ZordMaterialDestination;
  zordMothershipHoldInstanceIds?: string[];
};

export function unwrapAction(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error ?? "illegal_action");
  return result.state;
}

export function commandCardIdForCategories(categories: string[]): string {
  if (categories.includes("WB")) return "TST-OP";
  if (categories.includes("ET")) return "TST-OP-ET";
  if (categories.includes("OT")) return "TST-OP-OT";
  if (categories.includes("MA")) return "TST-OP-MA";
  if (categories.includes("DA")) return "TST-OP-DA";
  return "TST-OP";
}

export function powerCards(count: number, prefix = "p"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

/** Small unit usable as send_s_unit_* material for most zords. */
export const DEFAULT_S_MATERIAL = "RS-080";

function addMothershipToRush(
  rush: CardInstance[],
  zordCardId: string,
  definitions: Record<string, CardDefinition>,
): CardInstance[] {
  const condition = getZordCondition(zordCardId);
  const next = [...rush];
  for (const kind of ["jaguar", "dekabase"] as const) {
    if (!condition || !mothershipSubstitutesCondition(kind, condition)) continue;
    const msCardId = MOTHERSHIP_CONFIG[kind].cardId;
    if (!definitions[msCardId]) continue;
    if (next.some((c) => c.cardId === msCardId)) continue;
    next.push(inst(msCardId, `ms-${kind}`));
    break;
  }
  return next;
}

function buildRushZone(
  zordCardId: string,
  condition: ZordConditionId | undefined,
  definitions: Record<string, CardDefinition>,
  zordInstanceId: string,
): CardInstance[] {
  if (!condition) return [];

  if (condition === "discard_fusion_unit") {
    const partners = listZordFusionPartnerIds(zordCardId);
    if (partners.length > 0) {
      return partners.map((id, index) => inst(id, `fusion-${index}`));
    }
    return [inst("RS-051", "fusion-fallback")];
  }

  if (isSendSUnitZordCondition(condition)) {
    const materialId = definitions[DEFAULT_S_MATERIAL]
      ? DEFAULT_S_MATERIAL
      : "TST-UNIT-0";
    if (isSmallUnit(definitions, materialId)) {
      return [inst(materialId, "s-material")];
    }
    return [inst("TST-UNIT-0", "s-material")];
  }

  return [];
}

export function pickZordPaymentVariant(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  zordCardId: string,
  zordInstanceId: string,
): ZordRushPaymentVariant | null {
  const materials = collectZordMaterials(
    player,
    definitions,
    zordCardId,
    zordInstanceId,
  );
  const variants = listZordRushPaymentVariants(
    player,
    definitions,
    zordCardId,
    zordInstanceId,
    materials,
    player.command.length < 5,
  );
  if (variants.length === 0) return null;
  const preferDiscard =
    getZordCondition(zordCardId) === "send_s_unit_to_command_or_discard";
  const picked =
    variants.find((v) => v.zordMaterialDestination === "discard") ??
    variants.find((v) => !v.zordMothershipHoldInstanceIds?.length) ??
    variants[0];
  if (preferDiscard && picked?.zordMaterialInstanceId) {
    const discardVariant = variants.find(
      (v) =>
        v.zordMaterialInstanceId === picked.zordMaterialInstanceId &&
        v.zordMaterialDestination === "discard",
    );
    return discardVariant ?? picked;
  }
  return picked ?? null;
}

export type ZordRushSetup = {
  state: GameState;
  zordInstanceId: string;
  commandInstanceId: string;
  payment: ZordRushPaymentVariant;
};

/** Minimal rush-phase state for a zord-up unit with additional condition satisfied. */
export function buildZordRushSetup(
  definitions: Record<string, CardDefinition>,
  zordCardId: string,
): ZordRushSetup | null {
  const def = definitions[zordCardId];
  if (!def || def.type !== "unit" || !isZordUpCost(def.powerCost)) return null;

  const zord = inst(zordCardId, "zord");
  const categories = cardCategories(def);
  const cmd = inst(commandCardIdForCategories(categories), "cmd-pay");
  const cost = parsePowerCost(def.powerCost);
  const condition = getZordCondition(zordCardId);

  let rush = buildRushZone(zordCardId, condition, definitions, zord.instanceId);
  rush = addMothershipToRush(rush, zordCardId, definitions);

  const player1: PlayerState = {
    id: "player1",
    deck: [],
    hand: [zord],
    discard: [],
    power: powerCards(cost),
    command: [cmd],
    rush,
    battle: [],
    operation: [],
    damage: 0,
  };

  const payment = pickZordPaymentVariant(player1, definitions, zordCardId, zord.instanceId);
  const fusion = requiresAllFusionPartners(zordCardId);
  if (!payment && !fusion) return null;

  const state = createTestState({
    phase: "rush",
    definitions,
    player1,
    player2: { deck: powerCards(10, "e") },
  });

  if (fusion) {
    return { state, zordInstanceId: zord.instanceId, commandInstanceId: cmd.instanceId, payment: {} };
  }
  return {
    state,
    zordInstanceId: zord.instanceId,
    commandInstanceId: cmd.instanceId,
    payment,
  };
}

export function rushUnitWithCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceId: string,
  zord?: ZordRushPaymentVariant,
): GameState {
  return unwrapAction(
    rushWithCategoryHold(state, playerId, unitInstanceId, commandInstanceId, zord),
  );
}

export function settleReactiveWindows(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 40; i += 1) {
    if (next.winner) return next;

    if (next.pendingCommandPayment) return next;

    if (next.pendingRush) {
      const actor = next.activePlayer;
      const pass = applyAction(next, {
        type: "pass_rush_reaction",
        playerId: actor,
      });
      if (pass.ok) {
        next = pass.state;
        continue;
      }
    }

    if (next.pendingBattleEntry) {
      const owner = next.pendingBattleEntry.playerId;
      const pass = applyAction(next, {
        type: "pass_battle_entry",
        playerId: owner,
      });
      if (pass.ok) {
        next = pass.state;
        continue;
      }
    }

    const choice = next.pendingEffectChoice;
    if (choice?.optional) {
      const skip = applyAction(next, {
        type: "skip_effect_choice",
        playerId: choice.playerId,
      });
      if (skip.ok) {
        next = skip.state;
        continue;
      }
    }

    if (choice && needsEffectHoldPayment(choice)) return next;

    break;
  }
  return next;
}

export function advanceToBattlePhase(state: GameState): GameState {
  let next = settleReactiveWindows(state);
  for (let i = 0; i < 12; i += 1) {
    if (next.phase === "battle" || next.winner) return settleReactiveWindows(next);
    const actor = next.activePlayer;
    const canEnd = getLegalActions(next).some(
      (a) => a.type === "end_phase" && a.playerId === actor,
    );
    if (!canEnd) return settleReactiveWindows(next);
    next = unwrapAction(
      applyAction(next, { type: "end_phase", playerId: actor }),
    );
    next = settleReactiveWindows(next);
  }
  return next;
}

export function moveToBattleWithHolds(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceId: string,
): GameState {
  const player = state.players[playerId];
  const unit = player.rush.find((c) => c.instanceId === unitInstanceId);
  if (!unit) throw new Error("unit_not_in_rush");

  const needs = getBattleEntryPaymentNeeds(state, playerId, unit);
  let next = state;
  if (needs) {
    next = unwrapAction(
      applyAction(next, {
        type: "initiate_command_payment",
        playerId,
        kind: "battle_entry",
        sourceInstanceId: unitInstanceId,
      }),
    );
    next = unwrapAction(
      applyAction(next, {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: [commandInstanceId],
      }),
    );
    if (next.players[playerId].battle.some((c) => c.instanceId === unitInstanceId)) {
      return next;
    }
  }

  return unwrapAction(
    applyAction(next, {
      type: "move_to_battle",
      playerId,
      instanceId: unitInstanceId,
    }),
  );
}

/** Battle and strike are offered together during pendingBattleEntry (pick one). */
export function expectBattleEntryCombatOptions(
  state: GameState,
  attackerId: string,
  defenderId: string,
  options?: { expectStrike?: boolean },
): void {
  expect(state.pendingBattleEntry?.instanceId).toBe(attackerId);
  const legal = getLegalActions(state);
  expect(
    legal.some(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === attackerId &&
        a.defenderInstanceId === defenderId,
    ),
  ).toBe(true);
  if (options?.expectStrike !== false) {
    expect(
      legal.some((a) => a.type === "strike" && a.instanceId === attackerId),
    ).toBe(true);
  }
}

export function executeBattleFromEntry(
  state: GameState,
  attackerId: string,
  defenderId: string,
): GameState {
  let next = unwrapAction(
    applyAction(state, {
      type: "battle",
      playerId: "player1",
      attackerInstanceId: attackerId,
      defenderInstanceId: defenderId,
    }),
  );
  next = settleReactiveWindows(next);
  expect(next.players.player2.battle).toHaveLength(0);
  return next;
}

export function executeStrikeFromEntry(
  state: GameState,
  attackerId: string,
): GameState {
  const afterStrike = unwrapAction(
    applyAction(state, {
      type: "strike",
      playerId: "player1",
      instanceId: attackerId,
    }),
  );
  expect(afterStrike.players.player2.damage).toBeGreaterThan(0);
  return settleReactiveWindows(afterStrike);
}

export function findRushLegalAction(
  state: GameState,
  instanceId: string,
): GameAction | undefined {
  return getLegalActions(state).find(
    (a) => a.type === "rush" && a.instanceId === instanceId,
  );
}
