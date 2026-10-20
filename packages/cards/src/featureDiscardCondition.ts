import type { RushAdditionalCondition } from "./effectTaxonomy";

/**
 * 「特徴「激気」と「レッド」を持つ自軍ユニット1体を捨札にする」— 特徴（複数なら「と」でつなぐ。すべて持つ）で指定する
 * 捨札の追加条件。取り込みデータがカード名の指定（discard_named_unit・partnerName「激気」）になっていても、
 * 文言どおり特徴で判定する（RS-423〜RS-425 ゲキタイガー等）。
 */
export function parseFeatureDiscardCondition(text: string): RushAdditionalCondition | undefined {
  // 「特徴「レッド」または「宇宙海賊」を持つ自軍ユニット1体を捨札にする」（XP-032 atwiki/page-2444）・
  // 「追加条件：特徴「ダブルドライバー」か「アクセルドライバー」を持つ…１体を捨札にする」（XP-029 atwiki/page-2362）— どれか1つを持てばよい。
  const anyOf = text
    .replace(/^追加条件[：:]/, "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .match(/^特徴((?:[「｢][^」｣]+[」｣](?:か|または))+[「｢][^」｣]+[」｣])を持つ自軍(S|M|L)?ユニット(\d+)体を捨札にする$/);
  if (anyOf) {
    const features = [...anyOf[1]!.matchAll(/[「｢]([^」｣]+)[」｣]/g)].map((x) => x[1]!);
    return {
      conditionId: "discard_feature_unit",
      text,
      requiredFeature: features[0],
      anyOfFeatures: features,
      ...(anyOf[2] ? { requiredSize: anyOf[2] as "S" | "M" | "L" } : {}),
      unitCount: Number(anyOf[3]),
    };
  }
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
