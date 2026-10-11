/**
 * 第7弾「七忍の炎陣」（legend1）RS-474〜RS-494 のカード固有の名前付き効果（cardSpec RS7-474-494 で未実装だったもの）。
 *
 * - `trySet7CCardEffect`: DSL の grant_keyword（`set7c::cardId::name`）から呼ばれる起点。
 * - `tryResolveSet7CChoice` / `trySkipSet7CChoice`: このモジュールが開いた選択の解決。
 * - 他の処理から呼ぶ誘発の起点（NC の発動前・ストライクしたとき・ラッシュされたとき・ターンを終えるとき・撃破時など）。
 * 構成は rules/legend1/set6NamedEffectsB.ts と同じ。
 */
import { fusionPartnerReturnCount, requiresFusionPartnerReturn } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { sameCardName } from "../../core/cardNames";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { addJointComboGrant, countJointLGrant } from "../jointComboGrants";
import { startEffectRush } from "../effectRush";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { isSmallUnitNow, turnPlayerOf } from "./set6NamedEffectsB";
import { fireAkaRedSoulNc } from "./set6AuditFixes";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet7CChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet7CChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet7CChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return CHOICE_RESOLVERS[pending.effectId] && !pending.optional ? { error: "not_optional" } : null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
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

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit");
}

function inOwnField(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  const p = state.players[playerId];
  return p.battle.some((c) => c.instanceId === instanceId) || p.rush.some((c) => c.instanceId === instanceId);
}

function numericComboNumber(state: GameState, cardId: string): number | undefined {
  const cn = getDefinition(state.definitions, cardId)?.comboNumber;
  return typeof cn === "number" ? cn : undefined;
}

/**
 * 複数のユニットを同時に撃破する（離場の応答・撃破時の誘発の割り込みは select_units_bp_budget の確定処理で扱う）。
 * 呼ぶ前に選択を閉じておくこと。
 */
function destroyAll(
  state: GameState,
  ids: string[],
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceCardId: string,
  effectId: string,
): GameState {
  if (ids.length === 0) return state;
  const opened = openEffectChoice(state, {
    playerId,
    effectId,
    sourceCardId,
    phasePlayerId,
    kind: "select_units_bp_budget",
    validInstanceIds: ids,
    selectedInstanceIds: ids,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
  });
  const confirmed = applyConfirmEffectChoice(opened, playerId);
  return "error" in confirmed ? state : confirmed.state;
}

/** 合体に必要なユニットの数（「合体―A＋B＋C」の枠の数。合体ユニットでなければ 0）。 */
export function fusionUnitCount(cardId: string): number {
  return requiresFusionPartnerReturn(cardId) ? fusionPartnerReturnCount(cardId) : 0;
}

/** 場のユニットを持ち主の山札の下に置く（重ねたカードは捨札。ライドの関係を外す）。 */
function moveFieldUnitToDeckBottom(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = [...p.battle, ...p.rush].find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const stacked = (card.stackedCards ?? []).map(strip);
    const unmount = (cards: CardInstance[]) =>
      cards
        .filter((c) => c.instanceId !== instanceId)
        .map((c) => {
          if (c.mountedOnInstanceId !== instanceId) return c;
          const { mountedOnInstanceId: _m, ...rest } = c;
          return rest as CardInstance;
        });
    return {
      ...p,
      battle: unmount(p.battle),
      rush: unmount(p.rush),
      deck: [...p.deck, strip(card)],
      discard: [...p.discard, ...stacked],
    };
  });
}

