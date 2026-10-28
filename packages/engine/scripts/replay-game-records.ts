// 人と CPU の対戦の記録（apps/web-pocket/scripts/list-game-records.mjs --out の JSON）をエンジンで再生し、CPU の負けた対戦を並べる。
//   npx tsx scripts/replay-game-records.ts game-records.json [--log <key>] [--nn-out .cache/selfplay/human1 --positions 12]
// 記録は種・デッキ・指した手の全部なので、同じエンジンで再生すれば同じ対戦になる（エンジンが変わって手が通らなくなったら「再生失敗」）。
// --log <key>: その対戦のログ（日本語）を全部出す。
// --nn-out: selfplay.ts と同じ形式（shard-0.f32 / shard-0.jsonl / features.json）で学習用の局面を書く（scripts/nn/train.py にそのまま渡せる）。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import { applyAction } from "../src/core/applyAction";
import { FEATURE_DIM, FEATURE_NAMES, FEATURE_VERSION, encodeState } from "../src/ai/valueFeatures";
import { formatGameLog } from "../src/log/formatLog";
import { createStarterGame } from "../src/verticalSlice/createStarterGame";
import type { GameAction } from "../src/types/actions";
import type { GameState, PlayerId } from "../src/types/game";

type GameRecord = {
  key: string;
  at: number;
  seed: number;
  cpuLevel: number;
  humanDeck: string;
  cpuDeck: string;
  humanCards?: string[];
  cpuCards?: string[];
  winner: PlayerId | null;
  turns: number;
  actions: GameAction[];
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

const input = process.argv[2];
if (!input || input.startsWith("--")) {
  console.error("使い方: npx tsx scripts/replay-game-records.ts game-records.json [--log <key>] [--nn-out <dir>]");
  process.exit(1);
}
const records = JSON.parse(readFileSync(input, "utf8")) as GameRecord[];
const byId = new Map(allCardsCatalog.cards.map((c) => [c.id, c]));
const cards = (ids?: string[]): CardDefinition[] | undefined =>
  ids?.map((id) => {
    const card = byId.get(id);
    if (!card) throw new Error(`unknown card ${id}`);
    return card;
  });

type Replay = { states: GameState[]; final: GameState; failedAt: number | null };

function replay(r: GameRecord): Replay {
  let state = createStarterGame({
    player1Starter: r.humanDeck as never,
    player2Starter: r.cpuDeck as never,
    player1Deck: cards(r.humanCards),
    player2Deck: cards(r.cpuCards),
    seed: r.seed,
  });
  const states: GameState[] = [];
  for (let i = 0; i < r.actions.length; i++) {
    states.push(state);
    const result = applyAction(state, r.actions[i]!);
    if (!result.ok) return { states, final: state, failedAt: i };
    state = result.state;
  }
  return { states, final: state, failedAt: null };
}

const deckName = (id: string) => (id.startsWith("custom:") ? "自作デッキ" : id);
const date = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

const logKey = arg("log", "");
const nnOut = arg("nn-out", "");
const positions = Number(arg("positions", "12"));
const rows: Float32Array[] = [];
const metas: string[] = [];
let failed = 0;
const losses: string[] = [];

for (const [g, r] of records.entries()) {
  let rep: Replay;
  try {
    rep = replay(r);
  } catch (e) {
    failed++;
    console.log(`${r.key}\t再生失敗: ${String(e).slice(0, 200)}`);
    continue;
  }
  if (rep.failedAt !== null || rep.final.winner !== r.winner) {
    failed++;
    console.log(`${r.key}\t再生失敗: ${rep.failedAt !== null ? `${rep.failedAt + 1} 手目が通らない` : "勝者が記録と違う"}`);
    continue;
  }
  if (r.key === logKey) {
    for (const entry of rep.final.log) {
      const line = formatGameLog(entry, rep.final.definitions);
      if (line) console.log(line);
    }
  }
  if (r.winner === "player1") {
    const p = rep.final.players;
    losses.push(
      `${r.key}\t${date(r.at)}\tLv${r.cpuLevel}\t人 ${deckName(r.humanDeck)} vs CPU ${deckName(r.cpuDeck)}\t${r.turns} ターン\t` +
        `ダメージ 人 ${p.player1.damage} / CPU ${p.player2.damage}\tCPU 山札 ${p.player2.deck.length}`,
    );
  }
  if (nnOut && r.winner) {
    // selfplay.ts と同じく、途中の盤面から positions 個を選んで両方のプレイヤーから見た特徴と勝ち負けを書く（記録の種で決まる）。
    let s = (r.seed * 2654435761) >>> 0;
    const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const n = Math.min(positions, rep.states.length);
    const chosen = new Set<number>();
    while (chosen.size < n) chosen.add(Math.floor(rand() * rep.states.length));
    for (const i of [...chosen].sort((a, b) => a - b)) {
      const st = rep.states[i]!;
      for (const pid of ["player1", "player2"] as const) {
        const row = new Float32Array(3 + FEATURE_DIM);
        row[0] = r.winner === pid ? 1 : 0;
        row[1] = g;
        row[2] = st.turn;
        row.set(encodeState(st, pid), 3);
        rows.push(row);
      }
    }
    metas.push(JSON.stringify({ game: g, key: r.key, d1: r.humanDeck, d2: r.cpuDeck, lv1: "human", lv2: r.cpuLevel, winner: r.winner, steps: r.actions.length, turn: r.turns }));
  }
}

const cpuWins = records.filter((r) => r.winner === "player2").length;
console.log(`記録 ${records.length} 件: CPU の勝ち ${cpuWins}、負け ${records.length - cpuWins}、再生失敗 ${failed}`);
if (losses.length) {
  console.log("CPU の負けた対戦（--log <key> で手順を表示）:");
  for (const l of losses) console.log(l);
}
if (nnOut) {
  mkdirSync(nnOut, { recursive: true });
  writeFileSync(join(nnOut, "features.json"), JSON.stringify({ version: FEATURE_VERSION, columns: ["label", "game", "turn", ...FEATURE_NAMES] }, null, 1));
  const buf = new Float32Array(rows.length * (3 + FEATURE_DIM));
  rows.forEach((row, i) => buf.set(row, i * (3 + FEATURE_DIM)));
  writeFileSync(join(nnOut, "shard-0.f32"), new Uint8Array(buf.buffer));
  writeFileSync(join(nnOut, "shard-0.jsonl"), metas.map((m) => m + "\n").join(""));
  console.log(`学習用の局面 ${rows.length} 行を ${nnOut} に書いた`);
}
