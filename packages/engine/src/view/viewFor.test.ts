/**
 * 対人戦の「自分から見える盤面」（viewFor）。相手の手札・山札・ウラ向きのカード・乱数の状態・本物のカード ID が
 * 渡らないこと、操作が別 ID から本物に戻せること、ログの伏せ字を確かめる。
 * CPU 同士の対戦全体での漏れ検査は src/verticalSlice/viewForLeak.test.ts（test:sim）。
 */
import { describe, expect, it } from "vitest";
import { applyAction, getActionPlayerId, getLegalActions, pickCpuAction } from "../index";
import { deckLookChoice } from "../rules/deckLook";
import type { GameState, PlayerId } from "../types/game";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import { checkView } from "./viewChecks";
import {
  createIdAliasTable,
  HIDDEN_CARD_ID,
  HIDDEN_INSTANCE_ID,
  redactNewLogLines,
  resolveViewAction,
  viewFor,
  type IdAliasTable,
} from "./viewFor";

function counter() {
  let n = 0;
  return () => (n++).toString(36);
}

function newTables(): Record<PlayerId, IdAliasTable> {
  return { player1: createIdAliasTable(), player2: createIdAliasTable() };
}

function game(seed = 7): GameState {
  return createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed });
}

describe("viewFor", () => {
  it("相手の手札と山札は枚数だけ、自分の手札は中身が見える", () => {
    const state = game();
    const tables = newTables();
    const view = viewFor(state, "player2", { aliases: tables.player2, newAliasBody: counter() });
    const enemy = view.state.players.player1;
    expect(enemy.hand).toHaveLength(state.players.player1.hand.length);
    expect(enemy.hand.every((c) => c.cardId === HIDDEN_CARD_ID)).toBe(true);
    expect(enemy.deck).toHaveLength(state.players.player1.deck.length);
    expect(enemy.deck.every((c) => c.cardId === HIDDEN_CARD_ID)).toBe(true);
    const own = view.state.players.player2;
    expect(own.hand.map((c) => c.cardId)).toEqual(state.players.player2.hand.map((c) => c.cardId));
    expect(own.hand.every((c) => c.instanceId.startsWith("~"))).toBe(true);
    expect(own.deck.every((c) => c.cardId === HIDDEN_CARD_ID)).toBe(true);
    expect(view.revealedCards).toEqual([]);
    expect(checkView(state, "player2", view, tables.player2)).toEqual([]);
  });

  it("乱数の状態を渡さず、カード定義は見えるカードの分だけ渡す", () => {
    const state = game();
    const view = viewFor(state, "player1", { aliases: createIdAliasTable(), newAliasBody: counter() });
    expect(state.rngState).toBeTypeOf("number");
    expect("rngState" in view.state).toBe(false);
    const onlyInEnemyHand = state.players.player2.hand
      .map((c) => c.cardId)
      .filter((id) => !state.players.player1.hand.some((c) => c.cardId === id));
    for (const id of onlyInEnemyHand) expect(view.state.definitions[id]).toBeUndefined();
    for (const card of state.players.player1.hand) expect(view.state.definitions[card.cardId]).toBeDefined();
  });

  it("同じカードの別 ID は対戦中ずっと同じで、プレイヤーごとに違う", () => {
    const state = game();
    const tables = newTables();
    const next = counter();
    const a = viewFor(state, "player1", { aliases: tables.player1, newAliasBody: next });
    const b = viewFor(state, "player1", { aliases: tables.player1, newAliasBody: next });
    expect(b.state.players.player1.hand.map((c) => c.instanceId)).toEqual(a.state.players.player1.hand.map((c) => c.instanceId));
    const real = state.players.player1.hand[0]!.instanceId;
    expect(tables.player2.toAlias[real]).toBeUndefined();
  });

  it("ウラ向きのパワー（ダメージ）は持ち主にも見えない", () => {
    const state = game();
    const card = state.players.player1.hand[0]!;
    const damaged: GameState = {
      ...state,
      players: {
        ...state.players,
        player1: { ...state.players.player1, hand: state.players.player1.hand.slice(1), power: [{ ...card, faceDown: true }] },
      },
    };
    for (const viewer of ["player1", "player2"] as const) {
      const view = viewFor(damaged, viewer, { aliases: createIdAliasTable(), newAliasBody: counter() });
      expect(view.state.players.player1.power).toEqual([{ instanceId: expect.stringMatching(/^\?\d+$/), cardId: HIDDEN_CARD_ID, faceDown: true }]);
    }
  });

  it("「山札を見て」の中身は選ぶ本人にだけ、カード番号順で見え、山札の並びは見えない", () => {
    const state = game();
    const choice = deckLookChoice(state, { playerId: "player1", phasePlayerId: "player1" }, "XG1-076")!;
    const looking: GameState = { ...state, pendingEffectChoice: choice };
    expect(getActionPlayerId(looking)).toBe("player1");
    const tables = newTables();

    const own = viewFor(looking, "player1", { aliases: tables.player1, newAliasBody: counter() });
    const deckCardIds = state.players.player1.deck.map((c) => c.cardId);
    expect(own.revealedCards.map((c) => c.cardId)).toEqual([...deckCardIds].sort());
    expect(own.state.players.player1.deck.every((c) => c.cardId === HIDDEN_CARD_ID)).toBe(true);
    expect(own.state.pendingEffectChoice?.deckLookInstanceIds).toEqual(own.revealedCards.map((c) => c.instanceId));
    expect(checkView(looking, "player1", own, tables.player1, getLegalActions(looking))).toEqual([]);

    const enemy = viewFor(looking, "player2", { aliases: tables.player2, newAliasBody: counter() });
    expect(enemy.revealedCards).toEqual([]);
    expect(enemy.legalActions).toEqual([]);
    expect(enemy.state.pendingEffectChoice?.deckLookInstanceIds?.every((id) => id === HIDDEN_INSTANCE_ID)).toBe(true);
    expect(checkView(looking, "player2", enemy, tables.player2)).toEqual([]);
  });

  it("合法手は操作番のプレイヤーにだけ別 ID で渡り、本物の操作に戻せる", () => {
    let state = game(11);
    const tables = newTables();
    const next = counter();
    for (let i = 0; i < 120 && !state.winner; i++) {
      const actor = getActionPlayerId(state);
      const legal = getLegalActions(state);
      for (const viewer of ["player1", "player2"] as const) {
        const view = viewFor(state, viewer, { aliases: tables[viewer], newAliasBody: next });
        expect(view.actionPlayerId).toBe(actor);
        if (viewer !== actor) expect(view.legalActions).toEqual([]);
        expect(checkView(state, viewer, view, tables[viewer], viewer === actor ? legal : undefined)).toEqual([]);
      }
      const action = pickCpuAction(state, actor, 1) ?? legal[0];
      if (!action) break;
      const result = applyAction(state, action);
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
  });

  it("知らない別 ID・見えないカード・本物の ID を指す操作は戻せない", () => {
    const state = game();
    const aliases = createIdAliasTable();
    const view = viewFor(state, "player1", { aliases, newAliasBody: counter() });
    const alias = view.state.players.player1.hand[0]!.instanceId;
    const real = state.players.player1.hand[0]!.instanceId;
    expect(resolveViewAction({ type: "charge_power", playerId: "player1", instanceId: alias }, aliases)).toEqual({
      type: "charge_power",
      playerId: "player1",
      instanceId: real,
    });
    expect(resolveViewAction({ type: "charge_power", playerId: "player1", instanceId: "~zzzz" }, aliases)).toBeNull();
    expect(resolveViewAction({ type: "charge_power", playerId: "player1", instanceId: HIDDEN_INSTANCE_ID }, aliases)).toBeNull();
    expect(resolveViewAction({ type: "charge_power", playerId: "player1", instanceId: real }, aliases)).toBeNull();
    expect(resolveViewAction({ type: "charge_power", playerId: "player1", instanceId: `pick:${real}` }, aliases)).toBeNull();
    expect(resolveViewAction({ type: "x", playerId: "player1", option: `pick:${alias}` }, aliases)).toEqual({ type: "x", playerId: "player1", option: `pick:${real}` });
    expect(resolveViewAction("charge_power", aliases)).toBeNull();
  });
});

describe("checkView（漏れ検査そのもの）", () => {
  it("相手の手札の中身・本物の ID・乱数の状態が表示に入っていたら見つける", () => {
    const state = game();
    const aliases = createIdAliasTable();
    const view = viewFor(state, "player2", { aliases, newAliasBody: counter() });
    const leakedHand = structuredClone(view);
    leakedHand.state.players.player1.hand[0] = { ...state.players.player1.hand[0]! };
    expect(checkView(state, "player2", leakedHand, aliases).join("\n")).toMatch(/real instance id|opponent hand card/);
    const leakedRng = structuredClone(view);
    (leakedRng.state as GameState).rngState = 1;
    expect(checkView(state, "player2", leakedRng, aliases)).toContain("rngState in the view");
    const leakedName = structuredClone(view);
    (leakedName.state as unknown as Record<string, unknown>).note = state.players.player1.hand.find(
      (c) => !state.players.player2.hand.some((e) => e.cardId === c.cardId),
    )!.cardId;
    expect(checkView(state, "player2", leakedName, aliases).join("\n")).toMatch(/hidden card id/);
  });
});

describe("redactNewLogLines", () => {
  it("相手にだけ見えているカードの番号と名前を伏せる", () => {
    const before = game();
    const card = before.players.player1.hand.find((c) => !before.players.player2.hand.some((e) => e.cardId === c.cardId))!;
    const name = before.definitions[card.cardId]!.name;
    const line = `player1|named_effect|RS-000|x|「${name}」(${card.instanceId})を手札に加えた`.replace("RS-000|x", `${card.cardId}|${name}`);
    const after: GameState = { ...before, log: [...before.log, line] };

    const forOwner = redactNewLogLines(before, after, "player1");
    expect(forOwner).toEqual([line]);
    const forEnemy = redactNewLogLines(before, after, "player2");
    expect(forEnemy[0]).not.toContain(card.cardId);
    expect(forEnemy[0]).not.toContain(name);
    expect(forEnemy[0]).toContain("player1|named_effect|?|？|");
  });

  it("場に出たカードは、出る前は手札でも伏せない", () => {
    const before = game();
    const card = before.players.player1.hand[0]!;
    const after: GameState = {
      ...before,
      players: {
        ...before.players,
        player1: { ...before.players.player1, hand: before.players.player1.hand.slice(1), rush: [card] },
      },
      log: [...before.log, `player1|rush|${card.cardId}|${before.definitions[card.cardId]!.name}`],
    };
    expect(redactNewLogLines(before, after, "player2")).toEqual([`player1|rush|${card.cardId}|${before.definitions[card.cardId]!.name}`]);
  });
});
