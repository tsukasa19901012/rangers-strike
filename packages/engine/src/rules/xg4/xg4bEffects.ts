/**
 * クロスギャザー ザ・ジェットアクセル XG4-022〜XG4-043 のカード固有の効果（cardSpec XG4-022-043.*）。
 * 入口は rules/xg4/xg4Effects.ts。継続効果（XG4-027 のライド・XG4-034 のアタックされない・XG4-039 の合体の素材）は rules/xg4/xg4Fields.ts。
 * 選択の組み立ては rules/rm/rm1Effects.ts の部品（openAfter・close・proceed 等）を使う。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, cardName, effectiveBp, effectiveCommandCategories, getDefinition, isSmallUnit, unitSizeOf } from "../../core/catalog";
import { opponent, performDeckDraws } from "../../core/helpers";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { openEffectChoice } from "../pendingChoices";
import { recordReveal, revealedCards } from "../revealNotice";
import { holdFieldUnit } from "../errataCardEffects";
import { bounceToHand } from "../bounce";
import { getRocketBoosterDeclaredName, startRocketBoosterChoice } from "../rocketBooster";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rm1CostNumber } from "../rm/rm1Fields";
import {
  base,
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
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
  type BaseCtx,
} from "../rm/rm1Effects";
import { unitFeatures } from "../addedFeatures";
import { XG4_CONFIRMERS, XG4_KEYWORDS, XG4_RESOLVERS, XG4_SKIPPERS, addTurnRecord, hasTurnRecordFor, isCard, noop } from "./xg4Common";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";
import { returnToDeckInOrder } from "../deckOrder";

function costNumber(state: GameState, cardId: string): number {
  return rm1CostNumber(state, cardId);
}

function isUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function sizeNow(state: GameState, card: CardInstance): string | undefined {
  return unitSizeOf(state.definitions, card);
}

/** 場のユニット1体を持ち主のパワーゾーンにダメージにして置く選択（resolver は POWER_DAMAGE_PICK）。 */
export function damagePick(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional = false): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, xg4Meta: { damagePick: true } };
}

export function registerDamagePick(effectId: string, sourceCardId: string): void {
  XG4_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const owner: PlayerId = findField(state, "player1", instanceId) ? "player1" : "player2";
    const next = moveFieldUnit(close(state, pending), owner, instanceId, pending.phasePlayerId, "power_damage");
    return { state: proceed(next, pending), log: logFor(state, playerId, sourceCardId, `${effectId}:${instanceId}`) };
  };
  XG4_SKIPPERS[effectId] = simpleSkip();
}

/**
 * バトルエリアに出たときの選択を、アタック・ストライク・ライドオフの選択より先に開く（それらは deferredBattleEntry に移し、選択を終えたあと
 * rules/battleEntry.ts が開き直す）。
 */
export function openBeforeEntry(state: GameState, playerId: PlayerId, choice: PendingEffectChoice): GameState {
  let next = openAfter(state, choice);
  if (!next.pendingEffectChoice || next.deferredBattleEntry) return next;
  if (next.pendingRideOffChoice?.playerId === playerId) {
    next = { ...next, deferredBattleEntry: next.pendingRideOffChoice.battleEntry, pendingRideOffChoice: undefined };
  } else if (next.pendingBattleEntry?.playerId === playerId) {
    next = { ...next, deferredBattleEntry: next.pendingBattleEntry, pendingBattleEntry: undefined };
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG4-022 シュリケンジャー【ニンジャミセン】
// 「これが自軍ラッシュエリアにある間、特徴「メカ」を持つ自軍ユニットがバトルエリアに出たとき、自軍コマンドを1つ選びリリースしてもよい。」（atwiki/page-2045）
// 出たかどうかは applyAction の前後で自軍バトルエリアのユニットを比べる（どの経路で出ても）。特徴はいまの特徴。選べるのはホールド状態のコマンド。

const MISEN_EFFECT_ID = "xg4022_ninjamisen";

function ninjaMisen(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const misen = after.players[pid].rush.filter((c) => isCard(c.cardId, "XG4-022"));
    if (misen.length === 0) continue;
    const prev = new Set(before.players[pid].battle.map((c) => c.instanceId));
    for (const unit of after.players[pid].battle) {
      if (prev.has(unit.instanceId) || !isUnit(after, unit.cardId) || !unitFeatures(after, pid, unit).includes("メカ")) continue;
      for (const src of misen) {
        const ids = next.players[pid].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
        if (ids.length === 0) continue;
        const phasePlayerId = next.pendingBattleEntry?.phasePlayerId ?? next.pendingRideOffChoice?.phasePlayerId ?? before.activePlayer;
        next = openBeforeEntry(next, pid, { ...base({ playerId: pid, phasePlayerId, sourceInstanceId: src.instanceId }, "XG4-022"), effectId: MISEN_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: true });
      }
    }
  }
  return next;
}

XG4_RESOLVERS[MISEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)) }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-022", `${MISEN_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[MISEN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-025 デカブレイク【必殺拳ソニックハンマー】（NC・ライドオフしたとき）
// 「オモテ向きの自軍パワーの枚数を数えてもよい。そうしたき、敵軍バトルエリアから、その数以下の必要パワーの数字を持つ敵軍ユニットを１体選び持ち主の
//  パワーゾーンに送る。」（atwiki/page-2142）。「数えてもよい」は DSL の任意（発動するかの確認）。数えたら選ぶのは強制。サイズを問わない。

