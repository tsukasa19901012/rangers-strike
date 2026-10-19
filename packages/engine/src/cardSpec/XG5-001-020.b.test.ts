/**
 * カード別スペック: XG5-008〜XG5-014（クロスギャザー XG5 ザ・チケットブレイカー ゴーグルタンク〜マックスビクトリーロボBV）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG5-010 Q1・Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-READ-01・R-KW-RESIST-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackUntilRegister,
  beltUsed,
  bpOf,
  canSkip,
  choiceIds,
  commandState,
  confirm,
  damageOf,
  deckCards,
  enter,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  fill,
  heldN,
  inst,
  ncEnter,
  nextPhase,
  passEntry,
  payableFor,
  pick,
  played,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  settle,
  skip,
  spOf,
  st,
  stackedUnder,
  sUnit,
  zoneOf,
} from "./XG5-001-020.helpers";

const L_MECHA = sUnit("SPEC-L-MECHA", { category: "ET", bp: 9000, size: "L", powerCost: 5, features: ["メカ"] });
const L_PLAIN = sUnit("SPEC-L-PLAIN", { category: "ET", bp: 9000, size: "L", powerCost: 5, features: ["獣"] });
const M_PLAIN = sUnit("SPEC-M-PLAIN", { category: "ET", bp: 3000, size: "M", powerCost: 2 });
const WB_M = sUnit("SPEC-WB-M", { category: "WB", bp: 3000, size: "M", powerCost: 2 });
const WB_L = sUnit("SPEC-WB-L", { category: "WB", bp: 9000, size: "L", powerCost: 5 });
const ET_L = sUnit("SPEC-ET-L", { category: "ET", bp: 9000, size: "L", powerCost: 5 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 2000, powerCost: 2 });
const DA_S_COND = sUnit("SPEC-DA-S-COND", {
  category: "DA",
  bp: 6000,
  powerCost: "5+",
  rushAdditionalCondition: { conditionId: "send_s_unit_to_discard", text: "自軍Sユニットを1体捨札にする", unitCount: 1 },
} as never);
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M", powerCost: 2 });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const RESIST_S = sUnit("SPEC-RESIST-S", { bp: 1000, text: "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）" });
const ES = sUnit("SPEC-ES", { bp: 1000 });
const EXTRA = [L_MECHA, L_PLAIN, M_PLAIN, WB_M, WB_L, ET_L, DA_S, DA_S_COND, DA_M, WB_S, RESIST_S, ES];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncEnter(id, fillers, p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-008 ゴーグルタンク", () => {
  const TEXT = "【ゴーゴーチェンジ】自軍コマンドが4つ以下なら、次の効果を発動できる⇒自軍山札を見てLユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。その後、山札をシャッフルする。";

  it("XG5-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-2189）", () => {
    expectCatalogText("XG5-008", TEXT);
    expectStats("XG5-008", { name: "ゴーグルタンク", category: "ET", size: "M", bp: 5000, sp: undefined, powerCost: "5+", comboNumber: 2, features: ["メカ", "車両"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG5-008", ["N"]);
  });

  const DECK = () => [inst("SPEC-M-PLAIN", "m"), inst("SPEC-L-MECHA", "l1"), inst("TST-OP", "op"), inst("SPEC-L-PLAIN", "l2"), ...deckCards(2)];

  it("XG5-008: NC【ゴーゴーチェンジ】— 自軍コマンドが4つ以下なら発動できる（任意）（出典: atwiki/page-2189「自軍コマンドが4つ以下なら、次の効果を発動できる」）", () => {
    const s = nc("XG5-008:t", 1, { deck: DECK(), command: releasedCat("ET", 4) });
    expectChoiceFrom(s, "player1", "XG5-008");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-008: NC【ゴーゴーチェンジ】— 自軍山札の L ユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く（M ユニット・オペレーションは選べない）（出典: atwiki/page-2189「自軍山札を見てLユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(nc("XG5-008:t", 1, { deck: DECK() }), ["SPEC-L-PLAIN:l2"]);
    expect(zoneOf(s, "player1", "SPEC-L-PLAIN:l2")).toBe("command");
    expect(commandState(s, "player1", "SPEC-L-PLAIN:l2")).toBe("held");
    expect(zoneOf(s, "player1", "SPEC-M-PLAIN:m")).toBe("deck");
    expect(s.players.player1.deck).toHaveLength(DECK().length - 1);
  });

  it("XG5-008: NC【ゴーゴーチェンジ】— 自軍コマンドが5つなら発動しない（山札の L ユニットは動かない）（出典: atwiki/page-2189「自軍コマンドが4つ以下なら」）", () => {
    const s = resolveAll(nc("XG5-008:t", 1, { deck: DECK(), command: releasedCat("ET", 5) }), ["SPEC-L-MECHA:l1"]);
    expect(zoneOf(s, "player1", "SPEC-L-MECHA:l1")).toBe("deck");
    expect(s.players.player1.command).toHaveLength(5);
  });

  it("XG5-008: 2番目以外では発動しない（出典: atwiki/page-2189「CN：2」）", () => {
    const s = resolveAll(nc("XG5-008:t", 2, { deck: DECK() }), ["SPEC-L-MECHA:l1"]);
    expect(zoneOf(s, "player1", "SPEC-L-MECHA:l1")).toBe("deck");
  });
});

// ===========================================================================
describe("XG5-009 ゴーグルダンプ", () => {
  const TEXT =
    "【ゴーゴーチェンジ】自軍コマンドゾーンから、リリース状態の特徴「メカ」を持つLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。そうしたとき、出したユニットが「ゴーグルロボ」だったなら、相手に1点ダメージを与える。";

  it("XG5-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-2190）", () => {
    expectCatalogText("XG5-009", TEXT);
    expectStats("XG5-009", { name: "ゴーグルダンプ", category: "ET", size: "M", bp: 5000, sp: undefined, powerCost: "5+", comboNumber: 3, features: ["メカ", "車両"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG5-009", ["N"]);
  });

  const COMMAND = () => [released("SPEC-L-MECHA", "c1"), { ...inst("SPEC-L-MECHA", "c2"), commandHeld: true }, released("SPEC-L-PLAIN", "c3"), released("SPEC-M-PLAIN", "c4")];

  it("XG5-009: NC【ゴーゴーチェンジ】— 自軍コマンドゾーンの、リリース状態の特徴「メカ」を持つ L ユニットのカードから選べる（ホールド状態・「メカ」を持たない・M ユニットは選べない。任意）（出典: atwiki/page-2190「リリース状態の特徴「メカ」を持つLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = nc("XG5-009:d", 2, { command: COMMAND(), power: powerCards(5) });
    expectChoiceFrom(s, "player1", "XG5-009");
    expect(choiceIds(s)).toEqual(["SPEC-L-MECHA:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-009: NC【ゴーゴーチェンジ】— 選んだカードを自軍ラッシュエリアに出す。「ゴーグルロボ」でなければダメージは与えない（出典: atwiki/page-2190「出したユニットが「ゴーグルロボ」だったなら」）", () => {
    const s = resolveAll(nc("XG5-009:d", 2, { command: COMMAND(), power: powerCards(5) }), ["SPEC-L-MECHA:c1"]);
    expect(zoneOf(s, "player1", "SPEC-L-MECHA:c1")).toBe("rush");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG5-009: NC【ゴーゴーチェンジ】— 必要パワーを満たさなければ（パワー4で必要パワー5）出せない（出典: atwiki/page-2190「ただし、必要パワーと追加条件は満たすこと」）", () => {
    const s = resolveAll(nc("XG5-009:d", 2, { command: COMMAND(), power: powerCards(4) }), ["SPEC-L-MECHA:c1"]);
    expect(zoneOf(s, "player1", "SPEC-L-MECHA:c1")).toBe("command");
  });

  it("XG5-009: NC【ゴーゴーチェンジ】— ジェット（1番目）・タンク（2番目）・ダンプ（3番目）で、コマンドゾーンの「ゴーグルロボ」を合体（バトルエリアの3体を捨札）で出せば、相手に1点ダメージ（出典: atwiki/page-2190「出したユニットが「ゴーグルロボ」だったなら、相手に1点ダメージを与える」・カード評価「この効果で合体に使うユニットはエリアを問わない」）", () => {
    let s = battle({ rush: [inst("XG5-007", "j"), inst("XG5-008", "t"), inst("XG5-009", "d")], command: [released("XG5-006", "robo")], power: powerCards(5) });
    s = enterSeq(s, ["XG5-007:j", "XG5-008:t"]);
    s = resolveAll(enter(resolveAll(s), "XG5-009:d"), ["XG5-006:robo", "XG5-007:j", "XG5-008:t", "XG5-009:d"]);
    expect(zoneOf(s, "player1", "XG5-006:robo")).toBe("rush");
    for (const p of ["XG5-007:j", "XG5-008:t", "XG5-009:d"]) expect(zoneOf(s, "player1", p)).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG5-010 恐竜剣ゴッドホーン", () => {
  const TEXT =
    "自軍ラッシュエリアから、効果に｢ラッシュしたとき｣とあるWBのMユニットを1体選んでもよい。そうしたとき、そのラッシュしたときの効果を発動する。（これが自軍コマンドゾーンにある間、WBを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する）";

  it("XG5-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-2277）", () => {
    expectCatalogText("XG5-010", TEXT);
    expectOpStats("XG5-010", { name: "恐竜剣ゴッドホーン", category: "WB", powerCost: 3 });
    expectRarityIn("XG5-010", ["SR"]);
  });

  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => beltUsed("XG5-010", "WB", 3, p1, p2, EXTRA);
  const OWN = () => ({ rush: [inst("RS-039", "pt"), inst("SPEC-WB-M", "m"), inst("RS-305", "pd")], battle: [inst("RS-039", "pb")] });
  const ENEMY = () => ({ rush: [inst("RS-039", "ept")], command: [{ ...inst("TST-OP", "eh"), commandHeld: true }, released("TST-OP", "er")] });

  it("XG5-010: 自軍ラッシュエリアの、効果に「ラッシュしたとき」とある WB の M ユニットから選べる（「ラッシュしたとき」のない M ユニット・自軍バトルエリア・敵軍のユニットは選べない。任意）（出典: atwiki/page-2277「自軍ラッシュエリアから、効果に｢ラッシュしたとき｣とあるWBのMユニットを1体選んでもよい」）", () => {
    const s = used(OWN(), ENEMY());
    expectChoiceFrom(s, "player1", "XG5-010");
    expect(choiceIds(s)).toEqual(["RS-039:pt", "RS-305:pd"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-010: 選んだユニットの「ラッシュしたとき」の効果を発動する（RS-039 守護獣プテラノドン【プテラビーム】で敵軍コマンドゾーンのホールド状態のカードを捨札にする）（出典: atwiki/page-2277「そのラッシュしたときの効果を発動する」・atwiki/page-2277 Q2）", () => {
    const s = resolveAll(pick(used(OWN(), ENEMY()), "RS-039:pt"), ["TST-OP:eh"]);
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:er")).toBe("command");
    expect(zoneOf(s, "player1", "XG5-010:op")).toBe("discard");
  });

  it("XG5-010: 選ばなければ何も起きない（出典: atwiki/page-2277「選んでもよい」）", () => {
    const s = resolveAll(skip(used(OWN(), ENEMY())));
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("command");
  });

  /** 自軍バトルフェイズ、コマンドゾーンにゴッドホーン（リリース状態）、ラッシュエリアに unit とプテラノドン。unit をバトルエリアに出す。 */
  const lEnters = (unit: string, enemy: Partial<GameState["players"]["player2"]> = ENEMY()) => {
    const [cid, suf] = unit.split(":") as [string, string];
    const s = battle({ rush: [inst(cid, suf), inst("RS-039", "pt")], command: [released("XG5-010", "gh")] }, enemy);
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: unit });
  };

  it("XG5-010: （）— 自軍コマンドゾーンにある間、WB を持つ自軍 L ユニットがバトルエリアに出たとき、これをホールドして効果を発動できる（任意）（出典: atwiki/page-2277「これが自軍コマンドゾーンにある間、WBを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する」）", () => {
    const s = lEnters("SPEC-WB-L:l");
    expectChoiceFrom(s, "player1", "XG5-010");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-010: （）— WB を持たない L ユニットがバトルエリアに出ても発動しない（出典: atwiki/page-2277「WBを持つ自軍Lユニットが」）", () => {
    const s = lEnters("SPEC-ET-L:l");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-010");
    expect(commandState(s, "player1", "XG5-010:gh")).toBe("released");
  });

  it("XG5-010: 公式Q&A — コマンドゾーンにあるときの効果で発動しても、オペレーションカードの使用にはあたらない（RK-251 ゴルゴムの仕業で無効にできない）（出典: atwiki/page-2277 Q1）", () => {
    const enemy = () => ({ ...ENEMY(), hand: [inst("RK-251", "g")], command: [...ENEMY().command, ...releasedCat("DA", 1, "eDA")], power: powerCards(5, "epw") });
    // 対照: 手札から使えば、相手は RK-251 を使う機会がある
    expectChoiceFrom(used(OWN(), enemy()), "player2", "RK-251");
    let s = lEnters("SPEC-WB-L:l", enemy());
    expectChoiceFrom(s, "player1", "XG5-010");
    s = confirm(s);
    expectChoiceFrom(s, "player1", "XG5-010");
    s = resolveAll(pick(s, "RS-039:pt"), ["TST-OP:eh"]);
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-251:g")).toBe("hand");
  });
  it.todo(
    "XG5-010: 公式Q&A — ゴッドホーンで発動した RS-039【プテラビーム】はユニットの効果として XG7-059 トリガードーパント【ゲームスタート……】の対象になる（出典: atwiki/page-2277 Q2）— XG7-059 は本範囲外で照合がまだのため",
  );
});

