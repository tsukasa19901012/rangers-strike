/**
 * カード別スペック: RS-047〜RS-070（第1弾「英雄の再誕」）
 *
 * 出典（優先順）:
 *  1. docs/rules/08-errata.md、grnrngr/faq-card-1（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_1.html）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-0NN.md、ライブ写し docs/rules/sources/web/w.atwiki.jp/renst/pages/N.txt）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-0NN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  actLegal,
  attack,
  attackTargets,
  canEnter,
  canStrike,
  cardIn,
  deckCards,
  effectMeta,
  endTurn,
  enter,
  expectCatalogText,
  fillers,
  held,
  heldN,
  inst,
  legal,
  legalOfType,
  norm,
  powerCards,
  raw,
  released,
  releasedN,
  settle,
  st,
  strike,
  sUnit,
  tryAct,
  unitIn,
  zoneIds,
  zoneOf,
  rushFromHand,
  canStartRush,
  advanceToBattle,
  passEntry,
  playOp,
  enterHold,
} from "./RS1-047-070.helpers";

/** 印刷スペック（BP・SP・必要パワー・CN・サイズ・カテゴリ）。 */
function expectStats(
  id: string,
  stats: {
    name: string;
    type?: "unit" | "operation";
    category: string;
    size?: string;
    bp?: number;
    sp?: number | "special" | undefined;
    powerCost: number | string;
    comboNumber?: number;
    features?: string[];
  },
) {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe(stats.type ?? "unit");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  if ((stats.type ?? "unit") === "unit") {
    expect(d.size).toBe(stats.size);
    expect(d.bp).toBe(stats.bp);
    expect(d.sp).toBe(stats.sp);
    expect(d.comboNumber).toBe(stats.comboNumber);
    expect(d.features ?? []).toEqual(stats.features ?? []);
  }
}

// ===========================================================================
describe("RS-047 パトシグナー", () => {
  // atwiki/page-284「【進入禁止サインボード】これがバトルエリアにあるとき…」
  it("RS-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-284）", () => {
    expectCatalogText(
      "RS-047",
      "【進入禁止サインボード】これがバトルエリアにあるとき、BP5000以上のすべてのMユニットはバトルエリアに出ることはできない。",
    );
    expectStats("RS-047", {
      name: "パトシグナー",
      category: "OT",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ", "車両"],
    });
    expect(DEFS["RS-047"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_power");
  });

  function rushSignerState(opts: { sUnit?: boolean; power?: number }) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-047", "sg")],
        rush: opts.sUnit ? [inst("TST-UNIT-0", "s")] : [],
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(opts.power ?? 3),
      },
    });
  }
  function canRushSigner(s: ReturnType<typeof st>) {
    return legal(s).some(
      (a) =>
        ((a.type === "begin_zord_setup" && a.zordInstanceId === "RS-047:sg") ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-047:sg") ||
          (a.type === "rush" && a.instanceId === "RS-047:sg")),
    );
  }

  // atwiki/page-284「追加条件：自軍Sユニットを1体パワーゾーンに送る」
  it("RS-047: 追加条件（自軍Sユニットを1体パワーゾーンに送る）を満たせなければラッシュできない（出典: atwiki/page-284）", () => {
    expect(canRushSigner(rushSignerState({ sUnit: true }))).toBe(true);
    expect(canRushSigner(rushSignerState({ sUnit: false }))).toBe(false);
  });

  // atwiki/page-284「必要パワー：3+」
  it("RS-047: 必要パワー3+（パワー2ではラッシュできない）（出典: atwiki/page-284）", () => {
    expect(canRushSigner(rushSignerState({ sUnit: true, power: 2 }))).toBe(false);
  });

  // 「BP5000以上のすべてのMユニットはバトルエリアに出ることはできない」
  it("RS-047: 敵軍バトルエリアのパトシグナーは BP5000 の自軍Mユニットのバトル進入を禁止する（出典: atwiki/page-284）", () => {
    const s = st({
      player1: { rush: [inst("RS-043", "pat")], command: releasedN(2) },
      player2: { battle: [inst("RS-047", "sg")] },
    });
    expect(canEnter(s, "RS-043:pat")).toBe(false);
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-043:pat" }).ok).toBe(false);
  });

  // atwiki/page-284 カード評価「【進入禁止サインボード】は自軍にも効果を及ぼす」（本文「すべてのMユニット」）
  it("RS-047: 自軍のパトシグナーも自軍の BP5000以上Mユニットを止める（「すべての」）（出典: atwiki/page-284）", () => {
    const s = st({
      player1: { rush: [inst("RS-043", "pat")], battle: [inst("RS-047", "sg")], command: releasedN(2) },
    });
    expect(canEnter(s, "RS-043:pat")).toBe(false);
  });

  it("RS-047: BP4000 のMユニット・BP5000以上のSユニットは禁止されない（出典: atwiki/page-284）", () => {
    const bigS = sUnit("SPEC-S6000", { bp: 6000 });
    const s = st(
      {
        player1: { rush: [inst("RS-089", "m4000"), inst("SPEC-S6000", "s")] },
        player2: { battle: [inst("RS-047", "sg")] },
      },
      [bigS],
    );
    expect(canEnter(s, "RS-089:m4000")).toBe(true);
    expect(canEnter(s, "SPEC-S6000:s")).toBe(true);
  });

  it("RS-047: パトシグナーがラッシュエリアにあるだけでは禁止しない（「バトルエリアにあるとき」）（出典: atwiki/page-284）", () => {
    const s = st({
      player1: { rush: [inst("RS-043", "pat")] },
      player2: { rush: [inst("RS-047", "sg")] },
    });
    expect(canEnter(s, "RS-043:pat")).toBe(true);
  });

  // card_1 RS-047「選ぶことはできるが、あえてそれを選んだ場合は何も起こらない」
  // 既知の不具合: CARD-RS-047 ダイナロボ（RS-194）の【ビートハンマー】が選択を開かず、Q&A の状況を作れない（RS-194 側）
  it.fails("RS-047: 公式Q&A — ダイナロボで BP5000以上のMユニットのカードを選んでも何も起こらない（出典: grnrngr/faq-card-1 RS-047 Q1）", () => {
    let s = st({
      player1: { rush: [inst("RS-194", "dyna")] },
      player2: { battle: [inst("RS-047", "sg")], command: [released("RS-043", "pat")] },
    });
    s = enter(s, "RS-194:dyna");
    const pick = legal(s).find(
      (a) => a.type === "resolve_effect_choice" && a.instanceId === "RS-043:pat",
    );
    expect(pick).toBeDefined();
    s = act(s, pick!);
    expect(zoneOf(s, "player2", "RS-043:pat")).toBe("command");
    expect(zoneIds(s, "player2", "battle")).toEqual(["RS-047:sg"]);
  });

  // 一般ルール R-RUSH-20 補足（効果でバトルエリアに出す場合も「出られない」制限は適用）
  it("RS-047: 効果でバトルエリアに出す場合も BP5000以上のMユニットは出られない（パワーバズーカで戻る爆竜ティラノサウルス）（出典: atwiki/page-284、R-RUSH-20）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-009", "baz")], command: [released("TST-OP-ET", "c1")], power: powerCards(8) },
      player2: {
        battle: [inst("RS-050", "ao"), inst("RS-047", "sg")],
        discard: [inst("RS-051", "m1"), inst("RS-053", "m3")],
        command: releasedN(3, "TST-OP", "x"),
      },
    });
    s = bazooka(s);
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-050:ao")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-051:m1")).not.toBe("battle");
  });
});

// ===========================================================================
describe("RS-048 ブルーレーサー", () => {
  // atwiki/page-285「【ヘアピンキック】「SP1」」
  it("RS-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-285）", () => {
    expectCatalogText("RS-048", "【ヘアピンキック】「SP1」");
    expectStats("RS-048", {
      name: "ブルーレーサー",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 0,
      comboNumber: 4,
      features: ["ブルー", "男"],
    });
  });

  // 「CN：4」「【ヘアピンキック】「SP1」」
  it("RS-048: 4番目にコンビネーションすると「SP1」を得てストライクで1点与える（出典: atwiki/page-285）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-048", "b")] },
      player2: { power: powerCards(3) },
    });
    s = enter(s, "RS-048:b");
    expect(canStrike(s, "RS-048:b")).toBe(true);
    s = settle(strike(s, "RS-048:b"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「SP：！」— NC が成立しなければストライクできない
  it("RS-048: 4番目以外（1番目）ではSPを得ずストライクできない（出典: atwiki/page-285）", () => {
    let s = st({ player1: { rush: [inst("RS-048", "b")] } });
    s = enter(s, "RS-048:b");
    expect(canStrike(s, "RS-048:b")).toBe(false);
  });
});

// ===========================================================================
describe("RS-049 グリーンレーサー", () => {
  const ES = sUnit("SPEC-ES", { bp: 1000 });
  const EM = sUnit("SPEC-EM", { size: "M", bp: 3000 });

  // atwiki/page-286「【ピットインダイブ】「SP1」敵軍ラッシュエリアにあるすべてのSユニットを…」
  it("RS-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-286）", () => {
    expectCatalogText(
      "RS-049",
      "【ピットインダイブ】「SP1」敵軍ラッシュエリアにあるすべてのSユニットをバトルエリアに出してもよい（出す順番は自分が選ぶ）。",
    );
    expectStats("RS-049", {
      name: "グリーンレーサー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 4,
      features: ["グリーン", "男"],
    });
  });

  function greenEntered() {
    let s = st(
      {
        player1: { battle: fillers(3), rush: [inst("RS-049", "g")] },
        player2: { rush: [inst("SPEC-ES", "e1"), inst("SPEC-ES", "e2"), inst("SPEC-EM", "m")], power: powerCards(3) },
      },
      [ES, EM],
    );
    s = enter(s, "RS-049:g");
    return s;
  }

  it("RS-049: 4番目で「SP1」を得る（出典: atwiki/page-286）", () => {
    const s = greenEntered();
    expect(unitIn(s, "player1", "RS-049:g")?.spModifier).toBe(1);
  });

  // 「すべてのSユニットをバトルエリアに出してもよい（出す順番は自分が選ぶ）」
  it("RS-049: 敵軍ラッシュエリアのSユニットすべてを自分が選んだ順に敵軍バトルエリアへ出す（Mユニットは対象外）（出典: atwiki/page-286）", () => {
    let s = greenEntered();
    expect(s.pendingEffectChoice?.validInstanceIds?.slice().sort()).toEqual(["SPEC-ES:e1", "SPEC-ES:e2"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-ES:e2" });
    s = settle(s);
    if (s.pendingEffectChoice) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-ES:e1" });
      s = settle(s);
    }
    expect(zoneIds(s, "player2", "battle")).toEqual(["SPEC-ES:e2", "SPEC-ES:e1"]);
    expect(zoneIds(s, "player2", "rush")).toEqual(["SPEC-EM:m"]);
  });

  // 「出してもよい」
  it("RS-049: 出さないことを選べる（任意）（出典: atwiki/page-286）", () => {
    let s = greenEntered();
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player2.battle).toHaveLength(0);
    expect(s.players.player2.rush).toHaveLength(3);
  });

  // card_1 RS-049「自分のターンが回ってきた時点で、そのターンは…ラッシュしたターンではないと判断します」
  it("RS-049: 公式Q&A — 相手が前のターンにラッシュしたデカレッドもバトルエリアに出させられる（出典: grnrngr/faq-card-1 RS-049 Q1）", () => {
    let s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { battle: fillers(3), rush: [inst("RS-049", "g")], deck: deckCards(5) },
      player2: {
        hand: [inst("RS-106", "deka")],
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(3),
        deck: deckCards(5, "e"),
      },
    });
    const r = rushFromHand(s, "player2", "RS-106:deka");
    expect(r.ok).toBe(true);
    s = endTurn(r.state);
    s = advanceToBattle(s, "player1");
    // スタートフェイズで戻ったユニットを並べ直す: フィラー3体を出してから4番目にグリーンレーサー
    for (const f of ["TST-UNIT-0:fill0", "TST-UNIT-0:fill1", "TST-UNIT-0:fill2"]) {
      if (zoneOf(s, "player1", f) === "rush") s = passEntry(enter(s, f));
    }
    s = enter(s, "RS-049:g");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("RS-106:deka");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-106:deka" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-106:deka")).toBe("battle");
  });

  // card_1 RS-027「「RS-049 グリーンレーサー」の「ピットインダイブ」によって…「RS-027 ダイノガッツ」を発動させることができます」
  it("RS-049: 公式Q&A — ピットインダイブで出されるユニットの持ち主はダイノガッツを発動できる（出典: grnrngr/faq-card-1 RS-027）", () => {
    let s = st(
      {
        player1: { battle: fillers(3), rush: [inst("RS-049", "g")] },
        player2: {
          rush: [inst("SPEC-ES", "e1")],
          hand: [inst("RS-027", "guts")],
          command: [released("TST-OP", "wb")],
          deck: deckCards(3, "e"),
        },
      },
      [ES],
    );
    s = enter(s, "RS-049:g");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-ES:e1" });
    const canGuts = legal(s).some(
      (a) =>
        a.playerId === "player2" &&
        ((a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-027:guts") ||
          (a.type === "play_counter" && a.instanceId === "RS-027:guts")),
    );
    expect(canGuts).toBe(true);
  });
});

