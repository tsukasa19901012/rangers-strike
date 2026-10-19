/**
 * cardSpec XG4-078〜XG4-083（仮面ライダー龍騎〜ディケイド ファイズ）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackUntilRegister,
  bpOf,
  callTests,
  canSkip,
  canStrike,
  choiceIds,
  damageOf,
  deckCards,
  enterKeep,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  faceUp,
  fill,
  inst,
  isDamage,
  morphTests,
  p1Battle,
  pick,
  pickThrough,
  rcRideOff,
  registerOffered,
  resolveAll,
  settle,
  spOf,
  st,
  strike,
  sUnit,
  targetsOf,
  vehicleCard,
  zoneOf,
} from "./XG4-064-083.helpers";

const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_1500 = sUnit("SPEC-E-1500", { bp: 1500, sp: undefined });
const E_2000 = sUnit("SPEC-E-2000", { bp: 2000, sp: undefined });
const P1 = sUnit("SPEC-P1", { bp: 1000, powerCost: 1 });
const P2 = sUnit("SPEC-P2", { bp: 1000, powerCost: 2 });
const P3 = sUnit("SPEC-P3", { bp: 1000, powerCost: 3 });
const P6 = sUnit("SPEC-P6", { bp: 1000, powerCost: 6 });
const BIKE = vehicleCard("SPEC-BIKE", { category: "ET" });
const E_ATK_S = sUnit("SPEC-E-ATK-S", { bp: 20000, sp: 1 });
const E_ATK_M = sUnit("SPEC-E-ATK-M", { bp: 20000, sp: 1, size: "M" });
const EXTRA = [E_S, E_1500, E_2000, P1, P2, P3, P6, BIKE, E_ATK_S, E_ATK_M];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-078 仮面ライダー龍騎（XG4）", () => {
  it("XG4-078: カタログ本文・スペックが出典と一致（出典: atwiki/page-2053）", () => {
    expectCatalogText("XG4-078", "※コールWB");
    expectUnit("XG4-078", { name: "仮面ライダー龍騎", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG4-078", ["N"]);
  });

  callTests("XG4-078", "WB", "atwiki/page-2053");
});

// ===========================================================================
describe("XG4-079 ディケイド カブトRF（XG4）", () => {
  const TEXT =
    "※モーフ ※これは「仮面ライダーカブトRF」としてつかえる。 ※これは敵軍Sユニットにアタックされない。 【アタックライド】自軍ターン中、これがバトルエリアに出たとき、必要パワーの数字が「1」「2」「3」のオモテ向きの自軍パワーがそれぞれあるなら、その中から1枚選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」";

  it("XG4-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-2059）", () => {
    expectCatalogText("XG4-079", TEXT);
    expectUnit("XG4-079", { name: "ディケイド カブトRF", category: "OT", size: "S", bp: 2000, sp: "special", powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "ディケイドライバー"] });
    expectRarityIn("XG4-079", ["N"]);
  });

  morphTests("XG4-079", "XG4-083", "XG4-073", "atwiki/page-2059");

  it.todo("XG4-079: ※ — 「仮面ライダーカブトRF」としてつかえる（出典: atwiki/page-2059「これは「仮面ライダーカブトRF」としてつかえる」）（未対応の理由: 「仮面ライダーカブトRF」の名前を参照するカード（追加条件・効果）と組み合わせた盤面がこのバッチの範囲で決められない）");

  const attackedBy = (attacker: string) =>
    st({ activePlayer: "player2", player1: { battle: [inst("XG4-079", "kb")], deck: deckCards(3) }, player2: { battle: [inst(attacker, "atk")], deck: deckCards(3, "e") } }, EXTRA);

  it("XG4-079: ※ — 敵軍 S ユニットにアタックされない（M ユニットにはアタックされる）（出典: atwiki/page-2059「これは敵軍Sユニットにアタックされない」）", () => {
    expect(targetsOf(attackedBy("SPEC-E-ATK-S"), "SPEC-E-ATK-S:atk", "player2")).toEqual([]);
    expect(targetsOf(attackedBy("SPEC-E-ATK-M"), "SPEC-E-ATK-M:atk", "player2")).toEqual(["XG4-079:kb"]);
  });

  const entered = (power: ReturnType<typeof inst>[]) => settle(enterNow(battle({ rush: [inst("XG4-079", "kb")], power }), "XG4-079:kb"));
  const all3 = () => [faceUp("SPEC-P1", "p1"), faceUp("SPEC-P2", "p2"), faceUp("SPEC-P3", "p3"), faceUp("SPEC-P6", "p6")];

  it("XG4-079:【アタックライド】— 自軍ターン中にバトルエリアに出たとき、必要パワー「1」「2」「3」のオモテ向きの自軍パワーがそれぞれあれば、その中から1枚選べる（「6」は選べない。任意）（出典: atwiki/page-2059「その中から1枚選び捨札にしてもよい」）", () => {
    const s = entered(all3());
    expectChoiceFrom(s, "player1", "XG4-079");
    expect(choiceIds(s)).toEqual(["SPEC-P1:p1", "SPEC-P2:p2", "SPEC-P3:p3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-079:【アタックライド】— 捨札にすると、このターン「SP1」になる（出典: atwiki/page-2059「このターン、これは次の能力を得る⇒「SP1」」）", () => {
    let s = entered(all3());
    expectChoiceFrom(s, "player1", "XG4-079");
    s = resolveAll(pick(s, "SPEC-P2:p2"));
    expect(zoneOf(s, "player1", "SPEC-P2:p2")).toBe("discard");
    expect(spOf(s, "player1", "XG4-079:kb")).toBe(1);
  });

  it("XG4-079:【アタックライド】— 「3」のオモテ向きパワーがなければ発動しない（出典: atwiki/page-2059「それぞれあるなら」）", () => {
    const s = entered([faceUp("SPEC-P1", "p1"), faceUp("SPEC-P2", "p2"), faceUp("SPEC-P6", "p6")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-079");
  });
});

// ===========================================================================
describe("XG4-080 ロボライダー（XG4）", () => {
  const TEXT =
    "※モーフ ※レジスト 【ハードショット】これがストライクしてダメージを与えるとき、かわりに敵軍ラッシュエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("XG4-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-2071）", () => {
    expectCatalogText("XG4-080", TEXT);
    expectUnit("XG4-080", { name: "ロボライダー", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 6, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "ハイブリッドエネルギー"] });
    expectRarityIn("XG4-080", ["N"]);
  });

  morphTests("XG4-080", "XG4-082", "XG4-073", "atwiki/page-2071");

  it("XG4-080: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2071 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-080", "rr")] }, "XG4-080:rr"))).toBe(true);
  });

  // 3番目に出て分数 SP（1/3）でストライクする。
  const struck = () =>
    settle(strike(enterKeep(battle({ battle: fill(2), rush: [inst("XG4-080", "rr")] }, { rush: [inst("SPEC-E-S", "r"), inst("TST-UNIT-2", "m")], battle: [inst("SPEC-E-S", "b")], deck: deckCards(3, "e") }), ["XG4-080:rr"]), "XG4-080:rr"));

  it.fails("XG4-080:【ハードショット】— ストライクしてダメージを与えるとき、かわりに敵軍ラッシュエリアの S ユニットを1体選べる（バトルエリア・M ユニットは選べない。任意）（出典: atwiki/page-2071「かわりに敵軍ラッシュエリアからSユニットを1体選び…置いてもよい」）（既知の不具合: CARD-XG4-080 【ハードショット】の選択が開かない）", () => {
    const s = struck();
    expectChoiceFrom(s, "player1", "XG4-080");
    expect(choiceIds(s)).toEqual(["SPEC-E-S:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-080:【ハードショット】— 選ぶと、そのユニットがダメージとして置かれ、山札からのダメージはない（ダメージは1点）（出典: atwiki/page-2071「かわりに…持ち主のパワーゾーンにダメージにして置いてもよい」）（既知の不具合: CARD-XG4-080 【ハードショット】の選択が開かない）", () => {
    let s = struck();
    expectChoiceFrom(s, "player1", "XG4-080");
    s = resolveAll(pick(s, "SPEC-E-S:r"));
    expect(isDamage(s, "player2", "SPEC-E-S:r")).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG4-081 仮面ライダーブレイド（XG4）", () => {
  const TEXT =
    "※レジスト ※これはライドオフしたときストライクできない。 【ライトニングスラッシュ】自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍バトルエリアのSユニットを1体選びホールドする。その後、見せたカードの必要パワーの数字が「2」と「6」なら、このターン、このユニットのBPを+3000する。";

  it("XG4-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-2072）", () => {
    expectCatalogText("XG4-081", TEXT);
    expectUnit("XG4-081", { name: "仮面ライダーブレイド", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("XG4-081", ["N"]);
  });

  it("XG4-081: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2072 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-081", "bl")] }, "XG4-081:bl"))).toBe(true);
  });

  const rodeOff = (hand: ReturnType<typeof inst>[]) =>
    settle(
      rcRideOff(
        battle({ battle: fill(1), rush: [inst("XG4-081", "bl"), inst("SPEC-BIKE", "bk")], hand }, { battle: [inst("SPEC-E-S", "b")], rush: [inst("SPEC-E-S", "r")], deck: deckCards(3, "e") }),
        "XG4-081:bl",
        "SPEC-BIKE:bk",
      ),
    );

  it.fails("XG4-081: RC【ライトニングスラッシュ】— ライドオフしたとき、手札を2枚見せるかを選べる（任意）（出典: atwiki/page-2072「自分の手札を2枚選び、相手に見せてもよい」）（既知の不具合: CARD-XG4-081 RC【ライトニングスラッシュ】の選択が開かない）", () => {
    const s = rodeOff([inst("SPEC-P2", "h2"), inst("SPEC-P6", "h6")]);
    expectChoiceFrom(s, "player1", "XG4-081");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-081: RC — 見せると、敵軍バトルエリアの S ユニットを1体ホールドし、見せたカードが「2」と「6」なら BP+3000（BP5000）（出典: atwiki/page-2072「敵軍バトルエリアのSユニットを1体選びホールドする。その後、見せたカードの必要パワーの数字が「2」と「6」なら、このターン、このユニットのBPを+3000する」）（既知の不具合: CARD-XG4-081 RC【ライトニングスラッシュ】の選択が開かない）", () => {
    let s = rodeOff([inst("SPEC-P2", "h2"), inst("SPEC-P6", "h6")]);
    expectChoiceFrom(s, "player1", "XG4-081");
    s = resolveAll(pickThrough(s, "XG4-081", ["SPEC-P2:h2", "SPEC-P6:h6", "SPEC-E-S:b"]));
    expect(s.players.player2.battle.find((c) => c.instanceId === "SPEC-E-S:b")?.commandHeld).toBe(true);
    expect(s.players.player1.battle.find((c) => c.instanceId === "XG4-081:bl")).toBeDefined();
    expect(bp(s)).toBe(5000);
  });

  it.fails("XG4-081: RC — 見せたカードが「2」と「2」なら BP は上がらない（ホールドはする）（出典: atwiki/page-2072「「2」と「6」なら」）（既知の不具合: CARD-XG4-081 RC【ライトニングスラッシュ】の選択が開かない）", () => {
    let s = rodeOff([inst("SPEC-P2", "h2"), inst("SPEC-P2", "h2b")]);
    expectChoiceFrom(s, "player1", "XG4-081");
    s = resolveAll(pickThrough(s, "XG4-081", ["SPEC-P2:h2", "SPEC-P2:h2b", "SPEC-E-S:b"]));
    expect(s.players.player2.battle.find((c) => c.instanceId === "SPEC-E-S:b")?.commandHeld).toBe(true);
    expect(bp(s)).toBe(2000);
  });

  it("XG4-081: ※ — ライドオフしたときはストライクできない（出典: atwiki/page-2072「これはライドオフしたときストライクできない」）", () => {
    let s = rodeOff([]);
    if (s.pendingEffectChoice?.sourceCardId === "XG4-081") s = settle(s);
    expect(canStrike(s, "XG4-081:bl")).toBe(false);
  });

  const bp = (s: GameState) => bpOf(s, "player1", "XG4-081:bl");
});

// ===========================================================================
describe("XG4-082 バイオライダー（XG4）", () => {
  const TEXT = "※モーフ 【バイオアタック】敵軍ターン中、これがバトルエリアに出たとき、相手は自分自身のSユニットを1体選び撃破するか、これを持ち主の手札に戻すか選ぶ。";

  it("XG4-082: カタログ本文・スペックが出典と一致（出典: atwiki/page-2057）", () => {
    expectCatalogText("XG4-082", TEXT);
    expectUnit("XG4-082", { name: "バイオライダー", category: "MA", size: "S", bp: 1000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "男", "改造人間", "ハイブリッドエネルギー"] });
    expectRarityIn("XG4-082", ["N"]);
  });

  morphTests("XG4-082", "XG4-080", "XG4-073", "atwiki/page-2057");

  it.todo("XG4-082:【バイオアタック】— 敵軍ターン中にバトルエリアに出たとき、相手は自分自身の S ユニットを1体撃破するか、これを手札に戻すかを選ぶ（出典: atwiki/page-2057）（未対応の理由: 敵軍ターン中に自軍ユニットをバトルエリアに出す手段（モーフでの置き換えが「バトルエリアに出た」に当たるか）が出典で決まらず、盤面を組めない）");
});

// ===========================================================================
describe("XG4-083 ディケイド ファイズ（XG4）", () => {
  const TEXT = "※モーフ ※これは「仮面ライダーファイズ」としてつかえる。 【アタックライド】このターン、これがバトルで撃破したユニットのBPの下三桁が500だったなら、相手に1点ダメージを与える。";

  it("XG4-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-2068）", () => {
    expectCatalogText("XG4-083", TEXT);
    expectUnit("XG4-083", { name: "ディケイド ファイズ", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "ディケイドライバー"] });
    expectRarityIn("XG4-083", ["N"]);
  });

  morphTests("XG4-083", "XG4-079", "XG4-073", "atwiki/page-2068");

  it.todo("XG4-083: ※ — 「仮面ライダーファイズ」としてつかえる（出典: atwiki/page-2068「これは「仮面ライダーファイズ」としてつかえる」）（未対応の理由: 「仮面ライダーファイズ」の名前を参照するカードと組み合わせた盤面がこのバッチの範囲で決められない）");

  const afterRideOff = () =>
    settle(rcRideOff(battle({ rush: [inst("XG4-083", "dz"), inst("SPEC-BIKE", "bk")] }, { battle: [inst("SPEC-E-1500", "a"), inst("SPEC-E-2000", "b")], deck: deckCards(3, "e") }), "XG4-083:dz", "SPEC-BIKE:bk"));

  it("XG4-083: RC【アタックライド】— ライドオフしたターン、バトルで撃破したユニットの BP の下三桁が500（BP1500）なら相手に1点ダメージ（出典: atwiki/page-2068「このターン、これがバトルで撃破したユニットのBPの下三桁が500だったなら、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(settle(attack(afterRideOff(), "XG4-083:dz", "SPEC-E-1500:a")));
    expect(zoneOf(s, "player2", "SPEC-E-1500:a")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("XG4-083: RC — BP2000 のユニットを撃破してもダメージは与えない（出典: atwiki/page-2068「BPの下三桁が500だったなら」）（既知の不具合: CARD-XG4-083 RC【アタックライド】が撃破したユニットの BP を見ずにダメージを与える）", () => {
    const s = resolveAll(settle(attack(afterRideOff(), "XG4-083:dz", "SPEC-E-2000:b")));
    expect(zoneOf(s, "player2", "SPEC-E-2000:b")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG4-083: ライドオフしていなければ（RC が成立していなければ）BP1500 を撃破してもダメージは与えない（出典: atwiki/page-2068「CN：RC」）", () => {
    const s = resolveAll(settle(attack(battle({ battle: [inst("XG4-083", "dz")] }, { battle: [inst("SPEC-E-1500", "a")], deck: deckCards(3, "e") }), "XG4-083:dz", "SPEC-E-1500:a")));
    expect(zoneOf(s, "player2", "SPEC-E-1500:a")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });
});
