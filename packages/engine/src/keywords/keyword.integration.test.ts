/**
 * キーワード代表カード — 最小 E2E 回帰（KW-P2-04）。
 * 各 describe は対応モジュールの smoke test。
 */
import { describe, expect, it } from "vitest";
import { scrumBlocksAttack, blastBypassesRushAdditionalCondition } from "./battleKeywords";
import { canOfferRegister } from "../rules/resist";
import { cardHasRegisterKeyword } from "./registerReaction";
import { attachRideForBattleEntry } from "./ride";
import { listValidChaseVehicleIds } from "./chase";
import { listMorphReactors } from "./morphReaction";
import { IMPLEMENTED_RIDING_COMBO_EFFECT_IDS } from "@rangers-strike/cards";
import { isSelectableByOpponentEffect } from "./effectTargetability";
import { createTestState, inst } from "../testing/fixtures";
import { buildDefinitionMap } from "../core/catalog";
import { WIN_DAMAGE } from "../types/game";

describe("keyword regression smoke", () => {
  it("scrum blocks when right neighbor CN is self+1", () => {
    const left = inst("RS-SCRUM", "left");
    const right = inst("RS-RIGHT", "right");
    const defs = buildDefinitionMap([
      [
        { id: "RS-SCRUM", name: "S", type: "unit", category: "WB", rarity: "N", expansion: "t", powerCost: 1, bp: 1000, size: "S", comboNumber: 3, text: "※スクラム" },
        { id: "RS-RIGHT", name: "R", type: "unit", category: "WB", rarity: "N", expansion: "t", powerCost: 1, bp: 1000, size: "S", comboNumber: 4 },
      ],
    ]);
    const state = createTestState({
      player2: { battle: [left, right] },
    });
    state.definitions = defs;
    expect(scrumBlocksAttack(state, "player2", left.instanceId)).toBe(true);
  });

  it("register offered only on battle BP destroy", () => {
    const state = createTestState();
    expect(
      canOfferRegister(state, {
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: "RS-001",
        registerEligible: true,
      }),
    ).toBe(cardHasRegisterKeyword(state, "RS-001") || false);
  });

  it("blast bypass uses damage threshold or low face-up power", () => {
    const defs = buildDefinitionMap([
      [{ id: "TST-B", name: "B", type: "unit", category: "WB", rarity: "SR", expansion: "t", powerCost: 7, bp: 12000, size: "L", text: "※ブラスト" }],
    ]);
    const lowPower = createTestState(defs);
    lowPower.definitions = defs;
    expect(blastBypassesRushAdditionalCondition(lowPower, "player1", "TST-B")).toBe(true);

    const nearLoss = createTestState(defs);
    nearLoss.definitions = defs;
    nearLoss.players.player1.damage = WIN_DAMAGE - 1;
    expect(blastBypassesRushAdditionalCondition(nearLoss, "player1", "TST-B")).toBe(true);
  });

  it("ride attaches RC on battle entry helper", () => {
    const vehicle = inst("V", "v");
    const rider = inst("R", "r");
    const defs = buildDefinitionMap([
      [
        { id: "V", name: "V", type: "vehicle", category: "OT", rarity: "N", expansion: "t", powerCost: 3, bp: 4000, size: "M" },
        { id: "R", name: "R", type: "unit", category: "OT", rarity: "N", expansion: "t", powerCost: 2, bp: 2000, size: "S", comboNumber: "RC" },
      ],
    ]);
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player1: { ...createTestState(defs).players.player1, rush: [vehicle, rider] },
      },
    };
    expect(attachRideForBattleEntry(state, "player1", rider).mountedOnInstanceId).toBe(
      vehicle.instanceId,
    );
  });

  it("chase lists valid remount vehicles", () => {
    const v1 = inst("V1", "v1");
    const v2 = inst("V2", "v2");
    const rider = inst("R", "r");
    rider.mountedOnInstanceId = v1.instanceId;
    const state = createTestState({
      player1: { rush: [v1, v2, rider] },
    });
    state.definitions["V1"] = { id: "V1", name: "V1", type: "vehicle", category: "OT", rarity: "N", expansion: "t", powerCost: 3, bp: 4000, size: "M" };
    state.definitions["V2"] = { id: "V2", name: "V2", type: "vehicle", category: "OT", rarity: "N", expansion: "t", powerCost: 3, bp: 4000, size: "M" };
    state.definitions["R"] = { id: "R", name: "R", type: "unit", category: "OT", rarity: "N", expansion: "t", powerCost: 2, bp: 2000, size: "S", comboNumber: "RC", tags: ["chase"] };

    const ids = listValidChaseVehicleIds(state, {
      chaserPlayerId: "player1",
      chaserInstanceId: rider.instanceId,
      targetPlayerId: "player1",
      targetInstanceId: v1.instanceId,
      phasePlayerId: "player1",
      leaveIntent: {
        ownerPlayerId: "player1",
        instanceId: rider.instanceId,
        fromZone: "rush",
        toZone: "discard",
        leavingCardId: "R",
        phasePlayerId: "player1",
      },
      validVehicleInstanceIds: [v2.instanceId],
      mode: "rider_leave",
    });
    expect(ids).toEqual([v2.instanceId]);
  });

  it("morph reactor opens on enemy rush", () => {
    const defs = buildDefinitionMap([
      [
        { id: "ENEMY", name: "E", type: "unit", category: "WB", rarity: "N", expansion: "t", powerCost: 1, bp: 1000, size: "S", features: ["特徴A"] },
        { id: "MORPH", name: "M", type: "unit", category: "WB", rarity: "N", expansion: "t", powerCost: 1, bp: 1000, size: "S", features: ["特徴A"], text: "【モーフ】" },
        { id: "HAND", name: "H", type: "unit", category: "WB", rarity: "N", expansion: "t", powerCost: 1, bp: 1000, size: "S", features: ["特徴A"] },
      ],
    ]);
    const state = createTestState({
      player2: {
        rush: [inst("MORPH", "m")],
        hand: [inst("HAND", "h")],
      },
    });
    state.definitions = defs;
    expect(listMorphReactors(state, "player2", "ENEMY").length).toBe(1);
  });

  it("riding combo effect table includes grant_sp beyond sp1", () => {
    expect(IMPLEMENTED_RIDING_COMBO_EFFECT_IDS).toContain("grant_sp1");
    expect(IMPLEMENTED_RIDING_COMBO_EFFECT_IDS.length).toBeGreaterThan(1);
  });

  it("breaker blocks enemy effect targeting", () => {
    const defs = buildDefinitionMap([
      [{ id: "BRK", name: "B", type: "unit", category: "ET", rarity: "SR", expansion: "t", powerCost: 5, bp: 8000, size: "L", text: "※ブレイカー" }],
    ]);
    const breaker = inst("BRK", "b");
    const state = createTestState({
      player2: { battle: [breaker] },
    });
    state.definitions = defs;
    expect(isSelectableByOpponentEffect(state, "player1", breaker.instanceId)).toBe(false);
  });
});
