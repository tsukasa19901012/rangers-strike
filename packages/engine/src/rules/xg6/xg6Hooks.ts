/**
 * クロスギャザー ザ・ギガンティックタイタン（XG6-001〜XG6-065）のカード固有の効果の入口（cardSpec XG6 の監査）。
 *
 * - `tryXg6CardEffect`: DSL の grant_keyword から呼ばれる起点（`xg6::cardId::name`）。
 * - `isXg6ChoiceEffect` / `tryResolveXg6Choice` / `trySkipXg6Choice` / `canConfirmXg6Choice` / `tryConfirmXg6Choice`: このモジュールが開いた選択。
 * 各カードの効果は rules/xg6/xg6aEffects.ts（XG6-001〜022）等が rules/xg6/xg6Common.ts の表に登録する。
 * 継続効果・ほかの処理の場所から呼ぶ判定（BP・SP・負ける点数・アタックの制限等）は rules/xg6/xg6Fields.ts。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import type { ChoiceOutcome } from "../rm/rm1Effects";
import { CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG6_DONE, XG6_KEYWORDS, XG6_KEYWORD_PREFIX } from "./xg6Common";
import "./xg6aEffects";
import "./xg6bEffects";
import { applyXg6AfterAction as applyXg6bAfterAction } from "./xg6bEffects";
import { syncXg6ArkSize } from "./xg6cEffects";
import { tryXg6OnEnterBattle as tryXg6aOnEnterBattle } from "./xg6aEffects";
import { restoreXg6Furikiru, tryXg6FurikiruOnEnterBattle } from "./xg6dEffects";

/** 各アクションの後（core/applyAction.ts）。XG6-053 の※のサイズを同期してから XG6-042 等を処理する。XG6-037【振り切るぜ】の期限が切れたら元に戻す。 */
export function applyXg6AfterAction(state: GameState): GameState {
  return applyXg6bAfterAction(syncXg6ArkSize(restoreXg6Furikiru(state)));
}

/** バトルエリアに出たとき（rules/combo.ts）: XG6-008 炎神剣（rules/xg6/xg6aEffects.ts）・XG6-037【振り切るぜ】で追加したテキスト（rules/xg6/xg6dEffects.ts）。 */
export function tryXg6OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return tryXg6FurikiruOnEnterBattle(tryXg6aOnEnterBattle(state, playerId, card), playerId, card);
}

export {
  applyXg6OnUnitLeft,
  collectXg6TurnEndQueue,
  openXg6TurnEndEntry,
  openXg6OnAttacked,
  openXg6OnStrike,
  xg6HandActivations,
  activateXg6HandEffect,
} from "./xg6aEffects";
export {
  applyXg6StartPhaseBegin,
  applyXg6StrikeDamageTriggers,
  endXg6BattlePhase,
  openXg6StayOnLeave,
  openXg6Teddy,
  takeXg6BattlePhaseEnd,
  xg6OnAttackWin,
} from "./xg6bEffects";
export {
  applyXg6OnBattleStart,
  openXg6OnCharged,
  openXg6OnHandRush,
  xg6SummonedNoStrike,
  xg6TeddyComboOnEntry,
} from "./xg6cEffects";

export function isXg6ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveXg6Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  if (instanceId === XG6_DONE) {
    const confirmer = CHOICE_CONFIRMERS[pending.effectId];
    if (confirmer) return confirmer(state, playerId);
  }
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipXg6Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmXg6Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmXg6Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg6Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

export function tryXg6CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(XG6_KEYWORD_PREFIX)) return null;
  const handler = XG6_KEYWORDS[keyword.slice(XG6_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
