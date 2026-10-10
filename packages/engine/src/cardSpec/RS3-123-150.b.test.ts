/**
 * カード別スペック: RS-132〜RS-141（第3弾「三界の獅子」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-106 デカレッドの読み替え R-ERR-RS106 を RS-135 Q7 で参照）、
 *     grnrngr/faq-card-3（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_3.html）と card_1/2/4/6 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当なし）
 *  3. docs/rules/*.md の一般ルール（R-CN-04 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  choiceIds,
  deckCards,
  drain,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  ncLogged,
  pick,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  tryAct,
  useCard,
  zoneIds,
  zoneOf,
} from "./RS3-123-150.helpers";
import type { GameState, PlayerId } from "../types/game";

/** バトル進入直後の行動ウィンドウをパスする。 */
function passEntry(s: GameState, playerId: PlayerId = "player1"): GameState {
  const pass = legal(s).find((a) => a.type === "pass_battle_entry" && a.playerId === playerId);
  return pass ? act(s, pass) : s;
}

/** スタートフェイズに、指定のユニット（1組）をラッシュエリアに戻す。 */
function returnOne(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  const one = legal(s).find(
    (a) => a.type === "return_all_battle_to_rush" && a.playerId === playerId && (a as { instanceId?: string }).instanceId === instanceId,
  );
  // 戻す組が1つだけなら instanceId 指定のアクションは出ない（その1組を戻す）
  return act(s, one ?? { type: "return_all_battle_to_rush", playerId });
}

