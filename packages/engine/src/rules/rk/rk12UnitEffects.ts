/**
 * ザ・マスクドライダーEXP vol.3〜4 RK-232〜RK-252（火焔大将〜変身音叉 音角）のカード固有の効果（cardSpec RK12-232-252 の監査）。
 *
 * - `tryRk12CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk12::cardId::name`。バトルエリアに出たとき・RC・撃破されたとき・オペレーション）。
 * - `tryResolveRk12Choice` / `trySkipRk12Choice` / `tryConfirmRk12Choice`: このモジュールが開いた選択の解決。撃破・パワーゾーン送り・ダメージにする
 *   選択の一部は汎用の選択（unitDestination "discard"／"power"）で解決する（rules/pendingChoices.ts）。
 * - `collectRk12KaenQueue` / `openRk12KaenOnReturn`: RK-232 火焔大将の※（rules/startPhase.ts のスタートフェイズの戻し）。
 * - `openRk12NegatarosOnRush`: RK-236 ネガタロス（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。
 * - `openRk12CastleDoranDraw`: RK-238 キャッスルドラン【魂の捕獲】（events/listeners/unitLeftZoneListener.ts）。
 * - `rk12MarkHeldEntry` / `tryRk12OnEnterBattle`: RK-239 ウエイクアップ！・RK-243 リュウガのコンビネーション（rules/combo.ts）。
 * - タッグの常駐 RK-239・RK-242・RK-244・RK-248（rules/legend1/set8NamedEffectsA.ts registerTagResident。起動は同モジュールの常駐の起動）。
 * - `openRk12SurviveStay`: RK-250 サバイブ「重ねたユニットがユニットでなくなるとき、このカードを捨札にしてその場に留める」（rules/operationCounters.ts tryLeaveField）。
 * - `openRk12GorgomWindow`: RK-251 ゴルゴムの仕業（core/applyAction.ts の play_operation の効果の実行前）。
 * - `trackRk12UnitHolds`: このターン自軍ユニットがホールドされたかの記録（RK-240・RK-247。core/applyAction.ts の後処理）。
 * 継続効果の判定は rules/rk/rk12Fields.ts。構成は rules/rk/rk11UnitEffects.ts と同じ。
 */
import { fusionMaterialAliasRequiresNoOwnL, isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { canPlayOperationExceptCommandHold, cardName, effectiveBp, effectiveCommandCategories, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice, requestDrawFromDeck } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { finalizeLeaveReaction } from "../operationCounters";
import { IMAGIN_DESTROY_ON_ENTER_SUPPRESSED } from "../destroyOnEnterBattle";
import { registerTagResident, tagEntryChoice } from "../legend1/set8NamedEffectsA";
import { rk1IsSmallNow, isStackedUnderUnitOperation } from "./rk1Features";
import {
  RK12_CLIMAX_POLICE_RULE,
  RK12_PARADISE_LOST_RULE,
  RK12_UNIT_HELD_RULE,
  SURVIVE_CARD_ID,
  rk12TurnPayloads,
  surviveCount,
} from "./rk12Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK12_KEYWORD_PREFIX = "rk12::";

export function isRk12ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk12Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk12Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmRk12Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk12Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk12Choice(pending)) return { error: "no_selection" };
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

function confirmChoice(ctx: BaseCtx, sourceCardId: string, effectId: string, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: [], optional: true, mayConfirm: true, ...extra };
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

function fieldUnits(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  return fieldCards(state, playerId).filter((c) => isUnitCard(state, c.cardId));
}

function zoneOfField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): "battle" | "rush" | null {
  const p = state.players[playerId];
  if (p.battle.some((c) => c.instanceId === instanceId)) return "battle";
  if (p.rush.some((c) => c.instanceId === instanceId)) return "rush";
  return null;
}

function findField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  return fieldCards(state, playerId).find((c) => c.instanceId === instanceId);
}

/** 敵軍の効果で選べる敵軍のカード（「相手に選ばれない」等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function categoriesOfCard(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category;
  return Array.isArray(c) ? c : c ? [c] : [];
}

function costNumber(state: Pick<GameState, "definitions">, cardId: string): number {
  return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost);
}

function hasNumber(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const cn = getDefinition(state.definitions, cardId)?.comboNumber;
  return cn !== undefined && cn !== null;
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

function setHeld(state: GameState, ownerId: PlayerId, instanceIds: Set<string>, held = true): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: held } : c)),
    rush: p.rush.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: held } : c)),
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

/** 選んだ場のユニットを持ち主のパワーゾーン等へ（ルールの離場の手続きを通す）。 */
function leaveField(state: GameState, pending: PendingEffectChoice, instanceId: string, destination: "power" | "discard"): GameState {
  const left = applyUnitLeave(close(state, pending), instanceId, destination, pending.phasePlayerId);
  return proceed("error" in left ? close(state, pending) : left.state, pending);
}

/** 1枚ずつ選んで count 枚そろったら done を呼ぶ選択の解決。 */
function accumulate(count: number, done: (state: GameState, playerId: PlayerId, pending: PendingEffectChoice, selected: string[]) => ChoiceOutcome): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
    if (selected.length < count && remaining.length > 0) {
      return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining, optional: false } } };
    }
    return done(state, playerId, pending, selected);
  };
}

/** 選んだカード1枚をラッシュエリアに出す（効果のラッシュ。追加条件の素材の選択等は rules/effectRush.ts）。 */
function rushPicked(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
  fromZone: "hand" | "discard",
  opts: { requireConditions: boolean; ignorePowerCost?: boolean },
): GameState {
  const next = startEffectRush(close(state, pending), {
    playerId: pending.playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${pending.effectId}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone,
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: opts.requireConditions,
    ignorePowerCost: opts.ignorePowerCost,
    mandatory: true,
    forced: true,
  });
  return proceed(next, pending);
}

/** 自分のパワーゾーンのカード（オモテ・ウラ）に1枚置く。 */
function toPowerFaceUp(state: GameState, ownerId: PlayerId, card: CardInstance): GameState {
  return patchPlayer(state, ownerId, (p) => ({ ...p, power: [...p.power, { ...stripForZone(card), faceDown: false }] }));
}

// ---------------------------------------------------------------------------
// RK-232 火焔大将（※）
// 「※これが自軍捨札にある間、自軍スタートフェイズ中、本来のカテゴリにMAを持ち、ナンバーを持たない自軍Sユニットがバトルエリアからラッシュエリアに
//  戻るとき、自軍エリアに｢火焔大将｣がなければ、これをラッシュエリアに出してもよい。」（atwiki/page-949）
// 戻ったユニット1体ごとに確かめる（rules/startPhase.ts のキュー）。出すのは捨札の「火焔大将」1枚（効果のラッシュ）。

export const KAEN_EFFECT_ID = "rk232_kaen_taisho";
const KAEN_QUEUE_PREFIX = "rk232::";

function isKaen(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return isSameCardIdentity(cardId, "RK-232") || sameCardName(getDefinition(state.definitions, cardId)?.name, "火焔大将");
}

function kaenReturnTrigger(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const d = getDefinition(state.definitions, cardId);
  if (d?.type !== "unit" || d.size !== "S") return false;
  return categoriesOfCard(state, cardId).includes("MA") && !hasNumber(state, cardId);
}

