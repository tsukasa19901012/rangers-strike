import { WIKI_OPERATION_TEXT } from "./wikiReference";
import { ERRATA_EFFECT_TEXT } from "./errata";
import { inferCatalogTierForCardId, loadCardById } from "./dsl/loader";
import type { OperationTiming } from "./dsl/types";

export type EffectKind = "instant" | "permanent" | "counter";

export type EffectTarget =
  | "own_unit"
  | "own_s_unit"
  | "enemy_field_unit"
  | "discard_any"
  | "discard_s_unit"
  | "discard_mecha"
  | "enemy_battle_unit"
  | "enemy_field_unit_bp8000"
  | "any_field_unit";

export type CardEffectMeta = {
  effectId: string;
  text: string;
  kind: EffectKind;
  target?: EffectTarget;
};

function op(
  effectId: string,
  kind: EffectKind,
  cardId: keyof typeof WIKI_OPERATION_TEXT,
  target?: EffectTarget,
): CardEffectMeta {
  return {
    effectId,
    kind,
    text: WIKI_OPERATION_TEXT[cardId]!,
    target,
  };
}

/** レジェンド1 オペレーションカード効果（Wiki 確認済みテキスト）。 */
export const LEGEND1_EFFECTS: Record<string, CardEffectMeta> = {
  "RS-001": op("goren_storm", "instant", "RS-001"),
  "RS-002": op("jacker_hurricane", "instant", "RS-002"),
  "RS-003": op("battle_dance", "permanent", "RS-003"),
  "RS-004": op("denji_machine", "instant", "RS-004"),
  "RS-005": op("land_balkan", "instant", "RS-005"),
  "RS-006": op("new_gymnastics", "counter", "RS-006"),
  "RS-007": op("dynamite_power", "instant", "RS-007", "enemy_field_unit_bp8000"),
  "RS-008": op("super_brain", "permanent", "RS-008"),
  "RS-009": op("power_bazooka", "instant", "RS-009", "enemy_battle_unit"),
  "RS-010": op("prism_power", "permanent", "RS-010"),
  "RS-011": op("aura_power", "instant", "RS-011", "own_s_unit"),
  "RS-012": op("science_academy", "instant", "RS-012", "discard_mecha"),
  "RS-013": op("shiron_light", "permanent", "RS-013"),
  "RS-014": op("five_tech", "permanent", "RS-014"),
  "RS-015": op("bird_nick_wave", "instant", "RS-015"),
  "RS-016": op("dino_chronicle", "counter", "RS-016"),
  "RS-017": op("ki_power", "permanent", "RS-017"),
  "RS-018": op("hidden_ninja", "counter", "RS-018"),
  "RS-019": op("super_power", "permanent", "RS-019"),
  "RS-020": op("place_in_power", "instant", "RS-020"),
  "RS-021": op("cyber_s_rider", "instant", "RS-021"),
  "RS-022": op("earth_force", "permanent", "RS-022"),
  "RS-023": op("discard_s_unit_to_hand", "instant", "RS-023", "discard_s_unit"),
  "RS-024": op("compression_freeze", "instant", "RS-024", "any_field_unit"),
  "RS-025": op("bp_boost_4000", "instant", "RS-025", "own_unit"),
  "RS-026": op("shippu_ninja", "counter", "RS-026"),
  "RS-027": op("dino_guts", "counter", "RS-027"),
  "RS-028": op("judgment", "instant", "RS-028", "enemy_field_unit"),
  "RS-029": op("courage_magic", "permanent", "RS-029"),
  "RS-030": op("adventure", "permanent", "RS-030"),
  "RS-067": op("plasma_energy", "permanent", "RS-067"),
  "RS-068": op("discard_to_hand", "instant", "RS-068", "discard_any"),
  "RS-069": op("lightning_gravity", "permanent", "RS-069"),
};

/** レジェンド2 オペレーションカード効果（シリーズ2: 二人の黒騎士）。 */
export const LEGEND2_EFFECTS: Record<string, CardEffectMeta> = {
  "RS-071": op("hidora_egg", "permanent", "RS-071"),
  "RS-072": op("infinite_chain", "instant", "RS-072"),
};

/** レジェンド3 オペレーションカード効果（シリーズ3: 三界の獅子）。 */
export const LEGEND3_EFFECTS: Record<string, CardEffectMeta> = {
  "RS-123": op("super_dynamite", "instant", "RS-123"),
  "RS-124": op("super_electron_radar", "permanent", "RS-124"),
  "RS-125": op("animal_heart", "instant", "RS-125", "enemy_field_unit"),
};

/** XG エクスパンション オペレーションカード効果。 */
export const XG_EFFECTS: Record<string, CardEffectMeta> = {
  "XG3-055": { effectId: "sage_ael", text: "", kind: "counter" },
  "XG5-083": { effectId: "mag_load", text: "", kind: "counter" },
};

