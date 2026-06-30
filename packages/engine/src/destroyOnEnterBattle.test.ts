import { describe, expect, it } from "vitest";
import { legend2Catalog } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { addTurnRuleModifier } from "./core/scopedModifiers";
import { IMAGIN_DESTROY_ON_ENTER_SUPPRESSED } from "./rules/destroyOnEnterBattle";
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

describe("destroy_on_enter_battle", () => {
  it("RK-142 is destroyed when entering battle from rush", () => {
    const momotaros = inst("RK-142", "momo");

    const state = createTestState({
      phase: "battle",
      definitions: DEFINITIONS,
      player1: {
        rush: [momotaros],
        power: [
          inst("TST-P1", "p1"),
          inst("TST-P2", "p2"),
          inst("TST-P3", "p3"),
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

    expect(next.players.player1.battle.some((c) => c.cardId === "RK-142")).toBe(
      false,
    );
    expect(next.players.player1.discard.some((c) => c.cardId === "RK-142")).toBe(
      true,
    );
    expect(
      next.log.some((entry) => entry.includes("destroy_on_enter_battle")),
    ).toBe(true);
  });

  it("is suppressed for imagin when turn modifier is active (RK-242 tag hook)", () => {
    const momotaros = inst("RK-142", "momo");

    const state = createTestState({
      phase: "battle",
      definitions: DEFINITIONS,
      player1: {
        rush: [momotaros],
        power: [
          inst("TST-P1", "p1"),
          inst("TST-P2", "p2"),
          inst("TST-P3", "p3"),
        ],
      },
    });

    const withModifier = {
      ...state,
      players: {
        ...state.players,
        player1: addTurnRuleModifier(
          state.players.player1,
          IMAGIN_DESTROY_ON_ENTER_SUPPRESSED,
          { sourceCardId: "RK-242" },
        ),
      },
    };

    const next = unwrap(
      applyAction(withModifier, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: momotaros.instanceId,
      }),
    );

    expect(next.players.player1.battle.some((c) => c.cardId === "RK-142")).toBe(
      true,
    );
    expect(next.players.player1.discard.some((c) => c.cardId === "RK-142")).toBe(
      false,
    );
  });
});
