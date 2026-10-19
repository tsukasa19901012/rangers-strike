/**
 * ザ・マスクドライダーEXP vol.2〜3 RK-169〜RK-189（仮面ライダーゼロノスVF〜ジェイクロッサー）のカード固有の効果（cardSpec RK9-169-189 の監査）。
 *
 * - `tryRk9CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk9::cardId::name`。オペレーション・RC・NC・ラッシュしたとき・バトルエリアに出たとき）。
 * - `tryResolveRk9Choice` / `trySkipRk9Choice` / `tryConfirmRk9Choice`: このモジュールが開いた選択の解決。撃破・パワーに送る選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - `applyRk9AfterAction`: RK-169【グランドストライク】（パワーゾーンが8枚を経過）・RK-184【生命維持プール】（ホールド状態になった）（core/applyAction.ts の後処理）。
 * - `openRk9HachiAtRushEnd`: RK-177【催眠音波】（ラッシュフェイズを終えるとき。core/applyAction.ts の end_phase）。
 * - `isRk9BattleCounterCard` / `rk9BattleCounterConditionMet` / `applyRk9RuriOokami`: RK-172 ルリオオカミ（※カウンター）。
 * - `openRk9Berry` / `resolveRk9BerryPick` / `skipRk9Berry`: RK-188【地空人のエージェント】（アタックされたとき。core/applyAction.ts）。
 * - `rk9RecordAttack`: RK-175【ライダーキック】の「これがアタックしなかったとき」のためのアタックの記録。
 * - `tryRk9OnEnterBattle`: RK-175 の次にコンビネーションする S ユニットの BP・RK-179/RK-189（ライドして出たビークル）（rules/combo.ts）。
 * - `rk9NewNigoOnEntry`: RK-176 の（）書き（「仮面ライダー1号」からコンビネーションするとき。rules/battleEntry.ts）。
 * - `rk9OnAttackWin` / `rk9AfterBattle` / `rk9WinButDestroyed`: RK-183【ZOキック】・RK-181【ハイバイブネイル】（rules/operationCounters.ts のバトルの解決）。
 * - `rk9EffectiveSp`: RK-181 の「SP1/5」（rules/legend3/fieldEffects.ts）。
 * 継続効果の判定（RK-171・RK-173・RK-175・RK-177・RK-182）は rules/rk/rk9Fields.ts。構成は rules/rk/rk8UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, effectiveCommandCategories, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { crossReductionFor } from "../../keywords/battleKeywords";
import { canRiderMountVehicle } from "../../keywords/ride";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { battlePositionOneBased, printedSpBase } from "../fractionalSp";
import { grantSp1ToBattleUnit } from "../namedUnitEffects";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { finalizeEffectRush, markFieldEntryHandled } from "../../events/emitUnitRushed";
import { applyDamageToPlayer } from "../damagePayment";
import { wasRushedThisTurn } from "../turnModifiers";
import { addBakiBakiExtraAttack } from "../turnModifierBridge";
import { rk1IsSmallNow } from "./rk1Features";
import { rk1ResidentLeaving } from "./rk1NamedEffects";
import {
  RK9_CONTRACT_RULE,
  RK9_HACHI_DONE_RULE,
  RK9_HACHI_NOT_HELD_RULE,
  RK9_HIGH_VIBE_RULE,
  RK9_RIDER_KICK_ATTACKED_RULE,
  RK9_RIDER_KICK_RULE,
  RK9_ZO_KICK_RULE,
  rk9HachiOnField,
  rk9HasInstancePayload,
} from "./rk9Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK9_KEYWORD_PREFIX = "rk9::";

export function isRk9ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk9Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk9Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 選んだところで確定できる選択か（「発動する」の確認）。 */
export function canConfirmRk9Choice(pending: PendingEffectChoice): boolean {
  return pending.effectId in CHOICE_CONFIRMERS && pending.kind === "confirm";
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk9Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk9Choice(pending)) return { error: "no_selection" };
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

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function isVehicleCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "vehicle";
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

