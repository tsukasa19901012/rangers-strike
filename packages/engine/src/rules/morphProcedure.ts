import type { CardInstance, GameState, PendingMorph, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { cardHasMorphKeyword } from "../keywords/battleKeywords";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { listMorphReplacementCandidates } from "../keywords/morph";

/** wiki p1294: 置換元カードの探索ゾーン。 */
export const MORPH_REPLACEMENT_ZONES = ["hand", "rush", "power", "command"] as const;

/** wiki p1294: モーフ能力を持つフィールド上のユニット。 */
export const MORPH_FIELD_ZONES = ["rush", "battle"] as const;

export type MorphReplacementZone = (typeof MORPH_REPLACEMENT_ZONES)[number];
export type MorphFieldZone = (typeof MORPH_FIELD_ZONES)[number];

/** モーフキーワード持ちユニットのラッシュはモーフ反応を誘発しない。 */
export function rushedCardBlocksMorphReaction(
  definitions: GameState["definitions"],
  rushedCardId: string,
): boolean {
  return cardHasMorphKeyword(definitions, rushedCardId);
}

export function isFaceUpUnitCard(
  definitions: GameState["definitions"],
  card: CardInstance,
): boolean {
  if (card.faceDown) return false;
  return getDefinition(definitions, card.cardId)?.type === "unit";
}

/** 敵ラッシュに対し当該ユニットがモーフ反応可能か。 */
export function morphUnitCanReact(
  state: GameState,
  defenderId: PlayerId,
  morphUnit: CardInstance,
  rushedCardId: string,
): boolean {
  if (!cardHasKeyword(state.definitions, morphUnit.cardId, "morph")) return false;
  if (rushedCardBlocksMorphReaction(state.definitions, rushedCardId)) return false;
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
