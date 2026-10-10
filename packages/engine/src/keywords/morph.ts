import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { cardHasKeyword } from "./cardKeywords";
import { ryuseioBlocksMove } from "../rules/restrictions";

/**
 * モーフの置き換え先を探すゾーン。「自軍ゾーン」はコマンドゾーンとパワーゾーンだけ
 * （手札・ラッシュエリアは含まない）。ルール: R-KW-MORPH-02
 */
export const MORPH_REPLACEMENT_ZONES = ["power", "command"] as const;

/** 置き換え元ゾーン（モーフ以外の置き換え効果は手札・ラッシュも使う）。 */
export type ReplacementSourceZone = "hand" | "rush" | "power" | "command";

export type MorphReplacementCandidate = {
  zone: ReplacementSourceZone;
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
  zones: readonly ReplacementSourceZone[] = MORPH_REPLACEMENT_ZONES,
): MorphReplacementCandidate[] {
  const morphFeatures = unitFeatures(getDefinition(definitions, morphUnitCardId));
  if (morphFeatures.length === 0) return [];

  const results: MorphReplacementCandidate[] = [];
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

/**
 * モーフで置き換えて、モーフ持ちユニットのいたエリアに出られる置き換え先。
 * バトルエリアのモーフ持ちユニットと置き換えるカードは、バトルエリアに出られなければ選べない
 * （RS-290 龍星王【飛竜棍・大風車】＋RS-339 闇のヤイバで DA の S ユニットになるクウガRD:
 *  atwiki/page-474 Q2・Q4、atwiki/page-439 Q3・Q4「実行できないことが明確であれば、それを実行することはできません」）。
 */
export function listPlaceableMorphReplacementCandidates(
  state: GameState,
  defenderId: PlayerId,
  morphUnit: CardInstance,
): MorphReplacementCandidate[] {
  const defender = state.players[defenderId];
  const candidates = listMorphReplacementCandidates(defender, state.definitions, morphUnit.cardId);
  const inBattle = defender.battle.some((c) => c.instanceId === morphUnit.instanceId);
  if (!inBattle) return candidates;
  return candidates.filter((c) => !ryuseioBlocksMove(state, defenderId, c.card));
}

/**
 * 敵ラッシュ（モーフ以外の手段）に対し、モーフ置換候補があるか。
 * ルール: R-KW-MORPH-01 — 判定はラッシュの手段。ラッシュされたカードがモーフを持っていても反応できる。
 */
export function defenderCanMorphAgainstRush(
  state: GameState,
  defenderId: PlayerId,
  rushMethod: "normal" | "effect" | "morph" = "normal",
): boolean {
  if (rushMethod === "morph") return false;

  const defender = state.players[defenderId];
  for (const zone of ["rush", "battle"] as const) {
    for (const morphUnit of defender[zone]) {
      if (!cardHasKeyword(state.definitions, morphUnit.cardId, "morph")) continue;
      if (listPlaceableMorphReplacementCandidates(state, defenderId, morphUnit).length > 0) {
        return true;
      }
    }
  }
  return false;
}
