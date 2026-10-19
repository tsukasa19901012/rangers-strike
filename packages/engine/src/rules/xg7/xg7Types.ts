/**
 * クロスギャザー ザ・ベストパートナー（XG7-001〜XG7-068）の状態の型（types/game.ts から型だけ読み込む）。
 * 実装は rules/xg7/xg7Effects.ts（入口）・xg7aEffects.ts / xg7bEffects.ts / xg7cEffects.ts（バッチごと）・xg7Fields.ts（継続効果）。
 */
import type { PendingBattle, PendingLeave, PlayerId } from "../../types/game";

/** ターンを限った記録（key ごと。turn はその記録が有効なターン番号）。 */
export type Xg7Flag = {
  key: string;
  playerId: PlayerId;
  turn: number;
  instanceId?: string;
  value?: number;
};

/** GameState.xg7。 */
export type Xg7State = {
  flags?: Xg7Flag[];
};

/** CardInstance.xg7Turn（このターンだけの付与。core/modifiers.ts clearTurnModifiers で消える）。 */
export type Xg7CardTurn = {
  /** このターン得たクロスの値（XG7-015 等）。 */
  cross?: number;
  /** このターン、ライドオフできない（XG7-017）。 */
  noRideOff?: boolean;
};

/** PendingEffectChoice.xg7Meta（選択の続き）。 */
export type Xg7ChoiceMeta = {
  /** 効果の持ち主（相手が選ぶ選択のとき）。 */
  owner?: PlayerId;
  /** 離場の置換（その場に留める）の続き。 */
  intent?: PendingLeave;
  /** 選んだカード・ユニット。 */
  target?: string;
  /** 比べる値（BP・必要パワーの数字等）。 */
  value?: number;
  /** 残りの回数・上限。 */
  remaining?: number;
  limit?: number;
  /** 続けるバトル。 */
  battle?: PendingBattle;
  wingAttackFromRush?: boolean;
  /** 任意の文字列の記録。 */
  tags?: string[];
};
