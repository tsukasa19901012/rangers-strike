/**
 * 第8弾「究極の八神」（legend1）RS-560〜RS-581 のカード固有の名前付き効果（cardSpec RS8-560-581 で未実装だったもの）。
 *
 * - `trySet8CCardEffect`: DSL の grant_keyword（`set8c::cardId::name`、または既存のキーワード）から呼ばれる起点。
 * - `tryResolveSet8CChoice` / `trySkipSet8CChoice` / `tryConfirmSet8CChoice`: このモジュールが開いた選択の解決。
 * - 常時効果（アタックの可否）・誘発（撃破の置き換え・ターンを終えたとき・シャッフルされたとき）の判定は、
 *   それぞれの処理（rules/legend3/restrictions.ts・rules/operationCounters.ts・rules/turnEndingEffects.ts・core/applyAction.ts）から呼ぶ。
 * 構成は rules/legend1/set7NamedEffectsC.ts と同じ。
 */
import { resolveZordFusionPartnerSlots, resolveZordFusionSlotAlternatives } from "../../dsl/zordBridge";
import { canonicalCardName } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { cardName, cardCategories, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { isSmallUnitNow, turnPlayerOf } from "./set6NamedEffectsB";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { requiresFusionPartnerReturn } from "@rangers-strike/cards";
import { shuffleCards, deckShuffledSince } from "../../core/deckShuffle";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
type ChoiceConfirmer = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceConfirmer> = {};
/** 確定（confirm_effect_choice）できる状態かの判定。 */
const CHOICE_CAN_CONFIRM: Record<string, (state: GameState, pending: PendingEffectChoice) => boolean> = {};

export function isSet8CChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 複数選んで確定する選択で、いま確定できるか（合法手 confirm_effect_choice）。 */
export function canConfirmSet8CChoice(state: GameState, pending: PendingEffectChoice): boolean {
  const check = CHOICE_CAN_CONFIRM[pending.effectId];
  return !!check && check(state, pending);
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet8CChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet8CChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!CHOICE_RESOLVERS[pending.effectId]) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 複数選んだ選択を確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet8CChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return CHOICE_RESOLVERS[pending.effectId] ? { error: "not_confirmable" } : null;
  if (!canConfirmSet8CChoice(state, pending)) return { error: "not_confirmable" };
  return confirmer(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

/** 選択を閉じる（続きの処理はまだしない）。 */
function close(state: GameState, pending: PendingEffectChoice): GameState {
  return state.pendingEffectChoice === pending
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
}

/** 閉じたあとの続き: 割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入を続ける。 */
function proceed(state: GameState, pending: PendingEffectChoice): GameState {
  if (state.pendingLeave || state.pendingEffectChoice || state.pendingDamagePayment) return state;
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

function finish(state: GameState, pending: PendingEffectChoice): GameState {
  return proceed(close(state, pending), pending);
}

function simpleSkip(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, cardId, pending.effectId) };
  };
}

function strip(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function isUnitCard(state: GameState, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => isUnitCard(state, c.cardId));
}

function inOwnField(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  const p = state.players[playerId];
  return p.battle.some((c) => c.instanceId === instanceId) || p.rush.some((c) => c.instanceId === instanceId);
}

function powerNumber(state: GameState, cardId: string): number {
  return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost ?? 0);
}

/** 場のユニットの付加情報を書き換える（バトル・ラッシュエリアのどちらにあっても）。 */
function patchFieldCard(state: GameState, playerId: PlayerId, instanceId: string, fn: (c: CardInstance) => CardInstance): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? fn(c) : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? fn(c) : c)),
  }));
}

function drawCards(state: GameState, playerId: PlayerId, count: number): GameState {
  return patchPlayer(state, playerId, (p) => {
    const n = Math.min(count, p.deck.length);
    return { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) };
  });
}

/** 「確認」の選択（効果のユニット自身を選ぶと行う。見送れば行わない）。 */
function openConfirm(
  state: GameState,
  ctx: GrantKeywordContext,
  effectId: string,
  playerId: PlayerId = ctx.playerId,
): GameState {
  const self = ctx.triggerSourceInstanceId ?? effectId;
  return openEffectChoice(state, {
    playerId,
    effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "confirm",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [self],
    selectedInstanceIds: [],
    optional: true,
  });
}

// ---------------------------------------------------------------------------
// RS-562 ガオソーシャーク ※
// 「※これは自軍捨札にあるユニットカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ラッシュエリアのユニットに
//  アタックできる。」（atwiki/page-1182）— 必要パワー「7+」等は数字（7）で比べる（R-ADD-01）。
// RS-573 ファイヤーカイザー（2nd）【バリランサー】でホールドしたターンは、敵軍ラッシュエリアのユニットにアタックできる。

