import { describe, expect, it } from "vitest";
import type { GameState } from "@rangers-strike/engine";
import {
  analyzeBoardTapEffectChoice,
  effectChoiceSkipLabel,
} from "./effectChoiceBoardTap";

function miniState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    activePlayer: "player1",
    firstPlayer: "player1",
    phase: "battle",
    players: {
      player1: {
        hand: [],
        deck: [],
        discard: [],
        power: [],
        command: [],
        rush: [],
        battle: [],
        operation: [],
        damage: 0,
      },
      player2: {
        hand: [],
        deck: [],
        discard: [],
        power: [],
        command: [
          {
            instanceId: "enemy-cmd",
            cardId: "RS-007",
            commandHeld: true,
          },
        ],
        rush: [],
        battle: [],
        operation: [],
        damage: 0,
      },
    },
    definitions: {},
    log: [],
    winner: null,
    ...overrides,
  } as GameState;
}

describe("effectChoiceBoardTap", () => {
  it("builds banner view for green_ground enemy command targets", () => {
    const view = analyzeBoardTapEffectChoice(
      miniState(),
      {
        playerId: "player1",
        effectId: "green_ground",
        sourceCardId: "RS-061",
        sourceInstanceId: "RS-061:mg",
        kind: "select_command",
        phasePlayerId: "player1",
        validInstanceIds: ["enemy-cmd"],
        commandAction: "return_hand",
        optional: true,
      },
      "player1",
    );

    expect(view?.title).toBe("【グリーングラウンド】");
    expect(view?.sourceLine).toBe("「マジグリーン」の効果");
    expect(view?.zoneHint).toBe("相手のコマンドゾーンのカードをタップ");
    expect(view?.opponent.command).toBe(true);
    expect(view?.self.command).toBe(false);
  });

  it("returns null when targets are not on board zones", () => {
    const view = analyzeBoardTapEffectChoice(
      miniState({
        players: {
          player1: {
            id: "player1",
            hand: [{ instanceId: "h1", cardId: "RS-007" }],
            deck: [],
            discard: [],
            power: [],
            command: [],
            rush: [],
            battle: [],
            operation: [],
            damage: 0,
          },
          player2: {
            id: "player2",
            hand: [],
            deck: [],
            discard: [],
            power: [],
            command: [],
            rush: [],
            battle: [],
            operation: [],
            damage: 0,
          },
        },
      } as Partial<GameState>),
      {
        playerId: "player1",
        effectId: "test",
        sourceCardId: "RS-061",
        kind: "select_hand",
        phasePlayerId: "player1",
        validInstanceIds: ["h1"],
      },
      "player1",
    );

    expect(view).toBeNull();
  });

  it("uses green_ground skip label", () => {
    expect(
      effectChoiceSkipLabel({
        playerId: "player1",
        effectId: "green_ground",
        sourceCardId: "RS-061",
        kind: "select_command",
        phasePlayerId: "player1",
        validInstanceIds: [],
        optional: true,
      }),
    ).toBe("戻さない");
  });
});
