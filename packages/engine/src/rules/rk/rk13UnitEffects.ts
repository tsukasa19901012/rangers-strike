/**
 * ザ・マスクドライダーEXP vol.4 RK-253〜RK-273（親子の絆〜仮面ライダークウガRP）のカード固有の効果（cardSpec RK13-253-273 の監査）。
 *
 * - `tryRk13CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk13::cardId::name`。RC・バトルエリアに出たとき）。
 * - `tryResolveRk13Choice` / `trySkipRk13Choice` / `tryConfirmRk13Choice`: このモジュールが開いた選択の解決。
 * - タッグの常駐 RK-253 親子の絆（rules/legend1/set8NamedEffectsA.ts registerTagResident・registerForeignTagBold）。
 * - `tryRk13OnEnterBattle`: ライドして一緒に出たビークル RK-256・RK-264・RK-265 の「これがバトルエリアに出たとき」（rules/combo.ts）。
 * - `applyRk13OnUnitLeft`: RK-258 の記録・RK-268 の※（events/listeners/unitLeftZoneListener.ts）。
 * - `collectRk13TurnEndQueue` / `openRk13TurnEndEntry`: RK-258【猛毒腐食液】・RK-260【体内マグマ】（rules/turnEndingEffects.ts）。
 * - `rk13OnAttackWin`: RK-269【シャドーセイバー】。`rk13OnBattleDestroy`: RK-271【ライジングマイティキック】（rules/operationCounters.ts）。
 * - `openRk13SplashBeforeRc` / `checkRk13SplashBeforeNc`: RK-272【ライジングスプラッシュドラゴン】（rules/ridingComboEffects.ts・rules/combo.ts）。
 * - `applyRk13AfterAction`: RK-260 の「ユニットでなくなるとき」・RK-271 の撃破（core/applyAction.ts の後処理）。
 * 継続効果の判定（RK-257・RK-262・RK-263・RK-267・RK-268）は rules/rk/rk13Fields.ts。構成は rules/rk/rk12UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { checkWinner } from "../../core/createGame";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice, requestDrawFromDeck } from "../pendingChoices";
import { grantSp1OnPlayer, patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { tryLeaveField } from "../operationCounters";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { finishForeignTagBold, registerForeignTagBold, registerTagResident } from "../legend1/set8NamedEffectsA";
import { turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { rk1IsSmallNow, rk1ZoneCardFeatures } from "./rk1Features";
import {
  RK13_FEMALE_DESTROYED_RULE,
  RK13_KICK_RULE,
  RK13_SABER_RULE,
  RK13_VOLTIC_RULE,
  rk13HasInstanceRule,
  rk13TurnPayloads,
} from "./rk13Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK13_KEYWORD_PREFIX = "rk13::";

export function isRk13ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk13Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk13Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認・「まで選ぶ」の途中の確定）。 */
export function canConfirmRk13Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk13Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk13Choice(pending)) return { error: "no_selection" };
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

function patchFieldCard(state: GameState, ownerId: PlayerId, instanceId: string, fn: (c: CardInstance) => CardInstance): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? fn(c) : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? fn(c) : c)),
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

/** 場のユニットを撃破ではない移動で持ち主のゾーンへ（山札の下・コマンドゾーン・パワーゾーン）。 */
function moveFieldUnit(state: GameState, ownerId: PlayerId, instanceId: string, toZone: "deck_bottom" | "command" | "power", phasePlayerId: PlayerId): GameState {
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

/** 場のユニットを（撃破ではなく）コストとして捨札にする。 */
function discardFieldUnitAsCost(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const card = findField(state, ownerId, instanceId);
  if (!card) return state;
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
}

/** ダメージを1点置いた後（ウラ向きのパワーを1枚増やした後）。 */
function withDamageCount(state: GameState, ownerId: PlayerId): GameState {
  const next = patchPlayer(state, ownerId, (p) => ({ ...p, damage: Math.max(p.damage + 1, p.power.filter((c) => c.faceDown).length) }));
  const winner = checkWinner(next);
  return winner ? { ...next, winner } : next;
}

const DECK_TOP = "deck_top";
const DECK_BOTTOM = "deck_bottom";

// ---------------------------------------------------------------------------
// RK-253 親子の絆（※常駐 ※タッグ）
// 「自軍ラッシュフェイズごとに1度だけ、『相手は1枚ドローしてから自分自身の手札を1枚選び、自分自身の山札の下に戻す』を実行してもよい。そうしたとき、
//  自分は1枚ドローしてから自分自身の手札を1枚選び、自分自身の山札の下に戻す。」（atwiki/page-1376）
// 相手は拒否できない（Q1）。太字部分は他のタッグの常駐にも貸す（カード評価「タッグのテキスト置き換えとしても非常に優秀」）。

export const OYAKO_OPPONENT_EFFECT_ID = "rk253_oyako_opponent";
export const OYAKO_SELF_EFFECT_ID = "rk253_oyako_self";

function oyakoAvailable(state: GameState, playerId: PlayerId): boolean {
  const enemy = state.players[opponent(playerId)];
  return enemy.deck.length + enemy.hand.length > 0;
}

/** 太字部分: 相手は1枚ドローしてから、自分の手札を1枚選ぶ（frame は使っている常駐の選択）。 */
function openOyakoOpponent(state: GameState, userId: PlayerId, frame: PendingEffectChoice): GameState {
  const enemyId = opponent(userId);
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: frame.phasePlayerId };
  if (next.players[enemyId].deck.length > 0) next = requestDrawFromDeck(next, enemyId, frame.phasePlayerId, { count: 1, sourceCardId: "RK-253" }).state;
  const ids = next.players[enemyId].hand.map((c) => c.instanceId);
  const choice: PendingEffectChoice = {
    ...frame,
    playerId: enemyId,
    effectId: OYAKO_OPPONENT_EFFECT_ID,
    sourceCardId: "RK-253",
    kind: "select_hand",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    mayConfirm: undefined,
    rk13Meta: { owner: userId },
  };
  if (ids.length === 0) {
    // 相手の手札がなければ、戻すカードはない（太字部分を実行した扱いで続ける）。
    const outcome = afterOyakoOpponent({ ...next, pendingEffectChoice: choice }, choice);
    return "error" in outcome ? next : outcome.state;
  }
  return openEffectChoice(next, choice);
}

