#!/usr/bin/env node
/**
 * promo-atwiki-pages.json から docs/wiki/cards/{PR,PK}-*.md を生成
 */
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const PAGES = path.join(packageRoot, "src/promo-atwiki-pages.json");
const CARDS = path.join(__dirname, "../cards");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function scopeNote(kind) {
  if (kind === "xp-promo") return "未実装（スコープ外: クロスギャザー）";
  return "未実装（スコープ外: プロモーション）";
}

function stub(cardId, { page, name, setTitle, kind = "pr-pk", edition }) {
  const url = `https://w.atwiki.jp/renst/pages/${page}.html`;
  const img = `https://www.grnrngr.com/cards/rangers-strike/cards/${cardId}.jpg`;
  const scope =
    kind === "xp-promo" ? "クロスギャザー" : "プロモーション";
  return `# ${cardId}

CARD_ID: ${cardId}

カード名: ${name}

作品: UNKNOWN

収録: ${setTitle}
${edition ? `\n系列: ${edition}\n` : ""}
出典:
* ${img}
* ${url}

効果文:
> （atwiki 未取得）

発動条件: UNKNOWN

コスト: UNKNOWN

対象: カードテキスト参照

解決: ${scopeNote(kind)}

制約: —

タイミング: UNKNOWN

State変化: —

必要Action: —

必要Event: —

必要テスト: —

関連カード: UNKNOWN

曖昧点: ${setTitle}は本リポジトリ実装スコープ外。Wiki収集のみ。

confidence: LOW
`;
}

async function main() {
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  let created = 0;
  let skipped = 0;
  for (const [cardId, meta] of Object.entries(map)) {
    const cardPath = path.join(CARDS, `${cardId}.md`);
    if (await exists(cardPath)) {
      skipped += 1;
      continue;
    }
    await writeFile(cardPath, stub(cardId, meta));
    created += 1;
  }
  console.log(`created ${created} stubs, skipped ${skipped} existing`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
