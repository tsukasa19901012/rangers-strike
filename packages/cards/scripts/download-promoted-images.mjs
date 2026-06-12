#!/usr/bin/env node
/**
 * GrnRngr.com から promoted カード画像を一括ダウンロード。
 * vanilla-promoted / complexity-promoted の cards.json に imageUrl を書き込む。
 *
 * 使い方:
 *   node scripts/download-promoted-images.mjs [--limit N] [--concurrency N]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const IMAGE_BASE = "https://www.grnrngr.com/cards/rangers-strike/cards";
const MIN_BYTES = 1000;

const CATALOGS = [
  {
    id: "vanilla-promoted",
    cardsJson: path.join(
      packageRoot,
      "src/generated/catalog/vanilla-promoted/cards.json",
    ),
  },
  {
    id: "complexity-promoted",
    cardsJson: path.join(
      packageRoot,
      "src/generated/catalog/complexity-promoted/cards.json",
    ),
  },
];

const assetsDir = path.join(packageRoot, "assets/promoted");
const webPublicDir = path.join(repoRoot, "apps/web/public/cards/promoted");
const imageBasePath = "/cards/promoted";
const manifestPath = path.join(
  packageRoot,
  "pipeline/data/promoted-image-download.json",
);
const sourceOverridesPath = path.join(
  packageRoot,
  "pipeline/data/promoted-image-source-overrides.json",
);

async function loadSourceOverrides() {
  try {
    const raw = JSON.parse(await readFile(sourceOverridesPath, "utf8"));
    const overrides = {};
    for (const [cardId, sourceId] of Object.entries(raw)) {
      if (cardId.startsWith("_")) continue;
      overrides[cardId] = sourceId;
    }
    return overrides;
  } catch {
    return {};
  }
}

function resolveSourceCardId(cardId, overrides) {
  return overrides[cardId] ?? cardId;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit;
  let concurrency = 8;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = Number(args[++i]);
    if (args[i] === "--concurrency") concurrency = Number(args[++i]);
  }
  return { limit, concurrency: Math.max(1, concurrency) };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "rangers-strike-dev/0.1" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < MIN_BYTES) {
    throw new Error(`response too small (${data.length} bytes)`);
  }
  return data;
}

async function processCard(card, stats, sourceOverrides) {
  const filename = `${card.id}.jpg`;
  const assetPath = path.join(assetsDir, filename);
  const webPath = path.join(webPublicDir, filename);
  const sourceId = resolveSourceCardId(card.id, sourceOverrides);
  const sourceUrl = `${IMAGE_BASE}/${sourceId}.jpg`;

  if (card.imageUrl?.startsWith(imageBasePath) && (await fileExists(webPath))) {
    stats.skipped++;
    return;
  }

  try {
    const data = await download(sourceUrl);
    await writeFile(assetPath, data);
    await writeFile(webPath, data);
    card.imageUrl = `${imageBasePath}/${filename}`;
    card.imageSourceUrl = sourceUrl;
    stats.ok++;
    process.stdout.write(`OK ${card.id}\n`);
  } catch (error) {
    stats.failed.push({ id: card.id, error: String(error) });
    process.stderr.write(`FAIL ${card.id}: ${error}\n`);
  }
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
}

async function main() {
  const { limit, concurrency } = parseArgs();
  await mkdir(assetsDir, { recursive: true });
  await mkdir(webPublicDir, { recursive: true });

  const stats = { ok: 0, skipped: 0, failed: [] };
  const startedAt = new Date().toISOString();
  const sourceOverrides = await loadSourceOverrides();

  for (const catalog of CATALOGS) {
    const file = JSON.parse(await readFile(catalog.cardsJson, "utf8"));
    let cards = file.cards.filter((c) => !c.imageUrl);
    if (limit) cards = cards.slice(0, limit);

    console.log(`\n=== ${catalog.id}: ${cards.length} cards to fetch ===\n`);

    await runPool(cards, concurrency, (card) =>
      processCard(card, stats, sourceOverrides),
    );

    await writeFile(catalog.cardsJson, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`Updated ${catalog.cardsJson}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    startedAt,
    stats: {
      downloaded: stats.ok,
      skipped: stats.skipped,
      failed: stats.failed.length,
    },
    failures: stats.failed,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\nDone: ${stats.ok} downloaded, ${stats.skipped} skipped, ${stats.failed.length} failed`,
  );
  console.log(`Manifest: ${manifestPath}`);

  if (stats.failed.length > 0) {
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
