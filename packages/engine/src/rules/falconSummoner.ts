import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { getDefinition, parsePowerCost } from "../core/catalog";
import { canAffordAvailablePower, effectivePowerCost } from "../core/power";
import { opponent, removeAt, updatePlayer } from "../core/helpers";

function canRushRevealedCard(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  def: CardDefinition,
): boolean {
  if (def.type === "vehicle") return true;
  if (resolveRushAdditionalCondition(cardId, def)) return false;
  const cost = effectivePowerCost(state, playerId, parsePowerCost(def.powerCost));
  return canAffordAvailablePower(state, playerId, cost);
}

/** RS-607 ファルコンサモナー: 敵ダメージ数まで山札上から公開→獣/ビークルならラッシュ、否则手札+1枚捨て。 */
export function applyFalconSummonerOperation(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const enemyId = opponent(playerId);
  let remaining = state.players[enemyId].damage;
  let next = state;

  while (remaining > 0) {
    const player = next.players[playerId];
    if (player.deck.length === 0) break;

    const [top, ...restDeck] = player.deck;
    if (!top) break;
    const def = getDefinition(next.definitions, top.cardId);
    if (!def) break;

    const beastUnit =
      def.type === "unit" && (def.features ?? []).includes("獣");
    const vehicle = def.type === "vehicle";
    const eligible = beastUnit || vehicle;

    if (eligible && canRushRevealedCard(next, playerId, top.cardId, def)) {
      next = {
        ...next,
        ...updatePlayer(next, playerId, {
          ...player,
          deck: restDeck,
          rush: [...player.rush, top],
        }),
      };
      remaining -= 1;
      continue;
    }

    let hand = [...player.hand, top];
    let discard = [...player.discard];
    if (hand.length > 0) {
      const [discarded, restHand] = removeAt(hand, 0);
      hand = restHand;
      if (discarded) discard = [...discard, discarded];
    }
    next = {
      ...next,
      ...updatePlayer(next, playerId, {
        ...player,
        deck: restDeck,
        hand,
        discard,
      }),
    };
    remaining -= 1;
  }

  return next;
}
