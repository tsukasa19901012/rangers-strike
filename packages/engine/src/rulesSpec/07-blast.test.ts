/**
 * docs/rules/07-keywords.md「ブラスト」節（R-KW-BLAST-01〜03）のルール仕様テスト。
 * 出典: grnrngr/faq-card-9「ブラスト」Q1、atwiki/page-1701、atwiki/page-1801（XG2-034 ブラストバギー）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance } from "../types/game";
import { canRush, inst, KW, powerCards, realDef, state, unitDef } from "./07-helpers";

/** 追加条件「自軍Sユニット1体をパワーゾーンに送る」を持つブラスト持ち M ユニット（必要パワー5）。 */
const BLAST = unitDef("RSPEC-BLAST", {
  name: "ブラストロボ",
  size: "M",
  bp: 12000,
  powerCost: "5+",
  rushAdditionalCondition: {
    conditionId: "send_s_unit_to_power",
    text: "自軍Sユニット1体をパワーゾーンに送る",
    unitCount: 1,
  } as CardDefinition["rushAdditionalCondition"],
  text: KW.blast,
});
const b = inst(BLAST.id, "b");
const L_UNIT = unitDef("RSPEC-L", { size: "L", bp: 10000 });

function rushPhase(opts: { damage: number; power?: number; rush?: CardInstance[]; enemyRush?: CardInstance[]; extra?: CardDefinition[] }) {
  return state([BLAST, L_UNIT, ...(opts.extra ?? [])], {
    phase: "rush",
    player1: {
      hand: [b],
      rush: opts.rush ?? [],
      command: [inst("TST-OP", "c")],
      power: powerCards(opts.power ?? 9),
      damage: opts.damage,
    },
    player2: { rush: opts.enemyRush ?? [] },
  });
}

describe("R-KW-BLAST-01 規定文", () => {
  // 「あと１点のダメージで負けるようなピンチのときに、追加条件を無視できる」
  it("R-KW-BLAST-01: ダメージ6点（残り1点）で自軍 L ユニットがなければ、追加条件を満たさずにラッシュできる（出典: grnrngr/faq-card-9 ブラスト Q1）", () => {
    const s = rushPhase({ damage: 6 });
    expect(canRush(s, b.instanceId)).toBe(true);
  });

  // 「自分がゲームに負けるまで残りダメージ１点で」
  it("R-KW-BLAST-01: ダメージ5点（残り2点）では追加条件を無視できず、素材がなければラッシュできない（出典: grnrngr/faq-card-9 ブラスト Q1 規定文）", () => {
    const s = rushPhase({ damage: 5 });
    expect(canRush(s, b.instanceId)).toBe(false);
    // 対照: 素材の S ユニットがいれば同じ状況でラッシュできる
    expect(canRush(rushPhase({ damage: 5, rush: [inst("TST-UNIT-0", "s")] }), b.instanceId)).toBe(true);
  });

  // 「自軍Ｌユニットが１体もなければ」
  it("R-KW-BLAST-01: ダメージ6点でも自軍 L ユニットがいれば追加条件を無視できない（出典: grnrngr/faq-card-9 ブラスト Q1 規定文）", () => {
    const s = rushPhase({ damage: 6, rush: [inst(L_UNIT.id, "l")] });
    expect(canRush(s, b.instanceId)).toBe(false);
  });

  // 「もちろん必要パワーは満たさなければならない」
  it("R-KW-BLAST-01: ブラストでも必要パワーは満たす必要がある（出典: atwiki/page-1701 本文）", () => {
    const s = rushPhase({ damage: 6, power: 4 });
    expect(canRush(s, b.instanceId)).toBe(false);
  });

  // 「本来のカード名がこれと同名の自軍ユニット…ラッシュすることができない」
  it("R-KW-BLAST-01: ブラストが免除するのは追加条件だけで、ブレイカーの同名ラッシュ禁止は免除しない（出典: docs/rules/07 R-KW-BLAST-01 実装注記、atwiki/page-2355）", () => {
    const BB = unitDef("RSPEC-BLAST-BREAKER", { ...BLAST, id: "RSPEC-BLAST-BREAKER", text: `${KW.blast} ${KW.breaker}` });
    const s = state([BB], {
      phase: "rush",
      player1: {
        hand: [inst(BB.id, "h")],
        rush: [inst(BB.id, "field")],
        command: [inst("TST-OP", "c")],
        power: powerCards(9),
        damage: 6,
      },
    });
    expect(canRush(s, `${BB.id}:h`)).toBe(false);
  });
});

describe("R-KW-BLAST-02 条件の変更", () => {
  const BUGGY = realDef("XG2-034");

  // 「ブラストの効果は次のルールに変更される⇒…残りダメージ1点または2点で」
  it("R-KW-BLAST-02: 自軍エリアに XG2-034 ブラストバギーがあれば、ダメージ5点（残り2点）でも追加条件を無視できる（出典: atwiki/page-1801 XG2-034 本文）", () => {
    const s = rushPhase({ damage: 5, rush: [inst(BUGGY.id, "bg")], extra: [BUGGY] });
    expect(canRush(s, b.instanceId)).toBe(true);
  });

  // 「ただし相手にも適用されるので注意が必要」
  it("R-KW-BLAST-02: 変更後のルールは敵軍にも適用される（相手の XG2-034 でも自分がダメージ5点で追加条件を無視できる）（出典: atwiki/page-1801 カード評価）", () => {
    const s = rushPhase({ damage: 5, enemyRush: [inst(BUGGY.id, "bg")], extra: [BUGGY] });
    expect(canRush(s, b.instanceId)).toBe(true);
  });

  // 変更後も「自軍Lユニットが１体もなければ」は残る
  it("R-KW-BLAST-02: XG2-034 があっても自軍 L ユニットがいれば追加条件は無視できない（出典: atwiki/page-1801 XG2-034 本文）", () => {
    const s = rushPhase({ damage: 5, rush: [inst(BUGGY.id, "bg"), inst(L_UNIT.id, "l")], extra: [BUGGY] });
    expect(canRush(s, b.instanceId)).toBe(false);
  });
});

describe("R-KW-BLAST-03 L ユニットの範囲", () => {
  // 「Ｓ、Ｍ、Ｌ、ＸＬ、ＳＣの5種がある」
  it.todo("R-KW-BLAST-03: [未確定] XL ユニットが「自軍 L ユニット」に含まれるか（資料に定義なし。字面上は含まれない）");
  // 「自軍Ｌユニットが１体もなければ」
  it.todo("R-KW-BLAST-03: [未確定] パワーゾーン・コマンドゾーンの L ユニットカードを「自軍 L ユニット」として数えるか（一般定義からはエリアのみ）");
});
