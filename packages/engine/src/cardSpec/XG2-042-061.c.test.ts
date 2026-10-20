/**
 * カード別スペック: XG2-056〜XG2-061（クロスギャザー ザ・ドラゴンタイガー 仮面ライダーファイズBF〜リョクオオザル）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-056」〜「XG2-061」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-056 Q1、XG2-060 Q1、XG2-061 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-CALL-01・R-KW-RC-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * BP が本来の BP でない敵軍ユニットは、XG2-052 ユナイトベントを重ねた状態（ウラ向きのカード1枚につき BP+2000。XG2-042-061.b で確かめたとおりエンジンも効く）で作る。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  act,
  attack,
  bpOf,
  canCounter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageOf,
  DEFS,
  deckCards,
  endTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnit,
  exiled,
  faceDownCard,
  held,
  inst,
  legal,
  nextPhase,
  p1Battle,
  pick,
  powerCards,
  rcBoard,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  st,
  substitutes,
  sUnit,
  useCounter,
  useNinja,
  wingTests,
  withStacked,
  zoneOf,
} from "./XG2-042-061.helpers";

const BEAST_S15 = sUnit("SPEC-BEAST-S15", { bp: 1500, features: ["獣"] });
const BEAST_S10 = sUnit("SPEC-BEAST-S10", { bp: 1000, features: ["獣"] });
const BEAST_M = sUnit("SPEC-BEAST-M", { bp: 3000, size: "M", features: ["獣"], sp: undefined });
const BP2500 = sUnit("SPEC-BP2500", { bp: 2500 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const DA0 = sUnit("SPEC-DA0", { category: "DA", bp: 1000, powerCost: 0 });
const OT0 = sUnit("SPEC-OT0", { category: "OT", bp: 1000, powerCost: 0 });
const EXTRA = [BEAST_S15, BEAST_S10, BEAST_M, BP2500, C2, C3, DA0, OT0];

/** ユナイトベントとウラ向きのカード1枚を重ねた（BP+2000 の）ユニット。 */
const vented = (cardId: string, suf: string): CardInstance => withStacked(inst(cardId, suf), [inst("XG2-052", `uv${suf}`), faceDownCard("SPEC-BEAST-M", `fd${suf}`)]);

