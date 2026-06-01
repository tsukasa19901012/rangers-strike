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

/** 効果名を持たないテキスト — static rules, ※ restrictions, zord material lines. */
export type UnnamedUnitText = {
  kind: "note" | "zord" | "fusion";
  text: string;
  /** Zord-up fusion partners (合体― line). */
  partnerCardIds?: string[];
};

export type UnitEffectBlock = {
  unnamedText: UnnamedUnitText[];
  namedEffects: NamedUnitEffect[];
  /** Full source text (grnrngr / wiki). */
  rawText: string;
};
