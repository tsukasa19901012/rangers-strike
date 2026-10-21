import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { testEngine, testPlatform } from "../testing/engine";
import { HUMAN } from "../engineApi";
import { assistMove, DEFAULT_ASSIST, START_ORDERS, startOrder } from "./assist";
import type { ActionOption } from "../session/session";
import type { GameAction, GameState } from "../engineApi";

const WEB = { width: 1280, height: 720 };

function start(seed: number, autoAssist = true): AppController {
  const platform = testPlatform();
  const app = new AppController({ platform, viewport: WEB, cpuDelayFrames: 0, seed: () => seed, gui: true, defaults: { autoAssist } });
  app.dispatch(input.select(3, true));
  return app;
}

const opts = (actions: Partial<GameAction>[]): ActionOption[] =>
  actions.map((a) => ({ label: a.type!, action: { playerId: HUMAN, ...a } as GameAction }));

describe("assistMove", () => {
  const state = (phase: string, activePlayer = HUMAN) => ({ phase, activePlayer, winner: null }) as unknown as GameState;

  it("makes single bookkeeping moves and the start-phase steps", () => {
    expect(assistMove(state("rush"), opts([{ type: "end_phase" }]), DEFAULT_ASSIST)).toBe(0);
    expect(assistMove(state("start"), opts([{ type: "draw" }, { type: "release_start_commands" }]), DEFAULT_ASSIST)).toBe(1);
    expect(assistMove(state("rush"), opts([{ type: "cancel_command_payment" }, { type: "resolve_command_payment" }]), DEFAULT_ASSIST)).toBe(1);
  });

  it("leaves real choices to the player", () => {
    // Charging, a may-effect, two ways to pay, a return order and a bonus draw are choices.
    expect(assistMove(state("charge"), opts([{ type: "charge_power" }, { type: "end_phase" }]), DEFAULT_ASSIST)).toBeNull();
    expect(assistMove(state("battle"), opts([{ type: "resolve_effect_choice" }]), DEFAULT_ASSIST)).toBeNull();
    expect(assistMove(state("rush"), opts([{ type: "resolve_command_payment" }, { type: "resolve_command_payment" }, { type: "cancel_command_payment" }]), DEFAULT_ASSIST)).toBeNull();
    expect(assistMove(state("start"), opts([{ type: "return_all_battle_to_rush", instanceId: "a" } as Partial<GameAction>, { type: "draw" }]), DEFAULT_ASSIST)).toBeNull();
    expect(assistMove(state("start"), opts([{ type: "bonus_draw" }, { type: "skip_bonus_draw" }]), DEFAULT_ASSIST)).toBeNull();
    expect(assistMove(state("rush"), opts([{ type: "end_phase" }]), { autoStep: false, autoStart: false, autoPay: false })).toBeNull();
  });
});

describe("automatic moves in a match", () => {
  it("never waits for the human on a move with only one answer", () => {
    const app = start(5);
    for (let frame = 0; frame < 20000 && app.currentScreen === "match"; frame++) {
      const session = app.session!;
      if (session.turnOwner() === "human") {
        // Whatever the human is asked must be a real choice (or the GUI will make it within a few frames).
        const before = session.version;
        for (let i = 0; i < 13 && session.version === before; i++) app.tick();
        if (session.version !== before) continue;
        expect(assistMove(session.state, session.humanOptions(), DEFAULT_ASSIST)).toBeNull();
        app.endTurn();
        for (let i = 0; i < 400 && session.version === before; i++) app.tick();
        if (session.version === before) {
          // The end-turn button stops at real choices: take the first one.
          app.dispatch(input.allActions);
          app.dispatch(input.confirm);
        }
        continue;
      }
      app.tick();
    }
    expect(app.currentScreen).toBe("result");
  });

  it("asks for every step when assist is off", () => {
    const app = start(5, false);
    for (let frame = 0; frame < 2000 && app.session!.turnOwner() !== "human"; frame++) app.tick();
    const version = app.session!.version;
    for (let i = 0; i < 60; i++) app.tick();
    expect(app.session!.version).toBe(version);
  });

  it("moves a unit to the battle area when it is dropped there", () => {
    const app = start(5);
    let entered = "";
    for (let frame = 0; frame < 40000 && app.currentScreen === "match"; frame++) {
      const session = app.session!;
      const move = session.humanOptions().find((o) => o.action.type === "move_to_battle");
      if (session.turnOwner() === "human" && move) {
        const id = (move.action as { instanceId: string }).instanceId;
        app.dropCard(id, { zone: "player2:battle" });
        expect(session.state.players[HUMAN].battle.some((c) => c.instanceId === id)).toBe(false);
        app.dropCard(id, { zone: `${HUMAN}:battle` });
        expect(app.session!.state.players[HUMAN].battle.some((c) => c.instanceId === id)).toBe(true);
        return;
      }
      const charge = session.humanOptions().find((o) => o.action.type === "charge_command");
      if (session.turnOwner() === "human" && charge) {
        // A hand card dropped on the command area is charged there.
        const id = (charge.action as { instanceId: string }).instanceId;
        app.dropCard(id, { zone: `${HUMAN}:command` });
        expect(app.session!.state.players[HUMAN].command.some((c) => c.instanceId === id)).toBe(true);
        continue;
      }
      const entry = session.humanOptions().find((o) => o.action.type === "initiate_command_payment" && o.action.kind === "category_use");
      if (session.turnOwner() === "human" && entry && !entered) {
        // A unit from the hand dropped on the rush area enters it (the payment confirms on its own).
        const id = (entry.action as { sourceInstanceId: string }).sourceInstanceId;
        if (session.state.players[HUMAN].hand.some((c) => c.instanceId === id && session.state.definitions[c.cardId]?.type === "unit")) {
          entered = id;
          app.dropCard(id, { zone: `${HUMAN}:rush` });
          for (let i = 0; i < 40; i++) app.tick();
          continue;
        }
      }
      if (session.turnOwner() === "human") {
        app.endTurn();
        const before = session.version;
        for (let i = 0; i < 400 && session.version === before; i++) app.tick();
        if (session.version === before) {
          app.dispatch(input.allActions);
          app.dispatch(input.confirm);
        }
        continue;
      }
      app.tick();
    }
    throw new Error(`no move_to_battle came up (${testEngine.ALL_STARTER_DECK_IDS.length} decks)`);
  });
});

