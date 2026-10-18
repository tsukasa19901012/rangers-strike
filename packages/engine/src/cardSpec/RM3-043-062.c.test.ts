/**
 * カード別スペック: RM-057〜RM-062（スペシャルメタルエディション レッドル〜テントリーナ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「RM-057」〜「RM-062」とカード名で検索）。atwiki 転載の公式 Q&A は atwiki/page-2017（SX-003 仮面ライダーW・FJ）Q1 が RM-057 レッドルに触れるだけ。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-CN-01・R-RUSH-22・R-KW-SCRUM-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマルレア／ノーマル」を SR／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  attackedInEnemyTurn,
  attackUntilRegister,
  canMount,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  deckWithTen,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  featuresOf,
  heldUnit,
  inst,
  ncEnter,
  pick,
  powerCards,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM3-043-062.helpers";

const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const MECHA = sUnit("SPEC-MECHA", { category: "ET", bp: 1000, sp: undefined, features: ["メカ"] });
const MALE_ATK = sUnit("SPEC-MALE-ATK", { category: "DA", bp: 5000, features: ["男"] });
const PLAIN_ATK = sUnit("SPEC-PLAIN-ATK", { category: "DA", bp: 5000, features: ["怪人"] });
const FEM = sUnit("SPEC-FEM", { category: "ET", bp: 1000, features: ["女"] });
const NOFEM = sUnit("SPEC-NOFEM", { category: "ET", bp: 1000, features: ["男"] });
const EXTRA = [ES, EM, ET_S, MECHA, MALE_ATK, PLAIN_ATK, FEM, NOFEM, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battleBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RM-057 レッドル", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【スティンガープラズマー】レジストを持たない敵軍Sユニットを1体選びホールドしてもよい。";

  it("RM-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-866）", () => {
    expectCatalogText("RM-057", TEXT);
    expectStats("RM-057", { name: "レッドル", category: "WB", size: "S", bp: 500, sp: "1/2", powerCost: 2, comboNumber: 1, features: ["メカ", "昆虫", "レッド", "女"] });
    expectRarityIn("RM-057", ["N"]);
  });

  it("RM-057: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-866 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-057", "rd")] }, "RM-057:rd"))).toBe(true);
  });

  const ENEMY = { battle: [inst("SPEC-ES", "a"), inst("RM-055", "bb"), inst("SPEC-EM", "m")], rush: [inst("SPEC-ES", "r"), heldUnit("SPEC-ES", "h")] };
  const nc = (fillerCount = 0) => ncEnter("RM-057:rd", fillerCount, {}, ENEMY, EXTRA);

  it("RM-057: NC【スティンガープラズマー】— レジストを持たない敵軍 S ユニット（エリアを問わない）から1体選べる（レジストを持つユニット・M ユニットは選べない。すでにホールド状態のユニットは選ばない。任意）（出典: atwiki/page-866「レジストを持たない敵軍Sユニットを1体選びホールドしてもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RM-057");
    expect(choiceIds(s)).toEqual(["SPEC-ES:a", "SPEC-ES:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-057: NC — 選んだユニットをホールドする（出典: atwiki/page-866「1体選びホールドしてもよい」）", () => {
    const s = resolveAll(pick(nc(), "SPEC-ES:r"));
    expect(zoneOf(s, "player2", "SPEC-ES:r")).toBe("rush");
    expect(cardIn(s, "player2", "SPEC-ES:r")?.commandHeld).toBe(true);
  });

  it("RM-057: NC — バトルエリアの1番目でなければ発動しない（出典: atwiki/page-866 CN1・R-CN-01）", () => {
    const s = nc(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-057");
  });

  it.todo(
    "RM-057: 公式Q&A — SX-003 仮面ライダーW・FJ で敵軍のレジストが無効になっていても、レジストを持つユニットは「レジストを持たない」ユニットとして選べない（出典: atwiki/page-2017 SX-003 Q1「いいえ、それはできません。無効になっているだけであり、テキスト自体を失っているわけではないからです」）。未照合の理由: Q の前提（自軍バトルエリアに SX-003 があるときにレッドルの NC1 が成立する）を公開 API の盤面で作れない（SX-003 がレッドルより前に並ぶとレッドルは1番目にならない。ナンバーに関係なく発動させる別のカードの組み合わせが必要）。実装はレジストの判定に無効を見ない（rules/rm/rm3Effects.ts）",
  );
});

// ===========================================================================
describe("RM-058 老師グル", () => {
  const TEXT = "【昆虫の精】これが自軍ラッシュエリアにある間、次の効果を発動する⇒特徴「メカ」を持つユニットと、特徴「メカ」を持つビークルに、特徴「昆虫」を追加する。";

  it("RM-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-867）", () => {
    expectCatalogText("RM-058", TEXT);
    expectStats("RM-058", { name: "老師グル", category: "WB", size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["昆虫", "男"] });
    expectRarityIn("RM-058", ["N"]);
  });

  const withGuru = (zone: "rush" | "battle") =>
    battleBoard(
      { battle: [...(zone === "battle" ? [inst("RM-058", "gu")] : []), inst("SPEC-MECHA", "m"), inst("SPEC-ES", "n")], rush: [...(zone === "rush" ? [inst("RM-058", "gu")] : []), inst("SPEC-VEHICLE", "v")] },
      { battle: [inst("SPEC-MECHA", "em")] },
    );

  it("RM-058:【昆虫の精】— 自軍ラッシュエリアにある間、特徴「メカ」を持つユニット（自軍・敵軍とも）とビークルに特徴「昆虫」を追加する（「メカ」を持たないユニットには追加しない）（出典: atwiki/page-867「特徴「メカ」を持つユニットと、特徴「メカ」を持つビークルに、特徴「昆虫」を追加する」・カード評価「サイズを問わず…相手にも特徴を追加できる」）", () => {
    const s = withGuru("rush");
    expect(featuresOf(s, "player1", "SPEC-MECHA:m")).toContain("昆虫");
    expect(featuresOf(s, "player2", "SPEC-MECHA:em")).toContain("昆虫");
    expect(featuresOf(s, "player1", "SPEC-VEHICLE:v")).toContain("昆虫");
    expect(featuresOf(s, "player1", "SPEC-ES:n")).not.toContain("昆虫");
  });

  it("RM-058:【昆虫の精】— バトルエリアにあるときは追加しない（出典: atwiki/page-867「これが自軍ラッシュエリアにある間」）", () => {
    const s = withGuru("battle");
    expect(featuresOf(s, "player1", "SPEC-MECHA:m")).not.toContain("昆虫");
  });

  it("RM-058:【昆虫の精】— 「昆虫」を追加された「メカ」の S ユニットは、ビートルーダーにライドできる（出典: atwiki/page-867・atwiki/page-862 ※・カード評価（RM-053）「ビートマシンにライドするユニットは老師グルがいれば増やす事ができる」）", () => {
    const p1 = (rush: CardInstance[]) => battleBoard({ rush: [inst("SPEC-MECHA", "m"), inst("RM-052", "bt"), ...rush], command: releasedCat("WB", 1) });
    expect(canMount(p1([inst("RM-058", "gu")]), "SPEC-MECHA:m", "RM-052:bt")).toBe(true);
    expect(canMount(p1([]), "SPEC-MECHA:m", "RM-052:bt")).toBe(false);
  });
});

// ===========================================================================
describe("RM-059 異次元調達屋カブト", () => {
  const TEXT =
    "【トランクの中身】これが自軍ラッシュエリアにある間、WBを持つ自軍Sユニットがバトルエリアに出たとき、常駐している自軍オペレーションに重ねたカードがあれば、その中から1枚選び、自分の手札に加えてもよい（ウラ向きのカードはウラ向きのまま選ぶ）。";

  it("RM-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-868）", () => {
    expectCatalogText("RM-059", TEXT);
    expectStats("RM-059", { name: "異次元調達屋カブト", category: "WB", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["昆虫", "男"] });
    expectRarityIn("RM-059", ["N"]);
  });

  const STACKED = [inst("TST-P", "s1"), { ...inst("TST-OP", "s2"), faceDown: true }];
  /** 自軍バトルフェイズ、unit をバトルエリアに出す（kabuto は自軍ラッシュエリアのカブト）。 */
  const entered = (unit: CardInstance, kabuto: CardInstance[] = [inst("RM-059", "kb")], stacked: CardInstance[] = STACKED, battle: CardInstance[] = []) =>
    enter(battleBoard({ rush: [unit, ...kabuto], battle, operation: [resident("TST-OP", "res", stacked)] }), unit.instanceId);

  it("RM-059:【トランクの中身】— 自軍ラッシュエリアにある間、WB を持つ自軍 S ユニットがバトルエリアに出たとき、常駐している自軍オペレーションに重ねたカード（ウラ向きを含む）から1枚選べる（任意）（出典: atwiki/page-868「常駐している自軍オペレーションに重ねたカードがあれば、その中から1枚選び、自分の手札に加えてもよい（ウラ向きのカードはウラ向きのまま選ぶ）」）", () => {
    const s = entered(inst("TST-UNIT-0", "w"));
    expectChoiceFrom(s, "player1", "RM-059");
    expect(choiceIds(s)).toEqual(["TST-OP:s2", "TST-P:s1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-059:【トランクの中身】— 選んだカードを手札に加える（常駐のオペレーションからはなくなる）（出典: atwiki/page-868「自分の手札に加えてもよい」・カード評価「常駐の上に重ねたカードを回収する」）", () => {
    const s = resolveAll(pick(entered(inst("TST-UNIT-0", "w")), "TST-OP:s2"));
    expect(zoneOf(s, "player1", "TST-OP:s2")).toBe("hand");
    const res = s.players.player1.operation.find((c) => c.instanceId === "TST-OP:res");
    expect((res?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["TST-P:s1"]);
  });

  it("RM-059:【トランクの中身】— WB を持たない S ユニット・WB の M ユニットが出ても発動しない（出典: atwiki/page-868「WBを持つ自軍Sユニットが」）", () => {
    expect(entered(inst("SPEC-ET-S", "et")).pendingEffectChoice?.sourceCardId).not.toBe("RM-059");
    expect(entered(inst("SPEC-EM", "wm")).pendingEffectChoice?.sourceCardId).not.toBe("RM-059");
  });

  it("RM-059:【トランクの中身】— カブトがバトルエリアにあるとき・重ねたカードがないときは発動しない（出典: atwiki/page-868「これが自軍ラッシュエリアにある間」「重ねたカードがあれば」）", () => {
    expect(entered(inst("TST-UNIT-0", "w"), [], STACKED, [inst("RM-059", "kb")]).pendingEffectChoice?.sourceCardId).not.toBe("RM-059");
    expect(entered(inst("TST-UNIT-0", "w"), [inst("RM-059", "kb")], []).pendingEffectChoice?.sourceCardId).not.toBe("RM-059");
  });

  it("RM-059:【トランクの中身】— 自軍ラッシュエリアに2枚あれば、それぞれ発動する（2枚まで手札に加えられる）（出典: atwiki/page-868・コメント欄「重複は恐らく可能」）", () => {
    const s = pick(entered(inst("TST-UNIT-0", "w"), [inst("RM-059", "kb"), inst("RM-059", "kb2")]), "TST-P:s1");
    expectChoiceFrom(s, "player1", "RM-059");
    expect(choiceIds(s)).toEqual(["TST-OP:s2"]);
  });
});

// ===========================================================================
describe("RM-060 ジャマー", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RM-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-854）", () => {
    expectCatalogText("RM-060", TEXT);
    expectStats("RM-060", { name: "ジャマー", category: "DA", size: "S", bp: 1500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["戦闘員"] });
    expectRarityIn("RM-060", ["N"]);
  });

  it("RM-060: ※ デッキに好きな枚数（10枚）入れられる（出典: atwiki/page-854「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("RM-060", "ジャマー")).toBe(true);
  });
});

