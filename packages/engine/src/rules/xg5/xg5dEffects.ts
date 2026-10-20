/**
 * クロスギャザー XG5 XG5-061〜XG5-080（バッファローアンデッド〜マシンディケイダー）のカード固有の効果（cardSpec XG5-061-080 の監査）。
 * 登録先は rules/xg5/xg5Core.ts。継続効果の判定（XG5-071・074 の BP・SP、ターン終了時のリリース）は rules/xg5/xg5Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { effectiveBp } from "../../core/catalog";
import { countAvailablePower } from "../../core/power";
import { addTurnRestrictionModifier, addTurnRuleModifier, TURN_RULE_IDS } from "../../core/scopedModifiers";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { listDslEffectsForTrigger } from "../../dsl/effectLookup";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { patchPlayer } from "../playerPatches";
import {
  type BaseCtx,
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
  fieldCards,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import {
  AFTER_ACTION_HOOKS,
  ATTACK_WIN_HOOKS,
  CHOICE_CONFIRMERS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  HAND_ACTIVATIONS,
  NC_INTERCEPTS,
  NC_RESUME,
  XG5_CONFINE_RESTRICTION,
  XG5_CONFINE_WINDOW_EFFECT_ID,
  XG5_KEYWORDS,
  noop,
} from "./xg5Core";
import { canPlayHandCounter } from "../operationCounters";
import { opponentInfiniteChainBlocks } from "../turnModifiers";
import { printedCostNumber, xg5CostNumber, xg5Flags, xg5TurnPlayer } from "./xg5Fields";
import { multiChoice, registerMulti } from "./xg5bEffects";
import { addFlag, defOf, newBattleUnits, opp, patchXg5, printedCategories, printedFeatures, selectOne, setFieldHeld, sizeOf, xg5Busy } from "./xg5Shared";

const PLAYERS: PlayerId[] = ["player1", "player2"];

function isUnit(state: GameState, c: CardInstance): boolean {
  return defOf(state, c.cardId)?.type === "unit";
}
function isSUnit(state: GameState, c: CardInstance): boolean {
  return isUnit(state, c) && sizeOf(state, c) === "S";
}
function ownRushPhase(state: GameState, playerId: PlayerId): boolean {
  return state.phase === "rush" && xg5TurnPlayer(state) === playerId;
}
function patch(state: GameState, playerId: PlayerId, f: (p: PlayerState) => PlayerState): GameState {
  return patchPlayer(state, playerId, f);
}

/** 自軍ラッシュエリアのこれを捨札にする（ラッシュエリアに出すかわりに捨札にして）。 */
function rushToDiscard(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const card = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return patch(state, playerId, (p) => ({ ...p, rush: p.rush.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
}

/**
 * 場のユニット（fieldId）と、自軍パワーゾーン・捨札のカード（cardId）を置き換える（その場所に置くだけで、出したユニットの効果は発動しない）。
 * 場のユニットは、置き換えたカードがあったゾーンにオモテ向きで置く。
 */
function swapFieldWith(state: GameState, playerId: PlayerId, fieldId: string, otherId: string): GameState {
  return patch(state, playerId, (p) => {
    const zone = p.rush.some((c) => c.instanceId === fieldId) ? "rush" : p.battle.some((c) => c.instanceId === fieldId) ? "battle" : null;
    const from = p.power.some((c) => c.instanceId === otherId) ? "power" : p.discard.some((c) => c.instanceId === otherId) ? "discard" : null;
    if (!zone || !from) return p;
    const self = p[zone].find((c) => c.instanceId === fieldId)!;
    const other = p[from].find((c) => c.instanceId === otherId)!;
    const placedSelf = from === "power" ? { ...stripForZone(self), faceDown: false } : stripForZone(self);
    return {
      ...p,
      [zone]: p[zone].map((c) => (c.instanceId === fieldId ? stripForZone(other) : c)),
      [from]: p[from].map((c) => (c.instanceId === otherId ? placedSelf : c)),
    };
  });
}

// ---------------------------------------------------------------------------
// XG5-061 バッファローアンデッド【スペード8－マグネット】・XG5-062 モスアンデッド【ハート8－リフレクト】
// 「自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして、次の効果を発動できる⇒…」（atwiki/page-2183・2209）。
// ラッシュしたとき（DSL on_rush）に発動するかを確認する。発動すればラッシュエリアのこれを捨札にする。
// XG5-061: 敵軍ラッシュエリアの「メカ」の S ユニットをすべて敵軍バトルエリアに出してもよい（出す順番は自分が選ぶ。1体目を選ばなければ出さない）。
// XG5-062: このターン、相手はカウンターを発動できない（RS の【無限連鎖】と同じターンのルール）。

const INSTEAD = "xg5_instead_discard";
const MAGNET = "xg5_061_magnet";
for (const id of ["XG5-061", "XG5-062"]) {
  XG5_KEYWORDS[`${id}::instead`] = (state, ctx) => {
    const self = ctx.triggerSourceInstanceId;
    if (!self || !ownRushPhase(state, ctx.playerId) || !state.players[ctx.playerId].rush.some((c) => c.instanceId === self)) return { state, detail: `${id}:no_instead` };
    return { state: openAfter(state, confirmChoice(ctxBase(ctx), id, INSTEAD)), detail: INSTEAD };
  };
}
CHOICE_RESOLVERS[INSTEAD] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[INSTEAD] = simpleSkip();
CHOICE_CONFIRMERS[INSTEAD] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = rushToDiscard(close(state, pending), playerId, pending.sourceInstanceId ?? "");
  const log = logFor(state, playerId, pending.sourceCardId, `${INSTEAD}:discard`);
  if (isSameCardIdentity(pending.sourceCardId, "XG5-062")) {
    next = patch(next, playerId, (p) => addTurnRuleModifier(p, TURN_RULE_IDS.INFINITE_CHAIN, { sourceCardId: "XG5-062" }));
    return { state: proceed(next, pending), log };
  }
  const ids = magnetTargets(next, playerId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-061", MAGNET, ids, true)), log };
};
function magnetTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[opp(playerId)].rush.filter((c) => isSUnit(state, c) && printedFeatures(state, c.cardId).includes("メカ")).map((c) => c.instanceId);
}
CHOICE_RESOLVERS[MAGNET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  let next = close(state, pending);
  const card = next.players[enemyId].rush.find((c) => c.instanceId === instanceId);
  if (card) next = patch(next, enemyId, (p) => ({ ...p, rush: p.rush.filter((c) => c.instanceId !== instanceId), battle: [...p.battle, card] }));
  const log = logFor(state, playerId, "XG5-061", `${MAGNET}:${instanceId}`);
  const rest = magnetTargets(next, playerId);
  if (rest.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-061", MAGNET, rest, false)), log };
};
CHOICE_SKIPPERS[MAGNET] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-063 ペッカーアンデッド【ダイヤ4－ラピッド】
// 「自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。
//  そうしたとき、このターン、選んだユニットは次の能力を得る⇒これはアタックとストライクを1度ずつ行ってもよい。」（atwiki/page-2210）。
// 選ぶことが発動の宣言。能力は rules/keywordGapRuntime.ts battleActBlocked（ターンの制限 xg5_attack_and_strike_once）。

const RAPID = "xg5_063_rapid";
XG5_KEYWORDS["XG5-063::rapid"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self || !ownRushPhase(state, ctx.playerId) || !state.players[ctx.playerId].rush.some((c) => c.instanceId === self)) return { state, detail: "xg5_063:no_instead" };
  const ids = fieldUnits(state, ctx.playerId).filter((c) => c.instanceId !== self && printedFeatures(state, c.cardId).includes("仮面ライダー")).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_063:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-063", RAPID, ids, true)), detail: RAPID };
};
CHOICE_RESOLVERS[RAPID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = rushToDiscard(close(state, pending), playerId, pending.sourceInstanceId ?? "");
  next = patch(next, playerId, (p) => addTurnRestrictionModifier(p, instanceId, "xg5_attack_and_strike_once"));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-063", `${RAPID}:${instanceId}`) };
};
CHOICE_SKIPPERS[RAPID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-064 コンファインベント（カウンター）
// 「※カウンター 敵軍バトルフェイズ開始時に発動できる⇒敵軍ユニットまたは敵軍ビークルを1体選ぶ。このターン、そのユニットまたはビークルの
//  効果名を持つテキストは無効になり、発動もできない。」（atwiki/page-2211）。
// 敵軍がラッシュフェイズを終えてバトルフェイズに進んだとき（core/applyAction.ts end_phase）、手札のこれを使えるなら使用の窓
// （XG5_CONFINE_WINDOW_EFFECT_ID）を開く。窓の間の合法手はこれのカテゴリの支払い・play_counter と見送り（skip_effect_choice。core/legalActions.ts）。
// 無効は選んだカードの持ち主の turn スコープの restriction（XG5_CONFINE_RESTRICTION）で表し、効果名を持つテキストの無効の共通の判定
// （rules/legend1/set6NamedEffects348.ts namedTextNegated）が見る。
// 割り切り: RK-011 第三の眼はこの窓のカウンターに割り込まない（窓を退避する手順がない）。

const CONFINE_PICK = "xg5_064_confine_pick";

/** 敵軍（phasePlayerId）バトルフェイズ開始時: 相手の手札にこれがあり使えるなら、使用の窓を開く。 */
export function openXg5ConfineVentWindow(state: GameState, phasePlayerId: PlayerId): GameState {
  const ownerId = opp(phasePlayerId);
  // XG5-062【ハート8－リフレクト】等で、このターン相手がカウンターを発動できない間は開かない。
  if (opponentInfiniteChainBlocks(state, ownerId) || state.counterLockedPlayerId === ownerId) return state;
  const ids = state.players[ownerId].hand
    .filter((c) => isSameCardIdentity(c.cardId, "XG5-064") && canPlayHandCounter(state, ownerId, c.instanceId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  const window = { ...confirmChoice({ playerId: ownerId, phasePlayerId, sourceInstanceId: ids[0] }, "XG5-064", XG5_CONFINE_WINDOW_EFFECT_ID), validInstanceIds: ids, mayConfirm: false };
  return openAfter(state, window);
}

/** 窓の間に手札のこれを使う（core/applyAction.ts play_counter）。窓でなければ null。 */
export function playXg5ConfineVent(state: GameState, playerId: PlayerId, counterInstanceId: string): { state: GameState; log: string } | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== XG5_CONFINE_WINDOW_EFFECT_ID || pending.playerId !== playerId) return null;
  const card = state.players[playerId].hand.find((c) => c.instanceId === counterInstanceId && isSameCardIdentity(c.cardId, "XG5-064"));
  if (!card) return null;
  const next = patch(close(state, pending), playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== counterInstanceId),
    discard: [...p.discard, stripForZone(card)],
  }));
  const enemyId = opp(playerId);
  const ids = fieldCards(next, enemyId)
    .filter((c) => {
      const type = defOf(next, c.cardId)?.type;
      return (type === "unit" || type === "vehicle") && selectableEnemy(next, playerId, card.cardId, c);
    })
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, card.cardId, `${XG5_CONFINE_WINDOW_EFFECT_ID}:play`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: card.instanceId }, card.cardId, CONFINE_PICK, ids, false)), log };
}

