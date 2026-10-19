/**
 * ザ・マスクドライダーEXP vol.4 RK-295〜RK-315（仮面ライダーサソードRF〜仮面ライダーキバ飛翔態）のカード固有の効果（cardSpec RK15-295-315 の監査）。
 *
 * - `tryRk15CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk15::cardId::name`。NC・RC・バトルエリアに出たとき）。
 * - `tryResolveRk15Choice` / `trySkipRk15Choice` / `tryConfirmRk15Choice`: このモジュールが開いた選択の解決。
 * - `tryRk15OnEnterBattle`: バトルエリアに出たとき（rules/combo.ts）。RK-298・RK-299・RK-306・RK-314（自軍ターン中に出たとき）、
 *   RK-301（ライドされたカブトエクステンダーからのコンビネーション）。
 * - `applyRk15OnUnitLeft`: RK-302【ワームの頂点に立つ男】の後半・RK-303【擬態の解除】（events/listeners/unitLeftZoneListener.ts）。
 * - `rk15WinButDestroyed`: RK-310 モモタロス（2nd）の※（rules/operationCounters.ts）。
 * - `rk15RequiredDefender`: RK-311【俺の強さにお前が泣いた】（rules/batch06FieldEffects.ts applyShinobiBallRequiredDefender）。
 * - RK-312・RK-313 の「このユニットをホールドしてもよい。そうしたとき、…」と RK-314【モンスターフィーバー】で発動する効果は
 *   rules/rk/rk12UnitEffects.ts（RK-237・RK-245・RK-246 と同じ処理）。
 * 継続効果の判定（RK-295・RK-299・RK-300・RK-302・RK-308）は rules/rk/rk15Fields.ts。
 * 構成は rules/rk/rk14UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattleEntry, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addNextTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { cardNotSelectableByOpponent, isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { hasAdditionalCondition } from "../dispatchOrder";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { rk1IsSmallNow, rk1ZoneCardFeatures } from "./rk1Features";
import { rk14ActsAsVehicle } from "./rk14Fields";
import { applySelfHold, isRk12SelfHoldCard, openRk12SelfHold } from "./rk12UnitEffects";
import { RK15_APEX_RULE, RK15_DARK_KICK_RULE, RK15_KINTAROS_RULE, rk15IsWormPupa } from "./rk15Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK15_KEYWORD_PREFIX = "rk15::";

export function isRk15ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk15Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk15Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmRk15Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk15Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk15Choice(pending)) return { error: "no_selection" };
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

/** 敵軍の効果で選べる敵軍のカード（「相手に選ばれない」等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

/**
 * ゾーン（パワーゾーン・コマンドゾーン）の敵軍のカードを選べるか。「相手に選ばれない」を持つカードは選べない
 * （ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。
 */
function selectableZoneCard(cardId: string): boolean {
  return !cardNotSelectableByOpponent(cardId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function costNumber(state: Pick<GameState, "definitions">, cardId: string): number {
  return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost);
}

function printedBp(state: Pick<GameState, "definitions">, cardId: string): number {
  const bp = getDefinition(state.definitions, cardId)?.bp;
  return typeof bp === "number" ? bp : Number.NaN;
}

function printedCategories(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category as string | string[] | undefined;
  return Array.isArray(c) ? c : c ? [c] : [];
}

function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

function isNamed(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  return sameCardName(getDefinition(state.definitions, cardId)?.name, name);
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

/** ids のユニットをすべて撃破する（全員を選んだ確定済みの撃破の選択で処理する）。 */
function destroyAll(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], resume?: PendingEffectChoice): GameState {
  if (ids.length === 0) return resume ? openOrQueue(state, resume) : promoteDeferredBattleEntry(state);
  const choice: PendingEffectChoice = {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "select_units_bp_budget",
    validInstanceIds: ids,
    selectedInstanceIds: ids,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
    resumeChoice: resume,
  };
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  const opened = openEffectChoice(state, choice);
  const destroyed = applyConfirmEffectChoice(opened, ctx.playerId);
  return "error" in destroyed ? state : destroyed.state;
}

/** 場のユニットを撃破ではない移動で持ち主のパワーゾーンに送る（ids の順に。場にないものは飛ばす）。 */
function sendToPower(state: GameState, ids: string[], phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const id of ids) {
    const leave = applyUnitLeave(next, id, "power", phasePlayerId);
    if ("error" in leave) continue;
    next = leave.state;
  }
  return next;
}

