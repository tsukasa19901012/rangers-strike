/**
 * 第8弾「究極の八神」（legend1）RS-582〜RS-604 のカード固有の名前付き効果と継続効果（cardSpec RS8-582-604 の監査）。
 *
 * - `trySet8DCardEffect`: DSL の grant_keyword から呼ばれる起点（`set8d::cardId::name`）。
 * - `tryResolveSet8DChoice` / `trySkipSet8DChoice`: このモジュールが開いた選択の解決。
 * - 継続効果（SP・BP・アタックの制限・効果名を持つテキストの無効・「可能ならバトルエリアに出る」の無効）。
 * 構成は rules/legend1/set7NamedEffectsD.ts と同じ。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, DeferredDestroyTrigger, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { canAttackDefender } from "../legend3/restrictions";
import { canAttackRushWithYellowThunder } from "../namedUnitEffects";
import { cardName, effectiveBp, getDefinition, isCounterOperation, isSmallUnit, parsePowerCost } from "../../core/catalog";
import { sameCardName } from "../../core/cardNames";
import { shuffleCards } from "../errataCardEffects";

import { addNextTurnRuleModifier, addTurnRuleModifier, getPlayerModifiers, hasTurnRuleModifier } from "../../core/scopedModifiers";

import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { markBattleNcEffect } from "../namedUnitEffects";
import { spBecomesInZone } from "../fractionalSp";
import { patchPlayer } from "../playerPatches";
import { turnPlayerOf } from "./set6NamedEffectsB";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";

import {
  getNumberComboEffect,
  getRidingComboEffect,
  getRidingComboNamedEffect,
  listNcColumnNamedEffects,
} from "@rangers-strike/cards";
import { getCardDslDocument } from "../../dsl/effectLookup";
import { applyNumberComboEffect } from "../numberComboEffects";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";


import { unitFeatures } from "../addedFeatures";
import { rs603BlocksVehicle } from "../rs/rsCatchallField";
import { namedTextNegated } from "./set6NamedEffects348";
import { cardNotSelectableByOpponent } from "../../keywords/effectTargetability";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet8DChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet8DChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet8DChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

/** 選択を閉じる。割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入を続ける。 */
function finish(state: GameState, pending: PendingEffectChoice): GameState {
  const stillOpen = state.pendingEffectChoice === pending;
  const cleared: GameState = stillOpen
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
  if (cleared.pendingLeave || cleared.pendingEffectChoice) return cleared;
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

function simpleSkip(): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
  };
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function ownFieldHas(state: Pick<GameState, "players">, playerId: PlayerId, cardId: string): CardInstance | undefined {
  return fieldUnits(state, playerId).find((c) => c.cardId === cardId);
}

function definitionCategories(def: CardDefinition | undefined): string[] {
  if (!def?.category) return [];
  return Array.isArray(def.category) ? [...def.category] : [def.category];
}

function hasCategory(state: Pick<GameState, "definitions">, cardId: string, category: string): boolean {
  return definitionCategories(getDefinition(state.definitions, cardId)).includes(category);
}

// ---------------------------------------------------------------------------
// RS-603 蛮機獣ボンベバンキ【超有毒液化ガス】（公式の読み替え後。R-ERR-RS603）
// 「これが自軍エリアにある間、本来の特徴に「車両」を持つユニットはアタックもストライクもできず、効果名を持つテキストは
//  無効になり、発動もできない。」（atwiki/page-1208・grnrngr/faq-card-8 RS-603 Q1）
// アタック・ストライクの制限は rules/rs/rsCatchallField.ts rs603BlocksVehicle。ここでは「効果名を持つテキスト」の無効を扱う
// （rules/legend1/set6NamedEffects348.ts namedTextNegated・set7NamedEffectsD.ts set7DBlocksNc から呼ぶ）。

/** 第8弾の効果で、このユニットの効果名を持つテキストが無効か。 */
export function set8DNamedTextNegated(
  state: Pick<GameState, "players" | "definitions">,
  card: Pick<CardInstance, "cardId">,
): boolean {
  if (getDefinition(state.definitions, card.cardId)?.type !== "unit") return false;
  return rs603BlocksVehicle(state as GameState, "player1", card.cardId);
}

/** 効果名を持つテキスト（このモジュールの名前付き効果）が、いま有効か。 */
function namedTextLive(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  return !namedTextNegated(state, ownerId, card);
}

// ---------------------------------------------------------------------------
// ※「これはBP3000以下のユニットにアタックされない。」（RS-587 怒りの鬼神　ガイ・RS-588 大いなる獣　レイ ほか、
//  「BP○○以上のユニットにアタックされない」も同じ文言の型）。文言で判定し、アタックするユニットの BP は効果を含めた値。

const BP_LIMIT_ATTACKED_RE = /これはBP(\d+)(以下|以上)のユニットにアタックされない/;

/** アタックされない制限（rules/legend3/restrictions.ts canAttackDefender から呼ぶ）。 */
export function set8DDefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defender: CardInstance,
): boolean {
  const text = (getDefinition(state.definitions, defender.cardId)?.text ?? "").normalize("NFKC");
  const m = text.match(BP_LIMIT_ATTACKED_RE);
  if (!m) return false;
  const limit = Number(m[1]);
  const bp = effectiveBp(state, attackerPlayerId, attacker);
  return m[2] === "以下" ? bp <= limit : bp >= limit;
}

// ---------------------------------------------------------------------------
// RS-584 ボウケンブラックAT【闇を振り払う心】
// 「自軍パワーのオモテ向きのカードと自軍コマンドゾーンのカードにDA持つカードが1枚もなければ、これは「SP1」になる。
//  また、DAを持つ敵軍ユニットがあれば、これはBP＋3000される。」（atwiki/page-1212）

function darknessDispelActive(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  if (instance.cardId !== "RS-584") return false;
  if (!fieldUnits(state, playerId).some((c) => c.instanceId === instance.instanceId)) return false;
  return namedTextLive(state, playerId, instance);
}

/** SP の継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。 */
export function set8DEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  let next = sp;
  if (darknessDispelActive(state, playerId, instance)) {
    const player = state.players[playerId];
    const daCard = [...player.power.filter((c) => !c.faceDown), ...player.command].some((c) => hasCategory(state, c.cardId, "DA"));
    if (!daCard) next = Math.max(next, 1);
  }
  return next;
}

