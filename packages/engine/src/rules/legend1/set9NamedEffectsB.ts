/**
 * 第9弾「蒼九の翼」（legend1）RS-627〜RS-647 のカード固有の名前付き効果と継続効果（cardSpec RS9-627-647 の監査）。
 *
 * - `trySet9BCardEffect`: DSL の grant_keyword から呼ばれる起点（`set9b::cardId::name`）。
 * - `tryResolveSet9BChoice` / `trySkipSet9BChoice` / `tryConfirmSet9BChoice`: このモジュールが開いた選択の解決。
 * - 継続効果（RS-645 の SP、RS-647 に重ねたユニットのレジスト）と applyAction の後処理
 *   （RS-628【メガキャプチャー】の誘発、RS-647 ピヨちゃんの後始末）。
 * 構成は rules/legend1/set8NamedEffectsD.ts と同じ。
 */
import type { CardInstance, DeferredDestroyTrigger, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, cardName, effectiveBp, getDefinition, isLargeUnit, unitSizeOf } from "../../core/catalog";
import { opponent, updatePlayer } from "../../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { bounceToHand } from "../bounce";
import { startEffectRush } from "../effectRush";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { parseEnemyTargetZone, parseEnemyUnitFilter, startGenericEnemyUnitChoice } from "../rs/rsCatchallChoices";
import { isSmallUnitNow, turnPlayerOf } from "./set6NamedEffectsB";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
type ChoiceConfirmer = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceConfirmer> = {};
const CHOICE_CAN_CONFIRM: Record<string, (pending: PendingEffectChoice) => boolean> = {};

export function isSet9BChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet9BChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet9BChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 複数選んで確定する選択で、いま確定できるか（合法手 confirm_effect_choice）。 */
export function canConfirmSet9BChoice(pending: PendingEffectChoice): boolean {
  const check = CHOICE_CAN_CONFIRM[pending.effectId];
  return !!check && check(pending);
}

/** 複数選んだ選択を確定する（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet9BChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  if (!confirmer) return CHOICE_RESOLVERS[pending.effectId] ? { error: "not_confirmable" } : null;
  if (!canConfirmSet9BChoice(pending)) return { error: "not_confirmable" };
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

/** 「そうしたとき、…」の続きの選択を開く（先の処理で選択・離場の応答が開いていれば、その後）。 */
function openAfter(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: choice };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
  }
  return openEffectChoice(state, choice);
}

/** 選択を開く。別の選択が開いていれば、その後に開く。 */
function openOrQueue(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  return openEffectChoice(state, choice);
}

function simpleSkip(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, cardId, pending.effectId) };
  };
}

function choiceBase(ctx: { playerId: PlayerId; phasePlayerId: PlayerId }, sourceCardId: string, sourceInstanceId?: string) {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId,
    sourceInstanceId,
    selectedInstanceIds: [] as string[],
  };
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

/** 「自軍ターン中、これがバトルエリアに出たとき」の自軍ターンか。 */
function ownTurn(state: GameState, ctx: GrantKeywordContext): boolean {
  return turnPlayerOf(state) === ctx.playerId;
}

// ---------------------------------------------------------------------------
// RS-628 メガピンク【メガキャプチャー】（NC）
// 「このターン、次に自軍コマンドゾーンにカードが置かれたとき、相手は自分自身のコマンドを1つ選び手札に戻す。」（atwiki/page-1432）
// NC で「次に置かれたとき」の待ちを立て（ターン限り）、applyAction の後処理で自軍コマンドゾーンに新しく置かれたカードを見つけたら
// 誘発する（1回だけ）。処理中の選択・応答があれば、それらを終えてから相手の選択を開く。

const MEGA_CAPTURE_WAIT = "set9b_mega_capture_wait::";
const MEGA_CAPTURE_FIRED = "set9b_mega_capture_fired::";
export const MEGA_CAPTURE_EFFECT_ID = "rs628_mega_capture";

type MegaCapturePayload = { commandIds: string[] };

