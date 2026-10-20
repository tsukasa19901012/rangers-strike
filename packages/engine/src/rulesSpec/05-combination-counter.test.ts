/**
 * docs/rules/05-battle-strike-damage.md §6 コンビネーション / §7 カウンター
 * 期待値はルールブックと docs/rules/sources/web/ の公式・atwiki ページに従う（現エンジンの挙動ではない）。
 */
import { describe, expect, it } from "vitest";
import { rushWithCategoryHold } from "../testing/rushPayment";
import {
  act,
  attack,
  attackTargets,
  battleState,
  canStartCounter,
  canStrike,
  deckCards,
  endTurn,
  enter,
  fillers,
  heldCommands,
  ids,
  inst,
  legal,
  legalOfType,
  legendDefinitions,
  ncLogged,
  passEntry,
  playCounter,
  powerCards,
  releasedCommands,
  settle,
  strike,
  zoneOf,
} from "./05-helpers";
import type { GameState } from "../types/game";

function toPhase(state: GameState, phase: GameState["phase"]): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.phase !== phase; i++) {
    const next =
      legal(s).find((a) => a.type === "draw") ??
      legal(s).find((a) => a.type === "return_all_battle_to_rush") ??
      legal(s).find((a) => a.type === "end_phase");
    if (!next) break;
    s = act(s, next);
  }
  return s;
}

function skipChoices(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 5 && s.pendingEffectChoice; i++) {
    s = act(s, { type: "skip_effect_choice", playerId: s.pendingEffectChoice.playerId } as never);
  }
  return s;
}

// ---------------------------------------------------------------------------
// §6 コンビネーション
// ---------------------------------------------------------------------------

describe("R-CN-01 コンビネーションナンバー（CN）", () => {
  // 「数字が書かれている場合はナンバーコンビネーション」
  it("R-CN-01: 数字の CN と並び順が一致すると NC が発動し、一致しなければ発動しない（出典: atwiki/page-140・page-226）", () => {
    let hit = battleState({ player1: { battle: fillers(2), rush: [inst("RS-058", "y")] } });
    hit = enter(hit, "RS-058:y");
    expect(ncLogged(hit, "RS-058")).toBe(true);
    let miss = battleState({ player1: { battle: fillers(1), rush: [inst("RS-058", "y")] } });
    miss = enter(miss, "RS-058:y");
    expect(ncLogged(miss, "RS-058")).toBe(false);
    expect(canStrike(miss, "RS-058:y")).toBe(false);
  });

  // 「RCが書かれている場合はライディングコンビネーション」
  it("R-CN-01: CN が「RC」のユニットは並び順で NC を発動しない（出典: atwiki/page-140）", () => {
    let s = battleState({ player1: { battle: fillers(4), rush: [inst("RK-064", "faiz")] } });
    s = enter(s, "RK-064:faiz");
    expect(ncLogged(s, "RK-064")).toBe(false);
  });

  // 「カードに表記された数字のナンバーの最低値は1、最高値は7」
  it("R-CN-01: 収録カードの数字 CN は1〜7（出典: atwiki/page-140）", () => {
    const numbers = Object.values(legendDefinitions)
      .map((d) => d.comboNumber)
      .filter((n): n is number => typeof n === "number");
    expect(numbers.length).toBeGreaterThan(0);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(7);
  });

  it.todo(
    "R-CN-01: 数字ナンバーが0のときは CN 効果を発動できない — CN を0にする効果が収録カード・エンジンに無いため",
  );
});

