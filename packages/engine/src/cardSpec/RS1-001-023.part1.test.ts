/**
 * cardSpec: 英雄の再誕 RS-001〜RS-008
 *
 * 出典（優先順）:
 *  1. docs/rules/08-errata.md / grnrngr faq/card_1.html（公式Q&A）
 *  2. docs/wiki/sources/atwiki/page-N-RS-0NN.md（カードテキスト・atwiki 転載 Q&A）
 *  3. docs/rules/*.md（一般ルール）
 * 期待値は出典に従う。エンジンが違えば it.fails（既知の不具合）として残す。
 */
import { afterEach, describe, expect, it } from "vitest";
import { getSComboFinisher } from "../rules/turnModifierBridge";
import { ON_RUSH_EFFECTS } from "../rules/rushEffects";
import {
  act,
  actLegal,
  bpOf,
  canPlayOp,
  canUseCounter,
  cardDef,
  deckCards,
  engineText,
  expectSourceText,
  hasLegal,
  held,
  inst,
  legal,
  legalOfType,
  playCounter,
  playOp,
  powerCards,
  released,
  specState,
  spOf,
  zoneIds,
  zoneOf,
} from "./RS1-001-023.helpers";
import type { GameState } from "../types/game";

/** バトルエリアへ出し、進入時の行動選択（アタック／ストライク／何もしない）を「何もしない」で閉じる。 */
function enter(s: GameState, instanceId: string, playerId: "player1" | "player2" = "player1"): GameState {
  let n = actLegal(s, (a) => a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === instanceId);
  for (let i = 0; i < 6 && hasLegal(n, (a) => a.type === "pass_battle_entry"); i += 1) {
    n = actLegal(n, (a) => a.type === "pass_battle_entry");
  }
  return n;
}

/** ラッシュフェイズで手札のオペレーションを使い、バトルフェイズへ進める。 */
function playThenBattle(s: GameState, opId: string): GameState {
  let n = playOp(s, opId);
  n = actLegal(n, (a) => a.type === "end_phase");
  expect(n.phase).toBe("battle");
  return n;
}

