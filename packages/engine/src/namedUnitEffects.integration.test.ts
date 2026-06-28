import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { formatGameLog, isNoteworthyResolveEffectChoice } from "./log/formatLog";
import { resolveNamedOnRushEffects } from "./rules/namedUnitEffects";
import { legendDefinitions } from "./testing/battleEntry";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";

const defs = legendDefinitions;

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) {
    throw new Error(result.error ?? "unknown");
  }
  return result.state;
}

describe("on-rush named effects", () => {
  it("RS-046 armor attack opens enemy battle unit choice", () => {
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

  it("RS-046 armor attack resolve log includes target card for effect notice", () => {
    const entry =
      "player2|resolve_effect_choice|RS-046|パトアーマー|armor_attack:Test Unit";
    expect(isNoteworthyResolveEffectChoice("armor_attack:Test Unit")).toBe(true);
    expect(formatGameLog(entry, defs)).toBe(
      "CPUの「パトアーマー」がアーマーアタックを発動 → 「Test Unit」をパワーへ",
    );
  });
});

describe("conditional battle entry", () => {
  it("RS-051 super drill opens optional hand choice on enter", () => {
    const drill = inst("RS-051", "drill");
    const partner = inst("RS-052", "shield");
    const handTarget = inst("RS-051", "hand-copy");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [drill],
        battle: [partner],
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
});

describe("super shield RS-052", () => {
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
    expect(next.pendingLeave).toBeDefined();
    expect(next.pendingLeave?.superShieldInstanceId).toBe(shield.instanceId);

    next = unwrap(
      applyAction(next, { type: "use_super_shield", playerId: "player1" }),
    );

    expect(next.players.player1.battle.some((c) => c.instanceId === ally.instanceId)).toBe(true);
    expect(next.players.player1.discard.some((c) => c.instanceId === shield.instanceId)).toBe(true);
    expect(next.pendingLeave).toBeUndefined();
  });
});

describe("focused breakthrough RS-065", () => {
  it("deals 1 damage when RS-065 destroys SP1+ unit", () => {
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
});
