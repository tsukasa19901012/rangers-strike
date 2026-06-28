import type { CardDefinition } from "@rangers-strike/cards";
import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { effectiveBp, hasOperationEffect, superPowerAttackBonus } from "./core/catalog";
import { battleAttackerBpBonus, battleDefenderBp } from "./rules/namedUnitEffects";
import { passiveNamedFieldBpBonus } from "./rules/fieldAuras";
import { collectHiddenNinjaSubstitutes, finalizeLeaveReaction } from "./rules/operationCounters";
import { getComboNumberDelta, getSComboFinisher } from "./rules/turnModifierBridge";
import {
  canRunEnterBattleConditionalEffect,
  resolveNamedOnRushEffects,
} from "./rules/namedUnitEffects";
import {
  battleFillers,
  battleUnit,
  hasNcLog,
  legendDefinitions,
  moveToBattle,
} from "./testing/battleEntry";
import {
  createTestState,
  heldEtCommand,
  heldMaCommand,
  heldWbCommand,
  inst,
  releasedEtCommand,
  releasedMaCommand,
  releasedWbCommand,
} from "./testing/fixtures";

const defs = legendDefinitions;

function def(id: string): CardDefinition {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

function heldCategoryCommand(cardId: string, suffix = "cmd") {
  const category = def(cardId).category;
  if (category === "ET") return heldEtCommand(suffix);
  if (category === "MA") return heldMaCommand(suffix);
  if (category === "WB") return heldWbCommand(suffix);
  return { ...inst("RS-020", suffix), commandHeld: true };
}

function playOperation(
  cardId: string,
  setup: {
    player1?: Parameters<typeof createTestState>[0]["player1"];
    player2?: Parameters<typeof createTestState>[0]["player2"];
    targetInstanceId?: string;
    extraInstanceId?: string;
    powerCount?: number;
  } = {},
) {
  const op = inst(cardId, `${cardId}-op`);
  const powerCount = setup.powerCount ?? 8;
  const state = createTestState({
    phase: "rush",
    activePlayer: "player1",
    definitions: defs,
    player1: {
      hand: [op, ...(setup.player1?.hand ?? [])],
      power: Array.from({ length: powerCount }, (_, i) => inst("TST-OP", `p${i}`)),
      command: setup.player1?.command ?? [heldCategoryCommand(cardId)],
      ...setup.player1,
    },
    player2: setup.player2,
  });
  const action = getLegalActions(state).find(
    (a) =>
      a.type === "play_operation" &&
      a.instanceId === op.instanceId &&
      (setup.targetInstanceId ? a.targetInstanceId === setup.targetInstanceId : true) &&
      (setup.extraInstanceId ? a.extraInstanceId === setup.extraInstanceId : true),
  );
  expect(action).toBeDefined();
  return unwrap(applyAction(state, action!));
}

describe("RS core batch01 audit coverage", () => {
  it.each(
    Array.from({ length: 45 }, (_, i) => `RS-${String(i + 1).padStart(3, "0")}`),
  )("catalog includes %s", (cardId) => {
    expect(defs[cardId] ?? legend1Catalog.cards.find((c) => c.id === cardId)).toBeDefined();
  });
});

describe("RS-001 Goren Storm", () => {
  it("sets S-only 5th-unit finisher for the turn", () => {
    const state = playOperation("RS-001", { powerCount: 8 });
    expect(getSComboFinisher(state.players.player1)).toBe("goren_storm");
  });
});

describe("RS-002 Jacker Hurricane", () => {
  it("sets S-only 4th-unit finisher for the turn", () => {
    const state = playOperation("RS-002", { powerCount: 6 });
    expect(getSComboFinisher(state.players.player1)).toBe("jacker_hurricane");
  });
});

describe("RS-003 Battle Dance", () => {
  it("returns one S unit per two newly held commands", () => {
    const sUnit = inst("TST-UNIT-0", "battle1");
    const cmdA = inst("TST-OP-ET", "c1");
    const cmdB = inst("TST-OP-ET", "c2");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [sUnit],
        command: [
          { ...cmdA, commandHeld: false },
          { ...cmdB, commandHeld: false },
        ],
      },
    });
    const action = getLegalActions(state).find(
      (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === sUnit.instanceId,
    );
    const next = unwrap(applyAction(state, action!));
    expect(next.players.player1.rush.some((c) => c.instanceId === sUnit.instanceId)).toBe(true);
    expect(next.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });
});

