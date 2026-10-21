import type { GameState, PlayerId } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import { effectiveBp, getDefinition } from "../core/catalog";
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

const CLOCK_UP_IDS = new Set(["RK-021", "RK-078"]);

/**
 * クロックアップに重ねたカードの枚数（場に「加速」のユニットがいるときだけ数える）。
 * 1 枚ごとに「加速」のユニットへのアタックを 1 回止めるので、相手はアタックして減らす価値がある。
 * これが無いと、そのアタックは「バトルが行われない」だけの手に見え、CPU は「加速」のユニットにアタックしなかった。
 */
function clockUpShields(state: GameState, playerId: PlayerId): number {
  const p = state.players[playerId];
  let stacked = 0;
  for (const op of p.operation) if (CLOCK_UP_IDS.has(op.cardId)) stacked += op.stackedCards?.length ?? 0;
  if (stacked === 0) return 0;
  const accel = [...p.battle, ...p.rush].some((c) => getDefinition(state.definitions, c.cardId)?.features?.includes("加速"));
  return accel ? stacked : 0;
}

/** 盤面評価の重み。CPU の調整（scripts/cpu-arena.ts）で差し替えられる。 */
export const DEFAULT_EVAL_WEIGHTS = {
  enemyDamage: 1400,
  selfDamage: 1100,
  enemyDamageSq: 150,
  enemyNearWin2: 7000,
  enemyNearWin1: 12000,
  selfNearLoss1: 5500,
  leadAhead: 280,
  leadBehind: 180,
  selfFieldDiv: 5,
  enemyFieldDiv: 5,
  selfBattle: 150,
  enemyBattle: 110,
  selfRush: 260,
  enemyRush: 190,
  selfPower: 200,
  enemyPower: 140,
  selfCommand: 65,
  heldCommand: 100,
  selfOperation: 550,
  selfHand: 22,
  enemyHand: 20,
  selfTotalStrike: 220,
  selfMaxStrike: 520,
  lethalMax: 8000,
  lethalTotal: 4000,
  battleSelfStrike: 280,
  battleActive: 650,
  battleLethal: 6000,
  battleIdleRush: 520,
  battleInactive: 250,
  selfDeck: 12,
  enemyDeck: 10,
  selfDeckLow5: 1500,
  selfDeckLow10: 450,
  enemyDeckLow8: 900,
  enemyStrikeThreat: 420,
  enemyLethalThreat: 5500,
  rushHeldCommand: 55,
  rushActive: 350,
  chargeActive: 200,
  battleWidth: 110,
  /** クロックアップ（RK-021 / RK-078）に重ねたカード 1 枚（「加速」のユニットへのアタックを 1 回止める）。 */
  clockUpShield: 300,
};
export type EvalWeights = typeof DEFAULT_EVAL_WEIGHTS;

let W: EvalWeights = DEFAULT_EVAL_WEIGHTS;

/** 評価の重みを差し替える（省略で既定値に戻す）。対戦台での比較用。 */
export function setEvalWeights(weights?: Partial<EvalWeights>): void {
  W = weights ? { ...DEFAULT_EVAL_WEIGHTS, ...weights } : DEFAULT_EVAL_WEIGHTS;
}

type ValueEvaluator = (state: GameState, playerId: PlayerId) => number;
let valueEvaluator: ValueEvaluator | null = null;

/**
 * 決着していない盤面の評価を、学習した価値ネットワーク（ai/valueNet.ts の evaluate）に差し替える（省略で手書きに戻す）。
 * 対戦台（scripts/cpu-arena.ts --nna / --nnb）での比較用。
 */
export function setValueEvaluator(evaluator?: ValueEvaluator | null): void {
  valueEvaluator = evaluator ?? null;
}

export function getValueEvaluator(): ValueEvaluator | null {
  return valueEvaluator;
}

/** 指定プレイヤー視点での盤面評価。価値ネットワークが設定されていればそれを使う。 */
export function evaluateState(state: GameState, playerId: PlayerId): number {
  if (state.winner === playerId) return 100_000;
  if (state.winner === opponent(playerId)) return -100_000;
  return valueEvaluator ? valueEvaluator(state, playerId) : heuristicEvaluate(state, playerId);
}

