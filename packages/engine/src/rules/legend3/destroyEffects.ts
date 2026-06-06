import {
  findNamedEffectByEffectId,
  getConditionalNamedEffect,
  getJointLNamedEffect,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import {
  getDefinition,
  parsePowerCost,
} from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { applyDamageToPlayer } from "../damagePayment";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  startSagasSniperChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import { battleAttackerBpBonus } from "../namedUnitEffects";
import { withTurnModifiers } from "../turnModifiers";

export type BattleWinOutcome = {
  state: GameState;
  logs: string[];
  skipMarkAttackerActed?: boolean;
};

function attackerJointLEffectId(
  state: GameState,
  playerId: PlayerId,
  attacker: CardInstance,
): string | undefined {
  const player = state.players[playerId];
  const index = player.battle.findIndex((c) => c.instanceId === attacker.instanceId);
  if (index <= 0) return undefined;
  const partner = player.battle[index - 1];
  if (!partner || getDefinition(state.definitions, partner.cardId)?.size !== "L") {
    return undefined;
  }
  return getJointLNamedEffect(partner.cardId)?.effectId;
}

/** RS-126 red_boot / RS-178 sagas_sniper / RS-171 maximum_penetration / RS-133 blue_bados / RS-158 baki_baki。 */
export function resolveLegend3OnBattleWin(
  state: GameState,
  pending: PendingBattle,
  defender: CardInstance,
  defenderOwnerId: PlayerId,
): BattleWinOutcome {
  const attackerId = pending.attackerPlayerId;
  const ownTurn = state.activePlayer === attackerId;
  const attacker = findInZone(state.players[attackerId], "battle", pending.attackerInstanceId);
  if (!attacker) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];
  let skipMarkAttackerActed = false;

  const redBoot = getConditionalNamedEffect(attacker.card.cardId);
  if (ownTurn && redBoot?.effectId === "red_boot") {
    const targets = collectFieldUnitIds(nextState, opponent(attackerId), 2000, ["rush"]);
    if (targets.length > 0) {
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: attackerId,
        effectId: "red_boot",
        sourceCardId: attacker.card.cardId,
        sourceInstanceId: attacker.card.instanceId,
        phasePlayerId: attackerId,
        validInstanceIds: targets,
        unitDestination: "discard",
        optional: true,
      });
      if (withChoice) nextState = withChoice;
      logs.push(
        buildLogEntry(attackerId, "named_effect", attacker.card.cardId, state.definitions, "red_boot"),
      );
    }
  }

  const sagas = getConditionalNamedEffect(attacker.card.cardId);
  if (ownTurn && sagas?.effectId === "sagas_sniper") {
    const destroyedCost = parsePowerCost(
      getDefinition(state.definitions, defender.cardId)?.powerCost ?? 99,
    );
    const withChoice = startSagasSniperChoice(nextState, {
      playerId: attackerId,
      sourceCardId: attacker.card.cardId,
      sourceInstanceId: attacker.card.instanceId,
      phasePlayerId: attackerId,
      maxPowerCost: destroyedCost,
    });
    if (withChoice?.pendingEffectChoice?.effectId === "sagas_sniper") {
      nextState = withChoice;
      logs.push(
        buildLogEntry(attackerId, "named_effect", attacker.card.cardId, state.definitions, "sagas_sniper"),
      );
    }
  }

  const jointEffect = attackerJointLEffectId(nextState, attackerId, attacker.card);
  if (ownTurn && jointEffect === "maximum_penetration") {
    const bp = battleAttackerBpBonus(nextState, pending);
    if (bp >= 20000) {
      nextState = applyDamageToPlayer(nextState, opponent(attackerId), 1, {
        kind: "none",
        activePlayer: attackerId,
      });
      logs.push(
        buildLogEntry(
          attackerId,
          "named_effect",
          attacker.card.cardId,
          state.definitions,
          "maximum_penetration",
        ),
      );
    }
  }

  if (ownTurn && findNamedEffectByEffectId(attacker.card.cardId, "blue_bados_life_sword")) {
    const features = getDefinition(state.definitions, defender.cardId)?.features ?? [];
    if (features.includes("女")) {
      const owner = nextState.players[defenderOwnerId];
      const discardIdx = owner.discard.findIndex((c) => c.instanceId === defender.instanceId);
      if (discardIdx >= 0) {
        const [card, rest] = removeAt(owner.discard, discardIdx);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, defenderOwnerId, {
            ...owner,
            discard: rest,
            deck: [card!, ...owner.deck],
          }),
        };
        logs.push(
          buildLogEntry(
            attackerId,
            "named_effect",
            attacker.card.cardId,
            state.definitions,
            "blue_bados_life_sword",
          ),
        );
      }
    }
  }

  if (jointEffect === "baki_baki_punch") {
    const player = nextState.players[attackerId];
    const mods = player.turnModifiers ?? {
      comboNumberDelta: 0,
      battleBlockedInstanceIds: [],
      shironLightUsed: false,
    };
    const ids = new Set(mods.bakiBakiExtraAttackIds ?? []);
    ids.add(attacker.card.instanceId);
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, attackerId, withTurnModifiers(player, { bakiBakiExtraAttackIds: [...ids] })),
    };
    skipMarkAttackerActed = true;
    logs.push(
      buildLogEntry(
        attackerId,
        "named_effect",
        attacker.card.cardId,
        state.definitions,
        "baki_baki_punch",
      ),
    );
  }

  return { state: nextState, logs, skipMarkAttackerActed };
}

export function clearBakiBakiExtraAttack(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const ids = player.turnModifiers?.bakiBakiExtraAttackIds ?? [];
  if (!ids.includes(instanceId)) return state;
  return {
    ...state,
    ...updatePlayer(
      state,
      playerId,
      withTurnModifiers(player, {
        bakiBakiExtraAttackIds: ids.filter((id) => id !== instanceId),
      }),
    ),
  };
}

export function hasBakiBakiExtraAttackOnly(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  return (state.players[playerId].turnModifiers?.bakiBakiExtraAttackIds ?? []).includes(instanceId);
}
