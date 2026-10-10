import { checkWinner } from "../core/createGame";
import {
  isSet5AChoiceEffect,
  tryConfirmSet5AChoice,
  tryResolveSet5AChoice,
  trySkipSet5AChoice,
} from "./legend1/set5NamedEffectsA";
import { confirmRs4NcChoice, isRs4NcChoice, selectRs4NcChoice } from "./rs4NcEffects";
import { pickSuperElectronEarDamage, SUPER_ELECTRON_EAR_PICK_EFFECT_ID } from "./powerFlipEffects";
import {
  ASSAULT_VECTOR_EFFECT_ID,
  resolveAssaultVectorPick,
  SPINNING_SLASH_EFFECT_ID,
} from "./timeRangerNc";
import {
  GRAP_FIGHTER_BATTLE_EFFECT_ID,
  GRAP_FIGHTER_EFFECT_ID,
  grapFighterLosers,
  resolveGrapFighterReturn,
} from "./grapFighter";
import {
  DENJI_THUNDER_THROW_DISCARD_EFFECT_ID,
  DENJI_THUNDER_THROW_EFFECT_ID,
  resolveDenjiThunderThrowDiscard,
  resolveDenjiThunderThrowPick,
} from "./denjiThunderThrow";
import { resolveSubmergePick, SUBMERGE_EFFECT_ID } from "./legend3/rushEffects";
import { finishHououOwnStep, HOUOU_TORNADO_EFFECT_ID, isHououChoice, resolveHououPick } from "./hououTornado";
import { liftUpPlaceFromDeck } from "./legend3/jointComboEffects";
import { CYCLOPS_SCARLET_EFFECT_ID, discardCyclopsResident, tryCyclopsScarletOnReturnToRush } from "./cyclopsScarlet";
import { finalizeEffectRush, hasPendingPromptBlockingEffectRush } from "../events/emitUnitRushed";
import { applyOnRushUnitEffects } from "./onRushUnitEffects";
import {
  DISMANTLING_EFFECT_ID,
  isFirefightingChoice,
  resolveDismantlingPick,
  resolveFirefightingPick,
} from "./legend2/damageCardEffects";
import { DISPATCH_ORDER_EFFECT_ID, resolveDispatchOrder } from "./dispatchOrder";
import {
  continueKurokoMemoryAfterDraw,
  continueKurokoMemoryAfterHold,
  KUROKO_MEMORY_EFFECT_ID,
  resolveKurokoMemoryChoice,
  skipKurokoMemoryChoice,
} from "./kurokoMemory";
import { isAbductionChoice, resolveAbductionChoice, startAbductionCondition } from "./abduction";
import {
  continueEffectRushAfterMothershipHold,
  EFFECT_RUSH_MOTHERSHIP,
  isEffectRushChoice,
  resolveEffectRushChoice,
  skipEffectRushChoice,
} from "./effectRush";
import type { Category } from "@rangers-strike/cards";
import { canonicalCardName } from "@rangers-strike/cards";
import { markBattleBlocked } from "./turnModifiers";
import { greenCrushTargets } from "./legend2/ncEffects";
import { countLogicalBattleSlots } from "./battleLine";
import { tryLegend3BattleToRush } from "./legend3/restrictions";
import type {
  CardInstance,
  GameState,
  PendingEffectChoice,
  PendingLeave,
  PlayerId,
  PlayerState,
  SeabedDrawMeta,
} from "../types/game";
import { clearCostWindow, satisfyCostWindow } from "../core/costWindow";
import { cardName, cardCategories, effectiveBp, getDefinition, isSmallUnit, parsePowerCost, unitBp } from "../core/catalog";
import { withSpBecomes } from "./fractionalSp";
import {
  applyDiscoDanceReturnFemaleSToRush,
  startEndTurnBattleToRushChoiceForUnit,
  startJetSkateboardChoiceForUnit,
} from "./legend3/endTurnEffects";
import { applyRocketBoosterDeclaredName } from "./rocketBooster";
import { applySimultaneousOrderChoice } from "./simultaneousEffects";
import { applyAssaultToCommandHold } from "./legend3/restrictions";
import { findInZone, opponent, performDeckDraws, removeAt, takeFromDeckTop, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { LION_DANCE_EFFECT_ID, markJuuKunDoAttackerActed } from "./juuKunDo";
import { findCardInField, findCardOwner } from "./fieldLookup";
import { bounceToHand } from "./bounce";
import { applyReanimate } from "./reanimate";
import {
  hasDinoChronicleLeaveReaction,
  hasDinoGutsLeaveReaction,
  processMutualDestruction,
  tryLeaveField,
} from "./operationCounters";
import { completeToPowerOnDestroyChoice } from "./toPowerOnDestroy";
import { hasSeabedSurvey } from "./legend2/fieldEffects";
import { promoteDeferredBattleEntry } from "./battleEntry";
import { getChoiceRefresher } from "./choiceRefreshers";
import { acceptOptionalEffect } from "./optionalEffects";
import {
  afterCommandCardsLeft,
  isCommandLeaveRefillChoice,
  isValidCommandLeaveRefillTarget,
  resolveCommandLeaveRefill,
} from "./commandLeaveRefill";
import {
  MURPHY_CHASE_EFFECT_ID,
  openMurphyChaseDeckChoice,
} from "./murphyChase";
import { continueDslAfterChoice } from "../dsl/cardInterpreter";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import {
  markBattleNcEffect,
  resolveBlackCondorDestroyDamage,
} from "./namedUnitEffects";
import { maybeInterceptDeckRevealForShuriken, grantSp1ToRushUnit, completeShurikenDeckRevealSwap, applyShurikenRevealToHand, findEnemySWithPowerCost } from "./srEffects";
import { returnFusionPartnersFromDiscard } from "./fusionReturn";
import { SCRAMBLE_EFFECT_ID, filterScrambleRemaining } from "./fieldActivatedAbilities";
import {
  tryConfirmErrataChoice,
  tryResolveErrataChoice,
  trySkipErrataChoice,
} from "./errataCardEffects";
import {
  isSet4ChoiceEffect,
  tryConfirmSet4Choice,
  tryResolveSet4Choice,
  trySkipSet4Choice,
} from "./legend1/set4NamedEffects";
import { isSet5ChoiceEffect, tryResolveSet5Choice, trySkipSet5Choice } from "./legend1/set5NamedEffects";
import { isSet6BChoiceEffect, tryResolveSet6BChoice, trySkipSet6BChoice } from "./legend1/set6NamedEffectsB";
import {
  isSet5AuditChoiceEffect,
  tryResolveSet5AuditChoice,
  trySkipSet5AuditChoice,
} from "./legend1/set5AuditFixes";
import {
  applyFlowerBombDeclaredNumber,
  continueMagiBlueAfterSelfDraw,
  moveCommandUnitToBattleSilent,
} from "./legend1/coreGapEffects";
import { applyCastoffDeckRush, continueCastoffAfterHold } from "./castoff";
import {
  resolveSenkoSosa,
  applyKamenRideDeploy,
  RIDER_EFFECT_SELECT_UNIT_IDS,
} from "./riderKickEffects";
import { resolveTurnStartSwap } from "./keywordGapRuntime";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  resolveDeclareNumberDeckReveal,
  resolveDestroyVehicleAndRider,
  resolveEnemyResidentPick,
  resolveFlipEnemyPowerDamageDamage,
  resolveFlipEnemyPowerDamagePick,
  resolveHoldEntryDestroy,
  resolveStackSelfOntoL,
  resolveStackVehicleUnderSelf,
} from "./keywordChoiceRuntime";
import {
  beginAssaultVectorDestroy,
  beginDinoSlasherDiscard,
} from "./zoneCategoryEffects";
import { countDistinctCategoriesInCommandZone } from "./zoneCategoryLimit";
import {
  applySwanWing,
  resolveSwanWingOrderChoice,
  SWAN_WING_EFFECT_ID,
  SWAN_WING_ORDER_EFFECT_ID,
} from "./swanWing";
import {
  autoHoldForBattleEntry,
  clearEffectBattleEntryWindows,
  canMoveUnitToBattle,
  unconditionalNoEntryText,
} from "./restrictions";
import {
  continueMorphAfterReplacement,
  resolveMorphReplacementChoice,
} from "../keywords/morphReaction";
import {
  isKamenRideMorphTargetValid,
  resolveKamenRideMorphChoice,
} from "../keywords/activeMorph";
import { listPlaceableMorphReplacementCandidates } from "../keywords/morph";
import { prepareWingUnitReturnedToRush } from "../keywords/battleKeywords";
import {
  applyGaroaRedToEnemyRush,
  applyMereChameleonDiscardToCommand,
} from "./batch04FieldEffects";
import {
  applyAkaRedSoulHold,
  applyBeastRodToEnemyCommand,
  collectEnemyBattleCategoryM,
  collectEnemyCommandSmallUnits,
  collectEnemyCommandsMatchingPower,
  collectNamedUnitsInDiscard,
  collectOwnRedNcCommands,
  collectOwnRushByName,
} from "./batch05FieldEffects";
import {
  continuePickEffectBranch,
  applyVehicleBattleWithoutRideChoice,
  applyCommandSpHalfChoice,
  applyCommandReleaseChoice,
} from "./bkOperationEffects";
import {
  applySagasSpearScryReturn,
  applyZorobTopDeckReveal,
  collectDiscardSmallUnits,
  collectEnemyBattleAtMostBp,
  collectHandMediumWithAdditional,
  collectOwnWingCommands,
  collectRushWbMWithOnRush,
  releaseWingCommand,
  scryTop3ForSagasSpear,
  triggerCopiedOnRushFromRush,
  applyMegasuringuEnemyRushSBpDebuff,
} from "./batch06FieldEffects";

export type RequestDrawResult =
  | { state: GameState; pending: false; drawn: boolean }
  | { state: GameState; pending: true };

export function tryStartSeabedDrawChoice(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  meta: SeabedDrawMeta,
  sourceCardId = "RS-122",
): GameState | null {
  if (!hasSeabedSurvey(state, playerId)) return null;
  if (state.players[playerId].deck.length === 0) return null;
  if (state.pendingEffectChoice) return null;

  return openEffectChoice(state, {
    playerId,
    effectId: "seabed_survey",
    sourceCardId,
    kind: "seabed_draw",
    phasePlayerId,
    optional: true,
    validInstanceIds: [],
    seabedDrawMeta: meta,
  });
}

/** 手札へドロー；RS-122 がラッシュにいる場合海底選択を開く。 */
export function requestDrawFromDeck(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  options?: {
    count?: number;
    superBrainDiscardSecond?: boolean;
    sourceCardId?: string;
    seabedResume?: NonNullable<SeabedDrawMeta["resume"]>;
  },
): RequestDrawResult {
  const count = options?.count ?? 1;
  const player = state.players[playerId];
  if (player.deck.length === 0) {
    // 引くべきときに引けなければ敗北（公式FAQ RS-027 Q4）。
    const deckedOut = { ...player, deckedOut: true };
    return { state: { ...state, ...updatePlayer(state, playerId, deckedOut) }, pending: false, drawn: false };
  }

  const opened = tryStartSeabedDrawChoice(
    state,
    playerId,
    phasePlayerId,
    {
      drawCount: count,
      superBrainDiscardSecond: options?.superBrainDiscardSecond,
      resume: options?.seabedResume,
    },
    options?.sourceCardId,
  );
  if (opened) {
    return { state: opened, pending: true };
  }

  const nextPlayer = performDeckDraws(
    player,
    count,
    "top",
    options?.superBrainDiscardSecond,
  );
  const afterDraw: GameState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
  if (options?.superBrainDiscardSecond) {
    const kept = openSuperBrainKeepChoice(
      afterDraw,
      playerId,
      phasePlayerId,
      player.hand.map((c) => c.instanceId),
      options.seabedResume,
    );
    if (kept) return { state: kept, pending: true };
  }
  return {
    state: afterDraw,
    pending: false,
    drawn: true,
  };
}

/** 山札の上（または下）から count 枚取り出す。足りなければ引けるだけ引き、敗北フラグを立てる（R-START-05, R-WIN-03）。 */
function takeFromDeck(
  player: PlayerState,
  count: number,
  from: "top" | "bottom",
): { player: PlayerState; taken: CardInstance[] } {
  if (from === "top") return takeFromDeckTop(player, count);
  const want = Math.max(0, count);
  const n = Math.min(want, player.deck.length);
  // 下から1枚ずつひく（最初にひいたのが最下段）。
  const taken = player.deck.slice(player.deck.length - n).reverse();
  const deck = player.deck.slice(0, player.deck.length - n);
  return { player: { ...player, deck, ...(n < want ? { deckedOut: true } : {}) }, taken };
}

/**
 * 山札から count 枚「ひいて捨札にする」（RS-027 ダイノガッツ等）。自軍ラッシュエリアに RS-122【海底探査】があれば
 * 上からひくかわりに下からひくかを選ぶ（faq-card-2 RS-122 Q1「ダイノガッツの効果で「カードをひいて捨札にする」
 * といったときに…「下からひく」ことができます」）。
 */
export function drawToDiscardFromDeck(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  count: number,
): GameState {
  if (count > 0) {
    const opened = tryStartSeabedDrawChoice(state, playerId, phasePlayerId, { drawCount: count, toDiscard: true });
    if (opened) return opened;
  }
  const taken = takeFromDeckTop(state.players[playerId], count);
  return {
    ...state,
    ...updatePlayer(state, playerId, { ...taken.player, discard: [...taken.player.discard, ...taken.taken] }),
  };
}

export const SUPER_BRAIN_KEEP_EFFECT_ID = "super_brain_keep";

export const FIRE_DANCE_EFFECT_ID = "fire_dance";
export const BEAT_HAMMER_EFFECT_ID = "beat_hammer_deploy_enemy_command";

/**
 * RS-194 ダイナロボ【ビートハンマー】: 自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドゾーンから
 * ユニットのカードを1枚選び、敵軍バトルエリアに出す。このとき出したユニットの効果は発動しない。
 * 出られないユニット（例: 敵軍パトシグナー下の BP5000 以上の M ユニット）も選べるが、その場合は何も起こらない
 * （faq-card-1 RS-047 Q1）。
 */
export function startBeatHammerChoice(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId?: string,
): GameState | null {
  const enemyId = opponent(playerId);
  // 「※これはバトルエリアに出られない」ユニットのカードは選べない（grnrngr/faq-card-4 RS-194 Q3）。
  const ids = state.players[enemyId].command
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && !unconditionalNoEntryText(def);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: BEAT_HAMMER_EFFECT_ID,
    sourceCardId,
    sourceInstanceId,
    kind: "select_command",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

/** 効果でラッシュエリアのユニットをバトルエリアに出せるか（※の出場制限・ホールドを満たせるか）。 */
export function canEffectPutRushUnitIntoBattle(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
): boolean {
  const found = findInZone(state.players[ownerId], "rush", instanceId);
  if (!found) return false;
  const ready = autoHoldForBattleEntry(state, ownerId, found.card);
  if (!ready) return false;
  return canMoveUnitToBattle({ ...state, ...updatePlayer(state, ownerId, ready) }, ownerId, found.card, "rush");
}

function resolveBeatHammerChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "command", instanceId);
  if (!found) return finishChoice(state, pending, "gone");
  const card: CardInstance = { ...found.card, commandHeld: undefined, faceDown: undefined };
  const [, command] = removeAt(enemy.command, found.index);
  const withoutCard: GameState = { ...state, ...updatePlayer(state, enemyId, { ...enemy, command }) };
  const ready = autoHoldForBattleEntry(withoutCard, enemyId, card);
  const readyState = ready ? { ...withoutCard, ...updatePlayer(withoutCard, enemyId, ready) } : undefined;
  if (!ready || !readyState || !canMoveUnitToBattle(readyState, enemyId, card, "rush")) {
    // 出られないユニットを選んだときは何も起こらない（カードはコマンドゾーンに残る）。
    return finishChoice(state, pending, "no_effect");
  }
  const nextEnemy = clearEffectBattleEntryWindows({ ...ready, battle: [...ready.battle, { ...card, battleActed: false }] });
  return finishChoice(
    { ...readyState, ...updatePlayer(readyState, enemyId, nextEnemy) },
    pending,
    cardName(state.definitions, card.cardId),
  );
}

/**
 * RS-008 超電子頭脳 — 2枚ひいたあと、どちらを手札に残すかを自分で選ぶ（もう1枚は捨札）。
 * 新たに手札に入ったカードが2枚未満（山札が1枚だった）なら選択は開かない。
 * ルール: atwiki/page-275「そのうちの1枚を手札に加え、もう1枚を捨札にする」
 */
function openSuperBrainKeepChoice(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  handBeforeIds: string[],
  resume?: NonNullable<SeabedDrawMeta["resume"]>,
): GameState | null {
  const before = new Set(handBeforeIds);
  const drawnIds = state.players[playerId].hand
    .map((c) => c.instanceId)
    .filter((id) => !before.has(id));
  if (drawnIds.length < 2) return null;
  return openEffectChoice(
    { ...state, pendingEffectChoice: undefined },
    {
      playerId,
      effectId: SUPER_BRAIN_KEEP_EFFECT_ID,
      sourceCardId: "RS-008",
      kind: "select_hand",
      phasePlayerId,
      validInstanceIds: drawnIds,
      selectCount: 1,
      // 省略（skip）は「先にひいた1枚を残す」。
      optional: true,
      seabedDrawMeta: { drawCount: drawnIds.length, superBrainDiscardSecond: true, resume },
    },
  );
}

function resolveSuperBrainKeepChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const discardIds = new Set(pending.validInstanceIds.filter((id) => id !== instanceId));
  const player = state.players[playerId];
  const toDiscard = player.hand.filter((c) => discardIds.has(c.instanceId));
  const nextPlayer = {
    ...player,
    hand: player.hand.filter((c) => !discardIds.has(c.instanceId)),
    discard: [...player.discard, ...toDiscard],
  };
  return finishSeabedDrawChoice(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending,
    "keep",
  );
}

export type ChoiceOutcome =
  | { state: GameState; log?: string; logs?: string[] }
  | { error: string };

function collectFieldUnitIds(
  state: GameState,
  playerId: PlayerId,
  maxBp: number,
  zones: Array<"rush" | "battle"> = ["rush", "battle"],
): string[] {
  const player = state.players[playerId];
  const ids: string[] = [];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (effectiveBp(state, playerId, card) <= maxBp) {
        ids.push(card.instanceId);
      }
    }
  }
  return ids;
}

function collectAnyFieldUnitIds(state: GameState, maxBp: number): string[] {
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    ids.push(...collectFieldUnitIds(state, pid, maxBp));
  }
  return ids;
}

function collectCommandIds(
  state: GameState,
  playerId: PlayerId,
  filter: "held" | "released" | "any",
): string[] {
  return state.players[playerId].command
    .filter((c) => {
      if (filter === "held") return !!c.commandHeld;
      if (filter === "released") return !c.commandHeld;
      return true;
    })
    .map((c) => c.instanceId);
}

function collectPowerIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
}

function collectHandIdsByName(
  state: GameState,
  playerId: PlayerId,
  name: string,
): string[] {
  return state.players[playerId].hand
    .filter((c) => cardName(state.definitions, c.cardId) === name)
    .map((c) => c.instanceId);
}

