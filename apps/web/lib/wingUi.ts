import { resolvePlayableCard, type CardDefinition } from "@rangers-strike/cards";
import {
  effectiveBp,
  strikeDamageFor,
  type GameAction,
  type GameState,
  type PlayerId,
} from "@rangers-strike/engine";
import type { BattleEntryTarget } from "@/components/BattleEntryModal";

export function collectWingHoldInstanceIds(
  legalActions: GameAction[],
  playerId: PlayerId,
): Set<string> {
  const ids = new Set<string>();
  for (const action of legalActions) {
    if (action.type === "hold_for_wing" && action.playerId === playerId) {
      ids.add(action.instanceId);
    }
  }
  return ids;
}

export function collectWingAttackerInstanceIds(
  legalActions: GameAction[],
  playerId: PlayerId,
  rushInstanceIds: Iterable<string>,
): Set<string> {
  const rush = new Set(rushInstanceIds);
  const ids = new Set<string>();
  for (const action of legalActions) {
    if (
      action.type === "battle" &&
      action.playerId === playerId &&
      rush.has(action.attackerInstanceId)
    ) {
      ids.add(action.attackerInstanceId);
    }
  }
  return ids;
}

export function findWingBattleAction(
  legalActions: GameAction[],
  attackerInstanceId: string,
  defenderInstanceId: string,
): Extract<GameAction, { type: "battle" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "battle" }> =>
      action.type === "battle" &&
      action.attackerInstanceId === attackerInstanceId &&
      action.defenderInstanceId === defenderInstanceId,
  );
}

export function buildWingBattleModal(
  state: GameState,
  legalActions: GameAction[],
  attackerInstanceId: string,
  playerId: PlayerId,
  enemyPlayerId: PlayerId,
  formatSpLabel: (sp: CardDefinition["sp"], effectiveSp: number) => string,
): {
  unitCard: CardDefinition;
  unitSpLabel: string;
  unitBp: number;
  targets: BattleEntryTarget[];
} | null {
  const unit = state.players[playerId].rush.find(
    (card) => card.instanceId === attackerInstanceId,
  );
  if (!unit) return null;

  const unitCard = resolvePlayableCard(unit.cardId);
  if (!unitCard) return null;

  const definition = state.definitions[unit.cardId];
  const strikeDamage = strikeDamageFor(state.definitions, unit, state, playerId);
  const unitBp = effectiveBp(state, playerId, unit);
  const unitSpLabel = formatSpLabel(definition?.sp, strikeDamage);

  const enemy = state.players[enemyPlayerId];
  const targets: BattleEntryTarget[] = [];

  for (const action of legalActions) {
    if (action.type !== "battle" || action.attackerInstanceId !== attackerInstanceId) {
      continue;
    }
    const inBattle = enemy.battle.find(
      (card) => card.instanceId === action.defenderInstanceId,
    );
    const inRush = enemy.rush.find(
      (card) => card.instanceId === action.defenderInstanceId,
    );
    const card = inBattle ?? inRush;
    if (!card) continue;
    const targetCard = resolvePlayableCard(card.cardId);
    if (!targetCard) continue;
    targets.push({
      instanceId: card.instanceId,
      card: targetCard,
      zone: inBattle ? "battle" : "rush",
    });
  }

  if (targets.length === 0) return null;

  return { unitCard, unitSpLabel, unitBp, targets };
}

export function collectWingAttackTargetIds(
  legalActions: GameAction[],
  attackerInstanceId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const action of legalActions) {
    if (action.type === "battle" && action.attackerInstanceId === attackerInstanceId) {
      ids.add(action.defenderInstanceId);
    }
  }
  return ids;
}
