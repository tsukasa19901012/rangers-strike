/**
 * カード別スペック: RK-064〜RK-070（ザ・マスクドライダーEXP vol.1 仮面ライダーファイズ〜仮面ライダーカブトMF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-065 の Q&A、RK-046・RK-053・RK-054・RK-057 欄の
 *     RK-064・RK-065・RK-070 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-04/05、R-TIME-01、R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア」を SR／R として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-064 がライドしないで（ナンバーの数字で）出ても RC・NC は発動しない — rulesSpec/05-combination-counter.test.ts
 *  - RK-065 をマンドラ坊やの効果で選べない — rulesSpec/06-effects-timing.test.ts
 *  - RK-065 を RK-061【一本釣り】で選べない（パワーゾーンにオモテ向き）— 公式どうしの食い違いで保留（cardSpec/RK3-043-063.c.test.ts RK-061）
 *  - RK-066 の「敵軍バトルエリアにユニットがあるときストライクできない」の単体確認 — rsCoreEffects.unnamedRules.test.ts
 *  - RK-067 が「ダークウイング」のウイングを持たない — keywords/battleKeywords.test.ts
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackTargets,
  attackersOf,
  bpOf,
  canSkip,
  canUseCard,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  fill,
  heldCount,
  inst,
  lastBattleBps,
  legal,
  mount,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  rcUnit,
  releasedCat,
  resolveAll,
  rideOff,
  rideOffOffered,
  rushFromHand,
  rushOffered,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  useCard,
  zoneOf,
} from "./RK4-064-084.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const E2500 = sUnit("SPEC-E2500", { bp: 2500, powerCost: 2 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, powerCost: 3 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, powerCost: 3 });
const E4500 = sUnit("SPEC-E4500", { bp: 4500, powerCost: 4 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, powerCost: 5 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000, powerCost: 4 });
const EM3500 = sUnit("SPEC-EM3500", { bp: 3500, size: "M", powerCost: 3 });
const MALE = sUnit("SPEC-MALE", { bp: 2000, features: ["男"] });
const MALE4500 = rcUnit("SPEC-MALE4500", { bp: 4500, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { bp: 2000, features: ["女"] });
const FEMALE_M = sUnit("SPEC-FEMALE-M", { bp: 2000, size: "M", features: ["女"] });
const RC4500 = rcUnit("SPEC-RC4500", { bp: 4500 });
/** 特徴「ミラーモンスター」の S ユニット（ベノスネーカーの【毒液】のような効果を持たない相手役）。 */
const MM = sUnit("SPEC-MM", { bp: 1000, features: ["ミラーモンスター", "獣"] });
const COST1 = sUnit("SPEC-COST1", { bp: 1000, powerCost: 1 });
const COST3 = sUnit("SPEC-COST3", { bp: 1000, powerCost: 3 });
const COST4 = sUnit("SPEC-COST4", { bp: 1000, powerCost: 4 });
const COST5 = sUnit("SPEC-COST5", { bp: 1000, powerCost: 5 });
const COST3_M = sUnit("SPEC-COST3-M", { bp: 1000, powerCost: 3, size: "M" });
const OT_OP = { id: "SPEC-OP-OT", name: "SPEC-OP-OT", type: "operation", category: "OT", rarity: "N", expansion: "card-spec", powerCost: 0 } as const;
const EXTRA = [MM, E4000, E2000, E2500, E3000, E3500, E4500, E5000, EM3500, MALE, MALE4500, FEMALE, FEMALE_M, RC4500, COST1, COST3, COST4, COST5, COST3_M, PLAIN_VEHICLE];
void OT_OP;

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-064 仮面ライダーファイズ", () => {
  const TEXT =
    "【ファイズエッジ】敵軍バトルエリアから、BPの下三桁が500の敵軍Sユニットを1体選び撃破する。（この効果は「オートバジンBM」からコンビネーションするときはナンバーに関係なく発動する）";

  it("RK-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-207）", () => {
    expectCatalogText("RK-064", TEXT);
    expectStats("RK-064", { name: "仮面ライダーファイズ", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-064", ["SR"]);
  });

  /** ファイズをビークルにライドさせて出し、ライドオフする（RC の選択は残す）。 */
  const edge = (p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ rush: [inst("RK-064", "fz"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-064:fz", "SPEC-VEHICLE:v");

  it("RK-064: RC — 敵軍バトルエリアの、BP の下三桁が 500 の S ユニットだけを選べる（M ユニット・ラッシュエリアは選べない。選ばないことはできない）（出典: atwiki/page-207）", () => {
    const s = edge({ battle: [inst("SPEC-E2500", "a"), inst("SPEC-E3000", "b"), inst("SPEC-EM3500", "m")], rush: [inst("SPEC-E3500", "r")] });
    expectChoiceFrom(s, "player1", "RK-064");
    expect(choiceIds(s)).toEqual(["SPEC-E2500:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-064: RC — 選んだユニットを撃破する（出典: atwiki/page-207「1体選び撃破する」）", () => {
    const s = resolveAll(pick(edge({ battle: [inst("SPEC-E2500", "a"), inst("SPEC-E4500", "b")] }), "SPEC-E4500:b"));
    expect(zoneOf(s, "player2", "SPEC-E4500:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2500:a")).toBe("battle");
  });

  it("RK-064: RC — 下三桁が 500 のユニットがいなければ何もしない（出典: atwiki/page-207）", () => {
    const s = edge({ battle: [inst("SPEC-E3000", "b")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-064");
    expect(zoneOf(settle(s), "player2", "SPEC-E3000:b")).toBe("battle");
  });

  // 公式 Q（RK-046 欄）「はい、できます。」— バスターホイールで BP3000 → 2500 になった敵軍 S ユニットを撃破できる。
  it("RK-064: 「オートバジンBM」からコンビネーションするときは、ライドオフしなくても（ナンバーに関係なく）発動し、BM【バスターホイール】で下三桁が 500 になった敵軍 S ユニットを選べる（出典: atwiki/page-207「「オートバジンBM」からコンビネーションするときはナンバーに関係なく発動する」・grnrngr/faq-rider-1 RK-046 Q3）", () => {
    let s = enter(board({ battle: [inst("RK-046", "bm")], rush: [inst("RK-064", "fz")] }, { battle: [inst("SPEC-E3000", "b"), inst("SPEC-E2500", "a")] }), "RK-064:fz");
    expectChoiceFrom(s, "player1", "RK-064");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:b"]);
    s = resolveAll(pick(s, "SPEC-E3000:b"));
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2500:a")).toBe("battle");
  });

  it("RK-064: オートバジンBM 以外のユニットの次に出たときは、ライドしなければ発動しない（出典: atwiki/page-207・R-KW-RC-01）", () => {
    const s = enter(board({ battle: [inst("TST-UNIT-0", "x")], rush: [inst("RK-064", "fz")] }, { battle: [inst("SPEC-E2500", "a")] }), "RK-064:fz");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-064");
  });

  it("RK-064: オートバジンBM が直前でなければ（間に別のユニット）発動しない（出典: atwiki/page-207「「オートバジンBM」からコンビネーションするとき」・R-CN-04）", () => {
    const s = enter(board({ battle: [inst("RK-046", "bm"), inst("TST-UNIT-0", "x")], rush: [inst("RK-064", "fz")] }, { battle: [inst("SPEC-E2000", "a")] }), "RK-064:fz");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-064");
  });

  // 公式 Q（RK-046 欄）「はい、できます。」
  it("RK-064: 公式Q&A — ライドオフ（RC）で発動したときも、自軍オートバジンBM【バスターホイール】で下三桁が 500 になった敵軍 S ユニットを撃破できる（出典: grnrngr/faq-rider-1 RK-046 Q3）", () => {
    let s = edge({ battle: [inst("SPEC-E3000", "b"), inst("SPEC-E2500", "a")] }, { battle: [inst("RK-046", "bm"), inst("TST-UNIT-0", "x")] });
    expect(choiceIds(s)).toEqual(["SPEC-E3000:b"]);
    s = resolveAll(pick(s, "SPEC-E3000:b"));
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("discard");
  });

  it("RK-064: オートバジンBM からのコンビネーションで発動したあと、ライドオフしても2回目は発動しない（出典: grnrngr/faq-rider-1 RK-017 Q3「RCやNCを発動した時点で、ライドオフするかしないかを選択できるタイミングは終了」）", () => {
    let s = mount(board({ battle: [inst("RK-046", "bm")], rush: [inst("RK-064", "fz"), inst("SPEC-VEHICLE", "v")] }, { battle: [inst("SPEC-E3000", "b"), inst("SPEC-E4000", "c")] }), "RK-064:fz", "SPEC-VEHICLE:v");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId === "RK-064"; i++) s = settle(pick(s, s.pendingEffectChoice.validInstanceIds[0]!));
    if (rideOffOffered(s)) s = rideOff(s, true);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-064");
    expect(s.players.player2.discard).toHaveLength(1);
  });

  // atwiki/page-207 Q1「はい、できます。「RS-255 巨大化爆弾」と「RK-206 ウルフオルフェノク」の効果の発動タイミングは同じになりますので、ターンプレイヤーがどちらを先に解決するか決めることができます。」
  it("RK-064: 公式Q&A — ウルフオルフェノク（RK-206）が撃破されて捨札になったとき巨大化爆弾を使い、ウルフを重ねてラッシュエリアに出したあと、捨札のファイズもラッシュエリアに出せる（出典: atwiki/page-207 Q1・atwiki/page-37 Q）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RK-206", "wo")], discard: [inst("RK-064", "fz")], hand: [inst("RS-255", "bomb")], command: releasedCat("DA", 1), power: powerCards(4), deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    s = attack(s, "TST-UNIT-7:atk", "RK-206:wo", "player2");
    // 解決の順はターンプレイヤーが決める（Q1）。巨大化爆弾が使えるようになれば使い、ウルフの ※ の選択が開いていればファイズを選ぶ。
    let bombUsed = false;
    for (let i = 0; i < 10; i++) {
      if (!bombUsed && canUseCard(s, "player1", "RS-255:bomb")) {
        s = useCard(s, "player1", "RS-255:bomb");
        bombUsed = true;
        continue;
      }
      if (s.pendingEffectChoice?.validInstanceIds.includes("RK-064:fz")) {
        s = act(s, { type: "resolve_effect_choice", playerId: s.pendingEffectChoice.playerId, instanceId: "RK-064:fz" });
        continue;
      }
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || (a.type === "pass_leave_reaction" && !canUseCard(s, "player1", "RS-255:bomb")));
      if (!p) break;
      s = act(s, p);
    }
    expect(bombUsed).toBe(true);
    s = resolveAll(s, ["RK-064:fz"]);
    expect(zoneOf(s, "player1", "RK-206:wo")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-064:fz")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-065 仮面ライダーカブトRF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ライダーキック】自軍ターン中、これがバトルエリアに出たとき、OTの自軍コマンドを3つホールドしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("RK-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-163）", () => {
    expectCatalogText("RK-065", TEXT);
    expectStats("RK-065", {
      name: "仮面ライダーカブトRF",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "1/4",
      powerCost: "3+",
      features: ["仮面ライダー", "男", "加速"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-065", ["SR"]);
  });

  const rushRf = (rush: ReturnType<typeof inst>[]) =>
    rushFromHand(rushPhase({ hand: [inst("RK-065", "rf")], rush, power: powerCards(3), command: releasedCat("OT", 1) }), "player1", "RK-065:rf");

  it("RK-065: 追加条件 — 自軍「仮面ライダーカブトMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-163「自軍「仮面ライダーカブトMF」1体をパワーゾーンに送る」）", () => {
    const r = rushRf([inst("RK-070", "mf")]);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-065:rf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-070:mf")).toBe("power");
  });

  it("RK-065: 追加条件 — カブトMF 以外の S ユニットでは満たせない（出典: atwiki/page-163）", () => {
    const s = rushPhase({ hand: [inst("RK-065", "rf")], rush: [inst("SPEC-MALE", "k")], power: powerCards(3), command: releasedCat("OT", 1) });
    expect(rushOffered(s, "RK-065:rf")).toBe(false);
  });

  /** 自軍バトルフェイズにカブトRF をバトルエリアに出す（ライダーキックの確認は残す）。 */
  const kick = (command: ReturnType<typeof inst>[]) => enter(board({ rush: [inst("RK-065", "rf")], command }), "RK-065:rf");
  /** ライダーキックで OT のコマンドを3つホールドする（effect_hold の支払い）。 */
  const holdThree = (s: GameState) => {
    let n = s;
    const pay = legal(n).find((a) => a.type === "initiate_command_payment" && a.kind === "effect_hold" && a.playerId === "player1");
    if (pay) n = act(n, pay);
    return settle(n);
  };

  it("RK-065: 【ライダーキック】自軍ターン中に出たとき、OT の自軍コマンドを3つホールドすると、このターン「SP1」になる（出典: atwiki/page-163）", () => {
    let s = kick(releasedCat("OT", 3));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-065");
    s = holdThree(s);
    expect(heldCount(s)).toBe(3);
    expect(spOf(s, "player1", "RK-065:rf")).toBe(1);
  });

  it("RK-065: 【ライダーキック】ホールドしなくてもよい（そのときは SP1/4 のまま）（出典: atwiki/page-163「ホールドしてもよい」）", () => {
    let s = kick(releasedCat("OT", 3));
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(heldCount(s)).toBe(0);
    // 1番目に出たので分数 SP「1/4」は 0。
    expect(spOf(s, "player1", "RK-065:rf")).toBe(0);
  });

  it("RK-065: 【ライダーキック】OT 以外のコマンドは数えない（OT 2つ＋WB 2つでは発動しない）（出典: atwiki/page-163「OTの自軍コマンドを3つ」）", () => {
    const s = kick([...releasedCat("OT", 2), ...releasedCat("WB", 2)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-065");
  });

  it("RK-065: ※ 相手が選ぶ効果では選ばれない（敵軍ギンガイオー【ガルコンボーガン】の候補に入らない）（出典: atwiki/page-163「※これはアタックされる以外では相手に選ばれない」）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RK-065", "rf"), inst("TST-UNIT-0", "u")], deck: deckCards(3) },
        player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-687:gg" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-687");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RK-065:rf")).toBe("rush");
  });

  it("RK-065: ※ アタックはされる（出典: atwiki/page-163「アタックされる以外では」）", () => {
    const s = enemyTurn({ battle: [inst("RK-065", "rf")] }, { battle: [inst("SPEC-E3000", "a")] });
    expect(attackersOf(s, "RK-065:rf")).toEqual(["SPEC-E3000:a"]);
  });

  // 公式 Q2「はい、対象になります。…プレイヤーが対象を「選ぶ」ということを行わないので、「選ばれない」と書かれていても対象になります。」
  it("RK-065: 公式Q&A — 選ばずにすべてを対象にする効果（敵軍オートバジンBM【バスターホイール】）は受ける（出典: grnrngr/faq-rider-1 RK-065 Q2・atwiki/page-163 Q2）", () => {
    expect(bpOf(board({ battle: [inst("RK-046", "bm")] }, { battle: [inst("RK-065", "rf")] }), "player2", "RK-065:rf")).toBe(1500);
  });

  // 公式 Q1「選ぶことはできませんが、バトルエリアに出すことはできます。」
  it("RK-065: 公式Q&A — グリーンレーサー【ピットインダイブ】（相手のラッシュエリアのすべての S ユニットをバトルエリアに出す）ではバトルエリアに出る（出典: grnrngr/faq-rider-1 RK-065 Q1・atwiki/page-163 Q1）", () => {
    let s = st(
      {
        player1: { battle: fill(3), rush: [inst("RS-049", "gr")], deck: deckCards(5) },
        player2: { rush: [inst("RK-065", "rf"), inst("TST-UNIT-0", "u")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = enter(s, "RS-049:gr");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-049");
    expect(choiceIds(s)).toEqual(["RK-065:rf", "TST-UNIT-0:u"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "RK-065:rf")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:u")).toBe("battle");
  });

  it.todo(
    "RK-065: 公式Q&A — パワーゾーンにオモテ向きのときも RK-061【一本釣り】で選ばれない（出典: atwiki/page-163 Q3（公式回答の転載）・grnrngr/faq-card-3 RS-149 Q1 と、grnrngr/faq-rider-1 RK-054・RK-057 欄「パワーゾーンやコマンドゾーンにあるカードは…有効ではない」）— 公式の回答どうしが食い違い、ユーザーの判断待ち（エンジンは現状「選ばれない」のまま）",
  );
});

// ===========================================================================
describe("RK-066 仮面ライダー電王SF", () => {
  const TEXT =
    "※敵軍バトルエリアにユニットがあるとき、これはストライクできない。 【俺の必殺技！】これがストライクして相手がパワーゾーンのカードをウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選び撃破する。";

  it("RK-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-169）", () => {
    expectCatalogText("RK-066", TEXT);
    expectStats("RK-066", { name: "仮面ライダー電王SF", category: "OT", size: "S", bp: 3000, sp: 1, powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-066", ["SR"]);
  });

  it("RK-066: ※ 敵軍バトルエリアにユニットがあるとストライクできず、なければストライクできる（出典: atwiki/page-169）", () => {
    expect(canStrike(enter(board({ rush: [inst("RK-066", "sf")] }, { battle: [inst("SPEC-E2000", "a")] }), "RK-066:sf"), "RK-066:sf")).toBe(false);
    expect(canStrike(enter(board({ rush: [inst("RK-066", "sf")] }), "RK-066:sf"), "RK-066:sf")).toBe(true);
  });

  /** 電王SF をライドオフ（RC）して出し、ストライクして、相手が flip のカードをウラ返す。 */
  const swung = (flip: string, p2: Partial<GameState["players"]["player2"]>, ride = true) => {
    let s = board({ rush: [inst("RK-066", "sf"), inst("SPEC-VEHICLE", "v")] }, p2);
    s = ride ? settle(rcRideOff(s, "RK-066:sf", "SPEC-VEHICLE:v")) : enter(s, "RK-066:sf");
    s = strike(s, "RK-066:sf");
    return act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: flip });
  };
  const enemyField = {
    rush: [inst("SPEC-COST3", "c3"), inst("SPEC-COST3-M", "c3m"), inst("SPEC-COST1", "c1")],
    power: [inst("TST-OP", "pw3"), inst("SPEC-COST5", "pw5")],
  };

  it("RK-066: 【俺の必殺技！】（RC）ストライクして相手がウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選ぶ（ラッシュエリア・M ユニットも対象。選ばないことはできない）（出典: atwiki/page-169）", () => {
    const s = swung("TST-OP:pw3", enemyField);
    expectChoiceFrom(s, "player1", "RK-066");
    expect(choiceIds(s)).toEqual(["SPEC-COST3-M:c3m", "SPEC-COST3:c3"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-066: 【俺の必殺技！】選んだユニットを撃破し、カードはウラ返る（出典: atwiki/page-169「1体選び撃破する」）", () => {
    const s = resolveAll(pick(swung("TST-OP:pw3", enemyField), "SPEC-COST3:c3"));
    expect(zoneOf(s, "player2", "SPEC-COST3:c3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-COST3-M:c3m")).toBe("rush");
    expect(cardIn(s, "player2", "TST-OP:pw3")?.faceDown).toBe(true);
  });

  it("RK-066: 【俺の必殺技！】必要パワーの数字が同じ敵軍ユニットがいなければ何もしない（出典: atwiki/page-169）", () => {
    const s = settle(swung("SPEC-COST5:pw5", enemyField));
    expect(s.players.player2.rush).toHaveLength(3);
    expect(cardIn(s, "player2", "SPEC-COST5:pw5")?.faceDown).toBe(true);
  });

  it("RK-066: 【俺の必殺技！】は RC の効果 — ライドしないで出てストライクしたときは発動しない（出典: atwiki/page-169「CN：ＲＣ」・R-KW-RC-01）", () => {
    const s = swung("TST-OP:pw3", enemyField, false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-066");
  });
});

// ===========================================================================
describe("RK-067 仮面ライダーナイト", () => {
  const TEXT =
    "※これは自軍捨札に特徴「女」を持つユニットカードがなければ、特徴「男」または「女」を持つユニットにアタックすることができない。 【飛翔斬】「ダークウイング」からコンビネーションしたとき発動できる⇒これは敵軍ユニットのBPをカードに表記された本来の値としてバトルする";

  it("RK-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-188）", () => {
    expectCatalogText("RK-067", TEXT);
    expectStats("RK-067", { name: "仮面ライダーナイト", category: "WB", size: "S", bp: 5000, sp: "1/2", powerCost: 5, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-067", ["R"]);
  });

  const knightBoard = (discard: ReturnType<typeof inst>[]) =>
    board({ battle: [inst("RK-067", "kn")], discard }, { battle: [inst("SPEC-MALE", "m"), inst("SPEC-FEMALE", "f"), inst("SPEC-E2000", "x")] });

  it("RK-067: ※ 自軍捨札に「女」のユニットカードがなければ、「男」「女」のユニットにアタックできない（それ以外にはできる）（出典: atwiki/page-188）", () => {
    expect(attackTargets(knightBoard([]), "RK-067:kn")).toEqual(["SPEC-E2000:x"]);
  });

  it("RK-067: ※ 自軍捨札に「女」のユニットカードがあれば（M ユニットのカードでもよい）アタックできる（出典: atwiki/page-188「特徴「女」を持つユニットカード」）", () => {
    expect(attackTargets(knightBoard([inst("SPEC-FEMALE-M", "d")]), "RK-067:kn").sort()).toEqual(["SPEC-E2000:x", "SPEC-FEMALE:f", "SPEC-MALE:m"]);
  });

  it("RK-067: ※ 敵軍の捨札の「女」は数えない（出典: atwiki/page-188「自軍捨札に」）", () => {
    const s = board({ battle: [inst("RK-067", "kn")] }, { battle: [inst("SPEC-MALE", "m")], discard: [inst("SPEC-FEMALE", "d")] });
    expect(attackTargets(s, "RK-067:kn")).toEqual([]);
  });

  /** ダークウイングの次にナイトを出す（飛翔斬の確認は残す）。敵軍はビークルにライドした BP4500（＋500）の S ユニット。 */
  const slash = () =>
    enter(
      board({ battle: [inst("RK-035", "dw")], rush: [inst("RK-067", "kn")] }, { battle: [inst("RK-058", "v"), { ...inst("SPEC-RC4500", "e"), mountedOnInstanceId: "RK-058:v" }] }),
      "RK-067:kn",
    );

  it("RK-067: 【飛翔斬】「ダークウイング」からコンビネーションしたとき、発動するかを選べる（出典: atwiki/page-188「発動できる」）", () => {
    const s = slash();
    expectChoiceFrom(s, "player1", "RK-067");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-067: 【飛翔斬】発動すると、敵軍ユニットの BP を本来の値（4500）としてバトルする（5000対4500で勝つ）（出典: atwiki/page-188「これは敵軍ユニットのBPをカードに表記された本来の値としてバトルする」）", () => {
    let s = settle(confirm(slash()));
    expect(bpOf(s, "player2", "SPEC-RC4500:e")).toBe(5000);
    s = resolveAll(attack(s, "RK-067:kn", "SPEC-RC4500:e"));
    expect(lastBattleBps(s)).toEqual({ attacker: 5000, defender: 4500 });
    expect(zoneOf(s, "player2", "SPEC-RC4500:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-067:kn")).toBe("battle");
  });

  it("RK-067: 【飛翔斬】発動しなければ、今の BP（5000）でバトルし両方撃破される（出典: atwiki/page-188「発動できる」・R-BTL-01）", () => {
    let s = settle(skip(slash()));
    s = resolveAll(attack(s, "RK-067:kn", "SPEC-RC4500:e"));
    expect(lastBattleBps(s)).toEqual({ attacker: 5000, defender: 5000 });
    expect(zoneOf(s, "player1", "RK-067:kn")).toBe("discard");
  });

  it("RK-067: 【飛翔斬】ダークウイング以外のユニットの次に出たときは発動しない（出典: atwiki/page-188「「ダークウイング」からコンビネーションしたとき」）", () => {
    const s = enter(board({ battle: [inst("TST-UNIT-0", "x")], rush: [inst("RK-067", "kn")] }), "RK-067:kn");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-067");
  });
});

// ===========================================================================
describe("RK-068 仮面ライダー王蛇", () => {
  const TEXT =
    "※敵軍バトルエリアにユニットがあるとき、これはストライクできない。 【ベノクラッシュ】「ベノスネーカー」からコンビネーションしたとき発動できる⇒敵軍コマンドゾーンから、ユニットカードを1枚選び捨札にしてもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のカードしか選べない。";

  it("RK-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-189）", () => {
    expectCatalogText("RK-068", TEXT);
    expectStats("RK-068", { name: "仮面ライダー王蛇", category: "WB", size: "S", bp: 3000, sp: 1, powerCost: 6, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-068", ["R"]);
  });

  it("RK-068: ※ 敵軍バトルエリアにユニットがあるとストライクできず、なければストライクできる（出典: atwiki/page-189）", () => {
    expect(canStrike(enter(board({ rush: [inst("RK-068", "oj")] }, { battle: [inst("SPEC-E2000", "a")] }), "RK-068:oj"), "RK-068:oj")).toBe(false);
    expect(canStrike(enter(board({ rush: [inst("RK-068", "oj")] }), "RK-068:oj"), "RK-068:oj")).toBe(true);
  });

  /** ベノスネーカーの次に王蛇を出す。敵軍のダメージは3点。 */
  const crash = (command: ReturnType<typeof inst>[], partner = "RK-040") =>
    enter(
      board({ battle: [inst(partner, "vs")], rush: [inst("RK-068", "oj")] }, { command, damage: 3, power: damageCards(3, "ed") }),
      "RK-068:oj",
    );
  const enemyCommand = () => [
    { ...inst("SPEC-COST3", "c3"), commandHeld: true },
    inst("SPEC-COST1", "c1"),
    inst("SPEC-COST4", "c4"),
    inst("TST-OP", "op"),
  ];

  it("RK-068: 【ベノクラッシュ】「ベノスネーカー」からコンビネーションしたとき、敵軍コマンドゾーンの、必要パワーの数字が敵軍ダメージ（3点）以下のユニットカードを選べる（ホールド状態も可。任意）（出典: atwiki/page-189）", () => {
    const s = crash(enemyCommand());
    expectChoiceFrom(s, "player1", "RK-068");
    expect(choiceIds(s)).toEqual(["SPEC-COST1:c1", "SPEC-COST3:c3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-068: 【ベノクラッシュ】選んだカードは捨札になる（出典: atwiki/page-189「1枚選び捨札にしてもよい」）", () => {
    const s = resolveAll(pick(crash(enemyCommand()), "SPEC-COST3:c3"));
    expect(zoneOf(s, "player2", "SPEC-COST3:c3")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(3);
  });

  it("RK-068: 【ベノクラッシュ】ベノスネーカー以外のユニットの次に出たときは発動しない（出典: atwiki/page-189「「ベノスネーカー」からコンビネーションしたとき」）", () => {
    const s = crash(enemyCommand(), "TST-UNIT-0");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-068");
  });
});

// ===========================================================================
describe("RK-069 仮面ライダーファム", () => {
  const TEXT =
    "【ミスティースラッシュ】「ブランウイング」からコンビネーションしたとき発動できる⇒特徴「ミラーモンスター」を持つユニットにアタックしてバトルに勝つたび、追加でアタックできる（ストライクはできない）。";

  it("RK-069: カタログ本文・スペックが出典と一致（出典: atwiki/page-53）", () => {
    expectCatalogText("RK-069", TEXT);
    expectStats("RK-069", { name: "仮面ライダーファム", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 4, features: ["仮面ライダー", "女", "ミラーライダー"] });
    expectRarityIn("RK-069", ["R"]);
  });

  /** ブランウイングの次にファムを出し、敵軍の「ミラーモンスター」の S ユニット（BP1000）にアタックする。 */
  const slashed = (partner = "RK-042", p2Battle = [inst("SPEC-MM", "vs"), inst("SPEC-E2000", "x"), inst("SPEC-MM", "vs2")]) => {
    let s = enter(board({ battle: [inst(partner, "bw")], rush: [inst("RK-069", "fm")] }, { battle: p2Battle }), "RK-069:fm");
    s = settle(s);
    if (s.pendingEffectChoice?.sourceCardId === "RK-069") s = settle(confirm(s));
    return resolveAll(attack(s, "RK-069:fm", "SPEC-MM:vs"));
  };

  it("RK-069: 【ミスティースラッシュ】「ブランウイング」からコンビネーションしたとき、ミラーモンスターにアタックして勝てば、追加でアタックできる（出典: atwiki/page-53）", () => {
    const s = slashed();
    expect(zoneOf(s, "player2", "SPEC-MM:vs")).toBe("discard");
    expect(attackTargets(s, "RK-069:fm").sort()).toEqual(["SPEC-E2000:x", "SPEC-MM:vs2"]);
  });

  it("RK-069: 【ミスティースラッシュ】追加のアタックのとき、ストライクはできない（出典: atwiki/page-53「（ストライクはできない）」）", () => {
    const s = slashed("RK-042", [inst("SPEC-MM", "vs")]);
    expect(canStrike(s, "RK-069:fm")).toBe(false);
  });

  it("RK-069: 【ミスティースラッシュ】勝つ「たび」— 追加のアタックでもう一度ミラーモンスターに勝てば、さらにアタックできる（出典: atwiki/page-53「バトルに勝つたび」）", () => {
    let s = slashed();
    s = resolveAll(attack(s, "RK-069:fm", "SPEC-MM:vs2"));
    expect(attackTargets(s, "RK-069:fm")).toEqual(["SPEC-E2000:x"]);
  });

  it("RK-069: 【ミスティースラッシュ】ミラーモンスター以外に勝っても追加でアタックできない（出典: atwiki/page-53「特徴「ミラーモンスター」を持つユニットにアタックして」）", () => {
    let s = slashed();
    s = resolveAll(attack(s, "RK-069:fm", "SPEC-E2000:x"));
    expect(attackTargets(s, "RK-069:fm")).toEqual([]);
  });

  it("RK-069: 【ミスティースラッシュ】ブランウイング以外のユニットの次に出たときは、勝っても追加でアタックできない（出典: atwiki/page-53「「ブランウイング」からコンビネーションしたとき」）", () => {
    const s = slashed("TST-UNIT-0");
    expect(attackTargets(s, "RK-069:fm")).toEqual([]);
  });
});

// ===========================================================================
describe("RK-070 仮面ライダーカブトMF", () => {
  const TEXT =
    "※これはアタックされるときBP+4000される。 【アバランチブレイク】敵軍Sユニットの数が自軍Sユニットの数より5体以上多いとき、自軍Sユニットと同じ数になるまで敵軍Sユニットを選び、選んだユニットを持ち主のパワーゾーンに送る";

  it("RK-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-164）", () => {
    expectCatalogText("RK-070", TEXT);
    expectStats("RK-070", { name: "仮面ライダーカブトMF", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-070", ["R"]);
  });

  it("RK-070: ※ アタックされるとき BP+4000（BP5000 で BP4500 のアタックを返り討ち）（出典: atwiki/page-164）", () => {
    let s = enemyTurn({ battle: [inst("RK-070", "mf")] }, { battle: [inst("SPEC-E4500", "a")] });
    s = resolveAll(attack(s, "SPEC-E4500:a", "RK-070:mf", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(5000);
    expect(zoneOf(s, "player2", "SPEC-E4500:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-070:mf")).toBe("battle");
  });

  // 公式 Q（RK-053 欄）「いいえ、重複しません。アタックされて発生したそのバトルを終えた時点で、BPが「＋」される効果は失われます。」
  it("RK-070: 公式Q&A — BP+4000 はアタックされるたびに重複せず、そのバトルを終えた時点で失われる（出典: grnrngr/faq-rider-1 RK-053 Q3）", () => {
    let s = enemyTurn({ battle: [inst("RK-070", "mf")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E2000", "b")] });
    s = resolveAll(attack(s, "SPEC-E2000:a", "RK-070:mf", "player2"));
    expect(bpOf(s, "player1", "RK-070:mf")).toBe(1000);
    s = resolveAll(attack(s, "SPEC-E2000:b", "RK-070:mf", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(5000);
  });

  it("RK-070: ※ 自分からアタックするときは BP+4000 されない（出典: atwiki/page-164「アタックされるとき」）", () => {
    let s = board({ battle: [inst("RK-070", "mf")] }, { battle: [inst("SPEC-E2000", "a")] });
    s = resolveAll(attack(s, "RK-070:mf", "SPEC-E2000:a"));
    expect(lastBattleBps(s)?.attacker).toBe(1000);
  });

  /** カブトMF をライドオフ（RC）して出す。自軍 S はカブトMF を含めて own 体、敵軍 S は enemyS 体（バトル3・残りラッシュ）と M 1体。 */
  const avalanche = (own: number, enemyS: number) => {
    const battle = Array.from({ length: Math.min(enemyS, 3) }, (_, i) => inst("SPEC-E2000", `eb${i}`));
    const rush = [...Array.from({ length: Math.max(enemyS - 3, 0) }, (_, i) => inst("SPEC-E2000", `er${i}`)), inst("SPEC-EM3500", "em")];
    const s = board(
      { rush: [inst("RK-070", "mf"), inst("SPEC-VEHICLE", "v"), ...Array.from({ length: own - 1 }, (_, i) => inst("TST-UNIT-0", `own${i}`))] },
      { battle, rush },
    );
    return rcRideOff(s, "RK-070:mf", "SPEC-VEHICLE:v");
  };
  const countS = (s: GameState, pid: "player1" | "player2") =>
    [...s.players[pid].battle, ...s.players[pid].rush].filter((c) => c.cardId === "SPEC-E2000" || c.cardId === "TST-UNIT-0" || c.cardId === "RK-070").length;

  it("RK-070: 【アバランチブレイク】（RC）敵軍 S が5体以上多い（7対2）とき、自軍 S と同じ2体になるまで敵軍 S を選び、持ち主のパワーゾーンに送る（M は対象外）（出典: atwiki/page-164）", () => {
    let s = avalanche(2, 7);
    expectChoiceFrom(s, "player1", "RK-070");
    expect(choiceIds(s)).not.toContain("SPEC-EM3500:em");
    expect(canSkip(s)).toBe(false);
    s = resolveAll(s);
    expect(countS(s, "player2")).toBe(2);
    expect(s.players.player2.power.filter((c) => c.cardId === "SPEC-E2000")).toHaveLength(5);
    expect(zoneOf(s, "player2", "SPEC-EM3500:em")).toBe("rush");
  });

  it("RK-070: 【アバランチブレイク】差が4体（6対2）では発動しない（出典: atwiki/page-164「5体以上多いとき」）", () => {
    const s = avalanche(2, 6);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-070");
    expect(countS(resolveAll(s), "player2")).toBe(6);
  });

  it("RK-070: 【アバランチブレイク】は RC の効果 — ライドしないで出たときは発動しない（出典: atwiki/page-164「CN：ＲＣ」・R-KW-RC-01）", () => {
    const s = enter(
      board({ rush: [inst("RK-070", "mf")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E2000", "b"), inst("SPEC-E2000", "c")], rush: Array.from({ length: 4 }, (_, i) => inst("SPEC-E2000", `r${i}`)) }),
      "RK-070:mf",
    );
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-070");
  });
});

// 未使用の import を避けるための参照。
void FEMALE;
void MALE4500;
void E5000;
void COST4;
