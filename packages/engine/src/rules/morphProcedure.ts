import type { CardInstance, GameState, PendingMorph, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { listMorphReplacementCandidates, MORPH_REPLACEMENT_ZONES } from "../keywords/morph";

export { MORPH_REPLACEMENT_ZONES };

/** モーフ能力を持つフィールド上のユニット。 */
export const MORPH_FIELD_ZONES = ["rush", "battle"] as const;

export type MorphReplacementZone = (typeof MORPH_REPLACEMENT_ZONES)[number];
export type MorphFieldZone = (typeof MORPH_FIELD_ZONES)[number];

/** ユニットがラッシュされた手段。モーフによる置き換えで場に出たものは "morph"。 */
export type RushMethod = "normal" | "effect" | "morph";

/**
 * モーフは敵軍ユニットが「モーフ以外で」ラッシュされたときに誘発する。判定はラッシュの手段で、
 * ラッシュされたカードがモーフを持つかどうかではない。ルール: R-KW-MORPH-01
 */
export function rushMethodBlocksMorphReaction(method: RushMethod): boolean {
  return method === "morph";
}

export function isFaceUpUnitCard(
  definitions: GameState["definitions"],
  card: CardInstance,
): boolean {
  if (card.faceDown) return false;
  return getDefinition(definitions, card.cardId)?.type === "unit";
}

/** 敵ラッシュに対し当該ユニットがモーフ反応可能か。ルール: R-KW-MORPH-01, R-KW-MORPH-02 */
export function morphUnitCanReact(
  state: GameState,
  defenderId: PlayerId,
  morphUnit: CardInstance,
  rushMethod: RushMethod = "normal",
): boolean {
  if (!cardHasKeyword(state.definitions, morphUnit.cardId, "morph")) return false;
  if (rushMethodBlocksMorphReaction(rushMethod)) return false;
  return (
    listMorphReplacementCandidates(
      state.players[defenderId],
      state.definitions,
      morphUnit.cardId,
    ).length > 0
  );
}

/** 複数モーフユニットが反応可能で、まだどれを解決するか未選択。 */
export function shouldMorphOrderChooserAct(pending: PendingMorph): boolean {
  return pending.morphUnitInstanceIds.length > 1 && !pending.activeMorphUnitInstanceId;
}

/** wiki p1827: 複数モーフの順序はターンプレイヤー（phasePlayerId）が決める。 */
export function morphOrderChooserPlayerId(pending: PendingMorph): PlayerId | undefined {
  return shouldMorphOrderChooserAct(pending) ? pending.phasePlayerId : undefined;
}

export function morphReplacementChooserPlayerId(pending: PendingMorph): PlayerId {
  return pending.defenderPlayerId;
}

/** pendingMorph 中に操作権を持つプレイヤー。 */
export function getMorphReactionActorId(
  state: GameState,
  pending: PendingMorph,
): PlayerId {
  if (state.pendingEffectChoice?.effectId === "morph_replacement") {
    return morphReplacementChooserPlayerId(pending);
  }
  return morphOrderChooserPlayerId(pending) ?? pending.defenderPlayerId;
}
