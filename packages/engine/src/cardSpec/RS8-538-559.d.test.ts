/**
 * カード別スペック: RS-557〜RS-559（第8弾「究極の八神」ビンボーガミ〜ガオゴッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-558 の Q1〜Q3）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）。
 *     RS-558 の Q4〜Q6 は atwiki/page-1186 の転載（Q6 は R-RES-08・06-effects-timing の無限ループ処理）。
 *  3. docs/rules/*.md の一般ルール（R-ADD-06、R-CN-02 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  bpOf,
  canEndPhase,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  heldUnit,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  releasedN,
  resolveAll,
  rushFromHand,
  rushVia,
  skip,
  st,
  sUnit,
  zoneOf,
} from "./RS8-538-559.helpers";
import type { CardInstance, GameState } from "../types/game";

const CN = (n: number, size: "S" | "M" = "S") => sUnit(`SPEC-CN${n}${size}`, { comboNumber: n, size, bp: 1000 });
const BP8000 = sUnit("SPEC-8000", { bp: 8000 });
const BP8500 = sUnit("SPEC-8500", { bp: 8500 });
const GAO = (): CardInstance[] => ["RS-560", "RS-561", "RS-562", "RS-563", "RS-564"].map((id) => inst(id, "m"));

// ===========================================================================
describe("RS-557 ビンボーガミ", () => {
  const TEXT =
    "【札束の誘惑】これが自軍エリアにある間、自分も相手も次の制限を受ける⇒相手の手札が1枚以上あれば、その枚数と同じＣＮの数字を持つ自分自身のSユニットは、毎ターン、可能ならバトルエリアに出る。";
  const EXTRA = [CN(1), CN(2), CN(2, "M")];
  /** player1 のバトルフェイズ。p1Rush に出せるユニット、player2 の手札 n 枚。 */
  const board = (p1Rush: CardInstance[], oppHand: number, binbo: "rush" | "discard" | "enemy" = "rush") =>
    st(
      {
        player1: {
          rush: [...p1Rush, ...(binbo === "rush" ? [inst("RS-557", "bb")] : [])],
          discard: binbo === "discard" ? [inst("RS-557", "bb")] : [],
          deck: deckCards(3),
        },
        player2: { hand: deckCards(oppHand, "eh"), rush: binbo === "enemy" ? [inst("RS-557", "bb")] : [], deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("RS-557: カタログ本文・スペックが出典と一致（出典: atwiki/page-1179）", () => {
    expectCatalogText("RS-557", TEXT);
    expectStats("RS-557", {
      name: "ビンボーガミ",
      category: "DA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 1,
      features: ["怪人", "男", "妖怪"],
    });
  });

  it("RS-557: 【札束の誘惑】相手の手札が2枚なら、CN2 の自軍 S ユニットは可能ならバトルエリアに出なければならない（出さずにフェイズを終えられない）（出典: atwiki/page-1179）", () => {
    const s = board([inst("SPEC-CN2S", "u")], 2);
    expect(canEndPhase(s)).toBe(false);
  });

  it("RS-557: 【札束の誘惑】出せば（CN2 を出した後は）フェイズを終えられる（出典: atwiki/page-1179「可能ならバトルエリアに出る」）", () => {
    const s = passEntry(enter(board([inst("SPEC-CN2S", "u")], 2), "SPEC-CN2S:u"));
    expect(canEndPhase(s)).toBe(true);
  });

  it("RS-557: 【札束の誘惑】相手の手札の枚数と CN が違えば（手札2枚・CN1）強制されない（出典: atwiki/page-1179「その枚数と同じＣＮの数字を持つ」）", () => {
    expect(canEndPhase(board([inst("SPEC-CN1S", "u")], 2))).toBe(true);
  });

  it("RS-557: 【札束の誘惑】相手の手札が0枚なら強制されない（出典: atwiki/page-1179「相手の手札が1枚以上あれば」）", () => {
    expect(canEndPhase(board([inst("SPEC-CN1S", "u")], 0))).toBe(true);
  });

  it("RS-557: 【札束の誘惑】M ユニットは CN が一致しても強制されない（出典: atwiki/page-1179「自分自身のSユニット」）", () => {
    expect(canEndPhase(board([inst("SPEC-CN2M", "u")], 2))).toBe(true);
  });

  it("RS-557: 【札束の誘惑】ビンボーガミが場になければ（捨札）強制されない（出典: atwiki/page-1179「これが自軍エリアにある間」）", () => {
    expect(canEndPhase(board([inst("SPEC-CN2S", "u")], 2, "discard"))).toBe(true);
  });

  it("RS-557: 【札束の誘惑】「自分も相手も」— 敵軍のビンボーガミでも、自軍の CN2 S ユニットは（敵軍手札2枚なら）出なければならない（出典: atwiki/page-1179「自分も相手も次の制限を受ける」）", () => {
    expect(canEndPhase(board([inst("SPEC-CN2S", "u")], 2, "enemy"))).toBe(false);
  });
});

// ===========================================================================
describe("RS-558 ガンマジン", () => {
  const TEXT =
    "※自分か相手のLユニットがあれば、これはLユニットになり、BP+4000される。 【鍵の持ち主の願い】これが自軍エリアにある間、自分も相手も次のようにする⇒必要パワーに「＋」を持つユニットカードの追加条件を実行して満たしたとき、そのカードの持ち主は1枚ドローしてもよい。";
  const gaoRush = (where: "own" | "enemy" | "none", extraRush: CardInstance[] = []): GameState =>
    st({
      phase: "rush",
      player1: {
        hand: [inst("RS-559", "u")],
        rush: [...GAO(), ...extraRush, ...(where === "own" ? [inst("RS-558", "gm")] : [])],
        command: releasedN(2),
        power: powerCards(8),
        deck: deckCards(5),
      },
      player2: { rush: where === "enemy" ? [inst("RS-558", "gm")] : [], deck: deckCards(3, "e") },
    });

  it("RS-558: カタログ本文・スペックが出典と一致（出典: atwiki/page-1186）", () => {
    expectCatalogText("RS-558", TEXT);
    expectStats("RS-558", {
      name: "ガンマジン",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      features: ["人型"],
    });
  });

  it("RS-558: ※ 敵軍に L ユニットがあれば BP+4000（6000）（出典: atwiki/page-1186「自分か相手のLユニットがあれば…BP+4000される」）", () => {
    const s = st({ player1: { battle: [inst("RS-558", "gm")] }, player2: { battle: [inst("TST-UNIT-7", "l")] } });
    expect(bpOf(s, "player1", "RS-558:gm")).toBe(6000);
  });

  it("RS-558: ※ 自軍ラッシュエリアの L ユニットでも BP+4000（出典: atwiki/page-1186「自分か相手のLユニット」）", () => {
    const s = st({ player1: { battle: [inst("RS-558", "gm")], rush: [inst("TST-UNIT-7", "l")] } });
    expect(bpOf(s, "player1", "RS-558:gm")).toBe(6000);
  });

  it("RS-558: ※ L ユニットがなければ（M・S だけ）BP2000 のまま（出典: atwiki/page-1186）", () => {
    const s = st({ player1: { battle: [inst("RS-558", "gm"), inst("TST-UNIT-2", "m")] }, player2: { battle: [inst("TST-UNIT-0", "s")] } });
    expect(bpOf(s, "player1", "RS-558:gm")).toBe(2000);
  });

  it("RS-558: ※ L ユニットのカードが捨札にあるだけでは BP+4000 されない（出典: atwiki/page-1186「Lユニットがあれば」— ユニットは場のカード）", () => {
    const s = st({ player1: { battle: [inst("RS-558", "gm")], discard: [inst("TST-UNIT-7", "l")] } });
    expect(bpOf(s, "player1", "RS-558:gm")).toBe(2000);
  });

  it("RS-558: ※ L ユニットがあれば L ユニットになる — ホールド状態でも【地割れ】（ホールド状態の S ユニット）の候補にならない（出典: atwiki/page-1186「これはLユニットになり」）", () => {
    const s = st({
      player1: { battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("TST-UNIT-0", "f3"), inst("TST-UNIT-0", "f4")], rush: [inst("RS-555", "ku")], deck: deckCards(3) },
      player2: { battle: [heldUnit("RS-558", "gm"), heldUnit("TST-UNIT-0", "hs"), inst("TST-UNIT-7", "l")], deck: deckCards(3, "e") },
    });
    const t = enter(passEntry(s), "RS-555:ku");
    expect(t.pendingEffectChoice?.sourceCardId).toBe("RS-555");
    expect(choiceIds(t)).not.toContain("RS-558:gm");
  });

  it("RS-558: 【鍵の持ち主の願い】自軍の「＋」ユニット（ガオゴッド 6+）を合体ユニットを捨札にしてラッシュすると、1枚ドローできる（出典: atwiki/page-1186）", () => {
    const r = rushFromHand(gaoRush("own"), "player1", "RS-559:u");
    expect(r.ok).toBe(true);
    const handBefore = r.state.players.player1.hand.length;
    const s = resolveAll(r.state);
    expect(s.players.player1.hand.length).toBe(handBefore + 1);
  });

  it("RS-558: 【鍵の持ち主の願い】ドローは任意（見送れる）（出典: atwiki/page-1186「1枚ドローしてもよい」）", () => {
    const r = rushFromHand(gaoRush("own"), "player1", "RS-559:u");
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-558");
    expect(canSkip(r.state)).toBe(true);
  });

  it("RS-558: 【鍵の持ち主の願い】「自分も相手も」— 敵軍のガンマジンでも、ラッシュしたカードの持ち主（自分）がドローできる（出典: atwiki/page-1186「そのカードの持ち主は1枚ドローしてもよい」）", () => {
    const r = rushFromHand(gaoRush("enemy"), "player1", "RS-559:u");
    const before = r.state.players.player1.hand.length;
    const s = resolveAll(r.state);
    expect(s.players.player1.hand.length).toBe(before + 1);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RS-558: 【鍵の持ち主の願い】ガンマジンが場になければドローしない（出典: atwiki/page-1186「これが自軍エリアにある間」）", () => {
    const r = rushFromHand(gaoRush("none"), "player1", "RS-559:u");
    const before = r.state.players.player1.hand.length;
    expect(resolveAll(r.state).players.player1.hand.length).toBe(before);
  });

  it("RS-558: 【鍵の持ち主の願い】必要パワーが「－」のユニット（ゴッドガンマー 7-）の追加条件を実行してもドローしない（出典: atwiki/page-1186「必要パワーに「＋」を持つユニットカード」）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-551", "g")], rush: [inst("RS-455", "nb"), inst("RS-558", "gm")], command: releasedCat("MA", 1), power: [], deck: deckCards(3) },
    });
    const r = rushVia(s0, "player1", "RS-551:g", (a) => a.zordMaterialInstanceId === "RS-455:nb");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-551:g")).toBe("rush");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-558: 公式Q&A — 「大神龍」（追加条件が「ユニットが7体以上ある」）をラッシュしてもドローできない（出典: grnrngr/faq-card-8 RS-558 Q3「場の状況だけを参照して…ドローすることはできません」）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("SR-007", "dsr")],
        rush: [inst("RS-558", "gm"), ...Array.from({ length: 6 }, (_, i) => inst("TST-UNIT-0", `u${i}`))],
        command: releasedCat("MA", 2),
        power: powerCards(5),
        deck: deckCards(3),
      },
    });
    const r = rushFromHand(s0, "player1", "SR-007:dsr");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "SR-007:dsr")).toBe("rush");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.todo(
    "RS-558: 公式Q&A — ジャガーバルカンの効果（S ユニットをコマンドゾーンに送るかわりに ET コマンドをホールド）で ET の M ユニットをラッシュしてもドローできない（出典: grnrngr/faq-card-8 RS-558 Q1）— 該当する ET の「＋」M ユニット（追加条件が S ユニットをコマンドゾーンに送るもの）とジャガーバルカンの代替手順を公開 API で組めない",
  );

  it("RS-558: 公式Q&A — デンジ犬アイシーの効果（山札のデンジファイターを捨札にしたことにする）で OT の L ユニット（ダイデンジン 7+）をラッシュしてもドローできない（出典: grnrngr/faq-card-8 RS-558 Q2「いいえ、できません」）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-352", "dd")],
        rush: [inst("RS-359", "ic"), inst("RS-558", "gm")],
        command: releasedCat("OT", 1),
        power: powerCards(7),
        deck: [inst("TST-OP", "o"), inst("RS-353", "f"), ...deckCards(3)],
      },
    });
    const r = rushFromHand(s0, "player1", "RS-352:dd", { materials: ["RS-353:f"] });
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-558");
    const s = resolveAll(r.state, ["RS-353:f"]);
    expect(zoneOf(s, "player1", "RS-352:dd")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-359:ic")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-558: 対照 — 同じダイデンジンを場のデンジファイターを捨札にして（追加条件を実行して）ラッシュすればドローできる（出典: atwiki/page-1186・grnrngr/faq-card-8 RS-558 Q2）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-352", "dd")],
        rush: [inst("RS-353", "ff"), inst("RS-558", "gm")],
        command: releasedCat("OT", 1),
        power: powerCards(7),
        deck: deckCards(3),
      },
    });
    const r = rushFromHand(s0, "player1", "RS-352:dd", { materials: ["RS-353:ff"] });
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-558");
    const s = resolveAll(r.state);
    expect(s.players.player1.hand).toHaveLength(1);
  });

  it("RS-558: atwiki Q&A — 山札にあるガンマジンは S ユニットのカードで、L ユニットがあってもバトルシャークで L ユニットのカードとして選べない（出典: atwiki/page-1186 Q4「山札にある間はあくまで「Sユニットのカード」」）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-439", "bs")],
        battle: [inst("TST-UNIT-7", "l")],
        command: releasedCat("ET", 2),
        power: powerCards(5),
        deck: [inst("RS-558", "dg"), inst("TST-UNIT-0", "d1")],
      },
    });
    const r = rushFromHand(s0, "player1", "RS-439:bs");
    expect(r.ok).toBe(true);
    expect(choiceIds(r.state)).not.toContain("RS-558:dg");
  });

  it.todo(
    "RS-558: atwiki Q&A — ギャレンJF の追加条件をピーコックアンデッドを捨札にして満たしても、追加条件を実行したことにならずドローできない（出典: atwiki/page-1186 Q5）— ピーコックアンデッドの「「仮面ライダーギャレン」1体を捨札にしたことにできる」置換がギャレンJF の追加条件の手続きに接続されておらず、公開 API で組めない",
  );

  it.todo(
    "RS-558: atwiki Q&A — ガンマジンと仮面ライダーアークの L ユニット化が循環する場合は、ターンプレイヤーが優先順を選んでループを止める（出典: atwiki/page-1186 Q6・R-RES-08）— 仮面ライダーアークの「これ以外が S ユニットだけなら L」との循環で、ターンプレイヤーがループを止める選択が公開 API にない（ガンマジンは条件つきで L になったユニットを数えない）",
  );
});