export const BARI_LANCER_MARK = "rs573_bari_lancer";

/** 敵軍ラッシュエリアのユニットにアタックできる（このモジュールのカード）なら true。 */
export function set8CAllowsRushAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  if (attacker.cardId === "RS-562") {
    const cost = powerNumber(state, defender.cardId);
    return state.players[attackerPlayerId].discard.some(
      (c) => isUnitCard(state, c.cardId) && powerNumber(state, c.cardId) === cost,
    );
  }
  if (attacker.cardId === "RS-573") return (attacker.activatedNcEffects ?? []).includes(BARI_LANCER_MARK);
  return false;
}

// ---------------------------------------------------------------------------
// RS-578 レジェンドマジグリーンRA【岩の装甲】
// 「これが自軍バトルエリアにある間、敵軍ターン中、「レジェンドマジグリーンRA」以外の特徴「魔法」を持つ自軍Sユニットは
//  アタックされない。」（atwiki/page-1220）

/** 守備側がこのモジュールの効果でアタックされないなら true。 */
export function set8CDefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  if (turnPlayerOf(state) === defenderPlayerId) return false;
  const owner = state.players[defenderPlayerId];
  if (!owner.battle.some((c) => c.cardId === "RS-578")) return false;
  if (canonicalCardName(cardName(state.definitions, defender.cardId)) === canonicalCardName("レジェンドマジグリーンRA")) return false;
  if (!isSmallUnitNow(state, defenderPlayerId, defender)) return false;
  return unitFeatures(state, defenderPlayerId, defender).includes("魔法");
}

// ---------------------------------------------------------------------------
// RS-563 ガオバッファロー【突き上げる角】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ユニットを1体選びホールドしてもよい。ただし、必要パワーの数字が
//  敵軍ダメージの点数以下のユニットしか選べない。」（atwiki/page-1183）— バトル・ラッシュエリアを問わず、その場でホールドする。

export const RAISING_HORN_EFFECT_ID = "rs563_raising_horn";

