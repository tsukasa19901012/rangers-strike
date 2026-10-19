/**
 * カード別スペック: XG1-028〜XG1-034（クロスギャザー ザ・ファーストエンカウント アバレンオージ〜害気大臣キタネイダス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。
 *     atwiki へ転載された公式 Q&A: page-1665 Q1（XG1-028）・page-1581 Q1（XG1-033）・page-1582 Q1〜Q6（XG1-034）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01、05-battle-strike-damage「1/2」等の SP）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの（同じ形では繰り返さない）:
 *  - XG1-028 Q1（白熱する実況で留まったとき）: RS7-432-452.a.test.ts
 *  - XG1-029【無敵の竜人魂】: errataCardEffects.test.ts・e7SourceTextCards.test.ts（ここでは候補の範囲を中心に見る）
 *  - XG1-030【キラークロー】: e7SourceTextCards.test.ts、ゾードダウン素材: RS9-605-626.a.test.ts
 *  - XG1-033 マルチカテゴリ: rules/gapFixes.test.ts
 *  - XG1-034 Q3〜Q6（RS-265・RS-235・RS-301）: RS5-264-284.a・RS4-222-242.b・RS5-285-305.c（ここでは「自分も相手も」と時期の範囲を見る）
 */
import { describe, expect, it } from "vitest";
import {
  NOSP_ATTACKER,
  act,
  attack,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canActivate,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  enemyBoard,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  heldUnit,
  inst,
  lastBattleBps,
  ncAt,
  p1Battle,
  pick,
  powerCards,
  raw,
  registerOffered,
  released,
  releasedCat,
  reanimateTests,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  wingTests,
  zoneOf,
  zordDownTests,
  activate,
} from "./XG1-021-040.helpers";

const L8 = sUnit("SPEC-L8", { category: "ET", bp: 8000, size: "L" });
const L9 = sUnit("SPEC-L9", { category: "ET", bp: 9000, size: "L" });
const LDA = sUnit("SPEC-LDA", { category: "DA", bp: 8000, size: "L" });
const SDA = sUnit("SPEC-SDA", { category: "DA", bp: 3000 });
const EN3 = sUnit("SPEC-EN3", { category: "OT", size: "M", comboNumber: 3, features: ["炎神"] });
const ENX = sUnit("SPEC-ENX", { category: "OT", size: "M", features: ["炎神"] });
const ENM1 = sUnit("SPEC-ENM1", { category: "OT", size: "M", powerCost: 1, features: ["炎神"] });
const WBM1 = sUnit("SPEC-WBM1", { size: "M", powerCost: 1 });
const GS = sUnit("SPEC-GS", { powerCost: 3, features: ["激気"] });
const GK = sUnit("SPEC-GK", { size: "M", bp: 4000, features: ["激気"] });
const C3 = sUnit("SPEC-C3", { powerCost: 3 });
const C4 = sUnit("SPEC-C4", { powerCost: 4 });
const B4 = sUnit("SPEC-B4", { bp: 4000 });
const B45 = sUnit("SPEC-B45", { bp: 4500 });
const N6 = sUnit("SPEC-N6", { bp: 6000, sp: undefined });
const DA0 = sUnit("SPEC-DA0", { category: "DA" });
const EXTRA = [L8, L9, LDA, SDA, EN3, ENX, ENM1, WBM1, GS, GK, C3, C4, B4, B45, N6, DA0, NOSP_ATTACKER];

