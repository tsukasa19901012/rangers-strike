/**
 * RS-209 ホウオウレンジャー【天風星・一文字竜巻】（NC）
 * 「「SP1」自軍ラッシュエリアのSユニットを、敵軍Sユニットの数まで好きな数選び、手札に戻してもよい。
 * そうしたとき、自分が手札に戻した数と同じ数、相手は自分自身のSユニットを選び手札に戻す。」
 *
 * - 自分: 自軍ラッシュエリアの S ユニットを1体ずつ選んで手札に戻す（任意。見送り・確定でやめる）。
 *   上限は効果の発動時の敵軍 S ユニットの数。
 * - 相手: 戻した数と同じ数だけ、自分の S ユニット（ラッシュエリア・バトルエリア）を選んで手札に戻す（強制）。
 * 出典: atwiki（RS-209）、grnrngr/faq-card-4 RS-209（コロンを戻されても一度得た SP1 は失わない）。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { isSmallUnit } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";

export const HOUOU_TORNADO_EFFECT_ID = "houou_tornado";
export const HOUOU_TORNADO_ENEMY_EFFECT_ID = "houou_tornado_enemy";

function ownRushSmallUnits(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].rush
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

function fieldSmallUnits(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return [...player.rush, ...player.battle]
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

export function startHououTornado(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string | undefined,
  phasePlayerId: PlayerId,
): GameState | null {
  const max = fieldSmallUnits(state, opponent(playerId)).length;
  const own = ownRushSmallUnits(state, playerId);
  if (max === 0 || own.length === 0 || state.pendingEffectChoice) return null;
  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: HOUOU_TORNADO_EFFECT_ID,
      sourceCardId,
      sourceInstanceId,
      kind: "select_unit",
      phasePlayerId,
      validInstanceIds: own,
      selectCount: max,
      selectedInstanceIds: [],
      processedInstanceIds: [],
      optional: true,
    },
    activePlayer: playerId,
  };
}

function bounceFieldUnit(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    const found = findInZone(player, zone, instanceId);
    if (!found) continue;
    const [card, rest] = removeAt(player[zone], found.index);
    return {
      ...state,
      ...updatePlayer(state, playerId, { ...player, [zone]: rest, hand: [...player.hand, card!] }),
    };
  }
  return null;
}

/** 自分の選択を終えたあと、戻した数だけ相手に選ばせる（いなければ終了）。 */
export function finishHououOwnStep(state: GameState, pending: PendingEffectChoice): GameState {
  const count = pending.processedInstanceIds?.length ?? 0;
  const enemyId = opponent(pending.playerId);
  const enemyTargets = fieldSmallUnits(state, enemyId);
  if (count === 0 || enemyTargets.length === 0) {
    return { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  }
  return {
    ...state,
    pendingEffectChoice: {
      ...pending,
      playerId: enemyId,
      effectId: HOUOU_TORNADO_ENEMY_EFFECT_ID,
      validInstanceIds: enemyTargets,
      selectCount: Math.min(count, enemyTargets.length),
      selectedInstanceIds: [],
      processedInstanceIds: [],
      optional: false,
    },
    activePlayer: enemyId,
  };
}

/** 1体選んで手札に戻す。続けて選ぶなら選択を開いたまま返す。 */
export function resolveHououPick(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | null {
  const bounced = bounceFieldUnit(state, pending.playerId, instanceId);
  if (!bounced) return null;
  const processed = [...(pending.processedInstanceIds ?? []), instanceId];
  const limit = pending.selectCount ?? 1;
  const candidates =
    pending.effectId === HOUOU_TORNADO_EFFECT_ID
      ? ownRushSmallUnits(bounced, pending.playerId)
      : fieldSmallUnits(bounced, pending.playerId);
  const next: PendingEffectChoice = { ...pending, validInstanceIds: candidates, processedInstanceIds: processed };
  if (processed.length < limit && candidates.length > 0) {
    return { ...bounced, pendingEffectChoice: next };
  }
  if (pending.effectId === HOUOU_TORNADO_EFFECT_ID) return finishHououOwnStep(bounced, next);
  return { ...bounced, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
}

export function isHououChoice(pending: PendingEffectChoice | undefined): boolean {
  return (
    pending?.effectId === HOUOU_TORNADO_EFFECT_ID || pending?.effectId === HOUOU_TORNADO_ENEMY_EFFECT_ID
  );
}
