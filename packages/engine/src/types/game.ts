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

/** Per-turn flags cleared when the player's turn ends. */
export type TurnModifiers = {
  /** RS-015: combo number reduction (stacks). */
  comboNumberDelta: number;
  /** RS-001 / RS-002 finisher boost when battle is S-only combo. */
  sComboFinisher?: "goren_storm" | "jacker_hurricane";
  /** RS-003: units that cannot re-enter battle this turn. */
  battleBlockedInstanceIds: string[];
  /** RS-013 / RS-071: used this rush phase. */
  shironLightUsed: boolean;
  hidoraEggUsed?: boolean;
  /** RS-072: opponent permanents disabled, opponent cannot counter. */
  infiniteChainActive?: boolean;
  /** RS-107: counter holds become discards for opponent. */
  deaceSniperActive?: boolean;
  /** RS-110: new rush units cannot enter battle until end of turn. */
  zenibombActive?: boolean;
  /** Instance ids rushed this turn (RS-106 / RS-090 restrictions). */
  rushedThisTurnInstanceIds?: string[];
  /** RS-094 ghost absorption BP override for battle. */
  ghostAbsorptionBp?: Record<string, number>;
  /** RS-119 shift up SP1 grant. */
  shiftUpSp1InstanceIds?: string[];
  /** RS-011: S unit gains BP+2000 per own damage this turn. */
  auraPowerInstanceId?: string;
  /** RS-123: own S units use printed defender BP when attacking. */
  superDynamiteActive?: boolean;
  /** RS-158 baki_baki: extra battle attack allowed (strike blocked). */
  bakiBakiExtraAttackIds?: string[];
};

export type CardInstance = {
  instanceId: string;
  cardId: string;
  /** Temporary BP change (cleared at end of turn). */
  bpModifier?: number;
  /** Command zone: true = held (sideways), false/undefined = released. */
  commandHeld?: boolean;
  /** Hold from 母艦 zord payment; does not satisfy fusion battle-entry hold notes. */
  mothershipHold?: boolean;
  /** Power zone: true = face-down (damage marker). */
  faceDown?: boolean;
  /** Temporary SP change (cleared at end of turn). */
  spModifier?: number;
  /** Battle phase: true after this unit battled or struck this turn. */
  battleActed?: boolean;
  /** Fusion unit discarded when this zord was rushed (RS-009 recovery). */
  zordMaterialCardId?: string;
  /** Vehicle this unit is riding in rush (RC support). */
  mountedOnInstanceId?: string;
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
  /** Face-down power cards count as damage taken. */
  damage: number;
  /** Charge phase: true after placing one card to power or command this turn. */
  hasChargedThisTurn?: boolean;
  /** Start phase: true after the mandatory draw this turn. */
  hasDrawnThisStart?: boolean;
  /** Start phase: true after releasing held commands this turn. */
  hasReleasedCommandsThisStart?: boolean;
  /** Start phase: true after returning battle units to rush this turn. */
  hasReturnedBattleThisStart?: boolean;
  /** Start phase: true after RS-022 upkeep is paid this turn. */
  hasPaidEarthForceUpkeep?: boolean;
  /** ※バトル進入: 支払いでホールド済み（move_to_battle まで有効）。 */
  battleEntryHoldReady?: boolean;
  /** ラッシュ: カテゴリ支払いでホールド済み（rush 完了まで有効）。 */
  rushCategoryHoldReady?: boolean;
  /** RS-132: Sユニット捨札支払い済み（move_to_battle まで有効）。 */
  battleEntryRushDiscardReady?: boolean;
  /** RS-132: 直前に捨札にしたSユニットの cardId（反バイオ粒子砲判定用）。 */
  battleEntryDiscardedCardId?: string;
  /** RS-165: 手札捨札支払い済み（move_to_battle まで有効）。 */
  battleEntryHandDiscardReady?: boolean;
  turnModifiers?: TurnModifiers;
};

export type PendingStrike = {
  strikerPlayerId: PlayerId;
  strikerInstanceId: string;
  damage: number;
  battlePhasePlayer: PlayerId;
  damageCancelled?: boolean;
  /** Set after defender finishes damage payment for this strike. */
  damageApplied?: boolean;
};

export type DamagePaymentResume =
  | { kind: "none"; activePlayer: PlayerId }
  | { kind: "strike"; pending: PendingStrike };

/** Defender chooses which face-up power cards flip when taking damage. */
export type PendingDamagePayment = {
  playerId: PlayerId;
  /** Face-up power flips still to assign. */
  remainingFlips: number;
  /** Face-down draws from deck after power flips. */
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
  /** RS-006: battle cancelled, defender returned to rush */
  battleCancelled?: boolean;
  /** RS-018: substitute unit fights instead */
  substituteInstanceId?: string;
  /** RS-131 mirage_beam: printed BP override for this battle. */
  mirageBeamBpOverride?: number;
  /** RS-131: revealed deck card to discard after battle. */
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
  /** Resume strike resolution after the unit leaves (five-tech / plasma). */
  resumePendingStrike?: { damageCancelled: boolean };
  /** When both players' units would leave from one battle, queue attacker after defender. */
  followUpAttackerLeave?: {
    ownerPlayerId: PlayerId;
    instanceId: string;
    fromZone: "rush" | "battle";
    toZone: "discard" | "power" | "command";
    leavingCardId: string;
    phasePlayerId: PlayerId;
  };
  /** RS-052: optional substitute when a WB ally would be destroyed. */
  superShieldInstanceId?: string;
};

