/**
 * カード別スペック: XG5-081〜XG5-086（クロスギャザー XG5 ザ・チケットブレイカー 仮面ライダーアクセルトライアル〜グランナスカ・コンバットフォーメーション）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG5-085 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-DMG-02・R-ADD-02・R-KW-MORPH-01・R-KW-RC-01・R-CTR）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackTargets,
  beltUsed,
  canCounter,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  enemyAttacks,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  faceUp,
  inst,
  morphCandidates,
  passTurnTo,
  pick,
  powerCards,
  rcOff,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  st,
  strike,
  sUnit,
  useCounter,
  zoneOf,
  zordDownTests,
} from "./XG5-081-096.helpers";

const C2 = sUnit("SPEC-C2", { category: "WB", bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const SP_M = sUnit("SPEC-M", { category: "WB", bp: 1000, size: "M" });
const ATK = sUnit("SPEC-ATK", { category: "WB", bp: 9000 });
const EXTRA = [C2, C3, SP_M, ATK];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-081 仮面ライダーアクセルトライアル", () => {
  const TEXT = "【絶望がお前のゴールだ】これがストライクして敵軍パワーゾーンのカードがウラ向きになったとき、そのカードの必要パワーの数字以下の必要パワーを持つ敵軍Sユニットを1体選び撃破する。";

  it("XG5-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-2236）", () => {
    expectCatalogText("XG5-081", TEXT);
    expectMultiStats("XG5-081", { name: "仮面ライダーアクセルトライアル", category: ["ET"], size: "S", bp: 4500, sp: 1, powerCost: "7-", comboNumber: undefined, features: ["仮面ライダー", "男", "警察", "アクセルドライバー", "加速"], rushCondition: "zord_down_send_to_command_or_discard" });
    expectRarityIn("XG5-081", ["SR"]);
  });

  zordDownTests("XG5-081", "XG4-061", "仮面ライダーアクセル", "atwiki/page-2236", "ET");

  it("XG5-081: 追加条件 —「仮面ライダーアクセル」をコマンドゾーンに送っても必要パワー0でラッシュできる（出典: atwiki/page-2236「コマンドゾーンに送るか捨札にすれば必要パワー0になる」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-081", "ac")], rush: [inst("XG4-061", "p")], command: releasedCat("ET", 1), power: [] });
    const r = rushVia(s0, "player1", "XG5-081:ac", (a) => a.zordMaterialInstanceId === "XG4-061:p" && a.zordMaterialDestination === "command");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-081:ac")).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-061:p")).toBe("command");
  });

  // 敵軍パワーゾーン: オモテ向きの SPEC-C2（必要パワー2）だけ。敵軍: TST-UNIT-0（0）・SPEC-C2（2）・SPEC-C3（3）・SPEC-M（M）。
  const struck = () =>
    settle(strike(enter(battle({ rush: [inst("XG5-081", "ac")] }, { power: [faceUp("SPEC-C2", "pw")], rush: [inst("TST-UNIT-0", "e0"), inst("SPEC-C2", "e2"), inst("SPEC-C3", "e3")], battle: [inst("SPEC-M", "em")] }), "XG5-081:ac"), "XG5-081:ac"));

  it.fails("XG5-081:【絶望がお前のゴールだ】— ストライクして敵軍パワーゾーンのカード（必要パワー2）がウラ向きになったとき、その数字以下の必要パワーの敵軍 S ユニットを選ぶ（見送れない） 既知の不具合: CARD-XG5-081 ストライクでパワーゾーンがウラ向きになっても【絶望がお前のゴールだ】が発動しない（出典: atwiki/page-2236「そのカードの必要パワーの数字以下の必要パワーを持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = struck();
    expect(cardIn(s, "player2", "SPEC-C2:pw")?.faceDown).toBe(true);
    expectChoiceFrom(s, "player1", "XG5-081");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-C2:e2", "TST-UNIT-0:e0"]);
    expect(s.pendingEffectChoice?.optional ?? false).toBe(false);
  });

  it.fails("XG5-081:【絶望がお前のゴールだ】— 選んだユニットは撃破される 既知の不具合: CARD-XG5-081 【絶望がお前のゴールだ】が発動せず撃破できない（出典: atwiki/page-2236「撃破する」）", () => {
    const s = resolveAll(pick(struck(), "SPEC-C2:e2"));
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-082 バットショット", () => {
  const TEXT = "敵軍コマンドゾーンからSユニットのカードを1枚選び、敵軍ラッシュエリアに出してもよい。このとき、出したユニットの効果は発動しない。その後、このカードを自軍コマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG5-082: カタログ本文・スペックが出典と一致（出典: atwiki/page-2218）", () => {
    expectCatalogText("XG5-082", TEXT);
    expectOpStats("XG5-082", { name: "バットショット", category: "ET", powerCost: 3 });
    expectRarityIn("XG5-082", ["N"]);
  });

  // 敵軍コマンドゾーン: TST-UNIT-0（S）・TST-UNIT-2（M）・TST-OP（オペレーション）。
  const used = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    beltUsed("XG5-082", "ET", 3, p1, { command: [released("TST-UNIT-0", "c0"), released("TST-UNIT-2", "c2"), released("TST-OP", "co")] }, EXTRA);

  it.fails("XG5-082: 敵軍コマンドゾーンの S ユニットのカードを選べる（M ユニット・オペレーションは選べない。任意） 既知の不具合: CARD-XG5-082 M ユニット・オペレーションのカードも選ばされる（出典: atwiki/page-2218「敵軍コマンドゾーンからSユニットのカードを1枚選び、敵軍ラッシュエリアに出してもよい」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-082");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:c0"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-082: 選んだカードは敵軍ラッシュエリアに出る 既知の不具合: CARD-XG5-082 選んだカードがラッシュエリアに出ずコマンドゾーンに残る（出典: atwiki/page-2218「敵軍ラッシュエリアに出してもよい」）", () => {
    const s = resolveAll(pick(used(), "TST-UNIT-0:c0"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:c0")).toBe("rush");
  });

  it.fails("XG5-082: その後、このカードは自軍コマンドゾーンにホールド状態で置かれる 既知の不具合: CARD-XG5-082 使用後にこのカードが自軍コマンドゾーンにホールド状態で置かれず捨札になる（出典: atwiki/page-2218「その後、このカードを自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(used(), "TST-UNIT-0:c0"));
    expect(zoneOf(s, "player1", "XG5-082:op")).toBe("command");
    expect(cardIn(s, "player1", "XG5-082:op")?.commandHeld).toBe(true);
  });

  it("XG5-082: 自軍コマンドゾーンが5枚で置けなければ捨札になる（出典: atwiki/page-2218「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(used({ command: releasedCat("WB", 4) }), "TST-UNIT-0:c0"));
    expect(zoneOf(s, "player1", "XG5-082:op")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-083 スパイダーショック", () => {
  const TEXT = "※カウンター 自軍Sユニットがバトルで撃破されて捨札になったとき発動できる⇒そのユニットのカードを自軍コマンドゾーンにホールド状態で置く。置けなければ手札に加える。";

  it("XG5-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-2219）", () => {
    expectCatalogText("XG5-083", TEXT);
    expectOpStats("XG5-083", { name: "スパイダーショック", category: "ET", powerCost: 1 });
    expectRarityIn("XG5-083", ["N"]);
  });

  /** 敵軍ターン、自軍の TST-UNIT-0 が BP9000 にアタックされて撃破され、捨札になる。手札にスパイダーショック。 */
  const destroyed = (command = releasedCat("ET", 1)) => {
    let s = enemyAttacks({ hand: [inst("XG5-083", "sp")], battle: [inst("TST-UNIT-0", "u")], command, power: powerCards(1) }, inst("SPEC-ATK", "atk"), "TST-UNIT-0:u", EXTRA);
    for (let i = 0; i < 4 && !canCounter(s, "XG5-083:sp") && zoneOf(s, "player1", "TST-UNIT-0:u") !== "discard"; i++) s = settle(s);
    return s;
  };

  it("XG5-083: ※カウンター — 自軍 S ユニットがバトルで撃破されて捨札になったとき使える（出典: atwiki/page-2219「自軍Sユニットがバトルで撃破されて捨札になったとき発動できる」）", () => {
    expect(canCounter(destroyed(), "XG5-083:sp")).toBe(true);
  });

  it("XG5-083: そのユニットのカードを自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-2219「そのユニットのカードを自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(useCounter(destroyed(), "XG5-083:sp"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("command");
    expect(cardIn(s, "player1", "TST-UNIT-0:u")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG5-084 仮面ライダーW・CJ", () => {
  const TEXT =
    "※モーフ 【『お前の罪を数えろ』】これは自軍捨札にSユニットのカードが5枚以上あれば、次の相手ターン中、次の効果を得る⇒これ以外のSユニットがアタックされたとき、アタックされたユニットのかわりにこのユニットがバトルしてもよい。そうしたとき、そのバトル中、これはBP+3000される。";

  it("XG5-084: カタログ本文・スペックが出典と一致（出典: atwiki/page-2227）", () => {
    expectCatalogText("XG5-084", TEXT);
    expectMultiStats("XG5-084", { name: "仮面ライダーW・CJ", category: ["ET", "DA"], size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG5-084", ["R"]);
  });

  it("XG5-084: ※モーフ — 敵軍ユニットが通常の手段でラッシュされたとき、特徴が完全に同じオモテ向きのユニットカード（XG2-043 仮面ライダーW・CJ）と置き換えられる（出典: atwiki/page-2227「※モーフ」・R-KW-MORPH-01）", () => {
    const s = enemyRushes({ rush: [inst("XG5-084", "w")], power: [faceUp("XG2-043", "cj"), faceUp("RK-056", "z")] }, "TST-UNIT-0:x");
    expect(morphCandidates(s)).toEqual(["XG2-043:cj"]);
  });

  /** RC: XG5-080 にライドしてライドオフする。自軍捨札に S ユニットのカード n 枚、自軍バトルエリアに TST-UNIT-0。その後、相手のバトルフェイズに相手の SPEC-ATK が TST-UNIT-0 にアタックする。 */
  const defended = (n: number) => {
    let s = rcOff(battle({ battle: [inst("TST-UNIT-0", "o")], rush: [inst("XG5-080", "md"), inst("XG5-084", "w")], discard: Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `d${i}`)) }, { rush: [inst("SPEC-ATK", "atk")] }), "XG5-084:w", "XG5-080:md");
    s = resolveAll(s);
    s = passTurnTo(s, "player2", "battle");
    s = enter(s, "SPEC-ATK:atk", "player2");
    expect(attackTargets(s, "SPEC-ATK:atk", "player2")).toContain("TST-UNIT-0:o");
    return enemyAttack(s);
  };
  const enemyAttack = (s: GameState) => attack(s, "SPEC-ATK:atk", "TST-UNIT-0:o", "player2");

  it.fails("XG5-084: RC【『お前の罪を数えろ』】— 自軍捨札に S ユニットのカードが5枚あれば、次の相手ターン中、これ以外の S ユニットがアタックされたとき、かわりにバトルするかを選べる 既知の不具合: CARD-XG5-084 RC の「かわりにバトルする」効果が次の相手ターンに発動しない（出典: atwiki/page-2227「アタックされたユニットのかわりにこのユニットがバトルしてもよい」）", () => {
    const s = defended(5);
    expectChoiceFrom(s, "player1", "XG5-084");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-084: RC【『お前の罪を数えろ』】— 自軍捨札の S ユニットのカードが4枚なら、かわりにバトルできない（出典: atwiki/page-2227「Sユニットのカードが5枚以上あれば」）", () => {
    expect(defended(4).pendingEffectChoice?.sourceCardId).not.toBe("XG5-084");
  });
});

