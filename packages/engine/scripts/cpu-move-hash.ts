// 同じ seed の CPU 同士の対局の手順のハッシュを書き出す。CPU・エンジンを速くする変更の前後で出力を diff し、選ぶ手が変わっていないことを確かめる。
//   npx tsx scripts/cpu-move-hash.ts <レベル> <開始の対局番号> <終わりの対局番号> [shard shards] > before.txt
import { createHash } from "node:crypto";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { pickCpuAction } from "../src/ai/index";
import { createStarterGame, ALL_STARTER_DECK_IDS } from "../src/verticalSlice/createStarterGame";
import type { CpuLevel } from "../src/ai/types";
const [levelS, fromS, toS, shardS = "0", shardsS = "1"] = process.argv.slice(2);
const level = Number(levelS) as CpuLevel; const all = ALL_STARTER_DECK_IDS as readonly string[];
let think = 0;
for (let g = Number(fromS); g < Number(toS); g++) {
  if (g % Number(shardsS) !== Number(shardS)) continue;
  const d1 = all[(g * 7) % all.length]!, d2 = all[(g * 11 + 3) % all.length]!;
  let state = createStarterGame({ player1Starter: d1 as never, player2Starter: d2 as never, seed: 500 + g, firstPlayer: g % 2 ? "player1" : "player2" });
  const h = createHash("sha1"); let step = 0;
  for (; step < 3000 && !state.winner; step++) {
    const actions = getLegalActions(state); if (!actions.length) break;
    const actor = actions[0]!.playerId;
    const t = performance.now(); const picked = pickCpuAction(state, actor, level); think += performance.now() - t;
    h.update(JSON.stringify(picked));
    let r = picked && isLegalAction(state, picked) ? applyAction(state, picked) : null;
    for (const c of actions) { if (r?.ok) break; if (c.playerId === actor) r = applyAction(state, c); }
    if (!r?.ok) break; state = r.state;
  }
  h.update(JSON.stringify(state.log));
  console.log(`L${level} g${g} ${d1}/${d2} steps=${step} winner=${state.winner} ${h.digest("hex").slice(0, 12)}`);
}
console.error(`think L${level} ${(think / 1000).toFixed(1)}s`);
