/**
 * 第9弾「蒼九の翼」（legend1）RS-648〜RS-669 のカード固有の名前付き効果（cardSpec RS9-648-669 で未実装だったもの）。
 *
 * - `trySet9CCardEffect`: DSL の grant_keyword（`set9c::cardId::name`、または既存のキーワード）から呼ばれる起点。
 * - `tryResolveSet9CChoice` / `trySkipSet9CChoice` / `tryConfirmSet9CChoice`: このモジュールが開いた選択の解決。
 * - 常時効果（BP・SP・ストライク・バトルエリアへの進入・スタートフェイズの戻し）と誘発（コンビネーション・ラッシュ・
 *   ジョイントコンビネーション R）は、それぞれの処理から呼ぶ。
 * 構成は rules/legend1/set8NamedEffectsC.ts と同じ。
 */
import { canonicalCardName, getJointRNamedEffect, getUnitEffectBlock } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isSmallUnit, cardCategories } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { applyDamageToPlayer } from "../damagePayment";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { grantBpBoostToBattleUnit, grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { addJointComboGrant, jointRGrantActive } from "../jointComboGrants";
import { wasRushedThisTurn } from "../turnModifiers";
import { stackOntoLargeCardsOn, stackOntoLargeGrant } from "../stackOntoLargeGrants";
import { continueBattleToRushEffectQueue } from "../startPhase";
import type { ComboOutcome } from "../comboTypes";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
type ChoiceConfirmer = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceConfirmer> = {};
const CHOICE_CAN_CONFIRM: Record<string, (state: GameState, pending: PendingEffectChoice) => boolean> = {};

export function isSet9CChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 複数選んで確定する選択で、いま確定できるか（合法手 confirm_effect_choice）。 */
export function canConfirmSet9CChoice(state: GameState, pending: PendingEffectChoice): boolean {
  const check = CHOICE_CAN_CONFIRM[pending.effectId];
  return !!check && check(state, pending);
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet9CChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet9CChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!CHOICE_RESOLVERS[pending.effectId]) return null;
  if (!pending.optional) return { error: "not_optional" };
  const skipper = CHOICE_SKIPPERS[pending.effectId] ?? simpleSkip(pending.sourceCardId);
  return skipper(state, playerId);
}

/** 複数選んだ選択を確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet9CChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return CHOICE_RESOLVERS[pending.effectId] ? { error: "not_confirmable" } : null;
  if (!canConfirmSet9CChoice(state, pending)) return { error: "not_confirmable" };
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

function defOf(state: GameState, cardId: string) {
  return getDefinition(state.definitions, cardId);
}

function isUnitCard(state: GameState, cardId: string): boolean {
  return defOf(state, cardId)?.type === "unit";
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => isUnitCard(state, c.cardId));
}

function featuresOf(state: GameState, cardId: string): string[] {
  return defOf(state, cardId)?.features ?? [];
}

function printedBp(state: GameState, cardId: string): number {
  const bp = defOf(state, cardId)?.bp;
  return typeof bp === "number" ? bp : 0;
}

function sameName(state: GameState, cardId: string, name: string): boolean {
  return canonicalCardName(cardName(state.definitions, cardId)) === canonicalCardName(name);
}

/** 場のユニットの付加情報を書き換える（バトル・ラッシュエリアのどちらにあっても）。 */
function patchFieldCard(state: GameState, playerId: PlayerId, instanceId: string, fn: (c: CardInstance) => CardInstance): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? fn(c) : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? fn(c) : c)),
  }));
}

function isOwnBattlePhase(state: GameState, playerId: PlayerId): boolean {
  return state.phase === "battle" && state.activePlayer === playerId;
}

/** 選択を開く（すでに別の選択が開いていれば、その選択の後に続ける）。 */
function openChoice(state: GameState, choice: PendingEffectChoice): GameState {
  const existing = state.pendingEffectChoice;
  if (!existing) return openEffectChoice(state, choice);
  return { ...state, pendingEffectChoice: { ...choice, resumeChoice: existing }, activePlayer: choice.playerId };
}

/** 「確認」の選択（効果のユニット自身を選ぶと行う。見送れば行わない）。 */
function confirmChoice(
  playerId: PlayerId,
  effectId: string,
  sourceCardId: string,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): PendingEffectChoice {
  return {
    playerId,
    effectId,
    sourceCardId,
    sourceInstanceId,
    kind: "confirm",
    phasePlayerId,
    validInstanceIds: [sourceInstanceId],
    selectedInstanceIds: [],
    optional: true,
  };
}

/** 選んだユニットを撃破する（R-TIME-01 の撃破の段階は applyUnitLeave に任せる）。 */
function destroyChosen(state: GameState, playerId: PlayerId, instanceId: string, cardId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: proceed(leave.state, pending),
    log: logFor(state, playerId, cardId, `${pending.effectId}:${cardName(state.definitions, found.card.cardId)}`),
  };
}

