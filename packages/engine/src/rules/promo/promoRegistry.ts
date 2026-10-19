/**
 * プロモーションカード（PK・PM・SM・SK・SX・SR・XP・PR）のカード固有の効果の登録先（`promo::` キーワード・選択の解決）。
 *
 * 中央のファイル（dsl/grantKeyword.ts・rules/pendingChoices.ts・core/legalActions.ts）は rules/promo/index.ts の
 * `tryPromoCardEffect` / `tryResolvePromoChoice` / `trySkipPromoChoice` / `tryConfirmPromoChoice` / `isPromoChoiceEffect` だけを呼ぶ。
 * カードごとの実装（rules/promo/xp*.ts・promo*.ts）は registerPromoKeyword / registerPromoChoice で登録する。
 * 登録先は関数の中に持つ（循環 import でカードのモジュールが先に評価されても登録できる。rules/legend1/set8NamedEffectsA.ts tagResidents と同じ）。
 * 選択の組み立ての部品は rules/rm/rm1Effects.ts のもの（openAfter・close・proceed・simpleSkip 等）を使う。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import type { ChoiceOutcome } from "../rm/rm1Effects";
import { openEffectChoice } from "../pendingChoices";

export type PromoChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type PromoChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type PromoKeywordHandler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;

export const PROMO_KEYWORD_PREFIX = "promo::";

type Store = {
  resolvers: Record<string, PromoChoiceResolver>;
  skippers: Record<string, PromoChoiceSkipper>;
  confirmers: Record<string, PromoChoiceSkipper>;
  keywords: Record<string, PromoKeywordHandler>;
};

function store(): Store {
  const holder = store as unknown as { s?: Store };
  return (holder.s ??= { resolvers: {}, skippers: {}, confirmers: {}, keywords: {} });
}

/** `promo::<name>` の grant_keyword の処理を登録する。 */
export function registerPromoKeyword(name: string, handler: PromoKeywordHandler): void {
  store().keywords[name] = handler;
}

/** このモジュール群が開く選択（effectId）の解決・見送り・確定を登録する。 */
export function registerPromoChoice(
  effectId: string,
  resolver: PromoChoiceResolver,
  skipper?: PromoChoiceSkipper,
  confirmer?: PromoChoiceSkipper,
): void {
  const s = store();
  s.resolvers[effectId] = resolver;
  if (skipper) s.skippers[effectId] = skipper;
  if (confirmer) s.confirmers[effectId] = confirmer;
}

export function tryPromoCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(PROMO_KEYWORD_PREFIX)) return null;
  const handler = store().keywords[keyword.slice(PROMO_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

export function isPromoChoiceEffect(effectId: string): boolean {
  return effectId in store().resolvers;
}

export function tryResolvePromoChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = store().resolvers[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipPromoChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in store().resolvers)) return null;
  const skipper = store().skippers[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function canConfirmPromoChoice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in store().confirmers)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

export function tryConfirmPromoChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = store().confirmers[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmPromoChoice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

// ---------------------------------------------------------------------------
// applyAction の後処理（depth 0）: 前後の状態を比べて発動する効果（XP-013【キョウリュウマル】等）。
// 発動はキューに積み（GameState.promoPendingTriggers）、ほかの処理の途中でなければ1つずつ選択を開く（rules/rm/rm1Effects.ts applyRm1AfterAction と同じ）。

export type PromoTrigger = NonNullable<GameState["promoPendingTriggers"]>[number];
type TriggerDetector = (before: GameState, after: GameState) => PromoTrigger[];
type TriggerOpener = (state: GameState, trigger: PromoTrigger) => PendingEffectChoice | null;
type TriggerStore = { detectors: TriggerDetector[]; openers: Record<string, TriggerOpener> };

function triggerStore(): TriggerStore {
  const holder = triggerStore as unknown as { s?: TriggerStore };
  return (holder.s ??= { detectors: [], openers: {} });
}

export function registerPromoAfterAction(kind: string, detect: TriggerDetector, open: TriggerOpener): void {
  const s = triggerStore();
  s.detectors.push(detect);
  s.openers[kind] = open;
}

function blocked(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry ||
    state.pendingEffectRush
  );
}

export function applyPromoAfterAction(before: GameState, after: GameState): GameState {
  const s = triggerStore();
  const queue = [...(after.promoPendingTriggers ?? [])];
  for (const detect of s.detectors) queue.push(...detect(before, after));
  if (queue.length === 0) return after.promoPendingTriggers ? { ...after, promoPendingTriggers: undefined } : after;
  let next: GameState = after;
  if (blocked(next) || next.winner) return { ...next, promoPendingTriggers: queue };
  while (queue.length > 0) {
    const trigger = queue.shift()!;
    const choice = s.openers[trigger.kind]?.(next, trigger);
    if (!choice) continue;
    const existing = next.pendingEffectChoice;
    next = existing
      ? { ...next, pendingEffectChoice: { ...choice, resumeChoice: existing }, activePlayer: choice.playerId }
      : openEffectChoice(next, choice);
    break;
  }
  return { ...next, promoPendingTriggers: queue.length > 0 ? queue : undefined };
}
