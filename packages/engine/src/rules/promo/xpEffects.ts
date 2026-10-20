/**
 * クロスギャザー プロモーションカード XP-001〜XP-032 のカード固有の効果（cardSpec XP-001-016・XP-017-032 の監査）。
 * 起点は DSL の grant_keyword（`promo::XP-NNN::name`。rules/promo/promoRegistry.ts）。
 * 選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import { canonicalCardName, fusionMaterialAliasNames } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition, unitSizeOf } from "../../core/catalog";
import { openEffectChoice } from "../pendingChoices";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { drawOne, opponent } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { resolveZordFusionPartnerSlots } from "../../dsl/zordBridge";
import { fieldCardMatchesPartner } from "../zord";
import { patchPlayer } from "../playerPatches";
import { startEffectRush } from "../effectRush";
import { recordReveal, revealedCards } from "../revealNotice";
import {
  base,
  close,
  ctxBase,
  fieldUnits,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  printedBp,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
} from "../rm/rm1Effects";
import { isSameCardIdentity } from "@rangers-strike/cards";
import { isSmallUnitNow, turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { registerPromoAfterAction, registerPromoChoice, registerPromoKeyword } from "./promoRegistry";

type Meta = Record<string, unknown>;

function meta<T extends Meta>(pending: PendingEffectChoice): T {
  return (pending.promoMeta ?? {}) as T;
}

// ---------------------------------------------------------------------------
// XP-006 侍合体（オペレーション）
// 「自分の手札から、合体が必要なLユニットのカードを1枚選び相手に見せる。見せたカードに表記された合体ユニットが、自軍エリアに3体以上
//  （同名ユニットは1体と数える）あれば、自軍ユニットをすべて捨札にする。このとき、見せたカードに表記された合体ユニット以外の自軍ユニットを
//  2体捨札にするたび、相手は1枚ドローしてもよい。そして、捨札にしたユニットの本来のBPの合計が見せたカードのBP以上あれば、
//  見せたカードを自軍ラッシュエリアに出す。」（atwiki/page-1556）
// 合体ユニットは合体―行の枠ごとに数える（同名は同じ枠なので1体。XG3-006 の「A＋B＋Cとしてつかえる」は3つの枠を埋める。Q1）。
// 出すのは効果のラッシュ（必要パワー・追加条件は問わない）。

const SAMURAI_PICK = "xp006_samurai_gattai";
const SAMURAI_DRAW = "xp006_samurai_gattai_draw";

function fusionLInHand(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && unitSizeOf(state.definitions, c) === "L" && resolveZordFusionPartnerSlots(c.cardId).length > 0;
    })
    .map((c) => c.instanceId);
}

/** 「A＋B＋Cとしてつかえる」の A・B・C（rules/zord.ts multiFusionAliasNames と同じ読み方）。 */
function multiAliasNames(state: GameState, cardId: string): string[] {
  for (const alias of fusionMaterialAliasNames(getDefinition(state.definitions, cardId)?.text)) {
    const parts = alias.split(/[＋+]/).map((p) => canonicalCardName(p)).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  return [];
}

/** 場のユニット card が合体―行の枠 slot（使える ID の並び）を埋めるか。 */
export function fillsSlot(state: GameState, playerId: PlayerId, card: CardInstance, slot: string[]): boolean {
  const player = state.players[playerId];
  if (slot.some((id) => fieldCardMatchesPartner(state.definitions, card, id, player))) return true;
  const aliases = multiAliasNames(state, card.cardId);
  if (aliases.length === 0) return false;
  return slot.some((id) => {
    const name = getDefinition(state.definitions, id)?.name;
    return !!name && aliases.includes(canonicalCardName(name));
  });
}

function applySamuraiGattai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fusionLInHand(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: `${SAMURAI_PICK}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: SAMURAI_PICK, kind: "select_hand", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: SAMURAI_PICK,
  };
}

function samuraiRush(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, shownId: string, rush: boolean): GameState {
  if (!rush || !state.players[playerId].hand.some((c) => c.instanceId === shownId)) return proceed(state, pending);
  const next = startEffectRush(state, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${SAMURAI_PICK}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "hand",
    candidates: [shownId],
    maxCount: 1,
    requireConditions: false,
    mandatory: true,
    forced: true,
  });
  return proceed(next, pending);
}

registerPromoChoice(SAMURAI_PICK, (state, playerId, shownId) => {
  const pending = state.pendingEffectChoice!;
  const shown = state.players[playerId].hand.find((c) => c.instanceId === shownId)!;
  let next = recordReveal(close(state, pending), {
    playerId,
    ownerId: playerId,
    sourceCardId: pending.sourceCardId,
    effectLabel: "侍合体",
    from: "hand",
    cards: revealedCards([shown], "hand"),
  });
  const slots = resolveZordFusionPartnerSlots(shown.cardId);
  const units = fieldUnits(next, playerId);
  const filled = slots.filter((slot) => units.some((u) => fillsSlot(next, playerId, u, slot))).length;
  const log = logFor(state, playerId, pending.sourceCardId, `${SAMURAI_PICK}:${shown.cardId}:${filled}`);
  if (filled < 3) return { state: proceed(next, pending), log };
  const isPartner = (u: CardInstance) => slots.some((slot) => fillsSlot(next, playerId, u, slot));
  const others = units.filter((u) => !isPartner(u)).length;
  const bpSum = units.reduce((acc, u) => acc + (Number.isFinite(printedBp(next, u.cardId)) ? printedBp(next, u.cardId) : 0), 0);
  for (const u of units) next = moveFieldUnit(next, playerId, u.instanceId, pending.phasePlayerId, "discard");
  const rush = bpSum >= (printedBp(next, shown.cardId) || 0);
  const draws = Math.floor(others / 2);
  if (draws === 0) return { state: samuraiRush(next, pending, playerId, shownId, rush), log };
  return {
    state: openNext(next, pending, {
      ...base({ playerId: opponent(playerId), phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, pending.sourceCardId),
      effectId: SAMURAI_DRAW,
      kind: "confirm",
      validInstanceIds: ["draw"],
      selectCount: 1,
      optional: true,
      promoMeta: { owner: playerId, shownId, rush, remaining: draws },
    }),
    log,
  };
});

function samuraiDrawStep(state: GameState, drawerId: PlayerId, draw: boolean): { state: GameState; log: string } {
  const pending = state.pendingEffectChoice!;
  const m = meta<{ owner: PlayerId; shownId: string; rush: boolean; remaining: number }>(pending);
  let next = close(state, pending);
  if (draw) next = patchPlayer(next, drawerId, (p) => drawOne(p));
  const log = logFor(state, drawerId, pending.sourceCardId, `${SAMURAI_DRAW}:${draw ? "draw" : "pass"}`);
  if (m.remaining > 1) {
    return { state: openNext(next, pending, { ...pending, selectedInstanceIds: [], promoMeta: { ...m, remaining: m.remaining - 1 } }), log };
  }
  return { state: samuraiRush({ ...next, activePlayer: pending.phasePlayerId }, pending, m.owner, m.shownId, m.rush), log };
}

registerPromoChoice(
  SAMURAI_DRAW,
  (state, playerId) => samuraiDrawStep(state, playerId, true),
  (state, playerId) => samuraiDrawStep(state, playerId, false),
);

registerPromoKeyword("XP-006::samurai_gattai", applySamuraiGattai);

// ---------------------------------------------------------------------------
// XP-014 仮面ライダーW・CM【メタルシャフト】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからホールド状態のＳユニットを１体選び、持ち主のコマンドゾーンに
//  ホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1883）強制。置けないときの捨札は rules/fieldLeaveQueue.ts。

const METAL_SHAFT = "xp014_metal_shaft";

function applyMetalShaft(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${METAL_SHAFT}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => c.commandHeld && getDefinition(state.definitions, c.cardId)?.type === "unit" && isSmallUnitNow(state, enemyId, c))
    .filter((c) => selectableEnemy(state, ctx.playerId, ctx.sourceCardId, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${METAL_SHAFT}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: METAL_SHAFT, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: METAL_SHAFT,
  };
}

registerPromoChoice(METAL_SHAFT, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${METAL_SHAFT}:${instanceId}`) };
});
registerPromoKeyword("XP-014::metal_shaft", applyMetalShaft);

