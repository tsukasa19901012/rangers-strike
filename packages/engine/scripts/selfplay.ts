// 学習用の自己対戦データを作る（docs: CPU 学習ロードマップ Phase 0・2）。
//   npx tsx scripts/selfplay.ts --games 1000 --out .cache/selfplay/run1 [--shard 0 --shards 1] [--decks starters,arena]
//   --decks は既定でスターター 46 個。arena-decks/<id>.json の id や、まとめた名前（starters, arena, wiki, blog, livedoor, blog2）も使える。
//   「名前=重み」と書くとグループごとの割合を決められる（--decks starters=1,arena=1,livedoor=1,blog2=1 なら各 1/4）。
// 並列で回すときは scripts/selfplay-par.sh を使う。
//
// 1 試合ごとに、途中の盤面から --positions 個を無作為に選び、両方のプレイヤーから見た特徴（ai/valueFeatures.ts）と
// そのプレイヤーが最後に勝ったか（1/0）を書く。決着しなかった試合は捨てる。
// 出力（シャードごと）:
//   <out>/shard-<k>.f32   Float32 の行。1 行 = [label, game, turn, ...features]（列名は features.json）
//   <out>/shard-<k>.jsonl 1 試合 1 行のメタ情報（デッキ・レベル・勝者・手数）
//   <out>/features.json   列名と FEATURE_VERSION
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { createValueNet, pickCpuAction, setValueEvaluator } from "../src/ai/index";
import type { CpuLevel } from "../src/ai/types";
import { FEATURE_DIM, FEATURE_NAMES, FEATURE_VERSION, encodeState } from "../src/ai/valueFeatures";
import { createStarterGame } from "../src/verticalSlice/createStarterGame";
import { arenaDeck, resolveDeckPool } from "./arenaDecks";
import type { GameState, PlayerId } from "../src/types/game";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

const games = Number(arg("games", "100"));
const seed0 = Number(arg("seed", "1"));
const shard = Number(arg("shard", "0"));
const shards = Number(arg("shards", "1"));
const outDir = arg("out", ".cache/selfplay/run");
const positions = Number(arg("positions", "12"));
const deckPool = resolveDeckPool(arg("decks", "starters"));
// 試合ごとに JSON を読み直さないよう、arena-decks のデッキは最初に展開しておく。
const deckCards = new Map(deckPool.ids.map((id) => [id, arenaDeck(id)]));
// --mix: 「先手側Lv:後手側Lv=重み」のカンマ区切り。既定は Lv2 中心に Lv3 と Lv5 を混ぜる（ロードマップ Phase 2）。
const mix = arg("mix", "2:2=45,3:2=20,3:3=20,5:5=15")
  .split(",")
  .map((s) => {
    const [pair, w] = s.split("=");
    const [a, b] = pair!.split(":").map(Number) as [CpuLevel, CpuLevel];
    return { a, b, w: Number(w) };
  });
const mixTotal = mix.reduce((s, m) => s + m.w, 0);
// --explore: この確率で CPU の手のかわりに無作為な合法手を指す（似た局面ばかりになるのを防ぐ）。
const explore = Number(arg("explore", "0"));
// --only g: その試合番号だけを回す（落ちた試合の再現用。同じ --seed なら同じ試合になる）。
const only = process.argv.includes("--only") ? Number(arg("only", "0")) : null;

// --nn: 両方の CPU の盤面評価に学習した価値ネットワークを使う（ロードマップ Phase 5 の、学習版同士で集め直すサイクル）。
if (process.argv.includes("--nn")) setValueEvaluator(createValueNet(JSON.parse(readFileSync(arg("nn", ""), "utf8"))).evaluate);

const MAX_STEPS = 6_000;

