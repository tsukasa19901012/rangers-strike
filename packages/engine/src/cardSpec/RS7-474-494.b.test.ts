/**
 * カード別スペック: RS-481〜RS-487（第7弾「七忍の炎陣」天空神〜ゴートクラッシャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS486）、grnrngr/faq-card-7（RS-486 Q）、
 *     grnrngr/faq-card-8（RS-574 セイントカイザーと RS-487 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02・R-ADD-06、R-CN-01・R-CN-05 ジョイントコンビネーション、R-TIME-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attack,
  attackTargets,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  pick,
  playOp,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  settle,
  skip,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RS7-474-494.helpers";
import type { GameState } from "../types/game";

const AIR_S = sUnit("SPEC-AIR-S", { features: ["航空機"], bp: 20000 });
const NINJA_S = sUnit("SPEC-NINJA", { features: ["忍者"] });

/** 「※これは、特徴「航空機」を持たないユニットにアタックされない」の共通テスト。 */
function noAttackFromNonAircraftTests(id: string, page: string) {
  const s = () =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: [inst(id, "me"), inst("TST-UNIT-0", "f")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "l"), inst("SPEC-AIR-S", "air")], deck: deckCards(3, "e") },
      },
      [AIR_S],
    );
  it(`${id}: ※ 特徴「航空機」を持たないユニットにはアタックされない（出典: atwiki/${page}「特徴「航空機」を持たないユニットにアタックされない」）`, () => {
    expect(attackTargets(s(), "TST-UNIT-7:l", "player2")).toEqual(["TST-UNIT-0:f"]);
  });
  it(`${id}: ※ 特徴「航空機」を持つユニットにはアタックされる（出典: atwiki/${page}）`, () => {
    expect(attackTargets(s(), "SPEC-AIR-S:air", "player2").sort()).toEqual([`${id}:me`, "TST-UNIT-0:f"].sort());
  });
}

