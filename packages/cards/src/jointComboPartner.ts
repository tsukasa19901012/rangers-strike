import type { CardDefinition, Category, SpFraction, SpValue } from "./schema";
import { getUnitEffectBlock } from "./unitEffects";
import { partnerCategoryMatches } from "./comboEffects";

/** L ナンバー側が右隣に求めるパートナー条件（カードテキスト由来）。 */
export type JointLPartnerSpec =
  | { kind: "l_size_same_category" }
  | { kind: "s_sp_fraction"; fraction: SpFraction }
  | { kind: "s_unit" }
  | { kind: "s_features"; features: string[] }
  | {
      kind: "s_category_features";
      categories: Category[];
      features: string[];
      excludeCategories?: Category[];
    }
  | { kind: "m_category"; category: Category }
  | { kind: "named_card"; cardName: string }
  | { kind: "feature_any_size"; features: string[] };

/** R ナンバー側が左隣に求めるパートナー条件。 */
export type JointRPartnerSpec =
  | { kind: "l_size_same_category" }
  | { kind: "s_features"; features: string[]; requireAll: boolean }
  | { kind: "named_card"; cardName: string }
  | { kind: "feature_unit"; features: string[] };

const CATEGORY_TOKEN = /^(DA|WB|ET|OT|MA)$/;

function cardCategories(def: CardDefinition): Category[] {
  const c = def.category;
  return Array.isArray(c) ? c : [c];
}

function cardHasFeature(def: CardDefinition, feature: string): boolean {
  return (def.features ?? []).includes(feature);
}

function cardHasAllFeatures(def: CardDefinition, features: string[]): boolean {
  return features.every((f) => cardHasFeature(def, f));
}

function cardNameMatches(def: CardDefinition, name: string): boolean {
  return def.name === name || def.name.includes(name);
}

function parseCategoryToken(token: string): Category | null {
  const trimmed = token.trim();
  return CATEGORY_TOKEN.test(trimmed) ? (trimmed as Category) : null;
}

function collectTexts(cardId: string): string[] {
  const block = getUnitEffectBlock(cardId);
  if (!block) return [];
  const texts: string[] = [];
  for (const named of block.namedEffects) {
    texts.push(named.text);
  }
  for (const unnamed of block.unnamedText) {
    texts.push(unnamed.text);
  }
  return texts;
}

function parseJointLPartnerFromText(text: string): JointLPartnerSpec | null {
  const spS =
    text.match(/このユニットからコンビネーションするSP(1\/\d)のSユニット/) ??
    text.match(/このビークルからコンビネーションするSP(1\/\d)のSユニット/);
  const rawFraction = spS?.[1];
  if (rawFraction && /^\d+\/\d+$/.test(rawFraction)) {
    return { kind: "s_sp_fraction", fraction: rawFraction as SpFraction };
  }

  if (/このユニットからコンビネーションする同カテゴリのLユニット/.test(text)) {
    return { kind: "l_size_same_category" };
  }
  if (/同カテゴリのLユニットがこのユニットからコンビネーション/.test(text)) {
    return { kind: "l_size_same_category" };
  }

  const catFeatS = text.match(
    /このユニットからコンビネーションする([A-Z]{2})を持ち特徴「([^」]+)」を持つSユニット/,
  );
  if (catFeatS?.[1] && catFeatS[2]) {
    const cat = parseCategoryToken(catFeatS[1]);
    if (cat) {
      return {
        kind: "s_category_features",
        categories: [cat],
        features: [catFeatS[2]],
      };
    }
  }

  const excludeFeatS = text.match(
    /このユニットからコンビネーションする、?特徴「([^」]+)」を持つ([A-Z]{2})以外のSユニット/,
  );
  if (excludeFeatS?.[1] && excludeFeatS[2]) {
    const excluded = parseCategoryToken(excludeFeatS[2]);
    return {
      kind: "s_category_features",
      categories: [],
      features: [excludeFeatS[1]],
      excludeCategories: excluded ? [excluded] : undefined,
    };
  }

  const featS = text.match(
    /このユニットからコンビネーションする特徴「([^」]+)」を持つSユニット/,
  );
  if (featS?.[1]) {
    return { kind: "s_features", features: [featS[1]] };
  }

  const quotedM = text.match(/このユニットからコンビネーションする「([A-Z]{2})」のMユニット/);
  if (quotedM?.[1]) {
    const cat = parseCategoryToken(quotedM[1]);
    if (cat) return { kind: "m_category", category: cat };
  }

  const namedOnly = text.match(/このユニットからコンビネーションする「([^」]+)」(?:は|の|$)/);
  if (namedOnly?.[1] && !quotedM) {
    return { kind: "named_card", cardName: namedOnly[1] };
  }

  if (/この(?:ユニット|ビークル)からコンビネーションするSユニット/.test(text)) {
    return { kind: "s_unit" };
  }

  const featAny = text.match(/このユニットからコンビネーションする、?特徴「([^」]+)」を持つユニット/);
  if (featAny?.[1]) {
    return { kind: "feature_any_size", features: [featAny[1]] };
  }

  return null;
}

