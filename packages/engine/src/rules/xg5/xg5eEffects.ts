/**
 * クロスギャザー XG5 XG5-081〜XG5-096（仮面ライダーアクセルトライアル〜ギルの笛の音）のカード固有の効果（cardSpec XG5-081-096 の監査）。
 * 登録先は rules/xg5/xg5Core.ts。継続効果の判定（BP・SP・アタックできない相手・本来の BP のバトル・カテゴリの追加・可能ならバトルエリアに出る・
 * XG5-087 のバトルフェイズ終了時の選択）は rules/xg5/xg5Fields.ts。
 */
import { openDeckLook } from "../deckLook";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingStrike, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { effectiveBp } from "../../core/catalog";
import { addTurnRestrictionModifier } from "../../core/scopedModifiers";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { applyDamageToPlayer } from "../damagePayment";
import { strikeDamageFor } from "../combo";
import { tryOpenEndTurnEffectsMenu } from "../legend3/endTurnEffects";
import { patchPlayer } from "../playerPatches";
import {
  close,
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
  printedBp,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";
import {
  AFTER_ACTION_HOOKS,
  ATTACKED_HOOKS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  HAND_ACTIVATIONS,
  XG5_KEYWORDS,
  noop,
} from "./xg5Core";
import { XG5_CANNON, printedCostNumber, xg5CostNumber, xg5Flags, xg5TurnPlayer } from "./xg5Fields";
import { addFlag, defOf, fieldCategories, isNamed, opp, patchXg5, printedCategories, printedFeatures, selectOne, sizeOf, xg5Busy } from "./xg5Shared";

function isUnit(state: GameState, c: CardInstance): boolean {
  return defOf(state, c.cardId)?.type === "unit";
}
function isSUnit(state: GameState, c: CardInstance): boolean {
  return isUnit(state, c) && sizeOf(state, c) === "S";
}
function removeFlags(state: GameState, kind: string, pred: (f: { target?: string }) => boolean = () => true): GameState {
  return patchXg5(state, (x) => ({ ...x, flags: (x.flags ?? []).filter((f) => f.kind !== kind || !pred(f)) }));
}

// ---------------------------------------------------------------------------
// XG5-081 仮面ライダーアクセルトライアル【絶望がお前のゴールだ】
// 「これがストライクして敵軍パワーゾーンのカードがウラ向きになったとき、そのカードの必要パワーの数字以下の必要パワーを持つ敵軍Sユニットを1体選び撃破する。」
// （atwiki/page-2236）。ストライクのダメージ（パワーのウラ返し）を処理したアクションの後処理で、オモテ向きからウラ向きになった敵軍パワーのカードごとに選ぶ。
// 山札からダメージになったカード（はじめからウラ向き）は数えない。数字はウラ向きになったカードの印刷された数字、敵軍ユニットはいまの数字。

const DESPAIR = "xg5_081_despair";
function strikeOf(state: GameState): PendingStrike | undefined {
  if (state.pendingStrike) return state.pendingStrike;
  const resume = state.pendingDamagePayment?.resume;
  return resume?.kind === "strike" ? resume.pending : undefined;
}
/** このアクションでストライクを処理した XG5-081（処理中のストライク、または新しいログのストライク）。 */
function despairStriker(before: GameState, after: GameState): { pid: PlayerId; striker: CardInstance; phasePlayerId: PlayerId } | null {
  const strike = strikeOf(before);
  if (strike) {
    const striker = fieldCards(before, strike.strikerPlayerId).find((c) => c.instanceId === strike.strikerInstanceId);
    return striker && isSameCardIdentity(striker.cardId, "XG5-081") ? { pid: strike.strikerPlayerId, striker, phasePlayerId: strike.battlePhasePlayer } : null;
  }
  const fresh = after.log.slice(before.log.length);
  for (const pid of ["player1", "player2"] as const) {
    if (!fresh.some((l) => l.startsWith(`${pid}|strike|XG5-081|`))) continue;
    const striker = fieldCards(after, pid).find((c) => isSameCardIdentity(c.cardId, "XG5-081")) ?? fieldCards(before, pid).find((c) => isSameCardIdentity(c.cardId, "XG5-081"));
    if (striker) return { pid, striker, phasePlayerId: pid };
  }
  return null;
}
AFTER_ACTION_HOOKS.push((before, after) => {
  const found = despairStriker(before, after);
  if (!found) return after;
  const { pid, striker } = found;
  const strike = { battlePhasePlayer: found.phasePlayerId };
  const enemyId = opp(pid);
  const wasUp = new Set(before.players[enemyId].power.filter((c) => !c.faceDown).map((c) => c.instanceId));
  const flipped = after.players[enemyId].power.filter((c) => c.faceDown && wasUp.has(c.instanceId));
  let next = after;
  for (const card of flipped) {
    const n = printedCostNumber(after, card.cardId);
    if (!Number.isFinite(n)) continue;
    const ids = fieldUnits(next, enemyId)
      .filter((c) => isSUnit(next, c) && xg5CostNumber(next, pid, enemyId, c.cardId) <= n && selectableEnemy(next, pid, "XG5-081", c))
      .map((c) => c.instanceId);
    if (ids.length === 0) continue;
    next = openAfter(next, selectOne({ playerId: pid, phasePlayerId: strike.battlePhasePlayer, sourceInstanceId: striker.instanceId }, "XG5-081", DESPAIR, ids, false));
  }
  return next;
});
CHOICE_RESOLVERS[DESPAIR] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG5-081", `${DESPAIR}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-081", `${DESPAIR}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-082 バットショット（オペレーション）
// 「敵軍コマンドゾーンからSユニットのカードを1枚選び、敵軍ラッシュエリアに出してもよい。このとき、出したユニットの効果は発動しない。
//  その後、このカードを自軍コマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-2218）。
// 出したカードはリリース状態でラッシュエリアに置く（効果は発動しない）。このカードは処理を終えて捨札になってから、自軍コマンドゾーンに空きがあれば移す（flags の xg5-082-place）。

const BAT_SHOT = "xg5_082_bat_shot";
XG5_KEYWORDS["XG5-082::bat_shot"] = (state, ctx) => {
  const pid = ctx.playerId;
  const next = ctx.operationInstanceId ? addFlag(state, { kind: "xg5-082-place", playerId: pid, turn: state.turn, target: ctx.operationInstanceId }) : state;
  const enemyId = opp(pid);
  const ids = next.players[enemyId].command.filter((c) => isSUnit(next, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "xg5_082:no_targets" };
  return { state: openAfter(next, selectOne(ctxBase(ctx), "XG5-082", BAT_SHOT, ids, true)), detail: BAT_SHOT };
};
CHOICE_RESOLVERS[BAT_SHOT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    return card ? { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, { ...stripForZone(card), commandHeld: undefined }] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-082", `${BAT_SHOT}:${instanceId}`) };
};
CHOICE_SKIPPERS[BAT_SHOT] = simpleSkip();
AFTER_ACTION_HOOKS.push((_before, after) => {
  const flags = xg5Flags(after, "xg5-082-place");
  if (flags.length === 0 || xg5Busy(after)) return after;
  let next = removeFlags(after, "xg5-082-place");
  for (const f of flags) {
    if (!f.target) continue;
    next = patchPlayer(next, f.playerId, (p) => {
      const card = p.discard.find((c) => c.instanceId === f.target);
      if (!card || p.command.length >= COMMAND_ZONE_MAX) return p;
      return { ...p, discard: p.discard.filter((c) => c.instanceId !== f.target), command: [...p.command, { ...stripForZone(card), commandHeld: true }] };
    });
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG5-084 仮面ライダーW・CJ【『お前の罪を数えろ』】（RC）
// 「これは自軍捨札にSユニットのカードが5枚以上あれば、次の相手ターン中、次の効果を得る⇒これ以外のSユニットがアタックされたとき、アタックされたユニットの
//  かわりにこのユニットがバトルしてもよい。そうしたとき、そのバトル中、これはBP+3000される。」（atwiki/page-2227）。
// 枚数は RC の効果を処理したときに見る（flags の xg5-084。次の相手ターン＝ turn+1）。「アタックされたとき」（ATTACKED_HOOKS）に、これを選ぶか尋ねる。
// 選べば、アタックされたユニットのかわりにこれがバトルし（アタックの対象をこれに置き換える）、そのバトルの間 BP+3000。

const TSUMI = "xg5_084_tsumi";
XG5_KEYWORDS["XG5-084::tsumi"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self || !findField(state, ctx.playerId, self)) return { state, detail: "xg5_084:no_source" };
  const n = state.players[ctx.playerId].discard.filter((c) => isSUnit(state, c)).length;
  if (n < 5) return { state, detail: "xg5_084:not_enough" };
  return { state: addFlag(state, { kind: "xg5-084", playerId: ctx.playerId, turn: state.turn + 1, target: self }), detail: "xg5_084:granted" };
};
ATTACKED_HOOKS.push((state, battle, wingAttackFromRush) => {
  if (battle.effectBattle || battle.battleCancelled || battle.substituteInstanceId) return null;
  const defenderId = battle.defenderPlayerId;
  const defender = findField(state, defenderId, battle.defenderInstanceId);
  if (!defender || !isSUnit(state, defender)) return null;
  const key = `${battle.attackerInstanceId}>${battle.defenderInstanceId}`;
  if (xg5Flags(state, "xg5-084-asked").some((f) => f.target === key)) return null;
  const ids = xg5Flags(state, "xg5-084")
    .filter((f) => f.playerId === defenderId && f.turn === state.turn && f.target && f.target !== defender.instanceId && findField(state, defenderId, f.target))
    .map((f) => f.target!);
  if (ids.length === 0) return null;
  const marked = addFlag(state, { kind: "xg5-084-asked", playerId: defenderId, turn: state.turn, target: key });
  return {
    ...openAfter({ ...marked, deferredAttack: { battle, wingAttackFromRush } }, selectOne({ playerId: defenderId, phasePlayerId: battle.phasePlayerId }, "XG5-084", TSUMI, [...new Set(ids)], true)),
    activePlayer: defenderId,
  };
});
AFTER_ACTION_HOOKS.push((_before, after) => {
  if (after.deferredAttack || !xg5Flags(after, "xg5-084-asked").length || after.pendingEffectChoice?.effectId === TSUMI) return after;
  return removeFlags(after, "xg5-084-asked");
});
CHOICE_RESOLVERS[TSUMI] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const deferred = next.deferredAttack;
  if (deferred) {
    next = { ...next, deferredAttack: { ...deferred, battle: { ...deferred.battle, defenderInstanceId: instanceId, defenderBpBonus: (deferred.battle.defenderBpBonus ?? 0) + 3000 } } };
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-084", `${TSUMI}:${instanceId}`) };
};
CHOICE_SKIPPERS[TSUMI] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-086 グランナスカ・コンバットフォーメーション【ナックルボンバー】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからMユニットを1体選び、持ち主のパワーゾーンに送ってもよい。」（atwiki/page-2248）。

const KNUCKLE = "xg5_086_knuckle_bomber";
XG5_KEYWORDS["XG5-086::knuckle_bomber"] = (state, ctx) => {
  if (xg5TurnPlayer(state) !== ctx.playerId) return { state, detail: "xg5_086:enemy_turn" };
  const enemyId = opp(ctx.playerId);
  const ids = state.players[enemyId].battle.filter((c) => isUnit(state, c) && sizeOf(state, c) === "M" && selectableEnemy(state, ctx.playerId, "XG5-086", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_086:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-086", KNUCKLE, ids, true)), detail: KNUCKLE };
};
CHOICE_RESOLVERS[KNUCKLE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-086", `${KNUCKLE}:${instanceId}`) };
};
CHOICE_SKIPPERS[KNUCKLE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-087 グランナスカ・カノンフォーメーション【ビッグバンカノン】
// 「これが自軍エリアにある間、自軍バトルフェイズ終了時、自軍バトルエリアからOTを持つSユニットを1体選んでもよい。そうしたとき、選んだ自軍ユニットのBP以下の
//  BPを持つ敵軍ユニットを1体選び撃破する。その後、選んだ自軍ユニットのSPが1以上だったなら、相手に1点ダメージを与える。」（atwiki/page-2276）。
// 最初の選択はエンドフェイズの選択（rules/xg5/xg5Fields.ts xg5EndTurnChoice）。BP・SP はいまの値。撃破できる敵軍ユニットがなくても、SP が1以上ならダメージを与える。

const CANNON_TARGET = "xg5_087_cannon_target";
function continueEndTurn(state: GameState, turnPlayerId: PlayerId): GameState {
  if (state.pendingEffectChoice || state.pendingDamagePayment || state.phase !== "end") return state;
  return tryOpenEndTurnEffectsMenu(state, turnPlayerId) ?? state;
}
function cannonDamage(state: GameState, playerId: PlayerId, unitId: string | undefined, phasePlayerId: PlayerId): GameState {
  const unit = unitId ? findField(state, playerId, unitId) : undefined;
  if (!unit || strikeDamageFor(state.definitions, unit, state, playerId) < 1) return state;
  return applyDamageToPlayer(state, opp(playerId), 1, { kind: "none", activePlayer: phasePlayerId });
}
CHOICE_RESOLVERS[XG5_CANNON] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const unit = findField(next, playerId, instanceId);
  const log = logFor(state, playerId, "XG5-087", `${XG5_CANNON}:${instanceId}`);
  const enemyId = opp(playerId);
  const bp = unit ? effectiveBp(next, playerId, unit) : -1;
  const ids = fieldUnits(next, enemyId).filter((c) => isUnit(next, c) && effectiveBp(next, enemyId, c) <= bp && selectableEnemy(next, playerId, "XG5-087", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state: continueEndTurn(proceed(cannonDamage(next, playerId, instanceId, pending.phasePlayerId), pending), pending.phasePlayerId), log };
  return { state: openNext(next, pending, { ...selectOne(pendingBase(pending), "XG5-087", CANNON_TARGET, ids, false), xg5Meta: { target: instanceId } }), log };
};
CHOICE_SKIPPERS[XG5_CANNON] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: continueEndTurn(proceed(close(state, pending), pending), pending.phasePlayerId), log: logFor(state, playerId, "XG5-087", `${XG5_CANNON}:pass`) };
};
CHOICE_RESOLVERS[CANNON_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = destroyAll(close(state, pending), pendingBase(pending), "XG5-087", `${CANNON_TARGET}_destroy`, [instanceId]);
  next = cannonDamage(next, playerId, pending.xg5Meta?.target, pending.phasePlayerId);
  return { state: continueEndTurn(proceed(next, pending), pending.phasePlayerId), log: logFor(state, playerId, "XG5-087", `${CANNON_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-089 カバドスSM ※
// 「※これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「カバドス」のカードを1枚選び、自軍ラッシュエリアに出す。」（atwiki/page-2222）。
// 候補が1枚でも選ぶ（見送れない）。出すのは効果のラッシュ（必要パワー・追加条件を問わない）。【マサカリホーク】の BP は rules/xg5/xg5Fields.ts。

const KABADOS = "xg5_089_kabados";
XG5_KEYWORDS["XG5-089::kabados"] = (state, ctx) => {
  const p = state.players[ctx.playerId];
  const ids = [...p.command, ...p.discard].filter((c) => isNamed(state, c.cardId, "カバドス")).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_089:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-089", KABADOS, ids, false)), detail: KABADOS };
};
CHOICE_RESOLVERS[KABADOS] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId) ?? p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return {
      ...p,
      command: p.command.filter((c) => c.instanceId !== instanceId),
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      rush: [...p.rush, { ...stripForZone(card), commandHeld: undefined }],
    };
  });
  if (next.players[playerId].rush.some((c) => c.instanceId === instanceId)) {
    const rushed = finalizeEffectRush(next, playerId, [instanceId], pending.phasePlayerId);
    next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-089", `${KABADOS}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-091 キカイダー01【ブラストエンド】（RC）
// 「SP1 特徴「メカ」を持つかカテゴリにDAを持つ敵軍Sユニットを1体選び撃破してもよい。そうしたとき、このターン、これはストライクすることができない。」
// （atwiki/page-2238）。RC の効果を処理したとき、このターンの SP1（flags の xg5-091。SP は rules/xg5/xg5Fields.ts）を得る。
// ストライクできない制限はターンの制限 xg5_no_strike_this_turn（rules/keywordGapRuntime.ts battleActBlocked）。DA はいまのカテゴリで見る。

const BLAST_END = "xg5_091_blast_end";
XG5_KEYWORDS["XG5-091::blast_end"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self || !findField(state, ctx.playerId, self)) return { state, detail: "xg5_091:no_source" };
  const next = addFlag(state, { kind: "xg5-091", playerId: ctx.playerId, turn: state.turn, target: self });
  const enemyId = opp(ctx.playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => isSUnit(next, c) && (printedFeatures(next, c.cardId).includes("メカ") || fieldCategories(next, enemyId, c).includes("DA")) && selectableEnemy(next, ctx.playerId, "XG5-091", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "xg5_091:sp1" };
  return { state: openAfter(next, selectOne(ctxBase(ctx), "XG5-091", BLAST_END, ids, true)), detail: BLAST_END };
};
CHOICE_RESOLVERS[BLAST_END] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = destroyAll(close(state, pending), pendingBase(pending), "XG5-091", `${BLAST_END}_destroy`, [instanceId]);
  const self = pending.sourceInstanceId;
  if (self) next = patchPlayer(next, playerId, (p) => addTurnRestrictionModifier(p, self, "xg5_no_strike_this_turn"));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-091", `${BLAST_END}:${instanceId}`) };
};
CHOICE_SKIPPERS[BLAST_END] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-092 ビジンダー【天使と悪魔】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンにあるカテゴリが1つだけなら、そのカテゴリごとに次の効果を発動できる⇒DAなら、敵軍Sユニットを
//  1体選び、このユニットと選んだユニットを撃破する。DA以外なら、敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く
//  （置けなければ捨札にする）。」（atwiki/page-2224）。コマンドのカテゴリは印刷されたカテゴリ（リリース・ホールドを問わない）。選ぶことが発動の宣言。

