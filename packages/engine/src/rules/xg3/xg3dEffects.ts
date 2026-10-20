/**
 * クロスギャザー ザ・Wインパクト XG3-063〜XG3-083（仮面ライダードレイクMF〜宇宙忍デモスト）のカード固有の効果（cardSpec XG3-063-083 の監査）。
 * 入口は rules/xg3/xg3Effects.ts、登録簿は rules/xg3/xg3Registry.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 * 継続効果（XG3-070 のアタック先・BP、XG3-073・XG3-077 の SP、XG3-077 のラッシュエリアへのアタック、XG3-078 のバトルエリアへの進入）は
 * rules/xg3/xg3Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { getDefinition, parsePowerCost, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { countAvailablePower } from "../../core/power";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { finalizeLeaveReaction } from "../operationCounters";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { strikeDamageFor } from "../combo";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { base, close, ctxBase, destroyAll, fieldUnits, findField, isUnitCard, logFor, moveFieldUnit, openAfter, openNext, pendingBase, proceed, selectableEnemy, shuffleDeck, stripForZone, zoneOfField } from "../rm/rm1Effects";
import { AFTER_ACTION_HOOKS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, FIELD_ABILITIES, KEYWORDS, LEAVE_STAY_HOOKS, ZONE_ACTIVATIONS } from "./xg3Registry";
import { holdCommands, nameIs, printedFeatures, skipThen } from "./xg3Common";

/** 継続効果・別の入口で処理するカードのキーワード（DSL の grant_keyword から呼ばれても何もしない）。 */
for (const key of [
  "XG3-068::sekai",
  "XG3-070::ryoheno",
  "XG3-072::kibara_swap",
  "XG3-073::otakara",
  "XG3-074::kanbu",
  "XG3-077::decade_sp",
  "XG3-077::final_attack_ride",
  "XG3-078::hand_deploy",
  "XG3-078::rimokon",
]) {
  KEYWORDS[key] = (state) => ({ state, detail: `${key}:static` });
}

function isOwnTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

function canActNow(state: GameState, playerId: PlayerId): boolean {
  return state.phase === "rush" && isOwnTurn(state, playerId) && !state.pendingEffectChoice && !state.pendingEffectRush;
}

/** 選択を開く（ほかの選択の途中ならその後に。resumeChoice を引き継ぐ）。 */
function openFollow(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return state.pendingEffectChoice ? openAfter(state, { ...next, resumeChoice: pending.resumeChoice }) : openNext(state, pending, next);
}

/** 印刷の必要パワーの数字（数字を持たなければ undefined）。 */
function costNumber(state: GameState, cardId: string): number | undefined {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  if (cost === undefined) return undefined;
  const n = parsePowerCost(cost);
  return Number.isFinite(n) ? n : undefined;
}

function hasAdditionalCondition(state: GameState, cardId: string): boolean {
  return !!getDefinition(state.definitions, cardId)?.rushAdditionalCondition;
}

/** 「その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニット」（エリア・サイズを問わない）。 */
function costAtMostEnemies(state: GameState, playerId: PlayerId, sourceCardId: string, n: number): string[] {
  return fieldUnits(state, opponent(playerId))
    .filter((c) => {
      const m = costNumber(state, c.cardId);
      return m !== undefined && m <= n && !hasAdditionalCondition(state, c.cardId) && selectableEnemy(state, playerId, sourceCardId, c);
    })
    .map((c) => c.instanceId);
}

function addTurnBuff(state: GameState, instanceId: string, buff: { bp?: number; sp?: number }): GameState {
  return { ...state, xg3: { ...state.xg3, turnBuffs: [...(state.xg3?.turnBuffs ?? []).filter((b) => b.turn === state.turn), { instanceId, turn: state.turn, ...buff }] } };
}