CHOICE_RESOLVERS[XG5_CONFINE_WINDOW_EFFECT_ID] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[XG5_CONFINE_WINDOW_EFFECT_ID] = simpleSkip();
CHOICE_RESOLVERS[CONFINE_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  const next = patch(close(state, pending), enemyId, (p) => addTurnRestrictionModifier(p, instanceId, XG5_CONFINE_RESTRICTION));
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${CONFINE_PICK}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-065 タイムベント（オペレーション）「追加条件を持たないユニットをすべて撃破する。」（atwiki/page-2261）。両軍・エリア・サイズを問わない。

XG5_KEYWORDS["XG5-065::time_vent"] = (state, ctx) => {
  const ids = PLAYERS.flatMap((pid) => fieldUnits(state, pid).filter((c) => isUnit(state, c) && !defOf(state, c.cardId)?.rushAdditionalCondition).map((c) => c.instanceId));
  return { state: destroyAll(state, ctxBase(ctx), "XG5-065", "xg5_065_time_vent", ids), detail: "xg5_065:destroy_all" };
};

// ---------------------------------------------------------------------------
// XG5-066 仮面ライダーベルデ【コピーベント】
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、次の効果を発動できる⇒自軍ゾーンのオモテ向きのカードから、特徴「ミラーライダー」を持つユニットのカードを
//  1枚選びこれと置き換えてもよい。ただし、必要パワーは満たすこと。」（atwiki/page-2212）。合法手は activate_field_unit_ability（場のこのカード）。
// 自軍ゾーンのオモテ向きのカードは、パワーゾーンのオモテ向きのカードと捨札。必要パワーは自軍パワーの数。

const COPY_VENT = "xg5_066_copy_vent";
function copyVentTargets(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  const power = countAvailablePower(state, playerId);
  return [...p.power.filter((c) => !c.faceDown), ...p.discard]
    .filter((c) => isUnit(state, c) && printedFeatures(state, c.cardId).includes("ミラーライダー") && printedCostNumber(state, c.cardId) <= power)
    .map((c) => c.instanceId);
}
HAND_ACTIVATIONS.push({
  list: (state, playerId) => {
    if (!ownRushPhase(state, playerId) || state.activePlayer !== playerId || xg5Busy(state)) return [];
    if (copyVentTargets(state, playerId).length === 0) return [];
    return fieldCards(state, playerId).filter((c) => isSameCardIdentity(c.cardId, "XG5-066")).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    if (!findField(state, playerId, instanceId)) return null;
    const ids = copyVentTargets(state, playerId);
    if (ids.length === 0) return null;
    return openAfter(state, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG5-066", COPY_VENT, ids, true));
  },
});
CHOICE_RESOLVERS[COPY_VENT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = swapFieldWith(close(state, pending), playerId, pending.sourceInstanceId ?? "", instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-066", `${COPY_VENT}:${instanceId}`) };
};
CHOICE_SKIPPERS[COPY_VENT] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-068 仮面ライダーナイトサバイブ【戦い続ける覚悟】（RC）
// 「常駐しているオペレーションカードを1枚選び捨札にしてもよい。そうしたとき、そのカードの持ち主は次のようにする⇒ウラ向きのパワーを1枚選び捨札にするか、
//  オモテ向きのパワーを1枚選びダメージにするかを選ぶ。」（atwiki/page-2229）。両軍の常駐置き場から。持ち主はパワーゾーンのカード1枚を選ぶ
// （ウラ向きなら捨札に、オモテ向きならダメージに）。

const SURVIVE = "xg5_068_survive";
const SURVIVE_POWER = "xg5_068_survive_power";
XG5_KEYWORDS["XG5-068::survive"] = (state, ctx) => {
  const ids = PLAYERS.flatMap((pid) => state.players[pid].operation.map((c) => c.instanceId));
  if (ids.length === 0) return { state, detail: "xg5_068:no_resident" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-068", SURVIVE, ids, true)), detail: SURVIVE };
};
CHOICE_RESOLVERS[SURVIVE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = PLAYERS.find((pid) => state.players[pid].operation.some((c) => c.instanceId === instanceId))!;
  let next = patch(close(state, pending), owner, (p) => {
    const card = p.operation.find((c) => c.instanceId === instanceId)!;
    return { ...p, operation: p.operation.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card), ...(card.stackedCards ?? []).map(stripForZone)] };
  });
  const log = logFor(state, playerId, "XG5-068", `${SURVIVE}:${instanceId}`);
  const ids = next.players[owner].power.map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, selectOne({ ...pendingBase(pending), playerId: owner }, "XG5-068", SURVIVE_POWER, ids, false));
  return { state: next, log };
};
CHOICE_SKIPPERS[SURVIVE] = simpleSkip();
CHOICE_RESOLVERS[SURVIVE_POWER] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patch(close(state, pending), playerId, (p) => {
    const card = p.power.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    if (card.faceDown) return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)], damage: Math.max(0, p.damage - 1) };
    return { ...p, power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)), damage: p.damage + 1 };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-068", `${SURVIVE_POWER}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-069 キハダガニ【待ち伏せ】
