import { describe, expect, it } from "vitest";
import { ellipsize, fitLine, fitLineKeepTail, isWide, measureText, wrapText } from "./wrap";

const opts = (cols: number) => ({ fontPx: 10, maxWidthPx: cols * 10 });

describe("wrapText", () => {
  it("measures full-width as one em and ASCII narrower", () => {
    expect(isWide("あ")).toBe(true);
    expect(isWide("A")).toBe(false);
    expect(measureText("あい", 10)).toBe(20);
    expect(measureText("AB", 10)).toBeCloseTo(12.4);
  });

  it("breaks Japanese text at any character to fit the width", () => {
    const lines = wrapText("あいうえおかきくけこ", opts(4));
    expect(lines).toEqual(["あいうえ", "おかきく", "けこ"]);
    for (const line of lines) expect(measureText(line, 10)).toBeLessThanOrEqual(40);
  });

  it("does not start a line with 。 or 、 (kinsoku)", () => {
    const lines = wrapText("あいうえ。かき", opts(4));
    expect(lines[1]!.startsWith("。")).toBe(false);
    expect(lines.join("")).toBe("あいうえ。かき");
  });

  it("does not end a line with an opening bracket", () => {
    const lines = wrapText("あいう「えお」", opts(4));
    for (const line of lines) expect(line.endsWith("「")).toBe(false);
    expect(lines.join("")).toBe("あいう「えお」");
  });

  it("keeps ASCII words together and honours explicit newlines", () => {
    const lines = wrapText("BP3000のユニット\n次の行", opts(6));
    expect(lines[0]).toContain("BP3000");
    expect(lines).toContain("次の行");
  });

  it("caps lines with an ellipsis", () => {
    const lines = wrapText("あいうえおかきくけこさしすせそ", { ...opts(4), maxLines: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
  });

  it("fitLine leaves short lines and ellipsizes long ones", () => {
    expect(fitLine("あい", opts(4))).toBe("あい");
    expect(fitLine("あいうえお", opts(4))).toBe(ellipsize("あいうえお", opts(4)));
    expect(measureText(fitLine("あいうえお", opts(4)), 10)).toBeLessThanOrEqual(40);
  });
});

describe("fitLineKeepTail", () => {
  it("keeps a trailing place in brackets and cuts the text before it", () => {
    const opts = { fontPx: 10, maxWidthPx: 160 };
    const a = fitLineKeepTail("ジャッジメント / Test Striker（種類:カテゴリ）（敵ラッシュ1）", opts);
    const b = fitLineKeepTail("ジャッジメント / Test Striker（種類:カテゴリ）（敵ラッシュ2）", opts);
    expect(a.endsWith("…（敵ラッシュ1）")).toBe(true);
    expect(a).not.toBe(b);
    expect(measureText(a, 10)).toBeLessThanOrEqual(160);
  });

  it("returns a line that fits unchanged", () => {
    expect(fitLineKeepTail("短い（自1）", { fontPx: 10, maxWidthPx: 400 })).toBe("短い（自1）");
  });
});
