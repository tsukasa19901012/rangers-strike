import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { selectedPrintedBpSum, startJuuKunDoChoice } from "./rules/pendingChoices";
import { createTestState, inst } from "./testing/fixtures";

const rs106Def = {
  id: "RS-106",
  name: "ジュウクンドー",
  type: "unit" as const,
  category: "OT" as const,
  rarity: "N" as const,
  expansion: "legend2",
  powerCost: 3,
  bp: 3000,
  size: "M" as const,
  comboNumber: 6,
};

function unitDef(id: string, name: string, bp: number) {
  return {
    id,
    name,
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 0,
    bp,
    size: "S" as const,
  };
}

describe("RS-106 juu_kun_do attack replacement", () => {
  it("offers use_juu_kun_do when RS-106 can attack an enemy", () => {
    const attacker = inst("RS-106", "att");
    const defender = inst("TST-UNIT-0", "def");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: { battle: [defender] },
    });
    state.definitions["RS-106"] = rs106Def;

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "use_juu_kun_do")).toBe(true);
    expect(actions.some((a) => a.type === "battle")).toBe(true);
  });

  it("does not offer use_juu_kun_do when no legal attack target exists", () => {
    const attacker = inst("RS-106", "att");
    const jetFalcon = inst("RS-135", "jf");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: { battle: [jetFalcon] },
    });
    state.definitions["RS-106"] = rs106Def;
    state.definitions["RS-135"] = {
      id: "RS-135",
      name: "ジェットファルコン",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "legend2",
      powerCost: 2,
      bp: 2000,
      size: "S",
      features: ["航空機"],
    };

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "use_juu_kun_do")).toBe(false);
    expect(actions.some((a) => a.type === "battle")).toBe(false);
  });

  it("marks RS-106 battleActed after confirming juu_kun_do", () => {
    const attacker = inst("RS-106", "att");
    const e1 = inst("E1", "e1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: { battle: [e1], rush: [] },
    });
    state.definitions["RS-106"] = rs106Def;
    state.definitions["E1"] = unitDef("E1", "2000", 2000);

    const use = applyAction(state, {
      type: "use_juu_kun_do",
      playerId: "player1",
      attackerInstanceId: attacker.instanceId,
    });
    expect(use.ok).toBe(true);
    if (!use.ok) return;
    state = use.state;

    const confirmed = applyAction(state, {
      type: "confirm_effect_choice",
      playerId: "player1",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(
      confirmed.state.players.player1.battle.find((c) => c.instanceId === attacker.instanceId)
        ?.battleActed,
    ).toBe(true);
    expect(
      getLegalActions(confirmed.state).some((a) => a.type === "battle" && a.attackerInstanceId === attacker.instanceId),
    ).toBe(false);
  });

  it("allows attack after skipping juu_kun_do", () => {
    const attacker = inst("RS-106", "att");
    const defender = inst("TST-UNIT-0", "def");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: { battle: [defender] },
    });
    state.definitions["RS-106"] = rs106Def;

    const use = applyAction(state, {
      type: "use_juu_kun_do",
      playerId: "player1",
      attackerInstanceId: attacker.instanceId,
    });
    expect(use.ok).toBe(true);
    if (!use.ok) return;

    const skipped = applyAction(use.state, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(
      skipped.state.players.player1.battle.find((c) => c.instanceId === attacker.instanceId)
        ?.battleActed,
    ).toBeFalsy();
    expect(getLegalActions(skipped.state).some((a) => a.type === "battle")).toBe(true);
  });
});

