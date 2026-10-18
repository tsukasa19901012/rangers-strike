/**
 * カード別スペック: RM-015〜RM-021（スペシャルメタルエディション インプットカードガン〜ギラン円盤）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし。RM-017 はスターター再録版の記載の読み替えだけで、パック版の本文と同じ）。
 *     grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない（「RM-015」〜「RM-021」とカード名で検索）。
 *     atwiki に転載された公式 Q&A（RM-017 Q1・RM-018 Q1〜Q3・atwiki/page-2250 Q3（リードと RM-015）・atwiki/page-1913 Q3（XG3-049 と RM-015））
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01・R-KW-CHASE-01・R-KW-RC-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「メモリアルレア／スーパーレア／ノーマルレア／ノーマル」を MR／SR／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - RM-018 のチェイスそのもの（R-KW-CHASE-01・02）は rulesSpec/07-chase.test.ts。
 *  - RM-018 Q1（パトストライカーの追加条件に指定してチェイスすると追加条件を満たせない）は RS1-024-046.units-b の RS-043 で it.todo。
 *  - RM-018 Q2（ニンジャイエローの「直接ダメージにする効果」でもチェイスできる）は RS7-453-473.a の RS-459 で照合済み。
 *  - RM-018 Q3（ベン・G【人身略取】の追加条件で捨札にするときもチェイスでき、効果は続行する）は RS5-306-326.c の RS-322 で照合済み。
 *  - リードを持つユニットも RM-015 の「使用するためにホールドしたコマンド」として参照される（atwiki/page-2250 Q3）は rulesSpec/07-call-read.test.ts で it.todo。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  canMount,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enemyAttack,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  heldN,
  inst,
  lastBattleBps,
  passEntry,
  pick,
  played,
  powerCards,
  rcRideOff,
  rcUnit,
  released,
  releasedCat,
  residentOp,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM1-001-021.helpers";

const CMD2 = sUnit("SPEC-CMD2", { category: "WB", bp: 1000, powerCost: 2 });
const CMD3P = sUnit("SPEC-CMD3P", { category: "WB", bp: 1000, powerCost: "3+" as never });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C2B = sUnit("SPEC-C2B", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3P = sUnit("SPEC-C3P", { bp: 1000, powerCost: "3+" as never });
const C2M = sUnit("SPEC-C2M", { bp: 3000, powerCost: 2, size: "M" });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const EM5000 = sUnit("SPEC-EM5000", { bp: 5000, size: "M" });
const M4 = sUnit("SPEC-M4", { category: "WB", bp: 3000, size: "M", powerCost: 4 });
const M5 = sUnit("SPEC-M5", { category: "WB", bp: 3000, size: "M", powerCost: 5 });
const RC_PLAIN = rcUnit("SPEC-RC");
const VEHICLE_L = { id: "SPEC-VL", name: "SPEC-VL", type: "vehicle", category: "OT", rarity: "N", expansion: "card-spec", powerCost: 3, size: "L", features: ["メカ"] } as unknown as CardDefinition;
const EXTRA = [CMD2, CMD3P, C2, C2B, C3, C3P, C2M, ET_S, OT_S, E4000, E3000, EM5000, M4, M5, RC_PLAIN, VEHICLE_L, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RM-015 インプットカードガン", () => {
  const TEXT =
    "このオペレーションカードを使用するためにホールドしたコマンドの必要パワーの数字を見て、その数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。そうして撃破したユニットが捨札になる前に敵軍捨札を見て、撃破したユニットと同じカード名のユニットカードがあれば、このカードが捨札になるとき、かわりに手札に戻してもよい。";

  const ENEMY_RUSH = [inst("SPEC-C2", "r2"), inst("SPEC-C3", "r3"), inst("SPEC-C3P", "r3p"), inst("SPEC-C2M", "m2")];
  const used = (command: CardInstance = released("SPEC-CMD2", "cmd"), p2: Partial<GameState["players"]["player2"]> = {}) =>
    played(board({ hand: [inst("RM-015", "op")], command: [command], power: powerCards(3) }, { rush: ENEMY_RUSH, battle: [inst("SPEC-C2B", "b2")], ...p2 }), "RM-015:op");

  it("RM-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-893）", () => {
    expectCatalogText("RM-015", TEXT);
    expectOpStats("RM-015", { name: "インプットカードガン", category: "WB", powerCost: 3 });
    expectRarityIn("RM-015", ["MR", "N"]);
  });

  it.fails("RM-015: 使うためにホールドしたコマンドの必要パワー（2）と同じ必要パワーの敵軍 S ユニット（ラッシュエリア・バトルエリア）から1体選ぶ。M ユニット・必要パワーの違うユニットは選べない（出典: atwiki/page-893「その数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = used();
    expect(cardIn(s, "player1", "SPEC-CMD2:cmd")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RM-015");
    expect(choiceIds(s)).toEqual(["SPEC-C2:r2", "SPEC-C2B:b2"]);
  });

  it.fails("RM-015: 選んだユニットは撃破されて捨札になる。敵軍捨札に同じカード名のユニットカードがなければ、このカードは捨札になる（出典: atwiki/page-893）", () => {
    const s = resolveAll(pick(used(), "SPEC-C2:r2"));
    expect(zoneOf(s, "player2", "SPEC-C2:r2")).toBe("discard");
    expect(zoneOf(s, "player1", "RM-015:op")).toBe("discard");
  });

  it.fails("RM-015: 撃破したユニットが捨札になる前に、敵軍捨札に同じカード名のユニットカードがあれば、このカードを捨札にするかわりに手札に戻せる（任意）（出典: atwiki/page-893「このカードが捨札になるとき、かわりに手札に戻してもよい」）", () => {
    let s = settle(pick(used(undefined, { discard: [inst("SPEC-C2", "d2")] }), "SPEC-C2:r2"));
    expectChoiceFrom(s, "player1", "RM-015");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(accept(s));
    expect(zoneOf(s, "player1", "RM-015:op")).toBe("hand");
  });

  it.fails("RM-015: 戻さなければ、このカードは捨札になる（出典: atwiki/page-893「手札に戻してもよい」）", () => {
    const s = resolveAll(skip(settle(pick(used(undefined, { discard: [inst("SPEC-C2", "d2")] }), "SPEC-C2:r2"))));
    expect(zoneOf(s, "player1", "RM-015:op")).toBe("discard");
  });

  it.fails("RM-015: 撃破したユニット自身は「捨札になる前」の敵軍捨札に含まれない（同じカード名のカードが捨札になければ戻せない）（出典: atwiki/page-893「そうして撃破したユニットが捨札になる前に敵軍捨札を見て」）", () => {
    const s = settle(pick(used(undefined, { discard: [inst("SPEC-C3", "d3")] }), "SPEC-C2:r2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-015");
    expect(zoneOf(resolveAll(s), "player1", "RM-015:op")).toBe("discard");
  });

  it.fails("RM-015: ホールドしたコマンドの必要パワーが「3+」なら、数字の3を見る（必要パワー3・3+ の敵軍 S ユニットを選べる）（出典: atwiki/page-893「必要パワーの数字を見て」）", () => {
    expect(choiceIds(used(released("SPEC-CMD3P", "cmd")))).toEqual(["SPEC-C3:r3", "SPEC-C3P:r3p"]);
  });

  it.todo(
    "RM-015: 公式Q&A — 「XG3-049 ストレンジベント」で相手に選ばれて発動したときは、「使用するためにホールドしたコマンド」がないので処理は中断される（出典: atwiki/page-1913 Q3）— XG3-049 の照合（XG3 シリーズ）が未着手で、相手のオペレーションを発動する手順をまだ確かめていない",
  );
});

// ===========================================================================
describe("RM-016 スターピース", () => {
  const TEXT =
    "自軍パワーゾーンのダメージになってるカードをすべてオモテにする。そして、相手は自分自身の山札を見て、ユニットカードを1枚選び、自分自身のラッシュエリアに出してもよい。その後、相手は自分自身の山札をシャッフルする。";

  const ENEMY_DECK = [inst("SPEC-E4000", "u"), inst("TST-OP", "op"), inst("TST-UNIT-7", "big"), ...deckCards(2, "e")];
  const used = () =>
    played(board({ hand: [inst("RM-016", "op")], command: releasedCat("OT", 1), power: [...powerCards(10), ...damageCards(3)] }, { deck: ENEMY_DECK }), "RM-016:op");

  it("RM-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-832）", () => {
    expectCatalogText("RM-016", TEXT);
    expectOpStats("RM-016", { name: "スターピース", category: "OT", powerCost: 13 });
    expectRarityIn("RM-016", ["MR"]);
  });

  it.fails("RM-016: 自軍パワーゾーンのダメージ（ウラ向きのカード）がすべてオモテになる（出典: atwiki/page-832「自軍パワーゾーンのダメージになってるカードをすべてオモテにする」）", () => {
    const s = resolveAll(used());
    expect(s.players.player1.power.every((c) => !c.faceDown)).toBe(true);
    expect(damageOf(s, "player1")).toBe(0);
  });

  it.fails("RM-016: 相手が自分の山札のユニットカード（サイズを問わない）から1枚選ぶ（任意）（出典: atwiki/page-832「相手は自分自身の山札を見て、ユニットカードを1枚選び、自分自身のラッシュエリアに出してもよい」・カード評価「出せるユニットに制限は無い」）", () => {
    const s = used();
    expectChoiceFrom(s, "player2", "RM-016");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:u", "TST-UNIT-7:big"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-016: 相手が選んだユニットカードは相手のラッシュエリアに出る（出典: atwiki/page-832）", () => {
    const s = resolveAll(pick(used(), "TST-UNIT-7:big"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("rush");
    expect(s.players.player2.deck).toHaveLength(ENEMY_DECK.length - 1);
  });
});

// ===========================================================================
describe("RM-017 オメデトロフィー", () => {
  const TEXT =
    "※常駐 自軍ユニットがバトルエリアに出たとき、自軍山札の上から1枚を見る。そのカードのカテゴリが、バトルエリアに出たユニットのカテゴリと同じなら、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（コマンドゾーンに置けるカードは通常5枚まで）。そうしないとき、そのカードを山札の上に戻すか下に戻すかを選択する。";

  /** 自軍バトルフェイズ、オメデトロフィーを常駐させ、ラッシュエリアの SPEC-ET-S をバトルエリアに出す。 */
  const entered = (deck: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(st({ player1: { operation: [residentOp("RM-017", "tr")], rush: [inst("SPEC-ET-S", "u"), inst("SPEC-OT-S", "o")], deck, ...p1 }, player2: { deck: deckCards(5, "e") } }, EXTRA), "SPEC-ET-S:u");

  it("RM-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-885）", () => {
    expectCatalogText("RM-017", TEXT);
    expectOpStats("RM-017", { name: "オメデトロフィー", category: "ET", powerCost: 2 });
    expectRarityIn("RM-017", ["MR", "N"]);
  });

  it.fails("RM-017: 自軍ユニットがバトルエリアに出たとき、山札の上のカードが同じカテゴリなら、コマンドゾーンに置くか、山札の上・下に戻すかを選ぶ（出典: atwiki/page-885）", () => {
    const s = entered([inst("TST-OP-ET", "top"), ...deckCards(3)]);
    expectChoiceFrom(s, "player1", "RM-017");
    expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top", "to_command"]);
  });

  it.fails("RM-017: コマンドゾーンに置くとホールド状態で置かれる（出典: atwiki/page-885「そのカードを自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = resolveAll(pick(entered([inst("TST-OP-ET", "top"), ...deckCards(3)]), "to_command"));
    expect(zoneOf(s, "player1", "TST-OP-ET:top")).toBe("command");
    expect(cardIn(s, "player1", "TST-OP-ET:top")?.commandHeld).toBe(true);
  });

  it.fails("RM-017: カテゴリが違えばコマンドゾーンには置けず、山札の上か下に戻す（下を選ぶと一番下になる）（出典: atwiki/page-885「そうしないとき、そのカードを山札の上に戻すか下に戻すかを選択する」）", () => {
    let s = entered([inst("TST-OP", "top"), ...deckCards(3)]);
    expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top"]);
    s = resolveAll(pick(s, "deck_bottom"));
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-OP:top");
  });

  it.fails("RM-017: コマンドゾーンが5枚なら置けない（出典: atwiki/page-885「コマンドゾーンに置けるカードは通常5枚まで」）", () => {
    const s = entered([inst("TST-OP-ET", "top"), ...deckCards(3)], { command: heldN(5) });
    expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top"]);
  });

  // atwiki/page-885 Q1/A1「はい、発動します。」
  it.fails("RM-017: 公式Q&A — ラッシュエリアから1体バトルエリアに出るたびに発動する（出典: atwiki/page-885 Q1）", () => {
    let s = resolveAll(pick(entered([inst("TST-OP-ET", "t1"), inst("TST-OP-OT", "t2"), ...deckCards(3)]), "to_command"));
    s = enter(passEntry(s), "SPEC-OT-S:o");
    expectChoiceFrom(s, "player1", "RM-017");
    expect(choiceIds(s)).toContain("to_command");
  });

  it.fails("RM-017: 敵軍ターン中に自軍ユニットがバトルエリアに出たときも発動する（出典: atwiki/page-885 本文（ターンの限定がない）・カード評価「ターンに制限がない」）", () => {
    const s = enteredInEnemyTurn("SPEC-ET-S:u", { operation: [residentOp("RM-017", "tr")], deck: [inst("TST-OP-ET", "top"), ...deckCards(3)] }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "RM-017");
  });
});

