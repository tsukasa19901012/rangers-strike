/**
 * クロスギャザー ザ・Wインパクト XG3-002〜XG3-021（ラジエッカー〜カブトライジャー）のカード固有の効果（cardSpec XG3-002-021 の監査）。
 * 入口は rules/xg3/xg3Effects.ts、登録簿は rules/xg3/xg3Registry.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import { addSet8Category } from "../legend1/set8TurnGrants";
import { ZIEG_JENNE_CARD_ID } from "./xg3Fields";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { listDslEffectsForTrigger } from "../../dsl/effectLookup";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, getDefinition, parsePowerCost, unitSizeOf, effectiveBp } from "../../core/catalog";
import { countAvailablePower } from "../../core/power";
import { effectivePowerCost, opponent, drawOne } from "../../core/helpers";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer, grantSpOverrideOnPlayer } from "../playerPatches";
import { planEffectRush, startEffectRush } from "../effectRush";
import { needsZordDownPayment } from "../zordDown";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { base, close, ctxBase, fieldUnits, logFor, openAfter, proceed, skipLog, stripForZone, zoneOfField, moveFieldUnit, destroyAll, isUnitCard, selectableEnemy, openNext, pendingBase, findField } from "../rm/rm1Effects";
import { AFTER_ACTION_HOOKS, BEFORE_FLIP_HOOKS, CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, HOLD_COMPLETERS, KEYWORDS, TURN_END_HOOKS, ZONE_ACTIVATIONS, ENTER_BATTLE_HOOKS, UNIT_RUSHED_HOOKS, START_PHASE_HOOKS, STRIKE_HOOKS } from "./xg3Registry";
import { fieldHas, holdThen, nameIs, releasedCommandIds, skipThen, fieldCategories } from "./xg3Common";

// ---------------------------------------------------------------------------
// XG3-002 ラジエッカー【宇宙を走る車】
// 「これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、次の効果を発動できる⇒自軍パワーゾーンのオモテ向きのカードから、
//  必要パワーを満たしているOTのSユニットのカードを1枚選び、これの上に重ねて自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。」
//  （atwiki/page-1885）
// 起動は self_rush_from_zone（zone power, instanceId = これ）。必要パワーは、これと選ぶカードがパワーゾーンにある状態の自軍パワーで見る（コメント欄）。
// 選んだら、まずこれを自軍ラッシュエリアに出し（Q2）、選んだカードを効果のラッシュで出す（追加条件は満たす。Q1 の RS-106 を捨札にする・Q3 の
// ラジエッカーロボの追加条件にこれを捨札にする、もできる）。出たユニットは、これがまだラッシュエリアにあれば、これにライドした状態にする。
// 選ばなければ（見送れば）これはパワーゾーンに残る。

export const RADIECKER_CARD_ID = "XG3-002";
const RADIECKER_EFFECT_ID = "xg3002_space_car";

function radieckerMoved(state: GameState, playerId: PlayerId, vehicleId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const vehicle = p.power.find((c) => c.instanceId === vehicleId);
    if (!vehicle) return p;
    return { ...p, power: p.power.filter((c) => c.instanceId !== vehicleId), rush: [...p.rush, stripForZone(vehicle)] };
  });
}

function radieckerCandidates(state: GameState, playerId: PlayerId, vehicleId: string): string[] {
  const power = countAvailablePower(state, playerId);
  const moved = radieckerMoved(state, playerId, vehicleId);
  return state.players[playerId].power
    .filter((c) => {
      if (c.faceDown || c.instanceId === vehicleId) return false;
      const d = getDefinition(state.definitions, c.cardId);
      if (d?.type !== "unit" || unitSizeOf(state.definitions, c) !== "S") return false;
      if (!(cardCategories(d) as string[]).includes("OT")) return false;
      // 必要パワー「－」（任意の追加条件で必要パワーを下げる）は、これがパワーゾーンにあるまま確かめて出す。
      if (needsZordDownPayment(c.cardId, d.powerCost, d)) return planEffectRush(state, playerId, stripForZone(c), true, false) !== null;
      if (effectivePowerCost(state, playerId, parsePowerCost(d.powerCost)) > power) return false;
      return planEffectRush(moved, playerId, stripForZone(c), true, true) !== null;
    })
    .map((c) => c.instanceId);
}

ZONE_ACTIVATIONS.push({
  zone: "power",
  matches: (cardId) => isSameCardIdentity(cardId, RADIECKER_CARD_ID),
  canActivate: (state, playerId, instanceId) => {
    const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
    if (!card || card.faceDown || state.phase !== "rush" || state.activePlayer !== playerId) return false;
    if (state.pendingEffectChoice || state.pendingEffectRush) return false;
    return radieckerCandidates(state, playerId, instanceId).length > 0;
  },
  activate: (state, playerId, instanceId) =>
    openEffectChoice(state, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, RADIECKER_CARD_ID),
      effectId: RADIECKER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: radieckerCandidates(state, playerId, instanceId),
      selectCount: 1,
      optional: true,
    }),
});

CHOICE_RESOLVERS[RADIECKER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const vehicleId = pending.sourceInstanceId!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  const def = card && getDefinition(state.definitions, card.cardId);
  const down = !!def && needsZordDownPayment(def.id, def.powerCost, def);
  // 必要パワー「－」のカードは、これがパワーゾーンにあるまま（必要パワーを数えて）出し、出し終えてからこれを出してライドさせる。
  let next = down ? close(state, pending) : radieckerMoved(close(state, pending), playerId, vehicleId);
  next = { ...next, xg3: { ...next.xg3, pendingMounts: [...(next.xg3?.pendingMounts ?? []), { ownerId: playerId, unitInstanceId: instanceId, vehicleInstanceId: vehicleId, moveVehicle: down }] } };
  next = startEffectRush(next, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${RADIECKER_EFFECT_ID}_rush`,
    sourceCardId: RADIECKER_CARD_ID,
    sourceInstanceId: vehicleId,
    fromZone: "power",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: true,
    ignorePowerCost: !down,
    mandatory: true,
    forced: true,
  });
  return { state: proceed(settleMounts(next), pending), log: logFor(state, playerId, RADIECKER_CARD_ID, `${RADIECKER_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[RADIECKER_EFFECT_ID] = skipThen();

/** ラッシュエリアに出たユニットを、まだラッシュエリアにあるビークルにライドさせる（出し終えるまで待つ）。 */
function settleMounts(state: GameState): GameState {
  const mounts = state.xg3?.pendingMounts;
  if (!mounts || mounts.length === 0) return state;
  let next = state;
  const keep: typeof mounts = [];
  for (const m of mounts) {
    const p = next.players[m.ownerId];
    const unitInRush = p.rush.some((c) => c.instanceId === m.unitInstanceId);
    if (!unitInRush) {
      // まだ出している途中（追加条件の選択等）なら待つ。
      if (next.pendingEffectRush && p.power.some((c) => c.instanceId === m.unitInstanceId)) keep.push(m);
      continue;
    }
    if (m.moveVehicle) next = radieckerMoved(next, m.ownerId, m.vehicleInstanceId);
    if (!next.players[m.ownerId].rush.some((c) => c.instanceId === m.vehicleInstanceId)) continue;
    next = patchPlayer(next, m.ownerId, (pl) => ({
      ...pl,
      rush: pl.rush.map((c) => (c.instanceId === m.unitInstanceId ? { ...c, mountedOnInstanceId: m.vehicleInstanceId } : c)),
    }));
  }
  return { ...next, xg3: { ...next.xg3, pendingMounts: keep.length > 0 ? keep : undefined } };
}