function shuffled<T>(cards: T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// RS-474 タイムシャドウSM ※2
// 「※自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからオモテ向きのカードを1枚選び捨札にする。」（atwiki/page-792）

export const TIME_SHADOW_EFFECT_ID = "rs474_time_shadow_discard";

function openTimeShadow(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${TIME_SHADOW_EFFECT_ID}:not_own_turn` };
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${TIME_SHADOW_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: TIME_SHADOW_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_power",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: TIME_SHADOW_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[TIME_SHADOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, strip(card)],
  }));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-474", `${TIME_SHADOW_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
};

// ---------------------------------------------------------------------------
// RS-475 ガオハンタージャスティス【悪鬼突貫リボルバーファントム】
// 「これがバトルエリアに出たとき、自軍捨札をすべてウラ向きにしてシャッフルしてもよい。そうしたとき、その中から相手に1枚選ばせてから、
//  すべてオモテにする。そして、相手の選んだカードの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-769）

export const REVOLVER_EFFECT_ID = "rs475_revolver_phantom";
export const REVOLVER_PICK_EFFECT_ID = "rs475_revolver_phantom_pick";
export const REVOLVER_DESTROY_EFFECT_ID = "rs475_revolver_phantom_destroy";

function openRevolverPhantom(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.players[ctx.playerId].discard.length === 0) return { state, detail: `${REVOLVER_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: REVOLVER_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "confirm",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: [REVOLVER_EFFECT_ID],
      optional: true,
    }),
    detail: REVOLVER_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[REVOLVER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (instanceId !== REVOLVER_EFFECT_ID) return { error: "invalid_target" };
  // 自軍捨札をすべてウラ向きにしてシャッフルし、その中から相手が1枚選ぶ。
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    discard: shuffled(p.discard.map((c) => ({ ...c, faceDown: true }))),
  }));
  const enemyId = opponent(playerId);
  return {
    state: {
      ...next,
      pendingEffectChoice: {
        ...pending,
        playerId: enemyId,
        effectId: REVOLVER_PICK_EFFECT_ID,
        kind: "select_hand",
        validInstanceIds: next.players[playerId].discard.map((c) => c.instanceId),
        selectedInstanceIds: [],
        optional: false,
      },
      activePlayer: enemyId,
    },
    log: logFor(state, playerId, "RS-475", `${REVOLVER_EFFECT_ID}:shuffle`),
  };
};
CHOICE_SKIPPERS[REVOLVER_EFFECT_ID] = simpleSkip("RS-475");

CHOICE_RESOLVERS[REVOLVER_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const justiceOwner = opponent(playerId);
  const picked = state.players[justiceOwner].discard.find((c) => c.instanceId === instanceId);
  if (!picked) return { error: "invalid_target" };
  // すべてオモテにする。
  let next = patchPlayer(state, justiceOwner, (p) => ({ ...p, discard: p.discard.map(strip) }));
  const limit = parsePowerCost(getDefinition(state.definitions, picked.cardId)?.powerCost ?? 0);
  // 相手（選んだプレイヤー）のユニットのうち、必要パワーの数字が limit 以下のもの。
  const ids = fieldUnits(next, playerId)
    .filter((c) => parsePowerCost(getDefinition(next.definitions, c.cardId)?.powerCost ?? 0) <= limit)
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RS-475", `${REVOLVER_PICK_EFFECT_ID}:${cardName(state.definitions, picked.cardId)}:${limit}`);
  if (ids.length === 0) return { state: finish(next, pending), log };
  next = {
    ...next,
    pendingEffectChoice: {
      ...pending,
      playerId: justiceOwner,
      effectId: REVOLVER_DESTROY_EFFECT_ID,
      kind: "select_unit",
      unitDestination: "discard",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      optional: false,
    },
    activePlayer: justiceOwner,
  };
  return { state: next, log };
};

CHOICE_RESOLVERS[REVOLVER_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: proceed(leave.state, pending),
    log: logFor(state, playerId, "RS-475", `${REVOLVER_DESTROY_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-476 ガオハンターイビル【天地震撼ビーストハリケーン】
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札から特徴「獣」を持つユニットカードを1枚選び捨札にしてもよい。
//  そうしたとき、捨札にしたユニットカードのBPと同じBPのユニットをすべて撃破する。」（atwiki/page-828）
// 「ユニットをすべて」— 自軍・敵軍、バトルエリア・ラッシュエリアを問わない（R-TGT-04）。

export const BEAST_HURRICANE_EFFECT_ID = "rs476_beast_hurricane";

function openBeastHurricane(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${BEAST_HURRICANE_EFFECT_ID}:not_own_turn` };
  const ids = state.players[ctx.playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && (def.features ?? []).includes("獣");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${BEAST_HURRICANE_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: BEAST_HURRICANE_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_hand",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: BEAST_HURRICANE_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BEAST_HURRICANE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const bp = getDefinition(state.definitions, card.cardId)?.bp;
  let next = close(
    patchPlayer(state, playerId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== instanceId),
      discard: [...p.discard, strip(card)],
    })),
    pending,
  );
  const log = logFor(state, playerId, "RS-476", `${BEAST_HURRICANE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}:${bp ?? "-"}`);
  if (typeof bp !== "number") return { state: proceed(next, pending), log };
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    for (const c of fieldUnits(next, pid)) {
      if (effectiveBp(next, pid, c) === bp) ids.push(c.instanceId);
    }
  }
  next = destroyAll(next, ids, playerId, pending.phasePlayerId, "RS-476", `${BEAST_HURRICANE_EFFECT_ID}_destroy`);
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[BEAST_HURRICANE_EFFECT_ID] = simpleSkip("RS-476");

// ---------------------------------------------------------------------------
// RS-477 ガオウルフ【威圧する咆哮】
// 「これが自軍エリアにある間、敵軍ターン中、敵軍ユニットがＮＣの効果を発動するとき、そのユニットと同じカード名のユニットカードが
//  敵軍捨札にあれば、そのNCの効果を発動する前に、次の効果を発動できる⇒そのユニットが持つカテゴリと同じカテゴリを持つ
//  敵軍コマンドをすべて捨札にする。」（atwiki/page-770）
// 進入処理の NC の段階（rules/combo.ts）で、NC の効果を発動する前に呼ぶ。発動を確かめたら gaoWolfNcDecision に記録して進入処理を再開する。

export const WOLF_ROAR_EFFECT_ID = "rs477_wolf_roar";

/** NC の効果を発動する前のガオウルフの確認。開いたら state、開かなければ null。 */
export function openWolfRoarBeforeNc(state: GameState, ncPlayerId: PlayerId, card: CardInstance): GameState | null {
  if (state.gaoWolfNcDecision?.instanceId === card.instanceId) return null;
  if (state.pendingEffectChoice) return null;
  const wolfOwner = opponent(ncPlayerId);
  // 「敵軍ターン中」— NC を発動するユニットの持ち主のターン（ガオウルフの持ち主から見て敵軍ターン）。
  if (turnPlayerOf(state) !== ncPlayerId) return null;
  const owner = state.players[wolfOwner];
  const wolf = [...owner.battle, ...owner.rush].find((c) => c.cardId === "RS-477");
  if (!wolf) return null;
  const name = cardName(state.definitions, card.cardId);
  const sameNameInDiscard = state.players[ncPlayerId].discard.some(
    (c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && sameCardName(cardName(state.definitions, c.cardId), name),
  );
  if (!sameNameInDiscard) return null;
  return openEffectChoice(state, {
    playerId: wolfOwner,
    effectId: WOLF_ROAR_EFFECT_ID,
    sourceCardId: "RS-477",
    sourceInstanceId: wolf.instanceId,
    kind: "confirm",
    phasePlayerId: ncPlayerId,
    validInstanceIds: [wolf.instanceId],
    selectedInstanceIds: [card.instanceId],
    optional: true,
  });
}

/** NC の段階を終えたら記録を消す。 */
export function clearWolfRoarDecision(state: GameState): GameState {
  return state.gaoWolfNcDecision ? { ...state, gaoWolfNcDecision: undefined } : state;
}

CHOICE_RESOLVERS[WOLF_ROAR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const target = pending.selectedInstanceIds?.[0] ?? "";
  const ncPlayerId = opponent(playerId);
  const unit = state.players[ncPlayerId].battle.find((c) => c.instanceId === target);
  const categories = unit ? unitEffectiveCategories(state, ncPlayerId, unit, "battle") : [];
  let discarded = 0;
  let next = patchPlayer(state, ncPlayerId, (p) => {
    const keep: CardInstance[] = [];
    const drop: CardInstance[] = [];
    for (const c of p.command) {
      const def = getDefinition(state.definitions, c.cardId);
      const cats = def ? (Array.isArray(def.category) ? def.category : def.category ? [def.category] : []) : [];
      if (cats.some((cat) => categories.includes(cat as never))) drop.push(c);
      else keep.push(c);
    }
    discarded = drop.length;
    return { ...p, command: keep, discard: [...p.discard, ...drop.map(strip)] };
  });
  next = { ...next, gaoWolfNcDecision: { instanceId: target } };
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-477", `${WOLF_ROAR_EFFECT_ID}:${discarded}`) };
};
CHOICE_SKIPPERS[WOLF_ROAR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.selectedInstanceIds?.[0] ?? "";
  const next = { ...state, gaoWolfNcDecision: { instanceId: target } };
  return { state: finish(next, pending), log: skipLog(state, playerId, "RS-477", WOLF_ROAR_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// RS-480 ガオシルバー【邪気玉砕】（NC）
// 「「SP1」敵軍バトルエリアから、ナンバーの数字が昇順で連続して並んでいるユニットの組み合わせを1組選んでもよい（1、2、3や4、5など）。
//  そうしたとき、選んだ1組の中で一番小さいナンバーの数字を持つユニットから順に、自分の手札の枚数と同じ数まで選び撃破する。」（atwiki/page-773）
// 組み合わせ: 敵軍バトルエリアで隣り合って並び、ナンバーの数字が1ずつ増えていくユニットの列（2体以上）。
// 一番小さいナンバーのユニット（列の先頭）を選ぶと、そこから連続して並ぶ列全体を1組とする（長い組ほど撃破できる数が減ることはない）。
// 撃破する数は手札の枚数まで（列の先頭から順に）。

export const JAKI_GYOKUSAI_EFFECT_ID = "rs480_jaki_gyokusai";

function ascendingRunFrom(state: GameState, enemyId: PlayerId, startId: string): string[] {
  const battle = state.players[enemyId].battle.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit");
  const index = battle.findIndex((c) => c.instanceId === startId);
  if (index < 0) return [];
  const run = [battle[index]!];
  for (let i = index + 1; i < battle.length; i++) {
    const prev = numericComboNumber(state, run[run.length - 1]!.cardId);
    const cur = numericComboNumber(state, battle[i]!.cardId);
    if (prev === undefined || cur !== prev + 1) break;
    run.push(battle[i]!);
  }
  return run.map((c) => c.instanceId);
}

function openJakiGyokusai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.players[ctx.playerId].hand.length === 0) return { state, detail: `${JAKI_GYOKUSAI_EFFECT_ID}:no_hand` };
  const enemyId = opponent(ctx.playerId);
  const starts = state.players[enemyId].battle
    .filter((c) => ascendingRunFrom(state, enemyId, c.instanceId).length >= 2)
    .map((c) => c.instanceId);
  if (starts.length === 0) return { state, detail: `${JAKI_GYOKUSAI_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: JAKI_GYOKUSAI_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      unitDestination: "discard",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: starts,
      selectCount: 1,
      optional: true,
    }),
    detail: JAKI_GYOKUSAI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[JAKI_GYOKUSAI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const run = ascendingRunFrom(state, enemyId, instanceId);
  const ids = run.slice(0, state.players[playerId].hand.length);
  let next = close(state, pending);
  next = destroyAll(next, ids, playerId, pending.phasePlayerId, "RS-480", `${JAKI_GYOKUSAI_EFFECT_ID}_destroy`);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-480", `${JAKI_GYOKUSAI_EFFECT_ID}:${run.length}:${ids.length}`) };
};
CHOICE_SKIPPERS[JAKI_GYOKUSAI_EFFECT_ID] = simpleSkip("RS-480");

// ---------------------------------------------------------------------------
// RS-483 シュリケンジャー【宇宙統一忍者流】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアから、ナンバーに数字を持つSユニットを1体選んでも良い。
//  そうしたとき、選んだユニットのＮＣの効果を、このユニットの効果として発動する。」（atwiki/page-745）
// 選んだユニットの NC の効果は RS-421【ソウル降臨】と同じ処理（fireAkaRedSoulNc）で、このユニットの効果として発動する。

export const SPACE_NINJA_EFFECT_ID = "rs483_space_ninja";

function openSpaceNinja(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${SPACE_NINJA_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .filter((c) => isSmallUnitNow(state, enemyId, c))
    .filter((c) => numericComboNumber(state, c.cardId) !== undefined)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${SPACE_NINJA_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: SPACE_NINJA_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: SPACE_NINJA_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[SPACE_NINJA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const chosen = state.players[opponent(playerId)].rush.find((c) => c.instanceId === instanceId);
  if (!chosen || !pending.sourceInstanceId) return { error: "invalid_target" };
  const next = fireAkaRedSoulNc(close(state, pending), playerId, pending.sourceInstanceId, chosen.cardId);
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, "RS-483", `${SPACE_NINJA_EFFECT_ID}:${cardName(state.definitions, chosen.cardId)}`),
  };
};
CHOICE_SKIPPERS[SPACE_NINJA_EFFECT_ID] = simpleSkip("RS-483");

// ---------------------------------------------------------------------------
// RS-484 旋風神ハリアー【ハリーアップ！】
// 「これが自軍エリアにある間、自分がターンを終えるとき、自分の手札から「旋風神ハリアー」のカードを1枚選び捨札にしてもよい。
//  そうしたとき、このターンの後、自分は追加でもう一度ターンを行う。」（atwiki/page-752）
// rules/turnEndingEffects.ts の「ターンを終えるとき」から呼ぶ。追加のターンは extraTurns に積み、core/createGame.ts の advancePhase で使う。

export const HURRY_UP_EFFECT_ID = "rs484_hurry_up";

/** 「ターンを終えるとき」に処理するハリアー（自軍エリアにあるもの）。 */
export function collectSet7CTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const p = state.players[endingPlayerId];
  return [...p.battle, ...p.rush].filter((c) => c.cardId === "RS-484").map((c) => c.instanceId);
}

export function openSet7CTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  if (!inOwnField(state, endingPlayerId, entry)) return state;
  const ids = state.players[endingPlayerId].hand
    .filter((c) => cardName(state.definitions, c.cardId) === "旋風神ハリアー")
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: endingPlayerId,
    effectId: HURRY_UP_EFFECT_ID,
    sourceCardId: "RS-484",
    sourceInstanceId: entry,
    kind: "select_hand",
    phasePlayerId: endingPlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[HURRY_UP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, strip(card)],
  }));
  next = { ...next, extraTurns: [...(next.extraTurns ?? []), playerId] };
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-484", `${HURRY_UP_EFFECT_ID}:extra_turn`) };
};
CHOICE_SKIPPERS[HURRY_UP_EFFECT_ID] = simpleSkip("RS-484");

