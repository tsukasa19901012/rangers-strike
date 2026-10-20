// XG3 スターターの CPU 同士の対戦で、デッキごとの行動の内訳を数える（CPU の使い方の偏りを探す）。
//   npx tsx scripts/starter-sim-stats.ts --p1 w-impact-b --p2 w-impact-a --games 10 [--level 5] [--log 0]
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { pickCpuAction } from "../src/ai/index";
import type { CpuLevel } from "../src/ai/types";
import { createStarterGame } from "../src/verticalSlice/createStarterGame";
import type { GameState, PlayerId } from "../src/types/game";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}
const p1 = arg("p1", "w-impact-b");
const p2 = arg("p2", "w-impact-a");
const games = Number(arg("games", "10"));
const level = Number(arg("level", "5")) as CpuLevel;
const logGame = Number(arg("log", "-1"));
const seed0 = Number(arg("seed", "1"));

type Stats = Record<string, number>;
const total: Record<PlayerId, Stats> = { player1: {}, player2: {} };
const inc = (s: Stats, k: string, n = 1) => (s[k] = (s[k] ?? 0) + n);
let wins = { player1: 0, player2: 0, none: 0 };

for (let g = 0; g < games; g++) {
  let state: GameState = createStarterGame({
    player1Starter: p1 as never,
    player2Starter: p2 as never,
    seed: seed0 + g,
    firstPlayer: g % 2 === 0 ? "player1" : "player2",
  });
  let logLen = 0;
  let lastTurn = -1;
  for (let step = 0; step < 8000 && !state.winner; step++) {
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const actor = actions[0]!.playerId;
    if (state.turn !== lastTurn && state.phase) {
      lastTurn = state.turn;
    }
    const picked = pickCpuAction(state, actor, level);
    if (picked?.type === "end_phase" && state.phase === "battle" && !state.pendingBattleEntry) {
      const left = actions.filter((x) => x.playerId === actor && (x.type === "move_to_battle" || (x.type === "initiate_command_payment" && x.kind === "battle_entry")));
      if (left.length) inc(total[actor], "endBattleWithMovable");
      if (actions.some((x) => x.playerId === actor && x.type === "strike")) inc(total[actor], "endBattleWithStrike");
    }
    if (picked?.type === "end_phase" && state.phase === "rush") {
      if (actions.some((x) => x.playerId === actor && x.type === "rush")) inc(total[actor], "endRushWithRush");
    }
    let result = picked && isLegalAction(state, picked) ? applyAction(state, picked) : null;
    const used = result?.ok ? picked! : null;
    for (const c of actions) {
      if (result?.ok) break;
      if (c.playerId === actor) result = applyAction(state, c);
    }
    if (!result?.ok) break;
    const s = total[actor];
    const a = used ?? ({ type: "fallback" } as never);
    inc(s, `a:${(a as { type: string }).type}`);
    if ((a as { type: string }).type === "end_phase") inc(s, `end:${state.phase}`);
    if (state.phase === "battle" && (a as { type: string }).type === "end_phase") {
      inc(s, `battleEndWithUnits:${state.players[actor].battle.length}`);
    }
    const prev = state;
    state = result.state;
    if (g === logGame) {
      for (const line of state.log.slice(prev.log.length > state.log.length ? 0 : prev.log.length)) console.log(`[t${state.turn} ${actor}] ${line}`);
    }
    logLen = state.log.length;
  }
  for (const pid of ["player1", "player2"] as PlayerId[]) {
    const ps = state.players[pid];
    inc(total[pid], "damageTaken", ps.damage);
    inc(total[pid], "deckLeft", ps.deck.length);
    inc(total[pid], "deckedOut", ps.deckedOut ? 1 : 0);
    inc(total[pid], "powerCards", ps.power.length);
    inc(total[pid], "commandCards", ps.command.length);
    inc(total[pid], "discard", ps.discard.length);
    inc(total[pid], "handEnd", ps.hand.length);
  }
  inc(total.player1, "turns", state.turn);
  if (state.winner) wins[state.winner]++;
  else wins.none++;
  console.error(`game ${g}: winner ${state.winner} turn ${state.turn} dmg ${state.players.player1.damage}-${state.players.player2.damage} deck ${state.players.player1.deck.length}-${state.players.player2.deck.length}`);
}
console.log(JSON.stringify({ p1, p2, wins }, null, 0));
const keys = [...new Set([...Object.keys(total.player1), ...Object.keys(total.player2)])].sort();
for (const k of keys) console.log(k.padEnd(32), ((total.player1[k] ?? 0) / games).toFixed(2).padStart(8), ((total.player2[k] ?? 0) / games).toFixed(2).padStart(8));
