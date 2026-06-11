import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { cardHasMorphKeyword } from "./battleKeywords";
import { cardHasKeyword } from "./cardKeywords";

export type MorphReplacementCandidate = {
  zone: "hand" | "rush" | "power" | "command";
  instanceId: string;
  card: CardInstance;
};

function unitFeatures(definition: CardDefinition | undefined): string[] {
  return definition?.features ?? [];
}

export function featuresExactlyMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((feature, index) => feature === b[index]);
}

function isFaceUpMorphUnitCard(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
): boolean {
  if (card.faceDown) return false;
  const def = getDefinition(definitions, card.cardId);
  return def?.type === "unit";
}

export function listMorphReplacementCandidates(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  morphUnitCardId: string,
): MorphReplacementCandidate[] {
  const morphFeatures = unitFeatures(getDefinition(definitions, morphUnitCardId));
  if (morphFeatures.length === 0) return [];

  const results: MorphReplacementCandidate[] = [];
  const zones = ["hand", "rush", "power", "command"] as const;
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (!isFaceUpMorphUnitCard(definitions, card)) continue;
      const features = unitFeatures(getDefinition(definitions, card.cardId));
      if (featuresExactlyMatch(features, morphFeatures)) {
        results.push({ zone, instanceId: card.instanceId, card });
      }
    }
  }
  return results;
}

/** 敵ラッシュ（モーフ以外）に対し、モーフ置換候補があるか。 */
export function defenderCanMorphAgainstRush(
  state: GameState,
  defenderId: PlayerId,
  rushedCardId: string,
): boolean {
  if (cardHasMorphKeyword(state.definitions, rushedCardId)) return false;

  const defender = state.players[defenderId];
  for (const zone of ["rush", "battle"] as const) {
    for (const morphUnit of defender[zone]) {
      if (!cardHasKeyword(state.definitions, morphUnit.cardId, "morph")) continue;
      if (listMorphReplacementCandidates(defender, state.definitions, morphUnit.cardId).length > 0) {
        return true;
      }
    }
  }
  return false;
}
