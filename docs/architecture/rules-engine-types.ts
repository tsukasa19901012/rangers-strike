/**
 * ルールエンジン設計 — 提案型定義
 *
 * 目的: カード個別実装なしでコアループが成立するエンジン骨格。
 * 参照: docs/architecture/rules-engine-design.md
 *
 * 注意: 本ファイルは設計提案。packages/engine への統合前の参照用。
 *       既存 game.ts / actions.ts との差分は段階的マイグレーションを想定。
 */

// =============================================================================
// 1. 基礎型
// =============================================================================

export type PlayerId = "player1" | "player2";

export type Phase = "start" | "charge" | "rush" | "battle" | "end";

export const PHASE_ORDER: readonly Phase[] = [
  "start",
  "charge",
  "rush",
  "battle",
  "end",
] as const;

export const WIN_DAMAGE = 7;
export const COMMAND_ZONE_MAX = 5;
export const INITIAL_HAND_SIZE = 7;

/** 公式 7 ゾーン + フレームワーク拡張 */
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

/** ゾーン上のカード参照 */
export type ZoneRef = {
  playerId: PlayerId;
  zone: ZoneName;
  index?: number;
};

// =============================================================================
// 2. CardInstance
// =============================================================================

export type CardInstance = {
  instanceId: string;
  cardId: string;

  /** パワーゾーン: 裏向き = ダメージマーカー */
  faceDown?: boolean;
  /** コマンド: 横向きホールド */
  commandHeld?: boolean;
  /** 母艦ゾード支払いホールド */
  mothershipHold?: boolean;

  /** ターン終了時クリア */
  bpModifier?: number;
  spModifier?: number;
  battleActed?: boolean;
  activatedNcEffects?: string[];

  /** レジスト留場 */
  registerHeld?: boolean;

  /** RC 乗車先ビークル */
  mountedOnInstanceId?: string;
  /** ゾード素材記録 */
  zordMaterialCardId?: string;
};

// =============================================================================
// 3. PlayerState
// =============================================================================

/** コマンド二段支払いの中間状態（hold-ready フラグ統合） */
export type PaymentReady = {
  battleEntry?: boolean;
  rushCategory?: boolean;
  counterCategory?: boolean;
  battleEntryRushDiscard?: boolean;
  battleEntryHandDiscard?: boolean;
  discardedCardId?: string;
};

/** ターンスコープ修飾子。カード効果が書き込む。ターン終了でクリア。 */
export type TurnModifiers = {
  comboNumberDelta: number;
  battleBlockedInstanceIds: string[];
  rushedThisTurnInstanceIds?: string[];
  /** カード固有修飾は段階的に Record へ移行 */
  cardModifiers?: Record<string, unknown>;
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
  exile?: CardInstance[];
  commander?: CardInstance[];

  /** 受けたダメージ合計 */
  damage: number;

  // --- フェイズ行程（カード非依存） ---
  hasChargedThisTurn?: boolean;
  hasDrawnThisStart?: boolean;
  hasReleasedCommandsThisStart?: boolean;
  hasReturnedBattleThisStart?: boolean;

  /** 支払い中間状態 */
  paymentReady?: PaymentReady;

  turnModifiers?: TurnModifiers;
};

// =============================================================================
// 4. Pending（ブロック状態 — 正）
// =============================================================================

export type PendingStrike = {
  strikerPlayerId: PlayerId;
  strikerInstanceId: string;
  damage: number;
  battlePhasePlayer: PlayerId;
  damageCancelled?: boolean;
  damageApplied?: boolean;
};

export type PendingBattle = {
  attackerPlayerId: PlayerId;
  attackerInstanceId: string;
  defenderPlayerId: PlayerId;
  defenderInstanceId: string;
  phasePlayerId: PlayerId;
  battleCancelled?: boolean;
  substituteInstanceId?: string;
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
  skipRegister?: boolean;
  followUpAttackerLeave?: Omit<PendingLeave, "followUpAttackerLeave" | "resumePendingStrike">;
  resumePendingStrike?: { damageCancelled: boolean };
};

export type PendingRegister = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  fromZone: "battle";
  leavingCardId: string;
  phasePlayerId: PlayerId;
  followUpAttackerLeave?: PendingLeave["followUpAttackerLeave"];
  resumePendingStrike?: PendingLeave["resumePendingStrike"];
};

export type DamagePaymentResume =
  | { kind: "none"; activePlayer: PlayerId }
  | { kind: "strike"; pending: PendingStrike };

