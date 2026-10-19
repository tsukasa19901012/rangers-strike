/**
 * カード別スペック: XG3-070〜XG3-076（クロスギャザー ザ・Wインパクト ズ・ザイン・ダ〜仮面ライダーアギト）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（XG3-072 の読み替え。カタログは読み替え後の本文）。grnrngr の公式FAQ に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-072 Q1（page-1963。本文の読み替え）、XG3-074 Q1・Q2（page-1964）、XG3-075 Q1（page-1965）、XG3-076 Q1（page-1933）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-KW-BLAST-01・R-REPL-04・R-CN 系）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  enterAny,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectUnitStats,
  faceDown,
  faceUp,
  inst,
  lastBattleBps,
  lineUp,
  PLAIN_VEHICLE,
  powerCards,
  refsOf,
  releasedCat,
  resistTests,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  useRef,
  zoneOf,
} from "./XG3-063-083.helpers";

const CAR = sUnit("SPEC-CAR", { bp: 1000, features: ["車両"] });
const MAN = sUnit("SPEC-MAN", { bp: 1000, features: ["男", "怪人"] });
const MAN_L = sUnit("SPEC-MAN-L", { bp: 13000, size: "L", features: ["男"] });
const NOT_MAN = sUnit("SPEC-NOTMAN", { bp: 1000, features: ["メカ"] });
const MAN_S = sUnit("SPEC-MAN-S", { category: "MA", bp: 1000, features: ["男"] });
const WOMAN_S = sUnit("SPEC-WOMAN-S", { category: "MA", bp: 1000, features: ["女"] });
const L_UNIT = sUnit("SPEC-L", { category: "DA", bp: 13000, size: "L", powerCost: 1 });
const EXTRA = [CAR, MAN, MAN_L, NOT_MAN, MAN_S, WOMAN_S, L_UNIT, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-070 ズ・ザイン・ダ", () => {
  const TEXT =
    "※レジスト 【車両への憎悪】これは、敵軍バトルエリアに特徴「車両」を持つユニットか、特徴「車両」を持つビークルにライドしているユニットがあれば、可能ならそのユニットにアタックする。そうしたとき、これは、このターン、BP+2000される。";

  it("XG3-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-1930「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-070", TEXT);
    expectStats("XG3-070", { name: "ズ・ザイン・ダ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["グロンギ", "怪人", "男"] });
    expectRarityIn("XG3-070", ["N"]);
  });

  resistTests("XG3-070", "atwiki/page-1930");

  const entered = () => line(["XG3-070:z"], {}, { battle: [inst("TST-UNIT-0", "x"), inst("SPEC-CAR", "car")] });

  it.fails("XG3-070:【車両への憎悪】— 敵軍バトルエリアに「車両」のユニットがいれば、アタック先はそのユニットだけになる（既知の不具合: CARD-XG3-070 ほかのユニットにもアタックできる）（出典: atwiki/page-1930「可能ならそのユニットにアタックする」）", () => {
    expect(targetsOf(entered(), "XG3-070:z")).toEqual(["SPEC-CAR:car"]);
  });

  it.fails("XG3-070:【車両への憎悪】— そのユニットにアタックしたとき、このターン BP+2000（5000）（既知の不具合: CARD-XG3-070 BP が上がらない）（出典: atwiki/page-1930「そうしたとき、これは、このターン、BP+2000される」）", () => {
    const s = settle(attack(entered(), "XG3-070:z", "SPEC-CAR:car"));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
  });

  it("XG3-070:【車両への憎悪】— 「車両」のユニットがいなければ、ふつうにアタック先を選べる（BP3000）（出典: atwiki/page-1930「…があれば」）", () => {
    const s = line(["XG3-070:z"], {}, { battle: [inst("TST-UNIT-0", "x")] });
    expect(targetsOf(s, "XG3-070:z")).toEqual(["TST-UNIT-0:x"]);
    expect(bpOf(s, "player1", "XG3-070:z")).toBe(3000);
  });
});

// ===========================================================================
describe("XG3-071 キバーラ", () => {
  const TEXT = "【カプッ】これをラッシュしたとき、自軍山札の上から1枚をオモテにする。そうしたとき、オモテにしたカードがユニットカードだったなら捨札にする。それ以外だったなら自分の手札に加える。";

  it("XG3-071: カタログ本文・スペックが出典と一致（出典: atwiki/page-1931「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-071", TEXT);
    expectStats("XG3-071", { name: "キバーラ", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["キバット族"] });
    expectRarityIn("XG3-071", ["N"]);
  });

  const rushed = (top: ReturnType<typeof inst>) =>
    resolveAll(rushFromHand(board({ hand: [inst("XG3-071", "k")], power: powerCards(2), command: releasedCat("MA", 1), deck: [top, ...deckCards(3)] }), "player1", "XG3-071:k").state, [top.instanceId]);

  it.fails("XG3-071:【カプッ】— ラッシュしたとき、山札の上のカードがユニットカードなら捨札にする（既知の不具合: CARD-XG3-071 山札の上のカードが動かない）（出典: atwiki/page-1931「オモテにしたカードがユニットカードだったなら捨札にする」）", () => {
    expect(zoneOf(rushed(inst("TST-UNIT-0", "top")), "player1", "TST-UNIT-0:top")).toBe("discard");
  });

  it.fails("XG3-071:【カプッ】— ユニットカード以外（オペレーション）なら自分の手札に加える（既知の不具合: CARD-XG3-071）（出典: atwiki/page-1931「それ以外だったなら自分の手札に加える」）", () => {
    expect(zoneOf(rushed(inst("TST-OP", "top")), "player1", "TST-OP:top")).toBe("hand");
  });
});

// ===========================================================================
describe("XG3-072 仮面ライダーキバーラ", () => {
  const TEXT =
    "※これが自分の手札にある時、自軍ラッシュフェイズ中、このカードと自軍「キバーラ」1体を置き換えてもよい。 【誘いの罠】 自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、特徴「男」を持つ敵軍ユニットを１体選び撃破する。そうしたとき、撃破したユニットと特徴が完全一致するオモテ向きの敵軍パワーがあれば、１枚選びウラ向きにしてダメージにする。";

  it("XG3-072: カタログ本文（Q1 の読み替え後）・スペックが出典と一致（出典: atwiki/page-1963 Q1「以下のように読み替えていただきますよう」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-072", TEXT);
    expectStats("XG3-072", { name: "仮面ライダーキバーラ", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "女", "魔皇力"] });
    expectRarityIn("XG3-072", ["R"]);
  });

  it.fails("XG3-072: ※ 手札にある間、自軍ラッシュフェイズ中、自軍「キバーラ」（XG3-071）1体と置き換えられる（これがキバーラのいた場所へ、キバーラは手札へ）（既知の不具合: CARD-XG3-072 ※の置き換えの手がない）（出典: atwiki/page-1963「このカードと自軍「キバーラ」1体を置き換えてもよい」・R-REPL-04）", () => {
    const s = resolveAll(useRef(board({ hand: [inst("XG3-072", "kb")], rush: [inst("XG3-071", "k")] }), "XG3-072:kb"), ["XG3-071:k"]);
    expect(zoneOf(s, "player1", "XG3-072:kb")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-071:k")).toBe("hand");
  });

  it("XG3-072: ※ 自軍エリアに「キバーラ」がいなければ置き換えられない（出典: atwiki/page-1963「自軍「キバーラ」1体」）", () => {
    expect(refsOf(board({ hand: [inst("XG3-072", "kb")], rush: [inst("TST-UNIT-0", "u")] }), "XG3-072:kb")).toEqual([]);
  });

  /** 敵軍: 「男」のユニット（S・L）・「男」でないユニット。敵軍パワー: 「男／怪人」のオモテ向き（完全一致）・「男」だけのオモテ向き。 */
  const entered = () =>
    enter(battle({ rush: [inst("XG3-072", "kb")] }, { battle: [inst("SPEC-MAN", "m"), inst("SPEC-MAN-L", "ml"), inst("SPEC-NOTMAN", "n")], power: [faceUp("SPEC-MAN", "pm"), faceUp("SPEC-MAN-S", "ps")] }), "XG3-072:kb");

  it("XG3-072:【誘いの罠】— 自軍ターン中にバトルエリアに出たとき、これをホールドすれば、特徴「男」を持つ敵軍ユニット（サイズを問わない）から選べる（任意）（出典: atwiki/page-1963「これをホールドしてもよい。そうしたとき、特徴「男」を持つ敵軍ユニットを１体選び撃破する」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-072");
    expect(choiceIds(s).sort()).toEqual(["SPEC-MAN-L:ml", "SPEC-MAN:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-072:【誘いの罠】— 撃破し、撃破したユニットと特徴が完全一致するオモテ向きの敵軍パワーを1枚ウラ向きにしてダメージにする（一致しないパワーはそのまま）（出典: atwiki/page-1963「撃破したユニットと特徴が完全一致するオモテ向きの敵軍パワーがあれば、１枚選びウラ向きにしてダメージにする」）", () => {
    const s = resolveAll(entered(), ["SPEC-MAN:m", "SPEC-MAN:pm"]);
    expect(cardIn(s, "player1", "XG3-072:kb")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-MAN:m")).toBe("discard");
    expect(cardIn(s, "player2", "SPEC-MAN:pm")?.faceDown).toBe(true);
    expect(cardIn(s, "player2", "SPEC-MAN-S:ps")?.faceDown ?? false).toBe(false);
  });

  it("XG3-072:【誘いの罠】— ホールドしなければ撃破しない（これはリリース状態のまま）（出典: atwiki/page-1963「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player2", "SPEC-MAN:m")).toBe("battle");
    expect(cardIn(s, "player1", "XG3-072:kb")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("XG3-073 仮面ライダーJジャンボフォーメーション", () => {
  const TEXT = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【とっておきのお宝】これは、自軍「仮面ライダーディエンド」があれば「SP1/3」になる。";

  it("XG3-073: カタログ本文・スペックが出典と一致（出典: atwiki/page-1932「SP：！」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-073", TEXT);
    expectStats("XG3-073", { name: "仮面ライダーJジャンボフォーメーション", category: "MA", size: "L", bp: 5000, sp: "special", powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "人型"] });
    expectRarityIn("XG3-073", ["N"]);
  });

  it("XG3-073: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1932）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-073", "j")] }), "XG3-073:j")).toBe(false);
    expect(zoneOf(enterAny(battle({ rush: [inst("XG3-073", "j")], command: releasedCat("MA", 1) }), "XG3-073:j"), "player1", "XG3-073:j")).toBe("battle");
  });

  it.fails("XG3-073:【とっておきのお宝】— 自軍「仮面ライダーディエンド」（XG3-069）があれば「SP1/3」（3番目なら SP1）（既知の不具合: CARD-XG3-073 SP が得られない）（出典: atwiki/page-1932「自軍「仮面ライダーディエンド」があれば「SP1/3」になる」）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("XG3-073", "j")], rush: [inst("XG3-069", "de")], deck: deckCards(3) } }, EXTRA);
    expect(spOf(s, "player1", "XG3-073:j")).toBe(1);
  });

  it("XG3-073:【とっておきのお宝】— 「仮面ライダーディエンド」がいなければ SP なし（出典: atwiki/page-1932）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("XG3-073", "j")], deck: deckCards(3) } }, EXTRA);
    expect(spOf(s, "player1", "XG3-073:j")).toBe(0);
  });
});