// ===========================================================================
describe("XG5-085 超時空戦闘母艦グランナスカ", () => {
  const TEXT =
    "※これはSユニットにアタックすることが出来ない。 【ワープ】これが自軍山札にある間、このカードがオモテになったとき、これを効果の対象にする前に自軍ラッシュエリアに出してもよい。そうしたとき、自軍山札の上から1枚をオモテにして、かわりに効果の対象にする。";

  it("XG5-085: カタログ本文・スペックが出典と一致（出典: atwiki/page-2220）", () => {
    expectCatalogText("XG5-085", TEXT);
    expectMultiStats("XG5-085", { name: "超時空戦闘母艦グランナスカ", category: ["OT"], size: "XL", bp: 5000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ", "母艦"] });
    expectRarityIn("XG5-085", ["N"]);
  });

  it.fails("XG5-085: ※ — S ユニットにはアタックできず、M ユニットにはアタックできる 既知の不具合: CARD-XG5-085 S ユニットにアタックできてしまう（出典: atwiki/page-2220「これはSユニットにアタックすることが出来ない」）", () => {
    const s = enter(battle({ rush: [inst("XG5-085", "gn")] }, { battle: [inst("TST-UNIT-0", "s"), inst("SPEC-M", "m")] }), "XG5-085:gn");
    expect(attackTargets(s, "XG5-085:gn")).toEqual(["SPEC-M:m"]);
  });

  it.todo("XG5-085:【ワープ】— 自軍山札でオモテになったとき、効果の対象にする前に自軍ラッシュエリアに出し、山札の次の1枚をかわりに対象にできる（出典: atwiki/page-2220「これを効果の対象にする前に自軍ラッシュエリアに出してもよい」）— 本範囲で山札をオモテにする効果（XG5-058 等）がエンジンで動かず、オモテになる場面を組めない");
  it.todo("XG5-085: 公式Q&A —【ワープ】を発動したあとでは SR-006 シュリケンジャーFM【超忍法・分身魔球】は使えない（出典: atwiki/page-2220 Q1「いいえ、それはできません」）— 同上の理由でテストできない");
});

// ===========================================================================
describe("XG5-086 グランナスカ・コンバットフォーメーション", () => {
  const TEXT = "【ナックルボンバー】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからMユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("XG5-086: カタログ本文・スペックが出典と一致（出典: atwiki/page-2248）", () => {
    expectCatalogText("XG5-086", TEXT);
    expectMultiStats("XG5-086", { name: "グランナスカ・コンバットフォーメーション", category: ["OT"], size: "XL", bp: 9000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_name_contains_unit" });
    expectRarityIn("XG5-086", ["NR"]);
  });

  it("XG5-086: 追加条件 — カード名に「グランナスカ」を含む自軍ユニット（XG5-085）1体を捨札にし、パワー5でラッシュできる（出典: atwiki/page-2248「追加条件：カード名に「グランナスカ」を含む自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG5-086", "cf")], rush: [inst("XG5-085", "gn")], power: powerCards(5), command: releasedCat("OT", 1) }), "player1", "XG5-086:cf", { materials: ["XG5-085:gn"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-086:cf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-085:gn")).toBe("discard");
  });

  const entered = () => enter(battle({ rush: [inst("XG5-086", "cf")] }, { battle: [inst("SPEC-M", "m"), inst("TST-UNIT-0", "s")], rush: [inst("SPEC-M", "rm")] }), "XG5-086:cf");

  it.fails("XG5-086:【ナックルボンバー】— 自軍ターン中に出たとき、敵軍バトルエリアの M ユニットを選べる（S ユニット・ラッシュエリアの M ユニットは選べない。任意） 既知の不具合: CARD-XG5-086 敵軍 M ユニットではなく自分自身を選ばされる（出典: atwiki/page-2248「敵軍バトルエリアからMユニットを1体選び、持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-086");
    expect(choiceIds(s)).toEqual(["SPEC-M:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-086:【ナックルボンバー】— 選んだユニットは持ち主のパワーゾーンに送られる 既知の不具合: CARD-XG5-086 敵軍 M ユニットを選べずパワーゾーンに送れない（出典: atwiki/page-2248「持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-M:m"));
    expect(zoneOf(s, "player2", "SPEC-M:m")).toBe("power");
  });
});
