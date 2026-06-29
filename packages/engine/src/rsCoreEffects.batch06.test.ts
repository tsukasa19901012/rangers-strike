import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { rushPowerCost } from "./core/catalog";
import { passiveNamedFieldBpBonus } from "./rules/fieldAuras";
import { canStrikeWithHelloMirage } from "./rules/helloMirage";
import { finalizeLeaveReaction } from "./rules/operationCounters";
import { applyNumberComboEffect } from "./rules/numberComboEffects";
import { applyGrantKeyword } from "./dsl/grantKeyword";
import { collectRequiredFusionMaterials, applyAllZordFusionMaterials } from "./rules/zord";
import { applyPromotedNcEffect, reorderEnemyBattleAfterRush } from "./rules/promotedNcEffects";
import { canMoveUnitToBattle } from "./rules/restrictions";
import { markRushedThisTurn } from "./rules/turnModifiers";
import { legendDefinitions, battleFillers } from "./testing/battleEntry";
import { createTestState, inst } from "./testing/fixtures";

const defs = legendDefinitions;

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

// RS-351..520: 170 cards
const RS_CORE_BATCH06 = Array.from({ length: 170 }, (_, i) =>
  `RS-${String(351 + i).padStart(3, "0")}`,
);

describe("RS core batch06 audit coverage", () => {
  it.each(RS_CORE_BATCH06)("catalog includes %s", (cardId) => {
    expect(defs[cardId]).toBeDefined();
  });
});

// ─── RS-368 レッドマスク ────────────────────────────────────────────────────────
// ※これは、ラッシュしたターンにバトルエリアに出られない（自軍ダメージ4点以上で無効）
describe("RS-368 rush-turn battle entry restriction", () => {
  it("blocks move_to_battle on rush turn when own damage < 4", () => {
    const redMask = inst("RS-368", "red");
    const basePlayer = createTestState({ definitions: defs }).players.player1;
    const markedPlayer = markRushedThisTurn(basePlayer, redMask.instanceId);
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [redMask],
        modifiers: markedPlayer.modifiers,
        damage: 2,
      },
    });
    expect(canMoveUnitToBattle(state, "player1", redMask)).toBe(false);
  });

  it("allows move_to_battle on rush turn when own damage >= 4", () => {
    const redMask = inst("RS-368", "red");
    const basePlayer = createTestState({ definitions: defs }).players.player1;
    const markedPlayer = markRushedThisTurn(basePlayer, redMask.instanceId);
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [redMask],
        modifiers: markedPlayer.modifiers,
        damage: 4,
      },
    });
    expect(canMoveUnitToBattle(state, "player1", redMask)).toBe(true);
  });
});

// ─── RS-382 ビクトリーロボ ─────────────────────────────────────────────────────
// 【人の命は地球の未来】NC → 捨札から手札に加えたSユニット枚数 × SP+1
describe("RS-382 victory_robo_strike NC", () => {
  it("marks victory_robo_strike on battle unit after NC", () => {
    const robo = inst("RS-382", "robo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [robo] },
    });
    const { state: after } = applyPromotedNcEffect(state, "player1", robo);
    const unit = after.players.player1.battle[0]!;
    expect(unit.activatedNcEffects).toContain("victory_robo_strike");
  });
});

// ─── RS-397 タイムジェット1 ────────────────────────────────────────────────────
// 【予期せぬ出現】ラッシュ時に敵バトルエリアを好きな順に並べ替えてもよい
describe("RS-397 reorder_enemy_battle on rush", () => {
  it("reverses enemy battle order when called with 2+ enemy units", () => {
    const e1 = inst("TST-UNIT-0", "e1");
    const e2 = inst("TST-UNIT-2", "e2");
    const state = createTestState({
      definitions: defs,
      player2: { battle: [e1, e2] },
    });
    const after = reorderEnemyBattleAfterRush(state, "player1");
    expect(after.players.player2.battle[0]!.instanceId).toBe(e2.instanceId);
    expect(after.players.player2.battle[1]!.instanceId).toBe(e1.instanceId);
  });

  it("is a no-op when enemy has only one battle unit", () => {
    const e1 = inst("TST-UNIT-0", "e1");
    const state = createTestState({
      definitions: defs,
      player2: { battle: [e1] },
    });
    const after = reorderEnemyBattleAfterRush(state, "player1");
    expect(after.players.player2.battle[0]!.instanceId).toBe(e1.instanceId);
  });
});

