import { isSameCardIdentity } from "@rangers-strike/cards";
/**
 * 第6弾「紅き六戦士の帰還」（legend1）RS-390〜RS-431 のカード固有の名前付き効果（set-6 監査で未実装だったもの）。
 *
 * - `trySet6BCardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet6BChoice` / `trySkipSet6BChoice`: このモジュールが開いた選択の解決。
 * - 継続効果・制限の参照関数（BP/SP 補正、ストライク・バトル進入の制限など）。
 * 構成は rules/legend1/set5NamedEffects.ts と同じ。
 */
import { xg3SizeNow } from "../xg3/xg3Fields";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, isSmallUnit, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { addBakiBakiExtraAttack } from "../turnModifierBridge";
import { cardHasGrantKeyword } from "../../dsl/promotedKeywordBridge";
import { fireAkaRedSoulNc } from "./set6AuditFixes";
import { baseLargeNow, hasBecomesLIfAnyLText } from "./set8NamedEffectsB";
import { rk6CommandHoldBlocked } from "../rk/rk6Fields";
import { canonicalCardIdAmong } from "../promo/cardIdentity";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isSet6BChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet6BChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet6BChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
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
  // 解決の途中で別の選択（離場の応答で開いた選択等）が開いていれば、それを残す。
  const stillOpen = state.pendingEffectChoice === pending;
  const cleared: GameState = stillOpen
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
  if (cleared.pendingLeave || cleared.pendingEffectChoice) return cleared;
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

function simpleSkip(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, cardId, pending.effectId) };
  };
}

function stripForZone(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

// ---------------------------------------------------------------------------
// 共通

function inField(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  const p = state.players[playerId];
  return p.battle.some((c) => c.instanceId === instanceId) || p.rush.some((c) => c.instanceId === instanceId);
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/** ターンプレイヤー（反応・選択の間に activePlayer が移っていても、そのターンのプレイヤー）。 */
export function turnPlayerOf(state: GameState): PlayerId {
  if (state.pendingStrike) return state.pendingStrike.battlePhasePlayer;
  if (state.pendingBattle) return state.pendingBattle.phasePlayerId;
  if (state.pendingRush) return state.pendingRush.phasePlayerId;
  if (state.pendingLeave) return state.pendingLeave.phasePlayerId;
  if (state.pendingEffectChoice) return state.pendingEffectChoice.phasePlayerId;
  return state.activePlayer;
}

// ---------------------------------------------------------------------------
// BP・SP の継続効果

const SET6B_FIELD_BP_IDS = ["RS-409", "RS-415", "RS-431"] as const;

/**
 * 効果による BP の継続修正（rules/fieldAuras.ts passiveNamedFieldBpBonus の general から呼ぶ）。
 * - RS-409 冥府神スレイプニル【フレンジー・スピア・クラッシュ】: 自軍と敵軍の常駐置き場のカード1枚につき BP+1000。
 * - RS-415 冥府神ワイバーン【飛竜剣法・散弾月】: 自軍ダメージが5点以上なら BP+4000。
 * - RS-431 黒獅子リオ【剛勇吼波】: 敵軍 S ユニット1体につき BP+1000。
 */
export function set6BFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  switch (canonicalCardIdAmong(instance.cardId, SET6B_FIELD_BP_IDS)) {
    case "RS-409": {
      if (!inField(state, playerId, instance.instanceId)) return 0;
      const count = state.players.player1.operation.length + state.players.player2.operation.length;
      return 1000 * count;
    }
    case "RS-415":
      if (!inField(state, playerId, instance.instanceId)) return 0;
      return state.players[playerId].damage >= 5 ? 4000 : 0;
    case "RS-431": {
      if (!inField(state, playerId, instance.instanceId)) return 0;
      const enemyId = opponent(playerId);
      return 1000 * fieldUnits(state, enemyId).filter((c) => isSmallUnitNow(state, enemyId, c)).length;
    }
    default:
      return 0;
  }
}

/**
 * 「SP1」になる継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。
 * - RS-409: BP6000以上のとき「SP1」。
 * - RS-410 冥府神ドレイク【竜闘気爆炸球】: 敵軍ユニットが1体もなければ「SP1」。
 * - RS-415: 自軍ダメージが5点以上なら「SP1」。
 */
export function set6BEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  switch (instance.cardId) {
    case "RS-409":
      return effectiveBp(state, playerId, instance) >= 6000 ? Math.max(sp, 1) : sp;
    case "RS-410":
      return fieldUnits(state, opponent(playerId)).length === 0 ? Math.max(sp, 1) : sp;
    case "RS-415":
      return state.players[playerId].damage >= 5 ? Math.max(sp, 1) : sp;
    default:
      return sp;
  }
}

/**
 * ストライクの制限（rules/combo.ts canStrikeUnit から呼ぶ）。
 * - RS-431 ※「これは自軍コマンドが１つ以上あるときストライクできない」（リリース・ホールドを問わない）。
 */
export function set6BBlocksStrike(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  if (isSameCardIdentity(instance.cardId, "RS-431")) return state.players[playerId].command.length > 0;
  return false;
}

// ---------------------------------------------------------------------------
// RS-420 大剣人ズバーン ※「自分か相手のLユニットがあれば、これはLユニットになる。」

/**
 * 「※自分か相手のLユニットがあれば、これはLユニットになる。」（DSL の becomes_l_if_l_present。RS-420 大剣人ズバーン・
 * RS-454 ニンジャマン）を持つユニットが L ユニットとして扱われるか（自軍か敵軍のバトル・ラッシュエリアに、これ以外の
 * 印刷サイズ L のユニットがある。同じ能力で L になっているユニットどうしは支え合わない — atwiki/page-799 コメント）。
 */
