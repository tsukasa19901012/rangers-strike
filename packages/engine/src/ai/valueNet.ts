// 学習した価値ネットワーク（scripts/nn/train.py が書いた JSON）で盤面を評価する（ロードマップ Phase 3〜4）。
// 外部ライブラリは使わず、全結合層の掛け算だけを行う（Vita でも動かすため）。
import type { GameState, PlayerId } from "../types/game";
import { FEATURE_DIM, FEATURE_VERSION, encodeState } from "./valueFeatures";

export type ValueNetWeights = {
  featureVersion: number;
  mean: number[];
  std: number[];
  /** w は [出力][入力]。最後の層以外は ReLU を通す。 */
  layers: { w: number[][]; b: number[] }[];
};

/** 勝つ確率の logit をこの倍率で手書き評価と同じくらいの幅にする（勝ち負けが決まった盤面の ±100000 よりは十分小さい）。 */
const LOGIT_SCALE = 5_000;

export type ValueNet = {
  /** `playerId` がこの盤面から勝つ確率。 */
  winProbability(state: GameState, playerId: PlayerId): number;
  /** evaluateState の代わりに使う値（勝ち負けが決まっていない盤面だけ）。 */
  evaluate(state: GameState, playerId: PlayerId): number;
  /** encodeState の出力から logit を出す（学習側との突き合わせ用）。 */
  logitFromFeatures(features: Float32Array): number;
};

export function createValueNet(weights: ValueNetWeights): ValueNet {
  if (weights.featureVersion !== FEATURE_VERSION) {
    throw new Error(`value net was trained on FEATURE_VERSION ${weights.featureVersion}, engine has ${FEATURE_VERSION}`);
  }
  if (weights.mean.length !== FEATURE_DIM) throw new Error(`value net expects ${weights.mean.length} features, engine has ${FEATURE_DIM}`);
  const mean = Float32Array.from(weights.mean);
  const invStd = Float32Array.from(weights.std, (s) => 1 / s);
  const layers = weights.layers.map((l) => ({ out: l.b.length, inp: l.w[0]!.length, w: Float32Array.from(l.w.flat()), b: Float32Array.from(l.b) }));

  const logitFromFeatures = (features: Float32Array): number => {
    let x = Float32Array.from(features);
    for (let i = 0; i < x.length; i++) x[i] = (x[i]! - mean[i]!) * invStd[i]!;
    for (let li = 0; li < layers.length; li++) {
      const { out, inp, w, b } = layers[li]!;
      const y = new Float32Array(out);
      for (let o = 0; o < out; o++) {
        let s = b[o]!;
        const row = o * inp;
        for (let i = 0; i < inp; i++) s += w[row + i]! * x[i]!;
        y[o] = li < layers.length - 1 && s < 0 ? 0 : s;
      }
      x = y;
    }
    return x[0]!;
  };
  const logit = (state: GameState, playerId: PlayerId) => logitFromFeatures(encodeState(state, playerId));

  return {
    winProbability: (state, playerId) => 1 / (1 + Math.exp(-logit(state, playerId))),
    evaluate: (state, playerId) => logit(state, playerId) * LOGIT_SCALE,
    logitFromFeatures,
  };
}