/** 敵軍の command のカードをリリース状態にする。 */
function releaseCommands(state: GameState, ownerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => ({ ...p, command: p.command.map((c) => (ids.includes(c.instanceId) ? { ...c, commandHeld: false } : c)) }));
}

/** 敵軍のホールド状態のコマンドのうち、選べるもの。 */
function heldEnemyCommands(state: GameState, playerId: PlayerId, exclude: string[] = []): string[] {
  return state.players[opponent(playerId)].command
    .filter((c) => c.commandHeld && !exclude.includes(c.instanceId) && selectableZoneCard(c.cardId))
    .map((c) => c.instanceId);
}

/** 汎用の1体選択（撃破・パワーゾーンへ送る。rules/pendingChoices.ts の select_unit と unitDestination で処理する）。 */
function genericPick(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, unitDestination: "discard" | "power"): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, unitDestination };
}

/** 自軍 S ユニットが「仮面ライダーキックホッパー」と「仮面ライダーパンチホッパー」だけか（両方がいる。RK-296・RK-297）。 */
function onlyHoppers(state: GameState, playerId: PlayerId): boolean {
  const units = fieldUnits(state, playerId).filter((c) => rk1IsSmallNow(state, c));
  const kick = units.some((c) => isNamed(state, c.cardId, "仮面ライダーキックホッパー"));
  const punch = units.some((c) => isNamed(state, c.cardId, "仮面ライダーパンチホッパー"));
  const others = units.some((c) => !isNamed(state, c.cardId, "仮面ライダーキックホッパー") && !isNamed(state, c.cardId, "仮面ライダーパンチホッパー"));
  return kick && punch && !others;
}

// ---------------------------------------------------------------------------
// RK-295 仮面ライダーサソードRF【頂点に立つ男】（NC）。BP・SP の計算は rules/rk/rk15Fields.ts。

function applyApex(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "rk295:no_source" };
  return { state: addTurnPayload(state, ctx.playerId, RK15_APEX_RULE, "RK-295", { instanceId: id }), detail: "rk295:apex" };
}

// ---------------------------------------------------------------------------
// RK-296 仮面ライダーキックホッパー（2nd）【ライダーキック】（NC）
// 「敵軍バトルエリアのユニットを、必要パワーの数字の合計が2になるまで好きな数選んでもよい（自軍Sユニットが「仮面ライダーキックホッパー」と
//  「仮面ライダーパンチホッパー」だけなら、4になるまで好きな数選んでもよい）。そうしたとき、選んだユニットを持ち主のパワーゾーンに送る。」
// （atwiki/page-1392）。サイズを問わない（コメント欄）。1体選んだら確定でき、残りの合計で選べるユニットがなくなれば確定する。

export const KICK_EFFECT_ID = "rk296_rider_kick";

function kickTargets(state: GameState, playerId: PlayerId, budget: number, exclude: string[]): string[] {
  return state.players[opponent(playerId)].battle
    .filter((c) => {
      if (exclude.includes(c.instanceId) || !isUnitCard(state, c.cardId) || rk14ActsAsVehicle(state.players[opponent(playerId)], c)) return false;
      const n = costNumber(state, c.cardId);
      return Number.isFinite(n) && n <= budget && selectableEnemy(state, playerId, "RK-296", c);
    })
    .map((c) => c.instanceId);
}

function applyRiderKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const budget = onlyHoppers(state, ctx.playerId) ? 4 : 2;
  const ids = kickTargets(state, ctx.playerId, budget, []);
  if (ids.length === 0) return { state, detail: "rk296:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-296"), effectId: KICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, optional: true, rk15Meta: { budget } }),
    detail: KICK_EFFECT_ID,
  };
}

function finishKick(state: GameState, pending: PendingEffectChoice, selected: string[]): GameState {
  return proceed(sendToPower(close(state, pending), selected, pending.phasePlayerId), pending);
}

