/**
 * カード別スペック: XG1-015〜XG1-020（クロスギャザー ザ・ファーストエンカウント 宇宙警察〜ターボロボ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない（「XG」・カード名で検索）。
 *     atwiki に転載された公式 Q&A（XG1-015 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-CHASE-01、R-KW-CALL-01、R-ZONE-01）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を XG1-015〜020 で検索）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  bpOf,
  canMount,
  canSkip,
  canStartRush,
  cardIn,
  chaseTargets,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnitStats,
  faceUp,
  featuresOf,
  inst,
  lastBattleBps,
  p1Battle,
  pick,
  played,
  powerCards,
  raw,
  releasedCat,
  resolveAll,
  ridingPair,
  rushFromHand,
  rushPhaseBoard,
  rushResults,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./XG1-001-020.helpers";

const E4000 = sUnit("SPEC-E4000", { category: "ET", bp: 4000 });
const E4500 = sUnit("SPEC-E4500", { category: "ET", bp: 4500 });
const E4000M = sUnit("SPEC-E4000M", { category: "ET", bp: 4000, size: "M" });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000, powerCost: 1 });
const PLAIN_L = sUnit("SPEC-L", { category: "ET", bp: 10000, size: "L" });
const EXTRA = [E4000, E4500, E4000M, OT_S, PLAIN_L, PLAIN_VEHICLE];

// ===========================================================================
describe("XG1-015 宇宙警察", () => {
  const TEXT = "※常駐 特徴「警察」を持つSユニットはチェイスを得る。さらにそのユニットがOTを持つなら、特徴「宇宙刑事」が追加され、コールOTを得る。";

  it("XG1-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-1584）", () => {
    expectCatalogText("XG1-015", TEXT);
    expectOpStats("XG1-015", { name: "宇宙警察", category: "OT", powerCost: 5 });
    expectRarityIn("XG1-015", ["N"]);
  });

  it("XG1-015: ※常駐 — 自軍ラッシュフェイズに使うと常駐置き場に配置される（出典: atwiki/page-1584「※常駐」）", () => {
    const s = played(rushPhaseBoard({ hand: [inst("XG1-015", "op")], command: releasedCat("OT", 1), power: powerCards(5) }, {}, EXTRA), "XG1-015:op");
    expect(zoneOf(resolveAll(s), "player1", "XG1-015:op")).toBe("operation");
  });

  // 自軍: OT の「警察」（XG1-017 シグナルマン）・ET の「警察」（XG1-088 バイクル）・「警察」を持たない OT の S ユニット。
  const field = (withOp = true, phase: GameState["phase"] = "battle") =>
    st(
      {
        phase,
        player1: {
          operation: withOp ? [inst("XG1-015", "op")] : [],
          rush: [inst("XG1-017", "sm"), inst("XG1-088", "bk"), inst("SPEC-OT-S", "ot")],
          hand: [inst("SPEC-OT-S", "h")],
          power: powerCards(3),
          deck: deckCards(3),
        },
        player2: { deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("XG1-015: OT を持つ「警察」の S ユニットには特徴「宇宙刑事」が追加される。ET の「警察」、「警察」を持たない OT のユニットには追加されない（既知の不具合: CARD-XG1-015 特徴が追加されない）（出典: atwiki/page-1584「さらにそのユニットがOTを持つなら、特徴「宇宙刑事」が追加され」・コメント欄「警察持ちじゃないとまったく意味無い」）", () => {
    const s = field();
    expect(featuresOf(s, "player1", "XG1-017:sm")).toContain("宇宙刑事");
    expect(featuresOf(s, "player1", "XG1-088:bk")).not.toContain("宇宙刑事");
    expect(featuresOf(s, "player1", "SPEC-OT-S:ot")).not.toContain("宇宙刑事");
  });

  it("XG1-015: OT を持つ「警察」の S ユニットはコールOT を得る（OT のユニットをラッシュするためのコマンドとしてホールドできる）（既知の不具合: CARD-XG1-015）（出典: atwiki/page-1584「コールOTを得る」・R-KW-CALL-01）", () => {
    const s = raw(field(true, "rush"), { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "SPEC-OT-S:h" });
    expect(s.pendingCommandPayment?.validInstanceIds).toContain("XG1-017:sm");
    expect(s.pendingCommandPayment?.validInstanceIds).not.toContain("XG1-088:bk");
  });

  it("XG1-015: 宇宙警察がなければ「宇宙刑事」は追加されない（出典: atwiki/page-1584「※常駐」）", () => {
    expect(featuresOf(field(false), "player1", "XG1-017:sm")).not.toContain("宇宙刑事");
  });

  /** player2 の「警察」の RC ユニット（XG1-088 バイクル）が SPEC-VEHICLE にライドしてバトルエリアにいるところを、player1 の BP13000 でアタックする。 */
  const chase = (withOp: boolean) => {
    let s = st(
      {
        player1: { rush: [inst("TST-UNIT-7", "a")], deck: deckCards(3) },
        player2: { operation: withOp ? [inst("XG1-015", "op")] : [], battle: ridingPair("XG1-088", "bk", "SPEC-VEHICLE", "v"), rush: [inst("SPEC-VEHICLE", "v2")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = attack(enter(s, "TST-UNIT-7:a"), "TST-UNIT-7:a", "XG1-088:bk");
    return s;
  };

  it("XG1-015: 「警察」の S ユニットはチェイスを得る（ライド中に撃破されるとき、ライドされていない自軍ビークルに乗り換えられる）（既知の不具合: CARD-XG1-015 チェイスの乗り換えが出ない）（出典: atwiki/page-1584「特徴「警察」を持つSユニットはチェイスを得る」・R-KW-CHASE-01）", () => {
    expect(chaseTargets(chase(true), "player2")).toEqual(["SPEC-VEHICLE:v2"]);
  });

  it("XG1-015: 宇宙警察がなければ「警察」のユニットはチェイスを持たない（出典: atwiki/page-1584）", () => {
    expect(chaseTargets(chase(false), "player2")).toEqual([]);
  });

  it("XG1-015: 公式Q&A — RC を持たないユニット（シグナルマン）はチェイスを得てもビークルにライドできない（出典: atwiki/page-1584 Q1「はい、変更はありません」）", () => {
    const s = st({ player1: { operation: [inst("XG1-015", "op")], rush: [inst("XG1-017", "sm"), inst("SPEC-VEHICLE", "v")], deck: deckCards(3) } }, EXTRA);
    expect(canMount(s, "XG1-017:sm", "SPEC-VEHICLE:v")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-016 サイレンダーRM", () => {
  const TEXT = "【ワッパガン】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP4000以下のユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("XG1-016: カタログ本文・スペックが出典と一致（追加条件「自軍「サイレンダーPM」1体を捨札にする」）（出典: atwiki/page-1671）", () => {
    expectCatalogText("XG1-016", TEXT);
    expectUnitStats("XG1-016", { name: "サイレンダーRM", category: "OT", size: "L", bp: 8000, sp: 1, powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG1-016", ["R"]);
  });

  it("XG1-016: 追加条件 — 自軍「サイレンダーPM」（XG1-018）1体を捨札にしてラッシュできる（出典: atwiki/page-1671「追加条件：自軍「サイレンダーPM」1体を捨札にする」）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-016", "h")], rush: [inst("XG1-018", "pm")], command: releasedCat("OT", 1), power: powerCards(6) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG1-016:h", { materials: ["XG1-018:pm"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-016:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG1-018:pm")).toBe("discard");
  });

  // 敵軍バトルエリア: BP4000 の S・BP4000 の M・BP4500 の S、ラッシュエリア: BP4000 の S。
  const entered = () =>
    enter(p1Battle({ rush: [inst("XG1-016", "rm")] }, { battle: [inst("SPEC-E4000", "a"), inst("SPEC-E4000M", "m"), inst("SPEC-E4500", "b")], rush: [inst("SPEC-E4000", "r")] }, EXTRA), "XG1-016:rm");

  it("XG1-016: 【ワッパガン】自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの BP4000 以下のユニット（サイズを問わない。ラッシュエリアは対象外）から1体選べる（任意）（出典: atwiki/page-1671「敵軍バトルエリアからBP4000以下のユニットを1体選び…送ってもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-016");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:a", "SPEC-E4000M:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-016: 選んだユニットは持ち主（敵軍）のパワーゾーンに送られる（出典: atwiki/page-1671「持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-E4000M:m"));
    expect(zoneOf(s, "player2", "SPEC-E4000M:m")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-017 シグナルマン", () => {
  const TEXT =
    "※これはアタックされるときBP+3000される 【許可なき戦いへの介入】これが自軍エリアにある間、自分も相手も次の制限を受ける⇒Sユニットは、追加条件を持つ、MユニットまたはSCユニットにアタックすることができない。";

  it("XG1-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-1672）", () => {
    expectCatalogText("XG1-017", TEXT);
    expectUnitStats("XG1-017", { name: "シグナルマン", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["男", "警察"] });
    expectRarityIn("XG1-017", ["R"]);
  });

  it("XG1-017: ※ アタックされるとき BP+3000（6000 でバトルする）（出典: atwiki/page-1672「※これはアタックされるときBP+3000される」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG1-017", "sm")] }, "XG1-017:sm");
    expect(lastBattleBps(s)?.defender).toBe(6000);
  });

  it("XG1-017: ※ アタックされていないときは BP3000（出典: atwiki/page-1672「アタックされるとき」）", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG1-017", "sm")] }), "player1", "XG1-017:sm")).toBe(3000);
  });

  /**
   * 敵軍（player2）のバトルフェイズ。player1 の場に XG1-017 と、追加条件を持つ M ユニット（XG1-035 兜折神）・追加条件を持たない M ユニット
   * （RS-051 爆竜ティラノサウルス）・追加条件を持つ SC ユニット（XG1-019 ターボマシン）。player2 の S ユニット（TST-UNIT-0）と L ユニット（TST-UNIT-7）がアタックする。
   */
  const enemyTurn = (withSignal = true) =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: [...(withSignal ? [inst("XG1-017", "sm")] : []), inst("XG1-035", "kb"), inst("RS-051", "ty"), inst("XG1-019", "tm")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-7", "l")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("XG1-017: 【許可なき戦いへの介入】相手の S ユニットは、追加条件を持つ M ユニット・SC ユニットにアタックできない（追加条件を持たない M ユニットにはできる）（既知の不具合: CARD-XG1-017 アタックの制限がない）（出典: atwiki/page-1672「Sユニットは、追加条件を持つ、MユニットまたはSCユニットにアタックすることができない」）", () => {
    const t = attackTargets(enemyTurn(), "TST-UNIT-0:s", "player2");
    expect(t).not.toContain("XG1-035:kb");
    expect(t).not.toContain("XG1-019:tm");
    expect(t).toContain("RS-051:ty");
  });

  it("XG1-017: L ユニットのアタックは制限されない（出典: atwiki/page-1672「Sユニットは」）", () => {
    expect(attackTargets(enemyTurn(), "TST-UNIT-7:l", "player2")).toContain("XG1-035:kb");
  });

  it("XG1-017: シグナルマンがいなければ制限はない（出典: atwiki/page-1672「これが自軍エリアにある間」）", () => {
    expect(attackTargets(enemyTurn(false), "TST-UNIT-0:s", "player2")).toContain("XG1-035:kb");
  });

  it("XG1-017: 自分も制限を受ける — 自軍の S ユニットも、追加条件を持つ敵軍の M ユニットにアタックできない（既知の不具合: CARD-XG1-017）（出典: atwiki/page-1672「自分も相手も次の制限を受ける」・カード評価「効果は自軍にも適用されるのを忘れずに」）", () => {
    const s = p1Battle({ rush: [inst("XG1-017", "sm")], battle: [inst("TST-UNIT-0", "s")] }, { battle: [inst("XG1-035", "kb"), inst("RS-051", "ty")] }, EXTRA);
    const t = attackTargets(s, "TST-UNIT-0:s");
    expect(t).not.toContain("XG1-035:kb");
    expect(t).toContain("RS-051:ty");
  });
});

