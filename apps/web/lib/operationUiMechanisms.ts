/** 配線済み operation effectId → Web UI 経路（cards 非依存・生成スクリプト用）。 */
export type OperationUiMechanism =
  | "operation_drag_direct"
  | "operation_drag_target_modal"
  | "operation_cyber_s_rider_modal"
  | "operation_denji_effect_choice"
  | "operation_permanent_place"
  | "operation_permanent_click"
  | "operation_counter_reaction"
  | "operation_plasma_strike"
  | "operation_five_tech_intercept"
  | "operation_earth_force_upkeep"
  | "operation_lightning_gravity_notice"
  | "effect_choice_modal"
  | "command_payment_modal"
  | "shiron_light_flow"
  | "board_target_tap"
  | "passive_engine_only";

export const OPERATION_UI_MECHANISMS: Record<string, OperationUiMechanism[]> = {
  place_in_power: ["operation_drag_direct"],
  dynamite_power: ["operation_drag_target_modal"],
  aura_power: ["operation_drag_target_modal"],
  judgment: ["operation_drag_target_modal"],
  bp_boost_4000: ["operation_drag_target_modal"],
  discard_to_hand: ["operation_drag_target_modal"],
  discard_s_unit_to_hand: ["operation_drag_target_modal"],
  science_academy: ["operation_drag_target_modal"],
  goren_storm: ["operation_drag_direct"],
  jacker_hurricane: ["operation_drag_direct"],
  bird_nick_wave: ["operation_drag_direct"],
  denji_machine: ["operation_drag_direct", "operation_denji_effect_choice"],
  land_balkan: ["operation_drag_direct"],
  cyber_s_rider: ["operation_cyber_s_rider_modal"],
  compression_freeze: ["operation_drag_target_modal"],
  power_bazooka: ["operation_drag_target_modal"],
  infinite_chain: ["operation_drag_direct"],
  animal_heart: ["operation_drag_target_modal"],
  super_dynamite: ["operation_permanent_place"],
  battle_dance: ["operation_permanent_place", "operation_permanent_click", "board_target_tap"],
  super_brain: ["operation_permanent_place", "passive_engine_only"],
  prism_power: ["operation_permanent_place", "command_payment_modal"],
  shiron_light: ["operation_permanent_place", "operation_permanent_click", "shiron_light_flow"],
  five_tech: ["operation_permanent_place", "operation_five_tech_intercept"],
  ki_power: ["operation_permanent_place", "passive_engine_only"],
  super_power: ["operation_permanent_place", "passive_engine_only"],
  earth_force: ["operation_permanent_place", "operation_earth_force_upkeep"],
  courage_magic: ["operation_permanent_place", "passive_engine_only"],
  adventure: ["operation_permanent_place", "passive_engine_only"],
  plasma_energy: ["operation_permanent_place", "operation_plasma_strike"],
  lightning_gravity: [
    "operation_permanent_place",
    "operation_lightning_gravity_notice",
    "command_payment_modal",
  ],
  hidora_egg: ["operation_permanent_place", "operation_permanent_click"],
  super_electron_radar: ["operation_permanent_place", "passive_engine_only"],
  new_gymnastics: ["operation_counter_reaction"],
  dino_chronicle: ["operation_counter_reaction"],
  hidden_ninja: ["operation_counter_reaction", "board_target_tap"],
  shippu_ninja: ["operation_counter_reaction"],
  dino_guts: ["operation_counter_reaction"],
};
