import type { CardInstance, GameState, PlayerId } from "../types/game";
import { canRunEnterBattleConditionalEffect } from "../rules/namedUnitEffects";
import { startSelectHandChoice, startSelectPowerChoice } from "../rules/pendingChoices";
import { isDslInterpretableEffect } from "./dslCatalog";
import { listDslEffectsForTrigger } from "./effectLookup";

/** DSL conditional 効果 — バトル投入時任意コスト。legacy より先に試行。 */
export function tryStartDslConditionalChoice(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  phasePlayerId: PlayerId,
): GameState | null {
  const effects = listDslEffectsForTrigger(card.cardId, "conditional");
  for (const effect of effects) {
    if (!canRunEnterBattleConditionalEffect(state, playerId, effect.id)) continue;
    if (!isDslInterpretableEffect(effect)) continue;
    const keyword = effect.effects.find(
      (primitive) => primitive.type === "grant_keyword",
    );
    if (!keyword || keyword.type !== "grant_keyword") continue;

    switch (keyword.keyword) {
      case "pay_power_discard_5_for_sp3":
        return startSelectPowerChoice(state, {
          playerId,
          effectId: effect.id,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          phasePlayerId,
          selectCount: 5,
          optional: true,
        });
      case "pay_power_discard_2_for_sp1":
        return startSelectPowerChoice(state, {
          playerId,
          effectId: effect.id,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          phasePlayerId,
          selectCount: 2,
          optional: true,
        });
      case "discard_named_from_hand_for_sp1":
        return startSelectHandChoice(state, {
          playerId,
          effectId: effect.id,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          phasePlayerId,
          cardId: card.cardId,
          optional: true,
        });
      default:
        break;
    }
  }
  return null;
}
