import { canUseKyouryuumaru } from "../rules/legend1/otherLinesNamedEffects";
import { lionArmorAvailable } from "../rules/legend1/set6NamedEffects348";
import { runWithStateRng } from "./rng";
import { listSet8BHandActivations } from "../rules/legend1/set8NamedEffectsB";
import { hasTurnRuleModifier } from "./scopedModifiers";
import { isHoldToActivateNc } from "../rules/holdToActivate";
import type { GameAction, RushAction } from "../types/actions";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { isCostWindowSatisfied } from "./costWindow";
import { COMMAND_ZONE_MAX } from "../types/game";
import { hasAutoBattleEntryOnRushNote } from "@rangers-strike/cards";
import { canWingAttackFromRush, canHoldForWing, canCancelWingHold } from "../keywords/battleKeywords";
import { canRiderMountVehicle, canMountRideIntoBattle } from "../keywords/ride";
import {
  canPlayOperationCard,
  collectOperationTargets,
  needsOperationTarget,
} from "../effects/resolveOperation";
import {
  dslOperationOpensChoose,
  getDslOperationEffect,
  isDslInterpretableEffect,
  shouldUseDslOperation,
} from "../dsl/dslCatalog";
import { collectTargetInstanceIds } from "../dsl/targetSelectors";
import {
  canPlayOperation,
  canPlayOperationExceptCommandHold,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
  isRushable,
  isUnit,
  needsZordMaterial,
  parsePowerCost,
  rushPowerCost,
} from "./catalog";
import { effectivePowerCost } from "./power";
import { godomDiscardCandidates } from "../rules/godomRushPay";
import {
  listZordDownRushPaymentVariants,
  needsZordDownPayment,
} from "../rules/zordDown";
import { findInZone, opponent, payPowerCost, rushReactorId } from "./helpers";
import { canStrikeUnit } from "../rules/combo";
import { canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import { canUseJuuKunDo, canUseLionDance, gomaPalaceForcesAttack } from "../rules/juuKunDo";
import {
  canMoveUnitToBattle,
  cannotAttackOrStrikeThisTurn,
  unitCannotInitiateAttack,
  countReleasedCommands,
  mustEnterBattleBeforePhaseEnd,
} from "../rules/restrictions";
import { canInitiateShironLight, isShironLightRushTarget } from "../rules/shironLight";
import {
  canActivateResidentOperation,
  listResidentActivationEffects,
} from "../rules/permanentOperation";
import {
  canAttackDefender,
  darkDealRushPowerBudget,
} from "../rules/legend3/restrictions";
import {
  getCategoryPaymentOptions,
  isInitiateCommandPaymentLegal,
  isResolveCommandPaymentLegal,
  buildEffectHoldPayment,
  getBattleEntryPaymentNeeds,
  needsEffectHoldPayment,
  validatePaymentSelection,
} from "../rules/commandPayment";
import { hasCommandForCardUse } from "../rules/restrictions";
import {
  canBeginZordSetup,
  listZordSetupResolveActions,
} from "../rules/zordSetup";
import { canToggleBpBudgetTarget, FIRE_DANCE_EFFECT_ID, isValidEffectChoiceTarget } from "../rules/pendingChoices";
import { canBonusDraw, canReleaseStartCommands, canReturnBattleAtStart, isReleaseStepComplete, listReturnableStartGroupIds } from "../rules/startPhase";
import {
  listZordRushPaymentVariants,
  listZordUpRushPaymentVariants,
} from "../rules/mothership";
import { collectZordMaterials, requiresAllFusionPartners } from "../rules/zord";
import { withZordFeatureContext } from "../rules/zordFeatureContext";
import { isZordUpCost, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import { rushAdditionalConditionApplies } from "../rules/bkOperationTurnRules";
import { operationFizzles } from "../rules/operationFizzle";
import {
  canExecuteHandCounter,
  canInitiateCounterCategoryPayment,
  canPlayDinoGutsLeaveCounter,
  canPlayHandCounter,
  canPlayMagLoadLeaveCounter,
  canPlaySageAelLeaveCounter,
  collectHiddenNinjaSubstitutes,
  collectMechanicNinjaRecruits,
  isMechanicNinjaCounter,
  getCounterEffectId,
  canUseRushReactionCounter,
  hasPlayableDinoChronicleCounter,
  isCounterReactionActive,
  isHandCounterCard,
  MUSIC_BOX_SKIP_BATTLE_RULE,
} from "../rules/operationCounters";
import {
  canPlayPlasmaEnergyCounter,
  collectFiveTechInterceptors,
} from "../rules/strikeReactions";
import { getDamagePaymentChoices, damagePaymentChoosingPlayer } from "../rules/damagePayment";
import { getStackActorPlayerId, hasOpenReactionWindow, peekEffectStackTop } from "../rules/effectStack";
import { getCardEffect } from "@rangers-strike/cards";
import { isHidoraEggUsed } from "../rules/turnModifiers";
import { listValidChaseVehicleIds } from "../keywords/chase";
import { canDeclareRush, rushPowerBudget } from "../rules/rushDeclaration";
import { jaryuInvasionAllowsRushWithoutHold } from "../rules/jaryuInvasion";
import { listKamenRideAbilityUnits } from "../rules/riderKickEffects";
import { SCRAMBLE_EFFECT_ID, listFieldActivatedAbilityCards } from "../rules/fieldActivatedAbilities";
import { isErrataConfirmableChoice } from "../rules/errataCardEffects";
import { isSet4ConfirmableChoice, magiPunchCounterIds } from "../rules/legend1/set4NamedEffects";
import { giantBombCounterIds, isSet5AConfirmableChoice, operationPaymentCategories } from "../rules/legend1/set5NamedEffectsA";
import { isSet6AuditConfirmableChoice } from "../rules/legend1/set6AuditFixes";
import { isSet7AChoiceEffect, isSet7AConfirmableChoice, set7AStrikeCounterIds } from "../rules/legend1/set7NamedEffectsA";
import { isSet8AChoiceEffect, isSet8AConfirmableChoice, isSet8AResident } from "../rules/legend1/set8NamedEffectsA";
import { canConfirmSet8CChoice, isSet8CChoiceEffect } from "../rules/legend1/set8NamedEffectsC";
import { canConfirmSet9CChoice, isSet9CChoiceEffect } from "../rules/legend1/set9NamedEffectsC";
import { canActivateSet9AResident, canConfirmSet9AChoice, isSet9AChoiceEffect, isSet9AResidentCard } from "../rules/legend1/set9NamedEffectsA";
import { isRk2ChoiceEffect, rk2RaiaDiscardCandidates } from "../rules/rk/rk2UnitEffects";
import { canConfirmRk3Choice, isRk3ChoiceEffect } from "../rules/rk/rk3UnitEffects";
import { canConfirmRk4Choice, isRk4ChoiceEffect, swapResidentFeature } from "../rules/rk/rk4UnitEffects";
import { isRk1ActivatableResident, isRk1BattleCounterCard, isRk1ChoiceEffect, isRk1LeaveCounterCard, rk1BattleCounterConditionMet, rk1LeaveCounterConditionMet } from "../rules/rk/rk1NamedEffects";
import { canConfirmSet9BChoice, isSet9BChoiceEffect } from "../rules/legend1/set9NamedEffectsB";
import { withEffectiveRushConditionDefinitions } from "../rules/rushAdditionalCondition";
import { needsHoldExtraCommand } from "../rules/zordExtended";
import { isSet7BConfirmableChoice } from "../rules/legend1/set7NamedEffectsB";
import { magiTicketUsable, stageMagiTicket } from "../rules/legend1/set5NamedEffects";
import { countAvailablePower } from "./power";
import { battleActBlocked, canSelfRushFromZone } from "../rules/keywordGapRuntime";
import { appendIcyRushActions, icyStateForAction } from "../rules/legend1/icyLastResort";
import {
  getMorphReactionActorId,
  morphOrderChooserPlayerId,
  morphReplacementChooserPlayerId,
} from "../rules/morphProcedure";

function assertActive(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId && state.winner === null;
}

/** カウンター窓が開いているとき、応答するプレイヤー（効果スタック最上位）。 */
export function getReactionChooserPlayerId(state: GameState): PlayerId | undefined {
  if (!hasOpenReactionWindow(state)) return undefined;
  return getStackActorPlayerId(state);
}

function isCounterPaymentAction(
  state: GameState,
  action: Extract<GameAction, { type: "initiate_command_payment" }>,
): boolean {
  return (
    action.kind === "category_use" &&
    isCounterReactionActive(state) &&
    isHandCounterCard(state, action.playerId, action.sourceInstanceId)
  );
}

function appendCounterCategoryPaymentActions(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
  actions: GameAction[],
  options?: { substituteInstanceId?: string },
): void {
  if (!canInitiateCounterCategoryPayment(state, playerId, counterInstanceId)) return;

  const found = findInZone(state.players[playerId], "hand", counterInstanceId);
  if (!found) return;
  const categories = cardCategories(getDefinition(state.definitions, found.card.cardId)!);

  const pushPayment = (prismSubstitute?: boolean) => {
    const action: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: counterInstanceId,
      prismSubstitute,
      substituteInstanceId: options?.substituteInstanceId,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  // RK-036 仮面ライダーライア【運命への反抗】: ホールドせず、同じカテゴリのカードを自軍コマンドゾーンから捨札にして使う（rules/rk/rk2UnitEffects.ts）。
  if (rk2RaiaDiscardCandidates(state.players[playerId], state.definitions, categories).length > 0) {
    const raia: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: counterInstanceId,
      raiaDiscard: true,
      substituteInstanceId: options?.substituteInstanceId,
    };
    if (isInitiateCommandPaymentLegal(state, raia)) actions.push(raia);
  }

  const paymentOptions = getCategoryPaymentOptions(state, playerId, categories, {
    perRushPayment: true,
    callLeadKind: "lead",
  });
  if (!paymentOptions) return;

  pushPayment(paymentOptions.prismSubstitute);
  if (paymentOptions.prismAvailable && !paymentOptions.prismSubstitute) {
    pushPayment(true);
  }
}

function isReactionWindowAction(action: GameAction): boolean {
  switch (action.type) {
    case "initiate_command_payment":
      return true;
    case "play_counter":
    case "pass_strike_reaction":
    case "pass_battle_reaction":
    case "pass_rush_reaction":
    case "pass_morph_reaction":
    case "select_morph_unit":
    case "pass_leave_reaction":
    case "use_register":
    case "pass_register":
    case "resolve_chase":
    case "pass_chase":
    case "five_tech_intercept":
    case "use_plasma_energy":
    case "use_super_shield":
    case "use_juu_kun_do":
      return true;
    default:
      return false;
  }
}

function appendStrikeReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingStrike;
  if (!pending) return;

  const defenderId = opponent(pending.strikerPlayerId);
  if (playerId !== defenderId) return;

  for (const interceptInstanceId of collectFiveTechInterceptors(state, defenderId)) {
    actions.push({
      type: "five_tech_intercept",
      playerId: defenderId,
      interceptInstanceId,
    });
  }

  if (canPlayPlasmaEnergyCounter(state, defenderId)) {
    actions.push({ type: "use_plasma_energy", playerId: defenderId });
  }

  // RS-184 マジパンチ（BP8000以下の敵軍ユニットにストライクされたとき）・RS-432 隠流マキビシ（ストライクされたとき）。
  for (const counterId of [
    ...magiPunchCounterIds(state, defenderId, pending),
    ...set7AStrikeCounterIds(state, defenderId, pending, canPlayHandCounter),
  ]) {
    appendCounterCategoryPaymentActions(state, defenderId, counterId, actions);
    if (canExecuteHandCounter(state, defenderId, counterId)) {
      actions.push({ type: "play_counter", playerId: defenderId, instanceId: counterId });
    }
  }

  actions.push({ type: "pass_strike_reaction", playerId: defenderId });
}

function appendBattleReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingBattle;
  if (!pending || playerId !== pending.defenderPlayerId) return;

  const defender = state.players[pending.defenderPlayerId];
  const defenderCard = findInZone(defender, "battle", pending.defenderInstanceId)?.card;

  for (const card of defender.hand) {
    const effectId = getCounterEffectId(state, playerId, card.instanceId);
    if (effectId === "new_gymnastics") {
      if (!defenderCard || !isSmallUnit(state.definitions, defenderCard.cardId)) continue;
      appendCounterCategoryPaymentActions(state, playerId, card.instanceId, actions);
      if (canExecuteHandCounter(state, playerId, card.instanceId)) {
        actions.push({ type: "play_counter", playerId, instanceId: card.instanceId });
      }
    }
    if (isMechanicNinjaCounter(card.cardId)) {
      if (!defenderCard || !isSmallUnit(state.definitions, defenderCard.cardId)) continue;
      const recruits = collectMechanicNinjaRecruits(state, playerId);
      const options: Array<string | undefined> = recruits.length > 0 ? recruits : [undefined];
      for (const recruit of options) {
        appendCounterCategoryPaymentActions(state, playerId, card.instanceId, actions, {
          substituteInstanceId: recruit,
        });
        if (canExecuteHandCounter(state, playerId, card.instanceId)) {
          actions.push({
            type: "play_counter",
            playerId,
            instanceId: card.instanceId,
            substituteInstanceId: recruit,
          });
        }
      }
      continue;
    }
    // RK-004 ギギの腕輪・RK-009 二人の世紀王（自軍Sユニットが敵軍Sユニットにアタックされたとき。rules/rk/rk1NamedEffects.ts）。
    if (isRk1BattleCounterCard(card.cardId)) {
      if (!rk1BattleCounterConditionMet(state, playerId, card.cardId, pending)) continue;
      if (!canPlayHandCounter(state, playerId, card.instanceId)) continue;
      appendCounterCategoryPaymentActions(state, playerId, card.instanceId, actions);
      if (canExecuteHandCounter(state, playerId, card.instanceId)) {
        actions.push({ type: "play_counter", playerId, instanceId: card.instanceId });
      }
      continue;
    }
    if (effectId === "hidden_ninja") {
      for (const sub of collectHiddenNinjaSubstitutes(state, [
        pending.defenderInstanceId,
        pending.attackerInstanceId,
      ])) {
        appendCounterCategoryPaymentActions(state, playerId, card.instanceId, actions, {
          substituteInstanceId: sub.instanceId,
        });
        if (canExecuteHandCounter(state, playerId, card.instanceId)) {
          actions.push({
            type: "play_counter",
            playerId,
            instanceId: card.instanceId,
            substituteInstanceId: sub.instanceId,
          });
        }
      }
    }
  }

  actions.push({ type: "pass_battle_reaction", playerId });
}

function appendMorphReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingMorph;
  if (!pending) return;

  if (state.pendingEffectChoice?.effectId === "morph_replacement") {
    if (playerId === morphReplacementChooserPlayerId(pending)) {
      appendEffectChoiceActions(state, playerId, actions);
    }
    return;
  }

  const orderChooser = morphOrderChooserPlayerId(pending);
  if (orderChooser && playerId === orderChooser) {
    for (const morphUnitInstanceId of pending.morphUnitInstanceIds) {
      actions.push({
        type: "select_morph_unit",
        playerId: orderChooser,
        morphUnitInstanceId,
      });
    }
  }

  if (playerId === pending.defenderPlayerId) {
    actions.push({ type: "pass_morph_reaction", playerId: pending.defenderPlayerId });
  }
}

function appendRushReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingRush;
  if (!pending) return;
  const defenderId = rushReactorId(pending);
  if (playerId !== defenderId) return;

  const defender = state.players[defenderId];
  for (const card of defender.hand) {
    // 疾風流超忍法（RS-026／再録 RS-247）・宏のオルゴール時計（RK-012）。atwiki/page-424 Q12・Q15
    if (!canUseRushReactionCounter(state, defenderId, card.instanceId, pending)) continue;
    appendCounterCategoryPaymentActions(state, defenderId, card.instanceId, actions);
    if (canExecuteHandCounter(state, defenderId, card.instanceId)) {
      actions.push({ type: "play_counter", playerId: defenderId, instanceId: card.instanceId });
    }
  }

  actions.push({ type: "pass_rush_reaction", playerId: defenderId });
}

function appendLeaveReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingLeave;
  if (!pending || playerId !== pending.ownerPlayerId) return;

  const owner = state.players[pending.ownerPlayerId];
  for (const card of owner.hand) {
    const effectId = getCounterEffectId(state, pending.ownerPlayerId, card.instanceId);
    if (isRk1LeaveCounterCard(card.cardId)) {
      // RK-015 人類の進化（「男」「女」の自軍ユニットが撃破されて捨札になったとき。rules/rk/rk1NamedEffects.ts）。
      if (!rk1LeaveCounterConditionMet(state, pending.ownerPlayerId, pending)) continue;
      if (!canPlayHandCounter(state, pending.ownerPlayerId, card.instanceId)) continue;
    } else if (effectId === "dino_chronicle") {
      if (
        !hasPlayableDinoChronicleCounter(state, pending.ownerPlayerId, pending.leavingCardId, {
          requireEnemyTurn: false,
        })
      ) {
        continue;
      }
    } else if (effectId === "dino_guts") {
      if (
        !canPlayDinoGutsLeaveCounter(
          state,
          pending.ownerPlayerId,
          pending.leavingCardId,
          card.instanceId,
          { requireEnemyTurn: false },
        )
      ) {
        continue;
      }
    } else if (effectId === "sage_ael") {
      if (
        !canPlaySageAelLeaveCounter(
          state,
          pending.ownerPlayerId,
          pending.leavingCardId,
          pending.fromZone,
          card.instanceId,
        )
      ) {
        continue;
      }
    } else if (effectId === "mag_load") {
      if (
        !canPlayMagLoadLeaveCounter(
          state,
          pending.ownerPlayerId,
          pending.leavingCardId,
          pending.fromZone,
          card.instanceId,
        )
      ) {
        continue;
      }
    } else {
      continue;
    }
    appendCounterCategoryPaymentActions(
      state,
      pending.ownerPlayerId,
      card.instanceId,
      actions,
    );
    if (canExecuteHandCounter(state, pending.ownerPlayerId, card.instanceId)) {
      actions.push({
        type: "play_counter",
        playerId: pending.ownerPlayerId,
        instanceId: card.instanceId,
      });
    }
  }

  if (pending.superShieldInstanceId) {
    actions.push({
      type: "use_super_shield",
      playerId: pending.ownerPlayerId,
    });
  }
  // RS-324 マジマザー【ジルマ・マジュナ】（rules/legend1/set5NamedEffects.ts）。
  for (const substituteInstanceId of pending.magiMotherInstanceIds ?? []) {
    actions.push({ type: "use_super_shield", playerId: pending.ownerPlayerId, substituteInstanceId });
  }

  actions.push({ type: "pass_leave_reaction", playerId: pending.ownerPlayerId });
}

function combinationsOf<T>(items: T[], count: number): T[][] {
  if (count <= 0) return [[]];
  if (count > items.length) return [];
  const [head, ...rest] = items;
  return [...combinationsOf(rest, count - 1).map((c) => [head!, ...c]), ...combinationsOf(rest, count)];
}

/**
 * RS-586 巨神ゴードム【魔神に不足する物】「必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする」:
 * 捨札にするユニットはプレイヤーが選ぶ。候補が足りない数より多ければ、ラッシュの宣言（rush / initiate_command_payment /
 * begin_zord_setup）を選び方ごとに分ける（godomDiscardInstanceIds）。アブレラ【闇の取引】等の別の手段でも満たせるなら、
 * ゴードムを使わない宣言（[]）も残す（「してもよい」）。
 */
function expandGodomRushVariants(state: GameState, playerId: PlayerId, actions: GameAction[]): void {
  const player = state.players[playerId];
  const expanded: GameAction[] = [];
  let changed = false;
  for (const action of actions) {
    const sourceId =
      action.type === "rush"
        ? action.instanceId
        : action.type === "initiate_command_payment" && action.kind === "category_use"
          ? action.sourceInstanceId
          : action.type === "begin_zord_setup"
            ? action.zordInstanceId
            : undefined;
    const handCard = sourceId ? player.hand.find((c) => c.instanceId === sourceId) : undefined;
    const def = handCard ? getDefinition(state.definitions, handCard.cardId) : undefined;
    if (!handCard || !def || !isUnit(def) || "godomDiscardInstanceIds" in action && action.godomDiscardInstanceIds) {
      expanded.push(action);
      continue;
    }
    const zord = action as { zordMaterialInstanceId?: string; zordMaterialInstanceIds?: string[] };
    const materials = new Set([...(zord.zordMaterialInstanceIds ?? []), ...(zord.zordMaterialInstanceId ? [zord.zordMaterialInstanceId] : [])]);
    const cost = effectivePowerCost(state, playerId, rushPowerCost(state, playerId, def, zord));
    const shortage = cost - countAvailablePower(state, playerId);
    const candidates = shortage > 0 ? godomDiscardCandidates(state, playerId, player, def).filter((id) => !materials.has(id)) : [];
    if (candidates.length < shortage || candidates.length === 0) {
      expanded.push(action);
      continue;
    }
    changed = true;
    // 候補がちょうど足りない数なら選ぶ余地はない（1通り）。省略した宣言も同じ組を捨札にする。
    for (const set of combinationsOf(candidates, shortage)) {
      expanded.push({ ...action, godomDiscardInstanceIds: set } as GameAction);
    }
    if (darkDealRushPowerBudget(state, playerId, player, def) >= cost) {
      expanded.push({ ...action, godomDiscardInstanceIds: [] } as GameAction);
    }
  }
  if (!changed) return;
  actions.splice(0, actions.length, ...expanded);
}

function appendZordSetupActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];
  for (const card of player.hand) {
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition) continue;
    const isZordDown = needsZordDownPayment(
      card.cardId,
      definition.powerCost,
      definition,
    );
    if (
      !isUnit(definition) ||
      (!needsZordMaterial(state.definitions, card.cardId) && !isZordDown)
    ) {
      continue;
    }
    if (requiresAllFusionPartners(card.cardId)) continue;
    if (findDirectZordRushAction(state, playerId, card.instanceId)) continue;
    if (!canBeginZordSetup(state, playerId, card.instanceId)) continue;
    actions.push({
      type: "begin_zord_setup",
      playerId,
      zordInstanceId: card.instanceId,
    });
  }
}

