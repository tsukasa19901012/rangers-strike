import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, isSmallUnit } from "../core/catalog";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { cannotAttackOrStrikeThisTurn } from "./restrictions";
import { canAttackDefender } from "./legend3/restrictions";
import { canAttackRushWithYellowThunder } from "./namedUnitEffects";
import { startJuuKunDoChoice } from "./pendingChoices";

/** ジュウクンドー同型（アタックの代わりに本来BP合計3000以下を撃破）: RS-106 / PR-006。 */
const JUU_KUN_DO_CARD_IDS = new Set(["RS-106", "PR-006"]);
const JUU_KUN_DO_CARD_ID = "RS-106";

/** 【超忍法・舞獅子】（アタックするかわりに、山札のハリケンイエローをバトルエリアに出す）: RS-100 / RS-307。 */
const LION_DANCE_CARD_IDS = new Set(["RS-100", "RS-307"]);
const GOMA_PALACE_CARD_ID = "RS-187";

function hasAttackableDefender(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  return [...enemy.battle, ...enemy.rush].some((defender) =>
    canAttackDefender(
      state,
      playerId,
      attackerInstanceId,
      enemyId,
      defender.instanceId,
      canAttackRushWithYellowThunder,
    ),
  );
}

/**
 * RS-187 ゴーマ宮（常駐・お互い）:「バトルフェイズ中、バトルエリアの1番目に並ぶSユニットは、可能ならアタックする。」
 * ルール: R-ATK-05 — アタックできる状態ならアタックしなければならず、「アタックするかわりに」の効果は使えない（RS-187 Q3）。
 */
export function gomaPalaceForcesAttack(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  if (state.phase !== "battle") return false;
  const active = (["player1", "player2"] as const).some((pid) =>
    state.players[pid].operation.some((c) => c.cardId === GOMA_PALACE_CARD_ID),
  );
  if (!active) return false;
  const player = state.players[playerId];
  const first = player.battle[0];
  if (!first || first.instanceId !== attackerInstanceId) return false;
  if (!isSmallUnit(state.definitions, first.cardId)) return false;
  if (first.battleActed) return false;
  if (cannotAttackOrStrikeThisTurn(player, first, state, playerId)) return false;
  return hasAttackableDefender(state, playerId, attackerInstanceId);
}

/**
 * 【超忍法・舞獅子】を「アタックするかわりに」発動できるか。
 * ルール: R-ATK-05 — アタックする権利を失うかわりに発動する。アタック対象がいなくても発動でき（公式コラムvol44・
 * ユーザー決定）、山札にハリケンイエローが無くても発動できる（RS-100 Q1）。ゴーマ宮でアタックを強制されていれば使えない。
 */
export function canUseLionDance(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  if (state.phase !== "battle") return false;
  if (state.activePlayer !== playerId) return false;
  const player = state.players[playerId];
  const found = findInZone(player, "battle", attackerInstanceId);
  if (!found || !LION_DANCE_CARD_IDS.has(found.card.cardId)) return false;
  // CN を満たしてバトルエリアに出たとき（NC 成立）だけ使える。
  if (!found.card.activatedNcEffects?.includes("super_ninpo_lion_dance")) return false;
  if (found.card.battleActed) return false;
  if (cannotAttackOrStrikeThisTurn(player, found.card, state, playerId)) return false;
  return !gomaPalaceForcesAttack(state, playerId, attackerInstanceId);
}

function shuffleCards(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** 【超忍法・舞獅子】: アタックの権利を失い、山札のハリケンイエローを1枚バトルエリアに出して山札をシャッフル。 */
export function applyLionDance(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
): GameState | null {
  if (!canUseLionDance(state, playerId, attackerInstanceId)) return null;
  const player = state.players[playerId];
  const deckCard = player.deck.find(
    (c) => getDefinition(state.definitions, c.cardId)?.name === "ハリケンイエロー",
  );
  const battle = player.battle.map((c) =>
    c.instanceId === attackerInstanceId ? { ...c, battleActed: true } : c,
  );
  const deck = player.deck.filter((c) => c.instanceId !== deckCard?.instanceId);
  const nextPlayer = {
    ...player,
    battle: deckCard ? [...battle, deckCard] : battle,
    deck: shuffleCards(deck),
  };
  return { ...state, ...updatePlayer(state, playerId, nextPlayer) };
}

export function isLionDanceCard(cardId: string): boolean {
  return LION_DANCE_CARD_IDS.has(cardId);
}

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
  if (!JUU_KUN_DO_CARD_IDS.has(attackerFound.card.cardId)) return false;
  if (attackerFound.card.battleActed) return false;
  if (cannotAttackOrStrikeThisTurn(player, attackerFound.card)) return false;
  // ルール: R-ATK-05 — ゴーマ宮でアタックを強制されているなら「アタックするかわりに」は使えない（RS-187 Q3）。
  if (gomaPalaceForcesAttack(state, playerId, attackerInstanceId)) return false;

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
  const player = state.players[playerId];
  const attackerCardId =
    (findInZone(player, "battle", attackerInstanceId) ??
      findInZone(player, "rush", attackerInstanceId))?.card.cardId ?? JUU_KUN_DO_CARD_ID;
  return startJuuKunDoChoice(state, {
    playerId,
    effectId: "juu_kun_do",
    sourceCardId: attackerCardId,
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
