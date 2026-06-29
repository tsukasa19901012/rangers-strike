import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rematchExtractedEffect } from "@rangers-strike/cards/pipeline/extractEffects";
import { isCatchallGrantKeyword } from "./dsl/hashGrantKeywordStub";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const dslDir = join(repoRoot, "packages/cards/src/generated/dsl-stubs");

function loadCardDocs(prefix: string) {
  return readdirSync(dslDir)
    .filter((f) => f.startsWith(prefix))
    .map((f) => JSON.parse(readFileSync(join(dslDir, f), "utf8")) as {
      id: string;
      effects?: Array<{
        id: string;
        text?: string;
        trigger?: unknown;
        effects?: Array<{ type: string; keyword?: string }>;
      }>;
    });
}

function dslCatchallCardIds(docs: ReturnType<typeof loadCardDocs>): string[] {
  const failures = new Set<string>();
  for (const doc of docs) {
    for (const effect of doc.effects ?? []) {
      const kw = effect.effects?.find((p) => p.type === "grant_keyword")?.keyword;
      if (kw && isCatchallGrantKeyword(kw)) failures.add(doc.id);
    }
  }
  return [...failures].sort();
}

describe("BK hash stub DSL", () => {
  const docs = loadCardDocs("BK-");

  it(`all BK cards have zero catchall grant_keyword stubs`, () => {
    expect(dslCatchallCardIds(docs)).toEqual([]);
  });

  it("BK-009 uses pick_effect_branch", () => {
    const text = docs.find((d) => d.id === "BK-009")?.effects?.[0]?.text;
    const rematched = rematchExtractedEffect(text!, { trigger: { type: "operation", timing: "rush" } });
    expect(rematched?.matchedPattern).toBe("pick_one_effect_branch");
    expect(rematched?.effects[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "pick_effect_branch",
    });
  });
});

describe("RK hash stub DSL", () => {
  const docs = loadCardDocs("RK-");

  it(`all RK cards have zero catchall grant_keyword stubs`, () => {
    expect(dslCatchallCardIds(docs)).toEqual([]);
  });

  it("RK-083 rematches to mirror_rider_destroy_enemy_s_by_power", () => {
    const text = docs.find((d) => d.id === "RK-083")?.effects?.[0]?.text;
    const rematched = rematchExtractedEffect(text!, { trigger: { type: "operation", timing: "rush" } });
    expect(rematched?.effects[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "mirror_rider_destroy_enemy_s_by_power",
    });
  });

  it("RK-326 uses effect_card delegate keyword", () => {
    const effect = docs.find((d) => d.id === "RK-326")?.effects?.[0];
    expect(effect?.effects?.[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "effect_card::RK-326::garurufuesuru",
    });
  });
});
