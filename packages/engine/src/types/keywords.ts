import type { PendingLeave, PlayerId } from "./game";

/** ウイング関連のバトルルール識別子（Phase 6 スタブ）。 */
export type WingBattleRule = "empty_battle_strike" | "attack_enemy_rush";

/** コマンダーゾーン関連ルール識別子（Phase 6 スタブ）。 */
export type CommanderZoneRule = "commander_defeat";

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
  /** RS-322【人身略取】の追加条件で捨札にするときのチェイス: 応答の後に追加条件の続きを行う（rules/abduction.ts）。 */
  abductionResume?: { payerId: PlayerId; cardId: string; remaining: number };
};
