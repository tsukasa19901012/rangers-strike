import { describe, expect, it } from "vitest";
import {
  getBattleEntryHoldCount,
  getCardById,
  listStandardNcCards,
  type NumberComboEffectId,
} from "@rangers-strike/cards";
import { applyAction } from "./core/applyAction";
import { applyNumberComboEffect } from "./rules/numberComboEffects";
import { strikeDamageFor } from "./rules/combo";
import { createTestState, inst } from "./testing/fixtures";
import {
  battleFillers,
  battleUnit,
  hasNcLog,
  legendDefinitions,
  moveToBattle,
} from "./testing/battleEntry";

const standardNcCards = listStandardNcCards(getCardById);

function enterAtCn(
  cardId: string,
  comboNumber: number,
  setup?: {
    deck?: ReturnType<typeof inst>[];
    player2?: Parameters<typeof createTestState>[0]["player2"];
  },
) {
  const unit = inst(cardId, "nc-unit");
  const holdCount = getBattleEntryHoldCount(cardId);
  const holdCommands =
    holdCount > 0
      ? Array.from({ length: holdCount }, (_, index) => ({
          ...inst("RS-007", `hold-${index}`),
          commandHeld: true,
        }))
      : [];
  const state = createTestState({
    phase: "battle",
    activePlayer: "player1",
    definitions: legendDefinitions,
    player1: {
      rush: [unit],
      battle: battleFillers(comboNumber - 1),
      deck: setup?.deck ?? [inst("RS-007", "deck-top")],
      hand: [],
      command: holdCommands,
      battleEntryHoldReady: holdCount > 0,
    },
    player2: setup?.player2,
  });
  return { unit, state, next: moveToBattle(state, unit.instanceId) };
}

type OutcomeCheck = (args: {
  before: ReturnType<typeof createTestState>;
  after: ReturnType<typeof createTestState>;
  unit: ReturnType<typeof inst>;
}) => void;

const OUTCOME_CHECKS: Partial<Record<NumberComboEffectId, OutcomeCheck>> = {
  grant_sp1: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
  },
  future_sight: ({ before, after }) => {
    expect(after.players.player1.hand.length).toBe(before.players.player1.hand.length + 1);
    expect(after.players.player1.deck.length).toBe(before.players.player1.deck.length - 1);
  },
  red_fire: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
  },
  yellow_thunder: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
  },
  bouken_javelin: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
  },
  moss_breaker: ({ after }) => {
    expect(after.pendingEffectChoice?.effectId).toBe("moss_breaker");
  },
  ruin_survey: ({ after }) => {
    expect(after.pendingEffectChoice?.effectId).toBe("ruin_survey");
  },
  pink_storm: ({ after }) => {
    expect(after.pendingEffectChoice?.effectId).toBe("pink_storm");
  },
  green_ground: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
    expect(after.pendingEffectChoice?.effectId).toBe("green_ground");
  },
  radial_hammer: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
    expect(after.pendingEffectChoice?.effectId).toBe("radial_hammer");
  },
  pit_in_dive: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
    expect(after.pendingEffectChoice?.effectId).toBe("pit_in_dive");
  },
  blow_knuckle: ({ after, unit }) => {
    expect(battleUnit(after, "player1", unit.instanceId)?.spModifier).toBe(1);
  },
};

