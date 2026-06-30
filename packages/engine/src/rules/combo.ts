import type { CardDefinition } from "@rangers-strike/cards";
import {
  getEnterBattleEffect,
  getJointLEffect,
  getJointREffect,
  getEnterBattleNamedEffect,
  hasUnnamedRule,
  partnerCategoryMatches,
} from "@rangers-strike/cards";
import { getConditionalNamedEffect } from "@rangers-strike/cards";
import type { CardInstance, EnterBattleResumeFrom, GameState, PendingBattleEntry, PlayerId } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  isUnit,
  isVehicle,
  unitBp,
} from "../core/catalog";
import { opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { applyCourageMagicRelease } from "./strikeReactions";
import { getSComboFinisher, getGenericSComboFinisher } from "./turnModifierBridge";
import { isSOnlyComboLine } from "./turnModifiers";
import {
  canRunEnterBattleConditionalEffect,
  tryStartConditionalChoice,
  tryStartDestroyEnemyChoice,
  resolveSkyMagicSlash,
} from "./namedUnitEffects";
import { resolveLegend2EnterBattle, applyLegend2ConditionalModifiers } from "./legend2/battleEffects";
import {
  isLegend3EnterBattleEffect,
  resolveLegend3EnterBattle,
  shouldRunConditionalOnEnter,
} from "./legend3/battleEffects";
import {
  getLegend3JointLEffect,
  getLegend3JointREffect,
  resolveLegend3JointCombo,
  resolveLegend3JointComboR,
} from "./legend3/jointComboEffects";
import { tryStartOpponentDrawOnEnter } from "./legend2/destroyEffects";
import { tryMereChameleonOnAllyEnterBattle } from "./batch04FieldEffects";
import { countLogicalBattleSlots } from "./battleLine";
import { applyBaseAttackOnEnter } from "./legend3/enterBattleEffects";
import { cannotAttackOrStrikeThisTurn, countHeldCommands } from "./restrictions";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  rideOffBlocksStrike,
  wingTurnBlocksStrike,
} from "../keywords/battleKeywords";
import type { ComboOutcome } from "./comboTypes";
import {
  applyNumberComboEffect,
  numberComboTriggers,
  resolveNamedNcEffectId,
} from "./numberComboEffects";
import { resolveRidingComboOnRideOff } from "./ridingComboEffects";
import { grantSp1OnPlayer } from "./playerPatches";
import { legend3EffectiveSp } from "./legend3/fieldEffects";
import { hasBakiBakiExtraAttackOnly } from "./legend3/destroyEffects";
import { tryStartDslConditionalChoice } from "../dsl/conditionalEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { wingAllowsEmptyBattleStrike } from "../keywords";
import { canStrikeWithHelloMirage } from "./helloMirage";
import { emitUnitEnteredBattleEffects } from "../events/emitUnitEnteredBattle";
import { registerEnterBattleEffectsImpl } from "../events/listeners/unitEnteredBattleListener";

export type { ComboOutcome } from "./comboTypes";

