/**
 * ザ・マスクドライダーEXP vol.4 RK-253〜RK-273 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk13UnitEffects.ts が記録を書く）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `rk13DefenderBlocksAttack`: RK-257 テントロー【高性能レーダー】・RK-263 バイオライダー【液化】（rules/legend3/restrictions.ts）。
 * - `rk13AttackerCanAttackRush`: RK-262 ロボライダー【ボルティックシューター】（RC を発動したターン。rules/legend3/restrictions.ts）。
 * - `rk13BattleUsesPrintedBp`: RK-268 デスガロン【分析能力】（rules/operationCounters.ts のバトルの解決）。
 * - `rk13BlocksResist`: RK-267 海兵隊長ボスガン【怪魔稲妻剣】（rules/operationCounters.ts のバトルの解決）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";

/** このターン、自分が「女」を持つ敵軍ユニットを撃破して捨札にした（payload: { cardId }。ターンのプレイヤーの記録。RK-258）。 */
export const RK13_FEMALE_DESTROYED_RULE = "rk258_female_destroyed";
/** RK-262【ボルティックシューター】を発動したユニット（payload: { instanceId }）。 */
export const RK13_VOLTIC_RULE = "rk262_voltic_shooter";
/** RK-271【ライジングマイティキック】を発動したユニット（payload: { instanceId }）。 */
export const RK13_KICK_RULE = "rk271_rising_mighty_kick";
/** RK-269【シャドーセイバー】の追加のアタック・ストライクを得たユニット（payload: { instanceId }。1ターンに1度だけ）。 */
export const RK13_SABER_RULE = "rk269_shadow_saber";

const PLAYERS: PlayerId[] = ["player1", "player2"];

/** このターンの記録（kind "rule"・scope "turn"）の payload。 */
export function rk13TurnPayloads<T>(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): T[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => p !== undefined && p !== null);
}

/** このターン、instanceId のユニットが ruleId の記録を持つか。 */
export function rk13HasInstanceRule(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return rk13TurnPayloads<{ instanceId?: string }>(state, playerId, ruleId).some((p) => p.instanceId === instanceId);
}

/** 自軍バトルエリアの並び（ライドしているユニットはビークルの位置に数えない）。 */
function battleSlots(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  return state.players[playerId].battle.filter((c) => !c.mountedOnInstanceId);
}

function isRidden(state: Pick<GameState, "players">, playerId: PlayerId, vehicleInstanceId: string): boolean {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].some((c) => c.mountedOnInstanceId === vehicleInstanceId);
}

/**
 * RK-257 テントロー【高性能レーダー】「ライドされている「カブトロー」からこのビークルがコンビネーションしている間、これにライドしているユニットは
 * 次の能力を得る⇒敵軍ユニットにアタックされない。」（atwiki/page-1358）。テントローが自軍バトルエリアで、ライドされているカブトローの次に並んでいる間。
 */
function tentoroRadarProtects(state: Pick<GameState, "players">, ownerId: PlayerId, defender: CardInstance): boolean {
  const vehicleId = defender.mountedOnInstanceId;
  if (!vehicleId) return false;
  const slots = battleSlots(state, ownerId);
  const i = slots.findIndex((c) => c.instanceId === vehicleId);
  if (i <= 0 || !isSameVehicleTextIdentity(slots[i]!.cardId, "RK-257")) return false;
  const prev = slots[i - 1]!;
  return isSameCardIdentity(prev.cardId, "RK-256") && isRidden(state, ownerId, prev.instanceId);
}

/** 敵軍ユニットにアタックされないか（attacker は defender の敵軍のユニット）。 */
export function rk13DefenderBlocksAttack(
  state: Pick<GameState, "players" | "definitions">,
  attackerPlayerId: PlayerId,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  // RK-263【液化】「このユニットは、ホールド状態のとき敵軍ユニットにアタックされない。」（atwiki/page-1359）。
  if (isSameCardIdentity(defender.cardId, "RK-263") && defender.commandHeld) return true;
  return tentoroRadarProtects(state, defenderPlayerId, defender);
}

/** RK-262【ボルティックシューター】（RC）「これは敵軍ラッシュエリアのユニットにアタックできる。」（atwiki/page-1393）。 */
export function rk13AttackerCanAttackRush(state: Pick<GameState, "players">, attackerPlayerId: PlayerId, attacker: CardInstance): boolean {
  return isSameCardIdentity(attacker.cardId, "RK-262") && rk13HasInstanceRule(state, attackerPlayerId, RK13_VOLTIC_RULE, attacker.instanceId);
}

/** RK-268【分析能力】「これが自軍バトルエリアにある間、すべてのバトルは本来のBPで行う。」（atwiki/page-1349）。どちらの場のデスガロンでも。 */
export function rk13BattleUsesPrintedBp(state: Pick<GameState, "players">): boolean {
  return PLAYERS.some((pid) => state.players[pid].battle.some((c) => isSameCardIdentity(c.cardId, "RK-268")));
}

/** 本来の BP（印刷の BP）。 */
export function rk13PrintedBp(state: Pick<GameState, "definitions">, cardId: string): number {
  const bp = state.definitions[cardId]?.bp;
  return typeof bp === "number" ? bp : 0;
}

/** RK-267【怪魔稲妻剣】「このユニットとバトルして撃破された敵軍ユニットは、レジストを発動する事ができない。」（atwiki/page-1363）。 */
export function rk13BlocksResist(battleOpponentCardId: string | undefined): boolean {
  return !!battleOpponentCardId && isSameCardIdentity(battleOpponentCardId, "RK-267");
}
