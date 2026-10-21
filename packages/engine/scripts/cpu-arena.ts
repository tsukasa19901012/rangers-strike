// CPU 同士の対戦で強さを比べる。
//   npx tsx scripts/cpu-arena.ts --a 2 --b 2 [--b-src ../../.cache/base/packages/engine/src/ai/index.ts] [--games 40] [--decks abarenoh,dekaranger,magiking]
// 各対戦は席と先攻を入れ替えて2回ずつ行うので、デッキ・先攻の有利不利は打ち消される。
// --b-src を渡すと B 側は別の作業ツリーの AI（改良前など）を使う。
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { pickCpuAction, setCpuLevelOverrides, setEvalWeights, type CpuLevelConfig, type EvalWeights } from "../src/ai/index";
import type { CpuLevel } from "../src/ai/types";
import { createStarterGame } from "../src/verticalSlice/createStarterGame";
import type { GameState, PlayerId } from "../src/types/game";
import type { GameAction } from "../src/types/actions";

type Picker = (state: GameState, playerId: PlayerId, level: CpuLevel) => GameAction | null;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

const levelA = Number(arg("a", "2")) as CpuLevel;
const levelB = Number(arg("b", "2")) as CpuLevel;
const games = Number(arg("games", "40"));
const seed0 = Number(arg("seed", "1"));
const decks = arg("decks", "abarenoh,dekaranger,magiking").split(",");
const bSrc = process.argv.includes("--b-src") ? arg("b-src", "") : "";

const pickA: Picker = pickCpuAction;
const pickB: Picker = bSrc
  ? ((await import(pathToFileURL(resolve(bSrc)).href)) as { pickCpuAction: Picker }).pickCpuAction
  : pickCpuAction;

// --wa / --wb: 評価の重み（JSON、既定値からの差分）を A／B 側に使う。
const weightsA = JSON.parse(arg("wa", "{}")) as Partial<EvalWeights>;
const weightsB = JSON.parse(arg("wb", "{}")) as Partial<EvalWeights>;
// --oa / --ob: その側のレベル設定の上書き（JSON、例 {"rolloutTopK":4}）。
const overA = JSON.parse(arg("oa", "{}")) as Partial<CpuLevelConfig>;
const overB = JSON.parse(arg("ob", "{}")) as Partial<CpuLevelConfig>;
// --shard k --shards n: n 個のプロセスで分けて回すときの k 番目（0 始まり）。
const shard = Number(arg("shard", "0"));
const shards = Number(arg("shards", "1"));

const MAX_STEPS = 6_000;
const maxMs = { A: 0, B: 0 };
const moves = { A: 0, B: 0 };
/** 山札切れで負けた回数（負けた側）。 */
const deckOuts = { A: 0, B: 0 };
let turnsTotal = 0;

function play(seed: number, deck1: string, deck2: string, aSeat: PlayerId): { winner: "A" | "B" | null; steps: number; ms: Record<"A" | "B", number> } {
  let state = createStarterGame({
    player1Starter: deck1 as never,
    player2Starter: deck2 as never,
    seed,
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
  });
  const ms = { A: 0, B: 0 };
  for (let step = 0; step < MAX_STEPS; step++) {
    if (state.winner) {
      if (state.log.slice(-4).some((l) => l.includes("deck_out"))) deckOuts[state.winner === aSeat ? "B" : "A"]++;
      turnsTotal += state.turn;
      return { winner: state.winner === aSeat ? "A" : "B", steps: step, ms };
    }
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const actor = actions[0]!.playerId;
    const side = actor === aSeat ? "A" : "B";
    const t = performance.now();
    setEvalWeights(side === "A" ? weightsA : weightsB);
    setCpuLevelOverrides(side === "A" ? { [levelA]: overA } : { [levelB]: overB });
    const picked = side === "A" ? pickA(state, actor, levelA) : pickB(state, actor, levelB);
    const dt = performance.now() - t;
    ms[side] += dt;
    maxMs[side] = Math.max(maxMs[side], dt);
    moves[side]++;
    // アプリ（client-core の session）と同じく、選んだ手が適用できなければ他の合法手を順に試す。
    let result = picked && isLegalAction(state, picked) ? applyAction(state, picked) : null;
    for (const candidate of actions) {
      if (result?.ok) break;
      if (candidate.playerId === actor) result = applyAction(state, candidate);
    }
    if (!result?.ok) break;
    state = result.state;
  }
  return { winner: null, steps: MAX_STEPS, ms };
}

/** A が使ったデッキごとの [A の勝ち, 決着した試合数]。 */
const byDeck: Record<string, [number, number]> = {};
let a = 0, b = 0, draws = 0;
const ms = { A: 0, B: 0 };
const pairs: [string, string][] = [];
// 先頭のデッキに偏らないよう、組み合わせを散らした順に並べる。
for (let i = 0; i < decks.length * decks.length; i++) {
  const d1 = i % decks.length;
  // --mirror: 同じデッキ同士だけで戦う（デッキの強弱を除いて、CPU の差だけを見る）。
  const d2 = process.argv.includes("--mirror") ? d1 : (Math.floor(i / decks.length) + d1 * 5) % decks.length;
  pairs.push([decks[d1]!, decks[d2]!]);
}
const started = performance.now();
for (let g = 0; g < games; g++) {
  if (Math.floor(g / 2) % shards !== shard) continue;
  const [d1, d2] = pairs[Math.floor(g / 2) % pairs.length]!;
  const seed = seed0 + Math.floor(g / 2);
  // 偶数回は A が player1、奇数回は同じ条件で席を入れ替える。
  const aSeat: PlayerId = g % 2 === 0 ? "player1" : "player2";
  const r = play(seed, d1, d2, aSeat);
  const aDeck = aSeat === "player1" ? d1 : d2;
  const tally = (byDeck[aDeck] ??= [0, 0]);
  if (r.winner) tally[1]++;
  if (r.winner === "A") tally[0]++;
  if (r.winner === "A") a++;
  else if (r.winner === "B") b++;
  else draws++;
  ms.A += r.ms.A;
  ms.B += r.ms.B;
  if (process.argv.includes("--verbose")) console.log(`#${g} ${d1} vs ${d2} seed=${seed} A=${aSeat} -> ${r.winner ?? "draw"} (${r.steps} steps)`);
}
const n = a + b;
const rate = n ? a / n : 0;
const se = n ? Math.sqrt((rate * (1 - rate)) / n) : 0;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ a, b, draws, msA: ms.A, msB: ms.B, maxA: maxMs.A, maxB: maxMs.B, movesA: moves.A, movesB: moves.B, deckOutA: deckOuts.A, deckOutB: deckOuts.B, turns: turnsTotal, byDeck }));
  process.exit(0);
}
console.log(
  `A=Lv${levelA}${bSrc ? " (current)" : ""} vs B=Lv${levelB}${bSrc ? " (" + bSrc + ")" : ""}: ` +
    `A ${a} - ${b} B, draws ${draws}; A win rate ${(rate * 100).toFixed(1)}% ±${(se * 196).toFixed(1)}; ` +
    `think A ${(ms.A / 1000).toFixed(1)}s B ${(ms.B / 1000).toFixed(1)}s; total ${((performance.now() - started) / 1000).toFixed(0)}s`,
);
