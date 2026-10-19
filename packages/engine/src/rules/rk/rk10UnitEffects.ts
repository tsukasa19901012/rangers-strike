/**
 * ザ・マスクドライダーEXP vol.3 RK-190〜RK-210（フォッグマザー〜仮面ライダーギャレンJF）のカード固有の効果（cardSpec RK10-190-210 の監査）。
 *
 * - `tryRk10CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk10::cardId::name`。ラッシュしたとき・バトルエリアに出たとき・RC）。
 * - `tryResolveRk10Choice` / `trySkipRk10Choice` / `tryConfirmRk10Choice`: このモジュールが開いた選択の解決。撃破の選択の一部は
 *   汎用の選択（unitDestination "discard"）で解決する（rules/pendingChoices.ts）。
 * - `applyRk10AfterAction`: RK-195【再起動と暴走】（ホールド状態からリリース状態になった。core/applyAction.ts の後処理）。
 * - `tryRk10OnEnterBattle`: RK-198【ドライブディバイダー】（「レイヨウ型」からのコンビネーション。rules/combo.ts）。
 * - `rk10OnAttackWin`: RK-203【アクセルモード】（rules/operationCounters.ts のバトルの解決）。
 * - `openRk10OgreAfterDamage`: RK-204【オーガ・ストラッシュ】（rules/damagePayment.ts のダメージの適用）。
 * - `openRk10OmegaDraw`: RK-199【ゼール種の統率】の「相手は…撃破したとき、1枚ドローしてもよい」（events/listeners/unitLeftZoneListener.ts）。
 * - `collectRk10TurnEndQueue` / `openRk10TurnEndEntry`: RK-205 の※（自分がターンを終えるとき。rules/turnEndingEffects.ts）。
 * - `rk10CraneBeforeOnRush` / `rk10CraneWatch` / `rk10CraneIntercept` / `rk10CraneDeclined`: RK-208【迎撃の毒矢】
 *   （rules/onRushUnitEffects.ts・core/applyAction.ts）。
 * - `rk10EffectiveSp`: RK-191【ガライソード】の SP1（rules/legend3/fieldEffects.ts）。
 * 継続効果の判定（RK-194・RK-196・RK-197・RK-199・RK-206・RK-209）は rules/rk/rk10Fields.ts。構成は rules/rk/rk9UnitEffects.ts と同じ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { GameAction } from "../../types/actions";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, effectiveCommandCategories, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addTurnRestrictionModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { listDslEffectsForTrigger } from "../../dsl/effectLookup";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice, requestDrawFromDeck } from "../pendingChoices";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { applyDamageToPlayer } from "../damagePayment";
import { resolveBattlePending } from "../operationCounters";
import { rk1IsSmallNow } from "./rk1Features";
import { RK10_GARAI_SP1_RULE, rk10HasInstancePayload, rk10UnitHasResist } from "./rk10Fields";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK10_KEYWORD_PREFIX = "rk10::";

export function isRk10ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk10Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk10Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 確定できる選択か（「発動する」の確認、または1つ以上選んだ「〜まで選ぶ」）。 */
export function canConfirmRk10Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.selectedInstanceIds ?? []).length > 0;
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk10Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk10Choice(pending)) return { error: "no_selection" };
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

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

function setHeld(state: GameState, ownerId: PlayerId, instanceIds: Set<string>): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
    rush: p.rush.map((c) => (instanceIds.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
  }));
}

/** ids のユニットをすべて撃破する（RK-115 と同じく、全員を選んだ確定済みの撃破の選択で処理する）。resume は撃破の後に開く。 */
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

/** 「1枚ドローしてもよい」の確認（確定でドロー）。 */
function drawConfirm(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, sourceCardId: string, effectId: string, sourceInstanceId?: string): GameState {
  if (state.players[playerId].deck.length === 0) return state;
  return openOrQueue(state, confirmChoice({ playerId, phasePlayerId, sourceInstanceId }, sourceCardId, effectId));
}

function drawConfirmer(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const drawn = requestDrawFromDeck(close(state, pending), playerId, pending.phasePlayerId, { count: 1, sourceCardId: cardId });
    return { state: proceed(drawn.state, pending), log: logFor(state, playerId, cardId, `${pending.effectId}:draw`) };
  };
}

// ---------------------------------------------------------------------------
// RK-190 フォッグマザー【孵化を迎える厄災】
// 「これをラッシュしたとき、次の効果を発動できる⇒自軍山札をシャッフルした後、その上から2枚をオモテにする。そして自軍山札を見て、ユニットカードを
//  1枚選びラッシュエリアに出してもよい。ただし選べるカードは、カテゴリがオモテにした1枚目と同じで、必要パワーの数字がオモテにした2枚目と同じ
//  カードとする。その後、オモテにしたカードは山札に戻してシャッフルする。」（atwiki/page-911）
// - オモテにした2枚は山札にあるが選べない（カード評価・コメント欄「山札に戻すのはラッシュ後だから不可」）。オモテにした2枚は viewedInstanceIds に残す。
// - カテゴリは同じカテゴリの組（マルチカテゴリは同じ組）で比べる（マルチカテゴリの扱いは cardSpec の it.todo）。
// - 出したユニットは効果でラッシュエリアに出たので「ラッシュしたとき」の効果を発動できる（atwiki/page-911 Q1）。

export const FOG_MOTHER_EFFECT_ID = "rk190_fog_mother";
export const FOG_MOTHER_PICK_EFFECT_ID = "rk190_fog_mother_pick";

function applyFogMother(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-190", FOG_MOTHER_EFFECT_ID)), detail: FOG_MOTHER_EFFECT_ID };
}

function sameCategories(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((c) => b.includes(c));
}

function reshuffleDeck(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
}

CHOICE_RESOLVERS[FOG_MOTHER_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[FOG_MOTHER_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[FOG_MOTHER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = reshuffleDeck(close(state, pending), playerId);
  const deck = next.players[playerId].deck;
  const shown = deck.slice(0, 2);
  const log = logFor(state, playerId, "RK-190", `${FOG_MOTHER_EFFECT_ID}:${shown.map((c) => cardName(state.definitions, c.cardId)).join(",")}`);
  if (shown.length < 2) return { state: proceed(reshuffleDeck(next, playerId), pending), log };
  const cats = categoriesOfCard(next, shown[0]!.cardId);
  const num = costNumber(next, shown[1]!.cardId);
  const shownIds = shown.map((c) => c.instanceId);
  const ids = deck
    .filter((c) => !shownIds.includes(c.instanceId) && isUnitCard(next, c.cardId))
    .filter((c) => sameCategories(categoriesOfCard(next, c.cardId), cats) && Number.isFinite(num) && costNumber(next, c.cardId) === num)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(reshuffleDeck(next, playerId), pending), log };
  next = openNext(next, pending, {
    ...pending,
    effectId: FOG_MOTHER_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    viewedInstanceIds: shownIds,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
    mayConfirm: undefined,
  });
  return { state: next, log };
};

CHOICE_RESOLVERS[FOG_MOTHER_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
    rush: [...p.rush, stripForZone(card)],
  }));
  const rushed = finalizeEffectRush(next, playerId, [instanceId], pending.phasePlayerId);
  next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-190", `${FOG_MOTHER_PICK_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[FOG_MOTHER_PICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(reshuffleDeck(close(state, pending), playerId), pending), log: skipLog(state, playerId, "RK-190", pending.effectId) };
};

