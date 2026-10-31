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
  /**
   * RS-359 デンジ犬アイシー【最後の手段】: ラッシュの追加条件を満たすために山札から選べるカードを、手続きの間だけ
   * ラッシュエリアに置いたもの（素材に選ばれて捨札になれば「捨札にしたことにした」、選ばれなければ山札の元の位置に戻る。
   * rules/legend1/icyLastResort.ts）。値は山札での元の位置。
   */
  icyPhantomDeckIndex?: number;
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
  /**
   * このターン「Sユニットになる」（RK-154【頭が高い！】で選んだ M ユニット）。ターン終了時にクリア。
   * "L" は XG6-053 仮面ライダーアーク の※「これはLユニットになり」（条件を満たす間。rules/xg6/xg6cEffects.ts が行動の後に合わせる）。
   */
  sizeOverride?: "S" | "L";
  /** XG1-048【エレキ光線】で選ばれたターン番号（そのターンを終えるとき隣のユニットが撃破される）。 */
  electroBeamTurn?: number;
  /** XG7-001〜XG7-068 のこのターンだけの付与（クロス・ライドオフ不可。rules/xg7/xg7Types.ts）。 */
  xg7Turn?: import("../rules/xg7/xg7Types").Xg7CardTurn;
  /** RK-010 ハイブリッドエネルギー: 自分がターンを終えるときにオモテにした山札の上のカード（rules/rk/rk1NamedEffects.ts）。 */
  hybridRevealed?: boolean;
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
  /** 直近のラッシュの追加条件で捨札にしたカード（RS-437 白熱する実況「その追加条件で捨札にした合体ユニットのカード」）。 */
  lastZordDiscard?: { rushedInstanceId: string; instanceIds: string[] };
  /** RS-432 隠流マキビシ: 現在のバトルフェイズが始まったときに受けていたダメージ（「そのバトルフェイズ中に受けたダメージ」）。 */
  damageAtBattlePhaseStart?: number;
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
  /** XG6 の「ストライクをするとき」の選択を出したカード（rules/xg6/）。 */
  xg6Offered?: string[];
  strikerPlayerId: PlayerId;
  strikerInstanceId: string;
  damage: number;
  battlePhasePlayer: PlayerId;
  damageCancelled?: boolean;
  /** 守り側がこのストライクのダメージ支払いを完了した後に設定。 */
  damageApplied?: boolean;
  /** RS-184 マジパンチを使った（ストライクしたユニットは手札に戻った）。続けて同じストライクに使える。 */
  magiPunchApplied?: boolean;
  /** XG1-009【マスキークラッシュ】のダメージの置きかえを選ぶ機会を出した（rules/xg1/xg1aEffects.ts）。 */
  xg1StrikeReplaceOffered?: boolean;
};

export type DamagePaymentResume =
  | { kind: "none"; activePlayer: PlayerId }
  | { kind: "strike"; pending: PendingStrike };

/** 「ウラ返すとき」の効果の解決後に行う、パワーのウラ返し（ダメージ）。 */
export type DeferredPowerFlip = {
  playerId: PlayerId;
  /** ウラ返すパワーのカード。 */
  flipIds: string[];
  /** 山札の上からダメージにする枚数。 */
  deckDraws: number;
  totalDamage: number;
  damagedOnEnemyTurn: boolean;
  /** ダメージを受けたときの誘発に渡す点数とフェイズのプレイヤー。 */
  eventAmount: number;
  eventPhasePlayerId: PlayerId;
  resume: DamagePaymentResume;
  /** ストライクのダメージなら、ウラ返したあとでストライクの処理を終える。 */
  finishStrike: boolean;
  /** ストライクのダメージのうち、アカネタカ（RK-086）のカード自体をダメージにした点数（ストライク以外の方法のダメージ。RK-204）。 */
  replacedAmount?: number;
};

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

/** クロスギャザー XG2 の選択の続き（rules/xg2。カードごとの効果が型を決める）。 */
export type Xg2Meta = Record<string, unknown>;
/** クロスギャザー XG2 のカード固有の効果の状態（rules/xg2/xg2Core.ts）。 */
export type Xg2State = Record<string, unknown>;

export type PendingBattle = {
  /** XG6 の「アタックされたとき」等の選択を出したカード（rules/xg6/）。 */
  xg6Offered?: string[];
  attackerPlayerId: PlayerId;
  attackerInstanceId: string;
  defenderPlayerId: PlayerId;
  defenderInstanceId: string;
  phasePlayerId: PlayerId;
  attackerBpBonus?: number;
  /** このバトルの間だけ、アタックされたユニットの BP に加える値（RK-004 ギギの腕輪・RK-009 二人の世紀王）。 */
  defenderBpBonus?: number;
  /** XG3-091【パルセイバー】・XG3-097【キャプテンルーレット】のバトルの前の処理を済ませた（rules/xg3/xg3eEffects.ts）。 */
  xg3PulseDone?: boolean;
  xg3RouletteDone?: boolean;
  /** XG3-097【キャプテンルーレット】: お互いにこの数字でバトルする。 */
  xg3Values?: { attacker: number; defender: number };
  /** RS-006: バトルキャンセル、守り側はラッシュに戻る */
  battleCancelled?: boolean;
  /** RK-101【タイガーボンバー】の BP-3000 をこのバトルに適用済み（rules/rk/rk5UnitEffects.ts）。 */
  tigerBomberApplied?: boolean;
  /** RS-215【不滅のマシン帝国】の選択をこのアタックで既に出したか。 */
  machineEmpireOffered?: boolean;
  /** RK-188【地空人のエージェント】の選択をこのアタックで既に出したか（rules/rk/rk9UnitEffects.ts）。 */
  rk9BerryOffered?: boolean;
  /** RM-062 テントリーナ【リーナステッキ】の選択を出した（rules/rm/rm3Effects.ts）。 */
  rm3TentrinaOffered?: boolean;
  /** XG7-055【神出鬼没の疾風】の選択を出した（rules/xg7/xg7cEffects.ts）。 */
  xg7AttackedOffered?: boolean;
  /** XG1-084【人質と脅迫】・XG1-087【瞬間移動】の「アタックされたとき」の選択を出した（rules/xg1/xg1eEffects.ts）。 */
  xg1eAttackedOffered?: boolean;
  /** XG4-033【フリージングダガー】の選択を出したアタック（rules/xg4/xg4bEffects.ts）。 */
  xg4FreezeOffered?: boolean;
  /** XG4-073・XG4-074 のバトルの前の選択を出したカード（instanceId。rules/xg4/xg4dEffects.ts）。 */
  xg4BeforeBattleOffered?: string[];
  /** プロモーションカードの「アタックされたとき」の選択を出した（XP-016【赤い瞳に宿るもの】等。rules/promo）。 */
  promoAttackedOffered?: boolean;
  /** RS-414【ディオネを守る壁】の選択を出したか。 */
  dioneWallOffered?: boolean;
  /** RS-583【災いを受け止める覚悟】の「代わりに選ばれたことにする」選択をこのアタックで既に出したか。 */
  substituteTargetOffered?: boolean;
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
  /**
   * アタックではなく効果でバトルする（RS-508【ロードサーベル】「このユニットと選んだユニットでバトルする」）。
   * attacker は効果を使った側のユニット。BP の比較・撃破・バトルに勝ったとき／撃破したとき等の誘発はアタックのバトルと同じで、
   * アタックしたことにはならない（「アタックするとき」は発動せず、バトル済み（battleActed）にもならない）。
   */
  effectBattle?: boolean;
  /** RK-050 仮面ライダー裁鬼【音撃斬・閻魔裁き】: お互いにバトルする数字（rules/rk/rk3UnitEffects.ts）。 */
  rk050Mode?: "bp" | "power_cost" | "number";
  /** クロスギャザー XG2: バトルの前に発動を確かめ終えた効果（rules/xg2/xg2Core.ts tryOpenXg2BattleChoice）。 */
  xg2Asked?: string[];
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
  /**
   * ルール: R-TIME-03 — 同じ「ラッシュされたとき」の効果の解決（モーフ）に入った後は、新たに発動できない。
   * 解決に入る前（窓が開いた時点）に発動できたカウンターの instanceId だけを残す。未設定なら制限なし。
   */
  allowedCounterInstanceIds?: string[];
};

