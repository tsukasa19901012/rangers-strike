/**
 * スペシャルメタルエディション RM-001〜RM-021（蒸着〜ギラン円盤）のカード固有の効果（cardSpec RM1-001-021 の監査）。
 *
 * - `tryRm1CardEffect`: DSL の grant_keyword から呼ばれる起点（`rm1::cardId::name`。オペレーション・RC・ラッシュしたとき）。
 * - `tryResolveRm1Choice` / `trySkipRm1Choice` / `tryConfirmRm1Choice`: このモジュールが開いた選択の解決。
 * - `openRm1OnUnitRushed`: RM-007 世界忍者戦（自軍ラッシュフェイズ中、自軍ユニットをラッシュしたとき。rules/onRushUnitEffects.ts）。
 * - `isRm1LeaveCounterCard` / `applyRm1LeaveCounter`: RM-006 怒（いか）る！（離場の応答のカウンター。core/legalActions.ts・core/applyAction.ts・
 *   rules/operationCounters.ts）。
 * - `isRm1ActivatableResident` / `canActivateRm1Resident` / `activateRm1Resident`: RM-012 JPカード（rules/permanentOperation.ts）。
 * - `applyRm1StrikeDamageTriggers`: RM-009 マルチパック（core/applyAction.ts finishStrikeResolution）。
 * - `applyRm1AfterAction`: RM-017 オメデトロフィー（自軍ユニットがバトルエリアに出たとき。applyAction の後処理で、新しくバトルエリアに出た
 *   自軍ユニットを数える）。
 * - `applyRm1DolFire`: RM-020【ドルファイヤー】（ライドオフ。core/applyAction.ts resolve_ride_off_choice）。
 * 継続効果の判定（RM-011・RM-013・RM-014・RM-019・RM-020 の※）は rules/rm/rm1Fields.ts。
 * 選択の組み立ては rules/rk/rk16UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, cardName, effectiveBp, getDefinition, unitEffectiveCategories } from "../../core/catalog";
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
import { KIRIGAKURE_RULE_ID, addTurnFeatureModifier, unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { applyDamageToPlayer } from "../damagePayment";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rk1LeaveCounterConditionMet } from "../rk/rk1NamedEffects";
import { rk14ActsAsVehicle } from "../rk/rk14Fields";
import { MULTI_PACK_CARD_ID, TURBO_UNIT_CARD_ID, hasRm1MultiPack, rm1CostNumber, rm1ResidentActive, rm1ResidentCount } from "./rm1Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RM1_KEYWORD_PREFIX = "rm1::";

export function isRm1ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRm1Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRm1Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmRm1Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRm1Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRm1Choice(pending)) return { error: "no_selection" };
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

function blockedByOtherPrompt(state: GameState): boolean {
  return !!(state.pendingLeave || state.pendingRegister || state.pendingDamagePayment || state.pendingEffectRush || state.pendingChase);
}

/** 選択を開く。ほかの選択・処理の途中なら、その後に開く。 */
function openAfter(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  if (blockedByOtherPrompt(state)) {
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: choice }] };
  }
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
  if (blockedByOtherPrompt(state)) {
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

function simpleSkip(after?: (state: GameState, pending: PendingEffectChoice) => GameState): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    if (after) next = after(next, pending);
    return { state: proceed(next, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
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

function pendingBase(pending: PendingEffectChoice): BaseCtx {
  return { playerId: pending.playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
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

function categoriesOf(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const d = getDefinition(state.definitions, cardId);
  return d ? (cardCategories(d) as string[]) : [];
}

/** 汎用の1体選択（撃破・パワーゾーンへ送る。rules/pendingChoices.ts の select_unit と unitDestination で処理する）。 */
function genericPick(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, unitDestination: "discard" | "power"): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, unitDestination };
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

/** 場のユニットを持ち主の指定のゾーンに移す（撃破ではない。ライドしているビークル・下に重ねたカードは捨札）。 */
function moveFieldUnit(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
  to: "command_held" | "hand" | "power_damage",
): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!zone || !found) return state;
  const toCommand = to === "command_held" && state.players[ownerId].command.length < COMMAND_ZONE_MAX;
  const toZone = to === "hand" ? "hand" : to === "power_damage" ? "power" : toCommand ? "command" : "discard";
  const moved = patchPlayer(state, ownerId, (p) => {
    const strip = (cards: CardInstance[]) =>
      cards.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    const card = stripForZone(found);
    return {
      ...p,
      [zone]: strip(p[zone]),
      hand: to === "hand" ? [...p.hand, card] : p.hand,
      power: to === "power_damage" ? [...p.power, { ...card, faceDown: true }] : p.power,
      damage: to === "power_damage" ? p.damage + 1 : p.damage,
      command: toCommand ? [...p.command, { ...card, commandHeld: true }] : p.command,
      discard: [...p.discard, ...(toZone === "discard" ? [card] : []), ...(found.stackedCards ?? []).map(stripForZone)],
    };
  });
  const left = emitUnitLeftZoneAndResolve(moved, {
    ownerPlayerId: ownerId,
    instanceId,
    cardId: found.cardId,
    fromZone: zone,
    toZone,
    phasePlayerId,
    destroyed: false,
  });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

/** 山札（等）のカードを効果のラッシュで出す（選んだ1枚。必要パワー・追加条件は問わない）。 */
function effectRushPicked(
  state: GameState,
  pending: PendingEffectChoice,
  ownerId: PlayerId,
  instanceId: string,
  fromZone: "deck" | "power",
  after?: (state: GameState) => GameState,
): GameState {
  let next = startEffectRush(close(state, pending), {
    playerId: ownerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${pending.effectId}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone,
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: false,
    mandatory: true,
    forced: true,
  });
  if (after) next = after(next);
  return proceed(next, pending);
}

function shuffleDeck(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
}

// ---------------------------------------------------------------------------
// RM-001 蒸着・RM-002 赤射・RM-003 焼結（オペレーション）
// 「次の効果から1つ選び発動する⇒◎自軍山札から「宇宙刑事X」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。
//  ◎自軍Sユニットを1体選ぶ。このターン、選んだユニットは SP1/4 になる（赤射: 特徴に「レッド」を追加する／焼結: 「ブルー」を追加する）。」
//  （atwiki/page-888・page-889・page-890）
// 山札から出すのは効果のラッシュ（必要パワー・追加条件は問わない。本文に「ただし…満たすこと」がない）。選ばなくても山札はシャッフルする。
// 2つ目の SP1/4 はターンの終わりに消える指定値（spOverride）。特徴の追加はこのターンだけ（rules/addedFeatures.ts KIRIGAKURE_RULE_ID）。

type BeltSpec = { cardId: string; hero: string; rushMode: string; otherMode: string; other: { kind: "sp"; value: "1/4" } | { kind: "feature"; feature: string } };

const BELTS: BeltSpec[] = [
  { cardId: "RM-001", hero: "宇宙刑事ギャバン", rushMode: "gavan_rush", otherMode: "sp_1_4", other: { kind: "sp", value: "1/4" } },
  { cardId: "RM-002", hero: "宇宙刑事シャリバン", rushMode: "sharivan_rush", otherMode: "add_red", other: { kind: "feature", feature: "レッド" } },
  { cardId: "RM-003", hero: "宇宙刑事シャイダー", rushMode: "shaider_rush", otherMode: "add_blue", other: { kind: "feature", feature: "ブルー" } },
];

const BELT_MODE_EFFECT_ID = "rm001_metal_belt";
const BELT_HERO_EFFECT_ID = "rm001_metal_belt_hero";
const BELT_UNIT_EFFECT_ID = "rm001_metal_belt_unit";

function beltOf(cardId: string): BeltSpec | undefined {
  return BELTS.find((b) => isSameCardIdentity(cardId, b.cardId));
}

function applyBelt(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const belt = beltOf(cardId)!;
    return {
      state: openAfter(state, {
        ...base(ctxBase(ctx), belt.cardId),
        effectId: BELT_MODE_EFFECT_ID,
        kind: "confirm",
        validInstanceIds: [belt.rushMode, belt.otherMode],
        selectCount: 1,
        optional: false,
      }),
      detail: BELT_MODE_EFFECT_ID,
    };
  };
}

CHOICE_RESOLVERS[BELT_MODE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const belt = beltOf(pending.sourceCardId)!;
  const cleared = close(state, pending);
  const log = logFor(state, playerId, belt.cardId, `${BELT_MODE_EFFECT_ID}:${mode}`);
  if (mode === belt.rushMode) {
    const ids = cleared.players[playerId].deck
      .filter((c) => isUnitCard(cleared, c.cardId) && sameCardName(getDefinition(cleared.definitions, c.cardId)?.name, belt.hero))
      .map((c) => c.instanceId);
    if (ids.length === 0) return { state: proceed(shuffleDeck(cleared, playerId), pending), log };
    return { state: openNext(cleared, pending, { ...pending, effectId: BELT_HERO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], optional: true }), log };
  }
  const ids = fieldUnits(cleared, playerId).filter((c) => rk1IsSmallNow(cleared, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return { state: openNext(cleared, pending, { ...pending, effectId: BELT_UNIT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false }), log };
};

CHOICE_RESOLVERS[BELT_HERO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: effectRushPicked(state, pending, playerId, instanceId, "deck", (s) => shuffleDeck(s, playerId)),
    log: logFor(state, playerId, pending.sourceCardId, `${BELT_HERO_EFFECT_ID}:rush`),
  };
};
CHOICE_SKIPPERS[BELT_HERO_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

CHOICE_RESOLVERS[BELT_UNIT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const belt = beltOf(pending.sourceCardId)!;
  let next = close(state, pending);
  if (belt.other.kind === "sp") {
    const value = belt.other.value;
    next = patchPlayer(next, playerId, (p) => {
      const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, spOverride: value } : c));
      return { ...p, rush: set(p.rush), battle: set(p.battle) };
    });
  } else {
    const feature = belt.other.feature;
    next = patchPlayer(next, playerId, (p) => addTurnFeatureModifier(p, KIRIGAKURE_RULE_ID, { instanceId, features: [feature] }, belt.cardId));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, belt.cardId, `${BELT_UNIT_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RM-004 巨獣特捜（オペレーション）
// 「敵軍山札の上から、自軍ダメージの点数と同じ数までオモテにする。そして、オモテにしたカードの中から、特徴「獣」または「恐竜」を持つユニットカードを
//  好きな順で持ち主のラッシュエリアに出し、それ以外は山札に戻してシャッフルする。そうして出したユニットが1体以上あれば、自軍山札を見て、OTのLユニットの
//  カードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。」（atwiki/page-891）
// オモテにする枚数は自軍ダメージ（パワーゾーンのウラ向きのカード）の数（山札が足りなければ全部）。「獣」「恐竜」のユニットカードは山札の上から順に、
// 持ち主（敵軍）の効果のラッシュとして出す（必要パワー・追加条件は問わない）。自軍山札から出す L ユニットも追加条件を満たさなくてよい（Q1）。

const KYOJU_EFFECT_ID = "rm004_kyoju_tokuso";

function applyKyoju(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  const enemyId = opponent(pid);
  const damage = state.players[pid].power.filter((c) => c.faceDown).length;
  const revealed = state.players[enemyId].deck.slice(0, damage);
  const beasts = revealed.filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && ((d.features ?? []).includes("獣") || (d.features ?? []).includes("恐竜"));
  });
  let next = state;
  if (beasts.length > 0) {
    next = startEffectRush(next, {
      playerId: enemyId,
      phasePlayerId: ctx.phasePlayerId,
      effectId: `${KYOJU_EFFECT_ID}_beast`,
      sourceCardId: "RM-004",
      sourceInstanceId: ctx.operationInstanceId,
      fromZone: "deck",
      candidates: beasts.map((c) => c.instanceId),
      maxCount: beasts.length,
      requireConditions: false,
      mandatory: true,
      forced: true,
    });
  }
  next = shuffleDeck(next, enemyId);
  const log = `rm004:revealed:${revealed.length}:beasts:${beasts.length}`;
  if (beasts.length === 0) return { state: next, detail: log };
  const ids = next.players[pid].deck
    .filter((c) => {
      const d = getDefinition(next.definitions, c.cardId);
      return d?.type === "unit" && d.size === "L" && categoriesOf(next, c.cardId).includes("OT");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: shuffleDeck(next, pid), detail: log };
  return {
    state: openAfter(next, { ...base(ctxBase(ctx), "RM-004"), effectId: KYOJU_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: log,
  };
}

CHOICE_RESOLVERS[KYOJU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: effectRushPicked(state, pending, playerId, instanceId, "deck", (s) => shuffleDeck(s, playerId)), log: logFor(state, playerId, "RM-004", `${KYOJU_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[KYOJU_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

// ---------------------------------------------------------------------------
// RM-005 ダブルスナイパー（オペレーション）
// 「特徴「男」を持つ自軍ユニットを1体と、特徴「女」を持つ自軍ユニットを1体選び、選んだ2体の本来のBPを合計する。そして、合計したBP以下の敵軍ユニットを
//  1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-892）
// 「男」→「女」の順に選ぶ（同じユニットを2度は選べない）。どちらかがいなければ何もしない。敵軍ユニットはいまの BP で比べる（エリア・サイズを問わない）。

const SNIPER_MALE_EFFECT_ID = "rm005_double_sniper_male";
const SNIPER_FEMALE_EFFECT_ID = "rm005_double_sniper_female";
const SNIPER_TARGET_EFFECT_ID = "rm005_double_sniper_target";

function featuredUnits(state: GameState, playerId: PlayerId, feature: string, exclude: string[] = []): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => !exclude.includes(c.instanceId) && unitFeatures(state, playerId, c).includes(feature))
    .map((c) => c.instanceId);
}

function applyDoubleSniper(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const males = featuredUnits(state, ctx.playerId, "男");
  if (males.length === 0) return { state, detail: "rm005:no_male" };
  if (!males.some((m) => featuredUnits(state, ctx.playerId, "女", [m]).length > 0)) return { state, detail: "rm005:no_female" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-005"), effectId: SNIPER_MALE_EFFECT_ID, kind: "select_unit", validInstanceIds: males, selectCount: 1, optional: false }),
    detail: SNIPER_MALE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SNIPER_MALE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const females = featuredUnits(cleared, playerId, "女", [instanceId]);
  const log = logFor(state, playerId, "RM-005", `${SNIPER_MALE_EFFECT_ID}:${instanceId}`);
  if (females.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...pending, effectId: SNIPER_FEMALE_EFFECT_ID, validInstanceIds: females, selectedInstanceIds: [instanceId], selectCount: 1, optional: false }),
    log,
  };
};

CHOICE_RESOLVERS[SNIPER_FEMALE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const chosen = [...(pending.selectedInstanceIds ?? []), instanceId];
  const sum = chosen.reduce((acc, id) => {
    const c = findField(cleared, playerId, id);
    const bp = c ? printedBp(cleared, c.cardId) : Number.NaN;
    return acc + (Number.isFinite(bp) ? bp : 0);
  }, 0);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(cleared, enemyId)
    .filter((c) => effectiveBpOf(cleared, enemyId, c) <= sum && selectableEnemy(cleared, playerId, "RM-005", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RM-005", `${SNIPER_FEMALE_EFFECT_ID}:${instanceId}:sum:${sum}`);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return { state: openNext(cleared, pending, genericPick(pendingBase(pending), "RM-005", SNIPER_TARGET_EFFECT_ID, ids, false, "power")), log };
};

function effectiveBpOf(state: GameState, ownerId: PlayerId, card: CardInstance): number {
  return effectiveBp(state, ownerId, card);
}

// ---------------------------------------------------------------------------
// RM-006 怒（いか）る！（※カウンター）
// 「特徴「男」または「女」を持つ自軍ユニットが撃破されて捨札になったとき発動できる⇒特徴「メカ」と「人型」を持つ自軍ユニットの数と同じ数まで敵軍Sユニットを
//  選び、選んだユニットを好きな順で持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-879）
// 発動の条件は RK-015 人類の進化と同じ（rules/rk/rk1NamedEffects.ts rk1LeaveCounterConditionMet）。撃破されて捨札になった後で、選んだ順に置く
// （「好きな順」は選んだ順）。「メカ」「人型」のユニットは、離場を終えた後の自軍の場で数える。敵軍 S ユニットはエリアを問わない。

export const IKARU_CARD_ID = "RM-006";
const IKARU_EFFECT_ID = "rm006_ikaru";

export function isRm1LeaveCounterCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, IKARU_CARD_ID);
}

export function rm1LeaveCounterConditionMet(
  state: GameState,
  ownerId: PlayerId,
  intent: Pick<PendingLeave, "toZone" | "notDestruction" | "leavingCardId" | "instanceId" | "fromZone" | "phasePlayerId">,
): boolean {
  return rk1LeaveCounterConditionMet(state, ownerId, intent);
}

function ikaruTargets(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => !exclude.includes(c.instanceId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, IKARU_CARD_ID, c))
    .map((c) => c.instanceId);
}

