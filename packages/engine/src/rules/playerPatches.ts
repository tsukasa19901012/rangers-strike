import type { SpValue } from "@rangers-strike/cards";
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

export function grantSpOverrideOnPlayer(
  player: PlayerState,
  instanceId: string,
  sp: SpValue,
  zone: "hand" | "rush" | "battle" = "battle",
): PlayerState {
  const cards = [...player[zone]];
  const index = cards.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return player;
  cards[index] = { ...cards[index]!, spOverride: sp };
  return { ...player, [zone]: cards };
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
