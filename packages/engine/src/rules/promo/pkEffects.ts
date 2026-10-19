/**
 * プロモーションカード PK・PM・SM・SK のカード固有の効果（cardSpec PROMO1-PK-SK の監査）。
 * 起点は DSL の grant_keyword（`promo::<ID>::name`。rules/promo/promoRegistry.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { unitFeatures } from "../addedFeatures";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { patchPlayer } from "../playerPatches";
import { isSmallUnitNow, turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { base, close, ctxBase, fieldUnits, logFor, moveFieldUnit, openAfter, openNext, proceed, selectableEnemy, shuffleDeck, simpleSkip } from "../rm/rm1Effects";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { registerPromoAttackStrikeBlock, registerPromoBattleDestroy, registerPromoChoice, registerPromoKeyword } from "./promoRegistry";

function meta<T extends Record<string, unknown>>(pending: PendingEffectChoice): T {
  return (pending.promoMeta ?? {}) as T;
}

/**
 * cardId のカードの RC の効果を、self（場のユニット）の効果として発動する（self のインスタンスに cardId を借りる。
 * RS-421 fireAkaRedSoulNc と同じ借り方）。RC の欄の効果が DSL の nc に書かれたカード（RK-023【技の1号】）は nc で引く。
 */
export function firePromoRcAs(state: GameState, playerId: PlayerId, self: CardInstance, cardId: string, phasePlayerId: PlayerId): GameState {
  const borrowed: CardInstance = { ...self, cardId };
  const rc = resolveRidingComboOnRideOff(state, playerId, borrowed);
  if (rc.logs.length > 0 || rc.state !== state) return rc.logs.length > 0 ? { ...rc.state, log: [...rc.state.log, ...rc.logs] } : rc.state;
  const nc = tryResolveDslTriggeredEffects({
    state,
    cardId,
    instanceId: self.instanceId,
    playerId,
    phasePlayerId,
    triggerType: "nc",
    logAction: "riding_combo",
  });
  return nc.handled ? nc.state : state;
}

// ---------------------------------------------------------------------------
// PK-009・SK-002 仮面ライダーV3【ダブルタイフーン】（RC）
// 「自軍コマンドゾーンから「仮面ライダー1号」か「仮面ライダー2号」のカードを1枚選びホールドしてもよい。そうしたとき、ホールドした
//  ユニットカードのＲＣの効果を、このユニットの効果として発動する。」（atwiki/page-963・page-665）
// カード名は括弧書きまで含めて一致するものだけ（「（THE FIRST）」は別のカード名。grnrngr/faq-rider-2 SK-002 Q2）。リリース状態のユニットカード。

const DOUBLE_TYPHOON = "pk009_double_typhoon";
const TYPHOON_NAMES = ["仮面ライダー1号", "仮面ライダー2号"];

