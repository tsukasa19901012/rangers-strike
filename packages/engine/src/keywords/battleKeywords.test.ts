import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import { WIN_DAMAGE } from "../types/game";
import {
  applyHoldForWing,
  applyCancelWingHold,
  canCancelWingHold,
  blastBypassesRushAdditionalCondition,
  breakerBlocksEffectTarget,
  breakerBlocksSameNameRush,
  cardHasBattleKeyword,
  canHoldForWing,
  canWingAttackFromRush,
  crossReducedNumber,
  crossReductionFor,
  crossValueForCard,
  prepareWingUnitReturnedToRush,
  resetWingUnitForReuse,
  scrumBlocksAttack,
  taxisSpFloor,
  wingTurnBlocksStrike,
} from "./battleKeywords";
import { canStrikeUnit } from "../rules/combo";
import { canMoveUnitToBattle } from "../rules/restrictions";
import { canAttackDefender } from "../rules/legend3/restrictions";
import { canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import { wingCanAttackEnemyRush } from "./index";
import { addTurnRestrictionModifier } from "../core/scopedModifiers";
import { RESTRICTION_IDS } from "../types/scopedModifiers";
import { applyAction, getLegalActions } from "../index";
import { printedSpBase } from "../rules/fractionalSp";
import { cardHasKeyword } from "./cardKeywords";
import { isSelectableByOpponentEffect } from "./effectTargetability";
import { fullPlayableCatalog, hasResist } from "@rangers-strike/cards";

describe("cross1 keyword", () => {
  it("R-KW-CROSS-01: 右側ユニットの減少量は左側のクロス合計（並び順は変えない）", () => {
    const cross = inst("XG7-013", "c1");
    const follower = inst("TST-FOLLOW", "f1");
    const battle = [cross, follower];
    expect(crossValueForCard("XG7-013")).toBeGreaterThan(0);
    expect(crossReductionFor(battle, follower.instanceId)).toBe(crossValueForCard("XG7-013"));
    expect(crossReductionFor(battle, cross.instanceId)).toBe(0);
    expect(crossReductionFor(battle, "not-in-battle")).toBe(0);
  });

  it("R-KW-CROSS-01: 数字は X 少なくなるが 2 より少なくならず、元が 2 未満なら変わらない", () => {
    expect(crossReducedNumber(5, 2)).toBe(3);
    expect(crossReducedNumber(3, 2)).toBe(2);
    expect(crossReducedNumber(2, 1)).toBe(2);
    expect(crossReducedNumber(1, 1)).toBe(1);
    expect(crossReducedNumber(4, 0)).toBe(4);
  });

  it("R-KW-CROSS-01: 分数SPの分母も減る（1/3 は左にクロス1があれば2番目で SP1）", () => {
    expect(printedSpBase("1/3", 2, 1)).toBe(1);
    expect(printedSpBase("1/3", 3, 1)).toBe(0);
    expect(printedSpBase("1/2", 2, 1)).toBe(1);
  });
});

describe("taxis keyword", () => {
  it("grants SP1 to the next matching-category unit", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-F1",
          name: "F1",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
        {
          id: "TST-F2",
          name: "F2",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
        {
          id: "TST-OT",
          name: "OT Unit",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
      ],
    ]);

    const filler1 = inst("TST-F1", "1");
    const filler2 = inst("TST-F2", "2");
    const taxis = inst("XG7-013", "t");
    const ot = inst("TST-OT", "o");

    const state = {
      ...createTestState(defs),
      definitions: { ...defs, ...createTestState().definitions },
      players: {
        ...createTestState(defs).players,
        player1: {
          ...createTestState(defs).players.player1,
          battle: [filler1, filler2, taxis, ot],
        },
      },
    };

    expect(taxisSpFloor(state, "player1", ot)).toBe(1);
  });
});

