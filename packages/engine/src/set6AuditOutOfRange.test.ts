/**
 * set-6 監査で見つかった、第6弾の範囲外カードの不具合の修正の確認。
 *
 * 出典:
 *  - SR-004 へドリアン女王（2nd）【妖魔力】: atwiki/page-578（Q1「リリース状態で置いた後、…ホールド状態になります」）
 *  - RK-062 仮面ライダー電王AF【ダイナミックチョップ】: atwiki/page-167
 *  - RS-141 紐男爵【紐拳】: atwiki/page-336、grnrngr/faq-card-6 RS-417 Q4（紐拳で戻したユニットを【消滅の緋色】で撃破しても後半は行える）
 */
import { describe, expect, it } from "vitest";
import {
  act,
  deckCards,
  enter,
  inst,
  legal,
  pick,
  powerCards,
  st,
  zoneOf,
} from "./cardSpec/RS6-369-389.helpers";
import { effectiveBp } from "./core/catalog";

describe("SR-004 へドリアン女王（2nd）【妖魔力】", () => {
  const chargeState = (cardId: string) =>
    st({
      phase: "charge",
      player1: { hand: [inst(cardId, "c")], deck: deckCards(3) },
      player2: { rush: [inst("SR-004", "hq")], deck: deckCards(3, "e") },
    });

  it("相手の場にあるとき、チャージフェイズにコマンドゾーンに置いた ET のカードはホールド状態になる（出典: atwiki/page-578 Q1）", () => {
    const s = act(chargeState("TST-OP-ET"), { type: "charge_command", playerId: "player1", instanceId: "TST-OP-ET:c" });
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP-ET:c")?.commandHeld).toBe(true);
  });

  it("OT / ET 以外（WB）のカードはリリース状態のまま（出典: atwiki/page-578「OTまたはETのカード」）", () => {
    const s = act(chargeState("TST-OP"), { type: "charge_command", playerId: "player1", instanceId: "TST-OP:c" });
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:c")?.commandHeld).toBe(false);
  });
});

describe("RK-062 仮面ライダー電王AF【ダイナミックチョップ】", () => {
  const entered = () =>
    enter(
      st({
        player1: {
          rush: [inst("RK-062", "x")],
          power: [...powerCards(3), { ...inst("TST-P", "dmg"), faceDown: true }],
          deck: deckCards(5),
        },
        player2: { deck: deckCards(5, "e") },
      }),
      "RK-062:x",
    );

  it("選んだダメージ以外のパワーゾーンのカードを実際に捨札にし、1枚につき BP+1000（出典: atwiki/page-167）", () => {
    let s = entered();
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual(["TST-P:pw0", "TST-P:pw1", "TST-P:pw2"]);
    s = pick(pick(s, "TST-P:pw0"), "TST-P:pw1");
    s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:pw1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:pw2")).toBe("power");
    expect(zoneOf(s, "player1", "TST-P:dmg")).toBe("power");
    const unit = s.players.player1.battle.find((c) => c.instanceId === "RK-062:x")!;
    expect(effectiveBp(s, "player1", unit)).toBe(6000);
  });

  it("捨札にしない（見送る）こともでき、そのときは BP は変わらない（出典: atwiki/page-167「捨札にしてもよい」）", () => {
    let s = entered();
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player1.power).toHaveLength(4);
    const unit = s.players.player1.battle.find((c) => c.instanceId === "RK-062:x")!;
    expect(effectiveBp(s, "player1", unit)).toBe(4000);
  });
});

describe("RS-141 紐男爵【紐拳】", () => {
  it("前半で戻したユニットを【消滅の緋色】で撃破したあと、後半の選択の候補にそのユニットは出ない（出典: atwiki/page-336・grnrngr/faq-card-6 RS-417 Q4）", () => {
    let s = st({
      player1: {
        battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-2", "f2")],
        rush: [inst("RS-141", "hm"), inst("RS-417", "cy")],
        operation: [inst("RS-256", "op")],
        deck: deckCards(5),
      },
      player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")], deck: deckCards(5, "e") },
    });
    s = enter(s, "RS-141:hm");
    for (let i = 0; i < 3 && s.pendingEffectChoice && !s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-0:eb"); i++) {
      const a = legal(s).find((x) => x.type === "resolve_effect_choice" || x.type === "confirm_effect_choice");
      if (!a) break;
      s = act(s, a);
    }
    s = pick(s, "TST-UNIT-0:eb");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-417");
    s = pick(s, "RS-256:op");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["TST-UNIT-2:er"]);
  });
});
