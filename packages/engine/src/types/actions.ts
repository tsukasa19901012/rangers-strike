import type { PlayerId } from "./game";

export type ChargePowerAction = {
  type: "charge_power";
  playerId: PlayerId;
  instanceId: string;
};

export type ChargeCommandAction = {
  type: "charge_command";
  playerId: PlayerId;
  instanceId: string;
};

export type ZordMaterialDestination = "command" | "discard";

export type RushAction = {
  type: "rush";
  playerId: PlayerId;
  instanceId: string;
  /** Material card for zord-up (fusion discard or S-unit cost). */
  zordMaterialInstanceId?: string;
  /** RS-074/075/118-122: send S-unit to command zone instead of discard. */
  zordMaterialDestination?: ZordMaterialDestination;
  /** RS-076 / RS-105 母艦: hold commands instead of S-unit additional cost. */
  zordMothershipHoldInstanceIds?: string[];
};

export type MoveToBattleAction = {
  type: "move_to_battle";
  playerId: PlayerId;
  instanceId: string;
  /** RC: dismount from vehicle when entering battle. */
  rideOff?: boolean;
};

export type StrikeAction = {
  type: "strike";
  playerId: PlayerId;
  instanceId: string;
};

export type BattleAction = {
  type: "battle";
  playerId: PlayerId;
  attackerInstanceId: string;
  defenderInstanceId: string;
};

export type DrawAction = {
  type: "draw";
  playerId: PlayerId;
};

export type EndPhaseAction = {
  type: "end_phase";
  playerId: PlayerId;
};

export type PlayOperationAction = {
  type: "play_operation";
  playerId: PlayerId;
  instanceId: string;
  /** Target card instance for effects that require one. */
  targetInstanceId?: string;
  /** Second hand card for cyber_s_rider etc. */
  extraInstanceId?: string;
};

export type ShironLightAction = {
  type: "shiron_light";
  playerId: PlayerId;
  operationInstanceId: string;
};

export type HidoraEggAction = {
  type: "hidora_egg";
  playerId: PlayerId;
};

export type BattleDanceRetreatAction = {
  type: "battle_dance_retreat";
  playerId: PlayerId;
  battleInstanceId: string;
};

export type BonusDrawAction = {
  type: "bonus_draw";
  playerId: PlayerId;
};

export type ReleaseStartCommandsAction = {
  type: "release_start_commands";
  playerId: PlayerId;
};

export type ReturnAllBattleToRushAction = {
  type: "return_all_battle_to_rush";
  playerId: PlayerId;
};

export type PassStrikeReactionAction = {
  type: "pass_strike_reaction";
  playerId: PlayerId;
};

export type FiveTechInterceptAction = {
  type: "five_tech_intercept";
  playerId: PlayerId;
  interceptInstanceId: string;
};

export type PlayCounterAction = {
  type: "play_counter";
  playerId: PlayerId;
  instanceId: string;
  /** RS-018: substitute unit instance id */
  substituteInstanceId?: string;
};

export type PassBattleReactionAction = {
  type: "pass_battle_reaction";
  playerId: PlayerId;
};

export type PassRushReactionAction = {
  type: "pass_rush_reaction";
  playerId: PlayerId;
};

export type PassLeaveReactionAction = {
  type: "pass_leave_reaction";
  playerId: PlayerId;
};

export type UseSuperShieldAction = {
  type: "use_super_shield";
  playerId: PlayerId;
};

export type UsePlasmaEnergyAction = {
  type: "use_plasma_energy";
  playerId: PlayerId;
};

export type ResolveRuinSurveyAction = {
  type: "resolve_ruin_survey";
  playerId: PlayerId;
  placement: "top" | "bottom";
};

export type ResolveSeabedDrawAction = {
  type: "resolve_seabed_draw";
  playerId: PlayerId;
  placement: "top" | "bottom";
};

export type ConfirmDenjiRevealAction = {
  type: "confirm_denji_reveal";
  playerId: PlayerId;
};

export type ConfirmShironRevealAction = {
  type: "confirm_shiron_reveal";
  playerId: PlayerId;
};

export type ConfirmEffectChoiceAction = {
  type: "confirm_effect_choice";
  playerId: PlayerId;
};

export type ResolveEffectChoiceAction = {
  type: "resolve_effect_choice";
  playerId: PlayerId;
  instanceId: string;
};

export type SkipEffectChoiceAction = {
  type: "skip_effect_choice";
  playerId: PlayerId;
};

export type PassBattleEntryAction = {
  type: "pass_battle_entry";
  playerId: PlayerId;
};

export type InitiateCommandPaymentAction = {
  type: "initiate_command_payment";
  playerId: PlayerId;
  kind: "battle_entry" | "category_use" | "effect_hold";
  sourceInstanceId: string;
  prismSubstitute?: boolean;
  rideOff?: boolean;
  zordMaterialInstanceId?: string;
  zordMaterialDestination?: ZordMaterialDestination;
  zordMothershipHoldInstanceIds?: string[];
  targetInstanceId?: string;
  extraInstanceId?: string;
};

export type ResolveCommandPaymentAction = {
  type: "resolve_command_payment";
  playerId: PlayerId;
  commandInstanceIds: string[];
};

export type CancelCommandPaymentAction = {
  type: "cancel_command_payment";
  playerId: PlayerId;
};

export type BeginZordSetupAction = {
  type: "begin_zord_setup";
  playerId: PlayerId;
  zordInstanceId: string;
};

export type ResolveZordSetupAction = {
  type: "resolve_zord_setup";
  playerId: PlayerId;
  materialInstanceId?: string;
  destination?: ZordMaterialDestination;
  paymentPath?: "material" | "mothership";
};

export type CancelZordSetupAction = {
  type: "cancel_zord_setup";
  playerId: PlayerId;
};

export type ResolveDamagePaymentAction = {
  type: "resolve_damage_payment";
  playerId: PlayerId;
  instanceId: string;
};

export type GameAction =
  | ChargePowerAction
  | ChargeCommandAction
  | RushAction
  | MoveToBattleAction
  | StrikeAction
  | BattleAction
  | DrawAction
  | EndPhaseAction
  | PlayOperationAction
  | BonusDrawAction
  | ReleaseStartCommandsAction
  | ReturnAllBattleToRushAction
  | PassStrikeReactionAction
  | FiveTechInterceptAction
  | PlayCounterAction
  | UsePlasmaEnergyAction
  | PassBattleReactionAction
  | PassRushReactionAction
  | PassLeaveReactionAction
  | UseSuperShieldAction
  | ShironLightAction
  | HidoraEggAction
  | BattleDanceRetreatAction
  | ResolveRuinSurveyAction
  | ResolveSeabedDrawAction
  | ConfirmDenjiRevealAction
  | ConfirmShironRevealAction
  | ConfirmEffectChoiceAction
  | ResolveEffectChoiceAction
  | SkipEffectChoiceAction
  | PassBattleEntryAction
  | InitiateCommandPaymentAction
  | ResolveCommandPaymentAction
  | CancelCommandPaymentAction
  | BeginZordSetupAction
  | ResolveZordSetupAction
  | CancelZordSetupAction
  | ResolveDamagePaymentAction;
