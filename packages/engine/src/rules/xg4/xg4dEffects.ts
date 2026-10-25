/**
 * クロスギャザー ザ・ジェットアクセル XG4-064〜XG4-083 のカード固有の効果（選択・誘発）。継続効果（BP・ウイング・必要パワー）は rules/xg4/xg4Fields.ts。
 * 入口は rules/xg4/xg4Effects.ts。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingStrike, PlayerId } from "../../types/game";
import { cardCategories, getDefinition, parsePowerCost } from "../../core/catalog";
import { countAvailablePower, opponent } from "../../core/helpers";
import { shuffleCards } from "../../core/deckShuffle";
import { patchPlayer } from "../playerPatches";
import { applyDamageToPlayer } from "../damagePayment";
import { applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { bounceToHandAuto } from "../bounce";
import { holdFieldUnit } from "../errataCardEffects";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rm1CostNumber } from "../rm/rm1Fields";
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
  selectableOwnByEnemyEffect,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";
import { XG4_CONFIRMERS, XG4_KEYWORDS, XG4_RESOLVERS, XG4_SKIPPERS, addTurnRecord, allFieldUnits, hasTurnRecordFor, isCard, noop, printedFeatures } from "./xg4Common";
import { XG4_ATTACKRIDE_RULE, XG4_HARDSHOT_RULE, XG4_LIGHTNING_RULE, XG4_RIDOL_RULE } from "./xg4Fields";

const COMMAND_LIMIT = 5;

function isUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function ownTurn(ctx: { playerId: PlayerId; phasePlayerId: PlayerId }): boolean {
  return ctx.playerId === ctx.phasePlayerId;
}

/** 場のカードを持ち主の山札の一番上に移す（下に入れてから一番上に動かす。離場の処理は1回）。 */
function toDeckTop(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const next = moveFieldUnit(state, ownerId, instanceId, phasePlayerId, "deck_bottom");
  return patchPlayer(next, ownerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: [card, ...p.deck.filter((c) => c.instanceId !== instanceId)] } : p;
  });
}

// ---------------------------------------------------------------------------
// XG4-064 リボルギャリー【リボルバーハンガー】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍コマンドゾーンから、カテゴリを2つ以上持つビークルカードを1枚選び、
//  カテゴリを2つ以上持つ自軍ビークル1体と置き換える。ただし、必要パワーと追加条件は満たすこと。」（atwiki/page-2116）。
// 必要パワーは自軍パワーゾーンの枚数で見る。追加条件を持つビークルは（満たすかを判定できないので）候補にしない。置き換えは場所を入れ替えるだけ
// （場に出るビークルはリリース状態、コマンドゾーンに入るビークルは出ていったカードのホールド状態を引き継ぐ。ライドしていたユニットは降りる）。

const HANGER_EFFECT_ID = "xg4064_hanger";
const HANGER_COMMAND_EFFECT_ID = "xg4064_hanger_command";
const HANGER_FIELD_EFFECT_ID = "xg4064_hanger_field";

function multiCatVehicle(state: GameState, cardId: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  return def?.type === "vehicle" && (cardCategories(def) as string[]).length >= 2;
}

function hangerCommandIds(state: GameState, pid: PlayerId): string[] {
  const power = countAvailablePower(state, pid);
  return state.players[pid].command
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId) as { powerCost?: unknown; rushAdditionalCondition?: unknown } | undefined;
      return multiCatVehicle(state, c.cardId) && !def?.rushAdditionalCondition && parsePowerCost(def?.powerCost as number | string | undefined) <= power;
    })
    .map((c) => c.instanceId);
}

function hangerFieldIds(state: GameState, pid: PlayerId): string[] {
  return fieldCards(state, pid).filter((c) => multiCatVehicle(state, c.cardId)).map((c) => c.instanceId);
}

