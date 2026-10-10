/**
 * docs/rules/07-keywords.md「スクラム」「タクス」「クロス」節
 * （R-KW-SCRUM-01、R-KW-TAKUS-01、R-KW-CROSS-01〜02）のルール仕様テスト。
 * 出典: atwiki/page-1290（スクラム）、page-1291（タクス）、page-2393（クロス Q1〜Q3・本文）、page-1974。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { battleFillers } from "../testing/battleEntry";
import { battlePositionForInstance, crossReducedNumber } from "../keywords/battleKeywords";
import { act, canAttack, canRush, canStrike, inst, KW, powerCards, realDef, state, unitDef } from "./07-helpers";

const ATK = unitDef("RSPEC-ATK", { bp: 9000 });
const a = inst(ATK.id, "a");

/** player1 のバトルフェイズに、player1 バトルエリア `battle` の右へ `entering` を出した直後の状態。 */
function enter(defs: CardDefinition[], battle: CardInstance[], entering: CardInstance): GameState {
  const s = state([...defs, ATK], {
    phase: "battle",
    player1: { rush: [entering], battle },
    player2: { battle: [inst("TST-UNIT-2", "enemy")] },
  });
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: entering.instanceId });
}

describe("R-KW-SCRUM-01 規定文", () => {
  const SCRUM3 = unitDef("RSPEC-SCRUM3", { comboNumber: 3, bp: 2000, text: KW.scrum });
  const CN4 = unitDef("RSPEC-CN4", { comboNumber: 4, bp: 2000 });
  const CN5 = unitDef("RSPEC-CN5", { comboNumber: 5, bp: 2000 });
  const sc = inst(SCRUM3.id, "sc");

  function attackPhase(defBattle: CardInstance[]): GameState {
    const s = state([SCRUM3, CN4, CN5, ATK], {
      phase: "battle",
      player1: { rush: [a] },
      player2: { battle: defBattle },
    });
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: a.instanceId });
  }

  // 「CNより1多いCNを持つユニットが…次に並んでいる間」
  it("R-KW-SCRUM-01: CN が1多いユニットが次（右隣）に並んでいる間、スクラム持ちはアタックされない（出典: atwiki/page-1290 規定文）", () => {
    const n = inst(CN4.id, "n");
    const s = attackPhase([sc, n]);
    expect(canAttack(s, a.instanceId, sc.instanceId)).toBe(false);
    expect(canAttack(s, a.instanceId, n.instanceId)).toBe(true);
  });

  // 「これのCNより1多いCN」でなければ効かない
  it("R-KW-SCRUM-01: 次に並ぶユニットの CN が1多くなければ、スクラム持ちもアタックされる（出典: atwiki/page-1290 規定文）", () => {
    const s = attackPhase([sc, inst(CN5.id, "n")]);
    expect(canAttack(s, a.instanceId, sc.instanceId)).toBe(true);
  });

  // 「これの次に並んでいる間」（左隣では効かない）
  it("R-KW-SCRUM-01: CN が1多いユニットが前（左隣）にいるだけではアタックを防げない（出典: atwiki/page-1290 規定文）", () => {
    const s = attackPhase([inst(CN4.id, "n"), sc]);
    expect(canAttack(s, a.instanceId, sc.instanceId)).toBe(true);
  });

  // 「アタック以外には無力なので能力やオペレーションなどでの撃破には当然効果が無い」
  it("R-KW-SCRUM-01: スクラムはアタック以外を防がず、ユニットの効果（RS-050 アバレンオー）では選ばれて撃破される（出典: atwiki/page-1290 本文）", () => {
    let s = state([SCRUM3, CN4, realDef("RS-050")], {
      phase: "battle",
      player1: { rush: [inst("RS-050", "z")] },
      player2: { battle: [sc, inst(CN4.id, "n")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-050:z" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(sc.instanceId);
  });

  // 「CN の数字を減らす」（クロス A3）との関係
  it.todo("R-KW-SCRUM-01: [未確定] 比較する CN はクロスで減った後の数字か（スクラムを名指ししたクロスの裁定なし。04-#9）");
});

describe("R-KW-TAKUS-01 規定文", () => {
  /** RS-441 バトルコサック: ※タクスET（4番目）、ET・S・CN1。 */
  const COSSACK = realDef("RS-441");
  /** XG3-040 シンケンレッド: ※タクスOT（3番目）。 */
  const TAKUS_OT = realDef("XG3-040");
  const ET_S = unitDef("RSPEC-ET-S", { category: "ET", size: "S", sp: null, bp: 2000 });
  const ET_M = unitDef("RSPEC-ET-M", { category: "ET", size: "M", sp: null, bp: 5000 });
  const WB_S = unitDef("RSPEC-WB-S", { category: "WB", size: "S", sp: null, bp: 2000 });
  const OT_S = unitDef("RSPEC-OT-S", { category: "OT", size: "S", sp: null, bp: 2000 });

  // 「○番目にある間…次に並ぶ○○を持つSユニットは「SP1」」
  it("R-KW-TAKUS-01: タクスET が4番目にある間、次（5番目）に並ぶ ET の S ユニットは SP1 を得てストライクできる（出典: atwiki/page-1291 規定文）", () => {
    const x = inst(ET_S.id, "x");
    const s = enter([COSSACK, ET_S], [...battleFillers(3), inst(COSSACK.id, "t")], x);
    expect(canStrike(s, x.instanceId)).toBe(true);
  });

  // 「○番目にある間」（番号は ET=4）
  it("R-KW-TAKUS-01: タクスET が4番目以外（3番目）にあるときは、次に並ぶ ET の S ユニットは SP1 を得ない（出典: atwiki/page-1291 規定文・本文）", () => {
    const x = inst(ET_S.id, "x");
    const s = enter([COSSACK, ET_S], [...battleFillers(2), inst(COSSACK.id, "t")], x);
    expect(canStrike(s, x.instanceId)).toBe(false);
  });

  // 「○○を持つSユニット」（カテゴリ違い）
  it("R-KW-TAKUS-01: 指定カテゴリを持たないユニットは SP1 を得ない（出典: atwiki/page-1291 規定文）", () => {
    const x = inst(WB_S.id, "x");
    const s = enter([COSSACK, WB_S], [...battleFillers(3), inst(COSSACK.id, "t")], x);
    expect(canStrike(s, x.instanceId)).toBe(false);
  });

  // 「○○を持つSユニット」（S ユニット限定）
  it.fails("R-KW-TAKUS-01: 指定カテゴリでも S ユニットでなければ（M ユニット）SP1 を得ない（出典: atwiki/page-1291 規定文）", () => {
    // 既知の不具合: 04-#7（S ユニット限定なし）
    const x = inst(ET_M.id, "x");
    const s = enter([COSSACK, ET_M], [...battleFillers(3), inst(COSSACK.id, "t")], x);
    expect(canStrike(s, x.instanceId)).toBe(false);
  });

  // 「クロスによってずれることもない」
  it("R-KW-TAKUS-01: タクスは並び順で判定し、左にクロスがあっても番号はずれない（タクスOT が3番目なら4番目の OT S ユニットが SP1）（出典: atwiki/page-1291 本文、page-2393 A3）", () => {
    const x = inst(OT_S.id, "x");
    const s = enter([TAKUS_OT, OT_S, realDef("SX-010")], [inst("SX-010", "cross"), inst("TST-UNIT-0", "f"), inst(TAKUS_OT.id, "t")], x);
    expect(canStrike(s, x.instanceId)).toBe(true);
  });

  // 「敵軍ターン中でもポイントを持ったまま」
  it.todo("R-KW-TAKUS-01: 並び順が正しければ敵軍ターン中も SP を持ったまま（出典: atwiki/page-104。敵軍ターン中の SP を観測する公開 API がない）");
  // 「WBなら1、MAなら2、OTなら3、ETなら4」
  it.todo("R-KW-TAKUS-01: [未確定] タクスDA の番号（資料に記載なし。実装の DA=5 は独自、04-#8）");
  // 「SPを1にする」
  it.todo("R-KW-TAKUS-01: [未確定] 「SP1 を得る」が SP2 以上のユニットの SP を下げるか");
});

describe("R-KW-CROSS-01 規定文", () => {
  const CROSS = realDef("SX-010"); // ※クロス1、S、CN2
  const FIVE_RED = realDef("RS-272"); // CN5、【Vソード】「SP1」（NC）
  const CHANGE_DRAGON = realDef("XG1-007"); // CN3、【チェンジソード】「SP1」（NC）
  const FRACTION = unitDef("RSPEC-FRAC3", { category: "WB", sp: "1/3", comboNumber: null, bp: 2000 });

  // 「2つ分減るのでCN3になります」
  it("R-KW-CROSS-01: 1・2番目にクロス1が並ぶと、3番目に出た CN5 のユニット（RS-272）は CN3 として NC が成立する（出典: page-1974「2つ分減るのでCN3になります」、atwiki/page-2393 規定文）", () => {
    const x = inst(FIVE_RED.id, "x");
    const s = enter([CROSS, FIVE_RED], [inst(CROSS.id, "c1"), inst(CROSS.id, "c2")], x);
    expect(s.log.some((l) => l.includes("number_combo") && l.includes(FIVE_RED.id))).toBe(true);
    expect(canStrike(s, x.instanceId)).toBe(true);
  });

  // 対照: クロスがなければ CN5 のユニットは3番目で NC にならない
  it("R-KW-CROSS-01: クロスでないユニットが左に並んでいるだけなら、3番目に出た CN5 のユニットは NC にならない（出典: atwiki/page-2393 規定文）", () => {
    const x = inst(FIVE_RED.id, "x");
    const s = enter([FIVE_RED], battleFillers(2), x);
    expect(s.log.some((l) => l.includes("number_combo") && l.includes(FIVE_RED.id))).toBe(false);
  });

  // 「これより右にあるユニットの、ナンバーの数字…はX少なくなる」
  it("R-KW-CROSS-01: 1番目のクロス1の右、2番目に出た CN3 のユニット（XG1-007）は CN2 として NC が成立する（出典: atwiki/page-2393 規定文）", () => {
    const x = inst(CHANGE_DRAGON.id, "x");
    const s = enter([CROSS, CHANGE_DRAGON], [inst(CROSS.id, "c1")], x);
    expect(canStrike(s, x.instanceId)).toBe(true);
  });

  // 「SPの分母の数字はX少なくなる」
  it("R-KW-CROSS-01: クロス1の右では分数 SP の分母も1少なくなり、SP1/3 のユニットが2番目で SP1 になる（出典: atwiki/page-2393 規定文）", () => {
    const x = inst(FRACTION.id, "x");
    const withCross = enter([CROSS, FRACTION], [inst(CROSS.id, "c1")], x);
    expect(canStrike(withCross, x.instanceId)).toBe(true);
    const withoutCross = enter([FRACTION], battleFillers(1), x);
    expect(canStrike(withoutCross, x.instanceId)).toBe(false);
  });

  // 「ただし2より少なくならない」
  it("R-KW-CROSS-01: クロスで減った数字は2より少なくならず、もともと2未満の数字は変わらない（出典: atwiki/page-2393 規定文）", () => {
    // クロス2 以上を持つ実カードがないため、減算規則そのものを確かめる
    expect(crossReducedNumber(3, 2)).toBe(2);
    expect(crossReducedNumber(5, 2)).toBe(3);
    expect(crossReducedNumber(2, 1)).toBe(2);
    expect(crossReducedNumber(1, 1)).toBe(1);
  });

  // 「これが自軍バトルエリアにある間」
  it("R-KW-CROSS-01: クロス持ちが自軍バトルエリアになければ（ラッシュエリアにいるだけでは）数字は減らない（出典: atwiki/page-2393 規定文）", () => {
    const x = inst(CHANGE_DRAGON.id, "x");
    const s0 = state([CROSS, CHANGE_DRAGON, ATK], {
      phase: "battle",
      player1: { rush: [x, inst(CROSS.id, "c-rush")], battle: battleFillers(1) },
      player2: { battle: [inst("TST-UNIT-2", "enemy")] },
    });
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: x.instanceId });
    expect(canStrike(s, x.instanceId)).toBe(false);
  });
});

