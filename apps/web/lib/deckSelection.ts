import {
  buildStarterDeck,
  type CardDefinition,
  type StarterDeckId,
} from "@rangers-strike/cards";
import { buildCardDefinitions, getCustomDeck } from "./deckBuilder";
import { STARTER_OPTIONS, type StarterId } from "./labels";

export type DeckSelection =
  | { kind: "starter"; id: StarterId }
  | { kind: "custom"; id: string };

export function encodeDeckSelection(selection: DeckSelection): string {
  return `${selection.kind}:${selection.id}`;
}

export function decodeDeckSelection(value: string): DeckSelection | null {
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind === "starter" && STARTER_OPTIONS.some((option) => option.id === id)) {
    return { kind: "starter", id: id as StarterId };
  }
  if (kind === "custom") {
    return { kind: "custom", id };
  }
  return null;
}

export function resolveDeckCards(selection: DeckSelection): CardDefinition[] {
  if (selection.kind === "starter") {
    return buildStarterDeck(selection.id as StarterDeckId);
  }
  const deck = getCustomDeck(selection.id);
  if (!deck) {
    throw new Error(`Custom deck not found: ${selection.id}`);
  }
  return buildCardDefinitions(deck.entries);
}

export function deckSelectionLabel(selection: DeckSelection): string {
  if (selection.kind === "starter") {
    return STARTER_OPTIONS.find((option) => option.id === selection.id)?.label ?? selection.id;
  }
  return getCustomDeck(selection.id)?.name ?? "（削除されたデッキ）";
}
