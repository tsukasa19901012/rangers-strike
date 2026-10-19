/**
 * 「これが自軍エリアにある間、（自軍）特徴「X」を持つ（S/M/L）ユニットは、次の能力を得る⇒※キーワード」型の常時効果。
 *
 * 場（ラッシュエリア・バトルエリア）にある効果の持ち主のカードの DSL 本文（while_in_field）を読み、条件に合うユニットに
 * キーワード（ウイング等）を与える。能力を得るのは効果の持ち主（自軍）のユニットだけ。RK-316【フエッスル】
 * 「特徴「魔皇力」を持つ自軍Sユニットは、次の能力を得る⇒※モーフ（…）」は本文どおり自軍だけ。
 * 「自軍」と書かれていない RS-657【航空戦力との連携】（atwiki/page-1475「特徴「航空機」を持つユニットは」）も自軍のユニットだけが得る
 * （ユーザー判断 2026-10-14、docs/rules/README.md §5.7 f。2026-10-19 のユーザー決定で、本文に自軍・敵軍の指定がない付与効果すべてに
 * 広げた。§5.7 n）。
 */
import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { getCardDslDocument } from "../dsl/effectLookup";

type GrantedKeyword = "wing" | "register" | "morph" | "chase";

type FieldKeywordAura = {
  feature: string;
  size?: "S" | "M" | "L";
  keyword: GrantedKeyword;
};

const KEYWORD_BY_LABEL: Record<string, GrantedKeyword> = {
  ウイング: "wing",
  レジスト: "register",
  モーフ: "morph",
  チェイス: "chase",
};

// 「自軍」は特徴の前（「自軍特徴「X」を持つ…」）にも後（「特徴「魔皇力」を持つ自軍Sユニットは」RK-316【フエッスル】）にも書かれる。
// 付与するキーワードの後ろの注釈（「※モーフ（敵軍ユニットが…）」）は読み飛ばす。
const AURA_RE =
  /^これが自軍エリアにある間、(自軍)?特徴「([^」]+)」を持つ(自軍)?(?:([SML])ユニット|ユニット)は、?次の能力を得る⇒※(ウイング|レジスト|モーフ|チェイス)(?:\(.*\))?。?$/;

const AURA_CACHE = new Map<string, FieldKeywordAura[]>();

function aurasOf(cardId: string): FieldKeywordAura[] {
  const cached = AURA_CACHE.get(cardId);
  if (cached) return cached;
  const auras: FieldKeywordAura[] = [];
  for (const effect of getCardDslDocument(cardId)?.effects ?? []) {
    if (effect.trigger.type !== "while_in_field") continue;
    const m = (effect.text ?? "").normalize("NFKC").replace(/\s+/g, "").match(AURA_RE);
    if (!m) continue;
    auras.push({
      feature: m[2]!,
      size: m[4] as FieldKeywordAura["size"],
      keyword: KEYWORD_BY_LABEL[m[5]!]!,
    });
  }
  AURA_CACHE.set(cardId, auras);
  return auras;
}

/**
 * 場の常時効果で、playerId のユニット cardId が keyword を得ているか。見るのは playerId 自身の場の効果だけ
 * （本文に「自軍」がなくても自軍のユニットだけ。ユーザー決定 2026-10-19「自軍だけ」、docs/rules/README.md §5.7 n）。
 */
export function fieldAuraGrantsKeyword(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  keyword: string,
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.type !== "unit") return false;
  const owner = state.players[playerId];
  for (const source of [...owner.rush, ...owner.battle]) {
    for (const aura of aurasOf(source.cardId)) {
      if (aura.keyword !== keyword) continue;
      if (aura.size && def.size !== aura.size) continue;
      if (!(def.features ?? []).includes(aura.feature)) continue;
      return true;
    }
  }
  return false;
}
