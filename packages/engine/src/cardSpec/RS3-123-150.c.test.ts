/**
 * カード別スペック: RS-142〜RS-150（第3弾「三界の獅子」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-3
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_3.html）と card_7 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当なし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-CN-04 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  choiceIds,
  damageCards,
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
  zoneOf,
} from "./RS3-123-150.helpers";
import type { GameState, PlayerId } from "../types/game";

function passEntry(s: GameState, playerId: PlayerId = "player1"): GameState {
  const pass = legal(s).find((a) => a.type === "pass_battle_entry" && a.playerId === playerId);
  return pass ? act(s, pass) : s;
}

/** 相手（player2）のターンに、相手の紐男爵（3番目）で自軍ユニット mine を戻し、自軍ラッシュエリアの target を出させる。 */
function pulledByEnemyHimo(p1: Record<string, unknown>, target: string): GameState {
  let s = st({
    activePlayer: "player2",
    player1: { battle: [inst("TST-UNIT-0", "mine")], ...p1 },
    player2: { battle: fillers(2, "ef"), rush: [inst("RS-141", "himo")], deck: deckCards(5, "ed") },
  });
  s = enter(s, "RS-141:himo", "player2");
  s = pick(s, "TST-UNIT-0:mine");
  return settle(drain(s, "player2", [target]));
}

// ===========================================================================
describe("RS-142 オーレンジャーロボ", () => {
  const TEXT =
    "合体―スカイフェニックス＋グランタウラス＋ダッシュレオン＋ドグランダー＋モアローダー【クラウンファイナルクラッシュ】これがバトルエリアに出たとき、自軍コマンドをすべてリリース状態に戻してもよい。";

  function robo(): GameState {
    let s = st({
      player1: { rush: [inst("RS-142", "or")], command: [held("TST-OP-MA", "h1"), held("TST-OP-MA", "h2"), released("TST-OP", "r")] },
      player2: { deck: deckCards(5, "ed") },
    });
    s = enter(s, "RS-142:or");
    return s;
  }

  it("RS-142: カタログ本文・スペックが出典と一致（出典: atwiki/page-368）", () => {
    expectCatalogText("RS-142", TEXT);
    expectStats("RS-142", {
      name: "オーレンジャーロボ",
      category: "MA",
      size: "L",
      bp: 19000,
      sp: 2,
      powerCost: "6+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-142: 合体ユニット5体を捨札にしてラッシュする（出典: atwiki/page-368）", () => {
    const mats = ["RS-143:a", "RS-144:b", "RS-145:c", "RS-146:d", "RS-147:e"];
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-142", "or")],
        rush: mats.map((m) => inst(m.split(":")[0]!, m.split(":")[1]!)),
        command: [released("TST-OP-MA", "ma")],
        power: powerCards(6),
      },
    });
    const r = rushFromHand(s, "player1", "RS-142:or", { materials: mats });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-142:or")).toBe("rush");
    for (const m of mats) expect(zoneOf(r.state, "player1", m)).toBe("discard");
  });

  it("RS-142: バトルエリアに出たとき、自軍コマンドをすべてリリース状態に戻す（出典: atwiki/page-368）", () => {
    let s = robo();
    if (s.pendingEffectChoice?.effectId === "crown_final_crush") s = drain(s, "player1");
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it.fails("RS-142: リリースしないことを選べる（任意）（出典: atwiki/page-368「戻してもよい」）", () => {
    // 既知の不具合: CARD-RS-142 【クラウンファイナルクラッシュ】を強制で処理し、リリースしない選択肢がない
    let s = robo();
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("RS-142: SP2 でストライクすると2点（出典: atwiki/page-368「SP：2」）", () => {
    let s = robo();
    if (s.pendingEffectChoice) s = drain(s, "player1");
    expect(canStrike(s, "RS-142:or")).toBe(true);
    s = settle(act(s, { type: "strike", playerId: "player1", instanceId: "RS-142:or" }));
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-143 スカイフェニックス", () => {
  it("RS-143: カタログ本文（テキストなし）・スペックが出典と一致（出典: atwiki/page-367「テキスト：なし」）", () => {
    expectCatalogText("RS-143", "");
    expectStats("RS-143", {
      name: "スカイフェニックス",
      category: "MA",
      size: "M",
      bp: 4000,
      sp: 1,
      powerCost: "5+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-143: 追加条件（自軍 S ユニットを1体捨札にする）を満たしてラッシュする（出典: atwiki/page-367）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-143", "sf")], rush: [inst("TST-UNIT-0", "m")], command: [released("TST-OP-MA", "ma")], power: powerCards(5) },
    });
    const r = rushFromHand(s, "player1", "RS-143:sf", { materials: ["TST-UNIT-0:m"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-143:sf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:m")).toBe("discard");
  });

  it("RS-143: SP1 なので、バトルエリアに出てストライクできる（出典: atwiki/page-367「SP：1」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-143", "sf")] } }), "RS-143:sf");
    expect(canStrike(s, "RS-143:sf")).toBe(true);
  });
});