function resolveJointCombos(
  state: GameState,
  playerId: PlayerId,
): ComboOutcome {
  const player = state.players[playerId];
  const logs: string[] = [];
  let nextState = state;
  let nextPlayer = player;

  for (let i = 0; i < player.battle.length; i++) {
    const card = player.battle[i]!;
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition) continue;

    if (definition.comboNumber === "L") {
      const partner = player.battle[i + 1];
      if (!partner) continue;
      const partnerDef = getDefinition(state.definitions, partner.cardId);
      if (!partnerDef || partnerDef.size !== "L") continue;
      if (!partnerCategoryMatches(definition.category, partnerDef.category)) {
        continue;
      }
      const jointEffect = getJointLEffect(card.cardId);
      if (jointEffect === "grant_sp1_to_partner") {
        nextPlayer = grantSp1OnPlayer(nextPlayer, partner.instanceId);
        logs.push(
          buildLogEntry(
            playerId,
            "joint_combo_l",
            card.cardId,
            state.definitions,
            partner.cardId,
          ),
        );
      }
      const legend3L = getLegend3JointLEffect(card.cardId);
      if (legend3L) {
        const result = resolveLegend3JointCombo(
          nextState,
          playerId,
          card.cardId,
          legend3L,
          partner.instanceId,
        );
        nextState = result.state;
        logs.push(...result.logs);
      }
    }

    if (definition.comboNumber === "R") {
      const partner = player.battle[i - 1];
      if (!partner) continue;
      const partnerDef = getDefinition(state.definitions, partner.cardId);
      if (!partnerDef || partnerDef.size !== "L") continue;
      if (!partnerCategoryMatches(definition.category, partnerDef.category)) {
        continue;
      }
      const jointEffect = getJointREffect(card.cardId);
      if (jointEffect === "grant_sp1") {
        nextPlayer = grantSp1OnPlayer(nextPlayer, card.instanceId);
        logs.push(
          buildLogEntry(
            playerId,
            "joint_combo_r",
            card.cardId,
            state.definitions,
            "sp1",
          ),
        );
      }
      const legend3R = getLegend3JointREffect(card.cardId);
      if (legend3R) {
        if (logs.length > 0 || nextPlayer !== player) {
          nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
          nextPlayer = nextState.players[playerId];
        }
        const result = resolveLegend3JointComboR(
          nextState,
          playerId,
          card.cardId,
          legend3R,
          playerId,
        );
        nextState = result.state;
        logs.push(...result.logs);
      }
    }
  }

  if (logs.length > 0) {
    nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
  }

  return { state: nextState, logs };
}

function applySComboFinisher(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
): CardInstance {
  const player = state.players[playerId];
  const finisher = getSComboFinisher(player);
  if (!finisher || !isSOnlyComboLine(state.definitions, player.battle)) {
    return card;
  }

  const definition = getDefinition(state.definitions, card.cardId);
  if (!definition || !isSmallUnit(state.definitions, card.cardId)) return card;

  if (finisher === "goren_storm" && battlePosition === 5) {
    const baseBp = unitBp(definition);
    return {
      ...card,
      bpModifier: 12000 - baseBp,
      spModifier: (card.spModifier ?? 0) + 1,
    };
  }

  if (finisher === "jacker_hurricane" && battlePosition === 4) {
    const baseBp = unitBp(definition);
    return {
      ...card,
      bpModifier: 8000 - baseBp,
      spModifier: (card.spModifier ?? 0) + 1,
    };
  }

  const generic = getGenericSComboFinisher(player);
  if (generic && battlePosition === generic.position && isSmallUnit(state.definitions, card.cardId)) {
    const baseBp = unitBp(definition);
    return {
      ...card,
      bpModifier: generic.bp - baseBp,
      spModifier: (card.spModifier ?? 0) + generic.sp,
    };
  }

  return card;
}

