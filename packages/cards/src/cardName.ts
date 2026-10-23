/** ゾード素材・名前指定の照合に使う名称（前後の空白を除く）。カードデータの名前は印刷名そのまま。 */
export function canonicalCardName(name: string): string {
  return name.trim();
}

export function sameCanonicalCardName(a: string, b: string): boolean {
  return canonicalCardName(a) === canonicalCardName(b);
}

// 「※自軍Lユニットがなければ、これは「A＋B」としてつかえる」（XG6-018 アバレキラー）の条件つき別名も読む。
// 条件は fusionMaterialAliasRequiresNoOwnL で判定する（場の状態はエンジン側で確認する）。
const FUSION_ALIAS_SEGMENT = /※(?:自軍Lユニットがなければ、)?これは(.+?)としてつかえる/;
const FUSION_ALIAS_NO_OWN_L = /※自軍Lユニットがなければ、これは.+?としてつかえる/;

/** 「※自軍Lユニットがなければ、これは…としてつかえる」— 自軍 L ユニットがあるときは別名として使えない。 */
export function fusionMaterialAliasRequiresNoOwnL(text: string | undefined): boolean {
  return !!text && FUSION_ALIAS_NO_OWN_L.test(text);
}
const QUOTED_NAME_PATTERN = /「([^」]+)」/g;

/** カード文面の「○○としてつかえる」別名（正規化済み）。複数名「A」または「B」にも対応。 */
export function fusionMaterialAliasNames(text: string | undefined): string[] {
  if (!text) return [];
  const segMatch = text.match(FUSION_ALIAS_SEGMENT);
  if (!segMatch?.[1]) return [];
  const names: string[] = [];
  for (const nameMatch of segMatch[1].matchAll(QUOTED_NAME_PATTERN)) {
    names.push(canonicalCardName(nameMatch[1]!));
  }
  return names;
}
