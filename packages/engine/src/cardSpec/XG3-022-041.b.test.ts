/**
 * カード別スペック: XG3-029〜XG3-035（クロスギャザー ザ・Wインパクト 魔導騎士ウルザード〜海老折神）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-029 Q1（page-2016）、XG3-034 Q1・Q2（page-1907）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-SCRUM-01・R-CN-02・R-CN-05・R-CAT-02・R-REPL-03・R-REPL-04）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  bpOf,
  canSelfRush,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  deckWithTen,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectUnitStats,
  faceDown,
  faceUp,
  featuresOf,
  inst,
  legal,
  lineUp,
  nextPhase,
  PLAIN_VEHICLE,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  scrumTests,
  selfRush,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  vehicleCard,
  zoneOf,
} from "./XG3-022-041.helpers";

const M_VEHICLE = vehicleCard("SPEC-MV", { size: "M", category: "MA" });
const NOSP = sUnit("SPEC-NOSP", { bp: 1000, sp: undefined });
const GEKI_M = sUnit("SPEC-GEKI-M", { category: "WB", bp: 3000, size: "M", sp: undefined, features: ["激気"] });
const GEKI_S = sUnit("SPEC-GEKI-S", { category: "WB", bp: 1000, sp: undefined, features: ["激気"] });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "WB", bp: 3000, size: "M", sp: undefined, features: ["メカ"] });
const SAM = sUnit("SPEC-SAM", { category: "MA", bp: 3000, sp: undefined, features: ["侍"] });
const NOT_SAM = sUnit("SPEC-NOTSAM", { category: "MA", bp: 3000, sp: undefined, features: ["男"] });
const E1000 = sUnit("SPEC-E1000", { bp: 1000 });
const EXTRA = [M_VEHICLE, NOSP, GEKI_M, GEKI_S, PLAIN_M, SAM, NOT_SAM, E1000, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

/** 敵軍（player2）が RS-481 天空神【ホバリング】（敵軍ラッシュエリアからSユニットを1体選ぶ）をバトルエリアに出したときの候補。 */
function tenkuujinCandidates(p1Rush: ReturnType<typeof inst>[]): string[] {
  let s = st({ activePlayer: "player2", player1: { rush: p1Rush, deck: deckCards(3) }, player2: { rush: [inst("RS-481", "tk")], deck: deckCards(3, "e") } }, EXTRA);
  s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" });
  return choiceIds(s);
}

