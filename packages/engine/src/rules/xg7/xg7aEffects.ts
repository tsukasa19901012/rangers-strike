/**
 * クロスギャザー ザ・ベストパートナー XG7-001〜XG7-023（ゴーカイピンク〜獣拳巨神サイダイオー）のカード固有の効果（cardSpec XG7-001-023 の監査）。
 * 選択・キーワードは rules/xg7/xg7Registry.ts に登録し、入口は rules/xg7/xg7Effects.ts。継続効果の判定は rules/xg7/xg7Fields.ts。
 * 選択の組み立ては rules/rm/rm1Effects.ts の部品（openAfter・close・proceed 等）を使う。
 */
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { crossValueForCard } from "../../keywords/battleKeywords";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { applyDamageToPlayer } from "../damagePayment";
import { recordReveal, revealedCards } from "../revealNotice";
import { finalizeLeaveReaction, resolveBattlePending, tryLeaveField } from "../operationCounters";
import { applyOnRushUnitEffects } from "../onRushUnitEffects";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  appendResume,
  base,
  categoriesOf,
  close,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  genericPick,
  isUnitCard,
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
  skipLog,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import {
  CHOICE_CONFIRMERS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  XG7_KEYWORDS,
  addFlag,
  costNumberOf,
  hasColorFeature,
  hasFlag,
  isCard,
  noop,
  printedFeatures,
  sharedFeatureCount,
} from "./xg7Registry";
import { gateReveal } from "../revealGate";

// ---------------------------------------------------------------------------
// 共通

export function selfUnit(state: GameState, ctx: GrantKeywordContext): CardInstance | undefined {
  const id = ctx.triggerSourceInstanceId;
  return id ? findField(state, ctx.playerId, id) : undefined;
}

export function boostBp(state: GameState, playerId: PlayerId, instanceId: string, amount: number): GameState {
  if (amount === 0) return state;
  return patchPlayer(state, playerId, (p) => {
    const add = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + amount } : c));
    return { ...p, battle: add(p.battle), rush: add(p.rush) };
  });
}

export function addTurnCross(state: GameState, playerId: PlayerId, instanceId: string, value: number): GameState {
  return patchPlayer(state, playerId, (p) => {
    const add = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === instanceId ? { ...c, xg7Turn: { ...c.xg7Turn, cross: (c.xg7Turn?.cross ?? 0) + value } } : c));
    return { ...p, battle: add(p.battle), rush: add(p.rush) };
  });
}

/** 場のユニットを持ち主の山札の上に戻す（離場の処理を通す）。 */
export function moveFieldUnitToDeckTop(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const moved = moveFieldUnit(state, ownerId, instanceId, phasePlayerId, "deck_bottom");
  return patchPlayer(moved, ownerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: [card, ...p.deck.filter((c) => c.instanceId !== instanceId)] };
  });
}

/** 選択（1つ）を開く。 */
export function selectOne(ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string }, cardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, cardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

/**
 * 「…まで選ぶ」複数の選択。1つ選ぶたびに候補を作りなおし、上限に達するか候補がなくなれば finish する。確定（confirm）・見送り（選んだ後）でも finish する。
 */