// ===========================================================================
describe("RS-132 バルジオン", () => {
  const TEXT =
    "※これは、自軍ラッシュエリアのSユニットを1体捨札にしなければバトルエリアに出られない。【反バイオ粒子砲】これがバトルエリアに出るとき、捨札にしたSユニットが「バイオハンター・シルバ」ならこのターン、これは次の能力を得る。⇒「SP1」「BP+5000」";

  // 同名カード（PR-008 等）の代わりに、名前だけ「バイオハンター・シルバ」のテスト用 S ユニット
  const SILVA2 = sUnit("SPEC-SILVA", { name: "バイオハンター・シルバ", category: "DA", bp: 3000 });

  function barujion(sacrifice: string): GameState {
    let s = st(
      {
        player1: { rush: [inst("RS-132", "bj"), inst(sacrifice, "sac")] },
        player2: { deck: deckCards(5, "ed") },
      },
      [SILVA2],
    );
    s = enter(s, "RS-132:bj");
    s = drain(s, "player1", [`${sacrifice}:sac`]);
    // 捨札にする手順の後で、改めてバトルエリアに出す（エンジンは2段階）
    if (zoneOf(s, "player1", "RS-132:bj") === "rush") s = enter(s, "RS-132:bj");
    return s;
  }

  it("RS-132: カタログ本文・スペックが出典と一致（出典: atwiki/page-40）", () => {
    expectCatalogText("RS-132", TEXT);
    expectStats("RS-132", {
      name: "バルジオン",
      category: "DA",
      size: "L",
      bp: 6000,
      sp: "special",
      powerCost: 6,
      features: ["メカ", "人型"],
    });
  });

  it("RS-132: ※自軍ラッシュエリアの S ユニットを1体捨札にしてバトルエリアに出る（出典: atwiki/page-40）", () => {
    const s = barujion("TST-UNIT-0");
    expect(zoneOf(s, "player1", "RS-132:bj")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:sac")).toBe("discard");
  });

  it("RS-132: ※自軍ラッシュエリアに S ユニットがなければバトルエリアに出られない（出典: atwiki/page-40）", () => {
    const s = st({ player1: { rush: [inst("RS-132", "bj"), inst("TST-UNIT-2", "m")] } });
    const r = tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-132:bj" });
    expect(r.ok && zoneOf(r.state, "player1", "RS-132:bj") === "battle").toBe(false);
  });

  it("RS-132: 捨札にしたのが「バイオハンター・シルバ」なら、このターン「SP1」「BP+5000」（出典: atwiki/page-40）", () => {
    let s = barujion("RS-079");
    expect(bpOf(s, "player1", "RS-132:bj")).toBe(11000);
    expect(canStrike(s, "RS-132:bj")).toBe(true);
  });

  it("RS-132: シルバ以外を捨札にしたら BP6000・「SP！」のまま（ストライクできない）（出典: atwiki/page-40）", () => {
    const s = barujion("TST-UNIT-0");
    expect(bpOf(s, "player1", "RS-132:bj")).toBe(6000);
    expect(canStrike(s, "RS-132:bj")).toBe(false);
  });

  it("RS-132: 同名の別カード（PR-008 等の「バイオハンター・シルバ」）を捨札にしても発動する（出典: atwiki/page-40「「バイオハンター・シルバ」なら」・関連カード PR-008）", () => {
    const s = barujion("SPEC-SILVA");
    expect(bpOf(s, "player1", "RS-132:bj")).toBe(11000);
  });
});

// ===========================================================================
describe("RS-133 副官ブーバ", () => {
  const TEXT = "【ブルバドス活人剣】自軍ターン中、これが特徴「女」を持つユニットを撃破したとき、そのユニットを持ち主の山札の上に戻す。";
  const F = sUnit("SPEC-F", { bp: 1000, features: ["女"] });
  const F5 = sUnit("SPEC-F5", { bp: 5000, features: ["女"] });

  it("RS-133: カタログ本文・スペックが出典と一致（出典: atwiki/page-335）", () => {
    expectCatalogText("RS-133", TEXT);
    expectStats("RS-133", {
      name: "副官ブーバ",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["宇宙海賊", "男"],
    });
  });

  it("RS-133: 自軍ターン中に特徴「女」のユニットを撃破すると、捨札ではなく持ち主の山札の上に戻す（出典: atwiki/page-335）", () => {
    let s = st({ player1: { battle: [inst("RS-133", "bu")] }, player2: { battle: [inst("SPEC-F", "f")] } }, [F]);
    s = settle(attack(s, "RS-133:bu", "SPEC-F:f"));
    expect(zoneOf(s, "player2", "SPEC-F:f")).toBe("deck");
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-F:f");
  });

  it("RS-133: 特徴「女」を持たないユニットは通常どおり捨札（出典: atwiki/page-335）", () => {
    let s = st({ player1: { battle: [inst("RS-133", "bu")] }, player2: { battle: [inst("TST-UNIT-0", "m")] } });
    s = settle(attack(s, "RS-133:bu", "TST-UNIT-0:m"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:m")).toBe("discard");
  });

  it("RS-133: 敵軍ターン中にアタックされて撃破したときは山札に戻さない（出典: atwiki/page-335「自軍ターン中」）", () => {
    let s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-133", "bu")] }, player2: { battle: [inst("SPEC-F", "f")] } },
      [F],
    );
    s = settle(attack(s, "SPEC-F:f", "RS-133:bu", "player2"));
    expect(zoneOf(s, "player2", "SPEC-F:f")).toBe("discard");
  });

  it("RS-133: 撃破できなければ（相手の BP が高い）何もしない（出典: atwiki/page-335「撃破したとき」）", () => {
    let s = st({ player1: { battle: [inst("RS-133", "bu")] }, player2: { battle: [inst("SPEC-F5", "f")] } }, [F5]);
    s = settle(attack(s, "RS-133:bu", "SPEC-F5:f"));
    expect(zoneOf(s, "player2", "SPEC-F5:f")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-133:bu")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-134 ライブロボ", () => {
  const TEXT = "合体―ジェットファルコン＋ランドライオン＋アクアドルフィン【スーパーライブクラッシュ】これはアタックするときBP＋4000される。";
  const E15 = sUnit("SPEC-E15", { bp: 15000, size: "L" });
  const E13 = sUnit("SPEC-E13", { bp: 13000, size: "L" });

  it("RS-134: カタログ本文・スペックが出典と一致（出典: atwiki/page-341）", () => {
    expectCatalogText("RS-134", TEXT);
    expectStats("RS-134", {
      name: "ライブロボ",
      category: "ET",
      size: "L",
      bp: 12000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-134: 合体ユニット（ジェットファルコン・ランドライオン・アクアドルフィン）を捨札にしてラッシュする（出典: atwiki/page-341）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-134", "lr")],
        rush: [inst("RS-135", "jf"), inst("RS-136", "ll"), inst("RS-137", "ad")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(7),
      },
    });
    const r = rushFromHand(s, "player1", "RS-134:lr", { materials: ["RS-135:jf", "RS-136:ll", "RS-137:ad"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-134:lr")).toBe("rush");
    for (const id of ["RS-135:jf", "RS-136:ll", "RS-137:ad"]) expect(zoneOf(r.state, "player1", id)).toBe("discard");
  });

  it("RS-134: アタックするとき BP+4000（BP16000 で BP15000 を撃破）（出典: atwiki/page-341）", () => {
    let s = st({ player1: { battle: [inst("RS-134", "lr")] }, player2: { battle: [inst("SPEC-E15", "e")] } }, [E15]);
    expect(bpOf(s, "player1", "RS-134:lr")).toBe(12000);
    s = settle(attack(s, "RS-134:lr", "SPEC-E15:e"));
    expect(zoneOf(s, "player2", "SPEC-E15:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-134:lr")).toBe("battle");
  });

  it("RS-134: アタックされたときは BP+4000 されない（BP13000 にアタックされて負ける）（出典: atwiki/page-341「アタックするとき」）", () => {
    let s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-134", "lr")] }, player2: { battle: [inst("SPEC-E13", "e")] } },
      [E13],
    );
    s = settle(attack(s, "SPEC-E13:e", "RS-134:lr", "player2"));
    expect(zoneOf(s, "player1", "RS-134:lr")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-135 ジェットファルコン", () => {
  const TEXT =
    "※これは、特徴「航空機」を持たないユニットにアタックされない。【ファルコンクロー】これが自軍バトルエリアからラッシュエリアに戻るとき、敵軍ラッシュエリアからユニットを1体選び、可能ならバトルエリアに出してもよい。";
  const AIR = sUnit("SPEC-AIR", { bp: 3000, features: ["航空機"] });
  const GND = sUnit("SPEC-GND", { bp: 3000 });
  const E2 = sUnit("SPEC-E2", { bp: 2000 });

  /** player1 のスタートフェイズ。バトルエリアにジェットファルコン（＋extra）、敵軍ラッシュエリアに enemyRush。 */
  function startWithFalcon(enemyRush: ReturnType<typeof inst>[], extra: ReturnType<typeof inst>[] = [], p2: Record<string, unknown> = {}): GameState {
    return st(
      {
        phase: "start",
        player1: { battle: [inst("RS-135", "jf"), ...extra], deck: deckCards(5) },
        player2: { rush: enemyRush, ...p2 },
      },
      [AIR, GND, E2],
    );
  }

  it("RS-135: カタログ本文・スペックが出典と一致（出典: atwiki/page-350）", () => {
    expectCatalogText("RS-135", TEXT);
    expectStats("RS-135", {
      name: "ジェットファルコン",
      category: "ET",
      size: "M",
      bp: 1000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-135: 追加条件 — 自軍 S ユニットを1体コマンドゾーンに送ってラッシュできる（出典: atwiki/page-350）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-135", "jf")], rush: [inst("TST-UNIT-0", "m")], command: [released("TST-OP-ET", "et")], power: powerCards(4) },
    });
    const r = rushFromHand(s, "player1", "RS-135:jf", { materials: ["TST-UNIT-0:m"], destination: "command" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-135:jf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:m")).toBe("command");
  });

  it("RS-135: 追加条件 — 自軍 S ユニットを1体捨札にしてラッシュできる（出典: atwiki/page-350）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-135", "jf")], rush: [inst("TST-UNIT-0", "m")], command: [released("TST-OP-ET", "et")], power: powerCards(4) },
    });
    const r = rushFromHand(s, "player1", "RS-135:jf", { materials: ["TST-UNIT-0:m"], destination: "discard" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:m")).toBe("discard");
  });

  it("RS-135: ※特徴「航空機」を持たないユニットはアタックできない・持つユニットはアタックできる（出典: atwiki/page-350）", () => {
    const s = st(
      { player1: { battle: [inst("SPEC-GND", "g"), inst("SPEC-AIR", "a")] }, player2: { battle: [inst("RS-135", "jf")] } },
      [AIR, GND],
    );
    expect(attackTargets(s, "SPEC-GND:g")).not.toContain("RS-135:jf");
    expect(attackTargets(s, "SPEC-AIR:a")).toContain("RS-135:jf");
  });

  it("RS-135: 【ファルコンクロー】スタートフェイズにラッシュエリアに戻るとき、敵軍ラッシュエリアのユニットを1体選んでバトルエリアに出す（出典: atwiki/page-350）", () => {
    let s = returnOne(startWithFalcon([inst("SPEC-E2", "e2")]), "RS-135:jf");
    expect(choiceIds(s)).toEqual(["SPEC-E2:e2"]);
    s = settle(pick(s, "SPEC-E2:e2"));
    expect(zoneOf(s, "player2", "SPEC-E2:e2")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-135:jf")).toBe("rush");
  });

  it("RS-135: 出さないことを選べる（任意）（出典: atwiki/page-350「出してもよい」）", () => {
    let s = returnOne(startWithFalcon([inst("SPEC-E2", "e2")]), "RS-135:jf");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "SPEC-E2:e2")).toBe("rush");
  });

  it("RS-135: 「可能なら」— バトルエリアに出られないユニット（童鬼ドロップ）を選んでもラッシュエリアに残る（出典: atwiki/page-350）", () => {
    let s = returnOne(startWithFalcon([inst("RS-093", "drop")]), "RS-135:jf");
    const r = tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-093:drop" });
    s = r.ok ? settle(r.state) : s;
    expect(zoneOf(s, "player2", "RS-093:drop")).toBe("rush");
  });

  // faq-card-3 RS-135 Q1「いいえ、それはできません。」
  it("RS-135: 公式Q&A — 相手のジェットファルコンで出される自軍ユニットはビークルにライドさせて出せない（出典: grnrngr/faq-card-3 RS-135 Q1）", () => {
    const V = { ...sUnit("SPEC-V"), type: "vehicle" as const, size: "M" as const, sp: undefined };
    let s = st(
      { phase: "start", player1: { battle: [inst("RS-135", "jf")], deck: deckCards(5) }, player2: { rush: [inst("SPEC-E2", "e2"), inst("SPEC-V", "v")] } },
      [E2, V],
    );
    s = returnOne(s, "RS-135:jf");
    s = settle(drain(pick(s, "SPEC-E2:e2"), "player2"));
    expect(zoneOf(s, "player2", "SPEC-E2:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-V:v")).toBe("rush");
    expect(s.players.player2.battle.find((c) => c.instanceId === "SPEC-E2:e2")?.mountedOnInstanceId).toBeUndefined();
  });

  // faq-card-3 RS-135 Q2「はい、ストライクすることができます。」
  it("RS-135: 公式Q&A — 敵軍バトルエリアがジェットファルコンだけでも、SP1 以上のユニットはストライクできる（出典: grnrngr/faq-card-3 RS-135 Q2）", () => {
    let s = st({ player1: { rush: [inst("TST-UNIT-0", "s")] }, player2: { battle: [inst("RS-135", "jf")] } });
    s = enter(s, "TST-UNIT-0:s");
    expect(attackTargets(s, "TST-UNIT-0:s")).toEqual([]);
    expect(canStrike(s, "TST-UNIT-0:s")).toBe(true);
  });

  // faq-card-3 RS-135 Q3「はい、できます。」
  it("RS-135: 公式Q&A — 先にジェットファルコンを戻して SP1 の敵軍ユニットを出し、ハリケンレオンでコマンドをホールドさせてからレオンを戻せる（出典: grnrngr/faq-card-3 RS-135 Q3）", () => {
    let s = startWithFalcon([inst("TST-UNIT-0", "e")], [inst("RS-097", "le")], { command: [released("TST-OP", "ec")] });
    s = returnOne(s, "RS-135:jf");
    s = pick(s, "TST-UNIT-0:e");
    s = drain(s, "player2");
    if (s.pendingCommandPayment?.playerId === "player2") {
      const p = s.pendingCommandPayment;
      s = act(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "RS-097:le")).toBe("battle");
    s = returnOne(s, "RS-097:le");
    expect(zoneOf(s, "player1", "RS-097:le")).toBe("rush");
  });

  // faq-card-3 RS-135 Q4（RS-141 Q1 と同文）
  it("RS-135: 公式Q&A — 紐男爵で戻されたジェットファルコンの効果で出された相手のユニットは NC を発動でき、紐男爵はアタックできなくなる（出典: grnrngr/faq-card-3 RS-135 Q4）", () => {
    // 自軍（ターンプレイヤー）の紐男爵が3番目に出て、相手のジェットファルコンをラッシュエリアに戻す
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-141", "himo"), inst("RS-130", "red1")], deck: deckCards(5) },
      player2: { battle: [inst("RS-135", "jf")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(5, "ed") },
    });
    s = enter(s, "RS-141:himo");
    s = pick(s, "RS-135:jf");
    // ファルコンクロー（相手）: 自軍ラッシュエリアのレッドワン（CN4）を4番目に出させる
    s = drain(s, "player2", ["RS-130:red1"]);
    expect(zoneOf(s, "player1", "RS-130:red1")).toBe("battle");
    expect(ncLogged(s, "RS-130")).toBe(true);
    s = settle(drain(s, "player1", ["TST-UNIT-0:er"]));
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("battle");
    expect(attackTargets(s, "RS-141:himo")).toEqual([]);
  });

  // faq-card-3 RS-135 Q5「敵軍「RS-145 ダッシュレオン」からコンビネーションさせる必要があります」
  it("RS-135: 公式Q&A — モアローダーはダッシュレオンからでなければ引き出せない（出典: grnrngr/faq-card-3 RS-135 Q5）", () => {
    let s = returnOne(startWithFalcon([inst("RS-147", "moa")]), "RS-135:jf");
    const r = tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-147:moa" });
    s = r.ok ? settle(r.state) : s;
    expect(zoneOf(s, "player2", "RS-147:moa")).toBe("rush");
  });

  it("RS-135: 公式Q&A — 2体のジェットファルコンでダッシュレオン→モアローダーの順に引き出せる（出典: grnrngr/faq-card-3 RS-135 Q5）", () => {
    let s = st({
      phase: "start",
      player1: { battle: [inst("RS-135", "jf1"), inst("RS-135", "jf2")], deck: deckCards(5) },
      player2: { rush: [inst("RS-145", "dash"), inst("RS-147", "moa")] },
    });
    s = settle(pick(returnOne(s, "RS-135:jf1"), "RS-145:dash"));
    s = settle(pick(returnOne(s, "RS-135:jf2"), "RS-147:moa"));
    expect(zoneOf(s, "player2", "RS-145:dash")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-147:moa")).toBe("battle");
  });

  it("RS-135: 公式Q&A — 相手に引き出されたユニットのコンビネーションの効果は発動しない（ダッシュレオンの【超文明の守護】でコマンドはリリースされない）（出典: grnrngr/faq-card-3 RS-135 Q5）", () => {
    let s = st({
      phase: "start",
      player1: { battle: [inst("RS-135", "jf1")], deck: deckCards(5) },
      player2: { rush: [inst("RS-145", "dash")], command: [held("TST-OP-MA", "h")] },
    });
    s = settle(pick(returnOne(s, "RS-135:jf1"), "RS-145:dash"));
    expect(zoneOf(s, "player2", "RS-145:dash")).toBe("battle");
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });

  // faq-card-3 RS-135 Q6「はい、出来ます。「RS-018 隠流忍術」は、「バトルの対象を変更する」と解釈してください。」
  it("RS-135: 公式Q&A — 航空機を持たないユニットのアタックに隠流忍術を使い、ジェットファルコンとバトルさせられる（出典: grnrngr/faq-card-3 RS-135 Q6）", () => {
    let s = st(
      {
        player1: { battle: [inst("SPEC-GND", "g")] },
        player2: {
          battle: [inst("SPEC-E2", "def"), inst("RS-135", "jf")],
          hand: [inst("RS-018", "n")],
          command: [released("TST-OP-MA", "ma"), released("TST-OP-MA", "ma2")],
          power: powerCards(5, "ep"),
        },
      },
      [GND, E2],
    );
    s = attack(s, "SPEC-GND:g", "SPEC-E2:def");
    const pay = legal(s).find(
      (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-018:n" && (a as { substituteInstanceId?: string }).substituteInstanceId === "RS-135:jf",
    );
    expect(pay).toBeDefined();
    s = act(s, pay!);
    const play = legal(s).find((a) => a.type === "play_counter" && a.instanceId === "RS-018:n");
    if (play) s = act(s, play);
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-135:jf")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2:def")).toBe("battle");
  });

  // faq-card-3 RS-135 Q7「その場合は発動できません。」（R-ERR-RS106 の読み替え後「アタックできるとき」とも一致）
  it("RS-135: 公式Q&A — 敵軍バトルエリアがジェットファルコンだけなら、デカレッドの【ジュウクンドー】は発動できない（出典: grnrngr/faq-card-3 RS-135 Q7・08-errata R-ERR-RS106）", () => {
    let s = st({
      player1: { rush: [inst("RS-106", "deka")] },
      player2: { battle: [inst("RS-135", "jf")], rush: [inst("TST-UNIT-0", "r")] },
    });
    s = enter(s, "RS-106:deka");
    expect(legal(s).some((a) => a.type === "use_juu_kun_do")).toBe(false);
  });
});

// ===========================================================================
describe("RS-136 ランドライオン", () => {
  const TEXT =
    "【強襲】これをラッシュしたとき次の効果を発動できる。敵軍バトルエリアからBP8000以下のユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";
  const E8 = sUnit("SPEC-E8", { bp: 8000, size: "M" });
  const E9 = sUnit("SPEC-E9", { bp: 9000, size: "M" });

  function rushLion(enemyCommand: ReturnType<typeof inst>[] = []) {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-136", "ll")], rush: [inst("TST-UNIT-0", "m")], command: [released("TST-OP-ET", "et")], power: powerCards(5) },
        player2: { battle: [inst("SPEC-E8", "e8"), inst("SPEC-E9", "e9")], rush: [inst("TST-UNIT-0", "er")], command: enemyCommand },
      },
      [E8, E9],
    );
    return rushFromHand(s, "player1", "RS-136:ll", { materials: ["TST-UNIT-0:m"] }).state;
  }

  it("RS-136: カタログ本文・スペックが出典と一致（出典: atwiki/page-351）", () => {
    expectCatalogText("RS-136", TEXT);
    expectStats("RS-136", {
      name: "ランドライオン",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-136: ラッシュしたとき、敵軍バトルエリアの BP8000 以下を1体選び、持ち主のコマンドゾーンにホールド状態で置く（BP9000・ラッシュエリアは対象外）（出典: atwiki/page-351）", () => {
    let s = rushLion();
    expect(choiceIds(s)).toEqual(["SPEC-E8:e8"]);
    s = settle(pick(s, "SPEC-E8:e8"));
    expect(zoneOf(s, "player2", "SPEC-E8:e8")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "SPEC-E8:e8")?.commandHeld).toBe(true);
  });

  it("RS-136: 発動しないことを選べる（出典: atwiki/page-351「次の効果を発動できる」）", () => {
    let s = rushLion();
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(zoneOf(s, "player2", "SPEC-E8:e8")).toBe("battle");
  });

  it("RS-136: 持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-351「置けなければ捨札にする」）", () => {
    let s = rushLion(releasedN(5, "TST-OP", "ec"));
    s = settle(pick(s, "SPEC-E8:e8"));
    expect(zoneOf(s, "player2", "SPEC-E8:e8")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("RS-137 アクアドルフィン", () => {
  const TEXT = "【潜航】これをラッシュしたとき、自軍捨札からユニットのカードを3枚まで選んで、山札の下に好きな順で戻してもよい。";

  function rushDolphin() {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-137", "ad")],
        rush: [inst("TST-UNIT-0", "m")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(6),
        deck: deckCards(3),
        discard: [inst("TST-UNIT-0", "u1"), inst("TST-OP", "op"), inst("TST-UNIT-0", "u2"), inst("TST-UNIT-2", "u3"), inst("TST-UNIT-0", "u4")],
      },
    });
    return rushFromHand(s, "player1", "RS-137:ad", { materials: ["TST-UNIT-0:m"] }).state;
  }

  it("RS-137: カタログ本文・スペックが出典と一致（出典: atwiki/page-352）", () => {
    expectCatalogText("RS-137", TEXT);
    expectStats("RS-137", {
      name: "アクアドルフィン",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "6+",
      features: ["メカ", "潜水艦"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-137: 捨札のユニットのカードを3枚まで山札の下に戻す（オペレーションは戻さない）（出典: atwiki/page-352）", () => {
    const s = settle(drain(rushDolphin(), "player1"));
    const deck = zoneIds(s, "player1", "deck");
    expect(deck.slice(0, 3)).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2"]);
    expect(deck).toHaveLength(6);
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
  });

  it("RS-137: 戻すユニットのカードを選べる（出典: atwiki/page-352「3枚まで選んで」）", () => {
    let s = rushDolphin();
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["TST-UNIT-0:u1", "TST-UNIT-0:u2", "TST-UNIT-2:u3", "TST-UNIT-0:u4"]));
    s = settle(pick(s, "TST-UNIT-0:u4"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u4")).toBe("deck");
  });

  it("RS-137: 戻さないことを選べる（任意）（出典: atwiki/page-352「戻してもよい」）", () => {
    let s = rushDolphin();
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u1")).toBe("discard");
  });

  it("RS-137: 戻す順番を自分で決められる（出典: atwiki/page-352「好きな順で」）", () => {
    let s = rushDolphin();
    s = pick(s, "TST-UNIT-0:u4");
    s = pick(s, "TST-UNIT-0:u1");
    s = settle(drain(s, "player1"));
    const deck = zoneIds(s, "player1", "deck");
    expect(deck.indexOf("TST-UNIT-0:u4")).toBeLessThan(deck.indexOf("TST-UNIT-0:u1"));
  });

  // faq-card-3 RS-137 Q1「はい、公開しなければなりません。」
  it.todo(
    "RS-137: 公式Q&A — 山札に戻す順番は相手にも公開する（出典: grnrngr/faq-card-3 RS-137 Q1）— エンジンは非公開情報（相手から見えるか）を持たず、公開の有無を観測できない",
  );
});

// ===========================================================================
describe("RS-138 イエローライオン", () => {
  const TEXT = "【ジェットスケボー】「SP1」自分がターンを終えるとき、このユニットがバトルエリアにあればラッシュエリアに戻してもよい。";

  /** 自軍バトルフェイズにイエローライオンを n+1 番目に出し、エンドフェイズに進む。 */
  function toEnd(n: number): GameState {
    let s = st({ player1: { battle: fillers(n), rush: [inst("RS-138", "yl")] } });
    s = passEntry(enter(s, "RS-138:yl"));
    s = act(s, legal(s).find((a) => a.type === "end_phase")!);
    return s;
  }

  function endMenuOffers(s: GameState): boolean {
    return (s.pendingEffectChoice?.validInstanceIds ?? []).includes("RS-138:yl");
  }

  it("RS-138: カタログ本文・スペックが出典と一致（出典: atwiki/page-357）", () => {
    expectCatalogText("RS-138", TEXT);
    expectStats("RS-138", {
      name: "イエローライオン",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 4,
      comboNumber: 5,
      features: ["イエロー", "男"],
    });
  });

  it("RS-138: 5番目に出ると「SP1」になりストライクできる（出典: atwiki/page-357「CN：5」）", () => {
    let s = st({ player1: { battle: fillers(4), rush: [inst("RS-138", "yl")] } });
    s = enter(s, "RS-138:yl");
    expect(canStrike(s, "RS-138:yl")).toBe(true);
  });

  it("RS-138: NC 成立時、ターンを終えるときバトルエリアにあればラッシュエリアに戻せる（出典: atwiki/page-357）", () => {
    let s = toEnd(4);
    expect(endMenuOffers(s)).toBe(true);
    s = pick(s, "RS-138:yl");
    s = drain(s, "player1", ["RS-138:yl"]);
    expect(zoneOf(s, "player1", "RS-138:yl")).toBe("rush");
  });

  it("RS-138: 戻さないことを選べる（任意）（出典: atwiki/page-357「戻してもよい」）", () => {
    let s = toEnd(4);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-138:yl")).toBe("battle");
  });

  it("RS-138: 5番目以外で出たとき（NC 不成立）は戻せない（出典: atwiki/page-357「CN：5」・R-CN-02）", () => {
    const s = toEnd(1);
    expect(endMenuOffers(s)).toBe(false);
  });
});

// ===========================================================================
describe("RS-139 ブルードルフィン", () => {
  const TEXT = "【ドルフィンアロー】敵軍コマンドゾーンからホールド状態のカードを1枚選んで、持ち主のパワーゾーンに送ってもよい。";

  function dolphin(n: number, p2: Record<string, unknown> = {}): GameState {
    let s = st({
      player1: { battle: fillers(n), rush: [inst("RS-139", "bd")] },
      player2: { command: [held("TST-OP", "h1"), released("TST-OP", "r1")], ...p2 },
    });
    s = enter(s, "RS-139:bd");
    return s;
  }

  it("RS-139: カタログ本文・スペックが出典と一致（出典: atwiki/page-358）", () => {
    expectCatalogText("RS-139", TEXT);
    expectStats("RS-139", {
      name: "ブルードルフィン",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 2,
      features: ["ブルー", "女"],
    });
  });

  it("RS-139: 2番目に出ると、敵軍コマンドゾーンのホールド状態のカードを1枚選んで持ち主のパワーゾーンに送る（リリース状態は対象外）（出典: atwiki/page-358）", () => {
    let s = dolphin(1);
    expect(choiceIds(s)).toEqual(["TST-OP:h1"]);
    s = pick(s, "TST-OP:h1");
    expect(zoneOf(s, "player2", "TST-OP:h1")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP:h1")?.faceDown).toBeFalsy();
  });

  it("RS-139: 送らないことを選べる（任意）（出典: atwiki/page-358「送ってもよい」）", () => {
    let s = dolphin(1);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "TST-OP:h1")).toBe("command");
  });

  it("RS-139: 2番目以外では発動しない（出典: atwiki/page-358「CN：2」）", () => {
    const s = dolphin(0);
    expect(s.pendingEffectChoice).toBeFalsy();
  });
});

// ===========================================================================
describe("RS-140 コロン", () => {
  const TEXT = "※これは自軍ターン中、バトルエリアに出られない。【データ解析】このユニットが場にある間、敵軍Sユニットのコンビネーションナンバーは1増える。";

  it("RS-140: カタログ本文・スペックが出典と一致（出典: atwiki/page-313）", () => {
    expectCatalogText("RS-140", TEXT);
    expectStats("RS-140", {
      name: "コロン",
      category: "ET",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 2,
      features: ["メカ", "人型"],
    });
  });

  it("RS-140: ※自軍ターン中はバトルエリアに出られない（出典: atwiki/page-313）", () => {
    const s = st({ player1: { rush: [inst("RS-140", "c")] } });
    expect(canEnter(s, "RS-140:c")).toBe(false);
  });

  it("RS-140: ※敵軍ターン中なら（相手の紐男爵で）バトルエリアに出される（出典: atwiki/page-313「自軍ターン中」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("TST-UNIT-0", "mine")], rush: [inst("RS-140", "c")] },
      // 場のコロン【データ解析】で敵軍（player2）の紐男爵の CN は 3+1=4 になるため、4番目に出して【紐拳】の NC を成立させる（R-CN-02）
      player2: { battle: fillers(3, "ef"), rush: [inst("RS-141", "himo")] },
    });
    s = enter(s, "RS-141:himo", "player2");
    s = pick(s, "TST-UNIT-0:mine");
    s = drain(s, "player2", ["RS-140:c"]);
    expect(zoneOf(s, "player1", "RS-140:c")).toBe("battle");
  });

  it("RS-140: 敵軍ラッシュエリアにコロンがあると、自軍 S ユニットの CN が1増える（CN2 のブルードルフィンは3番目で発動、2番目では発動しない）（出典: atwiki/page-313）", () => {
    const mk = (n: number) =>
      enter(
        st({
          player1: { battle: fillers(n), rush: [inst("RS-139", "bd")] },
          player2: { rush: [inst("RS-140", "c")], command: [held("TST-OP", "h1")] },
        }),
        "RS-139:bd",
      );
    expect(mk(1).pendingEffectChoice).toBeFalsy();
    expect(choiceIds(mk(2))).toEqual(["TST-OP:h1"]);
  });

  it("RS-140: バトルエリアにあるコロンも有効（「場にある間」）（出典: atwiki/page-313）", () => {
    const s = enter(
      st({
        player1: { battle: fillers(1), rush: [inst("RS-139", "bd")] },
        player2: { battle: [inst("RS-140", "c")], command: [held("TST-OP", "h1")] },
      }),
      "RS-139:bd",
    );
    expect(s.pendingEffectChoice).toBeFalsy();
  });

  it("RS-140: 自軍のコロンは自軍 S ユニットの CN を変えない（出典: atwiki/page-313「敵軍Sユニット」）", () => {
    const s = enter(
      st({
        player1: { battle: fillers(1), rush: [inst("RS-139", "bd"), inst("RS-140", "c")] },
        player2: { command: [held("TST-OP", "h1")] },
      }),
      "RS-139:bd",
    );
    expect(choiceIds(s)).toEqual(["TST-OP:h1"]);
  });

  it("RS-140: 2体あれば重複して2増える（出典: atwiki/page-313 コメント「重複します」）", () => {
    const s = enter(
      st({
        player1: { battle: fillers(3), rush: [inst("RS-139", "bd")] },
        player2: { rush: [inst("RS-140", "c1"), inst("RS-140", "c2")], command: [held("TST-OP", "h1")] },
      }),
      "RS-139:bd",
    );
    expect(choiceIds(s)).toEqual(["TST-OP:h1"]);
  });

  // faq-card-3 RS-140 Q1「「弾幕タンクコマンドミサイル」の効果で参照するのは、「カードに表記された本来のナンバー」だけです」
  it("RS-140: 公式Q&A — タンクコマンドはコロンで変わったナンバーではなく本来のナンバーを参照する（出典: grnrngr/faq-card-3 RS-140 Q1）", () => {
    // 自軍ブルードルフィン（本来 CN2、コロンで CN3）を3番目に出す。相手のタンクコマンド＋リリース状態のコマンドに CN2 のユニットカード → NC は発動できない
    const s = enter(
      st({
        player1: { battle: fillers(2), rush: [inst("RS-139", "bd")] },
        player2: {
          rush: [inst("RS-140", "c"), inst("RS-263", "tank")],
          command: [released("RS-139", "cn2"), held("TST-OP", "h1")],
        },
      }),
      "RS-139:bd",
    );
    expect(s.pendingEffectChoice).toBeFalsy();
  });

  // faq-card-3 RS-140 Q2「２枚の敵軍コマンドをリリースすれば「ジュウクンドー」の効果を発動することができます」
  it("RS-140: 公式Q&A — コロンで CN2 になったデカレッドがタイムピンクからコンビネーションしたら、敵軍コマンドを2枚リリースしてジュウクンドーを発動できる（出典: grnrngr/faq-card-3 RS-140 Q2）", () => {
    // コロンでタイムピンク（CN4）も CN5 になるので5番目、デカレッド（CN1→2）は6番目に出す
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-222", "tp"), inst("RS-106", "deka")] },
      player2: {
        rush: [inst("RS-140", "c"), inst("TST-UNIT-0", "r")],
        battle: [inst("TST-UNIT-0", "b")],
        command: [held("TST-OP", "h1"), held("TST-OP", "h2")],
      },
    });
    s = passEntry(enter(s, "RS-222:tp"));
    s = enter(s, "RS-106:deka");
    expect(legal(s).some((a) => a.type === "use_juu_kun_do")).toBe(true);
  });

  // faq-card-3 RS-140 Q3「コンビネーションナンバーに関わらず効果を得ることができます」
  it("RS-140: 公式Q&A — ゴレンジャーストームの「5番目のユニット」はコロンの影響を受けない（出典: grnrngr/faq-card-3 RS-140 Q3）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-001", "op")], power: powerCards(8), command: [released("TST-OP-ET", "c1")], rush: fillers(5, "u") },
      player2: { rush: [inst("RS-140", "c")] },
    });
    s = useCard(s, "player1", "RS-001:op");
    s = act(s, legal(s).find((a) => a.type === "end_phase")!);
    for (let i = 0; i < 5; i++) s = passEntry(enter(s, `TST-UNIT-0:u${i}`));
    expect(bpOf(s, "player1", "TST-UNIT-0:u4")).toBe(12000);
  });

  // faq-card-4（RS-209 の項）「いいえ、ＳＰ１のままです。」
  it("RS-140: 公式Q&A — ホウオウレンジャーの効果で相手がコロンを手札に戻しても、一度得た SP1 は失わない（出典: grnrngr/faq-card-4 RS-209）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-209", "hou"), inst("TST-UNIT-0", "back")] },
      player2: { rush: [inst("RS-140", "c")], battle: [inst("TST-UNIT-0", "es")] },
    });
    s = enter(s, "RS-209:hou");
    s = drain(s, "player1", ["TST-UNIT-0:back"]);
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = drain(s, "player2", ["RS-140:c"]);
    expect(zoneOf(s, "player2", "RS-140:c")).toBe("hand");
    expect(canStrike(s, "RS-209:hou")).toBe(true);
  });

  // faq-card-6（RS-407 の項）「いいえ。「天空大聖者マジエル」の効果は、「コロン」の有無に関わらずそのテキスト通りに制限を与えます。」
  it("RS-140: 公式Q&A — マジエルの並び順の制限はコロンで変わらない（CN2→3 の WB ユニットは3番目で SP1 でもストライクできない）（出典: grnrngr/faq-card-6 RS-407）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-054", "aba")] },
      player2: { rush: [inst("RS-140", "c"), inst("RS-407", "maj")] },
    });
    s = enter(s, "RS-054:aba");
    expect(ncLogged(s, "RS-054")).toBe(true);
    expect(canStrike(s, "RS-054:aba")).toBe(false);
  });
});