/** advancePhase（エンドフェイズ → 次のターン）で、終えるプレイヤーが追加のターンを行うか。行うなら1件消費した state。 */
export function consumeExtraTurn(state: GameState, endingPlayerId: PlayerId): GameState | null {
  const queue = state.extraTurns ?? [];
  const index = queue.indexOf(endingPlayerId);
  if (index < 0) return null;
  const rest = queue.filter((_, i) => i !== index);
  return { ...state, extraTurns: rest.length > 0 ? rest : undefined };
}

// ---------------------------------------------------------------------------
// RS-485 ハムスター館長【疾風流の継承】
// 「これが自軍ラッシュエリアにある間、特徴「忍者」を持つユニットがストライクしたとき、そのユニットの持ち主は1枚ドローしてもよい。
//  また、これが撃破されて捨札になったとき、このカードの持ち主は、特徴「忍者」を持つ自軍ユニットの数と同じ枚数までドローしてもよい。」（atwiki/page-807）
// 前半は自軍・敵軍の指定がないので、どちらの軍の忍者ユニットのストライクでも、そのユニットの持ち主がドローできる（R-TGT-04）。

export const HAMSTER_STRIKE_DRAW_EFFECT_ID = "rs485_hamster_strike_draw";
export const HAMSTER_DESTROY_DRAW_EFFECT_ID = "rs485_hamster_destroy_draw";

