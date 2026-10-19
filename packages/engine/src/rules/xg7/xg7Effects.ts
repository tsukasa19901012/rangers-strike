/**
 * クロスギャザー ザ・ベストパートナー XG7-001〜XG7-068 のカード固有の効果の入口（`xg7::` キーワード・選択の解決）。
 * 実装はバッチごとのモジュール（xg7aEffects.ts 等）が rules/xg7/xg7Registry.ts に登録する。継続効果は rules/xg7/xg7Fields.ts。
 */
import type { GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG7_KEYWORDS, XG7_KEYWORD_PREFIX, type ChoiceOutcome } from "./xg7Registry";
import { openXg7aLeaveStay, openXg7aOnUnitRushed } from "./xg7aEffects";

export function tryXg7CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(XG7_KEYWORD_PREFIX)) return null;
  const handler = XG7_KEYWORDS[keyword.slice(XG7_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

export function isXg7ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveXg7Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipXg7Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmXg7Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmXg7Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg7Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** 離場の置換（「かわりに…してもよい」でその場に留める）。対象がなければ null（rules/operationCounters.ts tryLeaveField）。 */
export function openXg7LeaveStay(state: GameState, intent: PendingLeave): GameState | null {
  return openXg7aLeaveStay(state, intent);
}

/** 自軍ユニットをラッシュしたときの効果（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。 */
export function openXg7OnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  return openXg7aOnUnitRushed(state, rusherPlayerId, rushedInstanceId, phasePlayerId);
}