// ---------------------------------------------------------------------------
// XP-015 ダブルドライバー ◎
// 「自軍山札を見て、特徴「ダブルドライバー」を持つユニットカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。」
// （atwiki/page-1880）選ばなくても山札はシャッフルする。

const DOUBLE_DRIVER_SEARCH = "xp015_double_driver_search";

function applyDoubleDriverSearch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].deck
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && (d.features ?? []).includes("ダブルドライバー");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: shuffleDeck(state, ctx.playerId), detail: `${DOUBLE_DRIVER_SEARCH}:none` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: DOUBLE_DRIVER_SEARCH, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: DOUBLE_DRIVER_SEARCH,
  };
}

registerPromoChoice(
  DOUBLE_DRIVER_SEARCH,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId)!;
    let next = patchPlayer(close(state, pending), playerId, (p) => ({
      ...p,
      deck: p.deck.filter((c) => c.instanceId !== instanceId),
      hand: [...p.hand, { instanceId: card.instanceId, cardId: card.cardId }],
    }));
    next = recordReveal(next, {
      playerId,
      ownerId: playerId,
      sourceCardId: pending.sourceCardId,
      effectLabel: "ダブルドライバー",
      from: "deck_top",
      cards: revealedCards([card], "hand"),
    });
    next = shuffleDeck(next, playerId);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${DOUBLE_DRIVER_SEARCH}:reveal:${card.cardId}`) };
  },
  simpleSkip((s, pending) => shuffleDeck(s, pending.playerId)),
);
registerPromoKeyword("XP-015::double_driver_search", applyDoubleDriverSearch);

// ---------------------------------------------------------------------------
// XP-013 ハイパーシンケンレッド【キョウリュウマル】
// 「これが自軍エリアにある間、自軍ターン中、自軍Sユニットがホールド状態になったとき、敵軍ゾーンのオモテ向きのカードから、追加条件を持つ
//  Sユニットのカードを1枚選び、持ち主の山札の下に戻してもよい。」（atwiki/page-1882）
// applyAction の前後で、自軍の場の S ユニットがリリース状態（または場にいない）からホールド状態になったら1回発動する（同時に何体なっても1回）。
// 選べるのは敵軍の場・コマンドゾーン・オモテ向きのパワー・捨札のカード（ウラ向きのダメージ・手札・山札は除く）。

const KYORYUMARU = "xp013_kyoryumaru";
const KYORYUMARU_ID = "XP-013";

function heldSmallIds(state: GameState, playerId: PlayerId): Set<string> {
  return new Set(
    fieldUnits(state, playerId)
      .filter((c) => c.commandHeld && isSmallUnitNow(state, playerId, c))
      .map((c) => c.instanceId),
  );
}

function kyoryumaruCandidates(state: GameState, playerId: PlayerId): string[] {
  const enemy = state.players[opponent(playerId)];
  const cards = [...enemy.battle, ...enemy.rush, ...enemy.command, ...enemy.power.filter((c) => !c.faceDown), ...enemy.discard];
  return cards
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.size === "S" && !!d.rushAdditionalCondition;
    })
    .map((c) => c.instanceId);
}

registerPromoAfterAction(
  KYORYUMARU,
  (before, after) => {
    const pid = turnPlayerOf(after);
    if (turnPlayerOf(before) !== pid) return [];
    const sources = fieldUnits(after, pid).filter((c) => isSameCardIdentity(c.cardId, KYORYUMARU_ID));
    if (sources.length === 0) return [];
    const prev = heldSmallIds(before, pid);
    const now = heldSmallIds(after, pid);
    if (![...now].some((id) => !prev.has(id))) return [];
    return sources.map((c) => ({ kind: KYORYUMARU, playerId: pid, sourceInstanceId: c.instanceId, phasePlayerId: pid }));
  },
  (state, trigger) => {
    const source = fieldUnits(state, trigger.playerId).find((c) => c.instanceId === trigger.sourceInstanceId);
    if (!source) return null;
    const ids = kyoryumaruCandidates(state, trigger.playerId);
    if (ids.length === 0) return null;
    return {
      ...base({ playerId: trigger.playerId, phasePlayerId: trigger.phasePlayerId, sourceInstanceId: source.instanceId }, source.cardId),
      effectId: KYORYUMARU,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    };
  },
);

registerPromoChoice(
  KYORYUMARU,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    let next = close(state, pending);
    if (fieldUnits(next, enemyId).some((c) => c.instanceId === instanceId)) {
      next = moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "deck_bottom");
    } else {
      next = patchPlayer(next, enemyId, (p) => {
        const card = [...p.command, ...p.power, ...p.discard].find((c) => c.instanceId === instanceId);
        if (!card) return p;
        const drop = (cards: CardInstance[]) => cards.filter((c) => c.instanceId !== instanceId);
        return { ...p, command: drop(p.command), power: drop(p.power), discard: drop(p.discard), deck: [...p.deck, { instanceId: card.instanceId, cardId: card.cardId }] };
      });
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${KYORYUMARU}:${instanceId}`) };
  },
  simpleSkip(),
);

