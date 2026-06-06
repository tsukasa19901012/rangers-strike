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
import { applyAction, getReactionChooserPlayerId } from "@rangers-strike/engine";
import {
  cardHasOperationEffect,
  resolveBattleEntryUiRoute,
  resolveReactionModalUi,
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

function releasedCommand(cmdId: string, suffix: string): CardInstance {
  return inst(cmdId, suffix);
}

function powerStack(count: number, prefix: string): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst("RS-067", `${prefix}${i}`));
}

type CounterUiSpec = {
  cardId: string;
  effectId: string;
  cmdId: string;
  powerCount: number;
  kind: "battle" | "rush" | "leave";
};

const OPERATION_COUNTER_SPECS: CounterUiSpec[] = [
  { cardId: "RS-006", effectId: "new_gymnastics", cmdId: "RS-007", powerCount: 1, kind: "battle" },
  { cardId: "RS-016", effectId: "dino_chronicle", cmdId: "RS-025", powerCount: 4, kind: "leave" },
  { cardId: "RS-018", effectId: "hidden_ninja", cmdId: "RS-057", powerCount: 4, kind: "battle" },
  { cardId: "RS-026", effectId: "shippu_ninja", cmdId: "RS-057", powerCount: 3, kind: "rush" },
  { cardId: "RS-027", effectId: "dino_guts", cmdId: "RS-025", powerCount: 0, kind: "leave" },
];

function makeCounterReactionState(spec: CounterUiSpec): GameState {
  const counter = inst(spec.cardId, "counter");
  const cmd = releasedCommand(spec.cmdId, "cmd");
  const humanResources = {
    hand: [counter],
    command: [cmd],
    power: powerStack(spec.powerCount, "pw"),
  };

  if (spec.kind === "rush") {
    const rushedUnit = inst("RS-053", "rushed");
    return {
      ...makeState({
        phase: "rush",
        activePlayer: CPU_PLAYER,
        player1: humanResources,
        player2: { rush: [rushedUnit] },
      }),
      pendingRush: {
        rusherPlayerId: CPU_PLAYER,
        rushedInstanceId: rushedUnit.instanceId,
        phasePlayerId: CPU_PLAYER,
      },
    };
  }

  if (spec.kind === "battle") {
    const attacker = inst("RS-053", "attacker");
    const defender = inst("RS-054", "defender");
    const substitute = inst("RS-055", "substitute");
    return {
      ...makeState({
        phase: "battle",
        activePlayer: CPU_PLAYER,
        player1: {
          ...humanResources,
          battle: [defender],
          rush: spec.cardId === "RS-018" ? [substitute] : [],
        },
        player2: { battle: [attacker] },
      }),
      pendingBattle: {
        attackerPlayerId: CPU_PLAYER,
        attackerInstanceId: attacker.instanceId,
        defenderPlayerId: HUMAN_PLAYER,
        defenderInstanceId: defender.instanceId,
        phasePlayerId: CPU_PLAYER,
      },
    };
  }

  const attacker = inst("RS-053", "attacker");
  const leaving =
    spec.cardId === "RS-027" ? inst("RS-053", "leaving-m") : inst("RS-054", "leaving-s");
  return {
    ...makeState({
      phase: "battle",
      activePlayer: CPU_PLAYER,
      player1: {
        ...humanResources,
        battle: [leaving],
        discard: spec.cardId === "RS-016" ? [inst("RS-054", "twin")] : [],
        deck: spec.cardId === "RS-027" ? powerStack(3, "deck") : [],
      },
      player2: { battle: [attacker] },
    }),
    pendingLeave: {
      ownerPlayerId: HUMAN_PLAYER,
      instanceId: leaving.instanceId,
      fromZone: "battle",
      toZone: "discard",
      leavingCardId: leaving.cardId,
      phasePlayerId: CPU_PLAYER,
    },
  };
}

const HUMAN_PLAYER: PlayerId = "player1";
const CPU_PLAYER: PlayerId = "player2";

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

