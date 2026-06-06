import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { updatePlayer } from "../core/helpers";

/** 不変プレイヤーパッチ — NC / コンボ効果後の古い状態上書きを防ぐ。 */
export function patchPlayer(
  state: GameState,
  playerId: PlayerId,
  patch: (player: PlayerState) => PlayerState,
): GameState {
  const player = state.players[playerId];
  return { ...state, ...updatePlayer(state, playerId, patch(player)) };
}

export function grantSp1OnPlayer(
  player: PlayerState,
  instanceId: string,
): PlayerState {
  const battle = [...player.battle];
  const index = battle.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return player;
  battle[index] = {
    ...battle[index]!,
    spModifier: (battle[index]!.spModifier ?? 0) + 1,
  };
  return { ...player, battle };
}

export function grantBpBoostOnPlayer(
  player: PlayerState,
  instanceId: string,
  amount: number,
): PlayerState {
  const battle = [...player.battle];
  const index = battle.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return player;
  battle[index] = {
    ...battle[index]!,
    bpModifier: (battle[index]!.bpModifier ?? 0) + amount,
  };
  return { ...player, battle };
}

export function findBattleUnit(
  player: PlayerState,
  instanceId: string,
): CardInstance | undefined {
  return player.battle.find((c) => c.instanceId === instanceId);
}
