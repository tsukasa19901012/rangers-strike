import { LEGEND1_EFFECTS, LEGEND2_EFFECTS, LEGEND3_EFFECTS, type CardEffectMeta } from "./effects";

export type WiredOperation = {
  cardId: string;
  effectId: string;
  kind: CardEffectMeta["kind"];
  text: string;
};

/** resolveOperation.ts に専用ハンドラがある即時オペ。 */
export const IMPLEMENTED_INSTANT_EFFECT_IDS = [
  "place_in_power",
  "dynamite_power",
  "aura_power",
  "judgment",
  "bp_boost_4000",
  "discard_to_hand",
  "discard_s_unit_to_hand",
  "science_academy",
  "goren_storm",
  "jacker_hurricane",
  "bird_nick_wave",
  "denji_machine",
  "land_balkan",
  "cyber_s_rider",
  "compression_freeze",
  "power_bazooka",
  "infinite_chain",
  "animal_heart",
] as const;

/** placePermanentOperation（+ 専用アクション）で配置する常駐オペ。 */
export const IMPLEMENTED_PERMANENT_EFFECT_IDS = [
  "battle_dance",
  "super_brain",
  "prism_power",
  "shiron_light",
  "five_tech",
  "ki_power",
  "super_power",
  "earth_force",
  "courage_magic",
  "adventure",
  "plasma_energy",
  "lightning_gravity",
  "hidora_egg",
  "super_dynamite",
  "super_electron_radar",
] as const;

/** operationCounters / strikeReactions で処理するカウンターオペ。 */
export const IMPLEMENTED_COUNTER_EFFECT_IDS = [
  "new_gymnastics",
  "dino_chronicle",
  "hidden_ninja",
  "shippu_ninja",
  "dino_guts",
] as const;

const ALL_OPERATION_EFFECTS: Record<string, CardEffectMeta> = {
  ...LEGEND1_EFFECTS,
  ...LEGEND2_EFFECTS,
  ...LEGEND3_EFFECTS,
};

const INSTANT_SET = new Set<string>(IMPLEMENTED_INSTANT_EFFECT_IDS);
const PERMANENT_SET = new Set<string>(IMPLEMENTED_PERMANENT_EFFECT_IDS);
const COUNTER_SET = new Set<string>(IMPLEMENTED_COUNTER_EFFECT_IDS);

export function isOperationImplemented(effectId: string): boolean {
  return (
    INSTANT_SET.has(effectId) ||
    PERMANENT_SET.has(effectId) ||
    COUNTER_SET.has(effectId)
  );
}

export function listImplementedOperations(): WiredOperation[] {
  const results: WiredOperation[] = [];

  for (const [cardId, meta] of Object.entries(ALL_OPERATION_EFFECTS)) {
    if (!isOperationImplemented(meta.effectId)) continue;
    results.push({
      cardId,
      effectId: meta.effectId,
      kind: meta.kind,
      text: meta.text,
    });
  }

  return results.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

export function listUnimplementedOperations(): WiredOperation[] {
  const results: WiredOperation[] = [];

  for (const [cardId, meta] of Object.entries(ALL_OPERATION_EFFECTS)) {
    if (isOperationImplemented(meta.effectId)) continue;
    results.push({
      cardId,
      effectId: meta.effectId,
      kind: meta.kind,
      text: meta.text,
    });
  }

  return results.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

export function getOperationByEffectId(effectId: string): WiredOperation | undefined {
  for (const [cardId, meta] of Object.entries(ALL_OPERATION_EFFECTS)) {
    if (meta.effectId === effectId) {
      return { cardId, effectId: meta.effectId, kind: meta.kind, text: meta.text };
    }
  }
  return undefined;
}
