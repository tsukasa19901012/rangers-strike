/**
 * 第4弾「四雄の覚醒」（legend1）のカード固有の名前付き効果。
 *
 * - `trySet4CardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet4Choice` / `trySkipSet4Choice` / `tryConfirmSet4Choice`: このモジュールが開いた選択の解決。
 * - バトル解決・アタック対象の判定から呼ばれる参照関数（RS-212 / RS-213 / RS-220 / RS-225 / RS-226）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PendingStrike, PlayerId } from "../../types/game";
import { bounceToHand } from "../bounce";
import { startEffectRush } from "../effectRush";
import { cardHasCategory } from "@rangers-strike/cards";
import { canPlayHandCounter } from "../operationCounters";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { openOptionalEffectConfirm, registerOptionalEffect } from "../optionalEffects";
import { findCardInField } from "../fieldLookup";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardName, effectiveBp, getDefinition, isCounterOperation, isSmallUnit } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import {
  addNextTurnRuleModifier,
  addTurnRuleModifier,
  getPlayerModifiers,
  hasTurnRuleModifier,
} from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { hasBattleNcEffect } from "../namedUnitEffects";
import { countJointLGrant } from "../jointComboGrants";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";
import { registerChoiceRefresher } from "../choiceRefreshers";
import { destroyTriggerTimingOfNamedEffect, openDestroyTimedChoice } from "../destroyTriggerTiming";

// ---------------------------------------------------------------------------
// 共通

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

/**
 * 選択を閉じる。割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入（NC 等）を続ける。
 * 再開する選択の候補は、この効果の解決前と同じ場所に残っているカードだけにする（移動したカードは選べない）。
 */
function finish(state: GameState, phasePlayerId: PlayerId, before?: GameState): GameState {
  const resume = (before ?? state).pendingEffectChoice?.resumeChoice;
  const cleared = clearPending(state, phasePlayerId);
  if (resume) {
    const prev = before ?? state;
    const valid = resume.validInstanceIds.filter((id) => {
      const was = findCardInField(prev, id);
      const now = findCardInField(cleared, id);
      return !!was && !!now && was.playerId === now.playerId && was.zone === now.zone;
    });
    if (valid.length > 0) return openEffectChoice(cleared, { ...resume, validInstanceIds: valid });
  }
  return promoteDeferredBattleEntry(cleared);
}

/**
 * 選択を開いたオペレーションは、使用処理（play_operation）では捨札にならない（選択の解決待ち）ので、
 * 選択を開いた時点で捨札に置く（効果の解決中、使ったオペレーションは場に残らない）。
 */
