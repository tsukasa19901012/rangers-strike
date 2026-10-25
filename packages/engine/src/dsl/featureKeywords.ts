/**
 * 特徴名を含む grant_keyword（`no_attack_without_<特徴>` など）の組み立て・照合。
 * slug 化はカードパイプライン（`featureKeywordSlug`）と共通: 漢字を含む特徴は `feat_<utf8 hex>` で可逆。
 */
import {
  decodeFeatureKeywordSlug,
  featureKeywordSlug,
  featureMatchesKeywordSlug,
} from "@rangers-strike/cards/pipeline/extractEffects";

export { decodeFeatureKeywordSlug, featureKeywordSlug, featureMatchesKeywordSlug };

/** `${prefix}${slug(feature)}${suffix}` — パイプラインが生成するキーワードと同じ文字列。 */
export function featureKeyword(prefix: string, feature: string, suffix = ""): string {
  return `${prefix}${featureKeywordSlug(feature)}${suffix}`;
}

/** キーワード中の特徴 slug が、ユニットの特徴のいずれかを表すか。 */
export function featuresMatchKeywordSlug(
  features: readonly string[] | undefined,
  slug: string,
): boolean {
  return (features ?? []).some((f) => featureMatchesSlugCached(f, slug));
}

/** 特徴と slug の照合の結果（文字列だけで決まる。BP の計算のたびに特徴を slug にしていた）。 */
const featureSlugMatchCache = new Map<string, boolean>();

function featureMatchesSlugCached(feature: string, slug: string): boolean {
  const key = `${feature}\u0000${slug}`;
  let hit = featureSlugMatchCache.get(key);
  if (hit === undefined) {
    hit = featureMatchesKeywordSlug(feature, slug);
    featureSlugMatchCache.set(key, hit);
  }
  return hit;
}

/**
 * エンジンがカード固有に名指しする特徴キーワード（静的監査 audit-hollow-keywords が文字列一致で
 * 消費を検出できるようリテラルで持つ。featureKeywords.test.ts で featureKeyword() と一致を確認）。
 */
export const FEATURE_KEYWORDS = {
  /** XG3-072: 特徴「男」を持つ敵軍ユニットを1体選び撃破する。 */
  holdEntryDestroyMale: "hold_entry_destroy_feat_e794b7",
  /** SR-003: 自軍捨札にある特徴「恐竜」を持つカード1枚につきBP＋1000、BP8000以上で SP1。 */
  bpPerDiscardDinosaur: "bp_plus_per_discard_feature_feat_e68190e7ab9c_1000_sp_at_8000",
  /** SX-004 / XG4-004 / XG7-017: 特徴「車両」を持つビークルに RC なしでライドできる。 */
  canRideVehicleCar: "can_ride_vehicle_feat_e8bb8ae4b8a1",
  /** XG2-042 / XP-005: パワーゾーンの「仮面ライダー」を捨札にして留まる。 */
  registerStayKamenRider: "register_stay_on_power_discard_feat_e4bbaee99da2e383a9e382a4e38380e383bc",
  /** RK-142 系: パワーゾーンでオモテ向きの間、味方「仮面ライダー」のバトルエリア進入に反応。 */
  powerFaceupKamenRiderEnterBattle:
    "power_faceup_feat_e4bbaee99da2e383a9e382a4e38380e383bc_enter_battle",
} as const;
