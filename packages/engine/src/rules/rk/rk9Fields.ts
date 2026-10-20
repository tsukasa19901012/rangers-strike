/**
 * ザ・マスクドライダーEXP vol.2〜3 RK-169〜RK-189 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk9UnitEffects.ts が記録を書く）。
 *
 * - `rk9ContractCovers`: RK-171 コントラクト（rules/rk/rk2UnitEffects.ts・rk4UnitEffects.ts・rk6UnitEffects.ts のコンビネーションの判定から呼ぶ）。
 * - `rk9EnemyKeywordsNullified`: RK-175 新1号【ライダーキック】（レジスト・スクラム・チェイスの無効。rules/resist.ts・keywords/battleKeywords.ts・keywords/chase.ts）。
 * - `rk9UsePrintedDefenderBp`: RK-182 Zブリンガー（rules/namedUnitEffects.ts）。
 * - `rk9FieldBpBonus`: RK-173 鬼の鎧（rules/fieldAuras.ts）。
 * - `rk9BlocksBattleEntry`: RK-177 蜂女【催眠音波】（rules/restrictions.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";

export const RK9_CONTRACT_RULE = "rk171_contract";
export const RK9_RIDER_KICK_RULE = "rk175_rider_kick";
export const RK9_RIDER_KICK_ATTACKED_RULE = "rk175_attacked";
export const RK9_HACHI_DONE_RULE = "rk177_rush_end_done";
export const RK9_HACHI_NOT_HELD_RULE = "rk177_not_held";
export const RK9_HIGH_VIBE_RULE = "rk181_high_vibe_nail";
export const RK9_ZO_KICK_RULE = "rk183_zo_kick";

/** このターンの記録（kind "rule"・scope "turn"）の payload。 */
export function rk9TurnPayloads<T>(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): T[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T);
}

export function rk9HasInstancePayload(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return rk9TurnPayloads<{ instanceId?: string }>(state, playerId, ruleId).some((p) => p?.instanceId === instanceId);
}

function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

/**
 * RK-171 コントラクト「このターン、選んだユニットは、指定されたユニットからコンビネーションしたときに発動できる効果名を持つ効果を、
 * 指定されたユニットのかわりに、本来の特徴に「ミラーモンスター」を持つユニットからコンビネーションすれば、その効果を発動できる。」（atwiki/page-902）
 * unit がこのターンのコントラクトで選ばれていて、partner の本来の特徴に「ミラーモンスター」があるか。
 */
export function rk9ContractCovers(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, unit: CardInstance, partner: CardInstance | undefined): boolean {
  if (!partner) return false;
  if (!rk9HasInstancePayload(state, playerId, RK9_CONTRACT_RULE, unit.instanceId)) return false;
  return printedFeatures(state, partner.cardId).includes("ミラーモンスター");
}

/** ownerId のユニットのレジスト・スクラム・チェイスが、相手の RK-175【ライダーキック】でこのターン無効か。 */
export function rk9EnemyKeywordsNullified(state: Pick<GameState, "players">, ownerId: PlayerId): boolean {
  return rk9TurnPayloads(state, opponent(ownerId), RK9_RIDER_KICK_RULE).length > 0;
}

/** RK-182【Zブリンガーアタック】「これにライドしているユニットがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。」 */
export function rk9UsePrintedDefenderBp(state: Pick<GameState, "players">, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "effectBattle">): boolean {
  if (pending.effectBattle) return false;
  const p = state.players[pending.attackerPlayerId];
  const attacker = [...p.battle, ...p.rush].find((c) => c.instanceId === pending.attackerInstanceId);
  const vehicleId = attacker?.mountedOnInstanceId;
  if (!vehicleId) return false;
  const vehicle = [...p.battle, ...p.rush].find((c) => c.instanceId === vehicleId);
  return !!vehicle && isSameVehicleTextIdentity(vehicle.cardId, "RK-182");
}

/** RK-173 鬼の鎧「このカードに重ねたユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。」（重ねた枚数分） */
export function rk9FieldBpBonus(state: Pick<GameState, "players" | "activePlayer">, playerId: PlayerId, instance: CardInstance): number {
  const armors = (instance.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, "RK-173")).length;
  if (armors === 0 || state.activePlayer === playerId) return 0;
  const released = state.players[playerId].command.filter((c) => !c.commandHeld).length;
  return armors * released * 1000;
}

function hachiOnField(state: Pick<GameState, "players">): boolean {
  return (["player1", "player2"] as const).some((pid) =>
    [...state.players[pid].battle, ...state.players[pid].rush].some((c) => isSameCardIdentity(c.cardId, "RK-177")),
  );
}

/** RK-177【催眠音波】「ホールドしないことを選んだとき、そのユニットはそのターン中、バトルエリアに出られない。」— 蜂女が場にある間だけ（コメント欄）。 */
export function rk9BlocksBattleEntry(state: Pick<GameState, "players">, playerId: PlayerId, unit: CardInstance): boolean {
  if (!rk9HasInstancePayload(state, playerId, RK9_HACHI_NOT_HELD_RULE, unit.instanceId)) return false;
  return hachiOnField(state);
}

export function rk9HachiOnField(state: Pick<GameState, "players">): boolean {
  return hachiOnField(state);
}
