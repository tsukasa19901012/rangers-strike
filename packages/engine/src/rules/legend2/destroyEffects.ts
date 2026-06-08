import { getConditionalNamedEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit } from "../../core/catalog";
import { opponent, updatePlayer } from "../../core/helpers";
import { bounceToHand } from "../bounce";
import { applyDamageToPlayer } from "../damagePayment";
import { buildLogEntry } from "../../log/formatLog";

export type DestroyEffectOutcome = {
  state: GameState;
  logs: string[];
};

/** RS-093 tantrum / RS-116 cry — 撃破時。 */
export function resolveLegend2OnDestroy(
  state: GameState,
  ownerId: PlayerId,
  cardId: string,
): DestroyEffectOutcome {
  const named = getConditionalNamedEffect(cardId);
  if (!named) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  switch (named.effectId) {
    case "tantrum": {
      for (const pid of ["player1", "player2"] as const) {
        nextState = applyDamageToPlayer(nextState, pid, 1, {
          kind: "none",
          activePlayer: ownerId,
        });
        if (nextState.pendingDamagePayment) break;
      }
      logs.push(
        buildLogEntry(ownerId, "named_effect", cardId, state.definitions, "tantrum"),
      );
      break;
    }
    case "cry": {
      for (const pid of ["player1", "player2"] as const) {
        const player = nextState.players[pid];
        const toReturn: typeof player.rush = [];
        const keepRush: typeof player.rush = [];
        for (const card of player.rush) {
          const def = getDefinition(state.definitions, card.cardId);
          if (
            isSmallUnit(state.definitions, card.cardId) &&
            !def?.features?.includes("魔法")
          ) {
            toReturn.push(card);
          } else {
            keepRush.push(card);
          }
        }
        const toReturnBattle: typeof player.battle = [];
        const keepBattle: typeof player.battle = [];
        for (const card of player.battle) {
          const def = getDefinition(state.definitions, card.cardId);
          if (
            isSmallUnit(state.definitions, card.cardId) &&
            !def?.features?.includes("魔法") &&
            card.cardId !== cardId
          ) {
            toReturn.push(card);
          } else {
            keepBattle.push(card);
          }
        }
        if (toReturn.length > 0) {
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pid, {
              ...player,
              rush: keepRush,
              battle: keepBattle,
              hand: [...player.hand, ...toReturn],
            }),
          };
        }
      }
      logs.push(
        buildLogEntry(ownerId, "named_effect", cardId, state.definitions, "cry"),
      );
      break;
    }
  }

  return { state: nextState, logs };
}

/** RS-112: 敵軍ダメージが6点に達したとき、持ち主の手札へ戻す。 */
export function checkReturnToHandAt6Damage(
  state: GameState,
  damagedPlayerId: PlayerId,
): DestroyEffectOutcome {
  const damaged = state.players[damagedPlayerId];
  if (damaged.damage < 6) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  for (const ownerId of ["player1", "player2"] as const) {
    if (opponent(ownerId) !== damagedPlayerId) continue;
    const player = nextState.players[ownerId];
    for (const zone of ["rush", "battle"] as const) {
      const zord = player[zone].find((c) => c.cardId === "RS-112");
      if (!zord) continue;
      const bounced = bounceToHand(nextState, {
        playerId: ownerId,
        instanceId: zord.instanceId,
        fromZone: zone,
      });
      if (!bounced.bounced) continue;
      nextState = bounced.state;
      logs.push(
        buildLogEntry(ownerId, "named_effect", "RS-112", state.definitions, "return_hand"),
      );
    }
  }

  return { state: nextState, logs };
}

/** RS-096: ターン終了時、戦闘中なら手札へ戻す。 */
export function applyKarakuriFireHawkEndTurn(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const player = state.players[endingPlayerId];
  const hawk = player.battle.find((c) => c.cardId === "RS-096");
  if (!hawk) return state;

  const bounced = bounceToHand(state, {
    playerId: endingPlayerId,
    instanceId: hawk.instanceId,
    fromZone: "battle",
  });
  return bounced.bounced ? bounced.state : state;
}

import { startOpponentMayDrawChoice } from "../pendingChoices";

/** RS-115: 戦闘進入時に相手がドローできる。 */
export function tryStartOpponentDrawOnEnter(
  state: GameState,
  enteringPlayerId: PlayerId,
  cardId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (cardId !== "RS-115") return state;
  const enemyId = opponent(enteringPlayerId);
  return startOpponentMayDrawChoice(state, enemyId, phasePlayerId) ?? state;
}
