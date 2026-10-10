/**
 * カード仕様テスト: RS-024〜RS-030（第1弾「英雄の再誕」オペレーション）。
 *
 * 出典の優先順位（docs/rules/README.md §1.2）:
 *  1. 公式FAQ（grnrngr/faq-card-1 = docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_1.html）・
 *     エラッタ（docs/rules/08-errata.md）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-0NN.md、ライブ写し pages/N.txt）
 *  3. 一般ルール（docs/rules/*.md のルールID）
 * 期待値は出典に従う。エンジンが違う場合は it.fails と「既知の不具合」コメントで残す。
 */
import { describe, expect, it } from "vitest";
import { effectiveBp } from "../core/catalog";
import {
  CMD,
  act,
  canUse,
  canUseOn,
  cardDef,
  choiceOptions,
  choose,
  deck,
  endTurn,
  expectTextMatches,
  findCard,
  heldCount,
  inst,
  legal,
  mk,
  payAndUse,
  powers,
  released,
  held,
  rush,
  tryPayAndUse,
  unitDef,
  zoneIds,
  zoneOf,
  enterBattle,
  attack,
} from "./RS1-024-046.helpers";

// ===========================================================================
describe("RS-024 圧縮冷凍", () => {
  const SOURCE = "BP8000以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る。";

  function setup(p1: Record<string, unknown> = {}, p2: Record<string, unknown> = {}, powerCount = 6) {
    const op = inst("RS-024", "op");
    const state = mk({
      player1: { hand: [op], power: powers(powerCount), command: [released(CMD.OT, "c")], ...p1 },
      player2: { ...p2 },
    });
    return { op, state };
  }

  it("RS-024: カタログのテキストが原文と一致する（出典: atwiki/page-278 テキスト）", () => {
    expectTextMatches("RS-024", SOURCE);
  });

  it("RS-024: オーバーテクノロジーの通常オペレーション・必要パワー6（出典: atwiki/page-278 種類/必要パワー）", () => {
    const def = cardDef("RS-024")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("OT");
    expect(def.powerCost).toBe(6);
    expect(def.tags ?? []).not.toContain("カウンター");
    expect(def.tags ?? []).not.toContain("常駐");
  });

  it("RS-024: BP8000の敵軍ユニットを持ち主（敵軍）のパワーゾーンに送る（出典: atwiki/page-278「持ち主のパワーゾーンに送る」）", () => {
    const target = inst("SPEC-S-8000", "t");
    const { op, state } = setup({}, { battle: [target] });
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(zoneOf(next, "player2", target.instanceId)).toBe("power");
    expect(zoneOf(next, "player1", target.instanceId)).toBeNull();
  });

  it("RS-024: 敵軍ラッシュエリアのユニットも選べる（出典: R-TGT-01「ユニット」はラッシュエリア・バトルエリア）", () => {
    const target = inst("SPEC-S-1000", "t");
    const { op, state } = setup({}, { rush: [target] });
    expect(canUseOn(state, "player1", op.instanceId, target.instanceId)).toBe(true);
  });

  it("RS-024: BP9000のユニットは選べない（出典: atwiki/page-278「BP8000以下のユニット」）", () => {
    const target = inst("SPEC-S-9000", "t");
    const { op, state } = setup({}, { battle: [target] });
    expect(canUseOn(state, "player1", op.instanceId, target.instanceId)).toBe(false);
  });

  it("RS-024: 効果で修正された BP を参照する（本来5000＋4000=9000は選べない）（出典: R-RES-05 / faq-index「修正の加えられたその時点での値」）", () => {
    const target = { ...inst("SPEC-S-5000", "t"), bpModifier: 4000 };
    const { op, state } = setup({}, { battle: [target] });
    expect(canUseOn(state, "player1", op.instanceId, target.instanceId)).toBe(false);
  });

  it("RS-024: サイズの制限はない（BP8000のLユニットも選べる）（出典: atwiki/page-278 カード評価「サイズに制限が無い」）", () => {
    const target = inst("SPEC-L-8000", "t");
    const { op, state } = setup({}, { battle: [target] });
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(zoneOf(next, "player2", target.instanceId)).toBe("power");
  });

  it("RS-024: 自軍ユニットも選べ、自軍パワーゾーンに送る（出典: atwiki/page-278「自軍ユニットもパワーに送る」/ R-TGT-04）", () => {
    const own = inst("SPEC-S-1000", "own");
    const { op, state } = setup({ rush: [own] });
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: own.instanceId });
    expect(zoneOf(next, "player1", own.instanceId)).toBe("power");
  });

  it("RS-024: パワー5では使用できない（出典: atwiki/page-278 必要パワー6）", () => {
    const target = inst("SPEC-S-1000", "t");
    const { op, state } = setup({}, { battle: [target] }, 5);
    expect(canUse(state, "player1", op.instanceId)).toBe(false);
  });

  it("RS-024: パワーゾーンにはオモテ向きに置く（出典: grnrngr/faq-card-1 RS-024 Q）", () => {
    // 「はい、オモテ向きに置きます。」
    const target = inst("SPEC-S-1000", "t");
    const { op, state } = setup({}, { battle: [target] });
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(findCard(next, "player2", target.instanceId)?.faceDown ?? false).toBe(false);
  });
});