function destroyWeakestEnemy(
  state: GameState,
  playerId: PlayerId,
  maxBp: number,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  let targetIndex = -1;
  let targetBp = -1;

  for (let i = 0; i < enemy.battle.length; i++) {
    const card = enemy.battle[i]!;
    const bp = effectiveBp(state, enemyId, card);
    if (bp <= maxBp && bp > targetBp) {
      targetBp = bp;
      targetIndex = i;
    }
  }

  if (targetIndex < 0) {
    return { state, logs: [] };
  }

  const [destroyed, battle] = removeAt(enemy.battle, targetIndex);
  const nextEnemy = {
    ...enemy,
    battle,
    discard: [...enemy.discard, destroyed],
  };

  const log = buildLogEntry(
    playerId,
    "enter_battle",
    destroyed.cardId,
    state.definitions,
    `destroy:${cardName(state.definitions, destroyed.cardId)}`,
  );

  return {
    state: { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
    logs: [log],
  };
}

function shouldRunEnterStep(
  resumeFrom: EnterBattleResumeFrom | undefined,
  step: EnterBattleResumeFrom,
): boolean {
  if (!resumeFrom) return true;
  const order: EnterBattleResumeFrom[] = ["conditional", "nc", "tail"];
  return order.indexOf(step) >= order.indexOf(resumeFrom);
}

/** Event Listener から呼ばれる進入効果の実装本体。 */
export function resolveEnterBattleEffectsImpl(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
  options?: {
    battleBeforeEnter?: CardInstance[];
    rideOff?: boolean;
    resumeFrom?: EnterBattleResumeFrom;
  },
): ComboOutcome {
  const definition = getDefinition(state.definitions, card.cardId);
  const logs: string[] = [];
  let nextState = state;
  const resumeFrom = options?.resumeFrom;
  const battleBeforeEnter =
    options?.battleBeforeEnter ??
    state.players[playerId].battle.filter((c) => c.instanceId !== card.instanceId);

  let battleCard = card;
  if (!resumeFrom) {
    battleCard = applySComboFinisher(nextState, playerId, card, battlePosition);
    if (battleCard !== card) {
      const player = nextState.players[playerId];
      const battle = [...player.battle];
      const index = battle.findIndex((c) => c.instanceId === card.instanceId);
      if (index >= 0) {
        battle[index] = battleCard;
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, { ...player, battle }),
        };
        logs.push(
          buildLogEntry(
            playerId,
            "s_combo_finisher",
            card.cardId,
            state.definitions,
            String(battlePosition),
          ),
        );
      }
    }
  }

  if (shouldRunEnterStep(resumeFrom, "conditional")) {
    const dslEnter = tryResolveDslTriggeredEffects({
      state: nextState,
      cardId: card.cardId,
      instanceId: card.instanceId,
      playerId,
      phasePlayerId: playerId,
      triggerType: "enter_battle",
      logAction: "enter_battle",
    });
    nextState = dslEnter.state;
    logs.push(...dslEnter.logs);
    if (nextState.pendingEffectChoice) {
      return { state: nextState, logs, enterResumeFrom: "nc" };
    }

    nextState = tryMereChameleonOnAllyEnterBattle(
      nextState,
      playerId,
      battleCard,
      playerId,
    );
    if (nextState.pendingEffectChoice) {
      return { state: nextState, logs, enterResumeFrom: "nc" };
    }

    const enterEffect = getEnterBattleEffect(card.cardId);
    if (!dslEnter.handled && enterEffect === "destroy_enemy_bp4000") {
      const withChoice = tryStartDestroyEnemyChoice(
        nextState,
        playerId,
        card.cardId,
        4000,
        playerId,
      );
      if (withChoice) {
        nextState = withChoice;
        logs.push(
          buildLogEntry(playerId, "enter_battle", card.cardId, state.definitions, "destroy_choice"),
        );
        return { state: nextState, logs, enterResumeFrom: "nc" };
      }
    }
    if (!dslEnter.handled && enterEffect === "sky_magic_slash") {
      const slash = resolveSkyMagicSlash(nextState, playerId, card.cardId);
      nextState = slash.state;
      logs.push(...slash.logs);
    }
    if (
      !dslEnter.handled &&
      (enterEffect === "mane_hurricane" || enterEffect === "ruin_excavation")
    ) {
      const legend2 = resolveLegend2EnterBattle(nextState, playerId, card.cardId, enterEffect);
      nextState = legend2.state;
      logs.push(...legend2.logs);
      if (nextState.pendingEffectChoice) {
        return { state: nextState, logs, enterResumeFrom: "nc" };
      }
    }

    const namedEnter = getEnterBattleNamedEffect(card.cardId);
    if (
      !dslEnter.handled &&
      namedEnter &&
      isLegend3EnterBattleEffect(namedEnter.effectId)
    ) {
      const legend3 = resolveLegend3EnterBattle(
        nextState,
        playerId,
        card.cardId,
        namedEnter.effectId,
      );
      nextState = legend3.state;
      logs.push(...legend3.logs);
      if (nextState.pendingEffectChoice) {
        return { state: nextState, logs, enterResumeFrom: "nc" };
      }
    }

    nextState = tryStartOpponentDrawOnEnter(
      nextState,
      playerId,
      card.cardId,
      playerId,
    );
    if (nextState.pendingEffectChoice) {
      logs.push(
        buildLogEntry(
          playerId,
          "enter_battle",
          card.cardId,
          state.definitions,
          "opponent_may_draw",
        ),
      );
      return { state: nextState, logs, enterResumeFrom: "nc" };
    }

    const dslConditional = tryStartDslConditionalChoice(
      nextState,
      playerId,
      battleCard,
      playerId,
    );
    if (dslConditional) {
      nextState = dslConditional;
      logs.push(
        buildLogEntry(
          playerId,
          "named_effect",
          card.cardId,
          state.definitions,
          "choice:dsl_conditional",
        ),
      );
      return { state: nextState, logs, enterResumeFrom: "nc" };
    }

    const conditional = getConditionalNamedEffect(card.cardId);
    if (
      conditional &&
      shouldRunConditionalOnEnter(conditional.effectId) &&
      canRunEnterBattleConditionalEffect(nextState, playerId, conditional.effectId)
    ) {
      const modified = applyLegend2ConditionalModifiers(nextState, playerId, battleCard, conditional.effectId);
      if (modified !== battleCard) {
        battleCard = modified;
        const player = nextState.players[playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...player,
            battle: player.battle.map((c) =>
              c.instanceId === card.instanceId ? modified : c,
            ),
          }),
        };
      }
      const withChoice = tryStartConditionalChoice(
        nextState,
        playerId,
        battleCard,
        conditional.effectId,
        playerId,
      );
      if (withChoice) {
        nextState = withChoice;
        logs.push(
          buildLogEntry(
            playerId,
            "named_effect",
            card.cardId,
            state.definitions,
            `choice:${conditional.effectId}`,
          ),
        );
        return { state: nextState, logs, enterResumeFrom: "nc" };
      }
    }

    if (nextState.pendingEffectChoice) {
      return { state: nextState, logs, enterResumeFrom: "nc" };
    }
  }

  if (shouldRunEnterStep(resumeFrom, "nc")) {
    if (
      definition &&
      numberComboTriggers(
        nextState,
        playerId,
        card,
        definition,
        battlePosition,
        battleBeforeEnter,
      )
    ) {
      const ncEffect = resolveNamedNcEffectId(
        nextState,
        playerId,
        card,
        definition,
        battlePosition,
        battleBeforeEnter,
      );
      const ncResult = applyNumberComboEffect(nextState, playerId, card, ncEffect);
      nextState = ncResult.state;
      logs.push(...ncResult.logs);
      if (nextState.pendingEffectChoice) {
        return { state: nextState, logs, enterResumeFrom: "tail" };
      }
    }
  }

  if (shouldRunEnterStep(resumeFrom, "tail")) {
    const jointResult = resolveJointCombos(nextState, playerId);
    nextState = jointResult.state;
    logs.push(...jointResult.logs);

    if (options?.rideOff) {
      const rcResult = resolveRidingComboOnRideOff(nextState, playerId, card);
      nextState = rcResult.state;
      logs.push(...rcResult.logs);
    }

    const courage = applyCourageMagicRelease(nextState, playerId, card.cardId);
    nextState = courage.state;
    if (courage.log) logs.push(courage.log);

    const baseAttack = applyBaseAttackOnEnter(
      nextState,
      playerId,
      battleCard,
      battleBeforeEnter,
    );
    nextState = baseAttack.state;
    logs.push(...baseAttack.logs);
  }

  return { state: nextState, logs };
}