function categoriesOfCard(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category;
  return Array.isArray(c) ? c : c ? [c] : [];
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

/** 場のユニットを取り除く（重ねていたカードは捨札。ライドしていたビークルはその場に残る）。 */
function takeUnitOff(state: GameState, ownerId: PlayerId, instanceId: string): { state: GameState; card: CardInstance } | null {
  const p = state.players[ownerId];
  const zone = p.battle.some((c) => c.instanceId === instanceId) ? "battle" : p.rush.some((c) => c.instanceId === instanceId) ? "rush" : null;
  if (!zone) return null;
  const card = p[zone].find((c) => c.instanceId === instanceId)!;
  const stacked = (card.stackedCards ?? []).map(stripForZone);
  const next = patchPlayer(state, ownerId, (pl) => ({
    ...pl,
    [zone]: pl[zone].filter((c) => c.instanceId !== instanceId),
    discard: [...pl.discard, ...stacked],
  }));
  return { state: next, card: stripForZone(card) };
}

const USABLE_AS_RE = /これは「([^」]+)」として(?:つかえる|使える)/g;

/** カード名と「これは「○○」として使える」の名前。 */
function namesOf(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const def = getDefinition(state.definitions, cardId);
  if (!def) return [];
  const names = [def.name];
  for (const m of (def.text ?? "").matchAll(USABLE_AS_RE)) if (m[1]) names.push(m[1]);
  return names;
}

function hasName(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  return namesOf(state, cardId).some((n) => sameCardName(n, name));
}

/** 直前に出たユニット（左隣。ビークルを除く）。 */
function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

function hasBlockingPrompt(state: GameState): boolean {
  return !!(
    state.pendingBattle ||
    state.pendingStrike ||
    state.pendingLeave ||
    state.pendingRegister ||
    state.pendingDamagePayment ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.winner
  );
}

// ---------------------------------------------------------------------------
// RK-169 仮面ライダーゼロノスVF【グランドストライク】
// 「これが自軍エリアにある間、自軍パワーゾーンのカードが8枚になったとき、次の効果を発動できる⇒相手に1点ダメージを与える。」（atwiki/page-683）
// - 同時に複数枚を動かしても1枚ずつ動かしたものとして扱い、8枚を経過すれば発動する（grnrngr/faq-rider-2 RK-169 Q・RK-089 Q1）。
//   アクションの前後の枚数で、8枚を経過したかを見る（前が8枚ならすでに8枚なので発動しない）。
// - モーフ等の置き換えでは枚数は変わらないので発動しない（atwiki/page-683 Q2・atwiki/page-1413）。2体あればそれぞれ発動する（カード評価）。
// RK-184 ドラス【生命維持プール】
// 「これが自軍エリアにある間、これがホールド状態になったとき、自軍常駐置き場からカードを1枚選び捨札にしてもよい（ウラ向きのカードはウラ向きのまま
//  選ぶ）。そうしたとき、これをリリースする。」（atwiki/page-1001）。ターンを問わない（コメント欄）。重ねていたカードも捨札。

export const GRAND_STRIKE_EFFECT_ID = "rk169_grand_strike";
export const LIFE_POOL_EFFECT_ID = "rk184_life_pool";

function passedEight(before: number, after: number): boolean {
  return (before < 8 && after >= 8) || (before > 8 && after <= 8);
}

export function applyRk9AfterAction(before: GameState, after: GameState, turnPlayer: PlayerId): GameState {
  if (after.winner) return after;
  const opens: PendingEffectChoice[] = [...(after.rk9DeferredChoices ?? [])];
  for (const pid of [turnPlayer, opponent(turnPlayer)] as const) {
    if (passedEight(before.players[pid].power.length, after.players[pid].power.length)) {
      for (const vf of fieldCards(after, pid).filter((c) => isSameCardIdentity(c.cardId, "RK-169"))) {
        opens.push(confirmChoice({ playerId: pid, phasePlayerId: turnPlayer, sourceInstanceId: vf.instanceId }, "RK-169", GRAND_STRIKE_EFFECT_ID));
      }
    }
    if (after.players[pid].operation.length > 0) {
      for (const dr of fieldCards(after, pid).filter((c) => isSameCardIdentity(c.cardId, "RK-184") && c.commandHeld)) {
        const prev = fieldCards(before, pid).find((c) => c.instanceId === dr.instanceId);
        if (!prev || prev.commandHeld) continue;
        opens.push({
          ...base({ playerId: pid, phasePlayerId: turnPlayer, sourceInstanceId: dr.instanceId }, "RK-184"),
          effectId: LIFE_POOL_EFFECT_ID,
          kind: "select_unit",
          validInstanceIds: after.players[pid].operation.map((c) => c.instanceId),
          selectCount: 1,
          optional: true,
        });
      }
    }
  }
  if (opens.length === 0) return after.rk9DeferredChoices ? { ...after, rk9DeferredChoices: undefined } : after;
  if (hasBlockingPrompt(after)) return { ...after, rk9DeferredChoices: opens };
  let next: GameState = { ...after, rk9DeferredChoices: undefined };
  for (const choice of opens) {
    if (choice.effectId === LIFE_POOL_EFFECT_ID) {
      const ids = next.players[choice.playerId].operation.map((c) => c.instanceId);
      if (ids.length === 0) continue;
      next = openOrQueue(next, { ...choice, validInstanceIds: ids });
    } else {
      next = openOrQueue(next, choice);
    }
  }
  return next;
}

CHOICE_RESOLVERS[GRAND_STRIKE_EFFECT_ID] = (state) => ({ state });
CHOICE_SKIPPERS[GRAND_STRIKE_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[GRAND_STRIKE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const damaged = applyDamageToPlayer(close(state, pending), opponent(playerId), 1, { kind: "none", activePlayer: pending.phasePlayerId });
  return { state: proceed(damaged, pending), log: logFor(state, playerId, "RK-169", `${GRAND_STRIKE_EFFECT_ID}:damage`) };
};

CHOICE_RESOLVERS[LIFE_POOL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].operation.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const leaving = rk1ResidentLeaving(card);
  const stacked = (card.stackedCards ?? []).map(stripForZone);
  const selfId = pending.sourceInstanceId;
  const release = (c: CardInstance): CardInstance => (c.instanceId === selfId ? { ...c, commandHeld: false, registerHeld: undefined } : c);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    operation: p.operation.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card), ...(leaving ? [] : stacked)],
    hand: leaving ? [...p.hand, ...leaving.toHand] : p.hand,
    battle: p.battle.map(release),
    rush: p.rush.map(release),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-184", `${LIFE_POOL_EFFECT_ID}:${card.faceDown ? "face_down" : cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[LIFE_POOL_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-171 コントラクト（オペレーション）
// 「本来の特徴に「ミラーライダー」を持つ自軍ユニットを1体選ぶ。このターン、選んだユニットは、指定されたユニットからコンビネーションしたときに発動できる
//  効果名を持つ効果を、指定されたユニットのかわりに、本来の特徴に「ミラーモンスター」を持つユニットからコンビネーションすれば、その効果を発動できる。」
//  （atwiki/page-902）。選ぶのは強制。コンビネーションの判定は rules/rk/rk9Fields.ts rk9ContractCovers（rk2・rk4・rk6 の判定から呼ぶ）。

export const CONTRACT_EFFECT_ID = "rk171_contract";