// ===========================================================================
describe("XG5-011 呪士ピエール", () => {
  it("XG5-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-2191）", () => {
    expectCatalogText("XG5-011", "※リードDA");
    expectStats("XG5-011", { name: "呪士ピエール", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["災魔一族", "男"] });
    expectRarityIn("XG5-011", ["N"]);
  });

  it("XG5-011: ※リードDA — 自軍エリアのこれを、DA のオペレーションを使用するためのコマンドとしてホールドできる（出典: atwiki/page-2191「※リードDA」・R-KW-READ-01・atwiki/page-2250 Q1）", () => {
    const s = rushBoard({ hand: [inst("TST-OP-DA", "op")], rush: [inst("XG5-011", "p")], command: [released("TST-OP-DA", "rel")], power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "TST-OP-DA:op")).toContain("XG5-011:p");
  });

  it("XG5-011: ※リードDA — DA 以外（ET）のオペレーションには使えない（出典: R-KW-READ-01「○○のオペレーションカードを使用するためのコマンド」）", () => {
    const s = rushBoard({ hand: [inst("TST-OP-ET", "op")], rush: [inst("XG5-011", "p")], command: [released("TST-OP-ET", "rel")], power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "TST-OP-ET:op") ?? []).not.toContain("XG5-011:p");
  });

  it("XG5-011: ※リードDA — ユニットをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-2250 本文「オペレーション使用以外の目的ではコマンドとして使うことはできない」）", () => {
    const s = rushBoard({ hand: [inst("SPEC-DA-S", "u")], rush: [inst("XG5-011", "p")], command: [released("TST-OP-DA", "rel")], power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-DA-S:u") ?? []).not.toContain("XG5-011:p");
  });
});

// ===========================================================================
describe("XG5-012 ゴレムカード", () => {
  const TEXT =
    "自軍捨札から、追加条件を持たないDAのSユニットのカードを1枚選び、このカードに重ねて自軍ラッシュエリアに出す。このとき出したユニットの効果は発動しない。このカードに重ねたユニットはLユニットになる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  it("XG5-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-2192）", () => {
    expectCatalogText("XG5-012", TEXT);
    expectOpStats("XG5-012", { name: "ゴレムカード", category: "DA", powerCost: 5 });
    expectRarityIn("XG5-012", ["N"]);
  });

  const DISCARD = () => [inst("SPEC-DA-S", "s"), inst("RK-192", "ag"), inst("SPEC-DA-S-COND", "c"), inst("SPEC-DA-M", "m"), inst("SPEC-WB-S", "w"), inst("TST-OP-DA", "op2")];
  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    beltUsed("XG5-012", "DA", 5, { discard: DISCARD(), ...p1 }, p2, EXTRA);

  it("XG5-012: 自軍捨札の、追加条件を持たない DA の S ユニットのカードから選ぶ（追加条件を持つ・M ユニット・WB・オペレーションは選べない。見送れない）（出典: atwiki/page-2192「自軍捨札から、追加条件を持たないDAのSユニットのカードを1枚選び」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-012");
    expect(choiceIds(s)).toEqual(["RK-192:ag", "SPEC-DA-S:s"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG5-012: 選んだカードは自軍ラッシュエリアに出て、このカードはその下に重なる（捨札にならない）（出典: atwiki/page-2192「このカードに重ねて自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(pick(used(), "SPEC-DA-S:s"));
    expect(zoneOf(s, "player1", "SPEC-DA-S:s")).toBe("rush");
    expect(stackedUnder(s, "player1", "SPEC-DA-S:s")).toContain("XG5-012:op");
    expect(zoneOf(s, "player1", "XG5-012:op")).toBeNull();
  });

  it("XG5-012: このとき出したユニットの「ラッシュしたとき」の効果は発動しない（RK-192 アギト【アギトファング】）（出典: atwiki/page-2192「このとき出したユニットの効果は発動しない」）", () => {
    const s = pick(used({}, { rush: [inst("SPEC-RESIST-S", "er")] }), "RK-192:ag");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-192");
    expect(zoneOf(s, "player1", "RK-192:ag")).toBe("rush");
  });

  it("XG5-012: 重ねたユニットは L ユニットになる（BK-004 コンドラーの「自軍Sユニットを1体選ぶ」で選べない）（出典: atwiki/page-2192「このカードに重ねたユニットはLユニットになる」）", () => {
    let s = resolveAll(pick(used({ rush: [inst("SPEC-WB-S", "other")], hand: [inst("BK-004", "op")], command: releasedCat("WB", 1, "w") }), "SPEC-DA-S:s"));
    s = played(s, "BK-004:op");
    expectChoiceFrom(s, "player1", "BK-004");
    expect(choiceIds(s)).toEqual(["SPEC-WB-S:other"]);
  });

  it("XG5-012: 重ねたユニットがバトルで撃破されてユニットでなくなるとき、このカードは捨札になる（出典: atwiki/page-2192「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = resolveAll(pick(used({}, { battle: [inst("TST-UNIT-7", "big")] }), "SPEC-DA-S:s"));
    s = nextPhase(s);
    s = enter(s, "SPEC-DA-S:s");
    s = resolveAll(attack(s, "SPEC-DA-S:s", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-DA-S:s")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-012:op")).toBe("discard");
  });

  it("XG5-012: 自軍捨札に選べるカードがなければ何もしない（このカードは捨札）（出典: atwiki/page-2192）", () => {
    const s = resolveAll(used({ discard: [inst("SPEC-DA-M", "m")] }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "XG5-012:op")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-013 再生カード", () => {
  const TEXT = "自軍捨札から、DAを持つカードを1枚選び手札に加える。";

  it("XG5-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-2169）", () => {
    expectCatalogText("XG5-013", TEXT);
    expectOpStats("XG5-013", { name: "再生カード", category: "DA", powerCost: 5 });
    expectRarityIn("XG5-013", ["NR"]);
  });

  const DISCARD = () => [inst("SPEC-DA-S", "s"), inst("TST-OP-DA", "op2"), inst("XG2-095", "multi"), inst("SPEC-WB-S", "w"), inst("TST-OP", "wop")];
  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    beltUsed("XG5-013", "DA", 5, { discard: DISCARD(), ...p1 }, p2, EXTRA);

  it("XG5-013: 自軍捨札の DA を持つカード（ユニット・オペレーション・マルチカテゴリ）から選ぶ（DA を持たないカード・敵軍の捨札は選べない。見送れない）（出典: atwiki/page-2169「自軍捨札から、DAを持つカードを1枚選び」）", () => {
    const s = used({}, { discard: [inst("SPEC-DA-S", "es")] });
    expectChoiceFrom(s, "player1", "XG5-013");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:s", "TST-OP-DA:op2", "XG2-095:multi"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG5-013: 選んだカードを手札に加える（出典: atwiki/page-2169「手札に加える」）", () => {
    const s = resolveAll(pick(used(), "TST-OP-DA:op2"));
    expect(zoneOf(s, "player1", "TST-OP-DA:op2")).toBe("hand");
    expect(zoneOf(s, "player1", "XG5-013:op")).toBe("discard");
  });

  it("XG5-013: 自軍捨札に DA を持つカードがなければ何もしない（出典: atwiki/page-2169）", () => {
    const s = resolveAll(used({ discard: [inst("SPEC-WB-S", "w")] }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-014 マックスビクトリーロボBV", () => {
  const TEXT = "※レジスト ※自軍捨札にSユニットのカードが1枚もなければ、これは「SP1」になる。 【マックスビクトリープロミネンス】このユニットは自軍ターン中、自軍ラッシュエリアのSユニット1体につきBP+1000される。";

  it("XG5-014: カタログ本文・スペックが出典と一致（カード名はページ名の「マックスビクトリーロボBV」。「（ブラックバージョン）」は読みの補足とした）（出典: atwiki/page-2268）", () => {
    expectCatalogText("XG5-014", TEXT);
    expectStats("XG5-014", { name: "マックスビクトリーロボBV", category: "ET", size: "L", bp: 8000, sp: "special", powerCost: "6+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG5-014", ["SR"]);
  });

  it("XG5-014: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2268「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-014", "bv")] }, "XG5-014:bv"))).toBe(true);
  });

  it("XG5-014: ※ — 自軍捨札に S ユニットのカードが1枚もなければ「SP1」（M ユニット・オペレーションのカードはあってよい。敵軍の捨札は数えない）（出典: atwiki/page-2268「自軍捨札にSユニットのカードが1枚もなければ、これは「SP1」になる」）", () => {
    expect(spOf(battle({ battle: [inst("XG5-014", "bv")] }), "player1", "XG5-014:bv")).toBe(1);
    const s = battle({ battle: [inst("XG5-014", "bv")], discard: [inst("SPEC-M-PLAIN", "m"), inst("TST-OP", "o")] }, { discard: [inst("SPEC-WB-S", "es")] });
    expect(spOf(s, "player1", "XG5-014:bv")).toBe(1);
  });

  it("XG5-014: ※ — 自軍捨札に S ユニットのカードがあれば SP を持たない（出典: atwiki/page-2268）", () => {
    expect(spOf(battle({ battle: [inst("XG5-014", "bv")], discard: [inst("SPEC-WB-S", "w")] }), "player1", "XG5-014:bv")).toBe(0);
  });

  it("XG5-014: 【マックスビクトリープロミネンス】— 自軍ターン中、自軍ラッシュエリアの S ユニット1体につき BP+1000（M ユニット・敵軍のユニットは数えない）（出典: atwiki/page-2268「自軍ターン中、自軍ラッシュエリアのSユニット1体につきBP+1000される」）", () => {
    const s = battle({ battle: [inst("XG5-014", "bv")], rush: [inst("SPEC-WB-S", "a"), inst("SPEC-DA-S", "b"), inst("SPEC-M-PLAIN", "m")] }, { rush: [inst("SPEC-ES", "e")] });
    expect(bpOf(s, "player1", "XG5-014:bv")).toBe(10000);
  });

  it("XG5-014: 【マックスビクトリープロミネンス】— 敵軍ターン中は上がらない（出典: atwiki/page-2268「自軍ターン中」・カード評価「敵軍ターン中は除去に引っ掛かりうるBP」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG5-014", "bv")], rush: [inst("SPEC-WB-S", "a"), inst("SPEC-DA-S", "b")] } }, EXTRA);
    expect(bpOf(s, "player1", "XG5-014:bv")).toBe(8000);
  });
});

void heldN;
void settle;
void fill;