// ─── RS-407 天空大聖者マジエル ─────────────────────────────────────────────────
// 【ハロー・ミラージュ】ラッシュ中は全Sユニットにカテゴリ順制限付与
describe("RS-407 hello_mirage field restriction", () => {
  it("blocks WB S unit from striking at battle position 1 (should be position 2)", () => {
    const mirage = inst("RS-407", "mirage");
    // TST-UNIT-0 is WB category → must be at index 1 (position 2) to strike
    const wbUnit = inst("TST-UNIT-0", "wb");
    const state = createTestState({
      definitions: defs,
      player1: {
        rush: [mirage],
        battle: [wbUnit], // index 0 → position 1, wrong for WB
      },
    });
    expect(canStrikeWithHelloMirage(state, "player1", wbUnit)).toBe(false);
  });

  it("allows WB S unit to strike when it is at battle position 2 (index 1)", () => {
    const mirage = inst("RS-407", "mirage");
    const wbUnit = inst("TST-UNIT-0", "wb");
    const state = createTestState({
      definitions: defs,
      player1: {
        rush: [mirage],
        battle: [inst("TST-UNIT-0", "front"), wbUnit], // wb at index 1 → position 2
      },
    });
    expect(canStrikeWithHelloMirage(state, "player1", wbUnit)).toBe(true);
  });

  it("returns true (no restriction) when hello mirage is not in rush", () => {
    const wbUnit = inst("TST-UNIT-0", "wb");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [wbUnit] },
    });
    expect(canStrikeWithHelloMirage(state, "player1", wbUnit)).toBe(true);
  });
});

// ─── RS-414 冥府神ティターン ────────────────────────────────────────────────────
// ※特徴「ピンク」を持つ敵軍ユニットがあるとき、これはバトルエリアに出られない
describe("RS-414 titan battle entry restriction", () => {
  it("blocks move_to_battle when enemy field has a unit with ピンク feature", () => {
    const titan = inst("RS-414", "titan");
    // RS-060 マジピンク has features: ピンク, 女, 魔法
    const pinkUnit = inst("RS-060", "pink");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [titan] },
      player2: { rush: [pinkUnit] },
    });
    expect(canMoveUnitToBattle(state, "player1", titan)).toBe(false);
  });

  it("allows move_to_battle when no enemy ピンク unit is present", () => {
    const titan = inst("RS-414", "titan");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [titan] },
      player2: { rush: [inst("TST-UNIT-0", "no-pink")] },
    });
    expect(canMoveUnitToBattle(state, "player1", titan)).toBe(true);
  });
});

// ─── RS-419 聖剣ズバーン ────────────────────────────────────────────────────────
// ※これはアタックすることができない
describe("RS-419 sword_zuban cannot attack", () => {
  it("has no legal battle actions as attacker", () => {
    const zuban = inst("RS-419", "zuban");
    const enemy = inst("TST-UNIT-0", "enemy");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [zuban] },
      player2: { battle: [enemy] },
    });
    const attacks = getLegalActions(state).filter(
      (a) => a.type === "battle" && a.attackerInstanceId === zuban.instanceId,
    );
    expect(attacks).toHaveLength(0);
  });
});

