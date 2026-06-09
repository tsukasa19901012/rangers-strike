#!/usr/bin/env node
/**
 * ベルトコレクション + マスクドライダーEXP vol.1〜4 の atwiki ページマップ
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/rider-belt-atwiki-pages.json");

const SETS = [
  { set: "belt", indexPage: 711, title: "ベルトコレクション" },
  { set: "rider-exp-1", indexPage: 34, title: "マスクドライダーEXP vol.1" },
  { set: "rider-exp-2", indexPage: 577, title: "マスクドライダーEXP vol.2" },
  { set: "rider-exp-3", indexPage: 829, title: "マスクドライダーEXP vol.3" },
  { set: "rider-exp-4", indexPage: 1224, title: "マスクドライダーEXP vol.4" },
];

async function fetchIndex(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseCardLinks(html) {
  const slice = html.slice(html.indexOf("wikibody"));
  const map = {};
  const re =
    /([A-Z]{2,3}-\d{3})[^<]{0,40}<a[^>]*pages\/(\d+)\.html[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(slice))) {
    map[m[1]] = { page: Number(m[2]), name: m[3].trim() };
  }
  return map;
}

async function main() {
  const map = {};
  for (const exp of SETS) {
    const part = parseCardLinks(await fetchIndex(exp.indexPage));
    for (const [id, entry] of Object.entries(part)) {
      map[id] = { ...entry, set: exp.set, setTitle: exp.title };
    }
    console.log(`${exp.title}: ${Object.keys(part).length} cards`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const setOrder = Object.fromEntries(SETS.map((s, i) => [s.set, i]));
  const sorted = Object.fromEntries(
    Object.keys(map)
      .sort((a, b) => {
        const sa = setOrder[map[a].set] ?? 99;
        const sb = setOrder[map[b].set] ?? 99;
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b, undefined, { numeric: true });
      })
      .map((id) => [id, map[id]]),
  );

  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} entries → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
