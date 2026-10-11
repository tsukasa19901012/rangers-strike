/**
 * 「これが自軍エリアにある間、（自軍）特徴「X」を持つ（S/M/L）ユニットは、次の能力を得る⇒※キーワード」型の常時効果。
 *
 * 場（ラッシュエリア・バトルエリア）にある効果の持ち主のカードの DSL 本文（while_in_field）を読み、条件に合うユニットに
 * キーワード（ウイング等）を与える。「自軍」と書かれていなければ、敵軍のユニットも能力を得る（RS-657【航空戦力との連携】
 * atwiki/page-1475「特徴「航空機」を持つユニットは」）。
 */
import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { getCardDslDocument } from "../dsl/effectLookup";

type GrantedKeyword = "wing" | "register" | "morph" | "chase";

type FieldKeywordAura = {
  ownOnly: boolean;
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

const AURA_RE =
  /^これが自軍エリアにある間、(自軍)?特徴「([^」]+)」を持つ(?:([SML])ユニット|ユニット)は、?次の能力を得る⇒※(ウイング|レジスト|モーフ|チェイス)。?$/;

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
      ownOnly: !!m[1],
      feature: m[2]!,
      size: m[3] as FieldKeywordAura["size"],
      keyword: KEYWORD_BY_LABEL[m[4]!]!,
    });
  }
  AURA_CACHE.set(cardId, auras);
  return auras;
}

/** 場の常時効果で、playerId のユニット cardId が keyword を得ているか。 */
export function fieldAuraGrantsKeyword(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  keyword: string,
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.type !== "unit") return false;
  for (const ownerId of ["player1", "player2"] as const) {
    const owner = state.players[ownerId];
    for (const source of [...owner.rush, ...owner.battle]) {
      for (const aura of aurasOf(source.cardId)) {
        if (aura.keyword !== keyword) continue;
        if (aura.ownOnly && ownerId !== playerId) continue;
        if (aura.size && def.size !== aura.size) continue;
        if (!(def.features ?? []).includes(aura.feature)) continue;
        return true;
      }
    }
  }
  return false;
}