/** 「※これはSユニットにアタックされない」の共通テスト。 */
function noAttackFromSTests(id: string, page: string) {
  const s = () =>
    st({
      activePlayer: "player2",
      player1: { battle: [inst(id, "me"), inst("TST-UNIT-0", "f")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em")], deck: deckCards(3, "e") },
    });
  it(`${id}: ※ S ユニットにはアタックされない（出典: atwiki/${page}「これはSユニットにアタックされない」）`, () => {
    expect(attackTargets(s(), "TST-UNIT-0:es", "player2")).toEqual(["TST-UNIT-0:f"]);
  });
  it(`${id}: ※ M ユニットにはアタックされる（出典: atwiki/${page}）`, () => {
    expect(attackTargets(s(), "TST-UNIT-2:em", "player2")).toContain(`${id}:me`);
  });
}

// ===========================================================================
describe("RS-481 天空神", () => {
  const TEXT =
    "※これは、特徴「航空機」を持たないユニットにアタックされない。【ホバリング】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからSユニットを1体選び、持ち主の手札に戻してもよい。";

  it("RS-481: カタログ本文・スペックが出典と一致（出典: atwiki/page-805）", () => {
    expectCatalogText("RS-481", TEXT);
    expectStats("RS-481", {
      name: "天空神",
      category: "MA",
      size: "L",
      bp: 4000,
      sp: 1,
      powerCost: "5+",
      features: ["メカ", "人型", "航空機"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-481: 追加条件 — 自軍「天空神・飛行モード」1体を捨札にしてラッシュできる（出典: atwiki/page-805「追加条件：自軍「天空神・飛行モード」1体を捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-481", "tk")], rush: [inst("RS-482", "fm")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-481:tk");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-481:tk")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-482:fm")).toBe("discard");
  });

  it("RS-481: 追加条件 — 「天空神・飛行モード」がいなければラッシュできない／パワー4ではラッシュできない（出典: atwiki/page-805「必要パワー：5+」）", () => {
    const none = st({ phase: "rush", player1: { hand: [inst("RS-481", "tk")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("MA", 1), power: powerCards(8), deck: deckCards(3) } });
    expect(canStartRush(none, "player1", "RS-481:tk")).toBe(false);
    const low = st({ phase: "rush", player1: { hand: [inst("RS-481", "tk")], rush: [inst("RS-482", "fm")], command: releasedCat("MA", 1), power: powerCards(4), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-481:tk")).toBe(false);
  });

  noAttackFromNonAircraftTests("RS-481", "page-805");

  const hover = (activePlayer: "player1" | "player2" = "player1") => {
    const s0 = st({
      activePlayer,
      player1: { rush: [inst("RS-481", "tk")], deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-0", "bs")],
        rush: [inst("TST-UNIT-0", "rs"), inst("TST-UNIT-2", "rm")],
        deck: deckCards(3, "e"),
      },
    });
    return activePlayer === "player1" ? enter(s0, "RS-481:tk") : enterBattleByEffect(s0, "player1", "RS-481:tk");
  };

  // 既知の不具合: CARD-RS-481 【ホバリング】の候補が敵軍ラッシュエリアの S ユニットではなく、敵軍バトルエリアのユニット（サイズ制限なし）になっている
  it.fails("RS-481: 【ホバリング】自軍ターン中に出たとき、敵軍ラッシュエリアの S ユニットだけを選べる（バトルエリア・M は不可）（出典: atwiki/page-805「敵軍ラッシュエリアからSユニットを1体選び」）", () => {
    const s = hover();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-481");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:rs"]);
  });

  // 既知の不具合: CARD-RS-481 【ホバリング】で敵軍ラッシュエリアの S ユニットを手札に戻せない（候補がバトルエリア）
  it.fails("RS-481: 【ホバリング】選んだユニットは持ち主（敵軍）の手札に戻る（出典: atwiki/page-805「持ち主の手札に戻してもよい」）", () => {
    const s = resolveAll(pick(hover(), "TST-UNIT-0:rs"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:rs")).toBe("hand");
  });

  it("RS-481: 【ホバリング】「戻してもよい」— 見送れる（出典: atwiki/page-805）", () => {
    let s = hover();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-481");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player2.rush).toHaveLength(2);
    expect(s.players.player2.battle).toHaveLength(1);
  });

  it("RS-481: 【ホバリング】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-805「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = hover("player2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-481");
  });
});

// ===========================================================================
describe("RS-482 天空神・飛行モード", () => {
  const TEXT =
    "※これは、特徴「航空機」を持たないユニットにアタックされない。【カラクリ忍法・天空裂破】これが自軍エリアにある間、特徴「航空機」を持たないMユニットは次の制限を受ける⇒アタックもストライクもできない。";

  it("RS-482: カタログ本文・スペックが出典と一致（出典: atwiki/page-806）", () => {
    expectCatalogText("RS-482", TEXT);
    expectStats("RS-482", {
      name: "天空神・飛行モード",
      category: "MA",
      size: "L",
      bp: 4000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-482: 追加条件 — 自軍 S ユニットを1体捨札にしてラッシュできる（出典: atwiki/page-806「追加条件：自軍Sユニットを1体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-482", "fm")], rush: [inst("TST-UNIT-0", "s")], command: releasedCat("MA", 1), power: powerCards(4), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-482:fm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-482:fm")).toBe("rush");
    expect(zoneOf(t, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RS-482: 追加条件 — 自軍 S ユニットがいなければ（M のみ）ラッシュできない（出典: atwiki/page-806）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-482", "fm")], rush: [inst("TST-UNIT-2", "m")], command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-482:fm")).toBe(false);
  });

  noAttackFromNonAircraftTests("RS-482", "page-806");

  /** player1 のターン。自軍に M（航空機なし）・M（航空機: ハリケンホーク）・S。 */
  const ownSide = (zone: "rush" | "battle" | "hand") =>
    st({
      player1: {
        battle: [inst("TST-UNIT-2", "m"), inst("RS-096", "hawk"), inst("TST-UNIT-0", "s")],
        [zone]: [inst("RS-482", "fm")],
        deck: deckCards(3),
      },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
    });

  it("RS-482: 【天空裂破】これが自軍エリアにある間、自軍の「航空機」を持たない M ユニットはアタックもストライクもできない（出典: atwiki/page-806「アタックもストライクもできない」）", () => {
    for (const zone of ["rush", "battle"] as const) {
      const s = ownSide(zone);
      expect(attackTargets(s, "TST-UNIT-2:m")).toEqual([]);
      expect(canStrike(s, "TST-UNIT-2:m")).toBe(false);
    }
  });

  it("RS-482: 【天空裂破】「航空機」を持つ M ユニット（ハリケンホーク）と S ユニットは制限を受けない（出典: atwiki/page-806「特徴「航空機」を持たないMユニットは」）", () => {
    const s = ownSide("rush");
    expect(attackTargets(s, "RS-096:hawk")).toEqual(["TST-UNIT-0:e"]);
    expect(attackTargets(s, "TST-UNIT-0:s")).toEqual(["TST-UNIT-0:e"]);
    expect(canStrike(s, "TST-UNIT-0:s")).toBe(true);
  });

  it("RS-482: 【天空裂破】これが自軍エリアにないとき（手札）は制限しない（出典: atwiki/page-806「これが自軍エリアにある間」）", () => {
    const s = ownSide("hand");
    expect(attackTargets(s, "TST-UNIT-2:m")).toEqual(["TST-UNIT-0:e"]);
    expect(canStrike(s, "TST-UNIT-2:m")).toBe(true);
  });

  // 既知の不具合: CARD-RS-482 【天空裂破】が持ち主の M ユニットだけを制限し、敵軍の M ユニットはアタック・ストライクできてしまう
  it.fails("RS-482: 【天空裂破】敵軍の「航空機」を持たない M ユニットもアタック・ストライクできない（自軍・敵軍の指定がない）（出典: atwiki/page-806「特徴「航空機」を持たないMユニットは次の制限を受ける」・R-TGT-04）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-482", "fm")], battle: [inst("TST-UNIT-0", "f")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "em")], deck: deckCards(3, "e") },
    });
    expect(attackTargets(s, "TST-UNIT-2:em", "player2")).toEqual([]);
    expect(canStrike(s, "TST-UNIT-2:em", "player2")).toBe(false);
  });
});

