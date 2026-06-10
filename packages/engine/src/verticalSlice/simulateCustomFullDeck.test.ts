import { describe, expect, it } from "vitest";
import {
  expandDeck,
  fullPlayableCatalog,
  getStarterDeck,
  type DeckDefinition,
} from "@rangers-strike/cards";
import { createGameForDecks } from "../core/createGame";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

const GAME_COUNT = 10;
const MAX_STEPS = 15_000;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** abarenoh L1 with RS-014 swapped for promoted BK-001 (AC-07 smoke deck). */
function buildCustomPromotedDeckDefinition(): DeckDefinition {
  return {
    id: "g5-custom-promoted",
    name: "G5 custom promoted",
    entries: getStarterDeck("abarenoh").entries.map((entry) =>
      entry.cardId === "RS-014"
        ? { cardId: "BK-001", count: 1 }
        : { ...entry },
    ),
  };
}

describe("vertical slice — custom full promoted deck (AC-07)", () => {
  it(`runs ${GAME_COUNT} CPU vs CPU games with a custom 40-card deck containing promoted cards`, () => {
    const deck = expandDeck(
      buildCustomPromotedDeckDefinition(),
      fullPlayableCatalog,
    );
    expect(deck).toHaveLength(40);
    expect(deck.some((card) => card.id === "BK-001")).toBe(true);

    let winner = 0;
    let applyFailed = 0;

    for (let seed = 1; seed <= GAME_COUNT; seed += 1) {
      const rng = mulberry32(seed);
      const result = playStarterMatchUntilEnd(
        createGameForDecks(deck, deck, {
          definitionScope: "full",
          rng,
        }),
        { maxSteps: MAX_STEPS, rng },
      );

      if (result.reason === "apply_failed") {
        applyFailed += 1;
      } else if (result.reason === "winner") {
        winner += 1;
      }
    }

    expect(applyFailed).toBe(0);
    expect(winner).toBe(GAME_COUNT);
  });
});
