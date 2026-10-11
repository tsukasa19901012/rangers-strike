/**
 * カード別スペック: RS-677〜RS-684（第9弾「蒼九の翼」シンケングリーン〜猿折神）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-card-9「ブラスト」
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。RS-678 は公式 Q&A の転記あり）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-TGT-01、R-KW-RESIST-*、R-KW-BLAST-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  attackUntilRegister,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  endTurn,
  enter,
  enterBattleByEffect,
  enterKeep,
  expectCatalogText,
  expectStats,
  fill,
  heldUnit,
  inst,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  rarityOf,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RS9-670-690.helpers";

/** 「SP1」だけの NC（3番目）を持つユニットの共通テスト。 */
function sp1NcTests(id: string, page: string, cn: number) {
  it(`${id}: NC（${cn}番目）— SP1 になりストライクできる（出典: ${page}「「SP1」」）`, () => {
    const s = resolveAll(ncEnter(`${id}:u`, cn - 1));
    expect(spOf(s, "player1", `${id}:u`)).toBe(1);
    expect(canStrike(s, `${id}:u`)).toBe(true);
  });

  it(`${id}: NC が成立しない（${cn + 1}番目）と SP！のままストライクできない（出典: R-CN-02・${page}「SP：！」）`, () => {
    const s = resolveAll(ncEnter(`${id}:u`, cn));
    expect(spOf(s, "player1", `${id}:u`)).toBe(0);
    expect(canStrike(s, `${id}:u`)).toBe(false);
  });
}

// ===========================================================================
describe("RS-677 シンケングリーン", () => {
  const TEXT = "【ウッドスピア】「SP1」";
  const PAGE = "atwiki/page-1426";

  it("RS-677: カタログ本文・スペックが出典と一致（出典: atwiki/page-1426）", () => {
    expectCatalogText("RS-677", TEXT);
    expectStats("RS-677", { name: "シンケングリーン", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 3, features: ["グリーン", "男", "侍"] });
    expect(rarityOf("RS-677")).toBe("N");
  });

  sp1NcTests("RS-677", PAGE, 3);
});

