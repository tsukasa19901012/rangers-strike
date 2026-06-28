import { describe, expect, it } from "vitest";
import { legend3Catalog } from "@rangers-strike/cards";
import {
  applyAction,
  effectiveBp,
  getLegalActions,
} from "./index";
import { applyLegend3NcEffect } from "./rules/legend3/ncEffects";
import { legend3FieldBpBonus } from "./rules/legend3/fieldEffects";
import { resolveLegend3JointComboR } from "./rules/legend3/jointComboEffects";
import { resolveLegend3OnRushEffects } from "./rules/legend3/rushEffects";
import {
  legend3AttackerBpBonus,
  resolveLegend3EnterBattle,
  tryStartLegend3ConditionalChoice,
  canAttackRushWithMoonlightSonic,
} from "./rules/legend3/battleEffects";
import { startJetSkateboardChoiceForUnit } from "./rules/legend3/endTurnEffects";
import {
  battleFillers,
  battleUnit,
  legendDefinitions,
  moveToBattle,
} from "./testing/battleEntry";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";

const defs = legendDefinitions;

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

const RS_CORE_BATCH04 = Array.from({ length: 43 }, (_, index) =>
  `RS-${String(136 + index).padStart(3, "0")}`,
);

describe("RS core batch04 audit coverage", () => {
  it.each(RS_CORE_BATCH04)("catalog includes %s", (cardId) => {
    expect(defs[cardId] ?? legend3Catalog.cards.find((c) => c.id === cardId)).toBeDefined();
  });
});

describe("RS-136 assault", () => {
  it("opens optional enemy battle target to command hold on rush", () => {
    const landLion = inst("RS-136", "lion");
    const enemy = inst("TST-UNIT-2", "enemy");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: { rush: [landLion] },
      player2: { battle: [enemy] },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      landLion.instanceId,
      "player1",
      "RS-136",
      "assault",
    );
    expect(result.state.pendingEffectChoice?.effectId).toBe("assault");
    expect(result.state.pendingEffectChoice?.unitDestination).toBe("enemy_command");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(enemy.instanceId);
  });
});

describe("RS-137 submerge", () => {
  it("returns up to three discard units to deck bottom on rush", () => {
    const dolphin = inst("RS-137", "dolphin");
    const d1 = inst("RS-079", "d1");
    const d2 = inst("RS-079", "d2");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        rush: [dolphin],
        discard: [d1, d2, inst("TST-OP-DA", "cmd")],
        deck: [inst("TST-P", "deck")],
      },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      dolphin.instanceId,
      "player1",
      "RS-137",
      "submerge",
    );
    expect(result.state.players.player1.discard).toHaveLength(1);
    expect(result.state.players.player1.deck).toHaveLength(3);
    expect(result.state.players.player1.deck.slice(-2).every((c) => c.cardId === "RS-079")).toBe(
      true,
    );
  });
});

describe("RS-138 jet_skateboard", () => {
  it("offers end-of-turn return from battle to rush", () => {
    const jet = inst("RS-138", "jet");
    const state = createTestState({
      definitions: defs,
      phase: "end",
      activePlayer: "player1",
      player1: { battle: [jet, ...battleFillers(2)] },
    });
    const after = startJetSkateboardChoiceForUnit(state, "player1", jet.instanceId);
    expect(after?.pendingEffectChoice?.effectId).toBe("jet_skateboard");
    expect(after?.pendingEffectChoice?.validInstanceIds).toContain(jet.instanceId);
  });
});

describe("RS-141 string_fist", () => {
  it("opens enemy battle bounce on NC", () => {
    const bind = inst("RS-141", "bind");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [bind, ...battleFillers(2)] },
      player2: { battle: [inst("TST-UNIT-2", "enemy")] },
    });
    const opened = tryStartLegend3ConditionalChoice(
      state,
      "player1",
      bind,
      "string_fist",
      "player1",
    );
    expect(opened?.pendingEffectChoice?.effectId).toBe("string_fist");
    expect(opened?.pendingEffectChoice?.validInstanceIds).toContain("TST-UNIT-2:enemy");
  });
});

