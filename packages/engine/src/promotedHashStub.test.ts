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

describe("PR hash stub DSL", () => {
  const docs = loadCardDocs("PR-");

  it("all PR cards have zero catchall grant_keyword stubs", () => {
    expect(dslCatchallCardIds(docs)).toEqual([]);
  });

  it("PR-005 uses rm/pr_fx or stable grant keyword", () => {
    const effect = docs.find((d) => d.id === "PR-005")?.effects?.[0];
    const kw = effect?.effects?.find((p) => p.type === "grant_keyword")?.keyword;
    expect(kw).toMatch(/^pr_fx::PR-005::/);
  });
});

describe("PK hash stub DSL", () => {
  const docs = loadCardDocs("PK-");

  it("all PK cards have zero catchall grant_keyword stubs", () => {
    expect(dslCatchallCardIds(docs)).toEqual([]);
  });
});

describe("PM hash stub DSL", () => {
  const docs = loadCardDocs("PM-");

  it("all PM cards have zero catchall grant_keyword stubs", () => {
    expect(dslCatchallCardIds(docs)).toEqual([]);
  });
});

describe("RM hash stub DSL", () => {
  const docs = loadCardDocs("RM-");

  it("all RM cards have zero catchall grant_keyword stubs", () => {
    expect(dslCatchallCardIds(docs)).toEqual([]);
  });

  it("RM-001 rematches to rm_fx exact pattern", () => {
    const text = docs.find((d) => d.id === "RM-001")?.effects?.[0]?.text;
    const rematched = rematchExtractedEffect(text!, { trigger: { type: "operation", timing: "rush" } });
    expect(rematched?.effects[0]).toMatchObject({
      type: "grant_keyword",
      keyword: expect.stringMatching(/^rm_fx::RM-001::/),
    });
  });

  it("RM-052 magune uses stable while_riding keyword", () => {
    const effect = docs.find((d) => d.id === "RM-052")?.effects?.find((e) => e.id === "maguneatachimento");
    expect(effect?.effects?.[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "while_riding_stagger_tank_block_return_held_mecha",
    });
  });
});
