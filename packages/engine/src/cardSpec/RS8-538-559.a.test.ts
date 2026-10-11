/**
 * カード別スペック: RS-538〜RS-544（第8弾「究極の八神」ユイ・イブキ〜J5）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-538〜RS-544 は該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-538 の Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01〜05、R-KW-SCRUM-01、R-CN-02 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackTargets,
  attackedInEnemyTurn,
  attackUntilRegister,
  canEnter,
  deckCards,
  effectiveBp,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  heldUnit,
  inst,
  legal,
  registerOffered,
  resolveAll,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
  unitIn,
} from "./RS8-538-559.helpers";

const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });

// ===========================================================================
describe("RS-538 ユイ・イブキ", () => {
  const TEXT =
    "※レジスト 【頼れる指揮官】これが自軍ラッシュエリアにある間、敵軍ターン中、「ユイ・イブキ」以外のホールド状態の自軍ユニットが撃破されて捨札になったとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない。";
  const ER = "TST-UNIT-0:er";

  it("RS-538: カタログ本文・スペックが出典と一致（出典: atwiki/page-1213）", () => {
    expectCatalogText("RS-538", TEXT);
    expectStats("RS-538", {
      name: "ユイ・イブキ",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      features: ["男"],
    });
  });

  it("RS-538: ※レジスト — 敵軍ターンにバトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-1213「※レジスト」・R-KW-RESIST-01）", () => {
    let s = attackUntilRegister({ battle: [inst("RS-538", "y")] }, "RS-538:y");
    expect(registerOffered(s)).toBe(true);
    s = resolveAll(act(s, { type: "use_register", playerId: "player1" }));
    expect(unitIn(s, "player1", "RS-538:y")?.commandHeld).toBe(true);
  });

  it("RS-538: ※レジスト は任意 — 使わなければ捨札になる（出典: R-KW-RESIST-01「留めてもよい」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RS-538", "y")] }, "RS-538:y"));
    expect(zoneOf(s, "player1", "RS-538:y")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-538 【頼れる指揮官】が未実装（DSL スタブがキーワード登録だけで、敵軍の進入を禁止しない）
  it.fails("RS-538: 【頼れる指揮官】敵軍ターン中、ホールド状態の自軍ユニットが撃破されて捨札になると、敵軍ラッシュエリアのユニットはそのターン出られない（出典: atwiki/page-1213）", () => {
    const s = attackedInEnemyTurn(
      { battle: [heldUnit("TST-UNIT-0", "h")], rush: [inst("RS-538", "y")] },
      "TST-UNIT-0:h",
      { rush: [inst("TST-UNIT-0", "er")] },
    );
    expect(zoneOf(s, "player1", "TST-UNIT-0:h")).toBe("discard");
    expect(canEnter(s, ER, "player2")).toBe(false);
  });

  it("RS-538: 【頼れる指揮官】撃破されたのがリリース状態のユニットなら発動しない（出典: atwiki/page-1213「ホールド状態の自軍ユニット」）", () => {
    const s = attackedInEnemyTurn(
      { battle: [inst("TST-UNIT-0", "r")], rush: [inst("RS-538", "y")] },
      "TST-UNIT-0:r",
      { rush: [inst("TST-UNIT-0", "er")] },
    );
    expect(zoneOf(s, "player1", "TST-UNIT-0:r")).toBe("discard");
    expect(canEnter(s, ER, "player2")).toBe(true);
  });

  it("RS-538: 【頼れる指揮官】ユイ・イブキが自軍バトルエリアにあるときは発動しない（出典: atwiki/page-1213「これが自軍ラッシュエリアにある間」）", () => {
    const s = attackedInEnemyTurn(
      { battle: [heldUnit("TST-UNIT-0", "h"), inst("RS-538", "y")] },
      "TST-UNIT-0:h",
      { rush: [inst("TST-UNIT-0", "er")] },
    );
    expect(canEnter(s, ER, "player2")).toBe(true);
  });

  it("RS-538: 【頼れる指揮官】撃破されたのが別の「ユイ・イブキ」なら発動しない（出典: atwiki/page-1213「「ユイ・イブキ」以外の」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn(
        { battle: [heldUnit("RS-538", "hy")], rush: [inst("RS-538", "y")] },
        "RS-538:hy",
        { rush: [inst("TST-UNIT-0", "er")] },
      ),
    );
    expect(zoneOf(s, "player1", "RS-538:hy")).toBe("discard");
    expect(canEnter(s, ER, "player2")).toBe(true);
  });

  it("RS-538: 【頼れる指揮官】撃破されなければ（ホールド状態のユニットがバトルに勝つ）発動しない（出典: atwiki/page-1213「撃破されて捨札になったとき」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn(
        { battle: [heldUnit("TST-UNIT-7", "h")], rush: [inst("RS-538", "y")] },
        "TST-UNIT-7:h",
        { rush: [inst("TST-UNIT-0", "er")] },
        "SPEC-NOSP:atk",
        [NOSP],
      ),
    );
    expect(zoneOf(s, "player1", "TST-UNIT-7:h")).toBe("battle");
    expect(canEnter(s, ER, "player2")).toBe(true);
  });

  // 既知の不具合: CARD-RS-538 【頼れる指揮官】が未実装
  it.fails("RS-538: 【頼れる指揮官】効果は「その敵軍ターン中」だけで、次の敵軍ターンには敵軍ユニットはバトルエリアに出られる（出典: atwiki/page-1213「その敵軍ターン中」）", () => {
    let s = attackedInEnemyTurn(
      { battle: [heldUnit("TST-UNIT-0", "h")], rush: [inst("RS-538", "y")], deck: deckCards(8) },
      "TST-UNIT-0:h",
      { rush: [inst("TST-UNIT-0", "er")], deck: deckCards(8, "e") },
    );
    expect(canEnter(s, ER, "player2")).toBe(false);
    s = toPhase(s, "player1", "battle");
    s = toPhase(s, "player2", "battle");
    expect(canEnter(s, ER, "player2")).toBe(true);
  });

  // 既知の不具合: CARD-RS-538 【頼れる指揮官】が未実装
  it.fails("RS-538: 公式Q&A — 発動したターン中なら、発動より後に新しく敵軍ラッシュエリアに出たユニットにも効果が及ぶ（出典: grnrngr/faq-card-8 RS-538 Q1「はい、効果が及びます」）", () => {
    // 発動後に敵軍ラッシュエリアへ新しく置かれたユニット（ラッシュされたユニットと同じ扱い）を状態に加えて確認する。
    const s0 = attackedInEnemyTurn(
      { battle: [heldUnit("TST-UNIT-0", "h")], rush: [inst("RS-538", "y")] },
      "TST-UNIT-0:h",
      { rush: [inst("TST-UNIT-0", "er")] },
    );
    const late = inst("TST-UNIT-0", "late");
    const s = {
      ...s0,
      players: { ...s0.players, player2: { ...s0.players.player2, rush: [...s0.players.player2.rush, late] } },
    };
    expect(canEnter(s, late.instanceId, "player2")).toBe(false);
  });
});

// ===========================================================================
describe("RS-539 ギョダーイ", () => {
  const TEXT =
    "※これは自軍ターン中、バトルエリアに出られない。 【再生巨大化能力】これが自軍エリアにある間、本来の特徴に「怪人」を持つ自軍ユニットは、自軍捨札に同じカード名のユニットカードがあれば、「Lユニット」になる。";
  // 怪人の S ユニット（同名カードを捨札に置いて L になるか確かめる）。L ユニットの有無は RS-558 ガンマジンの BP（L があれば +4000）で観測する。
  const KAIJIN = sUnit("SPEC-KAIJIN", { name: "テスト怪人", bp: 1000, features: ["怪人"] });
  const BEAST = sUnit("SPEC-BEAST", { name: "テスト獣", bp: 1000, features: ["獣"] });

  it("RS-539: カタログ本文・スペックが出典と一致（出典: atwiki/page-1164）", () => {
    expectCatalogText("RS-539", TEXT);
    expectStats("RS-539", {
      name: "ギョダーイ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      features: ["獣"],
    });
  });

  it("RS-539: ※ 自軍ターン中はバトルエリアに出られない（対照の S ユニットは出られる）（出典: atwiki/page-1164「これは自軍ターン中、バトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-539", "g"), inst("TST-UNIT-0", "c")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-539:g")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:c")).toBe(true);
  });

  // 既知の不具合: CARD-RS-539 【再生巨大化能力】が未実装（ユニットのサイズが変わらない）
  it.fails("RS-539: 【再生巨大化能力】本来の特徴に「怪人」を持つ自軍ユニットは、自軍捨札に同名ユニットカードがあれば L ユニットになる（ガンマジンが BP+4000）（出典: atwiki/page-1164）", () => {
    const s = st(
      { player1: { battle: [inst("SPEC-KAIJIN", "k"), inst("RS-558", "gm")], rush: [inst("RS-539", "g")], discard: [inst("SPEC-KAIJIN", "d")] } },
      [KAIJIN],
    );
    expect(effectiveBp(s, "player1", unitIn(s, "player1", "RS-558:gm")!)).toBe(6000);
  });

  it("RS-539: 【再生巨大化能力】自軍捨札に同名カードがなければ L ユニットにならない（出典: atwiki/page-1164「同じカード名のユニットカードがあれば」）", () => {
    const s = st(
      { player1: { battle: [inst("SPEC-KAIJIN", "k"), inst("RS-558", "gm")], rush: [inst("RS-539", "g")], discard: [inst("TST-UNIT-0", "d")] } },
      [KAIJIN],
    );
    expect(effectiveBp(s, "player1", unitIn(s, "player1", "RS-558:gm")!)).toBe(2000);
  });

  it("RS-539: 【再生巨大化能力】特徴「怪人」を持たないユニットは、同名カードが捨札にあっても L ユニットにならない（出典: atwiki/page-1164「本来の特徴に「怪人」を持つ」）", () => {
    const s = st(
      { player1: { battle: [inst("SPEC-BEAST", "k"), inst("RS-558", "gm")], rush: [inst("RS-539", "g")], discard: [inst("SPEC-BEAST", "d")] } },
      [BEAST],
    );
    expect(effectiveBp(s, "player1", unitIn(s, "player1", "RS-558:gm")!)).toBe(2000);
  });

  it("RS-539: 【再生巨大化能力】ギョダーイが自軍エリアになければ（捨札）L ユニットにならない（出典: atwiki/page-1164「これが自軍エリアにある間」）", () => {
    const s = st(
      { player1: { battle: [inst("SPEC-KAIJIN", "k"), inst("RS-558", "gm")], discard: [inst("SPEC-KAIJIN", "d"), inst("RS-539", "g")] } },
      [KAIJIN],
    );
    expect(effectiveBp(s, "player1", unitIn(s, "player1", "RS-558:gm")!)).toBe(2000);
  });

  it("RS-539: 【再生巨大化能力】敵軍の怪人ユニットは（敵軍捨札に同名があっても）L ユニットにならない（出典: atwiki/page-1164「自軍ユニットは、自軍捨札に」）", () => {
    const s = st(
      {
        player1: { battle: [inst("RS-558", "gm")], rush: [inst("RS-539", "g")] },
        player2: { battle: [inst("SPEC-KAIJIN", "k")], discard: [inst("SPEC-KAIJIN", "d")] },
      },
      [KAIJIN],
    );
    expect(effectiveBp(s, "player1", unitIn(s, "player1", "RS-558:gm")!)).toBe(2000);
  });
});

// ===========================================================================
// J1〜J4（スクラム）
const J_TEXT = "※スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない）";
const JS = [
  { id: "RS-540", name: "J1", cn: 1, page: "atwiki/page-1165" },
  { id: "RS-541", name: "J2", cn: 2, page: "atwiki/page-1166" },
  { id: "RS-542", name: "J3", cn: 3, page: "atwiki/page-1167" },
  { id: "RS-543", name: "J4", cn: 4, page: "atwiki/page-1168" },
];
const NEXT_OF: Record<number, string> = { 2: "RS-541", 3: "RS-542", 4: "RS-543", 5: "RS-544" };
const CN_SPEC = (cn: number) => sUnit(`SPEC-CN${cn}`, { comboNumber: cn, bp: 1000 });

for (const j of JS) {
  describe(`${j.id} ${j.name}`, () => {
    it(`${j.id}: カタログ本文・スペックが出典と一致（atwiki 名「${j.name}（…）」の読みはカード名に含めない）（出典: ${j.page}）`, () => {
      expectCatalogText(j.id, J_TEXT);
      expectStats(j.id, {
        name: j.name,
        category: "ET",
        size: "S",
        bp: 2000,
        sp: undefined,
        powerCost: 0,
        comboNumber: j.cn,
        features: ["男"],
      });
    });

    it(`${j.id}: ※スクラム — CN${j.cn + 1} のユニットが次（右隣）に並んでいる間はアタックされない（出典: ${j.page}・R-KW-SCRUM-01）`, () => {
      const s = st({
        player1: { battle: [inst("TST-UNIT-7", "atk")] },
        player2: { battle: [inst(j.id, "j"), inst(NEXT_OF[j.cn + 1]!, "n")] },
      });
      expect(attackTargets(s, "TST-UNIT-7:atk")).not.toContain(`${j.id}:j`);
    });

    it(`${j.id}: ※スクラム — 次に並ぶユニットの CN が ${j.cn + 1} でなければアタックされる（出典: ${j.page}「これのＣＮより1多いCN」）`, () => {
      const s = st(
        { player1: { battle: [inst("TST-UNIT-7", "atk")] }, player2: { battle: [inst(j.id, "j"), inst(`SPEC-CN${j.cn + 2}`, "n")] } },
        [CN_SPEC(j.cn + 2)],
      );
      expect(attackTargets(s, "TST-UNIT-7:atk")).toContain(`${j.id}:j`);
    });

    it(`${j.id}: ※スクラム — CN${j.cn + 1} のユニットが前（左隣）にあるだけではアタックされる（出典: ${j.page}「これの次に並んでいる間」）`, () => {
      const s = st({
        player1: { battle: [inst("TST-UNIT-7", "atk")] },
        player2: { battle: [inst(NEXT_OF[j.cn + 1]!, "n"), inst(j.id, "j")] },
      });
      expect(attackTargets(s, "TST-UNIT-7:atk")).toContain(`${j.id}:j`);
    });

    it(`${j.id}: ※スクラム — 自分自身が右端（次に並ぶユニットなし）ならアタックされる（出典: ${j.page}）`, () => {
      const s = st({ player1: { battle: [inst("TST-UNIT-7", "atk")] }, player2: { battle: [inst(j.id, "j")] } });
      expect(attackTargets(s, "TST-UNIT-7:atk")).toContain(`${j.id}:j`);
    });
  });
}

// ===========================================================================
describe("RS-544 J5", () => {
  const TEXT = "※これは特徴を3つ以上持つユニットにアタックされない。 【フレアーバスター】「SP1」";
  const F3 = sUnit("SPEC-F3", { bp: 13000, features: ["レッド", "男", "2nd"] });
  const F2 = sUnit("SPEC-F2", { bp: 13000, features: ["レッド", "男"] });

  it("RS-544: カタログ本文・スペックが出典と一致（出典: atwiki/page-1169）", () => {
    expectCatalogText("RS-544", TEXT);
    expectStats("RS-544", {
      name: "J5",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 1,
      comboNumber: 5,
      features: ["女"],
    });
  });

  it("RS-544: ※ 特徴を3つ持つユニットにはアタックされない（出典: atwiki/page-1169「特徴を3つ以上持つユニットにアタックされない」）", () => {
    const s = st({ player1: { battle: [inst("SPEC-F3", "atk")] }, player2: { battle: [inst("RS-544", "j")] } }, [F3]);
    expect(attackTargets(s, "SPEC-F3:atk")).not.toContain("RS-544:j");
  });

  it("RS-544: ※ 特徴が2つのユニットにはアタックされる（境界）（出典: atwiki/page-1169「3つ以上」）", () => {
    const s = st({ player1: { battle: [inst("SPEC-F2", "atk")] }, player2: { battle: [inst("RS-544", "j")] } }, [F2]);
    expect(attackTargets(s, "SPEC-F2:atk")).toContain("RS-544:j");
  });

  it("RS-544: 【フレアーバスター】5番目に出て NC が成立すると SP1（出典: atwiki/page-1169「【フレアーバスター】「SP1」」・R-CN-02）", () => {
    const s = enterSeq(st({ player1: { battle: fill(4), rush: [inst("RS-544", "j")], deck: deckCards(3) } }), ["RS-544:j"]);
    expect(spOf(s, "player1", "RS-544:j")).toBe(1);
  });

  it("RS-544: 【フレアーバスター】NC が成立しなければ（1番目）SP は「！」のままでダメージを与えない（出典: R-CN-02）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("RS-544", "j")], deck: deckCards(3) } }), ["RS-544:j"]);
    expect(spOf(s, "player1", "RS-544:j")).toBe(0);
  });

  it("RS-544: J1〜J5 を並べると、J1〜J4 はスクラムで、J5 は特徴3つのユニットに対してアタックされない（出典: atwiki/page-1165〜1169）", () => {
    const s = st(
      {
        player1: { battle: [inst("SPEC-F3", "atk")] },
        player2: { battle: ["RS-540", "RS-541", "RS-542", "RS-543", "RS-544"].map((id) => inst(id, "j")) },
      },
      [F3],
    );
    expect(attackTargets(s, "SPEC-F3:atk")).toEqual([]);
    expect(legal(s).some((a) => a.type === "battle")).toBe(false);
  });
});
