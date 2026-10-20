/**
 * クロスギャザー XG5（ザ・チケットブレイカー）XG5-001〜XG5-096 のカード固有の効果の共通の部品（cardSpec XG5-* の監査）。
 *
 * - `XG5_KEYWORDS`: DSL の grant_keyword（`xg5::cardId::name`）から呼ばれる処理の登録先。各バッチのモジュール（xg5aEffects.ts 等）が登録する。
 * - `CHOICE_RESOLVERS` / `CHOICE_SKIPPERS` / `CHOICE_CONFIRMERS`: このシリーズのモジュールが開いた選択の解決の登録先。
 * - `AFTER_ACTION_HOOKS`: applyAction の後処理（core/applyAction.ts から rules/xg5/xg5Effects.ts の applyXg5AfterAction で呼ぶ）。
 * 選択の組み立ては rules/rm/rm1Effects.ts の共通の部品（openAfter・proceed・close 等）を使う。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingStrike, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import type { ChoiceOutcome } from "../rm/rm1Effects";
import type { Xg5Watch } from "./xg5Types";

export type { ChoiceOutcome };
export type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type KeywordHandler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;
/** applyAction の後処理。before はアクション前、after はアクション後の状態。 */
export type ApplyActionFn = typeof import("../../core/applyAction").applyAction;
export type AfterActionHook = (before: GameState, after: GameState, apply: ApplyActionFn) => GameState;
export type StrikeHook = (state: GameState, pending: PendingStrike) => GameState;

export const XG5_KEYWORD_PREFIX = "xg5::";

export const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
export const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
export const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
export const XG5_KEYWORDS: Record<string, KeywordHandler> = {};
export const AFTER_ACTION_HOOKS: AfterActionHook[] = [];
export const STRIKE_RESOLVED_HOOKS: StrikeHook[] = [];
/** アタックしたユニットがバトルで敵軍ユニットを撃破したとき（rules/operationCounters.ts から applyXg5AttackWin で呼ぶ）。 */
export type AttackWinHook = (state: GameState, attackerId: PlayerId, attackerInstanceId: string, phasePlayerId: PlayerId, defenderInstanceId?: string) => GameState;
export const ATTACK_WIN_HOOKS: AttackWinHook[] = [];

/** アタックして敵軍ユニットをバトルで撃破したとき。このモジュールは型以外を読み込まない（循環しない）。 */
export function applyXg5AttackWin(state: GameState, attackerId: PlayerId, attackerInstanceId: string, phasePlayerId: PlayerId, defenderInstanceId?: string): GameState {
  let next = state;
  for (const hook of ATTACK_WIN_HOOKS) next = hook(next, attackerId, attackerInstanceId, phasePlayerId, defenderInstanceId);
  return next;
}
/** アタックされたとき（core/applyAction.ts continueAttackAfterDeclaration。「アタックしたとき」の後、カウンターの前）。開いた state か null。 */
export type AttackedHook = (state: GameState, battle: PendingBattle, wingAttackFromRush: boolean) => GameState | null;
export const ATTACKED_HOOKS: AttackedHook[] = [];

export function openXg5Attacked(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  for (const hook of ATTACKED_HOOKS) {
    const opened = hook(state, battle, wingAttackFromRush);
    if (opened) return opened;
  }
  return null;
}

/**
 * NC の効果を実行する前（rules/numberComboEffects.ts applyNumberComboEffect の先頭）。選択を開いたら { state, logs } を返す（その NC の効果はまだ実行しない）。
 * 実行を続けるときは NC_RESUME.fn（applyNumberComboEffect。numberComboEffects.ts が登録する）を呼ぶ。
 */
export type NcIntercept = (state: GameState, playerId: PlayerId, card: CardInstance, effectId: string | undefined) => { state: GameState; logs: string[] } | null;
export const NC_INTERCEPTS: NcIntercept[] = [];
export const NC_RESUME: { fn?: (state: GameState, playerId: PlayerId, card: CardInstance, effectId: string | undefined) => { state: GameState; logs: string[] } } = {};

export function tryXg5InterceptNc(state: GameState, playerId: PlayerId, card: CardInstance, effectId: string | undefined): { state: GameState; logs: string[] } | null {
  for (const hook of NC_INTERCEPTS) {
    const r = hook(state, playerId, card, effectId);
    if (r) return r;
  }
  return null;
}

/** 手札のカードから発動する効果（activate_field_unit_ability。core/legalActions.ts・core/applyAction.ts）。 */
export const HAND_ACTIVATIONS: Array<{
  list: (state: GameState, playerId: PlayerId) => string[];
  activate: (state: GameState, playerId: PlayerId, instanceId: string) => GameState | null;
}> = [];

export function listXg5HandActivations(state: GameState, playerId: PlayerId): string[] {
  return HAND_ACTIVATIONS.flatMap((h) => h.list(state, playerId));
}

export function activateXg5HandEffect(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  for (const h of HAND_ACTIVATIONS) {
    if (!h.list(state, playerId).includes(instanceId)) continue;
    const r = h.activate(state, playerId, instanceId);
    if (r) return r;
  }
  return null;
}

/** 効果のラッシュを終えたときの続き（entered は候補のうち出たカード）。 */
export const WATCH_HANDLERS: Record<string, (state: GameState, watch: Xg5Watch, entered: string[]) => GameState> = {};

export function isXg5ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このシリーズの選択なら解決する。対象外なら null。 */
export function tryResolveXg5Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipXg5Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmXg5Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmXg5Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg5Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** DSL の grant_keyword（`xg5::cardId::name`）の起点。対象外なら null。 */
export function tryXg5CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(XG5_KEYWORD_PREFIX)) return null;
  const handler = XG5_KEYWORDS[keyword.slice(XG5_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

/** 継続効果・ほかの処理の場所から発動する効果（DSL からは何もしない）。 */
export const noop = (detail: string): KeywordHandler => (state) => ({ state, detail });
