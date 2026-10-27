import { describe, expect, it } from "vitest";
import type { EngineApi } from "../engineApi";
import { cardTextEffects, effectExcerpt } from "./board";

const XG3_046 =
  "※チェイス ※敵軍ターン中、これが撃破されて捨札になったとき、これを自軍パワーゾーンにダメージにして置いてもよい。そうしたとき、自分の手札から「仮面ライダーBLACK RX」のカードを1枚選び、自軍ラッシュエリアに出す。 【キングストーンフラッシュ】自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。";

const engine = (labels: Record<string, string> = {}) => ({ getEffectLabel: (id: string) => labels[id] ?? id }) as unknown as EngineApi;

describe("effect text of a pending choice", () => {
  it("splits card text into its effects, without a lone keyword", () => {
    const parts = cardTextEffects(XG3_046);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^※敵軍ターン中/);
    expect(parts[1]).toMatch(/^【キングストーンフラッシュ】/);
  });

  it("picks the optional effect a confirm asks about (XG3-046)", () => {
    expect(effectExcerpt(engine(), XG3_046, "xg3046_black_damage", true)).toMatch(/^※敵軍ターン中.*ラッシュエリアに出す。$/);
  });

  it("picks a named effect by its label", () => {
    expect(effectExcerpt(engine({ xg3046_kingstone: "キングストーンフラッシュ" }), XG3_046, "xg3046_kingstone")).toMatch(/^【キングストーンフラッシュ】/);
  });

  it("picks by the words of the effect id", () => {
    expect(effectExcerpt(engine(), XG3_046, "xg3046_draw")).toMatch(/^【キングストーンフラッシュ】/);
  });

  it("shows every effect when it can't tell which one", () => {
    expect(effectExcerpt(engine(), XG3_046, "xg3046_unknown")).toBe(cardTextEffects(XG3_046).join("\n"));
  });

  it("shows a one-effect card's text as it is", () => {
    expect(effectExcerpt(engine(), "自分は1枚ドローする。", "x")).toBe("自分は1枚ドローする。");
    expect(effectExcerpt(engine(), undefined, "x")).toBeUndefined();
  });
});