/** スタートフェイズに戻ったユニットのうち、火焔大将の※の条件を満たすもの（キューの項目）。 */
export function collectRk12KaenQueue(state: GameState, playerId: PlayerId, movedCards: CardInstance[]): string[] {
  if (state.phase !== "start" || state.activePlayer !== playerId) return [];
  if (!state.players[playerId].discard.some((c) => isKaen(state, c.cardId))) return [];
  return movedCards.filter((c) => kaenReturnTrigger(state, c.cardId)).map((c) => `${KAEN_QUEUE_PREFIX}${c.instanceId}`);
}

export function isRk12KaenQueueEntry(entry: string): boolean {
  return entry.startsWith(KAEN_QUEUE_PREFIX);
}

/** キューの項目を処理する（選択を開くか、そのまま返す）。 */
export function openRk12KaenOnReturn(state: GameState, playerId: PlayerId, entry: string): GameState {
  if (!isRk12KaenQueueEntry(entry)) return state;
  if (fieldCards(state, playerId).some((c) => isKaen(state, c.cardId))) return state;
  const ids = state.players[playerId].discard.filter((c) => isKaen(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: ids[0] }, "RK-232"),
    effectId: KAEN_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[KAEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: rushPicked(state, pending, instanceId, "discard", { requireConditions: false }), log: logFor(state, playerId, "RK-232", `${KAEN_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[KAEN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-233 仮面ライダーコーカサス【ハイパーライダーキック】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒相手は1枚ドローしてから、自分自身の手札からカードを1枚選び、自分自身の
//  パワーゾーンに置く。その後、相手の置いたカードの必要パワーの数字を見て、その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主の
//  パワーゾーンに送る。」（atwiki/page-953）。敵軍ユニットはサイズ・エリアを問わない。

export const HYPER_KICK_EFFECT_ID = "rk233_hyper_rider_kick";
export const HYPER_KICK_PLACE_EFFECT_ID = "rk233_hyper_rider_kick_place";
export const HYPER_KICK_SEND_EFFECT_ID = "rk233_hyper_rider_kick_send";

function applyHyperKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk233:enemy_turn" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-233", HYPER_KICK_EFFECT_ID)), detail: HYPER_KICK_EFFECT_ID };
}

CHOICE_RESOLVERS[HYPER_KICK_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[HYPER_KICK_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[HYPER_KICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = requestDrawFromDeck(close(state, pending), enemyId, pending.phasePlayerId, { count: 1, sourceCardId: "RK-233" }).state;
  const hand = next.players[enemyId].hand.map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-233", `${HYPER_KICK_EFFECT_ID}:draw`);
  if (hand.length === 0 || next.pendingEffectChoice) return { state: proceed(next, pending), log };
  next = openNext(next, pending, { ...pending, playerId: enemyId, effectId: HYPER_KICK_PLACE_EFFECT_ID, kind: "select_hand", validInstanceIds: hand, selectedInstanceIds: [], selectCount: 1, optional: false, mayConfirm: undefined, rk12Meta: { owner: playerId } });
  return { state: next, log };
};

CHOICE_RESOLVERS[HYPER_KICK_PLACE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.rk12Meta?.owner ?? opponent(playerId);
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId) }));
  next = toPowerFaceUp(next, playerId, card);
  const n = costNumber(next, card.cardId);
  const limit = Number.isFinite(n) ? n : 0;
  const ids = fieldUnits(next, playerId)
    .filter((c) => {
      const cost = costNumber(next, c.cardId);
      return Number.isFinite(cost) && cost <= limit && selectableEnemy(next, owner, "RK-233", c);
    })
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-233", `${HYPER_KICK_PLACE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...pending, playerId: owner, effectId: HYPER_KICK_SEND_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false }),
    log,
  };
};

CHOICE_RESOLVERS[HYPER_KICK_SEND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const target = findField(state, opponent(playerId), instanceId);
  return {
    state: leaveField(state, pending, instanceId, "power"),
    log: logFor(state, playerId, "RK-233", `${HYPER_KICK_SEND_EFFECT_ID}:${target ? cardName(state.definitions, target.cardId) : instanceId}`),
  };
};

// ---------------------------------------------------------------------------
// RK-234 仮面ライダーケタロス【ショルダータックル】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒敵軍バトルエリアからSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。
//  そうしたとき、敵軍ラッシュエリアに、戻したユニットの持つカテゴリを持たないユニットがあれば1体選び、戻したユニットとバトルさせる。」（atwiki/page-933）
// 敵軍ユニットどうしのバトルは BP を比べ、低い方（同じなら両方）が撃破される（R-BTL-02。RS-221 タイムイエロー【グラップファイター】と同じ）。

export const SHOULDER_TACKLE_EFFECT_ID = "rk234_shoulder_tackle";
export const SHOULDER_TACKLE_BATTLE_EFFECT_ID = "rk234_shoulder_tackle_battle";

function applyShoulderTackle(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk234:enemy_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-234", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk234:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-234"), effectId: SHOULDER_TACKLE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SHOULDER_TACKLE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SHOULDER_TACKLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const returned: CardInstance = { ...card, battleActed: undefined };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, returned],
  }));
  const cats = new Set(unitEffectiveCategories(next, enemyId, returned, "rush"));
  const ids = next.players[enemyId].rush
    .filter(
      (c) =>
        c.instanceId !== instanceId &&
        isUnitCard(next, c.cardId) &&
        !unitEffectiveCategories(next, enemyId, c, "rush").some((cat) => cats.has(cat)) &&
        selectableEnemy(next, playerId, "RK-234", c),
    )
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-234", `${SHOULDER_TACKLE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) {
    next = proceed(next, pending);
    return { state: next, log };
  }
  return {
    state: openNext(next, pending, { ...pending, effectId: SHOULDER_TACKLE_BATTLE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false, rk12Meta: { target: instanceId } }),
    log,
  };
};
CHOICE_SKIPPERS[SHOULDER_TACKLE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[SHOULDER_TACKLE_BATTLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const returnedId = pending.rk12Meta?.target;
  const rush = state.players[enemyId].rush;
  const a = rush.find((c) => c.instanceId === returnedId);
  const b = rush.find((c) => c.instanceId === instanceId);
  if (!a || !b) return { state: proceed(close(state, pending), pending) };
  const bpA = effectiveBp(state, enemyId, a);
  const bpB = effectiveBp(state, enemyId, b);
  const losers: string[] = [];
  if (bpA <= bpB) losers.push(a.instanceId);
  if (bpB <= bpA) losers.push(b.instanceId);
  const ctx: BaseCtx = { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  const next = destroyAll(close(state, pending), ctx, "RK-234", "rk234_shoulder_tackle_destroy", losers, pending.resumeChoice);
  return { state: next, log: logFor(state, playerId, "RK-234", `${SHOULDER_TACKLE_BATTLE_EFFECT_ID}:${bpA}vs${bpB}`) };
};


// ---------------------------------------------------------------------------
// RK-235 仮面ライダーヘラクス【アバランチクラッシュ】（RC）
// 「敵軍Sユニットの数が自軍Sユニットの数より3体以上多いとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-934）
// 数えるのは場（バトルエリア・ラッシュエリア）の S ユニット。選ぶ敵軍 S ユニットもエリアを問わない。

function applyAvalancheCrash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const countS = (pid: PlayerId) => fieldUnits(state, pid).filter((c) => rk1IsSmallNow(state, c)).length;
  if (countS(enemyId) < countS(ctx.playerId) + 3) return { state, detail: "rk235:not_enough" };
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-235", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk235:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-235"), effectId: "rk235_avalanche_crash", kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, unitDestination: "power" }),
    detail: "rk235_avalanche_crash",
  };
}