// ===========================================================================
describe("RM-018 宇宙刑事ギャバン", () => {
  const TEXT =
    "※チェイス （これがライド中にユニットでなくなるとき、かわりにこれがライドしているビークルを捨札にしてから、ライドされていない自軍ビークルにライドさせてもよい） ※自軍Sユニットがこれ以外にあれば、これはストライクできない。 【ギャバンダイナミック】本来のBPが4000以上の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("RM-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-869）", () => {
    expectCatalogText("RM-018", TEXT);
    expectStats("RM-018", { name: "宇宙刑事ギャバン", category: "OT", size: "S", bp: 4000, sp: 1, powerCost: 5, comboNumber: "RC", features: ["宇宙刑事", "メカ", "男", "警察"] });
    expectRarityIn("RM-018", ["SR"]);
  });

  /** 自軍バトルフェイズに RM-018 を1番目に出す（rush は自軍ラッシュエリアのほかのカード）。 */
  const gavanIn = (rush: CardInstance[]) => enter(st({ player1: { rush: [inst("RM-018", "g"), ...rush], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA), "RM-018:g");

  it("RM-018: ※ — これ以外の自軍 S ユニット（ラッシュエリアにいても）があればストライクできない（出典: atwiki/page-869「自軍Sユニットがこれ以外にあれば、これはストライクできない」）", () => {
    expect(canStrike(gavanIn([inst("SPEC-OT-S", "o")]), "RM-018:g")).toBe(false);
  });

  it("RM-018: ※ — ほかの自軍ユニットが M ユニットだけならストライクできる（出典: atwiki/page-869・カード評価「Mサイズ以上のユニットが中心のデッキに組み込んだり」）", () => {
    expect(canStrike(gavanIn([inst("SPEC-M4", "m")]), "RM-018:g")).toBe(true);
  });

  /** 自軍バトルフェイズ、RM-018 が SPEC-VEHICLE にライドして出てライドオフする（RC の選択まで）。 */
  const rc = (enemy: CardInstance[]) =>
    rcRideOff(
      st({ player1: { rush: [inst("RM-018", "g"), inst("SPEC-VEHICLE", "v"), inst("SPEC-M4", "m")], deck: deckCards(3) }, player2: { rush: enemy, deck: deckCards(3, "e") } }, EXTRA),
      "RM-018:g",
      "SPEC-VEHICLE:v",
    );
  const ENEMY = [{ ...inst("SPEC-E4000", "a"), bpModifier: -2000 }, { ...inst("SPEC-E3000", "b"), bpModifier: 2000 }, inst("SPEC-EM5000", "m")];

  it.fails("RM-018: RC【ギャバンダイナミック】— 本来の BP が4000以上の敵軍 S ユニットから1体選べる（いまの BP ではなく本来の BP で見る。M ユニットは選べない）（任意）（出典: atwiki/page-869「本来のBPが4000以上の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = rc(ENEMY);
    expectChoiceFrom(s, "player1", "RM-018");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-018: RC【ギャバンダイナミック】— 選んだユニットは持ち主のパワーゾーンに送られる（ダメージではない）（出典: atwiki/page-869）", () => {
    const s = resolveAll(pick(rc(ENEMY), "SPEC-E4000:a"));
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E4000:a")?.faceDown).toBeFalsy();
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RM-019 超次元高速機ドルギラン", () => {
  const TEXT =
    "※これはアタックされるときBP+5000される。 ※これが自軍捨札にある間、自分が「電子星獣ドル」または「ギラン円盤」をラッシュするとき、ラッシュするユニットと同じカード名のユニットが自軍エリアになければ、その追加条件を満たさなくてもよい。";

  it("RM-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-834）", () => {
    expectCatalogText("RM-019", TEXT);
    expectStats("RM-019", { name: "超次元高速機ドルギラン", category: "OT", size: "XL", bp: 2000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ", "母艦"] });
    expectRarityIn("RM-019", ["N"]);
  });

  it("RM-019: ※ — アタックされるとき BP+5000（BP7000 でバトルする）（出典: atwiki/page-834「これはアタックされるときBP+5000される」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RM-019", "dg")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    s = settle(enemyAttack(s, "TST-UNIT-7:atk", "RM-019:dg"));
    expect(lastBattleBps(s)?.defender).toBe(7000);
  });

  /** 自軍ラッシュフェイズ、手札の id をラッシュする（必要パワー4・OT のコマンド1つ）。 */
  const tryRush = (id: string, p1: Partial<GameState["players"]["player1"]>) => {
    const s = board({ hand: [inst(id, "h")], command: releasedCat("OT", 1), power: powerCards(5), ...p1 });
    const r = rushFromHand(s, "player1", `${id}:h`);
    return r.ok ? r.state : s;
  };

  it.fails("RM-019: ※ — これが自軍捨札にあれば、電子星獣ドルを追加条件（ドルギランを捨札にする）なしでラッシュできる（ドルギランは捨札に残る）（出典: atwiki/page-834「その追加条件を満たさなくてもよい」）", () => {
    const s = tryRush("RM-020", { discard: [inst("RM-019", "dg")] });
    expect(zoneOf(s, "player1", "RM-020:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-019:dg")).toBe("discard");
  });

  it.fails("RM-019: ※ — ギラン円盤も、XG2-082 電子星獣ドル（同じカード名）も追加条件なしでラッシュできる（出典: atwiki/page-834「「電子星獣ドル」または「ギラン円盤」」・atwiki/page-1807 カード評価「超次元高速機ドルギランがあれば追加条件を満たさずにラッシュできる」）", () => {
    expect(zoneOf(tryRush("RM-021", { discard: [inst("RM-019", "dg")] }), "player1", "RM-021:h")).toBe("rush");
    expect(zoneOf(tryRush("XG2-082", { discard: [inst("RM-019", "dg")], power: powerCards(5) }), "player1", "XG2-082:h")).toBe("rush");
  });

  it("RM-019: ※ — 捨札になければ、場にドルギランがないと電子星獣ドルはラッシュできない（出典: atwiki/page-834・atwiki/page-835 追加条件）", () => {
    expect(zoneOf(tryRush("RM-020", {}), "player1", "RM-020:h")).toBe("hand");
  });

  it("RM-019: ※ — 自軍エリアに同じカード名のユニット（電子星獣ドル）があれば、追加条件を満たさなければならない（出典: atwiki/page-834「ラッシュするユニットと同じカード名のユニットが自軍エリアになければ」）", () => {
    expect(zoneOf(tryRush("RM-020", { discard: [inst("RM-019", "dg")], rush: [inst("RM-020", "other")] }), "player1", "RM-020:h")).toBe("hand");
  });
});

// ===========================================================================
describe("RM-020 電子星獣ドル", () => {
  const TEXT =
    "※これは、チェイスを持つ自軍ユニットがあるか、ライドされてる間、Lビークルとして扱う。 【ドルファイヤー】自軍ターン中、本来の特徴に「宇宙刑事」を持つユニットがこのビークルからライドオフしたとき、相手に1点ダメージを与える。";

  it("RM-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-835）", () => {
    expectCatalogText("RM-020", TEXT);
    expectStats("RM-020", { name: "電子星獣ドル", category: "OT", size: "L", bp: 5000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["メカ", "獣", "ドラゴン"], rushCondition: "discard_named_unit" });
    expectRarityIn("RM-020", ["NR", "N"]);
  });

  it("RM-020: 追加条件 — 自軍の超次元高速機ドルギランを1体捨札にしてラッシュする（出典: atwiki/page-835「自軍｢超次元高速機ドルギラン｣1体を捨札にする」）", () => {
    const r = rushFromHand(board({ hand: [inst("RM-020", "h")], rush: [inst("RM-019", "dg")], command: releasedCat("OT", 1), power: powerCards(4) }), "player1", "RM-020:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RM-020:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RM-019:dg")).toBe("discard");
  });

  it.fails("RM-020: ※ — チェイスを持つ自軍ユニット（宇宙刑事ギャバン）があれば L ビークルとして扱い、ライドできる（出典: atwiki/page-835「チェイスを持つ自軍ユニットがあるか…Lビークルとして扱う」）", () => {
    const s = st({ player1: { rush: [inst("RM-018", "g"), inst("RM-020", "dol")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);
    expect(canMount(s, "RM-018:g", "RM-020:dol")).toBe(true);
  });

  it("RM-020: ※ — チェイスを持つ自軍ユニットがなければビークルではない（RC のユニットもライドできない）（出典: atwiki/page-835・カード評価「チェイス持ちが自軍にいるとビークルになる」）", () => {
    const s = st({ player1: { rush: [inst("SPEC-RC", "r"), inst("RM-020", "dol")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);
    expect(canMount(s, "SPEC-RC:r", "RM-020:dol")).toBe(false);
  });

  /** 自軍バトルフェイズ、rider が電子星獣ドルにライドして出てライドオフする。RM-018 の RC の選択があれば見送る。 */
  const rideOffDol = (rider: string, rush: CardInstance[] = []) => {
    let s = rcRideOff(st({ player1: { rush: [inst(rider.split(":")[0]!, rider.split(":")[1]!), inst("RM-020", "dol"), ...rush], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA), rider, "RM-020:dol");
    if (s.pendingEffectChoice?.sourceCardId === "RM-018") s = skip(s);
    return settle(s);
  };

  it.fails("RM-020:【ドルファイヤー】— 自軍ターン中、本来の特徴に「宇宙刑事」を持つユニット（宇宙刑事ギャバン）がこのビークルからライドオフしたとき、相手に1点ダメージ（出典: atwiki/page-835）", () => {
    expect(damageOf(rideOffDol("RM-018:g"), "player2")).toBe(1);
  });

  it.fails("RM-020:【ドルファイヤー】—「宇宙刑事」を持たないユニットがライドオフしてもダメージはない（出典: atwiki/page-835「本来の特徴に「宇宙刑事」を持つユニットが」）", () => {
    // チェイスを持つ宇宙刑事ギャバン（ラッシュエリア）がいるので、電子星獣ドルはビークルとして扱われる。
    expect(damageOf(rideOffDol("SPEC-RC:r", [inst("RM-018", "g")]), "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RM-021 ギラン円盤", () => {
  const TEXT =
    "※これはアタックされるときBP+5000される。 【ビークル射出】これをラッシュしたとき、自軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が4以下の、MユニットかSビークルのカードを1枚選んでもよい。そうしたとき、選んだカードを自軍ラッシュエリアに出す。";

  const POWER = [faceUp("SPEC-M4", "m4"), faceDown("SPEC-M4", "m4d"), faceUp("SPEC-M5", "m5"), faceUp("SPEC-VEHICLE", "vs"), faceUp("SPEC-VL", "vl"), faceUp("SPEC-OT-S", "s")];
  const rushedGiran = () => {
    const r = rushFromHand(board({ hand: [inst("RM-021", "h")], rush: [inst("RM-019", "dg")], command: releasedCat("OT", 1), power: POWER }), "player1", "RM-021:h");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RM-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-836）", () => {
    expectCatalogText("RM-021", TEXT);
    expectStats("RM-021", { name: "ギラン円盤", category: "OT", size: "L", bp: 1000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["メカ", "航空機"], rushCondition: "discard_named_unit" });
    expectRarityIn("RM-021", ["N"]);
  });

  it.fails("RM-021:【ビークル射出】— ラッシュしたとき、自軍パワーゾーンのオモテ向きの、必要パワー4以下の M ユニットか S ビークルのカードから1枚選べる（任意）（出典: atwiki/page-836）", () => {
    const s = rushedGiran();
    expectChoiceFrom(s, "player1", "RM-021");
    expect(choiceIds(s)).toEqual(["SPEC-M4:m4", "SPEC-VEHICLE:vs"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-021:【ビークル射出】— 選んだカードは自軍ラッシュエリアに出る（出典: atwiki/page-836「選んだカードを自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(pick(rushedGiran(), "SPEC-M4:m4"));
    expect(zoneOf(s, "player1", "SPEC-M4:m4")).toBe("rush");
  });

  it("RM-021: ※ — アタックされるとき BP+5000（BP6000 でバトルする）（出典: atwiki/page-836「これはアタックされるときBP+5000される」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RM-021", "g")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    s = settle(enemyAttack(s, "TST-UNIT-7:atk", "RM-021:g"));
    expect(lastBattleBps(s)?.defender).toBe(6000);
  });

});
