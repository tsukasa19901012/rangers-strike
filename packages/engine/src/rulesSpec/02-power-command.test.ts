/**
 * docs/rules/02-zones-cards.md §3 パワー / §4 コマンド・ホールド・リリース
 * （R-POW / R-CMD / R-HOLD）のルールスペック。
 * 期待値はルールブックと docs/rules/sources/web/ の公式FAQ・atwiki に従う（エンジン現状ではない）。
 */
import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import type { GameState } from "../types/game";
import {
  advanceUntil,
  deckCards,
  hasLegal,
  inst,
  legal,
  payAndPlayOperation,
  payAndRush,
  powerCards,
  shironReveal,
  st,
  unwrap,
  zoneOf,
  zordRush,
} from "./02-helpers";

/** player1 のターンを終えて player1 の次のチャージフェイズまで公開アクションで進める。 */
function toOwnNextCharge(s: GameState): GameState {
  const s2 = advanceUntil(s, (x) => x.activePlayer === "player2" && x.phase === "charge");
  return advanceUntil(s2, (x) => x.activePlayer === "player1" && x.phase === "charge");
}

describe("R-POW-01 パワーの数", () => {
  // 「カードの裏表は関係ない」
  it("R-POW-01: ウラ向き（ダメージ）のカードも含めたパワーゾーンの枚数で必要パワーを満たせる（出典: atwiki/page-110, grnrngr rule_phase3）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("SPEC-S-ET-3", "u")],
        power: [inst("TST-P", "a"), { ...inst("TST-P", "b"), faceDown: true }, { ...inst("TST-P", "c"), faceDown: true }],
        command: [inst("TST-OP-ET", "c")],
      },
    });
    expect(countAvailablePower(s, "player1")).toBe(3);
    expect(payAndRush(s, "player1", "SPEC-S-ET-3:u", ["TST-OP-ET:c"]).ok).toBe(true);
  });

  // 「カテゴリやウラ・オモテに関係なく置かれているカードの枚数だけをみます」
  it("R-POW-01: パワーゾーンの枚数が必要パワーに1枚足りなければラッシュできない（出典: grnrngr rule_phase3）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-ET-3", "u")], power: powerCards(2), command: [inst("TST-OP-ET", "c")] },
    });
    expect(countAvailablePower(s, "player1")).toBe(2);
    expect(payAndRush(s, "player1", "SPEC-S-ET-3:u", ["TST-OP-ET:c"]).ok).toBe(false);
    expect(zoneOf(s, "player1", "SPEC-S-ET-3:u")).toBe("hand");
  });

  // 「敵軍コマンドゾーンに置かれているマルチカテゴリのカードの枚数」
  it("R-POW-01: 敵軍コマンドゾーンのマルチカテゴリのカードがあると「パワーゾーンの枚数」と「パワーの数」は一致しない（出典: atwiki/page-110）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-ET-3", "u")], power: powerCards(2), command: [inst("TST-OP-ET", "c")] },
      player2: { command: [inst("TST-OP-WB-ET", "mc")] },
    });
    expect(s.players.player1.power).toHaveLength(2);
    expect(countAvailablePower(s, "player1")).toBe(3);
    expect(payAndRush(s, "player1", "SPEC-S-ET-3:u", ["TST-OP-ET:c"]).ok).toBe(true);
  });

  it("R-POW-01: 自軍コマンドゾーンのマルチカテゴリのカードは自軍パワーに数えない（出典: atwiki/page-110）", () => {
    const s = st({
      phase: "rush",
      player1: { power: powerCards(2), command: [inst("TST-OP-WB-ET", "mc")] },
    });
    expect(countAvailablePower(s, "player1")).toBe(2);
  });
});