/** 怒る！の効果（離場を終えた後に呼ぶ。使ったカードを捨札にするのは呼び出し側）。 */
export function applyRm1LeaveCounter(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId, counter: CardInstance): GameState {
  const limit = fieldUnits(state, ownerId).filter((c) => {
    const f = unitFeatures(state, ownerId, c);
    return f.includes("メカ") && f.includes("人型");
  }).length;
  const ids = ikaruTargets(state, ownerId, []);
  if (limit === 0 || ids.length === 0) return state;
  return openAfter(state, {
    ...base({ playerId: ownerId, phasePlayerId, sourceInstanceId: counter.instanceId }, IKARU_CARD_ID),
    effectId: IKARU_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: limit,
    optional: true,
    rm1Meta: { limit },
  });
}

function ikaruPlace(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  let next = close(state, pending);
  const enemyId = opponent(playerId);
  for (const id of selected) next = moveFieldUnit(next, enemyId, id, pending.phasePlayerId, "command_held");
  return proceed(next, pending);
}

CHOICE_RESOLVERS[IKARU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const limit = pending.rm1Meta?.limit ?? 1;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = ikaruTargets(state, playerId, selected);
  const log = logFor(state, playerId, IKARU_CARD_ID, `${IKARU_EFFECT_ID}:${instanceId}`);
  if (selected.length >= limit || rest.length === 0) return { state: ikaruPlace(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log };
};
CHOICE_SKIPPERS[IKARU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.length > 0) return { state: ikaruPlace(state, pending, playerId, selected), log: logFor(state, playerId, IKARU_CARD_ID, `${IKARU_EFFECT_ID}:confirm`) };
  return simpleSkip()(state, playerId);
};
CHOICE_CONFIRMERS[IKARU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: ikaruPlace(state, pending, playerId, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, IKARU_CARD_ID, `${IKARU_EFFECT_ID}:confirm`) };
};

