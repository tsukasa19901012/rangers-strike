/** 修飾子の有効スコープ。ターン終了 / ラッシュフェイズ終了でフィルタする。 */
export type ModifierScope = "turn" | "rush_phase" | "permanent";

export type ScopedModifier =
  | {
      kind: "rule";
      ruleId: string;
      scope: ModifierScope;
      sourceCardId?: string;
      payload?: unknown;
    }
  | {
      kind: "stat";
      instanceId: string;
      stat: "bp" | "sp";
      delta: number;
      scope: ModifierScope;
    }
  | {
      kind: "restriction";
      instanceId: string;
      restriction: string;
      scope: ModifierScope;
    };

/** ターンスコープのルール修飾子 ID（TurnModifiers boolean から移行）。 */
export const TURN_RULE_IDS = {
  ZENIBOMB: "zenibomb",
  INFINITE_CHAIN: "infinite_chain",
  DEACE_SNIPER: "deace_sniper",
  SUPER_DYNAMITE: "super_dynamite",
  COMBO_NUMBER_DELTA: "combo_number_delta",
  S_COMBO_FINISHER: "s_combo_finisher",
  AURA_POWER: "aura_power",
} as const;

export type TurnRuleId = (typeof TURN_RULE_IDS)[keyof typeof TURN_RULE_IDS];

/** ラッシュフェイズスコープのルール修飾子 ID。 */
export const RUSH_PHASE_RULE_IDS = {
  SHIRON_LIGHT: "shiron_light",
  HIDORA_EGG: "hidora_egg",
} as const;

export type RushPhaseRuleId = (typeof RUSH_PHASE_RULE_IDS)[keyof typeof RUSH_PHASE_RULE_IDS];

/** restriction 修飾子の既知 restriction 文字列。 */
export const RESTRICTION_IDS = {
  CANNOT_ENTER_BATTLE: "cannot_enter_battle",
  RUSHED_THIS_TURN: "rushed_this_turn",
  BAKI_BAKI_EXTRA_ATTACK: "baki_baki_extra_attack_only",
  WING_TURN_NO_STRIKE: "wing_turn_no_strike",
  NO_STRIKE_AFTER_RIDEOFF: "no_strike_after_rideoff",
} as const;
