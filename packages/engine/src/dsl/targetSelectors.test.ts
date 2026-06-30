import { describe, expect, it } from "vitest";
import { generatedCorePlayableCatalog as corePlayableCatalog } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { interpretEffectPrimitives } from "./cardInterpreter";
import { evaluateDslCondition } from "./dslCatalog";
import { getCardDslDocument } from "./effectLookup";
import { tryResolveDslTriggeredEffects } from "./triggerResolver";
import { createTestState, inst } from "../testing/fixtures";

const defs: Record<string, CardDefinition> = Object.fromEntries(
  corePlayableCatalog.cards.map((card) => [card.id, card]),
);

describe("select_unit target filtering", () => {
  it("RK-072 wild shot excludes vehicles and only lists units with printed BP ≤ 3000", () => {
    const vehicle = inst("RK-043", "veh");
    const eligibleUnit = inst("RK-061", "unit");
    const highBpUnit = inst("RK-064", "unit-high");
    const source = inst("RK-072", "src");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [source] },
      player2: { rush: [vehicle, eligibleUnit, highBpUnit] },
    });

    const effect = getCardDslDocument("RK-072")?.effects?.find((e) => e.id === "wairudoshoto");
    expect(effect).toBeDefined();

    const canTrigger = evaluateDslCondition(
      state,
      "player1",
      effect?.condition,
      source.instanceId,
      effect?.effects,
    );
    expect(canTrigger).toBe(true);

    const outcome = interpretEffectPrimitives(
      state,
      {
        effectId: "wairudoshoto",
        sourceCardId: "RK-072",
        playerId: "player1",
        phasePlayerId: "player1",
        triggerSourceInstanceId: source.instanceId,
        discardOperation: false,
      },
      effect!.effects,
    );

    expect(outcome.state.pendingEffectChoice?.kind).toBe("select_unit");
    const valid = outcome.state.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain(eligibleUnit.instanceId);
    expect(valid).not.toContain(vehicle.instanceId);
    expect(valid).toContain(highBpUnit.instanceId);
  });

  it("RK-072 wild shot does not trigger when only vehicles are in rush", () => {
    const vehicle = inst("RK-043", "veh");
    const source = inst("RK-072", "src");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [source] },
      player2: { rush: [vehicle] },
    });

    const effect = getCardDslDocument("RK-072")?.effects?.find((e) => e.id === "wairudoshoto");
    expect(effect).toBeDefined();

    const canTrigger = evaluateDslCondition(
      state,
      "player1",
      effect?.condition,
      source.instanceId,
      effect?.effects,
    );
    expect(canTrigger).toBe(false);
  });

  it("RK-072 riding_combo does not open choice when only a vehicle is in rush", () => {
    const vehicle = inst("RK-043", "veh");
    const source = inst("RK-072", "src");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [source] },
      player2: { rush: [vehicle] },
    });

    const outcome = tryResolveDslTriggeredEffects({
      state,
      cardId: "RK-072",
      instanceId: source.instanceId,
      playerId: "player1",
      phasePlayerId: "player1",
      triggerType: "riding_combo",
    });

    expect(outcome.handled).toBe(false);
    expect(outcome.state.pendingEffectChoice).toBeUndefined();
  });
});
