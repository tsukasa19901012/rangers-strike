import {
  formatGameLog,
  isNoteworthyResolveEffectChoice,
  shouldSuppressChoiceNoticeEffect,
} from "@rangers-strike/engine";
import type { CardDefinition } from "@rangers-strike/cards";

const SKIP_ACTIONS = new Set([
  "draw",
  "bonus_draw",
  "end_phase",
  "end_turn",
  "deck_out",
  "charge_power",
  "charge_command",
  "hold_command",
  "release_command",
  "release_start_commands",
  "return_all_battle_to_rush",
  "rush",
  "move_to_battle",
  "battle_pending",
  "pass_battle_entry",
  "battle",
  "strike",
  "strike_pending",
  "resolve_effect_choice",
  "skip_effect_choice",
  "pass_strike_reaction",
  "pass_battle_reaction",
  "pass_rush_reaction",
  "pass_leave_reaction",
  "battle_pending",
  "game_created",
  "simple",
]);

const EFFECT_ACTIONS = new Set([
  "number_combo",
  "enter_battle",
  "named_effect",
  "rush_effect",
  "joint_combo_l",
  "joint_combo_r",
  "riding_combo",
  "play_operation",
  "play_counter",
  "use_plasma_energy",
  "five_tech_intercept",
  "resolve_ruin_survey",
  "resolve_seabed_draw",
  "confirm_denji_reveal",
  "confirm_effect_choice",
  "earth_force_upkeep",
  "battle_dance_retreat",
]);

export function shouldShowEffectLogNotice(entry: string): boolean {
  const parts = entry.split("|");
  const action = parts[1];
  if (!action || SKIP_ACTIONS.has(action)) return false;
  const detail = parts[4] ?? "";
  if (action === "resolve_effect_choice") {
    return isNoteworthyResolveEffectChoice(detail);
  }
  if (
    action === "enter_battle" &&
    (detail === "destroy_choice" || detail === "ruin_excavation")
  ) {
    return false;
  }
  if (action === "named_effect" && detail.startsWith("choice:")) {
    const effectId = detail.slice("choice:".length);
    if (shouldSuppressChoiceNoticeEffect(effectId)) return false;
  }
  if (EFFECT_ACTIONS.has(action)) return true;
  if (detail.startsWith("choice:")) return false;
  return action === "enter_battle" || action === "named_effect";
}

const DEV_EFFECT_ACTIONS = new Set([
  "named_effect",
  "number_combo",
  "play_operation",
  "rush_effect",
  "enter_battle",
  "resolve_effect_choice",
  "resident_operation",
]);

function isDevEffectLogDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/** 開発モードのみ DSL effectId / detail を末尾に付与。 */
export function appendDevEffectLogDetail(entry: string, formatted: string): string {
  if (!isDevEffectLogDebugEnabled()) return formatted;
  const parts = entry.split("|");
  const action = parts[1];
  if (!action || !DEV_EFFECT_ACTIONS.has(action)) return formatted;
  const detail = parts.length >= 5 ? parts.slice(4).join("|") : undefined;
  if (!detail) return formatted;
  return `${formatted} [${detail}]`;
}

export function formatEffectLogNotice(
  entry: string,
  definitions: Record<string, CardDefinition>,
): string {
  return appendDevEffectLogDetail(entry, formatGameLog(entry, definitions));
}

export function formatLogEntryForDisplay(
  entry: string,
  definitions: Record<string, CardDefinition>,
): string {
  return appendDevEffectLogDetail(entry, formatGameLog(entry, definitions));
}