registerEnterBattleEffectsImpl(resolveEnterBattleEffectsImpl);

/** `UnitEnteredBattle` イベント経由で進入効果を解決する（後方互換 API）。 */
export function resolveEnterBattleEffects(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
  options?: {
    battleBeforeEnter?: CardInstance[];
    rideOff?: boolean;
    resumeFrom?: EnterBattleResumeFrom;
  },
): ComboOutcome {
  return emitUnitEnteredBattleEffects(state, playerId, card, battlePosition, options);
}

/** コンボ選択後に戦闘進入解決を再開（攻撃/ストライクプロンプトの前）。 */
export function continueEnterBattleEffects(
  state: GameState,
  entry: PendingBattleEntry,
): ComboOutcome {
  if (!entry.resumeEnterBattle) return { state, logs: [] };

  const player = state.players[entry.playerId];
  const card = player.battle.find((c) => c.instanceId === entry.instanceId);
  if (!card) return { state, logs: [] };

  const battleBeforeEnter = entry.resumeEnterBattle.battleBeforeEnterInstanceIds
    .map((id) => player.battle.find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c);

  return resolveEnterBattleEffects(state, entry.playerId, card, entry.resumeEnterBattle.battlePosition, {
    battleBeforeEnter,
    rideOff: entry.resumeEnterBattle.rideOff,
    resumeFrom: entry.resumeEnterBattle.from,
  });
}