describe("scrum keyword", () => {
  const defs = buildDefinitionMap([
    [
      {
        id: "TST-SCRUM",
        name: "Scrum Unit",
        type: "unit",
        category: "MA",
        rarity: "N",
        expansion: "test",
        powerCost: 2,
        bp: 2000,
        size: "S",
        comboNumber: 3,
        text: "※スクラム",
      },
      {
        id: "TST-NEXT",
        name: "Next",
        type: "unit",
        category: "MA",
        rarity: "N",
        expansion: "test",
        powerCost: 1,
        bp: 1000,
        size: "S",
        comboNumber: 4,
      },
      {
        id: "TST-LEFT",
        name: "Left",
        type: "unit",
        category: "MA",
        rarity: "N",
        expansion: "test",
        powerCost: 1,
        bp: 1000,
        size: "S",
        comboNumber: 2,
      },
    ],
  ]);

  it("blocks attack when adjacent right unit has CN + 1", () => {
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [
            inst("TST-LEFT", "left"),
            inst("TST-SCRUM", "s"),
            inst("TST-NEXT", "next"),
          ],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[1]!.instanceId),
    ).toBe(true);
  });

  it("does not block when ascending line exists but adjacent CN+1 is missing", () => {
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [
            inst("TST-LEFT", "left"),
            inst("TST-SCRUM", "s"),
          ],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[1]!.instanceId),
    ).toBe(false);
  });

  it("does not block when right neighbor CN is not +1", () => {
    const wrongNext = inst("TST-LEFT", "wrong");
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [inst("TST-SCRUM", "s"), wrongNext],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[0]!.instanceId),
    ).toBe(false);
  });
});

