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
  /** コマンドゾーン: カードの使用・ラッシュ等の支払いとしてホールドされた（R-CMD-01 再利用不可）。 */
  paymentHeld?: boolean;
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
  /** 常駐 OP: このラッシュフェイズで太字/発動効果を使用済み。 */
  residentActivatedThisRush?: boolean;
  /** 常駐 OP の上に重ねたカード（wiki: 常駐置き場の重ね）。 */
  stackedCards?: CardInstance[];
  /** RK-081 ゲゲル: このターン終了時に捨札にする。 */
  gegeruDiscardAtEnd?: boolean;
  /** XG3-069 カメンライド等: このターン終了時、自軍エリアにあれば捨札にする一時ユニット。 */
  tempDiscardAtTurnEnd?: boolean;
  /** レジスト: バトル撃破後にホールド留場。 */
  registerHeld?: boolean;
  /**
   * このターン「BP○○になる」（RK-154【頭が高い！】等）。ターン終了時にクリア。
   * ルール: R-BP-01 — 指定の値になる効果が最優先で、増減の計算は行わない。
   */
  bpSetValue?: number;
  /** XG1-048【エレキ光線】で選ばれたターン番号（そのターンを終えるとき隣のユニットが撃破される）。 */
  electroBeamTurn?: number;
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
  /** 直近のラッシュのカテゴリ支払いでホールドしたコマンド（コールのユニットを含む）。魔女バンドーラ等が参照。 */
  lastRushPayment?: { rushedInstanceId: string; holdInstanceIds: string[] };
  /** コマンダーゾーン（フレームワーク）。 */
  commander?: CardInstance[];
  /** 裏向きパワーカードは受けたダメージとしてカウント。 */
  damage: number;
  /** チャージフェイズ: このターンに1枚をパワーまたはコマンドに置いた後 true。 */
  hasChargedThisTurn?: boolean;
  /** damage_gate_battle_entry: 敵軍ターン中にダメージを受けた（自軍ターン終了で消える）。 */
  damagedOnEnemyTurn?: boolean;
  /** attack_and_strike_once: ユニットごとの今ターンの行動履歴。 */
  unitActionsThisTurn?: Record<string, { attacked?: boolean; struck?: boolean }>;
  /** 自軍バトルフェイズを終えた瞬間のバトルエリアの並び順（instanceId → 何番目）。R-TIME-07。 */
  battlePositionsAtBattleEnd?: Record<string, number>;
  /** ラッシュフェイズごとに1度だけの起動効果を、このラッシュフェイズで使用済みのユニット instanceId。 */
  fieldAbilityUsedThisRush?: string[];
  /** スタートフェイズ: このターンの必須ドロー後 true。 */
  hasDrawnThisStart?: boolean;
  /** スタートフェイズ: このターンに追加ドロー済み（1ターンに1度だけ。page-123 Q1）。 */
  hasBonusDrawnThisStart?: boolean;
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
  /** 引くべきときに山札から引けなかった（デッキアウト敗北。公式FAQ RS-027 Q4）。 */
  deckedOut?: boolean;
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
  /** RK-086 アカネタカ: このダメージで使用済み（1つのタイミングに1枚だけ）。 */
  akanetakaUsed?: boolean;
  /** RK-086 アカネタカ: かわりにダメージにした枚数（totalDamage には含めない）。 */
  replacedDamage?: number;
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
  /**
   * deck_top: 持ち主の山札の上（ピンクストーム等。R-MOVE-01）。
   * battle: 効果でラッシュエリアからバトルエリアへ移される（ピットインダイブ。R-MOVE-01 — 移動も「場を離れる」）。
   */
  toZone: "discard" | "power" | "command" | "deck_top" | "battle";
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
    toZone: PendingLeave["toZone"];
    leavingCardId: string;
    phasePlayerId: PlayerId;
  };
  /** RS-052: WB味方が破壊される際の任意代用。 */
  superShieldInstanceId?: string;
  /** RS-009: Lユニットが捨札に到達したときのみ合体パーツを戻す。 */
  fusionReturnOnDiscard?: "battle";
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
  | "confirm"
  | "declare_number"
  | "pick_effect_branch";

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
  /** この選択の解決後に続けて開く選択（割り込んだ誘発効果の後で元の効果を再開する。R-TIME-04）。 */
  resumeChoice?: PendingEffectChoice;
  /** 複数対象の撃破で処理済みの対象（離場反応で中断→再開したときに同じユニットを再び処理しない。R-TGT-03）。 */
  processedInstanceIds?: string[];
  optional?: boolean;
  maxBp?: number;
  /** RS-178 sagas_sniper: デッキサーチ用の破壊ユニットパワーコスト上限。 */
  maxPowerCost?: number;
  /** 印刷BPの合計上限（例: RS-106 ジュウクンドー）。 */
  bpBudget?: number;
  unitDestination?: "power" | "discard" | "deck_top" | "hand" | "hand_from_discard" | "hand_from_power" | "rush_from_discard" | "enemy_battle" | "enemy_command" | "swap_battle" | "rush" | "vehicle_battle_without_ride";
  commandAction?: "discard" | "hold" | "return_hand" | "return_deck_top" | "rush" | "rush_silent" | "battle_silent" | "power" | "release" | "sp_half";
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
  magiBlueMeta?: { drewAny: boolean };
  /** RS-412 冥府神スフィンクス: パワー数字クイズ。 */
  sphinxQuizMeta?: {
    step: "pick_power" | "declare" | "destroy";
    controllerId: PlayerId;
    powerInstanceId: string;
    actualPowerCost: number;
  };
  /** RS-472 現場への搬送: コマンド捨て→山札サーチ。 */
  siteTransportMeta?: {
    step: "discard" | "deck";
    feature: string;
    discardCount: number;
  };
  /** BK 等: 効果分岐の primitive 列。 */
  choiceBranchMeta?: {
    branchPrimitives: import("@rangers-strike/cards/dsl/types").EffectPrimitive[][];
  };
  /** SR-006 超忍法・分身魔球: 山札公開差し替え。 */
  shurikenMeta?: {
    step: "confirm" | "pick_hand";
    revealedInstanceId: string;
    resume: PendingEffectChoice;
  };
  /** BK/RK: 手札・常駐・山札からラッシュ配置。 */
  handResidentRushMeta?: {
    feature: string;
    drawIfFromHand?: boolean;
    shuffleIfFromDeck?: boolean;
    residentIds?: string[];
  };
  skipShurikenIntercept?: boolean;
  /** RS-322 人身略取: 相手が満たす追加条件の進行。 */
  abductionMeta?: { payerId: PlayerId; cardId: string; remaining: number };
  /** 敵ターン撃破時の任意パワー送り（to_power_on_destroy）。 */
  toPowerOnDestroyMeta?: {
    card: CardInstance;
    fromZone: "rush" | "battle";
    pendingLeave: PendingLeave;
  };
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
  /** RS-451: 可能ならこのユニットへアタックする。 */
  requiredDefenderInstanceId?: string;
};

