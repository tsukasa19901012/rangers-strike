/**
 * クロスギャザー ザ・ジェットアクセル XG4-084〜XG4-102 のカード固有の効果（選択・誘発・起動）。継続効果（BP・SP・アタックの制限・レジスト）は
 * rules/xg4/xg4Fields.ts。入口は rules/xg4/xg4Effects.ts。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { patchPlayer, grantSp1OnPlayer } from "../playerPatches";
import { openEffectChoice } from "../pendingChoices";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { applyDamageToPlayer } from "../damagePayment";
import {
  base,
  close,
  ctxBase,
  destroyAll,
  fieldCards,
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
import { xg4FlankedByWomen } from "./xg4Fields";
import { XG4_CONFIRMERS, XG4_KEYWORDS, XG4_RESOLVERS, XG4_SKIPPERS, isCard, noop } from "./xg4Common";

const COMMAND_LIMIT = 5;

function isUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function printedCats(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const def = getDefinition(state.definitions, cardId);
  return def ? (cardCategories(def) as string[]) : [];
}

function printedBp(state: Pick<GameState, "definitions">, cardId: string): number {
  const bp = getDefinition(state.definitions, cardId)?.bp;
  return typeof bp === "number" ? bp : Number.NaN;
}

function ownTurn(ctx: { playerId: PlayerId; phasePlayerId: PlayerId }): boolean {
  return ctx.playerId === ctx.phasePlayerId;
}

// ---------------------------------------------------------------------------
// XG4-084 仮面ライダー幽汽HF【乱れ独楽】
// 「これが自軍ラッシュエリアにある間、自軍エンドフェイズ中、次の効果を好きなだけ発動できる⇒自分の手札を1枚選び捨札にする。そうしたとき、
//  敵軍バトルエリアからSユニットを1体選び撃破する。」（atwiki/page-2150）。
// エンドフェイズの効果の一覧（rules/legend3/endTurnEffects.ts）がほかに何もなくなったときに、手札の選択（任意）を開く。撃破のあと、続けられれば
// もう一度開く（見送れば終わり）。敵軍バトルエリアに S ユニットがいなければ開かない。※（ホールドされたターンにしか出られない）は xg4Fields。

const MIDARE_HAND_EFFECT_ID = "xg4084_midare_hand";
const MIDARE_DESTROY_EFFECT_ID = "xg4084_midare_destroy";

function midareTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => isUnit(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "XG4-084", c))
    .map((c) => c.instanceId);
}

/** 自軍エンドフェイズの効果（rules/legend3/endTurnEffects.ts tryOpenEndTurnEffectsMenu）。開かなければ null。 */
export function openXg4eEndPhaseChoice(state: GameState, playerId: PlayerId): GameState | null {
  if (state.phase !== "end" || state.pendingEffectChoice) return null;
  const self = state.players[playerId].rush.find((c) => isCard(c.cardId, "XG4-084"));
  if (!self) return null;
  const hand = state.players[playerId].hand.map((c) => c.instanceId);
  if (hand.length === 0 || midareTargets(state, playerId).length === 0) return null;
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: self.instanceId }, "XG4-084"),
    effectId: MIDARE_HAND_EFFECT_ID,
    kind: "select_hand",
    validInstanceIds: hand,
    selectCount: 1,
    optional: true,
  });
}

XG4_RESOLVERS[MIDARE_HAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    return card ? { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] } : p;
  });
  const log = logFor(state, playerId, "XG4-084", `${MIDARE_HAND_EFFECT_ID}:${instanceId}`);
  const ids = midareTargets(next, playerId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick(pendingBase(pending), "XG4-084", MIDARE_DESTROY_EFFECT_ID, ids, false, "discard")), log };
};
XG4_SKIPPERS[MIDARE_HAND_EFFECT_ID] = simpleSkip();

/** 【乱れ独楽】の撃破を終えたあと、続けられればもう一度開く（core/applyAction.ts の後処理から呼ばれる applyXg4eAfterAction）。 */
function midareRepeat(before: GameState, after: GameState): GameState {
  const prev = before.pendingEffectChoice;
  if (!prev || prev.effectId !== MIDARE_DESTROY_EFFECT_ID) return after;
  if (after.pendingEffectChoice || after.pendingLeave || after.pendingRegister) return after;
  return openXg4eEndPhaseChoice(after, prev.playerId) ?? after;
}