// ---------------------------------------------------------------------------
// XP-016 仮面ライダークウガRU・レッドアイ【赤い瞳に宿るもの】
// 「これが自軍エリアにある間、このユニットよりBPの低い自軍ユニットがアタックされたとき、アタックされたユニットをホールドしてもよい。
//  そうしたとき、アタックしてきたユニットは、ホールドしたユニットのかわりに、このユニットとバトルする。このバトル中、自軍エリアに
//  「仮面ライダーディケイド」があれば、これはBP+2000される。」（atwiki/page-1982）
// アタックの「アタックされたとき」（カウンター窓の前。RM-062 テントリーナ・RK-188 ベリーと同じ場所。core/applyAction.ts）に、守る側へ
// 任意の確認を開く。ホールドすると、バトルの相手（defenderInstanceId）をこのユニットに替える。BP は今の BP で比べる。
// 「仮面ライダーディケイド」の有無はホールドしたときに見る（XP-judgments.md）。効果のバトルでは開かない。

const RED_EYE = "xp016_red_eye";
const RED_EYE_ID = "XP-016";
const DECADE_NAME = "仮面ライダーディケイド";

type RedEyeMeta = { battle: PendingBattle; wingAttackFromRush: boolean };

export function openPromoAttacked(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.promoAttackedOffered || battle.battleCancelled || battle.effectBattle) return null;
  const defenderId = battle.defenderPlayerId;
  const attacked = fieldUnits(state, defenderId).find((c) => c.instanceId === battle.defenderInstanceId);
  if (!attacked || attacked.commandHeld) return null;
  const attackedBp = effectiveBp(state, defenderId, attacked);
  const source = fieldUnits(state, defenderId).find(
    (c) => c.instanceId !== attacked.instanceId && isSameCardIdentity(c.cardId, RED_EYE_ID) && effectiveBp(state, defenderId, c) > attackedBp,
  );
  if (!source) return null;
  const promoMeta: RedEyeMeta = { battle: { ...battle, promoAttackedOffered: true }, wingAttackFromRush };
  const choice: PendingEffectChoice = {
    ...base({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: source.instanceId }, source.cardId),
    effectId: RED_EYE,
    kind: "confirm",
    validInstanceIds: ["hold"],
    selectCount: 1,
    optional: true,
    promoMeta,
  };
  return { ...openEffectChoice(state, choice), activePlayer: defenderId };
}