export function registerMultiPick(
  effectId: string,
  candidates: (state: GameState, pending: PendingEffectChoice, selected: string[]) => string[],
  finish: (state: GameState, pending: PendingEffectChoice, selected: string[]) => GameState,
): void {
  const done = (state: GameState, playerId: PlayerId, selected: string[]) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending, selected), log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${selected.length}`) };
  };
  CHOICE_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const limit = pending.xg7Meta?.limit ?? 1;
    const rest = candidates(state, pending, selected);
    if (selected.length >= limit || rest.length === 0) return done(state, playerId, selected);
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } } };
  };
  CHOICE_CONFIRMERS[effectId] = (state, playerId) => done(state, playerId, state.pendingEffectChoice!.selectedInstanceIds ?? []);
  CHOICE_SKIPPERS[effectId] = (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const selected = pending.selectedInstanceIds ?? [];
    if (selected.length > 0) return done(state, playerId, selected);
    return simpleSkip()(state, playerId);
  };
}

/** オモテ向きの自軍パワーのカード。 */
export function faceUpPower(state: GameState, playerId: PlayerId): CardInstance[] {
  return state.players[playerId].power.filter((c) => !c.faceDown);
}

// ---------------------------------------------------------------------------
// XG7-001〜XG7-005 ゴーカイジャーの※（ラッシュしたとき）
// 「※これをラッシュしたとき、「X」以外のオモテ向きの自軍パワーから、追加条件を持たない、特徴…を持つSユニットのカードを1枚選び、これと置き換えてもよい。」
// 置き換え（R-REPL-04）: 選んだカードはこれのいた位置・状態でラッシュエリアに出て（ラッシュに含まれる）、これはオモテ向きでそのカードのいた位置に入る。
// 出たカードの「ラッシュしたとき」・ほかのカードの「ラッシュされたとき」を処理する（rules/onRushUnitEffects.ts）。
// （旧 rules/noteOtherRushEffects.ts の自動の置き換えのかわり）

const GOKAI_SWAP_EFFECT_ID = "xg7_gokai_swap";
const GOKAI_COLORS: Record<string, string[]> = {
  "XG7-001": ["ピンク", "ホワイト"],
  "XG7-002": ["グリーン", "ブラック"],
  "XG7-003": ["レッド"],
  "XG7-004": ["ブルー"],
  "XG7-005": ["イエロー"],
};

function gokaiCandidates(state: GameState, playerId: PlayerId, selfCardId: string): string[] {
  const colors = Object.entries(GOKAI_COLORS).find(([id]) => isCard(selfCardId, id))?.[1] ?? [];
  const selfName = cardName(state.definitions, selfCardId);
  return faceUpPower(state, playerId)
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      if (!d || d.type !== "unit" || unitSizeOf(state.definitions, c) !== "S") return false;
      if (sameCardName(d.name, selfName)) return false;
      if (resolveRushAdditionalCondition(c.cardId, d)) return false;
      return (d.features ?? []).some((f) => colors.includes(f));
    })
    .map((c) => c.instanceId);
}

function applyGokaiSwap(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const self = selfUnit(state, ctx);
    if (!self || zoneOfField(state, ctx.playerId, self.instanceId) !== "rush") return { state, detail: "xg7_gokai_swap:not_in_rush" };
    const ids = gokaiCandidates(state, ctx.playerId, self.cardId);
    if (ids.length === 0) return { state, detail: "xg7_gokai_swap:no_targets" };
    return { state: openAfter(state, selectOne(ctxBase(ctx), cardId, GOKAI_SWAP_EFFECT_ID, ids, true)), detail: GOKAI_SWAP_EFFECT_ID };
  };
}

CHOICE_RESOLVERS[GOKAI_SWAP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const p = state.players[playerId];
  const self = p.rush.find((c) => c.instanceId === selfId);
  const target = p.power.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!self || !target) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (q) => ({
    ...q,
    rush: q.rush.map((c) => (c.instanceId === self.instanceId ? { instanceId: target.instanceId, cardId: target.cardId, ...(self.commandHeld ? { commandHeld: true } : {}) } : c)),
    power: q.power.map((c) => (c.instanceId === target.instanceId ? { instanceId: self.instanceId, cardId: self.cardId } : c)),
  }));
  const rushed = applyOnRushUnitEffects(next, playerId, target.instanceId, pending.phasePlayerId, "rush", { viaEffect: true, includePassiveRushTriggers: true });
  next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${GOKAI_SWAP_EFFECT_ID}:${cardName(state.definitions, target.cardId)}`) };
};
CHOICE_SKIPPERS[GOKAI_SWAP_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-001 ゴーカイピンク【レンジャーキー】（NC）
// 「自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが特徴に色を持つなら自軍パワーゾーンに置き、それ以外なら山札の下に戻す。」
// 山札の上のカードを選ぶ（＝オモテにする）。パワーゾーンにはオモテ向きで置く。

const RANGER_KEY_EFFECT_ID = "xg7001_ranger_key";

function applyRangerKey(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const top = state.players[ctx.playerId].deck[0];
  if (!top) return { state, detail: "xg7001:no_deck" };
  return { state: openAfter(state, gateReveal(selectOne(ctxBase(ctx), "XG7-001", RANGER_KEY_EFFECT_ID, [top.instanceId], true))), detail: RANGER_KEY_EFFECT_ID };
}

CHOICE_RESOLVERS[RANGER_KEY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!card) return { state: proceed(next, pending) };
  const colored = hasColorFeature(state, card.cardId);
  next = patchPlayer(next, playerId, (p) => {
    const deck = p.deck.filter((c) => c.instanceId !== instanceId);
    return colored ? { ...p, deck, power: [...p.power, stripForZone(card)] } : { ...p, deck: [...deck, stripForZone(card)] };
  });
  next = recordReveal(next, {
    playerId,
    ownerId: playerId,
    sourceCardId: "XG7-001",
    effectLabel: "レンジャーキー",
    from: "deck_top",
    cards: revealedCards([card], colored ? "power" : "deck_bottom"),
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-001", `${RANGER_KEY_EFFECT_ID}:reveal:${colored ? "power" : "deck_bottom"}`) };
};
CHOICE_SKIPPERS[RANGER_KEY_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-002 ゴーカイグリーン【ゴーカイガン】（NC）
// 「オモテ向きの自軍パワーから、特徴に色を持つカードを好きな枚数選び手札に戻してもよい。そうしたとき、このターン、これは戻したカード1枚につきBP+1000される。」

const GOKAI_GUN_EFFECT_ID = "xg7002_gokai_gun";

function gokaiGunCandidates(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  return faceUpPower(state, playerId)
    .filter((c) => !exclude.includes(c.instanceId) && hasColorFeature(state, c.cardId))
    .map((c) => c.instanceId);
}

function applyGokaiGun(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = gokaiGunCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: "xg7002:no_targets" };
  return {
    state: openAfter(state, selectOne(ctxBase(ctx), "XG7-002", GOKAI_GUN_EFFECT_ID, ids, true, { selectCount: ids.length, xg7Meta: { limit: ids.length } })),
    detail: GOKAI_GUN_EFFECT_ID,
  };
}

registerMultiPick(
  GOKAI_GUN_EFFECT_ID,
  (state, pending, selected) => gokaiGunCandidates(state, pending.playerId, selected),
  (state, pending, selected) => {
    const playerId = pending.playerId;
    let next = close(state, pending);
    const picked = state.players[playerId].power.filter((c) => selected.includes(c.instanceId));
    next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => !selected.includes(c.instanceId)), hand: [...p.hand, ...picked.map(stripForZone)] }));
    if (pending.sourceInstanceId) next = boostBp(next, playerId, pending.sourceInstanceId, 1000 * picked.length);
    return proceed(next, pending);
  },
);

