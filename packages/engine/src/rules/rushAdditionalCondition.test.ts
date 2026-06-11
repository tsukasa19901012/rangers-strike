import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import {
  effectiveBattleEntryHoldCount,
  effectiveRushAdditionalCondition,
} from "./rushAdditionalCondition";
import { createTestState, inst } from "../testing/fixtures";

function def(id: string) {
  const card = fullPlayableCatalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

describe("effectiveRushAdditionalCondition", () => {
  it("uses alternate discard_named_unit when discard gate is met (RS-514)", () => {
    const cardId = "RS-514";
    const definition = def(cardId);
    const state = createTestState({
      player1: {
        discard: Array.from({ length: 7 }, (_, i) => inst("TST-UNIT-0", `d${i}`)),
      },
    });
    state.definitions[cardId] = definition;

    const resolved = effectiveRushAdditionalCondition(state, "player1", cardId, definition);
    expect(resolved?.conditionId).toBe("discard_named_unit");
    expect(resolved?.partnerName).toBe("ゲキバイオレット");
  });

  it("keeps base fusion discard condition when gate is not met (RS-514)", () => {
    const cardId = "RS-514";
    const definition = def(cardId);
    const state = createTestState({
      player1: { discard: [inst("TST-UNIT-0", "d1")] },
    });
    state.definitions[cardId] = definition;

    const resolved = effectiveRushAdditionalCondition(state, "player1", cardId, definition);
    expect(resolved?.conditionId).toBe("discard_fusion_unit");
  });
});

describe("effectiveBattleEntryHoldCount", () => {
  it("returns 0 when ally lead MA invalidates command hold entry (XG6-034)", () => {
    const cardId = "XG6-034";
    const leadAlly = inst("XG6-025", "lead");
    const state = createTestState({
      player1: { rush: [leadAlly] },
    });
    state.definitions[cardId] = def(cardId);
    state.definitions["XG6-025"] = def("XG6-025");

    const raw = 1;

    const hold = effectiveBattleEntryHoldCount(state, "player1", cardId, raw);
    expect(hold).toBe(0);
  });
});
