import type { CardDefinition, Category } from "@rangers-strike/cards";
import type { ZordMaterialDestination } from "./actions";

export type PlayerId = "player1" | "player2";

export type Phase =
  | "start"
  | "charge"
  | "rush"
  | "battle"
  | "end";

export type ZoneName =
  | "deck"
  | "hand"
  | "discard"
  | "power"
  | "command"
  | "rush"
  | "battle"
  | "operation";

/** プレイヤーのターン終了時にクリアされるターン修飾子。 */
export type TurnModifiers = {
  /** RS-015: コンボ番号の減少（スタック）。 */
  comboNumberDelta: number;
  /** RS-001 / RS-002: バトルがSのみコンボのときのフィニッシャー強化。 */
  sComboFinisher?: "goren_storm" | "jacker_hurricane";
  /** RS-003: このターン再びバトルに入れないユニット。 */
  battleBlockedInstanceIds: string[];
  /** RS-013 / RS-071: このラッシュフェイズで使用済み。 */
  shironLightUsed: boolean;
  hidoraEggUsed?: boolean;
  /** RS-072: 相手のパーマネント無効化、相手はカウンター不可。 */
  infiniteChainActive?: boolean;
  /** RS-107: 相手のカウンターホールドが捨札になる。 */
  deaceSniperActive?: boolean;
  /** RS-110: 新たにラッシュしたユニットはターン終了までバトルに入れない。 */
  zenibombActive?: boolean;
  /** このターンにラッシュしたインスタンスID（RS-106 / RS-090 制限）。 */
  rushedThisTurnInstanceIds?: string[];
  /** RS-094: バトル用ゴースト吸収BP上書き。 */
  ghostAbsorptionBp?: Record<string, number>;
  /** RS-119: シフトアップSP1付与。 */
  shiftUpSp1InstanceIds?: string[];
  /** RS-011: このターンの自ダメージごとにSユニットがBP+2000。 */
  auraPowerInstanceId?: string;
  /** RS-123: 攻撃時、自分のSユニットは守り側の印刷BPを使用。 */
  superDynamiteActive?: boolean;
  /** RS-158 baki_baki: 追加バトル攻撃が可能（ストライク不可）。 */
  bakiBakiExtraAttackIds?: string[];
};

export type CardInstance = {
  instanceId: string;
  cardId: string;
  /** 一時的なBP変更（ターン終了時にクリア）。 */
  bpModifier?: number;
  /** コマンドゾーン: true = ホールド（横向き）、false/undefined = リリース。 */
  commandHeld?: boolean;
  /** 母艦ゾード支払いによるホールド。融合バトル進入ホールドの※要件は満たさない。 */
  mothershipHold?: boolean;
  /** パワーゾーン: true = 裏向き（ダメージマーカー）。 */
  faceDown?: boolean;
  /** 一時的なSP変更（ターン終了時にクリア）。 */
  spModifier?: number;
  /** バトルフェイズ: このターンにこのユニットがバトルまたはストライク済みなら true。 */
  battleActed?: boolean;
  /** このゾードがラッシュされた際に捨てた融合ユニット（RS-009 回収用）。 */
  zordMaterialCardId?: string;
  /** ラッシュでこのユニットが乗車しているビークル（RCサポート）。 */
  mountedOnInstanceId?: string;
  /** RS-013: このラッシュフェイズで使用済み（パーマネントな操作インスタンス）。 */
  shironLightUsedThisRush?: boolean;
};