// ---------------------------------------------------------------------------
// ジョイントコンビネーション R（「これが…からコンビネーションするとき、次の効果を発動できる⇒…」）
//
// R ナンバーのカードの効果は、取り込みでは NC の欄（trigger nc）に分類されていることがある（RS-651 ガオマジロ・RS-652 ガオディアス）。
// ナンバーが「R」なので NC は成立せず、JC の手続き（rules/jointComboProcedure.ts）も trigger joint_combo_r の効果しか見ていなかったため、
// どちらからも発動しなかった。ここでは R ナンバーのカードの「これが…からコンビネーションするとき」の効果を JC の効果として扱い、
// 「⇒」の後の本文で処理する（atwiki/page-266「「R」はユニットからコンビネーションした自分自身が発動する能力」）。

export const JC_R_RUSH_ATTACK_EFFECT_ID = "set9c_jc_r_rush_attack";
export const JC_R_WHILE_ESTABLISHED_EFFECT_ID = "set9c_jc_r_while_established";
/** 「このターン、これは敵軍ラッシュエリアのユニットにアタックできる」の記録（rules/namedUnitEffects.ts canAttackRushWithYellowThunder が見る）。 */
const ATTACK_RUSH_ZONE_MARK = "attack_rush_zone";

const JC_R_RE = /^これが.+からコンビネーションするとき、次の効果を発動できる⇒(.+)$/;

/** R ナンバーのカードの、NC の欄に分類された JC の効果（trigger joint_combo_r のものは従来の手続きで扱う）。 */
function jointRFallbackEffect(cardId: string): { effectId: string; body: string } | null {
  if (getJointRNamedEffect(cardId)) return null;
  for (const named of getUnitEffectBlock(cardId)?.namedEffects ?? []) {
    if (named.trigger.type !== "nc") continue;
    const m = named.text.normalize("NFKC").match(JC_R_RE);
    if (m) return { effectId: named.effectId, body: m[1]! };
  }
  return null;
}

/**
 * JC の手続き（R ナンバーのカードが左隣の L ユニット等からコンビネーションしたとき）から呼ぶ。扱わない効果なら null。
 * 「発動できる」なので、発動するかを選ぶ確認を開く（R-CN-02 の「～してもよい」部分の任意と同じ）。
 */
export function trySet9CJointR(
  state: GameState,
  playerId: PlayerId,
  rCard: CardInstance,
): ComboOutcome | null {
  const def = defOf(state, rCard.cardId);
  if (def?.comboNumber !== "R") return null;
  const effect = jointRFallbackEffect(rCard.cardId);
  if (!effect) return null;
  // コンビネーションの効果は自軍バトルフェイズにしか発動しない（R-CN-04）。
  if (!isOwnBattlePhase(state, playerId)) return { state, logs: [] };
  let effectId: string | null = null;
  if (/^このターン、これは敵軍ラッシュエリアのユニットにアタックできる。?$/.test(effect.body)) effectId = JC_R_RUSH_ATTACK_EFFECT_ID;
  else if (/^このコンビネーションが成立している間、/.test(effect.body)) effectId = JC_R_WHILE_ESTABLISHED_EFFECT_ID;
  if (!effectId) return null;
  const log = buildLogEntry(playerId, "joint_combo_r", rCard.cardId, state.definitions, effect.effectId);
  return {
    state: openChoice(state, confirmChoice(playerId, effectId, rCard.cardId, rCard.instanceId, playerId)),
    logs: [log],
  };
}

CHOICE_RESOLVERS[JC_R_RUSH_ATTACK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  const next = markBattleNcEffect(close(state, pending), playerId, self, ATTACK_RUSH_ZONE_MARK);
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:accept`) };
};

CHOICE_RESOLVERS[JC_R_WHILE_ESTABLISHED_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  const effect = jointRFallbackEffect(pending.sourceCardId);
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === self);
  const left = index > 0 ? battle[index - 1] : undefined;
  let next = close(state, pending);
  if (effect && left) {
    // 発動した相手（左隣）が隣にいる間だけ有効（R-CN-06「一度でも隣り合わなくなれば無効」。rules/jointComboGrants.ts）。
    next = addJointComboGrant(next, playerId, self, {
      kind: "r",
      effectId: effect.effectId,
      sourceCardId: pending.sourceCardId,
      partnerInstanceId: left.instanceId,
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:accept`) };
};

// ---------------------------------------------------------------------------
// スタートフェイズにバトルエリアのユニットをラッシュエリアに戻すときの制限
//
// RS-648 ガオイカロス【イカロスバインド】「また、これが自軍バトルエリアにある間、相手は次の制限を受ける⇒ホールド状態のユニットを
//  ラッシュエリアに戻すとき、それを撃破するか戻さないかを選ぶ。」（atwiki/page-1497）
// RS-652 ガオディアス【清輝顕現バブルキャプチャー】「…⇒このコンビネーションが成立している間、敵軍バトルエリアの1番目のユニットは、
//  ラッシュエリアに戻せない。」（atwiki/page-1473）

