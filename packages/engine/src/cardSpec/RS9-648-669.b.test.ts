/**
 * カード別スペック: RS-656〜RS-662（第9弾「蒼九の翼」デカウイングキャノン〜鳳凰メレ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲の該当なし）、grnrngr/faq-card-9（カード別 Q&A なし。キーワード「ウイング」のみ）。
 *     faq/card_1〜8・index にも該当カードの Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写しはない。各ページに Q&A 節はない）。
 *     RS-661・RS-662 は atwiki に弾のラベルがないが、カードページの「収録」は「蒼九の翼」
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-ADD-02 ゾードダウン、R-KW-WING-*、R-TIME-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { canMoveUnitToBattle } from "../rules/restrictions";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  canWing,
  cardIn,
  choiceIds,
  deckCards,
  enterBattleByEffect,
  enterKeep,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  held,
  inst,
  p1Battle,
  p1Rush,
  pick,
  powerCards,
  rarityOf,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
  zordDownTests,
} from "./RS9-648-669.helpers";

const E_S = sUnit("SPEC-ES", { bp: 2000 });
const E_M = sUnit("SPEC-EM", { bp: 3000, size: "M" });

// ===========================================================================
describe("RS-656 デカウイングキャノン", () => {
  const TEXT =
    "※これはバトルエリアに出られない。 【オールスターアルティメットバスター】これが自軍エリアにある間、自軍ラッシュフェイズ中、特徴「人型」を持つBP6000以上の自軍ユニットをラッシュしたとき、そのBP以下のBPを持つ敵軍ユニットを1体選び撃破する。さらに、このときラッシュしたユニットがXLユニットだったなら、相手に1点ダメージを与える。";
  const PAGE = "atwiki/page-1474";
  const H6000 = sUnit("SPEC-H6000", { bp: 6000, size: "M", features: ["人型"] });
  const H5000 = sUnit("SPEC-H5000", { bp: 5000, size: "M", features: ["人型"] });
  const N9000 = sUnit("SPEC-N9000", { bp: 9000, size: "M", features: ["メカ"] });
  const HXL = sUnit("SPEC-HXL", { bp: 20000, size: "XL" as never, features: ["人型"] });
  const E6000 = sUnit("SPEC-E6000", { bp: 6000 });
  const E7000 = sUnit("SPEC-E7000", { bp: 7000 });
  const DEFS = [H6000, H5000, N9000, HXL, E6000, E7000, E_S];

  it("RS-656: カタログ本文・スペックが出典と一致（出典: atwiki/page-1474）", () => {
    expectCatalogText("RS-656", TEXT);
    expectStats("RS-656", {
      name: "デカウイングキャノン",
      category: "OT",
      size: "L",
      bp: 17000,
      sp: undefined,
      powerCost: "7+",
      features: ["メカ"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-656: レアリティはノーマルレア（出典: atwiki/page-1474「レアリティ：ノーマルレア」）", () => {
    expect(rarityOf("RS-656")).toBe("NR");
  });

  const rushBoard = (rush: ReturnType<typeof inst>[], power = 7) =>
    p1Rush({ hand: [inst("RS-656", "can")], rush, command: releasedCat("OT", 1), power: powerCards(power) });

  it("RS-656: 追加条件 — 自軍「デカウイングロボ」1体を捨札にしてラッシュできる（出典: atwiki/page-1474「自軍「パトウイング」、または自軍「デカウイングロボ」1体を捨札にする」）", () => {
    const r = rushFromHand(rushBoard([inst("RS-655", "dw")]), "player1", "RS-656:can", { materials: ["RS-655:dw"] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-656:can")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-655:dw")).toBe("discard");
  });

  it("RS-656: 追加条件 — 自軍「パトウイング」1体を捨札にしてもラッシュできる（出典: atwiki/page-1474「自軍「パトウイング」、または」）", () => {
    const s = rushBoard([inst("RS-657", "pw")]);
    expect(canStartRush(s, "player1", "RS-656:can")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-656:can", { materials: ["RS-657:pw"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-657:pw")).toBe("discard");
  });

  it("RS-656: 追加条件 — どちらもなければラッシュできない（出典: atwiki/page-1474）", () => {
    expect(canStartRush(rushBoard([inst("TST-UNIT-0", "s")]), "player1", "RS-656:can")).toBe(false);
  });

  it("RS-656: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-1474「必要パワー：7+」）", () => {
    expect(canStartRush(rushBoard([inst("RS-655", "dw")], 6), "player1", "RS-656:can")).toBe(false);
  });

  it("RS-656: ※ バトルエリアに出られない（出典: atwiki/page-1474「※これはバトルエリアに出られない。」）", () => {
    const s = p1Battle({ rush: [inst("RS-656", "can")] });
    expect(canEnter(s, "RS-656:can")).toBe(false);
  });

  /** キャノンを canZone に置き、自軍ラッシュフェイズに手札の unit をラッシュする（WB コマンド1つ）。 */
  const rushWith = (unit: string, canZone: "rush" | "discard" = "rush") => {
    const s = st(
      {
        phase: "rush",
        player1: { [canZone]: [inst("RS-656", "can")], hand: [inst(unit, "u")], command: releasedCat("WB", 1), deck: deckCards(5) },
        player2: { battle: [inst("SPEC-E6000", "e6"), inst("SPEC-ES", "e2")], rush: [inst("SPEC-E7000", "e7")], deck: deckCards(5, "e") },
      } as Parameters<typeof st>[0],
      DEFS,
    );
    const r = rushFromHand(s, "player1", `${unit}:u`);
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-656: 【オールスターアルティメットバスター】人型・BP6000 の自軍ユニットをラッシュしたとき、BP6000 以下の敵軍ユニット（エリアを問わない）を1体選び撃破する（強制）（出典: atwiki/page-1474「そのBP以下のBPを持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = rushWith("SPEC-H6000");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-656");
    expect(choiceIds(s)).toEqual(["SPEC-E6000:e6", "SPEC-ES:e2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E6000:e6"));
    expect(zoneOf(s, "player2", "SPEC-E6000:e6")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E7000:e7")).toBe("rush");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-656: 【オールスターアルティメットバスター】人型でも BP5000（6000 未満）なら発動しない（出典: atwiki/page-1474「BP6000以上」）", () => {
    const s = rushWith("SPEC-H5000");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-656");
    const t = resolveAll(s);
    expect(zoneOf(t, "player2", "SPEC-ES:e2")).toBe("battle");
  });

  it("RS-656: 【オールスターアルティメットバスター】BP6000 以上でも「人型」を持たなければ発動しない（出典: atwiki/page-1474「特徴「人型」を持つ」）", () => {
    const s = rushWith("SPEC-N9000");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-656");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-ES:e2")).toBe("battle");
  });

  it("RS-656: 【オールスターアルティメットバスター】キャノンが自軍エリアになければ（捨札）発動しない（出典: atwiki/page-1474「これが自軍エリアにある間」）", () => {
    const s = rushWith("SPEC-H6000", "discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-656");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-ES:e2")).toBe("battle");
  });

  it("RS-656: 【オールスターアルティメットバスター】XL ユニット（人型・BP20000）をラッシュしたなら、撃破に加えて相手に1点ダメージ（出典: atwiki/page-1474「ラッシュしたユニットがXLユニットだったなら、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(rushWith("SPEC-HXL"), ["SPEC-E7000:e7"]);
    expect(zoneOf(s, "player2", "SPEC-E7000:e7")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-656: 【オールスターアルティメットバスター】相手（キャノンの持ち主の敵）が人型をラッシュしても発動しない（出典: atwiki/page-1474「自軍ラッシュフェイズ中」「自軍ユニットをラッシュしたとき」）", () => {
    const s0 = st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: { rush: [inst("RS-656", "can")], battle: [inst("SPEC-ES", "own")], deck: deckCards(5) },
        player2: { hand: [inst("SPEC-H6000", "u")], command: releasedCat("WB", 1), deck: deckCards(5, "e") },
      },
      DEFS,
    );
    const r = rushFromHand(s0, "player2", "SPEC-H6000:u");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-656");
    expect(zoneOf(resolveAll(r.state), "player1", "SPEC-ES:own")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-657 パトウイング", () => {
  const TEXT =
    "※このカードの追加条件は、自軍捨札に特徴「スワット」を持つSユニットのカードが5枚以上あるとき、次のように変更される⇒追加で自軍コマンドを2つホールドする 【航空戦力との連携】これが自軍エリアにある間、特徴「航空機」を持つユニットは次の能力を得る⇒※ウイング";
  const PAGE = "atwiki/page-1475";
  const SWATS = ["RS-345", "RS-496", "RS-658", "RS-659", "RS-660"];

  it("RS-657: カタログ本文・スペックが出典と一致（出典: atwiki/page-1475）", () => {
    expectCatalogText("RS-657", TEXT);
    expectStats("RS-657", {
      name: "パトウイング",
      category: "OT",
      size: "SC",
      bp: 4000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_discard",
    });
    expect(rarityOf("RS-657")).toBe("N");
  });

  it("RS-657: 追加条件 — 自軍 S ユニットを5体捨札にしてラッシュできる（出典: atwiki/page-1475「追加条件：自軍Sユニットを5体捨札にする」）", () => {
    const r = rushFromHand(p1Rush({ hand: [inst("RS-657", "pw")], rush: fill(5), command: releasedCat("OT", 1), power: powerCards(4) }), "player1", "RS-657:pw");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-657:pw")).toBe("rush");
    expect(t.players.player1.discard.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(5);
  });

  it("RS-657: 追加条件 — 自軍 S ユニットが4体ではラッシュできない（出典: atwiki/page-1475「5体捨札にする」）", () => {
    expect(canStartRush(p1Rush({ hand: [inst("RS-657", "pw")], rush: fill(4), command: releasedCat("OT", 3), power: powerCards(4) }), "player1", "RS-657:pw")).toBe(false);
  });

  const swatBoard = (swatCount: number, cmd: number, rush: ReturnType<typeof inst>[] = []) =>
    p1Rush({
      hand: [inst("RS-657", "pw")],
      rush,
      discard: SWATS.slice(0, swatCount).map((id, i) => inst(id, `d${i}`)),
      command: releasedCat("OT", cmd),
      power: powerCards(4),
    });

  it("RS-657: ※ 自軍捨札にスワットの S ユニットのカードが5枚以上あれば、S ユニットを捨札にせず、追加で自軍コマンドを2つホールドしてラッシュできる（出典: atwiki/page-1475 ※）", () => {
    const s = swatBoard(5, 3);
    expect(canStartRush(s, "player1", "RS-657:pw")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-657:pw");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-657:pw")).toBe("rush");
    expect(t.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(3);
  });

  it("RS-657: ※ 変更後はリリース状態のコマンドが2つ（追加分が1つ不足）ではラッシュできない（出典: atwiki/page-1475「追加で自軍コマンドを2つホールドする」）", () => {
    expect(canStartRush(swatBoard(5, 2), "player1", "RS-657:pw")).toBe(false);
  });

  it("RS-657: ※ 捨札のスワットの S ユニットが4枚なら追加条件は変更されない（コマンドだけではラッシュできない）（出典: atwiki/page-1475「5枚以上あるとき」）", () => {
    expect(canStartRush(swatBoard(4, 3), "player1", "RS-657:pw")).toBe(false);
  });

  const PATJ = "RS-044"; // パトジャイラー（OT・M・メカ／航空機。ウイングを持たない）
  const E = sUnit("SPEC-WE", { bp: 500, sp: undefined });

  it("RS-657: 【航空戦力との連携】パトウイングが自軍エリアにある間、特徴「航空機」を持つ自軍ユニットはウイングを得る（出典: atwiki/page-1475）", () => {
    let s = p1Battle({ rush: [inst("RS-657", "pw"), inst(PATJ, "pj")] }, { battle: [inst("SPEC-WE", "e")] }, [E]);
    expect(canWing(s, `${PATJ}:pj`)).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: `${PATJ}:pj` });
    expect(cardIn(s, "player1", `${PATJ}:pj`)?.commandHeld).toBe(true);
  });

  it("RS-657: 【航空戦力との連携】パトウイングが自軍エリアになければ（捨札）、航空機のユニットはウイングを持たない（出典: atwiki/page-1475「これが自軍エリアにある間」）", () => {
    const s = p1Battle({ rush: [inst(PATJ, "pj")], discard: [inst("RS-657", "pw")] }, { battle: [inst("SPEC-WE", "e")] }, [E]);
    expect(canWing(s, `${PATJ}:pj`)).toBe(false);
  });

  it("RS-657: 【航空戦力との連携】「航空機」を持たないユニットはウイングを得ない（出典: atwiki/page-1475「特徴「航空機」を持つユニット」）", () => {
    const s = p1Battle({ rush: [inst("RS-657", "pw"), inst("TST-UNIT-0", "s")] }, { battle: [inst("SPEC-WE", "e")] }, [E]);
    expect(canWing(s, "TST-UNIT-0:s")).toBe(false);
  });

  it("RS-657: 【航空戦力との連携】ウイングを得るのは自軍の航空機のユニットだけで、敵軍の航空機のユニットは得ない（出典: atwiki/page-1475・ユーザー判断 2026-10-14「ウイング付与は自軍のみ」）", () => {
    const enemy = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RS-657", "pw")], battle: [inst("SPEC-WE", "e")], deck: deckCards(3) },
        player2: { rush: [inst(PATJ, "pj")], deck: deckCards(3, "e") },
      },
      [E],
    );
    // パトウイングの持ち主（player1）から見て敵軍の航空機のユニットは得ない
    expect(canWing(enemy, `${PATJ}:pj`, "player2")).toBe(false);
    // 同じ場面で、パトウイングを持つ側（player2）の航空機のユニットなら得る
    const own = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("SPEC-WE", "e")], deck: deckCards(3) },
        player2: { rush: [inst("RS-657", "pw"), inst(PATJ, "pj")], deck: deckCards(3, "e") },
      },
      [E],
    );
    expect(canWing(own, `${PATJ}:pj`, "player2")).toBe(true);
  });
});

