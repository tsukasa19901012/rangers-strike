/**
 * クロスギャザー XG5 XG5-001〜XG5-020（ゴーグルレッド〜ボウケンレッド）のカード固有の効果（cardSpec XG5-001-020 の監査）。
 * 登録先は rules/xg5/xg5Core.ts（DSL の `xg5::cardId::name`・選択・後処理）。継続効果の判定は rules/xg5/xg5Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingStrike, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { effectiveBp, getDefinition } from "../../core/catalog";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { listDslEffectsForTrigger } from "../../dsl/effectLookup";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { resolveNamedOnRushEffects } from "../namedUnitEffects";
import { patchPlayer } from "../playerPatches";
import { finalizeEffectRush, markFieldEntryHandled } from "../../events/emitUnitRushed";
import { filterEffectRushCandidates, startEffectRush } from "../effectRush";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { applyDamageToPlayer } from "../damagePayment";
import { requestDrawFromDeck } from "../drawFromDeck";
import { countAvailablePower } from "../../core/power";
import { requiresAllFusionPartners } from "../zord";
import { turnPlayerOf } from "../legend1/set6NamedEffectsB";
import {
  type BaseCtx,
  close,
  confirmChoice,
  ctxBase,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  pendingBase,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";
import { AFTER_ACTION_HOOKS, CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, HAND_ACTIVATIONS, STRIKE_RESOLVED_HOOKS, WATCH_HANDLERS, XG5_KEYWORDS, noop } from "./xg5Core";
import { printedCostNumber, xg5CostNumber } from "./xg5Fields";
import {
  addBp,
  addFlag,
  addWatch,
  cmdHeldPut,
  defOf,
  fieldCategories,
  isNamed,
  newBattleUnits,
  opp,
  patchXg5,
  printedCategories,
  printedFeatures,
  selectOne,
  sizeOf,
  xg5Busy,
} from "./xg5Shared";

const PLAYERS: PlayerId[] = ["player1", "player2"];

// ---------------------------------------------------------------------------
// XG5-001 ゴーグルレッド【レッドロープ】（NC）
// 「「SP1」これがストライクしたとき、その処理をすべて終えてから、このバトルフェイズを終える。」（atwiki/page-2180）。「SP1」は DSL の SP1。
// ストライクの処理（相手の反応・ダメージ）を終えたら、後処理でバトルフェイズを終える（判断表・質問 Q1 の (a)）。※のスクラムは rules/xg5/xg5Fields.ts。

STRIKE_RESOLVED_HOOKS.push((state: GameState, pending: PendingStrike): GameState => {
  const striker = state.players[pending.strikerPlayerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!striker || !isSameCardIdentity(striker.cardId, "XG5-001")) return state;
  if (!(striker.activatedNcEffects ?? []).includes("redoropu")) return state;
  return patchXg5(state, (x) => ({ ...x, battleEndAdvance: pending.strikerPlayerId }));
});

AFTER_ACTION_HOOKS.push((_before, after, applyAction) => {
  const endingPlayer = after.xg5?.battleEndAdvance;
  if (!endingPlayer || xg5Busy(after) || after.winner) return after;
  const cleared = patchXg5(after, (x) => ({ ...x, battleEndAdvance: undefined }));
  if (cleared.phase !== "battle" || cleared.activePlayer !== endingPlayer) return cleared;
  const r = applyAction(cleared, { type: "end_phase", playerId: endingPlayer });
  return r.ok ? { ...r.state, log: [...r.state.log, logFor(cleared, endingPlayer, "XG5-001", "xg5_001_red_rope:end_battle")] } : cleared;
});

// ---------------------------------------------------------------------------
// XG5-002 ゴーグルブラック【ブラックシャドウ】（NC）
// 「自軍コマンドゾーンから、「ゴーグルブラック」以外の特徴「ブラック」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、
//  追加条件は満たすこと。そうしたとき、これを自軍コマンドゾーンにホールド状態で置く。」（atwiki/page-2274）。
// 効果のラッシュ（必要パワーは問わない・追加条件は満たす）。リリース状態・ホールド状態・サイズを問わない（判断表）。

// 必要パワーが「-」のカード（ゾードダウン。RS-584 ボウケンブラックAT 等）は、追加条件（素材の捨札）を満たして出す（必要パワーは0になる）。

const BLACK_SHADOW = "xg5_002_black_shadow";
function isZordDownCost(state: GameState, cardId: string): boolean {
  return String(defOf(state, cardId)?.powerCost ?? "").endsWith("-");
}
function blackShadowRushable(state: GameState, playerId: PlayerId, instanceId: string, cardId: string): boolean {
  return filterEffectRushCandidates(state, playerId, "command", [instanceId], true, !isZordDownCost(state, cardId)).length > 0;
}
XG5_KEYWORDS["XG5-002::black_shadow"] = (state, ctx) => {
  const pid = ctx.playerId;
  const ids = state.players[pid].command
    .filter(
      (c) =>
        defOf(state, c.cardId)?.type === "unit" &&
        printedFeatures(state, c.cardId).includes("ブラック") &&
        !isNamed(state, c.cardId, "ゴーグルブラック") &&
        blackShadowRushable(state, pid, c.instanceId, c.cardId),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_002:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-002", BLACK_SHADOW, ids, true)), detail: BLACK_SHADOW };
};
CHOICE_RESOLVERS[BLACK_SHADOW] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId)!;
  let next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${BLACK_SHADOW}_rush`,
    sourceCardId: "XG5-002",
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "command",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: true,
    ignorePowerCost: !isZordDownCost(state, card.cardId),
    mandatory: true,
    forced: true,
  });
  next = addWatch(next, { kind: "xg5-002", playerId, phasePlayerId: pending.phasePlayerId, candidates: [instanceId], sourceInstanceId: pending.sourceInstanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-002", `${BLACK_SHADOW}:${instanceId}`) };
};
CHOICE_SKIPPERS[BLACK_SHADOW] = simpleSkip();

WATCH_HANDLERS["xg5-002"] = (state, w, entered) => {
  if (entered.length === 0 || !w.sourceInstanceId) return state;
  if (!findField(state, w.playerId, w.sourceInstanceId)) return state;
  if (state.players[w.playerId].command.length >= COMMAND_ZONE_MAX) return state;
  return sendFieldCardsToCommandHeld(state, w.playerId, [w.sourceInstanceId], w.phasePlayerId);
};

// ---------------------------------------------------------------------------
// XG5-003 ゴーグルブルー【ブルージェットダッシュ】（NC）
// 「このターン、敵軍ユニットの必要パワーの数字は1少なくなる。」（atwiki/page-2185）。自軍の効果が敵軍ユニットの必要パワーの数字を見るとき
// （XG5-004【イエローボール】の「2以下」等）に1少なくする（rules/xg5/xg5Fields.ts xg5CostNumber）。NC の効果そのものは rules/promotedNcEffects.ts。


// ---------------------------------------------------------------------------
// XG5-004 ゴーグルイエロー【イエローボール】（NC）
// 「敵軍ラッシュエリアから、必要パワーの数字が2以下のユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。」
// （atwiki/page-2186）。

const YELLOW_BALL = "xg5_004_yellow_ball";
XG5_KEYWORDS["XG5-004::yellow_ball"] = (state, ctx) => {
  const enemyId = opp(ctx.playerId);
  const ids = state.players[enemyId].rush
    .filter((c) => defOf(state, c.cardId)?.type === "unit" && xg5CostNumber(state, ctx.playerId, enemyId, c.cardId) <= 2 && selectableEnemy(state, ctx.playerId, "XG5-004", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_004:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-004", YELLOW_BALL, ids, true)), detail: YELLOW_BALL };
};
CHOICE_RESOLVERS[YELLOW_BALL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = sendFieldCardsToCommandHeld(close(state, pending), opp(playerId), [instanceId], pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-004", `${YELLOW_BALL}:${instanceId}`) };
};
CHOICE_SKIPPERS[YELLOW_BALL] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-005 ゴーグルピンク ※
// 「これが自軍バトルエリアにある間、敵軍Sユニットがバトルエリアに出たとき、これを自軍コマンドゾーンにホールド状態で置いてもよい。置けなければ
//  手札に加える。」（atwiki/page-2187）。後処理で、新しく敵軍バトルエリアに出た S ユニットを見る。

const PINK = "xg5_005_pink";
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of PLAYERS) {
    const pinks = after.players[pid].battle.filter((c) => isSameCardIdentity(c.cardId, "XG5-005") && before.players[pid].battle.some((b) => b.instanceId === c.instanceId));
    if (pinks.length === 0) continue;
    const entered = newBattleUnits(before, after, opp(pid)).filter((c) => sizeOf(after, c) === "S");
    if (entered.length === 0) continue;
    for (const pink of pinks) {
      next = openAfter(next, confirmChoice({ playerId: pid, phasePlayerId: turnPlayerOf(after), sourceInstanceId: pink.instanceId }, "XG5-005", PINK));
    }
  }
  return next;
});
CHOICE_RESOLVERS[PINK] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[PINK] = simpleSkip();
CHOICE_CONFIRMERS[PINK] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const id = pending.sourceInstanceId!;
  if (state.players[playerId].battle.some((c) => c.instanceId === id)) {
    next =
      next.players[playerId].command.length < COMMAND_ZONE_MAX
        ? sendFieldCardsToCommandHeld(next, playerId, [id], pending.phasePlayerId)
        : moveFieldUnit(next, playerId, id, pending.phasePlayerId, "hand");
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-005", `${PINK}:moved`) };
};

// ---------------------------------------------------------------------------
// XG5-006 ゴーグルロボ ※（手札）
// 「これが自分の手札にある間、自軍ラッシュフェイズ中、自軍パワーが5以上あればこれを捨札にしてから、必要パワーの数字が4以下の自軍捨札を1枚選び
//  手札に加えてもよい。」（atwiki/page-2231）。合法手は activate_field_unit_ability（手札のこのカード）。自軍パワーはパワーゾーンの枚数。

const ROBO_PICK = "xg5_006_robo_recover";
HAND_ACTIVATIONS.push({
  list: (state, playerId) => {
    if (state.phase !== "rush" || state.activePlayer !== playerId || xg5Busy(state)) return [];
    if (state.players[playerId].power.length < 5) return [];
    return state.players[playerId].hand.filter((c) => isSameCardIdentity(c.cardId, "XG5-006")).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
    if (!card || !isSameCardIdentity(card.cardId, "XG5-006")) return null;
    const next = patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
    const ids = next.players[playerId].discard.filter((c) => printedCostNumber(next, c.cardId) <= 4).map((c) => c.instanceId);
    if (ids.length === 0) return next;
    return openAfter(next, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG5-006", ROBO_PICK, ids, true));
  },
});
CHOICE_RESOLVERS[ROBO_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-006", `${ROBO_PICK}:${instanceId}`) };
};
CHOICE_SKIPPERS[ROBO_PICK] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-007 ゴーグルジェット【ゴーゴーチェンジ】（NC）
// 「このターン、自軍コマンドゾーンにホールド状態でカードを置くとき、かわりにリリース状態で置くか捨札にしてもよい。」（atwiki/page-2188）。
// 後処理で、このターンに新しく自軍コマンドゾーンにホールド状態で置かれたカードごとに、リリース状態にするか捨札にするかを選ぶ（見送ればホールド状態のまま）。

const GOGO_CHANGE_JET = "xg5_007_gogo_change";
XG5_KEYWORDS["XG5-007::gogo_change"] = (state, ctx) => ({
  state: addFlag(state, { kind: "xg5-007", playerId: ctx.playerId, turn: state.turn }),
  detail: GOGO_CHANGE_JET,
});
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of PLAYERS) {
    if (!(after.xg5?.flags ?? []).some((f) => f.kind === "xg5-007" && f.playerId === pid && f.turn === after.turn)) continue;
    const had = new Set(before.players[pid].command.map((c) => c.instanceId));
    for (const c of after.players[pid].command) {
      if (had.has(c.instanceId) || !c.commandHeld) continue;
      next = openAfter(next, {
        ...selectOne({ playerId: pid, phasePlayerId: turnPlayerOf(after), sourceInstanceId: c.instanceId }, "XG5-007", GOGO_CHANGE_JET, ["release", "discard"], true),
        xg5Meta: { target: c.instanceId },
      });
    }
  }
  return next;
});
CHOICE_RESOLVERS[GOGO_CHANGE_JET] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.xg5Meta?.target;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === target);
    if (!card) return p;
    if (mode === "release") return { ...p, command: p.command.map((c) => (c.instanceId === target ? { ...c, commandHeld: false, paymentHeld: undefined } : c)) };
    return { ...p, command: p.command.filter((c) => c.instanceId !== target), discard: [...p.discard, stripForZone(card)] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-007", `${GOGO_CHANGE_JET}:${mode}`) };
};
CHOICE_SKIPPERS[GOGO_CHANGE_JET] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-008 ゴーグルタンク【ゴーゴーチェンジ】（NC）
// 「自軍コマンドが4つ以下なら、次の効果を発動できる⇒自軍山札を見てLユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。その後、
//  山札をシャッフルする。」（atwiki/page-2189）。コマンドの数はコマンドゾーンの枚数（判断表）。

const TANK_PICK = "xg5_008_gogo_change";
XG5_KEYWORDS["XG5-008::gogo_change"] = (state, ctx) => {
  const pid = ctx.playerId;
  if (state.players[pid].command.length > 4) return { state, detail: "xg5_008:command_over_4" };
  const ids = state.players[pid].deck.filter((c) => defOf(state, c.cardId)?.type === "unit" && sizeOf(state, c) === "L").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_008:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-008", TANK_PICK, ids, true)), detail: TANK_PICK };
};
CHOICE_RESOLVERS[TANK_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  const next = shuffleDeck(cmdHeldPut(close(state, pending), playerId, card, "deck"), playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-008", `${TANK_PICK}:${instanceId}`) };
};
CHOICE_SKIPPERS[TANK_PICK] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-009 ゴーグルダンプ【ゴーゴーチェンジ】（NC）
// 「自軍コマンドゾーンから、リリース状態の特徴「メカ」を持つLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと
//  追加条件は満たすこと。そうしたとき、出したユニットが「ゴーグルロボ」だったなら、相手に1点ダメージを与える。」（atwiki/page-2190）。

XG5_KEYWORDS["XG5-009::gogo_change"] = (state, ctx) => {
  const pid = ctx.playerId;
  const ids = state.players[pid].command
    .filter((c) => !c.commandHeld && defOf(state, c.cardId)?.type === "unit" && sizeOf(state, c) === "L" && printedFeatures(state, c.cardId).includes("メカ"))
    .map((c) => c.instanceId);
  const ok = filterEffectRushCandidates(state, pid, "command", ids, true);
  if (ok.length === 0) return { state, detail: "xg5_009:no_targets" };
  let next = startEffectRush(state, {
    playerId: pid,
    phasePlayerId: ctx.phasePlayerId,
    effectId: "xg5_009_gogo_change",
    sourceCardId: "XG5-009",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    fromZone: "command",
    candidates: ok,
    maxCount: 1,
    requireConditions: true,
    alwaysAsk: true,
  });
  next = addWatch(next, { kind: "xg5-009", playerId: pid, phasePlayerId: ctx.phasePlayerId, candidates: ok, sourceInstanceId: ctx.triggerSourceInstanceId });
  return { state: next, detail: "xg5_009_gogo_change" };
};
WATCH_HANDLERS["xg5-009"] = (state, w, entered) => {
  const p = state.players[w.playerId];
  const robo = entered.some((id) => {
    const c = [...p.rush, ...p.battle].find((x) => x.instanceId === id);
    return !!c && isNamed(state, c.cardId, "ゴーグルロボ");
  });
  if (!robo) return state;
  const next = applyDamageToPlayer(state, opp(w.playerId), 1, { kind: "none", activePlayer: w.phasePlayerId });
  return { ...next, log: [...next.log, logFor(state, w.playerId, "XG5-009", "xg5_009_gogo_change:damage")] };
};

// ---------------------------------------------------------------------------
// コマンドゾーンから発動するオペレーション（XG5-010・XG5-016・XG5-017）
// 「（これが自軍コマンドゾーンにある間、〇〇を持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を
//  発動する）」。後処理で、新しく自軍バトルエリアに出た L ユニットを見て、リリース状態のこのカードごとに「ホールドして発動する」かを選ぶ。
// 発動はオペレーションの使用ではない（atwiki Q1）。

type CommandOp = { cardId: string; category: string; extra?: (state: GameState, ownerId: PlayerId, unit: CardInstance) => boolean; run: (state: GameState, ctx: BaseCtx) => GameState };
const COMMAND_OPS: CommandOp[] = [];
const COMMAND_OP_CONFIRM = "xg5_command_op";

AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of PLAYERS) {
    const entered = newBattleUnits(before, after, pid).filter((c) => sizeOf(after, c) === "L");
    if (entered.length === 0) continue;
    for (const op of COMMAND_OPS) {
      if (!entered.some((u) => fieldCategories(after, pid, u).includes(op.category) && (!op.extra || op.extra(after, pid, u)))) continue;
      for (const c of after.players[pid].command) {
        if (c.commandHeld || !isSameCardIdentity(c.cardId, op.cardId)) continue;
        next = openAfter(next, confirmChoice({ playerId: pid, phasePlayerId: turnPlayerOf(after), sourceInstanceId: c.instanceId }, op.cardId, COMMAND_OP_CONFIRM));
      }
    }
  }
  return next;
});
CHOICE_RESOLVERS[COMMAND_OP_CONFIRM] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[COMMAND_OP_CONFIRM] = simpleSkip();
CHOICE_CONFIRMERS[COMMAND_OP_CONFIRM] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const id = pending.sourceInstanceId!;
  const op = COMMAND_OPS.find((o) => isSameCardIdentity(o.cardId, pending.sourceCardId))!;
  let next = close(state, pending);
  const card = next.players[playerId].command.find((c) => c.instanceId === id);
  if (!card || card.commandHeld) return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${COMMAND_OP_CONFIRM}:gone`) };
  next = patchPlayer(next, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === id ? { ...c, commandHeld: true } : c)) }));
  next = op.run(next, pendingBase(pending));
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${COMMAND_OP_CONFIRM}:activated`) };
};

// XG5-010 恐竜剣ゴッドホーン（オペレーション）
// 「自軍ラッシュエリアから、効果に｢ラッシュしたとき｣とあるWBのMユニットを1体選んでもよい。そうしたとき、そのラッシュしたときの効果を発動する。」
// （atwiki/page-2277）。「ラッシュしたとき」の効果は DSL の on_rush の効果。発動はそのユニットの効果（Q2）。

const GOD_HORN = "xg5_010_god_horn";
function godHorn(state: GameState, ctx: BaseCtx): GameState {
  const ids = state.players[ctx.playerId].rush
    .filter((c) => defOf(state, c.cardId)?.type === "unit" && sizeOf(state, c) === "M" && fieldCategories(state, ctx.playerId, c).includes("WB") && listDslEffectsForTrigger(c.cardId, "on_rush").length > 0)
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne(ctx, "XG5-010", GOD_HORN, ids, true));
}
XG5_KEYWORDS["XG5-010::god_horn"] = (state, ctx) => ({ state: godHorn(state, ctxBase(ctx)), detail: GOD_HORN });
CHOICE_RESOLVERS[GOD_HORN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unit = state.players[playerId].rush.find((c) => c.instanceId === instanceId)!;
  const fired = tryResolveDslTriggeredEffects({
    state: close(state, pending),
    cardId: unit.cardId,
    instanceId,
    playerId,
    phasePlayerId: pending.phasePlayerId,
    triggerType: "on_rush",
    logAction: "named_effect",
  });
  let next = { ...fired.state, log: [...fired.state.log, ...fired.logs] };
  if (!fired.handled) {
    const named = resolveNamedOnRushEffects(next, playerId, instanceId, pending.phasePlayerId);
    next = { ...named.state, log: [...named.state.log, ...named.logs] };
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-010", `${GOD_HORN}:${instanceId}`) };
};
CHOICE_SKIPPERS[GOD_HORN] = simpleSkip();
COMMAND_OPS.push({ cardId: "XG5-010", category: "WB", run: godHorn });

// ---------------------------------------------------------------------------
// XG5-012 ゴレムカード（オペレーション）
// 「自軍捨札から、追加条件を持たないDAのSユニットのカードを1枚選び、このカードに重ねて自軍ラッシュエリアに出す。このとき出したユニットの効果は
//  発動しない。このカードに重ねたユニットはLユニットになる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」（atwiki/page-2192）。
// 出すのは「ラッシュ」ではない（ラッシュしたときの効果は発動しない）。L ユニットになるのは core/catalog.ts の重ねたカードによるサイズ。

const GOLEM = "xg5_012_golem_card";
XG5_KEYWORDS["XG5-012::golem_card"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].discard
    .filter((c) => {
      const d = defOf(state, c.cardId);
      return d?.type === "unit" && d.size === "S" && !d.rushAdditionalCondition && printedCategories(state, c.cardId).includes("DA");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_012:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-012", GOLEM, ids, false)), detail: GOLEM };
};
CHOICE_RESOLVERS[GOLEM] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? "XG5-012:op", cardId: "XG5-012" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId && c.instanceId !== opCard.instanceId),
    hand: p.hand.filter((c) => c.instanceId !== opCard.instanceId),
    rush: [...p.rush, { ...stripForZone(card), stackedCards: [opCard] }],
  }));
  // 出したユニットはラッシュした扱い（R-RUSH-01）。自身の効果だけを止める（R-RUSH-24）。
  const rushed = finalizeEffectRush(markFieldEntryHandled(next, [instanceId]), playerId, [instanceId], pending.phasePlayerId, { silent: true });
  next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-012", `${GOLEM}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-013 再生カード（オペレーション）「自軍捨札から、DAを持つカードを1枚選び手札に加える。」（atwiki/page-2169）

const REGEN = "xg5_013_regen_card";
XG5_KEYWORDS["XG5-013::regen_card"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].discard.filter((c) => c.instanceId !== ctx.operationInstanceId && printedCategories(state, c.cardId).includes("DA")).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_013:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-013", REGEN, ids, false)), detail: REGEN };
};
CHOICE_RESOLVERS[REGEN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-013", `${REGEN}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-015 スティライザー（オペレーション）
// 「自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。自軍バトルフェイズ中、このカードに重ねた
//  ユニットがバトルエリアに出たとき、自分の手札から特徴「恐竜」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい（ただし、追加条件は
//  満たすこと）。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。」（atwiki/page-2193）。
// 重ね方は RM-009 と同じ（ユニットの stackedCards）。出すのは効果のラッシュ（必要パワーは問わない・追加条件は満たす）。

const STYRIZER = "xg5_015_styrizer";
XG5_KEYWORDS["XG5-015::styrizer"] = (state, ctx) => {
  const ids = fieldUnits(state, ctx.playerId).filter((c) => sizeOf(state, c) === "S").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_015:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-015", STYRIZER, ids, false)), detail: STYRIZER };
};
CHOICE_RESOLVERS[STYRIZER] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opCard: CardInstance = { instanceId: pending.sourceInstanceId ?? "XG5-015:op", cardId: "XG5-015" };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const put = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), opCard] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle), discard: p.discard.filter((c) => c.instanceId !== opCard.instanceId), hand: p.hand.filter((c) => c.instanceId !== opCard.instanceId) };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-015", `${STYRIZER}:${instanceId}`) };
};
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  const pid = turnPlayerOf(after);
  if (after.phase !== "battle") return after;
  for (const u of newBattleUnits(before, after, pid)) {
    const n = (u.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, "XG5-015")).length;
    for (let i = 0; i < n; i++) {
      const ids = next.players[pid].hand.filter((c) => defOf(next, c.cardId)?.type === "unit" && printedFeatures(next, c.cardId).includes("恐竜")).map((c) => c.instanceId);
      const ok = filterEffectRushCandidates(next, pid, "hand", ids, true, true);
      if (ok.length === 0 || next.pendingEffectRush) continue;
      next = startEffectRush(next, {
        playerId: pid,
        phasePlayerId: pid,
        effectId: "xg5_015_styrizer_rush",
        sourceCardId: "XG5-015",
        sourceInstanceId: u.instanceId,
        fromZone: "hand",
        candidates: ok,
        maxCount: 1,
        requireConditions: true,
        ignorePowerCost: true,
        alwaysAsk: true,
      });
    }
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG5-016 シグナルキャノン（オペレーション）「BP6000以下の敵軍ユニットを1体選び持ち主のパワーゾーンに送る。」（atwiki/page-2194）。
// オモテ向き（ダメージにしない）。エリアを問わない。

const SIGNAL_CANNON = "xg5_016_signal_cannon";
function signalCannon(state: GameState, ctx: BaseCtx): GameState {
  const enemyId = opp(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= 6000 && selectableEnemy(state, ctx.playerId, "XG5-016", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne(ctx, "XG5-016", SIGNAL_CANNON, ids, false));
}
XG5_KEYWORDS["XG5-016::signal_cannon"] = (state, ctx) => ({ state: signalCannon(state, ctxBase(ctx)), detail: SIGNAL_CANNON });
CHOICE_RESOLVERS[SIGNAL_CANNON] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-016", `${SIGNAL_CANNON}:${instanceId}`) };
};
COMMAND_OPS.push({ cardId: "XG5-016", category: "OT", run: signalCannon });

// XG5-017 魔法剣キングカリバー「自分は1枚ドローする。」（atwiki/page-2184）。手札から使うときは DSL の draw。
// コマンドゾーンからは、MA を持ち合体を必要とする（追加条件が合体の）自軍 L ユニットがバトルエリアに出たとき。
COMMAND_OPS.push({
  cardId: "XG5-017",
  category: "MA",
  extra: (_state, _owner, unit) => requiresAllFusionPartners(unit.cardId),
  run: (state, ctx) => requestDrawFromDeck(state, ctx.playerId, ctx.phasePlayerId, { count: 1, sourceCardId: "XG5-017" }).state,
});

// ---------------------------------------------------------------------------
// XG5-018 ゴーゴーボイジャー【アンドック】
// 「これが自軍コマンドゾーンにある間、敵軍ターン中、自軍ユニットがユニットでなくなり、自軍ユニットが1体もなくなったとき、これを自軍ラッシュエリアに
//  出してもよい。ただし、必要パワーは満たすこと。（この効果でラッシュできる「ゴーゴーボイジャー」は、1つのタイミングにつき 1枚までとする）」
// （atwiki/page-2239）。必要パワーだけを満たす（追加条件は問わない）。

const UNDOCK = "xg5_018_undock";
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  const turnPlayer = turnPlayerOf(after);
  for (const pid of PLAYERS) {
    if (pid === turnPlayer) continue;
    if (fieldUnits(before, pid).length === 0 || fieldUnits(after, pid).length > 0) continue;
    const voyager = after.players[pid].command.find(
      (c) => isSameCardIdentity(c.cardId, "XG5-018") && countAvailablePower(after, pid) >= printedCostNumber(after, c.cardId),
    );
    if (!voyager) continue;
    next = openAfter(next, confirmChoice({ playerId: pid, phasePlayerId: turnPlayer, sourceInstanceId: voyager.instanceId }, "XG5-018", UNDOCK));
  }
  return next;
});
CHOICE_RESOLVERS[UNDOCK] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[UNDOCK] = simpleSkip();
CHOICE_CONFIRMERS[UNDOCK] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const id = pending.sourceInstanceId!;
  let next = close(state, pending);
  if (next.players[playerId].command.some((c) => c.instanceId === id)) {
    next = startEffectRush(next, {
      playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: `${UNDOCK}_rush`,
      sourceCardId: "XG5-018",
      sourceInstanceId: id,
      fromZone: "command",
      candidates: [id],
      maxCount: 1,
      requireConditions: false,
      mandatory: true,
      forced: true,
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-018", `${UNDOCK}:rush`) };
};

// ---------------------------------------------------------------------------
// XG5-019 ダイボイジャー【アドベンチャーダブルスクリュー】
// 「自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、リリース状態の自分自身のコマンドが2つ以上あればすべて選び手札に戻すかを
//  選ぶ。」（atwiki/page-2279）。リリース状態のコマンドが1つ以下なら選ばずに1点ダメージ。

const DOUBLE_SCREW = "xg5_019_double_screw";
function screwDamage(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId): GameState {
  return applyDamageToPlayer(state, opp(playerId), 1, { kind: "none", activePlayer: phasePlayerId });
}
XG5_KEYWORDS["XG5-019::double_screw"] = (state, ctx) => {
  if (turnPlayerOf(state) !== ctx.playerId) return { state, detail: "xg5_019:enemy_turn" };
  const enemyId = opp(ctx.playerId);
  const released = state.players[enemyId].command.filter((c) => !c.commandHeld);
  if (released.length < 2) return { state: screwDamage(state, ctx.playerId, ctx.phasePlayerId), detail: `${DOUBLE_SCREW}:damage` };
  return {
    state: openAfter(state, {
      ...selectOne({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG5-019", DOUBLE_SCREW, ["damage", "return_commands"], false),
      xg5Meta: { owner: ctx.playerId },
    }),
    detail: DOUBLE_SCREW,
  };
};
CHOICE_RESOLVERS[DOUBLE_SCREW] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (mode === "damage") {
    next = applyDamageToPlayer(next, playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
  } else {
    next = patchPlayer(next, playerId, (p) => ({
      ...p,
      command: p.command.filter((c) => c.commandHeld),
      hand: [...p.hand, ...p.command.filter((c) => !c.commandHeld).map(stripForZone)],
    }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-019", `${DOUBLE_SCREW}:${mode}`) };
};

// ---------------------------------------------------------------------------
// XG5-020 ボウケンレッド【レッドゾーンクラッシュ】（NC）
// 「自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、このターン、これはBP+2000され、戻したカードが特徴「メカ」を持つMユニットだったなら、
//  さらにBP+2000される。」（atwiki/page-2230）。リリース状態・ホールド状態を問わない。

const RED_ZONE = "xg5_020_red_zone_crash";
XG5_KEYWORDS["XG5-020::red_zone_crash"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_020:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-020", RED_ZONE, ids, true)), detail: RED_ZONE };
};
CHOICE_RESOLVERS[RED_ZONE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId)!;
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  const d = getDefinition(state.definitions, card.cardId);
  const mechaM = d?.type === "unit" && d.size === "M" && (d.features ?? []).includes("メカ");
  if (pending.sourceInstanceId) next = addBp(next, playerId, pending.sourceInstanceId, mechaM ? 4000 : 2000);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-020", `${RED_ZONE}:${instanceId}`) };
};
CHOICE_SKIPPERS[RED_ZONE] = simpleSkip();

// ---------------------------------------------------------------------------
// 継続効果・ほかの処理の場所から発動する効果（DSL からは何もしない）。
XG5_KEYWORDS["XG5-001::scrum_aura"] = noop("xg5_001:scrum_aura");
XG5_KEYWORDS["XG5-005::pink"] = noop("xg5_005:pink");
XG5_KEYWORDS["XG5-006::hand_recover"] = noop("xg5_006:hand_recover");
XG5_KEYWORDS["XG5-018::undock"] = noop("xg5_018:undock");

export type { GrantKeywordContext, GrantKeywordResult };