export type PlayerState = {
  id: PlayerId;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  power: CardInstance[];
  command: CardInstance[];
  rush: CardInstance[];
  battle: CardInstance[];
  operation: CardInstance[];
  /** 裏向きパワーカードは受けたダメージとしてカウント。 */
  damage: number;
  /** チャージフェイズ: このターンに1枚をパワーまたはコマンドに置いた後 true。 */
  hasChargedThisTurn?: boolean;
  /** スタートフェイズ: このターンの必須ドロー後 true。 */
  hasDrawnThisStart?: boolean;
  /** スタートフェイズ: このターンにホールド中コマンドをリリースした後 true。 */
  hasReleasedCommandsThisStart?: boolean;
  /** スタートフェイズ: このターンにバトルユニットをラッシュに戻した後 true。 */
  hasReturnedBattleThisStart?: boolean;
  /** スタートフェイズ: このターンにRS-022 アップキープ支払い後 true。 */
  hasPaidEarthForceUpkeep?: boolean;
  /** ※バトル進入: 支払いでホールド済み（move_to_battle まで有効）。 */
  battleEntryHoldReady?: boolean;
  /** ラッシュ: カテゴリ支払いでホールド済み（rush 完了まで有効）。 */
  rushCategoryHoldReady?: boolean;
  /** カウンター: カテゴリ支払いでホールド済み（play_counter まで有効）。 */
  counterCategoryHoldReady?: boolean;
  /** RS-132: Sユニット捨札支払い済み（move_to_battle まで有効）。 */
  battleEntryRushDiscardReady?: boolean;
  /** RS-132: 直前に捨札にしたSユニットの cardId（反バイオ粒子砲判定用）。 */
  battleEntryDiscardedCardId?: string;
  /** RS-165: 手札捨札支払い済み（move_to_battle まで有効）。 */
  battleEntryHandDiscardReady?: boolean;
  /** RS-013: このラッシュフェイズで手札ユニットを公開済み。カテゴリホールドなしでラッシュ可能。 */
  shironLightRushInstanceId?: string;
  turnModifiers?: TurnModifiers;
};

export type PendingStrike = {
  strikerPlayerId: PlayerId;
  strikerInstanceId: string;
  damage: number;
  battlePhasePlayer: PlayerId;
  damageCancelled?: boolean;
  /** 守り側がこのストライクのダメージ支払いを完了した後に設定。 */
  damageApplied?: boolean;
};

export type DamagePaymentResume =
  | { kind: "none"; activePlayer: PlayerId }
  | { kind: "strike"; pending: PendingStrike };

/** ダメージ時に表向きパワーの裏返し対象を選ぶ支払い待ち。 */
export type PendingDamagePayment = {
  /** パワーゾーンのカードが裏返されるプレイヤー。 */
  playerId: PlayerId;
  /** カードを選ぶプレイヤー（省略時は playerId。RS-149 side_knuckle はストライカー）。 */
  choosingPlayerId?: PlayerId;
  /** まだ割り当てていない表向きパワーの裏返し枚数。 */
  remainingFlips: number;
  /** パワー裏返し後にデッキから引く裏向きパワー枚数。 */
  deckDraws: number;
  totalDamage: number;
  selectedFlipIds: string[];
  resume: DamagePaymentResume;
};

export type PendingBattle = {
  attackerPlayerId: PlayerId;
  attackerInstanceId: string;
  defenderPlayerId: PlayerId;
  defenderInstanceId: string;
  phasePlayerId: PlayerId;
  attackerBpBonus?: number;
  /** RS-006: バトルキャンセル、守り側はラッシュに戻る */
  battleCancelled?: boolean;
  /** RS-018: 代わりに代用ユニットが戦闘 */
  substituteInstanceId?: string;
  /** RS-131 mirage_beam: このバトル用の印刷BP上書き。 */
  mirageBeamBpOverride?: number;
  /** RS-131: バトル後に捨てるため公開したデッキカード。 */
  mirageBeamDiscard?: CardInstance;
};

export type PendingRush = {
  rusherPlayerId: PlayerId;
  rushedInstanceId: string;
  phasePlayerId: PlayerId;
};

export type PendingLeave = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  fromZone: "rush" | "battle";
  toZone: "discard" | "power" | "command";
  leavingCardId: string;
  phasePlayerId: PlayerId;
  /** ユニット退場後にストライク解決を再開（five-tech / plasma）。 */
  resumePendingStrike?: { damageCancelled: boolean };
  /** 1回のバトルで両プレイヤーのユニットが退場する場合、守り側の後に攻撃側をキュー。 */
  followUpAttackerLeave?: {
    ownerPlayerId: PlayerId;
    instanceId: string;
    fromZone: "rush" | "battle";
    toZone: "discard" | "power" | "command";
    leavingCardId: string;
    phasePlayerId: PlayerId;
  };
  /** RS-052: WB味方が破壊される際の任意代用。 */
  superShieldInstanceId?: string;
};

