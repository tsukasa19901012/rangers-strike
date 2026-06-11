import { loadCards } from "./dsl/loader";
import type { CardDefinition } from "./schema";
import {
  getConditionalNamedEffect,
  getEnterBattleNamedEffect,
  getOnAttackNamedEffect,
  getOnRushNamedEffect,
  getUnitEffectBlock,
} from "./unitEffects";

export type WiredUnitEffect = {
  cardId: string;
  effectId: string;
  effectName: string;
  triggerType: "on_rush" | "conditional" | "on_attack" | "enter_battle" | "passive";
};

/** resolveNamedOnRushEffects のラッシュ時ハンドラ。 */
export const IMPLEMENTED_ON_RUSH_EFFECT_IDS = [
  "armor_attack",
  "tyranno_sonic",
  "moss_blizzard",
  "ptera_beam",
  "rescue_activity",
  "sure_win_combination",
  "firefighting",
  "dismantling",
  "heavenly_disaster",
  "karakuri_great_tsunami",
  "air_transport",
  "great_assault",
  "airlift",
  "assault",
  "submerge",
  "taurus_dive",
  "earth_resource_absorb",
  "nature_big_bang_final",
] as const;

/** バトル投入時の任意効果（tryStartConditionalChoice）。 */
export const IMPLEMENTED_CONDITIONAL_EFFECT_IDS = [
  "judgment_sword",
  "justice_flasher",
  "super_drill",
  "ghost_absorption",
  "precious_guardian",
  "shift_up",
  "tantrum",
  "cry",
  "red_boot",
  "string_fist",
  "jet_skateboard",
  "falcon_claw",
  "sagas_sniper",
  "blue_bados_life_sword",
] as const;

/** ターン終了時に発動するユニット効果。 */
export const IMPLEMENTED_ON_TURN_END_EFFECT_IDS = [
  "karakuri_fire_hawk",
] as const;

/** アタック時 / バトル BP 修正（namedUnitEffects）。 */
export const IMPLEMENTED_ON_ATTACK_EFFECT_IDS = [
  "bouken_javelin",
  "red_fire",
  "shark_jaws",
  "super_cutter",
  "panther_claw",
  "yellow_thunder",
  "val_cannon",
  "dump_punch",
  "ptera_dagger",
  "adventure_drive_sword",
  "super_live_crush",
  "surging_chopper",
  "moonlight_sonic",
  "mirage_beam",
] as const;

/** バトル投入時の自動または選択効果。 */
export const IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS = [
  "destroy_enemy_bp4000",
  "sky_magic_slash",
  "mane_hurricane",
  "phantom_illusion",
  "ruin_excavation",
  "fire_dance",
  "crown_final_crush",
  "hyper_civilization_guard",
  "steel_horn",
  "bio_particle_slash",
  "anti_bio_cannon",
] as const;

/** バトル投入以外で接続済みのリアクティブ / 常駐ユニット効果。 */
export const IMPLEMENTED_PASSIVE_EFFECT_IDS = [
  "super_shield",
  "focused_breakthrough",
  "signal_cannon",
  "tricera_cannon",
  "guardian_god",
  "pat_signer",
  "jaguar_mothership",
  "bio_buster",
  "medical_rescue",
  "traffic_control",
  "karakuri_lion_chain",
  "dekabase_mothership",
  "fire_spin_blade",
  "seabed_survey",
  "val_shield",
  "dance_of_darkness",
  "stealth",
  "furious_shark_shot",
  "heaven_earth_animal_heart",
  "scorching_roar",
  "data_analysis",
  "dark_deal",
  "star_raiser",
  "base_attack",
  "super_moa_cannon",
] as const;

const ON_RUSH_SET = new Set<string>(IMPLEMENTED_ON_RUSH_EFFECT_IDS);
const CONDITIONAL_SET = new Set<string>(IMPLEMENTED_CONDITIONAL_EFFECT_IDS);
const ON_ATTACK_SET = new Set<string>(IMPLEMENTED_ON_ATTACK_EFFECT_IDS);
const ENTER_BATTLE_SET = new Set<string>(IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS);
const PASSIVE_SET = new Set<string>(IMPLEMENTED_PASSIVE_EFFECT_IDS);
const ON_TURN_END_SET = new Set<string>(IMPLEMENTED_ON_TURN_END_EFFECT_IDS);

