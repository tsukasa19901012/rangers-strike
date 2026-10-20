/**
 * カード別スペック: XG4-031〜XG4-037（クロスギャザー ザ・ジェットアクセル ロケットブースター〜牛折神）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に XG のカードの項はない
 *     （「XG4-」とカード名で検索。card_8 にあるのは RS-600 ゴーオンシルバーの項だけで、XG4-033 とは本文が違う）。
 *     atwiki に転載された公式 Q&A（XG4-034 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG4-NNN.md。本範囲のライブ写し pages/N.txt はなし）・atwiki/page-1291「タクス」・atwiki/page-1294「モーフ」
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-TAX-01・R-KW-MORPH-01〜03・R-CN-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG4-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  activate,
  attack,
  attackersOf,
  attackTargets,
  canActivate,
  canConfirm,
  canEnter,
  canSkip,
  canStrike,
  canWing,
  cardIn,
  choiceIds,
  choicePlayer,
  confirm,
  damageOf,
  deckCards,
  endTurnKeep,
  enemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOperation,
  expectRarityIn,
  expectUnit,
  faceDown,
  faceUp,
  inst,
  isDamage,
  legal,
  morphTests,
  ncEnter,
  nextPhase,
  opUsed,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  taxTests,
  wingTests,
  zoneOf,
} from "./XG4-022-043.helpers";

/** wingTests（RS9-648-669.helpers.ts）と同じ。XG4-033 の【フリージングダガー】の選択が開いたら見送る。 */
function wingTestsDecliningFreeze(id: string, page: string): void {
  const ENEMY = sUnit("SPEC-WING-ENEMY", { bp: 500, sp: undefined });
  const board = (phase: GameState["phase"] = "battle") =>
    st(
      {
        phase,
        player1: { rush: [inst(id, "w")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-WING-ENEMY", "e")], deck: deckCards(3, "e") },
      },
      [ENEMY],
    );

  it(`${id}: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドし、ラッシュエリアから敵軍ユニットにアタックできる（出典: ${page}、grnrngr/faq-card-9 ウイング A1・R-KW-WING-01）`, () => {
    let s = board();
    expect(canWing(s, `${id}:w`)).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: `${id}:w` });
    expect(cardIn(s, "player1", `${id}:w`)?.commandHeld).toBe(true);
    expect(attackTargets(s, `${id}:w`)).toContain("SPEC-WING-ENEMY:e");
    s = settle(attack(s, `${id}:w`, "SPEC-WING-ENEMY:e"));
    if (s.pendingEffectChoice?.sourceCardId === id) s = settle(skip(s));
    expect(zoneOf(s, "player2", "SPEC-WING-ENEMY:e")).toBe("discard");
    expect(zoneOf(s, "player1", `${id}:w`)).toBe("rush");
  });

  it(`${id}: ※ウイング — 発動したターンはバトルエリアに出られない（出典: grnrngr/faq-card-9 ウイング Q4「いいえ、できません」）`, () => {
    let s = board();
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: `${id}:w` });
    expect(canEnter(s, `${id}:w`)).toBe(false);
  });

  it(`${id}: ※ウイング — 自軍バトルフェイズ以外（ラッシュフェイズ）には発動できない（出典: grnrngr/faq-card-9 ウイング Q3「いいえ、できません」）`, () => {
    expect(canWing(board("rush"), `${id}:w`)).toBe(false);
  });

  it(`${id}: ※ウイング — ラッシュエリア以外（バトルエリア）からは発動できない（出典: grnrngr/faq-card-9 ウイング Q5）`, () => {
    const s = st(
      { player1: { battle: [inst(id, "w")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-WING-ENEMY", "e")] } },
      [ENEMY],
    );
    expect(canWing(s, `${id}:w`)).toBe(false);
  });

  it(`${id}: ※ウイング — ホールドしてもストライクはできない（出典: grnrngr/faq-card-9 ウイング Q6「いいえ、できません」）`, () => {
    const s = act(board(), { type: "hold_for_wing", playerId: "player1", instanceId: `${id}:w` });
    expect(canStrike(s, `${id}:w`)).toBe(false);
  });
}

const OWN_S = sUnit("SPEC-OWN-S", { category: "OT", bp: 2000 });
const OWN_S2 = sUnit("SPEC-OWN-S2", { category: "OT", bp: 2000 });
const E_WEAK = sUnit("SPEC-E-WEAK", { bp: 500, sp: undefined });
const E_DA = sUnit("SPEC-E-DA", { category: "DA", bp: 500, sp: undefined });
const E_DA_M = sUnit("SPEC-E-DA-M", { category: "DA", bp: 1000, size: "M", sp: undefined });
const E_STRONG = sUnit("SPEC-E-STRONG", { bp: 9000, sp: undefined });
const E_STRONG_M = sUnit("SPEC-E-STRONG-M", { bp: 9000, size: "M", sp: undefined });
const OWN_M = sUnit("SPEC-OWN-M", { category: "MA", bp: 3000, size: "M" });
const OWN_L = sUnit("SPEC-OWN-L", { category: "MA", bp: 9000, size: "L", powerCost: "7+" });
const OWN_SS = sUnit("SPEC-OWN-SS", { category: "MA", bp: 1000 });
const E_ATK = sUnit("SPEC-E-ATK", { bp: 20000, sp: 1 });
const MA_FEAT = sUnit("SPEC-MA-FEAT", { category: "MA", bp: 1000, features: ["忍者"] });
const MA_NOFEAT = sUnit("SPEC-MA-NOFEAT", { category: "MA", bp: 1000 });
const ET_FEAT = sUnit("SPEC-ET-FEAT", { category: "ET", bp: 1000, features: ["メカ"] });
const EXTRA = [OWN_S, OWN_S2, E_WEAK, E_DA, E_DA_M, E_STRONG, E_STRONG_M, OWN_M, OWN_L, OWN_SS, E_ATK, MA_FEAT, MA_NOFEAT, ET_FEAT];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const yes = (s: GameState) => (s.pendingEffectChoice && canConfirm(s) && choiceIds(s).length === 0 ? confirm(s) : s);

// ===========================================================================
describe("XG4-031 ロケットブースター", () => {
  const TEXT =
    "カード名を１つ宣言する。このターン、宣言したカード名と同じカード名を持つSユニットとSユニットのカードは次のテキストを得る⇒「ウイング」、「このユニットの持ち主は、自分自身のターンを終えるとき、このユニットがラッシュエリアにあれば手札に戻してもよい。」";

  it("XG4-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-2094）", () => {
    expectCatalogText("XG4-031", TEXT);
    expectOperation("XG4-031", { name: "ロケットブースター", category: "OT", powerCost: 3 });
    expectRarityIn("XG4-031", ["N"]);
  });

  const used = (p1: Partial<GameState["players"]["player1"]> = {}) => opUsed("XG4-031", "OT", 3, { rush: [inst("SPEC-OWN-S", "a"), inst("SPEC-OWN-S2", "b")], ...p1 }, { battle: [inst("SPEC-E-WEAK", "e")] }, EXTRA);
  const declare = (s: GameState, name: string) => resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: name }));

  it("XG4-031: 使うとカード名を1つ宣言する（自軍の S ユニットのカード名を選べる）（出典: atwiki/page-2094「カード名を１つ宣言する」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG4-031");
    expect(choiceIds(s)).toContain("SPEC-OWN-S");
  });

  it("XG4-031: このターン、宣言したカード名の S ユニットは「ウイング」を得る（宣言していないカード名のユニットは得ない）（出典: atwiki/page-2094「宣言したカード名と同じカード名を持つSユニットとSユニットのカードは次のテキストを得る⇒「ウイング」」）", () => {
    const s = nextPhase(declare(used(), "SPEC-OWN-S"));
    expect(s.phase).toBe("battle");
    expect(canWing(s, "SPEC-OWN-S:a")).toBe(true);
    expect(canWing(s, "SPEC-OWN-S2:b")).toBe(false);
  });

  it("XG4-031: 宣言したカード名の手札の S ユニットのカードも得る（このターンにラッシュすればウイングを使える）（出典: atwiki/page-2094「SユニットとSユニットのカード」・カード評価「ユニットカードにもウイングを追加できる」）", () => {
    let s = declare(used({ hand: [inst("SPEC-OWN-S", "h")], command: releasedCat("OT", 1) }), "SPEC-OWN-S");
    const r = rushFromHand(s, "player1", "SPEC-OWN-S:h");
    expect(r.ok, r.error).toBe(true);
    s = nextPhase(resolveAll(r.state));
    expect(canWing(s, "SPEC-OWN-S:h")).toBe(true);
  });

  it("XG4-031: 宣言したカード名のユニットは、持ち主がターンを終えるとき、ラッシュエリアにあれば手札に戻せる（出典: atwiki/page-2094「このユニットの持ち主は、自分自身のターンを終えるとき、このユニットがラッシュエリアにあれば手札に戻してもよい」）", () => {
    let s = endTurnKeep(declare(used(), "SPEC-OWN-S"));
    expectChoiceFrom(s, "player1", "XG4-031");
    s = resolveAll(s.pendingEffectChoice?.validInstanceIds.includes("SPEC-OWN-S:a") ? pick(s, "SPEC-OWN-S:a") : confirm(s));
    expect(zoneOf(s, "player1", "SPEC-OWN-S:a")).toBe("hand");
  });

  it("XG4-031: ウイングを得るのは「このターン」だけ（次の自軍ターンには持たない）（出典: atwiki/page-2094「このターン」）", () => {
    let s = declare(used(), "SPEC-OWN-S");
    s = endTurnKeep(s);
    if (s.pendingEffectChoice?.sourceCardId === "XG4-031") s = skip(s);
    s = resolveAll(s);
    // 敵軍ターンを終えて、次の自軍バトルフェイズへ。
    for (let i = 0; i < 30 && !(s.activePlayer === "player1" && s.phase === "battle"); i++) s = settle(stepAny(s));
    expect(canWing(s, "SPEC-OWN-S:a")).toBe(false);
  });
});