function drawCards(state: GameState, playerId: PlayerId, count: number): GameState {
  return patchPlayer(state, playerId, (p) => {
    const n = Math.min(count, p.deck.length);
    return { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) };
  });
}

/** 「ストライクしたとき」（events/listeners/strikeDeclaredListener.ts から呼ぶ）。 */
export function openHamsterStrikeDraw(state: GameState, strikerPlayerId: PlayerId, striker: CardInstance): GameState {
  if (!unitFeatures(state, strikerPlayerId, striker).includes("忍者")) return state;
  if (state.players[strikerPlayerId].deck.length === 0) return state;
  const phasePlayerId = turnPlayerOf(state);
  let next = state;
  for (const ownerId of ["player1", "player2"] as const) {
    for (const hamster of state.players[ownerId].rush.filter((c) => c.cardId === "RS-485")) {
      const choice: PendingEffectChoice = {
        playerId: strikerPlayerId,
        effectId: HAMSTER_STRIKE_DRAW_EFFECT_ID,
        sourceCardId: "RS-485",
        sourceInstanceId: hamster.instanceId,
        kind: "optional_deck_draw",
        phasePlayerId,
        validInstanceIds: ["draw"],
        selectedInstanceIds: [],
        optional: true,
        ...(next.pendingEffectChoice ? { resumeChoice: next.pendingEffectChoice } : {}),
      };
      next = { ...next, pendingEffectChoice: choice, activePlayer: strikerPlayerId };
    }
  }
  return next;
}

CHOICE_RESOLVERS[HAMSTER_STRIKE_DRAW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (instanceId !== "draw") return { error: "invalid_target" };
  return { state: finish(drawCards(state, playerId, 1), pending), log: logFor(state, playerId, "RS-485", `${HAMSTER_STRIKE_DRAW_EFFECT_ID}:1`) };
};
CHOICE_SKIPPERS[HAMSTER_STRIKE_DRAW_EFFECT_ID] = simpleSkip("RS-485");

/** 「撃破されて捨札になったとき」（DSL on_destroy の grant_keyword から）。0〜上限の枚数を選ぶ（「まで」）。 */
function openHamsterDestroyDraw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ownerId = ctx.playerId;
  const ninjas = fieldUnits(state, ownerId).filter((c) => unitFeatures(state, ownerId, c).includes("忍者")).length;
  const max = Math.min(ninjas, state.players[ownerId].deck.length);
  if (max <= 0) return { state, detail: `${HAMSTER_DESTROY_DRAW_EFFECT_ID}:none` };
  // 選択肢は「n 枚ドローする」（多い順）。見送り（skip）は 0 枚。
  const options = Array.from({ length: max }, (_, i) => `draw:${max - i}`);
  return {
    state: openEffectChoice(state, {
      playerId: ownerId,
      effectId: HAMSTER_DESTROY_DRAW_EFFECT_ID,
      sourceCardId: "RS-485",
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "declare_number",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: options,
      optional: true,
    }),
    detail: HAMSTER_DESTROY_DRAW_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[HAMSTER_DESTROY_DRAW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const count = Number(instanceId.slice("draw:".length));
  return { state: finish(drawCards(state, playerId, count), pending), log: logFor(state, playerId, "RS-485", `${HAMSTER_DESTROY_DRAW_EFFECT_ID}:${count}`) };
};
CHOICE_SKIPPERS[HAMSTER_DESTROY_DRAW_EFFECT_ID] = simpleSkip("RS-485");

// ---------------------------------------------------------------------------
// RS-486 ソードスラッシャー【分身幻斬り】（JC。R-ERR-RS486 の読み替え後）
// 「これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたLユニットが
//  アタックまたはストライクしたとき、その処理をすべて終えてから、そのLユニットと同じカード名のユニットカードを、その合体に必要な
//  ユニットの数まで、自分の手札から好きな枚数選び、自軍ラッシュエリアに出してもよい。」（grnrngr/faq-card-7 RS-486 Q「手札から選びます」）
// - JC の成立（DSL joint_combo_l）で発動の確認を開き、発動したら L ユニットに jointComboGrants として記録する。
// - アタック・ストライクの宣言（core/applyAction.ts の後処理）で bunshinQueue に積み、処理をすべて終えて（選択・反応等がなくなって）から選択を開く。

export const BUNSHIN_CONFIRM_EFFECT_ID = "rs486_bunshin_confirm";
export const BUNSHIN_EFFECT_ID = "rs486_bunshin";
const BUNSHIN_GRANT_ID = "rs486_bunshin_grant";

/** JC の相手（L ナンバーのカードの右隣の L ユニット）。 */
function jointLPartner(state: GameState, playerId: PlayerId, jcInstanceId: string | undefined): CardInstance | undefined {
  if (!jcInstanceId) return undefined;
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === jcInstanceId);
  return index >= 0 ? battle[index + 1] : undefined;
}

