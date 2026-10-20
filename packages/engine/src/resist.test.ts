import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { finalizeLeavePending } from "./rules/operationCounters";
import { clearRegisterHoldOffField } from "./rules/resist";
import { canMoveUnitToBattle, cannotAttackOrStrikeThisTurn } from "./rules/restrictions";
import { canStrikeUnit } from "./rules/combo";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";
import { legendDefinitions } from "./testing/battleEntry";

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error("expected ok");
  return result.state;
}

const RESIST_UNIT: CardDefinition = {
  id: "TST-RESIST",
  name: "Resist Unit",
  type: "unit",
  category: "WB",
  rarity: "N",
  expansion: "test",
  powerCost: 2,
  bp: 2000,
  sp: 1,
  size: "S",
  // ルール: R-KW-00 — キーワードは本文の「※レジスト」表記で持つ（特徴ではない）
  text: "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにホールド状態にしてもよい）",
};

describe("register (resist)", () => {
  it("defers battle destruction to pendingRegister for resist units", () => {
    const defender = inst("TST-RESIST", "d1");
    const state = createTestState({
      phase: "battle",
      player2: { battle: [defender] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const next = finalizeLeavePending(
      state,
      {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
        registerEligible: true,
      },
      false,
    );
    expect(next.pendingRegister?.ownerPlayerId).toBe("player2");
    expect(next.players.player2.battle).toHaveLength(1);
  });

  it("does not offer register for effect destroys without registerEligible", () => {
    const defender = inst("TST-RESIST", "d1");
    const state = createTestState({
      phase: "battle",
      player2: { battle: [defender] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const next = finalizeLeavePending(
      state,
      {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
      false,
    );
    expect(next.pendingRegister).toBeUndefined();
    expect(next.players.player2.battle).toHaveLength(0);
  });

  it("holds unit on field when use_register is chosen", () => {
    const defender = inst("TST-RESIST", "d1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: { battle: [defender] },
      pendingRegister: {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "use_register")).toBe(true);

    const result = applyAction(state, {
      type: "use_register",
      playerId: "player2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const held = result.state.players.player2.battle.find(
      (c) => c.instanceId === defender.instanceId,
    );
    expect(held?.registerHeld).toBe(true);
    expect(held?.commandHeld).toBe(true);
    expect(result.state.pendingRegister).toBeUndefined();
  });

  it("allows use_register while damage payment is still pending on the stack", () => {
    const defender = inst("TST-RESIST", "d1");
    const faceUp = { ...inst("TST-P", "p1"), faceDown: false };
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player2: { battle: [defender], power: [faceUp, { ...inst("TST-P", "p2"), faceDown: true }] },
      pendingRegister: {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
      pendingDamagePayment: {
        playerId: "player2",
        remainingFlips: 1,
        deckDraws: 0,
        totalDamage: 1,
        selectedFlipIds: [],
        resume: { kind: "none", activePlayer: "player1" },
      },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const actions = getLegalActions(state);
    expect(actions.every((a) => a.type === "use_register" || a.type === "pass_register")).toBe(
      true,
    );

    const result = applyAction(state, {
      type: "use_register",
      playerId: "player2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingRegister).toBeUndefined();
    expect(result.state.pendingDamagePayment?.remainingFlips).toBe(1);
  });

  it("R-HOLD-02: レジストのホールドはスタートフェイズにラッシュへ戻しても解除されない", () => {
    const defender = {
      ...inst("TST-RESIST", "d1"),
      registerHeld: true,
      commandHeld: true,
      battleActed: true,
    };
    let state = createTestState({
      phase: "start",
      activePlayer: "player2",
      player2: { battle: [defender] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    state = unwrap(
      applyAction(state, {
        type: "return_all_battle_to_rush",
        playerId: "player2",
      }),
    );
    const returned = state.players.player2.rush.find(
      (c) => c.instanceId === defender.instanceId,
    );
    expect(returned?.registerHeld).toBe(true);
    expect(returned?.commandHeld).toBe(true);
    expect(returned?.battleActed).toBeUndefined();
  });

  it("R-START-01: スタートフェイズのリリースはコマンドだけ（ホールド中ユニットはそのまま）", () => {
    const held = { ...inst("TST-RESIST", "d1"), registerHeld: true, commandHeld: true };
    const cmd = { ...inst("TST-UNIT-2", "c1"), commandHeld: true };
    let state = createTestState({
      phase: "start",
      activePlayer: "player2",
      player2: { rush: [held], command: [cmd] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;
    state = unwrap(applyAction(state, { type: "release_start_commands", playerId: "player2" }));
    expect(state.players.player2.command[0]?.commandHeld).toBeFalsy();
    const unit = state.players.player2.rush.find((c) => c.instanceId === held.instanceId);
    expect(unit?.commandHeld).toBe(true);
    expect(unit?.registerHeld).toBe(true);
  });

  it("R-KW-RESIST-04: ホールド中（リリース状態でない）のユニットはレジストできない", () => {
    const defender = { ...inst("TST-RESIST", "d1"), registerHeld: true, commandHeld: true };
    const state = createTestState({
      phase: "battle",
      player2: { battle: [defender] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const next = finalizeLeavePending(
      state,
      {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
        registerEligible: true,
      },
      false,
    );
    expect(next.pendingRegister).toBeUndefined();
    expect(next.players.player2.battle).toHaveLength(0);
    // ルール: R-HOLD-02 — ユニットでなくなればホールドは解除される
    const discarded = next.players.player2.discard.find((c) => c.instanceId === defender.instanceId);
    expect(discarded).toBeDefined();
  });

  it("R-HOLD-03: レジストでホールド中のユニットもバトルエリアに出られる（アタック・ストライクは未確定のため不可のまま）", () => {
    const held = { ...inst("TST-RESIST", "d1"), registerHeld: true, commandHeld: true };
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player2: { rush: [held] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;
    expect(canMoveUnitToBattle(state, "player2", held)).toBe(true);
    expect(canStrikeUnit(state.definitions, held, state, "player2")).toBe(false);
    expect(cannotAttackOrStrikeThisTurn(state.players.player2, held, state, "player2")).toBe(true);
  });

  it("R-HOLD-02: 場を離れたカードのホールドは解除される", () => {
    const card = { ...inst("TST-RESIST", "d1"), registerHeld: true, commandHeld: true };
    const state = createTestState({ player2: { hand: [card] } });
    const cleared = clearRegisterHoldOffField(state);
    expect(cleared.players.player2.hand[0]?.registerHeld).toBeUndefined();
    expect(cleared.players.player2.hand[0]?.commandHeld).toBeUndefined();
  });

  describe("R-KW-RESIST-03: 「バトルに勝っても撃破される」で撃破されたときはレジスト不可", () => {
    function setup(defenderCardId: string, attackerCardId: string) {
      const defsWithResist = {
        ...legendDefinitions,
        "SR-004": { ...legendDefinitions["SR-004"]!, features: ["レジスト"] },
        "TST-RESIST": RESIST_UNIT,
      };
      const defender = inst(defenderCardId, "def");
      const attacker = inst(attackerCardId, "atk");
      const state = createTestState({
        definitions: defsWithResist,
        phase: "battle",
        activePlayer: "player2",
        player1: {
          battle: [defender],
          command: [heldWbCommand("c1"), heldWbCommand("c2")],
        },
        player2: { battle: [attacker], command: [heldWbCommand("c3")] },
      });
      const battleAction = getLegalActions(state).find(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === attacker.instanceId &&
          a.defenderInstanceId === defender.instanceId,
      );
      expect(battleAction).toBeDefined();
      return { state: unwrap(applyAction(state, battleAction!)), defender };
    }

    it("R-KW-RESIST-03: 防御側が勝ったのに自身の効果で撃破された場合はレジストを提示しない", () => {
      const { state, defender } = setup("SR-004", "TST-UNIT-0");
      expect(state.pendingRegister).toBeUndefined();
      expect(state.players.player1.discard.some((c) => c.instanceId === defender.instanceId)).toBe(
        true,
      );
    });

    it("R-KW-RESIST-03: 防御側がバトルに負けて撃破された場合はレジストできる", () => {
      const { state, defender } = setup("TST-RESIST", "SR-004");
      expect(state.pendingRegister?.instanceId).toBe(defender.instanceId);
    });
  });
});
