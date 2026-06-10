import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateCardDocument } from "../dsl/validator";
import {
  EXAMPLE_CARD_IDS,
  runCardPipeline,
  DEFAULT_OUTPUT_DIR,
} from "./runPipeline";
import { parseWikiMarkdown, splitEffectSegments } from "./parseWiki";
import { analyzeCard } from "./analyzeCard";
import { extractTriggers } from "./extractTriggers";
import { extractEffects } from "./extractEffects";
import type { CardDocument } from "../dsl/types";

describe("card production pipeline", () => {
  it("parses RS-059 wiki segments", () => {
    const parse = parseWikiMarkdown("RS-059");
    expect(parse.effectTexts.length).toBeGreaterThan(0);
    expect(parse.segments.some((s) => s.kind === "named" && s.name === "未来予知")).toBe(true);
  });

  it("runs full pipeline for example cards", () => {
    for (const id of EXAMPLE_CARD_IDS) {
      const report = runCardPipeline(id, { writeFiles: false });
      expect(report.completedSteps).toEqual([
        "parse",
        "analyze",
        "extract_triggers",
        "extract_effects",
        "generate_dsl",
        "validate",
        "generate_tests",
      ]);
      expect(report.validation.ok, `${id}: ${report.validation.issues.map((i) => i.message).join(", ")}`).toBe(true);
      expect(report.card.effects?.length).toBeGreaterThan(0);
    }
  });

  it("RS-020 generates place_in_power DSL", () => {
    const parse = parseWikiMarkdown("RS-020");
    const analysis = analyzeCard(parse);
    const triggers = extractTriggers(parse, analysis);
    const effects = extractEffects(parse, analysis, triggers);
    expect(effects[0]?.matchedPattern).toBe("place_in_power");
    expect(effects[0]?.effects[0]).toMatchObject({ type: "move", to: "power" });
  });

  it("RS-054 extracts destroy + auto battle + SP1", () => {
    const parse = parseWikiMarkdown("RS-054");
    const analysis = analyzeCard(parse);
    const triggers = extractTriggers(parse, analysis);
    const effects = extractEffects(parse, analysis, triggers);
    const patterns = effects.map((e) => e.matchedPattern);
    expect(patterns).toContain("destroy_self_damage");
    expect(patterns).toContain("auto_battle_entry");
    expect(patterns.some((p) => p === "grant_sp" || p === "grant_sp_inline" || p === "grant_sp_in_text")).toBe(
      true,
    );
  });

  it("example card.json files on disk validate", () => {
    for (const id of EXAMPLE_CARD_IDS) {
      const path = join(DEFAULT_OUTPUT_DIR, id, "card.json");
      if (!existsSync(path)) {
        runCardPipeline(id);
      }
      const card = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
      expect(validateCardDocument(card).ok).toBe(true);
    }
  });
});

describe("splitEffectSegments", () => {
  it("splits named and note segments", () => {
    const segs = splitEffectSegments(
      "※これは「マジマーメイド」としてつかえる。【未来予知】自分は1枚ドローする。",
    );
    expect(segs).toHaveLength(2);
    expect(segs[0].kind).toBe("note");
    expect(segs[1].name).toBe("未来予知");
  });
});
