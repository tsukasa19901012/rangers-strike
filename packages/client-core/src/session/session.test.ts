import { describe, expect, it } from "vitest";
import { GameSession } from "./session";
import { HUMAN } from "../engineApi";
import { buildBoardView, buildPendingView } from "../view/board";
import { testEngine } from "../testing/engine";

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
  });
});
