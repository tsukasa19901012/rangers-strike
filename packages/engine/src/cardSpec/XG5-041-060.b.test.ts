/**
 * カード別スペック: XG5-048〜XG5-054（クロスギャザー XG5 ザ・チケットブレイカー パーフェクター〜仮面ライダーディケイドCF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない（同じ名前の RK のカードの項だけ）。atwiki に転載された公式 Q&A: XG5-050 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-CALL-01・R-KW-MORPH-01・R-KW-RESIST-01・R-KW-PERM-01）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  endPhase,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  beltUsed,
  faceUp,
  fill,
  heldCard,
  inst,
  leadTestsFor,
  legal,
  morphCandidates,
  passTurnTo,
  payableFor,
  pick,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skipFrom,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./XG5-041-060.helpers";

const SP1E = sUnit("SPEC-SP1-E", { category: "WB", bp: 1000, sp: 1 });
const NOSP = sUnit("SPEC-NOSP-E", { category: "WB", bp: 1000, sp: undefined });
const E5000 = sUnit("SPEC-E5000", { category: "WB", bp: 5000 });
const E6000 = sUnit("SPEC-E6000", { category: "WB", bp: 6000 });
const DA_UNIT = sUnit("SPEC-DA-UNIT", { category: "DA", bp: 1000, powerCost: 2 });
const EXTRA = [SP1E, NOSP, E5000, E6000, DA_UNIT];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-048 パーフェクター", () => {
  const TEXT =
    "自軍コマンドゾーンから、特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。そうしたとき、自軍山札の上か下から1枚ひいて、自軍コマンドゾーンにホールド状態で置く。";

  it("XG5-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-2207）", () => {
    expectCatalogText("XG5-048", TEXT);
    expectOpStats("XG5-048", { name: "パーフェクター", category: "ET", powerCost: 3 });
    expectRarityIn("XG5-048", ["N"]);
  });

  // 自軍コマンドゾーン: RK-099 アポロガイスト（改造人間・必要パワー3）、XG5-049 再生アポロガイスト（改造人間・5+・追加条件あり）、TST-UNIT-0（改造人間を持たない）。パワー4。
  const used = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    beltUsed("XG5-048", "ET", 3, { command: [released("RK-099", "ap"), released("XG5-049", "ra"), released("TST-UNIT-0", "u")], power: powerCards(4), deck: deckCards(5, "d"), ...p1 }, {}, EXTRA);

  it("XG5-048: 自軍コマンドゾーンの「改造人間」を持つ S ユニットのカードのうち、必要パワーと追加条件を満たすものを選べる（任意）（出典: atwiki/page-2207「特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-048");
    expect(choiceIds(s)).toEqual(["RK-099:ap"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-048: 出したとき、自軍山札の上か下の1枚を自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-2207「そうしたとき、自軍山札の上か下から1枚ひいて、自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(used(), "RK-099:ap"));
    expect(zoneOf(s, "player1", "RK-099:ap")).toBe("rush");
    const moved = ["TST-OP:d0", "TST-OP:d4"].filter((id) => zoneOf(s, "player1", id) === "command");
    expect(moved.length).toBe(1);
    expect(cardIn(s, "player1", moved[0]!)?.commandHeld).toBe(true);
  });

  it("XG5-048: 出さなければ山札のカードは置かない（出典: atwiki/page-2207「そうしたとき」）", () => {
    const s = skipFrom(used(), "XG5-048");
    expect(s.players.player1.command.length).toBe(4); // 3枚＋支払いに使った ET のコマンド
    expect(s.players.player1.deck.length).toBe(5);
  });
});

// ===========================================================================
describe("XG5-049 再生アポロガイスト", () => {
  const TEXT =
    "※レジスト 【アポロマグナム】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、これは次の相手ターン終了時まで次の能力を得る⇒BP+4000";

  it("XG5-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-2271）", () => {
    expectCatalogText("XG5-049", TEXT);
    expectMultiStats("XG5-049", { name: "再生アポロガイスト", category: ["DA"], size: "S", bp: 5000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["GOD", "男", "改造人間"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-049", ["R"]);
  });

  it("XG5-049: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2271「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-049", "r")] }, "XG5-049:r"))).toBe(true);
  });

  const mk = (partner: ReturnType<typeof inst>) => rushBoard({ hand: [inst("XG5-049", "ra")], rush: [partner], power: powerCards(5), command: releasedCat("DA", 1) });

  it("XG5-049: 追加条件 — ホールド状態の自軍「アポロガイスト」（RK-099）1体を捨札にし、パワー5でラッシュできる（出典: atwiki/page-2271「追加条件：ホールド状態の自軍「アポロガイスト」1体を捨札にする」）", () => {
    const r = rushFromHand(mk(heldCard("RK-099", "ap")), "player1", "XG5-049:ra", { materials: ["RK-099:ap"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-049:ra")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-099:ap")).toBe("discard");
  });

  it("XG5-049: 追加条件 — リリース状態の「アポロガイスト」ではラッシュできない（出典: atwiki/page-2271「ホールド状態の」）", () => {
    const r = rushFromHand(mk(inst("RK-099", "ap")), "player1", "XG5-049:ra", { materials: ["RK-099:ap"] });
    expect(r.ok && zoneOf(r.state, "player1", "XG5-049:ra") === "rush").toBe(false);
  });

  const entered = () => enter(battle({ rush: [inst("XG5-049", "ra")] }), "XG5-049:ra");

  it("XG5-049:【アポロマグナム】— 自軍ターン中にバトルエリアに出たとき、これをホールドするかを選べる（任意）（出典: atwiki/page-2271「このユニットをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-049");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-049:【アポロマグナム】— ホールドすれば、次の相手ターン終了時まで BP+4000（相手ターン中も BP9000）（出典: atwiki/page-2271「これは次の相手ターン終了時まで次の能力を得る⇒BP+4000」）", () => {
    let s = resolveAll(entered());
    expect(cardIn(s, "player1", "XG5-049:ra")?.commandHeld).toBe(true);
    expect(bpOf(s, "player1", "XG5-049:ra")).toBe(9000);
    s = passTurnTo(s, "player2", "battle");
    expect(bpOf(s, "player1", "XG5-049:ra")).toBe(9000);
  });

  it("XG5-049:【アポロマグナム】— ホールドしなければ BP は上がらない（出典: atwiki/page-2271「そうしたとき」）", () => {
    const s = skipFrom(entered(), "XG5-049");
    expect(bpOf(s, "player1", "XG5-049:ra")).toBe(5000);
  });
});

// ===========================================================================
describe("XG5-050 仮面ライダー装甲響鬼", () => {
  const TEXT =
    "※レジスト 【語る背中】 これが自軍エリアにある間、自分か相手がラッシュフェイズを終えるとき、「SP1」以上の敵軍ユニットがあれば、そのターン中、これは次の能力を得る。⇒BP+3000され、このターンを終えるときホールド状態なら、リリースしてもよい。";

  it("XG5-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-2254）", () => {
    expectCatalogText("XG5-050", TEXT);
    expectMultiStats("XG5-050", { name: "仮面ライダー装甲響鬼", category: ["MA"], size: "S", bp: 4000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "猛士", "装甲声刃"] });
    expectRarityIn("XG5-050", ["SR"]);
  });

  it("XG5-050: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2254「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-050", "r")] }, "XG5-050:r"))).toBe(true);
  });

  const ownEnd = (enemy: string, me = inst("XG5-050", "hb")) => settle(endPhase(rushBoard({ rush: [me], deck: deckCards(5) }, { rush: [inst(enemy, "e")] }, EXTRA)));

  it("XG5-050:【語る背中】— 自分がラッシュフェイズを終えるとき「SP1」の敵軍ユニットがあれば、そのターン中 BP+3000（BP7000）（出典: atwiki/page-2254「自分か相手がラッシュフェイズを終えるとき、「SP1」以上の敵軍ユニットがあれば、そのターン中、これは次の能力を得る。⇒BP+3000」）", () => {
    const s = ownEnd("SPEC-SP1-E");
    expect(s.phase).toBe("battle");
    expect(bpOf(s, "player1", "XG5-050:hb")).toBe(7000);
  });

  it("XG5-050:【語る背中】—「SP1」以上の敵軍ユニットがなければ上がらない（出典: atwiki/page-2254「「SP1」以上の敵軍ユニットがあれば」）", () => {
    expect(bpOf(ownEnd("SPEC-NOSP-E"), "player1", "XG5-050:hb")).toBe(4000);
  });

  it("XG5-050:【語る背中】— 相手がラッシュフェイズを終えるときも、そのターン中 BP+3000（出典: atwiki/page-2254「自分か相手が」）", () => {
    let s = st({ phase: "rush", activePlayer: "player2", player1: { battle: [inst("XG5-050", "hb")], deck: deckCards(5) }, player2: { rush: [inst("SPEC-SP1-E", "e")], deck: deckCards(5, "e") } }, EXTRA);
    s = settle(endPhase(s, "player2"));
    expect(s.phase).toBe("battle");
    expect(bpOf(s, "player1", "XG5-050:hb")).toBe(7000);
  });

  it("XG5-050:【語る背中】— 能力を得たターンを終えるときホールド状態なら、リリースするかを選べる（出典: atwiki/page-2254「このターンを終えるときホールド状態なら、リリースしてもよい」）", () => {
    let s = ownEnd("SPEC-SP1-E", heldCard("XG5-050", "hb"));
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId !== "XG5-050" && s.activePlayer === "player1"; i++) {
      const end = legal(s).find((a) => a.type === "end_phase" && a.playerId === "player1");
      if (!end) break;
      s = settle(endPhase(s));
    }
    expectChoiceFrom(s, "player1", "XG5-050");
  });

  it.todo("XG5-050: 公式Q&A — 同じターンにラッシュフェイズを2回終えれば（RS-028 キリンレンジャー【天時星・時間返し】）合計 BP+6000（出典: atwiki/page-2254 Q1「はい、そのとおりです」）— ラッシュフェイズに戻す効果を本範囲の盤面で組めず、テストできない");
});

// ===========================================================================
describe("XG5-051 仮面ライダーカブトHF", () => {
  const TEXT =
    "※これは相手に選ばれない。 ※これは、カード名に「カブト」「ザビー」「ドレイク」「サソード」を含むオモテ向きの自軍パワーがそれぞれあれば、SP1になる。 【天の道】これをラッシュしたとき、自軍パワーゾーンのオモテ向きのカードから、OTを持つ常駐オペレーションのカードを1枚選び自軍常駐置き場に配置してもよい。";

  it("XG5-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-2258）", () => {
    expectCatalogText("XG5-051", TEXT);
    expectMultiStats("XG5-051", { name: "仮面ライダーカブトHF", category: ["OT"], size: "S", bp: 3000, sp: "special", powerCost: 7, comboNumber: undefined, features: ["仮面ライダー", "男", "加速"] });
    expectRarityIn("XG5-051", ["SR"]);
  });

  it("XG5-051: ※ — 相手の効果に選ばれない（相手の XG5-037【レッドブレイク】の候補に入らない）（出典: atwiki/page-2258「これは相手に選ばれない」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("XG5-051", "kb"), inst("TST-UNIT-0", "o")], deck: deckCards(5) }, player2: { rush: [inst("XG5-037", "gr")], deck: deckCards(5, "e") } }, EXTRA);
    s = enter(s, "XG5-037:gr", "player2");
    expectChoiceFrom(s, "player2", "XG5-037");
    expect(choiceIds(s)).toContain("TST-UNIT-0:o");
    expect(choiceIds(s)).not.toContain("XG5-051:kb");
  });

  // RK-300 カブトエクステンダー・RK-056 仮面ライダーザビーMF・RK-135 仮面ライダードレイクMF・RK-294 仮面ライダーサソードMF。
  const NAMES = () => [faceUp("RK-300", "k"), faceUp("RK-056", "z"), faceUp("RK-135", "d"), faceUp("RK-294", "s")];
  const spWith = (power: ReturnType<typeof inst>[]) => spOf(battle({ battle: [inst("XG5-051", "kb")], power }), "player1", "XG5-051:kb");

  it("XG5-051: ※ — カード名に「カブト」「ザビー」「ドレイク」「サソード」を含むオモテ向きの自軍パワーがそれぞれあれば SP1（出典: atwiki/page-2258「それぞれあれば、SP1になる」）", () => {
    expect(spWith(NAMES())).toBe(1);
  });

  it("XG5-051: ※ — 1つ欠けるか（「サソード」がない）、ウラ向き（ダメージ）なら SP を持たない（出典: atwiki/page-2258「オモテ向きの自軍パワーがそれぞれあれば」）", () => {
    expect(spWith(NAMES().slice(0, 3))).toBe(0);
    expect(spWith([...NAMES().slice(0, 3), { ...inst("RK-294", "s"), faceDown: true }])).toBe(0);
  });

  /** 手札のカブトHF をラッシュする。パワーゾーンに RK-021 クロックアップ（OT の常駐）・PK-010 ウエイクアップ！（MA の常駐）・TST-OP-OT（常駐でない OT）をオモテ向き。 */
  const rushed = () => {
    const s0 = rushBoard({ hand: [inst("XG5-051", "kb")], power: [faceUp("RK-021", "cu"), faceUp("PK-010", "wu"), faceUp("TST-OP-OT", "ot"), ...powerCards(4)], command: releasedCat("OT", 1) }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "XG5-051:kb");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG5-051:【天の道】— ラッシュしたとき、自軍パワーゾーンのオモテ向きの、OT を持つ常駐オペレーションのカードを選べる（任意）（出典: atwiki/page-2258「自軍パワーゾーンのオモテ向きのカードから、OTを持つ常駐オペレーションのカードを1枚選び自軍常駐置き場に配置してもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG5-051");
    expect(choiceIds(s)).toEqual(["RK-021:cu"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-051:【天の道】— 選んだカードは自軍常駐置き場に配置される（出典: atwiki/page-2258「自軍常駐置き場に配置してもよい」・R-KW-PERM-01）", () => {
    const s = resolveAll(pick(rushed(), "RK-021:cu"), []);
    expect(zoneOf(s, "player1", "RK-021:cu")).toBe("operation");
  });
});