/** 敵ラッシュへのモーフ反応窓。 */
export type PendingMorph = {
  defenderPlayerId: PlayerId;
  rusherPlayerId: PlayerId;
  rushedInstanceId: string;
  phasePlayerId: PlayerId;
  morphUnitInstanceIds: string[];
  activeMorphUnitInstanceId?: string;
  /** 窓が開いた時点で発動できた「ラッシュされたとき」のカウンター（R-TIME-03）。 */
  counterInstanceIdsAtOpen?: string[];
  /** モーフを1つ以上解決した（効果の解決に入った。R-TIME-03）。 */
  morphResolved?: boolean;
};

/** ライダーEXP vol.2 RK-127〜RK-147 の選択の続き（rules/rk/rk7UnitEffects.ts）。 */
export type Rk7ChoiceMeta = {
  /** RK-128 の※: 撃破されて捨札になるところだった離場。 */
  intent?: PendingLeave;
  /** RK-131: 選んだ L ユニット・オモテにしたカード。 */
  targetInstanceId?: string;
  revealed?: string[];
  /** RK-141: 効果の持ち主・自分が行った回数・相手が行う残りの回数。 */
  owner?: PlayerId;
  done?: number;
  remaining?: number;
  /** RK-131: オモテにした枚数。 */
  count?: number;
  /** オモテにしたカード（RK-141 の1回分）。 */
  revealedId?: string;
};

export type PendingLeave = {
  /** RS-303【シティガーディアンズ隊長】の「かわりに捨札にしてもよい」を見送った（再度は尋ねない）。 */
  cityGuardiansDeclined?: boolean;
  /** XG7-001〜XG7-068 の離場の置換で見送ったもの・捨札のかわりに除外する（rules/xg7/xg7Effects.ts）。 */
  xg7Declined?: string[];
  xg7Exile?: boolean;
  /** XG6-031 ジョーカーアンデッドの※「自軍捨札を3枚選びゲームから除外すれば、その場に留まる」を見送った（rules/xg6/）。 */
  xg6StayDeclined?: boolean;
  /** RK-128 仮面ライダーレンゲルの※「かわりに…捨札にしてもよい」を見送った（再度は尋ねない）。 */
  rk7SubstituteDeclined?: boolean;
  ownerPlayerId: PlayerId;
  instanceId: string;
  fromZone: "rush" | "battle";
  /**
   * deck_top: 持ち主の山札の上（ピンクストーム等。R-MOVE-01）。
   * deck_bottom: 持ち主の山札の下（RS-489【宇宙忍法・箱次元】等。R-MOVE-01）。
   * battle: 効果でラッシュエリアからバトルエリアへ移される（ピットインダイブ。R-MOVE-01 — 移動も「場を離れる」）。
   */
  toZone: "discard" | "power" | "command" | "deck_top" | "deck_bottom" | "battle";
  leavingCardId: string;
  phasePlayerId: PlayerId;
  /** レジスト選択をスキップして捨札へ。 */
  skipRegister?: boolean;
  /** バトル BP 比較による撃破のみ true（効果撃破は false）。 */
  registerEligible?: boolean;
  /** バトルによる撃破のとき、バトルの相手のユニット（RS-453【激怒斬り】「ユニットサイズの違うユニットとバトルして撃破された時」）。 */
  battleOpponentInstanceId?: string;
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
    registerEligible?: boolean;
    battleOpponentInstanceId?: string;
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
  /** RS-502 バット・リー【忘我の中に修行あり】の選択を断った（rules/legend1/set7NamedEffectsD.ts）。 */
  batLeeDeclined?: boolean;
  /** RS-437 白熱する実況「下に重ねたウラ向きのカードを1枚捨札にすれば、その場に留まる」を見送った。 */
  liveCommentaryDeclined?: boolean;
  /** XG2 の「その場に留まる」を見送った効果（rules/xg2/xg2cEffects.ts。再度は尋ねない）。 */
  xg2Declined?: string[];
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
  /** "order_bottom" は旧手順（今は rules/deckOrder.ts の選択を使い、この値にはならない。旧 apps/web の表示用に残す）。 */
  step: "reveal" | "order_bottom";
  /** 公開カードを閲覧できるプレイヤー（PvPでは使用者+相手）。 */
  audiencePlayerIds: PlayerId[];
  revealedInstanceIds: string[];
  /** 公開時点のカードスナップショット（相手UI表示用。確定後も参照可）。 */
  revealedCards?: CardInstance[];
  toHandInstanceIds: string[];
  toBottomInstanceIds: string[];
  /** 旧: 山札下の順を選ぶ途中のカード（今は rules/deckOrder.ts の選択を使う。旧 apps/web の表示用に残す）。 */
  limboBottomCards?: CardInstance[];
  orderedBottomIds?: string[];
};

/** 「オモテにする／公開する」で公開されたカードの行き先。 */
export type RevealDestination =
  | "hand"
  | "deck_top"
  | "deck_bottom"
  | "discard"
  | "rush"
  | "power"
  | "command"
  /** 山札に戻してシャッフルした（「山札に戻してシャッフルする」）。 */
  | "deck_shuffle"
  | "stay";

/** 公開されたカード 1 枚分の記録（両プレイヤーが見られる公開情報）。 */
export type RevealedCardNotice = {
  instanceId: string;
  cardId: string;
  destination: RevealDestination;
  /** カードの持ち主（お互いの山札をオモテにする効果で RevealNotice.ownerId と違うとき）。省略時は RevealNotice.ownerId。 */
  ownerId?: PlayerId;
};

/**
 * 効果でカードをオモテにした（公開した）記録。両プレイヤーに見せる公開情報で、
 * UI は seq が変わったら公開カード・宣言・行き先を表示する（RK-135 潜行捜索ほか）。
 */
export type RevealNotice = {
  /** 公開ごとに 1 ずつ増える通し番号（UI が新しい公開を検出する用）。 */
  seq: number;
  /** 効果を使ったプレイヤー。 */
  playerId: PlayerId;
  /** 公開したカードの持ち主（山札の持ち主）。 */
  ownerId: PlayerId;
  /** 効果の発生源カード。 */
  sourceCardId?: string;
  /** 効果名（例: 潜行捜索）。 */
  effectLabel: string;
  /** どこから公開したか。 */
  from: "deck_top" | "deck_bottom" | "hand" | "power" | "discard";
  /** 数字を宣言した効果なら宣言した数字。 */
  declaredNumber?: number;
  /** 条件に一致したか（一致で行き先が変わる効果のみ）。 */
  matched?: boolean;
  cards: RevealedCardNotice[];
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

/** 撃破の時点で判定した「撃破された時」の誘発の情報（rules/leaveEffects.ts resolveDestroyedFactEffects）。 */
export type DestroyedFactInfo = { gekidoSources?: string[]; phasePlayerId?: PlayerId };

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
  | {
      kind: "destroyed_fact";
      step: DestroyTriggerTiming;
      ownerPlayerId: PlayerId;
      cardId: string;
      /** 撃破の時点で判定した、他のカードの「…ユニットが撃破された時」の発動元（RS-453【激怒斬り】）。 */
      battleDestroyInfo?: DestroyedFactInfo;
    }
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
    }
  | {
      /**
       * 撃破を含む効果の「その後、…」の続きの選択（RS-515【ゴーオンソード】の山札の下に戻す順番）。撃破の誘発・応答が
       * 割り込んだら、それらをすべて解決したあとに開く。
       */
      kind: "open_choice";
      step: DestroyTriggerTiming;
      pending: PendingEffectChoice;
    };

