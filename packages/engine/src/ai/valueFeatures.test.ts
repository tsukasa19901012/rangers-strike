import { describe, expect, it } from "vitest";
import { FEATURE_DIM, FEATURE_NAMES, encodeState } from "./valueFeatures";
import { deckCards, inst, powerCards, st } from "../cardSpec/RK1-001-021.helpers";

const board = (enemyHand: string[]) =>
  st({
    phase: "battle",
    player1: { battle: [inst("RS-508", "b1")], power: powerCards(3), hand: [inst("RS-506", "h1")], deck: deckCards(5) },
    player2: { hand: enemyHand.map((id, i) => inst(id, `eh${i}`)), deck: deckCards(5, "e") },
  });

describe("学習用の盤面の特徴（encodeState）", () => {
  it("列名と同じ数の値を出し、同じ盤面からは同じ値になる", () => {
    const s = board(["RS-506"]);
    const a = encodeState(s, "player1");
    expect(a.length).toBe(FEATURE_DIM);
    expect(FEATURE_NAMES.length).toBe(FEATURE_DIM);
    expect([...a].every(Number.isFinite)).toBe(true);
    expect([...encodeState(s, "player1")]).toEqual([...a]);
  });

  it("相手の手札は枚数だけで、中身は入らない", () => {
    expect([...encodeState(board(["RS-506"]), "player1")]).toEqual([...encodeState(board(["RS-508"]), "player1")]);
    expect([...encodeState(board(["RS-506", "RS-506"]), "player1")]).not.toEqual([...encodeState(board(["RS-506"]), "player1")]);
  });

  it("どちらのプレイヤーから見るかで、自分と相手の列が入れ替わる", () => {
    const s = board([]);
    const col = (name: string) => FEATURE_NAMES.indexOf(name);
    expect(encodeState(s, "player1")[col("self_battle")]).toBeGreaterThan(0);
    expect(encodeState(s, "player2")[col("enemy_battle")]).toBeGreaterThan(0);
    expect(encodeState(s, "player2")[col("self_battle")]).toBe(0);
  });
});