function collectHandIdsByCardId(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): string[] {
  return state.players[playerId].hand
    .filter((c) => c.cardId === cardId)
    .map((c) => c.instanceId);
}

function collectEnemyRushSmallIds(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.size === "S")
    .map((c) => c.instanceId);
}

export function isValidEffectChoiceTarget(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): boolean {
  if (pending.effectId === "morph_replacement" && pending.morphMeta?.activeMorphUnitInstanceId) {
    const player = state.players[pending.playerId];
    const morphUnit =
      findInZone(player, "rush", pending.morphMeta.activeMorphUnitInstanceId)?.card ??
      findInZone(player, "battle", pending.morphMeta.activeMorphUnitInstanceId)?.card;
    if (!morphUnit) return false;
    return listPlaceableMorphReplacementCandidates(state, pending.playerId, morphUnit).some(
      (candidate) => candidate.instanceId === instanceId,
    );
  }
  if (pending.effectId === "kamen_ride_morph" && pending.sourceInstanceId) {
    return isKamenRideMorphTargetValid(
      state,
      pending.playerId,
      pending.sourceInstanceId,
      instanceId,
    );
  }
  if (
    pending.effectId === "nihawo" &&
    pending.sphinxQuizMeta?.step === "pick_power"
  ) {
    const enemyId = opponent(pending.playerId);
    return state.players[enemyId].power.some(
      (c) => c.instanceId === instanceId && c.faceDown,
    );
  }
  if (!pending.validInstanceIds.includes(instanceId)) return false;

  if (
    isEffectRushChoice(pending) ||
    isAbductionChoice(pending.effectId) ||
    pending.effectId === DISPATCH_ORDER_EFFECT_ID ||
    pending.effectId === CYCLOPS_SCARLET_EFFECT_ID ||
    pending.effectId === SUBMERGE_EFFECT_ID ||
    pending.effectId === FIRE_DANCE_EFFECT_ID ||
    isHououChoice(pending) ||
    pending.effectId === KUROKO_MEMORY_EFFECT_ID ||
    isSet4ChoiceEffect(pending.effectId) ||
    isSet5ChoiceEffect(pending.effectId) ||
    isSet5AuditChoiceEffect(pending.effectId) ||
    isSet5AChoiceEffect(pending.effectId) ||
    isSet6BChoiceEffect(pending.effectId) ||
    pending.effectId === "rs414_dione_wall"
  ) {
    return true;
  }

  if (pending.effectId === "fire_sword") {
    return (
      !!findInZone(state.players[pending.playerId], "operation", instanceId) ||
      !!findInZone(state.players[opponent(pending.playerId)], "operation", instanceId)
    );
  }

  if (pending.effectId === "no_e58fa4") {
    // RS-277【古傷の因縁】: 候補は敵軍コマンドゾーンと敵軍パワーゾーン（ダメージ以外）のカード
    // （atwiki/page-438「敵軍コマンドゾーンか、敵軍パワーゾーンのダメージ以外のカード」）。
    const enemy = state.players[opponent(pending.playerId)];
    return (
      !!findInZone(enemy, "command", instanceId) ||
      enemy.power.some((c) => c.instanceId === instanceId && !c.faceDown)
    );
  }

  if (isCommandLeaveRefillChoice(pending)) {
    return isValidCommandLeaveRefillTarget(state, pending, instanceId);
  }

  if (pending.kind === "select_unit") {
    const dest = pending.unitDestination ?? "discard";
    if (pending.effectId === "kamen_ride_deploy") {
      // XG3-069: 対象は自軍パワーゾーンのオモテ向きカード。
      return !!state.players[pending.playerId].power.find(
        (c) => c.instanceId === instanceId && !c.faceDown,
      );
    }
    if (dest === "hand_from_discard") {
      return !!findInZone(state.players[handFromDiscardOwner(pending)], "discard", instanceId);
    }
    if (dest === "rush_from_discard") {
      return !!findInZone(state.players[pending.playerId], "discard", instanceId);
    }
    if (dest === "hand_from_power") {
      return !!findInZone(state.players[pending.playerId], "power", instanceId);
    }
    if (pending.effectId === "battle_entry_discard") {
      const found = findInZone(state.players[pending.playerId], "rush", instanceId);
      return !!found && pending.sourceInstanceId !== instanceId;
    }
    if (dest === "swap_battle" && pending.sourceInstanceId) {
      const player = state.players[pending.playerId];
      // ルール: R-ERR-RS118 — 出るときの置きかえ。選択が開いた時点で既にバトルエリアに出ていてもよい。
      return (
        instanceId !== pending.sourceInstanceId &&
        !!findInZone(player, "battle", instanceId) &&
        (!!findInZone(player, "rush", pending.sourceInstanceId) ||
          !!findInZone(player, "battle", pending.sourceInstanceId))
      );
    }
    const located = findCardInField(state, instanceId);
    if (!located) return false;
    if (dest === "rush" || dest === "enemy_command") {
      return located.zone === "battle";
    }
    if (dest === "enemy_battle") {
      return located.zone === "rush";
    }
    return true;
  }

  if (pending.kind === "select_unit_step" && pending.effectId === "string_fist") {
    const located = findCardOwner(state, instanceId);
    return !!located && located.zone === "battle";
  }

  return true;
}

export function openEffectChoice(
  state: GameState,
  choice: PendingEffectChoice,
): GameState {
  const refresher = choice.refreshOnOpen ? getChoiceRefresher(choice.refreshOnOpen.key) : undefined;
  if (refresher) {
    const refreshed = refresher(state, choice);
    if (!refreshed) {
      // 候補がなくなった選択は開かない（続きの選択があればそれを開く）。
      if (choice.resumeChoice) return openEffectChoice(state, choice.resumeChoice);
      return promoteDeferredBattleEntry({ ...state, pendingEffectChoice: undefined, activePlayer: choice.phasePlayerId });
    }
    choice = { ...refreshed, refreshOnOpen: undefined };
  }
  const intercepted = maybeInterceptDeckRevealForShuriken(state, choice);
  if (intercepted) return intercepted;
  return {
    ...state,
    pendingEffectChoice: {
      ...choice,
      selectedInstanceIds: choice.selectedInstanceIds ?? [],
    },
    activePlayer: choice.playerId,
  };
}

/** RS-115: このユニットが戦闘進入したとき相手が1枚ドローできる。 */
export function startOpponentMayDrawChoice(
  state: GameState,
  enemyId: PlayerId,
  phasePlayerId: PlayerId,
): GameState | null {
  if (state.players[enemyId].deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: enemyId,
    effectId: "opponent_may_draw_on_enter",
    sourceCardId: "RS-115",
    kind: "optional_deck_draw",
    phasePlayerId,
    validInstanceIds: ["draw"],
    optional: true,
  });
}

export function applySeabedDrawPlacement(
  state: GameState,
  playerId: PlayerId,
  placement: "top" | "bottom",
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "seabed_draw") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const meta = pending.seabedDrawMeta ?? { drawCount: 1 };
  const from = placement === "bottom" ? "bottom" : "top";
  const player = state.players[playerId];
  if (meta.toDiscard) {
    const taken = takeFromDeck(player, meta.drawCount, from);
    const afterTake: GameState = {
      ...state,
      ...updatePlayer(state, playerId, { ...taken.player, discard: [...taken.player.discard, ...taken.taken] }),
    };
    return finishSeabedDrawChoice(afterTake, pending, from);
  }
  const nextPlayer = performDeckDraws(
    player,
    meta.drawCount,
    from,
    meta.superBrainDiscardSecond,
  );
  const afterDraw: GameState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
  if (meta.superBrainDiscardSecond) {
    const kept = openSuperBrainKeepChoice(
      afterDraw,
      playerId,
      pending.phasePlayerId,
      player.hand.map((c) => c.instanceId),
      meta.resume,
    );
    if (kept) {
      return {
        state: kept,
        log: buildLogEntry(playerId, "resolve_effect_choice", pending.sourceCardId, state.definitions, `${pending.effectId}:${from}`),
      };
    }
  }

  return finishSeabedDrawChoice(afterDraw, pending, from);
}

export function applySeabedDrawSkip(state: GameState, playerId: PlayerId): ChoiceOutcome {
  return applySeabedDrawPlacement(state, playerId, "top");
}

export function startRuinSurveyChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
): GameState | null {
  const top = state.players[playerId].deck[0];
  if (!top) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "ruin_survey",
    sourceCardId,
    kind: "deck_top_or_bottom",
    phasePlayerId: playerId,
    validInstanceIds: [top.instanceId],
    viewedInstanceIds: [top.instanceId],
    // 「見てもよい」— 見ない（skip）なら山札は変わらない。出典: RS-066 atwiki/page-270。
    optional: true,
  });
}

export function startSelectUnitChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    validInstanceIds: string[];
    unitDestination: PendingEffectChoice["unitDestination"];
    optional?: boolean;
  },
): GameState | null {
  if (params.validInstanceIds.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    selectCount: 1,
  });
}

/** RS-563: 敵ユニットをホールド（必要パワー ≤ 相手ダメージ点数）。 */
export function startEnterHoldEnemyPowerLeDamageChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const maxCost = state.players[enemyId].damage;
  const valid: string[] = [];
  for (const zone of ["battle", "rush"] as const) {
    for (const card of state.players[enemyId][zone]) {
      if (!isSelectableByOpponentEffect(state, params.playerId, card.instanceId)) continue;
      const def = getDefinition(state.definitions, card.cardId);
      if (def?.type !== "unit") continue;
      if (parsePowerCost(def.powerCost ?? 99) <= maxCost) {
        valid.push(card.instanceId);
      }
    }
  }
  if (valid.length === 0) return null;
  return startSelectUnitChoice(state, {
    ...params,
    validInstanceIds: valid,
    unitDestination: "enemy_command",
    optional: true,
  });
}

function raidapanchiMaxPowerCost(state: GameState, playerId: PlayerId): number {
  const battle = state.players[playerId].battle;
  if (battle.length === 0) return 2;
  const sUnits = battle.filter((c) => isSmallUnit(state.definitions, c.cardId));
  if (sUnits.length !== battle.length) return 2;
  const names = new Set(
    sUnits.map((c) => canonicalCardName(cardName(state.definitions, c.cardId))),
  );
  if (
    names.size === 2 &&
    names.has("仮面ライダーキックホッパー") &&
    names.has("仮面ライダーパンチホッパー")
  ) {
    return 4;
  }
  return 2;
}

/** RK-297 ライダーパンチ: 敵パワーオモテから必要パワー上限以下を1枚捨札。 */
export function startRaidapanchiDiscardChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const maxPowerCost = raidapanchiMaxPowerCost(state, params.playerId);
  const valid: string[] = [];
  for (const card of state.players[enemyId].power) {
    if (card.faceDown) continue;
    if (!isSelectableByOpponentEffect(state, params.playerId, card.instanceId)) continue;
    const def = getDefinition(state.definitions, card.cardId);
    if (parsePowerCost(def?.powerCost ?? 99) > maxPowerCost) continue;
    valid.push(card.instanceId);
  }
  if (valid.length === 0) return null;
  return startSelectUnitChoice(state, {
    ...params,
    validInstanceIds: valid,
    unitDestination: "discard",
    optional: true,
  });
}

/** RS-229 超ハンガー進化: 山札トップ1枚を公開（任意）。 */
export function startHangaEvolutionChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const player = state.players[params.playerId];
  if (player.deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: "hanga",
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "optional_deck_draw",
    validInstanceIds: ["draw"],
    optional: true,
  });
}

export function applyHangaEvolutionReveal(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string | undefined,
): GameState {
  const player = state.players[playerId];
  const top = player.deck[0];
  if (!top) return state;

  const def = getDefinition(state.definitions, top.cardId);
  const isWbM =
    def?.type === "unit" &&
    def.size === "M" &&
    cardCategories(def).includes("WB");
  const revealed = { ...top, faceDown: false };
  const restDeck = player.deck.slice(1);
  const nextPlayer: PlayerState = isWbM
    ? { ...player, deck: restDeck, rush: [...player.rush, revealed] }
    : { ...player, deck: restDeck, discard: [...player.discard, revealed] };

  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, playerId, nextPlayer),
  };
  if (sourceInstanceId) {
    nextState = markBattleNcEffect(
      nextState,
      playerId,
      sourceInstanceId,
      "optional_battle_no_attack",
    );
  }
  return nextState;
}

function setPlayerPowerFace(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  faceDown: boolean,
): GameState {
  const owner = state.players[ownerId];
  return {
    ...state,
    ...updatePlayer(state, ownerId, {
      ...owner,
      power: owner.power.map((c) =>
        c.instanceId === instanceId ? { ...c, faceDown } : c,
      ),
    }),
  };
}

function finishSphinxQuiz(
  state: GameState,
  pending: PendingEffectChoice,
  powerInstanceId: string,
  label: string,
): ChoiceOutcome {
  const enemyId = opponent(pending.sphinxQuizMeta!.controllerId);
  const flipped = setPlayerPowerFace(state, enemyId, powerInstanceId, true);
  return finishChoice(clearChoice(flipped, pending.phasePlayerId), pending, label);
}

/** RS-386: 捨札の特徴Mをサイレントラッシュ。 */
export function startEnterRushFromDiscardFeatureChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    feature: string;
  },
): GameState | null {
  const player = state.players[params.playerId];
  const valid = player.discard
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return (
        def?.type === "unit" &&
        def.size === "M" &&
        (def.features ?? []).includes(params.feature)
      );
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return startSelectUnitChoice(state, {
    ...params,
    validInstanceIds: valid,
    unitDestination: "rush_from_discard",
    optional: true,
  });
}

/** RS-412: 敵パワーダメージを選び数字クイズ。 */
export function startSphinxPowerQuizChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const valid = state.players[enemyId].power
    .filter((c) => c.faceDown)
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_power",
    validInstanceIds: valid,
    selectCount: 1,
    optional: true,
    sphinxQuizMeta: {
      step: "pick_power",
      controllerId: params.playerId,
      powerInstanceId: "",
      actualPowerCost: 0,
    },
  });
}

function parseFeatureFromEffectText(text: string): string {
  return text.match(/特徴「([^」]+)」/)?.[1] ?? "メカ";
}

/** RS-316 超ドリル進化: ラッシュの恐竜2体捨て→SP1。 */
export function startSuperDrillRushChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    feature?: string;
  },
): GameState | null {
  const feature = params.feature ?? "恐竜";
  const player = state.players[params.playerId];
  const valid = player.rush
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && (def.features ?? []).includes(feature);
    })
    .map((c) => c.instanceId);
  if (valid.length < 2) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "discard",
    selectCount: 2,
    optional: true,
  });
}

function collectGaoriJawTargets(state: GameState, enemyId: PlayerId): string[] {
  const player = state.players[enemyId];
  const ids: string[] = [];
  for (const card of player.battle) {
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.type !== "unit") continue;
    if (cardCategories(def).length < 2) continue;
    if (effectiveBp(state, enemyId, card) > 9000) continue;
    ids.push(card.instanceId);
  }
  return ids;
}

/** RS-478 粉砕する大顎: 敵バトルから多カテゴリBP9000以下を任意撃破。 */
export function startGaoriJawDestroyChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const valid = collectGaoriJawTargets(state, enemyId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "discard",
    selectCount: 1,
    optional: true,
  });
}

/** RS-400 密猟者からの保護: 敵バトル恐竜Mをパワーへ。 */
export function startTimeJetProtectChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    feature?: string;
  },
): GameState | null {
  const feature = params.feature ?? "恐竜";
  const enemyId = opponent(params.playerId);
  const valid = collectEnemyBattleFeatureM(state, enemyId, feature);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "power",
    selectCount: 1,
    optional: true,
  });
}

function collectEnemyBattleFeatureM(
  state: GameState,
  enemyId: PlayerId,
  feature: string,
): string[] {
  const player = state.players[enemyId];
  const ids: string[] = [];
  for (const card of player.battle) {
    const def = getDefinition(state.definitions, card.cardId);
    if (
      def?.type === "unit" &&
      def.size === "M" &&
      (def.features ?? []).includes(feature)
    ) {
      ids.push(card.instanceId);
    }
  }
  return ids;
}

function collectGaroaRedTargets(state: GameState, enemyId: PlayerId): string[] {
  const enemy = state.players[enemyId];
  const ids: string[] = [];
  for (const card of enemy.command) {
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.type === "unit" && (def.features ?? []).includes("レッド")) {
      ids.push(card.instanceId);
    }
  }
  for (const card of enemy.power) {
    if (card.faceDown) continue;
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.type === "unit" && (def.features ?? []).includes("レッド")) {
      ids.push(card.instanceId);
    }
  }
  return ids;
}

/** RS-277 古傷の因縁: 敵レッドユニットを敵ラッシュへ。 */
export function startGaroaGrudgeChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const valid = collectGaroaRedTargets(state, enemyId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    optional: true,
    unitDestination: "rush",
  });
}

/** RS-633 シルバーブレイザー: コマンド1枚を手札へ。 */
export function startSilverBlazerChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const player = state.players[params.playerId];
  const valid = player.command.map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_command",
    validInstanceIds: valid,
    commandAction: "return_hand",
    optional: true,
  });
}

/** RS-504 臨獣カメレオン拳。 */
export function startMereChameleonChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const player = state.players[params.playerId];
  if (player.command.length > 0) {
    return openEffectChoice(state, {
      ...params,
      kind: "select_command",
      validInstanceIds: player.command.map((c) => c.instanceId),
      commandAction: "discard",
      optional: true,
    });
  }
  if (player.discard.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    effectId: "kamereon_discard_to_command",
    kind: "select_unit",
    validInstanceIds: player.discard.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

/** RS-399 オーパーツの返還: 敵バトルMA M→パワー。 */
export function startTimeJetCategoryProtectChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    category: Category;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const valid = collectEnemyBattleCategoryM(state, enemyId, params.category);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "power",
    selectCount: 1,
    optional: true,
  });
}

/** RS-518 獣撃棒: 敵コマンドS。 */
export function startBeastRodChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const valid = collectEnemyCommandSmallUnits(state, enemyId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    playerId: enemyId,
    kind: "select_command",
    validInstanceIds: valid,
    optional: false,
  });
}

/** RS-421 ソウル降臨。 */
export function startAkaRedSoulChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = collectOwnRedNcCommands(state, params.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_command",
    validInstanceIds: valid,
    commandAction: "hold",
    optional: true,
  });
}

/** RS-616 巨大ボール化。 */
export function startClimberBallChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = collectOwnRushByName(state, params.playerId, "クライマー", 2);
  if (valid.length < 2) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "discard",
    selectCount: 2,
    optional: true,
  });
}

/** RS-606 雷鳴剣ヒカリマル: ウイングコマンド任意リリース→敵バトルBP以下をパワーへ。 */
export function startHikarimaruWingChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = collectOwnWingCommands(state, params.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_command",
    validInstanceIds: valid,
    optional: true,
  });
}

/** RS-383 レッドラダー: 捨札S最大2枚を手札へ。 */
export function startRedLadderDiscardChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = collectDiscardSmallUnits(state, params.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "hand_from_discard",
    selectCount: Math.min(2, valid.length),
    optional: true,
  });
}

