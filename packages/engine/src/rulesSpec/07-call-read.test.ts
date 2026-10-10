/**
 * docs/rules/07-keywords.md「コール」「リード」節（R-KW-CALL-01、R-KW-READ-01）のルール仕様テスト。
 * 出典: atwiki/page-1293（コール Q1〜Q2・本文）、atwiki/page-2250（リード Q1〜Q3・本文）、atwiki/page-1559。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { act, card, hasLegal, inst, legal, powerCards, realDef, state, unitDef, vehicleDef, where } from "./07-helpers";

/** 支払い開始アクションを適用し、ホールドに使えるカード一覧を返す。 */
function payableFor(s: GameState, sourceInstanceId: string): string[] | null {
  const start = legal(s).find(
    (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === sourceInstanceId,
  );
  if (!start) return null;
  return act(s, start).pendingCommandPayment?.validInstanceIds ?? [];
}

describe("R-KW-CALL-01 規定文", () => {
  const CALL_OT = realDef("RS-600"); // ※コールOT
  const CALL_DA = realDef("RS-634"); // ※コールDA
  const OT_S = unitDef("RSPEC-OT-S", { category: "OT", powerCost: 1 });
  const call = inst(CALL_OT.id, "call");
  const heldOt = { ...inst("TST-OP-OT", "held"), commandHeld: true };

  // 「このユニットは○○のユニットをラッシュするためのコマンドとしてホールドできる」
  it("R-KW-CALL-01: コールOT のユニットを、OT のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-1293 規定文）", () => {
    let s = state([CALL_OT, OT_S], {
      phase: "rush",
      player1: { hand: [inst(OT_S.id, "u")], rush: [call], command: [heldOt], power: powerCards(3) },
    });
    expect(payableFor(s, `${OT_S.id}:u`)).toContain(call.instanceId);
    s = act(s, legal(s).find((a) => a.type === "initiate_command_payment")!);
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: [call.instanceId] });
    expect(where(s, "player1", `${OT_S.id}:u`)).toBe("rush");
    expect(card(s, "player1", call.instanceId)?.commandHeld).toBe(true);
  });

  // 「単色はコマンドゾーンにそのカテゴリがなくてもよい [Q&A]」
  it.fails("R-KW-CALL-01: 単色のユニットなら、コマンドゾーンに OT のコマンドがなくてもコールで OT ユニットをラッシュできる（出典: docs/rules/07 R-KW-CALL-01 補足、atwiki/page-1559）", () => {
    // 既知の不具合: 未登録（コマンドゾーンに同カテゴリのカードがないとコールを使えない）
    const s = state([CALL_OT, OT_S], {
      phase: "rush",
      player1: { hand: [inst(OT_S.id, "u")], rush: [call], power: powerCards(3) },
    });
    expect(payableFor(s, `${OT_S.id}:u`) ?? []).toContain(call.instanceId);
  });

  // 「ビークルをラッシュする際のコマンドのホールドには使えない」
  it.fails("R-KW-CALL-01: コールのユニットはビークルをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-1293 本文）", () => {
    // 既知の不具合: 未登録（ビークルのラッシュでもコールのユニットがホールド候補に出る）
    const OT_V = vehicleDef("RSPEC-OT-V", { category: "OT" });
    const s = state([CALL_OT, OT_V], {
      phase: "rush",
      player1: { hand: [inst(OT_V.id, "v")], rush: [call], command: [heldOt], power: powerCards(3) },
    });
    expect(payableFor(s, `${OT_V.id}:v`) ?? []).not.toContain(call.instanceId);
  });

  // 「オペレーション使用…のコマンドのホールドには使えない」
  it("R-KW-CALL-01: コールのユニットはオペレーションを使用するためのコマンドとしてはホールドできない（出典: atwiki/page-1293 本文）", () => {
    const s = state([CALL_OT], {
      phase: "rush",
      player1: { hand: [inst("TST-OP-OT", "op")], rush: [call], command: [inst("TST-OP-OT", "rel")], power: powerCards(3) },
    });
    expect(payableFor(s, "TST-OP-OT:op") ?? []).not.toContain(call.instanceId);
  });

  // 「いいえ、それはできません。…常にコマンドとして扱うことができるわけではない」
  it("R-KW-CALL-01: コールでホールドしたユニットを、RS-409 冥府神スレイプニルの追加条件「自軍コマンドを1つ捨札にする」のコマンドとして捨札にはできない（出典: atwiki/page-1293 Q1）", () => {
    const s = state([CALL_DA, realDef("RS-409")], {
      phase: "rush",
      player1: { hand: [inst("RS-409", "h")], rush: [inst(CALL_DA.id, "call")], power: powerCards(5) },
    });
    // コマンドゾーンに捨札にできるコマンドがないので、コールしか持たない状態ではラッシュできない
    expect(hasLegal(s, (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-409:h")).toBe(false);
    expect(
      hasLegal(
        s,
        (a) => a.type === "initiate_command_payment" && (a.zordMaterialInstanceIds ?? []).includes(`${CALL_DA.id}:call`),
      ),
    ).toBe(false);
  });

  // 「コールを持つユニットは…【ドーラ魔法】の対象になります」
  it.fails("R-KW-CALL-01: 敵軍 RS-374 魔女バンドーラがいるとき、コールでホールドして特徴「魔法」のユニットをラッシュすると、そのコールのユニットが捨札になる（出典: atwiki/page-1293 Q2）", () => {
    // 既知の不具合: 未登録（ホールドしたコールのユニットではなく、別の自軍コマンドが捨札になる）
    const MAGIC = unitDef("RSPEC-MAGIC", { category: "DA", powerCost: 1, features: ["魔法"] });
    const c = inst(CALL_DA.id, "call");
    const otherCmd = { ...inst("TST-OP-DA", "other"), commandHeld: true };
    let s = state([CALL_DA, MAGIC, realDef("RS-374")], {
      phase: "rush",
      player1: { hand: [inst(MAGIC.id, "h")], rush: [c], command: [otherCmd], power: powerCards(5) },
      player2: { rush: [inst("RS-374", "bandora")] },
    });
    s = act(s, legal(s).find((a) => a.type === "initiate_command_payment")!);
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: [c.instanceId] });
    expect(where(s, "player1", c.instanceId)).toBe("discard");
    expect(where(s, "player1", otherCmd.instanceId)).toBe("command");
  });

  // 「必要カテゴリが揃っていなければ使えない」
  it.todo("R-KW-CALL-01: マルチカテゴリのカードには、コマンドゾーンに必要カテゴリが揃っていなければコールを使えない（出典: atwiki/page-1559。コールで払えるマルチカテゴリの組み合わせを持つ実装カードがない）");
});

