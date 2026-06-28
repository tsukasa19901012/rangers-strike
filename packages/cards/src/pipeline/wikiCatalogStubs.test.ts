import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stubsPath = join(__dirname, "../../pipeline/data/wiki-catalog-stubs.json");

type StubsFile = {
  summary: {
    wikiTotal: number;
    catalogRegistered: number;
    stubCount: number;
  };
};

describe("wiki catalog stubs", () => {
  it("covers all wiki cards beyond the playable catalog", () => {
    let data: StubsFile;
    try {
      data = JSON.parse(readFileSync(stubsPath, "utf8")) as StubsFile;
    } catch {
      expect.fail("run npm run generate-wiki-stubs first");
      return;
    }

    expect(data.summary.wikiTotal).toBeGreaterThanOrEqual(1849);
    expect(data.summary.catalogRegistered).toBe(691);
    expect(data.summary.stubCount).toBe(data.summary.wikiTotal - data.summary.catalogRegistered);
  });
});
