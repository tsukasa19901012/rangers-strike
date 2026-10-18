/**
 * ザ・マスクドライダーEXP vol.2 RK-106〜RK-126（仮面ライダーアギトFF〜仮面ライダーギャレン）のカード固有の効果（cardSpec RK6-106-126 の監査）。
 *
 * - `tryRk6CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk6::cardId::name`。RC・ラッシュしたとき・バトルエリアに出たとき・撃破されたとき）。
 * - `tryResolveRk6Choice` / `trySkipRk6Choice` / `tryConfirmRk6Choice`: このモジュールが開いた選択の解決。撃破・ホールド・ダメージにする選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - `tryRk6OnEnterBattle`: コンビネーション・ライドして出たときの効果（rules/combo.ts から呼ぶ。RK-109・RK-114・RK-115・RK-117）。
 * - `rk6SideBasherOnEntry`: RK-120【ニーラーシャトル】（rules/battleEntry.ts・core/applyAction.ts のライドオフの選択から呼ぶ）。
 * - `applyRk6AfterUnitLeft`: RK-123【制裁する光の翼】（rules/operationCounters.ts のユニットが場を離れたあとから呼ぶ）。
 * - SP・BP・特徴・進入制限・選べない制限・コマンドのホールドの防止の継続効果は rules/rk/rk6Fields.ts。RK-111 は rules/strikeReactions.ts。
 * 構成は rules/rk/rk5UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isVehicle, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { rk1IsSmallNow } from "./rk1Features";
import { EXA_BUSTER_RULE } from "./rk6Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK6_KEYWORD_PREFIX = "rk6::";

export function isRk6ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk6Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk6Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 選んだところで確定できる選択か（「行う」の確認）。 */
export function canConfirmRk6Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm";
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk6Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk6Choice(pending)) return { error: "no_selection" };
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

/**
 * 撃破の処理中に開く選択（「撃破されて捨札になったとき」）。開いている選択は解決中の効果の選択なので、上書きして開く
 * （解決中の効果の続きは rules/pendingChoices.ts finishChoice がこの選択の後に積む。to_power_on_destroy と同じ）。
 */
function openInterrupt(state: GameState, choice: PendingEffectChoice): GameState {
  const existing = state.pendingEffectChoice;
  // 同じ撃破の処理で先に開いた割り込みの選択（このモジュールの選択・to_power_on_destroy）があれば、その後に積む。
  if (existing && (isRk6ChoiceEffect(existing.effectId) || existing.effectId === "to_power_on_destroy")) return openOrQueue(state, choice);
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

/** 「行う／行わない」の確認（kind "confirm"）。 */
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

function isSUnit(state: Pick<GameState, "definitions">, card: CardInstance): boolean {
  return isUnitCard(state, card.cardId) && rk1IsSmallNow(state, card);
}

/** 敵軍の効果で選べる敵軍のカード（「相手に選ばれない」・スネークオルフェノク等を除く）。 */
function selectableEnemy(state: GameState, playerId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId, playerId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function ownTurn(state: GameState, ctx: { playerId: PlayerId; phasePlayerId: PlayerId }): boolean {
  return state.activePlayer === ctx.playerId || ctx.phasePlayerId === ctx.playerId;
}

function setHeld(state: GameState, ownerId: PlayerId, instanceIds: Set<string>, held: boolean): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: held } : c)),
    rush: p.rush.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: held } : c)),
  }));
}

/** 直前に出たユニット（ビークルは飛ばす）。 */
function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// RK-106 仮面ライダーアギトFF【セイバースラッシュ】（RC）
// 「敵軍バトルエリアから、ホールド状態のSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-691）。任意。
// ※（ライド中「SP1/3」）は rules/rk/rk6Fields.ts。

export const SABER_SLASH_EFFECT_ID = "rk106_saber_slash";

function applySaberSlash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => c.commandHeld && isSUnit(state, c) && selectableEnemy(state, ctx.playerId, "RK-106", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk106:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-106"),
      effectId: SABER_SLASH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "power",
      placeAsDamage: true,
    }),
    detail: SABER_SLASH_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-108 仮面ライダーギルス【ギルスヒールクロウ】（RC）