describe("RS-142 crown_final_crush", () => {
  it("releases all own commands on battle entry", () => {
    const zord = inst("RS-142", "zord");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        battle: [zord],
        command: [
          { ...inst("TST-OP-MA", "c1"), commandHeld: true },
          { ...inst("TST-OP-MA", "c2"), commandHeld: true },
        ],
      },
    });
    const result = resolveLegend3EnterBattle(state, "player1", "RS-142", "crown_final_crush");
    expect(result.state.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });
});

describe("RS-144 taurus_dive", () => {
  it("returns enemy battle S-units at SP1 to hand", () => {
    const gran = inst("RS-144", "gran");
    const enemyS = inst("RS-138", "enemy-s");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: { rush: [gran] },
      player2: {
        battle: [enemyS],
        hand: [],
      },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      gran.instanceId,
      "player1",
      "RS-144",
      "taurus_dive",
    );
    expect(result.state.players.player2.battle).toHaveLength(0);
    expect(result.state.players.player2.hand.some((c) => c.cardId === "RS-138")).toBe(true);
  });

  it("does not return rush-area S-units without SP", () => {
    const gran = inst("RS-144", "gran");
    const rushS = inst("TST-UNIT-0", "rush-s");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: { rush: [gran] },
      player2: { rush: [rushS], hand: [] },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      gran.instanceId,
      "player1",
      "RS-144",
      "taurus_dive",
    );
    expect(result.state.players.player2.rush).toHaveLength(1);
    expect(result.state.players.player2.hand).toHaveLength(0);
  });
});

describe("RS-145 hyper_civilization_guard", () => {
  it("releases commands on own-turn battle entry only", () => {
    const dash = inst("RS-145", "dash");
    const ownTurn = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [dash],
        command: [{ ...inst("TST-OP-MA", "c1"), commandHeld: true }],
      },
    });
    const entered = resolveLegend3EnterBattle(
      ownTurn,
      "player1",
      "RS-145",
      "hyper_civilization_guard",
    );
    expect(entered.state.players.player1.command.every((c) => !c.commandHeld)).toBe(true);

    const enemyTurn = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player1: {
        battle: [dash],
        command: [{ ...inst("TST-OP-MA", "c1"), commandHeld: true }],
      },
    });
    const skipped = resolveLegend3EnterBattle(
      enemyTurn,
      "player1",
      "RS-145",
      "hyper_civilization_guard",
    );
    expect(skipped.state.players.player1.command[0]?.commandHeld).toBe(true);
  });
});

describe("RS-148 star_raiser", () => {
  it("adds BP per released command on own turn", () => {
    const ored = inst("RS-148", "ored");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [ored],
        command: [
          { ...inst("TST-OP-OT", "c1"), commandHeld: false },
          { ...inst("TST-OP-OT", "c2"), commandHeld: false },
        ],
      },
    });
    const bonus = legend3FieldBpBonus(state, "player1", ored, "general");
    expect(bonus).toBe(4000);
  });
});

describe("RS-150 bumper_bow", () => {
  it("moves enemy face-up power to command hold when space exists", () => {
    const pink = inst("RS-150", "pink");
    const powerCard = inst("TST-P", "power");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [pink, ...battleFillers(2)] },
      player2: {
        power: [{ ...powerCard, faceDown: false }],
        command: [],
      },
    });
    const result = applyLegend3NcEffect(state, "player1", pink, "bumper_bow");
    expect(result.state.players.player2.power).toHaveLength(0);
    expect(
      result.state.players.player2.command.some(
        (c) => c.instanceId === powerCard.instanceId && c.commandHeld,
      ),
    ).toBe(true);
  });
});

describe("RS-151 furious_shark_shot", () => {
  it("adds BP per WB M-unit in battle", () => {
    const king = inst("RS-151", "king");
    const wbM = inst("RS-152", "wb-m");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [king, wbM] },
    });
    const bonus = legend3FieldBpBonus(state, "player1", king, "general");
    expect(bonus).toBe(2000);
  });
});

describe("RS-155 steel_horn", () => {
  it("offers destroy targets with power cost at most enemy damage", () => {
    const bison = inst("RS-155", "bison");
    const cheap = inst("TST-UNIT-0", "cheap");
    const expensive = inst("TST-UNIT-7", "expensive");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [bison] },
      player2: {
        battle: [cheap, expensive],
        power: [inst("TST-P", "d1"), inst("TST-P", "d2")].map((c) => ({ ...c, faceDown: true })),
      },
    });
    const result = resolveLegend3EnterBattle(state, "player1", "RS-155", "steel_horn");
    expect(result.state.pendingEffectChoice?.effectId).toBe("steel_horn");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(cheap.instanceId);
    expect(result.state.pendingEffectChoice?.validInstanceIds).not.toContain(expensive.instanceId);
  });
});