function applyMegaCapture(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const key = `${MEGA_CAPTURE_WAIT}${ctx.triggerSourceInstanceId ?? "RS-628"}:${state.turn ?? 0}`;
  const payload: MegaCapturePayload = { commandIds: state.players[ctx.playerId].command.map((c) => c.instanceId) };
  const player = addTurnRuleModifier(state.players[ctx.playerId], key, { sourceCardId: "RS-628", payload });
  return { state: { ...state, ...updatePlayer(state, ctx.playerId, player) }, detail: MEGA_CAPTURE_EFFECT_ID };
}

function renameModifiers(player: PlayerState, from: string, to: string): PlayerState {
  const modifiers = getPlayerModifiers(player).map((m) =>
    m.kind === "rule" && m.ruleId.startsWith(from) ? { ...m, ruleId: `${to}${m.ruleId.slice(from.length)}` } : m,
  );
  return { ...player, modifiers };
}

/** applyAction の後処理: 自軍コマンドゾーンにカードが置かれたら、待っている【メガキャプチャー】を誘発させる。 */
export function queueMegaCapture(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const waits = getPlayerModifiers(next.players[pid]).filter(
      (m) => m.kind === "rule" && m.scope === "turn" && m.ruleId.startsWith(MEGA_CAPTURE_WAIT),
    );
    if (waits.length === 0) continue;
    const now = next.players[pid].command;
    const beforeIds = new Set(before.players[pid].command.map((c) => c.instanceId));
    let fired = false;
    for (const wait of waits) {
      if (wait.kind !== "rule") continue;
      const existedBefore = getPlayerModifiers(before.players[pid]).some((m) => m.kind === "rule" && m.ruleId === wait.ruleId);
      const baseline = existedBefore ? beforeIds : new Set((wait.payload as MegaCapturePayload | undefined)?.commandIds ?? []);
      if (now.some((c) => !baseline.has(c.instanceId))) fired = true;
    }
    if (!fired) continue;
    next = { ...next, ...updatePlayer(next, pid, renameModifiers(next.players[pid], MEGA_CAPTURE_WAIT, MEGA_CAPTURE_FIRED)) };
  }
  return next;
}

function megaCaptureBlocked(state: GameState): boolean {
  return !!(
    state.pendingEffectChoice ||
    state.pendingLeave ||
    state.pendingRegister ||
    state.pendingDamagePayment ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingEffectRush ||
    state.pendingRush ||
    state.pendingStrike ||
    state.pendingMorph ||
    state.winner
  );
}

/** 誘発した【メガキャプチャー】の相手の選択を（処理中のものがなければ）1つずつ開く。 */
export function openMegaCaptureIfReady(state: GameState): GameState {
  if (megaCaptureBlocked(state)) return state;
  for (const pid of ["player1", "player2"] as const) {
    const fired = getPlayerModifiers(state.players[pid]).find(
      (m) => m.kind === "rule" && m.ruleId.startsWith(MEGA_CAPTURE_FIRED),
    );
    if (!fired || fired.kind !== "rule") continue;
    const remaining = getPlayerModifiers(state.players[pid]).filter((m) => m !== fired);
    let next: GameState = {
      ...state,
      ...updatePlayer(state, pid, { ...state.players[pid], modifiers: remaining.length > 0 ? remaining : undefined }),
    };
    const enemyId = opponent(pid);
    const ids = next.players[enemyId].command.map((c) => c.instanceId);
    if (ids.length === 0) return openMegaCaptureIfReady(next);
    const source = fieldUnits(next, pid).find((c) => c.cardId === "RS-628");
    next = openEffectChoice(next, {
      ...choiceBase({ playerId: enemyId, phasePlayerId: turnPlayerOf(next) }, "RS-628", source?.instanceId),
      effectId: MEGA_CAPTURE_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    });
    return next;
  }
  return state;
}

CHOICE_RESOLVERS[MEGA_CAPTURE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const bounced = bounceToHand(close(state, pending), { playerId, instanceId, fromZone: "command" });
  const log = logFor(state, playerId, "RS-628", `${MEGA_CAPTURE_EFFECT_ID}:${cardName(state.definitions, state.players[playerId].command.find((c) => c.instanceId === instanceId)?.cardId ?? "")}`);
  return { state: proceed(bounced.state, pending), log };
};

