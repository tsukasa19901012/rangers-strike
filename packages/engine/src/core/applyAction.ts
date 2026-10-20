import { activateXg6HandEffect, applyXg6AfterAction, applyXg6OnBattleStart, openXg6OnCharged, applyXg6StrikeDamageTriggers, endXg6BattlePhase, openXg6OnAttacked, openXg6OnStrike, takeXg6BattlePhaseEnd } from "../rules/xg6/xg6Hooks";
import { noteEngineSideEffect } from "./sideEffects";
import {
  applyXg7RushCounter,
  consumeXg7NextCardCost,
  isXg7AttackedChoice,
  isXg7RushCounterCard,
  isXg7StrikeChoice,
  openXg7OnAttacked,
  openXg7OnSelfRushFromZone,
  openXg7OnStrike,
  resolveXg7Attacked,
  resolveXg7Strike,
  skipXg7Attacked,
  skipXg7Strike,
} from "../rules/xg7/xg7Effects";
import { payMirrorWorldSelection } from "../rules/mirrorWorldSelection";
import { memoizeInSearch } from "./searchCache";
import { isInstancePlacedAnywhere } from "./helpers";
import { rk6RecordSnakeSelected } from "../rules/rk/rk6Fields";
import { rk6SideBasherOnEntry } from "../rules/rk/rk6UnitEffects";
import { applyRk7AfterAction, openRk7LocustReplace } from "../rules/rk/rk7UnitEffects";
import { openRk11UndeadReplace } from "../rules/rk/rk11UnitEffects";
import { rk11IsHandSubstitute } from "../rules/rk/rk11Fields";
import { rk12PlacesHeldOnRush } from "../rules/rk/rk12Fields";
import { openRk12GorgomWindow, trackRk12UnitHolds } from "../rules/rk/rk12UnitEffects";
import { xg1dTrackHandDiscards } from "../rules/xg1/xg1dEffects";
import { isXg1eAttackedChoice, openXg1eAttacked, resolveXg1eAttacked, skipXg1eAttacked, xg1eAfterAction } from "../rules/xg1/xg1eEffects";
import { applyRk13AfterAction } from "../rules/rk/rk13UnitEffects";
import { applyRk8AfterAction } from "../rules/rk/rk8UnitEffects";
import { applyRk10AfterAction, rk10CraneDeclined, rk10CraneIntercept, runRk10OnRush } from "../rules/rk/rk10UnitEffects";
import { rk10WolfBlocks } from "../rules/rk/rk10Fields";
import {
  applyRk9AfterAction,
  applyRk9RuriOokami,
  isRk9BattleCounterCard,
  isRk9BerryChoice,
  openRk9Berry,
  openRk9HachiAtRushEnd,
  resolveRk9BerryPick,
  rk9RecordAttack,
  skipRk9Berry,
} from "../rules/rk/rk9UnitEffects";
import { isRk5BattleCounterCard, openRk5GuardVent, rk5GuardVentCost, rk5TigerBomberDestroy, rk5TigerBomberDestroys, rk5TigerBomberPenalty } from "../rules/rk/rk5UnitEffects";
import { openRk3OnEnemyRush } from "../rules/rk/rk3UnitEffects";
import { applyRk2StrikeDamageTriggers, rk2RecordStartRelease } from "../rules/rk/rk2UnitEffects";
import { continueFieldAbilityAfterLeave } from "../rules/fieldActivatedAbilities";
import { resumeAbductionAfterChase } from "../rules/abduction";
import { applyKyouryuumaru, canUseKyouryuumaru, filthyAirActive } from "../rules/legend1/otherLinesNamedEffects";
import { currentShuffleEpoch } from "./deckShuffle";
import { hasActiveEngineRng, runWithStateRng } from "./rng";
import { applySwordTornadoAfterShuffle } from "../rules/legend1/set8NamedEffectsC";
import {
  applySet7AStrikeCounter,
  applySet7AStrikeDamageTriggers,
  openPowerUnitToHandAfterPlace,
  set7AStrikeCounterIds,
} from "../rules/legend1/set7NamedEffectsA";
import { activateSet8BHandEffect, openKeyHolderWishDraw, settleGuardianApostleProviso } from "../rules/legend1/set8NamedEffectsB";
import { openKibaShotIfReady, queueKibaShot } from "../rules/legend1/set6AuditFixes";
import { icyStateForAction, isIcyPhantom, settleIcyPhantoms } from "../rules/legend1/icyLastResort";
import { applySpecialExtinguisher, beginLionArmor, lionArmorAvailable, openDaidenjinBoomerangIfReady, openPantherClawIfReady, queueDaidenjinBoomerang, queuePantherClaw, settleDarkArmor } from "../rules/legend1/set6NamedEffects348";
import { settleResolvingOperations, trackResolvingOperations } from "../rules/resolvingOperations";
import {
  applyRk1BattleCounterEffect,
  applyRk1HumanEvolution,
  isRk1BattleCounterCard,
  isRk1LeaveCounterCard,
  rk1MissionMemoryOnEntry,
  rk1PayAttackCommandCost,
  rk1ThirdEyeIntercept,
  settleRk1AfterAction,
} from "../rules/rk/rk1NamedEffects";
import { withEffectiveRushConditionDefinitions } from "../rules/rushAdditionalCondition";
import { holdPlacedCommandUnderMaChikara } from "../rules/srEffects";
import { openReorderEnemyBattle } from "../rules/legend1/set6NamedEffectsB";
import { openBlueMoonSlash, openChargeInsteadOfBattle } from "../rules/legend1/set7NamedEffectsB";
import { withZordFeatureContext } from "../rules/zordFeatureContext";
import { applySet8AAfterAction, applyThunderboltSword, isSet8AResident } from "../rules/legend1/set8NamedEffectsA";
import { applySet7DStrikeDamageTriggers, RIDE_OFF_RC_MARK, rideOffBlockedBySet7D } from "../rules/legend1/set7NamedEffectsD";
import { applyFatalBladeDraws, applySet5StrikeDamageTriggers } from "../rules/legend1/set5AuditFixes";
import {
  applyGiantBombCounter,
  closeGiantBombWindow,
  openGiantBombWindow,
  openRoundRadarIfReady,
  queueRoundRadar,
  settleStackedCards,
} from "../rules/legend1/set5NamedEffectsA";
import { finalizeEffectRush } from "../events/emitUnitRushed";
import { applyMagiPunchCounter, isSet4EndTurnEffect, magiPunchCounterIds } from "../rules/legend1/set4NamedEffects";
import {
  applyDekaMasterReturn,
  applyMagiMotherSubstitute,
  finishMagiTicketStaging,
  settleMagiTicket,
  stageMagiTicket,
} from "../rules/legend1/set5NamedEffects";
import { rushAdditionalConditionApplies } from "../rules/bkOperationTurnRules";
import { applyDeusGeneOnRush } from "../rules/rs4NcEffects";
import type { GameAction } from "../types/actions";
import type { GameState, PendingBattle, PendingStrike, PlayerId, PlayerState, CardInstance } from "../types/game";
import { hasTurnRuleModifier, TURN_RULE_IDS } from "./scopedModifiers";
import { clearRegisterHoldOffField } from "../rules/resist";
import { operationFizzles } from "../rules/operationFizzle";
import { hasPendingPromptBlockingEffectRush, openDeferredRushReaction } from "../events/emitUnitRushed";
import {
  getBattleEntryHoldCount,
  getCardEffect,
  listZordFusionPartnerIds,
  needsBattleEntryHandDiscard,
} from "@rangers-strike/cards";
import { COMMAND_ZONE_MAX } from "../types/game";
import { checkWinner, advancePhase } from "./createGame";
import { drainDeferredDestroyTriggers } from "../rules/destroyTriggerQueue";
import { drainQueuedFieldLeaves } from "../rules/fieldLeaveQueue";
import { applyStrikeDamageDealtDslTriggers } from "../rules/strikeDamageTriggers";
import { applyRk16StrikeDamageTriggers } from "../rules/rk/rk16UnitEffects";
import { applyXg2AfterAction, applyXg2BattleCounter, applyXg2BattlePhaseEnd, applyXg2StrikeDamageTriggers, isXg2ActivatableResident, isXg2BattleCounterCard, openXg2OnBattlePhaseStart, xg2RejectsOperationTarget } from "../rules/xg2/xg2Effects";
import { applyRm1AfterAction, applyRm1DolFire, applyRm1LeaveCounter, applyRm1StrikeDamageTriggers, isRm1LeaveCounterCard } from "../rules/rm/rm1Effects";
import {
  applyXg4AfterAction,
  applyXg4BattleCounter,
  applyXg4RideOff,
  isXg4BattleCounterCard,
  isXg4BeforeBattleChoice,
  confirmXg4BeforeBattle,
  openXg4OnStrike,
  openXg4BattlePhaseStart,
  openXg4BeforeBattle,
  resolveXg4BeforeBattle,
  skipXg4BeforeBattle,
} from "../rules/xg4/xg4Effects";
import { applyRm2AfterAction, rm2CyberianOnEntry } from "../rules/rm/rm2Effects";
import { activateXg5HandEffect, applyXg5AfterAction, applyXg5StrikeResolved, openXg5Attacked } from "../rules/xg5/xg5Effects";
import { openXg1aStrikeReplacement } from "../rules/xg1/xg1aEffects";
import { openXg1bSakanamaru, xg1bOnAttackDeclared } from "../rules/xg1/xg1bEffects";
import { xg1cBlackFangOnRide, xg1cOnAttackDeclared } from "../rules/xg1/xg1cEffects";
import { applyRm3AfterAction, isRm3TentrinaChoice, openRm3Tentrina, resolveRm3Tentrina, rm3GunGibsonOnEntry, skipRm3Tentrina } from "../rules/rm/rm3Effects";
import { rk16NoteStrike } from "../rules/rk/rk16Fields";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
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
import { isLegalAction, isLegalActionBase, withUniqueExtraCommandHolds } from "./legalActions";
import { completeDeferredPowerFlip, resolveDamagePaymentSelect, startNextQueuedDamage } from "../rules/damagePayment";
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
  DIONE_WALL_EFFECT_ID,
  openDioneWallChoice,
  resolveDioneWallPick,
  openMachineEmpireChoice,
  resolveMachineEmpirePick,
  skipMachineEmpireChoice,
} from "../rules/machineEmpire";
import { applyResidentOpOnPlace } from "../rules/residentOps";
import { applySelfRushFromZone, battleActBlocked, markUnitBattleAction } from "../rules/keywordGapRuntime";
import { applyStartPhaseBeginEffects } from "../rules/startPhaseBegin";
import { emitStrikeDeclared } from "../events/emitStrikeDeclared";
import { openBunshinIfReady, queueBunshinOnAction } from "../rules/legend1/set7NamedEffectsC";
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
import { applyGodomSenshoDiscardPay, godomDeclarationError } from "../rules/godomRushPay";
import { activateSet9AResident, isSet9AResidentCard, settleSet9AAfterAction, settleSet9ATurnEnd } from "../rules/legend1/set9NamedEffectsA";
import { openCastTransferOnCharge } from "../rules/legend1/set9NamedEffectsD";
import { openMegaCaptureIfReady, queueMegaCapture } from "../rules/legend1/set9NamedEffectsB";
import { settleStackOntoLargeCards } from "../rules/stackOntoLargeUnit";
import { trackSpIncomeEntries } from "../rules/legend1/set9NamedEffectsC";
import { trackZenibombEntries } from "../rules/rushAreaEntries";
import { applyMeeMegaloAfterAction, openTakeTheBlowChoice, resolveTakeTheBlow, skipTakeTheBlow, TAKE_THE_BLOW_EFFECT_ID } from "../rules/legend1/set8NamedEffectsD";
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
  splitExtraHoldPayment,
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
  rideNeedsCommandHold,
  extractMountedVehicleFromRush,
  holdCommandForGaleoPulsarRide,
} from "../keywords/ride";
import {
  beginMorphUnitSelection,
  passMorphReaction,
  resumeMorphAfterEntry,
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
  canPlayHandCounter,
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
import { beginKamenRideDeploy } from "../rules/riderKickEffects";
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
  // RS-583【災いを受け止める覚悟】: アタックの対象に選ばれた他の自軍ユニットの代わりに、このユニットが選ばれたことにしてもよい
  // （対象を選んだ時点。rules/legend1/set8NamedEffectsD.ts）。
  const takeTheBlow = openTakeTheBlowChoice(battleState, pending, wingAttackFromRush);
  if (takeTheBlow) {
    let pendingState = takeTheBlow;
    if (battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId) {
      pendingState = { ...pendingState, pendingBattleEntry: undefined };
    }
    return ok(pendingState, buildSimpleLogEntry(playerId, "battle_pending"));
  }
  if (!pending.onAttackResolved && !pending.tigerBomberApplied) {
    // RK-101 タイガーロイド【タイガーボンバー】: アタックするとき、バトルの前に BP-3000（BP0 以下なら撃破し、バトルは行わない）。
    const penalty = rk5TigerBomberPenalty(battleState, pending);
    if (penalty > 0) {
      if (rk5TigerBomberDestroys(battleState, pending, pending.attackerBpBonus ?? 0)) {
        let destroyed = rk5TigerBomberDestroy(battleState, pending);
        if (destroyed.pendingBattleEntry?.instanceId === pending.attackerInstanceId) destroyed = { ...destroyed, pendingBattleEntry: undefined };
        return ok(destroyed, buildLogEntry(playerId, "battle", pending.attackerInstanceId, battleState.definitions, "rk101_tiger_bomber_destroyed"));
      }
      return continueAttackAfterDeclaration(
        battleState,
        { ...pending, tigerBomberApplied: true, attackerBpBonus: (pending.attackerBpBonus ?? 0) - penalty },
        wingAttackFromRush,
      );
    }
  }
  if (!pending.onAttackResolved) {
    // ルール: R-TIME-01 — 「アタックするとき／アタックしたとき」（アタックしたユニットの DSL on_attack）は、
    // 「アタックされたとき」（RS-215・カウンター窓）より先に解決する。選択が開けば、それを解決してから続ける。
    const marked: PendingBattle = { ...pending, onAttackResolved: true };
    const attacker = battleState.players[playerId];
    const found =
      findInZone(attacker, "battle", pending.attackerInstanceId) ??
      findInZone(attacker, "rush", pending.attackerInstanceId);
    let afterOnAttack = battleState;
    if (found) {
      const fx = tryResolveDslTriggeredEffects({
        state: battleState,
        cardId: found.card.cardId,
        instanceId: pending.attackerInstanceId,
        playerId,
        phasePlayerId: pending.phasePlayerId,
        triggerType: "on_attack",
      });
      afterOnAttack = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
      // RS-529【電撃剣スーパーサンダーボルト】「これがアタックまたはストライクしたとき」（DSL は on_strike だけ）。
      afterOnAttack = applyThunderboltSword(afterOnAttack, playerId, found.card.cardId);
    }
    if (afterOnAttack.pendingEffectChoice && afterOnAttack.pendingEffectChoice !== battleState.pendingEffectChoice) {
      let parked: GameState = { ...afterOnAttack, deferredAttack: { battle: marked, wingAttackFromRush } };
      if (parked.pendingBattleEntry?.instanceId === pending.attackerInstanceId) {
        parked = { ...parked, pendingBattleEntry: undefined };
      }
      return ok(parked, buildSimpleLogEntry(playerId, "battle_pending"));
    }
    return continueAttackAfterDeclaration(afterOnAttack, marked, wingAttackFromRush);
  }
  // XG5-056【捨て身の一撃】: 敵軍 S ユニットにアタックされたとき（rules/xg5/xg5cEffects.ts）。続きは deferredAttack で待たせる。
  const xg5Attacked = openXg5Attacked(battleState, pending, wingAttackFromRush);
  if (xg5Attacked) {
    const parked = xg5Attacked.pendingBattleEntry?.instanceId === pending.attackerInstanceId ? { ...xg5Attacked, pendingBattleEntry: undefined } : xg5Attacked;
    return ok(parked, buildSimpleLogEntry(playerId, "xg5_attacked_choice"));
  }
  // RK-175【ライダーキック】の「これがアタックしなかったとき」のためのアタックの記録（rules/rk/rk9UnitEffects.ts）。
  battleState = rk9RecordAttack(battleState, pending);
  // XG4-033【フリージングダガー】: アタックするとき、バトルの前にバトル相手を持ち主のパワーゾーンに送ってもよい（rules/xg4/xg4bEffects.ts）。
  const xg4Before = openXg4BeforeBattle(battleState, pending, wingAttackFromRush);
  if (xg4Before) {
    const parked = battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId ? { ...xg4Before, pendingBattleEntry: undefined } : xg4Before;
    return ok(parked, buildSimpleLogEntry(playerId, "xg4033_freezing_dagger_choice"));
  }
  // RK-188 ベリー【地空人のエージェント】: 敵軍ターン中、自軍 S ユニットがアタックされたとき（rules/rk/rk9UnitEffects.ts）。
  const berry = openRk9Berry(battleState, pending, wingAttackFromRush);
  if (berry) {
    const parked = battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId ? { ...berry, pendingBattleEntry: undefined } : berry;
    return ok(parked, buildSimpleLogEntry(playerId, "rk188_agent_choice"));
  }
  // RM-062 テントリーナ【リーナステッキ】: 敵軍ターン中、「女」の自軍ユニットが「男」のユニットにアタックされたとき（rules/rm/rm3Effects.ts）。
  const tentrina = openRm3Tentrina(battleState, pending, wingAttackFromRush);
  if (tentrina) {
    const parked = battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId ? { ...tentrina, pendingBattleEntry: undefined } : tentrina;
    return ok(parked, buildSimpleLogEntry(playerId, "rm062_lina_stick_choice"));
  }
  // XG7-055【神出鬼没の疾風】: 敵軍ターン中、自軍 S ユニットがアタックされたとき、コマンドゾーンのこれと置き換える（rules/xg7/xg7Effects.ts）。
  const xg7Attacked = openXg7OnAttacked(battleState, pending, wingAttackFromRush);
  if (xg7Attacked) {
    const parked = battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId ? { ...xg7Attacked, pendingBattleEntry: undefined } : xg7Attacked;
    return ok(parked, buildSimpleLogEntry(playerId, "xg7055_cyclone_gale_choice"));
  }
  // XG1-084【人質と脅迫】（アタックした相手が手札を1枚捨札にする）・XG1-087【瞬間移動】（rules/xg1/xg1eEffects.ts）。
  const xg1eAttacked = openXg1eAttacked(battleState, pending, wingAttackFromRush);
  if (xg1eAttacked) {
    const parked = battleState.pendingBattleEntry?.instanceId === pending.attackerInstanceId ? { ...xg1eAttacked, pendingBattleEntry: undefined } : xg1eAttacked;
    return ok(parked, buildSimpleLogEntry(playerId, "xg1e_attacked_choice"));
  }
  // XG6-019【奥の手】・XG6-005【マジカルショータイム】（アタックするとき・アタックされたとき。rules/xg6/xg6Hooks.ts）。
  // XG6-051【絶望の進化】: バトル開始時（rules/xg6/xg6cEffects.ts）。
  battleState = applyXg6OnBattleStart(battleState, pending);
  const xg6Attacked = openXg6OnAttacked(battleState, pending, wingAttackFromRush);
  if (xg6Attacked) return ok(xg6Attacked, buildSimpleLogEntry(playerId, "battle_pending"));
  // RS-215【不滅のマシン帝国】: メカの自軍ユニットがアタックされたとき、手札2枚を捨札にしてバトルを行わなくてもよい。
  const machineEmpire = openMachineEmpireChoice(battleState, pending, wingAttackFromRush);
  // RS-414【ディオネを守る壁】: 冥府神の自軍ユニットがアタックされたとき、常駐を捨札にしてバトルを行わなくてもよい。
  const dioneWall = machineEmpire ? null : openDioneWallChoice(battleState, pending, wingAttackFromRush);
  if (machineEmpire || dioneWall) {
    let pendingState = (machineEmpire ?? dioneWall)!;
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
 * チャージフェイズでパワーゾーンにカードを置いたときの効果（RS-673）をすべて解決したら、ラッシュフェイズに進む。
 * 効果でラッシュエリアに出したユニットの「ラッシュしたとき」・「ラッシュされたとき」の窓もチャージフェイズのうちに処理する。
 */
function settleChargeAdvance(state: GameState): GameState {
  const deferred = state.chargeAdvanceDeferred;
  if (!deferred || state.winner) return state;
  if (state.phase !== "charge") return { ...state, chargeAdvanceDeferred: undefined };
  if (hasBlockingInteraction(state) || state.pendingEffectRush || state.effectRushTriggerQueue?.length || state.deferredRushReaction) return state;
  const { chargeAdvanceDeferred: _d, ...rest } = state;
  return withWinner(advancePhase({ ...(rest as GameState), activePlayer: deferred.playerId }));
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
  // RS-613【ダイヤソード】: ターンを終えるときのホールド（【潜水】等）でも発動する（rules/legend1/set9NamedEffectsA.ts）。
  const diamondSword = settleSet9ATurnEnd(afterEffects);
  if (diamondSword.pendingEffectChoice) return withWinner(diamondSword);

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

  if (next.phase === "start" && (next.activePlayer !== prevPlayer || next.turn !== afterEffects.turn)) {
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
  // ルール: R-TIME-01 — 「ストライクしてダメージを与えたとき」はダメージを与えたあと（DSL: RS-686 等、RS-309【ゴウライキャノン】）。
  resolved = applyStrikeDamageDealtDslTriggers(resolved, pending);
  resolved = applySet5StrikeDamageTriggers(resolved, pending);
  // RS-514【大狼狼蹴】: 相手が山札の上からひいたカードをダメージにしたとき（rules/legend1/set7NamedEffectsD.ts）。
  const defenderId = opponent(pending.strikerPlayerId);
  const deckDraws = state.players[defenderId].deck.length - nextState.players[defenderId].deck.length;
  resolved = applySet7DStrikeDamageTriggers(resolved, pending, deckDraws);
  // RS-434 ライフバード（※常駐。rules/legend1/set7NamedEffectsA.ts）。
  resolved = applySet7AStrikeDamageTriggers(resolved, pending);
  // RK-041 ジェノサイダー【ドゥームズデイ】（rules/rk/rk2UnitEffects.ts）。
  resolved = applyRk2StrikeDamageTriggers(resolved, pending);
  // RK-320【ファイナルライジングブラスト】（敵軍ターン中、ストライクを2回以上されてダメージを受けたとき。rules/rk/rk16UnitEffects.ts）。
  resolved = applyRk16StrikeDamageTriggers(resolved, pending);
  // RM-009 マルチパック（重ねたユニットがストライクしてダメージを与えたとき。rules/rm/rm1Effects.ts）。
  resolved = applyRm1StrikeDamageTriggers(resolved, pending);
  // クロスギャザー XG5 のストライクしたときの効果（rules/xg5/xg5Effects.ts）。
  resolved = applyXg5StrikeResolved(resolved, pending);
  // XG6-025【ここからは私のターンだ】・XG6-042【ゼロのスタート】（rules/xg6/xg6bEffects.ts）。
  resolved = applyXg6StrikeDamageTriggers(resolved, pending);
  // XG2-016 天空気殿【天空大風車】で得た能力（rules/xg2/xg2Effects.ts）。
  resolved = applyXg2StrikeDamageTriggers(resolved, pending);

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

/**
 * 「ストライクしたとき」の効果のあと: 「ストライクされたとき」（RS-196【迎撃モビルミサイル】・カウンター窓）→ ダメージ。
 * ルール: R-TIME-01 — 能動（したとき）が受動（されたとき）より先。
 */
function continueStrikeAfterDeclaration(
  state: GameState,
  nextState: GameState,
  pending: PendingStrike,
  strikerInstanceId: string,
): ActionResult {
  const playerId = pending.strikerPlayerId;
  const damage = pending.damage;
  // XG6-019【奥の手】（敵軍ユニットがストライクをするとき。rules/xg6/xg6Hooks.ts）。
  const xg6Strike = openXg6OnStrike(nextState, pending);
  if (xg6Strike) {
    const parked = state.pendingBattleEntry?.instanceId === strikerInstanceId ? { ...xg6Strike, pendingBattleEntry: undefined } : xg6Strike;
    return ok(parked, buildSimpleLogEntry(playerId, "strike_pending", String(damage)));
  }
  // RS-196 ダイナモビル【迎撃モビルミサイル】: ストライクされたとき発動できる（任意）。
  // XG7-067 シンクレッダー ※（コマンドゾーンのこれを捨札にしてストライクを無効にする。rules/xg7/xg7Effects.ts）。
  const mobil = openMobilMissileChoice(nextState, pending) ?? openXg7OnStrike(nextState, pending);
  if (mobil) {
    const cleared =
      state.pendingBattleEntry?.instanceId === strikerInstanceId ? { ...mobil, pendingBattleEntry: undefined } : mobil;
    return ok(cleared, buildSimpleLogEntry(playerId, "strike_pending", String(damage)));
  }

  const defenderId = opponent(playerId);
  if (hasStrikeReactions(nextState, defenderId, pending)) {
    let withWindow: GameState = {
      ...nextState,
      pendingStrike: pending,
      activePlayer: defenderId,
    };
    if (state.pendingBattleEntry?.instanceId === strikerInstanceId) {
      withWindow = { ...withWindow, pendingBattleEntry: undefined };
    }
    return ok(withWindow, buildSimpleLogEntry(playerId, "strike_pending", String(damage)));
  }

  return completeStrike(nextState, pending);
}

/** R-TIME-01: 「アタックしたとき」の選択が解決し終えたら、待たせていたアタックの続き（「アタックされたとき」→ バトル）を処理する。 */
function continueDeferredAttack(state: GameState): GameState {
  const deferred = state.deferredAttack;
  if (!deferred || state.winner) return state;
  if (state.pendingEffectChoice || state.pendingDamagePayment || state.pendingLeave || state.pendingRegister) {
    return state;
  }
  const cleared: GameState = {
    ...state,
    deferredAttack: undefined,
    activePlayer: deferred.battle.phasePlayerId,
  };
  const result = continueAttackAfterDeclaration(cleared, deferred.battle, deferred.wingAttackFromRush);
  return result.ok ? result.state : cleared;
}

/** R-TIME-01: 「ストライクしたとき」の選択が解決し終えたら、待たせていたストライクの続きを処理する。 */
function continueDeferredStrike(state: GameState): GameState {
  const pending = state.deferredStrike;
  if (!pending || state.winner) return state;
  if (state.pendingEffectChoice || state.pendingDamagePayment || state.pendingLeave || state.pendingRegister) {
    return state;
  }
  const cleared: GameState = { ...state, deferredStrike: undefined, activePlayer: pending.battlePhasePlayer };
  const result = continueStrikeAfterDeclaration(cleared, cleared, pending, pending.strikerInstanceId);
  return result.ok ? result.state : cleared;
}

/**
 * 「ウラ返すとき」（RS-199【ブレイクアクション】）の選択とその中で開いた選択・反応が終わったら、待たせていた
 * パワーのウラ返し（ダメージ）を行い、ストライクのダメージならストライクの処理を終える（R-TIME-01）。
 */
function continueDeferredPowerFlip(state: GameState): GameState {
  if (!state.deferredPowerFlip || state.winner) return state;
  if (state.pendingEffectChoice || state.pendingDamagePayment || state.pendingLeave || state.pendingRegister) {
    return state;
  }
  const completed = completeDeferredPowerFlip(state);
  if (!completed) return state;
  const { flip } = completed;
  let next = completed.state;
  if (flip.resume.kind === "strike" && flip.finishStrike) {
    const finished = finishStrikeResolution(
      { ...state, deferredPowerFlip: undefined },
      { ...flip.resume.pending, damageApplied: true },
      next,
    );
    if (finished.ok) next = finished.state;
  }
  // 同時に発生して後回しにしたダメージがあれば続けて処理する。
  if ((next.queuedDamagePayments?.length ?? 0) > 0 && !next.pendingDamagePayment) {
    next = startNextQueuedDamage({ ...next, winner: null });
  }
  return { ...next, winner: checkWinner(next) };
}

function completeStrike(state: GameState, pending: PendingStrike, extraLogs: string[] = []): ActionResult {
  // XG1-009【マスキークラッシュ】: ダメージを与えるかわりに敵軍捨札のカードをダメージにするかを選ぶ（rules/xg1/xg1aEffects.ts）。
  const xg1Replace = openXg1aStrikeReplacement(state, pending);
  if (xg1Replace) return ok(xg1Replace, buildSimpleLogEntry(pending.strikerPlayerId, "strike_pending", String(pending.damage)));
  const nextState = finalizeStrike(state, pending);
  if (nextState.pendingDamagePayment || nextState.deferredPowerFlip) {
    return ok(nextState, buildSimpleLogEntry(pending.strikerPlayerId, "strike_pending_damage"));
  }
  return finishStrikeResolution(state, pending, nextState, extraLogs);
}

function operationNeedsUpfrontTarget(cardId: string): boolean {
  const dslEffect = getDslOperationEffect(cardId, "rush");
  if (dslEffect && shouldUseDslOperation(cardId, dslEffect) && dslOperationOpensChoose(dslEffect)) {
    return false;
  }
  // スペシャルメタルエディション（`rm1::`）・ベルトコレクション（`bk1::`）のカード固有の効果は、使ったあとで対象を選ぶ
  // （rules/rm/rm1Effects.ts・rules/bk/bk1Effects.ts）。
  if (
    dslEffect &&
    shouldUseDslOperation(cardId, dslEffect) &&
    dslEffect.effects.some((p) => p.type === "grant_keyword" && (p.keyword.startsWith("rm1::") || p.keyword.startsWith("bk1::") || p.keyword.startsWith("xg5::") || p.keyword.startsWith("xg2::")))
  ) {
    return false;
  }
  // クロスギャザー XG1（`xg1::`）のカード固有の効果も、使ったあとで対象を選ぶ（rules/xg1/xg1Effects.ts）。
  if (dslEffect && shouldUseDslOperation(cardId, dslEffect) && dslEffect.effects.some((p) => p.type === "grant_keyword" && p.keyword.startsWith("xg1::"))) return false;
  // クロスギャザー ザ・ギガンティックタイタン XG6（`xg6::`。rules/xg6/xg6Hooks.ts）も、使ったあとで対象を選ぶ。
  if (dslEffect && shouldUseDslOperation(cardId, dslEffect) && dslEffect.effects.some((p) => p.type === "grant_keyword" && p.keyword.startsWith("xg6::"))) return false;
  // クロスギャザー ザ・ジェットアクセル（`xg4::`）のカード固有の効果も、使ったあとで対象を選ぶ（rules/xg4/xg4Effects.ts）。
  if (dslEffect && shouldUseDslOperation(cardId, dslEffect) && dslEffect.effects.some((p) => p.type === "grant_keyword" && p.keyword.startsWith("xg4::"))) return false;
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
  // RK-053【ガタックバルカン】は、バトルエリアに置いた（置けなかった）あとに発動する（rules/rk/rk3UnitEffects.ts）。
  const vulcan = (s: GameState): GameState =>
    s.pendingCommandPayment || s.pendingEffectChoice ? s : openRk3OnEnemyRush(s, playerId, instanceId, s.activePlayer, true);
  const direct = applyAction(state, { type: "move_to_battle", playerId, instanceId });
  if (direct.ok) return vulcan(direct.state);
  const payment = buildBattleEntryPayment(state, playerId, found.card);
  if (!payment) return vulcan(original);
  if (payment.validInstanceIds.length <= payment.totalNeeded) {
    const paid = applyAction(
      { ...state, pendingCommandPayment: payment },
      {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: payment.validInstanceIds.slice(0, payment.totalNeeded),
      },
    );
    return vulcan(paid.ok ? paid.state : original);
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
        if (beforeIds.has(card.instanceId) || handled.has(card.instanceId) || isIcyPhantom(card)) continue;
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
    // RK-053【ガタックバルカン】も、直接バトルエリアに出された敵軍 S ユニットに発動する（rules/rk/rk3UnitEffects.ts）。
    next = openRk3OnEnemyRush(next, entry.pid, entry.instanceId, turnPlayer);
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

/** applyAction の入れ子の深さ（外側の呼び出しだけで行う後処理のため）。 */
let applyActionDepth = 0;

export function applyAction(
  state: GameState,
  action: GameAction,
  options?: { trustLegality?: boolean },
): ActionResult {
  // CPU の探索の間（core/searchCache.ts）は、入口の呼び出し（入れ子でない applyAction）の結果を状態・アクションごとに使い回す。
  // 結果は状態とアクションだけで決まる（乱数は状態の rngState から作る。イベント ID 等の採番は状態に残らない）。
  if (applyActionDepth !== 0 || hasActiveEngineRng()) return applyActionUncached(state, action, options);
  const key = `apply:${options?.trustLegality ? "T" : ""}${JSON.stringify(action)}`;
  return memoizeInSearch(state, key, () => applyActionUncached(state, action, options));
}

function applyActionUncached(
  state: GameState,
  action: GameAction,
  options?: { trustLegality?: boolean },
): ActionResult {
  // 乱数はゲーム状態の rngState から作り、進めた状態を結果に書き戻す（core/rng.ts）。
  const { value: result, rngState } = runWithStateRng(state, () =>
    applyActionWithRng(state, action, options),
  );
  if (!result.ok || rngState === undefined) return result;
  return { ...result, state: { ...result.state, rngState } };
}

function applyActionWithRng(
  state: GameState,
  action: GameAction,
  options?: { trustLegality?: boolean },
): ActionResult {
  noteEngineSideEffect();
  // RS-359【最後の手段】: 山札の候補をラッシュエリアに置いた状態で、手札からのラッシュの手続きを始める
  // （rules/legend1/icyLastResort.ts。手続きが終わったら settleIcyPhantoms で片付ける）。
  const icyState = applyActionDepth === 0 ? icyStateForAction(state, action, isLegalActionBase) : null;
  // RS-571【ソードトルネード】: このアクションの間に山札がシャッフルされたか（core/deckShuffle.ts）。
  const shuffleEpochAtStart = currentShuffleEpoch();
  if (icyState) state = icyState;
  applyActionDepth += 1;
  let result: ActionResult;
  // 「※このカードの追加条件は、…のとき、次のように変更される」を反映した定義で処理し、結果には元の定義を戻す（RS-440 等）。
  const view = withEffectiveRushConditionDefinitions(state);
  try {
    // 追加条件の素材の特徴（効果・フェイズで追加された特徴）はこの状態で判定する（rules/zordFeatureContext.ts）。
    result = withZordFeatureContext(view, () => applyActionCore(view, action, options));
  } finally {
    applyActionDepth -= 1;
  }
  if (!result.ok) return result;
  if (view !== state && result.state.definitions !== state.definitions) {
    result = { ...result, state: { ...result.state, definitions: state.definitions } };
  }
  // ルール: R-ZONE-04, R-HOLD-02 — エリアを離れたカードの付加情報はどの経路で移動しても消える。
  let next = clearRegisterHoldOffField(result.state);
  next = settleEffectRushes(state, next);
  // R-REPL-04: モーフで出たユニットの「ラッシュしたとき」等の選択が終わったら、モーフの続き（「ラッシュされたとき」・残りのモーフ・カウンター窓）へ。
  if (next.deferredMorphContinuation && !hasPendingPromptBlockingEffectRush(next)) {
    next = resumeMorphAfterEntry(next, next.deferredMorphContinuation);
  }
  // RS-660【SPインカム】: このターン、場の外からラッシュエリアに出たユニットを記録する（rules/legend1/set9NamedEffectsC.ts）。
  next = trackSpIncomeEntries(state, next);
  // RS-110【ゼニボム】: このターン、場の外から相手のラッシュエリアに出たユニットに目印を付ける（rules/rushAreaEntries.ts）。
  next = trackZenibombEntries(state, next);
  // RK-240・RK-247: このターン、ユニットがホールドされたかを記録する（rules/rk/rk12UnitEffects.ts）。
  next = trackRk12UnitHolds(state, next);
  // XG1-063【トルネードチェイサー】: 手札のカードが捨札に置かれたか（いちばん外側のアクションの前後で見る。rules/xg1/xg1dEffects.ts）。
  if (applyActionDepth === 0) next = xg1dTrackHandDiscards(state, next, action);
  // XG1-082【戦士シャイダーの遺産】（捨札になったとき）・XG1-092 の数え上げ（rules/xg1/xg1eEffects.ts）。
  if (applyActionDepth === 0) next = xg1eAfterAction(state, next, action);
  // RK-251 ゴルゴムの仕業を使わなかった: オペレーションの使用（効果の実行）を続ける（rules/rk/rk12UnitEffects.ts）。
  if (next.rk12ResumeOperation && !next.pendingEffectChoice) {
    const op = next.rk12ResumeOperation;
    const resumed = applyAction({ ...next, rk12ResumeOperation: undefined }, { type: "play_operation", ...op }, { trustLegality: true });
    next = resumed.ok
      ? { ...resumed.state, rk12GorgomPassedOp: undefined }
      : { ...next, rk12ResumeOperation: undefined, rk12GorgomPassedOp: undefined };
  }
  // XG1-038【サカナマル】の選択の後: 相手のユニットがまだラッシュエリアにあれば move_to_battle を続ける（rules/xg1/xg1bEffects.ts）。
  if (next.xg1ResumeMove && !next.pendingEffectChoice) {
    const mv = next.xg1ResumeMove;
    const cleared: GameState = { ...next, xg1ResumeMove: undefined, activePlayer: mv.playerId };
    const stillInRush = cleared.players[mv.playerId].rush.some((c) => c.instanceId === mv.instanceId);
    const resumed = stillInRush ? applyAction(cleared, { type: "move_to_battle", ...mv }, { trustLegality: true }) : null;
    next = resumed?.ok ? { ...resumed.state, xg1SakanamaruDone: undefined } : { ...cleared, xg1SakanamaruDone: undefined };
  }
  // 第9弾 RS-607 の続き・RS-613 のホールド待ち（rules/legend1/set9NamedEffectsA.ts）。
  if (applyActionDepth === 0) next = settleSet9AAfterAction(state, next);
  next = releaseCounterLockWhenAttackSettled(next);
  next = trackResolvingOperations(state, next);
  next = settleResolvingOperations(next);
  // RS-582【メー・メガロ】: 自分が使ったカウンターが捨札になったとき（rules/legend1/set8NamedEffectsD.ts）。
  if (applyActionDepth === 0 && "playerId" in action && action.playerId) next = applyMeeMegaloAfterAction(state, next, action.type, action.playerId);
  // 起動効果の「このユニットを捨札にしてもよい。そうしたとき、…」の続き（rules/fieldActivatedAbilities.ts）。
  if (next.pendingFieldAbilityAfterLeave) next = continueFieldAbilityAfterLeave(next);
  // ルール: R-KW-CHASE-01 — チェイス等の応答を待っていた、効果でコマンドゾーン等へ移す残りのカード（rules/fieldLeaveQueue.ts）。
  next = drainQueuedFieldLeaves(next);
  next = continueDeferredPowerFlip(next);
  next = continueDeferredAttack(next);
  next = continueDeferredStrike(next);
  // ルール: R-TIME-01 — 先の段階の効果（選択）が解決し終えたら、待たせていた撃破の誘発を段階の順に解決する。
  next = drainDeferredDestroyTriggers(next);
  // RS-547【守護獣の使徒】ただし書き: 任意の「ラッシュしたとき」の効果を発動したらホールドする（rules/legend1/set8NamedEffectsB.ts）。
  next = settleGuardianApostleProviso(next, action);
  // RS-256 闇の戒律・RS-255 巨大化爆弾: 置き場を離れたら重ねたカードは捨札になる。
  next = settleStackedCards(next);
  // RK-013 Jパワー・RK-010 ハイブリッドエネルギー（rules/rk/rk1NamedEffects.ts）。
  next = settleRk1AfterAction(next);
  // RS-350 暗黒の鎧: 重ねたユニットがユニットでなくなったら、鎧を持ち主のパワーゾーンにダメージにして置く。
  if (applyActionDepth === 0) next = settleDarkArmor(state, next);
  // RS-623【翼合体】・RS-647【ソウルバード】・RS-650 等: 重ねたユニットがユニットでなくなったら、重ねたカードは捨札になる
  // （rules/stackOntoLargeUnit.ts）。
  if (applyActionDepth === 0) next = settleStackOntoLargeCards(state, next);
  // RS-628【メガキャプチャー】: このターン、次に自軍コマンドゾーンにカードが置かれたとき（rules/legend1/set9NamedEffectsB.ts）。
  if (applyActionDepth === 0) next = openMegaCaptureIfReady(queueMegaCapture(state, next));
  // RS-385【特殊消化弾】: 自軍コマンドゾーンにホールド状態で置くカードは、かわりにリリース状態で置く。
  if (applyActionDepth === 0) next = applySpecialExtinguisher(state, next);
  // RS-265【ラウンドレーダー】: 相手が手札からオペレーションを使用したとき（解決が終わってから開く）。
  next = queueRoundRadar(state, next, action);
  next = openRoundRadarIfReady(next);
  // RS-255 巨大化爆弾: 敵軍ターン中に「怪人」の自軍ユニットが撃破されて捨札になったとき。
  next = openGiantBombWindow(state, next);
  next = applyBpZeroRuleDestruction(next);
  // RS-571 デカバイクロボ【ソードトルネード】: 自分か相手の山札がシャッフルされたとき、そのターン中「SP1」になる。
  if (applyActionDepth === 0) next = applySwordTornadoAfterShuffle(next, shuffleEpochAtStart);
  // RK-129【サンダースペイダー】・RK-132【妻子のバックアップ】（rules/rk/rk7UnitEffects.ts）。
  if (applyActionDepth === 0) next = applyRk7AfterAction(state, next, shuffleEpochAtStart);
  // RK-153 仮面ライダーガオウ ※（このターン敵軍ユニットを撃破したかの記録。rules/rk/rk8UnitEffects.ts）。
  if (applyActionDepth === 0) next = applyRk8AfterAction(state, next, turnPlayerOf(state));
  // RK-169【グランドストライク】・RK-184【生命維持プール】（rules/rk/rk9UnitEffects.ts）。
  if (applyActionDepth === 0) next = applyRk9AfterAction(state, next, turnPlayerOf(state));
  // RK-195【再起動と暴走】（rules/rk/rk10UnitEffects.ts）。
  if (applyActionDepth === 0) next = applyRk10AfterAction(state, next, turnPlayerOf(state));
  // RK-260【体内マグマ】の「ユニットでなくなるとき」・RK-271【ライジングマイティキック】の撃破（rules/rk/rk13UnitEffects.ts）。
  if (applyActionDepth === 0) next = applyRk13AfterAction(state, next);
  // RM-017 オメデトロフィー（自軍ユニットがバトルエリアに出たとき。rules/rm/rm1Effects.ts）。
  if (applyActionDepth === 0) next = applyRm1AfterAction(state, next);
  // クロスギャザー ザ・ジェットアクセル XG4-001〜XG4-102 の後処理（rules/xg4/xg4Effects.ts）。
  if (applyActionDepth === 0) next = applyXg4AfterAction(state, next);
  // RM-026 グランドバース【収容】: チェイス等の選択の後で、選んだビークルをパワーゾーンに送る（rules/rm/rm2Effects.ts）。
  if (applyActionDepth === 0) next = applyRm2AfterAction(next);
  // RM-059 異次元調達屋カブト（WB の自軍 S ユニットがバトルエリアに出たとき。rules/rm/rm3Effects.ts）。
  if (applyActionDepth === 0) next = applyRm3AfterAction(state, next);
  // クロスギャザー XG5 の後処理（rules/xg5/xg5Effects.ts）。
  if (applyActionDepth === 0) next = applyXg5AfterAction(state, next, applyAction);
  // XG6-042 の※（手札が0枚のとき撃破）・XG6-025【ここからは私のターンだ】のバトルフェイズの終了（rules/xg6/xg6bEffects.ts）。
  if (applyActionDepth === 0) next = applyXg6AfterAction(next);
  if (applyActionDepth === 0 && next.xg6?.endBattlePhase && !hasBlockingInteraction(next) && !next.winner) {
    const ending = takeXg6BattlePhaseEnd(next);
    if (ending) next = ending.playerId && ending.state.activePlayer === ending.playerId ? endXg6BattlePhase(ending.state, ending.playerId) : ending.state;
  }
  // XG2-019 知恵の樹モーク（ターンが変わったら M ユニットとして扱うのをやめる。rules/xg2/xg2Effects.ts）。
  if (applyActionDepth === 0) next = applyXg2AfterAction(state, next);
  // RK-177【催眠音波】の選択を終えたら、ラッシュフェイズを終える。
  if (applyActionDepth === 0 && next.rk9RushEndAdvance && !next.pendingEffectChoice && !hasBlockingInteraction(next)) {
    const endingPlayer = next.rk9RushEndAdvance;
    const cleared: GameState = { ...next, rk9RushEndAdvance: undefined };
    if (cleared.phase === "rush" && cleared.activePlayer === endingPlayer) {
      let afterPhase = advancePhase(cleared);
      if (afterPhase.phase === "battle") afterPhase = openChargeInsteadOfBattle(afterPhase, endingPlayer);
      if (afterPhase.phase === "battle") afterPhase = openXg2OnBattlePhaseStart(afterPhase, endingPlayer);
      next = { ...afterPhase, log: [...afterPhase.log, buildSimpleLogEntry(endingPlayer, "end_phase", "rush")] };
    } else {
      next = cleared;
    }
  }
  // RS-319 デカマスター ※: 自軍ラッシュフェイズ中、条件を満たせば即座に手札に戻る（進行中の処理がないとき）。
  if (!hasBlockingInteraction(next)) next = applyDekaMasterReturn(next);
  // RS-325【マジチケット】: 発動したカードが捨札になったら「かわりに」の選択を開く。
  if (next.magiTicketPending && !hasBlockingInteraction(next)) next = settleMagiTicket(next);
  // RS-352【ダイデンジンブーメラン】: パワーゾーンのカードが離れたら1枚ごとに相手が撃破するユニットを選ぶ。
  if (applyActionDepth === 0) {
    next = queueDaidenjinBoomerang(state, next);
    if (next.boomerangQueue?.length && !hasBlockingInteraction(next) && !next.winner) {
      next = openDaidenjinBoomerangIfReady(next, turnPlayerOf(next));
    }
    // RS-363【パンサークロー】: 発動したターン、敵軍コマンドゾーンにホールド状態で置かれたユニットカードを捨札にしてもよい。
    next = queuePantherClaw(state, next);
    // RS-377【キバショット】: このターン、リリース状態の敵軍コマンドがホールドされたとき。
    next = queueKibaShot(state, next);
    if (next.kibaShotQueue?.length && !hasKibaShotBlocker(next) && !next.winner) {
      next = openKibaShotIfReady(next, turnPlayerOf(next));
    }
    if (next.pantherClawQueue?.length && !hasBlockingInteraction(next) && !next.winner) {
      next = openPantherClawIfReady(next, turnPlayerOf(next));
    }
  }
  // RS-486【分身幻斬り】: アタック・ストライクの処理をすべて終えてから選択を開く（rules/legend1/set7NamedEffectsC.ts）。
  if (applyActionDepth === 0) {
    next = queueBunshinOnAction(state, next, action as Parameters<typeof queueBunshinOnAction>[2]);
    if (
      next.bunshinQueue?.length &&
      !next.winner &&
      !hasBlockingInteraction(next) &&
      !next.deferredAttack &&
      !next.deferredStrike &&
      !next.pendingEffectRush &&
      !(next.deferredDestroyTriggers?.length)
    ) {
      next = openBunshinIfReady(next);
    }
  }
  // RS-533【フェニックスファイヤー】: 敵軍ユニットがダメージにして置かれたら「1枚ドローしてもよい」（rules/legend1/set8NamedEffectsA.ts）。
  if (applyActionDepth === 0) next = applySet8AAfterAction(state, next, hasBlockingInteraction(next));
  next = syncDamageWithFaceDownPower(state, next);
  // RS-327【フェイタルブレイドの伝授】: 1アクションで撃破された敵軍ユニットを数える（入れ子の applyAction では数えない）。
  if (applyActionDepth === 0) next = applyFatalBladeDraws(state, next, action);
  next = markEnemyTurnFaceDownDamage(state, next);
  if (applyActionDepth === 0) next = settleIcyPhantoms(next);
  // RS-673【炎神キャスト転送】の解決を待っていたチャージフェイズを終える（効果をすべて解決してから）。
  if (applyActionDepth === 0) next = settleChargeAdvance(next);
  // RK-011 第三の眼で無効にしなかったカウンターの使用を、そのまま処理し直す（rules/rk/rk1NamedEffects.ts）。
  if (next.rk1CounterReplay) {
    const replay = next.rk1CounterReplay as GameAction;
    const replayed = applyActionWithRng({ ...next, rk1CounterReplay: undefined }, replay, { trustLegality: true });
    if (replayed.ok) return replayed;
    next = { ...next, rk1CounterReplay: undefined, rk1ThirdEyeChecked: undefined };
  }
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

/**
 * 【キバショット】の撃破の選択を開けないとき（ほかの選択・支払い・離場の応答の途中）。バトルやストライクの途中でも、
 * コマンドがホールドされた直後に誘発を処理する（カウンターの支払い等）。
 */
function hasKibaShotBlocker(state: GameState): boolean {
  return !!(
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingLeave ||
    state.pendingRegister ||
    state.pendingDamagePayment ||
    state.pendingScry ||
    state.pendingMorph
  );
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
    // RS-381【獅子の装光】（ライドオフさせるかわりに発動）。
    !(action.type === "activate_field_unit_ability" && lionArmorAvailable(state, action.playerId)) &&
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
  // 「追加で自軍コマンドをNつホールドする」（hold_extra_command）で、ホールドするコマンドの組が1通りしかなければ
  // 指定を省いたラッシュの宣言もその組で行う（選べる組が複数あるときは指定が必要。RS-657 パトウイング）。
  action = withUniqueExtraCommandHolds(state, action);
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
      // RK-042 ブランウイング【閃光の翼】: スタートフェイズにリリースするコマンドの数を記録する（rules/rk/rk2UnitEffects.ts）。
      const nextState = rk2RecordStartRelease(
        releaseAllCommands(state, playerId),
        playerId,
        player.command.filter((c) => c.commandHeld).length,
      );
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
      const chargeLog = buildLogEntry(playerId, "charge_power", found.card.cardId, state.definitions);
      // RS-673【炎神キャスト転送】: 自軍チャージフェイズ中、自軍パワーゾーンにカードを置いたとき（rules/legend1/set9NamedEffectsD.ts）。
      // チャージフェイズのうちに解決し、解決し終えてからラッシュフェイズに進む（settleChargeAdvance）。
      const withCast = openCastTransferOnCharge(chargedState, playerId, powerCard.instanceId);
      if (withCast.pendingEffectChoice) {
        return {
          ok: true,
          state: { ...withCast, log: [...withCast.log, chargeLog], chargeAdvanceDeferred: { playerId, log: chargeLog } },
        };
      }
      return { ok: true, state: advanceFromCharge(withCast, chargeLog) };
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
      // SR-004【妖魔力】: 相手の場にあれば、置いた OT / ET のカードをホールドする（atwiki/page-578 Q1）。
      const chargedState = holdPlacedCommandUnderMaChikara(
        { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        playerId,
        commandCard.instanceId,
      );
      return {
        ok: true,
        // RS-473【ブルームーンスラッシュ】: パワーゾーンにカードを置かずにチャージフェイズを終えた（rules/legend1/set7NamedEffectsB.ts）。
        // XG6-060【カンドロイド】: チャージしたとき（rules/xg6/xg6cEffects.ts）。
        state: openXg6OnCharged(
          openBlueMoonSlash(
            advanceFromCharge(
              chargedState,
              buildLogEntry(playerId, "charge_command", found.card.cardId, state.definitions),
            ),
            playerId,
          ),
          playerId,
          commandCard.instanceId,
        ),
      };
    }

    case "initiate_command_payment": {
      if (action.kind === "category_use") {
        // RS-586【魔神に不足する物】: 捨札にする「戦闘員」のユニットの選び方（rules/godomRushPay.ts）。
        const godomError = godomDeclarationError(state, playerId, action.sourceInstanceId, action.godomDiscardInstanceIds, [
          ...(action.zordMaterialInstanceIds ?? []),
          ...(action.zordMaterialInstanceId ? [action.zordMaterialInstanceId] : []),
        ]);
        if (godomError) return fail(godomError);
      }
      const pending = buildPaymentFromInitiateAction(state, action);
      if (!pending) return fail("cannot_pay");
      return ok(
        { ...state, pendingCommandPayment: pending },
        buildSimpleLogEntry(playerId, "command_payment_pending"),
      );
    }

    case "begin_zord_setup": {
      if (state.phase !== "rush") return fail("wrong_phase");
      if (action.godomDiscardInstanceIds) {
        const godomError = godomDeclarationError(state, playerId, action.zordInstanceId, action.godomDiscardInstanceIds);
        if (godomError) return fail(godomError);
      }
      if (!canBeginZordSetup(state, playerId, action.zordInstanceId)) {
        return fail("cannot_begin_zord_setup");
      }
      const created = createZordSetup(state, playerId, action.zordInstanceId);
      if (!created) return fail("cannot_begin_zord_setup");
      // RS-586【魔神に不足する物】で捨札にする「戦闘員」のユニットは、最後のラッシュに引き継ぐ。
      const setup = action.godomDiscardInstanceIds ? { ...created, godomDiscardInstanceIds: action.godomDiscardInstanceIds } : created;
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
      const godom = setup.godomDiscardInstanceIds;
      if (advanced.kind === "continue") {
        return ok(
          { ...state, pendingZordSetup: godom ? { ...advanced.setup, godomDiscardInstanceIds: godom } : advanced.setup },
          buildSimpleLogEntry(playerId, "zord_setup_step"),
        );
      }
      if (advanced.kind === "rush") {
        return applyAction(
          { ...state, pendingZordSetup: undefined },
          godom ? { ...advanced.action, godomDiscardInstanceIds: godom } : advanced.action,
        );
      }
      const payment =
        godom && advanced.payment.continuation.type === "rush"
          ? { ...advanced.payment, continuation: { ...advanced.payment.continuation, godomDiscardInstanceIds: godom } }
          : advanced.payment;
      return ok(
        {
          ...state,
          pendingZordSetup: undefined,
          pendingCommandPayment: payment,
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
      // 「ウラ返すとき」（RS-199）の選択が開いた: ウラ返しは選択の解決後（continueDeferredPowerFlip）。
      if (result.state.pendingDamagePayment || result.state.deferredPowerFlip) {
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
      const rawPending = state.pendingCommandPayment;
      if (!rawPending || rawPending.playerId !== playerId) return fail("no_pending_payment");
      // 「追加で自軍コマンドをNつホールドする」を支払いの中で選んだとき、追加分を分ける（RS-627。rules/commandPayment.ts）。
      const split = splitExtraHoldPayment(state, rawPending, action.commandInstanceIds);
      if (!split) return fail("invalid_command");
      const pending = split.pending;
      const paidIds = split.ids;
      const err = validatePaymentSelection(state, pending, paidIds);
      if (err) return fail(err);

      const resolved = applyCommandPaymentResolve(
        state,
        playerId,
        pending,
        paidIds,
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
          paidIds,
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
        // RK-205【フライングアタッカー】: 「これをラッシュするためにホールドしたコマンド」を記録する（rules/rk/rk10UnitEffects.ts）。
        nextState = { ...nextState, rk10RushPaid: { instanceId: pending.sourceInstanceId, commandIds: paidIds } };
        const holdIds =
          pending.kind === "mothership_hold"
            ? paidIds
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
            godomDiscardInstanceIds: cont.godomDiscardInstanceIds,
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
          return { ok: true, state: discardCounterHolds(countered.state, playerId, paidIds) };
        }
        return countered;
      }
      // RK-252 変身音叉 音角: 「このカードを使用するためにホールドしたコマンド」を記録する（rules/rk/rk12UnitEffects.ts）。
      nextState = { ...nextState, rk12OpPaid: { instanceId: pending.sourceInstanceId, commandIds: paidIds } };
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

    case "use_magi_ticket": {
      // RS-325【マジチケット】（rules/legend1/set5NamedEffects.ts）: 手札から使うのと同じ解決（play_operation）に通す。
      if (state.phase !== "rush") return fail("wrong_phase");
      const staged = stageMagiTicket(state, playerId, action.instanceId);
      if (!staged) return fail("card_not_in_command");
      const played = applyAction(
        staged,
        {
          type: "play_operation",
          playerId,
          instanceId: action.instanceId,
          targetInstanceId: action.targetInstanceId,
          extraInstanceId: action.extraInstanceId,
        },
        { trustLegality: true },
      );
      if (!played.ok) return played;
      return ok(
        finishMagiTicketStaging(played.state, playerId, action.instanceId),
        buildLogEntry(playerId, "named_effect", "RS-325", state.definitions, "maji_chiketto"),
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
      if (xg2RejectsOperationTarget(state, playerId, found.card, action.targetInstanceId)) return fail("invalid_target");

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
      // XG7-054 ◎2（次に手札から使うカードの必要パワー-3）は、手札からオペレーションを使ったら消える（rules/xg7/xg7Effects.ts）。
      state = consumeXg7NextCardCost(state, playerId);

      // RK-251 ゴルゴムの仕業: 相手が通常のオペレーションを使用したとき、その効果を実行する前（rules/rk/rk12UnitEffects.ts）。
      {
        const gorgom = openRk12GorgomWindow(
          state,
          { playerId, instanceId: action.instanceId, targetInstanceId: action.targetInstanceId, extraInstanceId: action.extraInstanceId },
          found.card.cardId,
        );
        if (gorgom) return ok(gorgom, buildLogEntry(playerId, "play_operation", found.card.cardId, state.definitions, "rk251_window"));
      }

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
        // 「その後、自軍パワーゾーンのオモテ向きのカードからユニットカードを1枚選び、手札に加えてもよい」（RS-438 炎神ソウル）。
        nextState = openPowerUnitToHandAfterPlace(nextState, playerId, found.card);
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
          // 効果でカード自身を別の場所に置いた（XG2-052 ユナイトベントはターゲットの下に重ねる）なら捨札にしない。
          !isInstancePlacedAnywhere(nextState, found.card.instanceId) &&
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

      {
        // 追加条件で捨札にしたカードを記録する（RS-437 白熱する実況。rules/legend1/set7NamedEffectsA.ts）。
        const discardBefore = new Set(state.players[playerId].discard.map((c) => c.instanceId));
        // RK-217・RK-218 の※で手札から捨札にしたカードは、追加条件を実行したことにならない（atwiki/page-945 Q1・page-1186 Q5）。
        const zordDiscarded = nextPlayer.discard
          .filter((c) => !discardBefore.has(c.instanceId))
          .filter((c) => !rk11IsHandSubstitute(state, state.players[playerId].hand, c, found.card.cardId))
          .map((c) => c.instanceId);
        if (zordDiscarded.length > 0) {
          nextPlayer = { ...nextPlayer, lastZordDiscard: { rushedInstanceId: found.card.instanceId, instanceIds: zordDiscarded } };
        } else if (nextPlayer.lastZordDiscard) {
          const { lastZordDiscard: _stale, ...rest } = nextPlayer;
          nextPlayer = rest as PlayerState;
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
          // RS-586【魔神に不足する物】: 足りない数だけ場の「戦闘員」のユニットを捨札にする（rules/godomRushPay.ts）。
          const withGodom = applyGodomSenshoDiscardPay(
            powerState,
            playerId,
            candidate,
            definition!,
            shortage,
            action.godomDiscardInstanceIds,
          );
          if (withGodom && "error" in withGodom) {
            // 選び方が不正なら失敗。候補が多いのに選んでいないときは、アブレラ【闇の取引】等の別の手段で満たせればそちらで払う
            // （ゴードムは「してもよい」）。満たせなければ、捨札にするユニットを選ぶ必要がある。
            if (action.godomDiscardInstanceIds || darkDealRushPowerBudget(state, playerId, candidate, definition!) < effectiveCost) {
              return fail(withGodom.error);
            }
          } else if (withGodom) {
            candidate = withGodom.player;
            shortage -= withGodom.covered;
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
      // RK-130【スペード5－キック】・RK-215【スペード2―スラッシュ】・RK-216【ハート4―フロート】: 手続きを終えたら、ラッシュするかわりに捨札にするかを選ぶ
      // （rules/rk/rk7UnitEffects.ts・rules/rk/rk11UnitEffects.ts）。
      {
        const procedureDone = { ...nextStateAfterRush, ...updatePlayer(nextStateAfterRush, playerId, clearCostWindow(nextPlayer, "rush_category")) };
        const replaced =
          openRk7LocustReplace(procedureDone, playerId, handFound.card) ?? openRk11UndeadReplace(procedureDone, playerId, handFound.card);
        if (replaced) return ok(replaced, buildLogEntry(playerId, "rush", found.card.cardId, state.definitions, "rk130_replace_pending"));
      }

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
        // RK-245 等「※これはラッシュするとき、可能ならホールド状態で置く。」（rules/rk/rk12Fields.ts）。
        rush: [...nextPlayer.rush, rk12PlacesHeldOnRush(state, rushCard.cardId) ? { ...rushCard, commandHeld: true } : rushCard],
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
      // RS-558【鍵の持ち主の願い】: 「＋」のユニットカードの追加条件を実行して満たしたとき、持ち主は1枚ドローしてもよい。
      nextState = openKeyHolderWishDraw(nextState, playerId, handFound.card.instanceId, playerId);

      if (found.card.cardId === "RS-397") {
        // RS-397【予期せぬ出現】: 敵軍バトルエリアを好きな順に並び替えてもよい（rules/legend1/set6NamedEffectsB.ts）。
        nextState = openReorderEnemyBattle(nextState, playerId, found.card);
      }

      // RK-301 ガタックエクステンダー【エクステンドライダー落とし】はバトルエリアに出たときのコンビネーション（rules/rk/rk15UnitEffects.ts）。
      // ラッシュでは発動しない。

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
        // XG1-034【汚い大気】で※は無効（atwiki/page-1582 Q5・page-500 Q1）。
        !filthyAirActive(state) &&
        !battleEntryPowerDiscardSatisfied(player, found.card.cardId)
      ) {
        const discardChoice = tryStartBattleEntryPowerDiscard(state, playerId, found.card);
        if (!discardChoice) return fail("cannot_enter_battle");
        return ok(
          discardChoice,
          buildSimpleLogEntry(playerId, "battle_entry_power_discard_pending"),
        );
      }

      // XG1-038【サカナマル】: 相手が S ユニットをバトルエリアに出すために選んだとき（rules/xg1/xg1bEffects.ts）。
      const sakanamaru = openXg1bSakanamaru(state, { playerId, instanceId: action.instanceId, vehicleInstanceId: action.vehicleInstanceId, rideOff: action.rideOff });
      if (sakanamaru) return ok(sakanamaru, buildSimpleLogEntry(playerId, "battle_entry_reaction_pending"));

      // ライドして出るときは、ライドした状態で出られるかを判定する（例: RS-290 の対象外になる。atwiki/page-474 Q3）。
      const enteringCard = action.vehicleInstanceId
        ? { ...found.card, mountedOnInstanceId: action.vehicleInstanceId }
        : found.card;
      if (!canMoveUnitToBattle(state, playerId, enteringCard, "rush")) {
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
        // RS-381 ガレオパルサー「自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもライドできる」（atwiki/page-522）。
        const vehicleCard = findInZone(player, "rush", action.vehicleInstanceId)?.card;
        if (vehicleCard && rideNeedsCommandHold(state, found.card, vehicleCard.cardId)) {
          const holdIdx = nextPlayer.command.findIndex((c) => !c.commandHeld);
          if (holdIdx < 0) return fail("illegal_action");
          const command = [...nextPlayer.command];
          command[holdIdx] = { ...command[holdIdx]!, commandHeld: true };
          nextPlayer = { ...nextPlayer, command };
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
      // XG7-044【風都の護り手】（相手の手札以外からラッシュされたとき。rules/xg7/xg7Effects.ts）。
      const rushedFromZone = openXg7OnSelfRushFromZone(applied, playerId, action.zone, action.instanceId);
      return ok(
        rushedFromZone,
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
      if (rk10WolfBlocks(state, playerId, "strike")) return fail("already_acted");
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
      // RK-320【ファイナルライジングブラスト】: ストライクされた回数を数える（ダメージの有無を問わない。rules/rk/rk16Fields.ts）。
      nextState = rk16NoteStrike(nextState, opponent(playerId));

      const pending: PendingStrike = {
        strikerPlayerId: playerId,
        strikerInstanceId: action.instanceId,
        damage,
        battlePhasePlayer: playerId,
      };
      nextState = emitStrikeDeclared(nextState, pending);
      // XG4-080【ハードショット】: ストライクしてダメージを与えるとき、かわりに敵軍ラッシュエリアの S ユニットをダメージにしてもよい（rules/xg4/xg4Effects.ts）。
      nextState = openXg4OnStrike(nextState, pending);

      if (nextState.pendingEffectChoice) {
        // ルール: R-TIME-01 — 「ストライクしたとき」の効果の選択をすべて解決してから、「ストライクされたとき」
        // （RS-196 等・カウンター）とストライクのダメージに進む（core/applyAction の後処理 continueDeferredStrike）。
        let parked: GameState = { ...nextState, deferredStrike: pending };
        if (state.pendingBattleEntry?.instanceId === action.instanceId) {
          parked = { ...parked, pendingBattleEntry: undefined };
        }
        return ok(parked, buildSimpleLogEntry(playerId, "strike_pending", String(damage)));
      }
      return continueStrikeAfterDeclaration(state, nextState, pending, action.instanceId);
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
      // RK-011 第三の眼: 相手がカウンターを発動したとき、効果を解決する前に無効にするかを選ぶ（rules/rk/rk1NamedEffects.ts）。
      {
        const thirdEye = rk1ThirdEyeIntercept(state, playerId, action);
        if (thirdEye) return ok(thirdEye, buildSimpleLogEntry(playerId, "third_eye_window", action.instanceId));
        if (state.rk1ThirdEyeChecked === action.instanceId) state = { ...state, rk1ThirdEyeChecked: undefined };
      }

      if (state.pendingGiantBomb) {
        if (playerId !== state.pendingGiantBomb.ownerId) return fail("wrong_player");
        const used = applyGiantBombCounter(state, playerId, action.instanceId);
        let nextState = clearCounterHoldReady(used.state, playerId);
        if (used.unitInstanceId) {
          const rushed = finalizeEffectRush(nextState, playerId, [used.unitInstanceId], state.pendingGiantBomb.phasePlayerId);
          nextState = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
        }
        return ok(nextState, used.log);
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
        // RK-015 人類の進化: 撃破されて捨札になったあとで、山札の上から1枚ひく（rules/rk/rk1NamedEffects.ts）。
        {
          const counter = findInZone(state.players[playerId], "hand", action.instanceId)?.card;
          if (counter && isRk1LeaveCounterCard(counter.cardId)) {
            const used = updatePlayer(state, playerId, {
              ...state.players[playerId],
              hand: state.players[playerId].hand.filter((c) => c.instanceId !== action.instanceId),
              discard: [...state.players[playerId].discard, { instanceId: counter.instanceId, cardId: counter.cardId }],
            });
            let nextState = finalizeLeaveReaction({ ...state, ...used }, pending, false);
            nextState = applyRk1HumanEvolution(nextState, playerId, pending.phasePlayerId);
            return ok(
              clearCounterHoldReady(nextState, playerId),
              buildLogEntry(playerId, "play_counter", counter.cardId, state.definitions, "human_evolution"),
            );
          }
        }
        // RM-006 怒（いか）る！: 撃破されて捨札になったあとで、敵軍 S ユニットを選ぶ（rules/rm/rm1Effects.ts）。
        {
          const counter = findInZone(state.players[playerId], "hand", action.instanceId)?.card;
          if (counter && isRm1LeaveCounterCard(counter.cardId)) {
            const used = updatePlayer(state, playerId, {
              ...state.players[playerId],
              hand: state.players[playerId].hand.filter((c) => c.instanceId !== action.instanceId),
              discard: [...state.players[playerId].discard, { instanceId: counter.instanceId, cardId: counter.cardId }],
            });
            let nextState = finalizeLeaveReaction({ ...state, ...used }, pending, false);
            nextState = applyRm1LeaveCounter(nextState, playerId, pending.phasePlayerId, counter);
            return ok(
              clearCounterHoldReady(nextState, playerId),
              buildLogEntry(playerId, "play_counter", counter.cardId, state.definitions, "ikaru"),
            );
          }
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
        // RK-172 ルリオオカミ: 山札の上から3枚のうち、アタックしてきたユニットの必要パワー以上のカードを手札へ。1枚以上なら、そのバトルは行われない
        // （rules/rk/rk9UnitEffects.ts）。
        // XG2-061 リョクオオザル（このターン BP 修正。バトルは行われる。rules/xg2/xg2cEffects.ts）も同じ手順。
        if (counterCardId && (isRk9BattleCounterCard(counterCardId) || isXg2BattleCounterCard(counterCardId))) {
          const used: GameState = {
            ...state,
            ...updatePlayer(state, playerId, {
              ...player,
              hand: player.hand.filter((c) => c.instanceId !== action.instanceId),
              discard: [...player.discard, { instanceId: action.instanceId, cardId: counterCardId }],
            }),
          };
          const result = isXg2BattleCounterCard(counterCardId) ? applyXg2BattleCounter(used, playerId, action.instanceId) : applyRk9RuriOokami(used, playerId, pending);
          const log = buildLogEntry(playerId, "play_counter", counterCardId, state.definitions, result.detail);
          const nextPending: PendingBattle = result.cancel ? { ...pending, battleCancelled: true } : pending;
          if (
            !result.cancel &&
            hasBattleCounterReactions(
              { ...result.state, activePlayer: pending.attackerPlayerId },
              playerId,
              pending.defenderInstanceId,
              pending.attackerPlayerId,
              pending.attackerInstanceId,
            )
          ) {
            return ok(clearCounterHoldReady({ ...result.state, pendingBattle: nextPending, activePlayer: playerId }, playerId), log);
          }
          const resolved = emitBattleDeclaredAndResolve(clearCounterHoldReady(result.state, playerId), nextPending);
          return {
            ok: true,
            state: { ...resolved.state, log: [...resolved.state.log, log, resolved.log], winner: checkWinner(resolved.state) },
          };
        }
        // RK-085 ガードベント: そのバトルは行われない。そして、アタックされたユニットの必要パワー以下の敵軍ユニットを撃破する（rules/rk/rk5UnitEffects.ts）。
        if (counterCardId && isRk5BattleCounterCard(counterCardId)) {
          const used: GameState = {
            ...state,
            ...updatePlayer(state, playerId, {
              ...player,
              hand: player.hand.filter((c) => c.instanceId !== action.instanceId),
              discard: [...player.discard, { instanceId: action.instanceId, cardId: counterCardId }],
            }),
          };
          const cost = rk5GuardVentCost(used, pending);
          const log = buildLogEntry(playerId, "play_counter", counterCardId, state.definitions, "guard_vent");
          const resolved = emitBattleDeclaredAndResolve(clearCounterHoldReady(used, playerId), { ...pending, battleCancelled: true });
          const opened = openRk5GuardVent(resolved.state, playerId, pending, cost);
          return {
            ok: true,
            state: { ...opened, log: [...opened.log, log, resolved.log], winner: checkWinner(opened) },
          };
        }
        // クロスギャザー ザ・ジェットアクセル XG4-021 カラクリマント等（rules/xg4/xg4Effects.ts）。
        if (counterCardId && isXg4BattleCounterCard(counterCardId)) {
          const used: GameState = {
            ...state,
            ...updatePlayer(state, playerId, {
              ...player,
              hand: player.hand.filter((c) => c.instanceId !== action.instanceId),
              discard: [...player.discard, { instanceId: action.instanceId, cardId: counterCardId }],
            }),
          };
          const result = applyXg4BattleCounter(used, playerId, counterCardId, pending);
          const log = buildLogEntry(playerId, "play_counter", counterCardId, state.definitions, result.detail);
          const resolved = emitBattleDeclaredAndResolve(clearCounterHoldReady(result.state, playerId), result.pending);
          return { ok: true, state: { ...resolved.state, log: [...resolved.state.log, log, resolved.log], winner: checkWinner(resolved.state) } };
        }
        // RK-004 ギギの腕輪・RK-009 二人の世紀王（rules/rk/rk1NamedEffects.ts）。
        if (counterCardId && isRk1BattleCounterCard(counterCardId)) {
          const used: GameState = {
            ...state,
            ...updatePlayer(state, playerId, {
              ...player,
              hand: player.hand.filter((c) => c.instanceId !== action.instanceId),
              discard: [...player.discard, { instanceId: action.instanceId, cardId: counterCardId }],
            }),
          };
          const result = applyRk1BattleCounterEffect(used, playerId, counterCardId, pending);
          const log = buildLogEntry(playerId, "play_counter", counterCardId, state.definitions, result.detail);
          // ルール: R-CTR-02 — 同じ「アタックされたとき」に続けて別のカウンターを使える。使えるものが残っていれば窓を開いたままにする。
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
              clearCounterHoldReady({ ...result.state, pendingBattle: result.pending, activePlayer: playerId }, playerId),
              log,
            );
          }
          const resolved = emitBattleDeclaredAndResolve(clearCounterHoldReady(result.state, playerId), result.pending);
          return {
            ok: true,
            state: {
              ...resolved.state,
              log: [...resolved.state.log, log, resolved.log],
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
        // XG7-027 雷撃ディスク（rules/xg7/xg7Effects.ts）。
        const result = isXg7RushCounterCard(counterCardId)
          ? applyXg7RushCounter(state, playerId, action.instanceId, pending)
          : isShippuNinjaCard(state, counterCardId)
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
        // RS-432 隠流マキビシ（rules/legend1/set7NamedEffectsA.ts）。
        if (set7AStrikeCounterIds(state, defenderId, pending, canPlayHandCounter).includes(action.instanceId)) {
          const used = applySet7AStrikeCounter(state, defenderId, action.instanceId);
          const cleared = clearCounterHoldReady(used.state, playerId);
          return completeStrike({ ...cleared, pendingStrike: pending }, pending, [used.log]);
        }
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
      // RK-208【迎撃の毒矢】: 相手が「ラッシュしたとき」の発動を宣言したら、実行する前にクレインの窓を開く（rules/rk/rk10UnitEffects.ts）。
      {
        const crane = rk10CraneIntercept(state, playerId, action);
        if (crane) return ok(crane, buildSimpleLogEntry(playerId, "confirm_effect_choice"));
      }
      // XG4-074【ライドルスティック】: バトルの前の確認（rules/xg4/xg4dEffects.ts）。
      if (isXg4BeforeBattleChoice(state.pendingEffectChoice)) {
        const confirmed = confirmXg4BeforeBattle(state, playerId);
        if (confirmed) return continueAttackAfterDeclaration(confirmed.state, confirmed.battle, confirmed.wingAttackFromRush);
      }
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
      {
        // RK-016 ミラーワールド: 相手のユニットを選ぶとき、自分自身のコマンドをホールドする（払えなければ選べない。rules/mirrorWorldSelection.ts）。
        const paid = payMirrorWorldSelection(state, playerId, action.instanceId);
        if (!paid) return fail("invalid_target");
        state = paid;
      }
      {
        const crane = rk10CraneIntercept(state, playerId, action);
        if (crane) return ok(crane, buildSimpleLogEntry(playerId, "resolve_effect_choice", action.instanceId));
      }
      // RK-124【人を守る決意】: 効果の対象として「スネークオルフェノク」を選んだことを記録する（rules/rk/rk6Fields.ts）。
      state = rk6RecordSnakeSelected(state, playerId, action.instanceId);
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
      if (pending?.effectId === TAKE_THE_BLOW_EFFECT_ID) {
        const picked = resolveTakeTheBlow(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return continueAttackAfterDeclaration({ ...picked.state, log: [...picked.state.log, picked.log] }, picked.battle, picked.wingAttackFromRush);
      }
      if (isRk9BerryChoice(pending)) {
        const picked = resolveRk9BerryPick(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
      }
      if (isXg4BeforeBattleChoice(pending)) {
        const picked = resolveXg4BeforeBattle(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        if ("partial" in picked) return ok(picked.partial, buildSimpleLogEntry(playerId, "resolve_effect_choice", action.instanceId));
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
      }
      if (isRm3TentrinaChoice(pending)) {
        const picked = resolveRm3Tentrina(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
      }
      if (isXg7AttackedChoice(pending)) {
        const picked = resolveXg7Attacked(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
      }
      if (isXg7StrikeChoice(pending)) {
        const picked = resolveXg7Strike(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return completeStrike(picked.state, picked.strike, [picked.log]);
      }
      if (isXg1eAttackedChoice(pending)) {
        const picked = resolveXg1eAttacked(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
      }
      if (pending?.effectId === DIONE_WALL_EFFECT_ID && pending.machineEmpireMeta) {
        const picked = resolveDioneWallPick(state, playerId, action.instanceId);
        if ("error" in picked) return fail(picked.error);
        return continueAttackAfterDeclaration(picked.state, picked.battle, picked.wingAttackFromRush);
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
      // RK-208【迎撃の毒矢】の窓を見送った: 保留していた答えをそのまま行う／強制の「ラッシュしたとき」を実行する。
      {
        const declined = rk10CraneDeclined(state, playerId);
        if (declined) {
          if (declined.replay) return applyAction(declined.state, declined.replay);
          if (declined.runOnRush) {
            const ran = runRk10OnRush(declined.state, declined.runOnRush.ownerId, declined.runOnRush.instanceId, declined.runOnRush.phasePlayerId);
            return ok(ran, buildSimpleLogEntry(playerId, "skip_effect_choice"));
          }
          return ok(declined.state, buildSimpleLogEntry(playerId, "skip_effect_choice"));
        }
      }
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
      if (pending?.effectId === TAKE_THE_BLOW_EFFECT_ID) {
        const skipped = skipTakeTheBlow(state, playerId);
        if ("error" in skipped) return fail(skipped.error);
        return continueAttackAfterDeclaration({ ...skipped.state, log: [...skipped.state.log, skipped.log] }, skipped.battle, skipped.wingAttackFromRush);
      }
      if (isRk9BerryChoice(pending)) {
        const skipped = skipRk9Berry(state, playerId);
        if (!skipped) return fail("invalid_target");
        return continueAttackAfterDeclaration(skipped.state, skipped.battle, skipped.wingAttackFromRush);
      }
      if (isXg4BeforeBattleChoice(pending)) {
        const skipped = skipXg4BeforeBattle(state, playerId);
        if (!skipped) return fail("invalid_target");
        return continueAttackAfterDeclaration(skipped.state, skipped.battle, skipped.wingAttackFromRush);
      }
      if (isRm3TentrinaChoice(pending)) {
        const skipped = skipRm3Tentrina(state, playerId);
        if (!skipped) return fail("invalid_target");
        return continueAttackAfterDeclaration(skipped.state, skipped.battle, skipped.wingAttackFromRush);
      }
      if (isXg7AttackedChoice(pending)) {
        const skipped = skipXg7Attacked(state, playerId);
        if (!skipped) return fail("invalid_target");
        return continueAttackAfterDeclaration(skipped.state, skipped.battle, skipped.wingAttackFromRush);
      }
      if (isXg7StrikeChoice(pending)) {
        // 発動しない — ストライクは通常どおり（ほかのストライクへの応答があれば開く）。
        const skipped = skipXg7Strike(state, playerId);
        if (!skipped) return fail("invalid_target");
        if (hasStrikeReactions(skipped.state, playerId, skipped.strike)) {
          return ok({ ...skipped.state, pendingStrike: skipped.strike, activePlayer: playerId }, buildSimpleLogEntry(playerId, "skip_effect_choice"));
        }
        return completeStrike(skipped.state, skipped.strike);
      }
      if (isXg1eAttackedChoice(pending)) {
        const skipped = skipXg1eAttacked(state, playerId);
        if (!skipped) return fail("invalid_target");
        return continueAttackAfterDeclaration(skipped.state, skipped.battle, skipped.wingAttackFromRush);
      }
      if ((pending?.effectId === MACHINE_EMPIRE_EFFECT_ID || pending?.effectId === DIONE_WALL_EFFECT_ID) && pending.machineEmpireMeta) {
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
      // XG3-034【キョウリュウマル】で得た能力（rules/legend1/otherLinesNamedEffects.ts）。
      if (canUseKyouryuumaru(state, playerId, action.attackerInstanceId)) {
        const used = applyKyouryuumaru(state, playerId, action.attackerInstanceId);
        if (!used) return fail("illegal_action");
        return ok(
          finishBattleEntryIf(used, action.attackerInstanceId),
          buildSimpleLogEntry(playerId, "use_juu_kun_do", action.attackerInstanceId),
        );
      }
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
      if (pending && action.substituteInstanceId) {
        // RS-324 マジマザー【ジルマ・マジュナ】: 撃破を止め、マジマザーをかわりに捨札にする。
        if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
        if (!(pending.magiMotherInstanceIds ?? []).includes(action.substituteInstanceId)) return fail("no_super_shield");
        const prevented = finalizeLeaveReaction(state, pending, true);
        const motherResult = applyMagiMotherSubstitute(
          prevented,
          playerId,
          action.substituteInstanceId,
          pending.phasePlayerId,
        );
        if (motherResult.deferred) return ok(motherResult.state, motherResult.log);
        if (pending.resumePendingStrike && state.pendingStrike) {
          return completeStrike(motherResult.state, {
            ...state.pendingStrike,
            damageCancelled: pending.resumePendingStrike.damageCancelled,
          }, [motherResult.log]);
        }
        return ok(motherResult.state, motherResult.log);
      }
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
      if (!state.pendingLeave && state.pendingGiantBomb) {
        if (playerId !== state.pendingGiantBomb.ownerId) return fail("wrong_player");
        return ok(closeGiantBombWindow(state), buildSimpleLogEntry(playerId, "pass_leave_reaction"));
      }
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
      if (pending.abductionResume) {
        return ok(resumeAbductionAfterChase(result.state, pending, false), result.log);
      }
      return ok(result.state, result.log);
    }

    case "pass_chase": {
      const pending = state.pendingChase;
      if (!pending) return fail("no_pending_chase");
      if (playerId !== pending.chaserPlayerId) return fail("wrong_player");
      if (pending.abductionResume) {
        return ok(resumeAbductionAfterChase(state, pending, true), buildSimpleLogEntry(playerId, "pass_chase"));
      }
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
      const mounted = applyAction(
        state,
        {
          type: "move_to_battle",
          playerId,
          instanceId: action.riderInstanceId,
          vehicleInstanceId: action.vehicleInstanceId,
        },
        { ...options, trustLegality: true },
      );
      if (!mounted.ok) return mounted;
      // RS-381 ガレオパルサー: RC を持たない「レッド」の S ユニットは自軍コマンドを1つホールドしてライドする。
      let held = holdCommandForGaleoPulsarRide(mounted.state, playerId, action.riderInstanceId, action.vehicleInstanceId);
      // XG1-057 ブラックファング【衝撃波】: 敵軍のライドされているブラックファングがあれば、ライドして出た S ユニットはホールド状態になる。
      held = xg1cBlackFangOnRide(held, playerId, action.riderInstanceId);
      return held === mounted.state ? mounted : { ...mounted, state: held };
    }

    case "resolve_ride_off_choice": {
      const pending = state.pendingRideOffChoice;
      if (!pending || playerId !== pending.playerId) return fail("no_pending_ride_off");
      let nextState: GameState = { ...state, pendingRideOffChoice: undefined };
      let nextPlayer = { ...player };
      // RS-506【バスオンミサイル】: このターン、ライドオフできない（rules/legend1/set7NamedEffectsD.ts）。
      if (action.rideOff && rideOffBlockedBySet7D(state, playerId)) return fail("ride_off_blocked");

      if (action.rideOff) {
        const idx = nextPlayer.battle.findIndex(
          (c) => c.instanceId === pending.instanceId,
        );
        if (idx < 0) return fail("card_not_in_battle");
        const rider = nextPlayer.battle[idx]!;
        const battle = [...nextPlayer.battle];
        // ライドオフで RC を発動したとみなす（atwiki/page-819 RS-497 Q2。XG1-096 の※等が参照する）。
        const unmounted = { ...rider, mountedOnInstanceId: undefined, activatedNcEffects: [...(rider.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] };
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
        // RM-020【ドルファイヤー】: 自軍ターン中、「宇宙刑事」のユニットが電子星獣ドルからライドオフしたとき（rules/rm/rm1Effects.ts）。
        nextState = applyRm1DolFire(nextState, playerId, rider);
        // クロスギャザー ザ・ジェットアクセル XG4-017 等「ライドオフしたとき」（rules/xg4/xg4Effects.ts）。
        nextState = applyXg4RideOff(nextState, playerId, unmounted);
      }

      // RK-017 ミッションメモリー: ライドしたまま進むことを選んでも、RC の効果を発動する（rules/rk/rk1NamedEffects.ts）。
      if (!action.rideOff) nextState = rk1MissionMemoryOnEntry(nextState, playerId, pending.instanceId) ?? nextState;
      // RK-120 サイドバッシャーVM【ニーラーシャトル】: ライドしたまま進んでも RC の効果を発動する（rules/rk/rk6UnitEffects.ts）。
      if (!action.rideOff) nextState = rk6SideBasherOnEntry(nextState, playerId, pending.instanceId) ?? nextState;
      // RM-022 サイバリアン【サイバリアンレーザースピード】: このターン、ライドしたまま進んでも RC の効果を発動する（rules/rm/rm2Effects.ts）。
      if (!action.rideOff) nextState = rm2CyberianOnEntry(nextState, playerId, pending.instanceId) ?? nextState;
      // RM-045 ガンギブソン ※: これからコンビネーションする「メカ」の S ユニットは、ライドしたまま進んでも RC の効果を発動する（rules/rm/rm3Effects.ts）。
      if (!action.rideOff) nextState = rm3GunGibsonOnEntry(nextState, playerId, pending.instanceId) ?? nextState;
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
      // RK-206【望まない争い】: このターンにアタックを1度でも行ったら、アタックできない（rules/rk/rk10Fields.ts）。
      if (rk10WolfBlocks(state, playerId, "attack")) return fail("already_acted");
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
      // RK-016 ミラーワールド: 「アタックするには、さらに2つホールドしなければならない」（選ぶ1つと合わせてホールドする）。
      battleState = rk1PayAttackCommandCost(battleState, playerId, enemyId, action.defenderInstanceId);
      // RK-124【人を守る決意】: アタックの対象として「スネークオルフェノク」を選んだことを記録する（rules/rk/rk6Fields.ts）。
      battleState = rk6RecordSnakeSelected(battleState, playerId, action.defenderInstanceId);
      // XG1-030【キラークロー】ウイングでアタックするとき（rules/xg1/xg1bEffects.ts）。
      battleState = xg1bOnAttackDeclared(battleState, playerId, action.attackerInstanceId, wingAttackFromRush);
      // XG1-045【墨攻撃】: アタックするとき、バトルの前に山札の上をオモテにする（rules/xg1/xg1cEffects.ts）。
      const sumi = xg1cOnAttackDeclared(battleState, playerId, action.attackerInstanceId, wingAttackFromRush);
      battleState = sumi.state;
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
        ...(sumi.cancel ? { battleCancelled: true } : {}),
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
      if (!found || !isSmallUnit(state.definitions, found.card)) {
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
      const op = player.operation.find(
        (card) => card.instanceId === action.operationInstanceId,
      );
      // RS-608 五色の戦士・RS-609 戦士の魂（rules/legend1/set9NamedEffectsA.ts）。
      if (op && isSet9AResidentCard(op.cardId)) {
        const activated = activateSet9AResident(state, playerId, op.instanceId);
        if (!activated) return fail("illegal_action");
        return ok(activated, buildLogEntry(playerId, "activate_resident_operation", op.cardId, state.definitions));
      }
      // RS-524 呉越同舟は自軍バトルフェイズ中（rules/legend1/set8NamedEffectsA.ts）。それ以外の常駐はラッシュフェイズ。
      if (state.phase !== "rush" && !(op && (isSet8AResident(op.cardId) || isXg2ActivatableResident(op.cardId)))) return fail("wrong_phase");
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
      if (state.phase !== "start" && state.phase !== "rush" && state.phase !== "battle") return fail("wrong_phase");
      // RS-381 ガレオパルサー【獅子の装光】: ライドオフさせるかわりに発動する（ライドオフの選択中のみ）。
      if (state.pendingRideOffChoice) {
        if (!lionArmorAvailable(state, playerId) || state.pendingRideOffChoice.vehicleInstanceId !== action.unitInstanceId) {
          return fail("illegal_action");
        }
        return ok(beginLionArmor(state), buildLogEntry(playerId, "activate_field_unit_ability", "RS-381", state.definitions));
      }
      const unit =
        player.rush.find((c) => c.instanceId === action.unitInstanceId) ??
        player.battle.find((c) => c.instanceId === action.unitInstanceId);
      if (!unit) {
        // RS-559【パワーアロー】等「自分の手札からこのカードを捨札にして発動できる」（rules/legend1/set8NamedEffectsB.ts）。
        const handCard = player.hand.find((c) => c.instanceId === action.unitInstanceId);
        const fromHand = handCard ? (activateXg5HandEffect(state, playerId, action.unitInstanceId) ?? activateSet8BHandEffect(state, playerId, action.unitInstanceId)) : null;
        if (!handCard || !fromHand) {
          // XG6-009（手札から）・XG6-014【英雄の遺産】（パワーゾーンから。rules/xg6/xg6Hooks.ts）。
          const xg6 = activateXg6HandEffect(state, playerId, action.unitInstanceId);
          const xg6Card =
            player.hand.find((c) => c.instanceId === action.unitInstanceId) ??
            player.power.find((c) => c.instanceId === action.unitInstanceId) ??
            player.discard.find((c) => c.instanceId === action.unitInstanceId);
          if (xg6 && xg6Card) return ok(xg6, buildLogEntry(playerId, "activate_field_unit_ability", xg6Card.cardId, state.definitions, "xg6"));
          return fail("illegal_action");
        }
        return ok(fromHand, buildLogEntry(playerId, "activate_field_unit_ability", handCard.cardId, state.definitions, "from_hand"));
      }
      // XG5-042 ゴセイマシン【天装合体】等、場のこのカードから発動する XG5 の効果（rules/xg5/xg5cEffects.ts）。
      const xg5Field = activateXg5HandEffect(state, playerId, action.unitInstanceId);
      if (xg5Field) return ok(xg5Field, buildLogEntry(playerId, "activate_field_unit_ability", unit.cardId, state.definitions));
      // XG6-061【ベンダーモード】・XG6-064【要塞能力】（rules/xg6/xg6cEffects.ts）。
      const xg6Field = activateXg6HandEffect(state, playerId, action.unitInstanceId);
      if (xg6Field) return ok(xg6Field, buildLogEntry(playerId, "activate_field_unit_ability", unit.cardId, state.definitions, "xg6"));
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

      // RK-177 蜂女【催眠音波】: 自分自身のラッシュフェイズを終えるとき（rules/rk/rk9UnitEffects.ts）。選び終えたら後処理でフェイズを進める。
      if (state.phase === "rush") {
        const hachi = openRk9HachiAtRushEnd(state, playerId);
        if (hachi) return ok(hachi, buildSimpleLogEntry(playerId, "rk177_hypnotic_wave"));
      }
      let nextState: GameState = {
        ...advancePhase(state),
        endPhaseStep: advancePhase(state).phase === "end" ? "end_effects" : undefined,
      };
      // XG2-024【一騎打ち】・XG2-028【マイナスエネルギー吸収】（自軍バトルフェイズを終えるとき。rules/xg2/xg2Effects.ts）。
      if (state.phase === "battle") nextState = applyXg2BattlePhaseEnd(nextState, playerId);
      if (nextState.phase === "end" && nextState.pendingEffectChoice && !state.pendingEffectChoice) {
        return ok({ ...nextState, endPhaseStep: "end_effects" }, buildSimpleLogEntry(playerId, "end_phase", state.phase));
      }
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

      let afterPhase = nextState;
      // RS-473【ブルームーンスラッシュ】: チャージフェイズにパワーゾーンへカードを置かずに終えた（rules/legend1/set7NamedEffectsB.ts）。
      if (state.phase === "charge") afterPhase = openBlueMoonSlash(afterPhase, playerId);
      // RS-470 ギンガット【花の星獣】: バトルフェイズを行うとき、かわりにチャージフェイズを行ってもよい（同上）。
      if (state.phase === "rush" && afterPhase.phase === "battle") afterPhase = openChargeInsteadOfBattle(afterPhase, playerId);
      // クロスギャザー ザ・ジェットアクセル XG4-059【自律変形】等「敵軍バトルフェイズ開始時」（rules/xg4/xg4Effects.ts）。
      if (state.phase === "rush" && afterPhase.phase === "battle" && !afterPhase.pendingEffectChoice) afterPhase = openXg4BattlePhaseStart(afterPhase, playerId);
      // XG2-009 コンピュータードラゴン【行動予測】（敵軍バトルフェイズ開始時。rules/xg2/xg2Effects.ts）。
      if (state.phase === "rush" && afterPhase.phase === "battle") afterPhase = openXg2OnBattlePhaseStart(afterPhase, playerId);
      return ok(
        afterPhase,
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
