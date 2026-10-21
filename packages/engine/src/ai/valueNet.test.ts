import { describe, expect, it } from "vitest";
import { createValueNet, type ValueNetWeights } from "./valueNet";
import { FEATURE_DIM, FEATURE_NAMES, FEATURE_VERSION, encodeState } from "./valueFeatures";
import { evaluateState, heuristicEvaluate, setValueEvaluator } from "./scoring";
import { deckCards, inst, st } from "../cardSpec/RK1-001-021.helpers";
import { VALUE_NET_V1 } from "./weights/valueNetV1";
import { getCpuLevelConfig } from "./types";
import { pickCpuAction } from "./index";

/** 隠れ層 1 つ（2 ユニット）の小さなネット。self_battle の列だけを見る。 */
function tinyNet(): ValueNetWeights {
  const col = FEATURE_NAMES.indexOf("self_battle");
  const row = (v: number) => Array.from({ length: FEATURE_DIM }, (_, i) => (i === col ? v : 0));
  return {
    featureVersion: FEATURE_VERSION,
    mean: new Array(FEATURE_DIM).fill(0),
    std: new Array(FEATURE_DIM).fill(1),
    layers: [
      { w: [row(7), row(-7)], b: [0, 0] },
      { w: [[1, -1]], b: [-0.5] },
    ],
  };
}

const board = (battle: number) =>
  st({
    phase: "battle",
    player1: { battle: Array.from({ length: battle }, (_, i) => inst("RS-508", `b${i}`)), deck: deckCards(5) },
    player2: { deck: deckCards(5, "e") },
  });

describe("価値ネットワーク（valueNet）", () => {
  it("全結合層と ReLU を手計算どおりに通す", () => {
    const net = createValueNet(tinyNet());
    const s = board(1);
    // self_battle = 1/7 → 隠れ層 [1, 0] → 1 - 0 - 0.5 = 0.5
    expect(encodeState(s, "player1")[FEATURE_NAMES.indexOf("self_battle")]).toBeCloseTo(1 / 7);
    expect(net.logitFromFeatures(encodeState(s, "player1"))).toBeCloseTo(0.5, 5);
    expect(net.winProbability(s, "player1")).toBeCloseTo(1 / (1 + Math.exp(-0.5)), 5);
  });

  it("特徴の版が違う重みは読まない", () => {
    expect(() => createValueNet({ ...tinyNet(), featureVersion: FEATURE_VERSION + 1 })).toThrow();
  });

  it("setValueEvaluator で evaluateState が差し替わり、外すと手書きに戻る", () => {
    const s = board(2);
    const net = createValueNet(tinyNet());
    setValueEvaluator(net.evaluate);
    try {
      expect(evaluateState(s, "player1")).toBeCloseTo(net.evaluate(s, "player1"));
    } finally {
      setValueEvaluator(null);
    }
    expect(evaluateState(s, "player1")).toBe(heuristicEvaluate(s, "player1"));
  });

  it("同梱用に詰めた重み（float16 の base64）を読み、元の重みと同じ値を出す", () => {
    const base = tinyNet();
    // [[1, -1]] を float16 にすると 00 3C 00 BC。
    const packed: ValueNetWeights = { ...base, layers: [base.layers[0]!, { out: 1, inp: 2, w: "ADwAvA==", b: [-0.5] }] };
    const s = board(1);
    expect(createValueNet(packed).logitFromFeatures(encodeState(s, "player1"))).toBeCloseTo(0.5, 5);
  });

  it("同梱の重みは今の特徴の版で読め、Lv5 だけが使う", () => {
    const net = createValueNet(VALUE_NET_V1);
    expect(Number.isFinite(net.evaluate(board(2), "player1"))).toBe(true);
    expect(getCpuLevelConfig(5).valueNetBlend).toBeGreaterThan(0);
    expect(getCpuLevelConfig(4).valueNetBlend ?? 0).toBe(0);
    // 指し終わったら評価の差し替えは残さない。
    pickCpuAction(board(2), "player1", 5);
    expect(evaluateState(board(2), "player1")).toBe(heuristicEvaluate(board(2), "player1"));
  });
});
