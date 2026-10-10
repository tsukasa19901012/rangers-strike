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

export type JointComboGrant = {
  kind: "l" | "r";
  /** 効果を持つカード（L/R ナンバーのカード）の名前つき効果 id。 */
  effectId: string;
  sourceCardId: string;
  /** コンビネーションの相手（kind "l" は L ナンバーのカード、kind "r" は左隣の L ユニット）。 */
  partnerInstanceId: string;
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
  /** RS-222【戦闘指揮】で成立させた NC の効果を発動するときにリリースする敵軍コマンドの数（【ジュウクンドー】）。 */
  battleCommandReleaseCost?: number;
  /**
   * ジョイントコンビネーション（JC）が成立して、このユニットが得た能力／発動した効果（R-CN-06）。
   * L ナンバーのカードから得た能力（kind "l"）は、得た後は L ナンバーのカードが離れても有効
   * （faq-card-3 RS-167 Q1）。R ナンバーの「このコンビネーションが成立している間」の効果（kind "r"）は、
   * partnerInstanceId のユニットが左隣にいる間だけ有効。バトルエリアに出直すと消える。
   */
  jointComboGrants?: JointComboGrant[];
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
  /** damage_gate_battle_entry: ターン開始時のウラ向きパワー（ダメージ）の枚数（効果で置かれたダメージの検出用）。 */
  faceDownPowerAtTurnStart?: number;
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
  /** RS-184 マジパンチを使った（ストライクしたユニットは手札に戻った）。続けて同じストライクに使える。 */
  magiPunchApplied?: boolean;
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
  /** RS-215【不滅のマシン帝国】の選択をこのアタックで既に出したか。 */
  machineEmpireOffered?: boolean;
  /**
   * アタックしたユニットの「アタックするとき／アタックしたとき」（DSL on_attack）を、「アタックされたとき」の
   * 反応（カウンター等）より前に解決済みか（R-TIME-01。core/applyAction.ts continueAttackAfterDeclaration）。
   */
  onAttackResolved?: boolean;
  /** RS-018: 代わりに代用ユニットが戦闘 */
  substituteInstanceId?: string;
  /** RS-131 mirage_beam: このバトル用の印刷BP上書き。 */
  mirageBeamBpOverride?: number;
  /** RS-131: バトル後に捨てるため公開したデッキカード。 */
  mirageBeamDiscard?: CardInstance;
  /** RS-131: アタックされたメッツラーの【ミラージュビーム】（faq-card-3 RS-131 Q1）— 防御側の BP 上書き。 */
  mirageBeamDefenderBpOverride?: number;
  /** RS-131: 防御側のメッツラーが公開したデッキカード（バトル後に防御側の捨札へ）。 */
  mirageBeamDefenderDiscard?: CardInstance;
};

export type PendingRush = {
  rusherPlayerId: PlayerId;
  rushedInstanceId: string;
  phasePlayerId: PlayerId;
  /**
   * 「ラッシュされたとき」のカウンターで応答するプレイヤー。カウンターは敵軍ターン中にのみ使えるので
   * ターンプレイヤーの相手（R-CTR-01）。相手の効果で自軍ユニットが出された場合（RS-284【スワンウィング】等）は
   * 持ち主が応答する。省略時はラッシュしたプレイヤーの相手（rushReactorId）。
   */
  reactorPlayerId?: PlayerId;
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
  /** RS-303【シティガーディアンズ隊長】の「かわりに捨札にしてもよい」を見送った（再度は尋ねない）。 */
  cityGuardiansDeclined?: boolean;
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
    discardAsDamage?: boolean;
  };
  /** RS-052: WB味方が破壊される際の任意代用。 */
  superShieldInstanceId?: string;
  /**
   * 撃破ではなく効果で捨札にする離場（RS-052【超シールド進化】でかわりに捨札になるトリケラ）。
   * 「場を離れるとき」の応答（ダイノガッツ等）は開くが、撃破の誘発・置換は起きない。ルール: R-REPL-01
   */
  notDestruction?: boolean;
  /** RS-324 マジマザー【ジルマ・マジュナ】: かわりに捨札にできる自軍ラッシュエリアのマジマザー。 */
  magiMotherInstanceIds?: string[];
  /** RS-317【超シールド進化】の選択を断った（同じ撃破で再び選択を開かない）。 */
  kasumoShieldDeclined?: boolean;
  /**
   * RS-182 ジャイアントローラー: 撃破されて捨札になったとき、持ち主のパワーゾーンにダメージ（ウラ向き）にして置く。
   * 置換・カウンターで捨札にならなければ置かれない（faq-card-4 RS-182 Q1〜Q3）。
   */
  discardAsDamage?: boolean;
  /** RS-009: Lユニットが捨札に到達したときのみ合体パーツを戻す。 */
  fusionReturnOnDiscard?: "battle";
  /**
   * バトルでこのユニットを撃破したユニット。離場の応答を待ったあと実際に撃破されたら、その「撃破したとき」
   * （R-TIME-01 段階 1。RS-312【雷撃斬】）を開く。
   */
  destroyedByInBattle?: { ownerPlayerId: PlayerId; instanceId: string };
};

