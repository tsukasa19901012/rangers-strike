import { describe, expect, it } from "vitest";
import { legend1Catalog, legend2Catalog, legend3Catalog } from "@rangers-strike/cards";
import { applyAction, canMoveUnitToBattle, getLegalActions, unitEffectiveCategories } from "./index";
import { resolveNamedOnRushEffects } from "./rules/namedUnitEffects";
import { startSagasSniperChoice } from "./rules/pendingChoices";
import { createTestState, inst } from "./testing/fixtures";
import { legendDefinitions, moveToBattle } from "./testing/battleEntry";
import { buildZordRushSetup } from "./testing/gameplayFlow";

const defs = {
  ...Object.fromEntries(
    [...legend1Catalog.cards, ...legend2Catalog.cards, ...legend3Catalog.cards].map(
      (card) => [card.id, card],
    ),
  ),
  "TST-P": {
    id: "TST-P",
    name: "Test Power",
    type: "power",
    category: "OT",
    rarity: "C",
    expansion: "legend1",
    powerCost: 0,
    bp: 0,
    sp: 0,
  },
  "TST-OP-DA": {
    id: "TST-OP-DA",
    name: "DA Command",
    type: "command",
    category: "DA",
    rarity: "C",
    expansion: "legend1",
    powerCost: 0,
    bp: 0,
    sp: 0,
  },
};

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