// ===========================================================================
describe("RS-658 デカグリーンSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「デカグリーン」のカードを1枚選び、自軍ラッシュエリアに出す。 【突入】敵軍ラッシュエリアからSユニットを2体まで選びバトルエリアに出してもよい（出す順番は自分が選ぶ）。";
  const PAGE = "atwiki/page-1526";

  it("RS-658: カタログ本文・スペックが出典と一致（出典: atwiki/page-1526）", () => {
    expectCatalogText("RS-658", TEXT);
    expectStats("RS-658", {
      name: "デカグリーンSWAT",
      category: "OT",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 3,
      features: ["グリーン", "男", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-658: レアリティはスーパーレア（出典: atwiki/page-1526「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-658")).toBe("SR");
  });

  zordDownTests("RS-658", "RS-108", "デカグリーン", PAGE, "OT");
  reanimateTests("RS-658", "RS-108", "デカグリーン", PAGE);

  const board = (filler = 2) =>
    enterKeep(
      p1Battle(
        { rush: [inst("RS-658", "g")], battle: fill(filler) },
        { rush: [inst("TST-UNIT-0", "a"), inst("SPEC-ES", "b"), inst("TST-UNIT-0", "c"), inst("SPEC-EM", "m")] },
        [E_S, E_M],
      ),
      ["RS-658:g"],
    );

  it("RS-658: 【突入】NC（3番目）— 敵軍ラッシュエリアの S ユニットだけを選べ（M は不可）、選ばないこともできる（出典: atwiki/page-1526「敵軍ラッシュエリアからSユニットを2体まで選びバトルエリアに出してもよい」）", () => {
    const s = board();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-658");
    expect(choiceIds(s)).toEqual(["SPEC-ES:b", "TST-UNIT-0:a", "TST-UNIT-0:c"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-658: 【突入】選んだ2体は自分が選んだ順に敵軍バトルエリアに出る（3体目は出せない）（出典: atwiki/page-1526「2体まで」「出す順番は自分が選ぶ」）", () => {
    let s = board();
    s = pick(s, "SPEC-ES:b");
    s = pick(s, "TST-UNIT-0:a");
    s = resolveAll(s);
    expect(s.players.player2.battle.map((c) => c.instanceId)).toEqual(["SPEC-ES:b", "TST-UNIT-0:a"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:c")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-EM:m")).toBe("rush");
  });

  it("RS-658: 【突入】任意 — 出さなければ敵軍ラッシュエリアは変わらない（出典: atwiki/page-1526「出してもよい」）", () => {
    let s = board();
    if (s.pendingEffectChoice?.sourceCardId === "RS-658") s = skip(s);
    s = resolveAll(s);
    expect(s.players.player2.battle).toHaveLength(0);
    expect(s.players.player2.rush).toHaveLength(4);
  });

  it("RS-658: 【突入】NC が成立しない（4番目）と何もしない（出典: R-CN-02）", () => {
    const s = board(3);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-658");
    expect(resolveAll(s).players.player2.battle).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-659 デカイエローSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「デカイエロー」のカードを1枚選び、自軍ラッシュエリアに出す。 【感知システム】「SP1」自軍パワーゾーンのオモテ向きのカードの中から、Sユニットのカードを1枚選び手札に加えてもよい。そうしたとき、自軍山札の上から1枚引いて自軍パワーゾーンに置いてもよい。";
  const PAGE = "atwiki/page-1504";

  it("RS-659: カタログ本文・スペックが出典と一致（出典: atwiki/page-1504）", () => {
    expectCatalogText("RS-659", TEXT);
    expectStats("RS-659", {
      name: "デカイエローSWAT",
      category: "OT",
      size: "S",
      bp: 3500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 4,
      features: ["イエロー", "女", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-659: レアリティはスーパーレア（出典: atwiki/page-1504「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-659")).toBe("SR");
  });

  zordDownTests("RS-659", "RS-109", "デカイエロー", PAGE, "OT");
  reanimateTests("RS-659", "RS-109", "デカイエロー", PAGE);

  const POWER = () => [inst("TST-UNIT-0", "pu"), inst("TST-P", "pp"), inst("TST-UNIT-2", "pm"), { ...inst("TST-UNIT-0", "pd"), faceDown: true }];
  const board = (filler = 3) =>
    enterKeep(p1Battle({ rush: [inst("RS-659", "y")], battle: fill(filler), power: POWER(), deck: [inst("TST-OP", "top"), ...deckCards(3)] }), ["RS-659:y"]);

  it("RS-659: 【感知システム】NC（4番目）で SP1 になりストライクできる（出典: atwiki/page-1504「【感知システム】「SP1」」）", () => {
    let s = board();
    if (s.pendingEffectChoice?.sourceCardId === "RS-659") s = skip(s);
    s = resolveAll(s);
    expect(spOf(s, "player1", "RS-659:y")).toBe(1);
    expect(canStrike(s, "RS-659:y")).toBe(true);
  });

  it("RS-659: 【感知システム】自軍パワーゾーンのオモテ向きの S ユニットのカードだけを選べ（M・オペレーション・ウラ向きは不可）、選ばないこともできる（出典: atwiki/page-1504）", () => {
    const s = board();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-659");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:pu"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-659: 【感知システム】選んだカードを手札に加えたとき、自軍山札の上から1枚引いて自軍パワーゾーンに置ける（出典: atwiki/page-1504「そうしたとき、自軍山札の上から1枚引いて自軍パワーゾーンに置いてもよい」）", () => {
    let s = pick(board(), "TST-UNIT-0:pu");
    expect(zoneOf(s, "player1", "TST-UNIT-0:pu")).toBe("hand");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s, ["TST-OP:top"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("power");
  });

  it("RS-659: 【感知システム】手札に加えた後、山札の上を置かないことも選べる（出典: atwiki/page-1504「置いてもよい」）", () => {
    let s = pick(board(), "TST-UNIT-0:pu");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-UNIT-0:pu")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("deck");
  });

  it("RS-659: 【感知システム】手札に加えなければ山札の上はパワーゾーンに置かれない（出典: atwiki/page-1504「そうしたとき」）", () => {
    let s = board();
    if (s.pendingEffectChoice?.sourceCardId === "RS-659") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:pu")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("deck");
  });

  it("RS-659: 【感知システム】NC が成立しない（5番目）と SP！のまま何もしない（出典: R-CN-02）", () => {
    const s = board(4);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-659");
    const t = resolveAll(s);
    expect(spOf(t, "player1", "RS-659:y")).toBe(0);
    expect(zoneOf(t, "player1", "TST-UNIT-0:pu")).toBe("power");
  });
});

// ===========================================================================
describe("RS-660 デカピンクSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「デカピンク」のカードを1枚選び、自軍ラッシュエリアに出す。 【SPインカム】次の相手ターン、新しくラッシュエリアに出たユニットと、ホールド状態のユニットは、ターンが終わるまでバトルエリアに出られない";
  const PAGE = "atwiki/page-1527";

  it("RS-660: カタログ本文・スペックが出典と一致（出典: atwiki/page-1527）", () => {
    expectCatalogText("RS-660", TEXT);
    expectStats("RS-660", {
      name: "デカピンクSWAT",
      category: "OT",
      size: "S",
      bp: 1500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 5,
      features: ["ピンク", "女", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-660: レアリティはスーパーレア（出典: atwiki/page-1527「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-660")).toBe("SR");
  });

  zordDownTests("RS-660", "RS-110", "デカピンク", PAGE, "OT");
  reanimateTests("RS-660", "RS-110", "デカピンク", PAGE);

  /**
   * player1 がデカピンクSWAT を filler+1 番目に出してターンを終え、player2 のラッシュフェイズへ。
   * player2: ラッシュエリアにホールド状態の H とリリース状態の R、手札に TST-UNIT-0（必要パワー0）。
   */
  const toEnemyRush = (filler = 4) => {
    let s = enterSeq(
      st({
        player1: { rush: [inst("RS-660", "pk")], battle: fill(filler), deck: deckCards(8) },
        player2: { rush: [held("TST-UNIT-0", "h"), inst("TST-UNIT-0", "r")], hand: [inst("TST-UNIT-0", "new")], command: releasedCat("WB", 1), deck: deckCards(8, "e") },
      }),
      ["RS-660:pk"],
    );
    s = resolveAll(s);
    s = toPhase(s, "player2", "rush");
    const r = rushFromHand(s, "player2", "TST-UNIT-0:new");
    expect(r.ok).toBe(true);
    return toPhase(r.state, "player2", "battle");
  };

  it("RS-660: 【SPインカム】NC（5番目）— 次の相手ターン、新しくラッシュエリアに出たユニットはバトルエリアに出られない（出典: atwiki/page-1527）", () => {
    const s = toEnemyRush();
    expect(zoneOf(s, "player2", "TST-UNIT-0:new")).toBe("rush");
    expect(canEnter(s, "TST-UNIT-0:new", "player2")).toBe(false);
  });

  it("RS-660: 【SPインカム】次の相手ターン、ホールド状態のユニットはバトルエリアに出られない（出典: atwiki/page-1527「ホールド状態のユニットは」）", () => {
    const s = toEnemyRush();
    expect(cardIn(s, "player2", "TST-UNIT-0:h")?.commandHeld).toBe(true);
    expect(canEnter(s, "TST-UNIT-0:h", "player2")).toBe(false);
  });

  it("RS-660: 【SPインカム】前からラッシュエリアにあったリリース状態のユニットは出られる（出典: atwiki/page-1527「新しくラッシュエリアに出たユニットと、ホールド状態のユニット」）", () => {
    const s = toEnemyRush();
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(true);
  });

  it("RS-660: 【SPインカム】NC が成立しない（4番目）なら、新しくラッシュしたユニットもホールド状態のユニットも出られる（出典: R-CN-02）", () => {
    const s = toEnemyRush(3);
    expect(canEnter(s, "TST-UNIT-0:new", "player2")).toBe(true);
    expect(canEnter(s, "TST-UNIT-0:h", "player2")).toBe(true);
  });

  it("RS-660: 【SPインカム】制限は「次の相手ターン」だけ — その次の自軍ターンには自軍の新しいユニットは出られる（出典: atwiki/page-1527「次の相手ターン」「ターンが終わるまで」）", () => {
    let s = toEnemyRush();
    s = toPhase(s, "player1", "rush");
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, hand: [inst("TST-UNIT-0", "mine")], command: releasedCat("WB", 1, "m") } } };
    const r = rushFromHand(s, "player1", "TST-UNIT-0:mine");
    expect(r.ok).toBe(true);
    const t = toPhase(r.state, "player1", "battle");
    expect(canEnter(t, "TST-UNIT-0:mine")).toBe(true);
  });

  it("RS-660: 【SPインカム】「新しくラッシュエリアに出た」はバトルエリアから戻ったユニットを含まない — 前のターンにバトルエリアにいて、スタートフェイズにラッシュエリアに戻ったユニットは出られる（出典: atwiki/page-1527「新しくラッシュエリアに出たユニット」）", () => {
    let s = enterSeq(
      st({
        player1: { rush: [inst("RS-660", "pk")], battle: fill(4), deck: deckCards(8) },
        player2: { battle: [inst("TST-UNIT-0", "back")], deck: deckCards(8, "e") },
      }),
      ["RS-660:pk"],
    );
    s = resolveAll(s);
    s = toPhase(s, "player2", "battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:back")).toBe("rush");
    expect(cardIn(s, "player2", "TST-UNIT-0:back")?.commandHeld).toBeFalsy();
    expect(canEnter(s, "TST-UNIT-0:back", "player2")).toBe(true);
  });

  it("RS-660: 【SPインカム】対象は相手（制限を受ける軍）のユニットだけ — 次の相手ターン中に効果で自軍ラッシュエリアに出た自軍ユニット（※で出したデカピンク）も、ホールド状態の自軍ユニットもバトルエリアに出られる（出典: ユーザー決定 2026-10-19「ゼニボムとSPインカム両方とも相手ユニットが対象」、docs/rules/README.md §5.7）", () => {
    let s = enterSeq(
      st({
        player1: { rush: [inst("RS-660", "pk"), inst("TST-UNIT-0", "old"), held("TST-UNIT-0", "myheld")], battle: fill(4), discard: [inst("RS-110", "dp")], deck: deckCards(8) },
        player2: { rush: [inst("TST-UNIT-7", "big")], deck: deckCards(8, "e") },
      }),
      ["RS-660:pk"],
    );
    s = resolveAll(s);
    s = toPhase(s, "player2", "battle");
    expect(canEnter(s, "TST-UNIT-7:big", "player2")).toBe(true);
    s = enterKeep(s, ["TST-UNIT-7:big"], "player2");
    s = resolveAll(attack(s, "TST-UNIT-7:big", "RS-660:pk", "player2"), ["RS-110:dp"]);
    expect(zoneOf(s, "player1", "RS-660:pk")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-110:dp")).toBe("rush");
    expect(canMoveUnitToBattle(s, "player1", cardIn(s, "player1", "RS-110:dp")!, "rush")).toBe(true);
    expect(canMoveUnitToBattle(s, "player1", cardIn(s, "player1", "TST-UNIT-0:old")!, "rush")).toBe(true);
    expect(cardIn(s, "player1", "TST-UNIT-0:myheld")?.commandHeld).toBe(true);
    expect(canMoveUnitToBattle(s, "player1", cardIn(s, "player1", "TST-UNIT-0:myheld")!, "rush")).toBe(true);
  });
});

// ===========================================================================
describe("RS-661 幻獣王リオ", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から｢黒獅子リオ｣のカードを1枚選び、自軍ラッシュエリアに出す。 ※これはラッシュしたターン、ストライクできない。 【破天攻】これは敵軍Sユニット1体につきBP+1000される。";
  const PAGE = "atwiki/page-1500";

  it("RS-661: カタログ本文・スペックが出典と一致（出典: atwiki/page-1500）", () => {
    expectCatalogText("RS-661", TEXT);
    expectStats("RS-661", {
      name: "幻獣王リオ",
      category: "DA",
      size: "S",
      bp: 3500,
      sp: 1,
      powerCost: "7-",
      comboNumber: undefined,
      features: ["男", "幻気", "幻獣王"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-661: レアリティはレア（出典: atwiki/page-1500「レアリティ：レア」）", () => {
    expect(rarityOf("RS-661")).toBe("R");
  });

  zordDownTests("RS-661", "RS-431", "黒獅子リオ", PAGE, "DA");
  reanimateTests("RS-661", "RS-431", "黒獅子リオ", PAGE);

  it("RS-661: ※ ラッシュしたターンはストライクできない（出典: atwiki/page-1500「※これはラッシュしたターン、ストライクできない。」）", () => {
    const s = p1Rush({ hand: [inst("RS-661", "rio")], rush: [inst("RS-431", "kr")], command: releasedCat("DA", 1) });
    const r = rushVia(s, "player1", "RS-661:rio", (a) => a.zordMaterialInstanceId === "RS-431:kr");
    expect(r.ok).toBe(true);
    let t = toPhase(resolveAll(r.state), "player1", "battle");
    t = enterKeep(t, ["RS-661:rio"]);
    expect(zoneOf(t, "player1", "RS-661:rio")).toBe("battle");
    expect(canStrike(t, "RS-661:rio")).toBe(false);
  });

  it("RS-661: ※ ラッシュしたターンでなければストライクできる（出典: atwiki/page-1500「ラッシュしたターン」）", () => {
    const s = enterKeep(p1Battle({ rush: [inst("RS-661", "rio")] }), ["RS-661:rio"]);
    expect(canStrike(s, "RS-661:rio")).toBe(true);
  });

  const E_S2 = sUnit("SPEC-ES2", { bp: 1000 });

  it("RS-661: 【破天攻】敵軍 S ユニット1体につき BP+1000（バトルエリア・ラッシュエリアの S を数え、M は数えない）（出典: atwiki/page-1500「敵軍Sユニット1体につきBP+1000」）", () => {
    const s = p1Battle(
      { battle: [inst("RS-661", "rio")] },
      { battle: [inst("SPEC-ES", "a"), inst("SPEC-EM", "m")], rush: [inst("SPEC-ES2", "b"), inst("TST-UNIT-0", "c")] },
      [E_S, E_M, E_S2],
    );
    expect(bpOf(s, "player1", "RS-661:rio")).toBe(6500);
  });

  it("RS-661: 【破天攻】自軍の S ユニットは数えない（出典: atwiki/page-1500「敵軍Sユニット」）", () => {
    const s = p1Battle({ battle: [inst("RS-661", "rio"), ...fill(2)] }, { battle: [inst("SPEC-EM", "m")] }, [E_M]);
    expect(bpOf(s, "player1", "RS-661:rio")).toBe(3500);
  });

  it("RS-661: 【破天攻】敵軍 S ユニットが撃破されれば BP も下がる（出典: atwiki/page-1500「1体につき」）", () => {
    let s = p1Battle({ battle: [inst("RS-661", "rio")] }, { battle: [inst("SPEC-ES", "a"), inst("SPEC-ES2", "b")] }, [E_S, E_S2]);
    expect(bpOf(s, "player1", "RS-661:rio")).toBe(5500);
    s = resolveAll(act(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-661:rio", defenderInstanceId: "SPEC-ES2:b" }));
    expect(zoneOf(s, "player2", "SPEC-ES2:b")).toBe("discard");
    expect(bpOf(s, "player1", "RS-661:rio")).toBe(4500);
  });
});

// ===========================================================================
describe("RS-662 鳳凰メレ", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から｢獣人メレ｣のカードを1枚選び、自軍ラッシュエリアに出す。 【火将危願】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンのカードの枚数を数えて、その数と同じ必要パワーの数字を持つカードを敵軍コマンドゾーンから1枚選び捨札にしてもよい。";
  const PAGE = "atwiki/page-1501";

  it("RS-662: カタログ本文・スペックが出典と一致（出典: atwiki/page-1501）", () => {
    expectCatalogText("RS-662", TEXT);
    expectStats("RS-662", {
      name: "鳳凰メレ",
      category: "DA",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: undefined,
      features: ["女", "幻気", "四幻将"],
      rushCondition: "zord_down_discard_named",
    });
  });

  it("RS-662: レアリティはレア（出典: atwiki/page-1501「レアリティ：レア」）", () => {
    expect(rarityOf("RS-662")).toBe("R");
  });

  zordDownTests("RS-662", "RS-504", "獣人メレ", PAGE, "DA");
  reanimateTests("RS-662", "RS-504", "獣人メレ", PAGE);

  /** 自軍コマンド3枚（リリース2・ホールド1）。敵軍コマンド: 必要パワー3（TST-OP）・1（TST-OP-ET）・7+（RS-648）。 */
  const board = (ownCmd = [released("TST-OP-DA", "c0"), released("TST-OP-DA", "c1"), held("TST-OP-DA", "c2")]) =>
    act(
      p1Battle(
        { rush: [inst("RS-662", "me")], command: ownCmd },
        { command: [released("TST-OP", "e3"), released("TST-OP-ET", "e1"), held("RS-648", "e7")] },
      ),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-662:me" },
    );

  it("RS-662: 【火将危願】自軍コマンドが3枚（ホールド状態を含む）なら、必要パワー3の敵軍コマンドだけを選べ、選ばないこともできる（出典: atwiki/page-1501）", () => {
    const s = board();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-662");
    expect(choiceIds(s)).toEqual(["TST-OP:e3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-662: 【火将危願】選んだ敵軍コマンドは捨札になる（出典: atwiki/page-1501「敵軍コマンドゾーンから1枚選び捨札にしてもよい」）", () => {
    const s = resolveAll(pick(board(), "TST-OP:e3"));
    expect(zoneOf(s, "player2", "TST-OP:e3")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(2);
  });

  it("RS-662: 【火将危願】任意 — 選ばなければ敵軍コマンドは変わらない（出典: atwiki/page-1501「捨札にしてもよい」）", () => {
    const s = resolveAll(skip(board()));
    expect(s.players.player2.command).toHaveLength(3);
  });

  it("RS-662: 【火将危願】自軍コマンドが7枚なら、必要パワー「7+」の敵軍コマンドを選べる（数字が7）（出典: atwiki/page-1501「その数と同じ必要パワーの数字を持つカード」）", () => {
    const s = board(releasedCat("DA", 7));
    expect(choiceIds(s)).toEqual(["RS-648:e7"]);
  });

  it("RS-662: 【火将危願】同じ数字の敵軍コマンドがなければ（自軍コマンド2枚）発動しない（出典: atwiki/page-1501）", () => {
    const s = board(releasedCat("DA", 2));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-662");
    expect(resolveAll(s).players.player2.command).toHaveLength(3);
  });

  it("RS-662: 【火将危願】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1501「自軍ターン中」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-662", "me")], command: releasedCat("DA", 3), deck: deckCards(3) },
      player2: { command: [released("TST-OP", "e3")], deck: deckCards(3, "e") },
    });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-662:me"));
    expect(zoneOf(s, "player2", "TST-OP:e3")).toBe("command");
  });
});
