import { describe, expect, it } from "vitest";
import {
  allCardsCatalog,
  getBattleEntryHoldCount,
  getCardById,
  getCardEffect,
  legend1Catalog,
  legend2Catalog,
  legend3Catalog,
  listImplementedOperations,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@rangers-strike/engine";
import {
  canMoveUnitToBattleExceptHoldRequirements,
  getLegalActions,
} from "@rangers-strike/engine";
import {
  assertAllImplementedOperationsCovered,
  assertCatalogMatchesMechanisms,
  listOperationCoverageGaps,
  listUnitEffectCoverageGaps,
  OPERATION_UI_MECHANISMS,
} from "./webUiEffectCoverage";
import { resolveOperationDropRoute } from "./webUiOperationRouting";
import {
  cardHasOperationEffect,
  resolveBattleEntryUiRoute,
} from "./webUiIntegration";

const ALL_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries(
  allCardsCatalog.cards.map((card) => [card.id, card]),
);

function inst(cardId: string, suffix: string): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId };
}

function emptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    damage: 0,
  };
}

function makeState(options: {
  phase?: GameState["phase"];
  activePlayer?: PlayerId;
  player1?: Partial<PlayerState>;
  player2?: Partial<PlayerState>;
}): GameState {
  return {
    turn: 1,
    activePlayer: options.activePlayer ?? "player1",
    firstPlayer: "player1",
    phase: options.phase ?? "battle",
    players: {
      player1: { ...emptyPlayer("player1"), ...options.player1 },
      player2: { ...emptyPlayer("player2"), ...options.player2 },
    },
    definitions: ALL_DEFINITIONS,
    log: [],
    winner: null,
  };
}

function unheldCommand(cardId = "RS-010"): CardInstance {
  return inst(cardId, "cmd");
}

const ALL_CARDS = allCardsCatalog.cards;
const HOLD_ENTRY_UNITS = ALL_CARDS.filter(
  (card) => card.type === "unit" && getBattleEntryHoldCount(card.id) > 0,
);
const OPERATION_CARDS = ALL_CARDS.filter((card) => card.type === "operation");
const EFFECT_OPERATIONS = OPERATION_CARDS.filter((card) => cardHasOperationEffect(card.id));

describe("Web UI integration — all catalog cards", () => {
  it.each(ALL_CARDS.map((card) => [card.id, card] as const))(
    "%s is loadable for deck builder and card modal",
    (cardId, card) => {
      expect(getCardById(cardId)).toEqual(card);
      expect(card.name.length).toBeGreaterThan(0);
      expect(["unit", "operation", "power", "command"].includes(card.type)).toBe(true);
      if (card.imageUrl) {
        expect(card.imageUrl.startsWith("/cards/")).toBe(true);
      }
    },
  );

  it.each(
    [...legend1Catalog.cards, ...legend2Catalog.cards, ...legend3Catalog.cards].map(
      (card) => [card.id, card.imageUrl] as const,
    ),
  )("%s has imageUrl for web display", (cardId, imageUrl) => {
    expect(imageUrl).toMatch(/^\/cards\/legend[123]\/.+\.jpg$/);
    expect(getCardById(cardId)?.imageUrl).toBe(imageUrl);
  });
});

describe("Web UI integration — operation cards", () => {
  it("maps every implemented operation effect to UI mechanisms", () => {
    expect(listOperationCoverageGaps()).toEqual([]);
    assertAllImplementedOperationsCovered();
    assertCatalogMatchesMechanisms();
  });

  it.each(EFFECT_OPERATIONS.map((card) => [card.id] as const))(
    "%s resolves operation drop route without error",
    (cardId) => {
      const route = resolveOperationDropRoute(cardId);
      const effect = getCardEffect(cardId);
      expect(effect).toBeDefined();
      const mechanisms = OPERATION_UI_MECHANISMS[effect!.effectId] ?? [];
      expect(mechanisms.length).toBeGreaterThan(0);

      if (route.kind === "cyber_s_rider_modal") {
        expect(mechanisms).toContain("operation_cyber_s_rider_modal");
      } else if (route.kind === "target_modal") {
        expect(mechanisms).toContain("operation_drag_target_modal");
      } else {
        expect(mechanisms.some((m) => m.startsWith("operation_"))).toBe(true);
      }
    },
  );

  it.each(listImplementedOperations().map((op) => [op.cardId, op.effectId] as const))(
    "%s (%s) catalog entry matches implemented operation",
    (cardId, effectId) => {
      expect(getCardEffect(cardId)?.effectId).toBe(effectId);
      expect(OPERATION_UI_MECHANISMS[effectId]).toBeDefined();
    },
  );
});

describe("Web UI integration — wired unit effects", () => {
  it("maps every wired unit effect trigger to a UI mechanism", () => {
    expect(listUnitEffectCoverageGaps()).toEqual([]);
  });
});

describe("Web UI integration — battle entry hold (※) UI route", () => {
  it.each(HOLD_ENTRY_UNITS.map((card) => [card.id] as const))(
    "%s opens command payment when hold is missing (GameApp path)",
    (cardId) => {
      const unit = inst(cardId, "rush");
      const state = makeState({
        phase: "battle",
        player1: {
          rush: [unit],
          command: [unheldCommand()],
        },
      });

      if (!canMoveUnitToBattleExceptHoldRequirements(state, "player1", unit, "rush")) {
        return;
      }

      const route = resolveBattleEntryUiRoute(state, "player1", unit.instanceId);
      expect(route.kind).toBe("command_payment");
    },
  );
});

describe("Web UI integration — RS-152 scorching roar", () => {
  it("routes to direct move_to_battle when gaolion is in rush and discard has same name", () => {
    const gaolion = inst("RS-152", "lion");
    const eagle = inst("RS-153", "eagle");
    const eagleDiscard = inst("RS-153", "eagle-discard");
    const state = makeState({
      phase: "battle",
      player1: {
        rush: [gaolion, eagle],
        discard: [eagleDiscard],
        command: [unheldCommand()],
      },
    });

    expect(resolveBattleEntryUiRoute(state, "player1", eagle.instanceId)).toEqual({
      kind: "move_to_battle",
    });
    expect(
      getLegalActions(state).some(
        (action) =>
          action.type === "move_to_battle" && action.instanceId === eagle.instanceId,
      ),
    ).toBe(true);
  });

  it("routes to command payment when same-name discard is missing", () => {
    const gaolion = inst("RS-152", "lion");
    const eagle = inst("RS-153", "eagle");
    const state = makeState({
      phase: "battle",
      player1: {
        rush: [gaolion, eagle],
        command: [unheldCommand()],
      },
    });

    expect(resolveBattleEntryUiRoute(state, "player1", eagle.instanceId)).toEqual({
      kind: "command_payment",
    });
  });

  it("routes to direct move_to_battle when gaolion is in battle (not only rush)", () => {
    const gaolion = inst("RS-152", "lion");
    const eagle = inst("RS-153", "eagle");
    const eagleDiscard = inst("RS-153", "eagle-discard");
    const state = makeState({
      phase: "battle",
      player1: {
        battle: [gaolion],
        rush: [eagle],
        discard: [eagleDiscard],
        command: [unheldCommand()],
      },
    });

    expect(resolveBattleEntryUiRoute(state, "player1", eagle.instanceId)).toEqual({
      kind: "move_to_battle",
    });
  });
});
