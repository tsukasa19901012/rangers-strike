/**
 * カード別スペック: RS-640〜RS-647（第9弾「蒼九の翼」ギガバイタスCM〜ピヨちゃん）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-640〜RS-647 は該当なし）、grnrngr/faq-card-9（カード別 Q&A なし。キーワード「ウイング」Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-*、R-ZONE-08、R-TGT-01、R-DESTROY-02、R-KW-RESIST-*、R-KW-WING-*）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attackTargets,
  attackUntilRegister,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  attackedInEnemyTurn,
  enterBattleByEffect,
  expectCatalogText,
  expectStats,
  fill,
  held,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  rarityOf,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  wingTests,
  zoneOf,
  confirm,
} from "./RS9-627-647.helpers";

const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000, sp: undefined });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000, sp: undefined });

/** 母艦の自軍ユニットへのアタック制限（※これはDAを持たないユニットにアタックすることができない）の共通テスト。 */
function daOnlyAttackTests(id: string, page: string) {
  it(`${id}: ※ DA を持たない敵軍ユニットにはアタックできず、DA を持つ敵軍ユニットにはアタックできる（出典: ${page}「※これはDAを持たないユニットにアタックすることができない」）`, () => {
    const s = p1Battle({ battle: [inst(id, "g")] }, { battle: [inst("SPEC-DA-S", "da"), inst("SPEC-WB-S", "wb")] }, [DA_S, WB_S]);
    expect(attackTargets(s, `${id}:g`)).toEqual(["SPEC-DA-S:da"]);
  });
}

