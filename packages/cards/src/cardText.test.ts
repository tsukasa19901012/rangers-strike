import { describe, expect, it } from "vitest";
import { applyRecommendedReplacementText } from "./cardText";

describe("applyRecommendedReplacementText", () => {
  it("keeps only text after 修正後は以下 for RK-043", () => {
    const raw =
      "※このカードはデッキに好きな枚数入れてもよい。 【突入】…ユニットの必要パワー… ・このテキストは公式ＨＰで読み替えが推奨されています。修正後は以下。 ※このカードはデッキに好きな枚数入れてもよい。 【突入】…ユニットカードの必要パワー…";
    expect(applyRecommendedReplacementText(raw)).toBe(
      "※このカードはデッキに好きな枚数入れてもよい。 【突入】…ユニットカードの必要パワー…",
    );
  });

  it("returns original text when no marker is present", () => {
    expect(applyRecommendedReplacementText("【一本釣り】テスト")).toBe("【一本釣り】テスト");
  });
});