function applyDoubleTyphoon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const self = selfId ? fieldUnits(state, ctx.playerId).find((c) => c.instanceId === selfId) : undefined;
  if (!self) return { state, detail: `${DOUBLE_TYPHOON}:not_in_field` };
  const ids = state.players[ctx.playerId].command
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return !c.commandHeld && d?.type === "unit" && TYPHOON_NAMES.includes((d.name ?? "").trim());
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${DOUBLE_TYPHOON}:no_targets` };
  return {
    state: openAfter(state, {
      ...base(ctxBase(ctx), self.cardId),
      effectId: DOUBLE_TYPHOON,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: DOUBLE_TYPHOON,
  };
}

registerPromoChoice(
  DOUBLE_TYPHOON,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const held = state.players[playerId].command.find((c) => c.instanceId === instanceId);
    let next = close(state, pending);
    const log = logFor(state, playerId, pending.sourceCardId, `${DOUBLE_TYPHOON}:${held?.cardId ?? instanceId}`);
    if (!held) return { state: proceed(next, pending), log };
    next = patchPlayer(next, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
    const self = fieldUnits(next, playerId).find((c) => c.instanceId === pending.sourceInstanceId);
    if (self) next = firePromoRcAs(next, playerId, self, held.cardId, pending.phasePlayerId);
    return { state: proceed(next, pending), log };
  },
  simpleSkip(),
);

registerPromoKeyword("PK-009::double_typhoon", applyDoubleTyphoon);

// ---------------------------------------------------------------------------
// PM-001 ジライヤ【真っ向両断】
// 「自軍ターン中、これがユニットを撃破したとき、そのユニットの持つ本来の特徴の数が2つなら、その2つの特徴を先頭から順に特徴1、特徴2として、
//  次の効果を発動できる⇒敵軍パワーゾーンのオモテ向きのカードから、特徴1と同じ特徴を持つユニットカードを1枚選び、ウラ向きにしてダメージに
//  する。そして、敵軍バトルエリアから、特徴2と同じ特徴を持つユニットを1体選び、持ち主の手札に戻す。」（atwiki/page-743）
// バトルで撃破したとき（rules/operationCounters.ts → promoOnBattleDestroy）。本来の特徴はカードに表記された特徴（カタログの並び順）。
// 最初の選択を選ぶことが発動の宣言（見送れる）。特徴1のカードがなければ、特徴2のユニットを選ぶ選択が発動の宣言になる。

const MAKKO_POWER = "pm001_makko_power";
const MAKKO_RETURN = "pm001_makko_return";
const JIRAIYA_ID = "PM-001";

type MakkoMeta = { f2: string };

function makkoReturnIds(state: GameState, playerId: PlayerId, f2: string): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && unitFeatures(state, enemyId, c).includes(f2) && selectableEnemy(state, playerId, JIRAIYA_ID, c))
    .map((c) => c.instanceId);
}

registerPromoBattleDestroy(
  MAKKO_POWER,
  (state, winnerId, winnerInstanceId, defeated) => {
    if (turnPlayerOf(state) !== winnerId) return [];
    const winner = fieldUnits(state, winnerId).find((c) => c.instanceId === winnerInstanceId);
    if (!winner || !isSameCardIdentity(winner.cardId, JIRAIYA_ID)) return [];
    const features = getDefinition(state.definitions, defeated.cardId)?.features ?? [];
    if (features.length !== 2) return [];
    return [{ kind: MAKKO_POWER, playerId: winnerId, sourceInstanceId: winnerInstanceId, phasePlayerId: winnerId, data: { f1: features[0], f2: features[1], sourceCardId: winner.cardId } }];
  },
  (state, trigger) => {
    const { f1, f2, sourceCardId } = (trigger.data ?? {}) as { f1: string; f2: string; sourceCardId: string };
    const enemyId = opponent(trigger.playerId);
    const ctx = { playerId: trigger.playerId, phasePlayerId: trigger.phasePlayerId, sourceInstanceId: trigger.sourceInstanceId };
    const powerIds = state.players[enemyId].power
      .filter((c) => {
        const d = getDefinition(state.definitions, c.cardId);
        return !c.faceDown && d?.type === "unit" && (d.features ?? []).includes(f1) && selectableEnemy(state, trigger.playerId, JIRAIYA_ID, c);
      })
      .map((c) => c.instanceId);
    if (powerIds.length > 0) {
      return { ...base(ctx, sourceCardId), effectId: MAKKO_POWER, kind: "select_power", validInstanceIds: powerIds, selectCount: 1, optional: true, promoMeta: { f2 } satisfies MakkoMeta };
    }
    const returnIds = makkoReturnIds(state, trigger.playerId, f2);
    if (returnIds.length === 0) return null;
    return { ...base(ctx, sourceCardId), effectId: MAKKO_RETURN, kind: "select_unit", validInstanceIds: returnIds, selectCount: 1, optional: true };
  },
);

registerPromoChoice(
  MAKKO_POWER,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    let next = close(state, pending);
    next = patchPlayer(next, enemyId, (p) => ({ ...p, power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)) }));
    const log = logFor(state, playerId, pending.sourceCardId, `${MAKKO_POWER}:${instanceId}`);
    const returnIds = makkoReturnIds(next, playerId, meta<MakkoMeta>(pending).f2);
    if (returnIds.length === 0) return { state: proceed(next, pending), log };
    return {
      state: openNext(next, pending, { ...pending, effectId: MAKKO_RETURN, kind: "select_unit", validInstanceIds: returnIds, selectedInstanceIds: [], optional: false, promoMeta: undefined }),
      log,
    };
  },
  simpleSkip(),
);

registerPromoChoice(
  MAKKO_RETURN,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "hand");
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${MAKKO_RETURN}:${instanceId}`) };
  },
  simpleSkip(),
);

// 継続効果（バトルの解決から開く）。DSL からは何もしない。
registerPromoKeyword("PM-001::makko", (state) => ({ state, detail: `${MAKKO_POWER}:battle_hook` }));