export type PendingDamagePayment = {
  playerId: PlayerId;
  choosingPlayerId?: PlayerId;
  remainingFlips: number;
  deckDraws: number;
  totalDamage: number;
  selectedFlipIds: string[];
  resume: DamagePaymentResume;
};

export type EffectChoiceKind =
  | "deck_top_or_bottom"
  | "seabed_draw"
  | "optional_deck_draw"
  | "select_unit"
  | "select_command"
  | "select_power"
  | "select_hand"
  | "scry_keep_one"
  | "end_turn_menu"
  | "simultaneous_order"
  | "confirm";

export type PendingEffectChoice = {
  playerId: PlayerId;
  effectId: string;
  sourceCardId: string;
  sourceInstanceId?: string;
  kind: EffectChoiceKind;
  phasePlayerId: PlayerId;
  validInstanceIds: string[];
  selectCount?: number;
  optional?: boolean;
};

export type PendingBattleEntry = {
  playerId: PlayerId;
  instanceId: string;
  phasePlayerId: PlayerId;
};

export type CommandPaymentContinuation =
  | { type: "move_to_battle"; rideOff?: boolean }
  | { type: "rush"; zordMaterialInstanceId?: string }
  | { type: "play_operation"; targetInstanceId?: string }
  | { type: "play_counter"; substituteInstanceId?: string }
  | { type: "effect_choice" };

export type PendingCommandPayment = {
  playerId: PlayerId;
  kind: "battle_entry" | "category_use" | "mothership_hold" | "effect_hold";
  sourceInstanceId: string;
  sourceCardId: string;
  eligibleNeeded: number;
  totalNeeded: number;
  validInstanceIds: string[];
  continuation: CommandPaymentContinuation;
};

export type PendingZordSetupStep = "material" | "destination" | "mothership";

export type PendingZordSetup = {
  playerId: PlayerId;
  zordInstanceId: string;
  zordCardId: string;
  step: PendingZordSetupStep;
  validInstanceIds: string[];
  materialInstanceId?: string;
  materialDestination?: "command" | "discard";
};

// =============================================================================
// 5. 解決スタック（二層）
// =============================================================================

/** 反応窓フレーム種別 — priority 昇順で解決 */
export type EffectStackFrameKind =
  | "leave_reaction"
  | "register_choice"
  | "strike_reaction"
  | "battle_reaction"
  | "rush_reaction"
  | "damage_payment"
  | "effect_choice"
  | "battle_entry"
  | "command_payment"
  | "zord_setup"
  | "deferred_battle_entry";

export const FRAME_PRIORITY: Record<EffectStackFrameKind, number> = {
  leave_reaction: 0,
  register_choice: 1,
  strike_reaction: 2,
  battle_reaction: 3,
  rush_reaction: 4,
  damage_payment: 5,
  effect_choice: 6,
  battle_entry: 7,
  command_payment: 8,
  zord_setup: 9,
  deferred_battle_entry: 6,
};

export type EffectStackFrame = {
  id: string;
  kind: EffectStackFrameKind;
  priority: number;
  actorPlayerId?: PlayerId;
  simultaneousGroupId?: string;
};

export type EffectStack = {
  frames: EffectStackFrame[];
};

/** 誘発効果キュー（LIFO）— Magic Stack に相当 */
export type TriggeredStackItem = {
  id: string;
  source: {
    cardId: string;
    instanceId: string;
    controllerId: PlayerId;
  };
  trigger: EffectTrigger;
  effect: EffectDefinition;
  simultaneousGroupId?: string;
};

// =============================================================================
// 6. GameState
// =============================================================================

export type CardDefinition = {
  id: string;
  name: string;
  type: "unit" | "operation" | "vehicle" | "commander";
  powerCost: number | string;
  bp?: number;
  sp?: number | "special" | null;
  comboNumber?: number | "L" | "R" | "RC" | null;
  effectId?: string;
  text?: string;
};

export type GameState = {
  turn: number;
  activePlayer: PlayerId;
  firstPlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  definitions: Record<string, CardDefinition>;
  winner: PlayerId | null;
  log: string[];

  // --- ブロック状態（正） ---
  pendingLeave?: PendingLeave;
  pendingRegister?: PendingRegister;
  pendingStrike?: PendingStrike;
  pendingBattle?: PendingBattle;
  pendingRush?: PendingRush;
  pendingDamagePayment?: PendingDamagePayment;
  pendingEffectChoice?: PendingEffectChoice;
  pendingBattleEntry?: PendingBattleEntry;
  pendingCommandPayment?: PendingCommandPayment;
  pendingZordSetup?: PendingZordSetup;
  deferredBattleEntry?: PendingBattleEntry;

  // --- 解決キュー ---
  triggeredStack: TriggeredStackItem[];
  effectStack?: EffectStack;

  pendingBattleToRushQueue?: string[];
  pendingBattleToRushPhasePlayerId?: PlayerId;
};

