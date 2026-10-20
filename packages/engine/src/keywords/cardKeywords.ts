import type { CardDefinition, KeywordNotationLabel } from "@rangers-strike/cards";
import { textHasKeywordNotation } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { cardHasDslGrantKeyword } from "../dsl/promotedKeywordBridge";
import { rocketBoosterMatchesCard } from "../rules/rocketBooster";
import { fieldAuraGrantsKeyword } from "../rules/fieldGrantedKeywords";
import { xg1GrantsChase } from "../rules/xg1/xg1Fields";
import { actionContextState } from "../rules/zordFeatureContext";

export type CardKeyword = "wing" | "chase" | "commander" | "register" | "morph" | "resident";

/** 本文の「※キーワード」表記ラベル（コマンダーはカード種別で判定するので本文を見ない）。 */
const KEYWORD_NOTATION_LABEL: Record<CardKeyword, KeywordNotationLabel | null> = {
  wing: "ウイング",
  chase: "チェイス",
  commander: null,
  register: "レジスト",
  morph: "モーフ",
  resident: "常駐",
};

/** 構造化フィールド（keywords / tags）で使われる識別子。 */
const KEYWORD_IDENTIFIERS: Record<CardKeyword, string[]> = {
  wing: ["wing", "ウイング"],
  chase: ["chase", "チェイス"],
  commander: ["commander", "コマンダー"],
  register: ["register", "レジスト", "resist"],
  morph: ["morph", "モーフ"],
  resident: ["resident", "常駐"],
};

/**
 * カード定義からキーワードを検出する（DSL grant_keyword / keywords / tags / 本文の「※キーワード」表記）。
 * ルール: R-KW-00 — 効果名や本文中の同じ語（「ダークウイング」「レジストを持つ敵軍…」）では持たない。
 * 特徴（features）は特徴であってキーワードではないので見ない。
 */
export function cardHasKeyword(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  keyword: CardKeyword,
  context?: { state: GameState; playerId: PlayerId },
): boolean {
  if (
    keyword === "wing" &&
    context &&
    rocketBoosterMatchesCard(context.state, context.playerId, cardId)
  ) {
    return true;
  }
  if (cardHasDslGrantKeyword(cardId, keyword)) return true;
  // XG1-015 宇宙警察（「警察」の S ユニットはチェイス。rules/xg1/xg1Fields.ts）。
  if (keyword === "chase" && xg1GrantsChase(context?.state ?? actionContextState(), context?.playerId, cardId)) return true;
  // 「これが自軍エリアにある間、特徴「X」を持つユニットは次の能力を得る⇒※ウイング」等（RS-657。rules/fieldGrantedKeywords.ts）。
  if (context && fieldAuraGrantsKeyword(context.state, context.playerId, cardId, keyword)) return true;
  const def = definitions[cardId];
  if (!def) return false;
  if (def.type === "commander" && keyword === "commander") return true;
  const identifiers = KEYWORD_IDENTIFIERS[keyword];
  const explicitKeywords = (def as CardDefinition & { keywords?: string[] }).keywords;
  if (explicitKeywords?.some((k) => identifiers.includes(k.toLowerCase()))) return true;
  if (def.tags?.some((t) => identifiers.includes(t.toLowerCase()))) return true;
  const label = KEYWORD_NOTATION_LABEL[keyword];
  return label !== null && textHasKeywordNotation(def.text, label);
}

export function playerHasChaseUnitInField(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  const zones = [...player.rush, ...player.battle] as const;
  return zones.some((c) => cardHasKeyword(state.definitions, c.cardId, "chase"));
}

export function playerHasWingUnitInField(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  const zones = [...player.rush, ...player.battle] as const;
  return zones.some((c) => cardHasKeyword(state.definitions, c.cardId, "wing"));
}