describe("wing keyword", () => {
  const WING_DEF: CardDefinition = {
    id: "TST-WING",
    name: "Wing Unit",
    type: "unit",
    category: "OT",
    rarity: "N",
    expansion: "test",
    powerCost: 3,
    bp: 5000,
    sp: 1,
    size: "M",
    tags: ["wing"],
  };

  it("requires hold before wing attack from rush", () => {
    const wingUnit = inst("TST-WING", "w1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;

    expect(canHoldForWing(state, "player1", wingUnit)).toBe(true);
    expect(canWingAttackFromRush(state, "player1", wingUnit)).toBe(false);

    const held = applyHoldForWing(state, "player1", wingUnit.instanceId);
    expect(held).not.toBeNull();
    const heldUnit = held!.players.player1.rush[0]!;
    expect(heldUnit.commandHeld).toBe(true);
    expect(canWingAttackFromRush(held!, "player1", heldUnit)).toBe(true);
  });

  it("blocks strike on wing turn after hold", () => {
    const wingUnit = { ...inst("TST-WING", "w1"), commandHeld: true };
    const state = createTestState({
      phase: "battle",
      player1: { battle: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;
    state.players.player1 = addTurnRestrictionModifier(
      state.players.player1,
      wingUnit.instanceId,
      RESTRICTION_IDS.WING_TURN_NO_STRIKE,
    );
    expect(wingTurnBlocksStrike(state.players.player1, wingUnit.instanceId)).toBe(true);
    expect(canStrikeUnit(state.definitions, wingUnit, state, "player1")).toBe(false);
  });

  it("clears battleActed when unit returns to rush during battle", () => {
    const wingUnit = { ...inst("TST-WING", "w1"), battleActed: true };
    const prepared = prepareWingUnitReturnedToRush(wingUnit);
    expect(prepared.battleActed).toBeUndefined();
  });

  it("allows second wing hold after resetWingUnitForReuse", () => {
    const wingUnit = {
      ...inst("TST-WING", "w1"),
      commandHeld: true,
      battleActed: true,
    };
    let player = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
    }).players.player1;
    player = addTurnRestrictionModifier(
      player,
      wingUnit.instanceId,
      RESTRICTION_IDS.WING_TURN_NO_STRIKE,
    );
    player = resetWingUnitForReuse(player, wingUnit.instanceId);

    const state = createTestState({
      phase: "battle",
      player1: player,
    });
    state.definitions["TST-WING"] = WING_DEF;
    expect(canHoldForWing(state, "player1", player.rush[0]!)).toBe(true);
  });

  it("cancels wing hold before attack and clears commandHeld", () => {
    const wingUnit = inst("TST-WING", "w1");
    let state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;

    state = applyHoldForWing(state, "player1", wingUnit.instanceId)!;
    expect(canCancelWingHold(state, "player1", wingUnit.instanceId)).toBe(true);

    state = applyCancelWingHold(state, "player1", wingUnit.instanceId)!;
    const unit = state.players.player1.rush[0]!;
    expect(unit.commandHeld).toBe(false);
    expect(canHoldForWing(state, "player1", unit)).toBe(true);
    expect(canCancelWingHold(state, "player1", wingUnit.instanceId)).toBe(false);
  });

  it("blocks battle entry for the turn after wing hold", () => {
    const wingUnit = inst("TST-WING", "w1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;

    const held = applyHoldForWing(state, "player1", wingUnit.instanceId)!;
    expect(canMoveUnitToBattle(held, "player1", held.players.player1.rush[0]!, "rush")).toBe(
      false,
    );
  });

  it("does not grant enemy-rush targeting to base wing units", () => {
    const wingUnit = { ...inst("TST-WING", "w1"), commandHeld: true };
    const enemyRush = inst("TST-ALLY", "rush");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
      player2: { rush: [enemyRush] },
    });
    state.definitions["TST-WING"] = WING_DEF;
    state.definitions["TST-ALLY"] = {
      ...WING_DEF,
      id: "TST-ALLY",
      name: "Enemy Rush",
      tags: [],
      size: "S",
    };

    expect(wingCanAttackEnemyRush(state, "player1", wingUnit.cardId)).toBe(false);
    expect(
      canAttackDefender(
        state,
        "player1",
        wingUnit.instanceId,
        "player2",
        enemyRush.instanceId,
        canAttackRushWithYellowThunder,
      ),
    ).toBe(false);
  });

  it("attacks enemy battle from rush after wing hold", () => {
    const wingUnit = inst("TST-WING", "w1");
    const enemyBattle = inst("TST-ALLY", "battle");
    let state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
      player2: { battle: [enemyBattle] },
    });
    state.definitions["TST-WING"] = WING_DEF;
    state.definitions["TST-ALLY"] = {
      ...WING_DEF,
      id: "TST-ALLY",
      name: "Enemy Battle",
      tags: [],
    };
    state = applyHoldForWing(state, "player1", wingUnit.instanceId)!;
    const held = state.players.player1.rush[0]!;
    expect(
      canAttackDefender(
        state,
        "player1",
        held.instanceId,
        "player2",
        enemyBattle.instanceId,
        canAttackRushWithYellowThunder,
      ),
    ).toBe(true);
  });

  it("destroys the defender when wing attacks from rush with higher BP", () => {
    const wingUnit = inst("TST-WING", "w1");
    const enemyBattle = inst("TST-ALLY", "battle");
    let state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
      player2: { battle: [enemyBattle] },
    });
    state.definitions["TST-WING"] = WING_DEF;
    state.definitions["TST-ALLY"] = {
      ...WING_DEF,
      id: "TST-ALLY",
      name: "Enemy Battle",
      tags: [],
      bp: 1000,
    };
    state = applyHoldForWing(state, "player1", wingUnit.instanceId)!;

    const battleAction = getLegalActions(state).find(
      (a) =>
        a.type === "battle" &&
        a.attackerInstanceId === wingUnit.instanceId &&
        a.defenderInstanceId === enemyBattle.instanceId,
    );
    expect(battleAction).toBeDefined();

    const next = applyAction(state, battleAction!);
    expect(next.ok).toBe(true);
    if (!next.ok) return;

    expect(next.state.players.player1.rush).toHaveLength(1);
    expect(next.state.players.player2.battle).toHaveLength(0);
    expect(next.state.players.player2.discard).toHaveLength(1);
    expect(next.state.players.player1.discard).toHaveLength(0);
  });
});

