import { settleResolvingOperations, trackResolvingOperations } from "../rules/resolvingOperations";
import { applyMagiPunchCounter, isSet4EndTurnEffect, magiPunchCounterIds } from "../rules/legend1/set4NamedEffects";
import { rushAdditionalConditionApplies } from "../rules/bkOperationTurnRules";
import { applyDeusGeneOnRush } from "../rules/rs4NcEffects";
import type { GameAction } from "../types/actions";
import type { GameState, PendingBattle, PendingStrike, PlayerId, PlayerState, CardInstance } from "../types/game";
import { hasTurnRuleModifier, TURN_RULE_IDS } from "./scopedModifiers";
import { clearRegisterHoldOffField } from "../rules/resist";
import { operationFizzles } from "../rules/operationFizzle";
import { openDeferredRushReaction } from "../events/emitUnitRushed";
import {
  getBattleEntryHoldCount,
  getCardEffect,
  listZordFusionPartnerIds,
  needsBattleEntryHandDiscard,
} from "@rangers-strike/cards";
import { COMMAND_ZONE_MAX } from "../types/game";
import { checkWinner, advancePhase } from "./createGame";
import {
  canPlayOperation,
  cardName,
  effectiveBp,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
  isRushable,
  isUnit,
  needsZordMaterial,
  parsePowerCost,
  rushPowerCost,
} from "./catalog";
import {
  isPermanentCard,
  needsOperationTarget,
  placePermanentOperation,
  resolveOperationEffect,
} from "../effects/resolveOperation";
import {
  hidoraEggLog,
  infiniteChainLog,
  resolveHidoraEgg,
  resolveInfiniteChain,
} from "../rules/legend2/operations";
import {
  buildLogEntry,
  buildSimpleLogEntry,
} from "../log/formatLog";
import { clearTurnModifiers } from "./modifiers";
import { clearAllCostWindows, clearCostWindow, isCostWindowSatisfied } from "./costWindow";
import {
  countAvailablePower,
  effectivePowerCost,
  findInZone,
  opponent,
  payPowerCost,
  removeAt,
  rushReactorId,
  updatePlayer,
} from "./helpers";
import { isLegalAction } from "./legalActions";
import { resolveDamagePaymentSelect, startNextQueuedDamage } from "../rules/damagePayment";
import {
  battlePositionAfterMove,
  canStrikeUnit,
  strikeDamageFor,
} from "../rules/combo";
import { addRushPhaseRuleModifier, addTurnRestrictionModifier } from "./scopedModifiers";
import { emitBattleDeclaredAndResolve } from "../events/emitBattleDeclared";
import {
  ATTACK_HOLD_BONUS_EFFECT_ID,
  listAttackHoldSources,
  openAttackHoldChoice,
  resolveAttackHoldChoice,
} from "../rules/attackHoldBonus";
import {
  MACHINE_EMPIRE_EFFECT_ID,
  openMachineEmpireChoice,
  resolveMachineEmpirePick,
  skipMachineEmpireChoice,
} from "../rules/machineEmpire";
import { applyResidentOpOnPlace } from "../rules/residentOps";
import { applySelfRushFromZone, battleActBlocked, markUnitBattleAction } from "../rules/keywordGapRuntime";
import { applyStartPhaseBeginEffects } from "../rules/startPhaseBegin";
import { emitStrikeDeclared } from "../events/emitStrikeDeclared";
import { emitTurnEndingAndResolve } from "../events/emitTurnEnding";
import { emitUnitEnteredBattleEffects } from "../events/emitUnitEnteredBattle";
import {
  drainEffectRushTriggers,
  emitUnitRushedAndFinalize,
  registerAutoBattleEntryOnRush,
} from "../events/emitUnitRushed";
import { continuePendingEffectRush } from "../rules/effectRush";
import { applySuperRadarOnRush } from "../rules/legend3/rushEffects";
import { tryRsCatchallOnEnemyRush } from "../rules/rs/rsCatchallRuntime";
import { MOBIL_MISSILE_EFFECT_ID, openMobilMissileChoice, selectMobilMissileCommand } from "../rules/mobilMissile";
import { RUSH_PHASE_RULE_IDS } from "../types/scopedModifiers";
import { attackerBlocksDefenderCounters, canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import {
  applyDarkDealRushHolds,
  battleEntryHandDiscardSatisfied,
  battleEntryPowerDiscardSatisfied,
  battleEntryRushDiscardSatisfied,
  canAttackDefender,
  darkDealRushPowerBudget,
  needsBattleEntryRushDiscard,
  needsBattleEntryPowerDiscard,
  tryLegend3BattleToRush,
  tryStartBattleEntryHandDiscard,
  tryStartBattleEntryPowerDiscard,
  tryStartBattleEntryRushDiscard,
} from "../rules/legend3/restrictions";
import { applyGodomSenshoDiscardPay } from "../rules/godomRushPay";
import { prepareMirageBeamForBattle } from "../rules/legend3/mirageBeam";
import {
  hasEndPhaseBlockingPending,
  shouldAutoFinalizeEndPhase,
  tryOpenEndTurnEffectsMenu,
} from "../rules/legend3/endTurnEffects";
import {
  resolveTurnEndingEffectsImpl,
  resolveTurnEndExodusOrder,
  TURN_END_EXODUS_ORDER_EFFECT_ID,
} from "../rules/turnEndingEffects";
import { clearBakiBakiExtraAttack, hasBakiBakiExtraAttackOnly } from "../rules/legend3/destroyEffects";
import {
  canBonusDraw,
  canPayEarthForceUpkeep,
  discardEarthForceForUnpaidUpkeep,
  mustResolveEarthForceUpkeepBeforeStartEnd,
  openEarthForceUpkeepChoiceIfNeeded,
  releaseAllCommands,
  returnAllBattleUnitsToRush,
  continueBattleToRushEffectQueue,
  shouldAutoAdvanceFromStartPhase,
  transitionStartToChargePhase,
} from "../rules/startPhase";
import {
  applyMothershipHolds,
  canUseMothershipForZordRush,
  validateZordAdditionalPayment,
} from "../rules/mothership";
import { getZordDownCondition, isZordUpCost, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import {
  applyMultipleZordDownMaterials,
  applyZordDownMaterial,
  applyZordDownPowerMaterials,
  findZordDownMaterial,
  needsZordDownPayment,
  validateZordDownPayment,
} from "../rules/zordDown";
import {
  applyAllZordFusionMaterials,
  applyZordMaterial,
  findZordMaterial,
  requiresAllFusionPartners,
} from "../rules/zord";
import {
  applyExtendedZordPayment,
  applyHoldExtraCommandPayment,
  applyMultipleFieldZordMaterials,
  applyOpponentDrawCost,
  evaluateStateGate,
  needsHoldExtraCommand,
  needsOpponentDrawCost,
  needsZordExtendedMaterial,
  needsZordStateGate,
} from "../rules/zordExtended";
import {
  canMoveUnitToBattle,
  cannotAttackOrStrikeThisTurn,
  unitCannotInitiateAttack,
  mustEnterBattleBeforePhaseEnd,
  countHeldCommands,
  requiredBattleEntryHolds,
  DIRECT_BATTLE_RUSH_RESTRICTION,
} from "../rules/restrictions";
import {
  applyCommandPaymentResolve,
  buildBattleEntryPayment,
  buildPaymentFromInitiateAction,
  validatePaymentSelection,
} from "../rules/commandPayment";
import {
  advanceZordSetup,
  canBeginZordSetup,
  createZordSetup,
} from "../rules/zordSetup";
import {
  applyFiveTechIntercept,
  applyPlasmaEnergyCounter,
  canPlayPlasmaEnergyCounter,
  finalizeStrike,
  hasStrikeReactions,
} from "../rules/strikeReactions";
import {
  isHidoraEggUsed,
  markBattleBlocked,
  markRushedThisTurn,
  wasRushedThisTurn,
} from "../rules/turnModifiers";
import { applyPassChase, applyResolveChase, listValidChaseVehicleIds } from "../keywords/chase";
import {
  canRiderMountVehicle,
  extractMountedVehicleFromRush,
} from "../keywords/ride";
import {
  beginMorphUnitSelection,
  passMorphReaction,
} from "../keywords/morphReaction";
import { canWingAttackFromRush, applyHoldForWing, applyCancelWingHold, applyNoStrikeAfterRideOff } from "../keywords/battleKeywords";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  attachOperationCardToDslResume,
  dslOperationOpensChoose,
  getDslOperationEffect,
  isDslInterpretableEffect,
  shouldUseDslOperation,
  tryResolveDslLeaveCounter,
  tryResolveDslOperation,
} from "../dsl/cardInterpreter";
import { peekEffectStackTop, withSyncedEffectStack } from "../rules/effectStack";
import { applyRegisterHold, finalizeRegisterDiscard } from "../rules/resist";
import { hasAutoBattleEntryOnRushNote } from "@rangers-strike/cards";
import {
  applyDinoChronicleCounter,
  applyDinoGutsCounter,
  applyHiddenNinjaCounter,
  applyMagLoadCounter,
  applyNewGymnasticsCounter,
  applyMechanicNinjaCounter,
  isMechanicNinjaCounter,
  applySageAelCounter,
  applyShippuNinjaCounter,
  applyMusicBoxClockCounter,
  canUseRushReactionCounter,
  hasRushCounterReactions,
  isShippuNinjaCard,
  applySuperShieldSubstitute,
  canExecuteHandCounter,
  getCounterEffectId,
  hasBattleCounterReactions,
  finalizeLeaveReaction,
  finalizeRushPending,
  tryLeaveField,
} from "../rules/operationCounters";
import { applyLionDance, applyUseJuuKunDo, isLionDanceCard } from "../rules/juuKunDo";
import { applyResolveRuinSurvey } from "../rules/ruinSurvey";
import { applySeabedDrawPlacement, openEffectChoice, SUPER_BRAIN_KEEP_EFFECT_ID } from "../rules/pendingChoices";
import {
  applyConfirmDenjiReveal,
  applyDenjiBottomOrderSelect,
} from "../rules/denjiMachine";
import {
  applyConfirmShironReveal,
  applyShironPickSelect,
  clearShironLightRushTarget,
  startShironLightChoice,
} from "../rules/shironLight";
import { applyActivateResidentOperation } from "../rules/permanentOperation";
import {
  applyEffectChoicePlacement,
  applyEffectChoiceSelect,
  completeEffectHoldChoice,
  skipEffectChoice,
  applyConfirmEffectChoice,
} from "../rules/pendingChoices";
import {
  afterEnterBattle,
  createBattleEntryPrompt,
  finishBattleEntryIf,
  openBattleEntryOrRideOffChoice,
} from "../rules/battleEntry";
import { resolveRidingComboOnRideOff } from "../rules/ridingComboEffects";
import { beginKamenRideDeploy, tryExtendRiderComboOnRush } from "../rules/riderKickEffects";
import {
  activateFieldAbility,
  consumeRideShooterRushRule,
} from "../rules/fieldActivatedAbilities";
import { applyShinobiBallRequiredDefender } from "../rules/batch06FieldEffects";
import { applySuperBrainDraw } from "../effects/drawEffects";

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function ok(state: GameState, message: string): ActionResult {
  const next = withSyncedEffectStack({
    // ルール: R-HOLD-02 — ユニットでなくなったカードのホールドは解除。
    ...clearRegisterHoldOffField(state),
    log: [...state.log, message],
    winner: checkWinner(state),
  });
  return { ok: true, state: next };
}

function clearCounterHoldReady(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  if (!isCostWindowSatisfied(player, "counter_category")) return state;
  return {
    ...state,
    ...updatePlayer(state, playerId, clearCostWindow(player, "counter_category")),
  };
}

function withStartPhaseAutoAdvance(
  result: ActionResult,
  playerId: PlayerId,
): ActionResult {
  if (!result.ok || result.state.phase !== "start") return result;
  if (!shouldAutoAdvanceFromStartPhase(result.state, playerId)) return result;
  const advanced = transitionStartToChargePhase(result.state, playerId);
  if (!advanced) return result;
  return { ok: true, state: advanced };
}

function withEndPhaseAutoFinalize(
  result: ActionResult,
  playerId: PlayerId,
): ActionResult {
  if (!result.ok || !shouldAutoFinalizeEndPhase(result.state)) return result;
  return finishTurnEnd(result.state, playerId);
}

/** {@link finalizeTurnEnd} を実行し、ターンが渡ったときだけ end_turn を記録する。 */
function finishTurnEnd(state: GameState, playerId: PlayerId): ActionResult {
  const next = finalizeTurnEnd(state);
  if (next.phase === "end") return ok(next, buildSimpleLogEntry(playerId, "turn_ending_effects"));
  return ok(next, buildSimpleLogEntry(playerId, "end_turn"));
}

/** スタートフェイズの「戻す」が途中（誘発効果の選択で中断中）か。 */
function hasStartReturnInProgress(state: GameState): boolean {
  return (
    (state.pendingBattleToRushQueue?.length ?? 0) > 0 ||
    (state.pendingStartReturnQueue?.length ?? 0) > 0
  );
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * アタック宣言後の処理（「アタックするとき」のホールド数選択の後）: カウンター窓を開くか、そのままバトルする。
 */
function continueAttackAfterDeclaration(
  battleState: GameState,
  pending: PendingBattle,
  wingAttackFromRush: boolean,
): ActionResult {
  const playerId = pending.attackerPlayerId;
  const enemyId = pending.defenderPlayerId;
  // RS-215【不滅のマシン帝国】: メカの自軍ユニットがアタックされたとき、手札2枚を捨札にしてバトルを行わなくてもよい。
  const machineEmpire = openMachineEmpireChoice(battleState, pending, wingAttackFromRush);
  if (machineEmpire) {
    let pendingState = machineEmpire;
    if (battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId) {
      pendingState = { ...pendingState, pendingBattleEntry: undefined };
    }
    return ok(pendingState, buildSimpleLogEntry(playerId, "machine_empire_choice"));
  }
  if (
    !pending.battleCancelled &&
    hasBattleCounterReactions(
      battleState,
      enemyId,
      pending.defenderInstanceId,
      playerId,
      pending.attackerInstanceId,
    )
  ) {
    let pendingState: GameState = {
      ...battleState,
      pendingBattle: pending,
      activePlayer: enemyId,
    };
    if (battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId) {
      pendingState = { ...pendingState, pendingBattleEntry: undefined };
    }
    return ok(pendingState, buildSimpleLogEntry(playerId, "battle_pending"));
  }

  const resolved = emitBattleDeclaredAndResolve(battleState, pending);
  let finalState = resolved.state;
  if (wingAttackFromRush) {
    let wingPlayer = finalState.players[playerId];
    const rushIndex = wingPlayer.rush.findIndex(
      (c) => c.instanceId === pending.attackerInstanceId,
    );
    if (rushIndex >= 0) {
      const rush = [...wingPlayer.rush];
      rush[rushIndex] = {
        ...rush[rushIndex]!,
        battleActed: true,
      };
      wingPlayer = markBattleBlocked({ ...wingPlayer, rush }, pending.attackerInstanceId);
      finalState = { ...finalState, ...updatePlayer(finalState, playerId, wingPlayer) };
    }
  }
  return ok(finalState, resolved.log);
}

function markBattleActed(player: PlayerState, instanceId: string): PlayerState {
  const battle = player.battle.map((card) =>
    card.instanceId === instanceId ? { ...card, battleActed: true } : card,
  );
  return { ...player, battle };
}

function withWinner(state: GameState): GameState {
  return { ...state, winner: checkWinner(state) };
}

function advanceFromCharge(state: GameState, chargeLog: string): GameState {
  const logged = { ...state, log: [...state.log, chargeLog] };
  return withWinner(advancePhase(logged));
}

/**
 * エンドフェイズの「ターンを終えるとき」を処理し、終わっていればターンを渡す。
 * ルール: R-END-01 — 効果の処理中はまだ終えるプレイヤーのターン（選択もそのプレイヤーの手番で行う）。
 * 選択待ちで止まったら phase "end" のまま返し、解決後に再度呼ばれて続きから処理する。
 * ルール: R-TURN-04 — 効果をすべて処理してから「このターン」の修正を消し、ターンを1回だけ渡す。
 */
function finalizeTurnEnd(state: GameState): GameState {
  const prevPlayer = state.turnEndProgress?.endingPlayerId ?? state.activePlayer;
  const afterEffects = state.turnEndProgress
    ? resolveTurnEndingEffectsImpl(state, prevPlayer).state
    : emitTurnEndingAndResolve(state, prevPlayer).state;
  if (afterEffects.winner || hasEndPhaseBlockingPending(afterEffects)) {
    return withWinner(afterEffects);
  }

  let next: GameState = {
    ...afterEffects,
    activePlayer: prevPlayer,
    phase: "end",
    turnEndProgress: undefined,
    endPhaseStep: undefined,
  };
  // 「このターン」の修正はターン終了で消える。どちらのプレイヤーのカードかは問わない（page-588 Q1）。
  next = {
    ...next,
    players: {
      player1: clearTurnModifiers(next.players.player1),
      player2: clearTurnModifiers(next.players.player2),
    },
  };
  next = advancePhase(next);

  if (next.phase === "start" && next.activePlayer !== prevPlayer) {
    // ルール: R-START-06, R-TIME-06 — 「スタートフェイズ開始時」「ターン開始時」の効果は
    // 3行程（リリース・戻す・ドロー）より前に発動・解決する。ホールド中のコマンドの有無に依存しない。
    next = applyStartPhaseBeginEffects(next, next.activePlayer);
  }

  return withWinner(next);
}

function finishStrikeResolution(
  state: GameState,
  pending: PendingStrike,
  nextState: GameState,
  extraLogs: string[] = [],
): ActionResult {
  let resolved = withWinner({
    ...nextState,
    pendingStrike: undefined,
    activePlayer: pending.battlePhasePlayer,
  });
  resolved = finishBattleEntryIf(resolved, pending.strikerInstanceId);

  const striker = state.players[pending.strikerPlayerId];
  const strikerFound = findInZone(striker, "battle", pending.strikerInstanceId);
  const strikeLog = buildLogEntry(
    pending.strikerPlayerId,
    "strike",
    strikerFound?.card.cardId ?? "unknown",
    state.definitions,
    pending.damageCancelled ? "0" : String(pending.damage),
  );

  return {
    ok: true,
    state: {
      ...resolved,
      log: [...resolved.log, strikeLog, ...extraLogs],
    },
  };
}

function completeStrike(state: GameState, pending: PendingStrike, extraLogs: string[] = []): ActionResult {
  const nextState = finalizeStrike(state, pending);
  if (nextState.pendingDamagePayment) {
    return ok(nextState, buildSimpleLogEntry(pending.strikerPlayerId, "strike_pending_damage"));
  }
  return finishStrikeResolution(state, pending, nextState, extraLogs);
}

function operationNeedsUpfrontTarget(cardId: string): boolean {
  const dslEffect = getDslOperationEffect(cardId, "rush");
  if (dslEffect && shouldUseDslOperation(cardId, dslEffect) && dslOperationOpensChoose(dslEffect)) {
    return false;
  }
  return needsOperationTarget(cardId);
}

/**
 * 「ラッシュするとき可能ならバトルエリアに置く」（RS-090 レッドレーサー等）の自動進入。
 * ルール: R-BA-04 — 「可能なら」はホールドが必要なら新たにホールドして出る。ホールドするコマンドの
 * 選択肢が無ければ自動でホールドし、複数あれば battle_entry 支払いを開く。出られなければラッシュエリアに置く。
 * ルール: R-ADD-07 — ハリケンレオン等の「ホールドしなければ出られない」制限はラッシュ支払いで
 * 既にホールドしたコマンドでは満たせない。
 */
function applyAutoBattleEntryOnRush(
  initialState: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  let state = initialState;
  const found = findInZone(state.players[playerId], "rush", instanceId);
  if (!found || !hasAutoBattleEntryOnRushNote(found.card.cardId)) return state;
  if (state.pendingCommandPayment || state.pendingEffectChoice || state.pendingRush) return state;
  // 直接バトルエリアにラッシュする効果なので、【ゼニボム】の「新しくラッシュエリアに出たユニット」にあたらない
  // （atwiki/page-308 Q2・page-303 Q1「（2010/10/25修正）」、docs/rules/README.md §1.2 例外2）。
  // 出られずラッシュエリアに置かれたときは目印を付けない（そのユニットはラッシュエリアに出たユニット）。
  const original = state;
  state = {
    ...state,
    ...updatePlayer(
      state,
      playerId,
      addTurnRestrictionModifier(state.players[playerId], instanceId, DIRECT_BATTLE_RUSH_RESTRICTION),
    ),
  };
  const direct = applyAction(state, { type: "move_to_battle", playerId, instanceId });
  if (direct.ok) return direct.state;
  const payment = buildBattleEntryPayment(state, playerId, found.card);
  if (!payment) return original;
  if (payment.validInstanceIds.length <= payment.totalNeeded) {
    const paid = applyAction(
      { ...state, pendingCommandPayment: payment },
      {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: payment.validInstanceIds.slice(0, payment.totalNeeded),
      },
    );
    return paid.ok ? paid.state : original;
  }
  return { ...state, pendingCommandPayment: payment };
}

registerAutoBattleEntryOnRush(applyAutoBattleEntryOnRush);

function fieldInstanceIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const pid of ["player1", "player2"] as const) {
    for (const card of state.players[pid].rush) ids.add(card.instanceId);
    for (const card of state.players[pid].battle) ids.add(card.instanceId);
  }
  return ids;
}