describe("R-KW-CROSS-02 補足", () => {
  const CROSS = realDef("SX-010");
  const DYNA = realDef("RS-197"); // 追加条件「自軍Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする」

  // 「クロスを持っていても、あくまでユニットの数は１体分です」
  it("R-KW-CROSS-02: クロス1を持つ S ユニット1体では、S ユニット2体を要する RS-197 ダイナギャリーの追加条件を満たせない（出典: atwiki/page-2393 Q1）", () => {
    const s = state([CROSS, DYNA], {
      phase: "rush",
      player1: { hand: [inst(DYNA.id, "d")], rush: [inst(CROSS.id, "c")], command: [inst("TST-OP-ET", "cmd")], power: powerCards(6) },
    });
    expect(canRush(s, `${DYNA.id}:d`)).toBe(false);
  });

  // 対照（同 Q1 の前提）: S ユニットが2体いれば追加条件を満たせる
  it("R-KW-CROSS-02: クロス持ちを含めて S ユニットが2体いれば、RS-197 ダイナギャリーの追加条件を満たしてラッシュできる（出典: atwiki/page-2393 Q1 の対照）", () => {
    const s2 = state([CROSS, DYNA], {
      phase: "rush",
      player1: {
        hand: [inst(DYNA.id, "d")],
        rush: [inst(CROSS.id, "c"), inst("TST-UNIT-0", "s")],
        command: [inst("TST-OP-ET", "cmd")],
        power: powerCards(6),
      },
    });
    expect(canRush(s2, `${DYNA.id}:d`)).toBe(true);
  });

  // 「３番目になります」
  it("R-KW-CROSS-02: クロス1の S ユニット2体の右に出たユニット（XG7-011 ハリケンレッド）の並び順は3番目（出典: atwiki/page-2393 Q2）", () => {
    const red = inst("XG7-011", "red");
    const s = enter([CROSS, realDef("XG7-011")], [inst(CROSS.id, "c1"), inst(CROSS.id, "c2")], red);
    expect(battlePositionForInstance(s, "player1", red.instanceId)).toBe(3);
  });

  // 「バトルエリアの並び順を参照するタクスには影響を与えません」
  it("R-KW-CROSS-02: 1番目にクロス1、2番目にタクスOT のとき、3番目に出た OT の S ユニットは SP1 にならない（出典: atwiki/page-2393 Q3）", () => {
    const OT_S = unitDef("RSPEC-OT-S", { category: "OT", size: "S", sp: null, bp: 2000 });
    const TAKUS_OT = realDef("XG3-040");
    const x = inst(OT_S.id, "x");
    const s = enter([CROSS, TAKUS_OT, OT_S], [inst(CROSS.id, "c1"), inst(TAKUS_OT.id, "t")], x);
    expect(canStrike(s, x.instanceId)).toBe(false);
  });

  // 「クロス1を複数持っていてもクロス2の扱いにはならない」
  it.todo("R-KW-CROSS-02: クロス1を複数持つユニットは合計分ずらすが「クロス2」としては扱わない（出典: atwiki/page-2393 本文。1体にクロスを追加する新サイクロン号等の起動経路がない）");
});