// ---------------------------------------------------------------------------
// XG3-064 仮面ライダードレイクRF【ライダーシューティング】（atwiki/page-1954）
// 「自軍ターン中、これがバトルエリアに出たとき、特徴「女」を持つユニットの数を数えてもよい。そうしたとき、その数以下の必要パワーの数字を持つ
//  追加条件を持たない敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。」
// 数えるのは両軍のエリアのユニット（いまの特徴）。数えるか（＝発動するか）は送るユニットの選択で答える（見送れる）。

const SHOOTING_EFFECT_ID = "xg3064_rider_shooting";

KEYWORDS["XG3-064::rider_shooting"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3064:enemy_turn" };
  const n = (["player1", "player2"] as const).reduce((sum, pid) => sum + fieldUnits(state, pid).filter((c) => unitFeatures(state, pid, c).includes("女")).length, 0);
  const ids = costAtMostEnemies(state, ctx.playerId, "XG3-064", n);
  if (ids.length === 0) return { state, detail: "xg3064:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-064"), effectId: SHOOTING_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SHOOTING_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[SHOOTING_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[SHOOTING_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-064", `${SHOOTING_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-067 インビジブル（オペレーション。atwiki/page-1929）
// 「自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、
//  敵軍ターン中、撃破されて捨札になるとき、かわりに持ち主のパワーゾーンに送る。このカードに重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」
// このカードは自軍ラッシュエリアに置き（使った時点で。捨札にしない）、重ねたユニットとの組を state.xg3.invisible に記録する。
// 重ねたユニットが敵軍ターン中に捨札になるとき（rules/operationCounters.ts tryLeaveField）、行き先をパワーゾーン（オモテ向き）に変える。
// 重ねたユニットが場を離れたら、このカードを捨札にする（後処理）。

const INVISIBLE_EFFECT_ID = "xg3067_invisible";

KEYWORDS["XG3-067::invisible"] = (state, ctx) => {
  const self = ctx.operationInstanceId ?? ctx.triggerSourceInstanceId;
  if (!self) return { state, detail: "xg3067:no_source" };
  const ids = fieldUnits(state, ctx.playerId).filter((c) => rk1IsSmallNow(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3067:no_targets" };
  const placed = patchPlayer(state, ctx.playerId, (p) => {
    const inHand = p.hand.find((c) => c.instanceId === self);
    const card: CardInstance = inHand ? stripForZone(inHand) : { instanceId: self, cardId: ctx.sourceCardId };
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== self), discard: p.discard.filter((c) => c.instanceId !== self), rush: [...p.rush, card] };
  });
  return {
    state: openAfter(placed, { ...base({ ...ctxBase(ctx), sourceInstanceId: self }, "XG3-067"), effectId: INVISIBLE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: INVISIBLE_EFFECT_ID,
  };
};
CHOICE_RESOLVERS[INVISIBLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const cardInstanceId = pending.sourceInstanceId!;
  const done: GameState = { ...next, xg3: { ...next.xg3, invisible: [...(next.xg3?.invisible ?? []), { ownerId: playerId, cardInstanceId, unitInstanceId: instanceId }] } };
  return { state: proceed(done, pending), log: logFor(state, playerId, "XG3-067", `${INVISIBLE_EFFECT_ID}:${instanceId}`) };
};

/** 重ねたユニットが場を離れたインビジブルを捨札にする。 */
function cleanupInvisible(state: GameState): GameState {
  const links = state.xg3?.invisible ?? [];
  if (links.length === 0) return state;
  let next = state;
  const keep: typeof links = [];
  for (const link of links) {
    const unitOnField = !!findField(next, link.ownerId, link.unitInstanceId);
    const cardInRush = next.players[link.ownerId].rush.some((c) => c.instanceId === link.cardInstanceId);
    if (unitOnField && cardInRush) {
      keep.push(link);
      continue;
    }
    if (cardInRush) {
      next = patchPlayer(next, link.ownerId, (p) => {
        const card = p.rush.find((c) => c.instanceId === link.cardInstanceId)!;
        return { ...p, rush: p.rush.filter((c) => c.instanceId !== link.cardInstanceId), discard: [...p.discard, stripForZone(card)] };
      });
    }
  }
  return { ...next, xg3: { ...next.xg3, invisible: keep } };
}
AFTER_ACTION_HOOKS.push((_before, after) => cleanupInvisible(after));

LEAVE_STAY_HOOKS.push((state: GameState, intent: PendingLeave) => {
  if (intent.toZone !== "discard" || state.pendingEffectChoice) return null;
  const ownerId = intent.ownerPlayerId;
  if (state.activePlayer === ownerId) return null;
  const link = (state.xg3?.invisible ?? []).find((l) => l.ownerId === ownerId && l.unitInstanceId === intent.instanceId);
  if (!link) return null;
  const redirected: PendingLeave = { ...intent, toZone: "power" };
  let next = finalizeLeaveReaction({ ...state, pendingLeave: redirected }, redirected, false);
  next = cleanupInvisible(next);
  next = { ...next, log: [...next.log, logFor(state, ownerId, "XG3-067", `${INVISIBLE_EFFECT_ID}:to_power:${intent.instanceId}`)] };
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
});

// ---------------------------------------------------------------------------
// XG3-068 仮面ライダーディケイド【この世界でやるべきこと】（atwiki/page-2004）
// 「これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、自分の手札を1枚選び捨札にしてもよい。そうしたとき、自軍山札を見て、
//  特徴「FFR」を持つカードを1枚選び、自軍ラッシュエリアに出す。その後、山札をシャッフルする。」
// 起動は activate_field_unit_ability（1ターン1回）。捨札にする手札は種類を問わない（見送れる）。「FFR」は印刷の特徴。選ぶのは強制。

const SEKAI_EFFECT_ID = "xg3068_sekai";
const SEKAI_PICK_EFFECT_ID = "xg3068_sekai_pick";

FIELD_ABILITIES.push({
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-068"),
  canActivate: (state, playerId) => canActNow(state, playerId) && state.players[playerId].hand.length > 0,
  resolve: (state, playerId, card) =>
    openAfter(state, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG3-068"),
      effectId: SEKAI_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: state.players[playerId].hand.map((c) => c.instanceId),
      selectCount: 1,
      optional: true,
    }),
});
CHOICE_SKIPPERS[SEKAI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[SEKAI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
  const log = logFor(state, playerId, "XG3-068", `${SEKAI_EFFECT_ID}:${instanceId}`);
  const ids = next.players[playerId].deck.filter((c) => printedFeatures(next, c.cardId).includes("FFR")).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(shuffleDeck(next, playerId), pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-068"), effectId: SEKAI_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[SEKAI_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] };
  });
  next = shuffleDeck(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-068", `${SEKAI_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-071 キバーラ【カプッ】（atwiki/page-1931）
// 「これをラッシュしたとき、自軍山札の上から1枚をオモテにする。そうしたとき、オモテにしたカードがユニットカードだったなら捨札にする。
//  それ以外だったなら自分の手札に加える。」

KEYWORDS["XG3-071::kapu"] = (state, ctx) => {
  const top = state.players[ctx.playerId].deck[0];
  if (!top) return { state, detail: "xg3071:no_deck" };
  const unit = isUnitCard(state, top.cardId);
  const next = patchPlayer(state, ctx.playerId, (p) => ({
    ...p,
    deck: p.deck.slice(1),
    ...(unit ? { discard: [...p.discard, stripForZone(top)] } : { hand: [...p.hand, stripForZone(top)] }),
  }));
  return { state: { ...next, log: [...next.log, logFor(state, ctx.playerId, "XG3-071", `xg3071_kapu:${unit ? "discard" : "hand"}:${top.instanceId}`)] }, detail: "xg3071_kapu" };
};

// ---------------------------------------------------------------------------
// XG3-072 仮面ライダーキバーラ ※（atwiki/page-1963）
// 「これが自分の手札にある時、自軍ラッシュフェイズ中、このカードと自軍「キバーラ」1体を置き換えてもよい。」
// 起動は self_rush_from_zone（zone hand）。置き換え（R-REPL-04）: これがキバーラのいた場所（リリース／ホールドの状態のまま）に入り、キバーラは手札へ。

const KIBARA_EFFECT_ID = "xg3072_kibara_swap";

function kibaraIds(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId).filter((c) => nameIs(state, c.cardId, "キバーラ")).map((c) => c.instanceId);
}

ZONE_ACTIVATIONS.push({
  zone: "hand",
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-072"),
  canActivate: (state, playerId) => canActNow(state, playerId) && kibaraIds(state, playerId).length > 0,
  activate: (state, playerId, instanceId) =>
    openAfter(state, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG3-072"), effectId: KIBARA_EFFECT_ID, kind: "select_unit", validInstanceIds: kibaraIds(state, playerId), selectCount: 1, optional: true }),
});
CHOICE_SKIPPERS[KIBARA_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[KIBARA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  const zone = zoneOfField(state, playerId, instanceId);
  let next = close(state, pending);
  if (zone) {
    next = patchPlayer(next, playerId, (p) => {
      const mine = p.hand.find((c) => c.instanceId === self);
      const old = p[zone].find((c) => c.instanceId === instanceId);
      if (!mine || !old) return p;
      const into: CardInstance = { ...stripForZone(mine), ...(old.commandHeld ? { commandHeld: true } : {}), ...(old.mountedOnInstanceId ? { mountedOnInstanceId: old.mountedOnInstanceId } : {}) };
      return {
        ...p,
        hand: [...p.hand.filter((c) => c.instanceId !== self), stripForZone(old)],
        [zone]: p[zone].map((c) => (c.instanceId === instanceId ? into : c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: self } : c)),
      };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-072", `${KIBARA_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-074 キングダーク【大ショッカーの巨大幹部】（atwiki/page-1964）
// 「これが自分の手札にある間、自軍ラッシュフェイズ中、自軍Lユニットが1体もなければ次の効果を発動できる⇒自軍山札の上から7枚を捨札にしてから、
//  これをラッシュエリアに出してもよい。ただし、必要パワーは満たす事。」
// 起動は self_rush_from_zone（zone hand）。必要パワー（印刷の数字）を満たすかは起動のときに見る。出すかの確認（任意）のあと、山札の上7枚
// （7枚未満ならあるだけ）を捨札にして、これをラッシュエリアに出す（追加条件・コマンドは要らない）。

const KANBU_EFFECT_ID = "xg3074_kanbu";

function kanbuReady(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return false;
  if (fieldUnits(state, playerId).some((c) => unitSizeOf(state.definitions, c) === "L")) return false;
  const cost = costNumber(state, card.cardId) ?? 0;
  return countAvailablePower(state, playerId) >= cost;
}

ZONE_ACTIVATIONS.push({
  zone: "hand",
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-074"),
  canActivate: (state, playerId, instanceId) => canActNow(state, playerId) && kanbuReady(state, playerId, instanceId),
  activate: (state, playerId, instanceId) =>
    openAfter(state, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG3-074"), effectId: KANBU_EFFECT_ID, kind: "confirm", validInstanceIds: ["confirm"], optional: true }),
});
CHOICE_SKIPPERS[KANBU_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[KANBU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === self);
    const milled = p.deck.slice(0, 7).map(stripForZone);
    const after = { ...p, deck: p.deck.slice(7), discard: [...p.discard, ...milled] };
    if (!card) return after;
    return { ...after, hand: after.hand.filter((c) => c.instanceId !== self), rush: [...after.rush, stripForZone(card)] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-074", `${KANBU_EFFECT_ID}:${self}`) };
};

// ---------------------------------------------------------------------------
// XG3-075 仮面ライダーディケイドCFジャンボフォーメーション【ファイナルカメンアタックフォームライド】（atwiki/page-1965）
// 「自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーから、RCを持ち特徴「仮面ライダー」を持つカードを1枚選び捨札にしてもよい。
//  そうしたとき、捨札にしたカードのRCの効果を、このユニットの効果として発動する。」
// RC・特徴は印刷のもの。捨札にしたカードの DSL の riding_combo の効果を、これを発動元として解決する。

const FINAL_KAMEN_EFFECT_ID = "xg3075_final_kamen";

function rcPowerIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power
    .filter((c) => !c.faceDown && getDefinition(state.definitions, c.cardId)?.comboNumber === "RC" && printedFeatures(state, c.cardId).includes("仮面ライダー"))
    .map((c) => c.instanceId);
}

KEYWORDS["XG3-075::final_kamen"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3075:enemy_turn" };
  const ids = rcPowerIds(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "xg3075:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-075"), effectId: FINAL_KAMEN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: FINAL_KAMEN_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[FINAL_KAMEN_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[FINAL_KAMEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const found = p.power.find((c) => c.instanceId === instanceId);
    if (!found) return p;
    return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(found)] };
  });
  const log = logFor(state, playerId, "XG3-075", `${FINAL_KAMEN_EFFECT_ID}:${instanceId}`);
  const self = pending.sourceInstanceId;
  if (!card || !self) return { state: proceed(next, pending), log };
  const r = tryResolveDslTriggeredEffects({ state: next, cardId: card.cardId, instanceId: self, playerId, phasePlayerId: pending.phasePlayerId, triggerType: "riding_combo" });
  next = { ...r.state, log: [...r.state.log, ...r.logs] };
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// XG3-076 仮面ライダーアギト【覚醒】（atwiki/page-1933）
// 「これをラッシュしたとき、特徴「男」を持つ自軍Sユニットを1体選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+3000され、「SP1」になる。」

const KAKUSEI_EFFECT_ID = "xg3076_kakusei";

KEYWORDS["XG3-076::kakusei"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self) return { state, detail: "xg3076:no_source" };
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => c.instanceId !== self && rk1IsSmallNow(state, c) && unitFeatures(state, ctx.playerId, c).includes("男"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3076:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-076"), effectId: KAKUSEI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: KAKUSEI_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[KAKUSEI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[KAKUSEI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
  if (pending.sourceInstanceId) next = addTurnBuff(next, pending.sourceInstanceId, { bp: 3000, sp: 1 });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-076", `${KAKUSEI_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-078 マシンハードボイルダー ※（atwiki/page-1936）
// 「これが自分の手札にある間、自軍ラッシュフェイズ中、特徴「ダブルドライバー」を持つ自軍コマンドをホールドしてから、これを自軍ラッシュエリアに出してもよい。」
// 起動は self_rush_from_zone（zone hand）。リリース状態の、印刷の特徴「ダブルドライバー」を持つ自軍コマンドを1つ選んでホールドし、これを
// 自軍ラッシュエリアに出す（パワー・コマンドのカテゴリは問わない。カード評価）。

const HARDBOILDER_EFFECT_ID = "xg3078_hand_deploy";

function doubleDriverCommands(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld && printedFeatures(state, c.cardId).includes("ダブルドライバー")).map((c) => c.instanceId);
}

ZONE_ACTIVATIONS.push({
  zone: "hand",
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-078"),
  canActivate: (state, playerId) => canActNow(state, playerId) && doubleDriverCommands(state, playerId).length > 0,
  activate: (state, playerId, instanceId) =>
    openAfter(state, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG3-078"), effectId: HARDBOILDER_EFFECT_ID, kind: "select_unit", validInstanceIds: doubleDriverCommands(state, playerId), selectCount: 1, optional: true }),
});
CHOICE_SKIPPERS[HARDBOILDER_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[HARDBOILDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  let next = holdCommands(close(state, pending), playerId, [instanceId]);
  next = patchPlayer(next, playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === self);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== self), rush: [...p.rush, stripForZone(card)] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-078", `${HARDBOILDER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-080 仮面ライダーW・HJ【ジョーカーグレネイト】（RC。atwiki/page-1957）
// 「敵軍バトルエリアから、Sユニットを1体選び撃破してもよい。そうしたとき、撃破したユニットのSPが1以上だったなら、相手に1点ダメージを与える。」
// SP は撃破する前のいまの SP（並びを含む）。撃破できた（場を離れた）ときだけダメージを与える。

const GRENADE_EFFECT_ID = "xg3080_joker_grenade";

KEYWORDS["XG3-080::joker_grenade"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG3-080", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3080:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-080"), effectId: GRENADE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: GRENADE_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[GRENADE_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[GRENADE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const victim = findField(state, enemyId, instanceId);
  const sp = victim ? strikeDamageFor(state.definitions, victim, state, enemyId) : 0;
  let next = destroyAll(close(state, pending), pendingBase(pending), "XG3-080", GRENADE_EFFECT_ID, [instanceId]);
  if (sp >= 1 && !findField(next, enemyId, instanceId) && !next.pendingLeave) {
    next = applyDamageToPlayer(next, enemyId, 1, { kind: "none", activePlayer: next.activePlayer });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-080", `${GRENADE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-081 仮面ライダーW・HT【トリガー・エクスプロージョン】（atwiki/page-1937）
// 「これをラッシュしたとき、ホールド状態の敵軍Sユニットを1体選んでもよい。そうしたとき、相手は選んだユニットを捨札にするか、自分自身のパワーゾーンの
//  オモテ向きのカードを1枚捨札にするかを選ぶ。」
// 相手の選択はそのユニットか、オモテ向きのパワーのカードの1枚を選ぶ形にする。オモテ向きのパワーがなければ、選ばずにユニットを捨札にする（カード評価）。

const TRIGGER_EFFECT_ID = "xg3081_trigger_explosion";
const TRIGGER_ANSWER_EFFECT_ID = "xg3081_trigger_explosion_answer";

KEYWORDS["XG3-081::trigger_explosion"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG3-081", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3081:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-081"), effectId: TRIGGER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: TRIGGER_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[TRIGGER_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[TRIGGER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = close(state, pending);
  const log = logFor(state, playerId, "XG3-081", `${TRIGGER_EFFECT_ID}:${instanceId}`);
  const power = next.players[enemyId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (power.length === 0) return { state: proceed(moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "discard"), pending), log };
  return {
    state: openFollow(next, pending, {
      ...base(pendingBase(pending), "XG3-081"),
      playerId: enemyId,
      effectId: TRIGGER_ANSWER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [instanceId, ...power],
      selectCount: 1,
      optional: false,
      xg3Meta: { targetInstanceId: instanceId },
    }),
    log,
  };
};
CHOICE_RESOLVERS[TRIGGER_ANSWER_EFFECT_ID] = (state, chooserId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unitId = pending.xg3Meta?.targetInstanceId;
  let next = close(state, pending);
  if (instanceId === unitId) {
    next = moveFieldUnit(next, chooserId, instanceId, pending.phasePlayerId, "discard");
  } else {
    next = patchPlayer(next, chooserId, (p) => {
      const card = p.power.find((c) => c.instanceId === instanceId);
      if (!card) return p;
      return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, chooserId, "XG3-081", `${TRIGGER_ANSWER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-083 宇宙忍デモスト【暗黒剣】（atwiki/page-1938）
// 「これをラッシュしたとき、自軍捨札の枚数を数えてもよい。そうしたとき、その数以下の必要パワーの数字を持つ追加条件を持たない敵軍ユニットを1体選び、撃破する。」
// 数えるか（＝発動するか）は撃破するユニットの選択で答える（見送れる）。エリア・サイズを問わない（カード評価）。

const ANKOKU_EFFECT_ID = "xg3083_ankokuken";

KEYWORDS["XG3-083::ankokuken"] = (state, ctx) => {
  const ids = costAtMostEnemies(state, ctx.playerId, "XG3-083", state.players[ctx.playerId].discard.length);
  if (ids.length === 0) return { state, detail: "xg3083:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-083"), effectId: ANKOKU_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: ANKOKU_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[ANKOKU_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[ANKOKU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-083", ANKOKU_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-083", `${ANKOKU_EFFECT_ID}:${instanceId}`) };
};