/** 第7弾 RS-432〜RS-452 の選択の続き（rules/legend1/set7NamedEffectsA.ts）。 */
export type Set7AChoiceMeta = {
  /** 続けて処理する対象（同時に戻ったユニット等）。 */
  queue?: string[];
  /** 残りの選択回数（「N体まで」）。 */
  remaining?: number;
  /** 置き換えを見送ったら続ける「場を離れる」処理。 */
  leave?: PendingLeave;
  /** 対象のカード名・数値などの補足。 */
  cardId?: string;
  amount?: number;
  /** バトルした相手（RS-450）。 */
  enemyInstanceId?: string;
  /** RS-441【コサックダンス】: ホールドするコマンドを選んだあとで自軍ラッシュエリアに出す手札のカード。 */
  handInstanceId?: string;
};

/**
 * ※タッグ「太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる」（R-KW-TAG-01。rules/legend1/set8NamedEffectsA.ts）。
 * hostCardId/hostOpId は効果を使っている常駐、boldCardId/boldOpId は実行する太字部分の常駐。
 */
export type TagChoiceMeta = {
  hostCardId: string;
  hostOpId: string;
  boldCardId?: string;
  boldOpId?: string;
  /** RS-521: バトルエリアに出たユニットのナンバー（数字でなければ -1）。 */
  number?: number;
  /** RS-525: 相手に見せた、合体を必要とする L ユニットのカード。 */
  revealedLId?: string;
  /** 太字部分の途中で選んだもの（RS-519 の「男」のユニット、RS-525 の1枚目のパワー、RS-609 の S ユニット）。 */
  picked?: string[];
  /** RK-239 ウエイクアップ！: ホールド状態でバトルエリアに出たユニット（「そうしたとき」にリリースする）。 */
  rk239EnteredId?: string;
};

/** RK-001〜RK-021 の選択の続き（rules/rk/rk1NamedEffects.ts）。 */
export type Rk1ChoiceMeta = {
  /** RK-002 V3ホッパー: まだ戻していない見たカード。picked は戻す場所を選んでいるカード。 */
  remainingIds?: string[];
  picked?: string;
  /** RK-018 ラウズカード: ラッシュエリアから選んだユニット。RK-020: 1体目に選んだユニット。 */
  first?: string;
  /** RK-011 第三の眼: 無効にするかを選んでいるカウンターの使用（使った側・アクション）と、退避した反応ウィンドウ。 */
  counterUserId?: PlayerId;
  counterAction?: unknown;
  stashed?: Pick<GameState, "pendingBattle" | "pendingRush" | "pendingLeave" | "pendingStrike" | "pendingGiantBomb">;
};

/** ライダーEXP vol.1 RK-022〜RK-042 の選択の続き（rules/rk/rk2UnitEffects.ts）。 */
export type Rk2ChoiceMeta = {
  /** RK-030 トライチェイサー: 見たカード。 */
  picked?: string;
  /** RK-042 ブランウイング: まだホールドするコマンドの数。 */
  remaining?: number;
};

/** ライダーEXP vol.1 RK-043〜RK-063 の選択の続き（rules/rk/rk3UnitEffects.ts）。 */
export type Rk3ChoiceMeta = {
  /** RK-047 轟鬼: 選んだ敵軍ユニット。RK-054 ガタックRF: 1体目に選んだユニット。RK-061 電王RF: 出すカード。 */
  target?: string;
  /** RK-047 轟鬼: ホールドするコマンドの数。 */
  need?: number;
  /** RK-050 裁鬼: 数字を選んでから解決するバトル。 */
  battle?: PendingBattle;
};