/** フェイズを1歩進める（ドロー・戻し・フェイズ終了）。 */
function stepAny(s: GameState): GameState {
  const order = ["pass_register", "pass_leave_reaction", "pass_rush_reaction", "pass_battle_reaction", "pass_strike_reaction", "return_all_battle_to_rush", "draw", "skip_bonus_draw", "release_start_commands", "pass_battle_entry", "skip_effect_choice", "end_phase"];
  const acts = legal(s);
  const a = order.map((t) => acts.find((x) => x.type === t)).find(Boolean);
  return a ? act(s, a) : s;
}

// ===========================================================================
describe("XG4-032 ゴーオンゴールド（XG4）", () => {
  const TEXT =
    "※ウイング 【バーニングダガー】「SP1」これが敵軍ユニットをバトルで撃破したとき、撃破したユニットと同じカテゴリを持つオモテ向きの敵軍パワーを1枚選び捨札にしてもよい。（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）";

  it("XG4-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-2042）", () => {
    expectCatalogText("XG4-032", TEXT);
    expectUnit("XG4-032", { name: "ゴーオンゴールド", category: "OT", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 4, features: ["ゴールド", "男"] });
    expectRarityIn("XG4-032", ["SR"]);
  });

  wingTests("XG4-032", "atwiki/page-2042");

  const POWER = () => [faceUp("TST-OP-DA", "da1"), faceUp("TST-OP-DA", "da2"), faceUp("TST-OP-ET", "et"), faceDown("TST-OP-DA", "dd")];
  const ENEMY = () => ({ battle: [inst("SPEC-E-DA", "t")], power: POWER() });

  it("XG4-032: NC【バーニングダガー】— 4番目に出ると「SP1」を得る（出典: atwiki/page-2042「「SP1」」）", () => {
    expect(spOf(settle(ncEnter("XG4-032:gg", 3, {}, ENEMY(), EXTRA)), "player1", "XG4-032:gg")).toBe(1);
  });

  it("XG4-032: NC — バトルで敵軍ユニット（DA）を撃破すると、同じカテゴリ（DA）のオモテ向きの敵軍パワーから1枚選べる（ウラ向き・違うカテゴリは選べない。任意）（出典: atwiki/page-2042「撃破したユニットと同じカテゴリを持つオモテ向きの敵軍パワーを1枚選び捨札にしてもよい」）", () => {
    const s = settle(attack(ncEnter("XG4-032:gg", 3, {}, ENEMY(), EXTRA), "XG4-032:gg", "SPEC-E-DA:t"));
    expectChoiceFrom(s, "player1", "XG4-032");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:da1", "TST-OP-DA:da2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-032: NC — 選んだ敵軍パワーは捨札になる（出典: atwiki/page-2042「捨札にしてもよい」）", () => {
    const s = resolveAll(pick(settle(attack(ncEnter("XG4-032:gg", 3, {}, ENEMY(), EXTRA), "XG4-032:gg", "SPEC-E-DA:t")), "TST-OP-DA:da1"));
    expect(zoneOf(s, "player2", "TST-OP-DA:da1")).toBe("discard");
    expect(s.players.player2.power).toHaveLength(3);
  });

  it("XG4-032: ウイングでアタックするとき — ナンバーに関係なく発動する（ラッシュエリアからウイングでアタックして撃破）（出典: atwiki/page-2042「（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）」・カード評価「まずラッシュエリアにて効果を発動し」）", () => {
    let s = battle({ rush: [inst("XG4-032", "gg")] }, ENEMY());
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-032:gg" });
    s = settle(attack(s, "XG4-032:gg", "SPEC-E-DA:t"));
    expectChoiceFrom(s, "player1", "XG4-032");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:da1", "TST-OP-DA:da2"]);
  });
});