function openBunshinConfirm(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const partner = jointLPartner(state, ctx.playerId, ctx.triggerSourceInstanceId);
  if (!partner) return { state, detail: `${BUNSHIN_CONFIRM_EFFECT_ID}:no_partner` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: BUNSHIN_CONFIRM_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "confirm",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: [BUNSHIN_CONFIRM_EFFECT_ID],
      selectedInstanceIds: [partner.instanceId],
      optional: true,
    }),
    detail: BUNSHIN_CONFIRM_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BUNSHIN_CONFIRM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (instanceId !== BUNSHIN_CONFIRM_EFFECT_ID) return { error: "invalid_target" };
  const partnerId = pending.selectedInstanceIds?.[0] ?? "";
  const next = addJointComboGrant(state, playerId, partnerId, {
    kind: "l",
    effectId: BUNSHIN_GRANT_ID,
    sourceCardId: "RS-486",
    partnerInstanceId: pending.sourceInstanceId ?? "",
  });
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-486", BUNSHIN_CONFIRM_EFFECT_ID) };
};
CHOICE_SKIPPERS[BUNSHIN_CONFIRM_EFFECT_ID] = simpleSkip("RS-486");

/** アタック・ストライクを宣言したユニットが【分身幻斬り】を得ていれば（得た回数分）待ち行列に積む。 */
export function queueBunshinOnAction(
  before: GameState,
  after: GameState,
  action: { type: string; playerId?: PlayerId; instanceId?: string; attackerInstanceId?: string },
): GameState {
  if (action.type !== "strike" && action.type !== "battle") return after;
  const playerId = action.playerId;
  const instanceId = action.type === "strike" ? action.instanceId : action.attackerInstanceId;
  if (!playerId || !instanceId) return after;
  const unit = before.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit) return after;
  const times = countJointLGrant(unit, BUNSHIN_GRANT_ID);
  if (times === 0) return after;
  const entries = Array.from({ length: times }, () => ({ playerId, instanceId, cardId: unit.cardId }));
  return { ...after, bunshinQueue: [...(after.bunshinQueue ?? []), ...entries] };
}

/** 処理をすべて終えたら（呼ぶ側で進行中の処理がないことを確かめる）【分身幻斬り】の選択を開く。 */
export function openBunshinIfReady(state: GameState): GameState {
  let next = state;
  while ((next.bunshinQueue ?? []).length > 0 && !next.pendingEffectChoice) {
    const [entry, ...rest] = next.bunshinQueue!;
    next = { ...next, bunshinQueue: rest.length > 0 ? rest : undefined };
    const name = cardName(next.definitions, entry!.cardId);
    const ids = next.players[entry!.playerId].hand
      .filter((c) => getDefinition(next.definitions, c.cardId)?.type === "unit" && sameCardName(cardName(next.definitions, c.cardId), name))
      .map((c) => c.instanceId);
    const max = fusionUnitCount(entry!.cardId);
    if (ids.length === 0 || max === 0) continue;
    next = openEffectChoice(next, {
      playerId: entry!.playerId,
      effectId: BUNSHIN_EFFECT_ID,
      sourceCardId: "RS-486",
      sourceInstanceId: entry!.instanceId,
      kind: "select_hand",
      phasePlayerId: turnPlayerOf(next),
      validInstanceIds: ids,
      selectCount: max,
      selectedInstanceIds: [],
      optional: true,
    });
  }
  return next;
}