const SONIC_EFFECT_ID = "xg4025_sonic_hammer";

function sonicHammer(state: GameState, ctx: BaseCtx, optional: boolean): GameState {
  const count = state.players[ctx.playerId].power.filter((c) => !c.faceDown).length;
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return isUnit(state, c.cardId) && Number.isFinite(n) && n <= count && selectableEnemy(state, ctx.playerId, "XG4-025", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, genericPick(ctx, "XG4-025", SONIC_EFFECT_ID, ids, optional, "power"));
}

XG4_KEYWORDS["XG4-025::sonic_hammer"] = (state, ctx) => ({ state: sonicHammer(state, ctxBase(ctx), false), detail: SONIC_EFFECT_ID });

// ---------------------------------------------------------------------------
// XG4-026 天空勇者マジシャイン【マジランプバスター】（ラッシュしたとき）
// 「自軍コマンドを好きな数選びホールドしてもよい。そうしたとき、ホールドしたコマンド1つにつきBP2000として、そのBPの合計以下のBPを持つ敵軍ユニットを
//  1体選び撃破する。」（atwiki/page-2146）。選べるのはリリース状態の自軍コマンド。撃破する敵軍ユニットはエリア・サイズを問わない（いまの BP）。

const LAMP_HOLD_EFFECT_ID = "xg4026_lamp_hold";
const LAMP_DESTROY_EFFECT_ID = "xg4026_lamp_destroy";

XG4_KEYWORDS["XG4-026::majiranpubasuta"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4026:no_commands" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG4-026"), effectId: LAMP_HOLD_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: ids.length, selectedInstanceIds: [], optional: true }),
    detail: LAMP_HOLD_EFFECT_ID,
  };
};

function lampFinish(state: GameState, pending: PendingEffectChoice, playerId: PlayerId, selected: string[]): GameState {
  let next = close(state, pending);
  if (selected.length === 0) return proceed(next, pending);
  next = patchPlayer(next, playerId, (p) => ({ ...p, command: p.command.map((c) => (selected.includes(c.instanceId) ? { ...c, commandHeld: true } : c)) }));
  const budget = selected.length * 2000;
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => effectiveBp(next, enemyId, c) <= budget && selectableEnemy(next, playerId, "XG4-026", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return proceed(next, pending);
  return openNext(next, pending, genericPick(pendingBase(pending), "XG4-026", LAMP_DESTROY_EFFECT_ID, ids, false, "discard"));
}

XG4_RESOLVERS[LAMP_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
  const log = logFor(state, playerId, "XG4-026", `${LAMP_HOLD_EFFECT_ID}:${instanceId}`);
  if (rest.length === 0) return { state: lampFinish(state, pending, playerId, selected), log };
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } }, log };
};
XG4_SKIPPERS[LAMP_HOLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: lampFinish(state, pending, playerId, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "XG4-026", `${LAMP_HOLD_EFFECT_ID}:skip`) };
};
XG4_CONFIRMERS[LAMP_HOLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: lampFinish(state, pending, playerId, pending.selectedInstanceIds ?? []), log: logFor(state, playerId, "XG4-026", `${LAMP_HOLD_EFFECT_ID}:confirm`) };
};

