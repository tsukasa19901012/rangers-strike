/**
 * クロスギャザー XG5 XG5-021〜XG5-040（ボウケンブラック〜ゴセイブラック）のカード固有の効果（cardSpec XG5-021-040 の監査）。
 * 登録先は rules/xg5/xg5Core.ts。継続効果の判定（XG5-025・031・032・034）は rules/xg5/xg5Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { effectiveBp } from "../../core/catalog";
import { patchPlayer } from "../playerPatches";
import { finalizeEffectRush, markFieldEntryHandled } from "../../events/emitUnitRushed";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { resolveBattlePending } from "../operationCounters";
import { grantSp1ToBattleUnit } from "../namedUnitEffects";
import { addBakiBakiExtraAttack } from "../turnModifierBridge";
import { moveToExile } from "../exile";
import { ncGateAllows } from "../ncGatedEffects";
import { tryOpenEndTurnEffectsMenu } from "../legend3/endTurnEffects";
import {
  type BaseCtx,
  appendResume,
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  printedBp,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { ATTACK_WIN_HOOKS, AFTER_ACTION_HOOKS, CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG5_KEYWORDS, noop } from "./xg5Core";
import { XG5_JET_BOARD, printedCostNumber, xg5CostNumber, xg5Flags, xg5TurnPlayer } from "./xg5Fields";
import { XG5_SENTAI_WORK_CARD_IDS } from "./xg5SentaiWorks.generated";
import {
  addBp,
  addFlag,
  cmdHeldPut,
  defOf,
  fieldCategories,
  newBattleUnits,
  opp,
  patchXg5,
  printedCategories,
  printedFeatures,
  selectOne,
  setFieldHeld,
  sizeOf,
  xg5Busy,
} from "./xg5Shared";

const PLAYERS: PlayerId[] = ["player1", "player2"];

function isSUnit(state: GameState, c: CardInstance): boolean {
  return defOf(state, c.cardId)?.type === "unit" && sizeOf(state, c) === "S";
}

/** 「〇〇を△まで選ぶ」の途中の選択（1枚ずつ選び、上限に達するか確定で apply）。 */
function multiChoice(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], max: number): PendingEffectChoice {
  return { ...selectOne(ctx, sourceCardId, effectId, ids, true), selectCount: max, mayConfirm: true, xg5Meta: { n: max } };
}
function registerMulti(effectId: string, apply: (state: GameState, pending: PendingEffectChoice, ids: string[]) => GameState): void {
  const finish = (state: GameState, playerId: PlayerId, ids: string[]) => {
    const pending = state.pendingEffectChoice!;
    const next = apply(close(state, pending), pending, ids);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${ids.join(",")}`) };
  };
  CHOICE_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
    if (selected.length >= (pending.xg5Meta?.n ?? 1) || rest.length === 0) return finish(state, playerId, selected);
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest } }, log: logFor(state, playerId, pending.sourceCardId, `${effectId}:pick:${instanceId}`) };
  };
  CHOICE_CONFIRMERS[effectId] = (state, playerId) => finish(state, playerId, state.pendingEffectChoice!.selectedInstanceIds ?? []);
  CHOICE_SKIPPERS[effectId] = simpleSkip();
}

/** 効果でバトルする（attacker 側がアタックしたのではない。rules/rk/rk10UnitEffects.ts と同じ組み立て）。 */
function effectBattle(state: GameState, pending: PendingEffectChoice, attackerId: PlayerId, attackerInstanceId: string, defenderId: PlayerId, defenderInstanceId: string): GameState {
  const battle: PendingBattle = {
    attackerPlayerId: attackerId,
    attackerInstanceId,
    defenderPlayerId: defenderId,
    defenderInstanceId,
    phasePlayerId: pending.phasePlayerId,
    onAttackResolved: true,
    effectBattle: true,
  };
  const battled = resolveBattlePending({ ...state, activePlayer: pending.phasePlayerId }, battle).state;
  if (battled.pendingEffectChoice || battled.pendingLeave || battled.pendingRegister) {
    if (!pending.resumeChoice) return battled;
    if (battled.pendingEffectChoice) return { ...battled, pendingEffectChoice: appendResume(battled.pendingEffectChoice, pending.resumeChoice) };
    return { ...battled, deferredDestroyTriggers: [...(battled.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
  }
  return proceed(battled, pending);
}

/** このターンのアタック・ストライクの権利を1度戻す（追加でアタックかストライクを行ってもよい。RK-269 と同じ）。 */
function restoreAttackRight(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const rec = p.unitActionsThisTurn?.[instanceId];
    const f = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, battleActed: false } : c));
    return {
      ...p,
      battle: f(p.battle),
      unitActionsThisTurn: rec ? { ...p.unitActionsThisTurn, [instanceId]: { ...rec, attacked: false } } : p.unitActionsThisTurn,
    };
  });
}

// ---------------------------------------------------------------------------
// XG5-021 ボウケンブラック【ハンマーブレイク】（NC）
// 「「SP1」DAを持つ、本来のBPが8000以下の敵軍ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。」
// （atwiki/page-2195）。DA はいまのカテゴリ、BP は本来の BP。エリア・サイズを問わない。

const HAMMER = "xg5_021_hammer_break";
XG5_KEYWORDS["XG5-021::hammer_break"] = (state, ctx) => {
  const enemyId = opp(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => fieldCategories(state, enemyId, c).includes("DA") && printedBp(state, c.cardId) <= 8000 && selectableEnemy(state, ctx.playerId, "XG5-021", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_021:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-021", HAMMER, ids, true)), detail: HAMMER };
};
CHOICE_RESOLVERS[HAMMER] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = sendFieldCardsToCommandHeld(close(state, pending), opp(playerId), [instanceId], pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-021", `${HAMMER}:${instanceId}`) };
};
CHOICE_SKIPPERS[HAMMER] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-022 ボウケンブルー【ナックルキャノン】（NC。アタックしたとき）
// 「自軍コマンドが3つ以下なら、自軍捨札から必要パワーの数字が2以下のオペレーションカードを1枚選び自軍コマンドゾーンにホールド状態で置いてもよい。」
// （atwiki/page-2196）。コマンドの数はコマンドゾーンの枚数。

const KNUCKLE = "xg5_022_knuckle_cannon";
XG5_KEYWORDS["XG5-022::knuckle_cannon"] = (state, ctx) => {
  const p = state.players[ctx.playerId];
  if (p.command.length > 3) return { state, detail: "xg5_022:command_over_3" };
  const ids = p.discard.filter((c) => defOf(state, c.cardId)?.type === "operation" && printedCostNumber(state, c.cardId) <= 2).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_022:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-022", KNUCKLE, ids, true)), detail: KNUCKLE };
};
CHOICE_RESOLVERS[KNUCKLE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const next = cmdHeldPut(close(state, pending), playerId, card, "discard");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-022", `${KNUCKLE}:${instanceId}`) };
};
CHOICE_SKIPPERS[KNUCKLE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-023 ボウケンイエロー【スクーパーファントム】（NC）
// 「「SP1」相手は、自分自身のコマンドゾーンからユニットカードを1枚選び自分自身のラッシュエリアに出す（このとき、出したユニットの効果は発動しない）。
//  そうしたとき、出したユニットとこのユニットとでバトルする。」（atwiki/page-2197）。相手が選ぶ（見送れない）。リリース状態・ホールド状態とも。

const SCOOPER = "xg5_023_scooper_phantom";
XG5_KEYWORDS["XG5-023::scooper_phantom"] = (state, ctx) => {
  const enemyId = opp(ctx.playerId);
  const ids = state.players[enemyId].command.filter((c) => defOf(state, c.cardId)?.type === "unit").map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: "xg5_023:no_targets" };
  return {
    state: openAfter(state, {
      ...selectOne({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG5-023", SCOOPER, ids, false),
      xg5Meta: { owner: ctx.playerId },
    }),
    detail: SCOOPER,
  };
};
CHOICE_RESOLVERS[SCOOPER] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = pending.xg5Meta?.owner ?? opp(playerId);
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId)!;
  let next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    rush: [...p.rush, stripForZone(card)],
  }));
  // 出したユニットの効果は発動しない（XG5-012 と同じ扱い）。
  const placed = finalizeEffectRush(markFieldEntryHandled(next, [instanceId]), playerId, [instanceId], pending.phasePlayerId, { silent: true });
  next = { ...placed.state, log: [...placed.state.log, ...placed.logs] };
  const log = logFor(state, playerId, "XG5-023", `${SCOOPER}:${instanceId}`);
  const selfId = pending.sourceInstanceId;
  if (!selfId || !findField(next, ownerId, selfId)) return { state: proceed(next, pending), log };
  return { state: effectBattle(next, pending, ownerId, selfId, playerId, instanceId), log };
};

// ---------------------------------------------------------------------------
// XG5-024 ボウケンピンク【プレシャスの確保】（NC）
// 「自軍山札の下から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（置けなければ手札に加える）。そうしたとき、相手も同じように
//  してもよい。」（atwiki/page-2240）。自分が置くかを確認し、置いたら相手が同じように置くかを確認する。

const PRECIOUS = "xg5_024_precious";
function bottomToCommand(state: GameState, playerId: PlayerId): GameState {
  const card = state.players[playerId].deck.at(-1);
  if (!card) return state;
  if (state.players[playerId].command.length < COMMAND_ZONE_MAX) return cmdHeldPut(state, playerId, card, "deck");
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: p.deck.slice(0, -1), hand: [...p.hand, stripForZone(card)] }));
}
XG5_KEYWORDS["XG5-024::precious"] = (state, ctx) => {
  if (state.players[ctx.playerId].deck.length === 0) return { state, detail: "xg5_024:empty_deck" };
  return { state: openAfter(state, { ...confirmChoice(ctxBase(ctx), "XG5-024", PRECIOUS), xg5Meta: { owner: ctx.playerId } }), detail: PRECIOUS };
};
CHOICE_RESOLVERS[PRECIOUS] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[PRECIOUS] = simpleSkip();
CHOICE_CONFIRMERS[PRECIOUS] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = bottomToCommand(close(state, pending), playerId);
  const log = logFor(state, playerId, "XG5-024", `${PRECIOUS}:placed`);
  const enemyId = opp(playerId);
  if (pending.xg5Meta?.owner === playerId && next.players[enemyId].deck.length > 0) {
    return { state: openNext(next, pending, { ...confirmChoice({ ...pendingBase(pending), playerId: enemyId }, "XG5-024", PRECIOUS), xg5Meta: { owner: playerId } }), log };
  }
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// XG5-026 ボウケンイエローAT【仲間の支え】（NC）
// 「｢SP1｣ 自軍バトルエリアに、特徴に「レッド」「ブラック」「ブルー」「ピンク」を持つSユニットがそれぞれあれば、本来のBPが6000以下の敵軍ユニットを
//  すべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-2272）。特徴は本来の特徴。

XG5_KEYWORDS["XG5-026::nakama"] = (state, ctx) => {
  const own = state.players[ctx.playerId].battle.filter((c) => isSUnit(state, c));
  const all = ["レッド", "ブラック", "ブルー", "ピンク"].every((f) => own.some((c) => printedFeatures(state, c.cardId).includes(f)));
  if (!all) return { state, detail: "xg5_026:not_all_colors" };
  const enemyId = opp(ctx.playerId);
  const ids = fieldUnits(state, enemyId).filter((c) => printedBp(state, c.cardId) <= 6000).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_026:no_targets" };
  return { state: sendFieldCardsToCommandHeld(state, enemyId, ids, ctx.phasePlayerId), detail: "xg5_026:held" };
};

// ---------------------------------------------------------------------------
// XG5-027 ボウケンピンクAT【デュアルクラッシャー・コンビネーションクラッシュ】（NC）
// 「このターン、次に敵軍ユニットがホールド状態になったとき、そのユニットを撃破する。」（atwiki/page-2270）。
// 成立したときは印を付けるだけ。後処理で、場の敵軍ユニットが新しくホールド状態になったら（レジスト等）、処理の区切りでそのユニットを撃破する。

XG5_KEYWORDS["XG5-027::dual_crusher"] = (state, ctx) => ({
  state: addFlag(state, { kind: "xg5-027", playerId: ctx.playerId, turn: state.turn }),
  detail: "xg5_027:armed",
});
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const flag of xg5Flags(after, "xg5-027")) {
    if (flag.turn !== after.turn || flag.target) continue;
    const enemyId = opp(flag.playerId);
    const wasReleased = new Set(fieldUnits(before, enemyId).filter((c) => !c.commandHeld).map((c) => c.instanceId));
    const held = fieldUnits(after, enemyId).find((c) => c.commandHeld && wasReleased.has(c.instanceId));
    if (!held) continue;
    next = patchXg5(next, (x) => ({ ...x, flags: (x.flags ?? []).map((f) => (f === flag ? { ...f, target: held.instanceId } : f)) }));
  }
  if (xg5Busy(next)) return next;
  for (const flag of xg5Flags(next, "xg5-027")) {
    if (!flag.target) continue;
    next = patchXg5(next, (x) => ({ ...x, flags: (x.flags ?? []).map((f) => (f.kind === "xg5-027" && f.target === flag.target && f.playerId === flag.playerId ? { ...f, kind: "xg5-027-done" } : f)) }));
    if (!findField(next, opp(flag.playerId), flag.target)) continue;
    next = destroyAll(next, { playerId: flag.playerId, phasePlayerId: xg5TurnPlayer(next) }, "XG5-027", "xg5_027_destroy", [flag.target]);
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG5-028 バーニングレジェンドダイボイジャー【スーパーサーティーセンタイソウル】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒作品名に「戦隊」を含む、DAを持たない自軍捨札の枚数を数え、その数字以下の
//  必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2237）。
// 作品名は atwiki の「作品：」（rules/xg5/xg5SentaiWorks.generated.ts）。発動するかは選ぶユニットを見送れること（任意）で表す。

const SENTAI_SOUL = "xg5_028_thirty_sentai_soul";
function isSentaiWork(cardId: string): boolean {
  if (XG5_SENTAI_WORK_CARD_IDS.has(cardId)) return true;
  for (const id of XG5_SENTAI_WORK_CARD_IDS) if (isSameCardIdentity(cardId, id)) return true;
  return false;
}
XG5_KEYWORDS["XG5-028::thirty_sentai_soul"] = (state, ctx) => {
  const pid = ctx.playerId;
  if (xg5TurnPlayer(state) !== pid) return { state, detail: "xg5_028:enemy_turn" };
  const count = state.players[pid].discard.filter((c) => isSentaiWork(c.cardId) && !printedCategories(state, c.cardId).includes("DA")).length;
  const enemyId = opp(pid);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => xg5CostNumber(state, pid, enemyId, c.cardId) <= count && selectableEnemy(state, pid, "XG5-028", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_028:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-028", SENTAI_SOUL, ids, true)), detail: SENTAI_SOUL };
};
CHOICE_RESOLVERS[SENTAI_SOUL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-028", `${SENTAI_SOUL}:${instanceId}`) };
};
CHOICE_SKIPPERS[SENTAI_SOUL] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-029 ゲキファイヤー【頑頑ナックル落とし】
// 「これがアタックして敵軍ユニットをバトルで撃破するたび、自分コマンドを1つ選びホールドしてもよい。そうしたとき、このターン、これはBP+2000され、
//  追加でアタックかストライクを行ってもよい。」（atwiki/page-2281）。選べるのはリリース状態の自軍コマンド。
// XG5-034 シンケンレッド【二刀流烈火大斬刀】（NC）
// 「これがアタックして敵軍ユニットをバトルで撃破するたび、特徴「侍」を持つ自軍Sユニットを1体選びホールドしてもよい。そうしたとき、これは追加で
//  アタックを行ってもよい。」（atwiki/page-2263）。選べるのはリリース状態の、これ以外の「侍」の S ユニット。追加はアタックだけ（RS-167 と同じ）。

const GANGAN = "xg5_029_gangan_knuckle";
const NITORYU = "xg5_034_nitoryu";
ATTACK_WIN_HOOKS.push((state, attackerId, attackerInstanceId, phasePlayerId) => {
  if (phasePlayerId !== attackerId) return state;
  const self = findField(state, attackerId, attackerInstanceId);
  if (!self) return state;
  const ctx: BaseCtx = { playerId: attackerId, phasePlayerId, sourceInstanceId: attackerInstanceId };
  if (isSameCardIdentity(self.cardId, "XG5-029")) {
    const ids = state.players[attackerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
    return ids.length === 0 ? state : openAfter(state, selectOne(ctx, "XG5-029", GANGAN, ids, true));
  }
  if (isSameCardIdentity(self.cardId, "XG5-034") && ncGateAllows(self, "to_hi_zan_to")) {
    const ids = fieldUnits(state, attackerId)
      .filter((c) => c.instanceId !== attackerInstanceId && !c.commandHeld && isSUnit(state, c) && printedFeatures(state, c.cardId).includes("侍"))
      .map((c) => c.instanceId);
    return ids.length === 0 ? state : openAfter(state, selectOne(ctx, "XG5-034", NITORYU, ids, true));
  }
  return state;
});
CHOICE_RESOLVERS[GANGAN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = setFieldHeld(close(state, pending), playerId, instanceId, true);
  const selfId = pending.sourceInstanceId;
  if (selfId && findField(next, playerId, selfId)) next = restoreAttackRight(addBp(next, playerId, selfId, 2000), playerId, selfId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-029", `${GANGAN}:${instanceId}`) };
};
CHOICE_SKIPPERS[GANGAN] = simpleSkip();
CHOICE_RESOLVERS[NITORYU] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = setFieldHeld(close(state, pending), playerId, instanceId, true);
  const selfId = pending.sourceInstanceId;
  if (selfId && findField(next, playerId, selfId)) next = patchPlayer(next, playerId, (p) => addBakiBakiExtraAttack(p, selfId));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-034", `${NITORYU}:${instanceId}`) };
};
CHOICE_SKIPPERS[NITORYU] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-030 ゲキゴリラ【ゴリゴリ波】「これをラッシュしたとき、敵軍Sユニットか敵軍コマンドを敵軍ダメージの数まで選びホールドしてもよい。」
// （atwiki/page-2198）。リリース状態のものから、敵軍ダメージの数まで（途中で確定してもよい）。

const GORIGORI = "xg5_030_gorigori";
XG5_KEYWORDS["XG5-030::gorigori"] = (state, ctx) => {
  const enemyId = opp(ctx.playerId);
  const n = state.players[enemyId].damage;
  if (n <= 0) return { state, detail: "xg5_030:no_damage" };
  const units = fieldUnits(state, enemyId).filter((c) => !c.commandHeld && isSUnit(state, c) && selectableEnemy(state, ctx.playerId, "XG5-030", c));
  const cmds = state.players[enemyId].command.filter((c) => !c.commandHeld);
  const ids = [...units, ...cmds].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_030:no_targets" };
  return { state: openAfter(state, multiChoice(ctxBase(ctx), "XG5-030", GORIGORI, ids, n)), detail: GORIGORI };
};
registerMulti(GORIGORI, (state, pending, ids) => ids.reduce((s, id) => setFieldHeld(s, opp(pending.playerId), id, true), state));

// ---------------------------------------------------------------------------
// XG5-031 ゲキガゼル【ガゼル脚】
// 「このユニットからコンビネーションする特徴「メカ」を持たないMユニットは、BP+3000され「SP1/2」になり、アタックかストライクを選ぶとき、可能なら
//  敵軍ユニットにアタックする。」（atwiki/page-2199）。後処理で、自軍バトルエリアのこれのすぐ後に新しく出た M ユニットを見る。
// 「SP1/2」は2番目なら SP1。「可能ならアタックする」は core/legalActions.ts（rules/xg5/xg5Fields.ts xg5ForcesAttack）。

AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of PLAYERS) {
    const entered = new Set(newBattleUnits(before, after, pid).map((c) => c.instanceId));
    if (entered.size === 0) continue;
    const battle = after.players[pid].battle;
    battle.forEach((u, i) => {
      if (i === 0 || !entered.has(u.instanceId) || !isSameCardIdentity(battle[i - 1]!.cardId, "XG5-031")) return;
      if (sizeOf(after, u) !== "M" || printedFeatures(after, u.cardId).includes("メカ")) return;
      next = addBp(next, pid, u.instanceId, 3000);
      if (i === 1) next = grantSp1ToBattleUnit(next, pid, u.instanceId);
      next = addFlag(next, { kind: "xg5-031", playerId: pid, turn: after.turn, target: u.instanceId });
    });
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG5-032 ゲキペンギン【ジェットボード】（エンドフェイズの確認は rules/xg5/xg5Fields.ts xg5EndTurnChoice）。戻したら、ほかのターン終了時の効果へ続ける。

function continueEndTurn(state: GameState, playerId: PlayerId): GameState {
  if (state.pendingEffectChoice || state.phase !== "end") return state;
  return tryOpenEndTurnEffectsMenu(state, playerId) ?? state;
}
CHOICE_RESOLVERS[XG5_JET_BOARD] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[XG5_JET_BOARD] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = proceed(close(state, pending), pending);
  return { state: continueEndTurn(next, playerId), log: logFor(state, playerId, "XG5-032", `${XG5_JET_BOARD}:stay`) };
};
CHOICE_CONFIRMERS[XG5_JET_BOARD] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const id = pending.sourceInstanceId;
  let next = close(state, pending);
  const card = next.players[playerId].battle.find((c) => c.instanceId === id);
  if (card) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, battle: p.battle.filter((c) => c.instanceId !== id), rush: [...p.rush, { ...card, battleActed: undefined }] }));
  }
  return { state: continueEndTurn(proceed(next, pending), playerId), log: logFor(state, playerId, "XG5-032", `${XG5_JET_BOARD}:to_rush`) };
};

// ---------------------------------------------------------------------------
// XG5-033 シンケンレッド（志葉 薫）【封印のモヂカラ】
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札を1枚選び相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字と同じ必要パワーの
//  数字を持つ、追加条件を持たない敵軍ユニットを1体選び、持ち主の山札の下に戻す。（選んだユニットがDAを持つなら、山札の下に戻すかわりにゲームから
//  除外する）」（atwiki/page-2170）。見せたカードは手札に残る。DA はいまのカテゴリ。

const FUUIN_REVEAL = "xg5_033_fuuin_reveal";
const FUUIN_TARGET = "xg5_033_fuuin_target";
XG5_KEYWORDS["XG5-033::fuuin"] = (state, ctx) => {
  if (xg5TurnPlayer(state) !== ctx.playerId) return { state, detail: "xg5_033:enemy_turn" };
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_033:no_hand" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-033", FUUIN_REVEAL, ids, true)), detail: FUUIN_REVEAL };
};
CHOICE_RESOLVERS[FUUIN_REVEAL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  const n = printedCostNumber(state, card.cardId);
  const enemyId = opp(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !defOf(state, c.cardId)?.rushAdditionalCondition && xg5CostNumber(state, playerId, enemyId, c.cardId) === n && selectableEnemy(state, playerId, "XG5-033", c))
    .map((c) => c.instanceId);
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "XG5-033", `${FUUIN_REVEAL}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return { state: openNext(cleared, pending, selectOne(pendingBase(pending), "XG5-033", FUUIN_TARGET, ids, false)), log };
};
CHOICE_SKIPPERS[FUUIN_REVEAL] = simpleSkip();
CHOICE_RESOLVERS[FUUIN_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  let next = close(state, pending);
  const card = findField(next, enemyId, instanceId);
  const zone = zoneOfField(next, enemyId, instanceId);
  if (card && zone) {
    next = fieldCategories(next, enemyId, card).includes("DA")
      ? moveToExile(next, enemyId, zone, instanceId)
      : moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "deck_bottom");
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-033", `${FUUIN_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-035 獅子ディスク・XG5-036 龍ディスク（オペレーション）
// 「自軍ラッシュエリアから、MAを持つ自軍Sユニットを1体選ぶ。そうしたとき、選んだユニットのBP以下のBPを持つ敵軍Sユニットを1体選び、持ち主の
//  パワーゾーンにダメージにして置く。」（atwiki/page-2175）／「…敵軍Sユニットをすべて持ち主の手札に戻す。」（atwiki/page-2201）。
// BP はいまの BP。敵軍ユニットはエリアを問わない。

const DISC_OWN = "xg5_disc_own";
const SHISHI_TARGET = "xg5_035_shishi_target";
function discOwn(state: GameState, ctx: BaseCtx, cardId: string): GameState {
  const ids = state.players[ctx.playerId].rush.filter((c) => isSUnit(state, c) && fieldCategories(state, ctx.playerId, c).includes("MA")).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne(ctx, cardId, DISC_OWN, ids, false));
}
XG5_KEYWORDS["XG5-035::shishi_disc"] = (state, ctx) => ({ state: discOwn(state, ctxBase(ctx), "XG5-035"), detail: DISC_OWN });
XG5_KEYWORDS["XG5-036::ryu_disc"] = (state, ctx) => ({ state: discOwn(state, ctxBase(ctx), "XG5-036"), detail: DISC_OWN });
CHOICE_RESOLVERS[DISC_OWN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const own = findField(state, playerId, instanceId)!;
  const bp = effectiveBp(state, playerId, own);
  const enemyId = opp(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isSUnit(state, c) && effectiveBp(state, enemyId, c) <= bp && selectableEnemy(state, playerId, pending.sourceCardId, c))
    .map((c) => c.instanceId);
  let next = close(state, pending);
  const log = logFor(state, playerId, pending.sourceCardId, `${DISC_OWN}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  if (isSameCardIdentity(pending.sourceCardId, "XG5-035")) return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-035", SHISHI_TARGET, ids, false)), log };
  for (const id of ids) next = moveFieldUnit(next, enemyId, id, pending.phasePlayerId, "hand");
  return { state: proceed(next, pending), log };
};
CHOICE_RESOLVERS[SHISHI_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-035", `${SHISHI_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-037 ゴセイレッド【レッドブレイク】（NC）
// 「敵軍Sユニットを1体選び、持ち主の手札に戻してもよい。（自分の手札が1枚以下なら、手札に戻すかわりに、持ち主のパワーゾーンにダメージにして置いても
//  よい）」（atwiki/page-2228）。エリアを問わない。手札が1枚以下なら、ダメージにするかを確認する（見送れば手札に戻す）。

const RED_BREAK = "xg5_037_red_break";
const RED_BREAK_DAMAGE = "xg5_037_red_break_damage";
XG5_KEYWORDS["XG5-037::red_break"] = (state, ctx) => {
  const enemyId = opp(ctx.playerId);
  const ids = fieldUnits(state, enemyId).filter((c) => isSUnit(state, c) && selectableEnemy(state, ctx.playerId, "XG5-037", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_037:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-037", RED_BREAK, ids, true)), detail: RED_BREAK };
};
CHOICE_RESOLVERS[RED_BREAK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "XG5-037", `${RED_BREAK}:${instanceId}`);
  if (state.players[playerId].hand.length <= 1) {
    return { state: openNext(cleared, pending, { ...confirmChoice(pendingBase(pending), "XG5-037", RED_BREAK_DAMAGE), xg5Meta: { target: instanceId } }), log };
  }
  return { state: proceed(moveFieldUnit(cleared, opp(playerId), instanceId, pending.phasePlayerId, "hand"), pending), log };
};
CHOICE_SKIPPERS[RED_BREAK] = simpleSkip();
CHOICE_RESOLVERS[RED_BREAK_DAMAGE] = () => ({ error: "invalid_target" });
CHOICE_CONFIRMERS[RED_BREAK_DAMAGE] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), pending.xg5Meta!.target!, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-037", `${RED_BREAK_DAMAGE}:damage`) };
};
CHOICE_SKIPPERS[RED_BREAK_DAMAGE] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), pending.xg5Meta!.target!, pending.phasePlayerId, "hand");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-037", `${RED_BREAK_DAMAGE}:hand`) };
};

