/**
 * カード別スペック: XG3-009〜XG3-015（クロスギャザー ザ・Wインパクト ミント〜ガオベアー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG3-」とカード名で検索:
 *     本範囲のカードの項はない（同名の別カード RS-376 ギンガレッド等の項だけ）。本範囲のカードページに atwiki 転載の公式 Q&A はない。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CAT-02 マルチカテゴリ・R-ADD-02・R-CN-05）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  activate,
  bpOf,
  canActivate,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  enteredInEnemyTurn,
  enterAny,
  exiled,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectUnitStats,
  heldUnit,
  inst,
  isHeld,
  lineUp,
  nextPhase,
  passEntry,
  pick,
  PLAIN_VEHICLE,
  powerCards,
  reanimateTests,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  skip,
  spOf,
  st,
  sUnit,
  toStartEnd,
  zoneOf,
} from "./XG3-002-021.helpers";

const HUMAN_L = sUnit("SPEC-HUMAN-L", { category: "OT", bp: 13000, size: "L", features: ["人型"] });
const HUMAN_L2 = sUnit("SPEC-HUMAN-L2", { category: "ET", bp: 6000, size: "L", features: ["人型"] });
const MECHA_L = sUnit("SPEC-MECHA-L", { category: "WB", bp: 13000, size: "L", features: ["メカ"] });
const DA_L = sUnit("SPEC-DA-L", { category: "DA", bp: 13000, size: "L", features: ["人型"] });
const M3000 = sUnit("SPEC-M3000", { category: "OT", bp: 3000, size: "M" });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000 });
const E20000 = sUnit("SPEC-E20000", { bp: 20000, size: "L" });
const DA_E = sUnit("SPEC-DA-E", { category: "DA", bp: 1000 });
const BEAST_E = sUnit("SPEC-BEAST-E", { category: "WB", bp: 1000, features: ["獣"] });
const CN_RC = sUnit("SPEC-CN-RC", { comboNumber: "RC" as never });
const CN_L = sUnit("SPEC-CN-L", { comboNumber: "L" as never });
const CN_R = sUnit("SPEC-CN-R", { comboNumber: "R" as never });
const EXTRA = [HUMAN_L, HUMAN_L2, MECHA_L, DA_L, M3000, E4000, E5000, E20000, DA_E, BEAST_E, CN_RC, CN_L, CN_R];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-009 ミント", () => {
  const TEXT =
    "※これはバトルエリアに出られない。 【戦いの記録】自軍スタートフェイズ開始時、このユニットを捨札にして次の効果を発動できる⇒自軍ラッシュエリアから、効果名を持つテキストに「これをラッシュしたとき」と書かれたユニットを1体選んでもよい。そうしたとき、そのラッシュしたときの効果を発動する。";

  it("XG3-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-1890「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-009", TEXT);
    expectStats("XG3-009", { name: "ミント", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ"] });
    expectRarityIn("XG3-009", ["NR"]);
  });

  it("XG3-009: ※ バトルエリアに出られない（出典: atwiki/page-1890「※これはバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-009", "m")], command: releasedCat("ET", 1) }), "XG3-009:m")).toBe(false);
  });

  /** 敵軍（player2）がターンを終え、自軍（player1）スタートフェイズが始まったところ。自軍ラッシュエリア: ミント・レッドラダー（【救出作業】）・ジェットデルタ（※）・フィラー。 */
  const startBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    endTurn(
      st(
        {
          phase: "end",
          activePlayer: "player2",
          player1: {
            rush: [inst("XG3-009", "m"), inst("RS-383", "rl"), inst("RS-264", "jd"), inst("TST-UNIT-0", "f")],
            discard: [inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")],
            power: powerCards(3),
            deck: deckCards(5),
            ...p1,
          },
          player2: { deck: deckCards(5, "e") },
        },
        EXTRA,
      ),
    );

  it("XG3-009:【戦いの記録】— 自軍スタートフェイズ開始時に、このユニットを捨札にして発動するかを選べる（任意）（出典: atwiki/page-1890「自軍スタートフェイズ開始時、このユニットを捨札にして次の効果を発動できる」）", () => {
    const s = startBoard();
    expect(s.phase).toBe("start");
    expectChoiceFrom(s, "player1", "XG3-009");
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-009:【戦いの記録】— 発動すると、自軍ラッシュエリアの、効果名を持つテキストに「これをラッシュしたとき」と書かれたユニットから選べる（※の「これをラッシュしたとき」・効果のないユニットは選べない。任意）（出典: atwiki/page-1890「効果名を持つテキストに「これをラッシュしたとき」と書かれたユニットを1体選んでもよい」）", () => {
    let s = startBoard();
    s = s.pendingEffectChoice?.sourceCardId === "XG3-009" && s.pendingEffectChoice.kind !== "select_unit" ? pick(s, s.pendingEffectChoice.validInstanceIds[0]!) : s;
    expect(zoneOf(s, "player1", "XG3-009:m")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG3-009");
    expect(choiceIds(s)).toEqual(["RS-383:rl"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-009:【戦いの記録】— 選んだユニットの「ラッシュしたとき」の効果（RS-383 レッドラダー【救出作業】自軍捨札の S ユニットを手札に）を発動する（出典: atwiki/page-1890「そのラッシュしたときの効果を発動する」・カード評価「ユニットをラッシュしたときの効果を再利用する」）", () => {
    const s = resolveAll(startBoard(), ["accept", "RS-383:rl", "TST-UNIT-0:d1", "TST-UNIT-0:d2"]);
    expect(zoneOf(s, "player1", "XG3-009:m")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d1")).toBe("hand");
  });

  it("XG3-009:【戦いの記録】— 発動しなければミントはラッシュエリアに残る（出典: atwiki/page-1890「発動できる」）", () => {
    let s = startBoard();
    if (s.pendingEffectChoice?.sourceCardId === "XG3-009") s = skip(s);
    expect(zoneOf(toStartEnd(s, "none"), "player1", "XG3-009:m")).toBe("rush");
  });
});

// ===========================================================================
describe("XG3-010 ジークジェンヌ", () => {
  const TEXT =
    "【ジークの命】自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("XG3-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-1891）", () => {
    expectCatalogText("XG3-010", TEXT);
    expectStats("XG3-010", { name: "ジークジェンヌ", category: "OT", size: "S", bp: 500, sp: "1/4", powerCost: 2, comboNumber: undefined, features: ["女", "ジークテクター"] });
    expectRarityIn("XG3-010", ["N"]);
  });

  const field = () => ({ rush: [inst("XG3-010", "z"), inst("SPEC-HUMAN-L", "L"), inst("SPEC-DA-L", "da"), inst("SPEC-M3000", "m")] });

  it("XG3-010:【ジークの命】— 自軍ラッシュフェイズ中に発動でき、DA を持たない自軍 L ユニットから選べる（DA の L・M ユニット・敵軍の L は選べない。任意）（出典: atwiki/page-1891「自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい」）", () => {
    const s0 = board(field(), { rush: [inst("SPEC-HUMAN-L", "eL")] });
    expect(canActivate(s0, "XG3-010:z")).toBe(true);
    const s = activate(s0, "XG3-010:z");
    expectChoiceFrom(s, "player1", "XG3-010");
    expect(choiceIds(s)).toEqual(["SPEC-HUMAN-L:L"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-010:【ジークの命】— 自軍バトルフェイズには発動できない（出典: atwiki/page-1891「自軍ラッシュフェイズ中」）", () => {
    expect(canActivate(battle(field()), "XG3-010:z")).toBe(false);
  });

  /** ラッシュフェイズに L を重ね、バトルフェイズへ進んで L を出す（重ねたユニットが得た能力の選択は残す）。 */
  const stackedThenEnter = (p2: Partial<GameState["players"]["player2"]> = {}) => {
    let s = resolveAll(pick(activate(board(field(), p2), "XG3-010:z"), "SPEC-HUMAN-L:L"));
    s = nextPhase(s);
    return enter(s, "SPEC-HUMAN-L:L");
  };

  it("XG3-010:【ジークの命】— 重ねたあと、ジークジェンヌはユニットとして扱わない（バトルエリアに出られない）（出典: atwiki/page-1891「これは、ユニットが重ねられている間カードとして扱い」）", () => {
    const s = nextPhase(resolveAll(pick(activate(board(field()), "XG3-010:z"), "SPEC-HUMAN-L:L")));
    expect(canEnter(s, "XG3-010:z")).toBe(false);
  });

  it("XG3-010:【ジークの命】— 重ねたユニットは、自軍ターン中にバトルエリアに出たとき、これをホールドするかを選べる（任意）（出典: atwiki/page-1891「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい」）", () => {
    const s = stackedThenEnter({ battle: [inst("TST-UNIT-0", "e")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-010:【ジークの命】— ホールドすれば、敵軍ユニット（エリア・サイズ・BP を問わない）を1体選び、持ち主のパワーゾーンに送る（出典: atwiki/page-1891「そうしたとき、敵軍ユニットを1体選び、持ち主のパワーゾーンに送る」・カード評価「敵軍ユニットをサイズ・BP・エリアを問わず除去」）", () => {
    const s = resolveAll(stackedThenEnter({ battle: [inst("TST-UNIT-0", "e")], rush: [inst("SPEC-E20000", "big")] }), ["accept", "SPEC-E20000:big"]);
    expect(isHeld(s, "player1", "SPEC-HUMAN-L:L")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E20000:big")).toBe("power");
  });
});

// ===========================================================================
describe("XG3-011 獣魔ハンター・ジーク", () => {
  const TEXT = "【ジークブラスター】このユニットは、本来のカテゴリにDAを持つ敵軍ユニットがあれば「SP1」になり、本来の特徴に「獣」を持つ敵軍ユニットがあればBP+2000される。";

  it("XG3-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-2009）", () => {
    expectCatalogText("XG3-011", TEXT);
    expectStats("XG3-011", { name: "獣魔ハンター・ジーク", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 3, comboNumber: undefined, features: ["男", "ジークテクター"] });
    expectRarityIn("XG3-011", ["R"]);
  });

  it("XG3-011: 敵軍に DA・「獣」のユニットがいなければ BP2000・SP1/4（1番目では SP なし）（出典: atwiki/page-2009「SP：1/4」）", () => {
    const s = battle({ battle: [inst("XG3-011", "j")] }, { battle: [inst("TST-UNIT-0", "e")] });
    expect(bpOf(s, "player1", "XG3-011:j")).toBe(2000);
    expect(spOf(s, "player1", "XG3-011:j")).toBe(0);
  });

  it("XG3-011:【ジークブラスター】— 本来のカテゴリに DA を持つ敵軍ユニットがあれば「SP1」になる（1番目でも SP1）（出典: atwiki/page-2009「本来のカテゴリにDAを持つ敵軍ユニットがあれば「SP1」になり」・カード評価「パワー3でSP1は破格」）", () => {
    expect(spOf(battle({ battle: [inst("XG3-011", "j")] }, { rush: [inst("SPEC-DA-E", "da")] }), "player1", "XG3-011:j")).toBe(1);
  });

  it("XG3-011:【ジークブラスター】— 本来の特徴に「獣」を持つ敵軍ユニットがあれば BP+2000（4000）（出典: atwiki/page-2009「本来の特徴に「獣」を持つ敵軍ユニットがあればBP+2000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-011", "j")] }, { battle: [inst("SPEC-BEAST-E", "b")] }), "player1", "XG3-011:j")).toBe(4000);
  });

  it("XG3-011:【ジークブラスター】— 自軍の DA・「獣」のユニットでは変わらない（出典: atwiki/page-2009「敵軍ユニットがあれば」・カード評価「相手依存効果」）", () => {
    const s = battle({ battle: [inst("XG3-011", "j")], rush: [inst("SPEC-DA-E", "da"), inst("SPEC-BEAST-E", "b")] });
    expect(bpOf(s, "player1", "XG3-011:j")).toBe(2000);
    expect(spOf(s, "player1", "XG3-011:j")).toBe(0);
  });
});

