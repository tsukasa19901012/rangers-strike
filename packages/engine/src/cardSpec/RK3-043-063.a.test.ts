/**
 * カード別スペック: RK-043〜RK-049（ザ・マスクドライダーEXP vol.1 ライドシューター〜仮面ライダー勝鬼）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RK-043 の読み替え）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-043・RK-044・RK-046・RK-047・RK-048 の Q&A、
 *     RK-057 欄の RK-049 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-01、R-DECK-03 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル」を N として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-043 の読み替え後テキスト・【突入】で必要パワー3のミラーライダーをパワー0・ホールドなしでラッシュできること・
 *    使っていなければラッシュできないこと — rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK043
 *  - RK-044 Q1（イエローオウルで10枚まとめて捨札になっても発動しない）— cardSpec/RS5-264-284.c.test.ts
 *  - RK-046 Q2（ライド中のオートバジンVM を追加条件に使うとライドオフし RC は発動しない）— rulesSpec/07-ride.test.ts R-KW-RC-01
 *  - RK-046 の BP0 撃破・Q5（ファイブテクター）— rulesSpec/05-bp-strike-damage.test.ts R-BP-02
 *  - RK-047 Q1（ゴーマ宮の「可能ならアタックする」を受けない）— cardSpec/RS4-179-200.a.test.ts RS-187
 *  - RK-048 の基本動作（リリースしてから撃破・してもよい・足りなければ撃破しない）— cardSpec/RS5-audit-out-of-range.test.ts
 *  - RK-048 Q1（タンクコマンド下でも発動した NC はそのまま実行。atwiki の 2010/02/08 修正を採る）— cardSpec/RS5-243-263.c.test.ts
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activateField,
  act,
  attack,
  attackedInEnemyTurn,
  attackTargets,
  bpOf,
  canActivateField,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  copies,
  deckCards,
  deckWithTen,
  declareRush,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  fill,
  heldCount,
  inst,
  lastBattleBps,
  mount,
  mountedOn,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  playOp,
  powerCards,
  rcUnit,
  releasedCat,
  releasedN,
  resolveAll,
  rideOff,
  ridingPair,
  rushFromHand,
  rushOffered,
  rushWithoutHoldOffered,
  settle,
  skip,
  spOf,
  st,
  toPhase,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RK3-043-063.helpers";

const MIRROR3 = sUnit("SPEC-MIRROR3", { category: "WB", bp: 3000, powerCost: 3, features: ["仮面ライダー", "ミラーライダー"] });
const MIRROR6 = sUnit("SPEC-MIRROR6", { category: "WB", bp: 4000, powerCost: 6, features: ["仮面ライダー", "ミラーライダー"] });
const NONMIRROR3 = sUnit("SPEC-NONMIRROR3", { category: "WB", bp: 3000, powerCost: 3, features: ["仮面ライダー"] });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const EM5000 = sUnit("SPEC-EM5000", { bp: 5000, size: "M" });
const COST2 = sUnit("SPEC-COST2", { bp: 3000, powerCost: 2 });
const RC = rcUnit("SPEC-RC", { bp: 1500 });
const MALE_K = sUnit("SPEC-MALE-K", { category: "ET", bp: 2000, features: ["男"] });
const EXTRA = [MIRROR3, MIRROR6, NONMIRROR3, E2000, E3000, EM5000, COST2, RC];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);

/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-043 ライドシューター", () => {
  // 公式の読み替え（faq-rider-1 RK-043 Q）:「そうしたとき、このターン、次にラッシュする特徴「ミラーライダー」を持つユニットカードの…」
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【突入】自軍ラッシュフェイズ中、このビークルを捨札にしてもよい。そうしたとき、このターン、次にラッシュする特徴「ミラーライダー」を持つユニットカードの必要パワーの数字は3少なくなり、コマンドをホールドせずにラッシュできる（この効果は重複しない）。";

  it("RK-043: カタログ本文（公式の読み替え後）・スペックが出典と一致（出典: atwiki/page-187・grnrngr/faq-rider-1 RK-043 の読み替え）", () => {
    expectCatalogText("RK-043", TEXT);
    expectVehicleStats("RK-043", { name: "ライドシューター", category: "WB", powerCost: 0, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-043", ["N"]);
  });

  it("RK-043: ※ デッキに好きな枚数入れてもよい（10枚入れたデッキが構築ルールを満たす）（出典: atwiki/page-187・R-DECK-03）", () => {
    expect(deckWithTen("RK-043", "ライドシューター")).toBe(true);
  });

  it("RK-043: 【突入】自軍ラッシュフェイズ中に、ラッシュエリアのこのビークルを捨札にして使える（任意）（出典: atwiki/page-187「自軍ラッシュフェイズ中、このビークルを捨札にしてもよい」）", () => {
    const s = rushPhase({ rush: [inst("RK-043", "rs")] });
    expect(canActivateField(s, "RK-043:rs")).toBe(true);
    const t = activateField(s, "RK-043:rs");
    expect(zoneOf(t, "player1", "RK-043:rs")).toBe("discard");
  });

  it("RK-043: 【突入】自軍バトルフェイズ・敵軍ターンには使えない（出典: atwiki/page-187「自軍ラッシュフェイズ中」）", () => {
    expect(canActivateField(board({ rush: [inst("RK-043", "rs")] }), "RK-043:rs")).toBe(false);
    const enemy = st({ phase: "rush", activePlayer: "player2", player1: { rush: [inst("RK-043", "rs")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);
    expect(canActivateField(enemy, "RK-043:rs", "player1")).toBe(false);
  });

  it("RK-043: 【突入】の軽減は3だけ — 必要パワー6のミラーライダーは、パワー3ならラッシュでき、パワー2ではできない（出典: atwiki/page-187「必要パワーの数字は3少なくなり」）", () => {
    const s3 = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("SPEC-MIRROR6", "m")], power: powerCards(3) }), "RK-043:rs");
    expect(rushWithoutHoldOffered(s3, "SPEC-MIRROR6:m")).toBe(true);
    const s2 = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("SPEC-MIRROR6", "m")], power: powerCards(2) }), "RK-043:rs");
    expect(rushOffered(s2, "SPEC-MIRROR6:m")).toBe(false);
  });

  it("RK-043: 【突入】の対象は特徴「ミラーライダー」を持つユニットカードだけ（出典: atwiki/page-187「次にラッシュする特徴「ミラーライダー」を持つユニットカード」）", () => {
    const s = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("SPEC-NONMIRROR3", "n")] }), "RK-043:rs");
    expect(rushOffered(s, "SPEC-NONMIRROR3:n")).toBe(false);
  });

  it("RK-043: 【突入】は「次にラッシュする」1枚だけ — 1枚目をラッシュしたら、2枚目は軽減されない（出典: atwiki/page-187・grnrngr/faq-rider-1 RK-043 Q「最初にラッシュする…ユニットカード」）", () => {
    let s = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("SPEC-MIRROR3", "a"), inst("SPEC-MIRROR3", "b")] }), "RK-043:rs");
    const r = declareRush(s, "player1", "SPEC-MIRROR3:a");
    expect(r.ok, r.error).toBe(true);
    s = settle(r.state);
    expect(zoneOf(s, "player1", "SPEC-MIRROR3:a")).toBe("rush");
    expect(rushOffered(s, "SPEC-MIRROR3:b")).toBe(false);
  });

  it("RK-043: 【突入】は重複しない — 2枚捨札にしても軽減は3のまま（出典: atwiki/page-187「（この効果は重複しない）」）", () => {
    let s = rushPhase({ rush: [inst("RK-043", "r1"), inst("RK-043", "r2")], hand: [inst("SPEC-MIRROR6", "m")], power: powerCards(2) });
    s = activateField(s, "RK-043:r1");
    if (canActivateField(s, "RK-043:r2")) s = activateField(s, "RK-043:r2");
    expect(rushOffered(s, "SPEC-MIRROR6:m")).toBe(false);
  });

  // 公式 Q（読み替え）:「効果の対象は、『「RK-043 ライドシューター」を捨札にしたそのターン中に、最初にラッシュする特徴「ミラーライダー」を持つユニットカード』」
  it("RK-043: 公式Q&A — 捨札にしたターン中にラッシュしなければ、次の自軍ターンには軽減されない（出典: grnrngr/faq-rider-1 RK-043 Q・atwiki/page-187 Q3）", () => {
    let s = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("SPEC-MIRROR3", "m")] }), "RK-043:rs");
    // 自軍ターンを終え、敵軍ターンも終えて次の自軍ラッシュフェイズへ
    s = toPhase(toPhase(s, "player2", "rush"), "player1", "rush");
    expect(s.activePlayer).toBe("player1");
    expect(s.phase).toBe("rush");
    expect(rushOffered(s, "SPEC-MIRROR3:m")).toBe(false);
  });

  // 公式 Q（読み替え）:「効果の対象は「ユニットカード」になりますので、敵軍バトルエリアに「RK-035 ダークウィング」があっても…ラッシュできる」
  it("RK-043: 公式Q&A — 敵軍バトルエリアにダークウイングがあっても、【突入】で必要パワーが3足りないミラーライダーをラッシュできる（出典: grnrngr/faq-rider-1 RK-043 Q・atwiki/page-187 Q4）", () => {
    const s = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("SPEC-MIRROR3", "m")] }, { battle: [inst("RK-035", "dw")] }), "RK-043:rs");
    const r = declareRush(s, "player1", "SPEC-MIRROR3:m");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "SPEC-MIRROR3:m")).toBe("rush");
  });

  // atwiki Q5「ユニットにライドされている状態でも捨札にして発動することが可能です。…ライドしていたユニットは、その場にそのまま残ります。ただし、…RC効果を持っていたとしても、その効果は発動しません。」
  it("RK-043: 公式Q&A — ライドされていても捨札にして使え、ライドしていたユニットはその場に残り、RC は発動しない（出典: atwiki/page-187 Q5）", () => {
    let s = rushPhase({ rush: [inst("RK-043", "rs"), { ...inst("RK-031", "g"), mountedOnInstanceId: "RK-043:rs" }] });
    expect(canActivateField(s, "RK-043:rs")).toBe(true);
    s = settle(activateField(s, "RK-043:rs"));
    expect(zoneOf(s, "player1", "RK-043:rs")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-031:g")).toBe("rush");
    expect(mountedOn(s, "player1", "RK-031:g")).toBeUndefined();
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-031");
  });

  // atwiki Q6「いいえ、できません。…WBとDAのマルチカテゴリを持つ「XG-080 仮面ライダーアビス」をラッシュするには、自軍コマンドゾーンにWBとDAを持ったカードがなければいけません。」
  it("RK-043: 公式Q&A — マルチカテゴリ（WB・DA）のミラーライダーは、コマンドゾーンに WB のカードしかなければ【突入】でもラッシュできない（出典: atwiki/page-187 Q6）", () => {
    const s = activateField(rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("XG1-080", "ab")], command: releasedCat("WB", 1), power: powerCards(2) }), "RK-043:rs");
    expect(rushOffered(s, "XG1-080:ab")).toBe(false);
  });

  it("RK-043: 公式Q&A — コマンドゾーンに WB と DA のカードがあれば、【突入】でホールドせずにラッシュできる（出典: atwiki/page-187 Q6「WBとDAを持ったカードがあれば…ラッシュすることができます」）", () => {
    const s = activateField(
      rushPhase({ rush: [inst("RK-043", "rs")], hand: [inst("XG1-080", "ab")], command: [...releasedCat("WB", 1), ...releasedCat("DA", 1)], power: powerCards(2) }),
      "RK-043:rs",
    );
    expect(rushWithoutHoldOffered(s, "XG1-080:ab")).toBe(true);
    const r = declareRush(s, "player1", "XG1-080:ab");
    expect(r.ok, r.error).toBe(true);
    expect(heldCount(r.state)).toBe(0);
  });

  it.todo(
    "RK-043: 公式Q&A（相互参照）— 【突入】の直後に XG5-066 仮面ライダーベルデの【コピーベント】でラッシュするミラーライダーも3少なくなる（出典: atwiki/page-187 Q1・Q7）— XG5-066 は本範囲外のカード",
  );
  it.todo(
    "RK-043: 公式Q&A（相互参照）— XG7-054 オーズドライバーと併用すると必要パワーは6少なくなる（出典: atwiki/page-187 Q2）— XG7-054 は本範囲外のカード",
  );
});

// ===========================================================================
describe("RK-044 ライオトルーパー", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【1万人ライダー部隊】敵軍ターン中、これが撃破されて捨札になったとき、自軍捨札に「ライオトルーパー」のユニットカードが10枚以上あれば、それをすべて手札に加える。";

  it("RK-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-204）", () => {
    expectCatalogText("RK-044", TEXT);
    expectStats("RK-044", { name: "ライオトルーパー", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 2, features: ["仮面ライダー", "男", "戦闘員"] });
    expectRarityIn("RK-044", ["N"]);
  });

  it("RK-044: ※ デッキに好きな枚数入れてもよい（10枚入れたデッキが構築ルールを満たす）（出典: atwiki/page-204・R-DECK-03）", () => {
    expect(deckWithTen("RK-044", "ライオトルーパー")).toBe(true);
  });

  const destroyed = (inDiscard: number, extraDiscard: ReturnType<typeof inst>[] = []) =>
    resolveAll(attackedInEnemyTurn({ battle: [inst("RK-044", "lt")], discard: [...copies("RK-044", inDiscard, "d"), ...extraDiscard] }, "RK-044:lt"));

  it("RK-044: 【1万人ライダー部隊】敵軍ターン中に撃破されて捨札になったとき、自軍捨札の「ライオトルーパー」が（これを含めて）10枚以上なら、それをすべて手札に加える（出典: atwiki/page-204）", () => {
    const s = destroyed(9, [inst("TST-OP", "other")]);
    const hand = zoneIds(s, "player1", "hand");
    expect(hand.filter((id) => id.startsWith("RK-044:"))).toHaveLength(10);
    expect(hand).toContain("RK-044:lt");
    expect(zoneOf(s, "player1", "TST-OP:other")).toBe("discard");
  });

  it("RK-044: 【1万人ライダー部隊】自軍捨札の「ライオトルーパー」が9枚以下なら何もしない（出典: atwiki/page-204「10枚以上あれば」）", () => {
    const s = destroyed(8);
    expect(zoneOf(s, "player1", "RK-044:lt")).toBe("discard");
    expect(zoneIds(s, "player1", "hand").filter((id) => id.startsWith("RK-044:"))).toHaveLength(0);
  });

  it("RK-044: 【1万人ライダー部隊】自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-204「敵軍ターン中、」）", () => {
    let s = board({ battle: [inst("RK-044", "lt")], discard: copies("RK-044", 9, "d") }, { battle: [inst("TST-UNIT-7", "big")] });
    s = resolveAll(attack(s, "RK-044:lt", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RK-044:lt")).toBe("discard");
    expect(zoneIds(s, "player1", "hand").filter((id) => id.startsWith("RK-044:"))).toHaveLength(0);
  });

  // 公式 Q2「はい、発動します。…「撃破されて捨札になったとき」ですので、「RS-319 デカマスター」の効果で…撃破して捨札にしたのであれば…発動することができます。」
  it("RK-044: 公式Q&A — 敵軍の効果で撃破されて捨札になったときも発動する（出典: grnrngr/faq-rider-1 RK-044 Q2・atwiki/page-204 Q2）", () => {
    // 敵軍（player2）がギンガイオー（RS-687【ガルコンボーガン】敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する）をバトルエリアに出す。
    let s = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RK-044", "lt")], discard: copies("RK-044", 9, "d"), deck: deckCards(3) },
        player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-687:gg" });
    if (s.pendingEffectChoice?.sourceCardId === "RS-687") s = pick(s, "RK-044:lt");
    s = resolveAll(s);
    expect(zoneIds(s, "player1", "hand").filter((id) => id.startsWith("RK-044:"))).toHaveLength(10);
  });
});

// ===========================================================================
describe("RK-045 オートバジンVM", () => {
  const TEXT = "※これにライドしているユニットはBP+1000される。";

  it("RK-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-205）", () => {
    expectCatalogText("RK-045", TEXT);
    expectVehicleStats("RK-045", { name: "オートバジンVM", category: "ET", powerCost: 0, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-045", ["N"]);
  });

  it("RK-045: ※ これにライドしているユニットは BP+1000 される（出典: atwiki/page-205）", () => {
    expect(bpOf(board({ battle: ridingPair("SPEC-RC", "u", "RK-045", "v") }), "player1", "SPEC-RC:u")).toBe(2500);
  });

  it("RK-045: ライドオフしたユニットは BP+1000 されない（出典: atwiki/page-205「これにライドしているユニットは」）", () => {
    const s = settle(rideOff(mount(board({ rush: [inst("SPEC-RC", "u"), inst("RK-045", "v")] }), "SPEC-RC:u", "RK-045:v"), true));
    expect(mountedOn(s, "player1", "SPEC-RC:u")).toBeUndefined();
    expect(bpOf(s, "player1", "SPEC-RC:u")).toBe(1500);
  });
});

// ===========================================================================
describe("RK-046 オートバジンBM", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。 【バスターホイール】これが自軍バトルエリアにある間、敵軍バトルエリアのすべてのSユニットはBP-500される。（BP0以下になったユニットは撃破される）";

  it("RK-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-206）", () => {
    expectCatalogText("RK-046", TEXT);
    expectStats("RK-046", {
      name: "オートバジンBM",
      category: "ET",
      size: "S",
      bp: 5000,
      sp: "1/5",
      powerCost: "4+",
      features: ["メカ", "人型"],
      rushCondition: "discard_named_unit",
    });
    expectRarityIn("RK-046", ["N"]);
  });

  const rushBoard = (rush: ReturnType<typeof inst>[]) =>
    rushPhase({ hand: [inst("RK-046", "bm")], rush, power: powerCards(4), command: releasedCat("ET", 1) });

  it("RK-046: 追加条件 — 自軍「オートバジンVM」1体をコマンドゾーンに送ってラッシュできる（出典: atwiki/page-206「自軍「オートバジンVM」1体をコマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(rushBoard([inst("RK-045", "vm")]), "player1", "RK-046:bm", { destination: "command" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-046:bm")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-045:vm")).toBe("command");
  });

  it("RK-046: 追加条件 — 自軍「オートバジンVM」1体を捨札にしてラッシュできる（出典: atwiki/page-206「…か捨札にする」）", () => {
    const r = rushFromHand(rushBoard([inst("RK-045", "vm")]), "player1", "RK-046:bm", { destination: "discard" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-045:vm")).toBe("discard");
  });

  it("RK-046: 追加条件 — 自軍に「オートバジンVM」がなければラッシュできない（ほかのビークルでは満たせない）（出典: atwiki/page-206）", () => {
    expect(rushOffered(rushBoard([inst("RK-058", "z")]), "RK-046:bm")).toBe(false);
  });

  it("RK-046: ※ ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-206「※これはラッシュしたターンにバトルエリアに出られない」）", () => {
    const r = rushFromHand(rushBoard([inst("RK-045", "vm")]), "player1", "RK-046:bm", { destination: "discard" });
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    for (let i = 0; i < 5 && s.phase !== "battle"; i++) s = act(s, { type: "end_phase", playerId: "player1" });
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RK-046:bm")).toBe(false);
  });

  it("RK-046: ※ ラッシュしたターンでなければバトルエリアに出られる（出典: atwiki/page-206）", () => {
    expect(canEnter(board({ rush: [inst("RK-046", "bm")] }), "RK-046:bm")).toBe(true);
  });

  it("RK-046: 【バスターホイール】自軍バトルエリアにある間、敵軍バトルエリアの S ユニットは BP-500（M ユニット・敵軍ラッシュエリア・自軍のユニットは変わらない）（出典: atwiki/page-206「敵軍バトルエリアのすべてのSユニットはBP-500される」）", () => {
    const s = board(
      { battle: [inst("TST-UNIT-0", "own"), inst("RK-046", "bm")] },
      { battle: [inst("SPEC-E3000", "a"), inst("SPEC-EM5000", "m")], rush: [inst("SPEC-E3000", "r")] },
    );
    expect(bpOf(s, "player2", "SPEC-E3000:a")).toBe(2500);
    expect(bpOf(s, "player2", "SPEC-EM5000:m")).toBe(5000);
    expect(bpOf(s, "player2", "SPEC-E3000:r")).toBe(3000);
    expect(bpOf(s, "player1", "TST-UNIT-0:own")).toBe(1000);
  });

  it("RK-046: 【バスターホイール】ラッシュエリアにあるときは効かない（出典: atwiki/page-206「これが自軍バトルエリアにある間」）", () => {
    expect(bpOf(board({ rush: [inst("RK-046", "bm")] }, { battle: [inst("SPEC-E3000", "a")] }), "player2", "SPEC-E3000:a")).toBe(3000);
  });

  it("RK-046: 【バスターホイール】敵軍ターン中も自軍バトルエリアにある間は効く（出典: atwiki/page-206「これが自軍バトルエリアにある間」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("RK-046", "bm")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E3000", "a")], deck: deckCards(3, "e") } }, EXTRA);
    expect(bpOf(s, "player2", "SPEC-E3000:a")).toBe(2500);
  });

  // 公式 Q4「はい、できます。」（BP の下三桁が 500 になった敵軍 S ユニットを、デカマスター【ディーソードベガ】で撃破できる）
  it("RK-046: 公式Q&A — 下三桁が 500 になった敵軍 S ユニットを、デカマスター（RS-319）【ディーソードベガ】で撃破できる（出典: grnrngr/faq-rider-1 RK-046 Q4・atwiki/page-206 Q4）", () => {
    let s = board({ battle: [inst("RK-046", "bm")], rush: [inst("RS-319", "dm")] }, { battle: [inst("SPEC-E3000", "a"), inst("SPEC-EM5000", "m")] });
    s = resolveAll(enter(s, "RS-319:dm"));
    expect(zoneOf(s, "player2", "SPEC-E3000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-EM5000:m")).toBe("battle");
  });

  // 公式FAQ の RK-046 欄と RK-005 欄が食い違っていた（RK-046 欄「はい」、RK-005 欄「いいえ…状況が成立しない」）。
  // ユーザー決定（2026-10-19）で「いいえ」（grnrngr/faq-rider-1 RK-005 欄）を採る（docs/rules/README.md §5.7 k）。
  it("RK-046: 公式Q&A — 自軍に RK-001 改造人間が常駐していても、オートバジンBM は超電子ダイナモ（RK-005）で選べないので、【バスターホイール】の撃破でダメージを与える状況にならない（出典: grnrngr/faq-rider-1 RK-005 欄「いいえ、できません。「RK-046 オートバジンBM（バトルモード）」は、「RK-005 超電子ダイナモ」の効果を得るために必要な特徴「改造人間」を持っておらず、なおかつ「RK-001 改造人間」の効果を得るための特徴「男」も特徴「女」も持たないため、ご質問にあるような状況が成立しないからです」・ユーザー決定 2026-10-19「いいえ」）", () => {
    let s = rushPhase({
      operation: [inst("RK-001", "kz")],
      hand: [inst("RK-005", "dy")],
      rush: [inst("RK-046", "bm"), inst("SPEC-MALE-K", "m")],
      command: releasedCat("ET", 2),
      power: powerCards(3),
    });
    s = { ...s, definitions: { ...s.definitions, [MALE_K.id]: MALE_K } };
    const r = playOp(s, "player1", "RK-005:dy");
    expect(r.ok, r.error).toBe(true);
    s = r.state;
    expectChoiceFrom(s, "player1", "RK-005");
    // RK-001 で「改造人間」が追加されるのは「男」「女」のユニットだけ。オートバジンBM は候補にならない。
    expect(choiceIds(s)).toEqual(["SPEC-MALE-K:m"]);
  });

  // 公式 Q3「はい、できます。」
  it("RK-046: 公式Q&A（相互参照）— 下三桁が 500 になった敵軍 S ユニットを RK-064 仮面ライダーファイズ【ファイズエッジ】で撃破できる（出典: grnrngr/faq-rider-1 RK-046 Q3）", () => {
    let s = enter(board({ battle: [inst("RK-046", "bm")], rush: [inst("RK-064", "fz")] }, { battle: [inst("SPEC-E3000", "b")] }), "RK-064:fz");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:b"]);
    s = resolveAll(pick(s, "SPEC-E3000:b"));
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-047 仮面ライダー轟鬼", () => {
  const TEXT =
    "【音撃斬・雷電激震】敵軍バトルエリアからユニットを1体選ぶ。そして、選んだユニットの必要パワーの数字より1つ多い数だけ自軍コマンドをホールドしてもよい。そうしたとき、選んだユニットを撃破する。このとき、これはアタックすることができない。";

  it("RK-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-219）", () => {
    expectCatalogText("RK-047", TEXT);
    expectStats("RK-047", { name: "仮面ライダー轟鬼", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: 1, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-047", ["N"]);
  });

  /** CN1 の轟鬼をバトルエリアの1番目に出す（NC の選択は残す）。 */
  const todoroki = (commands: ReturnType<typeof inst>[], enemy: ReturnType<typeof inst>[] = [inst("SPEC-COST2", "e"), inst("TST-UNIT-0", "e0")]) =>
    ncEnter("RK-047:t", 0, { command: commands }, { battle: enemy }, EXTRA);

  it("RK-047: NC — 敵軍バトルエリアからユニットを1体選ぶ（出典: atwiki/page-219「敵軍バトルエリアからユニットを1体選ぶ」）", () => {
    const s = todoroki(releasedN(4, "TST-OP-MA"));
    expectChoiceFrom(s, "player1", "RK-047");
    expect(choiceIds(s)).toEqual(["SPEC-COST2:e", "TST-UNIT-0:e0"]);
  });

  it("RK-047: 選んだユニットの必要パワー＋1（必要パワー2なら3つ）の自軍コマンドをホールドすると撃破し、轟鬼はアタックできない（出典: atwiki/page-219）", () => {
    let s = pick(todoroki(releasedN(4, "TST-OP-MA")), "SPEC-COST2:e");
    expectChoiceFrom(s, "player1", "RK-047");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:rc0", "TST-OP-MA:rc1", "TST-OP-MA:rc2", "TST-OP-MA:rc3"]);
    s = pick(pick(pick(s, "TST-OP-MA:rc0"), "TST-OP-MA:rc1"), "TST-OP-MA:rc2");
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-COST2:e")).toBe("discard");
    expect(heldCount(s)).toBe(3);
    expect(cardIn(s, "player1", "TST-OP-MA:rc3")?.commandHeld ?? false).toBe(false);
    expect(attackTargets(s, "RK-047:t")).toEqual([]);
  });

  it("RK-047: 「ホールドしてもよい」— ホールドしなければ撃破せず、轟鬼はアタックできる（出典: atwiki/page-219「してもよい。そうしたとき」）", () => {
    let s = pick(todoroki(releasedN(4, "TST-OP-MA")), "SPEC-COST2:e");
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(zoneOf(s, "player2", "SPEC-COST2:e")).toBe("battle");
    expect(heldCount(s)).toBe(0);
    expect(attackTargets(s, "RK-047:t").length).toBeGreaterThan(0);
  });

  it("RK-047: ホールドできるリリース状態の自軍コマンドが足りなければ撃破しない（出典: atwiki/page-219）", () => {
    const s = settle(pick(todoroki(releasedN(2, "TST-OP-MA")), "SPEC-COST2:e"));
    expect(zoneOf(s, "player2", "SPEC-COST2:e")).toBe("battle");
    expect(heldCount(s)).toBe(0);
  });

  it("RK-047: NC が成立しなければ（2番目以降に出したとき）発動しない（出典: atwiki/page-219「CN：1」・R-CN-01）", () => {
    const s = ncEnter("RK-047:t", 1, { command: releasedN(4, "TST-OP-MA") }, { battle: [inst("SPEC-COST2", "e")] }, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-047");
  });
});

