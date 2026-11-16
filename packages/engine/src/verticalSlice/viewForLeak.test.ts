/**
 * 対人戦の「自分から見える盤面」（view/viewFor.ts）の漏れ検査。CPU 同士で対戦させ、毎手の後に両プレイヤーの
 * 表示を作り、相手の手札・山札・ウラ向きのカード・本物のカード ID・乱数の状態が入っていないこと、
 * 合法手が本物の操作に戻せることを確かめる（view/viewChecks.ts checkView）。ログに、見えていないカードの番号・本物の ID・名前が出ないことも見る。
 * もう1つは、両プレイヤーが自分の表示の合法手だけを見て（無作為に）選び、最後まで止まらずに遊べること。
 */
import { describe, expect, it } from "vitest";
import { arenaDeck, arenaDeckIds } from "../../scripts/arenaDecks";
import { createGameForDecks } from "../core/createGame";
import { applyAction } from "../core/applyAction";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { pickCpuAction } from "../ai/index";
import type { GameState, PlayerId } from "../types/game";
import { checkView } from "../view/viewChecks";
import { createIdAliasTable, redactNewLogLines, resolveViewAction, viewFor, visibleCardIds, type IdAliasTable } from "../view/viewFor";
import { ALL_STARTER_DECK_IDS } from "./index";
import { createStarterGame } from "./createStarterGame";

const MAX_STEPS = 3_000;

/** 長い同期処理の途中で vitest のワーカーに通信の機会を与える（ないと「Timeout calling onTaskUpdate」になる）。 */
const yieldToWorker = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const PLAYERS: PlayerId[] = ["player1", "player2"];

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

function aliasMaker(rand: () => number) {
  return () => Math.floor(rand() * 2 ** 40).toString(36);
}

function starterGame(g: number): GameState {
  const ids = ALL_STARTER_DECK_IDS as readonly string[];
  return createStarterGame({ player1Starter: ids[g % ids.length] as never, player2Starter: ids[(g * 7 + 3) % ids.length] as never, seed: 300 + g });
}

function arenaGame(g: number): GameState {
  const ids = arenaDeckIds();
  return createGameForDecks(arenaDeck(ids[(g * 37) % ids.length]!)!, arenaDeck(ids[(g * 53 + 11) % ids.length]!)!, { seed: 900 + g });
}

/** CPU 同士で1試合。毎手の後に両者の表示を調べる。 */
async function sweep(start: GameState, seed: number): Promise<{ steps: number; problems: string[] }> {
  const tables: Record<PlayerId, IdAliasTable> = { player1: createIdAliasTable(), player2: createIdAliasTable() };
  const newAlias = aliasMaker(mulberry32(seed));
  const problems: string[] = [];
  let state = start;
  const poolIds = new Set(PLAYERS.flatMap((p) => [...start.players[p].deck, ...start.players[p].hand].map((c) => c.cardId)));
  let steps = 0;
  for (; steps < MAX_STEPS && !state.winner; steps++) {
    if (steps % 100 === 0) await yieldToWorker();
    const actor = getActionPlayerId(state);
    const legal = getLegalActions(state);
    for (const viewer of PLAYERS) {
      const view = viewFor(state, viewer, { aliases: tables[viewer], newAliasBody: newAlias });
      for (const p of checkView(state, viewer, view, tables[viewer], viewer === actor ? legal : undefined)) {
        problems.push(`step ${steps} ${viewer}: ${p}`);
      }
    }
    const action = pickCpuAction(state, actor, 1) ?? legal[0];
    if (!action) break;
    const result = applyAction(state, action);
    if (!result.ok) break; // CPU の選んだ手が通らないのは別の不具合（この検査の対象外）
    for (const viewer of PLAYERS) {
      const seen = new Set([...visibleCardIds(state, viewer), ...visibleCardIds(result.state, viewer)]);
      for (const line of redactNewLogLines(state, result.state, viewer)) {
        const realId = line.match(/[A-Za-z]{1,4}\d?-\d{3}-\d+/);
        if (realId && result.state.definitions[realId[0].replace(/-\d+$/, "")]) problems.push(`step ${steps} ${viewer}: log shows real id ${realId[0]}: ${line}`);
        for (const id of line.match(/[A-Za-z]{1,4}\d?-\d{3}/g) ?? []) {
          if (result.state.definitions[id] && !seen.has(id)) problems.push(`step ${steps} ${viewer}: log shows ${id}: ${line}`);
        }
        // 番号がなくても、一度も見えていないカードの名前が出ていたら漏れ（見えるカードの名前の一部は除く）。
        const seenNames = [...seen].map((id) => result.state.definitions[id]?.name ?? "").filter(Boolean);
        const masked = seenNames.sort((a, b) => b.length - a.length).reduce((text, name) => text.split(name).join("\u0001"), line);
        for (const id of poolIds) {
          const name = result.state.definitions[id]?.name;
          if (!name || name.length < 2 || seen.has(id) || seenNames.includes(name)) continue;
          if (masked.includes(name)) problems.push(`step ${steps} ${viewer}: log shows the name ${name}: ${line}`);
        }
      }
    }
    state = result.state;
    if (problems.length > 20) break;
  }
  return { steps, problems };
}

