/**
 * 「…を好きな順で山札の下（上）に戻す」の順を選ぶ選択。
 * 戻すカードはまず今の順で山札の下（上）に置き、2枚以上あれば順を選ぶ選択（effectId deck_bottom_order / deck_top_order）を開く。
 * カードを選ぶたびに番号が付き（selectedInstanceIds）、選んで残りが1枚になるとそのカードに最後の番号が付く。番号の付いたカードを
 * もう一度選ぶと番号が外れ、後ろの番号が詰まる。全部に番号が付いたら「この順で戻す」で確定し、番号の順に並べなおす
 * （下に戻すときは 1 番が上で最後の番号が一番下、上に戻すときは 1 番が一番上）。「選び直す」は番号をすべて外す。
 * 番号を外す・選び直すは、選択がループしないよう合わせて DECK_ORDER_MAX_UNDOS 回まで。
 * カードはそれぞれ持ち主の山札に戻す（両軍のカードを1つの選択で並べてよい）。選ぶのは choice の playerId（相手が選ぶ効果もある）。
 * 解決は rules/pendingChoices.ts の applyEffectChoiceSelect が deckOrderMeta を見て resolveDeckOrderPick に回す。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName } from "../core/catalog";
import { DECK_ORDER_THEN } from "./deckOrderThen";
import { patchPlayer } from "./playerPatches";
import { close, logFor, openAfter, proceed } from "./rm/rm1Effects";

export const DECK_ORDER_DONE = "order_done";
export const DECK_ORDER_RESET = "order_reset";
export const DECK_ORDER_MAX_UNDOS = 10;
export const DECK_BOTTOM_ORDER_EFFECT_ID = "deck_bottom_order";
export const DECK_TOP_ORDER_EFFECT_ID = "deck_top_order";

export type DeckOrderSide = "top" | "bottom";


function deckOwner(state: GameState, instanceId: string): PlayerId | undefined {
  return (["player1", "player2"] as const).find((pid) => state.players[pid].deck.some((c) => c.instanceId === instanceId));
}

function moveInDeck(state: GameState, instanceId: string, to: DeckOrderSide): GameState {
  const owner = deckOwner(state, instanceId);
  if (!owner) return state;
  return patchPlayer(state, owner, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId)!;
    const rest = p.deck.filter((c) => c.instanceId !== instanceId);
    return { ...p, deck: to === "bottom" ? [...rest, card] : [card, ...rest] };
  });
}

/** ids を並びどおりに山札の下（上）へ置く（上なら ids[0] がいちばん上）。 */
function placeInOrder(state: GameState, ids: string[], to: DeckOrderSide): GameState {
  return (to === "bottom" ? ids : [...ids].reverse()).reduce((s, id) => moveInDeck(s, id, to), state);
}

/** 番号の付いたカード（selected）から、次に選べるもの（番号の無いカード・確定・番号の付いたカード・選び直す）。 */
function orderOptions(ids: string[], selected: string[], undos: number): string[] {
  const rest = ids.filter((id) => !selected.includes(id));
  const undo = undos < DECK_ORDER_MAX_UNDOS ? [...selected, ...(selected.length > 0 ? [DECK_ORDER_RESET] : [])] : [];
  return [...(rest.length > 0 ? rest : [DECK_ORDER_DONE]), ...undo];
}

function withSelection(pending: PendingEffectChoice, selected: string[], undos: number, autoLast: boolean): PendingEffectChoice {
  const meta = pending.deckOrderMeta!;
  // 選んで残りが1枚になったら、そのカードが最後。
  const rest = meta.ids.filter((id) => !selected.includes(id));
  const numbered = autoLast && rest.length === 1 ? [...selected, rest[0]!] : selected;
  return { ...pending, selectedInstanceIds: numbered, validInstanceIds: orderOptions(meta.ids, numbered, undos), deckOrderMeta: { ...meta, undos } };
}

export type DeckOrderContext = {
  /** 順を選ぶプレイヤー。 */
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  sourceCardId: string;
  sourceInstanceId?: string;
  resumeChoice?: PendingEffectChoice;
  /** 確定した後の続き（DECK_ORDER_THEN の key と、渡すデータ）。 */
  then?: { key: string; data?: unknown };
};

/**
 * 山札にある ids を今の順で山札の下（上）に置き、2枚以上なら順を選ぶ選択を作る（開くのは呼び出し側）。
 * 山札に無いカードは無視する。
 */
export function placeForDeckOrder(
  state: GameState,
  ctx: DeckOrderContext,
  ids: string[],
  to: DeckOrderSide,
): { state: GameState; order?: PendingEffectChoice } {
  const inDeck = ids.filter((id) => deckOwner(state, id));
  return { state: placeInOrder(state, inDeck, to), order: deckOrderChoice(state, ctx, inDeck, to) };
}

