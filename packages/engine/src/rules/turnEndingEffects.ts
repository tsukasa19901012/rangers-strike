import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, TurnEndProgress } from "../types/game";
import { effectiveBp, getDefinition } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { bounceToHand } from "./bounce";
import { applyOnTurnEndBattleEffects } from "./legend2/destroyEffects";
import { hasEndPhaseBlockingPending } from "./legend3/endTurnEffects";
import { collectTurnEndResidentQueue, resolveTurnEndResident } from "./residentOperation";
import { applyRocketBoosterEndTurnRushReturn } from "./rocketBooster";
import { applyKeywordTurnEndEffects, clearEnemyTurnDamageFlag } from "./keywordGapRuntime";
import { applyGegeruTurnEnd } from "./residentOps";
import { applyTempDiscardAtTurnEnd } from "./riderKickEffects";

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

/**
 * RS-310 ゴウライビートル【カラクリ忍法・角変化】: 自分か相手がターンを終えるとき BP8000 以上なら撃破。
 * ルール: R-END-01 — 「ターンを終えるとき」はまだターン中なので「このターン」の修正込みで判定する（faq-card-5 RS-310 Q1）。
 */
function applyKakuhengeTurnEndDestroy(state: GameState): GameState {
  let nextState = state;
  for (const pid of ["player1", "player2"] as const) {
    const units = [...nextState.players[pid].rush, ...nextState.players[pid].battle];
    for (const card of units) {
      if (!findNamedEffectByEffectId(card.cardId, "karakuri_ninpo_tsuno")) continue;
      if (effectiveBp(nextState, pid, card) < 8000) continue;
      nextState = destroyUnitToDiscard(nextState, pid, card.instanceId);
    }
  }
  return nextState;
}

function turnEndBlocked(state: GameState): boolean {
  return !!state.winner || hasEndPhaseBlockingPending(state);
}

/**
 * TurnEnding リスナー本体: 「ターンを終えるとき」の常駐・バトル効果。
 * ルール: R-END-01 — まだ終えるプレイヤーのターン中に処理する。選択が開いたら進捗を
 * `turnEndProgress` に残して止まり、選択の解決後に同じ関数で再開する。
 */
export function resolveTurnEndingEffectsImpl(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  let progress: TurnEndProgress =
    state.turnEndProgress?.endingPlayerId === endingPlayerId
      ? state.turnEndProgress
      : {
          endingPlayerId,
          residentQueue: collectTurnEndResidentQueue(state, endingPlayerId),
          restDone: false,
        };
  let nextState = state;
  const save = (s: GameState, logs: string[] = []) => ({
    state: { ...s, turnEndProgress: progress },
    logs,
  });

  while (progress.residentQueue.length > 0) {
    if (turnEndBlocked(nextState)) return save(nextState);
    const [entry, ...rest] = progress.residentQueue;
    progress = { ...progress, residentQueue: rest };
    nextState = resolveTurnEndResident(nextState, entry!, endingPlayerId);
  }
  if (turnEndBlocked(nextState) || progress.restDone) return save(nextState);
  progress = { ...progress, restDone: true };

  nextState = applyOnTurnEndBattleEffects(nextState, endingPlayerId);
  nextState = applyKakuhengeTurnEndDestroy(nextState);
  nextState = applyRocketBoosterEndTurnRushReturn(nextState, endingPlayerId);
  nextState = applyNoteOtherNcTurnEndEffects(nextState, endingPlayerId);
  nextState = applyGegeruTurnEnd(nextState, endingPlayerId);
  nextState = applyTempDiscardAtTurnEnd(nextState, endingPlayerId);
  const keywordEnd = applyKeywordTurnEndEffects(nextState, endingPlayerId);
  nextState = clearEnemyTurnDamageFlag(keywordEnd.state, endingPlayerId);
  return save(nextState, keywordEnd.logs);
}
