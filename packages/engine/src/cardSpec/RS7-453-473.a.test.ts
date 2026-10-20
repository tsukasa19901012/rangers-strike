/**
 * カード別スペック: RS-453〜RS-459（第7弾「七忍の炎陣」サムライマン〜ニンジャイエロー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_7.html。RS-457 Q1）、
 *     grnrngr/faq-card-8（RS-602 の Q に RS-458 が登場）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。
 *     Q&A 欄は RS-457 Q1・RS-459 Q1。コメント欄の質疑も参考に引用）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import { getLegalActions as legalActions } from "../core/legalActions";
import {
  NOSP_ATTACKER,
  passEntry,
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  bpOf,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  heldUnit,
  inst,
  ncEnter,
  pick,
  powerCards,
  reanimateTests,
  releasedCat,
  resolveAll,
  rider,
  rushFromHand,
  sUnit,
  settle,
  skip,
  spOf,
  st,
  zoneOf,
  zordDownTests,
} from "./RS7-453-473.helpers";
import type { CardInstance, GameState } from "../types/game";

/** 「無敵将軍」（RS-513。合体－レッドサルダー+ホワイトカーク+ブルーロウガン+イエロークマード+ブラックガンマー）を、
 * 指定の自軍ラッシュエリアのユニットでラッシュできるか。 */
function shogunState(rush: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) {
  return st({
    phase: "rush",
    player1: { hand: [inst("RS-513", "mu")], rush, command: releasedCat("MA", 2), power: powerCards(7), deck: deckCards(3) },
    player2: { ...p2 },
  });
}
const FIVE_NINJA = () => [inst("RS-455", "bk"), inst("RS-456", "bl"), inst("RS-457", "rd"), inst("RS-458", "wh"), inst("RS-459", "ye")];

/** 「○○」としてつかえる（合体素材の別名）の共通テスト。 */
function aliasTests(id: string, alias: string, page: string) {
  it(`${id}: ※ これは「${alias}」としてつかえる — 5人そろえば「無敵将軍」（合体－…+${alias}…）をラッシュでき、${id} は素材として捨札になる（出典: atwiki/${page}「※これは「${alias}」としてつかえる」・R-ADD-06）`, () => {
    const r = rushFromHand(shogunState(FIVE_NINJA()), "player1", "RS-513:mu");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-513:mu")).toBe("rush");
    const mine = FIVE_NINJA().find((c) => c.cardId === id)!;
    expect(zoneOf(t, "player1", mine.instanceId)).toBe("discard");
  });

  it(`${id}: ※ 「${alias}」として使える ${id} が欠けると「無敵将軍」はラッシュできない（出典: atwiki/${page}・R-ADD-06）`, () => {
    const s = shogunState(FIVE_NINJA().filter((c) => c.cardId !== id));
    expect(canStartRush(s, "player1", "RS-513:mu")).toBe(false);
  });
}