describe("blast keyword", () => {
  const blastDefs = () =>
    buildDefinitionMap([
      [
        {
          id: "TST-BLAST",
          name: "Blast Zord",
          type: "unit",
          category: "WB",
          rarity: "SR",
          expansion: "test",
          powerCost: "7+",
          bp: 12000,
          size: "L",
          text: "※ブラスト",
        },
        { id: "TST-L", name: "Big", type: "unit", category: "WB", rarity: "C", expansion: "test", powerCost: 5, bp: 9000, size: "L", text: "" },
        { id: "TST-S", name: "Small", type: "unit", category: "WB", rarity: "C", expansion: "test", powerCost: 1, bp: 3000, size: "S", text: "" },
      ],
    ]);

  const stateWith = (damage: number, rush: ReturnType<typeof inst>[] = [], operation: ReturnType<typeof inst>[] = []) => {
    const defs = blastDefs();
    const state = createTestState(defs);
    state.definitions = defs;
    state.players.player1.damage = damage;
    state.players.player1.rush = rush;
    state.players.player1.operation = operation;
    return state;
  };

  it("R-KW-BLAST-01: 残りダメージ1点で自軍Lユニットがいなければ追加条件を免除する", () => {
    expect(blastBypassesRushAdditionalCondition(stateWith(WIN_DAMAGE - 1), "player1", "TST-BLAST")).toBe(true);
    expect(
      blastBypassesRushAdditionalCondition(stateWith(WIN_DAMAGE - 1, [inst("TST-S", "s1")]), "player1", "TST-BLAST"),
    ).toBe(true);
  });

  it("R-KW-BLAST-01: 自軍にLユニットがいれば免除しない", () => {
    expect(
      blastBypassesRushAdditionalCondition(stateWith(WIN_DAMAGE - 1, [inst("TST-L", "l1")]), "player1", "TST-BLAST"),
    ).toBe(false);
  });

  it("R-KW-BLAST-01: 残りダメージが1点でなければ免除しない（オモテのパワー枚数は関係ない）", () => {
    expect(blastBypassesRushAdditionalCondition(stateWith(WIN_DAMAGE - 2), "player1", "TST-BLAST")).toBe(false);
    expect(blastBypassesRushAdditionalCondition(stateWith(0), "player1", "TST-BLAST")).toBe(false);
  });

  it("R-KW-BLAST-02: 命の泉で敗北が9点になれば8点で免除する", () => {
    const spring = [inst("RS-244", "spring")];
    expect(blastBypassesRushAdditionalCondition(stateWith(8, [], spring), "player1", "TST-BLAST")).toBe(true);
    expect(blastBypassesRushAdditionalCondition(stateWith(WIN_DAMAGE - 1, [], spring), "player1", "TST-BLAST")).toBe(false);
  });
});

describe("breaker keyword", () => {
  it("blocks rushing a second breaker copy of the same name", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-BREAKER",
          name: "Breaker Unit",
          type: "unit",
          category: "ET",
          rarity: "SR",
          expansion: "test",
          powerCost: 5,
          bp: 8000,
          size: "L",
          text: "※ブレイカー",
        },
      ],
    ]);

    const player = {
      ...createTestState(defs).players.player1,
      rush: [inst("TST-BREAKER", "on-field")],
    };

    expect(breakerBlocksSameNameRush(player, defs, "TST-BREAKER")).toBe(true);
  });
});

function breakerTestUnit(id: string, name: string, text?: string): CardDefinition {
  return {
    id,
    name,
    type: "unit",
    category: "ET",
    rarity: "SR",
    expansion: "test",
    powerCost: 5,
    bp: 8000,
    size: "L",
    text,
  };
}

