#!/usr/bin/env node
/**
 * XP プロモカード画像を grnrngr.com の promos ページから取得。
 *
 * Usage:
 *   node scripts/download-promo-images.mjs [--concurrency N] [--dry-run]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const GRNRNGR_ORIGIN = "https://www.grnrngr.com";
const PROMOS_PAGE = `${GRNRNGR_ORIGIN}/cards/rangers-strike/promos`;

const CATALOGS = [
  path.join(packageRoot, "src/generated/catalog/vanilla-promoted/cards.json"),
  path.join(packageRoot, "src/generated/catalog/complexity-promoted/cards.json"),
];

const assetsDir = path.join(packageRoot, "assets/promoted");
const webPublicDir = path.join(repoRoot, "apps/web/public/cards/promoted");
const imageBasePath = "/cards/promoted";
const manifestPath = path.join(packageRoot, "pipeline/data/promo-image-download.json");
const image404Path = path.join(packageRoot, "pipeline/data/image-404-ids.json");

const MIN_BYTES = 1000;
const CARD_LINK_RE =
  /data-lightbox="([^"]+)"[^>]*href="(\/cards\/rangers-strike\/cards\/[^"]+\.jpg)"/g;
const PROMO_CARD_ID_RE = /^XP-\d{3}$/;

function parseArgs() {
  const args = process.argv.slice(2);
  let concurrency = 8;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--concurrency") concurrency = Number(args[++i]);
    if (args[i] === "--dry-run") dryRun = true;
  }
  return { concurrency: Math.max(1, concurrency), dryRun };
}

/** grnrngr lightbox ID → リポジトリのカード ID（XP-001[RS] → XP-001）。 */
export function lightboxToPromoCardId(lightbox) {
  const base = lightbox.replace(/\[.*\]$/, "");
  return PROMO_CARD_ID_RE.test(base) ? base : null;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchPromosHtml() {
  const response = await fetch(PROMOS_PAGE, {
    headers: { "User-Agent": "rangers-strike-dev/0.1" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${PROMOS_PAGE}`);
  }
  return response.text();
}

/** promos ページから XP cardId → 画像 URL を構築。 */
export async function buildPromoImageMap() {
  const html = await fetchPromosHtml();
  const map = new Map();
  for (const match of html.matchAll(CARD_LINK_RE)) {
    const cardId = lightboxToPromoCardId(match[1]);
    if (!cardId) continue;
    map.set(cardId, `${GRNRNGR_ORIGIN}${match[2]}`);
  }
  return map;
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
  const { concurrency, dryRun } = parseArgs();
  await mkdir(assetsDir, { recursive: true });
  await mkdir(webPublicDir, { recursive: true });

  console.log("Scraping promos page...");
  const imageMap = await buildPromoImageMap();
  console.log(`Found ${imageMap.size} XP image URLs`);

  const stats = { ok: 0, skipped: 0, failed: [], notInCatalog: [] };
  const startedAt = new Date().toISOString();
  const catalogCardsById = new Map();

  for (const catalogPath of CATALOGS) {
    const file = JSON.parse(await readFile(catalogPath, "utf8"));
    for (const card of file.cards) {
      if (!PROMO_CARD_ID_RE.test(card.id)) continue;
      catalogCardsById.set(card.id, { card, catalogPath, file });
    }
  }

  const tasks = [];
  for (const [cardId, sourceUrl] of imageMap) {
    const entry = catalogCardsById.get(cardId);
    if (!entry) {
      stats.notInCatalog.push(cardId);
      continue;
    }
    tasks.push({ cardId, sourceUrl, ...entry });
  }

  const missingInMap = [...catalogCardsById.keys()].filter((id) => !imageMap.has(id));
  if (missingInMap.length > 0) {
    console.warn(`Catalog XP cards missing from scrape: ${missingInMap.length}`);
    for (const id of missingInMap) {
      console.warn(`  ${id}`);
    }
  }

  console.log(`\nDownloading ${tasks.length} XP images (dry-run=${dryRun})...\n`);

  await runPool(tasks, concurrency, async ({ cardId, sourceUrl, card }) => {
    const filename = `${cardId}.jpg`;
    const assetPath = path.join(assetsDir, filename);
    const webPath = path.join(webPublicDir, filename);

    if (card.imageUrl?.startsWith(imageBasePath) && (await fileExists(webPath))) {
      stats.skipped++;
      return;
    }

    if (dryRun) {
      console.log(`DRY ${cardId} <- ${sourceUrl}`);
      return;
    }

    try {
      const data = await download(sourceUrl);
      await writeFile(assetPath, data);
      await writeFile(webPath, data);
      card.imageUrl = `${imageBasePath}/${filename}`;
      card.imageSourceUrl = sourceUrl;
      stats.ok++;
      process.stdout.write(`OK ${cardId}\n`);
    } catch (error) {
      stats.failed.push({ id: cardId, sourceUrl, error: String(error) });
      process.stderr.write(`FAIL ${cardId}: ${error}\n`);
    }
  });

  if (!dryRun) {
    const written = new Set();
    for (const { catalogPath, file } of catalogCardsById.values()) {
      if (written.has(catalogPath)) continue;
      written.add(catalogPath);
      await writeFile(catalogPath, `${JSON.stringify(file, null, 2)}\n`);
      console.log(`Updated ${catalogPath}`);
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      startedAt,
      sourcePage: PROMOS_PAGE,
      scrapedUrls: imageMap.size,
      stats: {
        downloaded: stats.ok,
        skipped: stats.skipped,
        failed: stats.failed.length,
        notInCatalog: stats.notInCatalog.length,
        catalogMissingFromScrape: missingInMap.length,
      },
      failures: stats.failed,
      notInCatalog: stats.notInCatalog.sort(),
      catalogMissingFromScrape: missingInMap.sort(),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    try {
      const image404 = JSON.parse(await readFile(image404Path, "utf8"));
      const cardsWithImages = new Set();
      for (const catalogPath of CATALOGS) {
        const file = JSON.parse(await readFile(catalogPath, "utf8"));
        for (const card of file.cards) {
          if (card.imageUrl) cardsWithImages.add(card.id);
        }
      }
      const remaining = image404.ids.filter((id) => !cardsWithImages.has(id));
      await writeFile(
        image404Path,
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            count: remaining.length,
            ids: remaining.sort(),
          },
          null,
          2,
        )}\n`,
      );
      console.log(`Updated image-404-ids.json: ${remaining.length} remaining`);
    } catch {
      /* optional */
    }
  }

  console.log(
    `\nDone: ${stats.ok} downloaded, ${stats.skipped} skipped, ${stats.failed.length} failed`,
  );
  console.log(`Manifest: ${manifestPath}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