describe("R-CN-02 NC の発動", () => {
  // 「発動条件を満たした場合、必ず発動します」
  it("R-CN-02: 条件を満たした NC は選択なしで必ず発動する（マジブルーの1枚ドロー）（出典: atwiki/page-226 Q1・公式FAQ リファレンス「ナンバーコンビネーション」）", () => {
    let s = battleState({ player1: { battle: fillers(1), rush: [inst("RS-059", "blue")], deck: deckCards(3), hand: [] } });
    s = enter(s, "RS-059:blue");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.deck).toHaveLength(2);
  });

  // 「「～してもよい」というある場合についてのみ…選択が可能」
  it("R-CN-02: 「～してもよい」の NC は発動しない（適用しない）ことを選べる（マジピンク）（出典: atwiki/page-226 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(3), rush: [inst("RS-060", "pink")] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "RS-060:pink");
    expect(s.pendingEffectChoice?.optional).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" } as never);
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("battle");
  });

  // 「カテゴリの違うユニットでコンビネーションできますか？」「できます」
  it("R-CN-02: カテゴリの違うユニットの次でも NC は発動する（WB の次に MA のマジブルー）（出典: atwiki/page-226 Q2）", () => {
    let s = battleState({ player1: { battle: [inst("TST-UNIT-0", "wb")], rush: [inst("RS-059", "blue")], deck: deckCards(3), hand: [] } });
    s = enter(s, "RS-059:blue");
    expect(s.players.player1.hand).toHaveLength(1);
  });

  // 「サイズの違うユニットが、途中にあってもコンビネーションは発動します」
  it("R-CN-02: S・M・S と並んだ3番目の CN3 の S ユニットは NC を発動する（出典: atwiki/page-226 Q3・grnrngr/rule_phase4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-2", "m")], rush: [inst("RS-058", "y")] },
    });
    s = enter(s, "RS-058:y");
    expect(ncLogged(s, "RS-058")).toBe(true);
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-058:y")?.spModifier).toBe(1);
  });
});

describe("R-CN-03 NC は出た時点の並び順で判定", () => {
  // 「２番目にバトルエリアに出したユニットは１番目のユニットとして扱います」
  it("R-CN-03: 先に出たユニットが離れた後に出た CN2 のユニットは1番目なので NC は発動しない（出典: atwiki/page-226 Q4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "first")], rush: [inst("RS-059", "blue")], deck: deckCards(3), hand: [] },
      player2: { battle: [inst("TST-UNIT-2", "wall")] },
    });
    s = settle(attack(s, "TST-UNIT-0:first", "TST-UNIT-2:wall"));
    expect(s.players.player1.battle).toHaveLength(0);
    s = enter(s, "RS-059:blue");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // 「はい、できます」（Q5: 撃破後に別の CN2 で再発動）
  it("R-CN-03: CN2 で NC を発動したユニットが撃破された後、別の CN2 のユニットを2番目に出せば再び発動する（出典: atwiki/page-226 Q5）", () => {
    let s = battleState({
      player1: {
        battle: fillers(1),
        rush: [inst("RS-059", "blue1"), inst("RS-059", "blue2")],
        deck: deckCards(4),
        hand: [],
      },
      player2: { battle: [inst("TST-UNIT-2", "wall")] },
    });
    s = enter(s, "RS-059:blue1");
    expect(s.players.player1.hand).toHaveLength(1);
    s = settle(attack(s, "RS-059:blue1", "TST-UNIT-2:wall"));
    expect(zoneOf(s, "player1", "RS-059:blue1")).toBe("discard");
    s = enter(s, "RS-059:blue2");
    expect(ids(s.players.player1.battle).indexOf("RS-059:blue2")).toBe(1);
    expect(s.players.player1.hand).toHaveLength(2);
  });

  // 「バトルエリアに出たときに発動する能力です」（Q6）
  it("R-CN-03: 相手ターンに並び順が変わって CN の位置に来ても NC は発動しない（出典: atwiki/page-226 Q6）", () => {
    let s = battleState({
      activePlayer: "player2",
      player2: { battle: [inst("TST-UNIT-2", "atk")] },
      player1: { battle: [inst("TST-UNIT-0", "f0"), inst("TST-UNIT-0", "f1"), inst("RS-059", "blue")], deck: deckCards(3), hand: [] },
    });
    s = settle(attack(s, "TST-UNIT-2:atk", "TST-UNIT-0:f0", "player2"));
    expect(ids(s.players.player1.battle).indexOf("RS-059:blue")).toBe(1);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // 「並び順が後から変わっても…無効にならない」
  it("R-CN-03: NC で SP1 を得たユニットは、その後並び順が変わっても SP1 のままストライクできる（出典: atwiki/page-226・page-267）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "f0"), inst("TST-UNIT-0", "f1")], rush: [inst("RS-058", "y")] },
      player2: { battle: [inst("TST-UNIT-2", "wall")], power: powerCards(3) },
    });
    s = passEntry(enter(s, "RS-058:y"));
    s = settle(attack(s, "TST-UNIT-0:f0", "TST-UNIT-2:wall"));
    expect(ids(s.players.player1.battle).indexOf("RS-058:y")).toBe(1);
    // 「なにもしない」を選んだ後なのでこのターンはもう行動できないが、SP1 は保持している
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-058:y")?.spModifier).toBe(1);
  });
});