describe("R-KW-READ-01 規定文", () => {
  const LEAD_ET = realDef("XG5-024"); // ※リードET
  const LEAD_MA = realDef("XG5-037"); // ※リードMA
  const lead = inst(LEAD_ET.id, "lead");

  // 「○○のオペレーションカードを使用するためのコマンド」
  it("R-KW-READ-01: リードET のユニットを、ET のオペレーションを使用するためのコマンドとしてホールドできる（出典: atwiki/page-2250 Q1）", () => {
    const s = state([LEAD_ET], {
      phase: "rush",
      player1: { hand: [inst("TST-OP-ET", "op")], rush: [lead], command: [inst("TST-OP-ET", "rel")], power: powerCards(3) },
    });
    expect(payableFor(s, "TST-OP-ET:op")).toContain(lead.instanceId);
  });

  // 「オペレーション使用以外の目的ではコマンドとして使うことはできない」
  it("R-KW-READ-01: リードのユニットはユニットをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-2250 本文）", () => {
    const ET_S = unitDef("RSPEC-ET-S", { category: "ET", powerCost: 1 });
    const s = state([LEAD_ET, ET_S], {
      phase: "rush",
      player1: { hand: [inst(ET_S.id, "u")], rush: [lead], command: [inst("TST-OP-ET", "rel")], power: powerCards(3) },
    });
    expect(payableFor(s, `${ET_S.id}:u`) ?? []).not.toContain(lead.instanceId);
  });

  // 「カウンターオペレーションを使用…」→「はい、できます」
  it("R-KW-READ-01: リードでカウンターオペレーション（RS-018 隠流忍術）を使用できる（出典: atwiki/page-2250 Q2）", () => {
    const A = unitDef("RSPEC-A", { bp: 5000 });
    const l = inst(LEAD_MA.id, "lead");
    let s = state([LEAD_MA, A, realDef("RS-018")], {
      phase: "battle",
      player1: { rush: [inst(A.id, "a")] },
      player2: {
        hand: [inst("RS-018", "n")],
        battle: [inst("TST-UNIT-0", "x"), inst("TST-UNIT-0", "y")],
        rush: [l],
        command: [inst("TST-OP-MA", "rel")],
        power: powerCards(5),
      },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${A.id}:a` });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: `${A.id}:a`, defenderInstanceId: "TST-UNIT-0:x" });
    expect(payableFor(s, "RS-018:n")).toContain(l.instanceId);
  });

  // 「使用するためにホールドしたコマンドであると扱われ」
  it.todo("R-KW-READ-01: リードでホールドしたユニットは「使用するためにホールドしたコマンド」として RM-015 インプットカードガン等に参照される（出典: atwiki/page-2250 Q3。参照効果の解決をエンジン API で観測できない）");
});