XG4_KEYWORDS["XG4-064::hanger"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg4064:not_own_turn" };
  if (hangerCommandIds(state, ctx.playerId).length === 0 || hangerFieldIds(state, ctx.playerId).length === 0) return { state, detail: "xg4064:no_targets" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG4-064", HANGER_EFFECT_ID)), detail: HANGER_EFFECT_ID };
};

XG4_RESOLVERS[HANGER_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[HANGER_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[HANGER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const ids = hangerCommandIds(next, playerId);
  const log = logFor(state, playerId, "XG4-064", `${HANGER_EFFECT_ID}:confirm`);
  if (ids.length === 0 || hangerFieldIds(next, playerId).length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-064"), effectId: HANGER_COMMAND_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};

XG4_RESOLVERS[HANGER_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  return {
    state: openNext(next, pending, {
      ...base(pendingBase(pending), "XG4-064"),
      effectId: HANGER_FIELD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: hangerFieldIds(next, playerId),
      selectCount: 1,
      optional: false,
      xg4Meta: { commandId: instanceId },
    }),
    log: logFor(state, playerId, "XG4-064", `${HANGER_COMMAND_EFFECT_ID}:${instanceId}`),
  };
};

XG4_RESOLVERS[HANGER_FIELD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const commandId = String(pending.xg4Meta?.commandId ?? "");
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const cmd = p.command.find((c) => c.instanceId === commandId);
    const zone = p.rush.some((c) => c.instanceId === instanceId) ? "rush" : p.battle.some((c) => c.instanceId === instanceId) ? "battle" : null;
    const vehicle = zone ? p[zone].find((c) => c.instanceId === instanceId) : undefined;
    if (!cmd || !zone || !vehicle) return p;
    const unmount = (c: CardInstance): CardInstance => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c);
    const incoming = stripForZone(cmd);
    const outgoing: CardInstance = { ...stripForZone(vehicle), commandHeld: cmd.commandHeld };
    const swapIn = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? incoming : unmount(c)));
    return {
      ...p,
      command: p.command.map((c) => (c.instanceId === commandId ? outgoing : c)),
      rush: zone === "rush" ? swapIn(p.rush) : p.rush.map(unmount),
      battle: zone === "battle" ? swapIn(p.battle) : p.battle.map(unmount),
      discard: [...p.discard, ...(vehicle.stackedCards ?? []).map(stripForZone)],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-064", `${HANGER_FIELD_EFFECT_ID}:${commandId}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-066 マシンハードスプラッシャー【水中魚雷】（ラッシュしたとき）
// 「敵軍山札の上から3枚をオモテにしてよい。そうしたとき、オモテにしたカードをそれぞれ持ち主の山札の下に好きな順で戻す。」（atwiki/page-2095）。
// 1枚ずつ選んだ順に山札の下へ（最後の1枚は自動）。

const TORPEDO_EFFECT_ID = "xg4066_torpedo";
const TORPEDO_ORDER_EFFECT_ID = "xg4066_torpedo_order";

XG4_KEYWORDS["XG4-066::mizukami"] = (state, ctx) => {
  if (state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: "xg4066:empty_deck" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG4-066", TORPEDO_EFFECT_ID)), detail: TORPEDO_EFFECT_ID };
};

function torpedoToBottom(state: GameState, enemyId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, enemyId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), card] } : p;
  });
}