export type PendingEffectChoice = {
  /** ライダーEXP vol.1 RK-043〜RK-063 の選択の続き（rules/rk/rk3UnitEffects.ts）。 */
  rk3Meta?: Rk3ChoiceMeta;
  /** ライダーEXP vol.2 RK-085〜RK-105 の選択の続き（rules/rk/rk5UnitEffects.ts）。 */
  rk5Meta?: { owners?: PlayerId[] };
  /** ライダーEXP vol.2 RK-106〜RK-126 の選択の続き（rules/rk/rk6UnitEffects.ts）。 */
  rk6Meta?: { riderInstanceId?: string; lined?: boolean; remaining?: number };
  /** ライダーEXP vol.2 RK-127〜RK-147 の選択の続き（rules/rk/rk7UnitEffects.ts）。 */
  rk7Meta?: Rk7ChoiceMeta;
  /** ライダーEXP vol.2 RK-148〜RK-168 の選択の続き（rules/rk/rk8UnitEffects.ts）。 */
  rk8Meta?: { remaining?: number; picked?: string };
  /** ザ・マスクドライダーEXP vol.3 RK-190〜RK-210 の選択の続き（rules/rk/rk10UnitEffects.ts）。 */
  rk10Meta?: {
    /** RK-201: 効果の持ち主。 */
    owner?: PlayerId;
    /** RK-207: 与えるダメージ。 */
    remaining?: number;
    /** RK-208: クレインの窓（クレインの持ち主・ラッシュされたユニット）。 */
    crane?: { craneOwner: PlayerId; rushedOwner: PlayerId; rushedInstanceId: string };
    /** RK-208: 強制の「ラッシュしたとき」を実行する前に開いた窓。 */
    preRush?: boolean;
    /** RK-208: 発動を宣言した（答えた）元の選択と、その答え。 */
    held?: PendingEffectChoice;
    heldAction?: unknown;
  };
  /** ザ・マスクドライダーEXP vol.3 RK-211〜RK-231 の選択の続き（rules/rk/rk11UnitEffects.ts）。 */
  rk11Meta?: {
    /** RK-212・RK-214: 効果の持ち主（相手が選ぶ選択のとき）。 */
    owner?: PlayerId;
    /** RK-211: 与えるダメージ（撃破したユニットの本来の SP）。 */
    remaining?: number;
    /** RK-211: 撃破したユニット。RK-214: ホールドするもう1体。 */
    target?: string;
  };
  /** ザ・マスクドライダーEXP vol.3〜4 RK-232〜RK-252 の選択の続き（rules/rk/rk12UnitEffects.ts）。 */
  rk12Meta?: {
    /** RK-233・RK-244: 効果の持ち主（相手が選ぶ選択のとき）。 */
    owner?: PlayerId;
    /** RK-234: 戻したユニット。RK-251: 無効にするオペレーション。 */
    target?: string;
    /** RK-240: 数えた「イマジン」の数。 */
    count?: number;
    /** RK-250: 「ユニットでなくなるとき」の離場。 */
    intent?: PendingLeave;
    /** RK-251: 相手のオペレーションの使用（使わなければそのまま続ける）。 */
    operation?: { playerId: PlayerId; instanceId: string; targetInstanceId?: string; extraInstanceId?: string };
    /** RK-252: このカードを使用するためにホールドしたコマンド。 */
    paid?: string[];
  };
  /** ザ・マスクドライダーEXP vol.4 RK-253〜RK-273 の選択の続き（rules/rk/rk13UnitEffects.ts）。 */
  rk13Meta?: {
    /** 効果の持ち主（相手が選ぶ選択のとき）。 */
    owner?: PlayerId;
    /** RK-266: 残りの BP の合計・選べる残りの数。RK-273: 撃破する残りの数。 */
    budget?: number;
    remaining?: number;
    /** RK-255: 置く敵軍ユニット。RK-268: バトルしたユニット。RK-270: オモテにしたカード。 */
    target?: string;
    /** RK-260: まだ選んでいない、捨札にした重ねたカードの必要パワーの数字。 */
    costs?: number[];
    /** RK-272: 無効にするかを尋ねている RC（使ったプレイヤーとユニット）・NC（ユニット）。 */
    rc?: { playerId: PlayerId; card: CardInstance };
    nc?: string;
    /** RK-273: 手札に戻したユニットの数。 */
    count?: number;
  };
  /** ザ・マスクドライダーEXP vol.4 RK-274〜RK-294 の選択の続き（rules/rk/rk14UnitEffects.ts）。 */
  rk14Meta?: {
    /** 効果の持ち主（相手が選ぶ選択のとき）。 */
    owner?: PlayerId;
    /** RK-274: まだ戻していない見たカード。RK-283: これから選ぶプレイヤーの順。 */
    remainingIds?: string[];
    /** RK-274: 上か下を選んでいるカード。RK-275・RK-276: 敵軍ラッシュエリアに出したユニット。RK-293: ラッシュされたユニット。 */
    picked?: string;
    /** RK-279: 撃破に使える特徴の数の残り。RK-283: 撃破されたユニットの必要パワーの数字。 */
    budget?: number;
    /** RK-284: 撃破したユニットの BP と、このユニットの BP。 */
    targetBp?: number;
    selfBp?: number;
  };
  /** ザ・マスクドライダーEXP vol.4 RK-295〜RK-315 の選択の続き（rules/rk/rk15UnitEffects.ts）。 */
  rk15Meta?: {
    /** RK-296: 選べる必要パワーの数字の合計の残り。 */
    budget?: number;
    /** RK-298: 送る敵軍ユニット。RK-306: 選んだ自軍ユニット。RK-303: 撃破されたユニット。 */
    picked?: string;
    /** RK-305: 1つ目にリリースしたコマンドの本来のカテゴリ。 */
    categories?: string[];
  };
  /** ザ・マスクドライダーEXP vol.4 RK-316〜RK-335 の選択の続き（rules/rk/rk16UnitEffects.ts）。 */
  rk16Meta?: {
    /** RK-324: ダメージにする撃破したカード。RK-325: 山札に戻すコマンドのカード。 */
    picked?: string;
    /** RK-324: 撃破したカードの持ち主。 */
    owner?: PlayerId;
  };
  /** ベルトコレクション BK-001〜BK-019 の選択の続き（rules/bk/bk1Effects.ts）。 */
  bk1Meta?: {
    /** BK-006: 選んだ敵軍の「航空機」の M ユニット。 */
    enemy?: string;
  };
  /** クロスギャザー ザ・Wインパクト XG3 の選択の続き（rules/xg3/xg3Types.ts）。 */
  xg3Meta?: import("../rules/xg3/xg3Types").Xg3ChoiceMeta;
  /** スペシャルメタルエディション RM-043〜RM-062 の選択の続き（rules/rm/rm3Effects.ts）。 */
  /** クロスギャザー ザ・ベストパートナー XG7-001〜XG7-068 の選択の続き（rules/xg7/xg7Effects.ts）。 */
  xg7Meta?: import("../rules/xg7/xg7Types").Xg7ChoiceMeta;
  rm3Meta?: {
    /** RM-045: 相手がこれまでに選んだ敵軍 S ユニット。 */
    chosen?: string[];
    /** RM-045: 相手がいま選んでいる敵軍 S ユニット。 */
    current?: string;
    /** RM-062: 続けるアタック。 */
    battle?: PendingBattle;
    wingAttackFromRush?: boolean;
  };
  /** スペシャルメタルエディション RM-022〜RM-042 の選択の続き（rules/rm/rm2Effects.ts）。 */
  rm2Meta?: {
    /** RM-037: 相手の手札から選んだカード。 */
    handInstanceId?: string;
  };
  /** クロスギャザー XG5 の選択の続き（rules/xg5/xg5Types.ts）。 */
  xg5Meta?: import("../rules/xg5/xg5Types").Xg5ChoiceMeta;
  /** クロスギャザー XG1 の選択の続き（rules/xg1/xg1Effects.ts）。 */
  xg1Meta?: {
    /** 選んだユニット・カード（続きの処理の対象）。 */
    target?: string;
    /** 対象の持ち主。 */
    ownerId?: PlayerId;
    /** 選べる数・数え上げた数。 */
    count?: number;
    /** まだ処理していない段（カードごとの文字列）。 */
    steps?: string[];
    /** 保留しているバトル（アタックの途中で開いた選択）。 */
    battle?: PendingBattle;
    wingAttackFromRush?: boolean;
  };
  /** クロスギャザー ザ・ギガンティックタイタン XG6 の選択の続き（rules/xg6/）。 */
  xg6Meta?: Xg6ChoiceMeta;
  /** クロスギャザー ザ・ジェットアクセル XG4-001〜XG4-102 の選択の続き（rules/xg4/xg4Common.ts）。 */
  xg4Meta?: Record<string, unknown>;
  /** クロスギャザー XG2 の選択の続き（rules/xg2。中身はカードごとの効果が決める）。 */
  xg2Meta?: Xg2Meta;
  /** プロモーションカードの選択の続き（rules/promo。カードごとの値をモジュール側で読む）。 */
  promoMeta?: Readonly<Record<string, unknown>>;
  /** スペシャルメタルエディション RM-001〜RM-021 の選択の続き（rules/rm/rm1Effects.ts）。 */
  rm1Meta?: {
    /** RM-006: 選べる数（「メカ」「人型」の自軍ユニットの数）。 */
    limit?: number;
    /** RM-012: まだ発動していないカテゴリの効果。 */
    steps?: string[];
    /** RM-017: 見ている山札の上のカード。 */
    topInstanceId?: string;
  };
  /** RK-208【迎撃の毒矢】: この選択に答えたら（発動を宣言したら）クレインの窓を開く（rules/rk/rk10UnitEffects.ts）。 */
  rk10CraneWatch?: { craneOwner: PlayerId; rushedOwner: PlayerId; rushedInstanceId: string };
  /** ザ・マスクドライダーEXP vol.2〜3 RK-169〜RK-189 の選択の続き（rules/rk/rk9UnitEffects.ts）。 */
  rk9Meta?: {
    /** RK-174: 戻した RF のあとに置くプットオン本体。RK-180: 選んだビークル。RK-189: 残りの数。 */
    picked?: string;
    remaining?: number;
    /** RK-177: このターンにラッシュした、まだ選んでいない S ユニット。 */
    pendingIds?: string[];
    /** RK-188: 続けるアタック。 */
    battle?: PendingBattle;
    wingAttackFromRush?: boolean;
  };
  /** ライダーEXP vol.1 RK-001〜RK-021 の選択の続き（rules/rk/rk1NamedEffects.ts）。 */
  rk1Meta?: Rk1ChoiceMeta;
  /** ライダーEXP vol.1 RK-022〜RK-042 の選択の続き（rules/rk/rk2UnitEffects.ts）。 */
  rk2Meta?: Rk2ChoiceMeta;
  /** ※タッグの太字部分の入れ替え（rules/legend1/set8NamedEffectsA.ts）。 */
  tagMeta?: TagChoiceMeta;
  /** 第7弾 RS-432〜RS-452 の選択の続き（rules/legend1/set7NamedEffectsA.ts）。 */
  set7aMeta?: Set7AChoiceMeta;
  /** RS 以外のラインの効果の選択が使う記録（rules/legend1/otherLinesNamedEffects.ts）。 */
  otherLinesMeta?: { leave?: PendingLeave };
  /** 第9弾 RS-605〜RS-626 の選択の続き（rules/legend1/set9NamedEffectsA.ts）。 */
  set9aMeta?: Set9AChoiceMeta;
  /** RS-568 風雷丸【各々方、合体で御座る！】: 相手に見せた手札の L ユニットのカード（rules/legend1/set8NamedEffectsC.ts）。 */
  set8cRevealedInstanceId?: string;
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
  /**
   * 「山札を見て…」で選ぶ人が見ている山札のカード（表示だけ。解決には使わない。rules/deckLook.ts）。選べるカードの後ろに並ぶ。
   */
  deckLookInstanceIds?: string[];
  /** この選択の解決後に続けて開く選択（割り込んだ誘発効果の後で元の効果を再開する。R-TIME-04）。 */
  resumeChoice?: PendingEffectChoice;
  /** 複数対象の撃破で処理済みの対象（離場反応で中断→再開したときに同じユニットを再び処理しない。R-TGT-03）。 */
  processedInstanceIds?: string[];
  /**
   * 複数対象の撃破（select_units_bp_budget）で、捨札になるかわりに持ち主のパワーゾーンにダメージにして置く対象
   * （効果のバトルで RS-182 ジャイアントローラーの選んだユニットとバトルした側。rules/xg1/xg1cEffects.ts XG1-058）。
   */
  discardAsDamageInstanceIds?: string[];
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
  unitDestination?: "power" | "discard" | "deck_top" | "operation" | "hand" | "hand_from_discard" | "hand_from_power" | "rush_from_discard" | "enemy_battle" | "enemy_command" | "swap_battle" | "rush" | "vehicle_battle_without_ride" | "hold";
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
  /** RS-381【獅子の装光】: 解決後に続けるバトル進入（ライドオフの選択のかわりに発動した）。 */
  battleEntryResume?: PendingBattleEntry;
  /**
   * RS-429【暮らしの中に修行あり】: 「「MA」の自軍コマンドを１つホールドして」の支払いで、MA のコマンド1つのかわりに
   * WB のコマンド＋追加1つ（先に選んだ WB のコマンドが「ホールドしたコマンド」）をホールドしてもよい。
   */
  shifuSubstitute?: boolean;
  /** RS-418【炎の眼光】: RS-421【ソウル降臨】で発動する NC の効果を無効にするかの選択（見送れば発動する）。 */
  soulDescentMeta?: { controllerId: PlayerId; akaRedInstanceId: string; heldCardId: string };
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
  /**
   * 「山札の上から…をオモテにしてもよい」「次の効果を発動できる⇒山札の上から…」の、発動するかの確認（rules/revealGate.ts）。
   * true の間は「発動する」（confirm_effect_choice）と「発動しない」（skip_effect_choice）だけを選べ、候補の山札のカードは見せない。
   */
  revealGate?: boolean;
  /** revealGate の選択を、発動した後も見送れるようにする（「…選び、…してもよい」。rules/revealGate.ts gateReveal）。 */
  revealKeepsOptional?: boolean;
  /**
   * 「好きな順で山札の下（上）に戻す」の順を選ぶ選択（rules/deckOrder.ts）。ids は戻すカード（表示の並び）、to は山札の下か上か、
   * selectedInstanceIds が付けた番号の順（1番から）。undos は番号を外した・選び直した回数（上限あり）。then は確定した後の続き。
   */
  deckOrderMeta?: { ids: string[]; undos: number; to: "top" | "bottom"; then?: { key: string; data?: unknown } };
  /**
   * 「N枚まで選んで好きな順で山札の下（上）に戻す」の、戻すカードを1枚ずつ選んでいる選択。選んだカード（processedInstanceIds）は
   * 山札の下（上）に置いてあり、見送ったときはそれらの順を選ぶ選択（deckOrderMeta）を開く（rules/deckOrder.ts closeWithDeckOrder）。
   */
  pickThenDeckOrder?: "top" | "bottom";
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
  /** 第7弾 RS-495〜RS-515 の選択の続行データ（rules/legend1/set7NamedEffectsD.ts）。 */
  set7dMeta?: Set7DMeta;
  /** 第8弾 RS-582〜RS-604 の選択の続行データ（rules/legend1/set8NamedEffectsD.ts）。 */
  set8dMeta?: Set8DMeta;
  /** 第8弾 RS-538〜RS-559 の選択の続行データ（rules/legend1/set8NamedEffectsB.ts）。 */
  set8bMeta?: {
    /** 1体ずつ選ぶ効果で選び終えたユニット。 */
    selected?: string[];
    /** 合計の上限。 */
    budget?: number;
    /** 山札の下に戻す順番を選んでいるカードの持ち主。 */
    orderOwner?: PlayerId;
  };
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
    /** 置き換えの効果を持つ別のカード（RS-567 トライコンドル【消身の術】）。パワーゾーンに送ったら記録する。 */
    viaCardId?: string;
  };
};