/** ライドしたままバトル進入後、RC 発動のためのライドオフ選択。 */
export type PendingRideOffChoice = {
  playerId: PlayerId;
  instanceId: string;
  phasePlayerId: PlayerId;
  vehicleInstanceId: string;
  battleEntry: PendingBattleEntry;
};

export type CommandPaymentContinuation =
  | { type: "move_to_battle"; rideOff?: boolean }
  | {
      type: "rush";
      zordMaterialInstanceId?: string;
      zordMaterialInstanceIds?: string[];
      zordMaterialDestination?: "command" | "discard";
      zordMothershipHoldInstanceIds?: string[];
      zordExtraCommandHoldInstanceIds?: string[];
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
  /** 複数体の素材が必要な追加条件（「2体をそれぞれ」）で選び終えた素材。 */
  chosenMaterialIds?: string[];
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
  /**
   * ルール: R-CTR-03 — カウンターを発動できないプレイヤー（パンサークロー等）。
   * アタック宣言からそのアタックの処理が終わる（次の宣言のタイミング）まで有効。
   */
  counterLockedPlayerId?: PlayerId;
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
  /**
   * 「ラッシュしたとき」の効果の解決（選択）待ちのため、まだ開いていない「ラッシュされたとき」の反応
   * （モーフ・カウンター）。選択がすべて終わった時点で開く（R-TIME-01, R-KW-MORPH-01）。
   */
  deferredRushReaction?: { rusherPlayerId: PlayerId; rushedInstanceId: string; phasePlayerId: PlayerId };
  /** ユニットがフィールドを離れる際の所有者応答。 */
  pendingLeave?: PendingLeave;
  /** チェイス: ライド中ユニット離場時のビークル乗り換え選択。 */
  pendingChase?: PendingChase;
  /** バトル進入後・アタック/ストライク前のライドオフ選択（RC）。 */
  pendingRideOffChoice?: PendingRideOffChoice;
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
  /**
   * スタートフェイズ: 「すべて戻す」で、まだバトルエリアに残っていて順に戻す予定のユニット。
   * 戻すたびに誘発効果を解決してから次を戻す（R-START-01, RS-135 FAQ）。
   */
  pendingStartReturnQueue?: string[];
  /**
   * エンドフェイズ: 「ターンを終えるとき」の効果を処理中（まだ終えるプレイヤーのターン）。
   * 選択待ちで中断したら、解決後にここから再開する（R-END-01）。
   */
  turnEndProgress?: TurnEndProgress;
  /**
   * 効果でラッシュエリアに出たが、先に解決すべき操作待ちがあり「ラッシュしたとき」の誘発と
   * 「ラッシュされたとき」の窓をまだ処理していないユニット（出た順）。
   * ルール: R-RUSH-22, R-RUSH-30
   */
  effectRushTriggerQueue?: EffectRushTrigger[];
  /**
   * このアクション中にエリアへ出たが、効果ラッシュの後処理（ラッシュ記録・誘発）の対象外とするユニット
   * （モーフ等の置き換え。置き換え側の処理で扱う）。applyAction の後処理で消える。
   */
  fieldEntryHandledIds?: string[];
  /** 「選んだ1枚ごとにラッシュエリアに出す」効果の進行（R-RUSH-21, R-RUSH-23）。 */
  pendingEffectRush?: PendingEffectRush;
};

