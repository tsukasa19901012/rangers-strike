import { describe, expect, it } from "vitest";
import { extractWikiSetLabel, normalizeWikiSetLabel } from "./pipeline/parseWiki";
import { getWikiSetLabel, getWikiSetLabels } from "./wikiSetLabels";

describe("normalizeWikiSetLabel", () => {
  it("takes text before full-width space", () => {
    expect(normalizeWikiSetLabel("英雄の再誕　自販：パック")).toBe("英雄の再誕");
    expect(normalizeWikiSetLabel("七忍の炎陣　スターター専用")).toBe("七忍の炎陣");
  });

  it("returns trimmed single token", () => {
    expect(normalizeWikiSetLabel("英雄の再誕")).toBe("英雄の再誕");
  });
});

describe("extractWikiSetLabel", () => {
  it("parses 収録 line from wiki markdown", () => {
    const content = "CARD_ID: RS-001\n\n収録: 英雄の再誕\n";
    expect(extractWikiSetLabel(content)).toBe("英雄の再誕");
  });
});

describe("getWikiSetLabel", () => {
  it("resolves core and promoted cards", () => {
    expect(getWikiSetLabel("RS-001")).toBe("英雄の再誕");
    expect(getWikiSetLabel("BK-001")).toBeTruthy();
  });

  it("exposes sorted unique set names", () => {
    const sets = getWikiSetLabels();
    expect(sets.length).toBeGreaterThan(50);
    expect([...sets]).toEqual([...sets].sort((a, b) => a.localeCompare(b, "ja")));
  });
});