// ---------------------------------------------------------------------------
// XG7-003 ゴーカイレッド【赤きレジェンド】（NC）
// 「オモテ向きの自軍パワーから、特徴「レッド」を持つカードを1枚選び捨札にしてもよい。そうしたとき、相手に1点ダメージを与える。」

const RED_LEGEND_EFFECT_ID = "xg7003_red_legend";

function applyRedLegend(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = faceUpPower(state, ctx.playerId)
    .filter((c) => printedFeatures(state, c.cardId).includes("レッド"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7003:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-003", RED_LEGEND_EFFECT_ID, ids, true)), detail: RED_LEGEND_EFFECT_ID };
}

CHOICE_RESOLVERS[RED_LEGEND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!card) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  next = applyDamageToPlayer(next, opponent(playerId), 1, { kind: "none", activePlayer: next.activePlayer });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-003", `${RED_LEGEND_EFFECT_ID}:damage`) };
};
CHOICE_SKIPPERS[RED_LEGEND_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-004 ゴーカイブルー【ゴーカイサーベル】（NC。「SP1」は DSL の SP1）
// 「特徴に色を持つオモテ向きの自軍パワーを1枚選び、自軍山札の上に戻してもよい。そうしたとき、戻したカードと同じ特徴を2つ以上持つ、敵軍バトルエリアの
//  Sユニットを1体選び撃破する。」（同じ特徴は戻したカードの印刷の特徴と、敵軍ユニットのいまの特徴で数える）

const SABER_EFFECT_ID = "xg7004_gokai_saber";
const SABER_DESTROY_EFFECT_ID = "xg7004_gokai_saber_destroy";

function applyGokaiSaber(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = faceUpPower(state, ctx.playerId)
    .filter((c) => hasColorFeature(state, c.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7004:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-004", SABER_EFFECT_ID, ids, true)), detail: SABER_EFFECT_ID };
}

CHOICE_RESOLVERS[SABER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!card) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
  const features = printedFeatures(state, card.cardId);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && sharedFeatureCount(features, unitFeatures(next, enemyId, c)) >= 2 && selectableEnemy(next, playerId, "XG7-004", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG7-004", `${SABER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick(pendingBase(pending), "XG7-004", SABER_DESTROY_EFFECT_ID, ids, false, "discard")), log };
};
CHOICE_SKIPPERS[SABER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-005 ゴーカイイエロー【モバイレーツ】（NC）
// 「次の相手ターン、カード名に「ゴーカイ」を含む自軍ユニットが撃破されて捨札になるとき、そのユニットと同じ特徴を2つ以上持つ、オモテ向きの自軍パワーを
//  1枚捨札にして、その場に留めてもよい。」
// NC で次の相手ターンの記録を残し、撃破の置換（rules/operationCounters.ts tryLeaveField → openXg7aLeaveStay）で選択を開く。

const MOBIRATES_FLAG = "xg7005_mobirates";
const MOBIRATES_EFFECT_ID = "xg7005_mobirates";

function applyMobirates(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: addFlag(state, { key: MOBIRATES_FLAG, playerId: ctx.playerId, turn: state.turn + 1 }), detail: MOBIRATES_FLAG };
}

function mobiratesCandidates(state: GameState, intent: PendingLeave): string[] {
  const ownerId = intent.ownerPlayerId;
  if (state.activePlayer === ownerId || !hasFlag(state, MOBIRATES_FLAG, ownerId)) return [];
  const unit = state.players[ownerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || !isUnitCard(state, unit.cardId) || !cardName(state.definitions, unit.cardId).includes("ゴーカイ")) return [];
  const features = unitFeatures(state, ownerId, unit);
  return faceUpPower(state, ownerId)
    .filter((c) => sharedFeatureCount(features, printedFeatures(state, c.cardId)) >= 2)
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// XG7-012 アバレッド×爆竜ティラノサウルス【荒ぶるダイノガッツ】
// 「これが自軍バトルエリアにある間、1ターンごとに1度だけ、次の効果を発動できる⇒自軍ユニットが撃破されたとき、そのユニットを捨札にするかわりに、
//  自軍山札の上からそのユニットの必要パワーの数字と同じ枚数を捨札にして、その場に留めてもよい。」
// 撃破の置換（tryLeaveField）。必要パワーの数字（「+」「-」を除く）だけ山札が要る（0 なら0枚。XG7-questions Q2）。

const DINO_GUTS_EFFECT_ID = "xg7012_dino_guts";

function dinoGutsSource(state: GameState, intent: PendingLeave): CardInstance | undefined {
  const ownerId = intent.ownerPlayerId;
  const unit = state.players[ownerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || !isUnitCard(state, unit.cardId)) return undefined;
  const n = costNumberOf(state, unit.cardId);
  const need = Number.isFinite(n) ? n : 0;
  if (state.players[ownerId].deck.length < need) return undefined;
  return state.players[ownerId].battle.find((c) => isCard(c.cardId, "XG7-012") && !hasFlag(state, DINO_GUTS_EFFECT_ID, ownerId, c.instanceId));
}

// ---------------------------------------------------------------------------
// 撃破の置換（その場に留める）。rules/operationCounters.ts tryLeaveField から呼ぶ。

export function leaveChoice(intent: PendingLeave, cardId: string, effectId: string, sourceInstanceId: string | undefined, ids: string[]): PendingEffectChoice {
  return {
    ...base({ playerId: intent.ownerPlayerId, phasePlayerId: intent.phasePlayerId, sourceInstanceId }, cardId),
    effectId,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    xg7Meta: { intent },
  };
}

export function openXg7aLeaveStay(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.toZone !== "discard" || intent.notDestruction || intent.resumePendingStrike) return null;
  if (state.pendingEffectChoice) return null;
  const declined = intent.xg7Declined ?? [];
  if (!declined.includes(MOBIRATES_EFFECT_ID)) {
    const ids = mobiratesCandidates(state, intent);
    if (ids.length > 0) return openEffectChoice(state, leaveChoice(intent, "XG7-005", MOBIRATES_EFFECT_ID, undefined, ids));
  }
  if (!declined.includes(DINO_GUTS_EFFECT_ID)) {
    const source = dinoGutsSource(state, intent);
    if (source) return openEffectChoice(state, leaveChoice(intent, "XG7-012", DINO_GUTS_EFFECT_ID, source.instanceId, [intent.instanceId]));
  }
  return null;
}

export function stayed(state: GameState, intent: PendingLeave): GameState {
  const next = finalizeLeaveReaction({ ...state, pendingLeave: intent }, intent, true);
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
}

export function declineLeaveStay(effectId: string, cardId: string) {
  return (state: GameState, playerId: PlayerId) => {
    const pending = state.pendingEffectChoice!;
    const intent = pending.xg7Meta?.intent;
    if (!intent) return { error: "invalid_choice" };
    const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
    const leave = tryLeaveField(cleared, { ...intent, xg7Declined: [...(intent.xg7Declined ?? []), effectId] });
    const next = leave.state.pendingEffectChoice || leave.state.pendingLeave ? leave.state : promoteDeferredBattleEntry(leave.state);
    return { state: next, log: skipLog(state, playerId, cardId, effectId) };
  };
}

CHOICE_RESOLVERS[MOBIRATES_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.xg7Meta?.intent;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!intent || !card) return { error: "invalid_target" };
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  return { state: stayed(next, intent), log: logFor(state, playerId, "XG7-005", `${MOBIRATES_EFFECT_ID}:stay`) };
};
CHOICE_SKIPPERS[MOBIRATES_EFFECT_ID] = declineLeaveStay(MOBIRATES_EFFECT_ID, "XG7-005");

CHOICE_RESOLVERS[DINO_GUTS_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.xg7Meta?.intent;
  if (!intent) return { error: "invalid_choice" };
  const unit = state.players[playerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  const n = unit ? costNumberOf(state, unit.cardId) : 0;
  const need = Number.isFinite(n) ? n : 0;
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.slice(need), discard: [...p.discard, ...p.deck.slice(0, need).map(stripForZone)] }));
  if (pending.sourceInstanceId) next = addFlag(next, { key: DINO_GUTS_EFFECT_ID, playerId, instanceId: pending.sourceInstanceId });
  return { state: stayed(next, intent), log: logFor(state, playerId, "XG7-012", `${DINO_GUTS_EFFECT_ID}:stay:${need}`) };
};
CHOICE_SKIPPERS[DINO_GUTS_EFFECT_ID] = declineLeaveStay(DINO_GUTS_EFFECT_ID, "XG7-012");

// ---------------------------------------------------------------------------
// XG7-009 タイムレッド ※（ラッシュしたとき）
// 「次の効果を発動できる⇒自軍山札を見て「Vコマンダー」のカードを1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。」
// カード名が「Vコマンダー」のカード（RS-249）。発動するかを先に聞き（rules/revealGate.ts）、発動したら候補が無くてもシャッフルする。
// 発動しなければ山札はそのまま（以前は候補が無いと聞かずにシャッフルし、見送ってもシャッフルしていた）。

const V_COMMANDER_EFFECT_ID = "xg7009_v_commander";

function applyVCommanderSearch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].deck
    .filter((c) => sameCardName(getDefinition(state.definitions, c.cardId)?.name, "Vコマンダー"))
    .map((c) => c.instanceId);
  return { state: openAfter(state, gateReveal(selectOne(ctxBase(ctx), "XG7-009", V_COMMANDER_EFFECT_ID, ids, true))), detail: V_COMMANDER_EFFECT_ID };
}

