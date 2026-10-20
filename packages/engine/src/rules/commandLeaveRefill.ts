/**
 * 「自軍コマンドゾーンのカードがコマンドゾーンを離れたとき、自軍捨札からカードを1枚選び、
 * 自軍コマンドゾーンにホールド状態で置いてもよい」（RS-238 ゴーゴーファイヤー【プロジェットカノン】、
 * DSL キーワード `while_command_leave_hold_from_discard`）。
 *
 * - これが自軍ラッシュエリアにある間、敵軍ターン中のみ。
 * - 複数枚が同時に離れたら、離れた枚数だけ置ける（grnrngr/faq-card-1 RS-064 Q1「はい」）。
 * - 離れ方は問わない（手札に戻る・捨札になる。サーガイン／ダイノスラスターでも発動。faq-card-4 RS-238 Q2・RS-233 Q1）。
 * - 任意（「置いてもよい」）。skip でそれ以上置かない。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import { cardName } from "../core/catalog";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { buildLogEntry } from "../log/formatLog";

export const COMMAND_LEAVE_REFILL_EFFECT_ID = "command_leave_refill_from_discard";
const KEYWORD = "while_command_leave_hold_from_discard";
const COMMAND_ZONE_MAX = 5;

function refillSources(state: GameState, ownerId: PlayerId) {
  if (state.activePlayer === ownerId) return [];
  return state.players[ownerId].rush.filter((c) => cardHasGrantKeyword(c.cardId, KEYWORD));
}

function openRefill(
  state: GameState,
  ownerId: PlayerId,
  remaining: number,
  sourceCardId: string,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const owner = state.players[ownerId];
  if (remaining <= 0 || owner.discard.length === 0 || owner.command.length >= COMMAND_ZONE_MAX) {
    return state;
  }
  return {
    ...state,
    pendingEffectChoice: {
      playerId: ownerId,
      effectId: COMMAND_LEAVE_REFILL_EFFECT_ID,
      sourceCardId,
      sourceInstanceId,
      phasePlayerId,
      kind: "select_unit",
      validInstanceIds: owner.discard.map((c) => c.instanceId),
      selectedInstanceIds: [],
      selectCount: remaining,
      optional: true,
    },
    activePlayer: ownerId,
  };
}

/** 自軍コマンドゾーンから `count` 枚が離れた後に呼ぶ。条件を満たせば任意の選択を開く。 */
export function afterCommandCardsLeft(
  state: GameState,
  ownerId: PlayerId,
  count: number,
): GameState {
  if (count <= 0 || state.pendingEffectChoice) return state;
  const sources = refillSources(state, ownerId);
  const source = sources[0];
  if (!source) return state;
  // ゴーゴーファイヤーが2体あれば、1枚離れるごとに2枚置ける（faq-card-4 RS-238 Q3）。
  return openRefill(state, ownerId, count * sources.length, source.cardId, source.instanceId, state.activePlayer);
}

export function isCommandLeaveRefillChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === COMMAND_LEAVE_REFILL_EFFECT_ID;
}

export function isValidCommandLeaveRefillTarget(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): boolean {
  return !!findInZone(state.players[pending.playerId], "discard", instanceId);
}

/** 捨札の1枚をホールド状態でコマンドゾーンへ置き、残りがあれば次の選択を開く。 */
export function resolveCommandLeaveRefill(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; log: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  if (!pending || !isCommandLeaveRefillChoice(pending)) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  const owner = state.players[playerId];
  const found = findInZone(owner, "discard", instanceId);
  if (!found) return { error: "invalid_target" };
  const [, discard] = removeAt(owner.discard, found.index);
  const placed: GameState = {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, playerId, {
      ...owner,
      discard,
      command: [...owner.command, { ...found.card, commandHeld: true }],
    }),
  };
  const log = buildLogEntry(
    playerId,
    "resolve_effect_choice",
    pending.sourceCardId,
    state.definitions,
    `${COMMAND_LEAVE_REFILL_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`,
  );
  const next = openRefill(
    placed,
    playerId,
    (pending.selectCount ?? 1) - 1,
    pending.sourceCardId,
    pending.sourceInstanceId ?? "",
    pending.phasePlayerId,
  );
  return { state: next, log };
}