describe("RS-004 Denji Machine", () => {
  it("opens reveal when deck has 3+ cards", () => {
    const state = playOperation("RS-004", {
      powerCount: 4,
      player1: {
        command: [{ ...inst("RS-020", "c1"), commandHeld: true }],
        deck: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `d${i}`)),
      },
    });
    expect(state.pendingEffectChoice?.effectId).toBe("denji_machine");
  });
});

describe("RS-005 Land Balkan", () => {
  it("rushes released S unit from command zone", () => {
    const sCmd = { ...inst("TST-UNIT-0", "cmd-s"), commandHeld: false };
    const state = playOperation("RS-005", {
      powerCount: 4,
      player1: {
        command: [sCmd, heldEtCommand("held")],
      },
    });
    expect(state.players.player1.rush.some((c) => c.instanceId === sCmd.instanceId)).toBe(true);
  });
});

describe("RS-006 New Gymnastics", () => {
  it("offers counter payment when own S unit is attacked", () => {
    const counter = inst("RS-006", "c1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        battle: [inst("TST-UNIT-2", "a1")],
        command: [heldWbCommand("c1")],
      },
      player2: {
        battle: [inst("TST-UNIT-0", "d1")],
        hand: [counter],
        command: [releasedEtCommand("pay")],
        power: [inst("TST-OP", "pw1")],
      },
    });
    const battle = getLegalActions(state).find((a) => a.type === "battle");
    expect(battle).toBeDefined();
    state = unwrap(applyAction(state, battle!));
    expect(
      getLegalActions(state).some(
        (a) =>
          a.type === "initiate_command_payment" &&
          a.playerId === "player2" &&
          a.sourceInstanceId === counter.instanceId,
      ),
    ).toBe(true);
  });
});

describe("RS-007 Dynamite Power", () => {
  it("holds enemy unit in owner command zone", () => {
    const target = inst("TST-UNIT-0", "u1");
    const state = playOperation("RS-007", {
      powerCount: 6,
      targetInstanceId: target.instanceId,
      player2: { battle: [target] },
    });
    expect(
      state.players.player2.command.some(
        (c) => c.instanceId === target.instanceId && c.commandHeld,
      ),
    ).toBe(true);
  });
});

describe("RS-008 Super Brain", () => {
  it("draws two and discards one on start draw", () => {
    const state = createTestState({
      phase: "start",
      definitions: defs,
      player1: {
        operation: [inst("RS-008", "brain")],
        deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2"), inst("TST-OP", "d3")],
      },
    });
    const next = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.discard).toHaveLength(1);
  });
});

