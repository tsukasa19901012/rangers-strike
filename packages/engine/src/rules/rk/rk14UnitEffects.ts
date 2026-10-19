/**
 * ザ・マスクドライダーEXP vol.4 RK-274〜RK-294（ビートチェイサー〜仮面ライダーサソードMF）のカード固有の効果（cardSpec RK14-274-294 の監査）。
 *
 * - `tryRk14CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk14::cardId::name`。RC・ラッシュしたとき）。
 * - `tryResolveRk14Choice` / `trySkipRk14Choice` / `tryConfirmRk14Choice`: このモジュールが開いた選択の解決。
 * - `tryRk14OnEnterBattle`: バトルエリアに出たとき（rules/combo.ts）。ライドして一緒に出たビークル RK-274・RK-289、自軍ターン中に出たユニット
 *   RK-275・RK-276・RK-290・RK-291、コンビネーション RK-278・RK-284、RK-294 の NC。
 * - `applyRk14OnUnitLeft`: RK-283【契約解除者の捕食】・RK-292【三つの魂】（events/listeners/unitLeftZoneListener.ts）。
 * - `openRk14WhipOnEnemyRush`: RK-293【捕縛する鞭】（rules/onRushUnitEffects.ts applyPassiveRushTriggers から呼ぶ）。
 * - RK-277 の重ねる・留まる処理は SK-004 仮面ライダークウガUF と同じ（rules/legend1/otherLinesNamedEffects.ts）。
 * - RK-286 の※（かわりに「男」を捨札にする）は RK-128 と同じ（rules/rk/rk7UnitEffects.ts openRk7RengelSubstitute）。
 * 継続効果の判定（RK-278・RK-280〜RK-282・RK-288・RK-292）は rules/rk/rk14Fields.ts・rules/rk/rk14Features.ts、RK-294 は keywords/battleKeywords.ts。
 * 構成は rules/rk/rk13UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { sameCardName } from "../../core/cardNames";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { cardNotSelectableByOpponent, isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { RK14_BLOOD_VESSEL_RULE, cardHasMorphKeyword } from "../../keywords/battleKeywords";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, openEffectChoice, requestDrawFromDeck } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { tryLeaveField } from "../operationCounters";
import { hasAdditionalCondition } from "../dispatchOrder";
import { markBattleBlocked } from "../turnModifiers";
import { ncEffectiveNumber } from "../numberComboEffects";
import { turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { applyMajikiStack } from "../legend1/otherLinesNamedEffects";
import { rk1IsSmallNow, rk1ZoneCardFeatures } from "./rk1Features";
import { RK14_DELTA_MOVER_RULE, rk14ActsAsVehicle } from "./rk14Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK14_KEYWORD_PREFIX = "rk14::";

export function isRk14ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk14Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk14Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmRk14Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk14Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk14Choice(pending)) return { error: "no_selection" };
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

/** 相手が自分のユニットを選ぶ効果で選べるユニット（ブレイカー等だけを確かめる。R-KW-BREAKER-03）。 */
function selectableOwn(state: GameState, victimId: PlayerId, userId: PlayerId, sourceCardId: string, card: CardInstance): boolean {
  return isSelectableByOpponentEffect(state, victimId, card.instanceId, sourceCardId, userId);
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function costNumber(state: Pick<GameState, "definitions">, cardId: string): number {
  return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost);
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

function isNamed(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  return sameCardName(getDefinition(state.definitions, cardId)?.name, name);
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

/** 場のカードを撃破ではない移動で持ち主のゾーンへ（コマンドゾーン等）。 */
function moveFieldCard(state: GameState, ownerId: PlayerId, instanceId: string, toZone: "command", phasePlayerId: PlayerId): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const card = zone ? findField(state, ownerId, instanceId) : undefined;
  if (!zone || !card) return state;
  return tryLeaveField(state, {
    ownerPlayerId: ownerId,
    instanceId,
    fromZone: zone,
    toZone,
    leavingCardId: card.cardId,
    phasePlayerId,
    notDestruction: true,
    skipRegister: true,
  }).state;
}

/** 効果で出したユニットの「ラッシュされたとき」（自軍・敵軍の誘発）を処理する。 */
function finalizeRushed(state: GameState, rusherId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  if (!findField(state, rusherId, instanceId)) return state;
  const rushed = finalizeEffectRush(state, rusherId, [instanceId], phasePlayerId);
  return rushed.logs.length > 0 ? { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] } : rushed.state;
}