const DEVIL = "xg5_092_devil";
const ANGEL = "xg5_092_angel";
XG5_KEYWORDS["XG5-092::angel_devil"] = (state, ctx) => {
  const pid = ctx.playerId;
  const self = ctx.triggerSourceInstanceId;
  if (xg5TurnPlayer(state) !== pid || !self || !findField(state, pid, self)) return { state, detail: "xg5_092:no_effect" };
  const cats = new Set(state.players[pid].command.flatMap((c) => printedCategories(state, c.cardId)));
  if (cats.size !== 1) return { state, detail: "xg5_092:categories" };
  const enemyId = opp(pid);
  const da = cats.has("DA");
  const pool = da ? fieldUnits(state, enemyId) : state.players[enemyId].battle;
  const ids = pool.filter((c) => isSUnit(state, c) && selectableEnemy(state, pid, "XG5-092", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_092:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-092", da ? DEVIL : ANGEL, ids, true)), detail: da ? DEVIL : ANGEL };
};
CHOICE_RESOLVERS[DEVIL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ids = [instanceId, ...(pending.sourceInstanceId && findField(state, playerId, pending.sourceInstanceId) ? [pending.sourceInstanceId] : [])];
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG5-092", `${DEVIL}_destroy`, ids);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-092", `${DEVIL}:${instanceId}`) };
};
CHOICE_RESOLVERS[ANGEL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-092", `${ANGEL}:${instanceId}`) };
};
CHOICE_SKIPPERS[DEVIL] = simpleSkip();
CHOICE_SKIPPERS[ANGEL] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-093 ダブルブラザーパワー（オペレーション）
// 「特徴「人型」を持つ自軍ユニットを2体選び、選んだ2体の本来のBPを合計する。そして、合計したBP以下の敵軍ユニットを1体選び、持ち主のコマンドゾーンに
//  ホールド状態で置く。置けなければ捨札にする。」（atwiki/page-2273）。1体ずつ選ぶ。「人型」が2体いなければ何もしない。敵軍ユニットの BP はいまの BP。

