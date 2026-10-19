/**
 * ザ・マスクドライダーEXP vol.4 RK-316〜RK-335（キバットバットⅢ世〜モモタロス（2nd））のカード固有の効果（cardSpec RK16-316-335 の監査）。
 *
 * - `tryRk16CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk16::cardId::name`。RC・ラッシュしたとき）。
 * - `tryResolveRk16Choice` / `trySkipRk16Choice` / `tryConfirmRk16Choice`: このモジュールが開いた選択の解決。
 * - `tryRk16OnEnterBattle`: 自軍ターン中にバトルエリアに出たとき（rules/combo.ts）。RK-318・RK-321・RK-325（ライドされて一緒に出たとき）・
 *   RK-329・RK-331・RK-332（「ドラゴン」のユニットからのコンビネーション）。
 * - `openRk16Fuessle` / `canActivateRk16Fuessle`: RK-326・RK-327・RK-328 の【フエッスル】（rules/fieldActivatedAbilities.ts）。
 * - `applyRk16StrikeDamageTriggers`: RK-320【ファイナルライジングブラスト】（core/applyAction.ts finishStrikeResolution）。
 * - `rk16OnBattleDestroy`: RK-324【凄いのが来るぜ！】（rules/operationCounters.ts）。
 * - `collectRk16TurnEndQueue` / `openRk16TurnEndEntry`: RK-323【シャドウベール】（rules/turnEndingEffects.ts）。
 * 継続効果の判定（RK-317・RK-320 の※・RK-325・RK-327・RK-332・RK-334）は rules/rk/rk16Fields.ts。
 * 構成は rules/rk/rk15UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingStrike, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { namedTextNegated } from "../legend1/set6NamedEffects348";
import { rk1IsSmallNow } from "./rk1Features";
import { rk14ActsAsVehicle } from "./rk14Fields";
import { rk16CostNumber, rk16StrikesReceived } from "./rk16Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK16_KEYWORD_PREFIX = "rk16::";

export function isRk16ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk16Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk16Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmRk16Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk16Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk16Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

/** 選択を開く。既に別の選択が開いていればその後に開く。 */
function openOrQueue(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  return openEffectChoice(state, choice);
}

/** 選択を閉じた state（resumeChoice はまだ開かない）。 */
function close(state: GameState, pending: PendingEffectChoice): GameState {
  return state.pendingEffectChoice === pending
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
}

/** 効果の処理を終える（割り込みがなければ resumeChoice を開くかバトル進入を続ける）。 */
function proceed(state: GameState, pending: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) {
    return pending.resumeChoice ? { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, pending.resumeChoice) } : state;
  }
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment || state.pendingEffectRush) {
    if (!pending.resumeChoice) return state;
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
  }
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

/** 続き（resumeChoice）を引き継いで次の選択を開く。 */
function openNext(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return openEffectChoice(state, { ...next, resumeChoice: pending.resumeChoice });
}

function simpleSkip(): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  };
}

type BaseCtx = { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string };

function base(ctx: BaseCtx, sourceCardId: string) {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    selectedInstanceIds: [] as string[],
  };
}

function ctxBase(ctx: GrantKeywordContext): BaseCtx {
  return { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId };
}

function confirmChoice(ctx: BaseCtx, sourceCardId: string, effectId: string): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: [], optional: true, mayConfirm: true };
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function fieldCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/** 場のユニット（RK-280・RK-281 のビークルとして扱っているものを除く）。 */
function fieldUnits(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  return fieldCards(state, playerId).filter((c) => isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(state.players[playerId], c));
}

function findField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  return fieldCards(state, playerId).find((c) => c.instanceId === instanceId);
}

function zoneOfField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): "battle" | "rush" | null {
  const p = state.players[playerId];
  if (p.battle.some((c) => c.instanceId === instanceId)) return "battle";
  if (p.rush.some((c) => c.instanceId === instanceId)) return "rush";
  return null;
}

/** 敵軍の効果で選べる敵軍のカード（「相手に選ばれない」等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function printedBp(state: Pick<GameState, "definitions">, cardId: string): number {
  const bp = getDefinition(state.definitions, cardId)?.bp;
  return typeof bp === "number" ? bp : Number.NaN;
}

function setHeld(state: GameState, ownerId: PlayerId, instanceId: string, held: boolean): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: held } : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: held } : c)),
  }));
}

/** 汎用の1体選択（撃破・パワーゾーンへ送る・ダメージにする。rules/pendingChoices.ts の select_unit と unitDestination で処理する）。 */
function genericPick(
  ctx: BaseCtx,
  sourceCardId: string,
  effectId: string,
  ids: string[],
  optional: boolean,
  unitDestination: "discard" | "power",
  placeAsDamage = false,
): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, unitDestination, ...(placeAsDamage ? { placeAsDamage: true } : {}) };
}