export function isPromoAttackedChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === RED_EYE && !!pending.promoMeta?.battle;
}

type AttackedOutcome = { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean };

/** ホールドした。アタックされたユニットをホールドし、バトルの相手をこのユニットに替えて続ける。 */
export function resolvePromoAttacked(state: GameState, playerId: PlayerId, instanceId: string): AttackedOutcome | { error: string } {
  const pending = state.pendingEffectChoice;
  if (!pending || !isPromoAttackedChoice(pending) || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const m = meta<RedEyeMeta>(pending);
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: m.battle.phasePlayerId };
  const source = fieldUnits(next, playerId).find((c) => c.instanceId === pending.sourceInstanceId);
  if (!source) return { state: next, battle: m.battle, wingAttackFromRush: m.wingAttackFromRush };
  const attackedId = m.battle.defenderInstanceId;
  const hold = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === attackedId ? { ...c, commandHeld: true } : c));
  next = patchPlayer(next, playerId, (p) => ({ ...p, battle: hold(p.battle), rush: hold(p.rush) }));
  const decade = fieldUnits(next, playerId).some((c) => {
    const name = getDefinition(next.definitions, c.cardId)?.name;
    return !!name && canonicalCardName(name) === canonicalCardName(DECADE_NAME);
  });
  next = { ...next, log: [...next.log, logFor(state, playerId, pending.sourceCardId, `${RED_EYE}:hold:${attackedId}${decade ? ":decade" : ""}`)] };
  const battle: PendingBattle = {
    ...m.battle,
    defenderInstanceId: source.instanceId,
    defenderBpBonus: decade ? (m.battle.defenderBpBonus ?? 0) + 2000 : m.battle.defenderBpBonus,
  };
  return { state: next, battle, wingAttackFromRush: m.wingAttackFromRush };
}