// ===========================================================================
describe("RK-048 仮面ライダー斬鬼", () => {
  const TEXT =
    "【音撃斬・雷電斬震】敵軍バトルエリアからユニットを1体選ぶ。そして、選んだユニットの必要パワーの数字より1つ多い数だけ自軍コマンドをリリースしてもよい。そうしたとき、選んだユニットを撃破する。このとき、これはアタックすることができない。";

  it("RK-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-220）", () => {
    expectCatalogText("RK-048", TEXT);
    expectStats("RK-048", { name: "仮面ライダー斬鬼", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 3, comboNumber: 2, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-048", ["N"]);
  });

  it("RK-048: 必要パワー2のユニットを選んだら、3つリリースして撃破する（出典: atwiki/page-220「選んだユニットの必要パワーの数字より1つ多い数だけ」）", () => {
    let s = ncEnter("RK-048:z", 1, { command: [...releasedN(0), ...["h0", "h1", "h2", "h3"].map((x) => ({ ...inst("TST-OP", x), commandHeld: true }))] }, { battle: [inst("SPEC-COST2", "e")] }, EXTRA);
    s = pick(s, "SPEC-COST2:e");
    expect(choiceIds(s)).toEqual(["TST-OP:h0", "TST-OP:h1", "TST-OP:h2", "TST-OP:h3"]);
    s = settle(pick(pick(pick(s, "TST-OP:h0"), "TST-OP:h1"), "TST-OP:h2"));
    expect(zoneOf(s, "player2", "SPEC-COST2:e")).toBe("discard");
    expect(heldCount(s)).toBe(1);
  });

  it("RK-048: 「リリースしてもよい」— リリースしなければ撃破せず、斬鬼はアタックできる（出典: atwiki/page-220「してもよい。そうしたとき」）", () => {
    let s = ncEnter("RK-048:z", 1, { command: [{ ...inst("TST-OP", "h0"), commandHeld: true }] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA);
    s = settle(skip(pick(s, "TST-UNIT-0:e")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(attackTargets(s, "RK-048:z").length).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe("RK-049 仮面ライダー勝鬼", () => {
  const TEXT = "【風牙】「SP1」相手は自分自身のラッシュエリアからユニットを1体選ぶ。このターン、このユニットは、相手の選んだユニットにアタックできる。";

  it("RK-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-221）", () => {
    expectCatalogText("RK-049", TEXT);
    expectStats("RK-049", { name: "仮面ライダー勝鬼", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 3, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-049", ["N"]);
  });

  /** CN3 の勝鬼をバトルエリアの3番目に出す（NC の選択は残す）。 */
  const shoki = (p2: Partial<GameState["players"]["player2"]> = { rush: [inst("SPEC-E2000", "r1"), inst("SPEC-E3000", "r2")], battle: [inst("TST-UNIT-0", "b")] }) =>
    ncEnter("RK-049:s", 2, {}, p2, EXTRA);

  it("RK-049: NC —「SP1」になり、相手が自分自身のラッシュエリアからユニットを1体選ぶ（出典: atwiki/page-221「「SP1」相手は自分自身のラッシュエリアからユニットを1体選ぶ」）", () => {
    const s = shoki();
    expectChoiceFrom(s, "player2", "RK-049");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:r1", "SPEC-E3000:r2"]);
    expect(canSkip(s)).toBe(false);
    expect(spOf(settle(pick(s, "SPEC-E2000:r1")), "player1", "RK-049:s")).toBe(1);
  });

  it("RK-049: このターン、相手の選んだラッシュエリアのユニットにアタックでき、ほかのラッシュエリアのユニットにはアタックできない（出典: atwiki/page-221「このターン、このユニットは、相手の選んだユニットにアタックできる」）", () => {
    const s = settle(pick(shoki(), "SPEC-E2000:r1"));
    const targets = attackTargets(s, "RK-049:s");
    expect(targets).toContain("SPEC-E2000:r1");
    expect(targets).toContain("TST-UNIT-0:b");
    expect(targets).not.toContain("SPEC-E3000:r2");
  });

  it("RK-049: 選ばれたラッシュエリアのユニットとバトルして撃破できる（出典: atwiki/page-221）", () => {
    let s = settle(pick(shoki(), "SPEC-E2000:r1"));
    s = resolveAll(attack(s, "RK-049:s", "SPEC-E2000:r1"));
    expect(zoneOf(s, "player2", "SPEC-E2000:r1")).toBe("discard");
  });

  it("RK-049: 能力の発動後にストライクしてもよい（出典: atwiki/page-221 カード評価「能力発動後、ストライクすることも可能」）", () => {
    const s = settle(pick(shoki(), "SPEC-E3000:r2"));
    expect(canStrike(s, "RK-049:s")).toBe(true);
  });

  it("RK-049: 敵軍ラッシュエリアにユニットがなくても「SP1」にはなる（出典: atwiki/page-221）", () => {
    const s = settle(shoki({ battle: [inst("TST-UNIT-0", "b")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-049");
    expect(spOf(s, "player1", "RK-049:s")).toBe(1);
  });

  it("RK-049: NC が成立しなければ（3番目以外）「SP！」のままストライクできない（出典: atwiki/page-221「CN：3」・R-CN-01）", () => {
    const s = settle(ncEnter("RK-049:s", 0, {}, { rush: [inst("SPEC-E2000", "r1")] }, EXTRA));
    expect(canStrike(s, "RK-049:s")).toBe(false);
  });

  // 公式 Q（RK-057 欄）「はい、選ぶことができます。」（相手が自分自身のユニットを選ぶので「相手に選ばれない」は妨げない）
  it("RK-049: 公式Q&A — 相手は自分自身のラッシュエリアの仮面ライダーザビーRF（「相手に選ばれない」）を選べる（出典: grnrngr/faq-rider-1 RK-057 Q・atwiki/page-161 Q1）", () => {
    const s = shoki({ rush: [inst("RK-057", "zb")] });
    expectChoiceFrom(s, "player2", "RK-049");
    expect(choiceIds(s)).toEqual(["RK-057:zb"]);
    const t = settle(pick(s, "RK-057:zb"));
    expect(attackTargets(t, "RK-049:s")).toContain("RK-057:zb");
  });
});

// lastBattleBps・fill・mount 等は他のファイルで使う。未使用の import を避けるための参照。
void lastBattleBps;
void fill;