/**
 * RS-325【マジチケット】: 自軍コマンドゾーンのリリース状態のオペレーションを、手札から使うときと同じ選択肢で発動する
 * （rules/legend1/set5NamedEffects.ts。必要パワーは印刷値）。
 */
function appendMagiTicketActions(state: GameState, playerId: PlayerId, actions: GameAction[]): void {
  const player = state.players[playerId];
  if (!player.rush.some((c) => c.cardId === "RS-325")) return;
  const power = countAvailablePower(state, playerId);
  for (const card of player.command) {
    if (!magiTicketUsable(state, playerId, card, (id) => canPlayOperationCard(state.definitions, id), power)) continue;
    const staged = stageMagiTicket(state, playerId, card.instanceId);
    if (!staged) continue;
    const viaHand: GameAction[] = [];
    appendOperationActions(staged, playerId, viaHand);
    for (const a of viaHand) {
      if (a.type !== "play_operation" || a.instanceId !== card.instanceId) continue;
      actions.push({
        type: "use_magi_ticket",
        playerId,
        instanceId: card.instanceId,
        ...(a.targetInstanceId ? { targetInstanceId: a.targetInstanceId } : {}),
        ...(a.extraInstanceId ? { extraInstanceId: a.extraInstanceId } : {}),
      });
    }
  }
}

function appendOperationActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];

  for (const card of player.hand) {
    if (!canPlayOperationCard(state.definitions, card.cardId)) continue;
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || !canPlayOperation(state, playerId, definition)) continue;

    const effect = getCardEffect(card.cardId);

    if (operationFizzles(state, playerId, card.instanceId, card.cardId)) {
      // ルール: R-CARD-03, R-RES-04 — 対象がなくても空撃ちで使用できる（効果は発動しない）。
      actions.push({ type: "play_operation", playerId, instanceId: card.instanceId });
      continue;
    }

    if (effect?.effectId === "cyber_s_rider") {
      const others = player.hand.filter((c) => c.instanceId !== card.instanceId);
      if (others.length === 0) continue;
      for (let i = 0; i < others.length; i += 1) {
        actions.push({
          type: "play_operation",
          playerId,
          instanceId: card.instanceId,
          targetInstanceId: others[i]!.instanceId,
        });
        for (let j = i + 1; j < others.length; j += 1) {
          actions.push({
            type: "play_operation",
            playerId,
            instanceId: card.instanceId,
            targetInstanceId: others[i]!.instanceId,
            extraInstanceId: others[j]!.instanceId,
          });
        }
      }
      continue;
    }

    const dslEffect = getDslOperationEffect(card.cardId, "rush");
    const dslChoose =
      dslEffect &&
      shouldUseDslOperation(card.cardId, dslEffect) &&
      dslOperationOpensChoose(dslEffect);

    if (dslChoose && dslEffect.effects[0]?.type === "choose") {
      const choose = dslEffect.effects[0];
      const targets = collectTargetInstanceIds(
        state,
        playerId,
        choose.valid,
        card.instanceId,
        card.cardId,
      );
      if (choose.kind === "optional_deck_draw") {
        if (player.deck.length === 0 && targets.length === 0) continue;
      } else if (targets.length === 0) {
        continue;
      }
      actions.push({
        type: "play_operation",
        playerId,
        instanceId: card.instanceId,
      });
      for (const targetInstanceId of targets) {
        actions.push({
          type: "play_operation",
          playerId,
          instanceId: card.instanceId,
          targetInstanceId,
        });
      }
      continue;
    }

    if (needsOperationTarget(card.cardId) && !dslChoose) {
      for (const targetInstanceId of collectOperationTargets(state, playerId, card.cardId)) {
        actions.push({
          type: "play_operation",
          playerId,
          instanceId: card.instanceId,
          targetInstanceId,
        });
      }
    } else {
      actions.push({
        type: "play_operation",
        playerId,
        instanceId: card.instanceId,
      });
    }
  }
}

function appendHidoraEggActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  if (state.phase !== "rush") return;
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "hidora_egg", state.definitions, { state, playerId })) return;
  if (isHidoraEggUsed(player)) return;
  if (player.deck.length === 0) return;
  actions.push({ type: "hidora_egg", playerId });
}

function appendShironLightActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  if (state.phase !== "rush") return;
  const player = state.players[playerId];
  for (const card of player.operation) {
    if (!canInitiateShironLight(state, playerId, card.instanceId)) continue;
    actions.push({
      type: "shiron_light",
      playerId,
      operationInstanceId: card.instanceId,
    });
  }
}

function appendActivateResidentOperationActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];
  for (const card of player.operation) {
    // 第9弾 RS-608（自軍ラッシュフェイズ）・RS-609（自軍バトルフェイズ）（rules/legend1/set9NamedEffectsA.ts）。
    if (isSet9AResidentCard(card.cardId)) {
      if (canActivateSet9AResident(state, playerId, card.instanceId)) {
        actions.push({ type: "activate_resident_operation", playerId, operationInstanceId: card.instanceId });
      }
      continue;
    }
    // 第8弾 RS-519・RS-522・RS-524・RS-525（RS-524 は自軍バトルフェイズ。rules/legend1/set8NamedEffectsA.ts）。
    if (isSet8AResident(card.cardId)) {
      if (canActivateResidentOperation(state, playerId, card.instanceId)) {
        actions.push({ type: "activate_resident_operation", playerId, operationInstanceId: card.instanceId });
      }
      continue;
    }
    if (state.phase !== "rush") continue;
    const wired = getCardEffect(card.cardId);
    if (wired?.effectId === "shiron_light" || wired?.effectId === "hidora_egg") {
      continue;
    }
    if (
      !swapResidentFeature(card.cardId) &&
      card.cardId !== "RK-249" &&
      !isRk1ActivatableResident(card.cardId) &&
      listResidentActivationEffects(card.cardId).length === 0
    ) {
      continue;
    }
    if (!canActivateResidentOperation(state, playerId, card.instanceId)) continue;
    actions.push({
      type: "activate_resident_operation",
      playerId,
      operationInstanceId: card.instanceId,
    });
  }
}

function appendActivateFieldUnitAbilityActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  for (const unitInstanceId of listKamenRideAbilityUnits(state, playerId)) {
    actions.push({
      type: "activate_field_unit_ability",
      playerId,
      unitInstanceId,
    });
  }
  // RK-043【突入】・XG4-102【ギンクロン発進】・RS-446【スクランブル】（このカードを捨札にして発動）。
  for (const unitInstanceId of listFieldActivatedAbilityCards(state, playerId)) {
    actions.push({
      type: "activate_field_unit_ability",
      playerId,
      unitInstanceId,
    });
  }
  // RS-559【パワーアロー】等: 手札からこのカードを捨札にして発動する（rules/legend1/set8NamedEffectsB.ts）。
  for (const unitInstanceId of listSet8BHandActivations(state, playerId)) {
    actions.push({ type: "activate_field_unit_ability", playerId, unitInstanceId });
  }
}

function appendBattleDanceActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  if (state.phase !== "battle") return;
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "battle_dance", state.definitions)) return;

  const released = player.command.filter((c) => !c.commandHeld);
  if (released.length < 2) return;

  const sUnits = player.battle.filter((card) =>
    isSmallUnit(state.definitions, card.cardId),
  );
  if (sUnits.length === 0) return;

  for (let i = 0; i < released.length; i += 1) {
    for (let j = i + 1; j < released.length; j += 1) {
      const commandInstanceIds = [
        released[i]!.instanceId,
        released[j]!.instanceId,
      ] as [string, string];
      for (const unit of sUnits) {
        actions.push({
          type: "battle_dance_retreat",
          playerId,
          battleInstanceId: unit.instanceId,
          commandInstanceIds,
        });
      }
    }
  }
}

const OPERATION_PHASES = new Set<GameState["phase"]>(["rush"]);

/** カテゴリホールド済みで即ラッシュ可能な手札のゾード。 */
export function findDirectZordRushAction(
  state: GameState,
  playerId: PlayerId,
  zordInstanceId: string,
): RushAction | null {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === zordInstanceId);
  if (!card) return null;

  const definition = getDefinition(state.definitions, card.cardId);
  if (!definition || !isUnit(definition)) return null;

  if (
    needsZordDownPayment(card.cardId, definition.powerCost, definition)
  ) {
    const variants = listZordDownRushPaymentVariants(
      player,
      state.definitions,
      card.cardId,
      card.instanceId,
    );
    for (const variant of variants) {
      if (
        !canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, variant)
      ) {
        continue;
      }
      return {
        type: "rush",
        playerId,
        instanceId: card.instanceId,
        zordMaterialInstanceId: variant.zordMaterialInstanceId,
        zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
        zordMaterialDestination: variant.zordMaterialDestination,
      };
    }
    return null;
  }

  if (
    !isZordUpCost(definition.powerCost) ||
    (!rushAdditionalConditionApplies(state, playerId, card.cardId) &&
      !requiresAllFusionPartners(card.cardId))
  ) {
    return null;
  }

  const variants = listZordUpRushPaymentVariants(
    state,
    playerId,
    card.cardId,
    card.instanceId,
  );
  for (const variant of variants) {
    if (
      !canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, variant)
    ) {
      continue;
    }
    return {
      type: "rush",
      playerId,
      instanceId: card.instanceId,
      zordMaterialInstanceId: variant.zordMaterialInstanceId,
      zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
      zordMaterialDestination: variant.zordMaterialDestination,
      zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
      zordExtraCommandHoldInstanceIds: variant.zordExtraCommandHoldInstanceIds,
    };
  }
  return null;
}

function appendOperationCategoryPaymentActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];

  const pushPayment = (
    instanceId: string,
    targetInstanceId?: string,
    extraInstanceId?: string,
    prismSubstitute?: boolean,
  ) => {
    const action: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: instanceId,
      prismSubstitute,
      targetInstanceId,
      extraInstanceId,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  for (const card of player.hand) {
    if (!canPlayOperationCard(state.definitions, card.cardId)) continue;
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || definition.type !== "operation") continue;
    if (canPlayOperation(state, playerId, definition)) continue;
    if (!canPlayOperationExceptCommandHold(state, playerId, definition)) continue;

    // RS-292【虎の子大秘術】: 手札のオペレーションはどのカテゴリのコマンドをホールドしてもよい。
    const categories = operationPaymentCategories(state, playerId, definition);
    if (categories.length === 0) continue;

    const options = getCategoryPaymentOptions(state, playerId, categories, {
      perRushPayment: true,
      callLeadKind: "lead",
    });
    if (!options) continue;

    const effect = getCardEffect(card.cardId);
    if (effect?.effectId === "cyber_s_rider") {
      const others = player.hand.filter((c) => c.instanceId !== card.instanceId);
      if (others.length === 0) continue;
      for (let i = 0; i < others.length; i += 1) {
        pushPayment(card.instanceId, others[i]!.instanceId, undefined, options.prismSubstitute);
        for (let j = i + 1; j < others.length; j += 1) {
          pushPayment(card.instanceId, others[i]!.instanceId, others[j]!.instanceId, options.prismSubstitute);
        }
      }
      continue;
    }

    const dslEffect = getDslOperationEffect(card.cardId, "rush");
    const dslChoose =
      dslEffect &&
      shouldUseDslOperation(card.cardId, dslEffect) &&
      dslOperationOpensChoose(dslEffect);
    // 対象を先に選ぶオペレーションは、対象ごとに支払いを開始する（空撃ちは対象なし）。
    // DSL の choose は対象を指定しても、指定せず解決時に選んでもよい。
    const fizzles = operationFizzles(state, playerId, card.instanceId, card.cardId);
    let targets: Array<string | undefined> = [undefined];
    if (!fizzles && dslChoose && dslEffect.effects[0]?.type === "choose") {
      targets = [
        ...collectTargetInstanceIds(state, playerId, dslEffect.effects[0].valid, card.instanceId, card.cardId),
        undefined,
      ];
    } else if (!fizzles && needsOperationTarget(card.cardId) && !dslChoose) {
      targets = collectOperationTargets(state, playerId, card.cardId);
    }
    for (const targetInstanceId of targets) {
      pushPayment(card.instanceId, targetInstanceId, undefined, options.prismSubstitute);
      if (options.prismAvailable && !options.prismSubstitute) {
        pushPayment(card.instanceId, targetInstanceId, undefined, true);
      }
    }
  }
}

function appendRushCategoryPaymentActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];

  const pushPayment = (
    instanceId: string,
    zord?: {
      zordMaterialInstanceId?: string;
      zordMaterialInstanceIds?: string[];
      zordMothershipHoldInstanceIds?: string[];
      zordExtraCommandHoldInstanceIds?: string[];
      zordMaterialDestination?: import("../types/actions").ZordMaterialDestination;
    },
    prismSubstitute?: boolean,
  ) => {
    const action: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: instanceId,
      prismSubstitute,
      zordMaterialInstanceId: zord?.zordMaterialInstanceId,
      zordMaterialInstanceIds: zord?.zordMaterialInstanceIds,
      zordMothershipHoldInstanceIds: zord?.zordMothershipHoldInstanceIds,
      zordExtraCommandHoldInstanceIds: zord?.zordExtraCommandHoldInstanceIds,
      zordMaterialDestination: zord?.zordMaterialDestination,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  // rush_from_discard_count_*: コマンド/パワーからの自己ラッシュ
  for (const zone of ["command", "power", "hand"] as const) {
    for (const card of player[zone]) {
      if (canSelfRushFromZone(state, playerId, zone, card.instanceId)) {
        actions.push({
          type: "self_rush_from_zone",
          playerId,
          zone,
          instanceId: card.instanceId,
        });
      }
    }
  }

  for (const card of player.hand) {
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || !isRushable(definition)) continue;

    const categories = cardCategories(definition);
    if (categories.length === 0) continue;

    if (
      isUnit(definition) &&
      isZordUpCost(definition.powerCost) &&
      (rushAdditionalConditionApplies(state, playerId, card.cardId) ||
        requiresAllFusionPartners(card.cardId))
    ) {
      if (requiresAllFusionPartners(card.cardId)) {
        if (canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId)) {
          continue;
        }
        if (
          !canRushUnitExceptCommandHold(
            player,
            state.definitions,
            definition,
            card.instanceId,
            undefined,
            undefined,
            undefined,
            // RS-586【魔神に不足する物】・アブレラ【闇の取引】で必要パワーを補える分も含める。
            rushPowerBudget(state, playerId, player, definition),
            { ...state, playerId },
          )
        ) {
          continue;
        }
        const options = getCategoryPaymentOptions(state, playerId, categories, {
          perRushPayment: true,
          callLeadKind: "call",
          emergencyRushCardId: card.cardId,
        });
        if (!options) continue;
        pushPayment(card.instanceId, undefined, options.prismSubstitute);
        if (options.prismAvailable && !options.prismSubstitute) {
          pushPayment(card.instanceId, undefined, true);
        }
      } else {
        if (canBeginZordSetup(state, playerId, card.instanceId)) {
          continue;
        }
        const variants = listZordUpRushPaymentVariants(
          state,
          playerId,
          card.cardId,
          card.instanceId,
        );
        for (const variant of variants) {
          if (canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, variant)) {
            continue;
          }
          if (
            !canRushUnitExceptCommandHold(
              player,
              state.definitions,
              definition,
              card.instanceId,
              variant.zordMaterialInstanceId,
              variant.zordMothershipHoldInstanceIds,
              variant.zordMaterialDestination,
              // RS-586【魔神に不足する物】・アブレラ【闇の取引】で必要パワーを補える分も含める。
              rushPowerBudget(state, playerId, player, definition),
              { ...state, playerId },
              variant.zordMaterialInstanceIds,
              variant.zordExtraCommandHoldInstanceIds,
            )
          ) {
            continue;
          }
          const options = getCategoryPaymentOptions(state, playerId, categories, {
            perRushPayment: true,
            callLeadKind: "call",
            emergencyRushCardId: card.cardId,
          });
          if (!options) continue;
          pushPayment(card.instanceId, variant, options.prismSubstitute);
          if (options.prismAvailable && !options.prismSubstitute) {
            pushPayment(card.instanceId, variant, true);
          }
        }
      }
    } else if (
      needsZordDownPayment(card.cardId, definition.powerCost, definition)
    ) {
      const zordVariants = [
        {},
        ...listZordDownRushPaymentVariants(
          player,
          state.definitions,
          card.cardId,
          card.instanceId,
        ),
      ];
      for (const zord of zordVariants) {
        if (
          canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, zord)
        ) {
          continue;
        }
        if (
          !canRushUnitExceptCommandHold(
            player,
            state.definitions,
            definition,
            card.instanceId,
            zord.zordMaterialInstanceId,
            undefined,
            zord.zordMaterialDestination,
            // RS-586【魔神に不足する物】・アブレラ【闇の取引】で必要パワーを補える分も含める。
            rushPowerBudget(state, playerId, player, definition),
            { ...state, playerId },
          )
        ) {
          continue;
        }
        const options = getCategoryPaymentOptions(state, playerId, categories, {
          perRushPayment: true,
          callLeadKind: "call",
          emergencyRushCardId: card.cardId,
        });
        if (!options) continue;
        pushPayment(card.instanceId, zord, options.prismSubstitute);
        if (options.prismAvailable && !options.prismSubstitute) {
          pushPayment(card.instanceId, zord, true);
        }
      }
    } else {
      if (
        canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId) &&
        // RS-242: ホールドせずにラッシュしてもよい（ホールドしてラッシュすることもできる）。
        !jaryuInvasionAllowsRushWithoutHold(state, playerId, definition)
      ) {
        continue;
      }
      if (
        !canRushUnitExceptCommandHold(
          player,
          state.definitions,
          definition,
          card.instanceId,
          undefined,
          undefined,
          undefined,
          // RS-586【魔神に不足する物】・アブレラ【闇の取引】で必要パワーを補える分も含める。
          rushPowerBudget(state, playerId, player, definition),
          { ...state, playerId },
        )
      ) {
        continue;
      }
      const options = getCategoryPaymentOptions(state, playerId, categories, {
        perRushPayment: true,
        callLeadKind: "call",
        emergencyRushCardId: card.cardId,
      });
      if (!options) continue;
      pushPayment(card.instanceId, undefined, options.prismSubstitute);
      if (options.prismAvailable && !options.prismSubstitute) {
        pushPayment(card.instanceId, undefined, true);
      }
    }
  }
}

function appendEffectChoiceActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return;

  if (pending.optional || pending.effectId === "earth_force") {
    actions.push({ type: "skip_effect_choice", playerId });
  }

  // 「～してもよい」の任意効果の確認（rules/optionalEffects.ts）: 行う＝confirm、行わない＝skip。
  if (pending.mayConfirm) {
    actions.push({ type: "confirm_effect_choice", playerId });
    // 「行う」を選択肢（validInstanceIds）として選んでもよい（confirm と同じ）。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    return;
  }

  if (isRk3ChoiceEffect(pending.effectId)) {
    // ライダーEXP vol.1 RK-043〜RK-063 の選択（rules/rk/rk3UnitEffects.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (canConfirmRk3Choice(pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isRk4ChoiceEffect(pending.effectId)) {
    // ライダーEXP RK-064〜RK-084 の選択（rules/rk/rk4UnitEffects.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (canConfirmRk4Choice(pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isRk1ChoiceEffect(pending.effectId) || isRk2ChoiceEffect(pending.effectId)) {
    // ライダーEXP vol.1 RK-001〜RK-021 の選択（rules/rk/rk1NamedEffects.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    return;
  }

  if (pending.effectId === FIRE_DANCE_EFFECT_ID) {
    // RS-159【ファイヤーダンス】「敵軍ダメージの数まで選んで」— 1つずつ選び、少なくても確定できる。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (needsEffectHoldPayment(pending, state) && buildEffectHoldPayment(state)) {
    actions.push({
      type: "initiate_command_payment",
      playerId,
      kind: "effect_hold",
      sourceInstanceId: pending.sourceInstanceId ?? pending.validInstanceIds[0]!,
    });
    return;
  }

  if (pending.kind === "deck_top_or_bottom") {
    actions.push({ type: "resolve_ruin_survey", playerId, placement: "top" });
    actions.push({ type: "resolve_ruin_survey", playerId, placement: "bottom" });
    return;
  }

  if (pending.kind === "seabed_draw") {
    actions.push({ type: "resolve_seabed_draw", playerId, placement: "top" });
    actions.push({ type: "resolve_seabed_draw", playerId, placement: "bottom" });
    return;
  }

  if (pending.kind === "optional_deck_draw") {
    actions.push({ type: "resolve_effect_choice", playerId, instanceId: "draw" });
    return;
  }

  if (pending.kind === "declare_number") {
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    return;
  }

  if (
    isErrataConfirmableChoice(pending.effectId) ||
    isSet4ConfirmableChoice(pending.effectId) ||
    isSet5AConfirmableChoice(pending) ||
    isSet6AuditConfirmableChoice(pending.effectId)
  ) {
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isSet8AChoiceEffect(pending.effectId)) {
    // 第8弾 RS-516〜RS-537 の選択（rules/legend1/set8NamedEffectsA.ts）。候補はモジュール側で絞り込み済み。
    const selected = pending.selectedInstanceIds ?? [];
    for (const instanceId of pending.validInstanceIds) {
      if (selected.includes(instanceId)) continue;
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (isSet8AConfirmableChoice(pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isSet9AChoiceEffect(pending.effectId)) {
    // 第9弾 RS-605〜RS-626 の選択（rules/legend1/set9NamedEffectsA.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (canConfirmSet9AChoice(state, pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isSet9BChoiceEffect(pending.effectId)) {
    // 第9弾 RS-627〜RS-647 の選択（rules/legend1/set9NamedEffectsB.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (canConfirmSet9BChoice(pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isSet8CChoiceEffect(pending.effectId)) {
    // 第8弾 RS-560〜RS-581 の選択（rules/legend1/set8NamedEffectsC.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (canConfirmSet8CChoice(state, pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isSet9CChoiceEffect(pending.effectId)) {
    // 第9弾 RS-648〜RS-669 の選択（rules/legend1/set9NamedEffectsC.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (canConfirmSet9CChoice(state, pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (isSet7AChoiceEffect(pending.effectId)) {
    // 第7弾 RS-432〜RS-452 の選択（rules/legend1/set7NamedEffectsA.ts）。候補はモジュール側で絞り込み済み。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (isSet7AConfirmableChoice(pending)) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (pending.kind === "select_commands" && pending.effectId === SCRAMBLE_EFFECT_ID) {
    // RS-446【スクランブル】「3枚まで」— 1枚以上選べば、少なくても確定できる。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if ((pending.selectedInstanceIds ?? []).length > 0) {
      actions.push({ type: "confirm_effect_choice", playerId });
    }
    return;
  }

  // 第7弾（rules/legend1/set7NamedEffectsB.ts）の「…まで選ぶ」選択: 1つずつ選び、1つ以上選んだら確定できる。
  if (isSet7BConfirmableChoice(pending)) {
    const selected = pending.selectedInstanceIds ?? [];
    for (const instanceId of pending.validInstanceIds) {
      if (selected.includes(instanceId)) continue;
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (selected.length > 0) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (pending.kind === "scry_keep_one" && pending.siteTransportMeta?.step === "deck") {
    // RS-472【現場への搬送】: 山札から1枚ずつ選んで置き、1枚以上置いたら確定できる（見送りは optional の skip）。
    const selected = pending.selectedInstanceIds ?? [];
    const deck = state.players[playerId].deck;
    for (const instanceId of pending.validInstanceIds) {
      if (selected.includes(instanceId) || !deck.some((c) => c.instanceId === instanceId)) continue;
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if (selected.length > 0) actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (pending.kind === "select_commands" && pending.siteTransportMeta?.step === "discard") {
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  if (pending.kind === "shiron_light") {
    if (pending.shironLightMeta?.step === "pick") {
      for (const instanceId of pending.validInstanceIds) {
        actions.push({ type: "resolve_effect_choice", playerId, instanceId });
      }
      return;
    }
    if (pending.shironLightMeta?.step === "reveal") {
      actions.push({ type: "confirm_shiron_reveal", playerId });
      return;
    }
    return;
  }

  if (pending.kind === "denji_machine") {
    if (pending.denjiMachineMeta?.step === "reveal") {
      actions.push({ type: "confirm_denji_reveal", playerId });
      return;
    }
    if (pending.denjiMachineMeta?.step === "order_bottom") {
      for (const instanceId of pending.validInstanceIds) {
        actions.push({ type: "resolve_effect_choice", playerId, instanceId });
      }
      return;
    }
    return;
  }

  if (pending.effectId === "hi_honoo_ha" && pending.sourceCardId === "RS-205" && !pending.mayConfirm) {
    // RS-205【天火星・稲妻炎上破】「好きな数ホールドしてもよい」— 1つずつ選び、少なくても確定できる。
    for (const instanceId of pending.validInstanceIds) {
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if ((pending.selectedInstanceIds ?? []).length > 0) {
      actions.push({ type: "confirm_effect_choice", playerId });
    }
    return;
  }

  if (pending.effectId === "assault_vector_destroy") {
    // RS-181 破邪百獣剣「カテゴリの数まで好きな数選び」— 1体ずつ選び、少なくても確定できる。
    for (const instanceId of pending.validInstanceIds) {
      if (!isValidEffectChoiceTarget(state, pending, instanceId)) continue;
      actions.push({ type: "resolve_effect_choice", playerId, instanceId });
    }
    if ((pending.selectedInstanceIds ?? []).length > 0) {
      actions.push({ type: "confirm_effect_choice", playerId });
    }
    return;
  }

  if (pending.kind === "select_units_bp_budget") {
    for (const instanceId of pending.validInstanceIds) {
      if (canToggleBpBudgetTarget(state, pending, instanceId)) {
        actions.push({ type: "resolve_effect_choice", playerId, instanceId });
      }
    }
    actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  for (const instanceId of pending.validInstanceIds) {
    if (!isValidEffectChoiceTarget(state, pending, instanceId)) continue;
    actions.push({ type: "resolve_effect_choice", playerId, instanceId });
  }

  const hasChoiceAction = actions.some(
    (action) =>
      action.type === "resolve_effect_choice" ||
      action.type === "confirm_effect_choice" ||
      action.type === "confirm_shiron_reveal" ||
      action.type === "confirm_denji_reveal" ||
      action.type === "resolve_ruin_survey" ||
      action.type === "resolve_seabed_draw" ||
      action.type === "initiate_command_payment",
  );
  if (!hasChoiceAction && !actions.some((action) => action.type === "skip_effect_choice")) {
    actions.push({ type: "skip_effect_choice", playerId });
  }
}

/** RK-012 宏のオルゴール時計:「このターン、相手はバトルフェイズを飛ばす」をバトルフェイズ中に受けた。 */
function battlePhaseSkippedThisTurn(state: GameState, playerId: PlayerId): boolean {
  return (
    state.phase === "battle" &&
    state.activePlayer === playerId &&
    hasTurnRuleModifier(state.players[playerId], MUSIC_BOX_SKIP_BATTLE_RULE)
  );
}

function appendBattleEntryActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingBattleEntry;
  if (!pending || pending.playerId !== playerId) return;

  // RS-379【雷の雄叫び】: NC が成立した直後（バトル進入の行動ウィンドウ）にも発動できる。
  for (const unitInstanceId of listFieldActivatedAbilityCards(state, playerId)) {
    const card = state.players[playerId].battle.find((c) => c.instanceId === unitInstanceId);
    if (unitInstanceId === pending.instanceId && card?.cardId === "RS-379") {
      actions.push({ type: "activate_field_unit_ability", playerId, unitInstanceId });
    }
  }

  const player = state.players[playerId];
  const enemy = state.players[opponent(playerId)];
  const unit = player.battle.find((c) => c.instanceId === pending.instanceId);
  if (!unit || unit.battleActed || battlePhaseSkippedThisTurn(state, playerId)) {
    actions.push({ type: "pass_battle_entry", playerId });
    return;
  }

  // XG3-034【キョウリュウマル】で得た「アタックするかわりに」はルナジェル等の制限下でも発動できる（atwiki/page-1907 Q2）。
  if (canUseKyouryuumaru(state, playerId, unit.instanceId)) {
    actions.push({ type: "use_juu_kun_do", playerId, attackerInstanceId: unit.instanceId });
  }
  if (cannotAttackOrStrikeThisTurn(player, unit, state, playerId)) {
    actions.push({ type: "pass_battle_entry", playerId });
    return;
  }
  // 「※これはアタックすることができない」— 禁止されるのはアタックだけで、ストライクはできる（RS-508 ゴーオンレッド。
  // atwiki/page-740 カード評価「ストライクも同時にすることが可能」）。
  const cannotAttack = unitCannotInitiateAttack(unit.cardId);

  const requiredDefenderId = pending.requiredDefenderInstanceId;
  // ルール: R-REPL-03 — 「アタックするかわりに」効果を発動したユニットはアタックできない。
  const attackBlocked = cannotAttack || battleActBlocked(player, unit, "attack");
  const battleDefenders = attackBlocked
    ? []
    : requiredDefenderId
      ? enemy.battle.filter((c) => c.instanceId === requiredDefenderId)
      : enemy.battle;
  const rushDefenders = requiredDefenderId || attackBlocked ? [] : enemy.rush;

  for (const defender of battleDefenders) {
    if (
      !canAttackDefender(
        state,
        playerId,
        pending.instanceId,
        opponent(playerId),
        defender.instanceId,
        canAttackRushWithYellowThunder,
      )
    ) {
      continue;
    }
    actions.push({
      type: "battle",
      playerId,
      attackerInstanceId: pending.instanceId,
      defenderInstanceId: defender.instanceId,
    });
  }
  for (const defender of rushDefenders) {
    if (
      !canAttackDefender(
        state,
        playerId,
        pending.instanceId,
        opponent(playerId),
        defender.instanceId,
        canAttackRushWithYellowThunder,
      )
    ) {
      continue;
    }
    actions.push({
      type: "battle",
      playerId,
      attackerInstanceId: pending.instanceId,
      defenderInstanceId: defender.instanceId,
    });
  }
  // ルール: R-ATK-05 — ゴーマ宮で「可能ならアタックする」ユニットはアタックしなければならない。
  const forcedAttack = gomaPalaceForcesAttack(state, playerId, pending.instanceId);
  if (forcedAttack) return;
  if (
    canStrikeUnit(state.definitions, unit, state, playerId) &&
    !requiredDefenderId &&
    !battleActBlocked(player, unit, "strike")
  ) {
    actions.push({ type: "strike", playerId, instanceId: pending.instanceId });
  }
  if (
    (canUseJuuKunDo(state, playerId, pending.instanceId) ||
      canUseLionDance(state, playerId, pending.instanceId)) &&
    !canUseKyouryuumaru(state, playerId, pending.instanceId) &&
    !requiredDefenderId &&
    !cannotAttack
  ) {
    actions.push({
      type: "use_juu_kun_do",
      playerId,
      attackerInstanceId: pending.instanceId,
    });
  }
  // 「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒…」（NC。rules/holdToActivate.ts）は
  // 出た直後の行動ウィンドウで起動できる。
  if (
    isHoldToActivateNc(unit.cardId) &&
    listFieldActivatedAbilityCards(state, playerId).includes(pending.instanceId)
  ) {
    actions.push({ type: "activate_field_unit_ability", playerId, unitInstanceId: pending.instanceId });
  }
  if (!requiredDefenderId || actions.every((a) => a.type !== "battle")) {
    actions.push({ type: "pass_battle_entry", playerId });
  }
}

function appendDamagePaymentActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingDamagePayment;
  if (!pending || damagePaymentChoosingPlayer(pending) !== playerId) return;
  for (const instanceId of getDamagePaymentChoices(state, pending)) {
    actions.push({ type: "resolve_damage_payment", playerId, instanceId });
  }
}

/** 現在アクションを取るべきプレイヤー（pending 優先）。 */
export function getActionPlayerId(state: GameState): PlayerId {
  return (
    state.pendingCommandPayment?.playerId ??
    (state.pendingDamagePayment
      ? damagePaymentChoosingPlayer(state.pendingDamagePayment)
      : undefined) ??
    getReactionChooserPlayerId(state) ??
    state.pendingEffectChoice?.playerId ??
    (state.pendingMorph
      ? getMorphReactionActorId(state, state.pendingMorph)
      : undefined) ??
    state.pendingChase?.chaserPlayerId ??
    state.pendingRideOffChoice?.playerId ??
    state.pendingBattleEntry?.playerId ??
    state.pendingZordSetup?.playerId ??
    state.pendingScry?.playerId ??
    state.activePlayer
  );
}

export function getLegalActions(input: GameState): GameAction[] {
  if (input.winner) return [];
  // 「※このカードの追加条件は、…のとき、次のように変更される」を反映した定義で判定する（RS-440 等）。
  const state = withEffectiveRushConditionDefinitions(input);
  // 追加条件の素材の特徴（効果・フェイズで追加された特徴）はこの状態で判定する（rules/zordFeatureContext.ts）。
  // 合法判定の中で乱数を使っても、状態の rngState から作るので決定的（core/rng.ts）。
  return runWithStateRng(input, () => withZordFeatureContext(state, () => getLegalActionsCore(state))).value;
}

function getLegalActionsCore(state: GameState): GameAction[] {

  const playerId = getActionPlayerId(state);
  const player = state.players[playerId];
  const actions: GameAction[] = [];

  if (state.pendingRegister) {
    const owner = state.pendingRegister.ownerPlayerId;
    actions.push({ type: "use_register", playerId: owner });
    actions.push({ type: "pass_register", playerId: owner });
    return actions;
  }

  if (state.pendingChase) {
    const pending = state.pendingChase;
    for (const vehicleId of listValidChaseVehicleIds(state, pending)) {
      actions.push({
        type: "resolve_chase",
        playerId: pending.chaserPlayerId,
        newVehicleInstanceId: vehicleId,
      });
    }
    actions.push({ type: "pass_chase", playerId: pending.chaserPlayerId });
    return actions;
  }

  // 進入効果のダメージ支払いが先に積まれていれば、ライドオフ選択より先に解決する
  // （applyAction の pending_damage_payment ガードと同じ優先順）。
  if (
    state.pendingRideOffChoice &&
    state.pendingDamagePayment &&
    peekEffectStackTop(state)?.kind === "damage_payment"
  ) {
    appendDamagePaymentActions(state, playerId, actions);
    return actions;
  }

  if (state.pendingRideOffChoice) {
    const pending = state.pendingRideOffChoice;
    if (lionArmorAvailable(state, pending.playerId)) {
      actions.push({ type: "activate_field_unit_ability", playerId: pending.playerId, unitInstanceId: pending.vehicleInstanceId });
    }
    actions.push({
      type: "resolve_ride_off_choice",
      playerId: pending.playerId,
      rideOff: true,
    });
    actions.push({
      type: "resolve_ride_off_choice",
      playerId: pending.playerId,
      rideOff: false,
    });
    return actions;
  }

  if (state.pendingEffectChoice?.kind === "simultaneous_order") {
    const chooserId = state.pendingEffectChoice.playerId;
    appendEffectChoiceActions(state, chooserId, actions);
    if (actions.length === 0 && state.pendingEffectChoice.optional) {
      actions.push({ type: "skip_effect_choice", playerId: chooserId });
    }
    return actions;
  }

  if (state.pendingCommandPayment) {
    const pending = state.pendingCommandPayment;
    if (pending.playerId === playerId) {
      let ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
      // RS-429 代用の effect_hold: 少ない枚数（minNeeded）でも確定できる。先頭のコマンドだけで足りればそれを出す。
      if (pending.minNeeded !== undefined) {
        const fewer = pending.validInstanceIds.slice(0, pending.minNeeded);
        if (validatePaymentSelection(state, pending, fewer) === null) ids = fewer;
      }
      if (
        ids.length >= (pending.minNeeded ?? pending.totalNeeded) &&
        validatePaymentSelection(state, pending, ids) === null &&
        isResolveCommandPaymentLegal(state, {
          playerId,
          commandInstanceIds: ids,
        })
      ) {
        actions.push({
          type: "resolve_command_payment",
          playerId,
          commandInstanceIds: ids,
        });
      }
      actions.push({ type: "cancel_command_payment", playerId });
    }
    return actions;
  }

  // Damage payment takes absolute priority over pending reaction windows.
  // When pendingDamagePayment is active alongside pendingLeave/Strike/etc.,
  // the damage must be resolved before any reactions can proceed.
  if (state.pendingDamagePayment) {
    appendDamagePaymentActions(state, playerId, actions);
    return actions;
  }

  // When pendingLeave and another simultaneous reaction frame are both open (without
  // damage payment), consult the effect stack (which respects reactionResolutionOrder)
  // to determine which frame to act on first.
  if (
    state.pendingLeave &&
    (state.pendingStrike || state.pendingBattle || state.pendingRush)
  ) {
    const topFrameId = peekEffectStackTop(state)?.id;
    if (topFrameId === "pendingStrike" && state.pendingStrike) {
      appendStrikeReactionActions(state, opponent(state.pendingStrike.strikerPlayerId), actions);
      return actions;
    }
    if (topFrameId === "pendingBattle" && state.pendingBattle) {
      appendBattleReactionActions(state, state.pendingBattle.defenderPlayerId, actions);
      return actions;
    }
    if (topFrameId === "pendingRush" && state.pendingRush) {
      appendRushReactionActions(state, rushReactorId(state.pendingRush), actions);
      return actions;
    }
    // topFrameId === "pendingLeave" or no order set — fall through to pendingLeave below
  }

  if (state.pendingLeave) {
    appendLeaveReactionActions(state, state.pendingLeave.ownerPlayerId, actions);
    return actions;
  }

  if (state.pendingGiantBomb && !state.pendingZordSetup) {
    // RS-255 巨大化爆弾: 使う（カテゴリのホールド→使用）か見送る。
    const ownerId = state.pendingGiantBomb.ownerId;
    for (const counterId of giantBombCounterIds(state, ownerId)) {
      appendCounterCategoryPaymentActions(state, ownerId, counterId, actions);
      if (canExecuteHandCounter(state, ownerId, counterId)) {
        actions.push({ type: "play_counter", playerId: ownerId, instanceId: counterId });
      }
    }
    actions.push({ type: "pass_leave_reaction", playerId: ownerId });
    return actions;
  }

  if (state.pendingZordSetup) {
    if (state.pendingZordSetup.playerId === playerId) {
      actions.push(
        ...listZordSetupResolveActions(state, state.pendingZordSetup),
      );
      actions.push({ type: "cancel_zord_setup", playerId });
    }
    return actions;
  }

  if (state.pendingStrike) {
    appendStrikeReactionActions(
      state,
      opponent(state.pendingStrike.strikerPlayerId),
      actions,
    );
    return actions;
  }

  if (state.pendingBattle) {
    appendBattleReactionActions(state, state.pendingBattle.defenderPlayerId, actions);
    return actions;
  }

  if (state.pendingMorph) {
    const pending = state.pendingMorph;
    const actor = getMorphReactionActorId(state, pending);
    appendMorphReactionActions(state, actor, actions);
    if (
      actor !== pending.defenderPlayerId &&
      !actions.some((a) => a.type === "pass_morph_reaction")
    ) {
      actions.push({ type: "pass_morph_reaction", playerId: pending.defenderPlayerId });
    }
    return actions;
  }

  if (state.pendingRush) {
    appendRushReactionActions(
      state,
      rushReactorId(state.pendingRush),
      actions,
    );
    return actions;
  }

  if (state.pendingEffectChoice) {
    const chooserId = state.pendingEffectChoice.playerId;
    appendEffectChoiceActions(state, chooserId, actions);
    if (actions.length === 0 && state.pendingEffectChoice.optional) {
      actions.push({ type: "skip_effect_choice", playerId: chooserId });
    }
    return actions;
  }

  if (state.pendingScry) {
    if (playerId === state.pendingScry.playerId) {
      actions.push({
        type: "resolve_ruin_survey",
        playerId,
        placement: "top",
      });
      actions.push({
        type: "resolve_ruin_survey",
        playerId,
        placement: "bottom",
      });
    }
    return actions;
  }

  if (state.pendingBattleEntry) {
    appendBattleEntryActions(state, playerId, actions);
    return actions;
  }

  switch (state.phase) {
    case "start":
      if (canReleaseStartCommands(state, playerId)) {
        actions.push({ type: "release_start_commands", playerId });
      }
      if (canReturnBattleAtStart(state, playerId)) {
        actions.push({ type: "return_all_battle_to_rush", playerId });
        // ルール: R-START-01 — 戻す順は任意。2組以上あれば1体ずつ選んで戻せる。
        const groups = listReturnableStartGroupIds(state, playerId);
        if (groups.length >= 2) {
          for (const instanceId of groups) {
            actions.push({ type: "return_all_battle_to_rush", playerId, instanceId });
          }
        }
      }
      if (!player.hasDrawnThisStart) {
        actions.push({ type: "draw", playerId });
      }
      // RS-271【修復作業】等、自軍スタートフェイズ中に起動できる場のユニットの効果。
      for (const unitInstanceId of listFieldActivatedAbilityCards(state, playerId)) {
        actions.push({ type: "activate_field_unit_ability", playerId, unitInstanceId });
      }
      if (canBonusDraw(state, playerId)) {
        actions.push({ type: "bonus_draw", playerId });
        const releaseOk = isReleaseStepComplete(player);
        const returnOk = player.hasReturnedBattleThisStart === true || player.battle.length === 0;
        if (releaseOk && returnOk) {
          actions.push({ type: "skip_bonus_draw", playerId });
        }
      }
      break;

    case "charge":
      if (!player.hasChargedThisTurn) {
        for (const card of player.hand) {
          actions.push({
            type: "charge_power",
            playerId,
            instanceId: card.instanceId,
          });
          if (player.command.length < COMMAND_ZONE_MAX) {
            actions.push({
              type: "charge_command",
              playerId,
              instanceId: card.instanceId,
            });
          }
        }
      }
      actions.push({ type: "end_phase", playerId });
      break;

    case "rush":
      for (const card of player.hand) {
        const definition = getDefinition(state.definitions, card.cardId);
        if (!isRushable(definition)) continue;

        if (
          isUnit(definition) &&
          needsZordDownPayment(card.cardId, definition!.powerCost, definition!)
        ) {
          for (const variant of listZordDownRushPaymentVariants(
            player,
            state.definitions,
            card.cardId,
            card.instanceId,
          )) {
            if (
              !canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId, variant)
            ) {
              continue;
            }
            actions.push({
              type: "rush",
              playerId,
              instanceId: card.instanceId,
              zordMaterialInstanceId: variant.zordMaterialInstanceId,
              zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
              zordMaterialDestination: variant.zordMaterialDestination,
            });
          }
          if (canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId)) {
            actions.push({
              type: "rush",
              playerId,
              instanceId: card.instanceId,
            });
          }
        } else if (
          isUnit(definition) &&
          isZordUpCost(definition!.powerCost) &&
          (rushAdditionalConditionApplies(state, playerId, card.cardId) ||
            requiresAllFusionPartners(card.cardId))
        ) {
          for (const variant of listZordUpRushPaymentVariants(
            state,
            playerId,
            card.cardId,
            card.instanceId,
          )) {
            if (
              !canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId, variant)
            ) {
              continue;
            }
            actions.push({
              type: "rush",
              playerId,
              instanceId: card.instanceId,
              zordMaterialInstanceId: variant.zordMaterialInstanceId,
              zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
              zordMaterialDestination: variant.zordMaterialDestination,
              zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
              zordExtraCommandHoldInstanceIds: variant.zordExtraCommandHoldInstanceIds,
            });
          }
        } else if (canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId)) {
          actions.push({
            type: "rush",
            playerId,
            instanceId: card.instanceId,
          });
        }
      }
      appendRushCategoryPaymentActions(state, playerId, actions);
      appendZordSetupActions(state, playerId, actions);
      // RS-359【最後の手段】: 山札の候補を加えればラッシュを始められるユニット（rules/legend1/icyLastResort.ts）。
      appendIcyRushActions(state, playerId, actions, (virtual) => {
        const viaIcy: GameAction[] = [];
        appendRushCategoryPaymentActions(virtual, playerId, viaIcy);
        appendZordSetupActions(virtual, playerId, viaIcy);
        return viaIcy;
      });
      appendOperationActions(state, playerId, actions);
      appendMagiTicketActions(state, playerId, actions);
      appendOperationCategoryPaymentActions(state, playerId, actions);
      appendHidoraEggActions(state, playerId, actions);
      appendShironLightActions(state, playerId, actions);
      appendActivateResidentOperationActions(state, playerId, actions);
      appendActivateFieldUnitAbilityActions(state, playerId, actions);
      expandGodomRushVariants(state, playerId, actions);
      actions.push({ type: "end_phase", playerId });
      break;

    case "battle": {
      // RK-012 宏のオルゴール時計 — バトルフェイズ中に使われたら、そのバトルフェイズを終了する
      // （grnrngr/faq-rider-1 RK-012「敵軍バトルフェイズ中であっても発動し、そのバトルフェイズを終了させることができますか？」「はい、できます」）。
      if (battlePhaseSkippedThisTurn(state, playerId)) {
        actions.push({ type: "end_phase", playerId });
        break;
      }
      const enemy = state.players[opponent(playerId)];
      // RS-524 呉越同舟（自軍バトルフェイズ中に1度だけ。rules/legend1/set8NamedEffectsA.ts）。
      appendActivateResidentOperationActions(state, playerId, actions);

      for (const card of player.rush) {
        if (!canMoveUnitToBattle(state, playerId, card, "rush")) continue;
        actions.push({
          type: "move_to_battle",
          playerId,
          instanceId: card.instanceId,
        });
      }

      // ルール: R-BA-04 — 「可能なら出る」ユニットがホールドすれば出られるなら、出さなければならない。
      // その進入（battle_entry 支払いの開始）を合法手に含める（バトルフェイズを終えられないため）。
      // ルール: R-ADD-07 — 「自軍コマンドを1つホールドしなければバトルエリアに出られない」ユニット（RS-052・RS-305・RS-316 等）は、
      // 任意の進入でもホールドして出る行動を合法手に含める（出ないこともできる）。
      // 「可能なら出る」ユニット（findMandatoryBattleEntries）もこの中に含まれる。
      for (const card of player.rush) {
        if (canMoveUnitToBattle(state, playerId, card, "rush")) continue;
        if (!getBattleEntryPaymentNeeds(state, playerId, card)) continue;
        actions.push({
          type: "initiate_command_payment",
          playerId,
          kind: "battle_entry",
          sourceInstanceId: card.instanceId,
        });
      }

      for (const rider of player.rush) {
        const riderDef = getDefinition(state.definitions, rider.cardId);
        if (!riderDef || !isUnit(riderDef)) continue;
        for (const vehicle of player.rush) {
          if (vehicle.instanceId === rider.instanceId) continue;
          const vehicleDef = getDefinition(state.definitions, vehicle.cardId);
          if (vehicleDef?.type !== "vehicle") continue;
          if (
            canMountRideIntoBattle(
              state,
              playerId,
              rider.instanceId,
              vehicle.instanceId,
            )
          ) {
            actions.push({
              type: "mount_ride",
              playerId,
              riderInstanceId: rider.instanceId,
              vehicleInstanceId: vehicle.instanceId,
            });
          }
        }
      }

      for (const card of player.rush) {
        if (canHoldForWing(state, playerId, card)) {
          actions.push({
            type: "hold_for_wing",
            playerId,
            instanceId: card.instanceId,
          });
        }
        if (canCancelWingHold(state, playerId, card.instanceId)) {
          actions.push({
            type: "cancel_wing_hold",
            playerId,
            instanceId: card.instanceId,
          });
        }
      }

      for (const attacker of player.rush) {
        if (!canWingAttackFromRush(state, playerId, attacker)) continue;
        if (unitCannotInitiateAttack(attacker.cardId)) continue;
        for (const defender of enemy.battle) {
          if (
            !canAttackDefender(
              state,
              playerId,
              attacker.instanceId,
              opponent(playerId),
              defender.instanceId,
              canAttackRushWithYellowThunder,
            )
          ) {
            continue;
          }
          actions.push({
            type: "battle",
            playerId,
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: defender.instanceId,
          });
        }
        for (const defender of enemy.rush) {
          if (
            !canAttackDefender(
              state,
              playerId,
              attacker.instanceId,
              opponent(playerId),
              defender.instanceId,
              canAttackRushWithYellowThunder,
            )
          ) {
            continue;
          }
          actions.push({
            type: "battle",
            playerId,
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: defender.instanceId,
          });
        }
      }

      // XG3-034【キョウリュウマル】で得た「アタックするかわりに」（ルナジェル等の制限下でも発動できる。atwiki/page-1907 Q2）。
      for (const unit of player.battle) {
        if (canUseKyouryuumaru(state, playerId, unit.instanceId)) {
          actions.push({ type: "use_juu_kun_do", playerId, attackerInstanceId: unit.instanceId });
        }
      }
      for (const attacker of player.battle) {
        if (battleActBlocked(player, attacker, "attack")) continue;
        if (cannotAttackOrStrikeThisTurn(player, attacker, state, playerId)) continue;
        if (unitCannotInitiateAttack(attacker.cardId)) continue;
        for (const defender of enemy.battle) {
          if (
            !canAttackDefender(
              state,
              playerId,
              attacker.instanceId,
              opponent(playerId),
              defender.instanceId,
              canAttackRushWithYellowThunder,
            )
          ) {
            continue;
          }
          actions.push({
            type: "battle",
            playerId,
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: defender.instanceId,
          });
        }
        for (const defender of enemy.rush) {
          if (
            !canAttackDefender(
              state,
              playerId,
              attacker.instanceId,
              opponent(playerId),
              defender.instanceId,
              canAttackRushWithYellowThunder,
            )
          ) {
            continue;
          }
        actions.push({
          type: "battle",
          playerId,
          attackerInstanceId: attacker.instanceId,
          defenderInstanceId: defender.instanceId,
        });
        }
        if (
          (canUseJuuKunDo(state, playerId, attacker.instanceId) ||
            canUseLionDance(state, playerId, attacker.instanceId)) &&
          !canUseKyouryuumaru(state, playerId, attacker.instanceId)
        ) {
          // 「アタックするかわりに」の効果（ジュウクンドー・超忍法・舞獅子）。ルール: R-ATK-05
          actions.push({
            type: "use_juu_kun_do",
            playerId,
            attackerInstanceId: attacker.instanceId,
          });
        }
      }

      for (const card of player.battle) {
        if (battleActBlocked(player, card, "strike")) continue;
        if (cannotAttackOrStrikeThisTurn(player, card, state, playerId)) continue;
        if (!canStrikeUnit(state.definitions, card, state, playerId)) continue;
        actions.push({
          type: "strike",
          playerId,
          instanceId: card.instanceId,
        });
      }

      // RS-042【ジャスティスフラッシャー】等、自軍バトルフェイズ中に起動できる場のユニットの効果。
      for (const unitInstanceId of listFieldActivatedAbilityCards(state, playerId)) {
        actions.push({ type: "activate_field_unit_ability", playerId, unitInstanceId });
      }
      appendBattleDanceActions(state, playerId, actions);
      if (!mustEnterBattleBeforePhaseEnd(state, playerId)) {
        actions.push({ type: "end_phase", playerId });
      }
      break;
    }

    case "end":
      actions.push({ type: "end_phase", playerId });
      break;
  }

  return actions;
}

export function isLegalAction(state: GameState, action: GameAction): boolean {
  if (isLegalActionBase(state, action)) return true;
  // RS-359【最後の手段】: 山札の候補を加えればラッシュを始められる（rules/legend1/icyLastResort.ts）。
  return icyStateForAction(state, action, isLegalActionBase) !== null;
}

/** 【最後の手段】を考えない合法判定。 */
export function isLegalActionBase(state: GameState, action: GameAction): boolean {
  if (state.winner) return false;

  if (action.type === "initiate_command_payment") {
    const reactionActor = getReactionChooserPlayerId(state);
    if (reactionActor && isCounterPaymentAction(state, action)) {
      if (action.playerId !== reactionActor) return false;
      return isInitiateCommandPaymentLegal(state, action);
    }
    if (!assertActive(state, action.playerId)) return false;
    return isInitiateCommandPaymentLegal(state, action);
  }

  if (action.type === "resolve_command_payment") {
    return isResolveCommandPaymentLegal(state, action);
  }

  if (action.type === "cancel_command_payment") {
    return state.pendingCommandPayment?.playerId === action.playerId;
  }

  if (state.pendingCommandPayment) {
    return false;
  }

  if (action.type === "begin_zord_setup") {
    if (!assertActive(state, action.playerId)) return false;
    return canBeginZordSetup(state, action.playerId, action.zordInstanceId);
  }

  if (action.type === "resolve_zord_setup") {
    const setup = state.pendingZordSetup;
    if (!setup || setup.playerId !== action.playerId) return false;
    return listZordSetupResolveActions(state, setup).some(
      (candidate) =>
        candidate.destination === action.destination &&
        candidate.materialInstanceId === action.materialInstanceId &&
        candidate.paymentPath === action.paymentPath,
    );
  }

  if (action.type === "cancel_zord_setup") {
    return state.pendingZordSetup?.playerId === action.playerId;
  }

  if (state.pendingZordSetup) {
    return false;
  }

  if (action.type === "end_phase" && state.phase === "start") {
    return false;
  }

  if (state.pendingRegister) {
    if (action.type === "use_register" || action.type === "pass_register") {
      return action.playerId === state.pendingRegister.ownerPlayerId;
    }
    return false;
  }

  if (action.type === "resolve_damage_payment") {
    const pending = state.pendingDamagePayment;
    return (
      !!pending &&
      damagePaymentChoosingPlayer(pending) === action.playerId &&
      getDamagePaymentChoices(state, pending).includes(action.instanceId)
    );
  }

  if (state.pendingDamagePayment) {
    return false;
  }

  if (state.pendingChase) {
    if (action.type === "pass_chase") {
      return action.playerId === state.pendingChase.chaserPlayerId;
    }
    if (action.type === "resolve_chase") {
      return (
        action.playerId === state.pendingChase.chaserPlayerId &&
        listValidChaseVehicleIds(state, state.pendingChase).includes(action.newVehicleInstanceId)
      );
    }
    return false;
  }

  if (state.pendingRideOffChoice) {
    // RS-381【獅子の装光】: ライドオフさせるかわりに発動する。
    if (
      action.type === "activate_field_unit_ability" &&
      action.playerId === state.pendingRideOffChoice.playerId &&
      action.unitInstanceId === state.pendingRideOffChoice.vehicleInstanceId &&
      lionArmorAvailable(state, action.playerId)
    ) {
      return true;
    }
    return (
      action.type === "resolve_ride_off_choice" &&
      action.playerId === state.pendingRideOffChoice.playerId
    );
  }

  if (state.pendingMorph) {
    if (action.type === "pass_morph_reaction") {
      return action.playerId === state.pendingMorph.defenderPlayerId;
    }
    if (action.type === "select_morph_unit") {
      const actor = getMorphReactionActorId(state, state.pendingMorph);
      return (
        action.playerId === actor &&
        state.pendingMorph.morphUnitInstanceIds.includes(action.morphUnitInstanceId)
      );
    }
  }

  const reactionActor = getReactionChooserPlayerId(state);
  if (reactionActor && isReactionWindowAction(action)) {
    if (action.playerId !== reactionActor) return false;
  } else if (state.pendingEffectChoice?.kind === "simultaneous_order") {
    // 同時に開いた反応窓（離場・ストライク等）の処理順はターンプレイヤーが選ぶ（R-SIM-01）。
    // 離場の持ち主より先にこの選択を受け付ける。
    if (action.playerId !== state.pendingEffectChoice.playerId) return false;
  } else if (state.pendingLeave) {
    if (action.playerId !== state.pendingLeave.ownerPlayerId) return false;
  } else if (state.pendingEffectChoice) {
    if (action.playerId !== state.pendingEffectChoice.playerId) return false;
  } else if (state.pendingBattleEntry) {
    if (action.playerId !== state.pendingBattleEntry.playerId) return false;
  } else if (state.pendingScry) {
    if (action.playerId !== state.pendingScry.playerId) return false;
  } else if (!assertActive(state, action.playerId)) {
    return false;
  }

  if (action.type === "rush" && state.phase === "rush") {
    if (!assertActive(state, action.playerId)) return false;
    const player = state.players[action.playerId];
    const handCard = player.hand.find((c) => c.instanceId === action.instanceId);
    if (handCard) {
      const definition = getDefinition(state.definitions, handCard.cardId);
      if (
        definition &&
        isRushable(definition) &&
        canDeclareRush(state, action.playerId, player, state.definitions, definition, action.instanceId, {
          zordMaterialInstanceId: action.zordMaterialInstanceId,
          zordMaterialInstanceIds: action.zordMaterialInstanceIds,
          zordMothershipHoldInstanceIds: action.zordMothershipHoldInstanceIds,
          zordExtraCommandHoldInstanceIds: action.zordExtraCommandHoldInstanceIds,
          zordMaterialDestination: action.zordMaterialDestination,
        })
      ) {
        return true;
      }
    }
  }

  if (action.type === "move_to_battle" && state.phase === "rush") {
    if (!assertActive(state, action.playerId)) return false;
    const rushCard = state.players[action.playerId].rush.find(
      (c) => c.instanceId === action.instanceId,
    );
    if (
      rushCard &&
      hasAutoBattleEntryOnRushNote(rushCard.cardId) &&
      canMoveUnitToBattle(state, action.playerId, rushCard, "rush")
    ) {
      return true;
    }
  }

  return getLegalActions(state).some((candidate) => actionsEqual(candidate, action));
}

/** RS-586【魔神に不足する物】の選び方の比較用（省略・使わない・選んだユニットを区別する）。 */
function godomKey(ids: string[] | undefined): string {
  return ids === undefined ? "auto" : [...ids].sort().join(",");
}

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type || a.playerId !== b.playerId) return false;

  if (a.type === "battle" && b.type === "battle") {
    return (
      a.attackerInstanceId === b.attackerInstanceId &&
      a.defenderInstanceId === b.defenderInstanceId
    );
  }

  if (a.type === "rush" && b.type === "rush") {
    const holdsA = [...(a.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    const holdsB = [...(b.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    const extraA = [...(a.zordExtraCommandHoldInstanceIds ?? [])].sort().join(",");
    const extraB = [...(b.zordExtraCommandHoldInstanceIds ?? [])].sort().join(",");
    const matsA = [...(a.zordMaterialInstanceIds ?? [])].sort().join(",");
    const matsB = [...(b.zordMaterialInstanceIds ?? [])].sort().join(",");
    return (
      a.instanceId === b.instanceId &&
      (a.zordMaterialInstanceId ?? "") === (b.zordMaterialInstanceId ?? "") &&
      matsA === matsB &&
      (a.zordMaterialDestination ?? "") === (b.zordMaterialDestination ?? "") &&
      holdsA === holdsB &&
      extraA === extraB &&
      godomKey(a.godomDiscardInstanceIds) === godomKey(b.godomDiscardInstanceIds)
    );
  }

  if (a.type === "resolve_chase" && b.type === "resolve_chase") {
    return a.newVehicleInstanceId === b.newVehicleInstanceId;
  }

  if (a.type === "mount_ride" && b.type === "mount_ride") {
    return (
      a.riderInstanceId === b.riderInstanceId &&
      a.vehicleInstanceId === b.vehicleInstanceId
    );
  }

  if (a.type === "resolve_ride_off_choice" && b.type === "resolve_ride_off_choice") {
    return a.rideOff === b.rideOff;
  }

  if (a.type === "play_operation" && b.type === "play_operation") {
    return (
      a.instanceId === b.instanceId &&
      (a.targetInstanceId ?? "") === (b.targetInstanceId ?? "") &&
      (a.extraInstanceId ?? "") === (b.extraInstanceId ?? "")
    );
  }

  if (a.type === "play_counter" && b.type === "play_counter") {
    return (
      a.instanceId === b.instanceId &&
      (a.substituteInstanceId ?? "") === (b.substituteInstanceId ?? "")
    );
  }

  if (a.type === "five_tech_intercept" && b.type === "five_tech_intercept") {
    return a.interceptInstanceId === b.interceptInstanceId;
  }

  if (a.type === "battle_dance_retreat" && b.type === "battle_dance_retreat") {
    const aCmd = [...a.commandInstanceIds].sort().join("\0");
    const bCmd = [...b.commandInstanceIds].sort().join("\0");
    return a.battleInstanceId === b.battleInstanceId && aCmd === bCmd;
  }

  if (a.type === "return_all_battle_to_rush" && b.type === "return_all_battle_to_rush") {
    return a.playerId === b.playerId && a.instanceId === b.instanceId;
  }

  if (a.type === "shiron_light" && b.type === "shiron_light") {
    return (
      a.playerId === b.playerId &&
      a.operationInstanceId === b.operationInstanceId
    );
  }
  if (a.type === "activate_resident_operation" && b.type === "activate_resident_operation") {
    return (
      a.playerId === b.playerId &&
      a.operationInstanceId === b.operationInstanceId
    );
  }
  if (a.type === "confirm_shiron_reveal" && b.type === "confirm_shiron_reveal") {
    return a.playerId === b.playerId;
  }

  if (a.type === "resolve_ruin_survey" && b.type === "resolve_ruin_survey") {
    return a.placement === b.placement;
  }

  if (a.type === "resolve_seabed_draw" && b.type === "resolve_seabed_draw") {
    return a.placement === b.placement;
  }

  if (a.type === "confirm_denji_reveal" && b.type === "confirm_denji_reveal") {
    return true;
  }

  if (a.type === "confirm_effect_choice" && b.type === "confirm_effect_choice") {
    return a.playerId === b.playerId;
  }

  if (a.type === "select_morph_unit" && b.type === "select_morph_unit") {
    return a.morphUnitInstanceId === b.morphUnitInstanceId;
  }

  if (a.type === "resolve_effect_choice" && b.type === "resolve_effect_choice") {
    return a.instanceId === b.instanceId;
  }

  if (a.type === "resolve_command_payment" && b.type === "resolve_command_payment") {
    const idsA = [...a.commandInstanceIds].sort().join(",");
    const idsB = [...b.commandInstanceIds].sort().join(",");
    return idsA === idsB;
  }

  if (a.type === "initiate_command_payment" && b.type === "initiate_command_payment") {
    const holdsA = [...(a.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    const holdsB = [...(b.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    return (
      a.kind === b.kind &&
      a.sourceInstanceId === b.sourceInstanceId &&
      (a.prismSubstitute ?? false) === (b.prismSubstitute ?? false) &&
      (a.rideOff ?? false) === (b.rideOff ?? false) &&
      (a.zordMaterialInstanceId ?? "") === (b.zordMaterialInstanceId ?? "") &&
      (a.zordMaterialDestination ?? "") === (b.zordMaterialDestination ?? "") &&
      holdsA === holdsB &&
      (a.targetInstanceId ?? "") === (b.targetInstanceId ?? "") &&
      (a.extraInstanceId ?? "") === (b.extraInstanceId ?? "") &&
      (a.substituteInstanceId ?? "") === (b.substituteInstanceId ?? "") &&
      godomKey(a.godomDiscardInstanceIds) === godomKey(b.godomDiscardInstanceIds)
    );
  }

  if (a.type === "begin_zord_setup" && b.type === "begin_zord_setup") {
    return a.zordInstanceId === b.zordInstanceId && godomKey(a.godomDiscardInstanceIds) === godomKey(b.godomDiscardInstanceIds);
  }

  if (a.type === "skip_effect_choice" && b.type === "skip_effect_choice") {
    return true;
  }

  if (a.type === "pass_battle_entry" && b.type === "pass_battle_entry") {
    return true;
  }

  if (a.type === "move_to_battle" && b.type === "move_to_battle") {
    return (
      a.instanceId === b.instanceId &&
      (a.rideOff ?? false) === (b.rideOff ?? false) &&
      (a.vehicleInstanceId ?? "") === (b.vehicleInstanceId ?? "")
    );
  }

  const aHasInstance = "instanceId" in a;
  const bHasInstance = "instanceId" in b;
  if (aHasInstance !== bHasInstance) return false;
  if (aHasInstance && bHasInstance) {
    return a.instanceId === b.instanceId;
  }
  return true;
}

export function canPlayOperationsInPhase(phase: GameState["phase"]): boolean {
  return OPERATION_PHASES.has(phase);
}

export function getStrikeableInstanceIds(state: GameState, playerId: PlayerId): string[] {
  if (state.phase !== "battle" || state.pendingStrike) return [];
  if (state.activePlayer !== playerId) return [];

  return getLegalActions(state)
    .filter((a): a is Extract<typeof a, { type: "strike" }> => a.type === "strike")
    .map((a) => a.instanceId);
}

/**
 * 手札からのラッシュの宣言（initiate_command_payment / rush）で、追加条件「追加で自軍コマンドをNつホールドする」の
 * コマンド（zordExtraCommandHoldInstanceIds）が省かれていて、合法な組が1通りだけならそれを補う。
 */
export function withUniqueExtraCommandHolds(state: GameState, action: GameAction): GameAction {
  if (action.type !== "initiate_command_payment" && action.type !== "rush") return action;
  if (action.type === "initiate_command_payment" && action.kind !== "category_use") return action;
  if (action.zordExtraCommandHoldInstanceIds?.length) return action;
  const source = action.type === "rush" ? action.instanceId : action.sourceInstanceId;
  const handCard = state.players[action.playerId]?.hand.find((c) => c.instanceId === source);
  if (!handCard || !needsHoldExtraCommand(state.definitions, handCard.cardId)) return action;
  const sets = new Set<string>();
  let unique: string[] | undefined;
  for (const candidate of getLegalActions(state)) {
    if (candidate.type !== action.type || candidate.playerId !== action.playerId) continue;
    const candidateSource = candidate.type === "rush" ? candidate.instanceId : (candidate as { sourceInstanceId?: string }).sourceInstanceId;
    if (candidateSource !== source) continue;
    const extra = (candidate as { zordExtraCommandHoldInstanceIds?: string[] }).zordExtraCommandHoldInstanceIds;
    if (!extra?.length) return action;
    sets.add([...extra].sort().join(","));
    unique = extra;
  }
  if (sets.size !== 1 || !unique) return action;
  return { ...action, zordExtraCommandHoldInstanceIds: [...unique] } as GameAction;
}