XG4_RESOLVERS[TORPEDO_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[TORPEDO_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[TORPEDO_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].deck.slice(0, 3).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG4-066", `${TORPEDO_EFFECT_ID}:reveal:${ids.join(",")}`);
  if (ids.length <= 1) {
    for (const id of ids) next = torpedoToBottom(next, enemyId, id);
    return { state: proceed(next, pending), log };
  }
  return { state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-066"), effectId: TORPEDO_ORDER_EFFECT_ID, kind: "pick_effect_branch", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};

XG4_RESOLVERS[TORPEDO_ORDER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = torpedoToBottom(state, enemyId, instanceId);
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  const log = logFor(state, playerId, "XG4-066", `${TORPEDO_ORDER_EFFECT_ID}:${instanceId}`);
  if (rest.length > 1) return { state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: rest } }, log };
  next = close(next, pending);
  for (const id of rest) next = torpedoToBottom(next, enemyId, id);
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// XG4-067 仮面ライダーW・LM【メタルシャフト】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからホールド状態の敵軍Sユニットを1体選び、持ち主の山札の上に戻してもよい。」
// （atwiki/page-2117）。

const SHAFT_EFFECT_ID = "xg4067_metal_shaft";

XG4_KEYWORDS["XG4-067::shaft"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg4067:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => isUnit(state, c.cardId) && c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG4-067", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4067:no_targets" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-067"), effectId: SHAFT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }), detail: SHAFT_EFFECT_ID };
};

XG4_RESOLVERS[SHAFT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = toDeckTop(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-067", `${SHAFT_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[SHAFT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-068 仮面ライダーW・CT【トリガーマグナム】
// 「自軍ターン中、これがバトルエリアに出たとき、必要パワーの数字が3以下の常駐しているオペレーションを1つ選び、持ち主のゾーンに送ってもよい。」
// （atwiki/page-2136）。自軍・敵軍の常駐（カード評価）。「持ち主のゾーン」はパワーゾーンかコマンドゾーン（カード評価）で、効果を使った側が選ぶ。
// パワーゾーンにはオモテで、コマンドゾーンにはリリース状態で置く（コマンドゾーンが5枚なら選べない）。重ねていたカードは捨札。

const MAGNUM_EFFECT_ID = "xg4068_trigger_magnum";
const MAGNUM_ZONE_EFFECT_ID = "xg4068_trigger_magnum_zone";
const ZONE_POWER = "power";
const ZONE_COMMAND = "command";

function residentOwner(state: GameState, instanceId: string): PlayerId | undefined {
  return (["player1", "player2"] as const).find((pid) => (state.players[pid].operation ?? []).some((c) => c.instanceId === instanceId));
}

XG4_KEYWORDS["XG4-068::magnum"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg4068:not_own_turn" };
  const ids = (["player1", "player2"] as const)
    .flatMap((pid) => state.players[pid].operation ?? [])
    .filter((c) => rm1CostNumber(state, c.cardId) <= 3)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4068:no_targets" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-068"), effectId: MAGNUM_EFFECT_ID, kind: "pick_effect_branch", validInstanceIds: ids, selectCount: 1, optional: true }), detail: MAGNUM_EFFECT_ID };
};

XG4_RESOLVERS[MAGNUM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = residentOwner(state, instanceId);
  if (!owner) return { error: "invalid_target" };
  const zones = [ZONE_POWER, ...(state.players[owner].command.length < COMMAND_LIMIT ? [ZONE_COMMAND] : [])];
  return {
    state: openNext(close(state, pending), pending, {
      ...base(pendingBase(pending), "XG4-068"),
      effectId: MAGNUM_ZONE_EFFECT_ID,
      kind: "pick_effect_branch",
      validInstanceIds: zones,
      selectCount: 1,
      optional: false,
      xg4Meta: { owner, residentId: instanceId },
    }),
    log: logFor(state, playerId, "XG4-068", `${MAGNUM_EFFECT_ID}:${instanceId}`),
  };
};
XG4_SKIPPERS[MAGNUM_EFFECT_ID] = simpleSkip();

XG4_RESOLVERS[MAGNUM_ZONE_EFFECT_ID] = (state, playerId, zone) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.xg4Meta?.owner as PlayerId;
  const residentId = String(pending.xg4Meta?.residentId ?? "");
  const next = patchPlayer(close(state, pending), owner, (p) => {
    const card = (p.operation ?? []).find((c) => c.instanceId === residentId);
    if (!card) return p;
    const plain = stripForZone(card);
    return {
      ...p,
      operation: (p.operation ?? []).filter((c) => c.instanceId !== residentId),
      power: zone === ZONE_POWER ? [...p.power, { ...plain, faceDown: false }] : p.power,
      command: zone === ZONE_COMMAND ? [...p.command, { ...plain, commandHeld: false }] : p.command,
      discard: [...p.discard, ...(card.stackedCards ?? []).map(stripForZone)],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-068", `${MAGNUM_ZONE_EFFECT_ID}:${residentId}:${zone}`) };
};

// ---------------------------------------------------------------------------
// XG4-069 仮面ライダーW・FJ【ショルダー・ファング】
// 「これがバトルエリアに出たとき、特徴「獣」または「恐竜」を持つ自軍コマンドを1つ選び、ホールドしてもよい。そうしたとき、必要パワーの数字が同じ
//  敵軍Sユニットを3体まで選びホールドする。」（atwiki/page-2043）。Q1・Q2: 3体までの任意の数（1体目を選んだら確定できる）。選べるのはリリース状態の
// 敵軍 S ユニット（エリアを問わない）。必要パワーの数字は印刷の数字（「3+」は3）。

const FANG_COMMAND_EFFECT_ID = "xg4069_fang_command";
const FANG_PICK_EFFECT_ID = "xg4069_fang_pick";
const FANG_MAX = 3;

function fangTargets(state: GameState, playerId: PlayerId): CardInstance[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId).filter((c) => isUnit(state, c.cardId) && !c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "XG4-069", c));
}

