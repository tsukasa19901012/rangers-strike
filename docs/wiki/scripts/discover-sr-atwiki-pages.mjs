#!/usr/bin/env node
/**
 * SR-002〜SR-008 の atwiki ページマップ
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/sr-atwiki-pages.json");

const INDEX_PAGES = [18, 19, 229, 619, 1082, 1409];
const TARGETS = new Set([
  "SR-002",
  "SR-003",
  "SR-004",
  "SR-005",
  "SR-006",
  "SR-007",
  "SR-008",
]);

const SET_BY_PAGE = {
  18: { set: 4, title: "四雄の覚醒" },
  19: { set: 5, title: "五龍の激鱗" },
  229: { set: 6, title: "紅き六戦士の帰還" },
  619: { set: 7, title: "七忍の炎陣" },
  1082: { set: 8, title: "究極の八神" },
  1409: { set: 9, title: "蒼九の翼" },
};

/** 索引にリンクがない SR-003 等 */
const MANUAL = {
  "SR-003": { page: 46, name: "アームドティラノレンジャー", set: 5, setTitle: "五龍の激鱗" },
};

async function fetchHtml(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseIndex(html, indexPage) {
  const slice = html.slice(html.indexOf("wikibody"));
  const map = {};
  const re =
    /(SR-00[2-8])[^<]*<a[^>]*pages\/(\d+)\.html[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(slice))) {
    const id = m[1].toUpperCase();
    if (!TARGETS.has(id)) continue;
    const meta = SET_BY_PAGE[indexPage];
    map[id] = {
      page: Number(m[2]),
      name: m[3].trim(),
      set: meta.set,
      setTitle: meta.title,
    };
  }
  return map;
}

async function main() {
  const map = { ...MANUAL };
  for (const indexPage of INDEX_PAGES) {
    const part = parseIndex(await fetchHtml(indexPage), indexPage);
    Object.assign(map, part);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const missing = [...TARGETS].filter((id) => !map[id]);
  if (missing.length) throw new Error(`Unmapped: ${missing.join(", ")}`);

  const sorted = Object.fromEntries(
    [...TARGETS].sort().map((id) => [id, map[id]]),
  );
  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} → ${OUT}`);
  for (const [id, e] of Object.entries(sorted)) {
    console.log(id, e.name, "page", e.page);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