// 「敵軍ターン中、これがSユニットとのバトルで撃破されて捨札になったとき、これとバトルしたユニットを、持ち主の山札の下に戻してもよい。」（atwiki/page-2214）。
// 敵軍の S ユニットにアタックされ、バトルで撃破されて捨札になったとき（rules/operationCounters.ts の applyXg5AttackWin）。

const AMBUSH = "xg5_069_ambush";
ATTACK_WIN_HOOKS.push((state, attackerId, attackerInstanceId, phasePlayerId, defenderInstanceId) => {
  if (phasePlayerId !== attackerId || !defenderInstanceId) return state;
  const ownerId = opp(attackerId);
  const dead = state.players[ownerId].discard.find((c) => c.instanceId === defenderInstanceId);
  if (!dead || !isSameCardIdentity(dead.cardId, "XG5-069")) return state;
  const attacker = findField(state, attackerId, attackerInstanceId);
  if (!attacker || !isSUnit(state, attacker)) return state;
  return openAfter(state, { ...selectOne({ playerId: ownerId, phasePlayerId }, "XG5-069", AMBUSH, [attackerInstanceId], true), xg5Meta: { owner: attackerId } });
});
CHOICE_RESOLVERS[AMBUSH] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), pending.xg5Meta?.owner ?? opp(playerId), instanceId, pending.phasePlayerId, "deck_bottom");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-069", `${AMBUSH}:${instanceId}`) };
};
CHOICE_SKIPPERS[AMBUSH] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-070 ニビイロヘビ【偵察】
// 「これが自軍エリアにある間、敵軍SユニットがＮＣまたはＲＣまたはＪＣの効果を発動させたとき、その効果を実行する前に、これをホールドしてもよい。
//  そうしたとき、そのNCまたはRCまたはJCの効果を無効にする。」（atwiki/page-2215）。
// NC の効果を実行する前（rules/numberComboEffects.ts applyNumberComboEffect の NC_INTERCEPTS）に、リリース状態のこれを選ぶか尋ねる。
// 選べばその NC の効果は実行しない。見送れば NC の効果を実行する（NC_RESUME）。RC・JC は扱っていない。

