import type { CardDefinition, Category } from "@rangers-strike/cards";
import type { ZordMaterialDestination } from "./actions";
import type { PendingChase } from "./keywords";
import type { PlayerCostWindows } from "./costWindow";
import type { ScopedModifier } from "./scopedModifiers";

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
  | "operation"
  | "exile"
  | "commander";

export type { CostWindow, CostWindowKind, CostWindowMetadata, PlayerCostWindows } from "./costWindow";
export type { PendingChase, WingBattleRule, CommanderZoneRule } from "./keywords";
export type { ScopedModifier, ModifierScope, RushPhaseRuleId, TurnRuleId } from "./scopedModifiers";
export { RUSH_PHASE_RULE_IDS, RESTRICTION_IDS, TURN_RULE_IDS } from "./scopedModifiers";

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
  /** ターン中の SP 上書き（例: オペで「SP1/4」になる）。 */
  spOverride?: import("@rangers-strike/cards").SpValue;
  /** バトル進入時に発動したNC効果ID（ターン終了時にクリア）。 */
  activatedNcEffects?: string[];
  /** バトルフェイズ: このターンにこのユニットがバトルまたはストライク済みなら true。 */
  battleActed?: boolean;
  /** このゾードがラッシュされた際に捨てた融合ユニット（RS-009 回収用）。 */
  zordMaterialCardId?: string;
  /** ラッシュでこのユニットが乗車しているビークル（RCサポート）。 */
  mountedOnInstanceId?: string;
  /** RS-013: このラッシュフェイズで使用済み（パーマネントな操作インスタンス）。 */
  shironLightUsedThisRush?: boolean;
  /** レジスト: バトル撃破後にホールド留場。 */
  registerHeld?: boolean;
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
  /** 除外ゾーン（ゲーム外。フレームワーク）。 */
  exile?: CardInstance[];
  /** コマンダーゾーン（フレームワーク）。 */
  commander?: CardInstance[];
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
  /** RS-013: このラッシュフェイズで手札ユニットを公開済み。カテゴリホールドなしでラッシュ可能。 */
  shironLightRushInstanceId?: string;
  /** ターン / フェイズスコープのルール・ステータス修飾子。 */
  modifiers?: ScopedModifier[];
  /** コスト支払いウィンドウ（hold-ready 統合）。 */
  costWindows?: PlayerCostWindows;
  /** RS-382: このターン捨札から手札に加えた S ユニット枚数。 */
  sUnitsRecoveredFromDiscardThisTurn?: number;
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
  /** RK-294 ブラッドベセル: モーフユニットを優先してダメージ支払い。 */
  bloodVesselPreferMorph?: boolean;
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

/** 敵ラッシュへのモーフ反応窓。 */
export type PendingMorph = {
  defenderPlayerId: PlayerId;
  rusherPlayerId: PlayerId;
  rushedInstanceId: string;
  phasePlayerId: PlayerId;
  morphUnitInstanceIds: string[];
  activeMorphUnitInstanceId?: string;
};

export type PendingLeave = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  fromZone: "rush" | "battle";
  toZone: "discard" | "power" | "command";
  leavingCardId: string;
  phasePlayerId: PlayerId;
  /** レジスト選択をスキップして捨札へ。 */
  skipRegister?: boolean;
  /** バトル BP 比較による撃破のみ true（効果撃破は false）。 */
  registerEligible?: boolean;
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
  | "shiron_light"
  | "simultaneous_order"
  | "confirm";

export type ShironLightMeta = {
  step: "pick" | "reveal";
  ownerId: PlayerId;
  operationInstanceId: string;
  pickedInstanceId?: string;
  audiencePlayerIds?: PlayerId[];
};

/** DSL choose 解決後に続行する primitive 列。 */
export type DslChoiceResume = {
  remaining: import("@rangers-strike/cards/dsl/types").EffectPrimitive[];
  context: {
    effectId: string;
    sourceCardId: string;
    playerId: PlayerId;
    phasePlayerId: PlayerId;
    operationInstanceId?: string;
    triggerSourceInstanceId?: string;
    discardOperation: boolean;
  };
  /** ラッシュ OP 解決後に捨札へ送るカード。 */
  operationCard?: CardInstance;
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
  /** DSL choose 解決後の続行データ。 */
  dslResume?: DslChoiceResume;
  /** キャストオフ: 山札からラッシュするカード名。 */
  castoffTargetName?: string;
  /** キャストオフ: MF ユニット instanceId（ゾードダウン素材）。 */
  castoffMfInstanceId?: string;
  /** ゾーンカテゴリ数制限: 目標カテゴリ数（ダイノスラスター等）。 */
  zoneCategoryTargetCount?: number;
  zoneCategoryBalanceOwnerId?: PlayerId;
  /** 破邪百獣剣: 撃破上限（敵コマンドゾーンのカテゴリ数）。 */
  zoneCategoryDestroyLimit?: number;
  zoneCategoryDestroyCount?: number;
  /** モーフ置換反応の再開用。 */
  morphMeta?: PendingMorph;
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
  /** up = ゾードアップ（+）、down = ゾードダウン（-）。 */
  direction?: "up" | "down";
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

/** バトル撃破時のレジスト選択待ち。 */
export type PendingRegister = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  fromZone: "battle";
  leavingCardId: string;
  phasePlayerId: PlayerId;
  followUpAttackerLeave?: PendingLeave["followUpAttackerLeave"];
  resumePendingStrike?: PendingLeave["resumePendingStrike"];
};

export type EffectStackFrameKind =
  | "leave_reaction"
  | "register_choice"
  | "strike_reaction"
  | "battle_reaction"
  | "morph_reaction"
  | "rush_reaction"
  | "damage_payment"
  | "effect_choice"
  | "battle_entry"
  | "command_payment"
  | "zord_setup";

export type EffectStackFrame = {
  id: string;
  kind: EffectStackFrameKind;
  /** 応答プレイヤー（未設定時はターンプレイヤーが解決）。 */
  actorPlayerId?: PlayerId;
  /** 同時解決グループID。同じIDのフレームは一括解決。 */
  simultaneousGroupId?: string;
  priority: number;
};

export type EffectStack = {
  frames: EffectStackFrame[];
};

export type GameState = {
  turn: number;
  activePlayer: PlayerId;
  /** 先攻プレイヤー（先攻）。 */
  firstPlayer: PlayerId;
  phase: Phase;
  /** エンドフェイズ内ステップ: 任意効果 → 確定。 */
  endPhaseStep?: "end_effects" | "finalize";
  /** 同時解決中の反応窓グループ ID（RULE-02）。 */
  activeSimultaneousGroupId?: string;
  /** ターンプレイヤーが選んだ反応窓の解決順（フレーム ID）。 */
  reactionResolutionOrder?: string[];
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
  /** 敵ラッシュへのモーフ反応窓。 */
  pendingMorph?: PendingMorph;
  /** ユニットがフィールドを離れる際の所有者応答。 */
  pendingLeave?: PendingLeave;
  /** チェイス: ライド中ユニット離場時のビークル乗り換え選択。 */
  pendingChase?: PendingChase;
  /** レジスト（バトル撃破時ホールド留場）の選択待ち。 */
  pendingRegister?: PendingRegister;
  /** 効果解決スタック（pending* から導出。優先順位の単一ソース）。 */
  effectStack?: EffectStack;
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
