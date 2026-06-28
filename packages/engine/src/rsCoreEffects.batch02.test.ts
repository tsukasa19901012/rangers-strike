import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { legend1Catalog, legend2Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { canStrikeUnit } from "./rules/combo";
import { cannotAttackOrStrikeThisTurn } from "./rules/restrictions";
import {
  canRunEnterBattleConditionalEffect,
  resolveNamedOnRushEffects,
} from "./rules/namedUnitEffects";
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
import { rushWithCategoryHold } from "./testing/rushPayment";

const defs: Record<string, CardDefinition> = {
  ...TEST_DEFINITIONS,
  ...legendDefinitions,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

const RS_CORE_BATCH02 = Array.from({ length: 45 }, (_, index) =>
  `RS-${String(46 + index).padStart(3, "0")}`,
);

describe("RS core batch02 audit coverage", () => {
  it.each(RS_CORE_BATCH02)("catalog includes %s", (cardId) => {
    expect(defs[cardId] ?? legend1Catalog.cards.find((c) => c.id === cardId)).toBeDefined();
  });
});

describe("RS-046 Pat Armor", () => {
  it("armor attack opens enemy battle target on rush", () => {
    const armor = inst("RS-046", "armor");
    const enemyUnit = inst("TST-UNIT-2", "enemy");
    const state = createTestState({
      definitions: defs,
      player1: { rush: [armor] },
      player2: { battle: [enemyUnit] },
    });

    const result = resolveNamedOnRushEffects(
      state,
      "player1",
      armor.instanceId,
      "player1",
    );

    expect(result.state.pendingEffectChoice?.effectId).toBe("armor_attack");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(
      enemyUnit.instanceId,
    );
  });
});

describe("RS-051 Super Drill", () => {
  it("opens optional hand choice on own-turn battle entry", () => {
    const drill = inst("RS-051", "drill");
    const handTarget = inst("RS-051", "hand-copy");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [drill],
        battle: battleFillers(1),
        hand: [handTarget],
        command: [
          { ...inst("RS-007", "cmd1"), commandHeld: true },
          { ...inst("RS-007", "cmd2"), commandHeld: false },
        ],
      },
    });

    const paid = unwrap(
      applyAction(state, {
        type: "initiate_command_payment",
        playerId: "player1",
        kind: "battle_entry",
        sourceInstanceId: drill.instanceId,
      }),
    );
    const entered = unwrap(
      applyAction(paid, {
        type: "resolve_command_payment",
        playerId: "player1",
        commandInstanceIds: [paid.players.player1.command[1]!.instanceId],
      }),
    );

    expect(entered.pendingEffectChoice?.effectId).toBe("super_drill");
    expect(entered.pendingEffectChoice?.kind).toBe("select_hand");
  });

  it("only runs on own turn during battle phase", () => {
    expect(
      canRunEnterBattleConditionalEffect(
        createTestState({ phase: "battle", activePlayer: "player1" }),
        "player1",
        "super_drill",
      ),
    ).toBe(true);
    expect(
      canRunEnterBattleConditionalEffect(
        createTestState({ phase: "battle", activePlayer: "player1" }),
        "player2",
        "super_drill",
      ),
    ).toBe(false);
    expect(
      canRunEnterBattleConditionalEffect(
        createTestState({ phase: "rush", activePlayer: "player1" }),
        "player1",
        "super_drill",
      ),
    ).toBe(false);
  });
});

describe("RS-052 Super Shield", () => {
  it("substitutes shield when WB ally would be destroyed", () => {
    const shield = inst("RS-052", "shield");
    const ally = inst("TST-UNIT-0", "ally");
    const attacker = inst("TST-UNIT-2", "attacker");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      definitions: defs,
      player1: {
        battle: [shield, ally],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [attacker],
        command: [heldWbCommand("c3")],
      },
    });

    const battle = getLegalActions(state).find(
      (a) => a.type === "battle" && a.defenderInstanceId === ally.instanceId,
    );
    expect(battle).toBeDefined();

    let next = unwrap(applyAction(state, battle!));
    expect(next.pendingLeave?.superShieldInstanceId).toBe(shield.instanceId);

    next = unwrap(
      applyAction(next, { type: "use_super_shield", playerId: "player1" }),
    );

    expect(next.players.player1.battle.some((c) => c.instanceId === ally.instanceId)).toBe(
      true,
    );
    expect(next.players.player1.discard.some((c) => c.instanceId === shield.instanceId)).toBe(
      true,
    );
    expect(next.pendingLeave).toBeUndefined();
  });
});