describe("R-POW-02 必要パワーは閾値", () => {
  // 「自軍パワーがこの数字の数以上なければ…できない」（消費しない）
  it("R-POW-02: 必要パワーは消費されず、パワー3のまま必要パワー3のユニットを続けて2体ラッシュできる（出典: atwiki/page-1721）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("SPEC-S-ET-3", "u1"), inst("SPEC-S-ET-3", "u2")],
        power: powerCards(3),
        command: [inst("TST-OP-ET", "c1"), inst("TST-OP-ET", "c2")],
      },
    });
    const r1 = unwrap(payAndRush(s, "player1", "SPEC-S-ET-3:u1", ["TST-OP-ET:c1"]));
    expect(r1.players.player1.power).toHaveLength(3);
    const r2 = unwrap(payAndRush(r1, "player1", "SPEC-S-ET-3:u2", ["TST-OP-ET:c2"]));
    expect(r2.players.player1.power).toHaveLength(3);
    expect(r2.players.player1.rush).toHaveLength(2);
  });

  it("R-POW-02: オペレーションの使用でもパワーゾーンのカードは減らない（出典: atwiki/page-1721）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP-ET", "c")], discard: [inst("SPEC-S-WB", "d")] },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP-ET:c"], "SPEC-S-WB:d"));
    expect(r.players.player1.power).toHaveLength(6);
  });

  // 「上限は存在しない」
  it("R-POW-02: 必要パワーに上限はなく、必要パワー12のユニットはパワー12でラッシュでき11ではできない（出典: atwiki/page-1721）", () => {
    const mk = (n: number) =>
      st({ phase: "rush", player1: { hand: [inst("SPEC-BIG", "big")], power: powerCards(n), command: [inst("TST-OP", "c")] } });
    expect(payAndRush(mk(11), "player1", "SPEC-BIG:big", ["TST-OP:c"]).ok).toBe(false);
    expect(payAndRush(mk(12), "player1", "SPEC-BIG:big", ["TST-OP:c"]).ok).toBe(true);
  });

  // 「０よりも少なくはならない」
  it("R-POW-02: 必要パワーを減らす効果を受けても0未満にはならない（出典: atwiki/page-1721）", () => {
    const s = st({
      phase: "rush",
      activePlayer: "player2",
      player2: { modifiers: [{ kind: "rule", ruleId: "enemy_power_cost_minus", scope: "turn" }] },
    });
    expect(effectivePowerCost(s, "player1", 3)).toBe(2);
    expect(effectivePowerCost(s, "player1", 0)).toBe(0);
  });

  // 「「必要パワー」以上のカードが自軍パワーゾーンに置かれていること」
  it("R-POW-02: ランドバルカンによる効果ラッシュでも、ラッシュするユニットの必要パワーは満たす必要がある（出典: grnrngr/faq-card-1 RS-005 Q3）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-005", "lb")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c"), inst("SPEC-S-WB-5", "five"), inst("SPEC-S-ET-3", "three")],
      },
    });
    const r = payAndPlayOperation(s, "player1", "RS-005:lb", ["TST-OP-ET:c"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(zoneOf(r.state, "player1", "SPEC-S-ET-3:three")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-S-WB-5:five")).toBe("command");
  });

  // 「ラッシュのための必要パワーと追加条件は満たすこと」
  it("R-POW-02: シーロンの光で公開したユニットも必要パワーを満たさなければラッシュできない（出典: grnrngr/faq-card-1 RS-013 Q4）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-WB-5", "u")], operation: [inst("RS-013", "sh")], power: powerCards(4) },
      player2: { hand: [] },
    });
    const revealed = shironReveal(s, "player1", "RS-013:sh", "SPEC-S-WB-5:u");
    expect(hasLegal(revealed, (a) => a.type === "rush" && a.instanceId === "SPEC-S-WB-5:u")).toBe(false);
  });
});