// ---------------------------------------------------------------------------
// XG5-038 ゴセイピンク【息吹のスカイックパワー】（NC）
// 「カテゴリを2つ以上持つ自軍Sユニットを1体選びリリースしてもよい。（自分の手札が1枚以下なら、カテゴリを2つ以上持つ自軍Sユニットを2体選んでもよい）」
// （atwiki/page-2202）。選べるのはホールド状態のもの。カテゴリはいまのカテゴリ。

const SKYICK = "xg5_038_skyick";
XG5_KEYWORDS["XG5-038::skyick"] = (state, ctx) => {
  const pid = ctx.playerId;
  const ids = fieldUnits(state, pid).filter((c) => c.commandHeld && isSUnit(state, c) && fieldCategories(state, pid, c).length >= 2).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_038:no_targets" };
  const max = state.players[pid].hand.length <= 1 ? 2 : 1;
  return { state: openAfter(state, multiChoice(ctxBase(ctx), "XG5-038", SKYICK, ids, max)), detail: SKYICK };
};
registerMulti(SKYICK, (state, pending, ids) => ids.reduce((s, id) => setFieldHeld(s, pending.playerId, id, false), state));

// ---------------------------------------------------------------------------
// XG5-039 ゴセイブルー【ブルーチェック】（NC）
// 「敵軍コマンドゾーンから、自分の手札の枚数以上の必要パワーの数字を持つユニットカードを1枚選び捨札にする。（自分の手札が1枚以下なら、捨札にするかわりに
//  持ち主の山札の上に戻してもよい）」（atwiki/page-2203）。必要パワーの数字は印刷された数字。

