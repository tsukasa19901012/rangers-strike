import { lookupByCardIdentity } from "@rangers-strike/cards";
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
import { startAssaultVector, startSpinningSlash } from "./timeRangerNc";
import { startGrapFighter } from "./grapFighter";
import { startDenjiThunderThrow } from "./denjiThunderThrow";

const PROMOTED_NC_BY_CARD: Record<string, string> = {
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
  "RS-218": "asarutobekuta",
  "RS-219": "supiningusurashu",
  "RS-221": "gurapufuaita",
  "RS-313": "ikazuchibureika",
  // RS-232: NC の欄は【アバレウィング】だけ（※の「撃破されて捨札になったとき」は rules/leaveEffects の撃破時処理）。
  "RS-232": "abareuingu",
  "RS-358": "denjisandage",
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
  return lookupByCardIdentity(PROMOTED_NC_BY_CARD, cardId) ?? null;
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
    case "asarutobekuta":
    case "supiningusurashu": {
      // RS-218【アサルトベクター】/ RS-219【スピニングスラッシュ】: 「SP1」＋相手パワーの整理／敵軍 S の撃破。
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      nextState =
        effectId === "asarutobekuta"
          ? startAssaultVector(nextState, playerId, card.instanceId)
          : startSpinningSlash(nextState, playerId, card.instanceId);
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, effectId));
      break;
    }
    case "denjisandage": {
      // RS-358【デンジサンダー投げ】（rules/denjiThunderThrow.ts）。
      nextState = startDenjiThunderThrow(nextState, playerId, card.instanceId);
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, effectId));
      break;
    }
    case "gurapufuaita": {
      // RS-221【グラップファイター】（rules/grapFighter.ts）。
      nextState = startGrapFighter(nextState, playerId, card.instanceId);
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, effectId));
      break;
    }
    case "ikazuchibureika": {
      // RS-313【イカヅチブレイカー】: グラップファイターからダメージの一文を除いたもの（rules/grapFighter.ts）。
      nextState = startGrapFighter(nextState, playerId, card.instanceId, "RS-313");
      logs.push(buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, effectId));
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
      // RS-427【オネスト・ハート】: 直前のターンに敵軍ユニットが発動した「次の相手ターン」とある効果を無効にする
      // （atwiki/page-510）。直前のターンに「次の相手ターン」として付いた（next_turn から繰り上がった）修飾子のうち、
      // ユニットの効果によるものを取り除く（例: RS-110【ゼニボム】）。
      const own = state.players[playerId];
      const kept = (own.modifiers ?? []).filter(
        (m) =>
          !(
            m.kind === "rule" &&
            m.fromNextTurn &&
            m.sourceCardId &&
            state.definitions[m.sourceCardId]?.type === "unit"
          ),
      );
      const player = addTurnRuleModifier(
        { ...own, modifiers: kept.length > 0 ? kept : undefined },
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
    case "abareuingu":
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
        // 「必要パワーの数字に「－」のあるユニットを1体選び」— 敵軍に限らない（atwiki/page-466）。
        { effectId: "bison_rod", anyOwner: true },
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