// ---------------------------------------------------------------------------
// RK-236 ネガタロス【ネガタロス軍団（仮）結成の野望】
// 「これが自軍エリアにある間、敵軍ラッシュフェイズ中、特徴「警察」を持つ敵軍ユニットがラッシュされたとき、次の効果を発動できる⇒自分の手札から
//  DAを持つBP3000以下のSユニットのカードを1枚選び、ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。」（atwiki/page-950）
// 必要パワーは満たさなくてよい（効果のラッシュ）。BP はカードの BP（手札のカード）。

export const NEGATAROS_EFFECT_ID = "rk236_negataros_army";

export function openRk12NegatarosOnRush(state: GameState, rusherId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  if (state.phase !== "rush" || state.activePlayer !== rusherId) return state;
  const rushed = findField(state, rusherId, rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId) || !unitFeatures(state, rusherId, rushed).includes("警察")) return state;
  const ownerId = opponent(rusherId);
  const negataros = fieldCards(state, ownerId).filter((c) => isSameCardIdentity(c.cardId, "RK-236"));
  if (negataros.length === 0) return state;
  const handIds = state.players[ownerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.size === "S" && categoriesOfCard(state, c.cardId).includes("DA") && typeof d.bp === "number" && d.bp <= 3000;
    })
    .map((c) => c.instanceId);
  const ids = filterEffectRushCandidates(state, ownerId, "hand", handIds, true, true);
  if (ids.length === 0) return state;
  let next = state;
  for (const n of negataros) {
    next = openOrQueue(next, {
      ...base({ playerId: ownerId, phasePlayerId, sourceInstanceId: n.instanceId }, "RK-236"),
      effectId: NEGATAROS_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    });
  }
  return next;
}