describe("bonus draw", () => {
  it("asks for the bonus draw in the selection window after the automatic draw", () => {
    const app = start(5);
    for (let frame = 0; frame < 20000; frame++) {
      const session = app.session!;
      if (session.turnOwner() === "human" && session.state.phase === "start" && session.state.turn > 2) {
        // Hand smaller than damage: the bonus draw becomes possible after the draw.
        const p = session.state.players[HUMAN];
        session.state = { ...session.state, players: { ...session.state.players, [HUMAN]: { ...p, damage: 5, hand: p.hand.slice(0, 1) } } };
        session.version++;
        for (let i = 0; i < 40; i++) app.tick();
        expect(session.humanOptions().map((o) => o.action.type).sort()).toEqual(["bonus_draw", "skip_bonus_draw"]);
        const dialog = app.view().gui!.dialog!;
        expect(dialog.titleLines[0]!.text).toContain("追加ドロー");
        expect(dialog.buttons.map((b) => b.text)).toEqual(expect.arrayContaining([expect.stringContaining("追加ドロー")]));
        return;
      }
      if (session.turnOwner() === "human") {
        app.endTurn();
        const before = session.version;
        for (let i = 0; i < 400 && session.version === before; i++) app.tick();
        if (session.version === before) {
          app.dispatch(input.allActions);
          app.dispatch(input.confirm);
        }
        continue;
      }
      app.tick();
    }
    throw new Error("no human start phase after turn 2");
  });
});

describe("start phase setting", () => {
  it("leaves the whole start phase to the player when it is off", () => {
    const off = { ...DEFAULT_ASSIST, autoStart: false };
    const state = { phase: "start", activePlayer: HUMAN, winner: null } as unknown as GameState;
    expect(assistMove(state, opts([{ type: "draw" }]), off)).toBeNull();
    expect(assistMove(state, opts([{ type: "draw" }, { type: "release_start_commands" }]), off)).toBeNull();
    // Other phases still run on their own.
    expect(assistMove({ ...state, phase: "rush" } as GameState, opts([{ type: "end_phase" }]), off)).toBe(0);
  });

  it("takes the start-phase steps in the chosen order", () => {
    const state = { phase: "start", activePlayer: HUMAN, winner: null } as unknown as GameState;
    const all = opts([{ type: "release_start_commands" }, { type: "return_all_battle_to_rush" }, { type: "draw" }]);
    expect(assistMove(state, all, DEFAULT_ASSIST)).toBe(0);
    expect(assistMove(state, all, { ...DEFAULT_ASSIST, startOrder: ["draw", "return_all_battle_to_rush", "release_start_commands"] })).toBe(2);
    expect(assistMove(state, all, { ...DEFAULT_ASSIST, startOrder: ["return_all_battle_to_rush", "draw", "release_start_commands"] })).toBe(1);
    // A saved order that is not a whole order falls back to the default.
    expect(startOrder(["draw", "draw"])).toEqual(START_ORDERS[0]);
    const app = new AppController({ platform: testPlatform(), viewport: WEB, gui: true });
    app.updateSettings({ startOrder: ["draw", "release_start_commands", "return_all_battle_to_rush"] });
    expect(app.matchSettings.startOrder).toEqual(["draw", "release_start_commands", "return_all_battle_to_rush"]);
  });

  it("is saved and applies to the match", () => {
    const platform = testPlatform();
    const app = new AppController({ platform, viewport: WEB, cpuDelayFrames: 0, seed: () => 5, gui: true });
    app.updateSettings({ autoStart: false });
    expect(app.matchSettings.autoStart).toBe(false);
    const again = new AppController({ platform, viewport: WEB, cpuDelayFrames: 0, seed: () => 5, gui: true });
    expect(again.matchSettings.autoStart).toBe(false);
    again.dispatch(input.select(3, true));
    for (let frame = 0; frame < 20000; frame++) {
      const session = again.session!;
      if (session.turnOwner() === "human" && session.state.phase === "start" && session.state.activePlayer === HUMAN) {
        const version = session.version;
        for (let i = 0; i < 60; i++) again.tick();
        // Nothing ran: the draw waits for the player.
        expect(session.version).toBe(version);
        expect(session.humanOptions().some((o) => o.action.type === "draw")).toBe(true);
        return;
      }
      if (session.turnOwner() === "human") {
        again.endTurn();
        const before = session.version;
        for (let i = 0; i < 400 && session.version === before; i++) again.tick();
        if (session.version === before) {
          again.dispatch(input.allActions);
          again.dispatch(input.confirm);
        }
        continue;
      }
      again.tick();
    }
    throw new Error("no human start phase");
  });
});
