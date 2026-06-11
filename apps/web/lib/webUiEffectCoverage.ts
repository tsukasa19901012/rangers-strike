import {
  IMPLEMENTED_COUNTER_EFFECT_IDS,
  IMPLEMENTED_INSTANT_EFFECT_IDS,
  IMPLEMENTED_PERMANENT_EFFECT_IDS,
  isCardDslReady,
  listImplementedOperations,
} from "@rangers-strike/cards";
import {
  IMPLEMENTED_CONDITIONAL_EFFECT_IDS,
  IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS,
  IMPLEMENTED_ON_ATTACK_EFFECT_IDS,
  IMPLEMENTED_ON_RUSH_EFFECT_IDS,
  IMPLEMENTED_PASSIVE_EFFECT_IDS,
} from "@rangers-strike/cards";
import type { PendingEffectChoice } from "@rangers-strike/engine";

export type WebUiMechanism =
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
  | "effect_choice_banner"
  | "shiron_light_flow"
  | "battle_entry_modal"
  | "damage_payment_modal"
  | "zord_setup_banner"
  | "command_payment_modal"
  | "battle_drag_attack"
  | "board_target_tap"
  | "passive_engine_only";

/** 配線済み各 operation effectId の UI 経路。 */
export const OPERATION_UI_MECHANISMS: Record<string, WebUiMechanism[]> = {
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

const KNOWN_EFFECT_CHOICE_KINDS = new Set<PendingEffectChoice["kind"]>([
  "deck_top_or_bottom",
  "seabed_draw",
  "optional_deck_draw",
  "denji_machine",
  "scry_keep_one",
  "select_commands",
  "select_power",
  "shiron_light",
  "select_hand",
  "select_command",
  "pit_in_dive_order",
  "select_unit_step",
  "select_units_bp_budget",
  "select_unit",
  "end_turn_menu",
  "confirm",
  "simultaneous_order",
]);

/** Promoted DSL カードが汎用モーダルで操作できる choice kind。 */
const PROMOTED_GENERIC_CHOICE_KINDS = new Set<PendingEffectChoice["kind"]>([
  "select_unit",
  "select_unit_step",
  "select_hand",
  "select_command",
  "select_commands",
  "select_power",
  "optional_deck_draw",
  "deck_top_or_bottom",
  "scry_keep_one",
  "confirm",
  "end_turn_menu",
  "simultaneous_order",
]);

const KNOWN_EFFECT_IDS = new Set<string>([
  ...Object.keys(OPERATION_UI_MECHANISMS),
  ...IMPLEMENTED_ON_RUSH_EFFECT_IDS,
  ...IMPLEMENTED_CONDITIONAL_EFFECT_IDS,
  ...IMPLEMENTED_ON_ATTACK_EFFECT_IDS,
  ...IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS,
  ...IMPLEMENTED_PASSIVE_EFFECT_IDS,
  "jet_skateboard",
  "end_turn_battle_to_rush",
  "rocket_booster",
  "simultaneous_order",
]);

export function isKnownEffectChoice(pending: PendingEffectChoice): boolean {
  if (
    KNOWN_EFFECT_IDS.has(pending.effectId) &&
    KNOWN_EFFECT_CHOICE_KINDS.has(pending.kind)
  ) {
    return true;
  }
  if (
    PROMOTED_GENERIC_CHOICE_KINDS.has(pending.kind) &&
    isCardDslReady(pending.sourceCardId)
  ) {
    return true;
  }
  return false;
}

const UNIT_TRIGGER_UI: Record<string, WebUiMechanism[]> = {
  on_rush: ["board_target_tap", "effect_choice_modal", "effect_choice_banner"],
  conditional: ["battle_entry_modal", "effect_choice_modal", "effect_choice_banner", "board_target_tap"],
  on_attack: ["battle_drag_attack", "passive_engine_only"],
  enter_battle: ["battle_entry_modal", "effect_choice_modal", "passive_engine_only"],
  passive: ["passive_engine_only", "effect_choice_modal", "damage_payment_modal"],
};

export function listOperationCoverageGaps(): string[] {
  const gaps: string[] = [];
  for (const op of listImplementedOperations()) {
    if (!OPERATION_UI_MECHANISMS[op.effectId]) {
      gaps.push(`operation:${op.effectId} (${op.cardId})`);
    }
  }
  return gaps;
}

export function listUnitEffectCoverageGaps(): string[] {
  const gaps: string[] = [];
  const groups: Array<[readonly string[], string]> = [
    [IMPLEMENTED_ON_RUSH_EFFECT_IDS, "on_rush"],
    [IMPLEMENTED_CONDITIONAL_EFFECT_IDS, "conditional"],
    [IMPLEMENTED_ON_ATTACK_EFFECT_IDS, "on_attack"],
    [IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS, "enter_battle"],
    [IMPLEMENTED_PASSIVE_EFFECT_IDS, "passive"],
  ];
  for (const [ids, trigger] of groups) {
    const mechanisms = UNIT_TRIGGER_UI[trigger];
    if (!mechanisms) {
      for (const effectId of ids) {
        gaps.push(`unit:${effectId} (unknown trigger ${trigger})`);
      }
    }
  }
  return gaps;
}

export function summarizeOperationCoverage(): {
  total: number;
  instant: number;
  permanent: number;
  counter: number;
} {
  const ops = listImplementedOperations();
  return {
    total: ops.length,
    instant: ops.filter((o) => o.kind === "instant").length,
    permanent: ops.filter((o) => o.kind === "permanent").length,
    counter: ops.filter((o) => o.kind === "counter").length,
  };
}

export function assertAllImplementedOperationsCovered(): void {
  const gaps = listOperationCoverageGaps();
  if (gaps.length > 0) {
    throw new Error(`Missing Web UI coverage for operations:\n${gaps.join("\n")}`);
  }
}

export function assertCatalogMatchesMechanisms(): void {
  const wired = new Set<string>([
    ...IMPLEMENTED_INSTANT_EFFECT_IDS,
    ...IMPLEMENTED_PERMANENT_EFFECT_IDS,
    ...IMPLEMENTED_COUNTER_EFFECT_IDS,
  ]);
  for (const effectId of wired) {
    if (!OPERATION_UI_MECHANISMS[effectId]) {
      throw new Error(`OPERATION_UI_MECHANISMS missing ${effectId}`);
    }
  }
  for (const effectId of Object.keys(OPERATION_UI_MECHANISMS)) {
    if (!wired.has(effectId)) {
      throw new Error(`OPERATION_UI_MECHANISMS has unknown effectId ${effectId}`);
    }
  }
}
