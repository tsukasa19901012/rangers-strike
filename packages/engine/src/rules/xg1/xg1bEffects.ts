/**
 * クロスギャザー ザ・ファーストエンカウント XG1-021〜XG1-040（ブルーターボ〜虎折神）のカード固有の効果（cardSpec XG1-021-040 の監査）。
 *
 * - DSL の `xg1::XG1-NNN::name` から呼ばれる効果（NC・ラッシュしたとき）。
 * - `xg1bOnAttackDeclared`: XG1-030【キラークロー】（ウイングでアタックするとき。core/applyAction.ts の attack）。
 * 継続効果（XG1-021 のアタック先・XG1-026 の SP・XG1-031 の手札のカテゴリ・XG1-033 の DA）は rules/xg1/xg1Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { drawOne, opponent } from "../../core/helpers";
import { effectiveBp, effectiveCommandCategories, getDefinition, unitSizeOf } from "../../core/catalog";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { unitFeatures } from "../addedFeatures";
import { patchPlayer } from "../playerPatches";
import { openEffectChoice } from "../pendingChoices";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { xg1HasSamuraiGrant } from "./xg1Fields";
import { grantSp1ToRushUnit } from "../srEffects";
import {
  type BaseCtx,
  base,
  close,
  ctxBase,
  destroyAll,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";
import { XG1_KEYWORDS, XG1_RESOLVERS, XG1_SKIPPERS, noop } from "./xg1Core";
import { commandHasRoom, costNumber, enemySUnits, unitCatsNow } from "./xg1Shared";

function pickOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function confirmOptions(ctx: BaseCtx, sourceCardId: string, effectId: string, options: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: options, selectCount: 1, optional, ...extra };
}

function numericComboNumber(state: GameState, cardId: string): number | null {
  const n = (getDefinition(state.definitions, cardId) as { comboNumber?: number | string } | undefined)?.comboNumber;
  if (typeof n === "number") return n;
  if (typeof n === "string" && /^\d+$/.test(n)) return Number(n);
  return null;
}

// ---------------------------------------------------------------------------
// XG1-021 ブルーターボ【Jガン】（アタック先。rules/xg1/xg1Fields.ts xg1AttackerCanAttackRush）。

XG1_KEYWORDS["XG1-021::j_gun"] = noop("xg1_021:attack_held_rush");

// ---------------------------------------------------------------------------
// XG1-022 ピンクターボ【Wステッキ】（NC）
// 「敵軍コマンドが5つあれば、自分は1枚ドローしてもよい。敵軍コマンドが4つ以下なら、敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンに
//  ホールド状態で置いてもよい。」（atwiki/page-1575）。コマンドの数はホールド・リリースを問わない枚数。

const W_STICK_DRAW_EFFECT_ID = "xg1_022_w_stick_draw";
const W_STICK_PICK_EFFECT_ID = "xg1_022_w_stick_pick";

XG1_KEYWORDS["XG1-022::w_stick"] = (state, ctx) => {
  const enemy = state.players[opponent(ctx.playerId)];
  if (enemy.command.length >= 5) {
    return { state: openAfter(state, confirmOptions(ctxBase(ctx), "XG1-022", W_STICK_DRAW_EFFECT_ID, ["draw"], true)), detail: W_STICK_DRAW_EFFECT_ID };
  }
  const ids = enemy.discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_022:no_discard" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-022", W_STICK_PICK_EFFECT_ID, ids, true)), detail: W_STICK_PICK_EFFECT_ID };
};

XG1_RESOLVERS[W_STICK_DRAW_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, drawOne);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-022", `${W_STICK_DRAW_EFFECT_ID}:draw`) };
};
XG1_SKIPPERS[W_STICK_DRAW_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[W_STICK_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = close(state, pending);
  if (commandHasRoom(next, enemyId)) {
    next = patchPlayer(next, enemyId, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      command: [...p.command, { ...stripForZone(card), commandHeld: true }],
    }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-022", `${W_STICK_PICK_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[W_STICK_PICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-023 レッドターボ【GTソード】（NC）
// 「「SP1」敵軍バトルエリアからBP4000以上のSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ、持ち主のパワーゾーンに
//  ダメージにして置く。」（atwiki/page-1660）。BP はいまの BP。見送れない。

const GT_SWORD_EFFECT_ID = "xg1_023_gt_sword";

XG1_KEYWORDS["XG1-023::gt_sword"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => unitSizeOf(state.definitions, c) === "S" && effectiveBp(state, enemyId, c) >= 4000 && selectableEnemy(state, ctx.playerId, "XG1-023", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_023:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-023", GT_SWORD_EFFECT_ID, ids, false)), detail: GT_SWORD_EFFECT_ID };
};

XG1_RESOLVERS[GT_SWORD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  next = moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, commandHasRoom(next, enemyId) ? "command_held" : "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-023", `${GT_SWORD_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-024 イエローターボ【Bボーガン】（NC）
// 「敵軍コマンドゾーンからホールド状態のカードを1枚選び、持ち主のパワーゾーンに送るか、持ち主の手札に戻してもよい。」（atwiki/page-1576）
// 候補はホールド状態のカードすべて（ユニットに限らない）。選んだカードはまず持ち主の手札に戻し、続けて「パワーゾーンに送る」を選べばパワーゾーン
// （オモテ向き）に移す（見送れば手札のまま）。

const B_BOWGUN_EFFECT_ID = "xg1_024_b_bowgun";
const B_BOWGUN_DEST_EFFECT_ID = "xg1_024_b_bowgun_destination";

XG1_KEYWORDS["XG1-024::b_bowgun"] = (state, ctx) => {
  const ids = state.players[opponent(ctx.playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_024:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-024", B_BOWGUN_EFFECT_ID, ids, true, { kind: "select_command" })), detail: B_BOWGUN_EFFECT_ID };
};

XG1_RESOLVERS[B_BOWGUN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const moved = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, stripForZone(card)],
  }));
  const next = openNext(moved, pending, confirmOptions(pendingCtx(pending), "XG1-024", B_BOWGUN_DEST_EFFECT_ID, ["power"], true, { selectedInstanceIds: [instanceId] }));
  return { state: next, log: logFor(state, playerId, "XG1-024", `${B_BOWGUN_EFFECT_ID}:${instanceId}:hand`) };
};
XG1_SKIPPERS[B_BOWGUN_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[B_BOWGUN_DEST_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const id = pending.selectedInstanceIds?.[0];
  const card = state.players[enemyId].hand.find((c) => c.instanceId === id);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, enemyId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== id), power: [...p.power, stripForZone(card)] }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-024", `${B_BOWGUN_DEST_EFFECT_ID}:power`) };
};
XG1_SKIPPERS[B_BOWGUN_DEST_EFFECT_ID] = simpleSkip();

function pendingCtx(pending: PendingEffectChoice): BaseCtx {
  return { playerId: pending.playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
}

// ---------------------------------------------------------------------------
// XG1-026 ヤミマル【ヤミオノ】（SP。rules/xg1/xg1Fields.ts xg1EffectiveSp）。

XG1_KEYWORDS["XG1-026::yamiono"] = noop("xg1_026:sp_by_damage");

// ---------------------------------------------------------------------------
// XG1-030 アバレキラーAM【キラークロー】
// 「「SP1」このターン、これはBP+2000される。（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）」（atwiki/page-1666）
// NC の発動は DSL（SP1・modify_bp）。ウイングでラッシュエリアからアタックするときは、アタックの宣言で同じ効果を与える。

/** アタックの宣言（core/applyAction.ts の attack。ウイングかどうかと合わせて呼ぶ）。 */
export function xg1bOnAttackDeclared(state: GameState, playerId: PlayerId, attackerInstanceId: string, wingAttackFromRush: boolean): GameState {
  if (!wingAttackFromRush) return state;
  const card = state.players[playerId].rush.find((c) => c.instanceId === attackerInstanceId);
  if (!card || !isSameCardIdentity(card.cardId, "XG1-030")) return state;
  const boosted = patchPlayer(state, playerId, (p) => ({
    ...p,
    rush: p.rush.map((c) => (c.instanceId === attackerInstanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + 2000 } : c)),
  }));
  const next = grantSp1ToRushUnit(boosted, playerId, attackerInstanceId);
  return { ...next, log: [...next.log, logFor(next, playerId, "XG1-030", "xg1_030_killer_claw:wing")] };
}