// ===========================================================================
describe("RS-050 アバレンオー", () => {
  // atwiki/page-77「【爆竜電撃ドリルスピン】これがバトルエリアに出たとき、敵軍バトルエリアから、BP4000以下の…」
  it("RS-050: カタログ本文が出典と一致（出典: atwiki/page-77）", () => {
    expectCatalogText(
      "RS-050",
      "合体―爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン【爆竜電撃ドリルスピン】これがバトルエリアに出たとき、敵軍バトルエリアから、BP4000以下のユニットを1体選んで撃破する。",
    );
  });

  it("RS-050: スペック（L・BP13000・SP1・必要パワー7+・追加条件「自軍合体ユニットを捨札にする」）が出典と一致（出典: atwiki/page-77）", () => {
    expectStats("RS-050", {
      name: "アバレンオー",
      category: "WB",
      size: "L",
      bp: 13000,
      sp: 1,
      powerCost: "7+",
      features: ["恐竜", "人型"],
    });
    expect(DEFS["RS-050"]!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });

  function abarenohRush(power: number, rush: string[]) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-050", "ao")],
        rush: rush.map((id, i) => inst(id, `m${i}`)),
        power: powerCards(power),
        command: [released("TST-OP", "wb")],
      },
    });
  }

  // 「合体―爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン」「必要パワー：7+」
  it("RS-050: 合体ユニット3体を自軍エリアから捨札にしてラッシュする（出典: atwiki/page-77、R-ADD-06）", () => {
    const s = abarenohRush(7, ["RS-051", "RS-052", "RS-053"]);
    const r = rushFromHand(s, "player1", "RS-050:ao");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-050:ao")).toBe("rush");
    for (const m of ["RS-051:m0", "RS-052:m1", "RS-053:m2"]) {
      expect(zoneOf(r.state, "player1", m)).toBe("discard");
    }
  });

  it("RS-050: 合体ユニットが欠ける、またはパワー6ではラッシュできない（出典: atwiki/page-77）", () => {
    expect(canStartRushHelper(abarenohRush(7, ["RS-051", "RS-052"]), "RS-050:ao")).toBe(false);
    expect(canStartRushHelper(abarenohRush(6, ["RS-051", "RS-052", "RS-053"]), "RS-050:ao")).toBe(false);
  });

  function abarenohEnters(enemyBattle: ReturnType<typeof inst>[], extra: Parameters<typeof st>[1] = []) {
    let s = st(
      {
        player1: { rush: [inst("RS-050", "ao")] },
        player2: { battle: enemyBattle, rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") },
      },
      extra,
    );
    s = enter(s, "RS-050:ao");
    return s;
  }

  // 「敵軍バトルエリアから、BP4000以下のユニットを1体選んで撃破する」
  it("RS-050: バトルエリアに出たとき、敵軍バトルエリアのBP4000以下のユニットだけが選択肢になる（出典: atwiki/page-77）", () => {
    const big = sUnit("SPEC-BP5000", { bp: 5000 });
    const s = abarenohEnters([inst("TST-UNIT-2", "d3000"), inst("SPEC-BP5000", "d5000")], [big]);
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["TST-UNIT-2:d3000"]);
  });

  // 既知の不具合: CARD-RS-050 【爆竜電撃ドリルスピン】が「撃破」ではなく単なる捨札移動で、撃破時効果（アバレッドの1点）が発生しない
  it.fails("RS-050: 選んだユニットを撃破する（撃破なのでアバレッドの「撃破されたとき1点」が発生する）（出典: atwiki/page-77）", () => {
    let s = abarenohEnters([inst("RS-054", "red")]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-054:red" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-054:red")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  // 「撃破する」（「してもよい」ではない）
  it("RS-050: 対象がいれば撃破は強制（スキップできない）（出典: atwiki/page-77）", () => {
    const s = abarenohEnters([inst("TST-UNIT-2", "d3000")]);
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(0);
  });

  // card_1 RS-050「そのテキストは有効になります」
  it("RS-050: 公式Q&A — パワーバズーカで戻す素材にも「ホールドしなければ出られない」が有効（ホールドできなければ戻らない）（出典: grnrngr/faq-card-1 RS-050 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-009", "baz")], command: [released("TST-OP-ET", "c1")], power: powerCards(8) },
      player2: {
        battle: [inst("RS-050", "ao")],
        discard: [inst("RS-051", "m1"), inst("RS-052", "m2"), inst("RS-053", "m3")],
        command: [released("TST-OP", "x0")],
      },
    });
    s = bazooka(s);
    s = settle(s);
    expect(s.players.player2.battle).toHaveLength(1);
    expect(s.players.player2.command.every((c) => c.commandHeld === true)).toBe(true);
  });

  // card_1 RS-009「「RS-053 爆竜プテラノドン」だけをバトルエリアに戻します」
  it("RS-050: 公式Q&A — 捨札にプテラノドンしかなければそれだけを戻す（出典: grnrngr/faq-card-1 RS-009）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-009", "baz")], command: [released("TST-OP-ET", "c1")], power: powerCards(8) },
      player2: { battle: [inst("RS-050", "ao")], discard: [inst("RS-053", "m3")], command: releasedN(3, "TST-OP", "x") },
    });
    s = bazooka(s);
    s = settle(s);
    expect(zoneIds(s, "player2", "battle")).toEqual(["RS-053:m3"]);
  });

  // card_1 RS-009「この場合は「RS-050 アバレンオー」が捨札にならずにバトルエリアに残るだけ」
  it("RS-050: 公式Q&A — トリケラトプスの【超シールド進化】で残ったアバレンオーの素材は戻らない（出典: grnrngr/faq-card-1 RS-009）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-009", "baz")], command: [released("TST-OP-ET", "c1")], power: powerCards(8) },
      player2: {
        battle: [inst("RS-050", "ao"), inst("RS-052", "tri")],
        discard: [inst("RS-051", "m1"), inst("RS-053", "m3")],
        command: releasedN(3, "TST-OP", "x"),
      },
    });
    s = bazooka(s);
    s = actLegal(s, (a) => a.type === "use_super_shield");
    s = settle(s);
    expect(zoneIds(s, "player2", "battle")).toEqual(["RS-050:ao"]);
    expect(zoneIds(s, "player2", "discard")).toEqual(expect.arrayContaining(["RS-051:m1", "RS-053:m3", "RS-052:tri"]));
  });
});

function bazooka(s: ReturnType<typeof st>) {
  const r = playOp(s, "player1", "RS-009:baz", "RS-050:ao");
  if (!r.ok) throw new Error(`bazooka failed: ${r.error}`);
  return r.state;
}

function canStartRushHelper(s: ReturnType<typeof st>, id: string, playerId: "player1" | "player2" = "player1") {
  return canStartRush(s, playerId, id);
}

// ===========================================================================
describe("RS-051 爆竜ティラノサウルス", () => {
  // 08-errata R-ERR-RS051（atwiki/page-83「このテキストは修正されています。修正後は以下。」）
  it("RS-051: カタログ本文が修正後テキストと一致（出典: atwiki/page-83、08-errata R-ERR-RS051）", () => {
    expectCatalogText(
      "RS-051",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【超ドリル進化】自軍ターン中、これがバトルエリアに出たとき、自分の手札から「爆竜ティラノサウルス」のカードを1枚捨札にしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP1」",
    );
    expectStats("RS-051", {
      name: "爆竜ティラノサウルス",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: "special",
      powerCost: 4,
      features: ["恐竜"],
    });
  });

  // 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」
  it("RS-051: リリース状態のコマンドがなければバトルエリアに出られない（出典: atwiki/page-83）", () => {
    const s = st({ player1: { rush: [inst("RS-051", "t")], command: heldN(2) } });
    expect(canEnter(s, "RS-051:t")).toBe(false);
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-051:t" }).ok).toBe(false);
  });

  it("RS-051: コマンドを1つホールドしてバトルエリアに出る（出典: atwiki/page-83）", () => {
    let s = st({ player1: { rush: [inst("RS-051", "t")], command: releasedN(2, "TST-OP", "c") } });
    s = enterHold(s, "RS-051:t");
    expect(zoneOf(s, "player1", "RS-051:t")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // card_1 RS-051「カテゴリ名を指定されていないので、どのカテゴリでも構いません」
  it("RS-051: 公式Q&A — ホールドするコマンドのカテゴリは問わない（OTのコマンドでよい）（出典: grnrngr/faq-card-1 RS-051 Q1）", () => {
    let s = st({ player1: { rush: [inst("RS-051", "t")], command: [released("TST-OP-OT", "ot")] } });
    s = enterHold(s, "RS-051:t");
    expect(zoneOf(s, "player1", "RS-051:t")).toBe("battle");
    expect(s.players.player1.command[0]!.commandHeld).toBe(true);
  });

  function tyrannoEnters(hand: ReturnType<typeof inst>[]) {
    let s = st({
      player1: { rush: [inst("RS-051", "t")], hand, command: releasedN(1, "TST-OP", "c") },
      player2: { power: powerCards(3) },
    });
    s = enterHold(s, "RS-051:t");
    return s;
  }

  // 「自軍ターン中、これがバトルエリアに出たとき、自分の手札から「爆竜ティラノサウルス」のカードを1枚捨札にしてもよい。そうしたとき…「SP1」」
  it("RS-051: 自軍ターンに出たとき手札の爆竜ティラノサウルスを捨札にすると「SP1」を得てストライクで1点（出典: atwiki/page-83）", () => {
    let s = tyrannoEnters([inst("RS-051", "h")]);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("RS-051:h");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-051:h" });
    expect(zoneOf(s, "player1", "RS-051:h")).toBe("discard");
    expect(unitIn(s, "player1", "RS-051:t")?.spModifier).toBe(1);
    s = settle(strike(s, "RS-051:t"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-051: 捨札にしないことを選べ、その場合は「SP1」を得ずストライクできない（出典: atwiki/page-83）", () => {
    let s = tyrannoEnters([inst("RS-051", "h")]);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "RS-051:h")).toBe("hand");
    expect(canStrike(s, "RS-051:t")).toBe(false);
  });

  it("RS-051: 手札に「爆竜ティラノサウルス」が無ければ他のカードは捨てられない（出典: atwiki/page-83）", () => {
    const s = tyrannoEnters([inst("RS-052", "other")]);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("RS-052:other");
    expect(canStrike(s, "RS-051:t")).toBe(false);
  });

  // 修正後「自軍ターン中、」
  it("RS-051: 相手ターン中にバトルエリアに出ても【超ドリル進化】は発動しない（パワーバズーカで戻った場合）（出典: atwiki/page-83 修正後テキスト）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-009", "baz")], command: [released("TST-OP-ET", "c1")], power: powerCards(8) },
      player2: {
        battle: [inst("RS-050", "ao")],
        discard: [inst("RS-051", "t")],
        hand: [inst("RS-051", "h")],
        command: releasedN(2, "TST-OP", "x"),
      },
    });
    s = bazooka(s);
    expect(zoneOf(s, "player2", "RS-051:t")).toBe("battle");
    expect(s.pendingEffectChoice?.effectId).not.toBe("super_drill");
    expect(zoneOf(s, "player2", "RS-051:h")).toBe("hand");
  });

  // card_1 RS-051「「超ドリル進化」を起動できるのは、場の「爆竜ティラノサウルス」のうちの１体だけです」
  it("RS-051: 公式Q&A — 手札1枚の捨札で「SP1」を得るのは発動した1体だけ（場にいる別のティラノは得ない）（出典: grnrngr/faq-card-1 RS-051 Q2）", () => {
    let s = st({
      player1: {
        battle: [inst("RS-051", "a")],
        rush: [inst("RS-051", "b")],
        hand: [inst("RS-051", "h")],
        command: releasedN(1, "TST-OP", "c"),
      },
    });
    s = enterHold(s, "RS-051:b");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-051:h" });
    expect(unitIn(s, "player1", "RS-051:b")?.spModifier).toBe(1);
    expect(unitIn(s, "player1", "RS-051:a")?.spModifier ?? 0).toBe(0);
  });

  // card_1 RS-051「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます。それ以外のタイミングでは発動できません」
  it("RS-051: 公式Q&A — 好きなタイミングでは発動できない（すでにバトルエリアにいるティラノは手札を捨てて起動できない）（出典: grnrngr/faq-card-1 RS-051 Q3）", () => {
    for (const phase of ["rush", "battle"] as const) {
      const s = st({
        phase,
        player1: { battle: [inst("RS-051", "t")], hand: [inst("RS-051", "h")], command: releasedN(1) },
      });
      const uses = legal(s).filter((a) => JSON.stringify(a).includes("RS-051:h"));
      expect(uses).toHaveLength(0);
    }
  });
});