describe("R-POW-03 追加条件による必要パワー0はラッシュの瞬間のみ", () => {
  // 「「アバレッド」を捨て札にすれば…出す事ができます」
  it("R-POW-03: アバレッドを捨札にすれば自軍パワー6以下でもアバレッドAMをラッシュできる（出典: grnrngr/faq-card-1 RS-013 Q1, RS-230 追加条件）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-230", "am")], power: powerCards(2), command: [inst("TST-OP", "c")], rush: [inst("RS-054", "aba")] },
    });
    const r = unwrap(zordRush(s, "player1", "RS-230:am", "TST-OP:c", { zordMaterialInstanceId: "RS-054:aba" }));
    expect(zoneOf(r, "player1", "RS-230:am")).toBe("rush");
    expect(zoneOf(r, "player1", "RS-054:aba")).toBe("discard");
  });

  // 「ユニットとして存在するときは必要パワー７として扱います」
  it("R-POW-03: 必要パワー0でラッシュしたアバレッドAMが場を離れるときのダイノガッツは7枚を捨札にする（出典: grnrngr/faq-card-1 RS-027 Q2）", () => {
    // player1 がアバレッドを捨札にしてアバレッドAMをラッシュ
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-230", "am"), inst("RS-027", "dg")],
        power: powerCards(2),
        command: [inst("TST-OP", "c"), inst("TST-OP", "c2")],
        rush: [inst("RS-054", "aba")],
        deck: deckCards(10),
      },
      player2: { hand: [inst("RS-024", "frz")], power: powerCards(6), command: [inst("TST-OP-OT", "ot")], deck: deckCards(10, "e") },
    });
    const rushed = unwrap(zordRush(s0, "player1", "RS-230:am", "TST-OP:c", { zordMaterialInstanceId: "RS-054:aba" }));
    expect(zoneOf(rushed, "player1", "RS-230:am")).toBe("rush");
    // 敵軍ターン: player2 が圧縮冷凍でアバレッドAMをパワーゾーンへ送る → player1 がダイノガッツ
    const enemyTurn = advanceUntil(rushed, (x) => x.activePlayer === "player2" && x.phase === "rush");
    const afterOp = unwrap(payAndPlayOperation(enemyTurn, "player2", "RS-024:frz", ["TST-OP-OT:ot"], "RS-230:am"));
    expect(afterOp.pendingLeave?.instanceId).toBe("RS-230:am");
    const deckBefore = afterOp.players.player1.deck.length;
    const r = unwrap(payAndRush(afterOp, "player1", "RS-027:dg", ["TST-OP:c2"]));
    // ダイノガッツで場に留まる（自軍ターンにバトルエリアへ出ていたのでバトルエリアのまま）
    expect(["rush", "battle"]).toContain(zoneOf(r, "player1", "RS-230:am"));
    expect(deckBefore - r.players.player1.deck.length).toBe(7);
  });
});

describe("R-CMD-01 コマンドのホールド", () => {
  // 「そのカードと同じカテゴリのコマンドをホールドする」
  it("R-CMD-01: 手札からのラッシュには同じカテゴリのコマンドのホールドが必要で、違うカテゴリだけではラッシュできない（出典: atwiki/page-151, grnrngr rule_phase3）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP-ET", "et"), inst("TST-OP-MA", "ma")] },
    });
    expect(
      hasLegal(s, (a) => (a.type === "rush" || a.type === "initiate_command_payment") && ("instanceId" in a ? a.instanceId : a.sourceInstanceId) === "SPEC-S-WB:u"),
    ).toBe(false);
    expect(payAndRush(s, "player1", "SPEC-S-WB:u", ["TST-OP-ET:et"]).ok).toBe(false);
  });

  it("R-CMD-01: 同じカテゴリのコマンドをホールドすると手札からラッシュでき、そのコマンドはホールド状態になる（出典: atwiki/page-151）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP", "wb")] } });
    const r = unwrap(payAndRush(s, "player1", "SPEC-S-WB:u", ["TST-OP:wb"]));
    expect(zoneOf(r, "player1", "SPEC-S-WB:u")).toBe("rush");
    expect(r.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("R-CMD-01: オペレーションの使用にも同じカテゴリのコマンドのホールドが必要（出典: atwiki/page-151, grnrngr rule_phase3「カテゴリの同じカードが無いとき使用できません」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-068", "op")], power: powerCards(6), command: [inst("TST-OP", "wb")], discard: [inst("SPEC-S-WB", "d")] },
    });
    expect(payAndPlayOperation(s, "player1", "RS-068:op", ["TST-OP:wb"], "SPEC-S-WB:d").ok).toBe(false);
    expect(zoneOf(s, "player1", "RS-068:op")).toBe("hand");
  });

  // 「ホールドしたコマンドは消費された扱いで、リリースされるまでそのまま」
  // ランドバルカンの対象として WB カテゴリのユニットをコマンドゾーンに置く（ET コマンドではないので支払いには使えない）。
  it("R-CMD-01: ラッシュのためにホールドしたコマンドを、同じターンの別のオペレーション使用に再利用できない（出典: atwiki/page-157）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("SPEC-S-ET-3", "u"), inst("RS-005", "lb")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "et"), inst("SPEC-S-WB", "cmdS")],
      },
    });
    const r = unwrap(payAndRush(s, "player1", "SPEC-S-ET-3:u", ["TST-OP-ET:et"]));
    expect(r.players.player1.command.find((c) => c.instanceId === "TST-OP-ET:et")?.commandHeld).toBe(true);
    // リリース状態の ET コマンドはもうない → ランドバルカン（ET）は使用できない
    expect(
      hasLegal(r, (a) => ("instanceId" in a && a.instanceId === "RS-005:lb") || ("sourceInstanceId" in a && a.sourceInstanceId === "RS-005:lb")),
    ).toBe(false);
  });

  it("R-CMD-01: ホールドしたコマンドは敵軍ターンを通してホールドのままで、次の自軍スタートフェイズまでリリースされない（出典: atwiki/page-157）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-WB", "u")], command: [inst("TST-OP", "wb")], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    const r = unwrap(payAndRush(s, "player1", "SPEC-S-WB:u", ["TST-OP:wb"]));
    const enemy = advanceUntil(r, (x) => x.activePlayer === "player2" && x.phase === "rush");
    expect(enemy.players.player1.command[0]?.commandHeld).toBe(true);
    const ownStart = advanceUntil(enemy, (x) => x.activePlayer === "player1" && x.phase === "start");
    expect(ownStart.players.player1.command[0]?.commandHeld).toBe(true);
  });
});

