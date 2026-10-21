import { describe, expect, it } from "vitest";
import { cardFieldLines, effectParagraphs } from "./cardFields";

describe("effectParagraphs", () => {
  it("starts each ※ and 【】 effect on its own line", () => {
    expect(effectParagraphs("合体―A＋B ※変更される⇒合体―A 【激激臨臨斬】自軍ターン中")).toBe("合体―A＋B\n※変更される⇒合体―A\n【激激臨臨斬】自軍ターン中");
    expect(effectParagraphs("パトシグナー【ジャスティス】これ")).toBe("パトシグナー\n【ジャスティス】これ");
  });

  it("keeps granted and quoted effects inside their sentence", () => {
    expect(effectParagraphs("能力を得る⇒※レジスト（説明）")).toBe("能力を得る⇒※レジスト（説明）");
    expect(effectParagraphs("「【ジュウオウ】」を持つ")).toBe("「【ジュウオウ】」を持つ");
  });
});

describe("cardFieldLines", () => {
  it("lists a unit's attributes as the wiki does", () => {
    const def = { id: "X-1", name: "X", type: "unit", category: ["WB", "DA"], bp: 4000, sp: "1/2", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男"] } as never;
    expect(cardFieldLines(def)).toEqual(["カテゴリ：ワイルドビースト/ダークアライアンス", "BP：4000", "SP：1/2", "必要パワー：4", "追加条件：なし", "CN：RC", "特徴：仮面ライダー/男"]);
  });
});