// ===========================================================================
describe("RS-483 シュリケンジャー", () => {
  const TEXT =
    "【宇宙統一忍者流】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアから、ナンバーに数字を持つSユニットを1体選んでも良い。そうしたとき、選んだユニットのＮＣの効果を、このユニットの効果として発動する。";

  it("RS-483: カタログ本文・スペックが出典と一致（出典: atwiki/page-745）", () => {
    expectCatalogText("RS-483", TEXT);
    expectStats("RS-483", {
      name: "シュリケンジャー",
      category: "MA",
      size: "S",
      bp: 5000,
      sp: undefined,
      powerCost: "3+",
      features: ["グリーン", "男", "忍者"],
      rushCondition: "discard_feature_unit",
    });
  });

  it("RS-483: 追加条件 — 特徴「男」を持つ自軍ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-745「追加条件：特徴「男」を持つ自軍ユニット1体を捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-483", "sj")], rush: [inst("RS-099", "man")], command: releasedCat("MA", 1), power: powerCards(3), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-483:sj");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-483:sj")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-099:man")).toBe("discard");
  });

  it("RS-483: 追加条件 — 「男」を持つユニットがいなければ（女のマジブルーのみ）ラッシュできない（出典: atwiki/page-745）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-483", "sj")], rush: [inst("RS-059", "woman")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-483:sj")).toBe(false);
  });

  /** 敵軍ラッシュエリア: マジブルー（S・CN2【未来予知】1枚ドロー）、ハリケンレッド（S・CN3）、ナンバーなしS、ガオイーグル（M・CN2）。敵軍バトルエリア: マジブルー。 */
  const shuri = (activePlayer: "player1" | "player2" = "player1") => {
    const s0 = st({
      activePlayer,
      player1: { rush: [inst("RS-483", "sj")], deck: deckCards(5) },
      player2: {
        battle: [inst("RS-059", "bblue")],
        rush: [inst("RS-059", "blue"), inst("RS-099", "red"), inst("TST-UNIT-0", "nonum"), inst("RS-153", "eagle")],
        deck: deckCards(5, "e"),
      },
    });
    return activePlayer === "player1" ? enter(s0, "RS-483:sj") : enterBattleByEffect(s0, "player1", "RS-483:sj");
  };

  // 既知の不具合: CARD-RS-483 【宇宙統一忍者流】が実装されておらず（copy_nc_from_rush_s のキーワード付与のみ）、敵軍ラッシュエリアのユニットを選ぶ選択が出ない
  it.fails("RS-483: 【宇宙統一忍者流】敵軍ラッシュエリアの、ナンバーに数字を持つ S ユニットだけを選べる（出典: atwiki/page-745「敵軍ラッシュエリアから、ナンバーに数字を持つSユニットを1体選んでも良い」）", () => {
    const s = shuri();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-483");
    expect(choiceIds(s)).toEqual(["RS-059:blue", "RS-099:red"]);
  });

  // 既知の不具合: CARD-RS-483 【宇宙統一忍者流】で選んだユニットの NC 効果（マジブルー【未来予知】の1枚ドロー）が自分の効果として発動しない
  it.fails("RS-483: 【宇宙統一忍者流】選んだユニットの NC 効果をこのユニットの効果として発動する（マジブルー → 自分が1枚ドロー）（出典: atwiki/page-745「選んだユニットのＮＣの効果を、このユニットの効果として発動する」）", () => {
    const s = resolveAll(pick(shuri(), "RS-059:blue"));
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RS-483: 【宇宙統一忍者流】「選んでも良い」— 選ばなければ何も起きない（出典: atwiki/page-745）", () => {
    let s = shuri();
    if (s.pendingEffectChoice?.sourceCardId === "RS-483") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = settle(s);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-483: 【宇宙統一忍者流】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-745「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = shuri("player2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-483");
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-484 旋風神ハリアー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「旋風神」のカードを1枚選び、自軍ラッシュエリアに出す。【ハリーアップ！】これが自軍エリアにある間、自分がターンを終えるとき、自分の手札から「旋風神ハリアー」のカードを1枚選び捨札にしてもよい。そうしたとき、このターンの後、自分は追加でもう一度ターンを行う。";

  it("RS-484: カタログ本文・スペックが出典と一致（出典: atwiki/page-752）", () => {
    expectCatalogText("RS-484", TEXT);
    expectStats("RS-484", {
      name: "旋風神ハリアー",
      category: "MA",
      size: "L",
      bp: 16500,
      sp: 1,
      powerCost: "14-",
      features: ["メカ", "人型"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-484: 追加条件 — 自軍「旋風神」1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-752「自軍「旋風神」1体を捨札にすれば必要パワー0になる」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-484", "ha")], rush: [inst("RS-095", "sp")], command: releasedCat("MA", 1), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", "RS-484:ha", (a) => a.zordMaterialInstanceId === "RS-095:sp");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-484:ha")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-095:sp")).toBe("discard");
  });

  it("RS-484: 必要パワー14- — 「旋風神」がいなければパワー14でラッシュでき、13ではラッシュできない（出典: atwiki/page-752「必要パワー：14－」・R-ADD-02）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-484", "ha")], command: releasedCat("MA", 1), power: powerCards(n), deck: deckCards(3) } });
    expect(canStartRush(mk(13), "player1", "RS-484:ha")).toBe(false);
    const r = rushFromHand(mk(14), "player1", "RS-484:ha");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-484:ha")).toBe("rush");
  });

  /** 敵軍ターン: BP30000 の L ユニットがハリアー（BP16500）にアタックして撃破する。 */
  const BIG = sUnit("SPEC-BIG", { bp: 30000, size: "L" });
  const killHarrier = (discard: ReturnType<typeof inst>[], p2discard: ReturnType<typeof inst>[] = [], attacker = "SPEC-BIG") =>
    settle(
      attack(
        st(
          {
            activePlayer: "player2",
            player1: { battle: [inst("RS-484", "ha")], discard, deck: deckCards(5) },
            player2: { battle: [inst(attacker, "atk")], discard: p2discard, deck: deckCards(5, "e") },
          },
          [BIG],
        ),
        `${attacker}:atk`,
        "RS-484:ha",
        "player2",
      ),
    );

  it("RS-484: ※ 撃破されて捨札になったとき、自軍捨札の「旋風神」のカードだけを選び自軍ラッシュエリアに出す（強制）（出典: atwiki/page-752「自軍捨札から「旋風神」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    let s = killHarrier([inst("TST-UNIT-0", "other"), inst("RS-095", "p"), inst("RS-095", "p2")]);
    expect(zoneOf(s, "player1", "RS-484:ha")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-484");
    expect(choiceIds(s)).toEqual(["RS-095:p", "RS-095:p2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "RS-095:p2"));
    expect(zoneOf(s, "player1", "RS-095:p2")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-095:p")).toBe("discard");
  });

  it("RS-484: ※ 自軍捨札に「旋風神」がなければ何も出さない（敵軍捨札の旋風神は対象外）（出典: atwiki/page-752「自軍捨札から」）", () => {
    const s = resolveAll(killHarrier([inst("TST-UNIT-0", "other")], [inst("RS-095", "ep")]));
    expect(zoneOf(s, "player1", "RS-484:ha")).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
    expect(zoneOf(s, "player2", "RS-095:ep")).toBe("discard");
  });

  it("RS-484: ※ 撃破されずに場に残ったときは何も出さない（出典: atwiki/page-752「撃破されて捨札になったとき」）", () => {
    const s = resolveAll(killHarrier([inst("RS-095", "p")], [], "TST-UNIT-7"));
    expect(zoneOf(s, "player1", "RS-484:ha")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-095:p")).toBe("discard");
  });

  /** 自軍バトルフェイズ。ハリアーが zone にあり、手札に handIds。 */
  const hurry = (zone: "rush" | "battle" | "hand", handIds: string[]) =>
    st({
      player1: {
        [zone]: [inst("RS-484", "ha")],
        hand: [...(zone === "hand" ? [inst("RS-484", "ha")] : []), ...handIds.map((id, i) => inst(id, `h${i}`))],
        deck: deckCards(6),
      },
      player2: { deck: deckCards(6, "e") },
    });

  /** ハリアーの選択が出るか、相手のターンになるまでフェイズを終える。 */
  const endOnce = (s0: GameState) => {
    let s = settle(s0);
    for (let i = 0; i < 6 && s.activePlayer === "player1" && s.pendingEffectChoice?.sourceCardId !== "RS-484"; i++) {
      const end = legal(s).find((a) => a.type === "end_phase");
      if (!end) break;
      s = settle(act(s, end));
    }
    return s;
  };

  /** turn 番号のターンが終わり次のターンに入るまで進め（任意の選択は見送る）、次のターンのプレイヤーを返す。 */
  const nextTurnPlayer = (s0: GameState, turn = s0.turn) => {
    let s = settle(s0);
    for (let i = 0; i < 10 && s.turn === turn; i++) {
      if (s.pendingEffectChoice) s = canSkip(s) ? skip(s) : pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
      const end = legal(s).find((a) => a.type === "end_phase");
      if (s.turn !== turn) break;
      if (!end) break;
      s = settle(act(s, end));
    }
    expect(s.turn).toBe(turn + 1);
    return s.activePlayer;
  };

  // 既知の不具合: CARD-RS-484 【ハリーアップ！】が実装されておらず、ターンを終えるときに手札のハリアーを捨札にする選択が出ない
  it.fails("RS-484: 【ハリーアップ！】ターンを終えるとき手札の「旋風神ハリアー」を捨札にすると、このターンの後に自分がもう一度ターンを行う（出典: atwiki/page-752「このターンの後、自分は追加でもう一度ターンを行う」）", () => {
    let s = endOnce(hurry("rush", ["RS-484", "TST-OP"]));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-484");
    expect(choiceIds(s)).toEqual(["RS-484:h0"]);
    s = resolveAll(pick(s, "RS-484:h0"));
    expect(zoneOf(s, "player1", "RS-484:h0")).toBe("discard");
    expect(nextTurnPlayer(s, 1)).toBe("player1");
  });

  it("RS-484: 【ハリーアップ！】「捨札にしてもよい」— 見送れば通常どおり相手のターンになる（出典: atwiki/page-752）", () => {
    let s = endOnce(hurry("rush", ["RS-484"]));
    if (s.pendingEffectChoice?.sourceCardId === "RS-484") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    expect(s.players.player1.hand.some((c) => c.instanceId === "RS-484:h0")).toBe(true);
    expect(nextTurnPlayer(s, 1)).toBe("player2");
  });

  it("RS-484: 【ハリーアップ！】手札に「旋風神ハリアー」がなければ追加ターンはない（出典: atwiki/page-752「自分の手札から「旋風神ハリアー」のカードを1枚選び」）", () => {
    const s = hurry("rush", ["RS-095"]);
    expect(nextTurnPlayer(s)).toBe("player2");
  });

  it("RS-484: 【ハリーアップ！】これが自軍エリアにないとき（手札にあるだけ）は発動しない（出典: atwiki/page-752「これが自軍エリアにある間」）", () => {
    const s = hurry("hand", ["RS-484"]);
    expect(endOnce(s).pendingEffectChoice?.sourceCardId).not.toBe("RS-484");
    expect(nextTurnPlayer(s)).toBe("player2");
  });
});

// ===========================================================================
describe("RS-485 ハムスター館長", () => {
  const TEXT =
    "※これはバトルエリアに出られない。【疾風流の継承】これが自軍ラッシュエリアにある間、特徴「忍者」を持つユニットがストライクしたとき、そのユニットの持ち主は1枚ドローしてもよい。また、これが撃破されて捨札になったとき、このカードの持ち主は、特徴「忍者」を持つ自軍ユニットの数と同じ枚数までドローしてもよい。";

  it("RS-485: カタログ本文・スペックが出典と一致（出典: atwiki/page-807）", () => {
    expectCatalogText("RS-485", TEXT);
    expectStats("RS-485", {
      name: "ハムスター館長",
      category: "MA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 0,
      features: ["男", "忍者"],
      rushCondition: undefined,
    });
  });

  it("RS-485: ※ バトルエリアに出られない（出典: atwiki/page-807「これはバトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-485", "hm"), inst("TST-UNIT-0", "s")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-485:hm")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:s")).toBe(true);
  });

  /** 指定プレイヤーのターンに、そのプレイヤーのバトルエリアの striker がストライクする。ハムスター館長は player1 の hamZone。 */
  const strikeWith = (striker: string, opts: { owner?: "player1" | "player2"; hamZone?: "rush" | "hand" } = {}) => {
    const owner = opts.owner ?? "player1";
    const other = owner === "player1" ? "player2" : "player1";
    const s0 = st(
      {
        activePlayer: owner,
        player1: { [opts.hamZone ?? "rush"]: [inst("RS-485", "hm")], deck: deckCards(5) },
        player2: { deck: deckCards(5, "e") },
      },
      [NINJA_S],
    );
    const s1: GameState = {
      ...s0,
      players: {
        ...s0.players,
        [owner]: { ...s0.players[owner], battle: [inst(striker.split(":")[0]!, striker.split(":")[1]!)] },
        [other]: s0.players[other],
      },
    };
    return strike(s1, striker, owner);
  };

  const handOf = (s: GameState, p: "player1" | "player2") => s.players[p].hand.length;

  // 既知の不具合: CARD-RS-485 【疾風流の継承】が実装されておらず、忍者ユニットがストライクしてもドローできない
  it.fails("RS-485: 【疾風流の継承】自軍ラッシュエリアにある間、自軍の特徴「忍者」を持つユニットがストライクしたとき、持ち主（自分）は1枚ドローできる（出典: atwiki/page-807「そのユニットの持ち主は1枚ドローしてもよい」）", () => {
    const s = resolveAll(strikeWith("SPEC-NINJA:n"));
    expect(handOf(s, "player1")).toBe(1);
  });

  // 既知の不具合: CARD-RS-485 【疾風流の継承】が実装されておらず、ドローの選択（見送り可）が出ない
  it.fails("RS-485: 【疾風流の継承】「ドローしてもよい」— ドローしないことを選べる（出典: atwiki/page-807「1枚ドローしてもよい」）", () => {
    const s = strikeWith("SPEC-NINJA:n");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-485");
    expect(canSkip(s)).toBe(true);
    expect(handOf(resolveAll(skip(s)), "player1")).toBe(0);
  });

  it("RS-485: 【疾風流の継承】特徴「忍者」を持たないユニットのストライクではドローしない（出典: atwiki/page-807「特徴「忍者」を持つユニットがストライクしたとき」）", () => {
    const s = resolveAll(strikeWith("TST-UNIT-0:x"));
    expect(handOf(s, "player1")).toBe(0);
  });

  it("RS-485: 【疾風流の継承】これが自軍ラッシュエリアにないとき（手札）はドローしない（出典: atwiki/page-807「これが自軍ラッシュエリアにある間」）", () => {
    const s = resolveAll(strikeWith("SPEC-NINJA:n", { hamZone: "hand" }));
    expect(handOf(s, "player1")).toBe(1); // ハムスター館長自身の1枚のみ
  });

  // 既知の不具合: CARD-RS-485 【疾風流の継承】が敵軍の忍者ユニットのストライクで発動せず、その持ち主（相手）がドローできない
  it.fails("RS-485: 【疾風流の継承】敵軍の「忍者」を持つユニットがストライクしたときも、その持ち主（相手）が1枚ドローできる（出典: atwiki/page-807「特徴「忍者」を持つユニットがストライクしたとき、そのユニットの持ち主は」）", () => {
    const s = resolveAll(strikeWith("SPEC-NINJA:en", { owner: "player2" }));
    expect(handOf(s, "player2")).toBe(1);
    expect(handOf(s, "player1")).toBe(0);
  });

  /** 敵軍ラッシュフェイズ: 相手がガオメインバスター（敵軍Sユニットを1体選び撃破）でハムスター館長を撃破する。自軍に忍者ユニット ninjas 体。 */
  const destroyHamster = (ninjas: number) => {
    const s0 = st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: { rush: [inst("RS-485", "hm"), ...Array.from({ length: ninjas }, (_, i) => inst("SPEC-NINJA", `nj${i}`))], deck: deckCards(6) },
        player2: { hand: [inst("RS-245", "gmb")], command: releasedCat("WB", 2), power: powerCards(5), deck: deckCards(5, "e") },
      },
      [NINJA_S],
    );
    const r = playOp(s0, "player2", "RS-245:gmb", "RS-485:hm");
    expect(r.ok).toBe(true);
    return r.state;
  };

  // 既知の不具合: CARD-RS-485 【疾風流の継承】の「撃破されて捨札になったとき」のドローが実装されていない
  it.fails("RS-485: 【疾風流の継承】撃破されて捨札になったとき、特徴「忍者」を持つ自軍ユニットの数（2）までドローできる（出典: atwiki/page-807「特徴「忍者」を持つ自軍ユニットの数と同じ枚数までドローしてもよい」）", () => {
    const s = resolveAll(destroyHamster(2));
    expect(zoneOf(s, "player1", "RS-485:hm")).toBe("discard");
    expect(handOf(s, "player1")).toBe(2);
  });

  it("RS-485: 【疾風流の継承】撃破されて捨札になったとき、「忍者」を持つ自軍ユニットがいなければドローしない（出典: atwiki/page-807）", () => {
    const s = resolveAll(destroyHamster(0));
    expect(zoneOf(s, "player1", "RS-485:hm")).toBe("discard");
    expect(handOf(s, "player1")).toBe(0);
  });

  it.todo(
    "RS-485: 【疾風流の継承】撃破時のドローは「まで」— 0〜上限の任意の枚数を選べる（出典: atwiki/page-807「同じ枚数までドローしてもよい」）— 撃破時のドロー自体が未実装で、枚数を選ぶ合法手が存在せず観測できない",
  );
});