AFTER_ACTION_HOOKS.push((_before, after) => settleMounts(after));

// ---------------------------------------------------------------------------
// 「自分がターンを終えるとき、自軍捨札の「X」のカードとこれを置き換える。置き換えられなければこれを捨札にする。」
// - XG3-003 ラジエッカーロボ【チーキュでは1分間しかもたない】（X＝ラジエッカー。atwiki/page-1886）
// - XG3-045 チャージアップストロンガーの※（X＝仮面ライダーストロンガー。atwiki/page-1909）
// - XG3-095 カブタックSMの※（自軍コマンドゾーンか自軍捨札の「カブタック」。atwiki/page-1958）
// 置き換えは R-REPL-04（2枚の配置を入れ替える）: X のカードがこれのいた場所（バトルエリアならバトルエリアの同じ位置）に入り、これは捨札に行く
// （撃破ではない）。候補が2枚以上なら選ぶ（強制）。

type TurnEndSwap = { cardId: string; partner: string; zones: Array<"discard" | "command"> };

const TURN_END_SWAPS: TurnEndSwap[] = [
  { cardId: "XG3-003", partner: "ラジエッカー", zones: ["discard"] },
  { cardId: "XG3-045", partner: "仮面ライダーストロンガー", zones: ["discard"] },
  { cardId: "XG3-095", partner: "カブタック", zones: ["command", "discard"] },
];
const TURN_END_SWAP_EFFECT_ID = "xg3_turn_end_swap";

function swapOf(cardId: string): TurnEndSwap | undefined {
  return TURN_END_SWAPS.find((s) => isSameCardIdentity(cardId, s.cardId));
}

function swapPartners(state: GameState, playerId: PlayerId, swap: TurnEndSwap): string[] {
  const p = state.players[playerId];
  return swap.zones.flatMap((z) => p[z].filter((c) => nameIs(state, c.cardId, swap.partner)).map((c) => c.instanceId));
}

/** 場の fieldId と、自軍の捨札・コマンドゾーンの partnerId を置き換える（fieldId は捨札へ）。 */
export function swapFieldWithZoneCard(state: GameState, playerId: PlayerId, fieldId: string, partnerId: string, phasePlayerId: PlayerId): GameState {
  const zone = zoneOfField(state, playerId, fieldId);
  const p = state.players[playerId];
  const found = zone ? p[zone].find((c) => c.instanceId === fieldId) : undefined;
  const partnerZone = (["discard", "command", "hand", "power"] as const).find((z) => p[z].some((c) => c.instanceId === partnerId));
  const partner = partnerZone ? p[partnerZone].find((c) => c.instanceId === partnerId) : undefined;
  if (!zone || !found || !partnerZone || !partner) return state;
  const moved = patchPlayer(state, playerId, (pl) => {
    const replaced = pl[zone].map((c) => (c.instanceId === fieldId ? stripForZone(partner) : c.mountedOnInstanceId === fieldId ? { ...c, mountedOnInstanceId: undefined } : c));
    const withoutPartner = { ...pl, [partnerZone]: pl[partnerZone].filter((c) => c.instanceId !== partnerId) };
    return {
      ...withoutPartner,
      [zone]: replaced,
      discard: [...withoutPartner.discard, stripForZone(found), ...(found.stackedCards ?? []).map(stripForZone)],
    };
  });
  const left = emitUnitLeftZoneAndResolve(moved, { ownerPlayerId: playerId, instanceId: fieldId, cardId: found.cardId, fromZone: zone, toZone: "discard", phasePlayerId, destroyed: false });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

function discardFieldCard(state: GameState, playerId: PlayerId, fieldId: string, phasePlayerId: PlayerId): GameState {
  const zone = zoneOfField(state, playerId, fieldId);
  const found = zone ? state.players[playerId][zone].find((c) => c.instanceId === fieldId) : undefined;
  if (!zone || !found) return state;
  const moved = patchPlayer(state, playerId, (pl) => ({
    ...pl,
    [zone]: pl[zone].filter((c) => c.instanceId !== fieldId).map((c) => (c.mountedOnInstanceId === fieldId ? { ...c, mountedOnInstanceId: undefined } : c)),
    discard: [...pl.discard, stripForZone(found), ...(found.stackedCards ?? []).map(stripForZone)],
  }));
  const left = emitUnitLeftZoneAndResolve(moved, { ownerPlayerId: playerId, instanceId: fieldId, cardId: found.cardId, fromZone: zone, toZone: "discard", phasePlayerId, destroyed: false });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

TURN_END_HOOKS.push({
  kind: "xg3swap",
  collect: (state, playerId) => {
    const p = state.players[playerId];
    return [...p.battle, ...p.rush].filter((c) => swapOf(c.cardId)).map((c) => c.instanceId);
  },
  open: (state, playerId, instanceId) => {
    const card = [...state.players[playerId].battle, ...state.players[playerId].rush].find((c) => c.instanceId === instanceId);
    const swap = card && swapOf(card.cardId);
    if (!card || !swap) return state;
    const partners = swapPartners(state, playerId, swap);
    if (partners.length === 0) return discardFieldCard(state, playerId, instanceId, playerId);
    if (partners.length === 1) return swapFieldWithZoneCard(state, playerId, instanceId, partners[0]!, playerId);
    return openEffectChoice(state, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, swap.cardId),
      effectId: TURN_END_SWAP_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: partners,
      selectCount: 1,
      optional: false,
    });
  },
});