// ===========================================================================
describe("XG1-018 サイレンダーPM", () => {
  const TEXT = "【治安維持】これが自軍バトルエリアにある間、相手は次の制限を受ける⇒Sユニットは、MユニットまたはSCユニットまたはLユニットにアタックすることができない。";

  it("XG1-018: カタログ本文・スペックが出典と一致（追加条件「特徴「警察」を持つ自軍Sユニットを1体パワーゾーンに送る」）（出典: atwiki/page-1585）", () => {
    expectCatalogText("XG1-018", TEXT);
    expectUnitStats("XG1-018", { name: "サイレンダーPM", category: "OT", size: "L", bp: 5000, sp: undefined, powerCost: "5+", features: ["メカ", "車両"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG1-018", ["N"]);
  });

  const rushBoard = (rush: ReturnType<typeof inst>[]) => rushPhaseBoard({ hand: [inst("XG1-018", "h")], rush, command: releasedCat("OT", 1), power: powerCards(5) }, {}, EXTRA);

  it("XG1-018: 追加条件 — 特徴「警察」を持つ自軍 S ユニット（シグナルマン）をパワーゾーンに送ってラッシュできる（出典: atwiki/page-1585「追加条件：特徴「警察」を持つ自軍Sユニットを1体パワーゾーンに送る」）", () => {
    const r = rushFromHand(rushBoard([inst("XG1-017", "sm")]), "player1", "XG1-018:h", { materials: ["XG1-017:sm"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-018:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG1-017:sm")).toBe("power");
  });

  it("XG1-018: 「警察」を持たない S ユニットしかいなければラッシュできない（既知の不具合: CARD-XG1-018 「警察」を持たない S ユニットを追加条件でパワーゾーンに送ってラッシュできる）（出典: atwiki/page-1585「特徴「警察」を持つ自軍Sユニット」）", () => {
    const r = rushResults(rushBoard([inst("TST-UNIT-0", "s")]), "player1", "XG1-018:h");
    expect(r.filter((x) => zoneOf(x, "player1", "XG1-018:h") === "rush")).toHaveLength(0);
  });

  /** 敵軍（player2）のバトルフェイズ。player1 の場に XG1-018（バトルエリアかラッシュエリア）と M・L・S のユニット。 */
  const enemyTurn = (pmIn: "battle" | "rush") =>
    st(
      {
        activePlayer: "player2",
        player1: {
          battle: [...(pmIn === "battle" ? [inst("XG1-018", "pm")] : []), inst("RS-051", "ty"), inst("SPEC-L", "l"), inst("SPEC-E4000", "s")],
          rush: pmIn === "rush" ? [inst("XG1-018", "pm")] : [],
          deck: deckCards(3),
        },
        player2: { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("XG1-018: 【治安維持】自軍バトルエリアにある間、相手の S ユニットは M・L ユニット（これ自身も含む）にアタックできず、S ユニットにはアタックできる（既知の不具合: CARD-XG1-018 アタックの制限がない）（出典: atwiki/page-1585「Sユニットは、MユニットまたはSCユニットまたはLユニットにアタックすることができない」）", () => {
    const t = attackTargets(enemyTurn("battle"), "TST-UNIT-0:s", "player2");
    expect(t).toEqual(["SPEC-E4000:s"]);
  });

  it("XG1-018: 相手の L ユニットのアタックは制限されない（出典: atwiki/page-1585「Sユニットは」）", () => {
    expect(attackTargets(enemyTurn("battle"), "TST-UNIT-7:big", "player2")).toContain("RS-051:ty");
  });

  it("XG1-018: ラッシュエリアにあるだけなら制限はない（出典: atwiki/page-1585「これが自軍バトルエリアにある間」・カード評価「これ自体がバトルエリアになければ効果は発揮されない」）", () => {
    expect(attackTargets(enemyTurn("rush"), "TST-UNIT-0:s", "player2")).toContain("RS-051:ty");
  });

  it("XG1-018: 自分（自軍の S ユニット）は制限を受けない（出典: atwiki/page-1585「相手は次の制限を受ける」）", () => {
    const s = p1Battle({ battle: [inst("XG1-018", "pm"), inst("TST-UNIT-0", "s")] }, { battle: [inst("RS-051", "ty")] }, EXTRA);
    expect(attackTargets(s, "TST-UNIT-0:s")).toContain("RS-051:ty");
  });
});

// ===========================================================================
describe("XG1-019 ターボマシン", () => {
  const TEXT =
    "※このカードの追加条件は、自軍捨札にカテゴリを2つ以上持つSユニットのカードが5枚以上あるとき、次のように変更される⇒自軍ゾーンのオモテ向きのカードからSユニットのカードを1枚選び捨札にする。";

  it("XG1-019: カタログ本文・スペックが出典と一致（追加条件「自軍Sユニット5体をそれぞれコマンドゾーンに送るか捨札にする」）（出典: atwiki/page-1647）", () => {
    expectCatalogText("XG1-019", TEXT);
    expectUnitStats("XG1-019", { name: "ターボマシン", category: "ET", size: "SC", bp: 8000, sp: undefined, powerCost: "5+", features: ["メカ", "車両"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG1-019", ["NR"]);
  });

  it("XG1-019: 追加条件 — 自軍 S ユニット5体をそれぞれコマンドゾーンに送るか捨札にしてラッシュできる（4体ではできない）（出典: atwiki/page-1647「追加条件：自軍Sユニット5体をそれぞれコマンドゾーンに送るか捨札にする」）", () => {
    const mk = (n: number) =>
      rushPhaseBoard({ hand: [inst("XG1-019", "h")], rush: Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `s${i}`)), command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);
    expect(canStartRush(mk(4), "player1", "XG1-019:h")).toBe(false);
    const r = rushFromHand(mk(5), "player1", "XG1-019:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-019:h")).toBe("rush");
    expect(r.state.players.player1.rush.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(0);
  });

  /** 自軍捨札にマルチカテゴリの S ユニットのカード n 枚、自軍パワーゾーンにオモテ向きの S ユニットのカード（TST-UNIT-0）。場に S ユニットはない。 */
  const changed = (n: number) =>
    rushPhaseBoard(
      { hand: [inst("XG1-019", "h")], discard: Array.from({ length: n }, (_, i) => inst("TST-UNIT-WB-ET", `m${i}`)), power: [faceUp("TST-UNIT-0", "pw"), ...powerCards(4)], command: releasedCat("ET", 1) },
      {},
      EXTRA,
    );

  it("XG1-019: ※ 自軍捨札にカテゴリを2つ以上持つ S ユニットのカードが5枚あれば、追加条件は「自軍ゾーンのオモテ向きの S ユニットのカードを1枚捨札にする」に変わる（既知の不具合: CARD-XG1-019 変更後の追加条件でラッシュできない）（出典: atwiki/page-1647「次のように変更される⇒自軍ゾーンのオモテ向きのカードからSユニットのカードを1枚選び捨札にする」）", () => {
    const ok = rushResults(changed(5), "player1", "XG1-019:h").filter((r) => zoneOf(r, "player1", "XG1-019:h") === "rush" && zoneOf(r, "player1", "TST-UNIT-0:pw") === "discard");
    expect(ok.length).toBeGreaterThan(0);
  });

  it("XG1-019: マルチカテゴリの S ユニットのカードが4枚なら追加条件は変わらず、場に S ユニットがなければラッシュできない（出典: atwiki/page-1647「5枚以上あるとき」）", () => {
    expect(canStartRush(changed(4), "player1", "XG1-019:h")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-020 ターボロボ", () => {
  const TEXT = "※これは、カテゴリを2つ以上持つ自軍コマンド1つにつきBP+1000される。 【高速剣ターボクラッシュ】 これはBP10000以上の時、次の能力を得る⇒SP1";

  it("XG1-020: カタログ本文・スペックが出典と一致（追加条件「自軍「ターボマシン」1体を捨札にする」）（出典: atwiki/page-1545）", () => {
    expectCatalogText("XG1-020", TEXT);
    expectUnitStats("XG1-020", { name: "ターボロボ", category: "ET", size: "L", bp: 8000, sp: "special", powerCost: "5+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG1-020", ["R"]);
  });

  it("XG1-020: 追加条件 — 自軍「ターボマシン」（XG1-019）1体を捨札にしてラッシュできる（出典: atwiki/page-1545「追加条件：自軍「ターボマシン」1体を捨札にする」）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-020", "h")], rush: [inst("XG1-019", "tm")], command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG1-020:h", { materials: ["XG1-019:tm"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-020:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG1-019:tm")).toBe("discard");
  });

  const multi = (n: number, prefix = "mc") => Array.from({ length: n }, (_, i) => ({ ...inst("TST-OP-WB-ET", `${prefix}${i}`), commandHeld: i % 2 === 1 }));
  const field = (command: ReturnType<typeof inst>[]) => p1Battle({ battle: [inst("XG1-020", "tr")], command }, {}, EXTRA);

  it("XG1-020: ※ カテゴリを2つ以上持つ自軍コマンド1つにつき BP+1000（ホールド状態も数える。単色のコマンドは数えない）（出典: atwiki/page-1545「カテゴリを2つ以上持つ自軍コマンド1つにつきBP+1000される」）", () => {
    expect(bpOf(field([...multi(2), ...releasedCat("ET", 2)]), "player1", "XG1-020:tr")).toBe(10000);
  });

  it("XG1-020: 【高速剣ターボクラッシュ】BP10000 以上なら SP1 を得る（既知の不具合: CARD-XG1-020 BP10000 でも SP を持たない）（出典: atwiki/page-1545「これはBP10000以上の時、次の能力を得る⇒SP1」）", () => {
    expect(spOf(field(multi(2)), "player1", "XG1-020:tr")).toBe(1);
  });

  it("XG1-020: BP9000 なら SP を持たない（出典: atwiki/page-1545「BP10000以上の時」）", () => {
    const s = field([...multi(1), ...releasedCat("ET", 3)]);
    expect(bpOf(s, "player1", "XG1-020:tr")).toBe(9000);
    expect(spOf(s, "player1", "XG1-020:tr")).toBe(0);
  });

  it("XG1-020: 自軍コマンドにマルチカテゴリがなければ BP8000（出典: atwiki/page-1545）", () => {
    expect(bpOf(field(releasedCat("ET", 3)), "player1", "XG1-020:tr")).toBe(8000);
    expect(cardIn(field([]), "player1", "XG1-020:tr")).toBeDefined();
  });
});