const SCOUT = "xg5_070_scout";
NC_INTERCEPTS.push((state, playerId, card, effectId) => {
  if (!isSUnit(state, card)) return null;
  if (xg5Flags(state, "xg5-070-asked").some((f) => f.target === card.instanceId && f.turn === state.turn)) return null;
  const ownerId = opp(playerId);
  const snakes = fieldCards(state, ownerId).filter((c) => isSameCardIdentity(c.cardId, "XG5-070") && !c.commandHeld);
  if (snakes.length === 0) return null;
  const marked = addFlag(state, { kind: "xg5-070-asked", playerId: ownerId, turn: state.turn, target: card.instanceId });
  const choice = {
    ...selectOne({ playerId: ownerId, phasePlayerId: playerId, sourceInstanceId: snakes[0]!.instanceId }, "XG5-070", SCOUT, snakes.map((c) => c.instanceId), true),
    xg5Meta: { target: card.instanceId, owner: playerId, step: effectId ?? "" },
  };
  return { state: openAfter(marked, choice), logs: [] };
});
function resumeNc(state: GameState, pending: { xg5Meta?: { target?: string; owner?: PlayerId; step?: string } }): GameState {
  const ownerId = pending.xg5Meta?.owner;
  const id = pending.xg5Meta?.target;
  const card = ownerId && id ? findField(state, ownerId, id) : undefined;
  if (!card || !ownerId || !NC_RESUME.fn) return state;
  const r = NC_RESUME.fn(state, ownerId, card, pending.xg5Meta?.step || undefined);
  return r.logs.length > 0 ? { ...r.state, log: [...r.state.log, ...r.logs] } : r.state;
}
CHOICE_RESOLVERS[SCOUT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = setFieldHeld(close(state, pending), playerId, instanceId, true);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-070", `${SCOUT}:negate`) };
};
CHOICE_SKIPPERS[SCOUT] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = resumeNc(close(state, pending), pending);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-070", `${SCOUT}:pass`) };
};

