/**
 * ザ・マスクドライダーEXP vol.3 RK-211〜RK-231（仮面ライダーブレイドJF〜オロチ）のカード固有の効果（cardSpec RK11-211-231 の監査）。
 *
 * - `tryRk11CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk11::cardId::name`。NC・RC・バトルエリアに出たとき）。
 * - `tryResolveRk11Choice` / `trySkipRk11Choice` / `tryConfirmRk11Choice`: このモジュールが開いた選択の解決。撃破・ダメージにする選択の一部は
 *   汎用の選択（unitDestination "discard"／"power"）で解決する（rules/pendingChoices.ts）。
 * - `openRk11UndeadReplace`: RK-215【スペード2―スラッシュ】・RK-216【ハート4―フロート】（core/applyAction.ts のラッシュの手続きから呼ぶ。RK-130 と同じ）。
 * - `openRk11UndeadMasterOnRush`: RK-220【アンデッドを従える者】（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。
 * - `rk11IbukiOnEntry`: RK-223 の（）書き（特徴「猛士」を持つユニットからコンビネーションするとき。rules/battleEntry.ts）。
 * - `collectRk11TurnEndQueue` / `openRk11TurnEndEntry`: RK-216・RK-218・RK-221・RK-222 で得た「ターンを終えるとき」（rules/turnEndingEffects.ts）。
 * 継続効果の判定（RK-215 の BP・SP1・RK-217・RK-220・RK-224・RK-225・RK-217／218 の※）は rules/rk/rk11Fields.ts。構成は rules/rk/rk10UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveCommandCategories, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import { countAvailablePower } from "../../core/power";
import { checkWinner } from "../../core/createGame";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice, requestDrawFromDeck } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { markRushedThisTurn } from "../turnModifiers";
import { emitUnitRushedAndFinalize } from "../../events/emitUnitRushed";
import { applyDamageToPlayer } from "../damagePayment";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { rk1IsSmallNow } from "./rk1Features";
import {
  RK11_DRAGONFLY_RULE,
  RK11_LIZARD_RULE,
  RK11_PEACOCK_DESTROY_RULE,
  RK11_RELEASE_AT_END_RULE,
  RK11_SP1_RULE,
  rk11TurnPayloads,
} from "./rk11Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK11_KEYWORD_PREFIX = "rk11::";

export function isRk11ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk11Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk11Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認）。 */
export function canConfirmRk11Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm";
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk11Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk11Choice(pending)) return { error: "no_selection" };
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
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
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
  return { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId };
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

function sameCategories(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((c) => b.includes(c));
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

/** 場のユニットを取り除く（重ねていたカードは捨札）。 */
function takeUnitOff(state: GameState, ownerId: PlayerId, instanceId: string): { state: GameState; card: CardInstance } | null {
  const zone = zoneOfField(state, ownerId, instanceId);
  if (!zone) return null;
  const card = state.players[ownerId][zone].find((c) => c.instanceId === instanceId)!;
  const stacked = (card.stackedCards ?? []).map(stripForZone);
  const next = patchPlayer(state, ownerId, (pl) => ({
    ...pl,
    [zone]: pl[zone].filter((c) => c.instanceId !== instanceId),
    discard: [...pl.discard, ...stacked],
  }));
  return { state: next, card: stripForZone(card) };
}

/** ids のユニットをすべて撃破する（全員を選んだ確定済みの撃破の選択で処理する）。resume は撃破の後に開く。 */
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

/** 撃破の後に続ける処理（step）。撃破で割り込みが開かなければすぐ実行する。 */
function destroyThen(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], step: PendingEffectChoice): GameState {
  const next = destroyAll(state, ctx, sourceCardId, effectId, ids, step);
  if (next.pendingEffectChoice?.effectId === step.effectId) {
    const out = CHOICE_CONFIRMERS[step.effectId]!(next, step.playerId);
    return "error" in out ? next : out.state;
  }
  return next;
}

/** 1枚ずつ選んで count 枚そろったら done を呼ぶ選択の解決。 */
function accumulate(count: number, done: (state: GameState, playerId: PlayerId, pending: PendingEffectChoice, selected: string[]) => ChoiceOutcome): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    if (selected.length < count) {
      return {
        state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)), optional: false } },
      };
    }
    return done(state, playerId, pending, selected);
  };
}

/** 「ターンを終えるときホールド状態なら、リリースしてもよい」を得る（RK-221・RK-222）＋このターン「SP1」。 */
function grantSp1AndRelease(state: GameState, playerId: PlayerId, instanceId: string | undefined, cardId: string): GameState {
  if (!instanceId || !zoneOfField(state, playerId, instanceId)) return state;
  let next = addTurnPayload(state, playerId, RK11_SP1_RULE, cardId, { instanceId });
  next = addTurnPayload(next, playerId, RK11_RELEASE_AT_END_RULE, cardId, { instanceId, cardId });
  return next;
}