CHOICE_RESOLVERS[NEGATAROS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  return {
    state: rushPicked(state, pending, instanceId, "hand", { requireConditions: true, ignorePowerCost: true }),
    log: logFor(state, playerId, "RK-236", `${NEGATAROS_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
};
CHOICE_SKIPPERS[NEGATAROS_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 「自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、…」（RK-237・RK-245・RK-246・RK-312・RK-313）
// ホールド状態で出たときはホールドできないので発動しない（RK-245 カード評価「ホールド状態で場に出なければならず、そのままでは能力は使えない」）。
// RK-312・RK-313（rules/rk/rk15UnitEffects.ts の rk15:: キーワード）と、RK-314【モンスターフィーバー】で発動する効果（openRk12SelfHold）も同じ処理。

const SELF_HOLD_EFFECTS: Record<string, string> = {
  "RK-237": "rk237_aqua_tornado",
  "RK-245": "rk245_darkness_moon_break",
  "RK-246": "rk246_garulu_howling_slash",
  "RK-312": "rk312_dogga_thunder_slap",
  "RK-313": "rk313_darkness_moon_break",
};

/** 自分をホールドする効果を持つカード（RK-314【モンスターフィーバー】で効果を発動できるカード）か。 */
export function isRk12SelfHoldCard(cardId: string): string | undefined {
  return Object.keys(SELF_HOLD_EFFECTS).find((id) => isSameCardIdentity(cardId, id));
}

/**
 * copiedCardId の「このユニットをホールドしてもよい。そうしたとき、…」を、場の selfInstanceId のユニットの効果として開く（ホールドできなければ何もしない）。
 * sourceCardId は選択に表示するカード（RK-314【モンスターフィーバー】ならキバEF）。
 */
export function openRk12SelfHold(
  state: GameState,
  ctx: { playerId: PlayerId; phasePlayerId: PlayerId; selfInstanceId: string },
  copiedCardId: string,
  sourceCardId: string = copiedCardId,
): GameState {
  const effectId = SELF_HOLD_EFFECTS[copiedCardId];
  if (!effectId || state.activePlayer !== ctx.playerId) return state;
  const self = state.players[ctx.playerId].battle.find((c) => c.instanceId === ctx.selfInstanceId);
  if (!self || self.commandHeld) return state;
  return openOrQueue(state, confirmChoice({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.selfInstanceId }, sourceCardId, effectId));
}

export function applySelfHold(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    if (state.activePlayer !== ctx.playerId) return { state, detail: `${cardId}:enemy_turn` };
    const selfId = ctx.triggerSourceInstanceId;
    const self = selfId ? state.players[ctx.playerId].battle.find((c) => c.instanceId === selfId) : undefined;
    if (!self || self.commandHeld) return { state, detail: `${cardId}:cannot_hold` };
    return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), cardId, SELF_HOLD_EFFECTS[cardId]!)), detail: SELF_HOLD_EFFECTS[cardId] };
  };
}

/** ホールドした後の選択（無ければ undefined）。 */
function afterSelfHold(state: GameState, playerId: PlayerId, cardId: string, pending: PendingEffectChoice): PendingEffectChoice | undefined {
  const enemyId = opponent(playerId);
  const next = { ...pending, selectedInstanceIds: [] as string[], selectCount: 1, optional: false, mayConfirm: undefined };
  if (cardId === "RK-237") {
    // 「常駐しているオペレーションを1つ選び、選んだオペレーションを持ち主の山札に戻してシャッフルする。」（atwiki/page-940）。自軍・敵軍とも。
    const ids = (["player1", "player2"] as const).flatMap((pid) => state.players[pid].operation.map((c) => c.instanceId));
    if (ids.length === 0) return undefined;
    return { ...next, effectId: "rk237_aqua_tornado_pick", kind: "select_unit", validInstanceIds: ids };
  }
  if (cardId === "RK-245" || cardId === "RK-313") {
    // 「敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（RK-245 atwiki/page-876・RK-313 atwiki/page-1247）。エリアを問わない。
    const ids = fieldUnits(state, enemyId)
      .filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, cardId, c))
      .map((c) => c.instanceId);
    if (ids.length === 0) return undefined;
    return { ...next, effectId: `${SELF_HOLD_EFFECTS[cardId]}_target`, kind: "select_unit", validInstanceIds: ids, unitDestination: "power", placeAsDamage: true };
  }
  if (cardId === "RK-312") {
    // RK-312【ドッガ・サンダースラップ】「敵軍バトルエリアから、自分の手札の枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。」
    // （atwiki/page-1365）。手札の枚数はホールドした後の今の枚数。
    const handCount = state.players[playerId].hand.length;
    const ids = state.players[enemyId].battle
      .filter((c) => {
        const n = costNumber(state, c.cardId);
        return isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && Number.isFinite(n) && n <= handCount && selectableEnemy(state, playerId, "RK-312", c);
      })
      .map((c) => c.instanceId);
    if (ids.length === 0) return undefined;
    return { ...next, effectId: "rk312_dogga_thunder_slap_target", kind: "select_unit", validInstanceIds: ids, unitDestination: "discard" };
  }
  // RK-246「敵軍バトルエリアから相手の手札の枚数以下の必要パワーの数字を持つSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-959）
  const handCount = state.players[enemyId].hand.length;
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && Number.isFinite(n) && n <= handCount && selectableEnemy(state, playerId, "RK-246", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return undefined;
  return { ...next, effectId: "rk246_garulu_howling_slash_target", kind: "select_unit", validInstanceIds: ids, unitDestination: "power", placeAsDamage: true };
}

for (const [cardId, effectId] of Object.entries(SELF_HOLD_EFFECTS)) {
  CHOICE_RESOLVERS[effectId] = () => ({ error: "invalid_target" });
  CHOICE_SKIPPERS[effectId] = simpleSkip();
  CHOICE_CONFIRMERS[effectId] = (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const selfId = pending.sourceInstanceId;
    let next = close(state, pending);
    if (selfId && zoneOfField(next, playerId, selfId)) next = setHeld(next, playerId, new Set([selfId]));
    const follow = afterSelfHold(next, playerId, cardId, pending);
    const log = logFor(state, playerId, cardId, `${effectId}:hold`);
    if (!follow) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, follow), log };
  };
}

CHOICE_RESOLVERS["rk237_aqua_tornado_pick"] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = (["player1", "player2"] as const).find((pid) => state.players[pid].operation.some((c) => c.instanceId === instanceId));
  if (!owner) return { error: "invalid_target" };
  const op = state.players[owner].operation.find((c) => c.instanceId === instanceId)!;
  const stacked = (op.stackedCards ?? []).map(stripForZone);
  const next = patchPlayer(close(state, pending), owner, (p) => ({
    ...p,
    operation: p.operation.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, ...stacked],
    deck: shuffleCards([...p.deck, stripForZone(op)]),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-237", `rk237_aqua_tornado_pick:${cardName(state.definitions, op.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-238 キャッスルドラン【魂の捕獲】
// 「これが自軍エリアにある間、特徴「仮面ライダー」を持つユニットがユニットを撃破して捨札にしたとき、その特徴「仮面ライダー」を持つユニットの持ち主は
//  1枚ドローしてもよい。」（atwiki/page-941）
// - バトルで撃破して捨札にしたとき（バトルの相手のユニットが「仮面ライダー」）。どちらの場のキャッスルドランでも、どちらの仮面ライダーでもよい
//   （カード評価「相手も恩恵を受ける」）。キャッスルドラン1体ごとに1回。
// - BP0 以下のルールによる撃破は撃破したことにならない（atwiki/page-941 Q1）。効果による撃破の起点は記録していない（cardSpec の it.todo）。

export const CASTLE_DRAN_EFFECT_ID = "rk238_soul_capture";

export function openRk12CastleDoranDraw(
  state: GameState,
  event: { ownerPlayerId: PlayerId; instanceId: string; cardId: string; toZone: string; destroyed?: boolean; battleOpponentInstanceId?: string; phasePlayerId?: PlayerId },
): GameState {
  if (event.toZone !== "discard" || event.destroyed === false || !event.battleOpponentInstanceId) return state;
  if (!state.players[event.ownerPlayerId].discard.some((c) => c.instanceId === event.instanceId)) return state;
  const dorans = (["player1", "player2"] as const).flatMap((pid) => fieldCards(state, pid).filter((c) => isSameCardIdentity(c.cardId, "RK-238")));
  if (dorans.length === 0) return state;
  const riderId = event.battleOpponentInstanceId;
  let riderOwner: PlayerId | undefined;
  let features: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    const onField = findField(state, pid, riderId);
    if (onField) {
      riderOwner = pid;
      features = unitFeatures(state, pid, onField);
      break;
    }
    const gone = state.players[pid].discard.find((c) => c.instanceId === riderId);
    if (gone) {
      riderOwner = pid;
      features = getDefinition(state.definitions, gone.cardId)?.features ?? [];
      break;
    }
  }
  if (!riderOwner || !features.includes("仮面ライダー")) return state;
  if (state.players[riderOwner].deck.length === 0) return state;
  let next = state;
  const phasePlayerId = event.phasePlayerId ?? state.activePlayer;
  for (const d of dorans) {
    next = openOrQueue(next, confirmChoice({ playerId: riderOwner, phasePlayerId, sourceInstanceId: d.instanceId }, "RK-238", CASTLE_DRAN_EFFECT_ID));
  }
  return next;
}

CHOICE_RESOLVERS[CASTLE_DRAN_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[CASTLE_DRAN_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[CASTLE_DRAN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = requestDrawFromDeck(close(state, pending), playerId, pending.phasePlayerId, { count: 1, sourceCardId: "RK-238" }).state;
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-238", `${CASTLE_DRAN_EFFECT_ID}:draw`) };
};

// ---------------------------------------------------------------------------
// タッグの常駐（R-KW-TAG-01。太字部分の入れ替え・起動・「1度だけ」は rules/legend1/set8NamedEffectsA.ts）

function ownReleasedSmall(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => !c.commandHeld && rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
}

function faceUpPower(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
}

/** 太字部分の選択（frame の続きを引き継ぐ）。 */
function boldChoice(state: GameState, frame: PendingEffectChoice, effectId: string, kind: PendingEffectChoice["kind"], ids: string[], optional = false): GameState {
  return openEffectChoice(
    { ...state, pendingEffectChoice: undefined, activePlayer: frame.phasePlayerId },
    { ...frame, effectId, kind, validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional, mayConfirm: undefined },
  );
}

// RK-239 ウエイクアップ！
// 「自軍バトルフェイズ中、ホールド状態の自軍Sユニットがバトルエリアに出たとき、『自軍Sユニットを1体選びホールドする』を実行してもよい。
//  そうしたとき、バトルエリアに出たユニットをリリースする。」（atwiki/page-763）
// ホールド状態で出たかは、出たとき（進入の最初）に記録する（rk12MarkHeldEntry）。リリース状態で出て効果でホールドしたユニットは対象外（Q1）。

export const WAKE_UP_HOLD_EFFECT_ID = "rk239_wake_up_hold";
const WAKE_UP_ENTRY_RULE = "rk239_entered_held";

function wakeUpAfter(state: GameState, playerId: PlayerId, frame: PendingEffectChoice): ChoiceOutcome {
  const enteredId = frame.tagMeta?.rk239EnteredId;
  let next = close(state, frame);
  if (enteredId && zoneOfField(next, playerId, enteredId)) next = setHeld(next, playerId, new Set([enteredId]), false);
  return { state: proceed(next, frame), log: logFor(state, playerId, "RK-239", `rk239_wake_up:release`) };
}

registerTagResident("RK-239", {
  boldAvailable: (state, playerId) => ownReleasedSmall(state, playerId).length > 0,
  ownBold: (state, playerId, frame) => boldChoice(state, frame, WAKE_UP_HOLD_EFFECT_ID, "select_unit", ownReleasedSmall(state, playerId), true),
  after: (state, playerId, frame) => wakeUpAfter(state, playerId, frame),
});

CHOICE_RESOLVERS[WAKE_UP_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!zoneOfField(state, playerId, instanceId)) return { error: "invalid_target" };
  const held = setHeld(state, playerId, new Set([instanceId]));
  return wakeUpAfter({ ...held, pendingEffectChoice: pending }, playerId, pending);
};
CHOICE_SKIPPERS[WAKE_UP_HOLD_EFFECT_ID] = simpleSkip();

/**
 * 進入の最初（rules/combo.ts の1回目だけ）に、このモジュールが進入の効果で見るものを記録する（進入の効果は選択の後に続きから
 * やり直されるので、2度目に開かないよう記録を1回だけ使う）。
 * - RK-239: ホールド状態の自軍 S ユニットが自軍バトルフェイズに出た。
 * - RK-243: 自軍バトルフェイズに出た（コンビネーションの判定）。
 */
export function rk12MarkHeldEntry(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  let next = state;
  if (
    card.commandHeld &&
    isUnitCard(state, card.cardId) &&
    rk1IsSmallNow(state, card) &&
    state.players[playerId].operation.some((c) => isSameCardIdentity(c.cardId, "RK-239"))
  ) {
    next = addTurnPayload(next, playerId, WAKE_UP_ENTRY_RULE, "RK-239", { instanceId: card.instanceId });
  }
  if (isSameCardIdentity(card.cardId, "RK-243")) next = addTurnPayload(next, playerId, DRAGON_KICK_ENTRY_RULE, "RK-243", { instanceId: card.instanceId });
  return next;
}

const DRAGON_KICK_ENTRY_RULE = "rk243_entered";

function consumeHeldEntry(state: GameState, playerId: PlayerId, instanceId: string, ruleId = WAKE_UP_ENTRY_RULE): { state: GameState; found: boolean } {
  const player = state.players[playerId];
  const mods = getPlayerModifiers(player);
  const i = mods.findIndex(
    (m) => m.kind === "rule" && m.ruleId === ruleId && (m as { payload?: { instanceId?: string } }).payload?.instanceId === instanceId,
  );
  if (i < 0) return { state, found: false };
  return { state: patchPlayer(state, playerId, (p) => ({ ...p, modifiers: mods.filter((_, k) => k !== i) })), found: true };
}

function openWakeUp(state: GameState, playerId: PlayerId, enteredId: string): GameState {
  let next = state;
  for (const op of state.players[playerId].operation.filter((c) => isSameCardIdentity(c.cardId, "RK-239"))) {
    const entry = tagEntryChoice(next, playerId, op, { hostCardId: op.cardId, hostOpId: op.instanceId, rk239EnteredId: enteredId });
    if (!entry) continue;
    next = openOrQueue(next, { ...entry, optional: true });
  }
  return next;
}

// RK-242 クライマックス刑事
// 「自軍ラッシュフェイズごとに1度だけ、『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行してもよい。そうしたとき、このターン、特徴「イマジン」
//  を持つ自軍ユニットは、「これはバトルエリアに出たとき撃破される」と書かれていても、そのテキストは無効になり、特徴「警察」を追加される。」（atwiki/page-762）

export const CLIMAX_BOLD_EFFECT_ID = "rk242_climax_bold";

function climaxAfter(state: GameState, playerId: PlayerId, frame: PendingEffectChoice): ChoiceOutcome {
  let next = close(state, frame);
  next = addTurnPayload(next, playerId, IMAGIN_DESTROY_ON_ENTER_SUPPRESSED, "RK-242", { cardId: "RK-242" });
  next = addTurnPayload(next, playerId, RK12_CLIMAX_POLICE_RULE, "RK-242", { cardId: "RK-242" });
  return { state: proceed(next, frame), log: logFor(state, playerId, "RK-242", "rk242_climax:imagin_police") };
}

registerTagResident("RK-242", {
  boldAvailable: (state, playerId) => faceUpPower(state, playerId).length > 0,
  ownBold: (state, playerId, frame) => boldChoice(state, frame, CLIMAX_BOLD_EFFECT_ID, "select_power", faceUpPower(state, playerId)),
  after: (state, playerId, frame) => climaxAfter(state, playerId, frame),
});

CHOICE_RESOLVERS[CLIMAX_BOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
  return climaxAfter(next, playerId, pending);
};

// RK-244 ミッシングエース
// 「自軍ラッシュフェイズごとに1度だけ、『自分の手札から1枚選び捨札にする』を実行してもよい。そうしたとき、相手は自分自身の捨札にあるユニットカードと
//  同じカード名の自分自身のユニットを1体選び、撃破する。」（atwiki/page-932）
// 同じカード名: （2nd）等を除いた名前が同じもの。「※自軍Lユニットがなければ、これは「A＋B」としてつかえる」の A・B も同じ名前として扱う
// （atwiki/page-932 Q1。XG6-018 アバレキラーと RS-227 爆竜トップゲイラー）。

export const MISSING_ACE_BOLD_EFFECT_ID = "rk244_missing_ace_bold";
export const MISSING_ACE_DESTROY_EFFECT_ID = "rk244_missing_ace_destroy";

/** カードの名前と、使える別名（「※…これは「A＋B」としてつかえる」）。 */
function namesOf(state: GameState, ownerId: PlayerId, cardId: string): string[] {
  const d = getDefinition(state.definitions, cardId);
  if (!d) return [];
  const names = [d.name];
  const m = (d.text ?? "").match(/※(?:自軍Lユニットがなければ、)?これは「([^」]+)」としてつかえる/);
  if (m) {
    const ownL = fieldUnits(state, ownerId).some((c) => getDefinition(state.definitions, c.cardId)?.size === "L");
    if (!(fusionMaterialAliasRequiresNoOwnL(d.text) && ownL)) names.push(...m[1]!.split(/[＋+]/));
  }
  return names;
}

function missingAceTargets(state: GameState, victimId: PlayerId, userId: PlayerId): string[] {
  const discardNames = state.players[victimId].discard.filter((c) => isUnitCard(state, c.cardId)).flatMap((c) => namesOf(state, victimId, c.cardId));
  if (discardNames.length === 0) return [];
  return fieldUnits(state, victimId)
    // 選ぶのは相手自身（自分のユニット）。効果の発生源は相手の敵軍なので、ブレイカー等だけを確かめる（R-KW-BREAKER-03）。
    .filter(
      (u) =>
        namesOf(state, victimId, u.cardId).some((n) => discardNames.some((d) => sameCardName(n, d))) &&
        isSelectableByOpponentEffect(state, victimId, u.instanceId, "RK-244", userId),
    )
    .map((u) => u.instanceId);
}

function missingAceAfter(state: GameState, playerId: PlayerId, frame: PendingEffectChoice): ChoiceOutcome {
  const enemyId = opponent(playerId);
  const cleared = close(state, frame);
  const ids = missingAceTargets(cleared, enemyId, playerId);
  if (ids.length === 0) return { state: proceed(cleared, frame), log: logFor(state, playerId, "RK-244", "rk244_missing_ace:no_targets") };
  return {
    state: openNext(cleared, frame, {
      ...frame,
      playerId: enemyId,
      sourceCardId: "RK-244",
      effectId: MISSING_ACE_DESTROY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      mayConfirm: undefined,
      tagMeta: undefined,
      rk12Meta: { owner: playerId },
    }),
  };
}

registerTagResident("RK-244", {
  boldAvailable: (state, playerId) => state.players[playerId].hand.length > 0,
  ownBold: (state, playerId, frame) => boldChoice(state, frame, MISSING_ACE_BOLD_EFFECT_ID, "select_hand", state.players[playerId].hand.map((c) => c.instanceId)),
  after: (state, playerId, frame) => missingAceAfter(state, playerId, frame),
});

CHOICE_RESOLVERS[MISSING_ACE_BOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  return missingAceAfter(next, playerId, pending);
};

CHOICE_RESOLVERS[MISSING_ACE_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.rk12Meta?.owner ?? opponent(playerId);
  const ctx: BaseCtx = { playerId: owner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  const next = destroyAll(close(state, pending), ctx, "RK-244", "rk244_missing_ace_kill", [instanceId], pending.resumeChoice);
  return { state: next, log: logFor(state, playerId, "RK-244", `${MISSING_ACE_DESTROY_EFFECT_ID}:${instanceId}`) };
};

// RK-248 パラダイス・ロスト
// 「自軍ラッシュフェイズごとに1度だけ、『敵軍捨札から1枚選び、持ち主の手札に加える』を実行してもよい。そうしたとき、このターン、相手の常駐オペレーションは
//  無効になる。」（atwiki/page-951）。無効の判定は rules/rk/rk12Fields.ts rk12ResidentsNegated。

export const PARADISE_LOST_BOLD_EFFECT_ID = "rk248_paradise_lost_bold";

function paradiseAfter(state: GameState, playerId: PlayerId, frame: PendingEffectChoice): ChoiceOutcome {
  const next = addTurnPayload(close(state, frame), playerId, RK12_PARADISE_LOST_RULE, "RK-248", { cardId: "RK-248" });
  return { state: proceed(next, frame), log: logFor(state, playerId, "RK-248", "rk248_paradise_lost:residents_negated") };
}

registerTagResident("RK-248", {
  boldAvailable: (state, playerId) => state.players[opponent(playerId)].discard.length > 0,
  ownBold: (state, playerId, frame) =>
    boldChoice(state, frame, PARADISE_LOST_BOLD_EFFECT_ID, "select_unit", state.players[opponent(playerId)].discard.map((c) => c.instanceId)),
  after: (state, playerId, frame) => paradiseAfter(state, playerId, frame),
});

CHOICE_RESOLVERS[PARADISE_LOST_BOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, enemyId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  return paradiseAfter(next, playerId, pending);
};

// ---------------------------------------------------------------------------
// RK-240 仮面ライダー電王CF（2nd）【俺達の必殺技】
// 「自軍ターン中、これがバトルエリアに出たとき、本来の特徴に「イマジン」を持つ自軍バトルエリアのユニットの数を数えてもよい。そうしたとき、その数以下の
//  必要パワーを持つSユニットを、本来の特徴に「イマジン」を持つ自軍バトルエリアのユニットの数まで選び、持ち主のパワーゾーンに送る。」（atwiki/page-954）
// 選べる S ユニットは自軍・敵軍、エリアを問わない。「まで」— 1体選べば途中で確定できる（0体の下限の出典はない。cardSpec の it.todo）。

export const ORETACHI_EFFECT_ID = "rk240_oretachi";
export const ORETACHI_PICK_EFFECT_ID = "rk240_oretachi_pick";

function imaginCount(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].battle.filter((c) => isUnitCard(state, c.cardId) && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("イマジン")).length;
}

function oretachiTargets(state: GameState, playerId: PlayerId, count: number): string[] {
  return (["player1", "player2"] as const).flatMap((pid) =>
    fieldUnits(state, pid)
      .filter((c) => {
        const n = costNumber(state, c.cardId);
        return rk1IsSmallNow(state, c) && Number.isFinite(n) && n <= count && (pid === playerId || selectableEnemy(state, playerId, "RK-240", c));
      })
      .map((c) => c.instanceId),
  );
}

function applyOretachi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk240:enemy_turn" };
  const count = imaginCount(state, ctx.playerId);
  if (count <= 0 || oretachiTargets(state, ctx.playerId, count).length === 0) return { state, detail: "rk240:no_targets" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-240", ORETACHI_EFFECT_ID, { rk12Meta: { count } })), detail: ORETACHI_EFFECT_ID };
}

CHOICE_RESOLVERS[ORETACHI_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[ORETACHI_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[ORETACHI_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const count = imaginCount(cleared, playerId);
  const ids = oretachiTargets(cleared, playerId, count);
  const log = logFor(state, playerId, "RK-240", `${ORETACHI_EFFECT_ID}:${count}`);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...pending, effectId: ORETACHI_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: count, optional: false, mayConfirm: undefined, rk12Meta: { count } }),
    log,
  };
};

function finishOretachi(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  let next = close(state, pending);
  for (const id of selected) {
    if (!(["player1", "player2"] as const).some((pid) => zoneOfField(next, pid, id))) continue;
    const left = applyUnitLeave(next, id, "power", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-240", `${ORETACHI_PICK_EFFECT_ID}:${selected.length}`) };
}

CHOICE_RESOLVERS[ORETACHI_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (selected.length < (pending.rk12Meta?.count ?? 1) && remaining.length > 0) {
    // 1体選んだら、そこで確定してもよい（「…の数まで選び」）。
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining, mayConfirm: true } } };
  }
  return finishOretachi(state, playerId, pending, selected);
};
CHOICE_CONFIRMERS[ORETACHI_PICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finishOretachi(state, playerId, pending, pending.selectedInstanceIds ?? []);
};

// ---------------------------------------------------------------------------
// RK-241 仮面ライダーミニ電王SF【ムリヤリな変身】
// 「これが撃破されて捨札になったとき、自軍捨札から「モモタロス」のカードを1枚選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-958）
// 「モモタロス」のカード: （2nd）等を除いたカード名が「モモタロス」（カード評価「モモタロス（2nd）は…」）。

export const MURIYARI_EFFECT_ID = "rk241_muriyari";

function applyMuriyari(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].discard
    .filter((c) => isUnitCard(state, c.cardId) && sameCardName(getDefinition(state.definitions, c.cardId)?.name, "モモタロス"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk241:no_momotaros" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-241"), effectId: MURIYARI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: MURIYARI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[MURIYARI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: rushPicked(state, pending, instanceId, "discard", { requireConditions: false }), log: logFor(state, playerId, "RK-241", `${MURIYARI_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[MURIYARI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// ユニットがバトルエリアに出たとき（rules/combo.ts の進入効果から呼ぶ）
// - RK-239 ウエイクアップ！（ホールド状態で出た自軍 S ユニット。出たときに記録したもの）
// - RK-243 仮面ライダーリュウガ【ドラゴンライダーキック】「特徴「ドラゴン」を持つユニットからコンビネーションしたとき発動できる⇒敵軍バトルエリアから、
//   ナンバーを持たない敵軍Sユニットを1体選び撃破する。」（atwiki/page-1010）。直前に出たユニット（左隣）が「ドラゴン」（R-CN-05）。
//   ナンバーが RC のユニットはナンバーを持つものとして扱う（cardSpec の it.todo）。

function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

export function tryRk12OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  let next = state;
  const held = consumeHeldEntry(next, playerId, card.instanceId);
  if (held.found) next = openWakeUp(held.state, playerId, card.instanceId);
  const dragon = consumeHeldEntry(next, playerId, card.instanceId, DRAGON_KICK_ENTRY_RULE);
  if (dragon.found && next.phase === "battle" && next.activePlayer === playerId) {
    next = dragon.state;
    const partner = comboPartner(next, battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId));
    if (partner && unitFeatures(next, playerId, partner).includes("ドラゴン")) {
      const enemyId = opponent(playerId);
      const ids = next.players[enemyId].battle
        .filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && !hasNumber(next, c.cardId) && selectableEnemy(next, playerId, "RK-243", c))
        .map((c) => c.instanceId);
      if (ids.length > 0) {
        next = openOrQueue(next, {
          ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "RK-243"),
          effectId: "rk243_dragon_rider_kick",
          kind: "select_unit",
          validInstanceIds: ids,
          selectCount: 1,
          optional: true,
          unitDestination: "discard",
        });
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-250 サバイブ（オペレーション）
// 「WBを持ち、特徴「サバイブ」を持たない自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。
//  このカードに重ねたユニットは、BP+1500され、特徴「サバイブ」が追加される。また、重ねたユニットがユニットでなくなるとき、このカードを捨札にして
//  その場に留める。」（atwiki/page-1350）
// RK-173 鬼の鎧と同じく、このカードは選んだユニットの下に重ねる（ユニットの stackedCards）。BP・特徴は rules/rk/rk12Fields.ts。
// 留まるのは撃破・パワーゾーン送り・効果で捨札にするとき（rules/operationCounters.ts tryLeaveField）。ユニットの下に重ねた他のオペレーション
// （鬼の鎧等）の「ユニットでなくなるとき」と同時なら、ターンプレイヤーが順番を選ぶ（atwiki/page-1350 Q1）。

export const SURVIVE_EFFECT_ID = "rk250_survive";
export const SURVIVE_ORDER_EFFECT_ID = "rk250_survive_order";

function applySurvive(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter(
      (c) =>
        rk1IsSmallNow(state, c) &&
        unitEffectiveCategories(state, ctx.playerId, c, zoneOfField(state, ctx.playerId, c.instanceId) ?? "rush").includes("WB") &&
        !unitFeatures(state, ctx.playerId, c).includes("サバイブ"),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk250:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RK-250"),
      effectId: SURVIVE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: SURVIVE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SURVIVE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${pending.sourceCardId}:op`, cardId: pending.sourceCardId };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle), discard: p.discard.filter((c) => c.instanceId !== opCard.instanceId), hand: p.hand.filter((c) => c.instanceId !== opCard.instanceId) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-250", `${SURVIVE_EFFECT_ID}:${instanceId}`) };
};

/** 重ねた「ユニットでなくなるとき」に捨札になる他のオペレーション（鬼の鎧等）。 */
function otherLeaveOps(unit: CardInstance): CardInstance[] {
  return (unit.stackedCards ?? []).filter((c) => !isSameCardIdentity(c.cardId, SURVIVE_CARD_ID) && isStackedUnderUnitOperation(c.cardId));
}

function discardStacked(state: GameState, ownerId: PlayerId, unitId: string, stackedId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    let removed: CardInstance | undefined;
    const take = (cards: CardInstance[]) =>
      cards.map((c) => {
        if (c.instanceId !== unitId) return c;
        removed = (c.stackedCards ?? []).find((s) => s.instanceId === stackedId);
        return { ...c, stackedCards: (c.stackedCards ?? []).filter((s) => s.instanceId !== stackedId) };
      });
    const battle = take(p.battle);
    const rush = take(p.rush);
    if (!removed) return p;
    return { ...p, battle, rush, discard: [...p.discard, stripForZone(removed)] };
  });
}

/** サバイブを捨札にしてその場に留める。 */
function finishSurviveStay(state: GameState, intent: PendingLeave): GameState {
  const unit = findField(state, intent.ownerPlayerId, intent.instanceId);
  const survive = (unit?.stackedCards ?? []).find((c) => isSameCardIdentity(c.cardId, SURVIVE_CARD_ID));
  if (!unit || !survive) return state;
  let next = discardStacked(state, intent.ownerPlayerId, intent.instanceId, survive.instanceId);
  next = {
    ...next,
    log: [...next.log, buildLogEntry(intent.ownerPlayerId, "named_effect", "RK-250", state.definitions, "survive_stay")],
  };
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
}

/**
 * 「重ねたユニットがユニットでなくなるとき、このカードを捨札にしてその場に留める。」（rules/operationCounters.ts tryLeaveField から呼ぶ）。
 * 処理したら state、対象外なら null。
 */
export function openRk12SurviveStay(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.toZone === "battle") return null;
  const unit = state.players[intent.ownerPlayerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || surviveCount(unit) === 0) return null;
  const others = otherLeaveOps(unit);
  if (others.length === 0) return finishSurviveStay(state, intent);
  // 順番の選択は、ほかの選択が開いていないときだけ開く（開いていればサバイブを先に解決する）。
  if (state.pendingEffectChoice) return finishSurviveStay(state, intent);
  const survive = (unit.stackedCards ?? []).find((c) => isSameCardIdentity(c.cardId, SURVIVE_CARD_ID))!;
  const chooser = state.activePlayer;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: chooser,
      phasePlayerId: intent.phasePlayerId,
      effectId: SURVIVE_ORDER_EFFECT_ID,
      sourceCardId: "RK-250",
      sourceInstanceId: survive.instanceId,
      kind: "select_unit",
      validInstanceIds: [survive.instanceId, ...others.map((c) => c.instanceId)],
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      rk12Meta: { intent },
    },
    activePlayer: chooser,
  };
}

