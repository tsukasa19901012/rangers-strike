#!/usr/bin/env node
/**
 * L1/L2 カードの atwiki ページ ID を索引ページから抽出。
 * 出典: pages/12.html（英雄の再誕）, pages/13.html（二人の黒騎士）
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/legend12-atwiki-pages.json");

async function fetchIndex(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseRsLinks(html) {
  const i = html.indexOf("wikibody");
  const slice = i >= 0 ? html.slice(i) : html;
  const map = {};
  const re =
    /RS-(\d{3})[^<]*<a[^>]*pages\/(\d+)\.html[^>]*>([^<]+)</g;
  let m;
  while ((m = re.exec(slice))) {
    const id = `RS-${m[1]}`;
    map[id] = { page: Number(m[2]), name: m[3].trim() };
  }
  return map;
}

async function main() {
  const coreCatalog = JSON.parse(
    await readFile(
      path.join(packageRoot, "src/generated/catalog/core-playable/cards.json"),
      "utf8",
    ),
  );
  const allIds = new Set(
    coreCatalog.cards
      .filter((c) => c.expansion === "legend1" || c.expansion === "legend2")
      .map((c) => c.id),
  );

  const m12 = parseRsLinks(await fetchIndex(12));
  await new Promise((r) => setTimeout(r, 2000));
  const m13 = parseRsLinks(await fetchIndex(13));
  const map = { ...m12, ...m13 };

  const missing = [...allIds].filter((id) => !map[id]);
  if (missing.length) {
    throw new Error(`Unmapped cards: ${missing.join(", ")}`);
  }

  const sorted = Object.fromEntries(
    Object.keys(map)
      .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
      .map((id) => [id, map[id]]),
  );

  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} entries → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
