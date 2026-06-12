import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import {
  assertWikiCardCatalog,
  assertWikiCardComplete,
} from "./wikiCompleteTest";
import {
  WIKI_COMPLETE_SPEC_COUNT,
  WIKI_COMPLETE_SPECS,
  specsByPrefix,
} from "./wikiTestSpecs/generated";
import { WIKI_RULE_COMPLETE_SPECS } from "./wikiTestSpecs/ruleSpecs";

describe("Wiki complete — all full-playable cards", () => {
  it("has a spec for every catalog card", () => {
    expect(WIKI_COMPLETE_SPEC_COUNT).toBe(fullPlayableCatalog.cards.length);
  });

  it.each(WIKI_COMPLETE_SPECS.map((s) => [s.cardId, s] as const))(
    "%s matches wiki (complete version)",
    (_id, spec) => {
      assertWikiCardComplete(spec);
    },
  );
});

describe("Wiki complete — catalog-only (fast gate)", () => {
  it.each(WIKI_COMPLETE_SPECS.map((s) => [s.cardId, s] as const))(
    "%s catalog fields match wiki",
    (_id, spec) => {
      assertWikiCardCatalog(spec);
    },
  );
});

describe("Wiki complete — by prefix", () => {
  const prefixes = [...new Set(WIKI_COMPLETE_SPECS.map((s) => s.cardId.split("-")[0]))];

  it.each(prefixes.map((p) => [p, specsByPrefix(p).length] as const))(
    "%s: spec count matches catalog",
    (prefix, count) => {
      const catalogCount = fullPlayableCatalog.cards.filter((c) =>
        c.id.startsWith(`${prefix}-`),
      ).length;
      expect(count).toBe(catalogCount);
    },
  );
});

describe("Wiki complete — rule spec registry", () => {
  it("covers core rule domains", () => {
    expect(WIKI_RULE_COMPLETE_SPECS.length).toBeGreaterThanOrEqual(25);
    const ids = WIKI_RULE_COMPLETE_SPECS.map((s) => s.ruleId);
    expect(ids).toContain("RULE-CORE-01");
    expect(ids).toContain("RULE-BATTLE-03");
    expect(ids).toContain("RULE-KW-04");
  });

  it.each(WIKI_RULE_COMPLETE_SPECS.map((s) => [s.ruleId, s] as const))(
    "%s has wiki ref and assertions",
    (_id, spec) => {
      expect(spec.wikiRef.startsWith("docs/wiki/")).toBe(true);
      expect(spec.assertions.length).toBeGreaterThan(0);
    },
  );
});

describe("Wiki complete — representative smoke", () => {
  const representatives = [
    "RS-001",
    "RS-006",
    "RS-050",
    "RK-001",
    "RK-021",
    "BK-001",
    "XP-001",
  ];

  it.each(representatives.map((id) => [id] as const))(
    "%s passes full complete assertions",
    (cardId) => {
      const spec = WIKI_COMPLETE_SPECS.find((s) => s.cardId === cardId);
      expect(spec).toBeDefined();
      assertWikiCardComplete(spec!);
    },
  );
});
