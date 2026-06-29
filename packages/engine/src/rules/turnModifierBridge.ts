import type { GameState, PendingBattle, PlayerId, PlayerState, ScopedModifier } from "../types/game";
import {
  addTurnRestrictionModifier,
  getPlayerModifiers,
  hasScopedRestriction,
  hasTurnRuleModifier,
} from "../core/scopedModifiers";
import { RESTRICTION_IDS, TURN_RULE_IDS } from "../types/scopedModifiers";

export type SComboFinisher = "goren_storm" | "jacker_hurricane";

export type GenericSComboFinisher = {
  position: number;
  sp: number;
  bp: number;
};

function isTurnRuleModifier(
  m: ScopedModifier,
  ruleId: string,
): m is Extract<ScopedModifier, { kind: "rule" }> {
  return m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn";
}

function sumRulePayload(player: PlayerState, ruleId: string): number {
  return getPlayerModifiers(player)
    .filter((m) => isTurnRuleModifier(m, ruleId))
    .reduce((sum, m) => sum + (typeof m.payload === "number" ? m.payload : 0), 0);
}

function firstRulePayload<T>(player: PlayerState, ruleId: string): T | undefined {
  const mod = getPlayerModifiers(player).find((m) => isTurnRuleModifier(m, ruleId));
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

export function getGenericSComboFinisher(
  player: PlayerState,
): GenericSComboFinisher | undefined {
  return firstRulePayload<GenericSComboFinisher>(
    player,
    TURN_RULE_IDS.GENERIC_S_COMBO_FINISHER,
  );
}

export function setGenericSComboFinisher(
  player: PlayerState,
  config: GenericSComboFinisher,
  sourceCardId?: string,
): PlayerState {
  const withoutOld = getPlayerModifiers(player).filter(
    (m) => !(m.kind === "rule" && m.ruleId === TURN_RULE_IDS.GENERIC_S_COMBO_FINISHER),
  );
  return {
    ...player,
    modifiers: [
      ...withoutOld,
      {
        kind: "rule",
        ruleId: TURN_RULE_IDS.GENERIC_S_COMBO_FINISHER,
        scope: "turn",
        payload: config,
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

export function getBattleDestroyToPowerInstanceIds(player: PlayerState): string[] {
  return getPlayerModifiers(player)
    .filter((m) => isTurnRuleModifier(m, TURN_RULE_IDS.BATTLE_DESTROY_TO_POWER))
    .map((m) => (typeof m.payload === "string" ? m.payload : undefined))
    .filter((id): id is string => !!id);
}

export function setBattleDestroyToPower(
  player: PlayerState,
  instanceId: string,
  sourceCardId?: string,
): PlayerState {
  return {
    ...player,
    modifiers: [
      ...getPlayerModifiers(player),
      {
        kind: "rule",
        ruleId: TURN_RULE_IDS.BATTLE_DESTROY_TO_POWER,
        scope: "turn",
        payload: instanceId,
        sourceCardId,
      },
    ],
  };
}

export function shouldBattleDestroyToPower(
  state: GameState,
  pending: PendingBattle | undefined,
  instanceId: string,
): boolean {
  const marked = [
    ...getBattleDestroyToPowerInstanceIds(state.players.player1),
    ...getBattleDestroyToPowerInstanceIds(state.players.player2),
  ];
  if (marked.includes(instanceId)) return true;
  if (!pending) return false;
  const participants = [
    pending.attackerInstanceId,
    pending.substituteInstanceId ?? pending.defenderInstanceId,
  ];
  if (!participants.includes(instanceId)) return false;
  return marked.some((m) => participants.includes(m));
}