function afterOyakoOpponent(state: GameState, pending: PendingEffectChoice): ChoiceOutcome {
  const userId = pending.rk13Meta?.owner ?? opponent(pending.playerId);
  const host = pending.tagMeta?.hostCardId;
  const asFrame: PendingEffectChoice = { ...pending, playerId: userId, rk13Meta: undefined };
  // 他のタッグの常駐が借りた太字部分: その常駐の「そうしたとき」以降へ。
  if (host && !isSameCardIdentity(host, "RK-253")) return finishForeignTagBold({ ...state, pendingEffectChoice: undefined }, userId, asFrame);
  return oyakoAfter({ ...state, pendingEffectChoice: asFrame }, userId, asFrame);
}

/** 「そうしたとき、自分は1枚ドローしてから自分自身の手札を1枚選び、自分自身の山札の下に戻す。」 */
function oyakoAfter(state: GameState, playerId: PlayerId, frame: PendingEffectChoice): ChoiceOutcome {
  let next = close(state, frame);
  if (next.players[playerId].deck.length > 0) next = requestDrawFromDeck(next, playerId, frame.phasePlayerId, { count: 1, sourceCardId: "RK-253" }).state;
  const ids = next.players[playerId].hand.map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-253", "rk253_oyako:self_draw");
  if (ids.length === 0) return { state: proceed(next, frame), log };
  return {
    state: openNext(next, frame, {
      ...frame,
      playerId,
      effectId: OYAKO_SELF_EFFECT_ID,
      sourceCardId: "RK-253",
      kind: "select_hand",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      mayConfirm: undefined,
      tagMeta: undefined,
    }),
    log,
  };
}

function handToDeckBottom(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return null;
  return patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), deck: [...p.deck, stripForZone(card)] }));
}

registerTagResident("RK-253", {
  boldAvailable: (state, playerId) => oyakoAvailable(state, playerId),
  ownBold: (state, playerId, frame) => openOyakoOpponent(state, playerId, frame),
  after: (state, playerId, frame) => oyakoAfter(state, playerId, frame),
  directBegin: true,
});

registerForeignTagBold("RK-253", {
  available: (state, playerId) => oyakoAvailable(state, playerId),
  begin: (state, playerId, pending) => openOyakoOpponent(state, playerId, pending),
});

CHOICE_RESOLVERS[OYAKO_OPPONENT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const moved = handToDeckBottom(state, playerId, instanceId);
  if (!moved) return { error: "invalid_target" };
  const outcome = afterOyakoOpponent({ ...moved, pendingEffectChoice: pending }, pending);
  if ("error" in outcome) return outcome;
  return { state: outcome.state, log: [logFor(state, playerId, "RK-253", `${OYAKO_OPPONENT_EFFECT_ID}:deck_bottom`), outcome.log].filter(Boolean).join("\n") };
};

CHOICE_RESOLVERS[OYAKO_SELF_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const moved = handToDeckBottom(state, playerId, instanceId);
  if (!moved) return { error: "invalid_target" };
  return { state: proceed(close({ ...moved, pendingEffectChoice: pending }, pending), pending), log: logFor(state, playerId, "RK-253", `${OYAKO_SELF_EFFECT_ID}:deck_bottom`) };
};

// ---------------------------------------------------------------------------
// RK-254 仮面ライダーストロンガー【ストロンガー電キック】（RC）
// 「このターン、これはBP+2000される。さらに、このユニットのBPがすべてのユニットのBPとくらべて一番高ければ、このターン、これはSP1になる。」（atwiki/page-1398）
// すべてのユニット: 両プレイヤーのバトルエリア・ラッシュエリアのユニット。同じ BP のユニットがいても一番高いとする（カード評価）。

function applyStrongerKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !findField(state, ctx.playerId, id)) return { state };
  let next = patchFieldCard(state, ctx.playerId, id, (c) => ({ ...c, bpModifier: (c.bpModifier ?? 0) + 2000 }));
  const self = findField(next, ctx.playerId, id)!;
  const own = effectiveBp(next, ctx.playerId, self);
  const others = (["player1", "player2"] as const).flatMap((pid) =>
    fieldUnits(next, pid)
      .filter((c) => c.instanceId !== id)
      .map((c) => effectiveBp(next, pid, c)),
  );
  const highest = others.every((bp) => own >= bp);
  if (highest) next = patchPlayer(next, ctx.playerId, (p) => grantSp1OnPlayer(p, id, next.definitions));
  return { state: next, detail: `rk254:bp+2000${highest ? ":sp1" : ""}` };
}

// ---------------------------------------------------------------------------
// RK-255 電波人間タックル（2nd）【ウルトラサイクロン】（RC）
// 「このユニットを捨札にして、次の効果を発動してもよい⇒敵軍バトルエリアから必要パワーの数字が3以下のユニットを1体選び、持ち主のコマンドゾーンに
//  ホールド状態で置く。置けなければ敵軍コマンドを1つ選び、捨札にしてから置く。」（atwiki/page-1345）
// 対象を選ぶことが発動の宣言（対象がなければ発動できない）。※（仮面ライダーがいればアタックされない）は rules/legend3/restrictions.ts。

export const CYCLONE_EFFECT_ID = "rk255_ultra_cyclone";
export const CYCLONE_COMMAND_EFFECT_ID = "rk255_ultra_cyclone_command";

function applyUltraCyclone(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !findField(state, ctx.playerId, id)) return { state };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return isUnitCard(state, c.cardId) && Number.isFinite(n) && n <= 3 && selectableEnemy(state, ctx.playerId, "RK-255", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk255:no_target" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-255"), effectId: CYCLONE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: CYCLONE_EFFECT_ID,
  };
}

function placeCycloneTarget(state: GameState, pending: PendingEffectChoice, enemyId: PlayerId, targetId: string): GameState {
  return moveFieldUnit(state, enemyId, targetId, "command", pending.phasePlayerId);
}

CHOICE_RESOLVERS[CYCLONE_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  if (pending.sourceInstanceId) next = discardFieldUnitAsCost(next, playerId, pending.sourceInstanceId);
  const log = logFor(state, playerId, "RK-255", `${CYCLONE_EFFECT_ID}:${cardName(state.definitions, findField(state, enemyId, targetId)?.cardId ?? targetId)}`);
  if (next.players[enemyId].command.length >= COMMAND_ZONE_MAX) {
    return {
      state: openNext(next, pending, {
        ...pending,
        effectId: CYCLONE_COMMAND_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: next.players[enemyId].command.map((c) => c.instanceId),
        selectedInstanceIds: [],
        optional: false,
        rk13Meta: { target: targetId },
      }),
      log,
    };
  }
  return { state: proceed(placeCycloneTarget(next, pending, enemyId, targetId), pending), log };
};
CHOICE_SKIPPERS[CYCLONE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[CYCLONE_COMMAND_EFFECT_ID] = (state, playerId, commandId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cmd = state.players[enemyId].command.find((c) => c.instanceId === commandId);
  if (!cmd) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== commandId),
    discard: [...p.discard, stripForZone(cmd)],
  }));
  const target = pending.rk13Meta?.target;
  if (target) next = placeCycloneTarget(next, pending, enemyId, target);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-255", `${CYCLONE_COMMAND_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`) };
};