export function zubaanIsLarge(state: GameState, instance: CardInstance): boolean {
  // RS-539【再生巨大化能力】等で L ユニットになっている（rules/legend1/set8NamedEffectsB.ts）。
  if (unitSizeOf(state.definitions, instance) !== "L" && baseLargeNow(state, instance)) return true;
  // RS-558 ガンマジン「自分か相手のLユニットがあれば、これはLユニットになり、…」も同じ種類の能力（文言で判定）。
  if (
    instance.cardId !== "RS-420" &&
    !cardHasGrantKeyword(instance.cardId, "becomes_l_if_l_present") &&
    !hasBecomesLIfAnyLText(state, instance.cardId)
  ) {
    return false;
  }
  for (const pid of ["player1", "player2"] as const) {
    for (const c of fieldUnits(state, pid)) {
      if (c.instanceId === instance.instanceId || c.cardId === "RS-420") continue;
      if (cardHasGrantKeyword(c.cardId, "becomes_l_if_l_present") || hasBecomesLIfAnyLText(state, c.cardId)) continue;
      if (baseLargeNow(state, c)) return true;
    }
  }
  return false;
}

/** 現在 S ユニットか（RS-420 が L ユニットになっていれば S ではない）。 */
export function isSmallUnitNow(state: GameState, _playerId: PlayerId, instance: CardInstance): boolean {
  if (!isSmallUnit(state.definitions, instance)) return false;
  // XG3-029 ※（自軍 M ビークルがあれば M ユニット。rules/xg3/xg3Fields.ts）。
  if (xg3SizeNow(state, instance)) return false;
  return !zubaanIsLarge(state, instance);
}

// ---------------------------------------------------------------------------
// RS-390 ゴーグリーン【ファイブレイザー】（NC）
// 「「SP1」敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ敵軍コマンドを1つ選び、
//  捨札にしてから置く。（この効果は特徴「航空機」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」

export const FIVE_LASER_EFFECT_ID = "rs390_five_laser";
export const FIVE_LASER_MAKE_ROOM_EFFECT_ID = "rs390_five_laser_make_room";

function openFiveLaser(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${FIVE_LASER_EFFECT_ID}:no_targets` };
  const opened = openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: FIVE_LASER_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
  return { state: opened, detail: FIVE_LASER_EFFECT_ID };
}

/** 捨札のカードを持ち主のコマンドゾーンにホールド状態で置く。 */
function placeDiscardInCommand(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return {
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      command: [...p.command, { ...stripForZone(card), commandHeld: true }],
    };
  });
}

function resolveFiveLaser(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const card = enemy.discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const log = logFor(state, playerId, pending.sourceCardId, `${FIVE_LASER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  if (enemy.command.length >= COMMAND_ZONE_MAX) {
    // 置けなければ敵軍コマンドを1つ選び、捨札にしてから置く（強制。R-ZONE-08）。
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          effectId: FIVE_LASER_MAKE_ROOM_EFFECT_ID,
          kind: "select_command",
          validInstanceIds: enemy.command.map((c) => c.instanceId),
          selectedInstanceIds: [instanceId],
          optional: false,
        },
      },
      log,
    };
  }
  return { state: finish(placeDiscardInCommand(state, enemyId, instanceId), pending), log };
}

function resolveFiveLaserMakeRoom(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const target = pending.selectedInstanceIds?.[0];
  let next = patchPlayer(state, enemyId, (p) => {
    const cmd = p.command.find((c) => c.instanceId === instanceId);
    if (!cmd) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(cmd)] };
  });
  if (target) next = placeDiscardInCommand(next, enemyId, target);
  return { state: finish(next, pending), log: logFor(state, playerId, pending.sourceCardId, FIVE_LASER_MAKE_ROOM_EFFECT_ID) };
}

CHOICE_RESOLVERS[FIVE_LASER_EFFECT_ID] = resolveFiveLaser;
CHOICE_SKIPPERS[FIVE_LASER_EFFECT_ID] = simpleSkip("RS-390");
CHOICE_RESOLVERS[FIVE_LASER_MAKE_ROOM_EFFECT_ID] = resolveFiveLaserMakeRoom;

// ---------------------------------------------------------------------------
// RS-391 ゴーイエロー【番田流牛乳竜巻落とし】（NC）
// 「「SP1」敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」

export const MILK_TORNADO_EFFECT_ID = "rs391_milk_tornado";

function openMilkTornado(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle.filter((c) => isSmallUnitNow(state, enemyId, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${MILK_TORNADO_EFFECT_ID}:no_targets` };
  const opened = openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: MILK_TORNADO_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
  return { state: opened, detail: MILK_TORNADO_EFFECT_ID };
}

/** 場のユニットを持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする（重ねたカードは捨札）。 */
export function placeFieldUnitInCommandOrDiscard(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = [...p.battle, ...p.rush].find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const stacked = (card.stackedCards ?? []).map((c) => stripForZone(c));
    // このユニットにライドしていたユニットの関係を外す。
    const unmount = (cards: CardInstance[]) =>
      cards.map((c) => {
        if (c.mountedOnInstanceId !== instanceId) return c;
        const { mountedOnInstanceId: _m, ...rest } = c;
        return rest as CardInstance;
      });
    const room = p.command.length < COMMAND_ZONE_MAX;
    return {
      ...p,
      battle: unmount(p.battle.filter((c) => c.instanceId !== instanceId)),
      rush: unmount(p.rush.filter((c) => c.instanceId !== instanceId)),
      command: room ? [...p.command, { ...stripForZone(card), commandHeld: true }] : p.command,
      discard: room ? [...p.discard, ...stacked] : [...p.discard, stripForZone(card), ...stacked],
    };
  });
}

function resolveMilkTornado(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const found = findCardInField(state, instanceId);
  if (!found || found.playerId !== enemyId) return { error: "invalid_target" };
  const next = placeFieldUnitInCommandOrDiscard(state, enemyId, instanceId);
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${MILK_TORNADO_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`),
  };
}