function discardUsedOperation(state: GameState, ctx: GrantKeywordContext): GameState {
  if (!ctx.operationInstanceId) return state;
  const player = state.players[ctx.playerId];
  if (player.discard.some((c) => c.instanceId === ctx.operationInstanceId)) return state;
  const card: CardInstance = { instanceId: ctx.operationInstanceId, cardId: ctx.sourceCardId };
  return { ...state, ...updatePlayer(state, ctx.playerId, { ...player, discard: [...player.discard, card] }) };
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

// ---------------------------------------------------------------------------
// RS-212 オーグリーン【爆烈ミラージュナックル】（NC）
// 「自軍ターン中、これがバトルでユニットを撃破したとき、敵軍捨札からカードを1枚選び、敵軍パワーゾーンにダメージにして置く。
//  （カードを選ぶとき、これが撃破したユニットが捨札になるなら捨札にしたあとで選ぶ）」

export const MIRAGE_KNUCKLE_EFFECT_ID = "baku_mirajunakuru_discard_to_damage";

/** バトルで撃破した直後（撃破されたユニットが捨札に置かれたあと）に呼ぶ。 */
export function openMirageKnuckleChoice(
  state: GameState,
  attackerId: PlayerId,
  attackerInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (phasePlayerId !== attackerId) return state;
  const striker = fieldUnits(state, attackerId).find((c) => c.instanceId === attackerInstanceId);
  if (!striker || striker.cardId !== "RS-212" || !hasBattleNcEffect(striker, "baku_mirajunakuru")) return state;
  const enemyId = opponent(attackerId);
  const ids = state.players[enemyId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return state;
  // 「カードを選ぶとき、…捨札になるなら捨札にしたあとで選ぶ」— 選ぶのは捨札に移ったあと（R-TIME-01 の段階 4）。
  // 同じ段階 4 の「撃破されて捨札になったとき」（アバレッドAM 等）とはターンプレイヤーが順番を選ぶ（faq-card-4 RS-212 Q1）。
  return openDestroyTimedChoice(state, {
    destroyTriggerTiming: destroyTriggerTimingOfNamedEffect(state, "RS-212", "爆烈ミラージュナックル") ?? "after_discard",
    playerId: attackerId,
    effectId: MIRAGE_KNUCKLE_EFFECT_ID,
    refreshOnOpen: { key: MIRAGE_KNUCKLE_EFFECT_ID },
    sourceCardId: "RS-212",
    sourceInstanceId: attackerInstanceId,
    kind: "select_unit",
    unitDestination: "power",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

// 他の効果を先に処理したあとで開くとき（simultaneous_order）、その時点の敵軍捨札から選ぶ。
registerChoiceRefresher(MIRAGE_KNUCKLE_EFFECT_ID, (state, choice) => {
  const ids = state.players[opponent(choice.playerId)].discard.map((c) => c.instanceId);
  return ids.length > 0 ? { ...choice, validInstanceIds: ids } : null;
});

function resolveMirageKnuckle(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "discard", instanceId);
  if (!found) return { error: "invalid_target" };
  const [card, discard] = removeAt(enemy.discard, found.index);
  const nextEnemy = {
    ...enemy,
    discard,
    power: [...enemy.power, { instanceId: card.instanceId, cardId: card.cardId, faceDown: true }],
    damage: enemy.damage + 1,
  };
  const next = { ...state, ...updatePlayer(state, enemyId, nextEnemy) };
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, "RS-212", `${MIRAGE_KNUCKLE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
}

// ---------------------------------------------------------------------------
// RS-213 オーイエロー【炸裂超力バトン】（NC）
// 「相手は自分自身のラッシュエリアからユニットを1体選ぶ。このターン、このユニットは、相手の選んだユニットにアタックできる。」

export const CHIKARA_BATON_EFFECT_ID = "chikara_baton_opponent_pick_rush";
export const CHIKARA_BATON_RULE = "rs213_chikara_baton";

type BatonPayload = { attackerInstanceId: string; targetInstanceId: string };

function beginChikaraBaton(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const attackerInstanceId = ctx.triggerSourceInstanceId;
  if (!attackerInstanceId) return null;
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush.map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: enemyId,
    effectId: CHIKARA_BATON_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: attackerInstanceId,
    kind: "select_unit",
    unitDestination: "rush",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

function resolveChikaraBaton(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  if (!findInZone(state.players[playerId], "rush", instanceId)) return { error: "invalid_target" };
  const ownerId = opponent(playerId);
  const payload: BatonPayload = { attackerInstanceId: pending.sourceInstanceId ?? "", targetInstanceId: instanceId };
  const owner = addTurnRuleModifier(
    state.players[ownerId],
    `${CHIKARA_BATON_RULE}::${payload.attackerInstanceId}::${instanceId}`,
    { sourceCardId: pending.sourceCardId, payload },
  );
  const next = { ...state, ...updatePlayer(state, ownerId, owner) };
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, pending.sourceCardId, `${CHIKARA_BATON_EFFECT_ID}:${cardName(state.definitions, findInZone(state.players[playerId], "rush", instanceId)!.card.cardId)}`),
  };
}

/** RS-213: このターン、相手の選んだラッシュエリアのユニットにアタックできるか。 */
export function chikaraBatonAllowsAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string,
): boolean {
  return getPlayerModifiers(state.players[attackerPlayerId]).some((m) => {
    if (m.kind !== "rule" || m.scope !== "turn" || !m.ruleId.startsWith(`${CHIKARA_BATON_RULE}::`)) return false;
    const p = m.payload as BatonPayload | undefined;
    return p?.attackerInstanceId === attackerInstanceId && p.targetInstanceId === defenderInstanceId;
  });
}

// ---------------------------------------------------------------------------
// RS-217 SSスタタンゾ【家出したくなるガソリン】（NC）
// 「バトルエリアにある特徴「車両」を持つユニットを1体選び、持ち主の山札の下に戻してもよい。」

export const RUNAWAY_GASOLINE_EFFECT_ID = "shitakunarugasorin_deck_bottom";

function battleUnitsWithFeature(state: GameState, feature: string): string[] {
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    for (const c of state.players[pid].battle) {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type === "unit" && (def.features ?? []).includes(feature)) ids.push(c.instanceId);
    }
  }
  return ids;
}

function beginRunawayGasoline(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const ids = battleUnitsWithFeature(state, "車両");
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: RUNAWAY_GASOLINE_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function resolveRunawayGasoline(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  for (const ownerId of ["player1", "player2"] as const) {
    const owner = state.players[ownerId];
    const found = findInZone(owner, "battle", instanceId);
    if (!found) continue;
    const [card, battle] = removeAt(owner.battle, found.index);
    const returned: CardInstance = { instanceId: card.instanceId, cardId: card.cardId };
    const next = { ...state, ...updatePlayer(state, ownerId, { ...owner, battle, deck: [...owner.deck, returned] }) };
    return {
      state: finish(next, pending.phasePlayerId, state),
      log: logFor(state, playerId, pending.sourceCardId, `${RUNAWAY_GASOLINE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
    };
  }
  return { error: "invalid_target" };
}

// ---------------------------------------------------------------------------
// RS-220 タイムグリーン【反射バリア】（NC）
// 「次の相手ターン、自軍Sユニットとバトルした敵軍Sユニットは、バトルに勝っても撃破される。」
// 相手（撃破される側）に次のターンだけ有効な修飾子を付ける。

export const REFLECT_BARRIER_RULE = "rs220_reflect_barrier";

function applyReflectBarrier(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const enemy = addNextTurnRuleModifier(state.players[enemyId], REFLECT_BARRIER_RULE, {
    sourceCardId: ctx.sourceCardId,
  });
  return { ...state, ...updatePlayer(state, enemyId, enemy) };
}

/**
 * RS-220: 勝った winner（winnerOwner の S ユニット）が、反射バリアの持ち主の S ユニット（loser）とバトルしたので撃破されるか。
 */
export function reflectBarrierDestroysWinner(
  state: GameState,
  winnerOwner: PlayerId,
  winnerCardId: string,
  loserCardId: string,
): boolean {
  if (!hasTurnRuleModifier(state.players[winnerOwner], REFLECT_BARRIER_RULE)) return false;
  return isSmallUnit(state.definitions, winnerCardId) && isSmallUnit(state.definitions, loserCardId);
}

// ---------------------------------------------------------------------------
// RS-225 ガトリングレオ【大回転獅子爆裂弾】
// 「このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる。」
// 能力の付与（同カテゴリの L ユニットへの JC）は jointComboGrants に記録される。

export function lionBlastAllowsRushAttack(card: CardInstance): boolean {
  return countJointLGrant(card, "shi_baku_dan") > 0;
}

// ---------------------------------------------------------------------------
// RS-226 キラーオー【爆竜必殺デススティンガー】
// 「自軍ターン中、これがバトルでユニットを撃破したとき、これがバトルで撃破したユニットよりBPの低いユニットを、
//  相手は自分自身のユニットの中から1体選び撃破する。」
// 撃破したユニットの BP はバトルの時点の BP（faq-card-4 RS-226 Q2・Q3）。

export const DEATH_STINGER_EFFECT_ID = "baku_desusuteinga_destroy_lower";

export function openDeathStingerChoice(
  state: GameState,
  attackerId: PlayerId,
  attackerInstanceId: string,
  destroyedBattleBp: number,
  phasePlayerId: PlayerId,
): GameState {
  if (phasePlayerId !== attackerId) return state;
  const striker = fieldUnits(state, attackerId).find((c) => c.instanceId === attackerInstanceId);
  if (!striker || striker.cardId !== "RS-226") return state;
  const enemyId = opponent(attackerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) < destroyedBattleBp)
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  // 「撃破したとき」— R-TIME-01 の段階 1。撃破されたユニットの「撃破されたとき」（段階 2）・
  // 「撃破されて捨札になったとき」（段階 4）より先に解決する（処理順の選択はない。faq-card-4 RS-226 Q1 — アバレッドAM の効果で出るアバレッドは選べない）。
  return openDestroyTimedChoice(state, {
    destroyTriggerTiming: destroyTriggerTimingOfNamedEffect(state, "RS-226", "爆竜必殺デススティンガー") ?? "destroyer",
    playerId: enemyId,
    effectId: DEATH_STINGER_EFFECT_ID,
    refreshOnOpen: { key: DEATH_STINGER_EFFECT_ID, destroyedBattleBp },
    sourceCardId: "RS-226",
    sourceInstanceId: attackerInstanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

// 他の効果を先に処理したあとで開くとき（simultaneous_order）、その時点の相手のユニットから選ぶ。
registerChoiceRefresher(DEATH_STINGER_EFFECT_ID, (state, choice) => {
  const bp = choice.refreshOnOpen?.destroyedBattleBp ?? 0;
  const ids = fieldUnits(state, choice.playerId)
    .filter((c) => effectiveBp(state, choice.playerId, c) < bp)
    .map((c) => c.instanceId);
  return ids.length > 0 ? { ...choice, validInstanceIds: ids } : null;
});

function resolveDeathStinger(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = fieldUnits(state, playerId).find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const cleared = clearPending(state, pending.phasePlayerId);
  const left = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  let next: GameState;
  if (left.state.pendingEffectChoice) {
    // 撃破で誘発した選択の後で、割り込まれていた選択を再開する。
    const opened = left.state.pendingEffectChoice;
    next = pending.resumeChoice
      ? { ...left.state, pendingEffectChoice: { ...opened, resumeChoice: opened.resumeChoice ?? pending.resumeChoice } }
      : left.state;
  } else if (left.state.pendingLeave) {
    next = left.state;
  } else {
    next = finish(left.state, pending.phasePlayerId, state);
  }
  return {
    state: next,
    log: logFor(state, playerId, "RS-226", `${DEATH_STINGER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
}


// ---------------------------------------------------------------------------
// RS-192 ダイナブルー【アタックボード】（NC）
// 「自分がターンを終えるとき、このユニットがバトルエリアにあればラッシュエリアに戻してもよい。」

export const ATTACK_BOARD_EFFECT_ID = "atakubodo_return_to_rush";
const ATTACK_BOARD_DONE_RULE = "rs192_attack_board_done";

function moveBattleUnitToRush(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const player = state.players[playerId];
  const found = findInZone(player, "battle", instanceId);
  if (!found) return state;
  const [card, battle] = removeAt(player.battle, found.index);
  return { ...state, ...updatePlayer(state, playerId, { ...player, battle, rush: [...player.rush, card] }) };
}

registerOptionalEffect(ATTACK_BOARD_EFFECT_ID, {
  apply: (state, pending) =>
    pending.sourceInstanceId ? moveBattleUnitToRush(state, pending.playerId, pending.sourceInstanceId) : state,
  // CPU は戻さない（次のターンもバトルエリアに残す）。
  cpuAccepts: () => false,
});

function openAttackBoard(state: GameState, endingPlayerId: PlayerId): GameState | null {
  const player = state.players[endingPlayerId];
  const unit = player.battle.find(
    (c) =>
      c.cardId === "RS-192" &&
      hasBattleNcEffect(c, "atakubodo") &&
      !hasTurnRuleModifier(player, `${ATTACK_BOARD_DONE_RULE}::${c.instanceId}`),
  );
  if (!unit) return null;
  const marked = addTurnRuleModifier(player, `${ATTACK_BOARD_DONE_RULE}::${unit.instanceId}`, { sourceCardId: "RS-192" });
  const next = { ...state, ...updatePlayer(state, endingPlayerId, marked) };
  return openOptionalEffectConfirm(next, {
    playerId: endingPlayerId,
    effectId: ATTACK_BOARD_EFFECT_ID,
    sourceCardId: "RS-192",
    sourceInstanceId: unit.instanceId,
    phasePlayerId: endingPlayerId,
  });
}

// ---------------------------------------------------------------------------
// RS-193 ダイナピンク【フラワーカーニバル】（NC）
// 「敵軍コマンドゾーンのリリース状態のカードをすべて持ち主の手札に戻す。その後、自分がターンを終えるとき、
//  相手は自分自身の手札から好きな枚数を自分自身のコマンドゾーンに置く。」

export const FLOWER_CARNIVAL_EFFECT_ID = "furawakanibaru_hand_to_command";
const FLOWER_CARNIVAL_RULE = "rs193_flower_carnival";

function applyFlowerCarnival(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const returning = enemy.command.filter((c) => !c.commandHeld);
  const nextEnemy = {
    ...enemy,
    command: enemy.command.filter((c) => c.commandHeld),
    hand: [...enemy.hand, ...returning.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  };
  const self = addTurnRuleModifier(
    state.players[ctx.playerId],
    `${FLOWER_CARNIVAL_RULE}::${ctx.triggerSourceInstanceId ?? ctx.sourceCardId}`,
    { sourceCardId: ctx.sourceCardId },
  );
  let next = { ...state, ...updatePlayer(state, enemyId, nextEnemy) };
  next = { ...next, ...updatePlayer(next, ctx.playerId, self) };
  return {
    ...next,
    log: [
      ...next.log,
      buildLogEntry(ctx.playerId, "number_combo", ctx.sourceCardId, state.definitions, `furawakanibaru:${returning.length}`),
    ],
  };
}

function flowerCarnivalCandidates(state: GameState, placerId: PlayerId): string[] {
  const placer = state.players[placerId];
  if (placer.command.length >= COMMAND_ZONE_MAX) return [];
  return placer.hand.map((c) => c.instanceId);
}

function openFlowerCarnival(state: GameState, endingPlayerId: PlayerId): GameState | null {
  const player = state.players[endingPlayerId];
  const mod = getPlayerModifiers(player).find(
    (m) => m.kind === "rule" && m.scope === "turn" && m.ruleId.startsWith(`${FLOWER_CARNIVAL_RULE}::`),
  );
  if (!mod) return null;
  const remaining = getPlayerModifiers(player).filter((m) => m !== mod);
  const next = {
    ...state,
    ...updatePlayer(state, endingPlayerId, { ...player, modifiers: remaining.length > 0 ? remaining : undefined }),
  };
  const placerId = opponent(endingPlayerId);
  const ids = flowerCarnivalCandidates(next, placerId);
  if (ids.length === 0) return next;
  return openEffectChoice(next, {
    playerId: placerId,
    effectId: FLOWER_CARNIVAL_EFFECT_ID,
    sourceCardId: "RS-193",
    kind: "select_hand",
    phasePlayerId: endingPlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

/** 相手が手札から1枚ずつコマンドゾーンに置く（置き終えるときは skip）。 */
function resolveFlowerCarnival(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found || player.command.length >= COMMAND_ZONE_MAX) return { error: "invalid_target" };
  const [card, hand] = removeAt(player.hand, found.index);
  const next = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      hand,
      command: [...player.command, { instanceId: card.instanceId, cardId: card.cardId, commandHeld: false }],
    }),
  };
  const log = logFor(state, playerId, "RS-193", `${FLOWER_CARNIVAL_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const ids = flowerCarnivalCandidates(next, playerId);
  if (ids.length > 0) {
    return { state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: ids } }, log };
  }
  return { state: clearPending(next, pending.phasePlayerId), log };
}

/** 「自分がターンを終えるとき」の RS-192 / RS-193 の選択を開く（エンドフェイズの効果メニューの前）。 */
export function tryOpenSet4EndTurnChoice(state: GameState, endingPlayerId: PlayerId): GameState | null {
  if (state.phase !== "end" || state.pendingEffectChoice) return null;
  const board = openAttackBoard(state, endingPlayerId);
  if (board) return board;
  const flower = openFlowerCarnival(state, endingPlayerId);
  if (flower) {
    if (flower.pendingEffectChoice) return flower;
    return tryOpenSet4EndTurnChoice(flower, endingPlayerId) ?? flower;
  }
  return null;
}

/** 解決後にエンドフェイズの効果メニューを開き直す選択か。 */
export function isSet4EndTurnEffect(effectId: string | undefined): boolean {
  return effectId === ATTACK_BOARD_EFFECT_ID || effectId === FLOWER_CARNIVAL_EFFECT_ID;
}


// ---------------------------------------------------------------------------
// RS-185 カーナビック（オペレーション。※カウンターではない）
// 「相手の手札を見て、カウンターのオペレーションカードがあれば1枚選び、持ち主のパワーゾーンにダメージにして置く。」

export const CAR_NAVIC_EFFECT_ID = "kanabiku_counter_to_damage";

function beginCarNavic(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const ids = enemy.hand
    .filter((c) => isCounterOperation(getDefinition(state.definitions, c.cardId)))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: CAR_NAVIC_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId,
    kind: "select_hand",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    // 見た手札（相手の手札すべて）。
    viewedInstanceIds: enemy.hand.map((c) => c.instanceId),
    selectCount: 1,
    optional: false,
  });
}

function resolveCarNavic(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "hand", instanceId);
  if (!found) return { error: "invalid_target" };
  const [card, hand] = removeAt(enemy.hand, found.index);
  const next = {
    ...state,
    ...updatePlayer(state, enemyId, {
      ...enemy,
      hand,
      power: [...enemy.power, { instanceId: card.instanceId, cardId: card.cardId, faceDown: true }],
      damage: enemy.damage + 1,
    }),
  };
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, "RS-185", `${CAR_NAVIC_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
}

// ---------------------------------------------------------------------------
// RS-186 プロバイダーベース（オペレーション）
// 「自軍山札を見て、Sユニット以外の特徴「メカ」を持つユニットのカードを5枚まで選び、相手に見せる。
//  その後、山札をシャッフルし、選んだカードを好きな順で山札の上に戻す。」
// 1枚ずつ選び（選んだ順に山札の上から並ぶ）、確定（confirm）で終える。5枚選ぶか候補が尽きたら自動で終える。

export const PROVIDER_BASE_EFFECT_ID = "purobaidabesu_deck_top";
const PROVIDER_BASE_MAX = 5;

function providerBaseCandidates(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  return state.players[playerId].deck
    .filter((c) => {
      if (exclude.includes(c.instanceId)) return false;
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size !== "S" && (def.features ?? []).includes("メカ");
    })
    .map((c) => c.instanceId);
}

function beginProviderBase(state: GameState, ctx: GrantKeywordContext): GameState {
  const ids = providerBaseCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return finishProviderBaseWith(state, ctx.playerId, []);
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: PROVIDER_BASE_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId,
    kind: "select_unit",
    unitDestination: "deck_top",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: PROVIDER_BASE_MAX,
    selectedInstanceIds: [],
    optional: true,
  });
}

function shuffled<T>(cards: T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** 山札をシャッフルし、選んだカードを（選んだ順に）山札の上に置く。 */
function finishProviderBaseWith(state: GameState, playerId: PlayerId, selected: string[]): GameState {
  const player = state.players[playerId];
  const picked = selected
    .map((id) => player.deck.find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c);
  const rest = player.deck.filter((c) => !selected.includes(c.instanceId));
  return { ...state, ...updatePlayer(state, playerId, { ...player, deck: [...picked, ...shuffled(rest)] }) };
}

function finishProviderBase(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const next = finishProviderBaseWith(state, playerId, selected);
  const names = selected
    .map((id) => state.players[playerId].deck.find((c) => c.instanceId === id))
    .map((c) => (c ? cardName(state.definitions, c.cardId) : ""))
    .join(",");
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, "RS-186", `${PROVIDER_BASE_EFFECT_ID}:${names || "none"}`),
  };
}

function resolveProviderBase(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = providerBaseCandidates(state, playerId, selected);
  const updated: GameState = {
    ...state,
    pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
  };
  if (selected.length >= PROVIDER_BASE_MAX || remaining.length === 0) return finishProviderBase(updated, playerId);
  return { state: updated };
}


// ---------------------------------------------------------------------------
// RS-184 マジパンチ（※カウンター）
// 「BP8000以下の敵軍ユニットにストライクされたとき発動できる⇒ストライクしてきた敵軍ユニットを持ち主の手札に戻す。
//  そのとき、敵軍のストライクは無効になる。」
// 1回のストライクに対して同時に2枚使える（faq-card-4 RS-184 Q1・R-CTR-02）— 1枚目の解決後も、
// 手札にマジパンチが残っていれば反応窓を開いたままにする（2枚目は戻すユニットがいないので何もしない）。

const MAGI_PUNCH_MAX_BP = 8000;

export function isMagiPunchCard(state: GameState, cardId: string): boolean {
  return cardId === "RS-184" || getDefinition(state.definitions, cardId)?.name === "マジパンチ";
}

/** ストライクの反応窓で使えるマジパンチ（手札）。 */
export function magiPunchCounterIds(state: GameState, defenderId: PlayerId, pending: PendingStrike): string[] {
  // ※カウンター — 敵軍ターン中のみ。
  if (pending.battlePhasePlayer === defenderId) return [];
  if (!pending.magiPunchApplied) {
    const striker = findInZone(state.players[pending.strikerPlayerId], "battle", pending.strikerInstanceId);
    if (!striker) return [];
    if (effectiveBp(state, pending.strikerPlayerId, striker.card) > MAGI_PUNCH_MAX_BP) return [];
  }
  return state.players[defenderId].hand
    .filter((c) => isMagiPunchCard(state, c.cardId) && canPlayHandCounter(state, defenderId, c.instanceId))
    .map((c) => c.instanceId);
}

export function applyMagiPunchCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  pending: PendingStrike,
): { state: GameState; pending: PendingStrike; log: string } {
  const defender = state.players[defenderId];
  const found = findInZone(defender, "hand", counterInstanceId);
  let next = state;
  if (found) {
    const [card, hand] = removeAt(defender.hand, found.index);
    next = { ...next, ...updatePlayer(next, defenderId, { ...defender, hand, discard: [...defender.discard, card] }) };
  }
  let detail = "none";
  const striker = findInZone(next.players[pending.strikerPlayerId], "battle", pending.strikerInstanceId);
  if (striker && effectiveBp(next, pending.strikerPlayerId, striker.card) <= MAGI_PUNCH_MAX_BP) {
    next = bounceToHand(next, {
      playerId: pending.strikerPlayerId,
      instanceId: pending.strikerInstanceId,
      fromZone: "battle",
    }).state;
    detail = cardName(state.definitions, striker.card.cardId);
  }
  return {
    state: next,
    pending: { ...pending, damageCancelled: true, magiPunchApplied: true },
    log: buildLogEntry(defenderId, "play_counter", found?.card.cardId ?? "RS-184", state.definitions, `magi_punch:${detail}`),
  };
}


// ---------------------------------------------------------------------------
// RS-223 タック【緊急システム発動要請】
// 「これが自軍ラッシュエリアにある間、自軍ラッシュフェイズ中、自分がMユニットをラッシュするとき、敵軍コマンドを1つ
//  リリースしてもよい。そうしたとき、そのユニットのラッシュに必要な自軍コマンドを1つホールドしたことにできる。」
// ラッシュの支払い（category_use）の候補に、ホールド状態の敵軍コマンドを加える（選べば自軍コマンドのかわりに
// その敵軍コマンドをリリースする）。カテゴリは問わない（faq-card-4 RS-223 Q3）。

export function isTuckCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return cardId === "RS-223" || getDefinition(state.definitions, cardId)?.name === "タック";
}

/** M ユニットのラッシュの支払いで、自軍コマンドのホールドのかわりにリリースできる敵軍コマンド。 */
export function emergencyRequestEnemyCommandIds(
  state: Pick<GameState, "players" | "definitions" | "phase" | "activePlayer">,
  playerId: PlayerId,
  rushingCardId: string | undefined,
): string[] {
  if (!rushingCardId) return [];
  if (state.phase !== "rush" || state.activePlayer !== playerId) return [];
  if (getDefinition(state.definitions, rushingCardId)?.size !== "M") return [];
  if (!state.players[playerId].rush.some((c) => isTuckCard(state, c.cardId))) return [];
  return state.players[opponent(playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
}

/** 支払いで選ばれた敵軍コマンドをリリースする（自軍コマンドのホールドのかわり）。 */
export function releaseEmergencyRequestCommands(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  if (ids.length === 0) return state;
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const command = enemy.command.map((c) => (ids.includes(c.instanceId) ? { ...c, commandHeld: false } : c));
  const next = { ...state, ...updatePlayer(state, enemyId, { ...enemy, command }) };
  return {
    ...next,
    log: [...next.log, buildLogEntry(playerId, "named_effect", "RS-223", state.definitions, `kinkyu_system:${ids.length}`)],
  };
}


// ---------------------------------------------------------------------------
// RS-228 爆竜ステゴスライドン【超スライダー進化】
// 「自軍ターン中、これがバトルエリアに出たとき、「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と
//  書かれている自軍ユニットを1体選んでもよい。そうしたとき、このターン、そのテキストを無効にする。」

export const SLIDER_EVOLUTION_EFFECT_ID = "suraida_ignore_entry_hold";
const SLIDER_EVOLUTION_RULE = "rs228_slider_evolution";
const ONE_HOLD_ENTRY_TEXT = "これは自軍コマンドを1つホールドしなければバトルエリアに出られない";

function beginSliderEvolution(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (ctx.phasePlayerId !== ctx.playerId) return null;
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => c.instanceId !== ctx.triggerSourceInstanceId)
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.text ?? "").includes(ONE_HOLD_ENTRY_TEXT))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: SLIDER_EVOLUTION_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function resolveSliderEvolution(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = fieldUnits(state, playerId).find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const player = addTurnRuleModifier(state.players[playerId], `${SLIDER_EVOLUTION_RULE}::${instanceId}`, {
    sourceCardId: pending.sourceCardId,
  });
  const next = { ...state, ...updatePlayer(state, playerId, player) };
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, pending.sourceCardId, `${SLIDER_EVOLUTION_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
}

/** RS-228: このターン、「1つホールドしなければ出られない」テキストが無効になっているユニットか。 */
export function sliderEvolutionIgnoresEntryHold(
  state: Pick<GameState, "players">,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  return hasTurnRuleModifier(state.players[playerId], `${SLIDER_EVOLUTION_RULE}::${instanceId}`);
}

// ---------------------------------------------------------------------------
// RS-237 サイレンビルダー【トリプルリキッドボンバー】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍山札の上から3枚をオモテにしてもよい。そうしたとき、相手はオモテにした
//  カードの中から好きな数選び手札に加える。このとき相手が手札に加えたカード1枚につき、これは「SP+1」される。
//  その後、残りのカードは捨札にする。」
// 敵軍山札が2枚以下なら発動できない（faq-card-4 RS-237 Q1）。

export const TRIPLE_LIQUID_CONFIRM_EFFECT_ID = "toripururikidobonba_reveal";
export const TRIPLE_LIQUID_PICK_EFFECT_ID = "toripururikidobonba_take";

function beginTripleLiquid(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (ctx.phasePlayerId !== ctx.playerId || !ctx.triggerSourceInstanceId) return null;
  if (state.players[opponent(ctx.playerId)].deck.length < 3) return null;
  return openOptionalEffectConfirm(state, {
    playerId: ctx.playerId,
    effectId: TRIPLE_LIQUID_CONFIRM_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
}

registerOptionalEffect(TRIPLE_LIQUID_CONFIRM_EFFECT_ID, {
  apply: (state, pending) => {
    const enemyId = opponent(pending.playerId);
    const revealed = state.players[enemyId].deck.slice(0, 3).map((c) => c.instanceId);
    if (revealed.length < 3) return state;
    const logged = {
      ...state,
      log: [
        ...state.log,
        buildLogEntry(
          pending.playerId,
          "named_effect",
          pending.sourceCardId,
          state.definitions,
          `toripururikidobonba:${state.players[enemyId].deck.slice(0, 3).map((c) => cardName(state.definitions, c.cardId)).join(",")}`,
        ),
      ],
    };
    return openEffectChoice(logged, {
      playerId: enemyId,
      effectId: TRIPLE_LIQUID_PICK_EFFECT_ID,
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      unitDestination: "hand",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: revealed,
      viewedInstanceIds: revealed,
      selectCount: 3,
      selectedInstanceIds: [],
      optional: true,
    });
  },
  // CPU（相手に手札を与える）は行わない。
  cpuAccepts: () => false,
});

/** 選んだカードを相手の手札に、残りを捨札に置き、手札に加えた数だけ「SP+1」する。 */
function finishTripleLiquid(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const revealed = pending.viewedInstanceIds ?? [];
  const taken = (pending.selectedInstanceIds ?? []).filter((id) => revealed.includes(id));
  const player = state.players[playerId];
  const toHand = player.deck.filter((c) => taken.includes(c.instanceId));
  const toDiscard = player.deck.filter((c) => revealed.includes(c.instanceId) && !taken.includes(c.instanceId));
  let next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck: player.deck.filter((c) => !revealed.includes(c.instanceId)),
      hand: [...player.hand, ...toHand],
      discard: [...player.discard, ...toDiscard],
    }),
  };
  const ownerId = opponent(playerId);
  if (taken.length > 0 && pending.sourceInstanceId) {
    const owner = next.players[ownerId];
    const bump = (c: CardInstance) =>
      c.instanceId === pending.sourceInstanceId ? { ...c, spModifier: (c.spModifier ?? 0) + taken.length } : c;
    next = { ...next, ...updatePlayer(next, ownerId, { ...owner, battle: owner.battle.map(bump), rush: owner.rush.map(bump) }) };
  }
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, pending.sourceCardId, `${TRIPLE_LIQUID_PICK_EFFECT_ID}:${taken.length}`),
  };
}

function resolveTripleLiquid(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  const updated: GameState = {
    ...state,
    pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
  };
  if (remaining.length === 0) return finishTripleLiquid(updated, playerId);
  return { state: updated };
}


// ---------------------------------------------------------------------------
// RS-180 ライドラプター（※常駐）
// 「自軍コマンドをホールドしてSユニットをラッシュしたとき、次の効果を発動できる⇒自分の手札から「WB」のSユニットのカードを
//  1枚選び、コマンドをホールドせずにラッシュする。ただし、ラッシュのための必要パワーと追加条件は満たすこと。
//  この効果でラッシュしたユニットは、このターン、バトルエリアに出られない。」
// コールでユニットをホールドしてラッシュしたときも発動できる（atwiki/page-377 Q1）。効果によるラッシュでは発動しない。

export const RIDE_RAPTOR_EFFECT_ID = "ride_raptor_rush";

export function tryRideRaptorOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.pendingEffectChoice || state.pendingEffectRush) return state;
  const player = state.players[rusherPlayerId];
  const raptor = player.operation.find((c) => c.cardId === "RS-180");
  if (!raptor) return state;
  const rushed = findInZone(player, "rush", rushedInstanceId)?.card;
  if (!rushed || !isSmallUnit(state.definitions, rushed.cardId)) return state;
  // 自軍コマンド（コールのユニットを含む）をホールドしてラッシュしたか。
  const payment = player.lastRushPayment;
  if (!payment || payment.rushedInstanceId !== rushedInstanceId || payment.holdInstanceIds.length === 0) return state;
  const candidates = player.hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return !!def && def.type === "unit" && def.size === "S" && cardHasCategory(def, "WB");
    })
    .map((c) => c.instanceId);
  if (candidates.length === 0) return state;
  return startEffectRush(state, {
    playerId: rusherPlayerId,
    phasePlayerId,
    effectId: RIDE_RAPTOR_EFFECT_ID,
    sourceCardId: raptor.cardId,
    sourceInstanceId: raptor.instanceId,
    fromZone: "hand",
    candidates,
    maxCount: 1,
    requireConditions: true,
    alwaysAsk: true,
    blockBattleEntryThisTurn: true,
  });
}

