/**
 * クロスギャザー XG2（ザ・ドラゴンタイガー XG2-001〜XG2-103）のカード固有の効果の共通部分（cardSpec XG2-* の監査）。
 *
 * - 選択の登録（`registerXg2Choice`）と解決（`tryResolveXg2Choice` / `trySkipXg2Choice` / `tryConfirmXg2Choice`）。
 * - DSL の grant_keyword（`xg2::cardId::name`）の登録（`registerXg2Keyword`）と起点（`tryXg2CardEffect`）。
 * - ほかの処理の場所から呼ぶ効果（バトルフェイズ開始時・バトルの前・ストライクでダメージを与えたとき・コンビネーション・applyAction の後処理・
 *   常駐の起動）の登録と呼び出し。
 * カードごとの効果は rules/xg2/xg2aEffects.ts（XG2-001〜020）ほか。central のファイルは rules/xg2/xg2Effects.ts を読み込む（ここではカードの
 * ファイルを読み込まない）。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PendingStrike, PlayerId, Xg2Meta } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { getDefinition } from "../../core/catalog";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { leaveFieldInOrder } from "../fieldLeaveQueue";
import { patchPlayer } from "../playerPatches";
import { type ChoiceOutcome, close, findField, moveFieldUnit, proceed, skipLog, stripForZone, zoneOfField } from "../rm/rm1Effects";

export type { ChoiceOutcome };
export type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type KeywordHandler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;

type Registry = {
  resolvers: Record<string, ChoiceResolver>;
  skippers: Record<string, ChoiceSkipper>;
  confirmers: Record<string, ChoiceSkipper>;
  keywords: Record<string, KeywordHandler>;
  battlePhaseStart: BattlePhaseStartHook[];
  beforeBattle: BeforeBattleHook[];
  strikeDamage: StrikeDamageHook[];
  comboEnter: ComboEnterHook[];
  afterAction: AfterActionHook[];
  residents: ResidentHook[];
  battlePhaseEnd: BattlePhaseStartHook[];
  unitLeftZone: UnitLeftZoneHook[];
  afterUnitLeft: AfterUnitLeftHook[];
  leaveStay: LeaveStayHook[];
  battleToRush: BattleToRushHook[];
  turnEnd: BattlePhaseStartHook[];
  startPhaseEnd: BattlePhaseStartHook[];
  unitRushed: UnitRushedHook[];
  residentPlaced: ResidentPlacedHook[];
};

/**
 * 登録先（関数の宣言は先に初期化されるので、モジュールの循環した読み込みの途中でカードのファイルが登録しても TDZ にならない）。
 */
function registry(): Registry {
  const holder = registry as unknown as { r?: Registry };
  holder.r ??= { resolvers: {}, skippers: {}, confirmers: {}, keywords: {}, battlePhaseStart: [], beforeBattle: [], strikeDamage: [], comboEnter: [], afterAction: [], residents: [], battlePhaseEnd: [], unitLeftZone: [], afterUnitLeft: [], leaveStay: [], battleToRush: [], turnEnd: [], startPhaseEnd: [], unitRushed: [], residentPlaced: [] };
  return holder.r;
}

export const XG2_KEYWORD_PREFIX = "xg2::";

export function registerXg2Choice(effectId: string, handlers: { resolve?: ChoiceResolver; skip?: ChoiceSkipper; confirm?: ChoiceSkipper }): void {
  registry().resolvers[effectId] = handlers.resolve ?? (() => ({ error: "invalid_target" }));
  if (handlers.skip) registry().skippers[effectId] = handlers.skip;
  if (handlers.confirm) registry().confirmers[effectId] = handlers.confirm;
}

export function registerXg2Keyword(name: string, handler: KeywordHandler): void {
  registry().keywords[name] = handler;
}