// ---------------------------------------------------------------------------
// XG5-071 仮面ライダー響鬼【鍛えてます】（NC）
// 「このユニットよりBPの低い自軍ユニットがあれば、このターン、これは次の能力を得る⇒BP+1000され、このターンを終えるときホールド状態ならリリースしてもよい。」
// （atwiki/page-2264）。BP はいまの BP（NC の効果を処理したとき）。BP とターン終了時のリリースは rules/xg5/xg5Fields.ts（flags の xg5-071）。

XG5_KEYWORDS["XG5-071::kitaetemasu"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  const card = self ? findField(state, ctx.playerId, self) : undefined;
  if (!card) return { state, detail: "xg5_071:no_source" };
  const bp = effectiveBp(state, ctx.playerId, card);
  const lower = fieldUnits(state, ctx.playerId).some((c) => c.instanceId !== card.instanceId && effectiveBp(state, ctx.playerId, c) < bp);
  if (!lower) return { state, detail: "xg5_071:no_lower" };
  return { state: addFlag(state, { kind: "xg5-071", playerId: ctx.playerId, turn: state.turn, target: card.instanceId }), detail: "xg5_071:bp" };
};

// ---------------------------------------------------------------------------
// XG5-072 仮面ライダー威吹鬼【挫けぬ疾風】（RC）
// 「敵軍山札をシャッフルしてもよい。そうしたとき、敵軍山札の上から3枚をオモテにし、その中にDAを持つカードがあれば、このユニットをリリースする。その後、
//  オモテにしたカードを山札の上に好きな順で戻す。」（atwiki/page-2278）。発動するかは「シャッフルする」を選ぶか見送るかで表す。戻す順は選んだ順（最初が一番上）。
// XG5-079【ライダーカード】から発動したときは、選択の発生源を XG5-079 にする（ctx.sourceCardId）。

