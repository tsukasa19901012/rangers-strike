/**
 * カード別スペック: RS-097〜RS-105（第2弾「二人の黒騎士」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md、grnrngr/faq-card-2（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_2.html）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md、ライブ写し docs/rules/sources/web/w.atwiki.jp/renst/pages/N.txt）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attack,
  bpOf,
  canEnter,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  enterWithHold,
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
  raw,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  tryAct,
  zoneIds,
  zoneOf,
} from "./RS2-097-122.helpers";
import type { GameState, PlayerId } from "../types/game";

/** 自軍バトルフェイズに、指定ユニットの「アタックするかわりに」（use_juu_kun_do）が合法か。 */
function canUseInstead(s: GameState, attacker: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) => a.type === "use_juu_kun_do" && a.playerId === playerId && a.attackerInstanceId === attacker,
  );
}

// ===========================================================================
describe("RS-097 ハリケンレオン", () => {
  const SP0 = sUnit("SPEC-SP0", { sp: undefined });
  const FRAC = sUnit("SPEC-FRAC", { sp: "1/2" as never });

  // atwiki/page-315「【カラクリ忍法・連獅子】これが自軍バトルエリアにあるとき、「SP1」以上または「SP！」のある敵軍ユニットは…」
  it("RS-097: カタログ本文・スペックが出典と一致（出典: atwiki/page-315）", () => {
    expectCatalogText(
      "RS-097",
      "【カラクリ忍法・連獅子】これが自軍バトルエリアにあるとき、「SP1」以上または「SP！」のある敵軍ユニットはコマンドを1つホールドしなければバトルエリアに出られない。",
    );
    expectStats("RS-097", {
      name: "ハリケンレオン",
      category: "MA",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  // 「追加条件：自軍Sユニットを1体捨札にする」「必要パワー：5+」
  it("RS-097: 追加条件（自軍Sユニットを1体捨札にする）を満たしてラッシュでき、素材は捨札へ（出典: atwiki/page-315）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-097", "le")],
        rush: [inst("TST-UNIT-0", "mat")],
        command: [released("TST-OP-MA", "ma")],
        power: powerCards(5),
      },
    });
    const r = rushFromHand(s, "player1", "RS-097:le");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-097:le")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:mat")).toBe("discard");
  });

  it("RS-097: 必要パワー5+ — パワー4枚ではラッシュできない（出典: atwiki/page-315）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-097", "le")],
        rush: [inst("TST-UNIT-0", "mat")],
        command: [released("TST-OP-MA", "ma")],
        power: powerCards(4),
      },
    });
    expect(rushFromHand(s, "player1", "RS-097:le").ok).toBe(false);
  });

  // 「「SP1」以上…の敵軍ユニットはコマンドを1つホールドしなければバトルエリアに出られない」
  it("RS-097: 敵軍バトルエリアにレオンがあると、SP1 のユニットはコマンドを1つホールドしなければ出られない（出典: atwiki/page-315）", () => {
    const base = { player2: { battle: [inst("RS-097", "le")] } };
    const none = st({ ...base, player1: { rush: [inst("TST-UNIT-0", "a")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "TST-UNIT-0:a")).toBe(false);
    expect(tryAct(none, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-0:a" }).ok).toBe(false);

    let s = st({ ...base, player1: { rush: [inst("TST-UNIT-0", "a")], command: [released("TST-OP", "c")] } });
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-0:a" }).ok).toBe(false);
    s = enterWithHold(s, "TST-UNIT-0:a", ["TST-OP:c"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // 「または「SP！」のある敵軍ユニット」
  it("RS-097: 「SP！」のユニット（ハリケンレッド）もホールドが必要（出典: atwiki/page-315）", () => {
    const s = st({
      player1: { rush: [inst("RS-099", "red")], command: [held("TST-OP", "h")] },
      player2: { battle: [inst("RS-097", "le")] },
    });
    expect(canEnter(s, "RS-099:red")).toBe(false);
  });

  it("RS-097: SP のないユニットはホールドせずに出られる（出典: atwiki/page-315）", () => {
    let s = st(
      {
        player1: { rush: [inst("SPEC-SP0", "a")], command: [released("TST-OP", "c")] },
        player2: { battle: [inst("RS-097", "le")] },
      },
      [SP0],
    );
    s = enter(s, "SPEC-SP0:a");
    expect(zoneOf(s, "player1", "SPEC-SP0:a")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBeFalsy();
  });

  // 「これが自軍バトルエリアにあるとき」「敵軍ユニット」
  it("RS-097: ラッシュエリアにあるレオン・自軍のレオンでは制限を受けない（出典: atwiki/page-315）", () => {
    let s = st({
      player1: { rush: [inst("TST-UNIT-0", "a")], battle: [inst("RS-097", "own")], command: [] },
      player2: { rush: [inst("RS-097", "le")] },
    });
    s = enter(s, "TST-UNIT-0:a");
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("battle");
  });

  // faq-card-2 RS-097 Q1「分数表記のユニットはラッシュエリアにある間は「ＳＰ１」でも「ＳＰ！」でもありません」
  it("RS-097: 公式Q&A — SP が分数表記のユニットはホールドせずに出られる（出典: grnrngr/faq-card-2 RS-097 Q1）", () => {
    let s = st(
      {
        player1: { rush: [inst("SPEC-FRAC", "f")], command: [released("TST-OP", "c")] },
        player2: { battle: [inst("RS-097", "le")] },
      },
      [FRAC],
    );
    s = enter(s, "SPEC-FRAC:f");
    expect(zoneOf(s, "player1", "SPEC-FRAC:f")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBeFalsy();
  });

  // faq-card-2 RS-097 Q2「ホールドするコマンドが無いため…捨札のままになります。ただし、ホールドできるコマンドが１つでもあれば…出さなければなりません」
  it("RS-097: 公式Q&A — パワーバズーカで捨札から出す SP1 の合体ユニットは、ホールドできなければ捨札のまま・できればホールドして出る（出典: grnrngr/faq-card-2 RS-097 Q2）", () => {
    // RS-112 ウルカイザー（合体―魔導騎士ウルザード(SP1)＋魔導馬バリキオン）を RS-009 パワーバズーカで撃破する
    const mk = (cmds: ReturnType<typeof released>[]) =>
      st({
        phase: "rush",
        player1: {
          hand: [inst("RS-009", "bz")],
          battle: [inst("RS-097", "le")],
          power: powerCards(8),
          command: [held("TST-OP-ET", "et")],
        },
        player2: {
          battle: [{ ...inst("RS-112", "ulk"), zordMaterialCardId: "RS-115" }],
          discard: [inst("RS-115", "urz")],
          command: cmds,
        },
      });
    const run = (s0: GameState) => {
      const play = legal(s0).find(
        (a) => a.type === "play_operation" && a.instanceId === "RS-009:bz" && a.targetInstanceId === "RS-112:ulk",
      );
      expect(play).toBeDefined();
      let s = act(s0, play!);
      for (let i = 0; i < 6; i++) {
        if (s.pendingEffectChoice?.playerId === "player2") {
          s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: s.pendingEffectChoice.validInstanceIds[0]! });
        } else if (s.pendingCommandPayment?.playerId === "player2") {
          const p = s.pendingCommandPayment;
          s = act(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
        } else break;
      }
      return s;
    };
    expect(zoneOf(run(mk([])), "player2", "RS-115:urz")).toBe("discard");
    const s = run(mk([released("TST-OP", "p2c")]));
    expect(zoneOf(s, "player2", "RS-115:urz")).toBe("battle");
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });

  // faq-card-2 RS-097 Q3「ホールドできる自軍コマンドがなければ…「RS-090 レッドレーサー」はラッシュエリアに置かれます」
  it("RS-097: 公式Q&A — レッドレーサーはホールドできればバトルエリア、できなければラッシュエリアに置く（出典: grnrngr/faq-card-2 RS-097 Q3）", () => {
    const mk = (n: number) =>
      st({
        phase: "rush",
        player1: { hand: [inst("RS-090", "red")], power: powerCards(2), command: releasedN(n, "TST-OP-OT", "ot") },
        player2: { battle: [inst("RS-097", "le")] },
      });
    const two = rushFromHand(mk(2), "player1", "RS-090:red");
    expect(two.ok).toBe(true);
    const s2 = settle(two.state);
    expect(zoneOf(s2, "player1", "RS-090:red")).toBe("battle");
    expect(s2.players.player1.command.every((c) => c.commandHeld)).toBe(true);

    const one = rushFromHand(mk(1), "player1", "RS-090:red");
    expect(one.ok).toBe(true);
    expect(zoneOf(settle(one.state), "player1", "RS-090:red")).toBe("rush");
  });

  // faq-card-2 RS-097 Q4「リリース状態のコマンドが無くなったら、それ以上のユニットをバトルエリアに出すことはできなくなる」
  it("RS-097: 公式Q&A — 相手のピットインダイブで出される SP1 ユニットは1体ごとにホールドし、コマンドが尽きたら止まる（出典: grnrngr/faq-card-2 RS-097 Q4）", () => {
    let s = st({
      player1: { battle: [inst("RS-097", "le"), ...fillers(2)], rush: [inst("RS-049", "g")] },
      player2: {
        rush: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")],
        command: [released("TST-OP", "c")],
      },
    });
    s = enter(s, "RS-049:g");
    for (let i = 0; i < 4 && s.pendingEffectChoice; i++) {
      const pick = s.pendingEffectChoice.validInstanceIds.find((id) => zoneOf(s, "player2", id) === "rush");
      if (!pick) break;
      const r = tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: pick });
      if (!r.ok) break;
      s = settle(r.state);
    }
    s = settle(s);
    expect(s.players.player2.battle).toHaveLength(1);
    expect(s.players.player2.rush).toHaveLength(1);
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
  });

  // faq-card-2 RS-097 Q5「ホールドできるコマンドがあれば…ホールドしてバトルエリアに出さなければなりません」
  it("RS-097: 公式Q&A — 「毎ターン、可能なら出る」タイガーレンジャーは、ホールドできれば出なければならず、できなければ留まる（出典: grnrngr/faq-card-2 RS-097 Q5）", () => {
    const withCmd = st({
      player1: { rush: [inst("RS-041", "tiger")], command: [released("TST-OP", "c")] },
      player2: { battle: [inst("RS-097", "le")] },
    });
    expect(legalOfType(withCmd, "end_phase")).toHaveLength(0);
    const s1 = enterWithHold(withCmd, "RS-041:tiger", ["TST-OP:c"]);
    expect(zoneOf(s1, "player1", "RS-041:tiger")).toBe("battle");

    const noCmd = st({
      player1: { rush: [inst("RS-041", "tiger")], command: [held("TST-OP", "h")] },
      player2: { battle: [inst("RS-097", "le")] },
    });
    expect(legalOfType(noCmd, "end_phase")).toHaveLength(1);
  });

  // faq-card-2 RS-097 Q6「はい、その通りです。」（ファイブテクターで出すときもホールド）
  it("RS-097: 公式Q&A — ファイブテクターで SP1 のユニットを出すときもコマンドを1つホールドする（出典: grnrngr/faq-card-2 RS-097 Q6）", () => {
    const mk = (cmds: ReturnType<typeof released>[]) =>
      st({
        player1: { battle: [inst("RS-097", "le"), inst("TST-UNIT-2", "atk")] },
        player2: {
          operation: [inst("RS-014", "ft")],
          rush: [inst("TST-UNIT-0", "sp1")],
          command: cmds,
          power: powerCards(5),
        },
      });
    let s = strike(mk([released("TST-OP-ET", "p2c")]), "TST-UNIT-2:atk");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "TST-UNIT-0:sp1" });
    if (s.pendingCommandPayment) {
      s = act(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP-ET:p2c"] });
    }
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);

    const none = strike(mk([]), "TST-UNIT-2:atk");
    expect(legalOfType(none, "five_tech_intercept").map((a) => a.interceptInstanceId)).not.toContain("TST-UNIT-0:sp1");
  });

  // faq-card-2 RS-097 Q7「はい、重複しますので、その通りになります。」
  it("RS-097: 公式Q&A — レオン2体なら2つホールドが必要（出典: grnrngr/faq-card-2 RS-097 Q7）", () => {
    const base = { player2: { battle: [inst("RS-097", "l1"), inst("RS-097", "l2")] } };
    const one = st({ ...base, player1: { rush: [inst("TST-UNIT-0", "a")], command: releasedN(1) } });
    expect(canEnter(one, "TST-UNIT-0:a")).toBe(false);
    let two = st({ ...base, player1: { rush: [inst("TST-UNIT-0", "a")], command: releasedN(2) } });
    two = enterWithHold(two, "TST-UNIT-0:a", ["TST-OP:rc0", "TST-OP:rc1"]);
    expect(zoneOf(two, "player1", "TST-UNIT-0:a")).toBe("battle");
    expect(two.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  // atwiki/page-315 Q8「いいえ、自軍コマンドをホールドして下さい。」
  it("RS-097: atwiki Q&A — 敵軍のリリース状態のコマンドでは代用できない（出典: atwiki/page-315 Q8）", () => {
    const s = st({
      player1: { rush: [inst("TST-UNIT-0", "a")], command: [held("TST-OP", "h")] },
      player2: { battle: [inst("RS-097", "le")], command: releasedN(2, "TST-OP", "ec") },
    });
    expect(canEnter(s, "TST-UNIT-0:a")).toBe(false);
  });
});

// ===========================================================================
describe("RS-098 ハリケンドルフィン", () => {
  const E3K = sUnit("SPEC-E3K", { bp: 3000 });
  const E4K = sUnit("SPEC-E4K", { bp: 4000 });

  it("RS-098: カタログ本文・スペックが出典と一致（出典: atwiki/page-316）", () => {
    expectCatalogText(
      "RS-098",
      "【カラクリ忍法・大津波】これをラッシュしたとき、BP3000以下の敵軍ユニットを1体選んで持ち主の手札に戻す。",
    );
    expectStats("RS-098", {
      name: "ハリケンドルフィン",
      category: "MA",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  function rushDolphin(enemy: { rush?: string[]; battle?: string[] }) {
    const s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-098", "do")],
          rush: [inst("TST-UNIT-0", "mat")],
          command: [released("TST-OP-MA", "ma")],
          power: powerCards(3),
        },
        player2: {
          rush: (enemy.rush ?? []).map((id, i) => inst(id, `r${i}`)),
          battle: (enemy.battle ?? []).map((id, i) => inst(id, `b${i}`)),
        },
      },
      [E3K, E4K],
    );
    const r = rushFromHand(s, "player1", "RS-098:do");
    expect(r.ok).toBe(true);
    return r.state;
  }

  // 「BP3000以下の敵軍ユニットを1体選んで持ち主の手札に戻す」
  it("RS-098: ラッシュしたとき BP3000 以下の敵軍ユニットを1体選んで持ち主の手札に戻す（BP4000 は対象外）（出典: atwiki/page-316）", () => {
    let s = rushDolphin({ rush: ["SPEC-E3K", "SPEC-E4K"] });
    expect(zoneOf(s, "player1", "TST-UNIT-0:mat")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-E3K:r0"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E3K:r0" });
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-E3K:r0")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-E4K:r1")).toBe("rush");
  });

  it("RS-098: 敵軍バトルエリアのユニットも対象になる（出典: atwiki/page-316「敵軍ユニット」）", () => {
    let s = rushDolphin({ battle: ["SPEC-E3K"] });
    expect(choiceIds(s)).toEqual(["SPEC-E3K:b0"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-E3K:b0" });
    expect(zoneOf(settle(s), "player2", "SPEC-E3K:b0")).toBe("hand");
  });

  // 「選んで…戻す」（「してもよい」ではない＝強制）
  it("RS-098: 対象がいれば戻すのは強制（スキップできない）（出典: atwiki/page-316）", () => {
    const s = rushDolphin({ rush: ["SPEC-E3K"] });
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-099 ハリケンレッド", () => {
  it("RS-099: カタログ本文・スペックが出典と一致（出典: atwiki/page-317）", () => {
    expectCatalogText("RS-099", "【超忍法・空駆け】「SP1」");
    expectStats("RS-099", {
      name: "ハリケンレッド",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 3,
      features: ["レッド", "男", "忍者"],
    });
  });

  // 「CN：3」「【超忍法・空駆け】「SP1」」
  it("RS-099: 3番目に出ると「SP1」になりストライクできる（出典: atwiki/page-317）", () => {
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-099", "r")] } });
    s = enter(s, "RS-099:r");
    expect(ncLogged(s, "RS-099")).toBe(true);
    expect(canStrike(s, "RS-099:r")).toBe(true);
  });

  it("RS-099: 3番目以外で出たときは「SP！」のままでストライクできない（出典: atwiki/page-317）", () => {
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-099", "r")] } });
    s = enter(s, "RS-099:r");
    expect(canStrike(s, "RS-099:r")).toBe(false);
  });
});

// ===========================================================================
describe("RS-100 ハリケンイエロー", () => {
  it("RS-100: カタログ本文・スペックが出典と一致（出典: atwiki/page-318）", () => {
    expectCatalogText(
      "RS-100",
      "【超忍法・舞獅子】これはアタックするかわりに次の効果を発動できる。自軍山札を見て「ハリケンイエロー」のカードを1枚選んで自軍バトルエリアに出してもよい。その後、山札をシャッフルする。",
    );
    expectStats("RS-100", {
      name: "ハリケンイエロー",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 1,
      features: ["イエロー", "男", "忍者"],
    });
  });

  function yellowFirst(deck = [inst("RS-100", "d1"), ...deckCards(3)], enemyBattle = [inst("TST-UNIT-0", "e")]) {
    let s = st({
      player1: { rush: [inst("RS-100", "y")], deck },
      player2: { battle: enemyBattle },
    });
    s = enter(s, "RS-100:y");
    return s;
  }

  // 「これはアタックするかわりに次の効果を発動できる。自軍山札を見て「ハリケンイエロー」のカードを1枚選んで自軍バトルエリアに出してもよい」
  it("RS-100: 1番目に出たとき、アタックするかわりに山札のハリケンイエローをバトルエリアに出し、アタックできなくなる（出典: atwiki/page-318）", () => {
    let s = yellowFirst();
    expect(canUseInstead(s, "RS-100:y")).toBe(true);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-100:y" });
    if (s.pendingEffectChoice?.validInstanceIds.includes("RS-100:d1")) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-100:d1" });
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-100:d1")).toBe("battle");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RS-100:y")).toBe(false);
  });

  it("RS-100: 2番目に出たとき（NC 不成立）は発動できない（出典: atwiki/page-318「CN：1」）", () => {
    let s = st({
      player1: { battle: fillers(1), rush: [inst("RS-100", "y")], deck: [inst("RS-100", "d1")] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = enter(s, "RS-100:y");
    expect(canUseInstead(s, "RS-100:y")).toBe(false);
  });

  // 「出してもよい」
  it.fails("RS-100: 山札にハリケンイエローがあっても出さないことを選べる（任意）（出典: atwiki/page-318「出してもよい」）", () => {
    // 既知の不具合: CARD-RS-100 舞獅子は山札の先頭のハリケンイエローを自動で出し、出さない選択・どれを出すかの選択ができない
    let s = yellowFirst();
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-100:y" });
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "RS-100:d1")).toBe("deck");
  });

  // 「その後、山札をシャッフルする」— 山札の中身（枚数）が保たれる
  it("RS-100: 発動後の山札は出したカード以外そのまま残る（シャッフル）（出典: atwiki/page-318）", () => {
    let s = yellowFirst([inst("RS-100", "d1"), ...deckCards(5)]);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-100:y" });
    if (s.pendingEffectChoice?.validInstanceIds.includes("RS-100:d1")) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-100:d1" });
    }
    expect(zoneIds(s, "player1", "deck").slice().sort()).toEqual(deckCards(5).map((c) => c.instanceId).sort());
  });

  // faq-card-2 RS-100 Q1「はい、できます。」
  it("RS-100: 公式Q&A — 山札にハリケンイエローが無くても発動できる（出典: grnrngr/faq-card-2 RS-100 Q1）", () => {
    let s = yellowFirst(deckCards(3));
    expect(canUseInstead(s, "RS-100:y")).toBe(true);
    s = act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-100:y" });
    s = settle(s);
    expect(s.players.player1.battle).toHaveLength(1);
  });

  // atwiki/page-318 Q2「ルール整理後（※公式コラムvol44より抜粋）：…アタックする権利を失う代わりに効果を発動することができる」
  // （公式FAQ card_2 の旧裁定「発動できません」は vol44 のルール整理で置き換え。README §1.2、R-ATK-05）
  it("RS-100: 公式Q&A（ルール整理後）— 相手のバトルエリアにユニットがいなくても発動できる（出典: atwiki/page-318 Q2・R-ATK-05。faq-card-2 RS-100 Q2 は旧裁定）", () => {
    const s = yellowFirst(undefined, []);
    expect(canUseInstead(s, "RS-100:y")).toBe(true);
  });
});

// ===========================================================================
describe("RS-101 ハリケンブルー", () => {
  it("RS-101: カタログ本文・スペックが出典と一致（出典: atwiki/page-319）", () => {
    expectCatalogText("RS-101", "【超忍法・水変化】相手は自分自身のラッシュエリアからSユニットを1体選んで手札に戻す。");
    expectStats("RS-101", {
      name: "ハリケンブルー",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 4,
      features: ["ブルー", "女", "忍者"],
    });
  });

  function blueFourth(enemyRush: ReturnType<typeof inst>[]) {
    const EM = sUnit("SPEC-EM", { size: "M", bp: 3000 });
    let s = st({ player1: { battle: fillers(3), rush: [inst("RS-101", "b")] }, player2: { rush: enemyRush } }, [EM]);
    s = enter(s, "RS-101:b");
    return s;
  }

  // 「相手は自分自身のラッシュエリアからSユニットを1体選んで手札に戻す」
  it("RS-101: 4番目に出ると、相手が自分のラッシュエリアの S ユニットを1体選んで手札に戻す（M は対象外）（出典: atwiki/page-319）", () => {
    let s = blueFourth([inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("SPEC-EM", "m")]);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(0);
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-UNIT-0:e2" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });

  it.fails("RS-101: バトルエリアに出られない S ユニット（マンドラ坊や）も戻す対象になる（出典: atwiki/page-319）", () => {
    // 既知の不具合: CARD-RS-101 水変化の候補を「効果でバトルエリアに出せるSユニット」に絞っており、出られないSユニットを選べない
    const s = blueFourth([inst("RS-116", "man")]);
    expect(choiceIds(s)).toEqual(["RS-116:man"]);
  });

  it("RS-101: 4番目以外で出たときは発動しない（出典: atwiki/page-319「CN：4」）", () => {
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-101", "b")] }, player2: { rush: [inst("TST-UNIT-0", "e1")] } });
    s = enter(s, "RS-101:b");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-102 五の槍サーガイン", () => {
  it("RS-102: カタログ本文・スペックが出典と一致（出典: atwiki/page-330）", () => {
    expectCatalogText(
      "RS-102",
      "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【暗黒二刀流・巌流剣】敵軍パワーゾーンからダメージになっていないカードを1枚選ぶ。そして敵軍コマンドゾーンからもカードを1枚選ぶ。そうしたとき、選んだ2枚を捨札にする。",
    );
    expectStats("RS-102", {
      name: "五の槍サーガイン",
      category: "DA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 5,
      comboNumber: 5,
      features: ["暗黒七本槍", "男", "忍者"],
    });
  });

  function sagainFifth(enemy: { power?: ReturnType<typeof inst>[]; command?: ReturnType<typeof inst>[] }) {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-102", "sa")] },
      player2: { power: enemy.power ?? [], command: enemy.command ?? [] },
    });
    s = enter(s, "RS-102:sa");
    return s;
  }

  // 「敵軍パワーゾーンからダメージになっていないカードを1枚選ぶ。そして敵軍コマンドゾーンからもカードを1枚選ぶ。そうしたとき、選んだ2枚を捨札にする」
  it("RS-102: 5番目に出ると、敵軍パワー（ダメージ以外）とコマンドから1枚ずつ選んで捨札にする（出典: atwiki/page-330）", () => {
    let s = sagainFifth({
      power: [inst("TST-P", "p0"), { ...inst("TST-P", "dmg"), faceDown: true }],
      command: [held("TST-OP", "c0")],
    });
    expect(choiceIds(s)).toEqual(["TST-P:p0"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-P:p0" });
    for (let i = 0; i < 3 && s.pendingEffectChoice; i++) {
      expect(choiceIds(s)).toContain("TST-OP:c0");
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:c0" });
    }
    expect(zoneOf(s, "player2", "TST-P:p0")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:c0")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-P:dmg")).toBe("power");
  });

  // faq-card-2 RS-102 Q1「いいえ、できません。」（どちらか一方しか選べなければ発動できない）
  it.fails("RS-102: 公式Q&A — 敵軍コマンドゾーンが空なら、パワーゾーンのカードも捨札にならない（出典: grnrngr/faq-card-2 RS-102 Q1）", () => {
    // 既知の不具合: CARD-RS-102 巌流剣は片方のゾーンにしか選べるカードが無くても発動し、選んだパワーを捨札にする
    let s = sagainFifth({ power: [inst("TST-P", "p0")], command: [] });
    for (let i = 0; i < 3 && s.pendingEffectChoice; i++) {
      const id = s.pendingEffectChoice.validInstanceIds[0]!;
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    expect(zoneOf(s, "player2", "TST-P:p0")).toBe("power");
  });

  it.fails("RS-102: 公式Q&A — 敵軍パワーゾーンにダメージ以外のカードが無ければ、コマンドも捨札にならない（出典: grnrngr/faq-card-2 RS-102 Q1）", () => {
    // 既知の不具合: CARD-RS-102 巌流剣はパワーゾーンに選べるカードが無いとコマンドだけを捨札にする
    let s = sagainFifth({ power: [{ ...inst("TST-P", "dmg"), faceDown: true }], command: [held("TST-OP", "c0")] });
    for (let i = 0; i < 3 && s.pendingEffectChoice; i++) {
      const id = s.pendingEffectChoice.validInstanceIds[0]!;
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    expect(zoneOf(s, "player2", "TST-OP:c0")).toBe("command");
  });

  // 「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-102: ※ 敵軍ターン中に SP1 以上のユニットにアタックされると、バトルに勝っても撃破される（出典: atwiki/page-330）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-0", "atk")] },
      player2: { battle: [inst("RS-102", "sa")] },
    });
    s = settle(attack(s, "TST-UNIT-0:atk", "RS-102:sa"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:atk")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-102:sa")).toBe("discard");
  });

  it("RS-102: ※ SP のないユニットとのバトルでは勝てば残る（出典: atwiki/page-330）", () => {
    const SP0 = sUnit("SPEC-SP0", { sp: undefined });
    let s = st({ player1: { battle: [inst("SPEC-SP0", "atk")] }, player2: { battle: [inst("RS-102", "sa")] } }, [SP0]);
    s = settle(attack(s, "SPEC-SP0:atk", "RS-102:sa"));
    expect(zoneOf(s, "player2", "RS-102:sa")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-103 七の槍サンダール", () => {
  const E3K = sUnit("SPEC-E3K", { bp: 3000 });
  const E4K = sUnit("SPEC-E4K", { bp: 4000 });

  it("RS-103: カタログ本文・スペックが出典と一致（出典: atwiki/page-331）", () => {
    expectCatalogText(
      "RS-103",
      "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【宇宙忍法・縄頭蓋】BP3000以下の敵軍ユニットを全て撃破する。",
    );
    expectStats("RS-103", {
      name: "七の槍サンダール",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 7,
      comboNumber: 7,
      features: ["暗黒七本槍", "男", "忍者"],
    });
  });

  // 「BP3000以下の敵軍ユニットを全て撃破する」
  it("RS-103: 7番目に出ると BP3000 以下の敵軍ユニットをラッシュ・バトル両方とも全て撃破する（出典: atwiki/page-331）", () => {
    let s = st(
      {
        player1: { battle: fillers(6), rush: [inst("RS-103", "sd")] },
        player2: {
          rush: [inst("SPEC-E3K", "r3"), inst("SPEC-E4K", "r4")],
          battle: [inst("SPEC-E3K", "b3")],
        },
      },
      [E3K, E4K],
    );
    s = settle(enter(s, "RS-103:sd"));
    expect(zoneOf(s, "player2", "SPEC-E3K:r3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3K:b3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E4K:r4")).toBe("rush");
  });

  // 一般ルール: 撃破されたときの効果は撃破なら誘発する（R-TIME-04、faq-card-2 RS-116「撃破された瞬間に手札に戻ります」）
  it.fails("RS-103: 縄頭蓋の撃破でもマンドラ坊やの【鳴き声】が誘発する（出典: atwiki/page-331・grnrngr/faq-card-2 RS-116）", () => {
    // 既知の不具合: CARD-RS-103 縄頭蓋は撃破処理を通さず直接捨札に移すため、撃破時の効果（鳴き声など）が誘発しない
    let s = st({
      player1: { battle: fillers(6), rush: [inst("RS-103", "sd")] },
      player2: { rush: [inst("RS-116", "man"), inst("TST-UNIT-2", "keep")] },
    });
    s = settle(enter(s, "RS-103:sd"));
    expect(zoneOf(s, "player2", "RS-116:man")).toBe("discard");
    // 鳴き声: 特徴「魔法」を持たない S ユニット（自軍フィラー）が手札に戻る
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("hand");
  });

  it("RS-103: ※ 敵軍ターン中に SP1 以上のユニットとバトルすると、勝っても撃破される（出典: atwiki/page-331）", () => {
    let s = st({ player1: { battle: [inst("TST-UNIT-0", "atk")] }, player2: { battle: [inst("RS-103", "sd")] } });
    s = settle(attack(s, "TST-UNIT-0:atk", "RS-103:sd"));
    expect(zoneOf(s, "player2", "RS-103:sd")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-104 アバレイエロー", () => {
  it("RS-104: カタログ本文・スペックが出典と一致（出典: atwiki/page-233）", () => {
    expectCatalogText("RS-104", "【プテラダガー】これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。");
    expectStats("RS-104", {
      name: "アバレイエロー",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 3,
      features: ["イエロー", "女"],
    });
  });

  // 「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」
  it("RS-104: 3番目に出てアタックすると、BP が上がった敵軍ユニットを本来の BP として扱う（出典: atwiki/page-233）", () => {
    const pumped = { ...inst("TST-UNIT-0", "def"), bpModifier: 5000 };
    let s = st({ player1: { battle: fillers(2), rush: [inst("RS-104", "ay")] }, player2: { battle: [pumped] } });
    s = enter(s, "RS-104:ay");
    s = settle(attack(s, "RS-104:ay", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-104:ay")).toBe("battle");
  });

  // R-CN-01/R-CN-02: CN の欄の【】効果はナンバーコンビネーション（並び順が CN と一致したときだけ発動）
  it.fails("RS-104: NC 不成立（2番目）なら修正後の BP でバトルする（出典: atwiki/page-233「CN：3」・R-CN-02）", () => {
    // 既知の不具合: CARD-RS-104 【プテラダガー】が NC の成立に関係なく常に有効（3番目以外で出ても本来の BP でバトルする）
    const pumped = { ...inst("TST-UNIT-0", "def"), bpModifier: 5000 };
    let s = st({ player1: { battle: fillers(1), rush: [inst("RS-104", "ay")] }, player2: { battle: [pumped] } });
    s = enter(s, "RS-104:ay");
    s = settle(attack(s, "RS-104:ay", "TST-UNIT-0:def"));
    expect(zoneOf(s, "player1", "RS-104:ay")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-105 デカベースクローラー", () => {
  it("RS-105: カタログ本文が出典と一致（出典: atwiki/page-304）", () => {
    expectCatalogText(
      "RS-105",
      "【母艦】これが自軍ラッシュエリアにあるとき、自分がラッシュするMユニットの追加条件を満たすために次のようにしてもよい⇒自軍Sユニットを1体パワーゾーンに送るかわりに、「OT」の自軍コマンドを1つホールドする。",
    );
  });

  // atwiki/page-304「種類：XLユニット」
  it.fails("RS-105: スペック（XLユニット・BP5000・必要パワー5・特徴 メカ／母艦）が出典と一致（出典: atwiki/page-304）", () => {
    // 既知の不具合: CARD-RS-105 サイズが XL ではなく L で定義されている
    expectStats("RS-105", {
      name: "デカベースクローラー",
      category: "OT",
      size: "XL",
      bp: 5000,
      sp: undefined,
      powerCost: 5,
      features: ["メカ", "母艦"],
    });
  });

  function motherState(opts: { hand: string; otCommands: number; sUnit?: boolean; power?: number; extraCmd?: string }) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst(opts.hand, "z")],
        rush: [inst("RS-105", "base"), ...(opts.sUnit ? [inst("TST-UNIT-0", "s")] : [])],
        command: [
          ...releasedN(opts.otCommands, "TST-OP-OT", "ot"),
          ...(opts.extraCmd ? [released(opts.extraCmd, "x")] : []),
        ],
        power: powerCards(opts.power ?? 7),
      },
    });
  }

  function mothershipPath(s: GameState): GameState | null {
    const begin = tryAct(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: s.players.player1.hand[0]!.instanceId });
    if (!begin.ok) return null;
    let next = begin.state;
    for (let i = 0; i < 8 && next.pendingZordSetup; i++) {
      const setup = next.pendingZordSetup;
      const r =
        setup.step === "material"
          ? tryAct(next, { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" })
          : setup.step === "destination"
            ? tryAct(next, { type: "resolve_zord_setup", playerId: "player1", destination: "discard" })
            : tryAct(next, { type: "resolve_zord_setup", playerId: "player1" });
      if (!r.ok) return null;
      next = r.state;
    }
    for (let i = 0; i < 4 && next.pendingCommandPayment; i++) {
      const p = next.pendingCommandPayment;
      const r = tryAct(next, {
        type: "resolve_command_payment",
        playerId: "player1",
        commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded),
      });
      if (!r.ok) return null;
      next = r.state;
    }
    return settle(next);
  }

  // 「自軍Sユニットを1体パワーゾーンに送るかわりに、「OT」の自軍コマンドを1つホールドする」
  it("RS-105: 母艦 — パワーゾーンに送る追加条件の M ユニットを、OT コマンドのホールドで代用してラッシュできる（出典: atwiki/page-304）", () => {
    const s = mothershipPath(motherState({ hand: "RS-047", otCommands: 2, power: 3 }));
    expect(s).not.toBeNull();
    expect(zoneOf(s!, "player1", "RS-047:z")).toBe("rush");
    expect(s!.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RS-105: 母艦 — OT 以外のコマンドでは代用できない（出典: atwiki/page-304）", () => {
    const s = mothershipPath(motherState({ hand: "RS-047", otCommands: 1, power: 3, extraCmd: "TST-OP-ET" }));
    expect(s).toBeNull();
  });

  // faq-card-2 RS-105 Q2「いいえ、できません。」
  it("RS-105: 公式Q&A — 「パワーゾーンに送る」と書かれていない M ユニット（ハリケンレオン）には使えない（出典: grnrngr/faq-card-2 RS-105 Q2）", () => {
    const s = mothershipPath(motherState({ hand: "RS-097", otCommands: 2, extraCmd: "TST-OP-MA" }));
    expect(s).toBeNull();
  });

  // faq-card-2 RS-105 Q3「はい、できます。」
  it("RS-105: 公式Q&A — 自軍 S ユニットが1体もラッシュされていなくても使える（出典: grnrngr/faq-card-2 RS-105 Q3）", () => {
    const s = mothershipPath(motherState({ hand: "RS-085", otCommands: 2 }));
    expect(s).not.toBeNull();
    expect(zoneOf(s!, "player1", "RS-085:z")).toBe("rush");
  });

  // faq-card-2 RS-105 Q4「「オーバーテクノロジー」のコマンドを２つホールドします」
  it("RS-105: 公式Q&A — ファイヤーファイターを母艦でラッシュすると OT コマンドを2つホールドする（出典: grnrngr/faq-card-2 RS-105 Q4）", () => {
    const s = mothershipPath(motherState({ hand: "RS-085", otCommands: 3 }));
    expect(s).not.toBeNull();
    expect(s!.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
    expect(mothershipPath(motherState({ hand: "RS-085", otCommands: 1 }))).toBeNull();
  });

  // faq-card-2 RS-105 Q5「はい、できます。」
  it("RS-105: 公式Q&A — 自軍 S ユニットがラッシュされていても母艦を使える（S ユニットは残る）（出典: grnrngr/faq-card-2 RS-105 Q5）", () => {
    const s = mothershipPath(motherState({ hand: "RS-085", otCommands: 2, sUnit: true }));
    expect(s).not.toBeNull();
    expect(zoneOf(s!, "player1", "TST-UNIT-0:s")).toBe("rush");
    expect(zoneOf(s!, "player1", "RS-085:z")).toBe("rush");
  });

  // faq-card-2 RS-105 Q1（ベン・G の人身略取で相手に追加条件を満たさせる）
  it.todo(
    "RS-105: 公式Q&A — 相手のベン・G【人身略取】で追加条件を満たすとき、S ユニットがなくても母艦を使えるなら満たさなければならない（出典: grnrngr/faq-card-2 RS-105 Q1）— 人身略取の「相手が追加条件を満たす」処理に母艦の選択を差し込む公開 API が無く、状況を組み立てられない",
  );

  it("RS-105: 母艦はラッシュエリアにあるときだけ有効（バトルエリアでは使えない）（出典: atwiki/page-304「これが自軍ラッシュエリアにあるとき」）", () => {
    const s0 = motherState({ hand: "RS-085", otCommands: 2 });
    const moved = {
      ...s0,
      players: {
        ...s0.players,
        player1: { ...s0.players.player1, rush: [], battle: [inst("RS-105", "base")] },
      },
    };
    expect(mothershipPath(moved)).toBeNull();
  });
});

// 未使用の import を避ける（型チェック用）
void [DEFS, raw, bpOf, endTurn];
