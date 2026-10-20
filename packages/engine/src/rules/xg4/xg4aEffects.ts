/**
 * クロスギャザー ザ・ジェットアクセル XG4-001〜XG4-021（牛靴仮面〜カラクリマント）のカード固有の効果（cardSpec XG4-001-021 の監査）。
 * DSL の grant_keyword（`xg4::cardId::name`）と、ほかの処理の場所から呼ぶ起点（rules/xg4/xg4Hooks.ts）の中身。
 * 継続効果の判定は rules/xg4/xg4Fields.ts。選択の組み立ては rules/rm/rm1Effects.ts と同じ部品を使う。
 */
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, effectiveBp, getDefinition, unitSizeOf } from "../../core/catalog";
import { opponent, performDeckDraws } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { startEffectRush } from "../effectRush";
import { recordReveal, revealedCards } from "../revealNotice";
import { holdFieldUnit } from "../errataCardEffects";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rm1CostNumber } from "../rm/rm1Fields";
import {
  base,
  close,
  confirmChoice,
  ctxBase,
  fieldUnits,
  findField,
  genericPick,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";
import { unitFeatures } from "../addedFeatures";
import {
  XG4_CONFIRMERS,
  XG4_KEYWORDS,
  XG4_RESOLVERS,
  XG4_SKIPPERS,
  addTurnRecord,
  allFieldUnits,
  defOf,
  exileFieldUnit,
  hasTurnRecordFor,
  isCard,
  isSUnitCard,
  noop,
  printedFeatures,
} from "./xg4Common";
import { DRAGON_ARMOR_CARD_ID, XG4_HARIKEN_RULE, XG4_RUSH_DISCARD_RULE as RUSH_DISCARD_RULE_ID } from "./xg4Fields";

function ownTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

function costNumber(state: GameState, cardId: string): number {
  return rm1CostNumber(state, cardId);
}

// ---------------------------------------------------------------------------
// XG4-001 牛靴仮面【黒十字ハリケーン】（NC）— このターンの記録だけ（BP・SP は rules/xg4/xg4Fields.ts）。

XG4_KEYWORDS["XG4-001::hariken"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4001:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, XG4_HARIKEN_RULE, "XG4-001", { instanceId: id }), detail: "xg4001:hariken" };
};

// ---------------------------------------------------------------------------
// XG4-002 テレビ仮面【TV受像機】（NC）
// 「自軍山札の上から1枚をオモテにする。オモテにしたカードがSユニットのカードなら自軍ラッシュエリアに出す。このとき、出したユニットの効果は発動しない。
//  それ以外なら捨札にする。この効果で出したユニットは、このターン、アタックもストライクもできず、このターンを終えるとき、自軍エリアにあれば捨札にする。」
// （atwiki/page-2093）。出すのは効果のラッシュ（必要パワー・追加条件は問わない）。効果を止めるのは DSL の本文（rules/pendingChoices.ts
// suppressesDeployedUnitEffects。効果のラッシュの effectId を DSL の効果 id「tv」にする）。アタック・ストライクの禁止は battleActed、
// ターン終了時の捨札は tempDiscardAtTurnEnd（XG3-069 カメンライドと同じ。rules/riderKickEffects.ts）。

XG4_KEYWORDS["XG4-002::tv"] = (state, ctx) => {
  const pid = ctx.playerId;
  const top = state.players[pid].deck[0];
  if (!top) return { state, detail: "xg4002:empty_deck" };
  const isS = isSUnitCard(state, top);
  let next = recordReveal(state, {
    playerId: pid,
    ownerId: pid,
    sourceCardId: "XG4-002",
    effectLabel: "TV受像機",
    from: "deck_top",
    cards: revealedCards([top], isS ? "rush" : "discard"),
  });
  if (!isS) {
    next = patchPlayer(next, pid, (p) => ({ ...p, deck: p.deck.slice(1), discard: [...p.discard, stripForZone(top)] }));
    return { state: next, detail: "xg4002:discard" };
  }
  next = startEffectRush(next, {
    playerId: pid,
    phasePlayerId: ctx.phasePlayerId,
    effectId: "tv",
    sourceCardId: "XG4-002",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    fromZone: "deck",
    candidates: [top.instanceId],
    maxCount: 1,
    requireConditions: false,
    mandatory: true,
    forced: true,
  });
  next = patchPlayer(next, pid, (p) => ({
    ...p,
    rush: p.rush.map((c) => (c.instanceId === top.instanceId ? { ...c, battleActed: true, tempDiscardAtTurnEnd: true } : c)),
  }));
  return { state: next, detail: "xg4002:rush" };
};