function turnPlayerOf(state: GameState): PlayerId {
  return (
    state.pendingRush?.phasePlayerId ??
    state.pendingEffectChoice?.phasePlayerId ??
    state.pendingLeave?.phasePlayerId ??
    state.pendingMorph?.phasePlayerId ??
    state.activePlayer
  );
}

/**
 * アクション後処理: 効果でエリアに出たユニットのラッシュ扱いと「ラッシュしたとき」誘発・
 * 「ラッシュされたとき」窓、1体ずつ出す効果ラッシュの続行。
 * ルール: R-RUSH-01 / R-RUSH-02 — エリア外からエリアに出たユニットはすべて「ラッシュされた」扱い。
 * カード個別処理が直接ラッシュエリアに置いた場合もここで拾う（finalizeEffectRush 未接続の経路の受け皿）。
 * 既にラッシュ記録の付いたユニット（通常ラッシュ・finalizeEffectRush 経由・モーフ置換）は対象外。
 */
function settleEffectRushes(before: GameState, after: GameState): GameState {
  if (after.winner) return after;
  const handled = new Set(after.fieldEntryHandledIds ?? []);
  if (after.fieldEntryHandledIds) {
    after = { ...after, fieldEntryHandledIds: undefined };
  }
  const beforeIds = fieldInstanceIds(before);
  let next = after;
  const turnPlayer = turnPlayerOf(after);
  const triggers: NonNullable<GameState["effectRushTriggerQueue"]> = [];
  const directBattleEntries: Array<{ pid: PlayerId; instanceId: string }> = [];
  for (const pid of ["player1", "player2"] as const) {
    let owner = next.players[pid];
    let changed = false;
    for (const zone of ["rush", "battle"] as const) {
      for (const card of owner[zone]) {
        if (beforeIds.has(card.instanceId) || handled.has(card.instanceId)) continue;
        if (wasRushedThisTurn(owner, card.instanceId)) continue;
        owner = markRushedThisTurn(owner, card.instanceId);
        changed = true;
        if (zone === "rush") {
          triggers.push({ rusherPlayerId: pid, instanceId: card.instanceId, phasePlayerId: turnPlayer });
        } else {
          directBattleEntries.push({ pid, instanceId: card.instanceId });
        }
      }
    }
    if (changed) next = { ...next, ...updatePlayer(next, pid, owner) };
  }
  // faq-card-3 RS-124 Q1/Q3 — ラッシュエリアを経ずに直接バトルエリアに出た S ユニットにも
  // 超電子レーダー（「Sユニットをラッシュしたとき」）を適用する。
  for (const entry of directBattleEntries) {
    const radar = applySuperRadarOnRush(next, entry.pid, entry.instanceId, turnPlayer);
    if (radar.state !== next) {
      next = { ...radar.state, log: [...radar.state.log, ...radar.logs] };
    }
    // 「敵軍ユニットが新しくラッシュされたとき」（RS-279 グリーンサイ【サイカッター】）も、直接バトルエリアに
    // 出されたユニット（RS-194 ダイナロボ【ビートハンマー】等）に発動する（grnrngr/faq-card-5）。
    const enemyRush = tryRsCatchallOnEnemyRush(next, entry.pid, entry.instanceId, turnPlayer);
    if (enemyRush.state !== next) {
      next = { ...enemyRush.state, log: [...enemyRush.state.log, ...enemyRush.logs] };
    }
  }
  if (triggers.length > 0) {
    next = {
      ...next,
      effectRushTriggerQueue: [...(next.effectRushTriggerQueue ?? []), ...triggers],
    };
  }
  if (!next.effectRushTriggerQueue?.length && !next.pendingEffectRush) return next;

  const logs: string[] = [];
  for (let guard = 0; guard < 8; guard += 1) {
    const drained = drainEffectRushTriggers(next);
    next = drained.state;
    logs.push(...drained.logs);
    if (next.effectRushTriggerQueue?.length) break;
    const continued = continuePendingEffectRush(next);
    if (continued === next) break;
    next = continued;
  }
  if (next === after) return after;
  return withSyncedEffectStack({
    ...next,
    log: logs.length > 0 ? [...next.log, ...logs] : next.log,
    winner: checkWinner(next),
  });
}

export function applyAction(
  state: GameState,
  action: GameAction,
  options?: { trustLegality?: boolean },
): ActionResult {
  const result = applyActionCore(state, action, options);
  if (!result.ok) return result;
  // ルール: R-ZONE-04, R-HOLD-02 — エリアを離れたカードの付加情報はどの経路で移動しても消える。
  let next = clearRegisterHoldOffField(result.state);
  next = settleEffectRushes(state, next);
  next = releaseCounterLockWhenAttackSettled(next);
  next = trackResolvingOperations(state, next);
  next = settleResolvingOperations(next);
  next = applyBpZeroRuleDestruction(next);
  next = syncDamageWithFaceDownPower(state, next);
  next = markEnemyTurnFaceDownDamage(state, next);
  return next === result.state ? result : { ok: true, state: next };
}

