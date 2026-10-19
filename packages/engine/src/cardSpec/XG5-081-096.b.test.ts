/**
 * カード別スペック: XG5-087〜XG5-091（クロスギャザー XG5 ザ・チケットブレイカー グランナスカ・カノンフォーメーション〜キカイダー01）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: なし
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02・R-KW-RC-01）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  damageOf,
  deckCards,
  endPhase,
  enemyAttacks,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectRarityIn,
  faceUp,
  inst,
  pick,
  powerCards,
  rcOff,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  skipFrom,
  spOf,
  st,
  sUnit,
  withBp,
  zoneOf,
  zordDownTests,
} from "./XG5-081-096.helpers";

const OT_SP = sUnit("SPEC-OT", { category: "OT", bp: 3000, sp: 1 });
const OT_NOSP = sUnit("SPEC-OT0", { category: "OT", bp: 3000, sp: undefined });
const WB3 = sUnit("SPEC-WB3", { category: "WB", bp: 3000 });
const E2 = sUnit("SPEC-E2", { category: "WB", bp: 2000 });
const E3 = sUnit("SPEC-E3", { category: "WB", bp: 3000 });
const E4 = sUnit("SPEC-E4", { category: "WB", bp: 4000 });
const ATK = sUnit("SPEC-ATK", { category: "WB", bp: 9000 });
const SP_M = sUnit("SPEC-M", { category: "WB", bp: 1000, size: "M" });
const MAN = sUnit("SPEC-MAN", { category: "WB", bp: 1000, features: ["男"] });
const WOMAN = sUnit("SPEC-WOMAN", { category: "WB", bp: 1000, features: ["女"] });
const MECHA = sUnit("SPEC-MECHA", { category: "WB", bp: 1000, features: ["メカ"] });
const DA = sUnit("SPEC-DA", { category: "DA", bp: 1000 });
const MECHA_M = sUnit("SPEC-MECHA-M", { category: "WB", bp: 1000, size: "M", features: ["メカ"] });
const EXTRA = [OT_SP, OT_NOSP, WB3, E2, E3, E4, ATK, SP_M, MAN, WOMAN, MECHA, DA, MECHA_M];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-087 グランナスカ・カノンフォーメーション", () => {
  const TEXT =
    "※これはバトルエリアに出られない。 【ビッグバンカノン】これが自軍エリアにある間、自軍バトルフェイズ終了時、自軍バトルエリアからOTを持つSユニットを1体選んでもよい。そうしたとき、選んだ自軍ユニットのBP以下のBPを持つ敵軍ユニットを1体選び撃破する。その後、選んだ自軍ユニットのSPが1以上だったなら、相手に1点ダメージを与える。";

  it("XG5-087: カタログ本文・スペックが出典と一致（出典: atwiki/page-2276）", () => {
    expectCatalogText("XG5-087", TEXT);
    expectMultiStats("XG5-087", { name: "グランナスカ・カノンフォーメーション", category: ["OT"], size: "XL", bp: 13000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["メカ"], rushCondition: "discard_name_contains_unit" });
    expectRarityIn("XG5-087", ["R"]);
  });

  it("XG5-087: 追加条件 — カード名に「グランナスカ」を含む自軍ユニット（XG5-085）1体を捨札にし、パワー6でラッシュできる（出典: atwiki/page-2276「追加条件：カード名に「グランナスカ」を含む自軍ユニット1体を捨札にする」・R-ADD-02）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG5-087", "cn")], rush: [inst("XG5-085", "gn")], power: powerCards(6), command: releasedCat("OT", 1) }), "player1", "XG5-087:cn", { materials: ["XG5-085:gn"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-087:cn")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-085:gn")).toBe("discard");
  });

  it("XG5-087: 追加条件 —「グランナスカ」を含むユニットがいなければ、パワー6でもラッシュできない（出典: atwiki/page-2276「必要パワー：6+」「追加条件」・R-ADD-02）", () => {
    expect(canStartRush(rushBoard({ hand: [inst("XG5-087", "cn")], rush: [inst("TST-UNIT-0", "u")], power: powerCards(6), command: releasedCat("OT", 1) }), "player1", "XG5-087:cn")).toBe(false);
  });

  it("XG5-087: ※ — これはバトルエリアに出られない（出典: atwiki/page-2276「※これはバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG5-087", "cn")] }), "XG5-087:cn")).toBe(false);
  });

  /** 自軍ラッシュエリアに XG5-087、自軍バトルエリアに own。敵軍バトルエリアに TST-UNIT-0（1000）・SPEC-E3（3000）・SPEC-E4（4000）。自軍バトルフェイズを終える。 */
  const ended = (own = "SPEC-OT") =>
    endPhase(battle({ rush: [inst("XG5-087", "cn")], battle: [inst(own, "o"), inst("SPEC-WB3", "w")] }, { battle: [inst("TST-UNIT-0", "e1"), inst("SPEC-E3", "e3"), inst("SPEC-E4", "e4")] }));

  it.fails("XG5-087:【ビッグバンカノン】— 自軍バトルフェイズ終了時、自軍バトルエリアの OT を持つ S ユニットを選べる（OT 以外は選べない。任意） 既知の不具合: CARD-XG5-087 自軍バトルフェイズ終了時に【ビッグバンカノン】が発動しない（出典: atwiki/page-2276「自軍バトルエリアからOTを持つSユニットを1体選んでもよい」）", () => {
    const s = ended();
    expectChoiceFrom(s, "player1", "XG5-087");
    expect(choiceIds(s)).toEqual(["SPEC-OT:o"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-087:【ビッグバンカノン】— 選んだユニットの BP（3000）以下の敵軍ユニットを選び撃破する 既知の不具合: CARD-XG5-087 【ビッグバンカノン】が発動せず敵軍ユニットを撃破できない（出典: atwiki/page-2276「選んだ自軍ユニットのBP以下のBPを持つ敵軍ユニットを1体選び撃破する」）", () => {
    const s = pick(ended(), "SPEC-OT:o");
    expectChoiceFrom(s, "player1", "XG5-087");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-E3:e3", "TST-UNIT-0:e1"]);
    const t = resolveAll(pick(s, "SPEC-E3:e3"));
    expect(zoneOf(t, "player2", "SPEC-E3:e3")).toBe("discard");
  });

  it.fails("XG5-087:【ビッグバンカノン】— 選んだ自軍ユニットが SP1 以上なら相手に1点ダメージ、SP がなければダメージなし 既知の不具合: CARD-XG5-087 【ビッグバンカノン】が発動せずダメージを与えない（出典: atwiki/page-2276「選んだ自軍ユニットのSPが1以上だったなら、相手に1点ダメージを与える」）", () => {
    const withSp = resolveAll(pick(pick(ended("SPEC-OT"), "SPEC-OT:o"), "TST-UNIT-0:e1"));
    expect(damageOf(withSp, "player2")).toBe(1);
    const noSp = resolveAll(pick(pick(ended("SPEC-OT0"), "SPEC-OT0:o"), "TST-UNIT-0:e1"));
    expect(zoneOf(noSp, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(damageOf(noSp, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG5-088 カバドス", () => {
  const TEXT = "【力まかせ】これがバトルするとき、そのバトルは本来のBPで行う。";

  it("XG5-088: カタログ本文・スペックが出典と一致（出典: atwiki/page-2221）", () => {
    expectCatalogText("XG5-088", TEXT);
    expectMultiStats("XG5-088", { name: "カバドス", category: ["ET"], size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["メカ"] });
    expectRarityIn("XG5-088", ["N"]);
  });

  it.fails("XG5-088:【力まかせ】— これの BP が下がっていても（3000→500）、本来の BP 3000 で BP2000 の敵軍ユニットとバトルして勝つ 既知の不具合: CARD-XG5-088 バトルが修正後の BP で行われる（出典: atwiki/page-2221「そのバトルは本来のBPで行う」・カード評価「自分のBPも本来の数値で行う」）", () => {
    let s = battle({ battle: [withBp(inst("XG5-088", "kb"), -2500)] }, { battle: [inst("SPEC-E2", "e")] });
    expect(bpOf(s, "player1", "XG5-088:kb")).toBe(500);
    s = resolveAll(attack(s, "XG5-088:kb", "SPEC-E2:e"));
    expect(zoneOf(s, "player2", "SPEC-E2:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-088:kb")).toBe("battle");
  });

  it.fails("XG5-088:【力まかせ】— 相手の BP が上がっていても（1000→4000）、相手も本来の BP 1000 でバトルし、これが勝つ 既知の不具合: CARD-XG5-088 相手の BP の修正がバトルに使われる（出典: atwiki/page-2221「そのバトルは本来のBPで行う」・カード評価「BPを上昇させる能力を持つユニットに強い」）", () => {
    let s = battle({ battle: [inst("XG5-088", "kb")] }, { battle: [withBp(inst("TST-UNIT-0", "e"), 3000)] });
    expect(bpOf(s, "player2", "TST-UNIT-0:e")).toBe(4000);
    s = resolveAll(attack(s, "XG5-088:kb", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-088:kb")).toBe("battle");
  });

  it.fails("XG5-088:【力まかせ】— 敵軍ターンにアタックされたときも本来の BP で行う（BP2000+2000 のアタッカーに勝つ） 既知の不具合: CARD-XG5-088 アタックされたバトルでも修正後の BP が使われる（出典: atwiki/page-2221「これがバトルするとき」）", () => {
    const s = resolveAll(enemyAttacks({ battle: [inst("XG5-088", "kb")] }, withBp(inst("SPEC-E2", "atk"), 2000), "XG5-088:kb", EXTRA));
    expect(zoneOf(s, "player2", "SPEC-E2:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-088:kb")).toBe("battle");
  });
});

// ===========================================================================
describe("XG5-089 カバドスSM", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「カバドス」のカードを1枚選び、自軍ラッシュエリアに出す。 【マサカリホーク】自軍ターン中、このユニットはBP+3000される。";

  it("XG5-089: カタログ本文・スペックが出典と一致（出典: atwiki/page-2222）", () => {
    expectCatalogText("XG5-089", TEXT);
    expectMultiStats("XG5-089", { name: "カバドスSM", category: ["ET"], size: "S", bp: 4500, sp: undefined, powerCost: "7-", comboNumber: undefined, features: ["メカ", "人型", "スペシャルモード"], rushCondition: "zord_down_send_to_command_or_discard" });
    expectRarityIn("XG5-089", ["N"]);
  });

  zordDownTests("XG5-089", "XG5-088", "カバドス", "atwiki/page-2222", "ET");

  it("XG5-089: 追加条件 —「カバドス」をコマンドゾーンに送っても必要パワー0でラッシュできる（出典: atwiki/page-2222「コマンドゾーンに送るか捨札にすれば必要パワー0になる」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-089", "sm")], rush: [inst("XG5-088", "p")], command: releasedCat("ET", 1), power: [] });
    const r = rushVia(s0, "player1", "XG5-089:sm", (a) => a.zordMaterialInstanceId === "XG5-088:p" && a.zordMaterialDestination === "command");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-089:sm")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-088:p")).toBe("command");
  });

  it.fails("XG5-089:【マサカリホーク】— 自軍ターン中は BP+3000（7500）、敵軍ターン中は 4500 既知の不具合: CARD-XG5-089 自軍ターン中も BP+3000 されない（出典: atwiki/page-2222「自軍ターン中、このユニットはBP+3000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG5-089", "sm")] }), "player1", "XG5-089:sm")).toBe(7500);
    const e = st({ activePlayer: "player2", player1: { battle: [inst("XG5-089", "sm")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } });
    expect(bpOf(e, "player1", "XG5-089:sm")).toBe(4500);
  });

  /** 敵軍ターン、BP9000 にアタックされて撃破される。自軍コマンドゾーンと捨札に「カバドス」が1枚ずつ。 */
  const destroyed = () =>
    resolveAll(enemyAttacks({ battle: [inst("XG5-089", "sm")], command: [released("XG5-088", "c")], discard: [inst("XG5-088", "d")] }, inst("SPEC-ATK", "atk"), "XG5-089:sm", EXTRA));

  it.fails("XG5-089: ※ — 撃破されて捨札になったとき、自軍コマンドゾーンか捨札の「カバドス」を1枚選ぶ（見送れない） 既知の不具合: CARD-XG5-089 選ばせずに自軍捨札の「カバドス」を出す（出典: atwiki/page-2222「自軍コマンドゾーンか自軍捨札から「カバドス」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = destroyed();
    expect(zoneOf(s, "player1", "XG5-089:sm")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG5-089");
    expect([...choiceIds(s)].sort()).toEqual(["XG5-088:c", "XG5-088:d"]);
    expect(s.pendingEffectChoice?.optional ?? false).toBe(false);
  });

  it("XG5-089: ※ — 自軍捨札の「カバドス」1枚だけなら、それが自軍ラッシュエリアに出る（出典: atwiki/page-2222「自軍コマンドゾーンか自軍捨札から「カバドス」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(enemyAttacks({ battle: [inst("XG5-089", "sm")], discard: [inst("XG5-088", "d")] }, inst("SPEC-ATK", "atk"), "XG5-089:sm", EXTRA));
    expect(zoneOf(s, "player1", "XG5-089:sm")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-088:d")).toBe("rush");
  });

  it.fails("XG5-089: ※ — 選んだ「カバドス」は自軍ラッシュエリアに出る 既知の不具合: CARD-XG5-089 コマンドゾーンの「カバドス」を選べない（出典: atwiki/page-2222「自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(pick(destroyed(), "XG5-088:c"));
    expect(zoneOf(s, "player1", "XG5-088:c")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-088:d")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-090 クワジーロ", () => {
  const TEXT = "【友情】自軍ターン中、このユニットは、これ以外の自軍バトルエリアのSユニット1体につきBP+2000される。";

  it("XG5-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-2223）", () => {
    expectCatalogText("XG5-090", TEXT);
    expectMultiStats("XG5-090", { name: "クワジーロ", category: ["ET"], size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["メカ"] });
    expectRarityIn("XG5-090", ["N"]);
  });

  const board = { battle: [inst("XG5-090", "kw"), inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("SPEC-M", "m")], rush: [inst("TST-UNIT-0", "r")] };

  it.fails("XG5-090:【友情】— 自軍ターン中、これ以外の自軍バトルエリアの S ユニット2体で BP+4000（M ユニット・ラッシュエリアのユニットは数えない） 既知の不具合: CARD-XG5-090 BP が上がらない（出典: atwiki/page-2223「これ以外の自軍バトルエリアのSユニット1体につきBP+2000される」）", () => {
    expect(bpOf(battle(board), "player1", "XG5-090:kw")).toBe(4500);
  });

  it("XG5-090:【友情】— 敵軍ターン中は上がらない（出典: atwiki/page-2223「自軍ターン中」）", () => {
    const e = st({ activePlayer: "player2", player1: { ...board, deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, EXTRA);
    expect(bpOf(e, "player1", "XG5-090:kw")).toBe(500);
  });
});

// ===========================================================================
describe("XG5-091 キカイダー01", () => {
  const TEXT =
    "※これは特徴「男」または「女」を持つユニットにアタックすることができない。 ※これは自軍パワーゾーンにオモテ向きのカードが1枚もなければBP-5000される。 【ブラストエンド】SP1特徴「メカ」を持つかカテゴリにDAを持つ敵軍Sユニットを1体選び撃破してもよい。そうしたとき、このターン、これはストライクすることができない。";

  it("XG5-091: カタログ本文・スペックが出典と一致（出典: atwiki/page-2238）", () => {
    expectCatalogText("XG5-091", TEXT);
    expectMultiStats("XG5-091", { name: "キカイダー01", category: ["ET"], size: "S", bp: 6000, sp: "special", powerCost: 4, comboNumber: "RC", features: ["メカ", "人型"] });
    expectRarityIn("XG5-091", ["SR"]);
  });

  const UP = [faceUp("TST-UNIT-0", "up")];

  it.fails("XG5-091: ※ — 特徴「男」「女」を持つユニットにはアタックできない 既知の不具合: CARD-XG5-091 「男」「女」を持つユニットにアタックできてしまう（出典: atwiki/page-2238「特徴「男」または「女」を持つユニットにアタックすることができない」）", () => {
    const s = enter(battle({ rush: [inst("XG5-091", "01")], power: UP }, { battle: [inst("SPEC-MAN", "man"), inst("SPEC-WOMAN", "wo"), inst("TST-UNIT-0", "n")] }), "XG5-091:01");
    expect(attackTargets(s, "XG5-091:01")).toEqual(["TST-UNIT-0:n"]);
  });

  it("XG5-091: ※ — 自軍パワーゾーンにオモテ向きのカードがあれば BP6000（出典: atwiki/page-2238「オモテ向きのカードが1枚もなければBP-5000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG5-091", "01")], power: [...UP, ...powerCards(2)] }), "player1", "XG5-091:01")).toBe(6000);
  });

  it.fails("XG5-091: ※ — 自軍パワーゾーンがウラ向きのカードだけなら BP-5000（1000） 既知の不具合: CARD-XG5-091 オモテ向きのカードがなくても BP-5000 されない（出典: atwiki/page-2238「自軍パワーゾーンにオモテ向きのカードが1枚もなければBP-5000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG5-091", "01")], power: powerCards(3) }), "player1", "XG5-091:01")).toBe(1000);
  });

  /** XG5-080 マシンディケイダーにライドしてライドオフ（RC）。敵軍: メカ S・DA S・どちらでもない S・メカ M。 */
  const rc = () =>
    rcOff(
      battle({ rush: [inst("XG5-080", "md"), inst("XG5-091", "01")], power: UP }, { battle: [inst("SPEC-MECHA", "me"), inst("SPEC-DA", "da"), inst("TST-UNIT-0", "n"), inst("SPEC-MECHA-M", "mm")] }),
      "XG5-091:01",
      "XG5-080:md",
    );

  it.fails("XG5-091: RC【ブラストエンド】— 特徴「メカ」を持つか DA を持つ敵軍 S ユニットを選べる（M ユニット・どちらも持たないユニットは選べない。任意） 既知の不具合: CARD-XG5-091 「メカ」も DA も持たないユニットも選ばされ、見送れない（出典: atwiki/page-2238「特徴「メカ」を持つかカテゴリにDAを持つ敵軍Sユニットを1体選び撃破してもよい」・R-KW-RC-01）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG5-091");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-DA:da", "SPEC-MECHA:me"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-091: RC【ブラストエンド】— 撃破したとき、このターンこれはストライクできない（出典: atwiki/page-2238「そうしたとき、このターン、これはストライクすることができない」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-MECHA:me"));
    expect(zoneOf(s, "player2", "SPEC-MECHA:me")).toBe("discard");
    expect(canStrike(s, "XG5-091:01")).toBe(false);
  });

  it.fails("XG5-091: RC【ブラストエンド】— SP1 を得る。撃破しなければストライクできる 既知の不具合: CARD-XG5-091 RC で SP1 を得ず、撃破を見送れない（出典: atwiki/page-2238「SP：！」「【ブラストエンド】SP1」・カード評価「ライドオフをする事でフリーストライカーになれる」）", () => {
    const s = resolveAll(skipFrom(rc(), "XG5-091"));
    expect(spOf(s, "player1", "XG5-091:01")).toBe(1);
    expect(canStrike(s, "XG5-091:01")).toBe(true);
  });
});