// ===========================================================================
describe("XG4-033 ゴーオンシルバー（XG4）", () => {
  const TEXT =
    "※ウイング ※タクスOT 【フリージングダガー】 これが敵軍Sユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のパワーゾーンに送ってもよい。（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）";

  it("XG4-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-2143）", () => {
    expectCatalogText("XG4-033", TEXT);
    expectUnit("XG4-033", { name: "ゴーオンシルバー", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 3, features: ["シルバー", "女"] });
    expectRarityIn("XG4-033", ["SR"]);
  });

  // ※ウイングの共通テンプレート（wingTests）は、アタックのあとに開く【フリージングダガー】の選択（任意）を見送れない
  // （settle は効果の選択を閉じない）。期待値はテンプレートのまま、選択を見送ってから続ける（XG4-judgments.md）。
  wingTestsDecliningFreeze("XG4-033", "atwiki/page-2143");
  taxTests("XG4-033", "OT", "atwiki/page-2143");

  const nc = (target: string) => attack(ncEnter("XG4-033:gs", 2, {}, { battle: [inst("SPEC-E-STRONG", "s"), inst("SPEC-E-STRONG-M", "m")], power: [] }, EXTRA), "XG4-033:gs", target);

  it("XG4-033: NC【フリージングダガー】— 3番目に出て敵軍 S ユニットにアタックするとき、バトルの前にバトル相手を持ち主のパワーゾーンに送れる（任意）。送ればバトルは行われず、これは撃破されない（出典: atwiki/page-2143「これが敵軍Sユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のパワーゾーンに送ってもよい」）", () => {
    let s = nc("SPEC-E-STRONG:s");
    s = settleTo(s, "XG4-033");
    expectChoiceFrom(s, "player1", "XG4-033");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s.pendingEffectChoice?.validInstanceIds.includes("SPEC-E-STRONG:s") ? pick(s, "SPEC-E-STRONG:s") : confirm(s));
    expect(zoneOf(s, "player2", "SPEC-E-STRONG:s")).toBe("power");
    expect(zoneOf(s, "player1", "XG4-033:gs")).toBe("battle");
  });

  it("XG4-033: NC — 送らなければ通常どおりバトルする（BP9000 の相手に撃破される）（出典: atwiki/page-2143「してもよい」）", () => {
    let s = settleTo(nc("SPEC-E-STRONG:s"), "XG4-033");
    if (s.pendingEffectChoice?.sourceCardId === "XG4-033") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG4-033:gs")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-STRONG:s")).toBe("battle");
  });

  it("XG4-033: NC — 敵軍 M ユニットにアタックするときは発動しない（出典: atwiki/page-2143「敵軍Sユニットにアタックするとき」）", () => {
    const s = settleTo(nc("SPEC-E-STRONG-M:m"), "XG4-033");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-033");
  });

  it("XG4-033: ウイングでアタックするとき — ナンバーに関係なく発動する（出典: atwiki/page-2143「（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）」・カード評価「ウイングから発動可能」）", () => {
    let s = battle({ rush: [inst("XG4-033", "gs")] }, { battle: [inst("SPEC-E-STRONG", "s")], power: [] });
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-033:gs" });
    s = settleTo(attack(s, "XG4-033:gs", "SPEC-E-STRONG:s"), "XG4-033");
    expectChoiceFrom(s, "player1", "XG4-033");
  });
});

