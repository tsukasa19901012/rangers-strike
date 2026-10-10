import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { opponent } from "../core/helpers";
import { findCardInField } from "../rules/fieldLookup";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  breakerBlocksEffectTarget,
  cardHasNotSelectableExceptAttack,
} from "./battleKeywords";
import { rs627NotSelectable } from "../rules/rs/rsCatchallField";

/**
 * 場以外（コマンドゾーン等）にあるカードが「相手に選ばれない」能力（not_selectable／アタックされる以外では
 * 相手に選ばれない）を持つか。オモテ向きのカードはその能力が有効（atwiki/page-81 RS-039 Q2 ガタックRF）。
 */
export function cardNotSelectableByOpponent(cardId: string): boolean {
  return cardHasGrantKeyword(cardId, "not_selectable") || cardHasNotSelectableExceptAttack(cardId);
}

/**
 * 敵効果の対象にできるユニットか（ブレイカー / not_selectable 等）。
 * sourceOwnerId は効果の発生源の持ち主（省略時は選ぶプレイヤー）。
 * ブレイカーは「敵軍ユニット／ビークルの効果」に選ばれないので、敵軍ユニットの効果で
 * 持ち主自身が選ぶ場合も選べない。ルール: R-KW-BREAKER-03
 */
export function isSelectableByOpponentEffect(
  state: GameState,
  selectorPlayerId: PlayerId,
  targetInstanceId: string,
  sourceCardId?: string,
  sourceOwnerIdArg?: PlayerId,
): boolean {
  const found = findCardInField(state, targetInstanceId);
  if (!found) return false;
  const sourceOwnerId = sourceOwnerIdArg ?? inferEffectSourceOwnerId(state, selectorPlayerId, sourceCardId);

  // ブレイカーは「敵軍」（ブレイカーの持ち主から見て）の効果だけを防ぐ。選ぶのが持ち主でも防ぐ。
  if (
    found.playerId !== sourceOwnerId &&
    breakerBlocksEffectTarget(state.definitions, found.card.cardId, sourceCardId)
  ) {
    return false;
  }
  if (found.playerId === selectorPlayerId) return true;

  if (cardHasGrantKeyword(found.card.cardId, "not_selectable")) return false;
  if (cardHasNotSelectableExceptAttack(found.card.cardId)) return false;
  if (rs627NotSelectable(state, found.playerId, targetInstanceId)) return false;
  return true;
}

/**
 * 効果の発生源の持ち主を推定する（呼び出し側が渡さないとき）。
 * - 発生源のカードが片方のプレイヤーの場（ラッシュ／バトル）にだけあれば、そのプレイヤー。
 * - 「相手は自分自身の…を選び」の効果（RK-264 アクロバッター、XG6-040 ジョーカー等）は、選ぶのが相手で
 *   発生源は選ぶプレイヤーの敵軍。ルール: R-KW-BREAKER-03（atwiki/page-2355 Q2）
 * - それ以外は選ぶプレイヤー自身の効果とみなす。
 */
function inferEffectSourceOwnerId(
  state: GameState,
  selectorPlayerId: PlayerId,
  sourceCardId: string | undefined,
): PlayerId {
  if (!sourceCardId) return selectorPlayerId;
  const holders = (Object.keys(state.players) as PlayerId[]).filter((pid) => {
    const player = state.players[pid];
    return [...player.rush, ...player.battle].some((c) => c.cardId === sourceCardId);
  });
  if (holders.length === 1) return holders[0]!;
  const text = getDefinition(state.definitions, sourceCardId)?.text ?? "";
  if (/相手は自分自身の/.test(text)) return opponent(selectorPlayerId);
  return selectorPlayerId;
}
