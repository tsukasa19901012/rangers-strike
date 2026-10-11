/**
 * カード別スペック: RS-439〜RS-445（第7弾「七忍の炎陣」バトルシャーク〜ミスアメリカ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7（RS-440 Q・RS-441 Q）、
 *     grnrngr/faq-card-1・faq-card-8（RS-441 とマジレッド／マジフェニックスの Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *     と、他カードのページに載る Q&A（page-353 RS-171）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAKUS-01 タクス、R-CN-02〜R-CN-06 NC、R-ADD-02 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enter,
  enterAt,
  enterSeq,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  nextPhase,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  skip,
  spOf,
  sUnit,
  st,
  zoneOf,
} from "./RS7-432-452.helpers";
import type { CardInstance, GameState } from "../types/game";

type P = Partial<GameState["players"]["player1"]>;

/** ET の S ユニット（SP なし）。 */
const ET_NOSP = sUnit("SPEC-ETN", { name: "ET S（SPなし）", category: "ET", sp: undefined });
/** WB の S ユニット（SP なし）。 */
const WB_NOSP = sUnit("SPEC-WBN", { name: "WB S（SPなし）", category: "WB", sp: undefined });
/** ET の M ユニット（SP なし）。 */
const ET_M = sUnit("SPEC-ETMN", { name: "ET M（SPなし）", category: "ET", sp: undefined, size: "M" });
/** 特徴「女」の S ユニット（SP なし）。 */
const GIRL = sUnit("SPEC-GIRL", { name: "女S", features: ["女"], category: "ET", sp: undefined });
/** 特徴「女」の M ユニット。 */
const GIRL_M = sUnit("SPEC-GIRLM", { name: "女M", features: ["女"], size: "M", sp: undefined });
/** 特徴「女」の S ユニット（BP13000・SP1、アタック役）。 */
const GIRL_ATK = sUnit("SPEC-GIRLA", { name: "女アタッカー", features: ["女"], bp: 13000 });
/** 特徴「獣」の S ユニット。 */
const BEAST = sUnit("SPEC-BEAST", { name: "獣S", features: ["獣"] });
const SPECS = [ET_NOSP, WB_NOSP, ET_M, GIRL, GIRL_M, GIRL_ATK, BEAST];

function stx(o: Parameters<typeof st>[0] = {}) {
  return st(o, SPECS);
}
function at(id: string, pos: number, p1: P = {}, p2: P = {}, before: CardInstance[] = fillers(pos - 1)) {
  return enterAt(id, pos, p1, p2, before, SPECS);
}