// 「このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」
// （atwiki/page-693）。ホールドするかを確認し、ホールドしたら敵軍バトルエリアの S ユニット（ホールド・リリースを問わない）を必ず選ぶ。

export const GILLS_CLAW_EFFECT_ID = "rk108_gills_heel_claw";
export const GILLS_CLAW_TARGET_EFFECT_ID = "rk108_gills_heel_claw_target";

function applyGillsClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const self = selfId ? fieldCards(state, ctx.playerId).find((c) => c.instanceId === selfId) : undefined;
  if (!self || self.commandHeld) return { state, detail: "rk108:cannot_hold" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-108", GILLS_CLAW_EFFECT_ID)), detail: GILLS_CLAW_EFFECT_ID };
}

CHOICE_RESOLVERS[GILLS_CLAW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[GILLS_CLAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "RK-108", `${GILLS_CLAW_EFFECT_ID}:accept`);
  let next = close(state, pending);
  if (pending.sourceInstanceId) next = setHeld(next, playerId, new Set([pending.sourceInstanceId]), true);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isSUnit(next, c) && selectableEnemy(next, playerId, "RK-108", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, {
      ...pending,
      effectId: GILLS_CLAW_TARGET_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      mayConfirm: undefined,
      unitDestination: "power",
      placeAsDamage: true,
    }),
    log,
  };
};
CHOICE_SKIPPERS[GILLS_CLAW_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-109 ギルスレイダー【自己修復能力】「ホールド状態のユニットがこれにライドするとき、そのユニットをリリースしてもよい。」（atwiki/page-695）
// ライドして一緒にバトルエリアに出たとき（rules/combo.ts）、ライドしたユニットがホールド状態ならリリースするかを確認する（ライドオフの選択より先）。

export const SELF_REPAIR_EFFECT_ID = "rk109_self_repair";

CHOICE_RESOLVERS[SELF_REPAIR_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[SELF_REPAIR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const riderId = pending.rk6Meta?.riderInstanceId;
  let next = close(state, pending);
  if (riderId) next = setHeld(next, playerId, new Set([riderId]), false);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-109", `${SELF_REPAIR_EFFECT_ID}:accept`) };
};
CHOICE_SKIPPERS[SELF_REPAIR_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-110 V-1システム【性能の限界】
// 「敵軍ターン中、これが撃破されて捨札になったとき、このユニットカードを自軍コマンドゾーンにホールド状態で置いてもよい。（置けなければこの効果は
//  発動できない）」（atwiki/page-631）。捨札になったあと（DSL の on_destroy）に確認する。コマンドゾーンが5枚なら発動しない。

export const V1_LIMIT_EFFECT_ID = "rk110_performance_limit";

function applyV1Limit(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const owner = ctx.playerId;
  if (ctx.phasePlayerId === owner) return { state, detail: "rk110:own_turn" };
  const selfId = ctx.triggerSourceInstanceId;
  const p = state.players[owner];
  if (!selfId || !p.discard.some((c) => c.instanceId === selfId)) return { state, detail: "rk110:not_in_discard" };
  if (p.command.length >= COMMAND_ZONE_MAX) return { state, detail: "rk110:command_full" };
  return {
    state: openInterrupt(state, confirmChoice({ playerId: owner, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: selfId }, "RK-110", V1_LIMIT_EFFECT_ID)),
    detail: V1_LIMIT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[V1_LIMIT_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[V1_LIMIT_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === selfId);
    if (!card || p.command.length >= COMMAND_ZONE_MAX) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== selfId), command: [...p.command, { ...stripForZone(card), commandHeld: true }] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-110", `${V1_LIMIT_EFFECT_ID}:accept`) };
};
CHOICE_SKIPPERS[V1_LIMIT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-112 オルタナティブ【スラッシュダガー】（RC）「敵軍バトルエリアからBPが本来のBPではないSユニットを1体選び撃破してもよい。」（atwiki/page-644）
// 今の BP が印刷の BP と違う S ユニット（上がっていても下がっていてもよい）。任意。

export const SLASH_DAGGER_EFFECT_ID = "rk112_slash_dagger";

function applySlashDagger(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      if (!isSUnit(state, c) || !selectableEnemy(state, ctx.playerId, "RK-112", c)) return false;
      const printed = getDefinition(state.definitions, c.cardId)?.bp;
      return typeof printed === "number" && effectiveBp(state, enemyId, c) !== printed;
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk112:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-112"),
      effectId: SLASH_DAGGER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "discard",
    }),
    detail: SLASH_DAGGER_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-113 サイコローグ【散弾】「これをラッシュしたとき、ライド中の敵軍Sユニットを1体選び、ライドオフさせてもよい。」（atwiki/page-629）
// エリアを問わない（atwiki/page-616 カード評価）。効果によるライドオフで RC は発動させない（RK-039 と同じ扱い）。任意。

export const SCATTER_SHOT_EFFECT_ID = "rk113_scatter_shot";

function applyScatterShot(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !!c.mountedOnInstanceId && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-113", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk113:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-113"),
      effectId: SCATTER_SHOT_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: SCATTER_SHOT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SCATTER_SHOT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unmount = (cards: CardInstance[]) =>
    cards.map((c) => {
      if (c.instanceId !== instanceId) return c;
      const { mountedOnInstanceId: _m, ...rest } = c;
      return rest as CardInstance;
    });
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, battle: unmount(p.battle), rush: unmount(p.rush) }));
  const card = fieldCards(state, enemyId).find((c) => c.instanceId === instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-113", `${SCATTER_SHOT_EFFECT_ID}:${cardName(state.definitions, card?.cardId ?? "")}`) };
};
CHOICE_SKIPPERS[SCATTER_SHOT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-114 サイコローダー【デッドエンド】「自軍ターン中、これがバトルエリアに出たとき、ライドされていない敵軍Sビークルを1体選び、捨札にしてもよい。」
// （atwiki/page-616）。エリアを問わない。撃破ではなく捨札にする。任意。

export const DEAD_END_EFFECT_ID = "rk114_dead_end";

function deadEndTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  const cards = fieldCards(state, enemyId);
  return cards
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!isVehicle(def) || def?.size !== "S") return false;
      if (cards.some((u) => u.mountedOnInstanceId === c.instanceId)) return false;
      return selectableEnemy(state, playerId, "RK-114", c);
    })
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[DEAD_END_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = fieldCards(state, enemyId).find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-114", `${DEAD_END_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[DEAD_END_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-115 仮面ライダーゾルダ【エンドオブワールド】
// 「｢マグナギガ｣からコンビネーションしたとき発動できる⇒ホールド状態のSユニットをすべて撃破する。その後、Sユニットをすべてホールドする。」
// （atwiki/page-627）。敵味方・エリアを問わない（カード評価）。撃破するユニットは発動したときに決まる（コメント欄）。選ぶ効果ではない。

export const END_OF_WORLD_EFFECT_ID = "rk115_end_of_world";
const END_OF_WORLD_DESTROY_EFFECT_ID = "rk115_end_of_world_destroy";
export const END_OF_WORLD_HOLD_EFFECT_ID = "rk115_end_of_world_hold";

function holdAllS(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const ids = new Set(fieldUnits(next, pid).filter((c) => rk1IsSmallNow(next, c) && !c.commandHeld).map((c) => c.instanceId));
    if (ids.size > 0) next = setHeld(next, pid, ids, true);
  }
  return next;
}