describe("RS-009 Power Bazooka", () => {
  it("returns fusion parts only when L reaches discard", () => {
    const bazooka = inst("RS-009", "op1");
    const zord = { ...inst("RS-034", "z1") };
    const fusion = inst("RS-035", "f1");
    let state = createTestState({
      phase: "rush",
      definitions: defs,
      player1: {
        hand: [bazooka],
        power: Array.from({ length: 8 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
      player2: {
        battle: [zord],
        discard: [fusion],
        command: [heldWbCommand("c2"), { ...inst("RS-007", "c3"), commandHeld: false }],
      },
    });
    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === bazooka.instanceId &&
        a.targetInstanceId === zord.instanceId,
    );
    state = unwrap(applyAction(state, action!));
    expect(state.players.player2.discard.some((c) => c.cardId === "RS-034")).toBe(true);
    expect(state.players.player2.battle.some((c) => c.instanceId === fusion.instanceId)).toBe(true);
  });

  it("does not return fusion when L never reaches discard", () => {
    const zord = inst("RS-034", "z1");
    const fusion = inst("RS-035", "f1");
    const pendingLeave = {
      ownerPlayerId: "player2" as const,
      instanceId: zord.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: zord.cardId,
      phasePlayerId: "player1" as const,
      fusionReturnOnDiscard: "battle" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player2: {
        battle: [zord],
        discard: [fusion],
      },
    });
    const next = finalizeLeaveReaction(state, pendingLeave, true);
    expect(next.players.player2.battle.some((c) => c.instanceId === zord.instanceId)).toBe(true);
    expect(next.players.player2.battle.some((c) => c.instanceId === fusion.instanceId)).toBe(false);
  });
});

describe("RS-010 Prism Power", () => {
  it("keeps prism power active in the operation zone", () => {
    const state = createTestState({
      phase: "rush",
      definitions: defs,
      player1: {
        operation: [inst("RS-010", "prism")],
      },
    });
    expect(hasOperationEffect(state.players.player1, "prism_power", defs)).toBe(true);
  });
});

describe("RS-011 Aura Power", () => {
  it("opens target choice for S unit", () => {
    const state = playOperation("RS-011", {
      powerCount: 2,
      player1: {
        rush: [inst("TST-UNIT-0", "s1")],
      },
    });
    expect(state.pendingEffectChoice?.effectId).toBe("aura_power");
  });
});

describe("RS-012 Science Academy", () => {
  it("salvages mecha unit from discard", () => {
    const mecha = inst("RS-043", "mecha");
    const state = playOperation("RS-012", {
      powerCount: 3,
      targetInstanceId: mecha.instanceId,
      player1: { discard: [mecha] },
    });
    expect(state.players.player1.hand.some((c) => c.instanceId === mecha.instanceId)).toBe(true);
  });
});

describe("RS-013 Shiron Light", () => {
  it("opens opponent hand pick once per rush phase", () => {
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        operation: [inst("RS-013", "op")],
        hand: [inst("TST-UNIT-0", "h1")],
      },
    });
    const action = getLegalActions(state).find((a) => a.type === "shiron_light");
    const next = unwrap(applyAction(state, action!));
    expect(next.pendingEffectChoice?.effectId).toBe("shiron_light");
  });
});

describe("RS-014 Five Tech", () => {
  it("offers rush intercept when struck", () => {
    const attacker = inst("TST-UNIT-2", "striker");
    const defender = inst("TST-UNIT-0", "target");
    const interceptor = inst("TST-UNIT-0", "intercept");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: { battle: [attacker] },
      player2: {
        operation: [inst("RS-014", "ft")],
        rush: [interceptor],
        battle: [defender],
        command: [heldWbCommand("c1")],
      },
    });
    const next = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );
    expect(
      getLegalActions(next).some((a) => a.type === "five_tech_intercept"),
    ).toBe(true);
  });
});

describe("RS-015 Bird Nick Wave", () => {
  it("reduces combo number delta by 1", () => {
    const state = playOperation("RS-015", { powerCount: 2 });
    expect(getComboNumberDelta(state.players.player1)).toBe(1);
  });
});

describe("RS-016 Dino Chronicle", () => {
  it("opens leave counter when same-name copy is in discard", () => {
    const unit = inst("TST-UNIT-0", "d1");
    const copy = inst("TST-UNIT-0", "twin");
    const counter = inst("RS-016", "c1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: unit.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: unit.cardId,
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [unit],
        discard: [copy],
        hand: [counter],
        command: [releasedWbCommand("pay")],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `pw${i}`)),
      },
    });
    const pay = getLegalActions(state).find(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.playerId === "player2" &&
        a.sourceInstanceId === counter.instanceId,
    );
    expect(pay).toBeDefined();
  });
});