// ===========================================================================
describe("RS-052 爆竜トリケラトプス", () => {
  // errata.html 正（R-ERR-RS052）
  it("RS-052: カタログ本文が公式エラッタ後テキストと一致（出典: grnrngr/errata RS-052）", () => {
    expectCatalogText(
      "RS-052",
      "※これは自軍コマンドを１つホールドしなければバトルエリアに出られない。【超シールド進化】「ワイルドビースト」の自軍ユニットが撃破されるとき、このユニットをかわりに捨札にしてもよい。",
    );
    expectStats("RS-052", {
      name: "爆竜トリケラトプス",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["恐竜"],
    });
  });

  it("RS-052: ※ — コマンドを1つホールドしなければバトルエリアに出られない（出典: grnrngr/errata RS-052）", () => {
    let s = st({ player1: { rush: [inst("RS-052", "tri")], command: heldN(1) } });
    expect(canEnter(s, "RS-052:tri")).toBe(false);
    s = st({ player1: { rush: [inst("RS-052", "tri")], command: releasedN(1) } });
    s = enterHold(s, "RS-052:tri");
    expect(zoneOf(s, "player1", "RS-052:tri")).toBe("battle");
    expect(s.players.player1.command[0]!.commandHeld).toBe(true);
  });

  function attackedWb(opts: { defender?: ReturnType<typeof inst>; triZone?: "battle" | "rush"; extra?: Parameters<typeof st>[1] } = {}) {
    const def = opts.defender ?? inst("TST-UNIT-0", "wb");
    const tri = inst("RS-052", "tri");
    let s = st(
      {
        player1: { battle: [inst("TST-UNIT-7", "atk")] },
        player2: {
          battle: opts.triZone === "rush" ? [def] : [def, tri],
          rush: opts.triZone === "rush" ? [tri] : [],
          deck: deckCards(3, "e"),
          power: powerCards(3),
        },
      },
      opts.extra ?? [],
    );
    s = attack(s, "TST-UNIT-7:atk", def.instanceId);
    return { s, def, tri };
  }

  it("RS-052: WBの自軍ユニットが撃破されるとき、かわりにトリケラトプスを捨札にできる（出典: grnrngr/errata RS-052）", () => {
    let { s, def, tri } = attackedWb();
    expect(legalOfType(s, "use_super_shield")).toHaveLength(1);
    s = actLegal(s, (a) => a.type === "use_super_shield");
    s = settle(s);
    expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
    expect(zoneOf(s, "player2", tri.instanceId)).toBe("discard");
  });

  it("RS-052: 使わないことも選べる（任意）（出典: grnrngr/errata RS-052「捨札にしてもよい」）", () => {
    let { s, def, tri } = attackedWb();
    const decline = legal(s).find((a) => a.playerId === "player2" && a.type !== "use_super_shield");
    expect(decline).toBeDefined();
    s = settle(act(s, decline!));
    expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
    expect(zoneOf(s, "player2", tri.instanceId)).toBe("battle");
  });

  // 「「ワイルドビースト」の自軍ユニット」
  it("RS-052: WB以外のカテゴリの自軍ユニットは守れない（出典: grnrngr/errata RS-052）", () => {
    const ot = sUnit("SPEC-OT", { category: "OT", bp: 1000 });
    const { s } = attackedWb({ defender: inst("SPEC-OT", "ot"), extra: [ot] });
    expect(legalOfType(s, "use_super_shield")).toHaveLength(0);
  });

  // card_1 RS-052 Q5「ユニットとして場に出ているときにだけ発動できます」— 場 = ラッシュエリア・バトルエリア
  // 既知の不具合: CARD-RS-052 【超シールド進化】がバトルエリアのトリケラにしか発動できない（ラッシュエリアの場合も「場」にあるユニット）
  it.fails("RS-052: 自軍ラッシュエリアにいるトリケラトプスでも（ユニットとして場にあれば）使える（出典: grnrngr/faq-card-1 RS-052 Q5）", () => {
    const { s } = attackedWb({ triZone: "rush" });
    expect(legalOfType(s, "use_super_shield")).toHaveLength(1);
  });

  // card_1 RS-052 Q1（ゴレンジャーハリケーン）
  it.todo(
    "RS-052: 公式Q&A — ゴレンジャーハリケーンの対象の1体目を2体目のトリケラが守れば、1体目は場にとどまる（出典: grnrngr/faq-card-1 RS-052 Q1）— RS-259 の5体コンビネーション（キ→ミド→アオ→アカ）を組み、撃破順をターンプレイヤーが1体ずつ選ぶ公開 API が無く状況を構成できない",
  );

  // card_1 RS-052 Q2「「RS-052 爆竜トリケラトプス」自身は撃破扱いにならないため」
  it("RS-052: 公式Q&A — かわりに捨札になったトリケラはレスキューファイターの【救護活動】でパワーゾーンに送られない（出典: grnrngr/faq-card-1 RS-052 Q2）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("TST-UNIT-0", "wb"), inst("RS-052", "tri")],
        rush: [inst("RS-089", "rescue")],
        deck: deckCards(3, "e"),
      },
    });
    s = attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:wb");
    s = settle(actLegal(s, (a) => a.type === "use_super_shield"));
    expect(zoneOf(s, "player2", "RS-052:tri")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-052:tri")).not.toBe("power");
  });

  // card_1 RS-052 Q3「かわりのユニットが捨札になっても効果は適用されません」
  it("RS-052: 公式Q&A — ジャイアントローラー指定ユニットが撃破したWBユニットのかわりにトリケラが捨札になってもダメージにはならない（出典: grnrngr/faq-card-1 RS-052 Q3）", () => {
    const strong = sUnit("SPEC-S9000", { category: "MA", bp: 9000 });
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-182", "roller")],
          rush: [inst("SPEC-S9000", "a")],
          command: [released("TST-OP-MA", "ma")],
          power: powerCards(6),
          deck: deckCards(3),
        },
        player2: { battle: [inst("TST-UNIT-0", "wb"), inst("RS-052", "tri")], deck: deckCards(3, "e") },
      },
      [strong],
    );
    const r = playOp(s, "player1", "RS-182:roller", "SPEC-S9000:a");
    expect(r.ok).toBe(true);
    s = settle(r.state);
    if (s.pendingEffectChoice) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-S9000:a" });
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = enter(s, "SPEC-S9000:a");
    s = attack(s, "SPEC-S9000:a", "TST-UNIT-0:wb");
    s = settle(actLegal(s, (a) => a.type === "use_super_shield"));
    expect(zoneOf(s, "player2", "RS-052:tri")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  // card_1 RS-052 Q4「はい、使用できます。」
  // 既知の不具合: CARD-RS-052 【超シールド進化】でトリケラが捨札になるとき「場を離れるとき」の応答（ダイノガッツ等）の機会が開かない
  it.fails("RS-052: 公式Q&A — 【超シールド進化】で捨札になるトリケラに対してダイノガッツを使える（出典: grnrngr/faq-card-1 RS-052 Q4）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: {
        battle: [inst("TST-UNIT-0", "wb"), inst("RS-052", "tri")],
        hand: [inst("RS-027", "guts")],
        command: [released("TST-OP", "c")],
        deck: deckCards(5, "e"),
      },
    });
    s = attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:wb");
    s = actLegal(s, (a) => a.type === "use_super_shield");
    const canGuts = legal(s).some(
      (a) =>
        a.playerId === "player2" &&
        ((a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-027:guts") ||
          (a.type === "play_counter" && a.instanceId === "RS-027:guts")),
    );
    expect(canGuts).toBe(true);
  });

  // card_1 RS-052 Q5
  it("RS-052: 公式Q&A — 手札のトリケラを捨札にして【超シールド進化】は使えない（出典: grnrngr/faq-card-1 RS-052 Q5）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: { battle: [inst("TST-UNIT-0", "wb")], hand: [inst("RS-052", "tri-h")], deck: deckCards(3, "e") },
    });
    s = attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:wb");
    expect(legalOfType(s, "use_super_shield")).toHaveLength(0);
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:wb")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-052:tri-h")).toBe("hand");
  });

  // card_1 RS-052 Q6「撃破されたことを無効にはできません」
  it("RS-052: 公式Q&A — 守ったアバレッドの「撃破されたとき1点ダメージ」は発生する（出典: grnrngr/faq-card-1 RS-052 Q6）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-7", "atk")] },
      player2: { battle: [inst("RS-054", "red"), inst("RS-052", "tri")], deck: deckCards(3, "e"), power: powerCards(3) },
    });
    s = attack(s, "TST-UNIT-7:atk", "RS-054:red");
    s = settle(actLegal(s, (a) => a.type === "use_super_shield"));
    expect(zoneOf(s, "player2", "RS-054:red")).toBe("battle");
    expect(s.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("RS-053 爆竜プテラノドン", () => {
  // atwiki/page-85「【超カッター進化】これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。」
  it("RS-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-85）", () => {
    expectCatalogText(
      "RS-053",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【超カッター進化】これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。",
    );
    expectStats("RS-053", {
      name: "爆竜プテラノドン",
      category: "WB",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      features: ["恐竜"],
    });
  });

  it("RS-053: ※ — コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-85）", () => {
    let s = st({ player1: { rush: [inst("RS-053", "p")], command: heldN(1) } });
    expect(canEnter(s, "RS-053:p")).toBe(false);
    s = st({ player1: { rush: [inst("RS-053", "p")], command: releasedN(1) } });
    s = enterHold(s, "RS-053:p");
    expect(zoneOf(s, "player1", "RS-053:p")).toBe("battle");
  });

  // 「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」
  it("RS-053: アタックするとき、BP修正（+3000）を受けた敵軍ユニット（本来BP1000）を本来の値でバトルして撃破する（出典: atwiki/page-85）", () => {
    let s = st({
      player1: { battle: [inst("RS-053", "p")] },
      player2: { battle: [{ ...inst("TST-UNIT-0", "d"), bpModifier: 3000 }], deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "RS-053:p", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-053:p")).toBe("battle");
  });

  it("RS-053: 対照 — 【超カッター進化】のない BP3000 ユニットは同じ相手（BP4000）に負ける（出典: atwiki/page-85）", () => {
    const plain = sUnit("SPEC-S3000", { bp: 3000, size: "M" });
    let s = st(
      {
        player1: { battle: [inst("SPEC-S3000", "p")] },
        player2: { battle: [{ ...inst("TST-UNIT-0", "d"), bpModifier: 3000 }], deck: deckCards(3, "e") },
      },
      [plain],
    );
    s = settle(attack(s, "SPEC-S3000:p", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player1", "SPEC-S3000:p")).toBe("discard");
  });

  // 「これがアタックするとき」— アタックされたときは適用しない
  it("RS-053: アタックされたときは適用されない（BP修正を受けた相手にアタックされると撃破される）（出典: atwiki/page-85）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-053", "p")], deck: deckCards(3) },
      player2: { battle: [{ ...inst("TST-UNIT-0", "a"), bpModifier: 3000 }] },
    });
    s = settle(attack(s, "TST-UNIT-0:a", "RS-053:p", "player2"));
    expect(zoneOf(s, "player1", "RS-053:p")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-054 アバレッド", () => {
  // atwiki/page-54
  it("RS-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-54）", () => {
    expectCatalogText(
      "RS-054",
      "※これが撃破されたとき、1点ダメージを受ける。※これは毎ターン、可能ならバトルエリアに出る。【ティラノロッド】「SP1」",
    );
    expectStats("RS-054", {
      name: "アバレッド",
      category: "WB",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 0,
      comboNumber: 2,
      features: ["レッド", "男"],
    });
  });

  // 「※これが撃破されたとき、1点ダメージを受ける。」
  it("RS-054: 撃破されたとき持ち主が1点ダメージを受ける（出典: atwiki/page-54）", () => {
    let s = st({
      player1: { battle: [inst("RS-054", "red")], power: powerCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "d")], deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "RS-054:red", "TST-UNIT-2:d"));
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("discard");
    expect(s.players.player1.damage).toBe(1);
  });

  // 「※これは毎ターン、可能ならバトルエリアに出る。」
  it("RS-054: バトルエリアに出られるのに出さずにバトルフェイズを終えることはできない（出典: atwiki/page-54）", () => {
    const s = st({ player1: { rush: [inst("RS-054", "red")] } });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
    expect(canEnter(s, "RS-054:red")).toBe(true);
  });

  it("RS-054: CN2 — 2番目にコンビネーションすると「SP1」を得てストライクで1点（出典: atwiki/page-54）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-054", "red")] }, player2: { power: powerCards(3) } });
    s = enter(s, "RS-054:red");
    expect(canStrike(s, "RS-054:red")).toBe(true);
    s = settle(strike(s, "RS-054:red"));
    expect(s.players.player2.damage).toBe(1);
  });

  function redAttackedInOpponentTurn(handOp: string) {
    let s = st({
      activePlayer: "player2",
      player1: {
        battle: [inst("RS-054", "red")],
        hand: [inst(handOp, "op")],
        discard: [inst("RS-054", "red2")],
        command: [released("TST-OP", "c")],
        power: powerCards(4),
        deck: deckCards(5),
      },
      player2: { battle: [inst("TST-UNIT-2", "atk")] },
    });
    s = attack(s, "TST-UNIT-2:atk", "RS-054:red", "player2");
    return s;
  }

  function useLeaveCounter(s: ReturnType<typeof st>, opId: string) {
    const a = legal(s).find(
      (x) =>
        x.playerId === "player1" &&
        ((x.type === "initiate_command_payment" && x.sourceInstanceId === opId) ||
          (x.type === "play_counter" && x.instanceId === opId)),
    );
    expect(a, "カウンターを発動できる").toBeDefined();
    return settle(act(s, a!));
  }

  // card_1 RS-054「「RS-016 ダイノ伝記」には、撃破されたことを無効にする効果はありません」
  it("RS-054: 公式Q&A — ダイノ伝記で場に留まっても1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-054 Q1）", () => {
    let s = redAttackedInOpponentTurn("RS-016");
    s = useLeaveCounter(s, "RS-016:op");
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("battle");
    expect(s.players.player1.damage).toBe(1);
  });

  // card_1 RS-054「「RS-027 ダイノガッツ」には、撃破されたことを無効にする効果はありません」
  it("RS-054: 公式Q&A — ダイノガッツで場に留まっても1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-054 Q2）", () => {
    let s = redAttackedInOpponentTurn("RS-027");
    s = useLeaveCounter(s, "RS-027:op");
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("battle");
    expect(s.players.player1.damage).toBe(1);
  });

  // card_1 RS-054 Q3（=RS-052 Q6）
  it("RS-054: 公式Q&A — 爆竜トリケラトプスの【超シールド進化】で場に留まっても1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-054 Q3）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-054", "red"), inst("RS-052", "tri")], power: powerCards(3), deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "atk")] },
    });
    s = attack(s, "TST-UNIT-2:atk", "RS-054:red", "player2");
    s = settle(actLegal(s, (a) => a.type === "use_super_shield"));
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("battle");
    expect(s.players.player1.damage).toBe(1);
  });

  // card_1 RS-054「同時に７点目のダメージを受けた場合はターンプレイヤーがゲームに勝利します」
  // 既知の不具合: CARD-RS-054 同時に7点目のとき勝者がターンプレイヤーにならない（player2 固定。E1）
  it.fails("RS-054: 公式Q&A — 相討ちで互いに7点目を受けたらターンプレイヤーの勝ち（出典: grnrngr/faq-card-1 RS-054 Q4）", () => {
    let s = st({
      player1: { battle: [inst("RS-054", "r1")], damage: 6, power: powerCards(7) },
      player2: { battle: [inst("RS-054", "r2")], damage: 6, power: powerCards(7), deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "RS-054:r1", "RS-054:r2"));
    expect(zoneOf(s, "player1", "RS-054:r1")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-054:r2")).toBe("discard");
    expect(s.winner).toBe("player1");
  });

  // card_1/atwiki RS-054 Q5「ユニットとして自軍エリアにラッシュされていなければ…このテキストは無効」
  it("RS-054: 公式Q&A — パワーゾーン・コマンドゾーン・捨札でオモテ向きのアバレッドは「可能ならバトルエリアに出る」を強制しない（出典: atwiki/page-54 Q5）", () => {
    const s = st({
      player1: {
        power: [{ ...inst("RS-054", "p"), faceDown: false }],
        command: [released("RS-054", "c")],
        discard: [inst("RS-054", "d")],
      },
    });
    expect(legalOfType(s, "end_phase")).toHaveLength(1);
  });

  // card_1 RS-054「はい、出す事ができます。」（シーロンの光でアバレッドAMを選ばれたとき）
  it("RS-054: 公式Q&A — シーロンの光でアバレッドAMが選ばれたとき、パワー6以下でもアバレッドを捨札にして出せる（出典: grnrngr/faq-card-1 RS-054）", () => {
    let s = st({
      phase: "rush",
      player1: {
        operation: [inst("RS-013", "shiron")],
        hand: [inst("RS-230", "am")],
        rush: [inst("RS-054", "red")],
        power: powerCards(4),
        command: [released("TST-OP", "c")],
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });
    s = act(s, { type: "shiron_light", playerId: "player1", operationInstanceId: "RS-013:shiron" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-230:am" });
    s = act(s, { type: "confirm_shiron_reveal", playerId: "player2" });
    for (let i = 0; i < 6; i += 1) {
      const a =
        legal(s).find((x) => x.type === "rush" && x.instanceId === "RS-230:am") ??
        legal(s).find((x) => x.type === "resolve_effect_choice" && x.instanceId === "RS-054:red") ??
        legal(s).find((x) => x.type === "resolve_zord_setup") ??
        legal(s).find((x) => x.type === "confirm_effect_choice") ??
        legal(s).find((x) => x.type === "resolve_effect_choice" && x.instanceId === "RS-230:am");
      if (!a) break;
      s = act(s, a);
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-230:am")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-055 アバレブルー", () => {
  it("RS-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-237）", () => {
    expectCatalogText("RS-055", "※これは毎ターン、可能ならバトルエリアに出る。【トリケラバンカー】「SP1」");
    expectStats("RS-055", {
      name: "アバレブルー",
      category: "WB",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 1,
      comboNumber: 2,
      features: ["ブルー", "男"],
    });
  });

  it("RS-055: ※ — バトルエリアに出られるのに出さずにバトルフェイズを終えられない（出典: atwiki/page-237）", () => {
    const s = st({ player1: { rush: [inst("RS-055", "b")] } });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
  });

  it("RS-055: ※ — 出られない状況（バトルエリア満員）ならバトルフェイズを終えられる（「可能なら」）（出典: atwiki/page-237）", () => {
    const s = st({ player1: { rush: [inst("RS-055", "b")], battle: fillers(5) } });
    if (canEnter(s, "RS-055:b")) {
      // バトルエリアの上限が無いエンジンでは状況を作れない
      expect(legalOfType(s, "end_phase")).toHaveLength(0);
    } else {
      expect(legalOfType(s, "end_phase")).toHaveLength(1);
    }
  });

  it("RS-055: CN2 — 2番目で「SP1」を得てストライクで1点、1番目ではストライクできない（出典: atwiki/page-237）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-055", "b")] }, player2: { power: powerCards(3) } });
    s = enter(s, "RS-055:b");
    s = settle(strike(s, "RS-055:b"));
    expect(s.players.player2.damage).toBe(1);
    let s2 = st({ player1: { rush: [inst("RS-055", "b")] } });
    s2 = enter(s2, "RS-055:b");
    expect(canStrike(s2, "RS-055:b")).toBe(false);
  });
});

// ===========================================================================
describe("RS-056 マジドラゴン", () => {
  it("RS-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-38）", () => {
    expectCatalogText(
      "RS-056",
      "合体―マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス【マジカルドラゴンシュート】「マジフェニックス」からコンビネーションするとき発動できる。このターン、これはBP＋4000される。",
    );
    expectStats("RS-056", {
      name: "マジドラゴン",
      category: "MA",
      size: "L",
      bp: 15000,
      sp: 1,
      powerCost: "6+",
      features: ["魔法", "ドラゴン"],
    });
    expect(DEFS["RS-056"]!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });

  function dragonRush(power: number, mats: string[]) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-056", "dr")],
        rush: mats.map((id, i) => inst(id, `m${i}`)),
        power: powerCards(power),
        command: [released("TST-OP-MA", "ma")],
      },
    });
  }

  // 「合体―マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス」＋各マジレンジャーの「〜としてつかえる」
  it("RS-056: マジイエロー／ブルー／ピンク／グリーン（ガルーダ・マーメイド・フェアリー・タウロスとして）を捨札にしてラッシュできる（出典: atwiki/page-38、page-238・48・239・240）", () => {
    const r = rushFromHand(dragonRush(6, ["RS-058", "RS-059", "RS-060", "RS-061"]), "player1", "RS-056:dr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-056:dr")).toBe("rush");
    for (const m of ["RS-058:m0", "RS-059:m1", "RS-060:m2", "RS-061:m3"]) {
      expect(zoneOf(r.state, "player1", m)).toBe("discard");
    }
  });

  it("RS-056: 合体ユニットが1体欠ける、またはパワー5ではラッシュできない（出典: atwiki/page-38）", () => {
    expect(canStartRush(dragonRush(6, ["RS-058", "RS-059", "RS-060"]), "player1", "RS-056:dr")).toBe(false);
    expect(canStartRush(dragonRush(5, ["RS-058", "RS-059", "RS-060", "RS-061"]), "player1", "RS-056:dr")).toBe(false);
  });

  const BIG = sUnit("SPEC-BP17000", { bp: 17000, size: "L" });
  function dragonEntersAfter(prevId: string) {
    let s = st(
      {
        player1: { battle: [inst(prevId, "prev")], rush: [inst("RS-056", "dr")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BP17000", "big")], deck: deckCards(3, "e") },
      },
      [BIG],
    );
    s = enter(s, "RS-056:dr");
    return s;
  }

  // 「「マジフェニックス」からコンビネーションするとき発動できる。このターン、これはBP＋4000される。」
  // 既知の不具合: CARD-RS-056 本来の「マジフェニックス」（RS-576）からのコンビネーションでは【マジカルドラゴンシュート】が発動しない（マジレッドからは発動）
  it.fails("RS-056: マジフェニックスからコンビネーションするとBP+4000（19000）で BP17000 に勝つ（出典: atwiki/page-38）", () => {
    let s = dragonEntersAfter("RS-576");
    s = settle(attack(s, "RS-056:dr", "SPEC-BP17000:big"));
    expect(zoneOf(s, "player2", "SPEC-BP17000:big")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-056:dr")).toBe("battle");
  });

  it("RS-056: マジフェニックス以外からのコンビネーションではBPは上がらない（出典: atwiki/page-38）", () => {
    let s = dragonEntersAfter("TST-UNIT-0");
    s = settle(attack(s, "RS-056:dr", "SPEC-BP17000:big"));
    expect(zoneOf(s, "player1", "RS-056:dr")).toBe("discard");
  });

  it("RS-056: BP+4000 は「このターン」だけ（ターン終了後は残らない）（出典: atwiki/page-38）", () => {
    let s = dragonEntersAfter("RS-057");
    expect(unitIn(s, "player1", "RS-056:dr")?.bpModifier).toBe(4000);
    s = passEntry(s);
    s = endTurn(s);
    expect(unitIn(s, "player1", "RS-056:dr")?.bpModifier ?? 0).toBe(0);
  });
});

// ===========================================================================
describe("RS-057 マジレッド", () => {
  // atwiki/page-14 の本文は1行目が「これは「マジフェニックス」としてつかえる。」（※なし）。仕様疑義として※の有無は不問にする
  it("RS-057: カタログ本文・スペックが出典と一致（※の有無を除く）（出典: atwiki/page-14）", () => {
    const source = "これは「マジフェニックス」としてつかえる。【レッドファイヤー】「SP1」これはアタックするときリリース状態の自軍コマンド1つにつきBP＋1000される。";
    expect(norm(DEFS["RS-057"]!.text).replace(/^※/, "")).toBe(norm(source));
    expectStats("RS-057", {
      name: "マジレッド",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["レッド", "男", "魔法"],
    });
  });

  function redState(opts: { position: 1 | 3; releasedCmds: number; heldCmds?: number }) {
    return st({
      player1: {
        battle: fillers(opts.position - 1),
        rush: [inst("RS-057", "red")],
        command: [...releasedN(opts.releasedCmds, "TST-OP", "r"), ...heldN(opts.heldCmds ?? 0, "TST-OP", "h")],
        deck: deckCards(3),
      },
      player2: { battle: [inst("TST-UNIT-2", "d")], power: powerCards(3), deck: deckCards(3, "e") },
    });
  }

  // 「「SP1」これはアタックするときリリース状態の自軍コマンド1つにつきBP＋1000される」
  it("RS-057: 3番目で「SP1」を得る（出典: atwiki/page-14）", () => {
    let s = redState({ position: 3, releasedCmds: 0 });
    s = enter(s, "RS-057:red");
    expect(canStrike(s, "RS-057:red")).toBe(true);
    s = settle(strike(s, "RS-057:red"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-057: アタックするときリリース状態の自軍コマンド2つで BP4000 になり BP3000 に勝つ（出典: atwiki/page-14）", () => {
    let s = redState({ position: 3, releasedCmds: 2 });
    s = enter(s, "RS-057:red");
    s = settle(attack(s, "RS-057:red", "TST-UNIT-2:d"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("battle");
  });

  it("RS-057: ホールド状態のコマンドは数えない（ホールド2つ・リリース0で BP2000 のまま負ける）（出典: atwiki/page-14）", () => {
    let s = redState({ position: 3, releasedCmds: 0, heldCmds: 2 });
    s = enter(s, "RS-057:red");
    s = settle(attack(s, "RS-057:red", "TST-UNIT-2:d"));
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-057 【レッドファイヤー】の BP 上昇が NC 不成立（1番目）でも適用される
  it.fails("RS-057: NC が成立しなければ（1番目）BP は上がらない（出典: atwiki/page-14）", () => {
    let s = redState({ position: 1, releasedCmds: 2 });
    s = enter(s, "RS-057:red");
    s = settle(attack(s, "RS-057:red", "TST-UNIT-2:d"));
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("discard");
  });

  // 「これは「マジフェニックス」としてつかえる。」
  it("RS-057: 「マジフェニックス」として使える（マジドラゴンの【マジカルドラゴンシュート】がマジレッドからのコンビネーションで発動）（出典: atwiki/page-14・page-38）", () => {
    let s = st({ player1: { battle: [inst("RS-057", "red")], rush: [inst("RS-056", "dr")] } });
    s = enter(s, "RS-056:dr");
    expect(unitIn(s, "player1", "RS-056:dr")?.bpModifier).toBe(4000);
  });

  // card_1 RS-057「いいえ。「アタックしたとき」ではないのでＢＰ修正されません。」
  it("RS-057: 公式Q&A — ストライクをファイブテクターで妨害されたバトルでは BP 修正されない（出典: grnrngr/faq-card-1 RS-057 Q1）", () => {
    const S3000 = sUnit("SPEC-S3000", { bp: 3000 });
    let s = st(
      {
        player1: { battle: fillers(2), rush: [inst("RS-057", "red")], command: releasedN(3), deck: deckCards(3) },
        player2: { operation: [inst("RS-014", "ft")], rush: [inst("SPEC-S3000", "g")], power: powerCards(4), deck: deckCards(3, "e") },
      },
      [S3000],
    );
    s = enter(s, "RS-057:red");
    s = strike(s, "RS-057:red");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "SPEC-S3000:g" });
    s = settle(s);
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player1", "RS-057:red")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-S3000:g")).toBe("battle");
  });

  // card_1 RS-057 Q2（バトルコサック）
  it.todo(
    "RS-057: 公式Q&A — バトルコサックの【コサックダンス】で手札に戻したマジレッドの「同じカード名」としてマジフェニックスをラッシュできる（出典: grnrngr/faq-card-1 RS-057 Q2）— バトルフェイズ中にバトルエリアからラッシュエリアへ戻す効果と【コサックダンス】の連鎖を公開 API で構成する手段が見つからない",
  );
});

// ===========================================================================
describe("RS-058 マジイエロー", () => {
  it("RS-058: カタログ本文が公式エラッタ後テキストと一致（出典: grnrngr/errata RS-058）", () => {
    expectCatalogText(
      "RS-058",
      "※これは「マジガルーダ」としてつかえる。【イエローサンダー】「ＳＰ１」これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる。",
    );
    expectStats("RS-058", {
      name: "マジイエロー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 4,
      comboNumber: 3,
      features: ["イエロー", "男", "魔法"],
    });
  });

  function yellow(position: 1 | 3, enemyBattle: ReturnType<typeof inst>[] = [inst("TST-UNIT-0", "eb")]) {
    let s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-058", "y")] },
      player2: { rush: [inst("TST-UNIT-0", "er")], battle: enemyBattle, power: powerCards(3), deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-058:y");
    return s;
  }

  it("RS-058: 3番目で「SP1」を得てストライクで1点（出典: grnrngr/errata RS-058）", () => {
    let s = yellow(3);
    s = settle(strike(s, "RS-058:y"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-058: NC成立時、敵軍ラッシュエリアのユニットにアタックして撃破できる（出典: grnrngr/errata RS-058）", () => {
    let s = yellow(3);
    expect(attackTargets(s, "RS-058:y")).toEqual(expect.arrayContaining(["TST-UNIT-0:er", "TST-UNIT-0:eb"]));
    s = settle(attack(s, "RS-058:y", "TST-UNIT-0:er"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("discard");
  });

  it("RS-058: NCが成立しなければ（1番目）敵軍ラッシュエリアにはアタックできない（出典: grnrngr/errata RS-058）", () => {
    const s = yellow(1);
    expect(attackTargets(s, "RS-058:y")).not.toContain("TST-UNIT-0:er");
  });

  it("RS-058: 「マジガルーダ」として使える（マジドラゴンの合体ユニットになる）（出典: atwiki/page-238）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-056", "dr")],
        rush: [inst("RS-058", "g"), inst("RS-059", "m"), inst("RS-060", "f"), inst("RS-061", "t")],
        power: powerCards(6),
        command: [released("TST-OP-MA", "ma")],
      },
    });
    const r = rushFromHand(s, "player1", "RS-056:dr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-058:g")).toBe("discard");
  });

  // card_1 RS-058 Q1「はい、できます。」
  it("RS-058: 公式Q&A — 敵軍バトルエリアが空でも発動し、ラッシュエリアにアタックできる（出典: grnrngr/faq-card-1 RS-058 Q1）", () => {
    const s = yellow(3, []);
    expect(attackTargets(s, "RS-058:y")).toEqual(["TST-UNIT-0:er"]);
  });

  // card_1 RS-058 Q2「アタックかストライクのどちらかを行った時点で…行動は終了します」
  it("RS-058: 公式Q&A — ラッシュエリアにアタックした後は続けてアタックもストライクもできない（出典: grnrngr/faq-card-1 RS-058 Q2）", () => {
    let s = yellow(3);
    s = settle(attack(s, "RS-058:y", "TST-UNIT-0:er"));
    expect(canStrike(s, "RS-058:y")).toBe(false);
    expect(attackTargets(s, "RS-058:y")).toEqual([]);
  });

  // card_1 RS-006「いいえ、できません。…「このとき」以下のテキストは無効になります」
  it("RS-058: 公式Q&A — マジイエローに自軍ラッシュエリアのユニットをアタックされたとき、新体操アクションでバトルを回避できない（出典: grnrngr/faq-card-1 RS-006）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-058", "y")] },
      player2: {
        rush: [inst("TST-UNIT-0", "er")],
        hand: [inst("RS-006", "gym")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(3),
        deck: deckCards(3, "e"),
      },
    });
    s = enter(s, "RS-058:y");
    s = attack(s, "RS-058:y", "TST-UNIT-0:er");
    const gym = legal(s).find(
      (a) =>
        a.playerId === "player2" &&
        ((a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-006:gym") ||
          (a.type === "play_counter" && a.instanceId === "RS-006:gym")),
    );
    if (gym) s = act(s, gym);
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-059 マジブルー", () => {
  it("RS-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-48）", () => {
    expectCatalogText("RS-059", "※これは「マジマーメイド」としてつかえる。【未来予知】自分は1枚ドローする。");
    expectStats("RS-059", {
      name: "マジブルー",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 2,
      features: ["ブルー", "女", "魔法"],
    });
  });

  function blue(position: 1 | 2) {
    let s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-059", "b")], deck: [inst("RS-007", "top"), ...deckCards(2)] },
      player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-059:b");
    return s;
  }

  // 「【未来予知】自分は1枚ドローする。」（「する」なので強制）
  it("RS-059: 2番目にコンビネーションすると1枚ドローする（選択なし）（出典: atwiki/page-48）", () => {
    const s = blue(2);
    expect(zoneOf(s, "player1", "RS-007:top")).toBe("hand");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-059: 2番目以外ではドローしない（出典: atwiki/page-48）", () => {
    const s = blue(1);
    expect(zoneOf(s, "player1", "RS-007:top")).toBe("deck");
  });

  // card_1 RS-059「はい、できます。」
  it("RS-059: 公式Q&A — 【未来予知】でドローした後、続けてこのユニットでアタックできる（出典: grnrngr/faq-card-1 RS-059 Q1）", () => {
    let s = blue(2);
    expect(attackTargets(s, "RS-059:b")).toContain("TST-UNIT-0:eb");
    s = settle(attack(s, "RS-059:b", "TST-UNIT-0:eb"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
  });

  // card_1 RS-008「「RS-059 マジブルー」の効果でドローするとき…にも発動しますか？」「はい、発動します。」
  it("RS-059: 公式Q&A — 超電子頭脳の配置中は【未来予知】のドローでも2枚ひいて1枚を捨札にする（出典: grnrngr/faq-card-1 RS-008）", () => {
    let s = st({
      player1: {
        battle: fillers(1),
        rush: [inst("RS-059", "b")],
        operation: [inst("RS-008", "brain")],
        deck: [inst("RS-007", "d1"), inst("RS-009", "d2"), inst("TST-OP", "d3")],
      },
    });
    s = enter(s, "RS-059:b");
    for (let i = 0; i < 3 && s.pendingEffectChoice; i += 1) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
      if (!pick) break;
      s = act(s, pick);
    }
    expect(s.players.player1.deck).toHaveLength(1);
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.discard).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-060 マジピンク", () => {
  it("RS-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-239）", () => {
    expectCatalogText(
      "RS-060",
      "※これは「マジフェアリー」としてつかえる。【ピンクストーム】BP3000以下のユニットを1体選んで持ち主の山札の上に戻してもよい。",
    );
    expectStats("RS-060", {
      name: "マジピンク",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 4,
      features: ["ピンク", "女", "魔法"],
    });
  });

  const BIG = sUnit("SPEC-BP4000", { bp: 4000 });
  function pink() {
    let s = st(
      {
        player1: { battle: fillers(3), rush: [inst("RS-060", "p"), inst("TST-UNIT-2", "own")], power: [{ ...inst("TST-UNIT-0", "pw"), faceDown: false }], deck: deckCards(2) },
        player2: {
          battle: [inst("TST-UNIT-2", "e3000"), inst("SPEC-BP4000", "e4000")],
          rush: [inst("TST-UNIT-0", "er")],
          command: [released("TST-UNIT-0", "ec")],
          deck: deckCards(2, "e"),
        },
      },
      [BIG],
    );
    s = enter(s, "RS-060:p");
    return s;
  }

  // 「BP3000以下のユニットを1体選んで持ち主の山札の上に戻してもよい」
  it("RS-060: 4番目で、両軍のラッシュ・バトルエリアの BP3000以下のユニットが選択肢になる（BP4000は除く）（出典: atwiki/page-239）", () => {
    const s = pink();
    const valid = s.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toEqual(expect.arrayContaining(["TST-UNIT-2:e3000", "TST-UNIT-0:er"]));
    expect(valid).not.toContain("SPEC-BP4000:e4000");
  });

  it("RS-060: 選んだ敵軍ユニットを持ち主（相手）の山札の上に戻す（出典: atwiki/page-239）", () => {
    let s = pink();
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-2:e3000" });
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-2:e3000");
  });

  it("RS-060: 戻さないことを選べる（任意）（出典: atwiki/page-239「戻してもよい」）", () => {
    let s = pink();
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "TST-UNIT-2:e3000")).toBe("battle");
  });

  // card_1 RS-060「いいえ、選べません。「ユニット」と指定されている場合は「ユニットとして扱われている」ことが条件」
  it("RS-060: 公式Q&A — パワーゾーン・コマンドゾーンのユニットのカードは選べない（出典: grnrngr/faq-card-1 RS-060 Q1）", () => {
    const valid = pink().pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).not.toContain("TST-UNIT-0:pw");
    expect(valid).not.toContain("TST-UNIT-0:ec");
  });

  // card_1 RS-060「はい、選べます。」
  it("RS-060: 公式Q&A — 自分のユニットも選べ、自分の山札の上に戻る（出典: grnrngr/faq-card-1 RS-060 Q2）", () => {
    let s = pink();
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("TST-UNIT-2:own");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-2:own" });
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-UNIT-2:own");
  });
});