CHOICE_RESOLVERS[SURVIVE_ORDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.rk12Meta?.intent;
  if (!intent) return { error: "invalid_target" };
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const log = logFor(state, playerId, "RK-250", `${SURVIVE_ORDER_EFFECT_ID}:${instanceId}`);
  if (instanceId === pending.sourceInstanceId) return { state: finishSurviveStay(next, intent), log };
  // 先に解決した「ユニットでなくなるとき」のオペレーション（鬼の鎧等）は捨札になる。残りはもう一度順番を選ぶ。
  next = discardStacked(next, intent.ownerPlayerId, intent.instanceId, instanceId);
  const reopened = openRk12SurviveStay(next, intent);
  return { state: reopened ?? next, log };
};

// ---------------------------------------------------------------------------
// RK-251 ゴルゴムの仕業（※カウンター）
// 「相手が通常のオペレーションカードを使用したとき、その効果を実行する前に発動できる。相手の使用したオペレーションカードの必要パワーの数字を見て、その
//  数字以上の枚数のカードが自軍パワーゾーンにあれば、そのオペレーションカードの効果を無効にして、捨札にする。」（atwiki/page-1377）
// - 「通常のオペレーション」は「※常駐」「※カウンター」等のアイコンの無いオペレーション（Q1）。
// - 自軍パワーゾーンのカード（オモテ・ウラとも）の枚数が足りるときだけ使う機会を与える（足りなければ効果がない）。
// - 使うときは DA のリリース状態の自軍コマンドを1つホールドする（カウンターの支払い）。
// 使わなければ、そのオペレーションの使用（play_operation）をそのまま続ける（core/applyAction.ts の後処理 rk12ResumeOperation）。