function parseJointRPartnerFromText(text: string): JointRPartnerSpec | null {
  if (/これが同カテゴリのLユニットからコンビネーション/.test(text)) {
    return { kind: "l_size_same_category" };
  }

  const dualFeatS = text.match(/これが特徴「([^」]+)」と「([^」]+)」を持つSユニットから/);
  if (dualFeatS?.[1] && dualFeatS[2]) {
    return {
      kind: "s_features",
      features: [dualFeatS[1], dualFeatS[2]],
      requireAll: true,
    };
  }

  const featS = text.match(/これが特徴「([^」]+)」を持つ.+ユニットからコンビネーション/);
  if (featS?.[1]) {
    return { kind: "feature_unit", features: [featS[1]] };
  }

  const named = text.match(/これが「([^」]+)」からコンビネーション/);
  if (named?.[1]) {
    return { kind: "named_card", cardName: named[1] };
  }

  return null;
}

/** wiki 既定: L サイズ・同カテゴリ。テキストに別条件があればそちらを優先。 */
export function getJointLPartnerSpec(cardId: string): JointLPartnerSpec {
  for (const text of collectTexts(cardId)) {
    const parsed = parseJointLPartnerFromText(text);
    if (parsed) return parsed;
  }
  return { kind: "l_size_same_category" };
}

export function getJointRPartnerSpec(cardId: string): JointRPartnerSpec {
  for (const text of collectTexts(cardId)) {
    const parsed = parseJointRPartnerFromText(text);
    if (parsed) return parsed;
  }
  return { kind: "l_size_same_category" };
}

function printedSpMatchesFraction(sp: SpValue | undefined, fraction: SpFraction): boolean {
  return sp === fraction;
}

export function matchesJointLPartnerSpec(
  spec: JointLPartnerSpec,
  anchor: CardDefinition,
  partner: CardDefinition,
): boolean {
  switch (spec.kind) {
    case "l_size_same_category":
      return partner.size === "L" && partnerCategoryMatches(anchor.category, partner.category);
    case "s_sp_fraction":
      return partner.size === "S" && printedSpMatchesFraction(partner.sp, spec.fraction);
    case "s_unit":
      return partner.size === "S";
    case "s_features":
      return partner.size === "S" && cardHasAllFeatures(partner, spec.features);
    case "s_category_features": {
      if (partner.size !== "S") return false;
      if (!cardHasAllFeatures(partner, spec.features)) return false;
      const partnerCats = cardCategories(partner);
      if (spec.excludeCategories?.some((c) => partnerCats.includes(c))) return false;
      if (spec.categories.length === 0) return true;
      return spec.categories.some((c) => partnerCats.includes(c));
    }
    case "m_category":
      return partner.size === "M" && cardCategories(partner).includes(spec.category);
    case "named_card":
      return cardNameMatches(partner, spec.cardName);
    case "feature_any_size":
      return cardHasAllFeatures(partner, spec.features);
    default:
      return false;
  }
}

export function matchesJointRPartnerSpec(
  spec: JointRPartnerSpec,
  rUnit: CardDefinition,
  leftPartner: CardDefinition,
): boolean {
  switch (spec.kind) {
    case "l_size_same_category":
      return leftPartner.size === "L" && partnerCategoryMatches(rUnit.category, leftPartner.category);
    case "s_features": {
      if (leftPartner.size !== "S") return false;
      if (spec.requireAll) return cardHasAllFeatures(leftPartner, spec.features);
      return spec.features.some((f) => cardHasFeature(leftPartner, f));
    }
    case "named_card":
      return cardNameMatches(leftPartner, spec.cardName);
    case "feature_unit":
      return cardHasAllFeatures(leftPartner, spec.features);
    default:
      return false;
  }
}

export function matchesJointLPartnerById(
  anchorCardId: string,
  anchorDef: CardDefinition,
  partnerDef: CardDefinition,
): boolean {
  return matchesJointLPartnerSpec(getJointLPartnerSpec(anchorCardId), anchorDef, partnerDef);
}

export function matchesJointRPartnerById(
  rCardId: string,
  rDef: CardDefinition,
  leftPartnerDef: CardDefinition,
): boolean {
  return matchesJointRPartnerSpec(getJointRPartnerSpec(rCardId), rDef, leftPartnerDef);
}
