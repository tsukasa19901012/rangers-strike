import { describe, expect, it } from "vitest";
import { getCardById } from "../index";
import { parseAtwikiRarities, rarityFromAtwikiLabel, resolveCatalogRarity } from "./atwikiRarity";

describe("atwiki のレアリティ表記", () => {
  it("表記をカタログのレアリティに変換する（ノーマルレアはノーマルより先に照合）", () => {
    expect(rarityFromAtwikiLabel("ノーマル")).toBe("N");
    expect(rarityFromAtwikiLabel("ノーマルレア")).toBe("NR");
    expect(rarityFromAtwikiLabel("レア　（轟の翼スターター版はノーマル）")).toBe("R");
    expect(rarityFromAtwikiLabel("スーパーレア ")).toBe("SR");
    expect(rarityFromAtwikiLabel("シークレットレア")).toBe("SC");
    expect(rarityFromAtwikiLabel("メモリアルレア　（スターター版はノーマル）")).toBe("MR");
    expect(rarityFromAtwikiLabel("プロモーションカード（スーパーレア仕様）")).toBe("PR");
  });

  it("ページ内の複数の版を順に読み、現在の値が版のどれかならそのまま", () => {
    const md = "レアリティ：スーパーレア\n…\nレアリティ：シークレットレア\n";
    expect(parseAtwikiRarities(md)).toEqual(["SR", "SC"]);
    expect(resolveCatalogRarity("SC", ["SR", "SC"])).toBe("SC");
    expect(resolveCatalogRarity("N", ["SR", "SC"])).toBe("SR");
    expect(resolveCatalogRarity("N", [])).toBe("N");
  });

  it("カタログのレアリティが atwiki と一致する（既定値 N で埋められていた例）", () => {
    expect(getCardById("RS-180")?.rarity).toBe("R");
    expect(getCardById("RS-194")?.rarity).toBe("R");
    expect(getCardById("RS-527")?.rarity).toBe("NR");
    expect(getCardById("SR-001")?.rarity).toBe("SC");
  });
});
