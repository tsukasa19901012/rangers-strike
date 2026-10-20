import { isSameCardIdentity } from "@rangers-strike/cards";
/**
 * 第5弾「五龍の逆鱗」（legend1）のカード固有の名前付き効果（RS-306〜RS-347 の一部）。
 *
 * 各関数はエンジンの該当箇所（アタック対象の判定・撃破の置換・BP 計算など）から呼ばれる参照関数と、
 * このモジュールが開いた選択の解決（tryResolveSet5Choice / trySkipSet5Choice）。
 */
import type { CardInstance, GameState, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import { addTurnRuleModifier, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { cardName, effectiveBp, getDefinition, isSmallUnit, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { clearCostWindow, satisfyCostWindow } from "../../core/costWindow";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { buildLogEntry } from "../../log/formatLog";
import { unitFeatures } from "../addedFeatures";
import { bounceToHand } from "../bounce";
import { hasBattleNcEffect, markBattleNcEffect } from "../namedUnitEffects";
import { openOptionalEffectConfirm, registerOptionalEffect } from "../optionalEffects";
import { shuffleCards } from "../errataCardEffects";
import { SUPER_FORMATION_RULE } from "../zord";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { finalizeLeaveReaction, tryLeaveField } from "../operationCounters";
import { commandCategoriesNow } from "../legend3/battleEffects";
import { namedEffectActive } from "../ncGatedEffects";
import { openDestroyTimedChoice } from "../destroyTriggerTiming";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function settled(state: GameState): GameState {
  return state.pendingEffectChoice || state.pendingLeave ? state : promoteDeferredBattleEntry(state);
}

export function isSet5ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet5Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet5Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

// ---------------------------------------------------------------------------
// RS-311 ゴウライスタッグ【カラクリ忍法・牙がくれ】
// 「これは、コマンドゾーンにあるリリース状態のカードと同じカテゴリを持つ敵軍ユニットにアタックされない。」
// 自軍・敵軍どちらのコマンドゾーンも参照する（faq-card-5 RS-311 Q1）。

export function kibaGakureBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderCard: CardInstance,
): boolean {
  if (defenderCard.cardId !== "RS-311") return false;
  const attackerPlayer = state.players[attackerPlayerId];
  const inBattle = findInZone(attackerPlayer, "battle", attackerInstanceId);
  const inRush = inBattle ? undefined : findInZone(attackerPlayer, "rush", attackerInstanceId);
  const attacker = inBattle ?? inRush;
  if (!attacker) return false;
  const attackerCats: string[] = unitEffectiveCategories(state, attackerPlayerId, attacker.card, inBattle ? "battle" : "rush");
  if (attackerCats.length === 0) return false;
  for (const pid of ["player1", "player2"] as const) {
    for (const cmd of state.players[pid].command) {
      if (cmd.commandHeld) continue;
      if (!getDefinition(state.definitions, cmd.cardId)) continue;
      if (commandCategoriesNow(state, cmd).some((c) => attackerCats.includes(c))) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// RS-317 爆竜カスモシールドン【超シールド進化】
// 「これが自軍ラッシュエリアにある間、DAの自軍ユニットが撃破されたとき、自軍ラッシュエリアから特徴「恐竜」を持つユニットを
//  2体選び、かわりに捨札にしてもよい。」
// 選ぶ2体にカスモシールドン自身を含めてよい（faq-card-5 RS-317 Q1）。かわりに捨札にしたユニットは撃破ではない。

export const KASUMO_SHIELD_EFFECT_ID = "rs317_super_shield";

function kasumoShieldCandidates(state: GameState, intent: PendingLeave): string[] {
  const owner = state.players[intent.ownerPlayerId];
  return owner.rush
    .filter((c) => c.instanceId !== intent.instanceId)
    .filter((c) => unitFeatures(state, intent.ownerPlayerId, c).includes("恐竜"))
    .map((c) => c.instanceId);
}

/**
 * 撃破で場を離れる前に呼ぶ（rules/operationCounters.ts tryLeaveField）。条件を満たせば選択を開いた状態を返す。
 */
export function openKasumoShieldChoice(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.kasumoShieldDeclined || intent.notDestruction || intent.toZone !== "discard") return null;
  if (intent.resumePendingStrike || state.pendingEffectChoice) return null;
  const owner = state.players[intent.ownerPlayerId];
  const shield = owner.rush.find((c) => c.cardId === "RS-317" && c.instanceId !== intent.instanceId);
  if (!shield) return null;
  const leaving = findInZone(owner, intent.fromZone, intent.instanceId);
  if (!leaving) return null;
  if (!unitEffectiveCategories(state, intent.ownerPlayerId, leaving.card, intent.fromZone).includes("DA")) return null;
  const candidates = kasumoShieldCandidates(state, intent);
  if (candidates.length < 2) return null;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: intent.ownerPlayerId,
      effectId: KASUMO_SHIELD_EFFECT_ID,
      sourceCardId: "RS-317",
      sourceInstanceId: shield.instanceId,
      kind: "select_unit",
      phasePlayerId: intent.phasePlayerId,
      validInstanceIds: candidates,
      selectedInstanceIds: [],
      selectCount: 2,
      optional: true,
      kasumoShieldMeta: { intent },
    },
    activePlayer: intent.ownerPlayerId,
  };
}

function continueFollowUp(state: GameState, intent: PendingLeave): GameState {
  if (!intent.followUpAttackerLeave || state.pendingLeave || state.pendingEffectChoice || state.pendingRegister) return state;
  return tryLeaveField(state, { ...intent.followUpAttackerLeave }).state;
}

function resolveKasumoShield(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const intent = pending.kasumoShieldMeta?.intent;
  if (!intent || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          selectedInstanceIds: selected,
          validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
          // 1体目を選んだら、2体目も選ぶ（途中でやめられない）。
          optional: false,
        },
      },
    };
  }
  const names = selected
    .map((id) => cardName(state.definitions, findInZone(state.players[playerId], "rush", id)?.card.cardId ?? id))
    .join("、");
  // 撃破されたユニットは場に留まる（撃破された事実は残る。R-DESTROY-02）。
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  let deferred = false;
  for (const id of selected) {
    const owner = next.players[playerId];
    const found = findInZone(owner, "rush", id);
    if (!found) continue;
    if (deferred) {
      // 先の1体の「場を離れるとき」の応答待ち — 残りはそのまま捨札にする。
      const [card, rush] = removeAt(owner.rush, found.index);
      next = { ...next, ...updatePlayer(next, playerId, { ...owner, rush, discard: [...owner.discard, card] }) };
      continue;
    }
    const leave = tryLeaveField(next, {
      ownerPlayerId: playerId,
      instanceId: id,
      fromZone: "rush",
      toZone: "discard",
      leavingCardId: found.card.cardId,
      phasePlayerId: pending.phasePlayerId,
      notDestruction: true,
    });
    next = leave.state;
    deferred = leave.deferred;
  }
  if (!deferred) next = continueFollowUp(next, intent);
  return { state: settled(next), log: logFor(state, playerId, "RS-317", `${KASUMO_SHIELD_EFFECT_ID}:${names}`) };
}