CHOICE_RESOLVERS[KICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = findField(state, opponent(playerId), instanceId);
  if (!card) return { error: "invalid_target" };
  const budget = (pending.rk15Meta?.budget ?? 0) - costNumber(state, card.cardId);
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = kickTargets(state, playerId, budget, selected);
  const log = logFor(state, playerId, "RK-296", `${KICK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (rest.length === 0) return { state: finishKick(state, pending, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true, rk15Meta: { budget } } }, log };
};
CHOICE_SKIPPERS[KICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.length > 0) return { state: finishKick(state, pending, selected), log: logFor(state, playerId, "RK-296", `${KICK_EFFECT_ID}:confirm`) };
  return simpleSkip()(state, playerId);
};
CHOICE_CONFIRMERS[KICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finishKick(state, pending, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "RK-296", `${KICK_EFFECT_ID}:confirm`) };
};

// ---------------------------------------------------------------------------
// RK-297 仮面ライダーパンチホッパー（2nd）【ライダーパンチ】（NC）
// 「敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が2以下のカードを1枚選んでもよい（自軍Sユニットが｢仮面ライダーキックホッパー｣と
//  ｢仮面ライダーパンチホッパー｣だけなら、必要パワーの数字が4以下のカードを1枚選んでもよい)。そうしたとき、選んだカードを捨札にする。」（atwiki/page-1386）

export const PUNCH_EFFECT_ID = "rk297_rider_punch";

function applyRiderPunch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const limit = onlyHoppers(state, ctx.playerId) ? 4 : 2;
  const ids = state.players[opponent(ctx.playerId)].power
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return !c.faceDown && Number.isFinite(n) && n <= limit && selectableZoneCard(c.cardId);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk297:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-297"), effectId: PUNCH_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: PUNCH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[PUNCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-297", `${PUNCH_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[PUNCH_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-298 仮面ライダーダークカブトMF【むき出しの殺意】（自軍ターン中に出たとき）
// 「敵軍バトルエリアのユニットがSユニット1体だけなら、そのユニットを持ち主のパワーゾーンに送ってもよい。」（atwiki/page-1387）
// ユニットを選ぶ効果ではない（「相手に選ばれない」・ブレイカーでも送れる。コメント欄）。ビークルはユニットに数えない。

export const NAKED_EFFECT_ID = "rk298_naked_intent";

function soleEnemyBattleS(state: GameState, playerId: PlayerId): CardInstance | undefined {
  const enemyId = opponent(playerId);
  const units = state.players[enemyId].battle.filter((c) => isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(state.players[enemyId], c));
  return units.length === 1 && rk1IsSmallNow(state, units[0]!) ? units[0] : undefined;
}

function openNakedIntent(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const target = soleEnemyBattleS(state, playerId);
  if (!target) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-298"),
    effectId: NAKED_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: [],
    optional: true,
    mayConfirm: true,
    rk15Meta: { picked: target.instanceId },
  });
}

CHOICE_RESOLVERS[NAKED_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[NAKED_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[NAKED_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const target = soleEnemyBattleS(state, playerId);
  let next = close(state, pending);
  if (target && target.instanceId === pending.rk15Meta?.picked) next = sendToPower(next, [target.instanceId], pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-298", `${NAKED_EFFECT_ID}:${target ? cardName(state.definitions, target.cardId) : "none"}`) };
};

// ---------------------------------------------------------------------------
// RK-299 仮面ライダーダークカブトRF【ダークライダーキック】（自軍ターン中に出たとき）
// 「敵軍コマンドを3つリリースしてもよい。そうしたとき、このターン、これは「SP1」になる。」（atwiki/page-1383）
// リリースするのは敵軍のホールド状態のコマンド。どれをリリースするかはこのカードのプレイヤーが1つずつ選ぶ（コメント欄。最初の1つを選ぶことが発動）。
// 3つなければ発動できない（コメント欄「相手のコマンドがRFで埋まってたらこの効果使えない」）。SP の指定は rules/rk/rk15Fields.ts。

export const DARK_KICK_EFFECT_ID = "rk299_dark_rider_kick";

function openDarkKick(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const ids = heldEnemyCommands(state, playerId);
  if (ids.length < 3) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-299"),
    effectId: DARK_KICK_EFFECT_ID,
    kind: "select_command",
    validInstanceIds: ids,
    optional: true,
  });
}

CHOICE_RESOLVERS[DARK_KICK_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), commandId];
  const log = logFor(state, playerId, "RK-299", `${DARK_KICK_EFFECT_ID}:${commandId}`);
  if (selected.length < 3) {
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: heldEnemyCommands(state, playerId, selected), optional: false } }, log };
  }
  let next = releaseCommands(close(state, pending), opponent(playerId), selected);
  if (pending.sourceInstanceId) next = addTurnPayload(next, playerId, RK15_DARK_KICK_RULE, "RK-299", { instanceId: pending.sourceInstanceId });
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[DARK_KICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-301 ガタックエクステンダー【エクステンドライダー落とし】（ライドされている「カブトエクステンダー」からのコンビネーション）
// 「次の効果を発動できる⇒本来のBPが8000以下の敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-1388）
// エリア・サイズを問わない。コンビネーションはビークルが出た時点で確定し、ライドオフの選択の前に処理する（atwiki/page-1372 Q1・page-1388 Q1）。
// 対象を選ぶことが発動の宣言。

function openExtendDrop(state: GameState, playerId: PlayerId, vehicle: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => printedBp(state, c.cardId) <= 8000 && selectableEnemy(state, playerId, "RK-301", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, genericPick({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId }, "RK-301", "rk301_extend_rider_drop", ids, true, "power"));
}

/** 直前の並び（battleBefore の最後の組）が、ユニットがライドしている「カブトエクステンダー」か。 */
function previousIsRiddenKabutoExtender(state: GameState, battleBefore: CardInstance[]): boolean {
  const last = battleBefore[battleBefore.length - 1];
  if (!last?.mountedOnInstanceId) return false;
  const vehicle = battleBefore.find((c) => c.instanceId === last.mountedOnInstanceId);
  return !!vehicle && isNamed(state, vehicle.cardId, "カブトエクステンダー");
}

// ---------------------------------------------------------------------------
// RK-302 スコルピオワーム【ワームの頂点に立つ男】の後半・RK-303 ワームサナギ体（4弾）【擬態の解除】（場を離れたとき）
// - RK-302「また、敵軍ターン中、これが撃破されたとき、特徴「ワーム」または特徴「怪人」を持つすべてのユニットを撃破する。」（atwiki/page-1342）。
//   自軍・敵軍、エリアを問わない（カード評価「両軍の怪人かワームを持つユニットをすべて巻き添え」）。特徴は今の特徴。前半は rules/rk/rk15Fields.ts。
// - RK-303「これが自分の手札にある間、敵軍ターン中、特徴「男」または「女」を持つ自軍ユニットが撃破されて捨札になったとき、捨札になったユニット
//   カード1枚につき、自分の手札から「ワームサナギ体」のカードを1枚選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-1278）。
//   手札に RK-303 が何枚あっても、撃破されたユニットカード1枚につき1枚（同名の RK-137 も選べる）。出したユニットは効果でラッシュしたものとして扱う。

export const PUPA_EFFECT_ID = "rk303_mimic_release";

export type Rk15LeaveEvent = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: string;
  toZone: string;
  phasePlayerId?: PlayerId;
  destroyed?: boolean;
};

function pupaIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand.filter((c) => rk15IsWormPupa(state, c.cardId)).map((c) => c.instanceId);
}

export function applyRk15OnUnitLeft(state: GameState, event: Rk15LeaveEvent): GameState {
  if (event.toZone !== "discard" || event.destroyed === false || (event.fromZone !== "battle" && event.fromZone !== "rush")) return state;
  const owner = event.ownerPlayerId;
  const turnPlayer = event.phasePlayerId ?? turnPlayerOf(state);
  if (turnPlayer === owner) return state;
  let next = state;
  // RK-302。
  if (isSameCardIdentity(event.cardId, "RK-302")) {
    const ids = (["player1", "player2"] as const).flatMap((pid) =>
      fieldUnits(next, pid)
        .filter((c) => {
          const f = unitFeatures(next, pid, c);
          return f.includes("ワーム") || f.includes("怪人");
        })
        .map((c) => c.instanceId),
    );
    if (ids.length > 0) next = destroyAll(next, { playerId: owner, phasePlayerId: turnPlayer, sourceInstanceId: event.instanceId }, "RK-302", "rk302_worm_apex_destroy", ids);
  }
  // RK-303（手札に「ワームサナギ体（4弾）」があるとき）。
  const features = rk1ZoneCardFeatures(next, owner, event.cardId);
  if (isUnitCard(next, event.cardId) && (features.includes("男") || features.includes("女")) && next.players[owner].hand.some((c) => isSameCardIdentity(c.cardId, "RK-303"))) {
    const ids = pupaIds(next, owner);
    if (ids.length > 0) {
      next = openOrQueue(next, {
        ...base({ playerId: owner, phasePlayerId: turnPlayer }, "RK-303"),
        effectId: PUPA_EFFECT_ID,
        kind: "select_hand",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
        rk15Meta: { picked: event.instanceId },
      });
    }
  }
  return next;
}

