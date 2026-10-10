import type { RushAdditionalCondition } from "./effectTaxonomy";

/**
 * 「特徴「激気」と「レッド」を持つ自軍ユニット1体を捨札にする」— 特徴（複数なら「と」でつなぐ。すべて持つ）で指定する
 * 捨札の追加条件。取り込みデータがカード名の指定（discard_named_unit・partnerName「激気」）になっていても、
 * 文言どおり特徴で判定する（RS-423〜RS-425 ゲキタイガー等）。
 */
export function parseFeatureDiscardCondition(text: string): RushAdditionalCondition | undefined {
  const m = text.match(/^特徴((?:[「｢][^」｣]+[」｣]と)*[「｢][^」｣]+[」｣])を持つ自軍(S|M|L)?ユニット(\d+)体を捨札にする$/);
  if (!m) return undefined;
  const features = [...m[1]!.matchAll(/[「｢]([^」｣]+)[」｣]/g)].map((x) => x[1]!);
  return {
    conditionId: "discard_feature_unit",
    text,
    requiredFeature: features[0],
    ...(features.length > 1 ? { requiredFeatures: features } : {}),
    ...(m[2] ? { requiredSize: m[2] as "S" | "M" | "L" } : {}),
    unitCount: Number(m[3]),
  };
}
