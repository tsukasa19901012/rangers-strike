import type { Category } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, PlayerState } from "../types/game";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { effectiveCommandCategories, getDefinition, isUnit } from "../core/catalog";

export type CallLeadKind = "call" | "lead";

const CALL_LEAD_KEYWORD = /^(call|lead)_(MA|ET|DA|WB|OT)$/;

export function parseCallLeadKeyword(
  keyword: string,
): { kind: CallLeadKind; category: Category } | null {
  const match = keyword.match(CALL_LEAD_KEYWORD);
  if (!match) return null;
  return { kind: match[1] as CallLeadKind, category: match[2] as Category };
}

export function unitHasCallLeadKeyword(
  cardId: string,
  kind: CallLeadKind,
  category: Category,
): boolean {
  return cardHasGrantKeyword(cardId, `${kind}_${category}`);
}

function fieldZonesForCallLead(kind: CallLeadKind): Array<"rush" | "battle"> {
  return kind === "call" ? ["rush", "battle"] : ["rush", "battle"];
}

export function collectCallLeadFieldUnits(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  kind: CallLeadKind,
  categories: Category[],
): CardInstance[] {
  const results: CardInstance[] = [];
  for (const zone of fieldZonesForCallLead(kind)) {
    for (const card of player[zone]) {
      if (card.commandHeld || card.mothershipHold) continue;
      const def = getDefinition(definitions, card.cardId);
      if (def && !isUnit(def)) continue;
      const matches = categories.some((cat) => unitHasCallLeadKeyword(card.cardId, kind, cat));
      if (matches) results.push(card);
    }
  }
  return results;
}

export function heldCallLeadMatchesCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  kind: CallLeadKind,
  categories: Category[],
): boolean {
  for (const zone of fieldZonesForCallLead(kind)) {
    for (const card of player[zone]) {
      if (!card.commandHeld || card.mothershipHold) continue;
      const def = getDefinition(definitions, card.cardId);
      if (def && !isUnit(def)) continue;
      if (categories.some((cat) => unitHasCallLeadKeyword(card.cardId, kind, cat))) {
        return true;
      }
    }
  }
  return false;
}

export function holdPaymentSource(
  player: PlayerState,
  instanceId: string,
): PlayerState {
  const commandIndex = player.command.findIndex((c) => c.instanceId === instanceId);
  if (commandIndex >= 0) {
    const command = [...player.command];
    command[commandIndex] = {
      ...command[commandIndex]!,
      commandHeld: true,
      mothershipHold: false,
    };
    return { ...player, command };
  }

  for (const zone of ["rush", "battle"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) {
      const cards = [...player[zone]];
      cards[index] = { ...cards[index]!, commandHeld: true, mothershipHold: false };
      return { ...player, [zone]: cards };
    }
  }

  return player;
}

export function playerHasHeldLead(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories?: Category[],
): boolean {
  const cats = categories ?? (["MA", "ET", "DA", "WB", "OT"] as Category[]);
  return heldCallLeadMatchesCategories(player, definitions, "lead", cats);
}

export function paymentSourceMatchesCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  instanceId: string,
  categories: Category[],
  kind: CallLeadKind,
): boolean {
  const cmd = player.command.find((c) => c.instanceId === instanceId);
  if (cmd) {
    const cmdCats = effectiveCommandCategories(player, definitions, cmd.cardId);
    return categories.some((cat) => cmdCats.includes(cat));
  }

  for (const zone of fieldZonesForCallLead(kind)) {
    const card = player[zone].find((c) => c.instanceId === instanceId);
    if (!card) continue;
    return categories.some((cat) => unitHasCallLeadKeyword(card.cardId, kind, cat));
  }

  return false;
}
