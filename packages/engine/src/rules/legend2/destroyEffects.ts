import { getConditionalNamedEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit } from "../../core/catalog";
import { opponent, removeAt, updatePlayer } from "../../core/helpers";
import { applyDamageToPlayer } from "../damagePayment";
import { buildLogEntry } from "../../log/formatLog";

export type DestroyEffectOutcome = {
  state: GameState;
  logs: string[];
};

/** RS-093 tantrum / RS-116 cry on destroy. */
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

/** RS-112: return to hand when enemy reaches 6 damage. */
export function checkReturnToHandAt6Damage(
  state: GameState,
  damagedPlayerId: PlayerId,
): DestroyEffectOutcome {
  const enemyId = opponent(damagedPlayerId);
  const enemy = state.players[enemyId];
  if (enemy.damage < 6) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  for (const pid of ["player1", "player2"] as const) {
    const player = nextState.players[pid];
    for (const zone of ["rush", "battle"] as const) {
      const zord = player[zone].find((c) => c.cardId === "RS-112");
      if (!zord) continue;
      const [, rest] = removeAt(player[zone], player[zone].indexOf(zord));
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, pid, {
          ...player,
          [zone]: rest,
          hand: [...player.hand, zord],
        }),
      };
      logs.push(
        buildLogEntry(pid, "named_effect", "RS-112", state.definitions, "return_hand"),
      );
    }
  }

  return { state: nextState, logs };
}

/** RS-096: return to hand at end of turn if in battle. */
export function applyKarakuriFireHawkEndTurn(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const player = state.players[endingPlayerId];
  const hawk = player.battle.find((c) => c.cardId === "RS-096");
  if (!hawk) return state;

  const [, battle] = removeAt(player.battle, player.battle.indexOf(hawk));
  return {
    ...state,
    ...updatePlayer(state, endingPlayerId, {
      ...player,
      battle,
      hand: [...player.hand, hawk],
    }),
  };
}

import { startOpponentMayDrawChoice } from "../pendingChoices";

/** RS-115: opponent may draw on enter battle. */
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