describe("legend3 integration", () => {
  it("RS-170 dark deal pays rush shortfall with command holds", () => {
    const daUnit = inst("RS-079", "da-hand");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [daUnit],
        rush: [inst("RS-170", "dark-deal")],
        power: [inst("TST-P", "p1")],
        command: [
          { ...inst("TST-OP-DA", "cmd1"), commandHeld: true },
          inst("TST-OP-DA", "cmd2"),
        ],
        rushCategoryHoldReady: true,
      },
    });
    const rushed = unwrap(
      applyAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: "RS-079:da-hand",
      }),
    );
    expect(rushed.players.player1.rush.some((c) => c.cardId === "RS-079")).toBe(true);
    expect(rushed.players.player1.command.filter((c) => c.commandHeld).length).toBeGreaterThan(0);
  });

  it("RS-132 requires discarding S from rush before battle entry", () => {
    const cannon = inst("RS-132", "cannon");
    const silver = inst("RS-079", "silver");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [cannon, silver],
      },
    });
    const pending = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: "RS-132:cannon",
      }),
    );
    expect(pending.pendingEffectChoice?.effectId).toBe("battle_entry_discard");

    const paid = unwrap(
      applyAction(pending, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: "RS-079:silver",
      }),
    );
    expect(paid.players.player1.battleEntryRushDiscardReady).toBe(true);
    expect(paid.players.player1.battleEntryDiscardedCardId).toBe("RS-079");

    const entered = moveToBattle(paid, "RS-132:cannon", "player1");
    const unit = entered.players.player1.battle.find((c) => c.cardId === "RS-132");
    expect(unit?.spModifier).toBe(1);
    expect(unit?.bpModifier).toBe(5000);
  });

  it("RS-154 cannot attack enemy S in battle but can attack enemy S in rush", () => {
    const attacker = inst("RS-154", "attacker");
    const enemyBattleS = inst("RS-138", "enemy-battle-s");
    const enemyRushS = inst("RS-139", "enemy-rush-s");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [attacker],
        command: [{ ...inst("TST-OP-DA", "hold"), commandHeld: true }],
        battleEntryHoldReady: true,
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
          a.attackerInstanceId === "RS-154:attacker" &&
          a.defenderInstanceId === "RS-138:enemy-battle-s",
      ),
    ).toBe(false);
    expect(
      actions.some(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === "RS-154:attacker" &&
          a.defenderInstanceId === "RS-139:enemy-rush-s",
      ),
    ).toBe(true);
  });

  it("RS-128 base_attack grants SP1 when entering from バイオジェット2号", () => {
    const bio1 = inst("RS-128", "bio1");
    const bio2 = inst("RS-129", "bio2");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [bio2],
        rush: [bio1],
      },
    });
    const entered = moveToBattle(state, "RS-128:bio1", "player1");
    const unit = entered.players.player1.battle.find((c) => c.cardId === "RS-128");
    expect(unit?.spModifier).toBe(1);
  });

  it("RS-131 mirage_beam uses revealed deck unit BP and discards it after battle", () => {
    const metzler = inst("RS-131", "metzler");
    const deckUnit = inst("RS-079", "deck-top");
    const defender = inst("TST-UNIT-0", "def");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [metzler],
        deck: [deckUnit],
        command: [{ ...inst("TST-OP-DA", "hold"), commandHeld: true }],
        battleEntryHoldReady: true,
      },
      player2: {
        battle: [defender],
      },
    });
    const battled = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: "RS-131:metzler",
        defenderInstanceId: "TST-UNIT-0:def",
      }),
    );
    const rs079Bp = defs["RS-079"]?.bp ?? 0;
    expect(battled.log.some((e) => e.includes(`:${rs079Bp}vs`))).toBe(true);
    expect(battled.players.player1.deck).toHaveLength(0);
    expect(
      battled.players.player1.discard.some((c) => c.instanceId === "RS-079:deck-top"),
    ).toBe(true);
  });

  it("RS-147 super_moa_cannon buffs ally MA M units on enemy turn", () => {
    const moaLoader = inst("RS-147", "moa");
    const allyMa = inst("RS-145", "dash");
    const attacker = inst("TST-UNIT-2", "atk");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player1: {
        rush: [moaLoader],
        battle: [allyMa],
      },
      player2: {
        battle: [attacker],
        command: [{ ...inst("TST-OP-DA", "hold"), commandHeld: true }],
        battleEntryHoldReady: true,
      },
    });
    const battled = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player2",
        attackerInstanceId: "TST-UNIT-2:atk",
        defenderInstanceId: "RS-145:dash",
      }),
    );
    const allyBp = defs["RS-145"]?.bp ?? 0;
    expect(battled.log.some((e) => e.includes(`vs${allyBp + 1000}`))).toBe(true);
  });

  it("RS-147 requires combo from ダッシュレオン to enter battle", () => {
    const moa = inst("RS-147", "moa");
    const dash = inst("RS-145", "dash");
    const withoutPartner = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [moa] },
    });
    expect(canMoveUnitToBattle(withoutPartner, "player1", moa, "rush")).toBe(false);

    const withPartner = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [dash],
        rush: [moa],
      },
    });
    expect(canMoveUnitToBattle(withPartner, "player1", moa, "rush")).toBe(true);
  });

  it("RS-148 cannot enter battle on the turn it rushed", () => {
    const ored = inst("RS-148", "ored");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [ored],
        turnModifiers: {
          comboNumberDelta: 0,
          battleBlockedInstanceIds: [],
          shironLightUsed: false,
          rushedThisTurnInstanceIds: ["RS-148:ored"],
        },
      },
    });
    expect(canMoveUnitToBattle(state, "player1", ored, "rush")).toBe(false);
  });

  it("RS-165 requires discarding two cards from hand before battle entry", () => {
    const wolf = inst("RS-165", "wolf");
    const hand1 = inst("TST-OP-DA", "h1");
    const hand2 = inst("TST-OP", "h2");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [wolf],
        hand: [hand1, hand2],
      },
    });
    const pending = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: "RS-165:wolf",
      }),
    );
    expect(pending.pendingEffectChoice?.effectId).toBe("battle_entry_hand_discard");
    expect(pending.pendingEffectChoice?.selectCount).toBe(2);

    const paid = unwrap(
      applyAction(pending, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: "TST-OP-DA:h1",
      }),
    );
    expect(paid.pendingEffectChoice?.selectedInstanceIds).toEqual(["TST-OP-DA:h1"]);

    const ready = unwrap(
      applyAction(paid, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: "TST-OP:h2",
      }),
    );
    expect(ready.players.player1.battleEntryHandDiscardReady).toBe(true);
    expect(ready.players.player1.hand).toHaveLength(0);

    const entered = moveToBattle(ready, "RS-165:wolf", "player1");
    expect(entered.players.player1.battle.some((c) => c.cardId === "RS-165")).toBe(true);
  });

  it("RS-166 gains MA category while in battle", () => {
    const gain = inst("RS-166", "gain");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [gain],
      },
    });
    const cats = unitEffectiveCategories(state, "player1", gain, "battle");
    expect(cats).toContain("MA");
    expect(cats).toContain("DA");
  });

  it("RS-178 sagas_sniper shows full deck but only eligible units are selectable", () => {
    const state = createTestState({
      definitions: defs,
      player1: {
        deck: [
          inst("RS-079", "cheap"),
          inst("RS-135", "expensive"),
          inst("TST-OP-DA", "command"),
        ],
      },
    });

    const opened = startSagasSniperChoice(state, {
      playerId: "player1",
      sourceCardId: "RS-178",
      sourceInstanceId: "RS-178:sagas",
      phasePlayerId: "player1",
      maxPowerCost: 2,
    });

    const pending = opened?.pendingEffectChoice;
    expect(pending?.effectId).toBe("sagas_sniper");
    expect(pending?.viewedInstanceIds).toHaveLength(3);
    expect(pending?.validInstanceIds).toHaveLength(1);
    expect(pending?.validInstanceIds[0]).toBe("RS-079:cheap");
    expect(pending?.maxPowerCost).toBe(2);
  });

  it("RS-172 requires S-unit payment when rushing", () => {
    const shovel = inst("RS-172", "shovel");
    const sUnit = inst("RS-079", "silver");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [shovel],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [{ ...inst("RS-123", "cmd1"), commandHeld: true }],
        rushCategoryHoldReady: true,
      },
    });

    const materialRushes = getLegalActions(state).filter(
      (a) =>
        a.type === "rush" &&
        a.instanceId === shovel.instanceId &&
        a.zordMaterialInstanceId === sUnit.instanceId,
    );
    const bareRush = getLegalActions(state).filter(
      (a) =>
        a.type === "rush" &&
        a.instanceId === shovel.instanceId &&
        !a.zordMaterialInstanceId &&
        (a.zordMothershipHoldInstanceIds?.length ?? 0) === 0,
    );
    expect(materialRushes.length).toBeGreaterThanOrEqual(1);
    expect(bareRush).toHaveLength(0);
  });

  it("RS-128 and RS-129 can begin zord setup with multi-slot dekabase payment", () => {
    for (const zordCardId of ["RS-128", "RS-129"] as const) {
      const setup = buildZordRushSetup(legendDefinitions, zordCardId);
      expect(setup, `setup failed for ${zordCardId}`).not.toBeNull();
      if (!setup) continue;
      expect(setup.payment?.zordMothershipHoldInstanceIds?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("RS-176 great assault returns fusion partners to defender hand", () => {
    const assault = inst("RS-176", "assault");
    const enemyZord = inst("RS-117", "gogo");
    const fusionPart = inst("RS-118", "part");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [assault] },
      player2: {
        battle: [enemyZord],
        discard: [fusionPart],
      },
    });

    const opened = resolveNamedOnRushEffects(
      state,
      "player1",
      assault.instanceId,
      "player1",
    );
    expect(opened.state.pendingEffectChoice?.effectId).toBe("great_assault");
    expect(opened.state.pendingEffectChoice?.validInstanceIds).toContain(enemyZord.instanceId);

    const resolved = unwrap(
      applyAction(opened.state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: enemyZord.instanceId,
      }),
    );

    expect(resolved.players.player2.discard.some((c) => c.cardId === "RS-117")).toBe(true);
    expect(resolved.players.player2.hand.some((c) => c.instanceId === fusionPart.instanceId)).toBe(
      true,
    );
  });

  it("RS-152 scorching roar lets WB M enter battle without hold when gaolion is in rush and discard has same name", () => {
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

    expect(canMoveUnitToBattle(state, "player1", eagle, "rush")).toBe(true);
    const entered = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: eagle.instanceId,
      }),
    );
    expect(entered.players.player1.battle.some((c) => c.instanceId === eagle.instanceId)).toBe(
      true,
    );
    expect(entered.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it("RS-152 scorching roar does not bypass hold without same-name card in discard", () => {
    const gaolion = inst("RS-152", "lion");
    const eagle = inst("RS-153", "eagle");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [gaolion, eagle],
        command: [inst("TST-OP-DA", "cmd")],
      },
    });

    expect(canMoveUnitToBattle(state, "player1", eagle, "rush")).toBe(false);
  });
});
