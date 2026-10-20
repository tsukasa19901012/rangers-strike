/**
 * クロスギャザー ザ・ギガンティックタイタン XG6-023〜XG6-044（データスハイパー〜仮面ライダーNEW電王SF）のカード固有の効果
 * （cardSpec XG6-023-044 の監査）。
 *
 * DSL の grant_keyword（`xg6::XG6-NNN::name`）から呼ばれる効果と、ほかの処理の場所から呼ばれる効果:
 * - `applyXg6StrikeDamageTriggers`: XG6-025【ここからは私のターンだ】（ダメージを受けたとき）・XG6-042【ゼロのスタート】
 *   （ストライクしてダメージを与えたとき。core/applyAction.ts の finishStrikeResolution）。
 * - `applyXg6AfterAction` / `takeXg6BattlePhaseEnd`: XG6-042 の※（手札が0枚のとき撃破）・XG6-025 のバトルフェイズの終了
 *   （core/applyAction.ts の後処理）。
 * - `applyXg6StartPhaseBegin`: XG6-042【ゼロのスタート】（次の相手のスタートフェイズにドローできない。rules/startPhaseBegin.ts）。
 * - `openXg6StayOnLeave`: XG6-031 の※（自軍捨札を3枚除外して留まる。rules/operationCounters.ts の tryLeaveField）。
 * - `xg6OnAttackWin`: XG6-035【ビッカーチャージブレイク】（アタックして撃破したとき。rules/operationCounters.ts）。
 * 継続効果（BP・SP・アタック・ラッシュ・進入・ストライクの制限・レジスト・カテゴリ）は rules/xg6/xg6Fields.ts。
 */
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import { effectiveBp, unitSizeOf } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { advancePhase, loseDamageThreshold } from "../../core/createGame";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { applyDamageToPlayer } from "../damagePayment";
import { recordReveal } from "../revealNotice";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { finalizeLeaveReaction, resolveBattlePending, tryLeaveField } from "../operationCounters";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { tryOpenEndTurnEffectsMenu } from "../legend3/endTurnEffects";
import { openEffectChoice } from "../pendingChoices";
import {
  appendResume,
  type BaseCtx,
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
  shuffleDeck,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG6_DONE, XG6_KEYWORDS, costNumber, finish, isCard, noop, setHeld, skipped } from "./xg6Common";
import { addXg6Mark } from "./xg6Fields";
import { choice, currentCats, def, isUnitDef, relocateFieldUnit, turnPlayer } from "./xg6aEffects";

type Outcome = { state: GameState; log?: string };

function isSmall(state: GameState, card: CardInstance): boolean {
  return unitSizeOf(state.definitions, card) === "S";
}

function selfOf(state: GameState, pending: PendingEffectChoice): CardInstance | undefined {
  return pending.sourceInstanceId ? findField(state, pending.playerId, pending.sourceInstanceId) : undefined;
}

// ---------------------------------------------------------------------------
// XG6-024 ゴセイナイト【ナイトダイナミック】（NC）
// 「「SP1」OTまたはETまたはDAを持つ敵軍Sユニットを1体選び撃破する。その後、自分の手札が1枚以下なら、これをリリースする。」（atwiki/page-2348）
// 「SP1」は DSL の SP1。敵軍 S ユニットはエリアを問わない（カード評価）。手札の枚数は撃破で変わらないので、リリースは選択を開く前に行う。

const KNIGHT_DYNAMIC = "xg6024_knight_dynamic";

function applyKnightDynamic(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  let next = state;
  const self = selfId ? findField(next, ctx.playerId, selfId) : undefined;
  if (self?.commandHeld && next.players[ctx.playerId].hand.length <= 1) next = setHeld(next, ctx.playerId, self.instanceId, false);
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => isSmall(next, c) && currentCats(next, enemyId, c).some((cat) => cat === "OT" || cat === "ET" || cat === "DA") && selectableEnemy(next, ctx.playerId, "XG6-024", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "xg6024:no_target" };
  return { state: openAfter(next, genericPick(ctxBase(ctx), "XG6-024", KNIGHT_DYNAMIC, ids, false, "discard")), detail: KNIGHT_DYNAMIC };
}

