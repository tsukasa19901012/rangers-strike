// 「共有する」で短い URL にされたデッキ（list-shared-decks.mjs --out の JSON）を、対戦台・自己対戦用の arena-decks/shared-<id>.json にする。
//   node apps/web-pocket/scripts/list-shared-decks.mjs --env <kv-readonly.env> --out packages/engine/.cache/shared-decks.json
//   cd packages/engine && npx tsx scripts/import-shared-decks.ts .cache/shared-decks.json
// 書くのは次を満たすものだけ: デッキの決まり（40 枚以上・同名 3 枚まで・カタログのカード）を満たす、
// スターター・ほかの arena-decks・ほかの共有デッキと中身（カードと枚数）が同じでない。
// 同じ中身の共有デッキが複数あるときは id の若いほうを残す。--dry-run なら書かずに数だけ出す。
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { allCardsCatalog, validateDeckEntries, type CardDefinition } from "@rangers-strike/cards";
import { buildAnyStarterDeck, ALL_STARTER_DECK_IDS } from "../src/verticalSlice/createStarterGame";
import { ARENA_DECKS_DIR, arenaDeck, arenaDeckIds } from "./arenaDecks";

type SharedDeck = { id: string; name: string; total: number; entries: { cardId: string; count: number }[] };

const file = process.argv[2];
if (!file) {
  console.error("使い方: npx tsx scripts/import-shared-decks.ts <list-shared-decks の --out の JSON> [--dry-run]");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const shared = (JSON.parse(readFileSync(file, "utf8")) as SharedDeck[]).sort((a, b) => a.id.localeCompare(b.id));

const signature = (cards: readonly CardDefinition[]) => cards.map((c) => c.id).sort().join(",");
const entrySignature = (entries: SharedDeck["entries"]) =>
  entries.flatMap((e) => Array<string>(e.count).fill(e.cardId)).sort().join(",");

// 既にあるデッキ（スターターと、共有デッキ以外の arena-decks）。共有デッキは今回の一覧で作り直す。
const known = new Map<string, string>();
for (const id of ALL_STARTER_DECK_IDS) known.set(signature(buildAnyStarterDeck(id as never)), id);
for (const id of arenaDeckIds()) {
  if (id.startsWith("shared-")) continue;
  known.set(signature(arenaDeck(id)!), id);
}

let written = 0;
const skipped: string[] = [];
for (const d of shared) {
  const errors = validateDeckEntries(d.entries, allCardsCatalog).errors;
  if (errors.length > 0) {
    skipped.push(`${d.id}\t${d.total} 枚\t${d.name}\t決まりを満たさない: ${errors[0]}`);
    continue;
  }
  const sig = entrySignature(d.entries);
  const same = known.get(sig);
  if (same) {
    skipped.push(`${d.id}\t${d.total} 枚\t${d.name}\t${same} と同じ中身`);
    continue;
  }
  known.set(sig, `shared-${d.id}`);
  written++;
  if (!dryRun) {
    const deck = { id: `shared-${d.id}`, name: d.name, source: `共有デッキ /?d=${d.id}`, entries: d.entries };
    writeFileSync(resolve(ARENA_DECKS_DIR, `shared-${d.id}.json`), JSON.stringify(deck, null, 2) + "\n");
  }
}
console.log(`共有デッキ ${shared.length} 個のうち ${written} 個を${dryRun ? "書ける（--dry-run）" : " arena-decks に書いた"}。使わなかったもの ${skipped.length} 個:`);
for (const s of skipped) console.log(`  ${s}`);
