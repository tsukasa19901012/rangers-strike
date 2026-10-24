/**
 * ザ・マスクドライダーEXP vol.2 RK-148〜RK-168（デンライナーレッコウ〜仮面ライダー電王CF）のカード固有の効果（cardSpec RK8-148-168 の監査）。
 *
 * - `tryRk8CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk8::cardId::name`。RC・ラッシュしたとき・バトルエリアに出たとき・撃破されたとき）。
 * - `tryResolveRk8Choice` / `trySkipRk8Choice` / `tryConfirmRk8Choice`: このモジュールが開いた選択の解決。撃破・パワーに送る選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - `rk8BlocksBattleEntry`: RK-153・RK-167 の※（バトルエリアに出られない。rules/restrictions.ts から呼ぶ）。
 * - `rk8BlocksMount`: RK-166 の※（ホールド状態のときビークルにライドできない。keywords/ride.ts から呼ぶ）。
 * - `rk8EffectiveSp`: RK-152・RK-161 の※の SP（rules/legend3/fieldEffects.ts から呼ぶ）。
 * - `collectRk8TurnEndQueue` / `openRk8TurnEndEntry`: RK-153【車両強奪】（rules/turnEndingEffects.ts）。`rk8StaysInBattleAtStart` は戻せないユニット（rules/startPhase.ts）。
 * - `isRk8BattleToRushTrigger` / `tryRk8BattleToRush`: RK-155・RK-156・RK-157 の「ラッシュエリアに戻るとき」（rules/startPhase.ts）。
 * - `openRk8JaguarOnEnemyRush`: RK-160【ナノロボット散布実験】（rules/onRushUnitEffects.ts applyPassiveRushTriggers から呼ぶ）。
 * - `applyRk8AfterAction`: RK-153 の※のための「このターン敵軍ユニットを撃破した」の記録（core/applyAction.ts の後処理）。
 * - `rk8KaiserBmOnEntry`: RK-167 の（）書き（サイドバッシャーBM からコンビネーションするとき。rules/battleEntry.ts）。
 * 構成は rules/rk/rk7UnitEffects.ts と同じ。
 */
import { isSameCardIdentity, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { commandCategoriesOf, cardName, effectiveBp, getDefinition, parsePowerCost, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { cardNotSelectableByOpponent, isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { crossReductionFor } from "../../keywords/battleKeywords";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { battlePositionOneBased, printedSpBase } from "../fractionalSp";
import { grantSp1ToBattleUnit } from "../namedUnitEffects";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { sameCardName } from "../../core/cardNames";
import { rk1IsSmallNow, rk1ZoneCardFeatures } from "./rk1Features";
import { rk1ResidentLeaving } from "./rk1NamedEffects";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK8_KEYWORD_PREFIX = "rk8::";

export function isRk8ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk8Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk8Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 選んだところで確定できる選択か（「行う」の確認）。 */
export function canConfirmRk8Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm";
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk8Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk8Choice(pending)) return { error: "no_selection" };
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

/** 撃破の処理中に開く選択（「撃破されて捨札になったとき」）。rk7UnitEffects の openInterrupt と同じ扱い。 */
function openInterrupt(state: GameState, choice: PendingEffectChoice): GameState {
  const existing = state.pendingEffectChoice;
  if (existing && (isRk8ChoiceEffect(existing.effectId) || existing.effectId === "to_power_on_destroy")) return openOrQueue(state, choice);
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
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    if (!pending.resumeChoice) return state;
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
  }
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

/** 選択（汎用の解決に任せる選択を含む）を開いて、続き（resumeChoice）を引き継ぐ。 */
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

function confirmChoice(ctx: BaseCtx, sourceCardId: string, effectId: string, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: [], optional: true, mayConfirm: true, ...extra };
}

function ctxBase(ctx: GrantKeywordContext): BaseCtx {
  return { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId };
}

/** 自軍ターン中か（効果の持ち主がそのターンのプレイヤー）。 */
function ownTurn(ctx: { playerId: PlayerId; phasePlayerId: PlayerId }): boolean {
  return ctx.phasePlayerId === ctx.playerId;
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function fieldCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function fieldUnits(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  return fieldCards(state, playerId).filter((c) => isUnitCard(state, c.cardId));
}

/** 敵軍の効果で選べる敵軍のカード（「相手に選ばれない」等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

/** 今 M ユニットか（RK-154 で S ユニットになったものを除く）。 */
function isMediumNow(state: Pick<GameState, "definitions">, card: CardInstance): boolean {
  return unitSizeOf(state.definitions, card) === "M" && card.sizeOverride !== "S";
}

function categoriesOfCard(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category;
  return Array.isArray(c) ? c : c ? [c] : [];
}

function setHeld(state: GameState, ownerId: PlayerId, instanceIds: Set<string>): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
    rush: p.rush.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
  }));
}

