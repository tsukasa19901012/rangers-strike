import type { Category, ComboNumber, CardDefinition } from "./schema";
import { ALL_CARDS_BY_ID } from "./catalog";
import {
  getEnterBattleNamedEffect,
  getJointLNamedEffect,
  getJointRNamedEffect,
  getRidingComboNamedEffect,
  getUnitEffectBlock,
  listAltNcPartnerIds,
  listJointLNamedEffects,
  listJointRNamedEffects,
  listNcNamedEffects,
  listRidingComboNamedEffects,
} from "./unitEffects";

/** ユニットがバトルゾーンに出たときに発動。 */
export type EnterBattleEffectId =
  | "destroy_enemy_bp4000"
  | "sky_magic_slash"
  | "mane_hurricane"
  | "ruin_excavation";

export const ENTER_BATTLE_EFFECTS: Record<string, EnterBattleEffectId> = {
  "RS-050": "destroy_enemy_bp4000",
  "RS-070": "sky_magic_slash",
  "RS-095": "mane_hurricane",
  "RS-111": "sky_magic_slash",
  "RS-121": "ruin_excavation",
};

/** エンジンに接続済みのナンバーコンボ（NC/CN）ハンドラ。 */
export type NumberComboEffectId =
  | "grant_sp1"
  | "eagle_diving"
  | "moss_breaker"
  | "ruin_survey"
  | "pit_in_dive"
  | "red_fire"
  | "yellow_thunder"
  | "future_sight"
  | "pink_storm"
  | "green_ground"
  | "bouken_javelin"
  | "radial_hammer"
  | "blow_knuckle"
  | "magical_dragon_shoot"
  | "competition"
  | "ryuu_geki_ken"
  | "tricera_lance"
  | "ptera_arrow"
  | "life_rescue"
  | "super_ninpo_lion_dance"
  | "super_ninpo_water_transform"
  | "dark_dual_blade"
  | "space_ninpo_rope_skull"
  | "juu_kun_do"
  | "deace_sniper"
  | "green_crush"
  | "backup_request"
  | "zenibomb"
  | "fire_sword"
  | "blazing_fire"
  | "iron_broken"
  | "dolphin_arrow"
  | "bumper_bow"
  | "side_knuckle"
  | "star_raiser";

/** エンジン実装済み NC 効果 id（numberComboEffects.ts の switch と一致必須）。 */
export const IMPLEMENTED_NC_EFFECT_IDS = [
  "grant_sp1",
  "eagle_diving",
  "moss_breaker",
  "ruin_survey",
  "pit_in_dive",
  "red_fire",
  "yellow_thunder",
  "future_sight",
  "pink_storm",
  "green_ground",
  "bouken_javelin",
  "radial_hammer",
  "blow_knuckle",
  "magical_dragon_shoot",
  "competition",
  "ryuu_geki_ken",
  "tricera_lance",
  "ptera_arrow",
  "life_rescue",
  "super_ninpo_lion_dance",
  "super_ninpo_water_transform",
  "dark_dual_blade",
  "space_ninpo_rope_skull",
  "juu_kun_do",
  "deace_sniper",
  "green_crush",
  "backup_request",
  "zenibomb",
  "fire_sword",
  "blazing_fire",
  "iron_broken",
  "dolphin_arrow",
  "bumper_bow",
  "side_knuckle",
  "star_raiser",
] as const satisfies readonly NumberComboEffectId[];

const IMPLEMENTED_NC_IDS = new Set<string>(IMPLEMENTED_NC_EFFECT_IDS);

export type WiredNumberComboCard = {
  cardId: string;
  effectId: NumberComboEffectId;
  comboNumber: number;
  effectName: string;
  triggerType: "nc" | "nc_or_combo_from";
};

function buildNumberComboMap(): Record<string, NumberComboEffectId> {
  const map: Record<string, NumberComboEffectId> = {};
  for (const { cardId, effectId } of listNcNamedEffects()) {
    if (IMPLEMENTED_NC_IDS.has(effectId)) {
      map[cardId] = effectId as NumberComboEffectId;
    }
  }
  return map;
}

export const NUMBER_COMBO_EFFECTS: Record<string, NumberComboEffectId> =
  buildNumberComboMap();

