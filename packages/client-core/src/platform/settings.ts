// Typed settings and match records on top of any KeyValueStore.
import type { KeyValueStore } from "./interfaces";

export type Settings = {
  humanDeck: string;
  cpuDeck: string;
  cpuLevel: number;
};

export type MatchRecord = {
  humanDeck: string;
  cpuDeck: string;
  winner: string | null;
  turns: number;
  cpuMoves: number;
  avgThinkMs: number;
};

/** A deck made in the deck builder. Deck ids for settings are `custom:<id>`. */
export type CustomDeck = {
  id: string;
  name: string;
  entries: { cardId: string; count: number }[];
  updatedAt: number;
};

export const CUSTOM_DECK_PREFIX = "custom:";

const SETTINGS_KEY = "rs.settings.v1";
const DECKS_KEY = "rs.decks.v1";
const RECORDS_KEY = "rs.records.v1";

export class SettingsStore {
  constructor(private readonly store: KeyValueStore) {}

  get persistent(): boolean {
    return this.store.persistent;
  }

  load(defaults: Settings): Settings {
    const raw = this.store.get(SETTINGS_KEY);
    if (!raw) return { ...defaults };
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        humanDeck: typeof parsed.humanDeck === "string" ? parsed.humanDeck : defaults.humanDeck,
        cpuDeck: typeof parsed.cpuDeck === "string" ? parsed.cpuDeck : defaults.cpuDeck,
        cpuLevel: typeof parsed.cpuLevel === "number" ? parsed.cpuLevel : defaults.cpuLevel,
      };
    } catch {
      return { ...defaults };
    }
  }

  save(settings: Settings): void {
    this.store.set(SETTINGS_KEY, JSON.stringify(settings));
  }

  records(): MatchRecord[] {
    try {
      const parsed = JSON.parse(this.store.get(RECORDS_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as MatchRecord[]) : [];
    } catch {
      return [];
    }
  }

  addRecord(record: MatchRecord, keep = 20): void {
    const next = [record, ...this.records()].slice(0, keep);
    this.store.set(RECORDS_KEY, JSON.stringify(next));
  }

  /** Saved custom decks, newest first. */
  customDecks(): CustomDeck[] {
    try {
      const parsed = JSON.parse(this.store.get(DECKS_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as CustomDeck[]).sort((a, b) => b.updatedAt - a.updatedAt) : [];
    } catch {
      return [];
    }
  }

  saveCustomDeck(deck: CustomDeck): void {
    const next = [deck, ...this.customDecks().filter((d) => d.id !== deck.id)];
    this.store.set(DECKS_KEY, JSON.stringify(next));
  }

  deleteCustomDeck(id: string): void {
    this.store.set(DECKS_KEY, JSON.stringify(this.customDecks().filter((d) => d.id !== id)));
  }
}