export function battlePositionAfterMove(currentBattle: CardInstance[]): number {
  return countLogicalBattleSlots(currentBattle) + 1;
}

export function canStrikeUnit(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
  state?: GameState,
  playerId?: PlayerId,
): boolean {
  if (isVehicle(getDefinition(definitions, instance.cardId))) return false;
  if (instance.registerHeld) return false;
  if (state && playerId) {
    if (hasBakiBakiExtraAttackOnly(state, playerId, instance.instanceId)) {
      return false;
    }
    if (cannotAttackOrStrikeThisTurn(state.players[playerId], instance)) {
      return false;
    }
    if (
      cardHasGrantKeyword(instance.cardId, "no_strike_with_held_command") &&
      countHeldCommands(state.players[playerId]) > 0
    ) {
      return false;
    }
    if (
      (cardHasGrantKeyword(instance.cardId, "no_strike_if_enemy_battle") ||
        hasUnnamedRule(instance.cardId, "no_strike_if_enemy_battle")) &&
      state.players[opponent(playerId)].battle.some((c) =>
        isUnit(getDefinition(state.definitions, c.cardId)),
      )
    ) {
      return false;
    }
    if (wingTurnBlocksStrike(state.players[playerId], instance.instanceId)) {
      return false;
    }
    if (rideOffBlocksStrike(state.players[playerId], instance.instanceId)) {
      return false;
    }
    if (instance.activatedNcEffects?.includes("souru_no_strike")) {
      return false;
    }
    if (!canStrikeWithHelloMirage(state, playerId, instance)) {
      return false;
    }
    // XG2-101: can't strike if enemy has any メカ unit
    if (instance.cardId === "XG2-101") {
      const enemyId = opponent(playerId);
      const enemyHasMecha = [...state.players[enemyId].rush, ...state.players[enemyId].battle].some(
        (c) => {
          const d = getDefinition(state.definitions, c.cardId);
          return d?.features?.includes("メカ");
        },
      );
      if (enemyHasMecha) return false;
    }
    // RM-018: can't strike if other own S-units are present
    if (instance.cardId === "RM-018") {
      const player = state.players[playerId];
      const otherSUnits = [...player.rush, ...player.battle].filter(
        (c) => c.instanceId !== instance.instanceId && isSmallUnit(state.definitions, c.cardId),
      );
      if (otherSUnits.length > 0) return false;
    }
    if (wingAllowsEmptyBattleStrike(state, playerId, instance)) {
      return legend3EffectiveSp(state, playerId, instance) >= 1;
    }
    return legend3EffectiveSp(state, playerId, instance) >= 1;
  }

  const def = getDefinition(definitions, instance.cardId);
  const sp = def?.sp;
  const modifier = instance.spModifier ?? 0;
  if (typeof sp === "number") return sp + modifier >= 1;
  if (sp === "special") return modifier >= 1;
  return modifier >= 1;
}

export function strikeDamageFor(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
  state?: GameState,
  playerId?: PlayerId,
): number {
  if (state && playerId) {
    return legend3EffectiveSp(state, playerId, instance);
  }

  const def = getDefinition(definitions, instance.cardId);
  const modifier = instance.spModifier ?? 0;
  const printed = instance.spOverride ?? def?.sp;
  if (printed === "special") return modifier;
  if (typeof printed === "number") return printed + modifier;
  if (typeof printed === "string" && printed.includes("/")) return modifier;
  return modifier;
}
