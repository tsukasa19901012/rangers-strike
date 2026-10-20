/**
 * 効果で場（バトル・ラッシュエリア）のカードを、撃破ではなく別のゾーンへ移す処理の共通部品。
 *
 * ルール: R-KW-CHASE-01 — チェイスは「これがライド中にユニットでなくなる時」に使え、撃破に限らずパワー送り・コマンド送りにも
 * 使える（atwiki/page-1292「バトルでの撃破のみならず、パワー送りやコマンド送りなどにも対応できる」）。持ち主のコマンドゾーンに
 * 置く効果も、離場の処理（rules/operationCounters.ts tryLeaveField）を通して、チェイス・「場を離れるとき」の応答の機会を出す。
 *
 * 複数枚をまとめて移す効果（「すべて…置く」）は並び順に1枚ずつ処理する。チェイス等の応答で止まったら、残りは待ち行列
 * （GameState.queuedFieldLeaves）に置き、その応答の解決後（core/applyAction.ts の後処理）に続ける。
 */
import type { GameState, PendingLeave, PlayerId } from "../types/game";
import { tryLeaveField } from "./operationCounters";

function fieldZoneOf(state: Pick<GameState, "players">, ownerId: PlayerId, instanceId: string): "battle" | "rush" | null {
  const p = state.players[ownerId];
  if (p.battle.some((c) => c.instanceId === instanceId)) return "battle";
  if (p.rush.some((c) => c.instanceId === instanceId)) return "rush";
  return null;
}

/** 場のカードを撃破ではない移動で toZone へ送る離場の意図（場になければ undefined）。 */
export function fieldMoveIntent(
  state: Pick<GameState, "players">,
  ownerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
  toZone: "command" | "discard",
): PendingLeave | undefined {
  const fromZone = fieldZoneOf(state, ownerId, instanceId);
  if (!fromZone) return undefined;
  const card = state.players[ownerId][fromZone].find((c) => c.instanceId === instanceId)!;
  return {
    ownerPlayerId: ownerId,
    instanceId,
    fromZone,
    toZone,
    leavingCardId: card.cardId,
    phasePlayerId,
    notDestruction: true,
    skipRegister: true,
  };
}

/** 離場の応答（チェイス・「場を離れるとき」のカウンター・レジスト）やダメージの支払いが開いているか。 */
function leaveBlocked(state: GameState): boolean {
  return !!(state.pendingChase || state.pendingLeave || state.pendingRegister || state.pendingDamagePayment || state.winner);
}

/**
 * 待ち行列の離場を順に処理する。応答が開いたらそこで止める（続きは後処理で再び呼ぶ）。
 * 割り込みで場を離れたカードは飛ばす（R-TIME-04）。
 */
export function drainQueuedFieldLeaves(state: GameState): GameState {
  let next = state;
  for (let guard = 0; guard < 100; guard += 1) {
    const queue = next.queuedFieldLeaves;
    if (!queue || queue.length === 0) break;
    if (leaveBlocked(next)) return next;
    const [head, ...rest] = queue;
    next = { ...next, queuedFieldLeaves: rest.length > 0 ? rest : undefined };
    const intent = fieldMoveIntent(next, head!.ownerPlayerId, head!.instanceId, head!.phasePlayerId, head!.toZone as "command" | "discard");
    if (!intent) continue;
    next = tryLeaveField(next, { ...head!, fromZone: intent.fromZone, leavingCardId: intent.leavingCardId }).state;
  }
  if (next.queuedFieldLeaves && next.queuedFieldLeaves.length === 0) {
    const { queuedFieldLeaves: _q, ...rest } = next;
    return rest as GameState;
  }
  return next;
}

/** intents を順に離場の処理に通す（応答で止まったら残りは解決後に続ける）。 */
export function leaveFieldInOrder(state: GameState, intents: PendingLeave[]): GameState {
  if (intents.length === 0) return state;
  return drainQueuedFieldLeaves({ ...state, queuedFieldLeaves: [...(state.queuedFieldLeaves ?? []), ...intents] });
}

/**
 * 場のカード（ユニット・ビークル）を、持ち主のコマンドゾーンにホールド状態で置く（置けなければ捨札。R-ZONE-08）。撃破ではない。
 * ids の順に1枚ずつ置く。ライド中のチェイス持ちのユニットには、チェイスの機会が出る（R-KW-CHASE-01）。
 */
export function sendFieldCardsToCommandHeld(state: GameState, ownerId: PlayerId, ids: string[], phasePlayerId: PlayerId): GameState {
  const intents = ids
    .map((id) => fieldMoveIntent(state, ownerId, id, phasePlayerId, "command"))
    .filter((i): i is PendingLeave => !!i);
  return leaveFieldInOrder(state, intents);
}

/**
 * 「すべて持ち主のコマンドゾーンに置く。置けなければ捨札にする」で、置くカードと捨札にするカードを先に決めたもの（RS-282 等）。
 * 置くカードから順に、どちらも離場の処理を通す（捨札にするのは撃破ではない）。
 */
export function sendFieldCardsToCommandOrDiscard(
  state: GameState,
  ownerId: PlayerId,
  toCommand: string[],
  toDiscard: string[],
  phasePlayerId: PlayerId,
): GameState {
  const intents = [
    ...toCommand.map((id) => fieldMoveIntent(state, ownerId, id, phasePlayerId, "command")),
    ...toDiscard.map((id) => fieldMoveIntent(state, ownerId, id, phasePlayerId, "discard")),
  ].filter((i): i is PendingLeave => !!i);
  return leaveFieldInOrder(state, intents);
}