/** ゲーム続行前にプレイヤーが対象/オプションを選ぶ必要がある。 */
export type SeabedDrawMeta = {
  drawCount: number;
  /** RS-014 超頭脳: 2枚目は手札ではなく捨札へ。 */
  superBrainDiscardSecond?: boolean;
  /** 海底ドロー解決後にこの選択を完了（例: RS-115 任意ドロー）。 */
  resume?: {
    pending: PendingEffectChoice;
    detail: string;
  };
};

export type DenjiMachineMeta = {
  step: "reveal" | "order_bottom";
  /** 公開カードを閲覧できるプレイヤー（PvPでは使用者+相手）。 */
  audiencePlayerIds: PlayerId[];
  revealedInstanceIds: string[];
  /** 公開時点のカードスナップショット（相手UI表示用。確定後も参照可）。 */
  revealedCards?: CardInstance[];
  toHandInstanceIds: string[];
  toBottomInstanceIds: string[];
  /** デッキから除去された非Sカード、山札下順序待ち。 */
  limboBottomCards?: CardInstance[];
  /** 山札下順序: 先頭は残りデッキの直上、末尾がデッキ最下段。 */
  orderedBottomIds?: string[];
};

export type EffectChoiceKind =
  | "deck_top_or_bottom"
  | "seabed_draw"
  | "optional_deck_draw"
  | "denji_machine"
  | "select_unit"
  | "select_unit_step"
  | "select_command"
  | "select_commands"
  | "select_power"
  | "select_hand"
  | "scry_keep_one"
  | "pit_in_dive_order"
  | "select_units_bp_budget"
  | "end_turn_menu"
  | "shiron_light";

export type ShironLightMeta = {
  step: "pick" | "reveal";
  ownerId: PlayerId;
  operationInstanceId: string;
  pickedInstanceId?: string;
  audiencePlayerIds?: PlayerId[];
};

export type PendingEffectChoice = {
  playerId: PlayerId;
  effectId: string;
  sourceCardId: string;
  sourceInstanceId?: string;
  kind: EffectChoiceKind;
  phasePlayerId: PlayerId;
  validInstanceIds: string[];
  selectCount?: number;
  selectedInstanceIds?: string[];
  step?: "own" | "enemy";
  viewedInstanceIds?: string[];
  optional?: boolean;
  maxBp?: number;
  /** RS-178 sagas_sniper: デッキサーチ用の破壊ユニットパワーコスト上限。 */
  maxPowerCost?: number;
  /** 印刷BPの合計上限（例: RS-106 ジュウクンドー）。 */
  bpBudget?: number;
  unitDestination?: "power" | "discard" | "deck_top" | "hand" | "hand_from_discard" | "hand_from_power" | "enemy_battle" | "enemy_command" | "swap_battle" | "rush";
  commandAction?: "discard" | "hold" | "return_hand" | "rush" | "rush_silent" | "power";
  commandFilter?: "held" | "released" | "any";
  seabedDrawMeta?: SeabedDrawMeta;
  denjiMachineMeta?: DenjiMachineMeta;
  shironLightMeta?: ShironLightMeta;
};

/** @deprecated pendingEffectChoice を使用すること（ruin_survey）。 */
export type PendingScry = {
  playerId: PlayerId;
  scriedInstanceId: string;
  sourceCardId: string;
};

/** バトル進入後、攻撃側は攻撃/ストライク/パスを選ぶ必要がある。 */
export type EnterBattleResumeFrom = "conditional" | "nc" | "tail";

export type EnterBattleResume = {
  battlePosition: number;
  rideOff?: boolean;
  battleBeforeEnterInstanceIds: string[];
  from: EnterBattleResumeFrom;
};

export type PendingBattleEntry = {
  playerId: PlayerId;
  instanceId: string;
  phasePlayerId: PlayerId;
  /** コンボ選択解決後の残りバトル進入ステップ。 */
  resumeEnterBattle?: EnterBattleResume;
};

export type CommandPaymentContinuation =
  | { type: "move_to_battle"; rideOff?: boolean }
  | {
      type: "rush";
      zordMaterialInstanceId?: string;
      zordMaterialDestination?: "command" | "discard";
      zordMothershipHoldInstanceIds?: string[];
    }
  | {
      type: "play_operation";
      targetInstanceId?: string;
      extraInstanceId?: string;
    }
  | {
      type: "play_counter";
      substituteInstanceId?: string;
    }
  | { type: "effect_choice" };

