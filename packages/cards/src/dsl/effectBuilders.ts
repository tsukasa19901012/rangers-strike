import type { CardEffectMeta } from "../effects";
import type { NamedUnitEffect } from "../effectTaxonomy";
import type { EffectDefinition, EffectPrimitive, OperationTiming, TargetSelector } from "./types";

function kw(keyword: string, duration: "turn" | "permanent" = "turn"): EffectPrimitive {
  return { type: "grant_keyword", keyword, duration };
}

function zone(
  z: "hand" | "discard" | "power" | "command" | "rush" | "battle" | "deck",
  owner: "self" | "opponent" | "any",
  filter?: {
    size?: "S" | "M" | "L" | "XL" | "SC";
    maxBp?: number;
    minBp?: number;
    commandHeld?: boolean;
  },
) {
  return { type: "zone" as const, zone: z, owner, filter };
}

function ownUnitsUnion() {
  return {
    type: "zones" as const,
    zones: [zone("rush", "self"), zone("battle", "self")],
  };
}

function chooseUnit(
  valid: TargetSelector,
  count: number,
  then: EffectPrimitive[],
  kind: "select_unit" | "select_command" = "select_unit",
): EffectPrimitive {
  return { type: "choose", kind, valid, count, then };
}

type EffectBuilder = (named: NamedUnitEffect, cardId?: string) => EffectDefinition;

