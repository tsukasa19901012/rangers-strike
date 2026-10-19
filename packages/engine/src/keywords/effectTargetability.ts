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
import { set7BNotSelectable } from "../rules/legend1/set7NamedEffectsB";
import { rk6SnakeBlocksSelection } from "../rules/rk/rk6Fields";
import { rk10G3xProtects } from "../rules/rk/rk10Fields";
import { unitFeatures } from "../rules/addedFeatures";

/**
 * 場以外（コマンドゾーン等）にあるカードが「相手に選ばれない」能力（not_selectable／アタックされる以外では
 * 相手に選ばれない）を持つか。オモテ向きのカードはその能力が有効（atwiki/page-81 RS-039 Q2 ガタックRF）。
 * ユーザー決定（2026-10-19）「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」
 * 「クエスターレイ等の相手の手札を見て選ぶ場合も指しています」: 相手が見て選ぶとき（オモテ向きのゾーン・捨札、見た手札、
 * お互いに見たカード）はこれで候補から外す。見ないで選ぶ手札（RS-594 の最初の3枚・RK-276・RM-037 等）は外さない。
 * docs/rules/README.md §5.7 j。
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
  // RS-464 花忍者ユリ【斬撃の回避】「次の相手ターン、相手はこのユニットを選べない。」（rules/legend1/set7NamedEffectsB.ts）。
  if (set7BNotSelectable(state, found.playerId, targetInstanceId)) return false;
  // RK-124 スネークオルフェノク【人を守る決意】（rules/rk/rk6Fields.ts）。
  if (rk6SnakeBlocksSelection(state, selectorPlayerId, found.playerId, found.card, unitFeatures)) return false;
  // RK-194 仮面ライダーG3-X ※（自軍ラッシュエリアの SP が空欄のユニットは相手に選ばれない。rules/rk/rk10Fields.ts）。
  if (rk10G3xProtects(state, found.playerId, found.card)) return false;
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
