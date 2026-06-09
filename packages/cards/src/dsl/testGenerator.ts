import type { CardDocument, EffectDefinition, EffectTrigger } from "./types";
import type { CardRegistry } from "./registry";

/** trigger → 期待するゲームイベント（game-events-catalog 準拠） */
const TRIGGER_EVENTS: Record<string, string[]> = {
  nc: ["battle_entered", "nc_triggered", "effect_triggered"],
  nc_or_combo_from: ["battle_entered", "nc_triggered", "effect_triggered"],
  enter_battle: ["battle_entered", "effect_triggered"],
  on_rush: ["rush_completed", "effect_triggered"],
  on_attack: ["attack_declared", "effect_triggered"],
  on_strike: ["strike_declared", "effect_triggered"],
  on_destroy: ["unit_destroyed", "effect_triggered"],
  on_leave: ["leave_completed", "effect_triggered"],
  on_turn_end: ["turn_end_effects_started", "effect_triggered"],
  on_damage: ["player_damaged", "effect_triggered"],
  joint_combo_l: ["battle_entered", "joint_combo_l_triggered"],
  joint_combo_r: ["battle_entered", "joint_combo_r_triggered"],
  riding_combo: ["battle_entered", "riding_combo_triggered"],
  while_in_field: ["modifier_applied"],
  operation: ["operation_played", "operation_resolved"],
  conditional: ["effect_choice_requested"],
};

/** trigger → テスト用の推奨アクション */
const TRIGGER_ACTIONS: Record<string, string[]> = {
  nc: ["move_to_battle"],
  nc_or_combo_from: ["move_to_battle"],
  enter_battle: ["move_to_battle"],
  on_rush: ["rush"],
  on_attack: ["battle"],
  on_strike: ["strike"],
  on_destroy: ["battle"],
  on_leave: ["battle"],
  on_turn_end: ["end_phase"],
  on_damage: ["strike"],
  joint_combo_l: ["move_to_battle"],
  joint_combo_r: ["move_to_battle"],
  riding_combo: ["move_to_battle"],
  while_in_field: [],
  operation: ["play_operation"],
  conditional: ["move_to_battle"],
};

function safeTestName(id: string): string {
  return id.replace(/-/g, "_");
}

function triggerKey(trigger: EffectTrigger): string {
  return trigger.type;
}

export type GeneratedTestCase = {
  name: string;
  cardId: string;
  effectId?: string;
  trigger: string;
  expectedEvents: string[];
  suggestedActions: string[];
  skipReason?: string;
};

export function buildTestCaseForEffect(
  card: CardDocument,
  effect: EffectDefinition,
): GeneratedTestCase {
  const key = triggerKey(effect.trigger);
  const handler = card.implementation?.handler ?? "unimplemented";
  const usesFallback = effect.effects.every((p) => p.type === "fallback_handler");

  let skipReason: string | undefined;
  if (handler === "unimplemented") {
    skipReason = "card has no implementation";
  } else if (usesFallback) {
    skipReason = "effect uses fallback_handler — engine test required";
  }

  return {
    name: `${card.id}_${effect.id}`,
    cardId: card.id,
    effectId: effect.id,
    trigger: key,
    expectedEvents: TRIGGER_EVENTS[key] ?? ["effect_triggered"],
    suggestedActions: TRIGGER_ACTIONS[key] ?? [],
    skipReason,
  };
}

export function buildTestCasesForCard(card: CardDocument): GeneratedTestCase[] {
  if (!card.effects?.length) {
    return [{
      name: `${card.id}_no_effects`,
      cardId: card.id,
      trigger: "none",
      expectedEvents: [],
      suggestedActions: [],
      skipReason: "no effects defined",
    }];
  }
  return card.effects.map((e) => buildTestCaseForEffect(card, e));
}