const IBUKI = "xg5_072_ibuki";
const IBUKI_ORDER = "xg5_072_ibuki_order";
XG5_KEYWORDS["XG5-072::ibuki"] = (state, ctx) => {
  if (state.players[opp(ctx.playerId)].deck.length === 0) return { state, detail: "xg5_072:empty_deck" };
  const source = ctx.sourceCardId === "XG5-079" ? "XG5-079" : "XG5-072";
  return { state: openAfter(state, selectOne(ctxBase(ctx), source, IBUKI, ["shuffle"], true)), detail: IBUKI };
};
CHOICE_RESOLVERS[IBUKI] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  let next = shuffleDeck(close(state, pending), enemyId);
  const top = next.players[enemyId].deck.slice(0, 3);
  if (top.some((c) => printedCategories(next, c.cardId).includes("DA")) && pending.sourceInstanceId) next = setFieldHeld(next, playerId, pending.sourceInstanceId, false);
  const log = logFor(state, playerId, pending.sourceCardId, `${IBUKI}:shuffle`);
  if (top.length <= 1) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...multiChoice(pendingBase(pending), pending.sourceCardId, IBUKI_ORDER, top.map((c) => c.instanceId), top.length), optional: false, mayConfirm: false }), log };
};
CHOICE_SKIPPERS[IBUKI] = simpleSkip();
registerMulti(IBUKI_ORDER, (state, pending, ids) =>
  patch(state, opp(pending.playerId), (p) => {
    const set = new Set(ids);
    const picked = ids.map((id) => p.deck.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
    return { ...p, deck: [...picked, ...p.deck.filter((c) => !set.has(c.instanceId))] };
  }),
);

// ---------------------------------------------------------------------------
// XG5-073 仮面ライダー電王SF【俺の必殺技】（RC）
// 「自分の手札を1枚捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のパワーゾーンに送る。」
// （atwiki/page-2243）。送ったユニットはオモテ向き（ダメージではない）。

const ORE = "xg5_073_ore_no_hissatsu";
const ORE_TARGET = "xg5_073_ore_target";
XG5_KEYWORDS["XG5-073::ore_no_hissatsu"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_073:no_hand" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-073", ORE, ids, true)), detail: ORE };
};
CHOICE_RESOLVERS[ORE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  const next = patch(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  const n = printedCostNumber(state, card.cardId);
  const enemyId = opp(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => xg5CostNumber(next, playerId, enemyId, c.cardId) === n && selectableEnemy(next, playerId, "XG5-073", c)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG5-073", `${ORE}:${instanceId}`);
  if (!Number.isFinite(n) || ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-073", ORE_TARGET, ids, false)), log };
};
CHOICE_SKIPPERS[ORE] = simpleSkip();
CHOICE_RESOLVERS[ORE_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-073", `${ORE_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-074 仮面ライダーキバ【ファンガイアの王】
// 「これをホールドしてDAを持つユニットをラッシュしたとき、このターン中、そのユニットは次の効果を得る⇒BP+3000され、本来のSPが空欄なら「SP1/3」になる。」
// （atwiki/page-2245）。手札の DA のユニットのラッシュのコマンドの支払いでこれがホールドされたら、そのユニットに印（flags の xg5-074）を付ける。
// BP・SP は rules/xg5/xg5Fields.ts。

AFTER_ACTION_HOOKS.push((before, after) => {
  const pay = before.pendingCommandPayment;
  if (!pay || pay.kind !== "category_use" || after.pendingCommandPayment === pay) return after;
  const pid = pay.playerId;
  const source = before.players[pid].hand.find((c) => c.instanceId === pay.sourceInstanceId);
  if (!source || defOf(before, source.cardId)?.type !== "unit" || !printedCategories(before, source.cardId).includes("DA")) return after;
  const wasReleased = new Set(fieldCards(before, pid).filter((c) => isSameCardIdentity(c.cardId, "XG5-074") && !c.commandHeld).map((c) => c.instanceId));
  if (!fieldCards(after, pid).some((c) => wasReleased.has(c.instanceId) && c.commandHeld)) return after;
  return addFlag(after, { kind: "xg5-074", playerId: pid, turn: after.turn, target: source.instanceId });
});

// ---------------------------------------------------------------------------
// XG5-075 仮面ライダーイクサSM【母娘の絆】（NC）
// 「このターン、次に特徴「女」を持つ自軍ユニットが敵軍ユニットを撃破したとき、自軍捨札から特徴「男」を持つユニットカードを1枚選び、手札に加えてもよい。」
// （atwiki/page-2246）。成立したときは印（flags の xg5-075）を付けるだけ。「女」の自軍ユニットがアタックしてバトルで撃破したとき（applyXg5AttackWin）に選ぶ。

const BOJO = "xg5_075_bojo";
XG5_KEYWORDS["XG5-075::bojo"] = (state, ctx) => ({ state: addFlag(state, { kind: "xg5-075", playerId: ctx.playerId, turn: state.turn }), detail: "xg5_075:armed" });
ATTACK_WIN_HOOKS.push((state, attackerId, attackerInstanceId, phasePlayerId) => {
  const flag = xg5Flags(state, "xg5-075").find((f) => f.playerId === attackerId && f.turn === state.turn);
  if (!flag) return state;
  const attacker = findField(state, attackerId, attackerInstanceId);
  if (!attacker || !printedFeatures(state, attacker.cardId).includes("女")) return state;
  let next = patchXg5(state, (x) => ({ ...x, flags: (x.flags ?? []).map((f) => (f === flag ? { ...f, kind: "xg5-075-done" } : f)) }));
  const ids = next.players[attackerId].discard.filter((c) => isUnit(next, c) && printedFeatures(next, c.cardId).includes("男")).map((c) => c.instanceId);
  if (ids.length === 0) return next;
  next = openAfter(next, selectOne({ playerId: attackerId, phasePlayerId, sourceInstanceId: attackerInstanceId }, "XG5-075", BOJO, ids, true));
  return next;
});
CHOICE_RESOLVERS[BOJO] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patch(close(state, pending), playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    return card ? { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-075", `${BOJO}:${instanceId}`) };
};
CHOICE_SKIPPERS[BOJO] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-076 仮面ライダーイクサBM【ダブル・ブロウクン・ファング】
// 「これが特徴「女」を持つ自軍ユニットからコンビネーションするとき、次の効果を発動できる⇒自軍コマンドの枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。」
// （atwiki/page-2247）。自軍バトルエリアで「女」のユニットのすぐ後に出たとき。コマンドの枚数は自軍コマンドゾーンの枚数。選ぶことが発動の宣言。

const FANG = "xg5_076_fang";
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of PLAYERS) {
    for (const u of newBattleUnits(before, after, pid)) {
      if (!isSameCardIdentity(u.cardId, "XG5-076")) continue;
      const battle = after.players[pid].battle;
      const i = battle.findIndex((c) => c.instanceId === u.instanceId);
      if (i <= 0 || !printedFeatures(after, battle[i - 1]!.cardId).includes("女")) continue;
      const enemyId = opp(pid);
      const n = after.players[pid].command.length;
      const ids = fieldUnits(after, enemyId).filter((c) => isSUnit(after, c) && xg5CostNumber(after, pid, enemyId, c.cardId) <= n && selectableEnemy(after, pid, "XG5-076", c)).map((c) => c.instanceId);
      if (ids.length === 0) continue;
      next = openAfter(next, selectOne({ playerId: pid, phasePlayerId: xg5TurnPlayer(after), sourceInstanceId: u.instanceId }, "XG5-076", FANG, ids, true));
    }
  }
  return next;
});
CHOICE_RESOLVERS[FANG] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG5-076", `${FANG}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-076", `${FANG}:${instanceId}`) };
};
CHOICE_SKIPPERS[FANG] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-077 仮面ライダーキバーラ【ソニックスタッブ】
// 「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍バトルエリアから特徴「男」を持つユニットを1体選び持ち主のパワーゾーンに
//  ダメージにして置く。そうしたとき、相手は自分自身の捨札から特徴「男」を持つSユニットのカードを1枚選び自分自身のラッシュエリアに出す。」（atwiki/page-2266）。
// ホールドするかはこれを選ぶか見送るかで表す。相手が出すのは効果のラッシュ（必要パワー・追加条件を問わない）。

