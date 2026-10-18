/**
 * カード別スペック: RK-029〜RK-035（ザ・マスクドライダーEXP vol.1 クウガMF〜ダークウイング）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-031・RK-034・RK-035 の Q&A、
 *     RK-043・RK-061 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-05、R-ADD-07 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマル」を SR／N として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-031 Q2・Q3 のうち「オートバジンBM 下でライドオフした G3MILD は BP0 で撃破される」— rulesSpec/05-bp-strike-damage.test.ts R-BP-02
 *  - RK-033 と RK-063（同名・テキスト違い）の枚数制限 — rulesSpec/01-overview-deck.test.ts R-DECK-02/04
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackersOf,
  bpOf,
  calm,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  enterHold,
  expectCatalogText,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  held,
  inst,
  lastBattleBps,
  mount,
  p1Battle,
  pick,
  playOp,
  rcUnit,
  releasedCat,
  releasedN,
  resolveAll,
  rideOff,
  rideOffOffered,
  ridingPair,
  settle,
  skip,
  st,
  strike,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RK2-022-042.helpers";

const KAMEN = sUnit("SPEC-KAMEN", { category: "ET", bp: 2000, features: ["仮面ライダー", "男"] });
const KAMEN_M = sUnit("SPEC-KAMEN-M", { category: "ET", size: "M", bp: 2000, features: ["仮面ライダー", "男"] });
const POLICE = sUnit("SPEC-POLICE", { category: "ET", bp: 1000, features: ["警察"] });
const MALE = sUnit("SPEC-MALE", { category: "ET", bp: 2000, features: ["男"] });
const MIRROR = sUnit("SPEC-MIRROR", { category: "WB", bp: 2000, features: ["仮面ライダー", "ミラーライダー"] });
const DRAGON = sUnit("SPEC-DRAGON", { category: "WB", bp: 2000, features: ["ドラゴン"] });
const E1500 = sUnit("SPEC-E1500", { bp: 1500 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500 });
const E5500 = sUnit("SPEC-E5500", { bp: 5500 });
const E6500 = sUnit("SPEC-E6500", { bp: 6500 });
const EM = sUnit("SPEC-EM", { bp: 1500, size: "M" });
const RC = rcUnit("SPEC-RC", { bp: 1500 });
const EXTRA = [KAMEN, KAMEN_M, POLICE, MALE, MIRROR, DRAGON, E1500, E3500, E5500, E6500, EM, RC];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

/**
 * アナザーアギト（RK-032:a）を出す。※で捨札にするユニット（discard）を選び、選んだあとラッシュエリアに残っていれば
 * もう一度出す（「〜を捨札にしなければ出られない」の支払いのあとに出る手順。RS-242 の照合〈cardSpec/RS4-222-242.c.test.ts〉と同じ）。
 * vehicle を渡すとそのビークルにライドして出る（ライドオフの選択は残す）。
 */
function agitoIn(s: GameState, discard: string, vehicle?: string): GameState {
  const go = (t: GameState) => (vehicle ? mount(t, "RK-032:a", vehicle) : enter(t, "RK-032:a"));
  let t = resolveAll(go(s), [discard]);
  if (zoneOf(t, "player1", "RK-032:a") === "rush") t = go(t);
  return t;
}

