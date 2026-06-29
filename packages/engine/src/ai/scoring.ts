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

function totalStrikePotential(
  state: GameState,
  playerId: PlayerId,
): number {
  let total = 0;
  for (const card of state.players[playerId].battle) {
    total += strikeDamageFor(state.definitions, card, state, playerId);
  }
  return total;
}

/** 指定プレイヤー視点でのヒューリスティック盤面評価。 */
export function evaluateState(state: GameState, playerId: PlayerId): number {
  if (state.winner === playerId) return 100_000;
  if (state.winner === opponent(playerId)) return -100_000;

  const self = state.players[playerId];
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];

  let score = 0;

  score += enemy.damage * 1_400;
  score -= self.damage * 1_100;
  score += enemy.damage * enemy.damage * 150;

  if (enemy.damage >= WIN_DAMAGE - 2) score += 7_000;
  if (enemy.damage >= WIN_DAMAGE - 1) score += 12_000;
  if (self.damage >= WIN_DAMAGE - 1) score -= 5_500;

  const damageLead = enemy.damage - self.damage;
  if (damageLead > 0) score += damageLead * 280;
  if (damageLead < 0) score += damageLead * 180;

  const selfField = fieldPower(state, playerId);
  const enemyField = fieldPower(state, enemyId);
  score += selfField / 5;
  score -= enemyField / 5;

  score += self.battle.length * 150;
  score -= enemy.battle.length * 110;
  score += self.rush.length * 260;
  score -= enemy.rush.length * 190;

  score += self.power.length * 200;
  score -= enemy.power.length * 140;
  score += self.command.length * 65;
  const heldCommands = self.command.filter((c) => c.commandHeld).length;
  score += heldCommands * 100;
  score += self.operation.length * 550;

  score -= self.hand.length * 22;
  score += enemy.hand.length * 20;

  const selfTotalStrike = totalStrikePotential(state, playerId);
  score += selfTotalStrike * 220;

  const selfStrike = maxSelfStrikePotential(state, playerId);
  score += selfStrike * 520;
  if (enemy.damage + selfStrike >= WIN_DAMAGE) {
    score += 8_000;
  }
  if (enemy.damage + selfTotalStrike >= WIN_DAMAGE) {
    score += 4_000;
  }

  if (state.phase === "battle") {
    score += selfStrike * 280;
    if (state.activePlayer === playerId) {
      score += 650;
      if (enemy.damage + selfStrike >= WIN_DAMAGE) score += 6_000;
      if (self.rush.length > 0) score -= self.rush.length * 520;
    } else {
      score -= 250;
    }
  }

  score += self.deck.length * 12;
  score -= enemy.deck.length * 10;
  if (self.deck.length <= 5) score -= 1_500;
  if (self.deck.length <= 10) score -= 450;
  if (enemy.deck.length <= 8) score += 900;

  const strikeThreat = maxEnemyStrikeThreat(state, playerId);
  score -= strikeThreat * 420;
  if (self.damage + strikeThreat >= WIN_DAMAGE) {
    score -= 5_500;
  }

  if (state.phase === "rush") {
    score += heldCommands * 55;
    if (state.activePlayer === playerId) score += 350;
  }
  if (state.phase === "charge" && state.activePlayer === playerId) {
    score += 200;
  }
  if (state.phase === "battle" && self.battle.length > enemy.battle.length) {
    score += (self.battle.length - enemy.battle.length) * 110;
  }

  return score;
}