describe("R-CMD-02 効果による使用ではホールド不要", () => {
  // 「コマンドをホールドしなくてもラッシュエリアに出すことができます」
  it("R-CMD-02: ランドバルカンでコマンドゾーンから出すユニットは、そのカテゴリのコマンドをホールドしなくてよい（出典: grnrngr/faq-card-1 RS-005 Q3）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-005", "lb")],
        power: powerCards(3),
        command: [inst("TST-OP-ET", "et"), inst("SPEC-S-WB", "wbS")],
      },
    });
    const r = unwrap(payAndPlayOperation(s, "player1", "RS-005:lb", ["TST-OP-ET:et"]));
    expect(zoneOf(r, "player1", "SPEC-S-WB:wbS")).toBe("rush");
    // ホールドされたのはランドバルカン用の ET コマンド1つだけ
    expect(r.players.player1.command.filter((c) => c.commandHeld).map((c) => c.instanceId)).toEqual(["TST-OP-ET:et"]);
  });

  // 「コマンドをホールドしなくてもラッシュエリアに出すことができます」
  it("R-CMD-02: シーロンの光で出すユニットはコマンドのホールドが不要（同カテゴリのコマンドがなくてもよい）（出典: grnrngr/faq-card-1 RS-013 Q4）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("SPEC-S-WB", "u")], operation: [inst("RS-013", "sh")], power: powerCards(4), command: [] },
      player2: { hand: [] },
    });
    const revealed = shironReveal(s, "player1", "RS-013:sh", "SPEC-S-WB:u");
    const rush = legal(revealed).find((a) => a.type === "rush" && a.instanceId === "SPEC-S-WB:u");
    expect(rush).toBeDefined();
    const r = unwrap(applyAction(revealed, rush!));
    expect(zoneOf(r, "player1", "SPEC-S-WB:u")).toBe("rush");
  });

  // 「続けてもう１枚の…に張り替えたとき、さらにその効果を発動…できます」
  it("R-CMD-02: シーロンの光を使った後、もう1枚のシーロンの光に張り替えれば同じラッシュフェイズに再び発動できる（出典: grnrngr/faq-card-1 RS-013 Q2）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("SPEC-S-WB", "u1"), inst("RS-013", "sh2"), inst("SPEC-S-WB", "u2")],
        operation: [inst("RS-013", "sh1")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "et")],
      },
      player2: { hand: [] },
    });
    const revealed = shironReveal(s, "player1", "RS-013:sh1", "SPEC-S-WB:u1");
    const rush = legal(revealed).find((a) => a.type === "rush" && a.instanceId === "SPEC-S-WB:u1");
    const r1 = rush ? unwrap(applyAction(revealed, rush)) : revealed;
    expect(hasLegal(r1, (a) => a.type === "shiron_light")).toBe(false);
    const r2 = unwrap(payAndPlayOperation(r1, "player1", "RS-013:sh2", ["TST-OP-ET:et"]));
    expect(r2.players.player1.operation.map((c) => c.instanceId)).toEqual(["RS-013:sh2"]);
    expect(hasLegal(r2, (a) => a.type === "shiron_light" && a.operationInstanceId === "RS-013:sh2")).toBe(true);
  });

  it.todo(
    "R-CMD-02: 個別にホールドを要求するカード（シザースジャガー・天空勇者マジシャイン）は効果による使用でもホールドが必要（出典: atwiki/page-151）— 該当カードの効果使用を公開アクションで構成するテスト基盤がない",
  );
});

