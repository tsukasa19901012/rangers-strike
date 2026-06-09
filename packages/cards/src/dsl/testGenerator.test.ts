import { describe, it, expect } from "vitest";
import {
  buildTestCasesForCard,
  generateCardTestFile,
  generateRegistrySmokeTest,
} from "./testGenerator";
import { loadCardDocument } from "./loader";
import { createCardRegistryFromCatalog } from "./registry";
import exampleDsl from "./examples/RS-046.dsl.json";

describe("dsl/testGenerator", () => {
  it("builds test cases for DSL card", () => {
    const card = loadCardDocument(exampleDsl);
    const cases = buildTestCasesForCard(card);
    expect(cases.length).toBe(1);
    expect(cases[0]?.trigger).toBe("on_rush");
    expect(cases[0]?.expectedEvents).toContain("rush_completed");
  });

  it("generates vitest file content", () => {
    const card = loadCardDocument(exampleDsl);
    const content = generateCardTestFile(card);
    expect(content).toContain('describe("RS-046');
    expect(content).toContain("vitest");
  });

  it("generates registry smoke test", () => {
    const registry = createCardRegistryFromCatalog();
    const content = generateRegistrySmokeTest(registry);
    expect(content).toContain("CardRegistry smoke");
    expect(content).toContain("validateCardDocument");
  });
});
