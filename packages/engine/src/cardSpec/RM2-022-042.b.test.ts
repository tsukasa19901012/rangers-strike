/**
 * カード別スペック: RM-029〜RM-035（スペシャルメタルエディション ジャスピオン〜凱聖クールギン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜3・rider.html）に本範囲のカードの項はない
 *     （「RM-029」〜「RM-035」とカード名で検索）。atwiki に転載された公式 Q&A は RK-194 仮面ライダーG3-X のページ（atwiki/page-999 Q1）に
 *     RM-035 凱聖クールギンが出てくるもの（「アタックしなければならない」）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマルレア／ノーマル」を SR／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - atwiki/page-999 Q1（G3-X の効果でクールギンを選べないとき、「メカ」の S ユニットは G3-X にアタック・ストライクできる）は
 *    RK10-190-210.a の RK-194 で it.todo（Q の前提が G3-X の本文「自軍ラッシュエリアの」と合わない）。ここでは Q1 の「アタックしなければならない」だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  attack,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  damageOf,
  deckCards,
  enemyBoard,
  enemyEnter,
  enter,
  entryOptions,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  held,
  heldN,
  inst,
  lastBattleBps,
  mount,
  opCard,
  pick,
  powerCards,
  rcUnit,
  released,
  releasedCat,
  resolveAll,
  rideOff,
  ridingPair,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  st,
  sUnit,
  targetsOf,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM2-022-042.helpers";

const NOSP = sUnit("SPEC-NOSP", { category: "OT", bp: 1000, sp: undefined });
const SPX = sUnit("SPEC-SPX", { category: "OT", bp: 1000, sp: "special" as never, comboNumber: 3 });
const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const OT_M = sUnit("SPEC-OT-M", { category: "OT", bp: 3000, size: "M" });
const OT_L = sUnit("SPEC-OT-L", { category: "OT", bp: 8000, size: "L" });
const ET_L = sUnit("SPEC-ET-L", { category: "ET", bp: 8000, size: "L" });
const BEAST = sUnit("SPEC-BEAST", { bp: 1000, features: ["獣"] });
const BEAST_BIG = sUnit("SPEC-BEAST-BIG", { bp: 9000, features: ["獣"] });
const DINO_M = sUnit("SPEC-DINO-M", { bp: 8000, size: "M", features: ["恐竜"] });
const C3 = sUnit("SPEC-C3", { bp: 9000, powerCost: 3 });
const C4P = sUnit("SPEC-C4P", { bp: 9000, powerCost: "4+" as never });
const CMD7 = opCard("SPEC-CMD7", 7);
const CMD4 = opCard("SPEC-CMD4", 4);
const POW3 = opCard("SPEC-POW3", 3);
const POW1 = opCard("SPEC-POW1", 1);
const MECHA = sUnit("SPEC-MECHA", { category: "WB", bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { category: "WB", bp: 3000, size: "M", features: ["メカ"] });
const RC_OT = rcUnit("SPEC-RC", { category: "OT" });
const EXTRA = [NOSP, SPX, ES, EM, OT_S, OT_M, OT_L, ET_L, BEAST, BEAST_BIG, DINO_M, C3, C4P, CMD7, CMD4, POW3, POW1, MECHA, MECHA_M, RC_OT, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battleBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RM-029 ジャスピオン", () => {
  const TEXT =
    "※SPが空欄ではない自軍Sユニットがあれば、これはバトルエリアに出られない。 【コズミックハーレー】敵軍山札の上から1枚をオモテにする。オモテにしたカードがWBを持つユニットカードなら、それを持ち主のラッシュエリアに出す。違うなら、そのカードを持ち主のパワーゾーンに送ってから、相手に1点ダメージを与える。";

  it("RM-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-896）", () => {
    expectCatalogText("RM-029", TEXT);
    expectStats("RM-029", { name: "ジャスピオン", category: "OT", size: "S", bp: 4000, sp: undefined, powerCost: 2, comboNumber: "RC", features: ["メカ", "男"] });
    expectRarityIn("RM-029", ["SR"]);
  });

  it("RM-029: ※ — SP が空欄ではない自軍 S ユニット（SP1・ラッシュエリア）があればバトルエリアに出られない（ライドしても出られない）（出典: atwiki/page-896「SPが空欄ではない自軍Sユニットがあれば、これはバトルエリアに出られない」）", () => {
    const s = battleBoard({ rush: [inst("RM-029", "j"), inst("TST-UNIT-0", "sp1"), inst("SPEC-VEHICLE", "v")] });
    expect(canEnter(s, "RM-029:j")).toBe(false);
    expect(canMount(s, "RM-029:j", "SPEC-VEHICLE:v")).toBe(false);
  });

  it("RM-029: ※ — SP が「！」の自軍 S ユニットも「空欄ではない」（出典: atwiki/page-896「SPが空欄ではない」）", () => {
    expect(canEnter(battleBoard({ rush: [inst("RM-029", "j"), inst("SPEC-SPX", "x")] }), "RM-029:j")).toBe(false);
  });

  it("RM-029: ※ — ほかの自軍 S ユニットの SP がすべて空欄で、SP を持つのが M ユニットや敵軍のユニットだけなら出られる（出典: atwiki/page-896「自軍Sユニット」・カード評価「MやLのユニット主体のデッキで運用する」）", () => {
    const s = battleBoard({ rush: [inst("RM-029", "j"), inst("SPEC-NOSP", "n"), inst("TST-UNIT-2", "m")] }, { battle: [inst("TST-UNIT-0", "e")] });
    expect(canEnter(s, "RM-029:j")).toBe(true);
  });

  /** 自軍バトルフェイズ、ジャスピオンが SPEC-VEHICLE にライドして出てライドオフする（敵軍山札は deck）。 */
  const rc = (deck: CardInstance[]) =>
    settle(rideOff(mount(battleBoard({ rush: [inst("RM-029", "j"), inst("SPEC-VEHICLE", "v")] }, { deck }), "RM-029:j", "SPEC-VEHICLE:v"), true));

  it("RM-029: RC【コズミックハーレー】— 敵軍山札の上のカードが WB のユニットカードなら、持ち主（敵軍）のラッシュエリアに出る（ダメージはない）（出典: atwiki/page-896「WBを持つユニットカードなら、それを持ち主のラッシュエリアに出す」）", () => {
    const s = resolveAll(rc([inst("TST-UNIT-0", "top"), ...deckCards(3, "e")]));
    expect(zoneOf(s, "player2", "TST-UNIT-0:top")).toBe("rush");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RM-029: RC【コズミックハーレー】— WB を持つユニットカードでなければ（OT のユニットカード）、持ち主のパワーゾーンに送ってから相手に1点ダメージ（出典: atwiki/page-896「違うなら、そのカードを持ち主のパワーゾーンに送ってから、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(rc([inst("SPEC-OT-S", "top"), ...deckCards(3, "e")]));
    expect(zoneOf(s, "player2", "SPEC-OT-S:top")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RM-029: RC【コズミックハーレー】— WB のオペレーションカードはユニットカードではないので、パワーゾーンに送って1点ダメージ（出典: atwiki/page-896「WBを持つユニットカードなら」・カード評価「ワイルドビースト以外が引ければ良い」）", () => {
    const s = resolveAll(rc([inst("TST-OP", "top"), ...deckCards(3, "e")]));
    expect(zoneOf(s, "player2", "TST-OP:top")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("RM-030 超惑星戦闘母艦ダイレオン", () => {
  const TEXT = "※これはSユニットにアタックすることができない。 【ダイレオンレーザー】これが自軍ラッシュエリアにある間、OTを持つ自軍Lユニットは、アタックされるときBP+2000される。";

  it("RM-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-843）", () => {
    expectCatalogText("RM-030", TEXT);
    expectStats("RM-030", { name: "超惑星戦闘母艦ダイレオン", category: "OT", size: "L", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["メカ", "母艦"] });
    expectRarityIn("RM-030", ["N"]);
  });

  it("RM-030: ※ — S ユニットにはアタックできない（M ユニットにはアタックできる）（出典: atwiki/page-843「これはSユニットにアタックすることができない」）", () => {
    const s = enter(battleBoard({ rush: [inst("RM-030", "dl")] }, { battle: [inst("SPEC-ES", "s"), inst("SPEC-EM", "m")] }), "RM-030:dl");
    expect(targetsOf(s, "RM-030:dl")).toEqual(["SPEC-EM:m"]);
  });

  /** 敵軍ターン、自軍バトルエリアの target が BP13000 にアタックされたときの防御側の BP。 */
  const defended = (target: CardInstance, rush: CardInstance[], battle: CardInstance[] = []) =>
    lastBattleBps(attackedInEnemyTurn({ battle: [target, ...battle], rush }, target.instanceId, {}, "TST-UNIT-7:atk", EXTRA))?.defender;

  it("RM-030:【ダイレオンレーザー】— 自軍ラッシュエリアにある間、OT の自軍 L ユニットはアタックされるとき BP+2000（出典: atwiki/page-843「OTを持つ自軍Lユニットは、アタックされるときBP+2000される」）", () => {
    expect(defended(inst("SPEC-OT-L", "l"), [inst("RM-030", "dl")])).toBe(10000);
  });

  it("RM-030:【ダイレオンレーザー】— これがバトルエリアにあるときは上がらない（出典: atwiki/page-843「これが自軍ラッシュエリアにある間」）", () => {
    expect(defended(inst("SPEC-OT-L", "l"), [], [inst("RM-030", "dl")])).toBe(8000);
  });

  it("RM-030:【ダイレオンレーザー】— OT を持たない L ユニット・OT の M ユニットは上がらない（出典: atwiki/page-843「OTを持つ自軍Lユニット」）", () => {
    expect(defended(inst("SPEC-ET-L", "l"), [inst("RM-030", "dl")])).toBe(8000);
    expect(defended(inst("SPEC-OT-M", "m"), [inst("RM-030", "dl")])).toBe(3000);
  });
});

// ===========================================================================
describe("RM-031 戦闘巨人ダイレオン", () => {
  const TEXT =
    "※自分が「超惑星戦闘母艦ダイレオン」をラッシュしたとき、自軍エリアに「戦闘巨人ダイレオン」があれば1体選んで手札に戻す。 【コズミッククラッシュ】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから、特徴「獣」または「恐竜」を持つBP8000以下のユニットを1体選び、持ち主のパワーゾーンに送ってもよい";

  it("RM-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-844）", () => {
    expectCatalogText("RM-031", TEXT);
    expectStats("RM-031", { name: "戦闘巨人ダイレオン", category: "OT", size: "L", bp: 5000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "return_named_to_hand" });
    expectRarityIn("RM-031", ["NR"]);
  });

  it("RM-031: 追加条件 — 自軍の超惑星戦闘母艦ダイレオンを1体手札に戻してラッシュする（出典: atwiki/page-844「自軍「超惑星戦闘母艦ダイレオン」1体を手札に戻す」）", () => {
    const r = rushVia(board({ hand: [inst("RM-031", "h")], rush: [inst("RM-030", "dl")], command: releasedCat("OT", 1), power: powerCards(6) }), "player1", "RM-031:h", (a) =>
      JSON.stringify(a.zordMaterialInstanceIds ?? a.zordMaterialInstanceId ?? "").includes("RM-030:dl"),
    );
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RM-031:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-030:dl")).toBe("hand");
  });

  it("RM-031: ※ — 自分が超惑星戦闘母艦ダイレオンをラッシュしたとき、自軍エリアの戦闘巨人ダイレオンを手札に戻す（出典: atwiki/page-844「自軍エリアに「戦闘巨人ダイレオン」があれば1体選んで手札に戻す」）", () => {
    const r = rushFromHand(board({ hand: [inst("RM-030", "h")], rush: [inst("RM-031", "gt")], command: releasedCat("OT", 1), power: powerCards(4) }), "player1", "RM-030:h");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state, ["RM-031:gt"]);
    expect(zoneOf(s, "player1", "RM-030:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-031:gt")).toBe("hand");
  });

  const ENEMY_BATTLE = [inst("SPEC-BEAST", "b"), inst("SPEC-DINO-M", "d"), inst("SPEC-BEAST-BIG", "big"), { ...inst("SPEC-BEAST", "mod"), bpModifier: 8000 }, inst("SPEC-ES", "p")];
  const entered = () => enter(battleBoard({ rush: [inst("RM-031", "gt")] }, { battle: ENEMY_BATTLE, rush: [inst("SPEC-BEAST", "r")] }), "RM-031:gt");

  it("RM-031:【コズミッククラッシュ】— 自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの「獣」「恐竜」を持つ BP8000 以下のユニット（サイズを問わない。いまの BP で見る）から1体選べる（ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-844「敵軍バトルエリアから、特徴「獣」または「恐竜」を持つBP8000以下のユニットを1体選び、持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-031");
    expect(choiceIds(s)).toEqual(["SPEC-BEAST:b", "SPEC-DINO-M:d"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-031:【コズミッククラッシュ】— 選んだユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-844）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DINO-M:d"));
    expect(zoneOf(s, "player2", "SPEC-DINO-M:d")).toBe("power");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RM-032 アイアンウルフ", () => {
  it("RM-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-845）", () => {
    expectCatalogText("RM-032", "※これにライドしているユニットはBP+500される。");
    expectVehicleStats("RM-032", { name: "アイアンウルフ", category: "OT", powerCost: 0, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RM-032", ["N"]);
  });

  it("RM-032: ※ — これにライドしているユニットは BP+500（出典: atwiki/page-845「これにライドしているユニットはBP+500される」）", () => {
    expect(bpOf(battleBoard({ battle: ridingPair("SPEC-RC", "r", "RM-032", "iw") }), "player1", "SPEC-RC:r")).toBe(1500);
  });
});

// ===========================================================================
describe("RM-033 メタルダー", () => {
  const TEXT =
    "※これはバトルするとき、これとバトルするユニットの必要パワーの数字と同じ必要パワーの数字を持つ自軍コマンド1つにつきBP+2000される。 【戦闘技術の習得】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアからユニットを1体選び、自軍コマンドゾーンにホールド状態で置いてもよい。置けなければこの効果は発動しない。";

  it("RM-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-870）", () => {
    expectCatalogText("RM-033", TEXT);
    expectStats("RM-033", { name: "メタルダー", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 2, comboNumber: undefined, features: ["メカ", "人型"] });
    expectRarityIn("RM-033", ["SR"]);
  });

  /** 自軍バトルフェイズ、メタルダーを出して（【戦闘技術の習得】は見送る）enemy にアタックしたときのアタック側の BP。 */
  const attacking = (command: CardInstance[], enemy: CardInstance) => {
    let s = enter(battleBoard({ rush: [inst("RM-033", "md")], command }, { battle: [enemy] }), "RM-033:md");
    if (s.pendingEffectChoice?.sourceCardId === "RM-033") s = skip(s);
    return lastBattleBps(settle(attack(s, "RM-033:md", enemy.instanceId)))?.attacker;
  };

  it("RM-033: ※ — アタックしてバトルするとき、相手の必要パワー（3）と同じ必要パワーの数字の自軍コマンド1つにつき BP+2000（ホールド状態のコマンドも数える。ほかの数字は数えない）（出典: atwiki/page-870「これとバトルするユニットの必要パワーの数字と同じ必要パワーの数字を持つ自軍コマンド1つにつきBP+2000される」・カード評価「最大でBP13000まで上昇する」）", () => {
    expect(attacking([released("TST-OP", "a"), held("TST-OP", "b"), released("TST-OP-OT", "c")], inst("SPEC-C3", "e"))).toBe(7000);
  });

  it("RM-033: ※ — 相手の必要パワーが「4+」なら数字の4を見る（出典: atwiki/page-870「必要パワーの数字」）", () => {
    expect(attacking([released("SPEC-CMD4", "a"), released("TST-OP", "b")], inst("SPEC-C4P", "e"))).toBe(5000);
  });

  it("RM-033: ※ — アタックされてバトルするときも上がる（必要パワー7+ の相手に、必要パワー7の自軍コマンド2つで BP7000）（出典: atwiki/page-870「これはバトルするとき」・カード評価「相手のアタックで撃破されづらくなる」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RM-033", "md")], command: [released("SPEC-CMD7", "a"), released("SPEC-CMD7", "b")] }, "RM-033:md", {}, "TST-UNIT-7:atk", EXTRA);
    expect(lastBattleBps(s)?.defender).toBe(7000);
  });

  it("RM-033: ※ — バトルしていないときは上がらない（BP3000）（出典: atwiki/page-870「これはバトルするとき」・カード評価「BPの上昇はバトル時に限定される」）", () => {
    expect(bpOf(battleBoard({ battle: [inst("RM-033", "md")], command: [released("TST-OP", "a")] }), "player1", "RM-033:md")).toBe(3000);
  });

  const entered = (command: CardInstance[] = []) =>
    enter(battleBoard({ rush: [inst("RM-033", "md"), inst("SPEC-ES", "u"), inst("SPEC-EM", "m"), inst("SPEC-VEHICLE", "v")], command }), "RM-033:md");

  it("RM-033:【戦闘技術の習得】— 自軍ターン中にバトルエリアに出たとき、自軍ラッシュエリアのユニット（サイズを問わない。ビークルは選べない）から1体選べる（任意）（出典: atwiki/page-870「自軍ラッシュエリアからユニットを1体選び、自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-033");
    expect(choiceIds(s)).toEqual(["SPEC-EM:m", "SPEC-ES:u"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-033:【戦闘技術の習得】— 選んだユニットは自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-870）", () => {
    const s = settle(pick(entered(), "SPEC-ES:u"));
    expect(zoneOf(s, "player1", "SPEC-ES:u")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-ES:u")?.commandHeld).toBe(true);
  });

  it("RM-033:【戦闘技術の習得】— コマンドゾーンが5枚なら発動しない（出典: atwiki/page-870「置けなければこの効果は発動しない」）", () => {
    const s = entered(heldN(5));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-033");
    expect(zoneOf(s, "player1", "SPEC-ES:u")).toBe("rush");
  });
});

// ===========================================================================
describe("RM-034 暴魂トップガンダー", () => {
  const TEXT =
    "※これがバトルエリアに出たとき、相手は1枚ドローしてもよい。 【正確な射撃】自軍コマンドゾーンからカードを1枚選びホールドしてもよい。そうしたとき、ホールドしたカードの必要パワーの数字を見て、その数字と同じパワーの数字を持つカードを、敵軍パワーゾーンのオモテ向きのカードの中から1枚選び、ウラ返してダメージにする。";

  it("RM-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-877）", () => {
    expectCatalogText("RM-034", TEXT);
    expectStats("RM-034", { name: "暴魂トップガンダー", category: "DA", size: "S", bp: 6000, sp: undefined, powerCost: 5, comboNumber: "RC", features: ["戦闘ロボット軍団", "メカ", "人型"] });
    expectRarityIn("RM-034", ["SR"]);
  });

  it("RM-034: ※ — バトルエリアに出たとき、相手がドローするかを選ぶ（任意）（出典: atwiki/page-877「相手は1枚ドローしてもよい」）", () => {
    const s = enter(battleBoard({ rush: [inst("RM-034", "tg")] }), "RM-034:tg");
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RM-034");
    expect(canSkip(s)).toBe(true);
  });

  it("RM-034: ※ — 相手がドローを選ぶと相手の手札が1枚増え、選ばなければ増えない（出典: atwiki/page-877）", () => {
    const drew = settle(accept(enter(battleBoard({ rush: [inst("RM-034", "tg")] }), "RM-034:tg")));
    expect(drew.players.player2.hand).toHaveLength(1);
    const declined = settle(skip(enter(battleBoard({ rush: [inst("RM-034", "tg")] }), "RM-034:tg")));
    expect(declined.players.player2.hand).toHaveLength(0);
  });

  const ENEMY_POWER = [faceUp("SPEC-POW3", "p3"), faceUp("SPEC-POW1", "p1"), faceDown("SPEC-POW3", "d3"), faceUp("TST-P", "p0")];
  /** 自軍バトルフェイズ、トップガンダーが SPEC-VEHICLE にライドして出て（相手のドローは見送る）ライドオフする（RC の選択まで）。 */
  const rc = (command: CardInstance[] = [released("TST-OP", "c3"), released("TST-OP-OT", "c1"), held("TST-OP", "h3")]) => {
    let s = mount(battleBoard({ rush: [inst("RM-034", "tg"), inst("SPEC-VEHICLE", "v")], command }, { power: ENEMY_POWER }), "RM-034:tg", "SPEC-VEHICLE:v");
    if (s.pendingEffectChoice?.playerId === "player2") s = skip(s);
    return rideOff(s, true);
  };

  it("RM-034: RC【正確な射撃】— 自軍コマンドゾーンのリリース状態のカードから1枚選んでホールドできる（任意）（出典: atwiki/page-877「自軍コマンドゾーンからカードを1枚選びホールドしてもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RM-034");
    expect(choiceIds(s)).toEqual(["TST-OP-OT:c1", "TST-OP:c3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RM-034: RC【正確な射撃】— ホールドしたカードの必要パワー（3）と同じパワーの数字の、敵軍パワーゾーンのオモテ向きのカードから1枚選ぶ（出典: atwiki/page-877「その数字と同じパワーの数字を持つカードを、敵軍パワーゾーンのオモテ向きのカードの中から1枚選び」）", () => {
    const s = pick(rc(), "TST-OP:c3");
    expect(cardIn(s, "player1", "TST-OP:c3")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RM-034");
    expect(choiceIds(s)).toEqual(["SPEC-POW3:p3"]);
  });

  it("RM-034: RC【正確な射撃】— 選んだカードはウラ返されてダメージになる（出典: atwiki/page-877「ウラ返してダメージにする」）", () => {
    const s = resolveAll(pick(pick(rc(), "TST-OP:c3"), "SPEC-POW3:p3"));
    expect(cardIn(s, "player2", "SPEC-POW3:p3")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RM-034: RC【正確な射撃】— ホールドしなければ何も起きない（出典: atwiki/page-877「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(rc()));
    expect(damageOf(s, "player2")).toBe(0);
    expect(cardIn(s, "player1", "TST-OP:c3")?.commandHeld).toBeFalsy();
  });
});

// ===========================================================================
describe("RM-035 凱聖クールギン", () => {
  const TEXT =
    "※これはアタックされるときBP+5000される。 【ヨロイ軍団の統率】これが自軍バトルエリアにある間、敵軍バトルフェイズ中、バトルエリアに出た特徴「メカ」を持つ敵軍Sユニットは、可能なら特徴「ヨロイ軍団」を持つユニットにアタックする。";

  it("RM-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-846）", () => {
    expectCatalogText("RM-035", TEXT);
    expectStats("RM-035", { name: "凱聖クールギン", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: "3+", comboNumber: undefined, features: ["ヨロイ軍団", "男"], rushCondition: "opponent_draw" });
    expectRarityIn("RM-035", ["NR"]);
  });

  it("RM-035: 追加条件 — ラッシュすると相手が1枚ドローする（出典: atwiki/page-846「相手に1枚ドローさせる」）", () => {
    const r = rushFromHand(board({ hand: [inst("RM-035", "h")], command: releasedCat("DA", 1), power: powerCards(3) }), "player1", "RM-035:h");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RM-035:h")).toBe("rush");
    expect(s.players.player2.hand).toHaveLength(1);
  });

  it("RM-035: ※ — アタックされるとき BP+5000（BP7000 でバトルする）（出典: atwiki/page-846「これはアタックされるときBP+5000される」）", () => {
    expect(lastBattleBps(attackedInEnemyTurn({ battle: [inst("RM-035", "cg")] }, "RM-035:cg", {}, "TST-UNIT-7:atk", EXTRA))?.defender).toBe(7000);
  });

  /** 敵軍バトルフェイズ、自軍バトルエリアに battle がいるところで、敵軍が unit をバトルエリアに出す。 */
  const enemyEntered = (unit: string, battle: CardInstance[] = [inst("RM-035", "cg"), inst("RM-036", "cb"), inst("TST-UNIT-0", "x")], rush: CardInstance[] = []) => {
    const [cid, suf] = unit.split(":") as [string, string];
    return enemyEnter(enemyBoard({ battle, rush }, { rush: [inst(cid, suf)] }, EXTRA), unit);
  };

  it("RM-035:【ヨロイ軍団の統率】— 敵軍バトルフェイズにバトルエリアに出た「メカ」の敵軍 S ユニットは、「ヨロイ軍団」のユニットにしかアタックできず、ストライクもパスもできない（出典: atwiki/page-846「可能なら特徴「ヨロイ軍団」を持つユニットにアタックする」・atwiki/page-999 Q1「「RM-035 凱聖クールギン」の効果により、特徴「ヨロイ軍団」を持つ敵軍ユニットにアタックしなければならない」）", () => {
    const s = enemyEntered("SPEC-MECHA:m");
    expect(entryOptions(s, "SPEC-MECHA:m", "player2")).toEqual({ targets: ["RM-035:cg", "RM-036:cb"], strike: false, pass: false });
  });

  it("RM-035:【ヨロイ軍団の統率】—「メカ」を持たない S ユニットは制限を受けない（出典: atwiki/page-846「特徴「メカ」を持つ敵軍Sユニット」）", () => {
    const s = enemyEntered("SPEC-ES:s");
    const o = entryOptions(s, "SPEC-ES:s", "player2");
    expect(o.targets).toContain("TST-UNIT-0:x");
    expect(o.strike).toBe(true);
  });

  it("RM-035:【ヨロイ軍団の統率】—「メカ」の M ユニットは制限を受けない（出典: atwiki/page-846「敵軍Sユニット」）", () => {
    const s = enemyEntered("SPEC-MECHA-M:m");
    expect(entryOptions(s, "SPEC-MECHA-M:m", "player2").targets).toContain("TST-UNIT-0:x");
  });

  it("RM-035:【ヨロイ軍団の統率】— これが自軍ラッシュエリアにあるときは制限しない（出典: atwiki/page-846「これが自軍バトルエリアにある間」）", () => {
    const s = enemyEntered("SPEC-MECHA:m", [inst("RM-036", "cb"), inst("TST-UNIT-0", "x")], [inst("RM-035", "cg")]);
    const o = entryOptions(s, "SPEC-MECHA:m", "player2");
    expect(o.targets).toContain("TST-UNIT-0:x");
    expect(o.strike).toBe(true);
  });

  it("RM-035:【ヨロイ軍団の統率】— 自軍バトルフェイズの自軍の「メカ」の S ユニットは制限を受けない（出典: atwiki/page-846「敵軍バトルフェイズ中」「敵軍Sユニット」）", () => {
    const s = enter(battleBoard({ battle: [inst("RM-035", "cg")], rush: [inst("SPEC-MECHA", "m")] }, { battle: [inst("TST-UNIT-0", "e"), inst("RM-036", "cb")] }), "SPEC-MECHA:m");
    const o = entryOptions(s, "SPEC-MECHA:m", "player1");
    expect(o.targets).toContain("TST-UNIT-0:e");
    expect(o.strike).toBe(true);
  });

  it("RM-035:【ヨロイ軍団の統率】— アタックを選んだ「メカ」のユニットはヨロイ軍団とバトルする（クールギンは BP7000 で守る）（出典: atwiki/page-846 カード評価「ヨロイ軍団はアタックされたときにBPが+されるユニットばかりなのでこの能力との相性は良い」）", () => {
    const s = settle(attack(enemyEntered("SPEC-MECHA:m"), "SPEC-MECHA:m", "RM-035:cg", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(7000);
    expect(zoneOf(s, "player2", "SPEC-MECHA:m")).toBe("discard");
  });
});
