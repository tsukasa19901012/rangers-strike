import { describe, expect, it } from "vitest";
import { noBattleEntryTurnRushed, returnToHandAt6Damage } from "@rangers-strike/cards";
import {
  applyAction,
  canMoveUnitToBattle,
  explainCannotEnterBattle,
  getLegalActions,
} from "./index";
import { applyOnTurnEndBattleEffects } from "./rules/legend2/destroyEffects";
import { applyDamageToPlayer } from "./rules/damagePayment";
import { applyLegend3NcEffect } from "./rules/legend3/ncEffects";
import { startJuuKunDoChoice } from "./rules/pendingChoices";
import { canAttackDefender } from "./rules/legend3/restrictions";
import { canAttackRushWithYellowThunder } from "./rules/namedUnitEffects";
import { battleFillers, battleUnit, legendDefinitions, moveToBattle } from "./testing/battleEntry";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";

const defs = legendDefinitions;

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

describe("RS-091..135 core effects batch03", () => {
  it("RS-091 life_rescue NC returns ally unit from discard to hand on enter", () => {
    const rescue = inst("RS-091", "rescue");
    const ally = inst("RS-079", "ally");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        rush: [rescue],
        battle: battleFillers(4),
        discard: [ally],
      },
    });
    const entered = moveToBattle(state, rescue.instanceId);
    expect(entered.pendingEffectChoice?.effectId).toBe("life_rescue");
    expect(entered.pendingEffectChoice?.validInstanceIds).toContain(ally.instanceId);
  });

  it("RS-095 mane_hurricane returns enemy rush S on battle entry", () => {
    const zord = inst("RS-095", "zord");
    const enemyS = inst("RS-080", "enemy-s");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { rush: [zord] },
      player2: { rush: [enemyS], hand: [] },
    });
    const entered = moveToBattle(state, zord.instanceId);
    expect(entered.players.player2.rush).toHaveLength(0);
    expect(entered.players.player2.hand.some((c) => c.cardId === "RS-080")).toBe(true);
  });

  it("RS-096 karakuri_fire_hawk returns to hand when owner ends turn in battle", () => {
    const hawk = inst("RS-096", "hawk");
    const state = createTestState({
      definitions: defs,
      phase: "end",
      activePlayer: "player1",
      player1: { battle: [hawk, ...battleFillers(2)] },
    });
    const afterEnd = applyOnTurnEndBattleEffects(state, "player1");
    expect(afterEnd.players.player1.hand.some((c) => c.cardId === "RS-096")).toBe(true);
    expect(afterEnd.players.player1.battle.some((c) => c.cardId === "RS-096")).toBe(false);
  });

  it("RS-099 grant_sp1 NC on battle entry", () => {
    const unit = inst("RS-099", "ninpo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { rush: [unit], battle: battleFillers(2) },
    });
    const entered = moveToBattle(state, unit.instanceId);
    const battle = battleUnit(entered, "player1", unit.instanceId);
    expect((battle?.spModifier ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("RS-106 blocks battle entry on the turn it was rushed", () => {
    const deca = inst("RS-106", "deca");
    expect(noBattleEntryTurnRushed("RS-106")).toBe(true);
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        rush: [deca],
        modifiers: [
          {
            kind: "restriction",
            instanceId: deca.instanceId,
            restriction: "rushed_this_turn",
            scope: "turn",
          },
        ],
      },
    });
    expect(canMoveUnitToBattle(state, "player1", deca, "rush")).toBe(false);
    expect(explainCannotEnterBattle(state, "player1", deca, "rush")).toContain("ラッシュ");
  });

  it("RS-106 juu_kun_do destroys selected enemy rush units within printed BP budget", () => {
    const attacker = inst("RS-106", "att");
    const e1 = inst("TST-UNIT-0", "e1");
    const e2 = inst("TST-UNIT-0", "e2");
    let state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [e1, e2] },
    });
    state = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      sourceInstanceId: attacker.instanceId,
      phasePlayerId: "player1",
    })!;
    state = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: e1.instanceId,
      }),
    );
    state = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: e2.instanceId,
      }),
    );
    state = unwrap(
      applyAction(state, { type: "confirm_effect_choice", playerId: "player1" }),
    );
    expect(state.players.player2.rush).toHaveLength(0);
    expect(state.players.player2.discard).toHaveLength(2);
  });

  it("RS-112 returns to hand when enemy damage reaches 6", () => {
    expect(returnToHandAt6Damage("RS-112")).toBe(true);
    const zord = inst("RS-112", "zord");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [zord] },
      player2: { damage: 5, deck: [inst("TST-OP", "deck")], power: [] },
    });
    const after = applyDamageToPlayer(state, "player2", 1, {
      kind: "none",
      activePlayer: "player1",
    });
    expect(after.players.player2.damage).toBe(6);
    expect(after.players.player1.hand.some((c) => c.cardId === "RS-112")).toBe(true);
  });

  it("RS-114 requires ally S unit in battle before entry", () => {
    const horse = inst("RS-114", "horse");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { rush: [horse], battle: [] },
    });
    expect(canMoveUnitToBattle(state, "player1", horse, "rush")).toBe(false);
    expect(explainCannotEnterBattle(state, "player1", horse, "rush")).toContain("Sユニット");
  });

  it("RS-126 red_boot opens rush destroy choice after battle win", () => {
    const akarenger = inst("RS-126", "aka");
    const defender = inst("TST-UNIT-0", "def");
    const rushTarget = inst("TST-UNIT-0", "rush-t");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [akarenger],
        command: [heldWbCommand("c1"), heldWbCommand("c2")],
      },
      player2: {
        battle: [defender],
        rush: [rushTarget],
        command: [heldWbCommand("c3")],
      },
    });
    const battle = getLegalActions(state).find(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === akarenger.instanceId &&
        a.defenderInstanceId === defender.instanceId,
    );
    expect(battle).toBeDefined();
    const after = unwrap(applyAction(state, battle!));
    expect(after.pendingEffectChoice?.effectId).toBe("red_boot");
    expect(after.pendingEffectChoice?.validInstanceIds).toContain(rushTarget.instanceId);
  });

  it("RS-130 fire_sword grants SP1 and lets owner choose a permanent operation for power", () => {
    const redOne = inst("RS-130", "red");
    const opA = inst("RS-123", "op-a");
    const opB = inst("RS-124", "op-b");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        battle: [redOne, ...battleFillers(3)],
        operation: [opA, opB],
      },
    });
    const result = applyLegend3NcEffect(state, "player1", redOne, "fire_sword");
    expect((battleUnit(result.state, "player1", redOne.instanceId)?.spModifier ?? 0)).toBe(1);
    expect(result.state.pendingEffectChoice?.effectId).toBe("fire_sword");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toEqual([
      opA.instanceId,
      opB.instanceId,
    ]);

    const chosen = unwrap(
      applyAction(result.state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: opB.instanceId,
      }),
    );
    expect(chosen.players.player1.operation).toHaveLength(1);
    expect(chosen.players.player1.power.some((c) => c.instanceId === opB.instanceId)).toBe(true);
    expect(chosen.players.player1.operation.some((c) => c.instanceId === opA.instanceId)).toBe(true);
  });

  it("RS-135 blocks attacks from units without the aircraft feature", () => {
    const falcon = inst("RS-135", "falcon");
    const ground = inst("RS-106", "ground");
    const aircraft = inst("RS-096", "hawk");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [ground, aircraft] },
      player2: { battle: [falcon] },
    });
    expect(
      canAttackDefender(
        state,
        "player1",
        ground.instanceId,
        "player2",
        falcon.instanceId,
        canAttackRushWithYellowThunder,
      ),
    ).toBe(false);
    expect(
      canAttackDefender(
        state,
        "player1",
        aircraft.instanceId,
        "player2",
        falcon.instanceId,
        canAttackRushWithYellowThunder,
      ),
    ).toBe(true);
  });
});
