#!/usr/bin/env node
/**
 * ルールブック（docs/rules/）の正となる web ページを取得して保存する。
 *
 * 取得対象:
 *   - 公式 grnrngr: rangersstrike/rule/ と faq/ 配下（index からリンクをたどる）
 *   - atwiki (w.atwiki.jp/renst): ルール・用語ページ（カードページ以外）
 *   - wikiwiki.jp/renst: エラッタ / ルール系トップページ
 *
 * 出力: docs/rules/sources/web/<host>/<path>.html と manifest.json
 * 逐次取得・各リクエスト間に 3〜6 秒待機（サイト負荷への配慮）。
 * 取得済み（status 200）の URL は飛ばし、失敗したものだけ取り直す。
 *
 * atwiki は Cloudflare の確認画面で 403 になるため、2026-10-10 はブラウザで開いて
 * 本文（#wikibody の innerText）を w.atwiki.jp/renst/pages/N.txt に保存した。
 *
 * 使い方: node scripts/fetch-rule-sources.mjs [--only=grnrngr|atwiki|wikiwiki]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/rules/sources/web");
const UA = "rangers-strike-rules-agent/1.0 (+https://github.com/tsukasa19901012/rangers-strike)";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

const GRNRNGR_SEEDS = [
  "https://www.grnrngr.com/documents/rangersstrike/rule/index.html",
  "https://www.grnrngr.com/documents/rangersstrike/faq/index.html",
  "https://www.grnrngr.com/documents/rangersstrike/faq/",
];
const GRNRNGR_SCOPE = /^https:\/\/www\.grnrngr\.com\/documents\/rangersstrike\/(rule|faq)\//;
const WIKIWIKI_PAGES = [
  "https://wikiwiki.jp/renst/",
  "https://wikiwiki.jp/renst/%E3%82%A8%E3%83%A9%E3%83%83%E3%82%BF",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const politeWait = () => sleep(3000 + Math.floor(Math.random() * 3000));

function outPath(url) {
  const u = new URL(url);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  if (!path.extname(p)) p += ".html";
  return path.join(OUT, u.host, p);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "";
  const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? (/<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.toString("latin1"))?.[1] ?? "utf-8");
  const text = new TextDecoder(charset.toLowerCase() === "shift_jis" ? "shift_jis" : charset).decode(buf);
  return { status: res.status, text };
}

async function save(manifest, url) {
  if (manifest.pages[url]?.status === 200) return manifest.pages[url];
  let entry;
  try {
    const { status, text } = await fetchText(url);
    const file = outPath(url);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    entry = {
      status,
      file: path.relative(ROOT, file),
      fetchedAt: new Date().toISOString(),
      sha256: createHash("sha256").update(text).digest("hex"),
    };
    console.log(`${status} ${url}`);
    entry.text = text;
  } catch (e) {
    entry = { status: 0, error: String(e), fetchedAt: new Date().toISOString() };
    console.log(`ERR ${url} ${e}`);
  }
  const { text, ...persisted } = entry;
  manifest.pages[url] = persisted;
  await politeWait();
  return entry;
}

function links(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)/g)) {
    try {
      out.add(new URL(m[1], base).href);
    } catch {}
  }
  return [...out];
}

/** 保存済みスナップショットのうちカード以外（ルール・用語）の atwiki ページ番号。 */
async function atwikiRulePageIds() {
  const dir = path.join(ROOT, "docs/wiki/sources/atwiki");
  const ids = new Set();
  for (const f of await readdir(dir)) {
    const m = /^page-(\d+)-(.+)\.md$/.exec(f);
    if (!m) continue;
    if (/^(RS|RK|XG\d?|BK|PR|PK|SR|SK|RM|SM|SX|XP|PM|XC)-/.test(m[2])) continue;
    ids.add(Number(m[1]));
  }
  return [...ids].sort((a, b) => a - b);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifestFile = path.join(OUT, "manifest.json");
  let manifest = { pages: {} };
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch {}
  const persist = () => writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

  if (!only || only === "grnrngr") {
    const queue = [...GRNRNGR_SEEDS];
    const seen = new Set();
    while (queue.length) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);
      const entry = await save(manifest, url);
      if (entry.text) {
        for (const l of links(entry.text, url)) {
          if (GRNRNGR_SCOPE.test(l) && /\.html?$|\/$/.test(l) && !seen.has(l)) queue.push(l);
        }
      }
      await persist();
    }
  }

  if (!only || only === "atwiki") {
    for (const id of await atwikiRulePageIds()) {
      await save(manifest, `https://w.atwiki.jp/renst/pages/${id}.html`);
      await persist();
    }
  }

  if (!only || only === "wikiwiki") {
    for (const url of WIKIWIKI_PAGES) {
      await save(manifest, url);
      await persist();
    }
  }

  const failed = Object.entries(manifest.pages).filter(([, e]) => e.status !== 200);
  console.log(`done: ${Object.keys(manifest.pages).length} pages, ${failed.length} not OK`);
  for (const [url, e] of failed) console.log(`  ${e.status} ${url}`);
}

await main();