const DBP_FIRST = "xg5_093_first";
const DBP_SECOND = "xg5_093_second";
const DBP_TARGET = "xg5_093_target";
function humanoids(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId).filter((c) => isUnit(state, c) && printedFeatures(state, c.cardId).includes("人型")).map((c) => c.instanceId);
}
XG5_KEYWORDS["XG5-093::double_brother"] = (state, ctx) => {
  const ids = humanoids(state, ctx.playerId);
  if (ids.length < 2) return { state, detail: "xg5_093:no_pair" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-093", DBP_FIRST, ids, false)), detail: DBP_FIRST };
};
CHOICE_RESOLVERS[DBP_FIRST] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const ids = humanoids(next, playerId).filter((id) => id !== instanceId);
  const log = logFor(state, playerId, "XG5-093", `${DBP_FIRST}:${instanceId}`);
  return { state: openNext(next, pending, { ...selectOne(pendingBase(pending), "XG5-093", DBP_SECOND, ids, false), xg5Meta: { target: instanceId } }), log };
};
CHOICE_RESOLVERS[DBP_SECOND] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const sum = [pending.xg5Meta?.target, instanceId].reduce((n, id) => {
    const c = id ? findField(next, playerId, id) : undefined;
    const bp = c ? printedBp(next, c.cardId) : 0;
    return n + (Number.isFinite(bp) ? bp : 0);
  }, 0);
  const enemyId = opp(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => isUnit(next, c) && effectiveBp(next, enemyId, c) <= sum && selectableEnemy(next, playerId, "XG5-093", c)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG5-093", `${DBP_SECOND}:${instanceId}:${sum}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-093", DBP_TARGET, ids, false)), log };
};
CHOICE_RESOLVERS[DBP_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-093", `${DBP_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-094 ギルハカイダー【ハカイダー部隊の決起】
// 「これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ次の効果を発動できる⇒自軍山札を見て、DAを持ち特徴「メカ」を持つSユニットのカードを1枚選び、
//  相手に見せてから手札に加えてもよい。その後、山札をシャッフルし、自分の手札を1枚選び捨札にする。」（atwiki/page-2280）。
// 合法手は activate_field_unit_ability（場のこのカード）。1度だけは、このカードごとではなく自分のラッシュフェイズごと（flags の xg5-094）。

const HAKAI_SEARCH = "xg5_094_search";
const HAKAI_DISCARD = "xg5_094_discard";
function hakaiTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].deck
    .filter((c) => isSUnit(state, c) && printedCategories(state, c.cardId).includes("DA") && printedFeatures(state, c.cardId).includes("メカ"))
    .map((c) => c.instanceId);
}
function hakaiDiscardStep(state: GameState, pending: Parameters<typeof pendingBase>[0]): GameState {
  const next = shuffleDeck(state, pending.playerId);
  const ids = next.players[pending.playerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return proceed(next, pending);
  return openNext(next, pending, selectOne(pendingBase(pending), "XG5-094", HAKAI_DISCARD, ids, false));
}
HAND_ACTIVATIONS.push({
  list: (state, playerId) => {
    if (state.phase !== "rush" || xg5TurnPlayer(state) !== playerId || state.activePlayer !== playerId || xg5Busy(state)) return [];
    if (xg5Flags(state, "xg5-094").some((f) => f.playerId === playerId && f.turn === state.turn)) return [];
    return fieldCards(state, playerId).filter((c) => isSameCardIdentity(c.cardId, "XG5-094")).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    if (!findField(state, playerId, instanceId)) return null;
    const marked = addFlag(state, { kind: "xg5-094", playerId, turn: state.turn, target: instanceId });
    const ctx = { playerId, phasePlayerId: playerId, sourceInstanceId: instanceId };
    const ids = hakaiTargets(marked, playerId);
    if (ids.length > 0) return openAfter(marked, selectOne(ctx, "XG5-094", HAKAI_SEARCH, ids, true));
    // 選べるカードがなくても山札を見る窓を開く（rules/deckLook.ts）。手札を捨てる選択はその後。
    const shuffled = openDeckLook(shuffleDeck(marked, playerId), ctx, "XG5-094");
    const hand = shuffled.players[playerId].hand.map((c) => c.instanceId);
    return hand.length > 0 ? openAfter(shuffled, selectOne(ctx, "XG5-094", HAKAI_DISCARD, hand, false)) : shuffled;
  },
});
CHOICE_RESOLVERS[HAKAI_SEARCH] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] } : p;
  });
  return { state: hakaiDiscardStep(next, pending), log: logFor(state, playerId, "XG5-094", `${HAKAI_SEARCH}:${instanceId}`) };
};
CHOICE_SKIPPERS[HAKAI_SEARCH] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: hakaiDiscardStep(close(state, pending), pending), log: logFor(state, playerId, "XG5-094", `${HAKAI_SEARCH}:pass`) };
};
CHOICE_RESOLVERS[HAKAI_DISCARD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    return card ? { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] } : p;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-094", `${HAKAI_DISCARD}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-095 ブラックドラゴン【サタンダークネス】
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を自分、相手の順に行う⇒対戦相手のパワーゾーンから、オモテ向きのユニットカードを1体選びダメージにする。」
// （atwiki/page-2177）。自分が相手のパワーゾーンから選び、次に相手が自分のパワーゾーンから選ぶ（見送れない）。ダメージにする＝ウラ向きにしてダメージ+1。