// ===========================================================================
describe("RS-025 ガオ・ソウル", () => {
  const SOURCE = "自軍ユニットを1体選ぶ。このターン、選んだユニットはBP＋4000される。";

  function setup(p1: Record<string, unknown> = {}, p2: Record<string, unknown> = {}, powerCount = 2) {
    const op = inst("RS-025", "op");
    const state = mk({
      player1: { hand: [op], power: powers(powerCount), command: [released(CMD.WB, "c")], ...p1 },
      player2: { ...p2 },
    });
    return { op, state };
  }

  it("RS-025: カタログのテキストが原文と一致する（出典: atwiki/page-75 テキスト）", () => {
    expectTextMatches("RS-025", SOURCE);
  });

  it("RS-025: ワイルドビーストの通常オペレーション・必要パワー2（出典: atwiki/page-75）", () => {
    const def = cardDef("RS-025")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("WB");
    expect(def.powerCost).toBe(2);
  });

  it("RS-025: 選んだ自軍ユニットは BP＋4000 される（出典: atwiki/page-75「BP＋4000される」）", () => {
    const own = inst("SPEC-S-1000", "own");
    const { op, state } = setup({ rush: [own] });
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: own.instanceId });
    const unit = findCard(next, "player1", own.instanceId)!;
    expect(effectiveBp(next, "player1", unit)).toBe(5000);
  });

  it("RS-025: 敵軍ユニットは選べない（出典: atwiki/page-75「自軍ユニットを1体選ぶ」）", () => {
    const own = inst("SPEC-S-1000", "own");
    const enemy = inst("SPEC-S-1000", "enemy");
    const { op, state } = setup({ rush: [own] }, { battle: [enemy] });
    expect(canUseOn(state, "player1", op.instanceId, own.instanceId)).toBe(true);
    expect(canUseOn(state, "player1", op.instanceId, enemy.instanceId)).toBe(false);
  });

  it("RS-025: 効果は「このターン」だけで、次の相手ターンには残らない（出典: R-TURN-04「このターン」）", () => {
    const own = inst("SPEC-S-1000", "own");
    const { op, state } = setup({ rush: [own] });
    let next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: own.instanceId });
    next = endTurn(next);
    expect(next.activePlayer).toBe("player2");
    const unit = findCard(next, "player1", own.instanceId)!;
    expect(effectiveBp(next, "player1", unit)).toBe(1000);
  });

  it("RS-025: パワー1では使用できない（出典: atwiki/page-75 必要パワー2）", () => {
    const own = inst("SPEC-S-1000", "own");
    const { op, state } = setup({ rush: [own] }, {}, 1);
    expect(canUse(state, "player1", op.instanceId)).toBe(false);
  });

  it("RS-025: 2枚を同じユニットに使うと効果は重複する（＋8000）（出典: grnrngr/faq-card-1 RS-025 Q2）", () => {
    // 「はい、できます。」
    const own = inst("SPEC-S-1000", "own");
    const op2 = inst("RS-025", "op2");
    const { op, state } = setup(
      { rush: [own], hand: [inst("RS-025", "op"), op2], command: [released(CMD.WB, "c1"), released(CMD.WB, "c2")] },
      {},
      4,
    );
    let next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: own.instanceId });
    next = payAndUse(next, "player1", op2.instanceId, { targetInstanceId: own.instanceId });
    const unit = findCard(next, "player1", own.instanceId)!;
    expect(effectiveBp(next, "player1", unit)).toBe(9000);
  });

  it.fails("RS-025: アバレキラーからコンビネーションした WB の M ユニットは、ガオ・ソウルで BP8000 以上なら SP1 になる（出典: grnrngr/faq-card-1 RS-025 Q1）", () => {
    // 既知の不具合: CARD-RS-025 （原因は依存先）RS-234【ウイングペンタクト】がコンビネーションしたMユニットにBP+3000／SP1を与えないため成立しない
    // 「はい、ＳＰ１になります。」
    const killer = inst("RS-234", "killer");
    const mUnit = inst("SPEC-M-WB-4000", "m");
    const { op, state } = setup({ rush: [killer, mUnit] });
    let next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: mUnit.instanceId });
    next = { ...next, phase: "battle" };
    next = enterBattle(next, "player1", killer.instanceId);
    next = enterBattle(next, "player1", mUnit.instanceId);
    // 4000 + 3000（ウイングペンタクト）+ 4000 = 11000 ≥ 8000 → SP1 → ストライクできる
    expect(
      legal(next).some((a) => a.type === "strike" && a.instanceId === mUnit.instanceId),
    ).toBe(true);
  });

  it("RS-025: ガオ・ソウルで BP5000 以上になったバイオハンター・シルバは「SP1」になる（出典: grnrngr/faq-card-2 RS-079 Q）", () => {
    // 「はい、その場合も「ＳＰ１」になります。」
    const silva = inst("RS-079", "silva");
    const { op, state } = setup({ rush: [silva] });
    let next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: silva.instanceId });
    next = { ...next, phase: "battle" };
    next = enterBattle(next, "player1", silva.instanceId);
    // 3000 + 4000 = 7000 ≥ 5000 → SP1
    expect(legal(next).some((a) => a.type === "strike" && a.instanceId === silva.instanceId)).toBe(true);
  });
});

