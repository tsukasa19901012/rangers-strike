#!/usr/bin/env node
/**
 * 全マニフェストを Firecrawl+direct ハイブリッドで再取得
 * 並列ワーカー数は WORKERS 環境変数で制御（デフォルト 6）
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const WORKERS = Number(process.env.WORKERS ?? 6);

function runBatch(manifest) {
  return new Promise((resolve) => {
    const child = spawn(
      "node",
      [path.join(__dirname, "fetch-atwiki-firecrawl-batch.mjs"), manifest],
      { stdio: "inherit", env: { ...process.env, FIRECRAWL_NO_TELEMETRY: "1" } },
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function pool(items, workerCount, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function main() {
  const manifests = (await readdir(OUT_DIR))
    .filter((f) => f.startsWith("manifest-batch") && f.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  console.log(`=== refresh ${manifests.length} manifests, workers=${WORKERS} ===`);
  const codes = await pool(manifests, WORKERS, async (m) => {
    console.log(`[start] ${m}`);
    const code = await runBatch(m);
    if (code !== 0) console.error(`[warn] ${m} exit=${code}`);
    return code;
  });
  const failed = codes.filter((c) => c !== 0).length;
  console.log(`=== batches done failed=${failed}/${manifests.length} ===`);

  console.log("=== sync cards + glossary ===");
  for (const script of ["sync-cards-from-atwiki.mjs", "sync-glossary-from-atwiki.mjs"]) {
    await new Promise((resolve, reject) => {
      const child = spawn("node", [path.join(__dirname, script)], { stdio: "inherit" });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
    });
  }
  console.log("=== wiki refresh complete ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