// ===========================================================================
describe("XG3-074 キングダーク", () => {
  const TEXT =
    "※ブラスト 【大ショッカーの巨大幹部】これが自分の手札にある間、自軍ラッシュフェイズ中、自軍Lユニットが1体もなければ次の効果を発動できる⇒自軍山札の上から7枚を捨札にしてから、これをラッシュエリアに出してもよい。ただし、必要パワーは満たす事。";

  it("XG3-074: カタログ本文・スペックが出典と一致（出典: atwiki/page-1964「追加条件：オモテ向きの自軍パワー全てを捨札にする」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-074", TEXT);
    expectStats("XG3-074", { name: "キングダーク", category: "DA", size: "L", bp: 9000, sp: 1, powerCost: "9+", comboNumber: undefined, features: ["大ショッカー", "メカ", "人型"], rushCondition: "discard_all_face_up_power" });
    expectRarityIn("XG3-074", ["SR"]);
  });

  it("XG3-074: 追加条件 — オモテ向きの自軍パワー全てを捨札にしてラッシュできる（出典: atwiki/page-1964「追加条件：オモテ向きの自軍パワー全てを捨札にする」）", () => {
    const r = rushVia(board({ hand: [inst("XG3-074", "kd")], power: powerCards(9), command: releasedCat("DA", 1) }), "player1", "XG3-074:kd");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-074:kd")).toBe("rush");
    expect(r.state.players.player1.power).toEqual([]);
    expect(r.state.players.player1.discard).toHaveLength(9);
  });

  it("XG3-074: Q1 — オモテ向きの自軍パワーが1枚もなければ（0枚を捨札にしたとして）追加条件を満たせない（出典: atwiki/page-1964 Q1「いいえ、それはできません」）", () => {
    expect(canStartRush(board({ hand: [inst("XG3-074", "kd")], power: [faceDown("TST-UNIT-0", "d1")], command: releasedCat("DA", 1) }), "player1", "XG3-074:kd")).toBe(false);
  });

  it.fails("XG3-074:【大ショッカーの巨大幹部】— 自軍 L ユニットがいなければ、手札のこれで発動でき、山札の上7枚を捨札にしてからラッシュエリアに出せる（追加条件のかわり。必要パワーは要る）（既知の不具合: CARD-XG3-074【大ショッカーの巨大幹部】の手がない）（出典: atwiki/page-1964「自軍山札の上から7枚を捨札にしてから、これをラッシュエリアに出してもよい。ただし、必要パワーは満たす事」）", () => {
    const s0 = board({ hand: [inst("XG3-074", "kd")], power: [faceDown("TST-UNIT-0", "d0"), ...powerCards(8)], command: releasedCat("DA", 1), deck: deckCards(10) });
    const s = resolveAll(useRef(s0, "XG3-074:kd"), ["confirm"]);
    expect(zoneOf(s, "player1", "XG3-074:kd")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(s.players.player1.power).toHaveLength(9);
  });

  it("XG3-074:【大ショッカーの巨大幹部】— 自軍 L ユニットがいれば発動できない（出典: atwiki/page-1964「自軍Lユニットが1体もなければ」）", () => {
    const s = board({ hand: [inst("XG3-074", "kd")], rush: [inst("SPEC-L", "l")], power: [faceDown("TST-UNIT-0", "d0"), ...powerCards(8)], command: releasedCat("DA", 1), deck: deckCards(10) });
    expect(refsOf(s, "XG3-074:kd").filter((a) => a.type !== "initiate_command_payment" && a.type !== "begin_zord_setup")).toEqual([]);
  });
});