XG4_KEYWORDS["XG4-069::fang"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].command
    .filter((c) => !c.commandHeld && printedFeatures(state, c.cardId).some((f) => f === "獣" || f === "恐竜"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4069:no_commands" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-069"), effectId: FANG_COMMAND_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true }), detail: FANG_COMMAND_EFFECT_ID };
};

XG4_RESOLVERS[FANG_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
  const log = logFor(state, playerId, "XG4-069", `${FANG_COMMAND_EFFECT_ID}:${instanceId}`);
  const ids = fangTargets(next, playerId).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-069"), effectId: FANG_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: FANG_MAX, selectedInstanceIds: [], optional: false }),
    log,
  };
};
XG4_SKIPPERS[FANG_COMMAND_EFFECT_ID] = simpleSkip();

function fangFinish(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  let next = close(state, pending);
  const enemyId = opponent(playerId);
  for (const id of selected) next = holdFieldUnit(next, enemyId, id);
  return proceed(next, pending);
}

XG4_RESOLVERS[FANG_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const card = findField(state, opponent(playerId), selected[0]!);
  const cost = card ? rm1CostNumber(state, card.cardId) : Number.NaN;
  const rest = fangTargets(state, playerId)
    .filter((c) => !selected.includes(c.instanceId) && rm1CostNumber(state, c.cardId) === cost)
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG4-069", `${FANG_PICK_EFFECT_ID}:${instanceId}`);
  if (selected.length >= FANG_MAX || rest.length === 0) return { state: fangFinish(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log };
};
XG4_CONFIRMERS[FANG_PICK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: fangFinish(state, pending, playerId, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "XG4-069", `${FANG_PICK_EFFECT_ID}:confirm`) };
};

// ---------------------------------------------------------------------------
// XG4-070 クレイドール・ドーパント【不死身のドーパント】
// 「敵軍ターン中、これが撃破されて捨札になるとき、捨札にするかわりに持ち主の山札に戻してシャッフルする。」（atwiki/page-2084）。強制。
// 置き換えは rules/operationCounters.ts finalizeLeavePending（この判定だけをここに置く）。

export function xg4DestroyedToDeckInstead(cardId: string, ownerId: PlayerId, phasePlayerId: PlayerId): boolean {
  return isCard(cardId, "XG4-070") && ownerId !== phasePlayerId;
}

