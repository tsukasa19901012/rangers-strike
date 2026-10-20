/**
 * 第4弾タイムレンジャーの NC 効果（「SP1」に加えて発動する効果）。
 *
 * - RS-218 タイムレッド【アサルトベクター】: 相手は自分自身のパワーゾーンのダメージ以外のカードを見て、
 *   カテゴリの数が2つ以上あれば、1つになるまでダメージ以外のカードを捨札にする（どれを捨札にするかは相手が選ぶ）。
 * - RS-219 タイムブルー【スピニングスラッシュ】: 敵軍Sユニットの数が自軍Sユニットの数より4体以上多いとき、
 *   次の効果を発動できる⇒自軍Sユニットと同じ数になるまで、敵軍Sユニットを選び撃破する。
 *   先に撃破する対象をすべて選んでから1体ずつ撃破し、途中で止められない（faq-card-4 RS-219 Q1・Q3）。
 */
import { getDefinition, unitSizeOf } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import type { GameState, PlayerId } from "../types/game";

export const ASSAULT_VECTOR_EFFECT_ID = "asarutobekuta";
export const SPINNING_SLASH_EFFECT_ID = "supiningusurashu";

function faceUpPowerCategoryCount(state: GameState, playerId: PlayerId): number {
  const categories = new Set<string>();
  for (const c of state.players[playerId].power) {
    if (c.faceDown) continue;
    const category = getDefinition(state.definitions, c.cardId)?.category;
    if (category) categories.add(String(category));
  }
  return categories.size;
}

function openAssaultVectorChoice(
  state: GameState,
  enemyId: PlayerId,
  phasePlayerId: PlayerId,
  sourceInstanceId?: string,
): GameState {
  if (faceUpPowerCategoryCount(state, enemyId) < 2) return state;
  const valid = state.players[enemyId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  return {
    ...state,
    pendingEffectChoice: {
      playerId: enemyId,
      effectId: ASSAULT_VECTOR_EFFECT_ID,
      sourceCardId: "RS-218",
      sourceInstanceId,
      kind: "select_power",
      phasePlayerId,
      validInstanceIds: valid,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
    },
    activePlayer: enemyId,
  };
}

/** RS-218【アサルトベクター】を開始する（NC 成立時）。 */
export function startAssaultVector(state: GameState, playerId: PlayerId, sourceInstanceId: string): GameState {
  if (state.pendingEffectChoice) return state;
  return openAssaultVectorChoice(state, opponent(playerId), playerId, sourceInstanceId);
}

/**
 * 相手が選んだダメージ以外のパワーを1枚捨札にし、まだ2カテゴリ以上なら続けて選ばせる（done: false）。
 * 1カテゴリになったら done: true（選択は呼び出し側で閉じる）。
 */
export function resolveAssaultVectorPick(
  state: GameState,
  instanceId: string,
): { state: GameState; done: boolean } | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== ASSAULT_VECTOR_EFFECT_ID) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return null;
  const player = state.players[pending.playerId];
  const found = findInZone(player, "power", instanceId);
  if (!found || found.card.faceDown) return null;
  const [, power] = removeAt(player.power, found.index);
  const next: GameState = {
    ...state,
    ...updatePlayer(state, pending.playerId, {
      ...player,
      power,
      discard: [...player.discard, found.card],
    }),
  };
  if (faceUpPowerCategoryCount(next, pending.playerId) < 2) return { state: next, done: true };
  return {
    state: openAssaultVectorChoice(next, pending.playerId, pending.phasePlayerId, pending.sourceInstanceId),
    done: false,
  };
}

function countFieldS(state: GameState, playerId: PlayerId): number {
  const p = state.players[playerId];
  return [...p.rush, ...p.battle].filter((c) => unitSizeOf(state.definitions, c) === "S").length;
}

/** RS-219【スピニングスラッシュ】: 条件を満たせば、撃破する敵軍 S ユニットの選択（任意）を開く。 */
export function startSpinningSlash(state: GameState, playerId: PlayerId, sourceInstanceId: string): GameState {
  if (state.pendingEffectChoice) return state;
  const enemyId = opponent(playerId);
  const own = countFieldS(state, playerId);
  const enemy = countFieldS(state, enemyId);
  if (enemy - own < 4) return state;
  const enemyPlayer = state.players[enemyId];
  const valid = [...enemyPlayer.battle, ...enemyPlayer.rush]
    .filter((c) => unitSizeOf(state.definitions, c) === "S")
    .map((c) => c.instanceId);
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: SPINNING_SLASH_EFFECT_ID,
      sourceCardId: "RS-219",
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectedInstanceIds: [],
      selectCount: enemy - own,
      unitDestination: "discard",
      // 「発動できる」— 最初の対象を選ぶまでは発動しないことを選べる。選び始めたら止められない（Q3）。
      optional: true,
    },
    activePlayer: playerId,
  };
}