// =============================================================================
// 7. Action（全 41 種）
// =============================================================================

// --- フェイズ行動 ---
export type DrawAction = { type: "draw"; playerId: PlayerId };
export type ReleaseStartCommandsAction = { type: "release_start_commands"; playerId: PlayerId };
export type ReturnAllBattleToRushAction = { type: "return_all_battle_to_rush"; playerId: PlayerId };
export type BonusDrawAction = { type: "bonus_draw"; playerId: PlayerId };
export type SkipBonusDrawAction = { type: "skip_bonus_draw"; playerId: PlayerId };
export type ChargePowerAction = { type: "charge_power"; playerId: PlayerId; instanceId: string };
export type ChargeCommandAction = { type: "charge_command"; playerId: PlayerId; instanceId: string };
export type RushAction = {
  type: "rush";
  playerId: PlayerId;
  instanceId: string;
  zordMaterialInstanceId?: string;
  zordMaterialDestination?: "command" | "discard";
  zordMothershipHoldInstanceIds?: string[];
};
export type PlayOperationAction = {
  type: "play_operation";
  playerId: PlayerId;
  instanceId: string;
  targetInstanceId?: string;
  extraInstanceId?: string;
};
export type BeginZordSetupAction = { type: "begin_zord_setup"; playerId: PlayerId; zordInstanceId: string };
export type MoveToBattleAction = { type: "move_to_battle"; playerId: PlayerId; instanceId: string; rideOff?: boolean };
export type BattleAction = {
  type: "battle";
  playerId: PlayerId;
  attackerInstanceId: string;
  defenderInstanceId: string;
};
export type StrikeAction = { type: "strike"; playerId: PlayerId; instanceId: string };
export type PassBattleEntryAction = { type: "pass_battle_entry"; playerId: PlayerId };
export type BattleDanceRetreatAction = {
  type: "battle_dance_retreat";
  playerId: PlayerId;
  battleInstanceId: string;
  commandInstanceIds: [string, string];
};
export type EndPhaseAction = { type: "end_phase"; playerId: PlayerId };

// --- 支払い・セットアップ ---
export type InitiateCommandPaymentAction = {
  type: "initiate_command_payment";
  playerId: PlayerId;
  kind: "battle_entry" | "category_use" | "effect_hold";
  sourceInstanceId: string;
  rideOff?: boolean;
  substituteInstanceId?: string;
};
export type ResolveCommandPaymentAction = {
  type: "resolve_command_payment";
  playerId: PlayerId;
  commandInstanceIds: string[];
};
export type CancelCommandPaymentAction = { type: "cancel_command_payment"; playerId: PlayerId };
export type ResolveZordSetupAction = {
  type: "resolve_zord_setup";
  playerId: PlayerId;
  materialInstanceId?: string;
  destination?: "command" | "discard";
};
export type CancelZordSetupAction = { type: "cancel_zord_setup"; playerId: PlayerId };
export type ResolveDamagePaymentAction = {
  type: "resolve_damage_payment";
  playerId: PlayerId;
  instanceId: string;
};

// --- 反応・応答 ---
export type PassRushReactionAction = { type: "pass_rush_reaction"; playerId: PlayerId };
export type PassBattleReactionAction = { type: "pass_battle_reaction"; playerId: PlayerId };
export type PassStrikeReactionAction = { type: "pass_strike_reaction"; playerId: PlayerId };
export type PassLeaveReactionAction = { type: "pass_leave_reaction"; playerId: PlayerId };
export type PlayCounterAction = {
  type: "play_counter";
  playerId: PlayerId;
  instanceId: string;
  substituteInstanceId?: string;
};
export type FiveTechInterceptAction = { type: "five_tech_intercept"; playerId: PlayerId; interceptInstanceId: string };
export type UsePlasmaEnergyAction = { type: "use_plasma_energy"; playerId: PlayerId };
export type UseSuperShieldAction = { type: "use_super_shield"; playerId: PlayerId };
export type UseRegisterAction = { type: "use_register"; playerId: PlayerId };
export type PassRegisterAction = { type: "pass_register"; playerId: PlayerId };