// ===========================================================================
describe("RS-026 疾風流超忍法", () => {
  const SOURCE =
    "※カウンター（これは敵軍ターン中にのみ使用できる）BP8000以下のユニットがラッシュされたとき発動できる⇒そのユニットを持ち主の山札の上に戻す。";

  /** player1 がラッシュし、player2 が疾風流超忍法を構える。 */
  function setup(
    unitCardId: string,
    p1: Record<string, unknown> = {},
    p2: Record<string, unknown> = {},
  ) {
    const unit = inst(unitCardId, "u");
    const ctr = inst("RS-026", "ctr");
    const state = mk({
      player1: { hand: [unit], command: [released(CMD.WB, "c"), released(CMD.OT, "co")], power: powers(8, "p1pw"), deck: deck(3, "p1d"), ...p1 },
      player2: { hand: [ctr], command: [released(CMD.MA, "m")], power: powers(3, "p2pw"), deck: deck(3, "p2d"), ...p2 },
    });
    return { unit, ctr, state };
  }

  it("RS-026: カタログのテキストが原文と一致する（出典: atwiki/page-424 テキスト）", () => {
    expectTextMatches("RS-026", SOURCE);
  });

  it("RS-026: ミスティックアームズのカウンター・必要パワー3（出典: atwiki/page-424）", () => {
    const def = cardDef("RS-026")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("MA");
    expect(def.powerCost).toBe(3);
    expect(def.tags ?? []).toContain("カウンター");
  });

  it("RS-026: BP8000のユニットがラッシュされたとき使用でき、持ち主の山札の上に戻す（出典: atwiki/page-424「持ち主の山札の上に戻す」）", () => {
    const { unit, ctr, state } = setup("SPEC-S-8000");
    let next = rush(state, "player1", unit.instanceId);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(true);
    next = payAndUse(next, "player2", ctr.instanceId);
    expect(next.players.player1.deck[0]?.instanceId).toBe(unit.instanceId);
    expect(zoneOf(next, "player1", unit.instanceId)).toBe("deck");
  });

  it("RS-026: BP9000のユニットのラッシュには使用できない（出典: atwiki/page-424「BP8000以下」）", () => {
    const { unit, ctr, state } = setup("SPEC-S-9000");
    const next = rush(state, "player1", unit.instanceId);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(false);
  });

  it("RS-026: 自軍ターン中（自分のラッシュ）には使用できない（出典: atwiki/page-424「敵軍ターン中にのみ使用できる」）", () => {
    const own = inst("SPEC-S-1000", "own");
    const ctr = inst("RS-026", "ctr");
    const state = mk({
      player1: { hand: [own, ctr], command: [released(CMD.WB, "c"), released(CMD.MA, "m")], power: powers(3) },
    });
    const next = rush(state, "player1", own.instanceId);
    expect(canUse(next, "player1", ctr.instanceId)).toBe(false);
  });

  it("RS-026: 必要パワー3に足りない（パワー2）と使用できない（出典: atwiki/page-424 必要パワー3）", () => {
    const { unit, ctr, state } = setup("SPEC-S-1000", {}, { power: powers(2, "p2pw") });
    const next = rush(state, "player1", unit.instanceId);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(false);
  });

  it("RS-026: 「アタックされる以外では相手に選ばれない」ユニットにも使用できる（出典: grnrngr/faq-card-1 RS-026 Q1）", () => {
    // 「はい、対象になります。」
    const gatack = inst("RK-054", "g");
    const ctr = inst("RS-026", "ctr");
    const state = mk({
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: gatack.instanceId,
        phasePlayerId: "player1",
      },
      player1: { rush: [gatack] },
      player2: { hand: [ctr], command: [released(CMD.MA, "m")], power: powers(3) },
    });
    expect(canUse(state, "player2", ctr.instanceId)).toBe(true);
  });

  it.fails("RS-026: 敵軍ターン中に相手によって自軍ユニットがラッシュされたとき、その自軍ユニットに使用できる（出典: grnrngr/faq-card-1 RS-026 Q2）", () => {
    // 既知の不具合: CARD-RS-026 解決時にラッシュしたプレイヤーのラッシュエリアだけを探すため、持ち主が別（相手に出された自軍ユニット）だと山札に戻らない
    // 「はい、使用することができます」
    const mine = inst("SPEC-S-1000", "mine");
    const ctr = inst("RS-026", "ctr");
    const state = mk({
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: mine.instanceId,
        phasePlayerId: "player1",
      },
      player2: { rush: [mine], hand: [ctr], command: [released(CMD.MA, "m")], power: powers(3), deck: deck(2, "p2d") },
    });
    expect(canUse(state, "player2", ctr.instanceId)).toBe(true);
    const next = payAndUse(state, "player2", ctr.instanceId);
    expect(next.players.player2.deck[0]?.instanceId).toBe(mine.instanceId);
  });

  it("RS-026: 相手がラッシュしたバイオジェット2号（ステルス）にも使用できる（出典: grnrngr/faq-card-1 RS-026 Q3）", () => {
    // 「はい、使用することができます。」
    const jet = inst("RS-129", "jet");
    const ctr = inst("RS-026", "ctr");
    const state = mk({
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: jet.instanceId,
        phasePlayerId: "player1",
      },
      player1: { rush: [jet] },
      player2: { hand: [ctr], command: [released(CMD.MA, "m")], power: powers(3) },
    });
    expect(canUse(state, "player2", ctr.instanceId)).toBe(true);
  });

  it.todo(
    "RS-026: ジェットシーカーをラッシュ→疾風流超忍法を使われても【ラウンドレーダー】で敵軍パワーを2枚まで捨札にできる（出典: grnrngr/faq-card-1 RS-026 Q4）— 山札に戻ったジェットシーカーの効果が「使用したとき」に誘発する扱いをエンジンの公開APIで観測する手段がない（ラウンドレーダーの誘発キュー未確認）",
  );

  it.todo(
    "RS-026: ラッシュしたゴーマ16世を山札の上に戻されても【大地動転の玉】は発動する（出典: grnrngr/faq-card-1 RS-026 Q5）— 継続効果が「発動した」ことの観測方法が出典にない（どの時点の何に適用されるか不明）",
  );

  it("RS-026: 超電子レーダーの処理（パワーを手札に戻す）を終えてから使用できる（出典: grnrngr/faq-card-1 RS-026 Q6）", () => {
    // 「ラッシュに誘発した処理…をすべて完了させてから…実行」
    const { unit, ctr, state } = setup("SPEC-S-1000", { operation: [inst("RS-124", "radar")] });
    let next = rush(state, "player1", unit.instanceId);
    // レーダー: ラッシュしたユニットの持ち主（player1）がパワーを1枚手札に戻す
    for (let i = 0; i < 3 && next.pendingEffectChoice; i += 1) {
      const opts = choiceOptions(next, "player1");
      if (opts.length === 0) break;
      next = choose(next, "player1", opts[0]!);
    }
    expect(next.players.player1.hand.some((c) => c.cardId === "TST-P")).toBe(true);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(true);
    next = payAndUse(next, "player2", ctr.instanceId);
    expect(next.players.player1.deck[0]?.instanceId).toBe(unit.instanceId);
  });

  it("RS-026: リリース状態のコマンド4つ以上でBP9000以上になったファイヤーカイザーには使用できない（出典: grnrngr/faq-card-1 RS-026 Q7）", () => {
    // 「BP９０００以上になっている…発動することはできません」
    const kaiser = inst("RS-113", "fk");
    const phoenix = inst("RS-576", "phoenix");
    const barikion = inst("RS-114", "barikion");
    const ctr = inst("RS-026", "ctr");
    const state = mk({
      player1: {
        hand: [kaiser],
        rush: [phoenix, barikion],
        power: powers(6),
        // 支払いで1つホールドしても、リリース状態が4つ残る
        command: [released(CMD.MA, "a"), released(CMD.MA, "b"), released(CMD.MA, "c"), released(CMD.MA, "d"), released(CMD.MA, "e")],
      },
      player2: { hand: [ctr], command: [released(CMD.MA, "m")], power: powers(3) },
    });
    const next = rush(state, "player1", kaiser.instanceId, phoenix.instanceId);
    const unit = findCard(next, "player1", kaiser.instanceId)!;
    expect(zoneOf(next, "player1", kaiser.instanceId)).toBe("rush");
    expect(effectiveBp(next, "player1", unit)).toBeGreaterThanOrEqual(9000);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(false);
  });

  it("RS-026: 「ラッシュされたとき」は相手が次の宣言を行うまで。相手がパスして次へ進んだ後は使用できない（出典: grnrngr/faq-card-1 RS-026 Q8）", () => {
    // 「相手が次の宣言を行うまでの間です」
    const { unit, ctr, state } = setup("SPEC-S-1000");
    let next = rush(state, "player1", unit.instanceId);
    // 反応窓が開いている間、ラッシュしたプレイヤーは次の宣言ができない
    expect(legal(next).some((a) => a.playerId === "player1")).toBe(false);
    next = act(next, { type: "pass_rush_reaction", playerId: "player2" });
    expect(canUse(next, "player2", ctr.instanceId)).toBe(false);
  });

  it("RS-026: 山札の上に戻すカードはウラ向きに置く（出典: grnrngr/faq-card-1 RS-026 Q9）", () => {
    // 「はい、ウラ向きに置きます。」
    const { unit, ctr, state } = setup("SPEC-S-1000");
    let next = rush(state, "player1", unit.instanceId);
    next = payAndUse(next, "player2", ctr.instanceId);
    const top = next.players.player1.deck[0]!;
    expect(top.instanceId).toBe(unit.instanceId);
    expect(top.faceDown).not.toBe(false);
  });

  it("RS-026: ラッシュしたときの効果を先に適用してから使用できる（プテラノドンのプテラビーム）（出典: grnrngr/faq-card-1 RS-026 Q10）", () => {
    // 「まずユニットのラッシュしたときの効果を適用してから」
    const { unit, ctr, state } = setup(
      "RS-039",
      { command: [released(CMD.WB, "c")] },
      { command: [released(CMD.MA, "m"), held(CMD.ET, "heldEt")] },
    );
    let next = rush(state, "player1", unit.instanceId);
    // ラッシュ効果（敵軍ホールド状態のカードを捨札）が先に解決される
    expect(next.pendingEffectChoice?.playerId ?? "player1").toBe("player1");
    expect(canUse(next, "player2", ctr.instanceId)).toBe(false);
    next = choose(next, "player1", "TST-OP-ET:heldEt");
    expect(zoneOf(next, "player2", "TST-OP-ET:heldEt")).toBe("discard");
    expect(canUse(next, "player2", ctr.instanceId)).toBe(true);
  });

  it.todo(
    "RS-026: ラッシュ時BP8000以下なら、その後BPが上がったダイカイオーヒガシも山札の上に戻る（出典: atwiki/page-424 Q11）— XG3-036 がカタログ未収録（fullPlayable にない）ため再現できない",
  );

  it.fails(
    "RS-026: 1体のラッシュに対し、1枚目の解決後に2枚目の疾風流超忍法（RS-247）を続けて使用できる（出典: atwiki/page-424 Q12）",
    () => {
      // 既知の不具合: CARD-RS-026 1枚目のカウンター解決でラッシュ反応窓が閉じ、同じラッシュへの2枚目を使えない
      // 「はい、できます。」
      const { unit, ctr, state } = setup(
        "SPEC-S-1000",
        {},
        {
          hand: [inst("RS-026", "ctr"), inst("RS-247", "ctr2")],
          command: [released(CMD.MA, "m1"), released(CMD.MA, "m2")],
          power: powers(3, "p2pw"),
        },
      );
      let next = rush(state, "player1", unit.instanceId);
      next = payAndUse(next, "player2", ctr.instanceId);
      expect(canUse(next, "player2", "RS-247:ctr2")).toBe(true);
    },
  );

  it("RS-026: ガオパンダのラッシュで自軍コマンドがすべてホールドされると使用できない（出典: atwiki/page-424 Q13）", () => {
    // 「必要な自軍コマンドを全てホールドされてしまうからです」
    const { unit, ctr, state } = setup("RS-305", { command: [released(CMD.WB, "c")] });
    const next = rush(state, "player1", unit.instanceId);
    expect(heldCount(next, "player2")).toBe(1);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(false);
  });

  it.todo(
    "RS-026: 第三の眼で無効にされた後、2枚目の疾風流超忍法を改めて使用できる（出典: atwiki/page-424 Q14）— RK-011 の無効化を誘発させる公開アクション手順が確認できず再現できない",
  );

  it.fails("RS-026: BP4000以上8000以下のSユニットのラッシュに宏のオルゴール時計と両方使用できる（出典: atwiki/page-424 Q15）", () => {
    // 既知の不具合: CARD-RS-026 ラッシュ反応窓では疾風流超忍法（RS-026）しか列挙されず、RK-012 を併用できない
    // 「はい、できます。」
    const music = inst("RK-012", "music");
    const { unit, ctr, state } = setup(
      "SPEC-S-5000",
      {},
      {
        hand: [inst("RS-026", "ctr"), music],
        command: [released(CMD.MA, "m"), released(CMD.ET, "e")],
        power: powers(4, "p2pw"),
      },
    );
    let next = rush(state, "player1", unit.instanceId);
    expect(canUse(next, "player2", music.instanceId)).toBe(true);
    next = payAndUse(next, "player2", music.instanceId);
    expect(canUse(next, "player2", ctr.instanceId)).toBe(true);
    next = payAndUse(next, "player2", ctr.instanceId);
    expect(next.players.player1.deck[0]?.instanceId).toBe(unit.instanceId);
  });
});

