import type { GameState, PlayerId } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import { effectiveBp } from "../core/catalog";
import { opponent } from "../core/helpers";
import { strikeDamageFor } from "../rules/combo";

function maxEnemyStrikeThreat(
  state: GameState,
  playerId: PlayerId,
): number {
  const enemyId = opponent(playerId);
  let max = 0;
  for (const card of state.players[enemyId].battle) {
    max = Math.max(
      max,
      strikeDamageFor(state.definitions, card, state, enemyId),
    );
  }
  return max;
}

function fieldPower(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  let total = 0;
  for (const card of [...player.battle, ...player.rush]) {
    total += effectiveBp(state, playerId, card);
  }
  return total;
}

/** Heuristic board evaluation from the given player's perspective. */
export function evaluateState(state: GameState, playerId: PlayerId): number {
  if (state.winner === playerId) return 100_000;
  if (state.winner === opponent(playerId)) return -100_000;

  const self = state.players[playerId];
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];

  let score = 0;

  score += enemy.damage * 800;
  score -= self.damage * 900;

  if (enemy.damage >= WIN_DAMAGE - 1) score += 2_000;
  if (self.damage >= WIN_DAMAGE - 1) score -= 3_000;

  const selfField = fieldPower(state, playerId);
  const enemyField = fieldPower(state, enemyId);
  score += selfField / 8;
  score -= enemyField / 8;

  score += self.power.length * 150;
  score -= enemy.power.length * 100;
  score += self.command.length * 50;
  score += self.command.filter((c) => c.commandHeld).length * 40;
  score += self.operation.length * 400;

  score -= self.hand.length * 30;
  score -= enemy.hand.length * 20;

  score += self.deck.length * 5;
  score -= enemy.deck.length * 5;

  const strikeThreat = maxEnemyStrikeThreat(state, playerId);
  score -= strikeThreat * 250;
  if (self.damage + strikeThreat >= WIN_DAMAGE) {
    score -= 2_500;
  }

  return score;
}
