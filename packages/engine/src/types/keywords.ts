import type { PendingLeave, PlayerId } from "./game";

/** Phase 6: チェイス（ライド乗り換え）反応窓。 */
export type PendingChase = {
  chaserPlayerId: PlayerId;
  chaserInstanceId: string;
  targetPlayerId: PlayerId;
  /** 捨てる現在のビークル。 */
  targetInstanceId: string;
  phasePlayerId: PlayerId;
  /** チェイス後に再開する離場意図。 */
  leaveIntent: PendingLeave;
  /** 乗り換え可能な自軍ラッシュのビークル instanceId。 */
  validVehicleInstanceIds: string[];
  /** rider_leave: ライダー離場時 / vehicle_destroyed: ビークル破壊時 */
  mode?: "rider_leave" | "vehicle_destroyed";
};
