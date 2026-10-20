/**
 * クロスギャザー ザ・ジェットアクセル XG4-044〜XG4-063 のカード固有の効果（選択・誘発）。継続効果（BP・SP・アタックの制限）は rules/xg4/xg4Fields.ts。
 * 入口は rules/xg4/xg4Effects.ts。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, effectiveBp, effectiveCommandCategories, getDefinition } from "../../core/catalog";
import { opponent, performDeckDraws } from "../../core/helpers";
import { patchPlayer } from "../playerPatches";
import { applyDamageToPlayer } from "../damagePayment";
import { addBakiBakiExtraAttack } from "../turnModifierBridge";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  base,
  close,
  confirmChoice,
  ctxBase,
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
import { XG4_CONFIRMERS, XG4_KEYWORDS, XG4_RESOLVERS, XG4_SKIPPERS, addTurnRecord, hasTurnRecordFor, isCard, noop } from "./xg4Common";
import { XG4_PHOTON_RULE, XG4_RANDIC_RULE, XG4_STRAIGHT_RULE } from "./xg4Fields";
import { damagePick, registerDamagePick } from "./xg4bEffects";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";

function isUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function ownerOf(state: GameState, instanceId: string): PlayerId {
  return findField(state, "player1", instanceId) ? "player1" : "player2";
}

const COMMAND_LIMIT = 5;

// ---------------------------------------------------------------------------
// XG4-044 ゴセイブラック【ランディックアックス】（NC）
// 「このターン、これは、リリース状態の自軍コマンド1つにつきBP+1000される。」（atwiki/page-2096）。数はそのときのリリース状態のコマンド（xg4Fields）。

XG4_KEYWORDS["XG4-044::randic"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4044:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, XG4_RANDIC_RULE, "XG4-044", { instanceId: id }), detail: "xg4044:randic" };
};

// ---------------------------------------------------------------------------
// XG4-045 ゴセイピンク【スカイックショット】（NC）
// 「Sユニットを1体選び、持ち主の山札の上に戻す。」（atwiki/page-2050）。敵軍・自軍、エリアを問わない。いまのサイズ。任意ではない。

const SKYC_EFFECT_ID = "xg4045_skyc_shot";

XG4_KEYWORDS["XG4-045::skyc"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = [
    ...fieldUnits(state, ctx.playerId).filter((c) => rk1IsSmallNow(state, c)),
    ...fieldUnits(state, enemyId).filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG4-045", c)),
  ].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4045:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-045"), effectId: SKYC_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: SKYC_EFFECT_ID,
  };
};

XG4_RESOLVERS[SKYC_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = ownerOf(state, instanceId);
  // 山札の下に入れてから一番上に動かす（離場の処理は山札へ移ったものとして1回だけ通す）。
  let next = moveFieldUnit(close(state, pending), owner, instanceId, pending.phasePlayerId, "deck_bottom");
  next = patchPlayer(next, owner, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: [card, ...p.deck.filter((c) => c.instanceId !== instanceId)] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-045", `${SKYC_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[SKYC_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-046 腑破十臓【妖刀・裏正】
// 「これが敵軍ユニットをバトルで撃破した時、撃破したユニットのSPが1以上だったなら、相手に1点ダメージを与える。」（atwiki/page-2149）。
// SP は撃破したユニットの印刷の SP（数字）。※の2つは xg4Fields。

function yoto(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  const winner = findField(state, winnerId, winnerInstanceId);
  if (!winner || !isCard(winner.cardId, "XG4-046") || winnerId === defeatedOwnerId) return state;
  const p = state.players[defeatedOwnerId];
  const defeated = [...p.discard, ...p.power, ...p.command, ...p.hand, ...p.deck, ...p.battle, ...p.rush].find((c) => c.instanceId === defeatedInstanceId);
  const sp = defeated ? (getDefinition(state.definitions, defeated.cardId) as { sp?: unknown } | undefined)?.sp : undefined;
  if (typeof sp !== "number" || sp < 1) return state;
  return applyDamageToPlayer(state, defeatedOwnerId, 1, { kind: "none", activePlayer: state.activePlayer });
}

// ---------------------------------------------------------------------------
// XG4-047 シンケンレッド【車上の赤き侍】（NC）
// 「ライドしている敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-2108）。

const SHAJOU_EFFECT_ID = "xg4047_shajou";

XG4_KEYWORDS["XG4-047::shajou"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !!c.mountedOnInstanceId && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG4-047", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4047:no_targets" };
  return { state: openAfter(state, damagePick(ctxBase(ctx), "XG4-047", SHAJOU_EFFECT_ID, ids, true)), detail: SHAJOU_EFFECT_ID };
};
registerDamagePick(SHAJOU_EFFECT_ID, "XG4-047");

// ---------------------------------------------------------------------------
// XG4-050 ロボイザー【後部バルカン砲】
// 「ライドされているこのビークルが自軍バトルエリアからラッシュエリアに戻るとき、敵軍バトルエリアからBP3000のSユニットを1体選び、撃破してもよい。」
// （atwiki/page-2075）。戻ったかどうかは applyAction の前後で見る（XG4-027 と同じ）。BP はいまの BP。

const VULCAN_EFFECT_ID = "xg4050_vulcan";

function rearVulcan(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const wasInBattle = new Set(before.players[pid].battle.filter((c) => isSameVehicleTextIdentity(c.cardId, "XG4-050")).map((c) => c.instanceId));
    if (wasInBattle.size === 0) continue;
    for (const v of after.players[pid].rush) {
      if (!wasInBattle.has(v.instanceId)) continue;
      if (!after.players[pid].rush.some((c) => c.mountedOnInstanceId === v.instanceId)) continue;
      const enemyId = opponent(pid);
      const ids = next.players[enemyId].battle
        .filter((c) => isUnit(next, c.cardId) && rk1IsSmallNow(next, c) && effectiveBp(next, enemyId, c) === 3000 && selectableEnemy(next, pid, "XG4-050", c))
        .map((c) => c.instanceId);
      if (ids.length === 0) continue;
      next = openAfter(next, genericPick({ playerId: pid, phasePlayerId: after.activePlayer, sourceInstanceId: v.instanceId }, "XG4-050", VULCAN_EFFECT_ID, ids, true, "discard"));
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG4-051 マックジャバー【液化】「自軍ラッシュフェイズ中、このビークルを捨札にしてもよい。そうしたとき、自分は1枚ドローする。」（atwiki/page-2056）。
// 捨札にするのは起動のコスト（rules/fieldActivatedAbilities.ts）。

export function resolveXg4cDiscardSelfAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (isCard(card.cardId, "XG4-051")) return patchPlayer(state, playerId, (p) => performDeckDraws(p, 1, "top"));
  return state;
}

// ---------------------------------------------------------------------------
// XG4-052 仮面ライダークウガUF【空我】（NC）
// 「敵軍バトルエリアのユニットが1体だけなら、敵軍バトルエリアのユニットを持ち主のパワーゾーンにダメージにして置く。そうしたとき、これを捨札にする。」
// （atwiki/page-2148）。選ばない（対象をとらない）。

XG4_KEYWORDS["XG4-052::kuuga"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const units = state.players[enemyId].battle.filter((c) => isUnit(state, c.cardId));
  if (units.length !== 1) return { state, detail: `xg4052:count:${units.length}` };
  let next = moveFieldUnit(state, enemyId, units[0]!.instanceId, ctx.phasePlayerId, "power_damage");
  const self = ctx.triggerSourceInstanceId;
  if (self && findField(next, ctx.playerId, self)) next = moveFieldUnit(next, ctx.playerId, self, ctx.phasePlayerId, "discard");
  return { state: next, detail: "xg4052:kuuga" };
};

// ---------------------------------------------------------------------------
// XG4-053 仮面ライダーアギトSHF【AGITΩ】
// 「これが自分の手札にある間、敵軍ターン中、特徴「仮面ライダー」を持つ自軍ユニットがユニットでなくなり、自軍ユニットが1体もなくなったとき、
//  MAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、これを自軍ラッシュエリアに出す。その後、自分は1枚ドローする。」（atwiki/page-2111）。
// applyAction の前後で見る（自軍ユニットがいて、そのうち「仮面ライダー」がいなくなり、場のユニットが0体になった）。Q1: いなくなった
// 最後のユニットが「仮面ライダー」であること。

const AGITO_EFFECT_ID = "xg4053_agito";

function agito(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    if (after.activePlayer === pid) continue;
    const card = after.players[pid].hand.find((c) => isCard(c.cardId, "XG4-053"));
    if (!card) continue;
    const prevUnits = fieldUnits(before, pid).filter((c) => isUnit(before, c.cardId));
    if (prevUnits.length === 0 || fieldUnits(after, pid).some((c) => isUnit(after, c.cardId))) continue;
    if (!prevUnits.some((c) => unitFeatures(before, pid, c).includes("仮面ライダー"))) continue;
    const ids = after.players[pid].command
      .filter((c) => !c.commandHeld && (effectiveCommandCategories(after.players[pid], after.definitions, c.cardId) as string[]).includes("MA"))
      .map((c) => c.instanceId);
    if (ids.length === 0) continue;
    next = openAfter(next, { ...base({ playerId: pid, phasePlayerId: after.activePlayer, sourceInstanceId: card.instanceId }, "XG4-053"), effectId: AGITO_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true });
  }
  return next;
}

XG4_RESOLVERS[AGITO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
  const card = next.players[playerId].hand.find((c) => c.instanceId === pending.sourceInstanceId);
  if (card) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== card.instanceId), rush: [...p.rush, stripForZone(card)] }));
    next = patchPlayer(next, playerId, (p) => performDeckDraws(p, 1, "top"));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-053", `${AGITO_EFFECT_ID}:${card ? "rushed" : "missing"}`) };
};
XG4_SKIPPERS[AGITO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-054 仮面ライダーブレイドKF【ストレートフラッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍捨札を5枚選びゲームから除外してもよい。そうしたとき、本来のBPが6000以下の敵軍ユニットを1体選び
//  撃破する。その後、除外したカードのカテゴリがすべて同じなら、このターン、これは「SP1」になる。」（atwiki/page-2134）。
// 捨札を1枚ずつ選び、5枚目で除外する（見送れば何もしない）。敵軍ユニットはエリアを問わない。

const STRAIGHT_EXILE_EFFECT_ID = "xg4054_straight_exile";
const STRAIGHT_DESTROY_EFFECT_ID = "xg4054_straight_destroy";
const STRAIGHT_COUNT = 5;

XG4_KEYWORDS["XG4-054::straight"] = (state, ctx) => {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "xg4054:not_own_turn" };
  const ids = state.players[ctx.playerId].discard.map((c) => c.instanceId);
  if (ids.length < STRAIGHT_COUNT) return { state, detail: "xg4054:short" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-054"), effectId: STRAIGHT_EXILE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: STRAIGHT_COUNT, selectedInstanceIds: [], optional: true }),
    detail: STRAIGHT_EXILE_EFFECT_ID,
  };
};

function categoryKey(state: GameState, cardId: string): string {
  const def = getDefinition(state.definitions, cardId);
  return def ? [...(cardCategories(def) as string[])].sort().join("+") : "";
}

function straightFinish(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  let next = close(state, pending);
  const exiled = next.players[playerId].discard.filter((c) => selected.includes(c.instanceId));
  next = patchPlayer(next, playerId, (p) => ({ ...p, discard: p.discard.filter((c) => !selected.includes(c.instanceId)), exile: [...(p.exile ?? []), ...exiled.map(stripForZone)] }));
  const keys = new Set(exiled.map((c) => categoryKey(next, c.cardId)));
  if (keys.size === 1 && pending.sourceInstanceId) next = addTurnRecord(next, playerId, XG4_STRAIGHT_RULE, "XG4-054", { instanceId: pending.sourceInstanceId });
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => {
      const bp = (getDefinition(next.definitions, c.cardId) as { bp?: unknown } | undefined)?.bp;
      return isUnit(next, c.cardId) && typeof bp === "number" && bp <= 6000 && selectableEnemy(next, playerId, "XG4-054", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return proceed(next, pending);
  return openNext(next, pending, genericPick(pendingBase(pending), "XG4-054", STRAIGHT_DESTROY_EFFECT_ID, ids, false, "discard"));
}

XG4_RESOLVERS[STRAIGHT_EXILE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG4-054", `${STRAIGHT_EXILE_EFFECT_ID}:${instanceId}`);
  if (selected.length >= STRAIGHT_COUNT) return { state: straightFinish(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) } }, log };
};
XG4_SKIPPERS[STRAIGHT_EXILE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-057 仮面ライダー龍騎サバイブ【叶えたい願い】（RC）
// 「上にカードが重なっている常駐オペレーションをすべて捨札にしてもよい。そうしたとき、ウラ向きの自軍パワーを1枚選び捨札にしてもよい。」（atwiki/page-2135）。
// 常駐オペレーションは自軍・敵軍（カード評価）。重なっているカードも持ち主の捨札へ。ライドオフしたとき（applyXg4cRideOff）。

const NEGAI_EFFECT_ID = "xg4057_negai";
const NEGAI_POWER_EFFECT_ID = "xg4057_negai_power";

function stackedResidents(state: GameState, pid: PlayerId): CardInstance[] {
  return (state.players[pid].operation ?? []).filter((c) => (c.stackedCards ?? []).length > 0);
}

XG4_RESOLVERS[NEGAI_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[NEGAI_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[NEGAI_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    const targets = stackedResidents(next, pid);
    if (targets.length === 0) continue;
    count += targets.length;
    const ids = new Set(targets.map((c) => c.instanceId));
    next = patchPlayer(next, pid, (p) => ({
      ...p,
      operation: (p.operation ?? []).filter((c) => !ids.has(c.instanceId)),
      discard: [...p.discard, ...targets.flatMap((c) => [stripForZone(c), ...(c.stackedCards ?? []).map(stripForZone)])],
    }));
  }
  const log = logFor(state, playerId, "XG4-057", `${NEGAI_EFFECT_ID}:${count}`);
  const powerIds = next.players[playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (count === 0 || powerIds.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-057"), effectId: NEGAI_POWER_EFFECT_ID, kind: "select_power", validInstanceIds: powerIds, selectCount: 1, optional: true }),
    log,
  };
};

XG4_RESOLVERS[NEGAI_POWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.power.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)], damage: card.faceDown ? Math.max(0, p.damage - 1) : p.damage };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-057", `${NEGAI_POWER_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[NEGAI_POWER_EFFECT_ID] = simpleSkip();

export function applyXg4cRideOff(state: GameState, playerId: PlayerId, rider: CardInstance): GameState {
  if (isCard(rider.cardId, "XG4-057")) {
    return openAfter(state, confirmChoice({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: rider.instanceId }, "XG4-057", NEGAI_EFFECT_ID));
  }
  // XG4-060【フォトンブレイカー】は RC（ライドオフしたこのターン）。
  if (isCard(rider.cardId, "XG4-060")) return addTurnRecord(state, playerId, XG4_PHOTON_RULE, "XG4-060", { instanceId: rider.instanceId });
  return state;
}

// ---------------------------------------------------------------------------
// XG4-059 オートバジンVM【自律変形】
// 「敵軍バトルフェイズ開始時、このビークルを自軍コマンドゾーンに送ってもよい。そうしたとき、自軍コマンドゾーンから「オートバジンBM」のカードを1枚選び、
//  自軍バトルエリアの最後に出す。」（atwiki/page-2085）。Q1: 自軍コマンドゾーンが5枚なら送れないので処理は中断（BM は出ない）。
// 送ったこれはリリース状態。BM の「※自軍コマンドを1つホールドしなければバトルエリアに出られない」は、出す BM 自身のホールドで満たす（ほかのコマンドは
// ホールドしない）。

const AUTOVAJIN_EFFECT_ID = "xg4059_autovajin";
const AUTOVAJIN_BM_EFFECT_ID = "xg4059_autovajin_bm";

/** 敵軍バトルフェイズ開始時（core/applyAction.ts end_phase。activePlayerId はバトルフェイズを始めたプレイヤー）。 */
export function openXg4cBattlePhaseStart(state: GameState, activePlayerId: PlayerId): GameState {
  let next = state;
  const pid = opponent(activePlayerId);
  for (const v of fieldCards(state, pid).filter((c) => isCard(c.cardId, "XG4-059"))) {
    next = openAfter(next, confirmChoice({ playerId: pid, phasePlayerId: activePlayerId, sourceInstanceId: v.instanceId }, "XG4-059", AUTOVAJIN_EFFECT_ID));
  }
  return next;
}