// ===========================================================================
describe("XG3-029 魔導騎士ウルザード", () => {
  const TEXT =
    "※自軍Mビークルがあれば、これはMユニットになり、特徴「人型」が追加される。 【ウルサーベル 】自軍ターン中、これがバトルエリアに出たとき、自分の手札を1枚選び捨札にしてもよい。そうしたとき、このターン、これはBP+2000され、「SP1」になる。";

  it("XG3-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-2016「SP：1/3」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-029", TEXT);
    expectUnitStats("XG3-029", { name: "魔導騎士ウルザード", category: ["MA", "DA"], size: "S", bp: 5000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["魔法", "男"] });
    expectRarityIn("XG3-029", ["SR"]);
  });

  it("XG3-029: ※ 自軍 M ビークルがあれば特徴「人型」が追加される（出典: atwiki/page-2016「これはMユニットになり、特徴「人型」が追加される」）", () => {
    const s = battle({ rush: [inst("XG3-029", "u"), inst("SPEC-MV", "v")] });
    expect(featuresOf(s, "player1", "XG3-029:u")).toContain("人型");
  });

  it("XG3-029: ※ 自軍 M ビークルがあれば M ユニットになり、敵軍の「Sユニットを選ぶ」効果（RS-481 天空神【ホバリング】）に選ばれない（出典: atwiki/page-2016・コメント欄「先に魔導馬バリキオン（2nd）出してからラッシュすればオルゴール引っかからない」「その通り」）", () => {
    expect(tenkuujinCandidates([inst("XG3-029", "u"), inst("SPEC-MV", "v"), inst("TST-UNIT-0", "s")])).toEqual(["TST-UNIT-0:s"]);
  });

  it("XG3-029: ※ 自軍ビークルが S ビークルだけなら S ユニットのまま（RS-481 天空神に選ばれる。「人型」もない）（出典: atwiki/page-2016「自軍Mビークルがあれば」）", () => {
    const rush = [inst("XG3-029", "u"), inst("SPEC-VEHICLE", "v"), inst("TST-UNIT-0", "s")];
    expect(tenkuujinCandidates(rush)).toContain("XG3-029:u");
    expect(featuresOf(battle({ rush }), "player1", "XG3-029:u")).not.toContain("人型");
  });

  const entered = (hand = [inst("TST-OP", "h1"), inst("TST-OP", "h2")]) => enter(battle({ rush: [inst("XG3-029", "u")], hand }), "XG3-029:u");

  it("XG3-029:【ウルサーベル】— 自軍ターン中にバトルエリアに出たとき、自分の手札から1枚選べる（任意）（出典: atwiki/page-2016「自分の手札を1枚選び捨札にしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-029");
    expect(choiceIds(s)).toEqual(["TST-OP:h1", "TST-OP:h2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-029:【ウルサーベル】— 手札を1枚捨札にすれば、このターンこれは BP+2000（7000）・「SP1」（バトルエリアの1番目でも）（出典: atwiki/page-2016「このターン、これはBP+2000され、「SP1」になる」）", () => {
    const s = resolveAll(entered(), ["TST-OP:h1"]);
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("discard");
    expect(bpOf(s, "player1", "XG3-029:u")).toBe(7000);
    expect(spOf(s, "player1", "XG3-029:u")).toBe(1);
  });

  it("XG3-029:【ウルサーベル】— 捨札にしなければ BP5000 のまま、1番目では SP なし（出典: atwiki/page-2016「そうしたとき」・SP「1/3」）", () => {
    let s = entered();
    if (s.pendingEffectChoice) s = skip(s);
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("hand");
    expect(bpOf(s, "player1", "XG3-029:u")).toBe(5000);
    expect(spOf(s, "player1", "XG3-029:u")).toBe(0);
  });

  it("XG3-029:【ウルサーベル】— 敵軍ターン中にバトルエリアに出されたときは発動しない（手札は捨札にならず BP5000）（出典: atwiki/page-2016「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG3-029:u", { hand: [inst("TST-OP", "h1")] }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-029");
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("hand");
    expect(bpOf(s, "player1", "XG3-029:u")).toBe(5000);
  });
});

