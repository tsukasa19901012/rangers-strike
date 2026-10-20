import { describe, expect, it } from "vitest";
import { describeAction, humanizeLogEntry } from "./labels";
import { testEngine } from "../testing/engine";

describe("describeAction", () => {
  const state = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
  const handCard = state.players.player1.hand[0]!;
  const name = state.definitions[handCard.cardId]!.name;

  it("labels actions in Japanese with card names", () => {
    expect(describeAction(state, { type: "charge_power", playerId: "player1", instanceId: handCard.instanceId })).toBe(
      `パワーにチャージ: ${name}`,
    );
    expect(describeAction(state, { type: "end_phase", playerId: "player1" })).toMatch(/フェイズ終了$/);
  });

  it("puts card names before other fields", () => {
    const label = describeAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: handCard.instanceId,
      prismSubstitute: false,
    } as never);
    expect(label).toBe(`コマンドを支払って使う: ${name}（種類:カテゴリ）`);
  });

  it("rewrites structured log entries and hides internal markers", () => {
    expect(humanizeLogEntry("phase:battle->end", state)).toBe("── エンドフェイズ ──");
    expect(humanizeLogEntry("player2|pass_battle_entry", state)).toBe("CPU: 進入を終える");
    expect(humanizeLogEntry("player1|command_payment_pending", state)).toBeNull();
    expect(humanizeLogEntry("あなたが1枚ドローした", state)).toBe("あなたが1枚ドローした");
  });

  it("falls back to the raw type for unknown actions", () => {
    expect(describeAction(state, { type: "future_action", playerId: "player1" } as never)).toBe("future_action");
  });
});

describe("describeAction option tokens", () => {
  it("labels option tokens the engine passes in instanceId", () => {
    const state = { players: {}, definitions: {} } as unknown as Parameters<typeof describeAction>[0];
    const action = { type: "resolve_effect_choice", playerId: "player1", instanceId: "deck_top" } as unknown as Parameters<typeof describeAction>[1];
    expect(describeAction(state, action, new Map())).toBe("選ぶ: 山札の上");
  });
});