CHOICE_RESOLVERS[MILK_TORNADO_EFFECT_ID] = resolveMilkTornado;

// ---------------------------------------------------------------------------
// RS-392 ゴーピンク【救急医療】（NC）
// 「敵軍捨札からSユニットのカードを1枚選んでもよい。そうしたとき、自軍捨札からSユニットのカードを相手に1枚選ばせる。
//  その後、選ばれたカードはそれぞれ持ち主の手札に加える。」

export const FIRST_AID_EFFECT_ID = "rs392_first_aid";
export const FIRST_AID_OPPONENT_EFFECT_ID = "rs392_first_aid_opponent";

function sUnitCardIds(state: GameState, cards: CardInstance[]): string[] {
  return cards
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && unitSizeOf(state.definitions, c) === "S";
    })
    .map((c) => c.instanceId);
}

function openFirstAid(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sUnitCardIds(state, state.players[enemyId].discard);
  if (ids.length === 0) return { state, detail: `${FIRST_AID_EFFECT_ID}:no_targets` };
  const opened = openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: FIRST_AID_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
  return { state: opened, detail: FIRST_AID_EFFECT_ID };
}

function discardToHand(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] };
  });
}

function resolveFirstAid(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const ownIds = sUnitCardIds(state, state.players[playerId].discard);
  const log = logFor(state, playerId, pending.sourceCardId, `${FIRST_AID_EFFECT_ID}:${instanceId}`);
  if (ownIds.length === 0) {
    return { state: finish(discardToHand(state, enemyId, instanceId), pending), log };
  }
  // 相手が（ゴーピンク側の）自軍捨札から S ユニットのカードを1枚選ぶ。
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        playerId: enemyId,
        effectId: FIRST_AID_OPPONENT_EFFECT_ID,
        validInstanceIds: ownIds,
        selectedInstanceIds: [instanceId],
        optional: false,
      },
      activePlayer: enemyId,
    },
    log,
  };
}