// ---------------------------------------------------------------------------
// XG4-085 仮面ライダー幽汽SF【ターミネイトフラッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからホールド状態の敵軍Sユニットを自軍ダメージの数まで選び、撃破する。」
// （atwiki/page-2151）。「まで」なので選ばなくてもよい（1体目を選んだら確定できる）。自軍ダメージが0なら開かない。
// ※（「男」の自軍ユニットを代わりに捨札にする）は rules/rk/rk7UnitEffects.ts の RK-128・RK-286 と同じ手続き。

const TERMINATE_EFFECT_ID = "xg4085_terminate";

function terminateFinish(state: GameState, pending: PendingEffectChoice, selected: string[]): GameState {
  const next = close(state, pending);
  if (selected.length === 0) return proceed(next, pending);
  return proceed(destroyAll(next, pendingBase(pending), "XG4-085", `${TERMINATE_EFFECT_ID}_destroy`, selected), pending);
}

XG4_KEYWORDS["XG4-085::terminate"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg4085:not_own_turn" };
  const damage = state.players[ctx.playerId].damage;
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnit(state, c.cardId) && c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG4-085", c))
    .map((c) => c.instanceId);
  if (damage <= 0 || ids.length === 0) return { state, detail: "xg4085:none" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-085"), effectId: TERMINATE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: Math.min(damage, ids.length), selectedInstanceIds: [], optional: true, xg4Meta: { limit: damage } }),
    detail: TERMINATE_EFFECT_ID,
  };
};

XG4_RESOLVERS[TERMINATE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
  const limit = Number(pending.xg4Meta?.limit ?? 0);
  const log = logFor(state, playerId, "XG4-085", `${TERMINATE_EFFECT_ID}:${instanceId}`);
  if (selected.length >= limit || rest.length === 0) return { state: terminateFinish(state, pending, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log };
};
XG4_SKIPPERS[TERMINATE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: terminateFinish(state, pending, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "XG4-085", `${TERMINATE_EFFECT_ID}:skip`) };
};
XG4_CONFIRMERS[TERMINATE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: terminateFinish(state, pending, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "XG4-085", `${TERMINATE_EFFECT_ID}:confirm`) };
};

// ---------------------------------------------------------------------------
// XG4-086 仮面ライダーイクサBM【イクサカリバー・ガンモード】（RC）
// 「ウイングを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-2064）。エリアを問わない。任意ではない。

const IXA_EFFECT_ID = "xg4086_ixa_gun";

XG4_KEYWORDS["XG4-086::ixa"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnit(state, c.cardId) && rk1IsSmallNow(state, c) && cardHasKeyword(state.definitions, c.cardId, "wing", { state, playerId: enemyId }) && selectableEnemy(state, ctx.playerId, "XG4-086", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4086:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "XG4-086", IXA_EFFECT_ID, ids, false, "discard")), detail: IXA_EFFECT_ID };
};

// ---------------------------------------------------------------------------
// XG4-089 仮面ライダーW・JJ【切札の左半身】（JC: R）
// 「これがSユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたユニットよりもBPの低い敵軍ユニットを1体選び、撃破する。
//  また、自軍バトルエリアに「仮面ライダーW・CC」があれば、これは「SP1」になる。」（atwiki/page-2101）。
// DSL の joint_combo_r（rules/jointComboProcedure.ts）。コンビネーションしたユニットは左隣。BP はいまの BP。敵軍ユニットはエリア・サイズを問わない。
// 撃破を選んだとき（発動したとき）、W・CC があればこのターン SP1（バトルエリアにいる間）。

const KIRIFUDA_EFFECT_ID = "xg4089_kirifuda";

XG4_KEYWORDS["XG4-089::kirifuda"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4089:no_source" };
  const battle = state.players[ctx.playerId].battle;
  const idx = battle.findIndex((c) => c.instanceId === id);
  const partner = idx > 0 ? battle[idx - 1] : undefined;
  if (!partner || !rk1IsSmallNow(state, partner)) return { state, detail: "xg4089:no_partner" };
  const limit = effectiveBp(state, ctx.playerId, partner);
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnit(state, c.cardId) && effectiveBp(state, enemyId, c) < limit && selectableEnemy(state, ctx.playerId, "XG4-089", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4089:no_targets" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-089"), effectId: KIRIFUDA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }), detail: KIRIFUDA_EFFECT_ID };
};