// ─── RS-421 アカレッド ──────────────────────────────────────────────────────────
// ※これは特徴「レッド」を持つ自軍コマンド1つにつきBP+1000される
describe("RS-421 akarred red_command bp_bonus", () => {
  it("gains BP+1000 per own command with レッド feature", () => {
    const akarred = inst("RS-421", "akarred");
    // RS-031 バルイーグル has features: レッド, 男
    const redCmd1 = { ...inst("RS-031", "r1"), commandHeld: false };
    const redCmd2 = { ...inst("RS-031", "r2"), commandHeld: false };
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [akarred],
        command: [redCmd1, redCmd2],
      },
    });
    expect(passiveNamedFieldBpBonus(state, "player1", akarred, "general")).toBe(2000);
  });

  it("gains no bonus from own commands without レッド feature", () => {
    const akarred = inst("RS-421", "akarred");
    const nonRedCmd = { ...inst("TST-OP-ET", "c1"), commandHeld: false };
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [akarred],
        command: [nonRedCmd],
      },
    });
    expect(passiveNamedFieldBpBonus(state, "player1", akarred, "general")).toBe(0);
  });
});

// ─── RS-426 スーパーゲキレッド ──────────────────────────────────────────────────
// ※撃破時: 手札の「スーパーゲキレッド」か捨札の「ゲキレッド」を1枚ラッシュへ
describe("RS-426 super_geki_red leave effect", () => {
  it("reanimates ゲキレッド (RS-340) from discard when no スーパーゲキレッド in hand", () => {
    const superRed = inst("RS-426", "s-red");
    // RS-340 is ゲキレッド (S)
    const gekiRed = inst("RS-340", "g-red");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: superRed.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: superRed.cardId,
      phasePlayerId: "player1" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: {
        battle: [superRed],
        discard: [gekiRed],
      },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.players.player1.rush.some((c) => c.cardId === "RS-340")).toBe(true);
    expect(after.players.player1.discard.some((c) => c.cardId === "RS-340")).toBe(false);
  });

  it("moves スーパーゲキレッド from hand to rush when no ゲキレッド in discard", () => {
    const superRed = inst("RS-426", "s-red");
    // Another copy of RS-426 スーパーゲキレッド in hand
    const superRedInHand = inst("RS-426", "s-red-hand");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: superRed.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: superRed.cardId,
      phasePlayerId: "player1" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: {
        battle: [superRed],
        hand: [superRedInHand],
        discard: [],
      },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.players.player1.rush.some((c) => c.instanceId === superRedInHand.instanceId)).toBe(true);
    expect(after.players.player1.hand.some((c) => c.instanceId === superRedInHand.instanceId)).toBe(false);
  });
});

// ─── RS-427 スーパーゲキイエロー ────────────────────────────────────────────────
// ※撃破時: 捨札の「ゲキイエロー」を1枚ラッシュへ
// 【オネスト・ハート】NC → 直前の敵ターン効果を無効にする
describe("RS-427 super_geki_yellow", () => {
  it("reanimates ゲキイエロー (RS-342) from discard when destroyed", () => {
    const superYellow = inst("RS-427", "s-yellow");
    // RS-342 is ゲキイエロー (S)
    const gekiYellow = inst("RS-342", "g-yellow");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: superYellow.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: superYellow.cardId,
      phasePlayerId: "player1" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: {
        battle: [superYellow],
        discard: [gekiYellow],
      },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.players.player1.rush.some((c) => c.cardId === "RS-342")).toBe(true);
    expect(after.players.player1.discard.some((c) => c.cardId === "RS-342")).toBe(false);
  });

  it("NC (invalidate_next_opponent_turn) sets turn modifier on player", () => {
    const superYellow = inst("RS-427", "s-yellow");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [superYellow] },
    });
    const { state: after } = applyPromotedNcEffect(state, "player1", superYellow);
    const hasMod = after.players.player1.modifiers?.some(
      (m) => m.ruleId === "invalidate_next_opponent_turn_effects",
    );
    expect(hasMod).toBe(true);
  });
});