export type PendingZordSetupStep = "material" | "destination" | "mothership";

/** コマンド支払いまたはラッシュ前のゾード素材/母艦ウィザード。 */
export type PendingZordSetup = {
  playerId: PlayerId;
  zordInstanceId: string;
  zordCardId: string;
  step: PendingZordSetupStep;
  validInstanceIds: string[];
  materialInstanceId?: string;
  /** send_s_unit_to_command_or_discard 時、素材選択前に選ぶ。 */
  materialDestination?: ZordMaterialDestination;
  /** このゾードでは母艦ホールドがSユニット素材の代用になる場合がある。 */
  mothershipAvailable?: boolean;
};

/** プレイヤーアクションの一部としてコマンドホールドを支払う（単独ホールド不可）。 */
export type PendingCommandPayment = {
  playerId: PlayerId;
  kind: "battle_entry" | "category_use" | "mothership_hold" | "effect_hold";
  sourceInstanceId: string;
  sourceCardId: string;
  /** ※バトル進入としてカウントする新規ホールド枚数の最小値（battle_entry のみ）。 */
  eligibleNeeded: number;
  /** 続行前にホールドする未ホールドコマンド枚数。 */
  totalNeeded: number;
  validInstanceIds: string[];
  categories?: Category[];
  prismSubstitute?: boolean;
  continuation: CommandPaymentContinuation;
};

export type GameState = {
  turn: number;
  activePlayer: PlayerId;
  /** 先攻プレイヤー（先攻）。 */
  firstPlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  definitions: Record<string, CardDefinition>;
  log: string[];
  winner: PlayerId | null;
  /** ストライク宣言後の守り側応答ウィンドウ。 */
  pendingStrike?: PendingStrike;
  /** 攻撃宣言後の守り側応答ウィンドウ。 */
  pendingBattle?: PendingBattle;
  /** 相手がラッシュした後の守り側応答ウィンドウ。 */
  pendingRush?: PendingRush;
  /** ユニットがフィールドを離れる際の所有者応答。 */
  pendingLeave?: PendingLeave;
  /** 効果の対象/オプション選択（「選んで」効果）。 */
  pendingEffectChoice?: PendingEffectChoice;
  /** バトル進入済み — 次の進入前に攻撃/ストライク/パス必須。 */
  pendingBattleEntry?: PendingBattleEntry;
  /** ホールドするコマンドを選び、続行アクションを実行。 */
  pendingCommandPayment?: PendingCommandPayment;
  /** ゾードラッシュ: 素材、行き先、コマンド支払いの順に選択。 */
  pendingZordSetup?: PendingZordSetup;
  /** ダメージ支払いで裏返す表向きパワーを選ぶ。 */
  pendingDamagePayment?: PendingDamagePayment;
  /** 進入効果が先に選択を必要とするときに開く。 */
  deferredBattleEntry?: PendingBattleEntry;
  /** @deprecated エイリアス — pendingEffectChoice を使用 */
  pendingScry?: PendingScry;
  /** スタートフェイズ: 一括戻し後の任意 battle→rush 効果（例: falcon_claw）。 */
  pendingBattleToRushQueue?: string[];
  pendingBattleToRushPhasePlayerId?: PlayerId;
};

export const INITIAL_HAND_SIZE = 7;
export const WIN_DAMAGE = 7;
/** 公式ルール: コマンドゾーンは最大5枚までホールド可能。 */
export const COMMAND_ZONE_MAX = 5;

export const PHASE_ORDER: Phase[] = [
  "start",
  "charge",
  "rush",
  "battle",
  "end",
];

export function nextPhase(current: Phase): Phase {
  const index = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length] ?? "start";
}

export function hasWonByDamage(player: PlayerState): boolean {
  return player.damage >= WIN_DAMAGE;
}

/** デッキアウトは必須ドロー失敗時に判定（applyAction の draw を参照）。 */
export function hasWonByDeckOut(_player: PlayerState): boolean {
  return false;
}
