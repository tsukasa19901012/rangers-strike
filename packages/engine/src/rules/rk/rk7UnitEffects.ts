/**
 * ザ・マスクドライダーEXP vol.2 RK-127〜RK-147（仮面ライダーカリス〜デンライナーイスルギ）のカード固有の効果（cardSpec RK7-127-147 の監査）。
 *
 * - `tryRk7CardEffect`: DSL の grant_keyword から呼ばれる起点（`rk7::cardId::name`。RC・ラッシュしたとき・撃破されたとき・NC・ストライクしたとき）。
 * - `tryResolveRk7Choice` / `trySkipRk7Choice` / `tryConfirmRk7Choice`: このモジュールが開いた選択の解決。撃破・パワーに送る選択は
 *   汎用の選択（unitDestination）で解決する（rules/pendingChoices.ts）。
 * - `openRk7RengelSubstitute`: RK-128 の※（撃破されて捨札になるとき、かわりに DA の S ユニットを捨札にする。rules/operationCounters.ts tryLeaveField から呼ぶ）。
 * - `openRk7LocustReplace`: RK-130【スペード5－キック】（core/applyAction.ts のラッシュの手続きから呼ぶ）。`applyRk7OnStrike` は得た能力（ストライクしたとき）。
 * - `applyRk7AfterAction`: RK-129【サンダースペイダー】（手札から捨札に置かれたとき）・RK-132【妻子のバックアップ】（敵軍山札がシャッフルされたとき）。
 *   core/applyAction.ts の後処理から呼び、進行中の処理があれば待ってから開く。
 * - `rk7RiderKickEnabled`: RK-134【ライダーキック】は RC を発動したターンだけ有効（rules/namedUnitEffects.ts・rules/legend2/battleEffects.ts から呼ぶ）。
 * 構成は rules/rk/rk6UnitEffects.ts と同じ。
 */
import { isSameCardIdentity, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId, PlayerState } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { deckShuffledSince } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { markRushedThisTurn } from "../turnModifiers";
import { canMoveUnitToBattle } from "../restrictions";
import { finalizeLeaveReaction, tryLeaveField } from "../operationCounters";
import { emitUnitRushedAndFinalize } from "../../events/emitUnitRushed";
import { rk1IsSmallNow, rk1ZoneCardFeatures } from "./rk1Features";
import { recordReveal, revealedCards } from "../revealNotice";

// ---------------------------------------------------------------------------
// 共通

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export const RK7_KEYWORD_PREFIX = "rk7::";

export function isRk7ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveRk7Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipRk7Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 選んだところで確定できる選択か（「行う」の確認）。 */
export function canConfirmRk7Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in CHOICE_CONFIRMERS)) return false;
  return pending.kind === "confirm";
}

/** 確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmRk7Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmRk7Choice(pending)) return { error: "no_selection" };
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

/** 撃破の処理中に開く選択（「撃破されて捨札になったとき」）。rk6UnitEffects の openInterrupt と同じ扱い。 */
function openInterrupt(state: GameState, choice: PendingEffectChoice): GameState {
  const existing = state.pendingEffectChoice;
  if (existing && (isRk7ChoiceEffect(existing.effectId) || existing.effectId === "to_power_on_destroy")) return openOrQueue(state, choice);
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

function turnPayloads<T>(player: PlayerState, ruleId: string): T[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => p !== undefined && p !== null);
}

function addTurnPayload(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: unknown): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

/** 手札から3枚ちょうど選ぶ選択（RK-125・RK-126 と同じ。手札が3枚未満なら開かない）。 */
function openShowThree(state: GameState, ctx: GrantKeywordContext, sourceCardId: string, effectId: string): GrantKeywordResult {
  const hand = state.players[ctx.playerId].hand;
  if (hand.length < 3) return { state, detail: `${effectId}:hand_short` };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), sourceCardId),
      effectId,
      kind: "select_hand",
      validInstanceIds: hand.map((c) => c.instanceId),
      selectCount: 3,
      optional: true,
    }),
    detail: effectId,
  };
}

/** 3枚目を選ぶまでは選択を続ける（2枚目からは見送れない）。3枚選んだら見せたカードを返す。 */
function pickShown(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; shown?: CardInstance[] } {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 3) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)), optional: false } },
    };
  }
  const hand = state.players[playerId].hand;
  return { state, shown: selected.map((id) => hand.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c) };
}

// ---------------------------------------------------------------------------
// RK-127 仮面ライダーカリス【カリスアロー】（RC）
// 「自分の手札を3枚選び、相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字がすべて同じなら、敵軍コマンドゾーンから
//  ホールド状態のカードを1枚選び捨札にする。」（atwiki/page-648）。手札はちょうど3枚選ぶ（RK-125 の読み替えと同じ書き方）。
// ※（相手の手札1枚につき BP+2000）は rules/rkFieldPassives.ts の文言の解析で数える。

export const CHALICE_ARROW_EFFECT_ID = "rk127_chalice_arrow";
export const CHALICE_ARROW_TARGET_EFFECT_ID = "rk127_chalice_arrow_target";