// ===========================================================================
describe("RS-027 ダイノガッツ", () => {
  const SOURCE =
    "※カウンター（これは敵軍ターン中にのみ使用できる）自軍ユニットが場を離れるとき発動できる。⇒場を離れるユニットはその場に留まる。ただし、場を離れるユニットの必要パワーを見て、その数字と同じ枚数を自軍山札からひいて捨札にする。";

  const P2 = unitDef("SPEC-S-P2", { bp: 1000, size: "S", powerCost: 2 });

  /** player1（ターンプレイヤー）のアタックで player2 のユニットが撃破されるところ。 */
  function battleSetup(defCardId = "SPEC-S-P2", p2: Record<string, unknown> = {}) {
    const atk = inst("SPEC-S-9000", "atk");
    const target = inst(defCardId, "t");
    const ctr = inst("RS-027", "ctr");
    const state = mk({
      phase: "battle",
      definitions: { "SPEC-S-P2": P2 },
      player1: { battle: [atk] },
      player2: { battle: [target], hand: [ctr], command: [released(CMD.WB, "w")], deck: deck(10, "p2d"), ...p2 },
    });
    return { atk, target, ctr, state: attack(state, "player1", atk.instanceId, target.instanceId) };
  }

  it("RS-027: カタログのテキストが原文と一致する（出典: atwiki/page-234 テキスト）", () => {
    expectTextMatches("RS-027", SOURCE);
  });

  it("RS-027: ワイルドビーストのカウンター・必要パワー0（出典: atwiki/page-234）", () => {
    const def = cardDef("RS-027")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("WB");
    expect(def.powerCost).toBe(0);
    expect(def.tags ?? []).toContain("カウンター");
  });

  it("RS-027: 撃破されて場を離れる自軍ユニットはその場に留まり、必要パワーと同じ枚数を山札から捨札にする（出典: atwiki/page-234 テキスト）", () => {
    const { target, ctr, state } = battleSetup();
    expect(canUse(state, "player2", ctr.instanceId)).toBe(true);
    const next = payAndUse(state, "player2", ctr.instanceId);
    expect(zoneOf(next, "player2", target.instanceId)).toBe("battle");
    expect(next.players.player2.deck).toHaveLength(8);
    expect(next.players.player2.discard.filter((c) => c.cardId === "TST-OP")).toHaveLength(2);
  });

  it("RS-027: 必要パワーが「5+」のユニット（パトストライカー）なら5枚を山札から捨札にする（出典: atwiki/page-234「必要パワーを見て、その数字と同じ枚数」）", () => {
    const { target, ctr, state } = battleSetup("RS-043");
    const next = payAndUse(state, "player2", ctr.instanceId);
    expect(zoneOf(next, "player2", target.instanceId)).toBe("battle");
    expect(next.players.player2.deck).toHaveLength(5);
  });

  it("RS-027: 敵軍ユニットが場を離れるときには使用できない（出典: atwiki/page-234「自軍ユニットが場を離れるとき」）", () => {
    // player2 のユニットが離れるときに、player1 側ではなく第三者視点: player2 のターンに player1 のユニットが離れる場面で
    // player2 が使えないこと
    const atk = inst("SPEC-S-5000", "atk");
    const target = inst("SPEC-S-P2", "t");
    const ctr = inst("RS-027", "ctr");
    let state = mk({
      phase: "battle",
      activePlayer: "player2",
      definitions: { "SPEC-S-P2": P2 },
      player1: { battle: [target], deck: deck(5, "p1d") },
      player2: { battle: [atk], hand: [ctr], command: [released(CMD.WB, "w")], deck: deck(5, "p2d") },
    });
    state = attack(state, "player2", atk.instanceId, target.instanceId);
    expect(canUse(state, "player2", ctr.instanceId)).toBe(false);
  });

  it("RS-027: 自軍ターン中は使用できない（出典: atwiki/page-234「敵軍ターン中にのみ使用できる」）", () => {
    // player2 のターンに player2 のユニットがバトルで撃破される
    const atk = inst("SPEC-S-1000", "atk");
    const target = inst("SPEC-S-5000", "t");
    const ctr = inst("RS-027", "ctr");
    let state = mk({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [target] },
      player2: { battle: [atk], hand: [ctr], command: [released(CMD.WB, "w")], deck: deck(5, "p2d") },
    });
    state = attack(state, "player2", atk.instanceId, target.instanceId);
    expect(canUse(state, "player2", ctr.instanceId)).toBe(false);
  });

  it.todo(
    "RS-027: 天雷旋風神【アルティマストーム】でユニットから先に山札へ戻すとき、相手はダイノガッツを使用できる（出典: grnrngr/faq-card-1 RS-027 Q1 / atwiki/page-234 Q1）— 戻す順番をターンプレイヤーが選ぶ公開アクションがなく再現できない",
  );

  it.todo(
    "RS-027: 巨大化爆弾に重ねたユニットに使い、爆弾とユニットを場に留まらせられる（出典: grnrngr/faq-card-1 RS-027 Q2）— 巨大化爆弾は敵軍ターン中の自軍「怪人」撃破で発動するため、ダイノガッツ（同じく敵軍ターン中）と同じ盤面を公開APIで作る手順が確認できない",
  );

  it("RS-027: 追加条件で必要パワー0としてラッシュしたアバレッドAMでも、捨札にするのは必要パワー7の7枚（出典: grnrngr/faq-card-1 RS-027 Q3）", () => {
    // 「「RS-027 ダイノガッツ」で山札から捨札にするのは７枚になります」
    const { target, ctr, state } = battleSetup("RS-230");
    const next = payAndUse(state, "player2", ctr.instanceId);
    expect(zoneOf(next, "player2", target.instanceId)).toBe("battle");
    expect(next.players.player2.deck).toHaveLength(3);
  });

  it("RS-027: 超電子頭脳の「ドローするとき」効果は、ダイノガッツでカードをひくときには発動しない（出典: grnrngr/faq-card-1 RS-027 Q4）", () => {
    // 「「カードをひく」だけでは発動しません」
    const { ctr, state } = battleSetup("SPEC-S-P2", { operation: [inst("RS-008", "brain")] });
    const next = payAndUse(state, "player2", ctr.instanceId);
    expect(next.pendingEffectChoice).toBeUndefined();
    expect(next.players.player2.hand).toHaveLength(0);
    expect(next.players.player2.discard.filter((c) => c.cardId === "TST-OP")).toHaveLength(2);
  });

  it("RS-027: 途中で山札がなくなるとゲームに負ける（出典: grnrngr/faq-card-1 RS-027 Q5）", () => {
    // 「はい、ゲームに負けてしまいます。」
    const { ctr, state } = battleSetup("SPEC-S-P2", { deck: deck(1, "p2d") });
    const next = payAndUse(state, "player2", ctr.instanceId);
    expect(next.winner).toBe("player1");
  });

  it("RS-027: パワーゾーンへ移動させられるとき（敵軍の圧縮冷凍）にも使用できる（出典: grnrngr/faq-card-1 RS-027 Q6）", () => {
    // 「場の一部であるパワーゾーンやコマンドゾーンに…移動させられるときも…はい、できます」
    const op = inst("RS-024", "freeze");
    const target = inst("SPEC-S-P2", "t");
    const ctr = inst("RS-027", "ctr");
    let state = mk({
      definitions: { "SPEC-S-P2": P2 },
      player1: { hand: [op], power: powers(6), command: [released(CMD.OT, "c")] },
      player2: { battle: [target], hand: [ctr], command: [released(CMD.WB, "w")], deck: deck(5, "p2d") },
    });
    state = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(canUse(state, "player2", ctr.instanceId)).toBe(true);
    state = payAndUse(state, "player2", ctr.instanceId);
    expect(zoneOf(state, "player2", target.instanceId)).toBe("battle");
  });

  it("RS-027: グリーンレーサー【ピットインダイブ】でラッシュエリアからバトルエリアへ移動させられるときにも使用できる（出典: grnrngr/faq-card-1 RS-027 Q6）", () => {
    // 「ピットインダイブ」によって…移動させられるときも…発動させることができます」
    const racer = inst("RS-049", "racer");
    const target = inst("SPEC-S-P2", "t");
    const ctr = inst("RS-027", "ctr");
    let state = mk({
      phase: "battle",
      definitions: { "SPEC-S-P2": P2 },
      player1: { rush: [racer], battle: [inst("SPEC-S-1000", "f0"), inst("SPEC-S-1000", "f1"), inst("SPEC-S-1000", "f2")], command: [released(CMD.OT, "c")] },
      player2: { rush: [target], hand: [ctr], command: [released(CMD.WB, "w")], deck: deck(5, "p2d") },
    });
    state = enterBattle(state, "player1", racer.instanceId);
    // ピットインダイブは任意。発動を選ぶ
    for (let i = 0; i < 4 && state.pendingEffectChoice?.playerId === "player1"; i += 1) {
      const opts = choiceOptions(state, "player1");
      if (opts.includes(target.instanceId)) {
        state = choose(state, "player1", target.instanceId);
      } else if (legal(state).some((a) => a.type === "confirm_effect_choice")) {
        state = act(state, { type: "confirm_effect_choice", playerId: "player1" });
      } else break;
    }
    expect(canUse(state, "player2", ctr.instanceId)).toBe(true);
    state = payAndUse(state, "player2", ctr.instanceId);
    expect(zoneOf(state, "player2", target.instanceId)).toBe("rush");
  });

  it("RS-027: アバレッドを撃破→ダイノガッツで留まらせても、アバレッドの効果で1点ダメージを受ける（出典: grnrngr/faq-card-1 RS-027 Q7）", () => {
    // 「撃破されたことを無効にする効果はありません」
    const { target, ctr, state } = battleSetup("RS-054");
    let next = payAndUse(state, "player2", ctr.instanceId);
    // ダメージ支払い（パワーへ）の選択があれば先頭で進める
    for (let i = 0; i < 4 && next.pendingDamagePayment; i += 1) {
      const pay = legal(next).find((a) => a.type === "resolve_damage_payment");
      if (!pay) break;
      next = act(next, pay);
    }
    expect(zoneOf(next, "player2", target.instanceId)).toBe("battle");
    expect(next.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("RS-028 ジャッジメント", () => {
  const SOURCE =
    "敵軍ユニットを1体選んでターゲットとする。そして　自軍山札の上から1枚をオモテにし、それがターゲットと同じサイズのユニットなら、ターゲットを撃破する。その後、オモテにしたカードは山札の下に戻す。";

  function setup(top: string, targetCardId = "SPEC-S-1000", powerCount = 5) {
    const op = inst("RS-028", "op");
    const target = inst(targetCardId, "t");
    const topCard = inst(top, "top");
    const state = mk({
      player1: {
        hand: [op],
        power: powers(powerCount),
        command: [released(CMD.OT, "c")],
        deck: [topCard, ...deck(2, "rest")],
      },
      player2: { battle: [target] },
    });
    return { op, target, topCard, state };
  }

  it("RS-028: カタログのテキストが原文と一致する（出典: atwiki/page-32 テキスト）", () => {
    expectTextMatches("RS-028", SOURCE);
  });

  it("RS-028: オーバーテクノロジーの通常オペレーション・必要パワー5（出典: atwiki/page-32）", () => {
    const def = cardDef("RS-028")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("OT");
    expect(def.powerCost).toBe(5);
  });

  it("RS-028: 山札の上が同じサイズのユニットならターゲットを撃破し、オモテにしたカードは山札の下へ（出典: atwiki/page-32 テキスト）", () => {
    const { op, target, topCard, state } = setup("SPEC-S-3000");
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(zoneOf(next, "player2", target.instanceId)).toBe("discard");
    expect(next.players.player1.deck.at(-1)?.instanceId).toBe(topCard.instanceId);
    expect(next.players.player1.deck).toHaveLength(3);
  });

  it("RS-028: 違うサイズのユニットなら撃破しないが、オモテにしたカードは山札の下へ（出典: atwiki/page-32「同じサイズのユニットなら」）", () => {
    const { op, target, topCard, state } = setup("SPEC-M-4000");
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(zoneOf(next, "player2", target.instanceId)).toBe("battle");
    expect(next.players.player1.deck.at(-1)?.instanceId).toBe(topCard.instanceId);
  });

  it("RS-028: オモテにしたカードがユニットでなければ撃破しない（出典: atwiki/page-32「同じサイズのユニットなら」）", () => {
    const { op, target, state } = setup("TST-OP");
    const next = payAndUse(state, "player1", op.instanceId, { targetInstanceId: target.instanceId });
    expect(zoneOf(next, "player2", target.instanceId)).toBe("battle");
  });

  it("RS-028: 自軍ユニットはターゲットに選べない（出典: atwiki/page-32「敵軍ユニットを1体選んで」）", () => {
    const op = inst("RS-028", "op");
    const own = inst("SPEC-S-1000", "own");
    const enemy = inst("SPEC-S-1000", "enemy");
    const state = mk({
      player1: { hand: [op], power: powers(5), command: [released(CMD.OT, "c")], rush: [own], deck: deck(2) },
      player2: { battle: [enemy] },
    });
    expect(canUseOn(state, "player1", op.instanceId, enemy.instanceId)).toBe(true);
    expect(canUseOn(state, "player1", op.instanceId, own.instanceId)).toBe(false);
  });

  it("RS-028: パワー4では使用できない（出典: atwiki/page-32 必要パワー5）", () => {
    const { op, state } = setup("SPEC-S-3000", "SPEC-S-1000", 4);
    expect(canUse(state, "player1", op.instanceId)).toBe(false);
  });
});

// ===========================================================================
describe("RS-029 勇気の魔法", () => {
  const SOURCE =
    "※常駐（場に配置して、離れるまで効果が有効になる）自軍Sユニットがバトルエリアに出るたびに、自軍コマンドを1つリリースしてもよい。";

  function setup(p1: Record<string, unknown> = {}, p2: Record<string, unknown> = {}) {
    return mk({
      phase: "battle",
      player1: { operation: [inst("RS-029", "magic")], ...p1 },
      player2: { ...p2 },
    });
  }

  it("RS-029: カタログのテキストが原文と一致する（出典: atwiki/page-245 テキスト）", () => {
    expectTextMatches("RS-029", SOURCE);
  });

  it("RS-029: ミスティックアームズの常駐・必要パワー1（出典: atwiki/page-245）", () => {
    const def = cardDef("RS-029")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("MA");
    expect(def.powerCost).toBe(1);
    expect(def.tags ?? []).toContain("常駐");
  });

  it("RS-029: 自軍Sユニットがバトルエリアに出たとき、ホールド状態の自軍コマンドを1つリリースできる（出典: atwiki/page-245 テキスト）", () => {
    const s = inst("SPEC-S-1000", "s");
    let state = setup({ rush: [s], command: [held(CMD.ET, "h1")] });
    state = enterBattle(state, "player1", s.instanceId);
    for (let i = 0; i < 3 && state.pendingEffectChoice?.playerId === "player1"; i += 1) {
      const opts = choiceOptions(state, "player1");
      if (opts.includes("TST-OP-ET:h1")) state = choose(state, "player1", "TST-OP-ET:h1");
      else break;
    }
    expect(heldCount(state, "player1")).toBe(0);
  });

  it("RS-029: Mユニットが出ても効果はない（出典: atwiki/page-245「自軍Sユニット」）", () => {
    const m = inst("SPEC-M-4000", "m");
    let state = setup({ rush: [m], command: [held(CMD.ET, "h1")] });
    state = enterBattle(state, "player1", m.instanceId);
    expect(state.pendingEffectChoice).toBeUndefined();
    expect(heldCount(state, "player1")).toBe(1);
  });

  it("RS-029: リリースは任意（しなくてもよい）（出典: atwiki/page-245「リリースしてもよい」）", () => {
    const s = inst("SPEC-S-1000", "s");
    let state = setup({ rush: [s], command: [held(CMD.ET, "h1")] });
    state = enterBattle(state, "player1", s.instanceId);
    if (state.pendingEffectChoice) {
      expect(legal(state).some((a) => a.type === "skip_effect_choice" && a.playerId === "player1")).toBe(true);
      state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    }
    expect(heldCount(state, "player1")).toBe(1);
  });

  it("RS-029: 出るたびに発動する（Sユニット2体で2つリリース）（出典: atwiki/page-245「出るたびに」）", () => {
    const s1 = inst("SPEC-S-1000", "s1");
    const s2 = inst("SPEC-S-1000", "s2");
    let state = setup({ rush: [s1, s2], command: [held(CMD.ET, "h1"), held(CMD.ET, "h2")] });
    for (const unit of [s1, s2]) {
      state = enterBattle(state, "player1", unit.instanceId);
      for (let i = 0; i < 3 && state.pendingEffectChoice?.playerId === "player1"; i += 1) {
        const opts = choiceOptions(state, "player1");
        if (opts.length === 0) break;
        state = choose(state, "player1", opts[0]!);
      }
    }
    expect(heldCount(state, "player1")).toBe(0);
  });

  it("RS-029: リリースできるのは自軍コマンドだけ（敵軍のホールド状態コマンドは選べない）（出典: atwiki/page-245「自軍コマンドを1つ」）", () => {
    const s = inst("SPEC-S-1000", "s");
    let state = setup({ rush: [s], command: [held(CMD.ET, "mine")] }, { command: [held(CMD.ET, "theirs")] });
    state = enterBattle(state, "player1", s.instanceId);
    const opts = choiceOptions(state, "player1");
    expect(opts).not.toContain("TST-OP-ET:theirs");
  });

  it.todo(
    "RS-029: 勇気の魔法でリリースしたレッドのユニットカードを、アカレッド【ソウル降臨】でホールドしてNCを発動できる（出典: grnrngr/faq-card-6 RS-421 Q）— RS-421 側のQ&A。RS-421 の効果実装に依存するため本ファイルでは扱わない",
  );
});

// ===========================================================================
describe("RS-030 アドベンチャー", () => {
  // 修正後テキスト（docs/rules/08-errata.md R-ERR-RS030）
  const SOURCE =
    "※常駐 自分も相手も次の制限を受ける→自分自身のターンを終えるとき、自分自身のコマンドゾーンからホールド状態のコマンドを1つ選んで手札に戻す。";

  function endWithChoices(state: ReturnType<typeof mk>) {
    // ターン終了処理: 選択が開けば先頭を選ぶ
    let s = act(state, { type: "end_phase", playerId: state.activePlayer });
    for (let i = 0; i < 6 && s.pendingEffectChoice; i += 1) {
      const pc = s.pendingEffectChoice;
      const opts = choiceOptions(s, pc.playerId);
      if (opts.length === 0) break;
      s = choose(s, pc.playerId, opts[0]!);
    }
    return s;
  }

  it("RS-030: カタログのテキストが修正後テキストと一致する（出典: 08-errata R-ERR-RS030 / atwiki/page-259）", () => {
    expectTextMatches("RS-030", SOURCE);
  });

  it("RS-030: アーステクノロジーの常駐・必要パワー3（出典: atwiki/page-259）", () => {
    const def = cardDef("RS-030")!;
    expect(def.type).toBe("operation");
    expect(def.category).toBe("ET");
    expect(def.powerCost).toBe(3);
    expect(def.tags ?? []).toContain("常駐");
  });

  it("RS-030: 自分のターンを終えるとき、自分のホールド状態コマンドを1つ手札に戻す（出典: 修正後テキスト）", () => {
    const state = mk({
      phase: "end",
      player1: { operation: [inst("RS-030", "adv")], command: [held(CMD.WB, "h1"), held(CMD.WB, "h2"), released(CMD.WB, "r")] },
    });
    const next = endWithChoices(state);
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.command).toHaveLength(2);
    expect(zoneOf(next, "player1", "TST-OP:r")).toBe("command");
  });

  it("RS-030: 相手が配置したアドベンチャーでも、自分のターン終了時に自分のコマンドを戻す（出典: 修正後テキスト「自分も相手も次の制限を受ける」）", () => {
    const state = mk({
      phase: "end",
      player1: { command: [held(CMD.WB, "h1")] },
      player2: { operation: [inst("RS-030", "adv")] },
    });
    const next = endWithChoices(state);
    expect(zoneOf(next, "player1", "TST-OP:h1")).toBe("hand");
  });

  it("RS-030: ホールド状態のコマンドがなければ何も戻さない（出典: 修正後テキスト「ホールド状態のコマンド」）", () => {
    const state = mk({
      phase: "end",
      player1: { operation: [inst("RS-030", "adv")], command: [released(CMD.WB, "r")] },
    });
    const next = endWithChoices(state);
    expect(next.players.player1.hand).toHaveLength(0);
    expect(zoneOf(next, "player1", "TST-OP:r")).toBe("command");
  });

  it("RS-030: 自分も相手も常駐していれば効果は重複し、ターンを終えたプレイヤーが2つ戻す（出典: grnrngr/faq-card-1 RS-030 Q1）", () => {
    // 「はい、重複します。」
    const state = mk({
      phase: "end",
      player1: { operation: [inst("RS-030", "adv1")], command: [held(CMD.WB, "h1"), held(CMD.WB, "h2"), held(CMD.WB, "h3")] },
      player2: { operation: [inst("RS-030", "adv2")], command: [held(CMD.ET, "o1")] },
    });
    const next = endWithChoices(state);
    expect(next.players.player1.hand).toHaveLength(2);
    expect(zoneOf(next, "player2", "TST-OP-ET:o1")).toBe("command");
  });

  it("RS-030: 重複していてもホールド状態が1枚しかなければその1枚だけ戻す（出典: grnrngr/faq-card-1 RS-030 Q1）", () => {
    // 「1枚しかなければその1枚を手札に戻します」
    const state = mk({
      phase: "end",
      player1: { operation: [inst("RS-030", "adv1")], command: [held(CMD.WB, "h1")] },
      player2: { operation: [inst("RS-030", "adv2")] },
    });
    const next = endWithChoices(state);
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.command).toHaveLength(0);
  });

  it("RS-030: 相手がターンを終えるとき、自分はコマンドを戻さない（出典: grnrngr/faq-card-1 RS-030 Q2）", () => {
    // 「いいえ。ターンを終えたプレイヤーのみ行います。」
    const state = mk({
      phase: "end",
      player1: { operation: [inst("RS-030", "adv")], command: [held(CMD.WB, "h1")] },
      player2: { command: [held(CMD.ET, "o1")] },
    });
    const next = endWithChoices(state);
    expect(zoneOf(next, "player2", "TST-OP-ET:o1")).toBe("command");
    expect(next.players.player2.hand).toHaveLength(0);
  });
});