// ===========================================================================
describe("RS-453 サムライマン", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャマン」のカードを1枚選び、自軍ラッシュエリアに出す。 【激怒斬り】これが自軍ラッシュエリアにある間、敵軍ターン中、「サムライマン」以外の自軍ユニットがユニットサイズの違うユニットとバトルして撃破された時、敵軍ユニットを1体選び撃破してもよい。";

  it("RS-453: カタログ本文・スペックが出典と一致（出典: atwiki/page-798）", () => {
    expectCatalogText("RS-453", TEXT);
    expectStats("RS-453", {
      name: "サムライマン",
      category: "MA",
      size: "L",
      bp: 4500,
      sp: 1,
      powerCost: "7-",
      features: ["男", "侍"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-453", "RS-454", "ニンジャマン", "atwiki/page-798", "MA");
  reanimateTests("RS-453", "RS-454", "ニンジャマン", "atwiki/page-798");

  /** 敵軍ターンに、自軍バトルエリアの victim が敵軍 attacker にアタックされて撃破される（サムライマンは samuraiZone に置く）。 */
  const gekido = (
    victim: CardInstance,
    attacker: string,
    opts: { samuraiZone?: "rush" | "battle"; p2battle?: CardInstance[]; extra?: Parameters<typeof attackedInEnemyTurn>[4] } = {},
  ) => {
    const zone = opts.samuraiZone ?? "rush";
    return attackedInEnemyTurn(
      zone === "rush" ? { battle: [victim], rush: [inst("RS-453", "sm")] } : { battle: [victim, inst("RS-453", "sm")] },
      victim.instanceId,
      { battle: [inst(attacker.split(":")[0]!, attacker.split(":")[1]!), ...(opts.p2battle ?? [])] },
      attacker,
      opts.extra ?? [],
    );
  };

  it("RS-453: 【激怒斬り】ラッシュエリアにある間、敵軍ターン中に自軍 S ユニットが L ユニットとバトルして撃破されたとき、敵軍ユニットを1体選び撃破できる（出典: atwiki/page-798「ユニットサイズの違うユニットとバトルして撃破された時、敵軍ユニットを1体選び撃破してもよい」）", () => {
    const s = gekido(inst("TST-UNIT-0", "v"), "TST-UNIT-7:atk", { p2battle: [inst("TST-UNIT-2", "e2")] });
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-453");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:e2", "TST-UNIT-7:atk"].sort());
    const t = resolveAll(pick(s, "TST-UNIT-2:e2"));
    expect(zoneOf(t, "player2", "TST-UNIT-2:e2")).toBe("discard");
  });

  it("RS-453: 【激怒斬り】「撃破してもよい」— 見送ることができ、そのとき敵軍ユニットは撃破されない（出典: atwiki/page-798「撃破してもよい」）", () => {
    const s = gekido(inst("TST-UNIT-0", "v"), "TST-UNIT-7:atk", { p2battle: [inst("TST-UNIT-2", "e2")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-453");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(zoneOf(t, "player2", "TST-UNIT-2:e2")).toBe("battle");
    expect(zoneOf(t, "player2", "TST-UNIT-7:atk")).toBe("battle");
  });

  it("RS-453: 【激怒斬り】同じサイズのユニット（S 同士）とのバトルで撃破されたときは発動しない（出典: atwiki/page-798「ユニットサイズの違うユニットと」）", () => {
    const BIG_S = sUnit("SPEC-BIG-S", { bp: 9000 });
    const s = gekido(inst("TST-UNIT-0", "v"), "SPEC-BIG-S:atk", { p2battle: [inst("TST-UNIT-2", "e2")], extra: [BIG_S] });
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-2:e2")).toBe("battle");
  });

  it("RS-453: 【激怒斬り】サムライマンがバトルエリアにあるときは発動しない（出典: atwiki/page-798「これが自軍ラッシュエリアにある間」）", () => {
    const s = gekido(inst("TST-UNIT-0", "v"), "TST-UNIT-7:atk", { samuraiZone: "battle", p2battle: [inst("TST-UNIT-2", "e2")] });
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-453: 【激怒斬り】自軍ターン中のバトルでは発動しない（出典: atwiki/page-798「敵軍ターン中」）", () => {
    const s = st({
      player1: { battle: [inst("TST-UNIT-0", "v")], rush: [inst("RS-453", "sm")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "big"), inst("TST-UNIT-2", "e2")], deck: deckCards(3, "e") },
    });
    const t = settle(attack(s, "TST-UNIT-0:v", "TST-UNIT-7:big"));
    expect(zoneOf(t, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(t.pendingEffectChoice).toBeUndefined();
  });

  it("RS-453: 【激怒斬り】撃破されずに残った（バトルに勝った）ときは発動しない（出典: atwiki/page-798「バトルして撃破された時」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("TST-UNIT-7", "mine")], rush: [inst("RS-453", "sm")] }, "TST-UNIT-7:mine", { battle: [inst("SPEC-NOSP", "atk"), inst("TST-UNIT-2", "e2")] }, "SPEC-NOSP:atk", [NOSP_ATTACKER]);
    expect(zoneOf(s, "player1", "TST-UNIT-7:mine")).toBe("battle");
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-454 ニンジャマン", () => {
  const TEXT =
    "※自分か相手のLユニットがあれば、これはLユニットになる。 ※これは自軍パワーゾーンのオモテ向きのカード1枚につきBP+1000される。 【ニンジャソード】「SP1」";

  it("RS-454: カタログ本文・スペックが出典と一致（出典: atwiki/page-799）", () => {
    expectCatalogText("RS-454", TEXT);
    expectStats("RS-454", {
      name: "ニンジャマン",
      category: "MA",
      size: "S",
      bp: 500,
      sp: "special",
      powerCost: 2,
      comboNumber: 3,
      features: ["男", "忍者"],
    });
  });

  it("RS-454: ※ 自軍パワーゾーンのオモテ向きのカード1枚につき BP+1000（オモテ2枚・ウラ1枚なら 2500）（出典: atwiki/page-799「オモテ向きのカード1枚につきBP+1000される」）", () => {
    const s = st({ player1: { rush: [inst("RS-454", "nm")], power: [...powerCards(2), ...damageCards(1)], damage: 1 } });
    expect(bpOf(s, "player1", "RS-454:nm")).toBe(2500);
    const t = enter(s, "RS-454:nm");
    expect(bpOf(t, "player1", "RS-454:nm")).toBe(2500);
  });

  it("RS-454: ※ オモテ向きのパワーがなければ BP は 500 のまま（ウラ向きは数えない）（出典: atwiki/page-799）", () => {
    const s = st({ player1: { rush: [inst("RS-454", "nm")], power: damageCards(3), damage: 3 } });
    expect(bpOf(s, "player1", "RS-454:nm")).toBe(500);
  });

  it("RS-454: ※ 敵軍のパワーゾーンのオモテ向きのカードは数えない（出典: atwiki/page-799「自軍パワーゾーンの」）", () => {
    const s = st({ player1: { rush: [inst("RS-454", "nm")] }, player2: { power: powerCards(4, "ep") } });
    expect(bpOf(s, "player1", "RS-454:nm")).toBe(500);
  });

  /** 敵軍（player2）のバトルエリアにホールド状態のニンジャマンを置き、player1 のニンジャイエロー（S ユニットだけを選ぶ）を5番目に出す。 */
  const yellowVs = (p2battle: CardInstance[], p1rush: CardInstance[] = []) =>
    ncEnter("RS-459", 5, { rush: p1rush }, { battle: p2battle });

  it("RS-454: ※ 自分（ニンジャマンの持ち主）の L ユニットがあれば L ユニットになる — S ユニットだけを選ぶ効果（ニンジャイエロー）で選べない（出典: atwiki/page-799「自分か相手のLユニットがあれば、これはLユニットになる」）", () => {
    const s = yellowVs([heldUnit("RS-454", "nm"), inst("TST-UNIT-7", "L")]);
    expect(choiceIds(s)).not.toContain("RS-454:nm");
  });

  it("RS-454: ※ 相手の L ユニット（ラッシュエリアにあっても）があっても L ユニットになる（出典: atwiki/page-799「自分か相手のLユニットがあれば」）", () => {
    const s = yellowVs([heldUnit("RS-454", "nm"), heldUnit("TST-UNIT-0", "s")], [inst("TST-UNIT-7", "myL")]);
    expect(choiceIds(s)).toContain("TST-UNIT-0:s");
    expect(choiceIds(s)).not.toContain("RS-454:nm");
  });

  it("RS-454: ※ L ユニットがどこにもなければ S ユニットのまま（S ユニットを選ぶ効果で選べる）（出典: atwiki/page-799）", () => {
    const s = yellowVs([heldUnit("RS-454", "nm")]);
    expect(choiceIds(s)).toContain("RS-454:nm");
  });

  // atwiki/page-799 コメント「他のＬユニット…がいなくなった場合ニンジャマンのサイズはどうなりますか？」→「Sのまま。」
  it("RS-454: atwiki Q — ニンジャマン2体だけなら互いに支え合わず S ユニットのまま（出典: atwiki/page-799 コメント「Sのまま。詳しくはガンマジンを参照。」）", () => {
    const s = yellowVs([heldUnit("RS-454", "nm"), heldUnit("RS-454", "nm2")]);
    expect(choiceIds(s)).toEqual(["RS-454:nm", "RS-454:nm2"]);
  });

  it("RS-454: 【ニンジャソード】3番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-799「CN：3」「【ニンジャソード】「SP1」」）", () => {
    const s = ncEnter("RS-454", 3);
    expect(spOf(s, "player1", "RS-454:x")).toBe(1);
  });

  it("RS-454: 【ニンジャソード】NC 不成立（1番目）なら SP！は 0 のまま（出典: atwiki/page-799「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RS-454", 1);
    expect(spOf(s, "player1", "RS-454:x")).toBe(0);
  });
});

// ===========================================================================
describe("RS-455 ニンジャブラック", () => {
  const TEXT =
    "※これは「ブラックガンマー」としてつかえる。 ※これが自分の手札にある間、自軍ラッシュフェイズ中、自軍ダメージの数がこれの必要パワーの数字以上あれば、これを自軍ラッシュエリアに出してもよい。 【岩地獄の術】SPが空欄ではない敵軍Sユニットを自分の手札の枚数と同じ数まで選び、持ち主の山札の下に好きな順で戻してもよい。";

  it("RS-455: カタログ本文・スペックが出典と一致（出典: atwiki/page-800）", () => {
    expectCatalogText("RS-455", TEXT);
    expectStats("RS-455", {
      name: "ニンジャブラック",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 1,
      features: ["ブラック", "男", "忍者"],
    });
  });

  aliasTests("RS-455", "ブラックガンマー", "page-800");

  it("RS-455: 「ブラックガンマー」としてつかえても、デッキ構築では本来の名前のカードとして同名3枚まで（出典: atwiki/page-800・R-DECK-05）", () => {
    const r = validateDeckEntries([{ cardId: "RS-455", count: 4 }, { cardId: "RS-465", count: 36 }]);
    expect(r.errors.some((e) => e.includes("ニンジャブラック"))).toBe(true);
  });

  const selfRushState = (damage: number, command: CardInstance[] = []) =>
    st({ phase: "rush", player1: { hand: [inst("RS-455", "nb")], power: damageCards(damage), damage, command, deck: deckCards(3) } });

  it("RS-455: ※ 自軍ラッシュフェイズ中、自軍ダメージが必要パワー（4）以上なら、コマンドをホールドせずに手札から自軍ラッシュエリアに出せる（出典: atwiki/page-800「自軍ダメージの数がこれの必要パワーの数字以上あれば、これを自軍ラッシュエリアに出してもよい」）", () => {
    const s = selfRushState(4);
    const offered = H_legalMentions(s, "RS-455:nb");
    expect(offered).toBe(true);
  });

  it("RS-455: ※ 自軍ダメージが3（必要パワー未満）で MA コマンドもなければ、手札から出せない（出典: atwiki/page-800「必要パワーの数字以上あれば」）", () => {
    const s = selfRushState(3);
    expect(H_legalMentions(s, "RS-455:nb")).toBe(false);
  });

  /** 1番目に出して NC1【岩地獄の術】。敵軍: バトル [S・SP1, M・SP2, S・SP空欄(ニンジャブラック)]、ラッシュ [S・SP1, S・SP！(ニンジャレッド)]。 */
  const iwaJigoku = (hand: CardInstance[] = [inst("TST-OP", "h1"), inst("TST-OP", "h2"), inst("TST-OP", "h3")]) =>
    ncEnter(
      "RS-455",
      1,
      { hand },
      {
        battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "m"), inst("RS-455", "blank")],
        rush: [inst("TST-UNIT-0", "e3"), inst("RS-457", "bang")],
        deck: deckCards(3, "e"),
      },
    );

  it("RS-455: 【岩地獄の術】候補は SP が空欄でない敵軍 S ユニット（バトル・ラッシュ両方。M ユニット・SP 空欄は不可）（出典: atwiki/page-800「SPが空欄ではない敵軍Sユニット」）", () => {
    const s = iwaJigoku();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-455");
    expect(choiceIds(s)).toEqual(["RS-457:bang", "TST-UNIT-0:e1", "TST-UNIT-0:e3"].sort());
  });

  it("RS-455: 【岩地獄の術】選んだユニットは持ち主の山札の下に戻る（出典: atwiki/page-800「持ち主の山札の下に好きな順で戻してもよい」）", () => {
    let s = iwaJigoku();
    s = pick(s, "TST-UNIT-0:e1");
    s = pick(s, "TST-UNIT-0:e3");
    if (s.pendingEffectChoice?.sourceCardId === "RS-455") s = confirm(s);
    const t = resolveAll(s);
    const deck = t.players.player2.deck.map((c) => c.instanceId);
    expect(deck.slice(0, 3)).toEqual(["TST-OP:e0", "TST-OP:e1", "TST-OP:e2"]);
    expect(deck.slice(3).sort()).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e3"]);
  });

  it("RS-455: 【岩地獄の術】選べる数の上限は自分の手札の枚数（手札1枚なら1体まで）（出典: atwiki/page-800「自分の手札の枚数と同じ数まで選び」）", () => {
    const s = iwaJigoku([inst("TST-OP", "h1")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-455");
    expect(s.pendingEffectChoice?.selectCount).toBe(1);
  });

  it("RS-455: 【岩地獄の術】「戻してもよい」— 発動しなくてもよく、そのとき敵軍ユニットは動かない（出典: atwiki/page-800「戻してもよい」）", () => {
    let s = iwaJigoku();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e3")).toBe("rush");
    expect(s.players.player2.deck).toHaveLength(3);
  });

  it("RS-455: 【岩地獄の術】NC 不成立（2番目）なら発動しない（出典: atwiki/page-800「CN：1」・R-CN-02）", () => {
    const s = ncEnter("RS-455", 2, { hand: [inst("TST-OP", "h1")] }, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  // atwiki/page-800 コメント「SPが空欄というのは…ヘルサターンなどの効果でSPを得ているものも含まれますか？」→「含まれます。」
  it("RS-455: atwiki Q — 本来 SP 空欄でも効果（タクスMA）で SP を得ている敵軍 S ユニットは選べる（出典: atwiki/page-800 コメント「含まれます。」）", () => {
    // 敵軍バトル: [TST-UNIT-0, ニンジャホワイト(2番目・タクスMA), ニンジャブラック(MA・SP空欄)] → 3番目のニンジャブラックは SP1。
    const s = ncEnter("RS-455", 1, { hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")] }, { battle: [inst("TST-UNIT-2", "m"), inst("RS-458", "tx"), inst("RS-455", "eb")] });
    expect(choiceIds(s)).toContain("RS-455:eb");
  });

  // atwiki/page-800 コメント「SPが空欄ではない敵軍ユニットが1体のとき、自分の手札が2枚以上あればこの効果は発動できないのでしょうか？」→「いいえ…発動することができます。」
  it("RS-455: atwiki Q — 候補が1体で手札が2枚以上でも発動でき、その1体を戻せる（出典: atwiki/page-800 コメント「効果に選べる上限が手札と同じ数までなので…発動することができます」）", () => {
    let s = ncEnter("RS-455", 1, { hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2"), inst("TST-OP", "h3")] }, { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(2, "e") });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
    s = pick(s, "TST-UNIT-0:e1");
    if (s.pendingEffectChoice?.sourceCardId === "RS-455") s = confirm(s);
    s = resolveAll(s);
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-OP:e0", "TST-OP:e1", "TST-UNIT-0:e1"]);
  });
});

/** 合法手のどれかに instanceId が現れるか（終了以外）。 */
function H_legalMentions(s: GameState, instanceId: string): boolean {
  return (legalActions(s) as unknown as Record<string, unknown>[]).some(
    (a) => a.type !== "end_phase" && Object.values(a).some((v) => v === instanceId),
  );
}

// ===========================================================================
describe("RS-456 ニンジャブルー", () => {
  const TEXT =
    "※これは「ブルーロウガン」としてつかえる。 【忍法水走り】敵軍ラッシュエリアのユニットの数が、敵軍バトルエリアのユニットの数より多ければ、これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-456: カタログ本文・スペックが出典と一致（出典: atwiki/page-801）", () => {
    expectCatalogText("RS-456", TEXT);
    expectStats("RS-456", {
      name: "ニンジャブルー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 2,
      features: ["ブルー", "男", "忍者"],
    });
  });

  aliasTests("RS-456", "ブルーロウガン", "page-801");

  it("RS-456: 【忍法水走り】NC2 成立時、敵軍ラッシュ（2体）がバトル（1体）より多ければ、敵軍ラッシュエリアのユニットにアタックでき、バトルして撃破できる（出典: atwiki/page-801「これは敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = ncEnter("RS-456", 2, {}, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2")] });
    expect(attackTargets(s, "RS-456:x").sort()).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:r1", "TST-UNIT-0:r2"]);
    const t = settle(attack(s, "RS-456:x", "TST-UNIT-0:r1"));
    expect(zoneOf(t, "player2", "TST-UNIT-0:r1")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-456:x")).toBe("battle");
  });

  it("RS-456: 【忍法水走り】ラッシュとバトルの数が同じ（2体ずつ）ならラッシュエリアにはアタックできない（出典: atwiki/page-801「…より多ければ」）", () => {
    const s = ncEnter("RS-456", 2, {}, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2")] });
    expect(attackTargets(s, "RS-456:x").sort()).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
  });

  it("RS-456: 【忍法水走り】NC 不成立（1番目）なら条件を満たしてもラッシュエリアにはアタックできない（出典: atwiki/page-801「CN：2」・R-CN-02）", () => {
    const s = ncEnter("RS-456", 1, {}, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2")] });
    expect(attackTargets(s, "RS-456:x")).toEqual(["TST-UNIT-0:e1"]);
  });
});

// ===========================================================================
describe("RS-457 ニンジャレッド", () => {
  const TEXT =
    "※これは「レッドサルダー」としてつかえる。 【火炎つむじの術】「SP1」 敵軍ユニットの数と同じ枚数、敵軍山札の上からオモテにしてもよい。そうしたとき、オモテにしたカードと同じカード名の敵軍ユニットをすべて撃破する。そして相手はオモテにしたカードの中から、撃破されたユニットの数と同じ枚数まで好きな枚数選び手札に加えた後、それ以外を山札の下に好きな順で戻す。";

  it("RS-457: カタログ本文・スペックが出典と一致（出典: atwiki/page-802）", () => {
    expectCatalogText("RS-457", TEXT);
    expectStats("RS-457", {
      name: "ニンジャレッド",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["レッド", "男", "忍者"],
    });
  });

  aliasTests("RS-457", "レッドサルダー", "page-802");

  it("RS-457: 【火炎つむじの術】3番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-802「【火炎つむじの術】「SP1」」）", () => {
    const s = ncEnter("RS-457", 3, {}, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(spOf(s, "player1", "RS-457:x")).toBe(1);
  });

  it("RS-457: NC 不成立（1番目）なら SP！は 0（出典: atwiki/page-802「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RS-457", 1, {}, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(spOf(s, "player1", "RS-457:x")).toBe(0);
  });

  /** 敵軍ユニット3体（TST-UNIT-0 ×2、TST-UNIT-2）。敵軍山札の上3枚: TST-UNIT-0, TST-OP, TST-OP。 */
  const kaen = () =>
    ncEnter(
      "RS-457",
      3,
      {},
      {
        battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "e2")],
        rush: [inst("TST-UNIT-0", "e3")],
        hand: [],
        deck: [inst("TST-UNIT-0", "d1"), inst("TST-OP", "d2"), inst("TST-OP", "d3"), inst("TST-OP", "d4")],
      },
    );

  it("RS-457: 【火炎つむじの術】「オモテにしてもよい」— NC 成立時、山札をオモテにするかを選べる（出典: atwiki/page-802「敵軍山札の上からオモテにしてもよい」）", () => {
    const s = kaen();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-457");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-457: 【火炎つむじの術】敵軍ユニット数（3）枚をオモテにし、同じカード名の敵軍ユニット（バトル・ラッシュの TST-UNIT-0 ×2）をすべて撃破する。相手はオモテにしたカードから撃破数（2）まで手札に加え、残りは山札の下（出典: atwiki/page-802）", () => {
    let s = kaen();
    if (s.pendingEffectChoice?.sourceCardId === "RS-457" && s.pendingEffectChoice.kind === "confirm") s = confirm(s);
    s = resolveAll(s, ["TST-UNIT-0:d1", "TST-OP:d2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:d1")).toBe("hand");
    expect(s.players.player2.hand.length).toBeLessThanOrEqual(2);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:d4");
  });

  it("RS-457: 【火炎つむじの術】NC 不成立なら山札はオモテにならず、敵軍ユニットも撃破されない（出典: atwiki/page-802・R-CN-02）", () => {
    const s = resolveAll(ncEnter("RS-457", 1, {}, { battle: [inst("TST-UNIT-0", "e1")], deck: [inst("TST-UNIT-0", "d1"), inst("TST-OP", "d2")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-UNIT-0:d1", "TST-OP:d2"]);
  });

  // grnrngr/faq-card-7 RS-457 Q1「「同じ枚数」山札をオモテにできない為に処理が実行できない…処理の実行はできずに終了する」（atwiki/page-802 Q1 同文）
  it("RS-457: 公式Q&A — 敵軍山札が敵軍ユニットの数より少なければ処理は実行されずに終わる（撃破も手札移動も起きない）（出典: grnrngr/faq-card-7 RS-457 Q1・atwiki/page-802 Q1）", () => {
    const s = resolveAll(
      ncEnter("RS-457", 3, {}, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], hand: [], deck: [inst("TST-UNIT-0", "d1")] }),
    );
    expect(spOf(s, "player1", "RS-457:x")).toBe(1);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("battle");
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-UNIT-0:d1"]);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  // atwiki/page-802 コメント「ブレイカーを持つユニットにも有効ですか？」→「有効です。」（ユニットを選ばずに撃破するため）
  it("RS-457: atwiki Q — 【火炎つむじの術】はブレイカーを持つユニットにも有効（出典: atwiki/page-802 コメント「有効です。」）", () => {
    const BREAKER = sUnit("SPEC-BREAKER", {
      text: "※ブレイカー（これが自軍エリアにある間、ブレイカーを持たない敵軍ユニットや敵軍ビークルの効果に選ばれない）",
    });
    let s = ncEnter(
      "RS-457",
      3,
      {},
      { battle: [inst("SPEC-BREAKER", "b")], hand: [], deck: [inst("SPEC-BREAKER", "d1"), inst("TST-OP", "d2")] },
      [BREAKER],
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-457");
    s = resolveAll(confirm(s));
    expect(zoneOf(s, "player2", "SPEC-BREAKER:b")).toBe("discard");
  });
});

/** タクスMA の共通テスト（2番目に出したとき、次に並ぶ MA の S ユニットが「SP1」になる）。 */
function taxisTests(id: string, page: string) {
  const WB_NOSP = sUnit("SPEC-WB-NOSP", { sp: undefined, bp: 1000 });
  it(`${id}: ※タクスMA — 2番目にある間、次に並ぶ MA の S ユニット（SP 空欄のニンジャブラック）は「SP1」になる（出典: atwiki/${page}「※タクスMA」・R-KW-TAKUS-01）`, () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst(id, "tx"), inst("RS-455", "next")] } });
    s = enter(s, `${id}:tx`);
    s = enter(passEntry(s), "RS-455:next");
    expect(spOf(s, "player1", "RS-455:next")).toBe(1);
  });

  it(`${id}: ※タクスMA — 次に並ぶのが MA を持たない S ユニットなら SP は付かない（出典: atwiki/${page}・R-KW-TAKUS-01）`, () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst(id, "tx"), inst("SPEC-WB-NOSP", "next")] } }, [WB_NOSP]);
    s = enter(s, `${id}:tx`);
    s = enter(passEntry(s), "SPEC-WB-NOSP:next");
    expect(spOf(s, "player1", "SPEC-WB-NOSP:next")).toBe(0);
  });

  it(`${id}: ※タクスMA — 2番目でない（3番目）なら次の MA の S ユニットに SP は付かない（出典: atwiki/${page}「これがバトルエリアの2番目にある間」）`, () => {
    let s = st({ player1: { battle: fillers(2), rush: [inst(id, "tx"), inst("RS-455", "next")] } });
    s = enter(s, `${id}:tx`);
    s = enter(passEntry(s), "RS-455:next");
    expect(spOf(s, "player1", "RS-455:next")).toBe(0);
  });
}

// ===========================================================================
describe("RS-458 ニンジャホワイト", () => {
  const TEXT =
    "※これは「ホワイトカーク」としてつかえる。 ※タクスMA（これがバトルエリアの2番目にある間、これの次に並ぶMAを持つSユニットは「SP1」になる） 【忍法折鶴之舞】敵軍パワーゾーンのカード枚数を見て、その枚数よりも必要パワーの数字が大きい敵軍ユニットを1枚選び、持ち主の手札に戻してもよい。";

  it("RS-458: カタログ本文・スペックが出典と一致（出典: atwiki/page-803）", () => {
    expectCatalogText("RS-458", TEXT);
    expectStats("RS-458", {
      name: "ニンジャホワイト",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 4,
      features: ["ホワイト", "女", "忍者"],
    });
  });

  aliasTests("RS-458", "ホワイトカーク", "page-803");

  // grnrngr/faq-card-8 RS-602 Q「カード名が「ニンジャボワイド」になっても…「ホワイトカーク」のまま合体ユニットとして使うことができる」→「はい、それで間違いありません。」
  it("RS-458: 公式Q&A — 害水大臣ケガレシア（RS-602）の【汚染された水】でカード名が変わっていても「ホワイトカーク」として合体に使える（出典: grnrngr/faq-card-8 RS-602 Q）", () => {
    const s = shogunState(FIVE_NINJA(), { battle: [inst("RS-602", "k")] });
    const r = rushFromHand(s, "player1", "RS-513:mu");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-513:mu")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-458:wh")).toBe("discard");
  });

  taxisTests("RS-458", "page-803");

  /** 4番目に出して NC4。敵軍パワーゾーン2枚。敵軍: バトル [必要パワー0, 必要パワー2]、ラッシュ [必要パワー7+]。 */
  const orizuru = () =>
    ncEnter("RS-458", 4, {}, { power: powerCards(2, "ep"), battle: [inst("TST-UNIT-0", "c0"), inst("TST-UNIT-2", "c2")], rush: [inst("TST-UNIT-7", "c7")], hand: [] });

  it("RS-458: 【忍法折鶴之舞】候補は必要パワーの数字が敵軍パワーゾーンの枚数（2）より大きい敵軍ユニットだけ（ラッシュエリアも含む。0・2 は不可）（出典: atwiki/page-803「その枚数よりも必要パワーの数字が大きい敵軍ユニット」）", () => {
    const s = orizuru();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-458");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:c7"]);
  });

  it("RS-458: 【忍法折鶴之舞】選んだユニットは持ち主の手札に戻る（出典: atwiki/page-803「持ち主の手札に戻してもよい」）", () => {
    const t = resolveAll(pick(orizuru(), "TST-UNIT-7:c7"));
    expect(zoneOf(t, "player2", "TST-UNIT-7:c7")).toBe("hand");
    expect(t.players.player1.hand.map((c) => c.instanceId)).not.toContain("TST-UNIT-7:c7");
  });

  it("RS-458: 【忍法折鶴之舞】「戻してもよい」— 見送ることができる（出典: atwiki/page-803「戻してもよい」）", () => {
    const s = orizuru();
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(zoneOf(t, "player2", "TST-UNIT-7:c7")).toBe("rush");
  });

  it("RS-458: 【忍法折鶴之舞】NC 不成立（3番目）なら発動しない（出典: atwiki/page-803「CN：4」・R-CN-02）", () => {
    const s = ncEnter("RS-458", 3, {}, { power: powerCards(2, "ep"), rush: [inst("TST-UNIT-7", "c7")] });
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-459 ニンジャイエロー", () => {
  const TEXT =
    "※これは「イエロークマード」としてつかえる。 ※タクスMA（これがバトルエリアの2番目にある間、これの次に並ぶMAを持つSユニットは「SP1」になる） 【隠流三段斬り】敵軍バトルエリアからホールド状態の敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RS-459: カタログ本文・スペックが出典と一致（出典: atwiki/page-804）", () => {
    expectCatalogText("RS-459", TEXT);
    expectStats("RS-459", {
      name: "ニンジャイエロー",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 5,
      features: ["イエロー", "男", "忍者"],
    });
  });

  aliasTests("RS-459", "イエロークマード", "page-804");
  taxisTests("RS-459", "page-804");

  /** 5番目に出して NC5。敵軍: バトル [ホールドS, リリースS, ホールドM]、ラッシュ [ホールドS]。 */
  const sandan = () =>
    ncEnter(
      "RS-459",
      5,
      {},
      {
        battle: [heldUnit("TST-UNIT-0", "hs"), inst("TST-UNIT-0", "rs"), heldUnit("TST-UNIT-2", "hm")],
        rush: [heldUnit("TST-UNIT-0", "rush")],
      },
    );

  it("RS-459: 【隠流三段斬り】候補は敵軍バトルエリアのホールド状態の S ユニットだけ（リリース状態・M ユニット・ラッシュエリアは不可）（出典: atwiki/page-804「敵軍バトルエリアからホールド状態の敵軍Sユニットを1体選び」）", () => {
    const s = sandan();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-459");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:hs"]);
  });

  it("RS-459: 【隠流三段斬り】M ユニット・敵軍ラッシュエリアのユニットは候補にならない（出典: atwiki/page-804「敵軍バトルエリアから…Sユニット」）", () => {
    const s = sandan();
    expect(choiceIds(s)).toContain("TST-UNIT-0:hs");
    expect(choiceIds(s)).not.toContain("TST-UNIT-2:hm");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:rush");
  });

  it("RS-459: 【隠流三段斬り】選んだユニットは持ち主のパワーゾーンにウラ向き（ダメージ）で置かれる（出典: atwiki/page-804「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const t = resolveAll(pick(sandan(), "TST-UNIT-0:hs"));
    const placed = t.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:hs");
    expect(placed?.faceDown).toBe(true);
    expect(t.players.player2.damage).toBe(1);
  });

  it("RS-459: 【隠流三段斬り】「置いてもよい」— 見送ることができる（出典: atwiki/page-804「置いてもよい」）", () => {
    const s = sandan();
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(zoneOf(t, "player2", "TST-UNIT-0:hs")).toBe("battle");
    expect(t.players.player2.damage ?? 0).toBe(0);
  });

  it("RS-459: 【隠流三段斬り】NC 不成立（4番目）なら発動しない（出典: atwiki/page-804「CN：5」・R-CN-02）", () => {
    const s = ncEnter("RS-459", 4, {}, { battle: [heldUnit("TST-UNIT-0", "hs")] });
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-459: 【隠流三段斬り】ビークルにライド中のホールド状態の S ユニットも選べる（出典: atwiki/page-804「ホールド状態の敵軍Sユニットを1体選び」）", () => {
    const s = ncEnter("RS-459", 5, {}, { battle: [{ ...rider("TST-UNIT-0", "g", "RS-466:v1"), commandHeld: true }, inst("RS-466", "v1")] });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:g"]);
  });

  // atwiki/page-804 Q1/A1「パワーゾーンにダメージにして置かれることなく、チェイスによってその場に留まります」
  it("RS-459: atwiki Q&A — ライド中の「宇宙刑事ギャバン」を選んでも、チェイスでライドされていない自軍ビークルに乗り換えてその場に留まる（ダメージにならない）（出典: atwiki/page-804 Q1/A1）", () => {
    let s = ncEnter("RS-459", 5, {}, { battle: [{ ...rider("RM-018", "g", "RS-466:v1"), commandHeld: true }, inst("RS-466", "v1")], rush: [inst("RS-467", "v2")] });
    expect(choiceIds(s)).toContain("RM-018:g");
    s = pick(s, "RM-018:g");
    s = resolveAll(s);
    // チェイス（任意）: ライドされていない自軍ビークル（ラッシュエリアの RS-467）に乗り換える。
    expect(s.pendingChase?.chaserPlayerId).toBe("player2");
    s = resolveAll(act(s, { type: "resolve_chase", playerId: "player2", newVehicleInstanceId: "RS-467:v2" }));
    expect(zoneOf(s, "player2", "RM-018:g")).not.toBe("power");
    expect(zoneOf(s, "player2", "RS-466:v1")).toBe("discard");
    expect(s.players.player2.damage ?? 0).toBe(0);
  });
});