describe("RS-017 Ki Power", () => {
  it("boosts S unit BP on opponent turn from released commands", () => {
    const sUnit = inst("TST-UNIT-0", "s1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      definitions: defs,
      player1: {
        operation: [inst("RS-017", "ki")],
        battle: [sUnit],
        command: [
          { ...heldEtCommand("c1"), commandHeld: false },
          { ...heldEtCommand("c2"), commandHeld: false },
        ],
      },
      player2: {
        battle: [inst("TST-UNIT-2", "atk")],
        command: [heldWbCommand("c3")],
      },
    });
    const pending = {
      attackerPlayerId: "player2" as const,
      defenderPlayerId: "player1" as const,
      attackerInstanceId: "atk",
      defenderInstanceId: sUnit.instanceId,
      battleNumber: 1,
    };
    expect(battleDefenderBp(state, pending)).toBe(1000 + 2000);
  });
});

describe("RS-018 Hidden Ninja", () => {
  it("cannot select the attacking unit as substitute", () => {
    const defender = inst("TST-UNIT-0", "def");
    const attacker = inst("TST-UNIT-2", "atk");
    const ally = inst("TST-UNIT-0", "ally");
    const state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        battle: [defender, ally],
      },
      player2: {
        battle: [attacker],
      },
      pendingBattle: {
        attackerPlayerId: "player2",
        defenderPlayerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
        battleNumber: 1,
      },
    });
    const subs = collectHiddenNinjaSubstitutes(state, [
      defender.instanceId,
      attacker.instanceId,
    ]);
    expect(subs.some((s) => s.instanceId === attacker.instanceId)).toBe(false);
    expect(subs.some((s) => s.instanceId === ally.instanceId)).toBe(true);
  });
});

describe("RS-019 Super Power", () => {
  it("adds BP from held commands when S unit attacks", () => {
    const attacker = inst("TST-UNIT-0", "atk");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        operation: [inst("RS-019", "sp")],
        battle: [attacker],
        command: [
          { ...heldMaCommand("c1"), commandHeld: true },
          { ...heldMaCommand("c2"), commandHeld: true },
        ],
      },
    });
    expect(superPowerAttackBonus(state, "player1", attacker)).toBe(2000);
  });
});

describe("RS-020 Place In Power", () => {
  it("places operation in power zone", () => {
    const state = playOperation("RS-020", {
      powerCount: 0,
      player1: {
        command: [{ ...inst("RS-020", "c1"), commandHeld: true }],
      },
    });
    expect(state.players.player1.power.some((c) => c.cardId === "RS-020")).toBe(true);
  });
});

describe("RS-021 Cyber S Rider", () => {
  it("holds selected hand cards in command zone", () => {
    const op = inst("RS-021", "op1");
    const handCard = inst("RS-007", "hand1");
    const state = createTestState({
      phase: "rush",
      definitions: defs,
      player1: {
        hand: [op, handCard],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
    });
    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === handCard.instanceId,
    );
    expect(action).toBeDefined();
    const next = unwrap(applyAction(state, action!));
    expect(
      next.players.player1.command.some(
        (c) => c.instanceId === handCard.instanceId && c.commandHeld,
      ),
    ).toBe(true);
  });
});

describe("RS-022 Earth Force", () => {
  it("places permanent operation in operation zone", () => {
    const state = playOperation("RS-022", { powerCount: 6 });
    expect(state.players.player1.operation.some((c) => c.cardId === "RS-022")).toBe(true);
  });
});

describe("RS-023 Super Rescue", () => {
  it("opens discard S unit salvage choice", () => {
    const salvage = inst("TST-UNIT-0", "salvage");
    const state = playOperation("RS-023", {
      powerCount: 3,
      player1: { discard: [salvage] },
    });
    expect(state.pendingEffectChoice?.effectId).toBe("discard_s_unit_to_hand");
  });
});

describe("RS-024 Compression Freeze", () => {
  it("sends target unit to power zone", () => {
    const target = inst("TST-UNIT-0", "u1");
    const state = playOperation("RS-024", {
      powerCount: 6,
      targetInstanceId: target.instanceId,
      player1: {
        command: [{ ...inst("RS-020", "c1"), commandHeld: true }],
        rush: [target],
      },
    });
    expect(state.players.player1.power.some((c) => c.instanceId === target.instanceId)).toBe(true);
  });
});