/** RS-585 ボウケンシルバー: 自軍/敵軍山札上3枚見てSP1。 */
export function startBoukenSilverEnterChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  if (
    state.players[params.playerId].deck.length === 0 &&
    state.players[enemyId].deck.length === 0
  ) {
    return null;
  }
  const valid = [
    ...(state.players[params.playerId].deck.length > 0 ? ["deck_own"] : []),
    ...(state.players[enemyId].deck.length > 0 ? ["deck_enemy"] : []),
  ];
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "confirm",
    validInstanceIds: valid,
    optional: true,
  });
}

/** RS-322 ベン・G: 手札追加条件Mを捨札。 */
export function startBenGHandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = collectHandMediumWithAdditional(state, params.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_hand",
    validInstanceIds: valid,
    selectCount: 1,
    optional: true,
  });
}

/** RS-428 ファンタスティック・テクニック: WB Mのラッシュ効果をコピー。 */
export function startSuperGekiFantasticChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = collectRushWbMWithOnRush(state, params.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "discard",
    optional: true,
  });
}

/** RS-667 ファーストクラスな教官: 山札から炎神M（ジャン・ボエール除く）をラッシュ。 */
export function startFuasutokurasunaChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const player = state.players[params.playerId];
  if (player.deck.length === 0) return null;

  const excludeName = canonicalCardName("ジャン・ボエール");
  const viewedInstanceIds = player.deck.map((c) => c.instanceId);
  const validInstanceIds = player.deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "M") return false;
      if (!(def.features ?? []).includes("炎神")) return false;
      if (canonicalCardName(def.name) === excludeName) return false;
      return true;
    })
    .map((c) => c.instanceId);

  return openEffectChoice(state, {
    ...params,
    kind: "scry_keep_one",
    viewedInstanceIds,
    validInstanceIds,
    unitDestination: "rush",
    selectCount: 1,
    optional: true,
  });
}

/** RS-367 軍隊アリの遺伝子: 山札上1枚公開。 */
export function startZorobAntGeneChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  if (state.players[params.playerId].deck.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "confirm",
    validInstanceIds: ["reveal_top"],
    optional: true,
  });
}

/** RS-662 火将危願。 */
export function startFireGeneralChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const ownCount = state.players[params.playerId].command.length;
  if (ownCount === 0) return null;
  const enemyId = opponent(params.playerId);
  const valid = collectEnemyCommandsMatchingPower(state, enemyId, ownCount);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    playerId: enemyId,
    kind: "select_command",
    validInstanceIds: valid,
    commandAction: "discard",
    optional: true,
  });
}

/** RS-662 撃破時メレ蘇生。 */
export function startPhoenixMereDestroyChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    partnerName: string;
    /** 「出してもよい」なら true。「※…1枚選び、出す」は強制なので false（省略時）。 */
    optional?: boolean;
  },
): GameState | null {
  const valid = collectNamedUnitsInDiscard(state, params.playerId, params.partnerName);
  if (valid.length === 0) return null;
  const { optional, ...rest } = params;
  return openEffectChoice(state, {
    ...rest,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "rush_from_discard",
    selectCount: 1,
    optional: optional === true,
  });
}

/** RS-472 現場への搬送: コマンド任意枚数捨て→山札M配置。 */
export function startSiteTransportChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    feature: string;
  },
): GameState | null {
  const player = state.players[params.playerId];
  const valid = player.command.map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_commands",
    validInstanceIds: valid,
    selectCount: valid.length,
    commandFilter: "any",
    commandAction: "discard",
    optional: true,
    siteTransportMeta: { step: "discard", feature: params.feature, discardCount: 0 },
  });
}

function openSiteTransportDeckStep(
  state: GameState,
  pending: PendingEffectChoice,
  discardCount: number,
): GameState {
  const player = state.players[pending.playerId];
  const feature = pending.siteTransportMeta?.feature ?? "メカ";
  const valid = player.deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return (
        def?.type === "unit" &&
        def.size === "M" &&
        (def.features ?? []).includes(feature)
      );
    })
    .map((c) => c.instanceId);
  const pickCount = Math.min(discardCount, valid.length);
  if (pickCount <= 0) {
    const shuffled = shuffleDeck(player.deck);
    return clearChoice(
      {
        ...state,
        ...updatePlayer(state, pending.playerId, { ...player, deck: shuffled }),
      },
      pending.phasePlayerId,
    );
  }
  return openEffectChoice(clearChoice(state, pending.phasePlayerId), {
    playerId: pending.playerId,
    effectId: pending.effectId,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    phasePlayerId: pending.phasePlayerId,
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    selectCount: pickCount,
    optional: true,
    siteTransportMeta: { step: "deck", feature, discardCount },
  });
}

/** RS-411: 山札からDA常駐OPを常駐置き場へ。 */
export function startOnRushDeckResidentChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const player = state.players[params.playerId];
  const valid = player.deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return (
        def?.type === "operation" &&
        def.category === "DA" &&
        (def.tags?.includes("常駐") || def.text?.includes("※常駐"))
      );
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    unitDestination: "rush",
    selectCount: 1,
    optional: true,
  });
}

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** RS-178 sagas_sniper: 山札全体を確認；対象ユニット1枚を選択（パワーコスト ≤ 上限）、その後シャッフル。 */
export function startSagasSniperChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    maxPowerCost: number;
  },
): GameState | null {
  const player = state.players[params.playerId];
  if (player.deck.length === 0) return null;

  const viewedInstanceIds = player.deck.map((c) => c.instanceId);
  const validInstanceIds = player.deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit") return false;
      return parsePowerCost(def.powerCost ?? 99) <= params.maxPowerCost;
    })
    .map((c) => c.instanceId);

  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: "sagas_sniper",
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "scry_keep_one",
    viewedInstanceIds,
    validInstanceIds,
    maxPowerCost: params.maxPowerCost,
    selectCount: 1,
    optional: true,
  });
}

/** RS-177 airlift: 山札からJC L/Rを選択してラッシュ、残りをシャッフル。 */
export function startDeckJointComboSearch(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    optional?: boolean;
  },
): GameState | null {
  const player = state.players[params.playerId];
  const valid = player.deck
    .filter((c) => {
      const cn = getDefinition(state.definitions, c.cardId)?.comboNumber;
      return cn === "L" || cn === "R";
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    unitDestination: "rush",
    selectCount: 1,
    optional: params.optional ?? true,
  });
}

/** RS-106 ジュウクンドー: 敵ラッシュユニットを複数選択（印刷BP合計 ≤ 予算）。 */
export function startJuuKunDoChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    optional?: boolean;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const validInstanceIds = state.players[enemyId].rush.map((c) => c.instanceId);
  const optional = params.optional ?? true;
  if (validInstanceIds.length === 0 && !optional) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_units_bp_budget",
    validInstanceIds,
    bpBudget: 3000,
    selectedInstanceIds: [],
    optional,
  });
}

export function printedBpForInstance(
  state: GameState,
  instanceId: string,
): number | null {
  const located = findCardOwner(state, instanceId);
  if (!located) return null;
  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, instanceId);
  if (!found) return null;
  return unitBp(getDefinition(state.definitions, found.card.cardId));
}

/**
 * BP 合計上限の選択で数える BP。RS-106 ジュウクンドーは「本来のBP」、
 * RS-125 百獣アニマルハートは補正後の BP（faq-card-3 RS-125 Q1「BPの補正分も含めての合計」）。
 */
export function budgetBpForInstance(
  state: GameState,
  instanceId: string,
  pending?: PendingEffectChoice,
): number | null {
  if (pending?.effectId !== "animal_heart") return printedBpForInstance(state, instanceId);
  const located = findCardOwner(state, instanceId);
  if (!located) return null;
  const found = findInZone(state.players[located.playerId], located.zone, instanceId);
  if (!found) return null;
  return effectiveBp(state, located.playerId, found.card);
}

export function selectedPrintedBpSum(
  state: GameState,
  selectedIds: string[],
  pending?: PendingEffectChoice,
): number {
  let sum = 0;
  for (const id of selectedIds) {
    sum += budgetBpForInstance(state, id, pending) ?? 0;
  }
  return sum;
}

export function canToggleBpBudgetTarget(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): boolean {
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.includes(instanceId)) return true;
  const bp = budgetBpForInstance(state, instanceId, pending);
  if (bp === null) return false;
  const budget = pending.bpBudget ?? 3000;
  if (selectedPrintedBpSum(state, selected, pending) + bp > budget) return false;
  const maxCount = pending.selectCount;
  if (maxCount !== undefined && selected.length >= maxCount) return false;
  return true;
}

/** RS-125 天地轟鳴アニマルハート: 印刷BP予算内の敵ユニットを複数選択。 */
export function startAnimalHeartChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    validInstanceIds: string[];
    bpBudget: number;
    selectCount: number;
    optional?: boolean;
  },
): GameState | null {
  if (params.validInstanceIds.length === 0 && !params.optional) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_units_bp_budget",
    selectedInstanceIds: [],
    optional: params.optional ?? true,
  });
}

export const HAJA_BLADE_EFFECT_ID = "assault_vector_destroy";

/** RS-181 破邪百獣剣: 選んだユニットを1体ずつ撃破する（離場反応で中断したら再開する）。 */
function finishAssaultVectorDestroy(state: GameState, pending: PendingEffectChoice): ChoiceOutcome {
  const selected = pending.selectedInstanceIds ?? [];
  const processed = [...(pending.processedInstanceIds ?? [])];
  let nextState = state;
  for (const instanceId of selected) {
    if (processed.includes(instanceId)) continue;
    processed.push(instanceId);
    const located = findCardOwner(nextState, instanceId);
    if (!located || (located.zone !== "rush" && located.zone !== "battle")) continue;
    const leave = applyUnitLeave(nextState, instanceId, "discard", pending.phasePlayerId);
    if ("error" in leave) return leave;
    nextState = leave.state;
    if (nextState.pendingLeave && processed.length < selected.length) {
      const resumed: PendingEffectChoice = { ...pending, validInstanceIds: [], processedInstanceIds: processed };
      return { state: { ...nextState, pendingEffectChoice: resumed } };
    }
  }
  const names = selected
    .map((id) => cardName(nextState.definitions, findFieldUnitCardId(nextState, id)))
    .join(",");
  return finishChoice(nextState, pending, names || "none");
}

export function applyConfirmEffectChoice(
  state: GameState,
  playerId: PlayerId,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const errata = tryConfirmErrataChoice(state, playerId);
  if (errata) return errata;
  const set4 = tryConfirmSet4Choice(state, playerId);
  if (set4) return set4;
  const set5a = tryConfirmSet5AChoice(state, playerId);
  if (set5a) return set5a;

  if (pending.mayConfirm) {
    const log = buildLogEntry(
      pending.playerId,
      "resolve_effect_choice",
      pending.sourceCardId,
      state.definitions,
      `${pending.effectId}:accept`,
    );
    const next = acceptOptionalEffect(state, pending);
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next), log };
  }

  if (pending.effectId === HAJA_BLADE_EFFECT_ID) {
    return finishAssaultVectorDestroy(state, pending);
  }
  if (isRs4NcChoice(pending)) {
    const next = confirmRs4NcChoice(state, pending);
    if (!next) return { error: "invalid_choice_kind" };
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }

  if (pending.effectId === FIRE_DANCE_EFFECT_ID) {
    // 「数まで」— 選んだところで確定する。
    return finishChoice(state, pending, String(pending.processedInstanceIds?.length ?? 0));
  }

  if (pending.effectId === HOUOU_TORNADO_EFFECT_ID) {
    const next = finishHououOwnStep(state, pending);
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }

  if (pending.kind === "select_units_bp_budget") {
    const selected = pending.selectedInstanceIds ?? [];
    let nextState = state;
    const processed = [...(pending.processedInstanceIds ?? [])];
    for (const instanceId of selected) {
      // ルール: R-TGT-03 — 一度処理した対象（ダイノガッツで留まった等）は再び撃破しない。
      if (processed.includes(instanceId)) continue;
      processed.push(instanceId);
      // ルール: R-TIME-04 — 割り込み（マンドラ坊やの鳴き声等）で場を離れた対象は飛ばして撃破処理を続ける。
      const located = findCardOwner(nextState, instanceId);
      if (!located || (located.zone !== "rush" && located.zone !== "battle")) continue;
      const leave = applyUnitLeave(
        nextState,
        instanceId,
        "discard",
        pending.phasePlayerId,
      );
      if ("error" in leave) return leave;
      nextState = leave.state;
      if (nextState.pendingLeave) {
        // 離場反応の解決後に、残りの対象の撃破を再開する。
        const resumed: PendingEffectChoice = { ...pending, processedInstanceIds: processed };
        return { state: { ...nextState, pendingEffectChoice: resumed } };
      }
    }
    const names = selected
      .map((id) => cardName(nextState.definitions, findFieldUnitCardId(nextState, id)))
      .join(",");
    const finished = finishChoice(nextState, pending, names || "none");
    if ("error" in finished) return finished;
    // ルール: R-ERR-RS106 — 「そうしたとき、これはアタックすることができない」。撃破していなければアタックできる。
    if (pending.effectId === "juu_kun_do" && selected.length > 0) {
      return {
        ...finished,
        state: markJuuKunDoAttackerActed(
          finished.state,
          pending.playerId,
          pending.sourceInstanceId,
        ),
      };
    }
    return finished;
  }

  if (pending.kind === "select_commands" && pending.siteTransportMeta?.step === "discard") {
    const selected = pending.selectedInstanceIds ?? [];
    let nextState = state;
    const player = nextState.players[pending.playerId];
    let command = [...player.command];
    const discard = [...player.discard];
    for (const cmdId of selected) {
      const found = findInZone({ ...player, command }, "command", cmdId);
      if (!found) continue;
      const removed = command.splice(found.index, 1)[0];
      if (removed) discard.push(removed);
    }
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, pending.playerId, { ...player, command, discard }),
    };
    return { state: openSiteTransportDeckStep(nextState, pending, selected.length) };
  }

  return { error: "invalid_choice_kind" };
}

export function startTyrannoSonicChoice(
  state: GameState,
  rusherId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const ownTargets = collectFieldUnitIds(state, rusherId, 5000);
  if (ownTargets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: rusherId,
    effectId: "tyranno_sonic",
    sourceCardId,
    kind: "select_unit_step",
    step: "own",
    phasePlayerId,
    validInstanceIds: ownTargets,
    maxBp: 5000,
    unitDestination: "discard",
    optional: true,
  });
}

/** RS-168 cross_thunder: destroy one own and one enemy unit with BP ≤ maxBp. */
export function startCrossThunderChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId = opponent(playerId);
  const ownTargets = collectFieldUnitIds(state, playerId, 5000);
  const enemyTargets = collectFieldUnitIds(state, enemyId, 5000);
  if (ownTargets.length === 0 || enemyTargets.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "cross_thunder",
    sourceCardId,
    kind: "select_unit_step",
    step: "own",
    phasePlayerId,
    validInstanceIds: ownTargets,
    maxBp: 5000,
    unitDestination: "discard",
    optional: true,
  });
}

export function startMultiCommandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    selectCount: number;
    commandFilter: "held" | "released" | "any";
    commandAction: PendingEffectChoice["commandAction"];
    optional?: boolean;
    validInstanceIds?: string[];
    sourceInstanceId?: string;
  },
): GameState | null {
  const valid =
    params.validInstanceIds ??
    collectCommandIds(state, params.playerId, params.commandFilter);
  if (valid.length === 0 && !params.optional) return null;
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "select_commands",
    validInstanceIds: valid,
    selectCount: Math.min(params.selectCount, valid.length),
    commandFilter: params.commandFilter,
    commandAction: params.commandAction,
    optional: params.optional,
  });
}

export function startSelectCommandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    commandFilter: "held" | "released" | "any";
    commandAction: PendingEffectChoice["commandAction"];
    optional?: boolean;
    validInstanceIds?: string[];
    sourceInstanceId?: string;
    /** 選ぶ（ホールドする）数。既定 1。 */
    selectCount?: number;
  },
): GameState | null {
  const valid =
    params.validInstanceIds ??
    collectCommandIds(state, params.playerId, params.commandFilter);
  const selectCount = params.selectCount ?? 1;
  if (valid.length === 0 || valid.length < selectCount) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    kind: "select_command",
    phasePlayerId: params.phasePlayerId,
    validInstanceIds: valid,
    selectCount,
    commandAction: params.commandAction,
    commandFilter: params.commandFilter,
    optional: params.optional,
  });
}

export function startSelectPowerChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
    selectCount: number;
    optional?: boolean;
  },
): GameState | null {
  const valid = collectPowerIds(state, params.playerId);
  if (valid.length < params.selectCount) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_power",
    validInstanceIds: valid,
    selectCount: params.selectCount,
    optional: params.optional ?? true,
  });
}

/** RS-130 ファイヤーソード: 常駐オペレーションを任意でパワーへ。 */
export function startFireSwordOperationChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const valid = [
    ...state.players[params.playerId].operation,
    ...state.players[opponent(params.playerId)].operation,
  ].map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: "fire_sword",
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "power",
    optional: true,
    selectCount: 1,
  });
}

export function startSelectHandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
    cardId?: string;
    cardName?: string;
    optional?: boolean;
  },
): GameState | null {
  const valid = params.cardId
    ? collectHandIdsByCardId(state, params.playerId, params.cardId)
    : params.cardName
      ? collectHandIdsByName(state, params.playerId, params.cardName)
      : state.players[params.playerId].hand.map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    kind: "select_hand",
    phasePlayerId: params.phasePlayerId,
    validInstanceIds: valid,
    selectCount: 1,
    optional: params.optional ?? true,
  });
}

/** RS-630 メガトマホーク: コマンド3枚以下なら手札1枚をコマンドホールド。 */
export function tryStartMegatomahokuChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const player = state.players[playerId];
  if (player.command.length > 3 || player.hand.length === 0) return null;
  return startSelectHandChoice(state, {
    playerId,
    effectId: "megatomahoku",
    sourceCardId,
    sourceInstanceId,
    phasePlayerId,
    optional: true,
  });
}

/** 「見てもよい」— 見ない（skip）なら山札は変わらない。出典: RS-063 atwiki/page-265。 */
export function startRadialHammerChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  const player = state.players[playerId];
  if (player.deck.length === 0) return null;
  const count = Math.min(3, player.deck.length);
  const viewed = player.deck.slice(0, count).map((c) => c.instanceId);
  return openEffectChoice(state, {
    playerId,
    effectId: "radial_hammer",
    sourceCardId,
    sourceInstanceId,
    kind: "scry_keep_one",
    phasePlayerId: playerId,
    validInstanceIds: viewed,
    viewedInstanceIds: viewed,
    selectCount: 1,
    optional: true,
  });
}

export function startPitInDiveOrderChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  const valid = collectEnemyRushSmallIds(state, playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "pit_in_dive",
    sourceCardId,
    sourceInstanceId,
    kind: "pit_in_dive_order",
    phasePlayerId: playerId,
    validInstanceIds: valid,
    selectCount: valid.length,
    optional: true,
  });
}

/** 捨札から手札に戻す選択で、捨札を見るプレイヤー（RS-094【幽魔吸収】は敵軍捨札から持ち主の手札へ）。 */
function handFromDiscardOwner(pending: PendingEffectChoice): PlayerId {
  return pending.effectId === "ghost_absorption" ? opponent(pending.playerId) : pending.playerId;
}

