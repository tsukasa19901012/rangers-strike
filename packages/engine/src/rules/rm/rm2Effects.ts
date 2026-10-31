/**
 * スペシャルメタルエディション RM-022〜RM-042（サイバリアン〜蝶忍 紅牙）のカード固有の効果（cardSpec RM2-022-042 の監査）。
 *
 * - `tryRm2CardEffect`: DSL の grant_keyword から呼ばれる起点（`rm2::cardId::name`。ラッシュしたとき・バトルエリアに出たとき・RC・NC）。
 * - `tryResolveRm2Choice` / `trySkipRm2Choice` / `tryConfirmRm2Choice`: このモジュールが開いた選択の解決。
 * - `tryCompleteRm2HoldChoice`: コマンドの支払い（effect_hold）でホールドを選び終えたときの続き（rules/pendingChoices.ts completeEffectHoldChoice）。
 * - `tryRm2OnEnterBattle`: RM-022 サイバリアン（ライドされてバトルエリアに出たとき。rules/combo.ts）。
 * - `rm2CyberianOnEntry`: RM-022 でライドしたまま進んだときの RC（core/applyAction.ts resolve_ride_off_choice）。
 * - `openRm2MotoSharian`: RM-028 モトシャリアン（「宇宙刑事」のユニットをラッシュしたとき。rules/onRushUnitEffects.ts）。
 * - `rm2AttackerBattleBonus` / `rm2DefenderBattleBonus`: RM-030・RM-033 のバトルの BP（rules/namedUnitEffects.ts）。
 * - `rm2RequiredDefenderIds`: RM-035 凱聖クールギン（core/legalActions.ts のバトル進入後の行動）。
 * - `rm2AfterBattle`: RM-036 暴魂チューボ（rules/operationCounters.ts resolveBattlePendingCore）。
 * - `isRm2FieldAbilityCard` / `canActivateRm2FieldAbility` / `activateRm2FieldAbility`: RM-038 凱聖バルスキー（rules/fieldActivatedAbilities.ts）。
 * - `applyRm2AfterAction`: RM-026 の「その後、選んだビークルをパワーゾーンに送る」の続き（チェイスの選択の後。core/applyAction.ts）。
 * 継続効果の判定（RM-023・RM-029 の※）は rules/rm/rm2Fields.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import { lookCtx, openDeckLook } from "../deckLook";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, cardName, effectiveBp, effectiveCommandCategories, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { cardNotSelectableByOpponent } from "../../keywords/effectTargetability";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { buildEffectHoldPayment } from "../commandPayment";
import { patchPlayer, grantBpBoostOnPlayer, grantSp1OnPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { applyDamageToPlayer } from "../damagePayment";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  type BaseCtx,
  type ChoiceOutcome,
  base,
  close,
  confirmChoice,
  ctxBase,
  effectRushPicked,
  fieldUnits,
  findField,
  genericPick,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  printedBp,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "./rm1Effects";
import { rm2ActsAsVehicle, rm2CostNumber } from "./rm2Fields";
import { recordReveal, revealedCards } from "../revealNotice";

// ---------------------------------------------------------------------------
// 共通

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
/** コマンドの支払い（effect_hold）で選ぶ選択の続き（resolve_effect_choice では答えない）。 */
const HOLD_COMPLETERS: Record<string, (state: GameState, pending: PendingEffectChoice, holdIds: string[]) => GameState> = {};

export const RM2_KEYWORD_PREFIX = "rm2::";
export const RM2_DECK_TOP = "deck_top";
export const RM2_TO_POWER = "to_power";
export const RM2_TO_COMMAND = "to_command";

export function isRm2ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

export function tryResolveRm2Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipRm2Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function canConfirmRm2Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