// ---------------------------------------------------------------------------
// RK-191 ガライ【ガライソード】「これをラッシュしたとき、これをホールドしてもよい。そうしたとき、このターン、これはSP1になる。」（atwiki/page-917）
// ホールド状態のユニットにも制限はない（R-HOLD-03）ので、ホールドしたままバトルエリアに出てストライクできる。

export const GARAI_EFFECT_ID = "rk191_garai_sword";

function applyGaraiSword(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = fieldCards(state, ctx.playerId).find((c) => c.instanceId === ctx.triggerSourceInstanceId);
  if (!self || self.commandHeld) return { state, detail: "rk191:not_released" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-191", GARAI_EFFECT_ID)), detail: GARAI_EFFECT_ID };
}

CHOICE_RESOLVERS[GARAI_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[GARAI_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[GARAI_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  if (selfId && zoneOfField(next, playerId, selfId)) {
    next = setHeld(next, playerId, new Set([selfId]));
    next = addTurnPayload(next, playerId, RK10_GARAI_SP1_RULE, "RK-191", { instanceId: selfId });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-191", `${GARAI_EFFECT_ID}:hold`) };
};

/** RK-191 のこのターンの「SP1」（rules/legend3/fieldEffects.ts から呼ぶ）。 */
export function rk10EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (!isSameCardIdentity(instance.cardId, "RK-191")) return sp;
  if (!rk10HasInstancePayload(state, playerId, RK10_GARAI_SP1_RULE, instance.instanceId)) return sp;
  return Math.max(sp, 1);
}

// ---------------------------------------------------------------------------
// 効果のバトル（RK-192【アギトファング】・RK-208【迎撃の毒矢】）。アタックではないバトル（effectBattle）として解決する
// （RS-508【ロードセイバー】と同じ。rules/legend1/set7NamedEffectsD.ts）。

function effectBattle(state: GameState, pending: PendingEffectChoice, attackerId: PlayerId, attackerInstanceId: string, defenderId: PlayerId, defenderInstanceId: string): GameState {
  const battle: PendingBattle = {
    attackerPlayerId: attackerId,
    attackerInstanceId,
    defenderPlayerId: defenderId,
    defenderInstanceId,
    phasePlayerId: pending.phasePlayerId,
    onAttackResolved: true,
    effectBattle: true,
  };
  const battled = resolveBattlePending({ ...state, activePlayer: pending.phasePlayerId }, battle).state;
  if (battled.pendingEffectChoice || battled.pendingLeave || battled.pendingRegister) {
    if (!pending.resumeChoice) return battled;
    if (battled.pendingEffectChoice) return { ...battled, pendingEffectChoice: appendResume(battled.pendingEffectChoice, pending.resumeChoice) };
    return { ...battled, deferredDestroyTriggers: [...(battled.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
  }
  return proceed(battled, pending);
}

// ---------------------------------------------------------------------------
// RK-192 アギト【アギトファング】「これをラッシュしたとき、レジストを持つ敵軍Sユニットを1体選んでもよい。そうしたとき、そのユニットと
//  このユニットでバトルする。」（atwiki/page-918）。エリアを問わない。

export const AGITO_EFFECT_ID = "rk192_agito_fang";

function applyAgitoFang(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && rk10UnitHasResist(state, enemyId, c) && selectableEnemy(state, ctx.playerId, "RK-192", c))
    .map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: "rk192:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-192"), effectId: AGITO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: AGITO_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[AGITO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const selfId = pending.sourceInstanceId;
  const log = logFor(state, playerId, "RK-192", `${AGITO_EFFECT_ID}:${instanceId}`);
  const cleared = close(state, pending);
  if (!selfId || !zoneOfField(cleared, playerId, selfId) || !zoneOfField(cleared, enemyId, instanceId)) return { state: proceed(cleared, pending), log };
  return { state: effectBattle(cleared, pending, playerId, selfId, enemyId, instanceId), log };
};
CHOICE_SKIPPERS[AGITO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-193 ズー【バームニードル】「これをラッシュしたとき、カード1枚につきBP1000として、相手の手札の枚数分のBPを計算し、そのBP以下の
//  敵軍ユニットを1体選び撃破してもよい。」（atwiki/page-919）。サイズもエリアも問わない（コメント欄）。BP は今の値。

function applyBalmNeedle(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const limit = state.players[enemyId].hand.length * 1000;
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= limit && selectableEnemy(state, ctx.playerId, "RK-193", c))
    .map((c) => c.instanceId);
  if (limit <= 0 || ids.length === 0) return { state, detail: "rk193:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-193"), effectId: "rk193_balm_needle", kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, unitDestination: "discard" }),
    detail: "rk193_balm_needle",
  };
}

// ---------------------------------------------------------------------------
// RK-194 仮面ライダーG3-X【GX-05】（RC）
// 「ホールド状態の自軍ユニットの数を数えて、その数以下の必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び、持ち主のコマンドゾーンに
//  ホールド状態で置く。置けなければこの効果は発動できない。」（atwiki/page-999）。強制。

export const GX05_EFFECT_ID = "rk194_gx05";

function applyGx05(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  if (state.players[enemyId].command.length >= COMMAND_ZONE_MAX) return { state, detail: "rk194:command_full" };
  const held = fieldUnits(state, ctx.playerId).filter((c) => c.commandHeld).length;
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && costNumber(state, c.cardId) <= held && selectableEnemy(state, ctx.playerId, "RK-194", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk194:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-194"), effectId: GX05_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: GX05_EFFECT_ID,
  };
}

/** 選んだユニットを持ち主のコマンドゾーンにホールド状態で置く（置けなければ捨札）。 */
function toEnemyCommandHeld(state: GameState, enemyId: PlayerId, instanceId: string, phasePlayerId: PlayerId): { state: GameState; cardId?: string } {
  const target = [...state.players[enemyId].battle, ...state.players[enemyId].rush].find((c) => c.instanceId === instanceId);
  if (!target) return { state };
  // 離場の処理を通す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。
  return { state: sendFieldCardsToCommandHeld(state, enemyId, [instanceId], phasePlayerId), cardId: target.cardId };
}

CHOICE_RESOLVERS[GX05_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const placed = toEnemyCommandHeld(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(placed.state, pending), log: logFor(state, playerId, "RK-194", `${GX05_EFFECT_ID}:${placed.cardId ?? instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-195 仮面ライダーG4【再起動と暴走】
// 「これが自軍エリアにある間、これがホールド状態からリリース状態になったとき、これ以外の自軍Sユニットを1体選びホールドしても良い。そうしたとき、
//  敵軍Sユニットを1体選び撃破する。」（atwiki/page-957）。ホールドする候補はリリース状態のもの。撃破はエリアを問わない（カード評価）。

export const G4_HOLD_EFFECT_ID = "rk195_g4_hold";

function g4Candidates(state: GameState, playerId: PlayerId, selfId: string): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => c.instanceId !== selfId && !c.commandHeld && rk1IsSmallNow(state, c))
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[G4_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = setHeld(close(state, pending), playerId, new Set([instanceId]));
  const log = logFor(state, playerId, "RK-195", `${G4_HOLD_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && selectableEnemy(next, playerId, "RK-195", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, { ...pending, effectId: "rk195_g4_destroy", kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false, unitDestination: "discard" });
  return { state: next, log };
};
CHOICE_SKIPPERS[G4_HOLD_EFFECT_ID] = simpleSkip();

/**
 * applyAction の後処理: RK-195 がホールド状態からリリース状態になったら【再起動と暴走】の選択を開く（操作待ちがあれば後で開く）。
 */
export function applyRk10AfterAction(before: GameState, after: GameState, turnPlayer: PlayerId): GameState {
  if (after.winner) return after;
  const opens: PendingEffectChoice[] = [...(after.rk10DeferredChoices ?? [])];
  for (const pid of [turnPlayer, opponent(turnPlayer)] as const) {
    for (const g4 of fieldCards(after, pid).filter((c) => isSameCardIdentity(c.cardId, "RK-195") && !c.commandHeld)) {
      const prev = fieldCards(before, pid).find((c) => c.instanceId === g4.instanceId);
      if (!prev || !prev.commandHeld) continue;
      opens.push({
        ...base({ playerId: pid, phasePlayerId: turnPlayer, sourceInstanceId: g4.instanceId }, "RK-195"),
        effectId: G4_HOLD_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: [],
        selectCount: 1,
        optional: true,
      });
    }
  }
  if (opens.length === 0) return after.rk10DeferredChoices ? { ...after, rk10DeferredChoices: undefined } : after;
  if (hasBlockingPrompt(after)) return { ...after, rk10DeferredChoices: opens };
  let next: GameState = { ...after, rk10DeferredChoices: undefined };
  for (const choice of opens) {
    const ids = g4Candidates(next, choice.playerId, choice.sourceInstanceId ?? "");
    if (ids.length === 0 || !choice.sourceInstanceId || !zoneOfField(next, choice.playerId, choice.sourceInstanceId)) continue;
    next = openOrQueue(next, { ...choice, validInstanceIds: ids });
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-196 クイーンアントロード【黄泉の鐙】
// 「自軍ターン中、これがバトルエリアに出たとき、レジストを持つユニットを1体選んでもよい。そうしたとき、相手は選ばれたユニットを撃破するか、
//  1点ダメージを受けるか選ぶ。」（atwiki/page-920）。自軍・敵軍のユニットを問わない（本文に限定がない）。

export const QUEEN_PICK_EFFECT_ID = "rk196_yomi_pick";
export const QUEEN_ANSWER_EFFECT_ID = "rk196_yomi_answer";
export const QUEEN_DAMAGE_CHOICE = "damage";

function applyYomiNoAbumi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId && ctx.phasePlayerId !== ctx.playerId) return { state, detail: "rk196:enemy_turn" };
  const ids = (["player1", "player2"] as const).flatMap((pid) =>
    fieldUnits(state, pid)
      .filter((c) => rk10UnitHasResist(state, pid, c) && (pid === ctx.playerId || selectableEnemy(state, ctx.playerId, "RK-196", c)))
      .map((c) => c.instanceId),
  );
  if (ids.length === 0) return { state, detail: "rk196:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-196"), effectId: QUEEN_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: QUEEN_PICK_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[QUEEN_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = openNext(close(state, pending), pending, {
    ...pending,
    playerId: opponent(playerId),
    effectId: QUEEN_ANSWER_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [instanceId, QUEEN_DAMAGE_CHOICE],
    selectedInstanceIds: [],
    selectCount: 1,
    optional: false,
  });
  return { state: next, log: logFor(state, playerId, "RK-196", `${QUEEN_PICK_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[QUEEN_PICK_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[QUEEN_ANSWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "RK-196", `${QUEEN_ANSWER_EFFECT_ID}:${instanceId}`);
  const cleared = close(state, pending);
  if (instanceId === QUEEN_DAMAGE_CHOICE) {
    const damaged = applyDamageToPlayer(cleared, playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
    return { state: proceed(damaged, pending), log };
  }
  const destroyed = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  return { state: proceed("error" in destroyed ? cleared : destroyed.state, pending), log };
};

// ---------------------------------------------------------------------------
// RK-198 仮面ライダーインペラー
// ※「これをラッシュしたとき、相手は1枚ドローしてもよい。」
// 【ドライブディバイダー】「特徴「レイヨウ型」を持つユニットからコンビネーションしたとき発動できる⇒レジストを持たない敵軍Sユニットを、
//  特徴「レイヨウ型」を持つユニットの数まで選びホールドする。」（atwiki/page-903）。数えるのは場のユニット（本文に「自軍」の限定がない）。

export const IMPERER_DRAW_EFFECT_ID = "rk198_opponent_draw";
export const DRIVE_DIVIDER_EFFECT_ID = "rk198_drive_divider";
export const DRIVE_DIVIDER_PICK_EFFECT_ID = "rk198_drive_divider_pick";

function applyImpererDraw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: drawConfirm(state, opponent(ctx.playerId), ctx.phasePlayerId, "RK-198", IMPERER_DRAW_EFFECT_ID, ctx.triggerSourceInstanceId), detail: IMPERER_DRAW_EFFECT_ID };
}
CHOICE_RESOLVERS[IMPERER_DRAW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[IMPERER_DRAW_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[IMPERER_DRAW_EFFECT_ID] = drawConfirmer("RK-198");

function countFeature(state: GameState, feature: string, players: readonly PlayerId[]): number {
  return players.reduce((n, pid) => n + fieldUnits(state, pid).filter((c) => unitFeatures(state, pid, c).includes(feature)).length, 0);
}

CHOICE_RESOLVERS[DRIVE_DIVIDER_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[DRIVE_DIVIDER_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[DRIVE_DIVIDER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(cleared, enemyId)
    .filter((c) => rk1IsSmallNow(cleared, c) && !rk10UnitHasResist(cleared, enemyId, c) && !c.commandHeld && selectableEnemy(cleared, playerId, "RK-198", c))
    .map((c) => c.instanceId);
  const limit = countFeature(cleared, "レイヨウ型", ["player1", "player2"]);
  const log = logFor(state, playerId, "RK-198", `${DRIVE_DIVIDER_EFFECT_ID}:accept`);
  if (ids.length === 0 || limit <= 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...pending, effectId: DRIVE_DIVIDER_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: Math.min(limit, ids.length), optional: false, mayConfirm: undefined }),
    log,
  };
};

/** 「〜まで選ぶ」の1つを選ぶ。上限に達したら finish を呼ぶ。 */
function pickUpTo(finish: (state: GameState, pending: PendingEffectChoice, ids: string[]) => ChoiceOutcome): ChoiceResolver {
  return (state, _playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
    if (selected.length >= (pending.selectCount ?? 1) || rest.length === 0) return finish(state, pending, selected);
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest } } };
  };
}

function finishDriveDivider(state: GameState, pending: PendingEffectChoice, ids: string[]): ChoiceOutcome {
  const next = setHeld(close(state, pending), opponent(pending.playerId), new Set(ids));
  return { state: proceed(next, pending), log: logFor(state, pending.playerId, "RK-198", `${DRIVE_DIVIDER_PICK_EFFECT_ID}:${ids.length}`) };
}
CHOICE_RESOLVERS[DRIVE_DIVIDER_PICK_EFFECT_ID] = pickUpTo(finishDriveDivider);
CHOICE_CONFIRMERS[DRIVE_DIVIDER_PICK_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return finishDriveDivider(state, pending, pending.selectedInstanceIds ?? []);
};

/** 直前に出たユニット（左隣。ビークルを除く）。 */
function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitCard(state, c.cardId)) return c;
  }
  return undefined;
}

/** ユニットがバトルエリアに出たとき（rules/combo.ts から呼ぶ）: RK-198 の「レイヨウ型」からのコンビネーション（自軍バトルフェイズ）。 */
export function tryRk10OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  if (!isSameCardIdentity(card.cardId, "RK-198")) return state;
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const partner = comboPartner(state, battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId));
  if (!partner || !unitFeatures(state, playerId, partner).includes("レイヨウ型")) return state;
  return openOrQueue(state, confirmChoice({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "RK-198", DRIVE_DIVIDER_EFFECT_ID));
}

// ---------------------------------------------------------------------------
// RK-199 オメガゼール【ゼール種の統率】の後半「また相手は特徴「レイヨウ型」を持つユニットを撃破したとき、1枚ドローしてもよい。」（atwiki/page-922）
// オメガゼールの持ち主の「レイヨウ型」のユニットが撃破されたとき、相手（撃破した側）がドローするかを選ぶ（RK-081 ゲゲルと同じく撃破の移動で判定する）。

export const OMEGA_DRAW_EFFECT_ID = "rk199_opponent_draw";

export function openRk10OmegaDraw(state: GameState, ownerId: PlayerId, cardId: string, phasePlayerId: PlayerId): GameState {
  if (!(getDefinition(state.definitions, cardId)?.features ?? []).includes("レイヨウ型")) return state;
  const omegas = fieldCards(state, ownerId).filter((c) => getDefinition(state.definitions, c.cardId)?.name === "オメガゼール");
  let next = state;
  for (const omega of omegas) next = drawConfirm(next, opponent(ownerId), phasePlayerId, "RK-199", OMEGA_DRAW_EFFECT_ID, omega.instanceId);
  return next;
}
CHOICE_RESOLVERS[OMEGA_DRAW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[OMEGA_DRAW_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[OMEGA_DRAW_EFFECT_ID] = drawConfirmer("RK-199");

// ---------------------------------------------------------------------------
// RK-200 マガゼール【群れの襲撃】
// 「自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍Sユニットを、特徴「レイヨウ型」を持つ自軍ユニットの数まで選んでもよい。そうしたとき、
//  選んだユニットをライドオフさせる。」（atwiki/page-923）。ライドオフさせたユニットはその場に残る（RK-039 と同じ）。

export const MAGA_EFFECT_ID = "rk200_herd_raid";

function applyHerdRaid(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk200:enemy_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !!c.mountedOnInstanceId && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-200", c))
    .map((c) => c.instanceId);
  const limit = countFeature(state, "レイヨウ型", [ctx.playerId]);
  if (ids.length === 0 || limit <= 0) return { state, detail: "rk200:no_targets" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-200"), effectId: MAGA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: Math.min(limit, ids.length), optional: true }),
    detail: MAGA_EFFECT_ID,
  };
}

function finishHerdRaid(state: GameState, pending: PendingEffectChoice, ids: string[]): ChoiceOutcome {
  const enemyId = opponent(pending.playerId);
  const set = new Set(ids);
  const unmount = (c: CardInstance): CardInstance => {
    if (!set.has(c.instanceId)) return c;
    const { mountedOnInstanceId: _m, ...rest } = c;
    return rest;
  };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, battle: p.battle.map(unmount), rush: p.rush.map(unmount) }));
  return { state: proceed(next, pending), log: logFor(state, pending.playerId, "RK-200", `${MAGA_EFFECT_ID}:${ids.length}`) };
}
CHOICE_RESOLVERS[MAGA_EFFECT_ID] = pickUpTo(finishHerdRaid);
CHOICE_SKIPPERS[MAGA_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  if ((pending.selectedInstanceIds ?? []).length > 0) return finishHerdRaid(state, pending, pending.selectedInstanceIds ?? []);
  return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, "RK-200", MAGA_EFFECT_ID) };
};
CHOICE_CONFIRMERS[MAGA_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return finishHerdRaid(state, pending, pending.selectedInstanceIds ?? []);
};

// ---------------------------------------------------------------------------
// RK-201 ドラグブラッカー【ドラグブレス】
// 「これをラッシュしたとき、次の効果を、相手、自分の順に行う⇒自分自身のユニットを1体選ぶ。そして、自分自身の選んだユニットの持っていない
//  カテゴリを持つ自分自身のSユニットを1体選び撃破する。」（atwiki/page-924）。強制。撃破する候補は「選んだユニットが持っていないカテゴリを
//  1つでも持つ」S ユニット（本文どおり）。

export const DRAG_BREATH_PICK_EFFECT_ID = "rk201_drag_breath_pick";
export const DRAG_BREATH_DESTROY_EFFECT_ID = "rk201_drag_breath_destroy";

function dragPickChoice(state: GameState, chooser: PlayerId, ownerOfEffect: PlayerId, phasePlayerId: PlayerId, sourceInstanceId: string | undefined, resume?: PendingEffectChoice): PendingEffectChoice | undefined {
  const ids = fieldUnits(state, chooser).map((c) => c.instanceId);
  if (ids.length === 0) return resume;
  return {
    ...base({ playerId: chooser, phasePlayerId, sourceInstanceId }, "RK-201"),
    effectId: DRAG_BREATH_PICK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
    rk10Meta: { owner: ownerOfEffect },
    resumeChoice: resume,
  };
}

function applyDragBreath(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfStep = dragPickChoice(state, ctx.playerId, ctx.playerId, ctx.phasePlayerId, ctx.triggerSourceInstanceId);
  const first = dragPickChoice(state, opponent(ctx.playerId), ctx.playerId, ctx.phasePlayerId, ctx.triggerSourceInstanceId, selfStep);
  if (!first) return { state, detail: "rk201:no_units" };
  return { state: openOrQueue(state, first), detail: DRAG_BREATH_PICK_EFFECT_ID };
}

CHOICE_RESOLVERS[DRAG_BREATH_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const chosen = fieldCards(state, playerId).find((c) => c.instanceId === instanceId);
  if (!chosen) return { error: "invalid_target" };
  const zone = zoneOfField(state, playerId, instanceId) ?? "rush";
  const chosenCats = unitEffectiveCategories(state, playerId, chosen, zone) as string[];
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "RK-201", `${DRAG_BREATH_PICK_EFFECT_ID}:${cardName(state.definitions, chosen.cardId)}`);
  // 後で行う自分の手順は、そのときの場で候補を作り直す。
  let resume = pending.resumeChoice;
  if (resume?.effectId === DRAG_BREATH_PICK_EFFECT_ID) {
    const ids = fieldUnits(cleared, resume.playerId).map((c) => c.instanceId);
    resume = ids.length > 0 ? { ...resume, validInstanceIds: ids } : resume.resumeChoice;
  }
  const ids = fieldUnits(cleared, playerId)
    .filter((c) => rk1IsSmallNow(cleared, c))
    .filter((c) => {
      const z = zoneOfField(cleared, playerId, c.instanceId) ?? "rush";
      return (unitEffectiveCategories(cleared, playerId, c, z) as string[]).some((cat) => !chosenCats.includes(cat));
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(cleared, { ...pending, resumeChoice: resume }), log };
  return {
    state: openEffectChoice(cleared, { ...pending, effectId: DRAG_BREATH_DESTROY_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false, resumeChoice: resume }),
    log,
  };
};

CHOICE_RESOLVERS[DRAG_BREATH_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const destroyed = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  return { state: proceed("error" in destroyed ? cleared : destroyed.state, pending), log: logFor(state, playerId, "RK-201", `${DRAG_BREATH_DESTROY_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RK-203 仮面ライダーファイズAF【アクセルモード】
// 「自軍ターン中、これがアタックしてバトルに勝ったとき、常駐している自軍オペレーションに重ねたカードがあれば、その中から1枚選び、山札の下に
//  戻してもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、これをラッシュエリアに戻す。」（atwiki/page-873）

export const ACCEL_MODE_EFFECT_ID = "rk203_accel_mode";

export function rk10OnAttackWin(state: GameState, attackerId: PlayerId, attackerInstanceId: string, phasePlayerId: PlayerId): GameState {
  if (phasePlayerId !== attackerId) return state;
  const self = state.players[attackerId].battle.find((c) => c.instanceId === attackerInstanceId);
  if (!self || !isSameCardIdentity(self.cardId, "RK-203")) return state;
  const ids = state.players[attackerId].operation.flatMap((op) => (op.stackedCards ?? []).map((c) => c.instanceId));
  if (ids.length === 0) return state;
  return openOrQueue(state, {
    ...base({ playerId: attackerId, phasePlayerId, sourceInstanceId: attackerInstanceId }, "RK-203"),
    effectId: ACCEL_MODE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[ACCEL_MODE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const op = state.players[playerId].operation.find((o) => (o.stackedCards ?? []).some((c) => c.instanceId === instanceId));
  if (!op) return { error: "invalid_target" };
  const card = op.stackedCards!.find((c) => c.instanceId === instanceId)!;
  const selfId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const self = p.battle.find((c) => c.instanceId === selfId);
    return {
      ...p,
      operation: p.operation.map((o) => (o.instanceId === op.instanceId ? { ...o, stackedCards: (o.stackedCards ?? []).filter((c) => c.instanceId !== instanceId) } : o)),
      deck: [...p.deck, card],
      battle: self ? p.battle.filter((c) => c.instanceId !== selfId) : p.battle,
      rush: self ? [...p.rush, { ...self, battleActed: undefined }] : p.rush,
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-203", `${ACCEL_MODE_EFFECT_ID}:${card.faceDown ? "face_down" : cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[ACCEL_MODE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-204 仮面ライダーオーガ【オーガ・ストラッシュ】
// 「これが自軍エリアにある間、敵軍ターン中、ストライク以外の方法でダメージを受けたなら、ダメージを受けた後、DAを持つ自軍コマンドを1つホールドしても
//  よい。そうしたとき、相手に1点ダメージを与える。」（atwiki/page-1077）
// - 1点ごと（Q3）・1体ごと（Q2: 1体につきコマンドを1つ）に発動できる。アカネタカでダメージにしたカードはストライク以外のダメージ（faq-rider-2 RK-086）。

export const OGRE_EFFECT_ID = "rk204_ogre_strash";

function releasedDaCommands(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return p.command.filter((c) => !c.commandHeld && effectiveCommandCategories(p, state.definitions, c.cardId).includes("DA")).map((c) => c.instanceId);
}

/** ダメージを受けた後（rules/damagePayment.ts から呼ぶ）。points はストライク以外の方法で受けたダメージの点数。 */
export function openRk10OgreAfterDamage(state: GameState, damagedId: PlayerId, points: number, phasePlayerId: PlayerId): GameState {
  if (points <= 0 || phasePlayerId === damagedId || state.winner) return state;
  const ogres = fieldCards(state, damagedId).filter((c) => isSameCardIdentity(c.cardId, "RK-204"));
  if (ogres.length === 0 || releasedDaCommands(state, damagedId).length === 0) return state;
  let next = state;
  for (let i = 0; i < points; i++) {
    for (const ogre of ogres) {
      next = openOrQueue(next, {
        ...base({ playerId: damagedId, phasePlayerId, sourceInstanceId: ogre.instanceId }, "RK-204"),
        effectId: OGRE_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: releasedDaCommands(next, damagedId),
        selectCount: 1,
        optional: true,
      });
    }
  }
  return next;
}

CHOICE_RESOLVERS[OGRE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!releasedDaCommands(state, playerId).includes(instanceId)) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
  next = applyDamageToPlayer(next, opponent(playerId), 1, { kind: "none", activePlayer: pending.phasePlayerId });
  // 続きの選択（2点目・2体目）は、その時点でリリース状態の DA のコマンドから選ぶ。
  let resume = pending.resumeChoice;
  while (resume?.effectId === OGRE_EFFECT_ID && releasedDaCommands(next, playerId).length === 0) resume = resume.resumeChoice;
  if (resume?.effectId === OGRE_EFFECT_ID) resume = { ...resume, validInstanceIds: releasedDaCommands(next, playerId) };
  return { state: proceed(next, { ...pending, resumeChoice: resume }), log: logFor(state, playerId, "RK-204", `${OGRE_EFFECT_ID}:damage`) };
};
CHOICE_SKIPPERS[OGRE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-205 仮面ライダーサイガ
// ※「これは、自分がターンを終えるときラッシュエリアにあれば手札に戻してもよい。」
// 【フライングアタッカー】「これはラッシュしたときバトルエリアに出してもよい。そうしたとき、これをラッシュするためにホールドしたコマンドの必要パワーの
//  数字を見て、その数字と同じ必要パワーの数字を持つ敵軍Sユニット1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。
//  このとき、これはアタックもストライクもできない。」（atwiki/page-956）。選ぶのは強制・エリアを問わない。
//  ラッシュのためにホールドしたコマンドは state.rk10RushPaid（core/applyAction.ts の resolve_command_payment が記録）。

export const SAIGA_EFFECT_ID = "rk205_flying_attacker";
export const SAIGA_PICK_EFFECT_ID = "rk205_flying_attacker_pick";
export const SAIGA_RETURN_EFFECT_ID = "rk205_return_hand";
const NO_ATTACK_STRIKE_RESTRICTION = "neko_damashi_no_attack_strike";

function applyFlyingAttacker(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = state.players[ctx.playerId].rush.find((c) => c.instanceId === ctx.triggerSourceInstanceId);
  if (!self) return { state, detail: "rk205:not_in_rush" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-205", SAIGA_EFFECT_ID)), detail: SAIGA_EFFECT_ID };
}

CHOICE_RESOLVERS[SAIGA_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SAIGA_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[SAIGA_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  const self = next.players[playerId].rush.find((c) => c.instanceId === selfId);
  const log = logFor(state, playerId, "RK-205", `${SAIGA_EFFECT_ID}:to_battle`);
  if (!self || !selfId) return { state: proceed(next, pending), log };
  next = patchPlayer(next, playerId, (p) => addTurnRestrictionModifier({ ...p, rush: p.rush.filter((c) => c.instanceId !== selfId), battle: [...p.battle, self] }, selfId, NO_ATTACK_STRIKE_RESTRICTION));
  const paid = next.rk10RushPaid?.instanceId === selfId ? next.rk10RushPaid.commandIds : [];
  const nums = paid
    .map((id) => next.players[playerId].command.find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c)
    .map((c) => costNumber(next, c.cardId))
    .filter((n) => Number.isFinite(n));
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && nums.includes(costNumber(next, c.cardId)) && selectableEnemy(next, playerId, "RK-205", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: SAIGA_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false, mayConfirm: undefined }), log };
};

CHOICE_RESOLVERS[SAIGA_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const placed = toEnemyCommandHeld(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(placed.state, pending), log: logFor(state, playerId, "RK-205", `${SAIGA_PICK_EFFECT_ID}:${placed.cardId ?? instanceId}`) };
};

/** 選択を伴う「自分がターンを終えるとき」の発生源（自軍ラッシュエリアのサイガ）。 */
export function collectRk10TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return state.players[endingPlayerId].rush.filter((c) => isSameCardIdentity(c.cardId, "RK-205")).map((c) => c.instanceId);
}

export function openRk10TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  if (!state.players[endingPlayerId].rush.some((c) => c.instanceId === entry)) return state;
  return openEffectChoice(state, confirmChoice({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: entry }, "RK-205", SAIGA_RETURN_EFFECT_ID));
}

CHOICE_RESOLVERS[SAIGA_RETURN_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SAIGA_RETURN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "RK-205", SAIGA_RETURN_EFFECT_ID) };
};
CHOICE_CONFIRMERS[SAIGA_RETURN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const self = p.rush.find((c) => c.instanceId === selfId);
    if (!self) return p;
    return { ...p, rush: p.rush.filter((c) => c.instanceId !== selfId), hand: [...p.hand, stripForZone(self)] };
  });
  return { state: next, log: logFor(state, playerId, "RK-205", `${SAIGA_RETURN_EFFECT_ID}:hand`) };
};

// ---------------------------------------------------------------------------
// RK-207 ホースオルフェノク激情態【悲哀と絶望】
// 「これをラッシュしたとき、ホールド状態のユニットをすべて撃破する。そうして3体撃破するたび、相手に1点ダメージを与える。」（atwiki/page-927）
// 自軍・敵軍・エリアを問わない（カード評価）。撃破するユニットは発動したときに決まる。強制。

export const HORSE_DESTROY_EFFECT_ID = "rk207_sorrow_destroy";
export const HORSE_DAMAGE_EFFECT_ID = "rk207_sorrow_damage";

function applySorrowDespair(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = (["player1", "player2"] as const).flatMap((pid) => fieldUnits(state, pid).filter((c) => c.commandHeld).map((c) => c.instanceId));
  const damage = Math.floor(ids.length / 3);
  const step: PendingEffectChoice | undefined =
    damage > 0 ? { ...confirmChoice(ctxBase(ctx), "RK-207", HORSE_DAMAGE_EFFECT_ID), optional: false, rk10Meta: { remaining: damage } } : undefined;
  let next = destroyAll(state, ctxBase(ctx), "RK-207", HORSE_DESTROY_EFFECT_ID, ids, step);
  if (next.pendingEffectChoice?.effectId === HORSE_DAMAGE_EFFECT_ID) {
    const pending = next.pendingEffectChoice;
    next = horseDamage(next, pending);
  }
  return { state: next, detail: `${HORSE_DESTROY_EFFECT_ID}:${ids.length}` };
}

function horseDamage(state: GameState, pending: PendingEffectChoice): GameState {
  const damaged = applyDamageToPlayer(close(state, pending), opponent(pending.playerId), pending.rk10Meta?.remaining ?? 0, { kind: "none", activePlayer: pending.phasePlayerId });
  return proceed(damaged, pending);
}

CHOICE_RESOLVERS[HORSE_DAMAGE_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[HORSE_DAMAGE_EFFECT_ID] = (state, playerId) => ({ state: horseDamage(state, state.pendingEffectChoice!), log: logFor(state, playerId, "RK-207", `${HORSE_DAMAGE_EFFECT_ID}:damage`) });

// ---------------------------------------------------------------------------
// RK-208 クレインオルフェノク激情態【迎撃の毒矢】
// 「これが自軍ラッシュエリアにある間、効果に「ラッシュしたとき」とある敵軍ユニットが手札からラッシュされたとき、その効果を実行する前に、これを
//  バトルエリアに出してもよい。そうしたとき、その効果は無効になる。その後、そのユニットとこのユニットでバトルする。」（atwiki/page-928）
// - 相手が効果の発動を宣言した後に出せる（grnrngr/faq-rider-3 RK-208 Q1・Q2）。任意の効果は、相手がその効果の最初の選択に答えた
//   （発動を宣言した）ところで窓を開く（rk10CraneWatch → rk10CraneIntercept）。強制の効果は、実行する前に窓を開く（rk10CraneBeforeOnRush）。
// - 「ラッシュしたとき」が発動のタイミングでない効果（クレインオルフェノク激情態自身・ミント等）は対象外（カード評価・コメント欄）—
//   DSL の on_rush の効果を持つユニットだけを見る。
// - 出したクレインがバトルの「アタックする側」（効果のバトル）。

export const CRANE_WINDOW_EFFECT_ID = "rk208_crane_window";

type CraneWatch = { craneOwner: PlayerId; rushedOwner: PlayerId; rushedInstanceId: string };

function cranesFor(state: GameState, craneOwner: PlayerId): CardInstance[] {
  return state.players[craneOwner].rush.filter((c) => isSameCardIdentity(c.cardId, "RK-208"));
}

function hasOnRushEffect(cardId: string): boolean {
  return listDslEffectsForTrigger(cardId, "on_rush").length > 0;
}

/**
 * rules/onRushUnitEffects.ts から: 手札からラッシュされたユニットの「ラッシュしたとき」を実行する前。
 * 強制の効果を持ち、相手のラッシュエリアにクレインがあれば、先に窓を開く（開いたら state を返し、効果の実行は窓の解決後）。
 */
export function rk10CraneBeforeOnRush(state: GameState, ownerId: PlayerId, instanceId: string, cardId: string, phasePlayerId: PlayerId): GameState | null {
  const craneOwner = opponent(ownerId);
  if (cranesFor(state, craneOwner).length === 0 || !hasOnRushEffect(cardId)) return null;
  const effects = listDslEffectsForTrigger(cardId, "on_rush");
  if (!effects.some((e) => !e.optional)) return null;
  return openOrQueue(state, {
    ...confirmChoice({ playerId: craneOwner, phasePlayerId, sourceInstanceId: cranesFor(state, craneOwner)[0]!.instanceId }, "RK-208", CRANE_WINDOW_EFFECT_ID),
    rk10Meta: { crane: { craneOwner, rushedOwner: ownerId, rushedInstanceId: instanceId }, preRush: true },
  });
}

/** 任意の「ラッシュしたとき」の最初の選択に、クレインの窓を開く印を付ける（rules/onRushUnitEffects.ts から）。 */
export function rk10CraneWatch(before: GameState, after: GameState, ownerId: PlayerId, instanceId: string, cardId: string): GameState {
  const pending = after.pendingEffectChoice;
  if (!pending || pending === before.pendingEffectChoice || pending.sourceInstanceId !== instanceId) return after;
  const craneOwner = opponent(ownerId);
  if (cranesFor(after, craneOwner).length === 0 || !hasOnRushEffect(cardId)) return after;
  return { ...after, pendingEffectChoice: { ...pending, rk10CraneWatch: { craneOwner, rushedOwner: ownerId, rushedInstanceId: instanceId } } };
}

/**
 * core/applyAction.ts から: 印の付いた選択に答えた（発動を宣言した）とき、答えを保留してクレインの窓を開く。対象外なら null。
 */
export function rk10CraneIntercept(state: GameState, playerId: PlayerId, action: GameAction): GameState | null {
  const pending = state.pendingEffectChoice;
  const watch = pending?.rk10CraneWatch as CraneWatch | undefined;
  if (!pending || !watch || pending.playerId !== playerId) return null;
  if (action.type !== "resolve_effect_choice" && action.type !== "confirm_effect_choice") return null;
  const cranes = cranesFor(state, watch.craneOwner);
  if (cranes.length === 0 || !zoneOfField(state, watch.rushedOwner, watch.rushedInstanceId)) return null;
  const { rk10CraneWatch: _w, ...plain } = pending;
  return {
    ...state,
    pendingEffectChoice: {
      ...confirmChoice({ playerId: watch.craneOwner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: cranes[0]!.instanceId }, "RK-208", CRANE_WINDOW_EFFECT_ID),
      rk10Meta: { crane: watch, held: plain as PendingEffectChoice, heldAction: action },
    },
    activePlayer: watch.craneOwner,
  };
}

/**
 * core/applyAction.ts から: クレインの窓を見送ったとき。保留していた答え（heldAction）があれば、元の選択に戻して答え直す（呼び出し側で applyAction）。
 * 強制の効果の前に開いた窓なら、ラッシュしたときの効果をそのまま実行する（runner）。
 */
export function rk10CraneDeclined(state: GameState, playerId: PlayerId): { state: GameState; replay?: GameAction; runOnRush?: { ownerId: PlayerId; instanceId: string; phasePlayerId: PlayerId } } | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== CRANE_WINDOW_EFFECT_ID || pending.playerId !== playerId) return null;
  const meta = pending.rk10Meta;
  const log = skipLog(state, playerId, "RK-208", CRANE_WINDOW_EFFECT_ID);
  if (meta?.held && meta.heldAction) {
    return { state: { ...state, pendingEffectChoice: { ...meta.held, resumeChoice: meta.held.resumeChoice }, activePlayer: meta.held.playerId, log: [...state.log, log] }, replay: meta.heldAction as GameAction };
  }
  const cleared = close(state, pending);
  const crane = meta?.crane as CraneWatch | undefined;
  if (!crane) return { state: { ...proceed(cleared, pending), log: [...cleared.log, log] } };
  return { state: { ...cleared, log: [...cleared.log, log] }, runOnRush: { ownerId: crane.rushedOwner, instanceId: crane.rushedInstanceId, phasePlayerId: pending.phasePlayerId } };
}

CHOICE_RESOLVERS[CRANE_WINDOW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[CRANE_WINDOW_EFFECT_ID] = () => ({ error: "rk208_handled_by_apply_action" });
CHOICE_CONFIRMERS[CRANE_WINDOW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const crane = pending.rk10Meta?.crane as CraneWatch | undefined;
  const craneId = pending.sourceInstanceId;
  const log = logFor(state, playerId, "RK-208", `${CRANE_WINDOW_EFFECT_ID}:intercept`);
  // その効果は無効（保留した答えと、その効果の続きの選択は捨てる。割り込まれていたほかの選択は続ける）。
  const held = pending.rk10Meta?.held;
  const after: PendingEffectChoice = { ...pending, resumeChoice: held ? held.resumeChoice : pending.resumeChoice };
  let next = close(state, pending);
  const self = craneId ? next.players[playerId].rush.find((c) => c.instanceId === craneId) : undefined;
  if (!crane || !self) return { state: proceed(next, after), log };
  next = patchPlayer(next, playerId, (p) => ({ ...p, rush: p.rush.filter((c) => c.instanceId !== craneId), battle: [...p.battle, self] }));
  if (!zoneOfField(next, crane.rushedOwner, crane.rushedInstanceId)) return { state: proceed(next, after), log };
  if (pending.rk10Meta?.preRush) {
    // 強制の効果の前に開いた窓: そのユニット自身の「ラッシュしたとき」は無効にして、ほかのカードのラッシュの処理を続けてからバトルする。
    next = runRk10OnRush(next, crane.rushedOwner, crane.rushedInstanceId, pending.phasePlayerId, true);
    if (!zoneOfField(next, crane.rushedOwner, crane.rushedInstanceId) || !zoneOfField(next, playerId, self.instanceId)) return { state: proceed(next, after), log };
  }
  return { state: effectBattle(next, after, playerId, self.instanceId, crane.rushedOwner, crane.rushedInstanceId), log };
};

/** rules/onRushUnitEffects.ts が登録する、ラッシュしたときの効果の実行（クレインの窓を見送った後の続き）。 */
// 循環 import（onRushUnitEffects → rk10UnitEffects）の初期化順で TDZ にならないよう var にする。
// eslint-disable-next-line no-var
var onRushRunner: ((state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, suppressSelf: boolean) => GameState) | undefined;
export function setRk10OnRushRunner(fn: (state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, suppressSelf: boolean) => GameState): void {
  onRushRunner = fn;
}
/** ラッシュしたときの処理を続ける。suppressSelf ならそのユニット自身の「ラッシュしたとき」は無効（クレインを出したとき）。 */
export function runRk10OnRush(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, suppressSelf = false): GameState {
  return onRushRunner ? onRushRunner(state, ownerId, instanceId, phasePlayerId, suppressSelf) : state;
}

// ---------------------------------------------------------------------------
// RK-209 エラスモテリウムオルフェノク【檻から放たれた脅威】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアのSユニットをすべてホールドしてもよい。そうしたとき、ホールドしたユニットの数以下の
//  必要パワーの数字を持つ敵軍ユニットをすべて撃破する。」（atwiki/page-929）。0体はホールドできない（コメント欄）。サイズもエリアも問わない（カード評価）。
//  ホールドする数は、リリース状態でホールドしたユニットの数。

export const ELASMO_EFFECT_ID = "rk209_unleashed";

function applyUnleashed(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk209:enemy_turn" };
  const own = state.players[ctx.playerId].battle.filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && !c.commandHeld);
  if (own.length === 0) return { state, detail: "rk209:no_units" };
  return { state: openOrQueue(state, confirmChoice(ctxBase(ctx), "RK-209", ELASMO_EFFECT_ID)), detail: ELASMO_EFFECT_ID };
}

CHOICE_RESOLVERS[ELASMO_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[ELASMO_EFFECT_ID] = simpleSkip();
CHOICE_CONFIRMERS[ELASMO_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const own = next.players[playerId].battle.filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && !c.commandHeld).map((c) => c.instanceId);
  next = setHeld(next, playerId, new Set(own));
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => {
      const n = costNumber(next, c.cardId);
      return Number.isFinite(n) && n <= own.length;
    })
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RK-209", `${ELASMO_EFFECT_ID}:${own.length}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: destroyAll(next, pending, "RK-209", "rk209_unleashed_destroy", ids, pending.resumeChoice), log };
};

// ---------------------------------------------------------------------------
// RK-210 仮面ライダーギャレンJF【バーニングショット】
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札を3枚選び、相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字が番号順
//  （例：0、1、2や3、4、5など）に揃うなら、敵軍Sユニットを1体選び撃破する。」（atwiki/page-1079）。RK-126【ギャレンラウザー】と同じ扱い
//  （ちょうど3枚。並べ替えて連続していれば揃う。手札が3枚未満なら発動しない）。撃破はエリアを問わない。

export const BURNING_SHOT_EFFECT_ID = "rk210_burning_shot";

function applyBurningShot(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "rk210:enemy_turn" };
  const hand = state.players[ctx.playerId].hand;
  if (hand.length < 3) return { state, detail: "rk210:hand_short" };
  return {
    state: openOrQueue(state, { ...base(ctxBase(ctx), "RK-210"), effectId: BURNING_SHOT_EFFECT_ID, kind: "select_hand", validInstanceIds: hand.map((c) => c.instanceId), selectCount: 3, optional: true }),
    detail: BURNING_SHOT_EFFECT_ID,
  };
}

function consecutiveCosts(costs: number[]): boolean {
  if (costs.some((n) => !Number.isFinite(n))) return false;
  const sorted = [...costs].sort((a, b) => a - b);
  return sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
}

CHOICE_RESOLVERS[BURNING_SHOT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 3) {
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)), optional: false } } };
  }
  const hand = state.players[playerId].hand;
  const shown = selected.map((id) => hand.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
  const lined = consecutiveCosts(shown.map((c) => costNumber(state, c.cardId)));
  const log = logFor(state, playerId, "RK-210", `${BURNING_SHOT_EFFECT_ID}:${shown.map((c) => cardName(state.definitions, c.cardId)).join(",")}`);
  const cleared = close(state, pending);
  if (!lined) return { state: proceed(cleared, pending), log };
  const enemyId = opponent(playerId);
  const ids = fieldUnits(cleared, enemyId)
    .filter((c) => rk1IsSmallNow(cleared, c) && selectableEnemy(cleared, playerId, "RK-210", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, { ...pending, effectId: "rk210_burning_shot_destroy", kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: false, unitDestination: "discard" }),
    log,
  };
};
CHOICE_SKIPPERS[BURNING_SHOT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK10_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-190::fog_mother": applyFogMother,
  "RK-191::garai_sword": applyGaraiSword,
  "RK-192::agito_fang": applyAgitoFang,
  "RK-193::balm_needle": applyBalmNeedle,
  "RK-194::gx05": applyGx05,
  "RK-196::yomi_no_abumi": applyYomiNoAbumi,
  "RK-198::opponent_draw": applyImpererDraw,
  "RK-200::herd_raid": applyHerdRaid,
  "RK-201::drag_breath": applyDragBreath,
  "RK-205::flying_attacker": applyFlyingAttacker,
  "RK-207::sorrow_despair": applySorrowDespair,
  "RK-209::unleashed": applyUnleashed,
  "RK-210::burning_shot": applyBurningShot,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-194::g3x_protect": noop("rk194:field"),
  "RK-195::reboot": noop("rk195:after_action"),
  "RK-196::entry_gate": noop("rk196:restriction"),
  "RK-197::queen_servant": noop("rk197:field"),
  "RK-198::drive_divider": noop("rk198:combo"),
  "RK-199::zeru_command": noop("rk199:field"),
  "RK-203::accel_mode": noop("rk203:attack_win"),
  "RK-204::ogre_strash": noop("rk204:after_damage"),
  "RK-205::return_hand": noop("rk205:turn_end"),
  "RK-206::unwanted_fight": noop("rk206:field"),
  "RK-208::crane_arrow": noop("rk208:enemy_rush"),
};

export function tryRk10CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK10_KEYWORD_PREFIX)) return null;
  const handler = RK10_KEYWORDS[keyword.slice(RK10_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