/**
 * 相打ち（R-BTL-02）の処理順選択の続行データ。2 体の撃破は同時に起きた扱いで、
 * ターンプレイヤーが先に処理するユニットを選ぶ（R-SIM-01）。
 */
export type MutualDestructionMeta = {
  attackerPlayerId: PlayerId;
  attackerInstanceId: string;
  attackerCardId: string;
  defenderOwner: PlayerId;
  defenderCard: CardInstance;
  defenderIntent: PendingLeave;
  attackerIntent: PendingLeave;
  focusedBreakthroughQualifies: boolean;
};

/** ゲーム続行前にプレイヤーが対象/オプションを選ぶ必要がある。 */
export type SeabedDrawMeta = {
  drawCount: number;
  /** RS-014 超頭脳: 2枚目は手札ではなく捨札へ。 */
  superBrainDiscardSecond?: boolean;
  /** 「ひいて捨札にする」（RS-027 ダイノガッツ等）: ひいたカードを手札ではなく捨札に置く。 */
  toDiscard?: boolean;
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

/** 「アタックするとき、自軍コマンドを好きな数ホールド…1つにつき BP+」の効果（rules/attackHoldBonus.ts）。 */
export type AttackHoldSource = {
  sourceCardId: string;
  sourceInstanceId?: string;
  /** battle: このバトル中だけ（RS-019 超力）／turn: このターン（RK-186【Jパンチ】）。 */
  scope: "battle" | "turn";
};

/** 撃破に関わる誘発のタイミング（R-TIME-01）。PendingEffectChoice.destroyTriggerTiming を参照。 */
export type DestroyTriggerTiming = "destroyer" | "destroyed" | "after_discard";

/**
 * 撃破の誘発のうち、先の段階（R-TIME-01）の効果がすべて解決するまで待たせている処理（rules/destroyTriggerQueue.ts）。
 * - destroyed_fact: 2.「撃破されたとき」（撃破された側。自動処理・選択とも）
 * - after_discard: 4.「撃破されて捨札になったとき」「捨札になったとき」（撃破された側）
 * - mirage_knuckle: 4. RS-212【爆烈ミラージュナックル】（撃破した側。「捨札にしたあとで選ぶ」）
 * - resume_multi_destroy: 複数体を撃破する効果の残りの対象の撃破（割り込んだ誘発の解決後）
 */
export type DeferredDestroyTrigger =
  | { kind: "destroyed_fact"; step: DestroyTriggerTiming; ownerPlayerId: PlayerId; cardId: string }
  | {
      kind: "after_discard";
      step: DestroyTriggerTiming;
      ctx: {
        ownerPlayerId: PlayerId;
        instanceId: string;
        cardId: string;
        fromZone: "rush" | "battle";
        toZone: string;
        phasePlayerId: PlayerId;
        destroyed?: boolean;
      };
    }
  | {
      kind: "mirage_knuckle";
      step: DestroyTriggerTiming;
      attackerId: PlayerId;
      attackerInstanceId: string;
      phasePlayerId: PlayerId;
    }
  | {
      /**
       * 複数体を撃破する効果（select_units_bp_budget の確定）の続き。撃破されたユニットの誘発の選択が割り込んだら
       * （R-TIME-04）、その解決後に残りの対象を撃破する（rules/pendingChoices.ts applyConfirmEffectChoice）。
       */
      kind: "resume_multi_destroy";
      step: DestroyTriggerTiming;
      pending: PendingEffectChoice;
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
  /**
   * 2体を組で選ぶ選択の条件（RS-355【ブルースクリューキック】: 敵軍バトルエリアで隣り合う、BP の合計が bpSum の
   * size ユニット2体）。1体目を選ぶと、2体目の候補はその組の相手だけになる。
   */
  pairConstraint?: { adjacentZone: "battle" | "rush"; bpSum: number; size: "S" | "M" | "L" };
  unitDestination?: "power" | "discard" | "deck_top" | "operation" | "hand" | "hand_from_discard" | "hand_from_power" | "rush_from_discard" | "enemy_battle" | "enemy_command" | "swap_battle" | "rush" | "vehicle_battle_without_ride";
  /** RS-102【巌流剣】: 先に選んだ敵軍パワーゾーンのカード（コマンドを選んだあと2枚一緒に捨札にする）。 */
  darkDualBladePowerInstanceId?: string;
  commandAction?: "discard" | "hold" | "return_hand" | "return_deck_top" | "rush" | "rush_silent" | "battle_silent" | "power" | "release" | "sp_half";
  commandFilter?: "held" | "released" | "any";
  seabedDrawMeta?: SeabedDrawMeta;
  denjiMachineMeta?: DenjiMachineMeta;
  shironLightMeta?: ShironLightMeta;
  /** DSL choose 解決後の続行データ。 */
  dslResume?: DslChoiceResume;
  /** unitDestination "power" のとき、ウラ向き（ダメージ）にして置く（「パワーゾーンにダメージにして置く」）。 */
  placeAsDamage?: boolean;
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
  /** RS-183 黒子ロボの記憶操作の進行（使用者→相手、ドロー→山札に戻す手順）。 */
  kurokoMeta?: {
    initiatorId: PlayerId;
    actorId: PlayerId;
    stage: "draw" | "return";
    drawn: number;
    returnsLeft: number;
  };
  /** 相打ちの処理順選択（simultaneous_order。validInstanceIds は撃破された 2 体）。 */
  mutualDestructionMeta?: MutualDestructionMeta;
  /**
   * 撃破の誘発のうち同じ段階（R-TIME-01 / destroyTriggerTiming）の効果どうし（例: RS-212【爆烈ミラージュナックル】と
   * 撃破されたユニットの「撃破されて捨札になったとき」）の処理順（simultaneous_order。R-SIM-01。rules/destroyTriggerTiming.ts）。
   * 段階が違えば選択は開かず、段階の順に解決する。
   * validInstanceIds は [own.sourceInstanceId, existing を表す ID]。
   */
  battleDestroyOrderMeta?: {
    own: PendingEffectChoice;
    existing: PendingEffectChoice;
    existingId: string;
  };
  /**
   * 再開（resumeChoice）で開くときに候補を作り直す選択（rules/choiceRefreshers.ts registerChoiceRefresher）。
   * 他の処理を先に解決したあとで開く選択の候補が、その間に移動したカードを含まないようにする。
   */
  refreshOnOpen?: { key: string; destroyedBattleBp?: number };
  /**
   * 撃破に関わる誘発のタイミング（R-TIME-01・R-DESTROY-02。rules/destroyTriggerTiming.ts）。
   * "destroyer" = 1.「撃破したとき」（撃破した側）、"destroyed" = 2.「撃破されたとき」（撃破された側。捨札を問わない）、
   * （3. 捨札へ移動）、"after_discard" = 4.「撃破されて捨札になったとき」「捨札になったとき」。
   * 異なる段階の効果は同時ではなく、この順に解決する（ユーザー決定 2026-10-11。faq-card-4 RS-226 Q1）。
   */
  destroyTriggerTiming?: DestroyTriggerTiming;
  /**
   * 「ラッシュしたとき」に同時に発動した、ラッシュしたユニット自身の効果と RS-124 超電子レーダーの処理順
   * （simultaneous_order。validInstanceIds は "super_radar" とラッシュしたユニット）。faq-card-2 RS-092 Q1。
   */
  rushTriggerOrderMeta?: {
    ownerPlayerId: PlayerId;
    instanceId: string;
    zone: "rush" | "battle";
    viaEffect?: boolean;
  };
  /**
   * 「～してもよい」の任意効果を行うかどうかの確認（kind "confirm"）。confirm_effect_choice で行い、
   * skip_effect_choice で行わない。行うときの処理は rules/optionalEffects.ts の登録先。
   */
  mayConfirm?: boolean;
  /** RS-303【シティガーディアンズ隊長】: かわりに捨札にするかを選んでいる間、保留している離場。 */
  leaveIntentMeta?: PendingLeave;
  /** mayConfirm が DSL の任意効果（optional）のとき、行う効果の特定情報。 */
  optionalDslMeta?: { effectId: string; triggerType: string };
  /**
   * アタック時のホールド数選択（effectId attack_hold_bonus、kind declare_number）。
   * 選択後に続けるアタック（battle）と、残りの同種効果。
   */
  attackHoldMeta?: {
    battle: PendingBattle;
    wingAttackFromRush: boolean;
    scope: AttackHoldSource["scope"];
    remainingSources: AttackHoldSource[];
  };
  /** RS-317【超シールド進化】: 選択を開いた撃破（場を離れる処理）。 */
  kasumoShieldMeta?: { intent: PendingLeave };
  /** RS-196【迎撃モビルミサイル】: 発動を選んでいる間、保留しているストライク。 */
  mobilMissileStrike?: PendingStrike;
  /** RS-215【不滅のマシン帝国】: 手札2枚を選んだあと（または断ったあと）に続けるアタック。 */
  machineEmpireMeta?: {
    battle: PendingBattle;
    wingAttackFromRush: boolean;
  };
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
      zordMaterialDestinations?: Array<"command" | "discard">;
      zordMothershipHoldInstanceIds?: string[];
      zordExtraCommandHoldInstanceIds?: string[];
      /**
       * 「Sユニット2体をそれぞれ…」の一部を素材で満たし、残りを【母艦】ホールドで代える（RS-076 Q7・RS-075 Q2）。
       * カテゴリのホールドの後に、この数の母艦ホールドを選ぶ。
       */
      zordMothershipHoldsPending?: number;
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
  /** 「それぞれ」: 選び終えた素材ごとの行き先（chosenMaterialIds と同じ順）。 */
  chosenMaterialDestinations?: ZordMaterialDestination[];
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
  discardAsDamage?: boolean;
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
  // ルール: R-PRI-02 — 種類別の固定優先度（旧 priority 0〜10）は持たない。順序は rules/effectStack.ts 参照。
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
  /**
   * 支払い中に同時に発生した別のダメージ（例: 相討ちのアバレッド2体の自傷、アバレッドの自傷と【一点突破】）。
   * 先の支払いが終わったら順に処理する。すべて終わるまで勝敗は判定しない（R-WIN-02、faq-card-1 RS-054 Q4）。
   */
  queuedDamagePayments?: Array<{
    playerId: PlayerId;
    amount: number;
    resume: DamagePaymentResume;
    choosingPlayerId?: PlayerId;
    bloodVesselPreferMorph?: boolean;
  }>;
  /** 進入効果が先に選択を必要とするときに開く。 */
  deferredBattleEntry?: PendingBattleEntry;
  /**
   * 撃破の誘発を段階順（R-TIME-01）に解決するため、撃破した側の段階 1 の効果を処理する間だけ立てる。
   * 立っている間の撃破では、撃破された側の誘発を解決せず deferredDestroyTriggers に積む（rules/destroyTriggerQueue.ts）。
   */
  destroyTriggerHold?: boolean;
  /**
   * 「ストライクしたとき」の効果の選択を解決し終えるまで待たせているストライク（R-TIME-01）。
   * 解決後に「ストライクされたとき」（RS-196・カウンター窓）→ ダメージへ進む（core/applyAction.ts continueDeferredStrike）。
   */
  deferredStrike?: PendingStrike;
  /**
   * アタックしたユニットの「アタックしたとき」の選択を解決し終えるまで待たせているアタック（R-TIME-01）。
   * 解決後に「アタックされたとき」（RS-215・カウンター窓）→ バトルへ進む（core/applyAction.ts continueDeferredAttack）。
   */
  deferredAttack?: { battle: PendingBattle; wingAttackFromRush: boolean };
  /** 先の段階の効果（選択を含む）の解決待ちの撃破の誘発（R-TIME-01。rules/destroyTriggerQueue.ts）。 */
  deferredDestroyTriggers?: DeferredDestroyTrigger[];
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
  /** RS-325【マジチケット】で発動したオペレーション（捨札になるときの「かわりに」の選択待ち。rules/legend1/set5NamedEffects.ts）。 */
  magiTicketPending?: { playerId: PlayerId; instanceId: string };
  /**
   * 使用して手札を離れたが、効果の解決が選択待ち等で中断していてまだどのゾーンにも置かれていない
   * オペレーション（カウンターを含む）。解決が終わった時点で（効果が別のゾーンへ移していなければ）
   * 捨札（常駐なら常駐置き場）に置く（applyAction の後処理 settleResolvingOperations）。
   */
  resolvingOperations?: Array<{ playerId: PlayerId; card: CardInstance }>;
  /**
   * RS-265 ジェットシーカー【ラウンドレーダー】: 相手が手札からオペレーションを使用したときの「2枚まで選び捨札にしてもよい」で、
   * まだ処理していないもの（使用したオペレーションの解決が終わってから開く。ジェットシーカー1体につき1回）。
   */
  roundRadarQueue?: Array<{ ownerId: PlayerId; phasePlayerId: PlayerId }>;
  /**
   * RS-255 巨大化爆弾: 敵軍ターン中に「怪人」の自軍ユニットが撃破されて捨札になったときの使用の窓。
   * 持ち主は巨大化爆弾を使う（play_counter）か見送る（pass_leave_reaction）。
   */
  pendingGiantBomb?: { ownerId: PlayerId; unitInstanceIds: string[]; phasePlayerId: PlayerId };
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
export type EffectRushSourceZone = "command" | "hand" | "discard" | "power" | "deck";

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
  /** 「ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）」（RS-249 Vコマンダー）。 */
  ignorePowerCost?: boolean;
  /** 「この効果でラッシュしたユニットは、このターン、バトルエリアに出られない」（RS-180 ライドラプター）。 */
  blockBattleEntryThisTurn?: boolean;
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
    /** RS-359 デンジ犬アイシー【最後の手段】で山札から捨札にして「捨札にしたことにした」素材の数。 */
    icyCount?: number;
    /** デンジ犬アイシーを捨札にして、山札から素材のカードを選んでいる途中のアイシー。 */
    icyPending?: string;
  };
};

export type TurnEndProgress = {
  endingPlayerId: PlayerId;
  /** まだ処理していない「ターンを終えるとき」の常駐（持ち主と instanceId）。 */
  residentQueue: Array<{ ownerId: PlayerId; instanceId: string }>;
  /** 常駐以外の「ターンを終えるとき」の効果を処理済みか。 */
  restDone: boolean;
  /**
   * RS-216 エグゾスの※と RS-310 ゴウライビートルの撃破の処理順の選択を済ませたか（faq-card-5 RS-310）。
   * exodusFirst が true ならエグゾスの※を先に処理する。
   */
  exodusOrderAsked?: boolean;
  exodusFirst?: boolean;
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