/** ids のユニットをすべて撃破する（RK-115 と同じく、全員を選んだ確定済みの撃破の選択で処理する）。続き（resume）は撃破の後に開く。 */
function destroyAll(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], resume?: PendingEffectChoice): GameState {
  if (ids.length === 0) return resume ? openOrQueue(state, resume) : state;
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

// ---------------------------------------------------------------------------
// RK-148 デンライナーレッコウ【フロントアックス】（バトルエリアに出たとき）
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからMユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、
//  戻したユニットが特徴「メカ」を持っていなければ、持ち主のパワーゾーンへ送る。」（atwiki/page-674）
// RK-149 デンライナーイカヅチ【巨龍形態】
// 「これが自軍バトルエリアにある間、このユニットから「デンライナーゴウカ、デンライナーイスルギ、デンライナーレッコウ」の順にコンビネーション
//  したとき、本来のBPが3000以下の敵軍ユニットをすべて撃破する。」（atwiki/page-675）。並びの最後がレッコウなので、レッコウが出たときに調べる
//  （自軍ターンでなくても発動する）。撃破するのは印刷の BP が3000以下の敵軍ユニット（エリア・サイズを問わない）。撃破してからフロントアックスを開く。

export const FRONT_AXE_EFFECT_ID = "rk148_front_axe";
const GIANT_DRAGON_EFFECT_ID = "rk149_giant_dragon";

function completesGiantDragon(state: GameState, playerId: PlayerId, reckouId: string): boolean {
  const battle = state.players[playerId].battle;
  const i = battle.findIndex((c) => c.instanceId === reckouId);
  if (i < 3) return false;
  const named = (c: CardInstance | undefined, name: string) => !!c && cardName(state.definitions, c.cardId) === name;
  return named(battle[i - 1], "デンライナーイスルギ") && named(battle[i - 2], "デンライナーゴウカ") && named(battle[i - 3], "デンライナーイカヅチ");
}

function applyFrontAxe(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const enemyId = opponent(ctx.playerId);
  let axe: PendingEffectChoice | undefined;
  if (ownTurn(ctx)) {
    const ids = state.players[enemyId].battle
      .filter((c) => isUnitCard(state, c.cardId) && isMediumNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-148", c))
      .map((c) => c.instanceId);
    if (ids.length > 0) {
      axe = { ...base(ctxBase(ctx), "RK-148"), effectId: FRONT_AXE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true };
    }
  }
  if (selfId && completesGiantDragon(state, ctx.playerId, selfId)) {
    const targets = fieldUnits(state, enemyId)
      .filter((c) => {
        const bp = getDefinition(state.definitions, c.cardId)?.bp;
        return typeof bp === "number" && bp <= 3000;
      })
      .map((c) => c.instanceId);
    return { state: destroyAll(state, ctxBase(ctx), "RK-149", GIANT_DRAGON_EFFECT_ID, targets, axe), detail: GIANT_DRAGON_EFFECT_ID };
  }
  return axe ? { state: openOrQueue(state, axe), detail: FRONT_AXE_EFFECT_ID } : { state, detail: "rk148:no_targets" };
}

CHOICE_RESOLVERS[FRONT_AXE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = state.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, unit],
  }));
  if (!unitFeatures(state, enemyId, unit).includes("メカ")) {
    const left = applyUnitLeave(next, instanceId, "power", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-148", `${FRONT_AXE_EFFECT_ID}:${cardName(state.definitions, unit.cardId)}`) };
};
CHOICE_SKIPPERS[FRONT_AXE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-150 ゼロライナードリル【掘削】（ラッシュしたとき）
// 「敵軍パワーゾーンのダメージ以外のカードの枚数を数えてから、そのカードをすべて捨札にしてもよい。そうしたとき、数えた枚数と同じ枚数になるまで
//  敵軍捨札からカードを選び、敵軍パワーゾーンにオモテ向きで置く。」（atwiki/page-676）
// - まず捨札にするかを選ぶ（任意）。その後、自分が敵軍捨札（捨札にしたばかりのカードを含む）から1枚ずつ数えた枚数まで選ぶ（捨札が尽きたら止まる）。
// - オモテ向きの「相手に選ばれない」カードは選べない（ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。

export const DRILL_EFFECT_ID = "rk150_drill";
export const DRILL_PICK_EFFECT_ID = "rk150_drill_pick";

function drillPickIds(state: GameState, enemyId: PlayerId): string[] {
  return state.players[enemyId].discard.filter((c) => !cardNotSelectableByOpponent(c.cardId)).map((c) => c.instanceId);
}

function applyDrill(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  if (!state.players[enemyId].power.some((c) => !c.faceDown)) return { state, detail: "rk150:no_power" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-150", DRILL_EFFECT_ID)), detail: DRILL_EFFECT_ID };
}

function openDrillPick(state: GameState, pending: PendingEffectChoice, remaining: number): GameState {
  const ids = remaining > 0 ? drillPickIds(state, opponent(pending.playerId)) : [];
  if (ids.length === 0) return proceed(state, pending);
  return openNext(state, pending, {
    ...base(pending, "RK-150"),
    effectId: DRILL_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    rk8Meta: { remaining },
  });
}

CHOICE_RESOLVERS[DRILL_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[DRILL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const faceUp = state.players[enemyId].power.filter((c) => !c.faceDown);
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.faceDown),
    discard: [...p.discard, ...faceUp.map(stripForZone)],
  }));
  return { state: openDrillPick(next, pending, faceUp.length), log: logFor(state, playerId, "RK-150", `${DRILL_EFFECT_ID}:${faceUp.length}`) };
};
CHOICE_SKIPPERS[DRILL_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[DRILL_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    power: [...p.power, { ...stripForZone(card), faceDown: false }],
  }));
  const remaining = (pending.rk8Meta?.remaining ?? 1) - 1;
  return { state: openDrillPick(next, pending, remaining), log: logFor(state, playerId, "RK-150", `${DRILL_PICK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-152 仮面ライダー電王PF の※「…BP3000以上なら「SP1/4」になる。」（atwiki/page-633）。BP は promotedKeywordBridge の
// power_feature_bp_sp_* で数える。SP はここで、BP3000 以上なら並びで決まる「SP1/4」（2番目ではストライクできない）。
// RK-161 ショッカーライダーの※「これは「ショッカーライダー」だけでコンビネーションしてバトルエリアの6番目に並んだとき「SP1」になる。」（atwiki/page-702）
// バトルエリアの1〜6番目がすべて「ショッカーライダー」で、ビークルがない（faq-rider-2 RK-161 Q1・Q2）ときの6番目。RC とは関係しない（コメント欄）。

export function rk8EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (isSameCardIdentity(instance.cardId, "RK-152")) {
    if (effectiveBp(state, playerId, instance) < 3000) return sp;
    const battle = state.players[playerId].battle;
    return Math.max(sp, printedSpBase("1/4", battlePositionOneBased(battle, instance.instanceId), crossReductionFor(battle, instance.instanceId)));
  }
  if (isSameCardIdentity(instance.cardId, "RK-161")) {
    const battle = state.players[playerId].battle;
    if (battle.length !== 6 || battle[5]?.instanceId !== instance.instanceId) return sp;
    if (!battle.every((c) => isUnitCard(state, c.cardId) && cardName(state.definitions, c.cardId) === "ショッカーライダー")) return sp;
    return Math.max(sp, 1);
  }
  return sp;
}

/** RK-152 の「SP1/4」は rk8EffectiveSp で扱う（promotedKeywordBridge の SP の底上げ「SP1」から外す）。 */
export function rk8SkipsPromotedSpFloor(cardId: string): boolean {
  return isSameCardIdentity(cardId, "RK-152");
}

// ---------------------------------------------------------------------------
// RK-153 仮面ライダーガオウ
// ※「これは、敵軍ユニットを撃破したターンにしかバトルエリアに出られない。」（atwiki/page-705）
//   そのターン、ターンのプレイヤーの側から見た敵軍ユニットが場から捨札になったら記録する（applyRk8AfterAction）。
// 【車両強奪】「これが自軍ラッシュエリアにある間、自分がターンを終えるとき、敵軍バトルエリアから特徴「車両」を持つユニットを1体選んでもよい。
//   そうしたとき、次の相手のターン、相手はスタートフェイズにバトルエリアのユニットをラッシュエリアに戻すとき、選ばれたユニットをラッシュエリアに
//   戻すことはできない。」— 選ばれたユニットは rk8Seized に記録し、相手のターンを終えるときに消す。

const DESTROYED_ENEMY_RULE = "rk153_destroyed_enemy_this_turn";
export const SEIZE_EFFECT_ID = "rk153_vehicle_seize";

function destroyedEnemyThisTurn(state: GameState, playerId: PlayerId): boolean {
  return getPlayerModifiers(state.players[playerId]).some((m) => m.kind === "rule" && m.ruleId === DESTROYED_ENEMY_RULE && m.scope === "turn");
}

/** applyAction の後処理（depth 0）: ターンのプレイヤーから見た敵軍ユニットが場から捨札になったら記録する。 */
export function applyRk8AfterAction(before: GameState, after: GameState, turnPlayerId: PlayerId): GameState {
  if (destroyedEnemyThisTurn(after, turnPlayerId)) return after;
  const enemyId = opponent(turnPlayerId);
  const beforeField = new Set(fieldUnits(before, enemyId).map((c) => c.instanceId));
  const afterField = new Set(fieldCards(after, enemyId).map((c) => c.instanceId));
  const destroyed = after.players[enemyId].discard.some((c) => beforeField.has(c.instanceId) && !afterField.has(c.instanceId));
  if (!destroyed) return after;
  return patchPlayer(after, turnPlayerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId: DESTROYED_ENEMY_RULE, scope: "turn", sourceCardId: "RK-153" }],
  }));
}

/** 選択を伴う「自分がターンを終えるとき」の発生源（自軍ラッシュエリアのガオウ）。相手のターンに選ばれていた記録はここで消す。 */
export function collectRk8TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return state.players[endingPlayerId].rush.filter((c) => isSameCardIdentity(c.cardId, "RK-153")).map((c) => c.instanceId);
}

/** ターンを終えたプレイヤーの、【車両強奪】で戻せなかったユニットの記録を消す（rules/turnEndingEffects.ts から呼ぶ）。 */
export function clearRk8SeizedFor(state: GameState, endingPlayerId: PlayerId): GameState {
  if (!state.rk8Seized?.some((e) => e.playerId === endingPlayerId)) return state;
  const rest = state.rk8Seized.filter((e) => e.playerId !== endingPlayerId);
  return { ...state, rk8Seized: rest.length > 0 ? rest : undefined };
}

export function openRk8TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  if (!state.players[endingPlayerId].rush.some((c) => c.instanceId === entry)) return state;
  const enemyId = opponent(endingPlayerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && unitFeatures(state, enemyId, c).includes("車両") && selectableEnemy(state, endingPlayerId, "RK-153", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    ...base({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: entry }, "RK-153"),
    effectId: SEIZE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[SEIZE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  const next = close(state, pending);
  return {
    state: { ...next, rk8Seized: [...(next.rk8Seized ?? []), { playerId: enemyId, instanceId }] },
    log: logFor(state, playerId, "RK-153", `${SEIZE_EFFECT_ID}:${cardName(state.definitions, card?.cardId ?? "")}`),
  };
};
CHOICE_SKIPPERS[SEIZE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-153", SEIZE_EFFECT_ID) };
};

/** スタートフェイズの戻しで、【車両強奪】で選ばれたユニットは戻さない（rules/startPhase.ts から呼ぶ）。 */
export function rk8StaysInBattleAtStart(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return !!state.rk8Seized?.some((e) => e.playerId === playerId && e.instanceId === instanceId);
}

// ---------------------------------------------------------------------------
// バトルエリアに出られない※（rules/restrictions.ts から呼ぶ）
// - RK-153: このターン敵軍ユニットを撃破していなければ出られない。
// - RK-167 仮面ライダーカイザ「※これは、これ以外の自軍Sユニットを１体ホールドしなければバトルエリアに出られない。」（atwiki/page-664）
//   ホールドできる（リリース状態の）これ以外の自軍 S ユニット（エリアを問わない）がなければ出られない。出たときにホールドするユニットを選ぶ。

function kaiserHoldIds(state: GameState, playerId: PlayerId, selfId: string): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => c.instanceId !== selfId && !c.commandHeld && rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
}

export function rk8BlocksBattleEntry(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  if (isSameCardIdentity(unit.cardId, "RK-153")) return !destroyedEnemyThisTurn(state, playerId);
  if (isSameCardIdentity(unit.cardId, "RK-167")) return kaiserHoldIds(state, playerId, unit.instanceId).length === 0;
  return false;
}

export const KAISER_HOLD_EFFECT_ID = "rk167_kaiser_hold";

function applyKaiserHold(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return { state, detail: "rk167:no_unit" };
  const ids = kaiserHoldIds(state, ctx.playerId, selfId);
  if (ids.length === 0) return { state, detail: "rk167:no_hold" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-167"), effectId: KAISER_HOLD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: KAISER_HOLD_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[KAISER_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = setHeld(close(state, pending), playerId, new Set([instanceId]));
  const card = fieldCards(state, playerId).find((c) => c.instanceId === instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-167", `${KAISER_HOLD_EFFECT_ID}:${cardName(state.definitions, card?.cardId ?? "")}`) };
};

// ---------------------------------------------------------------------------
// RK-166 仮面ライダーG3 ※「これはホールド状態のときビークルにライドできない。」（atwiki/page-636）。ライドするときだけ判定する（faq-rider-2 RK-166 Q1）。

export function rk8BlocksMount(rider: CardInstance): boolean {
  return isSameCardIdentity(rider.cardId, "RK-166") && !!rider.commandHeld;
}

// ---------------------------------------------------------------------------
// 「ラッシュエリアに戻るとき」（rules/startPhase.ts から呼ぶ）
// - RK-155 キングライナー【車両の収納と発車】後半「これがラッシュエリアに戻るとき、自軍パワーゾーンのオモテ向きのカードから、特徴「車両」を持つ
//   Mユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-678）
// - RK-156 マシンデンバード【デンライナー搭乗】「これがバトルエリアからラッシュエリアに戻るとき、これがライドされていれば次の効果を発動できる⇒
//   自軍山札から特徴「車両」を持つMユニットのカードを1枚選び、相手に見せてから自分の手札に加えてもよい。その後、山札をシャッフルする。」（atwiki/page-680）
//   選んで手札に加えたら山札をシャッフルする（見送りは発動しないものとする）。
// - RK-157 バットイマジン【契約者の望むもの】「これが自軍バトルエリアからラッシュエリアに戻るとき、自軍常駐置き場からカードを1枚選び、自分の手札に
//   加えてもよい。ただし、ウラ向きのカードはウラ向きのまま選ぶ。」（atwiki/page-637）。重ねていたカードは捨札（RK-018 ミラーワールドは手札）。

export const KING_LINER_RETURN_EFFECT_ID = "rk155_king_liner_return";
export const DENBIRD_EFFECT_ID = "rk156_denbird";
export const BAT_IMAGIN_EFFECT_ID = "rk157_bat_imagin";

export function isRk8BattleToRushTrigger(card: CardInstance): boolean {
  return ["RK-155", "RK-156", "RK-157"].some((id) => isSameCardIdentity(card.cardId, id));
}

function isVehicleMUnitCard(state: GameState, playerId: PlayerId, cardId: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  return def?.type === "unit" && def.size === "M" && rk1ZoneCardFeatures(state, playerId, cardId).includes("車両");
}

export function tryRk8BattleToRush(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  const ctx = { playerId, phasePlayerId, sourceInstanceId: card.instanceId };
  const p = state.players[playerId];
  if (isSameCardIdentity(card.cardId, "RK-155")) {
    const ids = p.power.filter((c) => !c.faceDown && isVehicleMUnitCard(state, playerId, c.cardId)).map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openOrQueue(state, { ...base(ctx, "RK-155"), effectId: KING_LINER_RETURN_EFFECT_ID, kind: "select_power", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  if (isSameCardIdentity(card.cardId, "RK-156")) {
    if (!p.rush.some((c) => c.mountedOnInstanceId === card.instanceId)) return state;
    const ids = p.deck.filter((c) => isVehicleMUnitCard(state, playerId, c.cardId)).map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openOrQueue(state, { ...base(ctx, "RK-156"), effectId: DENBIRD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  if (isSameCardIdentity(card.cardId, "RK-157")) {
    const ids = p.operation.map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openOrQueue(state, { ...base(ctx, "RK-157"), effectId: BAT_IMAGIN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  return state;
}

CHOICE_RESOLVERS[KING_LINER_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-155", `${KING_LINER_RETURN_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[KING_LINER_RETURN_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[DENBIRD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
    hand: [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-156", `${DENBIRD_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[DENBIRD_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[BAT_IMAGIN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].operation.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const leaving = rk1ResidentLeaving(card);
  const stacked = (card.stackedCards ?? []).map(stripForZone);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    operation: p.operation.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card), ...(leaving ? leaving.toHand : [])],
    discard: leaving ? p.discard : [...p.discard, ...stacked],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-157", `${BAT_IMAGIN_EFFECT_ID}:${card.faceDown ? "face_down" : cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[BAT_IMAGIN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-155 キングライナー【車両の収納と発車】前半（バトルエリアに出たとき）
// 「自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアから特徴「車両」を持つMユニットを1体選び、自軍パワーゾーンに送ってもよい。」

export const KING_LINER_STORE_EFFECT_ID = "rk155_king_liner_store";

function applyKingLinerStore(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(ctx)) return { state, detail: "rk155:not_own_turn" };
  const ids = state.players[ctx.playerId].battle
    .filter((c) => c.instanceId !== ctx.triggerSourceInstanceId && isUnitCard(state, c.cardId) && isMediumNow(state, c) && unitFeatures(state, ctx.playerId, c).includes("車両"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk155:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-155"), effectId: KING_LINER_STORE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "power" }),
    detail: KING_LINER_STORE_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-159 仮面ライダーV3（THE NEXT）【V3キック】（RC）「必要パワーの数字に「－」のある敵軍Sユニットを1体選び撃破してもよい。」（atwiki/page-655）
// エリアを問わない（カード評価）。

export const V3_KICK_EFFECT_ID = "rk159_v3_kick";

function hasMinusCost(state: GameState, cardId: string): boolean {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  return typeof cost === "string" && /[-－−]$/.test(cost.trim());
}

function applyV3Kick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && hasMinusCost(state, c.cardId) && selectableEnemy(state, ctx.playerId, "RK-159", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk159:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-159"), effectId: V3_KICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "discard" }),
    detail: V3_KICK_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-160 シザーズジャガー【ナノロボット散布実験】
// 「これが自軍エリアにある間、追加条件を持たない敵軍Sユニットがラッシュされたとき、そのユニットの必要パワーの数字と同じ必要パワーの数字を持つDAの
//  ユニットカードを自分の手札から1枚選び、ラッシュエリアに出してもよい。ただし、DAの自軍コマンドを1つホールドすること。そうしたとき、ラッシュされた
//  敵軍ユニットを撃破する。」（atwiki/page-703）
// - 「ラッシュされたとき」の誘発（「ラッシュしたとき」の処理をすべて終えた後。faq-rider-2 RK-160 Q1）。モーフで入れ替わって出たユニットにも発動する（Q2）。
// - 出すカードは追加条件・サイズを問わない（カード評価）。ホールドする DA のコマンドは、リリース状態の先頭のもの。出したカードはラッシュとして扱う（Q5・Q6）。

export const JAGUAR_EFFECT_ID = "rk160_nano_robot";

function releasedDaCommand(state: GameState, playerId: PlayerId): CardInstance | undefined {
  return state.players[playerId].command.find((c) => !c.commandHeld && commandCategoriesOf(state, playerId, c.cardId).includes("DA"));
}

export function openRk8JaguarOnEnemyRush(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  const defenderId = opponent(rusherPlayerId);
  const jaguar = fieldCards(state, defenderId).find((c) => isSameCardIdentity(c.cardId, "RK-160"));
  if (!jaguar) return state;
  const rushed = fieldCards(state, rusherPlayerId).find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId) || !rk1IsSmallNow(state, rushed)) return state;
  const def = getDefinition(state.definitions, rushed.cardId);
  if (!def || resolveRushAdditionalCondition(rushed.cardId, def as never)) return state;
  if (!releasedDaCommand(state, defenderId)) return state;
  const cost = parsePowerCost(def.powerCost);
  if (!Number.isFinite(cost)) return state;
  const ids = state.players[defenderId].hand
    .filter((c) => isUnitCard(state, c.cardId) && categoriesOfCard(state, c.cardId).includes("DA") && parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost) === cost)
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId: defenderId, phasePlayerId, sourceInstanceId: jaguar.instanceId }, "RK-160"),
    effectId: JAGUAR_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    rk8Meta: { picked: rushedInstanceId },
  });
}

