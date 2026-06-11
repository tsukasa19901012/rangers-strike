import { describe, expect, it } from "vitest";
import {
  hasPowerCostMinusSuffix,
  printedPowerCostNumber,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerState } from "../types/game";
import {
  collectZordDownMaterials,
  listZordDownRushPaymentVariants,
  needsZordDownPayment,
  validateZordDownPayment,
} from "./zordDown";
import { canRushUnitExceptCommandHold, parsePowerCost, rushPowerCost } from "../core/catalog";
import { inst, withCostWindow } from "../testing/fixtures";

const RS230: CardDefinition = {
  id: "RS-230",
  name: "アバレッドAM",
  type: "unit",
  category: "WB",
  rarity: "N",
  expansion: "legend1",
  powerCost: "7-",
  bp: 5500,
  size: "S",
  rushAdditionalCondition: {
    conditionId: "zord_down_discard_named",
    text: "自軍「アバレッド」1体を捨札にすれば必要パワー0になる",
    partnerName: "アバレッド",
    unitCount: 1,
  },
};

const RS054: CardDefinition = {
  id: "RS-054",
  name: "アバレッド",
  type: "unit",
  category: "WB",
  rarity: "N",
  expansion: "legend1",
  powerCost: 1,
  bp: 1000,
  size: "S",
};

function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "player1",
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    damage: 0,
    operation: [],
    ...overrides,
  };
}

describe("powerCost helpers", () => {
  it("parses printed number and minus suffix", () => {
    expect(printedPowerCostNumber("7-")).toBe(7);
    expect(printedPowerCostNumber("7+")).toBe(7);
    expect(hasPowerCostMinusSuffix("7-")).toBe(true);
    expect(hasPowerCostMinusSuffix("7+")).toBe(false);
    expect(parsePowerCost("7-")).toBe(7);
  });
});

describe("zord down rush", () => {
  const definitions = { "RS-230": RS230, "RS-054": RS054 };

  it("detects zord down payment requirement", () => {
    expect(needsZordDownPayment("RS-230", "7-", RS230)).toBe(true);
  });

  it("collects named partner from hand for zero-cost rush", () => {
    const material = { cardId: "RS-054", instanceId: "mat-1" };
    const rusher = { cardId: "RS-230", instanceId: "rush-1" };
    const player = basePlayer({
      hand: [rusher, material],
    });
    const materials = collectZordDownMaterials(player, definitions, "RS-230", "rush-1");
    expect(materials.map((c) => c.instanceId)).toEqual(["mat-1"]);
    expect(
      validateZordDownPayment(
        player,
        definitions,
        "RS-230",
        "rush-1",
        "mat-1",
      ),
    ).toBe(true);
  });

  it("does not allow zero-cost rush without paying material", () => {
    const material = { cardId: "RS-054", instanceId: "mat-1" };
    const rusher = { cardId: "RS-230", instanceId: "rush-1" };
    const player = basePlayer({
      hand: [rusher, material],
      power: [{ cardId: "P-1", instanceId: "p1" }],
    });

    expect(
      canRushUnitExceptCommandHold(
        player,
        definitions,
        RS230,
        "rush-1",
        undefined,
        undefined,
        undefined,
        undefined,
        { players: { player1: player, player2: basePlayer() }, definitions, activePlayer: "player1", playerId: "player1" },
      ),
    ).toBe(false);
    expect(
      canRushUnitExceptCommandHold(
        player,
        definitions,
        RS230,
        "rush-1",
        "mat-1",
        undefined,
        undefined,
        undefined,
        { players: { player1: player, player2: basePlayer() }, definitions, activePlayer: "player1", playerId: "player1" },
      ),
    ).toBe(true);
  });

  it("lists power card discard variants", () => {
    const XG6032 = {
      id: "XG6-032",
      name: "巨大邪神14",
      type: "unit" as const,
      category: "DA" as const,
      rarity: "N" as const,
      expansion: "legend1" as const,
      powerCost: "14-",
      bp: 8000,
      size: "L" as const,
      rushAdditionalCondition: {
        conditionId: "zord_down_discard_power_cards" as const,
        text: "必要パワーの数字が5以上の自軍パワーを4枚捨札にすれば必要パワー0になる",
        minPrintedPowerCost: 5,
        unitCount: 4,
      },
    };
    const definitions = {
      "XG6-032": XG6032,
      "P-5": { id: "P-5", name: "P5", type: "unit", category: "ET", rarity: "N", expansion: "legend1", powerCost: 5, bp: 0, size: "S" },
      "P-6": { id: "P-6", name: "P6", type: "unit", category: "ET", rarity: "N", expansion: "legend1", powerCost: 6, bp: 0, size: "S" },
      "P-7": { id: "P-7", name: "P7", type: "unit", category: "ET", rarity: "N", expansion: "legend1", powerCost: 7, bp: 0, size: "S" },
      "P-8": { id: "P-8", name: "P8", type: "unit", category: "ET", rarity: "N", expansion: "legend1", powerCost: 8, bp: 0, size: "S" },
    };
    const player = basePlayer({
      hand: [{ cardId: "XG6-032", instanceId: "rush-1" }],
      power: [
        { cardId: "P-5", instanceId: "p1" },
        { cardId: "P-6", instanceId: "p2" },
        { cardId: "P-7", instanceId: "p3" },
        { cardId: "P-8", instanceId: "p4" },
      ],
    });
    const variants = listZordDownRushPaymentVariants(
      player,
      definitions,
      "XG6-032",
      "rush-1",
    );
    expect(variants).toHaveLength(1);
    expect(variants[0]?.zordMaterialInstanceIds).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("rushPowerCost is zero when zord down material is used", () => {
    const state = {
      players: {
        player1: basePlayer({ power: [{ cardId: "P-1", instanceId: "p1" }] }),
        player2: basePlayer(),
      },
      definitions,
      activePlayer: "player1" as const,
    } satisfies Pick<GameState, "players" | "definitions" | "activePlayer">;

    expect(
      rushPowerCost(state, "player1", RS230, { zordMaterialInstanceId: "mat-1" }),
    ).toBe(0);
    expect(rushPowerCost(state, "player1", RS230)).toBe(7);
  });
});