/** sourceCardId の選択が開くまで、反応ウィンドウを1つずつパスする。 */
function settleTo(s: GameState, sourceCardId: string): GameState {
  let n = s;
  for (let i = 0; i < 6 && n.pendingEffectChoice?.sourceCardId !== sourceCardId; i++) {
    const before = n;
    n = settle(n, 1);
    if (n === before) break;
  }
  return n;
}

// ===========================================================================
describe("XG4-034 ダイカイオーニシ", () => {
  const TEXT = "※モーフ 【風の電子モヂカラ】これが自軍バトルエリアにある間、これ以外のLユニットとMユニットは、敵軍ユニットにアタックされない。";

  it("XG4-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-2104）", () => {
    expectCatalogText("XG4-034", TEXT);
    expectUnit("XG4-034", { name: "ダイカイオーニシ", category: "MA", size: "L", bp: 9000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["侍", "人型", "電子モヂカラ"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG4-034", ["NR"]);
  });

  it("XG4-034: 追加条件 — 自軍「海老折神」1体を捨札にしてラッシュできる（出典: atwiki/page-2104「追加条件：自軍「海老折神」1体を捨札にする」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-034", "n")], rush: [inst("XG3-035", "eb")], command: releasedCat("MA", 1), power: powerCards(5) }), "player1", "XG4-034:n");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG4-034:n")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-035:eb")).toBe("discard");
  });

  morphTests("XG4-034", "XG4-036", "XG4-037", "atwiki/page-2104");

  const defended = () =>
    enemyTurn({ battle: [inst("XG4-034", "n"), inst("SPEC-OWN-M", "m"), inst("SPEC-OWN-L", "l"), inst("SPEC-OWN-SS", "s")] }, { battle: [inst("SPEC-E-ATK", "a")] }, EXTRA);

  it("XG4-034:【風の電子モヂカラ】— これが自軍バトルエリアにある間、これ以外の自軍 L・M ユニットは敵軍ユニットにアタックされない（これ自身と S ユニットはアタックされる）（出典: atwiki/page-2104「これ以外のLユニットとMユニットは、敵軍ユニットにアタックされない」）", () => {
    const s = defended();
    expect(targetsOf(s, "SPEC-E-ATK:a", "player2")).toEqual(["SPEC-OWN-SS:s", "XG4-034:n"]);
  });

  it("XG4-034: 公式Q&A — 自軍ユニットは敵軍の L・M ユニットにアタックできる（敵軍のユニットは守られない）（出典: atwiki/page-2104 Q1）", () => {
    const s = battle({ battle: [inst("XG4-034", "n"), inst("SPEC-E-ATK", "mine")] }, { battle: [inst("SPEC-E-STRONG-M", "em"), inst("SPEC-OWN-L", "el")] });
    expect(targetsOf(s, "SPEC-E-ATK:mine")).toEqual(["SPEC-E-STRONG-M:em", "SPEC-OWN-L:el"]);
  });

  it("XG4-034:【風の電子モヂカラ】— これがラッシュエリアにあるときは守られない（出典: atwiki/page-2104「これが自軍バトルエリアにある間」）", () => {
    const s = enemyTurn({ rush: [inst("XG4-034", "n")], battle: [inst("SPEC-OWN-M", "m")] }, { battle: [inst("SPEC-E-ATK", "a")] }, EXTRA);
    expect(attackersOf(s, "SPEC-OWN-M:m")).toEqual(["SPEC-E-ATK:a"]);
  });
});

