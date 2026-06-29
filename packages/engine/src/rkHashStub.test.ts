import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rematchExtractedEffect } from "@rangers-strike/cards/pipeline/extractEffects";
import { isCatchallGrantKeyword } from "./dsl/hashGrantKeywordStub";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadRkText(id: string): string {
  const doc = JSON.parse(
    readFileSync(join(repoRoot, `packages/cards/src/generated/dsl-stubs/${id}.dsl.json`), "utf8"),
  );
  const effect = doc.effects.find((e: { text?: string }) => e.text) ?? doc.effects[0];
  return effect.text as string;
}

function rematchRk(id: string) {
  const text = loadRkText(id);
  return rematchExtractedEffect(text, { trigger: { type: "operation", timing: "rush" } });
}

function expectNoCatchall(id: string) {
  const rematched = rematchRk(id);
  expect(rematched).not.toBeNull();
  expect(
    rematched!.effects.some(
      (p) => p.type === "grant_keyword" && isCatchallGrantKeyword(p.keyword),
    ),
  ).toBe(false);
}

describe("RK hash stub rematch", () => {
  for (const id of [
    "RK-067",
    "RK-083",
    "RK-084",
    "RK-092",
    "RK-100",
    "RK-106",
    "RK-117",
    "RK-127",
    "RK-297",
  ]) {
    it(`${id} rematches without catchall stub`, () => {
      expectNoCatchall(id);
    });
  }

  it("RK-083 rematches to mirror_rider_destroy_enemy_s_by_power", () => {
    const rematched = rematchRk("RK-083");
    expect(rematched?.matchedPattern).toBe("rk_mirror_rider_destroy_enemy_s_by_power");
    expect(rematched?.effects[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "mirror_rider_destroy_enemy_s_by_power",
    });
  });
});