// ---------------------------------------------------------------------------
// XG4-005 バギバギルガー－【バキバキビックサンダー】（ラッシュしたとき）
// 「必要パワーの数字が3以下の敵軍ユニットを1体選びホールドしてもよい。」（atwiki/page-2087）。エリア・サイズを問わない。数字は「+」「-」を除く。

const BAKIBAKI_EFFECT_ID = "xg4005_bakibaki";

XG4_KEYWORDS["XG4-005::bakibaki"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return Number.isFinite(n) && n <= 3 && selectableEnemy(state, ctx.playerId, "XG4-005", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4005:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-005"), effectId: BAKIBAKI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: BAKIBAKI_EFFECT_ID,
  };
};

XG4_RESOLVERS[BAKIBAKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdFieldUnit(close(state, pending), opponent(playerId), instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-005", `${BAKIBAKI_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[BAKIBAKI_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-006 ドラゴンアーマー（オペレーション）
// 「カテゴリにWBを持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねた
//  ユニットはBP+1000され、特徴「獣奏剣」が追加される。重ねたユニットがユニットでなくなるとき、このカードを持ち主の手札に戻す。」（atwiki/page-2061）
// RM-009 マルチパックと同じく、このカードは選んだユニットの下に重ねる（ユニットの stackedCards）。BP・特徴は rules/xg4/xg4Fields.ts。
// ユニットでなくなったとき（場以外のゾーンに移ったユニットの下に残っているとき）は持ち主の手札に戻す（applyXg4aAfterAction）。

const ARMOR_EFFECT_ID = "xg4006_dragon_armor";

XG4_KEYWORDS["XG4-006::dragon_armor"] = (state, ctx) => {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => rk1IsSmallNow(state, c) && cardCategories(getDefinition(state.definitions, c.cardId)).includes("WB"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4006:no_targets" };
  return {
    state: openAfter(state, {
      ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.operationInstanceId }, DRAGON_ARMOR_CARD_ID),
      effectId: ARMOR_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    detail: ARMOR_EFFECT_ID,
  };
};

XG4_RESOLVERS[ARMOR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? `${DRAGON_ARMOR_CARD_ID}:op`, cardId: DRAGON_ARMOR_CARD_ID };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle), discard: p.discard.filter((c) => c.instanceId !== opCard.instanceId), hand: p.hand.filter((c) => c.instanceId !== opCard.instanceId) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, DRAGON_ARMOR_CARD_ID, `${ARMOR_EFFECT_ID}:${instanceId}`) };
};

