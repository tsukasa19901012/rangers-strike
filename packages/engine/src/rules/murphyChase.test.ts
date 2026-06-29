import { describe, expect, it } from "vitest";
import { canonicalCardName, generatedCorePlayableCatalog as corePlayableCatalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import { createTestState, inst, TEST_DEFINITIONS, heldOtCommand, withCostWindow } from "../testing/fixtures";
import { MURPHY_CHASE_EFFECT_ID } from "../rules/murphyChase";

const defs = {
  ...TEST_DEFINITIONS,
  ...Object.fromEntries(corePlayableCatalog.cards.map((card) => [card.id, card])),
};

describe("RS-404 Murphy K9 chase", () => {
  it("opens unit selection after rush and adds matching deck card to hand", () => {
    const murphy = inst("RS-404", "murphy");
    const ally = inst("RS-405", "ally");
    const deckTwin = inst("RS-405", "deck-twin");
    const power = inst("TST-P", "pwr");

    let state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        hand: [murphy],
        deck: [deckTwin],
        rush: [],
        power: [{ ...power, faceDown: false }],
        command: [heldOtCommand("ot")],
        ...withCostWindow("rush_category"),
      },
      player2: {
        battle: [ally],
      },
    });

    const rush = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: murphy.instanceId,
    });
    expect(rush.ok).toBe(true);
    if (!rush.ok) return;
    state = rush.state;

    expect(state.pendingEffectChoice?.effectId).toBe(MURPHY_CHASE_EFFECT_ID);
    expect(state.pendingEffectChoice?.kind).toBe("select_unit");
    expect(state.pendingEffectChoice?.validInstanceIds).toContain(ally.instanceId);

    const pickUnit = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: ally.instanceId,
    });
    expect(pickUnit.ok).toBe(true);
    if (!pickUnit.ok) return;
    state = pickUnit.state;

    expect(state.pendingEffectChoice?.kind).toBe("scry_keep_one");
    expect(state.pendingEffectChoice?.validInstanceIds).toContain(deckTwin.instanceId);

    const pickDeck = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: deckTwin.instanceId,
    });
    expect(pickDeck.ok).toBe(true);
    if (!pickDeck.ok) return;
    state = pickDeck.state;

    expect(state.pendingEffectChoice).toBeUndefined();
    expect(state.players.player1.hand).toHaveLength(1);
    expect(
      canonicalCardName(state.definitions[state.players.player1.hand[0]!.cardId]!.name),
    ).toBe(canonicalCardName(state.definitions["RS-405"]!.name));
    expect(state.players.player2.battle).toHaveLength(1);
    expect(state.players.player1.deck).toHaveLength(0);
  });

  it("can skip the entire chase effect", () => {
    const murphy = inst("RS-404", "murphy");
    const ally = inst("RS-405", "ally");
    const power = inst("TST-P", "pwr");

    let state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        hand: [murphy],
        rush: [],
        power: [{ ...power, faceDown: false }],
        command: [heldOtCommand("ot")],
        ...withCostWindow("rush_category"),
      },
      player2: { battle: [ally] },
    });

    const rushed = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: murphy.instanceId,
    });
    expect(rushed.ok).toBe(true);
    if (!rushed.ok) return;

    const skipped = applyAction(rushed.state, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.pendingEffectChoice).toBeUndefined();
    expect(getLegalActions(skipped.state).some((a) => a.type === "skip_effect_choice")).toBe(
      false,
    );
  });

  it("does not target S units with the mecha feature", () => {
    const murphy = inst("RS-404", "murphy");
    const mechaUnit = inst("RS-404", "meka");
    const power = inst("TST-P", "pwr");

    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        hand: [murphy],
        rush: [],
        power: [{ ...power, faceDown: false }],
        command: [heldOtCommand("ot")],
        ...withCostWindow("rush_category"),
      },
      player2: { battle: [mechaUnit] },
    });

    const rushed = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: murphy.instanceId,
    });
    expect(rushed.ok).toBe(true);
    if (!rushed.ok) return;

    expect(rushed.state.pendingEffectChoice).toBeUndefined();
  });
});