CHOICE_RESOLVERS[END_OF_WORLD_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[END_OF_WORLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "RK-115", `${END_OF_WORLD_EFFECT_ID}:accept`);
  const ids = (["player1", "player2"] as const).flatMap((pid) =>
    fieldUnits(state, pid)
      .filter((c) => c.commandHeld && rk1IsSmallNow(state, c))
      .map((c) => c.instanceId),
  );
  // 撃破を解決したあとに「その後、Sユニットをすべてホールドする」（確認なしで続ける確定済みの手順）。
  const holdStep: PendingEffectChoice = { ...confirmChoice(pending, "RK-115", END_OF_WORLD_HOLD_EFFECT_ID), optional: false, resumeChoice: pending.resumeChoice };
  const cleared = close(state, pending);
  if (ids.length === 0) return { state: proceed(holdAllS(cleared), pending), log };
  const opened = openEffectChoice(cleared, {
    ...base(pending, "RK-115"),
    effectId: END_OF_WORLD_DESTROY_EFFECT_ID,
    kind: "select_units_bp_budget",
    validInstanceIds: ids,
    selectedInstanceIds: ids,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
    resumeChoice: holdStep,
  });
  const destroyed = applyConfirmEffectChoice(opened, playerId);
  if ("error" in destroyed) return { state: proceed(holdAllS(cleared), pending), log };
  let next = destroyed.state;
  // 撃破が割り込みなしで終わり、続きのホールドの手順が開いたら、そのまま実行する。
  if (next.pendingEffectChoice?.effectId === END_OF_WORLD_HOLD_EFFECT_ID) {
    const hold = next.pendingEffectChoice;
    next = proceed(holdAllS(close(next, hold)), hold);
  }
  return { state: next, log };
};
CHOICE_SKIPPERS[END_OF_WORLD_EFFECT_ID] = simpleSkip();
// 撃破の解決中に割り込みがあった場合に残る「その後、すべてホールドする」の手順（確定するとホールドする）。
CHOICE_RESOLVERS[END_OF_WORLD_HOLD_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[END_OF_WORLD_HOLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(holdAllS(close(state, pending)), pending), log: logFor(state, playerId, "RK-115", `${END_OF_WORLD_HOLD_EFFECT_ID}:hold_all`) };
};