/**
 * 山札にある ids（2枚以上）の順を選ぶ選択を作る。カードは確定するまで今の場所（山札の上など）に置いたままにする
 * （「オモテにしたカードは、戻すまで山札の上に置いたまま」の効果用。1枚以下なら undefined で、戻すのは呼び出し側）。
 */
export function deckOrderChoice(state: GameState, ctx: DeckOrderContext, ids: string[], to: DeckOrderSide): PendingEffectChoice | undefined {
  const inDeck = ids.filter((id) => deckOwner(state, id));
  if (inDeck.length < 2) return undefined;
  const order: PendingEffectChoice = {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    effectId: to === "bottom" ? DECK_BOTTOM_ORDER_EFFECT_ID : DECK_TOP_ORDER_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [],
    selectedInstanceIds: [],
    selectCount: inDeck.length,
    optional: false,
    resumeChoice: ctx.resumeChoice,
    deckOrderMeta: { ids: inDeck, undos: 0, to, ...(ctx.then ? { then: ctx.then } : {}) },
  };
  return withSelection(order, [], 0, false);
}

/**
 * pending（閉じた後の効果の選択）の続きとして ids を山札の下（上）に戻し、2枚以上なら順を選ぶ選択を開く（rm1Effects の proceed で続ける）。
 * 順を選ぶのは chooser（既定は pending の playerId）。
 */
export function returnToDeckInOrder(state: GameState, pending: PendingEffectChoice, ids: string[], to: DeckOrderSide = "bottom", chooser?: PlayerId): GameState {
  const { state: next, order } = placeForDeckOrder(
    state,
    { playerId: chooser ?? pending.playerId, phasePlayerId: pending.phasePlayerId, sourceCardId: pending.sourceCardId, sourceInstanceId: pending.sourceInstanceId, resumeChoice: pending.resumeChoice },
    ids,
    to,
  );
  return order ? proceed(next, { ...pending, resumeChoice: order }) : proceed(next, pending);
}

/**
 * まだ開いている効果の選択 pending を閉じ、ids を山札の下（上）に戻して、2枚以上なら順を選ぶ選択を開く（1枚以下ならそのまま続ける）。
 * 「N枚まで選んで好きな順で戻す」で選び終えた（選び切った・見送った）ときにも使う。
 */
export function closeWithDeckOrder(state: GameState, pending: PendingEffectChoice, ids: string[], to: DeckOrderSide = "bottom", chooser?: PlayerId): GameState {
  return returnToDeckInOrder(close(state, pending), pending, ids, to, chooser);
}

/** 順を選ぶ選択で、カード・確定・選び直すのどれかを選んだとき。 */
export function resolveDeckOrderPick(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; log: string } | { error: string } {
  const pending = state.pendingEffectChoice!;
  const meta = pending.deckOrderMeta;
  if (!meta || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = pending.selectedInstanceIds ?? [];
  const nameOf = (s: GameState, id: string) => {
    const owner = deckOwner(s, id);
    const card = owner ? s.players[owner].deck.find((c) => c.instanceId === id) : undefined;
    return card ? cardName(s.definitions, card.cardId) : id;
  };
  if (instanceId === DECK_ORDER_RESET) {
    return {
      state: { ...state, pendingEffectChoice: withSelection(pending, [], meta.undos + 1, false) },
      log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:reset`),
    };
  }
  if (instanceId === DECK_ORDER_DONE) {
    const closed = close(placeInOrder(state, selected, meta.to), pending);
    const then = meta.then ? DECK_ORDER_THEN[meta.then.key] : undefined;
    return {
      state: then ? then(closed, pending, meta.then!.data) : proceed(closed, pending),
      log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:${selected.map((id) => nameOf(state, id)).join("→")}`),
    };
  }
  if (selected.includes(instanceId)) {
    return {
      state: { ...state, pendingEffectChoice: withSelection(pending, selected.filter((id) => id !== instanceId), meta.undos + 1, false) },
      log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:unpick:${nameOf(state, instanceId)}`),
    };
  }
  return {
    state: { ...state, pendingEffectChoice: withSelection(pending, [...selected, instanceId], meta.undos, true) },
    log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:${selected.length + 1}:${nameOf(state, instanceId)}`),
  };
}

/**
 * 効果の処理を終えた state に、順を選ぶ選択を続けて開く（ほかの選択が開いていればその後、ほかの割り込みがあれば待つ）。
 * 呼び出し側の続け方が rm1Effects の proceed でないとき（オペレーションの解決・弾ごとの finish 等）に使う。
 */
export function openDeckOrderAfter(state: GameState, order: PendingEffectChoice | undefined): GameState {
  return order ? openAfter(state, order) : state;
}