CHOICE_RESOLVERS[TURN_END_SWAP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = swapFieldWithZoneCard(close(state, pending), playerId, pending.sourceInstanceId!, instanceId, pending.phasePlayerId);
  return { state: next, log: logFor(state, playerId, pending.sourceCardId, `${TURN_END_SWAP_EFFECT_ID}:${instanceId}`) };
};


// ---------------------------------------------------------------------------
// XG3-004 芋長の芋ヨーカン（オペレーション）
// 「特徴「怪人」を持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねた
//  ユニットは、BP+3000され、Lユニットになる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」（atwiki/page-1887）
// RK-173 鬼の鎧と同じく、このカードは選んだユニットの下に重ねる（ユニットの stackedCards）。BP+3000 は rules/xg3/xg3Fields.ts、L ユニットは
// core/catalog.ts unitSizeOf、捨札は rules/rk/rk1NamedEffects.ts settleJPowerStacks。選べるのは自軍のラッシュエリア・バトルエリアの、
// いま S で「怪人」を持つユニット（見送れない）。

const IMOYOKAN_EFFECT_ID = "xg3004_imoyokan";

function stackUnder(state: GameState, playerId: PlayerId, unitId: string, card: CardInstance, from: "discard" | "rush" | "battle" | "operation"): GameState {
  return patchPlayer(state, playerId, (p) => {
    const put = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === unitId ? { ...c, stackedCards: [...(c.stackedCards ?? []), stripForZone(card)] } : c));
    const without = { ...p, [from]: p[from].filter((c) => c.instanceId !== card.instanceId) };
    return { ...without, rush: put(without.rush), battle: put(without.battle) };
  });
}

KEYWORDS["XG3-004::imoyokan"] = (state, ctx) => {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => rk1IsSmallNow(state, c) && unitFeatures(state, ctx.playerId, c).includes("怪人"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3004:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-004"), effectId: IMOYOKAN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: IMOYOKAN_EFFECT_ID,
  };
};