// ===========================================================================
describe("RS-144 グランタウラス", () => {
  const TEXT = "【タウラスダイブ】これをラッシュしたとき、「SP1」以上または「SP！」のある敵軍Sユニットを、すべて持ち主の手札に戻す。";
  const SP0 = sUnit("SPEC-SP0", { sp: undefined });
  const SPBANG = sUnit("SPEC-BANG", { sp: "special" as never });
  const MSP = sUnit("SPEC-MSP", { size: "M", sp: 1 });
  const F13 = sUnit("SPEC-F13", { sp: "1/3" as never });

  function taurus(p2: Record<string, unknown>, extra = [SP0, SPBANG, MSP, F13]): GameState {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-144", "gt")], rush: [inst("TST-UNIT-0", "m")], command: [released("TST-OP-MA", "ma")], power: powerCards(5) },
        player2: p2,
      },
      extra,
    );
    return settle(rushFromHand(s, "player1", "RS-144:gt", { materials: ["TST-UNIT-0:m"] }).state);
  }

  it("RS-144: カタログ本文・スペックが出典と一致（出典: atwiki/page-369）", () => {
    expectCatalogText("RS-144", TEXT);
    expectStats("RS-144", {
      name: "グランタウラス",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-144: 敵軍バトルエリアの SP1 以上・「SP！」の S ユニットをすべて持ち主の手札に戻す（SP なし・M ユニットは残る）（出典: atwiki/page-369）", () => {
    const s = taurus({ battle: [inst("TST-UNIT-0", "sp1"), inst("SPEC-BANG", "bang"), inst("SPEC-SP0", "sp0"), inst("SPEC-MSP", "msp")] });
    expect(zoneOf(s, "player2", "TST-UNIT-0:sp1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-BANG:bang")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-SP0:sp0")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-MSP:msp")).toBe("battle");
  });

  it.fails("RS-144: 敵軍ラッシュエリアの「SP1」「SP！」の S ユニットも戻す（出典: atwiki/page-369「敵軍Sユニット」・faq-card-3 RS-144 Q1「分数表記のユニットはラッシュエリアにある間は…」）", () => {
    // 既知の不具合: CARD-RS-144 【タウラスダイブ】の対象を敵軍バトルエリアのユニットに限り、ラッシュエリアの SP1・SP！ の S ユニットを戻さない
    const s = taurus({ rush: [inst("TST-UNIT-0", "sp1"), inst("SPEC-BANG", "bang")] });
    expect(zoneOf(s, "player2", "TST-UNIT-0:sp1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-BANG:bang")).toBe("hand");
  });

  // faq-card-3 RS-144 Q1「ＳＰを得る並び順にある場合（１/３のユニットが３番目に並んでいる状態など）は、ＳＰ１になっているので手札に戻させることができます」
  it("RS-144: 公式Q&A — バトルエリアで SP を得る並び順にある分数表記のユニットは戻す（出典: grnrngr/faq-card-3 RS-144 Q1）", () => {
    const s = taurus({ battle: [inst("SPEC-SP0", "a"), inst("SPEC-SP0", "b"), inst("SPEC-F13", "f")] });
    expect(zoneOf(s, "player2", "SPEC-F13:f")).toBe("hand");
  });

  it("RS-144: 公式Q&A — SP を得る並び順にない分数表記のユニット・ラッシュエリアの分数表記のユニットは戻さない（出典: grnrngr/faq-card-3 RS-144 Q1）", () => {
    const s = taurus({ battle: [inst("SPEC-F13", "f1")], rush: [inst("SPEC-F13", "f2")] });
    expect(zoneOf(s, "player2", "SPEC-F13:f1")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-F13:f2")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-145 ダッシュレオン", () => {
  const TEXT = "【超文明の守護】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドをすべてリリース状態に戻す。";

  it("RS-145: カタログ本文・スペックが出典と一致（出典: atwiki/page-312）", () => {
    expectCatalogText("RS-145", TEXT);
    expectStats("RS-145", {
      name: "ダッシュレオン",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-145: 追加条件（自軍 S ユニットを1体捨札にする）を満たしてラッシュする（出典: atwiki/page-312）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-145", "dl")], rush: [inst("TST-UNIT-0", "m")], command: [released("TST-OP-MA", "ma")], power: powerCards(3) },
    });
    const r = rushFromHand(s, "player1", "RS-145:dl", { materials: ["TST-UNIT-0:m"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:m")).toBe("discard");
  });

  it("RS-145: 自軍ターン中にバトルエリアに出たとき、自軍コマンドをすべてリリース状態に戻す（出典: atwiki/page-312）", () => {
    let s = st({ player1: { rush: [inst("RS-145", "dl")], command: [held("TST-OP", "h1"), held("TST-OP", "h2")] } });
    s = enter(s, "RS-145:dl");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it("RS-145: 敵軍ターン中に（相手の紐男爵で）出されたときはリリースしない（出典: atwiki/page-312「自軍ターン中」）", () => {
    const s = pulledByEnemyHimo({ rush: [inst("RS-145", "dl")], command: [held("TST-OP", "h1")] }, "RS-145:dl");
    expect(zoneOf(s, "player1", "RS-145:dl")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // faq-card-7（RS-440 の項）「はい、できます。」
  it.todo(
    "RS-145: 公式Q&A — バトルフィーバーロボの【武器換装】で戻した後、ダッシュレオンでコマンドをリリースすれば、再び出して【武器換装】を使える（出典: grnrngr/faq-card-7 RS-440）— RS-440【武器換装】（自軍コマンドを3つホールドしてラッシュエリアに戻す）の起動アクションを公開 API で特定できず、RS-440 側の仕様テストの範囲",
  );
});

// ===========================================================================
describe("RS-146 ドグランダー", () => {
  const TEXT = "※自軍ターン中、これは「グランタウラス」からコンビネーションしなければバトルエリアに出られない。";

  it("RS-146: カタログ本文・スペックが出典と一致（出典: atwiki/page-370）", () => {
    expectCatalogText("RS-146", TEXT);
    expectStats("RS-146", {
      name: "ドグランダー",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: 1,
      powerCost: "3+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-146: ※自軍ターン中、グランタウラスの直後でなければバトルエリアに出られない（出典: atwiki/page-370）", () => {
    const s = st({ player1: { battle: fillers(1), rush: [inst("RS-146", "dg")] } });
    expect(canEnter(s, "RS-146:dg")).toBe(false);
  });

  it("RS-146: グランタウラスからコンビネーションすれば出られ、SP1 でストライクできる（出典: atwiki/page-370）", () => {
    let s = st({ player1: { rush: [inst("RS-144", "gt"), inst("RS-146", "dg")] } });
    s = passEntry(enter(s, "RS-144:gt"));
    expect(canEnter(s, "RS-146:dg")).toBe(true);
    s = enter(s, "RS-146:dg");
    expect(canStrike(s, "RS-146:dg")).toBe(true);
  });

  it("RS-146: バトルエリアにグランタウラスがいても、直前（左隣）でなければ出られない（出典: atwiki/page-370「コンビネーションしなければ」・R-CN-05）", () => {
    const s = st({ player1: { battle: [inst("RS-144", "gt"), inst("TST-UNIT-0", "f")], rush: [inst("RS-146", "dg")] } });
    expect(canEnter(s, "RS-146:dg")).toBe(false);
  });

  it("RS-146: 敵軍ターン中は制限を受けない（相手の紐男爵で出される）（出典: atwiki/page-370「自軍ターン中」）", () => {
    const s = pulledByEnemyHimo({ rush: [inst("RS-146", "dg")] }, "RS-146:dg");
    expect(zoneOf(s, "player1", "RS-146:dg")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-147 モアローダー", () => {
  const TEXT =
    "※これは「ダッシュレオン」からコンビネーションしなければバトルエリアに出られない。【超力モアキャノン】これが自軍ラッシュエリアにあるとき、「モアローダー」以外の「MA」の自軍Mユニットは、敵軍ターン中、BP+1000される。";
  const MAS = sUnit("SPEC-MAS", { category: "MA", bp: 2000 });
  const ETM = sUnit("SPEC-ETM", { category: "ET", size: "M", bp: 5000 });
  const ATK = sUnit("SPEC-ATK", { bp: 5500, size: "M" });

  it("RS-147: カタログ本文・スペックが出典と一致（出典: atwiki/page-371）", () => {
    expectCatalogText("RS-147", TEXT);
    expectStats("RS-147", {
      name: "モアローダー",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-147: ※ダッシュレオンの直後でなければバトルエリアに出られない（出典: atwiki/page-371）", () => {
    const s = st({ player1: { battle: fillers(1), rush: [inst("RS-147", "moa")] } });
    expect(canEnter(s, "RS-147:moa")).toBe(false);
  });

  it("RS-147: ダッシュレオンからコンビネーションすれば出られる（出典: atwiki/page-371）", () => {
    let s = st({ player1: { rush: [inst("RS-145", "dl"), inst("RS-147", "moa")] } });
    s = passEntry(enter(s, "RS-145:dl"));
    s = enter(s, "RS-147:moa");
    expect(zoneOf(s, "player1", "RS-147:moa")).toBe("battle");
  });

  it("RS-147: ※敵軍ターン中でも制限を受ける（相手の紐男爵で選ばれても出られない）（出典: atwiki/page-371・faq-card-3 RS-147 Q1）", () => {
    const s = pulledByEnemyHimo({ rush: [inst("RS-147", "moa")] }, "RS-147:moa");
    expect(zoneOf(s, "player1", "RS-147:moa")).toBe("rush");
  });

  function moaState(activePlayer: PlayerId): GameState {
    return st(
      {
        activePlayer,
        player1: {
          battle: [inst("RS-145", "dl"), inst("SPEC-MAS", "mas"), inst("SPEC-ETM", "etm")],
          rush: [inst("RS-147", "moa"), inst("RS-147", "moa2")],
        },
      },
      [MAS, ETM, ATK],
    );
  }

  it("RS-147: 自軍ラッシュエリアにあるとき、敵軍ターン中は MA の自軍 M ユニットが BP+1000（MA の S・他カテゴリの M・モアローダー自身は対象外）（出典: atwiki/page-371）", () => {
    const s = moaState("player2");
    expect(bpOf(s, "player1", "RS-145:dl")).toBe(6000);
    expect(bpOf(s, "player1", "SPEC-MAS:mas")).toBe(2000);
    expect(bpOf(s, "player1", "SPEC-ETM:etm")).toBe(5000);
    expect(bpOf(s, "player1", "RS-147:moa")).toBe(5000);
  });

  it("RS-147: 自軍ターン中は BP+1000 されない（出典: atwiki/page-371「敵軍ターン中」）", () => {
    expect(bpOf(moaState("player1"), "player1", "RS-145:dl")).toBe(5000);
  });

  it("RS-147: 敵軍ターン中のバトルで BP+1000 が効く（BP5500 のアタックに BP6000 で勝つ）（出典: atwiki/page-371）", () => {
    let s = moaState("player2");
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, battle: [inst("SPEC-ATK", "atk")] } } };
    s = settle(attack(s, "SPEC-ATK:atk", "RS-145:dl", "player2"));
    expect(zoneOf(s, "player1", "RS-145:dl")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ATK:atk")).toBe("discard");
  });

  it("RS-147: モアローダーがバトルエリアにあるとき（ラッシュエリアにないとき）は BP+1000 されない（出典: atwiki/page-371「自軍ラッシュエリアにあるとき」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("RS-145", "dl"), inst("RS-147", "moa")] } });
    expect(bpOf(s, "player1", "RS-145:dl")).toBe(5000);
  });

  // faq-card-3 RS-147 Q1（RS-135 Q5 と同文）
  it("RS-147: 公式Q&A — 相手のジェットファルコンで引き出されるには、ダッシュレオンからコンビネーションする必要がある（出典: grnrngr/faq-card-3 RS-147 Q1）", () => {
    let s = st({
      phase: "start",
      player2: { battle: [inst("RS-135", "jf")], deck: deckCards(5, "ed") },
      activePlayer: "player2",
      player1: { rush: [inst("RS-147", "moa")] },
    });
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player2" });
    if (s.pendingEffectChoice) {
      const r = legal(s).find((a) => a.type === "resolve_effect_choice" && (a as { instanceId: string }).instanceId === "RS-147:moa");
      if (r) {
        const t = tryAct(s, r);
        if (t.ok) s = t.state;
      }
    }
    expect(zoneOf(s, "player1", "RS-147:moa")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-148 オーレッド", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。【スターライザー】自軍ターン中、これはリリース状態の自軍コマンド1つにつきBP+2000される。（この効果は特徴「航空機」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";
  const AIR = sUnit("SPEC-AIR", { features: ["航空機"], sp: undefined });

  function oRed(battle: ReturnType<typeof inst>[], cmd = releasedN(3, "TST-OP", "rc"), extra = [AIR]): GameState {
    let s = st({ player1: { battle, rush: [inst("RS-148", "or")], command: [...cmd, held("TST-OP", "h")] } }, extra);
    s = enter(s, "RS-148:or");
    return s;
  }

  it("RS-148: カタログ本文・スペックが出典と一致（出典: atwiki/page-372）", () => {
    expectCatalogText("RS-148", TEXT);
    expectStats("RS-148", {
      name: "オーレッド",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 5,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  it("RS-148: ※ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-372）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-148", "or")], battle: fillers(4), command: [released("TST-OP-MA", "ma")], power: powerCards(5) },
    });
    s = rushFromHand(s, "player1", "RS-148:or").state;
    s = act(s, legal(s).find((a) => a.type === "end_phase")!);
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RS-148:or")).toBe(false);
  });

  it("RS-148: 5番目に出ると、自軍ターン中はリリース状態の自軍コマンド1つにつき BP+2000（3つで BP9000）（出典: atwiki/page-372）", () => {
    const s = oRed(fillers(4));
    expect(ncLogged(s, "RS-148")).toBe(true);
    expect(bpOf(s, "player1", "RS-148:or")).toBe(9000);
  });

  it("RS-148: 特徴「航空機」を持つユニットからコンビネーションすれば、5番目でなくても発動する（出典: atwiki/page-372「ナンバーに関係なく発動する」）", () => {
    const s = oRed([inst("SPEC-AIR", "air")]);
    expect(bpOf(s, "player1", "RS-148:or")).toBe(9000);
  });

  it("RS-148: NC 不成立（5番目以外で、航空機からでもない）なら BP は増えない（出典: atwiki/page-372「CN：5」・R-CN-02）", () => {
    const s = oRed(fillers(1));
    expect(bpOf(s, "player1", "RS-148:or")).toBe(3000);
  });

  it("RS-148: 敵軍ターン中は BP+2000 されない（出典: atwiki/page-372「自軍ターン中」）", () => {
    let s = oRed(fillers(4));
    s = { ...s, activePlayer: "player2" };
    expect(bpOf(s, "player1", "RS-148:or")).toBe(3000);
  });
});

// ===========================================================================
describe("RS-149 イエローレーサー", () => {
  const TEXT = "【サイドナックル】「SP1」これがストライクして、相手がパワーゾーンのカードをウラ返すとき、ウラ返しにするカードは自分が選ぶ。";

  function strikeWith(n: number, enemyPower = powerCards(3, "ep")): GameState {
    let s = st({
      player1: { battle: fillers(n), rush: [inst("RS-149", "yr")] },
      player2: { power: enemyPower, deck: deckCards(5, "ed") },
    });
    s = enter(s, "RS-149:yr");
    if (!canStrike(s, "RS-149:yr")) return s;
    s = act(s, { type: "strike", playerId: "player1", instanceId: "RS-149:yr" });
    for (let i = 0; i < 4 && !s.pendingDamagePayment; i++) {
      const pass = legal(s).find((a) => a.type === "pass_strike_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    return s;
  }

  it("RS-149: カタログ本文・スペックが出典と一致（出典: atwiki/page-365）", () => {
    expectCatalogText("RS-149", TEXT);
    expectStats("RS-149", {
      name: "イエローレーサー",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 2,
      comboNumber: 4,
      features: ["イエロー", "女"],
    });
  });

  it("RS-149: 4番目に出ると「SP1」になりストライクでき、相手のパワーのどれをウラ返すかは自分（ストライクした側）が選ぶ（出典: atwiki/page-365）", () => {
    let s = strikeWith(3);
    expect(s.pendingDamagePayment?.playerId).toBe("player2");
    const choosers = legal(s).filter((a) => a.type === "resolve_damage_payment").map((a) => a.playerId);
    expect(choosers.length).toBeGreaterThan(0);
    expect(new Set(choosers)).toEqual(new Set(["player1"]));
    s = act(s, { type: "resolve_damage_payment", playerId: "player1", instanceId: "TST-P:ep2" });
    s = settle(s);
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-P:ep2")?.faceDown).toBe(true);
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-P:ep0")?.faceDown).toBeFalsy();
  });

  it("RS-149: 4番目以外では「SP！」のままストライクできない（出典: atwiki/page-365「CN：4」）", () => {
    const s = st({ player1: { battle: fillers(1), rush: [inst("RS-149", "yr")] } });
    expect(canStrike(enter(s, "RS-149:yr"), "RS-149:yr")).toBe(false);
  });

  // faq-card-3 RS-149 Q1「はい、その通りです。」
  it("RS-149: 公式Q&A — 相手のオモテ向きのパワーが「相手に選ばれない」ガタックRF だけなら、自分は選べず相手が選ぶ（結果としてガタックRF がウラ返る）（出典: atwiki/page-365 Q1）", () => {
    // 選べるカードが1枚しかないため、エンジンは選択を開かずに処理する。ストライクした側に選択を求めないことと結果を確認する
    let s = strikeWith(3, [inst("RK-054", "gatack"), ...damageCards(2, "ed")]);
    expect(legal(s).some((a) => a.type === "resolve_damage_payment" && a.playerId === "player1")).toBe(false);
    s = settle(s);
    expect(s.players.player2.power.find((c) => c.instanceId === "RK-054:gatack")?.faceDown).toBe(true);
  });
});

// ===========================================================================
describe("RS-150 ピンクレーサー", () => {
  const TEXT =
    "【バンパーボウ】敵軍パワーゾーンからダメージ以外のカードを1枚選んで、持ち主のコマンドゾーンにホールド状態で置く（置けなければこの効果は発動できない）。";

  function pinkSecond(n = 1, p2: Record<string, unknown> = {}): GameState {
    let s = st({
      player1: { battle: fillers(n), rush: [inst("RS-150", "pr")] },
      player2: { power: [...damageCards(1, "ed"), ...powerCards(2, "ep")], ...p2 },
    });
    s = enter(s, "RS-150:pr");
    return s;
  }

  it("RS-150: カタログ本文・スペックが出典と一致（出典: atwiki/page-366）", () => {
    expectCatalogText("RS-150", TEXT);
    expectStats("RS-150", {
      name: "ピンクレーサー",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 2,
      features: ["ピンク", "女"],
    });
  });

  it("RS-150: 2番目に出ると、敵軍パワーゾーンのダメージ以外のカードを1枚、持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-366）", () => {
    const s = drain(pinkSecond(), "player1");
    expect(s.players.player2.command).toHaveLength(1);
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
    expect(s.players.player2.command[0]?.instanceId).toMatch(/^TST-P:ep/);
    expect(zoneOf(s, "player2", "TST-P:ed0")).toBe("power");
  });

  it.fails("RS-150: 置くカードは自分が選ぶ（出典: atwiki/page-366「1枚選んで」）", () => {
    // 既知の不具合: CARD-RS-150 【バンパーボウ】で置くカードを選ばせず、先頭のオモテ向きカードを自動で置く
    let s = pinkSecond();
    expect(choiceIds(s)).toEqual(["TST-P:ep0", "TST-P:ep1"]);
    s = pick(s, "TST-P:ep1");
    expect(zoneOf(s, "player2", "TST-P:ep1")).toBe("command");
  });

  it("RS-150: 敵軍コマンドゾーンが5枚で置けなければ発動しない（出典: atwiki/page-366「置けなければこの効果は発動できない」）", () => {
    const s = drain(pinkSecond(1, { command: releasedN(5, "TST-OP", "ec") }), "player1");
    expect(s.players.player2.command).toHaveLength(5);
    expect(s.players.player2.power).toHaveLength(3);
  });

  it("RS-150: 2番目以外では発動しない（出典: atwiki/page-366「CN：2」）", () => {
    const s = drain(pinkSecond(0), "player1");
    expect(s.players.player2.command).toHaveLength(0);
  });
});
