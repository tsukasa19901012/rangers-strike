/**
 * カード別スペック: XG3-077〜XG3-083（クロスギャザー ザ・Wインパクト アギトトルネイダー〜宇宙忍デモスト。XG3-082 はカタログにない）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. 公式FAQ・エラッタ: 本範囲のカードの項はない（grnrngr の公式FAQ・docs/rules/08-errata.md・atwiki 転載の公式 Q&A のいずれにもない）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-MORPH 系・RC・ライド）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import { activate } from "./revealGate.helpers";
import type { GameState } from "../types/game";
import {
  canEnter,
  canSelfRush,
  canSkip,
  canStartRush,
  choiceIds,
  DEFS,
  deckCards,
  enemyRushes,
  enter,
  expectCatalogText,
  expectRarityIn,
  expectUnitStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  heldUnit,
  inst,
  lineUp,
  morphCandidates,
  mount,
  passEntry,
  PLAIN_VEHICLE,
  powerCards,
  rcEnter,
  refsOf,
  releasedCat,
  resolveAll,
  rideOff,
  rushBoard,
  rushFromHand,
  rushVia,
  selfRush,
  spOf,
  st,
  sUnit,
  targetsOf,
  useRef,
  zoneOf,
} from "./XG3-063-083.helpers";

const ENEMY = sUnit("SPEC-EN", { category: "WB", bp: 1000 });
const NOSP = sUnit("SPEC-NOSP", { bp: 1000, sp: undefined });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C6 = sUnit("SPEC-C6", { bp: 1000, powerCost: 6 });
const C7 = sUnit("SPEC-C7", { bp: 1000, powerCost: 7 });
const EXTRA = [ENEMY, NOSP, C3, C6, C7, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const rc = (rider: string, p1: P1 = {}, p2: P2 = {}) => rcEnter(rider, p1, p2, EXTRA);
const W_FORMS = ["XG3-079", "XG3-080", "XG3-081"] as const;

/** ※モーフ: 敵軍ユニットがラッシュされたとき、特徴が完全一致する（仮面ライダー／男／ダブルドライバー）自軍コマンドゾーンのユニットカードと置き換えられる。 */
function morphTest(id: (typeof W_FORMS)[number], page: string) {
  const others = W_FORMS.filter((x) => x !== id);
  it(`${id}: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（${others.join("・")}・XP-014）と置き換えられる（特徴が違う XG3-076 は選べない）（出典: ${page}「※モーフ」「（モーフ可能なユニット）」・R-KW-MORPH 系）`, () => {
    const s = enemyRushes(
      { battle: [inst(id, "w")], command: [...others.map((o, i) => inst(o, `c${i}`)), inst("XP-014", "cm"), inst("XG3-076", "ag")] },
      "SPEC-EN:e",
      EXTRA,
    );
    expect(morphCandidates(s)).toEqual([...others.map((o, i) => `${o}:c${i}`), "XP-014:cm"].sort());
  });
}