// ---------------------------------------------------------------------------
// RK-117 仮面ライダータイガ【クリスタルブレイク】
// 「｢デストワイルダー｣からコンビネーションしたとき発動できる⇒敵軍バトルエリアから、ホールド状態のSユニットを1体選び撃破してもよい。」（atwiki/page-635）
// 任意（選ばないことで発動しない）。※（ホールド状態の敵軍ユニット1体につき BP+1000）は rules/rk/rk6Fields.ts。

export const CRYSTAL_BREAK_EFFECT_ID = "rk117_crystal_break";

// ---------------------------------------------------------------------------
// RK-118 デストワイルダー【クロー】「自軍ターン中、これがバトルエリアに出たとき、レジストを持たない敵軍Sユニットを1体選びホールドしてもよい。」
// （atwiki/page-630）。エリアを問わない。既にホールド状態のユニットは選ばない（ホールドしても変わらない）。任意。

export const CLAW_EFFECT_ID = "rk118_claw";

function applyClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx)) return { state, detail: "rk118:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !c.commandHeld && rk1IsSmallNow(state, c) && !cardHasRegisterKeyword(state, c.cardId, enemyId) && selectableEnemy(state, ctx.playerId, "RK-118", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk118:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-118"),
      effectId: CLAW_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "hold",
    }),
    detail: CLAW_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// ユニットがバトルエリアに出たとき（rules/combo.ts の進入効果から呼ぶ）
// - RK-109: ホールド状態のユニットがライドして出たとき（ライドオフの選択より先）。
// - RK-114: 自軍ターン中、ライドされて一緒にバトルエリアに出たとき。
// - RK-115・RK-117: 自軍バトルフェイズのコンビネーション（直前に出たユニットのカード名）。

