import { COMMAND_ZONE_MAX, type GameState, type PlayerId } from "@rangers-strike/engine";

/** サイバースライダーでホールド候補になる手札（オペレーション自身を除く）。 */
export function listCyberSRiderHandCandidates(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): string[] {
  return state.players[playerId].hand
    .filter((card) => card.instanceId !== operationInstanceId)
    .map((card) => card.instanceId);
}

/** 手札1〜2枚の選択が有効か（コマンドゾーン上限・手札在籍を確認）。 */
export function canSelectCyberSRiderHand(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
  selectedIds: string[],
): boolean {
  if (selectedIds.length === 0 || selectedIds.length > 2) return false;

  const player = state.players[playerId];
  if (player.command.length + selectedIds.length > COMMAND_ZONE_MAX) return false;

  const handIds = new Set(player.hand.map((card) => card.instanceId));
  for (const id of selectedIds) {
    if (id === operationInstanceId || !handIds.has(id)) return false;
  }
  return true;
}