// ===========================================================================
describe("XG5-052 仮面ライダー電王CF", () => {
  const TEXT =
    "※モーフ ※これは毎ターン可能ならバトルエリアに出る。 【俺達の必殺技】自軍ターン中、これがバトルで敵軍ユニットを撃破したとき、撃破したユニットを捨札にするかわりに持ち主のパワーゾーンに送ってもよい。そうしたとき、相手に1点ダメージを与える。";

  it("XG5-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-2226）", () => {
    expectCatalogText("XG5-052", TEXT);
    expectMultiStats("XG5-052", { name: "仮面ライダー電王CF", category: ["OT"], size: "S", bp: 6000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("XG5-052", ["SR"]);
  });

  it("XG5-052: ※モーフ — 敵軍ユニットが通常の手段でラッシュされたとき、特徴が完全に同じオモテ向きのユニットカード（自軍パワーゾーンの RK-061 仮面ライダー電王RF）と置き換えられる（出典: atwiki/page-2226「※モーフ」・atwiki/page-1294・R-KW-MORPH-01）", () => {
    const s = enemyRushes({ rush: [inst("XG5-052", "dn")], power: [faceUp("RK-061", "rf"), faceUp("RK-056", "z")] }, "TST-UNIT-0:x");
    expect(morphCandidates(s)).toEqual(["RK-061:rf"]);
  });

  it("XG5-052: ※ — 自軍バトルフェイズにラッシュエリアにあり出られるなら、出ずにフェイズを終えられない（出典: atwiki/page-2226「これは毎ターン可能ならバトルエリアに出る」）", () => {
    const s = battle({ rush: [inst("XG5-052", "dn")] });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(false);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG5-052:dn")).toBe(true);
  });

  const won = () => settle(attack(enter(battle({ rush: [inst("XG5-052", "dn")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG5-052:dn"), "XG5-052:dn", "TST-UNIT-0:e"));

  it("XG5-052:【俺達の必殺技】— 自軍ターン中、バトルで敵軍ユニットを撃破したとき、捨札にするかわりに持ち主のパワーゾーンに送るかを選べる（任意）（出典: atwiki/page-2226「撃破したユニットを捨札にするかわりに持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = won();
    expectChoiceFrom(s, "player1", "XG5-052");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-052:【俺達の必殺技】— 送れば、撃破したユニットは持ち主のパワーゾーンに置かれ、相手に1点ダメージ（出典: atwiki/page-2226「そうしたとき、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(won());
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG5-052:【俺達の必殺技】— 送らなければ捨札になり、ダメージはない（出典: atwiki/page-2226「そうしたとき」）", () => {
    const s = skipFrom(won(), "XG5-052");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG5-053 仮面ライダーキバEF", () => {
  const TEXT =
    "※コールDA 【ファイナルザンバット斬】自軍ターン中、これがバトルエリアに出たとき、特徴「怪人」を持つ自軍ユニットを1体選びホールドするか、特徴「怪人」を持つ自軍コマンドを1つ選びホールドしてもよい。そうしたとき、BP5000以下の敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG5-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-2259）", () => {
    expectCatalogText("XG5-053", TEXT);
    expectMultiStats("XG5-053", { name: "仮面ライダーキバEF", category: ["MA"], size: "S", bp: 5000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "魔皇力"] });
    expectRarityIn("XG5-053", ["SR"]);
  });

  it("XG5-053: ※コールDA — 自軍ラッシュエリアのこれを、DA のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-2259「※コールDA」・R-KW-CALL-01）", () => {
    const s = rushBoard({ hand: [inst("SPEC-DA-UNIT", "u")], rush: [inst("XG5-053", "kv")], command: releasedCat("DA", 1, "dc"), power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-DA-UNIT:u")).toContain("XG5-053:kv");
  });

  // 自軍: ラッシュエリアに RK-093 蜘蛛男（怪人）・TST-UNIT-0、コマンドゾーンに RK-096 ハサミジャガー（怪人・リリース状態）・TST-OP。敵軍: BP5000・BP6000。
  const entered = (p1: Partial<GameState["players"]["player1"]> = { rush: [inst("XG5-053", "kv"), inst("RK-093", "k"), inst("TST-UNIT-0", "o")], command: [released("RK-096", "kc"), released("TST-OP", "c")] }) =>
    enter(battle(p1, { rush: [inst("SPEC-E5000", "a")], battle: [inst("SPEC-E6000", "b")] }), "XG5-053:kv");

  it("XG5-053:【ファイナルザンバット斬】— 自軍ターン中に出たとき、「怪人」の自軍ユニットか自軍コマンドを選んでホールドできる（任意）（出典: atwiki/page-2259「特徴「怪人」を持つ自軍ユニットを1体選びホールドするか、特徴「怪人」を持つ自軍コマンドを1つ選びホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-053");
    expect([...choiceIds(s)].sort()).toEqual(["RK-093:k", "RK-096:kc"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-053:【ファイナルザンバット斬】— ホールドしたとき、BP5000以下の敵軍ユニットを選び、持ち主のパワーゾーンにダメージにして置く（BP6000 は選べない）（出典: atwiki/page-2259「そうしたとき、BP5000以下の敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = pick(entered(), "RK-096:kc");
    expect(cardIn(s, "player1", "RK-096:kc")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "XG5-053");
    expect(choiceIds(s)).toEqual(["SPEC-E5000:a"]);
    s = resolveAll(pick(s, "SPEC-E5000:a"));
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E5000:a")?.faceDown).toBe(true);
  });

  it("XG5-053:【ファイナルザンバット斬】—「怪人」のユニット・コマンドがなければ何も起きない（出典: atwiki/page-2259「そうしたとき」）", () => {
    const s = resolveAll(entered({ rush: [inst("XG5-053", "kv"), inst("TST-UNIT-0", "o")], command: [released("TST-OP", "c")] }));
    expect(zoneOf(s, "player2", "SPEC-E5000:a")).toBe("rush");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG5-054 仮面ライダーディケイドCF", () => {
  const TEXT = "※リードOT 【歩く完全ライダー図鑑】これは、自軍パワーゾーンのオモテ向きのカードに、特徴「仮面ライダー」を持つ同名のカードが3枚以上あれば、「SP1」になる。";

  it("XG5-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-2244）", () => {
    expectCatalogText("XG5-054", TEXT);
    expectMultiStats("XG5-054", { name: "仮面ライダーディケイドCF", category: ["OT"], size: "S", bp: 4000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ディケイドライバー"] });
    expectRarityIn("XG5-054", ["NR"]);
  });

  leadTestsFor("XG5-054", "OT", "atwiki/page-2244");

  const spAt1 = (power: ReturnType<typeof inst>[]) => spOf(enter(battle({ rush: [inst("XG5-054", "dc")], power }), "XG5-054:dc"), "player1", "XG5-054:dc");

  it("XG5-054:【歩く完全ライダー図鑑】— オモテ向きの自軍パワーに「仮面ライダー」を持つ同名のカード（仮面ライダーザビーMF）が3枚あれば、1番目でも「SP1」（出典: atwiki/page-2244「特徴「仮面ライダー」を持つ同名のカードが3枚以上あれば、「SP1」になる」）", () => {
    expect(spAt1([faceUp("RK-056", "a"), faceUp("RK-056", "b"), faceUp("XG1-073", "c")])).toBe(1);
  });

  it("XG5-054:【歩く完全ライダー図鑑】— 同名が2枚（3枚目がウラ向き）なら、1番目では SP を持たない（出典: atwiki/page-2244「オモテ向きのカードに…3枚以上」）", () => {
    expect(spAt1([faceUp("RK-056", "a"), faceUp("RK-056", "b"), { ...inst("RK-056", "c"), faceDown: true }])).toBe(0);
  });

  it("XG5-054: SP1/4 — バトルエリアの4番目にあれば SP1（出典: atwiki/page-2244「SP：1/4」・R-STK-03）", () => {
    const s = enter(battle({ battle: fill(3), rush: [inst("XG5-054", "dc")] }), "XG5-054:dc");
    expect(spOf(s, "player1", "XG5-054:dc")).toBe(1);
  });
});
