/**
 * docs/rules/07-keywords.md「ブレイカー」節（R-KW-BREAKER-01〜03）のルール仕様テスト。
 * 出典: atwiki/page-2355（Q1〜Q7・本文）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { act, canRush, hasLegal, inst, KW, powerCards, realDef, state, unitDef, vehicleDef, where } from "./07-helpers";

const BRK = unitDef("RSPEC-BRK", { name: "仮面ライダーW・CJX", bp: 3000, text: KW.breaker });
const SAME_PLAIN = unitDef("RSPEC-SAME", { name: "仮面ライダーW・CJX", bp: 3000 });
const OTHER = unitDef("RSPEC-OTHER", { name: "別のユニット", bp: 3000 });

function rushPhase(hand: CardInstance[], rush: CardInstance[], extra: CardDefinition[] = []): GameState {
  return state([BRK, SAME_PLAIN, OTHER, ...extra], {
    phase: "rush",
    player1: { hand, rush, command: [inst("TST-OP", "c")], power: powerCards(6) },
  });
}

/** RS-245 ガオメインバスター（WB 5）「敵軍Sユニットを1体選び撃破する。」を対象付きで使えるか。 */
function canPlayGaoMainBusterOn(s: GameState, target: string): boolean {
  return hasLegal(s, (a) => a.type === "play_operation" && a.targetInstanceId === target);
}

describe("R-KW-00 共通（キーワードは※記載のものだけ）", () => {
  // 「【モスブレイカー】はブレイカーではない」
  it("R-KW-00: 効果名【モスブレイカー】を持つだけのユニットは、同名が場にいてもラッシュできる（ブレイカーではない）（出典: docs/rules/07 R-KW-00）", () => {
    // 既知の不具合: E12（テキスト部分一致で判定）
    const MOTH = unitDef("RSPEC-MOTH", { name: "モスラ", text: "【モスブレイカー】これがバトルエリアに出たとき、敵軍Sユニットを1体選びホールドする。" });
    const s = state([MOTH], {
      phase: "rush",
      player1: { hand: [inst(MOTH.id, "h")], rush: [inst(MOTH.id, "f")], command: [inst("TST-OP", "c")], power: powerCards(6) },
    });
    expect(canRush(s, `${MOTH.id}:h`)).toBe(true);
  });
});

