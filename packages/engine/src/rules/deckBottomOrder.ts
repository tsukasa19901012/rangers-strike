/**
 * 「…を好きな順で山札の下に戻す」の順を選ぶ選択。
 * 戻すカードはまず今の順で山札の下に置き、2枚以上あれば順を選ぶ選択を開く。カードを選ぶたびに番号が付き（selectedInstanceIds。
 * 1番目が上）、選んで残りが1枚になるとそのカードに最後の番号が付く。番号の付いたカードをもう一度選ぶと番号が外れ、後ろの番号が詰まる。
 * 全部に番号が付いたら「この順で山札の下に戻す」で確定し、番号の順に山札の下へ並べなおす。「選び直す」は番号をすべて外す。
 * 番号を外す・選び直すは、選択がループしないよう合わせて DECK_BOTTOM_ORDER_MAX_UNDOS 回まで。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName } from "../core/catalog";
import { patchPlayer } from "./playerPatches";
import { close, logFor, proceed } from "./rm/rm1Effects";

export const DECK_BOTTOM_ORDER_DONE = "order_done";
export const DECK_BOTTOM_ORDER_RESET = "order_reset";
export const DECK_BOTTOM_ORDER_MAX_UNDOS = 10;

function toBottom(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), card] } : p;
  });
}

/** 番号の付いたカード（selected）から、次に選べるもの（番号の無いカード・確定・番号の付いたカード・選び直す）。 */
function orderOptions(ids: string[], selected: string[], undos: number): string[] {
  const rest = ids.filter((id) => !selected.includes(id));
  const undo = undos < DECK_BOTTOM_ORDER_MAX_UNDOS ? [...selected, ...(selected.length > 0 ? [DECK_BOTTOM_ORDER_RESET] : [])] : [];
  return [...(rest.length > 0 ? rest : [DECK_BOTTOM_ORDER_DONE]), ...undo];
}

function withSelection(pending: PendingEffectChoice, ids: string[], selected: string[], undos: number, autoLast: boolean): PendingEffectChoice {
  // 選んで残りが1枚になったら、そのカードが最後（一番下）。
  const rest = ids.filter((id) => !selected.includes(id));
  const numbered = autoLast && rest.length === 1 ? [...selected, rest[0]!] : selected;
  return { ...pending, selectedInstanceIds: numbered, validInstanceIds: orderOptions(ids, numbered, undos), deckBottomOrderMeta: { ids, undos } };
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
  const order = withSelection(
    {
      playerId,
      phasePlayerId: pending.phasePlayerId,
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId,
      effectId: orderEffectId,
      kind: "select_unit",
      validInstanceIds: [],
      selectedInstanceIds: [],
      selectCount: inDeck.length,
      optional: false,
      resumeChoice: pending.resumeChoice,
    },
    inDeck,
    [],
    0,
    false,
  );
  return proceed(next, { ...pending, resumeChoice: order });
}

/** 順を選ぶ選択で、カード・確定・選び直すのどれかを選んだとき（CHOICE_RESOLVERS 等に登録する）。 */
export function resolveDeckBottomOrderPick(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; log: string } | { error: string } {
  const pending = state.pendingEffectChoice!;
  const meta = pending.deckBottomOrderMeta;
  if (!meta || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = pending.selectedInstanceIds ?? [];
  if (instanceId === DECK_BOTTOM_ORDER_RESET) {
    return {
      state: { ...state, pendingEffectChoice: withSelection(pending, meta.ids, [], meta.undos + 1, false) },
      log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:reset`),
    };
  }
  if (instanceId === DECK_BOTTOM_ORDER_DONE) {
    const deck = state.players[playerId].deck;
    const names = selected.map((id) => cardName(state.definitions, deck.find((c) => c.instanceId === id)?.cardId ?? id));
    const next = selected.reduce((s, id) => toBottom(s, playerId, id), state);
    return { state: proceed(close(next, pending), pending), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:${names.join("→")}`) };
  }
  const picked = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  const name = picked ? cardName(state.definitions, picked.cardId) : instanceId;
  if (selected.includes(instanceId)) {
    return {
      state: { ...state, pendingEffectChoice: withSelection(pending, meta.ids, selected.filter((id) => id !== instanceId), meta.undos + 1, false) },
      log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:unpick:${name}`),
    };
  }
  return {
    state: { ...state, pendingEffectChoice: withSelection(pending, meta.ids, [...selected, instanceId], meta.undos, true) },
    log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:${selected.length + 1}:${name}`),
  };
}
