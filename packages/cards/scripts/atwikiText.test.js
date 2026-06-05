import { describe, expect, it } from "vitest";
import { extractEffectTextFromAtwikiHtml } from "./atwikiText.js";

const SAMPLE = `
<div id="wikibody" class="box">
<h3>テキスト：</h3>
<div>このターン、すべての自軍Sユニットは次の能力を得る。⇒アタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。</div>
</div>`;

describe("extractEffectTextFromAtwikiHtml", () => {
  it("extracts named effect text", () => {
    expect(extractEffectTextFromAtwikiHtml(SAMPLE)).toContain("本来の値としてバトルする");
  });

  it("returns empty for なし", () => {
    const html = `<div id="wikibody"><h3>テキスト：</h3><div>なし</div></div>`;
    expect(extractEffectTextFromAtwikiHtml(html)).toBe("");
  });

  it("prefers errata text", () => {
    const html = `
<div id="wikibody">
修正後は以下。
<div>【超シールド進化】「ワイルドビースト」の自軍ユニットが撃破されるとき、このユニットをかわりに捨札にしてもよい。</div>
<h3>フレーバーテキスト</h3>`;
    expect(extractEffectTextFromAtwikiHtml(html)).toContain("超シールド進化");
  });
});
