/**
 * ナンバーコンビネーション（NC）が成立したときだけ有効な「アタックするとき」の効果。
 *
 * 「（この効果は「バルイーグル」または「バルパンサー」からコンビネーションするときは、ナンバーに関係なく
 * 発動する）」と書かれた効果（RS-032【シャークジョーズ】、RS-033【パンサークロー】、RS-189、RS-190 等）は
 * NC の効果であり、ナンバーと並び順が一致するか、指定のユニットからコンビネーションしてバトルエリアに出たときだけ
 * 有効になる（ルール: R-CN-02、R-CN-05）。成立はバトルエリアに出たときに判定し、activatedNcEffects に記録する。
 */
import {
  findNamedEffectByEffectId,
  getOnAttackNamedEffect,
  isNcColumnNamedEffect,
  listNcColumnNamedEffects,
} from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";

function cardCategoriesOf(def: { category?: unknown } | undefined): string[] {
  const c = def?.category;
  return Array.isArray(c) ? (c as string[]) : typeof c === "string" ? [c] : [];
}

type OnAttackNamed = NonNullable<ReturnType<typeof getOnAttackNamedEffect>>;

const PARTNER_FEATURE_RE = /特徴「([^」]+)」を持つユニットからコンビネーション/;
/** 「WBのユニットからコンビネーションするときは」（カテゴリ指定。RS-361【飛羽返し】atwiki/page-512）。 */
const PARTNER_CATEGORY_RE = /(?:^|[（(、。」])「?(WB|OT|ET|MA|DA)」?のユニットからコンビネーション/;

function partnerCardIds(named: OnAttackNamed): string[] | undefined {
  const trigger = named.trigger as { comboPartnerCardIds?: string[]; partnerCardIds?: string[] };
  return trigger.comboPartnerCardIds ?? trigger.partnerCardIds;
}

/**
 * CN の欄に書かれた（ナンバーコンビネーションの）「アタックするとき」の効果。但し書きが無くても
 * NC が成立したときだけ有効（ルール: R-CN-01 / R-CN-02）。
 * - RS-104 アバレイエロー【プテラダガー】（atwiki/page-233「CN：3」）
 * - RS-106 / PR-006 デカレッド【ジュウクンドー】（atwiki/page-23「CN：1」。発動可否は rules/juuKunDo.ts）
 */
const CN_COLUMN_ON_ATTACK_EFFECT_IDS = new Set<string>(["ptera_dagger", "juu_kun_do"]);

/** NC 成立が必要な「アタックするとき」の効果か（「ナンバーに関係なく発動する」の但し書きを持つ、または CN の欄の効果）。 */
export function isNcGatedOnAttackEffect(named: OnAttackNamed, cardId?: string): boolean {
  if (CN_COLUMN_ON_ATTACK_EFFECT_IDS.has(named.effectId)) return true;
  if (cardId && isNcColumnNamedEffect(cardId, named)) return true;
  return !!partnerCardIds(named)?.length || (named.text ?? "").includes("ナンバーに関係なく");
}

/** 直前のユニット（左隣）から、但し書きの指定どおりコンビネーションしたか。 */
export function comboFromNamedPartner(
  state: Pick<GameState, "definitions">,
  named: OnAttackNamed,
  leftNeighborCardId: string | undefined,
  leftNeighborCategories?: readonly string[],
): boolean {
  if (!leftNeighborCardId) return false;
  const ids = partnerCardIds(named);
  if (ids?.includes(leftNeighborCardId)) return true;
  // カテゴリ指定はバトルエリアでのカテゴリ（「※バトルエリアにあるとき、カテゴリにWBが追加される」を含む）で判定する。
  const category = (named.text ?? "").match(PARTNER_CATEGORY_RE)?.[1];
  if (category) {
    const cats = leftNeighborCategories ?? cardCategoriesOf(state.definitions[leftNeighborCardId]);
    return cats.includes(category);
  }
  const feature = (named.text ?? "").match(PARTNER_FEATURE_RE)?.[1];
  if (!feature) return false;
  return (state.definitions[leftNeighborCardId]?.features ?? []).includes(feature);
}

/**
 * 「アタックするとき」の名前つき効果のうち、現在有効なものの effectId。
 * NC 成立が必要な効果は、成立していなければ undefined。
 */
export function activeOnAttackNamedEffect(card: Pick<CardInstance, "cardId" | "activatedNcEffects">): OnAttackNamed | undefined {
  const named = getOnAttackNamedEffect(card.cardId);
  if (!named) return undefined;
  if (isNcGatedOnAttackEffect(named, card.cardId) && !card.activatedNcEffects?.includes(named.effectId)) {
    return undefined;
  }
  return named;
}

export function activeOnAttackNamedEffectId(card: Pick<CardInstance, "cardId" | "activatedNcEffects">): string | undefined {
  return activeOnAttackNamedEffect(card)?.effectId;
}

/**
 * 名前つき効果 effectId がこのユニットで有効か。NC の効果（ナンバーの欄の効果: trigger nc / nc_or_combo_from）は
 * バトルエリアに出たときに NC が成立していなければ有効にならない（ルール: R-CN-02 / R-CN-03）。
 * 例: RS-057【レッドファイヤー】、RS-062【ボウケンジャベリン】の「アタックするとき BP＋」。
 */
export function namedEffectActive(
  card: Pick<CardInstance, "cardId" | "activatedNcEffects">,
  effectId: string,
): boolean {
  return activeNamedEffect(card, effectId) !== undefined;
}

/**
 * findNamedEffectByEffectId の NC ゲート付き版。カードがその効果を持ち、かつ（NC の効果なら）NC が成立して
 * いるときだけ効果を返す。場のユニットの効果を参照するときは原則こちらを使う（ルール: R-CN-02）。
 */
export function activeNamedEffect(
  card: Pick<CardInstance, "cardId" | "activatedNcEffects">,
  effectId: string,
): ReturnType<typeof findNamedEffectByEffectId> {
  const named = findNamedEffectByEffectId(card.cardId, effectId);
  if (!named) return undefined;
  if (isNcColumnNamedEffect(card.cardId, named) && !(card.activatedNcEffects?.includes(effectId) ?? false)) {
    return undefined;
  }
  return named;
}

/**
 * effectId（名前つき効果に限らない。DSL の効果 id 等）の発動が NC ゲートで止められていないか。
 * カードの NC の効果でなければ常に true。
 */
export function ncGateAllows(
  card: Pick<CardInstance, "cardId" | "activatedNcEffects">,
  effectId: string,
): boolean {
  const named = findNamedEffectByEffectId(card.cardId, effectId);
  if (!named || !isNcColumnNamedEffect(card.cardId, named)) return true;
  return card.activatedNcEffects?.includes(effectId) ?? false;
}

/**
 * バトルエリアに出たときに成立した NC の効果の effectId。
 * - ナンバーと並び順が一致すれば、ナンバーの欄の効果すべて（R-CN-02）
 * - 「（この効果は○○からコンビネーションするときは、ナンバーに関係なく発動する）」の効果は、直前のユニット
 *   （左隣）が指定どおりならその効果（R-CN-05）
 */
export function ncColumnEffectIdsEstablished(
  state: Pick<GameState, "definitions">,
  cardId: string,
  numberMatches: boolean,
  leftNeighborCardId: string | undefined,
  leftNeighborCategories?: readonly string[],
): string[] {
  const ids: string[] = [];
  for (const named of listNcColumnNamedEffects(cardId)) {
    if (numberMatches || comboFromNamedPartner(state, named, leftNeighborCardId, leftNeighborCategories)) {
      ids.push(named.effectId);
    }
  }
  return ids;
}
