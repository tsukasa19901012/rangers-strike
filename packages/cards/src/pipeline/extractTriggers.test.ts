import { describe, expect, it } from "vitest";
import { extractTriggers } from "./extractTriggers";
import type { CardAnalysis, WikiParseResult } from "./types";

describe("extractTriggers RC combo number", () => {
  const analysis: CardAnalysis = { cardType: "unit", grade: "A" };

  it("assigns riding_combo to named segments when wiki CN is RC", () => {
    const parse: WikiParseResult = {
      cardId: "TST-RC",
      cardName: "Test Rider",
      status: { CN: "RC" },
      segments: [
        {
          kind: "named",
          name: "ライダーキック",
          body: "敵軍ユニットを1体選ぶ。",
        },
      ],
      rawText: "",
    };

    const triggers = extractTriggers(parse, analysis);
    expect(triggers[0]?.trigger).toEqual({ type: "riding_combo" });
  });

  it("keeps nc trigger for named segments with numeric CN", () => {
    const parse: WikiParseResult = {
      cardId: "TST-NC",
      cardName: "Test NC",
      status: { CN: "3" },
      segments: [
        {
          kind: "named",
          name: "必殺技",
          body: "BP+1000。",
        },
      ],
      rawText: "",
    };

    const triggers = extractTriggers(parse, analysis);
    expect(triggers[0]?.trigger).toEqual({ type: "nc" });
  });
});
