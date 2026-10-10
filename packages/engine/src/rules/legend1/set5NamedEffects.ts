/**
 * 第5弾「五龍の逆鱗」（legend1）のカード固有の名前付き効果（RS-306〜RS-347 の一部）。
 *
 * 各関数はエンジンの該当箇所（アタック対象の判定・撃破の置換・BP 計算など）から呼ばれる参照関数と、
 * このモジュールが開いた選択の解決（tryResolveSet5Choice / trySkipSet5Choice）。
 */
import type { CardInstance, GameState, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import { addTurnRuleModifier, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { cardName, effectiveBp, getDefinition, isSmallUnit, unitEffectiveCategories } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { buildLogEntry } from "../../log/formatLog";
import { unitFeatures } from "../addedFeatures";
import { bounceToHand } from "../bounce";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { finalizeLeaveReaction, tryLeaveField } from "../operationCounters";
import { commandCategoriesNow } from "../legend3/battleEffects";

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
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
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

function blockRushAreaEntry(state: GameState, playerId: PlayerId, sourceCardId: string): GameState {
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
  if (!striker || !isSmallUnit(state.definitions, striker.cardId)) return state;
  const next = blockRushAreaEntry(state, strikerId, "RS-320");
  if (next === state) return state;
  return {
    ...next,
    log: [...next.log, buildLogEntry(defenderId, "named_effect", "RS-320", state.definitions, "suwaniryujon")],
  };
}

// ---------------------------------------------------------------------------
// DSL grant_keyword（`cardId::effectId`）からの起点

export function trySet5CardEffect(state: GameState, ctx: GrantKeywordContext, _keyword: string): GrantKeywordResult | null {
  switch (`${ctx.sourceCardId}::${ctx.effectId}`) {
    case "RS-319::deisodobega":
      return applyDSwordVega(state, ctx);
    default:
      return null;
  }
}