XG4_RESOLVERS[AUTOVAJIN_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[AUTOVAJIN_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[AUTOVAJIN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const id = pending.sourceInstanceId;
  const vm = id ? findField(next, playerId, id) : undefined;
  if (!vm || next.players[playerId].command.length >= COMMAND_LIMIT) {
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-059", `${AUTOVAJIN_EFFECT_ID}:interrupted`) };
  }
  next = patchPlayer(next, playerId, (p) => {
    const unmount = (c: CardInstance) => (c.mountedOnInstanceId === id ? { ...c, mountedOnInstanceId: undefined } : c);
    return {
      ...p,
      rush: p.rush.filter((c) => c.instanceId !== id).map(unmount),
      battle: p.battle.filter((c) => c.instanceId !== id).map(unmount),
      command: [...p.command, { ...stripForZone(vm), commandHeld: false }],
    };
  });
  const log = logFor(state, playerId, "XG4-059", `${AUTOVAJIN_EFFECT_ID}:sent`);
  const ids = next.players[playerId].command.filter((c) => isCard(c.cardId, "XG4-058")).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-059"), effectId: AUTOVAJIN_BM_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: false }),
    log,
  };
};

XG4_RESOLVERS[AUTOVAJIN_BM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const { commandHeld: _h, ...rest } = stripForZone(card);
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), battle: [...p.battle, rest as CardInstance] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-059", `${AUTOVAJIN_BM_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[AUTOVAJIN_BM_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-060 仮面ライダーファイズBF【フォトンブレイカー】
// 「これがBPの下三桁が500のユニットにアタックしてバトルに勝ったとき、追加でアタックしてもよい。（この効果はこれがウイングでアタックするときは
//  ナンバーに関係なく発動する）」（atwiki/page-2115）。CN は RC（ライドオフしたターン。applyXg4cRideOff）。ウイングでラッシュエリアから
// アタックしたときも。BP はバトルのときの BP。追加のアタックは RS-167 と同じ記録。

/** アタックしてバトルに勝ったとき（rules/operationCounters.ts）。defenderBp はバトルのときの BP。 */
export function xg4cOnAttackWin(state: GameState, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId">, defenderBp: number): GameState {
  const pid = pending.attackerPlayerId;
  const attacker = findField(state, pid, pending.attackerInstanceId);
  if (!attacker || !isCard(attacker.cardId, "XG4-060")) return state;
  const wing = state.players[pid].rush.some((c) => c.instanceId === attacker.instanceId);
  if (!wing && !hasTurnRecordFor(state, pid, XG4_PHOTON_RULE, attacker.instanceId)) return state;
  if (defenderBp % 1000 !== 500) return state;
  return patchPlayer(state, pid, (p) => addBakiBakiExtraAttack(p, attacker.instanceId));
}

// ---------------------------------------------------------------------------
// XG4-061 仮面ライダーアクセル【エンジンブレード】（ラッシュしたとき）
// 「特徴「加速」を持たない敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-2138）。
// エリアを問わない。いまの特徴・サイズ。任意ではない。

const ENGINE_EFFECT_ID = "xg4061_engine_blade";

XG4_KEYWORDS["XG4-061::engine"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnit(state, c.cardId) && rk1IsSmallNow(state, c) && !unitFeatures(state, enemyId, c).includes("加速") && selectableEnemy(state, ctx.playerId, "XG4-061", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4061:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-061"), effectId: ENGINE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: ENGINE_EFFECT_ID,
  };
};

XG4_RESOLVERS[ENGINE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = ownerOf(state, instanceId);
  const full = state.players[owner].command.length >= COMMAND_LIMIT;
  const next = moveFieldUnit(close(state, pending), owner, instanceId, pending.phasePlayerId, full ? "discard" : "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-061", `${ENGINE_EFFECT_ID}:${instanceId}:${full ? "discard" : "command"}`) };
};
XG4_SKIPPERS[ENGINE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// 継続効果だけ・ほかで処理するカードの DSL キーワード。

XG4_KEYWORDS["XG4-046::yoto"] = noop("xg4046:yoto");
XG4_KEYWORDS["XG4-050::vulcan"] = noop("xg4050:vulcan");
XG4_KEYWORDS["XG4-051::ekika"] = noop("xg4051:ekika");
XG4_KEYWORDS["XG4-053::agito"] = noop("xg4053:agito");
XG4_KEYWORDS["XG4-057::negai"] = noop("xg4057:negai");
XG4_KEYWORDS["XG4-058::aiki"] = noop("xg4058:aiki");
XG4_KEYWORDS["XG4-059::jiritsu"] = noop("xg4059:jiritsu");
XG4_KEYWORDS["XG4-063::tsumi"] = noop("xg4063:tsumi");
XG4_KEYWORDS["XG4-060::photon"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4060:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, XG4_PHOTON_RULE, "XG4-060", { instanceId: id }), detail: "xg4060:photon" };
};

// ---------------------------------------------------------------------------
// 入口（rules/xg4/xg4Effects.ts）。

export function applyXg4cAfterAction(before: GameState, after: GameState): GameState {
  return agito(before, rearVulcan(before, after));
}

export function xg4cOnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  return yoto(state, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
}
