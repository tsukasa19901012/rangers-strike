/**
 * カード別スペック: RS-545〜RS-549（第8弾「究極の八神」究極大獣神〜トリケラレンジャー（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-8（RS-545〜RS-549 の Q なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06、R-KW-RESIST-01〜05、R-CN-02 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attackUntilRegister,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  heldUnit,
  inst,
  ncLogged,
  pick,
  powerCards,
  registerOffered,
  releasedN,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  unitIn,
  zoneOf,
} from "./RS8-538-559.helpers";
import type { CardInstance, GameState } from "../types/game";

const ET_M = sUnit("SPEC-ET-M", { category: "ET", size: "M", bp: 4000, sp: undefined });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const BP7000 = sUnit("SPEC-7000", { bp: 7000 });

/** 獣騎神キングブラキオン＋守護獣ドラゴンシーザー＋大獣神。 */
const KING_SET = (): CardInstance[] => [inst("RS-547", "kb"), inst("RS-288", "dc"), inst("RS-034", "dj")];
/** 守護獣5体（大獣神のかわり）。 */
const FIVE_BEASTS = (): CardInstance[] => ["RS-035", "RS-036", "RS-037", "RS-038", "RS-039"].map((id) => inst(id, "g"));

// ===========================================================================
describe("RS-545 究極大獣神", () => {
  const TEXT =
    "合体―獣騎神キングブラキオン＋守護獣ドラゴンシーザー＋大獣神（または守護獣ティラノザウルス＋守護獣ジュウマンモス＋守護獣トリケラトプス＋守護獣サーベルタイガー＋守護獣プテラノドン） 【グランバニッシャー】これをラッシュしたとき、敵軍ユニットをBPの合計が20000以下になるように選び撃破してもよい。";
  const mk = (rush: CardInstance[], power = 8, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-545", "u")], rush, command: releasedN(2), power: powerCards(power), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e"), ...p2 },
    }, [BP7000]);

  it("RS-545: カタログ本文・スペックが出典と一致（出典: atwiki/page-1210）", () => {
    expectCatalogText("RS-545", TEXT);
    expectStats("RS-545", {
      name: "究極大獣神",
      category: "WB",
      size: "XL",
      bp: 20000,
      sp: 2,
      powerCost: "8+",
      features: ["恐竜", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-545: 追加条件 — キングブラキオン＋ドラゴンシーザー＋大獣神を捨札にしてラッシュでき、1体欠けると満たせない（出典: atwiki/page-1210・R-ADD-06）", () => {
    expect(canStartRush(mk(KING_SET().slice(1)), "player1", "RS-545:u")).toBe(false);
    const r = rushFromHand(mk(KING_SET()), "player1", "RS-545:u");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-545:u")).toBe("rush");
    expect(r.state.players.player1.discard.map((c) => c.cardId).sort()).toEqual(["RS-034", "RS-288", "RS-547"]);
  });

  it("RS-545: 追加条件 — 大獣神のかわりに守護獣5体（ティラノザウルス〜プテラノドン）でもラッシュできる（出典: atwiki/page-1210「（または…）」）", () => {
    const r = rushFromHand(mk([inst("RS-547", "kb"), inst("RS-288", "dc"), ...FIVE_BEASTS()]), "player1", "RS-545:u");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-545:u")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(7);
  });

  it("RS-545: 必要パワー8+ — パワー7ではラッシュできない（出典: atwiki/page-1210）", () => {
    expect(canStartRush(mk(KING_SET(), 7), "player1", "RS-545:u")).toBe(false);
  });

  it("RS-545: 【グランバニッシャー】ラッシュしたとき、敵軍バトルエリア・ラッシュエリアのユニットを選べる（出典: atwiki/page-1210「敵軍ユニットを…選び撃破してもよい」）", () => {
    const r = rushFromHand(
      mk(KING_SET(), 8, { battle: [inst("TST-UNIT-7", "eb")], rush: [inst("TST-UNIT-0", "er")] }),
      "player1",
      "RS-545:u",
    );
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-545");
    expect(choiceIds(r.state)).toEqual(["TST-UNIT-0:er", "TST-UNIT-7:eb"]);
  });

  it("RS-545: 【グランバニッシャー】任意 — 選ばずに見送れる（出典: atwiki/page-1210「撃破してもよい」）", () => {
    const r = rushFromHand(mk(KING_SET(), 8, { rush: [inst("TST-UNIT-0", "er")] }), "player1", "RS-545:u");
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-545");
    expect(canSkip(r.state)).toBe(true);
    const s = resolveAll(skip(r.state));
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("rush");
  });

  it("RS-545: 【グランバニッシャー】BP の合計が20000以下なら複数体（13000＋7000）選んで撃破できる（出典: atwiki/page-1210「BPの合計が20000以下になるように選び」）", () => {
    let s = rushFromHand(
      mk(KING_SET(), 8, { rush: [inst("TST-UNIT-7", "a"), inst("SPEC-7000", "b")] }),
      "player1",
      "RS-545:u",
    ).state;
    s = pick(s, "TST-UNIT-7:a");
    expect(choiceIds(s)).toContain("SPEC-7000:b");
    s = resolveAll(pick(s, "SPEC-7000:b"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-7000:b")).toBe("discard");
  });

  it("RS-545: 【グランバニッシャー】BP の合計が20000を超える組み合わせ（13000＋13000）は選べない（出典: atwiki/page-1210「20000以下になるように」）", () => {
    let s = rushFromHand(
      mk(KING_SET(), 8, { rush: [inst("TST-UNIT-7", "a"), inst("TST-UNIT-7", "b")] }),
      "player1",
      "RS-545:u",
    ).state;
    s = resolveAll(pick(s, "TST-UNIT-7:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-7:b")).toBe("rush");
  });

  it("RS-545: 【グランバニッシャー】ラッシュしないとき（場に置かれているだけ）は発動しない（出典: atwiki/page-1210「これをラッシュしたとき」）", () => {
    const s = st({ player1: { rush: [inst("RS-545", "u")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    const t = enterSeq(s, ["RS-545:u"]);
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(t, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  it("RS-545: 【グランバニッシャー】選んだユニットを撃破する（出典: atwiki/page-1210）", () => {
    let s = rushFromHand(mk(KING_SET(), 8, { rush: [inst("TST-UNIT-7", "a")] }), "player1", "RS-545:u").state;
    s = resolveAll(pick(s, "TST-UNIT-7:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:a")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-546 獣帝大獣神", () => {
  const TEXT =
    "合体―守護獣ドラゴンシーザー＋大獣神（または守護獣ティラノザウルス＋守護獣ジュウマンモス＋守護獣トリケラトプス＋守護獣サーベルタイガー＋守護獣プテラノドン） 【エンパイアアタック】自軍ターン中、これがバトルエリアに出たとき、バトルエリアにあるWBを持たないユニットをすべて撃破する。";
  const board = (activePlayer: "player1" | "player2") =>
    st(
      {
        activePlayer,
        player1: { battle: [inst("SPEC-ET-S", "own"), inst("TST-UNIT-0", "ownwb")], rush: [inst("RS-546", "u"), inst("SPEC-ET-S", "ownr")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-ET-M", "en"), inst("TST-UNIT-2", "enwb")], rush: [inst("SPEC-ET-S", "enr")], deck: deckCards(3, "e") },
      },
      [ET_S, ET_M],
    );

  it("RS-546: カタログ本文・スペックが出典と一致（出典: atwiki/page-1170）", () => {
    expectCatalogText("RS-546", TEXT);
    expectStats("RS-546", {
      name: "獣帝大獣神",
      category: "WB",
      size: "L",
      bp: 18000,
      sp: 1,
      powerCost: "8+",
      features: ["恐竜", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const mk546 = (rush: CardInstance[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-546", "u")], rush, command: releasedN(2), power: powerCards(8), deck: deckCards(3) } });

  it("RS-546: 追加条件 — ドラゴンシーザー＋大獣神を捨札にしてラッシュでき、大獣神だけでは満たせない（出典: atwiki/page-1170・R-ADD-06）", () => {
    expect(canStartRush(mk546([inst("RS-034", "dj")]), "player1", "RS-546:u")).toBe(false);
    const a = rushFromHand(mk546([inst("RS-288", "dc"), inst("RS-034", "dj")]), "player1", "RS-546:u");
    expect(a.ok).toBe(true);
    expect(zoneOf(a.state, "player1", "RS-546:u")).toBe("rush");
    expect(a.state.players.player1.discard.map((c) => c.cardId).sort()).toEqual(["RS-034", "RS-288"]);
  });

  it("RS-546: 必要パワー8+ — パワー7ではラッシュできない（出典: atwiki/page-1170）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-546", "u")], rush: [inst("RS-288", "dc"), inst("RS-034", "dj")], command: releasedN(2), power: powerCards(7), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-546:u")).toBe(false);
  });

  it("RS-546: 追加条件 — ドラゴンシーザー＋守護獣5体（大獣神のかわり）でもラッシュできる（出典: atwiki/page-1170「（または…）」）", () => {
    const b = rushFromHand(mk546([inst("RS-288", "dc"), ...FIVE_BEASTS()]), "player1", "RS-546:u");
    expect(b.ok).toBe(true);
    expect(b.state.players.player1.discard).toHaveLength(6);
  });

  it("RS-546: 【エンパイアアタック】自軍ターン中にバトルエリアに出たとき、両軍バトルエリアの WB を持たないユニットをすべて撃破する（強制）（出典: atwiki/page-1170）", () => {
    const s = resolveAll(enter(board("player1"), "RS-546:u"));
    expect(zoneOf(s, "player1", "SPEC-ET-S:own")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ET-M:en")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:ownwb")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-2:enwb")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-546:u")).toBe("battle");
  });

  it("RS-546: 【エンパイアアタック】ラッシュエリアの WB を持たないユニットは撃破しない（出典: atwiki/page-1170「バトルエリアにある」）", () => {
    const s = resolveAll(enter(board("player1"), "RS-546:u"));
    expect(zoneOf(s, "player1", "SPEC-ET-S:ownr")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-ET-S:enr")).toBe("rush");
  });

  it("RS-546: 【エンパイアアタック】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1170「自軍ターン中」）", () => {
    const s = resolveAll(enterBattleByEffect(board("player2"), "player1", "RS-546:u"));
    expect(zoneOf(s, "player1", "SPEC-ET-S:own")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ET-M:en")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-547 獣騎神キングブラキオン", () => {
  const TEXT =
    "※これは自軍コマンドを2つホールドしなければバトルエリアに出られない。 【守護獣の使徒】これが自軍エリアにある間、WBを持つ自軍Mユニットは、『※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）』を得る。ただし、そのユニットが持つ「ラッシュしたとき」の効果を発動したときは、そのユニットをホールドする。";

  it("RS-547: カタログ本文・スペックが出典と一致（出典: atwiki/page-1171）", () => {
    expectCatalogText("RS-547", TEXT);
    expectStats("RS-547", {
      name: "獣騎神キングブラキオン",
      category: "WB",
      size: "XL",
      bp: 6000,
      sp: undefined,
      powerCost: 4,
      features: ["恐竜"],
    });
  });

  it("RS-547: ※ リリース状態の自軍コマンドが2つあればホールドしてバトルエリアに出られ、1つでは出られない（出典: atwiki/page-1171「自軍コマンドを2つホールドしなければ」）", () => {
    const one = st({ player1: { rush: [inst("RS-547", "kb")], command: releasedN(1), deck: deckCards(3) } });
    expect(canEnter(one, "RS-547:kb")).toBe(false);
    const two = st({ player1: { rush: [inst("RS-547", "kb")], command: releasedN(2), deck: deckCards(3) } });
    expect(canEnter(two, "RS-547:kb")).toBe(true);
    let s = act(two, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-547:kb" });
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RS-547:kb")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("RS-547: 【守護獣の使徒】自軍エリアにある間、WB の自軍 M ユニット（ドラゴンシーザー）はレジストを得る（出典: atwiki/page-1171）", () => {
    let s = attackUntilRegister({ battle: [inst("RS-288", "dc")], rush: [inst("RS-547", "kb")] }, "RS-288:dc");
    expect(registerOffered(s)).toBe(true);
    s = resolveAll(act(s, { type: "use_register", playerId: "player1" }));
    expect(unitIn(s, "player1", "RS-288:dc")?.commandHeld).toBe(true);
  });

  it("RS-547: 【守護獣の使徒】キングブラキオンが自軍エリアになければ（捨札）レジストを得ない（出典: atwiki/page-1171「これが自軍エリアにある間」）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-288", "dc")], discard: [inst("RS-547", "kb")] }, "RS-288:dc");
    expect(registerOffered(s)).toBe(false);
  });

  it("RS-547: 【守護獣の使徒】WB を持たない M ユニットはレジストを得ない（出典: atwiki/page-1171「WBを持つ自軍Mユニット」）", () => {
    const s = attackUntilRegister({ battle: [inst("SPEC-ET-M", "m")], rush: [inst("RS-547", "kb")] }, "SPEC-ET-M:m", {}, "TST-UNIT-7:atk", [ET_M]);
    expect(registerOffered(s)).toBe(false);
  });

  it("RS-547: 【守護獣の使徒】WB の S ユニットはレジストを得ない（出典: atwiki/page-1171「Mユニット」）", () => {
    const s = attackUntilRegister({ battle: [inst("TST-UNIT-0", "s")], rush: [inst("RS-547", "kb")] }, "TST-UNIT-0:s");
    expect(registerOffered(s)).toBe(false);
  });

  it("RS-547: 【守護獣の使徒】敵軍のキングブラキオンでは自軍 M ユニットはレジストを得ない（出典: atwiki/page-1171「自軍エリア」「自軍Mユニット」）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-288", "dc")] }, "RS-288:dc", { rush: [inst("RS-547", "kb")] });
    expect(registerOffered(s)).toBe(false);
  });

  it("RS-547: キングブラキオン自身（XL）はレジストを持たない（出典: atwiki/page-1171 — 『※レジスト』は WB の自軍 M ユニットが得る能力）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-547", "kb")] }, "RS-547:kb");
    expect(registerOffered(s)).toBe(false);
  });

  it("RS-547: 【守護獣の使徒】ただし書き — WB の M ユニット（ガオパンダ）が「ラッシュしたとき」の効果を発動したら、そのユニットをホールドする（出典: atwiki/page-1171「そのユニットをホールドする」）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-305", "pd")], rush: [inst("RS-547", "kb")], command: releasedN(2), power: powerCards(5), deck: deckCards(3) },
      player2: { command: releasedN(2, "TST-OP", "ec"), deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s0, "player1", "RS-305:pd");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player1.rush.find((c) => c.instanceId === "RS-305:pd")?.commandHeld).toBe(true);
  });

  it("RS-547: 【守護獣の使徒】ただし書き — キングブラキオンがなければ、ガオパンダは効果を発動してもホールドされない（出典: atwiki/page-1171・R-HOLD）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-305", "pd")], command: releasedN(2), power: powerCards(5), deck: deckCards(3) },
      player2: { command: releasedN(2, "TST-OP", "ec"), deck: deckCards(3, "e") },
    });
    const s = resolveAll(rushFromHand(s0, "player1", "RS-305:pd").state);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player1.rush.find((c) => c.instanceId === "RS-305:pd")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("RS-548 ティラノレンジャー（2nd）", () => {
  const TEXT = "※レジスト ※このユニットのナンバーの数字は、ホールド状態のユニット1体につき1増える。 【龍撃剣】「SP1」";

  it("RS-548: カタログ本文・スペックが出典と一致（出典: atwiki/page-1225）", () => {
    expectCatalogText("RS-548", TEXT);
    expectStats("RS-548", {
      name: "ティラノレンジャー（2nd）",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["レッド", "男", "2nd"],
    });
  });

  it("RS-548: ※レジスト — バトルで撃破されたときホールドしてその場に留められる（出典: atwiki/page-1225・R-KW-RESIST-01）", () => {
    let s = attackUntilRegister({ battle: [inst("RS-548", "t")] }, "RS-548:t");
    expect(registerOffered(s)).toBe(true);
    s = resolveAll(act(s, { type: "use_register", playerId: "player1" }));
    expect(unitIn(s, "player1", "RS-548:t")?.commandHeld).toBe(true);
  });

  it("RS-548: ホールド状態のユニットがなければナンバー2のまま、2番目で NC が成立する（出典: atwiki/page-1225・R-CN-02）", () => {
    const s = enterSeq(st({ player1: { battle: fill(1), rush: [inst("RS-548", "t")], deck: deckCards(3) } }), ["RS-548:t"]);
    expect(ncLogged(s, "RS-548")).toBe(true);
  });

  it("RS-548: 【龍撃剣】NC が成立すると SP1（出典: atwiki/page-1225「【龍撃剣】「SP1」」）", () => {
    const s = enterSeq(st({ player1: { battle: fill(1), rush: [inst("RS-548", "t")], deck: deckCards(3) } }), ["RS-548:t"]);
    expect(spOf(s, "player1", "RS-548:t")).toBe(1);
  });

  it("RS-548: ※ ホールド状態のユニットが1体（敵軍）あればナンバー3になり、2番目では NC が成立しない（出典: atwiki/page-1225「ホールド状態のユニット1体につき1増える」）", () => {
    const s = enterSeq(
      st({ player1: { battle: fill(1), rush: [inst("RS-548", "t")], deck: deckCards(3) }, player2: { battle: [heldUnit("TST-UNIT-0", "h")] } }),
      ["RS-548:t"],
    );
    expect(ncLogged(s, "RS-548")).toBe(false);
  });

  it("RS-548: ※ ホールド状態のユニットが2体（自軍・敵軍）あればナンバー4になり、4番目で NC が成立する（出典: atwiki/page-1225）", () => {
    const s = enterSeq(
      st({
        player1: { battle: [heldUnit("TST-UNIT-0", "h1"), ...fill(2)], rush: [inst("RS-548", "t")], deck: deckCards(3) },
        player2: { battle: [heldUnit("TST-UNIT-0", "h2")] },
      }),
      ["RS-548:t"],
    );
    expect(ncLogged(s, "RS-548")).toBe(true);
  });
});

// ===========================================================================
describe("RS-549 トリケラレンジャー（2nd）", () => {
  const TEXT =
    "※レジスト 【トリケランス】「SP1」敵軍バトルエリアのSユニットを、必要パワーの数字の合計が敵軍ダメージの点数と同じ数になるまで好きな数選び、ホールドする。";
  const P1 = sUnit("SPEC-P1", { powerCost: 1 });
  const P2 = sUnit("SPEC-P2", { powerCost: 2 });
  const P4 = sUnit("SPEC-P4", { powerCost: 4 });
  const board = (damage: number, nth = 2) =>
    st(
      {
        player1: { battle: fill(nth - 1), rush: [inst("RS-549", "t")], deck: deckCards(3) },
        player2: {
          battle: [inst("SPEC-P1", "a"), inst("SPEC-P2", "b"), inst("SPEC-P4", "c"), inst("TST-UNIT-2", "m")],
          rush: [inst("SPEC-P1", "r")],
          power: damageCards(damage),
          deck: deckCards(3, "e"),
        },
      },
      [P1, P2, P4],
    );

  it("RS-549: カタログ本文・スペックが出典と一致（出典: atwiki/page-1172）", () => {
    expectCatalogText("RS-549", TEXT);
    expectStats("RS-549", {
      name: "トリケラレンジャー（2nd）",
      category: "WB",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 2,
      comboNumber: 2,
      features: ["ブルー", "男", "2nd"],
    });
  });

  it("RS-549: ※レジスト — バトルで撃破されたときホールドしてその場に留められる（出典: atwiki/page-1172・R-KW-RESIST-01）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-549", "t")] }, "RS-549:t");
    expect(registerOffered(s)).toBe(true);
  });

  it("RS-549: 【トリケランス】NC が成立すると SP1（出典: atwiki/page-1172「【トリケランス】「SP1」」）", () => {
    const s = resolveAll(enterSeq(board(3), ["RS-549:t"]));
    expect(spOf(s, "player1", "RS-549:t")).toBe(1);
  });

  it("RS-549: 【トリケランス】敵軍ダメージ3なら、必要パワー1と2の S ユニットを選んでホールドする（出典: atwiki/page-1172「必要パワーの数字の合計が敵軍ダメージの点数と同じ数になるまで好きな数選び、ホールドする」）", () => {
    let s = enterSeq(board(3), ["RS-549:t"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-549");
    s = pick(s, "SPEC-P1:a");
    s = resolveAll(pick(s, "SPEC-P2:b"));
    expect(unitIn(s, "player2", "SPEC-P1:a")?.commandHeld).toBe(true);
    expect(unitIn(s, "player2", "SPEC-P2:b")?.commandHeld).toBe(true);
  });

  it("RS-549: 【トリケランス】候補は敵軍バトルエリアの S ユニットで、必要パワーが敵軍ダメージを超えるもの・M ユニット・ラッシュエリアのユニットは選べない（出典: atwiki/page-1172）", () => {
    const s = enterSeq(board(3), ["RS-549:t"]);
    expect(choiceIds(s)).toEqual(["SPEC-P1:a", "SPEC-P2:b"]);
  });

  it("RS-549: 【トリケランス】NC が成立しなければ（1番目）発動せず、敵軍ユニットはホールドされない（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(board(3, 1), ["RS-549:t"]));
    expect(spOf(s, "player1", "RS-549:t")).toBe(0);
    expect(s.players.player2.battle.some((c) => c.commandHeld)).toBe(false);
  });
});