describe("RS-159 fire_dance", () => {
  it("holds enemy released commands up to enemy damage count", () => {
    const kong = inst("RS-159", "kong");
    const cmd1 = inst("TST-OP-DA", "c1");
    const cmd2 = inst("TST-OP-DA", "c2");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [kong] },
      player2: {
        command: [
          { ...cmd1, commandHeld: false },
          { ...cmd2, commandHeld: false },
        ],
        power: [inst("TST-P", "d1")].map((c) => ({ ...c, faceDown: true })),
      },
    });
    const result = resolveLegend3EnterBattle(state, "player1", "RS-159", "fire_dance");
    expect(result.state.pendingEffectChoice?.effectId).toBe("fire_dance");
    expect(result.state.pendingEffectChoice?.selectCount).toBe(1);
  });
});

describe("RS-160 blazing_fire", () => {
  it("grants SP1 on NC without double-counting passive BP", () => {
    const red = inst("RS-160", "red");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [red, ...battleFillers(1)] },
    });
    const result = applyLegend3NcEffect(state, "player1", red, "blazing_fire");
    const unit = battleUnit(result.state, "player1", red.instanceId)!;
    expect(unit.spModifier).toBe(1);
    const baseBp = defs["RS-160"]?.bp ?? 0;
    expect(effectiveBp(result.state, "player1", unit)).toBe(baseBp + 2000);
  });
});

describe("RS-162 surging_chopper", () => {
  it("adds +5000 BP when attacking S-units on own turn", () => {
    const blue = inst("RS-162", "blue");
    const enemyS = inst("RS-138", "enemy-s");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [blue] },
      player2: { battle: [enemyS] },
    });
    const bonus = legend3FieldBpBonus(state, "player1", blue, "attacking");
    expect(bonus).toBe(0);
    const pending = {
      attackerPlayerId: "player1" as const,
      defenderPlayerId: "player2" as const,
      attackerInstanceId: blue.instanceId,
      defenderInstanceId: enemyS.instanceId,
    };
    expect(legend3AttackerBpBonus(state, pending)).toBe(5000);
  });
});

describe("RS-163 iron_broken", () => {
  it("adds +3000 BP on own turn without NC modifier stacking", () => {
    const black = inst("RS-163", "black");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [black, ...battleFillers(3)] },
    });
    const result = applyLegend3NcEffect(state, "player1", black, "iron_broken");
    const unit = battleUnit(result.state, "player1", black.instanceId)!;
    const baseBp = defs["RS-163"]?.bp ?? 0;
    expect(effectiveBp(result.state, "player1", unit)).toBe(baseBp + 3000);
  });
});

describe("RS-165 moonlight_sonic", () => {
  it("allows attacking enemy rush units", () => {
    const wolf = inst("RS-165", "wolf");
    expect(canAttackRushWithMoonlightSonic(createTestState({ definitions: defs }), "player1", wolf.instanceId)).toBe(
      false,
    );
    const state = createTestState({
      definitions: defs,
      player1: { battle: [wolf] },
    });
    expect(canAttackRushWithMoonlightSonic(state, "player1", wolf.instanceId)).toBe(true);
  });
});

describe("RS-168 cross_thunder", () => {
  it("destroys one own and one enemy unit with BP 5000 or less", () => {
    const own = inst("TST-UNIT-0", "own");
    const enemy = inst("TST-UNIT-0", "enemy");
    let state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [own] },
      player2: { battle: [enemy] },
    });
    const opened = resolveLegend3JointComboR(
      state,
      "player1",
      "RS-168",
      "cross_thunder",
      "player1",
    );
    expect(opened.state.pendingEffectChoice?.effectId).toBe("cross_thunder");
    expect(opened.state.pendingEffectChoice?.step).toBe("own");

    state = unwrap(
      applyAction(opened.state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: own.instanceId,
      }),
    );
    expect(state.pendingEffectChoice?.step).toBe("enemy");

    state = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: enemy.instanceId,
      }),
    );
    expect(state.players.player1.discard.some((c) => c.instanceId === own.instanceId)).toBe(true);
    expect(state.players.player2.discard.some((c) => c.instanceId === enemy.instanceId)).toBe(true);
    expect(state.pendingEffectChoice).toBeUndefined();
  });
});

