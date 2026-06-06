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

function maxSelfStrikePotential(
  state: GameState,
  playerId: PlayerId,
): number {
  let max = 0;
  for (const card of state.players[playerId].battle) {
    max = Math.max(
      max,
      strikeDamageFor(state.definitions, card, state, playerId),
    );
  }
  return max;
}

/** 指定プレイヤー視点でのヒューリスティック盤面評価。 */
export function evaluateState(state: GameState, playerId: PlayerId): number {
  if (state.winner === playerId) return 100_000;
  if (state.winner === opponent(playerId)) return -100_000;

  const self = state.players[playerId];
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];

  let score = 0;

  score += enemy.damage * 900;
  score -= self.damage * 1_000;

  if (enemy.damage >= WIN_DAMAGE - 2) score += 3_500;
  if (enemy.damage >= WIN_DAMAGE - 1) score += 5_000;
  if (self.damage >= WIN_DAMAGE - 1) score -= 4_000;

  const selfField = fieldPower(state, playerId);
  const enemyField = fieldPower(state, enemyId);
  score += selfField / 6;
  score -= enemyField / 6;

  score += self.battle.length * 120;
  score -= enemy.battle.length * 90;
  score += self.rush.length * 220;
  score -= enemy.rush.length * 160;

  score += self.power.length * 180;
  score -= enemy.power.length * 120;
  score += self.command.length * 55;
  score += self.command.filter((c) => c.commandHeld).length * 50;
  score += self.operation.length * 500;

  score -= self.hand.length * 25;
  score -= enemy.hand.length * 25;

  score += self.deck.length * 6;
  score -= enemy.deck.length * 6;

  const selfStrike = maxSelfStrikePotential(state, playerId);
  score += selfStrike * 400;
  if (enemy.damage + selfStrike >= WIN_DAMAGE) {
    score += 4_000;
  }

  const strikeThreat = maxEnemyStrikeThreat(state, playerId);
  score -= strikeThreat * 320;
  if (self.damage + strikeThreat >= WIN_DAMAGE) {
    score -= 3_500;
  }

  return score;
}