// ---------------------------------------------------------------------------
// XG6-025 ゴセイグランド【ここからは私のターンだ】
// 「これが自軍バトルエリアにある間、敵軍バトルフェイズ中、自分がダメージを受けたとき、自分の手札が1枚以上あればすべて捨札にしてもよい。そうしたとき、
//  そのバトルフェイズを終了する。」（atwiki/page-2349）。ストライクでダメージを受けたときに尋ねる。バトルフェイズの終了は core/applyAction.ts の後処理。

const MY_TURN = "xg6025_my_turn";

// ---------------------------------------------------------------------------
// XG6-042 仮面ライダーゼロノスAF【ゼロのスタート】
// 「これがストライクしてダメージを与えたとき、相手に1枚ドローさせてもよい。そうしたとき、次の相手ターンのスタートフェイズ中、相手は山札からカードを
//  ドローできない。」（atwiki/page-2347）

const ZERO_START = "xg6042_zero_start";

export function applyXg6StrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  const strikerId = pending.strikerPlayerId;
  const defenderId = opponent(strikerId);
  let next = state;
  if (pending.battlePhasePlayer === strikerId && next.players[defenderId].hand.length > 0) {
    for (const card of next.players[defenderId].battle.filter((c) => isCard(c.cardId, "XG6-025"))) {
      next = openAfter(next, confirmChoice({ playerId: defenderId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: card.instanceId }, "XG6-025", MY_TURN));
    }
  }
  const striker = findField(next, strikerId, pending.strikerInstanceId);
  if (striker && isCard(striker.cardId, "XG6-042")) {
    next = openAfter(next, confirmChoice({ playerId: strikerId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: striker.instanceId }, "XG6-042", ZERO_START));
  }
  return next;
}

CHOICE_RESOLVERS[MY_TURN] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[MY_TURN] = simpleSkip();
CHOICE_CONFIRMERS[MY_TURN] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const hand = state.players[playerId].hand;
  if (hand.length === 0 || state.phase !== "battle") return finish(state, pending, "no_hand");
  return finish(state, pending, `discard:${hand.length}`, (s) => {
    const discarded = patchPlayer(s, playerId, (p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand.map(stripForZone)] }));
    return { ...discarded, xg6: { ...discarded.xg6, endBattlePhase: pending.phasePlayerId } };
  });
};

CHOICE_RESOLVERS[ZERO_START] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[ZERO_START] = simpleSkip();
CHOICE_CONFIRMERS[ZERO_START] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  return finish(state, pending, "draw", (s) => {
    const drawn = patchPlayer(s, enemyId, (p) => drawOne(p));
    const noStartDraw = [...(drawn.xg6?.noStartDraw ?? []).filter((e) => e.playerId !== enemyId), { playerId: enemyId, turn: drawn.turn }];
    return { ...drawn, xg6: { ...drawn.xg6, noStartDraw } };
  });
};

/** XG6-042: 記録した次の相手のスタートフェイズ（スタートフェイズに入った直後）。ドローを済ませたことにする。 */
export function applyXg6StartPhaseBegin(state: GameState, playerId: PlayerId): GameState {
  const entries = state.xg6?.noStartDraw ?? [];
  const mine = entries.find((e) => e.playerId === playerId && e.turn < state.turn);
  if (!mine) return state;
  const rest = entries.filter((e) => e !== mine);
  const next = patchPlayer(state, playerId, (p) => ({ ...p, hasDrawnThisStart: true }));
  return { ...next, xg6: { ...next.xg6, noStartDraw: rest.length > 0 ? rest : undefined } };
}

/** XG6-025: そのバトルフェイズを終了するプレイヤー（記録を消した状態と一緒に返す）。進行中の処理があれば待つ。 */
export function takeXg6BattlePhaseEnd(state: GameState): { state: GameState; playerId: PlayerId | null } | null {
  const playerId = state.xg6?.endBattlePhase;
  if (!playerId) return null;
  if (state.pendingEffectChoice || state.pendingLeave || state.pendingBattle || state.pendingStrike || state.pendingRegister) return null;
  const cleared: GameState = { ...state, xg6: { ...state.xg6, endBattlePhase: undefined } };
  if (cleared.phase !== "battle") return { state: cleared, playerId: null };
  return { state: cleared, playerId };
}