CHOICE_RESOLVERS[JAGUAR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const command = releasedDaCommand(state, playerId);
  if (!card || !command) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === command.instanceId ? { ...c, commandHeld: true } : c)),
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  const target = pending.rk8Meta?.picked;
  if (target && fieldCards(next, opponent(playerId)).some((c) => c.instanceId === target)) {
    const left = applyUnitLeave(next, target, "discard", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  const rushed = finalizeEffectRush(next, playerId, [instanceId], pending.phasePlayerId);
  next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-160", `${JAGUAR_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[JAGUAR_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-162 仮面ライダーアギトGF【ライダーキック】（RC）「敵軍バトルエリアから、カテゴリにDAを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-692）

export const AGITO_GF_EFFECT_ID = "rk162_rider_kick";

function applyAgitoGf(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && unitEffectiveCategories(state, enemyId, c, "battle").includes("DA") && selectableEnemy(state, ctx.playerId, "RK-162", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk162:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-162"), effectId: AGITO_GF_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, unitDestination: "discard" }),
    detail: AGITO_GF_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-163 オルタナティブ・ゼロ【無意識の記憶力】（RC）
// 「敵軍捨札からユニットカードを1枚選んでもよい。そうしたとき、選んだカードと同じカード名の敵軍ユニットを1体選び、撃破する。」（atwiki/page-650）
// - 「これは「○○」として使える」カードは、そのカード名としても扱う（Q1）。同じカード名の敵軍ユニットはエリア・サイズを問わない（カード評価）。
// - オモテ向きの「相手に選ばれない」カードは捨札から選べない（ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。

export const ALT_ZERO_EFFECT_ID = "rk163_unconscious_memory";
export const ALT_ZERO_DESTROY_EFFECT_ID = "rk163_unconscious_memory_destroy";

const USABLE_AS_RE = /これは「([^」]+)」として(?:つかえる|使える)/g;

function namesOf(state: GameState, cardId: string): string[] {
  const def = getDefinition(state.definitions, cardId);
  if (!def) return [];
  const names = [def.name];
  for (const m of (def.text ?? "").matchAll(USABLE_AS_RE)) if (m[1]) names.push(m[1]);
  return names;
}

function sameNameCards(state: GameState, a: string, b: string): boolean {
  const na = namesOf(state, a);
  const nb = namesOf(state, b);
  return na.some((x) => nb.some((y) => sameCardName(x, y)));
}

function applyAltZero(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].discard
    .filter((c) => isUnitCard(state, c.cardId) && !cardNotSelectableByOpponent(c.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk163:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-163"), effectId: ALT_ZERO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: ALT_ZERO_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ALT_ZERO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const picked = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!picked) return { error: "invalid_target" };
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "RK-163", `${ALT_ZERO_EFFECT_ID}:${cardName(state.definitions, picked.cardId)}`);
  const ids = fieldUnits(cleared, enemyId)
    .filter((c) => sameNameCards(cleared, c.cardId, picked.cardId) && selectableEnemy(cleared, playerId, "RK-163", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...base(pending, "RK-163"), effectId: ALT_ZERO_DESTROY_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, unitDestination: "discard" }),
    log,
  };
};
CHOICE_SKIPPERS[ALT_ZERO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-164 仮面ライダー1号（THE FIRST）【ライダーパンチ】（RC）後半「さらに、このユニットがホールド状態なら、このターン、これは「SP1」になる。」
// （atwiki/page-663）。BP+2000 は DSL の modify_bp。

function applyRiderPunchSp(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  const unit = id ? state.players[ctx.playerId].battle.find((c) => c.instanceId === id) : undefined;
  if (!unit?.commandHeld) return { state, detail: "rk164:released" };
  return { state: grantSp1ToBattleUnit(state, ctx.playerId, unit.instanceId), detail: "rk164:sp1" };
}

// ---------------------------------------------------------------------------
// RK-165 仮面ライダー電王WF【恩返し】（撃破されて捨札になったとき）
// 「敵軍ターン中、これが撃破されて捨札になったとき次の効果を発動できる⇒自軍パワーゾーンからダメージになっているカードを1枚選び、オモテにする。
//  このとき、オモテにしたカードが「ジーク」なら、そのカードを捨札にしてこの効果をもう一度発動できる。」（atwiki/page-681）
// 発動は任意（見送れる）。「ジーク」ならそのたびにもう一度選べる（カード評価「1回に最大で4点回復」）。カード名が「ジーク」のカードだけ（コメント欄）。

export const ONGAESHI_EFFECT_ID = "rk165_ongaeshi";

function ongaeshiChoice(state: GameState, ctx: BaseCtx): PendingEffectChoice | null {
  const ids = state.players[ctx.playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return { ...base(ctx, "RK-165"), effectId: ONGAESHI_EFFECT_ID, kind: "select_power", validInstanceIds: ids, selectCount: 1, optional: true };
}

function applyOngaeshi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ownTurn(ctx)) return { state, detail: "rk165:own_turn" };
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId || !state.players[ctx.playerId].discard.some((c) => c.instanceId === selfId)) return { state, detail: "rk165:not_in_discard" };
  const choice = ongaeshiChoice(state, ctxBase(ctx));
  return choice ? { state: openInterrupt(state, choice), detail: ONGAESHI_EFFECT_ID } : { state, detail: "rk165:no_damage" };
}

CHOICE_RESOLVERS[ONGAESHI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const isZeek = cardName(state.definitions, card.cardId) === "ジーク";
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: isZeek ? p.power.filter((c) => c.instanceId !== instanceId) : p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: false } : c)),
    discard: isZeek ? [...p.discard, stripForZone(card)] : p.discard,
    damage: Math.max(0, p.damage - 1),
  }));
  const log = logFor(state, playerId, "RK-165", `${ONGAESHI_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (isZeek) {
    const again = ongaeshiChoice(next, pending);
    if (again) return { state: openNext(next, pending, again), log };
  }
  next = proceed(next, pending);
  return { state: next, log };
};
CHOICE_SKIPPERS[ONGAESHI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-166 仮面ライダーG3【GM-01】（RC）「ホールド状態の敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く（置けなければこの効果は
// 発動できない)。」（atwiki/page-636）。エリアを問わない。置いたカードはユニットとしての情報を失う（faq-rider-2 RK-166 Q4）。

export const GM01_EFFECT_ID = "rk166_gm01";

function applyGm01(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  if (state.players[enemyId].command.length >= COMMAND_ZONE_MAX) return { state, detail: "rk166:command_full" };
  const ids = fieldUnits(state, enemyId)
    .filter((c) => c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-166", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk166:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-166"), effectId: GM01_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: GM01_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GM01_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = fieldCards(state, enemyId).find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  // 離場の処理を通す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。
  const next = sendFieldCardsToCommandHeld(close(state, pending), enemyId, [instanceId], pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-166", `${GM01_EFFECT_ID}:${cardName(state.definitions, unit.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-167 仮面ライダーカイザ【カイザブレイガン】（RC）「BPの下三桁が500の敵軍Sユニットを1体選び撃破する。（この効果は「サイドバッシャーBM」から
// コンビネーションするときはナンバーに関係なく発動する）」（atwiki/page-664）。エリアを問わない（カード評価）。BP は今の BP。

export const KAISER_BLAYGUN_EFFECT_ID = "rk167_kaiser_blaygun";

function applyKaiserBlaygun(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && effectiveBp(state, enemyId, c) % 1000 === 500 && selectableEnemy(state, ctx.playerId, "RK-167", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk167:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-167"), effectId: KAISER_BLAYGUN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, unitDestination: "discard" }),
    detail: KAISER_BLAYGUN_EFFECT_ID,
  };
}

/** ライドせずに出たカイザの直前が RK-121 サイドバッシャーBM なら RC の効果を発動する（rules/battleEntry.ts から呼ぶ）。対象外なら null。 */
export function rk8KaiserBmOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const battle = state.players[playerId].battle;
  const i = battle.findIndex((c) => c.instanceId === instanceId);
  const unit = battle[i];
  if (!unit || unit.mountedOnInstanceId || !isSameCardIdentity(unit.cardId, "RK-167")) return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  const prev = battle[i - 1];
  if (!prev || !isSameCardIdentity(prev.cardId, "RK-121")) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
  const markedUnit = marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!;
  const rc = resolveRidingComboOnRideOff(marked, playerId, markedUnit);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK8_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-148::front_axe": applyFrontAxe,
  "RK-150::drill": applyDrill,
  "RK-155::store": applyKingLinerStore,
  "RK-159::v3_kick": applyV3Kick,
  "RK-162::rider_kick": applyAgitoGf,
  "RK-163::unconscious_memory": applyAltZero,
  "RK-164::rider_punch_sp1": applyRiderPunchSp,
  "RK-165::ongaeshi": applyOngaeshi,
  "RK-166::gm01": applyGm01,
  "RK-167::entry_hold": applyKaiserHold,
  "RK-167::kaiser_blaygun": applyKaiserBlaygun,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-149::giant_dragon": noop("rk149:on_reckou_entry"),
  "RK-153::vehicle_seize": noop("rk153:turn_end"),
  "RK-154::head_held_high": noop("rk154:on_rush_unit_effects"),
  "RK-156::denliner_board": noop("rk156:battle_to_rush"),
  "RK-157::contract_wish": noop("rk157:battle_to_rush"),
  "RK-160::nano_robot": noop("rk160:enemy_rush"),
};

export function tryRk8CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK8_KEYWORD_PREFIX)) return null;
  const handler = RK8_KEYWORDS[keyword.slice(RK8_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
