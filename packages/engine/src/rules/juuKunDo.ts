import type { CardInstance, GameState, PlayerId } from "../types/game";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { cannotAttackOrStrikeThisTurn } from "./restrictions";
import { canAttackDefender } from "./legend3/restrictions";
import { canAttackRushWithYellowThunder } from "./namedUnitEffects";
import { startJuuKunDoChoice } from "./pendingChoices";

const JUU_KUN_DO_CARD_ID = "RS-106";

/** RS-106 がアタック可能な敵ユニットが1体以上いるか（ジュウクンドー発動条件）。 */
export function canUseJuuKunDo(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  if (state.phase !== "battle") return false;
  if (state.activePlayer !== playerId) return false;

  const player = state.players[playerId];
  const attackerFound =
    findInZone(player, "battle", attackerInstanceId) ??
    findInZone(player, "rush", attackerInstanceId);
  if (!attackerFound) return false;
  if (attackerFound.card.cardId !== JUU_KUN_DO_CARD_ID) return false;
  if (attackerFound.card.battleActed) return false;
  if (cannotAttackOrStrikeThisTurn(player, attackerFound.card)) return false;

  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  for (const defender of [...enemy.battle, ...enemy.rush]) {
    if (
      canAttackDefender(
        state,
        playerId,
        attackerInstanceId,
        enemyId,
        defender.instanceId,
        canAttackRushWithYellowThunder,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function applyUseJuuKunDo(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
): GameState | null {
  if (!canUseJuuKunDo(state, playerId, attackerInstanceId)) return null;
  return startJuuKunDoChoice(state, {
    playerId,
    effectId: "juu_kun_do",
    sourceCardId: JUU_KUN_DO_CARD_ID,
    sourceInstanceId: attackerInstanceId,
    phasePlayerId: playerId,
    optional: true,
  });
}

/** ジュウクンドー使用後 — アタック不可のため battleActed を立てる。 */
export function markJuuKunDoAttackerActed(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string | undefined,
): GameState {
  if (!attackerInstanceId) return state;
  const player = state.players[playerId];
  const mark = (cards: CardInstance[]) =>
    cards.map((c) =>
      c.instanceId === attackerInstanceId ? { ...c, battleActed: true } : c,
    );
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle: mark(player.battle),
      rush: mark(player.rush),
    }),
  };
}