/** 直前に出たユニット（左隣。バトルエリアのユニットのうち最後のもの。R-CN-05）。 */
function comboPartner(state: Pick<GameState, "definitions">, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

function isVehicleNow(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return getDefinition(state.definitions, card.cardId)?.type === "vehicle" || rk14ActsAsVehicle(state.players[ownerId], card);
}

const DECK_TOP = "deck_top";
const DECK_BOTTOM = "deck_bottom";

// ---------------------------------------------------------------------------
// RK-274 ビートチェイサー【ニューマシンの性能】（ライドして一緒に出たとき）
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍山札の上から2枚を見て、そのカードを山札の上か下にそれぞれ好きな順で
//  戻す。」（atwiki/page-1371）。RK-002 V3ホッパーと同じく1枚ずつ上か下を選ぶ（コメント欄「一枚ずつ決めることが可能」）。最初の1枚を選ぶことが発動。

export const BEAT_PICK_EFFECT_ID = "rk274_beat_pick";
export const BEAT_PLACE_EFFECT_ID = "rk274_beat_place";

function beatPickChoice(ctx: BaseCtx, remaining: string[], optional: boolean): PendingEffectChoice {
  return {
    ...base(ctx, "RK-274"),
    effectId: BEAT_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: remaining,
    viewedInstanceIds: remaining,
    selectCount: 1,
    optional,
    rk14Meta: { remainingIds: remaining },
  };
}

function openBeatChaser(state: GameState, playerId: PlayerId, vehicle: CardInstance): GameState {
  const seen = state.players[playerId].deck.slice(0, 2).map((c) => c.instanceId);
  if (seen.length === 0) return state;
  return openOrQueue(state, beatPickChoice({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId }, seen, true));
}

CHOICE_RESOLVERS[BEAT_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: BEAT_PLACE_EFFECT_ID,
        kind: "confirm",
        validInstanceIds: [DECK_TOP, DECK_BOTTOM],
        optional: false,
        rk14Meta: { ...pending.rk14Meta, picked: instanceId },
      },
    },
    log: logFor(state, playerId, "RK-274", `${BEAT_PICK_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_SKIPPERS[BEAT_PICK_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[BEAT_PLACE_EFFECT_ID] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  const pickedId = pending.rk14Meta?.picked;
  const card = state.players[playerId].deck.find((c) => c.instanceId === pickedId);
  if (!card || !pickedId) return { error: "invalid_target" };
  const placed = patchPlayer(state, playerId, (p) => {
    const rest = p.deck.filter((c) => c.instanceId !== pickedId);
    return { ...p, deck: where === DECK_TOP ? [card, ...rest] : [...rest, card] };
  });
  const rest = (pending.rk14Meta?.remainingIds ?? []).filter((id) => id !== pickedId);
  const log = logFor(state, playerId, "RK-274", `${BEAT_PLACE_EFFECT_ID}:${where}`);
  if (rest.length > 0) {
    const next = beatPickChoice({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, rest, false);
    return { state: { ...placed, pendingEffectChoice: { ...next, resumeChoice: pending.resumeChoice } }, log };
  }
  return { state: proceed(close(placed, pending), pending), log };
};

// ---------------------------------------------------------------------------
// RK-275 ゴ・ガドル・バ【ザバギンバシグラ】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍パワーゾーンのダメージ以外のカードから、Sユニットのカードを1枚選び、敵軍ラッシュエリアに
//  出してもよい。そうしたとき、相手は自分自身の山札の上から1枚ひいて、自分自身のパワーゾーンに置いてもよい。」（atwiki/page-1255）
// 出したユニットは効果でラッシュしたユニットとして「ラッシュされたとき」の誘発を処理する（RK-160 が発動できる。faq-rider-2 RK-160 Q3）。

export const GADORU_PICK_EFFECT_ID = "rk275_gadoru_pick";
export const GADORU_POWER_EFFECT_ID = "rk275_gadoru_power";

function openGadoru(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].power
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      // 「相手に選ばれない」を持つオモテ向きのカードは選べない（ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。
      return !c.faceDown && d?.type === "unit" && d.size === "S" && !cardNotSelectableByOpponent(c.cardId);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-275"),
    effectId: GADORU_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[GADORU_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  const log = logFor(state, playerId, "RK-275", `${GADORU_PICK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (next.players[enemyId].deck.length === 0) return { state: proceed(finalizeRushed(next, enemyId, instanceId, pending.phasePlayerId), pending), log };
  return {
    state: openNext(next, pending, {
      ...pending,
      playerId: enemyId,
      effectId: GADORU_POWER_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [],
      selectedInstanceIds: [],
      optional: true,
      mayConfirm: true,
      rk14Meta: { owner: playerId, picked: instanceId },
    }),
    log,
  };
};
CHOICE_SKIPPERS[GADORU_PICK_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[GADORU_POWER_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[GADORU_POWER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const [top, ...rest] = p.deck;
    if (!top) return p;
    return { ...p, deck: rest, power: [...p.power, { ...stripForZone(top), faceDown: false }] };
  });
  const picked = pending.rk14Meta?.picked;
  if (picked) next = finalizeRushed(next, playerId, picked, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-275", `${GADORU_POWER_EFFECT_ID}:power`) };
};
CHOICE_SKIPPERS[GADORU_POWER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const picked = pending.rk14Meta?.picked;
  if (picked) next = finalizeRushed(next, playerId, picked, pending.phasePlayerId);
  return { state: proceed(next, pending), log: skipLog(state, playerId, "RK-275", GADORU_POWER_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-276 ズ・バヅー・バ【キョクギンジャンママ】
// 「自軍ターン中、これがバトルエリアに出たとき、相手の手札を見ないで1枚選んでもよい。そうしたとき、選んだカードをお互いに見て、それがSユニットの
//  カードだったなら、敵軍ラッシュエリアに出す。このとき、可能ならそのユニットをホールドする。その後、相手は1枚ドローする。」（atwiki/page-1391）
// 選ばなければ相手はドローしない（コメント欄）。出したユニットは「ラッシュされたとき」の誘発を処理する（faq-rider-2 RK-160 Q4）。

export const BAZU_EFFECT_ID = "rk276_bazu_jumper";

function openBazu(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const ids = state.players[opponent(playerId)].hand.map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-276"),
    effectId: BAZU_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[BAZU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const d = getDefinition(state.definitions, card.cardId);
  const isS = d?.type === "unit" && d.size === "S";
  let next = close(state, pending);
  if (isS) {
    next = patchPlayer(next, enemyId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== instanceId),
      rush: [...p.rush, { ...stripForZone(card), commandHeld: true }],
    }));
  }
  if (next.players[enemyId].deck.length > 0) next = requestDrawFromDeck(next, enemyId, pending.phasePlayerId, { count: 1, sourceCardId: "RK-276" }).state;
  if (isS) next = finalizeRushed(next, enemyId, instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-276", `${BAZU_EFFECT_ID}:${cardName(state.definitions, card.cardId)}${isS ? ":rush" : ""}`) };
};
CHOICE_SKIPPERS[BAZU_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-278 仮面ライダーナイト（2nd）【飛翔斬】・RK-284 仮面ライダーベルデ【デスバニッシュ】（コンビネーション）
// - RK-278「「ダークウイング」からコンビネーションしたとき発動できる⇒敵軍バトルエリアから、特徴の数が1番少ないSユニットを1体選び撃破する。」
//   （atwiki/page-1382）。特徴の数は今の特徴（ダークウイング【ソニックブレイカー】等で特徴を持たなければ0）。撃破は汎用の選択（unitDestination）。
// - RK-284「「バイオグリーザ」からコンビネーションしたとき発動できる⇒敵軍バトルエリアから、BP4000以下のSユニットを1体選び撃破する。そうしたとき、
//   撃破したユニットのBPがこのユニットのBPよりも低ければ、相手は自分自身のコマンドゾーンからカードを1枚選び捨札にする。」（atwiki/page-1251）
// 対象を選ぶことが発動の宣言（対象がいなければ発動できない）。

export const VANISH_EFFECT_ID = "rk284_death_vanish";
export const VANISH_COMMAND_EFFECT_ID = "rk284_death_vanish_command";

function openKnightSlash(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const candidates = state.players[enemyId].battle.filter(
    (c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "RK-278", c),
  );
  if (candidates.length === 0) return state;
  const counts = candidates.map((c) => unitFeatures(state, enemyId, c).length);
  const fewest = Math.min(...counts);
  const ids = candidates.filter((_, i) => counts[i] === fewest).map((c) => c.instanceId);
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-278"),
    effectId: "rk278_hishouzan",
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    unitDestination: "discard",
  });
}

function openDeathVanish(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && effectiveBp(state, enemyId, c) <= 4000 && selectableEnemy(state, playerId, "RK-284", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-284"),
    effectId: VANISH_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[VANISH_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = findField(state, enemyId, targetId);
  if (!target) return { error: "invalid_target" };
  const targetBp = effectiveBp(state, enemyId, target);
  const self = pending.sourceInstanceId ? findField(state, playerId, pending.sourceInstanceId) : undefined;
  const selfBp = self ? effectiveBp(state, playerId, self) : (getDefinition(state.definitions, "RK-284")?.bp ?? 0);
  const next = close(state, pending);
  const commands = next.players[enemyId].command.map((c) => c.instanceId);
  const resume: PendingEffectChoice | undefined =
    targetBp < selfBp && commands.length > 0
      ? {
          ...pending,
          playerId: enemyId,
          effectId: VANISH_COMMAND_EFFECT_ID,
          kind: "select_command",
          validInstanceIds: commands,
          selectedInstanceIds: [],
          optional: false,
          rk14Meta: { owner: playerId, targetBp, selfBp },
        }
      : pending.resumeChoice;
  const destroyed = destroyAll(next, { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-284", "rk284_death_vanish_destroy", [targetId], resume);
  return { state: destroyed, log: logFor(state, playerId, "RK-284", `${VANISH_EFFECT_ID}:${cardName(state.definitions, target.cardId)}:${targetBp}<${selfBp}`) };
};
CHOICE_SKIPPERS[VANISH_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[VANISH_COMMAND_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== commandId),
    discard: [...p.discard, stripForZone(cmd)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-284", `${VANISH_COMMAND_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-279 仮面ライダーナイトサバイブ【ダークバイザーツバイ】（RC）
// 「自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい。そうしたとき、敵軍バトルエリアからSユニットを好きな数選び撃破しても
//  よい。ただし、選んだユニットの特徴の数の合計が、捨札から選んだカードの必要パワーの数字の合計以下になるように選ぶこと。」（atwiki/page-1284）
// 0枚では確定できない（コメント欄）。選んだ捨札のカードは捨札に残る。特徴の数は今の特徴（RK-280【疾風断】等で0）。

export const VISOR_CARDS_EFFECT_ID = "rk279_dark_visor_cards";
export const VISOR_UNITS_EFFECT_ID = "rk279_dark_visor_units";

function adventIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].discard
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("アドベントカード"))
    .map((c) => c.instanceId);
}

function applyDarkVisor(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = adventIds(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "rk279:no_advent" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-279"),
      effectId: VISOR_CARDS_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 2,
      optional: true,
    }),
    detail: VISOR_CARDS_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[VISOR_CARDS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = selected.length >= 2 ? [] : adventIds(state, playerId).filter((id) => !selected.includes(id));
  // 1枚選んだら確定できる（0枚では確定できない。コメント欄）。
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log: logFor(state, playerId, "RK-279", `${VISOR_CARDS_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[VISOR_CARDS_EFFECT_ID] = simpleSkip();

function visorTargets(state: GameState, playerId: PlayerId, budget: number, exclude: string[]): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => !exclude.includes(c.instanceId) && isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "RK-279", c))
    .filter((c) => unitFeatures(state, enemyId, c).length <= budget)
    .map((c) => c.instanceId);
}

CHOICE_CONFIRMERS[VISOR_CARDS_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const budget = selected.reduce((sum, id) => {
    const card = state.players[playerId].discard.find((c) => c.instanceId === id);
    const n = card ? costNumber(state, card.cardId) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const next = close(state, pending);
  const ids = visorTargets(next, playerId, budget, []);
  const log = logFor(state, playerId, "RK-279", `${VISOR_CARDS_EFFECT_ID}:budget=${budget}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, {
      ...pending,
      effectId: VISOR_UNITS_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: undefined,
      optional: true,
      mayConfirm: undefined,
      rk14Meta: { budget },
    }),
    log,
  };
};

CHOICE_RESOLVERS[VISOR_UNITS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = findField(state, opponent(playerId), instanceId);
  if (!card) return { error: "invalid_target" };
  const budget = (pending.rk14Meta?.budget ?? 0) - unitFeatures(state, opponent(playerId), card).length;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  return {
    state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: visorTargets(state, playerId, budget, selected), mayConfirm: true, rk14Meta: { budget } } },
    log: logFor(state, playerId, "RK-279", `${VISOR_UNITS_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_SKIPPERS[VISOR_UNITS_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[VISOR_UNITS_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ids = pending.selectedInstanceIds ?? [];
  const next = destroyAll(close(state, pending), { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-279", "rk279_dark_visor_destroy", ids, pending.resumeChoice);
  return { state: next, log: logFor(state, playerId, "RK-279", `${VISOR_UNITS_EFFECT_ID}:destroy=${ids.length}`) };
};

// ---------------------------------------------------------------------------
// RK-283 ボルキャンサー【契約解除者の捕食】・RK-292 クロコダイルオルフェノク格闘態【三つの魂】（撃破されて捨札になったとき）
// - RK-283「これが自軍エリアにある間、敵軍ターン中、特徴「ミラーライダー」を持つ自軍ユニットが撃破されて捨札になったとき、自分も相手も次のように
//   する⇒撃破されたユニットの必要パワーの数字と同じ必要パワーの数字を持つSユニットのカードを、自分自身のコマンドゾーンから1枚選び捨札にする。」
//   （atwiki/page-1380）。自分、相手の順に選ぶ（当てはまるカードがなければその人は何もしない）。
// - RK-292「敵軍ターン中、これが撃破されて捨札になったとき、次の効果を発動できる⇒自軍山札を見て「クロコダイルオルフェノク格闘態」のカードを1枚
//   選び、相手に見せてから自分の手札に加えてもよい。その後、自軍山札をシャッフルする。」（atwiki/page-1360）。選ぶことが発動。

export const CANCER_EFFECT_ID = "rk283_volcancer_prey";
export const SOULS_EFFECT_ID = "rk292_three_souls";

export type Rk14LeaveEvent = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: string;
  toZone: string;
  phasePlayerId?: PlayerId;
  destroyed?: boolean;
};

function cancerIds(state: GameState, playerId: PlayerId, cost: number): string[] {
  return state.players[playerId].command
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.size === "S" && costNumber(state, c.cardId) === cost;
    })
    .map((c) => c.instanceId);
}

/** players の順に、当てはまるカードがある最初のプレイヤーの選択（無ければ undefined）。 */
function cancerChoice(state: GameState, players: PlayerId[], cost: number, phasePlayerId: PlayerId, sourceInstanceId: string | undefined): PendingEffectChoice | undefined {
  for (let i = 0; i < players.length; i++) {
    const pid = players[i]!;
    const ids = cancerIds(state, pid, cost);
    if (ids.length === 0) continue;
    return {
      ...base({ playerId: pid, phasePlayerId, sourceInstanceId }, "RK-283"),
      effectId: CANCER_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      rk14Meta: { budget: cost, remainingIds: players.slice(i + 1) },
    };
  }
  return undefined;
}

export function applyRk14OnUnitLeft(state: GameState, event: Rk14LeaveEvent): GameState {
  if (event.toZone !== "discard" || event.destroyed === false || (event.fromZone !== "battle" && event.fromZone !== "rush")) return state;
  const owner = event.ownerPlayerId;
  const turnPlayer = event.phasePlayerId ?? turnPlayerOf(state);
  if (turnPlayer === owner) return state;
  let next = state;
  // RK-283（自軍エリアのボルキャンサー1体ごと）。
  if (rk1ZoneCardFeatures(next, owner, event.cardId).includes("ミラーライダー")) {
    const cost = costNumber(next, event.cardId);
    if (Number.isFinite(cost)) {
      for (const cancer of fieldCards(next, owner).filter((c) => isSameCardIdentity(c.cardId, "RK-283"))) {
        const choice = cancerChoice(next, [owner, opponent(owner)], cost, turnPlayer, cancer.instanceId);
        if (choice) next = openOrQueue(next, choice);
      }
    }
  }
  // RK-292。
  if (isSameCardIdentity(event.cardId, "RK-292")) {
    const ids = next.players[owner].deck.filter((c) => isSameCardIdentity(c.cardId, "RK-292") || isNamed(next, c.cardId, "クロコダイルオルフェノク格闘態")).map((c) => c.instanceId);
    if (ids.length > 0) {
      next = openOrQueue(next, {
        ...base({ playerId: owner, phasePlayerId: turnPlayer, sourceInstanceId: event.instanceId }, "RK-292"),
        effectId: SOULS_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
      });
    }
  }
  return next;
}

CHOICE_RESOLVERS[CANCER_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== commandId),
    discard: [...p.discard, stripForZone(cmd)],
  }));
  const log = logFor(state, playerId, "RK-283", `${CANCER_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`);
  const follow = cancerChoice(next, (pending.rk14Meta?.remainingIds ?? []) as PlayerId[], pending.rk14Meta?.budget ?? Number.NaN, pending.phasePlayerId, pending.sourceInstanceId);
  if (follow) return { state: openNext(next, pending, follow), log };
  return { state: proceed(next, pending), log };
};

CHOICE_RESOLVERS[SOULS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
    hand: [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-292", `${SOULS_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[SOULS_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-286 仮面ライダーオーディン【戦いのリセット】（ラッシュしたとき）
// 「次の効果を自分、相手の順に行う⇒自分自身のパワーゾーンのカード枚数を見て、その枚数よりも必要パワーの数字が大きい自分自身のユニットをすべて
//  撃破する。」（atwiki/page-1276）。ユニットを選んではいない（ブレイカーも撃破される。atwiki/page-2355 Q6）。両者の撃破はまとめて行う。

function applyBattleReset(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = [ctx.playerId, opponent(ctx.playerId)].flatMap((pid) => {
    const power = state.players[pid].power.length;
    return fieldUnits(state, pid)
      .filter((c) => {
        const n = costNumber(state, c.cardId);
        return Number.isFinite(n) && n > power;
      })
      .map((c) => c.instanceId);
  });
  if (ids.length === 0) return { state, detail: "rk286:none" };
  return { state: destroyAll(state, ctxBase(ctx), "RK-286", "rk286_battle_reset", ids), detail: `rk286:destroy=${ids.length}` };
}

// ---------------------------------------------------------------------------
// RK-287 ゴルトフェニックス【瞬間の悪夢】（ラッシュしたとき）
// 「敵軍コマンドゾーンから、モーフを持つユニットカードを1枚選び捨札にしてもよい。」（atwiki/page-1355）。ホールド・リリースを問わない。

export const NIGHTMARE_EFFECT_ID = "rk287_instant_nightmare";

function applyNightmare(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].command
    // 「相手に選ばれない」を持つカードは選べない（ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。
    .filter((c) => isUnitCard(state, c.cardId) && cardHasMorphKeyword(state.definitions, c.cardId) && !cardNotSelectableByOpponent(c.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk287:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-287"), effectId: NIGHTMARE_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: NIGHTMARE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[NIGHTMARE_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cmd = state.players[enemyId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== commandId),
    discard: [...p.discard, stripForZone(cmd)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-287", `${NIGHTMARE_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`) };
};
CHOICE_SKIPPERS[NIGHTMARE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-288 仮面ライダーデルタ【デルタムーバー】（RC）「このターン、敵軍バトルエリアのすべてのSユニットはBP-500される。（BP0以下になったユニットは
// 撃破される）」（atwiki/page-1381）。BP の修正は rules/rk/rk14Fields.ts rk14FieldBpBonus、BP0 以下の撃破はルール（R-BP-02）。

function applyDeltaMover(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: addTurnPayload(state, ctx.playerId, RK14_DELTA_MOVER_RULE, "RK-288", { instanceId: ctx.triggerSourceInstanceId }), detail: "rk288:bp-500" };
}

// ---------------------------------------------------------------------------
// RK-289 ジェットスライガー【ジェットエンジン噴射】（ライドして一緒に出たとき）
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ビークルが2体以上あれば、ライドされていない敵軍Sビークルか、ライドされていない敵軍Mビークルを
//  1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければこの効果は発動できない。」（atwiki/page-1384）
// 2体にはライドされているビークルも数える（カード評価）。敵軍のコマンドが5つなら発動しない。

export const JET_EFFECT_ID = "rk289_jet_engine";

function openJetSlider(state: GameState, playerId: PlayerId, vehicle: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  if (enemy.command.length >= COMMAND_ZONE_MAX) return state;
  const vehicles = fieldCards(state, enemyId).filter((c) => isVehicleNow(state, enemyId, c));
  if (vehicles.length < 2) return state;
  const ids = vehicles
    .filter((c) => {
      const size = getDefinition(state.definitions, c.cardId)?.size;
      const ridden = fieldCards(state, enemyId).some((u) => u.mountedOnInstanceId === c.instanceId);
      return !ridden && (size === "S" || size === "M") && selectableEnemy(state, playerId, "RK-289", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId }, "RK-289"),
    effectId: JET_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

CHOICE_RESOLVERS[JET_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = findField(state, enemyId, targetId);
  if (!target) return { error: "invalid_target" };
  let next = moveFieldCard(close(state, pending), enemyId, targetId, "command", pending.phasePlayerId);
  next = patchPlayer(next, enemyId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === targetId ? { ...c, commandHeld: true } : c)) }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-289", `${JET_EFFECT_ID}:${cardName(state.definitions, target.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-290 ロブスターオルフェノク【末期の酒】
// 「自軍ターン中、これがバトルエリアに出たとき、相手に1枚ドローさせる。その後、相手は追加条件を持たない自分自身のSユニットを1体選び撃破する。」
// （atwiki/page-1361）。エリア・BP を問わない（カード評価）。追加条件の有無は R-ADD-02（必要パワーの「＋」「－」も追加条件）。
// RK-291 ドラゴンオルフェノク魔人態【魔人の力】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」
// （atwiki/page-1366）。置くのは汎用の選択（unitDestination "power"・placeAsDamage）。

export const LOBSTER_EFFECT_ID = "rk290_last_champagne";

function openLobster(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  let next = state;
  if (next.players[enemyId].deck.length > 0) next = requestDrawFromDeck(next, enemyId, playerId, { count: 1, sourceCardId: "RK-290" }).state;
  const ids = fieldUnits(next, enemyId)
    .filter((c) => {
      const d = getDefinition(next.definitions, c.cardId);
      return !!d && rk1IsSmallNow(next, c) && !hasAdditionalCondition(d) && selectableOwn(next, enemyId, playerId, "RK-290", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return next;
  return openOrQueue(next, {
    ...base({ playerId: enemyId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-290"),
    effectId: LOBSTER_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    rk14Meta: { owner: playerId },
  });
}

CHOICE_RESOLVERS[LOBSTER_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  if (!findField(state, playerId, targetId)) return { error: "invalid_target" };
  const next = destroyAll(close(state, pending), { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-290", "rk290_last_champagne_destroy", [targetId], pending.resumeChoice);
  return { state: next, log: logFor(state, playerId, "RK-290", `${LOBSTER_EFFECT_ID}:${targetId}`) };
};

function openMajin(state: GameState, playerId: PlayerId, self: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "RK-291", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "RK-291"),
    effectId: "rk291_majin_power",
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    unitDestination: "power",
    placeAsDamage: true,
  });
}

// ---------------------------------------------------------------------------
// RK-293 センチピードオルフェノク【捕縛する鞭】
// 「これが自軍バトルエリアにある間、敵軍ターン中、次の効果を発揮できる⇒敵軍ユニットがラッシュされたとき、自軍コマンドを1つホールドしてもよい。
//  そうしたとき、相手は自分自身のコマンドを1つホールドするかしないかを選ぶ。ホールドしないことを選んだとき、そのユニットはそのターン中、バトル
//  エリアに出られない。」（atwiki/page-1362）。相手にリリース状態のコマンドがなければ「ホールドしない」として扱う（cardSpec の it.todo）。

export const WHIP_EFFECT_ID = "rk293_binding_whip";
export const WHIP_ENEMY_EFFECT_ID = "rk293_binding_whip_enemy";

function releasedCommandIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
}

function holdCommand(state: GameState, playerId: PlayerId, commandId: string): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === commandId ? { ...c, commandHeld: true } : c)) }));
}

export function openRk14WhipOnEnemyRush(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  if (phasePlayerId !== rusherPlayerId) return state;
  const defenderId = opponent(rusherPlayerId);
  const rushed = findField(state, rusherPlayerId, rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId)) return state;
  const ids = releasedCommandIds(state, defenderId);
  if (ids.length === 0) return state;
  let next = state;
  for (const centi of state.players[defenderId].battle.filter((c) => isSameCardIdentity(c.cardId, "RK-293"))) {
    next = openOrQueue(next, {
      ...base({ playerId: defenderId, phasePlayerId, sourceInstanceId: centi.instanceId }, "RK-293"),
      effectId: WHIP_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      rk14Meta: { picked: rushedInstanceId },
    });
  }
  return next;
}

function blockRushed(state: GameState, rusherId: PlayerId, instanceId: string | undefined): GameState {
  if (!instanceId || !findField(state, rusherId, instanceId)) return state;
  return patchPlayer(state, rusherId, (p) => markBattleBlocked(p, instanceId));
}

CHOICE_RESOLVERS[WHIP_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const rusherId = opponent(playerId);
  const next = holdCommand(close(state, pending), playerId, commandId);
  const log = logFor(state, playerId, "RK-293", `${WHIP_EFFECT_ID}:hold`);
  const ids = releasedCommandIds(next, rusherId);
  if (ids.length === 0) return { state: proceed(blockRushed(next, rusherId, pending.rk14Meta?.picked), pending), log };
  return {
    state: openNext(next, pending, { ...pending, playerId: rusherId, effectId: WHIP_ENEMY_EFFECT_ID, validInstanceIds: ids, selectedInstanceIds: [], optional: true, rk14Meta: { ...pending.rk14Meta, owner: playerId } }),
    log,
  };
};
CHOICE_SKIPPERS[WHIP_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[WHIP_ENEMY_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(holdCommand(close(state, pending), playerId, commandId), pending), log: logFor(state, playerId, "RK-293", `${WHIP_ENEMY_EFFECT_ID}:hold`) };
};
CHOICE_SKIPPERS[WHIP_ENEMY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(blockRushed(close(state, pending), playerId, pending.rk14Meta?.picked), pending), log: skipLog(state, playerId, "RK-293", WHIP_ENEMY_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// バトルエリアに出たとき（rules/combo.ts の進入の効果）

export function tryRk14OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[], battlePosition: number): GameState {
  if (state.activePlayer !== playerId || state.phase !== "battle") return state;
  let next = state;
  // ライドして一緒に出たビークル（RK-274・RK-289）。
  if (card.mountedOnInstanceId) {
    const vehicle = next.players[playerId].battle.find((c) => c.instanceId === card.mountedOnInstanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-274")) next = openBeatChaser(next, playerId, vehicle);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-289")) next = openJetSlider(next, playerId, vehicle);
  }
  if (isSameCardIdentity(card.cardId, "RK-275")) next = openGadoru(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-276")) next = openBazu(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-290")) next = openLobster(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-291")) next = openMajin(next, playerId, card);
  const partner = comboPartner(next, battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId));
  if (isSameCardIdentity(card.cardId, "RK-278") && partner && isNamed(next, partner.cardId, "ダークウイング")) next = openKnightSlash(next, playerId, card);
  if (isSameCardIdentity(card.cardId, "RK-284") && partner && isNamed(next, partner.cardId, "バイオグリーザ")) next = openDeathVanish(next, playerId, card);
  // RK-294【ブラッドベセル】（CN1 の NC。このターンの記録。keywords/battleKeywords.ts isBloodVesselStrikeActive）。
  if (isSameCardIdentity(card.cardId, "RK-294")) {
    const def = getDefinition(next.definitions, card.cardId);
    if (def && ncEffectiveNumber(next, playerId, card, def) === battlePosition) {
      next = addTurnPayload(next, playerId, RK14_BLOOD_VESSEL_RULE, "RK-294", { instanceId: card.instanceId });
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK14_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-277::ultimate_darkness": (state, ctx) => applyMajikiStack(state, ctx),
  "RK-279::dark_visor_zwei": applyDarkVisor,
  "RK-286::battle_reset": applyBattleReset,
  "RK-287::instant_nightmare": applyNightmare,
  "RK-288::delta_mover": applyDeltaMover,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-274::new_machine": noop("rk274:vehicle_entry"),
  "RK-275::zabaginbashigura": noop("rk275:on_enter"),
  "RK-276::kyokuginjanmama": noop("rk276:on_enter"),
  "RK-278::register_if_female": noop("rk278:register"),
  "RK-278::hishouzan": noop("rk278:combo"),
  "RK-280::shippuu_dan": noop("rk280:features"),
  "RK-281::dragon_fire_storm": noop("rk281:sp1"),
  "RK-282::scissors_attack": noop("rk282:sp12"),
  "RK-283::contract_prey": noop("rk283:on_destroy"),
  "RK-284::death_vanish": noop("rk284:combo"),
  "RK-289::jet_engine": noop("rk289:vehicle_entry"),
  "RK-290::last_champagne": noop("rk290:on_enter"),
  "RK-291::majin_power": noop("rk291:on_enter"),
  "RK-292::three_souls": noop("rk292:on_destroy"),
  "RK-292::sp1_at_5000": noop("rk292:sp1"),
  "RK-293::binding_whip": noop("rk293:enemy_rush"),
  "RK-294::blood_vessel": noop("rk294:nc"),
};

export function tryRk14CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK14_KEYWORD_PREFIX)) return null;
  const handler = RK14_KEYWORDS[keyword.slice(RK14_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