const ALL_EFFECTS: Record<string, CardEffectMeta> = {
  ...LEGEND1_EFFECTS,
  ...LEGEND2_EFFECTS,
  ...LEGEND3_EFFECTS,
  ...XG_EFFECTS,
};

function operationKindFromTiming(timing: OperationTiming): EffectKind {
  if (timing === "counter") return "counter";
  if (timing === "resident") return "permanent";
  return "instant";
}

function resolveEffectText(
  cardId: string,
  doc: { text?: string },
  operation: { text?: string },
  staticMeta?: CardEffectMeta,
): string {
  const errataText = ERRATA_EFFECT_TEXT[cardId];
  if (errataText) return errataText;
  for (const candidate of [staticMeta?.text, doc.text, operation.text]) {
    if (candidate?.trim()) return candidate;
  }
  return "";
}

function resolveEffectKind(
  doc: { tags?: string[] },
  trigger: { type: "operation"; timing: OperationTiming },
  staticMeta?: CardEffectMeta,
): EffectKind {
  if (staticMeta?.kind) return staticMeta.kind;
  if (doc.tags?.includes("常駐")) return "permanent";
  return operationKindFromTiming(trigger.timing);
}

function isPassivePermanentOperationDoc(doc: {
  type?: string;
  text?: string;
  unnamedRules?: { rule?: string }[];
  effects?: {
    trigger: { type: string };
    effects: { type: string; keyword?: string }[];
  }[];
}): boolean {
  if (doc.type !== "operation") return false;
  if (doc.text?.includes("※カウンター")) return false;
  if (doc.text?.includes("※常駐")) return true;
  if (doc.unnamedRules?.some((rule) => rule.rule === "resident")) return true;
  return (doc.effects ?? []).some(
    (effect) =>
      effect.trigger.type === "while_in_field" &&
      effect.effects.some(
        (primitive) =>
          primitive.type === "grant_keyword" && primitive.keyword === "resident",
      ),
  );
}

function isCounterOperationDoc(doc: { type?: string; text?: string }): boolean {
  return doc.type === "operation" && (doc.text?.includes("※カウンター") ?? false);
}

function firstEffectBlock(doc: {
  effects?: { id: string; text?: string }[];
}): { id: string; text?: string } | undefined {
  return doc.effects?.[0];
}

function resolveWiredEffectId(
  doc: { effectId?: string },
  block: { id: string },
  staticMeta?: CardEffectMeta,
): string {
  return doc.effectId ?? staticMeta?.effectId ?? block.id;
}

/** U4 — CardDocument 優先。静的 ALL_EFFECTS は target / 空テキスト・kind 補完用。 */
export function getCardEffect(cardId: string): CardEffectMeta | undefined {
  const staticMeta = ALL_EFFECTS[cardId];
  try {
    const doc = loadCardById(cardId, inferCatalogTierForCardId(cardId));
    const operation = doc.effects?.find((effect) => effect.trigger.type === "operation");
    if (operation?.trigger.type === "operation") {
      return {
        effectId: resolveWiredEffectId(doc, operation, staticMeta),
        text: resolveEffectText(cardId, doc, operation, staticMeta),
        kind: resolveEffectKind(doc, operation.trigger, staticMeta),
        target: staticMeta?.target,
      };
    }
    if (isCounterOperationDoc(doc)) {
      const block = firstEffectBlock(doc);
      return {
        effectId: resolveWiredEffectId(doc, block ?? { id: `counter_${cardId}` }, staticMeta),
        text: resolveEffectText(cardId, doc, block ?? { text: doc.text ?? "" }, staticMeta),
        kind: "counter",
        target: staticMeta?.target,
      };
    }
    if (isPassivePermanentOperationDoc(doc)) {
      const passive = doc.effects?.find((effect) => effect.trigger.type === "while_in_field");
      const block = passive ?? { id: "unnamed_resident", text: doc.text ?? "" };
      return {
        effectId: resolveWiredEffectId(doc, block, staticMeta),
        text: resolveEffectText(cardId, doc, block, staticMeta),
        kind: "permanent",
        target: staticMeta?.target,
      };
    }
    if (doc.type === "operation" && doc.effects?.length) {
      const block = firstEffectBlock(doc)!;
      return {
        effectId: resolveWiredEffectId(doc, block, staticMeta),
        text: resolveEffectText(cardId, doc, block, staticMeta),
        kind: resolveEffectKind(
          doc,
          { type: "operation", timing: "rush" },
          staticMeta,
        ),
        target: staticMeta?.target,
      };
    }
  } catch {
    /* fall through */
  }
  if (!staticMeta) return undefined;
  const errataText = ERRATA_EFFECT_TEXT[cardId];
  if (!errataText) return staticMeta;
  return { ...staticMeta, text: errataText };
}
