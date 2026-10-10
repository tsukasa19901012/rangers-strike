import { slugifyEffectId } from "./metaMaps";

/**
 * 特徴名（「航空機」「忍者」「メカ」など）→ grant_keyword 用 ASCII slug。
 *
 * 旧実装は効果名用の {@link slugifyEffectId} をそのまま使っていたため、漢字はローマ字化されず
 * 「航空機」「忍者」「警察」「女」などがすべて `fx_unknown` に潰れ、エンジン側で特徴を復元できなかった
 * （例: `no_attack_without_fx_unknown`）。
 *
 * - 漢字を含まない特徴（カタカナ・英数字）は従来どおりの読みやすい slug（メカ → `meka`、スワット → `suwato`）。
 * - 漢字を含む特徴は UTF-8 の 16 進を `feat_` に続けて埋め込む（航空機 → `feat_e888aae7a9bae6a99f`）。
 *   {@link decodeFeatureKeywordSlug} で元の特徴名に戻せる（可逆）。
 */
export const FEATURE_HEX_SLUG_PREFIX = "feat_";

/** カード名 slug（`named_<hex>`）と同形式の旧 hex slug も復元対象にする。 */
const LEGACY_HEX_SLUG_PREFIX = "named_";

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/;

function utf8Hex(text: string): string {
  return [...new TextEncoder().encode(text)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeFeature(feature: string): string {
  return feature.normalize("NFKC").trim();
}

/** 特徴名 → 16 進 slug（常に可逆）。 */
export function hexFeatureSlug(feature: string): string {
  return `${FEATURE_HEX_SLUG_PREFIX}${utf8Hex(normalizeFeature(feature))}`;
}

/** 特徴名 → grant_keyword 用 slug。 */
export function featureKeywordSlug(feature: string): string {
  if (!KANJI.test(feature)) {
    const legacy = slugifyEffectId(feature);
    if (!/^(?:fx_unknown|effect_|named_)/.test(legacy)) return legacy;
  }
  return hexFeatureSlug(feature);
}

/** `feat_<hex>`（旧 `named_<hex>`）slug を特徴名に戻す。16 進形式でなければ null。 */
export function decodeFeatureKeywordSlug(slug: string): string | null {
  const prefix = [FEATURE_HEX_SLUG_PREFIX, LEGACY_HEX_SLUG_PREFIX].find((p) => slug.startsWith(p));
  if (!prefix) return null;
  const body = slug.slice(prefix.length);
  if (!/^(?:[0-9a-f]{2})+$/.test(body)) return null;
  const bytes = new Uint8Array(body.match(/../g)!.map((h) => parseInt(h, 16)));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** 旧エンジン実装の slug（NFKD + \w、非 ASCII は先頭 6 バイトの hex）。既存データ互換用。 */
function legacyEngineFeatureSlug(feature: string): string {
  const ascii = feature
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return ascii;
  return `${LEGACY_HEX_SLUG_PREFIX}${utf8Hex(feature).slice(0, 12)}`;
}

/** 特徴名がキーワード中の特徴 slug を表すか。 */
export function featureMatchesKeywordSlug(feature: string, slug: string): boolean {
  if (slug === featureKeywordSlug(feature)) return true;
  if (decodeFeatureKeywordSlug(slug) === normalizeFeature(feature)) return true;
  return slug === legacyEngineFeatureSlug(feature);
}
