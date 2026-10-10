/**
 * E7: 原文に効果があるのにバニラとして動いていた 13 枚のうち、エンジンで実行される効果の挙動確認。
 * （カタログ text / 効果定義の有無は packages/cards/src/e7SourceTextCards.test.ts）
 */
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog, getNumberComboEffect, type CardDefinition } from "@rangers-strike/cards";
import { effectiveBp } from "./core/catalog";
import { applyNumberComboEffect, numberComboTriggers } from "./rules/numberComboEffects";
import { resolveUnitLeftZoneEffectsImpl } from "./rules/leaveEffects";
import { strikeDamageFor } from "./rules/combo";
import type { CardInstance, GameState } from "./types/game";
import { createTestState, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const DEFINITIONS: Record<string, CardDefinition> = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(fullPlayableCatalog.cards.map((card) => [card.id, card])),
};

function runNc(state: GameState, card: CardInstance, before: CardInstance[]): GameState {
  const def = DEFINITIONS[card.cardId]!;
  const position = before.length + 1;
  expect(numberComboTriggers(state, "player1", card, def, position, before)).toBe(true);
  return applyNumberComboEffect(state, "player1", card, getNumberComboEffect(card.cardId)).state;
}

function battleUnit(state: GameState, instanceId: string): CardInstance {
  const unit = state.players.player1.battle.find((c) => c.instanceId === instanceId);
  if (!unit) throw new Error(`missing ${instanceId}`);
  return unit;
}

describe("E7: アバレッドAM（RS-230 / PR-016）", () => {
  // ルール: R-DESTROY-01 / R-DESTROY-02 — 撃破されて捨札になったとき、捨札の「アバレッド」をラッシュエリアへ
  it.each([["RS-230"], ["PR-016"]])("%s が撃破されて捨札になると、捨札の「アバレッド」を選ぶ", (cardId) => {
    const am = inst(cardId, "am");
    const abared = inst("RS-054", "abared");
    const other = inst("RS-055", "other");
    const state = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      activePlayer: "player2",
      player1: { discard: [am, abared, other] },
    });

    const result = resolveUnitLeftZoneEffectsImpl(state, {
      ownerPlayerId: "player1",
      instanceId: am.instanceId,
      cardId,
      fromZone: "battle",
      toZone: "discard",
      phasePlayerId: "player2",
    });

    const choice = result.state.pendingEffectChoice;
    expect(choice?.kind).toBe("select_unit");
    expect(choice?.validInstanceIds).toEqual([abared.instanceId]);
  });

  // ルール: R-CN-02 — CN2 の位置に出たとき【アバレスラッシュ】「SP1」
  it("RS-230 は CN2 で出ると「SP1」になる", () => {
    const first = inst("TST-UNIT-0", "first");
    const am = inst("RS-230", "am");
    const state = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      player1: { battle: [first, am] },
    });
    expect(strikeDamageFor(DEFINITIONS, am, state, "player1")).toBe(0);
    const next = runNc(state, am, [first]);
    expect(strikeDamageFor(DEFINITIONS, battleUnit(next, am.instanceId), next, "player1")).toBe(1);
  });
});

describe("E7: アバレキラーAM（XG1-030）【キラークロー】", () => {
  // ルール: R-CN-02 / R-CN-06 — NC で「SP1」とこのターン BP+2000
  it("CN2 で出ると「SP1」と BP+2000", () => {
    const first = inst("TST-UNIT-0", "first");
    const killer = inst("XG1-030", "killer");
    const state = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      player1: { battle: [first, killer] },
    });
    const baseBp = effectiveBp(state, "player1", killer);
    const next = runNc(state, killer, [first]);
    const after = battleUnit(next, killer.instanceId);
    expect(effectiveBp(next, "player1", after)).toBe(baseBp + 2000);
    expect(strikeDamageFor(DEFINITIONS, after, next, "player1")).toBe(1);
  });
});

describe("E7: アバレブラックAM（XG1-029）【無敵の竜人魂】", () => {
  it("CN1 で出ると、敵軍バトルエリアの BP8000 以下の L ユニットだけを選べる", () => {
    const black = inst("XG1-029", "black");
    const lowL = inst("XG1-028", "low-l"); // BP8000 L
    const highL = inst("PR-015", "high-l"); // BP11000 L
    const enemyS = inst("TST-UNIT-0", "enemy-s");
    const state = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      player1: { battle: [black] },
      player2: { battle: [lowL, highL, enemyS] },
    });
    const next = runNc(state, black, []);
    expect(next.pendingEffectChoice?.kind).toBe("select_unit");
    expect(next.pendingEffectChoice?.validInstanceIds).toEqual([lowL.instanceId]);
  });
});

describe("E7: マックスビクトリーロボ（XG3-005）【マックスノバ】", () => {
  const robo = inst("XG3-005", "robo");
  const discard = (n: number) => Array.from({ length: n }, (_, i) => inst("TST-OP", `d${i}`));

  it("自軍捨札6枚につき「SP+1」（印刷 SP1 に加算）", () => {
    const at = (n: number) => {
      const state = createTestState({
        definitions: DEFINITIONS,
        phase: "battle",
        player1: { battle: [robo], discard: discard(n) },
      });
      return strikeDamageFor(DEFINITIONS, robo, state, "player1");
    };
    expect(at(5)).toBe(1);
    expect(at(6)).toBe(2);
    expect(at(13)).toBe(3);
  });
});

describe("E7: マックスビクトリーロボBV（XG5-014）", () => {
  const bv = inst("XG5-014", "bv");

  it("【マックスビクトリープロミネンス】自軍ターン中、自軍ラッシュエリアの S ユニット1体につき BP+1000", () => {
    const rush = [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2"), inst("XG1-028", "l")];
    const own = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      player1: { battle: [bv], rush },
    });
    const enemyTurn = { ...own, activePlayer: "player2" as const };
    const printed = DEFINITIONS["XG5-014"]!.bp!;
    const sCount = rush.filter((c) => DEFINITIONS[c.cardId]?.size === "S").length;
    expect(sCount).toBe(2);
    expect(effectiveBp(own, "player1", bv)).toBe(printed + 2000);
    expect(effectiveBp(enemyTurn, "player1", bv)).toBe(printed);
  });

  it("※自軍捨札に S ユニットのカードが1枚もなければ「SP1」", () => {
    const withoutS = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      player1: { battle: [bv], discard: [inst("TST-OP", "op")] },
    });
    const withS = createTestState({
      definitions: DEFINITIONS,
      phase: "battle",
      player1: { battle: [bv], discard: [inst("TST-UNIT-0", "s")] },
    });
    expect(strikeDamageFor(DEFINITIONS, bv, withoutS, "player1")).toBe(1);
    expect(strikeDamageFor(DEFINITIONS, bv, withS, "player1")).toBe(0);
  });
});