/** 選んだ手札のカードを自軍ラッシュエリアに出す（ラッシュではない。効果で出す — R-RUSH-20）。 */
function putHandCardsInRush(state: GameState, playerId: PlayerId, ids: string[], phasePlayerId: PlayerId): GameState {
  if (ids.length === 0) return state;
  const moved = patchPlayer(state, playerId, (p) => {
    const picked = p.hand.filter((c) => ids.includes(c.instanceId)).map(strip);
    return { ...p, hand: p.hand.filter((c) => !ids.includes(c.instanceId)), rush: [...p.rush, ...picked] };
  });
  const rushed = finalizeEffectRush(moved, playerId, ids, phasePlayerId);
  return { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
}

CHOICE_RESOLVERS[BUNSHIN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
    // 「好きな枚数」— 続けて選ぶか、見送り（skip）でここまでの枚数で確定する。
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } } };
  }
  const next = putHandCardsInRush(close(state, pending), playerId, selected, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-486", `${BUNSHIN_EFFECT_ID}:${selected.length}`) };
};
CHOICE_SKIPPERS[BUNSHIN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const next = putHandCardsInRush(close(state, pending), playerId, selected, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-486", `${BUNSHIN_EFFECT_ID}:${selected.length}`) };
};

// ---------------------------------------------------------------------------
// RS-487 ゴートクラッシャー【疾風豪快落とし】（JC）
// 「これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒追加条件を持たない敵軍ユニットを、
//  コンビネーションしたLユニットの合体に必要なユニットの数まで好きな数選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-809）
// 合体に必要なユニットの数は「合体―」の行のユニットの数（ビークルも数える。grnrngr/faq-card-8 RS-574 Q）。
// 1体ずつ選び、見送り（skip）でそこまでの数で確定する（1体も選ばなければ発動しない）。

export const GOAT_CRASH_EFFECT_ID = "rs487_goat_crash";

function goatCrashCandidates(state: GameState, enemyId: PlayerId): string[] {
  return fieldUnits(state, enemyId)
    .filter((c) => !getDefinition(state.definitions, c.cardId)?.rushAdditionalCondition)
    .map((c) => c.instanceId);
}

function openGoatCrash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const partner = jointLPartner(state, ctx.playerId, ctx.triggerSourceInstanceId);
  const max = partner ? fusionUnitCount(partner.cardId) : 0;
  if (max === 0) return { state, detail: `${GOAT_CRASH_EFFECT_ID}:not_fusion` };
  const ids = goatCrashCandidates(state, opponent(ctx.playerId));
  if (ids.length === 0) return { state, detail: `${GOAT_CRASH_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: GOAT_CRASH_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      unitDestination: "power",
      placeAsDamage: true,
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: max,
      selectedInstanceIds: [],
      optional: true,
    }),
    detail: GOAT_CRASH_EFFECT_ID,
  };
}

/** 場のユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く。 */
function placeAsDamage(state: GameState, ids: string[], phasePlayerId: PlayerId): GameState {
  let next = state;
  for (const id of ids) {
    const found = findCardInField(next, id);
    if (!found) continue;
    const moved = applyUnitLeave(next, id, "power", phasePlayerId);
    if ("error" in moved) continue;
    next = patchPlayer(moved.state, found.playerId, (p) => {
      if (!p.power.some((c) => c.instanceId === id && !c.faceDown)) return p;
      return {
        ...p,
        power: p.power.map((c) => (c.instanceId === id ? { ...c, faceDown: true } : c)),
        damage: p.damage + 1,
      };
    });
  }
  return next;
}

function finishGoatCrash(state: GameState, playerId: PlayerId, selected: string[]): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const next = placeAsDamage(close(state, pending), selected, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-487", `${GOAT_CRASH_EFFECT_ID}:${selected.length}`) };
}

CHOICE_RESOLVERS[GOAT_CRASH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } } };
  }
  return finishGoatCrash(state, playerId, selected);
};
CHOICE_SKIPPERS[GOAT_CRASH_EFFECT_ID] = (state, playerId) =>
  finishGoatCrash(state, playerId, state.pendingEffectChoice!.selectedInstanceIds ?? []);

// ---------------------------------------------------------------------------
// RS-489 二の槍チュウズーボ【宇宙忍法・箱次元】（NC）
// 「敵軍バトルエリアからSユニットを2体選び、選んだ2体のユニットの特徴が2つ以上同じなら、選んだ2体を敵軍の山札の下に
//  好きな順番で戻してもよい。」（atwiki/page-814）
// 2体を選び（どちらの選択も見送れる）、特徴が2つ以上同じなら戻すかを選ぶ: 先に山札の下に置くユニットを選ぶ（見送ると戻さない）。

export const BOX_DIMENSION_EFFECT_ID = "rs489_box_dimension";
export const BOX_DIMENSION_ORDER_EFFECT_ID = "rs489_box_dimension_order";

function openBoxDimension(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && isSmallUnitNow(state, enemyId, c))
    .map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: `${BOX_DIMENSION_EFFECT_ID}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: BOX_DIMENSION_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 2,
      selectedInstanceIds: [],
      optional: true,
    }),
    detail: BOX_DIMENSION_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[BOX_DIMENSION_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) },
      },
    };
  }
  const enemyId = opponent(playerId);
  const [a, b] = selected.map((id) => state.players[enemyId].battle.find((c) => c.instanceId === id));
  if (!a || !b) return { error: "invalid_target" };
  const fa = unitFeatures(state, enemyId, a);
  const shared = new Set(unitFeatures(state, enemyId, b).filter((f) => fa.includes(f))).size;
  const log = logFor(state, playerId, "RS-489", `${BOX_DIMENSION_EFFECT_ID}:shared:${shared}`);
  if (shared < 2) return { state: finish(state, pending), log };
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: BOX_DIMENSION_ORDER_EFFECT_ID,
        validInstanceIds: selected,
        selectedInstanceIds: [],
        selectCount: 1,
        optional: true,
      },
    },
    log,
  };
};
CHOICE_SKIPPERS[BOX_DIMENSION_EFFECT_ID] = simpleSkip("RS-489");

CHOICE_RESOLVERS[BOX_DIMENSION_ORDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const other = pending.validInstanceIds.find((id) => id !== instanceId)!;
  let next = moveFieldUnitToDeckBottom(state, enemyId, instanceId);
  next = moveFieldUnitToDeckBottom(next, enemyId, other);
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-489", `${BOX_DIMENSION_ORDER_EFFECT_ID}:2`) };
};
CHOICE_SKIPPERS[BOX_DIMENSION_ORDER_EFFECT_ID] = simpleSkip("RS-489");

// ---------------------------------------------------------------------------
// RS-490 三の槍マンマルバ幼体【予言】
// 「これが自軍エリアにある間、敵軍ターン中、敵軍ユニットがラッシュされたとき、自軍ユニットの数が敵軍ユニットの数より少なければ、
//  次の効果を発動できる⇒自軍山札の上から1枚オモテにする。オモテにしたカードが、ラッシュされた敵軍ユニットと同じ特徴を1つ以上持つ
//  ユニットカードなら、自軍ラッシュエリアに出す。（ただし追加条件は満たすこと）。出せなかった場合は、捨札にする。」（atwiki/page-813）
// 「ラッシュされたとき」（rules/onRushUnitEffects.ts applyPassiveRushTriggers から呼ぶ）。出すのは効果ラッシュ（R-RUSH-21: 追加条件は満たす、
// 必要パワーは不要）。

export const PROPHECY_EFFECT_ID = "rs490_prophecy";

export function openProphecyOnEnemyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.pendingEffectChoice) return state;
  if (phasePlayerId !== rusherPlayerId) return state;
  const ownerId = opponent(rusherPlayerId);
  const owner = state.players[ownerId];
  const mamas = [...owner.battle, ...owner.rush].filter((c) => c.cardId === "RS-490");
  if (mamas.length === 0 || owner.deck.length === 0) return state;
  if (!state.players[rusherPlayerId].rush.some((c) => c.instanceId === rushedInstanceId)) return state;
  if (fieldUnits(state, ownerId).length >= fieldUnits(state, rusherPlayerId).length) return state;
  let choice: PendingEffectChoice | undefined;
  for (const mama of [...mamas].reverse()) {
    choice = {
      playerId: ownerId,
      effectId: PROPHECY_EFFECT_ID,
      sourceCardId: "RS-490",
      sourceInstanceId: mama.instanceId,
      kind: "confirm",
      phasePlayerId,
      validInstanceIds: [mama.instanceId],
      selectedInstanceIds: [rushedInstanceId],
      optional: true,
      ...(choice ? { resumeChoice: choice } : {}),
    };
  }
  return { ...state, pendingEffectChoice: choice, activePlayer: ownerId };
}