function applyContract(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("ミラーライダー"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk171:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RK-171"),
      effectId: CONTRACT_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: CONTRACT_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[CONTRACT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const marked = addTurnPayload(close(state, pending), playerId, RK9_CONTRACT_RULE, "RK-171", { instanceId });
  return { state: proceed(marked, pending), log: logFor(state, playerId, "RK-171", `${CONTRACT_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-172 ルリオオカミ（※カウンター）
// 「これは自軍ユニットがアタックされたとき発動できる⇒自軍山札の上から3枚オモテにする。そして、オモテにしたカードの中から、アタックしてきたユニットの
//  必要パワーの数字以上の必要パワーの数字を持つカードをすべて自分の手札に加え、それ以外は山札に戻してシャッフルする。この効果で1枚以上のカードを
//  手札に加えたなら、そのバトルは行われない。」（atwiki/page-906）。オペレーションの必要パワーも数える。「7+」は7。

export const RURI_OOKAMI_CARD_ID = "RK-172";

export function isRk9BattleCounterCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, RURI_OOKAMI_CARD_ID);
}

type BattleRef = Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId" | "defenderInstanceId"> & {
  effectBattle?: boolean;
  battleCancelled?: boolean;
};

/** 「自軍ユニットがアタックされたとき」が成り立っているか（コストは別に判定する）。 */
export function rk9BattleCounterConditionMet(state: GameState, defenderId: PlayerId, cardId: string, battle: BattleRef): boolean {
  if (!isRk9BattleCounterCard(cardId)) return false;
  if (battle.defenderPlayerId !== defenderId || battle.effectBattle || battle.battleCancelled) return false;
  return fieldUnits(state, defenderId).some((c) => c.instanceId === battle.defenderInstanceId);
}

/** ルリオオカミの効果（使ったカードを捨札にするのは呼び出し側）。手札に1枚以上加えたら cancel。 */
export function applyRk9RuriOokami(state: GameState, defenderId: PlayerId, battle: BattleRef): { state: GameState; cancel: boolean; detail: string } {
  const attacker = fieldCards(state, battle.attackerPlayerId).find((c) => c.instanceId === battle.attackerInstanceId);
  const threshold = attacker ? parsePowerCost(getDefinition(state.definitions, attacker.cardId)?.powerCost) : Number.NaN;
  const deck = state.players[defenderId].deck;
  const revealed = deck.slice(0, 3);
  const taken = revealed.filter((c) => {
    const n = parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost);
    return Number.isFinite(threshold) && Number.isFinite(n) && n >= threshold;
  });
  const takenIds = new Set(taken.map((c) => c.instanceId));
  const next = patchPlayer(state, defenderId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => !takenIds.has(c.instanceId))),
    hand: [...p.hand, ...taken.map(stripForZone)],
  }));
  return { state: next, cancel: taken.length > 0, detail: `ruri_ookami:${taken.length}` };
}

// ---------------------------------------------------------------------------
// RK-173 鬼の鎧（オペレーション）
// 「自軍Sユニットを選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、敵軍ターン中、
//  リリース状態の自軍コマンド1つにつきBP+1000される。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」（atwiki/page-907）
// RK-013 Jパワーと同じく、このカードは選んだユニットの下に重ねる（ユニットの stackedCards）。BP は rules/rk/rk9Fields.ts rk9FieldBpBonus、
// 捨札は rules/rk/rk1NamedEffects.ts settleJPowerStacks（rk1Features.isStackedUnderUnitOperation）。1体に何枚でも重ねられる（コメント欄）。

export const ONI_ARMOR_EFFECT_ID = "rk173_oni_armor";

function applyOniArmor(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk173:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RK-173"),
      effectId: ONI_ARMOR_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: ONI_ARMOR_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ONI_ARMOR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${pending.sourceCardId}:op`, cardId: pending.sourceCardId };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle), discard: p.discard.filter((c) => c.instanceId !== opCard.instanceId) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-173", `${ONI_ARMOR_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-174 プットオン（オペレーション）
// 「カード名に「RF（ライダーフォーム）」を含む自軍ユニットを1体選び、手札に戻してもよい。そうしたとき、自軍パワーゾーンのオモテ向きのカードから、
//  カード名に「MF（マスクドフォーム）」を含むユニットカードを1枚選び、自軍ラッシュエリアに出す。その後、このカードを自軍パワーゾーンに置く。」（atwiki/page-908）
// - 戻さなければ効果はそこで終わり、このカードは捨札になる（コメント欄「ユーザーレベルFAQの確認済みの項…途中で効果が終わる」）。
// - RF と MF は別のライダーでもよい（カード評価）。MF のカードはラッシュエリアに出す（効果によるラッシュ）。このカードはその後オモテ向きでパワーゾーンへ
//   （出した MF の「ラッシュしたとき」はこのカードを置いた後に解決する。コメント欄「置いたプットオンを超電子レーダーで回収できる」）。

export const PUT_ON_RF_EFFECT_ID = "rk174_put_on_rf";
export const PUT_ON_MF_EFFECT_ID = "rk174_put_on_mf";

function applyPutOn(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => cardName(state.definitions, c.cardId).includes("RF"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk174:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, "RK-174"),
      effectId: PUT_ON_RF_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: PUT_ON_RF_EFFECT_ID,
  };
}

/** プットオン本体をパワーゾーンにオモテ向きで置く（使用の処理で捨札に置かれていれば取り除く）。 */
function putOnToPower(state: GameState, playerId: PlayerId, opId: string | undefined): GameState {
  if (!opId) return state;
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== opId),
    power: [...p.power.filter((c) => c.instanceId !== opId), { instanceId: opId, cardId: "RK-174" }],
  }));
}