// ===========================================================================
describe("XG3-075 仮面ライダーディケイドCFジャンボフォーメーション", () => {
  const TEXT =
    "合体―仮面ライダーディケイド＋仮面ライダーJジャンボフォーメーション ※ブラスト 【ファイナルカメンアタックフォームライド】自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーから、RCを持ち特徴「仮面ライダー」を持つカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたカードのRCの効果を、このユニットの効果として発動する。";

  it("XG3-075: カタログ本文・スペックが出典と一致（出典: atwiki/page-1965「追加条件：自軍合体ユニットを捨札にする」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-075", TEXT);
    expectUnitStats("XG3-075", { name: "仮面ライダーディケイドCFジャンボフォーメーション", category: ["MA", "OT"], size: "L", bp: 9000, sp: 1, powerCost: "7+", comboNumber: undefined, features: ["仮面ライダー", "男", "人型", "ディケイドライバー"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG3-075", ["SR"]);
  });

  it("XG3-075: 合体 — 自軍の「仮面ライダーディケイド」（XG3-068）と「仮面ライダーJジャンボフォーメーション」（XG3-073）を捨札にしてラッシュできる（出典: atwiki/page-1965「合体―仮面ライダーディケイド＋仮面ライダーJジャンボフォーメーション」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG3-075", "cf")], rush: [inst("XG3-068", "d"), inst("XG3-073", "j")], power: powerCards(7), command: [...releasedCat("MA", 1), ...releasedCat("OT", 1)] }), "player1", "XG3-075:cf");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-075:cf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-068:d")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG3-073:j")).toBe("discard");
  });

  it.fails("XG3-075:【ファイナルカメンアタックフォームライド】— 自軍ターン中にバトルエリアに出たとき、オモテ向きの自軍パワーの、RC を持つ「仮面ライダー」のカードを選べる（RC のないカードは選べない。任意）（既知の不具合: CARD-XG3-075 選択が開かない）（出典: atwiki/page-1965「オモテ向きの自軍パワーから、RCを持ち特徴「仮面ライダー」を持つカードを1枚選び捨札にしてもよい」）", () => {
    const s = enterAny(battle({ rush: [inst("XG3-075", "cf")], command: releasedCat("MA", 1), power: [faceUp("XG3-048", "rx"), faceUp("XG3-068", "d"), faceDown("XG3-044", "st")] }, { battle: [inst("TST-UNIT-0", "e0")] }), "XG3-075:cf");
    expectChoiceFrom(s, "player1", "XG3-075");
    expect(choiceIds(s)).toEqual(["XG3-048:rx"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG3-075:【ファイナルカメンアタックフォームライド】— 捨札にしたカードの RC の効果（XG3-048【リボルクラッシュ】）を、このユニットの効果として発動する（既知の不具合: CARD-XG3-075）（出典: atwiki/page-1965「捨札にしたカードのRCの効果を、このユニットの効果として発動する」）", () => {
    const s0 = enterAny(battle({ rush: [inst("XG3-075", "cf")], command: releasedCat("MA", 1), power: [faceUp("XG3-048", "rx")] }, { battle: [inst("TST-UNIT-0", "e0")] }), "XG3-075:cf");
    const s = resolveAll(s0, ["XG3-048:rx", "TST-UNIT-0:e0"]);
    expect(zoneOf(s, "player1", "XG3-048:rx")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("power");
  });
});

// ===========================================================================
describe("XG3-076 仮面ライダーアギト", () => {
  const TEXT = "※レジスト 【覚醒】これをラッシュしたとき、特徴「男」を持つ自軍Sユニットを1体選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+3000され、「SP1」になる。";

  it("XG3-076: カタログ本文・スペックが出典と一致（出典: atwiki/page-1933「SP：！」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-076", TEXT);
    expectStats("XG3-076", { name: "仮面ライダーアギト", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "賢者の石"] });
    expectRarityIn("XG3-076", ["N"]);
  });

  resistTests("XG3-076", "atwiki/page-1933");

  const rushed = () =>
    rushFromHand(board({ hand: [inst("XG3-076", "ag")], rush: [inst("SPEC-MAN-S", "m"), inst("SPEC-WOMAN-S", "w")], power: powerCards(4), command: releasedCat("MA", 1) }), "player1", "XG3-076:ag").state;

  it.fails("XG3-076:【覚醒】— ラッシュしたとき、特徴「男」を持つ自軍 S ユニット（これ自身は含まない）から選べる（任意）（既知の不具合: CARD-XG3-076【覚醒】の選択が開かない）（出典: atwiki/page-1933「特徴「男」を持つ自軍Sユニットを1体選び捨札にしてもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG3-076");
    expect(choiceIds(s)).toEqual(["SPEC-MAN-S:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG3-076:【覚醒】— 捨札にすれば、このターンこれは BP+3000（6000）・「SP1」（既知の不具合: CARD-XG3-076 BP も SP も変わらない）（出典: atwiki/page-1933「このターン、これは次の能力を得る⇒BP+3000され、「SP1」になる」）", () => {
    const s = resolveAll(rushed(), ["SPEC-MAN-S:m"]);
    expect(zoneOf(s, "player1", "SPEC-MAN-S:m")).toBe("discard");
    expect(bpOf(s, "player1", "XG3-076:ag")).toBe(6000);
    expect(spOf(s, "player1", "XG3-076:ag")).toBe(1);
  });

  it("XG3-076:【覚醒】— 捨札にしなければ BP3000・SP なしのまま（出典: atwiki/page-1933「そうしたとき」）", () => {
    let s = rushed();
    if (s.pendingEffectChoice?.sourceCardId === "XG3-076") s = skip(s);
    expect(bpOf(s, "player1", "XG3-076:ag")).toBe(3000);
    expect(spOf(s, "player1", "XG3-076:ag")).toBe(0);
  });
});