export const ICARUS_BIND_RETURN_EFFECT_ID = "rs648_icarus_bind_return";
const ICARUS_DESTROY = "rs648_destroy";
const ICARUS_KEEP = "rs648_keep";

function icarusBindActiveAgainst(state: GameState, returningPlayerId: PlayerId): boolean {
  return state.players[opponent(returningPlayerId)].battle.some((c) => c.cardId === "RS-648");
}

function bubbleCaptureBlocks(state: GameState, returningPlayerId: PlayerId, instanceId: string): boolean {
  const first = state.players[returningPlayerId].battle[0];
  if (!first || first.instanceId !== instanceId) return false;
  const enemyId = opponent(returningPlayerId);
  return state.players[enemyId].battle.some(
    (c) => c.cardId === "RS-652" && jointRGrantActive(state, enemyId, c, "baburukyapucha"),
  );
}

function keptThisStart(state: GameState, instanceId: string): boolean {
  const stay = state.set9cMeta?.startStay;
  return !!stay && stay.turn === state.turn && stay.instanceIds.includes(instanceId);
}

/** このスタートフェイズに、戻す対象から外れている（戻せない／戻さないことを選んだ）バトルエリアのユニットか。 */
export function set9CStaysInBattleAtStart(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return keptThisStart(state, instanceId) || bubbleCaptureBlocks(state, playerId, instanceId);
}

/**
 * スタートフェイズの戻しで、組 groupIds（ライドの組を含む）を戻す前に呼ぶ。
 * - "stay": 戻さない（RS-652 の制限、または RS-648 で戻さないことを選んだ）
 * - 選択を開いた state: RS-648 の制限で、撃破するか戻さないかを持ち主が選ぶ（選んだ後に戻しの続きを行う）
 * - null: 普通に戻す
 */
export function set9CBeforeStartReturn(
  state: GameState,
  playerId: PlayerId,
  groupIds: string[],
): "stay" | GameState | null {
  if (groupIds.some((id) => set9CStaysInBattleAtStart(state, playerId, id))) return "stay";
  if (!icarusBindActiveAgainst(state, playerId)) return null;
  const battle = state.players[playerId].battle;
  const heldId = groupIds.find((id) => battle.some((c) => c.instanceId === id && c.commandHeld));
  if (!heldId) return null;
  const icarus = state.players[opponent(playerId)].battle.find((c) => c.cardId === "RS-648")!;
  return openChoice(state, {
    playerId,
    effectId: ICARUS_BIND_RETURN_EFFECT_ID,
    sourceCardId: "RS-648",
    sourceInstanceId: icarus.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: [ICARUS_DESTROY, ICARUS_KEEP],
    selectedInstanceIds: [heldId],
    selectCount: 1,
    optional: false,
  });
}

CHOICE_RESOLVERS[ICARUS_BIND_RETURN_EFFECT_ID] = (state, playerId, option) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.selectedInstanceIds?.[0];
  if (!target) return { error: "invalid_target" };
  const cleared = close(state, pending);
  if (option === ICARUS_KEEP) {
    const prev = cleared.set9cMeta?.startStay;
    const ids = prev && prev.turn === cleared.turn ? prev.instanceIds : [];
    const kept: GameState = {
      ...cleared,
      set9cMeta: { ...cleared.set9cMeta, startStay: { turn: cleared.turn, instanceIds: [...ids, target] } },
    };
    return { state: continueBattleToRushEffectQueue(kept), log: logFor(state, playerId, "RS-648", `${pending.effectId}:keep`) };
  }
  const leave = applyUnitLeave(cleared, target, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  const next = leave.state.pendingLeave || leave.state.pendingEffectChoice ? leave.state : continueBattleToRushEffectQueue(leave.state);
  return { state: next, log: logFor(state, playerId, "RS-648", `${pending.effectId}:destroy`) };
};

// ---------------------------------------------------------------------------
// RS-650 ガオライノス【強蹴一閃ライノシュート】
// 「自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間
//  カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒
//  このユニットからコンビネーションする「ガオマジロ」はBP+5000される。」（atwiki/page-1471）
// 重ねる処理・捨札は RS-623 等と共通（rules/stackOntoLargeUnit.ts）。得た能力は、重ねたユニット（重ねた関係）から
// コンビネーションしたときに働く（trySet9COnComboEnter。並び順が後で変わっても、そのターンは BP+5000 のまま。R-CN-06）。

