#!/usr/bin/env node
/**
 * atwiki 取得（レート制限付き）
 * - 間隔 3〜10 秒
 * - 1 実行 20 ページまで
 * - 逐次のみ
 * - w.atwiki.jp 連続禁止 → 各ページ前に grnrngr でドメイン break
 */
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAtwikiPage } from "../../../packages/cards/scripts/atwikiText.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const manifestArg = process.argv[2] ?? "manifest.json";
const MANIFEST = path.join(OUT_DIR, manifestArg);
const LOG = path.join(OUT_DIR, "fetch-log.txt");
const BREAK_URL =
  "https://www.grnrngr.com/documents/rangersstrike/rule/index.html";

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomSleepSec() {
  return 3 + Math.floor(Math.random() * 8);
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

async function breakDomain(log) {
  await appendFile(log, `[break] GET ${BREAK_URL}\n`);
  try {
    const res = await fetch(BREAK_URL, { method: "GET" });
    await appendFile(log, `  grnrngr:${res.status}\n`);
  } catch (e) {
    await appendFile(log, `  grnrngr:error ${e.message}\n`);
  }
  const sec = randomSleepSec();
  await appendFile(log, `[sleep ${sec}s after break]\n`);
  await sleepMs(sec * 1000);
}

async function fetchPage(pageId, label) {
  const url = `https://w.atwiki.jp/renst/pages/${pageId}.html`;
  const res = await fetch(url, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const pages = manifest.pages.slice(0, 20);
  const batchName = manifest.batch ?? manifestArg;

  await appendFile(
    LOG,
    `\n=== batch ${batchName} started ${new Date().toISOString()} mode=direct manifest=${manifestArg} ===\n`,
  );

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < pages.length; i += 1) {
    const { id, label, title, cardId } = pages[i];
    if (i > 0) await breakDomain(LOG);

    await appendFile(
      LOG,
      `[${i + 1}/${pages.length}] page ${id} ${label} (${title})${cardId ? ` card=${cardId}` : ""}\n`,
    );

    try {
      const html = await fetchPage(id, label);
      const body = wikibodySlice(html);
      const plain = htmlToPlain(body);
      const outMd = path.join(OUT_DIR, `page-${id}-${label}.md`);
      const content = `# ${title}${cardId ? ` (${cardId})` : ""} (page ${id})

出典: https://w.atwiki.jp/renst/pages/${id}.html
${cardId ? `カードID: ${cardId}\n` : ""}取得: ${new Date().toISOString()}
方式: direct fetch (User-Agent: rangers-strike-wiki-agent/1.0)
バッチ: ${batchName}

---

${plain.slice(0, 50_000)}
`;
      await writeFile(outMd, content);
      await appendFile(
        LOG,
        `  ok bytes=${content.length} wikibody=${html.includes("wikibody")}\n`,
      );
      ok += 1;
    } catch (e) {
      await appendFile(LOG, `  FAIL ${e.message}\n`);
      fail += 1;
    }

    const sec = randomSleepSec();
    await appendFile(LOG, `[sleep ${sec}s]\n`);
    await sleepMs(sec * 1000);
  }

  await appendFile(
    LOG,
    `=== batch ${batchName} finished ${new Date().toISOString()} ok=${ok} fail=${fail} ===\n`,
  );
  console.log(`batch ${batchName} done ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
