#!/usr/bin/env node
/**
 * 4〜9弾カードの atwiki ページ ID を各弾索引ページから抽出。
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/legend49-atwiki-pages.json");

const EXPANSIONS = [
  { set: 4, indexPage: 18, title: "四雄の覚醒", min: 179, max: 242 },
  { set: 5, indexPage: 19, title: "五龍の激鱗", min: 243, max: 347 },
  { set: 6, indexPage: 229, title: "紅き六戦士の帰還", min: 348, max: 431 },
  { set: 7, indexPage: 619, title: "七忍の炎陣", min: 432, max: 515 },
  { set: 8, indexPage: 1082, title: "究極の八神", min: 516, max: 604 },
  { set: 9, indexPage: 1409, title: "蒼九の翼", min: 605, max: 690 },
];

async function fetchIndex(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseRsLinks(html, min, max) {
  const i = html.indexOf("wikibody");
  const slice = i >= 0 ? html.slice(i) : html;
  const map = {};
  const re = /RS-(\d{3})[^<]*<a[^>]*pages\/(\d+)\.html[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(slice))) {
    const num = Number(m[1]);
    if (num < min || num > max) continue;
    const id = `RS-${m[1]}`;
    map[id] = { page: Number(m[2]), name: m[3].trim() };
  }
  return map;
}

async function main() {
  const map = {};
  for (const exp of EXPANSIONS) {
    const html = await fetchIndex(exp.indexPage);
    const part = parseRsLinks(html, exp.min, exp.max);
    for (const [id, entry] of Object.entries(part)) {
      map[id] = { ...entry, expansion: exp.set, expansionTitle: exp.title };
    }
    console.log(
      `${exp.set}弾 page ${exp.indexPage}: ${Object.keys(part).length} cards`,
    );
    await new Promise((r) => setTimeout(r, 2000));
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
