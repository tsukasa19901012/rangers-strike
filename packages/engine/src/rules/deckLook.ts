/**
 * 「自軍山札を見て、…を1枚選び…」（山札全体から探す効果）で、選ぶ人に山札の全部を見せる。
 *
 * ユーザー報告（2026-10-31、XG1-076 ディケイドライバー）: 山札に選べるカードがなかったとき、窓が開かずに山札をシャッフルして
 * 終わり、山札の中身を確認できなかった。山札を見ること自体が効果の一部なので、
 *  - 選べるカードがあるとき: 選択の候補の後ろに、山札の残りを見るだけのカード（deckLookInstanceIds。表示だけで解決には使わない）
 *    として並べる（withWholeDeckView。applyAction の後、開いている選択に足す）。
 *  - 選べるカードがないとき: 見るだけの窓（openDeckLook、effectId deck_look）を開く。「選ばない」で閉じ、効果の続きに戻る。
 *    窓は効果の処理（シャッフル等）の後に開くことがあるので、見せる順はカード ID 順にして、山札の並びは見せない。
 */
import { getDefinition } from "../core/catalog";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { openAfter, simpleSkip } from "./rm/rm1Effects";

export const DECK_LOOK_EFFECT_ID = "deck_look";

const LOOK_TEXT = /山札を見[てる]/;
const lookCache = new Map<string, boolean>();

/** カードの本文に「山札を見て（見る）」があるか（山札全体から探す効果を持つか）。 */
export function hasDeckLookText(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const cached = lookCache.get(cardId);
  if (cached !== undefined) return cached;
  const text = getDefinition(state.definitions, cardId)?.text ?? "";
  const hit = LOOK_TEXT.test(text.normalize("NFKC"));
  lookCache.set(cardId, hit);
  return hit;
}

const byCardId = (a: { cardId: string }, b: { cardId: string }) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0);

/**
 * 「山札を見て」のカードの選択で、候補が全部、選ぶ人の山札のカードなら、山札の全部を見るだけのカードとして足す。
 * 発動の確認（revealGate）の間は足さない（rules/revealGate.ts）。
 */
export function withWholeDeckView(state: GameState, choice: PendingEffectChoice): PendingEffectChoice {
  if (choice.deckLookInstanceIds || choice.revealGate) return choice;
  if (choice.validInstanceIds.length === 0 || !hasDeckLookText(state, choice.sourceCardId)) return choice;
  const deck = state.players[choice.playerId]?.deck ?? [];
  const inDeck = new Set(deck.map((c) => c.instanceId));
  if (!choice.validInstanceIds.every((id) => inDeck.has(id))) return choice;
  return { ...choice, deckLookInstanceIds: [...deck].sort(byCardId).map((c) => c.instanceId) };
}

/** applyAction の結果に開いている選択へ withWholeDeckView を当てる。 */
export function withDeckLookView(state: GameState): GameState {
  const choice = state.pendingEffectChoice;
  if (!choice) return state;
  const next = withWholeDeckView(state, choice);
  return next === choice ? state : { ...state, pendingEffectChoice: next };
}

/** 選べるカードがなかったときの、山札を見るだけの窓（見送る＝「選ばない」だけ）。山札が空なら null。 */
type LookCtx = { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string };

export function deckLookChoice(state: GameState, ctx: LookCtx, sourceCardId: string, deckOwner: PlayerId = ctx.playerId): PendingEffectChoice | null {
  const deck = state.players[deckOwner].deck;
  if (deck.length === 0) return null;
  const deckLookInstanceIds = [...deck].sort(byCardId).map((c) => c.instanceId);
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    effectId: DECK_LOOK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [],
    deckLookInstanceIds,
    selectCount: 1,
    optional: true,
  };
}

/**
 * 選べるカードがなかったときに、山札を見るだけの窓を開く（ほかの選択が開いていれば、その後に開く）。
 * 呼ぶ側は、効果の続き（シャッフル等）をいつもどおり進めてよい。
 */
export function openDeckLook(state: GameState, ctx: LookCtx, sourceCardId: string, deckOwner: PlayerId = ctx.playerId): GameState {
  const choice = deckLookChoice(state, ctx, sourceCardId, deckOwner);
  return choice ? openAfter(state, choice) : state;
}

/** 見るだけの窓を閉じて、効果の続きに戻る。 */
export function skipDeckLook(state: GameState, playerId: PlayerId): ReturnType<ReturnType<typeof simpleSkip>> | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== DECK_LOOK_EFFECT_ID) return null;
  return simpleSkip()(state, playerId);
}

/** 効果の文脈（GrantKeywordContext 等）から、見る窓の文脈を作る。 */
export function lookCtx(ctx: { playerId: PlayerId; phasePlayerId: PlayerId; operationInstanceId?: string; triggerSourceInstanceId?: string }): LookCtx {
  return { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId };
}