/** Player must choose targets/options before the game continues. */
export type SeabedDrawMeta = {
  drawCount: number;
  /** RS-014 超頭脳: second card goes to discard instead of hand. */
  superBrainDiscardSecond?: boolean;
  /** Finish this choice after seabed draw resolves (e.g. RS-115 optional draw). */
  resume?: {
    pending: PendingEffectChoice;
    detail: string;
  };
};

export type DenjiMachineMeta = {
  step: "reveal" | "order_bottom";
  /** Players who may view revealed cards (caster + opponent for PvP). */
  audiencePlayerIds: PlayerId[];
  revealedInstanceIds: string[];
  toHandInstanceIds: string[];
  toBottomInstanceIds: string[];
  /** Non-S cards removed from deck, awaiting bottom order. */
  limboBottomCards?: CardInstance[];
  /** Bottom order: first entry sits just above rest of deck; last is deck bottom. */
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
  | "end_turn_menu";

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
  /** RS-178 sagas_sniper: destroyed unit power cost cap for deck search. */
  maxPowerCost?: number;
  /** Sum cap for printed BP (e.g. RS-106 ジュウクンドー). */
  bpBudget?: number;
  unitDestination?: "power" | "discard" | "deck_top" | "hand" | "hand_from_discard" | "hand_from_power" | "enemy_battle" | "enemy_command" | "swap_battle" | "rush";
  commandAction?: "discard" | "hold" | "return_hand" | "rush" | "rush_silent" | "power";
  commandFilter?: "held" | "released" | "any";
  seabedDrawMeta?: SeabedDrawMeta;
  denjiMachineMeta?: DenjiMachineMeta;
};

/** @deprecated Use pendingEffectChoice (ruin_survey). */
export type PendingScry = {
  playerId: PlayerId;
  scriedInstanceId: string;
  sourceCardId: string;
};

/** Attacker must choose attack / strike / pass after entering battle. */
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
  /** Remaining enter-battle steps after a combo choice resolves. */
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
  | { type: "effect_choice" };

export type PendingZordSetupStep = "material" | "destination" | "mothership";

/** Zord material / mothership wizard before command payment or rush. */
export type PendingZordSetup = {
  playerId: PlayerId;
  zordInstanceId: string;
  zordCardId: string;
  step: PendingZordSetupStep;
  validInstanceIds: string[];
  materialInstanceId?: string;
  /** Chosen before material when send_s_unit_to_command_or_discard. */
  materialDestination?: ZordMaterialDestination;
  /** Mothership hold may substitute for S-unit material on this zord. */
  mothershipAvailable?: boolean;
};

/** Pay command holds as part of a player action (no standalone hold). */
export type PendingCommandPayment = {
  playerId: PlayerId;
  kind: "battle_entry" | "category_use" | "mothership_hold" | "effect_hold";
  sourceInstanceId: string;
  sourceCardId: string;
  /** Min newly held cards that count for ※ battle-entry (battle_entry only). */
  eligibleNeeded: number;
  /** How many unheld commands to hold before continuing. */
  totalNeeded: number;
  validInstanceIds: string[];
  categories?: Category[];
  prismSubstitute?: boolean;
  continuation: CommandPaymentContinuation;
};

export type GameState = {
  turn: number;
  activePlayer: PlayerId;
  /** Player who went first (先攻). */
  firstPlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  definitions: Record<string, CardDefinition>;
  log: string[];
  winner: PlayerId | null;
  /** Defender response window after a strike is declared. */
  pendingStrike?: PendingStrike;
  /** Defender response window after an attack is declared. */
  pendingBattle?: PendingBattle;
  /** Defender response window after opponent rushes. */
  pendingRush?: PendingRush;
  /** Owner response when a unit would leave the field. */
  pendingLeave?: PendingLeave;
  /** Effect target / option selection (「選んで」 effects). */
  pendingEffectChoice?: PendingEffectChoice;
  /** Entered battle — must attack, strike, or pass before next entry. */
  pendingBattleEntry?: PendingBattleEntry;
  /** Select commands to hold, then run continuation action. */
  pendingCommandPayment?: PendingCommandPayment;
  /** Zord rush: choose material, destination, then command payment. */
  pendingZordSetup?: PendingZordSetup;
  /** Defender picks which face-up power to flip for damage. */
  pendingDamagePayment?: PendingDamagePayment;
  /** Opens when enter effects need a choice first. */
  deferredBattleEntry?: PendingBattleEntry;
  /** @deprecated Alias — use pendingEffectChoice */
  pendingScry?: PendingScry;
};

export const INITIAL_HAND_SIZE = 7;
export const WIN_DAMAGE = 7;
/** Official rule: command zone holds at most 5 cards. */
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

/** Deck-out is checked when a mandatory draw fails (see applyAction draw). */
export function hasWonByDeckOut(_player: PlayerState): boolean {
  return false;
}