const GAMES = Array.from({ length: 10 }, (_, g) => g);

describe("viewFor の漏れ検査（CPU 同士の対戦）", () => {
  it.each(GAMES)("スターター同士の試合 %i で、見えてはいけない情報が表示に出ない", async (g) => {
    const result = await sweep(starterGame(g), g);
    expect(result.problems).toEqual([]);
    expect(result.steps).toBeGreaterThan(100);
  }, 120_000);

  it.each(GAMES)("ブログ・大会デッキ同士の試合 %i で、見えてはいけない情報が表示に出ない", async (g) => {
    const result = await sweep(arenaGame(g), 100 + g);
    expect(result.problems).toEqual([]);
    expect(result.steps).toBeGreaterThan(100);
  }, 120_000);
});

describe("表示だけで最後まで遊べる", () => {
  it.each([0, 1, 2, 3, 4, 5])("試合 %i: 両者が自分の表示の合法手だけから選んで、止まらずに対戦が進む", async (g) => {
    {
      const rand = mulberry32(5000 + g);
      const newAlias = aliasMaker(rand);
      const tables: Record<PlayerId, IdAliasTable> = { player1: createIdAliasTable(), player2: createIdAliasTable() };
      let state = g % 2 === 0 ? starterGame(40 + g) : arenaGame(40 + g);
      let steps = 0;
      for (; steps < MAX_STEPS && !state.winner; steps++) {
        if (steps % 100 === 0) await yieldToWorker();
        const actor = getActionPlayerId(state);
        const view = viewFor(state, actor, { aliases: tables[actor], newAliasBody: newAlias });
        expect(view.legalActions.length, `game ${g} step ${steps}: no legal action for ${actor}`).toBeGreaterThan(0);
        const picked = view.legalActions[Math.floor(rand() * view.legalActions.length)]!;
        const action = resolveViewAction(JSON.parse(JSON.stringify(picked)), tables[actor]);
        expect(action, `game ${g} step ${steps}: ${JSON.stringify(picked)}`).not.toBeNull();
        const result = applyAction(state, action!);
        if (!result.ok) {
          // 本物の盤面の合法手でも通らない手は、表示の問題ではない（エンジンの別の不具合）。
          const real = getLegalActions(state).find((a) => JSON.stringify(a) === JSON.stringify(action));
          expect(real, `game ${g} step ${steps}: ${result.error}`).toBeDefined();
          break;
        }
        state = result.state;
      }
      expect(steps, `game ${g}`).toBeGreaterThan(50);
    }
  }, 120_000);
});
