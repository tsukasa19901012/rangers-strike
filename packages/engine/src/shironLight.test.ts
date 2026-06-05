import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { legend1Catalog, getCardEffect } from "@rangers-strike/cards";
import { applyAction } from "./core/applyAction";
import { getLegalActions } from "./core/legalActions";
import { placePermanentOperation } from "./effects/resolveOperation";
import { createTestState, inst } from "./testing/fixtures";

function def(id: string): CardDefinition {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

const RS073: CardDefinition = {
  id: "RS-073",
  name: "サンバルカンロボ",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "legend2",
  powerCost: "6+",
  rushAdditionalCondition: {
    conditionId: "discard_fusion_unit",
    text: "自軍合体ユニットを捨札にする",
  },
  bp: 9000,
  sp: 1,
  size: "L",
};

const RS074: CardDefinition = {
  id: "RS-074",
  name: "コスモバルカン",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "legend2",
  powerCost: "4+",
  bp: 4000,
  size: "M",
};

const RS075: CardDefinition = {
  id: "RS-075",
  name: "ブルバルカン",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "legend2",
  powerCost: "5+",
  bp: 5000,
  size: "M",
};

function runShironReveal(
  state: ReturnType<typeof createTestState>,
  handInstanceId: string,
) {
  const started = applyAction(state, {
    type: "shiron_light",
    playerId: "player1",
    operationInstanceId: state.players.player1.operation[0]!.instanceId,
  });
  expect(started.ok).toBe(true);
  if (!started.ok) return null;

  const picked = applyAction(started.state, {
    type: "resolve_effect_choice",
    playerId: "player2",
    instanceId: handInstanceId,
  });
  expect(picked.ok).toBe(true);
  if (!picked.ok) return null;

  const revealed = applyAction(picked.state, {
    type: "confirm_shiron_reveal",
    playerId: "player2",
  });
  expect(revealed.ok).toBe(true);
  if (!revealed.ok) return null;
  return revealed.state;
}

describe("shiron_light QA", () => {
  const definitions = {
    ...createTestState().definitions,
    "RS-013": def("RS-013"),
    "RS-073": RS073,
    "RS-074": RS074,
    "RS-075": RS075,
    "RS-124": {
      id: "RS-124",
      name: "超レーダー",
      type: "operation" as const,
      category: "ET" as const,
      rarity: "N" as const,
      expansion: "legend3",
      powerCost: 3,
      tags: ["常駐"],
    },
  };

  it("Q1: can rush zord using fusion units from rush after shiron reveal with low power", () => {
    const zordInHand = inst("RS-073", "hand");
    const shiron = inst("RS-013", "op");

    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions,
      player1: {
        hand: [zordInHand],
        rush: [inst("RS-074", "rush1"), inst("RS-075", "rush2")],
        operation: [shiron],
        power: Array.from({ length: 6 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [],
      },
      player2: { hand: [] },
    });

    const afterReveal = runShironReveal(state, zordInHand.instanceId);
    expect(afterReveal?.players.player1.shironLightRushInstanceId).toBe(zordInHand.instanceId);

    const rush = getLegalActions(afterReveal!).find(
      (a) => a.type === "rush" && a.instanceId === zordInHand.instanceId,
    );
    expect(rush).toBeDefined();

    const rushed = applyAction(afterReveal!, rush!);
    expect(rushed.ok).toBe(true);
    if (!rushed.ok) return;
    expect(
      rushed.state.players.player1.rush.some((c) => c.instanceId === zordInHand.instanceId),
    ).toBe(true);
    expect(rushed.state.players.player1.rush.some((c) => c.cardId === "RS-074")).toBe(
      false,
    );
  });

  it("Q2: replacing RS-013 allows another activation in the same rush phase", () => {
    const shiron1 = inst("RS-013", "op1");
    const shiron2Card = inst("RS-013", "op2hand");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions,
      player1: {
        hand: [inst("TST-UNIT-0", "h1"), shiron2Card],
        operation: [{ ...shiron1, shironLightUsedThisRush: true }],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
      },
      player2: { hand: [] },
    });

    state = placePermanentOperation(state, "player1", shiron2Card);
    const op2 = state.players.player1.operation[0]!;
    expect(op2.shironLightUsedThisRush).toBeUndefined();

    const actions = getLegalActions(state).filter((a) => a.type === "shiron_light");
    expect(actions.some((a) => a.operationInstanceId === op2.instanceId)).toBe(true);
  });

  it("Q4: shiron rush does not require category command hold", () => {
    const etUnit = inst("RS-073", "hand");
    const shiron = inst("RS-013", "op");

    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions,
      player1: {
        hand: [etUnit],
        rush: [inst("RS-074", "rush1"), inst("RS-075", "rush2")],
        operation: [shiron],
        power: Array.from({ length: 6 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [{ ...inst("TST-OP-ET", "cmd"), commandHeld: false }],
      },
      player2: { hand: [] },
    });

    const afterReveal = runShironReveal(state, etUnit.instanceId);
    const actions = getLegalActions(afterReveal!);
    expect(
      actions.some(
        (a) =>
          a.type === "initiate_command_payment" &&
          a.kind === "category_use" &&
          a.sourceInstanceId === etUnit.instanceId,
      ),
    ).toBe(false);
    expect(
      actions.some((a) => a.type === "rush" && a.instanceId === etUnit.instanceId),
    ).toBe(true);
  });

  it("Q3: shiron rush triggers on-rush effects like a normal rush", () => {
    const unit = inst("TST-UNIT-0", "hand");
    const shiron = inst("RS-013", "op");
    const faceUpPower = { ...inst("TST-P", "p1"), faceDown: false };

    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: {
        ...createTestState().definitions,
        "RS-013": def("RS-013"),
        "RS-124": definitions["RS-124"]!,
      },
      player1: {
        hand: [unit],
        operation: [shiron, inst("RS-124", "radar")],
        power: [faceUpPower],
      },
      player2: { hand: [] },
    });

    const afterReveal = runShironReveal(state, unit.instanceId);
    const rush = getLegalActions(afterReveal!).find(
      (a) => a.type === "rush" && a.instanceId === unit.instanceId,
    );
    expect(rush).toBeDefined();
    const rushed = applyAction(afterReveal!, rush!);
    expect(rushed.ok).toBe(true);
    if (!rushed.ok) return;
    expect(rushed.state.players.player1.hand.some((c) => c.instanceId === faceUpPower.instanceId)).toBe(
      true,
    );
  });

  it("marks the used RS-013 instance and exposes initiate per unused copy", () => {
    const shiron = inst("RS-013", "op");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: {
        ...createTestState().definitions,
        "RS-013": def("RS-013"),
      },
      player1: {
        hand: [inst("TST-UNIT-0", "h1")],
        operation: [shiron],
      },
    });

    const actions = getLegalActions(state).filter((a) => a.type === "shiron_light");
    expect(actions).toHaveLength(1);
    expect(getCardEffect("RS-013")?.effectId).toBe("shiron_light");

    const afterReveal = runShironReveal(state, "TST-UNIT-0:h1");
    expect(afterReveal?.players.player1.operation[0]?.shironLightUsedThisRush).toBe(true);
    expect(
      getLegalActions(afterReveal!).some((a) => a.type === "shiron_light"),
    ).toBe(false);
  });
});
