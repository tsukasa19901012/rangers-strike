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
import { engineSideEffectCount } from "./sideEffects";

export type SearchCache = {
  /** core/legalActions.ts getLegalActions の結果。 */
  legalActions: WeakMap<GameState, readonly GameAction[]>;
  /** core/applyAction.ts applyAction の結果（アクションの JSON ごと）・CPU の読みの結果（ai/）。 */
  memo: WeakMap<GameState, Map<string, unknown>>;
  /**
   * カードごとの数値（core/catalog.ts effectiveBp・rules/legend3/fieldEffects.ts legend3EffectiveSp）の結果。
   * 状態ごと・種類とプレイヤーごと・カードのインスタンスのオブジェクトごと。
   */
  perCard: WeakMap<GameState, Map<string, Map<object, number>>>;
  /**
   * rules/resist.ts clearRegisterHoldOffField で、エリアで得た付加情報が残っていないと確かめたゾーンの配列と、そのゾーンの名前
   * （探索の間は配列を書き換えないので、同じ配列は調べ直さない）。
   */
  cleanZones: WeakMap<object, string>;
  /**
   * applyAction / getLegalActions の入口の状態（rules/zordFeatureContext.ts actionContextState）も読む判定の結果。
   * 状態ごと・入口の状態ごと（無ければ noContext）・対象のオブジェクトごと・key ごと。
   */
  withContext: WeakMap<GameState, ContextMemo>;
};

type ContextMemo = {
  noContext: WeakMap<object, Map<string, unknown>>;
  byContext: WeakMap<object, WeakMap<object, Map<string, unknown>>>;
};

let active: SearchCache | null = null;

/** fn の間、状態ごとの計算結果を使い回す（入れ子の呼び出しは外側の表を使う）。fn の間は状態を書き換えないこと。 */
export function withSearchCache<T>(fn: () => T): T {
  if (active) return fn();
  active = { legalActions: new WeakMap(), memo: new WeakMap(), perCard: new WeakMap(), cleanZones: new WeakMap(), withContext: new WeakMap() };
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

/**
 * 探索の間は、状態・プレイヤー・カードのインスタンスで決まる数値 compute（BP・SP 等。kind で区別する）を使い回す
 * （探索の外では毎回計算する）。計算の中で状態の外に残る処理をしたときは覚えない（core/sideEffects.ts）。
 */
export function memoizePerCardInSearch(
  state: GameState,
  kind: string,
  playerId: string,
  instance: object,
  compute: () => number,
): number {
  const cache = active?.perCard;
  if (!cache) return compute();
  let perState = cache.get(state);
  if (!perState) {
    perState = new Map();
    cache.set(state, perState);
  }
  const mapKey = kind + playerId;
  let byInstance = perState.get(mapKey);
  if (!byInstance) {
    byInstance = new Map();
    perState.set(mapKey, byInstance);
  }
  const hit = byInstance.get(instance);
  if (hit !== undefined) return hit;
  const sideEffectsBefore = engineSideEffectCount();
  const value = compute();
  if (engineSideEffectCount() === sideEffectsBefore) byInstance.set(instance, value);
  return value;
}

/**
 * 探索の間は、状態・入口の状態（context。rules/zordFeatureContext.ts actionContextState の値）・対象のオブジェクト subject・key で
 * 決まる計算 compute の結果を使い回す（探索の外では毎回計算する）。計算の中で状態の外に残る処理をしたときは覚えない。
 * 結果をそのまま返すので、呼び出し側で書き換えない値（真偽値・数値・使うたびに写す値）に限る。
 */
export function memoizeInSearchWithContext<T>(
  state: GameState,
  context: object | null,
  subject: object,
  key: string,
  compute: () => T,
): T {
  const cache = active?.withContext;
  if (!cache) return compute();
  let perState = cache.get(state);
  if (!perState) {
    perState = { noContext: new WeakMap(), byContext: new WeakMap() };
    cache.set(state, perState);
  }
  let perContext: WeakMap<object, Map<string, unknown>> | undefined;
  if (context === null) {
    perContext = perState.noContext;
  } else {
    perContext = perState.byContext.get(context);
    if (!perContext) {
      perContext = new WeakMap();
      perState.byContext.set(context, perContext);
    }
  }
  let byKey = perContext.get(subject);
  if (byKey?.has(key)) return byKey.get(key) as T;
  const sideEffectsBefore = engineSideEffectCount();
  const value = compute();
  if (engineSideEffectCount() === sideEffectsBefore) {
    if (!byKey) {
      byKey = new Map();
      perContext.set(subject, byKey);
    }
    byKey.set(key, value);
  }
  return value;
}