describe("R-CN-04 コンビネーションは自軍バトルフェイズのみ", () => {
  // 「コンビネーションの効果を発動できるのは、自分のバトルフェイズになります」
  it("R-CN-04: ファイブテクターで CN の位置に出した S ユニットの NC は発動しない（出典: grnrngr/faq-card-1 RS-014 Q3）", () => {
    // ストライクしてくるのは BP1000 の SP1 ユニット（マジブルー BP2000 がバトルに勝ってバトルエリアに残る。R-STK-05）
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "atk")] },
      player2: {
        operation: [inst("RS-014", "ft")],
        battle: [inst("TST-UNIT-0", "e0")],
        rush: [inst("RS-059", "blue")],
        deck: deckCards(3, "e"),
        hand: [],
        power: powerCards(4),
      },
    });
    s = strike(s, "TST-UNIT-0:atk");
    s = act(s, { type: "five_tech_intercept", playerId: "player2", interceptInstanceId: "RS-059:blue" });
    expect(ids(s.players.player2.battle)).toEqual(["TST-UNIT-0:e0", "RS-059:blue"]);
    s = settle(s);
    expect(s.players.player2.hand).toHaveLength(0);
    expect(ncLogged(s, "RS-059")).toBe(false);
  });

  // 「相手によってユニットがバトルエリアに引き出された場合…効果は発動しません」
  it("R-CN-04: 相手ターン中にジェットファルコンで引き出された CN2 のユニットの NC は発動しない（出典: grnrngr/faq-card-3 RS-135 Q5）", () => {
    let s = battleState({
      phase: "start",
      activePlayer: "player2",
      player2: { battle: [inst("RS-135", "jet")], deck: deckCards(3, "e") },
      player1: { battle: fillers(1), rush: [inst("RS-059", "blue")], deck: deckCards(3), hand: [] },
    });
    s = act(s, { type: "return_all_battle_to_rush", playerId: "player2" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-059:blue" } as never);
    if (s.pendingEffectChoice?.playerId === "player2") {
      s = act(s, { type: "confirm_effect_choice", playerId: "player2" } as never);
    }
    s = settle(s);
    expect(ids(s.players.player1.battle)).toEqual(["TST-UNIT-0:fill0", "RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(0);
    expect(ncLogged(s, "RS-059")).toBe(false);
  });

  // 「自分でバトルエリアに出したときと同じように扱います」
  it("R-CN-04: 自軍バトルフェイズ中に相手の効果（ジェットファルコン）で出された自軍ユニットも NC を発動しアタックでき、紐男爵はアタックできなくなる（出典: grnrngr/faq-card-3 RS-141 Q1・RS-135 Q4）", () => {
    let s = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-141", "himo"), inst("RS-059", "blue")], deck: deckCards(3), hand: [] },
      player2: { battle: [inst("RS-135", "jet"), inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-141:himo");
    // 紐拳①: 敵軍ジェットファルコンをラッシュエリアに戻す → ファルコンクロー（player2）で player1 のマジブルーを出す
    // 紐拳②: 敵軍ラッシュエリアのユニットを1体バトルエリアに出す
    for (let i = 0; i < 6 && s.pendingEffectChoice; i++) {
      const pec = s.pendingEffectChoice;
      const target =
        pec.playerId === "player2"
          ? pec.validInstanceIds.includes("RS-059:blue") ? "RS-059:blue" : undefined
          : pec.validInstanceIds[0];
      if (!target || (pec.selectedInstanceIds ?? []).includes(target)) {
        const ok = legal(s).find((a) => a.type === "confirm_effect_choice" && a.playerId === pec.playerId);
        s = ok ? act(s, ok) : act(s, { type: "skip_effect_choice", playerId: pec.playerId } as never);
        continue;
      }
      s = act(s, { type: "resolve_effect_choice", playerId: pec.playerId, instanceId: target } as never);
    }
    expect(zoneOf(s, "player1", "RS-059:blue")).toBe("battle");
    expect(ids(s.players.player1.battle).indexOf("RS-059:blue")).toBe(3);
    // マジブルーは CN2 で4番目なので NC は不発、だがアタックはできる
    expect(attackTargets(s, "RS-059:blue").length).toBeGreaterThan(0);
    expect(attackTargets(s, "RS-141:himo")).toEqual([]);
  });

  // 「「RS-090 レッドレーサー」に続けて…ナンバーコンビネーションを発動することができますか？」「はい」
  it("R-CN-04: ラッシュでバトルエリアに置かれたレッドレーサーに続けて2番目に出した CN2 のユニットは NC を発動する（出典: grnrngr/faq-card-2 RS-090 Q3）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RS-090", "red")],
        rush: [inst("RS-059", "blue")],
        power: powerCards(2),
        command: releasedCommands(1, "TST-OP-OT", "ot"),
        deck: deckCards(3),
      },
    });
    const r = rushWithCategoryHold(s, "player1", "RS-090:red", "TST-OP-OT:ot0");
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
    if (s.pendingBattleEntry) s = passEntry(s);
    s = settle(s);
    expect(ids(s.players.player1.battle)).toEqual(["RS-090:red"]);
    s = act(s, { type: "end_phase", playerId: "player1" });
    const handBefore = s.players.player1.hand.length;
    s = enter(s, "RS-059:blue");
    expect(s.players.player1.hand).toHaveLength(handBefore + 1);
  });

  // 「自軍バトルフェイズに出て並び順が確定したときだけ」
  it("R-CN-04: ラッシュフェイズにバトルエリアへ置かれたレッドレーサー（CN4）は4番目でも NC を発動しない（出典: atwiki/page-267・grnrngr/faq-card-1 RS-014 Q3）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RS-090", "red")],
        battle: fillers(3),
        power: powerCards(2),
        command: releasedCommands(1, "TST-OP-OT", "ot"),
      },
    });
    const r = rushWithCategoryHold(s, "player1", "RS-090:red", "TST-OP-OT:ot0");
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
    expect(ids(s.players.player1.battle).indexOf("RS-090:red")).toBe(3);
    expect(ncLogged(s, "RS-090")).toBe(false);
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-090:red")?.spModifier ?? 0).toBe(0);
  });
});

