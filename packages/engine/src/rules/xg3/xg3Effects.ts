/**
 * クロスギャザー ザ・Wインパクト（XG3-002〜XG3-103）のカード固有の効果の入口（cardSpec XG3-* の監査）。
 *
 * - `tryXg3CardEffect`: DSL の grant_keyword から呼ばれる起点（`xg3::cardId::name`）。
 * - `tryResolveXg3Choice` / `trySkipXg3Choice` / `tryConfirmXg3Choice` / `tryCompleteXg3HoldChoice`: このモジュールが開いた選択の解決
 *   （rules/pendingChoices.ts・core/legalActions.ts）。
 * - `applyXg3AfterAction`: applyAction の後処理（core/applyAction.ts）。
 * カードごとの処理はバッチのファイル（xg3aEffects.ts＝XG3-002〜021 等）、継続効果の判定は xg3Fields.ts。
 */
import type { CardInstance, DeferredPowerFlip, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import type { GameAction } from "../../types/actions";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { type ChoiceOutcome, close, logFor } from "../rm/rm1Effects";
import { patchPlayer } from "../playerPatches";
import { AFTER_ACTION_HOOKS, BATTLE_DESTROY_HOOKS, BEFORE_FLIP_HOOKS, FIELD_ABILITIES, LEAVE_STAY_HOOKS, ENTER_BATTLE_HOOKS, START_PHASE_HOOKS, STRIKE_HOOKS, UNIT_RUSHED_HOOKS, TURN_END_HOOKS, ZONE_ACTIVATIONS, CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, HOLD_COMPLETERS, KEYWORDS, XG3_KEYWORD_PREFIX } from "./xg3Registry";
import "./xg3aEffects";
import "./xg3bEffects";
import "./xg3cEffects";

export function isXg3ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

export function tryResolveXg3Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipXg3Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper && !isXg3ChoiceEffect(pending.effectId)) return null;
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function canConfirmXg3Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