// ===========================================================================
describe("XG4-035 シンケンゴールド（XG4）", () => {
  const TEXT =
    "【モヂカラのプログラム】これが自軍エリアにある間、自軍ラッシュフェイズ中、 ETを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、自軍山札の上から1枚をオモテにし、オモテにしたカードが「特徴」を持つMAのカードなら手札に加え、それ以外なら山札の上か下に戻す。";

  it("XG4-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-2044）", () => {
    expectCatalogText("XG4-035", TEXT);
    expectUnit("XG4-035", { name: "シンケンゴールド", category: ["MA", "ET"], size: "S", bp: 4000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["ゴールド", "男", "侍"] });
    expectRarityIn("XG4-035", ["SR"]);
  });

  const rb = (top: ReturnType<typeof inst>, command = [released("TST-OP-ET", "et"), released("TST-OP-MA", "ma")]) =>
    board({ rush: [inst("XG4-035", "sg")], command, deck: [top, ...deckCards(3)] });

  it("XG4-035:【モヂカラのプログラム】— これが自軍エリアにあり、ET を持つリリース状態の自軍コマンドがあれば、自軍ラッシュフェイズ中に起動できる（出典: atwiki/page-2044「自軍ラッシュフェイズ中、 ETを持つ自軍コマンドを1つホールドしてもよい」）", () => {
    expect(canActivate(rb(inst("SPEC-MA-FEAT", "top")), "XG4-035:sg")).toBe(true);
    expect(canActivate(rb(inst("SPEC-MA-FEAT", "top"), [released("TST-OP-MA", "ma")]), "XG4-035:sg")).toBe(false);
  });

  it("XG4-035:【モヂカラのプログラム】— ET のコマンドをホールドし、山札の一番上が「特徴」を持つ MA のカードなら手札に加える（出典: atwiki/page-2044「オモテにしたカードが「特徴」を持つMAのカードなら手札に加え」）", () => {
    const s = resolveAll(activate(rb(inst("SPEC-MA-FEAT", "top")), "XG4-035:sg"));
    expect(cardIn(s, "player1", "TST-OP-ET:et")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-MA-FEAT:top")).toBe("hand");
  });

  it("XG4-035:【モヂカラのプログラム】— それ以外（特徴のない MA のカード・特徴のある ET のカード）なら山札の上か下を選んで戻す（出典: atwiki/page-2044「それ以外なら山札の上か下に戻す」）", () => {
    for (const top of [inst("SPEC-MA-NOFEAT", "top"), inst("SPEC-ET-FEAT", "top")]) {
      let s = activate(rb(top), "XG4-035:sg");
      expectChoiceFrom(s, "player1", "XG4-035");
      expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top"]);
      s = resolveAll(pick(s, "deck_bottom"));
      expect(s.players.player1.deck.at(-1)?.instanceId).toBe(top.instanceId);
    }
  });

  it("XG4-035:【モヂカラのプログラム】— 自軍バトルフェイズには起動できない（出典: atwiki/page-2044「自軍ラッシュフェイズ中」）", () => {
    expect(canActivate(battle({ rush: [inst("XG4-035", "sg")], command: [released("TST-OP-ET", "et")] }), "XG4-035:sg")).toBe(false);
  });
});

// ===========================================================================
describe("XG4-036 ダイカイオーミナミ", () => {
  const TEXT = "※モーフ";

  it("XG4-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-2065）", () => {
    expectCatalogText("XG4-036", TEXT);
    expectUnit("XG4-036", { name: "ダイカイオーミナミ", category: "MA", size: "L", bp: 5000, sp: 2, powerCost: "7+", comboNumber: undefined, features: ["侍", "人型", "電子モヂカラ"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG4-036", ["N"]);
  });

  it("XG4-036: 追加条件 — 自軍「海老折神」1体を捨札にしてラッシュできる（パワー7）（出典: atwiki/page-2065「追加条件：自軍「海老折神」1体を捨札にする」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-036", "mn")], rush: [inst("XG3-035", "eb")], command: releasedCat("MA", 1), power: powerCards(7) }), "player1", "XG4-036:mn");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XG3-035:eb")).toBe("discard");
  });

  morphTests("XG4-036", "XG4-034", "XG4-037", "atwiki/page-2065");
});