const BLUE_CHECK = "xg5_039_blue_check";
const BLUE_PLACE = "xg5_039_blue_place";
function enemyCommandTo(state: GameState, enemyId: PlayerId, instanceId: string, to: "discard" | "deck_top"): GameState {
  return patchPlayer(state, enemyId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const command = p.command.filter((c) => c.instanceId !== instanceId);
    return to === "discard" ? { ...p, command, discard: [...p.discard, stripForZone(card)] } : { ...p, command, deck: [stripForZone(card), ...p.deck] };
  });
}
XG5_KEYWORDS["XG5-039::blue_check"] = (state, ctx) => {
  const h = state.players[ctx.playerId].hand.length;
  const ids = state.players[opp(ctx.playerId)].command
    .filter((c) => defOf(state, c.cardId)?.type === "unit" && printedCostNumber(state, c.cardId) >= h)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_039:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-039", BLUE_CHECK, ids, false)), detail: BLUE_CHECK };
};
CHOICE_RESOLVERS[BLUE_CHECK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "XG5-039", `${BLUE_CHECK}:${instanceId}`);
  if (state.players[playerId].hand.length <= 1) {
    return { state: openNext(cleared, pending, { ...selectOne(pendingBase(pending), "XG5-039", BLUE_PLACE, ["deck_top", "discard"], false), xg5Meta: { target: instanceId } }), log };
  }
  return { state: proceed(enemyCommandTo(cleared, opp(playerId), instanceId, "discard"), pending), log };
};
CHOICE_RESOLVERS[BLUE_PLACE] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  const next = enemyCommandTo(close(state, pending), opp(playerId), pending.xg5Meta!.target!, where === "deck_top" ? "deck_top" : "discard");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-039", `${BLUE_PLACE}:${where}`) };
};

