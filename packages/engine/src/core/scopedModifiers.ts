import type { PlayerState } from "../types/game";
import type {
  ModifierScope,
  RushPhaseRuleId,
  ScopedModifier,
  TurnRuleId,
} from "../types/scopedModifiers";

export { RUSH_PHASE_RULE_IDS, RESTRICTION_IDS, TURN_RULE_IDS } from "../types/scopedModifiers";
export type {
  ModifierScope,
  RushPhaseRuleId,
  ScopedModifier,
  TurnRuleId,
} from "../types/scopedModifiers";

export function getPlayerModifiers(player: PlayerState): ScopedModifier[] {
  return player.modifiers ?? [];
}

export function hasScopedRuleModifier(
  player: PlayerState,
  ruleId: string,
  scope: ModifierScope,
): boolean {
  return getPlayerModifiers(player).some(
    (m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === scope,
  );
}

export function hasTurnRuleModifier(
  player: PlayerState,
  ruleId: TurnRuleId | string,
): boolean {
  return hasScopedRuleModifier(player, ruleId, "turn");
}

export function hasRushPhaseRuleModifier(
  player: PlayerState,
  ruleId: RushPhaseRuleId | string,
): boolean {
  return hasScopedRuleModifier(player, ruleId, "rush_phase");
}

export function hasScopedRestriction(
  player: PlayerState,
  instanceId: string,
  restriction: string,
  scope: ModifierScope = "turn",
): boolean {
  return getPlayerModifiers(player).some(
    (m) =>
      m.kind === "restriction" &&
      m.instanceId === instanceId &&
      m.restriction === restriction &&
      m.scope === scope,
  );
}

function addScopedRuleModifier(
  player: PlayerState,
  ruleId: string,
  scope: ModifierScope,
  options?: { sourceCardId?: string },
): PlayerState {
  if (hasScopedRuleModifier(player, ruleId, scope)) return player;
  const modifiers: ScopedModifier[] = [
    ...getPlayerModifiers(player),
    {
      kind: "rule",
      ruleId,
      scope,
      sourceCardId: options?.sourceCardId,
    },
  ];
  return { ...player, modifiers };
}

export function addTurnRuleModifier(
  player: PlayerState,
  ruleId: TurnRuleId | string,
  options?: { sourceCardId?: string },
): PlayerState {
  return addScopedRuleModifier(player, ruleId, "turn", options);
}

export function addRushPhaseRuleModifier(
  player: PlayerState,
  ruleId: RushPhaseRuleId | string,
  options?: { sourceCardId?: string },
): PlayerState {
  return addScopedRuleModifier(player, ruleId, "rush_phase", options);
}

export function addTurnRestrictionModifier(
  player: PlayerState,
  instanceId: string,
  restriction: string,
): PlayerState {
  if (hasScopedRestriction(player, instanceId, restriction, "turn")) return player;
  return {
    ...player,
    modifiers: [
      ...getPlayerModifiers(player),
      { kind: "restriction", instanceId, restriction, scope: "turn" },
    ],
  };
}

export function clearScopedModifiersByScope(
  player: PlayerState,
  scope: ModifierScope,
): PlayerState {
  const remaining = getPlayerModifiers(player).filter((m) => m.scope !== scope);
  return {
    ...player,
    modifiers: remaining.length > 0 ? remaining : undefined,
  };
}

export function clearTurnScopedModifiers(player: PlayerState): PlayerState {
  return clearScopedModifiersByScope(player, "turn");
}

export function clearRushPhaseScopedModifiers(player: PlayerState): PlayerState {
  return clearScopedModifiersByScope(player, "rush_phase");
}
