/**
 * クロスギャザー ザ・ギガンティックタイタン（XG6-001〜XG6-065）のカード固有の効果の共通部分（cardSpec XG6 の監査）。
 *
 * - 選択の表（CHOICE_RESOLVERS 等）。rules/xg6/xg6aEffects.ts・xg6bEffects.ts・xg6cEffects.ts が登録し、rules/xg6/xg6Hooks.ts が
 *   core・rules の各所から呼ばれる入口（`tryResolveXg6Choice` 等）として公開する。
 * - 「好きな数選ぶ」の選択の「選び終える」（XG6_DONE）。選んだ後の候補の先頭に置く。
 * 選択の組み立ては rules/rm/rm1Effects.ts の共通の部品（openAfter・close・proceed・base 等）を使う。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { type ChoiceOutcome, close, logFor, proceed, skipLog } from "../rm/rm1Effects";

export type { ChoiceOutcome };

export type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type KeywordHandler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;

export const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
export const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
export const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
export const XG6_KEYWORDS: Record<string, KeywordHandler> = {};

/**
 * 手札・捨札・パワーゾーン・場のカードから起動する効果（activate_field_unit_ability。XG6-047・048・061・064 等）。
 * list は起動できるカードの instanceId、activate は起動した後の状態（対象外なら null）。
 */
export type ZoneActivation = {
  list: (state: GameState, playerId: PlayerId) => string[];
  activate: (state: GameState, playerId: PlayerId, instanceId: string) => GameState | null;
};
export const XG6_ACTIVATIONS: ZoneActivation[] = [];

/** 「自分がターンを終えるとき」の効果（rules/turnEndingEffects.ts の XG6 の列）。entry は collect が返した文字列。 */
export type TurnEndHandler = {
  collect: (state: GameState, endingPlayerId: PlayerId) => string[];
  open: (state: GameState, endingPlayerId: PlayerId, entry: string) => GameState | null;
};
export const XG6_TURN_END: TurnEndHandler[] = [];

/** 場のユニットが場を離れたとき（events/listeners/unitLeftZoneListener.ts の XG6 の入口）。 */
export type UnitLeftEvent = { ownerPlayerId: PlayerId; instanceId: string; cardId: string; fromZone: string; toZone: string; destroyed?: boolean; phasePlayerId?: PlayerId };
export const XG6_UNIT_LEFT: Array<(state: GameState, event: UnitLeftEvent) => GameState> = [];

export const XG6_KEYWORD_PREFIX = "xg6::";

/** 「好きな数（まで）選ぶ」の選択で、選び終えることを表す候補（1枚以上選んだ後の候補の先頭）。 */
export const XG6_DONE = "xg6_done";

export const noop = (detail: string): KeywordHandler => (state) => ({ state, detail });

export function isCard(cardId: string, id: string): boolean {
  return isSameCardIdentity(cardId, id);
}

/** 必要パワーの数字（「+」「-」を除く。数字がなければ 0）。 */
export function costNumber(state: Pick<GameState, "definitions">, cardId: string): number {
  const raw = getDefinition(state.definitions, cardId)?.powerCost;
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** 場（ラッシュ・バトルエリア）のカードを書き換える。 */
export function patchField(state: GameState, playerId: PlayerId, instanceId: string, f: (c: CardInstance) => CardInstance): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? f(c) : c));
    return { ...p, rush: set(p.rush), battle: set(p.battle) };
  });
}

/** 場のユニット・コマンドのホールド状態を変える。 */
export function setHeld(state: GameState, playerId: PlayerId, instanceId: string, held: boolean): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: held } : c));
    return { ...p, rush: set(p.rush), battle: set(p.battle), command: set(p.command) };
  });
}

/** 選択を閉じて処理を続ける（after で状態を変えてから）。 */
export function finish(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
  after?: (state: GameState) => GameState,
): { state: GameState; log?: string } {
  let next = close(state, pending);
  if (after) next = after(next);
  return { state: proceed(next, pending), log: logFor(state, pending.playerId, pending.sourceCardId, `${pending.effectId}:${detail}`) };
}

export function skipped(state: GameState, pending: PendingEffectChoice, after?: (state: GameState) => GameState): { state: GameState; log?: string } {
  let next = close(state, pending);
  if (after) next = after(next);
  return { state: proceed(next, pending), log: skipLog(state, pending.playerId, pending.sourceCardId, pending.effectId) };
}

/** 「好きな数（max まで）選ぶ」の1枚を選んだ後の選択（残りの候補の先頭に「選び終える」を置く）。max に達したら null。 */
export function nextMultiPick(pending: PendingEffectChoice, instanceId: string, rest: string[], max: number): PendingEffectChoice | null {
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = rest.filter((id) => id !== XG6_DONE && !selected.includes(id));
  if (selected.length >= max || remaining.length === 0) return null;
  return { ...pending, selectedInstanceIds: selected, validInstanceIds: [XG6_DONE, ...remaining], optional: true, mayConfirm: true };
}
