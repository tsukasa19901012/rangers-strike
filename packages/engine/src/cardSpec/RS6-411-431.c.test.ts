/**
 * カード別スペック: RS-426〜RS-431（第6弾「紅き六戦士の帰還」スーパーゲキレッド〜黒獅子リオ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html。RS-428・RS-430 の Q、RS-378 の Q に RS-429 が登場）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。Q&A 欄なし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02 NC の発動、R-ADD-02 必要パワー「-」）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  nextPhase,
  NOSP_ATTACKER,
  passEntry,
  pick,
  powerCards,
  raw,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  strike,
  toPhase,
  zoneOf,
  zordDownTests,
} from "./RS6-411-431.helpers";
import type { GameState } from "../types/game";

/** 自軍バトルフェイズに、ids を順にバトルエリアへ出す（各進入後の行動ウィンドウはパス）。 */
function enterSeq(s: GameState, ids: string[], playerId: "player1" | "player2" = "player1"): GameState {
  let next = s;
  for (const id of ids) next = passEntry(enter(passEntry(next, playerId), id, playerId), playerId);
  return next;
}

// ===========================================================================
describe("RS-426 スーパーゲキレッド", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自分の手札の｢スーパーゲキレッド｣か、自軍捨札の｢ゲキレッド｣か、どちらか1枚を選び、自軍ラッシュエリアに出す。【スーパータイガークロー】「SP1」";

  it("RS-426: カタログ本文・スペックが出典と一致（SP「！」・CN2・必要パワー7-）（出典: atwiki/page-509）", () => {
    expectCatalogText("RS-426", TEXT);
    expectStats("RS-426", {
      name: "スーパーゲキレッド",
      category: "WB",
      size: "S",
      bp: 5500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 2,
      features: ["レッド", "男", "激気"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-426", "RS-340", "ゲキレッド", "atwiki/page-509", "WB");

  it("RS-426: 【スーパータイガークロー】2番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-509・R-CN-02）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("TST-UNIT-0", "f1"), inst("RS-426", "sr")], deck: deckCards(3) } }), ["TST-UNIT-0:f1", "RS-426:sr"]);
    expect(spOf(s, "player1", "RS-426:sr")).toBe(1);
  });

  it("RS-426: 【スーパータイガークロー】1番目に出たとき（NC 不成立）は SP がない（出典: atwiki/page-509・R-CN-02）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("RS-426", "sr")], deck: deckCards(3) } }), ["RS-426:sr"]);
    expect(spOf(s, "player1", "RS-426:sr")).toBe(0);
  });

  it("RS-426: ※ 撃破されて捨札になったとき、手札の「スーパーゲキレッド」か捨札の「ゲキレッド」か、どちらか1枚をプレイヤーが選ぶ（手札の方を選べる）（出典: atwiki/page-509「どちらか1枚を選び、自軍ラッシュエリアに出す」）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("RS-426", "sr")], hand: [inst("RS-426", "h")], discard: [inst("RS-340", "gr")] }, "RS-426:sr");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-340:gr", "RS-426:h"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "RS-426:h"));
    expect(zoneOf(s, "player1", "RS-426:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-340:gr")).toBe("discard");
  });

  it("RS-426: ※ 手札の「スーパーゲキレッド」しかなければそれを自軍ラッシュエリアに出す（出典: atwiki/page-509）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-426", "sr")], hand: [inst("RS-426", "h"), inst("TST-UNIT-0", "other")] }, "RS-426:sr");
    expect(zoneOf(s, "player1", "RS-426:sr")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-426:h")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("hand");
  });

  it("RS-426: ※ 自軍捨札の「ゲキレッド」しかなければそれを自軍ラッシュエリアに出す（出典: atwiki/page-509）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-426", "sr")], discard: [inst("RS-340", "gr"), inst("TST-UNIT-0", "other")] }, "RS-426:sr");
    expect(zoneOf(s, "player1", "RS-340:gr")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  it("RS-426: ※ どちらもなければ何も出さない（捨札の「スーパーゲキレッド」・手札の「ゲキレッド」は対象外）（出典: atwiki/page-509「自分の手札の｢スーパーゲキレッド｣か、自軍捨札の｢ゲキレッド｣か」）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-426", "sr")], hand: [inst("RS-340", "hgr")], discard: [inst("RS-426", "dsr")] }, "RS-426:sr");
    expect(s.players.player1.rush).toHaveLength(0);
    expect(zoneOf(s, "player1", "RS-340:hgr")).toBe("hand");
  });

  it("RS-426: ※ 撃破されずに場に残ったときは何も出さない（出典: atwiki/page-509「撃破されて捨札になったとき」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("RS-426", "sr")], discard: [inst("RS-340", "gr")] }, "RS-426:sr", {}, "SPEC-NOSP:atk", [NOSP_ATTACKER]),
    );
    expect(zoneOf(s, "player1", "RS-426:sr")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-340:gr")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-427 スーパーゲキイエロー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に｢ゲキイエロー｣のカードがあれば1枚選び、自軍ラッシュエリアに出す。【オネスト・ハート】直前のターンに敵軍ユニットが発動した「次の相手ターン」とある効果を無効にする。";

  it("RS-427: カタログ本文・スペックが出典と一致（CN1・必要パワー7-）（出典: atwiki/page-510）", () => {
    expectCatalogText("RS-427", TEXT);
    expectStats("RS-427", {
      name: "スーパーゲキイエロー",
      category: "WB",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 1,
      features: ["イエロー", "女", "激気"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-427", "RS-342", "ゲキイエロー", "atwiki/page-510", "WB");

  it("RS-427: ※ 撃破されて捨札になったとき、自軍捨札の「ゲキイエロー」を自軍ラッシュエリアに出す（出典: atwiki/page-510）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-427", "sy")], discard: [inst("TST-UNIT-0", "other"), inst("RS-342", "gy")] }, "RS-427:sy", {}, ["RS-342:gy"]);
    expect(zoneOf(s, "player1", "RS-427:sy")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-342:gy")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  it("RS-427: ※ 「ゲキイエロー」が2枚あればどちらを出すか選べ（見送れない）、出したあとに選択は残らない（出典: atwiki/page-510「1枚選び、自軍ラッシュエリアに出す」）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("RS-427", "sy")], discard: [inst("RS-342", "p"), inst("RS-342", "p2")] }, "RS-427:sy");
    expect(choiceIds(s)).toEqual(["RS-342:p", "RS-342:p2"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "RS-342:p2");
    expect(zoneOf(s, "player1", "RS-342:p2")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-342:p")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // CARD-RS-427（修正済み）: 個別実装と DSL の二重の誘発をやめ、個別実装だけで解決する。
  it("RS-427: ※ 「ゲキイエロー」が1枚だけのときも、出したあとに選択は残らない（出典: atwiki/page-510「1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RS-427", "sy")], discard: [inst("RS-342", "gy")] }, "RS-427:sy");
    expect(zoneOf(s, "player1", "RS-342:gy")).toBe("rush");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-427: ※ 自軍捨札に「ゲキイエロー」がなければ何も出さない（出典: atwiki/page-510「…があれば」）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-427", "sy")], discard: [inst("TST-UNIT-0", "other")] }, "RS-427:sy");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it("RS-427: ※ 撃破されずに場に残ったときは何も出さない（出典: atwiki/page-510「撃破されて捨札になったとき」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("RS-427", "sy")], discard: [inst("RS-342", "gy")] }, "RS-427:sy", {}, "SPEC-NOSP:atk", [NOSP_ATTACKER]),
    );
    expect(zoneOf(s, "player1", "RS-427:sy")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-342:gy")).toBe("discard");
  });

  /**
   * 直前の敵軍ターンにデカピンク（RS-110）【ゼニボム】「次の相手ターン、新しくラッシュエリアに出たユニットは、
   * ターンが終わるまでバトルエリアに出られない」が発動し、自軍ラッシュフェイズに TST-UNIT-0 をラッシュしてバトルフェイズに入ったところ。
   */
  const afterZenibomb = () => {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-427", "sy"), inst("TST-UNIT-0", "f1")], hand: [inst("TST-UNIT-0", "u")], command: releasedCat("WB", 2), deck: deckCards(8) },
      player2: { battle: fillers(4, "ef"), rush: [inst("RS-110", "dp")], deck: deckCards(8, "e") },
    });
    s = passEntry(enter(s, "RS-110:dp", "player2"), "player2");
    s = toPhase(endTurn(s), "player1", "rush");
    const r = rushFromHand(s, "player1", "TST-UNIT-0:u");
    expect(r.ok).toBe(true);
    s = nextPhase(r.state);
    expect(s.phase).toBe("battle");
    return s;
  };

  it("RS-427: 【オネスト・ハート】の前提 — 直前の敵軍ターンのゼニボムにより、新しくラッシュしたユニットはバトルエリアに出られない（出典: atwiki/page-510・RS-110【ゼニボム】）", () => {
    expect(canEnter(afterZenibomb(), "TST-UNIT-0:u")).toBe(false);
  });

  it("RS-427: 【オネスト・ハート】1番目に出て NC が成立すると、直前のターンに敵軍ユニットが発動した「次の相手ターン」の効果（ゼニボム）を無効にする（出典: atwiki/page-510「直前のターンに敵軍ユニットが発動した「次の相手ターン」とある効果を無効にする」）", () => {
    const s = enterSeq(afterZenibomb(), ["RS-427:sy"]);
    expect(canEnter(s, "TST-UNIT-0:u")).toBe(true);
  });

  it("RS-427: 【オネスト・ハート】1番目以外に出た（NC 不成立）ときは無効にしない（出典: atwiki/page-510・R-CN-02）", () => {
    const s = enterSeq(afterZenibomb(), ["TST-UNIT-0:f1", "RS-427:sy"]);
    expect(canEnter(s, "TST-UNIT-0:u")).toBe(false);
  });
});