/** 左隣（コンビネーションの相手）に重ねたカードが与える「このユニットからコンビネーションする「X」はBP+Nされる」。 */
function stackedComboBoost(state: GameState, left: CardInstance, card: CardInstance): number {
  let bonus = 0;
  for (const stacked of stackOntoLargeCardsOn(left)) {
    const boost = stackOntoLargeGrant(stacked.cardId)?.comboBoost;
    if (boost && sameName(state, card.cardId, boost.name)) bonus += boost.bp;
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// RS-653 レッドファルコン（2nd）【後輩戦士への叱咤】（CN：1）
// 「このユニットからコンビネーションする特徴「イエロー」を持つSユニットは、このターン、次の能力を得る⇒BP+3000、「SP1」」（atwiki/page-1518）
// RS-654 ガオイエロー（2nd）【先輩戦士の教え】（CN：2）
// 「「SP1」特徴「レッド」を持つ自軍Sユニットを1体選びホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び撃破する。
//  （この効果は、「レッドファルコン｣からコンビネーションするときはナンバーに関係なく発動する）」（atwiki/page-1519）
// RS-669 キシャモス【アイスエイジエクスプレス】
// 「これが自軍バトルエリアにある間、このユニットから「ティライン、ケライン」の順にコンビネーションしたとき、敵軍バトルエリアから
//  本来のBPが5000以下の敵軍ユニットを1体選び持ち主のパワーゾーンに送ってもよい。」（atwiki/page-1446）

const SCOLDING_MARK = "rs653_scolding";
const TEACHING_MARK = "rs654_teaching";
export const TEACHING_HOLD_EFFECT_ID = "rs654_teaching_hold";
export const TEACHING_DESTROY_EFFECT_ID = "rs654_teaching_destroy";
export const ICE_AGE_EFFECT_ID = "rs669_ice_age_express";

/** バトルエリアに出たユニット card のコンビネーション（左隣から）の効果。rules/combo.ts から呼ぶ。 */
export function trySet9COnComboEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (state.pendingEffectChoice) return state;
  if (!isOwnBattlePhase(state, playerId)) return state;
  const before = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId);
  const left = before.at(-1);
  if (!left) return state;
  let next = state;
  // RS-650【強蹴一閃ライノシュート】: ガオライノスを重ねたユニットからコンビネーションした「ガオマジロ」は BP+5000。
  const rhino = stackedComboBoost(state, left, card);
  if (rhino > 0) next = grantBpBoostToBattleUnit(next, playerId, card.instanceId, rhino);
  // RS-653: 左隣のレッドファルコン（2nd）が NC で【後輩戦士への叱咤】を発動していれば、イエローの S ユニットが能力を得る。
  if ((left.activatedNcEffects ?? []).includes(SCOLDING_MARK) && isSmallUnit(state.definitions, card.cardId) && featuresOf(state, card.cardId).includes("イエロー")) {
    next = grantBpBoostToBattleUnit(next, playerId, card.instanceId, 3000);
    next = grantSp1ToBattleUnit(next, playerId, card.instanceId);
  }
  // RS-654: 「レッドファルコン」からコンビネーションするときはナンバーに関係なく発動する（2nd も同名。R-DECK-04）。
  if (card.cardId === "RS-654" && sameName(state, left.cardId, "レッドファルコン")) {
    next = startTeaching(next, playerId, card.instanceId);
    if (next.pendingEffectChoice) return next;
  }
  // RS-669: キシャモス → ティライン → ケライン の順に続けてコンビネーションしたとき（ケラインが出たとき）。
  const second = before.at(-2);
  if (
    sameName(state, card.cardId, "ケライン") &&
    sameName(state, left.cardId, "ティライン") &&
    second?.cardId === "RS-669"
  ) {
    next = openIceAge(next, playerId, second);
  }
  return next;
}

