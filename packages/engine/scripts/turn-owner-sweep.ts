// ターンの持ち主以外が end_phase / end_turn を指す（ターンが入れ替わる）試合と、次のターンへ持ち越した中断中のバトル進入を探す
// （src/testing/turnOwnerGame.ts）。見つかった試合は 1 行 1 件の JSON で出す。
//   npx tsx scripts/turn-owner-sweep.ts --games 800 --seed 7 [--shard 0 --shards 4] [--decks starters,arena,livedoor,blog2] [--explore 0.3]
//   1 試合だけ見る: --only <試合番号> [--trace]
// 並列: for k in 0 1 2 3; do npx tsx scripts/turn-owner-sweep.ts --games 2000 --shard $k --shards 4 > out$k.jsonl & done
import { arenaDeck, resolveDeckPool } from "./arenaDecks";
import { playTurnOwnerGame, sweepRng } from "../src/testing/turnOwnerGame";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "100"));
const seed0 = Number(arg("seed", "1"));
const shard = Number(arg("shard", "0"));
const shards = Number(arg("shards", "1"));
const explore = Number(arg("explore", "0.3"));
const only = process.argv.includes("--only") ? Number(arg("only", "0")) : null;
const trace = process.argv.includes("--trace");
const deckPool = resolveDeckPool(arg("decks", "starters,arena,livedoor,blog2"));
const deckCards = new Map(deckPool.ids.map((id) => [id, arenaDeck(id)]));

let found = 0;
let stale = 0;
for (let g = 0; g < games; g++) {
  if (only !== null ? g !== only : g % shards !== shard) continue;
  const rand = sweepRng(seed0 * 1_000_003 + g);
  const d1 = deckPool.pick(rand);
  const d2 = deckPool.pick(rand);
  try {
    const r = playTurnOwnerGame({ deck1Id: d1, deck2Id: d2, deck1: deckCards.get(d1), deck2: deckCards.get(d2), seed: seed0 + g, rand, explore, trace });
    if (r.trace) for (const t of r.trace) console.log(JSON.stringify(t));
    for (const s of r.stale) {
      stale++;
      console.log(JSON.stringify({ kind: "stale_deferred_battle_entry", game: g, d1, d2, ...s }));
    }
    if (r.violation) {
      found++;
      console.log(JSON.stringify({ kind: "turn_owner", game: g, d1, d2, ...r.violation }));
    }
  } catch (e) {
    console.error(`game ${g} threw ${String(e).slice(0, 160)}`);
  }
}
console.error(JSON.stringify({ shard, found, stale }));