// ===========================================================================
describe("RS-559 ガオゴッド", () => {
  const TEXT =
    "合体―ガオレオン＋ガオコンドル＋ガオソーシャーク＋ガオバッファロー＋ガオジャガー 【パワーアロー】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動出来る⇒BP8000以下の敵軍ユニットを1体選び撃破する。（この効果は、自軍ラッシュフェイズ中、自軍パワーが8以上あれば、自分の手札からこのカードを捨札にして発動できる）";
  const board = (activePlayer: "player1" | "player2" = "player1") =>
    st(
      {
        activePlayer,
        player1: { rush: [inst("RS-559", "u")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-8000", "a"), inst("SPEC-8500", "b")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") },
      },
      [BP8000, BP8500],
    );
  const handBoard = (power: number, phase: "rush" | "battle" = "rush") =>
    st(
      {
        phase,
        player1: { hand: [inst("RS-559", "h")], power: powerCards(power), command: releasedN(2), deck: deckCards(3) },
        player2: { battle: [inst("SPEC-8000", "a")], deck: deckCards(3, "e") },
      },
      [BP8000],
    );
  const handUse = (s: GameState) =>
    legal(s).some((a) => JSON.stringify(a).includes("RS-559:h") && a.type !== "initiate_command_payment");

  it("RS-559: カタログ本文・スペックが出典と一致（出典: atwiki/page-1227）", () => {
    expectCatalogText("RS-559", TEXT);
    expectStats("RS-559", {
      name: "ガオゴッド",
      category: "WB",
      size: "L",
      bp: 14000,
      sp: 1,
      powerCost: "6+",
      features: ["獣", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-559: 追加条件 — ガオレオン〜ガオジャガーの5体を捨札にしてラッシュでき、4体・パワー5では満たせない（出典: atwiki/page-1227・R-ADD-06）", () => {
    const mk = (rush: CardInstance[], power = 6) =>
      st({ phase: "rush", player1: { hand: [inst("RS-559", "u")], rush, command: releasedN(2), power: powerCards(power), deck: deckCards(3) } });
    expect(canStartRush(mk(GAO().slice(0, 4)), "player1", "RS-559:u")).toBe(false);
    expect(canStartRush(mk(GAO(), 5), "player1", "RS-559:u")).toBe(false);
    const r = rushFromHand(mk(GAO()), "player1", "RS-559:u");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-559:u")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("RS-559: 【パワーアロー】自軍ターン中に出たとき、BP8000以下の敵軍ユニット（バトル・ラッシュ）が候補で、8500 は選べない（出典: atwiki/page-1227「BP8000以下の敵軍ユニット」）", () => {
    const s = enter(board(), "RS-559:u");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-559");
    expect(choiceIds(s)).toEqual(["SPEC-8000:a", "TST-UNIT-0:r"]);
  });

  it("RS-559: 【パワーアロー】BP8500 の敵軍ユニットは候補にならない（境界 8000 は候補）（出典: atwiki/page-1227「BP8000以下」）", () => {
    const s = enter(board(), "RS-559:u");
    expect(choiceIds(s)).toContain("SPEC-8000:a");
    expect(choiceIds(s)).not.toContain("SPEC-8500:b");
  });

  it("RS-559: 【パワーアロー】選んだユニットを撃破する（出典: atwiki/page-1227「1体選び撃破する」）", () => {
    const s = resolveAll(pick(enter(board(), "RS-559:u"), "TST-UNIT-0:r"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("discard");
  });

  it("RS-559: 【パワーアロー】任意 — 発動しないことを選べる（出典: atwiki/page-1227「次の効果を発動出来る」）", () => {
    const s0 = enter(board(), "RS-559:u");
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("rush");
  });

  it("RS-559: 【パワーアロー】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1227「自軍ターン中」）", () => {
    const s = resolveAll(enterBattleByEffect(board("player2"), "player1", "RS-559:u"));
    expect(zoneOf(s, "player2", "SPEC-8000:a")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("rush");
  });

  it("RS-559: 【パワーアロー】自軍ラッシュフェイズ中、自軍パワー8以上なら手札のガオゴッドを捨札にして発動できる（出典: atwiki/page-1227「自分の手札からこのカードを捨札にして発動できる」）", () => {
    expect(handUse(handBoard(8))).toBe(true);
  });

  it("RS-559: 【パワーアロー】手札からの発動は、自軍パワー7ではできない（出典: atwiki/page-1227「自軍パワーが8以上あれば」）", () => {
    expect(handUse(handBoard(7))).toBe(false);
  });

  it("RS-559: 【パワーアロー】手札からの発動は、ラッシュフェイズ以外（バトルフェイズ）ではできない（出典: atwiki/page-1227「自軍ラッシュフェイズ中」）", () => {
    expect(handUse(handBoard(8, "battle"))).toBe(false);
  });
});