function startTeaching(state: GameState, playerId: PlayerId, selfId: string): GameState {
  const self = state.players[playerId].battle.find((c) => c.instanceId === selfId);
  if (!self || (self.activatedNcEffects ?? []).includes(TEACHING_MARK)) return state;
  let next = markBattleNcEffect(state, playerId, selfId, TEACHING_MARK);
  next = grantSp1ToBattleUnit(next, playerId, selfId);
  const reds = fieldUnits(next, playerId)
    .filter(
      (c) =>
        c.instanceId !== selfId &&
        !c.commandHeld &&
        isSmallUnit(next.definitions, c.cardId) &&
        featuresOf(next, c.cardId).includes("レッド"),
    )
    .map((c) => c.instanceId);
  if (reds.length === 0) return next;
  return openChoice(next, {
    playerId,
    effectId: TEACHING_HOLD_EFFECT_ID,
    sourceCardId: "RS-654",
    sourceInstanceId: selfId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: reds,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[TEACHING_HOLD_EFFECT_ID] = (state, playerId, redId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchFieldCard(close(state, pending), playerId, redId, (c) => ({ ...c, commandHeld: true }));
  const enemyId = opponent(playerId);
  const targets = next.players[enemyId].battle
    .filter((c) => isSmallUnit(next.definitions, c.cardId) && isSelectableByOpponentEffect(next, playerId, c.instanceId, "RS-654"))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RS-654", `${pending.effectId}:${cardName(state.definitions, findCardInField(state, redId)?.card.cardId ?? redId)}`);
  if (targets.length === 0) return { state: proceed(next, pending), log };
  next = openEffectChoice(next, {
    playerId,
    effectId: TEACHING_DESTROY_EFFECT_ID,
    sourceCardId: "RS-654",
    sourceInstanceId: pending.sourceInstanceId,
    kind: "select_unit",
    phasePlayerId: pending.phasePlayerId,
    validInstanceIds: targets,
    selectCount: 1,
    optional: false,
    resumeChoice: pending.resumeChoice,
  });
  return { state: next, log };
};

CHOICE_RESOLVERS[TEACHING_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => destroyChosen(state, playerId, instanceId, "RS-654");

function openIceAge(state: GameState, playerId: PlayerId, kishamos: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const targets = state.players[enemyId].battle
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        printedBp(state, c.cardId) <= 5000 &&
        isSelectableByOpponentEffect(state, playerId, c.instanceId, "RS-669"),
    )
    .map((c) => c.instanceId);
  if (targets.length === 0) return state;
  return openChoice(state, {
    playerId,
    effectId: ICE_AGE_EFFECT_ID,
    sourceCardId: "RS-669",
    sourceInstanceId: kishamos.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: targets,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[ICE_AGE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "power", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: proceed(leave.state, pending),
    log: logFor(state, playerId, "RS-669", `${pending.effectId}:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-655 デカウイングロボ【パトマグナム】「自軍捨札に特徴「スワット」を持つユニットカードが5枚以上あれば、これは「SP2」になる。」（atwiki/page-1528）
// RS-661 幻獣王リオ【破天攻】「これは敵軍Sユニット1体につきBP+1000される。」／※「これはラッシュしたターン、ストライクできない。」（atwiki/page-1500）

function patMagnumActive(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  if (instance.cardId !== "RS-655") return false;
  const swat = state.players[playerId].discard.filter(
    (c) => isUnitCard(state, c.cardId) && featuresOf(state, c.cardId).includes("スワット"),
  ).length;
  return swat >= 5;
}

/** SP の継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。 */
export function set9CEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  return patMagnumActive(state, playerId, instance) ? Math.max(sp, 2) : sp;
}

/** BP の継続効果（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ）。 */
export function set9CFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  if (instance.cardId === "RS-661" && fieldUnits(state, playerId).some((c) => c.instanceId === instance.instanceId)) {
    const enemyS = fieldUnits(state, opponent(playerId)).filter((c) => isSmallUnit(state.definitions, c.cardId)).length;
    bonus += 1000 * enemyS;
  }
  return bonus;
}

/** ストライクできない（rules/combo.ts canStrikeUnit から呼ぶ）。 */
export function set9CBlocksStrike(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  return instance.cardId === "RS-661" && wasRushedThisTurn(state.players[playerId], instance.instanceId);
}

// ---------------------------------------------------------------------------
// RS-656 デカウイングキャノン【オールスターアルティメットバスター】
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、特徴「人型」を持つBP6000以上の自軍ユニットをラッシュしたとき、そのBP以下のBPを持つ
//  敵軍ユニットを1体選び撃破する。さらに、このときラッシュしたユニットがXLユニットだったなら、相手に1点ダメージを与える。」（atwiki/page-1474）

export const ALL_STAR_BUSTER_EFFECT_ID = "rs656_all_star_buster";

/** 自軍ユニットをラッシュしたとき（rules/onRushUnitEffects.ts applyPassiveRushTriggers から呼ぶ）。 */
export function trySet9COnUnitRushed(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.phase !== "rush" || phasePlayerId !== rusherPlayerId || state.activePlayer !== rusherPlayerId) return state;
  const rusher = state.players[rusherPlayerId];
  const cannons = [...rusher.rush, ...rusher.battle].filter((c) => c.cardId === "RS-656" && c.instanceId !== rushedInstanceId);
  if (cannons.length === 0) return state;
  const rushed = rusher.rush.find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId) || !featuresOf(state, rushed.cardId).includes("人型")) return state;
  const bp = effectiveBp(state, rusherPlayerId, rushed);
  if (bp < 6000) return state;
  let next = state;
  // キャノン1体ごとに発動する（R-CONT-01）。
  for (const cannon of [...cannons].reverse()) {
    next = openAllStarBuster(next, rusherPlayerId, cannon, rushed, bp, phasePlayerId);
  }
  return next;
}

function allStarTargets(state: GameState, playerId: PlayerId, maxBp: number): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter(
      (c) =>
        effectiveBp(state, enemyId, c) <= maxBp &&
        isSelectableByOpponentEffect(state, playerId, c.instanceId, "RS-656"),
    )
    .map((c) => c.instanceId);
}

function isXl(state: GameState, cardId: string): boolean {
  return (defOf(state, cardId)?.size as string | undefined) === "XL";
}

function openAllStarBuster(
  state: GameState,
  playerId: PlayerId,
  cannon: CardInstance,
  rushed: CardInstance,
  bp: number,
  phasePlayerId: PlayerId,
): GameState {
  const targets = allStarTargets(state, playerId, bp);
  if (targets.length === 0) {
    return isXl(state, rushed.cardId)
      ? applyDamageToPlayer(state, opponent(playerId), 1, { kind: "none", activePlayer: phasePlayerId })
      : state;
  }
  return openChoice(state, {
    playerId,
    effectId: ALL_STAR_BUSTER_EFFECT_ID,
    sourceCardId: "RS-656",
    sourceInstanceId: cannon.instanceId,
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: targets,
    selectedInstanceIds: [rushed.instanceId],
    selectCount: 1,
    optional: false,
  });
}

CHOICE_RESOLVERS[ALL_STAR_BUSTER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const rushedId = pending.selectedInstanceIds?.[0];
  const rushed = rushedId ? findCardInField(state, rushedId)?.card : undefined;
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  let next = leave.state;
  if (rushed && isXl(state, rushed.cardId)) {
    next = applyDamageToPlayer(next, opponent(playerId), 1, { kind: "none", activePlayer: pending.phasePlayerId });
  }
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, "RS-656", `${pending.effectId}:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-658 デカグリーンSWAT【突入】（CN：3）「敵軍ラッシュエリアからSユニットを2体まで選びバトルエリアに出してもよい（出す順番は自分が選ぶ）。」
// （atwiki/page-1526）— 1体ずつ選んだ順に出す（rules/pendingChoices.ts の pit_in_dive_order を2体までで使う）。

function openRaid(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => isSmallUnit(state.definitions, c.cardId) && isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId, ctx.sourceCardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rs658_raid:no_targets" };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: "pit_in_dive",
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "pit_in_dive_order",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: Math.min(2, ids.length),
      optional: true,
    }),
    detail: "rs658_raid",
  };
}

// ---------------------------------------------------------------------------
// RS-659 デカイエローSWAT【感知システム】（CN：4）
// 「「SP1」自軍パワーゾーンのオモテ向きのカードの中から、Sユニットのカードを1枚選び手札に加えてもよい。そうしたとき、
//  自軍山札の上から1枚引いて自軍パワーゾーンに置いてもよい。」（atwiki/page-1504）

export const SENSOR_PICK_EFFECT_ID = "rs659_sensor_pick";
export const SENSOR_DRAW_EFFECT_ID = "rs659_sensor_draw";

function openSensor(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  let next = self ? grantSp1ToBattleUnit(state, ctx.playerId, self) : state;
  const ids = next.players[ctx.playerId].power
    .filter((c) => !c.faceDown && isUnitCard(next, c.cardId) && isSmallUnit(next.definitions, c.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "rs659_sensor:no_targets" };
  next = openEffectChoice(next, {
    playerId: ctx.playerId,
    effectId: SENSOR_PICK_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: self,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
  return { state: next, detail: SENSOR_PICK_EFFECT_ID };
}

CHOICE_RESOLVERS[SENSOR_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, { instanceId: card.instanceId, cardId: card.cardId }],
  }));
  const log = logFor(state, playerId, "RS-659", `${pending.effectId}:${cardName(state.definitions, card.cardId)}`);
  const top = next.players[playerId].deck[0];
  if (!top) return { state: proceed(next, pending), log };
  next = openEffectChoice(next, {
    playerId,
    effectId: SENSOR_DRAW_EFFECT_ID,
    sourceCardId: "RS-659",
    sourceInstanceId: pending.sourceInstanceId,
    kind: "confirm",
    phasePlayerId: pending.phasePlayerId,
    validInstanceIds: [top.instanceId],
    selectedInstanceIds: [],
    optional: true,
    resumeChoice: pending.resumeChoice,
  });
  return { state: next, log };
};

CHOICE_RESOLVERS[SENSOR_DRAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const [top, ...deck] = p.deck;
    if (!top) return p;
    return { ...p, deck, power: [...p.power, { instanceId: top.instanceId, cardId: top.cardId }] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-659", `${pending.effectId}:accept`) };
};

// ---------------------------------------------------------------------------
// RS-660 デカピンクSWAT【SPインカム】（CN：5）
// 「次の相手ターン、新しくラッシュエリアに出たユニットと、ホールド状態のユニットは、ターンが終わるまでバトルエリアに出られない」（atwiki/page-1527）
// 「新しくラッシュエリアに出た」はそのターンにラッシュエリアに出た（ラッシュ・効果で出た）ユニット（wasRushedThisTurn）。

function armSpIncome(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const armer = ctx.playerId;
  const restricted = opponent(armer);
  // 「次の相手ターン」— 自分の追加ターン（RS-484【ハリーアップ！】）があれば、その後の相手のターン。
  const extra = (state.extraTurns ?? []).filter((p) => p === armer).length;
  const entry = { restrictedPlayerId: restricted, turn: state.turn + 1 + extra };
  return {
    state: { ...state, set9cMeta: { ...state.set9cMeta, spIncome: [...(state.set9cMeta?.spIncome ?? []), entry] } },
    detail: "rs660_sp_income",
  };
}

/** バトルエリアに出られない（rules/restrictions.ts canMoveUnitToBattle から呼ぶ）。 */
export function set9CBlocksBattleEntry(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  const active = (state.set9cMeta?.spIncome ?? []).some((e) => e.turn === state.turn && state.activePlayer === e.restrictedPlayerId);
  if (!active) return false;
  return !!unit.commandHeld || wasRushedThisTurn(state.players[playerId], unit.instanceId);
}

// ---------------------------------------------------------------------------
// RS-663 エンジンオーG12【G12グランプリ】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ユニットを本来のBPの合計が12000以下になるように選び撃破してもよい。」（atwiki/page-1502）
// RS-664 エンジンオーG9【G9グランプリ】「これをラッシュしたとき、本来のBPが9000以下の敵軍ユニットを1体選び、撃破してもよい。」（atwiki/page-1494）

export const G12_EFFECT_ID = "rs663_g12_grand_prix";
export const G9_EFFECT_ID = "rs664_g9_grand_prix";
const G12_BUDGET = 12000;

function g12Candidates(state: GameState, playerId: PlayerId, selected: string[]): string[] {
  const enemyId = opponent(playerId);
  const used = selected.reduce((sum, id) => sum + printedBp(state, findCardInField(state, id)?.card.cardId ?? ""), 0);
  return fieldUnits(state, enemyId)
    .filter(
      (c) =>
        !selected.includes(c.instanceId) &&
        used + printedBp(state, c.cardId) <= G12_BUDGET &&
        isSelectableByOpponentEffect(state, playerId, c.instanceId, "RS-663"),
    )
    .map((c) => c.instanceId);
}

function openG12(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${G12_EFFECT_ID}:not_own_turn` };
  const ids = g12Candidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: `${G12_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: G12_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectedInstanceIds: [],
      bpBudget: G12_BUDGET,
      optional: true,
    }),
    detail: G12_EFFECT_ID,
  };
}

/** 選んだユニットを順に撃破する（撃破の誘発で中断したら、残りは processedInstanceIds で続ける）。 */
function destroyG12Selected(state: GameState, pending: PendingEffectChoice, playerId: PlayerId): ChoiceOutcome {
  const selected = pending.selectedInstanceIds ?? [];
  let next = close(state, pending);
  for (const id of selected) {
    if (!findCardInField(next, id)) continue;
    const leave = applyUnitLeave(next, id, "discard", pending.phasePlayerId);
    if ("error" in leave) continue;
    next = leave.state;
  }
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, "RS-663", `${G12_EFFECT_ID}:${selected.map((id) => cardName(state.definitions, findCardInField(state, id)?.card.cardId ?? id)).join(",")}`),
  };
}

CHOICE_RESOLVERS[G12_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = g12Candidates(state, playerId, selected);
  const updated: PendingEffectChoice = { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining, optional: false };
  if (remaining.length === 0) return destroyG12Selected({ ...state, pendingEffectChoice: updated }, updated, playerId);
  return { state: { ...state, pendingEffectChoice: updated } };
};
CHOICE_CAN_CONFIRM[G12_EFFECT_ID] = (_state, pending) => (pending.selectedInstanceIds?.length ?? 0) > 0;
CHOICE_CONFIRMERS[G12_EFFECT_ID] = (state, playerId) => destroyG12Selected(state, state.pendingEffectChoice!, playerId);

function openG9(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => printedBp(state, c.cardId) <= 9000 && isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId, ctx.sourceCardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${G9_EFFECT_ID}:no_targets` };
  return {
    state: openChoice(state, {
      playerId: ctx.playerId,
      effectId: G9_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: G9_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[G9_EFFECT_ID] = (state, playerId, instanceId) => destroyChosen(state, playerId, instanceId, "RS-664");

// ---------------------------------------------------------------------------
// RS-665 キョウレツオー【キョウレツエクスプレス】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍山札の上から1枚をオモテにして、それが特徴「炎神」または
//  「恐竜」を持つカードだったなら、このターン、これは「SP1」になる。その後、オモテにしたカードは山札の下に戻す。」（atwiki/page-1476）

export const KYOURETSU_EXPRESS_EFFECT_ID = "rs665_kyouretsu_express";

function openKyouretsuExpress(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${KYOURETSU_EXPRESS_EFFECT_ID}:not_own_turn` };
  const self = ctx.triggerSourceInstanceId;
  if (!self || state.players[ctx.playerId].deck.length === 0) return { state, detail: `${KYOURETSU_EXPRESS_EFFECT_ID}:no_deck` };
  return {
    state: openChoice(state, confirmChoice(ctx.playerId, KYOURETSU_EXPRESS_EFFECT_ID, ctx.sourceCardId, self, ctx.phasePlayerId)),
    detail: KYOURETSU_EXPRESS_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[KYOURETSU_EXPRESS_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  let next = close(state, pending);
  const top = next.players[playerId].deck[0];
  if (!top) return { state: proceed(next, pending), log: logFor(state, playerId, "RS-665", `${pending.effectId}:no_deck`) };
  const features = featuresOf(next, top.cardId);
  const hit = features.includes("炎神") || features.includes("恐竜");
  if (hit && next.players[playerId].battle.some((c) => c.instanceId === self)) next = grantSp1ToBattleUnit(next, playerId, self);
  next = patchPlayer(next, playerId, (p) => ({ ...p, deck: [...p.deck.slice(1), top] }));
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, "RS-665", `${pending.effectId}:${cardName(state.definitions, top.cardId)}:${hit ? "sp1" : "miss"}`),
  };
};