// ---------------------------------------------------------------------------
// RS-631 メガブラック【サテライトサーチ】（NC）
// 「自軍コマンドが3つ以下なら、自軍山札の上から1枚ひいて自軍コマンドゾーンにホールド状態で置いてもよい。」（atwiki/page-1431）
// 「置く／置かない」の選択は、効果のユニット自身を選ぶと置く（RS-596【炎神剣】と同じ。山札の上は見せない）。

export const SATELLITE_SEARCH_EFFECT_ID = "rs631_satellite_search";

function applySatelliteSearch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  const player = state.players[ctx.playerId];
  if (!self) return { state, detail: `${SATELLITE_SEARCH_EFFECT_ID}:no_source` };
  if (player.command.length > 3) return { state, detail: `${SATELLITE_SEARCH_EFFECT_ID}:too_many_commands` };
  if (player.deck.length === 0) return { state, detail: `${SATELLITE_SEARCH_EFFECT_ID}:empty_deck` };
  return {
    state: openOrQueue(state, {
      ...choiceBase(ctx, "RS-631", self),
      effectId: SATELLITE_SEARCH_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [self],
      selectCount: 1,
      optional: true,
    }),
    detail: SATELLITE_SEARCH_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SATELLITE_SEARCH_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const top = next.players[playerId].deck[0];
  if (!top || next.players[playerId].command.length >= COMMAND_ZONE_MAX) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    deck: p.deck.slice(1),
    command: [...p.command, { ...stripForZone(top), commandHeld: true }],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-631", `${SATELLITE_SEARCH_EFFECT_ID}:placed`) };
};
CHOICE_SKIPPERS[SATELLITE_SEARCH_EFFECT_ID] = simpleSkip("RS-631");

// ---------------------------------------------------------------------------
// RS-634 ユガンデ【ダークサンダー】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドを1つ選びリリースしてもよい。そうしたとき、ホールド状態の敵軍Sユニットを
//  1体選び撃破する。」（atwiki/page-1463）— リリースできるのはホールド状態のコマンド。撃破は強制（候補があれば）。

export const DARK_THUNDER_EFFECT_ID = "rs634_dark_thunder";
export const DARK_THUNDER_DESTROY_EFFECT_ID = "rs634_dark_thunder_destroy";

