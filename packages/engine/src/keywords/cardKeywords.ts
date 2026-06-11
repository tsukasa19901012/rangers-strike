import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { cardHasDslGrantKeyword } from "../dsl/promotedKeywordBridge";
import { rocketBoosterMatchesCard } from "../rules/rocketBooster";

export type CardKeyword = "wing" | "chase" | "commander" | "register" | "morph" | "resident";

/** カード定義からキーワードを検出（tags / features / keywords / 効果文 / DSL grant_keyword）。 */
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
  const def = definitions[cardId];
  if (!def) return false;
  if (def.type === "commander" && keyword === "commander") return true;
  const labels: Record<CardKeyword, string[]> = {
    wing: ["wing", "ウイング"],
    chase: ["chase", "チェイス"],
    commander: ["commander", "コマンダー"],
    register: ["register", "レジスト", "resist"],
    morph: ["morph", "モーフ"],
    resident: ["resident", "常駐"],
  };
  const needles = labels[keyword];
  const explicitKeywords = (def as CardDefinition & { keywords?: string[] }).keywords;
  if (explicitKeywords?.some((k) => needles.includes(k.toLowerCase()))) return true;
  if (def.tags?.some((t) => needles.includes(t.toLowerCase()))) return true;
  if (def.features?.some((f) => needles.includes(f))) return true;
  if (def.text && needles.some((n) => def.text!.includes(n))) return true;
  return false;
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