export function tryConfirmXg3Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg3Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** コマンドの支払いでホールドするコマンドを選び終えた（rules/pendingChoices.ts）。対象外なら null。 */
export function tryCompleteXg3HoldChoice(state: GameState, playerId: PlayerId, commandInstanceIds: string[]): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const completer = HOLD_COMPLETERS[pending.effectId];
  if (!completer) return null;
  const held = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (commandInstanceIds.includes(c.instanceId) && !c.commandHeld ? { ...c, commandHeld: true } : c)),
  }));
  return { state: completer(held, pending, commandInstanceIds), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:hold`) };
}

export function tryXg3CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(XG3_KEYWORD_PREFIX)) return null;
  const handler = KEYWORDS[keyword.slice(XG3_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

/** applyAction の後処理（深さ0の行動のあと。core/applyAction.ts）。 */
export function applyXg3AfterAction(before: GameState, after: GameState): GameState {
  let next = after;
  for (const hook of AFTER_ACTION_HOOKS) next = hook(before, next);
  return next;
}

/** 「自分がターンを終えるとき」の処理待ち（rules/turnEndingEffects.ts）。 */
export function collectXg3TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return TURN_END_HOOKS.flatMap((h) => h.collect(state, endingPlayerId).map((id) => `${h.kind}:${id}`));
}

export function openXg3TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  const hook = TURN_END_HOOKS.find((h) => h.kind === kind);
  return hook ? hook.open(state, endingPlayerId, instanceId) : state;
}

/** 自軍ゾーンのカードの起動（self_rush_from_zone）。このモジュールのカードでなければ null。 */
export function canActivateXg3FromZone(state: GameState, playerId: PlayerId, zone: "power" | "command" | "hand" | "discard", instanceId: string): boolean | null {
  const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
  const entry = card && ZONE_ACTIVATIONS.find((a) => a.zone === zone && a.matches(card.cardId));
  if (!entry) return null;
  return entry.canActivate(state, playerId, instanceId);
}

export function activateXg3FromZone(state: GameState, playerId: PlayerId, zone: "power" | "command" | "hand" | "discard", instanceId: string): GameState | null {
  const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
  const entry = card && ZONE_ACTIVATIONS.find((a) => a.zone === zone && a.matches(card.cardId));
  if (!entry) return null;
  if (!entry.canActivate(state, playerId, instanceId)) return null;
  return entry.activate(state, playerId, instanceId);
}

/** パワーのカードをウラ返してダメージにする前（rules/damagePayment.ts）。選択を開かなければ null。 */
export function openXg3BeforeFlip(state: GameState, flip: DeferredPowerFlip): GameState | null {
  for (const hook of BEFORE_FLIP_HOOKS) {
    const opened = hook(state, flip);
    if (opened) return opened;
  }
  return null;
}

/** 自軍ユニットがバトルエリアに出たとき（rules/combo.ts）。 */
export function tryXg3OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  let next = state;
  for (const hook of ENTER_BATTLE_HOOKS) next = hook(next, playerId, card, battleBeforeEnter);
  return next;
}

/** 自分がユニットをラッシュしたとき（rules/onRushUnitEffects.ts）。 */
export function openXg3OnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const hook of UNIT_RUSHED_HOOKS) next = hook(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
  return next;
}

/** 自軍スタートフェイズ開始時（rules/startPhaseBegin.ts）。 */
export function openXg3StartPhaseBegin(state: GameState, playerId: PlayerId): GameState {
  let next = state;
  for (const hook of START_PHASE_HOOKS) next = hook(next, playerId);
  return next;
}

/** 場のユニットの起動（rules/fieldActivatedAbilities.ts）。 */
export function isXg3FieldAbilityCard(cardId: string): boolean {
  return FIELD_ABILITIES.some((a) => a.matches(cardId));
}

export function canActivateXg3FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return FIELD_ABILITIES.some((a) => a.matches(card.cardId) && a.canActivate(state, playerId, card));
}

export function activateXg3FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const entry = FIELD_ABILITIES.find((a) => a.matches(card.cardId) && a.canActivate(state, playerId, card));
  return entry ? entry.resolve(state, playerId, card) : state;
}

/**
 * 合法手の後処理（core/legalActions.ts）: XG3-024・XG3-025 で「自軍ラッシュフェイズを行うとき、かわりに」効果を発動したターンは、
 * そのラッシュフェイズのラッシュ（手札から・ゾーンから出す）をもう行わない。
 */
export function filterXg3LegalActions(state: GameState, actions: GameAction[]): GameAction[] {
  const replaced = state.xg3?.rushPhaseReplaced;
  if (!replaced || replaced.turn !== state.turn || replaced.ownerId !== state.activePlayer || state.phase !== "rush") return actions;
  if (state.pendingEffectChoice || state.pendingEffectRush || state.pendingCommandPayment || state.pendingZordSetup) return actions;
  return actions.filter(
    (a) =>
      a.playerId !== replaced.ownerId ||
      !(a.type === "rush" || a.type === "begin_zord_setup" || a.type === "self_rush_from_zone" || (a.type === "initiate_command_payment" && a.kind === "category_use")),
  );
}

/** ユニットがストライクしたとき（events/listeners/strikeDeclaredListener.ts）。 */
export function applyXg3OnStrike(state: GameState, strikerPlayerId: PlayerId, striker: CardInstance): GameState {
  let next = state;
  for (const hook of STRIKE_HOOKS) next = hook(next, strikerPlayerId, striker);
  return next;
}

/** ユニットがバトルで敵軍ユニットを撃破したとき（rules/operationCounters.ts）。 */
export function applyXg3OnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  let next = state;
  for (const hook of BATTLE_DESTROY_HOOKS) next = hook(next, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
  return next;
}

/** 場を離れるユニットをかわりにその場に留める（rules/operationCounters.ts tryLeaveField）。対象外なら null。 */
export function openXg3StayOnLeave(state: GameState, intent: PendingLeave): GameState | null {
  for (const hook of LEAVE_STAY_HOOKS) {
    const done = hook(state, intent);
    if (done) return done;
  }
  return null;
}
