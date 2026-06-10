/**
 * Legend 1 スターター（Type A/B/C）36枚の DSL オーバーレイを生成する。
 * TypeScript 効果ハンドラは使わず、primitives / grant_keyword のみ。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const decks = ["abarenoh", "dekaranger", "magiking"].map((id) =>
  JSON.parse(readFileSync(join(root, `src/legend1/decks/${id}.json`), "utf8")),
);
const starterIds = [...new Set(decks.flatMap((d) => d.entries.map((e) => e.cardId)))].sort();

const unitEffects = JSON.parse(
  readFileSync(join(root, "src/legend1/unitEffects.json"), "utf8"),
);

/** @type {Record<string, { kind: string, target?: string }>} */
const OP_META = {
  "RS-010": { kind: "permanent" },
  "RS-011": { kind: "instant", target: "own_s_unit" },
  "RS-014": { kind: "permanent" },
  "RS-017": { kind: "permanent" },
  "RS-020": { kind: "instant" },
  "RS-022": { kind: "permanent" },
  "RS-023": { kind: "instant", target: "discard_s_unit" },
  "RS-025": { kind: "instant", target: "own_unit" },
  "RS-027": { kind: "counter" },
  "RS-028": { kind: "instant", target: "enemy_field_unit" },
  "RS-029": { kind: "permanent" },
  "RS-030": { kind: "permanent" },
  "RS-067": { kind: "counter" },
  "RS-068": { kind: "instant", target: "discard_any" },
  "RS-069": { kind: "permanent" },
};

function opTiming(kind) {
  if (kind === "permanent") return "resident";
  if (kind === "counter") return "counter";
  return "rush";
}

function kw(keyword, duration = "turn") {
  return { type: "grant_keyword", keyword, duration };
}

function chooseUnit(valid, count, then, kind = "select_unit") {
  return { type: "choose", kind, valid, count, then };
}

function zone(z, owner, filter) {
  const t = { type: "zone", zone: z, owner };
  if (filter) t.filter = filter;
  return t;
}

/** effectId → DSL EffectDefinition（primitives のみ） */
const EFFECT_BUILDERS = {
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
      chooseUnit({ type: "zones", zones: [zone("rush", "self"), zone("battle", "self")] }, 1, [
        { type: "modify_bp", target: { type: "trigger_source" }, amount: 4000, duration: "turn" },
      ]),
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
  armor_attack: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "on_rush" },
    optional: true,
    condition: {
      type: "has_target",
      target: zone("battle", "opponent", { maxBp: 8000 }),
    },
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
    condition: {
      type: "has_target",
      target: zone("battle", "opponent", { maxBp: 4000 }),
    },
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
  prism_power: (named, cardId) => ({
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
    effects: [
      { type: "cancel_damage" },
      kw("prevent_leave_with_power_cost", "turn"),
    ],
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
  sky_magic_slash: (named) => ({
    id: named.effectId,
    name: named.name,
    text: named.text,
    trigger: { type: "enter_battle" },
    optional: true,
    effects: [kw("hold_all_enemy_commands", "turn")],
  }),
};

/** DSL で表現できない unnamed rule → grant_keyword / 構造化 */
const UNNAMED_KEYWORDS = {
  battle_entry_hold: (u) => [kw(`battle_entry_hold_${u.holdCount ?? 1}`, "permanent")],
  destroy_self_damage: (u) => [kw(`destroy_self_damage_${u.damage ?? 1}`, "permanent")],
  auto_battle_entry_each_turn: () => [kw("auto_battle_entry_each_turn", "permanent")],
  fusion_material_alias: () => [kw("fusion_material_alias", "permanent")],
};

function buildCardOverlay(cardId) {
  const block = unitEffects[cardId];
  const op = OP_META[cardId];
  const effects = [];

  if (block?.namedEffects) {
    for (const named of block.namedEffects) {
      const builder = EFFECT_BUILDERS[named.effectId];
      if (builder) {
        effects.push(builder(named, cardId));
      } else {
        effects.push({
          id: named.effectId,
          name: named.name,
          text: named.text,
          trigger: named.trigger,
          effects: [kw(`pending_${named.effectId}`, "turn")],
        });
      }
    }
  }

  if (op) {
    const effectId = {
      "RS-010": "prism_power",
      "RS-011": "aura_power",
      "RS-014": "five_tech",
      "RS-017": "ki_power",
      "RS-020": "place_in_power",
      "RS-022": "earth_force",
      "RS-023": "discard_s_unit_to_hand",
      "RS-025": "bp_boost_4000",
      "RS-027": "dino_guts",
      "RS-028": "judgment",
      "RS-029": "courage_magic",
      "RS-030": "adventure",
      "RS-067": "plasma_energy",
      "RS-068": "discard_to_hand",
      "RS-069": "lightning_gravity",
    }[cardId];
    if (effectId && !effects.some((e) => e.id === effectId)) {
      const builder = EFFECT_BUILDERS[effectId];
      const named = {
        effectId,
        name: cardId,
        text: "",
        trigger: { type: "operation", timing: opTiming(op.kind) },
      };
      if (builder) effects.push(builder(named, cardId));
    }
  }

  const unnamedRules = block?.unnamedText?.map((u) => ({
    kind: u.kind,
    text: u.text,
    rule: u.rule,
    holdCount: u.holdCount,
    damage: u.damage,
    discardCount: u.discardCount,
    partnerCardIds: u.partnerCardIds,
  }));

  const unnamedEffects = [];
  for (const u of block?.unnamedText ?? []) {
    if (u.rule && UNNAMED_KEYWORDS[u.rule]) {
      unnamedEffects.push({
        id: `unnamed_${u.rule}`,
        text: u.text,
        trigger: { type: "while_in_field" },
        effects: UNNAMED_KEYWORDS[u.rule](u),
      });
    }
  }

  const overlay = {
    id: cardId,
    effects: [...effects, ...unnamedEffects],
    implementation: { source: "dsl", handler: "interpreter", testGenerated: true },
  };

  if (block?.rushAdditionalCondition) {
    overlay.rushAdditionalCondition = block.rushAdditionalCondition;
  }
  if (unnamedRules?.length) {
    overlay.unnamedRules = unnamedRules;
  }

  return overlay;
}

const cards = starterIds.map(buildCardOverlay);
const outDir = join(root, "src/dsl/legend1/starter");
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ cardIds: starterIds }, null, 2));
writeFileSync(join(outDir, "overlays.json"), JSON.stringify({ cards }, null, 2));

for (const card of cards) {
  writeFileSync(join(outDir, `${card.id}.dsl.json`), JSON.stringify(card, null, 2) + "\n");
}

console.log(`Generated ${cards.length} starter DSL overlays → ${outDir}`);