/** 指定プレイヤー視点でのヒューリスティック盤面評価（手書きの重み）。 */
export function heuristicEvaluate(state: GameState, playerId: PlayerId): number {
  if (state.winner === playerId) return 100_000;
  if (state.winner === opponent(playerId)) return -100_000;

  const self = state.players[playerId];
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];

  let score = 0;

  score += enemy.damage * W.enemyDamage;
  score -= self.damage * W.selfDamage;
  score += enemy.damage * enemy.damage * W.enemyDamageSq;

  if (enemy.damage >= WIN_DAMAGE - 2) score += W.enemyNearWin2;
  if (enemy.damage >= WIN_DAMAGE - 1) score += W.enemyNearWin1;
  if (self.damage >= WIN_DAMAGE - 1) score -= W.selfNearLoss1;

  const damageLead = enemy.damage - self.damage;
  if (damageLead > 0) score += damageLead * W.leadAhead;
  if (damageLead < 0) score += damageLead * W.leadBehind;

  const selfField = fieldPower(state, playerId);
  const enemyField = fieldPower(state, enemyId);
  score += selfField / W.selfFieldDiv;
  score -= enemyField / W.enemyFieldDiv;

  score += self.battle.length * W.selfBattle;
  score -= enemy.battle.length * W.enemyBattle;
  score += self.rush.length * W.selfRush;
  score -= enemy.rush.length * W.enemyRush;

  score += self.power.length * W.selfPower;
  score -= enemy.power.length * W.enemyPower;
  score += self.command.length * W.selfCommand;
  const heldCommands = self.command.filter((c) => c.commandHeld).length;
  score += heldCommands * W.heldCommand;
  score += self.operation.length * W.selfOperation;

  score -= self.hand.length * W.selfHand;
  score += enemy.hand.length * W.enemyHand;

  const selfTotalStrike = totalStrikePotential(state, playerId);
  score += selfTotalStrike * W.selfTotalStrike;

  const selfStrike = maxSelfStrikePotential(state, playerId);
  score += selfStrike * W.selfMaxStrike;
  if (enemy.damage + selfStrike >= WIN_DAMAGE) {
    score += W.lethalMax;
  }
  if (enemy.damage + selfTotalStrike >= WIN_DAMAGE) {
    score += W.lethalTotal;
  }

  if (state.phase === "battle") {
    score += selfStrike * W.battleSelfStrike;
    if (state.activePlayer === playerId) {
      score += W.battleActive;
      if (enemy.damage + selfStrike >= WIN_DAMAGE) score += W.battleLethal;
      if (self.rush.length > 0) score -= self.rush.length * W.battleIdleRush;
    } else {
      score -= W.battleInactive;
    }
  }

  score += self.deck.length * W.selfDeck;
  score -= enemy.deck.length * W.enemyDeck;
  if (self.deck.length <= 5) score -= W.selfDeckLow5;
  if (self.deck.length <= 10) score -= W.selfDeckLow10;
  if (enemy.deck.length <= 8) score += W.enemyDeckLow8;

  const strikeThreat = maxEnemyStrikeThreat(state, playerId);
  score -= strikeThreat * W.enemyStrikeThreat;
  if (self.damage + strikeThreat >= WIN_DAMAGE) {
    score -= W.enemyLethalThreat;
  }

  score += (clockUpShields(state, playerId) - clockUpShields(state, enemyId)) * W.clockUpShield;

  if (state.phase === "rush") {
    score += heldCommands * W.rushHeldCommand;
    if (state.activePlayer === playerId) score += W.rushActive;
  }
  if (state.phase === "charge" && state.activePlayer === playerId) {
    score += W.chargeActive;
  }
  if (state.phase === "battle" && self.battle.length > enemy.battle.length) {
    score += (self.battle.length - enemy.battle.length) * W.battleWidth;
  }

  return score;
}