XG4_RESOLVERS[KIRIFUDA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const selfId = pending.sourceInstanceId;
  if (selfId && next.players[playerId].battle.some((c) => isCard(c.cardId, "XG4-088"))) {
    next = patchPlayer(next, playerId, (p) => grantSp1OnPlayer(p, selfId, next.definitions));
  }
  next = destroyAll(next, pendingBase(pending), "XG4-089", `${KIRIFUDA_EFFECT_ID}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-089", `${KIRIFUDA_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[KIRIFUDA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-091 ガンギブソン【スピンドルキャノン】（起動。rules/fieldActivatedAbilities.ts）
// 「これをホールドすれば、次の効果を発動できる⇒相手は自分自身のユニットを1体選び、可能なら自軍コマンドゾーンにホールド状態で置く。」
// （atwiki/page-2118）。リリース状態のこれ（自軍ラッシュエリア・バトルエリア）。相手のユニットはエリア・サイズを問わない（カード評価）。
// 相手のコマンドゾーンが5枚なら置けない（選んだユニットはそのまま）。

const SPINDLE_EFFECT_ID = "xg4091_spindle";

export function isXg4eFieldAbilityCard(cardId: string): boolean {
  return isCard(cardId, "XG4-091");
}

export function canActivateXg4eFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (state.activePlayer !== playerId || state.pendingEffectChoice) return false;
  const self = findField(state, playerId, card.instanceId);
  return !!self && !self.commandHeld;
}

export function activateXg4eFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  let next = patchPlayer(state, playerId, (p) => {
    const hold = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === card.instanceId ? { ...c, commandHeld: true } : c));
    return { ...p, rush: hold(p.rush), battle: hold(p.battle) };
  });
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => isUnit(next, c.cardId)).map((c) => c.instanceId);
  next = { ...next, log: [...next.log, logFor(state, playerId, "XG4-091", `${SPINDLE_EFFECT_ID}:hold`)] };
  if (ids.length === 0) return next;
  return openEffectChoice(next, {
    ...base({ playerId: enemyId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG4-091"),
    effectId: SPINDLE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

XG4_RESOLVERS[SPINDLE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (next.players[playerId].command.length < COMMAND_LIMIT) next = moveFieldUnit(next, playerId, instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-091", `${SPINDLE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-093 ビルゴルディ【BILLGOLDY FOR EVIL】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍ゾーンのオモテ向きのカードがすべてDAを持つなら、本来のBPが5000以下の敵軍ユニットを1体選び
//  撃破する。」（atwiki/page-2152）。自軍ゾーンはパワーゾーンとコマンドゾーン（オモテ向きのカード。印刷のカテゴリ）。敵軍ユニットはエリア・サイズを
// 問わない（カード評価）。任意ではない。

const BILLGOLDY_EFFECT_ID = "xg4093_billgoldy";

XG4_KEYWORDS["XG4-093::billgoldy"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg4093:not_own_turn" };
  const p = state.players[ctx.playerId];
  const faceUp = [...p.power.filter((c) => !c.faceDown), ...p.command];
  if (!faceUp.every((c) => printedCats(state, c.cardId).includes("DA"))) return { state, detail: "xg4093:not_all_da" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnit(state, c.cardId) && printedBp(state, c.cardId) <= 5000 && selectableEnemy(state, ctx.playerId, "XG4-093", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4093:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "XG4-093", BILLGOLDY_EFFECT_ID, ids, false, "discard")), detail: BILLGOLDY_EFFECT_ID };
};

// ---------------------------------------------------------------------------
// XG4-094 宇宙刑事シャイダー【ビデオビームガン】（RC）
// 「敵軍コマンドを1つ選びリリースしてもよい。そうしたとき、リリースしたカードと同じカテゴリを持つ敵軍Sユニットを1体選び撃破する。」
// （atwiki/page-2144）。選べるのはホールド状態の敵軍コマンド。カテゴリは印刷のカテゴリ（1つでも同じなら）。ユニットはエリアを問わない。

const VIDEO_EFFECT_ID = "xg4094_video_beam";
const VIDEO_DESTROY_EFFECT_ID = "xg4094_video_beam_destroy";

XG4_KEYWORDS["XG4-094::video"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4094:no_held_commands" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-094"), effectId: VIDEO_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true }), detail: VIDEO_EFFECT_ID };
};

XG4_RESOLVERS[VIDEO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const cmd = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  const cats = cmd ? printedCats(state, cmd.cardId) : [];
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)) }));
  const log = logFor(state, playerId, "XG4-094", `${VIDEO_EFFECT_ID}:${instanceId}`);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => isUnit(next, c.cardId) && rk1IsSmallNow(next, c) && printedCats(next, c.cardId).some((x) => cats.includes(x)) && selectableEnemy(next, playerId, "XG4-094", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick(pendingBase(pending), "XG4-094", VIDEO_DESTROY_EFFECT_ID, ids, false, "discard")), log };
};
XG4_SKIPPERS[VIDEO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-095 バビロスSF【ビッグマグナム】
// 「これが自軍エリアにある間、特徴「宇宙刑事」を持つ自軍ユニットがバトルエリアに出たとき、これをホールドして次の効果を発動できる⇒敵軍バトルエリア
//  から、BP8000以下のユニットを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-2121）。applyAction の前後で見る（自軍バトルエリアに新しく
// 入った「宇宙刑事」のユニット）。リリース状態のこれだけ。選んだらこれをホールドする。BP はいまの BP。

const MAGNUM_EFFECT_ID = "xg4095_big_magnum";

function bigMagnum(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const prev = new Set(before.players[pid].battle.map((c) => c.instanceId));
    const entered = after.players[pid].battle.filter((c) => !prev.has(c.instanceId) && isUnit(after, c.cardId) && unitFeatures(after, pid, c).includes("宇宙刑事"));
    if (entered.length === 0) continue;
    for (const sf of fieldCards(after, pid).filter((c) => isCard(c.cardId, "XG4-095") && !c.commandHeld)) {
      const enemyId = opponent(pid);
      const ids = next.players[enemyId].battle
        .filter((c) => isUnit(next, c.cardId) && effectiveBp(next, enemyId, c) <= 8000 && selectableEnemy(next, pid, "XG4-095", c))
        .map((c) => c.instanceId);
      if (ids.length === 0) continue;
      next = openAfter(next, { ...base({ playerId: pid, phasePlayerId: after.activePlayer, sourceInstanceId: sf.instanceId }, "XG4-095"), effectId: MAGNUM_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
    }
  }
  return next;
}

XG4_RESOLVERS[MAGNUM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const sfId = pending.sourceInstanceId;
  const sf = sfId ? findField(state, playerId, sfId) : undefined;
  if (!sf || sf.commandHeld) return { state: proceed(close(state, pending), pending), log: logFor(state, playerId, "XG4-095", `${MAGNUM_EFFECT_ID}:cannot_hold`) };
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const hold = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === sfId ? { ...c, commandHeld: true } : c));
    return { ...p, rush: hold(p.rush), battle: hold(p.battle) };
  });
  next = moveFieldUnit(next, opponent(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-095", `${MAGNUM_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[MAGNUM_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-096 バビロスBF【バビロスファイヤー】（ラッシュしたとき）
// 「敵軍パワーゾーンからカードを1枚選び捨札にしてもよい。そうしたとき、敵軍捨札からカードを1枚選び敵軍パワーゾーンにオモテ向きで置く。」
// （atwiki/page-2122）。ウラ向き（ダメージ）のカードを捨札にしたらダメージは1点減る。

const FIRE_EFFECT_ID = "xg4096_babylos_fire";
const FIRE_PLACE_EFFECT_ID = "xg4096_babylos_fire_place";

XG4_KEYWORDS["XG4-096::fire"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].power.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4096:no_power" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-096"), effectId: FIRE_EFFECT_ID, kind: "select_power", validInstanceIds: ids, selectCount: 1, optional: true }), detail: FIRE_EFFECT_ID };
};

