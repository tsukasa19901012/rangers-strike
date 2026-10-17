/**
 * カード別スペック: RS-278〜RS-284（第5弾「五龍の逆鱗」ブラックバイソン〜ホワイトスワン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）ほか card_4/card_6/rider_1/rider_2 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ZONE-08: コマンドゾーンは5枚まで）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  bpOf,
  canSkip,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  heldN,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  released,
  releasedN,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS5-264-284.helpers";
import { nextPhase, playOp, resolveAll as resolveChoices } from "./RK1-001-021.helpers";
import type { GameState } from "../types/game";

const MINUS_S = sUnit("SPEC-MINUS", { powerCost: "3-", bp: 3000 });
const FEMALE = sUnit("SPEC-F", { features: ["女"], sp: undefined });
const BIG_S = sUnit("SPEC-BIG", { bp: 5000 });
const S_3000 = sUnit("SPEC-3000", { bp: 3000 });
const S_4000 = sUnit("SPEC-4000", { bp: 4000 });
const S_4500 = sUnit("SPEC-4500", { bp: 4500 });
const SPECS = [MINUS_S, FEMALE, BIG_S, S_3000, S_4000, S_4500];

type P = Partial<GameState["players"]["player1"]>;
/** 自軍ターン（3ターン目）のバトルフェイズ。battle に pos-1 体、rush の先頭に id。 */
function ncEnter(id: string, pos: number, p1: P = {}, p2: P = {}) {
  const s = st(
    {
      turn: 3,
      player1: { battle: fillers(pos - 1), deck: deckCards(5), ...p1, rush: [inst(id, "x"), ...(p1.rush ?? [])] },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    SPECS,
  );
  return enter(s, `${id}:x`);
}

// 「※これは、自軍バトルフェイズを終えるときのバトルエリアでの並び順が、カードに表記された本来のナンバーと違うなら、自分がターンを終えるとき、手札に戻す。」
const WRONG_NUMBER_TEXT =
  "※これは、自軍バトルフェイズを終えるときのバトルエリアでの並び順が、カードに表記された本来のナンバーと違うなら、自分がターンを終えるとき、手札に戻す。";
function wrongNumberTests(id: string, cn: number, page: string) {
  it(`${id}: ※ 並び順が本来のナンバー（${cn}）と違えば、ターンを終えるとき手札に戻る（出典: ${page}「※これは…手札に戻す」）`, () => {
    let s = ncEnter(id, cn === 1 ? 2 : cn - 1);
    if (s.pendingEffectChoice) s = skip(s);
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", `${id}:x`)).toBe("hand");
  });

  it(`${id}: ※ 並び順が本来のナンバー（${cn}）と同じなら手札に戻らない（出典: ${page}「本来のナンバーと違うなら」）`, () => {
    let s = ncEnter(id, cn);
    for (let i = 0; i < 4 && s.pendingEffectChoice; i += 1) s = canSkip(s) ? skip(s) : pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", `${id}:x`)).toBe("battle");
  });
}

// ===========================================================================
describe("RS-278 ブラックバイソン", () => {
  const TEXT =
    "【バイソンロッド】「SP1」必要パワーの数字に「－」のあるユニットを1体選び撃破する。（この効果は「グリーンサイ」からコンビネーションするときはナンバーに関係なく発動する）";

  it("RS-278: カタログ本文・スペックが出典と一致（出典: atwiki/page-466）", () => {
    expectCatalogText("RS-278", TEXT);
    expectStats("RS-278", { name: "ブラックバイソン", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 2, comboNumber: 5, features: ["ブラック", "男"] });
  });

  it("RS-278: 【バイソンロッド】NC 成立（5番目）で「SP1」、必要パワーに「－」のある敵軍ユニットを1体選び撃破する（強制）（出典: atwiki/page-466【バイソンロッド】）", () => {
    let s = ncEnter("RS-278", 5, {}, { battle: [inst("SPEC-MINUS", "t"), inst("TST-UNIT-0", "n")] });
    expect(spOf(s, "player1", "RS-278:x")).toBe(1);
    expect(choiceIds(s)).toEqual(["SPEC-MINUS:t"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "SPEC-MINUS:t");
    expect(zoneOf(s, "player2", "SPEC-MINUS:t")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:n")).toBe("battle");
  });

  it("RS-278: 【バイソンロッド】必要パワーに「－」のあるユニットは敵軍に限らず選べる（自軍ユニットも候補）（出典: atwiki/page-466「必要パワーの数字に「－」のあるユニットを1体選び」— 「敵軍」の限定がない）", () => {
    const s = ncEnter("RS-278", 5, { rush: [inst("SPEC-MINUS", "own")] }, { battle: [inst("SPEC-MINUS", "t")] });
    expect(choiceIds(s)).toEqual(["SPEC-MINUS:own", "SPEC-MINUS:t"]);
  });

  it("RS-278: 【バイソンロッド】NC 不成立（4番目）では SP！のまま、撃破もしない（出典: atwiki/page-466「CN：5」・R-CN-02）", () => {
    const s = ncEnter("RS-278", 4, {}, { battle: [inst("SPEC-MINUS", "t")] });
    expect(spOf(s, "player1", "RS-278:x")).toBe(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-278");
    expect(zoneOf(s, "player2", "SPEC-MINUS:t")).toBe("battle");
  });

  // faq-card-5 RS-278 Q1 / RS-279 Q3「はい、ストライクすることができます。」
  it("RS-278: 公式Q&A — グリーンサイからコンビネーションしたときは並び位置（2番目）にかかわらず NC の効果が発動し、ストライクできる（出典: grnrngr/faq-card-5 RS-278 Q1・RS-279 Q3）", () => {
    let s = st(
      { turn: 3, player1: { rush: [inst("RS-279", "s"), inst("RS-278", "x")], deck: deckCards(5) }, player2: { battle: [inst("SPEC-MINUS", "t")], deck: deckCards(5, "e") } },
      SPECS,
    );
    s = passEntry(enter(s, "RS-279:s"));
    s = enter(s, "RS-278:x");
    expect(spOf(s, "player1", "RS-278:x")).toBe(1);
    expect(choiceIds(s)).toEqual(["SPEC-MINUS:t"]);
    s = pick(s, "SPEC-MINUS:t");
    expect(canStrike(s, "RS-278:x")).toBe(true);
  });

  it("RS-278: グリーンサイ以外のユニットから2番目に出たときは NC は発動しない（出典: atwiki/page-466「「グリーンサイ」からコンビネーションするときは」）", () => {
    const s = ncEnter("RS-278", 2, {}, { battle: [inst("SPEC-MINUS", "t")] });
    expect(spOf(s, "player1", "RS-278:x")).toBe(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-278");
  });

  // faq-card-6 RS-418 Q「はい、できます。」
  it.todo(
    "RS-278: 公式Q&A — グリーンサイからナンバーに関係なく発動させた NC の効果も、冥府神イフリート（RS-418）【炎の眼光】で無効にできる（出典: grnrngr/faq-card-6 RS-418）— 敵軍ターン中にこのユニットを出す側の視点（イフリートの持ち主の常駐置き場の扱い）を公開 API で再現する手順が確立していないため",
  );
});

// ===========================================================================
describe("RS-279 グリーンサイ", () => {
  const TEXT = "【サイカッター】このターン、BP4000以下の敵軍ユニットが新しくラッシュされたとき、それを撃破する。";

  it("RS-279: カタログ本文・スペックが出典と一致（出典: atwiki/page-467）", () => {
    expectCatalogText("RS-279", TEXT);
    expectStats("RS-279", { name: "グリーンサイ", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: 1, features: ["グリーン", "男"] });
  });

  /** サイ（pos 番目）→ つなぎ → ホワイトスワン（3番目、NC）で敵軍コマンドゾーンの S ユニットを敵軍ラッシュエリアに出す。 */
  function saiSwan(enemyCommand: ReturnType<typeof held>[], opts: { saiPos?: number; p2?: P } = {}) {
    const saiPos = opts.saiPos ?? 1;
    const rush = saiPos === 1 ? [inst("RS-279", "s"), inst("TST-UNIT-0", "m"), inst("RS-284", "w")] : [inst("TST-UNIT-0", "m"), inst("RS-279", "s"), inst("RS-284", "w")];
    let s = st({ turn: 3, player1: { rush, deck: deckCards(5) }, player2: { command: enemyCommand, deck: deckCards(5, "e"), ...opts.p2 } }, SPECS);
    s = passEntry(enter(s, rush[0]!.instanceId));
    s = passEntry(enter(s, rush[1]!.instanceId));
    s = enter(s, "RS-284:w");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "swan_wing_deploy_enemy_command_s" });
    for (let i = 0; i < 6 && s.pendingEffectChoice?.effectId === "swan_wing_order"; i += 1) {
      s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    return s;
  }

  it("RS-279: 【サイカッター】NC 成立後、このターン新しくラッシュされた BP4000 以下の敵軍ユニットを撃破する（BP4000 ちょうども含む）（出典: atwiki/page-467【サイカッター】・rider_1 RK-005 Q）", () => {
    const s = saiSwan([held("TST-UNIT-0", "u1"), held("SPEC-4000", "u4")]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:u1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-4000:u4")).toBe("discard");
  });

  it("RS-279: 【サイカッター】BP4000 を超える敵軍ユニットは撃破しない（出典: atwiki/page-467「BP4000以下の」）", () => {
    const s = saiSwan([held("SPEC-4500", "u45"), held("SPEC-BIG", "big")]);
    expect(zoneOf(s, "player2", "SPEC-4500:u45")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-BIG:big")).toBe("rush");
  });

  it("RS-279: 【サイカッター】NC 不成立（2番目）では撃破しない（出典: atwiki/page-467「CN：1」・R-CN-02）", () => {
    const s = saiSwan([held("TST-UNIT-0", "u1")], { saiPos: 2 });
    expect(zoneOf(s, "player2", "TST-UNIT-0:u1")).toBe("rush");
  });

  it("RS-279: 【サイカッター】「このターン」だけ。次の敵軍ターンに相手がラッシュした BP4000 以下のユニットは撃破されない（出典: atwiki/page-467「このターン」）", () => {
    let s = ncEnter("RS-279", 1, {}, { hand: [inst("TST-UNIT-0", "next")], command: [released("TST-OP", "c")], power: powerCards(2, "q") });
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    for (let i = 0; i < 6 && s.phase !== "rush"; i += 1) {
      const a = legal(s).find((x) => ["draw", "release_start_commands", "skip_bonus_draw", "end_phase", "return_all_battle_to_rush"].includes(x.type));
      if (!a) break;
      s = act(s, a);
    }
    expect(s.phase).toBe("rush");
    const rushAct = legal(s).find(
      (a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === "TST-UNIT-0:next") || (a.type === "rush" && a.instanceId === "TST-UNIT-0:next"),
    );
    expect(rushAct).toBeDefined();
    s = act(s, rushAct!);
    for (let i = 0; i < 3; i += 1) {
      const pass = legal(s).find((a) => a.type === "pass_rush_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(zoneOf(s, "player2", "TST-UNIT-0:next")).toBe("rush");
  });

  // faq-card-5 RS-279 Q1「…ターンプレイヤーである相手が「RS-279 グリーンサイ」の能力による撃破を先に処理することにすれば、「RS-026 疾風流超忍法」は対象を失い無効となります。」
  it("RS-279: 公式Q&A — サイカッターと疾風流超忍法が同時のとき、ターンプレイヤーが撃破を先に処理すれば、疾風流超忍法は対象を失う（ユニットは捨札）（出典: grnrngr/faq-card-5 RS-279 Q1）", () => {
    const s = saiSwan([held("TST-UNIT-0", "u1")], { p2: { hand: [inst("RS-026", "sp")], power: powerCards(4, "q"), command: [held("TST-UNIT-0", "u1"), ...releasedN(3, "TST-OP-MA", "ma")] } });
    expect(zoneOf(s, "player2", "TST-UNIT-0:u1")).toBe("discard");
    expect(s.players.player2.deck.some((c) => c.instanceId === "TST-UNIT-0:u1")).toBe(false);
  });

  // 旧スペック「疾風流超忍法を先に処理することも選べ、そのときユニットは山札の上に戻る」は、ターンプレイヤー（サイカッター側）の
  // 選択なしに非ターンプレイヤーの望む順で処理されることを期待しており、直前のスペック（同じ盤面で撃破が先＝捨札）と矛盾していた。
  // 出典 faq-card-5 RS-279 Q1・atwiki/page-467 A1 は「処理順はターンプレイヤーが決定」「ターンプレイヤーである相手が…撃破を先に処理
  // することにすれば、疾風流超忍法は対象を失い無効」と答えており、非ターンプレイヤーが順番を決めることはない。出典どおりに修正した。
  it("RS-279: 公式Q&A — 処理順は非ターンプレイヤーではなくターンプレイヤーが決める（撃破が先に処理され、疾風流超忍法は対象を失いユニットは山札の上に戻らない）（出典: grnrngr/faq-card-5 RS-279 Q1「同時に発動した効果の処理順はターンプレイヤーが決定」・atwiki/page-467 A1）", () => {
    let s = saiSwan([], { p2: { hand: [inst("RS-026", "sp")], power: powerCards(4, "q"), command: [held("TST-UNIT-0", "u1"), ...releasedN(3, "TST-OP-MA", "ma")] } });
    expect(zoneOf(s, "player2", "TST-UNIT-0:u1")).toBe("discard");
    const use = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-026:sp");
    if (use) {
      s = act(s, use);
      for (let i = 0; i < 4 && s.pendingEffectChoice; i += 1) s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    expect(s.players.player2.deck.some((c) => c.instanceId === "TST-UNIT-0:u1")).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-0:u1")).toBe("discard");
  });

  // faq-card-5 RS-279 Q2「はい、撃破できます。」
  it("RS-279: 公式Q&A — サイカッター発動後にダイナロボ【ビートハンマー】で敵軍コマンドゾーンから敵軍バトルエリアに出した BP4000 以下のユニットも撃破する（出典: grnrngr/faq-card-5 RS-279 Q2）", () => {
    let s = ncEnter("RS-279", 1, { rush: [inst("RS-194", "dr")] }, { command: [held("SPEC-3000", "u3")] });
    s = passEntry(s);
    s = enter(s, "RS-194:dr");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId === "RS-194"; i += 1) s = pick(s, "SPEC-3000:u3");
    expect(zoneOf(s, "player2", "SPEC-3000:u3")).toBe("discard");
  });

  // rider_1 RK-005 Q「「RS-279 グリーンサイ」に使用してください。…実際に撃破する効果を持っているのが「RS-279 グリーンサイ」だから」
  it.todo(
    "RS-279: 公式Q&A — スワンウィングで出させたユニットをサイカッターで撃破したとき、超電子ダイナモ（RK-005）はグリーンサイに使っていれば相手に1点ダメージ（出典: grnrngr/faq-rider_1 RK-005）— グリーンサイは特徴「改造人間」を持たず RK-005 の対象にできないため、この Q&A の前提を再現できない",
  );
});

// ===========================================================================
describe("RS-280 レッドホーク", () => {
  const TEXT = `${WRONG_NUMBER_TEXT}【ウィングガントレット】「SP1」自軍ターン中、これはBP＋2000される。`;

  it("RS-280: カタログ本文・スペックが出典と一致（出典: atwiki/page-468）", () => {
    expectCatalogText("RS-280", TEXT);
    expectStats("RS-280", { name: "レッドホーク", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 2, comboNumber: 5, features: ["レッド", "男"] });
  });

  it("RS-280: 【ウィングガントレット】5番目に出て NC が成立すると「SP1」（出典: atwiki/page-468「CN：5」「SP1」）", () => {
    const s = ncEnter("RS-280", 5);
    expect(spOf(s, "player1", "RS-280:x")).toBe(1);
    expect(canStrike(s, "RS-280:x")).toBe(true);
  });

  it("RS-280: 【ウィングガントレット】NC 成立時、自軍ターン中は BP＋2000（4000）（出典: atwiki/page-468「自軍ターン中、これはBP＋2000される」）", () => {
    expect(bpOf(ncEnter("RS-280", 5), "player1", "RS-280:x")).toBe(4000);
  });

  it("RS-280: 【ウィングガントレット】敵軍ターン中は BP＋2000 されない（出典: atwiki/page-468「自軍ターン中」）", () => {
    let s = ncEnter("RS-280", 5);
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "RS-280:x")).toBe("battle");
    expect(bpOf(s, "player1", "RS-280:x")).toBe(2000);
  });

  it("RS-280: NC 不成立（4番目）では SP！のまま、BP も2000（出典: atwiki/page-468「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RS-280", 4);
    expect(spOf(s, "player1", "RS-280:x")).toBe(0);
    expect(bpOf(s, "player1", "RS-280:x")).toBe(2000);
  });

  wrongNumberTests("RS-280", 5, "atwiki/page-468");

  // faq-card-4 RS-208 Q「はい、発動します。現在のフェイズから別のフェイズに移るときには、もれなくフェイズを終えてから移っていると考えてください。」
  it.todo(
    "RS-280: 公式Q&A — キリンレンジャー【天時星・時間返し】でラッシュフェイズからやり直すときも『バトルフェイズを終えるとき』の効果は発動する（出典: grnrngr/faq-card-4 RS-208）— 時間返しのやり直し中のバトルフェイズ終了時点を公開状態から区別して観測できないため",
  );
  // faq-rider_2 RK-079 Q「…「カードに表記された本来のナンバー」を参照しますので、ナンバーがRCになっていたとしても適用されることになります。」
  it.fails("RS-280: 公式Q&A — 仮面ライダーの称号（RK-079）でナンバーが RC になっていても、本来のナンバーと並び順が違えば手札に戻る（出典: grnrngr/faq-rider_2 RK-079）", () => {
    let s = st({ phase: "rush", player1: { hand: [inst("RK-079", "tt")], rush: [inst("RS-280", "x")], command: [released("TST-OP-ET", "c")], power: powerCards(5), deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } });
    const r = playOp(s, "player1", "RK-079:tt");
    expect(r.ok, r.error).toBe(true);
    s = resolveChoices(r.state, ["RS-280:x"]);
    // RK-079 がレッドホークの下に重なっている（ナンバーが RC になっている）状態で出す。
    expect((s.players.player1.rush.find((c) => c.instanceId === "RS-280:x")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["RK-079:tt"]);
    s = enter(nextPhase(s), "RS-280:x");
    s = endTurn(passEntry(s));
    expect(zoneOf(s, "player1", "RS-280:x")).toBe("hand");
    expect(zoneOf(s, "player1", "RK-079:tt")).toBe("discard");
  });
  // faq-card-6 RS-393 Q「はい、その通りです。」
  it.todo(
    "RS-280: 公式Q&A — コマンドアタッカー（RS-393）にライドしたレッドホークが1番目に並んだときは手札に戻り、ビークルはバトルエリアに残る（出典: grnrngr/faq-card-6 RS-393）— ビークルへのライド手順をこの範囲のテストで構築していないため",
  );
});

// ===========================================================================
describe("RS-281 ブラックコンドル", () => {
  const TEXT =
    "※自分がターンを終えるとき、特徴「女」を持つユニットが1体もなければ、このユニットを手札に戻す。【俺に惚れろ！】自軍ラッシュエリアに特徴「女」を持つユニットが2体以上あれば、このターン、これは「SP1」になる。";

  it("RS-281: カタログ本文・スペックが出典と一致（出典: atwiki/page-469）", () => {
    expectCatalogText("RS-281", TEXT);
    expectStats("RS-281", { name: "ブラックコンドル", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 3, features: ["ブラック", "男"] });
  });

  it("RS-281: 【俺に惚れろ！】NC 成立（3番目）・自軍ラッシュエリアに特徴「女」2体以上で「SP1」（出典: atwiki/page-469【俺に惚れろ！】）", () => {
    const s = ncEnter("RS-281", 3, { rush: [inst("SPEC-F", "f1"), inst("SPEC-F", "f2")] });
    expect(spOf(s, "player1", "RS-281:x")).toBe(1);
    expect(canStrike(s, "RS-281:x")).toBe(true);
  });

  it("RS-281: 【俺に惚れろ！】特徴「女」が1体だけなら SP！のまま（出典: atwiki/page-469「2体以上あれば」）", () => {
    const s = ncEnter("RS-281", 3, { rush: [inst("SPEC-F", "f1")] });
    expect(spOf(s, "player1", "RS-281:x")).toBe(0);
  });

  it("RS-281: 【俺に惚れろ！】NC 不成立（2番目）では特徴「女」が2体以上あっても SP！のまま（出典: atwiki/page-469「CN：3」・R-CN-02）", () => {
    const s = ncEnter("RS-281", 2, { rush: [inst("SPEC-F", "f1"), inst("SPEC-F", "f2")] });
    expect(spOf(s, "player1", "RS-281:x")).toBe(0);
  });

  it("RS-281: ※ ターンを終えるとき特徴「女」を持つユニットが1体もなければ手札に戻る（出典: atwiki/page-469「※自分がターンを終えるとき…手札に戻す」）", () => {
    let s = ncEnter("RS-281", 3);
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "RS-281:x")).toBe("hand");
  });

  it("RS-281: ※ 自軍に特徴「女」を持つユニットがあれば手札に戻らない（出典: atwiki/page-469「1体もなければ」）", () => {
    let s = ncEnter("RS-281", 3, { rush: [inst("SPEC-F", "f1")] });
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "RS-281:x")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-282 イエローオウル", () => {
  const TEXT = `${WRONG_NUMBER_TEXT}【岩石落とし】BP2000以下の敵軍ユニットをすべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。`;

  it("RS-282: カタログ本文・スペックが出典と一致（出典: atwiki/page-470）", () => {
    expectCatalogText("RS-282", TEXT);
    expectStats("RS-282", { name: "イエローオウル", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 2, comboNumber: 4, features: ["イエロー", "男"] });
  });

  it("RS-282: 【岩石落とし】NC 成立（4番目）で、BP2000 以下の敵軍ユニット（バトルエリア・ラッシュエリア）をすべて持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-470【岩石落とし】）", () => {
    const s = ncEnter("RS-282", 4, {}, { battle: [inst("TST-UNIT-0", "a"), inst("SPEC-3000", "big")], rush: [inst("TST-UNIT-0", "r")] });
    const cmd = s.players.player2.command;
    expect(cmd.find((c) => c.instanceId === "TST-UNIT-0:a")?.commandHeld).toBe(true);
    expect(cmd.find((c) => c.instanceId === "TST-UNIT-0:r")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-3000:big")).toBe("battle");
  });

  it("RS-282: 【岩石落とし】NC 不成立（3番目）では何も起きない（出典: atwiki/page-470「CN：4」・R-CN-02）", () => {
    const s = ncEnter("RS-282", 3, {}, { battle: [inst("TST-UNIT-0", "a")] });
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("battle");
  });

  it("RS-282: 【岩石落とし】自軍ユニットは BP2000 以下でも対象にならない（出典: atwiki/page-470「敵軍ユニット」）", () => {
    const s = ncEnter("RS-282", 4, { rush: [inst("TST-UNIT-0", "own")] }, { battle: [inst("TST-UNIT-0", "a")] });
    expect(zoneOf(s, "player1", "TST-UNIT-0:own")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("battle");
  });

  it("RS-282: 【岩石落とし】コマンドゾーンに置けない（5枚）ときは捨札にする（出典: atwiki/page-470「置けなければ捨札にする」・R-ZONE-08）", () => {
    const s = ncEnter("RS-282", 4, {}, { battle: [inst("TST-UNIT-0", "a")], command: heldN(5, "TST-OP", "c") });
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
  });

  wrongNumberTests("RS-282", 4, "atwiki/page-470");

  // faq-card-5 RS-282 Q1「その場合、選ぶ権利はターンプレイヤーである「イエローオウル」の持ち主にあります。」
  it("RS-282: 公式Q&A — 2体のうち1体しか置けないとき、捨札にするユニットはターンプレイヤー（イエローオウルの持ち主）が選ぶ（出典: grnrngr/faq-card-5 RS-282 Q1）", () => {
    let s = ncEnter("RS-282", 4, {}, { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")], command: heldN(4, "TST-OP", "c") });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b"]);
    s = pick(s, "TST-UNIT-0:b");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("command");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b")).toBe("discard");
  });

  // faq-card-5 RS-282 Q2「はい、対象になります。…「選ばれない」と書かれていても対象になります。」
  it("RS-282: 公式Q&A — 「アタックされる以外では相手に選ばれない」ユニット（仮面ライダーガタックRF）も、BP2000 以下なら岩石落としの対象になる（出典: grnrngr/faq-card-5 RS-282 Q2）", () => {
    // RK-054 仮面ライダーガタックRF は BP2000・S ユニット
    const s = ncEnter("RS-282", 4, {}, { battle: [inst("RK-054", "gt")] });
    expect(zoneOf(s, "player2", "RK-054:gt")).toBe("command");
  });

  // faq-card-5 RS-282 Q3「はい、間違いありません。」
  it("RS-282: 公式Q&A — 対象は修正後の BP で判定する（BP3000 でも修正で 2000 以下なら対象）（出典: grnrngr/faq-card-5 RS-282 Q3）", () => {
    // ファイブマン・フラッシュマン系の BP 修正は未実装のため、ターン開始前から有効な修正としてフラッシュマン（BP5500、非OTコマンドで減る）を使う
    const s = ncEnter("RS-282", 4, {}, { battle: [inst("RS-270", "pink")], command: releasedN(4, "TST-OP", "c") });
    expect(zoneOf(s, "player2", "RS-270:pink")).toBe("command");
  });

  // faq-rider_1 RK-044 Q「いいえ、発動しません。…それは撃破されたことにはなりませんので」
  it.todo(
    "RS-282: 公式Q&A — 岩石落としで捨札になったライオトルーパーは「撃破されて捨札になった」ことにならない（出典: grnrngr/faq-rider_1 RK-044）— 【岩石落とし】自体が未実装で捨札に送る処理を起こせないため",
  );
});

// ===========================================================================
describe("RS-283 ブルースワロー", () => {
  const TEXT = `${WRONG_NUMBER_TEXT}【ブリンガーソード】「SP1」`;

  it("RS-283: カタログ本文・スペックが出典と一致（出典: atwiki/page-471）", () => {
    expectCatalogText("RS-283", TEXT);
    expectStats("RS-283", { name: "ブルースワロー", category: "ET", size: "S", bp: 500, sp: "special", powerCost: 1, comboNumber: 5, features: ["ブルー", "女"] });
  });

  it("RS-283: 【ブリンガーソード】5番目に出て NC が成立すると「SP1」（出典: atwiki/page-471「CN：5」「SP1」）", () => {
    const s = ncEnter("RS-283", 5);
    expect(spOf(s, "player1", "RS-283:x")).toBe(1);
    expect(canStrike(s, "RS-283:x")).toBe(true);
  });

  it("RS-283: NC 不成立（4番目）では SP！のまま（出典: atwiki/page-471「SP：！」・R-CN-02）", () => {
    expect(spOf(ncEnter("RS-283", 4), "player1", "RS-283:x")).toBe(0);
  });

  wrongNumberTests("RS-283", 5, "atwiki/page-471");
});

// ===========================================================================
describe("RS-284 ホワイトスワン", () => {
  const TEXT = `${WRONG_NUMBER_TEXT}【スワンウィング】敵軍コマンドゾーンにあるSユニットのカードをすべてラッシュエリアに出してもよい。`;

  it("RS-284: カタログ本文・スペックが出典と一致（出典: atwiki/page-472）", () => {
    expectCatalogText("RS-284", TEXT);
    expectStats("RS-284", { name: "ホワイトスワン", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: 3, features: ["ホワイト", "女"] });
  });

  const enemyCmd = () => [held("TST-UNIT-0", "s1"), released("SPEC-BIG", "s2"), held("TST-UNIT-2", "m"), held("TST-OP", "op")];

  it("RS-284: 【スワンウィング】NC 成立（3番目）で、敵軍コマンドゾーンの S ユニットのカードをすべて敵軍ラッシュエリアに出す（M ユニット・オペレーションは残る）（出典: atwiki/page-472【スワンウィング】）", () => {
    let s = ncEnter("RS-284", 3, {}, { command: enemyCmd() });
    expect(canSkip(s)).toBe(true);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: s.pendingEffectChoice!.validInstanceIds[0]! });
    for (let i = 0; i < 6 && s.pendingEffectChoice?.effectId === "swan_wing_order"; i += 1) s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-BIG:s2")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("command");
    expect(zoneOf(s, "player2", "TST-OP:op")).toBe("command");
    expect(s.players.player1.rush.some((c) => c.instanceId.startsWith("TST-UNIT-0:s1"))).toBe(false);
  });

  it("RS-284: 【スワンウィング】「出してもよい」ので見送れる（出典: atwiki/page-472「出してもよい」）", () => {
    let s = ncEnter("RS-284", 3, {}, { command: enemyCmd() });
    s = skip(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("command");
  });

  it("RS-284: 【スワンウィング】NC 不成立（2番目）では発動しない（出典: atwiki/page-472「CN：3」・R-CN-02）", () => {
    const s = ncEnter("RS-284", 2, {}, { command: enemyCmd() });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-284");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("command");
  });

  wrongNumberTests("RS-284", 3, "atwiki/page-472");
});