describe("R-CN-05 コンビネーションの相手", () => {
  // 「直前に出たユニット（左隣のユニット）との間に成立しています」
  it("R-CN-05: バルシャークとの間に別ユニットがあるとバルイーグルの「シャークから」の効果は発動しない（出典: grnrngr/faq-card-1 RS-031 Q1）", () => {
    let s = battleState({
      player1: { battle: [inst("RS-032", "shark"), inst("TST-UNIT-0", "mid")], rush: [inst("RS-031", "eagle")] },
    });
    s = enter(s, "RS-031:eagle");
    expect(ncLogged(s, "RS-031")).toBe(false);
    expect(canStrike(s, "RS-031:eagle")).toBe(false);
  });

  // 「「バルシャーク」「バルイーグル」と並んだときに発動する」
  it("R-CN-05: バルシャークの直後（左隣がシャーク）に出たバルイーグルはナンバーに関係なく効果を発動する（出典: grnrngr/faq-card-1 RS-031 Q1）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-0", "first"), inst("RS-032", "shark")], rush: [inst("RS-031", "eagle")] },
    });
    s = enter(s, "RS-031:eagle");
    expect(canStrike(s, "RS-031:eagle")).toBe(true);
  });

  // 「「順番」と CN は別概念（コロンは CN を変えるが順番を変えない）」
  it("R-CN-05: 敵軍コロンがあると CN3 の S ユニットは3番目では NC せず4番目で NC する（出典: grnrngr/faq-card-1 RS-001 Q1・RS-015 Q2）", () => {
    let third = battleState({
      player1: { battle: fillers(2), rush: [inst("RS-058", "y")] },
      player2: { rush: [inst("RS-140", "colon")] },
    });
    third = enter(third, "RS-058:y");
    expect(ncLogged(third, "RS-058")).toBe(false);
    let fourth = battleState({
      player1: { battle: fillers(3), rush: [inst("RS-058", "y")] },
      player2: { rush: [inst("RS-140", "colon")] },
    });
    fourth = enter(fourth, "RS-058:y");
    expect(ncLogged(fourth, "RS-058")).toBe(true);
  });

  // 「「カードに表記された本来のナンバー」だけです」
  it("R-CN-05: タンクコマンドは本来のナンバーを参照し、コロンで CN が変わったユニットの NC も封じる（出典: grnrngr/faq-card-1 RS-015 Q1）", () => {
    // リリース状態の自軍コマンドに CN2 のユニットカード → 本来のナンバー2 のマジブルーは NC 不可（コロンで CN3 になっていても）
    let s = battleState({
      player1: {
        battle: fillers(2),
        rush: [inst("RS-263", "tank"), inst("RS-059", "blue")],
        command: [inst("RS-059", "cmdblue")],
        deck: deckCards(3),
        hand: [],
      },
      player2: { rush: [inst("RS-140", "colon")] },
    });
    s = enter(s, "RS-059:blue");
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

describe("R-CN-06 NC 効果の期間", () => {
  // 「「このターン」とありますので、相手のターン中は発動していません」
  it("R-CN-06: バルイーグルの「このターン BP＋2000」は次の相手ターンには残らない（出典: grnrngr/faq-card-1 RS-031 Q2）", () => {
    let s = battleState({
      player1: { battle: fillers(4), rush: [inst("RS-031", "eagle")], deck: deckCards(3) },
      player2: { rush: [inst("RS-062", "bred")], deck: deckCards(3, "e") },
    });
    s = passEntry(enter(s, "RS-031:eagle"));
    s = endTurn(s);
    s = toPhase(s, "battle");
    s = enter(s, "RS-062:bred", "player2");
    s = skipChoices(s);
    // ボウケンレッド BP4000 vs バルイーグル BP3000（＋2000 が残っていれば 5000 で勝つ）
    s = settle(attack(s, "RS-062:bred", "RS-031:eagle", "player2"));
    expect(zoneOf(s, "player1", "RS-031:eagle")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-062:bred")).toBe("battle");
  });

  // 「一度発動してしまえば…撃破されても…効果は有効」
  it("R-CN-06: ゼニボムは発動元のデカピンクが撃破されても次の相手ターンに有効（出典: grnrngr/faq-card-2 RS-110 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(4), rush: [inst("RS-110", "pink")], deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-2", "wall")],
        hand: [inst("TST-UNIT-0", "newbie")],
        command: releasedCommands(1, "TST-OP", "wb"),
        deck: deckCards(3, "e"),
      },
    });
    s = enter(s, "RS-110:pink");
    expect(ncLogged(s, "RS-110")).toBe(true);
    s = settle(attack(s, "RS-110:pink", "TST-UNIT-2:wall"));
    expect(zoneOf(s, "player1", "RS-110:pink")).toBe("discard");
    s = endTurn(s);
    s = toPhase(s, "rush");
    const r = rushWithCategoryHold(s, "player2", "TST-UNIT-0:newbie", "TST-OP:wb0");
    expect(r.ok).toBe(true);
    s = settle(r.ok ? r.state : s);
    s = act(s, { type: "end_phase", playerId: "player2" });
    expect(s.phase).toBe("battle");
    expect(legalOfType(s, "move_to_battle").map((a) => a.instanceId)).not.toContain("TST-UNIT-0:newbie");
  });

  it.todo(
    "R-CN-06: 「コンビネーションが成立している間」の効果は一度でも隣り合わなくなれば無効 — 該当テキストのカードがエンジンで成立状態を追跡していないため検証手段なし",
  );
  it.todo(
    "R-CN-06: バキケロナグルスの JC 効果は発動元が撃破されても有効（出典: grnrngr/faq-card-1 RS-018 Q5）— ジョイントコンビネーションと隠流忍術の組み合わせは 07 章 JC のテストで扱う",
  );
});