CHOICE_RESOLVERS[PROPHECY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const rusherId = opponent(playerId);
  const rushed = findCardInField(state, pending.selectedInstanceIds?.[0] ?? "");
  const rushedFeatures = rushed ? unitFeatures(state, rusherId, rushed.card) : [];
  let next = close(state, pending);
  const top = next.players[playerId].deck[0];
  if (!top) return { state: proceed(next, pending) };
  const def = getDefinition(next.definitions, top.cardId);
  const matches = def?.type === "unit" && (def.features ?? []).some((f) => rushedFeatures.includes(f));
  let placed = false;
  if (matches) {
    const started = startEffectRush(next, {
      playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: PROPHECY_EFFECT_ID,
      sourceCardId: "RS-490",
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
      deck: p.deck.filter((c) => c.instanceId !== top.instanceId),
      discard: [...p.discard, strip(top)],
    }));
  }
  const log = logFor(state, playerId, "RS-490", `${PROPHECY_EFFECT_ID}:${placed ? "rush" : "discard"}:${cardName(state.definitions, top.cardId)}`);
  if (next.pendingEffectChoice || next.pendingEffectRush) return { state: next, log };
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[PROPHECY_EFFECT_ID] = simpleSkip("RS-490");

// ---------------------------------------------------------------------------
// RS-491 三の槍マンマルバ成体【目覚めた凶暴性】（NC。ライドオフしたときはナンバーに関係なく発動する）
// 「自軍Sユニットの数が敵軍Sユニットの数より少なければ、相手は自分自身のSユニットを1体選び撃破する。」（atwiki/page-748）

export const FEROCITY_EFFECT_ID = "rs491_awakened_ferocity";

function sUnitCount(state: GameState, playerId: PlayerId): CardInstance[] {
  return fieldUnits(state, playerId).filter((c) => isSmallUnitNow(state, playerId, c));
}

