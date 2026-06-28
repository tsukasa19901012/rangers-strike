#!/usr/bin/env node
/**
 * atwiki 取得（Firecrawl scrape → 失敗時 direct fetch）
 * - manifest 1件あたり最大20ページ
 * - Firecrawl レート制限時は direct fetch にフォールバック
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, appendFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./load-env.mjs";
import { fetchAtwikiPage } from "../../../packages/cards/scripts/atwikiText.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../../..");
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const FC_DIR = path.join(ROOT, ".firecrawl");
const CHUNK_SIZE = Number(process.env.FC_CHUNK_SIZE ?? 5);
const manifestArg = process.argv[2];
if (!manifestArg) {
  console.error("Usage: node fetch-atwiki-firecrawl-batch.mjs <manifest.json>");
  process.exit(1);
}
const MANIFEST = path.join(OUT_DIR, manifestArg);
const LOG = path.join(OUT_DIR, "fetch-log-firecrawl.txt");

function firecrawlMdPath(pageId) {
  return path.join(FC_DIR, `w.atwiki.jp-renst-pages-${pageId}.html.md`);
}

function trimScrapedContent(markdown) {
  const stops = [
    "\nタグ：",
    "\nPost Button",
    "\n[ページを更新]",
    "\n0いいね！",
  ];
  let chunk = markdown.trim();
  for (const end of stops) {
    const i = chunk.indexOf(end);
    if (i >= 0) chunk = chunk.slice(0, i);
  }
  return chunk.trim();
}

function wikibodySlice(html) {
  const i = html.indexOf('wikibody"');
  return i >= 0 ? html.slice(i, i + 120_000) : html.slice(0, 120_000);
}

function htmlToPlain(fragment) {
  return fragment
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6][^>]*>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function scrapeChunk(pages) {
  const urls = pages.map((p) => `https://w.atwiki.jp/renst/pages/${p.id}.html`);
  await mkdir(FC_DIR, { recursive: true });
  const env = { ...process.env, FIRECRAWL_NO_TELEMETRY: "1" };
  try {
    const { stdout, stderr } = await execFileAsync(
      "firecrawl",
      ["scrape", ...urls, "--only-main-content"],
      {
        env,
        cwd: ROOT,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 180_000,
      },
    );
    const out = `${stdout}\n${stderr}`;
    const rateLimited = /today's limit of free|rate limit/i.test(out);
    return { rateLimited, output: out };
  } catch (e) {
    const out = `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message}`;
    const rateLimited = /today's limit of free|rate limit/i.test(out);
    return { rateLimited, output: out, error: e };
  }
}

async function directFetchPlain(pageId) {
  const html = await fetchAtwikiPage(pageId);
  return htmlToPlain(wikibodySlice(html));
}

async function fetchPageContent(page, rateLimited) {
  if (!rateLimited) {
    const fcPath = firecrawlMdPath(page.id);
    try {
      await access(fcPath);
      const raw = await readFile(fcPath, "utf8");
      const plain = trimScrapedContent(raw);
      if (plain) return { plain, mode: "firecrawl scrape (--only-main-content)" };
    } catch {
      // fall through
    }
  }
  const plain = await directFetchPlain(page.id);
  return { plain, mode: "direct fetch (firecrawl fallback)" };
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const pages = manifest.pages ?? [];
  const batchName = manifest.batch ?? manifestArg;

  await appendFile(
    LOG,
    `\n=== batch ${batchName} started ${new Date().toISOString()} mode=firecrawl+direct manifest=${manifestArg} pages=${pages.length} ===\n`,
  );

  if (pages.length === 0) {
    console.log(`batch ${batchName} skip (empty)`);
    return;
  }

  let rateLimited = false;
  for (const chunk of chunkArray(pages, CHUNK_SIZE)) {
    if (rateLimited) break;
    const result = await scrapeChunk(chunk);
    if (result.rateLimited) {
      rateLimited = true;
      await appendFile(LOG, `  firecrawl rate limited, switching to direct fetch\n`);
    } else if (result.error) {
      await appendFile(LOG, `  chunk scrape partial/error: ${result.error.message?.slice(0, 200)}\n`);
    }
  }

  let ok = 0;
  let fail = 0;
  const fetchedAt = new Date().toISOString();

  for (const page of pages) {
    const { id, label, title, cardId } = page;
    try {
      const { plain, mode } = await fetchPageContent(page, rateLimited);
      const outMd = path.join(OUT_DIR, `page-${id}-${label}.md`);
      const content = `# ${title}${cardId ? ` (${cardId})` : ""} (page ${id})

出典: https://w.atwiki.jp/renst/pages/${id}.html
${cardId ? `カードID: ${cardId}\n` : ""}取得: ${fetchedAt}
方式: ${mode}
バッチ: ${batchName}

---

${plain.slice(0, 50_000)}
`;
      await writeFile(outMd, content);
      await appendFile(LOG, `  ok page ${id} ${label} mode=${mode} bytes=${content.length}\n`);
      ok += 1;
      if (mode.includes("fallback")) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      await appendFile(LOG, `  FAIL page ${id} ${label} ${e.message}\n`);
      fail += 1;
    }
  }

  await appendFile(
    LOG,
    `=== batch ${batchName} finished ${new Date().toISOString()} ok=${ok} fail=${fail} rateLimited=${rateLimited} ===\n`,
  );
  console.log(`batch ${batchName} done ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