export const GORGOM_EFFECT_ID = "rk251_gorgom";

export type Rk12PlayOperation = { playerId: PlayerId; instanceId: string; targetInstanceId?: string; extraInstanceId?: string };

function isNormalOperation(text: string | undefined): boolean {
  return !/※(常駐|カウンター)/.test((text ?? "").normalize("NFKC"));
}

function releasedDaCommand(state: GameState, playerId: PlayerId): CardInstance | undefined {
  const p = state.players[playerId];
  return p.command.find((c) => !c.commandHeld && effectiveCommandCategories(p, state.definitions, c.cardId).includes("DA"));
}

/**
 * play_operation の効果の実行前（手札にあるうち）に呼ぶ。相手がゴルゴムの仕業を使えるなら選択を開いた state、対象外なら null。
 */
export function openRk12GorgomWindow(state: GameState, action: Rk12PlayOperation, cardId: string): GameState | null {
  if (state.rk12GorgomPassedOp === action.instanceId) return null;
  const d = getDefinition(state.definitions, cardId);
  if (d?.type !== "operation" || !isNormalOperation(d.text)) return null;
  const enemyId = opponent(action.playerId);
  const enemy = state.players[enemyId];
  const gorgom = enemy.hand.find((c) => isSameCardIdentity(c.cardId, "RK-251"));
  if (!gorgom) return null;
  const gd = getDefinition(state.definitions, gorgom.cardId);
  if (!gd || !canPlayOperationExceptCommandHold(state, enemyId, gd)) return null;
  if (state.counterLockedPlayerId === enemyId) return null;
  if (!releasedDaCommand(state, enemyId)) return null;
  const n = costNumber(state, cardId);
  if (enemy.power.length < (Number.isFinite(n) ? n : 0)) return null;
  return openEffectChoice(state, {
    playerId: enemyId,
    phasePlayerId: action.playerId,
    effectId: GORGOM_EFFECT_ID,
    sourceCardId: "RK-251",
    sourceInstanceId: gorgom.instanceId,
    kind: "confirm",
    validInstanceIds: [],
    selectedInstanceIds: [],
    optional: true,
    mayConfirm: true,
    rk12Meta: { operation: action, target: action.instanceId },
  });
}