const EFFECT_BUILDERS: Record<string, EffectBuilder> = {
  place_in_power: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "rush" },
    effects: [{ type: "move", target: { type: "self" }, to: "power" }],
  }),
  bp_boost_4000: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "rush" },
    effects: [
      chooseUnit(ownUnitsUnion(), 1, [
        { type: "modify_bp", target: { type: "trigger_source" }, amount: 4000, duration: "turn" },
      ]),
    ],
  }),
  bp_boost_2000: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: named.trigger ?? { type: "nc" },
    effects: [
      {
        type: "modify_bp",
        target: { type: "trigger_source" },
        amount: 2000,
        duration: "turn",
      },
    ],
  }),
  discard_s_unit_to_hand: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "rush" },
    condition: { type: "has_target", target: zone("discard", "self", { size: "S" }) },
    effects: [
      chooseUnit(zone("discard", "self", { size: "S" }), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "hand" },
      ]),
    ],
  }),
  discard_to_hand: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "rush" },
    condition: { type: "has_target", target: zone("discard", "self") },
    effects: [
      chooseUnit(zone("discard", "self"), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "hand" },
      ]),
    ],
  }),
  future_sight: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [{ type: "draw", amount: 1, player: "controller" }],
  }),
  grant_sp1: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: named.trigger ?? { type: "nc" },
    effects: [kw("SP1")],
  }),
  eagle_diving: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [kw("SP1"), { type: "modify_bp", target: { type: "trigger_source" }, amount: 2000, duration: "turn" }],
  }),
  magical_dragon_shoot: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [
      { type: "modify_bp", target: { type: "trigger_source" }, amount: 4000, duration: "turn" },
    ],
  }),
  bouken_javelin: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [kw("SP1")],
  }),
  armor_attack: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "on_rush" },
    optional: true,
    condition: { type: "has_target", target: zone("battle", "opponent", { maxBp: 8000 }) },
    effects: [
      chooseUnit(zone("battle", "opponent", { maxBp: 8000 }), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "power" },
      ]),
    ],
  }),
  destroy_enemy_bp4000: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "enter_battle" },
    optional: false,
    condition: { type: "has_target", target: zone("battle", "opponent", { maxBp: 4000 }) },
    effects: [
      chooseUnit(zone("battle", "opponent", { maxBp: 4000 }), 1, [
        { type: "discard", target: { type: "trigger_source" } },
      ]),
    ],
  }),
  pink_storm: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    effects: [
      chooseUnit(zone("battle", "any", { maxBp: 3000 }), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "deck", position: "left" },
      ]),
    ],
  }),
  green_ground: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    effects: [
      kw("SP1"),
      chooseUnit(zone("command", "opponent"), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "hand" },
      ], "select_command"),
    ],
  }),
  radial_hammer: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    effects: [
      kw("SP1"),
      {
        type: "choose",
        kind: "scry_keep_one",
        valid: zone("deck", "self"),
        count: 3,
        then: [{ type: "move", target: { type: "trigger_source" }, to: "deck", position: "left" }],
      },
    ],
  }),
  moss_breaker: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    effects: [kw("force_opponent_hold_command", "turn")],
  }),
  pat_signer: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "while_in_field" },
    effects: [kw("block_m_battle_entry_bp5000_plus", "permanent")],
  }),
  shark_jaws: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: named.trigger,
    effects: [kw("use_printed_bp_in_battle", "turn")],
  }),
  panther_claw: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: named.trigger,
    effects: [kw("prevent_counter", "turn")],
  }),
  super_cutter: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: named.trigger,
    effects: [kw("use_printed_bp_in_battle", "turn")],
  }),
  yellow_thunder: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [kw("SP1"), kw("attack_rush_zone", "turn")],
  }),
  red_fire: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [kw("SP1"), kw("bp_plus_per_released_command_on_attack", "turn")],
  }),
  signal_cannon: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "while_in_field" },
    effects: [kw("over_technology_m_bp_plus_on_attacked", "permanent")],
  }),
  prism_power: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "resident" },
    effects: [kw("category_substitute_via_hold", "permanent")],
  }),
  five_tech: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "resident" },
    effects: [kw("strike_intercept_with_s_unit", "permanent")],
  }),
  earth_force: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "resident" },
    effects: [kw("auto_battle_entry_from_rush", "permanent")],
  }),
  dino_guts: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "counter" },
    effects: [{ type: "cancel_damage" }, kw("prevent_leave_with_power_cost", "turn")],
  }),
  judgment: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "rush" },
    effects: [kw("reveal_top_destroy_if_same_size", "turn")],
  }),
  aura_power: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "rush" },
    effects: [
      chooseUnit(zone("rush", "self", { size: "S" }), 1, [
        { type: "grant_keyword", keyword: "bp_plus_per_own_damage", duration: "turn" },
      ]),
    ],
  }),
  ki_power: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "resident" },
    effects: [kw("s_bp_plus_per_released_command_on_opponent_turn", "permanent")],
  }),
  courage_magic: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "resident" },
    effects: [kw("release_command_on_s_battle_entry", "permanent")],
  }),
  adventure: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "on_turn_end" },
    condition: { type: "controller_is_phase_player" },
    effects: [
      chooseUnit(zone("command", "self", { commandHeld: true }), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "hand" },
      ], "select_command"),
    ],
  }),
  plasma_energy: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "counter" },
    effects: [kw("destroy_striker_on_strike_self_discard", "turn")],
  }),
  lightning_gravity: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "operation", timing: "resident" },
    effects: [kw("m_battle_entry_requires_hold", "permanent")],
  }),
  justice_flasher: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "conditional" },
    optional: true,
    effects: [kw("pay_power_discard_5_for_sp3", "turn")],
  }),
  judgment_sword: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "conditional" },
    optional: true,
    effects: [kw("pay_power_discard_2_for_sp1", "turn")],
  }),
  super_drill: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "conditional" },
    optional: true,
    effects: [kw("discard_named_from_hand_for_sp1", "turn")],
  }),
  super_shield: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "while_in_field" },
    effects: [kw("substitute_on_wb_destroy", "permanent")],
  }),
  pit_in_dive: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    effects: [kw("SP1"), kw("force_enemy_s_rush_to_battle", "turn")],
  }),
  ruin_survey: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    effects: [legacyEnqueueTrigger("ruin_survey")],
  }),
  blow_knuckle: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [legacyEnqueueTrigger("blow_knuckle")],
  }),
  tricera_lance: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [
      chooseUnit(zone("command", "opponent"), 1, [
        { type: "hold_command", target: { type: "trigger_source" } },
      ], "select_command"),
    ],
  }),
  ptera_arrow: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    condition: {
      type: "has_target",
      target: zone("command", "opponent", { commandHeld: true }),
    },
    effects: [
      chooseUnit(zone("command", "opponent", { commandHeld: true }), 1, [
        { type: "discard", target: { type: "trigger_source" } },
      ], "select_command"),
    ],
  }),
  life_rescue: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    optional: true,
    condition: { type: "has_target", target: zone("discard", "self", { size: "S" }) },
    effects: [
      chooseUnit(zone("discard", "self", { size: "S" }), 1, [
        { type: "move", target: { type: "trigger_source" }, to: "hand" },
      ]),
    ],
  }),
  iron_broken: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    condition: { type: "controller_is_phase_player" },
    effects: [
      { type: "modify_bp", target: { type: "trigger_source" }, amount: 3000, duration: "turn" },
    ],
  }),
  blazing_fire: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    condition: { type: "controller_is_phase_player" },
    effects: [
      kw("SP1"),
      { type: "modify_bp", target: { type: "trigger_source" }, amount: 2000, duration: "turn" },
    ],
  }),
  fire_sword: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "nc" },
    effects: [legacyEnqueueTrigger("fire_sword")],
  }),
  sky_magic_slash: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "enter_battle" },
    optional: true,
    effects: [kw("hold_all_enemy_commands", "turn")],
  }),
  phantom_illusion: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "enter_battle" },
    optional: true,
    effects: [kw("hold_all_enemy_commands", "turn")],
  }),
  sure_win_combination: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "on_rush" },
    effects: [{ type: "deal_damage", amount: 2, target: "controller" }],
  }),
};