describe("R-CMD-03 ホールドするカテゴリの指定がない場合", () => {
  // 「カテゴリ名を指定されていないので、どのカテゴリでも構いません」
  it("R-CMD-03: 爆竜ティラノサウルス（WB）がバトルエリアに出るためのホールドは別カテゴリ（OT）のコマンドでよい（出典: grnrngr/faq-card-1 RS-051 Q1）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("RS-051", "tyr")], command: [inst("TST-OP-OT", "ot")] },
      player2: { deck: deckCards(3) },
    });
    const init = applyAction(s, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "battle_entry",
      sourceInstanceId: "RS-051:tyr",
    });
    expect(init.ok).toBe(true);
    if (!init.ok) return;
    expect(init.state.pendingCommandPayment?.totalNeeded).toBe(1);
    const r = unwrap(applyAction(init.state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:ot"] }));
    expect(zoneOf(r, "player1", "RS-051:tyr")).toBe("battle");
    expect(r.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("R-CMD-03: 爆竜ティラノサウルスはコマンドを1つもホールドできなければバトルエリアに出られない（出典: grnrngr/faq-card-1 RS-051 Q1 前提）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("RS-051", "tyr")], command: [{ ...inst("TST-OP", "h"), commandHeld: true }] },
      player2: { deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "move_to_battle" && a.instanceId === "RS-051:tyr")).toBe(false);
    expect(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-051:tyr" }).ok).toBe(false);
  });

  // 「カテゴリ名を指定されていないので、どのカテゴリでも構いません」
  it("R-CMD-03: 稲妻重力エネルギー配置中、Mユニット（WB）がバトルエリアに出るためのホールドはどのカテゴリでもよい（出典: grnrngr/faq-card-1 RS-069 Q1）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("SPEC-M-WB", "m")], operation: [inst("RS-069", "lg")], command: [inst("TST-OP-DA", "da")] },
      player2: { deck: deckCards(3) },
    });
    const init = unwrap(
      applyAction(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "SPEC-M-WB:m" }),
    );
    expect(init.pendingCommandPayment?.totalNeeded).toBe(1);
    const r = unwrap(applyAction(init, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-DA:da"] }));
    expect(zoneOf(r, "player1", "SPEC-M-WB:m")).toBe("battle");
  });

  // 「ホールドするコマンドは２つになります」（両者配置）
  it("R-CMD-03: 自分と相手の両方が稲妻重力エネルギーを配置しているとき、Mユニットのホールドは2つ（出典: grnrngr/faq-card-1 RS-069 Q2）", () => {
    const s = st({
      phase: "battle",
      player1: {
        rush: [inst("SPEC-M-WB", "m")],
        operation: [inst("RS-069", "lg1")],
        command: [inst("TST-OP", "c1"), inst("TST-OP-ET", "c2")],
      },
      player2: { operation: [inst("RS-069", "lg2")], deck: deckCards(3) },
    });
    const init = unwrap(
      applyAction(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "SPEC-M-WB:m" }),
    );
    expect(init.pendingCommandPayment?.totalNeeded).toBe(2);
    const oneOnly = { ...s, players: { ...s.players, player1: { ...s.players.player1, command: [inst("TST-OP", "c1")] } } };
    expect(hasLegal(oneOnly, (a) => a.type === "move_to_battle" && a.instanceId === "SPEC-M-WB:m")).toBe(false);
  });

  // 「ホールドするコマンドは２つになります」（ティラノ＋稲妻）
  it("R-CMD-03: 稲妻重力エネルギー配置中の爆竜ティラノサウルスは、制限を1つずつ解決してコマンドを2つホールドする（出典: grnrngr/faq-card-1 RS-069 Q3）", () => {
    const s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-051", "tyr")],
        operation: [inst("RS-069", "lg")],
        command: [inst("TST-OP-OT", "c1"), inst("TST-OP-MA", "c2")],
      },
      player2: { deck: deckCards(3) },
    });
    const init = unwrap(
      applyAction(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RS-051:tyr" }),
    );
    expect(init.pendingCommandPayment?.totalNeeded).toBe(2);
    const r = unwrap(
      applyAction(init, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:c1", "TST-OP-MA:c2"] }),
    );
    expect(zoneOf(r, "player1", "RS-051:tyr")).toBe("battle");
    expect(r.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });
});

