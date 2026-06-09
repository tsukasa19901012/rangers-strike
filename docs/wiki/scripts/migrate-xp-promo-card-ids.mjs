#!/usr/bin/env node
/**
 * XG プロモ CARD_ID を XP-001-RS 形式から XP-001 形式へ移行
 */
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const PAGES = path.join(packageRoot, "src/promo-atwiki-pages.json");
const CARDS = path.join(__dirname, "../cards");
const SRC = path.join(__dirname, "../sources/atwiki");

const OLD_ID_RE = /^XP-\d{3}-(?:RS|RK)$/;

function newIdFromOld(oldId) {
  return oldId.replace(/-(?:RS|RK)$/, "");
}

function patchMd(content, oldId, newId, edition) {
  let md = content
    .replaceAll(oldId, newId)
    .replace(/^# .+$/m, `# ${newId}`);
  if (edition && !/^系列:/m.test(md)) {
    md = md.replace(/^収録:.*$/m, `$&\n\n系列: ${edition}`);
  }
  return md;
}

async function main() {
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  const newMap = {};
  let renamed = 0;

  for (const [id, meta] of Object.entries(map)) {
    if (OLD_ID_RE.test(id)) {
      const newId = newIdFromOld(id);
      const edition = id.endsWith("-RS") ? "RS" : "RK";
      if (newMap[newId]) {
        throw new Error(`Duplicate target id ${newId} from ${id}`);
      }
      newMap[newId] = { ...meta, edition };
      renamed += 1;

      const oldCard = path.join(CARDS, `${id}.md`);
      const newCard = path.join(CARDS, `${newId}.md`);
      try {
        let md = await readFile(oldCard, "utf8");
        md = patchMd(md, id, newId, edition);
        await writeFile(newCard, md);
        if (oldCard !== newCard) {
          const { unlink } = await import("node:fs/promises");
          await unlink(oldCard);
        }
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }

      const page = meta.page;
      const srcFiles = (await readdir(SRC)).filter((f) =>
        f.startsWith(`page-${page}-${id}`),
      );
      for (const f of srcFiles) {
        const newName = f.replace(`-${id}.md`, `-${newId}.md`);
        await rename(path.join(SRC, f), path.join(SRC, newName));
        let raw = await readFile(path.join(SRC, newName), "utf8");
        raw = raw.replaceAll(id, newId);
        await writeFile(path.join(SRC, newName), raw);
      }
    } else {
      newMap[id] = meta;
    }
  }

  const sorted = Object.fromEntries(
    Object.keys(newMap)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((id) => [id, newMap[id]]),
  );
  await writeFile(PAGES, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Migrated ${renamed} XP promo ids in ${PAGES}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
