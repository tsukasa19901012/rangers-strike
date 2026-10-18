/**
 * カード別スペック: RM-043〜RM-049（スペシャルメタルエディション 鳥忍 カラス天狗〜隊員コード011 サラ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「RM-043」〜「RM-049」とカード名で検索）。本範囲のカードページに atwiki 転載の公式 Q&A はない（ほかのカードのページの Q&A にも出てこない）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-KW-RC-01・R-CN-01・R-CN-05・R-RUSH-20/22）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマルレア／ノーマル」を SR／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  attackersOf,
  attackUntilRegister,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  confirm,
  deckCards,
  deckWithTen,
  enterAfter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  heldN,
  inst,
  mount,
  ncEnter,
  pick,
  pickAs,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rideOff,
  rideOffOffered,
  ridingPair,
  rushBoard,
  rushFromHand,
  skip,
  st,
  sUnit,
  targetsOf,
  vehicleCard,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM3-043-062.helpers";

const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const NOG = sUnit("SPEC-NOG", { category: "DA", bp: 1000, features: ["メカ"] });
const NOG2 = sUnit("SPEC-NOG2", { category: "DA", bp: 1000, features: ["怪人"] });
const NOG_M = sUnit("SPEC-NOG-M", { category: "DA", bp: 3000, size: "M", features: ["メカ"] });
const MALE = sUnit("SPEC-MALE", { category: "DA", bp: 1000, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { category: "DA", bp: 1000, features: ["女"] });
const MECHA = sUnit("SPEC-MECHA", { category: "ET", bp: 1000, features: ["メカ"] });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M" });
const COP = sUnit("SPEC-COP", { category: "ET", bp: 1000, sp: undefined, features: ["警察"] });
const NOCOP = sUnit("SPEC-NOCOP", { category: "ET", bp: 1000, sp: undefined, features: ["男"] });
const M_VEHICLE = vehicleCard("SPEC-MV", { size: "M" });
const EXTRA = [ES, EM, E2000, E4000, NOG, NOG2, NOG_M, MALE, FEMALE, MECHA, ET_S, DA_S, OT_S, DA_M, COP, NOCOP, M_VEHICLE, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battleBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RM-043 鳥忍　カラス天狗", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【3人1組】これをラッシュしたとき、自軍エリアの「鳥忍　カラス天狗」が3体以下なら、3体になるまで、自軍パワーゾーンのオモテ向きのカードか自軍コマンドゾーンのカードから「鳥忍　カラス天狗」のカードを選び、自軍ラッシュエリアに出してもよい。";

  it("RM-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-851）", () => {
    expectCatalogText("RM-043", TEXT);
    expectStats("RM-043", { name: "鳥忍　カラス天狗", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["妖魔一族", "忍者"] });
    expectRarityIn("RM-043", ["N"]);
  });

  it("RM-043: ※ デッキに好きな枚数（10枚）入れられる（出典: atwiki/page-851「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("RM-043", "鳥忍　カラス天狗")).toBe(true);
  });

  const POWER = [...powerCards(2), faceUp("RM-043", "p1"), faceUp("RM-043", "p2"), faceDown("RM-043", "pd")];
  /** 自軍ラッシュフェイズ、手札のカラス天狗をラッシュする（rush・battle は自軍エリアのカード）。 */
  const rushed = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    const r = rushFromHand(board({ hand: [inst("RM-043", "h")], power: POWER, command: [released("TST-OP-DA", "c0"), released("RM-043", "c1")], ...p1 }), "player1", "RM-043:h");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it.fails("RM-043:【3人1組】— ラッシュしたとき、自軍パワーゾーンのオモテ向きのカードか自軍コマンドゾーンのカードから「鳥忍　カラス天狗」を選べる（ウラ向きのダメージは選べない。任意）（出典: atwiki/page-851「自軍パワーゾーンのオモテ向きのカードか自軍コマンドゾーンのカードから「鳥忍　カラス天狗」のカードを選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "RM-043");
    expect(choiceIds(s)).toEqual(["RM-043:c1", "RM-043:p1", "RM-043:p2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-043:【3人1組】— 自軍エリアにこれだけなら、3体になるまで（2枚）選んで自軍ラッシュエリアに出せる（出典: atwiki/page-851「3体になるまで」・カード評価・コメント欄「序盤はゾーン送り…NCの数合わせ」）", () => {
    const s = resolveAll(pick(pick(rushed(), "RM-043:p1"), "RM-043:c1"));
    expect(zoneOf(s, "player1", "RM-043:p1")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-043:c1")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-043:p2")).toBe("power");
    expect(s.players.player1.rush.filter((c) => c.cardId === "RM-043")).toHaveLength(3);
  });

  it.fails("RM-043:【3人1組】— 自軍エリアにほかに1体（バトルエリアを含む）あれば、出せるのは1枚だけ（選ぶとすぐ出す）（出典: atwiki/page-851「自軍エリアの「鳥忍　カラス天狗」が3体以下なら、3体になるまで」）", () => {
    let s = pick(rushed({ battle: [inst("RM-043", "b0")] }), "RM-043:p1");
    expect(zoneOf(s, "player1", "RM-043:p1")).toBe("rush");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-043");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RM-043:p2")).toBe("power");
    expect(zoneOf(s, "player1", "RM-043:c1")).toBe("command");
  });

  it("RM-043:【3人1組】— 自軍エリアにすでに3体（これを含む）あれば選べない（出典: atwiki/page-851「3体になるまで」）", () => {
    const s = rushed({ rush: [inst("RM-043", "r0")], battle: [inst("RM-043", "b0")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-043");
  });

  it.fails("RM-043:【3人1組】— 1枚だけ選んで確定できる（出典: atwiki/page-851「出してもよい」）", () => {
    let s = confirm(pick(rushed(), "RM-043:p1"));
    expect(zoneOf(s, "player1", "RM-043:p1")).toBe("rush");
    if (s.pendingEffectChoice?.sourceCardId === "RM-043") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RM-043:c1")).toBe("command");
  });

  it.fails("RM-043:【3人1組】— 見送ればパワーゾーン・コマンドゾーンのカードは動かない（出典: atwiki/page-851「出してもよい」）", () => {
    const s = resolveAll(skip(rushed()));
    expect(zoneOf(s, "player1", "RM-043:p1")).toBe("power");
    expect(zoneOf(s, "player1", "RM-043:c1")).toBe("command");
    expect(zoneOf(s, "player1", "RM-043:h")).toBe("rush");
  });
});

// ===========================================================================
describe("RM-044 ジャンパーソン", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） ※これは特徴「男」または「女」を持つユニットにアタックできない。 【ジャンデジック】敵軍バトルエリアにある、特徴「男」または「女」を持たないSユニットを、すべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RM-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-878）", () => {
    expectCatalogText("RM-044", TEXT);
    expectStats("RM-044", { name: "ジャンパーソン", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["メカ", "人型", "警察"] });
    expectRarityIn("RM-044", ["SR"]);
  });

  it("RM-044: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-878 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-044", "jp")] }, "RM-044:jp"))).toBe(true);
  });

  it("RM-044: ※ — 特徴「男」または「女」を持つユニットにはアタックできない（持たないユニットにはアタックできる）（出典: atwiki/page-878「これは特徴「男」または「女」を持つユニットにアタックできない」）", () => {
    const s = battleBoard({ battle: [inst("RM-044", "jp")] }, { battle: [inst("SPEC-MALE", "m"), inst("SPEC-FEMALE", "f"), inst("SPEC-NOG", "n")] });
    expect(targetsOf(s, "RM-044:jp")).toEqual(["SPEC-NOG:n"]);
  });

  /** 自軍バトルフェイズ、ジャンパーソンが SPEC-VEHICLE にライドして出てライドオフする（RC の解決まで）。 */
  const rc = (p2: Partial<GameState["players"]["player2"]>) =>
    resolveAll(rideOff(mount(battleBoard({ rush: [inst("RM-044", "jp"), inst("SPEC-VEHICLE", "v")] }, { deck: deckCards(5, "e"), ...p2 }), "RM-044:jp", "SPEC-VEHICLE:v"), true));
  const ENEMY = {
    battle: [inst("SPEC-NOG", "n1"), inst("SPEC-MALE", "m"), inst("SPEC-NOG2", "n2"), inst("SPEC-FEMALE", "f"), inst("SPEC-NOG-M", "nm")],
    rush: [inst("SPEC-NOG", "r")],
  };

  it.fails("RM-044: RC【ジャンデジック】— 敵軍バトルエリアの、特徴「男」「女」を持たない S ユニットをすべて持ち主のコマンドゾーンにホールド状態で置く（「男」「女」のユニット・M ユニット・ラッシュエリアのユニットはそのまま）（出典: atwiki/page-878「敵軍バトルエリアにある、特徴「男」または「女」を持たないSユニットを、すべて持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = rc(ENEMY);
    for (const id of ["SPEC-NOG:n1", "SPEC-NOG2:n2"]) {
      expect(zoneOf(s, "player2", id)).toBe("command");
      expect(cardIn(s, "player2", id)?.commandHeld).toBe(true);
    }
    expect(zoneOf(s, "player2", "SPEC-MALE:m")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-FEMALE:f")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-NOG-M:nm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-NOG:r")).toBe("rush");
  });

  it.fails("RM-044: RC【ジャンデジック】— 置けなければ（敵軍コマンドゾーンが5枚）捨札にする（出典: atwiki/page-878「置けなければ捨札にする」）", () => {
    const s = rc({ ...ENEMY, command: heldN(5) });
    expect(zoneOf(s, "player2", "SPEC-NOG:n1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-NOG2:n2")).toBe("discard");
  });

  it.fails("RM-044: RC【ジャンデジック】— コマンドゾーンに1枚分しか空きがなければ、1体を置き、残りは捨札にする（出典: atwiki/page-878「置けなければ捨札にする」）", () => {
    const s = rc({ ...ENEMY, command: heldN(4) });
    const zones = [zoneOf(s, "player2", "SPEC-NOG:n1"), zoneOf(s, "player2", "SPEC-NOG2:n2")].sort();
    expect(zones).toEqual(["command", "discard"]);
    expect(s.players.player2.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("RM-045 ガンギブソン", () => {
  const TEXT =
    "※このユニットからコンビネーションする特徴「メカ」を持つSユニットは、ライドオフしなくてもＲＣの効果を発動できる。 【ホーミングブリッド】敵軍Sユニットの中から1体を、相手に選ばせてもよい（相手が選ぶたび、まだ相手に選ばれてない敵軍Sユニットがあれば、その中から選びなおさせてもよい。ただし、自軍コマンドを1つホールドすること）。その後、相手が最終的に選んだ1体を撃破する。";

  it("RM-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-887）", () => {
    expectCatalogText("RM-045", TEXT);
    expectStats("RM-045", { name: "ガンギブソン", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: "RC", features: ["メカ", "人型"] });
    expectRarityIn("RM-045", ["SR"]);
  });

  /** 自軍バトルフェイズ、バトルエリアの left の次に、rider が SPEC-VEHICLE にライドして出る（ライドオフの選択まで）。 */
  const riding = (left: CardInstance[], rider: string) =>
    mount(battleBoard({ battle: left, rush: [inst(rider.split(":")[0]!, rider.split(":")[1]!), inst("SPEC-VEHICLE", "v")] }, { rush: [inst("SPEC-E4000", "e")] }), rider, "SPEC-VEHICLE:v");

  it.fails("RM-045: ※ — これからコンビネーションする特徴「メカ」の S ユニット（宇宙刑事ギャバン）は、ライドオフしないで進んでも RC の効果を発動する（出典: atwiki/page-887「このユニットからコンビネーションする特徴「メカ」を持つSユニットは、ライドオフしなくてもＲＣの効果を発動できる」・カード評価「ジャンパーソンやギャバンなどの能力をライドオフさせなくても発動出来る」）", () => {
    let s = riding([inst("RM-045", "gg")], "RM-018:g");
    expect(rideOffOffered(s)).toBe(true);
    s = rideOff(s, false);
    expectChoiceFrom(s, "player1", "RM-018");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:e"]);
    expect(cardIn(s, "player1", "RM-018:g")?.mountedOnInstanceId).toBe("SPEC-VEHICLE:v");
  });

  it("RM-045: ※ — 特徴「メカ」を持たない RC のユニット（城忍 フクロウ男爵）は、ライドオフしなければ RC の効果を発動しない（出典: atwiki/page-887「特徴「メカ」を持つSユニットは」・R-KW-RC-01）", () => {
    const s = rideOff(riding([inst("RM-045", "gg")], "RM-041:fk"), false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-041");
  });

  it("RM-045: ※ — ガンギブソンの次に並ばなければ（間にほかのユニット）ライドオフしないと RC の効果は発動しない（出典: atwiki/page-887「このユニットからコンビネーションする」）", () => {
    const s = rideOff(riding([inst("RM-045", "gg"), inst("TST-UNIT-0", "f")], "RM-018:g"), false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-018");
  });

  const ENEMY = { battle: [inst("SPEC-ES", "a"), inst("SPEC-EM", "m")], rush: [inst("SPEC-ES", "b"), inst("RK-054", "ga")] };
  /** 自軍バトルフェイズ、ガンギブソンが SPEC-VEHICLE にライドして出てライドオフする（RC の選択まで）。 */
  const rc = (command: CardInstance[] = releasedCat("WB", 1)) =>
    rideOff(mount(battleBoard({ rush: [inst("RM-045", "gg"), inst("SPEC-VEHICLE", "v")], command }, ENEMY), "RM-045:gg", "SPEC-VEHICLE:v"), true);

  it.fails("RM-045: RC【ホーミングブリッド】— 相手に選ばせるかを選べる（任意）（出典: atwiki/page-887「敵軍Sユニットの中から1体を、相手に選ばせてもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RM-045");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-045: RC【ホーミングブリッド】— 相手が敵軍 S ユニット（エリアを問わない。M ユニットは選べない。「相手に選ばれない」ユニットも含む）から1体を選ぶ（出典: atwiki/page-887「敵軍Sユニットの中から1体を、相手に選ばせて」・カード評価「対象を選ぶのは相手なので…「これは相手に選ばれない」というテキストを持ったユニットも撃破可能」）", () => {
    const s = accept(rc());
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RM-045");
    expect(choiceIds(s)).toEqual(["RK-054:ga", "SPEC-ES:a", "SPEC-ES:b"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RM-045: RC【ホーミングブリッド】— 相手が選んだあと、まだ選ばれていない敵軍 S ユニットがあり自軍コマンドをホールドできれば、選びなおさせるかを選べる（任意）（出典: atwiki/page-887「まだ相手に選ばれてない敵軍Sユニットがあれば、その中から選びなおさせてもよい。ただし、自軍コマンドを1つホールドすること」）", () => {
    const s = pickAs(accept(rc()), "player2", "SPEC-ES:a");
    expect(choicePlayer(s)).toBe("player1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RM-045");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-045: RC【ホーミングブリッド】— 選びなおさせなければ、相手が選んだ1体を撃破する（出典: atwiki/page-887「その後、相手が最終的に選んだ1体を撃破する」）", () => {
    const s = resolveAll(skip(pickAs(accept(rc()), "player2", "SPEC-ES:a")));
    expect(zoneOf(s, "player2", "SPEC-ES:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:b")).toBe("rush");
  });

  it.fails("RM-045: RC【ホーミングブリッド】— 選びなおさせると自軍コマンドを1つホールドし、相手はまだ選んでいない S ユニットから選びなおす。最後に選んだ1体を撃破する（出典: atwiki/page-887「選びなおさせてもよい。ただし、自軍コマンドを1つホールドすること」・カード評価「コマンドをホールドすることで残りから強制的に再度選ばせる」）", () => {
    let s = accept(pickAs(accept(rc()), "player2", "SPEC-ES:a"));
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["RK-054:ga", "SPEC-ES:b"]);
    s = resolveAll(pickAs(s, "player2", "SPEC-ES:b"));
    expect(zoneOf(s, "player2", "SPEC-ES:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:a")).toBe("battle");
  });

  it.fails("RM-045: RC【ホーミングブリッド】— ホールドできる自軍コマンドがなければ選びなおさせられず、相手が選んだ1体を撃破する（出典: atwiki/page-887「ただし、自軍コマンドを1つホールドすること」）", () => {
    const s = pickAs(accept(rc([])), "player2", "SPEC-ES:a");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-045");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-ES:a")).toBe("discard");
  });

  it.fails("RM-045: RC【ホーミングブリッド】— 相手に選ばせなければ何も起きない（出典: atwiki/page-887「選ばせてもよい」）", () => {
    const s = resolveAll(skip(rc()));
    expect(zoneOf(s, "player2", "SPEC-ES:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ES:b")).toBe("rush");
  });
});

// ===========================================================================
describe("RM-046 アールジーコ", () => {
  const TEXT =
    "※これはアタックすることができない。 ※これはBP2000以上の敵軍Sユニットにアタックされない。 【ジックキャノン】これが特徴「メカ」と「警察」を持つSユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍バトルエリアから、自軍コマンドゾーンにないカテゴリを持つ敵軍Sユニットを1体選び撃破する。";

  it("RM-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-856）", () => {
    expectCatalogText("RM-046", TEXT);
    expectStats("RM-046", { name: "アールジーコ", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: "R", features: ["メカ"] });
    expectRarityIn("RM-046", ["N"]);
  });

  it("RM-046: ※ — アタックできない（出典: atwiki/page-856「これはアタックすることができない」）", () => {
    const s = battleBoard({ battle: [inst("RM-046", "z")] }, { battle: [inst("SPEC-ES", "e")] });
    expect(targetsOf(s, "RM-046:z")).toEqual([]);
  });

  it("RM-046: ※ — BP2000 以上の敵軍 S ユニットにはアタックされない（BP2000 未満の S ユニット・M ユニットにはアタックされる）（出典: atwiki/page-856「これはBP2000以上の敵軍Sユニットにアタックされない」・カード評価「BP2000以上からは攻撃を受けない」）", () => {
    const s = st(
      { activePlayer: "player2", player1: { deck: deckCards(5), battle: [inst("RM-046", "z")] }, player2: { deck: deckCards(5, "e"), battle: [inst("SPEC-E2000", "a"), inst("SPEC-ES", "b"), inst("SPEC-EM", "m")] } },
      EXTRA,
    );
    expect(attackersOf(s, "RM-046:z")).toEqual(["SPEC-EM:m", "SPEC-ES:b"]);
  });

  const ENEMY = {
    battle: [inst("SPEC-ES", "wb"), inst("SPEC-ET-S", "et"), inst("TST-UNIT-WB-ET", "mx"), inst("SPEC-EM", "mm")],
    rush: [inst("SPEC-ES", "r")],
  };
  /** 自軍バトルフェイズ、left の次にアールジーコを出す（自軍コマンドゾーンは ET のカードだけ）。 */
  const jc = (left: CardInstance[]) => enterAfter("RM-046:z", left, { command: [released("TST-OP-ET", "c")] }, ENEMY, EXTRA);

  it.fails("RM-046: JC【ジックキャノン】— 特徴「メカ」と「警察」を持つ S ユニット（宇宙刑事ギャバン）からコンビネーションするとき、敵軍バトルエリアの、自軍コマンドゾーンにないカテゴリを持つ S ユニットから1体選べる（任意）（出典: atwiki/page-856「これが特徴「メカ」と「警察」を持つSユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍バトルエリアから、自軍コマンドゾーンにないカテゴリを持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = jc([inst("RM-018", "g")]);
    expectChoiceFrom(s, "player1", "RM-046");
    expect(choiceIds(s)).toEqual(["SPEC-ES:wb", "TST-UNIT-WB-ET:mx"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-046: JC【ジックキャノン】— 選んだユニットを撃破する（出典: atwiki/page-856「1体選び撃破する」）", () => {
    const s = resolveAll(pick(jc([inst("RM-018", "g")]), "SPEC-ES:wb"));
    expect(zoneOf(s, "player2", "SPEC-ES:wb")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ET-S:et")).toBe("battle");
  });

  it("RM-046: JC【ジックキャノン】— 「警察」を持たない「メカ」の S ユニットからでは発動しない（出典: atwiki/page-856「特徴「メカ」と「警察」を持つSユニットから」）", () => {
    const s = jc([inst("SPEC-MECHA", "m")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-046");
  });
});

// ===========================================================================
describe("RM-047 ダークジェイカー", () => {
  const TEXT =
    "※特徴「警察」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。 【ビッグキャノン】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから、ライドされていないSビークルを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければこの効果は発動できない。";

  it("RM-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-857）", () => {
    expectCatalogText("RM-047", TEXT);
    expectVehicleStats("RM-047", { name: "ダークジェイカー", category: "ET", powerCost: 5, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RM-047", ["N"]);
  });

  it("RM-047: ※ — 特徴「警察」を持つ S ユニットは RC を持っていなくてもライドできる（「警察」を持たず RC もないユニットはライドできない）（出典: atwiki/page-857「特徴「警察」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    const s = battleBoard({ rush: [inst("SPEC-COP", "c"), inst("SPEC-NOCOP", "n"), inst("RM-047", "dj")] });
    expect(canMount(s, "SPEC-COP:c", "RM-047:dj")).toBe(true);
    expect(canMount(s, "SPEC-NOCOP:n", "RM-047:dj")).toBe(false);
  });

  const ENEMY = {
    battle: [inst("SPEC-VEHICLE", "ev"), ...ridingPair("SPEC-ES", "r", "SPEC-VEHICLE", "rv"), inst("SPEC-MV", "mv")],
    rush: [inst("SPEC-VEHICLE", "rs")],
  };
  /** 自軍バトルフェイズ、「警察」の S ユニットがダークジェイカーにライドしてバトルエリアに出る（ビークルの効果の選択まで）。 */
  const entered = (p2: Partial<GameState["players"]["player2"]> = ENEMY) =>
    mount(battleBoard({ rush: [inst("SPEC-COP", "c"), inst("RM-047", "dj")] }, p2), "SPEC-COP:c", "RM-047:dj");

  it.fails("RM-047:【ビッグキャノン】— 自軍ターン中、バトルエリアに出たとき、敵軍バトルエリアのライドされていない S ビークルを1体選ぶ（ライドされているビークル・M ビークル・ラッシュエリアのビークルは選べない。見送れない）（出典: atwiki/page-857「敵軍バトルエリアから、ライドされていないSビークルを1体選び、持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-047");
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:ev"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RM-047:【ビッグキャノン】— 選んだビークルは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-857）", () => {
    const s = resolveAll(pick(entered(), "SPEC-VEHICLE:ev"));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:ev")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-VEHICLE:ev")?.commandHeld).toBe(true);
  });

  it("RM-047:【ビッグキャノン】— 敵軍コマンドゾーンが5枚なら発動しない（出典: atwiki/page-857「置けなければこの効果は発動できない」）", () => {
    const s = entered({ ...ENEMY, command: heldN(5) });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-047");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-VEHICLE:ev")).toBe("battle");
  });
});

// ===========================================================================
describe("RM-048 隊員コード153 ショウ", () => {
  const TEXT =
    "【フレイムスローワー】敵軍バトルエリアから、DAまたはOTを持つSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければこの効果は発動できない。（この効果は、特徴「スワット」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する）";

  it("RM-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-886）", () => {
    expectCatalogText("RM-048", TEXT);
    expectStats("RM-048", { name: "隊員コード153 ショウ", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 2, comboNumber: 1, features: ["男", "警察", "スワット"] });
    expectRarityIn("RM-048", ["SR"]);
  });

  const ENEMY = { battle: [inst("SPEC-DA-S", "d"), inst("SPEC-OT-S", "o"), inst("SPEC-ES", "w"), inst("SPEC-DA-M", "dm")], rush: [inst("SPEC-DA-S", "r")] };
  const nc = (fillerCount: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = ENEMY) => ncEnter("RM-048:sh", fillerCount, p1, p2, EXTRA);

  it.fails("RM-048: NC【フレイムスローワー】— 敵軍バトルエリアの DA か OT を持つ S ユニットから1体選ぶ（WB・M ユニット・ラッシュエリアは選べない。見送れない）（出典: atwiki/page-886「敵軍バトルエリアから、DAまたはOTを持つSユニットを1体選び」）", () => {
    const s = nc(0);
    expectChoiceFrom(s, "player1", "RM-048");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:d", "SPEC-OT-S:o"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RM-048: NC — 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-886「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(nc(0), "SPEC-OT-S:o"));
    expect(zoneOf(s, "player2", "SPEC-OT-S:o")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-OT-S:o")?.commandHeld).toBe(true);
  });

  it("RM-048: NC — 敵軍コマンドゾーンが5枚なら発動しない（出典: atwiki/page-886「置けなければこの効果は発動できない」）", () => {
    const s = nc(0, {}, { ...ENEMY, command: heldN(5) });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-048");
  });

  it("RM-048: NC — バトルエリアの1番目でなければ（特徴「スワット」のないユニットの次）発動しない（出典: atwiki/page-886 CN1・R-CN-01）", () => {
    const s = nc(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-048");
  });

  it.fails("RM-048: NC — 特徴「スワット」を持つユニット（隊員コード011 サラ）からコンビネーションするときは、ナンバーに関係なく発動する（出典: atwiki/page-886「この効果は、特徴「スワット」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する」・R-CN-05）", () => {
    const s = nc(1, { battle: [inst("RM-049", "sr")] });
    expectChoiceFrom(s, "player1", "RM-048");
  });
});

// ===========================================================================
describe("RM-049 隊員コード011 サラ", () => {
  const TEXT =
    "【ディクテイター】敵軍コマンドゾーンから、DAまたはOTを持つカードを1枚選び、持ち主のパワーゾーンに送る。（この効果は、特徴「スワット」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する）";

  it("RM-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-858）", () => {
    expectCatalogText("RM-049", TEXT);
    expectStats("RM-049", { name: "隊員コード011 サラ", category: "ET", size: "S", bp: 1000, sp: "1/5", powerCost: 0, comboNumber: 2, features: ["女", "警察", "スワット"] });
    expectRarityIn("RM-049", ["N"]);
  });

  const ENEMY = { command: [released("TST-OP-DA", "d"), { ...inst("TST-OP-OT", "o"), commandHeld: true }, released("TST-OP", "w"), released("SPEC-DA-S", "u")] };
  const nc = (fillerCount: number, p1: Partial<GameState["players"]["player1"]> = {}) => ncEnter("RM-049:sa", fillerCount, p1, ENEMY, EXTRA);

  it.fails("RM-049: NC【ディクテイター】— 敵軍コマンドゾーンの DA か OT を持つカード（リリース状態・ホールド状態、ユニットのカードを含む）から1枚選ぶ（WB のカードは選べない。見送れない）（出典: atwiki/page-858「敵軍コマンドゾーンから、DAまたはOTを持つカードを1枚選び」・カード評価「リリースされたコマンドも除去できる」）", () => {
    const s = nc(1);
    expectChoiceFrom(s, "player1", "RM-049");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:u", "TST-OP-DA:d", "TST-OP-OT:o"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RM-049: NC — 選んだカードは持ち主のパワーゾーンに（オモテ向きで）送られる（出典: atwiki/page-858「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(nc(1), "TST-OP-OT:o"));
    expect(zoneOf(s, "player2", "TST-OP-OT:o")).toBe("power");
    expect(cardIn(s, "player2", "TST-OP-OT:o")?.faceDown ?? false).toBe(false);
  });

  it("RM-049: NC — バトルエリアの2番目でなければ発動しない（出典: atwiki/page-858 CN2・R-CN-01）", () => {
    const s = nc(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-049");
  });

  it.fails("RM-049: NC — 特徴「スワット」を持つユニット（隊員コード153 ショウ）からコンビネーションするときは、ナンバーに関係なく発動する（出典: atwiki/page-858「ナンバーに関係なく発動する」・R-CN-05）", () => {
    const s = nc(1, { battle: [inst("RM-048", "sh")] });
    expectChoiceFrom(s, "player1", "RM-049");
  });
});
