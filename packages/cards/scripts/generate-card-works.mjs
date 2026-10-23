#!/usr/bin/env node
/**
 * カードの作品名（atwiki カードページの「作品：」）を、各カタログ（src/generated/catalog/<tier>/cards.json。full-playable はほかの 3 つのマージ）の各カードの `works` に入れる。
 *
 * - 表記揺れ（全角/半角の記号・英数字・スペース、誤記）は 1 つの表記にそろえる（WORK_ALIASES）。
 * - 2 作品にまたがるカード（SX-009 ゴセイレッド×ゴーカイレッド）は作品名を 2 つ持つ（DUAL_WORKS）。
 *   「天装戦隊ゴセイジャー／海賊戦隊ゴーカイジャー」という 1 つの作品名にはしない。
 *
 *   node packages/cards/scripts/generate-card-works.mjs   （リポジトリのルートから）
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dir = join(root, "docs/wiki/sources/atwiki");
const CATALOG_TIERS = ["core-playable", "vanilla-promoted", "complexity-promoted", "full-playable", "wiki-stubs"];

/** 全角の英数字と ！＆／、全角スペースを半角にし、連続スペースを 1 つにする（（）、・ などはそのまま）。 */
function normalizeWidth(s) {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９！＆／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, " ")
    .trim();
}

/** normalizeWidth 後の表記 → そろえた表記。 */
const WORK_ALIASES = {
  // スペースの有無
  "仮面ライダー龍騎スペシャル[13RIDERS]": "仮面ライダー龍騎スペシャル [13 RIDERS]",
  特捜ロボジャンパーソン: "特捜ロボ ジャンパーソン",
  "轟轟戦隊ボウケンジャーVSスーパー戦隊": "轟轟戦隊ボウケンジャー VS スーパー戦隊",
  "魔法戦隊マジレンジャーTHE MOVIE インフェルシアの花嫁": "魔法戦隊マジレンジャー THE MOVIE インフェルシアの花嫁",
  "魔法戦隊マジレンジャーTHEMOVIEインフェルシアの花嫁": "魔法戦隊マジレンジャー THE MOVIE インフェルシアの花嫁",
  "仮面ライダー×仮面ライダー W&ディケイドMOVIE大戦2010": "仮面ライダー×仮面ライダーW&ディケイドMOVIE大戦2010",
  // 言葉の違い・誤記
  仮面ライダーブレイド: "仮面ライダー剣",
  特急指令ソルブレイン: "特救指令ソルブレイン",
  仮面ライダーオーズ: "仮面ライダーオーズ/OOO",
  超電王トリロジー: "超・電王トリロジー",
  "仮面ライダー×3超・電王トリロジー": "超・電王トリロジー",
  "劇場版 仮面ライダーディケイド オールライダー対大ショッカー劇場版": "劇場版 仮面ライダーディケイド オールライダー対大ショッカー",
  "仮面ライダー×仮面ライダーW&ディケイドライダー大戦2010": "仮面ライダー×仮面ライダーW&ディケイドMOVIE大戦2010",
  "仮面ライダーW FOEVER AtoZ/運命のガイアメモリ": "仮面ライダーW FOREVER AtoZ/運命のガイアメモリ",
  "超・仮面ライダー電王&ディケイド NEOジェネレーションズ 鬼ヶ島の戦艦":
    "劇場版 超・仮面ライダー電王&ディケイド NEOジェネレーションズ 鬼ヶ島の戦艦",
  "劇場版 超・仮面ライダー電王&仮面ライダーディケイド": "劇場版 超・仮面ライダー電王&ディケイド NEOジェネレーションズ 鬼ヶ島の戦艦",
};

/** そろえた表記 → 複数の作品名。 */
const DUAL_WORKS = {
  "天装戦隊ゴセイジャー/海賊戦隊ゴーカイジャー": ["天装戦隊ゴセイジャー", "海賊戦隊ゴーカイジャー"],
};

function normalizeWorks(raw) {
  const w = normalizeWidth(raw);
  const title = WORK_ALIASES[w] ?? w;
  return DUAL_WORKS[title] ?? [title];
}

const works = {};
for (const f of readdirSync(dir)) {
  const m = f.match(/^page-\d+-([A-Z0-9]+-\d+)\.md$/);
  if (!m) continue;
  const raw = readFileSync(join(dir, f), "utf8").match(/^作品：(.*)$/m)?.[1]?.trim();
  if (raw) works[m[1]] = normalizeWorks(raw);
}
const sorted = Object.fromEntries(Object.entries(works).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));

for (const tier of CATALOG_TIERS) {
  const path = join(root, "packages/cards/src/generated/catalog", tier, "cards.json");
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  for (const card of catalog.cards) {
    delete card.works;
    if (sorted[card.id]) card.works = sorted[card.id];
  }
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`card works: ${Object.keys(sorted).length} cards, ${new Set(Object.values(sorted).flat()).size} titles`);