/**
 * RS-094【幽魔吸収】「そうしたとき、このターンこのユニットのBPは相手の手札に戻したカードのBPとの合計になり、SP1になる」。
 * 「～になる」なので指定値（bpSetValue / spOverride。ターン終了で消える）として扱う（R-BP-01）。
 */
function applyGhostAbsorption(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  returnedCardId: string,
): GameState {
  const actor = state.players[playerId];
  const unit = actor.battle.find((c) => c.instanceId === sourceInstanceId);
  if (!unit) return state;
  const returnedBp = unitBp(getDefinition(state.definitions, returnedCardId));
  const total = effectiveBp(state, playerId, unit) + returnedBp;
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...actor,
      battle: actor.battle.map((c) =>
        c.instanceId === sourceInstanceId ? { ...c, bpSetValue: total, spOverride: 1 } : c,
      ),
    }),
  };
}

function clearChoice(state: GameState, phasePlayerId: PlayerId): GameState {
  return {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: phasePlayerId,
  };
}

function unitLeaveDestination(
  dest: NonNullable<PendingEffectChoice["unitDestination"]> | "discard",
): "power" | "discard" | "deck_top" {
  return dest === "power" ? "power" : dest === "deck_top" ? "deck_top" : "discard";
}

/** XG2-042 / XP-005: ユニットでなくなるとき、オモテ向き自軍パワーの「仮面ライダー」を1枚捨札にして留まる（自動適用）。 */
function tryRegisterStayOnLeave(
  state: GameState,
  instanceId: string,
): GameState | null {
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const zone of ["battle", "rush"] as const) {
      const card = player[zone].find((c) => c.instanceId === instanceId);
      if (!card) continue;
      if (!cardHasGrantKeyword(card.cardId, "register_stay_on_power_discard_raida")) return null;
      const idx = player.power.findIndex((c) => {
        if (c.faceDown) return false;
        const def = getDefinition(state.definitions, c.cardId);
        return (def?.features ?? []).includes("仮面ライダー");
      });
      if (idx < 0) return null;
      const paid = player.power[idx]!;
      return {
        ...state,
        ...updatePlayer(state, pid, {
          ...player,
          power: player.power.filter((_, i) => i !== idx),
          discard: [...player.discard, paid],
        }),
      };
    }
  }
  return null;
}

export function applyUnitLeave(
  state: GameState,
  instanceId: string,
  destination: "power" | "discard" | "deck_top",
  phasePlayerId: PlayerId,
): ChoiceOutcome {
  {
    const stayed = tryRegisterStayOnLeave(state, instanceId);
    if (stayed) return { state: stayed };
  }
  const located = findCardOwner(state, instanceId);
  if (!located || (located.zone !== "rush" && located.zone !== "battle")) {
    return { error: "invalid_target" };
  }

  if (destination === "deck_top") {
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, instanceId);
    if (!found) return { error: "invalid_target" };
    const [, zoneCards] = removeAt(owner[located.zone], found.index);
    const nextOwner = {
      ...owner,
      [located.zone]: zoneCards,
      deck: [found.card, ...owner.deck],
    };
    return {
      state: { ...state, ...updatePlayer(state, located.playerId, nextOwner) },
    };
  }

  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, instanceId);
  if (!found) return { error: "invalid_target" };

  const toZone = destination === "power" ? "power" : "discard";
  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: located.playerId,
    instanceId,
    fromZone: located.zone,
    toZone,
    leavingCardId: found.card.cardId,
    phasePlayerId,
  });

  if (leaveResult.deferred) {
    return { state: leaveResult.state };
  }
  return { state: leaveResult.state };
}

function findFieldUnitCardId(state: GameState, instanceId: string): string {
  const located = findCardOwner(state, instanceId);
  if (!located) return instanceId;
  const found = findInZone(state.players[located.playerId], located.zone, instanceId);
  return found?.card.cardId ?? instanceId;
}

function cardNameForInstance(state: GameState, instanceId: string): string {
  const located = findCardOwner(state, instanceId);
  if (located) {
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, instanceId);
    if (found) return cardName(state.definitions, found.card.cardId);
  }
  const command = findCommandCard(state, instanceId);
  if (command) return cardName(state.definitions, command.card.cardId);
  return instanceId;
}

function formatInstanceIdsAsNames(state: GameState, instanceIds: string[]): string {
  return instanceIds.map((id) => cardNameForInstance(state, id)).join("、");
}

function findCommandCard(
  state: GameState,
  instanceId: string,
): { playerId: PlayerId; index: number; card: CardInstance } | null {
  for (const pid of ["player1", "player2"] as const) {
    const found = findInZone(state.players[pid], "command", instanceId);
    if (found) {
      return { playerId: pid, index: found.index, card: found.card };
    }
  }
  return null;
}

function finishSeabedDrawChoice(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
): ChoiceOutcome {
  const cleared = clearChoice(state, pending.phasePlayerId);
  const resume = pending.seabedDrawMeta?.resume;
  if (resume?.pending.kurokoMeta) {
    return { state: continueKurokoMemoryAfterDraw(cleared, resume.pending) };
  }
  if (resume) {
    return finishChoice(cleared, resume.pending, resume.detail);
  }
  return finishChoice(cleared, pending, detail);
}

/**
 * ルール: R-CN-04 — 自軍バトルフェイズ中に相手の効果で出された自軍ユニットは、自分で出したときと同じように扱う
 * （NC の条件がそろえば発動し、アタック・ストライクできる）。その時点でバトル進入の処理中だったユニットは
 * 「なにもしない」を選んだのと同じになりアタックできない（faq-card-3 RS-141 Q1）。
 */
function treatOpponentDeployedAsOwnEntry(
  state: GameState,
  ownerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
  pending: PendingEffectChoice,
): GameState {
  if (state.phase !== "battle" || pending.phasePlayerId !== ownerId || pending.playerId === ownerId) {
    return state;
  }
  let next = state;
  const previous = next.deferredBattleEntry ?? next.pendingBattleEntry;
  if (previous && previous.playerId === ownerId && previous.instanceId !== card.instanceId) {
    const owner = next.players[ownerId];
    next = {
      ...next,
      ...updatePlayer(next, ownerId, {
        ...owner,
        battle: owner.battle.map((c) =>
          c.instanceId === previous.instanceId ? { ...c, battleActed: true } : c,
        ),
      }),
      pendingBattleEntry: undefined,
    };
  }
  return {
    ...next,
    deferredBattleEntry: {
      playerId: ownerId,
      instanceId: card.instanceId,
      phasePlayerId: ownerId,
      resumeEnterBattle: {
        battlePosition: countLogicalBattleSlots(battleBeforeEnter) + 1,
        battleBeforeEnterInstanceIds: battleBeforeEnter.map((c) => c.instanceId),
        from: "conditional",
      },
    },
  };
}

const GREEN_CRUSH_EFFECT_ID = "green_crush";

/**
 * RS-108【グリーンクラッシュ】: 「Sユニットを2体まで選んでバトルエリアに出してもよい（出す順番は自分が選ぶ）」。
 * 1体出すごとに呼ばれ、2体目を選べるなら選択を開き直す（任意）。出し終えたら、出したユニットの
 * 「バトルエリアに出たとき」（RS-115 ウルザード: 相手＝グリーンクラッシュの使用者は1枚ドローしてもよい。
 * faq-card-2 RS-115 Q1、R-TIME-08）を処理する。
 */
function continueGreenCrush(
  state: GameState,
  pending: PendingEffectChoice,
  enemyId: PlayerId,
  deployedCard: CardInstance,
): ChoiceOutcome {
  const processed = [...(pending.processedInstanceIds ?? []), deployedCard.instanceId];
  const next: PendingEffectChoice = { ...pending, processedInstanceIds: processed };
  const remaining = processed.length < 2 ? greenCrushTargets(state, enemyId) : [];
  if (remaining.length > 0) {
    return {
      state: openEffectChoice(clearChoice(state, pending.playerId), {
        ...next,
        validInstanceIds: remaining,
        selectedInstanceIds: [],
        optional: true,
      }),
      log: buildLogEntry(
        pending.playerId,
        "resolve_effect_choice",
        pending.sourceCardId,
        state.definitions,
        `${pending.effectId}:${cardName(state.definitions, deployedCard.cardId)}`,
      ),
    };
  }
  return finishGreenCrush(state, next, enemyId, cardName(state.definitions, deployedCard.cardId));
}

function finishGreenCrush(
  state: GameState,
  pending: PendingEffectChoice,
  enemyId: PlayerId,
  detail: string,
): ChoiceOutcome {
  const finished = finishChoice(state, pending, detail);
  if ("error" in finished || finished.state.pendingEffectChoice) return finished;
  const enemyBattle = finished.state.players[enemyId].battle;
  const urzards = (pending.processedInstanceIds ?? []).filter((id) =>
    enemyBattle.some((c) => c.instanceId === id && c.cardId === "RS-115"),
  );
  let resume: PendingEffectChoice | undefined;
  let next = finished.state;
  for (let i = urzards.length - 1; i >= 0; i -= 1) {
    const opened = startOpponentMayDrawChoice(next, pending.playerId, pending.phasePlayerId);
    if (!opened?.pendingEffectChoice) break;
    resume = { ...opened.pendingEffectChoice, resumeChoice: resume };
  }
  if (resume) next = openEffectChoice(next, resume);
  return { ...finished, state: next };
}

/** 選択の再開チェーンの最後に、続けて開く選択を足す。 */
function appendResumeChoice(
  choice: PendingEffectChoice,
  next: PendingEffectChoice,
): PendingEffectChoice {
  return {
    ...choice,
    resumeChoice: choice.resumeChoice ? appendResumeChoice(choice.resumeChoice, next) : next,
  };
}

function finishChoice(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
): ChoiceOutcome {
  const log = buildLogEntry(
    pending.playerId,
    "resolve_effect_choice",
    pending.sourceCardId,
    state.definitions,
    `${pending.effectId}:${detail}`,
  );
  if (pending.resumeChoice) {
    // 割り込んだ効果の解決後、中断していた元の効果の選択を再開する。
    let base = clearChoice(state, pending.phasePlayerId);
    const deferred = base.deferredBattleEntry;
    if (deferred && deferred.playerId === pending.phasePlayerId && pending.playerId !== deferred.playerId) {
      // 相手の効果（ジェットファルコン【ファルコンクロー】等）で出された自軍ユニットの進入時の処理（NC 等）は、
      // 元の効果を再開する前に解決する（faq-card-3 RS-135 Q4・RS-141 Q1）。
      const promoted = promoteDeferredBattleEntry(base);
      if (promoted.pendingEffectChoice) {
        const opened = promoted.pendingEffectChoice;
        return {
          state: { ...promoted, pendingEffectChoice: appendResumeChoice(opened, pending.resumeChoice) },
          log,
        };
      }
      base = promoted;
    }
    return {
      state: openEffectChoice(base, pending.resumeChoice),
      log,
    };
  }
  return {
    state: promoteDeferredBattleEntry(clearChoice(state, pending.phasePlayerId)),
    log,
  };
}


/**
 * select_command（hold）解決後の効果別の継続処理。
 * 直接解決（resolve_effect_choice）と effect_hold 支払い完了の両経路から呼ぶ。
 */
function applyPostHoldContinuation(
  state: GameState,
  pending: PendingEffectChoice,
): { state: GameState; done: boolean } {
  if (pending.effectId === KUROKO_MEMORY_EFFECT_ID && pending.kurokoMeta) {
    return { state: continueKurokoMemoryAfterHold(state, pending), done: true };
  }
  if (pending.effectId === EFFECT_RUSH_MOTHERSHIP) {
    return { state: continueEffectRushAfterMothershipHold(state), done: true };
  }
  if (pending.effectId === "castoff_hold_command") {
    const continued = continueCastoffAfterHold(state, pending);
    if (continued) return { state: continued, done: true };
  }
  let nextState = state;
  if (pending.effectId === "shift_up" && pending.sourceInstanceId) {
    const actor = nextState.players[pending.playerId];
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, pending.playerId, {
        ...actor,
        // 「次の能力を得る⇒「SP1」」— SP1 になる（加算しない）。
        battle: actor.battle.map((c) =>
          c.instanceId === pending.sourceInstanceId ? withSpBecomes(state.definitions, actor.battle, c, 1) : c,
        ),
      }),
    };
  }
  if (
    pending.effectId === "dino_slasher_category_balance" &&
    pending.zoneCategoryBalanceOwnerId !== undefined &&
    pending.zoneCategoryTargetCount !== undefined
  ) {
    const ownerId = pending.zoneCategoryBalanceOwnerId;
    const enemyCount = countDistinctCategoriesInCommandZone(
      nextState.players[pending.playerId],
      nextState.definitions,
    );
    if (enemyCount > pending.zoneCategoryTargetCount) {
      const continued = beginDinoSlasherDiscard(nextState, {
        effectOwnerId: ownerId,
        effectId: pending.effectId,
        sourceCardId: pending.sourceCardId,
        sourceInstanceId: pending.sourceInstanceId,
        phasePlayerId: pending.phasePlayerId,
      });
      if (continued) return { state: continued, done: true };
    }
  }
  if (pending.effectId === "megasuringu") {
    nextState = applyMegasuringuEnemyRushSBpDebuff(nextState, pending.playerId);
  }
  // RK-065 等: OT コマンドをホールドしたら自身が「SP1」になる。
  if (pending.effectId === "hold_ot_commands_then_sp" && pending.sourceInstanceId) {
    const actor = nextState.players[pending.playerId];
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, pending.playerId, {
        ...actor,
        battle: actor.battle.map((c) =>
          c.instanceId === pending.sourceInstanceId ? { ...c, spOverride: 1 } : c,
        ),
      }),
    };
  }
  return { state: nextState, done: false };
}

export function completeEffectHoldChoice(
  state: GameState,
  playerId: PlayerId,
  commandInstanceIds: string[],
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (pending.commandAction !== "hold") return { error: "invalid_payment" };
  const selectCount = pending.selectCount ?? 1;
  if (commandInstanceIds.length !== selectCount) return { error: "wrong_count" };
  for (const id of commandInstanceIds) {
    if (!pending.validInstanceIds.includes(id)) return { error: "invalid_target" };
  }
  const continued = applyPostHoldContinuation(state, pending);
  if (continued.done) return { state: continued.state };
  return finishChoice(
    continued.state,
    pending,
    formatInstanceIdsAsNames(state, commandInstanceIds),
  );
}

export function skipEffectChoice(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  const errata = trySkipErrataChoice(state, playerId);
  if (errata) return errata;
  const set4 = trySkipSet4Choice(state, playerId);
  if (set4) return set4;
  const set5a = trySkipSet5AChoice(state, playerId);
  if (set5a) return set5a;
  const set6b = trySkipSet6BChoice(state, playerId);
  if (set6b) return set6b;
  const set5 = trySkipSet5Choice(state, playerId);
  if (set5) return set5;
  const set5Audit = trySkipSet5AuditChoice(state, playerId);
  if (set5Audit) return set5Audit;
  if (isEffectRushChoice(pending)) return skipEffectRushChoice(state, playerId);
  if (pending.effectId === SUPER_BRAIN_KEEP_EFFECT_ID) {
    // 選択を省略したときは先にひいた1枚を手札に残す（どちらか1枚は必ず残る）。
    return resolveSuperBrainKeepChoice(state, playerId, pending.validInstanceIds[0]!);
  }
  if (pending.effectId === KUROKO_MEMORY_EFFECT_ID && pending.kurokoMeta) {
    const result = skipKurokoMemoryChoice(state, playerId);
    if ("error" in result) return result;
    const next = result.state.pendingEffectChoice ? result.state : promoteDeferredBattleEntry(result.state);
    return { state: next, log: result.log };
  }
  if (isRs4NcChoice(pending) && (pending.selectedInstanceIds?.length ?? 0) > 0) {
    // RS-205: 選び終えた（好きな数）— 選んだコマンドをホールドして撃破へ。
    const next = confirmRs4NcChoice(state, pending);
    if (next) return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }
  if (pending.effectId === HAJA_BLADE_EFFECT_ID && (pending.selectedInstanceIds?.length ?? 0) > 0) {
    // RS-181: 選び終えた — 選んだユニットを撃破する。
    return finishAssaultVectorDestroy(state, pending);
  }
  if (pending.effectId === HOUOU_TORNADO_EFFECT_ID && (pending.processedInstanceIds?.length ?? 0) > 0) {
    // 選び終えた — 戻した数だけ相手が自分の S ユニットを戻す。
    const next = finishHououOwnStep(state, pending);
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }
  if (!pending.optional) {
    const hasValidTarget = pending.validInstanceIds.some((instanceId) =>
      isValidEffectChoiceTarget(state, pending, instanceId),
    );
    if (!hasValidTarget) {
      return finishChoice(state, pending, "skipped");
    }
    return { error: "cannot_skip" };
  }
  if (pending.kind === "seabed_draw") {
    return applySeabedDrawSkip(state, playerId);
  }
  if (pending.effectId === GREEN_CRUSH_EFFECT_ID && (pending.processedInstanceIds?.length ?? 0) > 0) {
    // RS-108: 1体目を出したあと2体目を出さないことを選んだ — 出したユニットの「出たとき」を処理する。
    return finishGreenCrush(state, pending, opponent(playerId), "skipped");
  }
  if (pending.effectId === LION_DANCE_EFFECT_ID) {
    // RS-100【超忍法・舞獅子】: 出さないことを選んでも「その後、山札をシャッフルする」。
    const player = state.players[playerId];
    return finishChoice(
      { ...state, ...updatePlayer(state, playerId, { ...player, deck: shuffleDeck(player.deck) }) },
      pending,
      "skipped",
    );
  }
  // RS-335【マジボルト】の自分のドロー（optional_deck_draw）は見送っても、1枚でもひいていれば相手のドローへ進む
  // （faq-card-5 RS-335 Q1）。汎用の optional_deck_draw の見送りより先に判定する。
  if (pending.effectId === "magi_blue_self_draw_1") {
    const chained = continueMagiBlueAfterSelfDraw(
      { ...state, pendingEffectChoice: undefined },
      pending.playerId,
      pending.sourceCardId,
      pending.phasePlayerId,
      1,
      false,
    );
    if (chained.pendingEffectChoice) return { state: chained };
    return finishChoice(state, pending, "skipped");
  }
  if (pending.effectId === "magi_blue_self_draw_2") {
    const chained = continueMagiBlueAfterSelfDraw(
      { ...state, pendingEffectChoice: undefined },
      pending.playerId,
      pending.sourceCardId,
      pending.phasePlayerId,
      2,
      pending.magiBlueMeta?.drewAny ?? false,
    );
    if (chained.pendingEffectChoice) return { state: chained };
    return finishChoice(state, pending, "skipped");
  }
  if (pending.kind === "optional_deck_draw") {
    return finishChoice(state, pending, "skipped");
  }
  if (pending.effectId === "morph_replacement" && pending.morphMeta?.activeMorphUnitInstanceId) {
    const next = continueMorphAfterReplacement(
      { ...state, pendingEffectChoice: undefined },
      pending.morphMeta,
      pending.morphMeta.activeMorphUnitInstanceId,
    );
    return {
      state: next,
      log: buildLogEntry(
        playerId,
        "skip_effect_choice",
        pending.sourceCardId,
        state.definitions,
        "morph_replacement:skipped",
      ),
    };
  }
  if (pending.effectId === "kamen_ride_morph") {
    return finishChoice(state, pending, "skipped");
  }
  if (pending.effectId === "kamen_ride_deploy") {
    // 「2枚まで」— スキップ時、選択済みがあればその分だけ展開して確定。
    const selected = pending.selectedInstanceIds ?? [];
    if (selected.length === 0) return finishChoice(state, pending, "skipped");
    const deployed = applyKamenRideDeploy(
      clearChoice(state, pending.phasePlayerId),
      pending,
      selected,
    );
    return finishChoice(deployed, pending, formatInstanceIdsAsNames(state, selected));
  }
  if (pending.effectId === "to_power_on_destroy") {
    const { state: discarded, log } = completeToPowerOnDestroyChoice(state, pending, false);
    const followUp = pending.toPowerOnDestroyMeta?.pendingLeave.followUpAttackerLeave;
    if (followUp) {
      const next = tryLeaveField(discarded, {
        ...followUp,
        phasePlayerId: followUp.phasePlayerId,
      });
      return { state: next.state, log };
    }
    return { state: discarded, log };
  }
  return finishChoice(state, pending, "skipped");
}