// ---------------------------------------------------------------------------
// ライドして一緒に出たビークルの「自軍ターン中、これがバトルエリアに出たとき」（rules/combo.ts）
// - RK-256 カブトロー【カブトローサンダー】「敵軍バトルエリアからSPが空欄でないSユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは
//   BP－1000される。（BP0以下になったユニットは撃破される）」（atwiki/page-1357）。BP0 以下の撃破はルールの撃破（core/applyAction.ts）。
// - RK-264 アクロバッター【アクロバットバーン】「これにライドしているユニットのBP以下のBPを持つユニットを、相手は自分自身のSユニットの中から1体選び、
//   自分自身の山札の下に戻す。」（atwiki/page-1373）。ライドしているユニットの今の BP。相手のエリアを問わない。強制。
// - RK-265 ライドロン【ライディングアロー】「これがライドされていれば、敵軍常駐の上に重ねたカードの上から1枚選び、持ち主の山札の下に戻してもよい。」
//   （atwiki/page-1374）。重ねたカードは後から重ねたものが上（rules/leaveEffects.ts）。
// ライドされずに出たビークルは、比べる BP・「ライドされていれば」を満たさないので何もしない。

export const THUNDER_EFFECT_ID = "rk256_kabutoro_thunder";
export const ACROBAT_EFFECT_ID = "rk264_acrobat_burn";
export const RIDING_ARROW_EFFECT_ID = "rk265_riding_arrow";

