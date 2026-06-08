import { describe, expect, it } from "vitest";
import {
  GLOSSARY_FRAMEWORK_ONLY,
  GLOSSARY_NOT_IMPLEMENTED,
} from "./glossaryImplementation";
import {
  listUnimplementedOperations,
  listImplementedOperations,
} from "./operationCatalog";

describe("glossary implementation status (#9 verification)", () => {
  it("documents intentionally unimplemented glossary terms", () => {
    expect(GLOSSARY_NOT_IMPLEMENTED.length).toBeGreaterThanOrEqual(2);
    expect(GLOSSARY_NOT_IMPLEMENTED.some((e) => e.term.includes("タッグ"))).toBe(
      true,
    );
    expect(GLOSSARY_NOT_IMPLEMENTED.some((e) => e.term.includes("バウンス"))).toBe(
      false,
    );
  });

  it("documents framework-only glossary modules", () => {
    const modules = GLOSSARY_FRAMEWORK_ONLY.map((e) => e.module);
    expect(modules).toContain("commander");
    expect(modules).toContain("exile");
    expect(modules).toContain("reanimate");
    expect(modules).toContain("bounce");
  });

  it("confirms Legend1 operations remain fully implemented", () => {
    expect(listUnimplementedOperations()).toEqual([]);
    expect(listImplementedOperations().length).toBeGreaterThanOrEqual(30);
  });
});
