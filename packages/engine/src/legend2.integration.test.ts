import { describe, expect, it } from "vitest";
import { legend1Catalog, legend2Catalog } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { resolveInfiniteChain } from "./rules/legend2/operations";
import { createTestState, heldEtCommand, heldOtCommand, inst, TEST_DEFINITIONS } from "./testing/fixtures";
import { battleFillers, moveToBattle } from "./testing/battleEntry";

const defs = {
  ...TEST_DEFINITIONS,
  ...Object.fromEntries(
    [...legend1Catalog.cards, ...legend2Catalog.cards].map((card) => [card.id, card]),
  ),
};

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

describe("legend2 integration", () => {
  it("RS-072 infinite chain disables opponent counters flag", () => {
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        hand: [inst("RS-072", "chain")],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
        command: [{ ...inst("RS-071", "da-perm"), commandHeld: true }],
      },
    });
    const played = unwrap(
      applyAction(state, {
        type: "play_operation",
        playerId: "player1",
        instanceId: "RS-072:chain",
      }),
    );
    expect(played.players.player1.turnModifiers?.infiniteChainActive).toBe(true);
  });

  it("RS-072 resolveInfiniteChain sets turn modifier", () => {
    const state = createTestState({ definitions: defs });
    const result = resolveInfiniteChain(state, "player1");
    expect(result.state.players.player1.turnModifiers?.infiniteChainActive).toBe(true);
  });

  it("RS-075 rescue activity opens discard choice on rush", () => {
    const mecha = inst("RS-075", "rescue");
    const discard = inst("RS-074", "mecha-discard");
    const sMaterial = inst("RS-080", "s-material");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [mecha],
        rush: [sMaterial],
        discard: [discard],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldEtCommand("held")],
      },
    });
    const rushed = unwrap(
      applyAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: "RS-075:rescue",
        zordMaterialInstanceId: "RS-080:s-material",
      }),
    );
    expect(rushed.pendingEffectChoice?.effectId).toBe("rescue_activity");
  });

  it("RS-082 tricera lance NC holds enemy command", () => {
    const unit = inst("RS-082", "lance");
    const enemyCmd = inst("RS-007", "enemy-cmd");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(2),
      },
      player2: {
        command: [{ ...enemyCmd, commandHeld: false }],
      },
    });
    const entered = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: "RS-082:lance",
      }),
    );
    expect(entered.pendingEffectChoice?.effectId).toBe("tricera_lance");
  });

  it("RS-084 sure win combination deals 2 damage on rush", () => {
    const zord = inst("RS-084", "zord");
    const partners = ["RS-085", "RS-086", "RS-087", "RS-088", "RS-089"].map(
      (id, index) => inst(id, `fusion-${index}`),
    );
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        hand: [zord],
        rush: partners,
        power: Array.from({ length: 8 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldOtCommand("held")],
      },
    });
    const rushed = unwrap(
      applyAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: "RS-084:zord",
      }),
    );
    expect(rushed.players.player2.damage).toBe(2);
  });

  it("RS-095 mane hurricane returns enemy rush S on enter", () => {
    const zord = inst("RS-095", "zord");
    const enemyS = inst("RS-080", "enemy-s");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { rush: [zord] },
      player2: { rush: [enemyS], hand: [] },
    });
    const entered = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: "RS-095:zord",
      }),
    );
    expect(entered.players.player2.rush).toHaveLength(0);
    expect(entered.players.player2.hand.some((c) => c.cardId === "RS-080")).toBe(true);
  });

  it("RS-073 val shield strikes for 2 damage at 6 life lost", () => {
    const robo = inst("RS-073", "robo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        damage: 6,
        battle: [{ ...robo, battleActed: false }],
      },
      player2: { battle: [] },
    });
    const struck = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: "RS-073:robo",
      }),
    );
    expect(struck.players.player2.damage).toBe(2);
  });

  it("RS-073 val shield stays SP1 below 6 damage", () => {
    const robo = inst("RS-073", "robo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        damage: 5,
        battle: [{ ...robo, battleActed: false }],
      },
      player2: { battle: [] },
    });
    const struck = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: "RS-073:robo",
      }),
    );
    expect(struck.players.player2.damage).toBe(1);
  });

  it("RS-099 grant_sp1 NC on battle entry", () => {
    const unit = inst("RS-099", "ninpo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        rush: [unit],
        battle: battleFillers(2),
      },
    });
    const entered = moveToBattle(state, unit.instanceId);
    const battle = entered.players.player1.battle.find((c) => c.cardId === "RS-099");
    expect((battle?.spModifier ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("RS-107 deace sniper sets opponent flag", () => {
    const unit = inst("RS-107", "sniper");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        rush: [unit],
        battle: battleFillers(1),
      },
    });
    const entered = moveToBattle(state, unit.instanceId);
    expect(entered.players.player2.turnModifiers?.deaceSniperActive).toBe(true);
  });

  it("RS-111 phantom illusion holds enemy commands on enter", () => {
    const zord = inst("RS-111", "phantom");
    const enemyCmd = inst("RS-007", "cmd");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { rush: [zord] },
      player2: { command: [{ ...enemyCmd, commandHeld: false }] },
    });
    const entered = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: "RS-111:phantom",
      }),
    );
    expect(entered.players.player2.command[0]?.commandHeld).toBe(true);
  });
});
