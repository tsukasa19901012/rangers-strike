import type { CardDefinition } from "@rangers-strike/cards";
import { legend1Catalog, legend2Catalog, legend3Catalog } from "@rangers-strike/cards";
import type { NumberComboEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import { battlePositionAfterMove, resolveEnterBattleEffects } from "../rules/combo";
import { TEST_DEFINITIONS } from "./fixtures";

export const legendDefinitions: Record<string, CardDefinition> = {
  ...TEST_DEFINITIONS,
  ...Object.fromEntries(legend1Catalog.cards.map((card) => [card.id, card])),
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
  ...Object.fromEntries(legend3Catalog.cards.map((card) => [card.id, card])),
};

export function battleFillers(count: number, prefix = "fill"): CardInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    instanceId: `TST-UNIT-0:${prefix}${index}`,
    cardId: "TST-UNIT-0",
  }));
}

export function moveToBattle(
  state: GameState,
  instanceId: string,
  playerId: PlayerId = "player1",
): GameState {
  const result = applyAction(state, {
    type: "move_to_battle",
    playerId,
    instanceId,
  });
  if (!result.ok) {
    throw new Error(`move_to_battle failed: ${result.error ?? "unknown"}`);
  }
  return result.state;
}

/** 各 NC 効果のログ詳細サフィックス（numberComboEffects の ncLog 参照）。 */
const NC_LOG_DETAIL: Partial<Record<NumberComboEffectId, string>> = {
  grant_sp1: "sp1",
};

export function hasNcLog(state: GameState, effectId: string): boolean {
  const detail = NC_LOG_DETAIL[effectId as NumberComboEffectId] ?? effectId;
  return state.log.some(
    (entry) => entry.includes("number_combo") && entry.includes(detail),
  );
}

export function battleUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): CardInstance | undefined {
  return state.players[playerId].battle.find((card) => card.instanceId === instanceId);
}

/**
 * 効果でユニットをバトルエリアに出したときと同じ処理を、ターンに関係なく行う（テスト用）。
 *
 * 敵軍ターン中に自軍ユニットがバトルエリアに出る状況（例: 相手の効果・ファイブテクター等で出される）を、
 * カードの組み合わせに頼らずに作るためのもの。ユニットを自軍ラッシュエリアからバトルエリアの末尾へ移し、
 * エンジンの進入処理（`resolveEnterBattleEffects`: NC・「バトルエリアに出たとき」の効果）をそのまま実行する。
 * ターンプレイヤー（state.activePlayer）・フェイズは変えないので、「自軍ターン中」の条件はエンジンの判定どおりに働く。
 */
export function enterBattleByEffect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const found = findInZone(player, "rush", instanceId);
  if (!found) throw new Error(`enterBattleByEffect: ${instanceId} is not in ${playerId}'s rush area`);
  const [, rush] = removeAt(player.rush, found.index);
  const battleBeforeEnter = [...player.battle];
  const position = battlePositionAfterMove(player.battle);
  const moved: GameState = {
    ...state,
    ...updatePlayer(state, playerId, { ...player, rush, battle: [...player.battle, found.card] }),
  };
  const result = resolveEnterBattleEffects(moved, playerId, found.card, position, { battleBeforeEnter });
  const next: GameState = { ...result.state, log: [...result.state.log, ...result.logs] };
  // 進入処理で開いた選択がなければ、元のターンプレイヤーの手番に戻す。
  if (next.pendingEffectChoice) return next;
  return { ...next, activePlayer: state.activePlayer };
}
