/**
 * XG6-037 仮面ライダーアクセル【振り切るぜ】で S ビークルとして扱っているカードの判定（依存のない小さなモジュール。rules/vehicleRules.ts・
 * rules/fieldActivatedAbilities.ts から呼ぶ）。効果の本体は rules/xg6/xg6dEffects.ts（読み込みの循環を避けるため、起動の処理はそちらが
 * XG6_FURIKIRU_ACTIVATION に登録する）。
 */
import type { CardInstance, GameState, PlayerId } from "../../types/game";

/** 【振り切るぜ】の起動（rules/xg6/xg6dEffects.ts が登録する）。 */
export const XG6_FURIKIRU_ACTIVATION: {
  canActivate?: (state: GameState, playerId: PlayerId, card: CardInstance) => boolean;
  activate?: (state: GameState, playerId: PlayerId, card: CardInstance) => GameState;
} = {};

/** 【振り切るぜ】で S ビークルとして扱うカードの定義の id の印（`<本来の cardId>@xg6-037:<選んだビークルの cardId>`）。 */
export const XG6_FURIKIRU_MARK = "@xg6-037:";

/** 【振り切るぜ】でこのターン S ビークルとして扱っているカードか。 */
export function xg6IsFurikiruVehicle(cardId: string): boolean {
  return cardId.includes(XG6_FURIKIRU_MARK);
}

/** 本来のカード ID（【振り切るぜ】の定義でなければそのまま）。 */
export function xg6FurikiruOriginalCardId(cardId: string): string {
  const i = cardId.indexOf(XG6_FURIKIRU_MARK);
  return i < 0 ? cardId : cardId.slice(0, i);
}

/** 効果名を持つテキストを追加した、選んだビークルのカード ID（【振り切るぜ】の定義でなければ undefined）。 */
export function xg6FurikiruCopiedCardId(cardId: string): string | undefined {
  const i = cardId.indexOf(XG6_FURIKIRU_MARK);
  return i < 0 ? undefined : cardId.slice(i + XG6_FURIKIRU_MARK.length);
}