export type EffectRushTrigger = {
  rusherPlayerId: PlayerId;
  instanceId: string;
  phasePlayerId: PlayerId;
  /** R-RUSH-24: 出たユニット自身の効果は発動しない。 */
  silent?: boolean;
  /**
   * 誘発は解決済みで、「ラッシュされたとき」の窓（モーフ・カウンター）だけが残っている
   * （「ラッシュしたとき」の効果の選択待ちの後に開く、R-RUSH-30）。
   */
  windowOnly?: boolean;
};

/** 効果でラッシュエリアに出せるカードの置き場。 */
export type EffectRushSourceZone = "command" | "hand" | "discard" | "power";

export type PendingEffectRush = {
  /** 出すユニットの持ち主。 */
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  effectId: string;
  sourceCardId: string;
  sourceInstanceId?: string;
  fromZone: EffectRushSourceZone;
  /** R-RUSH-21: 「ただし、ラッシュするための必要パワーと追加条件は満たすこと」。 */
  requireConditions: boolean;
  /** 選び終えて、まだ出していないユニット（1体ずつ出す）。 */
  queue: string[];
  /** 選ぶ段階: 候補とあと何枚選べるか。 */
  picking?: { candidates: string[]; remaining: number };
  /** 追加条件を実行中のユニット。 */
  current?: {
    instanceId: string;
    direction: "up" | "down";
    needed: number;
    chosen: string[];
    destination?: "command" | "discard";
  };
};

export type TurnEndProgress = {
  endingPlayerId: PlayerId;
  /** まだ処理していない「ターンを終えるとき」の常駐（持ち主と instanceId）。 */
  residentQueue: Array<{ ownerId: PlayerId; instanceId: string }>;
  /** 常駐以外の「ターンを終えるとき」の効果を処理済みか。 */
  restDone: boolean;
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

/** 引くべきときに引けなかったプレイヤーはデッキアウトで敗北する（効果によるドローを含む）。 */
export function hasLostByDeckOut(player: PlayerState): boolean {
  return player.deckedOut === true;
}