describe("R-CMD-04 コマンドの代わりにユニットを使う", () => {
  // 「こちらはスタートフェイズにリリースすることはできない」
  it("R-CMD-04: コールでコマンドの代わりに使ったユニットは次の自軍スタートフェイズにリリースされない（出典: atwiki/page-151）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("TST-UNIT-2", "rh")],
        rush: [inst("XG7-016", "call")],
        command: [inst("TST-OP", "wb")],
        power: powerCards(5),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    const init = unwrap(
      applyAction(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "TST-UNIT-2:rh" }),
    );
    const paid = unwrap(applyAction(init, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["XG7-016:call"] }));
    expect(zoneOf(paid, "player1", "TST-UNIT-2:rh")).toBe("rush");
    expect(paid.players.player1.rush.find((c) => c.instanceId === "XG7-016:call")?.commandHeld).toBe(true);
    const next = toOwnNextCharge(paid);
    expect(next.players.player1.rush.find((c) => c.instanceId === "XG7-016:call")?.commandHeld).toBe(true);
  });
});

describe("R-HOLD-01 コマンドはスタートフェイズに強制リリース", () => {
  // 「ホールド状態（ヨコ置き）のカードがあれば、すべてリリース状態」
  it("R-HOLD-01: ホールド状態の自軍コマンドは自軍スタートフェイズにすべてリリースされる（出典: atwiki/page-157, grnrngr rule_phase1-2）", () => {
    const s = st({
      phase: "end",
      activePlayer: "player2",
      player1: {
        command: [
          { ...inst("TST-OP", "c1"), commandHeld: true },
          { ...inst("TST-OP-ET", "c2"), commandHeld: true },
          inst("TST-OP-MA", "c3"),
        ],
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    const r = advanceUntil(s, (x) => x.activePlayer === "player1" && x.phase === "charge");
    expect(r.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it("R-HOLD-01: 敵軍のスタートフェイズでは自軍コマンドはリリースされない（出典: atwiki/page-264「ホールド状態の自軍コマンドをリリースする」）", () => {
    const s = st({
      phase: "end",
      activePlayer: "player1",
      player1: { command: [{ ...inst("TST-OP", "c1"), commandHeld: true }], deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    const r = advanceUntil(s, (x) => x.activePlayer === "player2" && x.phase === "charge");
    expect(r.players.player1.command[0]?.commandHeld).toBe(true);
  });
});

describe("R-HOLD-02 ユニットのホールドは自動で解除されない", () => {
  // 「ホールド状態のユニットはスタートフェイズになってもリリースされず」
  it("R-HOLD-02: レジストでホールド状態のユニットは自軍スタートフェイズを経てもホールドのまま（出典: atwiki/page-157, page-1289）", () => {
    const s = st({
      phase: "end",
      activePlayer: "player2",
      player1: {
        battle: [{ ...inst("SPEC-RESIST", "r"), commandHeld: true, registerHeld: true }],
        command: [{ ...inst("TST-OP", "c"), commandHeld: true }],
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    const r = advanceUntil(s, (x) => x.activePlayer === "player1" && x.phase === "charge");
    expect(r.players.player1.command[0]?.commandHeld).toBe(false);
    const unit = r.players.player1.rush.find((c) => c.instanceId === "SPEC-RESIST:r");
    expect(unit?.commandHeld).toBe(true);
    expect(unit?.registerHeld).toBe(true);
  });

  // 「捨札やコマンド、パワーなどユニットで無くなればホールド状態は解除される」
  it("R-HOLD-02: ホールド状態のユニットがバトルで撃破され捨札になるとホールド状態は残らない（出典: atwiki/page-1289）", () => {
    let s = st({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [{ ...inst("SPEC-RESIST", "r"), commandHeld: true, registerHeld: true }], deck: deckCards(3) },
      player2: { battle: [inst("SPEC-M-WB", "atk")], deck: deckCards(3, "e") },
    });
    s = unwrap(applyAction(s, { type: "battle", playerId: "player2", attackerInstanceId: "SPEC-M-WB:atk", defenderInstanceId: "SPEC-RESIST:r" }));
    for (let i = 0; i < 6; i += 1) {
      const pass = legal(s).find((a) => a.type.startsWith("pass_"));
      if (!pass) break;
      s = unwrap(applyAction(s, pass));
    }
    const card = s.players.player1.discard.find((c) => c.instanceId === "SPEC-RESIST:r");
    expect(card).toBeDefined();
    expect(card?.commandHeld ?? false).toBe(false);
    expect(card?.registerHeld ?? false).toBe(false);
  });

  it.todo(
    "R-HOLD-02: [未確定] 公式ルール rule_phase1-2 の「ホールド状態のカードはすべてリリース」がユニットを含むか（ユニットのホールド概念登場前の記述。公式の後発資料に明言なし）",
  );
});

describe("R-HOLD-03 ホールド状態のユニットに制限はない", () => {
  // 「ホールド状態でも特にユニットとしての働きに制限はない」
  it("R-HOLD-03: ホールド状態のユニットもラッシュエリアからバトルエリアに出られる（出典: atwiki/page-157, page-1289）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [{ ...inst("SPEC-RESIST", "r"), commandHeld: true, registerHeld: true }] },
      player2: { deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "move_to_battle" && a.instanceId === "SPEC-RESIST:r")).toBe(true);
    const r = unwrap(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-RESIST:r" }));
    expect(zoneOf(r, "player1", "SPEC-RESIST:r")).toBe("battle");
  });

  // 「ライドオンやコンビネーションも当然可能」
  it("R-HOLD-03: ホールド状態のRCユニットもビークルにライドしてバトルエリアに出られる（出典: atwiki/page-1289）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [{ ...inst("SPEC-RIDER", "r"), commandHeld: true, registerHeld: true }, inst("SPEC-VEHICLE-S", "v")] },
      player2: { deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "mount_ride" && a.riderInstanceId === "SPEC-RIDER:r")).toBe(true);
  });

  // 「Mユニットをラッシュする際の捨札にも出来る」
  it("R-HOLD-03: ホールド状態のSユニットもMユニットの追加条件（捨札）に使える（出典: atwiki/page-1289）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "m")],
        power: powerCards(4),
        command: [inst("TST-OP-ET", "c")],
        rush: [{ ...inst("SPEC-RESIST", "s"), commandHeld: true, registerHeld: true }],
      },
    });
    const r = unwrap(
      zordRush(s, "player1", "RS-074:m", "TST-OP-ET:c", { zordMaterialInstanceId: "SPEC-RESIST:s", zordMaterialDestination: "discard" }),
    );
    expect(zoneOf(r, "player1", "RS-074:m")).toBe("rush");
    expect(zoneOf(r, "player1", "SPEC-RESIST:s")).toBe("discard");
  });

  // 「一度レジストを行った後…当然使うことは出来ない」
  it("R-HOLD-03: ホールド状態のユニットはレジストを使えない（バトルで撃破されると捨札）（出典: atwiki/page-157, page-1289）", () => {
    let s = st({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [{ ...inst("SPEC-RESIST", "r"), commandHeld: true, registerHeld: true }], deck: deckCards(3) },
      player2: { battle: [inst("SPEC-M-WB", "atk")], deck: deckCards(3, "e") },
    });
    s = unwrap(applyAction(s, { type: "battle", playerId: "player2", attackerInstanceId: "SPEC-M-WB:atk", defenderInstanceId: "SPEC-RESIST:r" }));
    for (let i = 0; i < 6; i += 1) {
      expect(hasLegal(s, (a) => a.type === "use_register")).toBe(false);
      const pass = legal(s).find((a) => a.type.startsWith("pass_"));
      if (!pass) break;
      s = unwrap(applyAction(s, pass));
    }
    expect(zoneOf(s, "player1", "SPEC-RESIST:r")).toBe("discard");
  });

  // 「レジストとウイングなどホールドが必要な能力を複数持つ…普通片方しか使えない」
  it("R-HOLD-03: ホールド状態のウイング持ちユニットはウイング（ホールドしてラッシュエリアからアタック）を使えない（出典: atwiki/page-157）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [{ ...inst("RS-622", "w"), commandHeld: true, registerHeld: true }] },
      player2: { battle: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "hold_for_wing" && a.instanceId === "RS-622:w")).toBe(false);
    expect(hasLegal(s, (a) => a.type === "battle" && a.attackerInstanceId === "RS-622:w")).toBe(false);
  });

  it("R-HOLD-03: リリース状態のウイング持ちユニットはホールドしてウイングを使える（対照）（出典: atwiki/page-157）", () => {
    const s = st({
      phase: "battle",
      player1: { rush: [inst("RS-622", "w")] },
      player2: { battle: [inst("SPEC-S-WB", "e")], deck: deckCards(3) },
    });
    expect(hasLegal(s, (a) => a.type === "hold_for_wing" && a.instanceId === "RS-622:w")).toBe(true);
  });

  it.todo(
    "R-HOLD-03: [未確定] ホールド状態のユニットがバトルエリアからアタック・ストライクできるか（明文なし。ウイングはホールドしてアタックするので妨げないと読める）",
  );

  it.todo(
    "R-HOLD-03: ホールド状態のユニットもコンビネーション（並び順のナンバー）を発動できる（出典: atwiki/page-1289）— ホールド状態ユニットのバトル進入自体が E8 で不可のため、コンビネーション発動を検証する前提状態を作れない",
  );
});

describe("R-HOLD-04 選択時点の状態", () => {
  // 「選んだ時点で…適正な対象であれば、その後…ホールドされてもラッシュすることができます」
  it("R-HOLD-04: ダイナギャリーで選んだリリース状態のダイナマッハを、ジャガーバルカンの効果でそのものをホールドして追加条件に代えラッシュできる（出典: grnrngr/faq-card-2 RS-076 Q3）", () => {
    let s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-197", "gal"), inst("RS-076", "jag")],
        command: [inst("RS-195", "dm")],
        power: powerCards(6),
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });
    s = unwrap(applyAction(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-197:gal" }));
    // パーツキャリアー: コマンドゾーンのリリース状態のMユニットのカード（ダイナマッハ）を選べる
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).toContain("RS-195:dm");
    s = unwrap(applyAction(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-195:dm" }));
    // 以降、母艦の代替でダイナマッハ自身をホールド → ラッシュエリアへ
    for (let i = 0; i < 6 && zoneOf(s, "player1", "RS-195:dm") !== "rush"; i += 1) {
      const acts = legal(s);
      const step =
        acts.find((a) => a.type === "resolve_zord_setup" && "paymentPath" in a && a.paymentPath === "mothership") ??
        acts.find((a) => a.type === "resolve_command_payment" && a.commandInstanceIds.includes("RS-195:dm")) ??
        acts.find((a) => a.type === "resolve_zord_setup");
      if (!step) break;
      s = unwrap(applyAction(s, step));
    }
    expect(zoneOf(s, "player1", "RS-195:dm")).toBe("rush");
  });
});