/** XG6-025: バトルフェイズを終える（end_phase と同じくエンドフェイズへ進め、ターンを終えるときの選択があれば開く）。 */
export function endXg6BattlePhase(state: GameState, playerId: PlayerId): GameState {
  const advanced: GameState = { ...advancePhase(state), endPhaseStep: "end_effects" };
  if (advanced.phase !== "end") return advanced;
  return tryOpenEndTurnEffectsMenu(advanced, playerId) ?? { ...advanced, endPhaseStep: "finalize" };
}

/** XG6-042 の※「自分の手札が0枚のとき、これを撃破する。」（進行中の処理がないときに確かめる）。 */
export function applyXg6AfterAction(state: GameState): GameState {
  if (state.winner || state.pendingEffectChoice || state.pendingLeave || state.pendingBattle || state.pendingStrike || state.pendingRegister) return state;
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    if (next.players[pid].hand.length > 0) continue;
    const ids = fieldUnits(next, pid).filter((c) => isCard(c.cardId, "XG6-042")).map((c) => c.instanceId);
    if (ids.length === 0) continue;
    next = destroyAll(next, { playerId: pid, phasePlayerId: turnPlayer(next), sourceInstanceId: ids[0] }, "XG6-042", "xg6042_zero_hand", ids);
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG6-026 グランディオン【グランディオンイレイザー】（NC）
// 「自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2350）
// 敵軍コマンドはホールド状態のものも選べる。

const ERASER_OWN = "xg6026_eraser_own";
const ERASER_ENEMY = "xg6026_eraser_enemy";

function applyEraser(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6026:no_command" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-026", ERASER_OWN, "select_command", ids, true)), detail: ERASER_OWN };
}

CHOICE_RESOLVERS[ERASER_OWN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId)!;
    return { ...p, command: p.command.filter((c) => c !== card), discard: [...p.discard, stripForZone(card)] };
  });
  const enemyIds = next.players[opponent(playerId)].command.map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG6-026", `${ERASER_OWN}:${instanceId}`);
  if (enemyIds.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, choice(pendingBase(pending), "XG6-026", ERASER_ENEMY, "select_command", enemyIds, false));
  return { state: next, log };
};
CHOICE_SKIPPERS[ERASER_OWN] = simpleSkip();
CHOICE_RESOLVERS[ERASER_ENEMY] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId)!;
    return { ...p, command: p.command.filter((c) => c !== card), power: [...p.power, { ...stripForZone(card), faceDown: true }], damage: p.damage + 1 };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-026", `${ERASER_ENEMY}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG6-027 シーレオン【青き海の獅子】・XG6-028 スカイオン【赤き空の獅子】
// 「これをラッシュしたとき、自軍山札の下（上）から1枚をオモテにする。オモテにしたカードが「シーレオン」（「スカイオン」）以外の特徴「獣」を持つユニット
//  カードなら、手札に加える。それ以外なら、オモテにしたカードを山札に戻してシャッフルする。」（atwiki/page-2286・page-2285）

function applyLion(from: "top" | "bottom", sourceCardId: string, label: string, excludedName: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const deck = state.players[ctx.playerId].deck;
    const shown = from === "top" ? deck[0] : deck[deck.length - 1];
    if (!shown) return { state, detail: `${sourceCardId}:empty_deck` };
    let next = recordReveal(state, { playerId: ctx.playerId, ownerId: ctx.playerId, sourceCardId, effectLabel: label, cards: [stripForZone(shown)] } as never);
    const d = def(next, shown.cardId);
    const take = isUnitDef(next, shown.cardId) && (d?.features ?? []).includes("獣") && d?.name !== excludedName;
    if (take) {
      next = patchPlayer(next, ctx.playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== shown.instanceId), hand: [...p.hand, stripForZone(shown)] }));
      return { state: next, detail: `${sourceCardId}:to_hand:${shown.instanceId}` };
    }
    return { state: shuffleDeck(next, ctx.playerId), detail: `${sourceCardId}:shuffle` };
  };
}

// ---------------------------------------------------------------------------
// XG6-029 強化スカイライダー【大反転スカイキック】（RC）
// 「これをラッシュエリアに戻してもよい。そうしたとき、敵軍バトルエリアからユニットを1体選び、これとバトルさせてもよい。その後、このターン、これは
//  バトルエリアに出られない。」（atwiki/page-2323）。バトルはアタックではない（効果のバトル）。

const SKY_KICK_RETURN = "xg6029_sky_kick_return";
const SKY_KICK_TARGET = "xg6029_sky_kick_target";

function applySkyKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ctx.triggerSourceInstanceId) return { state, detail: "xg6029:no_source" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG6-029", SKY_KICK_RETURN)), detail: SKY_KICK_RETURN };
}

/** 効果のバトル（アタックではない。rules/rk/rk10UnitEffects.ts と同じ）。 */
function effectBattle(state: GameState, pending: PendingEffectChoice, attackerId: PlayerId, attackerInstanceId: string, defenderInstanceId: string): GameState {
  const battled = resolveBattlePending(
    { ...state, activePlayer: pending.phasePlayerId },
    {
      attackerPlayerId: attackerId,
      attackerInstanceId,
      defenderPlayerId: opponent(attackerId),
      defenderInstanceId,
      phasePlayerId: pending.phasePlayerId,
      onAttackResolved: true,
      effectBattle: true,
    },
  ).state;
  if (battled.pendingEffectChoice || battled.pendingLeave || battled.pendingRegister) {
    if (!pending.resumeChoice) return battled;
    if (battled.pendingEffectChoice) return { ...battled, pendingEffectChoice: appendResume(battled.pendingEffectChoice, pending.resumeChoice) };
    return { ...battled, deferredDestroyTriggers: [...(battled.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice }] };
  }
  return proceed(battled, pending);
}

CHOICE_RESOLVERS[SKY_KICK_RETURN] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SKY_KICK_RETURN] = simpleSkip();
CHOICE_CONFIRMERS[SKY_KICK_RETURN] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  if (!selfId || zoneOfField(next, playerId, selfId) !== "battle") return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-029", `${SKY_KICK_RETURN}:not_in_battle`) };
  next = patchPlayer(next, playerId, (p) => {
    const self = p.battle.find((c) => c.instanceId === selfId)!;
    return { ...p, battle: p.battle.filter((c) => c !== self), rush: [...p.rush, { ...self, battleActed: undefined }] };
  });
  next = addXg6Mark(next, { key: "XG6-029:no_entry", playerId, instanceId: selfId });
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isUnitDef(next, c.cardId) && selectableEnemy(next, playerId, "XG6-029", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG6-029", `${SKY_KICK_RETURN}:return`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, choice(pendingBase(pending), "XG6-029", SKY_KICK_TARGET, "select_unit", ids, true)), log };
};
CHOICE_RESOLVERS[SKY_KICK_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const next = close(state, pending);
  if (!selfId || !findField(next, playerId, selfId)) return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-029", `${SKY_KICK_TARGET}:gone`) };
  return { state: effectBattle(next, pending, playerId, selfId, instanceId), log: logFor(state, playerId, "XG6-029", `${SKY_KICK_TARGET}:${instanceId}`) };
};
CHOICE_SKIPPERS[SKY_KICK_TARGET] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-031 ジョーカーアンデッド
// 【種の根絶】「これをラッシュしたとき、これ以外の自軍ユニットをすべて捨札にする。」（「SP3」は rules/xg6/xg6Fields.ts）。
// ※「これがユニットでなくなるとき、自軍捨札を3枚選びゲームから除外すれば、その場に留まる。」（atwiki/page-2327）。除外するかを最初に選び（見送れる）、
//  除外すると決めたら3枚を選ぶ。

const STAY = "xg6031_stay";

function applyEradication(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const ids = fieldUnits(state, ctx.playerId).filter((c) => c.instanceId !== selfId).map((c) => c.instanceId);
  const next = ids.reduce((s, id) => (findField(s, ctx.playerId, id) ? moveFieldUnit(s, ctx.playerId, id, ctx.phasePlayerId, "discard") : s), state);
  return { state: next, detail: `xg6031:discard:${ids.length}` };
}

export function openXg6StayOnLeave(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.xg6StayDeclined || state.pendingEffectChoice) return null;
  if (!isCard(intent.leavingCardId, "XG6-031")) return null;
  const discard = state.players[intent.ownerPlayerId].discard;
  if (discard.length < 3) return null;
  return openEffectChoice(state, {
    playerId: intent.ownerPlayerId,
    phasePlayerId: intent.phasePlayerId,
    effectId: STAY,
    sourceCardId: "XG6-031",
    sourceInstanceId: intent.instanceId,
    kind: "select_hand",
    validInstanceIds: discard.map((c) => c.instanceId),
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
    leaveIntentMeta: intent,
  });
}

