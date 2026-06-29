import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  rematchExtractedEffect,
  splitChoiceBranches,
} from "@rangers-strike/cards/pipeline/extractEffects";
import { isCatchallGrantKeyword } from "./dsl/hashGrantKeywordStub";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadBkText(id: string): string {
  const doc = JSON.parse(
    readFileSync(join(repoRoot, `packages/cards/src/generated/dsl-stubs/${id}.dsl.json`), "utf8"),
  );
  return doc.effects[0].text as string;
}

function rematchBk(id: string) {
  const text = loadBkText(id);
  return rematchExtractedEffect(text, { trigger: { type: "operation", timing: "rush" } });
}

describe("BK hash stub rematch", () => {
  for (const id of ["BK-009", "BK-010", "BK-013", "BK-015", "BK-017", "BK-019"]) {
    it(`${id} rematches without catchall stub`, () => {
      const rematched = rematchBk(id);
      expect(rematched).not.toBeNull();
      expect(
        rematched!.effects.some(
          (p) => p.type === "grant_keyword" && isCatchallGrantKeyword(p.keyword),
        ),
      ).toBe(false);
    });
  }

  it("BK-009 uses pick_effect_branch with two structured branches", () => {
    const text = loadBkText("BK-009");
    const branches = splitChoiceBranches(text);
    expect(branches?.length).toBe(2);
    const rematched = rematchBk("BK-009");
    expect(rematched?.matchedPattern).toBe("pick_one_effect_branch");
    expect(rematched?.effects[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "pick_effect_branch",
    });
  });
});