// ---------------------------------------------------------------------------
// RK-211 仮面ライダーブレイドJF【ライトニングスラッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札を2枚選び、相手に見せてもよい。そうしたとき、見せたカードの持つカテゴリがすべて同じなら、
//  必要パワーを満たしていない敵軍ユニットを1体選び撃破する。そうして撃破したユニットの本来のSPが1以上なら、そのSPと同じ数だけ、相手にダメージを
//  与える。」（atwiki/page-1078）
// - 「必要パワーを満たしていない」: 必要パワーの数字が、持ち主の今のパワー（パワーゾーン＋相手コマンドゾーンのマルチカテゴリ。R-CAT-02）より大きい
//   （カード評価「マルチカテゴリの自軍コマンドも含まれる」）。サイズ・エリアを問わない（カード評価）。
// - 本来の SP は印刷の数値の SP（「－」・「！」は0。分数 SP の扱いは cardSpec の it.todo）。

export const LIGHTNING_EFFECT_ID = "rk211_lightning_slash";
export const LIGHTNING_DESTROY_EFFECT_ID = "rk211_lightning_slash_destroy";
const LIGHTNING_DAMAGE_EFFECT_ID = "rk211_lightning_slash_damage";

function applyLightningSlash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk211:enemy_turn" };
  const hand = state.players[ctx.playerId].hand;
  if (hand.length < 2) return { state, detail: "rk211:hand_short" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-211"), effectId: LIGHTNING_EFFECT_ID, kind: "select_hand", validInstanceIds: hand.map((c) => c.instanceId), selectCount: 2, optional: true }),
    detail: LIGHTNING_EFFECT_ID,
  };
}

function printedSp(state: Pick<GameState, "definitions">, cardId: string): number {
  const sp = getDefinition(state.definitions, cardId)?.sp;
  return typeof sp === "number" ? sp : 0;
}

CHOICE_RESOLVERS[LIGHTNING_EFFECT_ID] = accumulate(2, (state, playerId, pending, selected) => {
  const hand = state.players[playerId].hand;
  const shown = selected.map((id) => hand.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
  const log = logFor(state, playerId, "RK-211", `${LIGHTNING_EFFECT_ID}:${shown.map((c) => cardName(state.definitions, c.cardId)).join(",")}`);
  const cleared = close(state, pending);
  const cats = shown.map((c) => categoriesOfCard(state, c.cardId));
  if (shown.length < 2 || !cats.every((c) => sameCategories(c, cats[0]!))) return { state: proceed(cleared, pending), log };
  const enemyId = opponent(playerId);
  const power = countAvailablePower(cleared, enemyId);
  const ids = fieldUnits(cleared, enemyId)
    .filter((c) => {
      const n = costNumber(cleared, c.cardId);
      return Number.isFinite(n) && n > power && selectableEnemy(cleared, playerId, "RK-211", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...pending, effectId: LIGHTNING_DESTROY_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false }),
    log,
  };
});
CHOICE_SKIPPERS[LIGHTNING_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[LIGHTNING_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = fieldCards(state, enemyId).find((c) => c.instanceId === instanceId);
  const sp = target ? printedSp(state, target.cardId) : 0;
  const step: PendingEffectChoice = { ...confirmChoice(pending, "RK-211", LIGHTNING_DAMAGE_EFFECT_ID), optional: false, rk11Meta: { remaining: sp, target: instanceId }, resumeChoice: pending.resumeChoice };
  const next = destroyThen(close(state, pending), pending, "RK-211", "rk211_lightning_slash_kill", [instanceId], step);
  return { state: next, log: logFor(state, playerId, "RK-211", `${LIGHTNING_DESTROY_EFFECT_ID}:${target ? cardName(state.definitions, target.cardId) : instanceId}`) };
};

CHOICE_RESOLVERS[LIGHTNING_DAMAGE_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[LIGHTNING_DAMAGE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const enemyId = opponent(playerId);
  const target = pending.rk11Meta?.target;
  const sp = pending.rk11Meta?.remaining ?? 0;
  // 「そうして撃破した」: 撃破されて場を離れたときだけ。
  if (target && !zoneOfField(next, enemyId, target) && sp >= 1) {
    next = applyDamageToPlayer(next, enemyId, sp, { kind: "none", activePlayer: pending.phasePlayerId });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-211", `${LIGHTNING_DAMAGE_EFFECT_ID}:${sp}`) };
};

// ---------------------------------------------------------------------------
// RK-212 仮面ライダーラルク【レイバレット】（NC）
// 「ホールド状態の敵軍Sユニットを2体選んでもよい。そうしたとき、選んだ2体の持つカテゴリが違うなら、相手はそのどちらか1体を選び撃破する。」
// （atwiki/page-930）。エリアを問わない（カード評価「ラッシュエリアのユニットも除去できる」）。カテゴリはそのエリアでのカテゴリの組で比べる。

export const RAY_BULLET_EFFECT_ID = "rk212_ray_bullet";
export const RAY_BULLET_ANSWER_EFFECT_ID = "rk212_ray_bullet_answer";

function applyRayBullet(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-212", c))
    .map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "rk212:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-212"), effectId: RAY_BULLET_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 2, optional: true }),
    detail: RAY_BULLET_EFFECT_ID,
  };
}