function skipKasumoShield(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const intent = pending.kasumoShieldMeta?.intent;
  if (!intent) return { error: "invalid_choice" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const leave = tryLeaveField(cleared, { ...intent, kasumoShieldDeclined: true });
  let next = leave.state;
  if (!leave.deferred) next = continueFollowUp(next, intent);
  return {
    state: settled(next),
    log: buildLogEntry(playerId, "skip_effect_choice", "RS-317", state.definitions, `${KASUMO_SHIELD_EFFECT_ID}:skipped`),
  };
}

CHOICE_RESOLVERS[KASUMO_SHIELD_EFFECT_ID] = resolveKasumoShield;
CHOICE_SKIPPERS[KASUMO_SHIELD_EFFECT_ID] = skipKasumoShield;

// ---------------------------------------------------------------------------
// RS-319 デカマスター【ディーソードベガ】
// 「自軍ターン中、これがバトルエリアに出たとき、BPの下三桁が500の敵軍Sユニットをすべて撃破する。」
// 敵軍ラッシュエリア・バトルエリアの両方が対象。BP は現在の値。

export const D_SWORD_VEGA_EFFECT_ID = "deisodobega";

/**
 * RS-319 ※「自軍ラッシュフェイズ中、敵軍ダメージが自軍ダメージ以上なら、このユニットを持ち主の手札に戻す。」
 * 条件を満たしたら他の宣言より先に即座に戻す（faq-card-5 RS-319 Q1）。同点・0点どうしでも戻る（Q2・Q3）。
 * 進行中の処理がないとき（applyAction の後処理）に呼ぶ。
 */
export function applyDekaMasterReturn(state: GameState): GameState {
  if (state.phase !== "rush" || state.winner) return state;
  const turnPlayerId = state.activePlayer;
  const enemyId = opponent(turnPlayerId);
  let next = state;
  for (let guard = 0; guard < 10; guard += 1) {
    const owner = next.players[turnPlayerId];
    if (next.players[enemyId].damage < owner.damage) return next;
    const zone = owner.rush.some((c) => c.cardId === "RS-319") ? "rush" : owner.battle.some((c) => c.cardId === "RS-319") ? "battle" : null;
    if (!zone) return next;
    const card = owner[zone].find((c) => c.cardId === "RS-319")!;
    const bounced = bounceToHand(next, { playerId: turnPlayerId, instanceId: card.instanceId, fromZone: zone }).state;
    if (bounced === next) return next;
    next = {
      ...bounced,
      log: [...bounced.log, buildLogEntry(turnPlayerId, "named_effect", "RS-319", state.definitions, "return_to_hand_rush_phase")],
    };
  }
  return next;
}

function bpLastThreeDigitsIs500(bp: number): boolean {
  return bp > 0 && bp % 1000 === 500;
}

function applyDSwordVega(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${D_SWORD_VEGA_EFFECT_ID}:not_own_turn` };
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const targets = [...enemy.battle, ...enemy.rush]
    .filter((c) => isSmallUnit(state.definitions, c))
    .filter((c) => bpLastThreeDigitsIs500(effectiveBp(state, enemyId, c)))
    .map((c) => c.instanceId);
  if (targets.length === 0) return { state, detail: `${D_SWORD_VEGA_EFFECT_ID}:no_targets` };
  let next = state;
  if (next.pendingEffectChoice) {
    for (const id of targets) {
      const leave = applyUnitLeave(next, id, "discard", ctx.phasePlayerId);
      if (!("error" in leave)) next = leave.state;
    }
    return { state: next, detail: D_SWORD_VEGA_EFFECT_ID };
  }
  // 複数体の撃破（離場反応での中断／再開）は select_units_bp_budget の確定処理を共用する。
  const opened = openEffectChoice(next, {
    playerId: ctx.playerId,
    effectId: D_SWORD_VEGA_EFFECT_ID,
    sourceCardId: "RS-319",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_units_bp_budget",
    validInstanceIds: targets,
    selectedInstanceIds: targets,
    bpBudget: Number.MAX_SAFE_INTEGER,
    optional: false,
  });
  const confirmed = applyConfirmEffectChoice(opened, ctx.playerId);
  if ("error" in confirmed) return { state, detail: `${D_SWORD_VEGA_EFFECT_ID}:failed` };
  return { state: confirmed.state, detail: D_SWORD_VEGA_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// RS-320 デカスワン【スワンイリュージョン】・RS-324 マジマザー【マジ・ロッドルーシー】
// 「敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない」— 対象プレイヤーへのターン限定のルール。
// 発動した後にラッシュしたユニットも出られない（faq-card-5 RS-324 Q2）。

export const RUSH_AREA_NO_ENTRY_RULE = "rs5_rush_area_no_battle_entry_this_turn";

/** このターン、ラッシュエリアのユニットをバトルエリアに出せないか。 */
export function rushAreaEntryBlockedThisTurn(state: GameState, playerId: PlayerId): boolean {
  return hasTurnRuleModifier(state.players[playerId], RUSH_AREA_NO_ENTRY_RULE);
}

export function blockRushAreaEntry(state: GameState, playerId: PlayerId, sourceCardId: string): GameState {
  if (rushAreaEntryBlockedThisTurn(state, playerId)) return state;
  const player = addTurnRuleModifier(state.players[playerId], RUSH_AREA_NO_ENTRY_RULE, { sourceCardId });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

/**
 * RS-320: 「これが自軍ラッシュエリアにある間、敵軍ターン中、敵軍Sユニットにストライクされてダメージを受けたとき、
 *  敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない。」
 * ストライクのダメージを与える処理（rules/strikeReactions.ts finalizeStrike）から呼ぶ。
 */
export function applySwanIllusionOnStrike(state: GameState, pending: PendingStrike): GameState {
  const strikerId = pending.strikerPlayerId;
  const defenderId = opponent(strikerId);
  if (pending.battlePhasePlayer !== strikerId) return state;
  if (!state.players[defenderId].rush.some((c) => c.cardId === "RS-320")) return state;
  const striker = findInZone(state.players[strikerId], "battle", pending.strikerInstanceId)?.card;
  if (!striker || !isSmallUnit(state.definitions, striker)) return state;
  const next = blockRushAreaEntry(state, strikerId, "RS-320");
  if (next === state) return state;
  return {
    ...next,
    log: [...next.log, buildLogEntry(defenderId, "named_effect", "RS-320", state.definitions, "suwaniryujon")],
  };
}

/**
 * RS-324 マジマザー【ジルマ・マジュナ】
 * 「これが自軍ラッシュエリアにある間、次の効果を発動できる⇒敵軍ターン中、自軍ユニットが撃破されたとき、
 *  これをかわりに捨札にしてもよい。そうしたとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない。」
 * 離場の応答（pendingLeave）で use_super_shield（substituteInstanceId）として選ぶ。1回の撃破に1体だけ（faq-card-5 RS-324 Q1）。
 * BP0 以下でルールにより撃破されるユニットにも使える（Q3）。
 */
export function magiMotherSubstitutes(state: GameState, intent: PendingLeave): string[] {
  if (intent.notDestruction || intent.toZone !== "discard") return [];
  if (intent.phasePlayerId === intent.ownerPlayerId) return [];
  return state.players[intent.ownerPlayerId].rush
    .filter((c) => c.cardId === "RS-324" && c.instanceId !== intent.instanceId)
    .map((c) => c.instanceId);
}

/** 撃破を止めたあと（finalizeLeaveReaction 済み）に、マジマザーを捨札にして敵軍の出場を封じる。 */
export function applyMagiMotherSubstitute(
  state: GameState,
  ownerId: PlayerId,
  motherInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; log: string; deferred: boolean } {
  const found = findInZone(state.players[ownerId], "rush", motherInstanceId);
  const log = buildLogEntry(ownerId, "named_effect", "RS-324", state.definitions, "jiruma_majuna");
  if (!found) return { state, log, deferred: false };
  const blocked = blockRushAreaEntry(state, opponent(ownerId), "RS-324");
  const leave = tryLeaveField(blocked, {
    ownerPlayerId: ownerId,
    instanceId: motherInstanceId,
    fromZone: "rush",
    toZone: "discard",
    leavingCardId: found.card.cardId,
    phasePlayerId,
    notDestruction: true,
  });
  return { state: leave.state, log, deferred: leave.deferred };
}

// ---------------------------------------------------------------------------
// RS-323 マジグリーン・マッスル【マジ・マージ】（NC）
// 「このユニットからコンビネーションするSユニットは、敵軍ラッシュエリアのユニットにアタックできる。」
// バトルエリアの並びでマッスルのすぐ次にある S ユニット（マッスルからコンビネーションしたユニット）が対象。

export const MAGI_MERGE_EFFECT_ID = "majimaji";

/** 並びのすぐ前のユニット（このユニットがコンビネーションした元）。 */
export function comboFromUnit(state: GameState, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === instanceId);
  return index > 0 ? battle[index - 1] : undefined;
}

export function magiMergeAllowsRushAttack(state: GameState, attackerPlayerId: PlayerId, attackerInstanceId: string): boolean {
  const attacker = findInZone(state.players[attackerPlayerId], "battle", attackerInstanceId)?.card;
  if (!attacker || !isSmallUnit(state.definitions, attacker)) return false;
  const from = comboFromUnit(state, attackerPlayerId, attackerInstanceId);
  return !!from && from.cardId === "RS-323" && hasBattleNcEffect(from, MAGI_MERGE_EFFECT_ID);
}

// ---------------------------------------------------------------------------
// RS-325 天空勇者マジシャイン【マジチケット】
// 「これが自軍ラッシュエリアにある間、自軍コマンドゾーンにあるオペレーションカードの効果を、そのコマンドをホールドして
//  手札から使用するかのように発動できる（必要パワーとタイミングは満たすこと）。発動したカードは、捨札になるとき
//  リリース状態の自軍コマンドをかわりに1つ捨札にすればコマンドゾーンに留まる。」
// - 使うオペレーションカード自体をホールドすればよい（faq-card-5 RS-325 Q4・Q6）。
// - 実際には手札から使用していないので「次に手札から使用するカード」の軽減は受けない（atwiki/page-485 Q1）— 必要パワーは印刷値。
// 発動は通常の play_operation と同じ解決を使う（カードを手札に、同じカードのホールド状態の写しをコマンドゾーンに一時的に置く）。

export const MAGI_TICKET_KEEP_EFFECT_ID = "rs325_magi_ticket_keep";
const MAGI_TICKET_STAND_IN_SUFFIX = "#magi_ticket";

/** マジチケットで発動できるコマンドゾーンのオペレーションか（タイミング以外の条件。タイミングは呼び出し側＝ラッシュフェイズの合法手）。 */
export function magiTicketUsable(
  state: GameState,
  playerId: PlayerId,
  command: CardInstance,
  isNormalOperation: (cardId: string) => boolean,
  availablePower: number,
): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  const player = state.players[playerId];
  if (!player.rush.some((c) => c.cardId === "RS-325")) return false;
  if (command.commandHeld) return false;
  const def = getDefinition(state.definitions, command.cardId);
  if (!def || def.type !== "operation" || !isNormalOperation(command.cardId)) return false;
  return availablePower >= parsePowerCost(def.powerCost);
}

/**
 * play_operation を通すための仮の状態: コマンドゾーンのカードを手札へ移し、同じカードのホールド状態の写しをコマンドゾーンに置く。
 */
export function stageMagiTicket(state: GameState, playerId: PlayerId, commandInstanceId: string): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "command", commandInstanceId);
  if (!found) return null;
  const { commandHeld: _h, paymentHeld: _p, mothershipHold: _m, ...card } = found.card;
  const standIn: CardInstance = {
    ...card,
    instanceId: `${card.instanceId}${MAGI_TICKET_STAND_IN_SUFFIX}`,
    commandHeld: true,
    paymentHeld: true,
  };
  const command = [...player.command];
  command[found.index] = standIn;
  const staged = satisfyCostWindow({ ...player, command, hand: [...player.hand, card] }, "operation_category");
  return { ...state, ...updatePlayer(state, playerId, staged) };
}

/** play_operation の後: 写しを取り除き、捨札になるときの選択（applyAction の後処理）のために記録する。 */
export function finishMagiTicketStaging(state: GameState, playerId: PlayerId, commandInstanceId: string): GameState {
  const player = state.players[playerId];
  const standInId = `${commandInstanceId}${MAGI_TICKET_STAND_IN_SUFFIX}`;
  const command = player.command.filter((c) => c.instanceId !== standInId);
  // 手札に残っていれば（使用に失敗）コマンドゾーンに戻す。
  const leftInHand = player.hand.find((c) => c.instanceId === commandInstanceId);
  const next = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...clearCostWindow(player, "operation_category"),
      command: leftInHand ? [...command, { ...leftInHand, commandHeld: false }] : command,
      hand: leftInHand ? player.hand.filter((c) => c.instanceId !== commandInstanceId) : player.hand,
    }),
  };
  return leftInHand ? next : { ...next, magiTicketPending: { playerId, instanceId: commandInstanceId } };
}

/**
 * applyAction の後処理（進行中の処理がないとき）: マジチケットで発動したカードが捨札になっていれば、
 * リリース状態の自軍コマンドをかわりに捨札にするかの選択を開く。
 */
export function settleMagiTicket(state: GameState): GameState {
  const ticket = state.magiTicketPending;
  if (!ticket) return state;
  const cleared: GameState = { ...state, magiTicketPending: undefined };
  const player = cleared.players[ticket.playerId];
  if (!player.discard.some((c) => c.instanceId === ticket.instanceId)) return cleared;
  const released = player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (released.length === 0) return cleared;
  return openEffectChoice(cleared, {
    playerId: ticket.playerId,
    effectId: MAGI_TICKET_KEEP_EFFECT_ID,
    sourceCardId: "RS-325",
    sourceInstanceId: ticket.instanceId,
    kind: "select_commands",
    commandFilter: "released",
    phasePlayerId: cleared.activePlayer,
    validInstanceIds: released,
    selectCount: 1,
    optional: true,
  });
}

function resolveMagiTicketKeep(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const cmd = findInZone(player, "command", instanceId);
  const used = player.discard.find((c) => c.instanceId === pending.sourceInstanceId);
  if (!cmd || cmd.card.commandHeld || !used) return { error: "invalid_target" };
  const { commandHeld: _h, paymentHeld: _p, mothershipHold: _m, ...discarded } = cmd.card;
  const command = player.command.filter((c) => c.instanceId !== instanceId);
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      // 発動したカードはホールド状態のままコマンドゾーンに留まる。
      command: [...command, { ...used, commandHeld: true }],
      discard: [...player.discard.filter((c) => c.instanceId !== used.instanceId), discarded],
    }),
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
  };
  return {
    state: settled(next),
    log: logFor(state, playerId, "RS-325", `${MAGI_TICKET_KEEP_EFFECT_ID}:${cardName(state.definitions, cmd.card.cardId)}`),
  };
}

function skipMagiTicketKeep(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  return {
    state: settled({ ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }),
    log: buildLogEntry(playerId, "skip_effect_choice", "RS-325", state.definitions, `${MAGI_TICKET_KEEP_EFFECT_ID}:skipped`),
  };
}

CHOICE_RESOLVERS[MAGI_TICKET_KEEP_EFFECT_ID] = resolveMagiTicketKeep;
CHOICE_SKIPPERS[MAGI_TICKET_KEEP_EFFECT_ID] = skipMagiTicketKeep;

// ---------------------------------------------------------------------------
// RS-328 魔法鉄神トラベリオン【デストラクションファイヤー】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドの数よりも敵軍ユニットの数が多ければ、次の効果を発動できる⇒
//  相手は自分自身のユニットを1体選び、自分自身の山札に戻してシャッフルする。」

export const DESTRUCTION_FIRE_CONFIRM_EFFECT_ID = "rs328_destruction_fire_confirm";
export const DESTRUCTION_FIRE_PICK_EFFECT_ID = "rs328_destruction_fire_pick";

function openDestructionFire(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "desutorakushonfuaiya:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const enemyUnits = state.players[enemyId].rush.length + state.players[enemyId].battle.length;
  if (enemyUnits <= state.players[ctx.playerId].command.length) return { state, detail: "desutorakushonfuaiya:unmet" };
  const sourceInstanceId = ctx.triggerSourceInstanceId;
  const opened = openOptionalEffectConfirm(state, {
    playerId: ctx.playerId,
    effectId: DESTRUCTION_FIRE_CONFIRM_EFFECT_ID,
    sourceCardId: "RS-328",
    sourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
  // 「発動する」をトラベリオン自身の選択としても選べるようにする（confirm と同じ）。
  const withId = sourceInstanceId
    ? { ...opened, pendingEffectChoice: { ...opened.pendingEffectChoice!, validInstanceIds: [sourceInstanceId] } }
    : opened;
  return { state: withId, detail: "desutorakushonfuaiya" };
}

registerOptionalEffect(DESTRUCTION_FIRE_CONFIRM_EFFECT_ID, {
  apply: (state, pending) => {
    const enemyId = opponent(pending.playerId);
    const enemy = state.players[enemyId];
    const ids = [...enemy.battle, ...enemy.rush].map((c) => c.instanceId);
    if (ids.length === 0) return state;
    return openEffectChoice(state, {
      playerId: enemyId,
      effectId: DESTRUCTION_FIRE_PICK_EFFECT_ID,
      sourceCardId: "RS-328",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    });
  },
});

function resolveDestructionFirePick(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const zone = findInZone(player, "battle", instanceId) ? "battle" : findInZone(player, "rush", instanceId) ? "rush" : null;
  if (!zone) return { error: "invalid_target" };
  const cardId = findInZone(player, zone, instanceId)!.card.cardId;
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const moved = applyUnitLeave(next, instanceId, "deck_top", pending.phasePlayerId);
  if ("error" in moved) return moved;
  next = moved.state;
  const owner = next.players[playerId];
  next = { ...next, ...updatePlayer(next, playerId, { ...owner, deck: shuffleCards(owner.deck) }) };
  return {
    state: settled(next),
    log: logFor(state, playerId, "RS-328", `${DESTRUCTION_FIRE_PICK_EFFECT_ID}:${cardName(state.definitions, cardId)}`),
  };
}

CHOICE_RESOLVERS[DESTRUCTION_FIRE_PICK_EFFECT_ID] = resolveDestructionFirePick;

// ---------------------------------------------------------------------------
// RS-340 / RS-343 ゲキレッド【ゲキヌンチャク】（NC）
// 「「SP1」特徴「獣」を持つユニットからコンビネーションするとき、このターン、これはBP＋2000される。」
// NC 成立時（「SP1」の付与と同時）に、並びのすぐ前のユニットが「獣」を持てば、このターンの BP+2000 を記録する。

const GEKI_NUNCHAKU_RULE = "rs340_gekinunchaku_bp";

function applyGekiNunchaku(state: GameState, ctx: GrantKeywordContext): GameState {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return state;
  const from = comboFromUnit(state, ctx.playerId, id);
  if (!from || !unitFeatures(state, ctx.playerId, from).includes("獣")) return state;
  const rule = `${GEKI_NUNCHAKU_RULE}::${id}`;
  const player = state.players[ctx.playerId];
  if (hasTurnRuleModifier(player, rule)) return state;
  return { ...state, ...updatePlayer(state, ctx.playerId, addTurnRuleModifier(player, rule, { sourceCardId: ctx.sourceCardId })) };
}

/** 効果による BP の継続修正（core/catalog.ts passiveBpBonus から呼ぶ）。 */
export function set5PassiveBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (!isSameCardIdentity(instance.cardId, "RS-340") && !isSameCardIdentity(instance.cardId, "RS-343")) return 0;
  return hasTurnRuleModifier(state.players[playerId], `${GEKI_NUNCHAKU_RULE}::${instance.instanceId}`) ? 2000 : 0;
}

/**
 * アタックするときの BP 修正（rules/namedUnitEffects.ts battleAttackerBpBonus から呼ぶ）。
 * - RS-342 ゲキイエロー【ゲキロッド】（NC）: 自軍ターン中、敵軍Sユニットとバトルするとき BP+4000。
 * - RS-344 天空勇者ウルザードファイヤー【ブレイジングストームスラッシュ】: アタックするとき、リリース状態の自軍コマンド1つにつき BP+1000。
 */
export function set5AttackerBpBonus(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
  isNamedEffectActive: (card: CardInstance, effectId: string) => boolean,
): number {
  let total = 0;
  if (
    attacker.cardId === "RS-342" &&
    state.activePlayer === attackerPlayerId &&
    isNamedEffectActive(attacker, "gekirodo")
  ) {
    const enemy = state.players[defenderPlayerId];
    const defender = findInZone(enemy, "battle", defenderInstanceId) ?? findInZone(enemy, "rush", defenderInstanceId);
    if (defender && isSmallUnit(state.definitions, defender.card)) total += 4000;
  }
  if (attacker.cardId === "RS-344") {
    total += state.players[attackerPlayerId].command.filter((c) => !c.commandHeld).length * 1000;
  }
  return total;
}

/** grant_keyword の通常処理の前に行う、カード固有の付随処理（効果の本体は通常どおり処理する）。 */
export function applySet5GrantSideEffects(state: GameState, ctx: GrantKeywordContext): GameState {
  if ((isSameCardIdentity(ctx.sourceCardId, "RS-340") || isSameCardIdentity(ctx.sourceCardId, "RS-343")) && ctx.effectId === "gekinunchaku") {
    return applyGekiNunchaku(state, ctx);
  }
  return state;
}

// ---------------------------------------------------------------------------
// DSL grant_keyword（`cardId::effectId`）からの起点

export function trySet5CardEffect(state: GameState, ctx: GrantKeywordContext, _keyword: string): GrantKeywordResult | null {
  switch (`${ctx.sourceCardId}::${ctx.effectId}`) {
    case "RS-319::deisodobega":
      return applyDSwordVega(state, ctx);
    case "RS-347::supafuomeshon": {
      // RS-347 スーパーフォーメーション: このターン、合体ユニットの不足分をコマンドゾーンのカードで補える（rules/zord.ts）。
      const player = addTurnRuleModifier(state.players[ctx.playerId], SUPER_FORMATION_RULE, { sourceCardId: "RS-347" });
      return { state: { ...state, ...updatePlayer(state, ctx.playerId, player) }, detail: "supafuomeshon" };
    }
    case "RS-328::desutorakushonfuaiya":
      return openDestructionFire(state, ctx);
    case "RS-323::majimaji": {
      // NC 成立を記録する。アタック対象の判定は magiMergeAllowsRushAttack（rules/legend3/restrictions.ts）。
      const id = ctx.triggerSourceInstanceId;
      return { state: id ? markBattleNcEffect(state, ctx.playerId, id, MAGI_MERGE_EFFECT_ID) : state, detail: MAGI_MERGE_EFFECT_ID };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// RS-312 カブトライジャー【迅雷流剣技・雷撃斬】（NC: CN 3）
// 「これがユニットを撃破したとき、これが撃破したユニットと同じ特徴を1つ以上持つユニットが敵軍ラッシュエリアにあれば
//  1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-482）
// 「撃破したとき」— R-TIME-01 の段階 1。撃破されたユニットの「撃破されて捨札になったとき」（段階 4。RS-336 の※）より先に
// 対象を選ぶので、その効果で後から出たユニットは選べない（grnrngr/faq-card-5 RS-312 Q1）。置くのは強制（「置く」）。
// 置かれるユニットは場を離れるので、ダイノガッツ等で留められる（同 Q2。applyUnitLeave の離場の応答）。

export const RAIGEKI_ZAN_EFFECT_ID = "kami_ken_kami_geki_zan";

export function openRaigekiZanChoice(
  state: GameState,
  destroyerOwner: PlayerId,
  destroyerInstanceId: string,
  destroyed: CardInstance,
  phasePlayerId: PlayerId,
): GameState {
  const owner = state.players[destroyerOwner];
  const kabuto = [...owner.battle, ...owner.rush].find((c) => c.instanceId === destroyerInstanceId);
  if (!kabuto || kabuto.cardId !== "RS-312") return state;
  if (!namedEffectActive(kabuto, RAIGEKI_ZAN_EFFECT_ID)) return state;
  const enemyId = opponent(destroyerOwner);
  const features = new Set(unitFeatures(state, enemyId, destroyed));
  if (features.size === 0) return state;
  const ids = state.players[enemyId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .filter((c) => unitFeatures(state, enemyId, c).some((f) => features.has(f)))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openDestroyTimedChoice(state, {
    destroyTriggerTiming: "destroyer",
    playerId: destroyerOwner,
    effectId: RAIGEKI_ZAN_EFFECT_ID,
    sourceCardId: "RS-312",
    sourceInstanceId: destroyerInstanceId,
    kind: "select_unit",
    unitDestination: "power",
    placeAsDamage: true,
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}