// ===========================================================================
describe("RS-428 スーパーゲキブルー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に｢ゲキブルー｣のカードがあれば1枚選び、自軍ラッシュエリアに出す。【ファンタスティック・テクニック】自軍ラッシュエリアから、効果に「ラッシュしたとき」とある「WB」のMユニットを1体選んでもよい。そうしたとき、そのラッシュしたときの効果を発動する。";

  it("RS-428: カタログ本文・スペックが出典と一致（CN3・必要パワー7-）（出典: atwiki/page-511）", () => {
    expectCatalogText("RS-428", TEXT);
    expectStats("RS-428", {
      name: "スーパーゲキブルー",
      category: "WB",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 3,
      features: ["ブルー", "男", "激気"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-428", "RS-341", "ゲキブルー", "atwiki/page-511", "WB");
  reanimateTests("RS-428", "RS-341", "ゲキブルー", "atwiki/page-511");

  /** 自軍バトルフェイズ: 2体並べたあとスーパーゲキブルーを3番目に出す（NC 成立）。自軍ラッシュエリアにゲキジャガー・ゲキチーター・TST-UNIT-2（WB の M・効果なし）。 */
  const fantastic = (positionThree = true) =>
    enterSeq(
      st({
        player1: {
          battle: positionThree ? fillers(2) : fillers(1),
          rush: [inst("RS-428", "sb"), inst("RS-425", "jg"), inst("RS-424", "ch"), inst("TST-UNIT-2", "m")],
          deck: deckCards(3),
        },
        player2: { battle: [inst("TST-UNIT-2", "c2"), inst("RS-340", "c3")], power: [{ ...inst("TST-P", "ed0"), faceDown: true }, { ...inst("TST-P", "ed1"), faceDown: true }], damage: 2, deck: deckCards(3, "e") },
      }),
      ["RS-428:sb"],
    );

  it("RS-428: 【ファンタスティック・テクニック】3番目に出て NC が成立すると、自軍ラッシュエリアの「ラッシュしたとき」とある WB の M ユニット（ゲキジャガー）を選べる（効果のないゲキチーター・M ユニットは選べない）（出典: atwiki/page-511）", () => {
    const s = fantastic();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-428");
    expect(choiceIds(s)).toEqual(["RS-425:jg"]);
  });

  it("RS-428: 【ファンタスティック・テクニック】選んだゲキジャガーの【転転弾】を発動し、必要パワーが敵軍ダメージ（2点）以下の敵軍ユニットを撃破できる。ゲキジャガーはラッシュエリアに残る（出典: atwiki/page-511「そのラッシュしたときの効果を発動する」）", () => {
    let s = pick(fantastic(), "RS-425:jg");
    expect(zoneOf(s, "player1", "RS-425:jg")).toBe("rush");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:c2"]);
    s = resolveAll(pick(s, "TST-UNIT-2:c2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("discard");
  });

  it("RS-428: 【ファンタスティック・テクニック】NC 不成立（2番目）なら発動しない（出典: atwiki/page-511・R-CN-02）", () => {
    const s = fantastic(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-428");
  });

  it("RS-428: 【ファンタスティック・テクニック】は NC の効果なので、ラッシュしただけでは発動しない（出典: atwiki/page-511（CN3・タイミングの記載がない【】効果は NC）・R-CN-02）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-428", "sb")], rush: [inst("RS-425", "jg")], command: releasedCat("WB", 2), power: powerCards(7), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-428:sb");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-428");
  });

  it("RS-428: 【ファンタスティック・テクニック】「選んでもよい」— 見送れる（出典: atwiki/page-511）", () => {
    let s = fantastic();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-428");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-2:c2")).toBe("battle");
  });

  it.todo(
    "RS-428: 【ファンタスティック・テクニック】で発動したティラノソニックの撃破は守護獣ティラノザウルスによるもので、スーパーゲキブルーに使った超電子ダイナモ（改造人間常駐）の2点ダメージにはならない（出典: grnrngr/faq-card-6 RS-428 Q「いいえ、できません」）— 【ファンタスティック・テクニック】が NC として発動せず（上記 it.fails）、RK-001/RK-005 との組み合わせを再現できないため",
  );
});

// ===========================================================================
describe("RS-429 マスター・シャーフー", () => {
  const TEXT =
    "※これは自軍ターン中バトルエリアに出られない。【暮らしの中に修行あり】これは自軍ラッシュエリアにある間、次の効果を発動する⇒すべてのSユニットの特徴に「激気」を追加する。また、自軍ターン中、「MA」の自軍コマンドをホールドする代わりに「WB」の自軍コマンドをホールドしてもよい。ただし、追加で自軍コマンドを1つホールドすること。";

  it("RS-429: カタログ本文・スペックが出典と一致（出典: atwiki/page-508）", () => {
    expectCatalogText("RS-429", TEXT);
    expectStats("RS-429", {
      name: "マスター・シャーフー",
      category: "WB",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 0,
      features: ["男", "拳聖", "激気"],
      rushCondition: undefined,
    });
  });

  it("RS-429: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-508「これは自軍ターン中バトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-429", "sf"), inst("TST-UNIT-0", "u")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-429:sf")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:u")).toBe(true);
  });

  it("RS-429: ※ 敵軍ターン中ならバトルエリアに出られる（ファイブテクターで出せる）（出典: atwiki/page-508「自軍ターン中」）", () => {
    const s = strike(
      st({ activePlayer: "player2", player1: { rush: [inst("RS-429", "sf")], operation: [inst("RS-253", "ft")], deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(5, "e") } }),
      "TST-UNIT-0:e1",
      "player2",
    );
    expect(legal(s).some((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "RS-429:sf")).toBe(true);
  });

  it("RS-429: 【暮らしの中に修行あり】ラッシュエリアにある間、すべての S ユニットに特徴「激気」が追加される — 激気（RS-436）がゲキレッド（本来は激気なし）の進入で誘発する（出典: atwiki/page-508「すべてのSユニットの特徴に「激気」を追加する」）", () => {
    const s = enter(
      st({ player1: { rush: [inst("RS-340", "gr"), inst("RS-429", "sf")], hand: [inst("RS-424", "ch")], operation: [inst("RS-436", "gk")], deck: deckCards(3) } }),
      "RS-340:gr",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
  });

  /** 自軍ラッシュフェイズ: 大剣人ズバーン（MA・必要パワー3）を、WB のコマンドだけでラッシュしようとする。 */
  const maRush = (withShifu: boolean, wbCommands: number) =>
    st({
      phase: "rush",
      player1: {
        hand: [inst("RS-420", "dz")],
        rush: withShifu ? [inst("RS-429", "sf")] : [],
        command: releasedCat("WB", wbCommands),
        power: powerCards(3),
        deck: deckCards(3),
      },
    });

  it("RS-429: 【暮らしの中に修行あり】MA のコマンドのかわりに WB のコマンド＋追加1つ（計2つ）をホールドして MA のユニットをラッシュできる（出典: atwiki/page-508「「MA」の自軍コマンドをホールドする代わりに「WB」の自軍コマンドをホールドしてもよい。ただし、追加で自軍コマンドを1つホールドすること」）", () => {
    const s = maRush(true, 2);
    expect(canStartRush(s, "player1", "RS-420:dz")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-420:dz");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-420:dz")).toBe("rush");
    expect(r.state.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("RS-429: 【暮らしの中に修行あり】追加でホールドするコマンドがなければ（WB 1つだけ）代用できない（出典: atwiki/page-508「ただし、追加で自軍コマンドを1つホールドすること」）", () => {
    expect(canStartRush(maRush(true, 1), "player1", "RS-420:dz")).toBe(false);
  });

  it("RS-429: 【暮らしの中に修行あり】シャーフーがいなければ WB のコマンドで MA のユニットはラッシュできない（出典: atwiki/page-508）", () => {
    expect(canStartRush(maRush(false, 2), "player1", "RS-420:dz")).toBe(false);
  });

  it("RS-429: ギンガブルー【流水の鼓動】を WB＋追加1つのホールドで発動したとき、「ホールドしたコマンド」は MA のかわりにホールドした WB のコマンド1つだけ（追加分のナンバーは参照しない）（出典: grnrngr/faq-card-6 RS-378 Q「「ミスティックアームズ」のコマンドの代わりとしてホールドした「ワイルドビースト」のコマンド１つ」）", () => {
    let s = enter(
      passEntry(st({
        player1: {
          battle: fillers(1),
          rush: [inst("RS-378", "gb"), inst("RS-429", "sf")],
          command: [released("RS-342", "n3"), released("RS-340", "n2")],
          deck: deckCards(3),
        },
        player2: { battle: [inst("RS-341", "e2"), inst("RS-099", "e3")], deck: deckCards(3, "e") },
      })),
      "RS-378:gb",
    );
    // NC 成立直後の行動ウィンドウで【流水の鼓動】を起動し、WB「ゲキイエロー」（ナンバー3）をかわりにホールドし、
    // 追加で「ゲキレッド」（ナンバー2）をホールドする。
    const activate = legal(s).find((a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === "RS-378:gb");
    expect(activate).toBeDefined();
    s = raw(s, activate!);
    expect(s.pendingCommandPayment?.sourceInstanceId).toBe("RS-378:gb");
    s = raw(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["RS-342:n3", "RS-340:n2"] });
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    s = resolveAll(s, ["RS-099:e3"]);
    expect(zoneOf(s, "player2", "RS-099:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-341:e2")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-430 ロボタフ", () => {
  const TEXT =
    "※これは自軍ターン中バトルエリアに出られない。【獣拳トレーナー】これが自軍ラッシュエリアにある間、追加条件を持たない「WB」のすべてのSユニットは、次の能力を得る⇒必要パワーの数字2ごとにBP＋1000され、バトルエリアで2番目に並んだとき「SP1」になる。";

  it("RS-430: カタログ本文・スペックが出典と一致（出典: atwiki/page-507）", () => {
    expectCatalogText("RS-430", TEXT);
    expectStats("RS-430", {
      name: "ロボタフ",
      category: "WB",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 3,
      features: ["メカ", "人型"],
      rushCondition: undefined,
    });
  });

  it("RS-430: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-507「これは自軍ターン中バトルエリアに出られない」）", () => {
    expect(canEnter(st({ player1: { rush: [inst("RS-430", "rt")], deck: deckCards(3) } }), "RS-430:rt")).toBe(false);
  });

  it("RS-430: ※ 敵軍ターン中ならバトルエリアに出られる（ファイブテクターで出せる）（出典: atwiki/page-507「自軍ターン中」）", () => {
    const s = strike(
      st({ activePlayer: "player2", player1: { rush: [inst("RS-430", "rt")], operation: [inst("RS-253", "ft")], deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(5, "e") } }),
      "TST-UNIT-0:e1",
      "player2",
    );
    expect(legal(s).some((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "RS-430:rt")).toBe(true);
  });

  it("RS-430: 【獣拳トレーナー】追加条件を持たない WB の S ユニットは必要パワーの数字2ごとに BP+1000（ガオレッド2nd: 4→+2000、ゲキレッド: 3→+1000）（出典: atwiki/page-507「必要パワーの数字2ごとにBP＋1000」）", () => {
    const s = st({ player1: { rush: [inst("RS-430", "rt")], battle: [inst("RS-402", "g4"), inst("RS-340", "g3"), inst("RS-341", "g1")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-402:g4")).toBe(5000);
    expect(bpOf(s, "player1", "RS-340:g3")).toBe(4000);
    expect(bpOf(s, "player1", "RS-341:g1")).toBe(1000);
  });

  it("RS-430: 【獣拳トレーナー】WB 以外（MA）の S ユニットは対象外（出典: atwiki/page-507「「WB」のすべてのSユニット」）", () => {
    const s = st({ player1: { rush: [inst("RS-430", "rt")], battle: [inst("RS-061", "ma4")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-061:ma4")).toBe(3000);
  });

  it("RS-430: 【獣拳トレーナー】追加条件の記述欄に記述があるもの（必要パワー「7-」のスーパーゲキレッド）は「追加条件を持つ」ので対象外（出典: grnrngr/faq-card-6 RS-430 Q2「追加条件の記述欄に記述のあるものはすべて「追加条件を持つ」と考えてください」）", () => {
    const s = st({ player1: { rush: [inst("RS-430", "rt")], battle: [inst("RS-426", "g7")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-426:g7")).toBe(5500);
  });

  it("RS-430: 【獣拳トレーナー】自軍と敵軍のすべての WB の S ユニットが対象 — 敵軍のロボタフでも自軍のガオレッド2nd は BP+2000（出典: grnrngr/faq-card-6 RS-430 Q3「はい、その通りです」）", () => {
    const s = st({ player1: { battle: [inst("RS-402", "g4")], deck: deckCards(3) }, player2: { rush: [inst("RS-430", "ert")] } });
    expect(bpOf(s, "player1", "RS-402:g4")).toBe(5000);
  });

  it("RS-430: 【獣拳トレーナー】自軍ラッシュエリアに2体あれば重複する（BP+2000×2）（出典: grnrngr/faq-card-6 RS-430 Q1「はい、重複します」）", () => {
    const s = st({ player1: { rush: [inst("RS-430", "rt"), inst("RS-430", "rt2")], battle: [inst("RS-402", "g4")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-402:g4")).toBe(7000);
  });

  it("RS-430: 【獣拳トレーナー】自軍と敵軍のラッシュエリアに合わせて複数体あれば重複する（1体ずつ → BP+2000×2）（出典: grnrngr/faq-card-6 RS-430 Q1「自軍ラッシュエリアと敵軍ラッシュエリアに合わせて複数体ある場合…はい、重複します」）", () => {
    const s = st({ player1: { rush: [inst("RS-430", "rt")], battle: [inst("RS-402", "g4")], deck: deckCards(3) }, player2: { rush: [inst("RS-430", "ert")] } });
    expect(bpOf(s, "player1", "RS-402:g4")).toBe(7000);
  });

  it("RS-430: 【獣拳トレーナー】これがバトルエリアにあるときは効果がない（出典: atwiki/page-507「これが自軍ラッシュエリアにある間」）", () => {
    const s = st({ player1: { battle: [inst("RS-430", "rt"), inst("RS-402", "g4")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-402:g4")).toBe(3000);
  });

  it("RS-430: 【獣拳トレーナー】SP のない WB の S ユニット（ゲキイエロー）が2番目に並んだとき「SP1」になる（出典: atwiki/page-507「バトルエリアで2番目に並んだとき「SP1」になる」）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("RS-430", "rt"), inst("TST-UNIT-0", "f"), inst("RS-342", "y")], deck: deckCards(3) } }), ["TST-UNIT-0:f", "RS-342:y"]);
    expect(spOf(s, "player1", "RS-342:y")).toBe(1);
  });

  it("RS-430: 【獣拳トレーナー】2番目以外（1番目）なら「SP1」にならない（出典: atwiki/page-507「2番目に並んだとき」）", () => {
    const s = enterSeq(st({ player1: { rush: [inst("RS-430", "rt"), inst("RS-342", "y")], deck: deckCards(3) } }), ["RS-342:y"]);
    expect(spOf(s, "player1", "RS-342:y")).toBe(0);
  });
});

// ===========================================================================
describe("RS-431 黒獅子リオ", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。※これは自軍コマンドが１つ以上あるときストライクできない。【剛勇吼波】これは敵軍Sユニット1体につきBP+1000される。";

  it("RS-431: カタログ本文・スペックが出典と一致（出典: atwiki/page-506）", () => {
    expectCatalogText("RS-431", TEXT);
    expectStats("RS-431", {
      name: "黒獅子リオ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: 1,
      powerCost: 1,
      features: ["男", "臨気"],
      rushCondition: undefined,
    });
  });

  it("RS-431: ※ ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-506「これはラッシュしたターンにバトルエリアに出られない」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-431", "ri")], command: releasedCat("DA", 1), power: powerCards(1), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-431:ri");
    expect(r.ok).toBe(true);
    const t = nextPhase(resolveAll(r.state));
    expect(t.phase).toBe("battle");
    expect(canEnter(t, "RS-431:ri")).toBe(false);
  });

  it("RS-431: ※ ラッシュしたターンでなければ出られる（出典: atwiki/page-506）", () => {
    expect(canEnter(st({ player1: { rush: [inst("RS-431", "ri")], deck: deckCards(3) } }), "RS-431:ri")).toBe(true);
  });

  it("RS-431: ※ 自軍コマンドが1つ以上あるとき（リリース状態でも）ストライクできない（出典: atwiki/page-506「これは自軍コマンドが１つ以上あるときストライクできない」）", () => {
    const s = st({ player1: { battle: [inst("RS-431", "ri")], command: [released("TST-OP", "c")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    expect(canStrike(s, "RS-431:ri")).toBe(false);
  });

  it("RS-431: ※ 自軍コマンドがなければストライクできる（SP1）（出典: atwiki/page-506）", () => {
    const s = st({ player1: { battle: [inst("RS-431", "ri")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    expect(canStrike(s, "RS-431:ri")).toBe(true);
    expect(spOf(s, "player1", "RS-431:ri")).toBe(1);
  });

  it("RS-431: 【剛勇吼波】敵軍 S ユニット（バトル・ラッシュエリア）1体につき BP+1000（L ユニット・自軍 S ユニットは数えない）（出典: atwiki/page-506「これは敵軍Sユニット1体につきBP+1000される」）", () => {
    const s = st({
      player1: { battle: [inst("RS-431", "ri"), inst("TST-UNIT-0", "mine")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-7", "el")], rush: [inst("RS-341", "e2"), inst("TST-UNIT-2", "em")], deck: deckCards(3, "e") },
    });
    expect(bpOf(s, "player1", "RS-431:ri")).toBe(4000);
  });

  it("RS-431: 【剛勇吼波】敵軍 S ユニットがなければ BP2000（出典: atwiki/page-506）", () => {
    const s = st({ player1: { battle: [inst("RS-431", "ri")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "el")], deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", "RS-431:ri")).toBe(2000);
  });
});