function openRaisingHorn(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${RAISING_HORN_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const limit = state.players[enemyId].damage;
  const ids = fieldUnits(state, enemyId)
    .filter((c) => powerNumber(state, c.cardId) <= limit)
    .filter((c) => isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId, ctx.sourceCardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${RAISING_HORN_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: RAISING_HORN_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: RAISING_HORN_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[RAISING_HORN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const next = patchFieldCard(state, found.playerId, instanceId, (c) => ({ ...c, commandHeld: true }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-563", `${RAISING_HORN_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`) };
};
CHOICE_SKIPPERS[RAISING_HORN_EFFECT_ID] = simpleSkip("RS-563");

// ---------------------------------------------------------------------------
// RS-565 轟雷旋風神【ローリングサンダーハリケーン】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアのSユニットをすべて持ち主の手札に戻してもよい。
//  そうしたとき、相手は自分自身の手札からカードを1枚選び、自分自身の山札に戻してシャッフルする。」（atwiki/page-1187）

export const ROLLING_THUNDER_EFFECT_ID = "rs565_rolling_thunder";
export const ROLLING_THUNDER_RETURN_EFFECT_ID = "rs565_rolling_thunder_return";

function rollingThunderTargets(state: GameState, enemyId: PlayerId): CardInstance[] {
  return state.players[enemyId].rush.filter((c) => isUnitCard(state, c.cardId) && isSmallUnitNow(state, enemyId, c));
}

function openRollingThunder(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${ROLLING_THUNDER_EFFECT_ID}:not_own_turn` };
  if (rollingThunderTargets(state, opponent(ctx.playerId)).length === 0) {
    return { state, detail: `${ROLLING_THUNDER_EFFECT_ID}:no_targets` };
  }
  return { state: openConfirm(state, ctx, ROLLING_THUNDER_EFFECT_ID), detail: ROLLING_THUNDER_EFFECT_ID };
}

CHOICE_RESOLVERS[ROLLING_THUNDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const targets = rollingThunderTargets(state, enemyId);
  const ids = new Set(targets.map((c) => c.instanceId));
  let next = patchPlayer(close(state, pending), enemyId, (p) => {
    const returned = p.rush.filter((c) => ids.has(c.instanceId)).map(strip);
    // ライドしていたユニットが戻ったビークルはライドされていない状態になる。
    const unmount = (c: CardInstance) => {
      if (!c.mountedOnInstanceId || !ids.has(c.mountedOnInstanceId)) return c;
      const { mountedOnInstanceId: _m, ...rest } = c;
      return rest as CardInstance;
    };
    return {
      ...p,
      rush: p.rush.filter((c) => !ids.has(c.instanceId)).map(unmount),
      battle: p.battle.map(unmount),
      hand: [...p.hand, ...returned],
      discard: [...p.discard, ...targets.flatMap((c) => (c.stackedCards ?? []).map(strip))],
    };
  });
  const log = logFor(state, playerId, "RS-565", `${ROLLING_THUNDER_EFFECT_ID}:${targets.length}`);
  if (targets.length === 0 || next.players[enemyId].hand.length === 0) return { state: proceed(next, pending), log };
  // 「相手は自分自身の手札からカードを1枚選び」— 選ぶのは相手。
  next = openEffectChoice(next, {
    playerId: enemyId,
    effectId: ROLLING_THUNDER_RETURN_EFFECT_ID,
    sourceCardId: "RS-565",
    sourceInstanceId: pending.sourceInstanceId,
    kind: "select_hand",
    phasePlayerId: pending.phasePlayerId,
    validInstanceIds: next.players[enemyId].hand.map((c) => c.instanceId),
    selectCount: 1,
    optional: false,
    ...(pending.resumeChoice ? { resumeChoice: pending.resumeChoice } : {}),
  });
  return { state: next, log };
};
CHOICE_SKIPPERS[ROLLING_THUNDER_EFFECT_ID] = simpleSkip("RS-565");

CHOICE_RESOLVERS[ROLLING_THUNDER_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    deck: shuffleCards([...p.deck, strip(card)]),
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-565", `${ROLLING_THUNDER_RETURN_EFFECT_ID}:deck`) };
};

// ---------------------------------------------------------------------------
// RS-566 天雷旋風神【絶対究極奥義アルティマストーム】
// 「これをラッシュしたとき、これ以外のすべてのユニットと、すべてのコマンドゾーンのカードを持ち主の山札に戻してシャッフルする。」
// （atwiki/page-1229）— 両軍のバトル・ラッシュエリアのユニット（ビークルはユニットではないので残る）とコマンドゾーンのカード。
// 重ねたカード（常駐の重ね等）は持ち主の捨札にする（R-ZONE-04）。

function applyUltimaStorm(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  let next = state;
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    next = patchPlayer(next, pid, (p) => {
      const leaving = (c: CardInstance) => c.instanceId !== self && isUnitCard(next, c.cardId);
      const units = [...p.battle, ...p.rush].filter(leaving);
      const ids = new Set(units.map((c) => c.instanceId));
      const unmount = (c: CardInstance) => {
        if (!c.mountedOnInstanceId || !ids.has(c.mountedOnInstanceId)) return c;
        const { mountedOnInstanceId: _m, ...rest } = c;
        return rest as CardInstance;
      };
      count += units.length + p.command.length;
      return {
        ...p,
        battle: p.battle.filter((c) => !ids.has(c.instanceId)).map(unmount),
        rush: p.rush.filter((c) => !ids.has(c.instanceId)).map(unmount),
        command: [],
        discard: [...p.discard, ...[...units, ...p.command].flatMap((c) => (c.stackedCards ?? []).map(strip))],
        deck: shuffleCards([...p.deck, ...units.map(strip), ...p.command.map(strip)]),
      };
    });
  }
  return { state: next, detail: `rs566_ultima_storm:${count}` };
}

// ---------------------------------------------------------------------------
// RS-567 トライコンドル【カラクリ忍法・消身の術】
// 「これが自軍エリアにある間、敵軍ターン中、合体を必要とする自軍Lユニットが撃破されたとき、捨札にするかわりに自軍パワーゾーンに
//  送ってもよい。そうしたとき、相手がそのターンを終えたとき、この効果で自軍パワーゾーンに送ったユニットカードが自軍パワーゾーンに
//  オモテ向きであれば、自分はそのユニットカードを自軍ラッシュエリアに出してもよい。」（atwiki/page-1188）
// 置き換えの選択は「撃破されて捨札になる」処理（rules/toPowerOnDestroy.ts の選択）を共用する。

export const VANISH_RUSH_EFFECT_ID = "rs567_vanish_rush";

/** 撃破されて捨札になるユニットに【消身の術】を使えるなら、効果のユニット（トライコンドル）の instanceId。 */
export function triConcordVanishSource(state: GameState, pending: PendingLeave): string | null {
  if (pending.toZone !== "discard" || pending.notDestruction) return null;
  const ownerId = pending.ownerPlayerId;
  if (pending.phasePlayerId === ownerId) return null;
  const def = getDefinition(state.definitions, pending.leavingCardId);
  if (def?.type !== "unit" || def.size !== "L") return null;
  if (!requiresFusionPartnerReturn(pending.leavingCardId)) return null;
  const owner = state.players[ownerId];
  const condor = [...owner.battle, ...owner.rush].find(
    (c) => c.cardId === "RS-567" && c.instanceId !== pending.instanceId,
  );
  return condor?.instanceId ?? null;
}

/** 【消身の術】でパワーゾーンに送ったユニットカードを記録する（相手がそのターンを終えたときに出せる）。 */
export function recordVanishedToPower(state: GameState, ownerId: PlayerId, instanceId: string, turnPlayerId: PlayerId): GameState {
  const list = state.set8cMeta?.vanishedToPower ?? [];
  return { ...state, set8cMeta: { ...state.set8cMeta, vanishedToPower: [...list, { ownerId, instanceId, turnPlayerId }] } };
}

/** 「相手がそのターンを終えたとき」の待ち行列（終えるプレイヤーのターンに送ったもの）。 */
export function collectSet8CTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return (state.set8cMeta?.vanishedToPower ?? [])
    .filter((e) => e.turnPlayerId === endingPlayerId)
    .map((e) => e.instanceId);
}

export function openSet8CTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const list = state.set8cMeta?.vanishedToPower ?? [];
  const record = list.find((e) => e.instanceId === entry && e.turnPlayerId === endingPlayerId);
  // 記録はこのターンの終わりで使い切る。
  const rest = list.filter((e) => e !== record);
  let next: GameState = { ...state, set8cMeta: { ...state.set8cMeta, vanishedToPower: rest.length > 0 ? rest : undefined } };
  if (!record) return next;
  const card = next.players[record.ownerId].power.find((c) => c.instanceId === entry && !c.faceDown);
  if (!card) return next;
  next = openEffectChoice(next, {
    playerId: record.ownerId,
    effectId: VANISH_RUSH_EFFECT_ID,
    sourceCardId: "RS-567",
    kind: "select_power",
    phasePlayerId: endingPlayerId,
    validInstanceIds: [entry],
    selectCount: 1,
    optional: true,
  });
  return next;
}

CHOICE_RESOLVERS[VANISH_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  // 効果で自軍ラッシュエリアに出す（ラッシュではない。R-RUSH-20）。
  const moved = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, strip(card)],
  }));
  const rushed = finalizeEffectRush(moved, playerId, [instanceId], pending.phasePlayerId);
  const next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-567", `${VANISH_RUSH_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[VANISH_RUSH_EFFECT_ID] = simpleSkip("RS-567");

// ---------------------------------------------------------------------------
// RS-568 風雷丸【各々方、合体で御座る！】
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、自分の手札から、特徴「メカ」を持つLユニットのカードを1枚選び相手に見せ、
//  表記された合体ユニットと同じカード名のMユニットのカードを、自分の手札からそれぞれ1枚ずつ選び、自軍ラッシュエリアに出してもよい。
//  そうしたとき、相手に見せたLユニットのカードを、自軍パワーゾーンにダメージにして置く。」（atwiki/page-1189）
// grnrngr/faq-card-8 RS-565 Q2・Q3: 合体ユニットの組み合わせ（「（または…）」のどちらで参照するか）を選び、その組み合わせの
// M ユニットをそれぞれ1枚ずつ出す（L ユニットの枠は出さない）。手札に組み合わせの M ユニットがそろっていなければならない。
// 起動は場の起動効果（rules/fieldActivatedAbilities.ts）。手札の L を選び、M を1枚ずつ選んで確定する。

export const FUSION_CALL_REVEAL_EFFECT_ID = "rs568_fusion_call_reveal";
export const FUSION_CALL_PUT_EFFECT_ID = "rs568_fusion_call_put";

/** 組み合わせごとの、出す M ユニットの枠（各枠はそのカード名として使えるパートナーの cardId）。 */
function fusionCallCombinations(state: GameState, lCardId: string): string[][][] {
  const slots = resolveZordFusionPartnerSlots(lCardId);
  if (slots.length === 0) return [];
  const alternatives = resolveZordFusionSlotAlternatives(lCardId);
  const altIndexes = [...alternatives.keys()];
  const combos: string[][][] = [];
  for (let mask = 0; mask < 1 << altIndexes.length; mask++) {
    const parts: string[][] = [];
    slots.forEach((slot, i) => {
      const bit = altIndexes.indexOf(i);
      if (bit >= 0 && (mask >> bit) & 1) parts.push(...alternatives.get(i)!);
      else parts.push(slot);
    });
    // M ユニットの枠だけを出す（L ユニット・ビークル等の枠は出さない）。
    const mParts = parts.filter((part) =>
      part.some((id) => {
        const d = getDefinition(state.definitions, id);
        return d?.type === "unit" && d.size === "M";
      }),
    );
    if (mParts.length > 0) combos.push(mParts);
  }
  return combos;
}

function handCardFitsPart(state: GameState, card: CardInstance, part: string[]): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit" || def.size !== "M") return false;
  const name = canonicalCardName(def.name);
  return part.some((id) => id === card.cardId || canonicalCardName(cardName(state.definitions, id)) === name);
}

/** cards を parts に1枚ずつ（別々の枠に）割り当てられるか。 */
function assignable(state: GameState, cards: CardInstance[], parts: string[][]): boolean {
  if (cards.length > parts.length) return false;
  const used = new Array(parts.length).fill(false);
  const go = (i: number): boolean => {
    if (i === cards.length) return true;
    for (let j = 0; j < parts.length; j++) {
      if (used[j] || !handCardFitsPart(state, cards[i]!, parts[j]!)) continue;
      used[j] = true;
      if (go(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return go(0);
}

/** 組み合わせの M ユニットが手札（except を除く）でそろうか。 */
function comboFeasible(state: GameState, hand: CardInstance[], parts: string[][]): boolean {
  const used = new Set<string>();
  const go = (j: number): boolean => {
    if (j === parts.length) return true;
    for (const c of hand) {
      if (used.has(c.instanceId) || !handCardFitsPart(state, c, parts[j]!)) continue;
      used.add(c.instanceId);
      if (go(j + 1)) return true;
      used.delete(c.instanceId);
    }
    return false;
  };
  return go(0);
}

function feasibleCombos(state: GameState, playerId: PlayerId, lInstanceId: string): string[][][] {
  const hand = state.players[playerId].hand;
  const l = hand.find((c) => c.instanceId === lInstanceId);
  if (!l) return [];
  const rest = hand.filter((c) => c.instanceId !== lInstanceId);
  return fusionCallCombinations(state, l.cardId).filter((parts) => comboFeasible(state, rest, parts));
}

function fusionCallLCandidates(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "L" && (def.features ?? []).includes("メカ");
    })
    .filter((c) => feasibleCombos(state, playerId, c.instanceId).length > 0)
    .map((c) => c.instanceId);
}

export function canActivateFusionCall(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return inOwnField(state, playerId, card.instanceId) && fusionCallLCandidates(state, playerId).length > 0;
}

export function beginFusionCall(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ids = fusionCallLCandidates(state, playerId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: FUSION_CALL_REVEAL_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_hand",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

/** 選んだ M ユニットに続けて選べる手札の M ユニット。 */
function fusionCallNextPicks(state: GameState, playerId: PlayerId, lInstanceId: string, selectedIds: string[]): string[] {
  const hand = state.players[playerId].hand;
  const selected = hand.filter((c) => selectedIds.includes(c.instanceId));
  const combos = feasibleCombos(state, playerId, lInstanceId);
  return hand
    .filter((c) => c.instanceId !== lInstanceId && !selectedIds.includes(c.instanceId))
    .filter((c) => combos.some((parts) => assignable(state, [...selected, c], parts)))
    .map((c) => c.instanceId);
}

function fusionCallComplete(state: GameState, playerId: PlayerId, lInstanceId: string, selectedIds: string[]): boolean {
  const selected = state.players[playerId].hand.filter((c) => selectedIds.includes(c.instanceId));
  if (selected.length === 0) return false;
  return feasibleCombos(state, playerId, lInstanceId).some(
    (parts) => parts.length === selected.length && assignable(state, selected, parts),
  );
}

CHOICE_RESOLVERS[FUSION_CALL_REVEAL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const l = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!l) return { error: "invalid_target" };
  const next: GameState = {
    ...state,
    pendingEffectChoice: {
      ...pending,
      effectId: FUSION_CALL_PUT_EFFECT_ID,
      kind: "select_hand",
      set8cRevealedInstanceId: instanceId,
      validInstanceIds: fusionCallNextPicks(state, playerId, instanceId, []),
      selectedInstanceIds: [],
      selectCount: undefined,
      optional: true,
    },
  };
  return { state: next, log: logFor(state, playerId, "RS-568", `${FUSION_CALL_REVEAL_EFFECT_ID}:${cardName(state.definitions, l.cardId)}`) };
};
CHOICE_SKIPPERS[FUSION_CALL_REVEAL_EFFECT_ID] = simpleSkip("RS-568");

CHOICE_RESOLVERS[FUSION_CALL_PUT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const lId = pending.set8cRevealedInstanceId!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        selectedInstanceIds: selected,
        validInstanceIds: fusionCallNextPicks(state, playerId, lId, selected),
      },
    },
  };
};
CHOICE_SKIPPERS[FUSION_CALL_PUT_EFFECT_ID] = simpleSkip("RS-568");
CHOICE_CAN_CONFIRM[FUSION_CALL_PUT_EFFECT_ID] = (state, pending) =>
  !!pending.set8cRevealedInstanceId &&
  fusionCallComplete(state, pending.playerId, pending.set8cRevealedInstanceId, pending.selectedInstanceIds ?? []);
CHOICE_CONFIRMERS[FUSION_CALL_PUT_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const lId = pending.set8cRevealedInstanceId!;
  const ids = pending.selectedInstanceIds ?? [];
  const l = state.players[playerId].hand.find((c) => c.instanceId === lId);
  if (!l) return { error: "invalid_target" };
  const moved = patchPlayer(close(state, pending), playerId, (p) => {
    const picked = p.hand.filter((c) => ids.includes(c.instanceId)).map(strip);
    return { ...p, hand: p.hand.filter((c) => !ids.includes(c.instanceId)), rush: [...p.rush, ...picked] };
  });
  const rushed = finalizeEffectRush(moved, playerId, ids, pending.phasePlayerId);
  // 「そうしたとき、相手に見せたLユニットのカードを、自軍パワーゾーンにダメージにして置く」。
  const next = patchPlayer({ ...rushed.state, log: [...rushed.state.log, ...rushed.logs] }, playerId, (p) => {
    if (!p.hand.some((c) => c.instanceId === lId)) return p;
    return {
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== lId),
      power: [...p.power, { ...strip(l), faceDown: true }],
      damage: p.damage + 1,
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-568", `${FUSION_CALL_PUT_EFFECT_ID}:${ids.length}`) };
};

// ---------------------------------------------------------------------------
// RS-569 スーパーデカレンジャーロボ【ガトリングパンチ】
// 「自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーを好きな枚数選び捨札にしてもよい。そうしたとき、
//  このターン、これは捨札にしたカード3枚につき「SP+1」される。」（atwiki/page-1230）
// 1枚ずつ選び、確定で捨札にする（見送れば何もしない）。

export const GATLING_PUNCH_EFFECT_ID = "rs569_gatling_punch";

function openGatlingPunch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${GATLING_PUNCH_EFFECT_ID}:not_own_turn` };
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${GATLING_PUNCH_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: GATLING_PUNCH_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_power",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectedInstanceIds: [],
      optional: true,
    }),
    detail: GATLING_PUNCH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GATLING_PUNCH_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        selectedInstanceIds: [...(pending.selectedInstanceIds ?? []), instanceId],
        validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
      },
    },
  };
};
CHOICE_SKIPPERS[GATLING_PUNCH_EFFECT_ID] = simpleSkip("RS-569");
CHOICE_CAN_CONFIRM[GATLING_PUNCH_EFFECT_ID] = (_state, pending) => (pending.selectedInstanceIds ?? []).length > 0;
CHOICE_CONFIRMERS[GATLING_PUNCH_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ids = pending.selectedInstanceIds ?? [];
  let next = patchPlayer(state, playerId, (p) => {
    const picked = p.power.filter((c) => ids.includes(c.instanceId) && !c.faceDown);
    return {
      ...p,
      power: p.power.filter((c) => !picked.some((x) => x.instanceId === c.instanceId)),
      discard: [...p.discard, ...picked.map(strip)],
    };
  });
  const bonus = Math.floor(ids.length / 3);
  const self = pending.sourceInstanceId;
  if (bonus > 0 && self) next = patchFieldCard(next, playerId, self, (c) => ({ ...c, spModifier: (c.spModifier ?? 0) + bonus }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-569", `${GATLING_PUNCH_EFFECT_ID}:${ids.length}:+${bonus}`) };
};

// ---------------------------------------------------------------------------
// RS-571 デカバイクロボ【ソードトルネード】
// 「これが自軍エリアにある間、自分か相手の山札がシャッフルされたとき、そのターン中、これは「SP1」になる。」（atwiki/page-1214）
// シャッフルは core/deckShuffle.ts の記録で判定する（applyAction の後処理から呼ぶ）。

export function applySwordTornadoAfterShuffle(state: GameState, epoch: number): GameState {
  if (!deckShuffledSince(state, "player1", epoch) && !deckShuffledSince(state, "player2", epoch)) return state;
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    for (const c of [...next.players[pid].battle, ...next.players[pid].rush]) {
      if (c.cardId !== "RS-571" || c.spOverride === 1) continue;
      next = patchFieldCard(next, pid, c.instanceId, (x) => ({ ...x, spOverride: 1 }));
      next = { ...next, log: [...next.log, buildLogEntry(pid, "named_effect", "RS-571", next.definitions, "rs571_sword_tornado")] };
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-572 デカマスター（2nd）【ディーソードベガ】
// 「自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、自分自身のユニットを1体選び撃破するかを選ぶ。」
// （atwiki/page-1215）— 選ぶのは相手。ユニットを選べば撃破し、デカマスター（効果のユニット）を選べば1点ダメージを受ける。
// grnrngr/faq-card-8 RS-572 Q1: 相手のユニットがいなければ撃破は選べず、自動的に1点ダメージを受ける。

export const D_SWORD_VEGA_2ND_EFFECT_ID = "rs572_d_sword_vega";

function applyDSwordVega2nd(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${D_SWORD_VEGA_2ND_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const units = fieldUnits(state, enemyId).map((c) => c.instanceId);
  if (units.length === 0) {
    return {
      state: applyDamageToPlayer(state, enemyId, 1, { kind: "none", activePlayer: ctx.phasePlayerId }),
      detail: `${D_SWORD_VEGA_2ND_EFFECT_ID}:damage`,
    };
  }
  const damageOption = ctx.triggerSourceInstanceId ?? D_SWORD_VEGA_2ND_EFFECT_ID;
  return {
    state: openEffectChoice(state, {
      playerId: enemyId,
      effectId: D_SWORD_VEGA_2ND_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: [...units, damageOption],
      selectCount: 1,
      optional: false,
    }),
    detail: D_SWORD_VEGA_2ND_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[D_SWORD_VEGA_2ND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const own = inOwnField(state, playerId, instanceId);
  if (!own) {
    const next = applyDamageToPlayer(close(state, pending), playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
    return { state: proceed(next, pending), log: logFor(state, playerId, "RS-572", `${D_SWORD_VEGA_2ND_EFFECT_ID}:damage`) };
  }
  const found = findCardInField(state, instanceId)!;
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: proceed(leave.state, pending),
    log: logFor(state, playerId, "RS-572", `${D_SWORD_VEGA_2ND_EFFECT_ID}:destroy:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-573 ファイヤーカイザー（2nd）【バリランサー】
// 「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このターン、これは「SP2」になり、
//  敵軍ラッシュエリアのユニットにアタックできる。」（atwiki/page-1191）

export const BARI_LANCER_EFFECT_ID = "rs573_bari_lancer_confirm";

function openBariLancer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${BARI_LANCER_EFFECT_ID}:not_own_turn` };
  const self = ctx.triggerSourceInstanceId;
  const card = self ? state.players[ctx.playerId].battle.find((c) => c.instanceId === self) : undefined;
  if (!card || card.commandHeld) return { state, detail: `${BARI_LANCER_EFFECT_ID}:not_releasable` };
  return { state: openConfirm(state, ctx, BARI_LANCER_EFFECT_ID), detail: BARI_LANCER_EFFECT_ID };
}

CHOICE_RESOLVERS[BARI_LANCER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const self = pending.sourceInstanceId;
  if (!self || !state.players[playerId].battle.some((c) => c.instanceId === self && !c.commandHeld)) {
    return { state: finish(state, pending), log: logFor(state, playerId, "RS-573", `${BARI_LANCER_EFFECT_ID}:gone`) };
  }
  const next = patchFieldCard(state, playerId, self, (c) => ({
    ...c,
    commandHeld: true,
    spOverride: 2,
    activatedNcEffects: [...(c.activatedNcEffects ?? []), BARI_LANCER_MARK],
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-573", `${BARI_LANCER_EFFECT_ID}:hold`) };
};
CHOICE_SKIPPERS[BARI_LANCER_EFFECT_ID] = simpleSkip("RS-573");

// ---------------------------------------------------------------------------
// RS-574 セイントカイザー【セイントホーンフィニッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、DAを持つ敵軍ユニットを1体選び撃破する。ただし、必要パワーの数字が
//  自軍ダメージの点数以下のユニットしか選べない。」（atwiki/page-1218）— バトル・ラッシュエリアを問わない。強制。

export const SAINT_HORN_EFFECT_ID = "rs574_saint_horn_finish";

function openSaintHorn(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${SAINT_HORN_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const limit = state.players[ctx.playerId].damage;
  const ids = fieldUnits(state, enemyId)
    .filter((c) => cardCategories(getDefinition(state.definitions, c.cardId)).includes("DA"))
    .filter((c) => powerNumber(state, c.cardId) <= limit)
    .filter((c) => isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId, ctx.sourceCardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${SAINT_HORN_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: SAINT_HORN_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      unitDestination: "discard",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: SAINT_HORN_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SAINT_HORN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: proceed(leave.state, pending),
    log: logFor(state, playerId, "RS-574", `${SAINT_HORN_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-576 マジフェニックス ※
// 「※これをラッシュしたとき、ホールド状態の自軍Sユニットをすべてリリースしてもよい。」（atwiki/page-1193）
// RS-576【フェニックススピンキック】・RS-577 マジレッド（2nd）【フェイタル・ブレイド】「これがストライクしたとき、自分は1枚ドローする。」

export const PHOENIX_RELEASE_EFFECT_ID = "rs576_release_held_s";

function heldSmallUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  return fieldUnits(state, playerId).filter((c) => c.commandHeld && isSmallUnitNow(state, playerId, c));
}

function openPhoenixRelease(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (heldSmallUnits(state, ctx.playerId).length === 0) return { state, detail: `${PHOENIX_RELEASE_EFFECT_ID}:no_targets` };
  return { state: openConfirm(state, ctx, PHOENIX_RELEASE_EFFECT_ID), detail: PHOENIX_RELEASE_EFFECT_ID };
}

CHOICE_RESOLVERS[PHOENIX_RELEASE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  let next = state;
  const targets = heldSmallUnits(state, playerId);
  for (const c of targets) {
    next = patchFieldCard(next, playerId, c.instanceId, (x) => {
      const { commandHeld: _h, registerHeld: _r, ...rest } = x;
      return rest as CardInstance;
    });
  }
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-576", `${PHOENIX_RELEASE_EFFECT_ID}:${targets.length}`) };
};
CHOICE_SKIPPERS[PHOENIX_RELEASE_EFFECT_ID] = simpleSkip("RS-576");

// ---------------------------------------------------------------------------
// DSL grant_keyword（`set8c::cardId::name`）からの起点

export const SET8C_KEYWORD_PREFIX = "set8c::";

/**
 * 既存の DSL キーワード（Wiki スペックが期待するもの）はそのままにして、ここで名前付き効果に割り当てる。
 * キーワードはカードを特定しないことがあるので、カード ID と組で照合する。
 */
const SET8C_SPEC_KEYWORDS: Record<string, string> = {
  // カード定義（core-playable）の DSL（Wiki スペックが期待するキーワード）。
  "RS-563|effect_card::RS-563::kigerutsuno": "RS-563::raising_horn",
  "RS-565|effect_card::RS-565::roringusandahariken": "RS-565::rolling_thunder",
  "RS-566|effect_card::RS-566::aruteimasutomu": "RS-566::ultima_storm",
  "RS-569|effect_card::RS-569::gatoringupanchi": "RS-569::gatling_punch",
  "RS-574|effect_card::RS-574::seintohonfuinishu": "RS-574::saint_horn_finish",
  // 生成 DSL（overlays）のキーワード。
  "RS-563|enter_hold_enemy_power_le_opponent_damage": "RS-563::raising_horn",
  "RS-565|return_to_zone_tankoregabatoruerianitatokirashuerianosyunitowosubete": "RS-565::rolling_thunder",
  "RS-566|return_to_zone_koreworashushitatokikorenosubetenoyunitotosubetenokomando": "RS-566::ultima_storm",
  "RS-569|discard_to_zone_tankoregabatoruerianitatokiomote_ko_kinopawawokinabi": "RS-569::gatling_punch",
  "RS-574|destroy_enter_battle_tankoregabatoruerianitatokidawotsuyunitowo1bi_geki_": "RS-574::saint_horn_finish",
  "RS-576|on_rush_release_held_s_units": "RS-576::release_held_s",
};

export function trySet8CCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  const mapped = SET8C_SPEC_KEYWORDS[`${ctx.sourceCardId}|${keyword}`];
  if (!mapped && !keyword.startsWith(SET8C_KEYWORD_PREFIX)) return null;
  switch (mapped ?? keyword.slice(SET8C_KEYWORD_PREFIX.length)) {
    case "RS-563::raising_horn":
      return openRaisingHorn(state, ctx);
    case "RS-565::rolling_thunder":
      return openRollingThunder(state, ctx);
    case "RS-566::ultima_storm":
      return applyUltimaStorm(state, ctx);
    case "RS-569::gatling_punch":
      return openGatlingPunch(state, ctx);
    case "RS-572::d_sword_vega":
      return applyDSwordVega2nd(state, ctx);
    case "RS-573::bari_lancer":
      return openBariLancer(state, ctx);
    case "RS-574::saint_horn_finish":
      return openSaintHorn(state, ctx);
    case "RS-576::release_held_s":
      return openPhoenixRelease(state, ctx);
    case "RS-576::strike_draw":
    case "RS-577::strike_draw":
      return { state: drawCards(state, ctx.playerId, 1), detail: `${ctx.sourceCardId}:strike_draw` };
    default:
      // 常時効果・他の処理から呼ぶ誘発の目印。
      return { state, detail: keyword };
  }
}