// ===========================================================================
describe("XG3-077 アギトトルネイダー", () => {
  const TEXT =
    "※自分が「仮面ライダーアギト」をラッシュしたとき、自軍エリアに「アギトトルネイダー」があれば1体選んで手札に戻す。 ※これにライドしているユニットは、「仮面ライダーディケイド」なら「SP1」になる。 【ファイナルアタックライド】これがライドされたままなら、このビークルからコンビネーションするSユニットは次の能力を得る⇒これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("XG3-077: カタログ本文・スペックが出典と一致（出典: atwiki/page-1935「必要パワー：4+」「追加条件：自軍「仮面ライダーアギト」1体を手札に戻す」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-077", TEXT);
    expectVehicleStats("XG3-077", { name: "アギトトルネイダー", category: "MA", powerCost: "4+", size: "S", features: ["車両", "賢者の石", "FFR"] });
    expect(DEFS["XG3-077"]!.rushAdditionalCondition?.conditionId).toBe("return_named_to_hand");
    expect(DEFS["XG3-077"]!.rushAdditionalCondition?.partnerName).toBe("仮面ライダーアギト");
    expectRarityIn("XG3-077", ["N"]);
  });

  it("XG3-077: 追加条件 — 自軍「仮面ライダーアギト」1体を手札に戻し、パワー4でラッシュできる（出典: atwiki/page-1935「必要パワー：4+」「追加条件：自軍「仮面ライダーアギト」1体を手札に戻す」）", () => {
    const r = rushVia(board({ hand: [inst("XG3-077", "t")], rush: [inst("XG3-076", "ag")], power: powerCards(4), command: releasedCat("MA", 1) }), "player1", "XG3-077:t");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state, ["XG3-076:ag"]);
    expect(zoneOf(s, "player1", "XG3-077:t")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-076:ag")).toBe("hand");
  });

  it("XG3-077: 追加条件 — 自軍に「仮面ライダーアギト」がいなければラッシュできない（出典: atwiki/page-1935「追加条件：自軍「仮面ライダーアギト」1体を手札に戻す」）", () => {
    expect(canStartRush(board({ hand: [inst("XG3-077", "t")], power: powerCards(6), command: releasedCat("MA", 1) }), "player1", "XG3-077:t")).toBe(false);
  });

  it("XG3-077: ※ 自分が「仮面ライダーアギト」（XG3-076）をラッシュしたとき、自軍エリアの「アギトトルネイダー」を1体選んで手札に戻す（出典: atwiki/page-1935「自軍エリアに「アギトトルネイダー」があれば1体選んで手札に戻す」・カード評価「仮面ライダーアギトのテキストを使いまわす為に使うことも可能」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG3-076", "ag")], rush: [inst("XG3-077", "t")], power: powerCards(6), command: releasedCat("MA", 2) }), "player1", "XG3-076:ag");
    expect(r.ok, r.error).toBe(true);
    expect(choiceIds(r.state)).toEqual(["XG3-077:t"]);
    const s = resolveAll(r.state, ["XG3-077:t"]);
    expect(zoneOf(s, "player1", "XG3-077:t")).toBe("hand");
    expect(zoneOf(s, "player1", "XG3-076:ag")).toBe("rush");
  });

  it("XG3-077: ※ ライドしているユニットが「仮面ライダーディケイド」（XG1-077。SP なし）なら「SP1」になる（出典: atwiki/page-1935「これにライドしているユニットは、「仮面ライダーディケイド」なら「SP1」になる」）", () => {
    const s = rideOff(mount(st({ player1: { rush: [inst("XG3-077", "t"), inst("XG1-077", "d")], deck: deckCards(3) } }, EXTRA), "XG1-077:d", "XG3-077:t"), false);
    expect(zoneOf(s, "player1", "XG1-077:d")).toBe("battle");
    expect(spOf(s, "player1", "XG1-077:d")).toBe(1);
  });

  const ridden = (off: boolean) => {
    let s = st(
      { player1: { rush: [inst("XG3-077", "t"), inst("XG1-077", "d"), inst("TST-UNIT-0", "nx")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") } },
      EXTRA,
    );
    s = rideOff(mount(s, "XG1-077:d", "XG3-077:t"), off);
    // XG1-077【ライドブッカー】は発動の確認から（rules/revealGate.ts）
    if (s.pendingEffectChoice) s = resolveAll(activate(s));
    return enter(passEntry(s), "TST-UNIT-0:nx");
  };

  it("XG3-077:【ファイナルアタックライド】— ライドされたままなら、このビークルからコンビネーションする S ユニットは敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1935「このビークルからコンビネーションするSユニットは次の能力を得る⇒これは敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = ridden(false);
    expect(zoneOf(s, "player1", "TST-UNIT-0:nx")).toBe("battle");
    expect(targetsOf(s, "TST-UNIT-0:nx")).toContain("TST-UNIT-0:r");
  });

  it("XG3-077:【ファイナルアタックライド】— ライドオフしたら、コンビネーションする S ユニットは敵軍ラッシュエリアにアタックできない（出典: atwiki/page-1935「これがライドされたままなら」・カード評価「ライドオフすると能力が使えない」）", () => {
    const s = ridden(true);
    expect(zoneOf(s, "player1", "TST-UNIT-0:nx")).toBe("battle");
    expect(targetsOf(s, "TST-UNIT-0:nx")).not.toContain("TST-UNIT-0:r");
  });
});