describe("RS-025 Gao Soul", () => {
  it("applies +4000 BP modifier to target unit", () => {
    const target = inst("TST-UNIT-0", "u1");
    const state = playOperation("RS-025", {
      powerCount: 2,
      targetInstanceId: target.instanceId,
      player1: { rush: [target] },
    });
    expect(state.players.player1.rush[0]?.bpModifier).toBe(4000);
  });
});

describe("RS-026 Shippu Ninja", () => {
  it("offers counter when low-BP unit is rushed", () => {
    const counter = inst("RS-026", "c1");
    const rushed = inst("TST-UNIT-0", "u1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: defs,
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: rushed.instanceId,
        phasePlayerId: "player1",
        morphUnitInstanceIds: [],
      },
      player1: { rush: [rushed] },
      player2: {
        hand: [counter],
        command: [releasedMaCommand("pay")],
        power: Array.from({ length: 3 }, (_, i) => inst("TST-OP", `pw${i}`)),
      },
    });
    const pay = getLegalActions(state).find(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.playerId === "player2" &&
        a.sourceInstanceId === counter.instanceId,
    );
    expect(pay).toBeDefined();
  });
});

describe("RS-027 Dino Guts", () => {
  it("opens leave counter for own unit", () => {
    const unit = inst("TST-UNIT-2", "d1");
    const counter = inst("RS-027", "c1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: unit.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: unit.cardId,
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [unit],
        deck: [inst("TST-OP", "deck1"), inst("TST-OP", "deck2")],
        hand: [counter],
        command: [releasedWbCommand("pay")],
      },
    });
    const pay = getLegalActions(state).find(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.playerId === "player2" &&
        a.sourceInstanceId === counter.instanceId,
    );
    expect(pay).toBeDefined();
  });
});

describe("RS-028 Judgment", () => {
  it("destroys enemy when revealed size matches", () => {
    const target = inst("TST-UNIT-0", "u1");
    const deckTop = inst("TST-UNIT-0", "deck-s");
    const state = playOperation("RS-028", {
      powerCount: 5,
      targetInstanceId: target.instanceId,
      player1: {
        command: [{ ...inst("RS-020", "c1"), commandHeld: true }],
        deck: [deckTop, inst("TST-OP", "d2")],
      },
      player2: { battle: [target] },
    });
    expect(state.players.player2.battle).toHaveLength(0);
  });
});

describe("RS-029 Courage Magic", () => {
  it("releases a held command when S unit enters battle", () => {
    const sUnit = inst("TST-UNIT-0", "s1");
    const held = { ...heldEtCommand("c1"), commandHeld: true };
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        operation: [inst("RS-029", "cm")],
        rush: [sUnit],
        command: [held],
      },
    });
    state = moveToBattle(state, sUnit.instanceId);
    expect(state.players.player1.command.some((c) => !c.commandHeld)).toBe(true);
  });
});

describe("RS-030 Adventure", () => {
  it("returns only ending player's held command at their turn end", () => {
    const p1Cmd = { ...heldWbCommand("p1cmd"), commandHeld: true };
    const p2Cmd = { ...heldEtCommand("p2cmd"), commandHeld: true };
    let state = createTestState({
      phase: "end",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        operation: [inst("RS-030", "adv1")],
        command: [p1Cmd],
      },
      player2: {
        operation: [inst("RS-030", "adv2")],
        command: [p2Cmd],
      },
    });
    state = unwrap(applyAction(state, { type: "end_phase", playerId: "player1" }));
    if (state.pendingEffectChoice?.effectId === "adventure") {
      const pick = getLegalActions(state).find(
        (a) => a.type === "resolve_effect_choice" && a.instanceId === p1Cmd.instanceId,
      );
      state = unwrap(applyAction(state, pick!));
    }
    expect(state.players.player1.hand.some((c) => c.instanceId === p1Cmd.instanceId)).toBe(true);
    expect(state.players.player2.command.some((c) => c.instanceId === p2Cmd.instanceId)).toBe(true);
  });
});