export function tryConfirmRm2Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRm2Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** コマンドの支払いでホールドするコマンドを選び終えた（rules/pendingChoices.ts completeEffectHoldChoice）。対象外なら null。 */
export function tryCompleteRm2HoldChoice(state: GameState, playerId: PlayerId, commandInstanceIds: string[]): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const completer = HOLD_COMPLETERS[pending.effectId];
  if (!completer) return null;
  const held = holdCommands(close(state, pending), playerId, commandInstanceIds);
  return { state: completer(held, pending, commandInstanceIds), log: logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:hold`) };
}

function holdCommands(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (ids.includes(c.instanceId) && !c.commandHeld ? { ...c, commandHeld: true } : c)) }));
}

/** カテゴリ cat を持つリリース状態の自軍コマンド。 */
function releasedCommandsOf(state: GameState, playerId: PlayerId, cat: string): string[] {
  const p = state.players[playerId];
  return p.command.filter((c) => !c.commandHeld && (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes(cat)).map((c) => c.instanceId);
}

/** ホールドするコマンドを選ぶ選択とコマンドの支払いを開く（候補がちょうど n なら選ばずにホールドして続ける）。 */
function holdThen(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], n: number, extra: Partial<PendingEffectChoice> = {}): GameState {
  const choice: PendingEffectChoice = {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "select_commands",
    validInstanceIds: ids,
    selectCount: n,
    selectedInstanceIds: [],
    optional: false,
    commandAction: "hold",
    commandFilter: "released",
    ...extra,
  };
  if (ids.length <= n) return HOLD_COMPLETERS[effectId]!(holdCommands(state, ctx.playerId, ids), choice, ids);
  const opened = openEffectChoice(state, choice);
  const payment = buildEffectHoldPayment(opened);
  return payment ? { ...opened, pendingCommandPayment: payment } : opened;
}

function isUnitCardId(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function isVehicleNow(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return getDefinition(state.definitions, card.cardId)?.type === "vehicle" || rm2ActsAsVehicle(state, playerId, card, (id) => cardHasKeyword(state.definitions, id, "chase"));
}

function turnPayloads<T>(state: GameState, playerId: PlayerId, ruleId: string): T[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => !!p);
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", payload, sourceCardId }] }));
}

function ownTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** 敵軍のゾーンのカードを選べるか（オモテ向きの「相手に選ばれない」カードは選べない。ユーザー決定 2026-10-19。docs/rules/README.md §5.7 j）。 */
function selectableEnemyZoneCard(cardId: string): boolean {
  return !cardNotSelectableByOpponent(cardId);
}

// ---------------------------------------------------------------------------
// RM-022 サイバリアン【サイバリアンレーザースピード】
// 「自軍ターン中、これがバトルエリアに出たとき、OTを持つ自軍コマンドを2つホールドしてもよい。そうしたとき、これにライドしているユニットは、このターン、
//  ライドオフしなくてもＲＣの効果を発動できる。」（atwiki/page-837）
// ビークルはライドされてバトルエリアに出る（rules/combo.ts で、ライドして出たユニットの進入の処理から呼ぶ）。ホールドしたら、このターン、
// これにライドしているユニットがライドしたまま進んでも RC の効果を発動する（RK-120 サイドバッシャーと同じ。2重には発動しない）。

const CYBERIAN_CARD_ID = "RM-022";
const CYBERIAN_EFFECT_ID = "rm022_cyberian";
const CYBERIAN_HOLD_EFFECT_ID = "rm022_cyberian_hold";
const CYBERIAN_RULE = "rm022_cyberian_rc";

/** ライドしたユニットと一緒にバトルエリアに出たビークルの効果（rules/combo.ts）。 */
export function tryRm2OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const vehicleId = card.mountedOnInstanceId;
  if (!vehicleId || !ownTurn(state, playerId)) return state;
  const vehicle = state.players[playerId].battle.find((c) => c.instanceId === vehicleId);
  if (!vehicle || !isSameCardIdentity(vehicle.cardId, CYBERIAN_CARD_ID)) return state;
  if (releasedCommandsOf(state, playerId, "OT").length < 2) return state;
  return openAfter(state, confirmChoice({ playerId, phasePlayerId: playerId, sourceInstanceId: vehicle.instanceId }, CYBERIAN_CARD_ID, CYBERIAN_EFFECT_ID));
}

CHOICE_RESOLVERS[CYBERIAN_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[CYBERIAN_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[CYBERIAN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdThen(close(state, pending), pendingBase(pending), CYBERIAN_CARD_ID, CYBERIAN_HOLD_EFFECT_ID, releasedCommandsOf(state, playerId, "OT"), 2, { resumeChoice: pending.resumeChoice });
  return { state: next, log: logFor(state, playerId, CYBERIAN_CARD_ID, `${CYBERIAN_EFFECT_ID}:confirm`) };
};
HOLD_COMPLETERS[CYBERIAN_HOLD_EFFECT_ID] = (state, pending) => {
  const next = addTurnPayload(state, pending.playerId, CYBERIAN_RULE, CYBERIAN_CARD_ID, { vehicleInstanceId: pending.sourceInstanceId });
  return proceed(next, pending);
};

/** ライドしたまま進んだユニットが、このターンの【サイバリアンレーザースピード】のビークルにライドしていれば RC の効果を発動する。対象外なら null。 */
export function rm2CyberianOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const unit = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit?.mountedOnInstanceId || getDefinition(state.definitions, unit.cardId)?.comboNumber !== "RC") return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  if (!turnPayloads<{ vehicleInstanceId?: string }>(state, playerId, CYBERIAN_RULE).some((p) => p.vehicleInstanceId === unit.mountedOnInstanceId)) return null;
  const marked = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
  const rc = resolveRidingComboOnRideOff(marked, playerId, marked.players[playerId].battle.find((c) => c.instanceId === instanceId)!);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

// ---------------------------------------------------------------------------
// RM-023 スクーパー【地中潜行】（ラッシュしたとき）
// 「敵軍パワーゾーンのオモテ向きのカードから1枚選び、捨札にしてもよい。そうしたとき、敵軍捨札からカードを1枚選び敵軍パワーゾーンにオモテ向きで置く。」
// （atwiki/page-838）。敵軍捨札から選ぶカードは、いま捨札にしたカードを含めてどれでもよい（種類を問わない）。※の S ビークルの扱いは rules/rm/rm2Fields.ts。

const SCOOPER_POWER_EFFECT_ID = "rm023_chichu_senko_power";
const SCOOPER_DISCARD_EFFECT_ID = "rm023_chichu_senko_discard";

function applyScooper(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].power.filter((c) => !c.faceDown && selectableEnemyZoneCard(c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm023:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-023"), effectId: SCOOPER_POWER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SCOOPER_POWER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SCOOPER_POWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  const ids = next.players[enemyId].discard.filter((c) => selectableEnemyZoneCard(c.cardId)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "RM-023", `${SCOOPER_POWER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  return { state: openNext(next, pending, { ...pending, effectId: SCOOPER_DISCARD_EFFECT_ID, validInstanceIds: ids, selectedInstanceIds: [], optional: false }), log };
};
CHOICE_SKIPPERS[SCOOPER_POWER_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[SCOOPER_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), power: [...p.power, { ...stripForZone(card), faceDown: false }] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-023", `${SCOOPER_DISCARD_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RM-024 高次元戦闘車ギャビオン【搭載】（ラッシュしたとき）
// 「次の効果を発動できる⇒自軍山札を見て、特徴「車両」を持つSユニットのカードを1枚選び、相手に見せる。その後、山札をシャッフルし、選んだカードを
//  山札の上に戻す。」（atwiki/page-839）。選ぶのはカードの種類がユニットで印刷のサイズが S、印刷の特徴に「車両」を持つカード。選ぶことが発動の宣言
//  （見送れば何もしない）。

const GAVION_EFFECT_ID = "rm024_tousai";

function applyGavion(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].deck
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && unitSizeOf(state.definitions, c) === "S" && (d.features ?? []).includes("車両");
    })
    .map((c) => c.instanceId);
  // 選べるカードがなくても山札を見る窓を開く（rules/deckLook.ts。発動しないこともできるので、シャッフルはしない）。
  if (ids.length === 0) return { state: openDeckLook(state, lookCtx(ctx), "RM-024"), detail: "rm024:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-024"), effectId: GAVION_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: GAVION_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GAVION_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId) }));
  next = shuffleDeck(next, playerId);
  next = patchPlayer(next, playerId, (p) => ({ ...p, deck: [card, ...p.deck] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-024", `${GAVION_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[GAVION_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-025 宇宙刑事シャリバン【シャリバンクラッシュ】（RC）
// 「本来のBPが3000の敵軍ユニットを1体選び、持ち主のパワーゾーンに送ってもよい。」（atwiki/page-894）。エリア・サイズを問わない。

const SHARIVAN_EFFECT_ID = "rm025_sharivan_crash";

function applySharivanCrash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => printedBp(state, c.cardId) === 3000 && selectableEnemy(state, ctx.playerId, "RM-025", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm025:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "RM-025", SHARIVAN_EFFECT_ID, ids, true, "power")), detail: SHARIVAN_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RM-026 超次元戦闘母艦グランドバース【収容】（自軍ターン中、バトルエリアに出たとき）
// 「自軍バトルエリアからビークルを1体選んでもよい。そうしたとき、選んだビークルにライドしているユニットがあれば、そのユニットをパワーゾーンに送る。
//  その後、選んだビークルをパワーゾーンに送る。」（atwiki/page-840）
// パワーゾーンは持ち主（自軍）のもの。ライドしているユニットが送られるときはチェイスで乗り換えられる（カード評価。離場の処理 rules/pendingChoices.ts
// applyUnitLeave）。チェイスでビークルが捨札になれば、ビークルは送らない。チェイスの選択を待つときは、その後で送る（applyRm2AfterAction）。

const GRANDBIRTH_EFFECT_ID = "rm026_shuyou";

function applyGrandbirth(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "rm026:not_own_turn" };
  const p = state.players[ctx.playerId];
  const ids = p.battle.filter((c) => c.instanceId !== ctx.triggerSourceInstanceId && isVehicleNow(state, ctx.playerId, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm026:no_vehicle" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-026"), effectId: GRANDBIRTH_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: GRANDBIRTH_EFFECT_ID,
  };
}

function sendVehicleToPower(state: GameState, playerId: PlayerId, vehicleId: string, phasePlayerId: PlayerId): GameState {
  if (!findField(state, playerId, vehicleId)) return state;
  if (state.players[playerId].battle.some((c) => c.mountedOnInstanceId === vehicleId) || state.players[playerId].rush.some((c) => c.mountedOnInstanceId === vehicleId)) return state;
  return moveFieldUnit(state, playerId, vehicleId, phasePlayerId, "power");
}

CHOICE_RESOLVERS[GRANDBIRTH_EFFECT_ID] = (state, playerId, vehicleId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const rider = [...next.players[playerId].battle, ...next.players[playerId].rush].find((c) => c.mountedOnInstanceId === vehicleId);
  if (rider) {
    const left = applyUnitLeave(next, rider.instanceId, "power", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  if (next.pendingChase || next.pendingLeave || next.pendingRegister) {
    next = { ...next, rm2PendingTriggers: [...(next.rm2PendingTriggers ?? []), { kind: "rm026_vehicle", playerId, instanceId: vehicleId, phasePlayerId: pending.phasePlayerId }] };
    return { state: proceed(next, pending), log: logFor(state, playerId, "RM-026", `${GRANDBIRTH_EFFECT_ID}:${vehicleId}:wait`) };
  }
  next = sendVehicleToPower(next, playerId, vehicleId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-026", `${GRANDBIRTH_EFFECT_ID}:${vehicleId}`) };
};
CHOICE_SKIPPERS[GRANDBIRTH_EFFECT_ID] = simpleSkip();

/** applyAction の後処理（depth 0）: 待っていた RM-026 のビークルをパワーゾーンに送る。 */
export function applyRm2AfterAction(state: GameState): GameState {
  const queue = state.rm2PendingTriggers;
  if (!queue || queue.length === 0) return state;
  if (state.pendingChase || state.pendingLeave || state.pendingRegister || state.pendingEffectChoice || state.pendingDamagePayment) return state;
  let next: GameState = { ...state, rm2PendingTriggers: undefined };
  for (const t of queue) {
    if (t.kind === "rm026_vehicle") next = sendVehicleToPower(next, t.playerId, t.instanceId, t.phasePlayerId);
  }
  return next;
}

// ---------------------------------------------------------------------------
// RM-027 バトルバースフォーメーション【プラズマカノン】（自軍ターン中、バトルエリアに出たとき）
// 「自軍パワーゾーンからオモテ向きのカードから1枚選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」「BP+3000」」（atwiki/page-841）
// ※（グランドバースをラッシュしたとき手札に戻す）は既存の on_ally_rush_named_return_self_to_hand（rules/batch07FieldEffects.ts）。

const PLASMA_EFFECT_ID = "rm027_plasma_cannon";

function applyPlasmaCannon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "rm027:not_own_turn" };
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm027:no_power" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-027"), effectId: PLASMA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: PLASMA_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[PLASMA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const selfId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    let q = { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
    if (selfId) q = grantBpBoostOnPlayer(grantSp1OnPlayer(q, selfId, state.definitions), selfId, 3000);
    return q;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-027", `${PLASMA_EFFECT_ID}:sp1_bp3000`) };
};
CHOICE_SKIPPERS[PLASMA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-028 モトシャリアン ※
// 「※これが自軍パワーゾーンでオモテ向きになっている間、特徴「宇宙刑事」を持つ自軍ユニットをラッシュしたとき、これを自軍ラッシュエリアに出してもよい。」
// （atwiki/page-842）。ラッシュしたユニットのいまの特徴で見る（宇宙警察で追加された「宇宙刑事」を含む。カード評価）。オモテ向きの1枚ごとに確認する。

const MOTO_EFFECT_ID = "rm028_moto_sharian";

/** 自軍ユニットをラッシュしたとき（rules/onRushUnitEffects.ts。旧 noteOtherRushEffects の自動処理のかわり）。 */
export function openRm2MotoSharian(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string): GameState {
  const rushed = findField(state, rusherPlayerId, rushedInstanceId);
  if (!rushed || isSameCardIdentity(rushed.cardId, "RM-028") || !isUnitCardId(state, rushed.cardId)) return state;
  if (!unitFeatures(state, rusherPlayerId, rushed).includes("宇宙刑事")) return state;
  let next = state;
  for (const moto of state.players[rusherPlayerId].power.filter((c) => !c.faceDown && isSameCardIdentity(c.cardId, "RM-028"))) {
    next = openAfter(next, confirmChoice({ playerId: rusherPlayerId, phasePlayerId: state.activePlayer, sourceInstanceId: moto.instanceId }, "RM-028", MOTO_EFFECT_ID));
  }
  return next;
}

CHOICE_RESOLVERS[MOTO_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[MOTO_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[MOTO_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const id = pending.sourceInstanceId;
  const card = state.players[playerId].power.find((c) => c.instanceId === id && !c.faceDown);
  let next = close(state, pending);
  if (card) next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== card.instanceId), rush: [...p.rush, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-028", `${MOTO_EFFECT_ID}:${card ? "rush" : "gone"}`) };
};

// ---------------------------------------------------------------------------
// RM-029 ジャスピオン【コズミックハーレー】（RC）
// 「敵軍山札の上から1枚をオモテにする。オモテにしたカードがWBを持つユニットカードなら、それを持ち主のラッシュエリアに出す。違うなら、そのカードを
//  持ち主のパワーゾーンに送ってから、相手に1点ダメージを与える。」（atwiki/page-896）
// WB のユニットカードは持ち主の効果のラッシュで出す（必要パワー・追加条件は問わない）。パワーゾーンにはオモテ向きで置く。※は rules/rm/rm2Fields.ts。

function applyCosmicHarley(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const top = state.players[enemyId].deck[0];
  if (!top) return { state, detail: "rm029:empty_deck" };
  const d = getDefinition(state.definitions, top.cardId);
  const isWbUnit = d?.type === "unit" && (cardCategories(d) as string[]).includes("WB");
  // オモテにした敵軍山札の上のカードは公開情報。WB のユニットカードは持ち主のラッシュエリア、違えば持ち主のパワーゾーン。
  state = recordReveal(state, {
    playerId: ctx.playerId,
    ownerId: enemyId,
    sourceCardId: ctx.sourceCardId,
    effectLabel: "コズミックハーレー",
    from: "deck_top",
    cards: revealedCards([top], isWbUnit ? "rush" : "power"),
  });
  if (isWbUnit) {
    const next = startEffectRush(state, {
      playerId: enemyId,
      phasePlayerId: ctx.phasePlayerId,
      effectId: "rm029_cosmic_harley_rush",
      sourceCardId: "RM-029",
      sourceInstanceId: ctx.triggerSourceInstanceId,
      fromZone: "deck",
      candidates: [top.instanceId],
      maxCount: 1,
      requireConditions: false,
      mandatory: true,
      forced: true,
    });
    return { state: next, detail: "rm029:wb_unit_rushed" };
  }
  let next = patchPlayer(state, enemyId, (p) => ({ ...p, deck: p.deck.slice(1), power: [...p.power, { ...stripForZone(top), faceDown: false }] }));
  next = applyDamageToPlayer(next, enemyId, 1, { kind: "none", activePlayer: next.activePlayer });
  return { state: next, detail: "rm029:power_and_damage" };
}

// ---------------------------------------------------------------------------
// RM-030 超惑星戦闘母艦ダイレオン【ダイレオンレーザー】・RM-033 メタルダー ※（バトルの BP）
// RM-030「これが自軍ラッシュエリアにある間、OTを持つ自軍Lユニットは、アタックされるときBP+2000される。」（atwiki/page-843）。1枚につき+2000。
// RM-033「※これはバトルするとき、これとバトルするユニットの必要パワーの数字と同じ必要パワーの数字を持つ自軍コマンド1つにつきBP+2000される。」
// （atwiki/page-870）。コマンドはリリース状態・ホールド状態を問わない自軍コマンドゾーンのカード。

function battleFound(state: GameState, instanceId: string): { owner: PlayerId; card: CardInstance } | null {
  for (const pid of ["player1", "player2"] as const) {
    const c = findField(state, pid, instanceId);
    if (c) return { owner: pid, card: c };
  }
  return null;
}

function metalderBonus(state: GameState, ownerId: PlayerId, self: CardInstance, opponentCard: CardInstance | undefined): number {
  if (!isSameCardIdentity(self.cardId, "RM-033") || !opponentCard) return 0;
  const n = rm2CostNumber(state, opponentCard.cardId);
  if (!Number.isFinite(n)) return 0;
  return 2000 * state.players[ownerId].command.filter((c) => rm2CostNumber(state, c.cardId) === n).length;
}

function daileonLaserBonus(state: GameState, ownerId: PlayerId, defender: CardInstance): number {
  const copies = state.players[ownerId].rush.filter((c) => isSameCardIdentity(c.cardId, "RM-030")).length;
  if (copies === 0) return 0;
  const d = getDefinition(state.definitions, defender.cardId);
  if (d?.type !== "unit" || unitSizeOf(state.definitions, defender) !== "L") return 0;
  const zone = zoneOfField(state, ownerId, defender.instanceId) ?? "battle";
  if (!(unitEffectiveCategories(state, ownerId, defender, zone) as string[]).includes("OT")) return 0;
  return 2000 * copies;
}

/** アタックするユニットの BP に加える値（rules/namedUnitEffects.ts battleAttackerBpBonus）。 */
export function rm2AttackerBattleBonus(state: GameState, pending: PendingBattle): number {
  const attacker = findField(state, pending.attackerPlayerId, pending.attackerInstanceId);
  if (!attacker) return 0;
  const defender = battleFound(state, pending.substituteInstanceId ?? pending.defenderInstanceId);
  return metalderBonus(state, pending.attackerPlayerId, attacker, defender?.card);
}

/** アタックされたユニット（かわりにバトルするユニットを含む）の BP に加える値（rules/namedUnitEffects.ts battleDefenderBp）。 */
export function rm2DefenderBattleBonus(state: GameState, pending: PendingBattle, defenderOwner: PlayerId, defender: CardInstance): number {
  const attacker = findField(state, pending.attackerPlayerId, pending.attackerInstanceId);
  return metalderBonus(state, defenderOwner, defender, attacker) + daileonLaserBonus(state, defenderOwner, defender);
}

// ---------------------------------------------------------------------------
// RM-031 戦闘巨人ダイレオン【コズミッククラッシュ】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍バトルエリアから、特徴「獣」または「恐竜」を持つBP8000以下のユニットを1体選び、持ち主のパワーゾーンに送ってもよい」（atwiki/page-844）。
// いまの特徴・いまの BP で見る（サイズを問わない）。

const COSMIC_CRASH_EFFECT_ID = "rm031_cosmic_crash";

function applyCosmicCrash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "rm031:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      if (!isUnitCardId(state, c.cardId)) return false;
      const f = unitFeatures(state, enemyId, c);
      return (f.includes("獣") || f.includes("恐竜")) && effectiveBp(state, enemyId, c) <= 8000 && selectableEnemy(state, ctx.playerId, "RM-031", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm031:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "RM-031", COSMIC_CRASH_EFFECT_ID, ids, true, "power")), detail: COSMIC_CRASH_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RM-033 メタルダー【戦闘技術の習得】（自軍ターン中、バトルエリアに出たとき）
// 「自軍ラッシュエリアからユニットを1体選び、自軍コマンドゾーンにホールド状態で置いてもよい。置けなければこの効果は発動しない。」（atwiki/page-870）

const METALDER_EFFECT_ID = "rm033_sentou_gijutsu";

function applyMetalder(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "rm033:not_own_turn" };
  const p = state.players[ctx.playerId];
  if (p.command.length >= COMMAND_ZONE_MAX) return { state, detail: "rm033:command_full" };
  const ids = p.rush.filter((c) => isUnitCardId(state, c.cardId) && !isVehicleNow(state, ctx.playerId, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm033:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-033"), effectId: METALDER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: METALDER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[METALDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-033", `${METALDER_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[METALDER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-034 暴魂トップガンダー
// ※「これがバトルエリアに出たとき、相手は1枚ドローしてもよい。」— 相手が選ぶ（ターンを問わない）。
// 【正確な射撃】（RC）「自軍コマンドゾーンからカードを1枚選びホールドしてもよい。そうしたとき、ホールドしたカードの必要パワーの数字を見て、その数字と同じ
//  パワーの数字を持つカードを、敵軍パワーゾーンのオモテ向きのカードの中から1枚選び、ウラ返してダメージにする。」（atwiki/page-877）
// ホールドできるのはリリース状態のカード。「パワーの数字」はパワーゾーンのカードの必要パワーの数字（「+」「-」を除く）。

const TOPGUNDER_DRAW_EFFECT_ID = "rm034_opponent_draw";
const TOPGUNDER_HOLD_EFFECT_ID = "rm034_seikaku_shageki_hold";
const TOPGUNDER_FLIP_EFFECT_ID = "rm034_seikaku_shageki_flip";

function applyTopgunderDraw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  return {
    state: openAfter(state, confirmChoice({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "RM-034", TOPGUNDER_DRAW_EFFECT_ID)),
    detail: TOPGUNDER_DRAW_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[TOPGUNDER_DRAW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TOPGUNDER_DRAW_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[TOPGUNDER_DRAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => drawOne(p));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-034", `${TOPGUNDER_DRAW_EFFECT_ID}:draw`) };
};

function applySeikakuShageki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm034:no_command" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-034"), effectId: TOPGUNDER_HOLD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: TOPGUNDER_HOLD_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[TOPGUNDER_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!cmd) return { error: "invalid_target" };
  const next = holdCommands(close(state, pending), playerId, [instanceId]);
  const n = rm2CostNumber(state, cmd.cardId);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].power
    .filter((c) => !c.faceDown && Number.isFinite(n) && rm2CostNumber(next, c.cardId) === n && selectableEnemyZoneCard(c.cardId))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RM-034", `${TOPGUNDER_HOLD_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: TOPGUNDER_FLIP_EFFECT_ID, validInstanceIds: ids, selectedInstanceIds: [], optional: false }), log };
};
CHOICE_SKIPPERS[TOPGUNDER_HOLD_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[TOPGUNDER_FLIP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)),
    damage: p.damage + 1,
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-034", `${TOPGUNDER_FLIP_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RM-035 凱聖クールギン【ヨロイ軍団の統率】
// 「これが自軍バトルエリアにある間、敵軍バトルフェイズ中、バトルエリアに出た特徴「メカ」を持つ敵軍Sユニットは、可能なら特徴「ヨロイ軍団」を持つユニットに
//  アタックする。」（atwiki/page-846）。アタックできる「ヨロイ軍団」のユニットがあれば、それにアタックしなければならない（ストライク・パス・ほかの
//  ユニットへのアタックはできない。atwiki/page-999 Q1「アタックしなければならない」）。アタックできなければ制限はない（同 A1）。

/**
 * バトルエリアに出た unit（enteringPlayerId のユニット）がアタックしなければならない相手（いなければ空）。
 * canAttack はアタックできるかの判定（呼び出し側から受け取る）。
 */
export function rm2RequiredDefenderIds(state: GameState, enteringPlayerId: PlayerId, unit: CardInstance, canAttack: (defenderId: string) => boolean): string[] {
  if (state.phase !== "battle" || state.activePlayer !== enteringPlayerId) return [];
  const ownerId = opponent(enteringPlayerId);
  if (!state.players[ownerId].battle.some((c) => isSameCardIdentity(c.cardId, "RM-035"))) return [];
  if (!isUnitCardId(state, unit.cardId) || !rk1IsSmallNow(state, unit)) return [];
  if (!unitFeatures(state, enteringPlayerId, unit).includes("メカ")) return [];
  const owner = state.players[ownerId];
  return [...owner.battle, ...owner.rush]
    .filter((c) => isUnitCardId(state, c.cardId) && unitFeatures(state, ownerId, c).includes("ヨロイ軍団") && canAttack(c.instanceId))
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RM-036 暴魂チューボ【剣の使い手】
// 「これとバトルする敵軍ユニットのBPが本来のBPでなかったなら、そのバトルで敵軍ユニットを撃破したとき、相手に1点ダメージを与える。」（atwiki/page-847）
// アタックしても、アタックされても（かわりにバトルしても）。敵軍ユニットのバトルの BP（増減・アタックされるときの BP を含む）が本来の BP と違えば、
// その敵軍ユニットがそのバトルで撃破されたとき（相打ちを含む）1点。

/** バトルの解決の直後に行う処理（rules/operationCounters.ts resolveBattlePendingCore）。対象外なら undefined。 */
export function rm2AfterBattle(
  state: GameState,
  pending: PendingBattle,
  r: { attacker: CardInstance; defender: CardInstance; defenderOwner: PlayerId; attackerBp: number; defenderBp: number; attackerDestroyed: boolean; defenderDestroyed: boolean },
): ((s: GameState) => GameState) | undefined {
  const sides = [
    { self: r.attacker, selfOwner: pending.attackerPlayerId, enemy: r.defender, enemyOwner: r.defenderOwner, enemyBp: r.defenderBp, enemyDestroyed: r.defenderDestroyed },
    { self: r.defender, selfOwner: r.defenderOwner, enemy: r.attacker, enemyOwner: pending.attackerPlayerId, enemyBp: r.attackerBp, enemyDestroyed: r.attackerDestroyed },
  ];
  const hits: PlayerId[] = [];
  for (const s of sides) {
    if (!isSameCardIdentity(s.self.cardId, "RM-036") || s.selfOwner === s.enemyOwner || !s.enemyDestroyed) continue;
    if (s.enemyBp === printedBp(state, s.enemy.cardId)) continue;
    hits.push(s.enemyOwner);
  }
  if (hits.length === 0) return undefined;
  return (s) => {
    let next = s;
    for (const target of hits) {
      if (next.winner) break;
      next = applyDamageToPlayer(next, target, 1, { kind: "none", activePlayer: next.activePlayer });
      next = { ...next, log: [...next.log, buildLogEntry(opponent(target), "named_effect", "RM-036", next.definitions, "ken_no_tsukaite")] };
    }
    return next;
  };
}

// ---------------------------------------------------------------------------
// RM-037 凱聖ゲルドリング【手段を選ばぬ策略】（自軍ターン中、バトルエリアに出たとき）
// 「自軍ラッシュエリアから特徴「怪人」を持つユニットを1体選び、捨札にしてもよい。そうしたとき、相手の手札を見ないで1枚選ぶ。相手は選ばれたカードを
//  自分自身の山札の上に戻すか、自分自身のパワーゾーンに置くか、自分自身のコマンドゾーンにホールド状態で置くかを選ぶ。」（atwiki/page-848）
// 手札のカードは中身を見ないで選ぶ（手札はオモテ向きではないので「相手に選ばれない」で外さない）。パワーゾーンにはオモテ向きで置く。コマンドゾーンが
// 5枚ならコマンドゾーンは選べない。

const GELDORING_KAIJIN_EFFECT_ID = "rm037_shudan_kaijin";
const GELDORING_HAND_EFFECT_ID = "rm037_shudan_hand";
const GELDORING_PLACE_EFFECT_ID = "rm037_shudan_place";

function applyGeldoring(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "rm037:not_own_turn" };
  const ids = state.players[ctx.playerId].rush
    .filter((c) => isUnitCardId(state, c.cardId) && unitFeatures(state, ctx.playerId, c).includes("怪人"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm037:no_kaijin" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-037"), effectId: GELDORING_KAIJIN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: GELDORING_KAIJIN_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GELDORING_KAIJIN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].hand.map((c) => c.instanceId);
  const log = logFor(state, playerId, "RM-037", `${GELDORING_KAIJIN_EFFECT_ID}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: GELDORING_HAND_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, selectedInstanceIds: [], optional: false }), log };
};
CHOICE_SKIPPERS[GELDORING_KAIJIN_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[GELDORING_HAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = close(state, pending);
  const modes = [RM2_DECK_TOP, RM2_TO_POWER, ...(next.players[enemyId].command.length < COMMAND_ZONE_MAX ? [RM2_TO_COMMAND] : [])];
  return {
    state: openNext(next, pending, {
      ...pending,
      playerId: enemyId,
      effectId: GELDORING_PLACE_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: modes,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
      rm2Meta: { handInstanceId: instanceId },
    }),
    log: logFor(state, playerId, "RM-037", `${GELDORING_HAND_EFFECT_ID}:picked`),
  };
};

CHOICE_RESOLVERS[GELDORING_PLACE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const handId = pending.rm2Meta?.handInstanceId;
  const card = state.players[playerId].hand.find((c) => c.instanceId === handId);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, playerId, (p) => {
      const hand = p.hand.filter((c) => c.instanceId !== card.instanceId);
      if (mode === RM2_TO_POWER) return { ...p, hand, power: [...p.power, { ...stripForZone(card), faceDown: false }] };
      if (mode === RM2_TO_COMMAND && p.command.length < COMMAND_ZONE_MAX) return { ...p, hand, command: [...p.command, { ...stripForZone(card), commandHeld: true }] };
      return { ...p, hand, deck: [stripForZone(card), ...p.deck] };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-037", `${GELDORING_PLACE_EFFECT_ID}:${mode}`) };
};

// ---------------------------------------------------------------------------
// RM-038 凱聖バルスキー【部下の修理と改造】（起動）
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、DAを持つ自軍コマンドを3つホールドしてもよい。そうしたとき、自軍捨札からDAを持ち特徴「メカ」を持つ
//  Sユニットのカードを1枚選び、自軍ラッシュエリアに出す。」（atwiki/page-849）
// 起動（activate_field_unit_ability）でリリース状態の DA の自軍コマンドを3つホールドする（回数の制限はない）。捨札のカードは印刷のカテゴリ・特徴・サイズで
// 見る。出すのは効果のラッシュ（必要パワー・追加条件は問わない）。捨札に出せるカードがなければ起動できない。

const BULSKY_CARD_ID = "RM-038";
const BULSKY_HOLD_EFFECT_ID = "rm038_bulsky_hold";
const BULSKY_PICK_EFFECT_ID = "rm038_bulsky_pick";

function bulskyTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].discard
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && unitSizeOf(state.definitions, c) === "S" && (cardCategories(d) as string[]).includes("DA") && (d.features ?? []).includes("メカ");
    })
    .map((c) => c.instanceId);
}

export function isRm2FieldAbilityCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, BULSKY_CARD_ID);
}

export function canActivateRm2FieldAbility(state: GameState, playerId: PlayerId, _card: CardInstance): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  return releasedCommandsOf(state, playerId, "DA").length >= 3 && bulskyTargets(state, playerId).length > 0;
}

export function activateRm2FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ctx: BaseCtx = { playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId };
  return holdThen(state, ctx, BULSKY_CARD_ID, BULSKY_HOLD_EFFECT_ID, releasedCommandsOf(state, playerId, "DA"), 3);
}

HOLD_COMPLETERS[BULSKY_HOLD_EFFECT_ID] = (state, pending) => {
  const ids = bulskyTargets(state, pending.playerId);
  if (ids.length === 0) return proceed(state, pending);
  return openAfter(state, { ...base(pendingBase(pending), BULSKY_CARD_ID), effectId: BULSKY_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, resumeChoice: pending.resumeChoice });
};

CHOICE_RESOLVERS[BULSKY_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: effectRushPicked(state, pending, playerId, instanceId, "discard"), log: logFor(state, playerId, BULSKY_CARD_ID, `${BULSKY_PICK_EFFECT_ID}:rush`) };
};

// ---------------------------------------------------------------------------
// RM-039 ジライヤ第二装着【十文字斬り】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍捨札からユニットカードを1枚選んでもよい。そうしたとき、選んだユニットカードと同じカード名の敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして
//  置く。」（atwiki/page-872）。敵軍ユニットはエリア・サイズを問わない（カード評価）。捨札のカードは捨札に残る。※の再ラッシュ・追加条件は既存の処理。

const JUMONJI_DISCARD_EFFECT_ID = "rm039_jumonji_discard";
const JUMONJI_UNIT_EFFECT_ID = "rm039_jumonji_unit";

function applyJumonji(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "rm039:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].discard.filter((c) => isUnitCardId(state, c.cardId) && selectableEnemyZoneCard(c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm039:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-039"), effectId: JUMONJI_DISCARD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: JUMONJI_DISCARD_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[JUMONJI_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const name = getDefinition(state.definitions, card.cardId)?.name;
  const next = close(state, pending);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => sameCardName(getDefinition(next.definitions, c.cardId)?.name, name) && selectableEnemy(next, playerId, "RM-039", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RM-039", `${JUMONJI_DISCARD_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: JUMONJI_UNIT_EFFECT_ID, validInstanceIds: ids, selectedInstanceIds: [], optional: false }), log };
};
CHOICE_SKIPPERS[JUMONJI_DISCARD_EFFECT_ID] = simpleSkip();

function damagePick(cardId: string, effectId: string): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
    return { state: proceed(next, pending), log: logFor(state, playerId, cardId, `${effectId}:${instanceId}`) };
  };
}

CHOICE_RESOLVERS[JUMONJI_UNIT_EFFECT_ID] = damagePick("RM-039", JUMONJI_UNIT_EFFECT_ID);

// ---------------------------------------------------------------------------
// RM-040 姫忍 恵美破【忍法花吹雪】（NC）
// 「「SP1」カテゴリまたは特徴の追加されている敵軍Sユニットを1体選び、持ち主の山札の下に戻してもよい。」（atwiki/page-852）。「SP1」は DSL の SP1。
// 追加されているかは、いまの特徴・カテゴリが印刷の特徴・カテゴリより多いか（効果・※で追加されたもの）。エリアを問わない（カード評価）。

const HANAFUBUKI_EFFECT_ID = "rm040_hanafubuki";

function hasAddedCategoryOrFeature(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  const d = getDefinition(state.definitions, card.cardId);
  if (!d) return false;
  const printedFeatures = d.features ?? [];
  if (unitFeatures(state, ownerId, card).some((f) => !printedFeatures.includes(f))) return true;
  const printedCats = cardCategories(d) as string[];
  const zone = zoneOfField(state, ownerId, card.instanceId) ?? "rush";
  return (unitEffectiveCategories(state, ownerId, card, zone) as string[]).some((c) => !printedCats.includes(c));
}

function applyHanafubuki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && hasAddedCategoryOrFeature(state, enemyId, c) && selectableEnemy(state, ctx.playerId, "RM-040", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm040:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-040"), effectId: HANAFUBUKI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: HANAFUBUKI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[HANAFUBUKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "deck_bottom");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-040", `${HANAFUBUKI_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[HANAFUBUKI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-041 城忍 フクロウ男爵【アイアム偽者などノーサンキュー】（RC）
// 「敵軍ユニットを1体選んでもよい。そうしたとき、選んだユニットと同じカード名の敵軍ユニットが、選んだユニット以外にあれば、選んだユニットを持ち主の
//  パワーゾーンにダメージにして置く。」（atwiki/page-853）。エリア・サイズを問わない。

const FUKUROU_EFFECT_ID = "rm041_fake_no_thank_you";

function applyFukurou(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId).filter((c) => selectableEnemy(state, ctx.playerId, "RM-041", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rm041:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-041"), effectId: FUKUROU_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: FUKUROU_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[FUKUROU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = findField(state, enemyId, instanceId);
  if (!unit) return { error: "invalid_target" };
  const name = getDefinition(state.definitions, unit.cardId)?.name;
  const dup = fieldUnits(state, enemyId).some((c) => c.instanceId !== instanceId && sameCardName(getDefinition(state.definitions, c.cardId)?.name, name));
  let next = close(state, pending);
  if (dup) next = moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "RM-041", `${FUKUROU_EFFECT_ID}:${instanceId}:${dup ? "damage" : "no_duplicate"}`) };
};
CHOICE_SKIPPERS[FUKUROU_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RM-042 蝶忍 紅牙【妖魔忍法乱れ蝶】（NC）
// 「自分の手札からカードを2枚選び相手に見せてもよい。そうしたとき、見せた2枚のカードの必要パワーの数字を合計して、その合計と同じ必要パワーの数字を持つ
//  敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-850）
// 見せたカードは手札に残る。数字は「+」「-」を除く（数字のない必要パワーは0）。敵軍 S ユニットはエリアを問わない（カード評価）。

const MIDARE_HAND_EFFECT_ID = "rm042_midare_cho_hand";
const MIDARE_UNIT_EFFECT_ID = "rm042_midare_cho_unit";

function applyMidareCho(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "rm042:hand_short" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "RM-042"), effectId: MIDARE_HAND_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, selectCount: 2, optional: true }),
    detail: MIDARE_HAND_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[MIDARE_HAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)), optional: false } },
      log: logFor(state, playerId, "RM-042", `${MIDARE_HAND_EFFECT_ID}:${instanceId}`),
    };
  }
  const hand = state.players[playerId].hand;
  const sum = selected.reduce((acc, id) => {
    const c = hand.find((h) => h.instanceId === id);
    const n = c ? rm2CostNumber(state, c.cardId) : Number.NaN;
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const enemyId = opponent(playerId);
  const next = close(state, pending);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && rm2CostNumber(next, c.cardId) === sum && selectableEnemy(next, playerId, "RM-042", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RM-042", `${MIDARE_HAND_EFFECT_ID}:sum:${sum}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: MIDARE_UNIT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false }), log };
};
CHOICE_SKIPPERS[MIDARE_HAND_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[MIDARE_UNIT_EFFECT_ID] = damagePick("RM-042", MIDARE_UNIT_EFFECT_ID);

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RM2_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RM-023::chichu_senko": applyScooper,
  "RM-024::tousai": applyGavion,
  "RM-025::sharivan_crash": applySharivanCrash,
  "RM-026::shuyou": applyGrandbirth,
  "RM-027::plasma_cannon": applyPlasmaCannon,
  "RM-029::cosmic_harley": applyCosmicHarley,
  "RM-031::cosmic_crash": applyCosmicCrash,
  "RM-033::sentou_gijutsu": applyMetalder,
  "RM-034::opponent_draw": applyTopgunderDraw,
  "RM-034::seikaku_shageki": applySeikakuShageki,
  "RM-037::shudan": applyGeldoring,
  "RM-039::jumonji": applyJumonji,
  "RM-040::hanafubuki": applyHanafubuki,
  "RM-041::fake_no_thank_you": applyFukurou,
  "RM-042::midare_cho": applyMidareCho,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RM-022::cyberian": noop("rm022:vehicle_enter"),
  "RM-028::moto_sharian": noop("rm028:power_zone"),
  "RM-029::no_entry": noop("rm029:battle_entry_ban"),
  "RM-030::daileon_laser": noop("rm030:attacked_bp"),
  "RM-033::battle_bp": noop("rm033:battle_bp"),
  "RM-035::yoroi_tousotsu": noop("rm035:forced_attack"),
  "RM-036::ken_no_tsukaite": noop("rm036:after_battle"),
  "RM-038::bulsky": noop("rm038:field_ability"),
};

export function tryRm2CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RM2_KEYWORD_PREFIX)) return null;
  const handler = RM2_KEYWORDS[keyword.slice(RM2_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