/** 第8弾 RS-582〜RS-604 の選択の続行データ（rules/legend1/set8NamedEffectsD.ts）。 */
export type Set8DMeta = {
  /** 1つずつ選ぶ選択で選び終えたもの。 */
  selected?: string[];
  /** 選べる数の上限。 */
  maxCount?: number;
  /** 選んだあとで続ける処理の持ち主（相手の手札・コマンド等）。 */
  ownerId?: PlayerId;
  /** 任意の追加データ（数値）。 */
  amount?: number;
  /** カウンターの使用で捨札になったカード（RS-582【メー・メガロ】）。 */
  cardId?: string;
  /** アタックの対象の付け替え（RS-583【災いを受け止める覚悟】）で保留しているバトル。 */
  battle?: PendingBattle;
  wingAttackFromRush?: boolean;
};

/** 第7弾 RS-495〜RS-515 の選択の続行データ（rules/legend1/set7NamedEffectsD.ts）。 */
export type Set7DMeta = {
  /** 1体ずつ選ぶ撃破で選び終えたユニット。 */
  selected?: string[];
  /** 選べる数の上限。 */
  maxCount?: number;
  /** 合計の上限（BP または必要パワーの数字）。 */
  budget?: number;
  /** 合計に数える値。 */
  measure?: "bp" | "power_cost";
  /** 候補を取る敵軍のエリア。 */
  zones?: ("battle" | "rush")[];
  /** RS-502: かわりに処理した撃破（場を離れる処理）。 */
  intent?: PendingLeave;
  /** RS-502: 撃破されたユニットの BP（手札のユニットカードの BP と合計する）。 */
  destroyedBp?: number;
  /** RS-515: 山札の下に戻す順番を選んでいるカードの持ち主（validInstanceIds はその山札の上にあるオモテにしたカード）。 */
  orderOwner?: PlayerId;
  /** RS-515: 続けて山札の下に戻す順番を選ぶ、持ち主ごとのオモテにしたカード。 */
  orderGroups?: { playerId: PlayerId; instanceIds: string[] }[];
};

/** @deprecated pendingEffectChoice を使用すること（ruin_survey）。 */
export type PendingScry = {
  playerId: PlayerId;
  scriedInstanceId: string;
  sourceCardId: string;
};

/** バトル進入後、攻撃側は攻撃/ストライク/パスを選ぶ必要がある。 */
/**
 * 中断した進入処理の再開位置。"conditional" は条件の効果の先頭から、`conditional:<n>`（`:dsl` 付きは DSL の進入効果を処理済み）は
 * 条件の効果の n 番目の区切りから（先に開いた選択の後で、残りの「出たとき」の効果を落とさずに処理する。rules/combo.ts）。
 */