/**
 * damage_gate_battle_entry（RS-289 ドラゴンレンジャー等）: 敵軍ターン中にダメージ（ウラ向きのパワー）が増えたら、
 * ストライク以外（「ダメージにして置く」効果）でも「ダメージを受けた」と記録する（faq-card-5 RS-289 Q1）。
 */
function markEnemyTurnFaceDownDamage(before: GameState, after: GameState): GameState {
  if (before.turn !== after.turn) return after;
  const turnPlayer = turnPlayerOf(before);
  let players = after.players;
  for (const pid of ["player1", "player2"] as const) {
    if (pid === turnPlayer || after.players[pid].damagedOnEnemyTurn) continue;
    const fdBefore = before.players[pid].power.filter((c) => c.faceDown).length;
    const fdAfter = after.players[pid].power.filter((c) => c.faceDown).length;
    if (fdAfter > fdBefore) {
      players = { ...players, [pid]: { ...players[pid], damagedOnEnemyTurn: true } };
    }
  }
  return players === after.players ? after : { ...after, players };
}

/** RS-107【ディースナイパー】: カウンターのためにホールドしたコマンドを捨札にする。 */
function discardCounterHolds(
  state: GameState,
  playerId: PlayerId,
  commandInstanceIds: string[],
): GameState {
  const ids = new Set(commandInstanceIds);
  const player = state.players[playerId];
  const moved = player.command.filter((c) => ids.has(c.instanceId));
  if (moved.length === 0) return state;
  const discarded = moved.map((c) => {
    const { commandHeld: _h, mothershipHold: _m, paymentHeld: _p, ...rest } = c;
    return rest;
  });
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        command: player.command.filter((c) => !ids.has(c.instanceId)),
        discard: [...player.discard, ...discarded],
      },
    },
  };
}

/**
 * ルール: R-DMG-01 — ダメージはパワーゾーンのウラ向き枚数。効果でダメージをオモテにした（回復した）ときは
 * 独立カウンタも同じだけ減らす。
 */
function syncDamageWithFaceDownPower(before: GameState, after: GameState): GameState {
  let players = after.players;
  for (const pid of ["player1", "player2"] as const) {
    const fdBefore = before.players[pid].power.filter((c) => c.faceDown).length;
    const fdAfter = after.players[pid].power.filter((c) => c.faceDown).length;
    const deltaFaceDown = fdAfter - fdBefore;
    const deltaDamage = after.players[pid].damage - before.players[pid].damage;
    if (deltaFaceDown < 0 && deltaDamage === 0) {
      players = {
        ...players,
        [pid]: { ...players[pid], damage: Math.max(0, after.players[pid].damage + deltaFaceDown) },
      };
    }
  }
  return players === after.players ? after : { ...after, players };
}

function hasBlockingInteraction(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry
  );
}

/**
 * ルール: R-BP-02 — 効果で BP が0以下になったユニットはルールにより撃破される。
 * 進行中の処理（バトル・効果の選択・離場反応など）が終わってから適用する（faq-rider-1 RK-046 Q5）。
 */
function applyBpZeroRuleDestruction(state: GameState): GameState {
  let next = state;
  for (let guard = 0; guard < 20; guard += 1) {
    if (next.winner || hasBlockingInteraction(next)) return next;
    const turnPlayer = next.activePlayer;
    const order: PlayerId[] = [turnPlayer, opponent(turnPlayer)];
    let victim: { ownerId: PlayerId; card: CardInstance; zone: "rush" | "battle" } | undefined;
    for (const ownerId of order) {
      for (const zone of ["battle", "rush"] as const) {
        const card = next.players[ownerId][zone].find((c) => {
          const def = next.definitions[c.cardId];
          if (!def || def.type !== "unit" || typeof def.bp !== "number" || def.bp <= 0) return false;
          return effectiveBp(next, ownerId, c) <= 0;
        });
        if (card) {
          victim = { ownerId, card, zone };
          break;
        }
      }
      if (victim) break;
    }
    if (!victim) return next;
    const left = tryLeaveField(next, {
      ownerPlayerId: victim.ownerId,
      instanceId: victim.card.instanceId,
      fromZone: victim.zone,
      toZone: "discard",
      leavingCardId: victim.card.cardId,
      phasePlayerId: turnPlayer,
    });
    const logged: GameState = {
      ...left.state,
      log: [
        ...left.state.log,
        buildLogEntry(victim.ownerId, "rule_destroy", victim.card.cardId, next.definitions, "bp0"),
      ],
    };
    if (left.deferred) return logged;
    next = finishBattleEntryIf(logged, victim.card.instanceId);
  }
  return next;
}

/** ルール: R-CTR-03 — アタックの処理が終われば（次の宣言のタイミング）カウンター封じは解ける。 */
function releaseCounterLockWhenAttackSettled(state: GameState): GameState {
  if (!state.counterLockedPlayerId) return state;
  if (
    state.pendingBattle ||
    state.pendingLeave ||
    state.pendingStrike ||
    state.pendingEffectChoice ||
    state.pendingDamagePayment ||
    state.pendingCommandPayment
  ) {
    return state;
  }
  return { ...state, counterLockedPlayerId: undefined };
}