CHOICE_RESOLVERS[STAY] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.leaveIntentMeta;
  if (!intent) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG6-031", `${STAY}:${instanceId}`);
  if (selected.length < 3) {
    // 除外すると決めたら3枚選ぶ（途中でやめられない）。
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId), optional: false } }, log };
  }
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => !selected.includes(c.instanceId)),
    exile: [...(p.exile ?? []), ...p.discard.filter((c) => selected.includes(c.instanceId)).map(stripForZone)],
  }));
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  if (pending.resumeChoice && !next.pendingEffectChoice) next = openEffectChoice(next, pending.resumeChoice);
  return { state: next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next), log };
};
CHOICE_SKIPPERS[STAY] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.leaveIntentMeta;
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  if (!intent) return { state: cleared };
  const left = tryLeaveField(cleared, { ...intent, xg6StayDeclined: true });
  const next = left.deferred ? left.state : promoteDeferredBattleEntry(left.state);
  return { state: next, log: logFor(state, playerId, "XG6-031", `${STAY}:declined`) };
};

// ---------------------------------------------------------------------------
// XG6-032 巨大邪神14 ※「これをラッシュしたとき、自軍Sユニットを1体選び、これの下にウラ向きで重ねる。」（atwiki/page-2288）。
// 重ねるのはユニットでなくなることではない（離場の処理は通さない。rules/legend1/otherLinesNamedEffects.ts の重ね方と同じ）。

const GIANT_STACK = "xg6032_stack";

function applyGiantStack(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return { state, detail: "xg6032:no_source" };
  const ids = fieldUnits(state, ctx.playerId).filter((c) => c.instanceId !== selfId && isSmall(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6032:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-032", GIANT_STACK, "select_unit", ids, false)), detail: GIANT_STACK };
}

CHOICE_RESOLVERS[GIANT_STACK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const targetId = pending.sourceInstanceId!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const unit = [...p.battle, ...p.rush].find((c) => c.instanceId === instanceId);
    if (!unit || ![...p.battle, ...p.rush].some((c) => c.instanceId === targetId)) return p;
    const strip = (zone: CardInstance[]) =>
      zone.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    const add = (zone: CardInstance[]) =>
      zone.map((c) => (c.instanceId === targetId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { ...stripForZone(unit), faceDown: true }] } : c));
    return { ...p, battle: add(strip(p.battle)), rush: add(strip(p.rush)), discard: [...p.discard, ...(unit.stackedCards ?? []).map(stripForZone)] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-032", `${GIANT_STACK}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG6-035 仮面ライダーW・CJX【ビッカーチャージブレイク】「また、これがアタックして敵軍ユニットを撃破したとき、これのBPが11000以上なら相手に1点ダメージを
//  与える。」（atwiki/page-2317）。BP の上昇とカテゴリの追加は rules/xg6/xg6Fields.ts。

export function xg6OnAttackWin(state: GameState, attackerId: PlayerId, attackerInstanceId: string): GameState {
  const unit = findField(state, attackerId, attackerInstanceId);
  if (!unit || !isCard(unit.cardId, "XG6-035") || state.winner) return state;
  if (effectiveBp(state, attackerId, unit) < 11000) return state;
  return applyDamageToPlayer(state, opponent(attackerId), 1, { kind: "none", activePlayer: state.activePlayer });
}

// ---------------------------------------------------------------------------
// XG6-036 仮面ライダーW・CJ【メモリチェンジ】（RC）
// 「カード名に「CJ」を含まない、モーフと特徴「ダブルドライバー」を持つユニットカードを自軍コマンドゾーンから1枚選び、これと置き換えてもよい。このとき
//  出したユニットは、ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する。」（atwiki/page-2321）
// 置き換えはモーフと同じ（選んだカードがこれの位置に出て、これはコマンドゾーンへ。R-KW-MORPH-02）。

const MEMORY_CHANGE = "xg6036_memory_change";

function hasMorph(state: GameState, cardId: string): boolean {
  const d = def(state, cardId);
  return /※モーフ/.test(d?.text ?? "") || ((d as { keywords?: string[] } | undefined)?.keywords ?? []).some((k) => k.toLowerCase() === "morph");
}

function applyMemoryChange(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return { state, detail: "xg6036:no_source" };
  const ids = state.players[ctx.playerId].command
    .filter((c) => {
      const d = def(state, c.cardId);
      return isUnitDef(state, c.cardId) && !(d?.name ?? "").normalize("NFKC").includes("CJ") && hasMorph(state, c.cardId) && (d?.features ?? []).includes("ダブルドライバー");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6036:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-036", MEMORY_CHANGE, "select_command", ids, true)), detail: MEMORY_CHANGE };
}

CHOICE_RESOLVERS[MEMORY_CHANGE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  const zone = selfId ? zoneOfField(next, playerId, selfId) : null;
  const picked = next.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!selfId || !zone || !picked) return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-036", `${MEMORY_CHANGE}:gone`) };
  const index = next.players[playerId][zone].findIndex((c) => c.instanceId === selfId);
  next = patchPlayer(next, playerId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId) }));
  next = relocateFieldUnit(next, playerId, selfId, pending.phasePlayerId, "command", { commandHeld: false });
  const entered: CardInstance = stripForZone(picked);
  next = patchPlayer(next, playerId, (p) => {
    const cards = [...p[zone]];
    cards.splice(Math.min(index, cards.length), 0, entered);
    return { ...p, [zone]: cards };
  });
  // ライドオフした直後のユニットとして、RC の効果を発動する。
  const rc = resolveRidingComboOnRideOff(next, playerId, entered);
  next = { ...rc.state, log: [...rc.state.log, ...rc.logs] };
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-036", `${MEMORY_CHANGE}:${instanceId}`) };
};
CHOICE_SKIPPERS[MEMORY_CHANGE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-038 仮面ライダーアクセルトライアル【マシンガンスパイク】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から3枚まで捨て札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字の合計が
//  10未満なら、その数字以下の必要パワーの数字を持つ敵軍バトルエリアのユニットを１体選び撃破する。10以上なら、これを撃破する。」（atwiki/page-2319）
// 1枚ずつ捨札にして、続けるかを選ぶ（Q1「宣言しておく必要はありません」）。

const SPIKE = "xg6038_spike";
const SPIKE_TARGET = "xg6038_spike_target";

function spikeChoice(state: GameState, ctx: BaseCtx, discarded: string[]): PendingEffectChoice | null {
  const top = state.players[ctx.playerId].deck[0];
  if (!top || discarded.length >= 3) return null;
  const ids = discarded.length > 0 ? [XG6_DONE, top.instanceId] : [top.instanceId];
  return { ...choice(ctx, "XG6-038", SPIKE, "select_hand", ids, true), xg6Meta: { ids: discarded } };
}

function applySpike(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId) return { state, detail: "xg6038:not_own_turn" };
  const opened = spikeChoice(state, ctxBase(ctx), []);
  if (!opened) return { state, detail: "xg6038:empty_deck" };
  return { state: openAfter(state, opened), detail: SPIKE };
}