CHOICE_RESOLVERS[GORGOM_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[GORGOM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const op = pending.rk12Meta?.operation;
  const next: GameState = { ...close(state, pending), rk12ResumeOperation: op, rk12GorgomPassedOp: op?.instanceId };
  return { state: next, log: skipLog(state, playerId, "RK-251", GORGOM_EFFECT_ID) };
};
CHOICE_CONFIRMERS[GORGOM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const op = pending.rk12Meta?.operation;
  let next = close(state, pending);
  const cmd = releasedDaCommand(next, playerId);
  if (!op || !cmd) return { error: "invalid_target" };
  const gorgomId = pending.sourceInstanceId!;
  next = patchPlayer(next, playerId, (p) => {
    const g = p.hand.find((c) => c.instanceId === gorgomId);
    return {
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== gorgomId),
      discard: g ? [...p.discard, stripForZone(g)] : p.discard,
      command: p.command.map((c) => (c.instanceId === cmd.instanceId ? { ...c, commandHeld: true, paymentHeld: true } : c)),
    };
  });
  // 相手の使用したオペレーションは効果を実行せず捨札になる。
  next = patchPlayer(next, op.playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === op.instanceId);
    return card ? { ...p, hand: p.hand.filter((c) => c.instanceId !== op.instanceId), discard: [...p.discard, stripForZone(card)] } : p;
  });
  return {
    state: next,
    log: buildLogEntry(playerId, "play_counter", "RK-251", state.definitions, `negate:${cardName(state.definitions, state.players[op.playerId].hand.find((c) => c.instanceId === op.instanceId)?.cardId ?? op.instanceId)}`),
  };
};

