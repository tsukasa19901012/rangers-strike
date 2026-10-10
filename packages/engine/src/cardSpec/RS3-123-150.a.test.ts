/**
 * カード別スペック: RS-123〜RS-131（第3弾「三界の獅子」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（第3弾 RS-123〜150 に修正はない）、grnrngr/faq-card-3
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_3.html）と card_1/2/4/5/6/7 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当なし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canSkip,
  canStrike,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  drain,
  enter,
  expectCatalogText,
  expectOpStats,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  ncLogged,
  nextPhase,
  pick,
  powerCards,
  released,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  tryAct,
  useCard,
  canUseCard,
  advanceToBattle,
  zoneOf,
} from "./RS3-123-150.helpers";
import type { GameState } from "../types/game";

// ===========================================================================
describe("RS-123 スーパーダイナマイト", () => {
  const TEXT =
    "このターン、すべての自軍Sユニットは次の能力を得る。⇒アタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。";
  const S2K = sUnit("SPEC-S2K", { bp: 2000 });
  const M2K = sUnit("SPEC-M2K", { bp: 2000, size: "M" });

  /** ラッシュフェイズにスーパーダイナマイトを使い（use=false なら使わず）、バトルフェイズへ進む。 */
  function dynamite(use: boolean, attackerId = "SPEC-S2K"): GameState {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-123", "dy")],
          battle: [inst(attackerId, "atk")],
          command: [released("TST-OP-ET", "et")],
          power: powerCards(3),
        },
        // 本来 BP1000、補正 +3000 で BP4000 の敵軍ユニット
        player2: { battle: [{ ...inst("TST-UNIT-0", "def"), bpModifier: 3000 }] },
      },
      [S2K, M2K],
    );
    if (use) s = useCard(s, "player1", "RS-123:dy");
    return nextPhase(s);
  }

  // atwiki/page-349「テキスト：このターン、すべての自軍Sユニットは次の能力を得る。⇒…」
  it("RS-123: カタログ本文・スペックが出典と一致（出典: atwiki/page-349）", () => {
    expectCatalogText("RS-123", TEXT);
    expectOpStats("RS-123", { name: "スーパーダイナマイト", category: "ET", powerCost: 3 });
  });

  it("RS-123: 必要パワー3 — パワー2枚では使えない（出典: atwiki/page-349「必要パワー：3」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-123", "dy")], command: [released("TST-OP-ET", "et")], power: powerCards(2) },
    });
    expect(canUseCard(s, "player1", "RS-123:dy")).toBe(false);
  });

  // 「アタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」
  it("RS-123: 使用したターン、自軍Sユニットがアタックすると敵軍ユニットは本来のBP（補正なし）でバトルする（出典: atwiki/page-349）", () => {
    const s = settle(attack(dynamite(true), "SPEC-S2K:atk", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-S2K:atk")).toBe("battle");
  });

  it("RS-123: 使わなければ補正後の BP でバトルする（対照）（出典: atwiki/page-349）", () => {
    const s = settle(attack(dynamite(false), "SPEC-S2K:atk", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-S2K:atk")).toBe("discard");
  });

  // 「すべての自軍Sユニットは」
  it("RS-123: 自軍 M ユニットのアタックには効果がない（出典: atwiki/page-349「自軍Sユニット」）", () => {
    const s = settle(attack(dynamite(true, "SPEC-M2K"), "SPEC-M2K:atk", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player1", "SPEC-M2K:atk")).toBe("discard");
  });

  // 「このターン」
  it("RS-123: 効果は「このターン」だけ — 次の相手ターンに相手のアタックを受けても補正後の BP でバトルする（出典: atwiki/page-349）", () => {
    let s = advanceToBattle(dynamite(true), "player2");
    s = {
      ...s,
      players: {
        player1: { ...s.players.player1, rush: [], battle: [inst("SPEC-S2K", "atk")] },
        player2: { ...s.players.player2, rush: [], battle: [{ ...inst("TST-UNIT-0", "def"), bpModifier: 3000 }] },
      },
    };
    s = settle(attack(s, "TST-UNIT-0:def", "SPEC-S2K:atk", "player2"));
    expect(zoneOf(s, "player1", "SPEC-S2K:atk")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-124 超電子レーダー", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分も相手も次の制限を受ける。Sユニットをラッシュしたとき、そのユニットの持ち主は、パワーゾーンにダメージ以外のカードがあれば1枚選んで手札に戻す。";
  const S1 = sUnit("SPEC-S1", { powerCost: 0 });
  const M1 = sUnit("SPEC-M1", { powerCost: 0, size: "M" });

  function radarRush(unitId: string, power = powerCards(2), opts: { radarOwner?: "player1" | "player2" } = {}) {
    const radar = [inst("RS-124", "radar")];
    const s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst(unitId, "u")],
          command: [released("TST-OP", "c")],
          power,
          operation: opts.radarOwner === "player2" ? [] : radar,
        },
        player2: { operation: opts.radarOwner === "player2" ? radar : [] },
      },
      [S1, M1],
    );
    return rushFromHand(s, "player1", `${unitId}:u`);
  }

  it("RS-124: カタログ本文・スペックが出典と一致（出典: atwiki/page-362）", () => {
    expectCatalogText("RS-124", TEXT);
    expectOpStats("RS-124", { name: "超電子レーダー", category: "OT", powerCost: 4 });
  });

  // 「※常駐（場に配置して、離れるまで効果が有効になる）」
  it("RS-124: 使用すると常駐置き場に配置される（出典: atwiki/page-362「※常駐」）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-124", "radar")], command: [released("TST-OP-OT", "ot")], power: powerCards(4) },
    });
    s = useCard(s, "player1", "RS-124:radar");
    expect(zoneOf(s, "player1", "RS-124:radar")).toBe("operation");
  });

  // 「Sユニットをラッシュしたとき、そのユニットの持ち主は、パワーゾーンにダメージ以外のカードがあれば1枚選んで手札に戻す」
  it("RS-124: S ユニットをラッシュすると、持ち主はダメージ以外のパワーを1枚手札に戻す（出典: atwiki/page-362）", () => {
    let r = radarRush("SPEC-S1", [...damageCards(1), ...powerCards(2)]);
    expect(r.ok).toBe(true);
    const s = drain(r.state, "player1");
    expect(s.players.player1.power).toHaveLength(2);
    expect(s.players.player1.hand.map((c) => c.instanceId)).toEqual(expect.arrayContaining([expect.stringMatching(/^TST-P:pw/)]));
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(1);
  });

  it("RS-124: 「自分も相手も」— 相手が配置したレーダーでも制限を受ける（出典: atwiki/page-362）", () => {
    const s = drain(radarRush("SPEC-S1", powerCards(2), { radarOwner: "player2" }).state, "player1");
    expect(s.players.player1.power).toHaveLength(1);
    expect(s.players.player1.hand).toHaveLength(1);
  });

  it("RS-124: M ユニットのラッシュでは戻さない（出典: atwiki/page-362「Sユニットを」）", () => {
    const s = radarRush("SPEC-M1").state;
    expect(s.players.player1.power).toHaveLength(2);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-124: パワーがダメージだけなら何もしない（出典: atwiki/page-362「ダメージ以外のカードがあれば」）", () => {
    const s = radarRush("SPEC-S1", damageCards(2)).state;
    expect(s.players.player1.power).toHaveLength(2);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.fails("RS-124: 戻すカードは持ち主が選ぶ（出典: atwiki/page-362「1枚選んで」）", () => {
    // 既知の不具合: CARD-RS-124 戻すパワーを選ばせず、先頭のオモテ向きカードを自動で手札に戻す
    const r = radarRush("SPEC-S1", powerCards(2));
    expect(choiceIds(r.state)).toEqual(["TST-P:pw0", "TST-P:pw1"]);
    const s = pick(r.state, "TST-P:pw1");
    expect(zoneOf(s, "player1", "TST-P:pw1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("power");
  });

  // faq-card-3 RS-124 Q1「その合体ユニットであるＳユニットを捨札からバトルエリアに１体出すたび…はい、その通りです。」
  it.fails("RS-124: 公式Q&A — パワーバズーカで撃破された合体ユニットの S ユニットを捨札からバトルエリアに出すと、その持ち主はパワーを1枚戻す（出典: grnrngr/faq-card-3 RS-124 Q1）", () => {
    // 既知の不具合: CARD-RS-124 S ユニットがラッシュエリアを経ずに直接バトルエリアに出された（ラッシュされた）ときにレーダーの処理をしない
    // RS-112 ウルカイザー（合体―ウルザード（S）＋バリキオン）を RS-009 パワーバズーカで撃破する
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-009", "bz")],
        power: powerCards(8),
        command: [released("TST-OP-ET", "et")],
        operation: [inst("RS-124", "radar")],
      },
      player2: {
        battle: [{ ...inst("RS-112", "ulk"), zordMaterialCardId: "RS-115" }],
        discard: [inst("RS-115", "urz")],
        power: powerCards(2, "ep"),
      },
    });
    const play = legal(s).find(
      (a) =>
        (a.type === "play_operation" || a.type === "initiate_command_payment") &&
        (a as { targetInstanceId?: string }).targetInstanceId === "RS-112:ulk",
    );
    expect(play).toBeDefined();
    s = act(s, play!);
    for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player2"), "player1"));
    expect(zoneOf(s, "player2", "RS-112:ulk")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-115:urz")).toBe("battle");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  // faq-card-3 RS-124 Q2「はい、その通りです。」（ガロア艦長の古傷の因縁）
  it.fails("RS-124: 公式Q&A — ガロア艦長の【古傷の因縁】で敵軍ラッシュエリアに出された S ユニットの持ち主（相手）がパワーを戻す（出典: grnrngr/faq-card-3 RS-124 Q2）", () => {
    // 既知の不具合: CARD-RS-124 Q2 の状況を再現できない — RS-277【古傷の因縁】の選択（unitDestination "rush"）がバトルエリアのユニットしか受け付けず、敵軍コマンドゾーンのカードを選べない
    const RED = sUnit("SPEC-RED", { features: ["レッド"] });
    let s = st(
      {
        player1: { rush: [inst("RS-277", "garoa")], operation: [inst("RS-124", "radar")] },
        player2: { command: [released("SPEC-RED", "red")], power: powerCards(2, "ep") },
      },
      [RED],
    );
    s = enter(s, "RS-277:garoa");
    s = drain(s, "player1", ["SPEC-RED:red"]);
    s = settle(drain(s, "player2"));
    expect(zoneOf(s, "player2", "SPEC-RED:red")).toBe("rush");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  // faq-card-3 RS-124 Q3「はい、その通りです。」（ダイナロボで敵軍バトルエリアに出す）
  it.fails("RS-124: 公式Q&A — ダイナロボの効果で敵軍コマンドゾーンから S ユニットをバトルエリアに出したときも相手がパワーを戻す（出典: grnrngr/faq-card-3 RS-124 Q3）", () => {
    // 既知の不具合: CARD-RS-124 S ユニットがラッシュエリアを経ずに直接バトルエリアに出された（ラッシュされた）ときにレーダーの処理をしない
    let s = st({
      player1: { rush: [inst("RS-194", "dyna")], operation: [inst("RS-124", "radar")] },
      player2: { command: [released("TST-UNIT-0", "s")], power: powerCards(2, "ep") },
    });
    s = enter(s, "RS-194:dyna");
    s = drain(s, "player1", ["TST-UNIT-0:s"]);
    s = settle(drain(s, "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("battle");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  // faq-card-3 RS-124 Q4「はい、その通りです。」（アバレッドAM撃破→捨札のアバレッドをラッシュエリアへ）
  it("RS-124: 公式Q&A — アバレッドAM が撃破され、捨札のアバレッドをラッシュエリアに出したとき、持ち主はパワーを戻す（出典: grnrngr/faq-card-3 RS-124 Q4）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "big")], operation: [inst("RS-124", "radar")] },
      player2: {
        battle: [inst("RS-230", "am")],
        discard: [inst("RS-054", "aba")],
        power: powerCards(2, "ep"),
      },
    });
    s = attack(s, "TST-UNIT-7:big", "RS-230:am");
    for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player2"), "player1"));
    expect(zoneOf(s, "player2", "RS-054:aba")).toBe("rush");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  // faq-card-3 RS-124 Q5「ラッシュに誘発した処理…をすべて完了させてから「RS-026 疾風流超忍法」を実行してください」
  it("RS-124: 公式Q&A — レーダーでパワーを手札に戻した後で、相手は疾風流超忍法を使える（出典: grnrngr/faq-card-3 RS-124 Q5）", () => {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("SPEC-S1", "u")],
          command: [released("TST-OP", "c")],
          power: powerCards(2),
          operation: [inst("RS-124", "radar")],
        },
        player2: { hand: [inst("RS-026", "ctr")], command: [released("TST-OP-MA", "ma")], power: powerCards(3, "ep") },
      },
      [S1],
    );
    s = drain(rushFromHand(s, "player1", "SPEC-S1:u", { noPass: true }).state, "player1");
    expect(s.players.player1.hand).toHaveLength(1);
    expect(canUseCard(s, "player2", "RS-026:ctr")).toBe(true);
  });

  // faq-card-3 RS-124 Q6「ターンプレイヤーが望む順で処理します」
  it("RS-124: 公式Q&A — 冥王ジルフィーザと同時に発動したら、ターンプレイヤーが処理順を選ぶ（出典: grnrngr/faq-card-3 RS-124 Q6）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-092", "zil")],
        rush: fillers(3),
        command: [released("TST-OP-DA", "da")],
        power: powerCards(9),
        operation: [inst("RS-124", "radar")],
      },
    });
    s = rushFromHand(s, "player1", "RS-092:zil", {
      materials: ["TST-UNIT-0:fill0", "TST-UNIT-0:fill1", "TST-UNIT-0:fill2"],
    }).state;
    expect(s.pendingEffectChoice?.kind).toBe("simultaneous_order");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-092:zil", "super_radar"]);
  });

  // faq-card-3 RS-124 Q7「はい、その通りです。」（ゴーゴードーザーの遺跡発掘）
  it("RS-124: 公式Q&A — ゴーゴードーザーの【遺跡発掘】で相手がコマンドゾーンの S ユニットをラッシュエリアに出したら、相手がパワーを戻す（出典: grnrngr/faq-card-3 RS-124 Q7）", () => {
    let s = st({
      player1: { rush: [inst("RS-121", "dz")], operation: [inst("RS-124", "radar")] },
      player2: { command: [released("TST-UNIT-0", "s")], power: powerCards(2, "ep") },
    });
    s = enter(s, "RS-121:dz");
    s = settle(drain(s, "player2", ["TST-UNIT-0:s"]));
    s = settle(drain(s, "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("rush");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  // faq-card-4（RS-241 の項）「はい、その通りです。」（ボウケンレッドAT 撃破→ボウケンレッドをラッシュエリアへ）
  it.fails("RS-124: 公式Q&A — ボウケンレッドAT が撃破され、捨札のボウケンレッドをラッシュエリアに出したとき、持ち主はパワーを戻す（出典: grnrngr/faq-card-4 RS-241）", () => {
    // 既知の不具合: CARD-RS-124 faq-card-4 の状況を再現できない — RS-241 ボウケンレッドAT が撃破されて捨札になっても捨札のボウケンレッドをラッシュエリアに出さない
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "big")], operation: [inst("RS-124", "radar")] },
      player2: {
        battle: [inst("RS-241", "at")],
        discard: [inst("RS-062", "bk")],
        power: powerCards(2, "ep"),
      },
    });
    s = attack(s, "TST-UNIT-7:big", "RS-241:at");
    for (let i = 0; i < 6; i++) s = settle(drain(drain(s, "player2"), "player1"));
    expect(zoneOf(s, "player2", "RS-062:bk")).toBe("rush");
    expect(s.players.player2.power).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-125 百獣アニマルハート", () => {
  const TEXT =
    "敵軍ユニットを、BPの合計が12000以下になるように選んで撃破する。ただし選べるユニットの数は、自軍WBのMユニットの数までとする。";
  const WBM = sUnit("SPEC-WBM", { size: "M", category: "WB" });
  const MAM = sUnit("SPEC-MAM", { size: "M", category: "MA" });
  const E5 = sUnit("SPEC-E5", { bp: 5000 });
  const E6 = sUnit("SPEC-E6", { bp: 6000 });
  const E7 = sUnit("SPEC-E7", { bp: 7000 });
  const EXTRA = [WBM, MAM, E5, E6, E7];

  function heart(opts: { battle?: string[]; rush?: string[]; enemy?: ReturnType<typeof inst>[] } = {}): GameState {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-125", "ah")],
          battle: (opts.battle ?? []).map((id, i) => inst(id, `b${i}`)),
          rush: (opts.rush ?? []).map((id, i) => inst(id, `r${i}`)),
          command: [released("TST-OP", "wb")],
          power: powerCards(8),
        },
        player2: {
          battle: opts.enemy ?? [inst("SPEC-E5", "e5"), inst("SPEC-E6", "e6"), inst("SPEC-E7", "e7")],
        },
      },
      EXTRA,
    );
    s = useCard(s, "player1", "RS-125:ah");
    return s;
  }

  it("RS-125: カタログ本文・スペックが出典と一致（出典: atwiki/page-343）", () => {
    expectCatalogText("RS-125", TEXT);
    expectOpStats("RS-125", { name: "百獣アニマルハート", category: "WB", powerCost: 8 });
  });

  it("RS-125: BP の合計 12000 以下になるように選んだ敵軍ユニットを撃破する（自軍 WB の M が2体）（出典: atwiki/page-343）", () => {
    let s = heart({ battle: ["SPEC-WBM", "SPEC-WBM"] });
    s = pick(s, "SPEC-E5:e5");
    s = pick(s, "SPEC-E6:e6");
    s = settle(confirm(s));
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E6:e6")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E7:e7")).toBe("battle");
  });

  it("RS-125: 合計が 12000 を超えるユニットは選べない（出典: atwiki/page-343）", () => {
    let s = heart({ battle: ["SPEC-WBM", "SPEC-WBM"] });
    s = pick(s, "SPEC-E6:e6");
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E7:e7" }).ok).toBe(false);
  });

  it("RS-125: 選べる数は自軍 WB の M ユニットの数まで（1体なら1体だけ）（出典: atwiki/page-343）", () => {
    let s = heart({ battle: ["SPEC-WBM", "SPEC-MAM"] });
    s = pick(s, "SPEC-E5:e5");
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E6:e6" }).ok).toBe(false);
  });

  it("RS-125: 自軍 WB の M ユニットがいなければ撃破できない（出典: atwiki/page-343・atwiki コメント「空打ちとなります」）", () => {
    const s = heart({ battle: ["SPEC-MAM"] });
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(s.players.player2.battle).toHaveLength(3);
  });

  it.fails("RS-125: 自軍ラッシュエリアの WB の M ユニットも数える（ラッシュフェイズにはふつうバトルエリアは空）（出典: atwiki/page-343「自軍WBのMユニットの数」）", () => {
    // 既知の不具合: CARD-RS-125 選べる数に自軍バトルエリアの WB M ユニットだけを数え、ラッシュエリアの WB M を数えない
    let s = heart({ rush: ["SPEC-WBM", "SPEC-WBM"] });
    s = pick(s, "SPEC-E5:e5");
    s = pick(s, "SPEC-E6:e6");
    s = settle(confirm(s));
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E6:e6")).toBe("discard");
  });

  it("RS-125: 敵軍ラッシュエリアのユニットも選べる（出典: atwiki/page-343「敵軍ユニット」）", () => {
    let s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-125", "ah")], battle: [inst("SPEC-WBM", "b0")], command: [released("TST-OP", "wb")], power: powerCards(8) },
        player2: { rush: [inst("SPEC-E5", "r5")] },
      },
      EXTRA,
    );
    s = useCard(s, "player1", "RS-125:ah");
    expect(choiceIds(s)).toContain("SPEC-E5:r5");
  });

  // faq-card-3 RS-125 Q1「BPの補正分も含めての合計になりますか？」「はい、その通りです。」
  it.fails("RS-125: 公式Q&A — 合計は補正後の BP で数える（本来 5000 に +8000 されたユニットは 12000 の枠を超える）（出典: grnrngr/faq-card-3 RS-125 Q1）", () => {
    // 既知の不具合: CARD-RS-125 合計を印刷（本来の）BP で数え、BP の補正を含めない
    let s = heart({
      battle: ["SPEC-WBM", "SPEC-WBM"],
      enemy: [{ ...inst("SPEC-E5", "e5"), bpModifier: 8000 }, inst("SPEC-E6", "e6")],
    });
    s = pick(s, "SPEC-E6:e6");
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E5:e5" }).ok).toBe(false);
  });

  // faq-card-3 RS-125 Q2「まず…選んで」から、その後ターンプレイヤーが望む順序で撃破」
  it("RS-125: 公式Q&A — 先にすべて選び、確定してからまとめて撃破する（選んでいる途中では撃破されない）（出典: grnrngr/faq-card-3 RS-125 Q2）", () => {
    let s = heart({ battle: ["SPEC-WBM", "SPEC-WBM"] });
    s = pick(s, "SPEC-E5:e5");
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("battle");
    s = pick(s, "SPEC-E6:e6");
    s = settle(confirm(s));
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E6:e6")).toBe("discard");
  });

  // faq-card-5（RS-265 の項）「はい、発動できます。」— アニマルハートで撃破されたジェットシーカーのラウンドレーダー
  it.todo(
    "RS-125: 公式Q&A — 百獣アニマルハートで撃破されたジェットシーカーの【ラウンドレーダー】は発動できる（出典: grnrngr/faq-card-5 RS-265）— 撃破されたユニット自身の「オペレーション使用時」誘発をエンジンの公開 API で観測する手段がない",
  );
});

