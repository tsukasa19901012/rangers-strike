import { describe, expect, it } from "vitest";
import { createTestState, inst } from "../testing/fixtures";
import {
  evaluateStateGate,
  listExtendedZordRushVariants,
  validateExtendedZordPayment,
} from "./zordExtended";

describe("zordExtended", () => {
  it("evaluates unit count state_gate", () => {
    const state = createTestState({
      player1: { rush: [inst("RS-080", "u1"), inst("RS-080", "u2")] },
      player2: { rush: [inst("RS-080", "u3")] },
    });
    state.definitions["RS-080"] = {
      id: "RS-080",
      name: "S",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      size: "S",
      bp: 2000,
    };
    expect(
      evaluateStateGate(state, "player1", {
        conditionId: "state_gate",
        text: "ユニットが3体以上ある",
      }),
    ).toBe(true);
  });

  it("lists discard_all_hand extended variants excluding rushing card", () => {
    const zord = inst("RS-365", "z1");
    const other = inst("TST-P", "h1");
    const state = createTestState({
      player1: { hand: [zord, other] },
    });
    state.definitions["RS-365"] = {
      id: "RS-365",
      name: "イナズマギンガー",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: "7+",
      rushAdditionalCondition: {
        conditionId: "discard_all_hand",
        text: "自分の手札を全て捨札にする",
      },
      bp: 7000,
      size: "M",
    };
    const variants = listExtendedZordRushVariants(
      state.players.player1,
      state.definitions,
      "RS-365",
      zord.instanceId,
    );
    expect(variants).toHaveLength(1);
    expect(variants[0]?.zordMaterialInstanceIds).toEqual([other.instanceId]);
    expect(
      validateExtendedZordPayment(
        state.players.player1,
        state.definitions,
        "RS-365",
        zord.instanceId,
        [other.instanceId],
      ),
    ).toBe(true);
  });
});

describe("vehicle rush additional conditions (XG)", () => {
  it("requires returning 仮面ライダークウガ to hand for XG2-074 クウガゴウラム", async () => {
    const { getFullPlayableCardById } = await import("@rangers-strike/cards");
    const vehicleDef = getFullPlayableCardById("XG2-074");
    expect(vehicleDef?.rushAdditionalCondition?.conditionId).toBe("return_named_to_hand");

    const vehicle = inst("XG2-074", "v1");
    const kuuga = inst("XG2-073", "k1");
    const state = createTestState({
      player1: { hand: [vehicle], rush: [kuuga] },
    });
    state.definitions["XG2-074"] = vehicleDef!;
    state.definitions["XG2-073"] = getFullPlayableCardById("XG2-073")!;

    const variants = listExtendedZordRushVariants(
      state.players.player1,
      state.definitions,
      "XG2-074",
      vehicle.instanceId,
    );
    expect(variants.length).toBeGreaterThan(0);
    expect(variants[0]?.zordMaterialInstanceIds).toEqual([kuuga.instanceId]);

    // クウガ不在なら支払い不能
    const without = createTestState({ player1: { hand: [vehicle] } });
    without.definitions["XG2-074"] = vehicleDef!;
    expect(
      listExtendedZordRushVariants(
        without.players.player1,
        without.definitions,
        "XG2-074",
        vehicle.instanceId,
      ),
    ).toHaveLength(0);
  });
});
