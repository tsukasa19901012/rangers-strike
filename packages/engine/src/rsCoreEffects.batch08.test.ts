import { describe, expect, it } from "vitest";
import { winButDestroyedVsSp1 } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { attackedBpBoostAmount } from "./dsl/promotedKeywordBridge";
import { legend3FieldBpBonus } from "./rules/legend3/fieldEffects";
import {
  battleFillers,
  battleUnit,
  legendDefinitions,
} from "./testing/battleEntry";
import {
  createTestState,
  heldWbCommand,
  inst,
} from "./testing/fixtures";

const defs = legendDefinitions;

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

const SR_CORE_BATCH08 = ["SR-001", "SR-002", "SR-003", "SR-004", "SR-005", "SR-006", "SR-007", "SR-008"];

describe("SR-001..008 catalog coverage", () => {
  it.each(SR_CORE_BATCH08)("catalog includes %s", (cardId) => {
    expect(defs[cardId]).toBeDefined();
  });
});

describe("SR-001 heaven_earth_animal_heart", () => {
  it("adds +2000 BP per WB M-unit in own battle area", () => {
    const gaoking = inst("SR-001", "gaoking");
    const wbM = inst("RS-152", "gaolion");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [gaoking, wbM] },
    });
    const bonus = legend3FieldBpBonus(state, "player1", gaoking, "general");
    expect(bonus).toBe(2000);
  });

  it("stacks +2000 per additional WB M-unit", () => {
    const gaoking = inst("SR-001", "gaoking");
    const wbM1 = inst("RS-152", "gaolion1");
    const wbM2 = inst("RS-153", "gaoeagle");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [gaoking, wbM1, wbM2] },
    });
    const bonus = legend3FieldBpBonus(state, "player1", gaoking, "general");
    expect(bonus).toBe(4000);
  });

  it("gives no bonus when no WB M-units in battle", () => {
    const gaoking = inst("SR-001", "gaoking");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [gaoking] },
    });
    const bonus = legend3FieldBpBonus(state, "player1", gaoking, "general");
    expect(bonus).toBe(0);
  });
});

describe("SR-004 win_but_destroyed_vs_sp1", () => {
  it("winButDestroyedVsSp1 returns true for SR-004", () => {
    expect(winButDestroyedVsSp1("SR-004")).toBe(true);
  });

  it("SR-004 is destroyed even when winning against SP1 attacker during enemy turn", () => {
    // SR-004 (5000 BP) defends against TST-UNIT-0 (1000 BP, SP1) during enemy turn
    const hedrian = inst("SR-004", "hedrian");
    const attacker = inst("TST-UNIT-0", "attacker");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player1: {
        battle: [hedrian],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [attacker],
        command: [heldWbCommand("c3")],
      },
    });
    const battleAction = getLegalActions(state).find(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === attacker.instanceId &&
        a.defenderInstanceId === hedrian.instanceId,
    );
    expect(battleAction).toBeDefined();
    const after = unwrap(applyAction(state, battleAction!));
    // SR-004 wins (5000 > 1000) but should be destroyed too
    expect(after.players.player1.discard.some((c) => c.instanceId === hedrian.instanceId)).toBe(true);
    // Attacker (1000 BP < 5000 BP) is also destroyed
    expect(after.players.player2.discard.some((c) => c.instanceId === attacker.instanceId)).toBe(true);
  });
});

describe("SR-005 デカレッドバトライザー", () => {
  it("has attacked_bp_boost of 5000", () => {
    expect(attackedBpBoostAmount("SR-005")).toBe(5000);
  });
});

describe("SR-007 大神龍", () => {
  it("is in catalog with correct stats", () => {
    const def = defs["SR-007"];
    expect(def).toBeDefined();
    expect(def?.bp).toBe(30000);
    expect(def?.size).toBe("XL");
  });

  it("cannot initiate attack actions when in battle", () => {
    const daishinryu = inst("SR-007", "daishinryu");
    const enemy = inst("TST-UNIT-0", "enemy");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [daishinryu, ...battleFillers(1)],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [enemy],
        command: [heldWbCommand("c3")],
      },
    });
    const actions = getLegalActions(state);
    const attackActions = actions.filter(
      (a) => a.type === "battle" && a.attackerInstanceId === daishinryu.instanceId,
    );
    expect(attackActions).toHaveLength(0);
  });
});

describe("SR-008 ビッグワン", () => {
  it("is in catalog as ET S-unit with bp 4000", () => {
    const def = defs["SR-008"];
    expect(def).toBeDefined();
    expect(def?.category).toBe("ET");
    expect(def?.size).toBe("S");
    expect(def?.bp).toBe(4000);
  });
});

describe("SR-002 スーパーフォーメーション", () => {
  it("is in catalog as ET operation with powerCost 6", () => {
    const def = defs["SR-002"];
    expect(def).toBeDefined();
    expect(def?.type).toBe("operation");
    expect(def?.category).toBe("ET");
    expect(def?.powerCost).toBe(6);
  });
});

describe("SR-003 アームドティラノレンジャー", () => {
  it("is in catalog as WB S-unit with bp 4000", () => {
    const def = defs["SR-003"];
    expect(def).toBeDefined();
    expect(def?.bp).toBe(4000);
    expect(def?.size).toBe("S");
    expect(def?.category).toBe("WB");
  });

  it("has 獣奏剣 feature", () => {
    const def = defs["SR-003"];
    expect(def?.features).toContain("獣奏剣");
  });
});

describe("SR-006 シュリケンジャーFM", () => {
  it("is in catalog as MA S-unit with SP1 and bp 4500", () => {
    const def = defs["SR-006"];
    expect(def).toBeDefined();
    expect(def?.bp).toBe(4500);
    expect(def?.sp).toBe(1);
    expect(def?.category).toBe("MA");
  });
});