export function xg4ShuffleInto(deck: CardInstance[], card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance[] {
  return shuffleCards([...deck, stripForZone(card)]);
}

// ---------------------------------------------------------------------------
// XG4-071 ナスカ・ドーパント
// ※「これが自軍エリアにある間、これ以外の特徴「怪人」を持つ自軍ユニットが撃破されたとき、これを持ち主の手札に戻す。」（離場のあと。特徴は場に
//  あったときのもの）。
// 【君を真っ二つにしたい】「自軍ターン中、これがバトルエリアに出たとき、カテゴリを2つ持つか、追加条件を持つSユニットを1体選び撃破してもよい。」
// （atwiki/page-2112）。自軍・敵軍、エリアを問わない（カード評価）。カテゴリはいまのカテゴリではなく印刷のカテゴリの数。

const NASCA_EFFECT_ID = "xg4071_nasca";

XG4_KEYWORDS["XG4-071::nasca"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg4071:not_own_turn" };
  const ids = allFieldUnits(state)
    .filter(({ owner, card }) => {
      const def = getDefinition(state.definitions, card.cardId) as (ReturnType<typeof getDefinition> & { rushAdditionalCondition?: unknown }) | undefined;
      if (!def || def.type !== "unit" || !rk1IsSmallNow(state, card)) return false;
      if ((cardCategories(def) as string[]).length !== 2 && !def.rushAdditionalCondition) return false;
      return owner === ctx.playerId || selectableEnemy(state, ctx.playerId, "XG4-071", card);
    })
    .map(({ card }) => card.instanceId);
  if (ids.length === 0) return { state, detail: "xg4071:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "XG4-071", NASCA_EFFECT_ID, ids, true, "discard")), detail: NASCA_EFFECT_ID };
};

/** 場のユニットが離れたあと（rules/operationCounters.ts finalizeLeavePending）。before は離れる前の盤面。 */
export function applyXg4dAfterUnitLeft(before: GameState, state: GameState, ctx: { ownerPlayerId: PlayerId; card: CardInstance; destroyed: boolean }): GameState {
  if (!ctx.destroyed || isCard(ctx.card.cardId, "XG4-071") || !isUnit(before, ctx.card.cardId)) return state;
  if (!unitFeatures(before, ctx.ownerPlayerId, ctx.card).includes("怪人")) return state;
  let next = state;
  for (const c of fieldCards(state, ctx.ownerPlayerId).filter((x) => isCard(x.cardId, "XG4-071"))) {
    const bounced = bounceToHandAuto(next, ctx.ownerPlayerId, c.instanceId, ["rush", "battle"]);
    if (bounced.bounced) next = { ...bounced.state, log: [...bounced.state.log, logFor(state, ctx.ownerPlayerId, "XG4-071", `xg4071_return:${c.instanceId}`)] };
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG4-073 仮面ライダークウガDF【水の心の戦士】（アタックされたとき・バトルの前）
// 「これが敵軍ユニットにアタックされたとき、自軍コマンドを2つ選びホールドしてもよい。そうしたとき、そのバトルは行われない。」（atwiki/page-2067）。
// リリース状態の自軍コマンドが2つ以上あるときだけ選択を開く。2つ目を選んだらホールドしてバトルを行わない。
// XG4-074 仮面ライダーX【ライドルスティック】（CN: RC）
// 「これが敵軍Sユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のコマンドゾーンに送ってもよい。置けなければ捨札にする。」
// （atwiki/page-2055）。ライドオフしたターン（RC。docs/rules/07-keywords.md「RC は…ライドオフしたときに発動」）の記録があるときだけ。
// コマンドゾーンへはほかの「コマンドゾーンに置く」と同じ離場の処理（rules/fieldLeaveQueue.ts）。

const WATER_EFFECT_ID = "xg4073_water_heart";
const RIDOL_EFFECT_ID = "xg4074_ridol_stick";

type BeforeMeta = { battle: PendingBattle; wingAttackFromRush: boolean };
type BeforeResult = { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean };

function offered(battle: PendingBattle, instanceId: string): PendingBattle {
  return { ...battle, xg4BeforeBattleOffered: [...(battle.xg4BeforeBattleOffered ?? []), instanceId] };
}

export function openXg4dBeforeBattle(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.battleCancelled || battle.effectBattle) return null;
  const done = battle.xg4BeforeBattleOffered ?? [];
  const attackerId = battle.attackerPlayerId;
  const attacker = findField(state, attackerId, battle.attackerInstanceId);
  const defender = findField(state, battle.defenderPlayerId, battle.defenderInstanceId);
  if (!attacker || !defender) return null;
  if (
    isCard(attacker.cardId, "XG4-074") &&
    !done.includes(attacker.instanceId) &&
    hasTurnRecordFor(state, attackerId, XG4_RIDOL_RULE, attacker.instanceId) &&
    isUnit(state, defender.cardId) &&
    rk1IsSmallNow(state, defender) &&
    selectableEnemy(state, attackerId, "XG4-074", defender)
  ) {
    const meta: BeforeMeta = { battle: offered(battle, attacker.instanceId), wingAttackFromRush };
    return openEffectChoice(state, {
      ...confirmChoice({ playerId: attackerId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: attacker.instanceId }, "XG4-074", RIDOL_EFFECT_ID),
      xg4Meta: meta as unknown as Record<string, unknown>,
    });
  }
  const defenderId = battle.defenderPlayerId;
  if (isCard(defender.cardId, "XG4-073") && !done.includes(defender.instanceId) && defenderId !== attackerId) {
    const ids = state.players[defenderId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
    if (ids.length >= 2) {
      const meta: BeforeMeta = { battle: offered(battle, defender.instanceId), wingAttackFromRush };
      return openEffectChoice(state, {
        ...base({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: defender.instanceId }, "XG4-073"),
        effectId: WATER_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: ids,
        selectCount: 2,
        selectedInstanceIds: [],
        optional: true,
        xg4Meta: meta as unknown as Record<string, unknown>,
      });
    }
  }
  return null;
}

export function isXg4dBeforeBattleChoice(pending: PendingEffectChoice | undefined): boolean {
  return (pending?.effectId === WATER_EFFECT_ID || pending?.effectId === RIDOL_EFFECT_ID) && !!pending.xg4Meta?.battle;
}

function ridolSend(state: GameState, playerId: PlayerId): BeforeResult {
  const pending = state.pendingEffectChoice!;
  const meta = pending.xg4Meta as unknown as BeforeMeta;
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId };
  next = moveFieldUnit(next, meta.battle.defenderPlayerId, meta.battle.defenderInstanceId, meta.battle.phasePlayerId, "command_held");
  next = { ...next, log: [...next.log, logFor(state, playerId, "XG4-074", `${RIDOL_EFFECT_ID}:${meta.battle.defenderInstanceId}`)] };
  return { state: next, battle: { ...meta.battle, battleCancelled: true }, wingAttackFromRush: meta.wingAttackFromRush };
}

/** 選んだ。partial は XG4-073 の1つ目のコマンド（選択はまだ続く）。 */
export function resolveXg4dBeforeBattle(state: GameState, playerId: PlayerId, instanceId: string): BeforeResult | { partial: GameState } | { error: string } {
  const pending = state.pendingEffectChoice;
  if (!pending || !isXg4dBeforeBattleChoice(pending) || pending.playerId !== playerId) return { error: "no_pending" };
  if (pending.effectId === RIDOL_EFFECT_ID) return { error: "invalid_target" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return { partial: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) } } };
  }
  const meta = pending.xg4Meta as unknown as BeforeMeta;
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId };
  next = patchPlayer(next, playerId, (p) => ({ ...p, command: p.command.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: true } : c)) }));
  next = { ...next, log: [...next.log, logFor(state, playerId, "XG4-073", `${WATER_EFFECT_ID}:${selected.join(",")}`)] };
  return { state: next, battle: { ...meta.battle, battleCancelled: true }, wingAttackFromRush: meta.wingAttackFromRush };
}

