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

  it("keeps leading notes outside the corrected block (RS-227)", () => {
    const raw =
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【トップウインド】…の数まで選びホールドする。 ・このテキストは公式ＨＰで読み替えが推奨されています。修正後は以下。 【トップウインド】…の数まで可能な限り選びホールドする。";
    expect(applyRecommendedReplacementText(raw)).toBe(
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【トップウインド】…の数まで可能な限り選びホールドする。",
    );
  });

  it("keeps leading notes for errata from complete book (RK-231)", () => {
    const raw =
      "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【潜水】自分がターンを終えるとき、これをリリースするか、ホールドしてもよい。 ・このテキストはクロスギャザーコンプリートブックでエラッタが示されています。修正後は以下。 【潜水】自分がターンを終えるとき、このユニットをリリースするか、ホールドしてもよい。";
    expect(applyRecommendedReplacementText(raw)).toBe(
      "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【潜水】自分がターンを終えるとき、このユニットをリリースするか、ホールドしてもよい。",
    );
  });
});
