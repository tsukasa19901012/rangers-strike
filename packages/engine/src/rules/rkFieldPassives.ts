import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getCardDslDocument } from "../dsl/effectLookup";
import { getDefinition } from "../core/catalog";
import { opponent } from "../core/helpers";

/** RK カードの while_in_field / ※ 注釈から BP ボーナスを汎用パース。 */
export function rkPassiveBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const doc = getCardDslDocument(instance.cardId);
  if (!doc?.id?.startsWith("RK-")) return 0;

  let bonus = 0;
  const enemyId = opponent(playerId);
  const own = state.players[playerId];
  const enemy = state.players[enemyId];

  for (const effect of doc.effects ?? []) {
    if (effect.trigger?.type !== "while_in_field" && !effect.text?.startsWith("※")) continue;
    const text = effect.text ?? "";

    const perHeldEnemy = text.match(/ホールド状態の敵軍ユニット1体につきBP\+(\d+)/);
    if (perHeldEnemy) {
      bonus += enemy.command.filter((c) => c.commandHeld).length * Number(perHeldEnemy[1]);
    }

    const perEnemyHand = text.match(/相手の手札1枚につきBP\+(\d+)/);
    if (perEnemyHand) {
      bonus += enemy.hand.length * Number(perEnemyHand[1]);
    }

    const perFaceupPower = text.match(/パワーゾーンのオモテ向きのカード1枚につきBP\+(\d+)/);
    if (perFaceupPower) {
      bonus += own.power.filter((c) => !c.faceDown).length * Number(perFaceupPower[1]);
    }

    const perReleasedCommand = text.match(/リリース状態の自軍コマンド1つにつきBP\+(\d+)/);
    if (perReleasedCommand) {
      bonus += own.command.filter((c) => !c.commandHeld).length * Number(perReleasedCommand[1]);
    }

    const perDiscardSelf = text.match(/自軍捨札に自分自身のカードが(\d+)枚以上あればBP\+(\d+)/);
    if (perDiscardSelf) {
      const min = Number(perDiscardSelf[1]);
      const amount = Number(perDiscardSelf[2]);
      const selfCount = own.discard.filter((c) => c.cardId === instance.cardId).length;
      if (selfCount >= min) bonus += amount;
    }

    const perFeatureField = text.match(/特徴「([^」]+)」を持つ自軍ユニット1体につきBP\+(\d+)/);
    if (perFeatureField) {
      const feature = perFeatureField[1]!;
      const amount = Number(perFeatureField[2]);
      const count = [...own.rush, ...own.battle].filter((c) => {
        const def = getDefinition(state.definitions, c.cardId);
        return def?.features?.includes(feature);
      }).length;
      bonus += count * amount;
    }
  }

  return bonus;
}