// ===========================================================================
describe("XG3-078 マシンハードボイルダー", () => {
  const TEXT =
    "※これが自分の手札にある間、自軍ラッシュフェイズ中、特徴「ダブルドライバー」を持つ自軍コマンドをホールドしてから、これを自軍ラッシュエリアに出してもよい。 【リモコン操作】特徴「ダブルドライバー」を持つ自軍ユニットがあれば、このビークルはライドされていなくてもバトルエリアに出ることができる。";

  it("XG3-078: カタログ本文・スペックが出典と一致（出典: atwiki/page-1936「カテゴリ：アーステクノロジー／ダークアライアンス」「必要パワー：1」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-078", TEXT);
    const d = DEFS["XG3-078"]!;
    expect(d.name).toBe("マシンハードボイルダー");
    expect(d.type).toBe("vehicle");
    expect(d.category).toEqual(["ET", "DA"]);
    expect(d.powerCost).toBe(1);
    expect(d.size).toBe("S");
    expect(d.features ?? []).toEqual(["メカ", "車両"]);
    expect(d.rushAdditionalCondition).toBeUndefined();
    expectRarityIn("XG3-078", ["N"]);
  });

  it("XG3-078: ※ 手札にある間、自軍ラッシュフェイズ中、特徴「ダブルドライバー」を持つ自軍コマンド（XG3-079）をホールドして、パワーなしで自軍ラッシュエリアに出せる（出典: atwiki/page-1936「特徴「ダブルドライバー」を持つ自軍コマンドをホールドしてから、これを自軍ラッシュエリアに出してもよい」・カード評価「コマンドのカテゴリを無視して出せる」）", () => {
    const s0 = board({ hand: [inst("XG3-078", "m")], command: [inst("XG3-079", "cmd")], power: [] });
    const s = resolveAll(useRef(s0, "XG3-078:m"), ["XG3-079:cmd"]);
    expect(zoneOf(s, "player1", "XG3-078:m")).toBe("rush");
    expect(s.players.player1.command.find((c) => c.instanceId === "XG3-079:cmd")?.commandHeld).toBe(true);
  });

  it("XG3-078: ※ 特徴「ダブルドライバー」を持つコマンドがなければ、パワーなしでは出せない（出典: atwiki/page-1936「特徴「ダブルドライバー」を持つ自軍コマンドをホールドしてから」）", () => {
    const s = board({ hand: [inst("XG3-078", "m")], command: [inst("TST-UNIT-0", "cmd"), ...releasedCat("ET", 1)], power: [] });
    expect(refsOf(s, "XG3-078:m")).toEqual([]);
  });

  it("XG3-078:【リモコン操作】— 特徴「ダブルドライバー」を持つ自軍ユニット（XG3-079）がいれば、ライドされていなくてもバトルエリアに出られる（出典: atwiki/page-1936「このビークルはライドされていなくてもバトルエリアに出ることができる」）", () => {
    const s = st({ player1: { rush: [inst("XG3-078", "m")], battle: [inst("XG3-079", "lj")], deck: deckCards(3) } }, EXTRA);
    expect(canEnter(s, "XG3-078:m")).toBe(true);
  });

  it("XG3-078:【リモコン操作】— 特徴「ダブルドライバー」を持つ自軍ユニットがいなければ、ライドされずにはバトルエリアに出られない（出典: atwiki/page-1936「特徴「ダブルドライバー」を持つ自軍ユニットがあれば」）", () => {
    const s = st({ player1: { rush: [inst("XG3-078", "m")], battle: [inst("TST-UNIT-0", "u")], deck: deckCards(3) } }, EXTRA);
    expect(canEnter(s, "XG3-078:m")).toBe(false);
  });
});

// ===========================================================================
describe("XG3-079 仮面ライダーW・LJ", () => {
  it("XG3-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-2003「BP：3000」「SP：1/3」「CN：RC」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-079", "※モーフ 【幻想と切札】これは敵軍ラッシュエリアのユニットにアタックできる。");
    expectUnitStats("XG3-079", { name: "仮面ライダーW・LJ", category: ["MA", "DA"], size: "S", bp: 3000, sp: "1/3", powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG3-079", ["R"]);
  });

  morphTest("XG3-079", "atwiki/page-2003");

  it("XG3-079:【幻想と切札】— 敵軍ラッシュエリアのユニットにアタックできる（ほかの自軍ユニットはできない）（出典: atwiki/page-2003「これは敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const enemy: P2 = { battle: [inst("TST-UNIT-0", "e")], rush: [inst("TST-UNIT-0", "r")] };
    expect(targetsOf(lineUp(["XG3-079:lj"], {}, enemy, EXTRA), "XG3-079:lj")).toEqual(["TST-UNIT-0:e", "TST-UNIT-0:r"]);
    expect(targetsOf(lineUp(["TST-UNIT-0:u"], {}, enemy, EXTRA), "TST-UNIT-0:u")).toEqual(["TST-UNIT-0:e"]);
  });
});