// ---------------------------------------------------------------------------
// XG5-040 ゴセイブラック【スネークバレット】（NC）
// 「「SP1」自軍コマンドゾーンにないカテゴリを持つ敵軍Sユニットを1体選び撃破する。（自分の手札が1枚以下なら、敵軍Sユニットを選ぶとき、自軍コマンドゾーンに
//  あるカテゴリを持つ敵軍Sユニットを選んでもよい）」（atwiki/page-2241）。コマンドゾーンのカテゴリは本来のカテゴリ、敵軍ユニットはいまのカテゴリ。

const SNAKE = "xg5_040_snake_bullet";
XG5_KEYWORDS["XG5-040::snake_bullet"] = (state, ctx) => {
  const pid = ctx.playerId;
  const enemyId = opp(pid);
  const cmdCats = new Set(state.players[pid].command.flatMap((c) => printedCategories(state, c.cardId)));
  const any = state.players[pid].hand.length <= 1;
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isSUnit(state, c) && (any || fieldCategories(state, enemyId, c).some((cat) => !cmdCats.has(cat))) && selectableEnemy(state, pid, "XG5-040", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_040:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-040", SNAKE, ids, false)), detail: SNAKE };
};
CHOICE_RESOLVERS[SNAKE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG5-040", `${SNAKE}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-040", `${SNAKE}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// 継続効果・ほかの処理の場所から発動する効果（DSL からは何もしない）。
XG5_KEYWORDS["XG5-025::aerial_check"] = noop("xg5_025:aerial_check");
XG5_KEYWORDS["XG5-029::gangan_knuckle"] = noop("xg5_029:gangan_knuckle");
XG5_KEYWORDS["XG5-031::gazelle_leg"] = noop("xg5_031:gazelle_leg");
XG5_KEYWORDS["XG5-032::jet_board"] = noop("xg5_032:jet_board");
XG5_KEYWORDS["XG5-034::samurai_bp"] = noop("xg5_034:samurai_bp");
XG5_KEYWORDS["XG5-034::nitoryu"] = noop("xg5_034:nitoryu");