// ===========================================================================
describe("RS-061 マジグリーン", () => {
  it("RS-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-240）", () => {
    expectCatalogText(
      "RS-061",
      "※これは「マジタウロス」としてつかえる。【グリーングラウンド】「SP1」敵軍コマンドゾーンからカードを1枚選んで、持ち主の手札に戻してもよい。",
    );
    expectStats("RS-061", {
      name: "マジグリーン",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 4,
      comboNumber: 3,
      features: ["グリーン", "男", "魔法"],
    });
  });

  function green() {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-061", "g")] },
      player2: { command: [released("TST-OP", "er"), held("TST-OP", "eh")], power: powerCards(3), deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-061:g");
    return s;
  }

  it("RS-061: 3番目で「SP1」を得る（出典: atwiki/page-240）", () => {
    let s = green();
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = settle(strike(s, "RS-061:g"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「敵軍コマンドゾーンからカードを1枚選んで、持ち主の手札に戻してもよい」
  it("RS-061: 敵軍コマンドゾーンのカード（ホールド状態も含む）を1枚選んで相手の手札に戻す（出典: atwiki/page-240）", () => {
    let s = green();
    expect(s.pendingEffectChoice?.validInstanceIds?.slice().sort()).toEqual(["TST-OP:eh", "TST-OP:er"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:eh" });
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:er")).toBe("command");
  });

  it("RS-061: 戻さないことを選べる（任意）（出典: atwiki/page-240）", () => {
    let s = green();
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player2.command).toHaveLength(2);
  });

  it("RS-061: 「マジタウロス」として使える（マジドラゴンの合体ユニットになる）（出典: atwiki/page-240）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-056", "dr")],
        rush: [inst("RS-058", "g"), inst("RS-059", "m"), inst("RS-060", "f"), inst("RS-061", "t")],
        power: powerCards(6),
        command: [released("TST-OP-MA", "ma")],
      },
    });
    const r = rushFromHand(s, "player1", "RS-056:dr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-061:t")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-062 ボウケンレッド", () => {
  it("RS-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-30）", () => {
    expectCatalogText("RS-062", "【ボウケンジャベリン】「SP1」これは特徴「メカ」をもつユニットにアタックするとき、BP＋4000される。");
    expectStats("RS-062", {
      name: "ボウケンレッド",
      category: "ET",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 3,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  const NONMECHA = sUnit("SPEC-BP6000", { bp: 6000 });
  function red(position: 1 | 5, defender: string) {
    let s = st(
      {
        player1: { battle: fillers(position - 1), rush: [inst("RS-062", "r")] },
        player2: { battle: [inst(defender, "d")], power: powerCards(3), deck: deckCards(3, "e") },
      },
      [NONMECHA],
    );
    s = enter(s, "RS-062:r");
    return s;
  }

  it("RS-062: 5番目で「SP1」を得てストライクで1点（出典: atwiki/page-30）", () => {
    let s = red(5, "SPEC-BP6000");
    s = settle(strike(s, "RS-062:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-062: 特徴「メカ」のユニット（パトストライカー BP6000）にアタックするとき BP8000 で勝つ（出典: atwiki/page-30）", () => {
    let s = red(5, "RS-043");
    s = settle(attack(s, "RS-062:r", "RS-043:d"));
    expect(zoneOf(s, "player2", "RS-043:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-062:r")).toBe("battle");
  });

  it("RS-062: 「メカ」を持たないユニットにアタックするときは BP+4000 されない（出典: atwiki/page-30）", () => {
    let s = red(5, "SPEC-BP6000");
    s = settle(attack(s, "RS-062:r", "SPEC-BP6000:d"));
    expect(zoneOf(s, "player1", "RS-062:r")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-062 【ボウケンジャベリン】の BP+4000 が NC 不成立（1番目）でも適用される
  it.fails("RS-062: NCが成立しなければ（1番目）メカにアタックしても BP は上がらない（出典: atwiki/page-30）", () => {
    let s = red(1, "RS-043");
    s = settle(attack(s, "RS-062:r", "RS-043:d"));
    expect(zoneOf(s, "player1", "RS-062:r")).toBe("discard");
  });

  // card_1 RS-018「ボウケンレッドのBPは、アタックする対象が特徴「メカ」を持っているかどうかで決まり、バトルする対象の特徴には左右されません」
  it("RS-062: 公式Q&A — 隠流忍術でバトル相手が非メカに変わっても、メカにアタックした BP+4000 は残る（出典: grnrngr/faq-card-1 RS-018）", () => {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-062", "r")] },
      player2: {
        battle: [inst("RS-089", "rescue"), inst("RS-165", "rouki")],
        hand: [inst("RS-018", "nin")],
        command: [released("TST-OP-MA", "ma")],
        power: powerCards(4),
        deck: deckCards(3, "e"),
      },
    });
    s = enter(s, "RS-062:r");
    s = attack(s, "RS-062:r", "RS-089:rescue");
    s = act(s, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "category_use",
      sourceInstanceId: "RS-018:nin",
      substituteInstanceId: "RS-165:rouki",
    });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-062:r")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-063 ボウケンブラック", () => {
  it("RS-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-265）", () => {
    expectCatalogText(
      "RS-063",
      "【ラジアルハンマー】「SP1」自軍山札の上から3枚を見てもよい。そうしたとき、1枚選んで山札の上に戻し、それ以外を捨札にする。",
    );
    expectStats("RS-063", {
      name: "ボウケンブラック",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 1,
      comboNumber: 5,
      features: ["ブラック", "男"],
    });
  });

  function black() {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-063", "b")], deck: [inst("RS-007", "d1"), inst("RS-008", "d2"), inst("RS-009", "d3"), inst("TST-OP", "d4")] },
      player2: { power: powerCards(3), deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-063:b");
    return s;
  }

  it("RS-063: 5番目で「SP1」を得る（出典: atwiki/page-265）", () => {
    const s = black();
    expect(unitIn(s, "player1", "RS-063:b")?.spModifier).toBe(1);
  });

  // 「1枚選んで山札の上に戻し、それ以外を捨札にする」
  it("RS-063: 上から3枚のうち1枚を山札の上に戻し、残り2枚を捨札にする（4枚目は動かない）（出典: atwiki/page-265）", () => {
    let s = black();
    expect(s.pendingEffectChoice?.validInstanceIds?.slice().sort()).toEqual(["RS-007:d1", "RS-008:d2", "RS-009:d3"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-008:d2" });
    expect(zoneIds(s, "player1", "deck")).toEqual(["RS-008:d2", "TST-OP:d4"]);
    expect(zoneIds(s, "player1", "discard")).toEqual(expect.arrayContaining(["RS-007:d1", "RS-009:d3"]));
  });

  // 「見てもよい」
  // 既知の不具合: CARD-RS-063 【ラジアルハンマー】が任意（「見てもよい」）にならず、必ず3枚を見て2枚を捨札にする
  it.fails("RS-063: 見ないことを選べる（山札は変わらない）（出典: atwiki/page-265）", () => {
    let s = black();
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player1.deck).toHaveLength(4);
    expect(s.players.player1.discard).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-064 ボウケンブルー", () => {
  it("RS-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-268）", () => {
    expectCatalogText("RS-064", "【ブロウナックル】「SP1」リリース状態の自軍コマンドをすべて手札に戻してもよい。そうしたとき、相手も同じようにする。");
    expectStats("RS-064", {
      name: "ボウケンブルー",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 2,
      comboNumber: 5,
      features: ["ブルー", "男"],
    });
  });

  function blue(own: { released: number; held: number }, opp: { released: number; held: number }, oppExtra: Record<string, unknown> = {}) {
    let s = st({
      player1: {
        battle: fillers(4),
        rush: [inst("RS-064", "b")],
        command: [...releasedN(own.released, "TST-OP", "or"), ...heldN(own.held, "TST-OP", "oh")],
      },
      player2: {
        command: [...releasedN(opp.released, "TST-OP", "er"), ...heldN(opp.held, "TST-OP", "eh")],
        power: powerCards(3),
        deck: deckCards(3, "e"),
        ...oppExtra,
      },
    });
    s = enter(s, "RS-064:b");
    return s;
  }
  function confirmIfAsked(s: ReturnType<typeof st>) {
    const yes = legal(s).find((a) => a.type === "confirm_effect_choice" && a.playerId === "player1");
    return yes ? act(s, yes) : s;
  }

  it("RS-064: 5番目で「SP1」を得る（出典: atwiki/page-268）", () => {
    const s = blue({ released: 1, held: 0 }, { released: 1, held: 0 });
    expect(unitIn(s, "player1", "RS-064:b")?.spModifier).toBe(1);
  });

  // 「リリース状態の自軍コマンドをすべて手札に戻してもよい。そうしたとき、相手も同じようにする。」
  it("RS-064: リリース状態の自軍コマンドをすべて手札に戻し、相手もリリース状態のコマンドをすべて手札に戻す（ホールド状態は残る）（出典: atwiki/page-268）", () => {
    let s = blue({ released: 2, held: 1 }, { released: 2, held: 1 });
    s = confirmIfAsked(s);
    expect(zoneIds(s, "player1", "command")).toEqual(["TST-OP:oh0"]);
    expect(zoneIds(s, "player1", "hand")).toEqual(expect.arrayContaining(["TST-OP:or0", "TST-OP:or1"]));
    expect(zoneIds(s, "player2", "command")).toEqual(["TST-OP:eh0"]);
    expect(zoneIds(s, "player2", "hand")).toEqual(expect.arrayContaining(["TST-OP:er0", "TST-OP:er1"]));
  });

  // 「戻してもよい」
  // 既知の不具合: CARD-RS-064 【ブロウナックル】が任意にならず、NC 成立時に必ず両者のコマンドを戻す
  it.fails("RS-064: 戻さないことを選べる（任意）（出典: atwiki/page-268）", () => {
    const s = blue({ released: 2, held: 0 }, { released: 2, held: 0 });
    expect(s.players.player1.command).toHaveLength(2);
    expect(
      legal(s).some((a) => (a.type === "skip_effect_choice" || a.type === "confirm_effect_choice") && a.playerId === "player1"),
    ).toBe(true);
  });

  // card_1 RS-064 Q2「相手もリリース状態のコマンドはすべて手札に戻さなければなりません」
  it("RS-064: 公式Q&A — 相手は自分が戻した枚数ではなく、リリース状態のコマンドをすべて戻す（出典: grnrngr/faq-card-1 RS-064 Q2）", () => {
    let s = blue({ released: 1, held: 0 }, { released: 3, held: 0 });
    s = confirmIfAsked(s);
    expect(s.players.player2.command).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(3);
  });

  // card_1 RS-064 Q3「「自分はリリース状態のコマンドを０枚戻した」として発動させることはできますか？」「いいえ、できません。」
  // 既知の不具合: CARD-RS-064 自軍のリリース状態コマンドが0枚でも相手のコマンドだけ手札に戻ってしまう
  it.fails("RS-064: 公式Q&A — 自軍のリリース状態コマンドが0枚なら発動できず、相手のコマンドも戻らない（出典: grnrngr/faq-card-1 RS-064 Q3）", () => {
    let s = blue({ released: 0, held: 2 }, { released: 2, held: 0 });
    s = confirmIfAsked(s);
    expect(s.players.player2.command).toHaveLength(2);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  // card_1 RS-064 Q1「離れた枚数と同じだけ捨て札からコマンドゾーンに置くことができますか？」「はい」
  // 既知の不具合: CARD-RS-064 ブロウナックルで相手（ゴーゴーファイヤー所持）のコマンドが複数離れても【プロジェットカノン】の置き直しが起きない
  it.fails("RS-064: 公式Q&A — 相手のゴーゴーファイヤーは離れた枚数（2枚）だけ捨札からコマンドゾーンに置ける（出典: grnrngr/faq-card-1 RS-064 Q1）", () => {
    let s = blue(
      { released: 1, held: 0 },
      { released: 2, held: 0 },
      { rush: [inst("RS-238", "gogo")], discard: [inst("RS-007", "x1"), inst("RS-008", "x2"), inst("RS-016", "x3")] },
    );
    s = confirmIfAsked(s);
    for (let i = 0; i < 6; i += 1) {
      const a =
        legal(s).find((x) => x.type === "resolve_effect_choice" && x.playerId === "player2") ??
        legal(s).find((x) => x.type === "confirm_effect_choice" && x.playerId === "player2");
      if (!a) break;
      s = act(s, a);
    }
    expect(s.players.player2.command).toHaveLength(2);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });
});

// ===========================================================================
describe("RS-065 ボウケンイエロー", () => {
  it("RS-065: カタログ本文が公式エラッタ後テキストと一致（出典: grnrngr/errata RS-065）", () => {
    expectCatalogText("RS-065", "【一点突破】これが「ＳＰ１」以上または「ＳＰ！」のあるユニットを撃破したとき、相手に１点ダメージを与える。");
    expectStats("RS-065", {
      name: "ボウケンイエロー",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 3,
      features: ["イエロー", "女"],
    });
  });

  function yellowAttacks(defSp: unknown, opts: { position?: 1 | 3; defenderIndex?: number; defender?: ReturnType<typeof inst> } = {}) {
    const def = sUnit("SPEC-DEF", { bp: 500, sp: defSp as never });
    const d = opts.defender ?? inst("SPEC-DEF", "d");
    let s = st(
      {
        player1: { battle: fillers((opts.position ?? 3) - 1), rush: [inst("RS-065", "y")] },
        player2: {
          battle: [...fillers(opts.defenderIndex ?? 0, "pad"), d],
          power: powerCards(4),
          deck: deckCards(3, "e"),
        },
      },
      [def],
    );
    s = enter(s, "RS-065:y");
    s = settle(attack(s, "RS-065:y", d.instanceId));
    return { s, d };
  }

  it("RS-065: 3番目で、「SP1」のユニットを撃破したとき相手に1点（出典: grnrngr/errata RS-065）", () => {
    const { s, d } = yellowAttacks(1);
    expect(zoneOf(s, "player2", d.instanceId)).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-065: SPを持たないユニットを撃破しても与えない（出典: grnrngr/errata RS-065）", () => {
    const { s } = yellowAttacks(undefined);
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-065: NC不成立（1番目）なら「SP1」のユニットを撃破しても与えない（出典: grnrngr/errata RS-065、08-errata 効果）", () => {
    const { s, d } = yellowAttacks(1, { position: 1 });
    expect(zoneOf(s, "player2", d.instanceId)).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  // card_1 RS-065 Q1
  it("RS-065: 公式Q&A — 分数SP「1/3」は「SP1」になっていない位置（1番目）なら対象外（出典: grnrngr/faq-card-1 RS-065 Q1）", () => {
    const { s } = yellowAttacks("1/3", { defenderIndex: 0 });
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-065: 公式Q&A — 分数SP「1/3」がバトルエリア3番目（SP1）なら対象（出典: grnrngr/faq-card-1 RS-065 Q1）", () => {
    const { s } = yellowAttacks("1/3", { defenderIndex: 2 });
    expect(s.players.player2.damage).toBe(1);
  });

  // card_1 RS-065 Q2「効果が適用されるのは「ボウケンイエロー」自身だけです」
  it("RS-065: 公式Q&A — NC成立中でも他の自軍ユニットが撃破したときは与えない（出典: grnrngr/faq-card-1 RS-065 Q2）", () => {
    const def = sUnit("SPEC-DEF", { bp: 500, sp: 1 });
    let s = st(
      {
        player1: { battle: [inst("TST-UNIT-2", "other"), inst("TST-UNIT-0", "f")], rush: [inst("RS-065", "y")] },
        player2: { battle: [inst("SPEC-DEF", "d")], power: powerCards(3), deck: deckCards(3, "e") },
      },
      [def],
    );
    s = passEntry(enter(s, "RS-065:y"));
    s = settle(attack(s, "TST-UNIT-2:other", "SPEC-DEF:d"));
    expect(zoneOf(s, "player2", "SPEC-DEF:d")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  // card_1 RS-065 Q3「ＳＰに「！」とあるユニットは…すべてこの効果の対象になります」
  it("RS-065: 公式Q&A — SP「！」のユニット（NCでSPを得ていなくても）は対象（出典: grnrngr/faq-card-1 RS-065 Q3）", () => {
    const { s } = yellowAttacks("special");
    expect(s.players.player2.damage).toBe(1);
  });

  // card_1 RS-065 Q4「はい、その通りです。」
  // 既知の不具合: CARD-RS-065 アバレッドの自傷1点と【一点突破】の1点が同時に発生すると、ダメージ支払いが1点分しか行われない
  it.fails("RS-065: 公式Q&A — 敵軍アバレッドを撃破すると相手は2点受ける（出典: grnrngr/faq-card-1 RS-065 Q4）", () => {
    const { s } = yellowAttacks(undefined, { defender: { ...inst("RS-054", "red"), bpModifier: -500 } });
    expect(zoneOf(s, "player2", "RS-054:red")).toBe("discard");
    expect(s.players.player2.damage).toBe(2);
  });
});

// ===========================================================================
describe("RS-066 ボウケンピンク", () => {
  it("RS-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-270）", () => {
    expectCatalogText("RS-066", "【遺跡調査】自軍山札の上から1枚を見てもよい。そうしたとき、それを元に戻すか、山札の下に戻すかを選択する。");
    expectStats("RS-066", {
      name: "ボウケンピンク",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 2,
      features: ["ピンク", "女"],
    });
  });

  function pink(position: 1 | 2 = 2) {
    let s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-066", "p")], deck: [inst("RS-007", "top"), inst("RS-008", "2nd"), inst("RS-009", "3rd")] },
    });
    s = enter(s, "RS-066:p");
    return s;
  }

  it("RS-066: 2番目で山札の上の1枚を見て、山札の下に戻せる（出典: atwiki/page-270）", () => {
    let s = pink();
    s = actLegal(s, (a) => a.type === "resolve_ruin_survey" && a.placement === "bottom");
    expect(zoneIds(s, "player1", "deck")).toEqual(["RS-008:2nd", "RS-009:3rd", "RS-007:top"]);
  });

  it("RS-066: 元に戻すことも選べる（山札の順は変わらない）（出典: atwiki/page-270）", () => {
    let s = pink();
    s = actLegal(s, (a) => a.type === "resolve_ruin_survey" && a.placement === "top");
    expect(zoneIds(s, "player1", "deck")).toEqual(["RS-007:top", "RS-008:2nd", "RS-009:3rd"]);
  });

  it("RS-066: 2番目以外では発動しない（出典: atwiki/page-270）", () => {
    const s = pink(1);
    expect(legalOfType(s, "resolve_ruin_survey")).toHaveLength(0);
  });

  // 「見てもよい」
  // 既知の不具合: CARD-RS-066 【遺跡調査】が任意（「見てもよい」）にならず、必ず見て上か下を選ぶ（軽微: 結果は「元に戻す」と同じにできる）
  it.fails("RS-066: 見ないことを選べる（任意）（出典: atwiki/page-270）", () => {
    const s = pink();
    expect(legal(s).some((a) => a.type === "skip_effect_choice")).toBe(true);
  });
});

// ===========================================================================
describe("RS-067 プラズマエネルギー", () => {
  // atwiki/page-271（ライブ写し pages/271.txt）。※常駐行はカタログでは tags「常駐」で表す
  it("RS-067: カタログ本文（※常駐行は tags「常駐」）・スペックが出典と一致（出典: atwiki/page-271、08-errata R-ERR-UNVERIFIED-01）", () => {
    const body = "ストライクされたとき発動できる。ストライクしてきたユニットを撃破する（ダメージは受ける）。そうしたとき、これを捨札にする。";
    const text = norm(DEFS["RS-067"]!.text);
    const full = norm("※常駐（場に配置して、離れるまで効果が有効になる）" + body);
    expect(text === full || (text === norm(body) && (DEFS["RS-067"]!.tags ?? []).includes("常駐"))).toBe(true);
    expect(effectMeta("RS-067")?.kind).toBe("permanent");
    expectStats("RS-067", { name: "プラズマエネルギー", type: "operation", category: "ET", powerCost: 5 });
  });

  // 「※常駐（場に配置して、離れるまで効果が有効になる）」「必要パワー：5」
  it("RS-067: 使用すると場（オペレーションゾーン）に配置される。パワー4では使えない（出典: atwiki/page-271）", () => {
    const mk = (power: number) =>
      st({ phase: "rush", player1: { hand: [inst("RS-067", "pl")], command: [released("TST-OP-ET", "et")], power: powerCards(power) } });
    const r = playOp(mk(5), "player1", "RS-067:pl");
    expect(r.ok).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "RS-067:pl")).toBe("operation");
    expect(playOp(mk(4), "player1", "RS-067:pl").ok).toBe(false);
  });

  function struck() {
    let s = st({
      activePlayer: "player2",
      player1: { operation: [inst("RS-067", "pl")], power: powerCards(3), deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "st")], deck: deckCards(3, "e") },
    });
    s = strike(s, "TST-UNIT-0:st", "player2");
    return s;
  }

  // 「ストライクされたとき発動できる。ストライクしてきたユニットを撃破する（ダメージは受ける）。そうしたとき、これを捨札にする。」
  it("RS-067: ストライクされたとき、ストライクしてきたユニットを撃破し、ダメージは受け、これを捨札にする（出典: atwiki/page-271）", () => {
    let s = struck();
    expect(legalOfType(s, "use_plasma_energy").some((a) => a.playerId === "player1")).toBe(true);
    s = settle(act(s, { type: "use_plasma_energy", playerId: "player1" }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:st")).toBe("discard");
    expect(s.players.player1.damage).toBe(1);
    expect(zoneOf(s, "player1", "RS-067:pl")).toBe("discard");
  });

  it("RS-067: 発動しないことも選べ、その場合は配置されたまま（出典: atwiki/page-271「発動できる」）", () => {
    let s = struck();
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:st")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-067:pl")).toBe("operation");
    expect(s.players.player1.damage).toBe(1);
  });

  it("RS-067: アタックされたときには発動できない（「ストライクされたとき」）（出典: atwiki/page-271）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { operation: [inst("RS-067", "pl")], battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "a")] },
    });
    s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d", "player2");
    expect(legalOfType(s, "use_plasma_energy")).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-068 地球と宇宙のエネルギー", () => {
  // atwiki/page-272「自軍捨札からカードを1枚選んで手札に加える。」
  it("RS-068: カタログ本文が出典と一致（出典: atwiki/page-272）", () => {
    expectCatalogText("RS-068", "自軍捨札からカードを1枚選んで手札に加える。");
  });

  it("RS-068: スペック（ET・オペレーション・必要パワー6）が出典と一致（出典: atwiki/page-272）", () => {
    expectStats("RS-068", { name: "地球と宇宙のエネルギー", type: "operation", category: "ET", powerCost: 6 });
  });

  function earth(power: number) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-068", "op")],
        discard: [inst("TST-UNIT-2", "u"), inst("RS-007", "o")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(power),
      },
    });
  }

  function playEarth(s: ReturnType<typeof st>, pick: string) {
    const r = playOp(s, "player1", "RS-068:op");
    expect(r.ok).toBe(true);
    const valid = r.state.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain(pick);
    return act(r.state, { type: "resolve_effect_choice", playerId: "player1", instanceId: pick });
  }

  // 「自軍捨札からカードを1枚選んで手札に加える」
  it("RS-068: 自軍捨札のユニットカードを1枚選んで手札に加える（出典: atwiki/page-272）", () => {
    const s = playEarth(earth(6), "TST-UNIT-2:u");
    expect(zoneOf(s, "player1", "TST-UNIT-2:u")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-007:o")).toBe("discard");
  });

  it("RS-068: 自軍捨札のオペレーションカードも選んで手札に加えられる（出典: atwiki/page-272）", () => {
    const s = playEarth(earth(6), "RS-007:o");
    expect(zoneOf(s, "player1", "RS-007:o")).toBe("hand");
  });

  it("RS-068: 必要パワー6（パワー5では使えない）（出典: atwiki/page-272）", () => {
    expect(playOp(earth(5), "player1", "RS-068:op").ok).toBe(false);
  });
});

// ===========================================================================
describe("RS-069 稲妻重力エネルギー", () => {
  // atwiki/page-273「※常駐（場に配置して、離れるまで効果が有効になる）すべてのMユニットは、コマンドを1つホールドしなければバトルエリアに出られない。」
  it("RS-069: カタログ本文が出典と一致（出典: atwiki/page-273）", () => {
    const body = "すべてのMユニットは、コマンドを1つホールドしなければバトルエリアに出られない。";
    const text = norm(DEFS["RS-069"]!.text);
    expect(
      text === norm("※常駐（場に配置して、離れるまで効果が有効になる）" + body) ||
        (text === norm(body) && (DEFS["RS-069"]!.tags ?? []).includes("常駐")),
    ).toBe(true);
  });

  it("RS-069: スペック（ET・オペレーション・必要パワー4・常駐）が出典と一致（出典: atwiki/page-273）", () => {
    expectStats("RS-069", { name: "稲妻重力エネルギー", type: "operation", category: "ET", powerCost: 4 });
    expect(DEFS["RS-069"]!.tags ?? []).toContain("常駐");
  });

  it("RS-069: 使用すると場に配置される（出典: atwiki/page-273）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-069", "lg")], command: [released("TST-OP-ET", "et")], power: powerCards(4) } });
    const r = playOp(s, "player1", "RS-069:lg");
    expect(r.ok).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "RS-069:lg")).toBe("operation");
  });

  // 「すべてのMユニットは、コマンドを1つホールドしなければバトルエリアに出られない」
  it("RS-069: 配置中、Mユニットはコマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-273）", () => {
    let s = st({ player1: { rush: [inst("RS-089", "m")], operation: [inst("RS-069", "lg")], command: heldN(1) } });
    expect(canEnter(s, "RS-089:m")).toBe(false);
    s = st({ player1: { rush: [inst("RS-089", "m")], operation: [inst("RS-069", "lg")], command: releasedN(1) } });
    s = enterHold(s, "RS-089:m");
    expect(zoneOf(s, "player1", "RS-089:m")).toBe("battle");
    expect(s.players.player1.command[0]!.commandHeld).toBe(true);
  });

  it("RS-069: 相手が配置していても自軍Mユニットに適用される（「すべての」）（出典: atwiki/page-273）", () => {
    const s = st({ player1: { rush: [inst("RS-089", "m")], command: heldN(1) }, player2: { operation: [inst("RS-069", "lg")] } });
    expect(canEnter(s, "RS-089:m")).toBe(false);
  });

  it("RS-069: Sユニットには適用されない（出典: atwiki/page-273）", () => {
    const s = st({ player1: { rush: [inst("TST-UNIT-0", "s")], operation: [inst("RS-069", "lg")], command: heldN(1) } });
    expect(canEnter(s, "TST-UNIT-0:s")).toBe(true);
  });

  // card_1 RS-069 Q1「カテゴリ名を指定されていないので、どのカテゴリでも構いません」
  it("RS-069: 公式Q&A — ホールドするコマンドのカテゴリは問わない（出典: grnrngr/faq-card-1 RS-069 Q1）", () => {
    let s = st({ player1: { rush: [inst("RS-089", "m")], operation: [inst("RS-069", "lg")], command: [released("TST-OP-MA", "ma")] } });
    s = enterHold(s, "RS-089:m");
    expect(zoneOf(s, "player1", "RS-089:m")).toBe("battle");
  });

  function holdsNeeded(s: ReturnType<typeof st>, id: string): number | undefined {
    const r = tryAct(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: id });
    return r.ok ? r.state.pendingCommandPayment?.totalNeeded : undefined;
  }

  // card_1 RS-069 Q2「ホールドするコマンドは２つになります」
  it("RS-069: 公式Q&A — 自分と相手の両方が配置していれば2つホールドする（出典: grnrngr/faq-card-1 RS-069 Q2）", () => {
    const s = st({
      player1: { rush: [inst("RS-089", "m")], operation: [inst("RS-069", "lg1")], command: releasedN(3) },
      player2: { operation: [inst("RS-069", "lg2")] },
    });
    expect(holdsNeeded(s, "RS-089:m")).toBe(2);
  });

  // card_1 RS-069 Q3「ホールドするコマンドは２つになります…制限はすべてひとつずつ解決します」
  it("RS-069: 公式Q&A — 配置中の爆竜ティラノサウルスは2つホールドする（出典: grnrngr/faq-card-1 RS-069 Q3）", () => {
    let s = st({ player1: { rush: [inst("RS-051", "t")], operation: [inst("RS-069", "lg")], command: releasedN(3) } });
    expect(holdsNeeded(s, "RS-051:t")).toBe(2);
    s = enterHold(s, "RS-051:t");
    expect(zoneOf(s, "player1", "RS-051:t")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-070 マジキング", () => {
  // atwiki/page-24（「※2弾収録のカードは能力名が【ファントムイリュージョン】に変更」は wiki 注記でカード本文ではない）
  it("RS-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-24）", () => {
    expectCatalogText(
      "RS-070",
      "合体―マジフェニックス＋マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス【天空魔法斬り】これがバトルエリアに出たとき、敵軍コマンドをすべてホールドしてもよい。",
    );
    expectStats("RS-070", {
      name: "マジキング",
      category: "MA",
      size: "L",
      bp: 16000,
      sp: 1,
      powerCost: "7+",
      features: ["魔法", "人型"],
    });
    expect(DEFS["RS-070"]!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });

  function kingRush(power: number, mats: string[]) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-070", "k")],
        rush: mats.map((id, i) => inst(id, `m${i}`)),
        power: powerCards(power),
        command: [released("TST-OP-MA", "ma")],
      },
    });
  }

  // 「合体―マジフェニックス＋マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス」
  it("RS-070: マジレッド（マジフェニックスとして）＋マジイエロー／ブルー／ピンク／グリーンを捨札にしてラッシュできる（出典: atwiki/page-24・page-14）", () => {
    const r = rushFromHand(kingRush(7, ["RS-057", "RS-058", "RS-059", "RS-060", "RS-061"]), "player1", "RS-070:k");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-070:k")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("RS-070: 合体ユニットが欠ける（マジフェニックス無し）、またはパワー6ではラッシュできない（出典: atwiki/page-24）", () => {
    expect(canStartRush(kingRush(7, ["RS-058", "RS-059", "RS-060", "RS-061"]), "player1", "RS-070:k")).toBe(false);
    expect(canStartRush(kingRush(6, ["RS-057", "RS-058", "RS-059", "RS-060", "RS-061"]), "player1", "RS-070:k")).toBe(false);
  });

  function kingEnters() {
    let s = st({
      player1: { rush: [inst("RS-070", "k")] },
      player2: { command: [...releasedN(2, "TST-OP", "e"), held("TST-OP", "eh")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-070:k");
    return s;
  }

  // 「これがバトルエリアに出たとき、敵軍コマンドをすべてホールドしてもよい」
  it("RS-070: バトルエリアに出たとき敵軍コマンドをすべてホールドできる（出典: atwiki/page-24）", () => {
    let s = kingEnters();
    const yes = legal(s).find((a) => a.type === "confirm_effect_choice" && a.playerId === "player1");
    if (yes) s = act(s, yes);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });

  // 「ホールドしてもよい」
  // 既知の不具合: CARD-RS-070 【天空魔法斬り】が任意にならず、出たときに必ず敵軍コマンドをすべてホールドする
  it.fails("RS-070: ホールドしないことも選べる（任意）（出典: atwiki/page-24）", () => {
    const s = kingEnters();
    expect(s.players.player2.command.filter((c) => !c.commandHeld)).toHaveLength(2);
    expect(legal(s).some((a) => a.type === "skip_effect_choice" && a.playerId === "player1")).toBe(true);
  });
});