CHOICE_RESOLVERS[IMOYOKAN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${pending.sourceCardId}:op`, cardId: pending.sourceCardId };
  const next = stackUnder(close(state, pending), playerId, instanceId, opCard, "discard");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-004", `${IMOYOKAN_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-006 ビクトリーウォーカー【ケミカルディスチャージャー】
// 「これが自軍エリアにある間、敵軍ターン中、オモテ向きの自軍パワーがウラ向きになるとき、ETの自軍コマンドを2つ選びホールドしてもよい。そうしたとき、
//  そのダメージは無効になる。」（atwiki/page-1888）
// パワーをウラ返す前（rules/damagePayment.ts flipPowerForDamage の「ウラ返すとき」）に、ウラ返す1枚ごとに確かめる（コメント欄「２点ダメージを受ける
// ときは１枚ずつ…その１回づつに…適用」）。ホールドするのはリリース状態の ET の自軍コマンド2つ（1つ以下なら使えない）。ホールドしたら、その1枚は
// ウラ返さず、ダメージの点数を1減らす（deferredPowerFlip を書きかえる）。

export const VICTORY_WALKER_CARD_ID = "XG3-006";
const CHEMICAL_EFFECT_ID = "xg3006_chemical_discharger";
const CHEMICAL_HOLD_EFFECT_ID = "xg3006_chemical_discharger_hold";

function chemicalAvailable(state: GameState, ownerId: PlayerId): boolean {
  if (fieldHas(state, ownerId, (id) => isSameCardIdentity(id, VICTORY_WALKER_CARD_ID)).length === 0) return false;
  return releasedCommandIds(state, ownerId, "ET").length >= 2;
}

function chemicalChoice(state: GameState, ownerId: PlayerId, phasePlayerId: PlayerId, index: number): PendingEffectChoice {
  return {
    ...base({ playerId: ownerId, phasePlayerId }, VICTORY_WALKER_CARD_ID),
    effectId: CHEMICAL_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: ["accept"],
    optional: true,
    xg3Meta: { limit: index },
  };
}

BEFORE_FLIP_HOOKS.push((state, flip) => {
  if (flip.flipIds.length === 0 || !flip.damagedOnEnemyTurn || state.pendingEffectChoice) return null;
  if (!chemicalAvailable(state, flip.playerId)) return null;
  const phasePlayerId = flip.resume.kind === "none" ? flip.resume.activePlayer : flip.resume.pending.battlePhasePlayer;
  return openEffectChoice(state, chemicalChoice(state, flip.playerId, phasePlayerId, 0));
});

/** 次の1枚（index）について確かめる。もう確かめるものがなければ閉じたまま（待たせたウラ返しは core/applyAction.ts が続ける）。 */
function chemicalNext(state: GameState, pending: PendingEffectChoice, index: number): GameState {
  const flip = state.deferredPowerFlip;
  if (!flip || index >= flip.flipIds.length || !chemicalAvailable(state, pending.playerId)) return state;
  return openEffectChoice(state, chemicalChoice(state, pending.playerId, pending.phasePlayerId, index));
}

CHOICE_SKIPPERS[CHEMICAL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const index = (pending.xg3Meta?.limit ?? 0) + 1;
  return { state: chemicalNext(close(state, pending), pending, index), log: skipLog(state, playerId, VICTORY_WALKER_CARD_ID, CHEMICAL_EFFECT_ID) };
};
CHOICE_RESOLVERS[CHEMICAL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ids = releasedCommandIds(state, playerId, "ET");
  const next = holdThen(close(state, pending), { playerId, phasePlayerId: pending.phasePlayerId }, VICTORY_WALKER_CARD_ID, CHEMICAL_HOLD_EFFECT_ID, ids, 2, {
    xg3Meta: pending.xg3Meta,
  });
  return { state: next, log: logFor(state, playerId, VICTORY_WALKER_CARD_ID, `${CHEMICAL_EFFECT_ID}:confirm`) };
};
HOLD_COMPLETERS[CHEMICAL_HOLD_EFFECT_ID] = (state, pending) => {
  const flip = state.deferredPowerFlip;
  const index = pending.xg3Meta?.limit ?? 0;
  if (!flip || index >= flip.flipIds.length) return state;
  const negated = {
    ...state,
    deferredPowerFlip: {
      ...flip,
      flipIds: flip.flipIds.filter((_, i) => i !== index),
      totalDamage: Math.max(0, flip.totalDamage - 1),
      eventAmount: Math.max(0, flip.eventAmount - 1),
    },
  };
  return chemicalNext(negated, pending, index);
};

// ---------------------------------------------------------------------------
// XG3-008 ライナーボーイ（atwiki/page-2013）
// ※「自分が「マックスライナー」をラッシュしたとき、自軍エリアに「ライナーボーイ」があれば1体選んで手札に戻す。」
//   自軍のバトルエリア・ラッシュエリアの「ライナーボーイ」から1体選ぶ（強制）。「ライナーボーイ」が何体いても1回だけ（1体だけ戻す）。
// 【ライナーコンボ】「これが特徴「人型」を持つLユニットまたはXLユニットからコンビネーションするとき、次の効果を発動できる⇒これは「SP1」になる。」
//   バトルエリアに出たとき、直前に並んでいるユニットが（カテゴリを問わず）いま「人型」を持つ L / XL なら、発動するか選ぶ（Q1: 人型でない XL は不可）。

export const LINER_BOY_CARD_ID = "XG3-008";
const LINER_RETURN_EFFECT_ID = "xg3008_liner_return";
const LINER_COMBO_EFFECT_ID = "xg3008_liner_combo";

KEYWORDS["XG3-008::liner_return"] = (state) => ({ state, detail: "xg3008:hook" });
KEYWORDS["XG3-008::liner_combo"] = (state) => ({ state, detail: "xg3008:hook" });

UNIT_RUSHED_HOOKS.push((state, rusherPlayerId, rushedInstanceId, phasePlayerId) => {
  const rushed = fieldUnits(state, rusherPlayerId).find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || !nameIs(state, rushed.cardId, "マックスライナー")) return state;
  const ids = fieldHas(state, rusherPlayerId, (id) => nameIs(state, id, "ライナーボーイ")).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, {
    ...base({ playerId: rusherPlayerId, phasePlayerId }, LINER_BOY_CARD_ID),
    effectId: LINER_RETURN_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
});

CHOICE_RESOLVERS[LINER_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "hand");
  return { state: proceed(next, pending), log: logFor(state, playerId, LINER_BOY_CARD_ID, `${LINER_RETURN_EFFECT_ID}:${instanceId}`) };
};

ENTER_BATTLE_HOOKS.push((state, playerId, card, battleBeforeEnter) => {
  if (!isSameCardIdentity(card.cardId, LINER_BOY_CARD_ID)) return state;
  const left = battleBeforeEnter[battleBeforeEnter.length - 1];
  if (!left) return state;
  const size = unitSizeOf(state.definitions, left) as string | undefined;
  if (size !== "L" && size !== "XL") return state;
  if (!unitFeatures(state, playerId, left).includes("人型")) return state;
  return openAfter(state, {
    ...base({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId }, LINER_BOY_CARD_ID),
    effectId: LINER_COMBO_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: ["accept"],
    optional: true,
  });
});

CHOICE_SKIPPERS[LINER_COMBO_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[LINER_COMBO_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => grantSpOverrideOnPlayer(p, pending.sourceInstanceId!, 1, "battle"));
  return { state: proceed(next, pending), log: logFor(state, playerId, LINER_BOY_CARD_ID, `${LINER_COMBO_EFFECT_ID}:sp1`) };
};

// ---------------------------------------------------------------------------
// XG3-009 ミント【戦いの記録】（atwiki/page-1890）
// 「自軍スタートフェイズ開始時、このユニットを捨札にして次の効果を発動できる⇒自軍ラッシュエリアから、効果名を持つテキストに「これをラッシュしたとき」と
//  書かれたユニットを1体選んでもよい。そうしたとき、そのラッシュしたときの効果を発動する。」
// スタートフェイズ開始時（rules/startPhaseBegin.ts）に、ラッシュエリアのミントごとに発動するか選ぶ（任意）。発動したらミントを捨札にし、
// 自軍ラッシュエリアの、効果名を持つ on_rush の効果（本文に「これをラッシュしたとき」）があるユニットから選ぶ（任意）。選んだユニットの
// 効果名を持つ「ラッシュしたとき」の効果だけを発動する（※の「これをラッシュしたとき」は含まない）。

export const MINT_CARD_ID = "XG3-009";
const MINT_EFFECT_ID = "xg3009_battle_record";
const MINT_PICK_EFFECT_ID = "xg3009_battle_record_pick";

KEYWORDS["XG3-009::battle_record"] = (state) => ({ state, detail: "xg3009:hook" });

function namedOnRush(cardId: string) {
  return listDslEffectsForTrigger(cardId, "on_rush").filter((e) => !!e.name && (e.text ?? "").includes("これをラッシュしたとき"));
}

START_PHASE_HOOKS.push((state, playerId) => {
  let next = state;
  for (const mint of state.players[playerId].rush.filter((c) => isSameCardIdentity(c.cardId, MINT_CARD_ID))) {
    next = openAfter(next, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: mint.instanceId }, MINT_CARD_ID),
      effectId: MINT_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: ["accept"],
      optional: true,
    });
  }
  return next;
});

