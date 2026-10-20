/**
 * クロスギャザー XG5 の状態の型（types/game.ts から参照する。実行時の依存を持たない）。
 */
import type { PlayerId } from "../../types/game";

/** 選択の続き（PendingEffectChoice.xg5Meta）。 */
export type Xg5ChoiceMeta = {
  /** 段階・選んだモード。 */
  step?: string;
  /** 前の段階で選んだカード等。 */
  ids?: string[];
  /** 数（選べる上限・数えた値）。 */
  n?: number;
  /** 対象のカード。 */
  target?: string;
  /** 対象の持ち主。 */
  owner?: PlayerId;
};

/** 効果のラッシュを終えたときの続き（「出した…そうしたとき」）。 */
export type Xg5Watch = {
  kind: string;
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  /** 出すかもしれないカード。 */
  candidates: string[];
  sourceInstanceId?: string;
  /** ほかに覚えておく値。 */
  target?: string;
};

/** ターン・期間つきの効果。 */
export type Xg5Flag = {
  kind: string;
  /** 効果を発動したプレイヤー。 */
  playerId: PlayerId;
  /** 効くターン（state.turn）。 */
  turn: number;
  /** 対象のカード。 */
  target?: string;
  /** 数。 */
  n?: number;
};

export type Xg5State = {
  watches?: Xg5Watch[];
  flags?: Xg5Flag[];
  /** XG5-001【レッドロープ】: ストライクの処理を終えたら、このプレイヤーのバトルフェイズを終える。 */
  battleEndAdvance?: PlayerId;
};