/** BP の継続効果（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ）。 */
export function set8DFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  if (darknessDispelActive(state, playerId, instance)) {
    const enemyId = opponent(playerId);
    if (fieldUnits(state, enemyId).some((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && hasCategory(state, c.cardId, "DA"))) {
      bonus += 3000;
    }
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// RS-595 キャリゲーター【頼もしい背中】
// 「これが自軍エリアにある間、特徴「炎神」を持つ自軍ユニットは｢これは毎ターン、可能ならバトルエリアに出る｣と書かれていても、
//  そのテキストは無効になる。」（atwiki/page-1204）— 無効になるのはそのユニット自身のテキストだけ（他の効果で出なければならない場合は別）。

/** このユニット自身の「これは毎ターン、可能ならバトルエリアに出る」が無効か（rules/restrictions.ts findMandatoryBattleEntries から呼ぶ）。 */
export function ownAutoBattleEntryNegated(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const carrier = fieldUnits(state, playerId).filter((c) => c.cardId === "RS-595");
  if (!carrier.some((c) => namedTextLive(state, playerId, c))) return false;
  return unitFeatures(state, playerId, card).includes("炎神");
}

// ---------------------------------------------------------------------------
// 共通: 「〜してもよい。そうしたとき、…」の続きの選択を開く。
// 先の処理（撃破など）で選択・離場の応答が開いていれば、それらの解決後に開く（R-TIME-04。rules/destroyTriggerQueue.ts）。

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

function openAfter(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: choice };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
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
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    if (!pending.resumeChoice) return state;
    const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
  }
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

function choiceBase(ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string }) {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    selectedInstanceIds: [] as string[],
  };
}

function unitIds(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .map((c) => c.instanceId);
}