function applyActionCore(
  state: GameState,
  action: GameAction,
  options?: { trustLegality?: boolean },
): ActionResult {
  if (state.winner) return fail("game_already_over");
  if (
    action.type === "end_phase" &&
    state.phase === "battle" &&
    mustEnterBattleBeforePhaseEnd(state, action.playerId)
  ) {
    return fail("must_enter_battle");
  }
  if (action.type === "end_phase" && state.pendingBattleEntry) {
    return fail("pending_battle_entry");
  }
  if (action.type === "move_to_battle" && state.pendingBattleEntry) {
    return fail("pending_battle_entry");
  }
  if (
    state.pendingRideOffChoice &&
    action.type !== "resolve_ride_off_choice" &&
    !(
      action.type === "resolve_damage_payment" &&
      state.pendingDamagePayment &&
      peekEffectStackTop(state)?.kind === "damage_payment"
    )
  ) {
    return fail("pending_ride_off_choice");
  }
  if (
    state.pendingCommandPayment &&
    action.type !== "resolve_command_payment" &&
    action.type !== "cancel_command_payment"
  ) {
    return fail("pending_command_payment");
  }
  if (
    state.pendingZordSetup &&
    action.type !== "resolve_zord_setup" &&
    action.type !== "cancel_zord_setup"
  ) {
    return fail("pending_zord_setup");
  }
  if (
    state.pendingDamagePayment &&
    peekEffectStackTop(state)?.kind === "damage_payment" &&
    action.type !== "resolve_damage_payment"
  ) {
    return fail("pending_damage_payment");
  }
  if (!options?.trustLegality && !isLegalAction(state, action)) return fail("illegal_action");

  const playerId = action.playerId;
  const player = state.players[playerId];

  switch (action.type) {
    case "draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (player.hasDrawnThisStart) return fail("already_drawn");
      if (player.deck.length === 0) {
        const nextState: GameState = {
          ...state,
          winner: opponent(playerId),
          log: [...state.log, buildSimpleLogEntry(playerId, "deck_out")],
        };
        return { ok: true, state: nextState };
      }
      const drawn = applySuperBrainDraw(state, playerId, player, playerId);
      if (drawn.detail === "empty_deck") {
        const nextState: GameState = {
          ...state,
          winner: opponent(playerId),
          log: [...state.log, buildSimpleLogEntry(playerId, "deck_out")],
        };
        return { ok: true, state: nextState };
      }
      if (drawn.pending) {
        const nextPlayer = { ...drawn.state.players[playerId], hasDrawnThisStart: true };
        const nextState: GameState = {
          ...drawn.state,
          ...updatePlayer(drawn.state, playerId, nextPlayer),
        };
        return ok(nextState, buildSimpleLogEntry(playerId, "draw"));
      }
      const nextPlayer = {
        ...drawn.state.players[playerId],
        hasDrawnThisStart: true,
      };
      const nextState: GameState = {
        ...drawn.state,
        ...updatePlayer(drawn.state, playerId, nextPlayer),
      };
      const withUpkeep = openEarthForceUpkeepChoiceIfNeeded(nextState, playerId);
      return withStartPhaseAutoAdvance(
        ok(withUpkeep, buildSimpleLogEntry(playerId, "draw")),
        playerId,
      );
    }

    case "bonus_draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (!player.hasDrawnThisStart) return fail("must_draw_first");
      if (!canBonusDraw(state, playerId)) return fail("bonus_draw_unavailable");
      const drawn = applySuperBrainDraw(state, playerId, player, playerId);
      if (drawn.detail === "empty_deck") {
        return fail("bonus_draw_unavailable");
      }
      const afterBonus: GameState = {
        ...drawn.state,
        ...updatePlayer(drawn.state, playerId, {
          ...drawn.state.players[playerId],
          hasBonusDrawnThisStart: true,
        }),
      };
      if (drawn.pending) {
        return ok(afterBonus, buildSimpleLogEntry(playerId, "bonus_draw"));
      }
      return withStartPhaseAutoAdvance(
        ok(afterBonus, buildSimpleLogEntry(playerId, "bonus_draw")),
        playerId,
      );
    }

    case "skip_bonus_draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (!canBonusDraw(state, playerId)) return fail("bonus_draw_unavailable");
      const advanced = transitionStartToChargePhase(state, playerId);
      if (!advanced) return fail("start_phase_incomplete");
      return ok(advanced, buildSimpleLogEntry(playerId, "skip_bonus_draw"));
    }

    case "release_start_commands": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (player.hasReleasedCommandsThisStart) return fail("already_released");
      if (!player.command.some((c) => c.commandHeld)) {
        return fail("no_held_commands");
      }
      const nextState = releaseAllCommands(state, playerId);
      const nextPlayer = {
        ...nextState.players[playerId],
        hasReleasedCommandsThisStart: true,
      };
      return withStartPhaseAutoAdvance(
        ok(
          { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) },
          buildSimpleLogEntry(playerId, "release_start_commands"),
        ),
        playerId,
      );
    }

    case "return_all_battle_to_rush": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (player.hasReturnedBattleThisStart) return fail("already_returned");
      const moved = returnAllBattleUnitsToRush(state, playerId, action.instanceId);
      if (!moved) return fail("card_not_in_battle");
      return withStartPhaseAutoAdvance(
        ok(moved, buildSimpleLogEntry(playerId, "return_all_battle_to_rush")),
        playerId,
      );
    }

    case "charge_power": {
      if (state.phase !== "charge") return fail("wrong_phase");
      if (player.hasChargedThisTurn) return fail("already_charged");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const [, hand] = removeAt(player.hand, found.index);
      const powerCard: typeof found.card = { ...found.card, faceDown: false };
      const nextPlayer: typeof player = {
        ...player,
        hand,
        power: [...player.power, powerCard],
        hasChargedThisTurn: true,
      };
      const chargedState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
      return {
        ok: true,
        state: advanceFromCharge(
          chargedState,
          buildLogEntry(playerId, "charge_power", found.card.cardId, state.definitions),
        ),
      };
    }

    case "charge_command": {
      if (state.phase !== "charge") return fail("wrong_phase");
      if (player.hasChargedThisTurn) return fail("already_charged");
      if (player.command.length >= COMMAND_ZONE_MAX) return fail("command_zone_full");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const [, hand] = removeAt(player.hand, found.index);
      const commandCard: typeof found.card = {
        ...found.card,
        commandHeld: false,
      };
      const nextPlayer: typeof player = {
        ...player,
        hand,
        command: [...player.command, commandCard],
        hasChargedThisTurn: true,
      };
      const chargedState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
      return {
        ok: true,
        state: advanceFromCharge(
          chargedState,
          buildLogEntry(playerId, "charge_command", found.card.cardId, state.definitions),
        ),
      };
    }

    case "initiate_command_payment": {
      const pending = buildPaymentFromInitiateAction(state, action);
      if (!pending) return fail("cannot_pay");
      return ok(
        { ...state, pendingCommandPayment: pending },
        buildSimpleLogEntry(playerId, "command_payment_pending"),
      );
    }

    case "begin_zord_setup": {
      if (state.phase !== "rush") return fail("wrong_phase");
      if (!canBeginZordSetup(state, playerId, action.zordInstanceId)) {
        return fail("cannot_begin_zord_setup");
      }
      const setup = createZordSetup(state, playerId, action.zordInstanceId);
      if (!setup) return fail("cannot_begin_zord_setup");
      return ok(
        { ...state, pendingZordSetup: setup },
        buildSimpleLogEntry(playerId, "zord_setup_pending"),
      );
    }

    case "resolve_zord_setup": {
      const setup = state.pendingZordSetup;
      if (!setup || setup.playerId !== playerId) return fail("no_pending_zord_setup");
      const advanced = advanceZordSetup(state, setup, {
        materialInstanceId: action.materialInstanceId,
        destination: action.destination,
        paymentPath: action.paymentPath,
      });
      if (advanced.kind === "error") return fail(advanced.error);
      if (advanced.kind === "continue") {
        return ok(
          { ...state, pendingZordSetup: advanced.setup },
          buildSimpleLogEntry(playerId, "zord_setup_step"),
        );
      }
      if (advanced.kind === "rush") {
        return applyAction(
          { ...state, pendingZordSetup: undefined },
          advanced.action,
        );
      }
      return ok(
        {
          ...state,
          pendingZordSetup: undefined,
          pendingCommandPayment: advanced.payment,
        },
        buildSimpleLogEntry(playerId, "command_payment_pending"),
      );
    }

    case "cancel_zord_setup": {
      if (!state.pendingZordSetup) return fail("no_pending_zord_setup");
      if (state.pendingZordSetup.playerId !== playerId) {
        return fail("no_pending_zord_setup");
      }
      return ok(
        { ...state, pendingZordSetup: undefined },
        buildSimpleLogEntry(playerId, "zord_setup_cancel"),
      );
    }

    case "resolve_damage_payment": {
      const result = resolveDamagePaymentSelect(state, playerId, action.instanceId);
      if ("error" in result) return fail(result.error);
      if (result.state.pendingDamagePayment) {
        return ok(
          result.state,
          buildSimpleLogEntry(playerId, "damage_payment", action.instanceId),
        );
      }
      const finished =
        result.resume.kind === "strike"
          ? finishStrikeResolution(
              state,
              { ...result.resume.pending, damageApplied: true },
              result.state,
            )
          : ok(result.state, buildSimpleLogEntry(playerId, "damage_payment", "done"));
      // 同時に発生して後回しにしたダメージがあれば続けて処理する。
      if (finished.ok && (finished.state.queuedDamagePayments?.length ?? 0) > 0 && !finished.state.pendingDamagePayment) {
        const nextDamage = startNextQueuedDamage({ ...finished.state, winner: null });
        return { ok: true, state: { ...nextDamage, winner: checkWinner(nextDamage) } };
      }
      return finished;
    }

    case "resolve_command_payment": {
      const pending = state.pendingCommandPayment;
      if (!pending || pending.playerId !== playerId) return fail("no_pending_payment");
      const err = validatePaymentSelection(state, pending, action.commandInstanceIds);
      if (err) return fail(err);

      const resolved = applyCommandPaymentResolve(
        state,
        playerId,
        pending,
        action.commandInstanceIds,
      );
      if ("error" in resolved) return fail(resolved.error);

      let nextState = resolved.state;
      if (resolved.nextPending) {
        return ok(
          { ...nextState, pendingCommandPayment: resolved.nextPending },
          buildSimpleLogEntry(playerId, "command_payment_pending"),
        );
      }

      const cont = pending.continuation;

      if (cont.type === "effect_choice") {
        const completed = completeEffectHoldChoice(
          nextState,
          playerId,
          action.commandInstanceIds,
        );
        if ("error" in completed) return fail(completed.error);
        return ok(completed.state, completed.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
      }

      if (cont.type === "move_to_battle") {
        return applyAction(nextState, {
          type: "move_to_battle",
          playerId,
          instanceId: pending.sourceInstanceId,
          rideOff: cont.rideOff,
        });
      }
      if (cont.type === "rush") {
        const holdIds =
          pending.kind === "mothership_hold"
            ? action.commandInstanceIds
            : cont.zordMothershipHoldInstanceIds;
        return applyAction(
          nextState,
          {
            type: "rush",
            playerId,
            instanceId: pending.sourceInstanceId,
            zordMaterialInstanceId: cont.zordMaterialInstanceId,
            zordMaterialInstanceIds: cont.zordMaterialInstanceIds,
            zordMaterialDestination: cont.zordMaterialDestination,
            zordMaterialDestinations: cont.zordMaterialDestinations,
            zordMothershipHoldInstanceIds: holdIds,
            zordExtraCommandHoldInstanceIds: cont.zordExtraCommandHoldInstanceIds,
          },
          { trustLegality: true },
        );
      }
      if (cont.type === "play_counter") {
        const countered = applyAction(
          nextState,
          {
            type: "play_counter",
            playerId,
            instanceId: pending.sourceInstanceId,
            substituteInstanceId: cont.substituteInstanceId,
          },
          { trustLegality: true },
        );
        // ルール: R-RES-03 — 【ディースナイパー】は発動元が場を離れても有効。
        // このターン、カウンターを発動するためにホールドしたコマンドは捨札になる。
        if (
          countered.ok &&
          hasTurnRuleModifier(nextState.players[playerId], TURN_RULE_IDS.DEACE_SNIPER)
        ) {
          return { ok: true, state: discardCounterHolds(countered.state, playerId, action.commandInstanceIds) };
        }
        return countered;
      }
      return applyAction(
        nextState,
        {
          type: "play_operation",
          playerId,
          instanceId: pending.sourceInstanceId,
          targetInstanceId: cont.targetInstanceId,
          extraInstanceId: cont.extraInstanceId,
        },
        { trustLegality: true },
      );
    }

    case "cancel_command_payment": {
      if (!state.pendingCommandPayment) return fail("no_pending_payment");
      if (state.pendingCommandPayment.playerId !== playerId) {
        return fail("no_pending_payment");
      }
      const payer = state.players[playerId];
      let cancelled: GameState = {
        ...state,
        pendingCommandPayment: undefined,
        players: {
          ...state.players,
          [playerId]: clearAllCostWindows(payer),
        },
      };
      // effect_hold のキャンセル = 任意効果の辞退（そうしないと UI が支払いを
      // 自動再初期化し続け、キャストオフ等の任意効果を断れなくなる）
      if (
        state.pendingCommandPayment.kind === "effect_hold" &&
        cancelled.pendingEffectChoice?.playerId === playerId &&
        cancelled.pendingEffectChoice.optional
      ) {
        const skipped = skipEffectChoice(cancelled, playerId);
        if (!("error" in skipped)) cancelled = skipped.state;
      }
      return ok(
        cancelled,
        buildSimpleLogEntry(playerId, "command_payment_cancel"),
      );
    }

    case "play_operation": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const definition = getDefinition(state.definitions, found.card.cardId);
      if (!definition || definition.type !== "operation") return fail("not_operation");

      // ルール: R-CARD-03, R-RES-04 — 適正な対象がなければ空撃ち（効果を発動せず捨札）。
      const fizzle =
        !action.targetInstanceId &&
        !action.extraInstanceId &&
        !isPermanentCard(state.definitions, found.card.cardId) &&
        operationFizzles(state, playerId, found.card.instanceId, found.card.cardId);

      if (!fizzle && operationNeedsUpfrontTarget(found.card.cardId) && !action.targetInstanceId) {
        return fail("target_required");
      }

      if (
        !fizzle &&
        getCardEffect(found.card.cardId)?.effectId === "cyber_s_rider" &&
        !action.targetInstanceId
      ) {
        return fail("target_required");
      }

      if (!canPlayOperation(state, playerId, definition)) {
        return fail("command_not_held");
      }

      const cost = parsePowerCost(definition.powerCost);
      if (!payPowerCost(state, playerId, cost)) return fail("insufficient_power");

      const [, hand] = removeAt(player.hand, found.index);
      let nextPlayer = clearCostWindow({ ...player, hand }, "operation_category");
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      if (fizzle) {
        const current = nextState.players[playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...current,
            discard: [...current.discard, found.card],
          }),
        };
        return ok(
          nextState,
          buildLogEntry(playerId, "play_operation", found.card.cardId, state.definitions, "fizzle"),
        );
      }

      const effectMeta = getCardEffect(found.card.cardId);
      const dslEffect = getDslOperationEffect(found.card.cardId, "rush");
      const useDsl = shouldUseDslOperation(found.card.cardId, dslEffect);

      if (!useDsl && effectMeta?.effectId === "place_in_power") {
        const current = nextState.players[playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...current,
            power: [...current.power, { ...found.card, faceDown: false }],
          }),
        };
        return ok(
          nextState,
          buildLogEntry(
            playerId,
            "play_operation",
            found.card.cardId,
            state.definitions,
            "place_in_power",
          ),
        );
      }

      const isPermanent = isPermanentCard(state.definitions, found.card.cardId);
      if (isPermanent) {
        nextState = placePermanentOperation(nextState, playerId, found.card);
        nextState = applyResidentOpOnPlace(
          nextState,
          playerId,
          found.card.instanceId,
          found.card.cardId,
        );
      }

      let outcomeDetail: string | undefined;
      if (useDsl) {
        let dslOutcome = tryResolveDslOperation({
          state: nextState,
          playerId,
          operationCard: found.card,
          targetInstanceId: action.targetInstanceId,
          extraInstanceId: action.extraInstanceId,
        });
        if (!dslOutcome) {
          return fail("dsl_unavailable");
        }
        if (dslOutcome.state.pendingEffectChoice?.dslResume) {
          dslOutcome = {
            ...dslOutcome,
            state: attachOperationCardToDslResume(dslOutcome.state, found.card),
          };
        }
        nextState = dslOutcome.state;
        outcomeDetail = dslOutcome.detail;
        if (
          (dslOutcome.discardOperation !== false || !!nextState.pendingEffectChoice?.kurokoMeta) &&
          !isPermanent &&
          (!nextState.pendingEffectChoice || !!nextState.pendingEffectChoice.kurokoMeta)
        ) {
          const current = nextState.players[playerId];
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, playerId, {
              ...current,
              discard: [...current.discard, found.card],
            }),
          };
        }
      } else {
        const outcome = resolveOperationEffect({
          state: nextState,
          playerId,
          operationCardId: found.card.cardId,
          targetInstanceId: action.targetInstanceId,
          extraInstanceIds: [
            ...(action.targetInstanceId ? [action.targetInstanceId] : []),
            ...(action.extraInstanceId ? [action.extraInstanceId] : []),
          ],
        });

        nextState = outcome.state;
        outcomeDetail = outcome.detail;

        // 超電子頭脳の「どちらを残すか」選択はドローの一部なので、使ったオペレーションはそのまま捨札にする。
        const superBrainKeepPending =
          nextState.pendingEffectChoice?.effectId === SUPER_BRAIN_KEEP_EFFECT_ID;
        if (
          (outcome.discardOperation !== false || superBrainKeepPending) &&
          !isPermanent &&
          // 効果ラッシュ（RS-005 等）の「出すカードを選ぶ」選択中も、オペレーション自体の解決は終わっている。
          (!nextState.pendingEffectChoice || !!nextState.pendingEffectRush || superBrainKeepPending)
        ) {
          const current = nextState.players[playerId];
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, playerId, {
              ...current,
              discard: [...current.discard, found.card],
            }),
          };
        } else if (outcome.discardOperation === true && isPermanent) {
          const current = nextState.players[playerId];
          const operation = current.operation.filter(
            (c) => c.instanceId !== found.card.instanceId,
          );
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, playerId, {
              ...current,
              operation,
              discard: [...current.discard, found.card],
            }),
          };
        }
      }

      return ok(
        nextState,
        buildLogEntry(
          playerId,
          "play_operation",
          found.card.cardId,
          state.definitions,
          outcomeDetail,
        ),
      );
    }

    case "rush": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const definition = getDefinition(state.definitions, found.card.cardId);
      if (!isRushable(definition)) return fail("not_a_unit");

      const zordMaterialIds =
        action.zordMaterialInstanceIds ??
        (action.zordMaterialInstanceId ? [action.zordMaterialInstanceId] : []);
      const cost = rushPowerCost(state, playerId, definition!, {
        zordMaterialInstanceId: action.zordMaterialInstanceId,
        zordMaterialInstanceIds: action.zordMaterialInstanceIds,
      });
      let nextPlayer = player;

      if (
        needsZordDownPayment(found.card.cardId, definition!.powerCost, definition!) &&
        zordMaterialIds.length > 0
      ) {
        if (
          !validateZordDownPayment(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
            action.zordMaterialInstanceId,
            action.zordMaterialDestination,
            action.zordMaterialInstanceIds ?? zordMaterialIds,
          )
        ) {
          return fail("invalid_zord_material");
        }
        const downCondition = getZordDownCondition(
          found.card.cardId,
          definition!,
        );
        let afterZordDown: PlayerState | null = null;
        if (downCondition?.conditionId === "zord_down_discard_power_cards") {
          afterZordDown = applyZordDownPowerMaterials(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            zordMaterialIds,
          );
        } else if (zordMaterialIds.length === 1) {
          afterZordDown = applyZordDownMaterial(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
            zordMaterialIds[0]!,
            action.zordMaterialDestination,
          );
        } else {
          afterZordDown = applyMultipleZordDownMaterials(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
            zordMaterialIds,
            action.zordMaterialDestination,
          );
        }
        if (!afterZordDown) return fail("invalid_zord_material");
        nextPlayer = afterZordDown;
      } else if (
        isZordUpCost(definition!.powerCost) &&
        rushAdditionalConditionApplies(state, playerId, found.card.cardId)
      ) {
        if (needsZordStateGate(state.definitions, found.card.cardId)) {
          const gate = resolveRushAdditionalCondition(found.card.cardId, definition!);
          if (!gate || !evaluateStateGate(state, playerId, gate)) {
            return fail("zord_state_gate_unmet");
          }
        } else if (requiresAllFusionPartners(found.card.cardId)) {
          const afterZord = applyAllZordFusionMaterials(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
          );
          if (!afterZord) return fail("zord_material_required");
          nextPlayer = afterZord;
        } else if (needsZordExtendedMaterial(state.definitions, found.card.cardId)) {
          const extendedIds =
            action.zordMaterialInstanceIds ??
            (action.zordMaterialInstanceId ? [action.zordMaterialInstanceId] : []);
          if (extendedIds.length === 0) return fail("zord_material_required");
          const afterExtended = applyExtendedZordPayment(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
            extendedIds,
          );
          if (!afterExtended) return fail("invalid_zord_material");
          nextPlayer = afterExtended;
        } else if (needsHoldExtraCommand(state.definitions, found.card.cardId)) {
          const holdIds = action.zordExtraCommandHoldInstanceIds ?? [];
          const afterHold = applyHoldExtraCommandPayment(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            holdIds,
          );
          if (!afterHold) return fail("invalid_zord_material");
          nextPlayer = afterHold;
        } else if (needsOpponentDrawCost(state.definitions, found.card.cardId)) {
          // 相手ドローのみ。支払い不要。
        } else if (needsZordMaterial(state.definitions, found.card.cardId)) {
          const mothershipHolds = action.zordMothershipHoldInstanceIds ?? [];
          const fieldIds =
            action.zordMaterialInstanceIds ??
            (action.zordMaterialInstanceId ? [action.zordMaterialInstanceId] : []);
          const hasMaterial = fieldIds.length > 0;
          if (!hasMaterial && mothershipHolds.length === 0) {
            return fail("zord_material_required");
          }
          if (
            !validateZordAdditionalPayment(
              nextPlayer,
              state.definitions,
              found.card.cardId,
              found.card.instanceId,
              fieldIds[0],
              action.zordMaterialDestination,
              mothershipHolds,
              fieldIds.length > 0 ? fieldIds : undefined,
            )
          ) {
            return fail("invalid_zord_material");
          }

          if (hasMaterial) {
            let afterZord: PlayerState | null = null;
            if (fieldIds.length === 1) {
              afterZord = applyZordMaterial(
                nextPlayer,
                state.definitions,
                found.card.cardId,
                found.card.instanceId,
                fieldIds[0]!,
                action.zordMaterialDestination,
              );
            } else {
              afterZord = applyMultipleFieldZordMaterials(
                nextPlayer,
                state.definitions,
                found.card.cardId,
                found.card.instanceId,
                fieldIds,
                action.zordMaterialDestinations?.length === fieldIds.length
                  ? action.zordMaterialDestinations
                  : action.zordMaterialDestination,
              );
            }
            if (!afterZord) return fail("invalid_zord_material");
            nextPlayer = afterZord;
          }

          if (mothershipHolds.length > 0) {
            const kind = canUseMothershipForZordRush(
              state.definitions,
              nextPlayer,
              found.card.cardId,
            );
            if (!kind) return fail("invalid_zord_material");
            const afterHolds = applyMothershipHolds(
              nextPlayer,
              state.definitions,
              mothershipHolds,
              kind,
            );
            if (!afterHolds) return fail("invalid_zord_material");
            nextPlayer = afterHolds;
          }
        }
      }

      let nextStateAfterRush = state;
      if (needsOpponentDrawCost(state.definitions, found.card.cardId)) {
        nextStateAfterRush = applyOpponentDrawCost(state, playerId);
      }

      if (!payPowerCost(state, playerId, cost)) {
        const powerState = {
          ...state,
          players: { ...state.players, [playerId]: nextPlayer },
        };
        const effectiveCost = effectivePowerCost(state, playerId, cost);
        let candidate = nextPlayer;
        let available = countAvailablePower(
          { ...powerState, players: { ...powerState.players, [playerId]: candidate } },
          playerId,
        );
        let shortage = effectiveCost - available;

        if (shortage > 0) {
          const withGodom = applyGodomSenshoDiscardPay(powerState, candidate, shortage);
          if (withGodom) {
            candidate = withGodom;
            available = countAvailablePower(
              { ...powerState, players: { ...powerState.players, [playerId]: candidate } },
              playerId,
            );
            shortage = effectiveCost - available;
          }
        }

        if (shortage > 0) {
          if (darkDealRushPowerBudget(state, playerId, candidate, definition!) < effectiveCost) {
            return fail("insufficient_power");
          }
          const withHolds = applyDarkDealRushHolds(candidate, shortage);
          if (!withHolds) return fail("insufficient_power");
          candidate = withHolds;
        }
        nextPlayer = candidate;
      }

      const handFound = findInZone(nextPlayer, "hand", action.instanceId);
      if (!handFound) return fail("card_not_in_hand");

      const [, hand] = removeAt(nextPlayer.hand, handFound.index);
      let rushCard = handFound.card;
      if (
        needsZordDownPayment(found.card.cardId, definition!.powerCost, definition!) &&
        action.zordMaterialInstanceId
      ) {
        const material = findZordDownMaterial(
          player,
          state.definitions,
          found.card.cardId,
          found.card.instanceId,
          action.zordMaterialInstanceId,
        );
        if (material) {
          rushCard = { ...rushCard, zordMaterialCardId: material.card.cardId };
        }
      } else if (
        needsZordMaterial(state.definitions, found.card.cardId) &&
        !requiresAllFusionPartners(found.card.cardId) &&
        action.zordMaterialInstanceId
      ) {
        const material = findZordMaterial(
          player,
          state.definitions,
          found.card.cardId,
          found.card.instanceId,
          action.zordMaterialInstanceId,
        );
        if (material) {
          rushCard = { ...rushCard, zordMaterialCardId: material.card.cardId };
        }
      } else if (
        needsZordMaterial(state.definitions, found.card.cardId) &&
        requiresAllFusionPartners(found.card.cardId)
      ) {
        const partners = listZordFusionPartnerIds(found.card.cardId);
        if (partners[0]) {
          rushCard = { ...rushCard, zordMaterialCardId: partners[0] };
        }
      }
      nextPlayer = {
        ...nextPlayer,
        hand,
        rush: [...nextPlayer.rush, rushCard],
      };
      nextPlayer = markRushedThisTurn(nextPlayer, handFound.card.instanceId);
      nextPlayer = clearShironLightRushTarget(nextPlayer);
      // ルール: R-ERR-RK043 — 【突入】の軽減は「次にラッシュする」ミラーライダー1枚だけ。
      nextPlayer = consumeRideShooterRushRule(state, playerId, nextPlayer, found.card.cardId);
      nextPlayer = clearCostWindow(nextPlayer, "rush_category");
      let nextState: GameState = {
        ...nextStateAfterRush,
        ...updatePlayer(nextStateAfterRush, playerId, nextPlayer),
      };
      if (found.card.cardId === "RS-203") {
        // RS-203【デウス遺伝子】: 追加条件で捨札にしたユニットのカードの特徴を、このターンすべてのユニットに追加する。
        const discardedMaterials = zordMaterialIds
          .map((id) => nextPlayer.discard.find((c) => c.instanceId === id)?.cardId)
          .filter((id): id is string => !!id);
        nextState = applyDeusGeneOnRush(nextState, playerId, found.card.cardId, discardedMaterials);
      }

      const rushFinal = emitUnitRushedAndFinalize(
        nextState,
        playerId,
        handFound.card.instanceId,
        playerId,
      );
      nextState = {
        ...rushFinal.state,
        log: [...rushFinal.state.log, ...rushFinal.logs],
      };

      if (found.card.cardId === "RS-397") {
        const enemyId = opponent(playerId);
        const enemyBattle = nextState.players[enemyId].battle;
        if (enemyBattle.length >= 2) {
          nextState = openEffectChoice(nextState, {
            playerId,
            effectId: "reorder_enemy_battle",
            sourceCardId: "RS-397",
            sourceInstanceId: found.card.instanceId,
            kind: "confirm",
            phasePlayerId: playerId,
            validInstanceIds: ["逆順に並び替える"],
            optional: true,
          });
        }
      }

      // RK-301 等: ライドされている指定ビークルからのコンビネーション（配置時）。
      if (!nextState.pendingEffectChoice && !rushFinal.counterPending) {
        const extendCombo = tryExtendRiderComboOnRush(
          nextState,
          playerId,
          found.card.cardId,
          handFound.card.instanceId,
          playerId,
        );
        if (extendCombo) nextState = extendCombo;
      }

      const mainLog = buildLogEntry(
        playerId,
        "rush",
        found.card.cardId,
        state.definitions,
        rushFinal.counterPending ? "counter_pending" : undefined,
      );

      if (!rushFinal.counterPending) {
        nextState = applyAutoBattleEntryOnRush(nextState, playerId, handFound.card.instanceId);
      }

      return ok(nextState, mainLog);
    }

    case "move_to_battle": {
      let found = findInZone(player, "rush", action.instanceId);
      if (!found) return fail("card_not_in_rush");

      if (state.phase !== "battle") {
        if (state.phase !== "rush" || !hasAutoBattleEntryOnRushNote(found.card.cardId)) {
          return fail("wrong_phase");
        }
      }

      if (
        needsBattleEntryRushDiscard(found.card.cardId) &&
        !battleEntryRushDiscardSatisfied(player, found.card.cardId)
      ) {
        const discardChoice = tryStartBattleEntryRushDiscard(state, playerId, found.card);
        if (!discardChoice) return fail("cannot_enter_battle");
        return ok(
          discardChoice,
          buildSimpleLogEntry(playerId, "battle_entry_discard_pending"),
        );
      }

      if (
        needsBattleEntryHandDiscard(found.card.cardId) &&
        !battleEntryHandDiscardSatisfied(player, found.card.cardId)
      ) {
        const discardChoice = tryStartBattleEntryHandDiscard(state, playerId, found.card);
        if (!discardChoice) return fail("cannot_enter_battle");
        return ok(
          discardChoice,
          buildSimpleLogEntry(playerId, "battle_entry_hand_discard_pending"),
        );
      }

      if (
        needsBattleEntryPowerDiscard(found.card.cardId) &&
        !battleEntryPowerDiscardSatisfied(player, found.card.cardId)
      ) {
        const discardChoice = tryStartBattleEntryPowerDiscard(state, playerId, found.card);
        if (!discardChoice) return fail("cannot_enter_battle");
        return ok(
          discardChoice,
          buildSimpleLogEntry(playerId, "battle_entry_power_discard_pending"),
        );
      }

      if (!canMoveUnitToBattle(state, playerId, found.card, "rush")) {
        return fail("cannot_enter_battle");
      }

      const entryHoldsRequired = requiredBattleEntryHolds(state, playerId, found.card);
      if (
        entryHoldsRequired > 0 &&
        countHeldCommands(player) < entryHoldsRequired
      ) {
        return fail("cannot_enter_battle");
      }
      let nextPlayer: PlayerState = clearCostWindow(
        clearCostWindow(
          clearCostWindow(player, "battle_entry_hold"),
          "battle_entry_hand_discard",
        ),
        "battle_entry_power_discard",
      );
      const [, rush] = removeAt(nextPlayer.rush, found.index);
      nextPlayer = { ...nextPlayer, rush };

      const position = battlePositionAfterMove(nextPlayer.battle);
      const battleBeforeEnter = [...nextPlayer.battle];
      let battleCard = found.card;
      if (action.rideOff && found.card.mountedOnInstanceId) {
        battleCard = { ...battleCard, mountedOnInstanceId: undefined };
      } else if (
        !found.card.mountedOnInstanceId &&
        action.vehicleInstanceId
      ) {
        if (
          !canRiderMountVehicle(
            state,
            playerId,
            found.card,
            action.vehicleInstanceId,
          )
        ) {
          return fail("illegal_action");
        }
        battleCard = {
          ...found.card,
          mountedOnInstanceId: action.vehicleInstanceId,
        };
        if (!canMoveUnitToBattle(state, playerId, battleCard, "rush")) {
          return fail("cannot_enter_battle");
        }
      }

      let vehicleForBattle: CardInstance | null = null;
      if (battleCard.mountedOnInstanceId && !action.rideOff) {
        const extracted = extractMountedVehicleFromRush(
          nextPlayer.rush,
          battleCard.mountedOnInstanceId,
        );
        nextPlayer = { ...nextPlayer, rush: extracted.rush };
        vehicleForBattle = extracted.vehicle;
      }

      const nextBattle = [...nextPlayer.battle];
      if (vehicleForBattle) {
        nextBattle.push(vehicleForBattle, battleCard);
      } else {
        nextBattle.push(battleCard);
      }
      nextPlayer = {
        ...nextPlayer,
        battle: nextBattle,
      };
      if (
        action.rideOff &&
        cardHasGrantKeyword(battleCard.cardId, "no_strike_after_rideoff")
      ) {
        nextPlayer = applyNoStrikeAfterRideOff(nextPlayer, battleCard.instanceId);
      }
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      const combo = emitUnitEnteredBattleEffects(
        nextState,
        playerId,
        battleCard,
        position,
        {
          battleBeforeEnter,
          rideOff: action.rideOff,
        },
      );

      const mainLog = buildLogEntry(
        playerId,
        "move_to_battle",
        battleCard.cardId,
        state.definitions,
      );
      const entry = applyShinobiBallRequiredDefender(
        combo.state,
        playerId,
        createBattleEntryPrompt(
          playerId,
          battleCard.instanceId,
          combo.state.pendingEffectChoice && combo.enterResumeFrom
            ? {
                battlePosition: position,
                rideOff: action.rideOff,
                battleBeforeEnterInstanceIds: battleBeforeEnter.map((c) => c.instanceId),
                from: combo.enterResumeFrom,
              }
            : undefined,
        ),
      );
      const withClearedDiscard = {
        ...combo.state,
        ...updatePlayer(combo.state, playerId, clearCostWindow(
          combo.state.players[playerId],
          "battle_entry_rush_discard",
        )),
      };
      const finalState: GameState = openBattleEntryOrRideOffChoice(
        {
          ...withClearedDiscard,
          log: [...withClearedDiscard.log, ...combo.logs, mainLog],
          winner: checkWinner(withClearedDiscard),
        },
        entry,
      );
      return { ok: true, state: finalState };
    }

    case "pass_battle_entry": {
      const pending = state.pendingBattleEntry;
      if (!pending || playerId !== pending.playerId) return fail("no_pending_battle_entry");
      let cleared = clearBakiBakiExtraAttack(state, playerId, pending.instanceId);
      const nextPlayer = markBattleActed(cleared.players[playerId], pending.instanceId);
      const nextState = finishBattleEntryIf(
        { ...cleared, ...updatePlayer(cleared, playerId, nextPlayer) },
        pending.instanceId,
      );
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_battle_entry"));
    }

    case "self_rush_from_zone": {
      const applied = applySelfRushFromZone(state, playerId, action.zone, action.instanceId);
      if (!applied) return fail("illegal_action");
      return ok(
        applied,
        buildLogEntry(playerId, "rush", 
          state.players[playerId][action.zone].find((c) => c.instanceId === action.instanceId)?.cardId ?? action.instanceId,
          state.definitions,
          "self_rush_from_zone",
        ),
      );
    }

    case "strike": {
      if (state.phase !== "battle") return fail("wrong_phase");
      if (state.pendingStrike) return fail("pending_strike");
      if (
        state.pendingBattleEntry &&
        action.instanceId !== state.pendingBattleEntry.instanceId
      ) {
        return fail("pending_battle_entry");
      }

      const found = findInZone(player, "battle", action.instanceId);
      if (!found) return fail("card_not_in_battle");
      if (battleActBlocked(player, found.card, "strike")) return fail("already_acted");
      if (!canStrikeUnit(state.definitions, found.card, state, playerId)) return fail("insufficient_sp");

      const damage = strikeDamageFor(state.definitions, found.card, state, playerId);
      let nextPlayer = markUnitBattleAction(
        markBattleActed(player, action.instanceId),
        action.instanceId,
        "strike",
      );
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      const pending: PendingStrike = {
        strikerPlayerId: playerId,
        strikerInstanceId: action.instanceId,
        damage,
        battlePhasePlayer: playerId,
      };
      nextState = emitStrikeDeclared(nextState, pending);

      // RS-196 ダイナモビル【迎撃モビルミサイル】: ストライクされたとき発動できる（任意）。
      const mobil = openMobilMissileChoice(nextState, pending);
      if (mobil) {
        const cleared =
          state.pendingBattleEntry?.instanceId === action.instanceId ? { ...mobil, pendingBattleEntry: undefined } : mobil;
        return ok(cleared, buildSimpleLogEntry(playerId, "strike_pending", String(damage)));
      }

      const defenderId = opponent(playerId);
      if (hasStrikeReactions(nextState, defenderId, pending)) {
        nextState = {
          ...nextState,
          pendingStrike: pending,
          activePlayer: defenderId,
        };
        if (state.pendingBattleEntry?.instanceId === action.instanceId) {
          nextState = { ...nextState, pendingBattleEntry: undefined };
        }
        return ok(
          nextState,
          buildSimpleLogEntry(playerId, "strike_pending", String(damage)),
        );
      }

      return completeStrike(nextState, pending);
    }

    case "five_tech_intercept": {
      const pending = state.pendingStrike;
      if (!pending) return fail("no_pending_strike");
      const defenderId = opponent(pending.strikerPlayerId);
      if (playerId !== defenderId) return fail("wrong_player");

      const result = applyFiveTechIntercept(
        state,
        defenderId,
        pending,
        action.interceptInstanceId,
      );
      if (result.state.pendingLeave) {
        return ok(
          { ...result.state, log: [...result.state.log, result.log] },
          result.log,
        );
      }
      return completeStrike(result.state, result.pending, [result.log]);
    }

    case "play_counter": {
      if (!canExecuteHandCounter(state, playerId, action.instanceId)) {
        return fail("command_not_held");
      }

      if (state.pendingLeave) {
        const pending = state.pendingLeave;
        if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
        const effectId = getCounterEffectId(state, playerId, action.instanceId);
        if (effectId === "dino_chronicle") {
          const result = applyDinoChronicleCounter(state, playerId, action.instanceId);
          const nextState = finalizeLeaveReaction(result.state, pending, result.prevented);
          const strikePending = state.pendingStrike;
          if (!result.prevented && pending.resumePendingStrike && strikePending) {
            const resumedStrike: PendingStrike = {
              strikerPlayerId: strikePending.strikerPlayerId,
              strikerInstanceId: strikePending.strikerInstanceId,
              damage: strikePending.damage,
              battlePhasePlayer: strikePending.battlePhasePlayer,
              damageCancelled: pending.resumePendingStrike.damageCancelled,
            };
            return completeStrike(
            clearCounterHoldReady(nextState, playerId),
            resumedStrike,
          );
          }
          return ok(clearCounterHoldReady(nextState, playerId), result.log);
        }
        if (effectId === "dino_guts") {
          const counterCard = state.players[playerId].hand.find(
            (c) => c.instanceId === action.instanceId,
          );
          const dslResult =
            counterCard &&
            tryResolveDslLeaveCounter({
              state,
              playerId,
              counterInstanceId: action.instanceId,
              leavingCardId: pending.leavingCardId,
              sourceCardId: counterCard.cardId,
              phasePlayerId: pending.phasePlayerId,
            });
          const result = dslResult
            ? { state: dslResult.state, log: buildLogEntry(playerId, "play_counter", counterCard!.cardId, state.definitions, dslResult.detail), prevented: dslResult.prevented }
            : applyDinoGutsCounter(
              state,
              playerId,
              action.instanceId,
              pending.leavingCardId,
              pending.phasePlayerId,
            );
          const nextState = finalizeLeaveReaction(result.state, pending, result.prevented);
          const strikePending = state.pendingStrike;
          if (!result.prevented && pending.resumePendingStrike && strikePending) {
            const resumedStrike: PendingStrike = {
              strikerPlayerId: strikePending.strikerPlayerId,
              strikerInstanceId: strikePending.strikerInstanceId,
              damage: strikePending.damage,
              battlePhasePlayer: strikePending.battlePhasePlayer,
              damageCancelled: pending.resumePendingStrike.damageCancelled,
            };
            return completeStrike(
              clearCounterHoldReady(nextState, playerId),
              resumedStrike,
            );
          }
          return ok(clearCounterHoldReady(nextState, playerId), result.log);
        }
        if (effectId === "sage_ael") {
          const result = applySageAelCounter(state, playerId, action.instanceId, pending);
          const nextState = finalizeLeaveReaction(result.state, pending, result.prevented);
          return ok(clearCounterHoldReady(nextState, playerId), result.log);
        }
        if (effectId === "mag_load") {
          const result = applyMagLoadCounter(state, playerId, action.instanceId, pending);
          const nextState = finalizeLeaveReaction(result.state, pending, result.prevented);
          return ok(clearCounterHoldReady(nextState, playerId), result.log);
        }
        return fail("invalid_counter");
      }

      if (state.pendingBattle) {
        const pending = state.pendingBattle;
        if (playerId !== pending.defenderPlayerId) return fail("wrong_player");
        const effectId = getCounterEffectId(state, playerId, action.instanceId);
        const counterCardId = findInZone(player, "hand", action.instanceId)?.card.cardId;
        if (counterCardId && isMechanicNinjaCounter(counterCardId)) {
          const result = applyMechanicNinjaCounter(
            state,
            playerId,
            action.instanceId,
            action.substituteInstanceId,
            pending,
          );
          const nextPending: PendingBattle = result.battleCancelled
            ? { ...pending, battleCancelled: true }
            : pending;
          const resolved = emitBattleDeclaredAndResolve(result.state, nextPending);
          return {
            ok: true,
            state: {
              ...clearCounterHoldReady(resolved.state, playerId),
              log: [...resolved.state.log, result.log, resolved.log],
              winner: checkWinner(resolved.state),
            },
          };
        }
        if (effectId === "new_gymnastics") {
          const result = applyNewGymnasticsCounter(
            state,
            playerId,
            action.instanceId,
            pending,
          );
          const nextPending: PendingBattle = { ...pending, battleCancelled: true };
          const resolved = emitBattleDeclaredAndResolve(result.state, nextPending);
          return {
            ok: true,
            state: {
              ...clearCounterHoldReady(resolved.state, playerId),
              log: [...resolved.state.log, result.log, resolved.log],
              winner: checkWinner(resolved.state),
            },
          };
        }
        if (effectId === "hidden_ninja") {
          if (!action.substituteInstanceId) return fail("target_required");
          const result = applyHiddenNinjaCounter(
            state,
            playerId,
            action.instanceId,
            action.substituteInstanceId,
            pending,
          );
          // ルール: R-TIME-05 / R-CTR-02 — 同じ「アタックされたとき」に隠流忍術を続けて使える。
          // まだ使えるカウンターがあればバトルの解決を待ち、反応ウィンドウを開いたままにする。
          if (
            hasBattleCounterReactions(
              { ...result.state, activePlayer: pending.attackerPlayerId },
              playerId,
              pending.defenderInstanceId,
              pending.attackerPlayerId,
              pending.attackerInstanceId,
            )
          ) {
            return ok(
              clearCounterHoldReady(
                { ...result.state, pendingBattle: result.pending, activePlayer: playerId },
                playerId,
              ),
              result.log,
            );
          }
          const resolved = emitBattleDeclaredAndResolve(result.state, result.pending);
          return {
            ok: true,
            state: {
              ...clearCounterHoldReady(resolved.state, playerId),
              log: [...resolved.state.log, result.log, resolved.log],
              winner: checkWinner(resolved.state),
            },
          };
        }
        return fail("invalid_counter");
      }

      if (state.pendingRush) {
        const pending = state.pendingRush;
        const defenderId = rushReactorId(pending);
        if (playerId !== defenderId) return fail("wrong_player");
        if (!canUseRushReactionCounter(state, playerId, action.instanceId, pending)) {
          return fail("invalid_counter");
        }
        const counterCardId = findInZone(state.players[playerId], "hand", action.instanceId)!.card.cardId;
        const result = isShippuNinjaCard(state, counterCardId)
          ? applyShippuNinjaCounter(state, playerId, action.instanceId, pending)
          : applyMusicBoxClockCounter(state, playerId, action.instanceId, pending);
        // 同じラッシュに対して続けて別のカウンターを使える（atwiki/page-424 Q12・Q15）。
        // 使えるカウンターが残っていれば反応窓を開いたままにする。
        const stillOpen = hasRushCounterReactions(
          { ...result.state, activePlayer: pending.phasePlayerId },
          playerId,
          pending.rushedInstanceId,
          pending.rusherPlayerId,
        );
        const nextState = stillOpen
          ? { ...result.state, pendingRush: pending, activePlayer: playerId }
          : finalizeRushPending(result.state, pending);
        return ok(clearCounterHoldReady(nextState, playerId), result.log);
      }

      if (state.pendingStrike) {
        const pending = state.pendingStrike;
        const defenderId = opponent(pending.strikerPlayerId);
        if (playerId !== defenderId) return fail("wrong_player");
        if (!magiPunchCounterIds(state, defenderId, pending).includes(action.instanceId)) {
          return fail("invalid_counter");
        }
        // RS-184 マジパンチ: ストライクしてきたユニットを持ち主の手札に戻し、ストライクを無効にする。
        const result = applyMagiPunchCounter(state, defenderId, action.instanceId, pending);
        const cleared = clearCounterHoldReady(result.state, playerId);
        if (magiPunchCounterIds(cleared, defenderId, result.pending).length > 0) {
          // 同じストライクに続けて使える（faq-card-4 RS-184 Q1）。反応窓を開いたままにする。
          return ok({ ...cleared, pendingStrike: result.pending, activePlayer: defenderId }, result.log);
        }
        return completeStrike({ ...cleared, pendingStrike: result.pending }, result.pending, [result.log]);
      }

      return fail("no_pending_reaction");
    }

    case "use_plasma_energy": {
      const pending = state.pendingStrike;
      if (!pending) return fail("no_pending_strike");
      const defenderId = opponent(pending.strikerPlayerId);
      if (playerId !== defenderId) return fail("wrong_player");
      if (!canPlayPlasmaEnergyCounter(state, defenderId)) {
        return fail("invalid_counter");
      }

      const counter = applyPlasmaEnergyCounter(
        state,
        defenderId,
        pending.strikerPlayerId,
        pending.strikerInstanceId,
      );
      if (counter.state.pendingLeave) {
        return ok(
          { ...counter.state, log: [...counter.state.log, counter.log] },
          counter.log,
        );
      }
      return completeStrike(counter.state, pending, [counter.log]);
    }

    case "resolve_ruin_survey": {
      const result = applyResolveRuinSurvey(state, playerId, action.placement);
      if ("error" in result) return fail(result.error);
      return ok(result.state, result.log);
    }

    case "resolve_seabed_draw": {
      const result = applySeabedDrawPlacement(state, playerId, action.placement);
      if ("error" in result) return fail(result.error);
      let nextState = result.state;
      if (
        nextState.phase === "start" &&
        nextState.players[playerId].hasDrawnThisStart &&
        !nextState.pendingEffectChoice
      ) {
        nextState = openEarthForceUpkeepChoiceIfNeeded(nextState, playerId);
      }
      return withStartPhaseAutoAdvance(
        ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "resolve_seabed_draw")),
        playerId,
      );
    }

    case "confirm_denji_reveal": {
      const result = applyConfirmDenjiReveal(state, playerId);
      if ("error" in result) return fail(result.error);
      const nextState = result.state;
      if (nextState.pendingEffectChoice) {
        return ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "confirm_denji_reveal"));
      }
      return ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "confirm_denji_reveal"));
    }

    case "confirm_shiron_reveal": {
      const result = applyConfirmShironReveal(state, playerId);
      if ("error" in result) return fail(result.error);
      return ok(
        result.state,
        result.log ?? buildSimpleLogEntry(playerId, "confirm_shiron_reveal"),
      );
    }

    case "confirm_effect_choice": {
      const confirming = state.pendingEffectChoice;
      const result = applyConfirmEffectChoice(state, playerId);
      if ("error" in result) return fail(result.error);
      if (
        result.state.phase === "end" &&
        !result.state.pendingEffectChoice &&
        isSet4EndTurnEffect(confirming?.effectId)
      ) {
        // RS-192【アタックボード】等、エンドフェイズの任意効果を行った — 残りの「ターンを終えるとき」へ進む。
        const reopened = tryOpenEndTurnEffectsMenu(result.state, confirming!.phasePlayerId) ?? result.state;
        return withEndPhaseAutoFinalize(
          ok(reopened, result.log ?? buildSimpleLogEntry(playerId, "confirm_effect_choice")),
          playerId,
        );
      }
      return withStartPhaseAutoAdvance(
        ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "confirm_effect_choice")),
        playerId,
      );
    }

    case "resolve_effect_choice": {
      const pending = state.pendingEffectChoice;
      if (pending?.effectId === MOBIL_MISSILE_EFFECT_ID && pending.mobilMissileStrike) {
        const picked = selectMobilMissileCommand(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        if (!picked.done) {
          return ok(picked.state, buildSimpleLogEntry(playerId, "resolve_effect_choice", action.instanceId));
        }
        return completeStrike(picked.state, picked.strike, [
          buildLogEntry(playerId, "resolve_effect_choice", "RS-196", state.definitions, `${MOBIL_MISSILE_EFFECT_ID}:strike_nullified`),
        ]);
      }
      if (pending?.effectId === TURN_END_EXODUS_ORDER_EFFECT_ID) {
        const ordered = resolveTurnEndExodusOrder(state, playerId, action.instanceId);
        if (!ordered) return fail("invalid_target");
        return withEndPhaseAutoFinalize(
          ok(ordered, buildSimpleLogEntry(playerId, "resolve_effect_choice", action.instanceId)),
          playerId,
        );
      }
      if (pending?.effectId === MACHINE_EMPIRE_EFFECT_ID && pending.machineEmpireMeta) {
        const picked = resolveMachineEmpirePick(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        if (!picked.done) {
          return ok(picked.state, buildSimpleLogEntry(playerId, "resolve_effect_choice", action.instanceId));
        }
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
      }
      if (pending?.effectId === ATTACK_HOLD_BONUS_EFFECT_ID && pending.attackHoldMeta) {
        const held = resolveAttackHoldChoice(state, playerId, action.instanceId);
        if ("error" in held) return fail(held.error);
        if (!held.done) {
          return ok(held.state, buildSimpleLogEntry(playerId, "resolve_effect_choice", action.instanceId));
        }
        return continueAttackAfterDeclaration(held.state, held.battle, held.wingAttackFromRush);
      }
      if (pending?.kind === "denji_machine") {
        const result = applyDenjiBottomOrderSelect(state, playerId, action.instanceId);
        if ("error" in result) return fail(result.error);
        return ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
      }
      if (pending?.kind === "shiron_light") {
        const result = applyShironPickSelect(state, playerId, action.instanceId);
        if ("error" in result) return fail(result.error);
        return ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
      }
      const result = applyEffectChoiceSelect(state, playerId, action.instanceId);
      if ("error" in result) {
        if (
          result.error === "invalid_target" &&
          pending?.optional &&
          pending.effectId !== "earth_force"
        ) {
          const skipped = skipEffectChoice(state, playerId);
          if ("error" in skipped) return fail(skipped.error);
          return withEndPhaseAutoFinalize(
            withStartPhaseAutoAdvance(
              ok(skipped.state, skipped.log ?? buildSimpleLogEntry(playerId, "skip_effect_choice")),
              playerId,
            ),
            playerId,
          );
        }
        return fail(result.error);
      }
      let nextState = result.state;
      if (result.logs?.length) {
        nextState = { ...nextState, log: [...nextState.log, ...result.logs] };
      }
      if (!nextState.pendingEffectChoice && hasStartReturnInProgress(nextState)) {
        nextState = continueBattleToRushEffectQueue(nextState);
      }
      if (
        pending?.effectId === SUPER_BRAIN_KEEP_EFFECT_ID &&
        nextState.phase === "start" &&
        nextState.players[playerId].hasDrawnThisStart &&
        !nextState.pendingEffectChoice
      ) {
        nextState = openEarthForceUpkeepChoiceIfNeeded(nextState, playerId);
      }
      if (
        nextState.phase === "end" &&
        !nextState.pendingEffectChoice &&
        pending?.effectId === "jet_skateboard" ||
        pending?.effectId === "end_turn_battle_to_rush"
      ) {
        nextState = tryOpenEndTurnEffectsMenu(nextState, playerId) ?? nextState;
      }
      if (nextState.phase === "end" && !nextState.pendingEffectChoice && isSet4EndTurnEffect(pending?.effectId)) {
        nextState = tryOpenEndTurnEffectsMenu(nextState, pending!.phasePlayerId) ?? nextState;
      }
      return withEndPhaseAutoFinalize(
        withStartPhaseAutoAdvance(
          ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice")),
          playerId,
        ),
        playerId,
      );
    }

    case "skip_effect_choice": {
      const pending = state.pendingEffectChoice;
      if (pending?.effectId === MOBIL_MISSILE_EFFECT_ID && pending.mobilMissileStrike && pending.playerId === playerId) {
        // 発動しない — ストライクは通常どおり（ほかのストライクへの応答があれば開く）。
        const strikePending = pending.mobilMissileStrike;
        const base: GameState = { ...state, pendingEffectChoice: undefined };
        if (hasStrikeReactions(base, playerId)) {
          return ok({ ...base, pendingStrike: strikePending, activePlayer: playerId }, buildSimpleLogEntry(playerId, "skip_effect_choice"));
        }
        return completeStrike(base, strikePending);
      }
      if (pending?.effectId === MACHINE_EMPIRE_EFFECT_ID && pending.machineEmpireMeta) {
        const skipped = skipMachineEmpireChoice(state, playerId);
        if ("error" in skipped) return fail(skipped.error);
        return continueAttackAfterDeclaration(skipped.state, skipped.battle, skipped.wingAttackFromRush);
      }
      if (pending?.effectId === "earth_force" && pending.playerId === playerId) {
        const { state: afterDiscard, discarded } = discardEarthForceForUnpaidUpkeep(
          state,
          playerId,
        );
        if (!discarded) return fail("invalid_target");
        const nextState: GameState = {
          ...afterDiscard,
          pendingEffectChoice: undefined,
          activePlayer: pending.phasePlayerId,
        };
        return withStartPhaseAutoAdvance(
          ok(
            nextState,
            buildLogEntry(
              playerId,
              "earth_force_upkeep",
              "RS-022",
              state.definitions,
              "declined",
            ),
          ),
          playerId,
        );
      }
      const result = skipEffectChoice(state, playerId);
      if ("error" in result) return fail(result.error);
      let afterSkip = result.state;
      if (!afterSkip.pendingEffectChoice && hasStartReturnInProgress(afterSkip)) {
        afterSkip = continueBattleToRushEffectQueue(afterSkip);
      }
      if (
        afterSkip.phase === "start" &&
        afterSkip.players[playerId].hasDrawnThisStart &&
        !afterSkip.pendingEffectChoice &&
        (pending?.effectId === "seabed_survey" || pending?.effectId === SUPER_BRAIN_KEEP_EFFECT_ID)
      ) {
        afterSkip = openEarthForceUpkeepChoiceIfNeeded(afterSkip, playerId);
      }
      if (
        afterSkip.phase === "end" &&
        !afterSkip.pendingEffectChoice &&
        pending?.effectId === "jet_skateboard" ||
        pending?.effectId === "end_turn_battle_to_rush"
      ) {
        afterSkip = tryOpenEndTurnEffectsMenu(afterSkip, playerId) ?? afterSkip;
      }
      if (afterSkip.phase === "end" && !afterSkip.pendingEffectChoice && isSet4EndTurnEffect(pending?.effectId)) {
        afterSkip = tryOpenEndTurnEffectsMenu(afterSkip, pending!.phasePlayerId) ?? afterSkip;
      }
      return withEndPhaseAutoFinalize(
        withStartPhaseAutoAdvance(
          ok(afterSkip, result.log ?? buildSimpleLogEntry(playerId, "skip_effect_choice")),
          playerId,
        ),
        playerId,
      );
    }

    case "pass_strike_reaction": {
      const pending = state.pendingStrike;
      if (!pending) return fail("no_pending_strike");
      const defenderId = opponent(pending.strikerPlayerId);
      if (playerId !== defenderId) return fail("wrong_player");
      return completeStrike(state, pending);
    }

    case "pass_battle_reaction": {
      const pending = state.pendingBattle;
      if (!pending) return fail("no_pending_battle");
      if (playerId !== pending.defenderPlayerId) return fail("wrong_player");
      const resolved = emitBattleDeclaredAndResolve(state, pending);
      return ok(resolved.state, resolved.log);
    }

    case "pass_rush_reaction": {
      const pending = state.pendingRush;
      if (!pending) return fail("no_pending_rush");
      if (playerId !== rushReactorId(pending)) return fail("wrong_player");
      let nextState = finalizeRushPending(state, pending);
      // ルール: R-RUSH-22 — 窓を閉じた後で「ラッシュするとき可能ならバトルエリアに置く」を処理する。
      nextState = applyAutoBattleEntryOnRush(nextState, pending.rusherPlayerId, pending.rushedInstanceId);
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_rush_reaction"));
    }

    case "pass_morph_reaction": {
      const nextState = passMorphReaction(state, playerId);
      if (!nextState) return fail("no_pending_morph");
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_morph_reaction"));
    }

    case "select_morph_unit": {
      const nextState = beginMorphUnitSelection(
        state,
        playerId,
        action.morphUnitInstanceId,
      );
      if (!nextState) return fail("invalid_morph_unit");
      return ok(nextState, buildSimpleLogEntry(playerId, "select_morph_unit"));
    }

    case "use_juu_kun_do": {
      if (state.phase !== "battle") return fail("wrong_phase");
      const lionDanceUnit = findInZone(player, "battle", action.attackerInstanceId);
      if (lionDanceUnit && isLionDanceCard(lionDanceUnit.card.cardId)) {
        // ルール: R-ATK-05 — 【超忍法・舞獅子】はアタックするかわりに発動する。
        const danced = applyLionDance(state, playerId, action.attackerInstanceId);
        if (!danced) return fail("illegal_action");
        return ok(
          finishBattleEntryIf(danced, action.attackerInstanceId),
          buildSimpleLogEntry(playerId, "super_ninpo_lion_dance", action.attackerInstanceId),
        );
      }
      const nextState = applyUseJuuKunDo(
        state,
        playerId,
        action.attackerInstanceId,
      );
      if (!nextState) return fail("illegal_action");
      return ok(
        nextState,
        buildSimpleLogEntry(playerId, "use_juu_kun_do", action.attackerInstanceId),
      );
    }

    case "use_super_shield": {
      const pending = state.pendingLeave;
      if (!pending?.superShieldInstanceId) return fail("no_super_shield");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");

      // 守ったユニットはその場に留まる（撃破された事実は残る）。そのあとトリケラを捨札にする。
      const prevented = finalizeLeaveReaction(state, pending, true);
      const shieldResult = applySuperShieldSubstitute(
        prevented,
        playerId,
        pending.superShieldInstanceId,
        pending.phasePlayerId,
        pending.resumePendingStrike,
      );
      let nextState = shieldResult.state;
      if (shieldResult.deferred) {
        // トリケラが場を離れるときの応答（ダイノガッツ等）を待つ。ストライクの再開はその解決後。
        return ok(nextState, shieldResult.log);
      }
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        }, [shieldResult.log]);
      }
      return ok(nextState, shieldResult.log);
    }

    case "pass_leave_reaction": {
      const pending = state.pendingLeave;
      if (!pending) return fail("no_pending_leave");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
      let nextState = finalizeLeaveReaction(state, pending, false);
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_leave_reaction"));
    }

    case "use_register": {
      const pending = state.pendingRegister;
      if (!pending) return fail("no_pending_register");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
      const nextState = applyRegisterHold(state, pending);
      if (pending.followUpAttackerLeave) {
        const followUp = tryLeaveField(nextState, {
          ...pending.followUpAttackerLeave,
          phasePlayerId: pending.followUpAttackerLeave.phasePlayerId,
        });
        if (followUp.deferred) {
          return ok(followUp.state, buildSimpleLogEntry(playerId, "use_register"));
        }
        return ok(followUp.state, buildSimpleLogEntry(playerId, "use_register"));
      }
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "use_register"));
    }

    case "pass_register": {
      const pending = state.pendingRegister;
      if (!pending) return fail("no_pending_register");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
      let nextState = finalizeRegisterDiscard(state, pending);
      if (pending.followUpAttackerLeave) {
        const followUp = tryLeaveField(nextState, {
          ...pending.followUpAttackerLeave,
          phasePlayerId: pending.followUpAttackerLeave.phasePlayerId,
        });
        nextState = followUp.state;
      }
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_register"));
    }

    case "resolve_chase": {
      const pending = state.pendingChase;
      if (!pending) return fail("no_pending_chase");
      if (playerId !== pending.chaserPlayerId) return fail("wrong_player");
      if (!listValidChaseVehicleIds(state, pending).includes(action.newVehicleInstanceId)) {
        return fail("invalid_chase_vehicle");
      }
      const result = applyResolveChase(state, pending, action.newVehicleInstanceId);
      if (!result.log) return fail("invalid_chase_vehicle");
      return ok(result.state, result.log);
    }

    case "pass_chase": {
      const pending = state.pendingChase;
      if (!pending) return fail("no_pending_chase");
      if (playerId !== pending.chaserPlayerId) return fail("wrong_player");
      let nextState = applyPassChase(state, pending);
      if (pending.leaveIntent.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.leaveIntent.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_chase"));
    }

    case "mount_ride": {
      if (state.phase !== "battle") return fail("wrong_phase");
      return applyAction(
        state,
        {
          type: "move_to_battle",
          playerId,
          instanceId: action.riderInstanceId,
          vehicleInstanceId: action.vehicleInstanceId,
        },
        { ...options, trustLegality: true },
      );
    }

    case "resolve_ride_off_choice": {
      const pending = state.pendingRideOffChoice;
      if (!pending || playerId !== pending.playerId) return fail("no_pending_ride_off");
      let nextState: GameState = { ...state, pendingRideOffChoice: undefined };
      let nextPlayer = { ...player };

      if (action.rideOff) {
        const idx = nextPlayer.battle.findIndex(
          (c) => c.instanceId === pending.instanceId,
        );
        if (idx < 0) return fail("card_not_in_battle");
        const rider = nextPlayer.battle[idx]!;
        const battle = [...nextPlayer.battle];
        const unmounted = { ...rider, mountedOnInstanceId: undefined };
        battle[idx] = unmounted;
        nextPlayer = { ...nextPlayer, battle };
        if (cardHasGrantKeyword(rider.cardId, "no_strike_after_rideoff")) {
          nextPlayer = applyNoStrikeAfterRideOff(nextPlayer, rider.instanceId);
        }
        nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
        const rc = resolveRidingComboOnRideOff(nextState, playerId, unmounted);
        nextState = {
          ...rc.state,
          log: [...nextState.log, ...rc.logs],
        };
      }

      const opened = action.rideOff
        ? openBattleEntryOrRideOffChoice(nextState, pending.battleEntry)
        : afterEnterBattle(nextState, pending.battleEntry);
      const detail = action.rideOff ? "ride_off" : "stay_mounted";
      return ok(opened, buildSimpleLogEntry(playerId, "resolve_ride_off_choice", detail));
    }

    case "hold_for_wing": {
      if (state.phase !== "battle") return fail("wrong_phase");
      const held = applyHoldForWing(state, playerId, action.instanceId);
      if (!held) return fail("illegal_action");
      return ok(held, buildSimpleLogEntry(playerId, "hold_for_wing", action.instanceId));
    }

    case "cancel_wing_hold": {
      if (state.phase !== "battle") return fail("wrong_phase");
      const released = applyCancelWingHold(state, playerId, action.instanceId);
      if (!released) return fail("illegal_action");
      return ok(released, buildSimpleLogEntry(playerId, "cancel_wing_hold", action.instanceId));
    }

    case "battle": {
      if (state.phase !== "battle") return fail("wrong_phase");
      // RS-167 の追加アタック権はこのアタックで使う（勝てばまた得る）。
      const bakiBakiExtra = hasBakiBakiExtraAttackOnly(state, playerId, action.attackerInstanceId);
      state = clearBakiBakiExtraAttack(state, playerId, action.attackerInstanceId);
      if (state.pendingBattle) return fail("pending_battle");
      if (
        state.pendingBattleEntry &&
        action.attackerInstanceId !== state.pendingBattleEntry.instanceId
      ) {
        return fail("pending_battle_entry");
      }

      const enemyId = opponent(playerId);
      const actor = state.players[playerId];

      const attackerFound =
        findInZone(actor, "battle", action.attackerInstanceId) ??
        findInZone(actor, "rush", action.attackerInstanceId);
      if (!attackerFound) return fail("attacker_not_in_battle");
      const wingAttackFromRush = !!findInZone(actor, "rush", action.attackerInstanceId);
      if (
        wingAttackFromRush &&
        !canWingAttackFromRush(state, playerId, attackerFound.card)
      ) {
        return fail("wing_attack_not_allowed");
      }
      if (!bakiBakiExtra && battleActBlocked(actor, attackerFound.card, "attack")) return fail("already_acted");
      if (cannotAttackOrStrikeThisTurn(actor, attackerFound.card)) {
        return fail("cannot_attack_turn_rushed");
      }
      if (unitCannotInitiateAttack(attackerFound.card.cardId)) {
        return fail("cannot_attack");
      }

      const enemy = state.players[enemyId];
      const defenderFound =
        findInZone(enemy, "battle", action.defenderInstanceId) ??
        findInZone(enemy, "rush", action.defenderInstanceId);
      if (!defenderFound) return fail("defender_not_found");
      if (
        !canAttackDefender(
          state,
          playerId,
          action.attackerInstanceId,
          enemyId,
          action.defenderInstanceId,
          canAttackRushWithYellowThunder,
        )
      ) {
        return fail("invalid_target");
      }

      const miragePrep = prepareMirageBeamForBattle(
        state,
        playerId,
        attackerFound.card.cardId,
      );
      let battleState = miragePrep.state;
      // RS-131【ミラージュビーム】「このユニットがバトルするとき」— アタックされたときも山札をめくる（faq-card-3 RS-131 Q1）。
      const defenderMirage = prepareMirageBeamForBattle(battleState, enemyId, defenderFound.card.cardId);
      battleState = defenderMirage.state;
      battleState = {
        ...battleState,
        ...updatePlayer(
          battleState,
          playerId,
          markUnitBattleAction(battleState.players[playerId], action.attackerInstanceId, "attack"),
        ),
      };
      // ルール: R-CTR-03 — 「アタックするとき、相手はカウンターを発動できない」はアタック処理の終わりまで続く。
      if (attackerBlocksDefenderCounters(battleState, playerId, action.attackerInstanceId)) {
        battleState = { ...battleState, counterLockedPlayerId: enemyId };
      }

      const pending: PendingBattle = {
        attackerPlayerId: playerId,
        attackerInstanceId: action.attackerInstanceId,
        defenderPlayerId: enemyId,
        defenderInstanceId: action.defenderInstanceId,
        phasePlayerId: playerId,
        mirageBeamBpOverride: miragePrep.bpOverride,
        mirageBeamDiscard: miragePrep.revealedCard,
        mirageBeamDefenderBpOverride: defenderMirage.bpOverride,
        mirageBeamDefenderDiscard: defenderMirage.revealedCard,
      };

      // ルール: RS-019 超力／RK-186【Jパンチ】 — アタックするとき、ホールドするコマンドの数をアタックした
      // プレイヤーが選ぶ（0〜リリース数）。新たにホールドした数だけ BP+1000（rules/attackHoldBonus.ts）。
      const holdChoice = openAttackHoldChoice(battleState, {
        battle: pending,
        wingAttackFromRush,
        sources: listAttackHoldSources(battleState, playerId, attackerFound.card),
      });
      if (holdChoice) {
        return ok(holdChoice, buildSimpleLogEntry(playerId, "attack_hold_choice", action.attackerInstanceId));
      }
      return continueAttackAfterDeclaration(battleState, pending, wingAttackFromRush);
    }

    case "battle_dance_retreat": {
      if (state.phase !== "battle") return fail("wrong_phase");
      if (!hasOperationEffect(player, "battle_dance", state.definitions)) {
        return fail("illegal_action");
      }

      const commandIds = action.commandInstanceIds;
      if (!commandIds || commandIds.length !== 2) {
        return fail("invalid_command_payment");
      }
      const uniqueCommandIds = new Set(commandIds);
      if (uniqueCommandIds.size !== 2) return fail("invalid_command_payment");

      let nextPlayer = player;
      for (const commandInstanceId of commandIds) {
        const cmdFound = findInZone(nextPlayer, "command", commandInstanceId);
        if (!cmdFound || cmdFound.card.commandHeld) {
          return fail("invalid_command_payment");
        }
        const command = nextPlayer.command.map((c) =>
          c.instanceId === commandInstanceId
            ? { ...c, commandHeld: true, mothershipHold: false }
            : c,
        );
        nextPlayer = { ...nextPlayer, command };
      }

      const found = findInZone(nextPlayer, "battle", action.battleInstanceId);
      if (!found || !isSmallUnit(state.definitions, found.card.cardId)) {
        return fail("invalid_target");
      }

      const [, battle] = removeAt(nextPlayer.battle, found.index);
      nextPlayer = markBattleBlocked(
        { ...nextPlayer, battle, rush: [...nextPlayer.rush, found.card] },
        found.card.instanceId,
      );

      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };
      nextState = tryLegend3BattleToRush(nextState, playerId, found.card, playerId);
      return ok(
        nextState,
        buildLogEntry(playerId, "battle_dance", "RS-003", state.definitions),
      );
    }

    case "shiron_light": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const nextState = startShironLightChoice(
        state,
        playerId,
        action.operationInstanceId,
      );
      if (!nextState) return fail("illegal_action");
      return ok(
        nextState,
        buildLogEntry(playerId, "shiron_light", "RS-013", state.definitions, "start"),
      );
    }

    case "hidora_egg": {
      if (state.phase !== "rush") return fail("wrong_phase");
      if (!hasOperationEffect(player, "hidora_egg", state.definitions, { state, playerId })) {
        return fail("illegal_action");
      }
      if (isHidoraEggUsed(player)) return fail("already_used");

      const result = resolveHidoraEgg(state, playerId);
      const nextPlayer = addRushPhaseRuleModifier(result.state.players[playerId], RUSH_PHASE_RULE_IDS.HIDORA_EGG, {
        sourceCardId: "RS-071",
      });
      return ok(
        { ...result.state, ...updatePlayer(result.state, playerId, nextPlayer) },
        hidoraEggLog(playerId, result.detail, state.definitions),
      );
    }

    case "activate_resident_operation": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const op = player.operation.find(
        (card) => card.instanceId === action.operationInstanceId,
      );
      if (!op) return fail("illegal_action");
      const result = applyActivateResidentOperation(
        state,
        playerId,
        action.operationInstanceId,
      );
      if (!result.ok) return fail("illegal_action");
      return ok(
        result.state,
        buildLogEntry(
          playerId,
          "activate_resident_operation",
          op.cardId,
          state.definitions,
        ),
      );
    }

    case "activate_field_unit_ability": {
      if (state.phase !== "rush" && state.phase !== "battle") return fail("wrong_phase");
      const unit =
        player.rush.find((c) => c.instanceId === action.unitInstanceId) ??
        player.battle.find((c) => c.instanceId === action.unitInstanceId);
      if (!unit) return fail("illegal_action");
      const activated = activateFieldAbility(state, playerId, action.unitInstanceId);
      if (activated) {
        return ok(
          activated,
          buildLogEntry(playerId, "activate_field_unit_ability", unit.cardId, state.definitions),
        );
      }
      if (state.phase !== "rush") return fail("wrong_phase");
      const withChoice = beginKamenRideDeploy(state, playerId, action.unitInstanceId);
      if (!withChoice) return fail("illegal_action");
      return ok(
        withChoice,
        buildLogEntry(playerId, "activate_field_unit_ability", unit.cardId, state.definitions),
      );
    }

    case "end_phase": {
      if (state.phase === "start") {
        return fail("illegal_action");
      }

      if (state.phase === "end") {
        return finishTurnEnd({ ...state, endPhaseStep: undefined }, playerId);
      }

      const nextState: GameState = {
        ...advancePhase(state),
        endPhaseStep: advancePhase(state).phase === "end" ? "end_effects" : undefined,
      };
      if (nextState.phase === "end") {
        const withMenu = tryOpenEndTurnEffectsMenu(nextState, playerId);
        if (withMenu) {
          return ok(
            { ...withMenu, endPhaseStep: "end_effects" },
            buildSimpleLogEntry(playerId, "end_phase", state.phase),
          );
        }
        return withEndPhaseAutoFinalize(
          ok(
            { ...nextState, endPhaseStep: "finalize" },
            buildSimpleLogEntry(playerId, "end_phase", state.phase),
          ),
          playerId,
        );
      }

      return ok(
        nextState,
        buildSimpleLogEntry(playerId, "end_phase", state.phase),
      );
    }

    default:
      return fail("unknown_action");
  }
}

export function applyActions(
  state: GameState,
  actions: GameAction[],
): ActionResult {
  let current = state;
  for (const action of actions) {
    const result = applyAction(current, action);
    if (!result.ok) return result;
    current = result.state;
  }
  return { ok: true, state: current };
}