CHOICE_SKIPPERS[MINT_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[MINT_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const mintId = pending.sourceInstanceId!;
  let next = close(state, pending);
  if (!next.players[playerId].rush.some((c) => c.instanceId === mintId)) return { state: proceed(next, pending), log: logFor(state, playerId, MINT_CARD_ID, `${MINT_EFFECT_ID}:gone`) };
  next = moveFieldUnit(next, playerId, mintId, pending.phasePlayerId, "discard");
  const ids = next.players[playerId].rush.filter((c) => namedOnRush(c.cardId).length > 0).map((c) => c.instanceId);
  const log = logFor(state, playerId, MINT_CARD_ID, `${MINT_EFFECT_ID}:discard`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  if (next.pendingEffectChoice) {
    return { state: openAfter(next, { ...base(pendingBase(pending), MINT_CARD_ID), effectId: MINT_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, resumeChoice: pending.resumeChoice }), log };
  }
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), MINT_CARD_ID), effectId: MINT_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    log,
  };
};

CHOICE_SKIPPERS[MINT_PICK_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[MINT_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  const logs: string[] = [];
  if (card) {
    const r = tryResolveDslTriggeredEffects({
      state: next,
      cardId: card.cardId,
      instanceId,
      playerId,
      phasePlayerId: pending.phasePlayerId,
      triggerType: "on_rush",
      logAction: "named_effect",
      effectFilter: (e) => !!e.name && (e.text ?? "").includes("これをラッシュしたとき"),
    });
    next = r.state;
    logs.push(...r.logs);
  }
  const done = proceed(next, pending);
  return { state: { ...done, log: [...done.log, ...logs] }, log: logFor(state, playerId, MINT_CARD_ID, `${MINT_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-010 ジークジェンヌ【ジークの命】（atwiki/page-1891）
// 重ねる起動は既存の stack_da_less_l_on_rush。「このカードに重ねたユニットは、次の能力を得る⇒自軍ターン中、これがバトルエリアに出たとき、これを
// ホールドしてもよい。そうしたとき、敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。」: 下にジークジェンヌを重ねたユニットがバトルエリアに
// 出たとき（自軍ターン中）、ホールドするか選ぶ（任意）。ホールドしたら敵軍ユニット（エリア・サイズ・BP を問わない）を1体選び（強制）、持ち主の
// パワーゾーンへ（オモテ向き）送る。

const ZIEG_EFFECT_ID = "xg3010_zieg_life";
const ZIEG_PICK_EFFECT_ID = "xg3010_zieg_life_pick";

ENTER_BATTLE_HOOKS.push((state, playerId, card) => {
  if (state.activePlayer !== playerId) return state;
  const copies = (card.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, ZIEG_JENNE_CARD_ID)).length;
  let next = state;
  for (let i = 0; i < copies; i++) {
    next = openAfter(next, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, ZIEG_JENNE_CARD_ID),
      effectId: ZIEG_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: ["accept"],
      optional: true,
    });
  }
  return next;
});

CHOICE_SKIPPERS[ZIEG_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[ZIEG_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const unitId = pending.sourceInstanceId!;
  let next = close(state, pending);
  const unit = next.players[playerId].battle.find((c) => c.instanceId === unitId);
  const log = logFor(state, playerId, ZIEG_JENNE_CARD_ID, `${ZIEG_EFFECT_ID}:hold`);
  if (!unit || unit.commandHeld) return { state: proceed(next, pending), log };
  next = patchPlayer(next, playerId, (p) => ({ ...p, battle: p.battle.map((c) => (c.instanceId === unitId ? { ...c, commandHeld: true } : c)) }));
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => selectableEnemy(next, playerId, ZIEG_JENNE_CARD_ID, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...base(pendingBase(pending), ZIEG_JENNE_CARD_ID), effectId: ZIEG_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};

CHOICE_RESOLVERS[ZIEG_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, ZIEG_JENNE_CARD_ID, `${ZIEG_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-011 獣魔ハンター・ジーク【ジークブラスター】は継続効果（rules/xg3/xg3Fields.ts xg3EffectiveSp / xg3FieldBpBonus）。

KEYWORDS["XG3-011::zieg_blaster"] = (state) => ({ state, detail: "xg3011:static" });

// ---------------------------------------------------------------------------
// XG3-012 獣装光ギンガレッド【閃光星獣剣】（atwiki/page-2011）
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからナンバーを持たないSユニットを1体選びゲームから除外する。」（強制）
// 除外は撃破ではない（捨札に置かない）。下に重ねたカード・ライドしているビークルは捨札。

const GINGA_EFFECT_ID = "xg3012_senko_seijuken";

KEYWORDS["XG3-012::senko_seijuken"] = (state, ctx) => {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "xg3012:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && getDefinition(state.definitions, c.cardId)?.comboNumber === undefined && selectableEnemy(state, ctx.playerId, "XG3-012", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3012:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-012"), effectId: GINGA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: GINGA_EFFECT_ID,
  };
};

/** 場のユニットをゲームから除外する（撃破ではない）。 */
export function exileFieldUnit(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const found = zone ? state.players[ownerId][zone].find((c) => c.instanceId === instanceId) : undefined;
  if (!zone || !found) return state;
  const moved = patchPlayer(state, ownerId, (p) => ({
    ...p,
    [zone]: p[zone].filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c)),
    exile: [...(p.exile ?? []), stripForZone(found)],
    discard: [...p.discard, ...(found.stackedCards ?? []).map(stripForZone)],
  }));
  const left = emitUnitLeftZoneAndResolve(moved, { ownerPlayerId: ownerId, instanceId, cardId: found.cardId, fromZone: zone, toZone: "exile", phasePlayerId, destroyed: false });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

CHOICE_RESOLVERS[GINGA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = exileFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-012", `${GINGA_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// ガオレンジャー XG3-013 ガオポーラー【冷凍光線】・XG3-015 ガオベアー【氷牙炎滅ベアーストライク】（「〜からコンビネーションするとき」）
// コンビネーションは、バトルエリアに出たユニットと、その直前に並んでいるユニット（rules/combo.ts の battleBeforeEnter の最後）で見る。
// カテゴリ・ナンバーを問わない（カード評価「カテゴリが一致していなくてもJCが発動できる」「ナンバーに関係なくSPを得ることができる」）。
// - XG3-013: 「ガオベアー」か、いま特徴「人型」を持つ L ユニットがこれからコンビネーションするとき、そのユニットの（いまの）BP 以下の BP を持つ
//   敵軍ユニット（エリアを問わない）を1体選びホールドする。選ぶことが発動の宣言（見送れる）。
// - XG3-015: これが「ガオポーラー」か「人型」の L ユニットからコンビネーションするとき、ホールド状態の敵軍ユニット（エリアを問わない）を1体選び
//   撃破する。また、自軍バトルエリアに「ガオポーラー」と「人型」の L ユニットがあれば、これは「SP1」になる。選ぶことが発動の宣言（見送れる。
//   ホールド状態の敵軍ユニットがいなければ、SP1 にできるときだけ発動するか選ぶ）。

const POLAR_EFFECT_ID = "xg3013_reito_kosen";
const BEAR_EFFECT_ID = "xg3015_bear_strike";
const BEAR_SP_EFFECT_ID = "xg3015_bear_strike_sp";

KEYWORDS["XG3-013::reito_kosen"] = (state) => ({ state, detail: "xg3013:hook" });
KEYWORDS["XG3-015::bear_strike"] = (state) => ({ state, detail: "xg3015:hook" });

function isHumanL(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return unitSizeOf(state.definitions, card) === "L" && unitFeatures(state, playerId, card).includes("人型");
}

function bearSpApplies(state: GameState, playerId: PlayerId): boolean {
  const battle = state.players[playerId].battle;
  return battle.some((c) => nameIs(state, c.cardId, "ガオポーラー")) && battle.some((c) => isHumanL(state, playerId, c));
}

function bearSp(state: GameState, playerId: PlayerId, bearId: string): GameState {
  if (!bearSpApplies(state, playerId)) return state;
  return patchPlayer(state, playerId, (p) => grantSpOverrideOnPlayer(p, bearId, 1, "battle"));
}

ENTER_BATTLE_HOOKS.push((state, playerId, card, battleBeforeEnter) => {
  const left = battleBeforeEnter[battleBeforeEnter.length - 1];
  if (!left) return state;
  let next = state;
  // 同時に誘発したときは、出たユニット自身の効果（XG3-015）を先に処理する。
  if (isSameCardIdentity(card.cardId, "XG3-015") && (nameIs(state, left.cardId, "ガオポーラー") || isHumanL(state, playerId, left))) {
    const enemyId = opponent(playerId);
    const ids = fieldUnits(state, enemyId)
      .filter((c) => c.commandHeld && selectableEnemy(state, playerId, "XG3-015", c))
      .map((c) => c.instanceId);
    const ctx = { playerId, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId };
    if (ids.length > 0) {
      next = openAfter(next, { ...base(ctx, "XG3-015"), effectId: BEAR_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
    } else if (bearSpApplies(state, playerId)) {
      next = openAfter(next, { ...base(ctx, "XG3-015"), effectId: BEAR_SP_EFFECT_ID, kind: "confirm", validInstanceIds: ["accept"], optional: true });
    }
  }
  if (isSameCardIdentity(left.cardId, "XG3-013") && (nameIs(state, card.cardId, "ガオベアー") || isHumanL(state, playerId, card))) {
    const bp = effectiveBp(state, playerId, card);
    const enemyId = opponent(playerId);
    const ids = fieldUnits(state, enemyId)
      .filter((c) => effectiveBp(state, enemyId, c) <= bp && selectableEnemy(state, playerId, "XG3-013", c))
      .map((c) => c.instanceId);
    if (ids.length > 0) {
      next = openAfter(next, {
        ...base({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: left.instanceId }, "XG3-013"),
        effectId: POLAR_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
      });
    }
  }
  return next;
});

CHOICE_SKIPPERS[POLAR_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[POLAR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-013", `${POLAR_EFFECT_ID}:${instanceId}`) };
};

CHOICE_SKIPPERS[BEAR_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[BEAR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = bearSp(close(state, pending), playerId, pending.sourceInstanceId!);
  next = destroyAll(next, pendingBase(pending), "XG3-015", BEAR_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-015", `${BEAR_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[BEAR_SP_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[BEAR_SP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = bearSp(close(state, pending), playerId, pending.sourceInstanceId!);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-015", `${BEAR_SP_EFFECT_ID}:sp1`) };
};

// ---------------------------------------------------------------------------
// XG3-014 ガオマッスル【剛力無双マッスルラリアット】（atwiki/page-1972）
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを2つ選びホールドしてもよい。そうしたとき、敵軍バトルエリアからユニットを1体選び撃破する。」
// リリース状態の自軍コマンドが2つ以上あるときだけ発動するか選ぶ（任意）。ホールドしたら敵軍バトルエリアのユニット（サイズ・BP を問わない）を
// 1体選び撃破する（強制）。

const MUSCLE_EFFECT_ID = "xg3014_muscle_lariat";
const MUSCLE_HOLD_EFFECT_ID = "xg3014_muscle_lariat_hold";
const MUSCLE_PICK_EFFECT_ID = "xg3014_muscle_lariat_pick";

KEYWORDS["XG3-014::muscle_lariat"] = (state, ctx) => {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "xg3014:not_own_turn" };
  if (releasedCommandIds(state, ctx.playerId).length < 2) return { state, detail: "xg3014:no_commands" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-014"), effectId: MUSCLE_EFFECT_ID, kind: "confirm", validInstanceIds: ["accept"], optional: true }),
    detail: MUSCLE_EFFECT_ID,
  };
};

CHOICE_SKIPPERS[MUSCLE_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[MUSCLE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ids = releasedCommandIds(state, playerId);
  const next = holdThen(close(state, pending), pendingBase(pending), "XG3-014", MUSCLE_HOLD_EFFECT_ID, ids, 2, { resumeChoice: pending.resumeChoice });
  return { state: next, log: logFor(state, playerId, "XG3-014", `${MUSCLE_EFFECT_ID}:confirm`) };
};
HOLD_COMPLETERS[MUSCLE_HOLD_EFFECT_ID] = (state, pending) => {
  const enemyId = opponent(pending.playerId);
  const ids = state.players[enemyId].battle.filter((c) => isUnitCard(state, c.cardId) && selectableEnemy(state, pending.playerId, "XG3-014", c)).map((c) => c.instanceId);
  if (ids.length === 0) return proceed(state, pending);
  return openNext(state, pending, { ...base(pendingBase(pending), "XG3-014"), effectId: MUSCLE_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
};
CHOICE_RESOLVERS[MUSCLE_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-014", MUSCLE_PICK_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-014", `${MUSCLE_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-016 ガオゴリラ【バナナボム】（atwiki/page-1894）
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからホールド状態の敵軍ユニットを1体選び撃破してもよい。」
// 選ぶことが発動の宣言（見送れる）。サイズを問わない。

const BANANA_EFFECT_ID = "xg3016_banana_bomb";

KEYWORDS["XG3-016::banana_bomb"] = (state, ctx) => {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "xg3016:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => c.commandHeld && isUnitCard(state, c.cardId) && selectableEnemy(state, ctx.playerId, "XG3-016", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3016:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-016"), effectId: BANANA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: BANANA_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[BANANA_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[BANANA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-016", BANANA_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-016", `${BANANA_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-017 猛獣使いオルグ【猛獣使いの鞭】（atwiki/page-1895）
// 「自軍ターン中、これがバトルエリアに出たとき、特徴「獣」を持つユニットを2体選んでもよい。そうしたとき、選んだ2体でバトルする。」
// 自軍・敵軍、ラッシュエリア・バトルエリアを問わず、いま「獣」を持つユニットから1体ずつ選ぶ（1体目を選ぶことが発動の宣言。2体目は見送れない）。
// 選んだ2体でバトルし、BP の低いほう（同じなら両方）を撃破する（R-BTL-02。BK-006 トルネードと同じ）。

const WHIP_EFFECT_ID = "xg3017_whip";
const WHIP_SECOND_EFFECT_ID = "xg3017_whip_second";

function ownerOfField(state: GameState, instanceId: string): PlayerId | null {
  for (const pid of ["player1", "player2"] as const) if (findField(state, pid, instanceId)) return pid;
  return null;
}

function beastIds(state: GameState, playerId: PlayerId): string[] {
  return (["player1", "player2"] as const).flatMap((pid) =>
    fieldUnits(state, pid)
      .filter((c) => unitFeatures(state, pid, c).includes("獣") && (pid === playerId || selectableEnemy(state, playerId, "XG3-017", c)))
      .map((c) => c.instanceId),
  );
}

KEYWORDS["XG3-017::whip"] = (state, ctx) => {
  if (state.activePlayer !== ctx.playerId) return { state, detail: "xg3017:not_own_turn" };
  const ids = beastIds(state, ctx.playerId);
  if (ids.length < 2) return { state, detail: "xg3017:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-017"), effectId: WHIP_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: WHIP_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[WHIP_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[WHIP_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const ids = beastIds(next, playerId).filter((id) => id !== instanceId);
  if (ids.length === 0) return { state: proceed(next, pending) };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG3-017"), effectId: WHIP_SECOND_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, xg3Meta: { picked: [instanceId] } }),
    log: logFor(state, playerId, "XG3-017", `${WHIP_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_RESOLVERS[WHIP_SECOND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const firstId = pending.xg3Meta?.picked?.[0];
  const aOwner = firstId ? ownerOfField(next, firstId) : null;
  const bOwner = ownerOfField(next, instanceId);
  const a = aOwner && firstId ? findField(next, aOwner, firstId) : undefined;
  const b = bOwner ? findField(next, bOwner, instanceId) : undefined;
  if (!a || !b || !aOwner || !bOwner) return { state: proceed(next, pending) };
  const bpA = effectiveBp(next, aOwner, a);
  const bpB = effectiveBp(next, bOwner, b);
  const losers: string[] = [];
  if (bpA <= bpB) losers.push(a.instanceId);
  if (bpB <= bpA) losers.push(b.instanceId);
  const done = destroyAll(next, pendingBase(pending), "XG3-017", `${WHIP_SECOND_EFFECT_ID}_battle`, losers);
  return { state: proceed(done, pending), log: logFor(state, playerId, "XG3-017", `${WHIP_SECOND_EFFECT_ID}:${bpA}vs${bpB}`) };
};

// ---------------------------------------------------------------------------
// カラクリボール XG3-018 スピンビー【暴れ独楽】・XG3-019 キャッチスパイダー【カラクリボール奪還】（atwiki/page-1896・page-1897）
// 「このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒これがストライクしたとき、…」
// L ユニットがバトルエリアに出たとき、直前に並んでいるのがこれで、いまのカテゴリを1つでも共有すれば、その L ユニットが能力を得る
// （state.xg3.strikeGrants。そのターン、両方がバトルエリアにある間）。ストライクしたとき（宣言時。ダメージを与えたときではない。コメント欄）:
// - XG3-018: 追加条件を持たない敵軍ユニット（エリア・サイズを問わない）を1体選び（強制）、持ち主の手札に戻す。
// - XG3-019: 自分は1枚ドローする。

const SPIN_BEE_EFFECT_ID = "xg3018_abare_goma";

KEYWORDS["XG3-018::abare_goma"] = (state) => ({ state, detail: "xg3018:hook" });
KEYWORDS["XG3-019::karakuri_ball"] = (state) => ({ state, detail: "xg3019:hook" });

const KARAKURI = ["XG3-018", "XG3-019"];

ENTER_BATTLE_HOOKS.push((state, playerId, card, battleBeforeEnter) => {
  const left = battleBeforeEnter[battleBeforeEnter.length - 1];
  if (!left) return state;
  const src = KARAKURI.find((id) => isSameCardIdentity(left.cardId, id));
  if (!src || unitSizeOf(state.definitions, card) !== "L") return state;
  const mine = fieldCategories(state, playerId, card);
  if (!fieldCategories(state, playerId, left).some((c) => mine.includes(c))) return state;
  const grant = { ownerId: playerId, instanceId: card.instanceId, partnerInstanceId: left.instanceId, sourceCardId: src, turn: state.turn };
  return { ...state, xg3: { ...state.xg3, strikeGrants: [...(state.xg3?.strikeGrants ?? []).filter((g) => g.turn === state.turn), grant] } };
});

STRIKE_HOOKS.push((state, playerId, striker) => {
  const battle = state.players[playerId].battle;
  const grants = (state.xg3?.strikeGrants ?? []).filter(
    (g) => g.turn === state.turn && g.ownerId === playerId && g.instanceId === striker.instanceId && battle.some((c) => c.instanceId === g.partnerInstanceId),
  );
  let next = state;
  for (const g of grants) {
    if (g.sourceCardId === "XG3-019") {
      next = patchPlayer(next, playerId, (p) => drawOne(p));
      next = { ...next, log: [...next.log, logFor(next, playerId, "XG3-019", "xg3019_karakuri_ball:draw")] };
      continue;
    }
    const enemyId = opponent(playerId);
    const ids = fieldUnits(next, enemyId)
      .filter((c) => !getDefinition(next.definitions, c.cardId)?.rushAdditionalCondition && selectableEnemy(next, playerId, "XG3-018", c))
      .map((c) => c.instanceId);
    if (ids.length === 0) continue;
    next = openAfter(next, {
      ...base({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: striker.instanceId }, "XG3-018"),
      effectId: SPIN_BEE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    });
  }
  return next;
});

CHOICE_RESOLVERS[SPIN_BEE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "hand");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-018", `${SPIN_BEE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-020 クワガライジャー【迅雷流剣技・雷牙一閃】（NC。atwiki/page-1961）
// 「敵軍Sユニットを1体選び、カテゴリを1つ宣言する。このターン、宣言したカテゴリを選んだユニットに追加する。」
// 敵軍 S ユニット（エリアを問わない）を選び（強制）、カテゴリを宣言する。追加は RS-524 呉越同舟と同じターンの補正（rules/legend1/set8TurnGrants.ts）。

const KUWAGA_EFFECT_ID = "xg3020_raiga_issen";
const KUWAGA_DECLARE_EFFECT_ID = "xg3020_raiga_issen_declare";
const DECLARABLE_CATEGORIES = ["WB", "OT", "ET", "MA", "DA"] as const;

KEYWORDS["XG3-020::raiga_issen"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId).filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG3-020", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3020:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-020"), effectId: KUWAGA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: KUWAGA_EFFECT_ID,
  };
};
CHOICE_RESOLVERS[KUWAGA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: openNext(close(state, pending), pending, {
      ...base(pendingBase(pending), "XG3-020"),
      effectId: KUWAGA_DECLARE_EFFECT_ID,
      kind: "declare_number",
      validInstanceIds: [...DECLARABLE_CATEGORIES],
      optional: false,
      xg3Meta: { targetInstanceId: instanceId },
    }),
    log: logFor(state, playerId, "XG3-020", `${KUWAGA_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_RESOLVERS[KUWAGA_DECLARE_EFFECT_ID] = (state, playerId, category) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.xg3Meta?.targetInstanceId;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  if (target && findField(next, enemyId, target)) {
    next = patchPlayer(next, enemyId, (p) => addSet8Category(p, target, category as (typeof DECLARABLE_CATEGORIES)[number], "XG3-020"));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-020", `${KUWAGA_DECLARE_EFFECT_ID}:${category}`) };
};

// ---------------------------------------------------------------------------
// XG3-021 カブトライジャー【迅雷流剣技・カブト雷撃破】（NC。atwiki/page-1960）
// 「敵軍バトルエリアから、DAを持つSユニットを1体選び撃破してもよい。そうして撃破したユニットが捨札になったとき、選んだユニットの本来のSPが1以上
//  だったなら、敵軍捨札からカードを1枚選び、持ち主のパワーゾーンにダメージにして置く。」
// 選ぶことが発動の宣言（見送れる）。撃破したユニットが敵軍捨札にあり（レジスト等で留まっていない）、印刷の SP が1以上なら、敵軍捨札から
// 1枚選び（強制。撃破したカードも選べる）、ウラ向きでパワーゾーンに置く（ダメージ+1）。

const KABUTO_EFFECT_ID = "xg3021_kabuto_raigekiha";
const KABUTO_DAMAGE_EFFECT_ID = "xg3021_kabuto_raigekiha_damage";

KEYWORDS["XG3-021::kabuto_raigekiha"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && fieldCategories(state, enemyId, c).includes("DA") && selectableEnemy(state, ctx.playerId, "XG3-021", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3021:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-021"), effectId: KABUTO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: KABUTO_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[KABUTO_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[KABUTO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = findField(state, enemyId, instanceId);
  const sp = card ? getDefinition(state.definitions, card.cardId)?.sp : undefined;
  let next = destroyAll(close(state, pending), pendingBase(pending), "XG3-021", KABUTO_EFFECT_ID, [instanceId]);
  const log = logFor(state, playerId, "XG3-021", `${KABUTO_EFFECT_ID}:${instanceId}`);
  const inDiscard = next.players[enemyId].discard.some((c) => c.instanceId === instanceId);
  if (!inDiscard || typeof sp !== "number" || sp < 1 || next.players[enemyId].discard.length === 0) return { state: proceed(next, pending), log };
  const choice: PendingEffectChoice = {
    ...base(pendingBase(pending), "XG3-021"),
    effectId: KABUTO_DAMAGE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: next.players[enemyId].discard.map((c) => c.instanceId),
    selectCount: 1,
    optional: false,
  };
  next = next.pendingEffectChoice ? openAfter(next, { ...choice, resumeChoice: pending.resumeChoice }) : openNext(next, pending, choice);
  return { state: next, log };
};
CHOICE_RESOLVERS[KABUTO_DAMAGE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), power: [...p.power, { ...stripForZone(card), faceDown: true }], damage: p.damage + 1 };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-021", `${KABUTO_DAMAGE_EFFECT_ID}:${instanceId}`) };
};
