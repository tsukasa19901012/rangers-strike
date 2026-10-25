// 学習した価値ネットワーク（scripts/nn/train.py が書いた JSON）で盤面を評価する（ロードマップ Phase 3〜4）。
// 外部ライブラリは使わず、全結合層の掛け算だけを行う（Vita でも動かすため）。
import type { GameState, PlayerId } from "../types/game";
import { FEATURE_DIM, FEATURE_VERSION, encodeState } from "./valueFeatures";

export type ValueNetWeights = {
  featureVersion: number;
  mean: number[];
  std: number[];
  /**
   * w は [出力][入力]。最後の層以外は ReLU を通す。
   * 同梱用に詰めたもの（scripts/nn/pack.py）は、w が float16（リトルエンディアン）を base64 にした文字列で、out・inp に形を持つ。
   */
  layers: ({ w: number[][]; b: number[] } | { out: number; inp: number; w: string; b: number[] })[];
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
  const layers = weights.layers.map((l) =>
    typeof l.w === "string"
      ? { out: l.b.length, inp: (l as { inp: number }).inp, w: decodeFloat16(l.w), b: Float32Array.from(l.b) }
      : { out: l.b.length, inp: l.w[0]!.length, w: Float32Array.from(l.w.flat()), b: Float32Array.from(l.b) },
  );

  const logitFromFeatures = (features: Float32Array): number => {
    let x = Float32Array.from(features);
    for (let i = 0; i < x.length; i++) x[i] = (x[i]! - mean[i]!) * invStd[i]!;
    const nonZero = new Int32Array(Math.max(FEATURE_DIM, ...layers.map((l) => l.inp)));
    for (let li = 0; li < layers.length; li++) {
      const { out, inp, w, b } = layers[li]!;
      // 0 の入力（ReLU で 0 になった中間の値が多い）は足しても変わらないので飛ばす（足す順は同じなので結果も同じ）。
      let n = 0;
      for (let i = 0; i < inp; i++) if (x[i] !== 0) nonZero[n++] = i;
      const y = new Float32Array(out);
      for (let o = 0; o < out; o++) {
        let s = b[o]!;
        const row = o * inp;
        for (let k = 0; k < n; k++) {
          const i = nonZero[k]!;
          s += w[row + i]! * x[i]!;
        }
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

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** base64 の float16 列を Float32Array にする（atob の無い実行環境でも動くよう自前で読む）。 */
function decodeFloat16(text: string): Float32Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < BASE64.length; i++) lookup[BASE64.charCodeAt(i)] = i;
  const clean = text.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (lookup[clean.charCodeAt(i)]! << 18) | (lookup[clean.charCodeAt(i + 1)]! << 12) | (lookup[clean.charCodeAt(i + 2) || 65]! << 6) | lookup[clean.charCodeAt(i + 3) || 65]!;
    if (o < bytes.length) bytes[o++] = n >> 16;
    if (o < bytes.length) bytes[o++] = (n >> 8) & 255;
    if (o < bytes.length) bytes[o++] = n & 255;
  }
  const out = new Float32Array(bytes.length >> 1);
  for (let i = 0; i < out.length; i++) {
    const h = bytes[2 * i]! | (bytes[2 * i + 1]! << 8);
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    out[i] = exp === 0 ? sign * frac * 2 ** -24 : exp === 31 ? (frac ? NaN : sign * Infinity) : sign * (1 + frac / 1024) * 2 ** (exp - 15);
  }
  return out;
}
