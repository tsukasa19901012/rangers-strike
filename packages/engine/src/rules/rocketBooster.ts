import type { GameState, PlayerId, ScopedModifier } from "../types/game";
import { cardName, getDefinition, isSmallUnit } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers } from "../core/scopedModifiers";
import { bounceToHand } from "./bounce";
import { openEffectChoice } from "./pendingChoices";

export const ROCKET_BOOSTER_RULE = "rocket_booster";

type RocketBoosterPayload = { declaredName: string };

function isRocketBoosterModifier(
  m: ScopedModifier,
): m is Extract<ScopedModifier, { kind: "rule" }> {
  return m.kind === "rule" && m.ruleId === ROCKET_BOOSTER_RULE && m.scope === "turn";
}

export function getRocketBoosterDeclaredName(
  state: GameState,
  playerId: PlayerId,
): string | undefined {
  const mod = getPlayerModifiers(state.players[playerId]).find(isRocketBoosterModifier);
  return (mod?.payload as RocketBoosterPayload | undefined)?.declaredName;
}

export function rocketBoosterMatchesCard(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const declared = getRocketBoosterDeclaredName(state, playerId);
  if (!declared) return false;
  if (!isSmallUnit(state.definitions, cardId)) return false;
  return cardName(state.definitions, cardId) === declared;
}

export function listRocketBoosterNameChoices(
  state: GameState,
  playerId: PlayerId,
): string[] {
  const player = state.players[playerId];
  const names = new Set<string>();
  for (const card of [...player.hand, ...player.rush, ...player.battle]) {
    if (!isSmallUnit(state.definitions, card.cardId)) continue;
    names.add(cardName(state.definitions, card.cardId));
  }
  return [...names].sort();
}

/** XG4-031: カード名宣言の選択を開く。 */
export function startRocketBoosterChoice(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): GameState | null {
  const names = listRocketBoosterNameChoices(state, playerId);
  if (names.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "rocket_booster",
    sourceCardId: "XG4-031",
    sourceInstanceId: operationInstanceId,
    kind: "confirm",
    phasePlayerId: playerId,
    validInstanceIds: names,
    optional: false,
  });
}

export function applyRocketBoosterDeclaredName(
  state: GameState,
  playerId: PlayerId,
  declaredName: string,
): GameState {
  const player = addTurnRuleModifier(state.players[playerId], ROCKET_BOOSTER_RULE, {
    sourceCardId: "XG4-031",
    payload: { declaredName } satisfies RocketBoosterPayload,
  });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

/** ターン終了時: 宣言名と同じ S ユニットをラッシュから手札へ戻す（任意）。 */
export function applyRocketBoosterEndTurnRushReturn(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const declared = getRocketBoosterDeclaredName(state, endingPlayerId);
  if (!declared) return state;

  let nextState = state;
  const player = nextState.players[endingPlayerId];
  for (const card of player.rush) {
    if (cardName(nextState.definitions, card.cardId) !== declared) continue;
    const def = getDefinition(nextState.definitions, card.cardId);
    if (!def || def.type !== "unit" || !isSmallUnit(nextState.definitions, card.cardId)) {
      continue;
    }
    const bounced = bounceToHand(nextState, {
      playerId: endingPlayerId,
      instanceId: card.instanceId,
      fromZone: "rush",
    });
    if (bounced.bounced) nextState = bounced.state;
  }
  return nextState;
}