export function confirmXg4dBeforeBattle(state: GameState, playerId: PlayerId): BeforeResult | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== RIDOL_EFFECT_ID || !isXg4dBeforeBattleChoice(pending) || pending.playerId !== playerId) return null;
  return ridolSend(state, playerId);
}

export function skipXg4dBeforeBattle(state: GameState, playerId: PlayerId): BeforeResult | null {
  const pending = state.pendingEffectChoice;
  if (!pending || !isXg4dBeforeBattleChoice(pending) || pending.playerId !== playerId) return null;
  const meta = pending.xg4Meta as unknown as BeforeMeta;
  const next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId, log: [...state.log, logFor(state, playerId, pending.sourceCardId ?? "XG4", `${pending.effectId}:skip`)] };
  return { state: next, battle: meta.battle, wingAttackFromRush: meta.wingAttackFromRush };
}

XG4_KEYWORDS["XG4-074::ridol"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4074:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, XG4_RIDOL_RULE, "XG4-074", { instanceId: id }), detail: "xg4074:rc" };
};

// ---------------------------------------------------------------------------
// XG4-075 アポロガイスト
// ※「これが自軍エリアにある間、自分がターンを終えるとき、これがホールド状態なら捨札にする。」（撃破ではない。rules/turnEndingEffects.ts の xg4 の列）。
// 【生命の強奪】「自軍ターン中、ホールド状態のこのユニットがバトルエリアに出たとき、次の効果を発動する⇒相手は自分自身のSユニットを1体選び撃破するか、
//  このユニットをリリースするかを選ぶ。」（atwiki/page-2062）。相手の選択（候補は相手の場の S ユニットと「リリースする」）。

const APOLLO_EFFECT_ID = "xg4075_life_steal";
export const XG4_APOLLO_RELEASE = "release";

