import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { bounceToHand } from "./bounce";
import { applyAdventureEndTurn } from "./turnModifiers";
import { applyOnTurnEndBattleEffects } from "./legend2/destroyEffects";
import { applyResidentOperationTurnEnd } from "./residentOperation";
import { applyRocketBoosterEndTurnRushReturn } from "./rocketBooster";

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function findUnitInField(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { zone: "rush" | "battle"; index: number; card: CardInstance } | null {
  const player = state.players[playerId];
  const inRush = findInZone(player, "rush", instanceId);
  if (inRush) return { zone: "rush", index: inRush.index, card: inRush.card };
  const inBattle = findInZone(player, "battle", instanceId);
  if (inBattle) return { zone: "battle", index: inBattle.index, card: inBattle.card };
  return null;
}

function returnUnitToDeckShuffle(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const found = findUnitInField(state, playerId, instanceId);
  if (!found) return state;
  const player = state.players[playerId];
  const [, zoneAfter] = removeAt(player[found.zone], found.index);
  const newDeck = shuffleDeck([...player.deck, found.card]);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      [found.zone]: zoneAfter,
      deck: newDeck,
    }),
  };
}

function destroyUnitToDiscard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const found = findUnitInField(state, playerId, instanceId);
  if (!found) return state;
  const player = state.players[playerId];
  const [, zoneAfter] = removeAt(player[found.zone], found.index);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      [found.zone]: zoneAfter,
      discard: [...player.discard, found.card],
    }),
  };
}

/** note_other_* nc ターン終了時効果を適用する。 */
function applyNoteOtherNcTurnEndEffects(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  let nextState = state;
  const player = () => nextState.players[endingPlayerId];
  const enemyId = opponent(endingPlayerId);

  const allUnits = () => [...player().rush, ...player().battle];

  for (const card of [...allUnits()]) {
    // Check card still in field each iteration (previous effects may have moved cards)
    if (!findUnitInField(nextState, endingPlayerId, card.instanceId)) continue;

    // RS-216: if no own 車両-featured unit, return to deck and shuffle
    if (card.cardId === "RS-216") {
      const hasVehicleUnit = allUnits().some((c) => {
        if (c.instanceId === card.instanceId) return false;
        const d = getDefinition(nextState.definitions, c.cardId);
        return d?.features?.includes("車両");
      });
      if (!hasVehicleUnit) {
        nextState = returnUnitToDeckShuffle(nextState, endingPlayerId, card.instanceId);
      }
    }

    // RS-281: if no own 女-featured unit, return to hand
    if (card.cardId === "RS-281") {
      const hasFemalUnit = allUnits().some((c) => {
        if (c.instanceId === card.instanceId) return false;
        const d = getDefinition(nextState.definitions, c.cardId);
        return d?.features?.includes("女");
      });
      if (!hasFemalUnit) {
        const bounced = bounceToHand(nextState, {
          playerId: endingPlayerId,
          instanceId: card.instanceId,
          fromZone: findUnitInField(nextState, endingPlayerId, card.instanceId)?.zone ?? "rush",
        });
        if (bounced.bounced) nextState = bounced.state;
      }
    }

    // XG2-101: if released → hold; if held → return to deck and shuffle
    if (card.cardId === "XG2-101") {
      if (card.commandHeld) {
        nextState = returnUnitToDeckShuffle(nextState, endingPlayerId, card.instanceId);
      } else {
        const loc = findUnitInField(nextState, endingPlayerId, card.instanceId);
        if (loc) {
          const p = nextState.players[endingPlayerId];
          const zone = [...p[loc.zone]];
          zone[loc.index] = { ...zone[loc.index]!, commandHeld: true };
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, endingPlayerId, { ...p, [loc.zone]: zone }),
          };
        }
      }
    }

    // XG4-007: if own discard ≥ 5, destroy this
    if (card.cardId === "XG4-007") {
      const p = nextState.players[endingPlayerId];
      if (p.discard.length >= 5) {
        nextState = destroyUnitToDiscard(nextState, endingPlayerId, card.instanceId);
      }
    }
  }

  return nextState;
}

/** TurnEnding リスナー本体: ターン終了時の常駐・バトル効果。 */
export function resolveTurnEndingEffectsImpl(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  let nextState = applyAdventureEndTurn(state, endingPlayerId);
  if (!nextState.pendingEffectChoice) {
    nextState = applyResidentOperationTurnEnd(nextState, endingPlayerId);
  }
  nextState = applyOnTurnEndBattleEffects(nextState, endingPlayerId);
  nextState = applyRocketBoosterEndTurnRushReturn(nextState, endingPlayerId);
  nextState = applyNoteOtherNcTurnEndEffects(nextState, endingPlayerId);
  return { state: nextState, logs: [] };
}