// ---------------------------------------------------------------------------
// XG4-027 スカーペット【魔法の絨毯】
// 「これがバトルエリアからラッシュエリアに戻るとき、このビークルにライドしているユニットを手札に戻してもよい。」（atwiki/page-2086）
// 戻ったかどうかは applyAction の前後で見る（自軍バトルエリアにあったこれが、ライドされたまま自軍ラッシュエリアに移った）。
// ※のライド（「魔法」の S ユニットはコマンドを1つホールドすればライドできる）は rules/xg4/xg4Fields.ts。

const CARPET_EFFECT_ID = "xg4027_magic_carpet";

function magicCarpet(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const wasInBattle = new Set(before.players[pid].battle.filter((c) => isSameVehicleTextIdentity(c.cardId, "XG4-027")).map((c) => c.instanceId));
    if (wasInBattle.size === 0) continue;
    for (const v of after.players[pid].rush) {
      if (!wasInBattle.has(v.instanceId)) continue;
      const rider = after.players[pid].rush.find((c) => c.mountedOnInstanceId === v.instanceId);
      if (!rider) continue;
      next = openAfter(next, { ...base({ playerId: pid, phasePlayerId: after.activePlayer, sourceInstanceId: v.instanceId }, "XG4-027"), effectId: CARPET_EFFECT_ID, kind: "select_unit", validInstanceIds: [rider.instanceId], selectCount: 1, optional: true });
    }
  }
  return next;
}

