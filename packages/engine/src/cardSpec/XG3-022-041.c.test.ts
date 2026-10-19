/**
 * カード別スペック: XG3-036〜XG3-041（クロスギャザー ザ・Wインパクト ダイカイオーヒガシ〜仮面ライダーディケイドCF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-036 Q1（page-1873）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-MORPH 系・R-KW-RESIST-01・R-KW-TAKUS-01・R-CN-02・R-CAT-02）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  bpOf,
  canCounter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  choiceOf,
  deckCards,
  enemyRushes,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  inst,
  lineUp,
  morphCandidates,
  pickAs,
  powerCards,
  releasedCat,
  resistTests,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushKeepReaction,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  useCounter,
  zoneOf,
} from "./XG3-022-041.helpers";

const SAM = sUnit("SPEC-SAM", { category: "MA", bp: 3000, sp: undefined, features: ["侍"] });
const ENEMY = sUnit("SPEC-EN", { category: "WB", bp: 1000 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000 });
const E5500 = sUnit("SPEC-E5500", { bp: 5500 });
const S_ATTACKER = sUnit("SPEC-S-ATK", { category: "MA", bp: 9000 });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000, sp: undefined });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000, sp: undefined });
const OT_M = sUnit("SPEC-OT-M", { category: "OT", bp: 3000, size: "M", sp: undefined });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_WB_S = sUnit("SPEC-DA-WB-S", { category: ["DA", "WB"] as never, bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M" });
const DCD = sUnit("SPEC-DCD", { category: "OT", bp: 1000, features: ["仮面ライダー", "ディケイドライバー"] });
const EXTRA = [SAM, ENEMY, E5000, E5500, S_ATTACKER, OT_S, WB_S, OT_M, DA_S, DA_WB_S, DA_M, DCD];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-036 ダイカイオーヒガシ", () => {
  const TEXT = "※モーフ 【海老ばさみ本手返し】これをラッシュしたとき、そのターン中、これは、BP+3000される。";

  it("XG3-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-1873「追加条件：自軍「海老折神」1体を捨札にする」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-036", TEXT);
    expectStats("XG3-036", { name: "ダイカイオーヒガシ", category: "MA", size: "L", bp: 7000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["侍", "人型", "電子モヂカラ"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG3-036", ["R"]);
  });

  const mk = (rush = [inst("XG3-035", "e")], p2: P2 = {}) => board({ hand: [inst("XG3-036", "h")], rush, power: powerCards(5), command: releasedCat("MA", 1) }, p2);

  it("XG3-036: 追加条件 — 自軍「海老折神」（XG3-035）1体を捨札にしてラッシュできる。いなければラッシュできない（出典: atwiki/page-1873「追加条件：自軍「海老折神」1体を捨札にする」）", () => {
    expect(canStartRush(mk([inst("SPEC-SAM", "s")]), "player1", "XG3-036:h")).toBe(false);
    const r = rushFromHand(mk(), "player1", "XG3-036:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-036:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-035:e")).toBe("discard");
  });

  it("XG3-036:【海老ばさみ本手返し】— ラッシュしたとき、そのターン中これは BP+3000（10000）（出典: atwiki/page-1873「そのターン中、これは、BP+3000される」・カード評価「ラッシュしたターンはBPが10000まで上昇」）", () => {
    const r = rushFromHand(mk(), "player1", "XG3-036:h");
    expect(bpOf(r.state, "player1", "XG3-036:h")).toBe(10000);
  });

  it("XG3-036:【海老ばさみ本手返し】— ラッシュしていない（エリアにいるだけの）これは BP7000（出典: atwiki/page-1873「これをラッシュしたとき」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-036", "h")] }), "player1", "XG3-036:h")).toBe(7000);
  });

  it("XG3-036: Q1 — ラッシュされた時点では BP8000 以下なので、相手は「疾風流超忍法」（RS-247。Q1 の RS-026 と同じ本文）を使え、これは山札の上に戻る（出典: atwiki/page-1873 Q1「ＢＰ８０００以下であり、…発動することができます」「山札の上に戻ります」）", () => {
    const s0 = rushKeepReaction(mk([inst("XG3-035", "e")], { hand: [inst("RS-247", "c")], command: releasedCat("MA", 1), power: powerCards(3, "ep") }), "player1", "XG3-036:h");
    expect(canCounter(s0, "RS-247:c", "player2")).toBe(true);
    const s = settle(useCounter(s0, "RS-247:c", "player2"));
    expect(s.players.player1.deck[0]?.instanceId).toBe("XG3-036:h");
  });

  it("XG3-036: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍ゾーンのユニットカード（イカダイカイオー・ほかのダイカイオーヒガシ）と置き換えられる（出典: atwiki/page-1873「※モーフ」「（モーフできるユニット）イカダイカイオー」・R-KW-MORPH 系）", () => {
    const s = enemyRushes({ battle: [inst("XG3-036", "a")], command: [inst("XG3-038", "z"), inst("XG3-036", "b"), inst("XG3-037", "k")] }, "SPEC-EN:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["XG3-036:b", "XG3-038:z"]);
  });

  it("XG3-036: ※モーフ — モーフで出たダイカイオーヒガシも「ラッシュしたとき」が発動し、BP+3000（10000）になる（出典: atwiki/page-1873 カード評価「エリアとゾーンそれぞれにこのカードがあれば、モーフを使うことで効果を何回も発動することができる」）", () => {
    let s = enemyRushes({ battle: [inst("XG3-036", "a")], command: [inst("XG3-036", "b")] }, "SPEC-EN:e", EXTRA);
    s = settle(pickAs(s, "player1", "XG3-036:b"));
    expect(zoneOf(s, "player1", "XG3-036:b")).toBe("battle");
    expect(zoneOf(s, "player1", "XG3-036:a")).toBe("command");
    expect(bpOf(s, "player1", "XG3-036:b")).toBe(10000);
  });
});

// ===========================================================================
describe("XG3-037 烏賊折神", () => {
  const TEXT =
    "【烏賊墨砲】これをラッシュしたとき、テキストに「アタックされない」と書かれた敵軍ユニットを1体選んでもよい。そうしたとき、このターン、そのユニットの持つ「アタックされない」という記述のあるテキストは無効になる。";

  it("XG3-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-1909「追加条件：特徴「侍」を持つ自軍ユニットがある」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-037", TEXT);
    expectStats("XG3-037", { name: "烏賊折神", category: "MA", size: "M", bp: 4000, sp: undefined, powerCost: "2+", comboNumber: undefined, features: ["獣", "折神獣"], rushCondition: "state_gate" });
    expectRarityIn("XG3-037", ["N"]);
  });

  const rushOf = (rush = [inst("SPEC-SAM", "s")]) =>
    rushFromHand(board({ hand: [inst("XG3-037", "i")], rush, power: powerCards(2), command: releasedCat("MA", 1) }, { battle: [inst("XG3-018", "sb"), inst("TST-UNIT-0", "x")] }), "player1", "XG3-037:i");

  it("XG3-037: 追加条件 — 特徴「侍」を持つ自軍ユニットがあればラッシュできる（捨札にしない）。なければラッシュできない（出典: atwiki/page-1909「追加条件：特徴「侍」を持つ自軍ユニットがある」）", () => {
    expect(rushOf([inst("TST-UNIT-0", "n")]).ok).toBe(false);
    const r = rushOf();
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-SAM:s")).toBe("rush");
  });

  it.fails("XG3-037:【烏賊墨砲】— ラッシュしたとき、テキストに「アタックされない」と書かれた敵軍ユニット（XG3-018 スピンビー）を選べる（書かれていないユニットは選べない。任意）（既知の不具合: CARD-XG3-037【烏賊墨砲】の選択が開かない）（出典: atwiki/page-1909「テキストに「アタックされない」と書かれた敵軍ユニットを1体選んでもよい」）", () => {
    const r = rushOf();
    expectChoiceFrom(r.state, "player1", "XG3-037");
    expect(choiceIds(r.state)).toEqual(["XG3-018:sb"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it.fails("XG3-037:【烏賊墨砲】— 選んだユニットの「アタックされない」テキストはこのターン無効になり、S ユニットでもスピンビーにアタックできる（既知の不具合: CARD-XG3-037）（出典: atwiki/page-1909「このターン、そのユニットの持つ「アタックされない」という記述のあるテキストは無効になる」・カード評価「他のユニットでもアタックできる」）", () => {
    let s = resolveAll(rushOf().state, ["XG3-018:sb"]);
    s = { ...s, phase: "battle", players: { ...s.players, player1: { ...s.players.player1, battle: [inst("SPEC-S-ATK", "atk")] } } };
    expect(targetsOf(s, "SPEC-S-ATK:atk")).toContain("XG3-018:sb");
  });

  it("XG3-037:【烏賊墨砲】— 選ばなければスピンビーの「Sユニットにアタックされない」はそのまま（出典: atwiki/page-1909「選んでもよい。そうしたとき」・XG3-018 本文「※これはSユニットにアタックされない」）", () => {
    let s = rushOf().state;
    if (s.pendingEffectChoice?.sourceCardId === "XG3-037") s = skip(s);
    s = { ...s, phase: "battle", players: { ...s.players, player1: { ...s.players.player1, battle: [inst("SPEC-S-ATK", "atk")] } } };
    expect(targetsOf(s, "SPEC-S-ATK:atk")).not.toContain("XG3-018:sb");
  });
});

// ===========================================================================
describe("XG3-038 イカダイカイオー", () => {
  const TEXT =
    "合体―ダイカイオーヒガシ+烏賊折神 【槍烏賊突貫】これをラッシュしたとき、BP5000以下の敵軍ユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、相手は自分自身の手札を1枚選び捨札にする。";

  it("XG3-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-1881「追加条件：自軍合体ユニットを捨札にする」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-038", TEXT);
    expectStats("XG3-038", { name: "イカダイカイオー", category: "MA", size: "L", bp: 10000, sp: 1, powerCost: "7+", comboNumber: undefined, features: ["侍", "人型", "電子モヂカラ"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG3-038", ["SR"]);
  });

  const enemy = (): P2 => ({ battle: [inst("SPEC-E5000", "e5"), inst("SPEC-E5500", "e55")], rush: [inst("TST-UNIT-2", "m")], hand: [inst("TST-OP", "eh1"), inst("TST-OP", "eh2")] });
  const rushOf = (rush = [inst("XG3-036", "h"), inst("XG3-037", "k")], p2 = enemy()) =>
    rushFromHand(board({ hand: [inst("XG3-038", "i")], rush, power: powerCards(7), command: releasedCat("MA", 1) }, p2), "player1", "XG3-038:i");

  it("XG3-038: 合体 — 自軍の「ダイカイオーヒガシ」と「烏賊折神」を捨札にしてラッシュできる。片方だけならラッシュできない（出典: atwiki/page-1881「合体―ダイカイオーヒガシ+烏賊折神」）", () => {
    const r = rushOf();
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-038:i")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-036:h")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG3-037:k")).toBe("discard");
    expect(canStartRush(board({ hand: [inst("XG3-038", "i")], rush: [inst("XG3-036", "h")], power: powerCards(7), command: releasedCat("MA", 1) }), "player1", "XG3-038:i")).toBe(false);
  });

  it.fails("XG3-038:【槍烏賊突貫】— ラッシュしたとき、BP5000 以下の敵軍ユニット（エリアを問わない）から選べる（BP5500 は選べない。任意）（既知の不具合: CARD-XG3-038 候補に BP5000 を超えるユニットも入る）（出典: atwiki/page-1881「BP5000以下の敵軍ユニットを1体選び、持ち主の手札に戻してもよい」）", () => {
    const r = rushOf();
    expectChoiceFrom(r.state, "player1", "XG3-038");
    expect(choiceIds(r.state).sort()).toEqual(["SPEC-E5000:e5", "TST-UNIT-2:m"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it.fails("XG3-038:【槍烏賊突貫】— 選んだユニットを持ち主の手札に戻し、相手は自分の手札を1枚選び捨札にする（既知の不具合: CARD-XG3-038 相手が手札を捨札にしない）（出典: atwiki/page-1881「そうしたとき、相手は自分自身の手札を1枚選び捨札にする」）", () => {
    let s = resolveAll(rushOf().state, ["SPEC-E5000:e5"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:e5")).toBe("hand");
    expect(choiceOf(s, "player2", "XG3-038")).toBe(true);
    expect(choiceIds(s).sort()).toEqual(["SPEC-E5000:e5", "TST-OP:eh1", "TST-OP:eh2"]);
    s = resolveAll(s, ["TST-OP:eh1"]);
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("discard");
    expect(s.players.player2.hand).toHaveLength(2);
  });

  it("XG3-038:【槍烏賊突貫】— 戻さなければ、相手は手札を捨札にしない（出典: atwiki/page-1881「そうしたとき」）", () => {
    let s = rushOf().state;
    if (s.pendingEffectChoice?.sourceCardId === "XG3-038") s = skip(s);
    expect(zoneOf(s, "player2", "SPEC-E5000:e5")).toBe("battle");
    expect(s.players.player2.hand).toHaveLength(2);
  });
});

// ===========================================================================
describe("XG3-039 ダイゴヨウ", () => {
  const TEXT =
    "【秘伝ディスク乱れ撃ち】これをラッシュしたとき、自分の手札からオペレーションカードを1枚選び捨札にしてもよい。そうしたとき、相手は自分自身の手札を1枚選び山札に戻してシャッフルする。";

  it("XG3-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-1910「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-039", TEXT);
    expectStats("XG3-039", { name: "ダイゴヨウ", category: "MA", size: "L", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["人型", "電子モヂカラ"] });
    expectRarityIn("XG3-039", ["NR"]);
  });

  const rushOf = (hand = [inst("TST-OP", "op"), inst("TST-UNIT-0", "un")]) =>
    rushFromHand(board({ hand: [inst("XG3-039", "d"), ...hand], power: powerCards(4), command: releasedCat("MA", 1) }, { hand: [inst("TST-UNIT-0", "eh")] }), "player1", "XG3-039:d");

  it.fails("XG3-039:【秘伝ディスク乱れ撃ち】— ラッシュしたとき、自分の手札のオペレーションカードから選べる（ユニットカードは選べない。任意）（既知の不具合: CARD-XG3-039【秘伝ディスク乱れ撃ち】の選択が開かない）（出典: atwiki/page-1910「自分の手札からオペレーションカードを1枚選び捨札にしてもよい」）", () => {
    const r = rushOf();
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG3-039");
    expect(choiceIds(r.state)).toEqual(["TST-OP:op"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it.fails("XG3-039:【秘伝ディスク乱れ撃ち】— 捨札にしたとき、相手は自分の手札を1枚選び山札に戻す（既知の不具合: CARD-XG3-039）（出典: atwiki/page-1910「相手は自分自身の手札を1枚選び山札に戻してシャッフルする」）", () => {
    const s = resolveAll(rushOf().state, ["TST-OP:op", "TST-UNIT-0:eh"]);
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eh")).toBe("deck");
    expect(s.players.player2.deck).toHaveLength(6);
  });

  it("XG3-039:【秘伝ディスク乱れ撃ち】— 手札にオペレーションカードがなければ、相手の手札はそのまま（出典: atwiki/page-1910「そうしたとき」）", () => {
    let s = rushOf([inst("TST-UNIT-0", "un")]).state;
    if (s.pendingEffectChoice?.sourceCardId === "XG3-039") s = skip(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eh")).toBe("hand");
  });
});

// ===========================================================================
describe("XG3-040 シンケンレッド", () => {
  const TEXT = "※レジスト ※タクスOT 【シンケンマル】 カテゴリにDAを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG3-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-2006「CN：4」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-040", TEXT);
    expectStats("XG3-040", { name: "シンケンレッド", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: 4, features: ["レッド", "男", "侍"] });
    expectRarityIn("XG3-040", ["R"]);
  });

  resistTests("XG3-040", "atwiki/page-2006");

  it("XG3-040: ※タクスOT — これがバトルエリアの3番目にある間、次に並ぶ OT の S ユニット（SP なし）は「SP1」を得る。これ自身は SP なし（出典: atwiki/page-2006「※タクスOT」・R-KW-TAKUS-01「OT=3」）", () => {
    const s = line(["TST-UNIT-0:a", "TST-UNIT-0:b", "XG3-040:r", "SPEC-OT-S:o"]);
    expect(spOf(s, "player1", "SPEC-OT-S:o")).toBe(1);
    expect(spOf(s, "player1", "XG3-040:r")).toBe(0);
  });

  it("XG3-040: ※タクスOT — 次に並ぶのが OT でない S ユニットや OT の M ユニットなら SP を得ない（出典: R-KW-TAKUS-01「これの次に並ぶ○○を持つSユニット」）", () => {
    expect(spOf(line(["TST-UNIT-0:a", "TST-UNIT-0:b", "XG3-040:r", "SPEC-WB-S:w"]), "player1", "SPEC-WB-S:w")).toBe(0);
    expect(spOf(line(["TST-UNIT-0:a", "TST-UNIT-0:b", "XG3-040:r", "SPEC-OT-M:m"]), "player1", "SPEC-OT-M:m")).toBe(0);
  });

  it("XG3-040: ※タクスOT — これが3番目以外（2番目）にいれば、次の OT の S ユニットは SP を得ない（出典: R-KW-TAKUS-01「これがバトルエリアの○番目にある間」）", () => {
    expect(spOf(line(["TST-UNIT-0:a", "XG3-040:r", "SPEC-OT-S:o"]), "player1", "SPEC-OT-S:o")).toBe(0);
  });

  const nc = () =>
    line(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c", "XG3-040:r"], {}, {
      rush: [inst("SPEC-DA-S", "d"), inst("SPEC-DA-M", "dm")],
      battle: [inst("SPEC-DA-WB-S", "dw"), inst("TST-UNIT-0", "w")],
    });

  it.fails("XG3-040:【シンケンマル】— 4番目に出れば（NC）、カテゴリに DA を持つ敵軍 S ユニット（マルチカテゴリも含む。エリアを問わない）から1体選ぶ（DA でない・M ユニットは選べない。見送れない）（既知の不具合: CARD-XG3-040 候補に DA を持たないユニットも入る）（出典: atwiki/page-2006「カテゴリにDAを持つ敵軍Sユニットを1体選び」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-040");
    expect(choiceIds(s).sort()).toEqual(["SPEC-DA-S:d", "SPEC-DA-WB-S:dw"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG3-040:【シンケンマル】— 選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（既知の不具合: CARD-XG3-040 パワーゾーンにオモテ向きで置き、ダメージにならない）（出典: atwiki/page-2006「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(nc(), ["SPEC-DA-S:d"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:d")).toBe("power");
    expect(s.players.player2.damage).toBe(1);
    expect(cardIn(s, "player2", "SPEC-DA-S:d")?.faceDown).toBe(true);
  });
});

// ===========================================================================
describe("XG3-041 仮面ライダーディケイドCF", () => {
  const TEXT =
    "※レジスト 【通りすがりの仮面ライダー】このターン中にＮＣまたはRCの効果を発動した、カテゴリにDA以外を持つSユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションするユニットのNCまたはRCの効果を、このユニットの効果として発動する。";

  it("XG3-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-2007「追加条件：特徴「ディケイドライバー」を持つ自軍ユニット1体をパワーゾーンに送る」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-041", TEXT);
    expectStats("XG3-041", { name: "仮面ライダーディケイドCF", category: "OT", size: "S", bp: 6000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["仮面ライダー", "男", "ディケイドライバー"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG3-041", ["R"]);
  });

  resistTests("XG3-041", "atwiki/page-2007");

  const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-041", "d")], rush, power: powerCards(4), command: releasedCat("OT", 1) });

  it("XG3-041: 追加条件 — 特徴「ディケイドライバー」を持つ自軍ユニット1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-2007「追加条件：特徴「ディケイドライバー」を持つ自軍ユニット1体をパワーゾーンに送る」）", () => {
    const r = rushFromHand(mk([inst("SPEC-DCD", "x")]), "player1", "XG3-041:d");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-041:d")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-DCD:x")).toBe("power");
  });

  it.fails("XG3-041: 追加条件 — 「ディケイドライバー」を持たない自軍ユニット（XG2-001 ファイブレッド）しかいなければラッシュできない（既知の不具合: CARD-XG3-041 特徴を問わず S ユニットを送ってラッシュできる）（出典: atwiki/page-2007「特徴「ディケイドライバー」を持つ自軍ユニット1体」）", () => {
    expect(rushFromHand(mk([inst("XG2-001", "x")]), "player1", "XG3-041:d").ok).toBe(false);
  });

  it.fails("XG3-041:【通りすがりの仮面ライダー】— このターン NC を発動した DA 以外の S ユニット（XG3-022 アバレッド【アバレイザー】「SP1」）の次に出たとき、その NC をこのユニットの効果として発動でき、これが「SP1」になる（既知の不具合: CARD-XG3-041 コピーの選択が開かない）（出典: atwiki/page-2007「コンビネーションするユニットのNCまたはRCの効果を、このユニットの効果として発動する」・カード評価「戦隊ユニットなどのＮＣでSPを得る能力とあわせると簡単にSPを得られる」）", () => {
    const s = resolveAll(line(["TST-UNIT-0:a", "XG3-022:ab", "XG3-041:d"]), ["XG3-022:ab", "confirm"]);
    expect(spOf(s, "player1", "XG3-041:d")).toBe(1);
  });

  it("XG3-041:【通りすがりの仮面ライダー】— 前のユニットが NC を発動していなければ何もしない（SP なしのまま）（出典: atwiki/page-2007「このターン中にＮＣまたはRCの効果を発動した」）", () => {
    const s = resolveAll(line(["TST-UNIT-0:a", "XG3-041:d"]));
    expect(spOf(s, "player1", "XG3-041:d")).toBe(0);
  });
});
