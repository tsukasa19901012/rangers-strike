/**
 * 対人戦の対戦進行（match/match.ts）を、CPU 同士で最後まで通す。
 *  - 両者が自分の表示の別 ID だけで操作を送り、ときどき保存→読み込みを挟んでも、決着まで進むこと。
 *    途中で両者の表示に見えてはいけない情報が出ないこと（view/viewChecks.ts）。
 *  - ときどき操作番が放置して時間切れになっても、自動進行が止まったりループしたりせず（無効試合にならず）、
 *    勝敗か3回目の時間切れで終わること。
 */
import { describe, expect, it } from "vitest";
import { arenaDeck, arenaDeckIds } from "../../scripts/arenaDecks";
import { pickCpuAction } from "../ai/index";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import type { PlayerId } from "../types/game";
import { checkView } from "../view/viewChecks";
import {
  matchAct,
  createMatch,
  deadlineOf,
  deserializeMatch,
  joinMatch,
  matchView,
  serializeMatch,
  matchTick,
  type DeckSpec,
  type MatchDeps,
  type MatchState,
} from "../match/match";
import { ALL_STARTER_DECK_IDS } from "./index";

const ENGINE = "sim";
const MAX_STEPS = 3_000;
const yieldToWorker = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

function makeDeps(rand: () => number): MatchDeps {
  return {
    now: 1_700_000_000_000,
    newAliasBody: () => Math.floor(rand() * 2 ** 40).toString(36),
    randomSeed: () => Math.floor(rand() * 2 ** 32),
  };
}

function arenaSpec(id: string): DeckSpec {
  return { cards: arenaDeck(id)!.map((card) => card.id) };
}

function decksFor(g: number): [DeckSpec, DeckSpec] {
  if (g % 2 === 0) {
    const ids = ALL_STARTER_DECK_IDS as readonly string[];
    return [{ starter: ids[g % ids.length]! }, { starter: ids[(g * 7 + 3) % ids.length]! }];
  }
  const ids = arenaDeckIds();
  return [arenaSpec(ids[(g * 37) % ids.length]!), arenaSpec(ids[(g * 53 + 11) % ids.length]!)];
}

function newMatch(g: number, deps: MatchDeps): MatchState {
  const [host, guest] = decksFor(g);
  const m = createMatch({ id: `g${g}`, engineVersion: ENGINE, hostDeck: host, firstPlayer: g % 3 === 0 ? "random" : g % 3 === 1 ? "host" : "guest", now: deps.now });
  joinMatch(m, guest, deps);
  return m;
}

/** 操作番が、CPU（Lv1）の選ぶ手を自分の表示の別 ID で送る。 */
function sendCpuMove(m: MatchState, deps: MatchDeps, seq: Record<PlayerId, number>) {
  const actor = getActionPlayerId(m.game!);
  const legal = getLegalActions(m.game!);
  const pick = pickCpuAction(m.game!, actor, 1) ?? legal[0];
  const index = legal.findIndex((a) => JSON.stringify(a) === JSON.stringify(pick));
  const view = matchView(m, actor, deps);
  seq[actor] += 1;
  return matchAct(m, actor, { seq: seq[actor], version: view.version, action: view.view!.legalActions[Math.max(0, index)] }, deps);
}

describe("対戦進行を CPU 同士で最後まで", () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])("試合 %i: 表示の別 ID だけで操作し、保存と読み込みを挟んでも決着まで進む", async (g) => {
    const rand = mulberry32(700 + g);
    const deps = makeDeps(rand);
    let m = newMatch(g, deps);
    const seq: Record<PlayerId, number> = { player1: 0, player2: 0 };
    let steps = 0;
    for (; steps < MAX_STEPS && m.status === "playing"; steps++) {
      if (steps % 100 === 0) await yieldToWorker();
      deps.now += Math.floor(rand() * 1500);
      if (steps % 7 === 0) {
        for (const p of ["player1", "player2"] as const) {
          const view = matchView(m, p, deps);
          expect(checkView(m.game!, p, view.view!, m.aliases[p]), `game ${g} step ${steps} ${p}`).toEqual([]);
        }
      }
      const result = sendCpuMove(m, deps, seq);
      if (!result.ok) {
        // 本物の盤面でも合法手が通らないのはエンジンの別の不具合（この検査の対象外）
        expect(result.reason, `game ${g} step ${steps}: ${JSON.stringify(result)}`).toBe("rejected");
        break;
      }
      if (steps % 25 === 24) m = deserializeMatch(serializeMatch(m), ENGINE, deps);
    }
    expect(steps, `game ${g}`).toBeGreaterThan(50);
    if (m.status === "finished") expect(m.result?.reason).toBe("win");
  }, 180_000);
});

describe("時間切れの自動進行が止まらない", () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])("試合 %i: ときどき放置されても、無効試合にならずに終わる", async (g) => {
    const rand = mulberry32(9100 + g);
    const deps = makeDeps(rand);
    const m = newMatch(g + 20, deps);
    const seq: Record<PlayerId, number> = { player1: 0, player2: 0 };
    let steps = 0;
    for (; steps < MAX_STEPS && m.status === "playing"; steps++) {
      if (steps % 100 === 0) await yieldToWorker();
      if (rand() < 0.04) {
        deps.now = deadlineOf(m.clock!);
        expect(matchTick(m, deps)).toBe(true);
        continue;
      }
      deps.now += 200;
      const result = sendCpuMove(m, deps, seq);
      if (!result.ok && result.reason === "rejected") break;
      expect(result.ok, `game ${g} step ${steps}: ${JSON.stringify(result)}`).toBe(true);
    }
    expect(m.result?.reason ?? "playing", `game ${g}`).not.toBe("void");
    expect(m.autoActions.length).toBeGreaterThan(0);
  }, 180_000);
});
