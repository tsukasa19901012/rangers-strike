import { WIKI_OPERATION_TEXT } from "./wikiReference";
import { ERRATA_EFFECT_TEXT } from "./errata";

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

const ALL_EFFECTS: Record<string, CardEffectMeta> = {
  ...LEGEND1_EFFECTS,
  ...LEGEND2_EFFECTS,
  ...LEGEND3_EFFECTS,
};

export function getCardEffect(cardId: string): CardEffectMeta | undefined {
  const base = ALL_EFFECTS[cardId];
  if (!base) return undefined;
  const errataText = ERRATA_EFFECT_TEXT[cardId];
  if (!errataText) return base;
  return { ...base, text: errataText };
}