const SONIC = "xg5_077_sonic";
const SONIC_TARGET = "xg5_077_sonic_target";
const SONIC_RETURN = "xg5_077_sonic_return";
XG5_KEYWORDS["XG5-077::sonic_stab"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  const card = self ? findField(state, ctx.playerId, self) : undefined;
  if (!card || card.commandHeld || xg5TurnPlayer(state) !== ctx.playerId) return { state, detail: "xg5_077:no_effect" };
  // 「ホールドしてもよい」の確認（発動すればホールドする）。
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG5-077", SONIC)), detail: SONIC };
};
CHOICE_RESOLVERS[SONIC] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[SONIC] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = setFieldHeld(close(state, pending), playerId, pending.sourceInstanceId ?? "", true);
  const enemyId = opp(playerId);
  const ids = next.players[enemyId].battle.filter((c) => isUnit(next, c) && printedFeatures(next, c.cardId).includes("男") && selectableEnemy(next, playerId, "XG5-077", c)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG5-077", `${SONIC}:held`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-077", SONIC_TARGET, ids, false)), log };
};
CHOICE_SKIPPERS[SONIC] = simpleSkip();
CHOICE_RESOLVERS[SONIC_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  const next = moveFieldUnit(close(state, pending), enemyId, instanceId, pending.phasePlayerId, "power_damage");
  const log = logFor(state, playerId, "XG5-077", `${SONIC_TARGET}:${instanceId}`);
  if (zoneOfField(next, enemyId, instanceId)) return { state: proceed(next, pending), log };
  const ids = next.players[enemyId].discard.filter((c) => isSUnit(next, c) && printedFeatures(next, c.cardId).includes("男")).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne({ ...pendingBase(pending), playerId: enemyId }, "XG5-077", SONIC_RETURN, ids, false)), log };
};
CHOICE_RESOLVERS[SONIC_RETURN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const card = next.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (card) {
    next = patch(next, playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] }));
    const rushed = finalizeEffectRush(next, playerId, [instanceId], pending.phasePlayerId);
    next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-077", `${SONIC_RETURN}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-078 ファイナルフォームライド（オペレーション）
// 「自軍Sユニットを1体選び、自軍パワーゾーンのオモテ向きのカードからSユニットまたはSビークルのカードを1枚選ぶ。そうしたとき、選んだユニットとカードを置き換える。
//  ただし、必要パワーは満たすこと（追加条件は満たさなくてもよい）。このとき、出したユニットの効果は発動しない。」（atwiki/page-2179）。必要パワーは自軍パワーの数。

