import { describe, expect, it } from "vitest";
import "./cardInterpreter";
import { interpretEffectPrimitives } from "./cardInterpreter";
import { applyGrantKeyword } from "./grantKeyword";
import {
  cardHasDslGrantKeyword,
  decodeRideWithoutRcFeature,
  isEngineNativeGrantKeyword,
  listRideWithoutRcFeatures,
  riderMatchesVehicleRideWithoutRc,
} from "./promotedKeywordBridge";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../keywords/registerReaction";
import { playerHasActiveFieldKeyword } from "./fieldKeywords";
import { playerHasOperationGrantKeyword } from "./operationKeywords";
import { createTestState, inst } from "../testing/fixtures";

describe("promoted native keywords bridge", () => {
  it("classifies D/E grant_keyword markers as engine-native", () => {
    expect(isEngineNativeGrantKeyword("morph")).toBe(true);
    expect(isEngineNativeGrantKeyword("resident")).toBe(true);
    expect(isEngineNativeGrantKeyword("wing")).toBe(true);
    expect(isEngineNativeGrantKeyword("chase")).toBe(true);
    expect(isEngineNativeGrantKeyword("ride_without_rc_named_e382b7e383abe38390e383bc")).toBe(
      true,
    );
  });

  it("reads wing/register from promoted DSL (RS-632)", () => {
    expect(cardHasDslGrantKeyword("RS-632", "wing")).toBe(true);
    expect(cardHasDslGrantKeyword("RS-632", "register")).toBe(true);
    const state = createTestState({});
    expect(cardHasKeyword(state.definitions, "RS-632", "wing")).toBe(true);
    expect(cardHasRegisterKeyword(state, "RS-632")).toBe(true);
  });

  it("reads morph/register from promoted DSL (RK-263)", () => {
    expect(cardHasDslGrantKeyword("RK-263", "morph")).toBe(true);
    const state = createTestState({});
    expect(cardHasKeyword(state.definitions, "RK-263", "morph")).toBe(true);
    expect(cardHasKeyword(state.definitions, "RK-263", "register")).toBe(true);
  });

  it("reads chase from promoted DSL (XG3-046)", () => {
    expect(cardHasDslGrantKeyword("XG3-046", "chase")).toBe(true);
    const state = createTestState({});
    expect(cardHasKeyword(state.definitions, "XG3-046", "chase")).toBe(true);
  });

  it("resolves while_in_field grant_keyword with detail (not unresolved)", () => {
    const unit = inst("RK-263", "u1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [unit] },
    });

    const grant = applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "RK-263",
        effectId: "unnamed_morph",
        triggerSourceInstanceId: unit.instanceId,
      },
      "morph",
    );
    expect(grant.detail).toBe("morph");
  });

  it("detects resident operation in operation zone (RK-006)", () => {
    const op = inst("RK-006", "op1");
    const state = createTestState({
      player1: { operation: [op] },
    });
    expect(cardHasDslGrantKeyword("RK-006", "resident")).toBe(true);
    expect(playerHasActiveFieldKeyword(state, "player1", "resident", ["operation"])).toBe(true);
    expect(playerHasOperationGrantKeyword(state, "player1", "resident")).toBe(true);
  });

  it("decodes ride_without_rc feature slug (XG4-009 シルバー)", () => {
    const keyword = "ride_without_rc_named_e382b7e383abe38390e383bc";
    expect(decodeRideWithoutRcFeature(keyword)).toBe("シルバー");
    expect(listRideWithoutRcFeatures("XG4-009")).toContain("シルバー");

    const state = createTestState({});
    const silverRider = {
      id: "TST-SILVER-S",
      name: "Silver S",
      type: "unit" as const,
      category: "ET" as const,
      rarity: "N" as const,
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "S" as const,
      features: ["シルバー"],
    };
    state.definitions["TST-SILVER-S"] = silverRider;
    expect(riderMatchesVehicleRideWithoutRc(state.definitions, "XG4-009", "TST-SILVER-S")).toBe(
      true,
    );
  });

  it("wing NC on RS-632 does not return interpret_effect_unresolved", () => {
    const unit = inst("RS-632", "u1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [unit] },
    });

    const outcome = interpretEffectPrimitives(
      state,
      {
        effectId: "named_e38389e383aae383abe382bb",
        sourceCardId: "RS-632",
        playerId: "player1",
        phasePlayerId: "player1",
        triggerSourceInstanceId: unit.instanceId,
        discardOperation: false,
      },
      [{ type: "grant_keyword", keyword: "SP1", duration: "turn" }],
    );

    expect(outcome.detail).not.toBe("interpret_effect_unresolved");
    expect(outcome.detail).toBe("sp1");
  });
});
