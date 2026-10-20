/**
 * カード別スペック: XG5-075〜XG5-080（クロスギャザー XG5 ザ・チケットブレイカー 仮面ライダーイクサSM〜マシンディケイダー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG5-078 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01・R-KW-MORPH-01・R-KW-RIDE-01〜05・R-RUSH-24）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  attack,
  beltUsed,
  bpOf,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  expectVehicleStats,
  faceUp,
  inst,
  morphCandidates,
  passEntry,
  pick,
  powerCards,
  rcOff,
  releasedCat,
  resolveAll,
  ridingPair,
  rushBoard,
  rushFromHand,
  settle,
  skipFrom,
  st,
  sUnit,
  zoneOf,
} from "./XG5-061-080.helpers";

const WOMAN = sUnit("SPEC-WOMAN", { category: "ET", bp: 3000, features: ["女"] });
const MAN = sUnit("SPEC-MAN", { category: "WB", bp: 1000, features: ["男"] });
const MAN_M = sUnit("SPEC-MAN-M", { category: "WB", bp: 1000, size: "M", features: ["男"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000 });
const LOW = sUnit("SPEC-LOW", { category: "WB", bp: 500 });
const EXTRA = [WOMAN, MAN, MAN_M, PLAIN, LOW];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-075 仮面ライダーイクサSM", () => {
  const TEXT = "【母娘の絆】このターン、次に特徴「女」を持つ自軍ユニットが敵軍ユニットを撃破したとき、自軍捨札から特徴「男」を持つユニットカードを1枚選び、手札に加えてもよい。";

  it("XG5-075: カタログ本文・スペックが出典と一致（出典: atwiki/page-2246）", () => {
    expectCatalogText("XG5-075", TEXT);
    expectMultiStats("XG5-075", { name: "仮面ライダーイクサSM", category: ["ET"], size: "S", bp: 1000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["仮面ライダー", "メカ", "女"] });
    expectRarityIn("XG5-075", ["NR"]);
  });

  /** イクサSM（「女」・BP1000）が1番目に出て（NC）、敵軍の SPEC-LOW（BP500）にアタックして撃破する。自軍捨札に「男」と「男」でないユニットカード。 */
  const won = (nc = true) => {
    const s = battle({ rush: [inst("XG5-075", "ix")], discard: [inst("SPEC-MAN", "dm"), inst("SPEC-PLAIN", "dp")], battle: nc ? [] : [inst("TST-UNIT-0", "f")] }, { battle: [inst("SPEC-LOW", "e")] });
    return settle(attack(enter(s, "XG5-075:ix"), "XG5-075:ix", "SPEC-LOW:e"));
  };

  it("XG5-075: NC【母娘の絆】— 成立したときには何も選ばない（撃破するまで選択は開かない）（出典: atwiki/page-2246「このターン、次に…撃破したとき」）", () => {
    const s = enter(battle({ rush: [inst("XG5-075", "ix")], discard: [inst("SPEC-MAN", "dm")] }, { battle: [inst("SPEC-LOW", "e")] }), "XG5-075:ix");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-075");
  });

  it("XG5-075: NC【母娘の絆】— このターン、次に「女」の自軍ユニット（これ自身）が敵軍ユニットを撃破したとき、自軍捨札の「男」のユニットカードを選んで手札に加えられる（任意）（出典: atwiki/page-2246「次に特徴「女」を持つ自軍ユニットが敵軍ユニットを撃破したとき、自軍捨札から特徴「男」を持つユニットカードを1枚選び、手札に加えてもよい」）", () => {
    const s = won();
    expect(zoneOf(s, "player2", "SPEC-LOW:e")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG5-075");
    expect(choiceIds(s)).toEqual(["SPEC-MAN:dm"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-075: NC【母娘の絆】— 選んだカードは手札に加わる（出典: atwiki/page-2246「手札に加えてもよい」）", () => {
    const s = resolveAll(pick(won(), "SPEC-MAN:dm"));
    expect(zoneOf(s, "player1", "SPEC-MAN:dm")).toBe("hand");
  });

  it("XG5-075: NC が成立しなければ（2番目）撃破しても選択は開かない（出典: atwiki/page-2246「CN：1」）", () => {
    expect(won(false).pendingEffectChoice?.sourceCardId).not.toBe("XG5-075");
  });
});

// ===========================================================================
describe("XG5-076 仮面ライダーイクサBM", () => {
  const TEXT = "【ダブル・ブロウクン・ファング】これが特徴「女」を持つ自軍ユニットからコンビネーションするとき、次の効果を発動できる⇒自軍コマンドの枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。";

  it("XG5-076: カタログ本文・スペックが出典と一致（出典: atwiki/page-2247）", () => {
    expectCatalogText("XG5-076", TEXT);
    expectMultiStats("XG5-076", { name: "仮面ライダーイクサBM", category: ["ET"], size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: "R", features: ["仮面ライダー", "メカ", "女"] });
    expectRarityIn("XG5-076", ["NR"]);
  });

  // 自軍コマンド2枚。敵軍: TST-UNIT-0（必要パワー0）・TST-UNIT-2（2・M）・TST-UNIT-7（7+）・XG5-075（2・S）。
  const combo = (first: string) => {
    let s = battle(
      { rush: [inst(first, "a"), inst("XG5-076", "ib")], command: releasedCat("WB", 2) },
      { rush: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-7", "e7")], battle: [inst("TST-UNIT-2", "e2"), inst("XG5-075", "es")] },
    );
    s = passEntry(settle(enter(s, `${first}:a`)));
    return enter(s, "XG5-076:ib");
  };

  it("XG5-076:【ダブル・ブロウクン・ファング】—「女」の自軍ユニットからコンビネーションするとき、自軍コマンドの枚数（2）以下の必要パワーの数字の敵軍 S ユニットを選べる（M ユニット・7+ は選べない。任意）（出典: atwiki/page-2247「自軍コマンドの枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = combo("SPEC-WOMAN");
    expectChoiceFrom(s, "player1", "XG5-076");
    expect([...choiceIds(s)].sort()).toEqual(["TST-UNIT-0:e0", "XG5-075:es"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-076:【ダブル・ブロウクン・ファング】— 選んだユニットは撃破される（出典: atwiki/page-2247「撃破する」）", () => {
    const s = resolveAll(pick(combo("SPEC-WOMAN"), "XG5-075:es"));
    expect(zoneOf(s, "player2", "XG5-075:es")).toBe("discard");
  });

  it("XG5-076:【ダブル・ブロウクン・ファング】—「女」を持たないユニットからのコンビネーションでは発動しない（出典: atwiki/page-2247「特徴「女」を持つ自軍ユニットから」）", () => {
    expect(combo("SPEC-MAN").pendingEffectChoice?.sourceCardId).not.toBe("XG5-076");
  });
});

// ===========================================================================
describe("XG5-077 仮面ライダーキバーラ", () => {
  const TEXT =
    "【ソニックスタッブ】 自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍バトルエリアから特徴「男」を持つユニットを1体選び持ち主のパワーゾーンにダメージにして置く。そうしたとき、相手は自分自身の捨札から特徴「男」を持つSユニットのカードを1枚選び自分自身のラッシュエリアに出す。";

  it("XG5-077: カタログ本文・スペックが出典と一致（出典: atwiki/page-2266）", () => {
    expectCatalogText("XG5-077", TEXT);
    expectMultiStats("XG5-077", { name: "仮面ライダーキバーラ", category: ["MA"], size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "女", "魔皇力"] });
    expectRarityIn("XG5-077", ["R"]);
  });

  // 敵軍: バトルエリアに「男」の S・「男」でない S、ラッシュエリアに「男」の S。捨札に「男」の S・「男」の M のカード。
  const P2 = () => ({ battle: [inst("SPEC-MAN", "b"), inst("SPEC-PLAIN", "p")], rush: [inst("SPEC-MAN", "r")], discard: [inst("SPEC-MAN", "d"), inst("SPEC-MAN-M", "dm")] });
  const entered = () => enter(battle({ rush: [inst("XG5-077", "kb")] }, P2()), "XG5-077:kb");

  it("XG5-077:【ソニックスタッブ】— 自軍ターン中にバトルエリアに出たとき、これをホールドするかを選べる（任意）（出典: atwiki/page-2266「これをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-077");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-077:【ソニックスタッブ】— ホールドしたとき、敵軍バトルエリアの「男」のユニットを選び、持ち主のパワーゾーンにダメージにして置く（ラッシュエリアのユニットは選べない）（出典: atwiki/page-2266「敵軍バトルエリアから特徴「男」を持つユニットを1体選び持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = entered();
    if (s.pendingEffectChoice?.kind === "confirm") s = accept(s);
    expect(cardIn(s, "player1", "XG5-077:kb")?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-MAN:b"]);
    s = pick(s, "SPEC-MAN:b");
    expect(zoneOf(s, "player2", "SPEC-MAN:b")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG5-077:【ソニックスタッブ】— そうしたとき、相手は自分自身の捨札の「男」の S ユニットのカードを選び、自分自身のラッシュエリアに出す（M のカードは選べない）（出典: atwiki/page-2266「相手は自分自身の捨札から特徴「男」を持つSユニットのカードを1枚選び自分自身のラッシュエリアに出す」）", () => {
    let s = entered();
    if (s.pendingEffectChoice?.kind === "confirm") s = accept(s);
    s = pick(s, "SPEC-MAN:b");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-MAN:d"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-MAN:d")).toBe("rush");
  });
});