// ─── RS-428 スーパーゲキブルー ──────────────────────────────────────────────────
// ※撃破時: 捨札の「ゲキブルー」を1枚ラッシュへ
describe("RS-428 super_geki_blue leave effect", () => {
  it("reanimates ゲキブルー (RS-341) from discard when destroyed", () => {
    const superBlue = inst("RS-428", "s-blue");
    // RS-341 is ゲキブルー (S)
    const gekiBlue = inst("RS-341", "g-blue");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: superBlue.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: superBlue.cardId,
      phasePlayerId: "player1" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: {
        battle: [superBlue],
        discard: [gekiBlue],
      },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.players.player1.rush.some((c) => c.cardId === "RS-341")).toBe(true);
    expect(after.players.player1.discard.some((c) => c.cardId === "RS-341")).toBe(false);
  });
});

// ─── RS-442 バトルフランス ──────────────────────────────────────────────────────
// ※これは特徴「女」を持つユニットにアタックされない
describe("RS-442 battle_france no_attack_from_female", () => {
  it("blocks a unit with 女 feature from attacking RS-442", () => {
    const france = inst("RS-442", "france");
    // RS-059 マジブルー has features: ブルー, 女, 魔法
    const femaleAtk = inst("RS-059", "female-atk");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [femaleAtk] },
      player2: { battle: [france] },
    });
    const attacks = getLegalActions(state).filter(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === femaleAtk.instanceId &&
        a.defenderInstanceId === france.instanceId,
    );
    expect(attacks).toHaveLength(0);
  });

  it("allows a unit without 女 feature to attack RS-442", () => {
    const france = inst("RS-442", "france");
    // TST-UNIT-0 has no 女 feature
    const maleAtk = inst("TST-UNIT-0", "male-atk");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [maleAtk] },
      player2: { battle: [france] },
    });
    const attacks = getLegalActions(state).filter(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === maleAtk.instanceId &&
        a.defenderInstanceId === france.instanceId,
    );
    expect(attacks.length).toBeGreaterThan(0);
  });
});

// ─── RS-471 グランドライナー ────────────────────────────────────────────────────
// ※敵軍ターン中に撃破されたとき: コマンドゾーンのメカMユニットを好きな枚数ラッシュへ
// 【グランドストーム】コマンドゾーンにメカMユニットが5枚あればSP1（フィールドオーラ）
describe("RS-471 grand_liner enemy-turn leave effect", () => {
  it("opens grand_liner_mecha_rush choice when destroyed on enemy turn with メカ M in command", () => {
    const grandLiner = inst("RS-471", "gl");
    // RS-043 パトストライカー: M unit with features メカ, 車両
    const mechaM = inst("RS-043", "mecha");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: grandLiner.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: grandLiner.cardId,
      phasePlayerId: "player2" as const, // enemy turn
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: {
        battle: [grandLiner],
        command: [mechaM],
      },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.pendingEffectChoice?.effectId).toBe("grand_liner_mecha_rush");
    expect(after.pendingEffectChoice?.validInstanceIds).toContain(mechaM.instanceId);
  });

  it("does not trigger mecha rush choice when destroyed on own turn", () => {
    const grandLiner = inst("RS-471", "gl");
    const mechaM = inst("RS-043", "mecha");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: grandLiner.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: grandLiner.cardId,
      phasePlayerId: "player1" as const, // own turn
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: {
        battle: [grandLiner],
        command: [mechaM],
      },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.pendingEffectChoice?.effectId ?? "").not.toBe("grand_liner_mecha_rush");
  });
});