function finishSpike(state: GameState, pending: PendingEffectChoice, discarded: string[]): Outcome {
  const playerId = pending.playerId;
  let next = close(state, pending);
  const total = discarded.reduce((sum, id) => {
    const card = next.players[playerId].discard.find((c) => c.instanceId === id);
    return sum + (card ? costNumber(next, card.cardId) : 0);
  }, 0);
  const log = logFor(state, playerId, "XG6-038", `${SPIKE}:total:${total}`);
  const selfId = pending.sourceInstanceId;
  if (total >= 10) {
    if (selfId && findField(next, playerId, selfId)) next = destroyAll(next, pendingBase(pending), "XG6-038", `${SPIKE}_self`, [selfId]);
    return { state: proceed(next, pending), log };
  }
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isUnitDef(next, c.cardId) && costNumber(next, c.cardId) <= total && selectableEnemy(next, playerId, "XG6-038", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, genericPick(pendingBase(pending), "XG6-038", SPIKE_TARGET, ids, false, "discard")), log };
}

CHOICE_RESOLVERS[SPIKE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const discarded = pending.xg6Meta?.ids ?? [];
  const next = patchPlayer(state, playerId, (p) => {
    const top = p.deck[0];
    if (!top || top.instanceId !== instanceId) return p;
    return { ...p, deck: p.deck.slice(1), discard: [...p.discard, stripForZone(top)] };
  });
  const now = [...discarded, instanceId];
  const more = spikeChoice(next, pendingBase(pending), now);
  if (more) return { state: { ...next, pendingEffectChoice: { ...more, resumeChoice: pending.resumeChoice } }, log: logFor(state, playerId, "XG6-038", `${SPIKE}:${instanceId}`) };
  return finishSpike(next, pending, now);
};
CHOICE_CONFIRMERS[SPIKE] = (state) => {
  const pending = state.pendingEffectChoice!;
  return finishSpike(state, pending, pending.xg6Meta?.ids ?? []);
};
CHOICE_SKIPPERS[SPIKE] = (state) => {
  const pending = state.pendingEffectChoice!;
  const discarded = pending.xg6Meta?.ids ?? [];
  return discarded.length > 0 ? finishSpike(state, pending, discarded) : skipped(state, pending);
};