CHOICE_RESOLVERS[V_COMMANDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
    next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG7-009", effectLabel: "タイムレッド", from: "deck_top", cards: revealedCards([card], "hand") });
  }
  next = shuffleDeck(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-009", `${V_COMMANDER_EFFECT_ID}:reveal:${card ? cardName(state.definitions, card.cardId) : "-"}`) };
};
// 確認が付いたままの見送り＝発動しない。外れていれば発動して選ぶカードが無かった（シャッフルする）。
CHOICE_SKIPPERS[V_COMMANDER_EFFECT_ID] = simpleSkip((s, pending) => (pending.revealGate ? s : shuffleDeck(s, pending.playerId)));

// ---------------------------------------------------------------------------
// XG7-011 ハリケンレッド【ジャイロ手裏剣】（NC。「特徴「忍者」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する」は
// rules/numberComboEffects.ts の既存の判定）
// 「これのバトルエリアでの並び順を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主の山札の上に戻してもよい。」
// 並び順はバトルエリアでの位置（クロスで変わらない。atwiki/page-2393 Q2）。エリア・サイズを問わない。

const GYRO_EFFECT_ID = "xg7011_gyro_shuriken";

function applyGyroShuriken(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  const position = state.players[ctx.playerId].battle.findIndex((c) => c.instanceId === self) + 1;
  if (position <= 0) return { state, detail: "xg7011:not_in_battle" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumberOf(state, c.cardId);
      return Number.isFinite(n) && n <= position && selectableEnemy(state, ctx.playerId, "XG7-011", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7011:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-011", GYRO_EFFECT_ID, ids, true)), detail: GYRO_EFFECT_ID };
}

CHOICE_RESOLVERS[GYRO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnitToDeckTop(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-011", `${GYRO_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[GYRO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-014 マジレッド【ジルマ・マジーロ】（NC。「SP1」は DSL の SP1）
// 「敵軍バトルエリアからSユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、戻したユニット以下のBPを持つ敵軍ユニットを1体選び撃破する。」
// 比べるのは戻す直前の BP。2つ目はエリア・サイズを問わず、見送れない。

const JIRUMA_EFFECT_ID = "xg7014_jiruma_majiro";
const JIRUMA_DESTROY_EFFECT_ID = "xg7014_jiruma_majiro_destroy";

function applyJiruma(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG7-014", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7014:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-014", JIRUMA_EFFECT_ID, ids, true)), detail: JIRUMA_EFFECT_ID };
}

CHOICE_RESOLVERS[JIRUMA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const unit = findField(state, enemyId, instanceId);
  if (!unit) return { error: "invalid_target" };
  const bp = effectiveBp(state, enemyId, unit);
  const next = moveFieldUnit(close(state, pending), enemyId, instanceId, pending.phasePlayerId, "hand");
  const ids = fieldUnits(next, enemyId)
    .filter((c) => effectiveBp(next, enemyId, c) <= bp && selectableEnemy(next, playerId, "XG7-014", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG7-014", `${JIRUMA_EFFECT_ID}:${cardName(state.definitions, unit.cardId)}:${bp}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick(pendingBase(pending), "XG7-014", JIRUMA_DESTROY_EFFECT_ID, ids, false, "discard")), log };
};
CHOICE_SKIPPERS[JIRUMA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-015 ボウケンレッド【ボウケンジャーになれ】（NC）
// 「自軍捨札から、DAを持たないSユニットのカードを1枚選んでもよい。そうしたとき、このターン、これは選んだカードのBPが「+」され、クロス1を得る。」
// 選んだカードは捨札に残る。加える BP は選んだカードの印刷の BP。

const BOUKEN_EFFECT_ID = "xg7015_boukenger";

function applyBoukenger(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].discard
    .filter((c) => isUnitCard(state, c.cardId) && unitSizeOf(state.definitions, c) === "S" && !categoriesOf(state, c.cardId).includes("DA"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7015:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-015", BOUKEN_EFFECT_ID, ids, true)), detail: BOUKEN_EFFECT_ID };
}

CHOICE_RESOLVERS[BOUKEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  const selfId = pending.sourceInstanceId;
  if (card && selfId) {
    const bp = printedBp(state, card.cardId);
    next = boostBp(next, playerId, selfId, Number.isFinite(bp) ? bp : 0);
    next = addTurnCross(next, playerId, selfId, 1);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-015", `${BOUKEN_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : "-"}`) };
};
CHOICE_SKIPPERS[BOUKEN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-016 黒獅子リオ×スーパーゲキレッド【俺達の道】（NC。2番目は rules/xg7/xg7Fields.ts xg7NcAnyNumberAt）
// 「自分の手札から、必要パワーの数字が5以下のWBのMユニットのカードを2枚まで選び、自軍ラッシュエリアに出してもよい。」
// 効果のラッシュ（必要パワー・追加条件は問わない）。

const OUR_ROAD_EFFECT_ID = "xg7016_our_road";

function ourRoadCandidates(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      if (exclude.includes(c.instanceId) || !isUnitCard(state, c.cardId) || unitSizeOf(state.definitions, c) !== "M") return false;
      const n = costNumberOf(state, c.cardId);
      return Number.isFinite(n) && n <= 5 && categoriesOf(state, c.cardId).includes("WB");
    })
    .map((c) => c.instanceId);
}

function applyOurRoad(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = ourRoadCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: "xg7016:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-016", OUR_ROAD_EFFECT_ID, ids, true, { selectCount: 2, xg7Meta: { limit: 2 } })), detail: OUR_ROAD_EFFECT_ID };
}

registerMultiPick(
  OUR_ROAD_EFFECT_ID,
  (state, pending, selected) => ourRoadCandidates(state, pending.playerId, selected),
  (state, pending, selected) => {
    const next = startEffectRush(close(state, pending), {
      playerId: pending.playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: `${OUR_ROAD_EFFECT_ID}_rush`,
      sourceCardId: "XG7-016",
      sourceInstanceId: pending.sourceInstanceId,
      fromZone: "hand",
      candidates: selected,
      maxCount: selected.length,
      requireConditions: false,
      ignorePowerCost: true,
      mandatory: true,
      forced: true,
    });
    return proceed(next, pending);
  },
);

// ---------------------------------------------------------------------------
// XG7-017 ゴーオンレッド【マッハ全開！】（バトルエリアに出るとき）
// 「自軍ターン中、これがバトルエリアに出るとき、これがライドしていなければ、次の効果を発動できる⇒自分の手札から特徴「車両」を持ち追加条件を持たない
//  ビークルカードを1枚選び自軍ラッシュエリアに出してから、これをライドさせる。そうしたとき、このターン、これはライドオフできない。」
// 出したビークルはこれと一緒にバトルエリアに並ぶ（これの左。ライドして出たのと同じ並び）。

const MACH_EFFECT_ID = "xg7017_mach_zenkai";

function applyMachZenkai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "xg7017:not_own_turn" };
  const self = selfUnit(state, ctx);
  if (!self || self.mountedOnInstanceId) return { state, detail: "xg7017:riding" };
  const ids = state.players[ctx.playerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "vehicle" && (d.features ?? []).includes("車両") && !resolveRushAdditionalCondition(c.cardId, d);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7017:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-017", MACH_EFFECT_ID, ids, true)), detail: MACH_EFFECT_ID };
}

CHOICE_RESOLVERS[MACH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const vehicle = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  if (!vehicle || !selfId) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (p) => {
    const zone = p.battle.some((c) => c.instanceId === selfId) ? "battle" : "rush";
    const cards = p[zone];
    const at = cards.findIndex((c) => c.instanceId === selfId);
    const rider = { ...cards[at]!, mountedOnInstanceId: vehicle.instanceId, xg7Turn: { ...cards[at]!.xg7Turn, noRideOff: true } };
    const placed = [...cards.slice(0, at), stripForZone(vehicle), rider, ...cards.slice(at + 1)];
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), [zone]: placed };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-017", `${MACH_EFFECT_ID}:${cardName(state.definitions, vehicle.cardId)}`) };
};
CHOICE_SKIPPERS[MACH_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-018 シンケンレッド【影武者】・XG7-020 クワガライジャー×カブトライジャー【影に向かいて影を斬り、光に向かいて光を斬る】
// （ユニットがラッシュされたとき。rules/onRushUnitEffects.ts applyPassiveRushTriggers から呼ぶ）
// - XG7-018「これが自軍エリアにある間、特徴「レッド」を持つユニットがラッシュされたとき、これを捨札にする。」（自軍・敵軍のラッシュとも。これ自身は除く）
// - XG7-020「これが自分の手札にある間、クロスを持たない特徴「忍者」を持つ敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい。
//   そうしたとき、そのユニットを持ち主の山札に戻してシャッフルする。」

const SHADOW_EFFECT_ID = "xg7020_shadow";

function hasCross(card: CardInstance): boolean {
  return crossValueForCard(card.cardId) > 0 || (card.xg7Turn?.cross ?? 0) > 0;
}

export function openXg7aOnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  const rushed = findField(state, rusherPlayerId, rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId)) return state;
  const features = unitFeatures(state, rusherPlayerId, rushed);
  let next = state;
  if (features.includes("レッド")) {
    for (const pid of ["player1", "player2"] as const) {
      for (const card of fieldUnits(next, pid).filter((c) => isCard(c.cardId, "XG7-018") && c.instanceId !== rushedInstanceId)) {
        next = moveFieldUnit(next, pid, card.instanceId, phasePlayerId, "discard");
        next = { ...next, log: [...next.log, buildLogEntry(pid, "named_effect", "XG7-018", next.definitions, "xg7018_kagemusha:discard")] };
      }
    }
  }
  if (features.includes("忍者") && rk1IsSmallNow(next, rushed) && !hasCross(rushed)) {
    const holder = opponent(rusherPlayerId);
    for (const card of next.players[holder].hand.filter((c) => isCard(c.cardId, "XG7-020"))) {
      next = openAfter(
        next,
        selectOne({ playerId: holder, phasePlayerId, sourceInstanceId: card.instanceId }, "XG7-020", SHADOW_EFFECT_ID, [card.instanceId], true, { kind: "select_hand", xg7Meta: { target: rushedInstanceId, owner: rusherPlayerId } }),
      );
    }
  }
  return next;
}