// ===========================================================================
describe("XG3-080 仮面ライダーW・HJ", () => {
  it("XG3-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-1957「BP：4000」「SP：1/2」「CN：RC」「レアリティ：スーパーレア」）", () => {
    expectCatalogText(
      "XG3-080",
      "※モーフ 【ジョーカーグレネイト】敵軍バトルエリアから、Sユニットを1体選び撃破してもよい。そうしたとき、撃破したユニットのSPが1以上だったなら、相手に1点ダメージを与える。",
    );
    expectUnitStats("XG3-080", { name: "仮面ライダーW・HJ", category: ["WB", "DA"], size: "S", bp: 4000, sp: "1/2", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG3-080", ["SR"]);
  });

  morphTest("XG3-080", "atwiki/page-1957");

  const enemies: P2 = { battle: [inst("TST-UNIT-0", "e"), inst("SPEC-NOSP", "n"), inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-0", "r")] };

  it("XG3-080:【ジョーカーグレネイト】— RC で、敵軍バトルエリアの S ユニットを1体選べる（M ユニット・ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-1957「敵軍バトルエリアから、Sユニットを1体選び撃破してもよい」）", () => {
    const s = rc("XG3-080:hj", {}, enemies);
    expect(choiceIds(s).sort()).toEqual(["SPEC-NOSP:n", "TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-080:【ジョーカーグレネイト】— SP1 のユニットを撃破したら、相手に1点ダメージ（出典: atwiki/page-1957「撃破したユニットのSPが1以上だったなら、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(rc("XG3-080:hj", {}, enemies), ["TST-UNIT-0:e"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  it("XG3-080:【ジョーカーグレネイト】— SP のないユニットを撃破したら、ダメージは与えない（出典: atwiki/page-1957「撃破したユニットのSPが1以上だったなら」）", () => {
    const s = resolveAll(rc("XG3-080:hj", {}, enemies), ["SPEC-NOSP:n"]);
    expect(zoneOf(s, "player2", "SPEC-NOSP:n")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  it("XG3-080:【ジョーカーグレネイト】— 敵軍バトルエリアに S ユニットがいなければ撃破できず、ダメージも与えない（出典: atwiki/page-1957「撃破してもよい。そうしたとき」）", () => {
    const s = resolveAll(rc("XG3-080:hj", {}, { battle: [inst("TST-UNIT-2", "m")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });
});

// ===========================================================================
describe("XG3-081 仮面ライダーW・HT", () => {
  it("XG3-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-1937「BP：3000」「SP：1/2」「CN：なし」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText(
      "XG3-081",
      "※モーフ 【トリガー・エクスプロージョン】これをラッシュしたとき、ホールド状態の敵軍Sユニットを1体選んでもよい。そうしたとき、相手は選んだユニットを捨札にするか、自分自身のパワーゾーンのオモテ向きのカードを1枚捨札にするかを選ぶ。",
    );
    expectUnitStats("XG3-081", { name: "仮面ライダーW・HT", category: ["WB", "OT"], size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG3-081", ["NR"]);
  });

  morphTest("XG3-081", "atwiki/page-1937");

  const rushed = (p2: P2) => {
    const r = rushFromHand(board({ hand: [inst("XG3-081", "ht")], power: powerCards(3), command: [...releasedCat("WB", 1), ...releasedCat("OT", 1)] }, p2), "player1", "XG3-081:ht");
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  const enemies = (power = [faceUp("TST-UNIT-0", "pf")]): P2 => ({
    battle: [heldUnit("TST-UNIT-0", "hu"), inst("TST-UNIT-0", "ru"), heldUnit("TST-UNIT-2", "hm")],
    power,
  });

  it("XG3-081:【トリガー・エクスプロージョン】— ラッシュしたとき、ホールド状態の敵軍 S ユニットを1体選べる（リリース状態・M ユニットは選べない。任意）（出典: atwiki/page-1937「ホールド状態の敵軍Sユニットを1体選んでもよい」）", () => {
    const s = rushed(enemies());
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:hu"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-081:【トリガー・エクスプロージョン】— 相手が選ぶ: パワーゾーンのオモテ向きのカードを捨札にすれば、選んだユニットは残る（出典: atwiki/page-1937「相手は選んだユニットを捨札にするか、自分自身のパワーゾーンのオモテ向きのカードを1枚捨札にするかを選ぶ」）", () => {
    let s = resolveAll(rushed(enemies()), ["TST-UNIT-0:hu"], 1);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = resolveAll(s, ["TST-UNIT-0:pf"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:pf")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:hu")).toBe("battle");
  });

  it("XG3-081:【トリガー・エクスプロージョン】— 相手のパワーゾーンにオモテ向きのカードがなければ、選んだユニットを捨札にする（出典: atwiki/page-1937 カード評価「オモテ向きのカードがない場合…強制的にユニットを捨札にすることになる」）", () => {
    const s = resolveAll(rushed(enemies([faceDown("TST-UNIT-0", "pd")])), ["TST-UNIT-0:hu"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:hu")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:pd")).toBe("power");
  });
});

// ===========================================================================
describe("XG3-083 宇宙忍デモスト", () => {
  const TEXT =
    "※これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、自軍捨札の枚数がこれの必要パワーの数字以上あれば、これを自軍ラッシュエリアに出してもよい。 【暗黒剣】これをラッシュしたとき、自軍捨札の枚数を数えてもよい。そうしたとき、その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニットを1体選び、撃破する。";

  it("XG3-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-1938「必要パワー：6」「SP：1/3」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-083", TEXT);
    expectUnitStats("XG3-083", { name: "宇宙忍デモスト", category: ["MA", "OT"], size: "S", bp: 4000, sp: "1/3", powerCost: 6, comboNumber: undefined, features: ["男", "忍者"] });
    expectRarityIn("XG3-083", ["NR"]);
  });

  const inPower = (discard: number, p2: P2 = {}, card = faceUp("XG3-083", "dm")) => board({ power: [card], discard: deckCards(discard, "dd") }, p2);

  it("XG3-083: ※ 自軍パワーゾーンでオモテ向きの間、自軍捨札が6枚以上あれば自軍ラッシュエリアに出せる（出典: atwiki/page-1938「自軍捨札の枚数がこれの必要パワーの数字以上あれば、これを自軍ラッシュエリアに出してもよい」・カード評価「自分の捨札が6枚以上あればパワーゾーンからラッシュでき」）", () => {
    const s0 = inPower(6);
    expect(canSelfRush(s0, "power", "XG3-083:dm")).toBe(true);
    const s = resolveAll(selfRush(s0, "power", "XG3-083:dm"));
    expect(zoneOf(s, "player1", "XG3-083:dm")).toBe("rush");
  });

  it("XG3-083: ※ 自軍捨札が5枚なら出せない（出典: atwiki/page-1938「自軍捨札の枚数がこれの必要パワーの数字以上あれば」）", () => {
    expect(canSelfRush(inPower(5), "power", "XG3-083:dm")).toBe(false);
  });

  it("XG3-083: ※ パワーゾーンでウラ向き（ダメージ）なら出せない（出典: atwiki/page-1938「自軍パワーゾーンでオモテ向きになっている間」）", () => {
    expect(canSelfRush(inPower(6, {}, faceDown("XG3-083", "dm")), "power", "XG3-083:dm")).toBe(false);
  });

  it("XG3-083:【暗黒剣】— ラッシュしたとき、捨札の枚数（6）以下の必要パワーの、追加条件を持たない敵軍ユニットをエリア・サイズを問わず選べる（任意）（出典: atwiki/page-1938「その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニットを1体選び、撃破する」・カード評価「サイズもエリアも問わない除去」）", () => {
    const s = selfRush(
      inPower(6, { battle: [inst("TST-UNIT-0", "e"), inst("SPEC-C3", "c3"), inst("SPEC-C6", "c6"), inst("SPEC-C7", "c7")], rush: [inst("TST-UNIT-2", "m")] }),
      "power",
      "XG3-083:dm",
    );
    expect(choiceIds(s).sort()).toEqual(["SPEC-C3:c3", "SPEC-C6:c6", "TST-UNIT-0:e", "TST-UNIT-2:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-083:【暗黒剣】— 選んだ敵軍ラッシュエリアのユニット（必要パワー2）を撃破する（出典: atwiki/page-1938「1体選び、撃破する」）", () => {
    const s = resolveAll(selfRush(inPower(6, { rush: [inst("TST-UNIT-2", "m")] }), "power", "XG3-083:dm"), ["TST-UNIT-2:m"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("discard");
  });

  it("XG3-083:【暗黒剣】— 必要パワーが捨札の枚数より大きいユニット・追加条件を持つユニット（XG3-074）は選べない（出典: atwiki/page-1938「その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニット」）", () => {
    const s = selfRush(inPower(6, { rush: [inst("SPEC-C7", "c7"), inst("XG3-074", "kd"), inst("SPEC-C6", "c6")] }), "power", "XG3-083:dm");
    expect(choiceIds(s)).toEqual(["SPEC-C6:c6"]);
  });

  it("XG3-083:【暗黒剣】— 手札から通常のラッシュをしたときも発動する（出典: atwiki/page-1938「これをラッシュしたとき」）", () => {
    const r = rushFromHand(
      board({ hand: [inst("XG3-083", "dm")], power: powerCards(6), command: [...releasedCat("MA", 1), ...releasedCat("OT", 1)], discard: deckCards(3, "dd") }, { rush: [inst("TST-UNIT-2", "m")] }),
      "player1",
      "XG3-083:dm",
    );
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state, ["TST-UNIT-2:m"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("discard");
  });
});