// ---------------------------------------------------------------------------
// RM-007 世界忍者戦（※常駐）
// 「自軍ラッシュフェイズ中、自軍ユニットをラッシュしたとき、本来の特徴に「忍者」を持つすべてのユニットの本来のカテゴリを見て、WB、MA、OT、ET、DAが
//  それぞれ1つ以上あれば、次の効果を発動できる⇒特徴「忍者」を持たない敵軍Sユニットをすべて持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-831）
// 「すべてのユニット」は両軍の場（ラッシュエリア・バトルエリア）のユニット。印刷の特徴・カテゴリで見る。任意（発動するかを確認する）。
// ダメージにするのは、いまの特徴に「忍者」を持たない敵軍の S ユニット（エリアを問わない。ユニットを選ぶのではない）。

const NINJA_WAR_EFFECT_ID = "rm007_sekai_ninja_sen";
const ALL_CATEGORIES = ["WB", "MA", "OT", "ET", "DA"];

function ninjaCategoriesComplete(state: GameState): boolean {
  const cats = new Set<string>();
  for (const pid of ["player1", "player2"] as const) {
    for (const c of fieldUnits(state, pid)) {
      if (!(getDefinition(state.definitions, c.cardId)?.features ?? []).includes("忍者")) continue;
      for (const cat of categoriesOf(state, c.cardId)) cats.add(cat);
    }
  }
  return ALL_CATEGORIES.every((c) => cats.has(c));
}