// ===========================================================================
describe("RS-126 アカレンジャー", () => {
  const TEXT =
    "【レッドビュート】「SP1」自軍ターン中、これがバトルで敵軍ユニットを撃破したとき、敵軍ラッシュエリアからBP2000以下のユニットを1体選んで撃破する。";
  const E2 = sUnit("SPEC-E2", { bp: 2000 });
  const E3 = sUnit("SPEC-E3", { bp: 3000 });

  function fifth(n = 4): GameState {
    let s = st(
      {
        player1: { battle: fillers(n), rush: [inst("RS-126", "aka")] },
        player2: {
          battle: [inst("TST-UNIT-0", "def")],
          rush: [inst("SPEC-E2", "r2"), inst("SPEC-E3", "r3")],
        },
      },
      [E2, E3],
    );
    s = enter(s, "RS-126:aka");
    return s;
  }

  it("RS-126: カタログ本文・スペックが出典と一致（出典: atwiki/page-25）", () => {
    expectCatalogText("RS-126", TEXT);
    expectStats("RS-126", {
      name: "アカレンジャー",
      category: "ET",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 6,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  it("RS-126: 5番目に出ると「SP1」になりストライクできる（出典: atwiki/page-25「CN：5」）", () => {
    const s = fifth();
    expect(ncLogged(s, "RS-126")).toBe(true);
    expect(canStrike(s, "RS-126:aka")).toBe(true);
  });

  it("RS-126: 5番目以外では「SP！」のままストライクできない（出典: atwiki/page-25）", () => {
    const s = fifth(1);
    expect(canStrike(s, "RS-126:aka")).toBe(false);
  });

  it("RS-126: NC 成立後、バトルで敵軍ユニットを撃破すると敵軍ラッシュエリアの BP2000 以下を1体選んで撃破する（BP3000 は対象外）（出典: atwiki/page-25）", () => {
    let s = attack(fifth(), "RS-126:aka", "TST-UNIT-0:def");
    s = settle(s);
    expect(choiceIds(s)).toEqual(["SPEC-E2:r2"]);
    s = settle(pick(s, "SPEC-E2:r2"));
    expect(zoneOf(s, "player2", "SPEC-E2:r2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3:r3")).toBe("rush");
  });

  it.fails("RS-126: 対象がいれば撃破は強制（見送れない）（出典: atwiki/page-25「1体選んで撃破する」）", () => {
    // 既知の不具合: CARD-RS-126 【レッドビュート】の撃破を任意（skip_effect_choice 可）として扱う
    const s = settle(attack(fifth(), "RS-126:aka", "TST-UNIT-0:def"));
    expect(s.pendingEffectChoice?.effectId).toBe("red_boot");
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RS-126: NC 不成立（5番目以外）なら撃破しても【レッドビュート】は発動しない（出典: atwiki/page-25「CN：5」・R-CN-02）", () => {
    // 既知の不具合: CARD-RS-126 NC の成立を見ずに【レッドビュート】を発動する
    const s = settle(attack(fifth(1), "RS-126:aka", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("discard");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-E2:r2")).toBe("rush");
  });

  it("RS-126: 敵軍ターン中（アタックされて撃破した場合）は発動しない（出典: atwiki/page-25「自軍ターン中」）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [{ ...inst("RS-126", "aka"), activatedNcEffects: ["red_boot"] }] },
        player2: { battle: [inst("TST-UNIT-0", "atk")], rush: [inst("SPEC-E2", "r2")] },
      },
      [E2],
    );
    s = settle(attack(s, "TST-UNIT-0:atk", "RS-126:aka", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-E2:r2")).toBe("rush");
  });

  // faq-card-3 RS-126 Q1「その「RS-126 アカレンジャー」はＳＰ２でストライクすることができます」
  it.fails("RS-126: 公式Q&A — ゴレンジャーハリケーンを発動させたアカレンジャーは、【レッドビュート】が発動しなくても SP2 でストライクできる（出典: grnrngr/faq-card-3 RS-126 Q1）", () => {
    // 既知の不具合: CARD-RS-126 モモレンジャーから順にコンビネーションして5番目に出たアカレンジャーに【ゴレンジャーハリケーン】の「SP2」を与えない（モモレンジャー自身の spModifier を増やす）
    // 敵軍ラッシュエリアのタンクコマンド＋敵軍コマンドのナンバー5のカードで、アカレンジャー（CN5）の NC（レッドビュート）は発動できない
    let s = st({
      player1: { rush: [inst("RS-259", "momo"), inst("RS-189", "ki"), inst("RS-190", "mido"), inst("RS-258", "ao"), inst("RS-126", "aka")] },
      player2: {
        rush: [inst("RS-263", "tank")],
        command: [released("RS-062", "cn5"), held("TST-OP", "h")],
        battle: [inst("TST-UNIT-0", "def")],
        deck: deckCards(5, "ed"),
      },
    });
    for (const id of ["RS-259:momo", "RS-189:ki", "RS-190:mido", "RS-258:ao", "RS-126:aka"]) {
      s = settle(drain(enter(s, id), "player1", ["TST-OP:h"]));
      const pass = legal(s).find((a) => a.type === "pass_battle_entry");
      if (id !== "RS-126:aka" && pass) s = act(s, pass);
    }
    expect(canStrike(s, "RS-126:aka")).toBe(true);
    s = settle(act(s, { type: "strike", playerId: "player1", instanceId: "RS-126:aka" }));
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-127 バイオロボ", () => {
  const TEXT =
    "合体―バイオジェット1号＋バイオジェット2号【バイオ粒子斬り】自軍ターン中、これがバトルエリアに出るとき、「OT」の自軍コマンドを2つ選んでパワーゾーンに送ってもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP2」「BP＋3000」";

  function robo(command = [released("TST-OP-OT", "o1"), held("TST-OP-OT", "o2"), released("TST-OP-MA", "ma")]): GameState {
    let s = st({ player1: { rush: [inst("RS-127", "bio")], command }, player2: { deck: deckCards(5, "ed") } });
    s = enter(s, "RS-127:bio");
    return s;
  }

  it("RS-127: カタログ本文・スペックが出典と一致（出典: atwiki/page-363）", () => {
    expectCatalogText("RS-127", TEXT);
    expectStats("RS-127", {
      name: "バイオロボ",
      category: "OT",
      size: "L",
      bp: 11000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「追加条件：自軍合体ユニットを捨札にする」「合体―バイオジェット1号＋バイオジェット2号」
  it("RS-127: 合体ユニット（バイオジェット1号・2号）を捨札にしてラッシュする（出典: atwiki/page-363）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-127", "bio")],
        rush: [inst("RS-128", "j1"), inst("RS-129", "j2")],
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(6),
      },
    });
    const r = rushFromHand(s, "player1", "RS-127:bio", { materials: ["RS-128:j1", "RS-129:j2"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-127:bio")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-128:j1")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-129:j2")).toBe("discard");
  });

  it("RS-127: 出るとき「OT」の自軍コマンドを2つ選んでパワーゾーンに送ると、このターン「SP2」「BP＋3000」（ホールド状態の OT も選べる）（出典: atwiki/page-363）", () => {
    let s = robo();
    expect(choiceIds(s)).toEqual(["TST-OP-OT:o1", "TST-OP-OT:o2"]);
    s = pick(s, "TST-OP-OT:o1");
    s = pick(s, "TST-OP-OT:o2");
    if (s.pendingEffectChoice?.effectId === "bio_particle_slash") s = confirm(s);
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP-OT:o2")).toBe("power");
    expect(bpOf(s, "player1", "RS-127:bio")).toBe(14000);
    expect(canStrike(s, "RS-127:bio")).toBe(true);
    const before = s.players.player2.power.length;
    s = settle(act(s, { type: "strike", playerId: "player1", instanceId: "RS-127:bio" }));
    expect(s.players.player2.power.length - before).toBe(2);
  });

  it("RS-127: 送らないことを選べる（任意）— その場合 BP11000・SP1 のまま（出典: atwiki/page-363「送ってもよい」）", () => {
    let s = robo();
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("command");
    expect(bpOf(s, "player1", "RS-127:bio")).toBe(11000);
  });

  it("RS-127: 「OT」の自軍コマンドが1つしかなければ発動しない（出典: atwiki/page-363「2つ選んで」）", () => {
    const s = robo([released("TST-OP-OT", "o1"), released("TST-OP-MA", "ma")]);
    expect(s.pendingEffectChoice?.effectId).not.toBe("bio_particle_slash");
    expect(bpOf(s, "player1", "RS-127:bio")).toBe(11000);
  });

  it("RS-127: 敵軍ターン中に（相手の紐男爵で）バトルエリアに出されたときは発動しない（出典: atwiki/page-363「自軍ターン中」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: {
        battle: [inst("TST-UNIT-0", "mine")],
        rush: [inst("RS-127", "bio")],
        command: [released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")],
      },
      player2: { battle: fillers(2, "ef"), rush: [inst("RS-141", "himo")] },
    });
    s = enter(s, "RS-141:himo", "player2");
    s = pick(s, "TST-UNIT-0:mine");
    s = drain(s, "player2", ["RS-127:bio"]);
    expect(zoneOf(s, "player1", "RS-127:bio")).toBe("battle");
    expect(s.pendingEffectChoice?.effectId).not.toBe("bio_particle_slash");
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("command");
  });

  // faq-card-3 RS-127 Q1「はい、発動できます。」（プリズムブーツで OT 扱いのコマンド）
  it.fails("RS-127: 公式Q&A — ピンクフラッシュの【プリズムブーツ】で OT 扱いになったホールド状態のコマンドを送って発動できる（出典: grnrngr/faq-card-3 RS-127 Q1）", () => {
    // 既知の不具合: CARD-RS-127 【バイオ粒子斬り】の「OT」判定が印刷カテゴリだけを見て、プリズムブーツで OT 扱いになったコマンドを数えない
    let s = st({
      player1: {
        rush: [inst("RS-270", "pf"), inst("RS-127", "bio")],
        command: [held("TST-OP-MA", "m1"), held("TST-OP-MA", "m2"), released("TST-OP-OT", "ot")],
      },
    });
    s = settle(drain(enter(s, "RS-270:pf"), "player1"));
    const pass = legal(s).find((a) => a.type === "pass_battle_entry");
    if (pass) s = act(s, pass);
    s = enter(s, "RS-127:bio");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["TST-OP-MA:m1", "TST-OP-MA:m2"]));
  });

  // faq-card-6（RS-359 の項）「はい、できます。」（デンジ犬アイシー2体でバイオジェット1号・2号を山札から捨札にしてラッシュ）
  it.todo(
    "RS-127: 公式Q&A — デンジ犬アイシー2体の【最後の手段】で山札のバイオジェット1号・2号を捨札にしてバイオロボをラッシュできる（出典: grnrngr/faq-card-6 RS-359）— デンジ犬アイシーの L ラッシュ置きかえの手順（2体分の連続使用）は RS-359 側の仕様テストで扱う範囲で、RS-127 側から公開 API で組む手順が定まっていない",
  );
});

// ===========================================================================
describe("RS-128 バイオジェット1号", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍パワーゾーンにダメージ以外のカードがあれば、1枚選んで捨札にする。【拠点攻撃】「バイオジェット2号」からコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」";

  function rushJ1(power = powerCards(5)) {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-128", "j1")],
        rush: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2")],
        command: [released("TST-OP-OT", "ot")],
        power,
      },
    });
    return rushFromHand(s, "player1", "RS-128:j1", { materials: ["TST-UNIT-0:s1", "TST-UNIT-0:s2"] });
  }

  it("RS-128: カタログ本文・スペックが出典と一致（出典: atwiki/page-360）", () => {
    expectCatalogText("RS-128", TEXT);
    expectStats("RS-128", {
      name: "バイオジェット1号",
      category: "OT",
      size: "M",
      bp: 6000,
      sp: "special",
      powerCost: "5+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_power",
    });
  });

  it("RS-128: 追加条件（自軍Sユニットを2体パワーゾーンに送る）を満たしてラッシュする（出典: atwiki/page-360）", () => {
    const r = rushJ1();
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-128:j1")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s1")).toBe("power");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s2")).toBe("power");
  });

  it("RS-128: ※ラッシュしたとき、ダメージ以外のパワーを1枚選んで捨札にする（強制）（出典: atwiki/page-360）", () => {
    const r = rushJ1([...damageCards(2), ...powerCards(3)]);
    let s = r.state;
    expect(s.pendingEffectChoice?.effectId).toBe("rush_power_to_discard");
    expect(canSkip(s)).toBe(false);
    expect(choiceIds(s)).not.toContain("TST-P:dmg0");
    s = settle(pick(s, "TST-P:pw1"));
    expect(zoneOf(s, "player1", "TST-P:pw1")).toBe("discard");
    expect(s.players.player1.discard).toHaveLength(1);
  });

  // faq-card-3 RS-128 Q1「はい、できます。」
  it("RS-128: 公式Q&A — パワーゾーンのカードがダメージだけでもラッシュできる（出典: grnrngr/faq-card-3 RS-128 Q1）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-128", "j1")],
        rush: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2")],
        command: [released("TST-OP-OT", "ot")],
        power: damageCards(5),
      },
    });
    const r = rushFromHand(s, "player1", "RS-128:j1", { materials: ["TST-UNIT-0:s1", "TST-UNIT-0:s2"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-128:j1")).toBe("rush");
  });

  // 「【拠点攻撃】「バイオジェット2号」からコンビネーションするとき…「SP1」」
  it("RS-128: バイオジェット2号の次に出ると「SP1」を得てストライクできる（出典: atwiki/page-360）", () => {
    let s = st({ player1: { rush: [inst("RS-129", "j2"), inst("RS-128", "j1")] } });
    s = enter(s, "RS-129:j2");
    const pass = legal(s).find((a) => a.type === "pass_battle_entry");
    if (pass) s = act(s, pass);
    s = enter(s, "RS-128:j1");
    expect(canStrike(s, "RS-128:j1")).toBe(true);
  });

  it("RS-128: バイオジェット2号から出ていなければ「SP！」のままストライクできない（出典: atwiki/page-360）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-128", "j1")] } });
    s = enter(s, "RS-128:j1");
    expect(canStrike(s, "RS-128:j1")).toBe(false);
  });

  it.fails("RS-128: バトルエリアにバイオジェット2号がいても、直前（左隣）でなければコンビネーションではない（出典: atwiki/page-360・R-CN-05）", () => {
    // 既知の不具合: CARD-RS-128 【拠点攻撃】の判定で、バイオジェット2号が左隣にいるかではなくバトルエリアにいるかを見ている
    let s = st({ player1: { battle: [inst("RS-129", "j2"), inst("TST-UNIT-0", "f")], rush: [inst("RS-128", "j1")] } });
    s = enter(s, "RS-128:j1");
    expect(canStrike(s, "RS-128:j1")).toBe(false);
  });
});