// ---------------------------------------------------------------------------
// 登録

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [MIRAGE_KNUCKLE_EFFECT_ID]: resolveMirageKnuckle,
  [CHIKARA_BATON_EFFECT_ID]: resolveChikaraBaton,
  [RUNAWAY_GASOLINE_EFFECT_ID]: resolveRunawayGasoline,
  [DEATH_STINGER_EFFECT_ID]: resolveDeathStinger,
  [FLOWER_CARNIVAL_EFFECT_ID]: resolveFlowerCarnival,
  [CAR_NAVIC_EFFECT_ID]: resolveCarNavic,
  [PROVIDER_BASE_EFFECT_ID]: resolveProviderBase,
  [SLIDER_EVOLUTION_EFFECT_ID]: resolveSliderEvolution,
  [TRIPLE_LIQUID_PICK_EFFECT_ID]: resolveTripleLiquid,
};

/** 「好きな数」選んで確定できる選択（confirm_effect_choice を出す）。 */
const CONFIRMABLE_CHOICES = new Set([PROVIDER_BASE_EFFECT_ID, TRIPLE_LIQUID_PICK_EFFECT_ID]);

export function isSet4ConfirmableChoice(effectId: string): boolean {
  return CONFIRMABLE_CHOICES.has(effectId);
}

