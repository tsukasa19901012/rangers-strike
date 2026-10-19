/**
 * カード別スペック: RS-590〜RS-597（第8弾「究極の八神」クエスター・レイ〜レツタカ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-590〜RS-597 は該当なし）、grnrngr/faq-card-8
 *     （RS-569 の Q&A で RS-592 エンジンオーG6 の追加条件に言及）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-KW-RC-01、R-BA-04 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackedInEnemyTurn,
  canEndPhase,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  enterBattleByEffect,
  enter,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  inst,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  legal,
  toPhase,
} from "./RS8-582-604.helpers";

const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });

/** 炎神 M ユニット共通の ※ 行（「毎ターン、可能ならバトルエリアに出る」「敵軍ターン中に撃破されて捨札になったときパワーゾーンに置いてもよい」）。 */
function vehicleNoteTests(id: string, page: string, opts: { mustEnter: boolean }) {
  if (opts.mustEnter) {
    it(`${id}: ※ 毎ターン、可能ならバトルエリアに出る — ラッシュエリアにある間はバトルフェイズを終えられない（出典: ${page}・R-BA-04）`, () => {
      const s = st({ player1: { rush: [inst(id, "v")], deck: deckCards(3) } });
      expect(canEndPhase(s)).toBe(false);
      expect(canEndPhase(enterSeq(s, [`${id}:v`]))).toBe(true);
    });
  }

  it(`${id}: ※ 敵軍ターン中に撃破されて捨札になったとき、自軍パワーゾーンに置ける（出典: ${page}）`, () => {
    let s = attackedInEnemyTurn({ battle: [inst(id, "v")] }, `${id}:v`);
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, "place_in_power"));
    expect(zoneOf(s, "player1", `${id}:v`)).toBe("power");
  });

  it(`${id}: ※ パワーゾーンに置かないこともでき、そのときは捨札のまま（出典: ${page}「おいてもよい」）`, () => {
    const s = resolveAll(skip(attackedInEnemyTurn({ battle: [inst(id, "v")] }, `${id}:v`)));
    expect(zoneOf(s, "player1", `${id}:v`)).toBe("discard");
  });

  it(`${id}: ※ 自軍ターン中に撃破されたときはパワーゾーンに置けない（出典: ${page}「敵軍ターン中」）`, () => {
    let s = st({ player1: { battle: [inst(id, "v")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") } });
    s = resolveAll(attack(s, `${id}:v`, "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", `${id}:v`)).toBe("discard");
  });
}

// ===========================================================================
describe("RS-590 クエスター・レイ", () => {
  const TEXT =
    "【グレイボンバー】相手の手札を見てもよい。そうしたとき、ＮＣかＲＣを持つSユニットのカードを1枚選び、そのNCまたはRCの効果を、このユニットの効果として発動する。（この効果は「クエスター・ガイ」からコンビネーションするときはナンバーに関係なく発動する）";

  it("RS-590: カタログ本文・スペックが出典と一致（出典: atwiki/page-1200）", () => {
    expectCatalogText("RS-590", TEXT);
    expectStats("RS-590", {
      name: "クエスター・レイ",
      category: "DA",
      size: "S",
      bp: 7000,
      sp: undefined,
      powerCost: "5+",
      comboNumber: 5,
      features: ["アシュ", "男", "クエスター"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-590: 追加条件 — 自軍「大いなる獣　レイ」1体を捨札にしてラッシュできる（出典: atwiki/page-1200）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-590", "q")], rush: [inst("RS-588", "r")], command: releasedCat("DA", 1), power: powerCards(5), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-590:q", { materials: ["RS-588:r"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-590:q")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-588:r")).toBe("discard");
  });

  it("RS-590: 追加条件 — 自軍に「大いなる獣　レイ」がなければラッシュできない（出典: atwiki/page-1200）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-590", "q")], rush: [inst("RS-587", "g")], command: releasedCat("DA", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-590:q")).toBe(false);
  });

  // 相手の手札にマジブルー（RS-059。NC【未来予知】自分は1枚ドローする）。
  const board = (before: ReturnType<typeof inst>[]) =>
    st({
      player1: { battle: before, rush: [inst("RS-590", "q")], deck: deckCards(5) },
      player2: { hand: [inst("RS-059", "blue"), inst("TST-OP", "eo")], deck: deckCards(3, "e") },
    });

  it("RS-590: 【グレイボンバー】NC（5番目）— 相手の手札の NC を持つ S ユニットを選び、その NC（1枚ドロー）をこのユニットの効果として発動する（出典: atwiki/page-1200）", () => {
    let s = enterSeq(board(fill(4)), ["RS-590:q"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-590");
    s = resolveAll(s, ["RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(1);
    expect(zoneOf(s, "player2", "RS-059:blue")).toBe("hand");
  });

  it("RS-590: 【グレイボンバー】「クエスター・ガイ」の次（2番目）ならナンバーに関係なく発動する（出典: atwiki/page-1200「ナンバーに関係なく発動する」）", () => {
    const s = resolveAll(enterSeq(board([inst("RS-589", "qg")]), ["RS-590:q"]), ["RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(1);
  });

  it("RS-590: 【グレイボンバー】「怒りの鬼神　ガイ」の次（2番目）では、ナンバーが合わないので発動しない（出典: atwiki/page-1200「「クエスター・ガイ」からコンビネーションするとき」・R-CN-02）", () => {
    const s = resolveAll(enterSeq(board([inst("RS-587", "g")]), ["RS-590:q"]), ["RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-590: 【グレイボンバー】任意 — 相手の手札を見ないこともできる（出典: atwiki/page-1200「見てもよい」）", () => {
    let s = enterSeq(board(fill(4)), ["RS-590:q"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-590");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // ユーザー決定（2026-10-19）「クエスターレイ等の相手の手札を見て選ぶ場合も指しています」（docs/rules/README.md §5.7 j）。
  it("RS-590: 【グレイボンバー】相手の手札を見て選ぶので、「相手に選ばれない」を持つカード（XG3-066 仮面ライダーサソードRF。NC を持つ S ユニット）は選べない（出典: ユーザー決定 2026-10-19「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」「クエスターレイ等の相手の手札を見て選ぶ場合も指しています」・XG3-066 本文「※これはアタックされる以外では相手に選ばれない」）", () => {
    const b = board(fill(4));
    const s0 = { ...b, players: { ...b.players, player2: { ...b.players.player2, hand: [inst("XG3-066", "sa"), ...b.players.player2.hand] } } };
    let s = enterSeq(s0, ["RS-590:q"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-590");
    s = pick(s, "RS-590:q");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-590");
    expect(choiceIds(s)).toEqual(["RS-059:blue"]);
  });

  it("RS-590: 【グレイボンバー】見た手札に「相手に選ばれない」カードしかなければ、選ぶカードがなく何も起きない（出典: ユーザー決定 2026-10-19「クエスターレイ等の相手の手札を見て選ぶ場合も指しています」）", () => {
    const b = board(fill(4));
    const s0 = { ...b, players: { ...b.players, player2: { ...b.players.player2, hand: [inst("XG3-066", "sa"), inst("TST-OP", "eo")] } } };
    const s = resolveAll(enterSeq(s0, ["RS-590:q"]), ["RS-590:q", "XG3-066:sa"]);
    expect(zoneOf(s, "player2", "XG3-066:sa")).toBe("hand");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.todo(
    "RS-590: 【グレイボンバー】RC を持つ S ユニットのカードを選べば、その RC の効果をこのユニットの効果として発動する（出典: atwiki/page-1200「ＮＣかＲＣを持つSユニット」）— RC を持つ S ユニットの RC 効果を手札から借りて発動させたかを公開 API で観測できる組み合わせがないため",
  );
});

// ===========================================================================
describe("RS-591 ガンバルオー", () => {
  const TEXT =
    "合体―バルカ＋ガンパード＋キャリゲーター 【ガンバルグランプリ】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP4000以下のユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";
  const BP4000 = sUnit("SPEC-BP4000", { bp: 4000 });
  const BP4500 = sUnit("SPEC-BP4500", { bp: 4500 });
  const board = () =>
    st(
      {
        player1: { rush: [inst("RS-591", "g")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BP4000", "a"), inst("SPEC-BP4500", "b")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") },
      },
      [BP4000, BP4500],
    );

  it("RS-591: カタログ本文・スペックが出典と一致（出典: atwiki/page-1201）", () => {
    expectCatalogText("RS-591", TEXT);
    expectStats("RS-591", {
      name: "ガンバルオー",
      category: "OT",
      size: "L",
      bp: 14000,
      sp: 1,
      powerCost: "7+",
      features: ["人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const rushBoard = (rush: ReturnType<typeof inst>[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-591", "g")], rush, command: releasedCat("OT", 1), power: powerCards(7), deck: deckCards(3) } });

  it("RS-591: 追加条件 — 自軍の合体ユニット（バルカ＋ガンパード＋キャリゲーター）を捨札にしてラッシュできる（出典: atwiki/page-1201「合体―」）", () => {
    const r = rushFromHand(rushBoard([inst("RS-593", "a"), inst("RS-594", "b"), inst("RS-595", "c")]), "player1", "RS-591:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-591:g")).toBe("rush");
    for (const id of ["RS-593:a", "RS-594:b", "RS-595:c"]) expect(zoneOf(r.state, "player1", id)).toBe("discard");
  });

  it("RS-591: 追加条件 — 合体ユニットが1体足りない（キャリゲーターがいない）とラッシュできない（出典: atwiki/page-1201「合体―」）", () => {
    expect(canStartRush(rushBoard([inst("RS-593", "a"), inst("RS-594", "b")]), "player1", "RS-591:g")).toBe(false);
  });

  it("RS-591: 【ガンバルグランプリ】候補は敵軍バトルエリアの BP4000 以下のユニットだけ（BP4500・ラッシュエリアは選べない）（出典: atwiki/page-1201）", () => {
    const s = enterSeq(board(), ["RS-591:g"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-591");
    expect(choiceIds(s)).toEqual(["SPEC-BP4000:a"]);
  });

  it("RS-591: 【ガンバルグランプリ】選んだユニットは持ち主（敵軍）のパワーゾーンに送られる（出典: atwiki/page-1201「持ち主のパワーゾーンに送って」）", () => {
    const s = resolveAll(pick(enterSeq(board(), ["RS-591:g"]), "SPEC-BP4000:a"));
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("power");
  });

  it("RS-591: 【ガンバルグランプリ】任意 — 送らないこともできる（出典: atwiki/page-1201「送ってもよい」）", () => {
    const s0 = enterSeq(board(), ["RS-591:g"]);
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("battle");
  });

  it("RS-591: 【ガンバルグランプリ】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1201「自軍ターン中」）", () => {
    const s0 = st(
      {
        activePlayer: "player2",
        player1: { rush: [inst("RS-591", "g")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BP4000", "a")], deck: deckCards(3, "e") },
      },
      [BP4000],
    );
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-591:g"));
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-592 エンジンオーG6", () => {
  const TEXT =
    "合体―エンジンオー（またはスピードル＋バスオン＋ベアールV）＋ガンバルオー（またはバルカ＋ガンパード＋キャリゲーター） 【G6グランプリ】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンのカードの枚数が6枚になるように、自軍パワーゾーンのオモテ向きのカードを選び捨札にしてもよい。そうしたとき、捨札にした枚数と同じ数まで、BP6000以下の敵軍ユニットを選び撃破する。";

  it("RS-592: カタログ本文・スペックが出典と一致（出典: atwiki/page-1223）", () => {
    expectCatalogText("RS-592", TEXT);
    expectStats("RS-592", {
      name: "エンジンオーG6",
      category: "OT",
      size: "L",
      bp: 18000,
      sp: 2,
      powerCost: "6+",
      features: ["人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-592: 追加条件の文面は「自軍合体ユニットをパワーゾーンに送る」（出典: atwiki/page-1223「追加条件：自軍合体ユニットをパワーゾーンに送る」）", () => {
    expect(st().definitions["RS-592"]?.rushAdditionalCondition?.text).toBe("自軍合体ユニットをパワーゾーンに送る");
  });

  const rushBoard = (rush: ReturnType<typeof inst>[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-592", "g6")], rush, command: releasedCat("OT", 1), power: powerCards(6), deck: deckCards(3) } });

  it("RS-592: 追加条件 — エンジンオー＋ガンバルオーをパワーゾーンに送ってラッシュする（捨札にはしない）（出典: atwiki/page-1223・grnrngr/faq-card-8 RS-569 Q1「合体ユニットをパワー送りにする」）", () => {
    const r = rushFromHand(rushBoard([inst("RS-515", "eo"), inst("RS-591", "gb")]), "player1", "RS-592:g6");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-592:g6")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-515:eo")).toBe("power");
    expect(zoneOf(r.state, "player1", "RS-591:gb")).toBe("power");
  });

  it("RS-592: 追加条件 — エンジンオーのかわりにスピードル＋バスオン＋ベアールV、ガンバルオーのかわりにバルカ＋ガンパード＋キャリゲーターでもよい（出典: atwiki/page-1223「（または…）」）", () => {
    const six = [inst("RS-505", "a"), inst("RS-506", "b"), inst("RS-507", "c"), inst("RS-593", "d"), inst("RS-594", "e"), inst("RS-595", "f")];
    const r = rushFromHand(rushBoard(six), "player1", "RS-592:g6", { destination: "discard" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-592:g6")).toBe("rush");
    for (const c of six) expect(zoneOf(r.state, "player1", c.instanceId)).toBe("power");
  });

  it("RS-592: 追加条件 — ガンバルオー（またはその3体）がなければラッシュできない（出典: atwiki/page-1223）", () => {
    expect(canStartRush(rushBoard([inst("RS-515", "eo")]), "player1", "RS-592:g6")).toBe(false);
  });

  const BP6000 = sUnit("SPEC-BP6000", { bp: 6000 });
  const BP7000 = sUnit("SPEC-BP7000", { bp: 7000 });
  const board = (power: ReturnType<typeof inst>[]) =>
    st(
      {
        player1: { rush: [inst("RS-592", "g")], power, deck: deckCards(3) },
        player2: {
          battle: [inst("SPEC-BP6000", "a"), inst("SPEC-BP7000", "big")],
          rush: [inst("TST-UNIT-0", "r"), inst("TST-UNIT-0", "r2")],
          deck: deckCards(3, "e"),
        },
      },
      [BP6000, BP7000],
    );

  it("RS-592: 【G6グランプリ】パワー8枚なら2枚を捨札にして6枚にし、BP6000 以下の敵軍ユニットを2体まで撃破する（出典: atwiki/page-1223）", () => {
    let s = enterSeq(board(powerCards(8)), ["RS-592:g"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-592");
    s = resolveAll(s, ["TST-P:pw0", "TST-P:pw1", "SPEC-BP6000:a", "TST-UNIT-0:r"]);
    expect(s.players.player1.power).toHaveLength(6);
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BP6000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r2")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-BP7000:big")).toBe("battle");
  });

  it("RS-592: 【G6グランプリ】撃破できるのは BP6000 以下の敵軍ユニットだけ（BP7000 は選べない）（出典: atwiki/page-1223「BP6000以下の敵軍ユニット」）", () => {
    const s = resolveAll(enterSeq(board(powerCards(8)), ["RS-592:g"]), ["TST-P:pw0", "TST-P:pw1", "SPEC-BP7000:big"]);
    expect(zoneOf(s, "player2", "SPEC-BP7000:big")).toBe("battle");
  });

  it("RS-592: 【G6グランプリ】パワーが6枚ちょうどなら捨札にするカードがなく、敵軍ユニットを撃破しない（出典: atwiki/page-1223「6枚になるように」「捨札にした枚数と同じ数まで」）", () => {
    const s = enterSeq(board(powerCards(6)), ["RS-592:g"]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-592");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-BP6000:a")).toBe("battle");
  });

  it("RS-592: 【G6グランプリ】ダメージ（ウラ向き）のカードは捨札にできない — オモテ6枚＋ウラ1枚なら、オモテ1枚を捨札にして6枚にし、1体だけ撃破（出典: atwiki/page-1223「オモテ向きのカードを選び」）", () => {
    const power = [...powerCards(6), { ...inst("TST-P", "dmg"), faceDown: true }];
    const s = resolveAll(enterSeq(board(power), ["RS-592:g"]), ["TST-P:dmg", "TST-P:pw0", "SPEC-BP6000:a", "TST-UNIT-0:r"]);
    expect(zoneOf(s, "player1", "TST-P:dmg")).toBe("power");
    expect(s.players.player1.power).toHaveLength(6);
    expect([zoneOf(s, "player2", "SPEC-BP6000:a"), zoneOf(s, "player2", "TST-UNIT-0:r")].filter((z) => z === "discard")).toHaveLength(1);
  });

  it("RS-592: 【G6グランプリ】任意 — 捨札にしなければ敵軍ユニットは撃破されない（出典: atwiki/page-1223「捨札にしてもよい」）", () => {
    let s = enterSeq(board(powerCards(8)), ["RS-592:g"]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-592") s = skip(s);
    s = resolveAll(s);
    expect(s.players.player1.power).toHaveLength(8);
    expect(zoneOf(s, "player2", "SPEC-BP6000:a")).toBe("battle");
  });

  it("RS-592: 【G6グランプリ】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1223「自軍ターン中」）", () => {
    const s0 = st(
      { activePlayer: "player2", player1: { rush: [inst("RS-592", "g")], power: powerCards(8), deck: deckCards(3) }, player2: { battle: [inst("SPEC-BP6000", "a")], deck: deckCards(3, "e") } },
      [BP6000],
    );
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-592:g"));
    expect(s.players.player1.power).toHaveLength(8);
    expect(zoneOf(s, "player2", "SPEC-BP6000:a")).toBe("battle");
  });

  it.todo(
    "RS-592: 公式Q&A — スーパーフォーメーション（RS-347）で足りない合体ユニットをリリース状態の自軍コマンドから捨札にして追加条件を満たせる（出典: grnrngr/faq-card-8 RS-569 Q1「はい、できます」）— RS-347 の該当処理と組み合わせた追加条件の公開 API 経路がなく、RS-347 側の仕様テストの範囲のため",
  );
});

// ===========================================================================
describe("RS-593 バルカ", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【バルカッター】「SP1」相手は自分自身のパワーゾーンからオモテ向きのカードを1枚選び手札に戻してもよい。そうしたとき、このターン、これはストライクできない。";

  it("RS-593: カタログ本文・スペックが出典と一致（出典: atwiki/page-1202）", () => {
    expectCatalogText("RS-593", TEXT);
    expectStats("RS-593", {
      name: "バルカ",
      category: "OT",
      size: "M",
      bp: 1000,
      sp: "special",
      powerCost: 2,
      comboNumber: 4,
      features: ["車両", "炎神"],
    });
  });

  vehicleNoteTests("RS-593", "atwiki/page-1202", { mustEnter: true });

  const ncBoard = (enemyPower: ReturnType<typeof inst>[], nth = 4) =>
    st({ player1: { battle: fill(nth - 1), rush: [inst("RS-593", "v")], deck: deckCards(3) }, player2: { power: enemyPower, deck: deckCards(3, "e") } });

  it("RS-593: 【バルカッター】NC（4番目）— 相手がパワーゾーンのオモテ向きのカードを1枚手札に戻すと、このターンこれはストライクできない（出典: atwiki/page-1202）", () => {
    let s = enter(ncBoard(powerCards(2, "ep")), "RS-593:v");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = resolveAll(pick(s, "TST-P:ep0"));
    expect(zoneOf(s, "player2", "TST-P:ep0")).toBe("hand");
    expect(canStrike(s, "RS-593:v")).toBe(false);
  });

  it("RS-593: 【バルカッター】相手が戻さなければ SP1 でストライクできる（出典: atwiki/page-1202「戻してもよい。そうしたとき」）", () => {
    let s = enter(ncBoard(powerCards(2, "ep")), "RS-593:v");
    if (s.pendingEffectChoice?.playerId === "player2") s = skip(s);
    s = resolveAll(s);
    expect(spOf(s, "player1", "RS-593:v")).toBe(1);
    expect(canStrike(s, "RS-593:v")).toBe(true);
  });

  it("RS-593: 【バルカッター】相手のパワーゾーンにオモテ向きのカードがなければ（ダメージだけ）戻せず、SP1 でストライクできる（出典: atwiki/page-1202「オモテ向きのカード」）", () => {
    const s = resolveAll(enter(ncBoard([{ ...inst("TST-P", "ed"), faceDown: true }]), "RS-593:v"));
    expect(zoneOf(s, "player2", "TST-P:ed")).toBe("power");
    expect(spOf(s, "player1", "RS-593:v")).toBe(1);
    expect(canStrike(s, "RS-593:v")).toBe(true);
  });

  it("RS-593: 【バルカッター】NC が成立すると SP1（出典: atwiki/page-1202「【バルカッター】「SP1」」）", () => {
    const s = resolveAll(enter(ncBoard([]), "RS-593:v"));
    expect(spOf(s, "player1", "RS-593:v")).toBe(1);
  });

  it("RS-593: 【バルカッター】NC が成立しない（3番目）と SP0 のまま（出典: R-CN-02）", () => {
    const s = resolveAll(enter(ncBoard(powerCards(2, "ep"), 3), "RS-593:v"));
    expect(spOf(s, "player1", "RS-593:v")).toBe(0);
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-594 ガンパード", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【ガンパードガン】相手の手札を見ないで3枚まで選んでもよい。そうしたとき、選んだカードをお互いで見る。選んだカードの中からSユニットのカードを1枚選び、持ち主のパワーゾーンに置く。次の相手ターン、相手はターンを終えるとき、自分自身のパワーゾーンからオモテ向きのカードを1枚選び、手札に戻してもよい。";

  it("RS-594: カタログ本文・スペックが出典と一致（出典: atwiki/page-1203）", () => {
    expectCatalogText("RS-594", TEXT);
    expectStats("RS-594", {
      name: "ガンパード",
      category: "OT",
      size: "M",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 5,
      features: ["車両", "炎神"],
    });
  });

  vehicleNoteTests("RS-594", "atwiki/page-1203", { mustEnter: true });

  const ncBoard = (nth = 5) =>
    st({
      player1: { battle: fill(nth - 1), rush: [inst("RS-594", "gp")], deck: deckCards(5) },
      player2: { hand: [inst("TST-UNIT-0", "es"), inst("TST-OP", "eo"), inst("TST-UNIT-2", "em"), inst("TST-OP", "eo2")], deck: deckCards(5, "e") },
    });

  it("RS-594: 【ガンパードガン】NC（5番目）— 相手の手札を3枚まで選び、その中の S ユニットのカードを持ち主（相手）のパワーゾーンに置く（出典: atwiki/page-1203）", () => {
    let s = enterSeq(ncBoard(), ["RS-594:gp"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-594");
    s = resolveAll(s, ["TST-UNIT-0:es", "TST-OP:eo", "TST-UNIT-2:em"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("power");
    expect(zoneOf(s, "player2", "TST-UNIT-2:em")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:eo")).toBe("hand");
  });

  // ユーザー決定（2026-10-19）— 見ないで選ぶ3枚は「相手に選ばれない」で外さないが、お互いに見た後で S ユニットのカードを選ぶときは外す（docs/rules/README.md §5.7 j）。
  it("RS-594: 【ガンパードガン】見ないで選ぶ手札には「相手に選ばれない」カード（RK-054）も選べるが、お互いに見た後の S ユニットの選択では選べない（出典: ユーザー決定 2026-10-19「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」・atwiki/page-1203「選んだカードをお互いで見る。選んだカードの中からSユニットのカードを1枚選び」）", () => {
    const b = ncBoard();
    const s0 = { ...b, players: { ...b.players, player2: { ...b.players.player2, hand: [inst("RK-054", "rf"), inst("TST-UNIT-0", "es"), inst("TST-OP", "eo")] } } };
    let s = enterSeq(s0, ["RS-594:gp"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-594");
    expect(choiceIds(s)).toContain("RK-054:rf");
    s = pick(pick(pick(s, "RK-054:rf"), "TST-UNIT-0:es"), "TST-OP:eo");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-594");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es"]);
  });

  it("RS-594: 【ガンパードガン】お互いに見たカードの S ユニットが「相手に選ばれない」カードだけなら、パワーゾーンに置くカードはない（出典: ユーザー決定 2026-10-19）", () => {
    const b = ncBoard();
    const s0 = { ...b, players: { ...b.players, player2: { ...b.players.player2, hand: [inst("RK-054", "rf"), inst("TST-OP", "eo")] } } };
    const s = resolveAll(enterSeq(s0, ["RS-594:gp"]), ["RK-054:rf", "TST-OP:eo"]);
    expect(zoneOf(s, "player2", "RK-054:rf")).toBe("hand");
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-594: 【ガンパードガン】任意 — 選ばなければ相手の手札は変わらない（出典: atwiki/page-1203「選んでもよい」）", () => {
    let s = enterSeq(ncBoard(), ["RS-594:gp"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player2.hand).toHaveLength(4);
  });

  it("RS-594: 【ガンパードガン】NC が成立しない（4番目）と相手の手札は変わらない（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(ncBoard(4), ["RS-594:gp"]));
    expect(s.players.player2.hand).toHaveLength(4);
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-594: 【ガンパードガン】次の相手ターン、相手はターンを終えるときパワーゾーンのオモテ向きのカードを1枚手札に戻してもよい（出典: atwiki/page-1203）", () => {
    let s = resolveAll(enterSeq(ncBoard(), ["RS-594:gp"]), ["TST-UNIT-0:es", "TST-OP:eo", "TST-UNIT-2:em"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("power");
    s = toPhase(s, "player2", "end");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId !== "RS-594"; i += 1) {
      const end = legal(s).find((a) => a.type === "end_phase");
      if (!end) break;
      s = act(s, end);
    }
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-594");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canSkip(s)).toBe(true);
    s = pick(s, "TST-UNIT-0:es");
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("hand");
  });

  it("RS-594: 【ガンパードガン】後半は「次の相手ターン」だけ — 自分のターンを終えるときには戻す選択は開かない（出典: atwiki/page-1203「次の相手ターン」）", () => {
    let s = resolveAll(enterSeq(ncBoard(), ["RS-594:gp"]), ["TST-UNIT-0:es", "TST-OP:eo", "TST-UNIT-2:em"]);
    for (let i = 0; i < 6 && s.activePlayer === "player1"; i += 1) {
      expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-594");
      const next = legal(s).find((a) => a.type === "end_phase" || a.type === "pass_battle_entry");
      if (!next) break;
      s = act(s, next);
    }
    expect(s.activePlayer).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-594");
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("power");
  });
});

// ===========================================================================
describe("RS-595 キャリゲーター", () => {
  const TEXT =
    "※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【頼もしい背中】これが自軍エリアにある間、特徴「炎神」を持つ自軍ユニットは｢これは毎ターン、可能ならバトルエリアに出る｣と書かれていても、そのテキストは無効になる。";

  it("RS-595: カタログ本文・スペックが出典と一致（出典: atwiki/page-1204）", () => {
    expectCatalogText("RS-595", TEXT);
    expectStats("RS-595", {
      name: "キャリゲーター",
      category: "OT",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      features: ["車両", "炎神"],
    });
  });

  vehicleNoteTests("RS-595", "atwiki/page-1204", { mustEnter: false });

  it("RS-595: キャリゲーター自身には「可能ならバトルエリアに出る」がなく、出さずにバトルフェイズを終えられる（出典: atwiki/page-1204）", () => {
    const s = st({ player1: { rush: [inst("RS-595", "c")], deck: deckCards(3) } });
    expect(canEndPhase(s)).toBe(true);
  });

  it("RS-595: 【頼もしい背中】自軍エリアにある間、炎神（バルカ）の「可能ならバトルエリアに出る」は無効で、出さずにバトルフェイズを終えられる（出典: atwiki/page-1204）", () => {
    const s = st({ player1: { rush: [inst("RS-593", "v"), inst("RS-595", "c")], deck: deckCards(3) } });
    expect(canEndPhase(s)).toBe(true);
  });

  it("RS-595: 【頼もしい背中】キャリゲーターがバトルエリアにあっても有効（出典: atwiki/page-1204「これが自軍エリアにある間」）", () => {
    const s = st({ player1: { battle: [inst("RS-595", "c")], rush: [inst("RS-597", "t")], deck: deckCards(3) } });
    expect(canEndPhase(s)).toBe(true);
  });

  it("RS-595: 【頼もしい背中】キャリゲーターが捨札にあるときは無効にならない（出典: atwiki/page-1204「これが自軍エリアにある間」）", () => {
    const s = st({ player1: { rush: [inst("RS-593", "v")], discard: [inst("RS-595", "c")], deck: deckCards(3) } });
    expect(canEndPhase(s)).toBe(false);
  });

  it("RS-595: 【頼もしい背中】敵軍の炎神には効かない — 相手のバルカは相手のターンに出なければならない（出典: atwiki/page-1204「特徴「炎神」を持つ自軍ユニット」）", () => {
    const s = st({ activePlayer: "player2", player1: { rush: [inst("RS-595", "c")], deck: deckCards(3) }, player2: { rush: [inst("RS-593", "ev")], deck: deckCards(3, "e") } });
    expect(canEndPhase(s, "player2")).toBe(false);
  });
});

// ===========================================================================
describe("RS-596 炎神大将軍", () => {
  const TEXT =
    "合体―レツタカ＋シシノシン＋ツキノワ 【炎神剣】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが特徴「炎神」を持つユニットカードなら、このターン、これは「SP2」になる。その後、オモテにしたカードは山札の下に戻す。";

  it("RS-596: カタログ本文・スペックが出典と一致（出典: atwiki/page-1216）", () => {
    expectCatalogText("RS-596", TEXT);
    expectStats("RS-596", {
      name: "炎神大将軍",
      category: "OT",
      size: "L",
      bp: 13000,
      sp: 1,
      powerCost: "7+",
      features: ["人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-596: 追加条件 — レツタカ＋シシノシン＋ツキノワを捨札にしてラッシュできる（出典: atwiki/page-1216「合体―」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-596", "d")], rush: [inst("RS-597", "a"), inst("RS-598", "b"), inst("RS-599", "c")], command: releasedCat("OT", 1), power: powerCards(7), deck: deckCards(3) },
    });
    const r = rushFromHand(s, "player1", "RS-596:d");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-596:d")).toBe("rush");
    for (const id of ["RS-597:a", "RS-598:b", "RS-599:c"]) expect(zoneOf(r.state, "player1", id)).toBe("discard");
  });

  it("RS-596: 追加条件 — ツキノワがいなければラッシュできない（出典: atwiki/page-1216「合体―」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-596", "d")], rush: [inst("RS-597", "a"), inst("RS-598", "b")], command: releasedCat("OT", 1), power: powerCards(7), deck: deckCards(3) },
    });
    expect(canStartRush(s, "player1", "RS-596:d")).toBe(false);
  });

  const board = (deck: ReturnType<typeof inst>[]) => st({ player1: { rush: [inst("RS-596", "d")], deck } });

  it("RS-596: 【炎神剣】山札の上が特徴「炎神」のユニットカードなら、このターン SP2（出典: atwiki/page-1216）", () => {
    let s = enterSeq(board([inst("RS-597", "top"), inst("TST-OP", "b")]), ["RS-596:d"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-596");
    s = resolveAll(s, ["RS-597:top"]);
    expect(spOf(s, "player1", "RS-596:d")).toBe(2);
  });

  it("RS-596: 【炎神剣】オモテにしたカードは山札の下に戻す（出典: atwiki/page-1216「その後、オモテにしたカードは山札の下に戻す」）", () => {
    const s = resolveAll(enterSeq(board([inst("RS-597", "top"), inst("TST-OP", "b")]), ["RS-596:d"]), ["RS-597:top"]);
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["TST-OP:b", "RS-597:top"]);
  });

  it("RS-596: 【炎神剣】炎神でないカードなら SP1 のまま、そのカードも山札の下に戻す（出典: atwiki/page-1216「炎神」を持つユニットカードなら）", () => {
    const s = resolveAll(enterSeq(board([inst("TST-UNIT-0", "top"), inst("TST-OP", "b")]), ["RS-596:d"]), ["TST-UNIT-0:top"]);
    expect(spOf(s, "player1", "RS-596:d")).toBe(1);
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["TST-OP:b", "TST-UNIT-0:top"]);
  });

  it("RS-596: 【炎神剣】任意 — オモテにしなければ山札はそのまま（出典: atwiki/page-1216「オモテにしてもよい」）", () => {
    let s = enterSeq(board([inst("RS-597", "top"), inst("TST-OP", "b")]), ["RS-596:d"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-596");
    s = resolveAll(skip(s));
    expect(spOf(s, "player1", "RS-596:d")).toBe(1);
    expect(s.players.player1.deck[0]?.instanceId).toBe("RS-597:top");
  });

  it("RS-596: 【炎神剣】敵軍ターン中に効果でバトルエリアに出たときは発動せず、SP1 のまま（出典: atwiki/page-1216「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-596", "d")], deck: [inst("RS-597", "top"), inst("TST-OP", "b")] }, player2: { deck: deckCards(3, "e") } });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-596:d"));
    expect(spOf(s, "player1", "RS-596:d")).toBe(1);
    expect(s.players.player1.deck[0]?.instanceId).toBe("RS-597:top");
  });
});

// ===========================================================================
describe("RS-597 レツタカ", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【心の力】「SP1」";

  it("RS-597: カタログ本文・スペックが出典と一致（出典: atwiki/page-1205）", () => {
    expectCatalogText("RS-597", TEXT);
    expectStats("RS-597", {
      name: "レツタカ",
      category: "OT",
      size: "M",
      bp: 1000,
      sp: "special",
      powerCost: 1,
      comboNumber: 4,
      features: ["車両", "炎神", "侍"],
    });
  });

  vehicleNoteTests("RS-597", "atwiki/page-1205", { mustEnter: true });

  it("RS-597: 【心の力】NC（4番目）で SP1 になりストライクできる（出典: atwiki/page-1205）", () => {
    const s = enterSeq(st({ player1: { battle: fill(3), rush: [inst("RS-597", "t")], deck: deckCards(3) } }), ["RS-597:t"]);
    expect(spOf(s, "player1", "RS-597:t")).toBe(1);
  });

  it("RS-597: 【心の力】NC が成立しない（3番目）と SP0（出典: R-CN-02）", () => {
    const s = enterSeq(st({ player1: { battle: fill(2), rush: [inst("RS-597", "t")], deck: deckCards(3) } }), ["RS-597:t"]);
    expect(spOf(s, "player1", "RS-597:t")).toBe(0);
  });
});

void [act, canEnter, NOSP];
export type _Unused = GameState;