const FFR_UNIT = "xg5_078_ffr_unit";
const FFR_CARD = "xg5_078_ffr_card";
function ffrCards(state: GameState, playerId: PlayerId): string[] {
  const power = countAvailablePower(state, playerId);
  return state.players[playerId].power
    .filter((c) => {
      if (c.faceDown) return false;
      const d = defOf(state, c.cardId);
      return (d?.type === "unit" || d?.type === "vehicle") && sizeOf(state, c) === "S" && printedCostNumber(state, c.cardId) <= power;
    })
    .map((c) => c.instanceId);
}
XG5_KEYWORDS["XG5-078::final_form_ride"] = (state, ctx) => {
  const ids = fieldUnits(state, ctx.playerId).filter((c) => isSUnit(state, c)).map((c) => c.instanceId);
  if (ids.length === 0 || ffrCards(state, ctx.playerId).length === 0) return { state, detail: "xg5_078:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-078", FFR_UNIT, ids, false)), detail: FFR_UNIT };
};
CHOICE_RESOLVERS[FFR_UNIT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const ids = ffrCards(next, playerId);
  const log = logFor(state, playerId, "XG5-078", `${FFR_UNIT}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...selectOne(pendingBase(pending), "XG5-078", FFR_CARD, ids, false), xg5Meta: { target: instanceId } }), log };
};
CHOICE_RESOLVERS[FFR_CARD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = swapFieldWith(close(state, pending), playerId, pending.xg5Meta?.target ?? "", instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-078", `${FFR_CARD}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-079 仮面ライダーディケイド【ライダーカード】（RC）
// 「敵軍捨札から、ナンバーにＲＣを持つユニットカードを1枚選んでもよい。そうしたとき、選んだカードのRCの効果をこのユニットの効果として発動する。」（atwiki/page-2216）。
// 選んだカードは捨札に残る。そのカードの RC（DSL の riding_combo）の効果を、このユニットを発生源として処理する。

const RIDER_CARD = "xg5_079_rider_card";
XG5_KEYWORDS["XG5-079::rider_card"] = (state, ctx) => {
  const ids = state.players[opp(ctx.playerId)].discard.filter((c) => isUnit(state, c) && defOf(state, c.cardId)?.comboNumber === "RC").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_079:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-079", RIDER_CARD, ids, true)), detail: RIDER_CARD };
};
CHOICE_RESOLVERS[RIDER_CARD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const chosen = state.players[opp(playerId)].discard.find((c) => c.instanceId === instanceId)!;
  let next = close(state, pending);
  const log = logFor(state, playerId, "XG5-079", `${RIDER_CARD}:${instanceId}`);
  const self = pending.sourceInstanceId;
  const effects = listDslEffectsForTrigger(chosen.cardId, "riding_combo");
  const keywords = effects.flatMap((e) => e.effects.flatMap((p) => (p.type === "grant_keyword" && p.keyword.startsWith("xg5::") ? [p.keyword.slice(5)] : [])));
  if (keywords.length > 0) {
    for (const k of keywords) {
      const handler = XG5_KEYWORDS[k];
      if (!handler) continue;
      const ctx: GrantKeywordContext = { playerId, phasePlayerId: pending.phasePlayerId, sourceCardId: "XG5-079", effectId: RIDER_CARD, triggerSourceInstanceId: self };
      next = handler(next, ctx).state;
    }
    return { state: proceed(next, pending), log };
  }
  if (self) {
    const fired = tryResolveDslTriggeredEffects({ state: next, cardId: chosen.cardId, instanceId: self, playerId, phasePlayerId: pending.phasePlayerId, triggerType: "riding_combo", logAction: "named_effect" });
    next = { ...fired.state, log: [...fired.state.log, ...fired.logs] };
  }
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[RIDER_CARD] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-080 マシンディケイダー【アタックライド】
// 「これをラッシュしたとき、自軍パワーゾーンのオモテ向きのカードから、必要パワーを満たしているSビークルのカードを1枚選び、これと置き換えてもよい。
//  ただし、追加条件は満たすこと。」（atwiki/page-2217）。追加条件を持つビークルは選べない（ここでは追加条件を実行できない）。

const ATTACK_RIDE = "xg5_080_attack_ride";
XG5_KEYWORDS["XG5-080::attack_ride"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self || !findField(state, ctx.playerId, self)) return { state, detail: "xg5_080:no_source" };
  const power = countAvailablePower(state, ctx.playerId);
  const ids = state.players[ctx.playerId].power
    .filter((c) => !c.faceDown && defOf(state, c.cardId)?.type === "vehicle" && sizeOf(state, c) === "S" && !defOf(state, c.cardId)?.rushAdditionalCondition && printedCostNumber(state, c.cardId) <= power)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_080:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-080", ATTACK_RIDE, ids, true)), detail: ATTACK_RIDE };
};
CHOICE_RESOLVERS[ATTACK_RIDE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = swapFieldWith(close(state, pending), playerId, pending.sourceInstanceId ?? "", instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-080", `${ATTACK_RIDE}:${instanceId}`) };
};
CHOICE_SKIPPERS[ATTACK_RIDE] = simpleSkip();

// ---------------------------------------------------------------------------
// 継続効果・ほかの処理の場所から発動する効果（DSL からは何もしない）。
XG5_KEYWORDS["XG5-066::copy_vent"] = noop("xg5_066:copy_vent");
XG5_KEYWORDS["XG5-069::ambush"] = noop("xg5_069:ambush");
XG5_KEYWORDS["XG5-070::scout"] = noop("xg5_070:scout");
XG5_KEYWORDS["XG5-074::fangire_king"] = noop("xg5_074:fangire_king");
XG5_KEYWORDS["XG5-076::fang"] = noop("xg5_076:fang");

export type { BaseCtx };
