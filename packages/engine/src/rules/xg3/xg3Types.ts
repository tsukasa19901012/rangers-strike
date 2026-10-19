/**
 * クロスギャザー ザ・Wインパクト（XG3）の状態の型（types/game.ts の GameState.xg3・PendingEffectChoice.xg3Meta）。
 */
import type { PlayerId } from "../../types/game";

/** 選択の続きに持たせる値。 */
export type Xg3ChoiceMeta = {
  /** 選び終えたカード・宣言などの途中の値。 */
  picked?: string[];
  /** 数の上限・比べる値。 */
  limit?: number;
  /** 続きの対象（ユニット等）。 */
  targetInstanceId?: string;
  /** 持ち主。 */
  ownerId?: PlayerId;
  /** 途中の段階。 */
  step?: string;
};

/** ラッシュエリアに出たユニットを、ビークルにライドさせる処理待ち（XG3-002【宇宙を走る車】）。 */
export type Xg3PendingMount = { ownerId: PlayerId; unitInstanceId: string; vehicleInstanceId: string; moveVehicle?: boolean };

/** コンビネーションで得た「これがストライクしたとき」の能力（XG3-018【暴れ独楽】・XG3-019【カラクリボール奪還】）。 */
export type Xg3StrikeGrant = { ownerId: PlayerId; instanceId: string; partnerInstanceId: string; sourceCardId: string; turn: number };

export type Xg3State = {
  pendingMounts?: Xg3PendingMount[];
  strikeGrants?: Xg3StrikeGrant[];
};