function openVehicleEntry(state: GameState, playerId: PlayerId, vehicle: CardInstance, rider: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const ctx: BaseCtx = { playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId };
  if (isSameCardIdentity(vehicle.cardId, "RK-256")) {
    const ids = state.players[enemyId].battle
      .filter((c) => {
        const d = getDefinition(state.definitions, c.cardId);
        return d?.type === "unit" && rk1IsSmallNow(state, c) && d.sp !== undefined && d.sp !== null && selectableEnemy(state, playerId, "RK-256", c);
      })
      .map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openOrQueue(state, { ...base(ctx, "RK-256"), effectId: THUNDER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  if (isSameCardIdentity(vehicle.cardId, "RK-264")) {
    const limit = effectiveBp(state, playerId, rider);
    const ids = fieldUnits(state, enemyId)
      .filter((c) => rk1IsSmallNow(state, c) && effectiveBp(state, enemyId, c) <= limit && selectableOwn(state, enemyId, playerId, "RK-264", c))
      .map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openOrQueue(state, {
      ...base(ctx, "RK-264"),
      playerId: enemyId,
      effectId: ACROBAT_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      rk13Meta: { owner: playerId },
    });
  }
  if (isSameCardIdentity(vehicle.cardId, "RK-265")) {
    const ids = state.players[enemyId].operation.flatMap((op) => {
      const top = (op.stackedCards ?? []).at(-1);
      return top ? [top.instanceId] : [];
    });
    if (ids.length === 0) return state;
    return openOrQueue(state, { ...base(ctx, "RK-265"), effectId: RIDING_ARROW_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  return state;
}

/** バトルエリアに出たとき（rules/combo.ts の進入の効果）。card がライドして出たユニットなら、一緒に出たビークルの効果。 */
export function tryRk13OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const vehicleId = card.mountedOnInstanceId;
  if (!vehicleId || state.activePlayer !== playerId || state.phase !== "battle") return state;
  const vehicle = state.players[playerId].battle.find((c) => c.instanceId === vehicleId);
  if (!vehicle) return state;
  return openVehicleEntry(state, playerId, vehicle, card);
}

CHOICE_RESOLVERS[THUNDER_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchFieldCard(close(state, pending), enemyId, targetId, (c) => ({ ...c, bpModifier: (c.bpModifier ?? 0) - 1000 }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-256", `${THUNDER_EFFECT_ID}:bp-1000`) };
};
CHOICE_SKIPPERS[THUNDER_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[ACROBAT_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), playerId, targetId, "deck_bottom", pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-264", `${ACROBAT_EFFECT_ID}:deck_bottom`) };
};

CHOICE_RESOLVERS[RIDING_ARROW_EFFECT_ID] = (state, playerId, stackedId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const op = state.players[enemyId].operation.find((c) => (c.stackedCards ?? []).at(-1)?.instanceId === stackedId);
  if (!op) return { error: "invalid_target" };
  const card = op.stackedCards!.at(-1)!;
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    operation: p.operation.map((c) => (c.instanceId === op.instanceId ? { ...c, stackedCards: (c.stackedCards ?? []).slice(0, -1) } : c)),
    deck: [...p.deck, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-265", `${RIDING_ARROW_EFFECT_ID}:deck_bottom`) };
};
CHOICE_SKIPPERS[RIDING_ARROW_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 場を離れたとき（events/listeners/unitLeftZoneListener.ts）
// - RK-258 の記録: ターンのプレイヤーが、特徴「女」を持つ敵軍ユニットを撃破して捨札にした（特徴は場を離れた後のカードの特徴で見る）。
// - RK-268 デスガロンの※「敵軍ターン中、これがバトルで撃破されて捨札になったとき、これとバトルしたユニットを持ち主のコマンドゾーンかパワーゾーンに
//   置いてもよい。（コマンドゾーンに置けるカードは通常5枚まで）」（atwiki/page-1349）。コマンドが5つならパワーゾーンだけ（Q1）。

export const DEATHGARON_EFFECT_ID = "rk268_deathgaron";
const DEATHGARON_COMMAND = "command";
const DEATHGARON_POWER = "power";

export type Rk13LeaveEvent = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: string;
  toZone: string;
  phasePlayerId?: PlayerId;
  destroyed?: boolean;
  battleOpponentInstanceId?: string;
};

export function applyRk13OnUnitLeft(state: GameState, event: Rk13LeaveEvent): GameState {
  if (event.toZone !== "discard" || event.destroyed === false || (event.fromZone !== "battle" && event.fromZone !== "rush")) return state;
  let next = state;
  const turnPlayer = event.phasePlayerId ?? turnPlayerOf(state);
  // RK-258【猛毒腐食液】の「このターン、特徴「女」を持つ敵軍ユニットを1体以上撃破して捨札にした」。
  if (turnPlayer !== event.ownerPlayerId && rk1ZoneCardFeatures(next, event.ownerPlayerId, event.cardId).includes("女")) {
    next = addTurnPayload(next, turnPlayer, RK13_FEMALE_DESTROYED_RULE, "RK-258", { cardId: event.cardId });
  }
  if (isSameCardIdentity(event.cardId, "RK-268") && event.battleOpponentInstanceId && turnPlayer !== event.ownerPlayerId) {
    const enemyId = opponent(event.ownerPlayerId);
    if (findField(next, enemyId, event.battleOpponentInstanceId)) {
      const modes = next.players[enemyId].command.length < COMMAND_ZONE_MAX ? [DEATHGARON_COMMAND, DEATHGARON_POWER] : [DEATHGARON_POWER];
      next = openOrQueue(next, {
        ...base({ playerId: event.ownerPlayerId, phasePlayerId: turnPlayer, sourceInstanceId: event.instanceId }, "RK-268"),
        effectId: DEATHGARON_EFFECT_ID,
        kind: "confirm",
        validInstanceIds: modes,
        selectCount: 1,
        optional: true,
        rk13Meta: { target: event.battleOpponentInstanceId },
      });
    }
  }
  return next;
}

CHOICE_RESOLVERS[DEATHGARON_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = pending.rk13Meta?.target;
  let next = close(state, pending);
  if (target) next = moveFieldUnit(next, enemyId, target, mode === DEATHGARON_COMMAND ? "command" : "power", pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-268", `${DEATHGARON_EFFECT_ID}:${mode}`) };
};
CHOICE_SKIPPERS[DEATHGARON_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 自分がターンを終えるとき（rules/turnEndingEffects.ts）
// - RK-258 ドクターケイト【猛毒腐食液】「このターン、特徴「女」を持つ敵軍ユニットを1体以上撃破して捨札にしたなら、自分がターンを終えるとき、
//   相手に1点ダメージを与えてもよい。」（atwiki/page-1256）。撃破したのはこのカードに限らない（自分のターンに自分が撃破した）。ケイト1体ごとに。
// - RK-260 一ツ目タイタン【体内マグマ】「これが自軍エリアにある間、自分がターンを終えるとき、自軍捨札からカードを1枚選び、これの下にウラ向きで
//   重ねてもよい。」（atwiki/page-1257）

export const KATE_EFFECT_ID = "rk258_poison";
export const TITAN_STACK_EFFECT_ID = "rk260_magma_stack";

export function collectRk13TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const units = fieldUnits(state, endingPlayerId);
  const entries: string[] = [];
  if (rk13TurnPayloads(state, endingPlayerId, RK13_FEMALE_DESTROYED_RULE).length > 0) {
    entries.push(...units.filter((c) => isSameCardIdentity(c.cardId, "RK-258")).map((c) => `kate:${c.instanceId}`));
  }
  entries.push(...units.filter((c) => isSameCardIdentity(c.cardId, "RK-260")).map((c) => `titan:${c.instanceId}`));
  return entries;
}

export function openRk13TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  if (!zoneOfField(state, endingPlayerId, instanceId)) return state;
  const ctx: BaseCtx = { playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId };
  if (kind === "kate") return openEffectChoice(state, confirmChoice(ctx, "RK-258", KATE_EFFECT_ID));
  if (kind === "titan") {
    const ids = state.players[endingPlayerId].discard.map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openEffectChoice(state, { ...base(ctx, "RK-260"), effectId: TITAN_STACK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  return state;
}

CHOICE_RESOLVERS[KATE_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[KATE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-258", KATE_EFFECT_ID) };
};
CHOICE_CONFIRMERS[KATE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = applyDamageToPlayer(close(state, pending), opponent(playerId), 1, { kind: "none", activePlayer: pending.phasePlayerId });
  return { state: next, log: logFor(state, playerId, "RK-258", `${KATE_EFFECT_ID}:damage`) };
};

CHOICE_RESOLVERS[TITAN_STACK_EFFECT_ID] = (state, playerId, cardId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === cardId);
  const titanId = pending.sourceInstanceId;
  if (!card || !titanId) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== cardId) }));
  next = patchFieldCard(next, playerId, titanId, (c) => ({ ...c, stackedCards: [...(c.stackedCards ?? []), { ...stripForZone(card), faceDown: true }] }));
  return { state: next, log: logFor(state, playerId, "RK-260", `${TITAN_STACK_EFFECT_ID}:stack`) };
};
CHOICE_SKIPPERS[TITAN_STACK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-260", TITAN_STACK_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-260 一ツ目タイタン【体内マグマ】の後半
// 「これがユニットでなくなるとき、この下に重ねたウラ向きのカードをすべて捨札にする。そうして捨札にするとき、それが敵軍ターン中なら、捨札にするカード
//  1枚につき、そのカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破してもよい。」（atwiki/page-1257）
// アクションの前後で、場にあったタイタン（ウラ向きのカードを重ねたもの）が場を離れていたら処理する（applyRk13AfterAction）。

export const TITAN_DESTROY_EFFECT_ID = "rk260_magma_destroy";

function titanTargets(state: GameState, ownerId: PlayerId, cost: number): string[] {
  const enemyId = opponent(ownerId);
  return fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && costNumber(state, c.cardId) === cost && selectableEnemy(state, ownerId, "RK-260", c))
    .map((c) => c.instanceId);
}

/** 残りの重ねたカード（必要パワーの数字）について、撃破する敵軍 S ユニットの選択を開く（候補がない数字は飛ばす）。 */
function openTitanDestroy(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId, costs: number[], resume?: PendingEffectChoice): GameState {
  for (let i = 0; i < costs.length; i++) {
    const ids = titanTargets(state, ownerId, costs[i]!);
    if (ids.length === 0) continue;
    return openOrQueue(state, {
      ...base({ playerId: ownerId, phasePlayerId }, "RK-260"),
      effectId: TITAN_DESTROY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      rk13Meta: { costs: costs.slice(i + 1) },
      resumeChoice: resume,
    });
  }
  return resume ? openOrQueue(state, resume) : state;
}

function titanAfterDestroyChoice(state: GameState, pending: PendingEffectChoice): GameState {
  const rest = pending.rk13Meta?.costs ?? [];
  if (rest.length === 0) return proceed(state, pending);
  if (state.pendingEffectChoice || state.pendingLeave || state.pendingRegister) {
    // 撃破の誘発が開いた: その後に続きを開く。
    const next = openTitanDestroy({ ...state, pendingEffectChoice: undefined }, pending.playerId, pending.phasePlayerId, rest, pending.resumeChoice);
    const opened = next.pendingEffectChoice;
    if (!opened) return state;
    if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, opened) };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: opened }] };
  }
  return openTitanDestroy(state, pending.playerId, pending.phasePlayerId, rest, pending.resumeChoice);
}

CHOICE_RESOLVERS[TITAN_DESTROY_EFFECT_ID] = (state, playerId, targetId) => {
  const pending = state.pendingEffectChoice!;
  const ctx: BaseCtx = { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  const destroyed = destroyAll(close(state, pending), ctx, "RK-260", "rk260_magma_kill", [targetId]);
  return { state: titanAfterDestroyChoice(destroyed, pending), log: logFor(state, playerId, "RK-260", `${TITAN_DESTROY_EFFECT_ID}:${targetId}`) };
};
CHOICE_SKIPPERS[TITAN_DESTROY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: titanAfterDestroyChoice(close(state, pending), pending), log: skipLog(state, playerId, "RK-260", TITAN_DESTROY_EFFECT_ID) };
};

/** 場を離れたタイタンの下のウラ向きのカードを捨札にし、敵軍ターン中なら撃破の選択を開く。 */
function settleTitans(prev: GameState, next: GameState): GameState {
  let out = next;
  for (const ownerId of ["player1", "player2"] as const) {
    for (const titan of fieldCards(prev, ownerId)) {
      if (!isSameCardIdentity(titan.cardId, "RK-260")) continue;
      const under = (titan.stackedCards ?? []).filter((c) => c.faceDown);
      if (under.length === 0 || findField(out, ownerId, titan.instanceId)) continue;
      const underIds = new Set(under.map((c) => c.instanceId));
      // 離れた先のタイタンのカードから重ねたカードを外し、まだ捨札にないものを捨札にする。
      out = patchPlayer(out, ownerId, (p) => {
        const strip = (cards: CardInstance[]) =>
          cards.map((c) => {
            if (c.instanceId !== titan.instanceId || !c.stackedCards) return c;
            const rest = c.stackedCards.filter((s) => !underIds.has(s.instanceId));
            if (rest.length > 0) return { ...c, stackedCards: rest };
            const { stackedCards: _s, ...without } = c;
            return without as CardInstance;
          });
        const discard = strip(p.discard);
        const missing = under.filter((u) => !discard.some((d) => d.instanceId === u.instanceId)).map(stripForZone);
        return { ...p, hand: strip(p.hand), deck: strip(p.deck), power: strip(p.power), command: strip(p.command), discard: [...discard, ...missing] };
      });
      const turnPlayer = turnPlayerOf(prev);
      if (turnPlayer !== ownerId) {
        out = openTitanDestroy(out, ownerId, turnPlayer, under.map((c) => costNumber(out, c.cardId)).filter((n) => Number.isFinite(n)));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// RK-259 ジェネラルシャドウ【トランプ占い】（自軍ターン中、バトルエリアに出たとき）
// 「自軍山札の上から1枚をオモテにする。そして、オモテにしたカードの必要パワーの数字を見て、その数字が「1」「3」「5」のどれかなら、このターン、これは
//  BP+4000され、「2」「4」「6」のどれかなら、相手は1枚ドローしてもよい。「7」以上なら、このターン、これは「SP1」になる。その後、オモテにしたカードは
//  山札の下に戻す。」（atwiki/page-1258）。相手のドローは相手の山札から（オモテにしたカードには関係しない）ので、先に山札の下に戻す。

export const TAROT_DRAW_EFFECT_ID = "rk259_tarot_draw";

function applyTarot(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || state.activePlayer !== ctx.playerId || !findField(state, ctx.playerId, id)) return { state, detail: "rk259:not_own_turn" };
  const top = state.players[ctx.playerId].deck[0];
  if (!top) return { state, detail: "rk259:empty_deck" };
  const n = costNumber(state, top.cardId);
  let next = patchPlayer(state, ctx.playerId, (p) => ({ ...p, deck: [...p.deck.slice(1), p.deck[0]!] }));
  next = { ...next, log: [...next.log, buildLogEntry(ctx.playerId, "reveal", "RK-259", state.definitions, `rk259_tarot:${cardName(state.definitions, top.cardId)}:${Number.isFinite(n) ? n : "none"}`)] };
  if (n === 1 || n === 3 || n === 5) {
    next = patchFieldCard(next, ctx.playerId, id, (c) => ({ ...c, bpModifier: (c.bpModifier ?? 0) + 4000 }));
  } else if (n === 2 || n === 4 || n === 6) {
    next = openOrQueue(next, confirmChoice({ playerId: opponent(ctx.playerId), phasePlayerId: ctx.phasePlayerId, sourceInstanceId: id }, "RK-259", TAROT_DRAW_EFFECT_ID));
  } else if (Number.isFinite(n) && n >= 7) {
    next = patchPlayer(next, ctx.playerId, (p) => grantSp1OnPlayer(p, id, next.definitions));
  }
  return { state: next, detail: `rk259_tarot:${n}` };
}

CHOICE_RESOLVERS[TAROT_DRAW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TAROT_DRAW_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[TAROT_DRAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = requestDrawFromDeck(close(state, pending), playerId, pending.phasePlayerId, { count: 1, sourceCardId: "RK-259" }).state;
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-259", `${TAROT_DRAW_EFFECT_ID}:draw`) };
};

// ---------------------------------------------------------------------------
// RK-261 仮面ライダーBLACK RX【リボルケイン】（RC）
// 「敵軍捨て札からオペレーションカードを1枚選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1242）

export const REVOLCANE_EFFECT_ID = "rk261_revolcane";

function applyRevolcane(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].discard.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "operation").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk261:no_operation" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-261"), effectId: REVOLCANE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: REVOLCANE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[REVOLCANE_EFFECT_ID] = (state, playerId, cardId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === cardId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== cardId),
    power: [...p.power, { ...stripForZone(card), faceDown: true }],
  }));
  next = withDamageCount(next, enemyId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-261", `${REVOLCANE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[REVOLCANE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-262 ロボライダー【ボルティックシューター】（RC）・RK-271 クウガRM【ライジングマイティキック】（RC）: RC を発動したユニットを記録する。

function markRc(ruleId: string, cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const id = ctx.triggerSourceInstanceId;
    if (!id) return { state };
    return { state: addTurnPayload(state, ctx.playerId, ruleId, cardId, { instanceId: id }), detail: ruleId };
  };
}

// ---------------------------------------------------------------------------
// RK-266 機甲隊長ガテゾーン【ショットガン】（RC）
// 「敵軍ラッシュエリアのユニットを、BPの合計が3000以下になるように選び撃破してもよい。ただし、選べるユニットの数は、特徴「メカ」を持つ自軍ユニットの数
//  までとする。」（atwiki/page-1259）。BP は今の BP（「本来の」の指定がない）。「メカ」の自軍ユニットはエリアを問わず、これ自身を含む。

export const SHOTGUN_EFFECT_ID = "rk266_shotgun";
const SHOTGUN_BUDGET = 3000;

function shotgunCandidates(state: GameState, playerId: PlayerId, budget: number, exclude: string[]): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].rush
    .filter((c) => isUnitCard(state, c.cardId) && !exclude.includes(c.instanceId) && effectiveBp(state, enemyId, c) <= budget && selectableEnemy(state, playerId, "RK-266", c))
    .map((c) => c.instanceId);
}

