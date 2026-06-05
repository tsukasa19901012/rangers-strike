/**
 * Official effect text taxonomy (wikiwiki.jp/renst).
 *
 * - 効果名: white/inverted text on the card only; wiki shows as 【name】.
 * - 効果名を持つテキスト / 効果名を持つ効果: body below a name; fires when NC (CN)
 *   or other conditions written in that body are met.
 * - 効果名を持たないテキスト: ※ lines and shared rules (e.g. レジスト) without a name.
 */

/** How a named effect is triggered in the engine. */
export type NamedEffectTrigger =
  /** NC/CN: comboNumber matches battle position (after RS-015 delta). */
  | { type: "nc" }
  /** NC/CN or combo-from partner units already in battle (errata/text override). */
  | { type: "nc_or_combo_from"; partnerCardIds: string[] }
  /** Enters the battle zone (not NC-gated). */
  | { type: "enter_battle" }
  /** When this unit is rushed. */
  | { type: "on_rush" }
  /** When this unit attacks (optional combo partner override in card text). */
  | { type: "on_attack"; comboPartnerCardIds?: string[] }
  /** Joint combo L: grants effect to same-category L partner immediately to the right. */
  | { type: "joint_combo_l" }
  /** Joint combo R: this unit gains the effect when immediately right of same-category L. */
  | { type: "joint_combo_r" }
  /** Riding combo RC: fires when entering battle after ride-off from a vehicle. */
  | { type: "riding_combo" }
  /** Continuous while on field (metadata; engine may implement separately). */
  | { type: "while_in_field" }
  /** Other conditional text; not yet implemented. */
  | { type: "conditional" };

/** Zord-up rush additional condition (powerCost suffix "+"). See zord.ts. */
export type ZordConditionId =
  | "discard_fusion_unit"
  | "send_s_unit_to_power"
  | "send_s_unit_to_discard"
  | "send_s_unit_to_command_or_discard";

/** Rush additional condition (atwiki 追加条件：…). */
export type RushAdditionalCondition = {
  conditionId: ZordConditionId;
  /** Official wording (e.g. 自軍Sユニットを1体パワーゾーンに送る). */
  text: string;
  /** For send-S conditions (default 1). */
  unitCount?: number;
};

/** 効果名を持つ効果 — maps to engine effectId when implemented. */
export type NamedUnitEffect = {
  /** Display name inside 【】 (not including brackets). */
  name: string;
  /** Engine handler id (comboEffects / battle rules). */
  effectId: string;
  /** Body text below the effect name. */
  text: string;
  trigger: NamedEffectTrigger;
};

/**
 * Machine-readable id for 効果名を持たないテキスト (※ lines).
 * Engine and deck rules should use these instead of substring matching on `text`.
 */
export type UnnamedUnitRule =
  | "battle_entry_hold"
  | "auto_battle_entry_each_turn"
  | "auto_battle_entry_on_rush"
  | "destroy_self_damage"
  | "deck_copy_unlimited"
  | "needs_ally_s_in_battle"
  | "win_but_destroyed_vs_sp1"
  | "return_to_hand_at_6_damage"
  | "no_battle_entry_turn_rushed"
  | "no_attack_turn_rushed"
  | "no_strike_turn_rushed"
  | "cannot_enter_battle"
  /** Zord fusion material may be treated as another card name (display / deck building). */
  | "fusion_material_alias"
  /** Optional on enter; engine may implement later. */
  | "opponent_may_draw_on_enter"
  /** Rush: send non-damage power cards to discard (RS-128 / RS-129). */
  | "rush_power_to_discard"
  /** Cannot enter battle during own turn (RS-170). */
  | "cannot_enter_battle_own_turn"
  /** Battle entry: discard S unit from own rush first (RS-132). */
  | "battle_entry_discard_s_from_rush"
  /** May attack enemy S units in rush zone (RS-154). */
  | "can_attack_enemy_rush_s"
  /** Cannot attack enemy S units in battle zone (RS-154). */
  | "cannot_attack_enemy_battle_s"
  /** Only units with feature 航空機 may attack this unit (RS-135). */
  | "requires_aircraft_attacker"
  /** Battle entry: ally with cardId in partnerCardIds must already be in battle (RS-147). */
  | "battle_entry_combo_from"
  /** Battle entry: discard cards from hand first (RS-165). */
  | "battle_entry_discard_from_hand"
  /** While in battle, unit also counts as MA category (RS-166). */
  | "battle_adds_ma_category";

/** 効果名を持たないテキスト — static rules, ※ restrictions, zord material lines. */
export type UnnamedUnitText = {
  kind: "note" | "zord" | "fusion";
  text: string;
  /** Engine rule id when this note is implemented or catalogued. */
  rule?: UnnamedUnitRule;
  /** For `battle_entry_hold`: commands required (default 1). */
  holdCount?: number;
  /** For `destroy_self_damage`: damage to controller when destroyed to discard. */
  damage?: number;
  /** For `rush_power_to_discard`: face-up power cards to discard on rush. */
  discardCount?: number;
  /** For `battle_entry_combo_from`: required ally already in battle. */
  partnerCardIds?: string[];
  /** Zord-up fusion partners (合体― line). */
  partnerCardIds?: string[];
};

export type UnitEffectBlock = {
  /** Rush zord-up requirement (wiki 追加条件 field, separate from テキスト). */
  rushAdditionalCondition?: RushAdditionalCondition;
  unnamedText: UnnamedUnitText[];
  namedEffects: NamedUnitEffect[];
  /** Card effect text (【】 abilities / ※ notes); excludes 追加条件. */
  rawText: string;
};