CHOICE_RESOLVERS[PUT_ON_RF_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const taken = takeUnitOff(close(state, pending), playerId, instanceId);
  if (!taken) return { error: "invalid_target" };
  const returned = patchPlayer(taken.state, playerId, (p) => ({ ...p, hand: [...p.hand, taken.card] }));
  const log = logFor(state, playerId, "RK-174", `${PUT_ON_RF_EFFECT_ID}:${cardName(state.definitions, taken.card.cardId)}`);
  const mf = returned.players[playerId].power
    .filter((c) => !c.faceDown && isUnitCard(returned, c.cardId) && cardName(returned.definitions, c.cardId).includes("MF"))
    .map((c) => c.instanceId);
  if (mf.length === 0) return { state: proceed(putOnToPower(returned, playerId, pending.sourceInstanceId), pending), log };
  return {
    state: openNext(returned, pending, {
      ...base(pending, "RK-174"),
      effectId: PUT_ON_MF_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: mf,
      selectCount: 1,
      optional: false,
    }),
    log,
  };
};
CHOICE_SKIPPERS[PUT_ON_RF_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[PUT_ON_MF_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  next = putOnToPower(next, playerId, pending.sourceInstanceId);
  const rushed = finalizeEffectRush(next, playerId, [instanceId], pending.phasePlayerId);
  next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-174", `${PUT_ON_MF_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-175 仮面ライダー新1号【ライダーキック】（RC）
// 「このターン、敵軍ユニットのレジストとスクラムとチェイスの効果は無効になる。また、これがアタックしなかったとき、このユニットの次にコンビネーションする
//  SユニットのBPは、このユニットのBPを「＋」した値になる。」（atwiki/page-1084）
// - 無効化は rules/rk/rk9Fields.ts rk9EnemyKeywordsNullified（レジスト・スクラム・チェイスの判定から呼ぶ）。
// - 「値になる」ので、次のユニットの BP は「そのユニットの BP＋このユニットの BP」に固定する（bpSetValue。R-BP-01。atwiki/page-1000 カード評価・コメント欄）。
//   「アタックしなかった」は、次のユニットが出るまでにこのユニットがアタックを宣言していないこと（ストライクはアタックではない）。

function applyRiderKick1(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  return { state: addTurnPayload(state, ctx.playerId, RK9_RIDER_KICK_RULE, "RK-175", { instanceId: id }), detail: "rk175:rider_kick" };
}

/** アタックの宣言（core/applyAction.ts continueAttackAfterDeclaration から）。新1号のアタックを記録する。 */
export function rk9RecordAttack(state: GameState, pending: PendingBattle): GameState {
  if (pending.effectBattle) return state;
  if (!rk9HasInstancePayload(state, pending.attackerPlayerId, RK9_RIDER_KICK_RULE, pending.attackerInstanceId)) return state;
  if (rk9HasInstancePayload(state, pending.attackerPlayerId, RK9_RIDER_KICK_ATTACKED_RULE, pending.attackerInstanceId)) return state;
  return addTurnPayload(state, pending.attackerPlayerId, RK9_RIDER_KICK_ATTACKED_RULE, "RK-175", { instanceId: pending.attackerInstanceId });
}

// ---------------------------------------------------------------------------
// RK-176 仮面ライダー新2号【ライダーキック】（RC）
// 「敵軍バトルエリアから、BP4000以上の敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。（この効果は
//  「仮面ライダー1号」からコンビネーションするときは、ナンバーに関係なく発動する）」（atwiki/page-1085）。強制。BP は今の値。
// 「仮面ライダー1号」は「これは「仮面ライダー1号」としてつかえる」カード（RK-175 新1号）を含む（カード評価）。

export const NEW_NIGO_EFFECT_ID = "rk176_rider_kick";

function applyRiderKick2(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && effectiveBp(state, enemyId, c) >= 4000 && selectableEnemy(state, ctx.playerId, "RK-176", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk176:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: NEW_NIGO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: NEW_NIGO_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[NEW_NIGO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = [...state.players[enemyId].battle, ...state.players[enemyId].rush].find((c) => c.instanceId === instanceId);
  if (!target) return { error: "invalid_target" };
  // 離場の処理を通す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。
  const placed = sendFieldCardsToCommandHeld(close(state, pending), enemyId, [instanceId], pending.phasePlayerId);
  return { state: proceed(placed, pending), log: logFor(state, playerId, "RK-176", `${NEW_NIGO_EFFECT_ID}:${target.cardId}`) };
};

/** ライドせずに出た新2号の直前が「仮面ライダー1号」なら RC の効果を発動する（rules/battleEntry.ts から呼ぶ）。対象外なら null。 */
export function rk9NewNigoOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const battle = state.players[playerId].battle;
  const i = battle.findIndex((c) => c.instanceId === instanceId);
  const unit = battle[i];
  if (!unit || unit.mountedOnInstanceId || !isSameCardIdentity(unit.cardId, "RK-176")) return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  const prev = comboPartner(state, battle.slice(0, i));
  if (!prev || !hasName(state, prev.cardId, "仮面ライダー1号")) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
  const markedUnit = marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!;
  const rc = resolveRidingComboOnRideOff(marked, playerId, markedUnit);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// RK-177 蜂女【催眠音波】
// 「これが自軍エリアにある間、自分も相手も次の制限を受ける⇒自分自身のラッシュフェイズを終えるとき、そのターン中にラッシュした自分自身のSユニットを
//  ホールドするかしないかを選ぶ。ホールドしないことを選んだとき、そのユニットはそのターン中、バトルエリアに出られない。」（atwiki/page-909）
// - ラッシュフェイズを終えるとき、そのターンにラッシュしたリリース状態の自軍 S ユニットから、ホールドするものを1体ずつ選ぶ（見送ったら残りはホールドしない）。
// - ホールドしなかったユニットは、蜂女が場にある間そのターン中バトルエリアに出られない（rk9Fields.rk9BlocksBattleEntry。コメント欄「蜂女除去できれば出せる」）。
// - 蜂女が何体いても選ぶのは1回（2体目の扱いはコメント欄で確かな回答がないため）。選び終えたらラッシュフェイズを終える（core/applyAction.ts）。

export const HACHI_EFFECT_ID = "rk177_hypnotic_wave";

function hachiCandidates(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return fieldUnits(state, playerId)
    .filter((c) => !c.commandHeld && rk1IsSmallNow(state, c) && wasRushedThisTurn(p, c.instanceId))
    .map((c) => c.instanceId);
}

/** ラッシュフェイズを終えるとき（core/applyAction.ts の end_phase から）。選択を開いたら state、対象がなければ null。 */
export function openRk9HachiAtRushEnd(state: GameState, playerId: PlayerId): GameState | null {
  if (state.phase !== "rush" || state.pendingEffectChoice) return null;
  if (!rk9HachiOnField(state)) return null;
  if (rk9HasInstancePayload(state, playerId, RK9_HACHI_DONE_RULE, playerId)) return null;
  const ids = hachiCandidates(state, playerId);
  if (ids.length === 0) return null;
  const marked = addTurnPayload(state, playerId, RK9_HACHI_DONE_RULE, "RK-177", { instanceId: playerId });
  const source = [...fieldCards(state, "player1"), ...fieldCards(state, "player2")].find((c) => isSameCardIdentity(c.cardId, "RK-177"));
  return {
    ...openEffectChoice(marked, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: source?.instanceId }, "RK-177"),
      effectId: HACHI_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      rk9Meta: { pendingIds: ids },
    }),
    rk9RushEndAdvance: playerId,
  };
}

CHOICE_RESOLVERS[HACHI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const hold = (c: CardInstance): CardInstance => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, rush: p.rush.map(hold), battle: p.battle.map(hold) }));
  const remaining = (pending.rk9Meta?.pendingIds ?? []).filter((id) => id !== instanceId && fieldCards(next, playerId).some((c) => c.instanceId === id));
  const log = logFor(state, playerId, "RK-177", `${HACHI_EFFECT_ID}:hold:${instanceId}`);
  if (remaining.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, validInstanceIds: remaining, selectedInstanceIds: [], rk9Meta: { pendingIds: remaining } }), log };
};
CHOICE_SKIPPERS[HACHI_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  for (const id of pending.rk9Meta?.pendingIds ?? []) next = addTurnPayload(next, playerId, RK9_HACHI_NOT_HELD_RULE, "RK-177", { instanceId: id });
  return { state: proceed(next, pending), log: skipLog(state, playerId, "RK-177", HACHI_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-178 仮面ライダーアマゾン【大切断】（RC）
// 「敵軍バトルエリアから、このユニットのBP以下のBPを持つユニットを1体選び撃破してもよい。」（atwiki/page-952）。サイズを問わない（コメント欄）。BP は今の値。

function applyDaisetsudan(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = fieldCards(state, ctx.playerId).find((c) => c.instanceId === ctx.triggerSourceInstanceId);
  if (!self) return { state, detail: "rk178:no_unit" };
  const bp = effectiveBp(state, ctx.playerId, self);
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && effectiveBp(state, enemyId, c) <= bp && selectableEnemy(state, ctx.playerId, "RK-178", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk178:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: "rk178_daisetsudan", kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "discard" }),
    detail: "rk178_daisetsudan",
  };
}

// ---------------------------------------------------------------------------
// RK-179 ジャングラー【体当たり攻撃】・RK-189 ジェイクロッサー【地空人の精霊パワー】（ライドしたユニットと一緒にバトルエリアに出たとき）
// RK-179「自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍Sユニットを1体選んでもよい。そうしたとき、選んだユニットの持つカテゴリと、選んだ
//  ユニットがライドしているビークルの持つカテゴリが違うなら、そのビークルを捨札にした後で、選んだユニットを撃破する。」（atwiki/page-912）
//  カテゴリが1つでも合っていれば何もしない（カード評価）。ライド中のユニットはエリアを問わない。
// RK-189「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを2つまで選び、リリースしてもよい。」（atwiki/page-914）。1つずつ選ぶ。

export const JUNGLER_EFFECT_ID = "rk179_body_blow";
export const J_CROSSER_EFFECT_ID = "rk189_spirit_power";

function openJungler(state: GameState, playerId: PlayerId, vehicleId: string): GameState {
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !!c.mountedOnInstanceId && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "RK-179", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicleId }, "RK-179"),
    effectId: JUNGLER_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[JUNGLER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const rider = fieldCards(state, enemyId).find((c) => c.instanceId === instanceId);
  if (!rider) return { error: "invalid_target" };
  const vehicle = fieldCards(state, enemyId).find((c) => c.instanceId === rider.mountedOnInstanceId);
  const log = logFor(state, playerId, "RK-179", `${JUNGLER_EFFECT_ID}:${cardName(state.definitions, rider.cardId)}`);
  let next = close(state, pending);
  if (!vehicle) return { state: proceed(next, pending), log };
  const zone = state.players[enemyId].battle.some((c) => c.instanceId === rider.instanceId) ? "battle" : "rush";
  const unitCats = unitEffectiveCategories(state, enemyId, rider, zone);
  const vehicleCats = categoriesOfCard(state, vehicle.cardId);
  if (unitCats.some((c) => vehicleCats.includes(c))) return { state: proceed(next, pending), log };
  // ビークルを捨札にした後で、選んだユニットを撃破する。
  next = patchPlayer(next, enemyId, (p) => {
    const unmount = (c: CardInstance): CardInstance => {
      if (c.mountedOnInstanceId !== vehicle.instanceId) return c;
      const { mountedOnInstanceId: _m, ...rest } = c;
      return rest;
    };
    return {
      ...p,
      battle: p.battle.filter((c) => c.instanceId !== vehicle.instanceId).map(unmount),
      rush: p.rush.filter((c) => c.instanceId !== vehicle.instanceId).map(unmount),
      discard: [...p.discard, stripForZone(vehicle)],
    };
  });
  const destroyed = applyUnitLeave(next, instanceId, "discard", pending.phasePlayerId);
  if (!("error" in destroyed)) next = destroyed.state;
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[JUNGLER_EFFECT_ID] = simpleSkip();

function openJCrosser(state: GameState, playerId: PlayerId, vehicleId: string, remaining = 2, resume?: PendingEffectChoice): GameState {
  const ids = state.players[playerId].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0 || remaining <= 0) return state;
  return openOrQueue(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicleId }, "RK-189"),
    effectId: J_CROSSER_EFFECT_ID,
    kind: "select_command",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    rk9Meta: { remaining },
    resumeChoice: resume,
  });
}