XG4_KEYWORDS["XG4-075::life"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!ownTurn(ctx) || !id) return { state, detail: "xg4075:not_own_turn" };
  const self = findField(state, ctx.playerId, id);
  if (!self?.commandHeld) return { state, detail: "xg4075:released" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isUnit(state, c.cardId) && rk1IsSmallNow(state, c) && selectableOwnByEnemyEffect(state, enemyId, ctx.playerId, "XG4-075", c))
    .map((c) => c.instanceId);
  return {
    state: openAfter(state, { ...base({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: id }, "XG4-075"), effectId: APOLLO_EFFECT_ID, kind: "pick_effect_branch", validInstanceIds: [...ids, XG4_APOLLO_RELEASE], selectCount: 1, optional: false }),
    detail: APOLLO_EFFECT_ID,
  };
};

XG4_RESOLVERS[APOLLO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, "XG4-075", `${APOLLO_EFFECT_ID}:${instanceId}`);
  if (instanceId === XG4_APOLLO_RELEASE) {
    const ownerId = opponent(playerId);
    const id = pending.sourceInstanceId;
    const next = patchPlayer(close(state, pending), ownerId, (p) => {
      const release = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === id ? { ...c, commandHeld: false } : c));
      return { ...p, rush: release(p.rush), battle: release(p.battle) };
    });
    return { state: proceed(next, pending), log };
  }
  const left = applyUnitLeave(close(state, pending), instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  return { state: proceed(left.state, pending), log };
};

export function collectXg4dTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return fieldCards(state, endingPlayerId)
    .filter((c) => isCard(c.cardId, "XG4-075") && c.commandHeld)
    .map((c) => `apollo:${c.instanceId}`);
}

export function openXg4dTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  if (kind !== "apollo") return state;
  const card = findField(state, endingPlayerId, instanceId);
  if (!card?.commandHeld) return state;
  return moveFieldUnit(state, endingPlayerId, instanceId, endingPlayerId, "discard");
}

// ---------------------------------------------------------------------------
// XG4-076 スーパーアポロガイスト【世界の融合】（ラッシュしたとき）
// 「すべての捨札を持ち主の山札に戻してシャッフルする。」（atwiki/page-2113）。自軍・敵軍。

XG4_KEYWORDS["XG4-076::fusion"] = (state) => {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    next = patchPlayer(next, pid, (p) => ({ ...p, deck: shuffleCards([...p.deck, ...p.discard.map(stripForZone)]), discard: [] }));
  }
  return { state: next, detail: "xg4076:world_fusion" };
};

// ---------------------------------------------------------------------------
// XG4-080 ロボライダー【ハードショット】（CN: RC）
// 「これがストライクしてダメージを与えるとき、かわりに敵軍ラッシュエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」
// （atwiki/page-2071）。ライドオフしたターンの記録があるとき、ストライクしたとき（core/applyAction.ts strike。「ストライクしたとき」の選択と
// 同じ所）に選択を開き、選んだらストライクのダメージを0にする（かわりに置いた1枚が1点のダメージ）。

const HARDSHOT_EFFECT_ID = "xg4080_hard_shot";

XG4_KEYWORDS["XG4-080::hardshot"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4080:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, XG4_HARDSHOT_RULE, "XG4-080", { instanceId: id }), detail: "xg4080:rc" };
};