// ===========================================================================
describe("RK-029 仮面ライダークウガMF", () => {
  const TEXT =
    "※これはライド中、ライドしていない敵軍Sユニットにアタックされない。 【マイティキック】自軍ターン中、これは自軍バトルエリアにある特徴「警察」を持つユニット1体につきBP+1000される。";

  it("RK-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-217）", () => {
    expectCatalogText("RK-029", TEXT);
    expectStats("RK-029", {
      name: "仮面ライダークウガMF",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "1/3",
      powerCost: 4,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "アマダム"],
    });
    expectRarityIn("RK-029", ["SR"]);
  });

  it("RK-029: ※ ライド中は、ライドしていない敵軍 S ユニットにアタックされない（ライド中の S ユニット・M ユニットにはアタックされる）（出典: atwiki/page-217）", () => {
    const s = enemyTurn(
      { battle: ridingPair("RK-029", "k", "RK-058", "v") },
      { battle: [inst("SPEC-E1500", "a"), inst("SPEC-EM", "m"), ...ridingPair("SPEC-RC", "r", "RK-030", "ev")] },
    );
    expect(attackersOf(s, "RK-029:k")).toEqual(["SPEC-EM:m", "SPEC-RC:r"]);
  });

  it("RK-029: ※ ライドしていなければ、ライドしていない敵軍 S ユニットにもアタックされる（出典: atwiki/page-217「これはライド中、」）", () => {
    const s = enemyTurn({ battle: [inst("RK-029", "k")] }, { battle: [inst("SPEC-E1500", "a")] });
    expect(attackersOf(s, "RK-029:k")).toEqual(["SPEC-E1500:a"]);
  });

  const kick = (battle: ReturnType<typeof inst>[]) =>
    settle(rideOff(mount(board({ battle, rush: [inst("RK-029", "k"), inst("RK-058", "v")] }), "RK-029:k", "RK-058:v"), true));

  it("RK-029: RC — ライドオフすると、自軍バトルエリアの特徴「警察」を持つユニット1体につき BP+1000（2体で BP5000）（出典: atwiki/page-217「【マイティキック】…特徴「警察」を持つユニット1体につきBP+1000される」）", () => {
    const s = kick([inst("SPEC-POLICE", "p1"), inst("SPEC-POLICE", "p2")]);
    expect(bpOf(s, "player1", "RK-029:k")).toBe(5000);
  });

  it("RK-029: RC — 自軍ラッシュエリアの「警察」は数えない（出典: atwiki/page-217「自軍バトルエリアにある」）", () => {
    let s = board({ battle: [inst("SPEC-POLICE", "p1")], rush: [inst("RK-029", "k"), inst("RK-058", "v"), inst("SPEC-POLICE", "r")] });
    s = settle(rideOff(mount(s, "RK-029:k", "RK-058:v"), true));
    expect(bpOf(s, "player1", "RK-029:k")).toBe(4000);
  });

  it("RK-029: ライドしないで出たときは RC が発動せず、「警察」がいても BP3000 のまま（出典: atwiki/page-217・R-KW-RC-01）", () => {
    const s = settle(enter(board({ battle: [inst("SPEC-POLICE", "p1")], rush: [inst("RK-029", "k")] }), "RK-029:k"));
    expect(bpOf(s, "player1", "RK-029:k")).toBe(3000);
  });

  it.todo(
    "RK-029: 公式Q&A（相互参照）— クウガMF を「RK-271 仮面ライダークウガRM」の追加条件として指定されたユニットとして扱い、ベリー（RK-188）でクウガRM を出せる（出典: atwiki/page-217 Q1）— RK-188・RK-271 は本範囲外のカード",
  );
  // atwiki/page-217 Q2（RK-163 側の atwiki/page-650 Q1 と同じ公式回答）「はい、撃破されます。」
  it.fails("RK-029: 公式Q&A（相互参照）— 「仮面ライダークウガMF」として使える XG1-068 ディケイド クウガMF も、カード名を指定する効果（RK-163【無意識の記憶力】）の対象になり、敵軍の RK-029 を撃破できる（出典: atwiki/page-217 Q2・atwiki/page-650 Q1）— 既知の不具合: CARD-RK-163【無意識の記憶力】が未実装", () => {
    let s = board({ rush: [inst("RK-163", "az"), inst("RK-058", "v")] }, { rush: [inst("RK-029", "k")], discard: [inst("XG1-068", "d")] });
    s = rideOff(mount(s, "RK-163:az", "RK-058:v"), true);
    s = pick(s, "XG1-068:d");
    expect(choiceIds(s)).toEqual(["RK-029:k"]);
    s = resolveAll(pick(s, "RK-029:k"));
    expect(zoneOf(s, "player2", "RK-029:k")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-030 トライチェイサー", () => {
  const TEXT =
    "※これにライドしているユニットはBP+1000される。 【無線通信】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚を見てもよい。そうしたとき、それを元に戻すか、山札の下に戻すかを選択する。";

  it("RK-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-202）", () => {
    expectCatalogText("RK-030", TEXT);
    expectVehicleStats("RK-030", { name: "トライチェイサー", category: "ET", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-030", ["N"]);
  });

  it("RK-030: ※ これにライドしているユニットは BP+1000 される（出典: atwiki/page-202）", () => {
    const s = board({ battle: ridingPair("SPEC-RC", "u", "RK-030", "v") });
    expect(bpOf(s, "player1", "SPEC-RC:u")).toBe(2500);
  });

  const radio = () =>
    mount(board({ rush: [inst("SPEC-RC", "u"), inst("RK-030", "v")], deck: deckCards(4) }), "SPEC-RC:u", "RK-030:v");

  it("RK-030: 【無線通信】出たとき、自軍山札の上から1枚を見るかを選べる（任意）（出典: atwiki/page-202「自軍山札の上から1枚を見てもよい」）", () => {
    const s = radio();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-030");
    expect(choiceIds(s)).toEqual(["TST-OP:dk0"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-030: 見たカードを山札の下に戻せる（出典: atwiki/page-202「山札の下に戻すかを選択する」）", () => {
    const s = settle(pick(pick(radio(), "TST-OP:dk0"), "deck_bottom"));
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk1", "TST-OP:dk2", "TST-OP:dk3", "TST-OP:dk0"]);
  });

  it("RK-030: 見たカードを元に（山札の上に）戻せる（出典: atwiki/page-202「それを元に戻すか」）", () => {
    const s = settle(pick(pick(radio(), "TST-OP:dk0"), "deck_top"));
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2", "TST-OP:dk3"]);
  });

  it("RK-030: 見ないことを選べば山札はそのまま（出典: atwiki/page-202「見てもよい」）", () => {
    const s = settle(skip(radio()));
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2", "TST-OP:dk3"]);
  });
});

// ===========================================================================
describe("RK-031 仮面ライダーG3MILD", () => {
  const TEXT =
    "【バッテリー交換】自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（置けなければこの効果は発動できない）。";

  it("RK-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-203）", () => {
    expectCatalogText("RK-031", TEXT);
    expectStats("RK-031", {
      name: "仮面ライダーG3MILD",
      category: "ET",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 0,
      comboNumber: "RC",
      features: ["仮面ライダー", "メカ", "男", "警察"],
    });
    expectRarityIn("RK-031", ["N"]);
  });

  const rc = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rideOff(mount(board({ rush: [inst("RK-031", "g"), inst("RK-058", "v")], deck: deckCards(4), ...p1 }, p2), "RK-031:g", "RK-058:v"), true);

  it("RK-031: RC — 発動するかを選べ（任意）、発動すると自軍山札の上の1枚を自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-203「…ホールド状態で置いてもよい」）", () => {
    let s = rc();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-031");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-OP:dk0")).toBe("command");
    expect(cardIn(s, "player1", "TST-OP:dk0")?.commandHeld).toBe(true);
  });

  it("RK-031: RC — 発動しないことを選べば山札はそのまま（出典: atwiki/page-203「置いてもよい」）", () => {
    const s = settle(skip(rc()));
    expect(zoneIds(s, "player1", "deck")[0]).toBe("TST-OP:dk0");
    expect(s.players.player1.command).toHaveLength(0);
  });

  it("RK-031: RC — 自軍コマンドゾーンに置けない（5枚）なら発動できない（山札はそのまま）（出典: atwiki/page-203「置けなければこの効果は発動できない」）", () => {
    const s = settle(rc({ command: releasedN(5, "TST-OP", "c") }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-031");
    expect(zoneIds(s, "player1", "deck")[0]).toBe("TST-OP:dk0");
  });

  // 公式 Q1「はい、できます。」
  it("RK-031: 公式Q&A — 効果を実行できない（コマンドゾーンに置けない）ときでもライドオフできる（出典: grnrngr/faq-rider-1 RK-031 Q1・atwiki/page-203 Q1）", () => {
    const s = mount(board({ rush: [inst("RK-031", "g"), inst("RK-058", "v")], command: releasedN(5, "TST-OP", "c"), deck: deckCards(4) }), "RK-031:g", "RK-058:v");
    expect(rideOffOffered(s)).toBe(true);
    const t = settle(rideOff(s, true));
    expect(cardIn(t, "player1", "RK-031:g")?.mountedOnInstanceId).toBeUndefined();
    expect(zoneOf(t, "player1", "RK-031:g")).toBe("battle");
  });

  // 公式 Q2「はい、できます。」（RC を発動させてから撃破される）
  it("RK-031: 公式Q&A — オートバジンBM 下でライドオフして BP0 になっても、RC を先に発動してから撃破される（出典: grnrngr/faq-rider-1 RK-031 Q2・Q3・atwiki/page-203 Q2・Q3）", () => {
    let s = rc({}, { battle: [inst("RK-046", "bm")] });
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-OP:dk0")).toBe("command");
    expect(zoneOf(s, "player1", "RK-031:g")).toBe("discard");
  });

  it("RK-031: ライドしないで出たときは RC が発動しない（出典: atwiki/page-203・R-KW-RC-01）", () => {
    const s = settle(enter(board({ rush: [inst("RK-031", "g")], deck: deckCards(4) }), "RK-031:g"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-031");
    expect(s.players.player1.command).toHaveLength(0);
  });
});

// ===========================================================================
describe("RK-032 アナザーアギト", () => {
  const TEXT =
    "※これは自軍ラッシュエリアの特徴「仮面ライダー」を持つユニットを1体捨札にしなければバトルエリアに出られない。 【アナザーパンチ】敵軍バトルエリアから、特徴「仮面ライダー」を持つSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RK-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-218）", () => {
    expectCatalogText("RK-032", TEXT);
    expectStats("RK-032", {
      name: "アナザーアギト",
      category: "MA",
      size: "S",
      bp: 5000,
      sp: "1/3",
      powerCost: 3,
      comboNumber: "RC",
      features: ["仮面ライダー", "男"],
    });
    expectRarityIn("RK-032", ["SR"]);
  });

  it("RK-032: ※ 自軍ラッシュエリアに特徴「仮面ライダー」を持つユニットがいなければバトルエリアに出られない（出典: atwiki/page-218）", () => {
    expect(canEnter(board({ rush: [inst("RK-032", "a"), inst("SPEC-MALE", "m")] }), "RK-032:a")).toBe(false);
  });

  it("RK-032: ※ 自軍ラッシュエリアの「仮面ライダー」を1体捨札にしてバトルエリアに出る（出典: atwiki/page-218「1体捨札にしなければバトルエリアに出られない」）", () => {
    let s = board({ rush: [inst("RK-032", "a"), inst("SPEC-KAMEN", "k")] });
    expect(canEnter(s, "RK-032:a")).toBe(true);
    s = agitoIn(s, "SPEC-KAMEN:k");
    expect(zoneOf(s, "player1", "RK-032:a")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("discard");
  });

  it("RK-032: ※ 自軍バトルエリアの「仮面ライダー」は捨札にできない（ラッシュエリアのものだけ）（出典: atwiki/page-218「自軍ラッシュエリアの」）", () => {
    expect(canEnter(board({ battle: [inst("SPEC-KAMEN", "b")], rush: [inst("RK-032", "a")] }), "RK-032:a")).toBe(false);
  });

  const punch = (p2: Partial<GameState["players"]["player2"]>) => {
    let s = board({ rush: [inst("RK-032", "a"), inst("RK-058", "v"), inst("SPEC-KAMEN", "k")] }, p2);
    s = agitoIn(s, "SPEC-KAMEN:k", "RK-058:v");
    return rideOff(s, true);
  };

  it("RK-032: ※ ビークルにライドして出るときも「仮面ライダー」を1体捨札にする（出典: atwiki/page-218「捨札にしなければバトルエリアに出られない」）", () => {
    let s = board({ rush: [inst("RK-032", "a"), inst("RK-058", "v"), inst("SPEC-KAMEN", "k")] });
    s = agitoIn(s, "SPEC-KAMEN:k", "RK-058:v");
    expect(zoneOf(s, "player1", "RK-032:a")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("discard");
  });

  it("RK-032: RC — 敵軍バトルエリアの特徴「仮面ライダー」を持つ S ユニットを選ぶ（ラッシュエリア・M ユニット・「仮面ライダー」以外は選べない）（出典: atwiki/page-218「敵軍バトルエリアから、特徴「仮面ライダー」を持つSユニットを1体選び」）", () => {
    const s = punch({ battle: [inst("SPEC-KAMEN", "e"), inst("SPEC-KAMEN-M", "m"), inst("SPEC-MALE", "x")], rush: [inst("SPEC-KAMEN", "r")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-032");
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN:e"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-032: RC — 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-218「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = settle(pick(punch({ battle: [inst("SPEC-KAMEN", "e")] }), "SPEC-KAMEN:e"));
    expect(zoneOf(s, "player2", "SPEC-KAMEN:e")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-KAMEN:e")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.todo(
    "RK-032: 公式Q&A（相互参照）— 電王RF（RK-061）【一本釣り】で敵軍パワーゾーンから出させるときも、相手はラッシュエリアの「仮面ライダー」を1体捨札にしなければならず、いなければ選べない（出典: grnrngr/faq-rider-1 RK-061 Q2）— RK-061 は本範囲外のカード",
  );
});

// ===========================================================================
describe("RK-033 仮面ライダー龍騎", () => {
  const TEXT = "【ドラゴンライダーキック】特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」";

  it("RK-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-178）", () => {
    expectCatalogText("RK-033", TEXT);
    expectStats("RK-033", {
      name: "仮面ライダー龍騎",
      category: "WB",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 6,
      features: ["仮面ライダー", "男", "ミラーライダー"],
    });
    expectRarityIn("RK-033", ["SR"]);
  });

  it("RK-033: 特徴「ドラゴン」を持つユニットの次に出ると「SP1」を得て、ストライクで1点与える（出典: atwiki/page-178・R-CN-05（コンビネーションは直前に出たユニットとの間に成立））", () => {
    let s = enter(board({ battle: [inst("SPEC-DRAGON", "d")], rush: [inst("RK-033", "r")] }), "RK-033:r");
    expect(canStrike(s, "RK-033:r")).toBe(true);
    s = settle(strike(s, "RK-033:r"));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-033: ドラグレッダー（特徴「ドラゴン」）からのコンビネーションでも「SP1」を得る（出典: atwiki/page-178・page-179「特徴：ミラーモンスター／獣／ドラゴン」）", () => {
    const s = enter(board({ battle: [inst("RK-034", "d")], rush: [inst("RK-033", "r")] }), "RK-033:r");
    expect(canStrike(s, "RK-033:r")).toBe(true);
  });

  it("RK-033: 「ドラゴン」以外のユニットの次に出たときは「SP！」のままでストライクできない（出典: atwiki/page-178「SP：！」）", () => {
    const s = enter(board({ battle: [inst("SPEC-DRAGON", "d"), inst("TST-UNIT-0", "x")], rush: [inst("RK-033", "r")] }), "RK-033:r");
    expect(canStrike(s, "RK-033:r")).toBe(false);
  });

  it("RK-033: 1番目に出たとき（コンビネーションの相手がいない）はストライクできない（出典: atwiki/page-178「ユニットからコンビネーションするとき」）", () => {
    const s = enter(board({ rush: [inst("RK-033", "r")] }), "RK-033:r");
    expect(canStrike(s, "RK-033:r")).toBe(false);
  });
});

// ===========================================================================
describe("RK-034 ドラグレッダー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【ドラグブレス】このユニットと隣り合う特徴「ミラーライダー」を持つSユニットは、バトルするときBP+2000される。";

  it("RK-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-179）", () => {
    expectCatalogText("RK-034", TEXT);
    expectStats("RK-034", {
      name: "ドラグレッダー",
      category: "WB",
      size: "S",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      features: ["ミラーモンスター", "獣", "ドラゴン"],
    });
    expectRarityIn("RK-034", ["N"]);
  });

  it("RK-034: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（リリース状態のコマンドがなければ出られない）（出典: atwiki/page-179・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-034", "d")], command: [held("TST-OP", "h")] }), "RK-034:d")).toBe(false);
    const s = calm(enterHold(board({ rush: [inst("RK-034", "d")], command: releasedCat("WB", 1) }), "RK-034:d"));
    expect(zoneOf(s, "player1", "RK-034:d")).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:cWB0")?.commandHeld).toBe(true);
  });

  it("RK-034: 【ドラグブレス】隣り合う「ミラーライダー」の S ユニットは、バトルするとき BP+2000（BP2000 で BP3500 の相手に勝つ）（出典: atwiki/page-179）", () => {
    const s0 = board({ battle: [inst("RK-034", "d")], rush: [inst("SPEC-MIRROR", "m")] }, { battle: [inst("SPEC-E3500", "e")] });
    let s = enter(s0, "SPEC-MIRROR:m");
    s = resolveAll(attack(s, "SPEC-MIRROR:m", "SPEC-E3500:e"));
    expect(lastBattleBps(s)).toEqual({ attacker: 4000, defender: 3500 });
    expect(zoneOf(s, "player2", "SPEC-E3500:e")).toBe("discard");
  });

  it("RK-034: 【ドラグブレス】左隣の「ミラーライダー」にも効く（隣り合うのは左右どちらでも）（出典: atwiki/page-179「隣り合う」・カード評価「両隣のミラーライダーどちらともに与えられる」）", () => {
    let s = board({ battle: [inst("SPEC-MIRROR", "m"), inst("RK-034", "d")] }, { battle: [inst("SPEC-E3500", "e")] });
    s = resolveAll(attack(s, "SPEC-MIRROR:m", "SPEC-E3500:e"));
    expect(lastBattleBps(s)?.attacker).toBe(4000);
  });

  it("RK-034: 【ドラグブレス】敵軍ターンにアタックされてバトルするときも BP+2000（出典: atwiki/page-179「バトルするとき」）", () => {
    let s = enemyTurn({ battle: [inst("SPEC-MIRROR", "m"), inst("RK-034", "d")] }, { battle: [inst("SPEC-E3500", "e")] });
    s = resolveAll(attack(s, "SPEC-E3500:e", "SPEC-MIRROR:m", "player2"));
    expect(zoneOf(s, "player1", "SPEC-MIRROR:m")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E3500:e")).toBe("discard");
  });

  it("RK-034: 【ドラグブレス】隣り合っていない「ミラーライダー」には効かない（出典: atwiki/page-179「このユニットと隣り合う」）", () => {
    let s = board({ battle: [inst("SPEC-MIRROR", "m"), inst("TST-UNIT-0", "x"), inst("RK-034", "d")] }, { battle: [inst("SPEC-E3500", "e")] });
    s = resolveAll(attack(s, "SPEC-MIRROR:m", "SPEC-E3500:e"));
    expect(lastBattleBps(s)?.attacker).toBe(2000);
  });

  it("RK-034: 【ドラグブレス】バトルしていないときの BP は変わらない（出典: atwiki/page-179「バトルするとき」）", () => {
    const s = board({ battle: [inst("SPEC-MIRROR", "m"), inst("RK-034", "d")] });
    expect(bpOf(s, "player1", "SPEC-MIRROR:m")).toBe(2000);
  });

  // 公式 Q1「いいえ、発動しません。…ラッシュエリアではユニットの並び順を参照することはありません。」
  it("RK-034: 公式Q&A — ラッシュエリアにあるときは隣り合うユニットがなく、効果は発動しない（出典: grnrngr/faq-rider-1 RK-034 Q1・atwiki/page-179 Q1）", () => {
    let s = board({ battle: [inst("SPEC-MIRROR", "m")], rush: [inst("RK-034", "d")] }, { battle: [inst("SPEC-E3500", "e")] });
    s = resolveAll(attack(s, "SPEC-MIRROR:m", "SPEC-E3500:e"));
    expect(lastBattleBps(s)?.attacker).toBe(2000);
  });

  it("RK-034: ドラグレッダー2体に挟まれた「ミラーライダー」は BP+4000（出典: atwiki/page-179 カード評価「ドラグレッダー2匹で挟めばBP+4000となる」・R-CTR-02 相当の重複）", () => {
    let s = board({ battle: [inst("RK-034", "d1"), inst("SPEC-MIRROR", "m"), inst("RK-034", "d2")] }, { battle: [inst("SPEC-E5500", "e")] });
    s = resolveAll(attack(s, "SPEC-MIRROR:m", "SPEC-E5500:e"));
    expect(lastBattleBps(s)?.attacker).toBe(6000);
  });
});

// ===========================================================================
describe("RK-035 ダークウイング", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【ソニックブレイカー】これが自軍バトルエリアにある間、すべての敵軍ユニットは特徴を持たないユニットとして扱い、特徴を追加されない。";

  it("RK-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-180）", () => {
    expectCatalogText("RK-035", TEXT);
    expectStats("RK-035", {
      name: "ダークウイング",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      features: ["ミラーモンスター", "獣"],
    });
    expectRarityIn("RK-035", ["N"]);
  });

  it("RK-035: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-180・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-035", "w")], command: [held("TST-OP", "h")] }), "RK-035:w")).toBe(false);
    const s = calm(enterHold(board({ rush: [inst("RK-035", "w")], command: releasedCat("WB", 1) }), "RK-035:w"));
    expect(zoneOf(s, "player1", "RK-035:w")).toBe("battle");
  });

  /** アナザーアギト（RK-032）の RC の候補（敵軍バトルエリアの「仮面ライダー」S ユニット）で、敵軍ユニットの特徴を確かめる。 */
  const punchTargets = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) => {
    let s = board({ ...p1, rush: [inst("RK-032", "a"), inst("RK-058", "v"), inst("SPEC-KAMEN", "k"), ...(p1.rush ?? [])] }, p2);
    s = agitoIn(s, "SPEC-KAMEN:k", "RK-058:v");
    return choiceIds(rideOff(s, true));
  };

  it("RK-035: 【ソニックブレイカー】自軍バトルエリアにある間、敵軍ユニットは特徴を持たない（「仮面ライダー」を選ぶ効果の対象にならない）（出典: atwiki/page-180）", () => {
    expect(punchTargets({ battle: [inst("RK-035", "w")] }, { battle: [inst("SPEC-KAMEN", "e")] })).toEqual([]);
  });

  it("RK-035: 【ソニックブレイカー】ラッシュエリアにあるときは効かない（出典: atwiki/page-180「これが自軍バトルエリアにある間」）", () => {
    expect(punchTargets({ rush: [inst("RK-035", "w")] }, { battle: [inst("SPEC-KAMEN", "e")] })).toEqual(["SPEC-KAMEN:e"]);
  });

  it("RK-035: 【ソニックブレイカー】自軍ユニットの特徴は失われない（出典: atwiki/page-180「すべての敵軍ユニットは」）", () => {
    // 自軍ラッシュエリアの「仮面ライダー」を捨札にしてアナザーアギトを出せる（自軍の特徴は残る）。
    let s = board({ battle: [inst("RK-035", "w")], rush: [inst("RK-032", "a"), inst("SPEC-KAMEN", "k")] });
    expect(canEnter(s, "RK-032:a")).toBe(true);
    s = agitoIn(s, "SPEC-KAMEN:k");
    expect(zoneOf(s, "player1", "RK-032:a")).toBe("battle");
  });

  it("RK-035: 【ソニックブレイカー】敵軍ユニットは特徴を追加されない（改造人間 RK-001 があっても「改造人間」にならない）（出典: atwiki/page-180「特徴を追加されない」）", () => {
    // 敵軍（player2）が自分のターンに超電子ダイナモ（RK-005「特徴「改造人間」を持つ自軍Sユニットを1体選ぶ」）を使う。
    let s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { battle: [inst("RK-035", "w")], deck: deckCards(5) },
        player2: {
          operation: [inst("RK-001", "k")],
          hand: [inst("RK-005", "dy")],
          rush: [inst("SPEC-MALE", "em")],
          command: releasedCat("ET", 1, "e"),
          deck: deckCards(5, "e"),
        },
      },
      EXTRA,
    );
    const r = playOp(s, "player2", "RK-005:dy");
    expect(r.ok, r.error).toBe(true);
    s = r.state;
    expect(choiceIds(s)).toEqual([]);
  });

  // 公式 Q1「いいえ、ライドオフさせられません。…ライド状態のままになります。」
  it("RK-035: 公式Q&A — 特徴を失ってビークルの条件を満たさなくなった敵軍ユニットも、ライドしたまま（強制ライドオフしない）（出典: grnrngr/faq-rider-1 RK-035 Q1・atwiki/page-180 Q1）", () => {
    // 敵軍の RC を持たない「仮面ライダー」がマシンゼクトロン（RK-058「特徴「仮面ライダー」を持つ自軍Sユニットは、ＲＣを持っていなくても…ライドできる」）にライドしている。
    const s = calm(enterHold(board({ rush: [inst("RK-035", "w")], command: releasedCat("WB", 1) }, { battle: ridingPair("SPEC-KAMEN", "e", "RK-058", "ez") }), "RK-035:w"));
    expect(zoneOf(s, "player1", "RK-035:w")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-KAMEN:e")?.mountedOnInstanceId).toBe("RK-058:ez");
  });

  it.todo(
    "RK-035: 公式Q&A（相互参照）— ライドシューター（RK-043）の対象は「ユニットカード」なので、ダークウイングがあってもミラーライダーをラッシュできる（出典: grnrngr/faq-rider-1 RK-043 Q2）— RK-043【突入】側の未実装（rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK043 に it.todo）",
  );
});

