import { describe, expect, it } from "vitest";
import { GameSession } from "./session";
import { HUMAN } from "../engineApi";
import { buildBoardView, buildPendingView } from "../view/board";
import { testEngine } from "../testing/engine";
import { buildGameRecord, parseGameRecord } from "../app/gameRecord";

function newSession(seed: number, lines: string[] = []) {
  let now = 0;
  return new GameSession({
    engine: testEngine,
    humanDeck: "abarenoh",
    cpuDeck: "dekaranger",
    seed,
    cpuLevel: 1,
    clock: () => (now += 2),
    log: (l) => lines.push(l),
    memory: { sample: () => ({ bytes: 1, kind: "estimate", label: "x" }) },
  });
}

describe("GameSession", () => {
  it("lists only the human's legal actions with Japanese labels", () => {
    const session = newSession(1);
    const owner = session.turnOwner();
    expect(owner).not.toBe("none");
    if (owner === "human") {
      const options = session.humanOptions();
      expect(options.length).toBeGreaterThan(0);
      for (const o of options) {
        expect((o.action as { playerId?: string }).playerId).toBe(HUMAN);
        expect(o.label).not.toMatch(/^[a-z_]+$/);
      }
    }
  });

  it("plays a full match (scripted human = first option) to a winner", () => {
    const lines: string[] = [];
    const session = newSession(3, lines);
    let sawPending = false;
    for (let step = 0; step < 6000 && !session.winner; step++) {
      if (buildPendingView(testEngine, session.state)) sawPending = true;
      const owner = session.turnOwner();
      if (owner === "human") {
        const options = session.humanOptions();
        // Prefer progress: first option that is not a cancel.
        const pick = Math.max(0, options.findIndex((o) => !o.action.type.startsWith("cancel_")));
        const r = session.chooseHuman(pick);
        if (!r.ok) session.chooseHuman((pick + 1) % options.length);
      } else if (owner === "cpu") {
        expect(session.cpuStep().ok).toBe(true);
      } else break;
    }
    expect(session.winner).not.toBeNull();
    expect(sawPending).toBe(true);
    expect(session.metrics.moves).toBeGreaterThan(0);
    expect(session.metrics.avgThinkMs).toBe(2);
    expect(session.log.length).toBeGreaterThan(10);
    expect(lines.some((l) => l.startsWith("match end"))).toBe(true);
    expect(buildBoardView(testEngine, session.state).header).toContain("勝利");

    // The game record (seed + decks + actions) replays the same match.
    const record = parseGameRecord(JSON.parse(JSON.stringify(buildGameRecord(session, 123))));
    expect(record).not.toBeNull();
    expect(record!.actions.length).toBeGreaterThan(session.metrics.moves);
    let state = testEngine.createStarterGame({ player1Starter: record!.humanDeck, player2Starter: record!.cpuDeck, seed: record!.seed });
    for (const action of record!.actions) {
      const r = testEngine.applyAction(state, action);
      expect(r.ok).toBe(true);
      if (r.ok) state = r.state;
    }
    expect(state.winner).toBe(record!.winner);
    expect(state.turn).toBe(record!.turns);
  });

  it("has no game record for an unfinished match or a loaded board", () => {
    const session = newSession(5);
    expect(buildGameRecord(session, 0)).toBeNull();
    session.loadState({ ...session.state, winner: HUMAN });
    expect(session.actions).toBeNull();
    expect(buildGameRecord(session, 0)).toBeNull();
    expect(parseGameRecord({ v: 1, seed: 1, actions: [] })).toBeNull();
  });
});

describe("「これをホールドして次の効果を発動できる」の選択（XG2-076【キバアロー】）", () => {
  it("offers the hold once, as 「ホールドして発動する」, without a 「コマンドを支払って使う（種類:効果）」 row (no command is paid)", async () => {
    const { getCardDefinition } = await import("@rangers-strike/cards");
    const session = newSession(1);
    const s = session.state;
    const kiba = { instanceId: "kiba-1", cardId: "XG2-076" };
    session.state = {
      ...s,
      phase: "battle",
      activePlayer: "player1",
      definitions: { ...s.definitions, "XG2-076": getCardDefinition("XG2-076")! },
      players: { ...s.players, player1: { ...s.players.player1, battle: [...s.players.player1.battle, kiba] } },
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "xg2_ffr_hold",
        sourceCardId: "XG2-076",
        sourceInstanceId: "kiba-1",
        kind: "select_command",
        commandAction: "hold",
        validInstanceIds: ["kiba-1"],
        selectCount: 1,
        optional: true,
        xg2Meta: { selfHold: true, decade: false },
      },
    } as typeof s;
    session.version++;
    // The engine offers the hold twice (pick, or an effect_hold payment); both hold キバ itself.
    expect(testEngine.getLegalActions(session.state).some((a) => a.type === "initiate_command_payment")).toBe(true);
    const options = session.humanOptions();
    expect(options.map((o) => o.label).sort()).toEqual(["ホールドして発動する", "発動しない"].sort());
    expect(options.some((o) => o.action.type === "initiate_command_payment")).toBe(false);
    const commands = session.state.players.player1.command.map((c) => c.instanceId);
    expect(session.chooseHuman(options.findIndex((o) => o.label === "ホールドして発動する")).ok).toBe(true);
    // キバ itself is held and its effect goes on to the opponent's pick; no command is held.
    expect(session.state.players.player1.battle.find((c) => c.instanceId === "kiba-1")?.commandHeld).toBe(true);
    expect(session.state.players.player1.command.filter((c) => c.commandHeld)).toEqual([]);
    expect(session.state.players.player1.command.map((c) => c.instanceId)).toEqual(commands);
  });
});