// ===========================================================================
describe("XG3-012 獣装光ギンガレッド", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ギンガレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 【閃光星獣剣】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからナンバーを持たないSユニットを1体選びゲームから除外する。";

  it("XG3-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-2011）", () => {
    expectCatalogText("XG3-012", TEXT);
    expectUnitStats("XG3-012", { name: "獣装光ギンガレッド", category: ["WB", "MA"], size: "S", bp: 4500, sp: 1, powerCost: "7-", comboNumber: undefined, features: ["レッド", "男", "ギンガの光"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG3-012", ["SR"]);
  });

  const cmds = () => [...releasedCat("WB", 1), ...releasedCat("MA", 1)];

  it("XG3-012: 追加条件 — 自軍「ギンガレッド」（RS-376・XG2-025）1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-2011「自軍「ギンガレッド」1体を捨札にすれば必要パワー0になる」）", () => {
    for (const gid of ["RS-376", "XG2-025"]) {
      const s = board({ hand: [inst("XG3-012", "g")], rush: [inst(gid, "p")], command: cmds(), power: [] });
      const r = rushVia(s, "player1", "XG3-012:g", (a) => a.zordMaterialInstanceId === `${gid}:p`);
      expect(r.ok, r.error).toBe(true);
      const t = resolveAll(r.state);
      expect(zoneOf(t, "player1", "XG3-012:g")).toBe("rush");
      expect(zoneOf(t, "player1", `${gid}:p`)).toBe("discard");
    }
  });

  it("XG3-012: 必要パワー7- — 「ギンガレッド」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: atwiki/page-2011・R-ADD-02）", () => {
    const mk = (n: number) => board({ hand: [inst("XG3-012", "g")], command: cmds(), power: powerCards(n) });
    expect(canStartRush(mk(6), "player1", "XG3-012:g")).toBe(false);
    const r = rushFromHand(mk(7), "player1", "XG3-012:g");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-012:g")).toBe("rush");
  });

  it("XG3-012: マルチカテゴリ — 自軍コマンドゾーンに WB と MA の両方がなければラッシュできない（出典: R-CAT-02・コメント欄「赤黄マルチだから結局どっちのコマンドも要る」）", () => {
    const s = board({ hand: [inst("XG3-012", "g")], rush: [inst("RS-376", "p")], command: releasedCat("WB", 2), power: powerCards(7) });
    expect(canStartRush(s, "player1", "XG3-012:g")).toBe(false);
  });

  reanimateTests("XG3-012", "RS-376", "ギンガレッド", "atwiki/page-2011");

  const enemy = () => ({
    battle: [inst("TST-UNIT-0", "e"), inst("XG3-020", "cn"), inst("SPEC-M3000", "m")],
    rush: [inst("TST-UNIT-0", "r")],
  });

  it("XG3-012:【閃光星獣剣】— 自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアのナンバーを持たない S ユニットから選ぶ（ナンバーを持つユニット・M ユニット・ラッシュエリアのユニットは選べない。見送れない）（出典: atwiki/page-2011「敵軍バトルエリアからナンバーを持たないSユニットを1体選び」）", () => {
    const s = enter(battle({ rush: [inst("XG3-012", "g")] }, { ...enemy(), battle: [...enemy().battle, inst("SPEC-E4000", "e2")] }), "XG3-012:g");
    expectChoiceFrom(s, "player1", "XG3-012");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:e2", "TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG3-012:【閃光星獣剣】— CN が「RC」「L」「R」の S ユニットも「ナンバーを持つ」とみなし、選べない（出典: 利用者の決定 2026-10-20・questions-all.md U-17）", () => {
    const s = enter(battle({ rush: [inst("XG3-012", "g")] }, { battle: [inst("TST-UNIT-0", "e"), inst("SPEC-CN-RC", "rc"), inst("SPEC-CN-L", "l"), inst("SPEC-CN-R", "r")] }), "XG3-012:g");
    expectChoiceFrom(s, "player1", "XG3-012");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e"]);
  });

  it("XG3-012:【閃光星獣剣】— 選んだユニットをゲームから除外する（捨札にも置かれない）（出典: atwiki/page-2011「ゲームから除外する」・コメント欄「捨札の再利用を許さない」）", () => {
    const s = resolveAll(enter(battle({ rush: [inst("XG3-012", "g")] }, enemy()), "XG3-012:g"), ["TST-UNIT-0:e"]);
    expect(exiled(s, "player2")).toEqual(["TST-UNIT-0:e"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBeNull();
  });

  it("XG3-012:【閃光星獣剣】— 敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-2011「自軍ターン中、」）", () => {
    // 敵軍（player2）の RK-139 仮面ライダーゼロノスAF の RC で、自軍のこれが敵軍ターン中にバトルエリアに出される（RK15-295-315 と同じ手順）。
    const s = enteredInEnemyTurn("XG3-012:g", {}, { battle: [inst("TST-UNIT-0", "e")] }, [PLAIN_VEHICLE]);
    expect(zoneOf(s, "player1", "XG3-012:g")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-012");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-013 ガオポーラー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※これは自軍「ガオベアー」があればBP+3000される。 【冷凍光線】「ガオベアー」か特徴「人型」を持つLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたユニットのBP以下のBPを持つ敵軍ユニットを1体選びホールドする。";

  it("XG3-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-1892「CN：L」）", () => {
    expectCatalogText("XG3-013", TEXT);
    expectStats("XG3-013", { name: "ガオポーラー", category: "WB", size: "M", bp: 1000, sp: undefined, powerCost: 2, comboNumber: "L", features: ["獣"] });
    expectRarityIn("XG3-013", ["N"]);
  });

  it("XG3-013: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（リリース状態のコマンドがなければ出られない）（出典: atwiki/page-1892「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-013", "p")] }), "XG3-013:p")).toBe(false);
    const s = enterAny(battle({ rush: [inst("XG3-013", "p")], command: releasedCat("WB", 2) }), "XG3-013:p");
    expect(zoneOf(s, "player1", "XG3-013:p")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("XG3-013: ※ 自軍「ガオベアー」（ラッシュエリア・バトルエリア）があれば BP+3000（4000）。敵軍の「ガオベアー」では上がらない（出典: atwiki/page-1892「※これは自軍「ガオベアー」があればBP+3000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-013", "p")] }), "player1", "XG3-013:p")).toBe(1000);
    expect(bpOf(battle({ battle: [inst("XG3-013", "p")], rush: [inst("XG3-015", "b")] }), "player1", "XG3-013:p")).toBe(4000);
    expect(bpOf(battle({ battle: [inst("XG3-013", "p"), inst("XG3-015", "b")] }), "player1", "XG3-013:p")).toBe(4000);
    expect(bpOf(battle({ battle: [inst("XG3-013", "p")] }, { battle: [inst("XG3-015", "b")] }), "player1", "XG3-013:p")).toBe(1000);
  });

  const enemies = () => ({ battle: [inst("TST-UNIT-0", "e1"), inst("SPEC-E5000", "e5")], rush: [inst("SPEC-E20000", "big"), inst("SPEC-E4000", "e4")] });
  const cmds = () => releasedCat("WB", 3);

  it("XG3-013:【冷凍光線】— 特徴「人型」を持つ L ユニットがこれからコンビネーションするとき発動でき、そのユニットの BP 以下の敵軍ユニット（エリアを問わない）から選ぶ（出典: atwiki/page-1892「コンビネーションしたユニットのBP以下のBPを持つ敵軍ユニットを1体選びホールドする」・カード評価「カテゴリが一致していなくてもJCが発動できる」）", () => {
    const s = line(["XG3-013:p", "SPEC-HUMAN-L2:L"], { command: cmds() }, enemies());
    expectChoiceFrom(s, "player1", "XG3-013");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:e4", "SPEC-E5000:e5", "TST-UNIT-0:e1"]);
  });

  it("XG3-013:【冷凍光線】— 選んだ敵軍ユニットはホールド状態になる（出典: atwiki/page-1892「選びホールドする」）", () => {
    const s = resolveAll(line(["XG3-013:p", "SPEC-HUMAN-L2:L"], { command: cmds() }, enemies()), ["accept", "SPEC-E5000:e5"]);
    expect(isHeld(s, "player2", "SPEC-E5000:e5")).toBe(true);
  });

  it("XG3-013:【冷凍光線】—「ガオベアー」がこれからコンビネーションするときも発動する（ガオベアーは BP4000 なので BP4000 以下）（出典: atwiki/page-1892「「ガオベアー」か特徴「人型」を持つLユニットがこのユニットからコンビネーションするとき」・カード評価「ガオベアーをコンビネーションさせても発動できる」）", () => {
    const s = line(["XG3-013:p", "XG3-015:b"], { command: cmds() }, enemies());
    expectChoiceFrom(s, "player1", "XG3-013");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:e4", "TST-UNIT-0:e1"]);
  });

  it("XG3-013:【冷凍光線】— 特徴「人型」を持たない L ユニットがコンビネーションしても発動しない（出典: atwiki/page-1892「特徴「人型」を持つLユニット」）", () => {
    const s = line(["XG3-013:p", "SPEC-MECHA-L:L"], { command: cmds() }, enemies());
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-013");
  });
});

