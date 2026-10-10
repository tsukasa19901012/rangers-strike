import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractEffectTextFromAtwikiHtml,
  extractEffectTextFromAtwikiSource,
} from "./atwikiText.js";

const SOURCE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/wiki/sources/atwiki",
);

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

describe("extractEffectTextFromAtwikiSource（E7）", () => {
  const body = (label) =>
    `種類：Sユニット\n\n特徴：レッド\n\n${label}\n\n※これは毎ターン、可能ならバトルエリアに出る。\n\n【アバレスラッシュ】「SP1」\n\nフレーバーテキスト\n\n王者の魂\n\nイラストレーター：K2商会`;

  it.each([
    ["全角コロン", "テキスト："],
    ["半角コロン", "テキスト:"],
    ["コロンなし", "テキスト"],
  ])("「テキスト」見出し（%s）の効果文を抽出する", (_label, heading) => {
    expect(extractEffectTextFromAtwikiSource(body(heading))).toBe(
      "※これは毎ターン、可能ならバトルエリアに出る。\n【アバレスラッシュ】「SP1」",
    );
  });

  it("本文中の「テキスト」やフレーバーテキストを見出しとみなさない", () => {
    const text =
      "特徴：DEN-O\n\nテキスト\n\n※効果名を持つテキストは無効になる。\n\nフレーバーテキスト\n\nテキスト：ではない";
    expect(extractEffectTextFromAtwikiSource(text)).toBe("※効果名を持つテキストは無効になる。");
    expect(extractEffectTextFromAtwikiSource("フレーバーテキスト\n\nなにか")).toBe("");
  });

  // E7: 以下 13 枚は「テキスト:」（半角）または「テキスト」（コロンなし）で、旧抽出（「テキスト：」のみ）では空だった。
  const E7_CARDS = {
    "PR-015": "【バイオ粒子斬り】",
    "PR-016": "【アバレスラッシュ】",
    "RK-140": "【電車斬り】",
    "RK-334": "【電車斬り】",
    "RS-230": "【アバレスラッシュ】",
    "RS-288": "【ドラゴンハーレー】",
    "XG1-028": "【アバレンオーになりかけだから…】",
    "XG1-029": "【無敵の竜人魂】",
    "XG1-030": "【キラークロー】",
    "XG1-062": "【ワイルドサイクロン】",
    "XG3-005": "【マックスノバ】",
    "XG5-014": "【マックスビクトリープロミネンス】",
    "XG6-015": "【爆竜必殺チョキチョキシザース】",
  };
  const files = readdirSync(SOURCE_DIR);

  it.each(Object.entries(E7_CARDS))("%s の原文スナップショットから効果文を抽出する", (cardId, named) => {
    const file = files.find((f) => f.endsWith(`-${cardId}.md`));
    expect(file, cardId).toBeDefined();
    const raw = readFileSync(join(SOURCE_DIR, file), "utf8");
    const text = extractEffectTextFromAtwikiSource(raw.split("\n---\n").slice(1).join("---"));
    expect(text).toContain(named);
    expect(text).not.toContain("フレーバー");
    expect(text).not.toContain("イラストレーター");
  });
});
