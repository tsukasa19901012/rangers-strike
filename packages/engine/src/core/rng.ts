/**
 * エンジン内の乱数（山札のシャッフル・無作為な選択）。
 *
 * 乱数の状態はゲーム状態（GameState.rngState）に持たせる。applyAction / getLegalActions の間だけ
 * その状態から乱数列を作り、applyAction の結果に進めた状態を書き戻す。同じ状態に同じアクションを
 * 適用すれば必ず同じ結果になる（Math.random・時刻・ワーカーごとの状態に依存しない）。
 */
import type { GameState } from "../types/game";
import { noteEngineSideEffect } from "./sideEffects";

/** rngState を持たない状態（手で組み立てたテスト状態など）に使う既定の種。 */
export const DEFAULT_RNG_SEED = 0x2f6b_1d3c;

type RngContext = { s: number; used: boolean };

let active: RngContext | null = null;

/** mulberry32 の 1 ステップ。 */
function step(ctx: RngContext): number {
  noteEngineSideEffect();
  ctx.used = true;
  ctx.s = (ctx.s + 0x6d2b79f5) >>> 0;
  let t = ctx.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * [0, 1) の乱数。エンジンの入口（applyAction / getLegalActions）の中では状態の乱数列から取る。
 * 入口の外から直接呼ばれたときは既定の種から作る（呼び出しごとに同じ列になり、決定的）。
 */
export function engineRandom(): number {
  if (active) return step(active);
  return step({ s: DEFAULT_RNG_SEED, used: false });
}

/** 0 以上 n 未満の整数。 */
export function engineRandomInt(n: number): number {
  return Math.floor(engineRandom() * n);
}

/** 種から作る乱数の関数（mulberry32。エンジンの外の準備＝デッキのシャッフル等に使う）。 */
export function rngFromSeed(seed: number): () => number {
  const ctx: RngContext = { s: seed >>> 0, used: false };
  return () => step(ctx);
}

/** 乱数の関数から 32bit の種を作る（createGame の rng オプション用）。 */
export function seedFromRng(rng: () => number): number {
  return Math.floor(rng() * 4294967296) >>> 0;
}

/** すでに入口の中にいるか。 */
export function hasActiveEngineRng(): boolean {
  return active !== null;
}

/**
 * state の乱数で fn を実行する。入れ子の呼び出しは外側の乱数列を共有する。
 * 戻り値の rngState: fn の間に進めた乱数の状態（外側の呼び出しのときだけ）。
 */
export function runWithStateRng<T>(
  state: Pick<GameState, "rngState">,
  fn: () => T,
): { value: T; rngState: number | undefined } {
  if (active) return { value: fn(), rngState: undefined };
  const ctx: RngContext = { s: (state.rngState ?? DEFAULT_RNG_SEED) >>> 0, used: false };
  active = ctx;
  try {
    const value = fn();
    const changed = ctx.used || state.rngState !== undefined;
    return { value, rngState: changed ? ctx.s : undefined };
  } finally {
    active = null;
  }
}