// ===========================================================================
describe("XG3-014 ガオマッスル", () => {
  const TEXT =
    "合体―-ガオゴリラ＋ガオイーグル＋ガオバイソン＋ガオベアー＋ガオポーラー 【剛力無双マッスルラリアット】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを2つ選びホールドしてもよい。そうしたとき、敵軍バトルエリアからユニットを1体選び撃破する。";

  it("XG3-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-1972）", () => {
    expectCatalogText("XG3-014", TEXT);
    expectStats("XG3-014", { name: "ガオマッスル", category: "WB", size: "L", bp: 16000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["獣", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG3-014", ["R"]);
  });

  const PARTS = ["XG3-016:go", "RS-153:ea", "RS-155:bi", "XG3-015:be", "XG3-013:po"];
  const partsIn = (ids: string[]): CardInstance[] => ids.map((id) => inst(id.split(":")[0]!, id.split(":")[1]!));

  it("XG3-014: 合体 — 自軍のガオゴリラ・ガオイーグル・ガオバイソン・ガオベアー・ガオポーラーを捨札にしてラッシュできる（出典: atwiki/page-1972「合体―-ガオゴリラ＋ガオイーグル＋ガオバイソン＋ガオベアー＋ガオポーラー」）", () => {
    const s = board({ hand: [inst("XG3-014", "mu")], rush: partsIn(PARTS), power: powerCards(6), command: releasedCat("WB", 1) });
    const r = rushFromHand(s, "player1", "XG3-014:mu", { materials: PARTS });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-014:mu")).toBe("rush");
    for (const p of PARTS) expect(zoneOf(r.state, "player1", p)).toBe("discard");
  });

  it("XG3-014: 合体 — 合体ユニットが1体でも欠けていればラッシュできない（出典: atwiki/page-1972）", () => {
    const s = board({ hand: [inst("XG3-014", "mu")], rush: partsIn(PARTS.slice(0, 4)), power: powerCards(6), command: releasedCat("WB", 1) });
    expect(canStartRush(s, "player1", "XG3-014:mu")).toBe(false);
  });

  const entered = (cmdN: number, p2: Partial<GameState["players"]["player2"]> = { battle: [inst("TST-UNIT-0", "e"), inst("SPEC-E20000", "big")], rush: [inst("TST-UNIT-0", "r")] }) =>
    enter(battle({ rush: [inst("XG3-014", "mu")], command: releasedCat("WB", cmdN) }, p2), "XG3-014:mu");

  it("XG3-014:【剛力無双マッスルラリアット】— 自軍ターン中にバトルエリアに出たとき、自軍コマンドを2つホールドするかを選べる（任意）（出典: atwiki/page-1972「自軍コマンドを2つ選びホールドしてもよい」）", () => {
    const s = entered(2);
    expectChoiceFrom(s, "player1", "XG3-014");
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-014:【剛力無双マッスルラリアット】— 撃破するユニットは敵軍バトルエリアから選ぶ（サイズ・BP を問わない。ラッシュエリアのユニットは選べない）（出典: atwiki/page-1972「敵軍バトルエリアからユニットを1体選び撃破する」・カード評価「サイズ・BPを問わない」「バトルエリアのユニットしか対象にできない」）", () => {
    let s = entered(2);
    for (let i = 0; i < 3 && s.pendingEffectChoice?.sourceCardId === "XG3-014" && !choiceIds(s).includes("TST-UNIT-0:e"); i++) s = pick(s, choiceIds(s)[0]!);
    expect(choiceIds(s)).toEqual(["SPEC-E20000:big", "TST-UNIT-0:e"]);
  });

  it("XG3-014:【剛力無双マッスルラリアット】— ホールドすると自軍コマンドが2つホールド状態になり、選んだユニットを撃破する（出典: atwiki/page-1972「そうしたとき、敵軍バトルエリアからユニットを1体選び撃破する」）", () => {
    const s = resolveAll(entered(2), ["accept", "SPEC-E20000:big"]);
    expect(zoneOf(s, "player2", "SPEC-E20000:big")).toBe("discard");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("XG3-014:【剛力無双マッスルラリアット】— リリース状態の自軍コマンドが1つしかなければ発動できない（撃破しない）（出典: atwiki/page-1972「自軍コマンドを2つ選びホールドしてもよい。そうしたとき」・カード評価「コマンドを2枚も用意しなければいけない」）", () => {
    const s = entered(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-014");
  });
});

// ===========================================================================
describe("XG3-015 ガオベアー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※これは自軍「ガオポーラー」があればBP+3000される。 【氷牙炎滅ベアーストライク】これが、「ガオポーラー」か特徴「人型」を持つLユニットからコンビネーションするとき、次の効果を発動できる⇒ホールド状態の敵軍ユニットを1体選び撃破する。また、自軍バトルエリアに「ガオポーラー」と特徴「人型」を持つLユニットがあれば、これは「SP1」になる。";

  it("XG3-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-1893「CN：R」）", () => {
    expectCatalogText("XG3-015", TEXT);
    expectStats("XG3-015", { name: "ガオベアー", category: "WB", size: "M", bp: 1000, sp: "1/2", powerCost: 3, comboNumber: "R", features: ["獣"] });
    expectRarityIn("XG3-015", ["N"]);
  });

  it("XG3-015: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1893）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-015", "b")] }), "XG3-015:b")).toBe(false);
    const s = enterAny(battle({ rush: [inst("XG3-015", "b")], command: releasedCat("WB", 1) }), "XG3-015:b");
    expect(zoneOf(s, "player1", "XG3-015:b")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("XG3-015: ※ 自軍「ガオポーラー」があれば BP+3000（4000）。敵軍の「ガオポーラー」では上がらない（出典: atwiki/page-1893「※これは自軍「ガオポーラー」があればBP+3000される」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-015", "b")] }), "player1", "XG3-015:b")).toBe(1000);
    expect(bpOf(battle({ battle: [inst("XG3-015", "b")], rush: [inst("XG3-013", "p")] }), "player1", "XG3-015:b")).toBe(4000);
    expect(bpOf(battle({ battle: [inst("XG3-015", "b")] }, { rush: [inst("XG3-013", "p")] }), "player1", "XG3-015:b")).toBe(1000);
  });

  const enemies = () => ({ battle: [heldUnit("SPEC-E20000", "hb"), inst("TST-UNIT-0", "e")], rush: [heldUnit("TST-UNIT-0", "hr")] });
  const cmds = () => releasedCat("WB", 3);

  it("XG3-015:【氷牙炎滅ベアーストライク】— 「ガオポーラー」からコンビネーションするとき発動でき、ホールド状態の敵軍ユニット（エリア・BP を問わない）から選ぶ（出典: atwiki/page-1893「ホールド状態の敵軍ユニットを1体選び撃破する」）", () => {
    const s = line(["XG3-013:p", "XG3-015:b"], { command: cmds() }, enemies());
    expectChoiceFrom(s, "player1", "XG3-015");
    expect(choiceIds(s)).toEqual(["SPEC-E20000:hb", "TST-UNIT-0:hr"]);
  });

  it("XG3-015:【氷牙炎滅ベアーストライク】— 特徴「人型」を持つ L ユニットからコンビネーションしても発動し、選んだユニットを撃破する（出典: atwiki/page-1893「特徴「人型」を持つLユニットからコンビネーションするとき」・カード評価「MAのガンマジンなど…で効果を発動させやすい」）", () => {
    const s = resolveAll(line(["SPEC-HUMAN-L:L", "XG3-015:b"], { command: cmds() }, enemies()), ["accept", "SPEC-E20000:hb"]);
    expect(zoneOf(s, "player2", "SPEC-E20000:hb")).toBe("discard");
  });

  it("XG3-015:【氷牙炎滅ベアーストライク】— 自軍バトルエリアに「ガオポーラー」と特徴「人型」を持つ L ユニットがあれば「SP1」になる（2番目でも SP1）（出典: atwiki/page-1893「また、自軍バトルエリアに「ガオポーラー」と特徴「人型」を持つLユニットがあれば、これは「SP1」になる」・カード評価「ナンバーに関係なくSPを得ることができる」）", () => {
    // 「人型」の L がガオポーラーからコンビネーションするとき【冷凍光線】の選択が開くので、答えてから「ガオベアー」を出す。
    let s = resolveAll(line(["XG3-013:p", "SPEC-HUMAN-L:L"], { command: cmds(), rush: [inst("XG3-015", "b")] }, enemies()));
    s = resolveAll(enterAny(passEntry(s), "XG3-015:b"));
    expect(spOf(s, "player1", "XG3-015:b")).toBe(1);
  });

  it("XG3-015: SP1/2 — 2番目に出れば（効果がなくても）SP1、1番目なら SP なし（出典: atwiki/page-1893「SP：1/2」・R-STK-03）", () => {
    expect(spOf(resolveAll(line(["TST-UNIT-0:f", "XG3-015:b"], { command: cmds() })), "player1", "XG3-015:b")).toBe(1);
    expect(spOf(resolveAll(line(["XG3-015:b"], { command: cmds() })), "player1", "XG3-015:b")).toBe(0);
  });

  it("XG3-015:【氷牙炎滅ベアーストライク】— 特徴「人型」を持たない L ユニットからコンビネーションしても発動しない（出典: atwiki/page-1893）", () => {
    const s = line(["SPEC-MECHA-L:L", "XG3-015:b"], { command: cmds() }, enemies());
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-015");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-E20000:hb")).toBe("battle");
  });
});