/** 場以外のゾーンにあるカードの下に残ったドラゴンアーマーを、持ち主の手札に戻す。 */
function settleDragonArmor(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const zones = ["power", "discard", "hand", "deck", "command", "exile"] as const;
    const p = next.players[pid];
    const has = (c: CardInstance) => (c.stackedCards ?? []).some((s) => isCard(s.cardId, DRAGON_ARMOR_CARD_ID));
    if (!zones.some((z) => (p[z] ?? []).some(has))) continue;
    const freed: CardInstance[] = [];
    const patched: Partial<Record<(typeof zones)[number], CardInstance[]>> = {};
    for (const z of zones) {
      const cards = p[z] ?? [];
      if (!cards.some(has)) continue;
      patched[z] = cards.map((c) => {
        if (!has(c)) return c;
        const stacked = c.stackedCards ?? [];
        freed.push(...stacked.filter((s) => isCard(s.cardId, DRAGON_ARMOR_CARD_ID)).map(stripForZone));
        const rest = stacked.filter((s) => !isCard(s.cardId, DRAGON_ARMOR_CARD_ID));
        if (rest.length > 0) return { ...c, stackedCards: rest };
        const { stackedCards: _s, ...without } = c;
        return without;
      });
    }
    next = patchPlayer(next, pid, (pl) => ({ ...pl, ...patched, hand: [...(patched.hand ?? pl.hand), ...freed] }));
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG4-009 オートスライダー【緊急出動】（ラッシュしたとき）
// 「次の効果を発動できる⇒自軍コマンドゾーンからリリース状態のSユニットのカードを1枚選び、これの上に重ねて自軍ラッシュエリアに出してもよい。
//  ただし、必要パワーと追加条件は満たすこと。」（atwiki/page-2083）。出すのは効果のラッシュ（必要パワー・追加条件を満たす。R-RUSH-21）。
// 出したユニットはこれにライドした状態で出る（カード評価「これにライドした状態でラッシュされる」。PendingEffectRush.mountOnInstanceId）。

XG4_KEYWORDS["XG4-009::kinkyu_shutsudo"] = (state, ctx) => {
  const vehicleId = ctx.triggerSourceInstanceId;
  if (!vehicleId || !findField(state, ctx.playerId, vehicleId)) return { state, detail: "xg4009:no_vehicle" };
  const ids = state.players[ctx.playerId].command.filter((c) => !c.commandHeld && isSUnitCard(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4009:no_candidates" };
  const next = startEffectRush(state, {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    effectId: "xg4009_kinkyu_shutsudo",
    sourceCardId: "XG4-009",
    sourceInstanceId: vehicleId,
    fromZone: "command",
    candidates: ids,
    maxCount: 1,
    requireConditions: true,
    alwaysAsk: true,
    mountOnInstanceId: vehicleId,
  });
  return { state: next, detail: "xg4009:kinkyu_shutsudo" };
};

// ---------------------------------------------------------------------------
// XG4-010 獣装光ギンガブルー【閃光星獣剣】（NC）
// 「「SP1」これが敵軍ユニットをバトルで撃破したとき、撃破したユニットを捨札にする代わりにゲームから除外してもよい。そうしたとき、自分は1枚ドローする。」
// （atwiki/page-2103）。NC が成立したターンの記録。撃破して捨札になったところで、除外するかを確認する（xg4aOnBattleDestroy）。

const SENKO_RULE = "xg4_010_senko";
const SENKO_EFFECT_ID = "xg4010_senko_exile";

XG4_KEYWORDS["XG4-010::senko"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4010:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, SENKO_RULE, "XG4-010", { instanceId: id }), detail: "xg4010:senko" };
};

XG4_RESOLVERS[SENKO_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[SENKO_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[SENKO_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = (pending.xg4Meta?.owner as PlayerId | undefined) ?? opponent(playerId);
  const id = pending.xg4Meta?.target as string | undefined;
  let next = close(state, pending);
  const card = next.players[ownerId].discard.find((c) => c.instanceId === id);
  if (card) {
    next = patchPlayer(next, ownerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== id), exile: [...(p.exile ?? []), stripForZone(card)] }));
    next = patchPlayer(next, playerId, (p) => performDeckDraws(p, 1, "top"));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-010", `${SENKO_EFFECT_ID}:${card ? "exiled" : "missing"}`) };
};

// ---------------------------------------------------------------------------
// XG4-011 獣装光ギンガグリーン【銀河の戦光】（NC）
// 「本来の特徴に「ギンガの光」を持つユニットが5体以上あれば、敵軍バトルエリアのユニットをすべてゲームから除外する。」（atwiki/page-2099）
// 両軍の場のユニットを数える（コメント欄「相手の場にいるやつでもおk」）。

XG4_KEYWORDS["XG4-011::ginga_no_senko"] = (state, ctx) => {
  const count = allFieldUnits(state).filter(({ card }) => printedFeatures(state, card.cardId).includes("ギンガの光")).length;
  if (count < 5) return { state, detail: `xg4011:count:${count}` };
  const enemyId = opponent(ctx.playerId);
  let next = state;
  const ids = next.players[enemyId].battle.filter((c) => defOf(next, c.cardId)?.type === "unit").map((c) => c.instanceId);
  for (const id of ids) next = exileFieldUnit(next, enemyId, id, ctx.phasePlayerId);
  return { state: next, detail: `xg4011:exiled:${ids.length}` };
};

// ---------------------------------------------------------------------------
// XG4-012 獣装光ギンガイエロー【閃光星獣剣】（NC）
// 「「SP1」自軍捨札を1枚選びゲームから除外してもよい。そうしたとき、敵軍バトルエリアから、特徴「メカ」を持つホールド状態のユニットを1体選び、
//  ゲームから除外する。」（atwiki/page-2097）。「SP1」は DSL の SP1。サイズを問わない（カード評価）。

const YELLOW_DISCARD_EFFECT_ID = "xg4012_senko_discard";
const YELLOW_TARGET_EFFECT_ID = "xg4012_senko_target";

function yellowTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => defOf(state, c.cardId)?.type === "unit" && c.commandHeld && unitFeatures(state, enemyId, c).includes("メカ") && selectableEnemy(state, playerId, "XG4-012", c))
    .map((c) => c.instanceId);
}

XG4_KEYWORDS["XG4-012::senko"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4012:empty_discard" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-012"), effectId: YELLOW_DISCARD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: YELLOW_DISCARD_EFFECT_ID,
  };
};