export function isXg2ChoiceEffect(effectId: string): boolean {
  return effectId in registry().resolvers;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveXg2Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = registry().resolvers[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipXg2Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in registry().resolvers)) return null;
  const skipper = registry().skippers[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmXg2Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in registry().confirmers)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmXg2Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = registry().confirmers[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg2Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** DSL の grant_keyword（`xg2::cardId::name`）の起点（dsl/grantKeyword.ts）。対象外なら null。 */
export function tryXg2CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith("xg2::")) return null;
  const handler = registry().keywords[keyword.slice(5)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

/** 選択の続き（xg2Meta）を型付きで読む。 */
export function metaOf<T extends Xg2Meta>(pending: PendingEffectChoice): T {
  return (pending.xg2Meta ?? {}) as T;
}

// ---------------------------------------------------------------------------
// ほかの処理の場所から呼ぶ効果の登録

type BattlePhaseStartHook = (state: GameState, phasePlayerId: PlayerId) => GameState;
type BeforeBattleHook = { id: string; open: (state: GameState, pending: PendingBattle) => GameState | null };
type StrikeDamageHook = (state: GameState, pending: PendingStrike) => GameState;
type ComboEnterHook = (state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]) => GameState;
type AfterActionHook = (before: GameState, after: GameState) => GameState;
/** ユニットが場を離れたとき（events/listeners/unitLeftZoneListener.ts の撃破の判定の中）。 */
export type Xg2UnitLeftEvent = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  toZone: string;
  destroyed?: boolean;
  battleOpponentInstanceId?: string;
  phasePlayerId?: PlayerId;
};
type UnitLeftZoneHook = (state: GameState, event: Xg2UnitLeftEvent) => GameState;
/** 離場の処理を終えたとき（離れる前のカード。rules/operationCounters.ts）。 */
type AfterUnitLeftHook = (state: GameState, left: { ownerPlayerId: PlayerId; card: CardInstance; phasePlayerId: PlayerId }) => GameState;
/** 場を離れるとき（「その場に留まる」の選択。rules/operationCounters.ts tryLeaveField）。開いたら state、対象外なら null。 */
type LeaveStayHook = (state: GameState, intent: PendingLeave) => GameState | null;
/** バトルエリアからラッシュエリアに戻ったとき（rules/startPhase.ts）。 */
type BattleToRushHook = (state: GameState, ownerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId) => GameState;
/** ユニットがラッシュされたとき（「ラッシュされたとき」の誘発。rules/onRushUnitEffects.ts applyPassiveRushTriggers）。 */
type UnitRushedHook = (state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId) => GameState;
/** 常駐オペレーションを配置したとき（rules/residentOps.ts applyResidentOpOnPlace）。対象外なら null。 */
type ResidentPlacedHook = (state: GameState, ownerId: PlayerId, opInstanceId: string, cardId: string) => GameState | null;
type ResidentHook = {
  matches: (cardId: string) => boolean;
  canActivate: (state: GameState, playerId: PlayerId, op: CardInstance) => boolean;
  activate: (state: GameState, playerId: PlayerId, op: CardInstance) => GameState;
};

/** ほかの処理の場所から呼ぶ効果の登録（関数なので循環した読み込みの途中でも使える）。 */
export function xg2Hook<
  K extends
    | "battlePhaseStart"
    | "beforeBattle"
    | "strikeDamage"
    | "comboEnter"
    | "afterAction"
    | "residents"
    | "battlePhaseEnd"
    | "unitLeftZone"
    | "afterUnitLeft"
    | "leaveStay"
    | "battleToRush"
    | "turnEnd"
    | "startPhaseEnd"
    | "unitRushed"
    | "residentPlaced",
>(
  kind: K,
  hook: Registry[K][number],
): void {
  (registry()[kind] as unknown[]).push(hook);
}

/** バトルフェイズ開始時（ラッシュフェイズを終えてバトルフェイズに進んだとき。core/applyAction.ts end_phase）。 */
export function openXg2OnBattlePhaseStart(state: GameState, phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const hook of registry().battlePhaseStart) next = hook(next, phasePlayerId);
  return next;
}

/**
 * バトルの解決の直前（カウンターの窓のあと。rules/operationCounters.ts resolveBattlePendingCore）: 「アタックするとき、バトルの前に」の選択を開く。
 * 開いたら選択を開いた state を返す（バトルは選択のあとに pending.xg2Asked を付けて解決し直す）。対象外なら null。
 */
export function tryOpenXg2BattleChoice(state: GameState, pending: PendingBattle): GameState | null {
  if (pending.battleCancelled) return null;
  for (const hook of registry().beforeBattle) {
    if (pending.xg2Asked?.includes(hook.id)) continue;
    const opened = hook.open(state, { ...pending, xg2Asked: [...(pending.xg2Asked ?? []), hook.id] });
    if (opened) return opened;
  }
  return null;
}