// ===========================================================================
describe("XG2-056 仮面ライダーファイズBF", () => {
  const TEXT =
    "※ウイング 【強化クリムゾンスマッシュ】これが、BPが本来のBPでない敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のコマンドゾーンに置いてもよい。置けなければ捨札にする。そうしたとき、バトル相手のユニットのBPの下三桁が500だったなら、相手に1点ダメージを与える。";

  it("XG2-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-1814）", () => {
    expectCatalogText("XG2-056", TEXT);
    expectUnit("XG2-056", { name: "仮面ライダーファイズBF", category: "ET", size: "S", bp: 5000, sp: 1, powerCost: "4+", features: ["仮面ライダー", "男", "ブラスターフォーム"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG2-056", ["SR"]);
  });

  const board = (rush: CardInstance[], power = 4) => rushBoard({ hand: [inst("XG2-056", "h")], rush, power: powerCards(power), command: releasedCat("ET", 1) });

  it("XG2-056: 追加条件 — 自軍「仮面ライダーファイズ」（RK-064）1体を捨札にしてパワー4でラッシュできる。パワー3ではできない（出典: atwiki/page-1814「追加条件：自軍「仮面ライダーファイズ」1体をコマンドゾーンに送るか捨札にする」「必要パワー：4+」）", () => {
    const r = rushFromHand(board([inst("RK-064", "fz")]), "player1", "XG2-056:h", { destination: "discard" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-064:fz")).toBe("discard");
    expect(canStartRush(board([inst("RK-064", "fz")], 3), "player1", "XG2-056:h")).toBe(false);
  });

  it("XG2-056: 追加条件 — 「仮面ライダーファイズ」をコマンドゾーンに送ってもよい（出典: atwiki/page-1814「コマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(board([inst("RK-064", "fz")]), "player1", "XG2-056:h", { destination: "command" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-064:fz")).toBe("command");
  });

  wingTests("XG2-056", "atwiki/page-1814");

  const smash = (defender: CardInstance, p2: Partial<GameState["players"]["player2"]> = {}) =>
    attack(p1Battle({ battle: [inst("XG2-056", "bf")] }, { battle: [defender], ...p2 }, EXTRA), "XG2-056:bf", defender.instanceId);

  it("XG2-056: 【強化クリムゾンスマッシュ】BP が本来の BP でない敵軍ユニット（ユナイトベントで BP1500→3500）にアタックするとき、バトルの前にバトル相手を持ち主のコマンドゾーンに置くかを選べる（任意）（出典: atwiki/page-1814「バトルの前にバトル相手のユニットを持ち主のコマンドゾーンに置いてもよい」）", () => {
    const s = smash(vented("SPEC-BEAST-S15", "t"));
    expect(bpOf(s, "player2", "SPEC-BEAST-S15:t")).toBe(3500);
    expectChoiceFrom(s, "player1", "XG2-056");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-056: 【強化クリムゾンスマッシュ】置くと、バトル相手は持ち主のコマンドゾーンに（リリース状態で）置かれ、BP の下三桁が500 なら相手に1点ダメージを与える（出典: atwiki/page-1814「バトル相手のユニットのBPの下三桁が500だったなら、相手に1点ダメージを与える」・カード評価「コマンドに送られたカードはリリースされて置かれる」）", () => {
    const s = resolveAll(accept(smash(vented("SPEC-BEAST-S15", "t"))));
    expect(zoneOf(s, "player2", "SPEC-BEAST-S15:t")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-BEAST-S15:t")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG2-056: 【強化クリムゾンスマッシュ】BP の下三桁が500 でなければ（BP1000→3000）、コマンドゾーンに置くがダメージは与えない（出典: atwiki/page-1814「…500だったなら」）", () => {
    const s = resolveAll(accept(smash(vented("SPEC-BEAST-S10", "t"))));
    expect(zoneOf(s, "player2", "SPEC-BEAST-S10:t")).toBe("command");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG2-056: 【強化クリムゾンスマッシュ】持ち主のコマンドゾーンが5枚で置けなければ捨札にする（ダメージの条件は同じ）（出典: atwiki/page-1814「置けなければ捨札にする」）", () => {
    const s = resolveAll(accept(smash(vented("SPEC-BEAST-S15", "t"), { command: releasedCat("WB", 5, "ec") })));
    expect(zoneOf(s, "player2", "SPEC-BEAST-S15:t")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG2-056: 【強化クリムゾンスマッシュ】BP が本来の BP の敵軍ユニット（BP2500）へのアタックでは発動せず、ダメージも与えない（出典: atwiki/page-1814「BPが本来のBPでない敵軍ユニットにアタックするとき」）", () => {
    const s = resolveAll(smash(inst("SPEC-BP2500", "t")));
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG2-056: 公式Q&A — 相手が RS-018 隠流忍術で BP が本来の値のユニット（BP2500）にバトル相手を変えても、そのユニットをコマンドゾーンに置け、BP の下三桁が500 なら1点ダメージを与える（出典: atwiki/page-1814 Q1「「RS-018 隠流忍術」の効果で変更されたバトル相手のユニットを、持ち主のコマンドゾーンに送ることになります」）", () => {
    let s = smash(vented("SPEC-BEAST-S15", "t"), { battle: [vented("SPEC-BEAST-S15", "t"), inst("SPEC-BP2500", "sub")], hand: [inst("RS-018", "c")], command: releasedCat("MA", 2), power: powerCards(5, "ep") });
    expect(substitutes(s, "RS-018:c")).toContain("SPEC-BP2500:sub");
    s = useNinja(s, "RS-018:c", "SPEC-BP2500:sub");
    expectChoiceFrom(s, "player1", "XG2-056");
    s = resolveAll(accept(s));
    expect(zoneOf(s, "player2", "SPEC-BP2500:sub")).toBe("command");
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-057 ローズオルフェノク", () => {
  const TEXT = "※コールDA 【ラッキークローバー招集】これが自軍エリアにある間、自軍スタートフェイズを終えるとき、自軍ユニットが4体以下なら、これをリリースしてもよい。";

  it("XG2-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-1765）", () => {
    expectCatalogText("XG2-057", TEXT);
    expectUnit("XG2-057", { name: "ローズオルフェノク", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["オルフェノク", "怪人", "男"] });
    expectRarityIn("XG2-057", ["N"]);
  });

  it("XG2-057: ※コールDA — 自軍ラッシュエリアのこれを、DA のユニットをラッシュするためのコマンドとしてホールドできる。DA を持たないユニットには使えない（出典: atwiki/page-1765「※コールDA」・R-KW-CALL-01）", () => {
    const s = rushBoard({ hand: [inst("SPEC-DA0", "h")], rush: [inst("XG2-057", "ro")], command: [], power: [] }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "SPEC-DA0:h");
    expect(r.ok, r.error).toBe(true);
    expect(cardIn(r.state, "player1", "XG2-057:ro")?.commandHeld).toBe(true);
    expect(canStartRush(rushBoard({ hand: [inst("SPEC-OT0", "h")], rush: [inst("XG2-057", "ro")], command: [], power: [] }, {}, EXTRA), "player1", "SPEC-OT0:h")).toBe(false);
  });

  /** 自軍スタートフェイズ（ホールド状態のこれと、ほかの自軍ユニット others 体）を終えるところまで進める。 */
  const startEnd = (others: number) => {
    let s = st(
      { phase: "start", player1: { rush: [held("XG2-057", "ro"), ...Array.from({ length: others }, (_, i) => inst("TST-UNIT-0", `u${i}`))], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } },
      EXTRA,
    );
    for (let i = 0; i < 4 && s.phase === "start" && !s.pendingEffectChoice; i++) {
      const a = legal(s).find((x) => x.playerId === "player1" && (x.type === "return_all_battle_to_rush" || x.type === "draw")) ?? legal(s).find((x) => x.type === "end_phase");
      if (!a) break;
      s = act(s, a);
    }
    return s;
  };

  it("XG2-057: 【ラッキークローバー招集】自軍スタートフェイズを終えるとき、自軍ユニットが4体以下（これを含めて4体）なら、これをリリースするかを選べる（任意）。リリースするとリリース状態になる（出典: atwiki/page-1765「自軍ユニットが4体以下なら、これをリリースしてもよい」・カード評価「自分で自分をリリースできる」）", () => {
    let s = startEnd(3);
    expectChoiceFrom(s, "player1", "XG2-057");
    expect(canSkip(s)).toBe(true);
    s = settle(accept(s));
    expect(cardIn(s, "player1", "XG2-057:ro")?.commandHeld).toBe(false);
  });

  it("XG2-057: 【ラッキークローバー招集】自軍ユニットが5体なら発動しない（ホールド状態のまま）（出典: atwiki/page-1765「自軍ユニットが4体以下なら」）", () => {
    const s = startEnd(4);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-057");
    expect(cardIn(s, "player1", "XG2-057:ro")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG2-058 タイガーアンデッド", () => {
  const TEXT = "※これが自軍捨札にある間、自軍「仮面ライダーレンゲル」はBP+1000される。（この効果は重複しない） 【種のための戦い】これは、これと同じ特徴を1つ以上持つ、これ以外の自軍バトルエリアのユニット1体につき、BP+1000される。";

  it("XG2-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-1766）", () => {
    expectCatalogText("XG2-058", TEXT);
    expectUnit("XG2-058", { name: "タイガーアンデッド", category: "DA", size: "S", bp: 2500, sp: undefined, powerCost: 0, features: ["アンデッド", "獣"] });
    expectRarityIn("XG2-058", ["N"]);
  });

  it("XG2-058: ※ 自軍捨札にある間、自軍「仮面ライダーレンゲル」（XG2-059）は BP+1000（5000）。2枚あっても重複しない（出典: atwiki/page-1766 ※「（この効果は重複しない）」）", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG2-059", "rg")], discard: [inst("XG2-058", "d")] }), "player1", "XG2-059:rg")).toBe(5000);
    expect(bpOf(p1Battle({ battle: [inst("XG2-059", "rg")], discard: [inst("XG2-058", "d"), inst("XG2-058", "d2")] }), "player1", "XG2-059:rg")).toBe(5000);
  });

  it("XG2-058: ※ 敵軍の捨札にあるときは、自軍のレンゲルの BP は変わらない（出典: atwiki/page-1766「自軍捨札にある間」）", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG2-059", "rg")] }, { discard: [inst("XG2-058", "d")] }), "player1", "XG2-059:rg")).toBe(4000);
  });

  it("XG2-058: 【種のための戦い】これと同じ特徴（「獣」か「アンデッド」）を持つ、これ以外の自軍バトルエリアのユニット1体につき BP+1000（2体で4500）（出典: atwiki/page-1766・コメント「バトルエリアに三体ならべられれば4500」）", () => {
    const s = p1Battle({ battle: [inst("XG2-058", "t"), inst("SPEC-BEAST-M", "b"), inst("XG2-060", "sc"), inst("TST-UNIT-0", "n")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG2-058:t")).toBe(4500);
  });

  it("XG2-058: 【種のための戦い】ラッシュエリアのユニット・敵軍のユニットは数えない（出典: atwiki/page-1766「自軍バトルエリアのユニット」）", () => {
    const s = p1Battle({ battle: [inst("XG2-058", "t")], rush: [inst("SPEC-BEAST-M", "b")] }, { battle: [inst("SPEC-BEAST-M", "eb")] }, EXTRA);
    expect(bpOf(s, "player1", "XG2-058:t")).toBe(2500);
  });
});

// ===========================================================================
describe("XG2-059 仮面ライダーレンゲル", () => {
  const TEXT = "【力の誇示】自分の手札をすべて相手に見せてもよい。そうしたとき、見せた枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。";

  it("XG2-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-1767）", () => {
    expectCatalogText("XG2-059", TEXT);
    expectUnit("XG2-059", { name: "仮面ライダーレンゲル", category: ["WB", "DA"], size: "S", bp: 4000, sp: "1/2", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("XG2-059", ["NR"]);
  });

  const rc = () =>
    rcBoard("XG2-059:r", { hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")] }, { battle: [inst("TST-UNIT-0", "x"), inst("SPEC-C2", "c2"), inst("SPEC-C3", "c3")], rush: [inst("SPEC-C2", "r2")] }, EXTRA);
  const unitStep = (s: GameState) => {
    let n = s;
    for (let i = 0; i < 3 && n.pendingEffectChoice && !n.pendingEffectChoice.validInstanceIds.some((id) => id.startsWith("SPEC-") || id.startsWith("TST-UNIT")); i++) n = settle(accept(n));
    return n;
  };

  it("XG2-059: 【力の誇示】RC（ライドオフ）で、自分の手札をすべて相手に見せるかを選べる（任意）（出典: atwiki/page-1767「自分の手札をすべて相手に見せてもよい」・R-KW-RC-01）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG2-059");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-059: 【力の誇示】見せたら、見せた枚数（2枚）以下の必要パワーの数字を持つ敵軍 S ユニット（ラッシュエリアも）から1体選び撃破する（必要パワー3 は選べない）（出典: atwiki/page-1767「見せた枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する」）", () => {
    let s = unitStep(rc());
    expect(choiceIds(s)).toEqual(["SPEC-C2:c2", "SPEC-C2:r2", "TST-UNIT-0:x"]);
    s = resolveAll(pick(s, "SPEC-C2:r2"));
    expect(zoneOf(s, "player2", "SPEC-C2:r2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-060 スカラベアンデッド", () => {
  const TEXT = "【スペード10―タイム】自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりにゲームから除外して、次の効果を発動できる⇒このターンと、次の相手ターン、バトルフェイズは行われない。";

  it("XG2-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-1768）", () => {
    expectCatalogText("XG2-060", TEXT);
    expectUnit("XG2-060", { name: "スカラベアンデッド", category: "DA", size: "S", bp: 3500, sp: undefined, powerCost: 6, features: ["アンデッド", "昆虫"] });
    expectRarityIn("XG2-060", ["N"]);
  });

  const rushed = () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG2-060", "sc")], power: powerCards(6), command: releasedCat("DA", 1) }), "player1", "XG2-060:sc");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG2-060: 【スペード10―タイム】自軍ラッシュフェイズ中にラッシュするとき、ラッシュエリアに出すかわりにゲームから除外するかを選べる（任意）（出典: atwiki/page-1768「ラッシュエリアに出すかわりにゲームから除外して、次の効果を発動できる」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG2-060");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-060: 【スペード10―タイム】除外すると、このターンと次の相手ターンはバトルフェイズが行われない（出典: atwiki/page-1768「このターンと、次の相手ターン、バトルフェイズは行われない」）", () => {
    let s = resolveAll(accept(rushed()));
    expect(exiled(s, "player1", "XG2-060:sc")).toBe(true);
    s = nextPhase(s);
    expect(s.phase).not.toBe("battle");
    s = endTurn(s);
    for (let i = 0; i < 6 && s.activePlayer === "player2" && s.phase !== "battle" && s.phase !== "end"; i++) {
      const a = legal(s).find((x) => x.playerId === "player2" && (x.type === "end_phase" || x.type === "draw" || x.type === "return_all_battle_to_rush"));
      if (!a) break;
      s = act(s, a);
    }
    expect(s.phase).not.toBe("battle");
  });

  it("XG2-060: 【スペード10―タイム】除外しなければ、通常どおりラッシュエリアに出てバトルフェイズも行われる（出典: atwiki/page-1768「発動できる」）", () => {
    let s = rushed();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-060") s = skip(s);
    s = settle(s);
    expect(zoneOf(s, "player1", "XG2-060:sc")).toBe("rush");
    expect(nextPhase(s).phase).toBe("battle");
  });
});

// ===========================================================================
describe("XG2-061 リョクオオザル", () => {
  const TEXT = "※カウンター 敵軍ユニットにアタックされたとき発動できる⇒このターン、すべての自軍ユニットは、カテゴリを2つ以上持つ自軍コマンド1つにつきBP+1000される。";

  it("XG2-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-1769）", () => {
    expectCatalogText("XG2-061", TEXT);
    expectOpStats("XG2-061", { name: "リョクオオザル", category: "MA", powerCost: 0 });
    expectRarityIn("XG2-061", ["N"]);
  });

  it("XG2-061: カタログの特徴 — オペレーションだが特徴「ディスクアニマル」を持つ（出典: atwiki/page-1769「特徴：ディスクアニマル」）", () => {
    expect((DEFS["XG2-061"] as { features?: string[] }).features ?? []).toEqual(["ディスクアニマル"]);
  });

  const attacked = () =>
    attack(
      st({
        activePlayer: "player2",
        player1: { battle: [inst("TST-UNIT-0", "u")], rush: [inst("TST-UNIT-0", "u2")], hand: [inst("XG2-061", "ok")], command: [released("TST-OP-WB-ET", "m1"), released("TST-OP-WB-ET", "m2"), ...releasedCat("MA", 1)], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      }),
      "TST-UNIT-7:atk",
      "TST-UNIT-0:u",
      "player2",
    );

  it("XG2-061: ※カウンター — 敵軍ユニットにアタックされたとき使える（公式Q&A: マークの「タッグ」は誤植で、カウンターとして扱う）（出典: atwiki/page-1769「敵軍ユニットにアタックされたとき発動できる」・Q1「カウンターオペレーションのカードとして扱って下さい」）", () => {
    expect(canCounter(attacked(), "XG2-061:ok")).toBe(true);
  });

  it("XG2-061: 使うと、このターン、すべての自軍ユニット（ラッシュエリアも）は、カテゴリを2つ以上持つ自軍コマンド1つにつき BP+1000（2つで BP3000）（出典: atwiki/page-1769「すべての自軍ユニットは、カテゴリを2つ以上持つ自軍コマンド1つにつきBP+1000される」）", () => {
    const s = useCounter(attacked(), "XG2-061:ok");
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(3000);
    expect(bpOf(s, "player1", "TST-UNIT-0:u2")).toBe(3000);
  });
});
