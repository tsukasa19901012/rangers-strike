import { describe, expect, it } from "vitest";
import { buildDeckSharePayload, formatDeckText, parseDeckSharePayload, parseDeckText, sameDeckEntries } from "./deckShare";

const known = new Set(["RS-057", "RS-148", "RS-421", "RS-689", "XG3-061"]);
const names: Record<string, string> = { "RS-057": "マジレッド", "RS-148": "オーレッド", "RS-689": "レッドホーク（2nd）" };

describe("deck share", () => {
  it("round-trips the payload", () => {
    const entries = [
      { cardId: "RS-057", count: 3 },
      { cardId: "XG3-061", count: 1 },
    ];
    const payload = buildDeckSharePayload("  赤の  戦士 ", entries);
    expect(payload).toEqual({ v: 1, name: "赤の 戦士", cards: "RS-057*3,XG3-061" });
    expect(parseDeckSharePayload(JSON.parse(JSON.stringify(payload)), known)).toEqual({ name: "赤の 戦士", entries, unreadable: [] });
  });

  it("drops unknown ids from a payload and refuses one with no cards", () => {
    expect(parseDeckSharePayload({ v: 1, name: "x", cards: "RS-057*2,ZZ-999,<script>" }, known)).toEqual({
      name: "x",
      entries: [{ cardId: "RS-057", count: 2 }],
      unreadable: ["ZZ-999", "<script>"],
    });
    expect(parseDeckSharePayload({ v: 1, name: "x", cards: "ZZ-999" }, known)).toBeNull();
    expect(parseDeckSharePayload({ v: 2, cards: "RS-057" }, known)).toBeNull();
    expect(parseDeckSharePayload("RS-057", known)).toBeNull();
  });

  it("writes the text list and reads it back", () => {
    const entries = [
      { cardId: "RS-057", count: 3 },
      { cardId: "RS-689", count: 1 },
    ];
    const text = formatDeckText("赤の戦士デッキ", entries, (id) => names[id]);
    expect(text).toBe("# 赤の戦士デッキ\n3 RS-057 マジレッド\n1 RS-689 レッドホーク（2nd）\n# 計4枚");
    expect(parseDeckText(text, known)).toEqual({ name: "赤の戦士デッキ", entries, unreadable: [] });
  });

  it("reads the forms the paste box describes", () => {
    const text = [
      "# 赤の戦士デッキ",
      "3 RS-057 マジレッド",
      "2 RS-148",
      "RS-421 ×3",
      "ｒｓ－４２１　ｘ１",
      "XG3-061 2枚",
      "# メモ",
      "スーパーダイナモ ×1",
      "RS-999 未知",
      "",
    ].join("\n");
    const deck = parseDeckText(text, known);
    expect(deck.name).toBe("赤の戦士デッキ");
    expect(deck.entries).toEqual([
      { cardId: "RS-057", count: 3 },
      { cardId: "RS-148", count: 2 },
      { cardId: "RS-421", count: 4 },
      { cardId: "XG3-061", count: 2 },
    ]);
    expect(deck.unreadable).toEqual(["スーパーダイナモ ×1", "RS-999 未知"]);
  });

  it("keeps digits in a card name out of the count", () => {
    expect(parseDeckText("RS-689 レッドホーク（2nd）", known).entries).toEqual([{ cardId: "RS-689", count: 1 }]);
    expect(parseDeckText("# 計40枚\n1 RS-057", known).name).toBe("");
    expect(parseDeckText("# 青の九の翼デッキ（ウイングデッキ）\n1 RS-057", known).name).toBe("青の九の翼デッキ（ウイングデッキ）");
  });

  it("compares decks regardless of order", () => {
    expect(sameDeckEntries([{ cardId: "A", count: 1 }, { cardId: "B", count: 2 }], [{ cardId: "B", count: 2 }, { cardId: "A", count: 1 }])).toBe(true);
    expect(sameDeckEntries([{ cardId: "A", count: 1 }], [{ cardId: "A", count: 2 }])).toBe(false);
  });
});