XG4_RESOLVERS[CARPET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const bounced = bounceToHand(close(state, pending), { playerId, instanceId, fromZone: "rush" });
  return { state: proceed(bounced.state, pending), log: logFor(state, playerId, "XG4-027", `${CARPET_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[CARPET_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-029 ゲキバイオレット【天地転変打】（NC）
// 「「SP1」特徴「激気」を持つ自軍MユニットのBPを合計して、その合計以下のBPを持つ敵軍ユニットを敵軍バトルエリアから1体選び撃破する。」（atwiki/page-2153）
// 自軍 M ユニットはエリアを問わない（カード評価）。いまの特徴・BP。SP1 は DSL。

const TENCHI_EFFECT_ID = "xg4029_tenchi";

XG4_KEYWORDS["XG4-029::tenchi"] = (state, ctx) => {
  const pid = ctx.playerId;
  const sum = fieldUnits(state, pid)
    .filter((c) => sizeNow(state, c) === "M" && unitFeatures(state, pid, c).includes("激気"))
    .reduce((acc, c) => acc + effectiveBp(state, pid, c), 0);
  const enemyId = opponent(pid);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnit(state, c.cardId) && effectiveBp(state, enemyId, c) <= sum && selectableEnemy(state, pid, "XG4-029", c))
    .map((c) => c.instanceId);
  if (sum <= 0 || ids.length === 0) return { state, detail: "xg4029:no_targets" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "XG4-029", TENCHI_EFFECT_ID, ids, false, "discard")), detail: TENCHI_EFFECT_ID };
};

// ---------------------------------------------------------------------------
// XG4-030 ゲキチョッパー【千千斬】（NC）
// 「自軍ラッシュエリアから、特徴「激気」を持つ自軍Mユニットを1体選びホールドしてもよい。そうしたとき、ホールドしたユニットの必要パワーの数字と同じ
//  必要パワーの数字を持つ敵軍Sユニットを全て撃破する。」（atwiki/page-2100）。敵軍 S ユニットはエリアを問わない。数字は「+」「-」を除く。

const SENZAN_EFFECT_ID = "xg4030_senzan";
const SENZAN_DESTROY_EFFECT_ID = "xg4030_senzan_destroy";

XG4_KEYWORDS["XG4-030::senzan"] = (state, ctx) => {
  const pid = ctx.playerId;
  const ids = state.players[pid].rush
    .filter((c) => isUnit(state, c.cardId) && !c.commandHeld && sizeNow(state, c) === "M" && unitFeatures(state, pid, c).includes("激気"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4030:no_targets" };
  return { state: openAfter(state, { ...base(ctxBase(ctx), "XG4-030"), effectId: SENZAN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }), detail: SENZAN_EFFECT_ID };
};

XG4_RESOLVERS[SENZAN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const held = findField(state, playerId, instanceId);
  let next = holdFieldUnit(close(state, pending), playerId, instanceId);
  const n = held ? costNumber(state, held.cardId) : Number.NaN;
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && costNumber(next, c.cardId) === n && selectableEnemy(next, playerId, "XG4-030", c))
    .map((c) => c.instanceId);
  next = destroyAll(next, pendingBase(pending), "XG4-030", SENZAN_DESTROY_EFFECT_ID, ids);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-030", `${SENZAN_EFFECT_ID}:${instanceId}:${ids.length}`) };
};
XG4_SKIPPERS[SENZAN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-031 ロケットブースター（オペレーション）
// 「カード名を１つ宣言する。このターン、宣言したカード名と同じカード名を持つSユニットとSユニットのカードは次のテキストを得る⇒「ウイング」、
//  「このユニットの持ち主は、自分自身のターンを終えるとき、このユニットがラッシュエリアにあれば手札に戻してもよい。」」（atwiki/page-2094）
// 宣言とウイングは rules/rocketBooster.ts（keywords/cardKeywords.ts）。ターンを終えるときの手札に戻す選択は collectXg4bTurnEndQueue。

XG4_KEYWORDS["XG4-031::rocket_booster"] = (state, ctx) => {
  const opened = startRocketBoosterChoice(state, ctx.playerId, ctx.operationInstanceId ?? ctx.triggerSourceInstanceId ?? "XG4-031");
  return opened ? { state: opened, detail: "rocket_booster:declare" } : { state, detail: "rocket_booster:no_names" };
};

const ROCKET_RETURN_EFFECT_ID = "xg4031_rocket_return";

XG4_RESOLVERS[ROCKET_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const bounced = bounceToHand(close(state, pending), { playerId, instanceId, fromZone: "rush" });
  return { state: bounced.state, log: logFor(state, playerId, "XG4-031", `${ROCKET_RETURN_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[ROCKET_RETURN_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-032 ゴーオンゴールド【バーニングダガー】（NC・ウイングでアタックするとき）
// 「「SP1」これが敵軍ユニットをバトルで撃破したとき、撃破したユニットと同じカテゴリを持つオモテ向きの敵軍パワーを1枚選び捨札にしてもよい。
//  （この効果はこれがウイングでアタックするときナンバーに関係なく発動する）」（atwiki/page-2042）
// NC が成立したらこのターンの記録を付ける（SP1 は DSL）。ウイングでアタックしたか（ラッシュエリアからアタックした）は撃破したときの場所で見る。
// カテゴリは1つでも同じなら（マルチカテゴリ）。

const DAGGER_RULE = "xg4_032_burning_dagger";
const DAGGER_EFFECT_ID = "xg4032_burning_dagger";

XG4_KEYWORDS["XG4-032::burning_dagger"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4032:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, DAGGER_RULE, "XG4-032", { instanceId: id }), detail: DAGGER_RULE };
};

XG4_RESOLVERS[DAGGER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.power.find((c) => c.instanceId === instanceId);
    return card ? { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-032", `${DAGGER_EFFECT_ID}:${instanceId}`) };
};
XG4_SKIPPERS[DAGGER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG4-033 ゴーオンシルバー【フリージングダガー】（NC・ウイングでアタックするとき）
// 「これが敵軍Sユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のパワーゾーンに送ってもよい。（この効果はこれがウイングで
//  アタックするときはナンバーに関係なく発動する）」（atwiki/page-2143）
// NC が成立したらこのターンの記録を付け、アタックするとき（バトルの前）に記録があるか、ウイングでアタックしていれば選択を開く。
// 送ったらバトルを行わない（battleCancelled。これは撃破されない）。

const FREEZE_RULE = "xg4_033_freezing_dagger";
const FREEZE_EFFECT_ID = "xg4033_freezing_dagger";

XG4_KEYWORDS["XG4-033::freezing_nc"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg4033:no_source" };
  return { state: addTurnRecord(state, ctx.playerId, FREEZE_RULE, "XG4-033", { instanceId: id }), detail: FREEZE_RULE };
};

type FreezeMeta = { battle: PendingBattle; wingAttackFromRush: boolean };

/**
 * アタックするとき、バトルの前（core/applyAction.ts continueAttackAfterDeclaration。RM-062 テントリーナと同じ場所）に確認を開く。
 * 開かなければ null。
 */
export function openXg4BeforeBattle(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.xg4FreezeOffered || battle.battleCancelled || battle.effectBattle) return null;
  const pid = battle.attackerPlayerId;
  const attacker = findField(state, pid, battle.attackerInstanceId);
  if (!attacker || !isCard(attacker.cardId, "XG4-033")) return null;
  if (!wingAttackFromRush && !hasTurnRecordFor(state, pid, FREEZE_RULE, attacker.instanceId)) return null;
  const defender = findField(state, battle.defenderPlayerId, battle.defenderInstanceId);
  if (!defender || !rk1IsSmallNow(state, defender) || !selectableEnemy(state, pid, "XG4-033", defender)) return null;
  const meta: FreezeMeta = { battle: { ...battle, xg4FreezeOffered: true }, wingAttackFromRush };
  return {
    ...openEffectChoice(state, {
      ...base({ playerId: pid, phasePlayerId: battle.phasePlayerId, sourceInstanceId: attacker.instanceId }, "XG4-033"),
      effectId: FREEZE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [defender.instanceId],
      selectCount: 1,
      optional: true,
      xg4Meta: meta as unknown as Record<string, unknown>,
    }),
    activePlayer: pid,
  };
}

export function isXg4BeforeBattleChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === FREEZE_EFFECT_ID && !!pending.xg4Meta?.battle;
}

/** 送った。バトル相手を持ち主のパワーゾーンに送り、バトルを行わないアタックとして続ける。 */
export function resolveXg4BeforeBattle(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | { error: string } {
  const pending = state.pendingEffectChoice;
  if (!pending || !isXg4BeforeBattleChoice(pending) || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const meta = pending.xg4Meta as unknown as FreezeMeta;
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId };
  next = moveFieldUnit(next, meta.battle.defenderPlayerId, instanceId, meta.battle.phasePlayerId, "power");
  next = { ...next, log: [...next.log, logFor(state, playerId, "XG4-033", `${FREEZE_EFFECT_ID}:${instanceId}`)] };
  return { state: next, battle: { ...meta.battle, battleCancelled: true }, wingAttackFromRush: meta.wingAttackFromRush };
}

/** 送らなかった。そのまま続けるアタックを返す。 */
export function skipXg4BeforeBattle(state: GameState, playerId: PlayerId): { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean } | null {
  const pending = state.pendingEffectChoice;
  if (!pending || !isXg4BeforeBattleChoice(pending) || pending.playerId !== playerId) return null;
  const meta = pending.xg4Meta as unknown as FreezeMeta;
  const next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: meta.battle.phasePlayerId, log: [...state.log, logFor(state, playerId, "XG4-033", `${FREEZE_EFFECT_ID}:skip`)] };
  return { state: next, battle: meta.battle, wingAttackFromRush: meta.wingAttackFromRush };
}

// ---------------------------------------------------------------------------
// XG4-035 シンケンゴールド【モヂカラのプログラム】（起動。rules/fieldActivatedAbilities.ts）
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、 ETを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、自軍山札の上から1枚をオモテにし、
//  オモテにしたカードが「特徴」を持つMAのカードなら手札に加え、それ以外なら山札の上か下に戻す。」（atwiki/page-2044）
// 回数の制限はない（コマンドを払えるかぎり。RM-038 と同じ）。「特徴」を持つは印刷の特徴が1つ以上。MA はカテゴリに MA を持つ（マルチカテゴリを含む）。

const PROGRAM_HOLD_EFFECT_ID = "xg4035_program_hold";
const PROGRAM_PLACE_EFFECT_ID = "xg4035_program_place";
export const XG4_DECK_TOP = "deck_top";
export const XG4_DECK_BOTTOM = "deck_bottom";

function releasedEt(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return p.command.filter((c) => !c.commandHeld && (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes("ET")).map((c) => c.instanceId);
}

export function isXg4bFieldAbilityCard(cardId: string): boolean {
  return isCard(cardId, "XG4-035");
}

export function canActivateXg4bFieldAbility(state: GameState, playerId: PlayerId, _card: CardInstance): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  return releasedEt(state, playerId).length > 0;
}

function programReveal(state: GameState, ctx: BaseCtx, resume?: PendingEffectChoice): GameState {
  const pid = ctx.playerId;
  const top = state.players[pid].deck[0];
  if (!top) return state;
  const def = getDefinition(state.definitions, top.cardId);
  const hit = !!def && (cardCategories(def) as string[]).includes("MA") && (def.features ?? []).length > 0;
  let next = recordReveal(state, { playerId: pid, ownerId: pid, sourceCardId: "XG4-035", effectLabel: "モヂカラのプログラム", from: "deck_top", cards: revealedCards([top], hit ? "hand" : "stay") });
  if (hit) return patchPlayer(next, pid, (p) => ({ ...p, deck: p.deck.slice(1), hand: [...p.hand, top] }));
  const choice: PendingEffectChoice = { ...base(ctx, "XG4-035"), effectId: PROGRAM_PLACE_EFFECT_ID, kind: "confirm", validInstanceIds: [XG4_DECK_TOP, XG4_DECK_BOTTOM], selectCount: 1, optional: false, xg4Meta: { top: top.instanceId } };
  next = resume ? openNext(next, resume, choice) : openAfter(next, choice);
  return next;
}

export function activateXg4bFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ctx: BaseCtx = { playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId };
  const ids = releasedEt(state, playerId);
  if (ids.length === 0) return state;
  if (ids.length === 1) {
    const held = patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === ids[0] ? { ...c, commandHeld: true } : c)) }));
    return programReveal(held, ctx);
  }
  return openEffectChoice(state, { ...base(ctx, "XG4-035"), effectId: PROGRAM_HOLD_EFFECT_ID, kind: "select_command", validInstanceIds: ids, selectCount: 1, optional: false });
}