const UNNAMED_KEYWORD_BUILDERS: Record<
  string,
  (rule: { holdCount?: number; damage?: number }) => EffectPrimitive[]
> = {
  battle_entry_hold: (u) => [kw(`battle_entry_hold_${u.holdCount ?? 1}`, "permanent")],
  destroy_self_damage: (u) => [kw(`destroy_self_damage_${u.damage ?? 1}`, "permanent")],
  auto_battle_entry_each_turn: () => [kw("auto_battle_entry_each_turn", "permanent")],
  fusion_material_alias: () => [kw("fusion_material_alias", "permanent")],
  win_but_destroyed_vs_sp1: () => [kw("win_but_destroyed_vs_sp1", "permanent")],
  no_battle_entry_turn_rushed: () => [kw("no_battle_entry_turn_rushed", "permanent")],
};

/** P0 effect_catalog エイリアス → primitives（M3 一般化） */
const P0_ALIASES: Record<string, EffectPrimitive[]> = {
  deal_damage_1: [{ type: "deal_damage", amount: 1, target: "controller" }],
  deal_damage_2: [{ type: "deal_damage", amount: 2, target: "controller" }],
  deal_damage: [{ type: "deal_damage", amount: 1, target: "controller" }],
  bp_boost_1000: [{ type: "modify_bp", target: { type: "trigger_source" }, amount: 1000, duration: "turn" }],
  bp_boost_2000: [{ type: "modify_bp", target: { type: "trigger_source" }, amount: 2000, duration: "turn" }],
  bp_boost_3000: [{ type: "modify_bp", target: { type: "trigger_source" }, amount: 3000, duration: "turn" }],
  bp_boost_5000: [{ type: "modify_bp", target: { type: "trigger_source" }, amount: 5000, duration: "turn" }],
  grant_sp2: [kw("SP2")],
  grant_sp3: [kw("SP3")],
  alias_fusion_material: [kw("fusion_material_alias", "permanent")],
  require_command_hold_entry: [kw("require_command_hold_entry", "turn")],
};

const NC_TRIGGERS = new Set(["nc", "nc_or_combo_from"]);

/** レガシー委譲可能なトリガー（enqueue_trigger → cardInterpreter → runtimeEffectDispatch）。 */
const RUNTIME_MIGRATABLE_TRIGGERS = new Set([
  "on_rush",
  "enter_battle",
  "on_attack",
  "on_destroy",
  "on_leave",
  "on_strike",
  "conditional",
  "on_turn_end",
  "joint_combo_l",
  "joint_combo_r",
]);

