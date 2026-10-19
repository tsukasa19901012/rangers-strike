/**
 * クロスギャザー ザ・ファーストエンカウント XG1-001〜XG1-100 のカード固有の効果の入口（cardSpec XG1-* の監査）。
 *
 * - `tryXg1CardEffect`: DSL の grant_keyword から呼ばれる起点（`xg1::cardId::name`。NC・RC・ラッシュしたとき・オペレーション等）。
 * - `tryResolveXg1Choice` / `trySkipXg1Choice` / `tryConfirmXg1Choice` / `tryCompleteXg1HoldChoice`: このシリーズが開いた選択の解決
 *   （rules/pendingChoices.ts・core/legalActions.ts）。
 * カードごとの処理は rules/xg1/xg1aEffects.ts（XG1-001〜020）・xg1bEffects.ts（021〜040）・xg1cEffects.ts（041〜060）・
 * xg1dEffects.ts（061〜080）・xg1eEffects.ts（081〜100）。共通の登録表は rules/xg1/xg1Core.ts。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { close, logFor, type ChoiceOutcome } from "../rm/rm1Effects";
import { XG1_CONFIRMERS, XG1_HOLD_COMPLETERS, XG1_KEYWORDS, XG1_KEYWORD_PREFIX, XG1_RESOLVERS, XG1_SKIPPERS } from "./xg1Core";
import { holdCommands } from "./xg1Shared";
import "./xg1aEffects";


export function isXg1ChoiceEffect(effectId: string): boolean {
  return effectId in XG1_RESOLVERS;
}

/** このシリーズが開いた選択なら解決する。対象外なら null。 */
export function tryResolveXg1Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = XG1_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipXg1Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in XG1_RESOLVERS)) return null;
  const skipper = XG1_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmXg1Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in XG1_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmXg1Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = XG1_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg1Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** コマンドの支払いでホールドするコマンドを選び終えた（rules/pendingChoices.ts completeEffectHoldChoice）。対象外なら null。 */
export function tryCompleteXg1HoldChoice(state: GameState, playerId: PlayerId, commandInstanceIds: string[]): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const completer = XG1_HOLD_COMPLETERS[pending.effectId];
  if (!completer) return null;
  const held = holdCommands(close(state, pending), playerId, commandInstanceIds);
  return { state: completer(held, pending, commandInstanceIds), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:hold`) };
}

export function tryXg1CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(XG1_KEYWORD_PREFIX)) return null;
  const handler = XG1_KEYWORDS[keyword.slice(XG1_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