/** 自軍ユニットをラッシュしたとき（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。 */
export function openRm1OnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  if (state.phase !== "rush" || phasePlayerId !== rusherPlayerId) return state;
  if (!findField(state, rusherPlayerId, rushedInstanceId)) return state;
  const copies = rm1ResidentCount(state, rusherPlayerId, "RM-007");
  if (copies === 0 || !ninjaCategoriesComplete(state)) return state;
  let next = state;
  for (const op of state.players[rusherPlayerId].operation.filter((c) => isSameCardIdentity(c.cardId, "RM-007"))) {
    next = openAfter(next, confirmChoice({ playerId: rusherPlayerId, phasePlayerId, sourceInstanceId: op.instanceId }, "RM-007", NINJA_WAR_EFFECT_ID));
  }
  return next;
}

CHOICE_RESOLVERS[NINJA_WAR_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[NINJA_WAR_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[NINJA_WAR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && !unitFeatures(next, enemyId, c).includes("忍者"))
    .map((c) => c.instanceId);
  for (const id of ids) next = moveFieldUnit(next, enemyId, id, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-007", `${NINJA_WAR_EFFECT_ID}:${ids.length}`) };
};

// ---------------------------------------------------------------------------
// RM-008 対バイオロン法（オペレーション）
// 「敵軍バトルエリアから「これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれた敵軍ユニットを1体選び、
//  持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-880）
// 「書かれた」はカードに印刷されたテキスト（サイズを問わない）。効果で同じ能力を得たユニットは含めない（it.todo）。

const BIORON_EFFECT_ID = "rm008_tai_bioron";
const BIORON_TEXT = "敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される";

function normText(text: string | undefined): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, "");
}