// ---------------------------------------------------------------------------
// DSL grant_keyword（`set9c::cardId::name`、または既存のキーワード）からの起点

export const SET9C_KEYWORD_PREFIX = "set9c::";

/**
 * 既存の DSL キーワードはそのままにして、ここで名前付き効果に割り当てる。
 * キーワードはカードを特定しないことがあるので、カード ID と組で照合する。
 */
const SET9C_SPEC_KEYWORDS: Record<string, string> = {
  "RS-653|effect_card::RS-653::henoe5be8c": "RS-653::scolding",
  "RS-653|grant_ability_konoyunitokarakonbineshonsuruierowotsusyunitohakonotanno": "RS-653::scolding",
  "RS-654|SP1": "RS-654::teaching",
  "RS-658|effect_card::RS-658::fxunknowne7aa81": "RS-658::raid",
  "RS-658|deploy_battle_area_rashueriakarasyunitowo2madebibatoruerianishitemoyoisu": "RS-658::raid",
  "RS-659|SP1": "RS-659::sensor",
  "RS-660|effect_card::RS-660::spinkamu": "RS-660::sp_income",
  "RS-660|cannot_restrict_notanshikurashuerianitayunitotohorudonoyunitohatan": "RS-660::sp_income",
  "RS-663|effect_card::RS-663::g12guranpuri": "RS-663::g12",
  "RS-663|destroy_enter_battle_tankoregabatoruerianitatokiyunitowonobpnoga1200": "RS-663::g12",
  "RS-664|effect_card::RS-664::g9guranpuri": "RS-664::g9",
  "RS-664|destroy_on_rush_koreworashushitatokinobpga9000noyunitowo1bi_geki_ha_shit": "RS-664::g9",
  "RS-665|effect_card::RS-665::kyouretsuekusupuresu": "RS-665::kyouretsu_express",
  "RS-665|grant_effect_tankoregabatoruerianitatokinowodekirunokara1": "RS-665::kyouretsu_express",
  // 常時効果・他の処理から呼ぶ誘発（ここでは何もしない）。
  "RS-651|effect_card::RS-651::tari": "RS-651::joint_r",
  "RS-652|effect_card::RS-652::baburukyapucha": "RS-652::joint_r",
  "RS-655|SP2": "RS-655::pat_magnum",
  "RS-656|deal_damage": "RS-656::all_star_buster",
  "RS-661|per_enemy_s_bp_boost_1000": "RS-661::haten",
  "RS-669|effect_card::RS-669::aisueijiekusupuresu": "RS-669::ice_age",
};

