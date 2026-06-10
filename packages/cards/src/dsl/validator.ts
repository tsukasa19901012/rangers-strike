import type {
  CardDocument,
  EffectTrigger,
  ValidationIssue,
  ValidationResult,
} from "./types";
import {
  CARD_ID_PATTERN,
  EFFECT_ID_PATTERN,
  ZORD_POWER_COST_PATTERN,
} from "./types";

const CATEGORIES = new Set(["ET", "WB", "OT", "MA", "DA"]);
const CARD_TYPES = new Set(["unit", "operation", "vehicle", "commander"]);
const RARITIES = new Set(["N", "R", "SR", "NR", "SC", "PR"]);
const SIZES = new Set(["S", "M", "L", "XL", "SC"]);
const ZONES = new Set([
  "deck", "hand", "discard", "power", "command",
  "rush", "battle", "operation", "exile", "commander",
]);
const TRIGGER_TYPES = new Set([
  "nc", "nc_or_combo_from", "enter_battle", "on_rush", "on_attack",
  "on_strike", "on_destroy", "on_leave", "on_turn_end", "on_damage",
  "joint_combo_l", "joint_combo_r", "riding_combo", "while_in_field",
  "operation", "conditional",
]);
const PRIMITIVE_TYPES = new Set([
  "draw", "move", "discard", "flip_power", "modify_bp", "modify_sp",
  "set_bp", "deal_damage", "cancel_damage", "prevent_battle",
  "hold_command", "release_command", "block_battle_entry", "grant_keyword",
  "choose", "open_reaction", "enqueue_trigger", "interpret_effect", "fallback_handler",
]);
const CHOICE_KINDS = new Set([
  "deck_top_or_bottom", "seabed_draw", "optional_deck_draw",
  "select_unit", "select_command", "select_power", "select_hand",
  "scry_keep_one", "end_turn_menu", "simultaneous_order", "confirm",
]);

function ok(): ValidationResult {
  return { ok: true, issues: [] };
}

function fail(issues: ValidationIssue[]): ValidationResult {
  return { ok: false, issues };
}

function merge(...results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((r) => r.issues);
  return { ok: issues.length === 0, issues };
}