function findField(state: GameState, playerId: PlayerId, instanceId: string): { zone: "battle" | "rush"; card: CardInstance } | undefined {
  for (const zone of ["battle", "rush"] as const) {
    const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

// ---------------------------------------------------------------------------
// 「相手は自分自身のユニットを1体選び撃破する」（RS-587【激しい闘争心】・RS-589【グレイブラスター】の後半）

export const OPPONENT_SELF_DESTROY_EFFECT_ID = "set8d_opponent_self_destroy";

function opponentSelfDestroyChoice(state: GameState, pending: PendingEffectChoice): PendingEffectChoice | undefined {
  const enemyId = opponent(pending.playerId);
  const ids = unitIds(state, enemyId);
  if (ids.length === 0) return undefined;
  return {
    playerId: enemyId,
    phasePlayerId: pending.phasePlayerId,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    effectId: OPPONENT_SELF_DESTROY_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    resumeChoice: pending.resumeChoice,
  };
}

CHOICE_RESOLVERS[OPPONENT_SELF_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const log = logFor(state, playerId, pending.sourceCardId, `${OPPONENT_SELF_DESTROY_EFFECT_ID}:${instanceId}`);
  if (!findField(cleared, playerId, instanceId)) return { state: proceed(cleared, pending), log };
  const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return { state: proceed(leave.state, pending), log };
};

/** 自軍の「これ以外の S ユニット」の候補（RS-587・RS-589）。 */
function otherOwnSUnits(state: GameState, playerId: PlayerId, selfId: string | undefined, requireReleased: boolean): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => c.instanceId !== selfId)
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .filter((c) => !requireReleased || !c.commandHeld)
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RS-587 怒りの鬼神　ガイ【激しい闘争心】
// 「これ以外の自軍Sユニットを1体選び撃破してもよい。そうしたとき、相手は自分自身のユニットを1体選び撃破する。」（atwiki/page-1197）

export const FIERCE_FIGHT_EFFECT_ID = "rs587_fierce_fight";

function applyFierceFight(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = otherOwnSUnits(state, ctx.playerId, ctx.triggerSourceInstanceId, false);
  if (ids.length === 0) return { state, detail: `${FIERCE_FIGHT_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-587", sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: FIERCE_FIGHT_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: FIERCE_FIGHT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[FIERCE_FIGHT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  const log = logFor(state, playerId, "RS-587", `${FIERCE_FIGHT_EFFECT_ID}:${instanceId}`);
  const follow = opponentSelfDestroyChoice(leave.state, pending);
  if (!follow) return { state: proceed(leave.state, pending), log };
  return { state: openAfter(leave.state, follow), log };
};
CHOICE_SKIPPERS[FIERCE_FIGHT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-589 クエスター・ガイ【グレイブラスター】
// 「これ以外の自軍Sユニットを1体選びホールドしてもよい。そうしたとき、相手は自分自身のユニットを1体選び撃破する。」（atwiki/page-1199）

export const GRAY_BLASTER_EFFECT_ID = "rs589_gray_blaster";

function applyGrayBlaster(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = otherOwnSUnits(state, ctx.playerId, ctx.triggerSourceInstanceId, true);
  if (ids.length === 0) return { state, detail: `${GRAY_BLASTER_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-589", sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: GRAY_BLASTER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: GRAY_BLASTER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GRAY_BLASTER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findField(state, playerId, instanceId);
  if (!found) return { error: "invalid_target" };
  const held = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  const log = logFor(state, playerId, "RS-589", `${GRAY_BLASTER_EFFECT_ID}:hold:${cardName(state.definitions, found.card.cardId)}`);
  const follow = opponentSelfDestroyChoice(held, pending);
  if (!follow) return { state: proceed(held, pending), log };
  return { state: openAfter(held, follow), log };
};
CHOICE_SKIPPERS[GRAY_BLASTER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-593 バルカ【バルカッター】「SP1」
// 「相手は自分自身のパワーゾーンからオモテ向きのカードを1枚選び手札に戻してもよい。そうしたとき、このターン、これはストライクできない。」
// （atwiki/page-1202）— 「SP1」は DSL の SP1。戻すかは相手が選ぶ。

export const BALCUTTER_EFFECT_ID = "rs593_balcutter";
/** このターン、ストライクできない（rules/combo.ts canStrikeUnit が見る印）。 */
const NO_STRIKE_MARK = "souru_no_strike";

function applyBalcutter(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: `${BALCUTTER_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-593", sourceInstanceId: ctx.triggerSourceInstanceId }),
      playerId: enemyId,
      effectId: BALCUTTER_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: BALCUTTER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BALCUTTER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  if (pending.sourceInstanceId) next = markBattleNcEffect(next, opponent(playerId), pending.sourceInstanceId, NO_STRIKE_MARK);
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-593", `${BALCUTTER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[BALCUTTER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-594 ガンパード【ガンパードガン】
// 「相手の手札を見ないで3枚まで選んでもよい。そうしたとき、選んだカードをお互いで見る。選んだカードの中からSユニットのカードを1枚選び、
//  持ち主のパワーゾーンに置く。次の相手ターン、相手はターンを終えるとき、自分自身のパワーゾーンからオモテ向きのカードを1枚選び、
//  手札に戻してもよい。」（atwiki/page-1203）
// 手札は見ないで選ぶ（UI はウラ向きで示す）。1枚ずつ選び、3枚選ぶか見送り（skip）で確定する。

export const GUNPARD_GUN_EFFECT_ID = "rs594_gunpard_gun";
export const GUNPARD_GUN_PLACE_EFFECT_ID = "rs594_gunpard_gun_place";
export const GUNPARD_RETURN_EFFECT_ID = "rs594_gunpard_return";
const GUNPARD_RETURN_RULE_PREFIX = "rs594_gunpard_return:";

function applyGunpardGun(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${GUNPARD_GUN_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-594", sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: GUNPARD_GUN_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: ids,
      selectCount: 3,
      optional: true,
      set8dMeta: { selected: [], maxCount: 3, ownerId: enemyId },
    }),
    detail: GUNPARD_GUN_EFFECT_ID,
  };
}

function finishGunpardPick(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  const enemyId = opponent(pending.playerId);
  if (selected.length === 0) {
    return { state: finish(state, pending), log: skipLog(state, pending.playerId, "RS-594", GUNPARD_GUN_EFFECT_ID) };
  }
  const shown = state.players[enemyId].hand.filter((c) => selected.includes(c.instanceId));
  const names = shown.map((c) => cardName(state.definitions, c.cardId)).join("、");
  const log = logFor(state, pending.playerId, "RS-594", `${GUNPARD_GUN_EFFECT_ID}:reveal:${names}`);
  // 次の相手ターン、相手はターンを終えるとき、パワーゾーンのオモテ向きのカードを1枚手札に戻してもよい。
  let next = patchPlayer(close(state, pending), enemyId, (p) =>
    addNextTurnRuleModifier(p, `${GUNPARD_RETURN_RULE_PREFIX}${pending.sourceInstanceId ?? "rs594"}:${state.turn}`, { sourceCardId: "RS-594" }),
  );
  // お互いに見たカードの中から選ぶので、「相手に選ばれない」を持つカードは選べない（ユーザー決定 2026-10-19
  // 「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」。docs/rules/README.md §5.7 j）。
  // 見ないで選ぶ最初の3枚は外さない（手札を見ていない）。
  const sUnits = shown.filter((c) => isSmallUnit(state.definitions, c.cardId) && !cardNotSelectableByOpponent(c.cardId)).map((c) => c.instanceId);
  if (sUnits.length === 0) return { state: proceed(next, pending), log };
  next = openEffectChoice(next, {
    ...pending,
    effectId: GUNPARD_GUN_PLACE_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: sUnits,
    viewedInstanceIds: selected,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    set8dMeta: { ownerId: enemyId },
  });
  return { state: next, log };
}

CHOICE_RESOLVERS[GUNPARD_GUN_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set8dMeta?.selected ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (selected.length < (pending.set8dMeta?.maxCount ?? 3) && remaining.length > 0) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, validInstanceIds: remaining, selectedInstanceIds: selected, set8dMeta: { ...pending.set8dMeta, selected } },
      },
    };
  }
  return finishGunpardPick(state, pending, selected);
};
CHOICE_SKIPPERS[GUNPARD_GUN_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return finishGunpardPick(state, pending, pending.set8dMeta?.selected ?? []);
};

CHOICE_RESOLVERS[GUNPARD_GUN_PLACE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = pending.set8dMeta?.ownerId ?? opponent(playerId);
  const card = state.players[ownerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), ownerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    power: [...p.power, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-594", `${GUNPARD_GUN_PLACE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

/** 「ターンを終えるとき」に尋ねる【ガンパードガン】の後半（rules/turnEndingEffects.ts から呼ぶ）。 */
export function collectSet8DTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return getPlayerModifiers(state.players[endingPlayerId])
    .filter((m) => m.kind === "rule" && m.scope === "turn" && m.ruleId.startsWith(GUNPARD_RETURN_RULE_PREFIX))
    .map((m) => (m as { ruleId: string }).ruleId);
}

export function openSet8DTurnEndEntry(state: GameState, endingPlayerId: PlayerId, _entry: string): GameState {
  const ids = state.players[endingPlayerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: endingPlayerId,
    phasePlayerId: endingPlayerId,
    sourceCardId: "RS-594",
    effectId: GUNPARD_RETURN_EFFECT_ID,
    kind: "select_power",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[GUNPARD_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  return { state: next, log: logFor(state, playerId, "RS-594", `${GUNPARD_RETURN_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[GUNPARD_RETURN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RS-594", GUNPARD_RETURN_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RS-596 炎神大将軍【炎神剣】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが
//  特徴「炎神」を持つユニットカードなら、このターン、これは「SP2」になる。その後、オモテにしたカードは山札の下に戻す。」（atwiki/page-1216）
// 「オモテにする／しない」の選択は、効果のユニット自身を選ぶとオモテにする（第7弾 RS-515 と同じ）。

export const FLAME_SWORD_EFFECT_ID = "rs596_flame_sword";

function applyFlameSword(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (turnPlayerOf(state) !== ctx.playerId || !self) return { state, detail: `${FLAME_SWORD_EFFECT_ID}:not_own_turn` };
  if (state.players[ctx.playerId].deck.length === 0) return { state, detail: `${FLAME_SWORD_EFFECT_ID}:empty_deck` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-596", sourceInstanceId: self }),
      effectId: FLAME_SWORD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [self],
      optional: true,
    }),
    detail: FLAME_SWORD_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[FLAME_SWORD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const top = state.players[playerId].deck[0];
  if (!top) return { state: finish(state, pending) };
  const def = getDefinition(state.definitions, top.cardId);
  const hit = def?.type === "unit" && (def.features ?? []).includes("炎神");
  let next = state;
  if (hit && state.players[playerId].battle.some((c) => c.instanceId === instanceId)) {
    next = spBecomesInZone(next, playerId, "battle", instanceId, 2);
  }
  next = patchPlayer(next, playerId, (p) => ({ ...p, deck: [...p.deck.slice(1), stripForZone(top)] }));
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, "RS-596", `${FLAME_SWORD_EFFECT_ID}:${cardName(state.definitions, top.cardId)}:${hit ? "sp2" : "miss"}`),
  };
};
CHOICE_SKIPPERS[FLAME_SWORD_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-598 シシノシン【正義の出陣】
// 「敵軍コマンドを1つ選びリリースしてもよい。そうしたとき、特徴「炎神」を持つMユニットのカードを、自軍パワーのオモテ向きのカードから
//  1枚選び、ラッシュエリアに出す。」（atwiki/page-1206）— リリースできるのはホールド状態のコマンドだけ。出すのは効果で出す（R-RUSH-20）。

export const JUSTICE_SORTIE_EFFECT_ID = "rs598_justice_sortie";
export const JUSTICE_SORTIE_DEPLOY_EFFECT_ID = "rs598_justice_sortie_deploy";

function applyJusticeSortie(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${JUSTICE_SORTIE_EFFECT_ID}:no_held_command` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-598", sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: JUSTICE_SORTIE_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: JUSTICE_SORTIE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[JUSTICE_SORTIE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false, mothershipHold: false } : c)),
  }));
  const log = logFor(state, playerId, "RS-598", `${JUSTICE_SORTIE_EFFECT_ID}:release`);
  const ids = next.players[playerId].power
    .filter((c) => !c.faceDown)
    .filter((c) => {
      const def = getDefinition(next.definitions, c.cardId);
      return def?.type === "unit" && def.size === "M" && (def.features ?? []).includes("炎神");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openEffectChoice(next, {
    ...pending,
    effectId: JUSTICE_SORTIE_DEPLOY_EFFECT_ID,
    kind: "select_power",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
  });
  return { state: next, log };
};
CHOICE_SKIPPERS[JUSTICE_SORTIE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[JUSTICE_SORTIE_DEPLOY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const moved = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  const rushed = finalizeEffectRush(moved, playerId, [instanceId], pending.phasePlayerId);
  const next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-598", `${JUSTICE_SORTIE_DEPLOY_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RS-599 ツキノワ【取り戻す炎心】
// 「自軍パワーのダメージになっているカードをウラ向きのまま1枚選び、手札に加えてもよい。そうしたとき、自軍山札の上から1枚ひいて
//  自軍パワーゾーンにウラ向きに置く。」（atwiki/page-1207。Q1: 置くカードのオモテは見られない）

export const RECLAIM_FLAME_EFFECT_ID = "rs599_reclaim_flame";

function applyReclaimFlame(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${RECLAIM_FLAME_EFFECT_ID}:no_damage` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-599", sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: RECLAIM_FLAME_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: RECLAIM_FLAME_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[RECLAIM_FLAME_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => {
    const top = p.deck[0];
    const power = p.power.filter((c) => c.instanceId !== instanceId);
    const placed = top ? [...power, { ...stripForZone(top), faceDown: true }] : power;
    const damage = placed.filter((c) => c.faceDown).length;
    return { ...p, hand: [...p.hand, stripForZone(card)], power: placed, deck: top ? p.deck.slice(1) : p.deck, damage };
  });
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-599", `${RECLAIM_FLAME_EFFECT_ID}:take`) };
};
CHOICE_SKIPPERS[RECLAIM_FLAME_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RS-601 ゴーオンゴールド【ミッション6 フルパワー】「SP1」
// 「敵軍コマンドを3つまで選びリリースしてもよい。そうしたとき、リリースしたコマンドの数以下の必要パワーの数字を持つ敵軍ユニットを
//  1体選び撃破する。」（atwiki/page-1144）— リリースできるのはホールド状態のコマンド。1つずつ選び、3つ選ぶか見送り（skip）で確定する。

export const FULL_POWER_EFFECT_ID = "rs601_full_power";
export const FULL_POWER_DESTROY_EFFECT_ID = "rs601_full_power_destroy";
const FULL_POWER_MAX = 3;

function applyFullPower(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${FULL_POWER_EFFECT_ID}:no_held_command` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-601", sourceInstanceId: ctx.triggerSourceInstanceId }),
      effectId: FULL_POWER_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: FULL_POWER_MAX,
      optional: true,
      set8dMeta: { selected: [], maxCount: FULL_POWER_MAX },
    }),
    detail: FULL_POWER_EFFECT_ID,
  };
}

function finishFullPower(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  if (selected.length === 0) {
    return { state: finish(state, pending), log: skipLog(state, pending.playerId, "RS-601", FULL_POWER_EFFECT_ID) };
  }
  const enemyId = opponent(pending.playerId);
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: false, mothershipHold: false } : c)),
  }));
  const log = logFor(state, pending.playerId, "RS-601", `${FULL_POWER_EFFECT_ID}:release:${selected.length}`);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => getDefinition(next.definitions, c.cardId)?.type === "unit")
    .filter((c) => parsePowerCost(getDefinition(next.definitions, c.cardId)?.powerCost) <= selected.length)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openEffectChoice(next, {
    ...pending,
    effectId: FULL_POWER_DESTROY_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
    set8dMeta: undefined,
  });
  return { state: next, log };
}