function passiveEffectKeyword(effectId: string): EffectPrimitive {
  return { type: "grant_keyword", keyword: `effect_${effectId}`, duration: "permanent" };
}

/** レガシー TS ハンドラへ委譲（M9: runtime_* から enqueue_trigger へ移行）。 */
function legacyEnqueueTrigger(effectId: string): EffectPrimitive {
  return { type: "enqueue_trigger", effectId };
}

/** @deprecated runtime_* grant_keyword — regenerate DSL to use enqueue_trigger */
function runtimeEffectKeyword(effectId: string): EffectPrimitive {
  return { type: "grant_keyword", keyword: `runtime_${effectId}`, duration: "permanent" };
}

function opTiming(kind: CardEffectMeta["kind"]): OperationTiming {
  if (kind === "permanent") return "resident";
  if (kind === "counter") return "counter";
  return "rush";
}

export function buildNamedEffectDsl(named: NamedUnitEffect, cardId?: string): EffectDefinition {
  const builder = EFFECT_BUILDERS[named.effectId];
  if (builder) return builder(named, cardId);

  const p0 = P0_ALIASES[named.effectId];
  if (p0) {
    return {
      id: named.effectId,
      name: named.name,
      text: named.text,
      trigger: named.trigger,
      effects: p0,
    };
  }

  if (named.trigger.type === "while_in_field") {
    return {
      id: named.effectId,
      name: named.name,
      text: named.text,
      trigger: named.trigger,
      effects: [passiveEffectKeyword(named.effectId)],
    };
  }

  if (NC_TRIGGERS.has(named.trigger.type)) {
    return {
      id: named.effectId,
      name: named.name,
      text: named.text,
      trigger: named.trigger,
      effects: [legacyEnqueueTrigger(named.effectId)],
    };
  }

  if (RUNTIME_MIGRATABLE_TRIGGERS.has(named.trigger.type)) {
    return {
      id: named.effectId,
      name: named.name,
      text: named.text,
      trigger: named.trigger,
      effects: [legacyEnqueueTrigger(named.effectId)],
    };
  }

  return {
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: named.trigger,
    effects: [{ type: "fallback_handler", effectId: named.effectId }],
  };
}

export function buildOperationEffectDsl(
  cardId: string,
  opMeta: CardEffectMeta,
): EffectDefinition | undefined {
  const builder = EFFECT_BUILDERS[opMeta.effectId];
  const named: NamedUnitEffect = {
    effectId: opMeta.effectId,
    name: cardId,
    text: opMeta.text,
    trigger: { type: "operation", timing: opTiming(opMeta.kind) },
  };
  if (builder) return builder(named, cardId);

  const p0 = P0_ALIASES[opMeta.effectId];
  if (p0) {
    return {
      id: opMeta.effectId,
      text: opMeta.text,
      trigger: { type: "operation", timing: opTiming(opMeta.kind) },
      effects: p0,
    };
  }

  if (opMeta.kind === "permanent") {
    return {
      id: opMeta.effectId,
      text: opMeta.text,
      trigger: { type: "operation", timing: "resident" },
      effects: [passiveEffectKeyword(opMeta.effectId)],
    };
  }

  return {
    id: opMeta.effectId,
    text: opMeta.text,
    trigger: { type: "operation", timing: opTiming(opMeta.kind) },
    effects: [legacyEnqueueTrigger(opMeta.effectId)],
  };
}

export function buildUnnamedRuleEffects(
  rule: {
    kind: string;
    text: string;
    rule?: string;
    holdCount?: number;
    damage?: number;
  },
): EffectDefinition | undefined {
  if (!rule.rule || !UNNAMED_KEYWORD_BUILDERS[rule.rule]) return undefined;
  return {
    id: `unnamed_${rule.rule}`,
    text: rule.text,
    trigger: { type: "while_in_field" },
    effects: UNNAMED_KEYWORD_BUILDERS[rule.rule]!(rule),
  };
}

export function hasEffectBuilder(effectId: string): boolean {
  return effectId in EFFECT_BUILDERS || effectId in P0_ALIASES;
}

export { EFFECT_BUILDERS, P0_ALIASES };
