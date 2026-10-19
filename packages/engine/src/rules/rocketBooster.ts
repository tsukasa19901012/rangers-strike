import type { GameState, PlayerId, ScopedModifier } from "../types/game";
import { cardName, isSmallUnit } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers } from "../core/scopedModifiers";
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
    if (!isSmallUnit(state.definitions, card)) continue;
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

/**
 * ターン終了時: 宣言名と同じ S ユニットをラッシュから手札へ戻す（任意）。
 * 「戻してもよい」の選択は rules/xg4/xg4bEffects.ts の collectXg4bTurnEndQueue（turnEndingEffects.ts の xg4Queue）が
 * ユニットごとに開くので、ここでは何もしない（自動で戻すと任意の選択ができない）。
 */
export function applyRocketBoosterEndTurnRushReturn(
  state: GameState,
  _endingPlayerId: PlayerId,
): GameState {
  return state;
}