// ===========================================================================
describe("XG3-030 ウルケンタウロス", () => {
  const TEXT = "合体―魔導騎士ウルザード＋魔導馬バリキオン ※これは「SP1」以上のユニットにしかアタックできない。";

  it("XG3-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-1903「追加条件：自軍合体ユニットを捨札にする」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-030", TEXT);
    expectUnitStats("XG3-030", { name: "ウルケンタウロス", category: ["MA", "DA"], size: "L", bp: 8000, sp: 1, powerCost: "4+", comboNumber: undefined, features: ["魔法"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG3-030", ["NR"]);
  });

  const mk = (rush: ReturnType<typeof inst>[], command = [...releasedCat("MA", 1), ...releasedCat("DA", 1)]) =>
    board({ hand: [inst("XG3-030", "k")], rush, power: powerCards(4), command });

  it("XG3-030: 合体 — 自軍の「魔導騎士ウルザード」（XG3-029）と「魔導馬バリキオン」（XG3-028）を捨札にしてラッシュできる（出典: atwiki/page-1903「合体―魔導騎士ウルザード＋魔導馬バリキオン」）", () => {
    const r = rushFromHand(mk([inst("XG3-029", "u"), inst("XG3-028", "b")]), "player1", "XG3-030:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-030:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-029:u")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG3-028:b")).toBe("discard");
  });

  it("XG3-030: 合体 — パーツが片方しかなければラッシュできない（出典: atwiki/page-1903「合体―魔導騎士ウルザード＋魔導馬バリキオン」）", () => {
    expect(canStartRush(mk([inst("XG3-029", "u")]), "player1", "XG3-030:k")).toBe(false);
  });

  it("XG3-030: マルチカテゴリ（MA／DA）— 自軍コマンドゾーンに DA がなければラッシュできない（出典: atwiki/page-1903「カテゴリ：ミスティックアームズ／ダークアライアンス」・R-CAT-02）", () => {
    const r = rushFromHand(mk([inst("XG3-029", "u"), inst("XG3-028", "b")], releasedCat("MA", 2)), "player1", "XG3-030:k");
    expect(r.ok).toBe(false);
  });

  it("XG3-030: ※ SP1 以上のユニットにしかアタックできない（SP のない敵軍ユニットはアタック先にならない）（出典: atwiki/page-1903「これは「SP1」以上のユニットにしかアタックできない」）", () => {
    const s = battle({ battle: [inst("XG3-030", "k")] }, { battle: [inst("TST-UNIT-0", "sp1"), inst("TST-UNIT-2", "sp2"), inst("SPEC-NOSP", "n")] });
    expect(targetsOf(s, "XG3-030:k").sort()).toEqual(["TST-UNIT-0:sp1", "TST-UNIT-2:sp2"]);
  });

  it("XG3-030: ※ SP1 以上の敵軍ユニットにはアタックできる（出典: atwiki/page-1903「「SP1」以上のユニットにしかアタックできない」）", () => {
    const s = battle({ battle: [inst("XG3-030", "k")] }, { battle: [inst("TST-UNIT-0", "sp1"), inst("TST-UNIT-2", "sp2")] });
    expect(targetsOf(s, "XG3-030:k").sort()).toEqual(["TST-UNIT-0:sp1", "TST-UNIT-2:sp2"]);
  });
});

// ===========================================================================
describe("XG3-031 ゲキブルー", () => {
  const TEXT = "※スクラム 【宙宙斬】 このターン、自軍バトルエリアの2番目に並ぶ、特徴「激気」を持つMユニットは次の能力を得る⇒「SP1」";

  it("XG3-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-1904「CN：1」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-031", TEXT);
    expectUnitStats("XG3-031", { name: "ゲキブルー", category: ["WB", "MA"], size: "S", bp: 3000, sp: "1/3", powerCost: 3, comboNumber: 1, features: ["ブルー", "男", "激気"] });
    expectRarityIn("XG3-031", ["NR"]);
  });

  scrumTests("XG3-031", 1, "atwiki/page-1904");

  it("XG3-031:【宙宙斬】— 1番目に出れば（NC）、2番目に並ぶ特徴「激気」を持つ M ユニット（SP なし）が「SP1」になる（出典: atwiki/page-1904「自軍バトルエリアの2番目に並ぶ、特徴「激気」を持つMユニットは次の能力を得る⇒「SP1」」・カード評価「ゲキビースト限定のタクスWB」）", () => {
    const s = line(["XG3-031:g", "SPEC-GEKI-M:m"]);
    expect(spOf(s, "player1", "SPEC-GEKI-M:m")).toBe(1);
  });

  it("XG3-031:【宙宙斬】— 2番目の M ユニットが「激気」を持たなければ SP は変わらない（出典: atwiki/page-1904「特徴「激気」を持つMユニット」）", () => {
    expect(spOf(line(["XG3-031:g", "SPEC-PLAIN-M:m"]), "player1", "SPEC-PLAIN-M:m")).toBe(0);
  });

  it("XG3-031:【宙宙斬】— 2番目の「激気」のユニットが S ユニットなら SP は変わらない（出典: atwiki/page-1904「Mユニット」）", () => {
    expect(spOf(line(["XG3-031:g", "SPEC-GEKI-S:s"]), "player1", "SPEC-GEKI-S:s")).toBe(0);
  });

  it("XG3-031:【宙宙斬】— これが1番目にいなければ（NC 不成立）、2番目・3番目の「激気」の M ユニットは「SP1」にならない（出典: atwiki/page-1904・R-CN-02）", () => {
    expect(spOf(line(["SPEC-GEKI-M:m", "XG3-031:g"]), "player1", "SPEC-GEKI-M:m")).toBe(0);
    expect(spOf(line(["TST-UNIT-0:x", "XG3-031:g", "SPEC-GEKI-M:m"]), "player1", "SPEC-GEKI-M:m")).toBe(0);
  });
});