function renderTestCase(testCase: GeneratedTestCase): string {
  const lines: string[] = [];
  const fn = `test_${safeTestName(testCase.name)}`;

  if (testCase.skipReason) {
    lines.push(`  it.skip("${testCase.cardId} ${testCase.effectId ?? ""} — ${testCase.skipReason}", () => {`);
    lines.push(`    // trigger: ${testCase.trigger}`);
    lines.push(`    // suggested: ${testCase.suggestedActions.join(", ") || "—"}`);
    lines.push(`    // expected events: ${testCase.expectedEvents.join(" → ")}`);
    lines.push("  });");
    return lines.join("\n");
  }

  lines.push(`  it("${testCase.cardId} ${testCase.effectId} fires on ${testCase.trigger}", () => {`);
  lines.push(`    // TODO: set up game state with ${testCase.cardId} in deck/hand`);
  if (testCase.suggestedActions.length > 0) {
    lines.push(`  // TODO: applyAction({ type: "${testCase.suggestedActions[0]}", ... })`);
  }
  lines.push(`    // TODO: assert events: ${testCase.expectedEvents.join(" → ")}`);
  lines.push(`    expect(true).toBe(true); // placeholder until engine DSL interpreter lands`);
  lines.push("  });");

  return lines.join("\n");
}

/** 単一カードの vitest ファイル内容を生成 */
export function generateCardTestFile(card: CardDocument): string {
  const cases = buildTestCasesForCard(card);
  const varName = safeTestName(card.id);

  const header = `/**
 * Auto-generated card test stub for ${card.id} (${card.name})
 * Source: @rangers-strike/cards/dsl/testGenerator
 * Regenerate: npm run generate-card-tests -- ${card.id}
 */
import { describe, it, expect } from "vitest";
import { getDefaultCardRegistry } from "../dsl/registry";

describe("${card.id} ${card.name}", () => {
  const registry = getDefaultCardRegistry();
  const card = registry.getCard("${card.id}")!;

  it("is registered", () => {
    expect(card).toBeDefined();
    expect(card.id).toBe("${card.id}");
  });
`;

  const body = cases.map(renderTestCase).join("\n\n");
  const footer = `\n});\n`;

  return header + "\n" + body + footer;
}

/** レジストリ全体のスモークテストファイル */
export function generateRegistrySmokeTest(registry: CardRegistry): string {
  const snap = registry.snapshot();

  return `/**
 * Auto-generated registry smoke test
 * Cards: ${snap.cards.size} | Effects: ${snap.effectsById.size}
 */
import { describe, it, expect } from "vitest";
import { createCardRegistryFromCatalog } from "../dsl/registry";
import { validateCardDocument } from "../dsl/validator";

describe("CardRegistry smoke", () => {
  const registry = createCardRegistryFromCatalog();

  it("loads all catalog cards", () => {
    expect(registry.size()).toBeGreaterThan(0);
  });

  it("every card passes validation", () => {
    for (const card of registry.listCards()) {
      const result = validateCardDocument(card);
      expect(result.ok, \`\${card.id}: \${result.issues.map((i) => i.message).join(", ")}\`).toBe(true);
    }
  });

  it("indexes effects by trigger", () => {
    const onRush = registry.listByTrigger("on_rush");
    expect(onRush.length).toBeGreaterThan(0);
  });

  it("reports implementation coverage", () => {
    const snap = registry.snapshot();
    expect(snap.legacyHandler.length + snap.dslReady.length + snap.unimplemented.length).toBe(
      registry.size(),
    );
  });
});
`;
}

export type GenerateOptions = {
  cardIds?: string[];
  includeSkipped?: boolean;
  outputDir?: string;
};

/** 複数カードのテストファイルを Map で返す */
export function generateCardTestFiles(
  registry: CardRegistry,
  options: GenerateOptions = {},
): Map<string, string> {
  const files = new Map<string, string>();
  const ids = options.cardIds ?? registry.listCards().map((c) => c.id);

  for (const id of ids) {
    const card = registry.getCard(id);
    if (!card) continue;
    files.set(`${id}.generated.test.ts`, generateCardTestFile(card));
  }

  return files;
}

/** CLI / スクリプト用: ファイルパス一覧 */
export function planGeneratedTestPaths(cardIds: string[]): string[] {
  return cardIds.map((id) => `src/dsl/generated/${id}.generated.test.ts`);
}