// ===========================================================================
describe("RS-640 ギガバイタスCM", () => {
  const TEXT = "※これはDAを持たないユニットにアタックすることができない。";
  const PAGE = "atwiki/page-1464";

  it("RS-640: カタログ本文・スペックが出典と一致（出典: atwiki/page-1464。カード名は追加条件「自軍「ギガバイタスCM」」の表記に合わせ（クルーザーモード）を含めない）", () => {
    expectCatalogText("RS-640", TEXT);
    expectStats("RS-640", { name: "ギガバイタスCM", category: "WB", size: "XL", bp: 6000, sp: undefined, powerCost: 2, features: ["メカ", "獣", "母艦"] });
    expect(rarityOf("RS-640")).toBe("N");
  });

  daOnlyAttackTests("RS-640", PAGE);

  it("RS-640: 必要パワー2・追加条件なしで手札からラッシュできる（出典: atwiki/page-1464）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-640", "cm")], command: releasedCat("WB", 1), power: powerCards(2), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-640:cm");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-640:cm")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-641 ギガバイタスSM", () => {
  const TEXT =
    "※これはDAを持たないユニットにアタックすることができない。 【スクランブル】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードがSCユニットのカードだったなら、それを自軍ラッシュエリアに出す。ただし追加条件は満たすこと。出せなかったなら、オモテにしたカードは山札の下に戻す。";
  const PAGE = "atwiki/page-1465";

  it("RS-641: カタログ本文・スペックが出典と一致（出典: atwiki/page-1465）", () => {
    expectCatalogText("RS-641", TEXT);
    expectStats("RS-641", { name: "ギガバイタスSM", category: "WB", size: "XL", bp: 8000, sp: undefined, powerCost: "3+", features: ["メカ", "獣", "母艦"], rushCondition: "discard_named_unit" });
    expect(rarityOf("RS-641")).toBe("N");
  });

  daOnlyAttackTests("RS-641", PAGE);

  it("RS-641: 追加条件 — 自軍「ギガバイタスCM」1体を捨札にしてラッシュできる（出典: atwiki/page-1465「追加条件：自軍「ギガバイタスCM」1体を捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-641", "sm")], rush: [inst("RS-640", "cm")], command: releasedCat("WB", 1), power: powerCards(3), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-641:sm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-641:sm")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-640:cm")).toBe("discard");
  });

  it("RS-641: 追加条件 — 「ギガバイタスCM」がいなければラッシュできない（出典: atwiki/page-1465）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-641", "sm")], rush: fill(2), command: releasedCat("WB", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-641:sm")).toBe(false);
  });

  it("RS-641: 必要パワー3 — パワー2 ではラッシュできない（出典: atwiki/page-1465「必要パワー：3+」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-641", "sm")], rush: [inst("RS-640", "cm")], command: releasedCat("WB", 1), power: powerCards(2), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-641:sm")).toBe(false);
  });

  const scramble = (deck: ReturnType<typeof inst>[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    act(p1Battle({ rush: [inst("RS-641", "sm")], power: powerCards(8), deck: [...deck, ...deckCards(3, "rest")], ...p1 }), {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: "RS-641:sm",
    });

  it("RS-641: 【スクランブル】自軍ターンにバトルエリアに出たとき、山札の上をオモテにするかを選べる（任意）（出典: atwiki/page-1465「オモテにしてもよい」）", () => {
    const s = scramble([inst("RS-643", "gw")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-641");
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-641 【スクランブル】がオモテにしたカードを山札の上に残すだけ（scry_keep_one）で、SC ユニットでもラッシュエリアに出さない
  it.fails("RS-641: 【スクランブル】オモテにしたカードが SC ユニット（分身獣ギガホイール。追加条件「母艦」をギガバイタスSM自身が満たす）なら自軍ラッシュエリアに出す（出典: atwiki/page-1465）", () => {
    const s = resolveAll(scramble([inst("RS-643", "gw")]), ["RS-643:gw"]);
    expect(zoneOf(s, "player1", "RS-643:gw")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-641 【スクランブル】で出せなかったカードが山札の下ではなく山札の上に残る
  it.fails("RS-641: 【スクランブル】オモテにしたカードが SC ユニットでなければ山札の下に戻す（出典: atwiki/page-1465「出せなかったなら、オモテにしたカードは山札の下に戻す」）", () => {
    const s = resolveAll(scramble([inst("TST-UNIT-0", "top")]), ["TST-UNIT-0:top"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("deck");
    const deck = s.players.player1.deck;
    expect(deck[deck.length - 1]?.instanceId).toBe("TST-UNIT-0:top");
  });

  // 既知の不具合: CARD-RS-641 【スクランブル】が SC ユニットを出す処理も山札の下に戻す処理も持たない（オモテにしたカードは山札の上に残る）
  it.fails("RS-641: 【スクランブル】追加条件を満たせない SC ユニット（マーズマシン。自軍Sユニット5体が必要）は出さず山札の下に戻す（出典: atwiki/page-1465「ただし追加条件は満たすこと。出せなかったなら…山札の下に戻す」）", () => {
    const s = resolveAll(scramble([inst("RS-646", "mm")]), ["RS-646:mm"]);
    expect(zoneOf(s, "player1", "RS-646:mm")).toBe("deck");
    const deck = s.players.player1.deck;
    expect(deck[deck.length - 1]?.instanceId).toBe("RS-646:mm");
  });

  it("RS-641: 【スクランブル】オモテにしなければ山札はそのまま（出典: atwiki/page-1465「そうしたとき」）", () => {
    const s = resolveAll(skip(scramble([inst("RS-643", "gw")])));
    expect(s.players.player1.deck[0]?.instanceId).toBe("RS-643:gw");
  });

  it("RS-641: 【スクランブル】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1465「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-641", "sm")], deck: [inst("RS-643", "gw"), ...deckCards(3)] }, player2: { deck: deckCards(3, "e") } });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-641:sm"), ["RS-643:gw"]);
    expect(s.players.player1.deck[0]?.instanceId).toBe("RS-643:gw");
  });
});

// ===========================================================================
describe("RS-642 ギガライノス", () => {
  const TEXT = "※レジスト 【ギガンティスバスター】自軍ターン中、これがバトルエリアに出たとき、ホールド状態の敵軍ユニットを1体選び撃破してもよい。";
  const L_E = sUnit("SPEC-642-L", { size: "L", bp: 9000 });

  it("RS-642: カタログ本文・スペックが出典と一致（出典: atwiki/page-1493）", () => {
    expectCatalogText("RS-642", TEXT);
    expectStats("RS-642", { name: "ギガライノス", category: "WB", size: "L", bp: 5000, sp: 1, powerCost: "5+", features: ["メカ", "獣", "人型"], rushCondition: "discard_named_unit" });
  });

  it("RS-642: レアリティはレア（出典: atwiki/page-1493「レアリティ：レア」）", () => {
    expect(rarityOf("RS-642")).toBe("R");
  });

  it("RS-642: 追加条件 — 自軍「分身獣ギガホイール」1体を捨札にしてラッシュできる（出典: atwiki/page-1493）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-642", "rh")], rush: [inst("RS-643", "gw")], command: releasedCat("WB", 1), power: powerCards(5), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-642:rh");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-642:rh")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-643:gw")).toBe("discard");
  });

  it("RS-642: 追加条件・必要パワー — ギガホイールがいなければ、またはパワー4ではラッシュできない（出典: atwiki/page-1493「必要パワー：5+」）", () => {
    const none = st({ phase: "rush", player1: { hand: [inst("RS-642", "rh")], rush: fill(1), command: releasedCat("WB", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(none, "player1", "RS-642:rh")).toBe(false);
    const low = st({ phase: "rush", player1: { hand: [inst("RS-642", "rh")], rush: [inst("RS-643", "gw")], command: releasedCat("WB", 1), power: powerCards(4), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-642:rh")).toBe(false);
  });

  const board = () =>
    act(
      p1Battle(
        { rush: [inst("RS-642", "rh")] },
        { rush: [held("SPEC-642-L", "hl"), inst("TST-UNIT-0", "rr")], battle: [held("TST-UNIT-0", "hb"), inst("TST-UNIT-0", "rb")] },
        [L_E],
      ),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-642:rh" },
    );

  // 既知の不具合: CARD-RS-642 【ギガンティスバスター】の候補が敵軍バトルエリアの全ユニット（リリース状態も含む）で、ラッシュエリアのホールド状態のユニットを選べない（ホールド状態の条件が落ちている）
  it.fails("RS-642: 【ギガンティスバスター】自軍ターンにバトルエリアに出たとき、ホールド状態の敵軍ユニット（サイズ・エリアを問わない）を1体選び撃破してもよい（出典: atwiki/page-1493・R-TGT-01）", () => {
    let s = board();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-642");
    expect(choiceIds(s)).toEqual(["SPEC-642-L:hl", "TST-UNIT-0:hb"]);
    s = resolveAll(pick(s, "SPEC-642-L:hl"));
    expect(zoneOf(s, "player2", "SPEC-642-L:hl")).toBe("discard");
  });

  it("RS-642: 【ギガンティスバスター】ホールド状態の敵軍バトルエリアのユニットを撃破できる（出典: atwiki/page-1493）", () => {
    const s = resolveAll(pick(board(), "TST-UNIT-0:hb"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:rb")).toBe("battle");
  });

  it("RS-642: 【ギガンティスバスター】任意 — 撃破しないこともできる（出典: atwiki/page-1493「撃破してもよい」）", () => {
    let s = board();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-642-L:hl")).toBe("rush");
  });

  it("RS-642: 【ギガンティスバスター】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1493「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-642", "rh")], deck: deckCards(3) }, player2: { battle: [held("TST-UNIT-0", "hb")], deck: deckCards(3, "e") } });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-642:rh"), ["TST-UNIT-0:hb"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:hb")).toBe("battle");
  });

  it("RS-642: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストできる（出典: atwiki/page-1493「※レジスト」・R-KW-RESIST-01）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-642", "rh")] }, "RS-642:rh");
    expect(registerOffered(s)).toBe(true);
  });
});