describe("RS-106 juu_kun_do", () => {
  it("opens multi-select with all enemy rush units", () => {
    const attacker = inst("RS-106", "att");
    const e1 = inst("E1", "e1");
    const e2 = inst("E2", "e2");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [e1, e2] },
    });
    state.definitions["RS-106"] = rs106Def;
    state.definitions["E1"] = unitDef("E1", "2000", 2000);
    state.definitions["E2"] = unitDef("E2", "1500", 1500);

    const withChoice = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      sourceInstanceId: attacker.instanceId,
      phasePlayerId: "player1",
    });
    expect(withChoice?.pendingEffectChoice?.kind).toBe("select_units_bp_budget");
    expect(withChoice?.pendingEffectChoice?.validInstanceIds).toEqual([
      e1.instanceId,
      e2.instanceId,
    ]);
  });

  it("allows selecting multiple units until printed BP sum exceeds 3000", () => {
    const attacker = inst("RS-106", "att");
    const e1 = inst("E1", "e1");
    const e2 = inst("E2", "e2");
    let state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [e1, e2] },
    });
    state.definitions["RS-106"] = rs106Def;
    state.definitions["E1"] = unitDef("E1", "2000", 2000);
    state.definitions["E2"] = unitDef("E2", "1500", 1500);

    state = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      sourceInstanceId: attacker.instanceId,
      phasePlayerId: "player1",
    })!;

    const pick1 = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: e1.instanceId,
    });
    expect(pick1.ok).toBe(true);
    if (!pick1.ok) return;
    state = pick1.state;
    expect(state.pendingEffectChoice?.selectedInstanceIds).toEqual([e1.instanceId]);

    const pick2 = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: e2.instanceId,
    });
    expect(pick2.ok).toBe(false);
    if (pick2.ok) return;
    expect(pick2.error).toBe("illegal_action");

    const deselect = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: e1.instanceId,
    });
    expect(deselect.ok).toBe(true);
    if (!deselect.ok) return;
    expect(deselect.state.pendingEffectChoice?.selectedInstanceIds).toEqual([]);

    const pickBoth = applyAction(deselect.state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: e2.instanceId,
    });
    expect(pickBoth.ok).toBe(true);
    if (!pickBoth.ok) return;
    expect(pickBoth.state.pendingEffectChoice?.selectedInstanceIds).toEqual([e2.instanceId]);
    expect(selectedPrintedBpSum(pickBoth.state, [e2.instanceId])).toBe(1500);
  });

  it("destroys all confirmed targets on confirm", () => {
    const attacker = inst("RS-106", "att");
    const e1 = inst("E1", "e1");
    const e2 = inst("E2", "e2");
    let state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [e1, e2] },
    });
    state.definitions["RS-106"] = rs106Def;
    state.definitions["E1"] = unitDef("E1", "2000", 2000);
    state.definitions["E2"] = unitDef("E2", "1000", 1000);

    state = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      phasePlayerId: "player1",
    })!;

    let s = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: e1.instanceId,
    });
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    s = applyAction(s.state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: e2.instanceId,
    });
    expect(s.ok).toBe(true);
    if (!s.ok) return;

    const confirmed = applyAction(s.state, {
      type: "confirm_effect_choice",
      playerId: "player1",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.state.pendingEffectChoice).toBeUndefined();
    expect(confirmed.state.players.player2.rush).toHaveLength(0);
    expect(
      confirmed.state.players.player2.discard.some((c) => c.instanceId === e1.instanceId),
    ).toBe(true);
    expect(
      confirmed.state.players.player2.discard.some((c) => c.instanceId === e2.instanceId),
    ).toBe(true);
  });

  it("opens optional choice with no targets when enemy rush is empty", () => {
    const attacker = inst("RS-106", "att");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [] },
    });
    state.definitions["RS-106"] = rs106Def;
    const withChoice = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      sourceInstanceId: attacker.instanceId,
      phasePlayerId: "player1",
    });
    expect(withChoice?.pendingEffectChoice?.validInstanceIds).toEqual([]);
    expect(withChoice?.pendingEffectChoice?.optional).toBe(true);
  });

  it("allows skip when enemy rush is empty", () => {
    const attacker = inst("RS-106", "att");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [] },
    });
    state.definitions["RS-106"] = rs106Def;
    const withChoice = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      sourceInstanceId: attacker.instanceId,
      phasePlayerId: "player1",
      optional: true,
    });
    expect(withChoice).not.toBeNull();
    if (!withChoice) return;
    expect(withChoice.pendingEffectChoice?.validInstanceIds).toEqual([]);
    const actions = getLegalActions(withChoice);
    expect(actions.some((a) => a.type === "skip_effect_choice")).toBe(true);
    expect(actions.some((a) => a.type === "confirm_effect_choice")).toBe(true);

    const skipped = applyAction(withChoice, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.pendingEffectChoice).toBeUndefined();
  });

  it("lists confirm and toggle actions in legal actions", () => {
    const attacker = inst("RS-106", "att");
    const e1 = inst("E1", "e1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [e1] },
    });
    state.definitions["E1"] = unitDef("E1", "2000", 2000);
    const withChoice = startJuuKunDoChoice(state, {
      playerId: "player1",
      effectId: "juu_kun_do",
      sourceCardId: "RS-106",
      phasePlayerId: "player1",
    })!;
    const actions = getLegalActions(withChoice);
    expect(actions.some((a) => a.type === "confirm_effect_choice")).toBe(true);
    expect(actions.some((a) => a.type === "skip_effect_choice")).toBe(true);
    expect(
      actions.some(
        (a) => a.type === "resolve_effect_choice" && a.instanceId === e1.instanceId,
      ),
    ).toBe(true);
  });
});
