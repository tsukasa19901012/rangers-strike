import type { Category } from "./schema";
import type { ZordConditionId } from "./effectTaxonomy";
import { findNamedEffectByEffectId } from "./unitEffects";
import {
  getZordCondition,
  isFieldDiscardZordMaterialCondition,
  resolveRushAdditionalCondition,
} from "./zord";

export type MothershipKind = "jaguar" | "dekabase";

export const MOTHERSHIP_CONFIG: Record<
  MothershipKind,
  {
    cardId: string;
    commandCategory: Category;
    substitutesCondition: ZordConditionId;
  }
> = {
  jaguar: {
    cardId: "RS-076",
    commandCategory: "ET",
    substitutesCondition: "send_s_unit_to_command_or_discard",
  },
  dekabase: {
    cardId: "RS-105",
    commandCategory: "OT",
    substitutesCondition: "send_s_unit_to_power",
  },
};

export function mothershipSubstitutesCondition(
  kind: MothershipKind,
  condition: ZordConditionId | undefined,
): boolean {
  if (!condition) return false;
  return condition === MOTHERSHIP_CONFIG[kind].substitutesCondition;
}

export function mothershipHoldCountForRush(rushingCardId: string): number {
  return resolveRushAdditionalCondition(rushingCardId)?.unitCount ?? 1;
}

/** ゾード追加コストの S ユニット枠のうち、このラッシュの素材で充足する数。 */
export function zordSlotsFilledByMaterial(
  rushingCardId: string,
  hasMaterial: boolean,
  materialDestination?: "command" | "discard",
): number {
  if (!hasMaterial) return 0;
  const condition = getZordCondition(rushingCardId);
  if (
    condition === "send_s_unit_to_command_or_discard" &&
    (materialDestination === "command" || materialDestination === "discard")
  ) {
    return 1;
  }
  if (condition === "send_s_unit_to_power") return 1;
  if (condition === "send_s_unit_to_discard") return 1;
  if (condition && isFieldDiscardZordMaterialCondition(condition)) return 1;
  return 0;
}

/** S ユニット素材支払い後も必要な母艦ホールド数（Q7 部分充足）。 */
export function mothershipHoldsRequiredForRush(
  rushingCardId: string,
  slotsFilledByMaterial: number,
): number {
  return Math.max(0, mothershipHoldCountForRush(rushingCardId) - slotsFilledByMaterial);
}

/** ジャガー母艦は捨札経路の追加コストと併用不可（Q5）。 */
export function jaguarMothershipAllowedWithMaterial(
  rushingCardId: string,
  materialDestination?: "command" | "discard",
): boolean {
  if (getZordCondition(rushingCardId) !== "send_s_unit_to_command_or_discard") return false;
  return materialDestination !== "discard";
}

const CATEGORY_NAMES: Record<string, Category> = {
  OT: "OT",
  ET: "ET",
  MA: "MA",
  WB: "WB",
  DA: "DA",
  オーバーテクノロジー: "OT",
  アーステクノロジー: "ET",
  ミスティックアームズ: "MA",
  ワイルドビースト: "WB",
  ダークアライアンス: "DA",
};

/** 本文から読み取った【母艦】の内容（RS-076・RS-105・RS-260 等。カード ID ではなく文言で判断する）。 */
export type MothershipTextAbility = {
  kind: MothershipKind;
  commandCategory: Category;
  substitutesCondition: ZordConditionId;
  /** ラッシュする M ユニットが持つべき特徴（例: RS-260「特徴「航空機」を持つ」）。 */
  requiredFeature?: string;
  /** ラッシュする M ユニットが持つべきカテゴリ（例: RS-260「「OT」のMユニット」）。 */
  requiredCategory?: Category;
  /** ホールドに加えて「自軍山札の上から1枚を自軍パワーゾーンに置く」（RS-260）。 */
  topDeckToPower: boolean;
};

const MOTHERSHIP_TEXT_RE =
  /【母艦】これが自軍ラッシュエリアにある(?:とき|間)、自分が(?:特徴「([^」]+)」を持つ)?(?:「([^」]+)」の)?Mユニットをラッシュする(?:とき)?、追加条件を満たすために次のようにしてもよい⇒自軍Sユニットを1体(コマンドゾーン|パワーゾーン)に送るかわりに、「([^」]+)」の自軍コマンドを1つホールド(?:する|し)(、自軍山札の上から1枚を自軍パワーゾーンに置く)?/;

/** カード本文の【母艦】を読み取る（なければ null）。 */
export function parseMothershipText(text: string | undefined): MothershipTextAbility | null {
  if (!text) return null;
  const m = MOTHERSHIP_TEXT_RE.exec(text.normalize("NFKC").replace(/\s+/g, ""));
  if (!m) return null;
  const commandCategory = CATEGORY_NAMES[m[4]!];
  if (!commandCategory) return null;
  const toCommand = m[3] === "コマンドゾーン";
  return {
    kind: toCommand ? "jaguar" : "dekabase",
    commandCategory,
    substitutesCondition: toCommand ? "send_s_unit_to_command_or_discard" : "send_s_unit_to_power",
    requiredFeature: m[1],
    requiredCategory: m[2] ? CATEGORY_NAMES[m[2]] : undefined,
    topDeckToPower: !!m[5],
  };
}

const MOTHERSHIP_EFFECT_IDS: Record<MothershipKind, string> = {
  jaguar: "jaguar_mothership",
  dekabase: "dekabase_mothership",
};

export function activeMothershipKindInRush(
  rushCardIds: string[],
): MothershipKind | null {
  for (const cardId of rushCardIds) {
    if (findNamedEffectByEffectId(cardId, MOTHERSHIP_EFFECT_IDS.jaguar)) return "jaguar";
    if (findNamedEffectByEffectId(cardId, MOTHERSHIP_EFFECT_IDS.dekabase)) return "dekabase";
  }
  return null;
}

export function mothershipKindForZordRush(
  rushingCardId: string,
  rushCardIds: string[],
): MothershipKind | null {
  const kind = activeMothershipKindInRush(rushCardIds);
  if (!kind) return null;
  const condition = getZordCondition(rushingCardId);
  if (!mothershipSubstitutesCondition(kind, condition)) return null;
  return kind;
}