export function openXg4dOnStrike(state: GameState, pending: PendingStrike): GameState {
  const pid = pending.strikerPlayerId;
  const striker = findField(state, pid, pending.strikerInstanceId);
  if (!striker || !isCard(striker.cardId, "XG4-080") || pending.damage <= 0) return state;
  if (!hasTurnRecordFor(state, pid, XG4_HARDSHOT_RULE, striker.instanceId)) return state;
  const enemyId = opponent(pid);
  const ids = state.players[enemyId].rush
    .filter((c) => isUnit(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, pid, "XG4-080", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, { ...base({ playerId: pid, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: striker.instanceId }, "XG4-080"), effectId: HARDSHOT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
}

XG4_RESOLVERS[HARDSHOT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  if (next.deferredStrike) next = { ...next, deferredStrike: { ...next.deferredStrike, damage: 0 } };
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-080", `${HARDSHOT_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[HARDSHOT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-081 仮面ライダーブレイド【ライトニングスラッシュ】（RC）
// 「自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍バトルエリアのSユニットを1体選びホールドする。その後、見せたカードの必要パワーの
//  数字が「2」と「6」なら、このターン、このユニットのBPを+3000する。」（atwiki/page-2072）。ホールドするのはリリース状態のユニット。

const LIGHTNING_REVEAL_EFFECT_ID = "xg4081_lightning_reveal";
const LIGHTNING_HOLD_EFFECT_ID = "xg4081_lightning_hold";

XG4_KEYWORDS["XG4-081::lightning"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "xg4081:short_hand" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-081"), effectId: LIGHTNING_REVEAL_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, selectCount: 2, selectedInstanceIds: [], optional: true }),
    detail: LIGHTNING_REVEAL_EFFECT_ID,
  };
};

function lightningBonus(state: GameState, pending: PendingEffectChoice, playerId: PlayerId): GameState {
  const costs = ((pending.xg4Meta?.revealedCardIds as string[] | undefined) ?? []).map((id) => rm1CostNumber(state, id)).sort((a, b) => a - b);
  if (costs.length !== 2 || costs[0] !== 2 || costs[1] !== 6 || !pending.sourceInstanceId) return state;
  return addTurnRecord(state, playerId, XG4_LIGHTNING_RULE, "XG4-081", { instanceId: pending.sourceInstanceId });
}

XG4_RESOLVERS[LIGHTNING_REVEAL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG4-081", `${LIGHTNING_REVEAL_EFFECT_ID}:${instanceId}`);
  if (selected.length < 2) return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) } }, log };
  const revealedCardIds = state.players[playerId].hand.filter((c) => selected.includes(c.instanceId)).map((c) => c.cardId);
  const next = close(state, pending);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isUnit(next, c.cardId) && !c.commandHeld && rk1IsSmallNow(next, c) && selectableEnemy(next, playerId, "XG4-081", c))
    .map((c) => c.instanceId);
  const withMeta = { ...pending, xg4Meta: { revealedCardIds } };
  if (ids.length === 0) return { state: proceed(lightningBonus(next, withMeta, playerId), pending), log };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG4-081"), effectId: LIGHTNING_HOLD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false, xg4Meta: { revealedCardIds } }),
    log,
  };
};
XG4_SKIPPERS[LIGHTNING_REVEAL_EFFECT_ID] = simpleSkip();

XG4_RESOLVERS[LIGHTNING_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = holdFieldUnit(close(state, pending), opponent(playerId), instanceId);
  next = lightningBonus(next, pending, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-081", `${LIGHTNING_HOLD_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG4-083 ディケイド ファイズ【アタックライド】（RC）
// 「このターン、これがバトルで撃破したユニットのBPの下三桁が500だったなら、相手に1点ダメージを与える。」（atwiki/page-2068）。BP はバトルのときの BP。

XG4_KEYWORDS["XG4-083::attackride"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4083:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, XG4_ATTACKRIDE_RULE, "XG4-083", { instanceId: id }), detail: "xg4083:rc" };
};

export function xg4dOnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedBp: number | undefined): GameState {
  if (winnerId === defeatedOwnerId || defeatedBp === undefined || defeatedBp % 1000 !== 500) return state;
  const winner = findField(state, winnerId, winnerInstanceId);
  if (!winner || !isCard(winner.cardId, "XG4-083") || !hasTurnRecordFor(state, winnerId, XG4_ATTACKRIDE_RULE, winner.instanceId)) return state;
  return applyDamageToPlayer(state, defeatedOwnerId, 1, { kind: "none", activePlayer: state.activePlayer });
}


// ---------------------------------------------------------------------------
// 継続効果だけ・ほかで処理するカードの DSL キーワード。

XG4_KEYWORDS["XG4-065::flight"] = noop("xg4065:flight");
XG4_KEYWORDS["XG4-070::undying"] = noop("xg4070:undying");
XG4_KEYWORDS["XG4-071::note"] = noop("xg4071:note");
XG4_KEYWORDS["XG4-072::taboo"] = noop("xg4072:taboo");
XG4_KEYWORDS["XG4-073::water"] = noop("xg4073:water");
XG4_KEYWORDS["XG4-075::note"] = noop("xg4075:note");
