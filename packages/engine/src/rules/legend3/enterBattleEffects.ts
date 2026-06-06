import { battleHasComboPartner, findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { buildLogEntry } from "../../log/formatLog";
import { grantSp1OnPlayer, patchPlayer } from "../playerPatches";
import type { ComboOutcome } from "../comboTypes";

const BASE_ATTACK_PARTNER_IDS = ["RS-129"];

/** RS-128 拠点攻撃: バイオジェット2号が既に戦闘中の状態で戦闘進入するとSP1。 */
export function applyBaseAttackOnEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): ComboOutcome {
  if (!findNamedEffectByEffectId(card.cardId, "base_attack")) {
    return { state, logs: [] };
  }
  if (
    !battleHasComboPartner(
      battleBeforeEnter,
      BASE_ATTACK_PARTNER_IDS,
      card.instanceId,
    )
  ) {
    return { state, logs: [] };
  }

  const nextState = patchPlayer(state, playerId, (player) =>
    grantSp1OnPlayer(player, card.instanceId),
  );
  return {
    state: nextState,
    logs: [
      buildLogEntry(
        playerId,
        "named_effect",
        card.cardId,
        state.definitions,
        "base_attack",
      ),
    ],
  };
}