export function isUnitEffectImplemented(effectId: string): boolean {
  return (
    ON_RUSH_SET.has(effectId) ||
    CONDITIONAL_SET.has(effectId) ||
    ON_ATTACK_SET.has(effectId) ||
    ENTER_BATTLE_SET.has(effectId) ||
    PASSIVE_SET.has(effectId) ||
    ON_TURN_END_SET.has(effectId)
  );
}

type TriggerFilter = "on_rush" | "conditional" | "on_attack" | "enter_battle";

function forEachLookupBlock(
  lookup: (cardId: string) => CardDefinition | undefined,
  fn: (cardId: string, block: NonNullable<ReturnType<typeof getUnitEffectBlock>>) => void,
): void {
  for (const doc of loadCards("full-playable")) {
    if (!lookup(doc.id)) continue;
    const block = getUnitEffectBlock(doc.id);
    if (!block) continue;
    fn(doc.id, block);
  }
}

function listByTrigger(
  triggerType: TriggerFilter,
  lookup: (cardId: string) => CardDefinition | undefined,
  effectIdSet: Set<string>,
): WiredUnitEffect[] {
  const results: WiredUnitEffect[] = [];

  forEachLookupBlock(lookup, (cardId, block) => {
    for (const named of block.namedEffects) {
      if (named.trigger.type !== triggerType) continue;
      if (!effectIdSet.has(named.effectId)) continue;

      results.push({
        cardId,
        effectId: named.effectId,
        effectName: named.name,
        triggerType,
      });
    }
  });

  return results.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

function listPassiveEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredUnitEffect[] {
  const results: WiredUnitEffect[] = [];

  forEachLookupBlock(lookup, (cardId, block) => {
    for (const named of block.namedEffects) {
      if (!PASSIVE_SET.has(named.effectId)) continue;
      results.push({
        cardId,
        effectId: named.effectId,
        effectName: named.name,
        triggerType: "passive",
      });
    }
  });

  return results.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

export function listWiredOnRushEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredUnitEffect[] {
  return listByTrigger("on_rush", lookup, ON_RUSH_SET);
}

export function listWiredConditionalEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredUnitEffect[] {
  return listByTrigger("conditional", lookup, CONDITIONAL_SET);
}

export function listWiredOnAttackEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredUnitEffect[] {
  return listByTrigger("on_attack", lookup, ON_ATTACK_SET);
}

export function listWiredEnterBattleEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredUnitEffect[] {
  return listByTrigger("enter_battle", lookup, ENTER_BATTLE_SET);
}

export function listWiredPassiveEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredUnitEffect[] {
  return listPassiveEffects(lookup);
}

export function getWiredOnRushEffect(cardId: string): WiredUnitEffect | undefined {
  const named = getOnRushNamedEffect(cardId);
  if (!named || !ON_RUSH_SET.has(named.effectId)) return undefined;
  return {
    cardId,
    effectId: named.effectId,
    effectName: named.name,
    triggerType: "on_rush",
  };
}

export function getWiredConditionalEffect(cardId: string): WiredUnitEffect | undefined {
  const named = getConditionalNamedEffect(cardId);
  if (!named || !CONDITIONAL_SET.has(named.effectId)) return undefined;
  return {
    cardId,
    effectId: named.effectId,
    effectName: named.name,
    triggerType: "conditional",
  };
}

export function getWiredOnAttackEffect(cardId: string): WiredUnitEffect | undefined {
  const named = getOnAttackNamedEffect(cardId);
  if (!named || !ON_ATTACK_SET.has(named.effectId)) return undefined;
  return {
    cardId,
    effectId: named.effectId,
    effectName: named.name,
    triggerType: "on_attack",
  };
}

export function getWiredEnterBattleEffect(cardId: string): WiredUnitEffect | undefined {
  const named = getEnterBattleNamedEffect(cardId);
  if (!named || !ENTER_BATTLE_SET.has(named.effectId)) return undefined;
  return {
    cardId,
    effectId: named.effectId,
    effectName: named.name,
    triggerType: "enter_battle",
  };
}