describe("R-CN-07 NC とアタックは順に処理", () => {
  // 「ナンバーコンビネーションの適用とアタックは…ひとつづつ順番に処理します」
  it("R-CN-07: マジブルーは NC でドローした後に続けてアタックできる（出典: grnrngr/faq-card-1 RS-059 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(1), rush: [inst("RS-059", "blue")], deck: deckCards(3), hand: [] },
      player2: { battle: [inst("TST-UNIT-0", "d")] },
    });
    s = enter(s, "RS-059:blue");
    expect(s.players.player1.hand).toHaveLength(1);
    expect(attackTargets(s, "RS-059:blue")).toEqual(["TST-UNIT-0:d"]);
    s = settle(attack(s, "RS-059:blue", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
  });
});

describe("R-CN-08 CN の下限", () => {
  // 「2以上を減らすときに2で止まるという意味なので、1から増えることはない」
  it("R-CN-08: バードニックウェーブ（CN－1、2未満にならない）下でも CN1 のユニットは1番目で NC を発動する（出典: atwiki/page-1974）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RS-015", "bw")],
        power: powerCards(2),
        command: releasedCommands(1, "TST-OP-ET", "et"),
        rush: [inst("RS-100", "hy")],
        deck: deckCards(3),
      },
    });
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-015:bw" });
    if (s.pendingCommandPayment) {
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-ET:et0"] });
    }
    s = skipChoices(settle(s));
    expect(zoneOf(s, "player1", "RS-015:bw")).not.toBe("hand");
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = enter(s, "RS-100:hy");
    expect(ncLogged(s, "RS-100")).toBe(true);
  });

  // 「ただし、2より少なくならない」
  it("R-CN-08: バードニックウェーブ下で CN3 のユニットは2番目で NC を発動する（2未満にはならないが CN3→2 は有効）（出典: atwiki/page-140・grnrngr/faq-card-1 RS-015 Q2）", () => {
    let s = battleState({
      phase: "rush",
      player1: {
        hand: [inst("RS-015", "bw")],
        power: powerCards(2),
        command: releasedCommands(1, "TST-OP-ET", "et"),
        battle: fillers(1),
        rush: [inst("RS-058", "y")],
      },
    });
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-015:bw" });
    if (s.pendingCommandPayment) {
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-ET:et0"] });
    }
    s = skipChoices(settle(s));
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = enter(s, "RS-058:y");
    expect(ncLogged(s, "RS-058")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §7 カウンター
// ---------------------------------------------------------------------------

describe("R-CTR-01 カウンター", () => {
  // 「これは敵軍ターン中にのみ使用できる」
  it("R-CTR-01: カウンターは自軍ターン中には使用できない（出典: atwiki/page-1295）", () => {
    const rush = battleState({
      phase: "rush",
      player1: { hand: [inst("RS-018", "ninjutsu")], command: releasedCommands(1, "TST-OP-MA", "ma"), power: powerCards(4) },
    });
    expect(canStartCounter(rush, "player1", "RS-018:ninjutsu")).toBe(false);
    expect(legalOfType(rush, "play_operation").map((a) => a.instanceId)).not.toContain("RS-018:ninjutsu");
  });

  // 「当然使用には…自軍コマンドのホールドが必要」
  it("R-CTR-01: リリース状態のコマンドが無ければ、アタックされてもカウンターを使えない（出典: atwiki/page-1295・grnrngr/rule_phase3）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-0", "sub")],
        hand: [inst("RS-018", "ninjutsu")],
        command: heldCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d");
    expect(canStartCounter(s, "player2", "RS-018:ninjutsu")).toBe(false);
  });

  // 「カウンターを使う場合にも、コマンドをホールドする」
  it("R-CTR-01: 敵軍ターン中、条件（アタックされたとき）を満たしコマンドをホールドすればカウンターを使える（出典: atwiki/page-1295・grnrngr/rule_phase3）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-7", "sub")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d");
    expect(canStartCounter(s, "player2", "RS-018:ninjutsu")).toBe(true);
    s = settle(playCounter(s, "player2", "RS-018:ninjutsu", ["TST-OP-MA:ma0"], "TST-UNIT-7:sub"));
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-2:a")).toBe("discard");
  });
});

