/**
 * カード別スペック: XP-012〜XP-016（クロスギャザー プロモーションカード シンケンゴールド〜仮面ライダークウガRU・レッドアイ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ を「XP-」とカード名で検索: 本範囲のカードの項はない。
 *     atwiki に転載された公式 Q&A もない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XP-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-REG・R-KW-MORPH-03・R-KW-WING-01・R-ADD 系）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XP-NNN …」）で残す。
 * レアリティは atwiki の「プロモーションカード」を PR、「リミテッドレア」を LR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  act,
  attack,
  attackUntilRegister,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOp,
  expectUnit,
  faceUpPower,
  inst,
  logged,
  morphCandidates,
  pick,
  playOp,
  powerCards,
  reanimateTests,
  registerOffered,
  released,
  releasedCat,
  releasedN,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
  zordDownTests,
} from "./XP-001-016.helpers";

const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", powerCost: 0, bp: 1000 });
const BP7000 = sUnit("SPEC-7000", { bp: 7000, sp: undefined });
const EXTRA = [ENEMY0, BP7000];

// ===========================================================================
describe("XP-012 シンケンゴールド", () => {
  const TEXT =
    "【サカナマル】これが自軍ラッシュエリアにある間、敵軍バトルフェイズ中、相手が自分自身のSユニットをバトルエリアに出すために選んだとき、これを自軍バトルエリアに出してもよい。そうしたとき、自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。このとき、捨札にしたカードと相手の選んだユニットの特徴を比べて、同じ特徴が2つ以上あれば、そのユニットを持ち主のパワーゾーンにダメージにして置き、1つだけならそのユニットを撃破する。";

  it("XP-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-1720）", () => {
    expectCatalogText("XP-012", TEXT);
    expectUnit("XP-012", { name: "シンケンゴールド", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, features: ["ゴールド", "男", "侍"], rarity: "PR" });
  });

  /** 敵軍（player2）バトルフェイズに、相手がシンケンレッド（RS-674。レッド／男／侍）をバトルエリアに出す。 */
  const enemyEnters = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    act(
      st({
        activePlayer: "player2",
        player1: { rush: [inst("XP-012", "sg")], hand: [inst("XG3-040", "samurai"), inst("RS-318", "man")], deck: [inst("TST-OP", "draw"), ...deckCards(3)], ...p1 },
        player2: { rush: [inst("RS-674", "e")], deck: deckCards(3, "e") },
      }),
      { type: "move_to_battle", playerId: "player2", instanceId: "RS-674:e" },
    );

  it("XP-012: 【サカナマル】相手が自分自身の S ユニットをバトルエリアに出すために選んだとき、これを自軍バトルエリアに出すかを選べる（任意）（出典: atwiki/page-1720「これを自軍バトルエリアに出してもよい」）", () => {
    const s = enemyEnters();
    expectChoiceFrom(s, "player1", "XP-012");
    expect(canSkip(s)).toBe(true);
  });

  it("XP-012: 【サカナマル】出すと、1枚ドローしてから手札を1枚選び捨札にする。捨札にしたカード（XG3-040。レッド／男／侍）と相手のユニットの同じ特徴が2つ以上なら、そのユニットは持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-1720）", () => {
    let s = accept(enemyEnters());
    expect(zoneOf(s, "player1", "XP-012:sg")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-OP:draw")).toBe("hand");
    expectChoiceFrom(s, "player1", "XP-012");
    s = resolveAll(pick(s, "XG3-040:samurai"));
    expect(zoneOf(s, "player1", "XG3-040:samurai")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-674:e")).toBe("power");
    expect(cardIn(s, "player2", "RS-674:e")?.faceDown).toBe(true);
  });

  it("XP-012: 【サカナマル】同じ特徴が1つだけ（RS-318 ドギー・クルーガー。男）なら、そのユニットを撃破する（出典: atwiki/page-1720「1つだけならそのユニットを撃破する」）", () => {
    const s = resolveAll(pick(accept(enemyEnters()), "RS-318:man"));
    expect(zoneOf(s, "player2", "RS-674:e")).toBe("discard");
  });

  it("XP-012: 【サカナマル】出さないことを選べば、ラッシュエリアに残り何も起きない（出典: atwiki/page-1720「出してもよい」）", () => {
    const s = resolveAll(skip(enemyEnters()));
    expect(zoneOf(s, "player1", "XP-012:sg")).toBe("rush");
    expect(zoneOf(s, "player2", "RS-674:e")).toBe("battle");
  });

  it("XP-012: 【サカナマル】自軍バトルフェイズに自分のユニットを出しても発動しない（出典: atwiki/page-1720「敵軍バトルフェイズ中、相手が」）", () => {
    const s = enter(st({ player1: { rush: [inst("XP-012", "sg"), inst("RS-674", "own")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }), "RS-674:own");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XP-012");
    expect(zoneOf(s, "player1", "XP-012:sg")).toBe("rush");
  });
});

// ===========================================================================
describe("XP-013 ハイパーシンケンレッド", () => {
  const TEXT =
    "※レジスト ※これが撃破されて捨札になったとき、自軍捨札から「シンケンレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 【キョウリュウマル】これが自軍エリアにある間、自軍ターン中、自軍Sユニットがホールド状態になったとき、敵軍ゾーンのオモテ向きのカードから、追加条件を持つSユニットのカードを1枚選び、持ち主の山札の下に戻してもよい。";

  it("XP-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-1882）", () => {
    expectCatalogText("XP-013", TEXT);
    expectUnit("XP-013", {
      name: "ハイパーシンケンレッド",
      category: "MA",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      features: ["レッド", "男", "侍"],
      rushCondition: "zord_down_discard_named",
      rarity: "PR",
    });
  });

  zordDownTests("XP-013", "RS-674", "シンケンレッド", "atwiki/page-1882「追加条件：自軍「シンケンレッド」1体を捨札にすれば必要パワー0になる」", "MA");
  reanimateTests("XP-013", "RS-674", "シンケンレッド", "atwiki/page-1882");

  it("XP-013: ※レジスト — 敵軍ターンにアタックされたとき、レジストを使える（出典: atwiki/page-1882「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XP-013", "hr")], command: releasedCat("MA", 1) }, "XP-013:hr"))).toBe(true);
  });

  /** 自軍バトルフェイズに、ウイングの XP-022 ゴセイレッドをホールドする（自軍 S ユニットがホールド状態になる）。敵軍ゾーン: コマンドに XP-010（追加条件あり）、オモテのパワーに XP-011（追加条件あり）と TST-UNIT-0（なし）。 */
  const held = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    act(
      st({
        player1: { rush: [inst("XP-013", "hr"), inst("XP-022", "w")], deck: deckCards(3), ...p1 },
        player2: { command: [released("XP-010", "c")], power: [faceUpPower("XP-011", "p"), faceUpPower("TST-UNIT-0", "q"), { ...inst("XP-016", "down"), faceDown: true }], battle: [inst("TST-UNIT-0", "b")], deck: deckCards(3, "e") },
      }),
      { type: "hold_for_wing", playerId: "player1", instanceId: "XP-022:w" },
    );

  it("XP-013: 【キョウリュウマル】自軍ターン中に自軍 S ユニットがホールド状態になったとき、敵軍ゾーンのオモテ向きの、追加条件を持つ S ユニットのカードから選べる（任意）（出典: atwiki/page-1882「敵軍ゾーンのオモテ向きのカードから、追加条件を持つSユニットのカードを1枚選び、…戻してもよい」）", () => {
    const s = held();
    expectChoiceFrom(s, "player1", "XP-013");
    expect(choiceIds(s)).toEqual(["XP-010:c", "XP-011:p"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XP-013: 【キョウリュウマル】選んだカードは持ち主（相手）の山札の一番下に戻る（出典: atwiki/page-1882「持ち主の山札の下に戻して」）", () => {
    const s = resolveAll(pick(held(), "XP-011:p"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("XP-011:p");
  });
});

// ===========================================================================
describe("XP-014 仮面ライダーW・CM", () => {
  const TEXT =
    "※モーフ ※レジスト 【メタルシャフト】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからホールド状態のＳユニットを１体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XP-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-1883）", () => {
    expectCatalogText("XP-014", TEXT);
    expectUnit("XP-014", {
      name: "仮面ライダーW・CM",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: "2+",
      features: ["仮面ライダー", "男", "ダブルドライバー"],
      rushConditionText: "特徴「メカ」を持つ自軍コマンドがある",
      rarity: "PR",
    });
  });

  const rushBoardOf = (command: CardInstance[]) =>
    st({ phase: "rush", player1: { hand: [inst("XP-014", "cm")], command, power: powerCards(2), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  it("XP-014: 追加条件 — 特徴「メカ」を持つ自軍コマンド（XP-015 ダブルドライバー。ET／DA で特徴「メカ」）があればラッシュできる（出典: atwiki/page-1883「追加条件：特徴「メカ」を持つ自軍コマンドがある」・atwiki/page-1880 カード評価「これ自体が特徴「メカ」を持つため、仮面ライダーW・HMなどもそのままラッシュ可能」）", () => {
    const r = rushFromHand(rushBoardOf([released("XP-015", "dd")]), "player1", "XP-014:cm");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XP-014:cm")).toBe("rush");
  });

  it("XP-014: 追加条件 — 「メカ」の自軍コマンドがなければラッシュできない（出典: atwiki/page-1883）", () => {
    expect(canStartRush(rushBoardOf(releasedCat("ET", 2)), "player1", "XP-014:cm")).toBe(false);
  });

  it("XP-014: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（XG2-043 W・CJ）と置き換えられる（出典: atwiki/page-1883「※モーフ」「モーフ可能なユニット」・R-KW-MORPH-03）", () => {
    const s = enemyRushes({ battle: [inst("XP-014", "cm")], command: [released("XG2-043", "cj"), released("XG1-066", "fz")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["XG2-043:cj"]);
  });

  it("XP-014: ※レジスト — 敵軍ターンにアタックされたとき、レジストを使える（出典: atwiki/page-1883「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XP-014", "cm")], command: releasedCat("ET", 1) }, "XP-014:cm"))).toBe(true);
  });

  /** 自軍バトルフェイズに W・CM を出す。敵軍: バトルエリアにホールド状態の S（h）・リリース状態の S（r）・ホールド状態の M（hm）、ラッシュエリアにホールド状態の S（hr）。 */
  const metalShaft = (enemyCommand: CardInstance[] = []) =>
    enter(
      st({
        player1: { rush: [inst("XP-014", "cm")], deck: deckCards(3) },
        player2: {
          battle: [{ ...inst("TST-UNIT-0", "h"), commandHeld: true }, inst("TST-UNIT-0", "r"), { ...inst("TST-UNIT-2", "hm"), commandHeld: true }],
          rush: [{ ...inst("TST-UNIT-0", "hr"), commandHeld: true }],
          command: enemyCommand,
          deck: deckCards(3, "e"),
        },
      }),
      "XP-014:cm",
    );

  it("XP-014: 【メタルシャフト】自軍ターンにバトルエリアに出たとき、敵軍バトルエリアのホールド状態の S ユニットだけから1体選ぶ（強制）（出典: atwiki/page-1883「敵軍バトルエリアからホールド状態のＳユニットを１体選び」）", () => {
    const s = metalShaft();
    expectChoiceFrom(s, "player1", "XP-014");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:h"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XP-014: 【メタルシャフト】選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1883「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(metalShaft(), "TST-UNIT-0:h"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:h")).toBe("command");
    expect(cardIn(s, "player2", "TST-UNIT-0:h")?.commandHeld).toBe(true);
  });

  it("XP-014: 【メタルシャフト】持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-1883「置けなければ捨札にする」）", () => {
    let s = metalShaft(releasedN(5, "TST-OP", "ec"));
    if (s.pendingEffectChoice?.sourceCardId === "XP-014") s = pick(s, "TST-UNIT-0:h");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:h")).toBe("discard");
  });
});