// ===========================================================================
/** 追加条件「特徴「母艦」を持つ自軍ユニットがある」の共通テスト。 */
function mothershipGateTests(id: string, page: string, power: number) {
  const rushState = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ phase: "rush", player1: { hand: [inst(id, "sc")], command: releasedCat("WB", 1), power: powerCards(power), deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } });

  it(`${id}: 追加条件 — 特徴「母艦」を持つ自軍ユニット（ラッシュエリアのギガバイタスCM）があればラッシュでき、母艦は捨札にならない（出典: ${page}「追加条件：特徴「母艦」を持つ自軍ユニットがある」）`, () => {
    const r = rushFromHand(rushState({ rush: [inst("RS-640", "cm")] }), "player1", `${id}:sc`);
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:sc`)).toBe("rush");
    expect(zoneOf(t, "player1", "RS-640:cm")).toBe("rush");
  });

  it(`${id}: 追加条件 — 母艦がバトルエリアにあっても満たす（出典: ${page}・R-TGT-01）`, () => {
    const r = rushFromHand(rushState({ battle: [inst("RS-640", "cm")] }), "player1", `${id}:sc`);
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", `${id}:sc`)).toBe("rush");
  });

  it(`${id}: 追加条件 — 母艦がなければ（捨札・敵軍の母艦は数えない）ラッシュできない（出典: ${page}「自軍ユニットがある」）`, () => {
    expect(canStartRush(rushState({ discard: [inst("RS-640", "cm")] }, { rush: [inst("RS-640", "ecm")] }), "player1", `${id}:sc`)).toBe(false);
  });

  it(`${id}: 必要パワー${power} — パワー${power - 1} ではラッシュできない（出典: ${page}「必要パワー：${power}+」）`, () => {
    expect(canStartRush(rushState({ rush: [inst("RS-640", "cm")], power: powerCards(power - 1) }), "player1", `${id}:sc`)).toBe(false);
  });
}

describe("RS-643 分身獣ギガホイール", () => {
  it("RS-643: カタログ本文（テキストなし）・スペックが出典と一致（出典: atwiki/page-1466「テキスト：なし」）", () => {
    expectCatalogText("RS-643", "なし");
    expectStats("RS-643", { name: "分身獣ギガホイール", category: "WB", size: "SC", bp: 5000, sp: undefined, powerCost: "3+", features: ["メカ", "獣", "車両"], rushCondition: "state_gate" });
    expect(rarityOf("RS-643")).toBe("N");
  });

  mothershipGateTests("RS-643", "atwiki/page-1466", 3);
});

describe("RS-644 分身獣ギガウイング", () => {
  it("RS-644: カタログ本文・スペックが出典と一致（出典: atwiki/page-1467）", () => {
    expectCatalogText("RS-644", "※ウイング");
    expectStats("RS-644", { name: "分身獣ギガウイング", category: "WB", size: "SC", bp: 4000, sp: undefined, powerCost: "4+", features: ["メカ", "獣", "航空機"], rushCondition: "state_gate" });
    expect(rarityOf("RS-644")).toBe("N");
  });

  mothershipGateTests("RS-644", "atwiki/page-1467", 4);
  wingTests("RS-644", "atwiki/page-1467");
});

// ===========================================================================
describe("RS-645 ビクトリーマーズ", () => {
  const TEXT =
    "※これは敵軍常駐置き場のカード1枚につきSP+1される。 【マーズフレア】 自軍ターン中、これがバトルエリアに出たとき、相手は自分自身の常駐置き場からカードを1枚選び（ウラ向きのカードはウラ向きのまま選ぶ）、自分自身のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";
  // 常駐オペレーション: RS-253 ファイブテクター（※常駐）。
  const RES = (suffix: string, faceDown = false) => ({ ...inst("RS-253", suffix), ...(faceDown ? { faceDown: true } : {}) });

  it("RS-645: カタログ本文・スペックが出典と一致（出典: atwiki/page-1492）", () => {
    expectCatalogText("RS-645", TEXT);
    expectStats("RS-645", { name: "ビクトリーマーズ", category: "ET", size: "L", bp: 11000, sp: 1, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
  });

  it("RS-645: レアリティはレア（出典: atwiki/page-1492「レアリティ：レア」）", () => {
    expect(rarityOf("RS-645")).toBe("R");
  });

  it("RS-645: 追加条件 — 自軍「マーズマシン」1体を捨札にし、パワー7でラッシュできる（出典: atwiki/page-1492）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-645", "vm")], rush: [inst("RS-646", "mm")], command: releasedCat("ET", 1), power: powerCards(7), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-645:vm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-645:vm")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-646:mm")).toBe("discard");
  });

  it("RS-645: 必要パワー7+ — パワー6、またはマーズマシンなしではラッシュできない（出典: atwiki/page-1492「必要パワー：7+」）", () => {
    const low = st({ phase: "rush", player1: { hand: [inst("RS-645", "vm")], rush: [inst("RS-646", "mm")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-645:vm")).toBe(false);
    const none = st({ phase: "rush", player1: { hand: [inst("RS-645", "vm")], rush: fill(1), command: releasedCat("ET", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(none, "player1", "RS-645:vm")).toBe(false);
  });

  // 既知の不具合: CARD-RS-645 ※ 敵軍常駐置き場の枚数による SP+1 が未実装（常に SP1）
  it.fails("RS-645: ※ 敵軍常駐置き場のカード1枚につき SP+1（2枚なら SP3）（出典: atwiki/page-1492）", () => {
    const s = p1Battle({ battle: [inst("RS-645", "vm")] }, { operation: [RES("o1"), RES("o2", true)] });
    expect(spOf(s, "player1", "RS-645:vm")).toBe(3);
  });

  it("RS-645: ※ 敵軍常駐置き場が空なら SP1、自軍常駐置き場のカードは数えない（出典: atwiki/page-1492「敵軍常駐置き場」）", () => {
    const s = p1Battle({ battle: [inst("RS-645", "vm")], operation: [RES("mine")] });
    expect(spOf(s, "player1", "RS-645:vm")).toBe(1);
  });

  const flare = (p2: Partial<GameState["players"]["player2"]>) =>
    act(p1Battle({ rush: [inst("RS-645", "vm")] }, p2), { type: "move_to_battle", playerId: "player1", instanceId: "RS-645:vm" });

  // 既知の不具合: CARD-RS-645 【マーズフレア】が未実装（相手の選択が開かず、常駐置き場のカードは動かない）
  it.fails("RS-645: 【マーズフレア】自軍ターンにバトルエリアに出たとき、相手が自分の常駐置き場のカードを1枚選び（強制）、自分のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1492）", () => {
    let s = flare({ operation: [RES("o1"), RES("o2")], command: releasedCat("WB", 1, "ec") });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["RS-253:o1", "RS-253:o2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "RS-253:o2"));
    expect(zoneOf(s, "player2", "RS-253:o2")).toBe("command");
    expect(cardIn(s, "player2", "RS-253:o2")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "RS-253:o1")).toBe("operation");
  });

  // 既知の不具合: CARD-RS-645 【マーズフレア】が未実装
  it.fails("RS-645: 【マーズフレア】コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-1492「置けなければ捨札にする」・R-ZONE-08）", () => {
    const s = resolveAll(flare({ operation: [RES("o1")], command: releasedCat("WB", 5, "ec") }), ["RS-253:o1"]);
    expect(zoneOf(s, "player2", "RS-253:o1")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-645: 【マーズフレア】敵軍常駐置き場が空なら何も起きない（出典: atwiki/page-1492）", () => {
    const s = resolveAll(flare({ command: releasedCat("WB", 1, "ec") }));
    expect(s.players.player2.command).toHaveLength(1);
  });

  it("RS-645: 【マーズフレア】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1492「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-645", "vm")], deck: deckCards(3) }, player2: { operation: [RES("o1")], deck: deckCards(3, "e") } });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-645:vm"), ["RS-253:o1"]);
    expect(zoneOf(s, "player2", "RS-253:o1")).toBe("operation");
  });
});

// ===========================================================================
describe("RS-646 マーズマシン", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札からSユニットのカードを5枚まで選び手札に加えてもよい。";
  const M_CARD = sUnit("SPEC-646-M", { size: "M", bp: 3000 });

  it("RS-646: カタログ本文・スペックが出典と一致（出典: atwiki/page-1468）", () => {
    expectCatalogText("RS-646", TEXT);
    expectStats("RS-646", { name: "マーズマシン", category: "ET", size: "SC", bp: 4000, sp: undefined, powerCost: "5+", features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_command_or_discard" });
    expect(rarityOf("RS-646")).toBe("N");
  });

  const rushState = (sCount: number, command = releasedCat("ET", 1)) =>
    st({ phase: "rush", player1: { hand: [inst("RS-646", "mm")], rush: fill(sCount), command, power: powerCards(5), deck: deckCards(3) } });

  it("RS-646: 追加条件 — 自軍Sユニット5体を捨札にしてラッシュできる（出典: atwiki/page-1468「自軍Sユニット5体をそれぞれコマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(rushState(5), "player1", "RS-646:mm", { destination: "discard" });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-646:mm")).toBe("rush");
    expect(t.players.player1.discard.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(5);
  });

  it("RS-646: 追加条件 — Sユニットをコマンドゾーンに送ってもよい（出典: atwiki/page-1468「それぞれコマンドゾーンに送るか」）", () => {
    const r = rushFromHand(rushState(5), "player1", "RS-646:mm", { destination: "command" });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-646:mm")).toBe("rush");
    expect(t.players.player1.command.filter((c) => c.cardId === "TST-UNIT-0").length).toBeGreaterThan(0);
  });

  it("RS-646: 追加条件 — Sユニットが4体ではラッシュできない（出典: atwiki/page-1468「5体」）", () => {
    expect(canStartRush(rushState(4), "player1", "RS-646:mm")).toBe(false);
  });

  // 既知の不具合: CARD-RS-646 ※ 撃破されて捨札になったときの回収が未実装（選択が開かない）
  it.fails("RS-646: ※ 撃破されて捨札になったとき、自軍捨札の S ユニットのカードを選び手札に加えられる（M ユニットのカードは選べない）（出典: atwiki/page-1468）", () => {
    let s = attackedInEnemyTurn(
      { battle: [inst("RS-646", "mm")], discard: [...fill(6, "d"), inst("SPEC-646-M", "m")] },
      "RS-646:mm",
      {},
      "TST-UNIT-7:atk",
      [M_CARD],
    );
    expect(zoneOf(s, "player1", "RS-646:mm")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-646");
    expect(choiceIds(s)).not.toContain("SPEC-646-M:m");
    expect(choiceIds(s)).toContain("TST-UNIT-0:d0");
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-646 ※ 回収が未実装
  it.fails("RS-646: ※ 選べるのは5枚まで（6枚目は選べない）（出典: atwiki/page-1468「5枚まで」）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("RS-646", "mm")], discard: fill(6, "d") }, "RS-646:mm");
    for (let i = 0; i < 5 && s.pendingEffectChoice?.sourceCardId === "RS-646"; i++) {
      const p = s.pendingEffectChoice;
      const next = p.validInstanceIds.find((x) => x.startsWith("TST-UNIT-0:d"));
      if (!next) break;
      s = pick(s, next);
    }
    if (s.pendingEffectChoice?.sourceCardId === "RS-646" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = resolveAll(s);
    expect(s.players.player1.hand.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(5);
    expect(s.players.player1.discard.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(1);
  });

  it("RS-646: ※ 任意 — 加えないこともできる（出典: atwiki/page-1468「手札に加えてもよい」）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("RS-646", "mm")], discard: fill(3, "d") }, "RS-646:mm");
    if (s.pendingEffectChoice) s = skip(s);
    s = resolveAll(s);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-646: ※ 撃破されずに捨札になった（追加条件の素材として捨てた）ときは発動しない（出典: atwiki/page-1468「撃破されて捨札になったとき」・R-DESTROY-02）", () => {
    const s0 = st({ phase: "rush", player1: { hand: [inst("RS-645", "vm")], rush: [inst("RS-646", "mm")], discard: fill(3, "d"), command: releasedCat("ET", 1), power: powerCards(7), deck: deckCards(3) } });
    const r = rushFromHand(s0, "player1", "RS-645:vm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state, ["TST-UNIT-0:d0"]);
    expect(zoneOf(t, "player1", "RS-646:mm")).toBe("discard");
    expect(t.players.player1.hand).toHaveLength(0);
  });

  it("RS-646: ※ 自軍捨札に S ユニットのカードがなければ何も加えない（出典: atwiki/page-1468）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-646", "mm")] }, "RS-646:mm");
    expect(zoneOf(s, "player1", "RS-646:mm")).toBe("discard");
    // マーズマシン自身は SC ユニットのカードなので候補にならない。
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-647 ピヨちゃん", () => {
  const TEXT =
    "※これは自軍ターン中バトルエリアに出られない。 【ソウルバード】自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒※レジスト";

  it("RS-647: カタログ本文・スペックが出典と一致（出典: atwiki/page-1469）", () => {
    expectCatalogText("RS-647", TEXT);
    expectStats("RS-647", { name: "ピヨちゃん", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["獣"] });
  });

  it("RS-647: レアリティはノーマルレア（出典: atwiki/page-1469「レアリティ：ノーマルレア」）", () => {
    expect(rarityOf("RS-647")).toBe("NR");
  });

  it("RS-647: ※ 自軍ターン中（自軍バトルフェイズ）はバトルエリアに出られない（出典: atwiki/page-1469「※これは自軍ターン中バトルエリアに出られない」）", () => {
    const s = p1Battle({ rush: [inst("RS-647", "p"), inst("TST-UNIT-0", "other")] });
    expect(canEnter(s, "RS-647:p")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:other")).toBe(true);
  });

  it.todo(
    "RS-647: ※ 敵軍ターン中は効果でバトルエリアに出られる（制限は自軍ターン中だけ）— 敵軍ターンに自軍ユニットを出す効果（ファイブテクター等）の支払い・対象指定を公開 API で安定して組めないため保留",
  );

  const L_DA = sUnit("SPEC-647-LDA", { size: "L", category: "DA", bp: 9000 });
  const soulBoard = () =>
    st(
      { phase: "rush", player1: { rush: [inst("RS-647", "p"), inst("TST-UNIT-7", "L"), inst("SPEC-647-LDA", "LD"), inst("TST-UNIT-2", "M")], deck: deckCards(3) } },
      [L_DA],
    );
  const soulActions = (s: GameState) => legal(s).filter((a) => JSON.stringify(a).includes("RS-647:p"));

  // 既知の不具合: CARD-RS-647 【ソウルバード】が未実装（自軍ラッシュフェイズにピヨちゃんを使う合法手がない）
  it.fails("RS-647: 【ソウルバード】自軍ラッシュフェイズ中、DA を持たない自軍 L ユニットを選んでピヨちゃんに重ねられる（出典: atwiki/page-1469）", () => {
    expect(soulActions(soulBoard()).length).toBeGreaterThan(0);
  });

  // 既知の不具合: CARD-RS-647 【ソウルバード】が未実装
  it.fails("RS-647: 【ソウルバード】重ねられるのは DA を持たない L ユニットだけ（DA の L・M は候補外）（出典: atwiki/page-1469「DAを持たない自軍Lユニット」）", () => {
    let s = soulBoard();
    const a = soulActions(s)[0];
    expect(a).toBeDefined();
    s = act(s, a!);
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:L"]);
  });

  it("RS-647: 【ソウルバード】任意 — 自軍ラッシュフェイズを使わずに終えられる（出典: atwiki/page-1469「重ねてもよい」）", () => {
    expect(legal(soulBoard()).some((a) => a.type === "end_phase")).toBe(true);
  });

  it("RS-647: 【ソウルバード】自軍バトルフェイズ中は使えない（出典: atwiki/page-1469「自軍ラッシュフェイズ中」）", () => {
    const s = st({ player1: { rush: [inst("RS-647", "p"), inst("TST-UNIT-7", "L")], deck: deckCards(3) } });
    expect(legal(s).some((a) => a.type !== "move_to_battle" && JSON.stringify(a).includes("RS-647:p") && a.type !== "hold_for_wing")).toBe(false);
  });

  it.todo(
    "RS-647: 【ソウルバード】重ねたユニットは※レジストを得て、そのユニットがユニットでなくなるときピヨちゃんは捨札になる — 重ねる処理自体が未実装（上記 it.fails）で、重なった状態を公開 API で作れないため検証できない",
  );
});
