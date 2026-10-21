import { describe, expect, it } from "vitest";
import { createValueNet, type ValueNetWeights } from "./valueNet";
import { FEATURE_DIM, FEATURE_NAMES, FEATURE_VERSION, encodeState } from "./valueFeatures";
import { evaluateState, heuristicEvaluate, setValueEvaluator } from "./scoring";
import { deckCards, inst, st } from "../cardSpec/RK1-001-021.helpers";

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
});