CHOICE_RESOLVERS[PUPA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${PUPA_EFFECT_ID}_rush`,
    sourceCardId: "RK-303",
    fromZone: "hand",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: false,
    mandatory: true,
    forced: true,
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-303", `${PUPA_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[PUPA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-304 仮面ライダー電王RF（2nd）【ソリッドアタック】（RC）「ホールド状態の敵軍Ｓユニットを1体選び、持ち主のパワーゾーンに送っても良い。」
// （atwiki/page-1272）。エリアを問わない。
// RK-307 仮面ライダー電王GF（2nd）【ワイルドショット】（RC）「敵軍ラッシュエリアから、必要パワーの数字が3以下のユニットを1体選び撃破する。」
// （atwiki/page-1274）。サイズを問わない。当てはまるユニットがなければ何もしない。

function applySolidAttack(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-304", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk304:no_targets" };
  return { state: openOrQueue(state, genericPick(ctxBase(ctx), "RK-304", "rk304_solid_attack", ids, true, "power")), detail: "rk304_solid_attack" };
}

function applyWildShot(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(state.players[enemyId], c) && Number.isFinite(n) && n <= 3 && selectableEnemy(state, ctx.playerId, "RK-307", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk307:no_targets" };
  return { state: openOrQueue(state, genericPick(ctxBase(ctx), "RK-307", "rk307_wild_shot", ids, false, "discard")), detail: "rk307_wild_shot" };
}

// ---------------------------------------------------------------------------
// RK-305 仮面ライダー電王SF（2nd）【俺の必殺技特別編】（RC）
// 「敵軍コマンドを2つ、1つずつ順番に選びリリースしてもよい。そうしたとき、本来のカテゴリが1つ目にリリースしたコマンドと同じで、本来の必要パワーが
//  2つ目にリリースしたコマンドと同じ敵軍Sユニットをすべて撃破する。」（atwiki/page-1275）
// リリースできるのは敵軍のホールド状態のコマンド（2つなければ発動できない。カード評価）。ユニットは選ばない（「相手に選ばれない」も撃破。カード評価）。
// カテゴリは1つ目のコマンドの本来のカテゴリのどれかを本来のカテゴリに持つユニット。必要パワーは「+」「-」を除いた数字で比べる。

export const SPECIAL_FIRST_EFFECT_ID = "rk305_special_first";
export const SPECIAL_SECOND_EFFECT_ID = "rk305_special_second";

function applySpecialEdition(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = heldEnemyCommands(state, ctx.playerId);
  if (ids.length < 2) return { state, detail: "rk305:no_commands" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-305"), effectId: SPECIAL_FIRST_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SPECIAL_FIRST_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SPECIAL_FIRST_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cmd = state.players[enemyId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  const next = releaseCommands(close(state, pending), enemyId, [commandId]);
  const rest = heldEnemyCommands(next, playerId);
  const log = logFor(state, playerId, "RK-305", `${SPECIAL_FIRST_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`);
  if (rest.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...pending, effectId: SPECIAL_SECOND_EFFECT_ID, validInstanceIds: rest, selectedInstanceIds: [], optional: false, rk15Meta: { categories: printedCategories(state, cmd.cardId) } }),
    log,
  };
};
CHOICE_SKIPPERS[SPECIAL_FIRST_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[SPECIAL_SECOND_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cmd = state.players[enemyId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  const next = releaseCommands(close(state, pending), enemyId, [commandId]);
  const categories = pending.rk15Meta?.categories ?? [];
  const cost = costNumber(state, cmd.cardId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && costNumber(next, c.cardId) === cost && printedCategories(next, c.cardId).some((k) => categories.includes(k)))
    .map((c) => c.instanceId);
  const destroyed = destroyAll(next, { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-305", "rk305_special_destroy", ids, pending.resumeChoice);
  return { state: destroyed, log: logFor(state, playerId, "RK-305", `${SPECIAL_SECOND_EFFECT_ID}:${categories.join("/")}:${cost}:destroy=${ids.length}`) };
};

// ---------------------------------------------------------------------------
// RK-306 仮面ライダー電王AF（2nd）【ダイナミックチョップ】（自軍ターン中に出たとき）
// 「本来のBPがこのユニットのBP以下のユニットを、自軍と敵軍のユニットからそれぞれ1体ずつ選び、持ち主のパワーゾーンに送る。」（atwiki/page-1273）
// 強制。自軍（これ自身も選べる）、敵軍の順に選ぶ。どちらかに選べるユニットがなければ何もしない（atwiki/page-1273 Q2「処理が中断されます」）。
// エリアを問わない。「このユニットのBP」は処理するときの今の BP。

export const CHOP_OWN_EFFECT_ID = "rk306_chop_own";
export const CHOP_ENEMY_EFFECT_ID = "rk306_chop_enemy";

function chopLimit(state: GameState, playerId: PlayerId, selfId: string | undefined): number {
  const self = selfId ? findField(state, playerId, selfId) : undefined;
  return self ? effectiveBp(state, playerId, self) : (getDefinition(state.definitions, "RK-306")?.bp ?? 0);
}

function chopOwnIds(state: GameState, playerId: PlayerId, limit: number): string[] {
  return fieldUnits(state, playerId).filter((c) => printedBp(state, c.cardId) <= limit).map((c) => c.instanceId);
}

function chopEnemyIds(state: GameState, playerId: PlayerId, limit: number): string[] {
  return fieldUnits(state, opponent(playerId))
    .filter((c) => printedBp(state, c.cardId) <= limit && selectableEnemy(state, playerId, "RK-306", c))
    .map((c) => c.instanceId);
}

function openDynamicChop(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const limit = chopLimit(state, playerId, self.instanceId);
  const own = chopOwnIds(state, playerId, limit);
  if (own.length === 0 || chopEnemyIds(state, playerId, limit).length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-306"),
    effectId: CHOP_OWN_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: own,
    selectCount: 1,
    optional: false,
  });
}

CHOICE_RESOLVERS[CHOP_OWN_EFFECT_ID] = (state, playerId, ownId) => {
  const pending = state.pendingEffectChoice!;
  const limit = chopLimit(state, playerId, pending.sourceInstanceId);
  const enemy = chopEnemyIds(state, playerId, limit);
  const log = logFor(state, playerId, "RK-306", `${CHOP_OWN_EFFECT_ID}:${ownId}`);
  if (enemy.length === 0) return { state: proceed(close(state, pending), pending), log };
  return { state: openNext(close(state, pending), pending, { ...pending, effectId: CHOP_ENEMY_EFFECT_ID, validInstanceIds: enemy, selectedInstanceIds: [], rk15Meta: { picked: ownId } }), log };
};

CHOICE_RESOLVERS[CHOP_ENEMY_EFFECT_ID] = (state, playerId, enemyUnitId) => {
  const pending = state.pendingEffectChoice!;
  const ownId = pending.rk15Meta?.picked;
  const next = sendToPower(close(state, pending), ownId ? [ownId, enemyUnitId] : [enemyUnitId], pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-306", `${CHOP_ENEMY_EFFECT_ID}:${enemyUnitId}`) };
};

// ---------------------------------------------------------------------------
// RK-308 リュウタロス（2nd）【猫はこっち、アンタは嫌い】（NC）
// 「自軍パワーゾーンのオモテ向きのカードから、特徴「獣」を持つユニットカードを1枚選び自分の手札に戻してもよい。そうしたとき、敵軍ラッシュエリアから
//  本来のBPが3000以下のユニットを1体選び撃破する。」（atwiki/page-1282）。※の2つは rules/legend3/restrictions.ts・rules/rk/rk15Fields.ts。

export const CAT_EFFECT_ID = "rk308_cat_return";

function applyCatNotYou(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].power
    .filter((c) => !c.faceDown && isUnitCard(state, c.cardId) && printedFeatures(state, c.cardId).includes("獣"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk308:no_beast" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-308"), effectId: CAT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: CAT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[CAT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].rush
    .filter((c) => isUnitCard(next, c.cardId) && !rk14ActsAsVehicle(next.players[enemyId], c) && printedBp(next, c.cardId) <= 3000 && selectableEnemy(next, playerId, "RK-308", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-308", `${CAT_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-308", "rk308_cat_destroy", ids, false, "discard")), log };
};
CHOICE_SKIPPERS[CAT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-309 ウラタロス（2nd）【僕に釣られてみる？】（NC）
// 「自軍パワーゾーンのオモテ向きのカードから、必要パワーを満たしている特徴「女」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出しても
//  よい（ただし追加条件は満たすこと）。この効果でラッシュしたユニットは、このターン、バトルエリアに出られない。」（atwiki/page-1280）
// 必要パワーは選ぶカード自身を含むパワーゾーンの枚数で確かめる（コメント欄）。追加条件の手続きは効果のラッシュ（rules/effectRush.ts）。

export const FISHING_EFFECT_ID = "rk309_fishing";

function fishingIds(state: GameState, playerId: PlayerId): string[] {
  const ids = state.players[playerId].power
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return !c.faceDown && d?.type === "unit" && unitSizeOf(state.definitions, c) === "S" && (d.features ?? []).includes("女");
    })
    .map((c) => c.instanceId);
  return filterEffectRushCandidates(state, playerId, "power", ids, true);
}

function applyFishing(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fishingIds(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "rk309:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-309"), effectId: FISHING_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: FISHING_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[FISHING_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${FISHING_EFFECT_ID}_rush`,
    sourceCardId: "RK-309",
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "power",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: true,
    mandatory: true,
    forced: true,
    blockBattleEntryThisTurn: true,
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-309", `${FISHING_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[FISHING_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-310 モモタロス（2nd）※「これは特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される。」（atwiki/page-1279）。
// 自軍・敵軍のターンを問わない。相手の特徴は今の特徴。

export function rk15WinButDestroyed(state: GameState, unitOwner: PlayerId, unit: CardInstance, opponentCard: CardInstance): boolean {
  if (!isSameCardIdentity(unit.cardId, "RK-310")) return false;
  return unitFeatures(state, opponent(unitOwner), opponentCard).includes("女");
}

// ---------------------------------------------------------------------------
// RK-311 キンタロス（2nd）【俺の強さにお前が泣いた】（NC）「次の相手ターン、バトルエリアに出た敵軍Sユニットは、可能ならこれにアタックする。」
// （atwiki/page-1281）。次の相手ターンに有効な記録（next_turn）を付け、そのターンにバトルエリアに出た敵軍 S ユニットのアタック先を
// これに限る（RS-451 シノビドグラーと同じ処理。「何もしない」「ストライク」は選べない。コメント欄）。

function applyKintarosTears(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "rk311:no_source" };
  return {
    state: patchPlayer(state, ctx.playerId, (p) => addNextTurnRuleModifier(p, RK15_KINTAROS_RULE, { sourceCardId: "RK-311", payload: { instanceId: id } })),
    detail: "rk311:next_turn",
  };
}

/** RK-311 で、ownerId の敵軍（いまのターンプレイヤー）のバトルエリアに出た S ユニットがアタックしなければならないユニット（無ければ undefined）。 */
export function rk15KintarosDefenderIds(state: GameState, ownerId: PlayerId): string[] {
  return getPlayerModifiers(state.players[ownerId])
    .map((m) => (m.kind === "rule" && m.ruleId === RK15_KINTAROS_RULE && m.scope === "turn" ? (m.payload as { instanceId?: string } | undefined)?.instanceId : undefined))
    .filter((id): id is string => !!id && state.players[ownerId].battle.some((c) => c.instanceId === id));
}

/** applyShinobiBallRequiredDefender から: entry のユニットのアタック先を RK-311 に限る（アタックできなければそのまま）。 */
export function rk15RequiredDefender(
  state: GameState,
  enteringPlayerId: PlayerId,
  entry: PendingBattleEntry,
  canAttack: (defenderId: string) => boolean,
): PendingBattleEntry {
  if (state.activePlayer !== enteringPlayerId || entry.requiredDefenderInstanceId) return entry;
  const unit = state.players[enteringPlayerId].battle.find((c) => c.instanceId === entry.instanceId);
  if (!unit || !isUnitCard(state, unit.cardId) || !rk1IsSmallNow(state, unit)) return entry;
  const target = rk15KintarosDefenderIds(state, opponent(enteringPlayerId)).find((id) => canAttack(id));
  return target ? { ...entry, requiredDefenderInstanceId: target } : entry;
}

// ---------------------------------------------------------------------------
// RK-314 仮面ライダーキバEF【モンスターフィーバー】（自軍ターン中に出るとき）
// 「自分の手札から特徴「魔皇力」を持つ、追加条件を持たないSユニットのカードを1枚選び相手に見せてもよい。そうしたとき、そのユニットカードの効果名を
//  持つ効果を、このユニットの効果として発動する。」（atwiki/page-1260）
// 追加条件は R-ADD-02（必要パワーの「+」「-」も追加条件）。発動できる効果は「このユニットをホールドしてもよい。そうしたとき、…」の
// RK-237・RK-245・RK-246・RK-312（rules/rk/rk12UnitEffects.ts openRk12SelfHold）。ほかのカードは候補にしない（cardSpec の it.todo）。
// 見せたカードは手札に残る。

export const FEVER_EFFECT_ID = "rk314_monster_fever";

function openMonsterFever(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  if (self.commandHeld) return state;
  const ids = state.players[playerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && unitSizeOf(state.definitions, c) === "S" && (d.features ?? []).includes("魔皇力") && !hasAdditionalCondition(d) && !!isRk12SelfHoldCard(c.cardId);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-314"),
    effectId: FEVER_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[FEVER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const copied = card ? isRk12SelfHoldCard(card.cardId) : undefined;
  if (!card || !copied) return { error: "invalid_target" };
  let next = close(state, pending);
  if (pending.sourceInstanceId) next = openRk12SelfHold(next, { playerId, phasePlayerId: pending.phasePlayerId, selfInstanceId: pending.sourceInstanceId }, copied, "RK-314");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-314", `${FEVER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[FEVER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// バトルエリアに出たとき（rules/combo.ts の進入の効果）

export function tryRk15OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  if (state.activePlayer !== playerId || state.phase !== "battle") return state;
  let next = state;
  // RK-301（ライドして一緒に出たガタックエクステンダー）。
  if (card.mountedOnInstanceId) {
    const vehicle = next.players[playerId].battle.find((c) => c.instanceId === card.mountedOnInstanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-301")) {
      const before = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId && c.instanceId !== vehicle.instanceId);
      if (previousIsRiddenKabutoExtender(next, before)) next = openExtendDrop(next, playerId, vehicle);
    }
  }
  if (isSameCardIdentity(card.cardId, "RK-298")) next = openNakedIntent(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-299")) next = openDarkKick(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-306")) next = openDynamicChop(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-314")) next = openMonsterFever(next, playerId, card);
  return next;
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK15_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-295::apex": applyApex,
  "RK-296::rider_kick": applyRiderKick,
  "RK-297::rider_punch": applyRiderPunch,
  "RK-304::solid_attack": applySolidAttack,
  "RK-305::special_edition": applySpecialEdition,
  "RK-307::wild_shot": applyWildShot,
  "RK-308::cat_not_you": applyCatNotYou,
  "RK-309::fishing": applyFishing,
  "RK-311::tears": applyKintarosTears,
  "RK-312::dogga_thunder_slap": applySelfHold("RK-312"),
  "RK-313::darkness_moon_break": applySelfHold("RK-313"),
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-298::naked_intent": noop("rk298:on_enter"),
  "RK-299::dark_rider_kick": noop("rk299:on_enter"),
  "RK-300::clock_up": noop("rk300:attack_restriction"),
  "RK-301::extend_rider_drop": noop("rk301:vehicle_combo"),
  "RK-302::worm_apex": noop("rk302:lock_and_on_destroy"),
  "RK-303::mimic_release": noop("rk303:hand_trigger"),
  "RK-306::dynamic_chop": noop("rk306:on_enter"),
  "RK-314::monster_fever": noop("rk314:on_enter"),
};

export function tryRk15CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK15_KEYWORD_PREFIX)) return null;
  const handler = RK15_KEYWORDS[keyword.slice(RK15_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