// ===========================================================================
describe("RS-129 バイオジェット2号", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍パワーゾーンにダメージ以外のカードがあれば、２枚選んで捨札にする。1枚しかなければそれを捨札にする。【ステルス】相手がオペレーションの効果でユニットを選ぶとき、このユニットを選ぶことはできない。";

  function rushJ2(power = powerCards(4), noPass = false) {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-129", "j2")],
        rush: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2"), inst("TST-UNIT-0", "s3")],
        command: [released("TST-OP-OT", "ot")],
        power,
      },
      player2: { hand: [inst("RS-026", "ctr")], command: [released("TST-OP-MA", "ma")], power: powerCards(3, "ep") },
    });
    return rushFromHand(s, "player1", "RS-129:j2", {
      materials: ["TST-UNIT-0:s1", "TST-UNIT-0:s2", "TST-UNIT-0:s3"],
      noPass,
    });
  }

  it("RS-129: カタログ本文・スペックが出典と一致（出典: atwiki/page-361）", () => {
    expectCatalogText("RS-129", TEXT);
    expectStats("RS-129", {
      name: "バイオジェット2号",
      category: "OT",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_power",
    });
  });

  it("RS-129: 追加条件（自軍Sユニットを3体パワーゾーンに送る）を満たしてラッシュする（出典: atwiki/page-361）", () => {
    const r = rushJ2();
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-129:j2")).toBe("rush");
    for (const id of ["s1", "s2", "s3"]) expect(zoneOf(r.state, "player1", `TST-UNIT-0:${id}`)).toBe("power");
  });

  it("RS-129: ※ラッシュしたとき、ダメージ以外のパワーを2枚選んで捨札にする（出典: atwiki/page-361）", () => {
    let s = rushJ2([...damageCards(4)]).state;
    // ダメージ以外は追加条件で送った S ユニット3枚
    expect(s.pendingEffectChoice?.effectId).toBe("rush_power_to_discard");
    expect(canSkip(s)).toBe(false);
    s = pick(s, "TST-UNIT-0:s1");
    if (s.pendingEffectChoice) s = pick(s, "TST-UNIT-0:s2");
    s = settle(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:s1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s2")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s3")).toBe("power");
  });

  it.todo(
    "RS-129: ※ダメージ以外のパワーが1枚しかなければそれを捨札にする（出典: atwiki/page-361「1枚しかなければそれを捨札にする」）— 追加条件で S ユニット3体をオモテ向きでパワーゾーンに送るため、通常のラッシュでは「1枚しかない」状況を作れない（ベン・G 経由は Q2 により実行しない）",
  );

  // 【ステルス】
  it("RS-129: 【ステルス】相手のオペレーション（RS-028 の「敵軍ユニットを1体選んで」）の対象に選べない（出典: atwiki/page-361）", () => {
    const s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { battle: [inst("RS-129", "j2"), inst("TST-UNIT-0", "other")] },
      player2: {
        hand: [inst("RS-028", "op")],
        command: [released("TST-OP", "wb"), released("TST-OP-ET", "et"), released("TST-OP-OT", "ot"), released("TST-OP-MA", "ma"), released("TST-OP-DA", "da")],
        power: powerCards(8, "ep"),
      },
    });
    // RS-028「敵軍ユニットを1体選んでターゲットとする」
    const targets = (legal(s) as unknown as Record<string, unknown>[])
      .filter((a) => a.sourceInstanceId === "RS-028:op" || a.instanceId === "RS-028:op")
      .map((a) => a.targetInstanceId);
    expect(targets).toContain("TST-UNIT-0:other");
    expect(targets).not.toContain("RS-129:j2");
  });

  it("RS-129: 【ステルス】はオペレーションだけ — 相手のユニットの効果（ランドライオン【強襲】）では選べる（出典: atwiki/page-361「オペレーションの効果で」）", () => {
    const s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { battle: [inst("RS-129", "j2")], command: [] },
      player2: {
        hand: [inst("RS-136", "ll")],
        rush: [inst("TST-UNIT-0", "m")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(5, "ep"),
      },
    });
    const r = rushFromHand(s, "player2", "RS-136:ll", { materials: ["TST-UNIT-0:m"] });
    expect(choiceIds(r.state)).toContain("RS-129:j2");
  });

  // faq-card-3 RS-129 Q1「はい、使用することができます。」
  it("RS-129: 公式Q&A — 相手がラッシュしたバイオジェット2号に疾風流超忍法を使える（出典: grnrngr/faq-card-3 RS-129 Q1）", () => {
    let s = rushJ2(powerCards(4), true).state;
    s = drain(s, "player1");
    expect(canUseCard(s, "player2", "RS-026:ctr")).toBe(true);
  });

  /** 相手（player2）が【人身略取】でバイオジェット2号を捨札にする。 */
  function abduct(myRush: number): GameState {
    let s = st({
      activePlayer: "player2",
      player1: {
        rush: fillers(myRush, "mine"),
        power: powerCards(2, "mp"),
      },
      player2: { battle: [], rush: [inst("RS-322", "ben")], hand: [inst("RS-129", "j2")] },
    });
    s = enter(s, "RS-322:ben", "player2");
    s = drain(s, "player2", ["RS-129:j2"]);
    if (s.pendingEffectChoice?.playerId === "player2" && s.pendingEffectChoice.kind === "confirm") s = confirm(s);
    return drain(s, "player1");
  }

  // faq-card-3 RS-129 Q2「いいえ、その必要はありません。」
  it("RS-129: 公式Q&A — 相手のベン・G【人身略取】で追加条件を満たしたときは、※パワーを捨札にする処理は行わない（出典: grnrngr/faq-card-3 RS-129 Q2）", () => {
    const s = abduct(3);
    expect(s.players.player1.rush).toHaveLength(0);
    expect(s.players.player1.power.filter((c) => !c.faceDown)).toHaveLength(5);
    expect(s.players.player1.discard).toHaveLength(0);
  });

  // faq-card-5（RS-322 の項）「いいえ、送る必要はありません。「可能なら満たす」ということは…」
  it.fails("RS-129: 公式Q&A — 自軍 S ユニットが1体しかなければ、人身略取でもパワーゾーンに送らなくてよい（出典: grnrngr/faq-card-5 RS-322）", () => {
    // 既知の不具合: CARD-RS-129 人身略取（abduction_material）で、3体に足りない（満たせない）追加条件でも S ユニットを1体ずつ強制で送らせる
    const s = abduct(1);
    expect(s.players.player1.rush).toHaveLength(1);
  });

  // faq-card-3 RS-129 Q3（RS-128 Q1 と同文）「はい、できます。」
  it("RS-129: 公式Q&A — パワーゾーンのカードがダメージだけでもラッシュできる（出典: grnrngr/faq-card-3 RS-129 Q3）", () => {
    const r = rushJ2(damageCards(4));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-129:j2")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-130 レッドワン", () => {
  const TEXT = "【ファイヤーソード】「SP1」常駐しているオペレーションを1つ選んで、持ち主のパワーゾーンに送ってもよい。";

  function redOne(n: number, own = [inst("RS-124", "myop")], enemy = [inst("RS-124", "enop")]): GameState {
    let s = st({
      player1: { battle: fillers(n), rush: [inst("RS-130", "r1")], operation: own },
      player2: { operation: enemy },
    });
    s = enter(s, "RS-130:r1");
    return s;
  }

  it("RS-130: カタログ本文・スペックが出典と一致（出典: atwiki/page-364）", () => {
    expectCatalogText("RS-130", TEXT);
    expectStats("RS-130", {
      name: "レッドワン",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 4,
      comboNumber: 4,
      features: ["レッド", "男"],
    });
  });

  it("RS-130: 4番目に出ると「SP1」、自軍の常駐オペレーションを選んで持ち主のパワーゾーンに送れる（出典: atwiki/page-364）", () => {
    let s = redOne(3);
    expect(choiceIds(s)).toContain("RS-124:myop");
    s = pick(s, "RS-124:myop");
    expect(zoneOf(s, "player1", "RS-124:myop")).toBe("power");
    expect(canStrike(s, "RS-130:r1")).toBe(true);
  });

  it.fails("RS-130: 相手の常駐オペレーションも選べ、相手（持ち主）のパワーゾーンに送る（出典: atwiki/page-364「常駐しているオペレーション」「持ち主の」）", () => {
    // 既知の不具合: CARD-RS-130 【ファイヤーソード】の候補が自軍の常駐オペレーションだけで、敵軍の常駐オペレーションを選べない
    let s = redOne(3);
    expect(choiceIds(s)).toContain("RS-124:enop");
    s = pick(s, "RS-124:enop");
    expect(zoneOf(s, "player2", "RS-124:enop")).toBe("power");
  });

  it("RS-130: 送らないことを選べる（任意）（出典: atwiki/page-364「送ってもよい」）", () => {
    let s = redOne(3);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-124:myop")).toBe("operation");
    expect(canStrike(s, "RS-130:r1")).toBe(true);
  });

  it("RS-130: 4番目以外では発動せず「SP！」のまま（出典: atwiki/page-364「CN：4」）", () => {
    const s = redOne(1);
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(canStrike(s, "RS-130:r1")).toBe(false);
  });

  // faq-card-3 RS-130 Q1「いいえ、できません。」
  it.todo(
    "RS-130: 公式Q&A — J パワー・巨大化爆弾などユニットの下に重ねたオペレーションは選べない（出典: grnrngr/faq-card-3 RS-130 Q1）— ユニットの下に重ねたオペレーションの状態（RK-013 / RS-255 の重ね）を公開 API で組めない",
  );

  // faq-card-3 RS-130 Q2「ターンプレイヤーの勝利となります。」
  it.fails("RS-130: 公式Q&A — 互いにダメージ7点以上で命の泉をパワーゾーンに送ると、ターンプレイヤーの勝利（出典: grnrngr/faq-card-3 RS-130 Q2）", () => {
    // 既知の不具合: CARD-RS-130 【ファイヤーソード】で命の泉が場を離れても、その時点で勝敗判定をしない（winner が null のまま）
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-130", "r1")], operation: [inst("RS-244", "izumi")], power: damageCards(7, "d1") },
      player2: { power: damageCards(7, "d2") },
    });
    s = enter(s, "RS-130:r1");
    s = pick(s, "RS-244:izumi");
    s = settle(drain(s, "player1"));
    expect(s.winner).toBe("player1");
  });
});