describe("breaker keyword rules", () => {
  const defs = buildDefinitionMap([
    [
      breakerTestUnit("BRK-A", "同名ユニット", "※ブレイカー ※このユニットはテスト用。"),
      breakerTestUnit("PLAIN-A", "同名ユニット", "【テスト】これをラッシュしたとき、カードを1枚引く。"),
      breakerTestUnit("ENEMY-UNIT", "敵ユニット", "【テスト】敵軍ユニットを1体選ぶ。"),
      breakerTestUnit("ENEMY-BRK", "敵ブレイカー", "※ブレイカー"),
      {
        id: "ENEMY-OP",
        name: "敵オペ",
        type: "operation",
        category: "ET",
        rarity: "N",
        expansion: "test",
        powerCost: 1,
        text: "敵軍ユニットを1体選び撃破する。",
      },
    ],
  ]);

  it("R-KW-BREAKER-02: 場の同名カードがブレイカーを持たなくてもブレイカー持ちはラッシュできない", () => {
    const player = { ...createTestState(defs).players.player1, rush: [inst("PLAIN-A", "p")] };
    expect(breakerBlocksSameNameRush(player, defs, "BRK-A")).toBe(true);
  });

  it("R-KW-BREAKER-02: ブレイカー持ちが場にいても、ブレイカーを持たない同名カードはラッシュできる", () => {
    const player = { ...createTestState(defs).players.player1, battle: [inst("BRK-A", "b")] };
    expect(breakerBlocksSameNameRush(player, defs, "PLAIN-A")).toBe(false);
  });

  it("R-KW-BREAKER-03: 敵軍ユニットの効果では選べないが、オペレーションとブレイカー持ちの効果では選べる", () => {
    expect(breakerBlocksEffectTarget(defs, "BRK-A", "ENEMY-UNIT")).toBe(true);
    expect(breakerBlocksEffectTarget(defs, "BRK-A", "ENEMY-OP")).toBe(false);
    expect(breakerBlocksEffectTarget(defs, "BRK-A", "ENEMY-BRK")).toBe(false);
  });

  it("R-KW-BREAKER-03: 敵軍ユニットの効果で持ち主自身が選ぶ場合も選べない／自軍の効果なら選べる", () => {
    const breaker = inst("BRK-A", "brk");
    const state = createTestState({ player2: { battle: [breaker] } });
    state.definitions = { ...state.definitions, ...defs };
    // 敵軍（player1）のユニット効果で player2 自身が選ぶ
    expect(
      isSelectableByOpponentEffect(state, "player2", breaker.instanceId, "ENEMY-UNIT", "player1"),
    ).toBe(false);
    // 敵軍のオペレーションの効果なら相手が選べる
    expect(isSelectableByOpponentEffect(state, "player1", breaker.instanceId, "ENEMY-OP")).toBe(
      true,
    );
    // 敵軍ユニットの効果で相手が選ぶ
    expect(isSelectableByOpponentEffect(state, "player1", breaker.instanceId, "ENEMY-UNIT")).toBe(
      false,
    );
    // 自軍の効果で自分が選ぶ
    expect(isSelectableByOpponentEffect(state, "player2", breaker.instanceId, "BRK-A")).toBe(true);
  });
});

