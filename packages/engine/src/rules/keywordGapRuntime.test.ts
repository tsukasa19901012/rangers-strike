import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { effectiveBp } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import { applyKeywordTurnEndEffects, damageGateBlocksEntry, keywordAllowsAttackIntoRush } from "./keywordGapRuntime";
import { promotedKeywordBpBonus } from "../dsl/promotedKeywordBridge";
import { unitEffectiveCategories } from "../core/catalog";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));
const testDefs = { ...createTestState().definitions, ...defs };

describe("keywordGapRuntime", () => {
  it("XG2-087: discards from battle at turn end", () => {
    const unit = inst("XG2-087", "u1");
    const state = createTestState({
      phase: "end",
      definitions: testDefs,
      player1: { battle: [unit] },
    });
    const r = applyKeywordTurnEndEffects(state, "player1");
    expect(r.state.players.player1.battle).toHaveLength(0);
    expect(r.state.players.player1.discard.some((c) => c.instanceId === unit.instanceId)).toBe(true);
  });

  it("RS-289: self-destroys at turn end when remaining life <= 3", () => {
    const unit = inst("RS-289", "u1");
    const state = createTestState({
      phase: "end",
      definitions: testDefs,
      player1: { battle: [unit], damage: 4 },
    });
    const r = applyKeywordTurnEndEffects(state, "player1");
    expect(r.state.players.player1.battle).toHaveLength(0);

    const safe = createTestState({
      phase: "end",
      definitions: testDefs,
      player1: { battle: [inst("RS-289", "u2")], damage: 3 },
    });
    const r2 = applyKeywordTurnEndEffects(safe, "player1");
    expect(r2.state.players.player1.battle).toHaveLength(1);
  });

  it("RS-280: returns to hand when battle position differs from printed number", () => {
    const wrong = inst("RS-280", "u1");
    const state = createTestState({
      phase: "end",
      definitions: testDefs,
      player1: { battle: [wrong] },
    });
    const printed = testDefs["RS-280"]?.comboNumber;
    expect(typeof printed).toBe("number");
    // 1番目に置く（本来のナンバーが1以外なら手札へ戻る）
    const r = applyKeywordTurnEndEffects(state, "player1");
    if (printed === 1) {
      expect(r.state.players.player1.battle).toHaveLength(1);
    } else {
      expect(r.state.players.player1.hand.some((c) => c.instanceId === wrong.instanceId)).toBe(true);
    }
  });

  it("RS-289: damage gate blocks entry without enemy-turn damage", () => {
    const state = createTestState({ definitions: testDefs });
    expect(damageGateBlocksEntry(state, "player1", "RS-289")).toBe(true);
    const damaged = createTestState({
      definitions: testDefs,
      player1: { damagedOnEnemyTurn: true },
    });
    expect(damageGateBlocksEntry(damaged, "player1", "RS-289")).toBe(false);
  });

  it("RS-534: can attack held enemy rush units", () => {
    const held = { ...inst("TST-UNIT-2", "h1"), commandHeld: true };
    const state = createTestState({
      definitions: testDefs,
      player2: { rush: [held], battle: [] },
    });
    expect(keywordAllowsAttackIntoRush(state, "RS-534", "player2", held.instanceId)).toBe(true);
    expect(keywordAllowsAttackIntoRush(state, "TST-UNIT-2", "player2", held.instanceId)).toBe(false);
  });

  it("XG5-069: BP+1000 while an ally has lead_MA", () => {
    const self = inst("XG5-069", "u1");
    const leadAlly = inst("XG5-037", "u2");
    const withAlly = createTestState({
      definitions: testDefs,
      player1: { rush: [self, leadAlly] },
    });
    const without = createTestState({
      definitions: testDefs,
      player1: { rush: [inst("XG5-069", "u3")] },
    });
    const bonusWith = promotedKeywordBpBonus(withAlly, "player1", self);
    const bonusWithout = promotedKeywordBpBonus(without, "player1", inst("XG5-069", "u3"));
    expect(bonusWith - bonusWithout).toBe(1000);
  });

  it("RS-289: gives +1000 BP aura to 恐竜 allies", () => {
    const source = inst("RS-289", "src");
    const dino = fullPlayableCatalog.cards.find(
      (c) => c.type === "unit" && (c.features ?? []).includes("恐竜") && c.id !== "RS-289",
    )!;
    const target = inst(dino.id, "t1");
    const state = createTestState({
      definitions: testDefs,
      player1: { rush: [source, target] },
    });
    const alone = createTestState({
      definitions: testDefs,
      player1: { rush: [inst(dino.id, "t2")] },
    });
    const withAura = effectiveBp(state, "player1", target);
    const noAura = effectiveBp(alone, "player1", inst(dino.id, "t2"));
    expect(withAura - noAura).toBe(1000);
  });

  it("XG6-021: gains WB category during own battle phase", () => {
    const unit = inst("XG6-021", "u1");
    const battlePhase = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: testDefs,
      player1: { rush: [unit] },
    });
    const cats = unitEffectiveCategories(battlePhase, "player1", unit, "rush");
    expect(cats).toContain("WB");
    const rushPhase = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: testDefs,
      player1: { rush: [unit] },
    });
    const catsRush = unitEffectiveCategories(rushPhase, "player1", unit, "rush");
    expect(catsRush.includes("WB")).toBe((testDefs["XG6-021"]?.category ?? "") === "WB");
  });
});
