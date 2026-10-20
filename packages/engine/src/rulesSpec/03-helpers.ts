/**
 * docs/rules/03-turn.md 用のテストヘルパー。
 * 公開 API（applyAction / getLegalActions / createTestState）だけで状況を組み立てる。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { legendDefinitions } from "../testing/battleEntry";
import { createTestState, inst, TEST_DEFINITIONS } from "../testing/fixtures";

export { createTestState, inst, legendDefinitions };

/** テスト用ビークル（RC ライダーと組み合わせる）。 */
export const VEHICLE_DEF: CardDefinition = {
  id: "TST-VEHICLE",
  name: "テストビークル",
  type: "vehicle",
  category: "WB",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  size: "S",
};

export const RIDER_DEF: CardDefinition = {
  id: "TST-RIDER",
  name: "テストライダー",
  type: "unit",
  category: "WB",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 2000,
  sp: 1,
  size: "S",
  comboNumber: "RC",
};

/** 実カード（legend1〜3）＋テスト用カード。 */
export function allDefs(extra: CardDefinition[] = []): Record<string, CardDefinition> {
  return {
    ...legendDefinitions,
    ...TEST_DEFINITIONS,
    ...Object.fromEntries(extra.map((d) => [d.id, d])),
  };
}

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.state;
}

export function act(state: GameState, action: GameAction): GameState {
  return unwrap(applyAction(state, action));
}

export function legal(state: GameState, playerId?: PlayerId): GameAction[] {
  return getLegalActions(state).filter((a) => !playerId || a.playerId === playerId);
}

export function hasLegal(
  state: GameState,
  type: GameAction["type"],
  playerId?: PlayerId,
  pred: (a: GameAction) => boolean = () => true,
): boolean {
  return legal(state, playerId).some((a) => a.type === type && pred(a));
}

export function cards(prefix: string, count: number, cardId = "TST-OP"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst(cardId, `${prefix}${i}`));
}

/** 任意の効果選択はスキップし、ラッシュ・バトル進入反応はパスする。 */
export function settle(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 20; i += 1) {
    if (next.pendingRush) {
      const r = applyAction(next, { type: "pass_rush_reaction", playerId: next.activePlayer });
      if (r.ok) {
        next = r.state;
        continue;
      }
    }
    if (next.pendingBattleEntry) {
      const r = applyAction(next, {
        type: "pass_battle_entry",
        playerId: next.pendingBattleEntry.playerId,
      });
      if (r.ok) {
        next = r.state;
        continue;
      }
    }
    const choice = next.pendingEffectChoice;
    if (choice?.optional) {
      const r = applyAction(next, { type: "skip_effect_choice", playerId: choice.playerId });
      if (r.ok) {
        next = r.state;
        continue;
      }
    }
    break;
  }
  return next;
}

/** ターンプレイヤーが end_phase を宣言し続け、相手のターンになるまで進める。 */
export function endTurn(state: GameState): GameState {
  const me = state.activePlayer;
  let next = settle(state);
  for (let i = 0; i < 10 && next.activePlayer === me && !next.winner; i += 1) {
    next = settle(act(next, { type: "end_phase", playerId: me }));
  }
  return next;
}

/** スタートフェイズの3行程を指定順で行う（不要な行程は飛ばす）。 */
export function doStartSteps(
  state: GameState,
  order: Array<"release" | "return" | "draw">,
): GameState {
  const pid = state.activePlayer;
  let next = state;
  for (const step of order) {
    if (next.phase !== "start") break;
    if (step === "release" && hasLegal(next, "release_start_commands", pid)) {
      next = settle(act(next, { type: "release_start_commands", playerId: pid }));
    }
    if (step === "return" && hasLegal(next, "return_all_battle_to_rush", pid)) {
      next = settle(act(next, { type: "return_all_battle_to_rush", playerId: pid }));
    }
    if (step === "draw" && hasLegal(next, "draw", pid)) {
      next = settle(act(next, { type: "draw", playerId: pid }));
    }
  }
  return next;
}