// ---------------------------------------------------------------------------
// XG6-039 スタッグフォン（オペレーション）
// 「自軍コマンドゾーンのカードを1枚選び手札に加える。そうしたとき、このカードを自軍コマンドゾーンにホールド状態で置く。」（atwiki/page-2292）
// 支払いでホールドしたコマンドも選べる。

const STAG_PHONE = "xg6039_stag_phone";

function applyStagPhone(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6039:no_command" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-039", STAG_PHONE, "select_command", ids, false)), detail: STAG_PHONE };
}

CHOICE_RESOLVERS[STAG_PHONE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opId = pending.sourceInstanceId;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const command = p.command.filter((c) => c.instanceId !== instanceId);
    const isOp = (c: CardInstance) => c.instanceId === opId;
    // 使ったカードは解決中はどのゾーンにもない（RK-017 ミッションメモリーと同じく、そのカードを置く。rules/rk/rk1NamedEffects.ts）。
    const opCard = opId ? ([...p.discard, ...p.operation, ...p.hand].find(isOp) ?? { instanceId: opId, cardId: pending.sourceCardId }) : undefined;
    const placed = opCard && !command.some(isOp) ? [...command, { ...stripForZone(opCard), commandHeld: true }] : command;
    return {
      ...p,
      command: placed,
      hand: [...p.hand.filter((c) => !isOp(c)), stripForZone(card)],
      discard: p.discard.filter((c) => !isOp(c)),
      operation: p.operation.filter((c) => !isOp(c)),
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-039", `${STAG_PHONE}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG6-040 仮面ライダージョーカー【ライダーキック】（RC）
// 「これ以外の自軍Sユニットが１体もなければ、相手は自分自身のSユニットを１体選び撃破する。そうしたとき、これはSP1になる。」（atwiki/page-2310）
// 自軍 S ユニットはエリアを問わない。相手の S ユニットもエリアを問わない。「SP1」はこのターン（rules/xg6/xg6Fields.ts）。

const RIDER_KICK = "xg6040_rider_kick";

function applyRiderKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return { state, detail: "xg6040:no_source" };
  if (fieldUnits(state, ctx.playerId).some((c) => c.instanceId !== selfId && isSmall(state, c))) return { state, detail: "xg6040:other_small" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId).filter((c) => isSmall(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6040:no_enemy_small" };
  const opened: PendingEffectChoice = { ...choice({ ...ctxBase(ctx), playerId: enemyId }, "XG6-040", RIDER_KICK, "select_unit", ids, false), xg6Meta: { targetPlayerId: ctx.playerId } };
  return { state: openAfter(state, opened), detail: RIDER_KICK };
}

CHOICE_RESOLVERS[RIDER_KICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.xg6Meta?.targetPlayerId ?? opponent(playerId);
  let next = destroyAll(close(state, pending), pendingBase(pending), "XG6-040", `${RIDER_KICK}_destroy`, [instanceId]);
  if (pending.sourceInstanceId) next = addXg6Mark(next, { key: "XG6-040:sp1", playerId: owner, instanceId: pending.sourceInstanceId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-040", `${RIDER_KICK}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG6-043 仮面ライダーゼロノスZF【強き心と強き願い】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからオモテ向きのカードを1枚選びゲームから除外してよい。そうしたとき、これはBP+3000され、
//  自分がゲームに負けるまで残り1点なら「SP2」になる。」（atwiki/page-2336）。BP・SP はこのターンの記録（rules/xg6/xg6Fields.ts）。
//  「残り1点」は除外したときのダメージで判定する。

const STRONG_HEART = "xg6043_strong_heart";

function applyStrongHeart(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId || !ctx.triggerSourceInstanceId) return { state, detail: "xg6043:not_own_turn" };
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6043:no_power" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-043", STRONG_HEART, "select_power", ids, true)), detail: STRONG_HEART };
}

CHOICE_RESOLVERS[STRONG_HEART] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) => {
    let next = patchPlayer(s, playerId, (p) => {
      const card = p.power.find((c) => c.instanceId === instanceId);
      if (!card) return p;
      return { ...p, power: p.power.filter((c) => c !== card), exile: [...(p.exile ?? []), stripForZone(card)] };
    });
    const selfId = pending.sourceInstanceId;
    if (!selfId || !findField(next, playerId, selfId)) return next;
    next = addXg6Mark(next, { key: "XG6-043:bp", playerId, instanceId: selfId });
    if (loseDamageThreshold(next, playerId) - next.players[playerId].damage === 1) next = addXg6Mark(next, { key: "XG6-043:sp2", playerId, instanceId: selfId });
    return next;
  });
};
CHOICE_SKIPPERS[STRONG_HEART] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-044 仮面ライダーNEW電王SF ※「これをラッシュしたとき、自軍パワーゾーンから「テディ」のカードを1枚選び自軍ラッシュエリアに出してもよい。」
//  （atwiki/page-2322）。選べるのはオモテ向きのカード（ダメージは選ばない）。出すのはラッシュではない。