function applyShotgun(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const mecha = fieldUnits(state, ctx.playerId).filter((c) => unitFeatures(state, ctx.playerId, c).includes("メカ")).length;
  const ids = shotgunCandidates(state, ctx.playerId, SHOTGUN_BUDGET, []);
  if (mecha === 0 || ids.length === 0) return { state, detail: "rk266:no_target" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-266"),
      effectId: SHOTGUN_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: mecha,
      optional: true,
      mayConfirm: true,
      rk13Meta: { budget: SHOTGUN_BUDGET, remaining: mecha },
    }),
    detail: SHOTGUN_EFFECT_ID,
  };
}

function finishShotgun(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  const ctx: BaseCtx = { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  const next = destroyAll(close(state, pending), ctx, "RK-266", "rk266_shotgun_kill", selected, pending.resumeChoice);
  return { state: next, log: logFor(state, playerId, "RK-266", `${SHOTGUN_EFFECT_ID}:${selected.length}`) };
}

CHOICE_RESOLVERS[SHOTGUN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = findField(state, enemyId, instanceId);
  if (!card) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const budget = (pending.rk13Meta?.budget ?? SHOTGUN_BUDGET) - effectiveBp(state, enemyId, card);
  const remaining = (pending.rk13Meta?.remaining ?? 1) - 1;
  const rest = remaining > 0 ? shotgunCandidates(state, playerId, budget, selected) : [];
  if (rest.length === 0) return finishShotgun(state, playerId, pending, selected);
  return {
    state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, optional: false, rk13Meta: { budget, remaining } } },
  };
};
CHOICE_SKIPPERS[SHOTGUN_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[SHOTGUN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finishShotgun(state, playerId, pending, pending.selectedInstanceIds ?? []);
};

// ---------------------------------------------------------------------------
// RK-269 シャドームーン（2nd）【シャドーセイバー】
// 「自軍ターン中、これがアタックしてバトルに勝ったとき、追加でアタックかストライクを行ってもよい。ただし、このユニットの追加のアタックまたはストライクは、
//  1ターンに1度だけとする。」（atwiki/page-1283）。勝ったとき、このターンのアタック・ストライクの権利を1度だけ戻す（使わなくてもよい）。

/** アタックしてバトルに勝ったとき（rules/operationCounters.ts から）。 */
export function rk13OnAttackWin(state: GameState, attackerId: PlayerId, attackerInstanceId: string, phasePlayerId: PlayerId): GameState {
  const unit = findField(state, attackerId, attackerInstanceId);
  if (!unit || !isSameCardIdentity(unit.cardId, "RK-269") || phasePlayerId !== attackerId) return state;
  if (rk13HasInstanceRule(state, attackerId, RK13_SABER_RULE, attackerInstanceId)) return state;
  let next = addTurnPayload(state, attackerId, RK13_SABER_RULE, "RK-269", { instanceId: attackerInstanceId });
  next = patchPlayer(next, attackerId, (p) => {
    const rec = p.unitActionsThisTurn?.[attackerInstanceId];
    if (!rec) return p;
    return { ...p, unitActionsThisTurn: { ...p.unitActionsThisTurn, [attackerInstanceId]: { ...rec, attacked: false } } };
  });
  return patchFieldCard(next, attackerId, attackerInstanceId, (c) => ({ ...c, battleActed: false }));
}

// ---------------------------------------------------------------------------
// RK-270 チャップ【偵察】（自軍ターン中、バトルエリアに出たとき）
// 「自軍バトルエリアの「チャップ」が3体なら、敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、そのカードを山札の上に戻すか、下に戻すか選択する。」
// （atwiki/page-1390）。「3体なら」はちょうど3体（4体以上の扱いは cardSpec の it.todo）。

export const SCOUT_EFFECT_ID = "rk270_scout";
export const SCOUT_PLACE_EFFECT_ID = "rk270_scout_place";

function applyScout(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id || state.activePlayer !== ctx.playerId) return { state, detail: "rk270:not_own_turn" };
  const chaps = state.players[ctx.playerId].battle.filter((c) => isUnitCard(state, c.cardId) && sameCardName(cardName(state.definitions, c.cardId), "チャップ")).length;
  if (chaps !== 3 || state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: "rk270:no_scout" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-270", SCOUT_EFFECT_ID)), detail: SCOUT_EFFECT_ID };
}

CHOICE_RESOLVERS[SCOUT_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SCOUT_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[SCOUT_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const top = state.players[opponent(playerId)].deck[0];
  const next = close(state, pending);
  if (!top) return { state: proceed(next, pending) };
  return {
    state: openNext(next, pending, {
      ...pending,
      effectId: SCOUT_PLACE_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [DECK_TOP, DECK_BOTTOM],
      selectCount: 1,
      optional: false,
      mayConfirm: undefined,
      rk13Meta: { target: top.instanceId },
    }),
    log: logFor(state, playerId, "RK-270", `${SCOUT_EFFECT_ID}:reveal:${cardName(state.definitions, top.cardId)}`),
  };
};

CHOICE_RESOLVERS[SCOUT_PLACE_EFFECT_ID] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  if (where === DECK_BOTTOM && next.players[enemyId].deck[0]?.instanceId === pending.rk13Meta?.target) {
    next = patchPlayer(next, enemyId, (p) => ({ ...p, deck: [...p.deck.slice(1), p.deck[0]!] }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-270", `${SCOUT_PLACE_EFFECT_ID}:${where}`) };
};

// ---------------------------------------------------------------------------
// RK-271 仮面ライダークウガRM【ライジングマイティキック】（RC）
// 「これがバトルで敵軍ユニットを撃破したとき、これが撃破した敵軍ユニットのBP以下のBPを持つ、自分と相手のバトルエリアのSユニットをすべて撃破する。」
// （atwiki/page-1399）。比べる BP はバトルの時点の BP（RS-226 Q3 と同じ）。バトルで撃破したユニットは重ねて撃破しない（Q4）。撃破は、進行中の処理
// （レジストの選択等）が終わってから行う（applyRk13AfterAction）。

/** バトルで敵軍ユニットを撃破したとき（rules/operationCounters.ts のバトルの解決）。 */
export function rk13OnBattleDestroy(
  state: GameState,
  winnerId: PlayerId,
  winnerInstanceId: string,
  defeatedInstanceId: string,
  defeatedBp: number,
): GameState {
  const winner = findField(state, winnerId, winnerInstanceId);
  if (!winner || !isSameCardIdentity(winner.cardId, "RK-271") || !rk13HasInstanceRule(state, winnerId, RK13_KICK_RULE, winnerInstanceId)) return state;
  const ids = (["player1", "player2"] as const).flatMap((pid) =>
    state.players[pid].battle
      .filter((c) => c.instanceId !== defeatedInstanceId && isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && effectiveBp(state, pid, c) <= defeatedBp)
      .map((c) => c.instanceId),
  );
  if (ids.length === 0) return state;
  return { ...state, rk13PendingKick: { playerId: winnerId, ids: [...(state.rk13PendingKick?.ids ?? []), ...ids] } };
}

function blocking(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry
  );
}

// ---------------------------------------------------------------------------
// RK-272 仮面ライダークウガRD【ライジングスプラッシュドラゴン】
// 「これが自軍エリアにある間、敵軍ユニットがＮＣまたはＲＣの効果を発動させたとき、その効果を実行する前に、自分の手札からカードを1枚選び自軍山札の上に
//  戻してもよい。そうしたとき、そのNCまたはRCの効果を無効にする。」（atwiki/page-1370）
// RK-185 レッドドラス【合体吸収】で発動した RC の効果も無効にできる（Q1）。RD 1体ごとには尋ねない（1度無効にすれば足りる）。

export const SPLASH_RC_EFFECT_ID = "rk272_splash_rc";
export const SPLASH_NC_EFFECT_ID = "rk272_splash_nc";

function splashOwner(state: GameState, userId: PlayerId): { ownerId: PlayerId; rd: CardInstance } | null {
  const ownerId = opponent(userId);
  const rd = fieldCards(state, ownerId).find((c) => isSameCardIdentity(c.cardId, "RK-272"));
  if (!rd || state.players[ownerId].hand.length === 0) return null;
  return { ownerId, rd };
}

function splashChoice(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId, rd: CardInstance, effectId: string, meta: NonNullable<PendingEffectChoice["rk13Meta"]>): PendingEffectChoice {
  return {
    ...base({ playerId: ownerId, phasePlayerId, sourceInstanceId: rd.instanceId }, "RK-272"),
    effectId,
    kind: "select_hand",
    validInstanceIds: state.players[ownerId].hand.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
    rk13Meta: meta,
  };
}

/** RC の効果を実行する前（rules/ridingComboEffects.ts）。尋ねるなら選択を開いた state、尋ねなければ null。 */
export function openRk13SplashBeforeRc(state: GameState, playerId: PlayerId, card: CardInstance): GameState | null {
  if (state.rk13RcBypass === card.instanceId || state.pendingEffectChoice) return null;
  const owner = splashOwner(state, playerId);
  if (!owner) return null;
  return openEffectChoice(state, splashChoice(state, owner.ownerId, playerId, owner.rd, SPLASH_RC_EFFECT_ID, { rc: { playerId, card } }));
}

/** NC の効果を実行する前（rules/combo.ts）。進入の効果の続きでは、記録した答えを返す。 */
export function checkRk13SplashBeforeNc(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): { decision: "apply" | "negate" } | { decision: "open"; state: GameState } {
  const recorded = state.rk13NcNegation;
  if (recorded && recorded.instanceId === card.instanceId) return { decision: recorded.negate ? "negate" : "apply" };
  if (state.pendingEffectChoice) return { decision: "apply" };
  const owner = splashOwner(state, playerId);
  if (!owner) return { decision: "apply" };
  return { decision: "open", state: openEffectChoice(state, splashChoice(state, owner.ownerId, playerId, owner.rd, SPLASH_NC_EFFECT_ID, { nc: card.instanceId })) };
}

export function clearRk13NcNegation(state: GameState): GameState {
  return state.rk13NcNegation ? { ...state, rk13NcNegation: undefined } : state;
}

function handToDeckTop(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return null;
  return patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
}

CHOICE_RESOLVERS[SPLASH_RC_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const moved = handToDeckTop(state, playerId, instanceId);
  if (!moved) return { error: "invalid_target" };
  return { state: proceed(close({ ...moved, pendingEffectChoice: pending }, pending), pending), log: logFor(state, playerId, "RK-272", `${SPLASH_RC_EFFECT_ID}:negate`) };
};
CHOICE_SKIPPERS[SPLASH_RC_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const rc = pending.rk13Meta?.rc;
  let next = close(state, pending);
  if (rc) {
    const result = resolveRidingComboOnRideOff({ ...next, rk13RcBypass: rc.card.instanceId }, rc.playerId, rc.card);
    next = { ...result.state, rk13RcBypass: undefined, log: [...result.state.log, ...result.logs] };
  }
  return { state: proceed(next, pending), log: skipLog(state, playerId, "RK-272", SPLASH_RC_EFFECT_ID) };
};

CHOICE_RESOLVERS[SPLASH_NC_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const moved = handToDeckTop(state, playerId, instanceId);
  if (!moved) return { error: "invalid_target" };
  const next = { ...close({ ...moved, pendingEffectChoice: pending }, pending), rk13NcNegation: { instanceId: pending.rk13Meta?.nc ?? "", negate: true } };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-272", `${SPLASH_NC_EFFECT_ID}:negate`) };
};
CHOICE_SKIPPERS[SPLASH_NC_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = { ...close(state, pending), rk13NcNegation: { instanceId: pending.rk13Meta?.nc ?? "", negate: false } };
  return { state: proceed(next, pending), log: skipLog(state, playerId, "RK-272", SPLASH_NC_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-273 仮面ライダークウガRP【ライジングブラストペガサス】（RC）
// 「自軍ラッシュエリアのSユニットを1体以上選び手札に戻してもよい。そうしたとき、相手は次のどちらかを選び行う⇒◎手札に戻したユニットの数まで自分自身の
//  ユニットを可能な限り選び撃破する。◎自分自身のユニットを1体選びダメージにする。」（atwiki/page-1277）

export const PEGASUS_EFFECT_ID = "rk273_pegasus";
export const PEGASUS_MODE_EFFECT_ID = "rk273_pegasus_mode";
export const PEGASUS_DESTROY_EFFECT_ID = "rk273_pegasus_destroy";
export const PEGASUS_DAMAGE_EFFECT_ID = "rk273_pegasus_damage";
const PEGASUS_DESTROY = "destroy";
const PEGASUS_DAMAGE = "damage";

function applyPegasus(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].rush.filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk273:no_unit" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-273"), effectId: PEGASUS_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: ids.length, optional: true, mayConfirm: true }),
    detail: PEGASUS_EFFECT_ID,
  };
}

function pegasusVictims(state: GameState, victimId: PlayerId, userId: PlayerId): string[] {
  return fieldUnits(state, victimId)
    .filter((c) => selectableOwn(state, victimId, userId, "RK-273", c))
    .map((c) => c.instanceId);
}

function finishPegasusReturn(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  const ids = new Set(selected);
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    rush: p.rush.filter((c) => !ids.has(c.instanceId)).map((c) => (c.mountedOnInstanceId && ids.has(c.mountedOnInstanceId) ? (({ mountedOnInstanceId: _m, ...rest }) => rest as CardInstance)(c) : c)),
    hand: [...p.hand, ...p.rush.filter((c) => ids.has(c.instanceId)).map(stripForZone)],
  }));
  const enemyId = opponent(playerId);
  const log = logFor(state, playerId, "RK-273", `${PEGASUS_EFFECT_ID}:return:${selected.length}`);
  if (pegasusVictims(next, enemyId, playerId).length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, {
    ...pending,
    playerId: enemyId,
    effectId: PEGASUS_MODE_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: [PEGASUS_DESTROY, PEGASUS_DAMAGE],
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    mayConfirm: undefined,
    rk13Meta: { owner: playerId, count: selected.length },
  });
  return { state: next, log };
}

