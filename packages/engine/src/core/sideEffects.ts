/**
 * エンジンの「状態の外に残る」処理の通し番号（乱数を引く・applyAction に入る・インスタンス ID やイベント ID を振る等）。
 *
 * 合法手の一覧（core/legalActions.ts getLegalActions）は、こうした処理を一度も行わなければゲーム状態だけで決まるので、
 * 同じ状態のオブジェクトに対する2回目以降の呼び出しで結果を使い回せる。この番号が計算の前後で変わらなければ、そうだとわかる。
 */
let sideEffects = 0;

/** 状態の外に残る処理を行ったことを記録する。 */
export function noteEngineSideEffect(): void {
  sideEffects += 1;
}

/** これまでに記録した処理の数（前後で比べるだけに使う）。 */
export function engineSideEffectCount(): number {
  return sideEffects;
}
