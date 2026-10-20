/**
 * クロスギャザー ザ・ベストパートナー XG7-001〜XG7-068 のカード固有の効果の入口（`xg7::` キーワード・選択の解決）。
 * 実装はバッチごとのモジュール（xg7aEffects.ts 等）が rules/xg7/xg7Registry.ts に登録する。継続効果は rules/xg7/xg7Fields.ts。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG7_KEYWORDS, XG7_KEYWORD_PREFIX, type ChoiceOutcome } from "./xg7Registry";
import { openXg7aLeaveStay, openXg7aOnUnitRushed } from "./xg7aEffects";
import {
  activateXg7bFieldAbility,
  activateXg7bResident,
  applyXg7bRushCounter,
  canActivateXg7bFieldAbility,
  canActivateXg7bResident,
  collectXg7bTurnEndQueue,
  isXg7bActivatableResident,
  isXg7bBattleToRushTrigger,
  isXg7bFieldAbilityCard,
  isXg7bRushCounterCard,
  openXg7bAfterUnitLeft,
  openXg7bOnSelfRushFromZone,
  openXg7bTurnEndEntry,
  tryXg7bBattleToRush,
  tryXg7bOnEnterBattle,
  xg7bOnAttackWin,
  xg7bRushCounterConditionMet,
} from "./xg7bEffects";
import {
  activateXg7cFieldAbility,
  canActivateXg7cFieldAbility,
  consumeXg7cNextCardCost,
  isXg7cAttackedChoice,
  isXg7cBattleFieldAbilityCard,
  isXg7cRushFieldAbilityCard,
  isXg7cStrikeChoice,
  markXg7cRushOrigin,
  openXg7cBeforeOnRush,
  openXg7cLeaveStay,
  openXg7cOnAttacked,
  openXg7cOnSelfRushFromZone,
  openXg7cOnStrike,
  openXg7cOnUnitRushed,
  resolveXg7cAttacked,
  resolveXg7cStrike,
  skipXg7cAttacked,
  skipXg7cStrike,
} from "./xg7cEffects";

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
  return openXg7aLeaveStay(state, intent) ?? openXg7cLeaveStay(state, intent);
}

/** 自軍ユニットをラッシュしたときの効果（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。 */
export function openXg7OnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  const next = openXg7aOnUnitRushed(state, rusherPlayerId, rushedInstanceId, phasePlayerId);
  return openXg7cOnUnitRushed(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
}

/** ユニットがバトルエリアに出たとき（rules/combo.ts resolveEnterBattleEffectsImpl）。ほかの選択があればその後に開く。 */
export function tryXg7OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  return tryXg7bOnEnterBattle(state, playerId, card, battleBeforeEnter);
}

/** アタックして敵軍ユニットを撃破したとき（rules/operationCounters.ts resolveBattlePendingCore）。before はバトルの直前の state。 */
export function xg7OnAttackWin(state: GameState, before: GameState, attackerId: PlayerId, attackerInstanceId: string, defenderOwner: PlayerId, defenderInstanceId: string, defenderBp: number): GameState {
  return xg7bOnAttackWin(state, before, attackerId, attackerInstanceId, defenderOwner, defenderInstanceId, defenderBp);
}

/** 場を離れたとき（rules/operationCounters.ts finalizeLeavePending）。before は離れる前の state。 */
export function openXg7AfterUnitLeft(state: GameState, before: GameState, intent: PendingLeave, card: CardInstance, toZone: string, destroyed: boolean): GameState {
  return openXg7bAfterUnitLeft(state, before, intent, card, toZone, destroyed);
}

/** スタートフェイズにバトルエリアからラッシュエリアに戻ったとき（rules/startPhase.ts）。 */
export function isXg7BattleToRushTrigger(card: CardInstance): boolean {
  return isXg7bBattleToRushTrigger(card);
}

export function tryXg7BattleToRush(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  return tryXg7bBattleToRush(state, playerId, card, phasePlayerId);
}

/** 「自分がターンを終えるとき」（rules/turnEndingEffects.ts）。 */
export function collectXg7TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return collectXg7bTurnEndQueue(state, endingPlayerId);
}

export function openXg7TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  return openXg7bTurnEndEntry(state, endingPlayerId, entry);
}

/** 常駐オペレーションの起動（rules/permanentOperation.ts）。対象外のカードは null。 */
export function canActivateXg7Resident(state: GameState, playerId: PlayerId, op: CardInstance): boolean | null {
  return canActivateXg7bResident(state, playerId, op);
}

export function isXg7ActivatableResident(cardId: string): boolean {
  return isXg7bActivatableResident(cardId);
}

export function activateXg7Resident(state: GameState, playerId: PlayerId, op: CardInstance): GameState {
  return activateXg7bResident(state, playerId, op);
}

