import { getCardEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { isPermanentOperation } from "../core/catalog";
import { opponent } from "../core/helpers";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";

export type TurnEndResidentEntry = { ownerId: PlayerId; instanceId: string };

/**
 * RS-030 アドベンチャー: どちらのプレイヤーが配置していても、ターンを終えたプレイヤーが
 * 自分のホールド中コマンドを1つ手札に戻す。2枚あれば重複する。
 * ルール: R-END-02（faq-card-1 RS-030 Q1・Q2）
 */
function appliesToEndingPlayerFromEitherSide(cardId: string): boolean {
  return getCardEffect(cardId)?.effectId === "adventure";
}

/** 「ターンを終えるとき」に処理する常駐（自軍の常駐＋相手のアドベンチャー）を並べる。 */
export function collectTurnEndResidentQueue(
  state: GameState,
  endingPlayerId: PlayerId,
): TurnEndResidentEntry[] {
  const queue: TurnEndResidentEntry[] = [];
  for (const card of state.players[endingPlayerId].operation) {
    if (!isPermanentOperation(state.definitions[card.cardId])) continue;
    queue.push({ ownerId: endingPlayerId, instanceId: card.instanceId });
  }
  const enemyId = opponent(endingPlayerId);
  for (const card of state.players[enemyId].operation) {
    if (!isPermanentOperation(state.definitions[card.cardId])) continue;
    if (!appliesToEndingPlayerFromEitherSide(card.cardId)) continue;
    queue.push({ ownerId: enemyId, instanceId: card.instanceId });
  }
  return queue;
}

/** 常駐1枚の on_turn_end 効果を処理する。選択が開いたらそこで止まる。 */
export function resolveTurnEndResident(
  state: GameState,
  entry: TurnEndResidentEntry,
  endingPlayerId: PlayerId,
): GameState {
  const card = state.players[entry.ownerId].operation.find(
    (c) => c.instanceId === entry.instanceId,
  );
  if (!card) return state;
  // ルール: R-END-02 — 相手のアドベンチャーも「ターンを終えたプレイヤー」自身が処理する。
  return tryResolveDslTriggeredEffects({
    state,
    cardId: card.cardId,
    instanceId: card.instanceId,
    playerId: endingPlayerId,
    phasePlayerId: endingPlayerId,
    triggerType: "on_turn_end",
    logAction: "resident_operation",
  }).state;
}

/** 常駐 OP（operation ゾーン）の on_turn_end 効果を一括処理（選択が開いたら止まる）。 */
export function applyResidentOperationTurnEnd(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  let nextState = state;
  for (const entry of collectTurnEndResidentQueue(state, endingPlayerId)) {
    nextState = resolveTurnEndResident(nextState, entry, endingPlayerId);
    if (nextState.pendingEffectChoice) break;
  }
  return nextState;
}