// ===========================================================================
describe("XG4-037 牛折神", () => {
  const TEXT =
    "※これはラッシュするとき可能ならバトルエリアに置く。 【荒ぶる折神】これをラッシュしたとき、お互いのダメージの点数が違うなら、少ない方は自分自身のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG4-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-2090）", () => {
    expectCatalogText("XG4-037", TEXT);
    expectUnit("XG4-037", { name: "牛折神", category: "MA", size: "L", bp: 6000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["獣", "折神獣"] });
    expectRarityIn("XG4-037", ["N"]);
  });

  /** 自軍ダメージ own 点、敵軍ダメージ enemy 点で牛折神を手札からラッシュする。 */
  const rushed = (own: number, enemy: number) => {
    const r = rushFromHand(
      board(
        { hand: [inst("XG4-037", "us")], command: releasedCat("MA", 1), power: [...powerCards(5), ...Array.from({ length: own }, (_, i) => faceDown("TST-P", `od${i}`))], rush: [inst("SPEC-OWN-SS", "own")], damage: own },
        { rush: [inst("SPEC-E-WEAK", "e1"), inst("SPEC-E-STRONG", "e2")], power: Array.from({ length: enemy }, (_, i) => faceDown("TST-P", `ed${i}`)), damage: enemy },
      ),
      "player1",
      "XG4-037:us",
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG4-037: ※ — ラッシュするとき可能ならバトルエリアに置く（出典: atwiki/page-2090「※これはラッシュするとき可能ならバトルエリアに置く」）", () => {
    expect(zoneOf(resolveAll(rushed(0, 0)), "player1", "XG4-037:us")).toBe("battle");
  });

  it("XG4-037:【荒ぶる折神】— 相手のダメージが少なければ、相手が自分のユニットを1体選び、自分のパワーゾーンにダメージとして置く（出典: atwiki/page-2090「少ない方は自分自身のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」・カード評価「敵軍ユニット除去＋１点ダメージ」）", () => {
    let s = rushed(3, 1);
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-E-STRONG:e2", "SPEC-E-WEAK:e1"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pickAs(s, "player2", "SPEC-E-STRONG:e2"));
    expect(isDamage(s, "player2", "SPEC-E-STRONG:e2")).toBe(true);
    expect(damageOf(s, "player2")).toBe(2);
  });

  it("XG4-037:【荒ぶる折神】— 自分のダメージが少なければ、自分が自軍ユニット（これ自身を含む）を1体選んでダメージにする（出典: atwiki/page-2090「少ない方は」・カード評価「ダメージで勝っている場合は自軍に被害が出る」）", () => {
    let s = rushed(1, 3);
    expect(choicePlayer(s)).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-OWN-SS:own", "XG4-037:us"]);
    s = resolveAll(pickAs(s, "player1", "SPEC-OWN-SS:own"));
    expect(isDamage(s, "player1", "SPEC-OWN-SS:own")).toBe(true);
  });

  it("XG4-037:【荒ぶる折神】— ダメージが同点なら何もしない（出典: atwiki/page-2090「お互いのダメージの点数が違うなら」・カード評価「ダメージが同点ならダメージ送りは発生しない」）", () => {
    const s = rushed(2, 2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-037");
  });
});