// ===========================================================================
describe("RS-141 紐男爵", () => {
  const TEXT =
    "【紐拳】敵軍バトルエリアからユニットを1体選んで、ラッシュエリアに戻してもよい。そうしたとき、敵軍ラッシュエリアのユニットを1体選んで、可能ならバトルエリアに出す。";
  const E2 = sUnit("SPEC-E2", { bp: 2000 });
  const E9 = sUnit("SPEC-E9", { bp: 9000 });

  function himo(n = 2, p2: Record<string, unknown> = {}): GameState {
    let s = st(
      {
        player1: { battle: fillers(n), rush: [inst("RS-141", "himo")] },
        player2: { battle: [inst("SPEC-E9", "big")], rush: [inst("SPEC-E2", "small")], ...p2 },
      },
      [E2, E9],
    );
    s = enter(s, "RS-141:himo");
    return s;
  }

  it("RS-141: カタログ本文・スペックが出典と一致（出典: atwiki/page-336）", () => {
    expectCatalogText("RS-141", TEXT);
    expectStats("RS-141", {
      name: "紐男爵",
      category: "DA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 3,
      features: ["怪人", "男"],
    });
  });

  it("RS-141: 3番目に出ると、敵軍バトルエリアのユニットをラッシュエリアに戻し、敵軍ラッシュエリアのユニットを1体バトルエリアに出す（出典: atwiki/page-336）", () => {
    let s = himo();
    expect(choiceIds(s)).toEqual(["SPEC-E9:big"]);
    s = pick(s, "SPEC-E9:big");
    expect(zoneOf(s, "player2", "SPEC-E9:big")).toBe("rush");
    s = settle(drain(s, "player1", ["SPEC-E2:small"]));
    expect(zoneOf(s, "player2", "SPEC-E2:small")).toBe("battle");
    // 入れ替えた BP2000 のユニットにアタックできる
    expect(attackTargets(s, "RS-141:himo")).toContain("SPEC-E2:small");
  });

  it("RS-141: 戻したときは、敵軍ラッシュエリアのユニットを出す処理は強制（見送れない）（出典: atwiki/page-336「可能ならバトルエリアに出す」）", () => {
    const s = pick(himo(), "SPEC-E9:big");
    expect(s.pendingEffectChoice?.effectId).toBe("string_fist");
    expect(canSkip(s)).toBe(false);
  });

  it("RS-141: 戻さないことを選べる（任意）— そのときは出す処理も行わない（出典: atwiki/page-336「戻してもよい。そうしたとき」）", () => {
    let s = himo();
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "SPEC-E9:big")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E2:small")).toBe("rush");
  });

  it("RS-141: 3番目以外では発動しない（出典: atwiki/page-336「CN：3」）", () => {
    const s = himo(0);
    expect(s.pendingEffectChoice).toBeFalsy();
  });

  // faq-card-3 RS-141 Q1（RS-135 Q4 と同文）
  it("RS-141: 公式Q&A — ジェットファルコンを戻して【ファルコンクロー】で自軍ユニットが出されたら、紐男爵はアタックできなくなる（出典: grnrngr/faq-card-3 RS-141 Q1）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-141", "himo"), inst("TST-UNIT-0", "mine")] },
      player2: { battle: [inst("RS-135", "jf")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(5, "ed") },
    });
    s = enter(s, "RS-141:himo");
    s = pick(s, "RS-135:jf");
    s = drain(s, "player2", ["TST-UNIT-0:mine"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:mine")).toBe("battle");
    // 出された自軍ユニット（SP1）はストライクでき、紐男爵はアタックできない
    s = drain(s, "player1", ["TST-UNIT-0:er"]);
    expect(canStrike(s, "TST-UNIT-0:mine")).toBe(true);
    expect(attackTargets(s, "RS-141:himo")).toEqual([]);
  });

  // faq-card-3 RS-141 Q2「はい、できます。」
  it("RS-141: 公式Q&A — 戻したユニットをもう一度選んでバトルエリアに出せる（出典: grnrngr/faq-card-3 RS-141 Q2）", () => {
    let s = pick(himo(), "SPEC-E9:big");
    expect(choiceIds(s)).toContain("SPEC-E9:big");
    s = settle(pick(s, "SPEC-E9:big"));
    expect(zoneOf(s, "player2", "SPEC-E9:big")).toBe("battle");
  });

  // faq-card-3 RS-141 Q3「置き換えません。…新たに右端に置いてください。」
  it("RS-141: 公式Q&A — 出したユニットは戻したユニットの位置ではなく右端に置く（出典: grnrngr/faq-card-3 RS-141 Q3）", () => {
    let s = himo(2, { battle: [inst("SPEC-E9", "big"), inst("TST-UNIT-0", "right")] });
    s = pick(s, "SPEC-E9:big");
    s = settle(pick(s, "SPEC-E2:small"));
    expect(zoneIds(s, "player2", "battle")).toEqual(["TST-UNIT-0:right", "SPEC-E2:small"]);
  });

  // faq-card-3 RS-141 Q4「「RS-141 紐男爵」より後にユニットを並べることが一切できなくなります。」
  it("RS-141: 公式Q&A — 相手のポリスファイターを出したら、サイズの違うユニットが既に並んでいる自分はそれ以降ユニットを出せない（出典: grnrngr/faq-card-3 RS-141 Q4）", () => {
    let s = st(
      {
        player1: { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-2", "m")], rush: [inst("RS-141", "himo"), inst("TST-UNIT-0", "next")] },
        player2: { battle: [inst("SPEC-E9", "big")], rush: [inst("RS-086", "pf")] },
      },
      [E9],
    );
    s = enter(s, "RS-141:himo");
    s = pick(s, "SPEC-E9:big");
    s = settle(pick(s, "RS-086:pf"));
    expect(zoneOf(s, "player2", "RS-086:pf")).toBe("battle");
    s = passEntry(s);
    expect(canEnter(s, "TST-UNIT-0:next")).toBe(false);
  });

  // faq-card-6（RS-417 の項）「はい、できます。」
  it("RS-141: 公式Q&A — 戻したユニットを冥府神サイクロプスで撃破しても、ラッシュエリアの敵軍ユニットをバトルエリアに出せる（出典: grnrngr/faq-card-6 RS-417）", () => {
    let s = st(
      {
        player1: { battle: fillers(2), rush: [inst("RS-141", "himo"), inst("RS-417", "cy")], operation: [inst("RS-124", "res")] },
        player2: { battle: [inst("SPEC-E2", "small")], rush: [inst("SPEC-E9", "big")] },
      },
      [E2, E9],
    );
    s = enter(s, "RS-141:himo");
    s = pick(s, "SPEC-E2:small");
    s = drain(s, "player1", ["RS-124:res", "SPEC-E9:big"]);
    s = settle(drain(s, "player1", ["SPEC-E9:big"]));
    expect(zoneOf(s, "player2", "SPEC-E2:small")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E9:big")).toBe("battle");
  });
});