CHOICE_RESOLVERS[CHALICE_ARROW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const picked = pickShown(state, playerId, instanceId);
  if (!picked.shown) return { state: picked.state };
  const costs = picked.shown.map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost));
  const same = costs.every((n) => Number.isFinite(n) && n === costs[0]);
  const log = logFor(state, playerId, "RK-127", `${CHALICE_ARROW_EFFECT_ID}:${picked.shown.map((c) => cardName(state.definitions, c.cardId)).join(",")}`);
  const cleared = close(state, pending);
  const ids = cleared.players[opponent(playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (!same || ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, {
      ...pending,
      effectId: CHALICE_ARROW_TARGET_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
    }),
    log,
  };
};
CHOICE_SKIPPERS[CHALICE_ARROW_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[CHALICE_ARROW_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-127", `${CHALICE_ARROW_TARGET_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-128 仮面ライダーレンゲル
// ※「これが撃破されて捨札になるとき、かわりにダークアライアンスを持つ自軍Sユニットを1体選び捨札にしてもよい。」
//   撃破による離場（tryLeaveField）の前に、かわりに捨札にするユニット（エリアを問わない。これ以外）を選ぶ（見送れば通常どおり撃破される）。
//   RS-303【シティガーディアンズ隊長】と同じ扱い（このユニットは場に留まり、撃破された事実は残る）。
// 【レンゲルラウザー】（RC）「自分の手札を3枚選び、相手に見せてもよい。そうしたとき、見せたカードがすべて、BPの下三桁が500の追加条件を持たない
//   ユニットカードなら、そのカードをすべて自軍ラッシュエリアに出す。」（atwiki/page-649）。手札はちょうど3枚（コメント欄「必ず3枚」）。

export const RENGEL_SUBSTITUTE_EFFECT_ID = "rk128_rengel_substitute";
export const RENGEL_ROUZER_EFFECT_ID = "rk128_rengel_rouzer";
/** RK-286 仮面ライダーオーディンの※（RK-128 と同じ手続き。選択の案内を分けるため別の ID）。 */
export const ODIN_SUBSTITUTE_EFFECT_ID = "rk286_odin_substitute";

// RK-286 仮面ライダーオーディンの※「これが撃破されて捨札になるとき、かわりに自軍ラッシュエリアにある特徴「男」を持つユニット1体を捨札にすれば、
// これはその場に留まる。」（atwiki/page-1276）も同じ手続き（選ぶのは自軍ラッシュエリアの「男」のユニット。サイズを問わない）。
// XG4-085 仮面ライダー幽汽SF の※「これが撃破されて捨札になるとき、かわりに特徴「男」を持つ自軍ユニット1体を捨札にすれば、これはその場にとどまる。」
// （atwiki/page-2151）も同じ手続き（選ぶのは自軍の場の「男」のユニット。エリア・サイズを問わない。これ以外）。
const SUBSTITUTE_CARD_IDS = ["RK-128", "RK-286", "XG4-085"];

function substituteCardOf(cardId: string): string | undefined {
  return SUBSTITUTE_CARD_IDS.find((id) => isSameCardIdentity(cardId, id));
}

function rengelSubstituteIds(state: GameState, ownerId: PlayerId, selfId: string, sourceCardId = "RK-128"): string[] {
  if (sourceCardId === "XG4-085") {
    return fieldUnits(state, ownerId)
      .filter((c) => c.instanceId !== selfId && isUnitCard(state, c.cardId) && unitFeatures(state, ownerId, c).includes("男"))
      .map((c) => c.instanceId);
  }
  if (sourceCardId === "RK-286") {
    return state.players[ownerId].rush
      .filter((c) => c.instanceId !== selfId && isUnitCard(state, c.cardId) && unitFeatures(state, ownerId, c).includes("男"))
      .map((c) => c.instanceId);
  }
  return fieldUnits(state, ownerId)
    .filter((c) => {
      if (c.instanceId === selfId || !rk1IsSmallNow(state, c)) return false;
      const zone = state.players[ownerId].battle.some((x) => x.instanceId === c.instanceId) ? "battle" : "rush";
      return unitEffectiveCategories(state, ownerId, c, zone).includes("DA");
    })
    .map((c) => c.instanceId);
}

export function openRk7RengelSubstitute(state: GameState, intent: PendingLeave): GameState | null {
  const sourceCardId = substituteCardOf(intent.leavingCardId);
  if (intent.rk7SubstituteDeclined || !sourceCardId) return null;
  if (intent.toZone !== "discard" || intent.notDestruction) return null;
  if (state.pendingEffectChoice) return null;
  const ids = rengelSubstituteIds(state, intent.ownerPlayerId, intent.instanceId, sourceCardId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    ...base({ playerId: intent.ownerPlayerId, phasePlayerId: intent.phasePlayerId, sourceInstanceId: intent.instanceId }, sourceCardId),
    effectId: sourceCardId === "RK-128" ? RENGEL_SUBSTITUTE_EFFECT_ID : ODIN_SUBSTITUTE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    rk7Meta: { intent },
  });
}

CHOICE_RESOLVERS[RENGEL_SUBSTITUTE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.rk7Meta?.intent;
  if (!intent) return { error: "invalid_target" };
  // レンゲルはその場に留まり（撃破された事実は残る。R-DESTROY-02）、選んだユニットを捨札にする（撃破ではない）。
  let next = finalizeLeaveReaction({ ...close(state, pending), pendingLeave: intent }, intent, true);
  const moved = fieldCards(next, playerId).find((c) => c.instanceId === instanceId);
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => c.instanceId !== instanceId),
    rush: p.rush.filter((c) => c.instanceId !== instanceId),
    discard: moved ? [...p.discard, stripForZone(moved), ...(moved.stackedCards ?? []).map(stripForZone)] : p.discard,
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${RENGEL_SUBSTITUTE_EFFECT_ID}:${cardName(state.definitions, moved?.cardId ?? "")}`) };
};
CHOICE_SKIPPERS[RENGEL_SUBSTITUTE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.rk7Meta?.intent;
  const cleared = close(state, pending);
  if (!intent) return { state: cleared };
  const left = tryLeaveField(cleared, { ...intent, rk7SubstituteDeclined: true });
  return { state: left.deferred ? left.state : proceed(left.state, pending), log: skipLog(state, playerId, pending.sourceCardId, RENGEL_SUBSTITUTE_EFFECT_ID) };
};

CHOICE_RESOLVERS[ODIN_SUBSTITUTE_EFFECT_ID] = CHOICE_RESOLVERS[RENGEL_SUBSTITUTE_EFFECT_ID]!;
CHOICE_SKIPPERS[ODIN_SUBSTITUTE_EFFECT_ID] = CHOICE_SKIPPERS[RENGEL_SUBSTITUTE_EFFECT_ID]!;

function isRengelRouzerCard(state: GameState, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit" || typeof def.bp !== "number") return false;
  if (def.bp % 1000 !== 500) return false;
  return !resolveRushAdditionalCondition(card.cardId, def as never);
}

CHOICE_RESOLVERS[RENGEL_ROUZER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const picked = pickShown(state, playerId, instanceId);
  if (!picked.shown) return { state: picked.state };
  const shown = picked.shown;
  const log = logFor(state, playerId, "RK-128", `${RENGEL_ROUZER_EFFECT_ID}:${shown.map((c) => cardName(state.definitions, c.cardId)).join(",")}`);
  let next = close(state, pending);
  if (shown.every((c) => isRengelRouzerCard(state, c))) {
    const ids = new Set(shown.map((c) => c.instanceId));
    next = patchPlayer(next, playerId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => !ids.has(c.instanceId)),
      rush: [...p.rush, ...shown.map(stripForZone)],
    }));
  }
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[RENGEL_ROUZER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-129 ブルースペイダー【サンダースペイダー】
// 「これにライドしたユニットがある間、自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒ホールド状態の敵軍ユニットを1体選び
//  撃破する。」（atwiki/page-617）。手札のオペレーションを使って捨札になったときも発動する（grnrngr/faq-rider-2 RK-129 Q）。
//  1枚につき1回。撃破するユニットはサイズ・エリアを問わない（カード評価）。発動は任意。
// RK-132 仮面ライダー闘鬼【妻子のバックアップ】
// 「これが自軍エリアにある間、敵軍山札がシャッフルされたとき、これがホールド状態ならリリースしてもよい。」（atwiki/page-685）
// どちらもアクションの後処理（applyRk7AfterAction）で発生を調べ、進行中の処理があれば待ってから開く（rk7PendingTriggers）。

export const THUNDER_SPADER_EFFECT_ID = "rk129_thunder_spader";
export const FAMILY_BACKUP_EFFECT_ID = "rk132_family_backup";

type Rk7Trigger = { kind: "rk129" | "rk132"; playerId: PlayerId; sourceInstanceId: string };

function riddenSpaders(state: GameState, playerId: PlayerId): CardInstance[] {
  const cards = fieldCards(state, playerId);
  return cards.filter((c) => isSameCardIdentity(c.cardId, "RK-129") && cards.some((u) => u.mountedOnInstanceId === c.instanceId));
}

function heldEnemyUnitIds(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => c.commandHeld && selectableEnemy(state, playerId, "RK-129", c))
    .map((c) => c.instanceId);
}

function rk7TriggerChoice(state: GameState, trigger: Rk7Trigger): PendingEffectChoice | null {
  if (trigger.kind === "rk129") {
    if (riddenSpaders(state, trigger.playerId).length === 0) return null;
    const ids = heldEnemyUnitIds(state, trigger.playerId);
    if (ids.length === 0) return null;
    return {
      ...base({ playerId: trigger.playerId, phasePlayerId: state.activePlayer, sourceInstanceId: trigger.sourceInstanceId }, "RK-129"),
      effectId: THUNDER_SPADER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "discard",
    };
  }
  const self = fieldCards(state, trigger.playerId).find((c) => c.instanceId === trigger.sourceInstanceId);
  if (!self?.commandHeld) return null;
  return confirmChoice({ playerId: trigger.playerId, phasePlayerId: state.activePlayer, sourceInstanceId: trigger.sourceInstanceId }, "RK-132", FAMILY_BACKUP_EFFECT_ID);
}

CHOICE_RESOLVERS[FAMILY_BACKUP_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[FAMILY_BACKUP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === selfId ? { ...c, commandHeld: false } : c)),
    rush: p.rush.map((c) => (c.instanceId === selfId ? { ...c, commandHeld: false } : c)),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-132", `${FAMILY_BACKUP_EFFECT_ID}:release`) };
};
CHOICE_SKIPPERS[FAMILY_BACKUP_EFFECT_ID] = simpleSkip();

/** 手札から捨札に置かれたカードの枚数（その場で捨札になったもの、使用中のオペレーションが捨札になったもの）。 */
function handToDiscardCount(before: GameState, after: GameState, playerId: PlayerId): number {
  const beforeHand = new Set(before.players[playerId].hand.map((c) => c.instanceId));
  const resolving = new Set((before.resolvingOperations ?? []).filter((e) => e.playerId === playerId).map((e) => e.card.instanceId));
  const beforeDiscard = new Set(before.players[playerId].discard.map((c) => c.instanceId));
  return after.players[playerId].discard.filter((c) => !beforeDiscard.has(c.instanceId) && (beforeHand.has(c.instanceId) || resolving.has(c.instanceId))).length;
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
    state.pendingScry
  );
}

/** applyAction の後処理（depth 0）: RK-129・RK-132 の発生を記録し、開ける状態なら開く。 */
export function applyRk7AfterAction(before: GameState, after: GameState, shuffleEpochAtStart: number): GameState {
  let queue = [...(after.rk7PendingTriggers ?? [])];
  for (const pid of ["player1", "player2"] as const) {
    const spaders = riddenSpaders(after, pid);
    if (spaders.length > 0) {
      const n = handToDiscardCount(before, after, pid);
      for (let i = 0; i < n; i++) queue.push({ kind: "rk129", playerId: pid, sourceInstanceId: spaders[0]!.instanceId });
    }
    if (deckShuffledSince(after, opponent(pid), shuffleEpochAtStart)) {
      for (const c of fieldCards(after, pid)) {
        if (isSameCardIdentity(c.cardId, "RK-132") && c.commandHeld) queue.push({ kind: "rk132", playerId: pid, sourceInstanceId: c.instanceId });
      }
    }
  }
  if (queue.length === 0) return after.rk7PendingTriggers ? { ...after, rk7PendingTriggers: undefined } : after;
  let next: GameState = after;
  if (hasOtherBlocking(next) || next.winner) return { ...next, rk7PendingTriggers: queue };
  // 1つ開く（残りはその後のアクションで開く）。開いている選択があれば、その前に割り込む（新しく発動した効果を先に解決する。atwiki/page-672 Q1）。
  while (queue.length > 0) {
    const trigger = queue.shift()!;
    const choice = rk7TriggerChoice(next, trigger);
    if (!choice) continue;
    const existing = next.pendingEffectChoice;
    next = existing
      ? { ...next, pendingEffectChoice: { ...choice, phasePlayerId: existing.phasePlayerId, resumeChoice: existing }, activePlayer: choice.playerId }
      : openEffectChoice(next, choice);
    break;
  }
  return { ...next, rk7PendingTriggers: queue.length > 0 ? queue : undefined };
}

// ---------------------------------------------------------------------------
// RK-130 ローカストアンデッド【スペード5－キック】
// 「自軍ラッシュフェイズ中、これをラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、
//  選んだユニットは次の能力を得る⇒ストライクしたとき、レジストを持つ敵軍Sユニットを1体選び、撃破する。」（atwiki/page-640）
// ラッシュの手続き（コマンドのホールド）を終えてから選ぶ（grnrngr/faq-rider-2 RK-130 Q）。見送ればふつうにラッシュする。

export const LOCUST_REPLACE_EFFECT_ID = "rk130_spade5_kick";
export const LOCUST_KICK_EFFECT_ID = "rk130_spade5_kick_strike";
const LOCUST_RULE = "rk130_spade5_kick";

function kamenRiderUnitIds(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => unitFeatures(state, playerId, c).includes("仮面ライダー"))
    .map((c) => c.instanceId);
}

/** ラッシュの手続きを終えたところ（カードはまだ手札）で、ラッシュするかわりに捨札にするかの選択を開く。対象外なら null。 */
export function openRk7LocustReplace(state: GameState, playerId: PlayerId, card: CardInstance): GameState | null {
  if (!isSameCardIdentity(card.cardId, "RK-130") || state.phase !== "rush" || state.activePlayer !== playerId) return null;
  const ids = kamenRiderUnitIds(state, playerId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "RK-130"),
    effectId: LOCUST_REPLACE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[LOCUST_REPLACE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const self = state.players[playerId].hand.find((c) => c.instanceId === selfId);
  let next = close(state, pending);
  if (self) next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== selfId), discard: [...p.discard, stripForZone(self)] }));
  next = addTurnPayload(next, playerId, LOCUST_RULE, "RK-130", { instanceId });
  const target = fieldCards(state, playerId).find((c) => c.instanceId === instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-130", `${LOCUST_REPLACE_EFFECT_ID}:${cardName(state.definitions, target?.cardId ?? "")}`) };
};
CHOICE_SKIPPERS[LOCUST_REPLACE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  const self = next.players[playerId].hand.find((c) => c.instanceId === selfId);
  if (!self) return { state: proceed(next, pending) };
  // ふつうにラッシュする（手続きは済んでいる）。
  next = patchPlayer(next, playerId, (p) => markRushedThisTurn({ ...p, hand: p.hand.filter((c) => c.instanceId !== selfId), rush: [...p.rush, self] }, self.instanceId));
  const rushed = emitUnitRushedAndFinalize(next, playerId, self.instanceId, playerId);
  next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs, buildLogEntry(playerId, "rush", self.cardId, state.definitions)] };
  return { state: next.pendingEffectChoice || next.pendingRush ? next : proceed(next, pending), log: skipLog(state, playerId, "RK-130", LOCUST_REPLACE_EFFECT_ID) };
};

/** ストライクしたとき（events/listeners/strikeDeclaredListener.ts から呼ぶ）: このターン【スペード5－キック】で選ばれたユニットなら選択を開く。 */
export function applyRk7OnStrike(state: GameState, playerId: PlayerId, striker: CardInstance): GameState {
  const granted = turnPayloads<{ instanceId: string }>(state.players[playerId], LOCUST_RULE).filter((p) => p.instanceId === striker.instanceId);
  let next = state;
  for (let i = 0; i < granted.length; i++) {
    const enemyId = opponent(playerId);
    const ids = fieldUnits(next, enemyId)
      .filter((c) => rk1IsSmallNow(next, c) && cardHasRegisterKeyword(next, c.cardId, enemyId) && selectableEnemy(next, playerId, "RK-130", c))
      .map((c) => c.instanceId);
    if (ids.length === 0) break;
    next = openOrQueue(next, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: striker.instanceId }, "RK-130"),
      effectId: LOCUST_KICK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      unitDestination: "discard",
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// RK-131 仮面ライダー剛鬼【音響打・豪腕無双】（NC）
// 「敵軍Lユニットを1体選び、自軍山札の上から7枚までオモテにしてもよい。そうしたとき、オモテにしたユニットカードのBPの合計が、選んだLユニットの
//  BP以上なら、選んだLユニットを撃破する。その後、オモテにしたカードはすべて捨札になる。」（atwiki/page-634）
// L ユニットはエリアを問わない（カード評価）。1枚ずつオモテにして好きなところで止められ、枚数は宣言しない（grnrngr/faq-rider-2 RK-131 Q1・Q2）。
// 合計が届いても7枚までは続けられる（コメント欄）。「確定」で1枚オモテにし、「見送り」で止める。オモテにしたカードは山札の上に置いたまま数える。

export const GOUKI_TARGET_EFFECT_ID = "rk131_gouki_target";
export const GOUKI_REVEAL_EFFECT_ID = "rk131_gouki_reveal";
const GOUKI_MAX = 7;

function isLargeNow(state: GameState, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return false;
  return unitSizeOf(state.definitions, card) === "L" || (unitSizeOf(state.definitions, card) === "S" && !rk1IsSmallNow(state, card));
}

function applyGouki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isLargeNow(state, c) && selectableEnemy(state, ctx.playerId, "RK-131", c))
    .map((c) => c.instanceId);
  if (ids.length === 0 || state.players[ctx.playerId].deck.length === 0) return { state, detail: "rk131:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-131"),
      effectId: GOUKI_TARGET_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: GOUKI_TARGET_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[GOUKI_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "RK-131", `${GOUKI_TARGET_EFFECT_ID}:${instanceId}`);
  return {
    state: openNext(close(state, pending), pending, {
      ...confirmChoice(pending, "RK-131", GOUKI_REVEAL_EFFECT_ID),
      rk7Meta: { targetInstanceId: instanceId, count: 0 },
    }),
    log,
  };
};
CHOICE_SKIPPERS[GOUKI_TARGET_EFFECT_ID] = simpleSkip();

function finishGouki(state: GameState, pending: PendingEffectChoice, count: number): GameState {
  const targetId = pending.rk7Meta?.targetInstanceId;
  const revealed = state.players[pending.playerId].deck.slice(0, count);
  const sum = revealed.reduce((n, c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return n + (def?.type === "unit" && typeof def.bp === "number" ? def.bp : 0);
  }, 0);
  const enemyId = opponent(pending.playerId);
  const target = targetId ? fieldUnits(state, enemyId).find((c) => c.instanceId === targetId) : undefined;
  let next = close(state, pending);
  if (target && count > 0 && sum >= effectiveBp(next, enemyId, target)) {
    const left = applyUnitLeave(next, target.instanceId, "discard", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  // その後、オモテにしたカードはすべて捨札になる。
  const ids = new Set(revealed.map((c) => c.instanceId));
  next = patchPlayer(next, pending.playerId, (p) => ({
    ...p,
    deck: p.deck.filter((c) => !ids.has(c.instanceId)),
    discard: [...p.discard, ...p.deck.filter((c) => ids.has(c.instanceId)).map(stripForZone)],
  }));
  return proceed(next, pending);
}

CHOICE_RESOLVERS[GOUKI_REVEAL_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[GOUKI_REVEAL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const deck = state.players[playerId].deck;
  const count = Math.min((pending.rk7Meta?.count ?? 0) + 1, deck.length);
  const revealed = deck[count - 1];
  const log = logFor(state, playerId, "RK-131", `${GOUKI_REVEAL_EFFECT_ID}:${cardName(state.definitions, revealed?.cardId ?? "")}`);
  // オモテにしたカード（ここまでの全部）は公開情報。最後にすべて捨札になる。
  const reveal = (s: GameState): GameState =>
    recordReveal(s, {
      playerId,
      ownerId: playerId,
      sourceCardId: pending.sourceCardId,
      effectLabel: "音響打・豪腕無双",
      from: "deck_top",
      cards: revealedCards(deck.slice(0, count), "discard"),
    });
  if (count >= GOUKI_MAX || count >= deck.length) return { state: reveal(finishGouki(state, pending, count)), log };
  return { state: reveal({ ...state, pendingEffectChoice: { ...pending, rk7Meta: { ...pending.rk7Meta, count } } }), log };
};
CHOICE_SKIPPERS[GOUKI_REVEAL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finishGouki(state, pending, pending.rk7Meta?.count ?? 0), log: skipLog(state, playerId, "RK-131", GOUKI_REVEAL_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RK-134 仮面ライダー2号（THE FIRST）【ライダーキック】（RC）
// 「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。さらに、このユニットがホールド状態なら、このターン、
//  これはBP+2000される。」（atwiki/page-662）。RC を発動したターンだけ、アタックするときの効果を持つ（RK-023【技の1号】と同じ扱い）。
// アタックするときの処理は共通の「ライダーキック」（rules/namedUnitEffects.ts・rules/legend2/battleEffects.ts）で、RK-134 はここで有効かを判定する。

const RIDER_KICK_RULE = "rk134_rider_kick";

function applyRiderKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "rk134:no_unit" };
  return { state: addTurnPayload(state, ctx.playerId, RIDER_KICK_RULE, "RK-134", { instanceId: id }), detail: RIDER_KICK_RULE };
}

/** 共通の「ライダーキック」（アタックするとき）がこのユニットで有効か。RK-134 は RC を発動したターンだけ。 */
export function rk7RiderKickEnabled(state: GameState, playerId: PlayerId, card: Pick<CardInstance, "cardId" | "instanceId">): boolean {
  if (!isSameCardIdentity(card.cardId, "RK-134")) return true;
  return turnPayloads<{ instanceId: string }>(state.players[playerId], RIDER_KICK_RULE).some((p) => p.instanceId === card.instanceId);
}

// ---------------------------------------------------------------------------
// RK-136 仮面ライダードレイクRF【ライダーシューティング】（ラッシュしたとき）
// 「自軍パワーゾーンのオモテ向きのカードを見て、その枚数以下の必要パワーの数値を持つ追加条件を持たない敵軍ユニットを1体選び、持ち主のパワーゾーンに
//  送ってもよい。」（atwiki/page-668）。エリア・サイズを問わない（カード評価）。枚数は追加条件で送ったドレイクMF を含む今の枚数。

export const RIDER_SHOOTING_EFFECT_ID = "rk136_rider_shooting";

function applyRiderShooting(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const limit = state.players[ctx.playerId].power.filter((c) => !c.faceDown).length;
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def || resolveRushAdditionalCondition(c.cardId, def as never)) return false;
      return parsePowerCost(def.powerCost) <= limit && selectableEnemy(state, ctx.playerId, "RK-136", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk136:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base(ctxBase(ctx), "RK-136"),
      effectId: RIDER_SHOOTING_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      unitDestination: "power",
    }),
    detail: RIDER_SHOOTING_EFFECT_ID,
  };
}

// ---------------------------------------------------------------------------
// RK-138 ウカワーム【不安定な擬態】（撃破されて捨札になったとき）
// 「相手は自分自身の捨札から特徴「女」を持つユニットカードを1枚選び、自分自身のラッシュエリアに出してもよい。相手がそうしなかったとき、自軍捨札から
//  「ウカワーム」以外の特徴「女」を持つユニットカードを1枚選び、自分の手札に戻してもよい。」（atwiki/page-639）

export const UKA_ENEMY_EFFECT_ID = "rk138_uka_enemy";
export const UKA_OWN_EFFECT_ID = "rk138_uka_own";

function womanDiscardIds(state: GameState, playerId: PlayerId, exceptName?: string): string[] {
  return state.players[playerId].discard
    .filter((c) => isUnitCard(state, c.cardId) && rk1ZoneCardFeatures(state, playerId, c.cardId).includes("女"))
    .filter((c) => !exceptName || cardName(state.definitions, c.cardId) !== exceptName)
    .map((c) => c.instanceId);
}

function ukaOwnChoice(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId, sourceInstanceId?: string): PendingEffectChoice | null {
  const ids = womanDiscardIds(state, ownerId, "ウカワーム");
  if (ids.length === 0) return null;
  return {
    ...base({ playerId: ownerId, phasePlayerId, sourceInstanceId }, "RK-138"),
    effectId: UKA_OWN_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  };
}

function applyUkaworm(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const owner = ctx.playerId;
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId || !state.players[owner].discard.some((c) => c.instanceId === selfId)) return { state, detail: "rk138:not_in_discard" };
  const enemyId = opponent(owner);
  const ids = womanDiscardIds(state, enemyId);
  if (ids.length > 0) {
    return {
      state: openInterrupt(state, {
        ...base({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: selfId }, "RK-138"),
        effectId: UKA_ENEMY_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
      }),
      detail: UKA_ENEMY_EFFECT_ID,
    };
  }
  const own = ukaOwnChoice(state, owner, ctx.phasePlayerId, selfId);
  return own ? { state: openInterrupt(state, own), detail: UKA_OWN_EFFECT_ID } : { state, detail: "rk138:no_targets" };
}

CHOICE_RESOLVERS[UKA_ENEMY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-138", `${UKA_ENEMY_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[UKA_ENEMY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const own = ukaOwnChoice(cleared, opponent(playerId), pending.phasePlayerId, pending.sourceInstanceId);
  return { state: own ? openNext(cleared, pending, own) : proceed(cleared, pending), log: skipLog(state, playerId, "RK-138", UKA_ENEMY_EFFECT_ID) };
};

CHOICE_RESOLVERS[UKA_OWN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-138", `${UKA_OWN_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};
CHOICE_SKIPPERS[UKA_OWN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// RK-139 仮面ライダーゼロノスAF【俺はかーなーり強い】（RC）
// 「相手は自分自身のラッシュエリアからユニットを1体選び、可能ならバトルエリアに出す。」（atwiki/page-670）
// 選ぶのは相手（必ず選ぶ）。バトルエリアに出られないユニットも選べ、そのときはラッシュエリアに残る（カード評価「キャッスルドランのような…
// うまく機能しなくなる」）。ライドしているユニットはビークルと一緒に出る。

export const ZERONOS_AF_EFFECT_ID = "rk139_zeronos_af";

function applyZeronosAf(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush.filter((c) => isUnitCard(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "rk139:no_targets" };
  return {
    state: openOrQueue(state, {
      ...base({ ...ctxBase(ctx), playerId: enemyId }, "RK-139"),
      effectId: ZERONOS_AF_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: ZERONOS_AF_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[ZERONOS_AF_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unit = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  let next = close(state, pending);
  if (canMoveUnitToBattle(next, playerId, unit)) {
    const group = new Set([unit.instanceId, ...(unit.mountedOnInstanceId ? [unit.mountedOnInstanceId] : [])]);
    next = patchPlayer(next, playerId, (p) => {
      const moving = p.rush.filter((c) => group.has(c.instanceId));
      // ビークル → ユニットの順に並べる。
      moving.sort((a, b) => (a.instanceId === unit.instanceId ? 1 : 0) - (b.instanceId === unit.instanceId ? 1 : 0));
      return { ...p, rush: p.rush.filter((c) => !group.has(c.instanceId)), battle: [...p.battle, ...moving] };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "RK-139", `${ZERONOS_AF_EFFECT_ID}:${cardName(state.definitions, unit.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RK-141 仮面ライダーゼロノスZF【デネビックバスター】（ストライクしたとき）
// 「次の効果を、自分が三回まで好きな回数行った後で、相手も同じ回数行う。自分自身の山札の上から1枚をオモテにする。そして、オモテにしたカードの必要パワーの
//  数値を見て、その数字と同じ必要パワーの数字を持つ自分自身のユニットがあれば、その中から1体選び撃破する。そうして撃破したなら、オモテにしたカードは
//  捨札になり、撃破しなかったら手札に加える。」（atwiki/page-669）
// - 自分は1回ごとに「行う（確定）／やめる（見送り）」を選ぶ。撃破するユニットは行った側が選ぶ（必ず選ぶ。エリア・サイズを問わない）。
// - ゼロノスZF 自身が撃破されても処理は続く（grnrngr/faq-rider-2 RK-141 Q）。

export const DENEBIC_STEP_EFFECT_ID = "rk141_denebic_step";
export const DENEBIC_DESTROY_EFFECT_ID = "rk141_denebic_destroy";
const DENEBIC_RESUME_EFFECT_ID = "rk141_denebic_resume";
const DENEBIC_MAX = 3;

function applyDenebicBuster(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return {
    state: openOrQueue(state, { ...confirmChoice(ctxBase(ctx), "RK-141", DENEBIC_STEP_EFFECT_ID), rk7Meta: { done: 0, owner: ctx.playerId } }),
    detail: DENEBIC_STEP_EFFECT_ID,
  };
}

/** 1回分を行う。撃破するユニットを選ぶなら選択を返す。 */
function denebicReveal(state: GameState, actorId: PlayerId, pending: PendingEffectChoice, meta: NonNullable<PendingEffectChoice["rk7Meta"]>): { state: GameState; choice?: PendingEffectChoice } {
  const top = state.players[actorId].deck[0];
  if (!top) return { state };
  const cost = parsePowerCost(getDefinition(state.definitions, top.cardId)?.powerCost);
  const ids = fieldUnits(state, actorId)
    .filter((c) => Number.isFinite(cost) && parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost) === cost)
    .map((c) => c.instanceId);
  // オモテにしたカードは公開情報。撃破する（必ず選ぶ）なら捨札、撃破しなかったら手札に加える。
  state = recordReveal(state, {
    playerId: actorId,
    ownerId: actorId,
    sourceCardId: "RK-141",
    effectLabel: "デネビックバスター",
    from: "deck_top",
    cards: revealedCards([top], ids.length > 0 ? "discard" : "hand"),
  });
  if (ids.length > 0) {
    return {
      state,
      choice: {
        ...base({ playerId: actorId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-141"),
        effectId: DENEBIC_DESTROY_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: false,
        rk7Meta: { ...meta, revealedId: top.instanceId },
        resumeChoice: pending.resumeChoice,
      },
    };
  }
  // 撃破しなかったら手札に加える。
  const next = patchPlayer(state, actorId, (p) => ({ ...p, deck: p.deck.slice(1), hand: [...p.hand, stripForZone(top)] }));
  return { state: next };
}

/** 続き: 自分（効果の持ち主）がまだ行えるなら「行う／やめる」を開き、終えたら相手が同じ回数行う。 */
function continueDenebic(state: GameState, pending: PendingEffectChoice, meta: NonNullable<PendingEffectChoice["rk7Meta"]>): GameState {
  const owner = meta.owner ?? pending.playerId;
  let m = { ...meta, owner };
  if (m.remaining === undefined) {
    if ((m.done ?? 0) < DENEBIC_MAX && state.players[owner].deck.length > 0) {
      return openEffectChoice(state, {
        ...confirmChoice({ playerId: owner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-141", DENEBIC_STEP_EFFECT_ID),
        rk7Meta: m,
        resumeChoice: pending.resumeChoice,
      });
    }
    m = { ...m, remaining: m.done ?? 0 };
  }
  const enemyId = opponent(owner);
  let next = state;
  while ((m.remaining ?? 0) > 0) {
    m = { ...m, remaining: (m.remaining ?? 0) - 1 };
    const r = denebicReveal(next, enemyId, pending, m);
    next = r.state;
    if (r.choice) return openEffectChoice(next, r.choice);
  }
  return proceed(next, pending);
}

CHOICE_RESOLVERS[DENEBIC_STEP_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[DENEBIC_STEP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const meta = { ...(pending.rk7Meta ?? {}), done: (pending.rk7Meta?.done ?? 0) + 1 };
  const cleared = close(state, pending);
  const r = denebicReveal(cleared, playerId, pending, meta);
  const log = logFor(state, playerId, "RK-141", `${DENEBIC_STEP_EFFECT_ID}:${meta.done}`);
  if (r.choice) return { state: openEffectChoice(r.state, r.choice), log };
  return { state: continueDenebic(r.state, pending, meta), log };
};
CHOICE_SKIPPERS[DENEBIC_STEP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const meta = { ...(pending.rk7Meta ?? {}), remaining: pending.rk7Meta?.done ?? 0 };
  return { state: continueDenebic(close(state, pending), pending, meta), log: skipLog(state, playerId, "RK-141", DENEBIC_STEP_EFFECT_ID) };
};

CHOICE_RESOLVERS[DENEBIC_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const meta = pending.rk7Meta ?? {};
  const revealedId = meta.revealedId;
  let next = close(state, pending);
  // オモテにしたカードは捨札になる（先に山札から移す）。
  next = patchPlayer(next, playerId, (p) => {
    const top = p.deck.find((c) => c.instanceId === revealedId);
    return top ? { ...p, deck: p.deck.filter((c) => c.instanceId !== revealedId), discard: [...p.discard, stripForZone(top)] } : p;
  });
  const left = applyUnitLeave(next, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  next = left.state;
  const log = logFor(state, playerId, "RK-141", `${DENEBIC_DESTROY_EFFECT_ID}:${instanceId}`);
  if (next.pendingEffectChoice || next.pendingLeave || next.pendingRegister) {
    // 撃破の処理に割り込みがあれば、その後で続きを確定して進める。
    const resume: PendingEffectChoice = {
      ...confirmChoice({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "RK-141", DENEBIC_RESUME_EFFECT_ID),
      optional: false,
      rk7Meta: meta,
      resumeChoice: pending.resumeChoice,
    };
    return { state: proceed(next, { ...pending, resumeChoice: resume }), log };
  }
  return { state: continueDenebic(next, pending, meta), log };
};

CHOICE_RESOLVERS[DENEBIC_RESUME_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[DENEBIC_RESUME_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const meta = pending.rk7Meta ?? {};
  return { state: continueDenebic(close(state, pending), pending, meta), log: logFor(state, playerId, "RK-141", DENEBIC_RESUME_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// 起点

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

const RK7_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RK-127::chalice_arrow": (state, ctx) => openShowThree(state, ctx, "RK-127", CHALICE_ARROW_EFFECT_ID),
  "RK-128::rengel_rouzer": (state, ctx) => openShowThree(state, ctx, "RK-128", RENGEL_ROUZER_EFFECT_ID),
  "RK-131::gouki": applyGouki,
  "RK-134::rider_kick": applyRiderKick,
  "RK-136::rider_shooting": applyRiderShooting,
  "RK-138::unstable_mimicry": applyUkaworm,
  "RK-139::kanari_tsuyoi": applyZeronosAf,
  "RK-141::denebic_buster": applyDenebicBuster,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
  "RK-128::substitute": noop("rk128:leave_substitute"),
  "RK-129::thunder_spader": noop("rk129:after_action"),
  "RK-130::spade5_kick": noop("rk130:rush_replace"),
  "RK-132::family_backup": noop("rk132:after_action"),
  "RK-134::rider_kick_attack": noop("rk134:on_attack"),
};

export function tryRk7CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(RK7_KEYWORD_PREFIX)) return null;
  const handler = RK7_KEYWORDS[keyword.slice(RK7_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}