export function tryRk6OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  const ctx: BaseCtx = { playerId, phasePlayerId: playerId };
  const vehicle = card.mountedOnInstanceId ? state.players[playerId].battle.find((c) => c.instanceId === card.mountedOnInstanceId) : undefined;
  let next = state;
  if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-109") && card.commandHeld) {
    next = openOrQueue(next, confirmChoice({ ...ctx, sourceInstanceId: vehicle.instanceId }, "RK-109", SELF_REPAIR_EFFECT_ID, { rk6Meta: { riderInstanceId: card.instanceId } }));
  }
  if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-114") && state.activePlayer === playerId) {
    const ids = deadEndTargets(next, playerId);
    if (ids.length > 0) {
      next = openOrQueue(next, {
        ...base({ ...ctx, sourceInstanceId: vehicle.instanceId }, "RK-114"),
        effectId: DEAD_END_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
      });
    }
  }
  if (state.phase !== "battle" || state.activePlayer !== playerId) return next;
  const partner = comboPartner(state, battleBeforeEnter);
  const partnerName = partner ? cardName(state.definitions, partner.cardId) : "";
  if (isSameCardIdentity(card.cardId, "RK-115") && partnerName === "マグナギガ") {
    next = openOrQueue(next, confirmChoice({ ...ctx, sourceInstanceId: card.instanceId }, "RK-115", END_OF_WORLD_EFFECT_ID));
  }
  if (isSameCardIdentity(card.cardId, "RK-117") && partnerName === "デストワイルダー") {
    const enemyId = opponent(playerId);
    const ids = next.players[enemyId].battle
      .filter((c) => c.commandHeld && isSUnit(next, c) && selectableEnemy(next, playerId, "RK-117", c))
      .map((c) => c.instanceId);
    if (ids.length > 0) {
      next = openOrQueue(next, {
        ...base({ ...ctx, sourceInstanceId: card.instanceId }, "RK-117"),
        effectId: CRYSTAL_BREAK_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
        unitDestination: "discard",
      });
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-120 サイドバッシャーVM【ニーラーシャトル】
// 「これがライドされたままなら、このビークルからコンビネーションするSユニットは次の能力を得る⇒ナンバーにＲＣを持っていれば、ライドオフしなくても
//  その効果を発動できる。」（atwiki/page-657）
// - 直前（並びの1つ前）がライドされたままのこれと、それにライドしているユニットの組であれば、出た RC のユニットは、ライドしたまま進んでも
//   （core/applyAction.ts）、ライドせずに出ても（rules/battleEntry.ts。atwiki/page-657 コメント欄）RC の効果を発動する。
// - ライドオフして発動したら2重には発動しない（RIDE_OFF_RC_MARK。RK-017 ミッションメモリーと同じ）。

function comesFromRiddenSideBasher(battle: CardInstance[], unit: CardInstance): boolean {
  const idx = battle.findIndex((c) => c.instanceId === unit.instanceId);
  if (idx < 0) return false;
  // ライドして出たユニットは [ビークル, ユニット] の順に並ぶ。その前の組を見る。
  const start = unit.mountedOnInstanceId && battle[idx - 1]?.instanceId === unit.mountedOnInstanceId ? idx - 1 : idx;
  const prevRider = battle[start - 1];
  const prevVehicle = battle[start - 2];
  if (!prevRider || !prevVehicle) return false;
  return isSameCardIdentity(prevVehicle.cardId, "RK-120") && prevRider.mountedOnInstanceId === prevVehicle.instanceId;
}

/** 対象なら RC の効果を発動した state、対象外なら null。 */
export function rk6SideBasherOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const battle = state.players[playerId].battle;
  const unit = battle.find((c) => c.instanceId === instanceId);
  if (!unit || getDefinition(state.definitions, unit.cardId)?.comboNumber !== "RC" || !rk1IsSmallNow(state, unit)) return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  if (!comesFromRiddenSideBasher(battle, unit)) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
  const markedUnit = marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!;
  const rc = resolveRidingComboOnRideOff(marked, playerId, markedUnit);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// RK-121 サイドバッシャーBM【エクザップバスター】「これをラッシュしたターン、敵軍SユニットはBP-500される。（BP0以下になったユニットは撃破される）」
// （atwiki/page-656）。ラッシュしたとき（DSL の on_rush）に、このターンの規則として記録する（BP は rules/rk/rk6Fields.ts）。

function applyExaBuster(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const next = patchPlayer(state, ctx.playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId: EXA_BUSTER_RULE, scope: "turn", sourceCardId: "RK-121" }],
  }));
  return { state: next, detail: EXA_BUSTER_RULE };
}