/** ids のユニットをすべて撃破する（全員を選んだ確定済みの撃破の選択で処理する）。 */
function destroyAll(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[]): GameState {
  if (ids.length === 0) return state;
  const choice: PendingEffectChoice = {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "select_units_bp_budget",
    validInstanceIds: ids,
    selectedInstanceIds: ids,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
  };
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  const opened = openEffectChoice(state, choice);
  const destroyed = applyConfirmEffectChoice(opened, ctx.playerId);
  return "error" in destroyed ? state : destroyed.state;
}

/** 場のユニットを持ち主のコマンドゾーンにホールド状態で置く（置けなければ捨札。撃破ではない）。 */
function placeInOwnerCommand(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!zone || !found) return state;
  const toCommand = state.players[ownerId].command.length < COMMAND_ZONE_MAX;
  const moved = patchPlayer(state, ownerId, (p) => ({
    ...p,
    [zone]: p[zone].filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c)),
    command: toCommand ? [...p.command, { ...stripForZone(found), commandHeld: true }] : p.command,
    discard: [...p.discard, ...(toCommand ? [] : [stripForZone(found)]), ...(found.stackedCards ?? []).map(stripForZone)],
  }));
  const left = emitUnitLeftZoneAndResolve(moved, {
    ownerPlayerId: ownerId,
    instanceId,
    cardId: found.cardId,
    fromZone: zone,
    toZone: toCommand ? "command" : "discard",
    phasePlayerId,
    destroyed: false,
  });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

/** カードを持ち主のパワーゾーンにダメージ（ウラ向き）として置く（場・ゾーンから外す処理は呼び出し側）。 */
function addAsDamage(state: GameState, ownerId: PlayerId, card: CardInstance): GameState {
  return patchPlayer(state, ownerId, (p) => ({ ...p, power: [...p.power, { ...stripForZone(card), faceDown: true }], damage: p.damage + 1 }));
}

/** 敵軍の場のユニットを持ち主のコマンドゾーンに置く選択（強制）の共通の解決。 */
function commandPlaceResolver(sourceCardId: string, effectId: string): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const card = findField(state, enemyId, instanceId);
    if (!card) return { error: "invalid_target" };
    const next = placeInOwnerCommand(close(state, pending), enemyId, instanceId, pending.phasePlayerId);
    return { state: proceed(next, pending), log: logFor(state, playerId, sourceCardId, `${effectId}:${cardName(state.definitions, card.cardId)}`) };
  };
}

// ---------------------------------------------------------------------------
// RK-318 仮面ライダーイクサSM【ブロウクン・ファング】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍バトルエリアから敵軍ダメージの点数以下の必要パワーの数字を持つSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ
//  捨札にする。そうしたとき、このユニットがリリース状態ならホールドし、ホールド状態なら撃破する。」（atwiki/page-1385）。強制（カード評価）。
// 置けずに捨札にしたときも「そうしたとき」の後半を行う。選べるユニットがなければ何もしない。

export const FANG_EFFECT_ID = "rk318_broken_fang";