// ---------------------------------------------------------------------------
// SM-001 3人の宇宙刑事（オペレーション）
// 「特徴「宇宙刑事」を持つ自軍ユニットが1体もなければ、自軍山札を見て、特徴「宇宙刑事」を持つユニットカードを3枚まで選び、選んだカードを
//  自軍ラッシュエリアに出してもよい。ただし、この効果でカードを選ぶとき、同じカード名のユニットカードを2枚以上選ぶことはできない。
//  その後、山札をシャッフルする。」（atwiki/page-898）
// 1枚ずつ選ぶ（選んだカードと同じカード名のカードは候補から外す）。3枚選ぶか確定すると、選んだカードを効果のラッシュとして出す
// （必要パワー・追加条件は問わない。カード評価「追加条件を無視して…ラッシュできる」）。見送っても山札はシャッフルする。

const SPACE_SHERIFFS = "sm001_space_sheriffs";
const SHERIFF = "宇宙刑事";

function sheriffName(state: GameState, cardId: string): string {
  return (getDefinition(state.definitions, cardId)?.name ?? cardId).trim();
}

function sheriffCandidates(state: GameState, playerId: PlayerId, selected: string[]): string[] {
  const deck = state.players[playerId].deck;
  const taken = new Set(selected.map((id) => deck.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c).map((c) => sheriffName(state, c.cardId)));
  return deck
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && (d.features ?? []).includes(SHERIFF) && !selected.includes(c.instanceId) && !taken.has(sheriffName(state, c.cardId));
    })
    .map((c) => c.instanceId);
}

function applySpaceSheriffs(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (fieldUnits(state, ctx.playerId).some((c) => unitFeatures(state, ctx.playerId, c).includes(SHERIFF))) {
    return { state, detail: `${SPACE_SHERIFFS}:has_sheriff` };
  }
  const ids = sheriffCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state: shuffleDeck(state, ctx.playerId), detail: `${SPACE_SHERIFFS}:none` };
  return {
    state: openAfter(state, {
      ...base(ctxBase(ctx), ctx.sourceCardId),
      effectId: SPACE_SHERIFFS,
      kind: "select_unit",
      validInstanceIds: ids,
      viewedInstanceIds: state.players[ctx.playerId].deck.map((c) => c.instanceId),
      selectCount: 3,
      optional: true,
      mayConfirm: true,
    }),
    detail: SPACE_SHERIFFS,
  };
}

function finishSpaceSheriffs(state: GameState, playerId: PlayerId, selected: string[]): { state: GameState; log: string } {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const cards = selected.map((id) => next.players[playerId].deck.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    deck: p.deck.filter((c) => !selected.includes(c.instanceId)),
    rush: [...p.rush, ...cards.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
  next = shuffleDeck(next, playerId);
  if (cards.length > 0) {
    const rushed = finalizeEffectRush(next, playerId, cards.map((c) => c.instanceId), pending.phasePlayerId);
    next = rushed.logs.length > 0 ? { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] } : rushed.state;
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${SPACE_SHERIFFS}:${cards.map((c) => c.cardId).join(",")}`) };
}

registerPromoChoice(
  SPACE_SHERIFFS,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const remaining = sheriffCandidates(state, playerId, selected);
    if (selected.length >= 3 || remaining.length === 0) return finishSpaceSheriffs(state, playerId, selected);
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } } };
  },
  simpleSkip((s, pending) => shuffleDeck(s, pending.playerId)),
  (state, playerId) => finishSpaceSheriffs(state, playerId, state.pendingEffectChoice?.selectedInstanceIds ?? []),
);
registerPromoKeyword("SM-001::space_sheriffs", applySpaceSheriffs);

// ---------------------------------------------------------------------------
// SK-003 仮面ライダーファム【復讐の女詐欺師】
// 「これが自軍バトルエリアにある間、敵軍バトルフェイズ中、ホールド状態の敵軍コマンドが1つ以上あれば、特徴「男」を持つ敵軍Sユニットは、
//  次の制限を受ける⇒アタックもストライクもすることができない。」（atwiki/page-1083）
// 特徴・サイズは今のもので見る（rules/restrictions.ts cannotAttackOrStrikeThisTurn から）。

const FAMME_ID = "SK-003";

registerPromoAttackStrikeBlock((state, playerId, unit) => {
  const fammeOwner = opponent(playerId);
  if (state.phase !== "battle" || turnPlayerOf(state) !== playerId) return false;
  if (!state.players[fammeOwner].battle.some((c) => isSameCardIdentity(c.cardId, FAMME_ID))) return false;
  if (!state.players[playerId].command.some((c) => c.commandHeld)) return false;
  if (getDefinition(state.definitions, unit.cardId)?.type !== "unit" || !isSmallUnitNow(state, playerId, unit)) return false;
  return unitFeatures(state, playerId, unit).includes("男");
});
registerPromoKeyword("SK-003::famme", (state) => ({ state, detail: "sk003_famme:restriction" }));