CHOICE_RESOLVERS[SHADOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!card) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] }));
  const ownerId = pending.xg7Meta?.owner ?? opponent(playerId);
  const target = pending.xg7Meta?.target;
  if (target && findField(next, ownerId, target)) {
    next = moveFieldUnit(next, ownerId, target, pending.phasePlayerId, "deck_bottom");
    next = shuffleDeck(next, ownerId);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-020", `${SHADOW_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[SHADOW_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-019 ゴセイレッド×ゴセイピンク【スカイコンビブレイク】（NC・これ自身のウイングのアタック）
// 「このターン、自軍ユニットは、ウイングでアタックしたとき、そのバトル中、BP+2000される。（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）」
// NC か、これ自身のウイングのアタック（アタックするとき）でこのターンの記録を残す。BP は rules/xg7/xg7Fields.ts xg7AttackerBattleBonus。

const SKY_COMBI_FLAG = "xg7019_sky_combi";

function applySkyCombi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self || hasFlag(state, SKY_COMBI_FLAG, ctx.playerId, self)) return { state, detail: "xg7019:already" };
  return { state: addFlag(state, { key: SKY_COMBI_FLAG, playerId: ctx.playerId, instanceId: self }), detail: SKY_COMBI_FLAG };
}

function applySkyCombiWing(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self || zoneOfField(state, ctx.playerId, self) !== "rush") return { state, detail: "xg7019:not_wing" };
  return applySkyCombi(state, ctx);
}