// ===========================================================================
describe("RS-001 ゴレンジャーストーム", () => {
  const TEXT =
    "このターン、Sユニットだけでコンビネーションするとき、5番目のユニットは「SP1」「BP12000」になる。";

  function gorenState(lineIds: string[], extra: { p2?: Parameters<typeof specState>[1]["player2"] } = {}) {
    const op = inst("RS-001", "op");
    const units = lineIds.map((id, i) => inst(id, `u${i}`));
    const s = specState(["RS-001", "RS-140"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(8), command: [held("TST-OP-ET", "c1")], rush: units },
      player2: extra.p2,
    });
    return { s, op, units };
  }

  it("RS-001: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-246）", () => {
    // 「5番目のユニットは「SP1」「BP12000」になる」
    expectSourceText("RS-001", TEXT);
    expect(cardDef("RS-001")?.powerCost).toBe(8);
    expect(cardDef("RS-001")?.category).toBe("ET");
  });

  it("RS-001: 必要パワー8 — パワー7では使用できない（出典: atwiki/page-246 必要パワー：8）", () => {
    const op = inst("RS-001", "op");
    const s = specState(["RS-001"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(7), command: [held("TST-OP-ET", "c1")] },
    });
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-001: Sユニットだけのコンビネーションで5番目がBP12000になる（出典: atwiki/page-246）", () => {
    // 「5番目のユニットは…「BP12000」になる」
    const { s: s0, op, units } = gorenState(["CS-S1", "CS-S1", "CS-S1", "CS-S1", "CS-S1"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(12000);
    expect(bpOf(s, "player1", units[3]!.instanceId)).toBe(1000);
  });

  it("RS-001: 5番目は「SP1」に“なる”（元のSPが2でもSP1）（出典: atwiki/page-246）", () => {
    const { s: s0, op, units } = gorenState(["CS-S1", "CS-S1", "CS-S1", "CS-S1", "CS-S2"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(spOf(s, "player1", units[4]!.instanceId)).toBe(1);
  });

  it("RS-001: SPを持たないSユニットも5番目でSP1になる（出典: atwiki/page-246）", () => {
    const { s: s0, op, units } = gorenState(["CS-S1", "CS-S1", "CS-S1", "CS-S1", "CS-S-NOSP"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(spOf(s, "player1", units[4]!.instanceId)).toBe(1);
  });

  it("RS-001: Mユニットを含むコンビネーションでは5番目は変化しない（出典: atwiki/page-246 「Sユニットだけで」）", () => {
    const { s: s0, op, units } = gorenState(["CS-S1", "CS-M", "CS-S1", "CS-S1", "CS-S1"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(1000);
  });

  it("RS-001: 「BP12000になる」は他の増減より優先（オーラパワーの上昇があっても12000）（出典: R-BP-01、atwiki/page-246 カード評価）", () => {
    const aura = inst("RS-011", "aura");
    const { s: s0, op, units } = gorenState(["CS-S1", "CS-S1", "CS-S1", "CS-S1", "CS-S1"]);
    let s: GameState = {
      ...s0,
      players: {
        ...s0.players,
        player1: {
          ...s0.players.player1,
          damage: 2,
          hand: [...s0.players.player1.hand, aura],
          power: powerCards(10),
          command: [held("TST-OP-ET", "c1"), held("TST-OP-MA", "c2")],
        },
      },
    };
    s = playOp(s, aura.instanceId, { targetInstanceId: units[4]!.instanceId });
    s = playThenBattle(s, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(12000);
  });

  it("RS-001: 効果は「このターン」だけ（次のターンには残らない）（出典: atwiki/page-246 「このターン、」）", () => {
    const { s: s0, op } = gorenState([]);
    let s = playOp(s0, op.instanceId);
    expect(getSComboFinisher(s.players.player1)).toBe("goren_storm");
    s = actLegal(s, (a) => a.type === "end_phase"); // → battle
    s = actLegal(s, (a) => a.type === "end_phase"); // → end
    for (let i = 0; i < 10 && s.activePlayer === "player1"; i += 1) {
      s = actLegal(s, (a) => a.type === "end_phase" || a.type === "draw" || a.type === "return_all_battle_to_rush");
    }
    expect(getSComboFinisher(s.players.player1)).toBeUndefined();
  });

  it("RS-001: 公式Q&A — コロンでコンビネーションナンバーが増えても5番目なら効果を得る（出典: grnrngr/faq-card-1 RS-001 Q1）", () => {
    // 「コンビネーションナンバーに関わらず効果を得ることができます」
    const colon = inst("RS-140", "colon");
    const { s: s0, op, units } = gorenState(["CS-S1", "CS-S1", "CS-S1", "CS-S1", "CS-S1"], {
      p2: { rush: [colon] },
    });
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(12000);
  });
});

// ===========================================================================
describe("RS-002 ジャッカーハリケーン", () => {
  // atwiki の写しは「SP1「BP8000」」（SP1 にカギ括弧なし）。RS-001 と同形の「「SP1」「BP8000」」が正しいと判断し、
  // カギ括弧の有無だけは比較から外す（仕様の疑義として報告）。
  const TEXT = "このターン、Sユニットだけでコンビネーションするとき、4番目のユニットはSP1「BP8000」になる。";

  function jackerState(lineIds: string[], p2: Parameters<typeof specState>[1]["player2"] = undefined) {
    const op = inst("RS-002", "op");
    const units = lineIds.map((id, i) => inst(id, `u${i}`));
    const s = specState(["RS-002", "RS-003", "RS-140"], {
      phase: "rush",
      player1: {
        hand: [op],
        power: powerCards(6),
        command: [held("TST-OP-ET", "c1"), released("TST-OP-ET", "r1"), released("TST-OP-ET", "r2")],
        rush: units,
        operation: [inst("RS-003", "bd")],
      },
      player2: p2,
    });
    return { s, op, units };
  }

  it("RS-002: カタログ本文が atwiki 本文と一致する（カギ括弧の有無は除く）（出典: atwiki/page-247）", () => {
    // 「4番目のユニットはSP1「BP8000」になる」
    expect(cardDef("RS-002")).toBeDefined();
    const strip = (t: string) => t.normalize("NFKC").replace(/\s+/g, "").replace(/[「」]/g, "");
    expect(strip(engineText("RS-002"))).toBe(strip(TEXT));
    expect(cardDef("RS-002")?.powerCost).toBe(6);
  });

  it("RS-002: 必要パワー6 — パワー5では使用できない（出典: atwiki/page-247 必要パワー：6）", () => {
    const op = inst("RS-002", "op");
    const s = specState(["RS-002"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(5), command: [held("TST-OP-ET", "c1")] },
    });
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-002: Sユニットだけのコンビネーションで4番目がBP8000になる（出典: atwiki/page-247）", () => {
    const { s: s0, op, units } = jackerState(["CS-S1", "CS-S1", "CS-S1", "CS-S1"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[3]!.instanceId)).toBe(8000);
    expect(bpOf(s, "player1", units[2]!.instanceId)).toBe(1000);
  });

  it("RS-002: 4番目は「SP1」に“なる”（元のSPが2でもSP1）（出典: atwiki/page-247）", () => {
    const { s: s0, op, units } = jackerState(["CS-S1", "CS-S1", "CS-S1", "CS-S2"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(spOf(s, "player1", units[3]!.instanceId)).toBe(1);
  });

  it("RS-002: Mユニットを含むコンビネーションでは4番目は変化しない（出典: atwiki/page-247 「Sユニットだけで」）", () => {
    const { s: s0, op, units } = jackerState(["CS-S1", "CS-M", "CS-S1", "CS-S1"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[3]!.instanceId)).toBe(1000);
  });

  it("RS-002: 公式Q&A — コロンでナンバーが増えても4番目なら効果を得る（出典: grnrngr/faq-card-1 RS-002 Q1）", () => {
    // 「コンビネーションナンバーに関わらず効果を得ることができます」
    const { s: s0, op, units } = jackerState(["CS-S1", "CS-S1", "CS-S1", "CS-S1"], {
      rush: [inst("RS-140", "colon")],
    });
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    expect(bpOf(s, "player1", units[3]!.instanceId)).toBe(8000);
  });

  it("RS-002: 公式Q&A — 途中でユニットが抜けた後は、新たに4番目になったユニットに有効（出典: grnrngr/faq-card-1 RS-002 Q2）", () => {
    // 「常にバトルエリアで４番目のユニットに対して有効になります」
    const { s: s0, op, units } = jackerState(["CS-S1", "CS-S1", "CS-S1", "CS-S1", "CS-S1"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units.slice(0, 4)) s = enter(s, u.instanceId);
    // バトルダンスで1番目を抜く（4番目だったユニットは3番目になる）
    s = actLegal(s, (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === units[0]!.instanceId);
    s = enter(s, units[4]!.instanceId);
    expect(zoneIds(s, "player1", "battle").indexOf(units[4]!.instanceId)).toBe(3);
    expect(bpOf(s, "player1", units[4]!.instanceId)).toBe(8000);
  });

  it("RS-002: 公式Q&A — 4番目でなくなったユニットは効果を失う（出典: grnrngr/faq-card-1 RS-002 Q2）", () => {
    const { s: s0, op, units } = jackerState(["CS-S1", "CS-S1", "CS-S1", "CS-S1"]);
    let s = playThenBattle(s0, op.instanceId);
    for (const u of units) s = enter(s, u.instanceId);
    s = actLegal(s, (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === units[0]!.instanceId);
    expect(bpOf(s, "player1", units[3]!.instanceId)).toBe(1000);
  });
});


// ===========================================================================
describe("RS-003 バトルダンス", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分のバトルフェイズに発動できる。自軍コマンドを２つホールドして、自軍Ｓユニットを１体ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。";

  function danceState(opts: { battle: ReturnType<typeof inst>[]; rush?: ReturnType<typeof inst>[]; released: number; phase?: "battle" | "rush"; active?: "player1" | "player2" }) {
    return specState(["RS-003"], {
      phase: opts.phase ?? "battle",
      activePlayer: opts.active ?? "player1",
      player1: {
        operation: [inst("RS-003", "bd")],
        battle: opts.battle,
        rush: opts.rush ?? [],
        command: Array.from({ length: opts.released }, (_, i) => released("TST-OP-ET", `r${i}`)),
      },
      player2: { battle: [inst("CS-S1", "e1")] },
    });
  }

  it("RS-003: カタログ本文がエラッタ後の正文と一致する（出典: grnrngr/errata RS-003、docs/rules/08-errata.md R-ERR-RS003）", () => {
    // 正:「自軍コマンドを２つホールドして、自軍Ｓユニットを１体ラッシュエリアに戻してもよい」
    expectSourceText("RS-003", TEXT);
    expect(cardDef("RS-003")?.tags).toContain("常駐");
  });

  it("RS-003: ※常駐 — 使用すると常駐置き場に配置される（出典: atwiki/page-248 ※常駐）", () => {
    const op = inst("RS-003", "op");
    let s = specState(["RS-003"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(3), command: [held("TST-OP-ET", "c1")] },
    });
    s = playOp(s, op.instanceId);
    expect(zoneOf(s, "player1", op.instanceId)).toBe("operation");
  });

  it("RS-003: リリース状態のコマンド2つをホールドしてSユニット1体をラッシュエリアに戻す（出典: grnrngr/errata RS-003）", () => {
    const u = inst("CS-S1", "u");
    let s = danceState({ battle: [u], released: 2 });
    s = actLegal(s, (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === u.instanceId);
    expect(zoneOf(s, "player1", u.instanceId)).toBe("rush");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RS-003: リリース状態のコマンドが1つでは発動できない（出典: grnrngr/errata RS-003 「２つホールドして」）", () => {
    const s = danceState({ battle: [inst("CS-S1", "u")], released: 1 });
    expect(legalOfType(s, "battle_dance_retreat")).toHaveLength(0);
  });

  it("RS-003: 戻せるのはSユニットだけ（Mユニットは選べない）（出典: grnrngr/errata RS-003 「自軍Ｓユニットを１体」）", () => {
    const m = inst("CS-M", "m");
    const s = danceState({ battle: [m], released: 2 });
    expect(legalOfType(s, "battle_dance_retreat").some((a) => a.battleInstanceId === m.instanceId)).toBe(false);
  });

  it("RS-003: 自分のバトルフェイズ以外（ラッシュフェイズ）では発動できない（出典: grnrngr/errata RS-003 「自分のバトルフェイズに」）", () => {
    const s = danceState({ battle: [inst("CS-S1", "u")], released: 2, phase: "rush" });
    expect(legalOfType(s, "battle_dance_retreat")).toHaveLength(0);
  });

  it("RS-003: 相手のバトルフェイズには発動できない（出典: grnrngr/errata RS-003 「自分のバトルフェイズに」）", () => {
    const s = danceState({ battle: [inst("CS-S1", "u")], released: 2, active: "player2" });
    expect(legalOfType(s, "battle_dance_retreat").some((a) => a.playerId === "player1")).toBe(false);
  });

  it("RS-003: 戻したユニットはこのターン再びバトルエリアに出られない（出典: grnrngr/errata RS-003 「ただし、戻したユニットは…」）", () => {
    const u = inst("CS-S1", "u");
    let s = danceState({ battle: [u], released: 2 });
    s = actLegal(s, (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === u.instanceId);
    expect(hasLegal(s, (a) => a.type === "move_to_battle" && a.instanceId === u.instanceId)).toBe(false);
  });

  it("RS-003: 公式Q&A — リリース状態のコマンドが4つあれば2体まで戻せる（繰り返し発動）（出典: grnrngr/faq-card-1 RS-003 Q1）", () => {
    // 「コマンドをホールドできる限り、繰り返し発動できます」
    const u1 = inst("CS-S1", "u1");
    const u2 = inst("CS-S1", "u2");
    let s = danceState({ battle: [u1, u2], released: 4 });
    s = actLegal(s, (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === u1.instanceId);
    s = actLegal(s, (a) => a.type === "battle_dance_retreat" && a.battleInstanceId === u2.instanceId);
    expect(zoneIds(s, "player1", "rush")).toEqual(expect.arrayContaining([u1.instanceId, u2.instanceId]));
    expect(legalOfType(s, "battle_dance_retreat")).toHaveLength(0);
  });

  it("RS-003: atwiki Q&A — 出したユニットの行動（アタック／ストライク／何もしない）を選ぶ前には発動できない（出典: atwiki/page-248 Q2）", () => {
    // 「1体のユニットの行動中は、他の任意に発動する行動は行えません」
    const u = inst("CS-S1", "u");
    let s = danceState({ battle: [], rush: [u], released: 2 });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: u.instanceId });
    expect(s.pendingBattleEntry).toBeDefined();
    expect(legalOfType(s, "battle_dance_retreat")).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-004 デンジマシーン", () => {
  const TEXT =
    "自軍山札の上から3枚をオモテにして相手に見せる。その中からSユニットのカードをすべて手札に加え、それ以外は好きな順で山札の下に戻す。";

  function denjiState(deck: ReturnType<typeof inst>[], powerN = 4) {
    const op = inst("RS-004", "op");
    const s = specState(["RS-004"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(powerN), command: [held("TST-OP-OT", "c1")], deck },
    });
    return { s, op };
  }

  it("RS-004: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-274）", () => {
    expectSourceText("RS-004", TEXT);
    expect(cardDef("RS-004")?.powerCost).toBe(4);
  });

  it("RS-004: 必要パワー4 — パワー3では使用できない（出典: atwiki/page-274 必要パワー：4）", () => {
    const { s, op } = denjiState(deckCards(5), 3);
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-004: 上から3枚を相手に見せる（出典: atwiki/page-274 「オモテにして相手に見せる」）", () => {
    const d = [inst("CS-S1", "a"), inst("CS-M", "b"), inst("TST-OP", "c"), inst("TST-OP", "d")];
    const { s: s0, op } = denjiState(d);
    const s = playOp(s0, op.instanceId);
    expect(s.pendingEffectChoice?.denjiMachineMeta?.audiencePlayerIds).toContain("player2");
    expect(s.pendingEffectChoice?.denjiMachineMeta?.revealedCards?.map((c) => c.instanceId)).toEqual(
      d.slice(0, 3).map((c) => c.instanceId),
    );
  });

  it("RS-004: Sユニットはすべて手札、それ以外は好きな順で山札の下へ（出典: atwiki/page-274）", () => {
    const sA = inst("CS-S1", "sa");
    const m = inst("CS-M", "m");
    const op2 = inst("TST-OP", "o");
    const rest = inst("TST-OP", "rest");
    const { s: s0, op } = denjiState([sA, m, op2, rest]);
    let s = playOp(s0, op.instanceId);
    s = act(s, { type: "confirm_denji_reveal", playerId: "player1" });
    expect(zoneOf(s, "player1", sA.instanceId)).toBe("hand");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: op2.instanceId });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: m.instanceId });
    expect(zoneIds(s, "player1", "deck")).toEqual([rest.instanceId, op2.instanceId, m.instanceId]);
  });

  it("RS-004: 公式Q&A — 山札2枚以下では効果は発動しない（出典: grnrngr/faq-card-1 RS-004）", () => {
    // 「いいえ、できません」
    const d = [inst("CS-S1", "a"), inst("CS-S1", "b")];
    const { s: s0, op } = denjiState(d);
    if (!canPlayOp(s0, op.instanceId)) return; // 使用自体できない実装なら発動もしない
    const s = playOp(s0, op.instanceId);
    expect(s.pendingEffectChoice?.effectId).not.toBe("denji_machine");
    expect(zoneIds(s, "player1", "deck")).toEqual(d.map((c) => c.instanceId));
  });

  it("RS-004: 公式Q&A — 山札2枚以下でもコマンドのホールドや手札を減らす目的で使用でき、捨札になる（出典: grnrngr/faq-card-1 RS-004）", () => {
    // 「発動したものとして捨札にする）ことはできます」
    const { s: s0, op } = denjiState([inst("CS-S1", "a"), inst("CS-S1", "b")]);
    const s = playOp(s0, op.instanceId);
    expect(zoneOf(s, "player1", op.instanceId)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-005 ランドバルカン", () => {
  const TEXT =
    "自軍コマンドゾーンからリリース状態のSユニットのカードを2枚まで選び、ラッシュエリアに出してもよい。ただし、ラッシュするための必要パワーと追加条件は満たすこと。";
  const FX = "CS-S1";

  afterEach(() => {
    delete ON_RUSH_EFFECTS[FX];
  });

  function balkanState(command: ReturnType<typeof inst>[], powerN = 3, p2: Parameters<typeof specState>[1]["player2"] = undefined) {
    const op = inst("RS-005", "op");
    const s = specState(["RS-005", "RS-026"], {
      phase: "rush",
      player1: {
        hand: [op],
        power: powerCards(powerN),
        command: [held("TST-OP-ET", "pay"), ...command],
        deck: deckCards(3),
      },
      player2: p2,
    });
    return { s, op };
  }

  /** 効果ラッシュの選択が出たら候補を順に選び、確定する。 */
  function resolveBalkan(s: GameState, picks: string[]): GameState {
    let n = s;
    for (const id of picks) {
      if (n.pendingEffectChoice && hasLegal(n, (a) => a.type === "resolve_effect_choice" && a.instanceId === id)) {
        n = act(n, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
      }
    }
    if (n.pendingEffectChoice && hasLegal(n, (a) => a.type === "confirm_effect_choice")) {
      n = actLegal(n, (a) => a.type === "confirm_effect_choice");
    }
    return n;
  }

  it("RS-005: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-249）", () => {
    expectSourceText("RS-005", TEXT);
    expect(cardDef("RS-005")?.powerCost).toBe(3);
  });

  it("RS-005: リリース状態のSユニットのカードをラッシュエリアに出す（出典: atwiki/page-249）", () => {
    const c = released("CS-S1", "cmdS");
    const { s: s0, op } = balkanState([c]);
    const s = resolveBalkan(playOp(s0, op.instanceId), [c.instanceId]);
    expect(zoneOf(s, "player1", c.instanceId)).toBe("rush");
  });

  it("RS-005: 2枚まで出せる（出典: atwiki/page-249 「2枚まで選び」）", () => {
    const c1 = released("CS-S1", "s1");
    const c2 = released("CS-S1", "s2");
    const c3 = released("CS-S1", "s3");
    const { s: s0, op } = balkanState([c1, c2, c3]);
    const s = resolveBalkan(playOp(s0, op.instanceId), [c1.instanceId, c2.instanceId, c3.instanceId]);
    expect(s.players.player1.rush).toHaveLength(2);
  });

  it("RS-005: ホールド状態のSユニットのカードは選べない（出典: atwiki/page-249 「リリース状態の」）", () => {
    const h = held("CS-S1", "hS");
    const { s: s0, op } = balkanState([h]);
    const s = resolveBalkan(playOp(s0, op.instanceId), [h.instanceId]);
    expect(zoneOf(s, "player1", h.instanceId)).toBe("command");
  });

  it("RS-005: Mユニットのカードは選べない（出典: atwiki/page-249 「Sユニットのカード」）", () => {
    const m = released("CS-M", "m");
    const { s: s0, op } = balkanState([m]);
    const s = resolveBalkan(playOp(s0, op.instanceId), [m.instanceId]);
    expect(zoneOf(s, "player1", m.instanceId)).toBe("command");
  });

  it("RS-005: 必要パワーを満たさないSユニットは出せない（出典: atwiki/page-249 「必要パワーと追加条件は満たすこと」）", () => {
    const big = released("CS-S-ET9", "big");
    const { s: s0, op } = balkanState([big], 3);
    const s = resolveBalkan(playOp(s0, op.instanceId), [big.instanceId]);
    expect(zoneOf(s, "player1", big.instanceId)).toBe("command");
  });

  it("RS-005: 公式Q&A — 先に2枚まで選び1枚ずつ出す。1枚目を出した後、2枚目は出さない選択ができる（出典: grnrngr/faq-card-1 RS-005 Q1）", () => {
    // 「「１枚目でカウンターを受けたので、２枚目はラッシュしない」という選択も可能」
    const c1 = released("CS-S1", "s1");
    const c2 = released("CS-S1", "s2");
    const c3 = released("CS-S1", "s3");
    const { s: s0, op } = balkanState([c1, c2, c3]);
    let s = playOp(s0, op.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: c1.instanceId });
    if (s.pendingEffectChoice) s = actLegal(s, (a) => a.type === "skip_effect_choice");
    expect(zoneOf(s, "player1", c1.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", c2.instanceId)).toBe("command");
    expect(zoneOf(s, "player1", c3.instanceId)).toBe("command");
  });

  it("RS-005: 「出してもよい」— 候補が2枚以下でも、出さない（1枚だけ出す）選択ができる（出典: atwiki/page-249、grnrngr/faq-card-1 RS-005 Q1）", () => {
    const c1 = released("CS-S1", "s1");
    const c2 = released("CS-S1", "s2");
    const { s: s0, op } = balkanState([c1, c2]);
    let s = playOp(s0, op.instanceId);
    if (s.pendingEffectChoice) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: c1.instanceId });
      if (s.pendingEffectChoice) s = actLegal(s, (a) => a.type === "skip_effect_choice");
    }
    expect(zoneOf(s, "player1", c2.instanceId)).toBe("command");
  });

  it("RS-005: 公式Q&A — 出したユニットの「ラッシュしたとき」が発動し、「ラッシュされたとき」のカウンターも使える（出典: grnrngr/faq-card-1 RS-005 Q2）", () => {
    // 「「ラッシュしたとき」の効果は発動しますし…カウンタを発動させることもできます」
    ON_RUSH_EFFECTS[FX] = "draw_1";
    const c = released(FX, "fx");
    const { s: s0, op } = balkanState([c], 3, {
      hand: [inst("RS-026", "ninpo")],
      command: [released("TST-OP-MA", "ma")],
      power: powerCards(3, "e"),
    });
    const s = resolveBalkan(playOp(s0, op.instanceId), [c.instanceId]);
    expect(zoneOf(s, "player1", c.instanceId)).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(2);
    expect(s.pendingRush?.rushedInstanceId).toBe(c.instanceId);
    expect(canUseCounter(s, "player2", "RS-026:ninpo")).toBe(true);
  });

  it("RS-005: 公式Q&A — 同じカテゴリのコマンドをホールドしなくても出せる（出典: grnrngr/faq-card-1 RS-005 Q3）", () => {
    // 「コマンドをホールドしなくてもラッシュエリアに出すことができます」
    const c = released("CS-S-ET3", "et");
    const op = inst("RS-005", "op");
    let s = specState(["RS-005"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(3), command: [held("TST-OP-ET", "pay"), c] },
    });
    s = resolveBalkan(playOp(s, op.instanceId), [c.instanceId]);
    expect(zoneOf(s, "player1", c.instanceId)).toBe("rush");
    expect(s.players.player1.command.filter((x) => !x.commandHeld)).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-006 新体操アクション", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる）自軍Sユニットがアタックされたとき発動できる。⇒アタックされたユニットをラッシュエリアに戻す。このときバトルは行われない。";

  function attackState(defender: ReturnType<typeof inst>, opts: { defenderInRush?: boolean; attacker?: ReturnType<typeof inst> } = {}) {
    const attacker = opts.attacker ?? inst("CS-BIG", "atk");
    const counter = inst("RS-006", "gym");
    const s = specState(["RS-006"], {
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: {
        battle: opts.defenderInRush ? [] : [defender],
        rush: opts.defenderInRush ? [defender] : [],
        hand: [counter],
        command: [released("TST-OP-ET", "pay")],
        power: powerCards(1, "e"),
      },
    });
    return { s, attacker, counter };
  }

  it("RS-006: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-250）", () => {
    expectSourceText("RS-006", TEXT);
    expect(cardDef("RS-006")?.tags).toContain("カウンター");
  });

  it("RS-006: ※カウンター — 自軍ターン中に手札から使用できない（出典: atwiki/page-250 ※カウンター）", () => {
    const op = inst("RS-006", "op");
    const s = specState(["RS-006"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(3), command: [held("TST-OP-ET", "c")] },
    });
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-006: 自軍Sユニットがアタックされたとき、そのユニットをラッシュエリアに戻しバトルは行われない（出典: atwiki/page-250）", () => {
    const def = inst("CS-S1", "def");
    const { s: s0, attacker, counter } = attackState(def);
    let s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: attacker.instanceId, defenderInstanceId: def.instanceId });
    expect(canUseCounter(s, "player2", counter.instanceId)).toBe(true);
    s = playCounter(s, "player2", counter.instanceId);
    expect(zoneOf(s, "player2", def.instanceId)).toBe("rush");
    expect(zoneOf(s, "player2", counter.instanceId)).toBe("discard");
    expect(zoneOf(s, "player1", attacker.instanceId)).toBe("battle");
    expect(s.pendingBattle).toBeUndefined();
  });

  it("RS-006: アタックされたのがMユニットなら使えない（出典: atwiki/page-250 「自軍Sユニットが」）", () => {
    const def = inst("CS-M", "def");
    const { s: s0, attacker, counter } = attackState(def);
    const s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: attacker.instanceId, defenderInstanceId: def.instanceId });
    expect(canUseCounter(s, "player2", counter.instanceId)).toBe(false);
  });

  it("RS-006: 公式Q&A — ラッシュエリアのユニットがアタックされたときはバトルを回避できない（出典: grnrngr/faq-card-1 RS-006）", () => {
    // 「前提条件を満たさないので、「このとき」以下のテキストは無効になります」
    const def = inst("CS-S1", "def");
    const yellow = { ...inst("RS-058", "yellow"), activatedNcEffects: ["yellow_thunder"] };
    const { s: s0, counter } = attackState(def, { defenderInRush: true, attacker: yellow });
    let s = act(s0, { type: "battle", playerId: "player1", attackerInstanceId: yellow.instanceId, defenderInstanceId: def.instanceId });
    if (canUseCounter(s, "player2", counter.instanceId)) {
      s = playCounter(s, "player2", counter.instanceId);
    }
    for (let i = 0; i < 6; i += 1) {
      const pass = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    // バトルは行われ、BP1000 の防御側は BP3000 のマジイエローに撃破される
    expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-007 ダイナマイトパワー", () => {
  const TEXT =
    "BP8000以下の敵軍ユニットを1体選ぶ。選んだユニットを持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。（コマンドゾーンに置けるカードは通常5枚まで）";

  function dynState(target: ReturnType<typeof inst>, opts: { zone?: "battle" | "rush"; enemyCommand?: number; powerN?: number } = {}) {
    const op = inst("RS-007", "op");
    const zone = opts.zone ?? "battle";
    const s = specState(["RS-007"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(opts.powerN ?? 6), command: [held("TST-OP-ET", "c1")] },
      player2: {
        [zone]: [target],
        command: Array.from({ length: opts.enemyCommand ?? 0 }, (_, i) => released("TST-OP", `ec${i}`)),
      },
    });
    return { s, op };
  }

  it("RS-007: カタログ本文が atwiki 本文と一致する（注釈「（コマンドゾーンに置けるカードは通常5枚まで）」を含む）（出典: atwiki/page-251）", () => {
    expectSourceText("RS-007", TEXT);
  });

  it("RS-007: 必要パワー6 — パワー5では使用できない（出典: atwiki/page-251 必要パワー：6）", () => {
    const { s, op } = dynState(inst("CS-S1", "t"), { powerN: 5 });
    expect(canPlayOp(s, op.instanceId)).toBe(false);
  });

  it("RS-007: BP8000以下の敵軍ユニットを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-251）", () => {
    const t = inst("CS-S1", "t");
    const { s: s0, op } = dynState(t);
    const s = playOp(s0, op.instanceId, { targetInstanceId: t.instanceId });
    const placed = s.players.player2.command.find((c) => c.instanceId === t.instanceId);
    expect(placed?.commandHeld).toBe(true);
  });

  it("RS-007: 敵軍ラッシュエリアのユニットも選べる（出典: atwiki/page-251 「敵軍ユニットを1体選ぶ」）", () => {
    const t = inst("CS-S1", "t");
    const { s: s0, op } = dynState(t, { zone: "rush" });
    const s = playOp(s0, op.instanceId, { targetInstanceId: t.instanceId });
    expect(zoneOf(s, "player2", t.instanceId)).toBe("command");
  });

  it("RS-007: BP8000を超える敵軍ユニットは選べない（出典: atwiki/page-251 「BP8000以下の」）", () => {
    const t = inst("CS-BIG", "t");
    const { s, op } = dynState(t);
    expect(
      legalOfType(s, "play_operation").some((a) => a.instanceId === op.instanceId && a.targetInstanceId === t.instanceId),
    ).toBe(false);
  });

  it("RS-007: コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-251 「置けなければ捨札にする」）", () => {
    const t = inst("CS-S1", "t");
    const { s: s0, op } = dynState(t, { enemyCommand: 5 });
    const s = playOp(s0, op.instanceId, { targetInstanceId: t.instanceId });
    expect(zoneOf(s, "player2", t.instanceId)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-008 超電子頭脳", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分はドローするとき2枚ひいて、そのうちの1枚を手札に加え、もう1枚を捨札にする。";

  it("RS-008: カタログ本文が atwiki 本文と一致する（出典: atwiki/page-275）", () => {
    expectSourceText("RS-008", TEXT);
    expect(cardDef("RS-008")?.tags).toContain("常駐");
  });

  it("RS-008: ※常駐 — 使用すると常駐置き場に配置される（出典: atwiki/page-275 ※常駐）", () => {
    const op = inst("RS-008", "op");
    let s = specState(["RS-008"], {
      phase: "rush",
      player1: { hand: [op], power: powerCards(1), command: [held("TST-OP-OT", "c")] },
    });
    s = playOp(s, op.instanceId);
    expect(zoneOf(s, "player1", op.instanceId)).toBe("operation");
  });

  function brainDraw(deck: ReturnType<typeof inst>[]) {
    let s = specState(["RS-008"], {
      phase: "start",
      player1: { operation: [inst("RS-008", "brain")], deck },
    });
    s = act(s, { type: "draw", playerId: "player1" });
    return s;
  }

  it("RS-008: ドローするとき2枚ひいて1枚を手札、1枚を捨札にする（出典: atwiki/page-275）", () => {
    const d = [inst("CS-S1", "a"), inst("CS-M", "b"), inst("TST-OP", "c")];
    let s = brainDraw(d);
    if (s.pendingEffectChoice) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: d[1]!.instanceId });
      if (s.pendingEffectChoice && hasLegal(s, (a) => a.type === "confirm_effect_choice")) {
        s = actLegal(s, (a) => a.type === "confirm_effect_choice");
      }
    }
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.discard).toHaveLength(1);
    expect(zoneIds(s, "player1", "deck")).toEqual([d[2]!.instanceId]);
  });

  it("RS-008: どちらを手札に加えるかは自分が選ぶ（出典: atwiki/page-275 「そのうちの1枚を手札に加え」）", () => {
    const d = [inst("CS-S1", "a"), inst("CS-M", "b"), inst("TST-OP", "c")];
    const s = brainDraw(d);
    expect(s.pendingEffectChoice).toBeDefined();
    expect(legalOfType(s, "resolve_effect_choice").map((a) => a.instanceId)).toEqual(
      expect.arrayContaining([d[0]!.instanceId, d[1]!.instanceId]),
    );
  });

  it("RS-008: 公式Q&A — マジブルーの効果によるドローでも発動する（出典: grnrngr/faq-card-1 RS-008 Q1）", () => {
    // 「はい、発動します」
    const blue = inst("RS-059", "blue");
    const d = deckCards(4);
    let s = specState(["RS-008", "RS-059"], {
      phase: "battle",
      player1: {
        operation: [inst("RS-008", "brain")],
        battle: [inst("CS-S1", "f1")],
        rush: [blue],
        deck: d,
      },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId });
    // 2枚ひいて選ぶ（超電子頭脳）
    expect(s.players.player1.deck.length).toBe(2);
  });

  it("RS-008: 公式Q&A — 追加ドローのときにも発動する（出典: grnrngr/faq-card-1 RS-008 Q1）", () => {
    // 「はい、発動します」
    let s = specState(["RS-008"], {
      phase: "start",
      player1: { operation: [inst("RS-008", "brain")], deck: deckCards(6), damage: 3 },
    });
    s = act(s, { type: "draw", playerId: "player1" });
    for (let i = 0; i < 3 && s.pendingEffectChoice; i += 1) {
      const pick = legalOfType(s, "resolve_effect_choice")[0];
      if (!pick) break;
      s = act(s, pick);
      if (s.pendingEffectChoice && hasLegal(s, (a) => a.type === "confirm_effect_choice")) s = actLegal(s, (a) => a.type === "confirm_effect_choice");
    }
    const before = s.players.player1.deck.length;
    const bonus = legal(s).find((a) => a.type === "bonus_draw");
    expect(bonus).toBeDefined();
    s = act(s, bonus!);
    expect(before - s.players.player1.deck.length).toBe(2);
  });

  it("RS-008: 公式Q&A — ダイノガッツでカードを「ひく」だけでは発動しない（出典: grnrngr/faq-card-1 RS-008 Q2）", () => {
    // 「「ドローするとき」の効果は「カードをひく」だけでは発動しません」
    const unit = inst("TST-UNIT-2", "u"); // 必要パワー2
    const guts = inst("RS-027", "guts");
    let s = specState(["RS-008", "RS-027"], {
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [inst("CS-BIG", "atk")] },
      player2: {
        operation: [inst("RS-008", "brain")],
        battle: [unit],
        hand: [guts],
        deck: deckCards(5, "e"),
        command: [released("TST-OP", "pay")],
      },
    });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: "CS-BIG:atk", defenderInstanceId: unit.instanceId });
    for (let i = 0; i < 4 && !canUseCounter(s, "player2", guts.instanceId); i += 1) {
      const pass = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    s = playCounter(s, "player2", guts.instanceId);
    // ダイノガッツは必要パワー2 → 山札から2枚ひいて捨札。超電子頭脳の選択は起きない
    expect(s.pendingEffectChoice?.effectId).not.toBe("super_brain");
    expect(s.players.player2.deck).toHaveLength(3);
    expect(zoneOf(s, "player2", unit.instanceId)).toBe("battle");
  });
});