// ---------------------------------------------------------------------------
// RK-123 クレインオルフェノク【制裁する光の翼】
// 「これが自軍ラッシュエリアにある間、敵軍ターン中、「クレインオルフェノク」以外の特徴「オルフェノク」を持つ自軍ユニットが撃破されて捨札になるたび、
//  敵軍Sユニットを1体選び撃破してもよい。」（atwiki/page-707）
// - 撃破されたユニットの特徴は、場にあったときの特徴（RK-122 で追加された「オルフェノク」を含む。カード評価）。
// - 自軍ラッシュエリアのクレインオルフェノク1体につき1回（重複する。コメント欄）。撃破する敵軍 S ユニットはエリアを問わない。任意。

export const CRANE_EFFECT_ID = "rk123_punishing_wings";

/** 場にあるユニットが「クレインオルフェノク」以外の「オルフェノク」か（場を離れる前に判定する）。 */
export function rk6IsNonCraneOrphnoch(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  if (!isUnitCard(state, card.cardId) || cardName(state.definitions, card.cardId) === "クレインオルフェノク") return false;
  return unitFeatures(state, ownerId, card).includes("オルフェノク");
}

function craneChoice(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId, sourceInstanceId: string, remaining: number, resumeChoice?: PendingEffectChoice): PendingEffectChoice | null {
  const enemyId = opponent(ownerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, ownerId, "RK-123", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return {
    ...base({ playerId: ownerId, phasePlayerId, sourceInstanceId }, "RK-123"),
    effectId: CRANE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    rk6Meta: { remaining },
    resumeChoice,
  };
}

export function applyRk6AfterUnitLeft(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; card: CardInstance; toZone: string; destroyed: boolean; phasePlayerId: PlayerId; wasNonCraneOrphnoch: boolean },
): GameState {
  if (!ctx.destroyed || ctx.toZone !== "discard" || !ctx.wasNonCraneOrphnoch) return state;
  if (ctx.phasePlayerId === ctx.ownerPlayerId) return state;
  const owner = state.players[ctx.ownerPlayerId];
  if (!owner.discard.some((c) => c.instanceId === ctx.card.instanceId)) return state;
  const cranes = owner.rush.filter((c) => isSameCardIdentity(c.cardId, "RK-123"));
  if (cranes.length === 0) return state;
  const choice = craneChoice(state, ctx.ownerPlayerId, ctx.phasePlayerId, cranes[0]!.instanceId, cranes.length - 1);
  return choice ? openInterrupt(state, choice) : state;
}

/** 1回分を終えたら、残りのクレインオルフェノクの分を今の盤面で開く。 */
function continueCrane(state: GameState, pending: PendingEffectChoice): GameState {
  const remaining = pending.rk6Meta?.remaining ?? 0;
  const nextChoice = remaining > 0 ? craneChoice(state, pending.playerId, pending.phasePlayerId, pending.sourceInstanceId ?? "RK-123", remaining - 1, pending.resumeChoice) : null;
  return proceed(state, nextChoice ? { ...pending, resumeChoice: nextChoice } : pending);
}

CHOICE_RESOLVERS[CRANE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = fieldCards(state, opponent(playerId)).find((c) => c.instanceId === instanceId);
  const left = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  return { state: continueCrane(left.state, pending), log: logFor(state, playerId, "RK-123", `${CRANE_EFFECT_ID}:${cardName(state.definitions, card?.cardId ?? "")}`) };
};
CHOICE_SKIPPERS[CRANE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: continueCrane(close(state, pending), pending), log: skipLog(state, playerId, "RK-123", CRANE_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-126 仮面ライダーギャレン【ギャレンラウザー】（RC）
// 「自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの必要パワーの数字が番号順
//  （例：0、1、2や3、4、5など）に揃うなら、敵軍Sユニットを1体選び撃破する。」（atwiki/page-647）
// - 手札をちょうど3枚選ぶ（RK-125 の読み替えと同じ。手札が3枚未満なら発動しない）。見せる順番は問わない（並べ替えて連続していれば揃う）。
// - ホールドと撃破はエリアを問わず、別のユニットでもよい（カード評価）。ホールドする候補は既にホールド状態のものを除く（RK-125 と同じ）。

export const GAREN_SHOW_EFFECT_ID = "rk126_garren_rouzer_show";
export const GAREN_HOLD_EFFECT_ID = "rk126_garren_rouzer_hold";
export const GAREN_DESTROY_EFFECT_ID = "rk126_garren_rouzer_destroy";

function applyGarenRouzer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const hand = state.players[ctx.playerId].hand;
  if (hand.length < 3) return { state, detail: "rk126:hand_short" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-126"),
      effectId: GAREN_SHOW_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: hand.map((c) => c.instanceId),
      selectCount: 3,
      optional: true,
    }),
    detail: GAREN_SHOW_EFFECT_ID,
  };
}