function resolveFirstAidOpponent(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const goPinkOwner = opponent(playerId);
  const first = pending.selectedInstanceIds?.[0];
  // 選ばれたカードはそれぞれ持ち主の手札に加える。
  let next = first ? discardToHand(state, playerId, first) : state;
  next = discardToHand(next, goPinkOwner, instanceId);
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${FIRST_AID_OPPONENT_EFFECT_ID}:${instanceId}`),
  };
}

CHOICE_RESOLVERS[FIRST_AID_EFFECT_ID] = resolveFirstAid;
CHOICE_SKIPPERS[FIRST_AID_EFFECT_ID] = simpleSkip("RS-392");
CHOICE_RESOLVERS[FIRST_AID_OPPONENT_EFFECT_ID] = resolveFirstAidOpponent;

// ---------------------------------------------------------------------------
// RS-393 コマンドアタッカー【アタッカーポッド】
// 「これがライドされたままなら、このビークルからコンビネーションするSユニットは、次の能力を得る⇒
//  自軍ターン中、ナンバーは3少なくなる。ただし、2より少なくならない。」

/** card の並びのすぐ前（このユニットがコンビネーションした元）が、ライドされたままのコマンドアタッカーか。 */
function comboFromRiddenAttacker(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === card.instanceId);
  const before = index >= 0 ? battle.slice(0, index) : battle;
  const left = before.at(-1);
  if (!left) return false;
  if (left.cardId === "RS-393") return battle.some((c) => c.mountedOnInstanceId === left.instanceId);
  if (!left.mountedOnInstanceId) return false;
  return battle.some((c) => c.instanceId === left.mountedOnInstanceId && c.cardId === "RS-393");
}

/** NC 判定用のナンバーに【アタッカーポッド】の減少を適用する（rules/numberComboEffects.ts ncEffectiveNumber から呼ぶ）。 */
export function attackerPodNumber(state: GameState, playerId: PlayerId, card: CardInstance, number: number): number {
  if (number <= 2) return number;
  if (turnPlayerOf(state) !== playerId) return number;
  if (!isSmallUnitNow(state, playerId, card)) return number;
  if (!comboFromRiddenAttacker(state, playerId, card)) return number;
  return Math.max(2, number - 3);
}

// ---------------------------------------------------------------------------
// RS-394 タイムロボα／RS-395 タイムロボβ【チェンジフォーメーション】
// 「これがバトルエリアからラッシュエリアに戻るとき、ダメージ以外の自軍パワーから「タイムロボβ（α）」のカードを1枚選び、
//  これと置き換えてもよい。」
// RS-396 タイムジェットγ【ガンマトルネード】
// 「これをラッシュしたとき、本来のBPが5000以下の敵軍Sユニットをすべて持ち主のパワーゾーンに送る。その後、ダメージ以外の
//  自軍パワーから｢タイムロボα｣または｢タイムロボβ｣のカードを1枚選び、これと置き換えてもよい。」
// 置き換え: 選んだカードがこれのいた位置（ラッシュエリア）に置かれ、これはパワーゾーンに（オモテで）置かれる。
// 置き換えて出たユニットは「戻したユニット」「効果で出したユニット」としては扱わない（faq-card-6 RS-394 Q1/Q2）。

export const CHANGE_FORMATION_EFFECT_ID = "rs394_change_formation";

const CHANGE_FORMATION_PARTNERS: Record<string, string[]> = {
  "RS-394": ["RS-395"],
  "RS-395": ["RS-394"],
  "RS-396": ["RS-394", "RS-395"],
};

function changeFormationCandidates(state: GameState, playerId: PlayerId, cardId: string): string[] {
  const partners = CHANGE_FORMATION_PARTNERS[cardId] ?? [];
  return state.players[playerId].power
    .filter((c) => !c.faceDown && partners.includes(c.cardId))
    .map((c) => c.instanceId);
}

/** 置き換えの選択を開く（候補が無ければ state のまま）。 */
function openChangeFormation(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  const ids = changeFormationCandidates(state, playerId, card.cardId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: CHANGE_FORMATION_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_power",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

/** スタートフェイズにバトルエリアからラッシュエリアに戻ったユニットの誘発（rules/startPhase.ts から呼ぶ）。 */
export function isSet6BBattleToRushTrigger(card: CardInstance): boolean {
  return card.cardId === "RS-394" || card.cardId === "RS-395";
}

export function trySet6BBattleToRush(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  if (!isSet6BBattleToRushTrigger(card)) return state;
  if (!state.players[playerId].rush.some((c) => c.instanceId === card.instanceId)) return state;
  return openChangeFormation(state, playerId, card, phasePlayerId);
}

function resolveChangeFormation(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selfId = pending.sourceInstanceId;
  const player = state.players[playerId];
  const incoming = player.power.find((c) => c.instanceId === instanceId && !c.faceDown);
  const selfIndex = player.rush.findIndex((c) => c.instanceId === selfId);
  if (!incoming || selfIndex < 0) return { error: "invalid_target" };
  const self = player.rush[selfIndex]!;
  const next = patchPlayer(state, playerId, (p) => {
    const rush = [...p.rush];
    rush[selfIndex] = stripForZone(incoming);
    return {
      ...p,
      rush,
      power: [...p.power.filter((c) => c.instanceId !== instanceId), stripForZone(self)],
    };
  });
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, pending.sourceCardId, `${CHANGE_FORMATION_EFFECT_ID}:${cardName(state.definitions, incoming.cardId)}`),
  };
}

CHOICE_RESOLVERS[CHANGE_FORMATION_EFFECT_ID] = resolveChangeFormation;
CHOICE_SKIPPERS[CHANGE_FORMATION_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: finish(state, pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
};

function applyGammaTornado(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const targets = fieldUnits(state, enemyId)
    .filter((c) => isSmallUnitNow(state, enemyId, c))
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.bp ?? Number.MAX_SAFE_INTEGER) <= 5000)
    .map((c) => c.instanceId);
  let next = state;
  for (const id of targets) {
    // 「送る」— 場を離れる処理（離場の応答があれば中断せずに順に処理する）。
    const moved = applyUnitLeave(next, id, "power", ctx.phasePlayerId);
    if (!("error" in moved)) next = moved.state;
  }
  const self = ctx.triggerSourceInstanceId
    ? state.players[ctx.playerId].rush.find((c) => c.instanceId === ctx.triggerSourceInstanceId)
    : undefined;
  if (self && !next.pendingEffectChoice && !next.pendingLeave) {
    next = openChangeFormation(next, ctx.playerId, self, ctx.phasePlayerId);
  }
  return { state: next, detail: `${GAMMA_TORNADO_DETAIL}:${targets.length}` };
}

const GAMMA_TORNADO_DETAIL = "ganmatorunedo";

// ---------------------------------------------------------------------------
// RS-397 タイムジェット1【予期せぬ出現】
// 「これをラッシュしたとき、敵軍バトルエリアのユニットを好きな順に並び変えてもよい。」
// 選択肢: 「逆順に並び替える」（一度で確定）か、敵軍バトルエリアのユニットを新しい並びの先頭から1体ずつ選ぶ
// （残り1体になったら確定）。ライドの組（ビークルとライドしているユニット）は1組として動かす。

export const REORDER_EFFECT_ID = "reorder_enemy_battle";
export const REORDER_REVERSE_OPTION = "逆順に並び替える";

/** 敵軍バトルエリアの並びの単位（ライドの組は代表＝ビークル）。 */
function reorderGroups(battle: CardInstance[]): CardInstance[][] {
  const ids = new Set(battle.map((c) => c.instanceId));
  const groups: CardInstance[][] = [];
  for (const card of battle) {
    if (card.mountedOnInstanceId && ids.has(card.mountedOnInstanceId)) continue;
    groups.push([card, ...battle.filter((c) => c.mountedOnInstanceId === card.instanceId)]);
  }
  return groups;
}

export function openReorderEnemyBattle(state: GameState, playerId: PlayerId, source: CardInstance): GameState {
  const enemyId = opponent(playerId);
  const groups = reorderGroups(state.players[enemyId].battle);
  if (groups.length < 2) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: REORDER_EFFECT_ID,
    sourceCardId: source.cardId,
    sourceInstanceId: source.instanceId,
    kind: "confirm",
    phasePlayerId: playerId,
    validInstanceIds: [REORDER_REVERSE_OPTION, ...groups.map((g) => g[0]!.instanceId)],
    selectedInstanceIds: [],
    optional: true,
  });
}

function applyEnemyBattleOrder(state: GameState, enemyId: PlayerId, leaderIds: string[]): GameState {
  return patchPlayer(state, enemyId, (p) => {
    const groups = reorderGroups(p.battle);
    const ordered = leaderIds
      .map((id) => groups.find((g) => g[0]!.instanceId === id))
      .filter((g): g is CardInstance[] => !!g);
    const rest = groups.filter((g) => !leaderIds.includes(g[0]!.instanceId));
    return { ...p, battle: [...ordered, ...rest].flat() };
  });
}

function resolveReorder(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const groups = reorderGroups(state.players[enemyId].battle);
  if (instanceId === REORDER_REVERSE_OPTION) {
    const reversed = [...groups].reverse().map((g) => g[0]!.instanceId);
    return {
      state: finish(applyEnemyBattleOrder(state, enemyId, reversed), pending),
      log: logFor(state, playerId, pending.sourceCardId, `${REORDER_EFFECT_ID}:reversed`),
    };
  }
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = groups.map((g) => g[0]!.instanceId).filter((id) => !selected.includes(id));
  if (remaining.length > 1) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          kind: "select_unit",
          validInstanceIds: remaining,
          selectedInstanceIds: selected,
          // 並べ始めたら最後まで並べる。
          optional: false,
        },
      },
    };
  }
  const order = [...selected, ...remaining];
  return {
    state: finish(applyEnemyBattleOrder(state, enemyId, order), pending),
    log: logFor(state, playerId, pending.sourceCardId, `${REORDER_EFFECT_ID}:${order.length}`),
  };
}

CHOICE_RESOLVERS[REORDER_EFFECT_ID] = resolveReorder;
CHOICE_SKIPPERS[REORDER_EFFECT_ID] = simpleSkip("RS-397");

// ---------------------------------------------------------------------------
// 「ターンを終えるとき」（rules/turnEndingEffects.ts resolveTurnEndingEffectsImpl から呼ぶ）
// - RS-398 タイムジェット2【時間漂流者の送還】
//   「これが自軍ラッシュエリアにある間、自分がターンを終えるとき、自軍バトルエリアから特徴「忍者」を持つSユニットを2体まで選び、
//    自軍パワーゾーンに送ってもよい。」
// - RS-413 冥府神ゴーゴン【もの言わぬ石と化せ】の「ただし、自分自身のターンを終えるとき、自分自身のコマンドを1つ選び捨札にしてもよい。」

export const TIME_DRIFTER_EFFECT_ID = "rs398_time_drifter_return";
export const GORGON_DISCARD_EFFECT_ID = "rs413_gorgon_discard_command";

/** ターンを終えるときに順に尋ねる効果（RS-398 の instanceId、RS-413 は "gorgon"）。 */
export function collectSet6BTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const queue = state.players[endingPlayerId].rush.filter((c) => c.cardId === "RS-398").map((c) => c.instanceId);
  if (gorgonRestricts(state, endingPlayerId)) queue.push("gorgon");
  return queue;
}

function ninjaTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].battle
    .filter((c) => isSmallUnitNow(state, playerId, c))
    .filter((c) => unitFeatures(state, playerId, c).includes("忍者"))
    .map((c) => c.instanceId);
}

/** キューの1件を処理する（選択を開いたら選択を開いた state）。 */
export function openSet6BTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  if (entry === "gorgon") {
    if (!gorgonRestricts(state, endingPlayerId)) return state;
    const ids = state.players[endingPlayerId].command.map((c) => c.instanceId);
    if (ids.length === 0) return state;
    const gorgon = state.players[opponent(endingPlayerId)].battle.find((c) => c.cardId === "RS-413");
    return openEffectChoice(state, {
      playerId: endingPlayerId,
      effectId: GORGON_DISCARD_EFFECT_ID,
      sourceCardId: "RS-413",
      sourceInstanceId: gorgon?.instanceId,
      kind: "select_command",
      commandFilter: "any",
      phasePlayerId: endingPlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    });
  }
  const jet = state.players[endingPlayerId].rush.find((c) => c.instanceId === entry && c.cardId === "RS-398");
  if (!jet) return state;
  const ids = ninjaTargets(state, endingPlayerId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: endingPlayerId,
    effectId: TIME_DRIFTER_EFFECT_ID,
    sourceCardId: "RS-398",
    sourceInstanceId: jet.instanceId,
    kind: "select_unit",
    unitDestination: "power",
    phasePlayerId: endingPlayerId,
    validInstanceIds: ids,
    selectCount: 2,
    selectedInstanceIds: [],
    optional: true,
  });
}

function sendSelectedToPower(state: GameState, pending: PendingEffectChoice, ids: string[]): GameState {
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  for (const id of ids) {
    const moved = applyUnitLeave(next, id, "power", pending.phasePlayerId);
    if (!("error" in moved)) next = moved.state;
  }
  return next;
}

function resolveTimeDrifter(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (selected.length < 2 && remaining.length > 0) {
    // 2体まで — 1体だけで終える（skip）こともできる。
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } } };
  }
  return {
    state: sendSelectedToPower(state, pending, selected),
    log: logFor(state, playerId, "RS-398", `${TIME_DRIFTER_EFFECT_ID}:${selected.length}`),
  };
}

function skipTimeDrifter(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.length > 0) {
    return {
      state: sendSelectedToPower(state, pending, selected),
      log: logFor(state, playerId, "RS-398", `${TIME_DRIFTER_EFFECT_ID}:${selected.length}`),
    };
  }
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    log: skipLog(state, playerId, "RS-398", TIME_DRIFTER_EFFECT_ID),
  };
}

CHOICE_RESOLVERS[TIME_DRIFTER_EFFECT_ID] = resolveTimeDrifter;
CHOICE_SKIPPERS[TIME_DRIFTER_EFFECT_ID] = skipTimeDrifter;

// ---------------------------------------------------------------------------
// RS-413 冥府神ゴーゴン【もの言わぬ石と化せ】
// 「これが自軍バトルエリアにある間、相手は次の制限を受ける⇒自分自身のコマンドゾーンにあるSユニットのカードは、リリースできない。
//  ただし、自分自身のターンを終えるとき、自分自身のコマンドを1つ選び捨札にしてもよい。」

/** playerId がゴーゴンの制限を受けているか（敵軍バトルエリアにゴーゴンがある）。 */
export function gorgonRestricts(state: GameState, playerId: PlayerId): boolean {
  return state.players[opponent(playerId)].battle.some((c) => c.cardId === "RS-413");
}

/** playerId のコマンドゾーンのこのカードをリリースできないか（S ユニットのカード）。 */
export function gorgonBlocksRelease(state: GameState, playerId: PlayerId, command: CardInstance): boolean {
  if (!gorgonRestricts(state, playerId)) return false;
  const def = getDefinition(state.definitions, command.cardId);
  return def?.type === "unit" && unitSizeOf(state.definitions, command) === "S";
}

function resolveGorgonDiscard(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => {
    const cmd = p.command.find((c) => c.instanceId === instanceId);
    if (!cmd) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(cmd)] };
  });
  return {
    state: { ...next, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    log: logFor(state, playerId, "RS-413", GORGON_DISCARD_EFFECT_ID),
  };
}

CHOICE_RESOLVERS[GORGON_DISCARD_EFFECT_ID] = resolveGorgonDiscard;
CHOICE_SKIPPERS[GORGON_DISCARD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    log: skipLog(state, playerId, "RS-413", GORGON_DISCARD_EFFECT_ID),
  };
};

// ---------------------------------------------------------------------------
// RS-408 天空聖者サンジェル【プロミネンス・シャワー】
// 「これが自軍バトルエリアにある間、敵軍ユニットが「これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても
//  撃破される」の効果で撃破されたとき、その持ち主は1点ダメージを受ける。」
// サンジェルが複数あれば重複する（faq-card-6 RS-408 Q2）。通常のバトルの撃破では発動しない（Q1）。
// バトルの処理（rules/operationCounters.ts）で「勝っても撃破される」で撃破したときに呼ぶ。

export function applyProminenceShower(state: GameState, destroyedOwnerId: PlayerId): GameState {
  const sangelOwner = opponent(destroyedOwnerId);
  const count = state.players[sangelOwner].battle.filter((c) => c.cardId === "RS-408").length;
  if (count === 0) return state;
  const damaged = applyDamageToPlayer(state, destroyedOwnerId, count, { kind: "none", activePlayer: turnPlayerOf(state) });
  return {
    ...damaged,
    log: [...damaged.log, buildLogEntry(sangelOwner, "named_effect", "RS-408", state.definitions, `purominensushawa:${count}`)],
  };
}

// ---------------------------------------------------------------------------
// RS-419 聖剣ズバーン
// 「※これはSユニットかLユニットからコンビネーションしなければバトルエリアに出られない。
//  【ゴールデンクラッシュ】これがDA以外のユニットからコンビネーションするとき、次の効果を発動できる⇒
//  コンビネーションしたユニットよりもBPの低い敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」
// ジョイントコンビネーション（CN「R」）の効果なので、タンクコマンド（NC を止める）では止まらない（faq-card-6 RS-419 Q1）。
// DA と DA 以外の両方のカテゴリを持つユニットからでも発動できる（同 Q2）。

export const GOLDEN_CRUSH_EFFECT_ID = "rs419_golden_crush";

/** バトルエリアの並びの最後のユニット（これがコンビネーションする元）。ライドしているユニットは L ユニットとして扱う。 */
function lastBattleUnit(state: GameState, playerId: PlayerId, excludeInstanceId?: string): CardInstance | undefined {
  return state.players[playerId].battle.filter((c) => c.instanceId !== excludeInstanceId).at(-1);
}

function isSOrLUnitForCombo(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (card.mountedOnInstanceId) return true;
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return false;
  return unitSizeOf(state.definitions, card) === "S" || unitSizeOf(state.definitions, card) === "L" || zubaanIsLarge(state, card);
}

/** バトルエリアに出る制限（rules/restrictions.ts canMoveUnitToBattle から呼ぶ）。true なら出られない。 */
export function set6BBattleEntryBlocked(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  if (unit.cardId === "RS-419") {
    const last = lastBattleUnit(state, playerId, unit.instanceId);
    return !last || !isSOrLUnitForCombo(state, playerId, last);
  }
  return false;
}

/**
 * バトルエリアに出たときの処理（rules/combo.ts の進入処理から呼ぶ）。選択を開いたら選択を開いた state。
 * - RS-419【ゴールデンクラッシュ】
 */
export function trySet6BOnComboEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (state.pendingEffectChoice || state.phase !== "battle") return state;
  // RS-436 激気（常駐）は rules/residentAllyEnterRush.ts（文言判定）で扱う。
  if (card.cardId !== "RS-419") return state;
  const from = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!from) return state;
  const fromDef = getDefinition(state.definitions, from.cardId);
  const cats = Array.isArray(fromDef?.category) ? fromDef!.category : fromDef?.category ? [fromDef.category] : [];
  if (!cats.some((c) => c !== "DA")) return state;
  const fromBp = effectiveBp(state, playerId, from);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) < fromBp)
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: GOLDEN_CRUSH_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    unitDestination: "power",
    placeAsDamage: true,
    phasePlayerId: turnPlayerOf(state),
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

/** 場のユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く。重ねたカードは捨札。 */
function placeFieldUnitAsDamage(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = [...p.battle, ...p.rush].find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const unmount = (cards: CardInstance[]) =>
      cards.map((c) => {
        if (c.mountedOnInstanceId !== instanceId) return c;
        const { mountedOnInstanceId: _m, ...rest } = c;
        return rest as CardInstance;
      });
    return {
      ...p,
      battle: unmount(p.battle.filter((c) => c.instanceId !== instanceId)),
      rush: unmount(p.rush.filter((c) => c.instanceId !== instanceId)),
      discard: [...p.discard, ...(card.stackedCards ?? []).map((c) => stripForZone(c))],
      power: [...p.power, { ...stripForZone(card), faceDown: true }],
      damage: p.damage + 1,
    };
  });
}

function resolveGoldenCrush(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const found = findCardInField(state, instanceId);
  if (!found || found.playerId !== opponent(playerId)) return { error: "invalid_target" };
  const next = placeFieldUnitAsDamage(state, found.playerId, instanceId);
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, "RS-419", `${GOLDEN_CRUSH_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`),
  };
}

CHOICE_RESOLVERS[GOLDEN_CRUSH_EFFECT_ID] = resolveGoldenCrush;
CHOICE_SKIPPERS[GOLDEN_CRUSH_EFFECT_ID] = simpleSkip("RS-419");

// ---------------------------------------------------------------------------
// RS-420 大剣人ズバーン【ズバズバンキック】
// 「これが自軍ラッシュエリアにある間、自分が特徴「メカ」を持つLユニットをラッシュしたとき、その追加条件を満たすために捨札にした
//  合体ユニット1体につき、敵軍Sユニットを1体選び撃破してもよい。」
// 1体ずつ選んで撃破する（残りの回数を selectCount に持つ）。発動の判定は rules/batch06FieldEffects.ts tryZubazubanOnAllyRush。

export const ZUBAZUBAN_EFFECT_ID = "zubazubankiku";

function zubazubanTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => isSmallUnitNow(state, enemyId, c))
    .map((c) => c.instanceId);
}

export function openZubazubanKick(
  state: GameState,
  playerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  count: number,
): GameState {
  if (count <= 0) return state;
  const ids = zubazubanTargets(state, playerId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: ZUBAZUBAN_EFFECT_ID,
    sourceCardId: "RS-420",
    sourceInstanceId: rushedInstanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: count,
    optional: true,
  });
}

function resolveZubazuban(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const found = findCardInField(state, instanceId);
  if (!found) return { error: "invalid_target" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in leave) return leave;
  let next = leave.state;
  const log = logFor(state, playerId, "RS-420", `${ZUBAZUBAN_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`);
  const remaining = (pending.selectCount ?? 1) - 1;
  if (remaining > 0 && !next.pendingEffectChoice && !next.pendingLeave) {
    const reopened = openZubazubanKick(next, playerId, pending.sourceInstanceId ?? "", pending.phasePlayerId, remaining);
    if (reopened.pendingEffectChoice) return { state: reopened, log };
  }
  return { state: finish(next, pending), log };
}

CHOICE_RESOLVERS[ZUBAZUBAN_EFFECT_ID] = resolveZubazuban;
CHOICE_SKIPPERS[ZUBAZUBAN_EFFECT_ID] = simpleSkip("RS-420");

// ---------------------------------------------------------------------------
// RS-422 ゲキトージャ【大頑頑拳】
// 「これがアタックしてバトルに勝つたび、敵軍コマンドを1つ選びホールドしてもよい。そうしたとき、これは追加でアタックできる
//  （ストライクはできない）。」
// 追加アタックは RS-167【バキバキパンチ】と同じ「追加でアタックできる（ストライク不可）」の記録を使う。
// バトルの処理（rules/operationCounters.ts）で、アタックしたこれが勝ったときに呼ぶ。

export const DAIGANGAN_EFFECT_ID = "rs422_daigangan_ken";

export function openDaiganganKen(state: GameState, attackerId: PlayerId, attackerInstanceId: string): GameState {
  if (state.pendingEffectChoice || state.pendingLeave) return state;
  const attacker = state.players[attackerId].battle.find((c) => c.instanceId === attackerInstanceId);
  if (!attacker || !isSameCardIdentity(attacker.cardId, "RS-422")) return state;
  // RK-116 マグナギガ【そびえる巨体】: 敵軍バトルエリアにあれば、このユニットの効果ではホールドされない（atwiki/page-645。rules/rk/rk6Fields.ts）。
  // ホールドできなければ「そうしたとき」の追加アタックも得ない。
  if (rk6CommandHoldBlocked(state, opponent(attackerId), "RS-422")) return state;
  const ids = state.players[opponent(attackerId)].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: attackerId,
    effectId: DAIGANGAN_EFFECT_ID,
    sourceCardId: attacker.cardId,
    sourceInstanceId: attackerInstanceId,
    kind: "select_command",
    commandFilter: "released",
    phasePlayerId: turnPlayerOf(state),
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function resolveDaigangan(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  let next = patchPlayer(state, opponent(playerId), (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  if (pending.sourceInstanceId) {
    next = patchPlayer(next, playerId, (p) => addBakiBakiExtraAttack(p, pending.sourceInstanceId!));
  }
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-422", DAIGANGAN_EFFECT_ID) };
}

CHOICE_RESOLVERS[DAIGANGAN_EFFECT_ID] = resolveDaigangan;
CHOICE_SKIPPERS[DAIGANGAN_EFFECT_ID] = simpleSkip("RS-422");

// ---------------------------------------------------------------------------
// RS-418 冥府神イフリート【炎の眼光】
// 「これが自軍バトルエリアにある間、敵軍ユニットがＮＣの効果を発動させたとき、自軍常駐置き場からカードを1枚選び捨札にしてもよい。
//  そうしたとき、そのNCの効果を無効にする。」
// 「ナンバーに関係なく発動する」NC も NC の効果（faq-card-6 RS-418 Q）。
// 進入処理（rules/combo.ts）の NC の段階で、NC の効果を適用する前に選択を開き、決定を ncNegationDecision に記録して再開する。

export const FLAME_GLARE_EFFECT_ID = "rs418_flame_glare";

/** NC の効果を適用する前に呼ぶ。"open" なら選択を開いた state、"negate" なら無効、"apply" なら通常どおり。 */
export function checkFlameGlare(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): { decision: "apply" | "negate" } | { decision: "open"; state: GameState } {
  const recorded = state.ncNegationDecision;
  if (recorded && recorded.instanceId === card.instanceId) {
    return { decision: recorded.negate ? "negate" : "apply" };
  }
  const ownerId = opponent(playerId);
  const ifrit = state.players[ownerId].battle.find((c) => c.cardId === "RS-418");
  const ops = state.players[ownerId].operation.map((c) => c.instanceId);
  if (!ifrit || ops.length === 0 || state.pendingEffectChoice) return { decision: "apply" };
  const opened = openEffectChoice(state, {
    playerId: ownerId,
    effectId: FLAME_GLARE_EFFECT_ID,
    sourceCardId: "RS-418",
    sourceInstanceId: ifrit.instanceId,
    kind: "select_unit",
    phasePlayerId: turnPlayerOf(state),
    validInstanceIds: ops,
    selectedInstanceIds: [card.instanceId],
    selectCount: 1,
    optional: true,
  });
  return { decision: "open", state: opened };
}

/**
 * RS-421【ソウル降臨】で、ホールドしたカードの NC の効果をアカレッドの効果として発動するとき。
 * 敵軍のイフリートが無効にできれば選択を開く（grnrngr/faq-card-6 RS-421 Q5「はい、できます」）。開かなければ null。
 * 見送れば NC の効果を発動し（fireAkaRedSoulNc）、無効にすれば発動しない。
 */
export function openFlameGlareForSoulDescent(
  state: GameState,
  playerId: PlayerId,
  akaRedInstanceId: string,
  heldCardId: string,
  phasePlayerId: PlayerId,
  resumeChoice: PendingEffectChoice | undefined,
): GameState | null {
  const ownerId = opponent(playerId);
  const ifrit = state.players[ownerId].battle.find((c) => c.cardId === "RS-418");
  const ops = state.players[ownerId].operation.map((c) => c.instanceId);
  if (!ifrit || ops.length === 0 || state.pendingEffectChoice) return null;
  return openEffectChoice(state, {
    playerId: ownerId,
    effectId: FLAME_GLARE_EFFECT_ID,
    sourceCardId: "RS-418",
    sourceInstanceId: ifrit.instanceId,
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: ops,
    selectedInstanceIds: [akaRedInstanceId],
    selectCount: 1,
    optional: true,
    soulDescentMeta: { controllerId: playerId, akaRedInstanceId, heldCardId },
    resumeChoice,
  });
}

/** NC の段階を終えたら記録を消す。 */
export function clearFlameGlareDecision(state: GameState): GameState {
  return state.ncNegationDecision ? { ...state, ncNegationDecision: undefined } : state;
}

/** 無効にした NC の成立の記録（activatedNcEffects）を外す。 */
export function negateNcOnUnit(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => {
      if (c.instanceId !== instanceId || !c.activatedNcEffects) return c;
      const { activatedNcEffects: _a, ...rest } = c;
      return rest as CardInstance;
    }),
  }));
}

function resolveFlameGlare(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const target = pending.selectedInstanceIds?.[0] ?? "";
  let next = patchPlayer(state, playerId, (p) => {
    const op = p.operation.find((c) => c.instanceId === instanceId);
    if (!op) return p;
    return { ...p, operation: p.operation.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(op)] };
  });
  // 【ソウル降臨】の NC は、無効にすれば発動しない（進入処理の NC の段階の記録は使わない）。
  if (!pending.soulDescentMeta) next = { ...next, ncNegationDecision: { instanceId: target, negate: true } };
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-418", `${FLAME_GLARE_EFFECT_ID}:negate`) };
}

CHOICE_RESOLVERS[FLAME_GLARE_EFFECT_ID] = resolveFlameGlare;
CHOICE_SKIPPERS[FLAME_GLARE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.selectedInstanceIds?.[0] ?? "";
  const soul = pending.soulDescentMeta;
  if (soul) {
    // 【ソウル降臨】: 無効にしなかった — ホールドしたカードの NC の効果をアカレッドの効果として発動する。
    const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
    const fired = fireAkaRedSoulNc(cleared, soul.controllerId, soul.akaRedInstanceId, soul.heldCardId);
    const opened = fired.pendingEffectChoice;
    const next =
      opened && pending.resumeChoice ? { ...fired, pendingEffectChoice: { ...opened, resumeChoice: opened.resumeChoice ?? pending.resumeChoice } } : fired;
    return { state: opened ? next : finish({ ...next, pendingEffectChoice: pending }, pending), log: skipLog(state, playerId, "RS-418", FLAME_GLARE_EFFECT_ID) };
  }
  const next = { ...state, ncNegationDecision: { instanceId: target, negate: false } };
  return { state: finish(next, pending), log: skipLog(state, playerId, "RS-418", FLAME_GLARE_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// DSL grant_keyword（`set6b::cardId::name`）からの起点

export const SET6B_KEYWORD_PREFIX = "set6b::";

export function trySet6BCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  // RS-396【ガンマトルネード】は effect_card キーワード（Wiki スペックの期待値）で受ける。
  if (keyword === "effect_card::RS-396::ganmatorunedo") return applyGammaTornado(state, ctx);
  if (!keyword.startsWith(SET6B_KEYWORD_PREFIX)) return null;
  switch (keyword.slice(SET6B_KEYWORD_PREFIX.length)) {
    case "RS-390::five_laser":
      return openFiveLaser(state, ctx);
    case "RS-391::milk_tornado":
      return openMilkTornado(state, ctx);
    case "RS-392::first_aid":
      return openFirstAid(state, ctx);
    default:
      return { state, detail: keyword };
  }
}

// ---------------------------------------------------------------------------
// RS-429 マスター・シャーフー【暮らしの中に修行あり】（後半）
// 「また、自軍ターン中、「MA」の自軍コマンドをホールドする代わりに「WB」の自軍コマンドをホールドしてもよい。
//  ただし、追加で自軍コマンドを1つホールドすること。」
// カテゴリの支払い（rules/commandPayment.ts）で、MA を求める支払いを WB のコマンド＋追加1つ（計2つ）で行えるようにする。

export function shifuSubstituteAvailable(state: GameState, playerId: PlayerId, categories: readonly string[]): boolean {
  if (!categories.includes("MA")) return false;
  if (turnPlayerOf(state) !== playerId) return false;
  const player = state.players[playerId];
  if (!player.rush.some((c) => c.cardId === "RS-429")) return false;
  const released = player.command.filter((c) => !c.commandHeld);
  if (released.length < 2) return false;
  return released.some((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    const cats = Array.isArray(def?.category) ? def!.category : def?.category ? [def.category] : [];
    return cats.includes("WB" as never);
  });
}
