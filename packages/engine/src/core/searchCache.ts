/**
 * CPU の探索の間だけ有効な、状態のオブジェクトごとの計算結果の表（ai/index.ts pickCpuAction の中）。
 *
 * CPU の探索は同じ状態のオブジェクトに対して合法手の一覧を何度も調べ、同じアクションを何度も適用する（候補の評価と、
 * 相手の応手の読みの中で選んだ手をもう一度適用する等）。探索の間は状態を書き換えない（エンジンは状態を作り直して返す）
 * ので、結果を使い回せる。探索の外では、状態を書き換えてから調べ直す呼び出し方（テストの状態の組み立て等）があるので
 * 覚えない。抜けたら表ごと捨てる。
 */
import type { GameAction } from "../types/actions";
import type { GameState } from "../types/game";

export type SearchCache = {
  /** core/legalActions.ts getLegalActions の結果。 */
  legalActions: WeakMap<GameState, readonly GameAction[]>;
  /** core/applyAction.ts applyAction の結果（アクションの JSON ごと）・CPU の読みの結果（ai/）。 */
  memo: WeakMap<GameState, Map<string, unknown>>;
  /** core/catalog.ts effectiveBp の結果（状態ごと・プレイヤーごと・カードのインスタンスのオブジェクトごと）。 */
  bp: WeakMap<GameState, { player1: Map<object, number>; player2: Map<object, number> }>;
};

let active: SearchCache | null = null;

/** fn の間、状態ごとの計算結果を使い回す（入れ子の呼び出しは外側の表を使う）。fn の間は状態を書き換えないこと。 */
export function withSearchCache<T>(fn: () => T): T {
  if (active) return fn();
  active = { legalActions: new WeakMap(), memo: new WeakMap(), bp: new WeakMap() };
  try {
    return fn();
  } finally {
    active = null;
  }
}

/** いま有効な表（探索の外では null）。 */
export function activeSearchCache(): SearchCache | null {
  return active;
}

/**
 * 探索の間は、状態と key で決まる計算 compute の結果を使い回す（探索の外では毎回計算する）。
 * compute は状態と key に含めた引数だけで結果が決まるものに限る。
 */
export function memoizeInSearch<T>(state: GameState, key: string, compute: () => T): T {
  const cache = active?.memo;
  if (!cache) return compute();
  let byKey = cache.get(state);
  if (byKey?.has(key)) return byKey.get(key) as T;
  const value = compute();
  if (!byKey) {
    byKey = new Map();
    cache.set(state, byKey);
  }
  byKey.set(key, value);
  return value;
}
