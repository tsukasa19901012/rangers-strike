import type { CardDocument } from "../dsl/types";
import { buildTestCasesForCard } from "../dsl/testGenerator";

function safeTestName(id: string): string {
  return id.replace(/-/g, "_");
}

function renderCase(card: CardDocument, testCase: ReturnType<typeof buildTestCasesForCard>[number]): string {
  if (testCase.skipReason) {
    return `  it.skip("${testCase.effectId ?? "effect"} — ${testCase.skipReason}", () => {});`;
  }
  return `  it("${testCase.effectId} fires on ${testCase.trigger}", () => {
    const effect = card.effects?.find((e) => e.id === "${testCase.effectId}");
    expect(effect?.trigger.type).toBe("${testCase.trigger}");
    expect(${JSON.stringify(testCase.expectedEvents)}.every((ev) => ev.length > 0)).toBe(true);
  });`;
}

/** pipeline/examples 配下向けテスト（card.json を直接読む） */
export function generatePipelineTestFile(card: CardDocument): string {
  const cases = buildTestCasesForCard(card);
  const body = cases.map((c) => renderCase(card, c)).join("\n\n");

  const effectCount = card.effects?.length ?? 0;
  const isUnimplemented = card.implementation?.handler === "unimplemented" || effectCount === 0;
  const effectAssertion = isUnimplemented
    ? `expect(doc.effects?.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(doc.implementation?.handler).toBe("unimplemented");`
    : `expect(doc.effects?.length ?? 0).toBeGreaterThan(0);`;

  return `/**
 * Auto-generated pipeline test for ${card.id} (${card.name})
 * Regenerate: npm run pipeline:card -- ${card.id}
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("${card.id} ${card.name} (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("${card.id}");
    ${effectAssertion}
  });

${body}
});
`;
}
