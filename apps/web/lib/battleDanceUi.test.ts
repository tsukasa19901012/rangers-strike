import { describe, expect, it } from "vitest";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@rangers-strike/engine";
import { applyAction, getLegalActions } from "@rangers-strike/engine";
import {
  explainBattleDanceUnavailable,
  findBattleDanceAction,
  listBattleDanceReleasedCommandIds,
  listBattleDanceTargetsForCommands,
} from "./battleDanceUi";

const ALL_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries(
  allCardsCatalog.cards.map((card) => [card.id, card]),
);

function inst(cardId: string, suffix: string): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId };
}

function emptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    damage: 0,
  };
}

function makeState(options: {
  phase?: GameState["phase"];
  player1?: Partial<PlayerState>;
}): GameState {
  return {
    turn: 1,
    activePlayer: "player1",
    firstPlayer: "player1",
    phase: options.phase ?? "battle",
    players: {
      player1: { ...emptyPlayer("player1"), ...options.player1 },
      player2: emptyPlayer("player2"),
    },
    definitions: ALL_DEFINITIONS,
    log: [],
    winner: null,
  };
}

describe("battleDanceUi", () => {
  it("lists released commands in command zone", () => {
    const state = makeState({
      player1: {
        operation: [inst("RS-003", "op1")],
        command: [
          { ...inst("RS-007", "c1"), commandHeld: false },
          { ...inst("RS-008", "c2"), commandHeld: true },
        ],
      },
    });

    expect(listBattleDanceReleasedCommandIds(state, "player1")).toEqual([
      inst("RS-007", "c1").instanceId,
    ]);
  });

  it("explains missing released commands", () => {
    const state = makeState({
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [inst("RS-063", "battle1")],
        command: [{ ...inst("RS-007", "c1"), commandHeld: false }],
      },
    });

    expect(explainBattleDanceUnavailable(state, "player1")).toContain("リリース");
  });

  it("maps command pair to battle targets via legal actions", () => {
    const sUnit = inst("RS-063", "battle1");
    const cmdA = inst("RS-007", "c1");
    const cmdB = inst("RS-008", "c2");
    const state = makeState({
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [sUnit],
        command: [
          { ...cmdA, commandHeld: false },
          { ...cmdB, commandHeld: false },
        ],
      },
    });

    const legalActions = getLegalActions(state);
    const pair = [cmdA.instanceId, cmdB.instanceId] as [string, string];
    expect(listBattleDanceTargetsForCommands(legalActions, pair)).toEqual([sUnit.instanceId]);
    expect(findBattleDanceAction(legalActions, pair, sUnit.instanceId)).toBeDefined();
  });
});

describe("Web UI integration — RS-003 battle dance", () => {
  it("holds two released commands and retreats an S unit", () => {
    const sUnit = inst("RS-063", "battle1");
    const cmdA = inst("RS-007", "c1");
    const cmdB = inst("RS-008", "c2");
    const state = makeState({
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [sUnit],
        rush: [],
        command: [
          { ...cmdA, commandHeld: false },
          { ...cmdB, commandHeld: false },
        ],
      },
    });

    const legalActions = getLegalActions(state);
    const pair = [cmdA.instanceId, cmdB.instanceId] as [string, string];
    const action = findBattleDanceAction(legalActions, pair, sUnit.instanceId);
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const player = result.state.players.player1;
    expect(player.command.find((c) => c.instanceId === cmdA.instanceId)?.commandHeld).toBe(true);
    expect(player.command.find((c) => c.instanceId === cmdB.instanceId)?.commandHeld).toBe(true);
    expect(player.rush.some((c) => c.instanceId === sUnit.instanceId)).toBe(true);
  });
});