/** ストライクでダメージを与えたとき（core/applyAction.ts finishStrikeResolution）。 */
export function applyXg2StrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  let next = state;
  for (const hook of registry().strikeDamage) next = hook(next, pending);
  return next;
}

/** バトルエリアに出たとき（コンビネーションの判定。rules/combo.ts）。battleBeforeEnter は出る前のバトルエリア。 */
export function applyXg2OnComboEnter(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  let next = state;
  for (const hook of registry().comboEnter) next = hook(next, playerId, card, battleBeforeEnter);
  return next;
}

/** applyAction の後処理（depth 0。core/applyAction.ts）。 */
export function applyXg2AfterAction(before: GameState, after: GameState): GameState {
  let next = after;
  for (const hook of registry().afterAction) next = hook(before, next);
  return next;
}

/** 自軍バトルフェイズを終えるとき（core/applyAction.ts end_phase。フェイズを進めたあとの state）。 */
export function applyXg2BattlePhaseEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  let next = state;
  for (const hook of registry().battlePhaseEnd) next = hook(next, endingPlayerId);
  return next;
}

/** 場のユニットが撃破されて捨札になったとき（events/listeners/unitLeftZoneListener.ts）。 */
export function applyXg2OnUnitLeftZone(state: GameState, event: Xg2UnitLeftEvent): GameState {
  let next = state;
  for (const hook of registry().unitLeftZone) next = hook(next, event);
  return next;
}

/** 離場の処理のあと（下に重ねたカードの扱い。rules/operationCounters.ts）。 */
export function applyXg2AfterUnitLeft(state: GameState, left: { ownerPlayerId: PlayerId; card: CardInstance; phasePlayerId: PlayerId }): GameState {
  let next = state;
  for (const hook of registry().afterUnitLeft) next = hook(next, left);
  return next;
}

/** 場を離れるとき「その場に留まる」の選択を開く（rules/operationCounters.ts tryLeaveField）。開いたら state、対象外なら null。 */
export function openXg2LeaveStay(state: GameState, intent: PendingLeave): GameState | null {
  for (const hook of registry().leaveStay) {
    const opened = hook(state, intent);
    if (opened) return opened;
  }
  return null;
}

/** バトルエリアからラッシュエリアに戻ったとき（rules/startPhase.ts continueBattleToRushEffectQueue）。 */
export function applyXg2BattleToRush(state: GameState, ownerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const hook of registry().battleToRush) {
    if (next.pendingEffectChoice) break;
    next = hook(next, ownerId, card, phasePlayerId);
  }
  return next;
}

/** 自分がターンを終えるとき（rules/turnEndingEffects.ts。選択を開かない処理だけ）。 */
export function applyXg2TurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  let next = state;
  for (const hook of registry().turnEnd) next = hook(next, endingPlayerId);
  return next;
}

/** 自軍スタートフェイズを終えるとき（rules/startPhase.ts transitionStartToChargePhase）。 */
export function applyXg2StartPhaseEnd(state: GameState, playerId: PlayerId): GameState {
  let next = state;
  for (const hook of registry().startPhaseEnd) next = hook(next, playerId);
  return next;
}

export function isXg2ActivatableResident(cardId: string): boolean {
  return registry().residents.some((h) => h.matches(cardId));
}

/** 常駐の起動ができるか（対象外のカードなら null。rules/permanentOperation.ts）。 */
export function canActivateXg2Resident(state: GameState, playerId: PlayerId, op: CardInstance): boolean | null {
  const hook = registry().residents.find((h) => h.matches(op.cardId));
  if (!hook) return null;
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup) return false;
  return hook.canActivate(state, playerId, op);
}

export function activateXg2Resident(state: GameState, playerId: PlayerId, op: CardInstance): GameState {
  const hook = registry().residents.find((h) => h.matches(op.cardId));
  return hook ? hook.activate(state, playerId, op) : state;
}

// ---------------------------------------------------------------------------
// 共通の部品

export function simpleSkipXg2(after?: (state: GameState, pending: PendingEffectChoice) => GameState): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    if (after) next = after(next, pending);
    return { state: proceed(next, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  };
}

export function ownTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** 「持ち主のゾーン」の行き先（パワーゾーンかコマンドゾーン。atwiki/page-1517 Q1）。 */
export const XG2_ZONE_POWER = "power";
export const XG2_ZONE_COMMAND = "command";

