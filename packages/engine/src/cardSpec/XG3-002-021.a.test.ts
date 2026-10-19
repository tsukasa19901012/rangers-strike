/**
 * カード別スペック: XG3-002〜XG3-008（クロスギャザー ザ・Wインパクト ラジエッカー〜ライナーボーイ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG3-」とカード名で検索:
 *     本範囲のカードの項はない（XG のカードは公式 FAQ のページがない）。atwiki に転載された公式 Q&A: XG3-002 Q1〜Q3（atwiki/page-1885）、
 *     XG3-006 Q1〜Q4（atwiki/page-1888。Q4 は atwiki/page-1689 XG2-030 のライブ写し pages/1689.txt にもある）、XG3-007 Q1（atwiki/page-1889）、
 *     XG3-008 Q1（atwiki/page-2013）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-REPL-04 置き換え・R-KW-BLAST-01・R-KW-WING-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attackersOf,
  bpOf,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageCards,
  deckCards,
  endTurn,
  endTurnKeep,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  inst,
  mountedOn,
  pick,
  played,
  powerCards,
  refsOf,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  spOf,
  st,
  strike,
  sUnit,
  useRef,
  zoneOf,
} from "./XG3-002-021.helpers";

const OT_S2 = sUnit("SPEC-OT-S2", { category: "OT", bp: 1000, powerCost: 2 });
const OT_S9 = sUnit("SPEC-OT-S9", { category: "OT", bp: 1000, powerCost: 9 });
const OT_M2 = sUnit("SPEC-OT-M2", { category: "OT", bp: 3000, size: "M", powerCost: 2 });
const ET_S2 = sUnit("SPEC-ET-S2", { category: "ET", bp: 1000, powerCost: 2 });
const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 2000, features: ["怪人"] });
const KAIJIN_M = sUnit("SPEC-KAIJIN-M", { category: "DA", bp: 3000, size: "M", features: ["怪人"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "DA", bp: 2000, features: ["男"] });
const L13 = sUnit("SPEC-L13", { category: "ET", bp: 13000, size: "L" });
const HUMAN_L = sUnit("SPEC-HUMAN-L", { category: "WB", bp: 13000, size: "L", features: ["人型"] });
const HUMAN_XL = sUnit("SPEC-HUMAN-XL", { category: "WB", bp: 20000, size: "XL" as never, features: ["人型"] });
const NOHUMAN_XL = sUnit("SPEC-NOHUMAN-XL", { category: "WB", bp: 20000, size: "XL" as never, features: ["メカ"] });
const EXTRA = [OT_S2, OT_S9, OT_M2, ET_S2, KAIJIN, KAIJIN_M, PLAIN, L13, HUMAN_L, HUMAN_XL, NOHUMAN_XL];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG3-002 ラジエッカー", () => {
  const TEXT =
    "【宇宙を走る車】 これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、次の効果を発動できる⇒自軍パワーゾーンのオモテ向きのカードから、必要パワーを満たしているOTのSユニットのカードを1枚選び、これの上に重ねて自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。";
  /** 自軍パワーゾーン: ラジエッカー（オモテ）・OT S（必要パワー2）・OT S（9）・OT M（2）・ET S（2）・ウラ向きの OT S・パワーカード2枚（計8枚）。 */
  const POWER = () => [
    faceUp("XG3-002", "v"),
    faceUp("SPEC-OT-S2", "s"),
    faceUp("SPEC-OT-S9", "s9"),
    faceUp("SPEC-OT-M2", "m"),
    faceUp("SPEC-ET-S2", "et"),
    faceDown("SPEC-OT-S2", "dn"),
    ...powerCards(2),
  ];

  it("XG3-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-1885）", () => {
    expectCatalogText("XG3-002", TEXT);
    expectVehicleStats("XG3-002", { name: "ラジエッカー", category: "OT", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG3-002", ["N"]);
  });

  it("XG3-002:【宇宙を走る車】— 自軍パワーゾーンでオモテ向きなら、自軍ラッシュフェイズ中に発動できる（出典: atwiki/page-1885「これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、次の効果を発動できる」）", () => {
    expect(refsOf(board({ power: POWER() }), "XG3-002:v")).not.toEqual([]);
  });

  it("XG3-002:【宇宙を走る車】— ウラ向き（ダメージ）のとき・自軍バトルフェイズ中は発動できない（出典: atwiki/page-1885「オモテ向きになっている間、自軍ラッシュフェイズ中」）", () => {
    const down = [faceDown("XG3-002", "v"), faceUp("SPEC-OT-S2", "s"), ...powerCards(4)];
    expect(refsOf(board({ power: down }), "XG3-002:v")).toEqual([]);
    expect(refsOf(battle({ power: POWER() }), "XG3-002:v")).toEqual([]);
  });

  it("XG3-002:【宇宙を走る車】— 選べるのは自軍パワーゾーンのオモテ向きの、必要パワーを満たしている OT の S ユニットのカードだけ（M・ET・必要パワー9・ウラ向きは選べない。任意）（出典: atwiki/page-1885「必要パワーを満たしているOTのSユニットのカードを1枚選び、…出してもよい」）", () => {
    const s = useRef(board({ power: POWER() }), "XG3-002:v");
    expectChoiceFrom(s, "player1", "XG3-002");
    expect(choiceIds(s)).toEqual(["SPEC-OT-S2:s"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-002:【宇宙を走る車】— ラジエッカーを自軍ラッシュエリアに出し、選んだユニットをその上に重ねて（ライドした状態で）出す（出典: atwiki/page-1885「これの上に重ねて自軍ラッシュエリアに出してもよい」・Q2「まず…ラジエッカーを自軍ラッシュエリアに出してから、…その上に重ねて出す」・カード評価「これを重ねた状態でラッシュされる」）", () => {
    const s = resolveAll(pick(useRef(board({ power: POWER() }), "XG3-002:v"), "SPEC-OT-S2:s"));
    expect(zoneOf(s, "player1", "XG3-002:v")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-OT-S2:s")).toBe("rush");
    expect(mountedOn(s, "player1", "SPEC-OT-S2:s")).toBe("XG3-002:v");
  });

  it("XG3-002: 公式Q&A — 自軍エリアに「RS-106 デカレッド」があれば、それを捨札にして（追加条件）パワーゾーンの「RS-345 デカレッドSWAT」を出せる（出典: atwiki/page-1885 Q1「はい、「RS-106 デカレッド」を捨札にすることで、ラッシュエリアに出すことができます」）", () => {
    let s = board({ power: [faceUp("XG3-002", "v"), faceUp("RS-345", "sw"), ...powerCards(4)], rush: [inst("RS-106", "dr")] });
    s = resolveAll(pick(useRef(s, "XG3-002:v"), "RS-345:sw"), ["RS-106:dr"]);
    expect(zoneOf(s, "player1", "RS-345:sw")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-106:dr")).toBe("discard");
  });

  it("XG3-002: 公式Q&A — パワーゾーンの「XG3-003 ラジエッカーロボ」を、先に出たこのラジエッカーを捨札にして（追加条件）出せる（出典: atwiki/page-1885 Q3「はい、できます」）", () => {
    let s = board({ power: [faceUp("XG3-002", "v"), faceUp("XG3-003", "rb"), ...powerCards(3)] });
    s = resolveAll(pick(useRef(s, "XG3-002:v"), "XG3-003:rb"), ["XG3-002:v"]);
    expect(zoneOf(s, "player1", "XG3-003:rb")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-002:v")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-003 ラジエッカーロボ", () => {
  const TEXT =
    "※自分か相手のLユニットがあれば、これはLユニットになり、BP+3000される。 【チーキュでは1分間しかもたない】これが自軍エリアにある間、自分がターンを終えるとき、自軍捨札の「ラジエッカー」のカードとこれを置き換える。置き換えられなければこれを捨札にする。";

  it("XG3-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-1886）", () => {
    expectCatalogText("XG3-003", TEXT);
    expectStats("XG3-003", { name: "ラジエッカーロボ", category: "OT", size: "S", bp: 5000, sp: "1/4", powerCost: "3+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG3-003", ["N"]);
  });

  it("XG3-003: 追加条件 — 自軍「ラジエッカー」1体を捨札にしてラッシュできる。いなければラッシュできない（出典: atwiki/page-1886「追加条件：自軍「ラジエッカー」1体を捨札にする」）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-003", "r")], rush, power: powerCards(3), command: releasedCat("OT", 1) });
    expect(canStartRush(mk([]), "player1", "XG3-003:r")).toBe(false);
    const r = rushFromHand(mk([inst("XG3-002", "v")]), "player1", "XG3-003:r");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-003:r")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-002:v")).toBe("discard");
  });

  it("XG3-003: ※ 自分か相手の L ユニットがあれば BP+3000（8000）。なければ 5000（出典: atwiki/page-1886「自分か相手のLユニットがあれば、…BP+3000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-003", "r")] }), "player1", "XG3-003:r")).toBe(5000);
    expect(bpOf(battle({ battle: [inst("XG3-003", "r")] }, { rush: [inst("SPEC-L13", "l")] }), "player1", "XG3-003:r")).toBe(8000);
    expect(bpOf(battle({ battle: [inst("XG3-003", "r")], rush: [inst("SPEC-L13", "l")] }), "player1", "XG3-003:r")).toBe(8000);
  });

  it("XG3-003: ※ L ユニットがあれば L ユニットになる — 敵軍の「Sユニットを選ぶ」効果（RS-481 天空神【ホバリング】）に選ばれない（出典: atwiki/page-1886「これはLユニットになり」）", () => {
    // 敵軍（player2）が天空神（敵軍ラッシュエリアからSユニットを1体選び、持ち主の手札に戻してもよい）をバトルエリアに出す。
    let s = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("XG3-003", "r"), inst("SPEC-L13", "l"), inst("SPEC-OT-S2", "s")], deck: deckCards(3) },
        player2: { rush: [inst("RS-481", "tk")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" });
    expect(choiceIds(s)).toEqual(["SPEC-OT-S2:s"]);
  });

  /** 自軍バトルフェイズ、これがバトルエリアにいて、自軍捨札にラジエッカーがある。 */
  const endBoard = (discard = [inst("XG3-002", "d")]) =>
    st({ player1: { battle: [inst("XG3-003", "r")], discard, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);

  it("XG3-003:【チーキュでは1分間しかもたない】— 自分がターンを終えるとき、自軍捨札の「ラジエッカー」とこれを置き換える（ラジエッカーがこれのいた場所へ、これは捨札へ）（出典: atwiki/page-1886「自分がターンを終えるとき、自軍捨札の「ラジエッカー」のカードとこれを置き換える」・R-REPL-04）", () => {
    const s = resolveAll(endTurnKeep(endBoard()), ["XG3-002:d"]);
    expect(zoneOf(s, "player1", "XG3-003:r")).toBe("discard");
    expect(zoneOf(s, "player1", "XG3-002:d")).toBe("battle");
  });

  it("XG3-003:【チーキュでは1分間しかもたない】— 自軍捨札に「ラジエッカー」がなければ、ターンを終えるときこれを捨札にする（出典: atwiki/page-1886「置き換えられなければこれを捨札にする」）", () => {
    const s = resolveAll(endTurnKeep(endBoard([])));
    expect(zoneOf(s, "player1", "XG3-003:r")).toBe("discard");
  });

  it("XG3-003:【チーキュでは1分間しかもたない】— 相手がターンを終えるときは何もしない（出典: atwiki/page-1886「自分がターンを終えるとき」）", () => {
    const s = resolveAll(
      endTurn(st({ activePlayer: "player2", player1: { rush: [inst("XG3-003", "r")], discard: [inst("XG3-002", "d")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA)),
    );
    expect(zoneOf(s, "player1", "XG3-003:r")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-002:d")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-004 芋長の芋ヨーカン", () => {
  const TEXT =
    "特徴「怪人」を持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、BP+3000され、Lユニットになる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";
  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    played(board({ hand: [inst("XG3-004", "op")], power: powerCards(3), command: releasedCat("DA", 1), ...p1 }, p2), "XG3-004:op");
  const field = () => ({ rush: [inst("SPEC-KAIJIN", "k"), inst("SPEC-KAIJIN-M", "km"), inst("SPEC-PLAIN", "p")], battle: [inst("SPEC-KAIJIN", "kb")] });

  it("XG3-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-1887）", () => {
    expectCatalogText("XG3-004", TEXT);
    expectOpStats("XG3-004", { name: "芋長の芋ヨーカン", category: "DA", powerCost: 3 });
    expectRarityIn("XG3-004", ["N"]);
  });

  it("XG3-004: 選べるのは特徴「怪人」を持つ自軍の S ユニット（ラッシュエリア・バトルエリア）だけ（M ユニット・「怪人」でないユニット・敵軍ユニットは選べない。見送れない）（出典: atwiki/page-1887「特徴「怪人」を持つ自軍Sユニットを1体選ぶ」・コメント欄「巨大化爆弾と違って怪人はＳユニット限定」）", () => {
    const s = used(field(), { rush: [inst("SPEC-KAIJIN", "e")] });
    expectChoiceFrom(s, "player1", "XG3-004");
    expect(choiceIds(s)).toEqual(["SPEC-KAIJIN:k", "SPEC-KAIJIN:kb"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG3-004: このカードは自軍ラッシュエリアに置かれ（捨札にならない）、選んだユニットはこのカードに重なって BP+3000 される（出典: atwiki/page-1887「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、BP+3000され」）", () => {
    const s = resolveAll(used(field()), ["SPEC-KAIJIN:k"]);
    expect(zoneOf(s, "player1", "XG3-004:op")).not.toBe("discard");
    expect(bpOf(s, "player1", "SPEC-KAIJIN:k")).toBe(5000);
  });

  it("XG3-004: 重ねたユニットは L ユニットになる — 敵軍の「Sユニットを選ぶ」効果（RS-481 天空神【ホバリング】）に選ばれない（出典: atwiki/page-1887「Lユニットになる」・カード評価「何かと除去されやすい怪人たちの守りを固める」）", () => {
    let s = resolveAll(used({ rush: [inst("SPEC-KAIJIN", "k"), inst("SPEC-PLAIN", "p")] }, { rush: [inst("RS-481", "tk")] }), ["SPEC-KAIJIN:k"]);
    s = endTurn(s);
    s = act({ ...s, phase: "battle" }, { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" });
    expect(choiceIds(s)).toEqual(["SPEC-PLAIN:p"]);
  });

  it("XG3-004: 重ねたユニットが撃破されてユニットでなくなるとき、このカードは捨札になる（出典: atwiki/page-1887「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = resolveAll(used({ battle: [inst("SPEC-KAIJIN", "k")] }), ["SPEC-KAIJIN:k"]);
    expect(zoneOf(s, "player1", "XG3-004:op")).not.toBe("discard");
    s = endTurn(s);
    s = settle(act({ ...s, phase: "battle", players: { ...s.players, player2: { ...s.players.player2, battle: [inst("TST-UNIT-7", "big")] } } }, { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-7:big", defenderInstanceId: "SPEC-KAIJIN:k" }));
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:k")).toBe("discard");
    expect(zoneOf(s, "player1", "XG3-004:op")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-005 マックスビクトリーロボ", () => {
  const TEXT =
    "合体―ビクトリーロボ（またはレッドラダー＋ブルースローワー＋グリーンホバー＋イエローアーマー＋ピンクエイダー）＋ライナーボーイ（またはマックスライナー） ※ブラスト 【マックスノバ】このユニットは、自軍捨札6枚につき「SP+1」される。";

  it("XG3-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-2000）", () => {
    expectCatalogText("XG3-005", TEXT);
    expectStats("XG3-005", { name: "マックスビクトリーロボ", category: "ET", size: "L", bp: 17000, sp: 1, powerCost: "7+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG3-005", ["R"]);
  });

  const rushBoardOf = (rush: ReturnType<typeof inst>[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    board({ hand: [inst("XG3-005", "mv")], rush, power: powerCards(7), command: releasedCat("ET", 1), ...p1 });

  it("XG3-005: 合体 — 自軍「ビクトリーロボ」と「マックスライナー」を捨札にしてラッシュできる（出典: atwiki/page-2000「合体―ビクトリーロボ…＋ライナーボーイ（またはマックスライナー）」）", () => {
    const r = rushFromHand(rushBoardOf([inst("RS-382", "vr"), inst("XG3-007", "ml")]), "player1", "XG3-005:mv", { materials: ["RS-382:vr", "XG3-007:ml"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-005:mv")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-382:vr")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG3-007:ml")).toBe("discard");
  });

  it("XG3-005: 合体 — 「ビクトリーロボ」がいても「ライナーボーイ」「マックスライナー」がいなければラッシュできない（出典: atwiki/page-2000）", () => {
    expect(canStartRush(rushBoardOf([inst("RS-382", "vr")]), "player1", "XG3-005:mv")).toBe(false);
  });

  it("XG3-005: 合体 — 「ビクトリーロボ」のかわりにレッドラダー・グリーンホバー・ビクトリーウォーカー（「ブルースローワー＋イエローアーマー＋ピンクエイダー」としてつかえる）で合体できる（出典: atwiki/page-2000・atwiki/page-1888 カード評価「イエローアーマー、ピンクエイダー、ブルースローワー3体分の合体パーツになる」）", () => {
    const r = rushFromHand(
      rushBoardOf([inst("RS-383", "rl"), inst("RS-385", "gh"), inst("XG3-006", "vw"), inst("XG3-008", "lb")]),
      "player1",
      "XG3-005:mv",
      { materials: ["RS-383:rl", "RS-385:gh", "XG3-006:vw", "XG3-008:lb"] },
    );
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-005:mv")).toBe("rush");
  });

  it("XG3-005: ※ブラスト — 自分のダメージが6点で自軍 L ユニットがなければ、合体ユニットがなくても（追加条件を満たさずに）ラッシュできる（出典: atwiki/page-2000「※ブラスト」・R-KW-BLAST-01）", () => {
    const s = rushBoardOf([], { power: [...powerCards(7), ...damageCards(6)], damage: 6 });
    expect(canStartRush(s, "player1", "XG3-005:mv")).toBe(true);
    expect(canStartRush(rushBoardOf([], { power: [...powerCards(7), ...damageCards(5)], damage: 5 }), "player1", "XG3-005:mv")).toBe(false);
  });

  it("XG3-005:【マックスノバ】— 自軍捨札6枚につき SP+1（5枚で SP1、6枚で SP2、12枚で SP3）（出典: atwiki/page-2000「自軍捨札6枚につき「SP+1」される」）", () => {
    const sp = (n: number) => spOf(battle({ battle: [inst("XG3-005", "mv")], discard: deckCards(n, "dd") }), "player1", "XG3-005:mv");
    expect(sp(5)).toBe(1);
    expect(sp(6)).toBe(2);
    expect(sp(11)).toBe(2);
    expect(sp(12)).toBe(3);
  });

  it("XG3-005:【マックスノバ】— 数えるのは自軍捨札だけ（敵軍捨札は数えない）（出典: atwiki/page-2000「自軍捨札6枚につき」）", () => {
    expect(spOf(battle({ battle: [inst("XG3-005", "mv")] }, { discard: deckCards(12, "ed") }), "player1", "XG3-005:mv")).toBe(1);
  });
});

// ===========================================================================
describe("XG3-006 ビクトリーウォーカー", () => {
  const TEXT =
    "※これは「ブルースローワー＋イエローアーマー＋ピンクエイダー」としてつかえる。 【ケミカルディスチャージャー】これが自軍エリアにある間、敵軍ターン中、オモテ向きの自軍パワーがウラ向きになるとき、ETの自軍コマンドを2つ選びホールドしてもよい。そうしたとき、そのダメージは無効になる。";

  it("XG3-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-1888）", () => {
    expectCatalogText("XG3-006", TEXT);
    expectStats("XG3-006", { name: "ビクトリーウォーカー", category: "ET", size: "L", bp: 8000, sp: undefined, powerCost: "7+", comboNumber: undefined, features: ["メカ"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG3-006", ["N"]);
  });

  it("XG3-006: 追加条件 — 自軍 S ユニット3体をそれぞれコマンドゾーンか捨札に送ってラッシュできる。2体ではラッシュできない（出典: atwiki/page-1888「追加条件：自軍Sユニット3体をそれぞれコマンドゾーンに送るか捨札にする」）", () => {
    const mk = (n: number) =>
      board({ hand: [inst("XG3-006", "vw")], rush: Array.from({ length: n }, (_, i) => inst("SPEC-OT-S2", `u${i}`)), power: powerCards(7), command: releasedCat("ET", 1) });
    expect(canStartRush(mk(2), "player1", "XG3-006:vw")).toBe(false);
    const r = rushFromHand(mk(3), "player1", "XG3-006:vw");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-006:vw")).toBe("rush");
    expect(r.state.players.player1.rush.map((c) => c.instanceId)).toEqual(["XG3-006:vw"]);
  });

  it("XG3-006: 公式Q&A — 自軍エリアのレッドラダー・グリーンホバー・ビクトリーウォーカーの3体を捨札にして「RS-382 ビクトリーロボ」をラッシュできる（出典: atwiki/page-1888 Q1「はい、できます」）", () => {
    const s = board({ hand: [inst("RS-382", "vr")], rush: [inst("RS-383", "rl"), inst("RS-385", "gh"), inst("XG3-006", "vw")], power: powerCards(7), command: releasedCat("ET", 1) });
    const r = rushFromHand(s, "player1", "RS-382:vr", { materials: ["RS-383:rl", "RS-385:gh", "XG3-006:vw"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-382:vr")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-006:vw")).toBe("discard");
  });

  /** 敵軍（player2）ターン、player2 の SP1 のユニットがストライクし、player1 がダメージを支払うところ。 */
  const struck = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("XG3-006", "vw")], power: powerCards(3), command: releasedCat("ET", 2), deck: deckCards(3), ...p1 },
        player2: { battle: [inst("TST-UNIT-0", "a")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    return strike(s, "TST-UNIT-0:a", "player2");
  };

  it("XG3-006:【ケミカルディスチャージャー】— 敵軍ターン中、オモテ向きの自軍パワーがウラ向きになるとき、ET の自軍コマンドを2つホールドするかを選べる（任意）（出典: atwiki/page-1888「ETの自軍コマンドを2つ選びホールドしてもよい」）", () => {
    const s = settle(struck());
    expectChoiceFrom(s, "player1", "XG3-006");
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-006:【ケミカルディスチャージャー】— ホールドすれば、そのダメージは無効になる（パワーはオモテ向きのまま、ET のコマンド2つがホールド状態）（出典: atwiki/page-1888「そうしたとき、そのダメージは無効になる」・カード評価「ゴーオンブラックやデカブレイク、メディテーションによるダメージも無効化できる」）", () => {
    let s = struck();
    if (s.pendingDamagePayment) s = act(s, { type: "resolve_damage_payment", playerId: "player1", instanceId: "TST-P:pw0" } as never);
    s = resolveAll(s, ["confirm", "accept"]);
    expect(s.players.player1.damage).toBe(0);
    expect(s.players.player1.power.filter((c) => c.faceDown)).toEqual([]);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("XG3-006:【ケミカルディスチャージャー】— リリース状態の ET のコマンドが1つしかなければホールドできず、ダメージを受ける（出典: atwiki/page-1888「ETの自軍コマンドを2つ選び」）", () => {
    let s = struck({ command: releasedCat("ET", 1) });
    if (s.pendingDamagePayment) s = act(s, { type: "resolve_damage_payment", playerId: "player1", instanceId: "TST-P:pw0" } as never);
    s = resolveAll(s);
    expect(s.players.player1.damage).toBe(1);
  });
});

// ===========================================================================
describe("XG3-007 マックスライナー", () => {
  const TEXT =
    "※ウイング 【マックスシャトル】このユニットは、ホールド状態の間、次の能力を得る⇒「これはウイングを持たないユニットにアタックされない」と書かれているかのように扱い、BP-2000される。";

  it("XG3-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-1889）", () => {
    expectCatalogText("XG3-007", TEXT);
    expectStats("XG3-007", { name: "マックスライナー", category: "ET", size: "M", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["メカ", "車両", "航空機"] });
    expectRarityIn("XG3-007", ["N"]);
  });

  it("XG3-007: 公式Q&A — ウイングでホールドすると【マックスシャトル】で BP-2000（アタックする時点の BP は 2000）（出典: atwiki/page-1889 Q1「はい、その通りです」）", () => {
    let s = battle({ rush: [inst("XG3-007", "ml")] }, { battle: [inst("TST-UNIT-0", "e")] });
    expect(bpOf(s, "player1", "XG3-007:ml")).toBe(4000);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG3-007:ml" });
    expect(bpOf(s, "player1", "XG3-007:ml")).toBe(2000);
  });

  it("XG3-007:【マックスシャトル】— ホールド状態の間、ウイングを持たないユニットにアタックされない（リリース状態ならアタックされる）（出典: atwiki/page-1889「「これはウイングを持たないユニットにアタックされない」と書かれているかのように扱い」）", () => {
    const mk = (held: boolean) =>
      st({ activePlayer: "player2", player1: { battle: [{ ...inst("XG3-007", "ml"), commandHeld: held }] }, player2: { battle: [inst("TST-UNIT-0", "a")] } }, EXTRA);
    expect(attackersOf(mk(false), "XG3-007:ml")).toEqual(["TST-UNIT-0:a"]);
    expect(attackersOf(mk(true), "XG3-007:ml")).toEqual([]);
  });

  it("XG3-007:【マックスシャトル】— ホールド状態でも、ウイングを持つユニットにはアタックされる（出典: atwiki/page-1889「ウイングを持たないユニットにアタックされない」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [{ ...inst("XG3-007", "ml"), commandHeld: true }] }, player2: { battle: [inst("XG3-007", "a")] } }, EXTRA);
    expect(attackersOf(s, "XG3-007:ml")).toEqual(["XG3-007:a"]);
  });
});

// ===========================================================================
describe("XG3-008 ライナーボーイ", () => {
  const TEXT =
    "※自分が「マックスライナー」をラッシュしたとき、自軍エリアに「ライナーボーイ」があれば1体選んで手札に戻す。 【ライナーコンボ】これが特徴「人型」を持つLユニットまたはXLユニットからコンビネーションするとき、次の効果を発動できる⇒これは「SP1」になる。";

  it("XG3-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-2013「SP：！」「CN：R」）", () => {
    expectCatalogText("XG3-008", TEXT);
    expectStats("XG3-008", { name: "ライナーボーイ", category: "ET", size: "M", bp: 7000, sp: "special", powerCost: "5+", comboNumber: "R", features: ["メカ", "人型"], rushCondition: "return_named_to_hand" });
    expectRarityIn("XG3-008", ["R"]);
  });

  it("XG3-008: 追加条件 — 自軍「マックスライナー」1体を手札に戻してラッシュできる。いなければラッシュできない（出典: atwiki/page-2013「追加条件：自軍「マックスライナー」1体を手札に戻す」）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-008", "lb")], rush, power: powerCards(5), command: releasedCat("ET", 1) });
    expect(canStartRush(mk([]), "player1", "XG3-008:lb")).toBe(false);
    const r = rushVia(mk([inst("XG3-007", "ml")]), "player1", "XG3-008:lb");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-008:lb")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-007:ml")).toBe("hand");
  });

  it("XG3-008: ※ 自分が「マックスライナー」をラッシュしたとき、自軍エリアの「ライナーボーイ」を1体選んで手札に戻す（強制）（出典: atwiki/page-2013「自軍エリアに「ライナーボーイ」があれば1体選んで手札に戻す」）", () => {
    let s = board({ hand: [inst("XG3-007", "ml")], rush: [inst("XG3-008", "lb")], battle: [inst("XG3-008", "lb2")], power: powerCards(4), command: releasedCat("ET", 1) });
    const r = rushFromHand(s, "player1", "XG3-007:ml");
    expect(r.ok, r.error).toBe(true);
    s = r.state;
    expectChoiceFrom(s, "player1", "XG3-008");
    expect(choiceIds(s)).toEqual(["XG3-008:lb", "XG3-008:lb2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "XG3-008:lb2"));
    expect(zoneOf(s, "player1", "XG3-008:lb2")).toBe("hand");
    expect(zoneOf(s, "player1", "XG3-008:lb")).toBe("rush");
  });

  it("XG3-008: ※ 「マックスライナー」以外をラッシュしたときは戻さない（出典: atwiki/page-2013「「マックスライナー」をラッシュしたとき」）", () => {
    const r = rushFromHand(board({ hand: [inst("SPEC-ET-S2", "x")], rush: [inst("XG3-008", "lb")], power: powerCards(4), command: releasedCat("ET", 1) }), "player1", "SPEC-ET-S2:x");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("XG3-008");
    expect(zoneOf(resolveAll(r.state), "player1", "XG3-008:lb")).toBe("rush");
  });

  /** 自軍バトルフェイズ: left（L/XL ユニット）→ ライナーボーイ の順に出す（JC の選択は残す）。 */
  const afterL = (left: string) => {
    const [cid, suf] = left.split(":") as [string, string];
    let s = battle({ rush: [inst(cid, suf), inst("XG3-008", "lb")] });
    s = enter(s, left);
    s = act(s, { type: "pass_battle_entry", playerId: "player1" } as never);
    return enter(s, "XG3-008:lb");
  };

  it("XG3-008:【ライナーコンボ】— 特徴「人型」を持つ L ユニットからコンビネーションすれば「SP1」になる（カテゴリを問わない）（出典: atwiki/page-2013「特徴「人型」を持つLユニット…からコンビネーションするとき、…これは「SP1」になる」）", () => {
    const s = resolveAll(afterL("SPEC-HUMAN-L:L"));
    expect(spOf(s, "player1", "XG3-008:lb")).toBe(1);
  });

  it("XG3-008:【ライナーコンボ】— 特徴「人型」を持つ XL ユニットからでも「SP1」になる（出典: atwiki/page-2013「Lユニットまたは XLユニット」・Q1）", () => {
    const s = resolveAll(afterL("SPEC-HUMAN-XL:L"));
    expect(spOf(s, "player1", "XG3-008:lb")).toBe(1);
  });

  it("XG3-008: 公式Q&A — 特徴「人型」を持たない XL ユニットからコンビネーションしても発動しない（SP なし）（出典: atwiki/page-2013 Q1「いいえ、それはできません」）", () => {
    const s = resolveAll(afterL("SPEC-NOHUMAN-XL:L"));
    expect(spOf(s, "player1", "XG3-008:lb")).toBe(0);
  });
});
