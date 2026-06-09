#!/usr/bin/env node
/**
 * レンスト用語集（page 57）から用語ページマップを生成
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const SRC = path.join(__dirname, "../sources/atwiki");
const OUT = path.join(packageRoot, "src/glossary-atwiki-pages.json");

const INDEX_PAGE = 57;

/** 用語集索引のナビ・弾一覧など（page 57 末尾） */
const NAV_PAGE_IDS = new Set([
  "1", "8", "11", "12", "13", "16", "18", "19", "34", "57", "68", "225", "229",
  "513", "577", "597", "604", "619", "711", "749", "829", "965", "1082", "1091",
  "1224", "1236", "1286", "1409", "1522", "1682", "1848", "1996", "2154", "2260",
  "2366", "1715", "1877", "1956", "1974", "1983", "1984", "2048", "2079",
]);

const SLUG_OVERRIDES = {
  エンドフェイズ: "end-phase",
  スタートフェイズ: "start-phase",
  ゾードアップ: "zord-up",
  アタック: "attack",
  ストライク: "strike",
  ストライクポイント: "strike-point",
  ダメージ: "damage",
  コンビネーションナンバー: "combo-number",
  コンビネーション: "combination",
  撃破: "destroy",
  相打ち: "mutual-destroy",
  コマンドゾーン: "command-zone",
  常駐: "permanent-op",
  常駐置き場: "permanent-zone",
  "効果の解決": "effect-resolution",
  除外: "exile",
  除去: "removal",
  ウイング: "wing",
  ウィニー: "winny",
  テキスト: "text",
  カテゴリ: "category",
  タッグストライク: "tag-strike",
  カウンター: "counter-term",
  チェイス: "chase-term",
  ライド: "ride",
  ビークル: "vehicle",
  ラッシュ: "rush",
  コマンド: "command",
  パワー: "power",
  ストライカー: "striker",
  "Sユニット": "s-unit",
  "Lユニット": "l-unit",
  マルチカテゴリ: "multi-category",
  レンスト: "renst",
};

function toHalfAscii(s) {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

function makeSlug(title, pageId) {
  if (SLUG_OVERRIDES[title]) return SLUG_OVERRIDES[title];
  const half = toHalfAscii(title.trim());
  const ascii = half
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return ascii;
  return `p${pageId}`;
}

async function existingLabels() {
  const labels = {};
  try {
    for (const f of await readdir(SRC)) {
      const m = f.match(/^page-(\d+)-(.+)\.md$/);
      if (!m) continue;
      if (/^(RS|SR|BK|RK|SK|RM|SM)-\d{3}$/.test(m[2])) continue;
      labels[m[1]] = m[2];
    }
  } catch {
    /* empty */
  }
  return labels;
}

async function fetchHtml(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseIndex(html) {
  const slice = html.slice(html.indexOf("wikibody"));
  const end = slice.indexOf("トップページ");
  const body = end > 0 ? slice.slice(0, end) : slice;
  const map = new Map();
  const re = /pages\/(\d+)\.html[^>]*>([^<]+)</g;
  let m;
  while ((m = re.exec(body))) {
    const id = m[1];
    const name = m[2].trim().replace(/\s+/g, " ");
    if (NAV_PAGE_IDS.has(id) || name === "ページを更新") continue;
    if (!map.has(id)) map.set(id, name);
  }
  return map;
}

async function main() {
  const labels = await existingLabels();
  const index = parseIndex(await fetchHtml(INDEX_PAGE));
  const sorted = Object.fromEntries(
    [...index.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "ja"))
      .map(([page, name]) => {
        const slug = labels[page] ?? makeSlug(name, page);
        return [slug, { page: Number(page), name, slug }];
      }),
  );

  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} terms → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
