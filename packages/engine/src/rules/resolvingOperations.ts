import { getDefinition } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { isPermanentCard } from "../effects/resolveOperation";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { placePermanentOperation } from "./permanentOperation";

/**
 * 使用したオペレーション（カウンターを含む）の行き先の保証。
 *
 * ルール: R-CARD-03 — 使ったオペレーションは効果の解決後に捨札（常駐オペレーションは常駐置き場）に置く。
 * カード個別の処理は「効果の解決が選択待ちで中断した」場合に捨札へ置くのを選択の解決側に任せているが、
 * 選択の解決側が置き忘れると、使ったカードがどのゾーンにも存在しなくなる（RS-349 スーパー戦隊アドレスブック等）。
 * applyAction の後処理で、手札から消えてどのゾーンにもないオペレーションを「解決中」として記録し、
 * 解決が終わった（保留中の処理がなくなった）時点で、まだどのゾーンにもなければ捨札（常駐は常駐置き場）に置く。
 */

const PLAYER_IDS: PlayerId[] = ["player1", "player2"];

const ZONES = [
  "deck",
  "hand",
  "discard",
  "power",
  "command",
  "rush",
  "battle",
  "operation",
  "exile",
  "commander",
] as const;

function containsInstance(cards: CardInstance[] | undefined, instanceId: string): boolean {
  if (!cards) return false;
  for (const card of cards) {
    if (card.instanceId === instanceId) return true;
    if (card.stackedCards && containsInstance(card.stackedCards, instanceId)) return true;
  }
  return false;
}

function isInAnyZone(state: GameState, instanceId: string): boolean {
  return PLAYER_IDS.some((pid) => {
    const player = state.players[pid] as PlayerState;
    return ZONES.some((zone) => containsInstance(player[zone], instanceId));
  });
}

function isOperationCard(state: GameState, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "operation";
}

/** 手札から消え、どのゾーンにも置かれていないオペレーションを「解決中」として記録する。 */
export function trackResolvingOperations(before: GameState, after: GameState): GameState {
  let tracked = after.resolvingOperations;
  for (const pid of PLAYER_IDS) {
    const beforeHand = before.players[pid].hand;
    if (beforeHand === after.players[pid].hand) continue;
    for (const card of beforeHand) {
      if (!isOperationCard(before, card.cardId)) continue;
      if (after.players[pid].hand.some((c) => c.instanceId === card.instanceId)) continue;
      if (tracked?.some((entry) => entry.card.instanceId === card.instanceId)) continue;
      if (isInAnyZone(after, card.instanceId)) continue;
      tracked = [...(tracked ?? []), { playerId: pid, card: { instanceId: card.instanceId, cardId: card.cardId } }];
    }
  }
  return tracked === after.resolvingOperations ? after : { ...after, resolvingOperations: tracked };
}

function resolutionInProgress(state: GameState): boolean {
  return !!(
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingDamagePayment ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingZordSetup ||
    state.pendingScry ||
    state.pendingEffectRush ||
    state.effectRushTriggerQueue?.length
  );
}

/**
 * 解決が終わった「解決中」のオペレーションを、まだどのゾーンにもなければ捨札（常駐は常駐置き場）に置く。
 * 効果が別のゾーンへ移した（捨札に置いた・手札に戻した等）カードは記録から外すだけ。
 */
export function settleResolvingOperations(state: GameState): GameState {
  const entries = state.resolvingOperations;
  if (!entries?.length || state.winner) return state;
  const unplaced = entries.filter((entry) => !isInAnyZone(state, entry.card.instanceId));
  if (unplaced.length > 0 && resolutionInProgress(state)) {
    return unplaced.length === entries.length ? state : { ...state, resolvingOperations: unplaced };
  }
  let next: GameState = { ...state, resolvingOperations: undefined };
  for (const { playerId, card } of unplaced) {
    if (isPermanentCard(next.definitions, card.cardId)) {
      next = placePermanentOperation(next, playerId, card);
      continue;
    }
    const player = next.players[playerId];
    next = { ...next, ...updatePlayer(next, playerId, { ...player, discard: [...player.discard, card] }) };
  }
  return next;
}
