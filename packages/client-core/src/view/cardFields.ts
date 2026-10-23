// The card's attributes as the wiki lists them (カテゴリ, BP, SP, 必要パワー,
// 追加条件, CN, 特徴, 作品), one "label：value" line each, for card detail views.
import type { CardDefinition } from "../engineApi";

export const CATEGORY_NAMES: Record<string, string> = {
  ET: "アーステクノロジー",
  WB: "ワイルドビースト",
  OT: "オーバーテクノロジー",
  MA: "ミスティックアームズ",
  DA: "ダークアライアンス",
};

export function cardFieldLines(def: CardDefinition): string[] {
  const categories = ([] as string[]).concat(def.category ?? []);
  const field = def.type === "unit" || def.type === "vehicle";
  const lines = [`カテゴリ：${categories.map((c) => CATEGORY_NAMES[c] ?? c).join("/") || "なし"}`];
  if (field) {
    lines.push(`BP：${def.bp ?? "なし"}`);
    lines.push(`SP：${def.sp === undefined || def.sp === null ? "なし" : def.sp === "special" ? "！" : def.sp}`);
  }
  lines.push(`必要パワー：${def.powerCost ?? "なし"}`);
  if (field) lines.push(`追加条件：${def.rushAdditionalCondition?.text ?? "なし"}`);
  if (def.comboNumber !== undefined && def.comboNumber !== null) lines.push(`CN：${def.comboNumber}`);
  if (def.features?.length) lines.push(`特徴：${def.features.join("/")}`);
  // A card from two works (SX-009) lists both, one line each: a title can contain "/" itself (仮面ライダーオーズ/OOO).
  for (const work of def.works ?? []) lines.push(`作品：${work}`);
  return lines;
}

/**
 * Card text with each effect on its own line: a break before every ※ effect
 * (no name) and every 【name】 effect, except where one is quoted or granted
 * (「…」, 『…』, ⇒※). The space that separated them goes.
 */
export function effectParagraphs(text: string): string {
  return text
    .replace(/(\s*)([※【])/g, (match, _gap: string, mark: string, offset: number) =>
      offset === 0 || "「『⇒".includes(text[offset - 1]!) ? match : `\n${mark}`,
    )
    .trim();
}