// ===========================================================================
describe("RS-439 バトルシャーク", () => {
  const TEXT =
    "【万能戦艦】これをラッシュしたとき、次の効果を発動できる⇒自軍山札から、Lユニットのカードを1枚か、ナンバーに「L」または「R」を持つユニットカードを2枚まで選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。";

  it("RS-439: カタログ本文・スペックが出典と一致（XL・SP－）（出典: atwiki/page-781）", () => {
    expectCatalogText("RS-439", TEXT);
    expectStats("RS-439", { name: "バトルシャーク", category: "ET", size: "XL", bp: 5000, sp: undefined, powerCost: 5, features: ["メカ", "母艦"] });
  });

  const rushShark = (deck: CardInstance[], p1: P = {}) => {
    const s = stx({
      phase: "rush",
      player1: { hand: [inst("RS-439", "bs")], command: releasedCat("ET", 1), power: powerCards(5), deck, ...p1 },
      player2: { deck: deckCards(5, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-439:bs");
    expect(r.ok).toBe(true);
    return r.state;
  };
  const deck = () => [
    inst("TST-UNIT-0", "s"),
    inst("TST-UNIT-7", "l"),
    inst("RS-171", "ln"),
    inst("RS-172", "rn"),
    inst("RS-173", "rn2"),
    inst("TST-OP", "op"),
    inst("TST-UNIT-2", "m"),
  ];

  it("RS-439: 【万能戦艦】ラッシュしたとき、選べるのは山札の L ユニットのカードか、ナンバーに L／R を持つユニットカードだけ（出典: atwiki/page-781）", () => {
    const s = rushShark(deck());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-439");
    expect(choiceIds(s)).toEqual(["RS-171:ln", "RS-172:rn", "RS-173:rn2", "TST-UNIT-7:l"]);
  });

  it("RS-439: 【万能戦艦】ナンバーに L／R を持つユニットカードなら2枚まで手札に加えられる（出典: atwiki/page-781「2枚まで選び」）", () => {
    let s = rushShark(deck());
    s = pick(s, "RS-171:ln");
    if (s.pendingEffectChoice?.sourceCardId === "RS-439") s = pick(s, "RS-172:rn");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RS-171:ln")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-172:rn")).toBe("hand");
  });

  it("RS-439: 【万能戦艦】L ユニットのカードを選んだら、それ1枚だけ手札に加わる（出典: atwiki/page-781「Lユニットのカードを1枚か」）", () => {
    let s = rushShark(deck());
    s = pick(s, "TST-UNIT-7:l");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-439");
    s = resolveAll(s, ["__none__"]);
    expect(zoneOf(s, "player1", "TST-UNIT-7:l")).toBe("hand");
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.deck).toHaveLength(6);
  });

  it("RS-439: 【万能戦艦】「発動できる／加えてもよい」— 見送ることができ、山札の枚数は変わらない（出典: atwiki/page-781）", () => {
    const s = rushShark(deck());
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player1.deck).toHaveLength(7);
    expect(t.players.player1.hand).toHaveLength(0);
  });

  it("RS-439: 【万能戦艦】ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-781「これをラッシュしたとき」）", () => {
    const s = enter(stx({ player1: { rush: [inst("RS-439", "bs")], deck: deck() }, player2: { deck: deckCards(5, "e") } }), "RS-439:bs");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-439");
  });

  it("RS-439: 山札のガンマジンは（L ユニットが場にあっても）S ユニットのカードなので選べない（出典: atwiki/page-781 Q1「いいえ、それはできません。山札にある間はあくまで「Sユニットのカード」であり」）", () => {
    const s = rushShark([inst("RS-558", "gm"), inst("TST-UNIT-7", "l")], { battle: [inst("TST-UNIT-7", "fieldL")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-439");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:l"]);
  });
});

// ===========================================================================
describe("RS-440 バトルフィーバーロボ（2nd）", () => {
  const TEXT =
    "※このカードの追加条件は、自軍捨札が7枚以上のとき、次のように変更される⇒特徴「母艦」を持つ自軍ユニットを1体捨札にする。 ※これはナンバーに「L」または「R」を持つ自軍ユニット1体につきBP+1000される。 【武器換装】これが自軍バトルエリアにある間、自軍バトルフェイズ中、自軍コマンドを3つホールドしてもよい。そうしたとき、これをラッシュエリアに戻す。";

  it("RS-440: カタログ本文・スペックが出典と一致（L・SP1・必要パワー6+・追加条件「自軍Sユニットを5体捨札にする」）（出典: atwiki/page-780）", () => {
    expectCatalogText("RS-440", TEXT);
    expectStats("RS-440", {
      name: "バトルフィーバーロボ（2nd）",
      category: "ET",
      size: "L",
      bp: 6000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ", "人型", "2nd"],
      rushCondition: "send_s_unit_to_discard",
    });
    expect(stx().definitions["RS-440"]!.rushAdditionalCondition?.unitCount).toBe(5);
  });

  const rushState = (discardN: number, rush: CardInstance[]) =>
    stx({
      phase: "rush",
      player1: {
        hand: [inst("RS-440", "bf")],
        rush,
        discard: Array.from({ length: discardN }, (_, i) => inst("TST-OP", `d${i}`)),
        command: releasedCat("ET", 1),
        power: powerCards(6),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });

  it("RS-440: 追加条件 — 自軍捨札が6枚以下なら、自軍 S ユニット5体を捨札にしてラッシュできる（出典: atwiki/page-780「追加条件：自軍Sユニットを5体捨札にする」）", () => {
    const r = rushFromHand(rushState(6, fillers(5)), "player1", "RS-440:bf");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-440:bf")).toBe("rush");
    expect(t.players.player1.discard).toHaveLength(11);
  });

  it("RS-440: 追加条件 — 自軍 S ユニットが4体ではラッシュできない（出典: atwiki/page-780・R-ADD-02）", () => {
    expect(canStartRush(rushState(6, fillers(4)), "player1", "RS-440:bf")).toBe(false);
  });

  it("RS-440: 自軍捨札が6枚なら、特徴「母艦」の自軍ユニット1体を捨札にする方法ではラッシュできない（出典: atwiki/page-780「自軍捨札が7枚以上のとき」）", () => {
    expect(canStartRush(rushState(6, [inst("RS-439", "bs")]), "player1", "RS-440:bf")).toBe(false);
  });

  it("RS-440: 自軍捨札が7枚以上なら、追加条件は特徴「母艦」の自軍ユニット（バトルシャーク）1体を捨札にすることに変わる（出典: atwiki/page-780「次のように変更される⇒特徴「母艦」を持つ自軍ユニットを1体捨札にする」）", () => {
    const s = rushState(7, [inst("RS-439", "bs")]);
    expect(canStartRush(s, "player1", "RS-440:bf")).toBe(true);
    const r = rushVia(s, "player1", "RS-440:bf");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-440:bf")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-439:bs")).toBe("discard");
  });

  it("RS-440: 自軍捨札が7枚以上のときは追加条件が変更されるので、母艦がいなければ S ユニット5体を捨札にしてもラッシュできない（出典: atwiki/page-780「次のように変更される」）", () => {
    expect(canStartRush(rushState(7, fillers(5)), "player1", "RS-440:bf")).toBe(false);
  });

  it("RS-440: ※ナンバーに L／R を持つ自軍ユニット1体につき BP+1000（バトルエリアの L・ラッシュエリアの R で +2000、敵軍の L／R は数えない）（出典: atwiki/page-780）", () => {
    const s = stx({
      player1: { battle: [inst("RS-440", "bf"), inst("RS-171", "l")], rush: [inst("RS-172", "r")], deck: deckCards(3) },
      player2: { battle: [inst("RS-173", "er")], deck: deckCards(3, "e") },
    });
    expect(bpOf(s, "player1", "RS-440:bf")).toBe(8000);
  });

  it("RS-440: ※L／R ナンバーの自軍ユニットがいなければ BP6000 のまま（出典: atwiki/page-780）", () => {
    const s = stx({ player1: { battle: [inst("RS-440", "bf"), inst("TST-UNIT-0", "f")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", "RS-440:bf")).toBe(6000);
  });

  /** 【武器換装】の合法手（RS-440 を指すもの）。 */
  const weaponActions = (s: GameState) =>
    legal(s).filter(
      (a) =>
        a.playerId === "player1" &&
        !["battle", "strike", "move_to_battle"].includes(a.type) &&
        Object.values(a as Record<string, unknown>).includes("RS-440:bf"),
    );
  const weaponState = (cmds: number, activePlayer: "player1" | "player2" = "player1") =>
    stx({
      activePlayer,
      player1: { battle: [{ ...inst("RS-440", "bf"), battleActed: true }], command: releasedCat("ET", cmds), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });

  it("RS-440: 【武器換装】自軍バトルフェイズ中、自軍コマンドを3つホールドして、これをラッシュエリアに戻せる（出典: atwiki/page-780）", () => {
    let s = weaponState(3);
    const a = weaponActions(s);
    expect(a.length).toBeGreaterThan(0);
    s = resolveAll(act(s, a[0]!));
    expect(zoneOf(s, "player1", "RS-440:bf")).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(3);
  });

  it("RS-440: 【武器換装】リリース状態の自軍コマンドが2つしかなければ使えない（出典: atwiki/page-780「自軍コマンドを3つホールドしてもよい」）", () => {
    expect(weaponActions(weaponState(2))).toHaveLength(0);
  });

  it("RS-440: 【武器換装】敵軍ターン中は使えない（出典: atwiki/page-780「自軍バトルフェイズ中」）", () => {
    expect(weaponActions(weaponState(3, "player2"))).toHaveLength(0);
  });

  it("RS-440: 【武器換装】で戻した後、ダッシュレオン【超文明の守護】でコマンドがリリースされれば、再び出して【武器換装】を使える（出典: grnrngr/faq-card-7 RS-440 Q「はい、できます」）", () => {
    let s = stx({
      player1: { battle: [inst("TST-UNIT-0", "f")], rush: [inst("RS-440", "bf"), inst("RS-145", "dl")], command: releasedCat("ET", 3), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    s = enterSeq(s, ["RS-440:bf"]);
    s = resolveAll(act(s, weaponActions(s)[0]!));
    expect(zoneOf(s, "player1", "RS-440:bf")).toBe("rush");
    s = resolveAll(enterSeq(s, ["RS-145:dl"]));
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(0);
    s = enterSeq(s, ["RS-440:bf"]);
    expect(weaponActions(s).length).toBeGreaterThan(0);
  });

  it.todo(
    "RS-440: 【武器換装】で戻して再びゴーゴードリルとコンビネーションしたとき、BP20000 以上ならゴーゴードリルの「相手に1点ダメージ」は重複して2点になる（出典: atwiki/page-780 Q2・page-353 Q1「はい、できます」）— 【武器換装】が未実装で、かつ BP20000 以上（L/R ナンバー10体相当）の盤面を公開 API で組めないため",
  );
});

// ===========================================================================
describe("RS-441 バトルコサック", () => {
  const TEXT =
    "※タクスET（これがバトルエリアの4番目にある間、これの次に並ぶETを持つSユニットはSP1になる） 【コサックダンス】このターン、自軍ユニットがバトルエリアからラッシュエリアに戻るたび、そのユニットを自分の手札に戻してもよい。そうしたとき、自軍コマンドを1つホールドして、手札に戻したユニットカードと同じカード名のユニットカードを自分の手札から1枚選び、自軍ラッシュエリアに出してもよい。";

  it("RS-441: カタログ本文・スペックが出典と一致（S・SP なし・CN1）（出典: atwiki/page-782）", () => {
    expectCatalogText("RS-441", TEXT);
    expectStats("RS-441", { name: "バトルコサック", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: 1, features: ["イエロー", "男"] });
  });

  takusTests("RS-441", "page-782");

  /** RS-441 を1番目（NC）、フィラー3体、ミスアメリカを5番目（NC）に出し、ターンを終える。 */
  const disco = (cossackPos: 1 | 2, hand: CardInstance[] = []) => {
    const order = cossackPos === 1 ? ["RS-441:ck", "TST-UNIT-0:f0", "TST-UNIT-0:f1", "TST-UNIT-0:f2", "RS-445:ma"] : ["TST-UNIT-0:f0", "RS-441:ck", "TST-UNIT-0:f1", "TST-UNIT-0:f2", "RS-445:ma"];
    let s = stx({
      player1: { rush: [inst("RS-441", "ck"), ...fillers(3, "f"), inst("RS-445", "ma")], hand, command: releasedCat("ET", 2), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    s = enterSeq(s, order);
    for (let i = 0; i < 4 && !s.pendingEffectChoice && s.activePlayer === "player1"; i++) s = nextPhase(s);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-445");
    return pick(s, "return");
  };

  it("RS-441: 【コサックダンス】このターン、自軍ユニットがバトルエリアからラッシュエリアに戻ったとき、そのユニットを手札に戻せる（出典: atwiki/page-782）", () => {
    const s = disco(1);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-441");
    // 手札に戻す選択だけを解決する（続く「同じカード名のカードを出してもよい」は RS-441 の後半のテスト）。
    const t = pick(s, "RS-445:ma");
    expect(zoneOf(t, "player1", "RS-445:ma")).toBe("hand");
  });

  it("RS-441: 【コサックダンス】手札に戻したとき、自軍コマンドを1つホールドして同じカード名のユニットカードを手札から自軍ラッシュエリアに出せる（出典: atwiki/page-782）", () => {
    let s = disco(1, [inst("RS-445", "ma2"), inst("RS-442", "other")]);
    // 手札に戻す（ma）→ 同じカード名のユニットカードを手札から選ぶ（ma2）。
    s = pick(s, "RS-445:ma");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-441");
    expect(choiceIds(s)).toEqual(["RS-445:ma", "RS-445:ma2"]);
    s = resolveAll(pick(s, "RS-445:ma2"), ["__none__"]);
    expect(zoneOf(s, "player1", "RS-445:ma")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-445:ma2")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-442:other")).toBe("hand");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("RS-441: 【コサックダンス】手札に戻したユニットカードそのものを選んでラッシュエリアに出せる（出典: grnrngr/faq-card-7 RS-441 Q「はい、できます」）", () => {
    let s = disco(1);
    s = resolveAll(s, ["RS-445:ma"]);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
    expect(zoneOf(s, "player1", "RS-445:ma")).toBe("rush");
  });

  it("RS-441: 【コサックダンス】は「してもよい」— 手札に戻さなければユニットはラッシュエリアに残る（出典: atwiki/page-782「手札に戻してもよい」）", () => {
    let s = disco(1);
    if (s.pendingEffectChoice?.sourceCardId === "RS-441") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(zoneOf(s, "player1", "RS-445:ma")).toBe("rush");
  });

  it("RS-441: NC が成立していない（2番目）ときは【コサックダンス】は発動しない（出典: atwiki/page-782「CN：1」・R-CN-02）", () => {
    const s = disco(2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-441");
    expect(zoneOf(resolveAll(s, ["__none__"]), "player1", "RS-445:ma")).toBe("rush");
  });

  it.todo(
    "RS-441: 【コサックダンス】で手札に戻したマジレッドを「マジフェニックス」として扱い、RS-576 マジフェニックスをラッシュエリアに出せる（出典: grnrngr/faq-card-1・faq-card-8 RS-441 Q「はい、可能です」）— 自軍バトルフェイズ中にマジレッド（「女」「獣」なし）をバトルエリアからラッシュエリアへ戻す手段が、範囲内の実装済みの効果にないため（【武器換装】は自身のみで未実装）",
  );
  it.todo(
    "RS-441: 複数のユニットが同時にラッシュエリアに戻ったとき、一部だけ手札に戻せるか（出典: atwiki/page-782 Q2）— atwiki の回答文が「「重ねた枚数と同じ数」を上限として…撃破する」とアレ（RS-435）の内容になっており質問と対応しない（転記誤り）。公式 FAQ（faq-card-7）にこの Q はなく、期待値を決められないため",
  );
});

/** ※タクスET の共通テスト（R-KW-TAKUS-01）。 */
function takusTests(id: string, page: string) {
  const seq = (third: string, next: string, pos: 3 | 4 = 4) => {
    const before = pos === 4 ? ["TST-UNIT-0:f0", "TST-UNIT-0:f1", "TST-UNIT-0:f2"] : ["TST-UNIT-0:f0", "TST-UNIT-0:f1"];
    const s = stx({
      player1: { rush: [...fillers(3, "f"), inst(third, "tk"), inst(next, "nx")], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    // 3番目に出た RS-443 は NC（CN3）で【カンフーダンス】の任意の選択が開くので、見送ってから次を出す。
    let t = s;
    for (const id of [...before, `${third}:tk`, `${next}:nx`]) {
      t = enterSeq(t, [id]);
      while (t.pendingEffectChoice && canSkip(t)) t = skip(t);
    }
    return t;
  };

  it(`${id}: ※タクスET — バトルエリアの4番目にある間、次に並ぶ ET の S ユニットは SP1 になる（出典: atwiki/${page}・R-KW-TAKUS-01）`, () => {
    const s = seq(id, "SPEC-ETN");
    expect(spOf(s, "player1", "SPEC-ETN:nx")).toBe(1);
  });

  it(`${id}: ※タクスET — 次に並ぶのが ET でない S ユニットなら SP は付かない（出典: atwiki/${page}「ETを持つSユニット」）`, () => {
    const s = seq(id, "SPEC-WBN");
    expect(spOf(s, "player1", "SPEC-WBN:nx")).toBe(0);
  });

  it(`${id}: ※タクスET — 次に並ぶ ET の M ユニットには SP は付かない（出典: atwiki/${page}「Sユニット」・R-KW-TAKUS-01）`, () => {
    const s = seq(id, "SPEC-ETMN");
    expect(spOf(s, "player1", "SPEC-ETMN:nx")).toBe(0);
  });

  it(`${id}: ※タクスET — これが3番目なら、次に並ぶ ET の S ユニットに SP は付かない（出典: atwiki/${page}「バトルエリアの4番目にある間」）`, () => {
    const s = seq(id, "SPEC-ETN", 3);
    expect(spOf(s, "player1", "SPEC-ETN:nx")).toBe(0);
  });
}

// ===========================================================================
describe("RS-442 バトルフランス", () => {
  const TEXT =
    "※これは特徴「女」を持つユニットにアタックされない。 【スパニッシュダンス】このターン、これは、特徴「女」を持つユニット1体につきBP+1000される。また、これがBP5000以上のとき、これの次に並ぶ特徴「女」を持つ自軍SユニットはSP1になる。";

  it("RS-442: カタログ本文・スペックが出典と一致（S・SP なし・CN2）（出典: atwiki/page-751）", () => {
    expectCatalogText("RS-442", TEXT);
    expectStats("RS-442", { name: "バトルフランス", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: 2, features: ["ブルー", "男"] });
  });

  const enemyTurn = (attacker: string) =>
    stx({
      activePlayer: "player2",
      player1: { battle: [inst("RS-442", "fr"), inst("TST-UNIT-0", "other")], deck: deckCards(3) },
      player2: { battle: [inst(attacker, "atk")], deck: deckCards(3, "e") },
    });

  it("RS-442: ※特徴「女」を持つユニットにはアタックされない（他の自軍ユニットはアタックされる）（出典: atwiki/page-751）", () => {
    const targets = attackTargets(enemyTurn("SPEC-GIRLA"), `SPEC-GIRLA:atk`, "player2");
    expect(targets).not.toContain("RS-442:fr");
    expect(targets).toContain("TST-UNIT-0:other");
  });

  it("RS-442: ※「女」を持たないユニットにはアタックされる（出典: atwiki/page-751）", () => {
    expect(attackTargets(enemyTurn("TST-UNIT-7"), "TST-UNIT-7:atk", "player2")).toContain("RS-442:fr");
  });

  /** 2番目（NC）に出す。自軍ラッシュエリアと敵軍に「女」のユニットを置く。 */
  const france = (girls: number, pos = 2) => {
    const enemyGirls = Array.from({ length: girls }, (_, i) => inst("SPEC-GIRL", `e${i}`));
    return at("RS-442", pos, {}, { battle: enemyGirls });
  };

  it("RS-442: 【スパニッシュダンス】特徴「女」を持つユニット（敵軍のユニットも含む）1体につき BP+1000（出典: atwiki/page-751「特徴「女」を持つユニット1体につき」）", () => {
    expect(bpOf(france(2), "player1", "RS-442:x")).toBe(4000);
  });

  it("RS-442: 【スパニッシュダンス】自軍の「女」のユニットも数える（出典: atwiki/page-751）", () => {
    const s = at("RS-442", 2, { hand: [] }, { battle: [inst("SPEC-GIRL", "e0")] }, [inst("SPEC-GIRL", "own")]);
    expect(bpOf(s, "player1", "RS-442:x")).toBe(4000);
  });

  it("RS-442: NC が成立していない（1番目）ときは BP は上がらない（出典: atwiki/page-751「CN：2」・R-CN-02）", () => {
    expect(bpOf(france(2, 1), "player1", "RS-442:x")).toBe(2000);
  });

  it("RS-442: 【スパニッシュダンス】BP5000 以上のとき、次に並ぶ「女」の自軍 S ユニットは SP1 になる（出典: atwiki/page-751「これがBP5000以上のとき…SP1になる」）", () => {
    let s = france(3);
    s = passEntry(s);
    expect(bpOf(s, "player1", "RS-442:x")).toBe(5000);
    s = act({ ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [inst("SPEC-GIRL", "nx")] } } }, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-GIRL:nx" });
    expect(spOf(s, "player1", "SPEC-GIRL:nx")).toBe(1);
  });

  it("RS-442: 【スパニッシュダンス】BP4000（5000 未満）なら次に並ぶ「女」の S ユニットに SP は付かない（出典: atwiki/page-751「BP5000以上のとき」）", () => {
    let s = passEntry(france(1));
    s = act({ ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [inst("SPEC-GIRL", "nx")] } } }, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-GIRL:nx" });
    // 自軍の「女」が1体増えて BP は 4000（敵軍1体＋次の1体）
    expect(bpOf(s, "player1", "RS-442:x")).toBe(4000);
    expect(spOf(s, "player1", "SPEC-GIRL:nx")).toBe(0);
  });

  it("RS-442: 【スパニッシュダンス】次に並ぶのが「女」でない S ユニットなら SP は付かない（出典: atwiki/page-751）", () => {
    let s = passEntry(france(3));
    s = act({ ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [inst("SPEC-WBN", "nx")] } } }, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-WBN:nx" });
    expect(spOf(s, "player1", "SPEC-WBN:nx")).toBe(0);
  });
});

// ===========================================================================
describe("RS-443 バトルジャパン", () => {
  const TEXT =
    "※タクスET（これががバトルエリアの4番目にある間、これの次に並ぶETを持つSユニットは「SP1」になる） 【カンフーダンス】自軍ラッシュエリアのSユニットを2体まで選び、自軍コマンドゾーンにリリース状態で置いてもよい。(コマンドゾーンに置けるカードは通常5枚まで)";

  it("RS-443: カタログ本文・スペックが出典と一致（S・SP－・CN3）（出典: atwiki/page-754）", () => {
    expectCatalogText("RS-443", TEXT);
    expectStats("RS-443", { name: "バトルジャパン", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: 3, features: ["レッド", "男"] });
  });

  takusTests("RS-443", "page-754");

  const japan = (command: CardInstance[] = [], pos = 3) =>
    at("RS-443", pos, { rush: [inst("RS-443", "x"), inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-0", "c"), inst("TST-UNIT-2", "m")], command });

  it("RS-443: 【カンフーダンス】自軍ラッシュエリアの S ユニット（M は不可）から選べる（出典: atwiki/page-754「自軍ラッシュエリアのSユニットを2体まで選び」）", () => {
    const s = japan();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-443");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c"]);
  });

  it("RS-443: 【カンフーダンス】選んだ2体は自軍コマンドゾーンにリリース状態で置かれる（出典: atwiki/page-754「リリース状態で置いてもよい」）", () => {
    let s = pick(japan(), "TST-UNIT-0:a");
    if (s.pendingEffectChoice?.sourceCardId === "RS-443") s = pick(s, "TST-UNIT-0:b");
    s = resolveAll(s, ["__none__"]);
    for (const id of ["TST-UNIT-0:a", "TST-UNIT-0:b"]) {
      expect(zoneOf(s, "player1", id)).toBe("command");
      expect(s.players.player1.command.find((c) => c.instanceId === id)?.commandHeld ?? false).toBe(false);
    }
    expect(zoneOf(s, "player1", "TST-UNIT-0:c")).toBe("rush");
  });

  it("RS-443: 【カンフーダンス】コマンドゾーンが4枚なら置けるのは1体だけ（5枚まで）（出典: atwiki/page-754「(コマンドゾーンに置けるカードは通常5枚まで)」）", () => {
    let s = japan(releasedCat("ET", 4));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-443");
    s = pick(s, "TST-UNIT-0:a");
    if (s.pendingEffectChoice?.sourceCardId === "RS-443") s = pick(s, "TST-UNIT-0:b");
    s = resolveAll(s, ["__none__"]);
    expect(s.players.player1.command).toHaveLength(5);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("rush");
  });

  it("RS-443: 【カンフーダンス】は「置いてもよい」— 置かないことを選べる（出典: atwiki/page-754「置いてもよい」）", () => {
    let s = japan();
    if (s.pendingEffectChoice?.sourceCardId === "RS-443") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(s.players.player1.command).toHaveLength(0);
    expect(s.players.player1.rush).toHaveLength(4);
  });

  it("RS-443: NC が成立していない（2番目）ときは【カンフーダンス】は発動しない（出典: atwiki/page-754「CN：3」・R-CN-02）", () => {
    const s = japan([], 2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-443");
    expect(resolveAll(s, ["__none__"]).players.player1.command).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-444 バトルケニア", () => {
  const TEXT =
    "【トロピカルダンス】特徴「獣」を持つ自軍ユニットを3体まで選び、ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。";

  it("RS-444: カタログ本文・スペックが出典と一致（S・SP なし・CN4）（出典: atwiki/page-783）", () => {
    expectCatalogText("RS-444", TEXT);
    expectStats("RS-444", { name: "バトルケニア", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 0, comboNumber: 4, features: ["ブラック", "男"] });
  });

  const kenya = (pos = 4) =>
    at("RS-444", pos, {}, {}, [inst("SPEC-BEAST", "b1"), inst("SPEC-BEAST", "b2"), inst("TST-UNIT-0", "p")].slice(0, pos - 1));

  it("RS-444: 【トロピカルダンス】特徴「獣」の自軍ユニットだけを選べる（出典: atwiki/page-783「特徴「獣」を持つ自軍ユニットを3体まで選び」）", () => {
    const s = kenya();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-444");
    expect(choiceIds(s)).toEqual(["SPEC-BEAST:b1", "SPEC-BEAST:b2"]);
  });

  it("RS-444: 【トロピカルダンス】選んだユニットはラッシュエリアに戻り、このターン再びバトルエリアに出られない（出典: atwiki/page-783「ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない」）", () => {
    let s = pick(kenya(), "SPEC-BEAST:b1");
    if (s.pendingEffectChoice?.sourceCardId === "RS-444") s = pick(s, "SPEC-BEAST:b2");
    s = passEntry(resolveAll(s, ["__none__"]));
    expect(zoneOf(s, "player1", "SPEC-BEAST:b1")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-BEAST:b2")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:p")).toBe("battle");
    expect(canEnter(s, "SPEC-BEAST:b1")).toBe(false);
  });

  it("RS-444: 【トロピカルダンス】は「戻してもよい」— 戻さなければバトルエリアに残る（出典: atwiki/page-783「戻してもよい」）", () => {
    let s = kenya();
    if (s.pendingEffectChoice?.sourceCardId === "RS-444") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s, ["__none__"]);
    expect(zoneOf(s, "player1", "SPEC-BEAST:b1")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-BEAST:b2")).toBe("battle");
  });

  it("RS-444: NC が成立していない（3番目）ときは【トロピカルダンス】は発動しない（出典: atwiki/page-783「CN：4」・R-CN-02）", () => {
    const s = resolveAll(kenya(3), ["__none__"]);
    expect(zoneOf(s, "player1", "SPEC-BEAST:b1")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-BEAST:b2")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-445 ミスアメリカ", () => {
  const TEXT = "【ディスコダンス】「SP1」自分がターンを終えるとき、自軍バトルエリアの特徴「女」を持つSユニットをすべてラッシュエリアに戻してもよい。";

  it("RS-445: カタログ本文・スペックが出典と一致（S・SP！・CN5）（出典: atwiki/page-784）", () => {
    expectCatalogText("RS-445", TEXT);
    expectStats("RS-445", { name: "ミスアメリカ", category: "ET", size: "S", bp: 1000, sp: "special", powerCost: 3, comboNumber: 5, features: ["ピンク", "女", "警察"] });
  });

  const america = (pos = 5, before: CardInstance[] = [inst("SPEC-GIRL", "g"), inst("SPEC-GIRLM", "gm"), ...fillers(2)]) => at("RS-445", pos, {}, {}, before.slice(0, pos - 1));
  const toTurnEnd = (s: GameState) => {
    let t = passEntry(s);
    for (let i = 0; i < 4 && !t.pendingEffectChoice && t.activePlayer === "player1"; i++) t = nextPhase(t);
    return t;
  };

  it("RS-445: 【ディスコダンス】5番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-784「「SP1」」）", () => {
    expect(spOf(america(), "player1", "RS-445:x")).toBe(1);
  });

  it("RS-445: NC が成立していない（4番目）ときは SP！のまま（SP0）で、ターン終了時にも何も起きない（出典: atwiki/page-784「CN：5」・R-CN-02）", () => {
    const s = america(4);
    expect(spOf(s, "player1", "RS-445:x")).toBe(0);
    expect(toTurnEnd(s).pendingEffectChoice?.sourceCardId).not.toBe("RS-445");
  });

  it("RS-445: 【ディスコダンス】ターンを終えるとき、自軍バトルエリアの「女」の S ユニットをすべてラッシュエリアに戻せる（女の M・女でない S は残る）（出典: atwiki/page-784）", () => {
    let s = toTurnEnd(america());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-445");
    s = pick(s, "return");
    expect(zoneOf(s, "player1", "RS-445:x")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-GIRL:g")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-GIRLM:gm")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("battle");
  });

  it("RS-445: 【ディスコダンス】は「戻してもよい」— 戻さなければバトルエリアに残る（出典: atwiki/page-784「戻してもよい」）", () => {
    let s = toTurnEnd(america());
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-445:x")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-GIRL:g")).toBe("battle");
  });

  it("RS-445: 【ディスコダンス】敵軍バトルエリアの「女」の S ユニットは戻らない（出典: atwiki/page-784「自軍バトルエリアの」）", () => {
    let s = toTurnEnd(at("RS-445", 5, {}, { battle: [inst("SPEC-GIRL", "eg")] }, [inst("SPEC-GIRL", "g"), ...fillers(3)]));
    s = pick(s, "return");
    expect(zoneOf(s, "player2", "SPEC-GIRL:eg")).toBe("battle");
  });

  it("RS-445: 【ディスコダンス】発動元のミスアメリカがターン中に撃破されていても、ターンを終えるとき「女」の S ユニットを戻せる（出典: atwiki/page-784・R-CN-06「発動元が撃破・並び順変化しても無効にならない」）", () => {
    // ミスアメリカ（BP1000）で BP13000 の敵軍ユニットにアタックして撃破される
    let s = at("RS-445", 5, {}, { battle: [inst("TST-UNIT-7", "big")] }, [inst("SPEC-GIRL", "g"), ...fillers(3)]);
    s = resolveAll(attack(s, "RS-445:x", "TST-UNIT-7:big"), ["__none__"]);
    expect(zoneOf(s, "player1", "RS-445:x")).toBe("discard");
    s = toTurnEnd(s);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-445");
    s = pick(s, "return");
    expect(zoneOf(s, "player1", "SPEC-GIRL:g")).toBe("rush");
  });

  it("RS-445: 敵軍ターン中に5番目に出されても NC は発動しない（SP0）（出典: R-CN-04「敵軍ターン中に効果でCNの位置に出されても…NC は発動しない」）", () => {
    const s = stx({ activePlayer: "player2", player1: { battle: fillers(4), rush: [inst("RS-445", "x")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const t = enterBattleByEffect(s, "player1", "RS-445:x");
    expect(spOf(t, "player1", "RS-445:x")).toBe(0);
  });
});

