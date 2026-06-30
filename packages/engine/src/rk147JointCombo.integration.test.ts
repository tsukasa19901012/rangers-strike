import { describe, expect, it } from "vitest";
import { legend2Catalog } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { createTestState, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const DEFINITIONS = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("RK-147 joint combo from S unit", () => {
  it("grants SP1 to SP1/4 S partner on battle enter", () => {
    const isurugi = inst("RK-147", "isurugi");
    const momotaros = inst("RK-142", "momo");

    const state = createTestState({
      phase: "battle",
      definitions: DEFINITIONS,
      player1: {
        rush: [momotaros],
        battle: [isurugi],
        power: [
          inst("TST-P1", "p1"),
          inst("TST-P2", "p2"),
          inst("TST-P3", "p3"),
        ],
        command: [
          {
            ...inst("TST-CMD", "cmd"),
            commandHeld: true,
          },
        ],
      },
    });

    const next = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: momotaros.instanceId,
      }),
    );

    const partnerInBattle = next.players.player1.battle.find((c) => c.cardId === "RK-142");
    expect(partnerInBattle).toBeUndefined();

    const partnerInDiscard = next.players.player1.discard.find((c) => c.cardId === "RK-142");
    expect(partnerInDiscard?.spOverride).toBe(1);
    expect(next.log.some((entry) => entry.includes("joint_combo_l"))).toBe(true);
    expect(next.log.some((entry) => entry.includes("destroy_on_enter_battle"))).toBe(
      true,
    );
  });
});