export type EnterBattleResumeFrom = "conditional" | `conditional:${number}` | `conditional:${number}:dsl` | "nc" | "tail";

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
      zordMaterialDestination?: ZordMaterialDestination;
      zordMaterialDestinations?: ZordMaterialDestination[];
      zordMothershipHoldInstanceIds?: string[];
      zordExtraCommandHoldInstanceIds?: string[];
      /** RS-586【魔神に不足する物】で捨札にする「戦闘員」のユニット（RushAction と同じ）。 */
      godomDiscardInstanceIds?: string[];
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
  /** RS-586【魔神に不足する物】で捨札にする「戦闘員」のユニット（begin_zord_setup で選び、最後のラッシュに引き継ぐ）。 */
  godomDiscardInstanceIds?: string[];
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
  /** RS-429【暮らしの中に修行あり】: MA のかわりに WB のコマンド＋追加1つ（計2つ）をホールドする支払い。 */
  shifuSubstitute?: boolean;
  /**
   * totalNeeded より少なくても確定できる枚数（effect_hold の RS-429 代用: MA のコマンド1つでも、
   * WB のコマンド＋追加1つの計2つでもよい）。
   */
  minNeeded?: number;
  /**
   * 追加条件「追加で自軍コマンドをNつホールドする」の N を、この支払いの中で一緒に選ぶ（totalNeeded に含む）。
   * 確定時に、カテゴリの支払い分と追加分に分ける（RS-627 メガシップ。rules/commandPayment.ts splitExtraHoldPayment）。
   */
  extraCommandHoldCount?: number;
  /**
   * RM-014 ソニックフラップ: ラッシュのコマンドの支払いで、カテゴリの支払いのほかに追加でホールドするコマンドの数
   * （追加分はカテゴリを問わないリリース状態の自軍コマンド。rules/rm/rm1Fields.ts）。
   */
  rm1ExtraHolds?: number;
  /** RK-036 仮面ライダーライア: 選んだカードをホールドせずに捨札にする支払い（rules/rk/rk2UnitEffects.ts）。 */
  discardInsteadOfHold?: boolean;
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
  /** クロスギャザー ザ・Wインパクト XG3 の、ターンをまたぐ記録・処理待ち（rules/xg3/xg3Types.ts）。 */
  xg3?: import("../rules/xg3/xg3Types").Xg3State;
  turn: number;
  activePlayer: PlayerId;
  /** 先攻プレイヤー（先攻）。 */
  firstPlayer: PlayerId;
  phase: Phase;
  /** エンドフェイズ内ステップ: 任意効果 → 確定。 */
  endPhaseStep?: "end_effects" | "finalize";
  /**
   * エンドフェイズの「ターン終了時にバトルエリアからラッシュエリアへ戻せる」効果（RS-138【ジェットスケボー】等）を
   * そのターンに見送ったユニット。見送ったユニットをメニューに出し直すと、同じ選択が永久に繰り返される。
   */
  endTurnEffectsDeclined?: { turn: number; instanceIds: string[] };
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
  /**
   * エンジンの乱数の状態（mulberry32 の 32bit 状態。core/rng.ts）。
   * 山札のシャッフルや無作為な選択はこれから作る乱数で行い、同じ状態・同じアクションなら同じ結果になる。
   */
  rngState?: number;
  /** ストライク宣言後の守り側応答ウィンドウ。 */
  pendingStrike?: PendingStrike;
  /** 攻撃宣言後の守り側応答ウィンドウ。 */
  pendingBattle?: PendingBattle;
  /** 相手がラッシュした後の守り側応答ウィンドウ。 */
  pendingRush?: PendingRush;
  /** 敵ラッシュへのモーフ反応窓。 */
  pendingMorph?: PendingMorph;
  /** RK-169・RK-184 の選択を、操作待ちがなくなってから開く（rules/rk/rk9UnitEffects.ts applyRk9AfterAction）。 */
  rk9DeferredChoices?: PendingEffectChoice[];
  /** RK-195 の選択を、操作待ちがなくなってから開く（rules/rk/rk10UnitEffects.ts applyRk10AfterAction）。 */
  rk10DeferredChoices?: PendingEffectChoice[];
  /** 直近のラッシュでホールドしたコマンド（RK-205【フライングアタッカー】。core/applyAction.ts resolve_command_payment が記録）。 */
  rk10RushPaid?: { instanceId: string; commandIds: string[] };
  /** RK-252 変身音叉 音角: オペレーションを使用するためにホールドしたコマンド（rules/rk/rk12UnitEffects.ts）。 */
  rk12OpPaid?: { instanceId: string; commandIds: string[] };
  /** RK-251 ゴルゴムの仕業を使わなかった: このオペレーションの使用を続ける（core/applyAction.ts の後処理）。 */
  rk12ResumeOperation?: { playerId: PlayerId; instanceId: string; targetInstanceId?: string; extraInstanceId?: string };
  /** RK-251 の選択を済ませたオペレーション（同じ使用で2度は尋ねない）。 */
  rk12GorgomPassedOp?: string;
  /** 「…を捨札にしなければバトルエリアに出られない」の捨てるカードを選んだ後で続ける move_to_battle（core/applyAction.ts の後処理）。 */
  battleEntryResumeMove?: { playerId: PlayerId; instanceId: string; vehicleInstanceId?: string; rideOff?: boolean };
  /** XG1-038【サカナマル】の選択の後で続ける相手の move_to_battle（core/applyAction.ts の後処理。rules/xg1/xg1bEffects.ts）。 */
  xg1ResumeMove?: { playerId: PlayerId; instanceId: string; vehicleInstanceId?: string; rideOff?: boolean };
  /** XG1-038【サカナマル】を尋ね終えた相手のユニット（続ける move_to_battle で2度は尋ねない）。 */
  xg1SakanamaruDone?: string;
  /** RK-272【ライジングスプラッシュドラゴン】: NC の効果を無効にするかの答え（rules/rk/rk13UnitEffects.ts）。 */
  rk13NcNegation?: { instanceId: string; negate: boolean };
  /** RK-272: 無効にしなかった RC の効果を実行している（同じ RC で2度は尋ねない）。 */
  rk13RcBypass?: string;
  /** RK-271【ライジングマイティキック】: 操作待ちがなくなってから撃破するユニット（rules/rk/rk13UnitEffects.ts applyRk13AfterAction）。 */
  rk13PendingKick?: { playerId: PlayerId; ids: string[] };
  /** RK-177【催眠音波】の選択を終えたら、このプレイヤーのラッシュフェイズを終える（core/applyAction.ts）。 */
  rk9RushEndAdvance?: PlayerId;
  /**
   * モーフで出たユニットの「ラッシュしたとき」（または他のカードの「ラッシュされたとき」）の選択待ちのため、まだ続けていない
   * モーフの処理（残りのモーフ・「ラッシュされたとき」の誘発・カウンター窓）。選択がすべて終わった時点で続ける
   * （R-REPL-04「エリアに出る方はラッシュに含まれる」。keywords/morphReaction.ts resumeMorphAfterEntry）。
   */
  deferredMorphContinuation?: { pending: PendingMorph; usedMorphUnitInstanceId: string; enteredInstanceId: string; passiveDone: boolean };
  /**
   * 「ラッシュしたとき」の効果の解決（選択）待ちのため、まだ開いていない「ラッシュされたとき」の反応
   * （モーフ・カウンター）。選択がすべて終わった時点で開く（R-TIME-01, R-KW-MORPH-01）。
   */
  deferredRushReaction?: { rusherPlayerId: PlayerId; rushedInstanceId: string; phasePlayerId: PlayerId };
  /**
   * 直近にラッシュされたユニットの「ラッシュされた時点」の BP（「ラッシュしたとき」の効果を解決する前）。
   * 「BP8000以下のユニットがラッシュされたとき」は、その後 BP が上がってもこの値で判定する（atwiki/page-424 Q11）。
   */
  rushedBpSnapshot?: { instanceId: string; bp: number };
  /**
   * 「このユニットを捨札にしてもよい。そうしたとき、…」の起動効果で、捨札にする（コスト）ときの「ユニットでなくなるとき」の応答
   * （白熱する実況・【凄まじき戦士】で留まる等）を待っている。応答の後、捨札になっていれば続きを解決し、留まっていれば
   * 続きは無効（atwiki/page-1665 Q1。rules/fieldActivatedAbilities.ts）。
   */
  pendingFieldAbilityAfterLeave?: { playerId: PlayerId; instanceId: string; cardId: string };
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
   * 「ウラ返すとき」（RS-199【ブレイクアクション】）の選択を解決し終えるまで待たせている、パワーのウラ返し（ダメージ）。
   * ルール: R-TIME-01 — 現在形は行動の前。解決後にウラ返し、ダメージの誘発へ進む
   * （rules/damagePayment.ts completeDeferredPowerFlip、core/applyAction.ts continueDeferredPowerFlip）。
   */
  deferredPowerFlip?: DeferredPowerFlip;
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
  /** 直近に効果でオモテにした（公開した）カード。両プレイヤーの UI に表示する。 */
  lastReveal?: RevealNotice;
  /** 第8弾 RS-560〜RS-581 のカード固有の効果の記録（rules/legend1/set8NamedEffectsC.ts）。 */
  set8cMeta?: Set8CMeta;
  /** 第9弾 RS-648〜RS-669 のカード固有の効果の記録（rules/legend1/set9NamedEffectsC.ts）。 */
  set9cMeta?: Set9CMeta;
  /**
   * チャージフェイズの「自軍パワーゾーンにカードを置いたとき」の効果（RS-673【炎神キャスト転送】）の解決を待って、
   * まだラッシュフェイズに進んでいない（効果をすべて解決したらラッシュフェイズに進む。core/applyAction.ts）。
   */
  chargeAdvanceDeferred?: { playerId: PlayerId; log: string };
  /** 第9弾 RS-605〜RS-626 のカード固有の効果の記録（rules/legend1/set9NamedEffectsA.ts）。 */
  set9aState?: Set9AState;
  /** RS-352【ダイデンジンブーメラン】: パワーゾーンを離れたカード（1枚ごとに相手が撃破するユニットを選ぶ）の待ち行列。 */
  boomerangQueue?: Array<{ ownerId: PlayerId; cost: number; cardId: string }>;
  /** RS-363【パンサークロー】: 敵軍コマンドゾーンにホールド状態で置かれたユニットカード（捨札にするかを選ぶ）の待ち行列。 */
  pantherClawQueue?: Array<{ playerId: PlayerId; instanceId: string }>;
  /**
   * RS-377 ギンガグリーン【キバショット】: このターン、リリース状態の敵軍コマンドがホールドされたときの撃破で、まだ処理していないもの
   * （playerId = 【キバショット】を発動したプレイヤー、powerCost = ホールドされたコマンドの必要パワーの数字）。
   */
  /** RS-385【特殊消化弾】: ホールド状態で置かれ、リリース状態で置くかをまだ確認していない自軍コマンド。 */
  specialExtinguisherQueue?: Array<{ playerId: PlayerId; instanceId: string }>;
  kibaShotQueue?: Array<{ playerId: PlayerId; powerCost: number; sourceInstanceId?: string }>;
  /** RS-533【フェニックスファイヤー】: 敵軍ユニットをダメージにして置いた回数分の「1枚ドローしてもよい」（rules/legend1/set8NamedEffectsA.ts）。 */
  set8aDrawQueue?: Array<{ playerId: PlayerId; sourceInstanceId: string }>;
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
  /** RS-418【炎の眼光】: 進入中のユニットの NC の効果を無効にするかの決定（進入処理の NC の段階で使い、消す）。 */
  ncNegationDecision?: { instanceId: string; negate: boolean };
  /** RS-477 ガオウルフ【威圧する咆哮】: NC の効果を発動する前の発動確認を済ませた進入中ユニット（進入処理の NC の段階で使い、消す）。 */
  gaoWolfNcDecision?: { instanceId: string };
  /**
   * 第7弾 RS-474〜RS-494 のカード固有の待ち行列（rules/legend1/set7NamedEffectsC.ts）。
   * - extraTurns: RS-484【ハリーアップ！】で「このターンの後、追加でもう一度ターンを行う」プレイヤー（ターンごとに1件）。
   * - bunshin: RS-486【分身幻斬り】でアタック・ストライクの処理をすべて終えてから開く選択。
   */
  extraTurns?: PlayerId[];
  bunshinQueue?: Array<{ playerId: PlayerId; instanceId: string; cardId: string }>;
  /**
   * 使用して手札を離れたが、効果の解決が選択待ち等で中断していてまだどのゾーンにも置かれていない
   * オペレーション（カウンターを含む）。解決が終わった時点で（効果が別のゾーンへ移していなければ）
   * 捨札（常駐なら常駐置き場）に置く（applyAction の後処理 settleResolvingOperations）。
   */
  resolvingOperations?: Array<{ playerId: PlayerId; card: CardInstance }>;
  /** RK-129【サンダースペイダー】・RK-132【妻子のバックアップ】の、まだ開いていない発動（rules/rk/rk7UnitEffects.ts）。 */
  rk7PendingTriggers?: Array<{ kind: "rk129" | "rk132"; playerId: PlayerId; sourceInstanceId: string }>;
  /** RM-059 異次元調達屋カブト【トランクの中身】の、まだ開いていない発動（rules/rm/rm3Effects.ts applyRm3AfterAction）。 */
  /** XG7-001〜XG7-068 のターンを限った記録（rules/xg7/xg7Types.ts）。 */
  xg7?: import("../rules/xg7/xg7Types").Xg7State;
  rm3PendingTriggers?: Array<{ kind: "rm059"; playerId: PlayerId; sourceInstanceId: string }>;
  /**
   * 効果で場のカードを撃破ではなく別のゾーンへ移す処理のうち、チェイス等の離場の応答を待っている残り（rules/fieldLeaveQueue.ts。
   * R-KW-CHASE-01）。応答の解決後に core/applyAction.ts の後処理で順に続ける。
   */
  queuedFieldLeaves?: PendingLeave[];
  /** RM-026 グランドバース【収容】の、チェイス等の選択を待っている「その後、選んだビークルをパワーゾーンに送る」（rules/rm/rm2Effects.ts applyRm2AfterAction）。 */
  rm2PendingTriggers?: Array<{ kind: "rm026_vehicle"; playerId: PlayerId; instanceId: string; phasePlayerId: PlayerId }>;
  /** クロスギャザー ザ・ギガンティックタイタン XG6 のターン中の記録（rules/xg6/）。 */
  xg6?: Xg6Records;
  /** クロスギャザー XG2 のカード固有の効果の状態（ターン中の記録など。rules/xg2/xg2Core.ts）。 */
  xg2?: Xg2State;
  /** RM-017 オメデトロフィーの、まだ開いていない発動（rules/rm/rm1Effects.ts applyRm1AfterAction）。 */
  rm1PendingTriggers?: Array<{ kind: "rm017"; playerId: PlayerId; sourceInstanceId: string; unitCardId: string }>;
  /** クロスギャザー XG5 の継続中の効果・まだ開いていない発動（rules/xg5/xg5Types.ts）。 */
  xg5?: import("../rules/xg5/xg5Types").Xg5State;
  /** プロモーションカードの、まだ開いていない発動（XP-013【キョウリュウマル】等。rules/promo/promoAfterAction.ts）。 */
  promoPendingTriggers?: Array<{ kind: string; playerId: PlayerId; sourceInstanceId: string; phasePlayerId: PlayerId; data?: Readonly<Record<string, unknown>> }>;
  /** RK-153【車両強奪】で選ばれたユニット（次の相手のスタートフェイズに戻せない。rules/rk/rk8UnitEffects.ts）。 */
  rk8Seized?: Array<{ playerId: PlayerId; instanceId: string }>;
  /** RK-011 第三の眼: 無効にしなかったカウンターの使用をもう一度処理する（core/applyAction.ts の後処理）。 */
  rk1CounterReplay?: unknown;
  /** RK-011 第三の眼: 無効にするかを選び終えたカウンターの instanceId（再処理で再び選ばせない）。 */
  rk1ThirdEyeChecked?: string;
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
  /**
   * RS-255 巨大化爆弾: 「怪人」の自軍ユニットが撃破されて捨札になったとき、同時に誘発した効果の選択（例: RK-206 ウルフオルフェノク ※）が
   * 開いていて窓を開けなかった。選択などが終わったら窓を開く（rules/legend1/set5NamedEffectsA.ts openGiantBombWindow。atwiki/page-207 Q1）。
   */
  deferredGiantBomb?: { ownerId: PlayerId; unitInstanceIds: string[]; phasePlayerId: PlayerId };
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
export type EffectRushSourceZone = "command" | "hand" | "discard" | "power" | "deck" | "operation";

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
  /** 「1枚選び、…出す」（任意でない）: 選択・追加条件の素材の選択を見送れない（RS-605 異次元からの翼）。 */
  forced?: boolean;
  /** 出したユニットを、このビークルにライドした状態で出す（XG4-009【緊急出動】。rules/xg4/xg4aEffects.ts）。 */
  mountOnInstanceId?: string;
  /** 選び終えて、まだ出していないユニット（1体ずつ出す）。 */
  queue: string[];
  /** 選ぶ段階: 候補とあと何枚選べるか。 */
  picking?: { candidates: string[]; remaining: number };
  /** 追加条件を実行中のユニット。 */
  current?: {
    instanceId: string;
    /** extended: 手札・パワー等のカードを使う追加条件（rules/zordExtended.ts）。 */
    direction: "up" | "down" | "extended";
    needed: number;
    chosen: string[];
    destination?: "command" | "discard";
    /** RS-359 デンジ犬アイシー【最後の手段】で山札から捨札にして「捨札にしたことにした」素材の数。 */
    icyCount?: number;
    /** デンジ犬アイシーを捨札にして、山札から素材のカードを選んでいる途中のアイシー。 */
    icyPending?: string;
    /** デンジ犬アイシーで山札から捨札にした素材のカード（合体の枠の割り当てに使う）。 */
    icyChosen?: string[];
  };
};