function applyBioron(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const needle = normText(BIORON_TEXT);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && normText(getDefinition(state.definitions, c.cardId)?.text).includes(needle) && selectableEnemy(state, ctx.playerId, "RM-008", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm008:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-008"), effectId: BIORON_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: BIORON_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BIORON_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-008", `${BIORON_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RM-009 マルチパック・RM-011 ターボユニット-W（オペレーション）
// 「（RM-011: ナンバーに数字を持ち、ETを持つ）自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。
//  重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」（atwiki/page-830・page-882）
// RK-013 Jパワーと同じく、このカードは選んだユニットの下に重ねる（ユニットの stackedCards）。ユニットでなくなったときの捨札は
// rules/rk/rk1NamedEffects.ts settleJPowerStacks（rules/rk/rk1Features.ts isStackedUnderUnitOperation）。
// RM-009「このカードに重ねたユニットがストライクしてダメージを与えたとき、自軍捨札からSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。
//  置けなければ手札に加える。」— applyRm1StrikeDamageTriggers。RM-011 のナンバーは rules/rm/rm1Fields.ts rm1ComboNumber。

const STACK_EFFECT_ID = "rm009_stack_under_unit";
const MULTI_PACK_RECOVER_EFFECT_ID = "rm009_multi_pack_recover";

function stackTargets(state: GameState, playerId: PlayerId, cardId: string): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => {
      if (!rk1IsSmallNow(state, c)) return false;
      if (!isSameCardIdentity(cardId, TURBO_UNIT_CARD_ID)) return true;
      const zone = zoneOfField(state, playerId, c.instanceId) ?? "rush";
      return typeof getDefinition(state.definitions, c.cardId)?.comboNumber === "number" && unitEffectiveCategories(state, playerId, c, zone).includes("ET");
    })
    .map((c) => c.instanceId);
}

function applyStack(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const ids = stackTargets(state, ctx.playerId, cardId);
    if (ids.length === 0) return { state, detail: `${cardId}:no_targets` };
    return {
      state: openAfter(state, {
        ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, cardId),
        effectId: STACK_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: false,
      }),
      detail: STACK_EFFECT_ID,
    };
  };
}

CHOICE_RESOLVERS[STACK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${pending.sourceCardId}:op`, cardId: pending.sourceCardId };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle), discard: p.discard.filter((c) => c.instanceId !== opCard.instanceId), hand: p.hand.filter((c) => c.instanceId !== opCard.instanceId) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${STACK_EFFECT_ID}:${instanceId}`) };
};

function sUnitCardsInDiscard(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].discard
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.size === "S";
    })
    .map((c) => c.instanceId);
}

/** RM-009: マルチパックを重ねたユニットがストライクしてダメージを与えたとき（core/applyAction.ts finishStrikeResolution）。 */
export function applyRm1StrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  const striker = state.players[pending.strikerPlayerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!hasRm1MultiPack(striker)) return state;
  let next = state;
  const packs = (striker!.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, MULTI_PACK_CARD_ID)).length;
  for (let i = 0; i < packs; i++) {
    const ids = sUnitCardsInDiscard(next, pending.strikerPlayerId);
    if (ids.length === 0) break;
    next = openAfter(next, {
      ...base({ playerId: pending.strikerPlayerId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: pending.strikerInstanceId }, MULTI_PACK_CARD_ID),
      effectId: MULTI_PACK_RECOVER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    });
  }
  return next;
}

CHOICE_RESOLVERS[MULTI_PACK_RECOVER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const toCommand = state.players[playerId].command.length < COMMAND_ZONE_MAX;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    command: toCommand ? [...p.command, { ...stripForZone(card), commandHeld: true }] : p.command,
    hand: toCommand ? p.hand : [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, MULTI_PACK_CARD_ID, `${MULTI_PACK_RECOVER_EFFECT_ID}:${toCommand ? "command" : "hand"}`) };
};

// ---------------------------------------------------------------------------
// RM-010 ソルインジケーター（オペレーション）
// 「自軍山札からビークルカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。」（atwiki/page-881）
// ビークルカードはカードの種類がビークルのもの（サイズ・カテゴリを問わない。ビークルとして扱うことのあるユニットカードは含めない）。

const SOL_EFFECT_ID = "rm010_sol_indicator";

function applySolIndicator(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].deck.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "vehicle").map((c) => c.instanceId);
  if (ids.length === 0) return { state: shuffleDeck(state, ctx.playerId), detail: "rm010:no_vehicle" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-010"), effectId: SOL_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SOL_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SOL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  next = shuffleDeck(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-010", `${SOL_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[SOL_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

// ---------------------------------------------------------------------------
// RM-012 JPカード（※常駐）
// 「自軍ラッシュフェイズごとに1度だけ、自分の手札からカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたカードの持つカテゴリごとに、次の効果を
//  発動する⇒WBなら、敵軍バトルエリアからSユニットを1体選び撃破する。MAなら、敵軍ラッシュエリアのSユニットを2体まで選び、持ち主の手札に戻す。OTなら、
//  敵軍ラッシュエリアのSユニットを1体選び、バトルエリアに出す。それ以外なら、自軍捨札からSユニットのカードを1枚選び、山札の上に戻す。」（atwiki/page-883）
// 起動（activate_resident_operation）で手札のカードを選ぶ（見送ってよい）。捨札にしたら、そのラッシュフェイズはもう起動できない。
// カテゴリごとの効果は WB → MA → OT → それ以外 の順に1つずつ発動する（マルチカテゴリのカードは両方。カード評価。順番は選ばせない）。
// 「それ以外」は ET・DA のどちらか（両方を持っていても1回）。選べるものがなければその効果は何もしない。

export const JP_CARD_ID = "RM-012";
const JP_DISCARD_EFFECT_ID = "rm012_jp_discard";
const JP_WB_EFFECT_ID = "rm012_jp_wb";
const JP_MA_EFFECT_ID = "rm012_jp_ma";
const JP_OT_EFFECT_ID = "rm012_jp_ot";
const JP_OTHER_EFFECT_ID = "rm012_jp_other";

export function isRm1ActivatableResident(cardId: string): boolean {
  return isSameCardIdentity(cardId, JP_CARD_ID);
}

/** JPカードを起動できるか（対象外のカードなら null）。 */
export function canActivateRm1Resident(state: GameState, playerId: PlayerId, op: CardInstance): boolean | null {
  if (!isRm1ActivatableResident(op.cardId)) return null;
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  if (op.residentActivatedThisRush) return false;
  if (!rm1ResidentActive(state, playerId, JP_CARD_ID)) return false;
  return state.players[playerId].hand.length > 0;
}

export function activateRm1Resident(state: GameState, playerId: PlayerId, op: CardInstance): GameState {
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: op.instanceId }, JP_CARD_ID),
    effectId: JP_DISCARD_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: state.players[playerId].hand.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

type JpStep = "WB" | "MA" | "OT" | "OTHER";

function jpSteps(state: GameState, cardId: string): JpStep[] {
  const cats = categoriesOf(state, cardId);
  const steps: JpStep[] = [];
  for (const c of ["WB", "MA", "OT"] as const) if (cats.includes(c)) steps.push(c);
  if (cats.some((c) => c === "ET" || c === "DA")) steps.push("OTHER");
  return steps;
}

function jpChoice(state: GameState, pending: PendingEffectChoice, step: JpStep): PendingEffectChoice | null {
  const playerId = pending.playerId;
  const enemyId = opponent(playerId);
  const ctx = pendingBase(pending);
  const enemyS = (zone: "battle" | "rush") =>
    state.players[enemyId][zone]
      .filter((c) => isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(state.players[enemyId], c) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, JP_CARD_ID, c))
      .map((c) => c.instanceId);
  if (step === "WB") {
    const ids = enemyS("battle");
    return ids.length === 0 ? null : { ...base(ctx, JP_CARD_ID), effectId: JP_WB_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false };
  }
  if (step === "MA") {
    const ids = enemyS("rush");
    return ids.length === 0 ? null : { ...base(ctx, JP_CARD_ID), effectId: JP_MA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 2, optional: true };
  }
  if (step === "OT") {
    const ids = enemyS("rush");
    return ids.length === 0 ? null : { ...base(ctx, JP_CARD_ID), effectId: JP_OT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false };
  }
  const ids = sUnitCardsInDiscard(state, playerId);
  return ids.length === 0 ? null : { ...base(ctx, JP_CARD_ID), effectId: JP_OTHER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false };
}