/** 試合番号から決まる乱数（mulberry32）。同じ --seed なら同じ組み合わせになる。 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Result = { winner: PlayerId | null; steps: number; states: GameState[] };

function play(seed: number, d1: string, d2: string, levels: Record<PlayerId, CpuLevel>, rand: () => number): Result {
  let state = createStarterGame({
    player1Starter: d1 as never,
    player2Starter: d2 as never,
    player1Deck: deckCards.get(d1),
    player2Deck: deckCards.get(d2),
    seed,
    firstPlayer: rand() < 0.5 ? "player1" : "player2",
  });
  const states: GameState[] = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    if (state.winner) return { winner: state.winner, steps: step, states };
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    states.push(state);
    const actor = actions[0]!.playerId;
    const mine = actions.filter((a) => a.playerId === actor);
    const picked = explore > 0 && rand() < explore ? mine[Math.floor(rand() * mine.length)]! : pickCpuAction(state, actor, levels[actor]);
    // cpu-arena と同じく、選んだ手が適用できなければ他の合法手を順に試す。
    let result = picked && isLegalAction(state, picked) ? applyAction(state, picked) : null;
    for (const candidate of mine) {
      if (result?.ok) break;
      result = applyAction(state, candidate);
    }
    if (!result?.ok) break;
    state = result.state;
  }
  return { winner: null, steps: MAX_STEPS, states };
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "features.json"), JSON.stringify({ version: FEATURE_VERSION, columns: ["label", "game", "turn", ...FEATURE_NAMES] }, null, 1));
const binFd = openSync(join(outDir, `shard-${shard}.f32`), "w");
const metaFd = openSync(join(outDir, `shard-${shard}.jsonl`), "w");
const width = 3 + FEATURE_DIM;

const started = performance.now();
let played = 0, decided = 0, rows = 0;
for (let g = 0; g < games; g++) {
  if (only !== null ? g !== only : g % shards !== shard) continue;
  const rand = rng(seed0 * 1_000_003 + g);
  const d1 = deckPool.pick(rand);
  const d2 = deckPool.pick(rand);
  let pick = rand() * mixTotal;
  const m = mix.find((x) => (pick -= x.w) < 0) ?? mix[mix.length - 1]!;
  // どちらの席が強い側になるかも散らす。
  const swap = rand() < 0.5;
  const levels: Record<PlayerId, CpuLevel> = { player1: swap ? m.b : m.a, player2: swap ? m.a : m.b };
  const t = performance.now();
  let r: Result;
  try {
    r = play(seed0 + g, d1, d2, levels, rand);
  } catch (e) {
    // エンジンの例外で 1 試合落ちても、そのシャードの残りは続ける（再現は --only g）。
    writeSync(metaFd, JSON.stringify({ game: g, d1, d2, lv1: levels.player1, lv2: levels.player2, winner: null, error: String(e).slice(0, 300) }) + "\n");
    console.error(`game ${g} failed: ${String(e)}`);
    played++;
    continue;
  }
  played++;
  const meta = { game: g, d1, d2, lv1: levels.player1, lv2: levels.player2, winner: r.winner, steps: r.steps, turn: r.states.at(-1)?.turn ?? 0, ms: Math.round(performance.now() - t) };
  writeSync(metaFd, JSON.stringify(meta) + "\n");
  if (!r.winner || r.states.length === 0) continue;
  decided++;
  const n = Math.min(positions, r.states.length);
  const chosen = new Set<number>();
  while (chosen.size < n) chosen.add(Math.floor(rand() * r.states.length));
  const buf = new Float32Array(n * 2 * width);
  let o = 0;
  for (const i of [...chosen].sort((a, b) => a - b)) {
    const s = r.states[i]!;
    for (const pid of ["player1", "player2"] as const) {
      buf[o] = r.winner === pid ? 1 : 0;
      buf[o + 1] = g;
      buf[o + 2] = s.turn;
      buf.set(encodeState(s, pid), o + 3);
      o += width;
      rows++;
    }
  }
  writeSync(binFd, new Uint8Array(buf.buffer));
  if (process.argv.includes("--verbose")) console.log(JSON.stringify(meta));
}
closeSync(binFd);
closeSync(metaFd);
const sec = (performance.now() - started) / 1000;
console.log(JSON.stringify({ shard, played, decided, rows, width, sec: Math.round(sec), secPerGame: +(sec / Math.max(1, played)).toFixed(2) }));