/** クロスギャザー ザ・ギガンティックタイタン XG6 の選択の続き（rules/xg6/）。 */
export type Xg6ChoiceMeta = {
  /** 選んだ（見せた・オモテにした）カード等。 */
  ids?: string[];
  /** 数の上限・数。 */
  limit?: number;
  /** 状態の名前（段階）。 */
  step?: string;
  /** 対象のプレイヤー。 */
  targetPlayerId?: PlayerId;
  /** カテゴリ等の文字列。 */
  tags?: string[];
};

/** クロスギャザー ザ・ギガンティックタイタン XG6 のターン中の記録（rules/xg6/）。key はカードと効果の名前。 */
export type Xg6Records = {
  marks?: Array<{ key: string; playerId: PlayerId; instanceId?: string; turn: number; value?: number; ref?: string }>;
  /** XG6-025【ここからは私のターンだ】: このプレイヤーのバトルフェイズを終了する（core/applyAction.ts の後処理）。 */
  endBattlePhase?: PlayerId;
  /** XG6-042【ゼロのスタート】: 次のスタートフェイズにドローできないプレイヤーと、記録したターン。 */
  noStartDraw?: Array<{ playerId: PlayerId; turn: number }>;
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
  /** XG2 の「自分がターンを終えるとき」を処理済みか（rules/xg2/xg2cEffects.ts）。 */
  xg2Done?: boolean;
  /** 第6弾の「ターンを終えるとき」の選択（RS-398【時間漂流者の送還】・RS-413 のコマンド捨札）のうち未処理のもの。 */
  set6bQueue?: string[];
  /** 第7弾 RS-484【ハリーアップ！】の「ターンを終えるとき」の選択のうち未処理のもの（rules/legend1/set7NamedEffectsC.ts）。 */
  set7cQueue?: string[];
  /** 第8弾 RS-594【ガンパードガン】の「次の相手ターン、ターンを終えるとき」の選択のうち未処理のもの（rules/legend1/set8NamedEffectsD.ts）。 */
  set8dQueue?: string[];
  /** RS-360【宇宙で一番美しいのは誰？】で、まだ選んで撃破していない回数（未計算なら undefined）。 */
  hedrianLeft?: number;
  /** 第8弾 RS-567【消身の術】の「相手がそのターンを終えたとき」の選択のうち未処理のもの（rules/legend1/set8NamedEffectsC.ts）。 */
  set8cQueue?: string[];
  /** RS 以外のラインの「自分がターンを終えるとき」の選択（XP-026 の※）のうち未処理のもの（rules/legend1/otherLinesNamedEffects.ts）。 */
  otherLinesQueue?: string[];
  /** ライダーEXP vol.2 の「自分がターンを終えるとき」の選択（RK-095・RK-103）のうち未処理のもの（rules/rk/rk5UnitEffects.ts）。 */
  rk5Queue?: string[];
  /** ライダーEXP vol.2 RK-148〜RK-168 の「自分がターンを終えるとき」の選択（RK-153）のうち未処理のもの（rules/rk/rk8UnitEffects.ts）。 */
  rk8Queue?: string[];
  rk10Queue?: string[];
  /** RK-216・RK-218・RK-221・RK-222 で得た「ターンを終えるとき」（rules/rk/rk11UnitEffects.ts）。 */
  rk11Queue?: string[];
  /** RK-258・RK-260 の「自分がターンを終えるとき」（rules/rk/rk13UnitEffects.ts）。 */
  rk13Queue?: string[];
  /** クロスギャザー ザ・ギガンティックタイタン XG6 の「ターンを終えるとき」（rules/xg6/）。 */
  xg6Queue?: string[];
  /** RK-323【シャドウベール】（rules/rk/rk16UnitEffects.ts）。 */
  rk16Queue?: string[];
  /** XG7-041・XG7-042 の「自分がターンを終えるとき」（rules/xg7/xg7Effects.ts）。 */
  xg7Queue?: string[];
  /** XG1-052【ファイヤーストームアタック】・XG1-053 の撃破（rules/xg1/xg1cEffects.ts）。 */
  xg1Queue?: string[];
  /** クロスギャザー ザ・ジェットアクセル XG4 の「ターンを終えるとき」（rules/xg4/xg4Effects.ts）。 */
  xg4Queue?: string[];
  /** クロスギャザー ザ・Wインパクト XG3 の「自分がターンを終えるとき」（rules/xg3/xg3Effects.ts）。 */
  xg3Queue?: string[];
  /** プロモーションカードの「ターンを終えるとき」（XP-029【まだよ…】。rules/promo/promoRegistry.ts）のうち未処理のもの。 */
  promoQueue?: string[];
};

