/**
 * 収録エディション表記（2nd / クロスギャザー XG 系）。正式カード名ではないため除去する。
 * 例: デカマスター（2nd）→ デカマスター、ファイブレッド（XG2）→ ファイブレッド
 */
const EDITION_SUFFIX_PATTERN = /（(?:2nd|XG\d*)）$/u;

export function stripEditionSuffix(name: string): string {
  return name.replace(EDITION_SUFFIX_PATTERN, "");
}

export function hasEditionSuffix(name: string): boolean {
  return EDITION_SUFFIX_PATTERN.test(name);
}

/** デッキ同名制限・ゾード素材照合に使う正規化名称。 */
export function canonicalCardName(name: string): string {
  return stripEditionSuffix(name.trim());
}

export function sameCanonicalCardName(a: string, b: string): boolean {
  return canonicalCardName(a) === canonicalCardName(b);
}

const FUSION_ALIAS_PATTERN = /※これは「([^」]+)」としてつかえる/;

/** カード文面の「○○としてつかえる」別名（正規化済み）。 */
export function fusionMaterialAliasNames(text: string | undefined): string[] {
  if (!text) return [];
  const match = text.match(FUSION_ALIAS_PATTERN);
  if (!match?.[1]) return [];
  return [canonicalCardName(match[1])];
}
