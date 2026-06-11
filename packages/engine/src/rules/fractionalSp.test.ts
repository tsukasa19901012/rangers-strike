import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { createGame } from "../core/createGame";
import { satisfyCostWindow } from "../core/costWindow";
import { applyAction } from "../core/applyAction";
import { canStrikeUnit, strikeDamageFor } from "./combo";
import { legend2EffectiveSp } from "./legend2/fieldEffects";
import {
  alignedFractionSp,
  battlePrintedSpBase,
  printedSpBase,
} from "./fractionalSp";
import type { CardInstance } from "../types/game";

describe("fractionalSp helpers", () => {
  it("grants SP1 only at the denominator position", () => {
    expect(alignedFractionSp("1/4", 4)).toBe(1);
    expect(alignedFractionSp("1/4", 3)).toBe(0);
    expect(alignedFractionSp("1/2", 2)).toBe(1);
    expect(printedSpBase("1/5", 5)).toBe(1);
    expect(printedSpBase("1/5", null)).toBe(0);
    expect(printedSpBase(2, null)).toBe(2);
  });
});

const quarterUnit: CardDefinition = {
  id: "TST-QUARTER",
  name: "テスト1/4",
  type: "unit",
  category: "OT",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S",
  sp: "1/4",
};

const fillerDeck = Array.from({ length: 40 }, (_, i) => ({
  id: `FILL-${i}`,
  name: "Filler",
  type: "unit" as const,
  category: "ET" as const,
  rarity: "N" as const,
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S" as const,
}));

function battleWithQuarterAt(position: number, activePlayer: "player1" | "player2" = "player1") {
  const padding: CardInstance[] = Array.from({ length: position - 1 }, (_, i) => ({
    instanceId: `pad-${i}`,
    cardId: fillerDeck[i]!.id,
  }));
  const quarter: CardInstance = { instanceId: "quarter-1", cardId: quarterUnit.id };
  const base = createGame({
    player1Deck: [...fillerDeck, quarterUnit],
    player2Deck: fillerDeck,
    rng: () => 0.5,
  });
  return {
    ...base,
    phase: "battle" as const,
    activePlayer,
    definitions: { ...base.definitions, [quarterUnit.id]: quarterUnit },
    players: {
      ...base.players,
      player1: {
        ...base.players.player1,
        battle: [...padding, quarter],
        hand: [],
        rush: [],
      },
    },
  };
}

describe("fractional SP in play", () => {
  it("can strike and deal 1 damage at the aligned battle position", () => {
    const state = battleWithQuarterAt(4);
    const unit = state.players.player1.battle[3]!;
    expect(legend2EffectiveSp(state, "player1", unit)).toBe(1);
    expect(canStrikeUnit(state.definitions, unit, state, "player1")).toBe(true);
    expect(strikeDamageFor(state.definitions, unit, state, "player1")).toBe(1);
    expect(battlePrintedSpBase(state, "player1", unit)).toBe(1);
  });

  it("cannot strike when misaligned", () => {
    const state = battleWithQuarterAt(3);
    const unit = state.players.player1.battle[2]!;
    expect(legend2EffectiveSp(state, "player1", unit)).toBe(0);
    expect(canStrikeUnit(state.definitions, unit, state, "player1")).toBe(false);
  });

  it("persists on the opponent's turn", () => {
    const state = battleWithQuarterAt(4, "player2");
    const unit = state.players.player1.battle[3]!;
    expect(legend2EffectiveSp(state, "player1", unit)).toBe(1);
  });

  it("applies spOverride fractions from battle", () => {
    const state = battleWithQuarterAt(2);
    const unit = {
      ...state.players.player1.battle[1]!,
      cardId: fillerDeck[0]!.id,
      spOverride: "1/2" as const,
    };
    expect(printedSpBase(unit.spOverride, 2)).toBe(1);
    expect(
      legend2EffectiveSp(
        {
          ...state,
          players: {
            ...state.players,
            player1: {
              ...state.players.player1,
              battle: [state.players.player1.battle[0]!, unit],
            },
          },
        },
        "player1",
        unit,
      ),
    ).toBe(1);
  });

  it("strike action succeeds for aligned 1/4 unit", () => {
    const state = battleWithQuarterAt(4);
    const result = applyAction(state, {
      type: "strike",
      playerId: "player1",
      instanceId: "quarter-1",
    });
    expect(result.ok).toBe(true);
    expect(result.state.players.player2.damage).toBe(1);
  });
});
