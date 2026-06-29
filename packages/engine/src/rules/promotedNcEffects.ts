import type { CardInstance, GameState, PlayerId } from "../types/game";
import { cardName } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { addTurnRuleModifier } from "../core/scopedModifiers";
import { ENEMY_POWER_COST_MINUS_RULE } from "../core/power";
import { grantSp1ToBattleUnit, markBattleNcEffect, tryStartBringerSwordChoice } from "./namedUnitEffects";
import { tryStartDestroyPowerCostMinusChoice } from "./powerCostMinusEffects";
import { tryStartMegatomahokuChoice } from "./pendingChoices";
import { buildLogEntry } from "../log/formatLog";
import { applyCoreGapNcEffect } from "./legend1/coreGapEffects";
import type { ComboOutcome } from "./comboTypes";

const PROMOTED_NC_BY_CARD: Record<string, string> = {
  "RK-282": "scissors_attack",
  "RS-333": "magi_red_bolt",
  "RS-335": "magi_blue_bolt",
  "RS-336": "magi_pink_bolt",
  "RS-337": "magi_green_bolt",
  "RS-351": "new_red_beet",
  "RS-382": "victory_robo_strike",
  "RS-402": "scorching_lion",
  "RS-427": "invalidate_next_opponent_turn",
  "RS-445": "disco_dance",
  "RS-460": "flower_bomb",
  "XG1-041": "release_self",
  "XG4-058": "last_battle_protect_other_s",
  "XG5-003": "enemy_power_cost_minus",
  "XG5-032": "end_turn_battle_to_rush",
  "RK-159": "v3_kick",
  "RS-278": "bison_rod",
  "RS-685": "buringasodo",
  "RS-630": "megatomahoku",
};

const CORE_GAP_NC_EFFECTS = new Set([
  "magi_red_bolt",
  "magi_blue_bolt",
  "magi_pink_bolt",
  "magi_green_bolt",
  "new_red_beet",
  "scorching_lion",
  "flower_bomb",
  "disco_dance",
]);

export function getPromotedNcEffectId(cardId: string): string | null {
  return PROMOTED_NC_BY_CARD[cardId] ?? null;
}

export function applyPromotedNcEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  const effectId = getPromotedNcEffectId(card.cardId);
  if (!effectId) return { state, logs: [] };

  const logs: string[] = [];
  let nextState = state;

  if (CORE_GAP_NC_EFFECTS.has(effectId)) {
    return applyCoreGapNcEffect(state, playerId, card, effectId);
  }

  switch (effectId) {
    case "scissors_attack": {
      const player = state.players[playerId];
      const hasVolcancer = player.rush.some(
        (u) => cardName(state.definitions, u.cardId) === "ボルキャンサー",
      );
      if (hasVolcancer) {
        nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
        nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
        logs.push(
          buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "scissors_attack:sp12"),
        );
      }
      break;
    }
    case "enemy_power_cost_minus": {
      const player = addTurnRuleModifier(
        state.players[playerId],
        ENEMY_POWER_COST_MINUS_RULE,
        { sourceCardId: card.cardId },
      );
      nextState = { ...state, ...updatePlayer(state, playerId, player) };
      logs.push(
        buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "enemy_power_cost_minus"),
      );
      break;
    }
    case "invalidate_next_opponent_turn": {
      const player = addTurnRuleModifier(
        state.players[playerId],
        "invalidate_next_opponent_turn_effects",
        { sourceCardId: card.cardId },
      );
      nextState = { ...state, ...updatePlayer(state, playerId, player) };
      logs.push(
        buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "invalidate_next_opponent_turn"),
      );
      break;
    }
    case "last_battle_protect_other_s":
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, effectId));
      break;
    case "release_self": {
      const player = state.players[playerId];
      const found = findInZone(player, "battle", card.instanceId);
      if (found) {
        const [, battleWithout] = removeAt(player.battle, found.index);
        const released = { ...found.card, commandHeld: false };
        const nextPlayer = {
          ...player,
          battle: battleWithout,
          rush: [...player.rush, released],
        };
        nextState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
        logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "release_self"));
      }
      break;
    }
    case "victory_robo_strike":
    case "end_turn_battle_to_rush":
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, effectId));
      break;
    case "v3_kick": {
      const withChoice = tryStartDestroyPowerCostMinusChoice(
        nextState,
        playerId,
        card.cardId,
        playerId,
        { effectId: "v3_kick", enemyOnly: true, size: "S", optional: true },
      );
      if (withChoice) nextState = withChoice;
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "v3_kick"));
      break;
    }
    case "bison_rod": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartDestroyPowerCostMinusChoice(
        nextState,
        playerId,
        card.cardId,
        playerId,
        { effectId: "bison_rod", enemyOnly: true },
      );
      if (withChoice) nextState = withChoice;
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "bison_rod"));
      break;
    }
    case "buringasodo": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartBringerSwordChoice(
        nextState,
        playerId,
        card.cardId,
        card.instanceId,
        playerId,
      );
      if (withChoice) nextState = withChoice;
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "buringasodo"));
      break;
    }
    case "megatomahoku": {
      const withChoice = tryStartMegatomahokuChoice(
        nextState,
        playerId,
        card.cardId,
        card.instanceId,
        playerId,
      );
      if (withChoice) nextState = withChoice;
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, "megatomahoku"));
      break;
    }
    default:
      break;
  }

  return { state: nextState, logs };
}

/** XG4-058: 最後尾の自軍 S が他の自軍 S をアタック対象から守る。 */
export function lastBattleProtectsOtherS(
  state: GameState,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const player = state.players[defenderPlayerId];
  const last = player.battle[player.battle.length - 1];
  if (!last || last.instanceId === defenderInstanceId) return false;
  return hasBattleNcEffect(last, "last_battle_protect_other_s");
}

function hasBattleNcEffect(card: CardInstance, effectId: string): boolean {
  return card.activatedNcEffects?.includes(effectId) ?? false;
}

/** RS-397: ラッシュ時に敵バトル並び替え。 */
export function reorderEnemyBattleAfterRush(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  if (enemy.battle.length <= 1) return state;
  const reversed = [...enemy.battle].reverse();
  return {
    ...state,
    ...updatePlayer(state, enemyId, { ...enemy, battle: reversed }),
  };
}