// ===========================================================================
describe("RS-678 シンケンイエロー", () => {
  const TEXT = "【ランドスライサー】このターン、次に自軍Sユニットが撃破されて捨札になったとき、そのカードを手札に戻してもよい。";
  const PAGE = "atwiki/page-1427";

  it("RS-678: カタログ本文・スペックが出典と一致（出典: atwiki/page-1427）", () => {
    expectCatalogText("RS-678", TEXT);
    expectStats("RS-678", { name: "シンケンイエロー", category: "MA", size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: 1, features: ["イエロー", "女", "侍"] });
    expect(rarityOf("RS-678")).toBe("N");
  });

  /** シンケンイエローを1番目（NC）に出し、自軍の S ユニット a・b が順に BP13000 の敵にアタックして撃破される。 */
  const yellowThen = (fillersBefore = 0) => {
    const s = p1Battle(
      { rush: [inst("RS-678", "y"), inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-2", "m")], battle: fill(fillersBefore) },
      { battle: [inst("TST-UNIT-7", "big")] },
    );
    return resolveAll(enterKeep(s, ["RS-678:y"]));
  };
  const suicide = (s: ReturnType<typeof yellowThen>, id: string) =>
    settle(attack(resolveAll(enterKeep(s, [id])), id, "TST-UNIT-7:big"));

  // 既知の不具合: CARD-RS-678 【ランドスライサー】が未実装（NC 後に自軍Sユニットが撃破されて捨札になっても手札に戻す選択が開かない）
  it.fails("RS-678: 【ランドスライサー】NC（1番目）— このターン次に自軍 S ユニットが撃破されて捨札になったとき、手札に戻すかを選べる（任意）（出典: atwiki/page-1427）", () => {
    const s = suicide(yellowThen(), "TST-UNIT-0:a");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-678");
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-678 【ランドスライサー】が未実装（NC 後に自軍Sユニットが撃破されて捨札になっても手札に戻す選択が開かない）
  it.fails("RS-678: 【ランドスライサー】戻すことを選ぶと、そのカードが手札に戻る（出典: atwiki/page-1427「そのカードを手札に戻してもよい」）", () => {
    const s = resolveAll(suicide(yellowThen(), "TST-UNIT-0:a"), ["TST-UNIT-0:a"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("hand");
  });

  // 既知の不具合: CARD-RS-678 【ランドスライサー】が未実装（NC 後に自軍Sユニットが撃破されて捨札になっても手札に戻す選択が開かない）
  it.fails("RS-678: 【ランドスライサー】戻さないことを選ぶと捨札に残る（出典: atwiki/page-1427「戻してもよい」）", () => {
    let s = suicide(yellowThen(), "TST-UNIT-0:a");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-678");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-678 【ランドスライサー】が未実装（NC 後に自軍Sユニットが撃破されて捨札になっても手札に戻す選択が開かない）
  it.fails("RS-678: Q1 — 戻せるのは「次に」撃破されて捨札になった1回だけで、2体目は戻せない（出典: atwiki/page-1427 Q&A A1「「このターン、次に自軍Sユニットが撃破されて捨札になったとき」１回だけ」）", () => {
    let s = resolveAll(suicide(yellowThen(), "TST-UNIT-0:a"), ["TST-UNIT-0:a"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("hand");
    s = suicide(s, "TST-UNIT-0:b");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-678");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-678 【ランドスライサー】がシンケンイエロー自身の撃破時の効果として扱われ、NC 不成立でもイエローが撃破されると手札に戻す選択が開く
  it.fails("RS-678: 【ランドスライサー】NC が成立していなければ、シンケンイエロー自身が撃破されても戻せない（出典: R-CN-02・atwiki/page-1427「【ランドスライサー】」は NC 効果）", () => {
    const s = settle(attack(yellowThen(1), "RS-678:y", "TST-UNIT-7:big"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-678");
    expect(zoneOf(resolveAll(s), "player1", "RS-678:y")).toBe("discard");
  });

  it("RS-678: 【ランドスライサー】M ユニットが撃破されても戻せない（出典: atwiki/page-1427「自軍Sユニットが」）", () => {
    const s = resolveAll(suicide(yellowThen(), "TST-UNIT-2:m"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:m")).toBe("discard");
  });

  it("RS-678: 【ランドスライサー】NC が成立しない（2番目）と撃破されても戻せない（出典: R-CN-02）", () => {
    const s = suicide(yellowThen(1), "TST-UNIT-0:a");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-678");
    expect(zoneOf(resolveAll(s), "player1", "TST-UNIT-0:a")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-678 【ランドスライサー】がシンケンイエロー自身の撃破時の効果として扱われ、敵軍ターンにイエローが撃破されても手札に戻す選択が開く
  it.fails("RS-678: 【ランドスライサー】「このターン」— 次の敵軍ターンに撃破されても戻せない（出典: atwiki/page-1427「このターン、」）", () => {
    const BIG = sUnit("SPEC-BIG", { bp: 9000 });
    // NC だけ成立させ、自軍ユニットは撃破されないまま敵軍ターンに入る。
    let s = p1Battle({ rush: [inst("RS-678", "y")] }, { rush: [inst("SPEC-BIG", "atk")] }, [BIG]);
    s = resolveAll(enterKeep(s, ["RS-678:y"]));
    s = toPhase(endTurn(s), "player2", "battle");
    s = enter(s, "SPEC-BIG:atk", "player2");
    s = settle(attack(s, "SPEC-BIG:atk", "RS-678:y", "player2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-678");
    expect(zoneOf(resolveAll(s), "player1", "RS-678:y")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-679 シンケンオー", () => {
  const TEXT =
    "合体―獅子折神＋龍折神＋亀折神＋熊折神＋猿折神 ※ブラスト 【ダイシンケン】自軍ターン中、これがバトルエリアに出たとき、相手は自分自身のバトルエリアからユニットを1体選び、自分自身のパワーゾーンにダメージにして置く。";
  const PAGE = "atwiki/page-1485";
  const PARTS = ["RS-680", "RS-681", "RS-682", "RS-683", "RS-684"];

  it("RS-679: カタログ本文・スペックが出典と一致（出典: atwiki/page-1485）", () => {
    expectCatalogText("RS-679", TEXT);
    expectStats("RS-679", { name: "シンケンオー", category: "MA", size: "L", bp: 17000, sp: 1, powerCost: "5+", features: ["人型", "侍"], rushCondition: "discard_fusion_unit" });
  });

  // 既知の不具合: CARD-RS-679 カタログのレアリティが N（atwiki はスーパーレア）
  it.fails("RS-679: レアリティはスーパーレア（出典: atwiki/page-1485「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-679")).toBe("SR");
  });

  const rushBoard = (parts: string[], power = powerCards(5), extraRush: ReturnType<typeof inst>[] = [], damage = 0) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-679", "o")], rush: [...parts.map((p, i) => inst(p, `p${i}`)), ...extraRush], command: releasedCat("MA", 1), power, damage, deck: deckCards(3) },
    });

  it("RS-679: 合体 — 自軍の獅子・龍・亀・熊・猿折神を捨札にしてラッシュできる（出典: atwiki/page-1485「合体―…」「追加条件：自軍合体ユニットを捨札にする」）", () => {
    const r = rushFromHand(rushBoard(PARTS), "player1", "RS-679:o");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-679:o")).toBe("rush");
    for (let i = 0; i < PARTS.length; i++) expect(zoneOf(s, "player1", `${PARTS[i]}:p${i}`)).toBe("discard");
  });

  it("RS-679: 合体 — 素材が1体（猿折神）欠けるとラッシュできない（出典: atwiki/page-1485「合体―獅子折神＋龍折神＋亀折神＋熊折神＋猿折神」）", () => {
    expect(canStartRush(rushBoard(PARTS.slice(0, 4)), "player1", "RS-679:o")).toBe(false);
  });

  it("RS-679: ※ブラスト — ダメージ6点で自軍 L ユニットがなければ、素材なしでラッシュできる（出典: grnrngr/faq-card-9 ブラスト「※ブラスト（自分がゲームに負けるまで残りダメージ１点で、自軍Ｌユニットが１体もなければ…）」）", () => {
    const r = rushFromHand(rushBoard([], damageCards(6), [], 6), "player1", "RS-679:o");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-679:o")).toBe("rush");
  });

  it("RS-679: ※ブラスト — 自軍 L ユニットがあれば使えない（出典: grnrngr/faq-card-9 ブラスト「自軍Ｌユニットが１体もなければ」）", () => {
    expect(canStartRush(rushBoard([], damageCards(6), [inst("TST-UNIT-7", "L")], 6), "player1", "RS-679:o")).toBe(false);
  });

  it("RS-679: ※ブラスト — ダメージ5点（残り2点）では使えない（出典: grnrngr/faq-card-9 ブラスト「残りダメージ１点で」）", () => {
    expect(canStartRush(rushBoard([], [...damageCards(5), ...powerCards(1)], [], 5), "player1", "RS-679:o")).toBe(false);
  });

  /** 自軍バトルフェイズにシンケンオーをバトルエリアに出す（L ユニットの進入コストは先頭のリリース状態コマンド）。 */
  const daishinken = (enemyBattle: ReturnType<typeof inst>[]) =>
    act(
      p1Battle({ rush: [inst("RS-679", "o")], command: releasedCat("MA", 3) }, { battle: enemyBattle, rush: [inst("TST-UNIT-0", "er")] }),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-679:o" },
    );

  // 既知の不具合: CARD-RS-679 【ダイシンケン】が未実装（バトルエリアに出ても相手の選択が開かず何も起きない）
  it.fails("RS-679: 【ダイシンケン】自軍ターン中にバトルエリアに出たとき、相手が自分のバトルエリアのユニットを選ぶ（ラッシュエリアは候補外）（出典: atwiki/page-1485「相手は自分自身のバトルエリアからユニットを1体選び」）", () => {
    const s = daishinken([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "e2")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-679");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-2:e2"]);
  });

  // 既知の不具合: CARD-RS-679 【ダイシンケン】が未実装（バトルエリアに出ても相手の選択が開かず何も起きない）
  it.fails("RS-679: 【ダイシンケン】強制 — 相手は選ばないことはできず、選んだユニットは相手のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-1485「自分自身のパワーゾーンにダメージにして置く」）", () => {
    let s = daishinken([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "e2")]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-2:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-2:e2")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-679: 【ダイシンケン】相手のバトルエリアにユニットがなければ何も起きない（出典: atwiki/page-1485「バトルエリアからユニットを1体選び」）", () => {
    const s = resolveAll(daishinken([]));
    expect(damageOf(s, "player2")).toBe(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("rush");
  });

  it("RS-679: 【ダイシンケン】敵軍ターン中に効果でバトルエリアに出ても発動しない（出典: atwiki/page-1485「自軍ターン中、」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-679", "o")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-679:o"));
    expect(zoneOf(s, "player1", "RS-679:o")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RS-680 獅子折神", () => {
  const TEXT = "※レジスト 【燃え盛る咆哮】「SP1」";
  const PAGE = "atwiki/page-1480";

  it("RS-680: カタログ本文・スペックが出典と一致（出典: atwiki/page-1480）", () => {
    expectCatalogText("RS-680", TEXT);
    expectStats("RS-680", { name: "獅子折神", category: "MA", size: "M", bp: 3000, sp: "special", powerCost: 4, comboNumber: 3, features: ["獣", "折神獣"] });
    expect(rarityOf("RS-680")).toBe("N");
  });

  it("RS-680: ※レジスト — 敵軍ターン中にバトルで撃破されるときレジストできる（出典: atwiki/page-1480「※レジスト」・R-KW-RESIST-01）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-680", "u")] }, "RS-680:u");
    expect(registerOffered(s)).toBe(true);
  });

  sp1NcTests("RS-680", PAGE, 3);
});

// ===========================================================================
describe("RS-681 龍折神", () => {
  const TEXT = "【押し寄せる水流】敵軍ラッシュエリアのホールド状態のユニットをすべて持ち主の山札に戻してシャッフルしてもよい。";
  const PAGE = "atwiki/page-1481";

  it("RS-681: カタログ本文・スペックが出典と一致（出典: atwiki/page-1481）", () => {
    expectCatalogText("RS-681", TEXT);
    expectStats("RS-681", { name: "龍折神", category: "MA", size: "M", bp: 4000, sp: undefined, powerCost: 3, comboNumber: 4, features: ["獣", "折神獣", "ドラゴン"] });
    expect(rarityOf("RS-681")).toBe("N");
  });

  const board = (fillers: number) =>
    ncEnter(
      "RS-681:d",
      fillers,
      { rush: [heldUnit("TST-UNIT-0", "ownheld")] },
      {
        rush: [heldUnit("TST-UNIT-0", "h1"), heldUnit("TST-UNIT-2", "h2"), inst("TST-UNIT-0", "rel")],
        battle: [heldUnit("TST-UNIT-0", "hb")],
      },
    );

  it("RS-681: 【押し寄せる水流】NC（4番目）— 任意（戻さないことも選べる）（出典: atwiki/page-1481「戻してシャッフルしてもよい」）", () => {
    const s = board(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-681");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(zoneOf(t, "player2", "TST-UNIT-0:h1")).toBe("rush");
    expect(zoneOf(t, "player2", "TST-UNIT-2:h2")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-681 【押し寄せる水流】の対象が誤り（敵軍バトルエリアのホールド状態のユニットを1体だけ選ぶ形になり、ラッシュエリアのユニットは戻らない）
  it.fails("RS-681: 【押し寄せる水流】敵軍ラッシュエリアのホールド状態のユニットをすべて持ち主の山札に戻す（リリース状態・バトルエリア・自軍のユニットは残る）（出典: atwiki/page-1481）", () => {
    const s = resolveAll(board(3), ["TST-UNIT-0:h1", "TST-UNIT-2:h2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:h1")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-2:h2")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-0:rel")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:ownheld")).toBe("rush");
  });

  it("RS-681: 【押し寄せる水流】NC が成立しない（3番目）と何も戻らない（出典: R-CN-02）", () => {
    const s = board(2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-681");
    const t = resolveAll(s);
    expect(zoneOf(t, "player2", "TST-UNIT-0:h1")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-682 亀折神", () => {
  const TEXT = "※レジスト ※これはアタックすることができない。 【堅牢なる甲羅】レジストを持つ自軍Mユニットを1体選び、リリースしてもよい。";
  const PAGE = "atwiki/page-1482";

  it("RS-682: カタログ本文・スペックが出典と一致（出典: atwiki/page-1482）", () => {
    expectCatalogText("RS-682", TEXT);
    expectStats("RS-682", { name: "亀折神", category: "MA", size: "M", bp: 6000, sp: undefined, powerCost: 3, comboNumber: 4, features: ["獣", "折神獣"] });
    expect(rarityOf("RS-682")).toBe("N");
  });

  it("RS-682: ※レジスト — 敵軍ターン中にバトルで撃破されるときレジストできる（出典: atwiki/page-1482「※レジスト」）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-682", "k")] }, "RS-682:k");
    expect(registerOffered(s)).toBe(true);
  });

  it("RS-682: ※ アタックすることができない（他のユニットはアタックできる）（出典: atwiki/page-1482「※これはアタックすることができない」）", () => {
    const s = resolveAll(p1Battle({ battle: [inst("RS-682", "k"), inst("TST-UNIT-0", "x")] }, { battle: [inst("TST-UNIT-0", "e")] }));
    expect(attackTargets(s, "RS-682:k")).toEqual([]);
    expect(attackTargets(s, "TST-UNIT-0:x")).toContain("TST-UNIT-0:e");
  });

  const board = (fillers: number) =>
    ncEnter(
      "RS-682:k",
      fillers,
      { rush: [heldUnit("RS-680", "lion"), heldUnit("RS-674", "red"), heldUnit("TST-UNIT-2", "m")] },
      { rush: [heldUnit("RS-680", "elion")] },
    );

  // 既知の不具合: CARD-RS-682 【堅牢なる甲羅】の選択候補が空（レジストを持つ自軍Mユニットを選べず、確認だけで何もリリースしない）
  it.fails("RS-682: 【堅牢なる甲羅】NC（4番目）— 選べるのはレジストを持つ自軍 M ユニット（ホールド中の獅子折神）で、任意（出典: atwiki/page-1482）", () => {
    const s = board(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-682");
    expect(choiceIds(s)).toContain("RS-680:lion");
    expect(choiceIds(s)).not.toContain("RS-674:red");
    expect(choiceIds(s)).not.toContain("TST-UNIT-2:m");
    expect(choiceIds(s)).not.toContain("RS-680:elion");
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-682 【堅牢なる甲羅】の選択候補が空（レジストを持つ自軍Mユニットを選べず、確認だけで何もリリースしない）
  it.fails("RS-682: 【堅牢なる甲羅】選んだユニットはリリースされる（出典: atwiki/page-1482「リリースしてもよい」）", () => {
    const s = resolveAll(pick(board(3), "RS-680:lion"));
    expect(cardIn(s, "player1", "RS-680:lion")?.commandHeld ?? false).toBe(false);
    expect(cardIn(s, "player1", "RS-674:red")?.commandHeld).toBe(true);
  });

  it("RS-682: 【堅牢なる甲羅】選ばなければホールドのまま（出典: atwiki/page-1482「してもよい」）", () => {
    const s = resolveAll(skip(board(3)));
    expect(cardIn(s, "player1", "RS-680:lion")?.commandHeld).toBe(true);
  });

  it("RS-682: 【堅牢なる甲羅】NC が成立しない（3番目）とリリースされない（出典: R-CN-02）", () => {
    const s = board(2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-682");
    expect(cardIn(resolveAll(s), "player1", "RS-680:lion")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("RS-683 熊折神", () => {
  const TEXT = "【猛き爪】「SP1」";
  const PAGE = "atwiki/page-1483";

  it("RS-683: カタログ本文・スペックが出典と一致（出典: atwiki/page-1483）", () => {
    expectCatalogText("RS-683", TEXT);
    expectStats("RS-683", { name: "熊折神", category: "MA", size: "M", bp: 3000, sp: "special", powerCost: 3, comboNumber: 3, features: ["獣", "折神獣"] });
    expect(rarityOf("RS-683")).toBe("N");
  });

  sp1NcTests("RS-683", PAGE, 3);
});

// ===========================================================================
describe("RS-684 猿折神", () => {
  const TEXT = "【軽業】敵軍Sユニットが6体以上あれば、BPの一番低い敵軍ユニットを1体選び、持ち主の山札の上に戻してもよい。";
  const PAGE = "atwiki/page-1484";
  const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
  const M500 = sUnit("SPEC-M500", { bp: 500, size: "M" });

  it("RS-684: カタログ本文・スペックが出典と一致（出典: atwiki/page-1484）", () => {
    expectCatalogText("RS-684", TEXT);
    expectStats("RS-684", { name: "猿折神", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["獣", "折神獣"] });
    expect(rarityOf("RS-684")).toBe("N");
  });

  /** 敵軍: S ユニット sCount 体（BP2000。うち1体はラッシュエリア）＋任意の追加。 */
  const board = (sCount: number, extra: ReturnType<typeof inst>[] = [], fillers = 1) => {
    const ss = Array.from({ length: sCount }, (_, i) => inst("SPEC-E2000", `s${i}`));
    return ncEnter("RS-684:m", fillers, {}, { battle: ss.slice(1), rush: [ss[0]!, ...extra] }, [E2000, M500]);
  };

  // 既知の不具合: CARD-RS-684 【軽業】の選択候補が空で、敵軍Sユニット6体以上の条件も判定しない（空の確認が開くだけ）
  it.fails("RS-684: 【軽業】NC（2番目）・敵軍 S ユニット6体（ラッシュエリアを含む）— BP の一番低い敵軍ユニット（M ユニットも含む）だけを選べ、任意（出典: atwiki/page-1484・R-TGT-01）", () => {
    const s = board(6, [inst("SPEC-M500", "low")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-684");
    expect(choiceIds(s)).toEqual(["SPEC-M500:low"]);
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-684 【軽業】の選択候補が空で、敵軍Sユニット6体以上の条件も判定しない（空の確認が開くだけ）
  it.fails("RS-684: 【軽業】選んだユニットは持ち主の山札の上に戻る（出典: atwiki/page-1484「持ち主の山札の上に戻してもよい」）", () => {
    const s = resolveAll(pick(board(6, [inst("SPEC-M500", "low")]), "SPEC-M500:low"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-M500:low");
  });

  // 既知の不具合: CARD-RS-684 【軽業】の選択候補が空で、敵軍Sユニット6体以上の条件も判定しない（空の確認が開くだけ）
  it.fails("RS-684: 【軽業】BP が一番低いユニットが複数あれば、その中から選べる（出典: atwiki/page-1484「BPの一番低い敵軍ユニットを1体選び」）", () => {
    const s = board(6);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-684");
    expect(choiceIds(s)).toHaveLength(6);
  });

  it("RS-684: 【軽業】戻さないことも選べる（出典: atwiki/page-1484「戻してもよい」）", () => {
    let s = board(6, [inst("SPEC-M500", "low")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-684");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-M500:low")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-684 【軽業】の選択候補が空で、敵軍Sユニット6体以上の条件も判定しない（空の確認が開くだけ）
  it.fails("RS-684: 【軽業】敵軍 S ユニットが5体（M ユニットは数えない）なら発動しない（出典: atwiki/page-1484「敵軍Sユニットが6体以上あれば」）", () => {
    const s = board(5, [inst("SPEC-M500", "low")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-684");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-M500:low")).toBe("rush");
  });

  it("RS-684: 【軽業】NC が成立しない（3番目）と発動しない（出典: R-CN-02）", () => {
    const s = board(6, [inst("SPEC-M500", "low")], 2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-684");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-M500:low")).toBe("rush");
  });
});