CHOICE_RESOLVERS[PEGASUS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (rest.length === 0) return finishPegasusReturn(state, playerId, pending, selected);
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, optional: false } } };
};
CHOICE_SKIPPERS[PEGASUS_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[PEGASUS_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finishPegasusReturn(state, playerId, pending, pending.selectedInstanceIds ?? []);
};

CHOICE_RESOLVERS[PEGASUS_MODE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const userId = pending.rk13Meta?.owner ?? opponent(playerId);
  const ids = pegasusVictims(state, playerId, userId);
  const next = close(state, pending);
  const log = logFor(state, playerId, "RK-273", `${PEGASUS_MODE_EFFECT_ID}:${mode}`);
  if (mode === PEGASUS_DESTROY) {
    const count = Math.min(pending.rk13Meta?.count ?? 1, ids.length);
    if (count >= ids.length) {
      const ctx: BaseCtx = { playerId: userId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
      return { state: destroyAll(next, ctx, "RK-273", "rk273_pegasus_kill", ids, pending.resumeChoice), log };
    }
    return {
      state: openNext(next, pending, { ...pending, effectId: PEGASUS_DESTROY_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: count, optional: false, rk13Meta: { owner: userId, remaining: count } }),
      log,
    };
  }
  return {
    state: openNext(next, pending, { ...pending, effectId: PEGASUS_DAMAGE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false, rk13Meta: { owner: userId } }),
    log,
  };
};

CHOICE_RESOLVERS[PEGASUS_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = (pending.rk13Meta?.remaining ?? 1) - 1;
  if (remaining > 0) {
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId), rk13Meta: { ...pending.rk13Meta, remaining } } } };
  }
  const userId = pending.rk13Meta?.owner ?? opponent(playerId);
  const ctx: BaseCtx = { playerId: userId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  return { state: destroyAll(close(state, pending), ctx, "RK-273", "rk273_pegasus_kill", selected, pending.resumeChoice), log: logFor(state, playerId, "RK-273", `${PEGASUS_DESTROY_EFFECT_ID}:${selected.length}`) };
};

