/**
 * DSL スタブを解析して「実装されているが挙動が不明なもの」をリストアップする。
 * effectId ベースの一覧だけでなく、keyword / ops パターンも見る。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DSL_DIR = path.join(__dirname, "../../../packages/cards/src/generated/dsl-stubs");
const files = fs.readdirSync(DSL_DIR).filter(f => f.endsWith(".dsl.json") && !f.startsWith("manifest") && !f.startsWith("stubs") && !f.startsWith("corestubs"));

interface Stub {
  cardId: string;
  cardType?: string;
  keywords?: Array<{ keyword: string; value?: string | number }>;
  effects?: Array<{
    trigger?: string;
    effectId?: string;
    ops?: Array<{ op: string; [k: string]: unknown }>;
    condition?: unknown;
    noteOther?: string;
    noteOtherEn?: string;
  }>;
}

// キーワード別カード一覧
const keywordCards = new Map<string, string[]>();
// op 別カード一覧
const opCards = new Map<string, string[]>();
// noteOther (未分類効果) カード一覧
const noteOtherCards: string[] = [];

for (const f of files) {
  const stub: Stub = JSON.parse(fs.readFileSync(path.join(DSL_DIR, f), "utf8"));
  const cardId = stub.cardId ?? f.replace(".dsl.json", "");
  
  for (const kw of stub.keywords ?? []) {
    if (!keywordCards.has(kw.keyword)) keywordCards.set(kw.keyword, []);
    keywordCards.get(kw.keyword)!.push(cardId);
  }
  
  for (const eff of stub.effects ?? []) {
    if (eff.noteOther || eff.noteOtherEn) {
      noteOtherCards.push(`${cardId}: ${eff.noteOther ?? eff.noteOtherEn}`);
    }
    for (const op of eff.ops ?? []) {
      if (!opCards.has(op.op)) opCards.set(op.op, []);
      opCards.get(op.op)!.push(cardId);
    }
  }
}

console.log("=== KEYWORDS (usage count) ===");
for (const [kw, cards] of [...keywordCards.entries()].sort((a,b) => b[1].length - a[1].length)) {
  console.log(`  ${kw}: ${cards.length}`);
}

console.log("\n=== OPS (usage count) ===");
for (const [op, cards] of [...opCards.entries()].sort((a,b) => b[1].length - a[1].length)) {
  console.log(`  ${op}: ${cards.length}`);
}

console.log(`\n=== NOTE_OTHER (未分類効果カード) count=${noteOtherCards.length} ===`);
for (const n of noteOtherCards.slice(0, 30)) {
  console.log(`  ${n}`);
}
