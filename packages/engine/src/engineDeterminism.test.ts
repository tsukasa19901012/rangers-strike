/**
 * エンジンの決定性: 同じ種なら、何度・どの順で実行しても同じゲームになる。
 *
 * 乱数（山札のシャッフル・無作為な選択）はゲーム状態の rngState から作る（core/rng.ts）。
 * Math.random・時刻・ワーカーごとの状態に依存しないことを、Math.random を禁止して確かめる。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fullPlayableCatalog, type CardDefinition } from "@rangers-strike/cards";
import { applyAction, createGame, getLegalActions } from "./index";
import { createFullPromotedGame } from "./verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "./verticalSlice/playStarterMatch";
import type { GameState } from "./types/game";

const MAX_STEPS = 4_000;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RK_BK_POOL = fullPlayableCatalog.cards.filter(
  (c) => c.id.startsWith("RK-") || c.id.startsWith("BK-"),
);

function buildDeck(rng: () => number): CardDefinition[] {
  const pool = [...RK_BK_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const seen = new Set<string>();
  return pool.filter((c) => !seen.has(c.name) && seen.add(c.name)).slice(0, 40);
}

/** ゲームの比較用（定義表は除く）。 */
function snapshot(state: GameState): string {
  const { definitions: _defs, ...rest } = state;
  return JSON.stringify(rest);
}

/** 乱択の合法手でゲームを進め、行ったアクションの列と最終状態を返す。 */
function playRandomGame(seed: number): { trace: string[]; final: string } {
  const rng = mulberry32(seed);
  let state = createGame({
    player1Deck: buildDeck(rng),
    player2Deck: buildDeck(rng),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    rng,
  });
  const trace: string[] = [];
  for (let step = 0; step < MAX_STEPS && !state.winner; step += 1) {
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const action = actions[Math.floor(rng() * actions.length)]!;
    const result = applyAction(state, action);
    trace.push(`${JSON.stringify(action)}=>${result.ok ? "ok" : result.error}`);
    if (result.ok) state = result.state;
  }
  return { trace, final: snapshot(state) };
}

function playCpuGame(seed: number): string {
  const rng = mulberry32(seed);
  const initial = createFullPromotedGame({
    rng,
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    player1Deck: buildDeck(rng),
    player2Deck: buildDeck(rng),
  });
  return snapshot(playStarterMatchUntilEnd(initial, { maxSteps: MAX_STEPS }).state);
}

/** ゲーム中の Math.random を禁止する（エンジンの乱数はすべて rngState から作る）。 */
function forbidMathRandom() {
  vi.spyOn(Math, "random").mockImplementation(() => {
    throw new Error("Math.random used inside the engine");
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("engine determinism (seeded RNG in GameState.rngState)", () => {
  it("createGame stores a seed and is reproducible", () => {
    const decks = buildDeck(mulberry32(1));
    const a = createGame({ player1Deck: decks, player2Deck: decks, seed: 1234 });
    const b = createGame({ player1Deck: decks, player2Deck: decks, seed: 1234 });
    expect(a.rngState).toBe(1234);
    expect(snapshot(a)).toBe(snapshot(b));
    const c = createGame({ player1Deck: decks, player2Deck: decks, rng: mulberry32(7) });
    const d = createGame({ player1Deck: decks, player2Deck: decks, rng: mulberry32(7) });
    expect(typeof c.rngState).toBe("number");
    expect(snapshot(c)).toBe(snapshot(d));
  });

  it("random-action games give identical traces across repeated runs (and no Math.random)", () => {
    forbidMathRandom();
    const seeds = [34, 7, 34, 12, 7];
    const runs = seeds.map((seed) => ({ seed, ...playRandomGame(seed) }));
    for (const seed of new Set(seeds)) {
      const same = runs.filter((r) => r.seed === seed);
      for (const r of same.slice(1)) {
        expect(r.trace).toEqual(same[0]!.trace);
        expect(r.final).toBe(same[0]!.final);
      }
    }
  }, 120_000);

  it("CPU games give identical results across repeated runs (and no Math.random)", () => {
    forbidMathRandom();
    const first = playCpuGame(34);
    playCpuGame(3);
    expect(playCpuGame(34)).toBe(first);
  }, 120_000);

  it("applyAction is pure: the same state and action always give the same result", () => {
    const { trace } = playRandomGame(34);
    expect(trace.length).toBeGreaterThan(0);
    const rng = mulberry32(5);
    let state = createGame({
      player1Deck: buildDeck(rng),
      player2Deck: buildDeck(rng),
      rng,
    });
    for (let step = 0; step < 300 && !state.winner; step += 1) {
      const actions = getLegalActions(state);
      if (actions.length === 0) break;
      const action = actions[Math.floor(rng() * actions.length)]!;
      const a = applyAction(state, action);
      const b = applyAction(state, action);
      expect(a.ok).toBe(b.ok);
      if (a.ok && b.ok) {
        expect(snapshot(a.state)).toBe(snapshot(b.state));
        state = a.state;
      }
    }
  }, 120_000);
});