// ---------------------------------------------------------------------------
// XG1-031 ゴーオンレッド【ドルドル弾】（NC）
// 「自軍ラッシュエリアから、特徴「炎神」を持ち、ナンバーに数字を持つMユニットを1体選び手札に戻してもよい。そうしたとき、戻したユニットのナンバーの
//  数字を見て、その数字以下の必要パワーの数字を持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-1638）
// ※（手札の炎神に WB）は rules/xg1/xg1Fields.ts xg1HandCardAddedCategories。

const DORUDORU_EFFECT_ID = "xg1_031_dorudoru";
const DORUDORU_TARGET_EFFECT_ID = "xg1_031_dorudoru_target";

XG1_KEYWORDS["XG1-031::dorudoru"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].rush
    .filter((c) => unitSizeOf(state.definitions, c) === "M" && unitFeatures(state, ctx.playerId, c).includes("炎神") && numericComboNumber(state, c.cardId) !== null)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_031:no_engine" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-031", DORUDORU_EFFECT_ID, ids, true)), detail: DORUDORU_EFFECT_ID };
};

XG1_RESOLVERS[DORUDORU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = findField(state, playerId, instanceId);
  if (!card) return { error: "invalid_target" };
  const n = numericComboNumber(state, card.cardId) ?? 0;
  const returned = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "hand");
  const ids = enemySUnits(returned, playerId, "XG1-031", (c) => costNumber(returned, c.cardId) <= n);
  const log = logFor(state, playerId, "XG1-031", `${DORUDORU_EFFECT_ID}:${instanceId}:${n}`);
  if (ids.length === 0) return { state: proceed(returned, pending), log };
  return { state: openNext(returned, pending, pickOne(pendingCtx(pending), "XG1-031", DORUDORU_TARGET_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[DORUDORU_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[DORUDORU_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-031", `${DORUDORU_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-032 ゲキレッド【咆咆弾】（NC）
// 「「SP1」自軍ラッシュエリアから、特徴「激気」を持つMユニットを1体選び手札に戻してもよい。そうしたとき、戻したユニットのBP以下のBPを持つユニットを、
//  敵軍バトルエリアから1体選び撃破する。」（atwiki/page-1640）。戻したユニットの BP は戻す前（ラッシュエリア）の BP。撃破は強制。

const HOHO_EFFECT_ID = "xg1_032_hoho_dan";
const HOHO_TARGET_EFFECT_ID = "xg1_032_hoho_dan_target";

XG1_KEYWORDS["XG1-032::hoho_dan"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].rush
    .filter((c) => unitSizeOf(state.definitions, c) === "M" && unitFeatures(state, ctx.playerId, c).includes("激気"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_032:no_geki" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-032", HOHO_EFFECT_ID, ids, true)), detail: HOHO_EFFECT_ID };
};

XG1_RESOLVERS[HOHO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = findField(state, playerId, instanceId);
  if (!card) return { error: "invalid_target" };
  const bp = effectiveBp(state, playerId, card);
  const returned = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "hand");
  const enemyId = opponent(playerId);
  const ids = returned.players[enemyId].battle
    .filter((c) => effectiveBp(returned, enemyId, c) <= bp && selectableEnemy(returned, playerId, "XG1-032", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG1-032", `${HOHO_EFFECT_ID}:${instanceId}:${bp}`);
  if (ids.length === 0) return { state: proceed(returned, pending), log };
  return { state: openNext(returned, pending, pickOne(pendingCtx(pending), "XG1-032", HOHO_TARGET_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[HOHO_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[HOHO_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingCtx(pending), "XG1-032", `${HOHO_TARGET_EFFECT_ID}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-032", `${HOHO_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-033【汚れた大地】（コマンドのカテゴリ。rules/xg1/xg1Fields.ts・core/catalog.ts effectiveCommandCategories）。


// ---------------------------------------------------------------------------
// XG1-035 兜折神 ※「これをラッシュしたとき、DAを持つSユニットを1体選び撃破する。」（atwiki/page-1591）
// 自軍・敵軍、エリアを問わない。見送れない。【侍武装】で得る能力（敵軍ラッシュエリアへのアタック）は rules/xg1/xg1Fields.ts。

const KABUTO_EFFECT_ID = "xg1_035_kabuto_on_rush";

XG1_KEYWORDS["XG1-035::on_rush"] = (state, ctx) => {
  const ids: string[] = [];
  for (const owner of [ctx.playerId, opponent(ctx.playerId)]) {
    for (const c of [...state.players[owner].rush, ...state.players[owner].battle]) {
      if (c.instanceId === ctx.triggerSourceInstanceId || !rk1IsSmallNow(state, c) || !unitCatsNow(state, owner, c).includes("DA")) continue;
      if (owner !== ctx.playerId && !selectableEnemy(state, ctx.playerId, "XG1-035", c)) continue;
      ids.push(c.instanceId);
    }
  }
  if (ids.length === 0) return { state, detail: "xg1_035:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-035", KABUTO_EFFECT_ID, ids, false)), detail: KABUTO_EFFECT_ID };
};

XG1_RESOLVERS[KABUTO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingCtx(pending), "XG1-035", `${KABUTO_EFFECT_ID}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-035", `${KABUTO_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-036 舵木折神 ※「これをラッシュしたとき、Sユニットをすべてリリースする。」（atwiki/page-1592）— 自軍・敵軍の場のホールド状態の S ユニット。
// 【侍武装】で得る「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍コマンドを1つ選び、持ち主のパワーゾーンに
// ダメージにして置く。」は xg1bOnEnterBattle（rules/combo.ts の出たときの処理）。

XG1_KEYWORDS["XG1-036::on_rush"] = (state) => {
  let next = state;
  for (const owner of ["player1", "player2"] as const) {
    next = patchPlayer(next, owner, (p) => {
      const rel = (cards: CardInstance[]) => cards.map((c) => (c.commandHeld && rk1IsSmallNow(state, c) ? { ...c, commandHeld: false } : c));
      return { ...p, rush: rel(p.rush), battle: rel(p.battle) };
    });
  }
  return { state: next, detail: "xg1_036:release_all_s_units" };
};

const KAJIKI_HOLD_EFFECT_ID = "xg1_036_kajiki_hold";
const KAJIKI_COMMAND_EFFECT_ID = "xg1_036_kajiki_command";

/** 自軍ユニットがバトルエリアに出たとき（rules/combo.ts）。 */
export function xg1bOnEnterBattle(state: GameState, playerId: PlayerId, entered: CardInstance): GameState {
  if (state.pendingEffectChoice || state.activePlayer !== playerId) return state;
  const host = state.players[playerId].battle.find((c) => c.instanceId === entered.instanceId);
  if (!host || host.commandHeld || !xg1HasSamuraiGrant(state, playerId, host, "XG1-036")) return state;
  return openEffectChoice(
    state,
    confirmOptions({ playerId, phasePlayerId: playerId, sourceInstanceId: host.instanceId }, "XG1-036", KAJIKI_HOLD_EFFECT_ID, ["hold"], true, { selectedInstanceIds: [host.instanceId] }),
  );
}

XG1_RESOLVERS[KAJIKI_HOLD_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const hostId = pending.selectedInstanceIds?.[0];
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, battle: p.battle.map((c) => (c.instanceId === hostId ? { ...c, commandHeld: true } : c)) }));
  const ids = next.players[opponent(playerId)].command.map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG1-036", `${KAJIKI_HOLD_EFFECT_ID}:${hostId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, pickOne(pendingCtx(pending), "XG1-036", KAJIKI_COMMAND_EFFECT_ID, ids, false, { kind: "select_command" }));
  return { state: next, log };
};
XG1_SKIPPERS[KAJIKI_HOLD_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[KAJIKI_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    power: [...p.power, { ...stripForZone(card), faceDown: true }],
    damage: p.damage + 1,
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-036", `${KAJIKI_COMMAND_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-037 ダイテンクウ【虚空からの一撃】
// 「これがウイングでアタックした敵軍ユニットが、撃破されて捨札になったとき、そのユニットカードを持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1641）
// バトルの解決の後（rules/xg1/xg1aEffects.ts xg1aAfterBattle から呼ぶ）。

export function xg1bAfterBattle(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderOwner: PlayerId,
  defender: CardInstance,
  defenderDestroyed: boolean,
): ((s: GameState) => GameState) | undefined {
  if (!defenderDestroyed || !isSameCardIdentity(attacker.cardId, "XG1-037") || attackerPlayerId === defenderOwner) return undefined;
  if (!state.players[attackerPlayerId].rush.some((c) => c.instanceId === attacker.instanceId)) return undefined;
  return (s) => {
    const card = s.players[defenderOwner].discard.find((c) => c.instanceId === defender.instanceId);
    if (!card) return s;
    const next = patchPlayer(s, defenderOwner, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== defender.instanceId),
      power: [...p.power, { ...stripForZone(card), faceDown: true }],
      damage: p.damage + 1,
    }));
    return { ...next, log: [...next.log, logFor(next, attackerPlayerId, "XG1-037", `xg1_037_kokuu:${defender.instanceId}`)] };
  };
}

// ---------------------------------------------------------------------------
// XG1-038 シンケンゴールド【サカナマル】
// 「これが自軍ラッシュエリアにある間、敵軍バトルフェイズ中、相手が自分自身のSユニットをバトルエリアに出すために選んだとき、これを自軍バトルエリアに
//  出してもよい。そうしたとき、自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。このとき、捨札にしたカードと相手の選んだユニットの特徴を
//  比べて、同じ特徴が2つ以上あれば、そのユニットを持ち主のパワーゾーンにダメージにして置き、1つだけならそのユニットを撃破する。」（atwiki/page-1634）
// 相手の move_to_battle の前に尋ねる（core/applyAction.ts）。選んだユニットを選ぶ効果ではない（Q1）ので「選ばれない」ユニットにも働く。
// 効果の後、相手のユニットがまだラッシュエリアにあれば、その move_to_battle を続ける（GameState.xg1ResumeMove）。

const SAKANAMARU_EFFECT_ID = "xg1_038_sakanamaru";
const SAKANAMARU_DISCARD_EFFECT_ID = "xg1_038_sakanamaru_discard";

type MoveRef = NonNullable<GameState["xg1ResumeMove"]>;

/** 相手の S ユニットがバトルエリアに出る前に【サカナマル】を尋ねる。尋ねないなら null。 */
export function openXg1bSakanamaru(state: GameState, move: MoveRef): GameState | null {
  if (state.phase !== "battle" || state.activePlayer !== move.playerId || state.pendingEffectChoice) return null;
  if (state.xg1SakanamaruDone === move.instanceId) return null;
  const unit = state.players[move.playerId].rush.find((c) => c.instanceId === move.instanceId);
  if (!unit || !rk1IsSmallNow(state, unit)) return null;
  const ownerId = opponent(move.playerId);
  const gold = state.players[ownerId].rush.find((c) => isSameCardIdentity(c.cardId, "XG1-038"));
  if (!gold) return null;
  const choice = confirmOptions({ playerId: ownerId, phasePlayerId: move.playerId, sourceInstanceId: gold.instanceId }, "XG1-038", SAKANAMARU_EFFECT_ID, ["accept"], true, {
    selectedInstanceIds: [move.instanceId],
    xg1Meta: { target: move.instanceId, ownerId: move.playerId },
  });
  return { ...openEffectChoice(state, choice), xg1ResumeMove: move, xg1SakanamaruDone: move.instanceId };
}

XG1_RESOLVERS[SAKANAMARU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const goldId = pending.sourceInstanceId;
  const gold = state.players[playerId].rush.find((c) => c.instanceId === goldId);
  let next = close(state, pending);
  if (gold) {
    next = patchPlayer(next, playerId, (p) => drawOne({ ...p, rush: p.rush.filter((c) => c.instanceId !== goldId), battle: [...p.battle, stripForZone(gold)] }));
  }
  const ids = next.players[playerId].hand.map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG1-038", `${SAKANAMARU_EFFECT_ID}:enter`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, pickOne(pendingCtx(pending), "XG1-038", SAKANAMARU_DISCARD_EFFECT_ID, ids, false, { kind: "select_hand", xg1Meta: pending.xg1Meta })), log };
};
XG1_SKIPPERS[SAKANAMARU_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[SAKANAMARU_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  const enemyId = pending.xg1Meta?.ownerId ?? opponent(playerId);
  const targetId = pending.xg1Meta?.target;
  const target = targetId ? findField(next, enemyId, targetId) : undefined;
  let detail = "none";
  if (target) {
    const discarded = new Set(getDefinition(next.definitions, card.cardId)?.features ?? []);
    const shared = new Set(unitFeatures(next, enemyId, target).filter((f) => discarded.has(f))).size;
    if (shared >= 2) {
      next = moveFieldUnit(next, enemyId, target.instanceId, pending.phasePlayerId, "power_damage");
      detail = "damage";
    } else if (shared === 1) {
      next = destroyAll(next, pendingCtx(pending), "XG1-038", `${SAKANAMARU_DISCARD_EFFECT_ID}_destroy`, [target.instanceId]);
      detail = "destroy";
    }
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-038", `${SAKANAMARU_DISCARD_EFFECT_ID}:${instanceId}:${detail}`) };
};

// ---------------------------------------------------------------------------
// XG1-040 虎折神 ※「これをラッシュしたとき、MAを持たないコマンドをすべてリリースする。」（atwiki/page-1593）— 自軍・敵軍のコマンド。
// 【侍武装】の BP は rules/xg1/xg1Fields.ts xg1SamuraiBpBonus。

XG1_KEYWORDS["XG1-040::on_rush"] = (state) => {
  let next = state;
  for (const owner of ["player1", "player2"] as const) {
    next = patchPlayer(next, owner, (p) => ({
      ...p,
      command: p.command.map((c) => (c.commandHeld && !(effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes("MA") ? { ...c, commandHeld: false } : c)),
    }));
  }
  return { state: next, detail: "xg1_040:release_non_ma_commands" };
};
