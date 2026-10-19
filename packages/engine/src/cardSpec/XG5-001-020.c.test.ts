/**
 * カード別スペック: XG5-015〜XG5-020（クロスギャザー XG5 ザ・チケットブレイカー スティライザー〜ボウケンレッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない（「ボウケンレッド」は RS-062・RS-241 の項だけ）。atwiki に転載された公式 Q&A: XG5-016 Q1・XG5-017 Q1（＝XG5-010 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAKUS-01・R-ADD-06）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  attack,
  attackedInEnemyTurn,
  beltUsed,
  bpOf,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  damageOf,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  fill,
  inst,
  ncEnter,
  nextPhase,
  passEntry,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  skip,
  spOf,
  st,
  stackedUnder,
  sUnit,
  targetsOf,
  zoneOf,
} from "./XG5-001-020.helpers";

const OWN_S = sUnit("SPEC-OWN-S", { category: "WB", bp: 2000 });
const OWN_M = sUnit("SPEC-OWN-M", { category: "WB", bp: 3000, size: "M" });
const PLAIN_U = sUnit("SPEC-PLAIN-U", { category: "WB", bp: 1000 });
const E6000 = sUnit("SPEC-E6000", { bp: 6000, size: "M" });
const E6500 = sUnit("SPEC-E6500", { bp: 6500, size: "M" });
const E1000 = sUnit("SPEC-E1000", { bp: 1000 });
const OT_L = sUnit("SPEC-OT-L", { category: "OT", bp: 9000, size: "L", powerCost: 5 });
const ET_L = sUnit("SPEC-ET-L", { category: "ET", bp: 9000, size: "L", powerCost: 5 });
const MA_L = sUnit("SPEC-MA-L", { category: "MA", bp: 9000, size: "L", powerCost: 5 });
const DA_E = sUnit("SPEC-DA-E", { category: "DA", bp: 1000 });
const WB_E = sUnit("SPEC-WB-E", { category: "WB", bp: 1000 });
const ET_NOSP = sUnit("SPEC-ET-NOSP", { category: "ET", bp: 1000, sp: undefined });
const WB_NOSP = sUnit("SPEC-WB-NOSP", { category: "WB", bp: 1000, sp: undefined });
const MECHA_M = sUnit("SPEC-MECHA-M", { category: "ET", bp: 3000, size: "M", features: ["メカ"] });
const MECHA_S = sUnit("SPEC-MECHA-S", { category: "ET", bp: 1000, features: ["メカ"] });
const EXTRA = [OWN_S, OWN_M, PLAIN_U, E6000, E6500, E1000, OT_L, ET_L, MA_L, DA_E, WB_E, ET_NOSP, WB_NOSP, MECHA_M, MECHA_S];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncEnter(id, fillers, p1, p2, EXTRA);

// ===========================================================================
describe("XG5-015 スティライザー", () => {
  const TEXT =
    "自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。自軍バトルフェイズ中、このカードに重ねたユニットがバトルエリアに出たとき、自分の手札から特徴「恐竜」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい（ただし、追加条件は満たすこと）。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  it("XG5-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-2193）", () => {
    expectCatalogText("XG5-015", TEXT);
    expectOpStats("XG5-015", { name: "スティライザー", category: "WB", powerCost: 5 });
    expectRarityIn("XG5-015", ["N"]);
  });

  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => beltUsed("XG5-015", "WB", 5, p1, p2, EXTRA);
  const own = () => ({ rush: [inst("SPEC-OWN-S", "s"), inst("SPEC-OWN-M", "m")] });
  /** 使って SPEC-OWN-S:s を選ぶ。手札に hand を持つ。 */
  const stacked = (hand = [inst("RS-338", "dino"), inst("RS-039", "pt"), inst("RS-050", "ab"), inst("SPEC-PLAIN-U", "p")], p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(pick(used({ ...own(), hand }, p2), "SPEC-OWN-S:s"));

  it.fails("XG5-015: 自軍 S ユニットから1体選ぶ（M ユニット・敵軍のユニットは選べない。見送れない） 既知の不具合: CARD-XG5-015 使っても効果がない（選択が開かない）（出典: atwiki/page-2193「自軍Sユニットを1体選ぶ」）", () => {
    const s = used(own(), { rush: [inst("SPEC-E1000", "e")] });
    expectChoiceFrom(s, "player1", "XG5-015");
    expect(choiceIds(s)).toEqual(["SPEC-OWN-S:s"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG5-015: このカードを自軍ラッシュエリアに置き、選んだユニットをこれに重ねる（このカードは捨札にならず、ユニットの下にある）既知の不具合: CARD-XG5-015 使っても重ならず捨札になる（出典: atwiki/page-2193「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」）", () => {
    const s = stacked();
    expect(zoneOf(s, "player1", "SPEC-OWN-S:s")).toBe("rush");
    expect(stackedUnder(s, "player1", "SPEC-OWN-S:s")).toContain("XG5-015:op");
    expect(zoneOf(s, "player1", "XG5-015:op")).toBeNull();
  });

  it.fails("XG5-015: 自軍バトルフェイズ中、重ねたユニットがバトルエリアに出たとき、手札の特徴「恐竜」を持つユニットカード（追加条件を満たせるもの）から選べる（任意）既知の不具合: CARD-XG5-015 バトルエリアに出ても選択が開かない（出典: atwiki/page-2193「自分の手札から特徴「恐竜」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい（ただし、追加条件は満たすこと）」）", () => {
    const s = enter(nextPhase(stacked()), "SPEC-OWN-S:s");
    expectChoiceFrom(s, "player1", "XG5-015");
    expect(choiceIds(s)).toEqual(["RS-039:pt", "RS-338:dino"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-015: 選んだ「恐竜」のユニットカードは自軍ラッシュエリアに出る（必要パワーは問わない）既知の不具合: CARD-XG5-015 バトルエリアに出ても選択が開かない（出典: atwiki/page-2193「自軍ラッシュエリアに出してもよい」）", () => {
    const s = resolveAll(pick(enter(nextPhase(stacked()), "SPEC-OWN-S:s"), "RS-039:pt"));
    expect(zoneOf(s, "player1", "RS-039:pt")).toBe("rush");
  });

  it.fails("XG5-015: 重ねたユニットがバトルで撃破されてユニットでなくなるとき、このカードは捨札になる 既知の不具合: CARD-XG5-015 使っても重ならない（出典: atwiki/page-2193「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = stacked([], { battle: [inst("TST-UNIT-7", "big")] });
    expect(zoneOf(s, "player1", "XG5-015:op")).toBeNull();
    s = passEntry(enter(nextPhase(s), "SPEC-OWN-S:s"));
    s = resolveAll(attack(s, "SPEC-OWN-S:s", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-OWN-S:s")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-015:op")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-016 シグナルキャノン", () => {
  const TEXT =
    "BP6000以下の敵軍ユニットを1体選び持ち主のパワーゾーンに送る。（これが自軍コマンドゾーンにある間、OTを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する）";

  it("XG5-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-2194）", () => {
    expectCatalogText("XG5-016", TEXT);
    expectOpStats("XG5-016", { name: "シグナルキャノン", category: "OT", powerCost: 4 });
    expectRarityIn("XG5-016", ["N"]);
  });

  const ENEMY = () => ({ rush: [inst("SPEC-E6000", "a"), inst("SPEC-E6500", "b")], battle: [inst("SPEC-E1000", "c")] });
  const used = (p2 = ENEMY()) => beltUsed("XG5-016", "OT", 4, { rush: [inst("SPEC-OWN-S", "own")] }, p2, EXTRA);

  it.fails("XG5-016: BP6000以下の敵軍ユニット（ラッシュエリア・バトルエリア、M ユニットも）から1体選ぶ（BP6500・自軍のユニットは選べない。見送れない）既知の不具合: CARD-XG5-016 使っても効果がない（選択が開かない）（出典: atwiki/page-2194「BP6000以下の敵軍ユニットを1体選び」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-016");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:c", "SPEC-E6000:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG5-016: 選んだユニットは持ち主（敵軍）のパワーゾーンにオモテ向きで置かれる 既知の不具合: CARD-XG5-016 使っても効果がない（出典: atwiki/page-2194「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(used(), "SPEC-E6000:a"));
    expect(zoneOf(s, "player2", "SPEC-E6000:a")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E6000:a")?.faceDown ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });

  /** 自軍バトルフェイズ、コマンドゾーンにシグナルキャノン（リリース状態）。unit をバトルエリアに出す。 */
  const lEnters = (unit: string) => {
    const [cid, suf] = unit.split(":") as [string, string];
    const s = battle({ rush: [inst(cid, suf)], command: [released("XG5-016", "sc")] }, ENEMY());
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: unit });
  };

  it.fails("XG5-016: （）— 自軍コマンドゾーンにある間、OT を持つ自軍 L ユニットがバトルエリアに出たとき、これをホールドして効果を発動できる（任意）既知の不具合: CARD-XG5-016 コマンドゾーンからの発動が提示されない（出典: atwiki/page-2194「これが自軍コマンドゾーンにある間、OTを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい」）", () => {
    const s = lEnters("SPEC-OT-L:l");
    expectChoiceFrom(s, "player1", "XG5-016");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-016: （）— OT を持たない L ユニットが出ても発動しない（出典: atwiki/page-2194「OTを持つ自軍Lユニットが」）", () => {
    const s = lEnters("SPEC-ET-L:l");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-016");
  });

  it.todo(
    "XG5-016: 公式Q&A — コマンドゾーンにあるときの効果で発動しても、オペレーションカードの使用にはあたらない（RK-251 ゴルゴムの仕業で無効にできない）（出典: atwiki/page-2194 Q1）— コマンドゾーンからの発動が提示されない（上の it.fails）ため前提が作れない",
  );
});

// ===========================================================================
describe("XG5-017 魔法剣キングカリバー", () => {
  const TEXT =
    "自分は1枚ドローする。（これが自軍コマンドゾーンにある間、MAを持ち合体を必要とする自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する)";

  it("XG5-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-2184）", () => {
    expectCatalogText("XG5-017", TEXT);
    expectOpStats("XG5-017", { name: "魔法剣キングカリバー", category: "MA", powerCost: 1 });
    expectRarityIn("XG5-017", ["NR"]);
  });

  it("XG5-017: 使うと自分は1枚ドローする（出典: atwiki/page-2184「自分は1枚ドローする」）", () => {
    const s = resolveAll(beltUsed("XG5-017", "MA", 1, { deck: [inst("SPEC-OWN-S", "top"), ...deckCards(3)] }, {}, EXTRA));
    expect(zoneOf(s, "player1", "SPEC-OWN-S:top")).toBe("hand");
    expect(zoneOf(s, "player1", "XG5-017:op")).toBe("discard");
  });

  const lEnters = (unit: string) => {
    const [cid, suf] = unit.split(":") as [string, string];
    const s = battle({ rush: [inst(cid, suf)], command: [released("XG5-017", "kc")] });
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: unit });
  };

  it.fails("XG5-017: （）— 自軍コマンドゾーンにある間、MA を持ち合体を必要とする自軍 L ユニット（RS-113 ファイヤーカイザー）がバトルエリアに出たとき、これをホールドしてドローできる（任意）既知の不具合: CARD-XG5-017 コマンドゾーンからの発動が提示されない（出典: atwiki/page-2184「MAを持ち合体を必要とする自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい」）", () => {
    const s = lEnters("RS-113:fk");
    expectChoiceFrom(s, "player1", "XG5-017");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-017: （）— 合体を必要としない MA の L ユニットが出ても発動しない（出典: atwiki/page-2184「合体を必要とする」）", () => {
    const s = lEnters("SPEC-MA-L:l");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-017");
  });

  it.todo(
    "XG5-017: 公式Q&A — コマンドゾーンにあるときの効果で発動しても、オペレーションカードの使用にはあたらない（RK-251 ゴルゴムの仕業で無効にできない）（出典: atwiki/page-2184 Q1）— コマンドゾーンからの発動が提示されない（上の it.fails）ため前提が作れない",
  );
});

// ===========================================================================
describe("XG5-018 ゴーゴーボイジャー", () => {
  const TEXT =
    "※これはDAを持たないユニットにアタックすることができない 【アンドック】これが自軍コマンドゾーンにある間、敵軍ターン中、自軍ユニットがユニットでなくなり、自軍ユニットが1体もなくなったとき、これを自軍ラッシュエリアに出してもよい。ただし、必要パワーは満たすこと。（この効果でラッシュできる「ゴーゴーボイジャー」は、1つのタイミングにつき 1枚までとする）";

  it("XG5-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-2239）", () => {
    expectCatalogText("XG5-018", TEXT);
    expectStats("XG5-018", { name: "ゴーゴーボイジャー", category: "ET", size: "XL", bp: 8000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["メカ", "母艦"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG5-018", ["NR"]);
  });

  it("XG5-018: ※ — DA を持たないユニットにはアタックできない（DA のユニットにはアタックできる）（出典: atwiki/page-2239「これはDAを持たないユニットにアタックすることができない」）", () => {
    const s = battle({ battle: [inst("XG5-018", "v")] }, { battle: [inst("SPEC-DA-E", "d"), inst("SPEC-WB-E", "w")] });
    expect(targetsOf(s, "XG5-018:v")).toEqual(["SPEC-DA-E:d"]);
  });

  it("XG5-018: 追加条件 — 自軍 S ユニット5体をコマンドゾーンに送るか捨札にし、パワー5でラッシュできる（4体ではラッシュできない）（出典: atwiki/page-2239「追加条件：自軍Sユニット5体をそれぞれコマンドゾーンに送るか捨札にする」）", () => {
    const mk = (n: number) => rushBoard({ hand: [inst("XG5-018", "v")], rush: fill(n), power: powerCards(5), command: releasedCat("ET", 1) }, {}, EXTRA);
    const r = rushFromHand(mk(5), "player1", "XG5-018:v");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XG5-018:v")).toBe("rush");
    const r4 = rushFromHand(mk(4), "player1", "XG5-018:v");
    expect(r4.ok && zoneOf(r4.state, "player1", "XG5-018:v") === "rush").toBe(false);
  });

  /** 敵軍ターン、自軍バトルエリアの唯一のユニット SPEC-OWN-S が BP13000 にアタックされて撃破される。コマンドゾーンにボイジャー。 */
  const lastDestroyed = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    attackedInEnemyTurn({ battle: [inst("SPEC-OWN-S", "u")], command: [released("XG5-018", "v")], power: powerCards(5), ...p1 }, "SPEC-OWN-S:u", {}, "TST-UNIT-7:atk", EXTRA);

  it.fails("XG5-018:【アンドック】— 敵軍ターン中、自軍ユニットが撃破されて自軍ユニットが1体もなくなったとき、コマンドゾーンのこれを自軍ラッシュエリアに出せる（任意）既知の不具合: CARD-XG5-018【アンドック】が提示されない（出典: atwiki/page-2239「自軍ユニットがユニットでなくなり、自軍ユニットが1体もなくなったとき、これを自軍ラッシュエリアに出してもよい」）", () => {
    const s = lastDestroyed();
    expectChoiceFrom(s, "player1", "XG5-018");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-018:【アンドック】— 出すことを選べば、これは自軍ラッシュエリアに出る 既知の不具合: CARD-XG5-018【アンドック】が提示されない（出典: atwiki/page-2239）", () => {
    const s = resolveAll(accept(lastDestroyed()), ["XG5-018:v"]);
    expect(zoneOf(s, "player1", "XG5-018:v")).toBe("rush");
  });

  it("XG5-018:【アンドック】— 自軍パワーが4なら（必要パワー5を満たさない）出せない（出典: atwiki/page-2239「ただし、必要パワーは満たすこと」）", () => {
    const s = resolveAll(lastDestroyed({ power: powerCards(4) }), ["XG5-018:v"]);
    expect(zoneOf(s, "player1", "XG5-018:v")).toBe("command");
  });

  it("XG5-018:【アンドック】— ほかの自軍ユニットが残っていれば出せない（出典: atwiki/page-2239「自軍ユニットが1体もなくなったとき」）", () => {
    const s = resolveAll(lastDestroyed({ rush: [inst("SPEC-PLAIN-U", "rest")] }), ["XG5-018:v"]);
    expect(zoneOf(s, "player1", "XG5-018:v")).toBe("command");
  });

  it("XG5-018:【アンドック】— 自軍ターン中に自軍ユニットが1体もなくなっても出せない（出典: atwiki/page-2239「敵軍ターン中」）", () => {
    let s = battle({ battle: [inst("SPEC-OWN-S", "u")], command: [released("XG5-018", "v")], power: powerCards(5) }, { battle: [inst("TST-UNIT-7", "big")] });
    s = resolveAll(attack(s, "SPEC-OWN-S:u", "TST-UNIT-7:big"), ["XG5-018:v"]);
    expect(zoneOf(s, "player1", "SPEC-OWN-S:u")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-018:v")).toBe("command");
  });
});

// ===========================================================================
describe("XG5-019 ダイボイジャー", () => {
  const TEXT =
    "※これはDAを持たないユニットにアタックすることができない。 【アドベンチャーダブルスクリュー】自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、リリース状態の自分自身のコマンドが2つ以上あればすべて選び手札に戻すかを選ぶ。";

  it("XG5-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-2279）", () => {
    expectCatalogText("XG5-019", TEXT);
    expectStats("XG5-019", { name: "ダイボイジャー", category: "ET", size: "XL", bp: 18000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-019", ["SR"]);
  });

  it("XG5-019: 追加条件 — 自軍「ゴーゴーボイジャー」1体を捨札にして、パワー6でラッシュできる（出典: atwiki/page-2279「追加条件：自軍「ゴーゴーボイジャー」1体を捨札にする」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-019", "dv")], rush: [inst("XG5-018", "gv")], power: powerCards(6), command: releasedCat("ET", 1) }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "XG5-019:dv", { materials: ["XG5-018:gv"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-019:dv")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-018:gv")).toBe("discard");
  });

  it("XG5-019: ※ — DA を持たないユニットにはアタックできない（出典: atwiki/page-2279「これはDAを持たないユニットにアタックすることができない」）", () => {
    const s = battle({ battle: [inst("XG5-019", "dv")] }, { battle: [inst("SPEC-DA-E", "d"), inst("SPEC-WB-E", "w")] });
    expect(targetsOf(s, "XG5-019:dv")).toEqual(["SPEC-DA-E:d"]);
  });

  const enters = (p2: Partial<GameState["players"]["player2"]>) => enter(battle({ rush: [inst("XG5-019", "dv")] }, p2), "XG5-019:dv");
  const TWO = () => ({ command: [released("TST-OP", "r1"), released("TST-OP-ET", "r2"), { ...inst("TST-OP", "h1"), commandHeld: true }] });

  it.fails("XG5-019:【アドベンチャーダブルスクリュー】— 自軍ターン中にバトルエリアに出たとき、相手がリリース状態のコマンドを2つ以上持てば、相手が「1点ダメージ」か「すべて手札に戻す」かを選ぶ 既知の不具合: CARD-XG5-019 相手の選択が開かない（出典: atwiki/page-2279「相手は1点ダメージを受けるか、リリース状態の自分自身のコマンドが2つ以上あればすべて選び手札に戻すかを選ぶ」）", () => {
    const s = enters(TWO());
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG5-019");
    expect(choiceIds(s)).toHaveLength(2);
  });

  it.fails("XG5-019:【アドベンチャーダブルスクリュー】— 相手が戻すほうを選べば、相手のリリース状態のコマンドをすべて手札に戻す（ホールド状態のコマンドは残る。ダメージはない）既知の不具合: CARD-XG5-019 相手の選択が開かない（出典: atwiki/page-2279「すべて選び手札に戻す」）", () => {
    let s = enters(TWO());
    const back = choiceIds(s).find((x) => x !== "damage" && !x.includes("damage"));
    s = resolveAll(pick(s, back!));
    expect(zoneOf(s, "player2", "TST-OP:r1")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP-ET:r2")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:h1")).toBe("command");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG5-019:【アドベンチャーダブルスクリュー】— 相手のリリース状態のコマンドが1つ以下なら、相手は1点ダメージを受ける（出典: atwiki/page-2279「リリース状態の自分自身のコマンドが2つ以上あれば」）", () => {
    const s = resolveAll(enters({ command: [released("TST-OP", "r1"), { ...inst("TST-OP", "h1"), commandHeld: true }] }));
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player2", "TST-OP:r1")).toBe("command");
  });
});

// ===========================================================================
describe("XG5-020 ボウケンレッド", () => {
  const TEXT =
    "※タクスET 【レッドゾーンクラッシュ】自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、このターン、これはBP+2000され、戻したカードが特徴「メカ」を持つMユニットだったなら、さらにBP+2000される。";

  it("XG5-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-2230）", () => {
    expectCatalogText("XG5-020", TEXT);
    expectStats("XG5-020", { name: "ボウケンレッド", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: 1, features: ["レッド", "男"] });
    expectRarityIn("XG5-020", ["R"]);
  });

  it("XG5-020: ※タクスET — バトルエリアの4番目にある間、次に並ぶ ET の S ユニット（SP 空欄）は「SP1」を得る（ET を持たなければ得ない）（出典: atwiki/page-2230「※タクスET」・R-KW-TAKUS-01）", () => {
    const at4 = (next: string) => {
      let s = battle({ battle: fill(3), rush: [inst("XG5-020", "r"), inst(next.split(":")[0]!, next.split(":")[1]!)] });
      s = passEntry(resolveAll(enter(s, "XG5-020:r")));
      return passEntry(resolveAll(enter(s, next)));
    };
    expect(spOf(at4("SPEC-ET-NOSP:n"), "player1", "SPEC-ET-NOSP:n")).toBe(1);
    expect(spOf(at4("SPEC-WB-NOSP:n"), "player1", "SPEC-WB-NOSP:n")).toBe(0);
  });

  const COMMAND = () => [released("TST-OP", "c1"), { ...inst("SPEC-MECHA-M", "c2"), commandHeld: true }, released("SPEC-MECHA-S", "c3")];

  it.fails("XG5-020: NC【レッドゾーンクラッシュ】— 自軍コマンド（リリース状態・ホールド状態とも）から1つ選べる（任意）既知の不具合: CARD-XG5-020 NC は成立するが効果がない（選択が開かない）（出典: atwiki/page-2230「自軍コマンドを1つ選び手札に戻してもよい」）", () => {
    const s = nc("XG5-020:r", 0, { command: COMMAND() }, { command: [released("TST-OP", "e1")] });
    expectChoiceFrom(s, "player1", "XG5-020");
    expect(choiceIds(s)).toEqual(["SPEC-MECHA-M:c2", "SPEC-MECHA-S:c3", "TST-OP:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-020: NC【レッドゾーンクラッシュ】— 戻せば、このターン BP+2000（BP6000）既知の不具合: CARD-XG5-020 NC の効果がない（出典: atwiki/page-2230「そうしたとき、このターン、これはBP+2000され」）", () => {
    const s = resolveAll(pick(nc("XG5-020:r", 0, { command: COMMAND() }), "TST-OP:c1"));
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("hand");
    expect(bpOf(s, "player1", "XG5-020:r")).toBe(6000);
  });

  it.fails("XG5-020: NC【レッドゾーンクラッシュ】— 戻したカードが特徴「メカ」を持つ M ユニットなら、さらに BP+2000（BP8000）。「メカ」の S ユニットでは +2000 だけ 既知の不具合: CARD-XG5-020 NC の効果がない（出典: atwiki/page-2230「戻したカードが特徴「メカ」を持つMユニットだったなら、さらにBP+2000される」）", () => {
    let s = resolveAll(pick(nc("XG5-020:r", 0, { command: COMMAND() }), "SPEC-MECHA-M:c2"));
    expect(bpOf(s, "player1", "XG5-020:r")).toBe(8000);
    s = resolveAll(pick(nc("XG5-020:r", 0, { command: COMMAND() }), "SPEC-MECHA-S:c3"));
    expect(bpOf(s, "player1", "XG5-020:r")).toBe(6000);
  });

  it("XG5-020: NC【レッドゾーンクラッシュ】— 戻さなければ BP は変わらない（出典: atwiki/page-2230「戻してもよい。そうしたとき」）", () => {
    const s = nc("XG5-020:r", 0, { command: COMMAND() });
    const t = s.pendingEffectChoice?.sourceCardId === "XG5-020" ? resolveAll(skip(s)) : resolveAll(s);
    expect(bpOf(t, "player1", "XG5-020:r")).toBe(4000);
    expect(zoneOf(t, "player1", "TST-OP:c1")).toBe("command");
  });

  it("XG5-020: 1番目以外に出れば【レッドゾーンクラッシュ】は発動しない（出典: atwiki/page-2230「CN：1」）", () => {
    const s = nc("XG5-020:r", 1, { command: COMMAND() });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-020");
    expect(bpOf(resolveAll(s), "player1", "XG5-020:r")).toBe(4000);
  });
});

void endTurn;
