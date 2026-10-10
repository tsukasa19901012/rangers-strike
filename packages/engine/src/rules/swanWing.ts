/**
 * RS-284 ホワイトスワン【スワンウィング】（NC）:
 * 敵軍コマンドゾーンにある S ユニットのカードをすべてラッシュエリアに出してもよい。
 *
 * - 出したユニットは持ち主（相手）のラッシュエリアに出て「ラッシュされた」扱い。ラッシュしたときの効果や
 *   「敵軍ユニットがラッシュされたとき」の効果（RS-279 グリーンサイ【サイカッター】等）は発動する
 *   （atwiki/page-472 コメント、faq rider_1 RS-284 の問）。
 * - 必要パワー・追加条件は問わない（「出す」効果）。
 * - 出したユニットごとに、効果ラッシュの共通経路（events/emitUnitRushed `finalizeEffectRush`）で
 *   「ラッシュしたとき」誘発と「ラッシュされたとき」の窓を処理する（R-RUSH-22, R-RUSH-30）。
 *   スワンウィングを使ったプレイヤーのターンなので、カウンター（敵軍ターン中のみ。R-CTR-01）で応答できるのは
 *   出されたユニットの持ち主: RK-012 宏のオルゴール時計（BP4000以上の S ユニット → 使用者はバトルフェイズを飛ばす）、
 *   RS-026／RS-247 疾風流超忍法（BP8000以下 → 持ち主の山札の上。相手に出された自軍ユニットにも使える。
 *   faq-card-1 RS-026 Q2）。使用者は自軍ターンなのでカウンターを使えない（XG7-027 雷撃ディスクも不可）。
 * - 同時に出た複数体の処理順はターンプレイヤー（使用者）が決める（R-SIM-01）。2 体以上なら
 *   `swan_wing_order` の選択で順に選ぶ（最後の 1 体は自動）。
 */
import { getDefinition } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { finalizeEffectRush, markFieldEntryHandled } from "../events/emitUnitRushed";
import { buildLogEntry } from "../log/formatLog";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { openEffectChoice } from "./pendingChoices";

export const SWAN_WING_EFFECT_ID = "swan_wing_deploy_enemy_command_s";
/** 同時に出たユニットの処理順の選択（R-SIM-01）。 */
export const SWAN_WING_ORDER_EFFECT_ID = "swan_wing_order";

export function listSwanWingTargets(state: GameState, playerId: PlayerId): CardInstance[] {
  const enemy = state.players[opponent(playerId)];
  return enemy.command.filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def?.type === "unit" && def.size === "S";
  });
}

/** 「出してもよい」— 使うかどうかを選ぶ（使わないときは skip）。対象がなければ何もしない。 */
export function startSwanWingChoice(
  state: GameState,
  args: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string },
): GameState | null {
  if (listSwanWingTargets(state, args.playerId).length === 0) return null;
  return openEffectChoice(state, {
    playerId: args.playerId,
    effectId: SWAN_WING_EFFECT_ID,
    sourceCardId: args.sourceCardId,
    sourceInstanceId: args.sourceInstanceId,
    kind: "confirm",
    phasePlayerId: args.phasePlayerId,
    validInstanceIds: [SWAN_WING_EFFECT_ID],
    optional: true,
  });
}

/** 敵軍コマンドゾーンの S ユニットをすべて（同時に）持ち主のラッシュエリアに出す。 */
export function applySwanWing(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId): GameState {
  const enemyId = opponent(playerId);
  const targets = listSwanWingTargets(state, playerId);
  if (targets.length === 0) return state;
  const ids = new Set(targets.map((c) => c.instanceId));
  const enemy = state.players[enemyId];
  const nextEnemy = {
    ...enemy,
    command: enemy.command.filter((c) => !ids.has(c.instanceId)),
    rush: [
      ...enemy.rush,
      ...targets.map((c) => ({ ...c, commandHeld: undefined, faceDown: undefined, paymentHeld: undefined })),
    ],
  };
  const placed: GameState = {
    ...state,
    ...updatePlayer(state, enemyId, nextEnemy),
    log: [
      ...state.log,
      buildLogEntry(playerId, "named_effect", "RS-284", state.definitions, `swan_wing:${targets.length}`),
    ],
  };
  const placedIds = targets.map((c) => c.instanceId);
  // 誘発・窓はこの効果で処理する（applyAction 後処理の効果ラッシュ検出から外す）。
  const handled = markFieldEntryHandled(placed, placedIds);
  if (placedIds.length >= 2) {
    return openSwanWingOrderChoice(handled, playerId, phasePlayerId, placedIds, []);
  }
  return processSwanWingRushes(handled, enemyId, placedIds, phasePlayerId);
}

function openSwanWingOrderChoice(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  remaining: string[],
  ordered: string[],
): GameState {
  return openEffectChoice(state, {
    playerId,
    effectId: SWAN_WING_ORDER_EFFECT_ID,
    sourceCardId: "RS-284",
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: remaining,
    selectedInstanceIds: ordered,
    optional: false,
  });
}

/**
 * 処理順の選択: 選んだユニットを次に処理する。残りが 1 体になったら順番が決まるので、
 * 決めた順に「ラッシュしたとき」誘発と「ラッシュされたとき」窓を処理する。
 */
export function resolveSwanWingOrderChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; log: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== SWAN_WING_ORDER_EFFECT_ID) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const ordered = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  const log = buildLogEntry(playerId, "resolve_effect_choice", "RS-284", state.definitions, `swan_wing_order:${instanceId}`);
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  if (remaining.length >= 2) {
    return { state: openSwanWingOrderChoice(cleared, playerId, pending.phasePlayerId, remaining, ordered), log };
  }
  return {
    state: processSwanWingRushes(cleared, opponent(playerId), [...ordered, ...remaining], pending.phasePlayerId),
    log,
  };
}

function processSwanWingRushes(
  state: GameState,
  ownerId: PlayerId,
  orderedIds: string[],
  phasePlayerId: PlayerId,
): GameState {
  // ルール: R-RUSH-01, R-RUSH-22, R-RUSH-30 — 効果で出たユニットも「ラッシュされた」扱い。1体ずつ
  // 「ラッシュしたとき」誘発の後に「ラッシュされたとき」の窓を開き、窓が閉じてから次へ（残りはキューで続行）。
  const result = finalizeEffectRush(state, ownerId, orderedIds, phasePlayerId);
  return result.logs.length > 0 ? { ...result.state, log: [...result.state.log, ...result.logs] } : result.state;
}