function applyDarkThunder(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx)) return { state, detail: `${DARK_THUNDER_EFFECT_ID}:not_own_turn` };
  const ids = state.players[opponent(ctx.playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${DARK_THUNDER_EFFECT_ID}:no_held_command` };
  return {
    state: openOrQueue(state, {
      ...choiceBase(ctx, "RS-634", ctx.triggerSourceInstanceId),
      effectId: DARK_THUNDER_EFFECT_ID,
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: DARK_THUNDER_EFFECT_ID,
  };
}

function heldEnemySUnits(state: GameState, actorId: PlayerId): string[] {
  const enemyId = opponent(actorId);
  return fieldUnits(state, enemyId)
    .filter((c) => c.commandHeld && isUnitCard(state, c.cardId) && isSmallUnitNow(state, enemyId, c))
    .filter((c) => isSelectableByOpponentEffect(state, actorId, c.instanceId, "RS-634"))
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[DARK_THUNDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false, mothershipHold: false } : c)),
  }));
  const log = logFor(state, playerId, "RS-634", `${DARK_THUNDER_EFFECT_ID}:release`);
  const ids = heldEnemySUnits(next, playerId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openAfter(next, {
      ...choiceBase(pending, "RS-634", pending.sourceInstanceId),
      effectId: DARK_THUNDER_DESTROY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
      resumeChoice: pending.resumeChoice,
    }),
    log,
  };
};
CHOICE_SKIPPERS[DARK_THUNDER_EFFECT_ID] = simpleSkip("RS-634");

CHOICE_RESOLVERS[DARK_THUNDER_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return { state: proceed(leave.state, pending), log: logFor(state, playerId, "RS-634", `${DARK_THUNDER_DESTROY_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// RS-635〜RS-638 ネジレンジャー【ネジアロー】【ネジロッド】【ネジセイバー】【ネジトマホーク】（NC）
// 「特徴「X」を持つ敵軍Sユニットを1体選び、撃破してもよい。」— 候補は対象の表記どおり（エリアの指定なし＝両方。R-ZONE-03）。

const NEJI_BODY: Record<string, string> = {
  "RS-635": "特徴「ピンク」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
  "RS-636": "特徴「ブラック」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
  "RS-637": "特徴「レッド」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
  "RS-638": "特徴「ブルー」を持つ敵軍Sユニットを1体選び、撃破してもよい。",
};

function applyNejiDestroy(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const body = NEJI_BODY[cardId]!;
    const opened = startGenericEnemyUnitChoice(state, {
      playerId: ctx.playerId,
      effectId: ctx.effectId,
      sourceCardId: cardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      phasePlayerId: ctx.phasePlayerId,
      filter: { ...parseEnemyUnitFilter(body), zone: parseEnemyTargetZone(body) },
      destination: "discard",
      optional: true,
    });
    return opened ? { state: opened, detail: `${cardId}:neji_destroy` } : { state, detail: `${cardId}:neji_destroy:no_targets` };
  };
}

// ---------------------------------------------------------------------------
// RS-641 ギガバイタスSM【スクランブル】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが
//  SCユニットのカードだったなら、それを自軍ラッシュエリアに出す。ただし追加条件は満たすこと。出せなかったなら、オモテにした
//  カードは山札の下に戻す。」（atwiki/page-1465）— 効果で出す（R-RUSH-20/21。必要パワーは不要、追加条件は実行する）。

export const SCRAMBLE_EFFECT_ID = "rs641_scramble";

function applyScramble(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!ownTurn(state, ctx) || !self) return { state, detail: `${SCRAMBLE_EFFECT_ID}:not_own_turn` };
  if (state.players[ctx.playerId].deck.length === 0) return { state, detail: `${SCRAMBLE_EFFECT_ID}:empty_deck` };
  return {
    state: openOrQueue(state, {
      ...choiceBase(ctx, "RS-641", self),
      effectId: SCRAMBLE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [self],
      selectCount: 1,
      optional: true,
    }),
    detail: SCRAMBLE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SCRAMBLE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const top = next.players[playerId].deck[0];
  if (!top) return { state: proceed(next, pending) };
  const def = getDefinition(next.definitions, top.cardId);
  const isSc = def?.type === "unit" && def.size === "SC";
  let placed = false;
  // 追加条件（「特徴「母艦」を持つ自軍ユニットがある」等の状態も含む）は効果ラッシュの側で満たすか判定・実行する（R-RUSH-21。
  // rules/effectRush.ts planEffectRush）。出せなければ startEffectRush は state をそのまま返す。
  if (isSc) {
    const started = startEffectRush(next, {
      playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: SCRAMBLE_EFFECT_ID,
      sourceCardId: "RS-641",
      sourceInstanceId: pending.sourceInstanceId,
      fromZone: "deck",
      candidates: [top.instanceId],
      maxCount: 1,
      requireConditions: true,
      ignorePowerCost: true,
      mandatory: true,
    });
    placed = started !== next;
    next = started;
  }
  if (!placed) {
    next = patchPlayer(next, playerId, (p) => ({
      ...p,
      deck: [...p.deck.filter((c) => c.instanceId !== top.instanceId), stripForZone(top)],
    }));
  }
  const log = logFor(state, playerId, "RS-641", `${SCRAMBLE_EFFECT_ID}:${cardName(state.definitions, top.cardId)}:${placed ? "rush" : "deck_bottom"}`);
  if (next.pendingEffectChoice || next.pendingEffectRush) return { state: next, log };
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[SCRAMBLE_EFFECT_ID] = simpleSkip("RS-641");

// ---------------------------------------------------------------------------
// RS-642 ギガライノス【ギガンティスバスター】
// 「自軍ターン中、これがバトルエリアに出たとき、ホールド状態の敵軍ユニットを1体選び撃破してもよい。」（atwiki/page-1493）
// サイズ・エリアは問わない（R-TGT-01）。

function applyGigantisBuster(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx)) return { state, detail: "rs642_gigantis_buster:not_own_turn" };
  const opened = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: "RS-642",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter: { zone: "both", held: true },
    destination: "discard",
    optional: true,
  });
  return opened ? { state: opened, detail: "rs642_gigantis_buster" } : { state, detail: "rs642_gigantis_buster:no_targets" };
}