/** 持ち主のゾーンのうち、いま置ける行き先（コマンドゾーンは5枚未満のとき）。 */
export function ownerZoneOptions(state: GameState, ownerId: PlayerId): string[] {
  return state.players[ownerId].command.length < COMMAND_ZONE_MAX ? [XG2_ZONE_POWER, XG2_ZONE_COMMAND] : [XG2_ZONE_POWER];
}

/**
 * 場のカードを持ち主のゾーン（パワーゾーンにオモテ向き、またはコマンドゾーンにリリース状態）に置く（撃破ではない）。
 * コマンドゾーンが5枚ならパワーゾーンに置く。ライドしているビークル・下に重ねたカードは捨札（rules/rm/rm1Effects.ts moveFieldUnit と同じ）。
 */
export function placeInOwnersZone(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, zone: string): GameState {
  if (zone !== XG2_ZONE_COMMAND || state.players[ownerId].command.length >= COMMAND_ZONE_MAX) {
    return moveFieldUnit(state, ownerId, instanceId, phasePlayerId, "power");
  }
  const from = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!from || !found) return state;
  const moved = patchPlayer(state, ownerId, (p) => {
    const strip = (cards: CardInstance[]) =>
      cards.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    return {
      ...p,
      [from]: strip(p[from]),
      command: [...p.command, { ...stripForZone(found), commandHeld: false }],
      discard: [...p.discard, ...(found.stackedCards ?? []).map(stripForZone)],
    };
  });
  const left = emitUnitLeftZoneAndResolve(moved, {
    ownerPlayerId: ownerId,
    instanceId,
    cardId: found.cardId,
    fromZone: from,
    toZone: "command",
    phasePlayerId,
    destroyed: false,
  });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

/** 場のユニットを持ち主の山札の上・下に戻す（撃破ではない。離場の処理を通す）。 */
export function returnFieldUnitToDeck(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, where: "deck_top" | "deck_bottom"): GameState {
  const from = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!from || !found) return state;
  return leaveFieldInOrder(state, [
    { ownerPlayerId: ownerId, instanceId, fromZone: from, toZone: where, leavingCardId: found.cardId, phasePlayerId, notDestruction: true, skipRegister: true },
  ]);
}

/** 必要パワーの数字（「3+」は3。数字がなければ NaN）。 */
export function costNumber(state: Pick<GameState, "definitions">, cardId: string): number {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  if (typeof cost === "number") return cost;
  const m = /\d+/.exec(String(cost ?? ""));
  return m ? Number(m[0]) : Number.NaN;
}

/** ユニットがラッシュされたとき（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。 */
export function applyXg2OnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const hook of registry().unitRushed) next = hook(next, rusherPlayerId, rushedInstanceId, phasePlayerId);
  return next;
}

/** 常駐オペレーションを配置したとき（rules/residentOps.ts applyResidentOpOnPlace）。対象外なら null。 */
export function applyXg2ResidentPlaced(state: GameState, ownerId: PlayerId, opInstanceId: string, cardId: string): GameState | null {
  for (const hook of registry().residentPlaced) {
    const placed = hook(state, ownerId, opInstanceId, cardId);
    if (placed) return placed;
  }
  return null;
}

/**
 * 「これをホールドして次の効果を発動できる」（場のこのユニット自身をホールドする支払い。rules/commandPayment.ts needsEffectHoldPayment）:
 * XG2 の選択で、候補がこのユニット1体だけ（xg2Meta.selfHold）のとき。
 */
export function isXg2SelfHoldPayment(state: GameState, pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in registry().resolvers)) return false;
  if (!(pending.xg2Meta as { selfHold?: boolean } | undefined)?.selfHold) return false;
  const id = pending.validInstanceIds[0];
  return pending.validInstanceIds.length === 1 && !!id && id === pending.sourceInstanceId && !!findField(state, pending.playerId, id);
}

/** 支払いで場のこのユニットをホールドしたあとの続き（rules/pendingChoices.ts completeEffectHoldChoice）。対象外なら null。 */
export function tryCompleteXg2HoldChoice(state: GameState, playerId: PlayerId, instanceIds: string[]): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || !isXg2SelfHoldPayment(state, pending)) return null;
  return tryResolveXg2Choice(state, playerId, instanceIds[0] ?? "");
}
