import { getConditionalNamedEffect } from "@rangers-strike/cards";
import { activeNamedEffect, namedEffectActive } from "../ncGatedEffects";
import { countJointLGrant } from "../jointComboGrants";
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
import {
  addBakiBakiExtraAttack,
  clearBakiBakiExtraAttackModifier,
  hasBakiBakiExtraAttack,
} from "../turnModifierBridge";

export type BattleWinOutcome = {
  state: GameState;
  logs: string[];
  skipMarkAttackerActed?: boolean;
};

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
  // 【レッドビュート】はナンバーの欄の効果。NC が成立していなければ発動しない（R-CN-02）。
  if (ownTurn && redBoot?.effectId === "red_boot" && namedEffectActive(attacker.card, "red_boot")) {
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
        // 「1体選んで撃破する」— 対象がいれば強制（atwiki/page-25）。
        optional: false,
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

  // JC で得た能力（L ナンバーのカードから L ユニットへ。faq-card-3 RS-167 Q1: 得た後は離れても有効）。
  const maximumPenetration = countJointLGrant(attacker.card, "maximum_penetration");
  if (ownTurn && maximumPenetration > 0) {
    const bp = battleAttackerBpBonus(nextState, pending);
    if (bp >= 20000) {
      // 2回コンビネーションして2つ得ていれば重複して2点（faq-card-3 RS-171 Q1、R-CONT-01）。
      nextState = applyDamageToPlayer(nextState, opponent(attackerId), maximumPenetration, {
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

  if (ownTurn && activeNamedEffect(attacker.card, "blue_bados_life_sword")) {
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

  // 「アタックしてバトルに勝つたび」— 効果でのバトル（RS-508【ロードサーベル】等）では発動しない。
  if (!pending.effectBattle && countJointLGrant(attacker.card, "baki_baki_punch") > 0) {
    const player = nextState.players[attackerId];
    const withExtra = addBakiBakiExtraAttack(player, attacker.card.instanceId);
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, attackerId, withExtra),
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
  if (!hasBakiBakiExtraAttack(player, instanceId)) return state;
  return {
    ...state,
    ...updatePlayer(state, playerId, clearBakiBakiExtraAttackModifier(player, instanceId)),
  };
}

export function hasBakiBakiExtraAttackOnly(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  return hasBakiBakiExtraAttack(state.players[playerId], instanceId);
}