describe("R-CTR-02 同時に複数枚", () => {
  // 「はい、できます」（1回のアタックに対応カウンターを2枚以上）
  it("R-CTR-02: 1回のアタックに対して隠流忍術を2枚使用できる（出典: grnrngr/faq-card-1 RS-018 Q1・faq-card-4）", () => {
    let s = battleState({
      player1: { battle: [inst("TST-UNIT-2", "a")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-7", "sub1"), inst("TST-UNIT-7", "sub2")],
        hand: [inst("RS-018", "n1"), inst("RS-018", "n2")],
        command: releasedCommands(2, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d");
    s = playCounter(s, "player2", "RS-018:n1", ["TST-OP-MA:ma0"], "TST-UNIT-7:sub1");
    expect(canStartCounter(s, "player2", "RS-018:n2")).toBe(true);
  });
});

describe("R-CTR-03 カウンター封じの期間", () => {
  // 「アタックを宣言してから、自分の次の宣言のタイミングが来るまで」
  it("R-CTR-03: パンサークローでアタックしたバルパンサーに対して相手は隠流忍術もダイノガッツも使えない（出典: grnrngr/faq-card-1 RS-033 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(4), rush: [inst("RS-033", "panther")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-7", "sub")],
        hand: [inst("RS-018", "ninjutsu"), inst("RS-027", "guts")],
        command: [...releasedCommands(1, "TST-OP-MA", "ma"), ...releasedCommands(1, "TST-OP", "wb")],
        power: powerCards(4),
        deck: deckCards(3, "e"),
      },
    });
    s = enter(s, "RS-033:panther");
    s = attack(s, "RS-033:panther", "TST-UNIT-0:d");
    for (let i = 0; i < 10; i++) {
      expect(canStartCounter(s, "player2", "RS-018:ninjutsu")).toBe(false);
      expect(canStartCounter(s, "player2", "RS-027:guts")).toBe(false);
      const pass = legal(s).find((a) => a.playerId === "player2" && a.type.startsWith("pass_"));
      if (!pass) break;
      s = act(s, pass);
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
  });

  // 「自分の次の宣言のタイミングが来るまで」→ 次のアタックには使える
  it("R-CTR-03: バルパンサーのアタック処理後、別ユニットの次のアタックには隠流忍術を使える（出典: grnrngr/faq-card-1 RS-033 Q1）", () => {
    let s = battleState({
      player1: { battle: fillers(4), rush: [inst("RS-033", "panther")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-0", "d2"), inst("TST-UNIT-7", "sub")],
        hand: [inst("RS-018", "ninjutsu")],
        command: releasedCommands(1, "TST-OP-MA", "ma"),
        power: powerCards(4),
      },
    });
    s = enter(s, "RS-033:panther");
    s = settle(attack(s, "RS-033:panther", "TST-UNIT-0:d"));
    s = attack(s, "TST-UNIT-0:fill0", "TST-UNIT-0:d2");
    expect(canStartCounter(s, "player2", "RS-018:ninjutsu")).toBe(true);
  });
});
