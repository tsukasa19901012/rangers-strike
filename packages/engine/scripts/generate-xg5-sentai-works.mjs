#!/usr/bin/env node
/**
 * XG5-028 バーニングレジェンドダイボイジャー【スーパーサーティーセンタイソウル】「作品名に「戦隊」を含む…自軍捨札の枚数」用に、
 * atwiki カードページの「作品：」行（docs/wiki/sources/atwiki/page-N-<cardId>.md）から、作品名に「戦隊」を含むカードの ID を集めて
 * packages/engine/src/rules/xg5/xg5SentaiWorks.generated.ts に書き出す。カタログ（packages/cards）には作品名の欄がない。
 *
 *   node packages/engine/scripts/generate-xg5-sentai-works.mjs   （worktree / リポジトリのルートから）
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dir = join(root, "docs/wiki/sources/atwiki");
const out = join(root, "packages/engine/src/rules/xg5/xg5SentaiWorks.generated.ts");

const ids = new Set();
for (const f of readdirSync(dir)) {
  const m = f.match(/^page-\d+-([A-Z0-9]+-\d+)\.md$/);
  if (!m) continue;
  const work = readFileSync(join(dir, f), "utf8").match(/^作品：(.*)$/m)?.[1]?.trim();
  if (work && work.includes("戦隊")) ids.add(m[1]);
}
const sorted = [...ids].sort();
const body =
  "// 生成ファイル（編集しない）: node packages/engine/scripts/generate-xg5-sentai-works.mjs\n" +
  "// atwiki カードページの「作品：」に「戦隊」を含むカードの ID（XG5-028【スーパーサーティーセンタイソウル】）。\n" +
  "export const XG5_SENTAI_WORK_CARD_IDS: ReadonlySet<string> = new Set([\n" +
  sorted.map((id) => `  "${id}",`).join("\n") +
  "\n]);\n";
writeFileSync(out, body);
console.log(`xg5 sentai works: ${sorted.length} cards -> ${out}`);