XG4_RESOLVERS[YELLOW_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), exile: [...(p.exile ?? []), stripForZone(card)] }));
  const ids = yellowTargets(next, playerId);
  const log = logFor(state, playerId, "XG4-012", `${YELLOW_DISCARD_EFFECT_ID}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: YELLOW_TARGET_EFFECT_ID, validInstanceIds: ids, selectedInstanceIds: [], optional: false }), log };
};
XG4_SKIPPERS[YELLOW_DISCARD_EFFECT_ID] = simpleSkip();

XG4_RESOLVERS[YELLOW_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = exileFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-012", `${YELLOW_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-013 ギンガグリーン・XG4-014 ギンガピンク の※「これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。」
// （atwiki/page-2092・page-2091）。重ねたビークルにはライドした状態になる（atwiki/page-1233 XG2-025 カード評価「ビークルを重ねることでライドする
// ことができる。そこからライドオフして」・atwiki/page-2083 Q1）。ビークルはラッシュエリアに残し、これの mountedOnInstanceId にする。

const STACK_VEHICLE_EFFECT_ID = "xg4013_stack_vehicle";

function unriddenVehicles(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  const all = [...p.rush, ...p.battle];
  return p.rush
    .filter((c) => defOf(state, c.cardId)?.type === "vehicle" && !all.some((r) => r.mountedOnInstanceId === c.instanceId))
    .map((c) => c.instanceId);
}

function stackVehicle(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const self = ctx.triggerSourceInstanceId;
    if (!self || !findField(state, ctx.playerId, self)) return { state, detail: `${cardId}:no_source` };
    const ids = unriddenVehicles(state, ctx.playerId);
    if (ids.length === 0) return { state, detail: `${cardId}:no_vehicle` };
    return {
      state: openAfter(state, { ...base({ playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: self }, cardId), effectId: STACK_VEHICLE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
      detail: STACK_VEHICLE_EFFECT_ID,
    };
  };
}

XG4_RESOLVERS[STACK_VEHICLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const vehicle = p.rush.find((c) => c.instanceId === instanceId);
    const rider = p.rush.find((c) => c.instanceId === self);
    if (!vehicle || !rider) return p;
    // ライドしているビークルは、ライダーの直前に並べる（バトルエリアに出るときに一緒に動かす並び）。
    const rest = p.rush.filter((c) => c.instanceId !== instanceId && c.instanceId !== self);
    return { ...p, rush: [...rest, vehicle, { ...rider, mountedOnInstanceId: instanceId }] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${STACK_VEHICLE_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[STACK_VEHICLE_EFFECT_ID] = simpleSkip();

// XG4-013【疾風一陣】（NC）「相手は自分自身の山札の上から1枚を捨札にするか、自分自身のコマンドを2つ選び手札に戻すかを選ぶ。」（atwiki/page-2092）

const SHIPPU_MODE_EFFECT_ID = "xg4013_shippu_mode";
const SHIPPU_COMMAND_EFFECT_ID = "xg4013_shippu_command";
const SHIPPU_MILL = "deck_top_to_discard";
const SHIPPU_COMMAND = "command_to_hand";

// 相手のコマンドが2つ未満なら「コマンドを2つ戻す」は選べず、山札の上から1枚を捨札にする方に決まる（選ばせない）。山札がなくコマンドが2つ以上なら
// コマンドを2つ戻す方に決まる。どちらもできなければ何もしない（利用者の決定 2026-10-20・questions-all.md U-15。RS-572 デカマスターと同じ扱い）。

function shippuMill(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => (p.deck.length === 0 ? p : { ...p, deck: p.deck.slice(1), discard: [...p.discard, stripForZone(p.deck[0]!)] }));
}

XG4_KEYWORDS["XG4-013::shippu"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const canMill = state.players[enemyId].deck.length > 0;
  const commandIds = state.players[enemyId].command.map((c) => c.instanceId);
  const canReturn = commandIds.length >= 2;
  if (!canMill && !canReturn) return { state, detail: "xg4013:nothing_possible" };
  if (!canReturn) {
    return { state: shippuMill(state, enemyId), detail: `${SHIPPU_MODE_EFFECT_ID}:${SHIPPU_MILL}` };
  }
  if (!canMill) {
    return {
      state: openAfter(state, {
        ...base({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG4-013"),
        effectId: SHIPPU_COMMAND_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: commandIds,
        selectedInstanceIds: [],
        selectCount: 2,
        optional: false,
      }),
      detail: `${SHIPPU_MODE_EFFECT_ID}:${SHIPPU_COMMAND}`,
    };
  }
  return {
    state: openAfter(state, {
      ...base({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG4-013"),
      effectId: SHIPPU_MODE_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [SHIPPU_MILL, SHIPPU_COMMAND],
      selectCount: 1,
      optional: false,
    }),
    detail: SHIPPU_MODE_EFFECT_ID,
  };
};

XG4_RESOLVERS[SHIPPU_MODE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const log = logFor(state, playerId, "XG4-013", `${SHIPPU_MODE_EFFECT_ID}:${mode}`);
  if (mode === SHIPPU_MILL) {
    return { state: proceed(shippuMill(next, playerId), pending), log };
  }
  const ids = next.players[playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...pending, effectId: SHIPPU_COMMAND_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectedInstanceIds: [], selectCount: Math.min(2, ids.length), optional: false }), log };
};

function shippuReturn(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => !selected.includes(c.instanceId)),
    hand: [...p.hand, ...p.command.filter((c) => selected.includes(c.instanceId)).map(stripForZone)],
  }));
  return proceed(next, pending);
}

XG4_RESOLVERS[SHIPPU_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
  const log = logFor(state, playerId, "XG4-013", `${SHIPPU_COMMAND_EFFECT_ID}:${instanceId}`);
  if (selected.length >= (pending.selectCount ?? 2) || rest.length === 0) return { state: shippuReturn(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest } }, log };
};

// XG4-014【キバアロー】（NC）「BP4000以下の敵軍ユニットを1体選んでもよい。そうしたとき、相手はそのユニットをホールドするか自分自身の山札の上に
//  戻すかを選ぶ。」（atwiki/page-2091）。いまの BP。エリア・サイズを問わない（コメント欄）。

const KIBA_TARGET_EFFECT_ID = "xg4014_kiba_arrow_target";
const KIBA_MODE_EFFECT_ID = "xg4014_kiba_arrow_mode";
const KIBA_HOLD = "hold";
const KIBA_DECK_TOP = "deck_top";

XG4_KEYWORDS["XG4-014::kiba_arrow"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= 4000 && selectableEnemy(state, ctx.playerId, "XG4-014", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4014:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-014"), effectId: KIBA_TARGET_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: KIBA_TARGET_EFFECT_ID,
  };
};

XG4_RESOLVERS[KIBA_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const enemyId = opponent(playerId);
  return {
    state: openNext(next, pending, {
      ...base({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG4-014"),
      effectId: KIBA_MODE_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [KIBA_HOLD, KIBA_DECK_TOP],
      selectCount: 1,
      optional: false,
      xg4Meta: { target: instanceId },
    }),
    log: logFor(state, playerId, "XG4-014", `${KIBA_TARGET_EFFECT_ID}:${instanceId}`),
  };
};
XG4_SKIPPERS[KIBA_TARGET_EFFECT_ID] = simpleSkip();

XG4_RESOLVERS[KIBA_MODE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.xg4Meta?.target as string;
  let next = close(state, pending);
  if (mode === KIBA_HOLD) next = holdFieldUnit(next, playerId, target);
  else {
    next = moveFieldUnit(next, playerId, target, pending.phasePlayerId, "deck_bottom");
    // 山札の上に戻す（moveFieldUnit は下に置くので、並びを入れ替える）。
    next = patchPlayer(next, playerId, (p) => {
      const card = p.deck.find((c) => c.instanceId === target);
      return card ? { ...p, deck: [card, ...p.deck.filter((c) => c.instanceId !== target)] } : p;
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-014", `${KIBA_MODE_EFFECT_ID}:${mode}`) };
};

// ---------------------------------------------------------------------------
// XG4-015 血祭ドウコク【三途の川の御大将】（自軍ターン中、バトルエリアに出たとき）
// 「お互いの捨札にあるSユニットのカードをすべてゲームから除外する。」（atwiki/page-2081）

XG4_KEYWORDS["XG4-015::sanzu"] = (state, ctx) => {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg4015:not_own_turn" };
  let next = state;
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    const ids = new Set(next.players[pid].discard.filter((c) => isSUnitCard(next, c)).map((c) => c.instanceId));
    count += ids.size;
    next = patchPlayer(next, pid, (p) => ({ ...p, discard: p.discard.filter((c) => !ids.has(c.instanceId)), exile: [...(p.exile ?? []), ...p.discard.filter((c) => ids.has(c.instanceId)).map(stripForZone)] }));
  }
  return { state: next, detail: `xg4015:exiled:${count}` };
};

// ---------------------------------------------------------------------------
// XG4-016 タイムファイヤー【DVディフェンダー】（自軍ターン中、バトルエリアに出たとき）
// 「自軍Lユニットを1体選んでもよい。そうしたとき、敵軍バトルエリアから、選んだユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを
//  1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-2141）。数字は「+」「-」を除く。

const DV_L_EFFECT_ID = "xg4016_dv_defender_l";
const DV_TARGET_EFFECT_ID = "xg4016_dv_defender_target";

XG4_KEYWORDS["XG4-016::dv_defender"] = (state, ctx) => {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg4016:not_own_turn" };
  const ids = fieldUnits(state, ctx.playerId).filter((c) => unitSizeOf(state.definitions, c) === "L").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4016:no_l" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-016"), effectId: DV_L_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: DV_L_EFFECT_ID,
  };
};

XG4_RESOLVERS[DV_L_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const own = findField(next, playerId, instanceId);
  const limit = own ? costNumber(next, own.cardId) : Number.NaN;
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => {
      if (defOf(next, c.cardId)?.type !== "unit") return false;
      const n = costNumber(next, c.cardId);
      return Number.isFinite(n) && n <= limit && selectableEnemy(next, playerId, "XG4-016", c);
    })
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG4-016", `${DV_L_EFFECT_ID}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick(pendingBase(pending), "XG4-016", DV_TARGET_EFFECT_ID, ids, false, "power")), log };
};
XG4_SKIPPERS[DV_L_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-017 ガオシルバー【ガオハスラーロッド・スナイパーモード】（NC・ライドオフしたとき）
// 「これがバトルで敵軍ユニットを撃破したとき、これが撃破したユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍コマンドを1つ選び捨札にしても
//  よい。（この効果は、ライドオフしたときナンバーに関係なく発動する）」（atwiki/page-2133）。NC（またはライドオフ）が成立したターンの記録。

const SNIPER_RULE = "xg4_017_sniper";
const SNIPER_EFFECT_ID = "xg4017_sniper_mode";

XG4_KEYWORDS["XG4-017::sniper_mode"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4017:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, SNIPER_RULE, "XG4-017", { instanceId: id }), detail: "xg4017:sniper_mode" };
};

XG4_RESOLVERS[SNIPER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    return card ? { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-017", `${SNIPER_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[SNIPER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-018 ウルフローダー【白銀の疾風】（自軍ターン中、バトルエリアに出たとき）
// 「特徴「獣」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破してもよい。」（atwiki/page-2098）
// ビークルのこれ自身はユニットではないので数えない（R-CARD-04）。いまの特徴。エリアを問わない（カード評価）。
// ※のライド（WB を持つ S ユニットは自軍コマンドを1つホールドすればライドできる）は rules/xg4/xg4Fields.ts。

const HAKUGIN_EFFECT_ID = "xg4018_hakugin";

XG4_KEYWORDS["XG4-018::hakugin"] = (state, ctx) => {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "xg4018:not_own_turn" };
  const beasts = fieldUnits(state, ctx.playerId).filter((c) => unitFeatures(state, ctx.playerId, c).includes("獣")).length;
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return rk1IsSmallNow(state, c) && Number.isFinite(n) && n <= beasts && selectableEnemy(state, ctx.playerId, "XG4-018", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4018:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "XG4-018", HAKUGIN_EFFECT_ID, ids, true, "discard")), detail: HAKUGIN_EFFECT_ID };
};

// ---------------------------------------------------------------------------
// XG4-019 ピタットヒトデ【スターライトニードロップ】（JC・R）
// 「これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍コマンドゾーンからカードを1枚選び、持ち主の手札に戻す。」
// （atwiki/page-2089）。同カテゴリの判定は JC の成立（rules/jointComboProcedure.ts）。ホールド状態のカードも選べる。

const STARLIGHT_EFFECT_ID = "xg4019_starlight";

XG4_KEYWORDS["XG4-019::starlight"] = (state, ctx) => {
  const ids = state.players[opponent(ctx.playerId)].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4019:no_command" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-019"), effectId: STARLIGHT_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: STARLIGHT_EFFECT_ID,
  };
};