/** エンジン接続済み NC カード（数値 CN）— 統合テスト用。 */
export function listWiredNumberComboCards(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredNumberComboCard[] {
  const results: WiredNumberComboCard[] = [];

  for (const [cardId, effectId] of Object.entries(NUMBER_COMBO_EFFECTS)) {
    const card = lookup(cardId);
    if (!card || typeof card.comboNumber !== "number") continue;

    const block = getUnitEffectBlock(cardId);
    const named = block?.namedEffects.find(
      (entry) =>
        entry.effectId === effectId &&
        (entry.trigger.type === "nc" || entry.trigger.type === "nc_or_combo_from"),
    );
    if (
      !named ||
      (named.trigger.type !== "nc" && named.trigger.type !== "nc_or_combo_from")
    ) {
      continue;
    }

    results.push({
      cardId,
      effectId,
      comboNumber: card.comboNumber,
      effectName: named.name,
      triggerType: named.trigger.type,
    });
  }

  return results.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

/** 標準 NC カード（CN 位置のみ、combo-from 上書きなし）。 */
export function listStandardNcCards(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredNumberComboCard[] {
  return listWiredNumberComboCards(lookup).filter((entry) => entry.triggerType === "nc");
}

/** @deprecated unitEffects の listAltNcPartnerIds を使用すること。 */
export const ALT_NUMBER_COMBO_PARTNERS: Partial<Record<string, string[]>> = {
  "RS-031": listAltNcPartnerIds("RS-031"),
  "RS-056": listAltNcPartnerIds("RS-056"),
};

/** ジョイントコンボ L: 右隣の L ユニットに効果を付与。 */
export type JointComboLEffectId =
  | "grant_sp1_to_partner"
  | "oni_neck_last"
  | "maximum_penetration"
  | "baki_baki_punch";

export const IMPLEMENTED_JOINT_L_EFFECT_IDS = [
  "grant_sp1_to_partner",
  "oni_neck_last",
  "maximum_penetration",
  "baki_baki_punch",
] as const satisfies readonly JointComboLEffectId[];

const IMPLEMENTED_JOINT_L_IDS = new Set<string>(IMPLEMENTED_JOINT_L_EFFECT_IDS);

function buildJointLMap(): Record<string, JointComboLEffectId> {
  const map: Record<string, JointComboLEffectId> = {};
  for (const { cardId, effectId } of listJointLNamedEffects()) {
    const card = ALL_CARDS_BY_ID.get(cardId);
    if (!card || card.comboNumber !== "L") continue;
    if (IMPLEMENTED_JOINT_L_IDS.has(effectId)) {
      map[cardId] = effectId as JointComboLEffectId;
    }
  }
  return map;
}

export const JOINT_L_EFFECTS: Record<string, JointComboLEffectId> = buildJointLMap();

/** ジョイントコンボ R: L パートナーの右隣に出たとき、このユニットが効果を得る。 */
export type JointComboREffectId =
  | "grant_sp1"
  | "elephant_shield"
  | "cross_thunder"
  | "shovel_defense"
  | "wall_shoot"
  | "lift_up";

export const IMPLEMENTED_JOINT_R_EFFECT_IDS = [
  "grant_sp1",
  "elephant_shield",
  "cross_thunder",
  "shovel_defense",
  "wall_shoot",
  "lift_up",
] as const satisfies readonly JointComboREffectId[];

const IMPLEMENTED_JOINT_R_IDS = new Set<string>(IMPLEMENTED_JOINT_R_EFFECT_IDS);

function buildJointRMap(): Record<string, JointComboREffectId> {
  const map: Record<string, JointComboREffectId> = {};
  for (const { cardId, effectId } of listJointRNamedEffects()) {
    const card = ALL_CARDS_BY_ID.get(cardId);
    if (!card || card.comboNumber !== "R") continue;
    if (IMPLEMENTED_JOINT_R_IDS.has(effectId)) {
      map[cardId] = effectId as JointComboREffectId;
    }
  }
  return map;
}

export const JOINT_R_EFFECTS: Record<string, JointComboREffectId> = buildJointRMap();

/** ライディングコンボ（RC）: バトル投入時の乗り降りで発動。 */
export type RidingComboEffectId = "grant_sp1";

export const IMPLEMENTED_RIDING_COMBO_EFFECT_IDS = ["grant_sp1"] as const satisfies readonly RidingComboEffectId[];

const IMPLEMENTED_RIDING_IDS = new Set<string>(IMPLEMENTED_RIDING_COMBO_EFFECT_IDS);

function buildRidingComboMap(): Record<string, RidingComboEffectId> {
  const map: Record<string, RidingComboEffectId> = {};
  for (const { cardId, effectId } of listRidingComboNamedEffects()) {
    const card = ALL_CARDS_BY_ID.get(cardId);
    if (!card || card.comboNumber !== "RC") continue;
    if (IMPLEMENTED_RIDING_IDS.has(effectId)) {
      map[cardId] = effectId as RidingComboEffectId;
    }
  }
  return map;
}

export const RIDING_COMBO_EFFECTS: Record<string, RidingComboEffectId> = buildRidingComboMap();

export type WiredJointComboCard = {
  cardId: string;
  effectId: JointComboLEffectId | JointComboREffectId | RidingComboEffectId;
  comboNumber: "L" | "R" | "RC";
  effectName: string;
  triggerType: "joint_combo_l" | "joint_combo_r" | "riding_combo";
};

export function getEnterBattleEffect(cardId: string): EnterBattleEffectId | undefined {
  const fromMap = ENTER_BATTLE_EFFECTS[cardId];
  if (fromMap) return fromMap;
  const named = getEnterBattleNamedEffect(cardId);
  if (named?.effectId === "destroy_enemy_bp4000") return "destroy_enemy_bp4000";
  if (named?.effectId === "sky_magic_slash") return "sky_magic_slash";
  if (named?.effectId === "mane_hurricane") return "mane_hurricane";
  if (named?.effectId === "ruin_excavation") return "ruin_excavation";
  return undefined;
}

export function getNumberComboEffect(cardId: string): NumberComboEffectId | undefined {
  return NUMBER_COMBO_EFFECTS[cardId];
}

export function getAltNumberComboPartners(cardId: string): string[] {
  return listAltNcPartnerIds(cardId);
}

export function getJointLEffect(cardId: string): JointComboLEffectId | undefined {
  const fromMap = JOINT_L_EFFECTS[cardId];
  if (fromMap) return fromMap;
  const named = getJointLNamedEffect(cardId);
  if (named && IMPLEMENTED_JOINT_L_IDS.has(named.effectId)) {
    return named.effectId as JointComboLEffectId;
  }
  return undefined;
}

export function getJointREffect(cardId: string): JointComboREffectId | undefined {
  const fromMap = JOINT_R_EFFECTS[cardId];
  if (fromMap) return fromMap;
  const named = getJointRNamedEffect(cardId);
  if (named && IMPLEMENTED_JOINT_R_IDS.has(named.effectId)) {
    return named.effectId as JointComboREffectId;
  }
  return undefined;
}

export function getRidingComboEffect(cardId: string): RidingComboEffectId | undefined {
  const fromMap = RIDING_COMBO_EFFECTS[cardId];
  if (fromMap) return fromMap;
  const named = getRidingComboNamedEffect(cardId);
  if (named?.effectId === "grant_sp1") return "grant_sp1";
  return undefined;
}

/** エンジン接続済みジョイント / ライディングコンボカード — 統合テスト用。 */
export function listWiredJointComboCards(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredJointComboCard[] {
  const results: WiredJointComboCard[] = [];

  const entries: Array<{
    comboNumber: "L" | "R" | "RC";
    triggerType: WiredJointComboCard["triggerType"];
    map: Record<string, string>;
    implemented: Set<string>;
  }> = [
    {
      comboNumber: "L",
      triggerType: "joint_combo_l",
      map: JOINT_L_EFFECTS,
      implemented: IMPLEMENTED_JOINT_L_IDS,
    },
    {
      comboNumber: "R",
      triggerType: "joint_combo_r",
      map: JOINT_R_EFFECTS,
      implemented: IMPLEMENTED_JOINT_R_IDS,
    },
    {
      comboNumber: "RC",
      triggerType: "riding_combo",
      map: RIDING_COMBO_EFFECTS,
      implemented: IMPLEMENTED_RIDING_IDS,
    },
  ];

  for (const { comboNumber, triggerType, map, implemented } of entries) {
    for (const [cardId, effectId] of Object.entries(map)) {
      const card = lookup(cardId);
      if (!card || card.comboNumber !== comboNumber) continue;

      const block = getUnitEffectBlock(cardId);
      const named = block?.namedEffects.find(
        (entry) => entry.trigger.type === triggerType && entry.effectId === effectId,
      );
      if (!named || !implemented.has(effectId)) continue;

      results.push({
        cardId,
        effectId: effectId as WiredJointComboCard["effectId"],
        comboNumber,
        effectName: named.name,
        triggerType,
      });
    }
  }

  return results.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

export function isNumericComboNumber(
  comboNumber: ComboNumber | undefined,
): comboNumber is number {
  return typeof comboNumber === "number";
}

export function cardHasComboNumber(cardId: string): boolean {
  const card = ALL_CARDS_BY_ID.get(cardId);
  return isNumericComboNumber(card?.comboNumber);
}

/** マルチカテゴリは双方が持つ全カテゴリを満たすときのみ同一（atwiki 1559）。 */
export function partnerCategoryMatches(
  unitCategory: Category | Category[],
  partnerCategory: Category | Category[],
): boolean {
  const unitCats = Array.isArray(unitCategory) ? unitCategory : [unitCategory];
  const partnerCats = Array.isArray(partnerCategory)
    ? partnerCategory
    : [partnerCategory];
  return (
    unitCats.every((c) => partnerCats.includes(c)) &&
    partnerCats.every((c) => unitCats.includes(c))
  );
}