XG4_RESOLVERS[PROGRAM_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
  next = programReveal(next, pendingBase(pending), pending);
  return { state: next.pendingEffectChoice ? next : proceed(next, pending), log: logFor(state, playerId, "XG4-035", `${PROGRAM_HOLD_EFFECT_ID}:${instanceId}`) };
};

XG4_RESOLVERS[PROGRAM_PLACE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const topId = pending.xg4Meta?.top as string | undefined;
  let next = close(state, pending);
  if (mode === XG4_DECK_BOTTOM && topId) {
    next = patchPlayer(next, playerId, (p) => {
      const card = p.deck.find((c) => c.instanceId === topId);
      return card ? { ...p, deck: [...p.deck.filter((c) => c.instanceId !== topId), card] } : p;
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-035", `${PROGRAM_PLACE_EFFECT_ID}:${mode}`) };
};

// ---------------------------------------------------------------------------
// XG4-037 牛折神【荒ぶる折神】（ラッシュしたとき）
// 「お互いのダメージの点数が違うなら、少ない方は自分自身のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2090）
// 選ぶのは少ない方のプレイヤー（強制）。自分自身のユニットはエリア・サイズを問わない（これ自身を含む）。※の「可能ならバトルエリアに置く」は DSL の unnamedRules。

const ARABURU_EFFECT_ID = "xg4037_araburu";

XG4_KEYWORDS["XG4-037::araburu"] = (state, ctx) => {
  const me = ctx.playerId;
  const enemyId = opponent(me);
  const mine = state.players[me].damage ?? 0;
  const theirs = state.players[enemyId].damage ?? 0;
  if (mine === theirs) return { state, detail: "xg4037:even" };
  const chooser = mine < theirs ? me : enemyId;
  const ids = fieldUnits(state, chooser).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4037:no_units" };
  return {
    state: openAfter(state, damagePick({ playerId: chooser, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG4-037", ARABURU_EFFECT_ID, ids)),
    detail: ARABURU_EFFECT_ID,
  };
};
registerDamagePick(ARABURU_EFFECT_ID, "XG4-037");

// ---------------------------------------------------------------------------
// XG4-038 モウギュウダイオー【猛牛大回転砲】（自軍ターン中、バトルエリアに出たとき・任意）
// 「必要パワーの数字が2以下の敵軍Sユニットすべてを、持ち主の山札の下に好きな順で戻す。」（atwiki/page-2147）。エリアを問わない。数字は「+」「-」を除く。
// 2体以上なら、番号を付けて山札の下の順を選ぶ（rules/deckOrder.ts。持ち主ごとの山札へ）。

const MOUGYUU_EFFECT_ID = "xg4038_mougyuu_confirm";

// 「次の効果を発動できる」— 発動するかを確認してから戻す（DSL の optional は出たときの確認を開かないので、ここで開く）。
XG4_KEYWORDS["XG4-038::mougyuu"] = (state, ctx) => {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "xg4038:not_own_turn" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG4-038", MOUGYUU_EFFECT_ID)), detail: MOUGYUU_EFFECT_ID };
};

XG4_RESOLVERS[MOUGYUU_EFFECT_ID] = () => ({ error: "invalid_target" });
XG4_SKIPPERS[MOUGYUU_EFFECT_ID] = simpleSkip();
XG4_CONFIRMERS[MOUGYUU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return rk1IsSmallNow(state, c) && Number.isFinite(n) && n <= 2 && selectableEnemy(state, playerId, "XG4-038", c);
    })
    .map((c) => c.instanceId);
  let next = close(state, pending);
  for (const id of ids) next = moveFieldUnit(next, enemyId, id, pending.phasePlayerId, "deck_bottom");
  return { state: returnToDeckInOrder(next, pending, ids), log: logFor(state, playerId, "XG4-038", `xg4038:${ids.length}`) };
};

// ---------------------------------------------------------------------------
// XG4-039 サムライハオー【モヂカラ大弾円】（自分がターンを終えるとき）
// 「これが自軍エリアにある間、自分がターンを終えるとき、敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2125）
// 強制。エリア・サイズを問わない。※の合体の素材は rules/xg4/xg4Fields.ts。

const DANEN_EFFECT_ID = "xg4039_mojikara_danen";
registerDamagePick(DANEN_EFFECT_ID, "XG4-039");

// ---------------------------------------------------------------------------
// XG4-040 ゴセイグレート【天装合体】（ラッシュしたとき）
// 「ウイングを持たない敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2107）。エリア・サイズを問わない。強制。

const TENSOU_EFFECT_ID = "xg4040_tensou";

XG4_KEYWORDS["XG4-040::tensou"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !cardHasKeyword(state.definitions, c.cardId, "wing", { state, playerId: enemyId }) && selectableEnemy(state, ctx.playerId, "XG4-040", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg4040:no_targets" };
  return { state: openAfter(state, damagePick(ctxBase(ctx), "XG4-040", TENSOU_EFFECT_ID, ids)), detail: TENSOU_EFFECT_ID };
};
registerDamagePick(TENSOU_EFFECT_ID, "XG4-040");

// ---------------------------------------------------------------------------
// XG4-041 ゴセイイエロー【ソウテンダー】（NC）
// 「自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。」（atwiki/page-2047）。強制。

const SOUTEN_EFFECT_ID = "xg4041_soutender";

XG4_KEYWORDS["XG4-041::soutender"] = (state, ctx) => {
  const pid = ctx.playerId;
  const next = patchPlayer(state, pid, (p) => performDeckDraws(p, 1, "top"));
  const ids = next.players[pid].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "xg4041:no_hand" };
  return {
    state: openAfter(next, { ...base(ctxBase(ctx), "XG4-041"), effectId: SOUTEN_EFFECT_ID, kind: "select_hand", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: SOUTEN_EFFECT_ID,
  };
};

XG4_RESOLVERS[SOUTEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    return card ? { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, card] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG4-041", `${SOUTEN_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// ほかの処理の場所から呼ぶ起点

/** バトルで敵軍ユニットを撃破したとき（rules/operationCounters.ts）。 */
export function xg4bOnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  if (winnerId === defeatedOwnerId) return state;
  const winner = findField(state, winnerId, winnerInstanceId);
  if (!winner || !isCard(winner.cardId, "XG4-032")) return state;
  const fromRush = state.players[winnerId].rush.some((c) => c.instanceId === winnerInstanceId);
  if (!fromRush && !hasTurnRecordFor(state, winnerId, DAGGER_RULE, winnerInstanceId)) return state;
  const owner = state.players[defeatedOwnerId];
  const defeated = [...owner.discard, ...owner.power, ...owner.command, ...owner.battle, ...owner.rush, ...owner.hand].find((c) => c.instanceId === defeatedInstanceId);
  const defDef = defeated ? getDefinition(state.definitions, defeated.cardId) : undefined;
  if (!defDef) return state;
  const cats = cardCategories(defDef) as string[];
  const ids = owner.power
    .filter((c) => {
      if (c.faceDown) return false;
      const d = getDefinition(state.definitions, c.cardId);
      return !!d && (cardCategories(d) as string[]).some((x) => cats.includes(x));
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, { ...base({ playerId: winnerId, phasePlayerId: state.activePlayer, sourceInstanceId: winnerInstanceId }, "XG4-032"), effectId: DAGGER_EFFECT_ID, kind: "select_power", validInstanceIds: ids, selectCount: 1, optional: true });
}

/** ライドオフしたとき（rider はライドオフ後のユニット）。XG4-025「（この効果は、ライドオフしたときナンバーに関係なく発動する）」。 */
export function applyXg4bRideOff(state: GameState, playerId: PlayerId, rider: CardInstance): GameState {
  if (!isCard(rider.cardId, "XG4-025")) return state;
  return sonicHammer(state, { playerId, phasePlayerId: state.activePlayer, sourceInstanceId: rider.instanceId }, true);
}

/** applyAction の後処理（depth 0）。 */
export function applyXg4bAfterAction(before: GameState, after: GameState): GameState {
  let next = ninjaMisen(before, after);
  next = magicCarpet(before, next);
  return next;
}

/** 「自分がターンを終えるとき」の選択の列（rules/turnEndingEffects.ts）。 */
export function collectXg4bTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const p = state.players[endingPlayerId];
  const queue: string[] = [];
  const declared = getRocketBoosterDeclaredName(state, endingPlayerId);
  if (declared) {
    for (const c of p.rush) {
      if (isUnit(state, c.cardId) && isSmallUnit(state.definitions, c) && cardName(state.definitions, c.cardId) === declared) queue.push(`rocket:${c.instanceId}`);
    }
  }
  for (const c of [...p.battle, ...p.rush]) if (isCard(c.cardId, "XG4-039")) queue.push(`danen:${c.instanceId}`);
  return queue;
}

export function openXg4bTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  const ctx: BaseCtx = { playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId };
  if (kind === "rocket") {
    if (!state.players[endingPlayerId].rush.some((c) => c.instanceId === instanceId)) return state;
    return openEffectChoice(state, { ...base(ctx, "XG4-031"), effectId: ROCKET_RETURN_EFFECT_ID, kind: "select_unit", validInstanceIds: [instanceId], selectCount: 1, optional: true });
  }
  if (kind === "danen") {
    if (!findField(state, endingPlayerId, instanceId)) return state;
    const enemyId = opponent(endingPlayerId);
    const ids = fieldUnits(state, enemyId).filter((c) => selectableEnemy(state, endingPlayerId, "XG4-039", c)).map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openEffectChoice(state, damagePick(ctx, "XG4-039", DANEN_EFFECT_ID, ids));
  }
  return state;
}

// ---------------------------------------------------------------------------
// 登録

XG4_KEYWORDS["XG4-022::ninjamisen"] = noop("xg4022:resident");
XG4_KEYWORDS["XG4-027::magic_carpet"] = noop("xg4027:resident");
XG4_KEYWORDS["XG4-034::kaze"] = noop("xg4034:resident");
XG4_KEYWORDS["XG4-035::program"] = noop("xg4035:activated");
XG4_KEYWORDS["XG4-039::danen"] = noop("xg4039:turn_end");

export type { GrantKeywordContext };
