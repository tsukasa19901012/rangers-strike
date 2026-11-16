// 対人戦の画面用の盤面（remoteView.ts）: player1 と player2 の入れ替え、見えるカードを山札・手札に戻すこと。
// 入れ替えた盤面でもエンジンが同じように動くこと（合法手・操作の結果が入れ替えたものと一致すること）を、
// CPU 同士の対戦の毎手で確かめる。
import { describe, expect, it } from "vitest";
import * as engine from "@rangers-strike/engine";
import { deckLookChoice } from "../../../engine/src/rules/deckLook";
import type { GameAction, GameState, PlayerId } from "../engineApi";
import { materializeView, screenActions, screenState, serverAction, swapPlayers, type RemotePlayerView } from "./remoteView";

const yieldToWorker = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const board = (state: GameState) => {
  const { definitions: _d, ...rest } = state;
  return rest;
};

function starter(seed: number): GameState {
  const ids = engine.ALL_STARTER_DECK_IDS as readonly string[];
  return engine.createStarterGame({
    player1Starter: ids[seed % ids.length] as never,
    player2Starter: ids[(seed * 7 + 3) % ids.length] as never,
    seed: 400 + seed,
  });
}

describe("swapPlayers", () => {
  it("2回入れ替えると元に戻り、キーの並びも変わらない", () => {
    const state = starter(1);
    const twice = swapPlayers(swapPlayers(state));
    expect(JSON.stringify(twice)).toBe(JSON.stringify(state));
    const once = swapPlayers(state);
    expect(Object.keys(once.players)).toEqual(Object.keys(state.players));
    expect(once.players.player1).toEqual(swapPlayers(state.players.player2));
    expect(once.definitions).toBe(state.definitions);
    expect(swapPlayers(["player1|draw", "phase:rush->battle", { "player2:rush": "player1" }])).toEqual([
      "player2|draw",
      "phase:rush->battle",
      { "player1:rush": "player2" },
    ]);
  });

  it.each([0, 1, 2, 3])("試合 %i: 入れ替えた盤面でも、合法手と操作の結果が入れ替えたものと同じ（エンジンは左右対称）", async (g) => {
    let state = starter(g);
    for (let step = 0; step < 600 && !state.winner; step++) {
      if (step % 50 === 0) await yieldToWorker();
      const swapped = swapPlayers(state);
      const legal = engine.getLegalActions(state);
      expect(canonical(engine.getLegalActions(swapped)), `game ${g} step ${step} legal`).toBe(canonical(swapPlayers(legal)));
      expect(engine.getActionPlayerId(swapped)).toBe(engine.getActionPlayerId(state) === "player1" ? "player2" : "player1");
      const actor = engine.getActionPlayerId(state);
      const action = (engine.pickCpuAction(state, actor, 1) ?? legal[0]) as GameAction | undefined;
      if (!action) break;
      const result = engine.applyAction(state, action);
      const mirrored = engine.applyAction(swapped, swapPlayers(action));
      expect(mirrored.ok, `game ${g} step ${step}`).toBe(result.ok);
      if (!result.ok || !mirrored.ok) break;
      if (step % 5 === 0) {
        expect(canonical(board(mirrored.state)), `game ${g} step ${step} ${action.type}`).toBe(canonical(board(swapPlayers(result.state))));
      }
      for (const p of ["player1", "player2"] as PlayerId[]) {
        const q: PlayerId = p === "player1" ? "player2" : "player1";
        expect(engine.countAvailablePower(mirrored.state, q), `game ${g} step ${step} power`).toBe(engine.countAvailablePower(result.state, p));
      }
      state = result.state;
    }
  }, 120_000);
});

describe("materializeView", () => {
  function deckLookView(): { view: RemotePlayerView; real: GameState } {
    const real = starter(5);
    const tables = engine.createIdAliasTable();
    let n = 0;
    const choice = deckLookChoice(real, { playerId: "player2", phasePlayerId: "player2" }, "XG1-076")!;
    const looking: GameState = { ...real, pendingEffectChoice: choice };
    const view = engine.viewFor(looking, "player2", { aliases: tables, newAliasBody: () => `a${n++}` });
    return { view: view as unknown as RemotePlayerView, real: looking };
  }

  it("山札で見えているカードを山札に戻し、枚数は変えない", () => {
    const { view, real } = deckLookView();
    expect(view.revealedCards.length).toBe(real.players.player2.deck.length);
    const state = materializeView(view);
    expect(state.players.player2.deck).toHaveLength(real.players.player2.deck.length);
    expect(state.players.player2.deck.map((c) => c.instanceId).sort()).toEqual(view.revealedCards.map((c) => c.instanceId).sort());
    expect(state.players.player1.deck.every((c) => c.cardId === "?")).toBe(true);
    // 元の表示は変えない
    expect(view.state.players.player2.deck.every((c) => c.cardId === "?")).toBe(true);
  });

  it("player2 の画面では自分が player1 になり、操作は送る前に戻す", () => {
    const { view } = deckLookView();
    const state = screenState(view);
    expect(state.players.player1.deck.map((c) => c.instanceId).sort()).toEqual(view.revealedCards.map((c) => c.instanceId).sort());
    expect(state.pendingEffectChoice?.playerId).toBe("player1");
    const actions = screenActions(view);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => (a as { playerId?: string }).playerId === "player1")).toBe(true);
    expect(actions.map((a) => serverAction("player2", a))).toEqual(view.legalActions);
    expect(serverAction("player1", actions[0]!)).toBe(actions[0]);
  });
});