/** 第9弾 RS-648〜RS-669 のカード固有の効果が使う記録（rules/legend1/set9NamedEffectsC.ts）。 */
export type Set9CMeta = {
  /** RS-648【イカロスバインド】: そのターン（turn）のスタートフェイズに戻さないことを選んだホールド状態のユニット。 */
  startStay?: { turn: number; instanceIds: string[] };
  /**
   * RS-660【SPインカム】: turn のターン（restrictedPlayerId のターン）の進入制限。
   * enteredInstanceIds はそのターンに場の外からラッシュエリアに出たユニット（両軍）。
   */
  spIncome?: Array<{ restrictedPlayerId: PlayerId; turn: number; enteredInstanceIds?: string[] }>;
};

/** 第8弾 RS-560〜RS-581 のカード固有の効果が使う記録（rules/legend1/set8NamedEffectsC.ts）。 */
export type Set8CMeta = {
  /**
   * RS-567 トライコンドル【カラクリ忍法・消身の術】で自軍パワーゾーンに送ったユニットカード。
   * 相手（turnPlayerId）がそのターンを終えたとき、オモテ向きで残っていればラッシュエリアに出せる。
   */
  vanishedToPower?: Array<{ ownerId: PlayerId; instanceId: string; turnPlayerId: PlayerId }>;
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

/** 第9弾 RS-605〜RS-626 の選択の続き（rules/legend1/set9NamedEffectsA.ts）。 */
export type Set9AChoiceMeta = {
  /** 選び終えたもの。 */
  selected?: string[];
  /** 選べる数の上限・残りの回数。 */
  remaining?: number;
  /** 数値（BP 等）。 */
  amount?: number;
  /** 対象の持ち主。 */
  ownerId?: PlayerId;
  /** 段階。 */
  stage?: string;
  /** 先に選んだユニット等。 */
  first?: string;
};

/** 第9弾 RS-605〜RS-626 のカード固有の効果の記録（rules/legend1/set9NamedEffectsA.ts）。 */
export type Set9AState = {
  /** RS-607【ファルコンサモナー】: 残りの実行回数（効果ラッシュ等の解決後に続ける）。 */
  falcon?: { playerId: PlayerId; phasePlayerId: PlayerId; remaining: number; sourceInstanceId?: string; revealedInstanceId?: string };
  /** RS-613【ダイヤソード】: ホールドを待っている発動（turn は発動したターン）。 */
  diamondSword?: Array<{ playerId: PlayerId; sourceInstanceId: string; turn: number; known?: string[]; firedBy?: string; firedBp?: number }>;
};