describe("Web UI integration — operation counter reaction modal", () => {
  it.each(OPERATION_COUNTER_SPECS)(
    "maps $effectId to operation_counter_reaction UI mechanism",
    ({ effectId }) => {
      expect(OPERATION_UI_MECHANISMS[effectId as keyof typeof OPERATION_UI_MECHANISMS]).toContain(
        "operation_counter_reaction",
      );
    },
  );

  it.each(OPERATION_COUNTER_SPECS)(
    "shows $cardId counter when human can pay with released command ($kind)",
    (spec) => {
      const state = makeCounterReactionState(spec);
      const counter = inst(spec.cardId, "counter");

      expect(getReactionChooserPlayerId(state)).toBe(HUMAN_PLAYER);

      const ui = resolveReactionModalUi(state, HUMAN_PLAYER);
      expect(ui.kind).toBe(spec.kind);
      expect(ui.showModal).toBe(true);
      expect(ui.counterInstanceIds).toContain(counter.instanceId);
      expect(ui.counterTargetLabels[counter.instanceId]).toMatch(/^対象: .+（.+）$/);
      expect(ui.canPass).toBe(true);
    },
  );

  it("shows RS-026 counter when rusher has a pending effect choice", () => {
    const spec = OPERATION_COUNTER_SPECS.find((entry) => entry.cardId === "RS-026")!;
    const counter = inst(spec.cardId, "counter");
    const rusherCommand = inst("RS-057", "rusher-cmd");
    let state = makeCounterReactionState(spec);
    state = {
      ...state,
      pendingEffectChoice: {
        playerId: CPU_PLAYER,
        effectId: "air_transport",
        sourceCardId: "RS-124",
        kind: "select_command",
        phasePlayerId: CPU_PLAYER,
        validInstanceIds: [rusherCommand.instanceId],
        optional: true,
        commandFilter: "released",
        commandAction: "rush",
      },
      players: {
        ...state.players,
        player2: {
          ...state.players.player2,
          command: [...state.players.player2.command, rusherCommand],
        },
      },
    };

    const ui = resolveReactionModalUi(state, HUMAN_PLAYER);
    expect(ui.counterInstanceIds).toContain(counter.instanceId);
  });

  it.each(OPERATION_COUNTER_SPECS)(
    "does not list $cardId when only pre-held command is available",
    (spec) => {
      const counter = inst(spec.cardId, "counter");
      const held = { ...releasedCommand(spec.cmdId, "held"), commandHeld: true };
      let state = makeCounterReactionState(spec);
      state = {
        ...state,
        players: {
          ...state.players,
          player1: {
            ...state.players.player1,
            hand: [counter],
            command: [held],
            power: [],
          },
        },
      };

      const ui = resolveReactionModalUi(state, HUMAN_PLAYER);
      expect(ui.counterInstanceIds).not.toContain(counter.instanceId);
    },
  );

  it("applies RS-026 via command payment then auto counter resolution", () => {
    const spec = OPERATION_COUNTER_SPECS.find((entry) => entry.cardId === "RS-026")!;
    const state = makeCounterReactionState(spec);
    const counter = inst(spec.cardId, "counter");
    const cmd = releasedCommand(spec.cmdId, "cmd");
    const rushedUnit = state.players.player2.rush[0]!;

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: HUMAN_PLAYER,
      kind: "category_use",
      sourceInstanceId: counter.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const paid = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: HUMAN_PLAYER,
      commandInstanceIds: [cmd.instanceId],
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.state.players.player2.rush).toHaveLength(0);
    expect(paid.state.players.player2.deck[0]?.instanceId).toBe(rushedUnit.instanceId);
  });

  it("applies RS-006 via command payment in battle reaction window", () => {
    const spec = OPERATION_COUNTER_SPECS.find((entry) => entry.cardId === "RS-006")!;
    const state = makeCounterReactionState(spec);
    const counter = inst(spec.cardId, "counter");
    const cmd = releasedCommand(spec.cmdId, "cmd");
    const defender = state.players.player1.battle[0]!;

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: HUMAN_PLAYER,
      kind: "category_use",
      sourceInstanceId: counter.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const paid = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: HUMAN_PLAYER,
      commandInstanceIds: [cmd.instanceId],
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.state.players.player1.rush.some((c) => c.instanceId === defender.instanceId)).toBe(
      true,
    );
  });
});