// --- 効果選択 ---
export type ResolveEffectChoiceAction = { type: "resolve_effect_choice"; playerId: PlayerId; instanceId: string };
export type SkipEffectChoiceAction = { type: "skip_effect_choice"; playerId: PlayerId };
export type ConfirmEffectChoiceAction = { type: "confirm_effect_choice"; playerId: PlayerId };
export type ResolveSeabedDrawAction = { type: "resolve_seabed_draw"; playerId: PlayerId; placement: "top" | "bottom" };
export type ResolveRuinSurveyAction = { type: "resolve_ruin_survey"; playerId: PlayerId; placement: "top" | "bottom" };
export type ConfirmDenjiRevealAction = { type: "confirm_denji_reveal"; playerId: PlayerId };
export type ConfirmShironRevealAction = { type: "confirm_shiron_reveal"; playerId: PlayerId };

// --- カード固有（コアループ外） ---
export type ShironLightAction = { type: "shiron_light"; playerId: PlayerId; operationInstanceId: string };
export type HidoraEggAction = { type: "hidora_egg"; playerId: PlayerId };

export type GameAction =
  | DrawAction
  | ReleaseStartCommandsAction
  | ReturnAllBattleToRushAction
  | BonusDrawAction
  | SkipBonusDrawAction
  | ChargePowerAction
  | ChargeCommandAction
  | RushAction
  | PlayOperationAction
  | BeginZordSetupAction
  | MoveToBattleAction
  | BattleAction
  | StrikeAction
  | PassBattleEntryAction
  | BattleDanceRetreatAction
  | EndPhaseAction
  | InitiateCommandPaymentAction
  | ResolveCommandPaymentAction
  | CancelCommandPaymentAction
  | ResolveZordSetupAction
  | CancelZordSetupAction
  | ResolveDamagePaymentAction
  | PassRushReactionAction
  | PassBattleReactionAction
  | PassStrikeReactionAction
  | PassLeaveReactionAction
  | PlayCounterAction
  | FiveTechInterceptAction
  | UsePlasmaEnergyAction
  | UseSuperShieldAction
  | UseRegisterAction
  | PassRegisterAction
  | ResolveEffectChoiceAction
  | SkipEffectChoiceAction
  | ConfirmEffectChoiceAction
  | ResolveSeabedDrawAction
  | ResolveRuinSurveyAction
  | ConfirmDenjiRevealAction
  | ConfirmShironRevealAction
  | ShironLightAction
  | HidoraEggAction;

/** 全 Action type 文字列のユニオン */
export type GameActionType = GameAction["type"];

// =============================================================================
// 8. Effect 定義（JSON DSL 対応）
// =============================================================================

export type OperationTiming = "rush" | "battle" | "counter" | "resident";

export type EffectTrigger =
  | { type: "on_rush" }
  | { type: "on_enter_battle" }
  | { type: "on_attack"; comboPartnerCardIds?: string[] }
  | { type: "on_strike" }
  | { type: "on_destroy" }
  | { type: "on_leave" }
  | { type: "on_turn_end" }
  | { type: "on_damage" }
  | { type: "nc" }
  | { type: "nc_or_combo_from"; partnerCardIds: string[] }
  | { type: "joint_combo_l" }
  | { type: "joint_combo_r" }
  | { type: "riding_combo" }
  | { type: "while_in_field" }
  | { type: "operation"; timing: OperationTiming };

export type PlayerRef = "controller" | "opponent" | "phase_player" | PlayerId;

export type TargetSelector =
  | { type: "self" }
  | { type: "controller" }
  | { type: "opponent" }
  | { type: "trigger_source" }
  | { type: "instance"; instanceId: string }
  | { type: "card_id"; cardId: string }
  | {
      type: "zone";
      zone: ZoneName;
      owner: "self" | "opponent" | "any";
      filter?: {
        size?: "S" | "M" | "L" | "XL" | "SC";
        category?: string;
        faceDown?: boolean;
        commandHeld?: boolean;
      };
    };

export type EffectCondition =
  | { type: "always" }
  | { type: "has_target"; target: TargetSelector }
  | { type: "bp_compare"; target: TargetSelector; op: "<" | "<=" | ">" | ">="; value: number }
  | { type: "zone_count"; zone: ZoneName; owner: "self" | "opponent"; op: ">=" | "=="; count: number }
  | { type: "controller_is_phase_player" }
  | { type: "and"; conditions: EffectCondition[] }
  | { type: "not"; condition: EffectCondition };