// ===========================================================================
describe("RM-061 ジャマール戦闘機", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【ミサイル射出】これをラッシュしたとき、次の効果を発動できる⇒敵軍バトルエリアから、スクラムを持つユニットを1体選び、ラッシュエリアに戻す。";

  it("RM-061: カタログ本文・スペックが出典と一致（追加条件「自軍Sユニットを1体捨札にする」）（出典: atwiki/page-855）", () => {
    expectCatalogText("RM-061", TEXT);
    expectStats("RM-061", { name: "ジャマール戦闘機", category: "DA", size: "M", bp: 2500, sp: undefined, powerCost: "2+", comboNumber: undefined, features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_discard" });
    expectRarityIn("RM-061", ["N"]);
  });

  it("RM-061: ※ デッキに好きな枚数（10枚）入れられる（出典: atwiki/page-855「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("RM-061", "ジャマール戦闘機")).toBe(true);
  });

  const ENEMY = { battle: [inst("RK-213", "gr"), inst("SPEC-ES", "e")], rush: [inst("RK-213", "r")] };
  const rushed = () => {
    const r = rushFromHand(board({ hand: [inst("RM-061", "h")], rush: [inst("TST-UNIT-0", "f")], power: powerCards(2), command: releasedCat("DA", 1) }, ENEMY), "player1", "RM-061:h");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RM-061: 追加条件 — 自軍 S ユニットがなければラッシュできない。あれば1体捨札にしてラッシュする（出典: atwiki/page-855 追加条件「自軍Sユニットを1体捨札にする」）", () => {
    expect(canStartRush(board({ hand: [inst("RM-061", "h")], power: powerCards(2), command: releasedCat("DA", 1) }), "player1", "RM-061:h")).toBe(false);
    const s = rushed();
    expect(zoneOf(s, "player1", "RM-061:h")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:f")).toBe("discard");
  });

  it("RM-061:【ミサイル射出】— ラッシュしたとき、敵軍バトルエリアのスクラムを持つユニットから1体選べる（ラッシュエリアのユニット・スクラムを持たないユニットは選べない。任意）（出典: atwiki/page-855「敵軍バトルエリアから、スクラムを持つユニットを1体選び、ラッシュエリアに戻す」「次の効果を発動できる」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "RM-061");
    expect(choiceIds(s)).toEqual(["RK-213:gr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-061:【ミサイル射出】— 選んだユニットはラッシュエリアに戻る（出典: atwiki/page-855「ラッシュエリアに戻す」）", () => {
    const s = resolveAll(pick(rushed(), "RK-213:gr"));
    expect(zoneOf(s, "player2", "RK-213:gr")).toBe("rush");
  });
});

// ===========================================================================
describe("RM-062 テントリーナ", () => {
  const TEXT =
    "【リーナステッキ】これが自軍エリアにある間、敵軍ターン中、自軍バトルエリアにある特徴「女」を持つユニットが、特徴「男」を持つユニットにアタックされたとき、自軍コマンドを1つホールドしてもよい。 そうしたとき、アタックされた自軍ユニットをラッシュエリアに戻す。このときバトルは行われない。";

  it("RM-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-860）", () => {
    expectCatalogText("RM-062", TEXT);
    expectStats("RM-062", { name: "テントリーナ", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["メカ", "人型"] });
    expectRarityIn("RM-062", ["N"]);
  });

  /** 敵軍ターン、attacker（player2）が自軍の defender にアタックしたところ（反応の前）。 */
  const attacked = (defender = "SPEC-FEM:f", attacker = "SPEC-MALE-ATK:a", p1: Partial<GameState["players"]["player1"]> = {}) =>
    attackedInEnemyTurn(
      { battle: [inst(defender.split(":")[0]!, defender.split(":")[1]!)], rush: [inst("RM-062", "tr")], command: releasedCat("WB", 1), ...p1 },
      defender,
      { battle: [inst(attacker.split(":")[0]!, attacker.split(":")[1]!)] },
      attacker,
      EXTRA,
    );

  it("RM-062:【リーナステッキ】— 敵軍ターン中、自軍バトルエリアの「女」のユニットが「男」のユニットにアタックされたとき、自軍コマンドを1つホールドするかを選べる（任意）（出典: atwiki/page-860「自軍バトルエリアにある特徴「女」を持つユニットが、特徴「男」を持つユニットにアタックされたとき、自軍コマンドを1つホールドしてもよい」）", () => {
    const s = attacked();
    expectChoiceFrom(s, "player1", "RM-062");
    expect(canSkip(s)).toBe(true);
  });

  it("RM-062:【リーナステッキ】— ホールドすると、アタックされたユニットはラッシュエリアに戻り、バトルは行われない（出典: atwiki/page-860「そうしたとき、アタックされた自軍ユニットをラッシュエリアに戻す。このときバトルは行われない」）", () => {
    const s = settle(resolveAll(pick(attacked(), "TST-OP:cWB0")));
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-FEM:f")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-MALE-ATK:a")).toBe("battle");
    expect(damageOf(s, "player1")).toBe(0);
  });

  it("RM-062:【リーナステッキ】— ホールドしなければ、ふつうにバトルする（出典: atwiki/page-860「ホールドしてもよい」）", () => {
    const s = settle(resolveAll(skip(attacked())));
    expect(zoneOf(s, "player1", "SPEC-FEM:f")).toBe("discard");
  });

  it("RM-062:【リーナステッキ】— アタックしたユニットが「男」を持たないとき・アタックされたユニットが「女」を持たないときは発動しない（出典: atwiki/page-860「特徴「女」を持つユニットが、特徴「男」を持つユニットにアタックされたとき」）", () => {
    expect(attacked("SPEC-FEM:f", "SPEC-PLAIN-ATK:a").pendingEffectChoice?.sourceCardId).not.toBe("RM-062");
    expect(attacked("SPEC-NOFEM:f").pendingEffectChoice?.sourceCardId).not.toBe("RM-062");
  });

  it("RM-062:【リーナステッキ】— ホールドできる自軍コマンドがなければ発動しない（出典: atwiki/page-860「自軍コマンドを1つホールドしてもよい」）", () => {
    expect(attacked("SPEC-FEM:f", "SPEC-MALE-ATK:a", { command: [] }).pendingEffectChoice?.sourceCardId).not.toBe("RM-062");
  });

  it("RM-062:【リーナステッキ】— テントリーナが自軍バトルエリアにあるときも発動する（出典: atwiki/page-860「これが自軍エリアにある間」・カード評価「自軍エリアにいれば能力の発動はできる」）", () => {
    const s = attacked("SPEC-FEM:f", "SPEC-MALE-ATK:a", { rush: [], battle: [inst("RM-062", "tr"), inst("SPEC-FEM", "f")] });
    expectChoiceFrom(s, "player1", "RM-062");
  });
});