CHOICE_RESOLVERS[FULL_POWER_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set8dMeta?.selected ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (selected.length < FULL_POWER_MAX && remaining.length > 0) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, validInstanceIds: remaining, selectedInstanceIds: selected, set8dMeta: { ...pending.set8dMeta, selected } },
      },
    };
  }
  return finishFullPower(state, pending, selected);
};
CHOICE_SKIPPERS[FULL_POWER_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return finishFullPower(state, pending, pending.set8dMeta?.selected ?? []);
};
CHOICE_RESOLVERS[FULL_POWER_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return { state: proceed(leave.state, pending), log: logFor(state, playerId, "RS-601", `${FULL_POWER_DESTROY_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RS-588 大いなる獣　レイ【術魂】・RS-590 クエスター・レイ【グレイボンバー】
// 「相手の手札を見てもよい。そうしたとき、ＮＣを持つSユニットのカードがあれば1枚選び、そのNCの効果をこのユニットの効果として発動する。」
// （atwiki/page-1198）／「…ＮＣかＲＣを持つSユニットのカードを1枚選び、そのNCまたはRCの効果を、このユニットの効果として発動する。」
// （atwiki/page-1200）— 「見る／見ない」は効果のユニット自身を選ぶと見る。NC と RC の両方を持つカードなら、どちらを発動するか選ぶ。
// 「（この効果は「…」からコンビネーションするときはナンバーに関係なく発動する）」は NC の成立判定（rules/numberComboEffects.ts）。

export const SOUL_ART_EFFECT_ID = "set8d_borrow_hand_combo";
export const SOUL_ART_PICK_EFFECT_ID = "set8d_borrow_hand_combo_pick";
export const SOUL_ART_BRANCH_EFFECT_ID = "set8d_borrow_hand_combo_branch";

function cardHasNc(cardId: string): boolean {
  return getNumberComboEffect(cardId) !== undefined || listNcColumnNamedEffects(cardId).length > 0;
}

function cardHasRc(cardId: string): boolean {
  if (getRidingComboEffect(cardId) || getRidingComboNamedEffect(cardId)) return true;
  return (getCardDslDocument(cardId)?.effects ?? []).some((e) => e.trigger.type === "riding_combo");
}

function borrowKinds(state: GameState, cardId: string, allowRc: boolean): ("nc" | "rc")[] {
  if (!isSmallUnit(state.definitions, cardId)) return [];
  const kinds: ("nc" | "rc")[] = [];
  if (cardHasNc(cardId)) kinds.push("nc");
  if (allowRc && cardHasRc(cardId)) kinds.push("rc");
  return kinds;
}

function borrowMeta(sourceCardId: string): { allowRc: boolean } {
  return { allowRc: sourceCardId === "RS-590" };
}

function applySoulArt(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self) return { state, detail: `${SOUL_ART_EFFECT_ID}:no_source` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceInstanceId: self }),
      effectId: SOUL_ART_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [self],
      optional: true,
    }),
    detail: SOUL_ART_EFFECT_ID,
  };
}

/** 借りた NC／RC の効果を、このユニット（selfId）の効果として発動する。 */
function fireBorrowed(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, cardId: string, kind: "nc" | "rc"): ChoiceOutcome {
  const selfId = pending.sourceInstanceId;
  const self = selfId ? state.players[playerId].battle.find((c) => c.instanceId === selfId) : undefined;
  const cleared = close(state, pending);
  const log = logFor(state, playerId, pending.sourceCardId, `${SOUL_ART_EFFECT_ID}:${kind}:${cardName(state.definitions, cardId)}`);
  if (!self) return { state: proceed(cleared, pending), log };
  const borrowed: CardInstance = { ...self, cardId };
  const outcome =
    kind === "nc"
      ? applyNumberComboEffect(cleared, playerId, borrowed, getNumberComboEffect(cardId))
      : resolveRidingComboOnRideOff(cleared, playerId, borrowed);
  const next = { ...outcome.state, log: [...outcome.state.log, ...outcome.logs] };
  return { state: proceed(next, pending), log };
}

CHOICE_RESOLVERS[SOUL_ART_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyHand = state.players[opponent(playerId)].hand;
  const { allowRc } = borrowMeta(pending.sourceCardId);
  // 相手の手札を見て選ぶので、「相手に選ばれない」を持つカードは選べない（ユーザー決定 2026-10-19「クエスターレイ等の相手の手札を
  // 見て選ぶ場合も指しています」。docs/rules/README.md §5.7 j）。
  const ids = enemyHand
    .filter((c) => borrowKinds(state, c.cardId, allowRc).length > 0 && !cardNotSelectableByOpponent(c.cardId))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, pending.sourceCardId, `${SOUL_ART_EFFECT_ID}:look`);
  if (ids.length === 0) return { state: finish(state, pending), log };
  return {
    state: openEffectChoice(close(state, pending), {
      ...pending,
      effectId: SOUL_ART_PICK_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: ids,
      viewedInstanceIds: enemyHand.map((c) => c.instanceId),
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
    }),
    log,
  };
};
CHOICE_SKIPPERS[SOUL_ART_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[SOUL_ART_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[opponent(playerId)].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const kinds = borrowKinds(state, card.cardId, borrowMeta(pending.sourceCardId).allowRc);
  if (kinds.length === 1) return fireBorrowed(state, playerId, pending, card.cardId, kinds[0]!);
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: SOUL_ART_BRANCH_EFFECT_ID,
        kind: "declare_number",
        validInstanceIds: kinds.map((k) => k.toUpperCase()),
        selectedInstanceIds: [],
        set8dMeta: { cardId: card.cardId },
      },
    },
  };
};

CHOICE_RESOLVERS[SOUL_ART_BRANCH_EFFECT_ID] = (state, playerId, value) => {
  const pending = state.pendingEffectChoice!;
  const cardId = pending.set8dMeta?.cardId;
  if (!cardId) return { error: "invalid_choice" };
  return fireBorrowed(state, playerId, pending, cardId, value === "RC" ? "rc" : "nc");
};

// ---------------------------------------------------------------------------
// RS-600 ゴーオンシルバー【ミッション1 バーニング】
// 「このターン、このユニットの次にコンビネーションするCN4を持つ自軍Sユニットは、そのＮＣの効果を発動する。ただし、ストライクはできない。」
// （atwiki/page-1143）— NC が成立したシルバーの次（左隣がシルバー）にバトルエリアに出た CN4 の S ユニットは、ナンバーに関係なく
// NC の効果を発動し、このターンはストライクできない（rules/numberComboEffects.ts から呼ぶ）。

const MISSION1_EFFECT_ID = "mishon1_baningu";

/** 【ミッション1 バーニング】で、このユニットの NC がナンバーに関係なく成立するか。 */
export function missionBurningForcesNc(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battleBeforeEnter: CardInstance[],
): boolean {
  if (definition.comboNumber !== 4 || !isSmallUnit(state.definitions, card.cardId)) return false;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || left.cardId !== "RS-600") return false;
  if (!(left.activatedNcEffects ?? []).includes(MISSION1_EFFECT_ID)) return false;
  return state.players[playerId].battle.some((c) => c.instanceId === left.instanceId);
}

/** 【ミッション1 バーニング】で NC を発動したユニットに「このターン、ストライクできない」を付ける。 */
export function markMissionBurningNoStrike(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return markBattleNcEffect(state, playerId, instanceId, NO_STRIKE_MARK);
}

// ---------------------------------------------------------------------------
// RS-592 エンジンオーG6【G6グランプリ】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンのカードの枚数が6枚になるように、自軍パワーゾーンのオモテ向きのカードを
//  選び捨札にしてもよい。そうしたとき、捨札にした枚数と同じ数まで、BP6000以下の敵軍ユニットを選び撃破する。」（atwiki/page-1223）
// 捨札にする枚数は「パワーゾーンの枚数 − 6」ちょうど（オモテ向きのカードがそれだけなければ発動できない）。
// 1枚目を選ぶと発動（以後は必要な枚数を選び切る）。撃破は1体ずつ選び、上限に達するか見送り（skip）でまとめて撃破する。

export const G6_GRAND_PRIX_EFFECT_ID = "rs592_g6_grand_prix";
export const G6_GRAND_PRIX_DESTROY_EFFECT_ID = "rs592_g6_grand_prix_destroy";
const G6_POWER_TARGET = 6;
const G6_MAX_BP = 6000;

function applyG6GrandPrix(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (turnPlayerOf(state) !== ctx.playerId || !self) return { state, detail: `${G6_GRAND_PRIX_EFFECT_ID}:not_own_turn` };
  const power = state.players[ctx.playerId].power;
  const need = power.length - G6_POWER_TARGET;
  const faceUp = power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (need <= 0 || faceUp.length < need) return { state, detail: `${G6_GRAND_PRIX_EFFECT_ID}:no_excess` };
  return {
    state: openEffectChoice(state, {
      ...choiceBase({ ...ctx, sourceCardId: "RS-592", sourceInstanceId: self }),
      effectId: G6_GRAND_PRIX_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: faceUp,
      selectCount: need,
      optional: true,
      set8dMeta: { selected: [], maxCount: need },
    }),
    detail: G6_GRAND_PRIX_EFFECT_ID,
  };
}

function g6DestroyCandidates(state: GameState, pending: PendingEffectChoice): string[] {
  const enemyId = opponent(pending.playerId);
  const selected = pending.set8dMeta?.selected ?? [];
  if (selected.length >= (pending.set8dMeta?.maxCount ?? 0)) return [];
  return fieldUnits(state, enemyId)
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .filter((c) => !selected.includes(c.instanceId))
    .filter((c) => effectiveBp(state, enemyId, c) <= G6_MAX_BP)
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[G6_GRAND_PRIX_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set8dMeta?.selected ?? []), instanceId];
  const need = pending.set8dMeta?.maxCount ?? 0;
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (selected.length < need) {
    // 発動したので、残りは必ず選ぶ（見送れない）。
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, validInstanceIds: remaining, selectedInstanceIds: selected, optional: false, set8dMeta: { ...pending.set8dMeta, selected } },
      },
    };
  }
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => !selected.includes(c.instanceId)),
    discard: [...p.discard, ...p.power.filter((c) => selected.includes(c.instanceId)).map(stripForZone)],
  }));
  const log = logFor(state, playerId, "RS-592", `${G6_GRAND_PRIX_EFFECT_ID}:discard:${selected.length}`);
  const draft: PendingEffectChoice = {
    ...pending,
    effectId: G6_GRAND_PRIX_DESTROY_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [],
    selectedInstanceIds: [],
    selectCount: selected.length,
    optional: true,
    set8dMeta: { selected: [], maxCount: selected.length },
  };
  const ids = g6DestroyCandidates(next, draft);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openEffectChoice(next, { ...draft, validInstanceIds: ids });
  return { state: next, log };
};
CHOICE_SKIPPERS[G6_GRAND_PRIX_EFFECT_ID] = simpleSkip();

/** 選んだ敵軍ユニットをまとめて撃破する（複数体の撃破は select_units_bp_budget の確定処理を共用する）。 */
function destroyTogether(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  if (selected.length === 0) {
    return { state: finish(state, pending), log: skipLog(state, pending.playerId, pending.sourceCardId, pending.effectId) };
  }
  const confirmPending: PendingEffectChoice = {
    ...pending,
    kind: "select_units_bp_budget",
    validInstanceIds: selected,
    selectedInstanceIds: selected,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
    set8dMeta: undefined,
  };
  const confirmed = applyConfirmEffectChoice({ ...state, pendingEffectChoice: confirmPending }, pending.playerId);
  if ("error" in confirmed) return confirmed;
  return { state: confirmed.state, log: logFor(state, pending.playerId, pending.sourceCardId, `${pending.effectId}:${selected.length}`) };
}

CHOICE_RESOLVERS[G6_GRAND_PRIX_DESTROY_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.set8dMeta?.selected ?? []), instanceId];
  const next: PendingEffectChoice = { ...pending, selectedInstanceIds: selected, set8dMeta: { ...pending.set8dMeta, selected } };
  const ids = g6DestroyCandidates(state, next);
  if (ids.length === 0) return destroyTogether(state, next, selected);
  return { state: { ...state, pendingEffectChoice: { ...next, validInstanceIds: ids } } };
};
CHOICE_SKIPPERS[G6_GRAND_PRIX_DESTROY_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return destroyTogether(state, pending, pending.set8dMeta?.selected ?? []);
};

// ---------------------------------------------------------------------------
// RS-583 ボウケンレッドHM【災いを受け止める覚悟】
// 「これが自軍エリアにある間、相手によってこれ以外の自軍ユニットが選ばれたとき、このユニットが選ぶ対象として適切なら、このターン中に
//  一度だけ、選ばれたユニットの代わりに、このユニットが選ばれたことにしてもよい。」（atwiki/page-1211）
// アタックの対象も「選ぶ」もの（faq-card-1 RS-026 Q1）。アタック宣言の直後（「アタックするとき」の前）に、アタックされた側へ
// 任意の選択を開く（core/applyAction.ts continueAttackAfterDeclaration）。適切か＝そのアタックでこのユニットにアタックできるか。

export const TAKE_THE_BLOW_EFFECT_ID = "rs583_take_the_blow";
const TAKE_THE_BLOW_RULE_PREFIX = "rs583_take_the_blow_used:";

/** 【災いを受け止める覚悟】の選択を開く。使えないなら null。 */
export function openTakeTheBlowChoice(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.substituteTargetOffered || battle.battleCancelled || battle.effectBattle) return null;
  const ownerId = battle.defenderPlayerId;
  if (battle.attackerPlayerId === ownerId) return null;
  const owner = state.players[ownerId];
  const ids = fieldUnits(state, ownerId)
    .filter((c) => c.cardId === "RS-583" && c.instanceId !== battle.defenderInstanceId)
    .filter((c) => namedTextLive(state, ownerId, c))
    .filter((c) => !hasTurnRuleModifier(owner, `${TAKE_THE_BLOW_RULE_PREFIX}${c.instanceId}`))
    .filter((c) =>
      canAttackDefender(state, battle.attackerPlayerId, battle.attackerInstanceId, ownerId, c.instanceId, canAttackRushWithYellowThunder),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ownerId,
    phasePlayerId: battle.phasePlayerId,
    sourceCardId: "RS-583",
    sourceInstanceId: ids[0],
    effectId: TAKE_THE_BLOW_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
    set8dMeta: { battle: { ...battle, substituteTargetOffered: true }, wingAttackFromRush },
  });
}

/** 選んだ HM を新しいアタックの対象にする（core/applyAction.ts から呼ぶ）。 */
export function resolveTakeTheBlow(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { error: string } | { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean; log: string } {
  const pending = state.pendingEffectChoice;
  const battle = pending?.set8dMeta?.battle;
  if (!pending || !battle || pending.effectId !== TAKE_THE_BLOW_EFFECT_ID) return { error: "invalid_choice" };
  if (pending.playerId !== playerId) return { error: "not_your_choice" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = patchPlayer({ ...state, pendingEffectChoice: undefined, activePlayer: battle.phasePlayerId }, playerId, (p) =>
    addTurnRuleModifier(p, `${TAKE_THE_BLOW_RULE_PREFIX}${instanceId}`, { sourceCardId: "RS-583" }),
  );
  return {
    state: next,
    battle: { ...battle, defenderInstanceId: instanceId },
    wingAttackFromRush: pending.set8dMeta?.wingAttackFromRush ?? false,
    log: logFor(state, playerId, "RS-583", `${TAKE_THE_BLOW_EFFECT_ID}:${instanceId}`),
  };
}

/** 代わらない（core/applyAction.ts から呼ぶ）。 */
export function skipTakeTheBlow(
  state: GameState,
  playerId: PlayerId,
): { error: string } | { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean; log: string } {
  const pending = state.pendingEffectChoice;
  const battle = pending?.set8dMeta?.battle;
  if (!pending || !battle || pending.effectId !== TAKE_THE_BLOW_EFFECT_ID) return { error: "invalid_choice" };
  if (pending.playerId !== playerId) return { error: "not_your_choice" };
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: battle.phasePlayerId },
    battle,
    wingAttackFromRush: pending.set8dMeta?.wingAttackFromRush ?? false,
    log: skipLog(state, playerId, "RS-583", TAKE_THE_BLOW_EFFECT_ID),
  };
}

// 解決は core/applyAction.ts が行う（アタックの処理を続けるため）。ここでは選択として登録だけする。
CHOICE_RESOLVERS[TAKE_THE_BLOW_EFFECT_ID] = () => ({ error: "handled_by_attack" });
CHOICE_SKIPPERS[TAKE_THE_BLOW_EFFECT_ID] = () => ({ error: "handled_by_attack" });

// ---------------------------------------------------------------------------
// RS-582 魔導神官メーミィ【メー・メガロ】
// 「これが自軍エリアにある間、自分がカウンターを持つオペレーションの効果を発動して、そのカードが捨札になったとき、そのカードと同じ
//  カード名のカードを、自軍山札を見て1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。」（atwiki/page-1196）
// core/applyAction.ts の後処理で、カウンターの使用（play_counter とその支払い）によって手札のカウンターが捨札に置かれたことを検出する。
// 巨大化爆弾のように使用時に捨札にならないカードは対象外（faq-card-8 RS-582 Q1）。

export const MEE_MEGALO_EFFECT_ID = "rs582_mee_megalo";
const COUNTER_USE_ACTIONS = new Set(["play_counter", "initiate_command_payment", "resolve_command_payment"]);

function openMeeMegalo(state: GameState, playerId: PlayerId, usedCardId: string): GameState {
  const mee = fieldUnits(state, playerId).find((c) => c.cardId === "RS-582" && namedTextLive(state, playerId, c));
  if (!mee) return state;
  const deck = state.players[playerId].deck;
  const name = cardName(state.definitions, usedCardId);
  const ids = deck.filter((c) => sameCardName(cardName(state.definitions, c.cardId), name)).map((c) => c.instanceId);
  const choice: PendingEffectChoice = {
    playerId,
    phasePlayerId: turnPlayerOf(state),
    sourceCardId: "RS-582",
    sourceInstanceId: mee.instanceId,
    effectId: MEE_MEGALO_EFFECT_ID,
    kind: "scry_keep_one",
    validInstanceIds: ids,
    viewedInstanceIds: deck.map((c) => c.instanceId),
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
    set8dMeta: { cardId: usedCardId },
  };
  if (ids.length === 0) {
    // 山札を見たが同名のカードがない: その後、山札をシャッフルする。
    return patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  }
  return openAfter(state, choice);
}

/** applyAction の後処理: 自分が使ったカウンターが捨札になったら【メー・メガロ】の選択を開く。 */
export function applyMeeMegaloAfterAction(before: GameState, after: GameState, actionType: string, actorId: PlayerId): GameState {
  if (!COUNTER_USE_ACTIONS.has(actionType)) return after;
  const beforeHand = before.players[actorId].hand;
  if (beforeHand === after.players[actorId].hand) return after;
  if (!fieldUnits(after, actorId).some((c) => c.cardId === "RS-582")) return after;
  let next = after;
  const discardIds = new Set(after.players[actorId].discard.map((c) => c.instanceId));
  const beforeDiscard = new Set(before.players[actorId].discard.map((c) => c.instanceId));
  for (const card of beforeHand) {
    if (!discardIds.has(card.instanceId) || beforeDiscard.has(card.instanceId)) continue;
    if (!isCounterOperation(getDefinition(after.definitions, card.cardId))) continue;
    next = openMeeMegalo(next, actorId, card.cardId);
  }
  return next;
}

CHOICE_RESOLVERS[MEE_MEGALO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
    hand: [...p.hand, stripForZone(card)],
  }));
  // 相手に見せてから手札に加える（ログに公開する）。
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-582", `${MEE_MEGALO_EFFECT_ID}:reveal:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[MEE_MEGALO_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return { state: finish(next, pending), log: skipLog(state, playerId, "RS-582", MEE_MEGALO_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RS-602 害水大臣ケガレシア【汚染された水】
// 「これが自軍エリアにある間、特徴「メカ」を持たない敵軍ユニットは次の効果を受ける⇒そのカード名の平仮名と片仮名のうち、カ行、サ行、
//  タ行、ハ行の文字に濁点を追加する。ただし、促音（小さい“ッ”）とルビには追加されない。（例：ズピードル、蛮機兵ウガッヅ）」
// （atwiki/page-1231）— 濁点はカード名だけに付き、テキスト中の名前（「…としてつかえる」）は変わらない（faq-card-8 RS-602 Q2）。
// 名前を参照する処理（合体の素材の判定。rules/zordFeatureContext.ts zordMaterialName）が、変わった名前で判定する。

const DAKUTEN_MAP: Record<string, string> = (() => {
  const plain = "かきくけこさしすせそたちつてとはひふへほカキクケコサシスセソタチツテトハヒフヘホ";
  const voiced = "がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ";
  const map: Record<string, string> = {};
  for (let i = 0; i < plain.length; i += 1) map[plain[i]!] = voiced[i]!;
  return map;
})();

/** カ行・サ行・タ行・ハ行の平仮名・片仮名に濁点を付ける（促音の「っ」「ッ」は対象外）。 */
export function addDakuten(name: string): string {
  return [...name].map((ch) => DAKUTEN_MAP[ch] ?? ch).join("");
}

/** 【汚染された水】で変わったカード名（変わらなければ undefined）。ownerId はカードの持ち主（場のユニット）。 */
export function pollutedWaterName(state: GameState, ownerId: PlayerId, card: CardInstance): string | undefined {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return undefined;
  const enemyId = opponent(ownerId);
  if (!fieldUnits(state, enemyId).some((c) => c.cardId === "RS-602" && namedTextLive(state, enemyId, c))) return undefined;
  if (unitFeatures(state, ownerId, card).includes("メカ")) return undefined;
  const changed = addDakuten(def.name);
  return changed === def.name ? undefined : changed;
}

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const SET8D_KEYWORD_PREFIX = "set8d::";

const SET8D_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  // 継続効果はそれぞれの参照箇所で扱う（ここでは何もしない）。
  "RS-584::darkness_dispel": (state) => ({ state, detail: "rs584_darkness_dispel" }),
  "RS-595::reliable_back": (state) => ({ state, detail: "rs595_reliable_back" }),
  "RS-587::fierce_fight": applyFierceFight,
  "RS-589::gray_blaster": applyGrayBlaster,
  "RS-593::balcutter": applyBalcutter,
  "RS-594::gunpard_gun": applyGunpardGun,
  "RS-596::flame_sword": applyFlameSword,
  "RS-598::justice_sortie": applyJusticeSortie,
  "RS-599::reclaim_flame": applyReclaimFlame,
  "RS-601::full_power": applyFullPower,
  "RS-592::g6_grand_prix": applyG6GrandPrix,
  "RS-588::soul_art": applySoulArt,
  "RS-590::gray_bomber": applySoulArt,
  "RS-600::mission1_burning": (state) => ({ state, detail: "rs600_mission1_burning" }),
};

export function trySet8DCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET8D_KEYWORD_PREFIX)) return null;
  const handler = SET8D_KEYWORDS[keyword.slice(SET8D_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールの選択の CPU の手（対象外なら null）。 */
export function pickSet8DCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const picks = actions.filter((a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice");
  if (picks.length === 0) return skip ?? null;
  const me = pending.playerId;
  const enemyId = opponent(me);
  const bpOf = (id: string): number => {
    for (const pid of ["player1", "player2"] as const) {
      const card = fieldUnits(state, pid).find((c) => c.instanceId === id);
      if (card) return effectiveBp(state, pid, card);
      const other = [...state.players[pid].hand, ...state.players[pid].power].find((c) => c.instanceId === id);
      if (other) return getDefinition(state.definitions, other.cardId)?.bp ?? 0;
    }
    return 0;
  };
  const lowest = () => [...picks].sort((a, b) => bpOf(a.instanceId) - bpOf(b.instanceId))[0]!;
  const highest = () => [...picks].sort((a, b) => bpOf(b.instanceId) - bpOf(a.instanceId))[0]!;
  const enemyHasUnits = unitIds(state, enemyId).length > 0;
  switch (pending.effectId) {
    case OPPONENT_SELF_DESTROY_EFFECT_ID:
      // 自分のユニットを失う側: BP の一番低いユニット。
      return lowest();
    case FIERCE_FIGHT_EFFECT_ID:
    case GRAY_BLASTER_EFFECT_ID:
      // 自軍の一番弱い S ユニットと引きかえに、相手のユニットを1体減らす（相手にユニットがなければしない）。
      return enemyHasUnits ? lowest() : (skip ?? null);
    case G6_GRAND_PRIX_EFFECT_ID: {
      // 撃破できる敵軍ユニットがあるときだけパワーを捨札にする（発動後は必ず選び切る）。
      if (pending.optional && !fieldUnits(state, enemyId).some((c) => effectiveBp(state, enemyId, c) <= G6_MAX_BP)) return skip ?? null;
      return picks[0]!;
    }
    case TAKE_THE_BLOW_EFFECT_ID: {
      // HM がアタックしてくるユニットより BP が高いときだけ代わる。
      const battle = pending.set8dMeta?.battle;
      const attacker = battle ? fieldUnits(state, battle.attackerPlayerId).find((c) => c.instanceId === battle.attackerInstanceId) : undefined;
      const attackerBp = attacker && battle ? effectiveBp(state, battle.attackerPlayerId, attacker) : Number.MAX_SAFE_INTEGER;
      const strong = picks.find((a) => bpOf(a.instanceId) > attackerBp);
      return strong ?? skip ?? null;
    }
    case FULL_POWER_DESTROY_EFFECT_ID:
    case G6_GRAND_PRIX_DESTROY_EFFECT_ID:
    case JUSTICE_SORTIE_DEPLOY_EFFECT_ID:
    case GUNPARD_GUN_PLACE_EFFECT_ID:
      // 敵軍ユニットの撃破・相手の手札を減らす・自軍に出す: 一番強いもの。
      return highest();
    case SOUL_ART_BRANCH_EFFECT_ID:
      return picks.find((a) => a.instanceId === "NC") ?? picks[0]!;
    default:
      // 山札を見る・ダメージを手札に戻す・コマンドをリリースする等、行って損のない効果は行う。
      return picks[0] ?? skip ?? null;
  }
}

void ownFieldHas;