describe("RS-065 Focused Breakthrough", () => {
  it("deals 1 damage when RS-065 destroys SP1 unit", () => {
    const focused = inst("RS-065", "fb");
    const target = inst("TST-UNIT-0", "target");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        battle: [focused],
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
        a.attackerInstanceId === focused.instanceId &&
        a.defenderInstanceId === target.instanceId,
    );
    expect(battle).toBeDefined();

    const next = unwrap(applyAction(state, battle!));
    expect(next.players.player2.damage).toBe(1);
    expect(next.log.some((entry) => entry.includes("focused_breakthrough"))).toBe(true);
  });

  it("deals 1 damage when RS-065 destroys SP! unit", () => {
    const focused = inst("RS-065", "fb");
    const spBangDef: CardDefinition = {
      id: "TST-SP-BANG",
      name: "SP Bang",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 500,
      sp: "special",
      size: "S",
    };
    const target = inst("TST-SP-BANG", "sp-bang");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: { ...defs, "TST-SP-BANG": spBangDef },
      player1: {
        battle: [focused],
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
        a.attackerInstanceId === focused.instanceId &&
        a.defenderInstanceId === target.instanceId,
    );
    expect(battle).toBeDefined();

    const next = unwrap(applyAction(state, battle!));
    expect(next.players.player2.damage).toBe(1);
  });

  it("does not deal damage when ally destroys non-SP target", () => {
    const focused = inst("RS-065", "fb");
    const striker = inst("TST-UNIT-2", "striker");
    const target: CardDefinition = {
      ...TEST_DEFINITIONS["TST-UNIT-2"]!,
      id: "TST-NO-SP",
      sp: undefined,
    };
    const noSpTarget = inst("TST-NO-SP", "target");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: { ...defs, "TST-NO-SP": target },
      player1: {
        battle: [focused, striker],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [noSpTarget],
        command: [heldWbCommand("c2")],
      },
    });

    const battle = getLegalActions(state).find(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === striker.instanceId &&
        a.defenderInstanceId === noSpTarget.instanceId,
    );
    expect(battle).toBeDefined();

    const next = unwrap(applyAction(state, battle!));
    expect(next.players.player2.damage).toBe(0);
    expect(next.log.some((entry) => entry.includes("focused_breakthrough"))).toBe(false);
  });
});

describe("RS-075 Rescue Activity", () => {
  it("opens discard-to-hand choice on rush", () => {
    const rescue = inst("RS-075", "rescue");
    const mecha = inst("RS-043", "mecha");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [rescue],
        discard: [mecha],
        power: Array.from({ length: 2 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [inst("TST-OP-ET", "cmd")],
      },
    });

    const result = resolveNamedOnRushEffects(
      state,
      "player1",
      rescue.instanceId,
      "player1",
    );
    expect(result.state.pendingEffectChoice?.effectId).toBe("rescue_activity");
  });
});

describe("RS-084 Sure Win Combination", () => {
  it("deals 2 damage on rush", () => {
    const fusion = inst("RS-084", "fusion");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [fusion],
        power: Array.from({ length: 8 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [inst("TST-OP-MA", "cmd")],
      },
      player2: { damage: 0 },
    });

    const result = resolveNamedOnRushEffects(
      state,
      "player1",
      fusion.instanceId,
      "player1",
    );
    expect(result.state.players.player2.damage).toBe(2);
  });
});

describe("RS-090 Red Racer", () => {
  it("cannot attack or strike on the turn it was rushed", () => {
    const racer = inst("RS-090", "racer");
    const player = {
      battle: [racer, ...battleFillers(2)],
      modifiers: [
        {
          kind: "restriction" as const,
          instanceId: racer.instanceId,
          restriction: "rushed_this_turn",
          scope: "turn" as const,
        },
      ],
    };
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: player,
      player2: { battle: battleFillers(2) },
    });

    expect(cannotAttackOrStrikeThisTurn(state.players.player1, racer)).toBe(true);
    expect(canStrikeUnit(defs, racer, state, "player1")).toBe(false);

    const attacks = getLegalActions(state).filter((a) => a.type === "battle");
    expect(attacks.some((a) => a.attackerInstanceId === racer.instanceId)).toBe(false);

    const strikes = getLegalActions(state).filter((a) => a.type === "strike");
    expect(strikes.some((a) => a.instanceId === racer.instanceId)).toBe(false);
  });

  it("auto-enters battle when rushed if possible", () => {
    const racer = inst("RS-090", "racer");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [racer],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [inst("TST-OP-OT", "ot-pay")],
      },
    });
    const result = rushWithCategoryHold(
      state,
      "player1",
      racer.instanceId,
      "TST-OP-OT:ot-pay",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.player1.battle.some((c) => c.cardId === "RS-090")).toBe(
      true,
    );
    expect(result.state.players.player1.rush.some((c) => c.cardId === "RS-090")).toBe(
      false,
    );
  });
});

describe("RS-047 Pat Signer", () => {
  it("blocks M units with BP5000+ from battle entry", () => {
    const signer = inst("RS-047", "signer");
    const heavy = inst("RS-051", "heavy");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      definitions: defs,
      player1: {
        rush: [heavy],
        battle: [signer],
        command: [
          { ...inst("RS-007", "cmd1"), commandHeld: true },
          { ...inst("RS-007", "cmd2"), commandHeld: false },
        ],
      },
    });

    const move = getLegalActions(state).find(
      (a) => a.type === "move_to_battle" && a.instanceId === heavy.instanceId,
    );
    expect(move).toBeUndefined();
  });
});

describe("RS-054 Tyranno Rod", () => {
  it("auto-enters battle each turn when possible", () => {
    const rod = inst("RS-054", "rod");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [rod],
        battle: battleFillers(1),
      },
    });

    const next = moveToBattle(state, rod.instanceId);
    expect(next.players.player1.battle.some((c) => c.cardId === "RS-054")).toBe(true);
  });
});