// ===========================================================================
describe("XG3-032 ゲキイエロー", () => {
  const TEXT =
    "【弾弾丸】「SP1」 自分の手札から、特徴「激気」を持つMユニットのカードを1枚選び捨札にしてもよい。そうしたとき、敵軍ラッシュエリアにSユニットがあれば1体選び撃破する。その後、自分は1枚ドローする。";

  it("XG3-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-1905「SP：！」「CN：3」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-032", TEXT);
    expectUnitStats("XG3-032", { name: "ゲキイエロー", category: ["WB", "MA"], size: "S", bp: 2000, sp: "special", powerCost: 1, comboNumber: 3, features: ["イエロー", "女", "激気"] });
    expectRarityIn("XG3-032", ["NR"]);
  });

  /** 3番目に出る（NC）。手札: 激気の M・激気の S・激気でない M。敵軍ラッシュエリア: S と M、敵軍バトルエリア: S。 */
  const nc = (enemyRush = [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em")]) =>
    line(["TST-UNIT-0:a", "TST-UNIT-0:b", "XG3-032:y"], { hand: [inst("SPEC-GEKI-M", "hm"), inst("SPEC-GEKI-S", "hs"), inst("SPEC-PLAIN-M", "hp")] }, { rush: enemyRush, battle: [inst("TST-UNIT-0", "eb")] });

  it("XG3-032:【弾弾丸】— 3番目に出れば（NC）「SP1」。1番目なら SP なし（出典: atwiki/page-1905「【弾弾丸】「SP1」」・R-CN-02）", () => {
    expect(spOf(resolveAll(nc()), "player1", "XG3-032:y")).toBe(1);
    expect(spOf(resolveAll(line(["XG3-032:y"])), "player1", "XG3-032:y")).toBe(0);
  });

  it("XG3-032:【弾弾丸】— 自分の手札の、特徴「激気」を持つ M ユニットのカードから選べる（任意）（出典: atwiki/page-1905「自分の手札から、特徴「激気」を持つMユニットのカードを1枚選び捨札にしてもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-032");
    expect(choiceIds(s)).toEqual(["SPEC-GEKI-M:hm"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-032:【弾弾丸】— 捨札にしたとき、敵軍ラッシュエリアの S ユニットを1体選び撃破し（M ユニット・バトルエリアのユニットは選べない）、その後1枚ドローする（出典: atwiki/page-1905「敵軍ラッシュエリアにSユニットがあれば1体選び撃破する。その後、自分は1枚ドローする」）", () => {
    // 撃破の選択（強制・候補1体）を確かめるため、手札の選択だけ答える（resolveAll は強制の選択も自動で答えてしまう）。
    let s = act(nc(), { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-GEKI-M:hm" });
    expect(zoneOf(s, "player1", "SPEC-GEKI-M:hm")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG3-032");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
    s = resolveAll(s, ["TST-UNIT-0:es"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(3);
  });

  it("XG3-032:【弾弾丸】— 敵軍ラッシュエリアに S ユニットがいなければ、捨札にするかの選択は開かず、撃破もドローもしない（出典: 利用者の決定 2026-10-20・questions-all.md U-1「撃破対象がある場合のみ捨て札にするか選択可能」）", () => {
    const s = nc([inst("TST-UNIT-2", "em")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-032");
    const done = resolveAll(s);
    expect(zoneOf(done, "player1", "SPEC-GEKI-M:hm")).toBe("hand");
    expect(done.players.player1.hand).toHaveLength(3);
  });

  it("XG3-032:【弾弾丸】— 捨札にしなければ、撃破もドローもしない（出典: atwiki/page-1905「そうしたとき」）", () => {
    let s = nc();
    if (s.pendingEffectChoice?.sourceCardId === "XG3-032") s = skip(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("rush");
    expect(s.players.player1.hand).toHaveLength(3);
  });
});

// ===========================================================================
describe("XG3-033 ナナシ連中", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【隙間より這い出す者達】これが自軍ゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、これを自軍ラッシュエリアに出してもよい。（この効果でラッシュできる「ナナシ連中」の数は、1ターンにつき2体までとする）";

  it("XG3-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-1906「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-033", TEXT);
    expectStats("XG3-033", { name: "ナナシ連中", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["妖怪", "戦闘員"] });
    expectRarityIn("XG3-033", ["N"]);
  });

  it("XG3-033: ※ デッキに好きな枚数入れられる（10枚でもデッキとして有効）（出典: atwiki/page-1906「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("XG3-033", "ナナシ連中")).toBe(true);
  });

  it("XG3-033:【隙間より這い出す者達】— 自軍ラッシュフェイズ中、自軍パワーゾーンでオモテ向きのこれをラッシュエリアに出せる（コマンド・パワーは要らない）（出典: atwiki/page-1906「これが自軍ゾーンでオモテ向きになっている間、…これを自軍ラッシュエリアに出してもよい」・コメント欄「表記のないコストは全部踏み倒せる」）", () => {
    const s = board({ power: [faceUp("XG3-033", "p")] });
    expect(canSelfRush(s, "power", "XG3-033:p")).toBe(true);
    expect(zoneOf(selfRush(s, "power", "XG3-033:p"), "player1", "XG3-033:p")).toBe("rush");
  });

  it("XG3-033:【隙間より這い出す者達】— 自軍コマンドゾーンのこれも出せる（出典: atwiki/page-1906「自軍ゾーン」・カード評価「コマンドを任意に減らせる」「コマンドとして使用した後にラッシュすればいい」）", () => {
    const s = board({ command: [inst("XG3-033", "c")] });
    expect(canSelfRush(s, "command", "XG3-033:c")).toBe(true);
    expect(zoneOf(selfRush(s, "command", "XG3-033:c"), "player1", "XG3-033:c")).toBe("rush");
  });

  it("XG3-033:【隙間より這い出す者達】— パワーゾーンでウラ向き（ダメージ）のこれは出せない（出典: atwiki/page-1906「オモテ向きになっている間」）", () => {
    expect(canSelfRush(board({ power: [faceDown("XG3-033", "p")] }), "power", "XG3-033:p")).toBe(false);
  });

  it("XG3-033:【隙間より這い出す者達】— 自軍バトルフェイズ中は出せない（出典: atwiki/page-1906「自軍ラッシュフェイズ中」）", () => {
    expect(canSelfRush(battle({ power: [faceUp("XG3-033", "p")] }), "power", "XG3-033:p")).toBe(false);
  });

  it("XG3-033:【隙間より這い出す者達】— この効果で出せるのは1ターンに2体まで（3体目は出せない）（出典: atwiki/page-1906「この効果でラッシュできる「ナナシ連中」の数は、1ターンにつき2体までとする」）", () => {
    let s = board({ power: [faceUp("XG3-033", "p1"), faceUp("XG3-033", "p2")], command: [inst("XG3-033", "c")] });
    s = selfRush(s, "power", "XG3-033:p1");
    s = selfRush(s, "power", "XG3-033:p2");
    expect(canSelfRush(s, "command", "XG3-033:c")).toBe(false);
  });
});

// ===========================================================================
describe("XG3-034 恐竜折神", () => {
  const TEXT =
    "【キョウリュウマル】このユニットからコンビネーションする特徴「侍」を持つユニットは、次の能力を得る⇒アタックするかわりに、敵軍バトルエリアのユニットを、BPの合計がこのユニットのBP以下になるように好きな数選び、撃破してもよい。";

  it("XG3-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-1907「CN：L」「追加条件：特徴「侍」を持つ自軍ユニットがある」）", () => {
    expectCatalogText("XG3-034", TEXT);
    expectStats("XG3-034", { name: "恐竜折神", category: "MA", size: "M", bp: 5000, sp: undefined, powerCost: "4+", comboNumber: "L", features: ["恐竜", "折神獣"], rushCondition: "state_gate" });
    expectRarityIn("XG3-034", ["N"]);
  });

  it("XG3-034: 追加条件 — 特徴「侍」を持つ自軍ユニットがあればラッシュできる（捨札にしない）。なければラッシュできない（出典: atwiki/page-1907「追加条件：特徴「侍」を持つ自軍ユニットがある」）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-034", "k")], rush, power: powerCards(4), command: releasedCat("MA", 1) });
    expect(canStartRush(mk([inst("SPEC-NOTSAM", "n")]), "player1", "XG3-034:k")).toBe(false);
    const r = rushFromHand(mk([inst("SPEC-SAM", "s")]), "player1", "XG3-034:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-SAM:s")).toBe("rush");
  });

  const kyouryuuOffered = (s: GameState, id: string) => legal(s).some((a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === id);
  const use = (s: GameState, id: string) => act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: id });
  /** 恐竜折神 → 侍（BP3000）の JC。敵軍バトルエリア: BP1000 ×2・BP3000・BP13000。 */
  const jc = (next = "SPEC-SAM:s") =>
    line(["XG3-034:k", next], {}, { battle: [inst("SPEC-E1000", "a"), inst("SPEC-E1000", "b"), inst("TST-UNIT-2", "c"), inst("TST-UNIT-7", "big")] });

  it("XG3-034:【キョウリュウマル】— これからコンビネーションした「侍」のユニットは、アタックするかわりに、BP の合計がそのユニットの BP（3000）以下になるよう敵軍バトルエリアのユニットを選べる（任意）（出典: atwiki/page-1907「アタックするかわりに、敵軍バトルエリアのユニットを、BPの合計がこのユニットのBP以下になるように好きな数選び」）", () => {
    const s0 = jc();
    expect(kyouryuuOffered(s0, "SPEC-SAM:s")).toBe(true);
    const s = use(s0, "SPEC-SAM:s");
    expectChoiceFrom(s, "player1", "XG3-034");
    expect(choiceIds(s).sort()).toEqual(["SPEC-E1000:a", "SPEC-E1000:b", "TST-UNIT-2:c"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-034:【キョウリュウマル】— 合計が BP 以下の範囲で好きな数を撃破する（BP1000 を2体選べば、残りの BP3000 は選べない）（出典: atwiki/page-1907「BPの合計がこのユニットのBP以下になるように好きな数選び、撃破してもよい」）", () => {
    let s = use(jc(), "SPEC-SAM:s");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1000:a" });
    expect(choiceIds(s)).toEqual(["SPEC-E1000:b"]);
    s = resolveAll(s, ["SPEC-E1000:b"]);
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E1000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:c")).toBe("battle");
  });

  it("XG3-034:【キョウリュウマル】— 発動した「侍」のユニットはそのあとアタックできない（出典: atwiki/page-1907「アタックするかわりに」・R-REPL-03）", () => {
    const s = resolveAll(use(jc(), "SPEC-SAM:s"), ["TST-UNIT-2:c"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:c")).toBe("discard");
    expect(targetsOf(s, "SPEC-SAM:s")).toEqual([]);
  });

  it("XG3-034:【キョウリュウマル】— これからコンビネーションしたユニットが「侍」を持たなければ能力を得ない（出典: atwiki/page-1907「特徴「侍」を持つユニットは」）", () => {
    expect(kyouryuuOffered(jc("SPEC-NOTSAM:n"), "SPEC-NOTSAM:n")).toBe(false);
  });

  it("XG3-034: Q1 — 恐竜折神からコンビネーションした XG4-046 腑破十臓は、レジストを持たない BP3000 以下のユニットだけの敵軍バトルエリアでも【キョウリュウマル】を発動できる（出典: atwiki/page-1907 Q1「はい、できます」）", () => {
    const s0 = line(["XG3-034:k", "XG4-046:j"], { command: releasedCat("DA", 1) }, { battle: [inst("SPEC-E1000", "a"), inst("TST-UNIT-2", "c")] });
    expect(kyouryuuOffered(s0, "XG4-046:j")).toBe(true);
    const s = resolveAll(use(s0, "XG4-046:j"), ["SPEC-E1000:a", "TST-UNIT-2:c"]);
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:c")).toBe("discard");
  });

  it("XG3-034: Q2 — RS-579 ルナジェルがあるとき、このターンにラッシュした BP8000 以下の「侍」のユニットも、恐竜折神からコンビネーションして【キョウリュウマル】を発動できる（出典: atwiki/page-1907 Q2「はい、できます」・コメント欄「アタックが不可なときにも使える」）", () => {
    let s = board({ hand: [inst("SPEC-SAM", "s")], rush: [inst("XG3-034", "k"), inst("RS-579", "lj")], power: powerCards(2), command: releasedCat("MA", 1) }, { battle: [inst("SPEC-E1000", "a")] });
    const r = rushFromHand(s, "player1", "SPEC-SAM:s");
    expect(r.ok, r.error).toBe(true);
    s = nextPhase(r.state);
    s = enter(s, "XG3-034:k");
    s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    s = enter(s, "SPEC-SAM:s");
    expect(targetsOf(s, "SPEC-SAM:s")).toEqual([]);
    expect(kyouryuuOffered(s, "SPEC-SAM:s")).toBe(true);
  });
});

// ===========================================================================
describe("XG3-035 海老折神", () => {
  const TEXT =
    "【太巻き光輪】これをラッシュしたとき、相手の手札が1枚以上あれば、次の効果を発動できる⇒敵軍コマンドゾーンのカードを1枚選び、相手の手札を見ないで1枚選ぶ。そうしたとき、選んだ2枚を置き換える。";

  it("XG3-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-1908「追加条件：特徴「ゴールド」を持つ自軍ユニットがある」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-035", TEXT);
    expectStats("XG3-035", { name: "海老折神", category: "MA", size: "L", bp: 6000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["獣", "折神獣", "電子モヂカラ"], rushCondition: "state_gate" });
    expectRarityIn("XG3-035", ["N"]);
  });

  const rushOf = (rush: ReturnType<typeof inst>[], p2: P2 = { hand: [inst("TST-OP", "eh")], command: [inst("TST-OP", "ec")] }) =>
    rushFromHand(board({ hand: [inst("XG3-035", "e")], rush, power: powerCards(5), command: releasedCat("MA", 1) }, p2), "player1", "XG3-035:e");

  it("XG3-035: 追加条件 — 特徴「ゴールド」を持つ自軍ユニット（XG1-038 シンケンゴールド）があればラッシュできる（捨札にしない）。なければラッシュできない（出典: atwiki/page-1908「追加条件：特徴「ゴールド」を持つ自軍ユニットがある」）", () => {
    expect(rushOf([inst("SPEC-SAM", "s")]).ok).toBe(false);
    const r = rushOf([inst("XG1-038", "g")]);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-038:g")).toBe("rush");
  });

  it("XG3-035:【太巻き光輪】— ラッシュしたとき、相手の手札が1枚以上あれば、敵軍コマンドゾーンのカードを選べる（発動は任意）（出典: atwiki/page-1908「次の効果を発動できる⇒敵軍コマンドゾーンのカードを1枚選び」）", () => {
    const r = rushOf([inst("XG1-038", "g")]);
    expectChoiceFrom(r.state, "player1", "XG3-035");
    expect(choiceIds(r.state)).toEqual(["TST-OP:ec"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it("XG3-035:【太巻き光輪】— 選んだ敵軍コマンドと、見ないで選んだ相手の手札1枚を置き換える（コマンドは相手の手札へ、手札のカードは敵軍コマンドゾーンへ）（出典: atwiki/page-1908「相手の手札を見ないで1枚選ぶ。そうしたとき、選んだ2枚を置き換える」・R-REPL-04）", () => {
    const s = resolveAll(rushOf([inst("XG1-038", "g")]).state, ["TST-OP:ec", "TST-OP:eh"]);
    expect(zoneOf(s, "player2", "TST-OP:ec")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("command");
  });

  it("XG3-035:【太巻き光輪】— 相手の手札が0枚なら発動しない（敵軍コマンドはそのまま）（出典: atwiki/page-1908「相手の手札が1枚以上あれば」）", () => {
    const r = rushOf([inst("XG1-038", "g")], { command: [inst("TST-OP", "ec")] });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("XG3-035");
    expect(zoneOf(r.state, "player2", "TST-OP:ec")).toBe("command");
  });
});