// ===========================================================================
describe("XG1-028 アバレンオージ", () => {
  const TEXT =
    "合体―爆竜ティラノサウルス＋爆竜トリケラトプス ※レジスト ※これはホールド状態のときストライクできない。 【アバレンオーになりかけだから…】自軍ラッシュフェイズ中、このユニットを捨札にしてもよい。そうしたとき、自分の手札から「アバレンオー」のカードを1枚選び、自軍ラッシュエリアに出してもよい。";

  it("XG1-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-1665）", () => {
    expectCatalogText("XG1-028", TEXT);
    expectUnitStats("XG1-028", { name: "アバレンオージ", category: "WB", size: "L", bp: 8000, sp: 1, powerCost: "5+", features: ["恐竜", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG1-028", ["R"]);
  });

  it("XG1-028: 合体 — 自軍の爆竜ティラノサウルス（RS-051）と爆竜トリケラトプス（RS-052）を素材にパワー5でラッシュできる（出典: atwiki/page-1665「合体―爆竜ティラノサウルス＋爆竜トリケラトプス」・カード評価「素材ユニットは2体」）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-028", "oj")], rush: [inst("RS-051", "ty"), inst("RS-052", "tr")], command: releasedCat("WB", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG1-028:oj");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-028:oj")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-051:ty")).not.toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-052:tr")).not.toBe("rush");
  });

  it("XG1-028: 合体 — 素材の片方（トリケラトプス）がいなければラッシュできない（出典: atwiki/page-1665「合体―爆竜ティラノサウルス＋爆竜トリケラトプス」）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-028", "oj")], rush: [inst("RS-051", "ty")], command: releasedCat("WB", 1), power: powerCards(5) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "XG1-028:oj")).toBe(false);
  });

  it("XG1-028: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1665「※レジスト」・カード評価「一度撃破されてもアタッカーとして場に残る」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-028", "oj")] }, "XG1-028:oj"))).toBe(true);
  });

  it("XG1-028: ※ ホールド状態のときはストライクできない（リリース状態ならストライクできる）（出典: atwiki/page-1665「※これはホールド状態のときストライクできない」）", () => {
    expect(canStrike(p1Battle({ battle: [heldUnit("XG1-028", "oj")] }), "XG1-028:oj")).toBe(false);
    expect(canStrike(p1Battle({ battle: [inst("XG1-028", "oj")] }), "XG1-028:oj")).toBe(true);
  });

  const actBoard = () => rushPhaseBoard({ rush: [inst("XG1-028", "oj")], hand: [inst("RS-050", "ao"), inst("RS-051", "x")] }, {}, EXTRA);

  it("XG1-028: 【アバレンオーになりかけだから…】自軍ラッシュフェイズに起動すると捨札になり、手札の「アバレンオー」だけを選べる（任意）（出典: atwiki/page-1665「このユニットを捨札にしてもよい。そうしたとき、自分の手札から「アバレンオー」のカードを1枚選び…出してもよい」）", () => {
    expect(canActivate(actBoard(), "XG1-028:oj")).toBe(true);
    const s = activate(actBoard(), "XG1-028:oj");
    expect(zoneOf(s, "player1", "XG1-028:oj")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG1-028");
    expect(choiceIds(s)).toEqual(["RS-050:ao"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-028: 選んだアバレンオーは自軍ラッシュエリアに出る（追加条件・コマンドなし）（出典: atwiki/page-1665「自軍ラッシュエリアに出してもよい」・カード評価「爆竜プテラノドン無しでラッシュが狙える」）", () => {
    const s = resolveAll(activate(actBoard(), "XG1-028:oj"), ["RS-050:ao"]);
    expect(zoneOf(s, "player1", "RS-050:ao")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-051:x")).toBe("hand");
  });

  it("XG1-028: 出さないことを選べば、アバレンオーは手札に残る（出典: atwiki/page-1665「出してもよい」）", () => {
    const s = resolveAll(skip(activate(actBoard(), "XG1-028:oj")));
    expect(zoneOf(s, "player1", "RS-050:ao")).toBe("hand");
    expect(zoneOf(s, "player1", "XG1-028:oj")).toBe("discard");
  });

  it("XG1-028: 自軍バトルフェイズには起動できない（出典: atwiki/page-1665「自軍ラッシュフェイズ中」）", () => {
    expect(canActivate(p1Battle({ rush: [inst("XG1-028", "oj")], hand: [inst("RS-050", "ao")] }, {}, EXTRA), "XG1-028:oj")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-029 アバレブラックAM", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「アバレブラック」のカードを1枚選び、自軍ラッシュエリアに出す。 【無敵の竜人魂】敵軍バトルエリアから、本来のBPが8000以下のLユニットを1体選び撃破してもよい。そうしたとき、撃破したユニットがDAを持っていたなら、このターン、これは「SP1」になる。";

  it("XG1-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-1620）", () => {
    expectCatalogText("XG1-029", TEXT);
    expectUnitStats("XG1-029", { name: "アバレブラックAM", category: "WB", size: "S", bp: 5500, sp: "special", powerCost: "7-", comboNumber: 1, features: ["ブラック", "男", "アバレモード"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG1-029", ["SR"]);
  });

  zordDownTests("XG1-029", "RS-233", "アバレブラック", "atwiki/page-1620", "WB");
  reanimateTests("XG1-029", "RS-233", "アバレブラック", "atwiki/page-1620");

  const nc = () =>
    ncAt("XG1-029:ab", 1, {}, { battle: [inst("SPEC-L8", "l8"), inst("SPEC-L9", "l9"), inst("SPEC-LDA", "lda"), inst("SPEC-SDA", "sda")], rush: [inst("SPEC-L8", "rl")] }, EXTRA);

  it("XG1-029: 【無敵の竜人魂】NC — 敵軍バトルエリアの本来の BP8000 以下の L ユニットから1体選べる（BP9000・S・ラッシュエリアは対象外。任意）（出典: atwiki/page-1620「敵軍バトルエリアから、本来のBPが8000以下のLユニットを1体選び撃破してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-029");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-L8:l8", "SPEC-LDA:lda"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-029: 撃破したのが DA の L ユニットなら、このターン「SP1」になる（出典: atwiki/page-1620「撃破したユニットがDAを持っていたなら、このターン、これは「SP1」になる」）", () => {
    const s = resolveAll(nc(), ["SPEC-LDA:lda"]);
    expect(zoneOf(s, "player2", "SPEC-LDA:lda")).toBe("discard");
    expect(spOf(s, "player1", "XG1-029:ab")).toBe(1);
  });

  it("XG1-029: DA を持たない L ユニットを撃破したなら SP を得ない（出典: atwiki/page-1620・カード評価「相手のデッキによって左右される」）", () => {
    const s = resolveAll(nc(), ["SPEC-L8:l8"]);
    expect(zoneOf(s, "player2", "SPEC-L8:l8")).toBe("discard");
    expect(spOf(s, "player1", "XG1-029:ab")).toBe(0);
  });

  it("XG1-029: CN1 以外（2番目）では【無敵の竜人魂】は発動しない（出典: atwiki/page-1620「CN：1」）", () => {
    const s = ncAt("XG1-029:ab", 2, {}, { battle: [inst("SPEC-LDA", "lda")] }, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-029");
    expect(zoneOf(s, "player2", "SPEC-LDA:lda")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-030 アバレキラーAM", () => {
  const TEXT =
    "これが撃破されて捨札になったとき、自軍捨札から「アバレキラー」のカードを1枚選び、自軍ラッシュエリアに出す。 ※ウイング 【キラークロー】「SP1」このターン、これはBP+2000される。（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）";

  it("XG1-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-1666）", () => {
    expectCatalogText("XG1-030", TEXT);
    expectUnitStats("XG1-030", { name: "アバレキラーAM", category: "WB", size: "S", bp: 4500, sp: "special", powerCost: "7-", comboNumber: 2, features: ["ホワイト", "男", "アバレモード"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG1-030", ["R"]);
  });

  zordDownTests("XG1-030", "RS-234", "アバレキラー", "atwiki/page-1666", "WB");
  reanimateTests("XG1-030", "RS-234", "アバレキラー", "atwiki/page-1666");
  wingTests("XG1-030", "atwiki/page-1666");

  it("XG1-030: 【キラークロー】2番目に並んで NC が成立すると「SP1」・BP6500 になる（出典: atwiki/page-1666「「SP1」このターン、これはBP+2000される」）", () => {
    const s = ncAt("XG1-030:ak", 2, {}, {}, EXTRA);
    expect(spOf(s, "player1", "XG1-030:ak")).toBe(1);
    expect(bpOf(s, "player1", "XG1-030:ak")).toBe(6500);
  });

  it("XG1-030: NC が成立しなければ（3番目）SP を持たず BP4500 のまま（出典: atwiki/page-1666「CN：2」）", () => {
    const s = ncAt("XG1-030:ak", 3, {}, {}, EXTRA);
    expect(spOf(s, "player1", "XG1-030:ak")).toBe(0);
    expect(bpOf(s, "player1", "XG1-030:ak")).toBe(4500);
  });

  it.fails("XG1-030: ウイングでアタックするときはナンバーに関係なく【キラークロー】が発動し、BP6500 で BP6000 のユニットに勝つ（既知の不具合: CARD-XG1-030 ウイングでのアタックでは発動せず BP4500 で負ける）（出典: atwiki/page-1666「（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）」・カード評価「ウイングから発動できる」）", () => {
    let s = p1Battle({ rush: [inst("XG1-030", "ak")] }, { battle: [inst("SPEC-N6", "e")] }, EXTRA);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG1-030:ak" });
    s = settle(attack(s, "XG1-030:ak", "SPEC-N6:e"));
    expect(lastBattleBps(s)?.attacker).toBe(6500);
    expect(zoneOf(s, "player2", "SPEC-N6:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XG1-030:ak")).toBe("rush");
  });
});

// ===========================================================================
describe("XG1-031 ゴーオンレッド", () => {
  const TEXT =
    "※これが自軍エリアにある間、自軍バトルフェイズ中、自分の手札にある特徴「炎神」を持つユニットカードはカテゴリにWBが追加される。 【ドルドル弾】自軍ラッシュエリアから、特徴「炎神」を持ち、ナンバーに数字を持つMユニットを1体選び手札に戻してもよい。そうしたとき、戻したユニットのナンバーの数字を見て、その数字以下の必要パワーの数字を持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("XG1-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-1638）", () => {
    expectCatalogText("XG1-031", TEXT);
    expectUnitStats("XG1-031", { name: "ゴーオンレッド", category: ["WB", "OT"], size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: 1, features: ["レッド", "男", "激気"] });
    expectRarityIn("XG1-031", ["NR"]);
  });

  it("XG1-031: SP「1/2」— 2番目にある間は SP1、3番目では SP を持たない（出典: atwiki/page-1638「SP：1/2」・05-battle-strike-damage「分母と同じ並び順にある間は常に SP1」）", () => {
    expect(spOf(ncAt("XG1-031:gr", 2, {}, {}, EXTRA), "player1", "XG1-031:gr")).toBe(1);
    expect(spOf(ncAt("XG1-031:gr", 3, {}, {}, EXTRA), "player1", "XG1-031:gr")).toBe(0);
  });

  /** 激気（RS-436）を配置し、自軍ラッシュエリアに extraRush を置いて、必要パワー3の激気 S ユニットを出す。手札は OT の炎神 M（必要パワー1）。 */
  const gekiEntered = (extraRush: ReturnType<typeof inst>[]) =>
    act(
      p1Battle({ operation: [inst("RS-436", "gk")], rush: [...extraRush, inst("SPEC-GS", "x")], hand: [inst("SPEC-ENM1", "m1")] }, {}, EXTRA),
      { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-GS:x" },
    );

  it.fails("XG1-031: ※ これが自軍エリアにある間、自軍バトルフェイズ中は手札の炎神のユニットカードに WB が追加される（激気〈RS-436〉で OT の炎神 M を出せる）（既知の不具合: CARD-XG1-031 手札の炎神に WB が追加されず激気の候補にならない）（出典: atwiki/page-1638「自分の手札にある特徴「炎神」を持つユニットカードはカテゴリにWBが追加される」・カード評価「自身の効果のおかげで炎神も激気に対応している」）", () => {
    const s = gekiEntered([inst("XG1-031", "gr")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    expect(choiceIds(s)).toContain("SPEC-ENM1:m1");
  });

  it("XG1-031: ※ これがいなければ、手札の OT の炎神 M は激気の候補にならない（対照）（出典: atwiki/page-1638・atwiki/page-515 激気「WBのMユニットのカード」）", () => {
    const s = gekiEntered([]);
    expect(s.pendingEffectChoice?.sourceCardId === "RS-436" ? choiceIds(s) : []).not.toContain("SPEC-ENM1:m1");
  });

  const nc = (p2battle = [inst("SPEC-C3", "c3"), inst("SPEC-C4", "c4")]) =>
    ncAt("XG1-031:gr", 1, { rush: [inst("SPEC-EN3", "m3"), inst("SPEC-ENX", "mx"), inst("SPEC-GK", "gk")] }, { battle: p2battle, rush: [inst("SPEC-C3", "rc")] }, EXTRA);

  it("XG1-031: 【ドルドル弾】NC — 1番目に出ると、自軍ラッシュエリアのユニットを選ぶ選択が開く（任意）（出典: atwiki/page-1638「…Mユニットを1体選び手札に戻してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-031");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toContain("SPEC-EN3:m3");
  });

  it.fails("XG1-031: 候補は特徴「炎神」を持ちナンバーに数字を持つ M ユニットだけ（ナンバーなしの炎神・炎神でない M は選べない）（既知の不具合: CARD-XG1-031 ナンバーなし・炎神でない M も候補になる）（出典: atwiki/page-1638「特徴「炎神」を持ち、ナンバーに数字を持つMユニット」）", () => {
    expect(choiceIds(nc())).toEqual(["SPEC-EN3:m3"]);
  });

  it.fails("XG1-031: 選んだ炎神は自軍の手札に戻る（既知の不具合: CARD-XG1-031 手札ではなく自軍パワーゾーンに置かれる）（出典: atwiki/page-1638「手札に戻してもよい」）", () => {
    const s = pick(nc(), "SPEC-EN3:m3");
    expect(zoneOf(s, "player1", "SPEC-EN3:m3")).toBe("hand");
  });

  it.fails("XG1-031: 戻したユニットのナンバー（3）以下の必要パワーを持つ敵軍 S ユニットを選び、持ち主のパワーゾーンに送る（必要パワー4 は選べない）（既知の不具合: CARD-XG1-031 敵軍ユニットを選べず何も送られない）（出典: atwiki/page-1638「その数字以下の必要パワーの数字を持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る」）", () => {
    const s = pick(nc(), "SPEC-EN3:m3");
    expectChoiceFrom(s, "player1", "XG1-031");
    expect(choiceIds(s)).not.toContain("SPEC-C4:c4");
    const t = resolveAll(s, ["SPEC-C3:c3"]);
    expect(zoneOf(t, "player2", "SPEC-C3:c3")).toBe("power");
    expect(zoneOf(t, "player2", "SPEC-C4:c4")).toBe("battle");
  });

  it("XG1-031: 戻さないことを選べば、自軍のユニットも敵軍のユニットも動かない（出典: atwiki/page-1638「戻してもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(nc()));
    expect(zoneOf(s, "player1", "SPEC-EN3:m3")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-032 ゲキレッド", () => {
  const TEXT =
    "※レジスト 【咆咆弾】「SP1」自軍ラッシュエリアから、特徴「激気」を持つMユニットを1体選び手札に戻してもよい。そうしたとき、戻したユニットのBP以下のBPを持つユニットを、敵軍バトルエリアから1体選び撃破する。";

  it("XG1-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-1640）", () => {
    expectCatalogText("XG1-032", TEXT);
    expectUnitStats("XG1-032", { name: "ゲキレッド", category: ["WB", "MA"], size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: 2, features: ["レッド", "男", "激気"] });
    expectRarityIn("XG1-032", ["NR"]);
  });

  it("XG1-032: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1640「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-032", "gk")] }, "XG1-032:gk"))).toBe(true);
  });

  it("XG1-032: SP「1/3」と【咆咆弾】「SP1」— 2番目（NC）でも3番目でも SP1、4番目では SP を持たない（出典: atwiki/page-1640「SP：1/3」・カード評価「２番目でも３番目でもストライクが可能」）", () => {
    expect(spOf(ncAt("XG1-032:gk", 2, {}, {}, EXTRA), "player1", "XG1-032:gk")).toBe(1);
    expect(spOf(ncAt("XG1-032:gk", 3, {}, {}, EXTRA), "player1", "XG1-032:gk")).toBe(1);
    expect(spOf(ncAt("XG1-032:gk", 4, {}, {}, EXTRA), "player1", "XG1-032:gk")).toBe(0);
  });

  const nc = () =>
    ncAt("XG1-032:gk", 2, { rush: [inst("SPEC-GK", "gk"), inst("SPEC-ENX", "mx")] }, { battle: [inst("SPEC-B4", "b4"), inst("SPEC-B45", "b45")] }, EXTRA);

  it.fails("XG1-032: 【咆咆弾】NC — 自軍ラッシュエリアの特徴「激気」を持つ M ユニットから1体選べる（任意）（既知の不具合: CARD-XG1-032 選択が開かない）（出典: atwiki/page-1640「自軍ラッシュエリアから、特徴「激気」を持つMユニットを1体選び手札に戻してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-032");
    expect(choiceIds(s)).toEqual(["SPEC-GK:gk"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG1-032: 戻したユニット（BP4000）以下の BP を持つ敵軍バトルエリアのユニットを1体選び撃破する（BP4500 は選べない）（既知の不具合: CARD-XG1-032）（出典: atwiki/page-1640「戻したユニットのBP以下のBPを持つユニットを、敵軍バトルエリアから1体選び撃破する」）", () => {
    const s = pick(nc(), "SPEC-GK:gk");
    expect(zoneOf(s, "player1", "SPEC-GK:gk")).toBe("hand");
    expect(choiceIds(s)).toEqual(["SPEC-B4:b4"]);
    const t = resolveAll(s, ["SPEC-B4:b4"]);
    expect(zoneOf(t, "player2", "SPEC-B4:b4")).toBe("discard");
  });
});

// ===========================================================================
describe("XG1-033 害地大臣ヨゴシュタイン", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【汚れた大地】これが自軍エリアにある間、コマンドゾーンにある本来のカテゴリにDAを持たないカードのうち、必要パワーの数字が3以下のカードは、カテゴリにDAが追加される（この効果は重複しない）。";

  it("XG1-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-1581）", () => {
    expectCatalogText("XG1-033", TEXT);
    expectUnitStats("XG1-033", { name: "害地大臣ヨゴシュタイン", category: "DA", size: "S", bp: 6000, sp: undefined, powerCost: 4, features: ["メカ", "人型"] });
    expectRarityIn("XG1-033", ["N"]);
  });

  it("XG1-033: ※ 敵軍ターン中、SP1 のユニットにアタックされると、バトルに勝っても撃破される（出典: atwiki/page-1581「敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG1-033", "yg")] }, "XG1-033:yg", {}, "TST-UNIT-0:atk");
    expect(zoneOf(s, "player1", "XG1-033:yg")).toBe("discard");
  });

  it("XG1-033: ※ SP を持たないユニットとのバトルなら勝って残る（出典: atwiki/page-1581「「SP1」以上のユニット」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG1-033", "yg")] }, "XG1-033:yg", {}, "SPEC-NOSP:atk", EXTRA);
    expect(zoneOf(s, "player1", "XG1-033:yg")).toBe("battle");
  });

  it("XG1-033: ※ 自軍ターンに SP1 のユニットにアタックして勝てば残る（出典: atwiki/page-1581「敵軍ターン中」）", () => {
    const s = settle(attack(p1Battle({ battle: [inst("XG1-033", "yg")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG1-033:yg", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player1", "XG1-033:yg")).toBe("battle");
  });

  const daRush = (command: ReturnType<typeof inst>[], withYogo = true) =>
    rushPhaseBoard({ rush: withYogo ? [inst("XG1-033", "yg")] : [], hand: [inst("SPEC-DA0", "d")], command }, {}, EXTRA);

  it("XG1-033: 【汚れた大地】必要パワー3 の WB のコマンドに DA が追加され、DA のユニットのラッシュに使える（出典: atwiki/page-1581「必要パワーの数字が3以下のカードは、カテゴリにDAが追加される」）", () => {
    expect(canStartRush(daRush([released("TST-OP", "c")]), "player1", "SPEC-DA0:d")).toBe(true);
  });

  it("XG1-033: 【汚れた大地】がなければ、WB のコマンドでは DA のユニットをラッシュできない（対照）（出典: atwiki/page-1581）", () => {
    expect(canStartRush(daRush([released("TST-OP", "c")], false), "player1", "SPEC-DA0:d")).toBe(false);
  });

  it("XG1-033: 【汚れた大地】必要パワー4 のカードには DA が追加されない（出典: atwiki/page-1581「必要パワーの数字が3以下」）", () => {
    expect(canStartRush(daRush([released("SPEC-C4", "c")]), "player1", "SPEC-DA0:d")).toBe(false);
  });

  it.fails("XG1-033: 【汚れた大地】敵軍のコマンドゾーンのカードにも DA が追加される（相手も DA のユニットのラッシュに使える）（既知の不具合: CARD-XG1-033 自軍のコマンドにしか追加されない）（出典: atwiki/page-1581「コマンドゾーンにある…カードは」・カード評価「敵軍コマンドを汚染できれば」「逆に相手に使われそうな場合は」）", () => {
    const s = enemyBoard({ rush: [inst("XG1-033", "yg")] }, { hand: [inst("SPEC-DA0", "d")], command: [released("TST-OP", "c")] }, EXTRA, "rush");
    expect(canStartRush(s, "player2", "SPEC-DA0:d")).toBe(true);
  });

  it.fails("XG1-033: Q&A — DA が追加されたコマンドはマルチカテゴリとして扱う（ターボロボ〈XG1-020〉の BP が +1000 される）（既知の不具合: CARD-XG1-033 追加された DA がターボロボのマルチカテゴリの数に入らず BP8000 のまま）（出典: atwiki/page-1581 Q1「はい、マルチカテゴリのコマンドとして扱います」）", () => {
    const s = p1Battle({ battle: [inst("XG1-020", "tr")], rush: [inst("XG1-033", "yg")], command: [released("TST-OP-ET", "c")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG1-020:tr")).toBe(9000);
  });

  it.fails("XG1-033: （この効果は重複しない）— ヨゴシュタインが2体いても、追加される DA は1つでターボロボの BP は +1000 のまま（既知の不具合: CARD-XG1-033 上と同じく BP に反映されず観測できない）（出典: atwiki/page-1581「（この効果は重複しない）」）", () => {
    const s = p1Battle({ battle: [inst("XG1-020", "tr")], rush: [inst("XG1-033", "yg"), inst("XG1-033", "yg2")], command: [released("TST-OP-ET", "c")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG1-020:tr")).toBe(9000);
  });
});

// ===========================================================================
describe("XG1-034 害気大臣キタネイダス", () => {
  const TEXT = "【汚い大気】これが自軍エリアにある間、自分も相手も次の制限を受ける⇒バトルフェイズ中、パワーゾーンからカードが離れる処理を含む効果はすべて無効になる。";

  it("XG1-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-1582）", () => {
    expectCatalogText("XG1-034", TEXT);
    expectUnitStats("XG1-034", { name: "害気大臣キタネイダス", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["メカ", "人型"] });
    expectRarityIn("XG1-034", ["N"]);
  });

  /** 自軍バトルフェイズ。デカベースロボ（RS-235「自軍パワーゾーンからダメージ以外のカードを2枚選んで捨札にしなければバトルエリアに出られない」）を出す。 */
  const robo = (p1Rush: ReturnType<typeof inst>[], p2Rush: ReturnType<typeof inst>[] = []) =>
    st({ player1: { rush: [inst("RS-235", "robo"), ...p1Rush], power: powerCards(3, "pw"), deck: deckCards(3) }, player2: { rush: p2Rush, deck: deckCards(3, "e") } });

  it("XG1-034: 【汚い大気】キタネイダスが敵軍エリアにあっても（相手のものでも）、自軍バトルフェイズのパワーゾーンを離れる処理は無効（デカベースロボが捨札なしで出られる）（出典: atwiki/page-1582「自分も相手も次の制限を受ける」・Q5「はい、その通りです」）", () => {
    const s = raw(robo([], [inst("XG1-034", "kt")]), { type: "move_to_battle", playerId: "player1", instanceId: "RS-235:robo" });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "RS-235:robo")).toBe("battle");
    expect(s.players.player1.power).toHaveLength(3);
  });

  it("XG1-034: キタネイダスが場になければ、デカベースロボはパワーゾーンのカードを捨札にしなければ出られない（対照）（出典: atwiki/page-500「ダメージ以外のカードを2枚選んで捨札にしなければ」）", () => {
    const s = raw(robo([]), { type: "move_to_battle", playerId: "player1", instanceId: "RS-235:robo" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-235");
  });

  it("XG1-034: キタネイダスが手札にあるだけでは制限はかからない（出典: atwiki/page-1582「これが自軍エリアにある間」）", () => {
    const base = robo([]);
    const s = raw({ ...base, players: { ...base.players, player1: { ...base.players.player1, hand: [inst("XG1-034", "kt")] } } }, { type: "move_to_battle", playerId: "player1", instanceId: "RS-235:robo" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-235");
  });

  it("XG1-034: バトルフェイズ以外（ラッシュフェイズ）は制限されない — ジェットシーカー（RS-265）をラッシュしたとき自軍パワーゾーンのカードを捨札にする（出典: atwiki/page-1582「バトルフェイズ中」・Q3）", () => {
    // ジェットシーカーの追加条件「自軍Sユニットを2体パワーゾーンに送る」の素材としてフィラー2体を置く。
    const s0 = rushPhaseBoard({ rush: [inst("XG1-034", "kt"), inst("TST-UNIT-0", "f0"), inst("TST-UNIT-0", "f1")], hand: [inst("RS-265", "js")], command: releasedCat("OT", 1), power: powerCards(3) }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "RS-265:js", { materials: ["TST-UNIT-0:f0", "TST-UNIT-0:f1"] });
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-265");
    const s = pick(r.state, "TST-P:pw0");
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
  });

  it("XG1-034: 敵軍のバトルフェイズにも制限はかかる（敵軍のデカベースロボも捨札なしで出られる）（出典: atwiki/page-1582「自分も相手も」「バトルフェイズ中」）", () => {
    const s0 = enemyBoard({ rush: [inst("XG1-034", "kt")] }, { rush: [inst("RS-235", "robo")], power: powerCards(3, "ep") }, EXTRA);
    expect(canEnter(s0, "RS-235:robo", "player2")).toBe(true);
    const s = raw(s0, { type: "move_to_battle", playerId: "player2", instanceId: "RS-235:robo" });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.power).toHaveLength(3);
  });
});