CHOICE_RESOLVERS[PEGASUS_DAMAGE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const left = applyUnitLeave(close(state, pending), instanceId, "power", pending.phasePlayerId);
  if ("error" in left) return left;
  let next = left.state;
  if (next.players[playerId].power.some((c) => c.instanceId === instanceId && !c.faceDown)) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)) }));
    next = withDamageCount(next, playerId);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-273", `${PEGASUS_DAMAGE_EFFECT_ID}:damage`) };
};

// ---------------------------------------------------------------------------
// アクション後の処理（core/applyAction.ts）

export function applyRk13AfterAction(prev: GameState, next: GameState): GameState {
  let out = settleTitans(prev, next);
  const kick = out.rk13PendingKick;
  if (kick && !blocking(out) && !out.winner) {
    const ids = kick.ids.filter((id) => (["player1", "player2"] as const).some((pid) => out.players[pid].battle.some((c) => c.instanceId === id)));
    out = { ...out, rk13PendingKick: undefined };
    out = destroyAll(out, { playerId: kick.playerId, phasePlayerId: turnPlayerOf(out) }, "RK-271", "rk271_rising_mighty_kick", ids);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK13_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-254::stronger_kick": applyStrongerKick,
  "RK-255::ultra_cyclone": applyUltraCyclone,
  "RK-259::tarot": applyTarot,
  "RK-261::revolcane": applyRevolcane,
  "RK-262::voltic_shooter": markRc(RK13_VOLTIC_RULE, "RK-262"),
  "RK-266::shotgun": applyShotgun,
  "RK-270::scout": applyScout,
  "RK-271::rising_mighty_kick": markRc(RK13_KICK_RULE, "RK-271"),
  "RK-273::rising_blast_pegasus": applyPegasus,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-256::kabutoro_thunder": noop("rk256:vehicle_entry"),
  "RK-257::radar": noop("rk257:protect"),
  "RK-258::poison": noop("rk258:turn_end"),
  "RK-260::magma": noop("rk260:turn_end"),
  "RK-263::liquefy": noop("rk263:protect"),
  "RK-264::acrobat_burn": noop("rk264:vehicle_entry"),
  "RK-265::riding_arrow": noop("rk265:vehicle_entry"),
  "RK-267::kaima_inazuma": noop("rk267:no_resist"),
  "RK-268::analysis": noop("rk268:printed_bp"),
  "RK-268::battled_to_zone": noop("rk268:on_destroy"),
  "RK-269::shadow_saber": noop("rk269:attack_win"),
  "RK-272::rising_splash_dragon": noop("rk272:before_nc_rc"),
};

export function tryRk13CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK13_KEYWORD_PREFIX)) return null;
  const handler = RK13_KEYWORDS[keyword.slice(RK13_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