// ---------------------------------------------------------------------------
// RS-645 ビクトリーマーズ
// ※「これは敵軍常駐置き場のカード1枚につきSP+1される。」（atwiki/page-1492）
// 【マーズフレア】「自軍ターン中、これがバトルエリアに出たとき、相手は自分自身の常駐置き場からカードを1枚選び（ウラ向きのカードは
//  ウラ向きのまま選ぶ）、自分自身のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（強制。R-ZONE-08）

/** SP の継続効果（rules/legend3/fieldEffects.ts から呼ぶ）。 */
export function set9BEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (instance.cardId !== "RS-645") return sp;
  if (!fieldUnits(state, playerId).some((c) => c.instanceId === instance.instanceId)) return sp;
  return sp + state.players[opponent(playerId)].operation.length;
}

export const MARS_FLARE_EFFECT_ID = "rs645_mars_flare";

function applyMarsFlare(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx)) return { state, detail: `${MARS_FLARE_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].operation.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${MARS_FLARE_EFFECT_ID}:no_resident` };
  return {
    state: openOrQueue(state, {
      ...choiceBase({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId }, "RS-645", ctx.triggerSourceInstanceId),
      effectId: MARS_FLARE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: MARS_FLARE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[MARS_FLARE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].operation.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const toCommand = state.players[playerId].command.length < COMMAND_ZONE_MAX;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    operation: p.operation.filter((c) => c.instanceId !== instanceId),
    ...(toCommand
      ? { command: [...p.command, { ...stripForZone(card), commandHeld: true }] }
      : { discard: [...p.discard, stripForZone(card)] }),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-645", `${MARS_FLARE_EFFECT_ID}:${toCommand ? "command" : "discard"}`) };
};

// ---------------------------------------------------------------------------
// RS-646 マーズマシン
// ※「これが撃破されて捨札になったとき、自軍捨札からSユニットのカードを5枚まで選び手札に加えてもよい。」（atwiki/page-1468）
// 選んでから確定（confirm_effect_choice）でまとめて手札に加える。5枚選ぶと確定する。見送れば加えない。

export const MARS_RECOVER_EFFECT_ID = "rs646_mars_recover";
const MARS_RECOVER_MAX = 5;

function applyMarsRecover(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].discard
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && unitSizeOf(state.definitions, c) === "S";
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${MARS_RECOVER_EFFECT_ID}:no_targets` };
  return {
    state: openOrQueue(state, {
      ...choiceBase(ctx, "RS-646", ctx.triggerSourceInstanceId),
      effectId: MARS_RECOVER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: Math.min(MARS_RECOVER_MAX, ids.length),
      optional: true,
    }),
    detail: MARS_RECOVER_EFFECT_ID,
  };
}

function finishMarsRecover(state: GameState, playerId: PlayerId, pending: PendingEffectChoice): ChoiceOutcome {
  const ids = pending.selectedInstanceIds ?? [];
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const picked = p.discard.filter((c) => ids.includes(c.instanceId));
    return {
      ...p,
      discard: p.discard.filter((c) => !ids.includes(c.instanceId)),
      hand: [...p.hand, ...picked.map(stripForZone)],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-646", `${MARS_RECOVER_EFFECT_ID}:${ids.length}`) };
}

CHOICE_RESOLVERS[MARS_RECOVER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const updated: PendingEffectChoice = {
    ...pending,
    selectedInstanceIds: selected,
    validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
  };
  if (selected.length >= MARS_RECOVER_MAX || updated.validInstanceIds.length === 0) {
    return finishMarsRecover({ ...state, pendingEffectChoice: updated }, playerId, updated);
  }
  return { state: { ...state, pendingEffectChoice: updated } };
};
CHOICE_SKIPPERS[MARS_RECOVER_EFFECT_ID] = simpleSkip("RS-646");
CHOICE_CAN_CONFIRM[MARS_RECOVER_EFFECT_ID] = (pending) => (pending.selectedInstanceIds ?? []).length > 0;
CHOICE_CONFIRMERS[MARS_RECOVER_EFFECT_ID] = (state, playerId) => finishMarsRecover(state, playerId, state.pendingEffectChoice!);

// ---------------------------------------------------------------------------
// RS-647 ピヨちゃん【ソウルバード】は同じ文言の RS-623【翼合体】・RS-650 等と共通の処理（rules/stackOntoLargeUnit.ts）。
// 重ねたユニットのレジストは rules/resist.ts、重ねたユニットが場を離れたときの捨札は settleStackOntoLargeCards。

// ---------------------------------------------------------------------------
// DSL の grant_keyword から呼ばれる起点

export const SET9B_KEYWORD_PREFIX = "set9b::";

const SET9B_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "RS-628::mega_capture": applyMegaCapture,
  "RS-631::satellite_search": applySatelliteSearch,
  "RS-634::dark_thunder": applyDarkThunder,
  "RS-635::neji_destroy": applyNejiDestroy("RS-635"),
  "RS-636::neji_destroy": applyNejiDestroy("RS-636"),
  "RS-637::neji_destroy": applyNejiDestroy("RS-637"),
  "RS-638::neji_destroy": applyNejiDestroy("RS-638"),
  "RS-641::scramble": applyScramble,
  "RS-642::gigantis_buster": applyGigantisBuster,
  "RS-645::mars_flare": applyMarsFlare,
  "RS-646::mars_recover": applyMarsRecover,
  // 起動効果は rules/stackOntoLargeUnit.ts（rules/fieldActivatedAbilities.ts）から使う（ここでは何もしない）。
  "RS-647::soul_bird": (state) => ({ state, detail: "rs647_soul_bird" }),
};

export function trySet9BCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET9B_KEYWORD_PREFIX)) return null;
  const handler = SET9B_KEYWORDS[keyword.slice(SET9B_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールの選択の CPU の手（対象外なら null）。 */
export function pickSet9BCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  const confirm = actions.find((a) => a.type === "confirm_effect_choice");
  const picks = actions.filter((a): a is Extract<Action, { type: "resolve_effect_choice" }> => a.type === "resolve_effect_choice");
  if (picks.length === 0) return confirm ?? skip ?? null;
  const me = pending.playerId;
  const bpOf = (id: string): number => {
    for (const pid of ["player1", "player2"] as const) {
      const card = fieldUnits(state, pid).find((c) => c.instanceId === id);
      if (card) return effectiveBp(state, pid, card);
    }
    return 0;
  };
  const highest = () => [...picks].sort((a, b) => bpOf(b.instanceId) - bpOf(a.instanceId))[0]!;
  switch (pending.effectId) {
    case MEGA_CAPTURE_EFFECT_ID: {
      // 自分のコマンドを手札に戻す側: ホールド状態のコマンド（このターンもう使えない）を優先する。
      const held = picks.find((a) => state.players[me].command.find((c) => c.instanceId === a.instanceId)?.commandHeld);
      return held ?? picks[0]!;
    }
    case DARK_THUNDER_EFFECT_ID:
      // ホールド状態の敵軍 S ユニットを撃破できるときだけリリースする。
      return heldEnemySUnits(state, me).length > 0 ? picks[0]! : (skip ?? picks[0]!);
    case DARK_THUNDER_DESTROY_EFFECT_ID:
      return highest();
    default:
      // 山札の上を置く・オモテにする・捨札から回収する等、行って損のない効果は行う。
      return picks[0]!;
  }
}
