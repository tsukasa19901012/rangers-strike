/**
 * カード別スペック: RK-050〜RK-056（ザ・マスクドライダーEXP vol.1 仮面ライダー裁鬼〜仮面ライダーザビーMF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-050〜RK-054 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-01、R-BTL-01、R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマル」を SR／N として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-051 Q2（鋭鬼で撃破したときはサンジェル【プロミネンスシャワー】のダメージなし）— cardSpec/RS6-390-410.c.test.ts RS-408
 *  - RK-053 Q4（デスガロン下でもガタックMF は BP5000 として扱う）— cardSpec/RS4-222-242.a.test.ts RS-226
 *  - RK-054 Q3（イエローレーサーのストライクで、相手のオモテ向きのパワーがガタックRF だけなら相手が選ぶ）— cardSpec/RS3-123-150.c.test.ts RS-149
 *  - RK-056 の【ZECT隊長】の DSL キーワード対応 — dsl/featureKeywords.test.ts
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  activateField,
  attack,
  attackersOf,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  declareRush,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  fill,
  inst,
  lastBattleBps,
  mount,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  rcUnit,
  releasedCat,
  resolveAll,
  rideOff,
  ridingPair,
  rushFromHand,
  rushOffered,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneIds,
  zoneOf,
} from "./RK3-043-063.helpers";

const BIG = sUnit("SPEC-BIG", { bp: 9000, powerCost: 2, comboNumber: 1 });
const BIG3 = sUnit("SPEC-BIG3", { bp: 9000, powerCost: 3, comboNumber: 3 });
const BIG_NONUM = sUnit("SPEC-BIG-NONUM", { bp: 9000, powerCost: 2 });
const BIG_RC = rcUnit("SPEC-BIG-RC", { bp: 9000, powerCost: 2 });
const E1000 = sUnit("SPEC-E1000", { bp: 1000 });
const E1500 = sUnit("SPEC-E1500", { bp: 1500 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const EM4000 = sUnit("SPEC-EM4000", { bp: 4000, size: "M" });
const EM5000 = sUnit("SPEC-EM5000", { bp: 5000, size: "M" });
const MECA = sUnit("SPEC-MECA", { bp: 1000, features: ["メカ"] });
const RC3000 = rcUnit("SPEC-RC3000", { bp: 3000 });
const KAMEN = sUnit("SPEC-KAMEN", { category: "OT", bp: 2000, features: ["仮面ライダー", "男"] });
const DENO = sUnit("SPEC-DENO", { category: "OT", bp: 3000, powerCost: 0, features: ["仮面ライダー", "DEN-O"] });
const DENO2 = sUnit("SPEC-DENO2", { category: "OT", bp: 4000, powerCost: 0, features: ["仮面ライダー", "DEN-O"] });
const GRUNT = sUnit("SPEC-GRUNT", { category: "OT", bp: 500, sp: undefined, features: ["戦闘員"] });
const NOSP = sUnit("SPEC-NOSP-MALE", { category: "OT", bp: 500, sp: undefined, features: ["男"] });
const EXTRA = [BIG, BIG3, BIG_NONUM, BIG_RC, E1000, E1500, E2000, E3000, E3500, E4000, EM4000, EM5000, MECA, RC3000, KAMEN, DENO, DENO2, GRUNT, NOSP];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 敵軍（player2）ラッシュフェイズの盤面。 */
const enemyRushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-050 仮面ライダー裁鬼", () => {
  const TEXT =
    "【音撃斬・閻魔裁き】「SP1」これがアタックするとき、「BP」「必要パワーの数字」「ナンバーの数字」のうちどれか1つを選び、お互いにその数字でバトルする。ただし、ナンバーの数字は相手のユニットがナンバーに数字を持っていなければ選べない。";

  it("RK-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-222）", () => {
    expectCatalogText("RK-050", TEXT);
    expectStats("RK-050", { name: "仮面ライダー裁鬼", category: "MA", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 3, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-050", ["N"]);
  });

  /** CN3 の裁鬼を3番目に出し、NC を成立させてから defender にアタックする（数字の選択は残す）。 */
  const sabaki = (defender: string) => {
    const [id, suf] = defender.split(":") as [string, string];
    let s = settle(ncEnter("RK-050:sb", 2, {}, { battle: [inst(id, suf)] }, EXTRA));
    s = settle(attack(s, "RK-050:sb", defender));
    return s;
  };

  it("RK-050: NC —「SP1」になる（出典: atwiki/page-222「「SP1」」）", () => {
    const s = settle(ncEnter("RK-050:sb", 2, {}, { battle: [inst("SPEC-BIG", "e")] }, EXTRA));
    expect(spOf(s, "player1", "RK-050:sb")).toBe(1);
  });

  it("RK-050: アタックするとき、「BP」「必要パワーの数字」「ナンバーの数字」から1つ選ぶ（出典: atwiki/page-222「…のうちどれか1つを選び」）", () => {
    const s = sabaki("SPEC-BIG:e");
    expectChoiceFrom(s, "player1", "RK-050");
    expect(choiceIds(s)).toEqual(["bp", "number", "power_cost"]);
  });

  it("RK-050: 「必要パワーの数字」を選ぶと、お互いに必要パワーの数字でバトルする（3対2で勝ち、相手を撃破）（出典: atwiki/page-222「お互いにその数字でバトルする」）", () => {
    const s = resolveAll(pick(sabaki("SPEC-BIG:e"), "power_cost"));
    expect(zoneOf(s, "player2", "SPEC-BIG:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-050:sb")).toBe("battle");
  });

  it("RK-050: 「ナンバーの数字」を選ぶと、お互いにナンバーの数字でバトルする（3対1で勝ち）（出典: atwiki/page-222）", () => {
    const s = resolveAll(pick(sabaki("SPEC-BIG:e"), "number"));
    expect(zoneOf(s, "player2", "SPEC-BIG:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-050:sb")).toBe("battle");
  });

  it("RK-050: 選んだ数字が同じなら、通常のバトルと同じく両方撃破される（3対3）（出典: atwiki/page-222・R-BTL-01「同じなら両方」）", () => {
    const s = resolveAll(pick(sabaki("SPEC-BIG3:e"), "number"));
    expect(zoneOf(s, "player2", "SPEC-BIG3:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-050:sb")).toBe("discard");
  });

  it("RK-050: 「BP」を選ぶと通常どおり BP でバトルする（2000対9000で負ける）（出典: atwiki/page-222）", () => {
    const s = resolveAll(pick(sabaki("SPEC-BIG:e"), "bp"));
    expect(zoneOf(s, "player2", "SPEC-BIG:e")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-050:sb")).toBe("discard");
  });

  it("RK-050: 相手のユニットがナンバーに数字を持っていなければ（ナンバーなし・RC）「ナンバーの数字」は選べない（出典: atwiki/page-222「ただし、ナンバーの数字は相手のユニットがナンバーに数字を持っていなければ選べない」）", () => {
    expect(choiceIds(sabaki("SPEC-BIG-NONUM:e"))).toEqual(["bp", "power_cost"]);
    expect(choiceIds(sabaki("SPEC-BIG-RC:e"))).toEqual(["bp", "power_cost"]);
  });

  it("RK-050: NC が成立していなければ（3番目以外）数字の選択はなく、BP でバトルする（出典: atwiki/page-222「CN：3」・R-CN-01）", () => {
    let s = settle(ncEnter("RK-050:sb", 0, {}, { battle: [inst("SPEC-BIG", "e")] }, EXTRA));
    s = settle(attack(s, "RK-050:sb", "SPEC-BIG:e"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-050");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RK-050:sb")).toBe("discard");
  });

  // 公式 Q1「いいえ、それはできません。「RK-050 仮面ライダー裁鬼」はBP2000以上であるため、「RK-026 がんがんじい」にアタックすることができません。」
  it("RK-050: 公式Q&A — BP2000 以上なので、がんがんじい（BP2000以上の敵軍Sユニットにアタックされない）にはアタックできない（出典: grnrngr/faq-rider-1 RK-050 Q1・atwiki/page-222 Q1）", () => {
    const s = settle(ncEnter("RK-050:sb", 2, {}, { battle: [inst("RK-026", "gg")] }, EXTRA));
    expect(attackTargets(s, "RK-050:sb")).not.toContain("RK-026:gg");
  });
});

// ===========================================================================
describe("RK-051 仮面ライダー鋭鬼", () => {
  const TEXT =
    "【音撃打・必殺必中】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれた敵軍ユニットを1体選び撃破する。";

  it("RK-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-223）", () => {
    expectCatalogText("RK-051", TEXT);
    expectStats("RK-051", { name: "仮面ライダー鋭鬼", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 1, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-051", ["N"]);
  });

  const eiki = (p2: Partial<GameState["players"]["player2"]>) => enter(board({ rush: [inst("RK-051", "ek")] }, p2), "RK-051:ek");

  it("RK-051: 出たとき、敵軍バトルエリアの「…バトルに勝っても撃破される」と書かれたユニットだけを選べ、選んだユニットを撃破する（出典: atwiki/page-223）", () => {
    let s = eiki({ battle: [inst("RS-102", "sg"), inst("TST-UNIT-0", "n")] });
    expectChoiceFrom(s, "player1", "RK-051");
    expect(choiceIds(s)).toEqual(["RS-102:sg"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "RS-102:sg"));
    expect(zoneOf(s, "player2", "RS-102:sg")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:n")).toBe("battle");
  });

  it("RK-051: そう書かれた敵軍ユニットがいなければ何もしない（出典: atwiki/page-223）", () => {
    const s = settle(eiki({ battle: [inst("TST-UNIT-0", "n")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-051");
    expect(zoneOf(s, "player2", "TST-UNIT-0:n")).toBe("battle");
  });

  it("RK-051: 敵軍ラッシュエリアのユニットは選べない（出典: atwiki/page-223「敵軍バトルエリアから」）", () => {
    const s = settle(eiki({ rush: [inst("RS-102", "sg")], battle: [inst("TST-UNIT-0", "n")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-051");
    expect(zoneOf(s, "player2", "RS-102:sg")).toBe("rush");
  });

  // 公式 Q1「はい、可能です。」（敵軍バトルエリアの「RK-051 仮面ライダー鋭鬼」や「RS-408 天空聖者サンジェル」を撃破できる）
  it("RK-051: 公式Q&A — 文中にその文言を含む敵軍の鋭鬼・天空聖者サンジェルも選んで撃破できる（出典: grnrngr/faq-rider-1 RK-051 Q1・atwiki/page-223 Q1）", () => {
    let s = eiki({ battle: [inst("RK-051", "e"), inst("RS-408", "sj"), inst("TST-UNIT-0", "n")] });
    expect(choiceIds(s)).toEqual(["RK-051:e", "RS-408:sj"]);
    s = resolveAll(pick(s, "RS-408:sj"));
    expect(zoneOf(s, "player2", "RS-408:sj")).toBe("discard");
  });

  it("RK-051: 自軍エリアに RK-224 京介変身体があれば、敵軍バトルエリアの S ユニット（その文が書かれているかのように扱う）も選べる（ユーザー決定 2026-10-19 の RM-008 と同じ扱い。docs/rules/README.md §5.7 o。出典: atwiki/page-223・atwiki/page-900）", () => {
    const s = enter(board({ rush: [inst("RK-051", "ek"), inst("RK-224", "ky")] }, { battle: [inst("TST-UNIT-0", "n")] }), "RK-051:ek");
    expectChoiceFrom(s, "player1", "RK-051");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:n"]);
  });
});

// ===========================================================================
describe("RK-052 仮面ライダー弾鬼", () => {
  const TEXT = "【音撃打・破砕細石】敵軍バトルエリアに特徴「メカ」を持つユニットがなければ、これはBP4000以上のSユニットとバトルするとき、BP+5000される";

  it("RK-052: カタログ本文・スペックが出典と一致（フレーバーテキストを含まない）（出典: atwiki/page-224）", () => {
    expectCatalogText("RK-052", TEXT);
    expectStats("RK-052", { name: "仮面ライダー弾鬼", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 0, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-052", ["N"]);
  });

  it("RK-052: BP4000 以上の S ユニットとバトルするとき BP+5000（5500対4000で勝つ）（出典: atwiki/page-224）", () => {
    let s = board({ battle: [inst("RK-052", "d")] }, { battle: [inst("SPEC-E4000", "a")] });
    s = resolveAll(attack(s, "RK-052:d", "SPEC-E4000:a"));
    expect(lastBattleBps(s)?.attacker).toBe(5500);
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-052:d")).toBe("battle");
  });

  it("RK-052: BP4000 未満の S ユニットとのバトルでは BP+5000 されない（出典: atwiki/page-224「BP4000以上のSユニット」）", () => {
    let s = board({ battle: [inst("RK-052", "d")] }, { battle: [inst("SPEC-E3500", "a")] });
    s = resolveAll(attack(s, "RK-052:d", "SPEC-E3500:a"));
    expect(zoneOf(s, "player1", "RK-052:d")).toBe("discard");
  });

  it("RK-052: M ユニットとのバトルでは BP+5000 されない（出典: atwiki/page-224「Sユニット」）", () => {
    let s = board({ battle: [inst("RK-052", "d")] }, { battle: [inst("SPEC-EM5000", "m")] });
    s = resolveAll(attack(s, "RK-052:d", "SPEC-EM5000:m"));
    expect(zoneOf(s, "player1", "RK-052:d")).toBe("discard");
  });

  it("RK-052: 敵軍バトルエリアに特徴「メカ」を持つユニットがあれば BP+5000 されない（出典: atwiki/page-224「敵軍バトルエリアに特徴「メカ」を持つユニットがなければ」）", () => {
    let s = board({ battle: [inst("RK-052", "d")] }, { battle: [inst("SPEC-MECA", "mc"), inst("SPEC-E4000", "a")] });
    s = resolveAll(attack(s, "RK-052:d", "SPEC-E4000:a"));
    expect(zoneOf(s, "player1", "RK-052:d")).toBe("discard");
  });

  it("RK-052: 敵軍ターン中に BP4000 以上の S ユニットにアタックされたときも BP+5000（アタックした側が撃破される）（出典: atwiki/page-224「バトルするとき」）", () => {
    let s = enemyTurn({ battle: [inst("RK-052", "d")] }, { battle: [inst("SPEC-E4000", "a")] });
    s = resolveAll(attack(s, "SPEC-E4000:a", "RK-052:d", "player2"));
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-052:d")).toBe("battle");
  });

  // 公式 Q1「はい、発動します。」（本来の BP は 4000 未満でも、ライドして BP4000 以上になっている敵軍 S ユニット）
  it("RK-052: 公式Q&A — 本来の BP は 4000 未満でも、ライドして BP4000 以上になっている敵軍 S ユニットとのバトルで発動する（ビークルの特徴「メカ」は数えない）（出典: grnrngr/faq-rider-1 RK-052 Q1・atwiki/page-224 Q1）", () => {
    let s = board({ battle: [inst("RK-052", "d")] }, { battle: ridingPair("SPEC-RC3000", "r", "RK-045", "v") });
    expect(bpOf(s, "player2", "SPEC-RC3000:r")).toBe(4000);
    s = resolveAll(attack(s, "RK-052:d", "SPEC-RC3000:r"));
    expect(zoneOf(s, "player2", "SPEC-RC3000:r")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-052:d")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-053 仮面ライダーガタックMF", () => {
  const TEXT =
    "※これはアタックされるときBP+3000される。 【ガタックバルカン】これが自軍バトルエリアにある間、敵軍Sユニットがラッシュされたとき、自軍パワーゾーンのダメージ以外のカードを1枚選び捨札にしてもよい。そうしたとき、そのユニットは、ターンが終わるまでバトルエリアに出られない。";

  it("RK-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-170）", () => {
    expectCatalogText("RK-053", TEXT);
    expectStats("RK-053", { name: "仮面ライダーガタックMF", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 2, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-053", ["N"]);
  });

  it("RK-053: ※ アタックされるとき BP+3000（BP5000 で BP4000 のアタックを返り討ち）（出典: atwiki/page-170）", () => {
    let s = enemyTurn({ battle: [inst("RK-053", "g")] }, { battle: [inst("SPEC-E4000", "a")] });
    s = resolveAll(attack(s, "SPEC-E4000:a", "RK-053:g", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(5000);
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-053:g")).toBe("battle");
  });

  // 公式 Q3「いいえ、重複しません。アタックされて発生したそのバトルを終えた時点で、BPが「＋」される効果は失われます。」
  it("RK-053: 公式Q&A — BP+3000 はそのバトルを終えた時点で失われる（出典: grnrngr/faq-rider-1 RK-053 Q3・atwiki/page-170 Q3）", () => {
    let s = enemyTurn({ battle: [inst("RK-053", "g")] }, { battle: [inst("SPEC-E1000", "a")] });
    s = resolveAll(attack(s, "SPEC-E1000:a", "RK-053:g", "player2"));
    expect(bpOf(s, "player1", "RK-053:g")).toBe(2000);
  });

  it("RK-053: ※ 自分からアタックするときは BP+3000 されない（出典: atwiki/page-170「アタックされるとき」）", () => {
    let s = board({ battle: [inst("RK-053", "g")] }, { battle: [inst("SPEC-E1500", "a")] });
    s = resolveAll(attack(s, "RK-053:g", "SPEC-E1500:a"));
    expect(lastBattleBps(s)?.attacker).toBe(2000);
  });

  /** 敵軍（player2）ラッシュフェイズに、player2 が手札の rushed をラッシュする（ガタックバルカンの選択は残す）。 */
  const vulcan = (p1: Partial<GameState["players"]["player1"]>, rushed = "SPEC-E2000:x", p2: Partial<GameState["players"]["player2"]> = {}) => {
    const [id, suf] = rushed.split(":") as [string, string];
    const s = enemyRushPhase({ battle: [inst("RK-053", "g")], power: [...powerCards(2), ...damageCards(1)], ...p1 }, { hand: [inst(id, suf)], command: releasedCat("WB", 2), power: powerCards(6, "ep"), ...p2 });
    const r = declareRush(s, "player2", rushed);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-053: 【ガタックバルカン】敵軍 S ユニットがラッシュされたとき、自軍パワーゾーンのダメージ以外のカードを1枚選び捨札にしてもよい（出典: atwiki/page-170）", () => {
    const s = vulcan({});
    expectChoiceFrom(s, "player1", "RK-053");
    expect(choiceIds(s)).toEqual(["TST-P:pw0", "TST-P:pw1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-053: 捨札にしたら、そのユニットはターンが終わるまでバトルエリアに出られない（出典: atwiki/page-170「そのユニットは、ターンが終わるまでバトルエリアに出られない」）", () => {
    let s = resolveAll(pick(vulcan({}), "TST-P:pw0"));
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:x")).toBe("rush");
    s = toPhase(s, "player2", "battle");
    expect(canEnter(s, "SPEC-E2000:x", "player2")).toBe(false);
  });

  it("RK-053: 捨札にしなければ、そのユニットはバトルエリアに出られる（出典: atwiki/page-170「捨札にしてもよい。そうしたとき」）", () => {
    let s = resolveAll(skip(vulcan({})));
    expect(zoneIds(s, "player1", "power")).toHaveLength(3);
    s = toPhase(s, "player2", "battle");
    expect(canEnter(s, "SPEC-E2000:x", "player2")).toBe(true);
  });

  it("RK-053: 自軍パワーゾーンにダメージ以外のカードがなければ発動できない（出典: atwiki/page-170「自軍パワーゾーンのダメージ以外のカード」）", () => {
    const s = vulcan({ power: damageCards(2) });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-053");
  });

  it("RK-053: ラッシュされたのが M ユニットなら発動しない（出典: atwiki/page-170「敵軍Sユニットがラッシュされたとき」）", () => {
    const s = vulcan({}, "SPEC-EM4000:m");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-053");
  });

  it("RK-053: ガタックMF がラッシュエリアにあるときは発動しない（出典: atwiki/page-170「これが自軍バトルエリアにある間」）", () => {
    const s = vulcan({ battle: [], rush: [inst("RK-053", "g")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-053");
  });

  // 公式 Q1「いいえ、バトルエリアに置かれます。…この時点で「RS-090 レッドレーサー」はすでにバトルエリアに置かれていることになります。」
  it("RK-053: 公式Q&A — 「可能ならバトルエリアに置く」レッドレーサーのラッシュに発動しても、レッドレーサーはバトルエリアに置かれたまま（出典: grnrngr/faq-rider-1 RK-053 Q1・atwiki/page-170 Q1）", () => {
    let s = vulcan({}, "RS-090:rr", { command: releasedCat("OT", 2) });
    expectChoiceFrom(s, "player1", "RK-053");
    s = resolveAll(pick(s, "TST-P:pw0"));
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-090:rr")).toBe("battle");
  });

  // 公式 Q2「いいえ、持続しません。「ガタックバルカン」の効果を受けたユニットと、その後「RK-022 ライダーパス」で置き換わったユニットは別のユニットですので…」
  it("RK-053: 公式Q&A — ガタックバルカンを受けたユニットをライダーパスで置き換えると、置き換わったユニットはバトルエリアに出られる（出典: grnrngr/faq-rider-1 RK-053 Q2・atwiki/page-170 Q2）", () => {
    let s = vulcan({}, "SPEC-DENO:d", { command: releasedCat("OT", 2), operation: [{ ...inst("RK-022", "pass"), stackedCards: [inst("SPEC-DENO2", "s")] }] });
    s = resolveAll(pick(s, "TST-P:pw0"));
    s = act(s, { type: "activate_resident_operation", playerId: "player2", operationInstanceId: "RK-022:pass" });
    s = pick(pick(s, "SPEC-DENO2:s"), "SPEC-DENO:d");
    expect(zoneOf(s, "player2", "SPEC-DENO2:s")).toBe("rush");
    // 置き換えで出たユニットは新しくラッシュされたユニット（R-REPL-04）なので、ガタックバルカンをもう一度使える。ここでは使わない。
    if (s.pendingEffectChoice?.sourceCardId === "RK-053") s = skip(s);
    s = toPhase(s, "player2", "battle");
    expect(canEnter(s, "SPEC-DENO2:s", "player2")).toBe(true);
  });
});

// ===========================================================================
describe("RK-054 仮面ライダーガタックRF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ライダーカッティング 】これをラッシュしたとき、敵軍バトルエリアから、BPの合計が6000になるように隣り合う2体のSユニットを選び撃破する。";

  it("RK-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-171）", () => {
    expectCatalogText("RK-054", TEXT);
    expectStats("RK-054", {
      name: "仮面ライダーガタックRF",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "1/4",
      powerCost: "4+",
      features: ["仮面ライダー", "男", "加速"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-054", ["SR"]);
  });

  /** 自軍ラッシュフェイズに手札のガタックRF をラッシュする（追加条件の素材は rush の先頭）。 */
  const rushRf = (rush: ReturnType<typeof inst>[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushFromHand(
      st({ phase: "rush", player1: { hand: [inst("RK-054", "rf")], rush, power: powerCards(4), command: releasedCat("OT", 1), deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA),
      "player1",
      "RK-054:rf",
    );
  const rushBoard = (rush: ReturnType<typeof inst>[]) =>
    st({ phase: "rush", player1: { hand: [inst("RK-054", "rf")], rush, power: powerCards(4), command: releasedCat("OT", 1), deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, EXTRA);

  it("RK-054: 追加条件 — 自軍「仮面ライダーガタックMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-171「自軍「仮面ライダーガタックMF」1体をパワーゾーンに送る」）", () => {
    const r = rushRf([inst("RK-053", "mf")]);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-054:rf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-053:mf")).toBe("power");
  });

  it("RK-054: 追加条件 — ガタックMF 以外の S ユニットでは満たせない（出典: atwiki/page-171）", () => {
    expect(rushOffered(rushBoard([inst("SPEC-KAMEN", "k")]), "RK-054:rf")).toBe(false);
  });

  it("RK-054: 【ライダーカッティング】ラッシュしたとき、敵軍バトルエリアから BP の合計が 6000 になる隣り合う2体の S ユニットを選んで撃破する（出典: atwiki/page-171）", () => {
    const r = rushRf([inst("RK-053", "mf")], { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E4000", "b"), inst("SPEC-E3000", "c")] });
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    expectChoiceFrom(s, "player1", "RK-054");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a", "SPEC-E4000:b"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "SPEC-E2000:a");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:b"]);
    s = resolveAll(pick(s, "SPEC-E4000:b"));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E4000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3000:c")).toBe("battle");
  });

  it("RK-054: 【ライダーカッティング】隣り合っていなければ、合計 6000 でも選べない（出典: atwiki/page-171「隣り合う2体」）", () => {
    const r = rushRf([inst("RK-053", "mf")], { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E1000", "x"), inst("SPEC-E4000", "b")] });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RK-054");
    expect(zoneOf(settle(r.state), "player2", "SPEC-E2000:a")).toBe("battle");
  });

  it("RK-054: 【ライダーカッティング】M ユニットは選べない（出典: atwiki/page-171「2体のSユニット」）", () => {
    const r = rushRf([inst("RK-053", "mf")], { battle: [inst("SPEC-E2000", "a"), inst("SPEC-EM4000", "m")] });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RK-054");
  });

  it("RK-054: ※ 相手が選ぶ効果では選ばれない（敵軍ギンガイオー【ガルコンボーガン】の候補に入らない）（出典: atwiki/page-171「※これはアタックされる以外では相手に選ばれない」）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RK-054", "rf"), inst("TST-UNIT-0", "u")], deck: deckCards(3) },
        player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-687:gg" });
    if (s.pendingEffectChoice?.sourceCardId === "RS-687") expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RK-054:rf")).toBe("rush");
  });

  it("RK-054: ※ アタックはされる（出典: atwiki/page-171「アタックされる以外では」）", () => {
    const s = enemyTurn({ battle: [inst("RK-054", "rf")] }, { battle: [inst("SPEC-E3000", "a")] });
    expect(attackersOf(s, "RK-054:rf")).toEqual(["SPEC-E3000:a"]);
  });

  // 公式 Q「はい、対象になります。条件を満たしているものが自動的に対象になるような効果…の場合は、プレイヤーが対象を「選ぶ」ということを行わないので…」
  it("RK-054: 公式Q&A — 選ばずにすべてを対象にする効果（敵軍オートバジンBM【バスターホイール】）は受ける（出典: grnrngr/faq-rider-1 RK-054 Q・atwiki/page-171 Q1）", () => {
    const s = board({ battle: [inst("RK-046", "bm")] }, { battle: [inst("RK-054", "rf")] });
    expect(bpOf(s, "player2", "RK-054:rf")).toBe(1500);
  });

  // 公式の回答どうしが食い違っていた（grnrngr/faq-rider-1 RK-054 Q「パワーゾーンやコマンドゾーンにあるカードは…有効ではない」と、
  // atwiki/page-171 Q2・grnrngr/faq-card-3 RS-149 Q1「オモテ向きのゾーン・捨札では常に有効」）。ユーザー決定（2026-10-19）で後者を採る（README §5.7 j）。
  it("RK-054: 公式Q&A — 敵軍パワーゾーンにオモテ向きで置かれていても「相手に選ばれない」は有効（敵軍 RK-061 ドレイクRF の RC【一本釣り】で選べない）（出典: atwiki/page-171 Q2・grnrngr/faq-card-3 RS-149 Q1・ユーザー決定 2026-10-19「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」）", () => {
    const fishing = rideOff(
      mount(board({ rush: [inst("RK-061", "rf"), inst("RK-058", "v")] }, { power: [inst("RK-054", "gt"), inst("SPEC-E2000", "p")] }), "RK-061:rf", "RK-058:v"),
      true,
    );
    expectChoiceFrom(fishing, "player1", "RK-061");
    expect(choiceIds(fishing)).toEqual(["SPEC-E2000:p"]);
  });

});

// ===========================================================================
describe("RK-055 仮面ライダーパンチホッパー", () => {
  const TEXT = "【ライダーパンチ】敵軍バトルエリアからSユニットを好きな数選び、ラッシュエリアに戻してもよい。";

  it("RK-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-172）", () => {
    expectCatalogText("RK-055", TEXT);
    expectStats("RK-055", { name: "仮面ライダーパンチホッパー", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 2, comboNumber: 1, features: ["仮面ライダー", "男", "加速"] });
    expectRarityIn("RK-055", ["N"]);
  });

  const punch = (enemy: ReturnType<typeof inst>[]) => ncEnter("RK-055:ph", 0, {}, { battle: enemy }, EXTRA);

  it("RK-055: NC — 敵軍バトルエリアの S ユニットを好きな数選び、ラッシュエリアに戻す（M ユニットは選べない）（出典: atwiki/page-172）", () => {
    let s = punch([inst("SPEC-E2000", "a"), inst("SPEC-E3000", "b"), inst("SPEC-EM4000", "m"), inst("SPEC-E4000", "c")]);
    expectChoiceFrom(s, "player1", "RK-055");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a", "SPEC-E3000:b", "SPEC-E4000:c"]);
    s = resolveAll(confirm(pick(pick(s, "SPEC-E2000:a"), "SPEC-E4000:c")));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E4000:c")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-EM4000:m")).toBe("battle");
  });

  it("RK-055: 選べる S ユニットをすべて戻してもよい（出典: atwiki/page-172「好きな数」）", () => {
    let s = punch([inst("SPEC-E2000", "a"), inst("SPEC-E3000", "b")]);
    s = resolveAll(confirm(pick(pick(s, "SPEC-E2000:a"), "SPEC-E3000:b")));
    expect(s.players.player2.battle).toHaveLength(0);
  });

  it("RK-055: 戻さなくてもよい（出典: atwiki/page-172「戻してもよい」）", () => {
    const s = resolveAll(skip(punch([inst("SPEC-E2000", "a")])));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
  });

  it("RK-055: 「相手に選ばれない」敵軍ユニット（仮面ライダーザビーRF）は選べない（出典: atwiki/page-172・atwiki/page-161「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = punch([inst("SPEC-E2000", "a"), inst("RK-057", "zb")]);
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a"]);
  });

  it("RK-055: NC が成立しなければ（2番目以降）発動しない（出典: atwiki/page-172「CN：1」・R-CN-01）", () => {
    const s = ncEnter("RK-055:ph", 1, {}, { battle: [inst("SPEC-E2000", "a")] }, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-055");
  });
});

// ===========================================================================
describe("RK-056 仮面ライダーザビーMF", () => {
  const TEXT =
    "※これはアタックされるときBP+5000される。 【ZECT隊長】これが自軍バトルエリアにある間、自軍ターン中、特徴「戦闘員」を持つ自軍ユニットは、バトルエリアで4番目に並んだとき「SP1」になる。";

  it("RK-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-160）", () => {
    expectCatalogText("RK-056", TEXT);
    expectStats("RK-056", { name: "仮面ライダーザビーMF", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 1, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-056", ["N"]);
  });

  it("RK-056: ※ アタックされるとき BP+5000（BP6000 で BP4000 のアタックを返り討ち）（出典: atwiki/page-160）", () => {
    let s = enemyTurn({ battle: [inst("RK-056", "z")] }, { battle: [inst("SPEC-E4000", "a")] });
    s = resolveAll(attack(s, "SPEC-E4000:a", "RK-056:z", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(6000);
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("discard");
  });

  it("RK-056: 【ZECT隊長】特徴「戦闘員」を持つ自軍ユニットがバトルエリアで4番目に並んだとき「SP1」になる（出典: atwiki/page-160）", () => {
    const s = settle(enter(board({ battle: [inst("RK-056", "z"), ...fill(2)], rush: [inst("RK-059", "zt")] }), "RK-059:zt"));
    expect(spOf(s, "player1", "RK-059:zt")).toBe(1);
  });

  it("RK-056: 【ZECT隊長】「戦闘員」を持たないユニットは4番目でも「SP1」にならない（出典: atwiki/page-160「特徴「戦闘員」を持つ自軍ユニットは」）", () => {
    const s = settle(enter(board({ battle: [inst("RK-056", "z"), ...fill(2)], rush: [inst("SPEC-NOSP-MALE", "n")] }), "SPEC-NOSP-MALE:n"));
    expect(spOf(s, "player1", "SPEC-NOSP-MALE:n")).toBe(0);
  });

  it("RK-056: 【ZECT隊長】4番目以外（3番目）では「SP1」にならない（出典: atwiki/page-160「バトルエリアで4番目に並んだとき」）", () => {
    const s = settle(enter(board({ battle: [inst("RK-056", "z"), ...fill(1)], rush: [inst("RK-059", "zt")] }), "RK-059:zt"));
    expect(spOf(s, "player1", "RK-059:zt")).toBe(0);
  });

  it("RK-056: 【ZECT隊長】ザビーMF がラッシュエリアにあるときは効かない（出典: atwiki/page-160「これが自軍バトルエリアにある間」）", () => {
    const s = settle(enter(board({ battle: fill(3), rush: [inst("RK-056", "z"), inst("SPEC-GRUNT", "g")] }), "SPEC-GRUNT:g"));
    expect(spOf(s, "player1", "SPEC-GRUNT:g")).toBe(0);
  });
});

// 未使用の import を避けるための参照。
void activateField;
void cardIn;
