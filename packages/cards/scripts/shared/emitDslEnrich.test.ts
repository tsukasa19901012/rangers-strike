import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, afterEach } from "vitest";
import type { CardDefinition } from "../../src/schema";
import { enrichFromDsl } from "./emitDslEnrich";

describe("enrichFromDsl", () => {
  const root = join(tmpdir(), `emit-dsl-enrich-${process.pid}`);
  const dslDir = join(root, "src/generated/dsl-stubs");

  afterEach(() => {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it("merges rushAdditionalCondition from DSL stub into catalog card", () => {
    mkdirSync(dslDir, { recursive: true });
    const base: CardDefinition = {
      id: "RS-092",
      name: "冥王ジルフィーザ",
      type: "unit",
      category: "DA",
      rarity: "SR",
      expansion: "legend2",
      powerCost: "9+",
    };
    writeFileSync(
      join(dslDir, "RS-092.dsl.json"),
      JSON.stringify({
        rushAdditionalCondition: {
          conditionId: "send_s_unit_to_discard",
          text: "自軍Sユニットを3体捨札にする",
          unitCount: 3,
        },
      }),
    );

    const enriched = enrichFromDsl(root, base);
    expect(enriched.rushAdditionalCondition).toEqual({
      conditionId: "send_s_unit_to_discard",
      text: "自軍Sユニットを3体捨札にする",
      unitCount: 3,
    });
    expect(readFileSync(join(dslDir, "RS-092.dsl.json"), "utf8")).toContain(
      "send_s_unit_to_discard",
    );
  });
});