describe("RS-169 earth_resource_absorb", () => {
  it("returns released commands to deck top on rush", () => {
    const crusher = inst("RS-169", "crusher");
    const cmd = inst("TST-OP-DA", "cmd");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        rush: [crusher],
        command: [{ ...cmd, commandHeld: false }],
        deck: [inst("TST-P", "deck")],
      },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      crusher.instanceId,
      "player1",
      "RS-169",
      "earth_resource_absorb",
    );
    expect(result.state.players.player1.command).toHaveLength(0);
    expect(result.state.players.player1.deck[0]?.instanceId).toBe(cmd.instanceId);
  });
});

describe("RS-173 wall_shoot", () => {
  it("reshuffles enemy command and redraws held commands", () => {
    const mixer = inst("RS-173", "mixer");
    const enemyCmd = inst("TST-OP-DA", "ec");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [inst("RS-166", "l"), mixer] },
      player2: {
        command: [{ ...enemyCmd, commandHeld: false }],
        deck: [inst("TST-P", "d1"), inst("TST-P", "d2")],
      },
    });
    const result = resolveLegend3JointComboR(
      state,
      "player1",
      "RS-173",
      "wall_shoot",
      "player1",
    );
    expect(result.state.players.player2.command).toHaveLength(1);
    expect(result.state.players.player2.command[0]?.commandHeld).toBe(true);
    expect(result.state.players.player2.deck.length).toBeGreaterThan(0);
  });
});

describe("RS-175 nature_big_bang_final", () => {
  it("offers optional destroy on enemy units with BP 20000 or less", () => {
    const gaonight = inst("RS-175", "gaonight");
    const target = inst("TST-UNIT-2", "target");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: { rush: [gaonight] },
      player2: { battle: [target] },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      gaonight.instanceId,
      "player1",
      "RS-175",
      "nature_big_bang_final",
    );
    expect(result.state.pendingEffectChoice?.effectId).toBe("nature_big_bang_final");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(target.instanceId);
  });
});

describe("RS-177 airlift", () => {
  it("opens deck search for joint combo markers on rush", () => {
    const jet = inst("RS-177", "jet");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        rush: [jet],
        deck: [inst("RS-171", "l-part"), inst("TST-P", "p")],
      },
    });
    const result = resolveLegend3OnRushEffects(
      state,
      "player1",
      jet.instanceId,
      "player1",
      "RS-177",
      "airlift",
    );
    expect(result.state.pendingEffectChoice?.effectId).toBe("airlift");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain("RS-171:l-part");
  });
});

describe("RS-152 scorching roar hold bypass", () => {
  it("lets WB M enter battle without hold when gaolion is present and discard has same name", () => {
    const gaolion = inst("RS-152", "lion");
    const eagle = inst("RS-153", "eagle");
    const eagleDiscard = inst("RS-153", "eagle-discard");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [gaolion, eagle],
        discard: [eagleDiscard],
        command: [inst("TST-OP-DA", "cmd")],
      },
    });
    const entered = moveToBattle(state, eagle.instanceId);
    expect(entered.players.player1.battle.some((c) => c.instanceId === eagle.instanceId)).toBe(
      true,
    );
    expect(entered.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });
});

describe("RS-154 gaoshark targeting", () => {
  it("can attack enemy rush S but not enemy battle S", () => {
    const shark = inst("RS-154", "shark");
    const enemyBattleS = inst("RS-138", "battle-s");
    const enemyRushS = inst("RS-139", "rush-s");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [shark],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [enemyBattleS],
        rush: [enemyRushS],
      },
    });
    const actions = getLegalActions(state);
    expect(
      actions.some(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === shark.instanceId &&
          a.defenderInstanceId === enemyBattleS.instanceId,
      ),
    ).toBe(false);
    expect(
      actions.some(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === shark.instanceId &&
          a.defenderInstanceId === enemyRushS.instanceId,
      ),
    ).toBe(true);
  });
});
