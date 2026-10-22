import { describe, expect, it } from "vitest";
import { testEngine } from "../testing/engine";
import { buildPlayerBoard } from "./board";
import { playerStrip, powerCount } from "./gui";

// A multi-category card (チェンジドラゴン: MA/ET) in the opponent's command zone adds 1 to
// a player's power (atwiki page-110, page-1559; engine rulesSpec R-POW-01).
function stateWithEnemyMultiCommand() {
  const state = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
  const multi = testEngine.deckApi.cards.find((c) => c.id === "XG1-007")!;
  state.definitions[multi.id] = multi;
  const p1 = state.players.player1;
  p1.power = p1.hand.splice(0, 3);
  p1.power[0]!.faceDown = true;
  state.players.player2.command.push({ ...state.players.player2.hand[0]!, instanceId: "multi-cmd", cardId: multi.id });
  return state;
}

describe("power display", () => {
  it("counts the opponent's multi-category commands, not only the power zone", () => {
    const state = stateWithEnemyMultiCommand();
    expect(powerCount(testEngine, state, "player1")).toEqual({ total: 4, zone: 3, faceDown: 1, multi: 1, other: 0 });
    // The player's own multi-category command adds nothing to their power.
    expect(powerCount(testEngine, state, "player2").multi).toBe(0);
  });

  it("shows the power and where it comes from in the strip and the text board", () => {
    const state = stateWithEnemyMultiCommand();
    expect(playerStrip(testEngine, state, "player1")).toContain("P4(裏1・マルチ+1)");
    const zone = buildPlayerBoard(testEngine, state, "player1", false).zones.find((z) => z.label === "パワー");
    expect(zone?.text).toBe("4（パワーゾーン3枚：表2・裏1、相手のマルチカテゴリ+1）");
  });

  it("keeps the plain count when nothing else adds power", () => {
    const state = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
    expect(playerStrip(testEngine, state, "player1")).toContain(" P0");
    expect(playerStrip(testEngine, state, "player1")).not.toContain("マルチ");
  });
});