describe("RS-031 Eagle Diving", () => {
  it("grants SP1 and BP boost from combo partner", () => {
    const eagle = inst("RS-031", "eagle");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [eagle],
        battle: [inst("RS-032", "partner"), ...battleFillers(3)],
      },
    });
    const next = moveToBattle(state, eagle.instanceId);
    expect(hasNcLog(next, "eagle_diving")).toBe(true);
    expect(battleUnit(next, "player1", eagle.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-032 Shark Jaws", () => {
  it("uses printed defender BP when attacking from combo partner", () => {
    const shark = inst("RS-032", "shark");
    const boosted = { ...inst("TST-UNIT-2", "def"), bpModifier: 5000 };
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        battle: [shark, inst("RS-031", "partner"), ...battleFillers(2)],
        command: [heldEtCommand("c1")],
      },
      player2: {
        battle: [boosted],
        command: [heldWbCommand("c2")],
      },
    });
    const pending = {
      attackerPlayerId: "player1" as const,
      defenderPlayerId: "player2" as const,
      attackerInstanceId: shark.instanceId,
      defenderInstanceId: boosted.instanceId,
      battleNumber: 3,
    };
    expect(battleDefenderBp(state, pending)).toBe(3000);
  });
});

describe("RS-033 Panther Claw", () => {
  it("blocks defender counters when attacking from combo partner", () => {
    const panther = inst("RS-033", "panther");
    const counter = inst("RS-006", "counter");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        battle: [panther, inst("RS-031", "partner"), ...battleFillers(2)],
      },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [counter],
        command: [heldEtCommand("c1"), heldEtCommand("c2")],
      },
      pendingBattle: {
        attackerPlayerId: "player1",
        defenderPlayerId: "player2",
        attackerInstanceId: panther.instanceId,
        defenderInstanceId: "def",
        battleNumber: 3,
      },
    });
    expect(
      getLegalActions(state).some(
        (a) => a.type === "play_counter" && a.instanceId === counter.instanceId,
      ),
    ).toBe(false);
  });
});

describe("RS-034 Guardian God", () => {
  it("grants +2000 BP to other WB units in battle", () => {
    const god = inst("RS-034", "god");
    const ally = inst("RS-035", "ally");
    const state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        battle: [god, ally],
      },
    });
    expect(passiveNamedFieldBpBonus(state, "player1", ally, "general")).toBe(2000);
  });
});

describe("RS-035 Tyranno Sonic", () => {
  it("opens destroy choice on rush", () => {
    const tyranno = inst("RS-035", "ty");
    const state = createTestState({
      phase: "rush",
      definitions: defs,
      player1: { rush: [tyranno] },
      player2: { battle: [inst("TST-UNIT-0", "enemy")] },
    });
    const result = resolveNamedOnRushEffects(state, "player1", tyranno.instanceId, "player1");
    expect(result.state.pendingEffectChoice?.effectId).toBe("tyranno_sonic");
  });
});

describe("RS-036 Moss Blizzard", () => {
  it("forces opponent to hold commands on rush", () => {
    const moss = inst("RS-036", "moss");
    const state = createTestState({
      phase: "rush",
      definitions: defs,
      player1: { rush: [moss] },
      player2: {
        command: [
          { ...heldWbCommand("c1"), commandHeld: false },
          { ...heldWbCommand("c2"), commandHeld: false },
        ],
      },
    });
    const result = resolveNamedOnRushEffects(state, "player1", moss.instanceId, "player1");
    expect(result.state.pendingEffectChoice?.effectId).toBe("moss_blizzard");
  });
});

