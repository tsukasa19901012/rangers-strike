/**
 * カード別スペック: XG2-042〜XG2-048（クロスギャザー ザ・ドラゴンタイガー 仮面ライダーディケイドCF〜仮面ライダースーパー1・RH）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-042」〜「XG2-048」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-042 Q1〜Q3、XG2-047 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-KW-MORPH-01〜03・R-KW-RC-01・R-KW-RESIST-01・R-CAT-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-043 仮面ライダーW・CJ の RC（ライドオフして「SP1」）は rulesSpec/07-ride.test.ts（R-KW-RC-01）、
 *    マルチカテゴリ（ET／DA）がスーパー戦隊アドレスブックで選べないことは rulesSpec/02-cards.test.ts（R-CAT-02）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  damageOf,
  endTurn,
  enemyTurn,
  enter,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  faceDownCard,
  held,
  inst,
  legal,
  morphCandidates,
  morphRush,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  pickAs,
  powerCards,
  rcBoard,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./XG2-042-061.helpers";

const DRIVER_S = sUnit("SPEC-DRIVER-S", { bp: 1000, features: ["ディケイドライバー"], category: "OT" });
const BP5000_M = sUnit("SPEC-BP5000-M", { bp: 5000, size: "M" });
const HELD_M = sUnit("SPEC-HELD-M", { bp: 3000, size: "M" });
const ADD_S = sUnit("SPEC-ADD-S", { bp: 1000, rushAdditionalCondition: { conditionId: "send_s_unit_to_power", text: "自軍Sユニット1体をパワーゾーンに送る", unitCount: 1 } as CardDefinition["rushAdditionalCondition"] });
const EXTRA = [DRIVER_S, BP5000_M, HELD_M, ADD_S];

// ===========================================================================
/** ※モーフ の共通テスト（R-KW-MORPH-01〜03）。id が自軍バトルエリアにあり、敵軍ユニットが通常のラッシュをしたとき、特徴が完全一致する自軍ゾーンのユニットカード（partnerId）と置き換えられる。 */
function morphTests(id: string, partnerId: string, otherId: string, page: string) {
  const rushed = () => morphRush({ battle: [inst(id, "me")], command: [released(partnerId, "pt"), released(otherId, "ot")] });

  it(`${id}: ※モーフ — 敵軍ユニットが通常のラッシュをされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（${partnerId}）から選べる。特徴が違うもの（${otherId}）は選べない。任意（出典: ${page}「※モーフ」・R-KW-MORPH-01・03）`, () => {
    const s = rushed();
    expect(morphCandidates(s)).toEqual([`${partnerId}:pt`]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ※モーフ — 置き換えると、選んだカードがバトルエリアに出て、これはコマンドゾーンに置かれる（出典: ${page}・R-KW-MORPH-02）`, () => {
    const s = settle(pickAs(rushed(), "player1", `${partnerId}:pt`));
    expect(zoneOf(s, "player1", `${partnerId}:pt`)).toBe("battle");
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("command");
  });

  it(`${id}: ※モーフ — 自軍パワーゾーンのオモテ向きのユニットカードとも置き換えられる（出典: ${page}・R-KW-MORPH-02「自軍ゾーン」はコマンドゾーンとパワーゾーン）`, () => {
    const s = morphRush({ battle: [inst(id, "me")], power: [inst(partnerId, "pp")] });
    expect(morphCandidates(s)).toEqual([`${partnerId}:pp`]);
  });
}

// ===========================================================================
describe("XG2-042 仮面ライダーディケイドCF", () => {
  const TEXT =
    "※これがユニットでなくなるとき、オモテ向きの自軍パワーから特徴「仮面ライダー」を持つカードを1枚選び捨札にすれば、その場に留まる。 【ファイナルアタックライド】オモテ向きの自軍パワーから特徴「仮面ライダー」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。そうしたとき、この効果で出したユニットはナンバーに数字かRCを持っていれば、このターン、そのナンバーは「2」になり、自分がターンを終えるとき、自軍エリアにあれば捨札にする。";

  it("XG2-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-1687）", () => {
    expectCatalogText("XG2-042", TEXT);
    expectUnit("XG2-042", { name: "仮面ライダーディケイドCF", category: "OT", size: "S", bp: 6000, sp: "1/4", powerCost: "5+", comboNumber: 1, features: ["仮面ライダー", "男", "ディケイドライバー"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG2-042", ["SR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 5) => rushBoard({ hand: [inst("XG2-042", "h")], rush, power: powerCards(power), command: releasedCat("OT", 1) }, {}, EXTRA);

  it("XG2-042: 追加条件 — 特徴「ディケイドライバー」を持つ自軍ユニット（XG1-077 仮面ライダーディケイド）1体をパワーゾーンに送り、パワー5でラッシュできる。パワー4ではできない（出典: atwiki/page-1687「追加条件：特徴「ディケイドライバー」を持つ自軍ユニット1体をパワーゾーンに送る」「必要パワー：5+」）", () => {
    const r = rushFromHand(board([inst("XG1-077", "dc")]), "player1", "XG2-042:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-077:dc")).toBe("power");
    expect(canStartRush(board([inst("XG1-077", "dc")], 4), "player1", "XG2-042:h")).toBe(false);
  });

  it("XG2-042: 追加条件 — 「ディケイドライバー」を持たないユニットでは満たさない（出典: atwiki/page-1687）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-042:h")).toBe(false);
  });

  const far = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    ncEnter("XG2-042:cf", 0, { power: [inst("XG2-043", "pw"), inst("XG2-045", "lt"), inst("XG2-026", "nr"), faceDownCard("XG2-044", "fd")], ...p1 });

  it("XG2-042: 【ファイナルアタックライド】NC で、オモテ向きの自軍パワーの特徴「仮面ライダー」を持つユニットカードから1枚選べる（「仮面ライダー」を持たないカード・ウラ向きのカードは選べない）。任意（出典: atwiki/page-1687「オモテ向きの自軍パワーから特徴「仮面ライダー」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = far();
    expectChoiceFrom(s, "player1", "XG2-042");
    expect(choiceIds(s)).toEqual(["XG2-043:pw", "XG2-045:lt"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-042: 【ファイナルアタックライド】選んだカードは自軍ラッシュエリアに出る。RC を持つユニット（XG2-043 W・CJ）はこのターン、ナンバーが「2」になり、バトルエリアの2番目に出れば NC で「SP1」を得る（出典: atwiki/page-1687「ナンバーに数字かRCを持っていれば、このターン、そのナンバーは「2」になり」）", () => {
    let s = resolveAll(pick(far(), "XG2-043:pw"));
    expect(zoneOf(s, "player1", "XG2-043:pw")).toBe("rush");
    s = settle(enter(passEntry(s), "XG2-043:pw"));
    expect(spOf(s, "player1", "XG2-043:pw")).toBe(1);
  });

  it("XG2-042: 公式Q&A — 出したユニットは、ナンバーに関わらず（ナンバーのない XG2-045 W・LT でも）、自分がターンを終えるとき自軍エリアにあれば捨札になる（出典: atwiki/page-1687 Q1「いいえ、ナンバーに関わらず、出したユニットは自分がターンを終えるとき、自軍エリアにあれば捨札になります」）", () => {
    let s = resolveAll(pick(far(), "XG2-045:lt"));
    expect(zoneOf(s, "player1", "XG2-045:lt")).toBe("rush");
    // NC で出た XG2-042 のアタック／ストライク選択（pendingBattleEntry）を済ませてからターンを終える（エンジンの手順。期待値は同じ）。
    s = endTurn(passEntry(s));
    expect(zoneOf(s, "player1", "XG2-045:lt")).toBe("discard");
  });

  it("XG2-042: 公式Q&A — XG1-034 害気大臣キタネイダスが自軍エリアにある間は、バトルフェイズ中の【ファイナルアタックライド】は発動できない（出典: atwiki/page-1687 Q3「いいえ、どちらもパワーゾーンからカードが離れる処理を含むため、発動できません」）", () => {
    const s = resolveAll(far({ rush: [inst("XG1-034", "kt")] }));
    expect(zoneOf(s, "player1", "XG2-043:pw")).toBe("power");
    expect(zoneOf(s, "player1", "XG2-045:lt")).toBe("power");
  });

  it("XG2-042: ※ 撃破されてユニットでなくなるとき、オモテ向きの自軍パワーから特徴「仮面ライダー」を持つカードを1枚選び捨札にすれば、その場に留まる（任意）（出典: atwiki/page-1687 ※）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("XG2-042", "cf")], power: [inst("XG2-043", "pw"), inst("XG2-026", "nr")] }, "XG2-042:cf");
    expectChoiceFrom(s, "player1", "XG2-042");
    expect(choiceIds(s)).toEqual(["XG2-043:pw"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, "XG2-043:pw"));
    expect(zoneOf(s, "player1", "XG2-042:cf")).toBe("battle");
    expect(zoneOf(s, "player1", "XG2-043:pw")).toBe("discard");
  });

  it("XG2-042: ※ オモテ向きの自軍パワーに「仮面ライダー」を持つカードがなければ留まれず、捨札になる（出典: atwiki/page-1687 ※）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-042", "cf")], power: [inst("XG2-026", "nr"), faceDownCard("XG2-043", "fd")] }, "XG2-042:cf"));
    expect(zoneOf(s, "player1", "XG2-042:cf")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-043:fd")).toBe("power");
  });

  it("XG2-042: 【ファイナルアタックライド】で出したユニットを捨札にするときも撃破ではない離場として処理し、出したのが XG2-042 なら ※「その場に留まる」を使える（出典: atwiki/page-1687「自分がターンを終えるとき、自軍エリアにあれば捨札にする」・※「これがユニットでなくなるとき」）", () => {
    let s = resolveAll(pick(far({ power: [inst("XG2-042", "pw2"), inst("XG2-043", "pw")] }), "XG2-042:pw2"));
    expect(zoneOf(s, "player1", "XG2-042:pw2")).toBe("rush");
    s = settle(passEntry(s));
    for (let i = 0; i < 5 && !s.pendingEffectChoice && s.activePlayer === "player1"; i++) s = act(s, legal(s).find((a) => a.type === "end_phase")!);
    expectChoiceFrom(s, "player1", "XG2-042");
    expect(choiceIds(s)).toEqual(["XG2-043:pw"]);
    s = resolveAll(pick(s, "XG2-043:pw"));
    expect(zoneOf(s, "player1", "XG2-042:pw2")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-043:pw")).toBe("discard");
  });

  it("XG2-042: 公式Q&A — 敵軍 RS-322 ベン・G【人身略取】の「自軍Sユニットを1体捨札にする」追加条件でこれを捨札にするときも、その場に留まる効果を使える。留まったときは、追加条件はまだ満たせるものとしてベン・G の効果を続ける（出典: atwiki/page-1687 Q2「「その場に留まる」という効果を発動することは出来ます。…追加条件を満たすことは可能であるとして、「RS-322 ベン・G」の効果を続行して下さい」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("XG2-042", "cf")], power: [inst("XG2-043", "pw")], deck: deckCards(5) }, player2: { rush: [inst("RS-322", "b")], hand: [inst("RS-311", "m")], deck: deckCards(5, "e") } });
    s = enter(s, "RS-322:b", "player2");
    s = pick(s, "RS-311:m");
    expectChoiceFrom(s, "player1", "RS-322");
    expect(choiceIds(s)).toEqual(["XG2-042:cf"]);
    s = pick(s, "XG2-042:cf");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["XG2-043:pw"]);
    s = pick(s, "XG2-043:pw");
    expect(zoneOf(s, "player1", "XG2-042:cf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-043:pw")).toBe("discard");
    // まだ場にいるので追加条件は満たせるものとして続行する（もう一度 S ユニットを選ぶ。cardSpec/RS5-306-326.c の RS-322 Q5 と同じ読み）。
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toContain("XG2-042:cf");
  });
});

// ===========================================================================
describe("XG2-043 仮面ライダーW・CJ", () => {
  const TEXT = "※モーフ 【ジョーカーエクストリーム】「SP1」";

  it("XG2-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-1818）", () => {
    expectCatalogText("XG2-043", TEXT);
    expectUnit("XG2-043", { name: "仮面ライダーW・CJ", category: ["ET", "DA"], size: "S", bp: 4000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG2-043", ["SR"]);
  });

  morphTests("XG2-043", "XG2-045", "XG2-049", "atwiki/page-1818");
});

// ===========================================================================
describe("XG2-044 仮面ライダーW・HM", () => {
  const TEXT = "※モーフ ※レジスト 【メタルシャフト】自軍ターン中、これがバトルエリアに出たとき、BP5000以下の敵軍ユニットを1体選びホールドしてもよい。";

  it("XG2-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-1815）", () => {
    expectCatalogText("XG2-044", TEXT);
    expectUnit("XG2-044", { name: "仮面ライダーW・HM", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: "3+", features: ["仮面ライダー", "男", "ダブルドライバー"], rushCondition: "state_gate" });
    expectRarityIn("XG2-044", ["R"]);
  });

  const board = (command: ReturnType<typeof inst>[]) => rushBoard({ hand: [inst("XG2-044", "h")], power: powerCards(3), command });

  it("XG2-044: 追加条件 — 特徴「メカ」を持つ自軍コマンド（RS-570 デカバイク）があればラッシュできる。なければできない（出典: atwiki/page-1815「追加条件：特徴「メカ」を持つ自軍コマンドがある」・カード評価「ラッシュには特徴「メカ」持ちのコマンドが必要」）", () => {
    const r = rushFromHand(board([released("TST-OP", "w"), released("RS-570", "mc")]), "player1", "XG2-044:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-044:h")).toBe("rush");
    expect(canStartRush(board([released("TST-OP", "w"), released("TST-OP", "w2")]), "player1", "XG2-044:h")).toBe(false);
  });

  morphTests("XG2-044", "XG2-043", "XG2-049", "atwiki/page-1815");

  it("XG2-044: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1815「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-044", "hm")] }, "XG2-044:hm"))).toBe(true);
  });

  const shaft = () =>
    enter(p1Battle({ rush: [inst("XG2-044", "hm")] }, { battle: [inst("TST-UNIT-0", "a"), inst("SPEC-BP5000-M", "b5"), inst("TST-UNIT-7", "big")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA), "XG2-044:hm");

  it("XG2-044: 【メタルシャフト】自軍ターン中にバトルエリアに出たとき、BP5000 以下の敵軍ユニット（エリア・サイズを問わない）から1体選べる。BP13000 のユニットは選べない。任意（出典: atwiki/page-1815「BP5000以下の敵軍ユニットを1体選びホールドしてもよい」・カード評価「サイズの制限もない」）", () => {
    const s = shaft();
    expectChoiceFrom(s, "player1", "XG2-044");
    expect(choiceIds(s)).toEqual(["SPEC-BP5000-M:b5", "TST-UNIT-0:a", "TST-UNIT-0:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-044: 【メタルシャフト】選んだユニットをホールドする（出典: atwiki/page-1815）", () => {
    const s = resolveAll(pick(shaft(), "SPEC-BP5000-M:b5"));
    expect(cardIn(s, "player2", "SPEC-BP5000-M:b5")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "TST-UNIT-0:a")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("XG2-045 仮面ライダーW・LT", () => {
  const TEXT = "※モーフ 【トリガーマグナム】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからホールド状態のSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("XG2-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-1822）", () => {
    expectCatalogText("XG2-045", TEXT);
    expectUnit("XG2-045", { name: "仮面ライダーW・LT", category: ["MA", "OT"], size: "S", bp: 2000, sp: undefined, powerCost: 4, features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG2-045", ["NR"]);
  });

  morphTests("XG2-045", "XG2-044", "XG2-049", "atwiki/page-1822");

  const magnum = () =>
    enter(p1Battle({ rush: [inst("XG2-045", "lt")] }, { rush: [held("TST-UNIT-0", "h"), inst("TST-UNIT-0", "r"), held("SPEC-HELD-M", "hm")], battle: [held("TST-UNIT-0", "bh")] }, EXTRA), "XG2-045:lt");

  it("XG2-045: 【トリガーマグナム】自軍ターン中にバトルエリアに出たとき、敵軍ラッシュエリアのホールド状態の S ユニットから1体選べる（リリース状態のユニット・M ユニット・バトルエリアのユニットは選べない）。任意（出典: atwiki/page-1822「敵軍ラッシュエリアからホールド状態のSユニットを1体選び…置いてもよい」）", () => {
    const s = magnum();
    expectChoiceFrom(s, "player1", "XG2-045");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-045: 【トリガーマグナム】選んだユニットは持ち主のパワーゾーンにダメージとして（ウラ向きで）置かれる（出典: atwiki/page-1822「持ち主のパワーゾーンにダメージにして置いてもよい」・カード評価「ホールド状態の敵軍Sユニットを問答無用でダメージにする」）", () => {
    const s = resolveAll(pick(magnum(), "TST-UNIT-0:h"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:h")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-0:h")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-046 仮面ライダースーパー1・PH", () => {
  const TEXT = "※モーフ ※レジスト ※これは自軍コマンドを2つホールドしなければバトルエリアに出られない（モーフで出るときは除く）。 【怪力】自軍ターン中、これはBP+5000される。";

  it("XG2-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-1745）", () => {
    expectCatalogText("XG2-046", TEXT);
    expectUnit("XG2-046", { name: "仮面ライダースーパー1・PH", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 5, features: ["仮面ライダー", "男", "改造人間", "ファイブハンド"] });
    expectRarityIn("XG2-046", ["N"]);
  });

  morphTests("XG2-046", "XG2-047", "XG2-049", "atwiki/page-1745");

  it("XG2-046: ※ 自軍コマンドを2つホールドすればバトルエリアに出られる。リリース状態のコマンドが1つしかなければ出られない（出典: atwiki/page-1745「自軍コマンドを2つホールドしなければバトルエリアに出られない」）", () => {
    const s = enterWithHold(p1Battle({ rush: [inst("XG2-046", "ph")], command: releasedCat("ET", 2) }), "XG2-046:ph", ["TST-OP-ET:cET0", "TST-OP-ET:cET1"]);
    expect(zoneOf(s, "player1", "XG2-046:ph")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(canEnter(p1Battle({ rush: [inst("XG2-046", "ph")], command: releasedCat("ET", 1) }), "XG2-046:ph")).toBe(false);
  });

  it("XG2-046: ※ モーフでバトルエリアに出るときはホールドしなくてよい（出典: atwiki/page-1745「（モーフで出るときは除く）」）", () => {
    let s = morphRush({ battle: [inst("XG2-047", "rn")], command: [released("XG2-046", "ph"), ...releasedCat("ET", 2)] });
    expect(morphCandidates(s)).toContain("XG2-046:ph");
    s = settle(pickAs(s, "player1", "XG2-046:ph"));
    expect(zoneOf(s, "player1", "XG2-046:ph")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.cardId === "TST-OP-ET").every((c) => !c.commandHeld)).toBe(true);
  });

  it("XG2-046: 【怪力】自軍ターン中、BP+5000（BP8000）される（出典: atwiki/page-1745「自軍ターン中、これはBP+5000される」・カード評価「BPは8000まで上がる」）", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG2-046", "ph")] }), "player1", "XG2-046:ph")).toBe(8000);
  });

  it("XG2-046: 【怪力】敵軍ターン中は本来の BP3000（出典: atwiki/page-1745「自軍ターン中、」・カード評価「敵軍ターン中は本来のBPで戦わなければならない」）", () => {
    expect(bpOf(enemyTurn({ battle: [inst("XG2-046", "ph")] }), "player1", "XG2-046:ph")).toBe(3000);
  });

  it("XG2-046: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1745「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-046", "ph")] }, "XG2-046:ph"))).toBe(true);
  });
});

// ===========================================================================
describe("XG2-047 仮面ライダースーパー1・RNH", () => {
  const TEXT =
    "※モーフ 【超高火炎＆冷凍ガス】WBかOTを持つ自軍コマンドを1つ選びホールドしてもよい。そうしたとき、ホールドしたコマンドの持つカテゴリごとに、次の効果を発動する⇒WBなら追加条件を持たないSユニットを1体選び撃破してもよい。OTなら追加条件を持つSユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("XG2-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-1503）", () => {
    expectCatalogText("XG2-047", TEXT);
    expectUnit("XG2-047", { name: "仮面ライダースーパー1・RNH", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "ファイブハンド"] });
    expectRarityIn("XG2-047", ["R"]);
  });

  morphTests("XG2-047", "XG2-048", "XG2-049", "atwiki/page-1503");

  const rc = (command: ReturnType<typeof inst>[]) =>
    rcBoard("XG2-047:r", { command }, { battle: [inst("TST-UNIT-0", "x"), inst("SPEC-ADD-S", "ad")] }, EXTRA);

  it("XG2-047: 【超高火炎＆冷凍ガス】RC（ライドオフ）で、WB か OT を持つ自軍コマンド（リリース状態）から1つ選びホールドするかを選べる。ET だけのコマンドは選べない。任意（出典: atwiki/page-1503「WBかOTを持つ自軍コマンドを1つ選びホールドしてもよい」・R-KW-RC-01）", () => {
    const s = rc([released("TST-OP", "w"), released("TST-OP-OT", "o"), released("TST-OP-ET", "e")]);
    expectChoiceFrom(s, "player1", "XG2-047");
    expect(choiceIds(s)).toEqual(["TST-OP-OT:o", "TST-OP:w"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-047: 【超高火炎＆冷凍ガス】WB のコマンドをホールドしたら、追加条件を持たない S ユニットを1体選び撃破できる（追加条件を持つユニットは選べない）（出典: atwiki/page-1503「WBなら追加条件を持たないSユニットを1体選び撃破してもよい」）", () => {
    let s = settle(pick(rc([released("TST-OP", "w")]), "TST-OP:w"));
    expect(cardIn(s, "player1", "TST-OP:w")?.commandHeld).toBe(true);
    expect(choiceIds(s)).not.toContain("SPEC-ADD-S:ad");
    s = resolveAll(pick(s, "TST-UNIT-0:x"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
  });

  it("XG2-047: 【超高火炎＆冷凍ガス】OT のコマンドをホールドしたら、追加条件を持つ S ユニットを1体選び持ち主のパワーゾーンに送れる（出典: atwiki/page-1503「OTなら追加条件を持つSユニットを1体選び、持ち主のパワーゾーンに送ってもよい」・カード評価「ゾードアップ元ユニットの再ラッシュを阻止できたり」）", () => {
    let s = settle(pick(rc([released("TST-OP-OT", "o")]), "TST-OP-OT:o"));
    expect(choiceIds(s)).toEqual(["SPEC-ADD-S:ad"]);
    s = resolveAll(pick(s, "SPEC-ADD-S:ad"));
    expect(zoneOf(s, "player2", "SPEC-ADD-S:ad")).toBe("power");
  });

  it("XG2-047: 公式Q&A — WB と OT の両方を持つコマンドをホールドしたら、WB の効果と OT の効果の両方を解決する（出典: atwiki/page-1503 Q1「はい、できます。ただし、どちらか一方だけを解決することはできません」）", () => {
    const WB_OT = { id: "SPEC-OP-WB-OT", name: "SPEC-OP-WB-OT", type: "operation", category: ["WB", "OT"], rarity: "N", expansion: "card-spec", powerCost: 0 } as unknown as CardDefinition;
    let s = rcBoard("XG2-047:r", { command: [released("SPEC-OP-WB-OT", "m")] }, { battle: [inst("TST-UNIT-0", "x"), inst("SPEC-ADD-S", "ad")] }, [...EXTRA, WB_OT]);
    s = resolveAll(pick(s, "SPEC-OP-WB-OT:m"), ["TST-UNIT-0:x", "SPEC-ADD-S:ad"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ADD-S:ad")).toBe("power");
  });
});

// ===========================================================================
describe("XG2-048 仮面ライダースーパー1・RH", () => {
  const TEXT =
    "※モーフ 【レーダーアイ】これが自軍バトルエリアからラッシュエリアに戻るとき、お互いの山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードを、それぞれ持ち主の山札の上に戻すか下に戻すか選択する。";

  it("XG2-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-1744）", () => {
    expectCatalogText("XG2-048", TEXT);
    expectUnit("XG2-048", { name: "仮面ライダースーパー1・RH", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 1, features: ["仮面ライダー", "男", "改造人間", "ファイブハンド"] });
    expectRarityIn("XG2-048", ["N"]);
  });

  morphTests("XG2-048", "XG2-046", "XG2-049", "atwiki/page-1744");

  const returning = () => {
    const s = st({ phase: "start", player1: { battle: [inst("XG2-048", "rh")], deck: [inst("TST-OP", "my0"), inst("TST-OP", "my1")] }, player2: { deck: [inst("TST-OP", "en0"), inst("TST-OP", "en1")] } });
    return act(s, { type: "return_all_battle_to_rush", playerId: "player1" });
  };

  it("XG2-048: 【レーダーアイ】自軍バトルエリアからラッシュエリアに戻るとき（自軍スタートフェイズ）、お互いの山札の上から1枚をオモテにするかを選べる（任意）（出典: atwiki/page-1744「これが自軍バトルエリアからラッシュエリアに戻るとき、お互いの山札の上から1枚をオモテにしてもよい」）", () => {
    const s = returning();
    expect(zoneOf(s, "player1", "XG2-048:rh")).toBe("rush");
    expectChoiceFrom(s, "player1", "XG2-048");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-048: 【レーダーアイ】オモテにしたカードを、それぞれ持ち主の山札の上か下に戻す（自分の山札の上のカードを下に戻せる）（出典: atwiki/page-1744「それぞれ持ち主の山札の上に戻すか下に戻すか選択する」）", () => {
    let s = returning();
    expectChoiceFrom(s, "player1", "XG2-048");
    s = resolveAll(accept(s), ["bottom", "deck_bottom", "top", "deck_top"]);
    const decks = [s.players.player1.deck.map((c) => c.instanceId), s.players.player2.deck.map((c) => c.instanceId)];
    expect(decks[0]!.at(-1) === "TST-OP:my0" || decks[1]!.at(-1) === "TST-OP:en0").toBe(true);
  });

  it("XG2-048: 【レーダーアイ】オモテにしなければ、どちらの山札も変わらない（出典: atwiki/page-1744「オモテにしてもよい」）", () => {
    let s = returning();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-048") s = skip(s);
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["TST-OP:my0", "TST-OP:my1"]);
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-OP:en0", "TST-OP:en1"]);
  });

});