/** 確定（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (pending.effectId === PROVIDER_BASE_EFFECT_ID) return finishProviderBase(state, playerId);
  if (pending.effectId === TRIPLE_LIQUID_PICK_EFFECT_ID) return finishTripleLiquid(state, playerId);
  return null;
}

export function isSet4ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。 */
export function tryResolveSet4Choice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || !(pending.effectId in CHOICE_RESOLVERS)) return null;
  if (!pending.optional) return null;
  if (pending.effectId === PROVIDER_BASE_EFFECT_ID) return finishProviderBase(state, playerId);
  if (pending.effectId === TRIPLE_LIQUID_PICK_EFFECT_ID) return finishTripleLiquid(state, playerId);
  return {
    state: finish(state, pending.phasePlayerId),
    log: buildLogEntry(playerId, "skip_effect_choice", pending.sourceCardId, state.definitions, `${pending.effectId}:skipped`),
  };
}

/** DSL grant_keyword（`cardId::effectId`）からの起点。対象外なら null。 */
export function trySet4CardEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  _keyword: string,
): GrantKeywordResult | null {
  const id = `${ctx.sourceCardId}::${ctx.effectId}`;
  switch (id) {
    // RS-212 / RS-226: 撃破時の処理はバトル解決（operationCounters）。ここでは何もしない。
    case "RS-212::baku_mirajunakuru":
    case "RS-226::baku_desusuteinga":
    case "RS-225::shi_baku_dan":
      return { state, detail: ctx.effectId };
    case "RS-213::chikara_baton": {
      const next = beginChikaraBaton(state, ctx);
      return next ? { state: next, detail: CHIKARA_BATON_EFFECT_ID } : { state, detail: `${CHIKARA_BATON_EFFECT_ID}:no_targets` };
    }
    case "RS-217::shitakunarugasorin": {
      const next = beginRunawayGasoline(state, ctx);
      return next ? { state: next, detail: RUNAWAY_GASOLINE_EFFECT_ID } : { state, detail: `${RUNAWAY_GASOLINE_EFFECT_ID}:no_targets` };
    }
    case "RS-185::kanabiku": {
      const next = beginCarNavic(state, ctx);
      return next
        ? { state: discardUsedOperation(next, ctx), detail: CAR_NAVIC_EFFECT_ID }
        : { state, detail: `${CAR_NAVIC_EFFECT_ID}:no_counter` };
    }
    case "RS-186::purobaidabesu": {
      const next = beginProviderBase(state, ctx);
      return {
        state: next.pendingEffectChoice ? discardUsedOperation(next, ctx) : next,
        detail: PROVIDER_BASE_EFFECT_ID,
      };
    }
    case "RS-228::suraida": {
      const next = beginSliderEvolution(state, ctx);
      return next ? { state: next, detail: SLIDER_EVOLUTION_EFFECT_ID } : { state, detail: `${SLIDER_EVOLUTION_EFFECT_ID}:no_targets` };
    }
    case "RS-237::toripururikidobonba": {
      const next = beginTripleLiquid(state, ctx);
      return next ? { state: next, detail: TRIPLE_LIQUID_CONFIRM_EFFECT_ID } : { state, detail: `${TRIPLE_LIQUID_CONFIRM_EFFECT_ID}:unmet` };
    }
    case "RS-193::furawakanibaru":
      return { state: applyFlowerCarnival(state, ctx), detail: "furawakanibaru" };
    // RS-192【アタックボード】: ターン終了時の処理（tryOpenSet4EndTurnChoice）。NC 成立は activatedNcEffects に記録済み。
    case "RS-192::atakubodo":
      return { state, detail: ctx.effectId };
    case "RS-220::baria_e58f8d":
      return { state: applyReflectBarrier(state, ctx), detail: REFLECT_BARRIER_RULE };
    default:
      return null;
  }
}