function openBrokenFang(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const damage = state.players[enemyId].damage;
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const n = rk16CostNumber(state, c.cardId);
      return isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && Number.isFinite(n) && n <= damage && selectableEnemy(state, playerId, "RK-318", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-318"), effectId: FANG_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
}

CHOICE_RESOLVERS[FANG_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = findField(state, enemyId, instanceId);
  if (!card) return { error: "invalid_target" };
  let next = placeInOwnerCommand(close(state, pending), enemyId, instanceId, pending.phasePlayerId);
  const selfId = pending.sourceInstanceId;
  const self = selfId ? findField(next, playerId, selfId) : undefined;
  if (self && selfId) {
    if (self.commandHeld) next = destroyAll(next, { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: selfId }, "RK-318", "rk318_broken_fang_self", [selfId]);
    else next = setHeld(next, playerId, selfId, true);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-318", `${FANG_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-319 仮面ライダーイクサBM
// ※「これをラッシュしたとき、自軍コマンドゾーンのカードを１枚選び捨札にしてもよい。そうしたとき、自軍山札を見て、必要パワーの数字が「1」か「9」か「3」の
//   カードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい。その後、山札をシャッフルする。」（atwiki/page-1408）。
//   必要パワーの数字は「+」「-」を除いた数字。山札を見たら（選ばなくても）シャッフルする。
// 【イクサ・ジャッジメント】（RC）「敵軍バトルエリアから、BPが本来のBPでないユニットを１体選び、持ち主のコマンドゾーンにホールド状態で置く。
//   置けなければ捨札にする。」。サイズを問わない（カード評価）。強制。

export const SWAP_EFFECT_ID = "rk319_command_swap";
export const SEARCH_EFFECT_ID = "rk319_deck_search";
export const JUDGMENT_EFFECT_ID = "rk319_ixa_judgment";

function applyCommandSwap(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk319:no_command" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-319"), effectId: SWAP_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SWAP_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SWAP_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== commandId),
    discard: [...p.discard, stripForZone(cmd)],
  }));
  const log = logFor(state, playerId, "RK-319", `${SWAP_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`);
  const deck = next.players[playerId].deck;
  const ids = deck.filter((c) => [1, 9, 3].includes(rk16CostNumber(next, c.cardId))).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(shuffleDeck(next, playerId), pending), log };
  return {
    state: openNext(next, pending, {
      ...base({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-319"),
      effectId: SEARCH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      viewedInstanceIds: deck.map((c) => c.instanceId),
      selectCount: 1,
      optional: true,
    }),
    log,
  };
};
CHOICE_SKIPPERS[SWAP_EFFECT_ID] = simpleSkip();

function shuffleDeck(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
}

CHOICE_RESOLVERS[SEARCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
    command: p.command.length < COMMAND_ZONE_MAX ? [...p.command, { ...stripForZone(card), commandHeld: true }] : p.command,
    discard: p.command.length < COMMAND_ZONE_MAX ? p.discard : [...p.discard, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-319", `${SEARCH_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[SEARCH_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(shuffleDeck(close(state, pending), playerId), pending), log: skipLog(state, playerId, "RK-319", SEARCH_EFFECT_ID) };
};

function applyIxaJudgment(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(state.players[enemyId], c) && effectiveBp(state, enemyId, c) !== printedBp(state, c.cardId) && selectableEnemy(state, ctx.playerId, "RK-319", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk319:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-319"), effectId: JUDGMENT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: JUDGMENT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[JUDGMENT_EFFECT_ID] = commandPlaceResolver("RK-319", JUDGMENT_EFFECT_ID);

// ---------------------------------------------------------------------------
// RK-320 仮面ライダーライジングイクサ【ファイナルライジングブラスト】
// 「これが自軍バトルエリアにある間、敵軍ターン中、ストライクを2回以上されてダメージを受けたとき、これをラッシュエリアに戻してもよい。そうしたとき、
//  敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1250）
// ストライクの回数はダメージの有無を問わず数える（カード評価「１回目のストライクを防いでも2回ストライクされてダメージを受ければ」）。
// 敵軍 S ユニットはエリアを問わない。戻したら選ぶのは強制。

export const BLAST_EFFECT_ID = "rk320_final_rising_blast";
export const BLAST_TARGET_EFFECT_ID = "rk320_final_rising_blast_target";

export function applyRk16StrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  const defenderId = opponent(pending.strikerPlayerId);
  if (pending.battlePhasePlayer === defenderId) return state;
  if (rk16StrikesReceived(state, defenderId) < 2) return state;
  let next = state;
  for (const card of next.players[defenderId].battle) {
    if (!isSameCardIdentity(card.cardId, "RK-320")) continue;
    next = openOrQueue(next, confirmChoice({ playerId: defenderId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: card.instanceId }, "RK-320", BLAST_EFFECT_ID));
  }
  return next;
}

CHOICE_RESOLVERS[BLAST_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[BLAST_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[BLAST_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  const self = selfId ? next.players[playerId].battle.find((c) => c.instanceId === selfId) : undefined;
  if (!self) return { state: proceed(next, pending), log: skipLog(state, playerId, "RK-320", BLAST_EFFECT_ID) };
  const vehicleId = self.mountedOnInstanceId;
  next = patchPlayer(next, playerId, (p) => {
    const moving = p.battle.filter((c) => c.instanceId === selfId || (vehicleId !== undefined && c.instanceId === vehicleId));
    return {
      ...p,
      battle: p.battle.filter((c) => !moving.includes(c)),
      rush: [...p.rush, ...moving.map((c) => ({ ...c, battleActed: undefined }))],
    };
  });
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && selectableEnemy(next, playerId, "RK-320", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-320", `${BLAST_EFFECT_ID}:return`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: selfId }, "RK-320"), effectId: BLAST_TARGET_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    log,
  };
};
CHOICE_RESOLVERS[BLAST_TARGET_EFFECT_ID] = commandPlaceResolver("RK-320", BLAST_TARGET_EFFECT_ID);

// ---------------------------------------------------------------------------
// RK-321 仮面ライダーサガ【スネーキングデスブレイク】（自軍ターン中、バトルエリアに出たとき）
// 「このユニットをホールドしてもよい。そうしたとき、敵軍Sユニットの下に重ねたカード（ユニットやビークルとして扱われているものも含む。ウラ向きのカードは
//  ウラ向きのまま選ぶ）を1枚選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1253）
// ライドされているビークルもユニットの下のカード（RK-323 カード評価「ライド中のユニットの天敵である…仮面ライダーサガ」）。エリアを問わない。
// ユニットではなく下のカードを選ぶので「相手に選ばれない」ユニットの下のカードも選べる（コメント欄）。ホールド状態で出たときは発動しない。

export const SNAKE_EFFECT_ID = "rk321_snaking_death_break";
export const SNAKE_TARGET_EFFECT_ID = "rk321_snaking_death_break_target";

function underCards(state: GameState, enemyId: PlayerId): string[] {
  const p = state.players[enemyId];
  const ids: string[] = [];
  for (const zone of ["battle", "rush"] as const) {
    for (const unit of p[zone]) {
      if (!isUnitCard(state, unit.cardId) || rk14ActsAsVehicle(p, unit) || !rk1IsSmallNow(state, unit)) continue;
      if (unit.mountedOnInstanceId && p[zone].some((c) => c.instanceId === unit.mountedOnInstanceId)) ids.push(unit.mountedOnInstanceId);
      ids.push(...(unit.stackedCards ?? []).map((c) => c.instanceId));
    }
  }
  return ids;
}

function openSnakingDeathBreak(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  if (self.commandHeld) return state;
  return openOrQueue(state, confirmChoice({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-321", SNAKE_EFFECT_ID));
}

CHOICE_RESOLVERS[SNAKE_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SNAKE_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[SNAKE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (pending.sourceInstanceId && zoneOfField(next, playerId, pending.sourceInstanceId)) next = setHeld(next, playerId, pending.sourceInstanceId, true);
  const ids = underCards(next, opponent(playerId));
  const log = logFor(state, playerId, "RK-321", `${SNAKE_EFFECT_ID}:hold`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-321"), effectId: SNAKE_TARGET_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    log,
  };
};

CHOICE_RESOLVERS[SNAKE_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const p = state.players[enemyId];
  let taken: CardInstance | undefined;
  let next = close(state, pending);
  for (const zone of ["battle", "rush"] as const) {
    const vehicle = p[zone].find((c) => c.instanceId === instanceId);
    if (vehicle) {
      taken = vehicle;
      next = patchPlayer(next, enemyId, (q) => ({
        ...q,
        [zone]: q[zone].filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c)),
      }));
      break;
    }
    const holder = p[zone].find((c) => (c.stackedCards ?? []).some((s) => s.instanceId === instanceId));
    if (holder) {
      taken = holder.stackedCards!.find((s) => s.instanceId === instanceId);
      next = patchPlayer(next, enemyId, (q) => ({
        ...q,
        [zone]: q[zone].map((c) => (c.instanceId === holder.instanceId ? { ...c, stackedCards: (c.stackedCards ?? []).filter((s) => s.instanceId !== instanceId) } : c)),
      }));
      break;
    }
  }
  if (!taken) return { error: "invalid_target" };
  next = addAsDamage(next, enemyId, taken);
  const label = taken.faceDown ? "face_down" : cardName(state.definitions, taken.cardId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-321", `${SNAKE_TARGET_EFFECT_ID}:${label}`) };
};

// ---------------------------------------------------------------------------
// RK-323 マシンキバー【シャドウベール】「自分がターンを終えるとき、これにライドしているユニットがホールド状態ならば、そのユニットをリリースしてもよい。」
// （atwiki/page-1348）

export const VEIL_EFFECT_ID = "rk323_shadow_veil";

function riderOf(state: GameState, playerId: PlayerId, vehicleId: string): CardInstance | undefined {
  return fieldCards(state, playerId).find((c) => c.mountedOnInstanceId === vehicleId);
}

export function collectRk16TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return fieldCards(state, endingPlayerId)
    .filter((c) => isSameCardIdentity(c.cardId, "RK-323") && riderOf(state, endingPlayerId, c.instanceId)?.commandHeld === true)
    .map((c) => `veil:${c.instanceId}`);
}

export function openRk16TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  if (kind !== "veil" || !zoneOfField(state, endingPlayerId, instanceId)) return state;
  if (riderOf(state, endingPlayerId, instanceId)?.commandHeld !== true) return state;
  return openEffectChoice(state, confirmChoice({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, "RK-323", VEIL_EFFECT_ID));
}

CHOICE_RESOLVERS[VEIL_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[VEIL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-323", VEIL_EFFECT_ID) };
};
CHOICE_CONFIRMERS[VEIL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const rider = pending.sourceInstanceId ? riderOf(next, playerId, pending.sourceInstanceId) : undefined;
  if (rider) next = setHeld(next, playerId, rider.instanceId, false);
  return { state: next, log: logFor(state, playerId, "RK-323", `${VEIL_EFFECT_ID}:release`) };
};

// ---------------------------------------------------------------------------
// RK-324 ブロンブースター【凄いのが来るぜ！】「これにライドしているユニットがBP4000以上の敵軍Sユニットを撃破して捨札にしたとき、捨札にしたその
//  ユニットカードを持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1356）
// バトルで撃破したとき（アタックしたとき・アタックされたとき）。BP は撃破したときのバトルの BP。

export const BOOST_EFFECT_ID = "rk324_bron_boost";

export function rk16OnBattleDestroy(
  state: GameState,
  winnerId: PlayerId,
  winnerInstanceId: string,
  defeatedOwnerId: PlayerId,
  defeatedInstanceId: string,
  defeatedBp: number,
): GameState {
  if (winnerId === defeatedOwnerId || defeatedBp < 4000) return state;
  const winner = findField(state, winnerId, winnerInstanceId);
  const vehicleId = winner?.mountedOnInstanceId;
  const vehicle = vehicleId ? findField(state, winnerId, vehicleId) : undefined;
  if (!vehicle || !isSameCardIdentity(vehicle.cardId, "RK-324")) return state;
  const defeated = state.players[defeatedOwnerId].discard.find((c) => c.instanceId === defeatedInstanceId);
  if (!defeated || unitSizeOf(state.definitions, defeated) !== "S") return state;
  return openOrQueue(state, {
    ...confirmChoice({ playerId: winnerId, phasePlayerId: state.activePlayer, sourceInstanceId: vehicle.instanceId }, "RK-324", BOOST_EFFECT_ID),
    rk16Meta: { picked: defeatedInstanceId, owner: defeatedOwnerId },
  });
}

CHOICE_RESOLVERS[BOOST_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[BOOST_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[BOOST_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = pending.rk16Meta?.owner ?? opponent(playerId);
  const id = pending.rk16Meta?.picked;
  let next = close(state, pending);
  const card = next.players[ownerId].discard.find((c) => c.instanceId === id);
  if (card) {
    next = patchPlayer(next, ownerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== id) }));
    next = addAsDamage(next, ownerId, card);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-324", `${BOOST_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : "none"}`) };
};

// ---------------------------------------------------------------------------
// RK-325 パワードイクサー【イクサポッド】（自軍ターン中、ライドされて一緒にバトルエリアに出たとき）
// 「自軍コマンドゾーンからカードを1枚選び、自軍山札の上か下に戻してもよい。そうしたとき、戻したカードの必要パワーの数字と同じ必要パワーの数字を持つ
//  Sユニットを敵軍バトルエリアから1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1347）
// コマンドのカードを選び → 上（deck_top）か下（deck_bottom）を選ぶ → 同じ必要パワーの数字の敵軍 S ユニットを選ぶ（強制）。

export const POD_PICK_EFFECT_ID = "rk325_ixa_pod_pick";
export const POD_PLACE_EFFECT_ID = "rk325_ixa_pod_place";
export const POD_TARGET_EFFECT_ID = "rk325_ixa_pod_target";
const DECK_TOP = "deck_top";
const DECK_BOTTOM = "deck_bottom";

function openIxaPod(state: GameState, playerId: PlayerId, vehicle: CardInstance): GameState {
  const ids = state.players[playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId }, "RK-325"), effectId: POD_PICK_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true });
}

CHOICE_RESOLVERS[POD_PICK_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  if (!state.players[playerId].command.some((c) => c.instanceId === commandId)) return { error: "invalid_target" };
  return {
    state: { ...state, pendingEffectChoice: { ...pending, effectId: POD_PLACE_EFFECT_ID, kind: "confirm", validInstanceIds: [DECK_TOP, DECK_BOTTOM], optional: false, rk16Meta: { picked: commandId } } },
    log: logFor(state, playerId, "RK-325", `${POD_PICK_EFFECT_ID}:${commandId}`),
  };
};
CHOICE_SKIPPERS[POD_PICK_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[POD_PLACE_EFFECT_ID] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  const id = pending.rk16Meta?.picked;
  const card = state.players[playerId].command.find((c) => c.instanceId === id);
  if (!card || !id) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== id),
    deck: where === DECK_TOP ? [stripForZone(card), ...p.deck] : [...p.deck, stripForZone(card)],
  }));
  const cost = rk16CostNumber(state, card.cardId);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && rk16CostNumber(next, c.cardId) === cost && selectableEnemy(next, playerId, "RK-325", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-325", `${POD_PLACE_EFFECT_ID}:${where}`);
  if (!Number.isFinite(cost) || ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-325"), effectId: POD_TARGET_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    log,
  };
};
CHOICE_RESOLVERS[POD_TARGET_EFFECT_ID] = commandPlaceResolver("RK-325", POD_TARGET_EFFECT_ID);

// ---------------------------------------------------------------------------
// RK-326 ガルル獣人態【ガルルフエッスル】・RK-327 バッシャー獣人態【バッシャーフエッスル】・RK-328 ドッガ怪人態【ドッガフエッスル】
// 「自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒自軍山札を見て「仮面ライダーキバGF」のカードを1枚か、自軍捨札に「バッシャー獣人態」
//  と「ドッガ怪人態」があれば「仮面ライダーキバDGBKF」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。」
// （atwiki/page-1351・page-1352・page-1353）。出すカードは必要パワーと追加条件を問わない（カード評価「パワーを無視して」）。効果でラッシュしたものとして扱う。
// 捨札にするのは起動の対価（rules/fieldActivatedAbilities.ts）。効果名を持つテキストなので、RK-334 があれば発動できない。

const FUESSLE: Record<string, { kiba: string; others: [string, string] }> = {
  "RK-326": { kiba: "仮面ライダーキバGF", others: ["バッシャー獣人態", "ドッガ怪人態"] },
  "RK-327": { kiba: "仮面ライダーキバBF", others: ["ガルル獣人態", "ドッガ怪人態"] },
  "RK-328": { kiba: "仮面ライダーキバDF", others: ["ガルル獣人態", "バッシャー獣人態"] },
};

export const FUESSLE_EFFECT_ID = "rk326_fuessle";

function fuessleOf(cardId: string): { id: string; kiba: string; others: [string, string] } | undefined {
  const id = Object.keys(FUESSLE).find((k) => isSameCardIdentity(cardId, k));
  return id ? { id, ...FUESSLE[id]! } : undefined;
}

export function isRk16FuessleCard(cardId: string): boolean {
  return !!fuessleOf(cardId);
}

export function canActivateRk16Fuessle(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return !!fuessleOf(card.cardId) && !namedTextNegated(state, playerId, card);
}

function namedIs(state: GameState, cardId: string, name: string): boolean {
  return sameCardName(getDefinition(state.definitions, cardId)?.name, name);
}

/** 起動の対価（このユニットを捨札にする）を払った後に開く。 */
export function openRk16Fuessle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const f = fuessleOf(card.cardId);
  if (!f) return state;
  const p = state.players[playerId];
  const dgbkf = f.others.every((n) => p.discard.some((c) => namedIs(state, c.cardId, n)));
  const ids = p.deck
    .filter((c) => isUnitCard(state, c.cardId) && (namedIs(state, c.cardId, f.kiba) || (dgbkf && namedIs(state, c.cardId, "仮面ライダーキバDGBKF"))))
    .map((c) => c.instanceId);
  if (ids.length === 0) return shuffleDeck(state, playerId);
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, f.id),
    effectId: FUESSLE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    viewedInstanceIds: p.deck.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[FUESSLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${FUESSLE_EFFECT_ID}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "deck",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: false,
    ignorePowerCost: true,
    mandatory: true,
    forced: true,
  });
  next = patchPlayer(next, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${FUESSLE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[FUESSLE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(shuffleDeck(close(state, pending), playerId), pending), log: skipLog(state, playerId, pending.sourceCardId, FUESSLE_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-329 仮面ライダーアーク【巨体の威圧】（自軍ターン中、バトルエリアに出たとき）
// 「BPの一番低いユニットを１体選び撃破する。ただし、BPの一番低いユニットが自軍と敵軍にある場合は、自軍ユニットの中から選ぶこと。」（atwiki/page-1410）
// 両軍・両エリア・サイズを問わない（カード評価）。これ自身も数える（除くとは書かれていない）。強制。

export const PRESS_EFFECT_ID = "rk329_giant_press";

function openGiantPress(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const own = fieldUnits(state, playerId).map((c) => ({ c, bp: effectiveBp(state, playerId, c) }));
  const enemy = fieldUnits(state, enemyId).map((c) => ({ c, bp: effectiveBp(state, enemyId, c) }));
  const all = [...own, ...enemy];
  if (all.length === 0) return state;
  const min = Math.min(...all.map((x) => x.bp));
  const ownLow = own.filter((x) => x.bp === min).map((x) => x.c.instanceId);
  const ids = ownLow.length > 0 ? ownLow : enemy.filter((x) => x.bp === min && selectableEnemy(state, playerId, "RK-329", x.c)).map((x) => x.c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, genericPick({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-329", PRESS_EFFECT_ID, ids, false, "discard"));
}

// ---------------------------------------------------------------------------
// RK-331 仮面ライダークウガAM【アメイジングマイティキック】（自軍ターン中、バトルエリアに出たとき）
// 「本来の特徴に「怪人」を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1245）。エリア・サイズを問わない。

export const AMAZING_EFFECT_ID = "rk331_amazing_mighty_kick";

function openAmazingKick(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("怪人") && selectableEnemy(state, playerId, "RK-331", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, genericPick({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-331", AMAZING_EFFECT_ID, ids, true, "power", true));
}

// ---------------------------------------------------------------------------
// RK-332 仮面ライダー龍騎（2nd）【叶えたい願いを胸に】
// 「特徴「ドラゴン」を持つユニットからコンビネーションしたとき発動できる⇒敵軍バトルエリアから、これがコンビネーションしているユニットの必要パワーの数字以下の
//  必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-1252）。自軍バトルフェイズに出たときだけ（コメント欄の回答）。サイズを問わない。
// 「これがコンビネーションしているユニット」は直前（左隣）のユニット。特徴はいまの特徴。

export const WISH_EFFECT_ID = "rk332_wish";

function openWish(state: GameState, playerId: PlayerId, self: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  const p = state.players[playerId];
  const prev = [...battleBeforeEnter]
    .filter((c) => c.instanceId !== self.instanceId && isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(p, c))
    .pop();
  if (!prev || !unitFeatures(state, playerId, prev).includes("ドラゴン")) return state;
  const limit = rk16CostNumber(state, prev.cardId);
  if (!Number.isFinite(limit)) return state;
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const n = rk16CostNumber(state, c.cardId);
      return isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(state.players[enemyId], c) && Number.isFinite(n) && n <= limit && selectableEnemy(state, playerId, "RK-332", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, genericPick({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-332", WISH_EFFECT_ID, ids, true, "discard"));
}

// ---------------------------------------------------------------------------
// RK-333 仮面ライダー龍騎サバイブ【ドラグバイザーツバイ】（RC）
// 「自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい。そうしたとき選んだカードの必要パワーの数字を合計して、その合計以下の必要パワーの
//  数字を持つ敵軍ユニットを1体撃破する」（atwiki/page-1243）。1枚でもよい（コメント欄）。捨札にアドベントカードがなければ発動しない（Q1）。
// 選んだカードは捨札に残る。撃破する敵軍ユニットはエリア・サイズを問わない（カード評価）。

export const VISOR_EFFECT_ID = "rk333_drag_visor_zwei";
export const VISOR_TARGET_EFFECT_ID = "rk333_drag_visor_zwei_target";

function adventIds(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  return state.players[playerId].discard
    .filter((c) => !exclude.includes(c.instanceId) && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("アドベントカード"))
    .map((c) => c.instanceId);
}

function applyDragVisor(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = adventIds(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: "rk333:no_advent" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: VISOR_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: true }),
    detail: VISOR_EFFECT_ID,
  };
}

function visorTarget(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  const sum = selected.reduce((acc, id) => {
    const card = state.players[playerId].discard.find((c) => c.instanceId === id);
    const n = card ? rk16CostNumber(state, card.cardId) : Number.NaN;
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const next = close(state, pending);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => {
      const n = rk16CostNumber(next, c.cardId);
      return Number.isFinite(n) && n <= sum && selectableEnemy(next, playerId, "RK-333", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return proceed(next, pending);
  return openNext(next, pending, genericPick({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, pending.sourceCardId, VISOR_TARGET_EFFECT_ID, ids, false, "discard"));
}

CHOICE_RESOLVERS[VISOR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = adventIds(state, playerId, selected);
  const log = logFor(state, playerId, "RK-333", `${VISOR_EFFECT_ID}:${instanceId}`);
  if (selected.length >= 2 || rest.length === 0) return { state: visorTarget(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log };
};
CHOICE_SKIPPERS[VISOR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.length > 0) return { state: visorTarget(state, pending, playerId, selected), log: logFor(state, playerId, "RK-333", `${VISOR_EFFECT_ID}:confirm`) };
  return simpleSkip()(state, playerId);
};
CHOICE_CONFIRMERS[VISOR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: visorTarget(state, pending, playerId, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "RK-333", `${VISOR_EFFECT_ID}:confirm`) };
};

// ---------------------------------------------------------------------------
// バトルエリアに出たとき（rules/combo.ts の進入の効果）

export function tryRk16OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  if (state.activePlayer !== playerId || state.phase !== "battle") return state;
  let next = state;
  // RK-325（ライドされて一緒に出たパワードイクサー）。
  if (card.mountedOnInstanceId) {
    const vehicle = next.players[playerId].battle.find((c) => c.instanceId === card.mountedOnInstanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-325")) next = openIxaPod(next, playerId, vehicle);
  }
  const self = next.players[playerId].battle.find((c) => c.instanceId === card.instanceId) ?? card;
  if (isSameCardIdentity(card.cardId, "RK-318")) next = openBrokenFang(next, playerId, self);
  if (isSameCardIdentity(card.cardId, "RK-321")) next = openSnakingDeathBreak(next, playerId, self);
  if (isSameCardIdentity(card.cardId, "RK-329")) next = openGiantPress(next, playerId, self);
  if (isSameCardIdentity(card.cardId, "RK-331")) next = openAmazingKick(next, playerId, self);
  if (isSameCardIdentity(card.cardId, "RK-332")) next = openWish(next, playerId, self, battleBeforeEnter);
  return next;
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK16_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-319::command_swap": applyCommandSwap,
  "RK-319::ixa_judgment": applyIxaJudgment,
  "RK-333::drag_visor_zwei": applyDragVisor,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-316::fuessle": noop("rk316:morph_grant"),
  "RK-317::pod_batting": noop("rk317:morph_from_discard"),
  "RK-318::broken_fang": noop("rk318:on_enter"),
  "RK-320::command_deploy": noop("rk320:self_rush_from_command"),
  "RK-320::final_rising_blast": noop("rk320:strike_damage"),
  "RK-321::snaking_death_break": noop("rk321:on_enter"),
  "RK-323::shadow_veil": noop("rk323:turn_end"),
  "RK-324::bron_boost": noop("rk324:battle_destroy"),
  "RK-325::ixa_bm_sp1": noop("rk325:sp1"),
  "RK-325::ixa_pod": noop("rk325:vehicle_entry"),
  "RK-326::fuessle": noop("rk326:field_ability"),
  "RK-327::not_attacked_while_held": noop("rk327:attack_restriction"),
  "RK-327::fuessle": noop("rk327:field_ability"),
  "RK-328::fuessle": noop("rk328:field_ability"),
  "RK-329::giant_press": noop("rk329:on_enter"),
  "RK-331::amazing_mighty_kick": noop("rk331:on_enter"),
  "RK-332::dragon_bp": noop("rk332:bp"),
  "RK-332::wish": noop("rk332:combo"),
  "RK-334::lock": noop("rk334:lock"),
};

export function tryRk16CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK16_KEYWORD_PREFIX)) return null;
  const handler = RK16_KEYWORDS[keyword.slice(RK16_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
