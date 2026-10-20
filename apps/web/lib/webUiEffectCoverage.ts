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

import { OPERATION_UI_MECHANISMS as OPERATION_UI_MECHANISMS_DATA } from "./operationUiMechanisms";

/** 配線済み各 operation effectId の UI 経路。 */
export const OPERATION_UI_MECHANISMS: Record<string, WebUiMechanism[]> =
  OPERATION_UI_MECHANISMS_DATA;

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
  "declare_number",
  "select_units_bp_budget",
  "select_unit",
  "end_turn_menu",
  "confirm",
  "simultaneous_order",
  "declare_number",
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
  // RS-019 超力／RK-186【Jパンチ】: アタック時のホールド数選択（EffectChoiceModal の数字ボタン）。
  "attack_hold_bonus",
  // RS-284【スワンウィング】: 同時に出たユニットの処理順（select_unit の汎用ターゲット選択）。
  "swan_wing_order",
  "kuroko_memory",
  "super_geki_yellow_reanimate",
  "reorder_enemy_battle",
  // 仮面ライダー系 能動効果（riderKickEffects ランタイム）
  "rider_slash_destroy",
  "rider_kick_send_power",
  "rider_kick_discard_power_sp1",
  "hold_ot_commands_then_sp",
  "senko_sosa_declare",
  "extend_rider_drop",
  "kamen_ride_deploy",
  "power_faceup_sp1_grant",
  // 第4弾（legend1）の名前付き効果（engine: rules/legend1/set4NamedEffects.ts）。汎用ターゲット選択で操作する。
  "baku_mirajunakuru_discard_to_damage",
  "chikara_baton_opponent_pick_rush",
  "shitakunarugasorin_deck_bottom",
  "baku_desusuteinga_destroy_lower",
  "furawakanibaru_hand_to_command",
  "kanabiku_counter_to_damage",
  "purobaidabesu_deck_top",
  "suraida_ignore_entry_hold",
  "toripururikidobonba_take",
  // 第7弾 RS-474〜RS-494（engine: rules/legend1/set7NamedEffectsC.ts）の数字の選択（EffectChoiceModal の数字ボタン）。
  "rs485_hamster_destroy_draw",
  "rs493_quiz_declare",
  // 第8弾 RS-588/RS-590（engine: rules/legend1/set8NamedEffectsD.ts）の NC／RC の選択（EffectChoiceModal の数字ボタン）。
  "set8d_borrow_hand_combo_branch",
  // ※タッグ（R-KW-TAG-01）: どの常駐の太字部分を実行するか（engine: rules/legend1/set8NamedEffectsA.ts）と、入れ替えた太字部分の選択。
  "tag_bold_pick",
  "tag_bold_rs519_male",
  "tag_bold_rs519_female",
  "tag_bold_rs521",
  "tag_bold_rs522",
  "tag_bold_rs524",
  "tag_bold_rs525",
  "tag_bold_rs608",
  "tag_bold_rs609",
  "tag_bold_rs609_destination",
  "tag_bold_rk170",
  "tag_bold_rk239",
  "tag_bold_rk242",
  "tag_bold_rk244",
  "tag_bold_rk248",
  // RS-623【翼合体】等「DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい」（engine: rules/stackOntoLargeUnit.ts）。
  "stack_self_onto_l",
  // RK-249 アドベント（engine: rules/rk/rk249Advent.ts）。
  "rk249_advent",
]);

export function isKnownEffectChoice(pending: PendingEffectChoice): boolean {
  // 「～してもよい」の任意効果の確認（行う／行わない）は汎用モーダルで操作できる。
  if (pending.mayConfirm) return true;
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