function openFerocity(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const enemyS = sUnitCount(state, enemyId);
  if (sUnitCount(state, ctx.playerId).length >= enemyS.length) return { state, detail: `${FEROCITY_EFFECT_ID}:not_fewer` };
  return {
    state: openEffectChoice(state, {
      playerId: enemyId,
      effectId: FEROCITY_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      unitDestination: "discard",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: enemyS.map((c) => c.instanceId),
      selectCount: 1,
      optional: false,
    }),
    detail: FEROCITY_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[FEROCITY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const found = findCardInField(state, instanceId);
  if (!found || found.playerId !== playerId) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  return {
    state: proceed(leave.state, pending),
    log: logFor(state, playerId, "RS-491", `${FEROCITY_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-493 六の槍サタラクラ【正解の無いクイズ】（NC）
// 「自軍パワーのダメージになっているカードを、ウラ向きのままシャッフルして置きなおしてもよい。そうしたとき、自軍パワーのダメージに
//  なっているカードを1枚選び、そのカードの必要パワーの数字を相手に宣言させてからオモテにする。相手の解答が不正解なら、相手に1点ダメージを
//  与える。正解なら相手は自分自身のユニットを1体選び撃破する。その後オモテにしたカードを捨札にする。」（atwiki/page-816）
// 手順: 置きなおすか（任意）→ ダメージを1枚選ぶ → 相手が数字を宣言（declare_number）→ 正誤の処理 → オモテにしたカードを捨札。

export const QUIZ_EFFECT_ID = "rs493_quiz";
export const QUIZ_PICK_EFFECT_ID = "rs493_quiz_pick";
export const QUIZ_DECLARE_EFFECT_ID = "rs493_quiz_declare";
export const QUIZ_DESTROY_EFFECT_ID = "rs493_quiz_destroy";

function openQuiz(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!state.players[ctx.playerId].power.some((c) => c.faceDown)) return { state, detail: `${QUIZ_EFFECT_ID}:no_damage` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: QUIZ_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "confirm",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: [QUIZ_EFFECT_ID],
      optional: true,
    }),
    detail: QUIZ_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[QUIZ_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (instanceId !== QUIZ_EFFECT_ID) return { error: "invalid_target" };
  // ダメージ（ウラ向き）のカードだけを、ウラ向きのままシャッフルして置きなおす（オモテ向きのカードの位置は変えない）。
  const next = patchPlayer(state, playerId, (p) => {
    const order = shuffled(p.power.filter((c) => c.faceDown));
    let k = 0;
    return { ...p, power: p.power.map((c) => (c.faceDown ? order[k++]! : c)) };
  });
  return {
    state: {
      ...next,
      pendingEffectChoice: {
        ...pending,
        effectId: QUIZ_PICK_EFFECT_ID,
        kind: "select_power",
        validInstanceIds: next.players[playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId),
        selectedInstanceIds: [],
        selectCount: 1,
        optional: false,
      },
    },
    log: logFor(state, playerId, "RS-493", `${QUIZ_EFFECT_ID}:shuffle`),
  };
};
CHOICE_SKIPPERS[QUIZ_EFFECT_ID] = simpleSkip("RS-493");

CHOICE_RESOLVERS[QUIZ_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        playerId: enemyId,
        effectId: QUIZ_DECLARE_EFFECT_ID,
        kind: "declare_number",
        validInstanceIds: Array.from({ length: 13 }, (_, n) => String(n)),
        selectedInstanceIds: [instanceId],
        optional: false,
      },
      activePlayer: enemyId,
    },
  };
};

/** オモテにしたカード（自軍パワーゾーン）を捨札にする。 */
function discardRevealed(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.power.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const power = p.power.filter((c) => c.instanceId !== instanceId);
    return { ...p, power, discard: [...p.discard, strip(card)], damage: power.filter((c) => c.faceDown).length };
  });
}

CHOICE_RESOLVERS[QUIZ_DECLARE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const declared = Number(instanceId);
  const ownerId = opponent(playerId);
  const revealedId = pending.selectedInstanceIds?.[0] ?? "";
  const card = state.players[ownerId].power.find((c) => c.instanceId === revealedId);
  if (!card) return { error: "invalid_target" };
  const actual = parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost ?? 0);
  // オモテにする。
  let next = patchPlayer(state, ownerId, (p) => ({
    ...p,
    power: p.power.map((c) => (c.instanceId === revealedId ? { ...c, faceDown: false } : c)),
  }));
  const correct = declared === actual;
  const log = logFor(state, playerId, "RS-493", `${QUIZ_DECLARE_EFFECT_ID}:${declared}:${actual}:${correct ? "correct" : "wrong"}`);
  if (correct) {
    const ids = fieldUnits(next, playerId).map((c) => c.instanceId);
    if (ids.length > 0) {
      return {
        state: {
          ...next,
          pendingEffectChoice: {
            ...pending,
            effectId: QUIZ_DESTROY_EFFECT_ID,
            kind: "select_unit",
            unitDestination: "discard",
            validInstanceIds: ids,
            optional: false,
          },
        },
        log,
      };
    }
    return { state: finish(discardRevealed(next, ownerId, revealedId), pending), log };
  }
  // 不正解: 相手に1点ダメージを与えてから、オモテにしたカードを捨札にする。
  next = discardRevealed(close(next, pending), ownerId, revealedId);
  next = applyDamageToPlayer(next, playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
  return { state: proceed(next, pending), log };
};

CHOICE_RESOLVERS[QUIZ_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const ownerId = opponent(playerId);
  const revealedId = pending.selectedInstanceIds?.[0] ?? "";
  const found = findCardInField(state, instanceId);
  if (!found || found.playerId !== playerId) return { error: "invalid_target" };
  const leave = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  const next = discardRevealed(leave.state, ownerId, revealedId);
  return {
    state: proceed(next, pending),
    log: logFor(state, playerId, "RS-493", `${QUIZ_DESTROY_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-494 縁切り忍者シラーンス【宇宙忍法・縁切り】（NC）
// 「敵軍バトルエリアから、ＣＮの数字が昇順（例:1、2や3、4など）で隣り合っている2体のSユニットを選んでもよい。そうしたとき、
//  選んだ2体でバトルさせる。」（atwiki/page-817）
// 敵軍ユニットどうしのバトルは BP を比べ、低い方（同じなら両方）が撃破される（R-BTL-02。rules/grapFighter.ts と同じ）。

export const EN_GIRI_EFFECT_ID = "rs494_en_giri";

/** 敵軍バトルエリアで隣り合い、左の CN+1 が右の CN の S ユニットの組。 */
function enGiriPairs(state: GameState, enemyId: PlayerId): Array<[string, string]> {
  const battle = state.players[enemyId].battle.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit");
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i + 1 < battle.length; i++) {
    const a = battle[i]!;
    const b = battle[i + 1]!;
    if (!isSmallUnitNow(state, enemyId, a) || !isSmallUnitNow(state, enemyId, b)) continue;
    const na = numericComboNumber(state, a.cardId);
    const nb = numericComboNumber(state, b.cardId);
    if (na !== undefined && nb === na + 1) pairs.push([a.instanceId, b.instanceId]);
  }
  return pairs;
}

function openEnGiri(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const pairs = enGiriPairs(state, opponent(ctx.playerId));
  if (pairs.length === 0) return { state, detail: `${EN_GIRI_EFFECT_ID}:no_targets` };
  const ids = [...new Set(pairs.flat())];
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: EN_GIRI_EFFECT_ID,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      kind: "select_unit",
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 2,
      selectedInstanceIds: [],
      optional: true,
    }),
    detail: EN_GIRI_EFFECT_ID,
  };
}

CHOICE_RESOLVERS[EN_GIRI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    // 2体目は1体目と組になるユニットだけ。
    const partners = enGiriPairs(state, enemyId)
      .filter((p) => p.includes(instanceId))
      .map((p) => (p[0] === instanceId ? p[1] : p[0]));
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: partners } } };
  }
  const [a, b] = selected.map((id) => state.players[enemyId].battle.find((c) => c.instanceId === id));
  if (!a || !b) return { error: "invalid_target" };
  const bpA = effectiveBp(state, enemyId, a);
  const bpB = effectiveBp(state, enemyId, b);
  const losers: string[] = [];
  if (bpA <= bpB) losers.push(a.instanceId);
  if (bpB <= bpA) losers.push(b.instanceId);
  let next = close(state, pending);
  next = destroyAll(next, losers, playerId, pending.phasePlayerId, "RS-494", `${EN_GIRI_EFFECT_ID}_battle`);
  return { state: proceed(next, pending), log: logFor(state, playerId, "RS-494", `${EN_GIRI_EFFECT_ID}:${bpA}vs${bpB}`) };
};
CHOICE_SKIPPERS[EN_GIRI_EFFECT_ID] = simpleSkip("RS-494");

// ---------------------------------------------------------------------------
// DSL grant_keyword（`set7c::cardId::name`）からの起点

export const SET7C_KEYWORD_PREFIX = "set7c::";

export function trySet7CCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(SET7C_KEYWORD_PREFIX)) return null;
  switch (keyword.slice(SET7C_KEYWORD_PREFIX.length)) {
    case "RS-474::time_shadow_discard":
      return openTimeShadow(state, ctx);
    case "RS-475::revolver_phantom":
      return openRevolverPhantom(state, ctx);
    case "RS-476::beast_hurricane":
      return openBeastHurricane(state, ctx);
    case "RS-480::jaki_gyokusai":
      return openJakiGyokusai(state, ctx);
    case "RS-483::space_ninja":
      return openSpaceNinja(state, ctx);
    case "RS-485::destroy_draw":
      return openHamsterDestroyDraw(state, ctx);
    case "RS-486::bunshin":
      return openBunshinConfirm(state, ctx);
    case "RS-487::goat_crash":
      return openGoatCrash(state, ctx);
    case "RS-489::box_dimension":
      return openBoxDimension(state, ctx);
    case "RS-491::awakened_ferocity":
      return openFerocity(state, ctx);
    case "RS-493::quiz":
      return openQuiz(state, ctx);
    case "RS-494::en_giri":
      return openEnGiri(state, ctx);
    default:
      // 場にある間の継続効果・他の処理から呼ぶ誘発（RS-477・RS-484・RS-485 前半・RS-490）の目印。
      return { state, detail: keyword };
  }
}
