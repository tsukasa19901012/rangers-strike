#!/usr/bin/env node
/**
 * クロスギャザー XG1〜XG7 の atwiki ページマップ
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/xg-atwiki-pages.json");

const SETS = [
  { set: 1, indexPage: 1522, title: "クロスギャザー ザ・ファーストエンカウント" },
  { set: 2, indexPage: 1682, title: "クロスギャザー ザ・ドラゴンタイガー" },
  { set: 3, indexPage: 1848, title: "クロスギャザー ザ・Wインパクト" },
  { set: 4, indexPage: 1996, title: "クロスギャザー ザ・ジェットアクセル" },
  { set: 5, indexPage: 2154, title: "クロスギャザー ザ・チケットブレイカー" },
  { set: 6, indexPage: 2260, title: "クロスギャザー ザ・ギガンティックタイタン" },
  { set: 7, indexPage: 2366, title: "クロスギャザー ザ・ベストパートナー" },
];

async function fetchHtml(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseIndex(html, setNum) {
  const slice = html.slice(html.indexOf("wikibody"));
  const end = slice.indexOf("トップページ");
  const body = end > 0 ? slice.slice(0, end) : slice;
  const prefix = `XG${setNum}`;
  const pattern =
    setNum === 1
      ? /(XG-\d{3}|SX-\d{3}|XP-\d{3})[\s\S]{0,120}?pages\/(\d+)\.html[\s\S]{0,60}?>([^<]+)</gi
      : new RegExp(
          `(${prefix}-\\d{3}|SX-\\d{3}|XP-\\d{3})[\\s\\S]{0,120}?pages\\/(\\d+)\\.html[\\s\\S]{0,60}?>([^<]+)<`,
          "gi",
        );
  const map = {};
  let m;
  while ((m = pattern.exec(body))) {
    let id = m[1].toUpperCase();
    if (id.startsWith("XG-")) id = `XG1-${id.slice(3)}`;
    if (!map[id]) {
      map[id] = { page: Number(m[2]), name: m[3].trim() };
    }
  }
  return map;
}

async function main() {
  const map = {};
  for (const exp of SETS) {
    const part = parseIndex(await fetchHtml(exp.indexPage), exp.set);
    for (const [id, entry] of Object.entries(part)) {
      map[id] = {
        ...entry,
        set: exp.set,
        setTitle: exp.title,
      };
    }
    console.log(`XG${exp.set}: ${Object.keys(part).length} cards`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const sorted = Object.fromEntries(
    Object.keys(map)
      .sort((a, b) => {
        const pa = map[a].set - map[b].set;
        if (pa !== 0) return pa;
        return a.localeCompare(b, undefined, { numeric: true });
      })
      .map((id) => [id, map[id]]),
  );

  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