describe("RS-037 Tricera Cannon", () => {
  it("boosts attacking WB M units while in rush", () => {
    const tricera = inst("RS-037", "tri");
    const attacker = inst("RS-036", "atk");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [tricera],
        battle: [attacker],
      },
      player2: {
        battle: [inst("TST-UNIT-2", "def")],
        command: [heldWbCommand("c1")],
      },
    });
    const pending = {
      attackerPlayerId: "player1" as const,
      defenderPlayerId: "player2" as const,
      attackerInstanceId: attacker.instanceId,
      defenderInstanceId: "def",
      battleNumber: 1,
    };
    expect(battleAttackerBpBonus(state, pending)).toBeGreaterThanOrEqual(1000);
  });
});

describe("RS-039 Ptera Beam", () => {
  it("opens enemy held command discard on rush", () => {
    const ptera = inst("RS-039", "ptera");
    const state = createTestState({
      phase: "rush",
      definitions: defs,
      player1: { rush: [ptera] },
      player2: {
        command: [{ ...inst("RS-007", "cmd"), commandHeld: true }],
      },
    });
    const result = resolveNamedOnRushEffects(state, "player1", ptera.instanceId, "player1");
    expect(result.state.pendingEffectChoice?.effectId).toBe("ptera_beam");
  });
});

describe("RS-040 Moss Breaker", () => {
  it("opens opponent command hold on NC entry", () => {
    const mammoth = inst("RS-040", "mammoth");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [mammoth],
        battle: battleFillers(1),
      },
      player2: {
        command: [{ ...inst("RS-007", "cmd"), commandHeld: false }],
      },
    });
    const next = moveToBattle(state, mammoth.instanceId);
    expect(next.pendingEffectChoice?.effectId).toBe("moss_breaker");
  });
});

describe("RS-041 Tiger Ranger", () => {
  it("grants SP1 at NC position 2", () => {
    const tiger = inst("RS-041", "tiger");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [tiger],
        battle: battleFillers(1),
      },
    });
    const next = moveToBattle(state, tiger.instanceId);
    expect(battleUnit(next, "player1", tiger.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-042 Justice Flasher", () => {
  it("opens optional power payment on own-turn battle entry", () => {
    const robo = inst("RS-042", "robo");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [robo],
        battle: battleFillers(4),
        power: Array.from({ length: 6 }, (_, i) => inst("TST-P", `p${i}`)),
      },
    });
    const next = moveToBattle(state, robo.instanceId);
    expect(next.pendingEffectChoice?.effectId).toBe("justice_flasher");
    expect(
      canRunEnterBattleConditionalEffect(next, "player1", "justice_flasher"),
    ).toBe(true);
    expect(
      canRunEnterBattleConditionalEffect(
        { ...next, activePlayer: "player2" },
        "player1",
        "justice_flasher",
      ),
    ).toBe(false);
  });
});

describe("RS-043 Judgment Sword", () => {
  it("opens only on own-turn battle entry", () => {
    const pat = inst("RS-043", "pat");
    const ownTurn = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        rush: [pat],
        power: Array.from({ length: 3 }, (_, i) => inst("TST-P", `p${i}`)),
      },
    });
    expect(moveToBattle(ownTurn, pat.instanceId).pendingEffectChoice?.effectId).toBe(
      "judgment_sword",
    );
    expect(
      canRunEnterBattleConditionalEffect(
        createTestState({ phase: "battle", activePlayer: "player2" }),
        "player1",
        "judgment_sword",
      ),
    ).toBe(false);
  });
});

describe("RS-045 Signal Cannon", () => {
  it("boosts defending OT M units while in rush", () => {
    const cannon = inst("RS-045", "cannon");
    const defender = inst("RS-043", "def");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      definitions: defs,
      player1: {
        rush: [cannon],
        battle: [defender],
      },
      player2: {
        battle: [inst("TST-UNIT-2", "atk")],
        command: [heldWbCommand("c1")],
      },
    });
    const pending = {
      attackerPlayerId: "player2" as const,
      defenderPlayerId: "player1" as const,
      attackerInstanceId: "atk",
      defenderInstanceId: defender.instanceId,
      battleNumber: 1,
    };
    expect(battleDefenderBp(state, pending)).toBeGreaterThan(effectiveBp(state, "player1", defender));
  });
});