// ===========================================================================
/** 自軍バトルフェイズ: 1番目に jc（CN L の M）、その次に lId の L ユニットを出す。 */
function jcEnter(jc: string, lId: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
  const s = st({
    player1: { battle: [inst(jc, "jc")], rush: [inst(lId, "l")], deck: deckCards(6), ...p1 },
    player2: { deck: deckCards(6, "e"), ...p2 },
  });
  return enter(s, `${lId}:l`);
}

describe("RS-486 ソードスラッシャー", () => {
  // R-ERR-RS486（grnrngr/faq-card-7 RS-486 Q の読み替え後）
  const TEXT =
    "※これはSユニットにアタックされない。【分身幻斬り】これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたLユニットがアタックまたはストライクしたとき、その処理をすべて終えてから、そのLユニットと同じカード名のユニットカードを、その合体に必要なユニットの数まで、自分の手札から好きな枚数選び、自軍ラッシュエリアに出してもよい。";

  it("RS-486: カタログ本文（エラッタ後）・スペックが出典と一致（出典: docs/rules/08-errata.md R-ERR-RS486・grnrngr/faq-card-7 RS-486 Q・atwiki/page-808）", () => {
    expectCatalogText("RS-486", TEXT);
    expectStats("RS-486", {
      name: "ソードスラッシャー",
      category: "MA",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: "L" as unknown as number,
      features: ["メカ", "カラクリボール"],
      rushCondition: undefined,
    });
  });

  noAttackFromSTests("RS-486", "page-808");

  /** ソードスラッシャー → 旋風神（MA・L、合体3体）。手札に旋風神4枚と他のカード。 */
  const slash = () =>
    jcEnter("RS-486", "RS-095", {
      hand: [inst("RS-095", "h1"), inst("RS-095", "h2"), inst("RS-095", "h3"), inst("RS-095", "h4"), inst("TST-UNIT-0", "other")],
      discard: [inst("RS-095", "dis")],
      command: [inst("RS-095", "cmd")],
    });

  // 既知の不具合: CARD-RS-486 【分身幻斬り】がジョイントコンビネーションとして実装されておらず、L ユニットのストライク後に手札の同名カードを出す選択が出ない
  it.fails("RS-486: 【分身幻斬り】同カテゴリ（MA）の L ユニットがストライクしたとき、その処理を終えてから、手札の同名カード（旋風神）だけを選び、合体に必要な数（3）まで自軍ラッシュエリアに出せる（出典: grnrngr/faq-card-7 RS-486 Q「手札から選びます」・atwiki/page-808）", () => {
    let s = resolveAll(slash(), []);
    s = strike(s, "RS-095:l");
    s = settle(s);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-486");
    expect(choiceIds(s)).toEqual(["RS-095:h1", "RS-095:h2", "RS-095:h3", "RS-095:h4"]);
    s = resolveAll(s, ["RS-095:h1", "RS-095:h2", "RS-095:h3", "RS-095:h4"]);
    expect(s.players.player1.rush.filter((c) => c.cardId === "RS-095")).toHaveLength(3);
    expect(zoneOf(s, "player1", "RS-095:dis")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-095:cmd")).toBe("command");
  });

  // 既知の不具合: CARD-RS-486 【分身幻斬り】が実装されておらず、L ユニットがアタックしたときも同名カードを出せない
  it.fails("RS-486: 【分身幻斬り】L ユニットがアタックしたときも、そのバトルの処理を終えてから手札の同名カードを出せる（出典: atwiki/page-808「アタックまたはストライクしたとき、その処理をすべて終えてから」）", () => {
    let s = resolveAll(slash(), []);
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, battle: [inst("TST-UNIT-0", "e")] } } };
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-095:l", defenderInstanceId: "TST-UNIT-0:e" });
    s = resolveAll(s, ["RS-095:h1"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-095:h1")).toBe("rush");
  });

  it("RS-486: 【分身幻斬り】カテゴリが違う L ユニット（WB の TST-UNIT-7）がコンビネーションしても、ストライク後に何も出ない（出典: atwiki/page-808「これと同カテゴリのLユニット」）", () => {
    let s = resolveAll(jcEnter("RS-486", "TST-UNIT-7", { hand: [inst("TST-UNIT-7", "h1")] }), []);
    s = resolveAll(strike(s, "TST-UNIT-7:l"), ["TST-UNIT-7:h1"]);
    expect(zoneOf(s, "player1", "TST-UNIT-7:h1")).toBe("hand");
  });

  it("RS-486: 【分身幻斬り】コンビネーションしていない（ソードスラッシャーの次でない）L ユニットのストライクでは何も出ない（出典: atwiki/page-808「このユニットからコンビネーションするとき」・R-CN-05）", () => {
    let s = st({
      player1: { battle: [inst("RS-486", "jc"), inst("TST-UNIT-0", "mid")], rush: [inst("RS-095", "l")], hand: [inst("RS-095", "h1")], deck: deckCards(6) },
      player2: { deck: deckCards(6, "e") },
    });
    s = resolveAll(enter(s, "RS-095:l"), []);
    s = resolveAll(strike(s, "RS-095:l"), ["RS-095:h1"]);
    expect(zoneOf(s, "player1", "RS-095:h1")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-487 ゴートクラッシャー", () => {
  const TEXT =
    "※これはSユニットにアタックされない。【疾風豪快落とし】これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒追加条件を持たない敵軍ユニットを、コンビネーションしたLユニットの合体に必要なユニットの数まで好きな数選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RS-487: カタログ本文・スペックが出典と一致（出典: atwiki/page-809）", () => {
    expectCatalogText("RS-487", TEXT);
    expectStats("RS-487", {
      name: "ゴートクラッシャー",
      category: "MA",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 6,
      comboNumber: "L" as unknown as number,
      features: ["メカ", "カラクリボール"],
      rushCondition: undefined,
    });
  });

  noAttackFromSTests("RS-487", "page-809");

  /** 敵軍: 追加条件なしのユニット4体（バトル2・ラッシュ2）と、追加条件ありの旋風神（ラッシュ）。 */
  const ENEMY = {
    battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-2", "b2")],
    rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2"), inst("RS-095", "cond")],
  };

  // 既知の不具合: CARD-RS-487 【疾風豪快落とし】がジョイントコンビネーションとして発動せず、敵軍ユニットを選ぶ選択が出ない
  it.fails("RS-487: 【疾風豪快落とし】同カテゴリ（MA）の L ユニット（旋風神・合体3体）がコンビネーションするとき、追加条件を持たない敵軍ユニットだけを選べる（出典: atwiki/page-809「追加条件を持たない敵軍ユニットを」）", () => {
    const s = jcEnter("RS-487", "RS-095", {}, ENEMY);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-487");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:b1", "TST-UNIT-0:r1", "TST-UNIT-0:r2", "TST-UNIT-2:b2"]);
  });

  // 既知の不具合: CARD-RS-487 【疾風豪快落とし】が発動せず、敵軍ユニットがダメージにならない
  it.fails("RS-487: 【疾風豪快落とし】合体に必要なユニットの数（3）まで選び、持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-809「合体に必要なユニットの数まで好きな数選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(jcEnter("RS-487", "RS-095", {}, ENEMY), ["TST-UNIT-0:b1", "TST-UNIT-2:b2", "TST-UNIT-0:r1", "TST-UNIT-0:r2"]);
    const dmg = s.players.player2.power.filter((c) => c.faceDown);
    expect(dmg).toHaveLength(3);
    expect(zoneOf(s, "player2", "TST-UNIT-0:r2")).toBe("rush");
  });

  it("RS-487: 【疾風豪快落とし】「発動できる」— 発動しないことを選べ、そのとき敵軍ユニットは残る（出典: atwiki/page-809「次の効果を発動できる」）", () => {
    let s = jcEnter("RS-487", "RS-095", {}, ENEMY);
    if (s.pendingEffectChoice?.sourceCardId === "RS-487") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = settle(s);
    expect(s.players.player2.battle).toHaveLength(2);
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-487: 【疾風豪快落とし】カテゴリが違う L ユニット（WB の TST-UNIT-7）がコンビネーションしても発動しない（出典: atwiki/page-809「これと同カテゴリのLユニット」）", () => {
    const s = jcEnter("RS-487", "TST-UNIT-7", {}, ENEMY);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-487");
    expect(resolveAll(s).players.player2.power).toHaveLength(0);
  });

  // faq-card-8 RS-574 Q「いいえ、2体になります。…「マジフェニックス」も「一角聖馬ユニゴルオン」も、ユニット名として表記されているからです。」
  // 既知の不具合: CARD-RS-487 【疾風豪快落とし】が発動しないため、セイントカイザーからのコンビネーションでも選択が出ない
  it.fails("RS-487: 公式Q&A — セイントカイザー（合体―マジフェニックス＋一角聖馬ユニゴルオン）がコンビネーションしたときの「合体に必要なユニットの数」はビークルも数えて2体（出典: grnrngr/faq-card-8 RS-574 Q）", () => {
    let s = jcEnter("RS-487", "RS-574", {}, ENEMY);
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== "RS-487"; i++) {
      s = canSkip(s) ? skip(s) : pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-487");
    s = resolveAll(s, ["TST-UNIT-0:b1", "TST-UNIT-2:b2", "TST-UNIT-0:r1", "TST-UNIT-0:r2"]);
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(2);
  });
});