export function trySet9CCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  const mapped = SET9C_SPEC_KEYWORDS[`${ctx.sourceCardId}|${keyword}`];
  if (!mapped && !keyword.startsWith(SET9C_KEYWORD_PREFIX)) return null;
  switch (mapped ?? keyword.slice(SET9C_KEYWORD_PREFIX.length)) {
    case "RS-653::scolding": {
      const self = ctx.triggerSourceInstanceId;
      if (!self) return { state, detail: keyword };
      return { state: markBattleNcEffect(state, ctx.playerId, self, SCOLDING_MARK), detail: SCOLDING_MARK };
    }
    case "RS-654::teaching": {
      const self = ctx.triggerSourceInstanceId;
      if (!self) return { state, detail: keyword };
      return { state: startTeaching(state, ctx.playerId, self), detail: TEACHING_HOLD_EFFECT_ID };
    }
    case "RS-658::raid":
      return openRaid(state, ctx);
    case "RS-659::sensor":
      return openSensor(state, ctx);
    case "RS-660::sp_income":
      return armSpIncome(state, ctx);
    case "RS-663::g12":
      return openG12(state, ctx);
    case "RS-664::g9":
      return openG9(state, ctx);
    case "RS-665::kyouretsu_express":
      return openKyouretsuExpress(state, ctx);
    default:
      // 常時効果・他の処理から呼ぶ誘発の目印。
      return { state, detail: keyword };
  }
}