/** ホールドしなかった。そのまま続けるアタックを返す。 */
export function skipPromoAttacked(state: GameState, playerId: PlayerId): AttackedOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || !isPromoAttackedChoice(pending) || pending.playerId !== playerId) return null;
  const m = meta<RedEyeMeta>(pending);
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: m.battle.phasePlayerId, log: [...state.log, logFor(state, playerId, pending.sourceCardId, `${RED_EYE}:pass`)] },
    battle: m.battle,
    wingAttackFromRush: m.wingAttackFromRush,
  };
}

// legalActions に候補を出すために登録する（解決は core/applyAction.ts の resolvePromoAttacked・skipPromoAttacked）。
registerPromoChoice(
  RED_EYE,
  () => ({ error: "xp016_handled_by_attack" }),
  () => ({ error: "xp016_handled_by_attack" }),
);
// 継続効果（アタックの処理から開く）。DSL からは何もしない。
registerPromoKeyword("XP-016::red_eye", (state) => ({ state, detail: `${RED_EYE}:attack_hook` }));

// ---------------------------------------------------------------------------
// XP-005 仮面ライダーディケイドCF【全てを集めた先にあるもの】
// 「自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーから効果名「アタックライド」を持つカードを1枚選んでもよい。
//  そうしたとき、選んだカードの「アタックライド」の効果を、このユニットの効果としてナンバーに関係なく発動する。」（atwiki/page-1557）
// 選んだカードはパワーゾーンに残る。効果は CF のインスタンスに選んだカードの ID を借りて、その RC の効果（DSL の riding_combo）として
// 実行する（RS-421【ソウル降臨】fireAkaRedSoulNc と同じ借り方）。

const ALL_COLLECTED = "xp005_all_collected";

function attackRideCards(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power
    .filter((c) => !c.faceDown && (getDefinition(state.definitions, c.cardId)?.text ?? "").includes("【アタックライド】"))
    .map((c) => c.instanceId);
}

function applyAllCollected(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${ALL_COLLECTED}:not_own_turn` };
  const ids = attackRideCards(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: `${ALL_COLLECTED}:no_targets` };
  return {
    state: openAfter(state, {
      ...base(ctxBase(ctx), "XP-005"),
      effectId: ALL_COLLECTED,
      kind: "select_power",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    detail: ALL_COLLECTED,
  };
}

registerPromoChoice(
  ALL_COLLECTED,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const picked = state.players[playerId].power.find((c) => c.instanceId === instanceId);
    let next = close(state, pending);
    const self = fieldUnits(next, playerId).find((c) => c.instanceId === pending.sourceInstanceId);
    const log = logFor(state, playerId, pending.sourceCardId, `${ALL_COLLECTED}:${picked?.cardId ?? instanceId}`);
    if (!picked || !self) return { state: proceed(next, pending), log };
    const fired = tryResolveDslTriggeredEffects({
      state: next,
      cardId: picked.cardId,
      instanceId: self.instanceId,
      playerId,
      phasePlayerId: pending.phasePlayerId,
      triggerType: "riding_combo",
      logAction: "riding_combo",
    });
    next = fired.handled ? fired.state : resolveRidingComboOnRideOff(next, playerId, { ...self, cardId: picked.cardId }).state;
    return { state: proceed(next, pending), log };
  },
  simpleSkip(),
);

registerPromoKeyword("XP-005::all_collected", applyAllCollected);