function issue(path: string, message: string, code: string): ValidationIssue {
  return { path, message, code };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateCardId(value: unknown, path: string): ValidationIssue[] {
  if (typeof value !== "string" || !CARD_ID_PATTERN.test(value)) {
    return [issue(path, "must match pattern XX-NNN or XXN-NNN", "invalid_card_id")];
  }
  return [];
}

function validateEffectId(value: unknown, path: string): ValidationIssue[] {
  if (typeof value !== "string" || !EFFECT_ID_PATTERN.test(value)) {
    return [issue(path, "must be snake_case effect id", "invalid_effect_id")];
  }
  return [];
}

export function validateTrigger(value: unknown, path = "trigger"): ValidationResult {
  if (!isObject(value) || typeof value.type !== "string") {
    return fail([issue(path, "trigger must be an object with type", "invalid_trigger")]);
  }
  if (!TRIGGER_TYPES.has(value.type)) {
    return fail([issue(`${path}.type`, `unknown trigger type: ${value.type}`, "unknown_trigger")]);
  }

  const issues: ValidationIssue[] = [];

  if (value.type === "nc_or_combo_from") {
    if (!Array.isArray(value.partnerCardIds) || value.partnerCardIds.length === 0) {
      issues.push(issue(`${path}.partnerCardIds`, "required non-empty array", "missing_partner_ids"));
    } else {
      for (let i = 0; i < value.partnerCardIds.length; i += 1) {
        issues.push(...validateCardId(value.partnerCardIds[i], `${path}.partnerCardIds[${i}]`));
      }
    }
  }

  if (value.type === "on_attack" && value.comboPartnerCardIds !== undefined) {
    if (!Array.isArray(value.comboPartnerCardIds)) {
      issues.push(issue(`${path}.comboPartnerCardIds`, "must be array", "invalid_combo_partners"));
    } else {
      for (let i = 0; i < value.comboPartnerCardIds.length; i += 1) {
        issues.push(...validateCardId(value.comboPartnerCardIds[i], `${path}.comboPartnerCardIds[${i}]`));
      }
    }
  }

  if (value.type === "operation") {
    const timing = value.timing;
    if (timing !== "rush" && timing !== "battle" && timing !== "counter" && timing !== "resident") {
      issues.push(issue(`${path}.timing`, "must be rush|battle|counter|resident", "invalid_operation_timing"));
    }
  }

  return issues.length === 0 ? ok() : fail(issues);
}

function validateTargetSelector(value: unknown, path: string): ValidationIssue[] {
  if (!isObject(value) || typeof value.type !== "string") {
    return [issue(path, "target selector must have type", "invalid_target")];
  }

  switch (value.type) {
    case "self":
    case "controller":
    case "opponent":
    case "trigger_source":
      return [];
    case "instance":
      return typeof value.instanceId === "string" && value.instanceId.length > 0
        ? []
        : [issue(`${path}.instanceId`, "required", "missing_instance_id")];
    case "card_id":
      return validateCardId(value.cardId, `${path}.cardId`);
    case "zone": {
      const issues: ValidationIssue[] = [];
      if (typeof value.zone !== "string" || !ZONES.has(value.zone)) {
        issues.push(issue(`${path}.zone`, "invalid zone", "invalid_zone"));
      }
      if (value.owner !== "self" && value.owner !== "opponent" && value.owner !== "any") {
        issues.push(issue(`${path}.owner`, "must be self|opponent|any", "invalid_owner"));
      }
      return issues;
    }
    case "zones": {
      if (!Array.isArray(value.zones)) {
        return [issue(`${path}.zones`, "must be array", "invalid_zones")];
      }
      const issues: ValidationIssue[] = [];
      for (let i = 0; i < value.zones.length; i += 1) {
        issues.push(...validateTargetSelector(value.zones[i], `${path}.zones[${i}]`));
      }
      return issues;
    }
    default:
      return [issue(`${path}.type`, `unknown target type: ${value.type}`, "unknown_target")];
  }
}

export function validateCondition(value: unknown, path = "condition"): ValidationResult {
  if (!isObject(value) || typeof value.type !== "string") {
    return fail([issue(path, "condition must have type", "invalid_condition")]);
  }

  const issues: ValidationIssue[] = [];

  switch (value.type) {
    case "always":
    case "controller_is_phase_player":
      break;
    case "has_target":
      issues.push(...validateTargetSelector(value.target, `${path}.target`));
      break;
    case "bp_compare":
      issues.push(...validateTargetSelector(value.target, `${path}.target`));
      if (!["<", "<=", ">", ">="].includes(String(value.op))) {
        issues.push(issue(`${path}.op`, "invalid operator", "invalid_op"));
      }
      if (typeof value.value !== "number") {
        issues.push(issue(`${path}.value`, "must be number", "invalid_value"));
      }
      break;
    case "zone_count":
      if (typeof value.zone !== "string" || !ZONES.has(value.zone)) {
        issues.push(issue(`${path}.zone`, "invalid zone", "invalid_zone"));
      }
      if (value.owner !== "self" && value.owner !== "opponent") {
        issues.push(issue(`${path}.owner`, "must be self|opponent", "invalid_owner"));
      }
      if (typeof value.count !== "number") {
        issues.push(issue(`${path}.count`, "must be number", "invalid_count"));
      }
      break;
    case "and":
      if (!Array.isArray(value.conditions) || value.conditions.length === 0) {
        issues.push(issue(`${path}.conditions`, "non-empty array required", "empty_and"));
      } else {
        value.conditions.forEach((c, i) => {
          const r = validateCondition(c, `${path}.conditions[${i}]`);
          issues.push(...r.issues);
        });
      }
      break;
    case "not":
      issues.push(...validateCondition(value.condition, `${path}.condition`).issues);
      break;
    default:
      issues.push(issue(`${path}.type`, `unknown condition: ${value.type}`, "unknown_condition"));
  }

  return issues.length === 0 ? ok() : fail(issues);
}

export function validatePrimitive(value: unknown, path: string): ValidationResult {
  if (!isObject(value) || typeof value.type !== "string") {
    return fail([issue(path, "primitive must have type", "invalid_primitive")]);
  }
  if (!PRIMITIVE_TYPES.has(value.type)) {
    return fail([issue(`${path}.type`, `unknown primitive: ${value.type}`, "unknown_primitive")]);
  }

  const issues: ValidationIssue[] = [];

  switch (value.type) {
    case "draw":
      if (typeof value.amount !== "number" || value.amount < 1) {
        issues.push(issue(`${path}.amount`, "must be >= 1", "invalid_amount"));
      }
      break;
    case "move":
      issues.push(...validateTargetSelector(value.target, `${path}.target`));
      if (typeof value.to !== "string" || !ZONES.has(value.to)) {
        issues.push(issue(`${path}.to`, "invalid zone", "invalid_zone"));
      }
      break;
    case "discard":
    case "flip_power":
    case "modify_bp":
    case "modify_sp":
    case "set_bp":
    case "hold_command":
    case "release_command":
    case "block_battle_entry":
      issues.push(...validateTargetSelector(value.target, `${path}.target`));
      break;
    case "deal_damage":
      if (typeof value.amount !== "number" || value.amount < 1) {
        issues.push(issue(`${path}.amount`, "must be >= 1", "invalid_amount"));
      }
      break;
    case "grant_keyword":
      if (typeof value.keyword !== "string" || value.keyword.length === 0) {
        issues.push(issue(`${path}.keyword`, "required", "missing_keyword"));
      }
      break;
    case "choose": {
      if (!CHOICE_KINDS.has(String(value.kind))) {
        issues.push(issue(`${path}.kind`, "invalid choice kind", "invalid_choice_kind"));
      }
      issues.push(...validateTargetSelector(value.valid, `${path}.valid`));
      if (!Array.isArray(value.then) || value.then.length === 0) {
        issues.push(issue(`${path}.then`, "non-empty array required", "empty_then"));
      } else {
        value.then.forEach((p, i) => {
          issues.push(...validatePrimitive(p, `${path}.then[${i}]`).issues);
        });
      }
      break;
    }
    case "open_reaction":
      if (!["rush", "battle", "strike", "leave"].includes(String(value.window))) {
        issues.push(issue(`${path}.window`, "invalid reaction window", "invalid_window"));
      }
      break;
    case "interpret_effect":
      break;
    case "enqueue_trigger":
    case "fallback_handler":
      issues.push(...validateEffectId(value.effectId, `${path}.effectId`));
      break;
    default:
      break;
  }

  return issues.length === 0 ? ok() : fail(issues);
}

export function validateEffectDefinition(value: unknown, path = ""): ValidationResult {
  if (!isObject(value)) {
    return fail([issue(path || "effect", "must be object", "invalid_effect")]);
  }

  const issues: ValidationIssue[] = [];
  const base = path || "effect";

  issues.push(...validateEffectId(value.id, `${base}.id`));
  issues.push(...validateTrigger(value.trigger, `${base}.trigger`).issues);

  if (value.condition !== undefined) {
    issues.push(...validateCondition(value.condition, `${base}.condition`).issues);
  }

  if (!Array.isArray(value.effects) || value.effects.length === 0) {
    issues.push(issue(`${base}.effects`, "non-empty array required", "empty_effects"));
  } else {
    value.effects.forEach((p, i) => {
      issues.push(...validatePrimitive(p, `${base}.effects[${i}]`).issues);
    });
  }

  const effectIds = new Set<string>();
  if (typeof value.id === "string") {
    effectIds.add(value.id);
  }

  return issues.length === 0 ? ok() : fail(issues);
}

export function validateCardDocument(value: unknown): ValidationResult {
  if (!isObject(value)) {
    return fail([issue("", "card must be object", "invalid_card")]);
  }

  const issues: ValidationIssue[] = [];

  issues.push(...validateCardId(value.id, "id"));

  if (typeof value.name !== "string" || value.name.length === 0) {
    issues.push(issue("name", "required non-empty string", "missing_name"));
  }

  if (typeof value.type !== "string" || !CARD_TYPES.has(value.type)) {
    issues.push(issue("type", "invalid card type", "invalid_type"));
  }

  if (Array.isArray(value.category)) {
    if (value.category.length < 2) {
      issues.push(issue("category", "multi category needs 2+ entries", "invalid_multi_category"));
    }
    value.category.forEach((c, i) => {
      if (!CATEGORIES.has(String(c))) {
        issues.push(issue(`category[${i}]`, "invalid category", "invalid_category"));
      }
    });
  } else if (typeof value.category !== "string" || !CATEGORIES.has(value.category)) {
    issues.push(issue("category", "invalid category", "invalid_category"));
  }

  if (typeof value.rarity !== "string" || !RARITIES.has(value.rarity)) {
    issues.push(issue("rarity", "invalid rarity", "invalid_rarity"));
  }

  if (typeof value.expansion !== "string" || value.expansion.length === 0) {
    issues.push(issue("expansion", "required", "missing_expansion"));
  }

  if (
    typeof value.powerCost !== "number" &&
    (typeof value.powerCost !== "string" || !ZORD_POWER_COST_PATTERN.test(value.powerCost))
  ) {
    if (typeof value.powerCost !== "number" || value.powerCost < 0) {
      issues.push(issue("powerCost", "must be number >= 0 or N+ pattern", "invalid_power_cost"));
    }
  }

  if (value.type === "unit") {
    if (typeof value.bp !== "number") {
      issues.push(issue("bp", "required for unit", "missing_bp"));
    }
    if (typeof value.size !== "string" || !SIZES.has(value.size)) {
      issues.push(issue("size", "required for unit", "missing_size"));
    }
  }

  if (value.type === "operation") {
    const hasLegacy = typeof value.effectId === "string";
    const hasDsl = Array.isArray(value.effects) && value.effects.length > 0;
    const impl = value.implementation;
    const isVanillaOperation =
      isObject(impl) && impl.handler === "unimplemented" && !hasLegacy && !hasDsl;
    if (!hasLegacy && !hasDsl && !isVanillaOperation) {
      issues.push(issue("effectId", "operation requires effectId or effects[]", "missing_operation_effect"));
    }
    if (hasLegacy) {
      issues.push(...validateEffectId(value.effectId, "effectId"));
    }
  }

  if (value.effectId !== undefined && value.type !== "operation") {
    issues.push(...validateEffectId(value.effectId, "effectId"));
  }

  if (Array.isArray(value.effects)) {
    const seenIds = new Set<string>();
    value.effects.forEach((eff, i) => {
      const r = validateEffectDefinition(eff, `effects[${i}]`);
      issues.push(...r.issues);
      if (isObject(eff) && typeof eff.id === "string") {
        if (seenIds.has(eff.id)) {
          issues.push(issue(`effects[${i}].id`, `duplicate effect id: ${eff.id}`, "duplicate_effect_id"));
        }
        seenIds.add(eff.id);
      }
    });
  }

  if (value.rushAdditionalCondition !== undefined) {
    const z = value.rushAdditionalCondition;
    if (!isObject(z) || typeof z.conditionId !== "string" || typeof z.text !== "string") {
      issues.push(issue("rushAdditionalCondition", "invalid zord condition", "invalid_zord"));
    }
  }

  if (Array.isArray(value.unnamedRules)) {
    value.unnamedRules.forEach((rule, i) => {
      if (!isObject(rule) || typeof rule.kind !== "string" || typeof rule.text !== "string") {
        issues.push(issue(`unnamedRules[${i}]`, "kind and text required", "invalid_unnamed_rule"));
      }
      if (Array.isArray(rule.partnerCardIds)) {
        rule.partnerCardIds.forEach((id: unknown, j: number) => {
          issues.push(...validateCardId(id, `unnamedRules[${i}].partnerCardIds[${j}]`));
        });
      }
    });
  }

  return issues.length === 0 ? ok() : fail(issues);
}

export function assertValidCardDocument(value: unknown): asserts value is CardDocument {
  const result = validateCardDocument(value);
  if (!result.ok) {
    const detail = result.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
    throw new Error(`Invalid card document: ${detail}`);
  }
}

export function validateEffectDefinitions(effects: unknown[]): ValidationResult {
  return merge(...effects.map((e, i) => validateEffectDefinition(e, `effects[${i}]`)));
}

export function getTriggerType(trigger: EffectTrigger): string {
  return trigger.type;
}
