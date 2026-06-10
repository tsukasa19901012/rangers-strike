/**
 * full-playable の legacy / delegate 効果監査（M9–M17）。
 *
 * Usage:
 *   npm run audit:runtime-effects
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vanillaPromotedCatalog } from "../src/extendedCatalog";
import { loadAllCardDocuments, loadFullPlayableDocuments } from "../src/dsl/loader";
import { hasEffectBuilder } from "../src/dsl/effectBuilders";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/runtime-effect-audit.json");

type RuntimeEntry = {
  cardId: string;
  effectId: string;
  trigger: string;
  primitive: "enqueue_trigger" | "runtime_grant_keyword" | "effect_delegate" | "native";
  migrationTier: "native" | "enqueue" | "delegate" | "builder_ready" | "complex";
  tier: "core" | "vanilla_promoted" | "complexity_promoted";
};

function classifyPrimitive(effect: {
  effects: Array<{ type: string; keyword?: string; effectId?: string }>;
}): RuntimeEntry["primitive"] {
  if (effect.effects.every((p) => p.type === "interpret_effect")) {
    return "native";
  }
  for (const p of effect.effects) {
    if (p.type === "enqueue_trigger") return "enqueue_trigger";
    if (p.type === "grant_keyword" && p.keyword?.startsWith("effect_")) {
      return "effect_delegate";
    }
    if (p.type === "grant_keyword" && p.keyword?.startsWith("runtime_")) {
      return "runtime_grant_keyword";
    }
  }
  return "native";
}

function tierForCard(
  cardId: string,
  coreIds: Set<string>,
  vanillaIds: Set<string>,
): RuntimeEntry["tier"] {
  if (coreIds.has(cardId)) return "core";
  if (vanillaIds.has(cardId)) return "vanilla_promoted";
  return "complexity_promoted";
}

function main(): void {
  const coreDocs = loadAllCardDocuments();
  const docs = loadFullPlayableDocuments();
  const coreIds = new Set(coreDocs.map((c) => c.id));
  const vanillaPromotedIds = new Set(vanillaPromotedCatalog.cards.map((c) => c.id));

  const entries: RuntimeEntry[] = [];

  for (const doc of docs) {
    for (const effect of doc.effects ?? []) {
      const primitive = classifyPrimitive(effect);
      if (primitive === "native") continue;

      let migrationTier: RuntimeEntry["migrationTier"] = "native";
      if (primitive === "enqueue_trigger") migrationTier = "enqueue";
      else if (primitive === "effect_delegate") migrationTier = "delegate";
      else if (hasEffectBuilder(effect.id)) migrationTier = "builder_ready";
      else migrationTier = "complex";

      entries.push({
        cardId: doc.id,
        effectId: effect.id,
        trigger: effect.trigger.type,
        primitive,
        migrationTier,
        tier: tierForCard(doc.id, coreIds, vanillaPromotedIds),
      });
    }
  }

  const byPrimitive = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.primitive] = (acc[e.primitive] ?? 0) + 1;
    return acc;
  }, {});

  const byTier = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.tier] = (acc[e.tier] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    playableCards: docs.length,
    coreCards: coreIds.size,
    legacyBridgeCount: entries.length,
    byPrimitive,
    byTier,
    byTrigger: entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.trigger] = (acc[e.trigger] ?? 0) + 1;
      return acc;
    }, {}),
    byMigrationTier: entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.migrationTier] = (acc[e.migrationTier] ?? 0) + 1;
      return acc;
    }, {}),
    entries,
    note: "M17: full-playable 1849 cards; effect_* delegate replaces enqueue_trigger for unmatched patterns.",
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { playableCards: docs.length, legacyBridgeCount: entries.length, byPrimitive, byTier },
      null,
      2,
    ),
  );
  console.log(`→ ${outputPath}`);
}

main();
