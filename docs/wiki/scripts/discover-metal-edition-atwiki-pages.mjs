#!/usr/bin/env node
/**
 * スペシャルメタルエディション（RM-*, SM-*）の atwiki ページマップ
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/metal-edition-atwiki-pages.json");

const INDEX_PAGE = 749;
const SET_TITLE = "スペシャルメタルエディション";

async function fetchHtml(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parseIndex(html) {
  const slice = html.slice(html.indexOf("wikibody"));
  const map = {};
  const re =
    /((?:RM|SM)-\d{3})[^<]{0,40}<a[^>]*pages\/(\d+)\.html[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(slice))) {
    map[m[1].toUpperCase()] = {
      page: Number(m[2]),
      name: m[3].trim(),
      set: "metal-edition",
      setTitle: SET_TITLE,
    };
  }
  return map;
}

async function main() {
  const map = parseIndex(await fetchHtml(INDEX_PAGE));
  const sorted = Object.fromEntries(
    Object.keys(map)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((id) => [id, map[id]]),
  );
  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
