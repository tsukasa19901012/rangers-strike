import { describe, expect, it } from "vitest";
import { cardSearchText, foldSearchText, matchesTerms, searchTerms } from "./cardSearch";
import type { CardDefinition } from "../engineApi";

describe("card search text", () => {
  it("folds width, case and katakana / hiragana", () => {
    expect(foldSearchText("ﾚｯﾄﾞ")).toBe(foldSearchText("れっど"));
    expect(foldSearchText("レッド")).toBe("れっど");
    expect(foldSearchText("ＸＧ３")).toBe("xg3");
  });

  it("matches every space-separated word against number, name, features and text", () => {
    const card = { id: "XG3-012", name: "ゴーカイレッド", features: ["レッド", "男"], text: "【登場時】カードを1枚引く。" } as unknown as CardDefinition;
    const haystack = cardSearchText(card);
    expect(matchesTerms(haystack, searchTerms("xg3"))).toBe(true);
    expect(matchesTerms(haystack, searchTerms("ごーかい　登場時"))).toBe(true);
    expect(matchesTerms(haystack, searchTerms("男 1枚"))).toBe(true);
    expect(matchesTerms(haystack, searchTerms("ゴーカイ ブルー"))).toBe(false);
    expect(searchTerms("  ")).toEqual([]);
  });
});