describe("R-KW-BREAKER-01 規定文", () => {
  // 「同名の自軍ユニット…があるとき、これはラッシュすることができない」
  it("R-KW-BREAKER-01: 同名のブレイカー持ち自軍ユニットがいるとき、ブレイカー持ちはラッシュできない（出典: atwiki/page-2355 A1 規定文）", () => {
    const s = rushPhase([inst(BRK.id, "h")], [inst(BRK.id, "f")]);
    expect(canRush(s, `${BRK.id}:h`)).toBe(false);
    // 対照: 同名がいなければラッシュできる
    expect(canRush(rushPhase([inst(BRK.id, "h")], [inst(OTHER.id, "o")]), `${BRK.id}:h`)).toBe(true);
  });

  // 「本来のカード名がこれと同名の自軍ユニットまたは自軍ビークル」
  it("R-KW-BREAKER-01: 同名の自軍ビークルがあるときもブレイカー持ちはラッシュできない（出典: atwiki/page-2355 A1 規定文）", () => {
    // 既知の不具合: E15（場の同名がブレイカー持ちのときだけ禁止）
    const SAME_V = vehicleDef("RSPEC-SAME-V", { name: "仮面ライダーW・CJX" });
    const s = rushPhase([inst(BRK.id, "h")], [inst(SAME_V.id, "v")], [SAME_V]);
    expect(canRush(s, `${BRK.id}:h`)).toBe(false);
  });

  // 「ブレイカーを持たない、敵軍ユニット…の効果に選ばれない」
  it("R-KW-BREAKER-01: ブレイカーを持たない敵軍ユニットの効果（RS-050 アバレンオー）には選ばれない（出典: atwiki/page-2355 A1 規定文）", () => {
    const b = inst(BRK.id, "b");
    const n = inst(OTHER.id, "n");
    let s = state([BRK, OTHER, realDef("RS-050")], {
      phase: "battle",
      player1: { rush: [inst("RS-050", "z")] },
      player2: { battle: [b, n] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-050:z" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(n.instanceId);
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain(b.instanceId);
  });

  // 「ブレイカーを持たない」敵軍ユニットの効果だけを防ぐ
  it("R-KW-BREAKER-01: ブレイカーを持つ敵軍ユニットの効果には選ばれる（出典: atwiki/page-2355 A1 規定文）", () => {
    const BRK_ZORD = { ...realDef("RS-050"), text: `${realDef("RS-050").text ?? ""} ${KW.breaker}` };
    const b = inst(BRK.id, "b");
    let s = state([BRK, BRK_ZORD], {
      phase: "battle",
      player1: { rush: [inst("RS-050", "z")] },
      player2: { battle: [b] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-050:z" });
    expect(s.pendingEffectChoice?.validInstanceIds).toContain(b.instanceId);
  });

  // 「この効果は無効化されない」
  it.todo("R-KW-BREAKER-01: 「この効果は無効化されない」（効果名を持たない効果を無効にする効果を当てる手段がエンジン API にない）");
});

describe("R-KW-BREAKER-02 同名ラッシュ制限", () => {
  // 「その逆はできない」（ブレイカー持ちは、ブレイカーなし同名がいるとラッシュ不可）
  it("R-KW-BREAKER-02: ブレイカーを持たない同名ユニットが自軍にいても、ブレイカー持ちはラッシュできない（出典: atwiki/page-2355 本文）", () => {
    // 既知の不具合: E15（場の同名がブレイカー持ちのときだけ禁止）
    const s = rushPhase([inst(BRK.id, "h")], [inst(SAME_PLAIN.id, "f")]);
    expect(canRush(s, `${BRK.id}:h`)).toBe(false);
  });

  // 「ブレイカーを持たない同名ユニットならラッシュでき」
  it("R-KW-BREAKER-02: ブレイカー持ちが場にいても、ブレイカーを持たない同名ユニットはラッシュできる（出典: atwiki/page-2355 本文）", () => {
    const s = rushPhase([inst(SAME_PLAIN.id, "h")], [inst(BRK.id, "f")]);
    expect(canRush(s, `${SAME_PLAIN.id}:h`)).toBe(true);
  });

  // 「本来のカード名がこれと同名の自軍ユニット」（敵軍の同名は関係ない）
  it("R-KW-BREAKER-02: 敵軍に同名のブレイカー持ちがいても、自軍にいなければラッシュできる（出典: atwiki/page-2355 A1 規定文「自軍ユニット」）", () => {
    const s = state([BRK], {
      phase: "rush",
      player1: { hand: [inst(BRK.id, "h")], command: [inst("TST-OP", "c")], power: powerCards(6) },
      player2: { rush: [inst(BRK.id, "enemy")] },
    });
    expect(canRush(s, `${BRK.id}:h`)).toBe(true);
  });
});

describe("R-KW-BREAKER-03 選ばれない範囲", () => {
  // 「選ぶのが自分であっても…選ぶことはできません」
  it.fails("R-KW-BREAKER-03: 敵軍ユニットの効果で自分が自分自身のユニットを選ぶときも、ブレイカー持ちは選べない（出典: atwiki/page-2355 Q2）", () => {
    // 既知の不具合: E15（自分が選ぶ場合は素通し）
    // RK-264 アクロバッター／XG6-040 ジョーカーの効果は起動経路がないため、対象可否判定を直接確かめる
    const b = inst(BRK.id, "b");
    const s = state([BRK, realDef("RK-264")], { phase: "battle", player2: { battle: [b] } });
    expect(isSelectableByOpponentEffect(s, "player2", b.instanceId, "RK-264")).toBe(false);
  });

  // 「パワーゾーンにあるカードの効果は、ユニットの効果ではない」
  it.todo("R-KW-BREAKER-03: 自軍パワーゾーンの RK-143 ウラタロスの効果ではブレイカー持ちを選べる（出典: atwiki/page-2355 Q3。パワーゾーン起動の効果をエンジン API で起動できない）");

  // 「【俺達の必殺技】の効果は敵軍ユニットを選んではいない」
  it.todo("R-KW-BREAKER-03: XG5-052 電王CF【俺達の必殺技】でバトルで撃破したブレイカー持ちをパワーゾーンに送れる（出典: atwiki/page-2355 Q4。【俺達の必殺技】が DSL 未実装）");

  // 「手札から見せたカードの効果は、ユニットの効果ではない」
  it.todo("R-KW-BREAKER-03: XG6-003 で手札から見せた RS-168【爆竜必殺クロスサンダー】ではブレイカー持ちを選べる（出典: atwiki/page-2355 Q5。手札公開効果の起動経路がない）");

  // 「【戦いのリセット】の効果はユニットを選んではいない」
  it.todo("R-KW-BREAKER-03: RK-286 オーディン【戦いのリセット】で必要パワーを満たしていないブレイカー持ちも撃破される（出典: atwiki/page-2355 Q6。RK-286 を追加条件込みでラッシュする経路を組めない）");

  // 「適切な対象がいないので、【荒ぶる折神】の効果は解決に失敗します」
  it("R-KW-BREAKER-03: 敵軍ユニットがブレイカー持ちだけなら、XG4-037 牛折神【荒ぶる折神】は解決に失敗し、ブレイカー持ちはダメージにならない（出典: atwiki/page-2355 Q7）", () => {
    const b = inst(BRK.id, "b");
    let s = state([BRK, realDef("XG4-037")], {
      phase: "rush",
      player1: { hand: [inst("XG4-037", "u")], command: [inst("TST-OP-MA", "c")], power: powerCards(6), damage: 6 },
      player2: { battle: [b], damage: 5 },
    });
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "XG4-037:u" });
    s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-MA:c"] });
    expect(where(s, "player2", b.instanceId)).toBe("battle");
    expect(s.players.player2.damage).toBe(5);
  });

  // 「オペレーションの効果は防げない」
  it("R-KW-BREAKER-03: オペレーション（RS-245 ガオメインバスター）の効果ではブレイカー持ちを選べる（出典: atwiki/page-2355 本文）", () => {
    // 既知の不具合: E15（オペレーションからも保護）
    const b = inst(BRK.id, "b");
    const s = state([BRK, realDef("RS-245")], {
      phase: "rush",
      player1: {
        hand: [inst("RS-245", "o")],
        command: [{ ...inst("TST-OP", "c"), commandHeld: true }],
        power: powerCards(6),
      },
      player2: { battle: [b] },
    });
    expect(canPlayGaoMainBusterOn(s, b.instanceId)).toBe(true);
  });

  // 「ゾーンや手札にある状態で…選ぶことはできる」
  it.todo("R-KW-BREAKER-03: ゾーン・手札にあるブレイカー持ちのカードは効果で選べる（出典: atwiki/page-2355 本文。該当効果カードの起動経路がない）");
});
