/**
 * クロスギャザー ザ・Wインパクト（XG3）の状態の型（types/game.ts の GameState.xg3・PendingEffectChoice.xg3Meta）。
 */
import type { PendingLeave, PlayerId } from "../../types/game";

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
  /** 場を離れる処理の続き（XG3-101【逆転チェスト】）。 */
  leave?: PendingLeave;
  /** バトルの続き（XG3-091【パルセイバー】）。 */
  battle?: import("../../types/game").PendingBattle;
};

/** ラッシュエリアに出たユニットを、ビークルにライドさせる処理待ち（XG3-002【宇宙を走る車】）。 */
export type Xg3PendingMount = { ownerId: PlayerId; unitInstanceId: string; vehicleInstanceId: string; moveVehicle?: boolean };

/** コンビネーションで得た「これがストライクしたとき」の能力（XG3-018【暴れ独楽】・XG3-019【カラクリボール奪還】）。 */
export type Xg3StrikeGrant = { ownerId: PlayerId; instanceId: string; partnerInstanceId: string; sourceCardId: string; turn: number };

/** このターンだけの BP・SP の変化（XG3-029【ウルサーベル】等）。 */
export type Xg3TurnBuff = { instanceId: string; turn: number; bp?: number; sp?: number };

export type Xg3State = {
  pendingMounts?: Xg3PendingMount[];
  strikeGrants?: Xg3StrikeGrant[];
  turnBuffs?: Xg3TurnBuff[];
  /** XG3-031【宙宙斬】を発動したターン（そのターン、自軍バトルエリアの2番目の「激気」M ユニットは「SP1」）。 */
  gekiBlue?: Array<{ ownerId: PlayerId; turn: number }>;
  /** XG3-037【烏賊墨砲】で「アタックされない」テキストが無効になったユニット（そのターン）。 */
  noAttackTextDisabled?: Array<{ instanceId: string; turn: number }>;
  /** XG3-033【隙間より這い出す者達】でそのターンに出した数。 */
  nanashi?: Array<{ ownerId: PlayerId; turn: number; count: number }>;
  /** XG3-024・XG3-025 で、ラッシュフェイズを行うかわりに効果を発動したターン（そのラッシュフェイズの行動はもうできない）。 */
  rushPhaseReplaced?: { ownerId: PlayerId; turn: number };
  /** XG3-045【超電稲妻キック】を得たユニット（そのターン）。 */
  choudenKick?: Array<{ instanceId: string; turn: number }>;
  /** XG3-067 インビジブル: 自軍ラッシュエリアに置いたこのカードと、重ねたユニット。 */
  invisible?: Array<{ ownerId: PlayerId; cardInstanceId: string; unitInstanceId: string }>;
  /** XG3-091: RC か「昆虫」からのコンビネーションで出たターン（そのターン【パルセイバー】を発動できる）。 */
  pulseSaber?: Array<{ instanceId: string; turn: number }>;
  /** XG3-099【RKバー】で選んだ敵軍ユニット（持ち主の次のターン、アタックもストライクもできない）。 */
  rkBar?: Array<{ ownerId: PlayerId; instanceId: string; turn: number }>;
  /** XG3-101【逆転チェスト】: RC したターン（次の相手ターン中に1度だけ発動できる）。 */
  chest?: Array<{ ownerId: PlayerId; instanceId: string; turn: number; used?: boolean }>;
  /** XG3-103【噛みつき】で S ユニットとして扱うターン。 */
  raijingo?: Array<{ instanceId: string; turn: number }>;
};