// ===========================================================================
describe("XG5-078 ファイナルフォームライド", () => {
  const TEXT =
    "自軍Sユニットを1体選び、自軍パワーゾーンのオモテ向きのカードからSユニットまたはSビークルのカードを1枚選ぶ。そうしたとき、選んだユニットとカードを置き換える。ただし、必要パワーは満たすこと（追加条件は満たさなくてもよい）。このとき、出したユニットの効果は発動しない。";

  it("XG5-078: カタログ本文・スペックが出典と一致（出典: atwiki/page-2179）", () => {
    expectCatalogText("XG5-078", TEXT);
    expectOpStats("XG5-078", { name: "ファイナルフォームライド", category: "OT", powerCost: 5 });
    expectRarityIn("XG5-078", ["SR"]);
  });

  // 自軍: ラッシュエリアに TST-UNIT-0。パワーゾーン（6枚）にオモテ向きの XG5-049 再生アポロガイスト（5+・追加条件あり）・XG5-080 マシンディケイダー（S ビークル）・TST-UNIT-7（7+）・XG5-047（オペレーション）。
  const used = () =>
    beltUsed("XG5-078", "OT", 6, { rush: [inst("TST-UNIT-0", "u")], power: [faceUp("XG5-049", "ra"), faceUp("XG5-080", "md"), faceUp("TST-UNIT-7", "big"), faceUp("XG5-047", "op"), ...powerCards(2)] }, {}, EXTRA);

  it("XG5-078: 自軍 S ユニットを選び、パワーゾーンのオモテ向きの S ユニット・S ビークルのカードのうち必要パワーを満たすものを選ぶ（追加条件は問わない）（出典: atwiki/page-2179「自軍Sユニットを1体選び、自軍パワーゾーンのオモテ向きのカードからSユニットまたはSビークルのカードを1枚選ぶ…ただし、必要パワーは満たすこと（追加条件は満たさなくてもよい）」）", () => {
    let s = used();
    expectChoiceFrom(s, "player1", "XG5-078");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
    s = pick(s, "TST-UNIT-0:u");
    expect([...choiceIds(s)].sort()).toEqual(["XG5-049:ra", "XG5-080:md"]);
  });

  it("XG5-078: 選んだユニットとカードを置き換える（再生アポロガイストがラッシュエリアに、TST-UNIT-0 がパワーゾーンに）（出典: atwiki/page-2179「選んだユニットとカードを置き換える」）", () => {
    const s = resolveAll(pick(pick(used(), "TST-UNIT-0:u"), "XG5-049:ra"));
    expect(zoneOf(s, "player1", "XG5-049:ra")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("power");
  });

  it.todo("XG5-078: 公式Q&A —「追加条件は満たさなくてもよい」とあっても、あえて追加条件を満たすことはできない（出典: atwiki/page-2179 Q1「いいえ、それはできません」）— 置き換え自体がエンジンになく、追加条件を満たす手順が出てこないことを Q1 によるものとして確かめられない");
});

// ===========================================================================
describe("XG5-079 仮面ライダーディケイド", () => {
  const TEXT = "※モーフ 【ライダーカード】敵軍捨札から、ナンバーにＲＣを持つユニットカードを1枚選んでもよい。そうしたとき、選んだカードのRCの効果をこのユニットの効果として発動する。";

  it("XG5-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-2216）", () => {
    expectCatalogText("XG5-079", TEXT);
    expectMultiStats("XG5-079", { name: "仮面ライダーディケイド", category: ["OT"], size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "ディケイドライバー"] });
    expectRarityIn("XG5-079", ["N"]);
  });

  it("XG5-079: ※モーフ — 敵軍ユニットが通常の手段でラッシュされたとき、特徴が完全に同じオモテ向きのユニットカード（XG5-054 仮面ライダーディケイドCF）と置き換えられる（出典: atwiki/page-2216「※モーフ」・R-KW-MORPH-01）", () => {
    const s = enemyRushes({ rush: [inst("XG5-079", "dc")], power: [faceUp("XG5-054", "cf"), faceUp("RK-056", "z")] }, "TST-UNIT-0:x");
    expect(morphCandidates(s)).toEqual(["XG5-054:cf"]);
  });

  // 敵軍捨札: XG5-072 仮面ライダー威吹鬼（RC）・TST-UNIT-0（RC でない）。
  const fired = () => rcOff(battle({ rush: [inst("XG5-080", "md"), inst("XG5-079", "dc")] }, { discard: [inst("XG5-072", "ib"), inst("TST-UNIT-0", "o")] }), "XG5-079:dc", "XG5-080:md");

  it("XG5-079: RC【ライダーカード】— ライドオフしたとき、敵軍捨札のナンバーに RC を持つユニットカードを選べる（任意）（出典: atwiki/page-2216「敵軍捨札から、ナンバーにＲＣを持つユニットカードを1枚選んでもよい」）", () => {
    const s = fired();
    expectChoiceFrom(s, "player1", "XG5-079");
    expect(choiceIds(s)).toEqual(["XG5-072:ib"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-079: RC【ライダーカード】— 選んだカード（XG5-072）の RC【挫けぬ疾風】をこのユニットの効果として発動する（出典: atwiki/page-2216「選んだカードのRCの効果をこのユニットの効果として発動する」）", () => {
    const s = pick(fired(), "XG5-072:ib");
    expect(zoneOf(s, "player2", "XG5-072:ib")).toBe("discard");
    // 【挫けぬ疾風】の「敵軍山札をシャッフルしてもよい」の選択が、このユニット（XG5-079）の効果として開く
    expectChoiceFrom(s, "player1", "XG5-079");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-079: RC【ライダーカード】— 選ばなければ何も起きない（出典: atwiki/page-2216「選んでもよい」）", () => {
    const s = skipFrom(fired(), "XG5-079");
    expect(zoneOf(s, "player2", "XG5-072:ib")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-080 マシンディケイダー", () => {
  const TEXT =
    "※これにライドしているユニットはBP+500される。 【アタックライド】これをラッシュしたとき、自軍パワーゾーンのオモテ向きのカードから、必要パワーを満たしているSビークルのカードを1枚選び、これと置き換えてもよい。ただし、追加条件は満たすこと。";

  it("XG5-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-2217）", () => {
    expectCatalogText("XG5-080", TEXT);
    expectVehicleStats("XG5-080", { name: "マシンディケイダー", category: "OT", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG5-080", ["N"]);
  });

  it("XG5-080: ※ — これにライドしているユニットは BP+500（出典: atwiki/page-2217「これにライドしているユニットはBP+500される」）", () => {
    expect(bpOf(battle({ battle: ridingPair("SPEC-PLAIN", "r", "XG5-080", "md") }), "player1", "SPEC-PLAIN:r")).toBe(1500);
    expect(bpOf(battle({ battle: [inst("XG5-080", "md"), inst("SPEC-PLAIN", "r")] }), "player1", "SPEC-PLAIN:r")).toBe(1000);
  });

  // パワー3: オモテ向きの XG5-057 レッドランバス（S ビークル・必要パワー2）・RK-300 カブトエクステンダー（S ビークル・3）・TST-UNIT-0（ユニット）。
  const rushed = (power = [faceUp("XG5-057", "rb"), faceUp("RK-300", "ke"), faceUp("TST-UNIT-0", "u")]) => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG5-080", "md")], power, command: releasedCat("OT", 1) }, {}, EXTRA), "player1", "XG5-080:md");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG5-080:【アタックライド】— ラッシュしたとき、自軍パワーゾーンのオモテ向きの、必要パワーを満たす S ビークルのカードを選べる（任意）（出典: atwiki/page-2217「必要パワーを満たしているSビークルのカードを1枚選び、これと置き換えてもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG5-080");
    expect([...choiceIds(s)].sort()).toEqual(["RK-300:ke", "XG5-057:rb"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-080:【アタックライド】— 選んだカードとこれを置き換える（レッドランバスがラッシュエリアに、これがパワーゾーンに）（出典: atwiki/page-2217「これと置き換えてもよい」）", () => {
    const s = resolveAll(pick(rushed(), "XG5-057:rb"));
    expect(zoneOf(s, "player1", "XG5-057:rb")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-080:md")).toBe("power");
  });
});