export type EffectPrimitive =
  | { type: "draw"; amount: number; player?: PlayerRef }
  | { type: "move"; target: TargetSelector; to: ZoneName; position?: "left" | "right" }
  | { type: "discard"; target: TargetSelector }
  | { type: "flip_power"; target: TargetSelector; faceDown: boolean }
  | { type: "modify_bp"; target: TargetSelector; amount: number; duration: "turn" }
  | { type: "modify_sp"; target: TargetSelector; amount: number; duration: "turn" }
  | { type: "set_bp"; target: TargetSelector; value: number; duration: "turn" }
  | { type: "deal_damage"; amount: number; target: PlayerRef }
  | { type: "cancel_damage" }
  | { type: "prevent_battle" }
  | { type: "hold_command"; target: TargetSelector }
  | { type: "release_command"; target: TargetSelector }
  | { type: "block_battle_entry"; target: TargetSelector; duration: "turn" }
  | { type: "grant_keyword"; keyword: string; duration: "turn" }
  | {
      type: "choose";
      kind: EffectChoiceKind;
      valid: TargetSelector;
      count: number;
      then: EffectPrimitive[];
    }
  | { type: "open_reaction"; window: "rush" | "battle" | "strike" | "leave" }
  | { type: "enqueue_trigger"; effectId: string };

export type EffectDefinition = {
  id: string;
  name?: string;
  trigger: EffectTrigger;
  condition?: EffectCondition;
  optional?: boolean;
  effects: EffectPrimitive[];
};

/** JSON カード効果ファイル */
export type CardEffectDocument = {
  cardId: string;
  unnamedRules?: Array<{
    rule: string;
    holdCount?: number;
    damage?: number;
    partnerCardIds?: string[];
  }>;
  effects: EffectDefinition[];
};

// =============================================================================
// 9. Event（解決キュー内の事実）
// =============================================================================

export type GameEventBase = {
  id: string;
  timestamp: number;
  phasePlayerId: PlayerId;
  activePlayerId: PlayerId;
  phase: Phase;
};

export type RushCompletedEvent = GameEventBase & {
  type: "rush_completed";
  rusherPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
};

export type AttackDeclaredEvent = GameEventBase & {
  type: "attack_declared";
  attackerPlayerId: PlayerId;
  attackerInstanceId: string;
  defenderPlayerId: PlayerId;
  defenderInstanceId: string;
};

export type LeaveIntentEvent = GameEventBase & {
  type: "leave_intent";
  ownerPlayerId: PlayerId;
  instanceId: string;
  fromZone: "rush" | "battle";
};

export type StackFrameResolvedEvent = GameEventBase & {
  type: "stack_frame_resolved";
  frameKind: EffectStackFrameKind;
};

export type GameEvent =
  | RushCompletedEvent
  | AttackDeclaredEvent
  | LeaveIntentEvent
  | StackFrameResolvedEvent
  | (GameEventBase & { type: string; [key: string]: unknown });

// =============================================================================
// 10. エンジン API
// =============================================================================

export type ActionResult = {
  state: GameState;
  error?: string;
  events?: GameEvent[];
};

export type EffectHandler = (
  state: GameState,
  ctx: {
    sourceInstanceId: string;
    sourceCardId: string;
    controllerId: PlayerId;
    trigger: EffectTrigger;
  },
) => GameState;

export type EffectHandlerRegistry = Record<string, EffectHandler>;

/** コアループ API */
export type RulesEngine = {
  createGame: (options: {
    player1Deck: string[];
    player2Deck: string[];
    definitions: Record<string, CardDefinition>;
    firstPlayer?: PlayerId;
  }) => GameState;

  getLegalActions: (state: GameState) => GameAction[];

  applyAction: (state: GameState, action: GameAction) => ActionResult;

  buildEffectStack: (state: GameState) => EffectStack;

  countAvailablePower: (state: GameState, playerId: PlayerId) => number;

  /** JSON DSL インタープリタ（Phase 1+） */
  interpretEffect?: (definition: EffectDefinition, state: GameState, ctx: unknown) => GameState;
};

// =============================================================================
// 11. 派生ヘルパー（シグネチャのみ）
// =============================================================================

export function nextPhase(current: Phase): Phase {
  const index = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length] ?? "start";
}

export function hasWonByDamage(player: PlayerState): boolean {
  return player.damage >= WIN_DAMAGE;
}

export function hasBlockingPending(state: GameState): boolean {
  return !!(
    state.pendingLeave ||
    state.pendingRegister ||
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingDamagePayment ||
    state.pendingEffectChoice ||
    state.pendingBattleEntry ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.deferredBattleEntry
  );
}

export function hasOpenReactionWindow(state: GameState): boolean {
  return !!(
    state.pendingLeave ||
    state.pendingRegister ||
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush
  );
}