// ===========================================================================
describe("RS-131 メッツラー", () => {
  const TEXT =
    "【ミラージュビーム】このユニットがバトルするとき、自軍山札の上から1枚をオモテにする。オモテにしたカードがユニットのカードなら、そのバトルの間、このユニットのBPをオモテにしたカードのBPとしてバトルする。その後、オモテにしたカードは捨札にする。";
  const E5 = sUnit("SPEC-E5", { bp: 5000 });
  const BIG = sUnit("SPEC-BIG", { bp: 9000 });

  it("RS-131: カタログ本文・スペックが出典と一致（出典: atwiki/page-334）", () => {
    expectCatalogText("RS-131", TEXT);
    expectStats("RS-131", {
      name: "メッツラー",
      category: "DA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 1,
      features: ["ジューノイド五獣士"],
    });
  });

  it("RS-131: アタックしてバトルするとき、山札の上がユニットならその BP でバトルし、そのカードは捨札になる（出典: atwiki/page-334）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-131", "me")], deck: [inst("SPEC-BIG", "top"), ...deckCards(2)] },
        player2: { battle: [inst("SPEC-E5", "e5")] },
      },
      [E5, BIG],
    );
    s = settle(attack(s, "RS-131:me", "SPEC-E5:e5"));
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-131:me")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-BIG:top")).toBe("discard");
  });

  it("RS-131: 山札の上がユニットでなければ BP1000 のままバトルし、そのカードも捨札になる（出典: atwiki/page-334）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-131", "me")], deck: [inst("TST-OP", "top"), ...deckCards(2)] },
        player2: { battle: [inst("SPEC-E5", "e5")] },
      },
      [E5],
    );
    s = settle(attack(s, "RS-131:me", "SPEC-E5:e5"));
    expect(zoneOf(s, "player1", "RS-131:me")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("discard");
  });

  it("RS-131: BP の低いユニットがめくれると BP が下がる（出典: atwiki/page-334・カード評価「BPが下がる」）", () => {
    const E500 = sUnit("SPEC-500", { bp: 500 });
    const D700 = sUnit("SPEC-700", { bp: 700 });
    let s = st(
      {
        player1: { battle: [inst("RS-131", "me")], deck: [inst("SPEC-500", "top"), ...deckCards(2)] },
        player2: { battle: [inst("SPEC-700", "d")] },
      },
      [E500, D700],
    );
    s = settle(attack(s, "RS-131:me", "SPEC-700:d"));
    expect(zoneOf(s, "player1", "RS-131:me")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-700:d")).toBe("battle");
  });

  // faq-card-3 RS-131 Q1「はい、適用されます。」
  it.fails("RS-131: 公式Q&A — 相手ターン中にアタックされてバトルするときも適用される（出典: grnrngr/faq-card-3 RS-131 Q1）", () => {
    // 既知の不具合: CARD-RS-131 【ミラージュビーム】をメッツラーがアタックしたときだけ処理し、アタックされたバトルでは山札をめくらない
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-131", "me")], deck: [inst("SPEC-BIG", "top"), ...deckCards(2)] },
        player2: { battle: [inst("SPEC-E5", "e5")] },
      },
      [E5, BIG],
    );
    s = settle(attack(s, "SPEC-E5:e5", "RS-131:me", "player2"));
    expect(zoneOf(s, "player1", "RS-131:me")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-BIG:top")).toBe("discard");
  });
});