function fieldCategories(state: GameState, ownerId: PlayerId, instanceId: string): string[] {
  const zone = zoneOfField(state, ownerId, instanceId);
  const card = zone ? state.players[ownerId][zone].find((c) => c.instanceId === instanceId) : undefined;
  return card && zone ? [...unitEffectiveCategories(state, ownerId, card, zone)] : [];
}

CHOICE_RESOLVERS[RAY_BULLET_EFFECT_ID] = accumulate(2, (state, playerId, pending, selected) => {
  const enemyId = opponent(playerId);
  const log = logFor(state, playerId, "RK-212", `${RAY_BULLET_EFFECT_ID}:${selected.join(",")}`);
  const cleared = close(state, pending);
  const [a, b] = selected as [string, string];
  if (sameCategories(fieldCategories(cleared, enemyId, a), fieldCategories(cleared, enemyId, b))) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, {
      ...pending,
      playerId: enemyId,
      effectId: RAY_BULLET_ANSWER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: selected,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      rk11Meta: { owner: playerId },
    }),
    log,
  };
});
CHOICE_SKIPPERS[RAY_BULLET_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[RAY_BULLET_ANSWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.rk11Meta?.owner ?? opponent(playerId);
  const ctx: BaseCtx = { playerId: owner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  const next = destroyAll(close(state, pending), ctx, "RK-212", "rk212_ray_bullet_destroy", [instanceId], pending.resumeChoice);
  return { state: next, log: logFor(state, playerId, "RK-212", `${RAY_BULLET_ANSWER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-213 仮面ライダーグレイブ【グラビティスラッシュ】（NC）
// 「「SP1」敵軍コマンドのカテゴリの数を数えてもよい。（コマンドがなければ0と数える）そうしたとき、その数以下の必要パワーの数字を持つユニットを
//  敵軍バトルエリアから1体選び撃破する。」（atwiki/page-899）。数えるのはカテゴリの種類の数（コメント欄）。サイズを問わない。
//  「数えてもよい」の任意は、撃破するユニットの選択を見送れることで表す。

function applyGravitySlash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const kinds = new Set(enemy.command.flatMap((c) => effectiveCommandCategories(enemy, state.definitions, c.cardId)));
  const ids = enemy.battle
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return isUnitCard(state, c.cardId) && Number.isFinite(n) && n <= kinds.size && selectableEnemy(state, ctx.playerId, "RK-213", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk213:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-213"), effectId: "rk213_gravity_slash", kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "discard" }),
    detail: "rk213_gravity_slash",
  };
}

// ---------------------------------------------------------------------------
// RK-214 仮面ライダーランス【インパクトスタッブ】（NC）
// 「敵軍バトルエリアのSユニットを2体選んでもよい。そうしたとき、相手は次のようにする⇒選ばれたユニットのうち1体を撃破する。その後、もう1体を
//  ホールドする。」（atwiki/page-931）。ホールド状態のユニットも選べ、相手はどちらを撃破してもよい（grnrngr/faq-rider-3 RK-214）。

export const IMPACT_STAB_EFFECT_ID = "rk214_impact_stab";
export const IMPACT_STAB_ANSWER_EFFECT_ID = "rk214_impact_stab_answer";
const IMPACT_STAB_HOLD_EFFECT_ID = "rk214_impact_stab_hold";

function applyImpactStab(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-214", c))
    .map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "rk214:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-214"), effectId: IMPACT_STAB_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 2, optional: true }),
    detail: IMPACT_STAB_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[IMPACT_STAB_EFFECT_ID] = accumulate(2, (state, playerId, pending, selected) => {
  const cleared = close(state, pending);
  return {
    state: openNext(cleared, pending, {
      ...pending,
      playerId: opponent(playerId),
      effectId: IMPACT_STAB_ANSWER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: selected,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      rk11Meta: { owner: playerId },
    }),
    log: logFor(state, playerId, "RK-214", `${IMPACT_STAB_EFFECT_ID}:${selected.join(",")}`),
  };
});
CHOICE_SKIPPERS[IMPACT_STAB_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[IMPACT_STAB_ANSWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.rk11Meta?.owner ?? opponent(playerId);
  const other = pending.validInstanceIds.find((id) => id !== instanceId);
  const ctx: BaseCtx = { playerId: owner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  const step: PendingEffectChoice = { ...confirmChoice(ctx, "RK-214", IMPACT_STAB_HOLD_EFFECT_ID), optional: false, rk11Meta: { target: other }, resumeChoice: pending.resumeChoice };
  const next = destroyThen(close(state, pending), ctx, "RK-214", "rk214_impact_stab_destroy", [instanceId], step);
  return { state: next, log: logFor(state, playerId, "RK-214", `${IMPACT_STAB_ANSWER_EFFECT_ID}:${instanceId}`) };
};

CHOICE_RESOLVERS[IMPACT_STAB_HOLD_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[IMPACT_STAB_HOLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const other = pending.rk11Meta?.target;
  let next = close(state, pending);
  if (other) next = setHeld(next, opponent(playerId), new Set([other]));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-214", `${IMPACT_STAB_HOLD_EFFECT_ID}:${other ?? ""}`) };
};

// ---------------------------------------------------------------------------
// RK-215 リザードアンデッド【スペード2―スラッシュ】・RK-216 ドラゴンフライアンデッド【ハート4―フロート】
// 「自軍ラッシュフェイズ中、これをラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、
//  選んだユニットは次の能力を得る⇒…」（atwiki/page-943・944）。RK-130 と同じく、ラッシュの手続き（コマンドのホールド）を終えてから選ぶ
//  （grnrngr/faq-rider-2 RK-130 Q・コメント欄）。見送ればふつうにラッシュする。
// - RK-215: 「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」（rules/rk/rk11Fields.ts rk11UsePrintedDefenderBp）。
// - RK-216: 「このターンを終えるとき、これが自軍バトルエリアにあれば、これを手札に戻す」（collectRk11TurnEndQueue）。

const UNDEAD_REPLACE: Record<string, { effectId: string; rule: string }> = {
  "RK-215": { effectId: "rk215_spade2_slash", rule: RK11_LIZARD_RULE },
  "RK-216": { effectId: "rk216_heart4_float", rule: RK11_DRAGONFLY_RULE },
};

function undeadReplaceOf(cardId: string): [string, { effectId: string; rule: string }] | undefined {
  return Object.entries(UNDEAD_REPLACE).find(([id]) => isSameCardIdentity(cardId, id));
}

/** ラッシュの手続きを終えたところ（カードはまだ手札）で、ラッシュするかわりに捨札にするかの選択を開く。対象外なら null。 */
export function openRk11UndeadReplace(state: GameState, playerId: PlayerId, card: CardInstance): GameState | null {
  const entry = undeadReplaceOf(card.cardId);
  if (!entry || state.phase !== "rush" || state.activePlayer !== playerId) return null;
  const ids = fieldUnits(state, playerId)
    .filter((c) => unitFeatures(state, playerId, c).includes("仮面ライダー"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, entry[0]),
    effectId: entry[1].effectId,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

for (const [cardId, { effectId, rule }] of Object.entries(UNDEAD_REPLACE)) {
  CHOICE_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selfId = pending.sourceInstanceId;
    const self = state.players[playerId].hand.find((c) => c.instanceId === selfId);
    let next = close(state, pending);
    if (self) next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== selfId), discard: [...p.discard, stripForZone(self)] }));
    next = addTurnPayload(next, playerId, rule, cardId, { instanceId });
    const target = fieldCards(state, playerId).find((c) => c.instanceId === instanceId);
    return { state: proceed(next, pending), log: logFor(state, playerId, cardId, `${effectId}:${cardName(state.definitions, target?.cardId ?? "")}`) };
  };
  CHOICE_SKIPPERS[effectId] = (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const selfId = pending.sourceInstanceId;
    let next = close(state, pending);
    const self = next.players[playerId].hand.find((c) => c.instanceId === selfId);
    if (!self) return { state: proceed(next, pending) };
    // ふつうにラッシュする（手続きは済んでいる）。
    next = patchPlayer(next, playerId, (p) => markRushedThisTurn({ ...p, hand: p.hand.filter((c) => c.instanceId !== selfId), rush: [...p.rush, self] }, self.instanceId));
    const rushed = emitUnitRushedAndFinalize(next, playerId, self.instanceId, playerId);
    next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs, buildLogEntry(playerId, "rush", self.cardId, state.definitions)] };
    return { state: next.pendingEffectChoice || next.pendingRush ? next : proceed(next, pending), log: skipLog(state, playerId, cardId, effectId) };
  };
}

// ---------------------------------------------------------------------------
// RK-218 ピーコックアンデッド【下級アンデッドを操る者】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから、特徴｢アンデッド｣を持つ自軍ユニットを1体選んでも良い。そうしたとき、選んだ
//  ユニットは、このターン「SP1」になり、ターンを終えるとき撃破される。」（atwiki/page-945）

export const PEACOCK_EFFECT_ID = "rk218_lower_undead";

function applyPeacock(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk218:enemy_turn" };
  const ids = state.players[ctx.playerId].rush
    .filter((c) => isUnitCard(state, c.cardId) && unitFeatures(state, ctx.playerId, c).includes("アンデッド"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk218:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-218"), effectId: PEACOCK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: PEACOCK_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[PEACOCK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = addTurnPayload(close(state, pending), playerId, RK11_SP1_RULE, "RK-218", { instanceId });
  next = addTurnPayload(next, playerId, RK11_PEACOCK_DESTROY_RULE, "RK-218", { instanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-218", `${PEACOCK_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[PEACOCK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-220 アルビノジョーカー【アンデッドを従える者】
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、自軍｢アルビローチ｣をラッシュしたとき次の効果を発動できる⇒自軍「アルビローチ」の数を数えて、
//  その数と同じ必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-947）
// - 数えるのは自軍の場（ラッシュエリア・バトルエリア）の「アルビローチ」（ラッシュしたものを含む）。撃破はサイズ・エリアを問わない。
// - 「発動できる」の任意は、撃破するユニットの選択を見送れることで表す。

function isAlbiroach(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return isSameCardIdentity(cardId, "RK-219") || getDefinition(state.definitions, cardId)?.name === "アルビローチ";
}

export function openRk11UndeadMasterOnRush(state: GameState, rusherId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  if (state.phase !== "rush" || state.activePlayer !== rusherId || phasePlayerId !== rusherId) return state;
  const rushed = fieldCards(state, rusherId).find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || !isAlbiroach(state, rushed.cardId)) return state;
  const jokers = fieldCards(state, rusherId).filter((c) => isSameCardIdentity(c.cardId, "RK-220"));
  if (jokers.length === 0) return state;
  const count = fieldUnits(state, rusherId).filter((c) => isAlbiroach(state, c.cardId)).length;
  const enemyId = opponent(rusherId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => costNumber(state, c.cardId) === count && selectableEnemy(state, rusherId, "RK-220", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  let next = state;
  for (const joker of jokers) {
    next = openOrQueue(next, {
      ...base({ playerId: rusherId, phasePlayerId, sourceInstanceId: joker.instanceId }, "RK-220"),
      effectId: "rk220_undead_master",
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "discard",
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-221 仮面ライダー響鬼【音撃打・火炎連打】（NC）
// 「自分の手札からオペレーションカードを1枚選び、捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」になり、このターンを
//  終えるときホールド状態なら、リリースしてもよい。」（atwiki/page-955）

export const KAEN_RENDA_EFFECT_ID = "rk221_kaen_renda";

function applyKaenRenda(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].hand.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "operation").map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: "rk221:no_operation" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-221"), effectId: KAEN_RENDA_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: KAEN_RENDA_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[KAEN_RENDA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  next = grantSp1AndRelease(next, playerId, pending.sourceInstanceId, "RK-221");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-221", `${KAEN_RENDA_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[KAEN_RENDA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-222 仮面ライダー響鬼紅【音撃打・灼熱真紅の型】（NC）
// 「MAを持つコマンドを2つホールドしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」になり、このターンを終えるときホールド状態なら、
//  リリースしてもよい。」（atwiki/page-874）。ホールドするのは自軍のリリース状態の MA のコマンド。

export const SHAKUNETSU_EFFECT_ID = "rk222_shakunetsu";

function releasedMaCommands(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return p.command.filter((c) => !c.commandHeld && effectiveCommandCategories(p, state.definitions, c.cardId).includes("MA")).map((c) => c.instanceId);
}

function applyShakunetsu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = releasedMaCommands(state, ctx.playerId);
  if (ids.length < 2 || !ctx.triggerSourceInstanceId) return { state, detail: "rk222:no_commands" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-222"), effectId: SHAKUNETSU_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 2, optional: true }),
    detail: SHAKUNETSU_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SHAKUNETSU_EFFECT_ID] = accumulate(2, (state, playerId, pending, selected) => {
  const set = new Set(selected);
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (set.has(c.instanceId) ? { ...c, commandHeld: true } : c)) }));
  next = grantSp1AndRelease(next, playerId, pending.sourceInstanceId, "RK-222");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-222", `${SHAKUNETSU_EFFECT_ID}:${selected.join(",")}`) };
});
CHOICE_SKIPPERS[SHAKUNETSU_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-223 仮面ライダー威吹鬼【音撃射・疾風一閃】（RC）
// 「自軍山札の上から3枚をオモテにしてもよい。そうしたとき、敵軍山札の上から3枚をオモテにする。そして、オモテにしたカードの中から「SP1」を持つ
//  Sユニットのカードをすべて捨札にし、それ以外を持ち主の山札に戻してシャッフルする。（この効果は、特徴「猛士」を持つユニットからコンビネーション
//  する時、ナンバーに関係なく発動する）」（atwiki/page-1087）
// - 「「SP1」を持つSユニットのカード」は印刷の SP が 1 の S ユニットのカード（条件つきで SP1 になるカードは cardSpec の it.todo）。

export const SHIPPU_EFFECT_ID = "rk223_shippu_issen";

function applyShippu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.players[ctx.playerId].deck.length === 0) return { state, detail: "rk223:deck_empty" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-223", SHIPPU_EFFECT_ID)), detail: SHIPPU_EFFECT_ID };
}

function isSp1SUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const d = getDefinition(state.definitions, cardId);
  return d?.type === "unit" && d.size === "S" && d.sp === 1;
}

CHOICE_RESOLVERS[SHIPPU_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SHIPPU_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[SHIPPU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const names: string[] = [];
  for (const pid of [playerId, opponent(playerId)]) {
    next = patchPlayer(next, pid, (p) => {
      const shown = p.deck.slice(0, 3);
      names.push(...shown.map((c) => cardName(state.definitions, c.cardId)));
      const discarded = shown.filter((c) => isSp1SUnitCard(state, c.cardId));
      const back = shown.filter((c) => !isSp1SUnitCard(state, c.cardId));
      return { ...p, deck: shuffleCards([...back, ...p.deck.slice(3)]), discard: [...p.discard, ...discarded.map(stripForZone)] };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-223", `${SHIPPU_EFFECT_ID}:${names.join(",")}`) };
};

/** ライドせずに出た威吹鬼の直前が特徴「猛士」を持つユニットなら RC の効果を発動する（rules/battleEntry.ts から呼ぶ）。対象外なら null。 */
export function rk11IbukiOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const battle = state.players[playerId].battle;
  const i = battle.findIndex((c) => c.instanceId === instanceId);
  const unit = battle[i];
  if (!unit || unit.mountedOnInstanceId || !isSameCardIdentity(unit.cardId, "RK-223")) return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  let prev: CardInstance | undefined;
  for (let k = i - 1; k >= 0; k--) {
    if (isUnitCard(state, battle[k]!.cardId)) {
      prev = battle[k];
      break;
    }
  }
  if (!prev || !unitFeatures(state, playerId, prev).includes("猛士")) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
  const markedUnit = marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!;
  const rc = resolveRidingComboOnRideOff(marked, playerId, markedUnit);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// RK-226 仮面ライダー歌舞鬼【音撃打・業火絢爛】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアからDAを持つ自軍ユニットを1体選び捨札にしてもよい。そうしたとき、自分は1枚
//  ドローする。」（atwiki/page-935）。捨札にする（撃破ではない）。

export const GOKA_EFFECT_ID = "rk226_goka_kenran";

function applyGoka(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk226:enemy_turn" };
  const ids = state.players[ctx.playerId].rush
    .filter((c) => isUnitCard(state, c.cardId) && unitEffectiveCategories(state, ctx.playerId, c, "rush").includes("DA"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk226:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-226"), effectId: GOKA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: GOKA_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GOKA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const taken = takeUnitOff(close(state, pending), playerId, instanceId);
  if (!taken) return { error: "invalid_target" };
  let next = patchPlayer(taken.state, playerId, (p) => ({ ...p, discard: [...p.discard, taken.card] }));
  next = requestDrawFromDeck(next, playerId, pending.phasePlayerId, { count: 1, sourceCardId: "RK-226" }).state;
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-226", `${GOKA_EFFECT_ID}:${cardName(state.definitions, taken.card.cardId)}`) };
};
CHOICE_SKIPPERS[GOKA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-227 仮面ライダー凍鬼【音撃殴・一撃怒涛】（NC）
// 「自軍と敵軍の常駐置き場にあるカードの枚数を数えて、その枚数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージに
//  して置いてもよい。」（atwiki/page-936）。常駐に重ねたカードも数える（コメント欄「ライドブッカーで４枚」）。サイズ・エリアを問わない（コメント欄）。

function residentCount(state: Pick<GameState, "players">): number {
  return (["player1", "player2"] as const).reduce(
    (n, pid) => n + state.players[pid].operation.reduce((m, c) => m + 1 + (c.stackedCards?.length ?? 0), 0),
    0,
  );
}

function applyIchigeki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const count = residentCount(state);
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return Number.isFinite(n) && n <= count && selectableEnemy(state, ctx.playerId, "RK-227", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk227:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-227"), effectId: "rk227_ichigeki_doto", kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "power", placeAsDamage: true }),
    detail: "rk227_ichigeki_doto",
  };
}

// ---------------------------------------------------------------------------
// RK-228 仮面ライダー羽撃鬼【音撃奏・旋風一閃】（NC）
// 「自分の手札より相手の手札の枚数が多ければ、相手の手札を見ないで1枚選んでもよい。そうしたとき、選んだカードを持ち主の山札の上に戻す。」
// （atwiki/page-937）。手札は見ないで選ぶ（UI はウラ向きで示す。RS-594 と同じ）。

export const SENPU_EFFECT_ID = "rk228_senpu_issen";

function applySenpu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const oppHand = state.players[enemyId].hand;
  if (oppHand.length <= state.players[ctx.playerId].hand.length) return { state, detail: "rk228:hand_not_more" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-228"), effectId: SENPU_EFFECT_ID, kind: "select_hand", validInstanceIds: oppHand.map((c) => c.instanceId), selectCount: 1, optional: true }),
    detail: SENPU_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SENPU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-228", `${SENPU_EFFECT_ID}:deck_top`) };
};
CHOICE_SKIPPERS[SENPU_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-229 仮面ライダー煌鬼【音撃拍・軽佻訃爆】（NC）
// 「敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、敵軍パワーゾーンのオモテ向きのカードから、選んだユニットの持つ特徴をすべて持つ
//  ユニットカードを1枚選び、ウラ向きにしてダメージにする。」（atwiki/page-938）。選んだユニットは場に残る（コメント欄）。

export const KEICHO_EFFECT_ID = "rk229_keicho_fubaku";
export const KEICHO_FLIP_EFFECT_ID = "rk229_keicho_fubaku_flip";

function applyKeicho(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && selectableEnemy(state, ctx.playerId, "RK-229", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk229:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-229"), effectId: KEICHO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: KEICHO_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[KEICHO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const chosen = state.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "RK-229", `${KEICHO_EFFECT_ID}:${chosen ? cardName(state.definitions, chosen.cardId) : instanceId}`);
  if (!chosen) return { state: proceed(cleared, pending), log };
  const features = unitFeatures(state, enemyId, chosen);
  const ids = cleared.players[enemyId].power
    .filter((c) => {
      if (c.faceDown) return false;
      const d = getDefinition(cleared.definitions, c.cardId);
      return d?.type === "unit" && features.every((f) => (d.features ?? []).includes(f));
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return { state: openNext(cleared, pending, { ...pending, effectId: KEICHO_FLIP_EFFECT_ID, kind: "select_power", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false }), log };
};
CHOICE_SKIPPERS[KEICHO_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[KEICHO_FLIP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = patchPlayer(close(state, pending), enemyId, (p) => {
    const power = p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c));
    return { ...p, power, damage: Math.max(p.damage + 1, power.filter((c) => c.faceDown).length) };
  });
  const winner = checkWinner(next);
  if (winner) next = { ...next, winner };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-229", `${KEICHO_FLIP_EFFECT_ID}:damage`) };
};

// ---------------------------------------------------------------------------
// RK-230 仮面ライダー西鬼【音撃響・偉羅射威】（NC）
// 「敵軍ユニットの下にオモテ向きで重ねたオペレーションカードを1体選んでもよい。そうしたとき、選んだカードを持ち主の山札に戻してシャッフルする。」
// （atwiki/page-939）。サイズ・エリアを問わない（カード評価）。

export const IRASSHAI_EFFECT_ID = "rk230_irasshai";

function stackedOperationIds(state: GameState, enemyId: PlayerId): string[] {
  return fieldUnits(state, enemyId).flatMap((u) =>
    (u.stackedCards ?? []).filter((s) => !s.faceDown && getDefinition(state.definitions, s.cardId)?.type === "operation").map((s) => s.instanceId),
  );
}

function applyIrasshai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = stackedOperationIds(state, opponent(ctx.playerId));
  if (ids.length === 0) return { state, detail: "rk230:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-230"), effectId: IRASSHAI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: IRASSHAI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[IRASSHAI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let moved: CardInstance | undefined;
  const strip = (c: CardInstance): CardInstance => {
    const hit = (c.stackedCards ?? []).find((s) => s.instanceId === instanceId);
    if (!hit) return c;
    moved = hit;
    return { ...c, stackedCards: (c.stackedCards ?? []).filter((s) => s.instanceId !== instanceId) };
  };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, battle: p.battle.map(strip), rush: p.rush.map(strip) }));
  if (moved) {
    const card = stripForZone(moved);
    next = patchPlayer(next, enemyId, (p) => ({ ...p, deck: shuffleCards([...p.deck, card]) }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-230", `${IRASSHAI_EFFECT_ID}:${moved ? cardName(state.definitions, moved.cardId) : instanceId}`) };
};
CHOICE_SKIPPERS[IRASSHAI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 「ターンを終えるとき」（rules/turnEndingEffects.ts）
// - RK-216 で能力を得たユニット: 自軍バトルエリアにあれば手札に戻す（強制）。
// - RK-218 で選ばれたユニット: 撃破される（強制）。
// - RK-221・RK-222: ホールド状態ならリリースしてもよい（任意）。

export const RELEASE_AT_END_EFFECT_ID = "rk11_release_at_end";

export function collectRk11TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const ids = (rule: string) => rk11TurnPayloads<{ instanceId?: string }>(state, endingPlayerId, rule).map((p) => p.instanceId).filter((id): id is string => !!id);
  return [
    ...ids(RK11_DRAGONFLY_RULE).map((id) => `return:${id}`),
    ...ids(RK11_PEACOCK_DESTROY_RULE).map((id) => `destroy:${id}`),
    ...ids(RK11_RELEASE_AT_END_RULE).map((id) => `release:${id}`),
  ];
}

export function openRk11TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  const zone = zoneOfField(state, endingPlayerId, instanceId);
  if (!zone) return state;
  if (kind === "return") {
    if (zone !== "battle") return state;
    const taken = takeUnitOff(state, endingPlayerId, instanceId);
    if (!taken) return state;
    return patchPlayer(taken.state, endingPlayerId, (p) => ({ ...p, hand: [...p.hand, taken.card] }));
  }
  if (kind === "destroy") {
    const leave = applyUnitLeave(state, instanceId, "discard", endingPlayerId);
    return "error" in leave ? state : leave.state;
  }
  if (kind === "release") {
    const unit = state.players[endingPlayerId][zone].find((c) => c.instanceId === instanceId);
    if (!unit?.commandHeld) return state;
    const cardId = rk11TurnPayloads<{ instanceId?: string; cardId?: string }>(state, endingPlayerId, RK11_RELEASE_AT_END_RULE).find((p) => p.instanceId === instanceId)?.cardId ?? unit.cardId;
    return openEffectChoice(state, confirmChoice({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, cardId, RELEASE_AT_END_EFFECT_ID));
  }
  return state;
}

CHOICE_RESOLVERS[RELEASE_AT_END_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[RELEASE_AT_END_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, pending.sourceCardId, RELEASE_AT_END_EFFECT_ID) };
};
CHOICE_CONFIRMERS[RELEASE_AT_END_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const id = pending.sourceInstanceId;
  const next = id ? setHeld(close(state, pending), playerId, new Set([id]), false) : close(state, pending);
  return { state: next, log: logFor(state, playerId, pending.sourceCardId, `${RELEASE_AT_END_EFFECT_ID}:release`) };
};

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK11_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-211::lightning_slash": applyLightningSlash,
  "RK-212::ray_bullet": applyRayBullet,
  "RK-213::gravity_slash": applyGravitySlash,
  "RK-214::impact_stab": applyImpactStab,
  "RK-218::peacock": applyPeacock,
  "RK-221::kaen_renda": applyKaenRenda,
  "RK-222::shakunetsu": applyShakunetsu,
  "RK-223::shippu_issen": applyShippu,
  "RK-226::goka_kenran": applyGoka,
  "RK-227::ichigeki_doto": applyIchigeki,
  "RK-228::senpu_issen": applySenpu,
  "RK-229::keicho_fubaku": applyKeicho,
  "RK-230::irasshai": applyIrasshai,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-215::spade2_slash": noop("rk215:rush_replace"),
  "RK-216::heart4_float": noop("rk216:rush_replace"),
  "RK-217::substitute": noop("rk217:zord"),
  "RK-217::glide": noop("rk217:attack_rush"),
  "RK-218::substitute": noop("rk218:zord"),
  "RK-220::undead_master": noop("rk220:on_rush"),
  "RK-224::support": noop("rk224:battle"),
  "RK-225::onmyojutsu": noop("rk225:counter_cost"),
};

export function tryRk11CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK11_KEYWORD_PREFIX)) return null;
  const handler = RK11_KEYWORDS[keyword.slice(RK11_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
