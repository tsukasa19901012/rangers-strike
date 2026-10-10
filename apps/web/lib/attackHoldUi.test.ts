import { describe, expect, it } from "vitest";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@rangers-strike/engine";
import { applyAction, getLegalActions } from "@rangers-strike/engine";
import { attackHoldOptionLabel, effectChoiceHint, effectChoiceTitle } from "./effectChoiceHint";
import { isKnownEffectChoice } from "./webUiEffectCoverage";

const ALL_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries(
  allCardsCatalog.cards.map((card) => [card.id, card]),
);

function inst(cardId: string, suffix: string, extra: Partial<CardInstance> = {}): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId, ...extra };
}

function player(id: PlayerId, over: Partial<PlayerState>): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    damage: 0,
    ...over,
  };
}

function attackWithSuperPower(): GameState {
  // RS-062 ボウケンレッド（BP4000 の S ユニット）同士。超力の下でアタックする。
  const state: GameState = {
    turn: 1,
    activePlayer: "player1",
    firstPlayer: "player1",
    phase: "battle",
    players: {
      player1: player("player1", {
        operation: [inst("RS-019", "ch")],
        battle: [inst("RS-062", "a")],
        command: [inst("RS-019", "c1", { commandHeld: false }), inst("RS-019", "c2", { commandHeld: false })],
      }),
      player2: player("player2", { battle: [inst("RS-062", "d")] }),
    },
    definitions: ALL_DEFINITIONS,
    log: [],
    winner: null,
  };
  const result = applyAction(state, {
    type: "battle",
    playerId: "player1",
    attackerInstanceId: "RS-062:a",
    defenderInstanceId: "RS-062:d",
  });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("超力のホールド数選択 UI", () => {
  it("アタックするたびに 0〜リリース数の数字ボタンを出し、各ボタンにそのときの BP を表示する", () => {
    const s = attackWithSuperPower();
    const pending = s.pendingEffectChoice!;
    expect(pending.effectId).toBe("attack_hold_bonus");
    expect(isKnownEffectChoice(pending)).toBe(true);
    expect(effectChoiceTitle(pending)).toBe("【アタック時のホールド】");
    expect(effectChoiceHint(pending)).toContain("ホールドする自軍コマンドの数");
    expect(pending.validInstanceIds.map((v) => attackHoldOptionLabel(s, pending, v))).toEqual([
      "0（BP4000 vs 4000）",
      "1（BP5000 vs 4000）",
      "2（BP6000 vs 4000）",
    ]);
    expect(getLegalActions(s).map((a) => a.type)).toEqual([
      "resolve_effect_choice",
      "resolve_effect_choice",
      "resolve_effect_choice",
    ]);
  });
});
