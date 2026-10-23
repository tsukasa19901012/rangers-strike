import type { CardDefinition } from "@rangers-strike/cards";
import { fusionMaterialAliasNames, fusionMaterialAliasRequiresNoOwnL } from "@rangers-strike/cards";

/**
 * 同名カード判定（カードデータの名前は印刷名なので、そのまま比べる）。
 * glossary「2nd」: カードテキストや種類が異なっても同名カードとして扱う。
 */
export function sameCardName(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (!a || !b) return false;
  return a === b;
}

/**
 * カード名と「※これは「X」としてつかえる」の別名（XG1-070 ディケイド カブトRF 等）。
 * 「これは「○○」として使える。」は山札・手札・エリア・ゾーン・常駐置き場・捨札などの全ての場で常に有効で、特定のカード名を指定する効果の対象になる
 * （atwiki/page-1668 Q1）。「※自軍Lユニットがなければ、…」（XG6-018）の条件つき別名は場の状態が要るので含めない（rules/zord.ts fusionAliasUsable）。
 */
export function namesWithAliases(def: Pick<CardDefinition, "name" | "text"> | undefined): string[] {
  if (!def) return [];
  if (fusionMaterialAliasRequiresNoOwnL(def.text)) return [def.name];
  return [def.name, ...fusionMaterialAliasNames(def.text)];
}

/** カード名か「※これは「X」としてつかえる」の別名が name と同名か（sameCardName）。 */
export function hasNameOrAlias(def: Pick<CardDefinition, "name" | "text"> | undefined, name: string): boolean {
  return namesWithAliases(def).some((n) => sameCardName(n, name));
}
