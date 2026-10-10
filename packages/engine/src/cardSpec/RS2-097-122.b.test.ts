/**
 * カード別スペック: RS-106〜RS-110（第2弾「二人の黒騎士」デカレンジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS106）、grnrngr/faq-card-2・faq-card-3
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md、ライブ写し docs/rules/sources/web/w.atwiki.jp/renst/pages/N.txt）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  canEnter,
  canStrike,
  canUseCard,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  ncLogged,
  passEntry,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  sUnit,
  toPhase,
  tryAct,
  useCard,
  zoneIds,
  zoneOf,
} from "./RS2-097-122.helpers";
import type { GameState, PlayerId } from "../types/game";

function canJuu(s: GameState, attacker: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) => a.type === "use_juu_kun_do" && a.playerId === playerId && a.attackerInstanceId === attacker,
  );
}

// ===========================================================================
describe("RS-106 デカレッド", () => {
  const E1K = sUnit("SPEC-E1K", { bp: 1000 });
  const E2K = sUnit("SPEC-E2K", { bp: 2000 });
  const E4K = sUnit("SPEC-E4K", { bp: 4000 });
  const EXTRA = [E1K, E2K, E4K];

  // docs/rules/08-errata.md R-ERR-RS106（atwiki/page-23「修正後は以下」）
  it("RS-106: カタログ本文（読み替え後）・スペックが出典と一致（出典: 08-errata R-ERR-RS106・atwiki/page-23）", () => {
    expectCatalogText(
      "RS-106",
      "※これはラッシュしたターンにバトルエリアに出られない。【ジュウクンドー】これが敵軍ユニットにアタックできるとき、次の効果を発動できる。敵軍ラッシュエリアにあるユニットを、カードに表記された本来のBPの合計が3000以下になるように好きな数選んで撃破する。そうしたとき、これはアタックすることができない。",
    );
    expectStats("RS-106", {
      name: "デカレッド",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 1,
      features: ["レッド", "男", "警察"],
    });
  });

  // 「※これはラッシュしたターンにバトルエリアに出られない」
  it("RS-106: ※ ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-23）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-106", "dr")], command: [released("TST-OP-OT", "ot")], power: powerCards(3) },
    });
    const r = rushFromHand(s0, "player1", "RS-106:dr");
    expect(r.ok).toBe(true);
    const s = act(r.state, { type: "end_phase", playerId: "player1" });
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RS-106:dr")).toBe(false);
  });

  function redFirst(enemy: { battle?: ReturnType<typeof inst>[]; rush?: ReturnType<typeof inst>[] }, before = 0) {
    let s = st(
      {
        player1: { battle: fillers(before), rush: [inst("RS-106", "dr")] },
        player2: { battle: enemy.battle ?? [inst("TST-UNIT-0", "wall")], rush: enemy.rush ?? [] },
      },
      EXTRA,
    );
    s = enter(s, "RS-106:dr");
    return s;
  }

  function juu(s: GameState, picks: string[]): GameState {
    let next = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    for (const id of picks) {
      next = act(next, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    if (next.pendingEffectChoice?.playerId === "player1") {
      next = act(next, { type: "confirm_effect_choice", playerId: "player1" });
    }
    return settle(next);
  }

  // 「敵軍ラッシュエリアにあるユニットを、カードに表記された本来のBPの合計が3000以下になるように好きな数選んで撃破する」
  it("RS-106: 1番目に出ると、本来の BP の合計 3000 以下になるよう敵軍ラッシュエリアのユニットを好きな数選んで撃破する（出典: 08-errata R-ERR-RS106）", () => {
    let s = redFirst({ rush: [inst("SPEC-E1K", "a"), inst("SPEC-E2K", "b"), inst("SPEC-E4K", "c")] });
    expect(canJuu(s, "RS-106:dr")).toBe(true);
    s = juu(s, ["SPEC-E1K:a", "SPEC-E2K:b"]);
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2K:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E4K:c")).toBe("rush");
  });

  it("RS-106: 合計が 3000 を超える組み合わせは選べない（出典: 08-errata R-ERR-RS106）", () => {
    let s = redFirst({ rush: [inst("SPEC-E2K", "a"), inst("SPEC-E2K", "b"), inst("SPEC-E4K", "c")] });
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E4K:c" }).ok).toBe(false);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E2K:a" });
    const over = tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E2K:b" });
    if (over.ok) {
      const done = tryAct(over.state, { type: "confirm_effect_choice", playerId: "player1" });
      expect(done.ok && settle(done.state).players.player2.rush.length === 0).toBe(false);
    }
  });

  // 「カードに表記された本来のBP」— BP 修正は無視する
  it("RS-106: 合計は「本来の BP」で数える（BP が下がっていても本来値で計算）（出典: 08-errata R-ERR-RS106）", () => {
    const shrunk = { ...inst("SPEC-E4K", "c"), bpModifier: -3000 };
    let s = redFirst({ rush: [shrunk] });
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E4K:c" }).ok).toBe(false);
  });

  // 「そうしたとき、これはアタックすることができない」
  it("RS-106: 1体以上撃破したらアタックできない／撃破しなければアタックできる（出典: 08-errata R-ERR-RS106）", () => {
    const done = juu(redFirst({ rush: [inst("SPEC-E1K", "a")] }), ["SPEC-E1K:a"]);
    expect(legal(done).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-106:dr")).toBe(false);
    const none = juu(redFirst({ rush: [inst("SPEC-E1K", "a")] }), []);
    expect(legal(none).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-106:dr")).toBe(true);
  });

  // 「これが敵軍ユニットにアタックできるとき」（読み替え後の条件。R-ATK-05 補足）
  it("RS-106: 敵軍バトルエリアにユニットがいない（アタックできない）ときは発動できない（出典: 08-errata R-ERR-RS106・05 R-ATK-05）", () => {
    const s = redFirst({ battle: [], rush: [inst("SPEC-E1K", "a")] });
    expect(canJuu(s, "RS-106:dr")).toBe(false);
  });

  // R-CN-02: CN の欄の効果は並び順が CN と一致して出たときだけ
  it("RS-106: 1番目以外で出たとき（NC 不成立）は【ジュウクンドー】を発動できない（出典: atwiki/page-23「CN：1」・R-CN-02）", () => {
    const s = redFirst({ rush: [inst("SPEC-E1K", "a")] }, 1);
    expect(canJuu(s, "RS-106:dr")).toBe(false);
  });

  // faq-card-2 RS-106 Q1「先に撃破する対象をすべて選んでから、選んだユニットを１体ずつ撃破するようにしてください」
  it("RS-106: 公式Q&A — 撃破対象はすべて先に選び、確定後にまとめて撃破する（出典: grnrngr/faq-card-2 RS-106 Q1）", () => {
    let s = redFirst({ rush: [inst("SPEC-E1K", "a"), inst("SPEC-E2K", "b")] });
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1K:a" });
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("rush");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E2K:b" });
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(s.players.player2.rush).toHaveLength(0);
  });

  // faq-card-2 RS-106 Q2「「RS-140 コロン」の効果でコンビネーションナンバーが２になっています」
  it("RS-106: 公式Q&A — 敵軍ラッシュエリアにコロンがあると CN が2になり、2番目に出て発動できる（出典: grnrngr/faq-card-2 RS-106 Q2）", () => {
    const s = redFirst({ rush: [inst("RS-140", "colon"), inst("SPEC-E1K", "a")] }, 1);
    expect(canJuu(s, "RS-106:dr")).toBe(true);
  });

  it("RS-106: 公式Q&A — コロンで CN が2になっているとき、1番目に出ても発動しない（出典: grnrngr/faq-card-2 RS-106 Q2・R-CN-02）", () => {
    const s = redFirst({ rush: [inst("RS-140", "colon"), inst("SPEC-E1K", "a")] }, 0);
    expect(canJuu(s, "RS-106:dr")).toBe(false);
  });

  it.todo(
    "RS-106: 公式Q&A — タイムピンクからのコンビネーションでは、コロン下で敵軍コマンドを2枚リリースして発動する（出典: grnrngr/faq-card-2 RS-106 Q2）— タイムピンク（RS-222）のコンビネーション経路を本ファイルの範囲で組み立てられない",
  );

  // faq-card-2 RS-106 Q3「「RS-135 ジェットファルコン」にアタックすることはできないので…発動できない」
  it("RS-106: 公式Q&A — 敵軍バトルエリアがジェットファルコンだけなら発動できない（出典: grnrngr/faq-card-2 RS-106 Q3）", () => {
    const s = redFirst({ battle: [inst("RS-135", "jf")], rush: [inst("SPEC-E1K", "a")] });
    expect(canJuu(s, "RS-106:dr")).toBe(false);
  });

  // faq-card-2 RS-106 Q4「いいえ、できません。」（アタックとはみなさない）
  it("RS-106: 公式Q&A — ジュウクンドーはアタックではないので、相手は隠流忍術を使えない（出典: grnrngr/faq-card-2 RS-106 Q4）", () => {
    let s = st(
      {
        player1: { rush: [inst("RS-106", "dr")] },
        player2: {
          battle: [inst("TST-UNIT-0", "wall")],
          rush: [inst("SPEC-E1K", "a"), inst("TST-UNIT-0", "sub")],
          hand: [inst("RS-018", "n1")],
          command: [released("TST-OP-MA", "m1")],
          power: powerCards(5),
        },
      },
      EXTRA,
    );
    s = enter(s, "RS-106:dr");
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1K:a" });
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(canUseCard(s, "player2", "RS-018:n1")).toBe(false);
  });

  // faq-card-2 RS-106 Q5「いいえ、できません。」（ダイノガッツで留まった対象を選び直せない）
  it("RS-106: 公式Q&A — ダイノガッツで場に留まった対象を、もう一度選んで撃破することはできない（出典: grnrngr/faq-card-2 RS-106 Q5）", () => {
    let s = st(
      {
        player1: { rush: [inst("RS-106", "dr")] },
        player2: {
          battle: [inst("TST-UNIT-0", "wall")],
          rush: [inst("SPEC-E1K", "a")],
          hand: [inst("RS-027", "dg")],
          command: [released("TST-OP", "c")],
          deck: deckCards(5, "e"),
          power: powerCards(5),
        },
      },
      EXTRA,
    );
    s = enter(s, "RS-106:dr");
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-106:dr" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E1K:a" });
    if (s.pendingEffectChoice) s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(canUseCard(s, "player2", "RS-027:dg")).toBe(true);
    s = useCard(s, "player2", "RS-027:dg");
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("rush");
    // 再開された選択を確定しても、同じユニットは再び撃破されない
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      s = settle(act(s, { type: "confirm_effect_choice", playerId: "player1" }));
    }
    expect(zoneOf(s, "player2", "SPEC-E1K:a")).toBe("rush");
  });

  // faq-card-2 RS-106 Q6（旧テキストの裁定。読み替え後の「アタックできるとき」と同じ結論）
  it("RS-106: 公式Q&A — 相手のバトルエリアにユニットがいなければ発動できない（出典: grnrngr/faq-card-2 RS-106 Q6・08-errata R-ERR-RS106）", () => {
    const s = redFirst({ battle: [], rush: [inst("SPEC-E1K", "a")] });
    expect(canJuu(s, "RS-106:dr")).toBe(false);
  });

  // faq-card-2 RS-106 Q7「自分のターンが回ってきた時点で、そのターンは「RS-106 デカレッド」をラッシュしたターンではない」
  it("RS-106: 公式Q&A — 相手が前のターンにラッシュしたデカレッドを、自分のデカグリーンでバトルエリアに出させられる（出典: grnrngr/faq-card-2 RS-106 Q7）", () => {
    let s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { rush: [inst("RS-108", "g"), ...fillers(2)], deck: deckCards(5) },
      player2: {
        hand: [inst("RS-106", "dr")],
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(3),
        deck: deckCards(5, "e"),
      },
    });
    const r = rushFromHand(s, "player2", "RS-106:dr");
    expect(r.ok).toBe(true);
    s = endTurn(r.state);
    s = toPhase(s, "player1", "battle");
    s = passEntry(enter(s, "TST-UNIT-0:fill0"));
    s = passEntry(enter(s, "TST-UNIT-0:fill1"));
    s = enter(s, "RS-108:g");
    expect(choiceIds(s)).toContain("RS-106:dr");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-106:dr" });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "RS-106:dr")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-107 デカブルー", () => {
  it("RS-107: カタログ本文・スペックが出典と一致（出典: atwiki/page-305）", () => {
    expectCatalogText("RS-107", "【ディースナイパー】このターン、相手がカウンターを発動するためにホールドしたコマンドは捨札になる。");
    expectStats("RS-107", {
      name: "デカブルー",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 2,
      features: ["ブルー", "男", "警察"],
    });
  });

  function blueState(before: number) {
    return st({
      player1: { battle: fillers(before), rush: [inst("RS-107", "db")], deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-7", "big")],
        rush: [inst("TST-UNIT-0", "sub")],
        hand: [inst("RS-018", "n1")],
        command: [released("TST-OP-MA", "m1")],
        power: powerCards(5),
        deck: deckCards(3, "e"),
      },
    });
  }

  // 「このターン、相手がカウンターを発動するためにホールドしたコマンドは捨札になる」
  it("RS-107: 2番目に出た後、相手がカウンター（隠流忍術）のためにホールドしたコマンドは捨札になる（出典: atwiki/page-305）", () => {
    let s = passEntry(enter(blueState(1), "RS-107:db"));
    expect(ncLogged(s, "RS-107")).toBe(true);
    s = attack(s, "TST-UNIT-0:fill0", "TST-UNIT-7:big");
    s = useCard(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-0:sub" });
    expect(zoneOf(s, "player2", "TST-OP-MA:m1")).toBe("discard");
  });

  it("RS-107: NC 不成立（1番目）ならカウンターのコマンドはホールド状態で残る（出典: atwiki/page-305「CN：2」）", () => {
    let s = st({
      player1: { battle: [], rush: [inst("RS-107", "db"), inst("TST-UNIT-0", "f")], deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-7", "big")],
        rush: [inst("TST-UNIT-0", "sub")],
        hand: [inst("RS-018", "n1")],
        command: [released("TST-OP-MA", "m1")],
        power: powerCards(5),
      },
    });
    s = passEntry(enter(s, "RS-107:db"));
    s = enter(s, "TST-UNIT-0:f");
    s = attack(s, "TST-UNIT-0:f", "TST-UNIT-7:big");
    s = useCard(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-0:sub" });
    expect(zoneOf(s, "player2", "TST-OP-MA:m1")).toBe("command");
  });

  // faq-card-2 RS-107 Q1「いいえ、捨札にはなりません。「このターン」とある効果は、その効果が発動した以降のターン中にのみ適用される」
  it("RS-107: 公式Q&A — 発動より前（ラッシュフェイズ）に相手が疾風流超忍法のためにホールドしたコマンドは捨札にならない（発動後のカウンター分は捨札）（出典: grnrngr/faq-card-2 RS-107 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("TST-UNIT-0", "rushee")],
        battle: [inst("TST-UNIT-0", "f0")],
        rush: [inst("RS-107", "db")],
        command: [released("TST-OP", "c")],
        deck: deckCards(3),
      },
      player2: {
        battle: [inst("TST-UNIT-7", "big")],
        rush: [inst("TST-UNIT-0", "sub")],
        hand: [inst("RS-026", "hp"), inst("RS-018", "n1")],
        command: [released("TST-OP-MA", "early"), released("TST-OP-MA", "late")],
        power: powerCards(5),
      },
    });
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "TST-UNIT-0:rushee" });
    expect(s.pendingRush).toBeTruthy();
    expect(canUseCard(s, "player2", "RS-026:hp")).toBe(true);
    s = settle(useCard(s, "player2", "RS-026:hp"));
    const early = s.players.player2.command.find((c) => c.commandHeld)?.instanceId;
    expect(early).toBeDefined();
    const late = s.players.player2.command.find((c) => !c.commandHeld)!.instanceId;
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = passEntry(enter(s, "RS-107:db"));
    expect(ncLogged(s, "RS-107")).toBe(true);
    s = attack(s, "TST-UNIT-0:f0", "TST-UNIT-7:big");
    s = useCard(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-0:sub" });
    expect(zoneOf(s, "player2", early!)).toBe("command");
    expect(zoneOf(s, "player2", late)).toBe("discard");
  });

  // faq-card-2 RS-107 Q2「はい、その通りです。」（デカブルーが場を離れても継続）
  it("RS-107: 公式Q&A — デカブルーが撃破された後も、そのターンのカウンター用ホールドは捨札になる（出典: grnrngr/faq-card-2 RS-107 Q2）", () => {
    let s = enter(blueState(1), "RS-107:db");
    s = attack(s, "RS-107:db", "TST-UNIT-7:big");
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-107:db")).toBe("discard");
    s = attack(s, "TST-UNIT-0:fill0", "TST-UNIT-7:big");
    s = useCard(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-0:sub" });
    expect(zoneOf(s, "player2", "TST-OP-MA:m1")).toBe("discard");
  });

  it("RS-107: 「このターン」だけ — 次の自軍ターンに相手がカウンターのためにホールドしたコマンドは捨札にならない（出典: atwiki/page-305・R-TURN-04）", () => {
    let s = passEntry(enter(blueState(1), "RS-107:db"));
    s = endTurn(s);
    s = toPhase(s, "player2", "battle");
    s = passEntry(enter(s, "TST-UNIT-7:big", "player2"), "player2");
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    s = enter(s, "TST-UNIT-0:fill0");
    s = attack(s, "TST-UNIT-0:fill0", "TST-UNIT-7:big");
    expect(canUseCard(s, "player2", "RS-018:n1")).toBe(true);
    s = useCard(s, "player2", "RS-018:n1", { substituteInstanceId: "TST-UNIT-0:sub" });
    expect(zoneOf(s, "player2", "TST-OP-MA:m1")).toBe("command");
  });
});

// ===========================================================================
describe("RS-108 デカグリーン", () => {
  const EM = sUnit("SPEC-EM", { size: "M", bp: 3000 });

  it("RS-108: カタログ本文・スペックが出典と一致（出典: atwiki/page-307）", () => {
    expectCatalogText(
      "RS-108",
      "【グリーンクラッシュ】敵軍ラッシュエリアにあるSユニットを2体まで選んでバトルエリアに出してもよい（出す順番は自分が選ぶ）。",
    );
    expectStats("RS-108", {
      name: "デカグリーン",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 3,
      features: ["グリーン", "男", "警察"],
    });
  });

  function greenThird(enemyRush: ReturnType<typeof inst>[]) {
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-108", "g")] }, player2: { rush: enemyRush } }, [EM]);
    s = enter(s, "RS-108:g");
    return s;
  }

  // 「敵軍ラッシュエリアにあるSユニットを2体まで選んでバトルエリアに出してもよい（出す順番は自分が選ぶ）」
  it("RS-108: 3番目に出ると、敵軍ラッシュエリアの S ユニットを選んで敵軍バトルエリアへ出す（M は対象外）（出典: atwiki/page-307）", () => {
    let s = greenThird([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("SPEC-EM", "m")]);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e2" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-EM:m")).toBe("rush");
  });

  it.fails("RS-108: 2体目も選んで、選んだ順に出せる（出典: atwiki/page-307「2体まで選んで…（出す順番は自分が選ぶ）」）", () => {
    // 既知の不具合: CARD-RS-108 グリーンクラッシュが1体選ぶと終了し、2体目を出せない（selectCount 1）
    let s = greenThird([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e2" });
    if (s.pendingEffectChoice?.playerId === "player1" && !s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-0:e1")) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:e1" });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(zoneIds(s, "player2", "battle")).toEqual(["TST-UNIT-0:e2", "TST-UNIT-0:e1"]);
  });

  it.fails("RS-108: S ユニットが3体以上いれば、どの2体でも選べる（3体目も候補）（出典: atwiki/page-307「2体まで選んで」）", () => {
    // 既知の不具合: CARD-RS-108 グリーンクラッシュの候補が敵軍ラッシュエリアの先頭2体に切り詰められ、3体目以降を選べない
    const s = greenThird([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")]);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2", "TST-UNIT-0:e3"]);
  });

  it("RS-108: 2体を出したらそれ以上は出さない（出典: atwiki/page-307「2体まで」）", () => {
    let s = greenThird([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")]);
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      const id = s.pendingEffectChoice.validInstanceIds.find((x) => zoneOf(s, "player2", x) === "rush");
      if (!id) break;
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    s = settle(s);
    expect(s.players.player2.battle.length).toBeLessThanOrEqual(2);
    expect(s.players.player2.rush.length).toBeGreaterThanOrEqual(1);
  });

  // 「出してもよい」
  it("RS-108: 出さないことを選べる（任意）（出典: atwiki/page-307）", () => {
    let s = greenThird([inst("TST-UNIT-0", "e1")]);
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });

  it("RS-108: 3番目以外で出たときは発動しない（出典: atwiki/page-307「CN：3」）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-108", "g")] }, player2: { rush: [inst("TST-UNIT-0", "e1")] } });
    s = enter(s, "RS-108:g");
    expect(s.pendingEffectChoice).toBeFalsy();
  });

  // faq-card-2 RS-108 Q1「いいえ、それはできません。ユニットをビークルにライドさせることができるのは、自軍バトルフェイズに…だけです」
  it("RS-108: 公式Q&A — グリーンクラッシュで出されるユニットはビークルにライドしない（出典: grnrngr/faq-card-2 RS-108 Q1）", () => {
    const V = { ...sUnit("SPEC-V"), type: "vehicle" as const, size: "M" as const, sp: undefined };
    const RC = sUnit("SPEC-RC", { comboNumber: "RC" as never, bp: 3000 });
    let s = st(
      { player1: { battle: fillers(2), rush: [inst("RS-108", "g")] }, player2: { rush: [inst("SPEC-V", "v"), inst("SPEC-RC", "rc")] } },
      [V, RC],
    );
    s = enter(s, "RS-108:g");
    expect(choiceIds(s)).toContain("SPEC-RC:rc");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-RC:rc" });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player2", "SPEC-RC:rc")).toBe("battle");
    expect(s.players.player2.battle.find((c) => c.instanceId === "SPEC-RC:rc")?.mountedOnInstanceId).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-V:v")).toBe("rush");
  });

  // faq-card-2 RS-108 Q2「手札が２枚以上あれば…手札を２枚捨札にして「RS-165 狼鬼」をバトルエリアに出さなければなりません。…１枚以下であれば…ラッシュエリアに留まります」
  it("RS-108: 公式Q&A — 狼鬼は相手の手札が2枚以上なら2枚捨ててバトルエリアに出る（出典: grnrngr/faq-card-2 RS-108 Q2）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-108", "g")] },
      player2: { rush: [inst("RS-165", "rouki")], hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")] },
    });
    s = enter(s, "RS-108:g");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-165:rouki" });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player2"; i++) {
      const pick = legal(s).find((a) => a.type === "resolve_effect_choice" && a.playerId === "player2");
      if (!pick) break;
      s = act(s, pick);
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("battle");
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RS-108: 公式Q&A — 相手の手札が1枚以下なら狼鬼はラッシュエリアに留まる（出典: grnrngr/faq-card-2 RS-108 Q2）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-108", "g")] },
      player2: { rush: [inst("RS-165", "rouki")], hand: [inst("TST-OP", "h1")] },
    });
    s = enter(s, "RS-108:g");
    const r = tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-165:rouki" });
    if (r.ok) s = r.state;
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("rush");
    expect(s.players.player2.hand).toHaveLength(1);
  });

  // faq-card-2 RS-108 Q3 = RS-106 Q7
  it("RS-108: 公式Q&A — 相手が前のターンにラッシュしたデカレッドもバトルエリアに出させられる（出典: grnrngr/faq-card-2 RS-108 Q3）", () => {
    let s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { rush: [inst("RS-108", "g"), ...fillers(2)], deck: deckCards(5) },
      player2: {
        hand: [inst("RS-106", "dr")],
        command: [released("TST-OP-OT", "ot")],
        power: powerCards(3),
        deck: deckCards(5, "e"),
      },
    });
    const r = rushFromHand(s, "player2", "RS-106:dr");
    expect(r.ok).toBe(true);
    s = toPhase(endTurn(r.state), "player1", "battle");
    s = passEntry(enter(s, "TST-UNIT-0:fill0"));
    s = passEntry(enter(s, "TST-UNIT-0:fill1"));
    s = enter(s, "RS-108:g");
    expect(choiceIds(s)).toContain("RS-106:dr");
  });
});

// ===========================================================================
describe("RS-109 デカイエロー", () => {
  const MU = sUnit("SPEC-MU", { size: "M" });

  it("RS-109: カタログ本文・スペックが出典と一致（出典: atwiki/page-306）", () => {
    expectCatalogText(
      "RS-109",
      "【応援要請】「SP1」自軍パワーゾーンのダメージになっていないカードの中から、Sユニットのカードを1枚選んで手札に加えてもよい。",
    );
    expectStats("RS-109", {
      name: "デカイエロー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 4,
      features: ["イエロー", "女", "警察"],
    });
  });

  function yellowFourth() {
    let s = st(
      {
        player1: {
          battle: fillers(3),
          rush: [inst("RS-109", "dy")],
          power: [
            inst("TST-UNIT-0", "ps"),
            { ...inst("TST-UNIT-0", "dmg"), faceDown: true },
            inst("SPEC-MU", "pm"),
            inst("TST-OP", "po"),
          ],
        },
      },
      [MU],
    );
    s = enter(s, "RS-109:dy");
    return s;
  }

  // 「「SP1」」
  it("RS-109: 4番目に出ると「SP1」になりストライクできる（出典: atwiki/page-306）", () => {
    let s = yellowFourth();
    if (s.pendingEffectChoice) s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(canStrike(s, "RS-109:dy")).toBe(true);
  });

  // 「自軍パワーゾーンのダメージになっていないカードの中から、Sユニットのカードを1枚選んで手札に加えてもよい」
  it("RS-109: 自軍パワーゾーンのダメージ以外の S ユニットのカードを1枚手札に加える（ダメージ・M・オペレーションは対象外）（出典: atwiki/page-306）", () => {
    let s = yellowFourth();
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:ps"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-0:ps" });
    expect(zoneOf(s, "player1", "TST-UNIT-0:ps")).toBe("hand");
  });

  it("RS-109: 手札に加えないことを選べる（任意）（出典: atwiki/page-306「加えてもよい」）", () => {
    let s = yellowFourth();
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "TST-UNIT-0:ps")).toBe("power");
  });

  it("RS-109: 4番目以外で出たときは「SP！」のままで、効果も発動しない（出典: atwiki/page-306「CN：4」）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-109", "dy")], power: [inst("TST-UNIT-0", "ps")] } });
    s = enter(s, "RS-109:dy");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(canStrike(s, "RS-109:dy")).toBe(false);
  });
});

// ===========================================================================
describe("RS-110 デカピンク", () => {
  it("RS-110: カタログ本文・スペックが出典と一致（出典: atwiki/page-308）", () => {
    expectCatalogText("RS-110", "【ゼニボム】次の相手ターン、新しくラッシュエリアに出たユニットは、ターンが終わるまでバトルエリアに出られない。");
    expectStats("RS-110", {
      name: "デカピンク",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 5,
      features: ["ピンク", "女", "警察"],
    });
  });

  function pinkFifth(opts: { destroyPink?: boolean } = {}) {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-110", "pink")], deck: deckCards(5) },
      player2: {
        battle: [inst("TST-UNIT-2", "wall")],
        rush: [inst("TST-UNIT-0", "old")],
        hand: [inst("TST-UNIT-0", "newbie"), inst("RS-090", "red")],
        command: [...releasedN(2, "TST-OP", "wb"), ...releasedN(2, "TST-OP-OT", "ot")],
        power: powerCards(3),
        deck: deckCards(5, "e"),
      },
    });
    s = enter(s, "RS-110:pink");
    if (opts.destroyPink) {
      s = settle(attack(s, "RS-110:pink", "TST-UNIT-2:wall"));
      expect(zoneOf(s, "player1", "RS-110:pink")).toBe("discard");
    } else {
      s = passEntry(s);
    }
    s = endTurn(s);
    return toPhase(s, "player2", "rush");
  }

  // 「次の相手ターン、新しくラッシュエリアに出たユニットは、ターンが終わるまでバトルエリアに出られない」
  it("RS-110: 次の相手ターンにラッシュしたユニットはバトルエリアに出られない（前からラッシュエリアにいたユニットは出られる）（出典: atwiki/page-308）", () => {
    let s = pinkFifth();
    const r = rushFromHand(s, "player2", "TST-UNIT-0:newbie");
    expect(r.ok).toBe(true);
    s = act(settle(r.state), { type: "end_phase", playerId: "player2" });
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "TST-UNIT-0:newbie", "player2")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:old", "player2")).toBe(true);
  });

  it("RS-110: 効果は「次の相手ターン」だけ — その次の相手ターンにラッシュしたユニットは出られる（出典: atwiki/page-308）", () => {
    let s = pinkFifth();
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    s = endTurn(s);
    s = toPhase(s, "player2", "rush");
    const r = rushFromHand(s, "player2", "TST-UNIT-0:newbie");
    expect(r.ok).toBe(true);
    s = act(settle(r.state), { type: "end_phase", playerId: "player2" });
    expect(canEnter(s, "TST-UNIT-0:newbie", "player2")).toBe(true);
  });

  it("RS-110: 5番目以外で出たときは発動しない（出典: atwiki/page-308「CN：5」）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-110", "pink")] } });
    s = enter(s, "RS-110:pink");
    expect(ncLogged(s, "RS-110")).toBe(false);
  });

  // faq-card-2 RS-110 Q1「「RS-110 デカピンク」が撃破されても、そのコンビネーションが崩されても、効果は有効になります」
  it("RS-110: 公式Q&A — デカピンクが撃破されても効果は有効（出典: grnrngr/faq-card-2 RS-110 Q1）", () => {
    let s = pinkFifth({ destroyPink: true });
    const r = rushFromHand(s, "player2", "TST-UNIT-0:newbie");
    expect(r.ok).toBe(true);
    s = act(settle(r.state), { type: "end_phase", playerId: "player2" });
    expect(canEnter(s, "TST-UNIT-0:newbie", "player2")).toBe(false);
  });

  // faq-card-2 RS-110 Q2「はい、その通りです。「可能なら」とありますので…ラッシュエリアに置きます」
  // （出典の食い違い: atwiki/page-308 Q2 は「（2010/10/25修正）いいえ…バトルエリアに置かれます」。優先順位により公式FAQを採る）
  it("RS-110: 公式Q&A — ゼニボムの効いているターンに相手がラッシュしたレッドレーサーはラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-110 Q2。atwiki/page-308 Q2 とは食い違い）", () => {
    const s = pinkFifth();
    const r = rushFromHand(s, "player2", "RS-090:red");
    expect(r.ok).toBe(true);
    expect(zoneOf(settle(r.state), "player2", "RS-090:red")).toBe("rush");
  });
});

void [held];