const TEDDY = "xg6044_teddy";

/**
 * XG6-044 の※。DSL の上書き（packages/cards/src/dsl/overrides/XG6-044.json）が note_card のままなので、
 * rules/noteOtherRushEffects.ts のラッシュしたときの処理から呼ぶ。
 */
export function openXg6Teddy(state: GameState, playerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState | null {
  const ids = state.players[playerId].power.filter((c) => !c.faceDown && def(state, c.cardId)?.name === "テディ").map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openAfter(state, choice({ playerId, phasePlayerId, sourceInstanceId: instanceId }, "XG6-044", TEDDY, "select_power", ids, true));
}

function applyTeddy(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const opened = ctx.triggerSourceInstanceId ? openXg6Teddy(state, ctx.playerId, ctx.triggerSourceInstanceId, ctx.phasePlayerId) : null;
  return opened ? { state: opened, detail: TEDDY } : { state, detail: "xg6044:no_teddy" };
}

CHOICE_RESOLVERS[TEDDY] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) =>
    patchPlayer(s, playerId, (p) => {
      const card = p.power.find((c) => c.instanceId === instanceId);
      if (!card) return p;
      return { ...p, power: p.power.filter((c) => c !== card), rush: [...p.rush, stripForZone(card)] };
    }),
  );
};
CHOICE_SKIPPERS[TEDDY] = simpleSkip();

// ---------------------------------------------------------------------------
// 起点

Object.assign(XG6_KEYWORDS, {
  "XG6-023::hyper_punch": noop("xg6023:field"),
  "XG6-024::knight_dynamic": applyKnightDynamic,
  "XG6-025::my_turn": noop("xg6025:damage_taken"),
  "XG6-026::eraser": applyEraser,
  "XG6-027::sea_lion": applyLion("bottom", "XG6-027", "青き海の獅子", "シーレオン"),
  "XG6-028::sky_lion": applyLion("top", "XG6-028", "赤き空の獅子", "スカイオン"),
  "XG6-029::field": noop("xg6029:field"),
  "XG6-029::sky_kick": applySkyKick,
  "XG6-030::weak_point": noop("xg6030:field"),
  "XG6-031::eradication": applyEradication,
  "XG6-031::field": noop("xg6031:field"),
  "XG6-032::stack": applyGiantStack,
  "XG6-032::strongest": noop("xg6032:field"),
  "XG6-035::field": noop("xg6035:field"),
  "XG6-035::vicker": noop("xg6035:attack_win"),
  "XG6-036::memory_change": applyMemoryChange,
  "XG6-038::spike": applySpike,
  "XG6-039::stag_phone": applyStagPhone,
  "XG6-040::rider_kick": applyRiderKick,
  "XG6-041::party_time": noop("xg6041:field"),
  "XG6-042::zero_hand": noop("xg6042:after_action"),
  "XG6-042::zero_start": noop("xg6042:strike_damage"),
  "XG6-043::field": noop("xg6043:register"),
  "XG6-043::strong_heart": applyStrongHeart,
  "XG6-044::teddy": applyTeddy,
});