// ─── RS-501 エレハン・キンポー ──────────────────────────────────────────────────
// ※これは特徴「女」を持つユニット1体につきBP+1000される
// (restriction: cannot enter battle on own turn — tested via DSL rule)
describe("RS-501 elehung_kempo female_unit bp_bonus", () => {
  it("gains BP+1000 per own 女 unit across rush and battle zones", () => {
    const kempo = inst("RS-501", "kempo");
    // RS-059 マジブルー: 女 (S), RS-065 ボウケンイエロー: 女 (S)
    const femaleInBattle = inst("RS-059", "fb");
    const femaleInRush = inst("RS-065", "fr");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2", // NOT own turn (kempo is player1)
      player1: {
        battle: [kempo, femaleInBattle],
        rush: [femaleInRush],
      },
    });
    expect(passiveNamedFieldBpBonus(state, "player1", kempo, "general")).toBe(2000);
  });

  it("gains no bonus when no 女 units are on own field", () => {
    const kempo = inst("RS-501", "kempo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player1: {
        battle: [kempo, inst("TST-UNIT-0", "non-female")],
      },
    });
    expect(passiveNamedFieldBpBonus(state, "player1", kempo, "general")).toBe(0);
  });

  it("cannot enter battle on own turn (DSL rule: cannot_enter_battle_own_turn)", () => {
    const kempo = inst("RS-501", "kempo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1", // own turn
      player1: { rush: [kempo] },
    });
    expect(canMoveUnitToBattle(state, "player1", kempo)).toBe(false);
  });

  it("can enter battle on enemy turn", () => {
    const kempo = inst("RS-501", "kempo");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2", // enemy turn
      player1: { rush: [kempo] },
    });
    expect(canMoveUnitToBattle(state, "player1", kempo)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Known gap fixes: RS-351/402/460
// ---------------------------------------------------------------------------

describe("RS-351 ニューレッドビュート", () => {
  it("grants SP1 and opens enemy command S to silent battle choice", () => {
    const red = inst("RS-351", "red");
    const enemyCmd = inst("TST-UNIT-0", "cmd");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [red, ...battleFillers(4)] },
      player2: { command: [enemyCmd] },
    });
    const { state: after } = applyPromotedNcEffect(state, "player1", red);
    expect(after.players.player1.battle.find((c) => c.instanceId === red.instanceId)?.spModifier).toBe(1);
    expect(after.pendingEffectChoice?.effectId).toBe("new_red_beet");
    expect(after.pendingEffectChoice?.commandAction).toBe("battle_silent");
  });
});

describe("RS-402 灼熱の獅子", () => {
  it("forces opponent to discard a command when enemy has more commands", () => {
    const gaored = inst("RS-402", "gao");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        battle: [gaored, ...battleFillers(4)],
        command: [inst("TST-OP", "own")],
      },
      player2: {
        command: [inst("TST-OP", "e1"), inst("TST-OP-ET", "e2")],
      },
    });
    const { state: after } = applyPromotedNcEffect(state, "player1", gaored);
    expect(after.pendingEffectChoice?.playerId).toBe("player2");
    expect(after.pendingEffectChoice?.commandAction).toBe("discard");
  });
});

describe("RS-445 ディスコダンス", () => {
  it("grants SP1 on NC and can return female S units to rush at end turn", () => {
    const miss = inst("RS-445", "miss");
    const pink = inst("RS-060", "pink");
    let state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [miss, pink, ...battleFillers(3)] },
    });
    const { state: afterNc } = applyPromotedNcEffect(state, "player1", miss);
    expect(afterNc.players.player1.battle.find((c) => c.instanceId === "RS-445:miss")?.spModifier).toBe(1);
    expect(
      afterNc.players.player1.battle.find((c) => c.instanceId === "RS-445:miss")?.activatedNcEffects,
    ).toContain("disco_dance");

    state = { ...afterNc, phase: "battle", activePlayer: "player1" };
    const withChoice = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(withChoice.ok).toBe(true);
    if (!withChoice.ok) return;
    expect(withChoice.state.phase).toBe("end");
    expect(withChoice.state.pendingEffectChoice?.effectId).toBe("disco_dance");

    const resolved = applyAction(withChoice.state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: "return",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.player1.battle.some((c) => c.instanceId === "RS-060:pink")).toBe(false);
    expect(resolved.state.players.player1.rush.some((c) => c.instanceId === "RS-060:pink")).toBe(true);
  });
});

