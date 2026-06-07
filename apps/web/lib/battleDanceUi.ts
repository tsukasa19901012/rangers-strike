import { getCardEffect } from "@rangers-strike/cards";
import type { GameAction } from "@rangers-strike/engine";
import {
  countReleasedCommands,
  hasOperationEffect,
  isSmallUnit,
  type GameState,
  type PlayerId,
} from "@rangers-strike/engine";

export function sameBattleDanceCommandPair(
  a: readonly [string, string],
  b: readonly [string, string],
): boolean {
  const left = [...a].sort().join("\0");
  const right = [...b].sort().join("\0");
  return left === right;
}

/** バトルダンスのコスト候補（リリース状態の自軍コマンド）。 */
export function listBattleDanceReleasedCommandIds(
  state: GameState,
  playerId: PlayerId,
): string[] {
  if (state.phase !== "battle") return [];
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "battle_dance", state.definitions)) return [];
  return player.command.filter((card) => !card.commandHeld).map((card) => card.instanceId);
}

/** 選択したコマンド2枚で戻せる自軍バトルSユニット。 */
export function listBattleDanceTargetsForCommands(
  legalActions: GameAction[],
  commandInstanceIds: [string, string],
): string[] {
  const ids = new Set<string>();
  for (const action of legalActions) {
    if (action.type !== "battle_dance_retreat") continue;
    if (!sameBattleDanceCommandPair(action.commandInstanceIds, commandInstanceIds)) continue;
    ids.add(action.battleInstanceId);
  }
  return [...ids];
}

/** 対象が選べないときの説明文。 */
export function explainBattleDanceUnavailable(
  state: GameState,
  playerId: PlayerId,
): string {
  if (state.phase !== "battle") {
    return "バトルフェイズでのみ発動できます。";
  }

  const player = state.players[playerId];
  if (!hasOperationEffect(player, "battle_dance", state.definitions)) {
    return "オペレーションゾーンに「バトルダンス」が必要です。";
  }
  if (countReleasedCommands(player) < 2) {
    return "リリース状態の自軍コマンドが2枚必要です。";
  }

  const hasTarget = player.battle.some((card) =>
    isSmallUnit(state.definitions, card.cardId),
  );
  if (!hasTarget) {
    return "バトルエリアに戻せるSユニットがありません。";
  }

  const effectText = getCardEffect("RS-003")?.text;
  return effectText ?? "今は発動できません。";
}

export function findBattleDanceAction(
  legalActions: GameAction[],
  commandInstanceIds: [string, string],
  battleInstanceId: string,
): Extract<GameAction, { type: "battle_dance_retreat" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "battle_dance_retreat" }> =>
      action.type === "battle_dance_retreat" &&
      action.battleInstanceId === battleInstanceId &&
      sameBattleDanceCommandPair(action.commandInstanceIds, commandInstanceIds),
  );
}