describe("R-KW-00: キーワードは「※キーワード」表記でだけ持つ", () => {
  function unit(id: string, text: string, features?: string[]): CardDefinition {
    return { ...breakerTestUnit(id, id, text), features };
  }
  const defs = buildDefinitionMap([
    [
      unit("MOS", "【モスブレイカー】相手は可能ならコマンドを1つホールドする。"),
      unit("DARK", "【飛翔斬】「ダークウイング」からコンビネーションしたとき、BP+1000。"),
      unit("WING-NAME", "【ウイングペンタクト】自軍ターン中、BP+1000。"),
      unit("RESIST-REF", "【切断溶解】レジストを持つ敵軍Sユニットを1体選び撃破する。"),
      unit(
        "NULLIFY",
        "【ライダーキック】このターン、敵軍ユニットのレジストとスクラムとチェイスの効果は無効になる。",
      ),
      unit("BLAST-NAME", "【ライトニングブラスト&バーニングスマッシュ】BP+3000。"),
      unit("GRANT", "※特徴「女」を持つユニットは次の能力を得る⇒※レジスト（これがバトルで撃破されたとき…）"),
      unit("FEATURE-WING", "【テスト】BP+1000。", ["ウイング"]),
      unit("REAL", "※ウイング ※ブレイカー ※レジスト（これがバトルで撃破されたとき…） ※チェイス ※スクラム（これの…）"),
      unit("REAL-BLAST", "※ブラスト 【フルブラストランチャー】これがバトルエリアに出たとき…"),
      unit("REAL-TAXIS", "※タクスMA ※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき…）"),
    ],
  ]);

  it("R-KW-00: 効果名・本文中の語ではキーワードを持たない", () => {
    expect(cardHasBattleKeyword(defs, "MOS", "breaker")).toBe(false);
    expect(cardHasKeyword(defs, "DARK", "wing")).toBe(false);
    expect(cardHasKeyword(defs, "WING-NAME", "wing")).toBe(false);
    expect(cardHasKeyword(defs, "RESIST-REF", "register")).toBe(false);
    expect(hasResist(defs, "RESIST-REF")).toBe(false);
    expect(cardHasKeyword(defs, "NULLIFY", "register")).toBe(false);
    expect(cardHasKeyword(defs, "NULLIFY", "chase")).toBe(false);
    expect(cardHasBattleKeyword(defs, "NULLIFY", "scrum")).toBe(false);
    expect(cardHasBattleKeyword(defs, "BLAST-NAME", "blast")).toBe(false);
  });

  it("R-KW-00: 他のユニットに付与する「…を得る⇒※レジスト」や特徴の語ではキーワードを持たない", () => {
    expect(cardHasKeyword(defs, "GRANT", "register")).toBe(false);
    expect(hasResist(defs, "GRANT")).toBe(false);
    expect(cardHasKeyword(defs, "FEATURE-WING", "wing")).toBe(false);
  });

  it("R-KW-00: 「※キーワード」表記があれば持つ", () => {
    expect(cardHasKeyword(defs, "REAL", "wing")).toBe(true);
    expect(cardHasBattleKeyword(defs, "REAL", "breaker")).toBe(true);
    expect(cardHasKeyword(defs, "REAL", "register")).toBe(true);
    expect(hasResist(defs, "REAL")).toBe(true);
    expect(cardHasKeyword(defs, "REAL", "chase")).toBe(true);
    expect(cardHasBattleKeyword(defs, "REAL", "scrum")).toBe(true);
    expect(cardHasBattleKeyword(defs, "REAL-BLAST", "blast")).toBe(true);
    expect(cardHasBattleKeyword(defs, "REAL-TAXIS", "taxis")).toBe(true);
    expect(cardHasKeyword(defs, "REAL-TAXIS", "morph")).toBe(true);
  });

  it("R-KW-00: 実カード — RS-040【モスブレイカー】・RK-067「ダークウイング」は持たず、XG4-060 はウイングだけ持つ", () => {
    const d = buildDefinitionMap([fullPlayableCatalog.cards]);
    expect(cardHasBattleKeyword(d, "RS-040", "breaker")).toBe(false);
    expect(cardHasKeyword(d, "RK-067", "wing")).toBe(false);
    expect(cardHasKeyword(d, "RK-096", "register")).toBe(false);
    expect(cardHasKeyword(d, "XG4-060", "wing")).toBe(true);
    expect(cardHasBattleKeyword(d, "XG4-060", "breaker")).toBe(false);
  });
});