describe("RS-460 忍法花爆弾", () => {
  it("opens declare number choice and overrides enemy S rush cost", () => {
    const ran = inst("RS-460", "ran");
    const enemyS = inst("RS-351", "enemy");
    let state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [ran, ...battleFillers(4)] },
      player2: { rush: [enemyS] },
    });
    const { state: afterNc } = applyPromotedNcEffect(state, "player1", ran);
    expect(afterNc.pendingEffectChoice?.kind).toBe("declare_number");

    const declared = applyAction(afterNc, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: "5",
    });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    state = declared.state;
    const cost = rushPowerCost(state, "player2", defs[enemyS.cardId]!);
    expect(cost).toBe(5);
  });
});

describe("RS-686 seikuuoh fusion partners", () => {
  it("requires all three fusion materials including RS-667", () => {
    const trip = inst("RS-668", "trip");
    const jet = inst("RS-666", "jet");
    const jean = inst("RS-667", "jean");
    const zord = inst("RS-686", "zord");
    const player = {
      ...createTestState({ definitions: defs }).players.player1,
      rush: [trip, jet, jean, zord],
    };
    const materials = collectRequiredFusionMaterials(
      player,
      defs,
      "RS-686",
      zord.instanceId,
    );
    expect(materials?.map((m) => m.card.cardId).sort()).toEqual([
      "RS-666",
      "RS-667",
      "RS-668",
    ]);
    const after = applyAllZordFusionMaterials(player, defs, "RS-686", zord.instanceId);
    expect(after?.rush.map((c) => c.cardId)).toEqual(["RS-686"]);
    expect(after?.discard.map((c) => c.cardId).sort()).toEqual([
      "RS-666",
      "RS-667",
      "RS-668",
    ]);
  });
});

describe("RS-629 megasuringu", () => {
  it("returns released command to deck top and debuffs enemy rush S by 1500", () => {
    const mega = inst("RS-629", "mega");
    const cmd = inst("TST-OP-DA", "cmd");
    const enemyS = inst("RS-351", "enemy");
    let state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [mega, ...battleFillers(1)],
        command: [{ ...cmd, commandHeld: false }],
        deck: [inst("TST-P", "deck")],
      },
      player2: { rush: [enemyS] },
    });
    const { state: afterNc } = applyNumberComboEffect(state, "player1", mega, null);
    expect(afterNc.pendingEffectChoice?.effectId).toBe("megasuringu");

    const chosen = applyAction(afterNc, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: cmd.instanceId,
    });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    state = chosen.state;
    expect(state.players.player1.command).toHaveLength(0);
    expect(state.players.player1.deck[0]?.instanceId).toBe(cmd.instanceId);
    const enemyUnit = state.players.player2.rush[0];
    expect(enemyUnit?.bpModifier).toBe(-1500);
  });
});

describe("RS-667 fuasutokurasuna", () => {
  it("opens deck scry to deploy honoo M unit to rush on rush", () => {
    const jean = inst("RS-667", "jean");
    const honooM = inst("RS-668", "honoo");
    const other = inst("TST-P", "other");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        rush: [jean],
        deck: [honooM, other],
      },
    });
    const result = applyGrantKeyword(state, {
      playerId: "player1",
      phasePlayerId: "player1",
      sourceCardId: "RS-667",
      effectId: "fuasutokurasuna",
      triggerSourceInstanceId: jean.instanceId,
      optional: true,
    }, "on_rush_scry_exclude_named_feature_m_to_rush");
    expect(result.state.pendingEffectChoice?.kind).toBe("scry_keep_one");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(honooM.instanceId);
    expect(result.state.pendingEffectChoice?.validInstanceIds).not.toContain(other.instanceId);
  });
});

void unwrap; // referenced only to avoid unused-import lint