/** 残りのカテゴリの効果を順に開く（選べるものがない効果は飛ばす）。 */
function jpContinue(state: GameState, pending: PendingEffectChoice, steps: JpStep[]): GameState {
  let rest = [...steps];
  while (rest.length > 0) {
    const step = rest.shift()!;
    const choice = jpChoice(state, pending, step);
    if (!choice) continue;
    return openNext(state, pending, { ...choice, rm1Meta: { steps: rest } });
  }
  return proceed(state, pending);
}

function jpRest(pending: PendingEffectChoice): JpStep[] {
  return (pending.rm1Meta?.steps ?? []) as JpStep[];
}

CHOICE_RESOLVERS[JP_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
    operation: p.operation.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, residentActivatedThisRush: true } : c)),
  }));
  return { state: jpContinue(next, pending, jpSteps(state, card.cardId)), log: logFor(state, playerId, JP_CARD_ID, `${JP_DISCARD_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[JP_DISCARD_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[JP_WB_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), JP_CARD_ID, `${JP_WB_EFFECT_ID}_destroy`, [instanceId]);
  return { state: jpAfter(next, pending), log: logFor(state, playerId, JP_CARD_ID, `${JP_WB_EFFECT_ID}:${instanceId}`) };
};

/** 処理の途中（撃破の誘発・離場の応答など）なら、残りのカテゴリの効果をその後に開く。 */
function jpAfter(state: GameState, pending: PendingEffectChoice): GameState {
  const rest = jpRest(pending);
  if (rest.length === 0) return proceed(state, pending);
  if (state.pendingEffectChoice || blockedByOtherPrompt(state)) {
    // 残りの効果を開く確認なしの続き（選べるものがないものは開くときに飛ばす）。
    const first = rest.map((step) => jpChoice(state, pending, step)).find((c): c is PendingEffectChoice => !!c);
    if (!first) return proceed(state, pending);
    const idx = rest.findIndex((step) => jpChoice(state, pending, step)?.effectId === first.effectId);
    return proceed(openAfter(state, { ...first, resumeChoice: pending.resumeChoice, rm1Meta: { steps: rest.slice(idx + 1) } }), { ...pending, resumeChoice: undefined });
  }
  return jpContinue(state, pending, rest);
}

function jpBounce(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  let next = close(state, pending);
  for (const id of selected) next = moveFieldUnit(next, opponent(playerId), id, pending.phasePlayerId, "hand");
  return jpAfter(next, pending);
}

CHOICE_RESOLVERS[JP_MA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
  const log = logFor(state, playerId, JP_CARD_ID, `${JP_MA_EFFECT_ID}:${instanceId}`);
  if (selected.length >= 2 || rest.length === 0) return { state: jpBounce(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log };
};
CHOICE_SKIPPERS[JP_MA_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: jpBounce(state, pending, playerId, pending.selectedInstanceIds ?? []), log: skipLog(state, playerId, JP_CARD_ID, JP_MA_EFFECT_ID) };
};
CHOICE_CONFIRMERS[JP_MA_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: jpBounce(state, pending, playerId, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, JP_CARD_ID, `${JP_MA_EFFECT_ID}:confirm`) };
};

CHOICE_RESOLVERS[JP_OT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = state.players[enemyId].rush.find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  const group = new Set([unit.instanceId, ...(unit.mountedOnInstanceId ? [unit.mountedOnInstanceId] : [])]);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const moving = p.rush.filter((c) => group.has(c.instanceId));
    moving.sort((a, b) => (a.instanceId === unit.instanceId ? 1 : 0) - (b.instanceId === unit.instanceId ? 1 : 0));
    return { ...p, rush: p.rush.filter((c) => !group.has(c.instanceId)), battle: [...p.battle, ...moving] };
  });
  return { state: jpAfter(next, pending), log: logFor(state, playerId, JP_CARD_ID, `${JP_OT_EFFECT_ID}:${instanceId}`) };
};

CHOICE_RESOLVERS[JP_OTHER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
  return { state: jpAfter(next, pending), log: logFor(state, playerId, JP_CARD_ID, `${JP_OTHER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RM-015 インプットカードガン（オペレーション）
// 「このオペレーションカードを使用するためにホールドしたコマンドの必要パワーの数字を見て、その数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破
//  する。そうして撃破したユニットが捨札になる前に敵軍捨札を見て、撃破したユニットと同じカード名のユニットカードがあれば、このカードが捨札になるとき、
//  かわりに手札に戻してもよい。」（atwiki/page-893）
// 使用のためにホールドしたコマンドは支払いの記録（state.rk12OpPaid。リードでホールドしたユニットを含む。atwiki/page-2250 Q3）。数字は「+」「-」を除く。
// ホールドしたコマンドが複数（プリズム等）なら、どれかの数字と同じものを選べる。敵軍 S ユニットはエリアを問わない。

const INPUT_GUN_EFFECT_ID = "rm015_input_card_gun";
const INPUT_GUN_RETURN_EFFECT_ID = "rm015_input_card_gun_return";

function paidCostNumbers(state: GameState, ctx: GrantKeywordContext): number[] {
  const paid = state.rk12OpPaid && state.rk12OpPaid.instanceId === ctx.operationInstanceId ? state.rk12OpPaid.commandIds : [];
  const p = state.players[ctx.playerId];
  return paid
    .map((id) => [...p.command, ...p.battle, ...p.rush].find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c)
    .map((c) => rm1CostNumber(state, c.cardId))
    .filter((n) => Number.isFinite(n));
}

function applyInputCardGun(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const numbers = paidCostNumbers(state, ctx);
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && numbers.includes(rm1CostNumber(state, c.cardId)) && selectableEnemy(state, ctx.playerId, "RM-015", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm015:no_targets" };
  return {
    state: openAfter(state, { ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RM-015"), effectId: INPUT_GUN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: INPUT_GUN_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[INPUT_GUN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = findField(state, enemyId, instanceId);
  if (!unit) return { error: "invalid_target" };
  const name = getDefinition(state.definitions, unit.cardId)?.name;
  const matched = state.players[enemyId].discard.some((c) => isUnitCard(state, c.cardId) && sameCardName(getDefinition(state.definitions, c.cardId)?.name, name));
  let next = destroyAll(close(state, pending), pendingBase(pending), "RM-015", `${INPUT_GUN_EFFECT_ID}_destroy`, [instanceId]);
  if (matched) next = openAfter(next, { ...confirmChoice(pendingBase(pending), "RM-015", INPUT_GUN_RETURN_EFFECT_ID), resumeChoice: pending.resumeChoice });
  else next = proceed(next, pending);
  return { state: next, log: logFor(state, playerId, "RM-015", `${INPUT_GUN_EFFECT_ID}:${instanceId}:${matched ? "match" : "no_match"}`) };
};

CHOICE_RESOLVERS[INPUT_GUN_RETURN_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[INPUT_GUN_RETURN_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[INPUT_GUN_RETURN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const opId = pending.sourceInstanceId;
  let next = close(state, pending);
  if (opId) {
    const opCard: CardInstance = { instanceId: opId, cardId: "RM-015" };
    next = patchPlayer(next, playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== opId), hand: p.hand.some((c) => c.instanceId === opId) ? p.hand : [...p.hand, opCard] }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-015", `${INPUT_GUN_RETURN_EFFECT_ID}:hand`) };
};

// ---------------------------------------------------------------------------
// RM-016 スターピース（オペレーション）
// 「自軍パワーゾーンのダメージになってるカードをすべてオモテにする。そして、相手は自分自身の山札を見て、ユニットカードを1枚選び、自分自身のラッシュエリアに
//  出してもよい。その後、相手は自分自身の山札をシャッフルする。」（atwiki/page-832）
// 相手が出すのは相手の効果のラッシュ（必要パワー・追加条件は問わない。カード評価「出せるユニットに制限は無い」）。

const STAR_PIECE_EFFECT_ID = "rm016_star_piece";

function applyStarPiece(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pid = ctx.playerId;
  let next = patchPlayer(state, pid, (p) => ({ ...p, power: p.power.map((c) => (c.faceDown ? { ...c, faceDown: false } : c)), damage: 0 }));
  const enemyId = opponent(pid);
  const ids = next.players[enemyId].deck.filter((c) => isUnitCard(next, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state: shuffleDeck(next, enemyId), detail: "rm016:no_unit" };
  next = openAfter(next, { ...base({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RM-016"), effectId: STAR_PIECE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
  return { state: next, detail: STAR_PIECE_EFFECT_ID };
}

CHOICE_RESOLVERS[STAR_PIECE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: effectRushPicked(state, pending, playerId, instanceId, "deck", (s) => shuffleDeck(s, playerId)), log: logFor(state, playerId, "RM-016", `${STAR_PIECE_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[STAR_PIECE_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

// ---------------------------------------------------------------------------
// RM-017 オメデトロフィー（※常駐）
// 「自軍ユニットがバトルエリアに出たとき、自軍山札の上から1枚を見る。そのカードのカテゴリが、バトルエリアに出たユニットのカテゴリと同じなら、そのカードを
//  自軍コマンドゾーンにホールド状態で置いてもよい（コマンドゾーンに置けるカードは通常5枚まで）。そうしないとき、そのカードを山札の上に戻すか下に戻すかを
//  選択する。」（atwiki/page-885）
// 1体出るたびに発動する（Q1）。ターンを問わない（敵軍ターン中に出たときも。カード評価）。「同じ」はカテゴリを1つでも共有すること。
// 出たかどうかは applyAction の前後でバトルエリアの自軍ユニットを比べる（どの経路で出ても数える。ビークル・ビークルとして扱うものは数えない）。
// 選択は deck_top・deck_bottom・to_command（置けるとき）。

const TROPHY_EFFECT_ID = "rm017_omedetrophy";
export const RM1_DECK_TOP = "deck_top";
export const RM1_DECK_BOTTOM = "deck_bottom";
export const RM1_TO_COMMAND = "to_command";

function trophyChoice(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, opInstanceId: string, unitCardId: string): PendingEffectChoice | null {
  const top = state.players[playerId].deck[0];
  if (!top) return null;
  const unitCats = categoriesOf(state, unitCardId);
  const same = categoriesOf(state, top.cardId).some((c) => unitCats.includes(c));
  const canPlace = same && state.players[playerId].command.length < COMMAND_ZONE_MAX;
  return {
    ...base({ playerId, phasePlayerId, sourceInstanceId: opInstanceId }, "RM-017"),
    effectId: TROPHY_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: canPlace ? [RM1_TO_COMMAND, RM1_DECK_TOP, RM1_DECK_BOTTOM] : [RM1_DECK_TOP, RM1_DECK_BOTTOM],
    selectCount: 1,
    optional: false,
    rm1Meta: { topInstanceId: top.instanceId },
  };
}

CHOICE_RESOLVERS[TROPHY_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const topId = pending.rm1Meta?.topInstanceId;
  const card = state.players[playerId].deck.find((c) => c.instanceId === topId);
  let next = close(state, pending);
  if (card && mode !== RM1_DECK_TOP) {
    next = patchPlayer(next, playerId, (p) => {
      const deck = p.deck.filter((c) => c.instanceId !== card.instanceId);
      if (mode === RM1_TO_COMMAND && p.command.length < COMMAND_ZONE_MAX) return { ...p, deck, command: [...p.command, { ...stripForZone(card), commandHeld: true }] };
      return { ...p, deck: [...deck, card] };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-017", `${TROPHY_EFFECT_ID}:${mode}`) };
};

function battleUnitIds(state: GameState, playerId: PlayerId): Set<string> {
  const p = state.players[playerId];
  return new Set(p.battle.filter((c) => isUnitCard(state, c.cardId) && !rk14ActsAsVehicle(p, c)).map((c) => c.instanceId));
}

function hasOtherBlocking(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry ||
    state.pendingEffectRush
  );
}

/** applyAction の後処理（depth 0）: RM-017 の発動（新しくバトルエリアに出た自軍ユニット）を記録し、開ける状態なら1つ開く。 */
export function applyRm1AfterAction(before: GameState, after: GameState): GameState {
  let queue = [...(after.rm1PendingTriggers ?? [])];
  for (const pid of ["player1", "player2"] as const) {
    const ops = after.players[pid].operation.filter((c) => isSameCardIdentity(c.cardId, "RM-017"));
    if (ops.length === 0 || !rm1ResidentActive(after, pid, "RM-017")) continue;
    const prev = battleUnitIds(before, pid);
    for (const unit of after.players[pid].battle) {
      if (prev.has(unit.instanceId) || !battleUnitIds(after, pid).has(unit.instanceId)) continue;
      for (const op of ops) queue.push({ kind: "rm017", playerId: pid, sourceInstanceId: op.instanceId, unitCardId: unit.cardId });
    }
  }
  if (queue.length === 0) return after.rm1PendingTriggers ? { ...after, rm1PendingTriggers: undefined } : after;
  let next: GameState = after;
  if (hasOtherBlocking(next) || next.winner) return { ...next, rm1PendingTriggers: queue };
  while (queue.length > 0) {
    const trigger = queue.shift()!;
    const existing = next.pendingEffectChoice;
    const phasePlayerId = existing?.phasePlayerId ?? next.activePlayer;
    const choice = trophyChoice(next, trigger.playerId, phasePlayerId, trigger.sourceInstanceId, trigger.unitCardId);
    if (!choice) continue;
    next = existing ? { ...next, pendingEffectChoice: { ...choice, resumeChoice: existing }, activePlayer: choice.playerId } : openEffectChoice(next, choice);
    break;
  }
  return { ...next, rm1PendingTriggers: queue.length > 0 ? queue : undefined };
}

// ---------------------------------------------------------------------------
// RM-018 宇宙刑事ギャバン【ギャバンダイナミック】（RC）
// 「本来のBPが4000以上の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送ってもよい。」（atwiki/page-869）。エリアを問わない。
// ※「自軍Sユニットがこれ以外にあれば、これはストライクできない。」は rules/combo.ts。チェイスは keywords/chase.ts。

const GAVAN_DYNAMIC_EFFECT_ID = "rm018_gavan_dynamic";

function applyGavanDynamic(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && printedBp(state, c.cardId) >= 4000 && selectableEnemy(state, ctx.playerId, "RM-018", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm018:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "RM-018", GAVAN_DYNAMIC_EFFECT_ID, ids, true, "power")), detail: GAVAN_DYNAMIC_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RM-020 電子星獣ドル【ドルファイヤー】
// 「自軍ターン中、本来の特徴に「宇宙刑事」を持つユニットがこのビークルからライドオフしたとき、相手に1点ダメージを与える。」（atwiki/page-835）
// ※の L ビークルの扱いは rules/rm/rm1Fields.ts rm1ActsAsVehicle。

/** ライドオフしたとき（core/applyAction.ts resolve_ride_off_choice。rider はライドオフ前のユニット）。 */
export function applyRm1DolFire(state: GameState, playerId: PlayerId, rider: CardInstance): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const vehicleId = rider.mountedOnInstanceId;
  if (!vehicleId) return state;
  const vehicle = findField(state, playerId, vehicleId);
  if (!vehicle || !isSameCardIdentity(vehicle.cardId, "RM-020")) return state;
  if (!(getDefinition(state.definitions, rider.cardId)?.features ?? []).includes("宇宙刑事")) return state;
  const next = applyDamageToPlayer(state, opponent(playerId), 1, { kind: "none", activePlayer: playerId });
  return { ...next, log: [...next.log, buildLogEntry(playerId, "named_effect", "RM-020", state.definitions, "dol_fire")] };
}

// ---------------------------------------------------------------------------
// RM-021 ギラン円盤【ビークル射出】（ラッシュしたとき）
// 「自軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が4以下の、MユニットかSビークルのカードを1枚選んでもよい。そうしたとき、選んだカードを
//  自軍ラッシュエリアに出す。」（atwiki/page-836）。出すのは効果のラッシュ（追加条件・カテゴリを問わない。カード評価）。数字は「+」「-」を除く。

const VEHICLE_LAUNCH_EFFECT_ID = "rm021_vehicle_launch";

function applyVehicleLaunch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].power
    .filter((c) => {
      if (c.faceDown) return false;
      const d = getDefinition(state.definitions, c.cardId);
      const n = rm1CostNumber(state, c.cardId);
      if (!Number.isFinite(n) || n > 4) return false;
      return (d?.type === "unit" && d.size === "M") || (d?.type === "vehicle" && d.size === "S");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm021:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-021"), effectId: VEHICLE_LAUNCH_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: VEHICLE_LAUNCH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[VEHICLE_LAUNCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  if (getDefinition(state.definitions, card.cardId)?.type === "unit") {
    return { state: effectRushPicked(state, pending, playerId, instanceId, "power"), log: logFor(state, playerId, "RM-021", `${VEHICLE_LAUNCH_EFFECT_ID}:rush`) };
  }
  // ビークルはラッシュエリアに出す（効果のラッシュの候補にならないカードは直接置く）。
  let next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${VEHICLE_LAUNCH_EFFECT_ID}_rush`,
    sourceCardId: "RM-021",
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "power",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: false,
    mandatory: true,
    forced: true,
  });
  if (next.players[playerId].power.some((c) => c.instanceId === instanceId)) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-021", `${VEHICLE_LAUNCH_EFFECT_ID}:vehicle`) };
};
CHOICE_SKIPPERS[VEHICLE_LAUNCH_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RM1_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RM-001::jouchaku": applyBelt("RM-001"),
  "RM-002::sekisha": applyBelt("RM-002"),
  "RM-003::shoketsu": applyBelt("RM-003"),
  "RM-004::kyoju_tokuso": applyKyoju,
  "RM-005::double_sniper": applyDoubleSniper,
  "RM-008::tai_bioron": applyBioron,
  "RM-009::multi_pack": applyStack(MULTI_PACK_CARD_ID),
  "RM-010::sol_indicator": applySolIndicator,
  "RM-011::turbo_unit": applyStack(TURBO_UNIT_CARD_ID),
  "RM-015::input_card_gun": applyInputCardGun,
  "RM-016::star_piece": applyStarPiece,
  "RM-018::gavan_dynamic": applyGavanDynamic,
  "RM-021::vehicle_launch": applyVehicleLaunch,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RM-019::dorugiran": noop("rm019:rush_condition_waiver"),
  "RM-020::dol_fire": noop("rm020:ride_off"),
};

export function tryRm1CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RM1_KEYWORD_PREFIX)) return null;
  const handler = RM1_KEYWORDS[keyword.slice(RM1_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