/** 場の起動型の能力（rules/fieldActivatedAbilities.ts）。 */
export function isXg7FieldAbilityCard(cardId: string): boolean {
  return isXg7bFieldAbilityCard(cardId) || isXg7cRushFieldAbilityCard(cardId);
}

/** バトルフェイズに起動する場の能力（XG7-052【タジャスピナー】）。 */
export function isXg7BattleFieldAbilityCard(cardId: string): boolean {
  return isXg7cBattleFieldAbilityCard(cardId);
}

export function canActivateXg7FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return canActivateXg7bFieldAbility(state, playerId, card) || canActivateXg7cFieldAbility(state, playerId, card);
}

export function activateXg7FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (isXg7bFieldAbilityCard(card.cardId)) return activateXg7bFieldAbility(state, playerId, card);
  return activateXg7cFieldAbility(state, playerId, card);
}

/** 「ラッシュされたとき」のカウンター（rules/operationCounters.ts・core/applyAction.ts）。XG7-027 雷撃ディスク。 */
export function isXg7RushCounterCard(cardId: string): boolean {
  return isXg7bRushCounterCard(cardId);
}

export function xg7RushCounterConditionMet(state: GameState, rushed: CardInstance, rushedOwnerId: PlayerId, rusherId: PlayerId, userId?: PlayerId): boolean {
  return xg7bRushCounterConditionMet(state, rushed, rushedOwnerId, rusherId, userId);
}

export function applyXg7RushCounter(state: GameState, playerId: PlayerId, counterInstanceId: string, pending: { phasePlayerId: PlayerId }): { state: GameState; log: string } {
  return applyXg7bRushCounter(state, playerId, counterInstanceId, pending.phasePlayerId);
}

/** ゾーン（手札以外）からユニットをラッシュしたとき（core/applyAction.ts self_rush_from_zone）。XG7-044【風都の護り手】。 */
export function openXg7OnSelfRushFromZone(state: GameState, rusherId: PlayerId, zone: string, rushedInstanceId: string): GameState {
  const next = openXg7bOnSelfRushFromZone(state, rusherId, zone, rushedInstanceId);
  return openXg7cOnSelfRushFromZone(next, rusherId, zone, rushedInstanceId);
}

/** 「ラッシュしたとき」の DSL を処理する間の、効果でラッシュエリアに出たかの印（rules/onRushUnitEffects.ts）。「手札からラッシュしたとき」の判定に使う。 */
export function markXg7RushOrigin(state: GameState, instanceId: string, viaEffect: boolean): GameState {
  return markXg7cRushOrigin(state, instanceId, viaEffect);
}

/** 手札からカードを使った（XG7-054 ◎2 の記録を消す。rules/onRushUnitEffects.ts・core/applyAction.ts play_operation）。 */
export function consumeXg7NextCardCost(state: GameState, playerId: PlayerId): GameState {
  return consumeXg7cNextCardCost(state, playerId);
}

/** 手札からラッシュされたユニットの「ラッシュしたとき」を実行する前（XG7-059【ゲームスタート……】。rules/onRushUnitEffects.ts）。開けなければ null。 */
export function openXg7BeforeOnRush(state: GameState, ownerId: PlayerId, instanceId: string, cardId: string, phasePlayerId: PlayerId): GameState | null {
  return openXg7cBeforeOnRush(state, ownerId, instanceId, cardId, phasePlayerId);
}

/** アタックされたとき（XG7-055【神出鬼没の疾風】。core/applyAction.ts continueAttackAfterDeclaration）。開けなければ null。 */
export function openXg7OnAttacked(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  return openXg7cOnAttacked(state, battle, wingAttackFromRush);
}

export function isXg7AttackedChoice(pending: PendingEffectChoice | undefined): boolean {
  return isXg7cAttackedChoice(pending);
}

export function resolveXg7Attacked(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | { error: string } {
  return resolveXg7cAttacked(state, playerId, instanceId);
}

export function skipXg7Attacked(state: GameState, playerId: PlayerId): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | null {
  return skipXg7cAttacked(state, playerId);
}

/** 相手にストライクされたとき（XG7-067 ※。core/applyAction.ts）。開けなければ null。 */
export function openXg7OnStrike(state: GameState, strike: PendingStrike): GameState | null {
  return openXg7cOnStrike(state, strike);
}

export function isXg7StrikeChoice(pending: PendingEffectChoice | undefined): boolean {
  return isXg7cStrikeChoice(pending);
}

export function resolveXg7Strike(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; strike: PendingStrike; log: string } | { error: string } {
  return resolveXg7cStrike(state, playerId, instanceId);
}

export function skipXg7Strike(state: GameState, playerId: PlayerId): { state: GameState; strike: PendingStrike } | null {
  return skipXg7cStrike(state, playerId);
}