export function applyEffectChoicePlacement(
  state: GameState,
  playerId: PlayerId,
  placement: "top" | "bottom",
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "deck_top_or_bottom") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const player = state.players[playerId];
  const top = player.deck[0];
  if (!top || top.instanceId !== pending.viewedInstanceIds?.[0]) {
    return { error: "invalid_scry" };
  }

  let nextPlayer = player;
  if (placement === "bottom") {
    const [card, rest] = removeAt(player.deck, 0);
    nextPlayer = { ...player, deck: [...rest, card] };
  }

  return finishChoice(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending,
    placement,
  );
}

export function applyEffectChoiceSelect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const errata = tryResolveErrataChoice(state, playerId, instanceId);
  if (errata) return errata;
  const set4 = tryResolveSet4Choice(state, playerId, instanceId);
  if (set4) return set4;
  const set5a = tryResolveSet5AChoice(state, playerId, instanceId);
  if (set5a) return set5a;
  const set6b = tryResolveSet6BChoice(state, playerId, instanceId);
  if (set6b) return set6b;
  const set5 = tryResolveSet5Choice(state, playerId, instanceId);
  if (set5) return set5;
  const set5Audit = tryResolveSet5AuditChoice(state, playerId, instanceId);
  if (set5Audit) return set5Audit;
  if (isEffectRushChoice(pending)) return resolveEffectRushChoice(state, playerId, instanceId);
  if (pending.mayConfirm) {
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    return applyConfirmEffectChoice(state, playerId);
  }
  if (isRs4NcChoice(pending)) {
    // RS-201/205/206/207 の NC 効果の選択（rules/rs4NcEffects.ts）。
    const next = selectRs4NcChoice(state, pending, instanceId);
    if ("error" in next) return next;
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }
  if (pending.effectId === SUPER_ELECTRON_EAR_PICK_EFFECT_ID) {
    // RS-200【超電子イヤー】: 元のダメージの数になるまで、パワーゾーンのカードを選びダメージにする。
    const next = pickSuperElectronEarDamage(state, pending, instanceId);
    if (!next) return { error: "invalid_target" };
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next) };
  }
  if (pending.effectId === FIRE_DANCE_EFFECT_ID) {
    // RS-159【ファイヤーダンス】: 選んだ敵軍コマンドを1つずつホールドする。
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const enemyId = opponent(pending.playerId);
    const enemy = state.players[enemyId];
    const found = findInZone(enemy, "command", instanceId);
    if (!found) return { error: "invalid_target" };
    const command = [...enemy.command];
    command[found.index] = { ...found.card, commandHeld: true };
    const next: GameState = { ...state, ...updatePlayer(state, enemyId, { ...enemy, command }) };
    const processed = [...(pending.processedInstanceIds ?? []), instanceId];
    const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
    if (processed.length < (pending.selectCount ?? 1) && remaining.length > 0) {
      return {
        state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: remaining, processedInstanceIds: processed } },
      };
    }
    return finishChoice(next, pending, String(processed.length));
  }
  if (isHououChoice(pending)) {
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = resolveHououPick(state, pending, instanceId);
    if (!next) return { error: "invalid_target" };
    const log = buildLogEntry(playerId, "resolve_effect_choice", pending.sourceCardId, state.definitions, `${pending.effectId}:${cardName(state.definitions, findCardOwnerCardId(state, instanceId))}`);
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next), log };
  }
  if (pending.effectId === SUBMERGE_EFFECT_ID) {
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = resolveSubmergePick(state, pending, instanceId);
    if (!next) return { error: "invalid_target" };
    const log = buildLogEntry(playerId, "resolve_effect_choice", pending.sourceCardId, state.definitions, `${pending.effectId}:${cardName(state.definitions, findCardOwnerCardId(state, instanceId))}`);
    return { state: next.pendingEffectChoice ? next : promoteDeferredBattleEntry(next), log };
  }
  if (pending.effectId === CYCLOPS_SCARLET_EFFECT_ID) {
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const discarded = discardCyclopsResident(state, pending, instanceId);
    if (!discarded) return { error: "invalid_target" };
    // 「そうしたとき、そのユニットを撃破する」（撃破は離場処理を通す）。
    const targetId = pending.sourceInstanceId!;
    const located = findCardOwner(discarded, targetId);
    let next = discarded;
    if (located && (located.zone === "rush" || located.zone === "battle")) {
      const leave = applyUnitLeave(discarded, targetId, "discard", pending.phasePlayerId);
      if (!("error" in leave)) next = leave.state;
    }
    return finishChoice(next, pending, cardName(state.definitions, "RS-417"));
  }
  if (isAbductionChoice(pending.effectId)) {
    const result = resolveAbductionChoice(state, playerId, instanceId);
    if ("error" in result) return result;
    return { state: promoteDeferredBattleEntry(result.state), log: result.log };
  }
  if (isCommandLeaveRefillChoice(pending)) {
    const result = resolveCommandLeaveRefill(state, playerId, instanceId);
    if ("error" in result) return result;
    const next = result.state.pendingEffectChoice ? result.state : promoteDeferredBattleEntry(result.state);
    return { state: next, log: result.log };
  }
  if (pending.effectId === DISPATCH_ORDER_EFFECT_ID) {
    const result = resolveDispatchOrder(state, playerId, instanceId);
    if ("error" in result) return result;
    return { state: promoteDeferredBattleEntry(result.state), log: result.log };
  }
  if (pending.effectId === SUPER_BRAIN_KEEP_EFFECT_ID) {
    return resolveSuperBrainKeepChoice(state, playerId, instanceId);
  }
  if (pending.effectId === SWAN_WING_EFFECT_ID) {
    // RS-284【スワンウィング】を使う（「出してもよい」。使わないときは skip）。
    const cleared = clearChoice(state, pending.phasePlayerId);
    const applied = applySwanWing(cleared, pending.playerId, pending.phasePlayerId);
    const log = buildLogEntry(playerId, "resolve_effect_choice", pending.sourceCardId, state.definitions, "swan_wing");
    // 処理順の選択・「ラッシュされたとき」の窓（相手の応答）が開いていればそのまま返す。
    if (hasPendingPromptBlockingEffectRush(applied)) return { state: applied, log };
    return { state: promoteDeferredBattleEntry(applied), log };
  }
  if (pending.effectId === SWAN_WING_ORDER_EFFECT_ID) {
    const result = resolveSwanWingOrderChoice(state, playerId, instanceId);
    if ("error" in result) return result;
    if (hasPendingPromptBlockingEffectRush(result.state)) return result;
    return { state: promoteDeferredBattleEntry(result.state), log: result.log };
  }
  if (pending.effectId === BEAT_HAMMER_EFFECT_ID) {
    return resolveBeatHammerChoice(state, playerId, instanceId);
  }
  if (pending.effectId === "chikara_tonfua_command_to_damage") {
    // RS-211【稲妻超力トンファ】: 選んだ自分自身のコマンドを自分自身のパワーゾーンにダメージ（ウラ向き）として置く。
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const player = state.players[playerId];
    const found = findInZone(player, "command", instanceId);
    if (!found) return { error: "invalid_target" };
    const [card, command] = removeAt(player.command, found.index);
    const nextPlayer = {
      ...player,
      command,
      power: [...player.power, { ...card, commandHeld: undefined, faceDown: true }],
      damage: player.damage + 1,
    };
    return finishChoice({ ...state, ...updatePlayer(state, playerId, nextPlayer) }, pending, "damage");
  }
  if (pending.effectId === KUROKO_MEMORY_EFFECT_ID && pending.kurokoMeta) {
    const result = resolveKurokoMemoryChoice(state, playerId, instanceId);
    if ("error" in result) return result;
    const next = result.state.pendingEffectChoice ? result.state : promoteDeferredBattleEntry(result.state);
    return { state: next, log: result.log };
  }

  if (pending.effectId === "morph_replacement") {
    const result = resolveMorphReplacementChoice(state, playerId, instanceId);
    if ("error" in result) return { error: result.error };
    let nextState = result.state;
    if (result.extraLogs?.length) {
      nextState = { ...nextState, log: [...nextState.log, ...result.extraLogs] };
    }
    return { state: nextState, log: result.log };
  }

  if (pending.effectId === "kamen_ride_morph") {
    const result = resolveKamenRideMorphChoice(state, playerId, instanceId);
    if ("error" in result) return { error: result.error };
    let nextState = promoteDeferredBattleEntry(
      clearChoice(result.state, pending.phasePlayerId),
    );
    if (result.extraLogs?.length) {
      nextState = { ...nextState, log: [...nextState.log, ...result.extraLogs] };
    }
    return { state: nextState, log: result.log };
  }

  if (pending.effectId === "nihawo" && pending.sphinxQuizMeta?.step === "pick_power") {
    const enemyId = opponent(pending.playerId);
    const enemy = state.players[enemyId];
    const found = enemy.power.find((c) => c.instanceId === instanceId && c.faceDown);
    if (!found) return { error: "invalid_target" };
    const def = getDefinition(state.definitions, found.cardId);
    const actualCost = parsePowerCost(def?.powerCost ?? 0);
    const meta = pending.sphinxQuizMeta!;
    let nextState = setPlayerPowerFace(state, enemyId, instanceId, false);
    nextState = openEffectChoice(clearChoice(nextState, pending.phasePlayerId), {
      playerId: enemyId,
      effectId: "nihawo",
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId,
      phasePlayerId: pending.phasePlayerId,
      kind: "declare_number",
      validInstanceIds: Array.from({ length: 13 }, (_, n) => String(n)),
      optional: false,
      sphinxQuizMeta: {
        step: "declare",
        controllerId: meta.controllerId,
        powerInstanceId: instanceId,
        actualPowerCost: actualCost,
      },
    });
    return { state: nextState };
  }

  if (pending.effectId === "nihawo" && pending.sphinxQuizMeta?.step === "destroy") {
    const meta = pending.sphinxQuizMeta;
    const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
    if ("error" in leave) return leave;
    return finishSphinxQuiz(
      leave.state,
      pending,
      meta.powerInstanceId,
      cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
    );
  }

  const dslResumeSimpleKinds = new Set([
    "select_unit",
    "select_command",
    "select_hand",
    "select_power",
  ]);
  if (pending.dslResume && dslResumeSimpleKinds.has(pending.kind)) {
    const result = continueDslAfterChoice(state, playerId, instanceId, pending);
    if (result.error) return { error: result.error };
    // 進入時の DSL 効果（NC 等）の選択が終わったら、中断していたバトル進入処理を再開する。
    const next = result.state.pendingEffectChoice ? result.state : promoteDeferredBattleEntry(result.state);
    return { state: next, log: result.log };
  }

  const selectedSoFar = pending.selectedInstanceIds ?? [];
  if (pending.kind === "select_units_bp_budget") {
    if (
      !pending.validInstanceIds.includes(instanceId) &&
      !selectedSoFar.includes(instanceId)
    ) {
      return { error: "invalid_target" };
    }
  } else if (!pending.validInstanceIds.includes(instanceId)) {
    return { error: "invalid_target" };
  }

  switch (pending.kind) {
    case "select_units_bp_budget": {
      const selected = pending.selectedInstanceIds ?? [];
      if (selected.includes(instanceId)) {
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected.filter((id) => id !== instanceId),
            },
            activePlayer: playerId,
          },
        };
      }
      if (!canToggleBpBudgetTarget(state, pending, instanceId)) {
        return { error: "bp_budget_exceeded" };
      }
      return {
        state: {
          ...state,
          pendingEffectChoice: {
            ...pending,
            selectedInstanceIds: [...selected, instanceId],
          },
          activePlayer: playerId,
        },
      };
    }
    case "optional_deck_draw": {
      if (instanceId !== "draw") return { error: "invalid_target" };
      if (pending.effectId === "hanga") {
        const nextState = applyHangaEvolutionReveal(
          state,
          playerId,
          pending.sourceInstanceId,
        );
        const player = nextState.players[playerId];
        const revealedId =
          player.rush.at(-1)?.cardId ??
          player.discard.at(-1)?.cardId ??
          pending.sourceCardId;
        return finishChoice(nextState, pending, cardName(state.definitions, revealedId));
      }
      const player = state.players[playerId];
      if (player.deck.length === 0) return { error: "empty_deck" };
      const drawResult = requestDrawFromDeck(state, playerId, pending.phasePlayerId, {
        count: 1,
        sourceCardId: pending.sourceCardId,
        seabedResume: { pending, detail: "draw" },
      });
      if (drawResult.pending) {
        return { state: drawResult.state };
      }
      let nextState = drawResult.state;
      if (pending.effectId === "magi_blue_self_draw_1") {
        nextState = continueMagiBlueAfterSelfDraw(
          nextState,
          playerId,
          pending.sourceCardId,
          pending.phasePlayerId,
          1,
          true,
        );
        if (nextState.pendingEffectChoice) return { state: nextState };
      } else if (pending.effectId === "magi_blue_self_draw_2") {
        nextState = continueMagiBlueAfterSelfDraw(
          nextState,
          playerId,
          pending.sourceCardId,
          pending.phasePlayerId,
          2,
          true,
        );
        if (nextState.pendingEffectChoice) return { state: nextState };
      }
      return finishChoice(nextState, pending, "draw");
    }
    case "declare_number": {
      const declared = Number(instanceId);
      if (!Number.isInteger(declared) || declared < 0 || declared > 12) {
        return { error: "invalid_target" };
      }
      if (pending.effectId === "nihawo" && pending.sphinxQuizMeta?.step === "declare") {
        const meta = pending.sphinxQuizMeta;
        if (declared === meta.actualPowerCost) {
          return finishSphinxQuiz(state, pending, meta.powerInstanceId, String(declared));
        }
        const opponentId = playerId;
        const valid: string[] = [];
        for (const zone of ["battle", "rush"] as const) {
          valid.push(...state.players[opponentId][zone].map((c) => c.instanceId));
        }
        if (valid.length === 0) {
          return finishSphinxQuiz(state, pending, meta.powerInstanceId, String(declared));
        }
        return {
          state: openEffectChoice(clearChoice(state, pending.phasePlayerId), {
            playerId: opponentId,
            effectId: "nihawo",
            sourceCardId: pending.sourceCardId,
            sourceInstanceId: pending.sourceInstanceId,
            phasePlayerId: pending.phasePlayerId,
            kind: "select_unit",
            validInstanceIds: valid,
            unitDestination: "discard",
            optional: false,
            sphinxQuizMeta: { ...meta, step: "destroy" },
          }),
        };
      }
      if (pending.effectId === "declare_number_deck_reveal_destroy") {
        const revealed = resolveDeclareNumberDeckReveal(
          clearChoice(state, pending.phasePlayerId),
          pending,
          declared,
        );
        if (revealed.pendingEffectChoice) return { state: revealed };
        return { state: revealed };
      }
      if (pending.effectId === "senko_sosa_declare") {
        const revealed = resolveSenkoSosa(
          clearChoice(state, pending.phasePlayerId),
          pending,
          declared,
        );
        return { state: revealed };
      }
      const nextState = applyFlowerBombDeclaredNumber(
        state,
        pending.playerId,
        pending.sourceCardId,
        declared,
      );
      return finishChoice(nextState, pending, String(declared));
    }
    case "select_unit": {
      if (pending.effectId === HAJA_BLADE_EFFECT_ID) {
        // RS-181 破邪百獣剣: 先に可能な数まで選んでから1体ずつ撃破する（grnrngr/faq-card-4 RS-181 Q1・R-TGT-03）。
        const prev = pending.selectedInstanceIds ?? [];
        if (prev.includes(instanceId)) return { error: "already_selected" };
        const selected = [...prev, instanceId];
        const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        const next: PendingEffectChoice = { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining };
        if (selected.length < (pending.zoneCategoryDestroyLimit ?? 1) && remaining.length > 0) {
          return { state: { ...state, pendingEffectChoice: next } };
        }
        return finishAssaultVectorDestroy(state, next);
      }
      if (pending.effectId === DENJI_THUNDER_THROW_EFFECT_ID || pending.effectId === DENJI_THUNDER_THROW_DISCARD_EFFECT_ID) {
        const next =
          pending.effectId === DENJI_THUNDER_THROW_EFFECT_ID
            ? resolveDenjiThunderThrowPick(state, instanceId)
            : resolveDenjiThunderThrowDiscard(state, instanceId);
        if (!next) return { error: "invalid_target" };
        if (next.pendingEffectChoice && next.pendingEffectChoice !== pending) return { state: next };
        return finishChoice({ ...next, pendingEffectChoice: pending }, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === GRAP_FIGHTER_EFFECT_ID) {
        const returned = resolveGrapFighterReturn(state, instanceId);
        if (!returned) return { error: "invalid_target" };
        if (returned.pendingEffectChoice?.effectId === GRAP_FIGHTER_BATTLE_EFFECT_ID) return { state: returned };
        return finishChoice({ ...returned, pendingEffectChoice: pending }, pending, "damage");
      }
      if (pending.effectId === GRAP_FIGHTER_BATTLE_EFFECT_ID) {
        if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
        const returnedId = pending.processedInstanceIds?.[0];
        if (!returnedId) return { error: "invalid_target" };
        const losers = grapFighterLosers(state, returnedId, instanceId);
        return applyConfirmEffectChoice(
          {
            ...state,
            pendingEffectChoice: {
              ...pending,
              kind: "select_units_bp_budget",
              selectedInstanceIds: losers,
              processedInstanceIds: [],
            },
          },
          pending.playerId,
        );
      }
      if (pending.effectId === SPINNING_SLASH_EFFECT_ID) {
        // RS-219【スピニングスラッシュ】: 対象をすべて選んでから1体ずつ撃破する（faq-card-4 RS-219 Q1・Q3）。
        if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
        const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
        if (selected.length < (pending.selectCount ?? 1)) {
          return {
            state: {
              ...state,
              pendingEffectChoice: {
                ...pending,
                selectedInstanceIds: selected,
                validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)),
                optional: false,
              },
            },
          };
        }
        return applyConfirmEffectChoice(
          {
            ...state,
            pendingEffectChoice: {
              ...pending,
              kind: "select_units_bp_budget",
              selectedInstanceIds: selected,
              optional: false,
            },
          },
          pending.playerId,
        );
      }
      if (pending.effectId === "rk154_head_held_high") {
        // RK-154【頭が高い！】: このターン BP500 になる（R-BP-01）。
        const located = findCardOwner(state, instanceId);
        if (!located || (located.zone !== "rush" && located.zone !== "battle")) {
          return { error: "invalid_target" };
        }
        const owner = state.players[located.playerId];
        const zoneCards = owner[located.zone].map((c) =>
          c.instanceId === instanceId ? { ...c, bpSetValue: 500 } : c,
        );
        const next = {
          ...state,
          ...updatePlayer(state, located.playerId, { ...owner, [located.zone]: zoneCards }),
        };
        return finishChoice(
          next,
          pending,
          cardName(state.definitions, findFieldUnitCardId(next, instanceId)),
        );
      }
      if (
        pending.effectId === "enemy_resident_pick_to_power" ||
        pending.effectId === "enemy_resident_pick_hold"
      ) {
        const next = resolveEnemyResidentPick(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "destroy_vehicle_and_rider") {
        const next = resolveDestroyVehicleAndRider(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (RIDER_EFFECT_SELECT_UNIT_IDS.has(pending.effectId)) {
        const destination = pending.unitDestination === "power" ? "power" : "discard";
        const leave = applyUnitLeave(state, instanceId, destination, pending.phasePlayerId);
        if ("error" in leave) return leave;
        return finishChoice(
          leave.state,
          pending,
          cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
        );
      }
      if (pending.effectId === "kamen_ride_deploy") {
        const prev = pending.selectedInstanceIds ?? [];
        if (prev.includes(instanceId)) return { error: "already_selected" };
        const selected = [...prev, instanceId];
        const selectCount = pending.selectCount ?? 1;
        if (selected.length < selectCount) {
          const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
          return {
            state: {
              ...state,
              pendingEffectChoice: {
                ...pending,
                selectedInstanceIds: selected,
                validInstanceIds: remaining,
              },
            },
          };
        }
        const deployed = applyKamenRideDeploy(
          clearChoice(state, pending.phasePlayerId),
          pending,
          selected,
        );
        return finishChoice(deployed, pending, formatInstanceIdsAsNames(state, selected));
      }
      if (pending.effectId === "hold_entry_destroy_male") {
        const next = resolveHoldEntryDestroy(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "stack_self_onto_l") {
        const next = resolveStackSelfOntoL(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "stack_vehicle_under_self") {
        const next = resolveStackVehicleUnderSelf(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === MURPHY_CHASE_EFFECT_ID) {
        const located = findCardOwner(state, instanceId);
        const selectedName = located
          ? cardName(
              state.definitions,
              findInZone(state.players[located.playerId], located.zone, instanceId)?.card
                .cardId ?? instanceId,
            )
          : instanceId;
        const cleared = clearChoice(state, pending.playerId);
        const deckChoice = openMurphyChaseDeckChoice(cleared, pending, instanceId);
        if (deckChoice) {
          return { state: deckChoice };
        }
        return finishChoice(cleared, pending, selectedName);
      }
      if (pending.unitDestination === "vehicle_battle_without_ride") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "rush") return { error: "invalid_target" };
        const next = applyVehicleBattleWithoutRideChoice(state, located.playerId, instanceId);
        return finishChoice(
          next,
          pending,
          cardName(state.definitions, findFieldUnitCardId(next, instanceId)),
        );
      }
      if (pending.effectId === "kami_ken_hikarimaru" && pending.step === "enemy") {
        const leave = applyUnitLeave(state, instanceId, "power", pending.phasePlayerId);
        if ("error" in leave) return leave;
        return finishChoice(
          leave.state,
          pending,
          cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
        );
      }
      if (
        pending.effectId?.startsWith("on_rush_send_rush_") &&
        pending.unitDestination === "power"
      ) {
        const leave = applyUnitLeave(state, instanceId, "power", pending.phasePlayerId);
        if ("error" in leave) return leave;
        let nextState = leave.state;
        if (pending.sourceInstanceId) {
          nextState = grantSp1ToRushUnit(
            nextState,
            pending.playerId,
            pending.sourceInstanceId,
          );
        }
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      if (pending.effectId === "destroy_power_match_on_rush_destroy") {
        const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
        if ("error" in leave) return leave;
        return finishChoice(
          leave.state,
          pending,
          cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
        );
      }
      if (pending.effectId === "fuantasuteikutekuniku") {
        const nextState = triggerCopiedOnRushFromRush(
          state,
          pending.playerId,
          instanceId,
          pending.phasePlayerId,
        );
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      const dest = pending.unitDestination ?? "discard";
      const requiredCount = pending.selectCount ?? 1;
      if (requiredCount > 1) {
        const prev = pending.selectedInstanceIds ?? [];
        if (prev.includes(instanceId)) return { error: "already_selected" };
        const selected = [...prev, instanceId];
        if (selected.length < requiredCount) {
          const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
          return {
            state: {
              ...state,
              pendingEffectChoice: {
                ...pending,
                selectedInstanceIds: selected,
                validInstanceIds: remaining,
              },
            },
          };
        }
        let nextState = state;
        for (const id of selected) {
          const leave = applyUnitLeave(
            nextState,
            id,
            unitLeaveDestination(dest),
            pending.phasePlayerId,
          );
          if ("error" in leave) return leave;
          nextState = leave.state;
        }
        if (pending.sourceInstanceId) {
          const player = nextState.players[pending.playerId];
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...player,
              battle: player.battle.map((c) =>
                c.instanceId === pending.sourceInstanceId
                  ? pending.effectId === "boru"
                    ? { ...c, bpModifier: (c.bpModifier ?? 0) + 4000 }
                    : { ...c, spModifier: (c.spModifier ?? 0) + 1 }
                  : c,
              ),
            }),
          };
        }
        return finishChoice(nextState, pending, formatInstanceIdsAsNames(nextState, selected));
      }
      if (pending.effectId === "fire_sword") {
        // 「常駐しているオペレーションを1つ選んで、持ち主のパワーゾーンに送って」— 敵軍の常駐も選べる（atwiki/page-364）。
        const ownerId: PlayerId = findInZone(state.players[pending.playerId], "operation", instanceId)
          ? pending.playerId
          : opponent(pending.playerId);
        const owner = state.players[ownerId];
        const found = findInZone(owner, "operation", instanceId);
        if (!found) return { error: "invalid_target" };
        const [, operation] = removeAt(owner.operation, found.index);
        const nextOwner = {
          ...owner,
          operation,
          power: [...owner.power, { ...found.card, faceDown: false }],
        };
        const finished = finishChoice(
          { ...state, ...updatePlayer(state, ownerId, nextOwner) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
        if ("error" in finished || finished.state.winner) return finished;
        // RS-244 命の泉などが場を離れたら、その時点で勝敗を判定する（faq-card-3 RS-130 Q2: 互いに7点以上ならターンプレイヤーの勝利）。
        const winner = checkWinner(finished.state);
        return winner ? { ...finished, state: { ...finished.state, winner } } : finished;
      }
      if (pending.effectId === "no_e58fa4") {
        const enemyId = opponent(pending.playerId);
        const moved = applyGaroaRedToEnemyRush(state, enemyId, instanceId);
        if (!moved) return { error: "invalid_target" };
        return finishChoice(
          moved,
          pending,
          cardName(state.definitions, findFieldUnitCardId(moved, instanceId) ?? instanceId),
        );
      }
      if (pending.effectId === "kamereon_discard_to_command") {
        const moved = applyMereChameleonDiscardToCommand(state, pending.playerId, instanceId);
        if (!moved) return { error: "invalid_target" };
        return finishChoice(
          moved,
          pending,
          cardName(state.definitions, findFieldUnitCardId(moved, instanceId) ?? instanceId),
        );
      }
      if (dest === "rush") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "battle") return { error: "invalid_target" };
        const owner = state.players[located.playerId];
        const found = findInZone(owner, "battle", instanceId);
        if (!found) return { error: "invalid_target" };
        const [, battle] = removeAt(owner.battle, found.index);
        const returning =
          state.phase === "battle"
            ? prepareWingUnitReturnedToRush(found.card)
            : found.card;
        return finishChoice(
          {
            ...state,
            ...updatePlayer(state, located.playerId, {
              ...owner,
              battle,
              rush: [...owner.rush, returning],
            }),
          },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "enemy_command") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "battle") return { error: "invalid_target" };
        const nextState = applyAssaultToCommandHold(state, located.playerId, instanceId);
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      if (pending.effectId === "battle_entry_discard") {
        const player = state.players[pending.playerId];
        const found = findInZone(player, "rush", instanceId);
        if (!found || pending.sourceInstanceId === instanceId) return { error: "invalid_target" };
        const [, rush] = removeAt(player.rush, found.index);
        const nextPlayer = satisfyCostWindow(
          {
            ...player,
            rush,
            discard: [...player.discard, found.card],
          },
          "battle_entry_rush_discard",
          { discardedCardId: found.card.cardId },
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "rush_from_discard") {
        const ownerId = pending.playerId;
        const owner = state.players[ownerId];
        const found = findInZone(owner, "discard", instanceId);
        if (!found) return { error: "invalid_target" };
        const nextState = applyReanimate(state, {
          playerId: ownerId,
          instanceId,
          from: "discard",
          to: "rush",
        });
        const finished = finishChoice(
          nextState,
          pending,
          cardName(state.definitions, found.card.cardId),
        );
        // ルール: R-RUSH-22 — 効果で捨札からラッシュエリアに出したユニットにも
        // 「ラッシュしたとき」誘発と「ラッシュされたとき」カウンター窓がある。
        if (
          "error" in finished ||
          !finished.state.players[ownerId].rush.some((c) => c.instanceId === instanceId)
        ) {
          return finished;
        }
        const rushed = finalizeEffectRush(finished.state, ownerId, [instanceId], pending.phasePlayerId);
        return {
          ...finished,
          state:
            rushed.logs.length > 0
              ? { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] }
              : rushed.state,
        };
      }
      if (dest === "hand" || dest === "hand_from_discard" || dest === "hand_from_power") {
        if (dest === "hand_from_discard") {
          const ownerId = handFromDiscardOwner(pending);
          const owner = state.players[ownerId];
          const found = findInZone(owner, "discard", instanceId);
          if (!found) return { error: "invalid_target" };
          let nextState = applyReanimate(state, {
            playerId: ownerId,
            instanceId,
            from: "discard",
            to: "hand",
          });
          if (pending.effectId === "ghost_absorption" && pending.sourceInstanceId) {
            nextState = applyGhostAbsorption(nextState, pending.playerId, pending.sourceInstanceId, found.card.cardId);
          }
          return finishChoice(
            nextState,
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }

        const located = findCardOwner(state, instanceId);
        const ownerId =
          dest === "hand_from_power" ? pending.playerId : located?.playerId;
        if (!ownerId) return { error: "invalid_target" };
        const fromZone =
          dest === "hand_from_power" ? "power" : located!.zone;
        const bounced = bounceToHand(state, {
          playerId: ownerId,
          instanceId,
          fromZone,
          faceUpPowerOnly: fromZone === "power",
        });
        if (!bounced.bounced) return { error: "invalid_target" };
        let nextState = bounced.state;
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, bounced.bounced.cardId),
        );
      }
      if (dest === "enemy_battle") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "rush") return { error: "invalid_target" };
        const owner = state.players[located.playerId];
        const found = findInZone(owner, "rush", instanceId);
        if (!found) return { error: "invalid_target" };
        const readyOwner = autoHoldForBattleEntry(state, located.playerId, found.card);
        if (!readyOwner) return { error: "cannot_enter_battle" };
        const withPrepared = {
          ...state,
          ...updatePlayer(state, located.playerId, readyOwner),
        };
        if (!canMoveUnitToBattle(withPrepared, located.playerId, found.card, "rush")) {
          return { error: "cannot_enter_battle" };
        }
        const [, rush] = removeAt(readyOwner.rush, found.index);
        const nextOwner = clearEffectBattleEntryWindows(
          {
            ...readyOwner,
            rush,
            battle: [...readyOwner.battle, found.card],
          },
        );
        let deployed: GameState = { ...state, ...updatePlayer(state, located.playerId, nextOwner) };
        deployed = treatOpponentDeployedAsOwnEntry(deployed, located.playerId, found.card, readyOwner.battle, pending);
        if (pending.effectId === GREEN_CRUSH_EFFECT_ID) {
          return continueGreenCrush(deployed, pending, located.playerId, found.card);
        }
        return finishChoice(deployed, pending, cardName(state.definitions, found.card.cardId));
      }
      if (dest === "swap_battle" && pending.sourceInstanceId) {
        const player = state.players[pending.playerId];
        const swapTarget = findInZone(player, "battle", instanceId);
        const alreadyEntered = findInZone(player, "battle", pending.sourceInstanceId);
        if (swapTarget && alreadyEntered && swapTarget.card.instanceId !== alreadyEntered.card.instanceId) {
          // ルール: R-ERR-RS118 — 既に出ている（出たときに選択が開いた）場合は、置きかえた S ユニットの位置へ
          // 移し、置きかえた S ユニットは重ねたカードごとラッシュエリアへ。これはアタックできない。
          const battle = player.battle
            .map((c) =>
              c.instanceId === instanceId ? { ...alreadyEntered.card, battleActed: true } : c,
            )
            .filter((c, i) => !(c.instanceId === pending.sourceInstanceId && i === alreadyEntered.index));
          const nextPlayer = markBattleBlocked(
            { ...player, battle, rush: [...player.rush, swapTarget.card] },
            swapTarget.card.instanceId,
          );
          return finishChoice(
            { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
            pending,
            cardName(state.definitions, swapTarget.card.cardId),
          );
        }
        const entering = findInZone(player, "rush", pending.sourceInstanceId);
        if (!swapTarget || !entering) return { error: "invalid_target" };
        const readyPlayer = autoHoldForBattleEntry(state, pending.playerId, entering.card);
        if (!readyPlayer) return { error: "cannot_enter_battle" };
        const withPrepared = {
          ...state,
          ...updatePlayer(state, pending.playerId, readyPlayer),
        };
        if (!canMoveUnitToBattle(withPrepared, pending.playerId, entering.card, "rush")) {
          return { error: "cannot_enter_battle" };
        }
        // ルール: R-ERR-RS118 — 置きかえ（同じ位置に出す）。Sユニットに重ねたカード（stackedCards 等）は
        // インスタンスごと移すので重ねたまま。置きかえたSユニットはこのターン再びバトルエリアに出られない。
        const swapIndex = readyPlayer.battle.findIndex((c) => c.instanceId === instanceId);
        const battle = [...readyPlayer.battle];
        battle.splice(swapIndex, 1, { ...entering.card, battleActed: true });
        const rush = readyPlayer.rush.filter((c) => c.instanceId !== pending.sourceInstanceId);
        const nextPlayer = clearEffectBattleEntryWindows(
          markBattleBlocked(
            {
              ...readyPlayer,
              battle,
              rush: [...rush, swapTarget.card],
            },
            swapTarget.card.instanceId,
          ),
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          cardName(state.definitions, swapTarget.card.cardId),
        );
      }
      const located = findCardOwner(state, instanceId);
      const destroyedCardId = located
        ? findInZone(state.players[located.playerId], located.zone, instanceId)?.card.cardId
        : undefined;
      const leave = applyUnitLeave(
        state,
        instanceId,
        unitLeaveDestination(dest),
        pending.phasePlayerId,
      );
      if ("error" in leave) return leave;
      let nextState = leave.state;
      // 「持ち主のパワーゾーンにダメージにして置く」— ウラ向き（ダメージ）で置く（RS-368【ゴッドハンド】、RS-639【ネジスリング】等）。
      if (pending.placeAsDamage && dest === "power" && located) {
        const owner = nextState.players[located.playerId];
        if (owner.power.some((c) => c.instanceId === instanceId && !c.faceDown)) {
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, located.playerId, {
              ...owner,
              power: owner.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)),
              damage: owner.damage + 1,
            }),
          };
        }
      }
      if (
        pending.effectId === "great_assault" &&
        dest === "discard" &&
        located &&
        destroyedCardId
      ) {
        nextState = returnFusionPartnersFromDiscard(
          nextState,
          located.playerId,
          destroyedCardId,
          "hand",
        );
      }
      if (pending.effectId === "buringasodo" && pending.sourceInstanceId && located) {
        const defenderOwner = state.players[located.playerId];
        const defenderFound = findInZone(defenderOwner, located.zone, instanceId);
        if (defenderFound) {
          const damage = resolveBlackCondorDestroyDamage(
            nextState,
            pending.playerId,
            pending.sourceInstanceId,
            located.playerId,
            defenderFound.card,
          );
          nextState = damage.state;
          const finished = finishChoice(
            nextState,
            pending,
            cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
          );
          if (damage.logs.length > 0) {
            return { ...finished, logs: damage.logs };
          }
          return finished;
        }
      }
      return finishChoice(
        nextState,
        pending,
        cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
      );
    }

    case "select_unit_step": {
      if (pending.effectId === "string_fist") {
        if (pending.step === "own") {
          const located = findCardOwner(state, instanceId);
          if (!located || located.zone !== "battle") return { error: "invalid_target" };
          const owner = state.players[located.playerId];
          const found = findInZone(owner, "battle", instanceId);
          if (!found) return { error: "invalid_target" };
          const [, battle] = removeAt(owner.battle, found.index);
          let nextState = {
            ...state,
            ...updatePlayer(state, located.playerId, {
              ...owner,
              battle,
              rush: [...owner.rush, found.card],
            }),
          };
          const enemyId = opponent(pending.playerId);
          const enemyTargets = nextState.players[enemyId].rush.map((c) => c.instanceId);
          if (enemyTargets.length === 0) {
            return finishChoice(nextState, pending, cardName(state.definitions, found.card.cardId));
          }
          // 後半「可能ならバトルエリアに出す」は強制（atwiki/page-336）。出られる候補がなければ見送れる。
          const secondStep: PendingEffectChoice = {
            ...pending,
            optional: false,
            kind: "select_unit",
            step: undefined,
            validInstanceIds: enemyTargets,
            selectedInstanceIds: [],
            unitDestination: "enemy_battle",
          };
          // ルール: R-CN-04 / R-TIME-04 — 戻したユニットの「ラッシュエリアに戻るとき」（ジェットファルコンの
          // ファルコンクロー）が割り込んで解決され、その後で紐拳の残りを続ける（faq-card-3 RS-141 Q1）。
          const withFalcon = tryLegend3BattleToRush(
            clearChoice(nextState, pending.playerId),
            located.playerId,
            found.card,
            pending.phasePlayerId,
          );
          if (withFalcon.pendingEffectChoice) {
            return {
              state: {
                ...withFalcon,
                pendingEffectChoice: { ...withFalcon.pendingEffectChoice, resumeChoice: secondStep },
              },
            };
          }
          // RS-417 冥府神サイクロプス【消滅の緋色】も戻ったときに誘発する（faq-card-6 RS-417）。
          const withCyclops = tryCyclopsScarletOnReturnToRush(
            clearChoice(nextState, pending.playerId),
            located.playerId,
            found.card,
            pending.phasePlayerId,
          );
          if (withCyclops.pendingEffectChoice) {
            return {
              state: {
                ...withCyclops,
                pendingEffectChoice: { ...withCyclops.pendingEffectChoice, resumeChoice: secondStep },
              },
            };
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), secondStep),
          };
        }
        return { error: "invalid_step" };
      }
      if (pending.effectId === "tyranno_sonic") {
        const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
        if ("error" in leave) return leave;
        let nextState = leave.state;

        if (pending.step === "own") {
          const enemyId = opponent(pending.playerId);
          // ルール: R-TGT-02 — プレイヤーが「選ぶ」ので、相手に選ばれないユニットは候補にならない。
          const enemyTargets = collectFieldUnitIds(nextState, enemyId, pending.maxBp ?? 5000).filter(
            (id) => isSelectableByOpponentEffect(nextState, pending.playerId, id, pending.sourceCardId),
          );
          if (enemyTargets.length === 0) {
            return finishChoice(nextState, pending, "own_only");
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              step: "enemy",
              validInstanceIds: enemyTargets,
            }),
          };
        }

        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      if (pending.effectId === "cross_thunder") {
        const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
        if ("error" in leave) return leave;
        let nextState = leave.state;

        if (pending.step === "own") {
          const enemyId = opponent(pending.playerId);
          // ルール: R-TGT-02 — プレイヤーが「選ぶ」ので、相手に選ばれないユニットは候補にならない。
          const enemyTargets = collectFieldUnitIds(nextState, enemyId, pending.maxBp ?? 5000).filter(
            (id) => isSelectableByOpponentEffect(nextState, pending.playerId, id, pending.sourceCardId),
          );
          if (enemyTargets.length === 0) {
            return finishChoice(nextState, pending, "own_only");
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              step: "enemy",
              validInstanceIds: enemyTargets,
            }),
          };
        }

        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      if (pending.effectId === "mirror_rider_destroy_enemy_s") {
        if (pending.step === "own") {
          const located = findCardOwner(state, instanceId);
          if (!located) return { error: "invalid_target" };
          const owner = state.players[located.playerId];
          const card =
            findInZone(owner, "battle", instanceId)?.card ??
            findInZone(owner, "rush", instanceId)?.card;
          if (!card) return { error: "invalid_target" };
          const def = getDefinition(state.definitions, card.cardId);
          const maxPowerCost = parsePowerCost(def?.powerCost ?? 99);
          const enemyId = opponent(pending.playerId);
          const enemyTargets = state.players[enemyId].battle
            .filter((c) => isSmallUnit(state.definitions, c.cardId))
            .filter((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost ?? 99) <= maxPowerCost)
            .map((c) => c.instanceId);
          if (enemyTargets.length === 0) {
            return finishChoice(state, pending, "mirror_rider:no_enemy");
          }
          return {
            state: openEffectChoice(clearChoice(state, pending.playerId), {
              ...pending,
              step: "enemy",
              validInstanceIds: enemyTargets,
              maxPowerCost,
            }),
          };
        }
        const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
        if ("error" in leave) return leave;
        return finishChoice(
          leave.state,
          pending,
          cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
        );
      }
      return { error: "invalid_step" };
    }

    case "select_command": {
      if (pending.effectId === "dark_dual_blade") {
        // RS-102【暗黒二刀流・巌流剣】: パワーを1枚選び、続けてコマンドを1枚選ぶ。2枚そろってから捨札にする。
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const powerFound = findInZone(enemy, "power", instanceId);
        if (!powerFound || powerFound.card.faceDown) return { error: "invalid_target" };
        const commandTargets = collectCommandIds(state, enemyId, "any");
        if (commandTargets.length === 0) {
          return finishChoice(state, pending, "none");
        }
        return {
          state: openEffectChoice(clearChoice(state, pending.playerId), {
            ...pending,
            effectId: "dark_dual_blade_command",
            playerId: pending.playerId,
            validInstanceIds: commandTargets,
            selectedInstanceIds: [],
            darkDualBladePowerInstanceId: instanceId,
            commandAction: "discard",
          }),
        };
      }
      if (pending.effectId === "dark_dual_blade_command") {
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const found = findInZone(enemy, "command", instanceId);
        if (!found) return { error: "invalid_target" };
        const [, command] = removeAt(enemy.command, found.index);
        const powerId = pending.darkDualBladePowerInstanceId;
        const powerCard = enemy.power.find((c) => c.instanceId === powerId);
        const nextEnemy = {
          ...enemy,
          command,
          power: enemy.power.filter((c) => c.instanceId !== powerId),
          discard: [...enemy.discard, ...(powerCard ? [powerCard] : []), found.card],
        };
        const finished = finishChoice(
          { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
        if ("error" in finished) return finished;
        // コマンドゾーンを離れたときの誘発（RS-238【プロジェットカノン】。faq-card-4 RS-238 Q2）。
        return { ...finished, state: afterCommandCardsLeft(finished.state, enemyId, 1) };
      }

      if (pending.effectId === "geki_e78da3") {
        const located = findCommandCard(state, instanceId);
        if (!located) return { error: "invalid_target" };
        const moved = applyBeastRodToEnemyCommand(state, located.playerId, instanceId);
        if (!moved) return { error: "invalid_target" };
        return finishChoice(
          moved,
          pending,
          cardName(state.definitions, findFieldUnitCardId(moved, instanceId) ?? instanceId),
        );
      }

      if (pending.effectId === "kami_ken_hikarimaru") {
        const released = releaseWingCommand(state, pending.playerId, instanceId);
        if (!released) return { error: "invalid_target" };
        const maxBp = released.releasedBp;
        const enemyId = opponent(pending.playerId);
        const enemyTargets = collectEnemyBattleAtMostBp(released.state, enemyId, maxBp);
        if (enemyTargets.length === 0) {
          return finishChoice(released.state, pending, "released_only");
        }
        return {
          state: openEffectChoice(clearChoice(released.state, pending.playerId), {
            ...pending,
            kind: "select_unit",
            step: "enemy",
            maxBp,
            validInstanceIds: enemyTargets,
            unitDestination: "power",
          }),
        };
      }

      const located = findCommandCard(state, instanceId);
      if (!located) {
        for (const playerId of ["player1", "player2"] as const) {
          const owner = state.players[playerId];
          const found = findInZone(owner, "power", instanceId);
          if (!found) continue;
          const [, power] = removeAt(owner.power, found.index);
          const nextOwner = {
            ...owner,
            power,
            discard: [...owner.discard, found.card],
          };
          return finishChoice(
            { ...state, ...updatePlayer(state, playerId, nextOwner) },
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }
        return { error: "invalid_target" };
      }
      const owner = located.playerId;
      const player = state.players[owner];
      const found = findInZone(player, "command", instanceId);
      if (!found) return { error: "invalid_target" };

      let nextPlayer = player;
      if (pending.commandAction === "discard") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          discard: [...player.discard, found.card],
        };
      } else if (pending.commandAction === "hold") {
        if (pending.effectId === "souru" && pending.sourceInstanceId) {
          const moved = applyAkaRedSoulHold(
            state,
            owner,
            instanceId,
            pending.sourceInstanceId,
          );
          if (!moved) return { error: "invalid_target" };
          return finishChoice(
            moved,
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }
        const command = [...player.command];
        command[found.index] = { ...found.card, commandHeld: true };
        nextPlayer = { ...player, command };
      } else if (pending.commandAction === "return_hand") {
        if (pending.effectId === "shirubabureiza" && pending.sourceInstanceId) {
          const actor = state.players[pending.playerId];
          const unit = actor.battle.find((c) => c.instanceId === pending.sourceInstanceId);
          const wasHeld = !!(unit?.commandHeld || unit?.mothershipHold);
          const bounced = bounceToHand(state, {
            playerId: owner,
            instanceId,
            fromZone: "command",
          });
          if (!bounced.bounced) return { error: "invalid_target" };
          const actorAfter = bounced.state.players[pending.playerId];
          const nextState = {
            ...bounced.state,
            ...updatePlayer(bounced.state, pending.playerId, {
              ...actorAfter,
              battle: actorAfter.battle.map((c) =>
                c.instanceId === pending.sourceInstanceId
                  ? {
                      ...c,
                      bpModifier: (c.bpModifier ?? 0) + 2000,
                      spModifier: wasHeld ? (c.spModifier ?? 0) + 1 : c.spModifier,
                    }
                  : c,
              ),
            }),
          };
          return finishChoice(
            nextState,
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }
        const bounced = bounceToHand(state, {
          playerId: owner,
          instanceId,
          fromZone: "command",
        });
        if (!bounced.bounced) return { error: "invalid_target" };
        // RS-174【リフトアップ】「その後、山札から1枚ひいて自軍コマンドゾーンに置く」（atwiki/page-356）。
        const afterReturn =
          pending.effectId === "lift_up" ? liftUpPlaceFromDeck(bounced.state, pending.playerId) : bounced.state;
        return finishChoice(afterReturn, pending, cardName(state.definitions, found.card.cardId));
      } else if (pending.commandAction === "return_deck_top") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          deck: [found.card, ...player.deck],
        };
      } else if (pending.commandAction === "rush" || pending.commandAction === "rush_silent") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          rush: [...player.rush, found.card],
        };
      } else if (pending.commandAction === "battle_silent") {
        const moved = moveCommandUnitToBattleSilent(state, owner, instanceId);
        if (!moved) return { error: "invalid_target" };
        return finishChoice(moved, pending, cardName(state.definitions, found.card.cardId));
      } else if (pending.commandAction === "release") {
        const released = applyCommandReleaseChoice(state, owner, instanceId);
        return finishChoice(released, pending, cardName(state.definitions, found.card.cardId));
      } else if (pending.commandAction === "sp_half") {
        const spHalf = applyCommandSpHalfChoice(state, owner, instanceId);
        return finishChoice(spHalf, pending, cardName(state.definitions, found.card.cardId));
      } else if (pending.commandAction === "power") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          power: [...player.power, { ...found.card, faceDown: false }],
        };
      }

      let withHold = { ...state, ...updatePlayer(state, owner, nextPlayer) };
      if (pending.commandAction === "rush" || pending.commandAction === "rush_silent") {
        // ルール: R-RUSH-22 / R-RUSH-24 — 効果でラッシュエリアに出したユニットの誘発と窓
        // （「このとき出したユニットの効果は発動しない」なら自身の効果だけ止める）。
        // 選択の解決後（applyAction の後処理）に処理される。
        withHold = finalizeEffectRush(withHold, owner, [instanceId], pending.phasePlayerId, {
          silent: pending.commandAction === "rush_silent",
        }).state;
      }
      const continued = applyPostHoldContinuation(withHold, pending);
      if (pending.effectId === "dino_slasher_category_balance") {
        // RS-233【ダイノスラスター】: 捨札にし終えてから、離れた枚数だけ【プロジェットカノン】等を誘発する
        // （戻されたカードをもう一度捨札にする必要はない。faq-card-4 RS-233 Q1）。
        const discarded = [...(pending.processedInstanceIds ?? []), instanceId];
        if (continued.done) {
          const next = continued.state.pendingEffectChoice;
          return {
            state: next
              ? { ...continued.state, pendingEffectChoice: { ...next, processedInstanceIds: discarded } }
              : continued.state,
          };
        }
        const finished = finishChoice(continued.state, pending, cardName(state.definitions, found.card.cardId));
        if ("error" in finished) return finished;
        return { ...finished, state: afterCommandCardsLeft(finished.state, owner, discarded.length) };
      }
      if (continued.done) return { state: continued.state };

      return finishChoice(
        continued.state,
        pending,
        cardName(state.definitions, found.card.cardId),
      );
    }

    case "select_commands": {
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const selectCount = pending.selectCount ?? 1;
      if (selected.length < selectCount) {
        let remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        if (pending.effectId === SCRAMBLE_EFFECT_ID) {
          remaining = filterScrambleRemaining(state, pending.playerId, selected, remaining);
        }
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
          },
        };
      }

      let nextState = state;
      for (const cmdId of selected) {
        const player = nextState.players[pending.playerId];
        const found = findInZone(player, "command", cmdId);
        if (!found) continue;
        if (pending.commandAction === "hold" || pending.commandAction === "release") {
          const command = [...player.command];
          command[found.index] = { ...found.card, commandHeld: pending.commandAction === "hold" };
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, { ...player, command }),
          };
        } else if (pending.commandAction === "power") {
          const [, command] = removeAt(player.command, found.index);
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...player,
              command,
              power: [...player.power, { ...found.card, faceDown: false }],
            }),
          };
        } else if (pending.commandAction === "discard") {
          const [, command] = removeAt(player.command, found.index);
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...player,
              command,
              discard: [...player.discard, found.card],
            }),
          };
        } else if (pending.commandAction === "return_hand") {
          const [, command] = removeAt(player.command, found.index);
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...player,
              command,
              hand: [...player.hand, { ...found.card, commandHeld: false }],
            }),
          };
        } else if (pending.commandAction === "rush") {
          const [, command] = removeAt(player.command, found.index);
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...player,
              command,
              rush: [...player.rush, { ...found.card, commandHeld: undefined }],
            }),
          };
        }
      }
      if (pending.siteTransportMeta?.step === "discard") {
        return {
          state: openSiteTransportDeckStep(nextState, pending, selected.length),
        };
      }
      if (pending.effectId === "bio_particle_slash" && pending.sourceCardId) {
        const player = nextState.players[pending.playerId];
        // 「SP2」（SP が 2 になる）と BP+3000。対象は出たこのユニット（同名の別カードではない）。
        const isSource = (c: CardInstance) =>
          pending.sourceInstanceId
            ? c.instanceId === pending.sourceInstanceId
            : c.cardId === pending.sourceCardId;
        const battle = player.battle.map((c) =>
          isSource(c)
            ? {
                ...c,
                spOverride: 2,
                bpModifier: (c.bpModifier ?? 0) + 3000,
              }
            : c,
        );
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pending.playerId, { ...player, battle }),
        };
      }
      return finishChoice(nextState, pending, formatInstanceIdsAsNames(nextState, selected));
    }

    case "select_power": {
      if (pending.effectId === ASSAULT_VECTOR_EFFECT_ID) {
        const picked = resolveAssaultVectorPick(state, instanceId);
        if (!picked) return { error: "invalid_target" };
        if (!picked.done) return { state: picked.state };
        return finishChoice(picked.state, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "bumper_bow") {
        // RS-150【バンパーボウ】: 選んだ敵軍パワーを持ち主のコマンドゾーンにホールド状態で置く。
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const found = findInZone(enemy, "power", instanceId);
        if (!found || found.card.faceDown) return { error: "invalid_target" };
        if (enemy.command.length >= 5) return finishChoice(state, pending, "no_room");
        const [, power] = removeAt(enemy.power, found.index);
        return finishChoice(
          {
            ...state,
            ...updatePlayer(state, enemyId, {
              ...enemy,
              power,
              command: [...enemy.command, { ...found.card, commandHeld: true }],
            }),
          },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (isFirefightingChoice(pending)) {
        const next = resolveFirefightingPick(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return next.pendingEffectChoice
          ? { state: next }
          : finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "flip_enemy_power_damage_pick") {
        const next = resolveFlipEnemyPowerDamagePick(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return next.pendingEffectChoice && next.pendingEffectChoice !== pending
          ? { state: next }
          : finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "flip_enemy_power_damage_damage") {
        const next = resolveFlipEnemyPowerDamageDamage(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      const prev = pending.selectedInstanceIds ?? [];
      if (prev.includes(instanceId)) return { error: "already_selected" };
      const selected = [...prev, instanceId];
      const selectCount = pending.selectCount ?? 1;
      if (selected.length < selectCount) {
        const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
          },
        };
      }

      const player = state.players[pending.playerId];
      const discardIds = new Set(selected);
      const toDiscard = player.power.filter((c) => discardIds.has(c.instanceId));
      let nextPlayer = {
        ...player,
        power: player.power.filter((c) => !discardIds.has(c.instanceId)),
        discard: [...player.discard, ...toDiscard],
      };

      if (pending.effectId === "battle_entry_power_discard") {
        nextPlayer = satisfyCostWindow(nextPlayer, "battle_entry_power_discard");
      }

      if (pending.effectId === "earth_force") {
        nextPlayer = { ...nextPlayer, hasPaidEarthForceUpkeep: true };
      }

      if (pending.effectId === "destroy_power_match_on_rush") {
        const discarded = toDiscard[0];
        if (!discarded) {
          return finishChoice(
            clearChoice(
              { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
              pending.playerId,
            ),
            pending,
            "no_discard",
          );
        }
        const powerCost = parsePowerCost(
          getDefinition(state.definitions, discarded.cardId)?.powerCost ?? 99,
        );
        const enemyId = opponent(pending.playerId);
        const targets = findEnemySWithPowerCost(state, enemyId, powerCost).map(
          (c) => c.instanceId,
        );
        const cleared = clearChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending.playerId,
        );
        if (targets.length === 0) {
          return finishChoice(cleared, pending, "no_enemy_match");
        }
        return {
          state: openEffectChoice(cleared, {
            playerId: pending.playerId,
            effectId: "destroy_power_match_on_rush_destroy",
            sourceCardId: pending.sourceCardId,
            sourceInstanceId: pending.sourceInstanceId,
            phasePlayerId: pending.phasePlayerId,
            kind: "select_unit",
            validInstanceIds: targets,
            selectCount: 1,
            unitDestination: "discard",
            skipShurikenIntercept: true,
          }),
        };
      }

      if (pending.sourceInstanceId) {
        const needsFullPayment =
          pending.effectId === "judgment_sword" || pending.effectId === "justice_flasher";
        const paidEnough = !needsFullPayment || toDiscard.length >= selectCount;
        const spGain = paidEnough
          ? pending.effectId === "justice_flasher"
            ? 3
            : pending.effectId === "judgment_sword"
              ? 1
              : 0
          : 0;
        if (spGain > 0) {
          // 「次の能力を得る⇒「SPn」」は SP を n にする（印刷 SP への加算ではない）。
          // 出典: atwiki/page-279（RS-042「SP3」）、08-errata R-ERR-RS043（RS-043「SP1」）。
          nextPlayer = {
            ...nextPlayer,
            battle: nextPlayer.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId ? { ...c, spOverride: spGain } : c,
            ),
          };
        }
        // XG2-066 / RK-142 等: パワーを捨てたら対象ユニットが「SP1」になる。
        if (
          (pending.effectId === "rider_kick_discard_power_sp1" ||
            pending.effectId === "power_faceup_sp1_grant") &&
          toDiscard.length > 0
        ) {
          nextPlayer = {
            ...nextPlayer,
            battle: nextPlayer.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId ? { ...c, spOverride: 1 } : c,
            ),
          };
        }
      }

      return finishChoice(
        { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
        pending,
        formatInstanceIdsAsNames(state, selected),
      );
    }

    case "select_hand": {
      if (pending.effectId === DISMANTLING_EFFECT_ID) {
        const next = resolveDismantlingPick(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "turn_start_swap_hand_named") {
        const next = resolveTurnStartSwap(state, pending, instanceId);
        if (!next) return { error: "invalid_target" };
        return finishChoice(next, pending, cardName(state.definitions, pending.sourceCardId));
      }
      if (pending.effectId === "shuriken_deck_reveal_pick_hand") {
        const result = completeShurikenDeckRevealSwap(state, pending, instanceId);
        if ("error" in result) return result;
        return finishChoice(result.state, pending, result.detail);
      }
      const selectCount = pending.selectCount ?? 1;
      if (selectCount > 1) {
        const prev = pending.selectedInstanceIds ?? [];
        if (prev.includes(instanceId)) return { error: "already_selected" };
        const selected = [...prev, instanceId];
        if (selected.length < selectCount) {
          const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
          return {
            state: {
              ...state,
              pendingEffectChoice: {
                ...pending,
                selectedInstanceIds: selected,
                validInstanceIds: remaining,
              },
            },
          };
        }

        const player = state.players[pending.playerId];
        const discardIds = new Set(selected);
        const toDiscard = player.hand.filter((c) => discardIds.has(c.instanceId));
        const basePlayer = {
          ...player,
          hand: player.hand.filter((c) => !discardIds.has(c.instanceId)),
          discard: [...player.discard, ...toDiscard],
        };
        const nextPlayer =
          pending.effectId === "battle_entry_hand_discard"
            ? satisfyCostWindow(basePlayer, "battle_entry_hand_discard")
            : basePlayer;
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          formatInstanceIdsAsNames(state, selected),
        );
      }

      const player = state.players[pending.playerId];
      const rushMeta = pending.handResidentRushMeta;
      let found = findInZone(player, "hand", instanceId);
      let fromOperation = false;
      let fromDeck = false;
      if (!found && rushMeta) {
        const opFound = findInZone(player, "operation", instanceId);
        if (opFound) {
          found = opFound;
          fromOperation = true;
        } else {
          const deckIdx = player.deck.findIndex((c) => c.instanceId === instanceId);
          if (deckIdx >= 0) {
            found = { index: deckIdx, card: player.deck[deckIdx]! };
            fromDeck = true;
          }
        }
      }
      if (!found) return { error: "invalid_target" };

      if (rushMeta && pending.unitDestination === "rush") {
        let nextPlayer: PlayerState;
        if (fromOperation) {
          const [, operation] = removeAt(player.operation, found.index);
          nextPlayer = {
            ...player,
            operation,
            rush: [...player.rush, found.card],
          };
        } else if (fromDeck) {
          const [, deckRest] = removeAt(player.deck, found.index);
          nextPlayer = {
            ...player,
            deck: rushMeta.shuffleIfFromDeck ? shuffleDeck(deckRest) : deckRest,
            rush: [...player.rush, found.card],
          };
        } else {
          const [, hand] = removeAt(player.hand, found.index);
          nextPlayer = {
            ...player,
            hand,
            rush: [...player.rush, found.card],
          };
        }
        let nextState = { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
        if (!fromOperation && !fromDeck && rushMeta.drawIfFromHand) {
          const drawn = requestDrawFromDeck(nextState, pending.playerId, pending.phasePlayerId, {
            count: 1,
            sourceCardId: pending.sourceCardId,
          });
          nextState = drawn.state;
        }
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }

      const [, hand] = removeAt(player.hand, found.index);
      if (pending.effectId === "megatomahoku") {
        let nextPlayer: PlayerState = {
          ...player,
          hand,
          command: [...player.command, { ...found.card, commandHeld: true }],
        };
        if (pending.sourceInstanceId) {
          nextPlayer = {
            ...nextPlayer,
            // 「次の能力を得る⇒SP1」— SP1 になる（加算しない）。
            battle: nextPlayer.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId ? withSpBecomes(state.definitions, nextPlayer.battle, c, 1) : c,
            ),
          };
        }
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      // 選んだ手札の行き先は1か所だけ（以前は捨札にも置かれ、RS-296 編隊出撃でカードが2か所に重複していた）。
      const handDestination =
        pending.effectId === "geki_e7b7a8" || pending.unitDestination === "rush"
          ? "rush"
          : pending.unitDestination === "deck_top"
            ? "deck_top"
            : "discard";
      let nextPlayer: PlayerState =
        handDestination === "rush"
          ? { ...player, hand, rush: [...player.rush, found.card] }
          : handDestination === "deck_top"
            ? { ...player, hand, deck: [found.card, ...player.deck] }
            : { ...player, hand, discard: [...player.discard, found.card] };
      if (pending.sourceInstanceId) {
        nextPlayer = {
          ...nextPlayer,
          battle: nextPlayer.battle.map((c) =>
            c.instanceId === pending.sourceInstanceId
              ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
              : c,
          ),
        };
      }
      let nextState: GameState = { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
      if (pending.effectId === "fx_unknown_2" && pending.sourceCardId === "RS-322") {
        // ルール: R-ADD-08 — 相手は捨札にしたカードの追加条件を可能なら満たす（母艦の代替手段も含む）。
        nextState = startAbductionCondition(
          { ...nextState, pendingEffectChoice: undefined },
          pending.playerId,
          found.card.cardId,
          pending.phasePlayerId,
        );
        if (nextState.pendingEffectChoice) {
          return { state: nextState };
        }
      }
      if (handDestination === "rush") {
        // ルール: R-RUSH-20 — 効果でラッシュエリアに出すのにコマンドのホールドは不要。
        // ルール: R-RUSH-22 — 出したユニットにも「ラッシュしたとき」誘発と窓がある（選択の解決後に処理）。
        nextState = finalizeEffectRush(nextState, pending.playerId, [instanceId], pending.phasePlayerId).state;
      }
      return finishChoice(
        nextState,
        pending,
        cardName(state.definitions, found.card.cardId),
      );
    }

    case "scry_keep_one": {
      const player = state.players[pending.playerId];
      const viewed = (pending.viewedInstanceIds ?? [])
        .map((id) => player.deck.find((c) => c.instanceId === id))
        .filter((c): c is CardInstance => !!c);
      const kept = viewed.find((c) => c.instanceId === instanceId);
      if (!kept) return { error: "invalid_target" };
      const rest = viewed.filter((c) => c.instanceId !== instanceId);
      const deckTail = player.deck.filter(
        (c) => !viewed.some((v) => v.instanceId === c.instanceId),
      );
      let nextPlayer: PlayerState;
      if (pending.effectId === "sagas_sniper") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck([...rest, ...deckTail]),
          hand: [...player.hand, kept],
        };
      } else if (pending.effectId === MURPHY_CHASE_EFFECT_ID && pending.unitDestination === "hand") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck([...rest, ...deckTail]),
          hand: [...player.hand, kept],
        };
      } else if (
        pending.unitDestination === "rush" &&
        pending.effectId === "castoff_deck_rush" &&
        pending.castoffMfInstanceId
      ) {
        const castoff = applyCastoffDeckRush(
          state,
          pending.playerId,
          instanceId,
          pending.castoffMfInstanceId,
          pending.phasePlayerId,
        );
        if (!castoff) return { error: "invalid_target" };
        return finishChoice(castoff.state, pending, castoff.log ?? cardName(state.definitions, kept.cardId));
      } else if (pending.effectId === LION_DANCE_EFFECT_ID) {
        // RS-100【超忍法・舞獅子】: 選んだハリケンイエローをバトルエリアに出し、山札をシャッフルする。
        nextPlayer = {
          ...player,
          deck: shuffleDeck([...rest, ...deckTail]),
          battle: [...player.battle, kept],
        };
      } else if (pending.unitDestination === "rush") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck([...rest, ...deckTail]),
          rush: [...player.rush, kept],
        };
      } else if (pending.siteTransportMeta?.step === "deck") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck(deckTail),
          command: [...player.command, { ...kept, commandHeld: true }],
          discard: [...player.discard, ...rest],
        };
      } else if (pending.effectId === "hagada") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck(deckTail),
          operation: [{ ...kept, commandHeld: false }],
          discard: [...player.discard, ...player.operation, ...rest],
        };
      } else {
        nextPlayer = {
          ...player,
          deck: [kept, ...deckTail],
          discard: [...player.discard, ...rest],
        };
      }
      const nextState = { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
      return finishChoice(nextState, pending, cardName(state.definitions, kept.cardId));
    }

    case "simultaneous_order": {
      if (!pending.validInstanceIds.includes(instanceId)) {
        return { error: "invalid_target" };
      }
      if (pending.rushTriggerOrderMeta) {
        // faq-card-2 RS-092 Q1 — 同時に発動した「ラッシュしたとき」の効果は、ターンプレイヤーが望む順で処理する。
        const meta = pending.rushTriggerOrderMeta;
        const cleared = clearChoice(state, pending.phasePlayerId);
        const resolved = applyOnRushUnitEffects(
          cleared,
          meta.ownerPlayerId,
          meta.instanceId,
          pending.phasePlayerId,
          meta.zone,
          {
            viaEffect: meta.viaEffect,
            rushTriggerOrder: instanceId === "super_radar" ? "super_radar_first" : "self_first",
          },
        );
        const log = buildLogEntry(
          pending.playerId,
          "resolve_effect_choice",
          pending.sourceCardId,
          state.definitions,
          `${pending.effectId}:${instanceId}`,
        );
        return { state: { ...resolved.state, log: [...resolved.state.log, ...resolved.logs] }, log };
      }
      if (pending.battleDestroyOrderMeta) {
        // ルール: R-SIM-01 — 撃破の誘発のうち同じ段階（R-TIME-01）の効果どうしの処理順はターンプレイヤーが決める
        // （faq-card-4 RS-212 Q1）。段階が違う効果はここに来ない（rules/destroyTriggerTiming.ts）。
        const meta = pending.battleDestroyOrderMeta;
        const cleared = clearChoice(state, pending.phasePlayerId);
        const next =
          instanceId === meta.existingId
            ? openEffectChoice(cleared, appendResumeChoice(meta.existing, meta.own))
            : openEffectChoice(cleared, { ...meta.own, resumeChoice: meta.existing });
        const log = buildLogEntry(
          pending.playerId,
          "resolve_effect_choice",
          pending.sourceCardId,
          state.definitions,
          `${pending.effectId}:${instanceId}`,
        );
        return { state: next, log };
      }
      if (pending.mutualDestructionMeta) {
        // ルール: R-BTL-02, R-SIM-01 — 相打ちの処理順はターンプレイヤーが決める。
        const cleared = clearChoice(state, pending.phasePlayerId);
        const processed = processMutualDestruction(cleared, pending.mutualDestructionMeta, instanceId);
        if (processed.deferred) {
          const log = buildLogEntry(
            pending.playerId,
            "resolve_effect_choice",
            pending.sourceCardId,
            state.definitions,
            `${pending.effectId}:${instanceId}`,
          );
          return { state: processed.state, log };
        }
        return finishChoice(processed.state, pending, instanceId);
      }
      const nextState = applySimultaneousOrderChoice(state, instanceId);
      return finishChoice(nextState, pending, instanceId);
    }

    case "end_turn_menu": {
      const cleared = clearChoice(state, pending.phasePlayerId);
      const jet = startJetSkateboardChoiceForUnit(cleared, playerId, instanceId);
      if (jet) return { state: jet };
      const geki = startEndTurnBattleToRushChoiceForUnit(cleared, playerId, instanceId);
      if (geki) return { state: geki };
      return { error: "unsupported_end_turn_effect" };
    }

    case "pick_effect_branch": {
      const continued = continuePickEffectBranch(state, pending, instanceId);
      if (continued.pending) {
        return { state: continued.state };
      }
      const cleared = clearChoice(continued.state, pending.phasePlayerId);
      const log = buildLogEntry(
        pending.playerId,
        "resolve_effect_choice",
        pending.sourceCardId,
        state.definitions,
        `${pending.effectId}:branch_${instanceId}`,
      );
      return { state: cleared, log };
    }

    case "confirm": {
      if (pending.effectId === "shuriken_deck_reveal_swap") {
        const meta = pending.shurikenMeta;
        if (!meta) return { error: "invalid_meta" };
        if (instanceId === "decline") {
          return {
            state: openEffectChoice(clearChoice(state, pending.playerId), {
              ...meta.resume,
              skipShurikenIntercept: true,
            }),
          };
        }
        if (instanceId !== "accept") return { error: "invalid_target" };
        const withRevealed = applyShurikenRevealToHand(
          state,
          pending.playerId,
          meta.revealedInstanceId,
        );
        if (!withRevealed) return { error: "invalid_target" };
        const handIds = withRevealed.players[pending.playerId].hand.map((c) => c.instanceId);
        return {
          state: openEffectChoice(withRevealed, {
            playerId: pending.playerId,
            effectId: "shuriken_deck_reveal_pick_hand",
            sourceCardId: pending.sourceCardId,
            phasePlayerId: pending.phasePlayerId,
            kind: "select_hand",
            validInstanceIds: handIds,
            selectCount: 1,
            optional: false,
            shurikenMeta: { ...meta, step: "pick_hand" },
            skipShurikenIntercept: true,
          }),
        };
      }
      if (pending.effectId === "rocket_booster") {
        const declaredName = pending.validInstanceIds.find((name) => name === instanceId)
          ?? instanceId;
        if (!pending.validInstanceIds.includes(declaredName)) {
          return { error: "invalid_target" };
        }
        const nextState = applyRocketBoosterDeclaredName(state, playerId, declaredName);
        return finishChoice(nextState, pending, declaredName);
      }
      if (pending.effectId === "disco_dance") {
        if (instanceId !== "return") return { error: "invalid_target" };
        const nextState = applyDiscoDanceReturnFemaleSToRush(state, playerId);
        return finishChoice(nextState, pending, "return");
      }
      if (pending.effectId === "sagasupia") {
        const deckOwnerId =
          instanceId === "deck_enemy" ? opponent(pending.playerId) : pending.playerId;
        const deckOwner = state.players[deckOwnerId];
        if (deckOwner.deck.length === 0) {
          return finishChoice(state, pending, "empty_deck");
        }
        const { hasSpUnit, top3 } = scryTop3ForSagasSpear(state, deckOwnerId);
        let nextState = applySagasSpearScryReturn(state, deckOwnerId, top3, top3);
        if (hasSpUnit && pending.sourceInstanceId) {
          const owner = nextState.players[pending.playerId];
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...owner,
              // 「このターン、これは「SP1」になる」— 加算しない。
              battle: owner.battle.map((c) =>
                c.instanceId === pending.sourceInstanceId ? withSpBecomes(state.definitions, owner.battle, c, 1) : c,
              ),
            }),
          };
        }
        return finishChoice(nextState, pending, deckOwnerId);
      }
      if (pending.effectId === "arino" && instanceId === "reveal_top") {
        const top = state.players[pending.playerId].deck[0];
        if (!top) return finishChoice(state, pending, "empty_deck");
        const nextState = applyZorobTopDeckReveal(state, pending.playerId, top.instanceId);
        return finishChoice(nextState, pending, cardName(state.definitions, top.cardId));
      }
      if (pending.effectId === "to_power_on_destroy") {
        if (instanceId !== "place_in_power") return { error: "invalid_target" };
        const { state: placed, log } = completeToPowerOnDestroyChoice(state, pending, true);
        const followUp = pending.toPowerOnDestroyMeta?.pendingLeave.followUpAttackerLeave;
        if (followUp) {
          const next = tryLeaveField(placed, {
            ...followUp,
            phasePlayerId: followUp.phasePlayerId,
          });
          return { state: next.state, log };
        }
        return { state: placed, log };
      }
      return { error: "unsupported_confirm" };
    }

    case "pit_in_dive_order": {
      const actorId = pending.playerId;
      const enemyId = opponent(actorId);
      const enemy = state.players[enemyId];
      const found = findInZone(enemy, "rush", instanceId);
      if (!found) return { error: "invalid_target" };

      const readyEnemy = autoHoldForBattleEntry(state, enemyId, found.card);
      if (!readyEnemy) return { error: "cannot_enter_battle" };
      const withPrepared = { ...state, ...updatePlayer(state, enemyId, readyEnemy) };
      if (!canMoveUnitToBattle(withPrepared, enemyId, found.card, "rush")) {
        return { error: "cannot_enter_battle" };
      }

      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));

      // ルール: R-MOVE-01 — ラッシュエリアからバトルエリアに出されるのも「場を離れる」ので、
      // 持ち主はダイノガッツ等（場を離れるとき）を発動できる。反応の後でピットインダイブを続ける。
      if (
        hasDinoGutsLeaveReaction(withPrepared, enemyId, found.card.cardId) ||
        hasDinoChronicleLeaveReaction(withPrepared, enemyId, found.card.cardId)
      ) {
        const leaveIntent: PendingLeave = {
          ownerPlayerId: enemyId,
          instanceId,
          fromZone: "rush",
          toZone: "battle",
          leavingCardId: found.card.cardId,
          phasePlayerId: pending.phasePlayerId,
        };
        const base = {
          ...withPrepared,
          ...updatePlayer(withPrepared, enemyId, clearEffectBattleEntryWindows(readyEnemy)),
        };
        const afterChoice: GameState =
          remaining.length > 0
            ? {
                ...base,
                pendingEffectChoice: {
                  ...pending,
                  selectedInstanceIds: selected,
                  validInstanceIds: remaining,
                },
              }
            : (() => {
                const finished = finishChoice(base, pending, formatInstanceIdsAsNames(base, selected));
                return "error" in finished ? base : finished.state;
              })();
        return {
          state: { ...afterChoice, pendingLeave: leaveIntent, activePlayer: enemyId },
        };
      }

      const [, rush] = removeAt(readyEnemy.rush, found.index);
      const nextEnemy = clearEffectBattleEntryWindows(
        {
          ...readyEnemy,
          rush,
          battle: [...readyEnemy.battle, found.card],
        },
      );
      let nextState = { ...state, ...updatePlayer(state, enemyId, nextEnemy) };

      if (remaining.length > 0) {
        return {
          state: {
            ...nextState,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
            activePlayer: pending.playerId,
          },
        };
      }

      const finished = finishChoice(nextState, pending, formatInstanceIdsAsNames(nextState, selected));
      if ("error" in finished || finished.state.pendingEffectChoice) return finished;
      // ルール: R-TIME-08 — 並び順の確定とは別に、相手の効果で出されたときも「バトルエリアに出たとき」は発動する
      // （RS-115 魔導騎士ウルザード: 相手は1枚ドローしてもよい）。
      const enteredRs115 = selected.some((id) =>
        finished.state.players[enemyId].battle.some((c) => c.instanceId === id && c.cardId === "RS-115"),
      );
      if (enteredRs115) {
        const withDraw = startOpponentMayDrawChoice(finished.state, actorId, pending.phasePlayerId);
        if (withDraw) return { ...finished, state: withDraw };
      }
      return finished;
    }

    default:
      return { error: "invalid_choice_kind" };
  }
}

export function getValidTargetsForChoice(state: GameState): string[] {
  return state.pendingEffectChoice?.validInstanceIds ?? [];
}

export {
  collectFieldUnitIds,
  collectAnyFieldUnitIds,
  collectCommandIds,
  collectPowerIds,
  collectEnemyRushSmallIds,
};

function findCardOwnerCardId(state: GameState, instanceId: string): string {
  for (const pid of ["player1", "player2"] as const) {
    for (const zone of ["discard", "deck", "hand", "power", "command", "rush", "battle", "operation"] as const) {
      const card = state.players[pid][zone].find((c) => c.instanceId === instanceId);
      if (card) return card.cardId;
    }
  }
  return instanceId;
}