// ---------------------------------------------------------------------------
// XG7-021 デカピンク×デカイエロー【ガールズ・イン・トラブル！】（NC。「SP1」は DSL の SP1）
// 「自軍パワーゾーンからSユニットのカードを1枚選び、手札に加えてもよい。そうしたとき、相手は、自分自身のパワーゾーンから、そのカードと同じ必要パワーの
//  数字を持つSユニットのカードを1枚選び、手札に加える。」
// オモテ向きのカードから選ぶ（XG7-questions Q3）。相手の選択は見送れない。

const GIRLS_EFFECT_ID = "xg7021_girls_in_trouble";
const GIRLS_ENEMY_EFFECT_ID = "xg7021_girls_in_trouble_enemy";

function sUnitPowerCards(state: GameState, playerId: PlayerId, cost?: number): string[] {
  return faceUpPower(state, playerId)
    .filter((c) => isUnitCard(state, c.cardId) && unitSizeOf(state.definitions, c) === "S" && (cost === undefined || costNumberOf(state, c.cardId) === cost))
    .map((c) => c.instanceId);
}

function applyGirls(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = sUnitPowerCards(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "xg7021:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-021", GIRLS_EFFECT_ID, ids, true)), detail: GIRLS_EFFECT_ID };
}

function powerToHand(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return patchPlayer(state, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
}

CHOICE_RESOLVERS[GIRLS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = powerToHand(close(state, pending), playerId, instanceId);
  const enemyId = opponent(playerId);
  const ids = sUnitPowerCards(next, enemyId, costNumberOf(state, card.cardId));
  const log = logFor(state, playerId, "XG7-021", `${GIRLS_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, selectOne({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG7-021", GIRLS_ENEMY_EFFECT_ID, ids, false, { xg7Meta: { owner: playerId } })),
    log,
  };
};
CHOICE_SKIPPERS[GIRLS_EFFECT_ID] = simpleSkip();
CHOICE_RESOLVERS[GIRLS_ENEMY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(powerToHand(close(state, pending), playerId, instanceId), pending), log: logFor(state, playerId, "XG7-021", `${GIRLS_ENEMY_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG7-022 マジピンク×マジブルー【トゥインクルイリュージョン】（NC。「SP1」は DSL の SP1）
// 「自軍山札の上から1枚をオモテにしてから手札に加える。そうしたとき、そのカードと同じ必要パワーを持つ敵軍Sユニットを1体選び、持ち主の山札の上に戻しても
//  よい。」同じ必要パワーは「+」「-」を除いた数字で比べる（XG7-questions Q4）。エリアを問わない。

const TWINKLE_EFFECT_ID = "xg7022_twinkle_illusion";

function applyTwinkle(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const top = state.players[ctx.playerId].deck[0];
  if (!top) return { state, detail: "xg7022:no_deck" };
  let next = patchPlayer(state, ctx.playerId, (p) => ({ ...p, deck: p.deck.slice(1), hand: [...p.hand, stripForZone(top)] }));
  next = recordReveal(next, { playerId: ctx.playerId, ownerId: ctx.playerId, sourceCardId: "XG7-022", effectLabel: "トゥインクルイリュージョン", from: "deck_top", cards: revealedCards([top], "hand") });
  const cost = costNumberOf(state, top.cardId);
  const enemyId = opponent(ctx.playerId);
  const ids = Number.isFinite(cost)
    ? fieldUnits(next, enemyId)
        .filter((c) => rk1IsSmallNow(next, c) && costNumberOf(next, c.cardId) === cost && selectableEnemy(next, ctx.playerId, "XG7-022", c))
        .map((c) => c.instanceId)
    : [];
  const detail = `xg7022:reveal:${cardName(state.definitions, top.cardId)}`;
  if (ids.length === 0) return { state: next, detail };
  return { state: openAfter(next, selectOne(ctxBase(ctx), "XG7-022", TWINKLE_EFFECT_ID, ids, true)), detail };
}

CHOICE_RESOLVERS[TWINKLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnitToDeckTop(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-022", `${TWINKLE_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[TWINKLE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-023 獣拳巨神サイダイオー【大大砕大斬】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、選んだユニットがリリース状態ならホールドする。その後、選んだユニットとこのユニットで
//  バトルする。」アタックではないバトル（effectBattle。RS-508【ロードセイバー】と同じ）。ホールドしたユニットはレジストを使えない。

const DAIDAI_EFFECT_ID = "xg7023_daidai_saidaizan";

function applyDaidai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "xg7023:not_own_turn" };
  if (!selfUnit(state, ctx)) return { state, detail: "xg7023:no_self" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && selectableEnemy(state, ctx.playerId, "XG7-023", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7023:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-023", DAIDAI_EFFECT_ID, ids, true)), detail: DAIDAI_EFFECT_ID };
}

/** 効果のバトル（アタックではない）。 */
export function xg7EffectBattle(state: GameState, pending: PendingEffectChoice, attackerId: PlayerId, attackerInstanceId: string, defenderId: PlayerId, defenderInstanceId: string): GameState {
  const battle: PendingBattle = {
    attackerPlayerId: attackerId,
    attackerInstanceId,
    defenderPlayerId: defenderId,
    defenderInstanceId,
    phasePlayerId: pending.phasePlayerId,
    onAttackResolved: true,
    effectBattle: true,
  };
  const result = resolveBattlePending({ ...state, activePlayer: pending.phasePlayerId }, battle);
  const battled = result.log ? { ...result.state, log: [...result.state.log, result.log] } : result.state;
  if (battled.pendingEffectChoice || battled.pendingLeave || battled.pendingRegister) {
    if (!pending.resumeChoice) return battled;
    if (battled.pendingEffectChoice) return { ...battled, pendingEffectChoice: appendResume(battled.pendingEffectChoice, pending.resumeChoice) };
    return { ...battled, deferredDestroyTriggers: [...(battled.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
  }
  return proceed(battled, pending);
}

CHOICE_RESOLVERS[DAIDAI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  const target = next.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  if (!target || !selfId || !findField(next, playerId, selfId)) return { state: proceed(next, pending) };
  if (!target.commandHeld) {
    next = patchPlayer(next, enemyId, (p) => ({ ...p, battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
  }
  return { state: xg7EffectBattle(next, pending, playerId, selfId, enemyId, instanceId), log: logFor(state, playerId, "XG7-023", `${DAIDAI_EFFECT_ID}:${cardName(state.definitions, target.cardId)}`) };
};
CHOICE_SKIPPERS[DAIDAI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// キーワード

Object.assign(XG7_KEYWORDS, {
  "XG7-001::gokai_swap": applyGokaiSwap("XG7-001"),
  "XG7-002::gokai_swap": applyGokaiSwap("XG7-002"),
  "XG7-003::gokai_swap": applyGokaiSwap("XG7-003"),
  "XG7-004::gokai_swap": applyGokaiSwap("XG7-004"),
  "XG7-005::gokai_swap": applyGokaiSwap("XG7-005"),
  "XG7-001::ranger_key": applyRangerKey,
  "XG7-002::gokai_gun": applyGokaiGun,
  "XG7-003::red_legend": applyRedLegend,
  "XG7-004::gokai_saber": applyGokaiSaber,
  "XG7-005::mobirates": applyMobirates,
  "XG7-009::v_commander": applyVCommanderSearch,
  "XG7-011::gyro_shuriken": applyGyroShuriken,
  "XG7-014::jiruma_majiro": applyJiruma,
  "XG7-015::boukenger": applyBoukenger,
  "XG7-016::our_road": applyOurRoad,
  "XG7-017::mach_zenkai": applyMachZenkai,
  "XG7-019::sky_combi": applySkyCombi,
  "XG7-019::sky_combi_wing": applySkyCombiWing,
  "XG7-021::girls_in_trouble": applyGirls,
  "XG7-022::twinkle_illusion": applyTwinkle,
  "XG7-023::daidai_saidaizan": applyDaidai,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない（rules/xg7/xg7Fields.ts 等）。
  "XG7-006::hand_deploy": noop("xg7006:hand_deploy"),
  "XG7-007::dino_discard_aura": noop("xg7007:discard_aura"),
  "XG7-007::ryugeki_juso": noop("xg7007:static"),
  "XG7-008::earth_warrior": noop("xg7008:static"),
  "XG7-009::inherited": noop("xg7009:static"),
  "XG7-012::dino_guts": noop("xg7012:leave_replacement"),
  "XG7-016::geki_red_alias": noop("xg7016:alias"),
  "XG7-018::kagemusha": noop("xg7018:on_rushed"),
  "XG7-020::shadow": noop("xg7020:on_rushed"),
});

void destroyAll;