const SATAN = "xg5_095_satan";
function satanTargets(state: GameState, chooser: PlayerId): string[] {
  return state.players[opp(chooser)].power.filter((c) => !c.faceDown && defOf(state, c.cardId)?.type === "unit").map((c) => c.instanceId);
}
function satanStep(state: GameState, ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string }, chooser: PlayerId, step: "first" | "second"): GameState | null {
  const ids = satanTargets(state, chooser);
  if (ids.length === 0) return null;
  return openAfter(state, { ...selectOne({ ...ctx, playerId: chooser }, "XG5-095", SATAN, ids, false), xg5Meta: { step } });
}
XG5_KEYWORDS["XG5-095::satan_darkness"] = (state, ctx) => {
  if (xg5TurnPlayer(state) !== ctx.playerId) return { state, detail: "xg5_095:enemy_turn" };
  const base = { playerId: ctx.playerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId };
  const opened = satanStep(state, base, ctx.playerId, "first") ?? satanStep(state, base, opp(ctx.playerId), "second");
  return { state: opened ?? state, detail: opened ? SATAN : "xg5_095:no_targets" };
};
CHOICE_RESOLVERS[SATAN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = opp(playerId);
  let next = patchPlayer(close(state, pending), ownerId, (p) => ({
    ...p,
    power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)),
    damage: p.damage + 1,
  }));
  const log = logFor(state, playerId, "XG5-095", `${SATAN}:${instanceId}`);
  if (pending.xg5Meta?.step === "first") {
    const ids = satanTargets(next, ownerId);
    if (ids.length > 0) {
      next = openNext(next, pending, { ...selectOne({ ...pendingBase(pending), playerId: ownerId }, "XG5-095", SATAN, ids, false), xg5Meta: { step: "second" } });
      return { state: next, log };
    }
  }
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// 継続効果・ほかの処理の場所から発動する効果（DSL からは何もしない）。
XG5_KEYWORDS["XG5-081::despair"] = noop("xg5_081:despair");
XG5_KEYWORDS["XG5-085::warp"] = noop("xg5_085:warp");
XG5_KEYWORDS["XG5-087::big_bang_cannon"] = noop("xg5_087:big_bang_cannon");
XG5_KEYWORDS["XG5-088::chikara_makase"] = noop("xg5_088:chikara_makase");
XG5_KEYWORDS["XG5-089::masakari_hawk"] = noop("xg5_089:masakari_hawk");
XG5_KEYWORDS["XG5-090::yujo"] = noop("xg5_090:yujo");
XG5_KEYWORDS["XG5-091::no_gender_attack"] = noop("xg5_091:no_gender_attack");
XG5_KEYWORDS["XG5-091::no_face_up_power"] = noop("xg5_091:no_face_up_power");
XG5_KEYWORDS["XG5-094::kekki"] = noop("xg5_094:kekki");
XG5_KEYWORDS["XG5-096::gill_flute"] = noop("xg5_096:gill_flute");