CHOICE_RESOLVERS[J_CROSSER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const released = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)),
  }));
  const log = logFor(state, playerId, "RK-189", `${J_CROSSER_EFFECT_ID}:${instanceId}`);
  const remaining = (pending.rk9Meta?.remaining ?? 1) - 1;
  const ids = released.players[playerId].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (remaining <= 0 || ids.length === 0) return { state: proceed(released, pending), log };
  return { state: openNext(released, pending, { ...pending, validInstanceIds: ids, selectedInstanceIds: [], rk9Meta: { remaining } }), log };
};
CHOICE_SKIPPERS[J_CROSSER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-180 モグラ獣人【神出鬼没】（NC）
// 「敵軍ラッシュエリアからライドされていないSビークルを1体選んでもよい。そうしたとき、ライドしていない敵軍Sユニットを1体選び、選んだビークルにライドさせる。」
// （atwiki/page-910）。ライドさせられるのはそのビークルにライドできるユニットだけ（RC を持つもの等。カード評価「公式の回答で出来ないと判明」）。
// 選んだユニットはラッシュエリアに戻ってビークルにライドする（カード評価）。

export const MOLE_VEHICLE_EFFECT_ID = "rk180_mole_vehicle";
export const MOLE_RIDER_EFFECT_ID = "rk180_mole_rider";

function ridden(state: GameState, ownerId: PlayerId, vehicleId: string): boolean {
  return fieldCards(state, ownerId).some((c) => c.mountedOnInstanceId === vehicleId);
}

function moleRiders(state: GameState, enemyId: PlayerId, vehicleId: string): string[] {
  return fieldUnits(state, enemyId)
    .filter((c) => !c.mountedOnInstanceId && rk1IsSmallNow(state, c) && canRiderMountVehicle(state, enemyId, c, vehicleId))
    .map((c) => c.instanceId);
}

function applyMole(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => isVehicleCard(state, c.cardId) && getDefinition(state.definitions, c.cardId)?.size === "S" && !ridden(state, enemyId, c.instanceId) && selectableEnemy(state, ctx.playerId, "RK-180", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk180:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-180"), effectId: MOLE_VEHICLE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: MOLE_VEHICLE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[MOLE_VEHICLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cleared = close(state, pending);
  const ids = moleRiders(cleared, enemyId, instanceId).filter((id) => {
    const c = fieldCards(cleared, enemyId).find((x) => x.instanceId === id)!;
    return selectableEnemy(cleared, playerId, "RK-180", c);
  });
  const log = logFor(state, playerId, "RK-180", `${MOLE_VEHICLE_EFFECT_ID}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...base(pending, "RK-180"), effectId: MOLE_RIDER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, rk9Meta: { picked: instanceId } }),
    log,
  };
};
CHOICE_SKIPPERS[MOLE_VEHICLE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[MOLE_RIDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const vehicleId = pending.rk9Meta?.picked;
  const unit = fieldCards(state, enemyId).find((c) => c.instanceId === instanceId);
  if (!unit || !vehicleId) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const rush = p.rush.filter((c) => c.instanceId !== instanceId);
    const at = rush.findIndex((c) => c.instanceId === vehicleId);
    const { battleActed: _b, ...rest } = unit;
    const moved: CardInstance = { ...rest, mountedOnInstanceId: vehicleId };
    return {
      ...p,
      battle: p.battle.filter((c) => c.instanceId !== instanceId),
      rush: at >= 0 ? [...rush.slice(0, at + 1), moved, ...rush.slice(at + 1)] : [...rush, moved],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-180", `${MOLE_RIDER_EFFECT_ID}:${cardName(state.definitions, unit.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-181 仮面ライダーシン【ハイバイブネイル】
// 「自軍ターン中、これがバトルエリアに出たとき、WBを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これは次の能力を得る⇒
//  SP1/5になり、これとバトルしたSユニットは、バトルに勝っても撃破される。」（atwiki/page-761）。SP1/5 はクロスの影響を受ける（コメント欄）。

export const HIGH_VIBE_EFFECT_ID = "rk181_high_vibe_nail";

function applyHighVibe(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk181:enemy_turn" };
  const player = state.players[ctx.playerId];
  const ids = player.command
    .filter((c) => !c.commandHeld && effectiveCommandCategories(player, state.definitions, c.cardId).includes("WB"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk181:no_wb" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-181"), effectId: HIGH_VIBE_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: HIGH_VIBE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[HIGH_VIBE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  next = addTurnPayload(next, playerId, RK9_HIGH_VIBE_RULE, "RK-181", { instanceId: pending.sourceInstanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-181", `${HIGH_VIBE_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[HIGH_VIBE_EFFECT_ID] = simpleSkip();

/** RK-181 の「SP1/5」（rules/legend3/fieldEffects.ts から呼ぶ）。 */
export function rk9EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (!isSameCardIdentity(instance.cardId, "RK-181")) return sp;
  if (!rk9HasInstancePayload(state, playerId, RK9_HIGH_VIBE_RULE, instance.instanceId)) return sp;
  const battle = state.players[playerId].battle;
  return Math.max(sp, printedSpBase("1/5", battlePositionOneBased(battle, instance.instanceId), crossReductionFor(battle, instance.instanceId)));
}

/** unit（unitOwner のユニット）が、相手の RK-181【ハイバイブネイル】とバトルして勝っても撃破されるか。 */
export function rk9WinButDestroyed(state: GameState, unitOwner: PlayerId, unit: CardInstance, opponentCard: CardInstance): boolean {
  if (!isSameCardIdentity(opponentCard.cardId, "RK-181")) return false;
  if (!rk9HasInstancePayload(state, opponent(unitOwner), RK9_HIGH_VIBE_RULE, opponentCard.instanceId)) return false;
  return isUnitCard(state, unit.cardId) && rk1IsSmallNow(state, unit);
}

// ---------------------------------------------------------------------------
// RK-183 仮面ライダーZO【ZOキック】（RC）
// 「これは、アタックしてバトルに勝つたび、追加でアタックできる。ただし、これはバトルを終えるたび、このターン、BP-1000される。（BP0以下になった
//  ユニットは撃破される）」（atwiki/page-1000）。RC を発動したターンだけ。BP が「…になる」ときは下がらない（R-BP-01。新1号との組み合わせ）。

function applyZoKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state };
  return { state: addTurnPayload(state, ctx.playerId, RK9_ZO_KICK_RULE, "RK-183", { instanceId: id }), detail: "rk183:zo_kick" };
}

/** アタックしてバトルに勝ったとき（rules/operationCounters.ts から）。 */
export function rk9OnAttackWin(state: GameState, attackerId: PlayerId, attackerInstanceId: string): GameState {
  if (!rk9HasInstancePayload(state, attackerId, RK9_ZO_KICK_RULE, attackerInstanceId)) return state;
  if (!fieldCards(state, attackerId).some((c) => c.instanceId === attackerInstanceId)) return state;
  return patchPlayer(state, attackerId, (p) => addBakiBakiExtraAttack(p, attackerInstanceId));
}

/** バトルを終えたとき（rules/operationCounters.ts のバトルの解決の最後）。【ZOキック】の BP-1000。 */
export function rk9AfterBattle(state: GameState, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId" | "defenderInstanceId">): GameState {
  let next = state;
  for (const [ownerId, id] of [
    [pending.attackerPlayerId, pending.attackerInstanceId],
    [pending.defenderPlayerId, pending.defenderInstanceId],
  ] as const) {
    if (!rk9HasInstancePayload(next, ownerId, RK9_ZO_KICK_RULE, id)) continue;
    next = patchPlayer(next, ownerId, (p) => {
      const minus = (c: CardInstance): CardInstance => (c.instanceId === id ? { ...c, bpModifier: (c.bpModifier ?? 0) - 1000 } : c);
      return { ...p, battle: p.battle.map(minus), rush: p.rush.map(minus) };
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-185 レッドドラス
// ※「これをラッシュしたとき、特徴「仮面ライダー」を持つ敵軍Sユニットを1体選び、持ち主の山札の下に戻す。」（atwiki/page-1048）。強制・エリアを問わない。
// 【合体吸収】「自軍ターン中、これがバトルエリアに出たとき、敵軍山札の下から1枚ひいてオモテにしてもよい。オモテにしたカードがＲＣを持つユニットカード
//  なら、このターン、これはSP1になり、オモテにしたカードのRCの効果をこのユニットの効果として発動する。その後、オモテにしたカードは持ち主の山札の下に
//  戻す。」— オモテにしたカードは山札の下のまま扱う（戻す位置は同じ）。RC の効果はこのユニットを発生源として発動する（RK-097 と同じ処理）。

export const RED_DORAS_RUSH_EFFECT_ID = "rk185_deck_bottom";
export const RED_DORAS_ABSORB_EFFECT_ID = "rk185_absorb";

function applyRedDorasRush(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && unitFeatures(state, enemyId, c).includes("仮面ライダー") && selectableEnemy(state, ctx.playerId, "RK-185", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk185:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-185"), effectId: RED_DORAS_RUSH_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: RED_DORAS_RUSH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[RED_DORAS_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const taken = takeUnitOff(close(state, pending), enemyId, instanceId);
  if (!taken) return { error: "invalid_target" };
  const next = patchPlayer(taken.state, enemyId, (p) => ({ ...p, deck: [...p.deck, taken.card] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-185", `${RED_DORAS_RUSH_EFFECT_ID}:${taken.card.cardId}`) };
};

function applyRedDorasAbsorb(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk185:enemy_turn" };
  if (state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: "rk185:no_deck" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-185", RED_DORAS_ABSORB_EFFECT_ID)), detail: RED_DORAS_ABSORB_EFFECT_ID };
}

CHOICE_RESOLVERS[RED_DORAS_ABSORB_EFFECT_ID] = (state) => ({ state });
CHOICE_SKIPPERS[RED_DORAS_ABSORB_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[RED_DORAS_ABSORB_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const bottom = state.players[enemyId].deck.at(-1);
  let next = close(state, pending);
  if (!bottom) return { state: proceed(next, pending) };
  const log = logFor(state, playerId, "RK-185", `${RED_DORAS_ABSORB_EFFECT_ID}:${cardName(state.definitions, bottom.cardId)}`);
  const def = getDefinition(state.definitions, bottom.cardId);
  const selfId = pending.sourceInstanceId;
  const self = selfId ? next.players[playerId].battle.find((c) => c.instanceId === selfId) : undefined;
  if (def?.type !== "unit" || def.comboNumber !== "RC" || !self) return { state: proceed(next, pending), log };
  next = grantSp1ToBattleUnit(next, playerId, self.instanceId);
  const withSp = next.players[playerId].battle.find((c) => c.instanceId === self.instanceId) ?? self;
  const outcome = resolveRidingComboOnRideOff(next, playerId, { ...withSp, cardId: bottom.cardId });
  next = { ...outcome.state, log: [...outcome.state.log, ...outcome.logs] };
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// RK-187 仮面ライダーJ ジャンボフォーメーション【ジャンボライダーキック】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから、追加条件に「自軍合体ユニットを捨札にする」と表記されていないDAを持つ敵軍Lユニットを
//  1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1086）

function applyJumboKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk187:enemy_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || rk1IsSmallNow(state, c)) return false;
      if (def.size !== "L" && !(c.stackedCards ?? []).some((s) => s.cardId === "RK-013")) return false;
      if (!unitEffectiveCategories(state, enemyId, c, "battle").includes("DA")) return false;
      const cond = def.rushAdditionalCondition as { text?: string } | undefined;
      if ((cond?.text ?? "").includes("自軍合体ユニットを捨札にする")) return false;
      return selectableEnemy(state, ctx.playerId, "RK-187", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk187:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-187"), effectId: "rk187_jumbo_rider_kick", kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "power", placeAsDamage: true }),
    detail: "rk187_jumbo_rider_kick",
  };
}

// ---------------------------------------------------------------------------
// RK-188 ベリー【地空人のエージェント】
// 「これが自軍エリアにある間、敵軍ターン中、自軍Sユニットがアタックされたとき、次の効果を発動できる⇒自分の手札の必要パワーに「－」を持つユニットカード
//  から、アタックされたSユニットが追加条件で指定されているカードを1枚選び、自軍バトルエリアに出してもよい（このとき出したユニットの効果は発動しない）。
//  そうしたとき、アタックされたユニットを捨札にして、かわりにバトルエリアに出したユニットでバトルする。」（atwiki/page-916）
// - 「指定されている」: 追加条件のカード名（「として使える」を含む）・特徴（Q1）・合体のユニットのどれか1体（Q2）。捨札にするのはアタックされたユニットだけ（Q2）。
// - 出したユニットは効果を発動しない（ラッシュの誘発も扱わない）。アタックの「アタックされたとき」（カウンター窓の前）に開く。

export const BERRY_EFFECT_ID = "rk188_agent";

const FUSION_RE = /合体―([^ 　※【]+)/;

function designates(state: GameState, ownerId: PlayerId, cardId: string, attacked: CardInstance): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.type !== "unit" || !/[-－]$/.test(String(def.powerCost ?? ""))) return false;
  const cond = def.rushAdditionalCondition as { conditionId?: string; partnerName?: string; requiredFeature?: string } | undefined;
  if (!cond) return false;
  if (cond.partnerName && hasName(state, attacked.cardId, cond.partnerName)) return true;
  if (cond.requiredFeature && unitFeatures(state, ownerId, attacked).includes(cond.requiredFeature)) return true;
  if (cond.conditionId === "zord_down_discard_fusion" || cond.conditionId === "discard_fusion_unit") {
    const materials = ((def.text ?? "").match(FUSION_RE)?.[1] ?? "").split("＋").filter(Boolean);
    return materials.some((m) => hasName(state, attacked.cardId, m));
  }
  return false;
}

/** アタックされたとき（core/applyAction.ts continueAttackAfterDeclaration から）。開けなければ null。 */
export function openRk9Berry(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.rk9BerryOffered || battle.battleCancelled || battle.effectBattle) return null;
  const defenderId = battle.defenderPlayerId;
  if (battle.phasePlayerId === defenderId) return null;
  const berry = fieldCards(state, defenderId).find((c) => isSameCardIdentity(c.cardId, "RK-188"));
  if (!berry) return null;
  const attacked = fieldUnits(state, defenderId).find((c) => c.instanceId === battle.defenderInstanceId);
  if (!attacked || !rk1IsSmallNow(state, attacked)) return null;
  const ids = state.players[defenderId].hand.filter((c) => designates(state, defenderId, c.cardId, attacked)).map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return {
    ...openEffectChoice(state, {
      ...base({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: berry.instanceId }, "RK-188"),
      effectId: BERRY_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      rk9Meta: { battle: { ...battle, rk9BerryOffered: true }, wingAttackFromRush },
    }),
    activePlayer: defenderId,
  };
}

/** ベリーで出すカードを選んだ。続けるアタック（防御側を出したユニットにかえる）を返す。 */
export function resolveRk9BerryPick(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | { error: string } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.rk9Meta;
  if (!pending || pending.effectId !== BERRY_EFFECT_ID || !meta?.battle || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next: GameState = { ...state, pendingEffectChoice: undefined };
  next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), battle: [...p.battle, stripForZone(card)] }));
  next = markFieldEntryHandled(next, [instanceId]);
  const taken = takeUnitOff(next, playerId, meta.battle.defenderInstanceId);
  if (taken) next = patchPlayer(taken.state, playerId, (p) => ({ ...p, discard: [...p.discard, taken.card] }));
  next = { ...next, log: [...next.log, logFor(state, playerId, "RK-188", `${BERRY_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`)] };
  return { state: next, battle: { ...meta.battle, defenderInstanceId: instanceId }, wingAttackFromRush: !!meta.wingAttackFromRush };
}

/** ベリーを使わなかった。そのまま続けるアタックを返す。 */
export function skipRk9Berry(state: GameState, playerId: PlayerId): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | null {
  const pending = state.pendingEffectChoice;
  const meta = pending?.rk9Meta;
  if (!pending || pending.effectId !== BERRY_EFFECT_ID || !meta?.battle || pending.playerId !== playerId) return null;
  return { state: { ...state, pendingEffectChoice: undefined, log: [...state.log, skipLog(state, playerId, "RK-188", BERRY_EFFECT_ID)] }, battle: meta.battle, wingAttackFromRush: !!meta.wingAttackFromRush };
}

// legalActions に候補を出すために登録する（解決は core/applyAction.ts の resolveRk9BerryPick・skipRk9Berry）。
CHOICE_RESOLVERS[BERRY_EFFECT_ID] = () => ({ error: "rk188_handled_by_attack" });
CHOICE_SKIPPERS[BERRY_EFFECT_ID] = () => ({ error: "rk188_handled_by_attack" });

export function isRk9BerryChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === BERRY_EFFECT_ID && !!pending.rk9Meta?.battle;
}

// ---------------------------------------------------------------------------
// ユニットがバトルエリアに出たとき（rules/combo.ts の進入効果から呼ぶ）
// - RK-175【ライダーキック】の「このユニットの次にコンビネーションするSユニットのBP」（自軍バトルフェイズのコンビネーションだけ。R-CN-04）。
// - ライドしたユニットと一緒に出た RK-179 ジャングラー・RK-189 ジェイクロッサー（自軍ターン中だけ）。

export function tryRk9OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  let next = state;
  const ownTurn = next.activePlayer === playerId;
  const vehicleId = card.mountedOnInstanceId;
  if (vehicleId && ownTurn) {
    const vehicle = next.players[playerId].battle.find((c) => c.instanceId === vehicleId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-179")) next = openJungler(next, playerId, vehicle.instanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-189")) next = openJCrosser(next, playerId, vehicle.instanceId);
  }
  if (next.phase === "battle" && ownTurn && isUnitCard(next, card.cardId) && rk1IsSmallNow(next, card)) {
    const partner = comboPartner(next, battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId));
    if (
      partner &&
      rk9HasInstancePayload(next, playerId, RK9_RIDER_KICK_RULE, partner.instanceId) &&
      !rk9HasInstancePayload(next, playerId, RK9_RIDER_KICK_ATTACKED_RULE, partner.instanceId)
    ) {
      const self = next.players[playerId].battle.find((c) => c.instanceId === card.instanceId);
      const partnerNow = fieldCards(next, playerId).find((c) => c.instanceId === partner.instanceId);
      if (self && partnerNow) {
        const total = effectiveBp(next, playerId, self) + effectiveBp(next, playerId, partnerNow);
        next = patchPlayer(next, playerId, (p) => ({
          ...p,
          battle: p.battle.map((c) => (c.instanceId === card.instanceId ? { ...c, bpSetValue: total } : c)),
        }));
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK9_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-171::contract": applyContract,
  "RK-173::oni_armor": applyOniArmor,
  "RK-174::put_on": applyPutOn,
  "RK-175::rider_kick": applyRiderKick1,
  "RK-176::rider_kick": applyRiderKick2,
  "RK-178::daisetsudan": applyDaisetsudan,
  "RK-180::shinshutsu_kibotsu": applyMole,
  "RK-181::high_vibe_nail": applyHighVibe,
  "RK-183::zo_kick": applyZoKick,
  "RK-185::deck_bottom": applyRedDorasRush,
  "RK-185::absorb": applyRedDorasAbsorb,
  "RK-187::jumbo_rider_kick": applyJumboKick,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-169::grand_strike": noop("rk169:after_action"),
  "RK-172::ruri_ookami": noop("rk172:battle_counter"),
  "RK-177::hypnotic_wave": noop("rk177:rush_end"),
  "RK-179::body_blow": noop("rk179:rider_entry"),
  "RK-182::z_bringer_attack": noop("rk182:defender_bp"),
  "RK-184::life_pool": noop("rk184:after_action"),
  "RK-188::agent": noop("rk188:attacked"),
  "RK-189::spirit_power": noop("rk189:rider_entry"),
};

export function tryRk9CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK9_KEYWORD_PREFIX)) return null;
  const handler = RK9_KEYWORDS[keyword.slice(RK9_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
