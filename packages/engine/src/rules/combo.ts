import type { CardDefinition } from "@rangers-strike/cards";
import {
  getEnterBattleEffect,
  getJointLEffect,
  getJointREffect,
  getRidingComboEffect,
  partnerCategoryMatches,
} from "@rangers-strike/cards";
import { getConditionalNamedEffect } from "@rangers-strike/cards";
import type { CardInstance, EnterBattleResumeFrom, GameState, PendingBattleEntry, PlayerId } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  unitBp,
} from "../core/catalog";
import { opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { applyCourageMagicRelease } from "./strikeReactions";
import { getTurnModifiers, isSOnlyComboLine } from "./turnModifiers";
import {
  tryStartConditionalChoice,
  tryStartDestroyEnemyChoice,
  resolveSkyMagicSlash,
} from "./namedUnitEffects";
import { resolveLegend2EnterBattle, applyLegend2ConditionalModifiers } from "./legend2/battleEffects";
import { tryStartOpponentDrawOnEnter } from "./legend2/destroyEffects";
import type { ComboOutcome } from "./comboTypes";
import {
  applyNumberComboEffect,
  numberComboTriggers,
  resolveNamedNcEffectId,
} from "./numberComboEffects";
import { grantSp1OnPlayer } from "./playerPatches";
import { legend2EffectiveSp } from "./legend2/fieldEffects";

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
    }
  }

  if (logs.length > 0) {
    nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
  }

  return { state: nextState, logs };
}

function resolveRidingComboOnRideOff(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  const ridingEffect = getRidingComboEffect(card.cardId);
  if (ridingEffect !== "grant_sp1") return { state, logs: [] };

  const player = state.players[playerId];
  const nextPlayer = grantSp1OnPlayer(player, card.instanceId);
  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    logs: [
      buildLogEntry(
        playerId,
        "riding_combo",
        card.cardId,
        state.definitions,
        "sp1",
      ),
    ],
  };
}

function applySComboFinisher(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
): CardInstance {
  const player = state.players[playerId];
  const mods = getTurnModifiers(player);
  if (!mods.sComboFinisher || !isSOnlyComboLine(state.definitions, player.battle)) {
    return card;
  }

  const definition = getDefinition(state.definitions, card.cardId);
  if (!definition || !isSmallUnit(state.definitions, card.cardId)) return card;

  if (mods.sComboFinisher === "goren_storm" && battlePosition === 5) {
    const baseBp = unitBp(definition);
    return {
      ...card,
      bpModifier: 12000 - baseBp,
      spModifier: (card.spModifier ?? 0) + 1,
    };
  }

  if (mods.sComboFinisher === "jacker_hurricane" && battlePosition === 4) {
    const baseBp = unitBp(definition);
    return {
      ...card,
      bpModifier: 8000 - baseBp,
      spModifier: (card.spModifier ?? 0) + 1,
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
    const enterEffect = getEnterBattleEffect(card.cardId);
    if (enterEffect === "destroy_enemy_bp4000") {
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
    if (enterEffect === "sky_magic_slash") {
      const slash = resolveSkyMagicSlash(nextState, playerId, card.cardId);
      nextState = slash.state;
      logs.push(...slash.logs);
    }
    if (enterEffect === "mane_hurricane" || enterEffect === "ruin_excavation") {
      const legend2 = resolveLegend2EnterBattle(nextState, playerId, card.cardId, enterEffect);
      nextState = legend2.state;
      logs.push(...legend2.logs);
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

    const conditional = getConditionalNamedEffect(card.cardId);
    if (conditional) {
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
  }

  return { state: nextState, logs };
}

/** Resume enter-battle resolution after a combo choice (before attack/strike prompt). */
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

export function battlePositionAfterMove(currentBattleCount: number): number {
  return currentBattleCount + 1;
}

export function canStrikeUnit(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
  state?: GameState,
  playerId?: PlayerId,
): boolean {
  if (state && playerId) {
    return legend2EffectiveSp(state, playerId, instance) >= 1;
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
    return legend2EffectiveSp(state, playerId, instance);
  }

  const def = getDefinition(definitions, instance.cardId);
  const sp = def?.sp;
  const modifier = instance.spModifier ?? 0;
  if (typeof sp === "number") return sp + modifier;
  if (sp === "special") return modifier;
  return modifier;
}
