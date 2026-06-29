import { describe, expect, it } from "vitest";
import type { CardDefinition, CardInstance } from "@rangers-strike/cards";
import { generatedCorePlayableCatalog as corePlayableCatalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import {
  applyShirubaOnRush,
  bpLastThreeDigits,
  collectBpLastThree500UnitIds,
} from "./rules/namedUnitEffects";
import { isValidEffectChoiceTarget, openEffectChoice } from "./rules/pendingChoices";
import { isValidZordUpMaterial } from "./rules/zord";
import {
  battleFillers,
  legendDefinitions,
  moveToBattle,
} from "./testing/battleEntry";
import {
  createTestState,
  heldWbCommand,
  inst,
  TEST_DEFINITIONS,
} from "./testing/fixtures";

const defs: Record<string, CardDefinition> = {
  ...TEST_DEFINITIONS,
  ...legendDefinitions,
  ...Object.fromEntries(corePlayableCatalog.cards.map((card) => [card.id, card])),
};

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

describe("RS-686 セイクウインパルス power-zone choice", () => {
  it("allows selecting opponent face-up power units for discard", () => {
    const striker = inst("RS-686", "striker");
    const powerTarget = inst("TST-UNIT-0", "power-target");
    const state = createTestState({
      definitions: defs,
      activePlayer: "player1",
      player2: {
        power: [{ ...powerTarget, faceDown: false }],
      },
    });

    const withChoice = openEffectChoice(state, {
      playerId: "player1",
      effectId: "seikuuinparusu",
      sourceCardId: "RS-686",
      sourceInstanceId: striker.instanceId,
      kind: "select_unit",
      phasePlayerId: "player1",
      validInstanceIds: [powerTarget.instanceId],
      optional: true,
    });

    expect(
      isValidEffectChoiceTarget(withChoice, withChoice.pendingEffectChoice!, powerTarget.instanceId),
    ).toBe(true);

    const resolveActions = getLegalActions(withChoice).filter(
      (a) => a.type === "resolve_effect_choice",
    );
    expect(resolveActions.some((a) => a.instanceId === powerTarget.instanceId)).toBe(
      true,
    );
  });
});

describe("RS-625 シルバー専用機 rush additional condition", () => {
  const silverS = defs["RS-585"]!;

  it("accepts シルバー feature S units, not name match alone", () => {
    const silverCard = inst("RS-585", "silver");
    const nonSilver = inst("TST-UNIT-0", "plain");

    expect(
      isValidZordUpMaterial(defs, "RS-625", "rusher-id", silverCard),
    ).toBe(true);
    expect(
      isValidZordUpMaterial(defs, "RS-625", "rusher-id", nonSilver),
    ).toBe(false);
  });

  it("grants BP+2000 and SP1 when discarded material had SP", () => {
    const mega = {
      ...inst("RS-625", "mega"),
      zordMaterialCardId: "RS-585",
    };
    const state = createTestState({
      definitions: defs,
      activePlayer: "player1",
      player1: {
        rush: [mega],
      },
    });

    const result = applyShirubaOnRush(state, "player1", mega.instanceId);
    const rushed = result.state.players.player1.rush[0]!;
    expect(rushed.bpModifier).toBe(2000);
    expect(rushed.spModifier).toBe(1);
  });

  it("does nothing when discarded material had blank SP", () => {
    const noSpDef: CardDefinition = {
      ...TEST_DEFINITIONS["TST-UNIT-0"]!,
      id: "TST-NO-SP",
      sp: undefined,
    };
    const mega = {
      ...inst("RS-625", "mega"),
      zordMaterialCardId: "TST-NO-SP",
    };
    const state = createTestState({
      definitions: { ...defs, "TST-NO-SP": noSpDef },
      activePlayer: "player1",
      player1: {
        rush: [mega],
      },
    });

    const result = applyShirubaOnRush(state, "player1", mega.instanceId);
    const rushed = result.state.players.player1.rush[0]!;
    expect(rushed.bpModifier ?? 0).toBe(0);
    expect(rushed.spModifier ?? 0).toBe(0);
  });
});

describe("RS-685 ブラックコンドル", () => {
  it("bpLastThreeDigits treats 2500 and 8500 as 500", () => {
    expect(bpLastThreeDigits(2500)).toBe(500);
    expect(bpLastThreeDigits(8500)).toBe(500);
    expect(bpLastThreeDigits(2400)).toBe(400);
  });

  it("collects enemy S units with BP last three digits 500", () => {
    const targetDef: CardDefinition = {
      ...TEST_DEFINITIONS["TST-UNIT-0"]!,
      id: "TST-BP-2500",
      bp: 2500,
      size: "S",
    };
    const target = inst("TST-BP-2500", "target");
    const state = createTestState({
      definitions: { ...defs, "TST-BP-2500": targetDef },
      player2: {
        battle: [target],
      },
    });
    expect(collectBpLastThree500UnitIds(state, "player2", { size: "S" })).toContain(
      target.instanceId,
    );
  });

  it("opens buringasodo destroy choice at NC position 5", () => {
    const condor = inst("RS-685", "condor");
    const targetDef: CardDefinition = {
      ...TEST_DEFINITIONS["TST-UNIT-0"]!,
      id: "TST-BP-1500",
      bp: 1500,
      size: "S",
    };
    const target = inst("TST-BP-1500", "target");
    const state = createTestState({
      definitions: { ...defs, "TST-BP-1500": targetDef },
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [condor],
        battle: battleFillers(4),
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [target],
        command: [heldWbCommand("c2")],
      },
    });

    const next = moveToBattle(state, condor.instanceId);
    expect(next.pendingEffectChoice?.effectId).toBe("buringasodo");
    expect(next.pendingEffectChoice?.validInstanceIds).toContain(target.instanceId);
    expect(next.players.player1.battle.find((c) => c.instanceId === condor.instanceId)?.spModifier).toBe(1);
  });

  it("deals 1 damage when destroying enemy with BP last three digits 500 on own turn", () => {
    const condor = inst("RS-685", "condor");
    const targetDef: CardDefinition = {
      ...TEST_DEFINITIONS["TST-UNIT-0"]!,
      id: "TST-BP-500",
      bp: 500,
      size: "S",
    };
    const target = inst("TST-BP-500", "target");
    const state = createTestState({
      definitions: { ...defs, "TST-BP-500": targetDef },
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [condor],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [target],
        command: [heldWbCommand("c2")],
      },
    });

    const battle = getLegalActions(state).find(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === condor.instanceId &&
        a.defenderInstanceId === target.instanceId,
    );
    expect(battle).toBeDefined();

    const next = unwrap(applyAction(state, battle!));
    expect(next.players.player2.damage).toBe(1);
    expect(next.log.some((entry) => entry.includes("black_condor_destroy_damage"))).toBe(true);
  });
});
