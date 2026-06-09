import { describe, it, expect } from "vitest";
import {
  cardDefinitionToDocument,
  loadAllCardDocuments,
  loadCardDocument,
  isFullyDslEffect,
} from "./loader";
import { getCardById } from "../catalog";
import exampleDsl from "./examples/RS-046.dsl.json";

describe("dsl/loader", () => {
  it("loads example DSL file", () => {
    const doc = loadCardDocument(exampleDsl);
    expect(doc.id).toBe("RS-046");
    expect(doc.implementation?.handler).toBe("interpreter");
  });

  it("converts catalog card with unit effects", () => {
    const def = getCardById("RS-046");
    expect(def).toBeDefined();
    const doc = cardDefinitionToDocument(def!);
    expect(doc.effects?.some((e) => e.id === "armor_attack")).toBe(true);
    expect(doc.unnamedRules).toBeDefined();
  });

  it("converts operation card with effectId", () => {
    const def = getCardById("RS-001");
    expect(def).toBeDefined();
    const doc = cardDefinitionToDocument(def!);
    expect(doc.effectId).toBe("goren_storm");
    expect(doc.effects?.some((e) => e.id === "goren_storm")).toBe(true);
  });

  it("loadAllCardDocuments returns full catalog", () => {
    const docs = loadAllCardDocuments();
    expect(docs.length).toBeGreaterThan(100);
    expect(docs.every((d) => d.id && d.name)).toBe(true);
  });

  it("detects fully DSL effects", () => {
    const doc = loadCardDocument(exampleDsl);
    expect(doc.effects?.every(isFullyDslEffect)).toBe(true);
  });
});