// ===========================================================================
describe("XP-015 ダブルドライバー", () => {
  const TEXT =
    "※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、これをホールドして、自分の手札から特徴「ダブルドライバー」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。 ◎自軍山札を見て、特徴「ダブルドライバー」を持つユニットカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。";

  it("XP-015: カタログ本文・スペックが出典と一致（リミテッドレア・ET／DA のマルチカテゴリ）（出典: atwiki/page-1880）", () => {
    expectCatalogText("XP-015", TEXT);
    expectOp("XP-015", { name: "ダブルドライバー", category: ["ET", "DA"], powerCost: 6, rarity: "LR" });
  });

  const used = () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("XP-015", "op")], command: [...releasedCat("ET", 1), ...releasedCat("DA", 1)], power: powerCards(6), deck: [inst("XG2-043", "cj"), inst("XP-014", "cm"), inst("XG1-066", "fz"), ...deckCards(3)] },
      player2: { deck: deckCards(3, "e") },
    });
    const r = playOp(s, "player1", "XP-015:op");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("XP-015: ◎ 自軍山札の特徴「ダブルドライバー」を持つユニットカードから1枚選べる（任意。ほかのライダーは選べない）（出典: atwiki/page-1880「自軍山札を見て、特徴「ダブルドライバー」を持つユニットカードを1枚選び、…手札に加えてもよい」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XP-015");
    expect(choiceIds(s)).toEqual(["XG2-043:cj", "XP-014:cm"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XP-015: ◎ 選んだカードは相手に見せてから手札に加わる（出典: atwiki/page-1880「相手に見せてから手札に加えて」）", () => {
    const s = resolveAll(pick(used(), "XP-014:cm"));
    expect(zoneOf(s, "player1", "XP-014:cm")).toBe("hand");
    expect(zoneOf(s, "player1", "XG2-043:cj")).toBe("deck");
    expect(logged(s, "reveal")).toBe(true);
  });

  /** 自軍ラッシュフェイズ。コマンドはダブルドライバーだけ（ET／DA）。手札に XG3-081 W・HT（WB／OT・必要パワー3）。 */
  const inCommand = (power = 3, phase: GameState["phase"] = "rush") =>
    st({ phase, player1: { command: [released("XP-015", "dd")], hand: [inst("XG3-081", "ht"), inst("XG1-066", "fz")], power: powerCards(power), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  it("XP-015: ※ 自軍コマンドゾーンにある間、自軍ラッシュフェイズにこれをホールドして、手札の特徴「ダブルドライバー」を持つユニットカード（カテゴリが違う W・HT）をラッシュエリアに出せる（出典: atwiki/page-1880・カード評価「特徴「ダブルドライバー」持ちのユニットを何でもラッシュできる万能コマンド」）", () => {
    const s = inCommand();
    const r = rushFromHand(s, "player1", "XG3-081:ht");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-081:ht")).toBe("rush");
    expect(cardIn(r.state, "player1", "XP-015:dd")?.commandHeld).toBe(true);
  });

  it("XP-015: ※ 必要パワーを満たさなければ（パワー2で必要パワー3）出せない（出典: atwiki/page-1880「ただし、必要パワーと追加条件は満たすこと」）", () => {
    expect(canStartRush(inCommand(2), "player1", "XG3-081:ht")).toBe(false);
  });

  it("XP-015: ※ 「ダブルドライバー」を持たないユニットカード（ディケイド ファイズ。ET）は、ダブルドライバーの ET で通常どおりラッシュできる（※ の対象ではないが、ET のコマンドとしてホールドできる）（出典: atwiki/page-1880・R-CAT マルチカテゴリ）", () => {
    const r = rushFromHand(inCommand(4), "player1", "XG1-066:fz");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-066:fz")).toBe("rush");
  });
});

// ===========================================================================
describe("XP-016 仮面ライダークウガRU・レッドアイ", () => {
  const TEXT =
    "※レジスト 【赤い瞳に宿るもの】これが自軍エリアにある間、このユニットよりBPの低い自軍ユニットがアタックされたとき、アタックされたユニットをホールドしてもよい。そうしたとき、アタックしてきたユニットは、ホールドしたユニットのかわりに、このユニットとバトルする。このバトル中、自軍エリアに「仮面ライダーディケイド」があれば、これはBP+2000される。";

  it("XP-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-1982）", () => {
    expectCatalogText("XP-016", TEXT);
    expectUnit("XP-016", {
      name: "仮面ライダークウガRU・レッドアイ",
      category: "MA",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: "7+",
      features: ["仮面ライダー", "男", "アマダム", "ライジング"],
      rushConditionText: "特徴「仮面ライダー」を持つ捨札が自軍と敵軍で合計8枚以上ある",
      rarity: "PR",
    });
  });

  const riders = (p: string, n: number) => Array.from({ length: n }, (_, i) => inst("XG1-066", `${p}${i}`));
  const rushBoardOf = (own: number, enemy: number) =>
    st({ phase: "rush", player1: { hand: [inst("XP-016", "ru")], command: releasedCat("MA", 1), power: powerCards(7), discard: riders("a", own), deck: deckCards(3) }, player2: { discard: riders("b", enemy), deck: deckCards(3, "e") } });

  it("XP-016: 追加条件 — 特徴「仮面ライダー」を持つ捨札が自軍と敵軍で合計8枚（4＋4）あればラッシュでき、捨札はそのまま残る（出典: atwiki/page-1982「追加条件：特徴「仮面ライダー」を持つ捨札が自軍と敵軍で合計8枚以上ある」）", () => {
    const r = rushFromHand(rushBoardOf(4, 4), "player1", "XP-016:ru");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XP-016:ru")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(4);
    expect(r.state.players.player2.discard).toHaveLength(4);
  });

  it("XP-016: 追加条件 — 合計7枚ではラッシュできない（出典: atwiki/page-1982「合計8枚以上」）", () => {
    expect(canStartRush(rushBoardOf(4, 3), "player1", "XP-016:ru")).toBe(false);
  });

  it("XP-016: ※レジスト — 敵軍ターンにアタックされたとき、レジストを使える（出典: atwiki/page-1982「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XP-016", "ru")], command: releasedCat("MA", 1) }, "XP-016:ru"))).toBe(true);
  });

  /** 敵軍ターン、BP7000 が自軍の BP1000（TST-UNIT-0）にアタックする。クウガRU は自軍ラッシュエリア。 */
  const attacked = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    settle(
      attack(
        st({ activePlayer: "player2", player1: { battle: [inst("TST-UNIT-0", "w")], rush: [inst("XP-016", "ru"), ...(p1.rush ?? [])], deck: deckCards(3) }, player2: { battle: [inst("SPEC-7000", "a")], deck: deckCards(3, "e") } }, EXTRA),
        "SPEC-7000:a",
        "TST-UNIT-0:w",
        "player2",
      ),
    );

  it("XP-016: 【赤い瞳に宿るもの】これより BP の低い自軍ユニットがアタックされたとき、そのユニットをホールドするかを選べる（任意）（出典: atwiki/page-1982「アタックされたユニットをホールドしてもよい」）", () => {
    const s = attacked();
    expectChoiceFrom(s, "player1", "XP-016");
    expect(canSkip(s)).toBe(true);
  });

  it("XP-016: 【赤い瞳に宿るもの】ホールドすると、アタックしてきたユニットはかわりにこのユニットとバトルする（BP6000 は BP7000 に負ける。アタックされたユニットはホールド状態で残る）（出典: atwiki/page-1982「アタックしてきたユニットは、ホールドしたユニットのかわりに、このユニットとバトルする」）", () => {
    const s = resolveAll(accept(attacked()));
    expect(cardIn(s, "player1", "TST-UNIT-0:w")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "TST-UNIT-0:w")).toBe("battle");
    expect(zoneOf(s, "player1", "XP-016:ru")).toBe("discard");
  });

  it("XP-016: 【赤い瞳に宿るもの】自軍エリアに「仮面ライダーディケイド」（XP-004）があれば、このバトル中 BP+2000（BP8000）で BP7000 に勝つ（出典: atwiki/page-1982「このバトル中、自軍エリアに「仮面ライダーディケイド」があれば、これはBP+2000される」）", () => {
    const s = resolveAll(accept(attacked({ rush: [inst("XP-004", "dc")] })));
    expect(zoneOf(s, "player1", "XP-016:ru")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-7000:a")).toBe("discard");
  });

  it("XP-016: 【赤い瞳に宿るもの】ホールドしなければ、アタックされたユニットがそのままバトルする（出典: atwiki/page-1982「ホールドしてもよい」）", () => {
    const s0 = attacked();
    const s = resolveAll(s0.pendingEffectChoice ? skip(s0) : s0);
    expect(zoneOf(s, "player1", "TST-UNIT-0:w")).toBe("discard");
    expect(zoneOf(s, "player1", "XP-016:ru")).toBe("rush");
  });
});
