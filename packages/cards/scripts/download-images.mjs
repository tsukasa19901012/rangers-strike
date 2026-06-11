#!/usr/bin/env node
/**
 * GrnRngr.com からカード画像をローカルアセットへダウンロード。
 * 使い方: node scripts/download-images.mjs [legend1|legend2|all]
 */
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const IMAGE_BASE = "https://www.grnrngr.com/cards/rangers-strike/cards";
const CARD_BACK_URL = "https://tcg-db.nikita.jp/img/card/rs/back.jpg";
const CORE_CATALOG_PATH = path.join(
  packageRoot,
  "src/generated/catalog/core-playable/cards.json",
);

const EXPANSIONS = {
  legend1: {
    assetsDir: path.join(packageRoot, "assets/legend1"),
    webPublicDir: path.join(repoRoot, "apps/web/public/cards/legend1"),
    imageBasePath: "/cards/legend1",
    downloadBack: true,
  },
  legend2: {
    assetsDir: path.join(packageRoot, "assets/legend2"),
    webPublicDir: path.join(repoRoot, "apps/web/public/cards/legend2"),
    imageBasePath: "/cards/legend2",
    downloadBack: false,
  },
  legend3: {
    assetsDir: path.join(packageRoot, "assets/legend3"),
    webPublicDir: path.join(repoRoot, "apps/web/public/cards/legend3"),
    imageBasePath: "/cards/legend3",
    downloadBack: false,
  },
};

async function download(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "rangers-strike-dev/0.1" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 1000) {
    throw new Error(`response too small (${data.length} bytes)`);
  }
  return data;
}

async function downloadExpansion(expansionId, catalog) {
  const config = EXPANSIONS[expansionId];
  const cards = catalog.cards.filter((card) => card.expansion === expansionId);

  await mkdir(config.assetsDir, { recursive: true });
  await mkdir(config.webPublicDir, { recursive: true });

  const failed = [];

  for (const card of cards) {
    const sourceUrl = `${IMAGE_BASE}/${card.id}.jpg`;
    const filename = `${card.id}.jpg`;
    const assetPath = path.join(config.assetsDir, filename);
    const webPath = path.join(config.webPublicDir, filename);

    try {
      const data = await download(sourceUrl);
      await writeFile(assetPath, data);
      await copyFile(assetPath, webPath);
      card.imageUrl = `${config.imageBasePath}/${filename}`;
      card.imageSourceUrl = sourceUrl;
      process.stdout.write(`OK ${expansionId} ${card.id}\n`);
    } catch (error) {
      failed.push(`${card.id}: ${error}`);
      process.stderr.write(`FAIL ${expansionId} ${card.id}: ${error}\n`);
    }
  }

  if (config.downloadBack) {
    try {
      const backData = await download(CARD_BACK_URL);
      const backAsset = path.join(config.assetsDir, "back.jpg");
      const backWeb = path.join(config.webPublicDir, "back.jpg");
      await writeFile(backAsset, backData);
      await copyFile(backAsset, backWeb);
      process.stdout.write(`OK ${expansionId} back.jpg\n`);
    } catch (error) {
      failed.push(`back.jpg: ${error}`);
      process.stderr.write(`FAIL ${expansionId} back.jpg: ${error}\n`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`${expansionId}: failed to download ${failed.length} image(s)`);
  }

  console.log(`Downloaded ${cards.length} ${expansionId} images.`);
}

async function main() {
  const target = process.argv[2] ?? "all";
  const expansions = target === "all" ? Object.keys(EXPANSIONS) : [target];
  const catalog = JSON.parse(await readFile(CORE_CATALOG_PATH, "utf8"));

  for (const expansionId of expansions) {
    if (!EXPANSIONS[expansionId]) {
      throw new Error(`Unknown expansion: ${expansionId}`);
    }
    await downloadExpansion(expansionId, catalog);
  }

  await writeFile(CORE_CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