describe("NC battle entry (standard CN position)", () => {
  it.each(standardNcCards.map((entry) => [entry.cardId, entry.effectId, entry.comboNumber, entry.effectName] as const))(
    "%s %s fires at CN %i",
    (cardId, effectId, comboNumber) => {
      const setup =
        effectId === "moss_breaker"
          ? {
              player2: {
                command: [{ ...inst("RS-007", "enemy-cmd"), commandHeld: false }],
              },
            }
          : effectId === "pink_storm"
            ? {
                player2: {
                  battle: [inst("RS-059", "enemy")],
                },
              }
            : effectId === "green_ground"
              ? {
                  player2: {
                    command: [inst("RS-007", "enemy-cmd")],
                  },
                }
              : effectId === "pit_in_dive"
                ? {
                    player2: {
                      rush: [inst("RS-059", "enemy-rush")],
                    },
                  }
                : undefined;

      const { state, next, unit } = enterAtCn(cardId, comboNumber, setup);
      expect(hasNcLog(next, effectId)).toBe(true);

      const check = OUTCOME_CHECKS[effectId];
      if (check) {
        check({ before: state, after: next, unit });
      }
    },
  );

  it("RS-063 radial hammer keeps SP1 after scry choice", () => {
    const deckTop = [
      inst("TST-UNIT-0", "d1"),
      inst("TST-UNIT-0", "d2"),
      inst("TST-UNIT-0", "d3"),
    ];
    const { next, unit } = enterAtCn("RS-063", 5, { deck: deckTop });

    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
    expect(next.pendingEffectChoice?.effectId).toBe("radial_hammer");

    const resolved = applyAction(next, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: deckTop[0]!.instanceId,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const black = battleUnit(resolved.state, "player1", unit.instanceId);
    expect(black?.spModifier).toBe(1);
    expect(strikeDamageFor(resolved.state.definitions, black!, resolved.state, "player1")).toBe(1);
  });

  it("RS-061 green ground keeps SP1 after returning enemy command", () => {
    const enemyCmd = inst("RS-007", "enemy-cmd");
    const { next, unit } = enterAtCn("RS-061", 3, {
      player2: { command: [enemyCmd] },
    });

    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
    expect(next.pendingEffectChoice?.effectId).toBe("green_ground");

    const resolved = applyAction(next, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: enemyCmd.instanceId,
    });
    expect(resolved.ok).toBe(true);

    const magigreen = battleUnit(resolved.state, "player1", unit.instanceId);
    expect(magigreen?.spModifier).toBe(1);
    expect(strikeDamageFor(resolved.state.definitions, magigreen!, resolved.state, "player1")).toBe(1);
  });

  it.each(
    standardNcCards
      .filter((entry) => entry.comboNumber > 1)
      .map((entry) => [entry.cardId, entry.effectId, entry.comboNumber] as const),
  )("%s does not fire NC at wrong CN position", (cardId, effectId, comboNumber) => {
    const unit = inst(cardId, "nc-unit");
    const wrongFillers = battleFillers(comboNumber - 2);
    const holdCount = getBattleEntryHoldCount(cardId);
    const holdCommands =
      holdCount > 0
        ? Array.from({ length: holdCount }, (_, index) => ({
            ...inst("RS-007", `hold-wrong-${index}`),
            commandHeld: true,
          }))
        : [];
    const state = createTestState({
      phase: "battle",
      definitions: legendDefinitions,
      player1: {
        rush: [unit],
        battle: wrongFillers,
        command: holdCommands,
        battleEntryHoldReady: holdCount > 0,
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(hasNcLog(next, effectId)).toBe(false);
  });
});

describe("NC combo-from override", () => {
  it("RS-031 eagle diving triggers beside RS-032 without CN 5", () => {
    const eagle = inst("RS-031", "eagle");
    const state = createTestState({
      phase: "battle",
      definitions: legendDefinitions,
      player1: {
        rush: [eagle],
        battle: [inst("RS-032", "shark")],
      },
    });
    const next = moveToBattle(state, eagle.instanceId);
    expect(hasNcLog(next, "eagle_diving")).toBe(true);
    expect(battleUnit(next, "player1", eagle.instanceId)?.spModifier).toBe(1);
    expect(battleUnit(next, "player1", eagle.instanceId)?.bpModifier).toBe(2000);
  });

  it("RS-056 magical dragon shoot triggers from Magi Phoenix partner", () => {
    const dragon = inst("RS-056", "dragon");
    const state = createTestState({
      phase: "battle",
      definitions: legendDefinitions,
      player1: {
        rush: [dragon],
        battle: [inst("RS-057", "phoenix")],
      },
    });
    const next = moveToBattle(state, dragon.instanceId);
    expect(hasNcLog(next, "magical_dragon_shoot")).toBe(true);
    expect(battleUnit(next, "player1", dragon.instanceId)?.bpModifier).toBe(4000);
  });
});

describe("applyNumberComboEffect state persistence", () => {
  it("future_sight draw is not reverted by player merge", () => {
    const card = inst("RS-059", "blue");
    const deckCard = inst("RS-007", "deck");
    const state = createTestState({
      phase: "battle",
      definitions: legendDefinitions,
      player1: {
        battle: [card],
        deck: [deckCard],
        hand: [],
      },
    });

    const result = applyNumberComboEffect(state, "player1", card, "future_sight");
    expect(result.state.players.player1.hand).toHaveLength(1);
    expect(result.state.players.player1.deck).toHaveLength(0);
    expect(result.logs.some((entry) => entry.includes("future_sight"))).toBe(true);
  });
});