// ---------------------------------------------------------------------------
// RK-252 変身音叉 音角（オペレーション）
// 「次の効果から1つ選び発動する⇒ ◎自分の手札から、「仮面ライダー響鬼」のカードを1枚選び、自軍ラッシュエリアに出してもよい。 ◎敵軍山札の上から1枚を
//  オモテにする。このカードを使用するためにホールドしたコマンドが特徴「ディスクアニマル」を持つなら、自分は1枚ドローする。その後、オモテにしたカードは
//  持ち主の山札の上に戻す。」（atwiki/page-1339）
// 使用のためにホールドしたコマンドは、支払いの記録（state.rk12OpPaid。core/applyAction.ts）で見る。

export const ONKAKU_EFFECT_ID = "rk252_onkaku";
export const ONKAKU_HIBIKI_EFFECT_ID = "rk252_onkaku_hibiki";
const ONKAKU_MODES = ["hibiki_rush", "reveal_draw"];

function applyOnkaku(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const paid = state.rk12OpPaid && state.rk12OpPaid.instanceId === ctx.operationInstanceId ? state.rk12OpPaid.commandIds : [];
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RK-252"),
      effectId: ONKAKU_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: ONKAKU_MODES,
      selectCount: 1,
      optional: false,
      rk12Meta: { paid },
    }),
    detail: ONKAKU_EFFECT_ID,
  };
}

function paidHasFeature(state: GameState, playerId: PlayerId, ids: string[], feature: string): boolean {
  const p = state.players[playerId];
  return ids.some((id) => {
    const card = [...p.command, ...p.battle, ...p.rush].find((c) => c.instanceId === id);
    return !!card && (getDefinition(state.definitions, card.cardId)?.features ?? []).includes(feature);
  });
}

CHOICE_RESOLVERS[ONKAKU_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  if (mode === "hibiki_rush") {
    const ids = cleared.players[playerId].hand
      .filter((c) => isUnitCard(cleared, c.cardId) && sameCardName(getDefinition(cleared.definitions, c.cardId)?.name, "仮面ライダー響鬼"))
      .map((c) => c.instanceId);
    const log = logFor(state, playerId, "RK-252", `${ONKAKU_EFFECT_ID}:hibiki_rush`);
    if (ids.length === 0) return { state: proceed(cleared, pending), log };
    return { state: openNext(cleared, pending, { ...pending, effectId: ONKAKU_HIBIKI_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, selectedInstanceIds: [], optional: true }), log };
  }
  const enemyId = opponent(playerId);
  const top = cleared.players[enemyId].deck[0];
  let next = cleared;
  const draw = paidHasFeature(cleared, playerId, pending.rk12Meta?.paid ?? [], "ディスクアニマル");
  if (draw) next = requestDrawFromDeck(next, playerId, pending.phasePlayerId, { count: 1, sourceCardId: "RK-252" }).state;
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, "RK-252", `${ONKAKU_EFFECT_ID}:reveal:${top ? cardName(state.definitions, top.cardId) : "none"}:${draw ? "draw" : "no_draw"}`),
  };
};

CHOICE_RESOLVERS[ONKAKU_HIBIKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: rushPicked(state, pending, instanceId, "hand", { requireConditions: false }), log: logFor(state, playerId, "RK-252", `${ONKAKU_HIBIKI_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[ONKAKU_HIBIKI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// このターン、ユニットがホールドされたかの記録（RK-240 の※・RK-247 の※）。アクションの前後で、場にあったユニットがリリース状態から
// ホールド状態になったら、その持ち主の記録に残す（コマンドとしてのホールド・効果でのホールドとも。ホールド状態で場に出たものは含めない）。

export function trackRk12UnitHolds(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const prev = new Map(fieldCards(before, pid).map((c) => [c.instanceId, c] as const));
    const already = new Set(rk12TurnPayloads<{ instanceId?: string }>(next, pid, RK12_UNIT_HELD_RULE).map((p) => p.instanceId));
    for (const card of fieldCards(after, pid)) {
      if (!card.commandHeld || already.has(card.instanceId)) continue;
      const was = prev.get(card.instanceId);
      if (!was || was.commandHeld) continue;
      if (!isUnitCard(after, card.cardId)) continue;
      next = addTurnPayload(next, pid, RK12_UNIT_HELD_RULE, card.cardId, { instanceId: card.instanceId, cardId: card.cardId, features: unitFeatures(after, pid, card) });
      already.add(card.instanceId);
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK12_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-233::hyper_rider_kick": applyHyperKick,
  "RK-234::shoulder_tackle": applyShoulderTackle,
  "RK-235::avalanche_crash": applyAvalancheCrash,
  "RK-237::aqua_tornado": applySelfHold("RK-237"),
  "RK-240::oretachi": applyOretachi,
  "RK-241::muriyari": applyMuriyari,
  "RK-245::darkness_moon_break": applySelfHold("RK-245"),
  "RK-246::garulu_howling_slash": applySelfHold("RK-246"),
  "RK-250::survive": applySurvive,
  "RK-252::onkaku": applyOnkaku,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-232::kaen": noop("rk232:start_return"),
  "RK-236::negataros": noop("rk236:on_enemy_rush"),
  "RK-238::soul_capture": noop("rk238:on_destroy"),
  "RK-240::sp1_hold_turn": noop("rk240:sp"),
  "RK-243::dragon_rider_kick": noop("rk243:combo"),
  "RK-245::rush_hold": noop("rk245:rush_placement"),
  "RK-246::faceup_bp": noop("rk246:bp"),
  "RK-247::hold_turn_entry": noop("rk247:entry"),
  "RK-247::provocation": noop("rk247:must_enter"),
  "RK-251::gorgom": noop("rk251:operation_window"),
};

export function tryRk12CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK12_KEYWORD_PREFIX)) return null;
  const handler = RK12_KEYWORDS[keyword.slice(RK12_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
