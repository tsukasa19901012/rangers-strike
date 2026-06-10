import type { PlayerState } from "../types/game";
import {
  addTurnRestrictionModifier,
  getPlayerModifiers,
  hasScopedRestriction,
  hasTurnRuleModifier,
} from "../core/scopedModifiers";
import { RESTRICTION_IDS, TURN_RULE_IDS } from "../types/scopedModifiers";

export type SComboFinisher = "goren_storm" | "jacker_hurricane";

function sumRulePayload(player: PlayerState, ruleId: string): number {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .reduce((sum, m) => sum + (typeof m.payload === "number" ? m.payload : 0), 0);
}

function firstRulePayload<T>(player: PlayerState, ruleId: string): T | undefined {
  const mod = getPlayerModifiers(player).find(
    (m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn",
  );
  return mod?.payload as T | undefined;
}

export function getComboNumberDelta(player: PlayerState): number {
  return sumRulePayload(player, TURN_RULE_IDS.COMBO_NUMBER_DELTA);
}

export function addComboNumberDelta(player: PlayerState, delta: number): PlayerState {
  const current = getComboNumberDelta(player);
  const nextDelta = current + delta;
  const withoutOld = getPlayerModifiers(player).filter(
    (m) => !(m.kind === "rule" && m.ruleId === TURN_RULE_IDS.COMBO_NUMBER_DELTA),
  );
  return {
    ...player,
    modifiers: [
      ...withoutOld,
      {
        kind: "rule",
        ruleId: TURN_RULE_IDS.COMBO_NUMBER_DELTA,
        scope: "turn",
        payload: nextDelta,
      },
    ],
  };
}

export function getSComboFinisher(player: PlayerState): SComboFinisher | undefined {
  return firstRulePayload<SComboFinisher>(player, TURN_RULE_IDS.S_COMBO_FINISHER);
}

export function setSComboFinisher(
  player: PlayerState,
  finisher: SComboFinisher,
  sourceCardId?: string,
): PlayerState {
  const withoutOld = getPlayerModifiers(player).filter(
    (m) => !(m.kind === "rule" && m.ruleId === TURN_RULE_IDS.S_COMBO_FINISHER),
  );
  return {
    ...player,
    modifiers: [
      ...withoutOld,
      {
        kind: "rule",
        ruleId: TURN_RULE_IDS.S_COMBO_FINISHER,
        scope: "turn",
        payload: finisher,
        sourceCardId,
      },
    ],
  };
}

export function getAuraPowerInstanceId(player: PlayerState): string | undefined {
  return firstRulePayload<string>(player, TURN_RULE_IDS.AURA_POWER);
}

export function setAuraPowerInstanceId(
  player: PlayerState,
  instanceId: string,
  sourceCardId?: string,
): PlayerState {
  const withoutOld = getPlayerModifiers(player).filter(
    (m) => !(m.kind === "rule" && m.ruleId === TURN_RULE_IDS.AURA_POWER),
  );
  return {
    ...player,
    modifiers: [
      ...withoutOld,
      {
        kind: "rule",
        ruleId: TURN_RULE_IDS.AURA_POWER,
        scope: "turn",
        payload: instanceId,
        sourceCardId,
      },
    ],
  };
}

export function addBakiBakiExtraAttack(player: PlayerState, instanceId: string): PlayerState {
  if (hasBakiBakiExtraAttack(player, instanceId)) return player;
  return addTurnRestrictionModifier(
    player,
    instanceId,
    RESTRICTION_IDS.BAKI_BAKI_EXTRA_ATTACK,
  );
}

export function clearBakiBakiExtraAttackModifier(
  player: PlayerState,
  instanceId: string,
): PlayerState {
  const remaining = getPlayerModifiers(player).filter(
    (m) =>
      !(
        m.kind === "restriction" &&
        m.instanceId === instanceId &&
        m.restriction === RESTRICTION_IDS.BAKI_BAKI_EXTRA_ATTACK
      ),
  );
  return {
    ...player,
    modifiers: remaining.length > 0 ? remaining : undefined,
  };
}

export function hasBakiBakiExtraAttack(player: PlayerState, instanceId: string): boolean {
  return hasScopedRestriction(player, instanceId, RESTRICTION_IDS.BAKI_BAKI_EXTRA_ATTACK, "turn");
}

export function hasAuraPowerRule(player: PlayerState): boolean {
  return hasTurnRuleModifier(player, TURN_RULE_IDS.AURA_POWER);
}