XG4_RESOLVERS[STARLIGHT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    return card ? { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-019", `${STARLIGHT_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-020 リボルバーマンモス【カラクリボール発射】（自軍ターン中、バトルエリアに出たとき）
// 「自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードがMAのMユニットのカードだったなら、追加条件を持たない敵軍ユニットを1体
//  選び、持ち主の手札に戻す。その後、オモテにしたカードを手札に加える。」（atwiki/page-2106）。エリア・サイズを問わない（コメント欄）。

const KARAKURI_CONFIRM_EFFECT_ID = "xg4020_karakuri_confirm";
const KARAKURI_TARGET_EFFECT_ID = "xg4020_karakuri_target";

XG4_KEYWORDS["XG4-020::karakuri_ball"] = (state, ctx) => {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg4020:not_own_turn" };
  if (state.players[ctx.playerId].deck.length === 0) return { state, detail: "xg4020:empty_deck" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG4-020", KARAKURI_CONFIRM_EFFECT_ID)), detail: KARAKURI_CONFIRM_EFFECT_ID };
};

function topToHand(state: GameState, playerId: PlayerId, topId: string | undefined): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === topId);
    return card ? { ...p, deck: p.deck.filter((c) => c.instanceId !== topId), hand: [...p.hand, stripForZone(card)] } : p;
  });
}

