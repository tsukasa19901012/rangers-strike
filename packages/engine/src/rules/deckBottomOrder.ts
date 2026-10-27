/**
 * 「…を好きな順で山札の下に戻す」の順を選ぶ選択。
 * 戻すカードはまず今の順で山札の下に置き、2枚以上あれば 1 枚ずつ選んで山札の下へ移しなおす
 * （先に選んだカードほど上、最後に残ったカードが一番下）。1枚以下なら選択は開かない。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName } from "../core/catalog";
import { patchPlayer } from "./playerPatches";
import { close, logFor, proceed } from "./rm/rm1Effects";

function toBottom(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), card] } : p;
  });
}

/**
 * pending（閉じた後の効果の選択）の続きとして、山札にある ids を山札の下に戻し、2枚以上なら順を選ぶ選択を開く。
 * 選択は orderEffectId（resolveDeckBottomOrderPick を登録した効果 id）で開く。
 */
export function returnToDeckBottomInOrder(state: GameState, pending: PendingEffectChoice, orderEffectId: string, ids: string[]): GameState {
  const playerId = pending.playerId;
  const inDeck = ids.filter((id) => state.players[playerId].deck.some((c) => c.instanceId === id));
  const next = inDeck.reduce((s, id) => toBottom(s, playerId, id), state);
  if (inDeck.length < 2) return proceed(next, pending);
  const order: PendingEffectChoice = {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    effectId: orderEffectId,
    kind: "select_unit",
    validInstanceIds: inDeck,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    resumeChoice: pending.resumeChoice,
  };
  return proceed(next, { ...pending, resumeChoice: order });
}

/** 順を選ぶ選択で1枚選んだとき（CHOICE_RESOLVERS 等に登録する）。 */
export function resolveDeckBottomOrderPick(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; log: string } | { error: string } {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const picked = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:${picked ? cardName(state.definitions, picked.cardId) : instanceId}`);
  let next = toBottom(state, playerId, instanceId);
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (rest.length >= 2) return { state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: rest } }, log };
  if (rest.length === 1) next = toBottom(next, playerId, rest[0]!);
  return { state: proceed(close(next, pending), pending), log };
}