XG4_RESOLVERS[FIRE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.power.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)], damage: card.faceDown ? Math.max(0, p.damage - 1) : p.damage };
  });
  const log = logFor(state, playerId, "XG4-096", `${FIRE_EFFECT_ID}:${instanceId}`);
  const ids = next.players[enemyId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-096"), effectId: FIRE_PLACE_EFFECT_ID, kind: "pick_effect_branch", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
XG4_SKIPPERS[FIRE_EFFECT_ID] = simpleSkip();

XG4_RESOLVERS[FIRE_PLACE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), opponent(playerId), (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    return card ? { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), power: [...p.power, { ...stripForZone(card), faceDown: false }] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-096", `${FIRE_PLACE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-098 スピルバン【トリプルボンバー】（両隣に「女」の自軍ユニットが並んでいる間。BP は xg4Fields）
// 「…次の能力を得る⇒自分がターンを終えるとき、このユニットのBP以下のBPを持つ敵軍ユニットを1体選び持ち主のパワーゾーンに送る。」
// （atwiki/page-2119）。ターンを終えるとき（rules/turnEndingEffects.ts の xg4 の列）。敵軍ユニットはエリアを問わない。任意ではない。

const BOMBER_EFFECT_ID = "xg4098_triple_bomber";

export function collectXg4eTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return state.players[endingPlayerId].battle
    .filter((c) => isCard(c.cardId, "XG4-098") && xg4FlankedByWomen(state, endingPlayerId, c.instanceId))
    .map((c) => `spielban:${c.instanceId}`);
}

export function openXg4eTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  if (kind !== "spielban") return state;
  const self = state.players[endingPlayerId].battle.find((c) => c.instanceId === instanceId);
  if (!self || !xg4FlankedByWomen(state, endingPlayerId, instanceId)) return state;
  const limit = effectiveBp(state, endingPlayerId, self);
  const enemyId = opponent(endingPlayerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnit(state, c.cardId) && effectiveBp(state, enemyId, c) <= limit && selectableEnemy(state, endingPlayerId, "XG4-098", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, genericPick({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, "XG4-098", BOMBER_EFFECT_ID, ids, false, "power"));
}

// ---------------------------------------------------------------------------
// 入口（rules/xg4/xg4Effects.ts）。

export function applyXg4eAfterAction(before: GameState, after: GameState): GameState {
  return bigMagnum(before, midareRepeat(before, after));
}

/** XG4-092【JANPERSON FOR JUSTICE】「これがカテゴリにDAを持つユニットをバトルで撃破したとき、相手に1点ダメージを与える。」（撃破したユニットの印刷のカテゴリ）。 */
export function xg4eOnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  if (winnerId === defeatedOwnerId) return state;
  const winner = findField(state, winnerId, winnerInstanceId);
  if (!winner || !isCard(winner.cardId, "XG4-092")) return state;
  const p = state.players[defeatedOwnerId];
  const defeated = [...p.discard, ...p.power, ...p.command, ...p.hand, ...p.deck, ...p.battle, ...p.rush].find((c) => c.instanceId === defeatedInstanceId);
  if (!defeated || !printedCats(state, defeated.cardId).includes("DA")) return state;
  return applyDamage(state, defeatedOwnerId);
}

function applyDamage(state: GameState, pid: PlayerId): GameState {
  return applyDamageToPlayer(state, pid, 1, { kind: "none", activePlayer: state.activePlayer });
}

// ---------------------------------------------------------------------------
// 継続効果だけ・ほかで処理するカードの DSL キーワード。

XG4_KEYWORDS["XG4-084::midare"] = noop("xg4084:end_phase");
XG4_KEYWORDS["XG4-085::note"] = noop("xg4085:substitute");
XG4_KEYWORDS["XG4-087::skykick"] = noop("xg4087:skykick");
XG4_KEYWORDS["XG4-091::spindle"] = noop("xg4091:activated");
XG4_KEYWORDS["XG4-092::justice"] = noop("xg4092:justice");
XG4_KEYWORDS["XG4-092::note"] = noop("xg4092:note");
XG4_KEYWORDS["XG4-095::magnum"] = noop("xg4095:magnum");
XG4_KEYWORDS["XG4-097::helen"] = noop("xg4097:helen");
XG4_KEYWORDS["XG4-098::bomber"] = noop("xg4098:bomber");
XG4_KEYWORDS["XG4-099::barrier"] = noop("xg4099:barrier");