XG4_RESOLVERS[KARAKURI_CONFIRM_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[KARAKURI_CONFIRM_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[KARAKURI_CONFIRM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const top = next.players[playerId].deck[0];
  if (!top) return { state: proceed(next, pending) };
  const d = defOf(next, top.cardId);
  const hit = d?.type === "unit" && unitSizeOf(next.definitions, top) === "M" && cardCategories(d).includes("MA");
  next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG4-020", effectLabel: "カラクリボール発射", from: "deck_top", cards: revealedCards([top], "hand") });
  const log = logFor(state, playerId, "XG4-020", `${KARAKURI_CONFIRM_EFFECT_ID}:${hit ? "hit" : "miss"}`);
  const enemyId = opponent(playerId);
  const ids = hit
    ? fieldUnits(next, enemyId)
        .filter((c) => {
          const def = defOf(next, c.cardId);
          return !!def && !resolveRushAdditionalCondition(c.cardId, def) && selectableEnemy(next, playerId, "XG4-020", c);
        })
        .map((c) => c.instanceId)
    : [];
  if (ids.length === 0) return { state: proceed(topToHand(next, playerId, top.instanceId), pending), log };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-020"), effectId: KARAKURI_TARGET_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, xg4Meta: { topId: top.instanceId } }),
    log,
  };
};

XG4_RESOLVERS[KARAKURI_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "hand");
  next = topToHand(next, playerId, pending.xg4Meta?.topId as string | undefined);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-020", `${KARAKURI_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-021 カラクリマント（※カウンター）
// 「自軍Lユニットがアタックされたとき発動できる⇒アタックしてきたユニットを持ち主のパワーゾーンにダメージにして置く。このとき、バトルは行われない。」
// （atwiki/page-2054）。アタックされたのはいまの L ユニット（かわりにバトルするユニットではなく、アタックされたユニット）。

export const KARAKURI_MANTLE_CARD_ID = "XG4-021";

type BattleRef = Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId" | "defenderInstanceId"> & { effectBattle?: boolean; battleCancelled?: boolean };

export function xg4aBattleCounterConditionMet(state: GameState, defenderId: PlayerId, cardId: string, battle: BattleRef): boolean {
  if (!isCard(cardId, KARAKURI_MANTLE_CARD_ID)) return false;
  if (battle.defenderPlayerId !== defenderId || battle.effectBattle || battle.battleCancelled) return false;
  const defender = fieldUnits(state, defenderId).find((c) => c.instanceId === battle.defenderInstanceId);
  return !!defender && unitSizeOf(state.definitions, defender) === "L";
}

export function applyXg4aBattleCounter(state: GameState, defenderId: PlayerId, pending: PendingBattle): { state: GameState; pending: PendingBattle; detail: string } {
  const next = moveFieldUnit(state, pending.attackerPlayerId, pending.attackerInstanceId, pending.phasePlayerId, "power_damage");
  return { state: next, pending: { ...pending, battleCancelled: true }, detail: "karakuri_mantle" };
}

// ---------------------------------------------------------------------------
// ほかの処理の場所から呼ぶ起点

/** バトルで敵軍ユニットを撃破したとき（rules/operationCounters.ts。RK-324 と同じ場所）。 */
export function xg4aOnBattleDestroy(
  state: GameState,
  winnerId: PlayerId,
  winnerInstanceId: string,
  defeatedOwnerId: PlayerId,
  defeatedInstanceId: string,
): GameState {
  if (winnerId === defeatedOwnerId) return state;
  const winner = findField(state, winnerId, winnerInstanceId);
  if (!winner) return state;
  let next = state;
  const ctx = { playerId: winnerId, phasePlayerId: state.activePlayer, sourceInstanceId: winnerInstanceId };
  // XG4-010【閃光星獣剣】: 撃破して捨札になったユニットを除外するか。
  if (isCard(winner.cardId, "XG4-010") && hasTurnRecordFor(next, winnerId, SENKO_RULE, winnerInstanceId)) {
    if (next.players[defeatedOwnerId].discard.some((c) => c.instanceId === defeatedInstanceId)) {
      next = openAfter(next, { ...confirmChoice(ctx, "XG4-010", SENKO_EFFECT_ID), xg4Meta: { target: defeatedInstanceId, owner: defeatedOwnerId } });
    }
  }
  // XG4-017【ガオハスラーロッド・スナイパーモード】: 撃破したユニットの必要パワーの数字以下の敵軍コマンド。
  if (isCard(winner.cardId, "XG4-017") && hasTurnRecordFor(next, winnerId, SNIPER_RULE, winnerInstanceId)) {
    const defeated = [...next.players[defeatedOwnerId].discard, ...next.players[defeatedOwnerId].power, ...next.players[defeatedOwnerId].command].find((c) => c.instanceId === defeatedInstanceId);
    const limit = defeated ? costNumber(next, defeated.cardId) : Number.NaN;
    const ids = next.players[defeatedOwnerId].command
      .filter((c) => {
        const n = costNumber(next, c.cardId);
        return Number.isFinite(n) && n <= limit;
      })
      .map((c) => c.instanceId);
    if (ids.length > 0) {
      next = openAfter(next, { ...base(ctx, "XG4-017"), effectId: SNIPER_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true });
    }
  }
  return next;
}

/** ライドオフしたとき。XG4-017「（この効果は、ライドオフしたときナンバーに関係なく発動する）」— このターンの記録をつける。 */
export function applyXg4aRideOff(state: GameState, playerId: PlayerId, rider: CardInstance): GameState {
  if (!isCard(rider.cardId, "XG4-017") || hasTurnRecordFor(state, playerId, SNIPER_RULE, rider.instanceId)) return state;
  return addTurnRecord(state, playerId, SNIPER_RULE, "XG4-017", { instanceId: rider.instanceId });
}

/**
 * XG4-018【白銀の疾風】: ビークルのこれはユニットの「バトルエリアに出たとき」の処理（events/emitUnitEnteredBattle.ts）に乗らないので、
 * ライドされてバトルエリアに出たのをここで見る。効果はアタック・ライドオフの選択より先に解決する
 * （開いたら、ライドオフの選択・アタックの選択は deferredBattleEntry に移し、選択を終えたあと rules/battleEntry.ts が開き直す）。
 */
function wolfLoaderEntered(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const prev = new Set(before.players[pid].battle.map((c) => c.instanceId));
    for (const v of after.players[pid].battle) {
      if (!isCard(v.cardId, "XG4-018") || prev.has(v.instanceId)) continue;
      if (!after.players[pid].battle.some((c) => c.mountedOnInstanceId === v.instanceId)) continue;
      const phasePlayerId = after.pendingRideOffChoice?.phasePlayerId ?? after.pendingBattleEntry?.phasePlayerId ?? before.activePlayer;
      const opened = XG4_KEYWORDS["XG4-018::hakugin"]!(next, { playerId: pid, phasePlayerId, sourceCardId: "XG4-018", effectId: "no_kaze", triggerSourceInstanceId: v.instanceId });
      if (opened.state === next || !opened.state.pendingEffectChoice) continue;
      next = opened.state;
      if (next.pendingRideOffChoice?.playerId === pid && !next.deferredBattleEntry) {
        next = { ...next, deferredBattleEntry: next.pendingRideOffChoice.battleEntry, pendingRideOffChoice: undefined };
      } else if (next.pendingBattleEntry?.playerId === pid && !next.deferredBattleEntry) {
        next = { ...next, deferredBattleEntry: next.pendingBattleEntry, pendingBattleEntry: undefined };
      }
    }
  }
  return next;
}

/** applyAction の後処理（depth 0）。 */
export function applyXg4aAfterAction(before: GameState, after: GameState): GameState {
  let next = settleDragonArmor(after);
  next = wolfLoaderEntered(before, next);
  // XG4-007 の※: ラッシュフェイズ中に自分のカードが自軍捨札に置かれた（このターンの記録）。
  if (before.phase === "rush") {
    for (const pid of ["player1", "player2"] as const) {
      const prev = new Set(before.players[pid].discard.map((c) => c.instanceId));
      if (!next.players[pid].discard.some((c) => !prev.has(c.instanceId))) continue;
      if (hasTurnRecordFor(next, pid, RUSH_DISCARD_RULE_ID, "any")) continue;
      next = addTurnRecord(next, pid, RUSH_DISCARD_RULE_ID, "XG4-007", { instanceId: "any" });
    }
  }
  return next;
}


// ---------------------------------------------------------------------------
// 登録

XG4_KEYWORDS["XG4-013::stack_vehicle"] = stackVehicle("XG4-013");
XG4_KEYWORDS["XG4-014::stack_vehicle"] = stackVehicle("XG4-014");
XG4_KEYWORDS["XG4-021::karakuri_mantle"] = noop("xg4021:counter");

