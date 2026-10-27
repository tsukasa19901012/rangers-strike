import type { GameState } from "../types/game";
import { engineSideEffectCount } from "./sideEffects";

/**
 * 1回の合法手の列挙の中で同じ引数で何度も呼ぶ判定の結果を、列挙の間だけ覚える（計算に乱数等を使ったときは覚えない）。
 * - canBeginZordSetup（追加条件の手順を最後まで試す重い判定）: 手札のゾードをラッシュの支払いとゾードの手順の両方から調べる。
 *   素材の組み合わせごとの支払い（isInitiateCommandPaymentLegal）でも毎回呼ぶので、RS-353 のように組み合わせが
 *   多いカードでは列挙が組み合わせの数の 2 乗で重くなっていた（11 体から 5 体で約 2 分）。
 * - canDeclareRush: 手札のユニットをラッシュとラッシュのカテゴリ支払いの両方から調べる。
 */
let enumerationMemo: { state: GameState; results: Map<string, boolean> } | null = null;

export function memoizeInEnumeration(state: GameState, key: string, compute: () => boolean): boolean {
  const memo = enumerationMemo;
  if (!memo || memo.state !== state) return compute();
  const hit = memo.results.get(key);
  if (hit !== undefined) return hit;
  const sideEffectsBefore = engineSideEffectCount();
  const result = compute();
  if (engineSideEffectCount() === sideEffectsBefore) memo.results.set(key, result);
  return result;
}

/** state の合法手の列挙の間だけ memoizeInEnumeration を効かせる。 */
export function withEnumerationMemo<T>(state: GameState, run: () => T): T {
  const previous = enumerationMemo;
  enumerationMemo = { state, results: new Map() };
  try {
    return run();
  } finally {
    enumerationMemo = previous;
  }
}
