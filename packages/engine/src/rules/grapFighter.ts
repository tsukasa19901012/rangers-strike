/**
 * RS-221 タイムイエロー【グラップファイター】（NC）:
 * 敵軍バトルエリアにあるSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、敵軍ラッシュエリアに、
 * 戻したユニット以外のユニットがあれば1体選び、戻したユニットとバトルさせる。戻したユニット以外にユニットが無ければ、
 * 相手に1点ダメージを与える。
 *
 * 敵軍ユニット同士のバトルは BP を比べ、BP の低い方（同じなら両方）が撃破される（ルール: R-BTL-02）。
 * RS-313 クワガライジャー【イカヅチブレイカー】（NC）は「相手に1点ダメージ」の一文がないほかは同じ効果。
 *
 * 効果を使ったプレイヤーのバトルフェイズ中の撃破なので、闇の戒律等の「敵軍ユニットを撃破するたび」を満たす（faq-card-5 RS-256）。
 */
import { effectiveBp, getDefinition, unitSizeOf } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import type { GameState, PlayerId } from "../types/game";
import { applyDamageToPlayer } from "./damagePayment";

export const GRAP_FIGHTER_EFFECT_ID = "gurapufuaita";
export const GRAP_FIGHTER_BATTLE_EFFECT_ID = "gurapufuaita_battle";

/** NC 成立時: 敵軍バトルエリアの S ユニットを選ぶ（任意）。 */
export function startGrapFighter(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  sourceCardId: "RS-221" | "RS-313" = "RS-221",
): GameState {
  if (state.pendingEffectChoice) return state;
  const enemy = state.players[opponent(playerId)];
  const valid = enemy.battle
    .filter((c) => unitSizeOf(state.definitions, c) === "S")
    .map((c) => c.instanceId);
  if (valid.length === 0) return state;
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: GRAP_FIGHTER_EFFECT_ID,
      sourceCardId,
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: true,
    },
    activePlayer: playerId,
  };
}

/**
 * 選んだ敵軍 S ユニットを敵軍ラッシュエリアに戻す。ほかに敵軍ラッシュエリアのユニットがあればバトル相手の選択を開き、
 * 無ければ相手に1点ダメージを与える。
 */
export function resolveGrapFighterReturn(state: GameState, instanceId: string): GameState | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== GRAP_FIGHTER_EFFECT_ID) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return null;
  const userId = pending.playerId;
  const enemyId = opponent(userId);
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "battle", instanceId);
  if (!found) return null;
  const [, battle] = removeAt(enemy.battle, found.index);
  const returned = { ...found.card, battleActed: undefined };
  let next: GameState = {
    ...state,
    ...updatePlayer(state, enemyId, { ...enemy, battle, rush: [...enemy.rush, returned] }),
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
  };
  const others = next.players[enemyId].rush.filter((c) => c.instanceId !== instanceId).map((c) => c.instanceId);
  if (others.length === 0) {
    // RS-313 クワガライジャー【イカヅチブレイカー】は同じ文面だが、ダメージの一文がない。
    if (pending.sourceCardId === "RS-313") return next;
    return applyDamageToPlayer(next, enemyId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
  }
  next = {
    ...next,
    pendingEffectChoice: {
      ...pending,
      effectId: GRAP_FIGHTER_BATTLE_EFFECT_ID,
      validInstanceIds: others,
      selectedInstanceIds: [],
      optional: false,
      // 戻したユニット（バトルさせる相手）
      processedInstanceIds: [instanceId],
    },
    activePlayer: userId,
  };
  return next;
}

/** バトルさせる2体の BP を比べ、撃破される側（敵軍ユニット）の instanceId を返す。 */
export function grapFighterLosers(state: GameState, returnedId: string, opponentUnitId: string): string[] {
  const pending = state.pendingEffectChoice;
  const enemyId = pending ? opponent(pending.playerId) : "player2";
  const rush = state.players[enemyId].rush;
  const a = rush.find((c) => c.instanceId === returnedId);
  const b = rush.find((c) => c.instanceId === opponentUnitId);
  if (!a || !b) return [];
  const bpA = effectiveBp(state, enemyId, a);
  const bpB = effectiveBp(state, enemyId, b);
  const losers: string[] = [];
  if (bpA <= bpB) losers.push(returnedId);
  if (bpB <= bpA) losers.push(opponentUnitId);
  return losers;
}