function consecutiveCosts(costs: number[]): boolean {
  if (costs.some((n) => !Number.isFinite(n))) return false;
  const sorted = [...costs].sort((a, b) => a - b);
  return sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
}

function garenDestroyChoice(state: GameState, pending: PendingEffectChoice): GameState {
  const enemyId = opponent(pending.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, pending.playerId, "RK-126", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return proceed(state, pending);
  return openNext(state, pending, {
    ...pending,
    effectId: GAREN_DESTROY_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    unitDestination: "discard",
    rk6Meta: undefined,
  });
}

CHOICE_RESOLVERS[GAREN_SHOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 3) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)), optional: false } },
    };
  }
  const hand = state.players[playerId].hand;
  const shown = selected.map((id) => hand.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
  const lined = consecutiveCosts(shown.map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)));
  const log = logFor(state, playerId, "RK-126", `${GAREN_SHOW_EFFECT_ID}:${shown.map((c) => cardName(state.definitions, c.cardId)).join(",")}`);
  const cleared = close(state, pending);
  const enemyId = opponent(playerId);
  const holdIds = fieldUnits(cleared, enemyId)
    .filter((c) => !c.commandHeld && rk1IsSmallNow(cleared, c) && selectableEnemy(cleared, playerId, "RK-126", c))
    .map((c) => c.instanceId);
  if (holdIds.length === 0) return { state: lined ? garenDestroyChoice(cleared, pending) : proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, {
      ...pending,
      effectId: GAREN_HOLD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: holdIds,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      rk6Meta: { lined },
    }),
    log,
  };
};
CHOICE_SKIPPERS[GAREN_SHOW_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[GAREN_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = setHeld(close(state, pending), opponent(playerId), new Set([instanceId]), true);
  const log = logFor(state, playerId, "RK-126", `${GAREN_HOLD_EFFECT_ID}:${instanceId}`);
  return { state: pending.rk6Meta?.lined ? garenDestroyChoice(next, pending) : proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK6_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-106::saber_slash": applySaberSlash,
  "RK-108::gills_heel_claw": applyGillsClaw,
  "RK-110::performance_limit": applyV1Limit,
  "RK-112::slash_dagger": applySlashDagger,
  "RK-113::scatter_shot": applyScatterShot,
  "RK-118::claw": applyClaw,
  "RK-121::exa_buster": applyExaBuster,
  "RK-126::garren_rouzer": applyGarenRouzer,
  // 継続効果・コンビネーション・ライドしたときの効果は、それぞれの処理の場所から呼ぶ。DSL からは何もしない。
  "RK-106::riding_sp": noop("rk106:continuous"),
  "RK-107::hardened_armor": noop("rk107:continuous"),
  "RK-109::self_repair": noop("rk109:on_ride"),
  "RK-111::emergency_alert": noop("rk111:strike_reaction"),
  "RK-114::dead_end": noop("rk114:on_enter"),
  "RK-115::end_of_world": noop("rk115:combo"),
  "RK-116::towering_body": noop("rk116:continuous"),
  "RK-117::held_enemy_bp": noop("rk117:continuous"),
  "RK-117::crystal_break": noop("rk117:combo"),
  "RK-120::kneeler_shuttle": noop("rk120:on_entry"),
  "RK-122::apostle_regeneration": noop("rk122:continuous"),
  "RK-122::power_six_entry": noop("rk122:entry_restriction"),
  "RK-123::punishing_wings": noop("rk123:after_destroy"),
  "RK-124::resolve_to_protect": noop("rk124:continuous"),
};

export function tryRk6CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK6_KEYWORD_PREFIX)) return null;
  const handler = RK6_KEYWORDS[keyword.slice(RK6_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
