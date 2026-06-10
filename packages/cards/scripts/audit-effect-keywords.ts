/**
 * 昇格 grant_keyword のエンジン実装カバレッジ監査（M18）。
 *
 * Usage:
 *   npm run audit:effect-keywords
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFullPlayableRegistry } from "../src/dsl/registry";
import { loadAllCardDocuments } from "../src/dsl/loader";
import { complexityPromotedCatalog, vanillaPromotedCatalog } from "../src/extendedCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/effect-keyword-coverage.json");

const ENGINE_IMPLEMENTED_PREFIXES = [
  "power_faceup_bp_per_",
  "power_feature_bp_sp_",
  "sp_at_bp",
  "no_attack_from_enemy_s_bp",
  "cannot_attack_bp",
  "no_attack_without_",
  "ally_",
  "enemy_cannot_attack",
  "ride_without_rc_",
  "ride_command_without_rc_",
  "register",
  "wing",
  "cross1",
  "SP1",
  "SP2",
  "SP3",
];

function classifyKeyword(keyword: string): "engine" | "effect_delegate" | "passive_native" {
  if (keyword.startsWith("effect_")) return "effect_delegate";
  if (ENGINE_IMPLEMENTED_PREFIXES.some((p) => keyword.startsWith(p) || keyword === p)) {
    return "engine";
  }
  return "passive_native";
}

function main(): void {
  const registry = createFullPlayableRegistry();
  const coreIds = new Set(loadAllCardDocuments().map((c) => c.id));
  const promotedIds = new Set([
    ...vanillaPromotedCatalog.cards.map((c) => c.id),
    ...complexityPromotedCatalog.cards.map((c) => c.id),
  ]);

  const byKeyword = new Map<string, { count: number; sampleCardIds: string[] }>();

  let interpretEffectCount = 0;

  for (const card of registry.listCards()) {
    if (!promotedIds.has(card.id) || coreIds.has(card.id)) continue;
    for (const effect of card.effects ?? []) {
      for (const p of effect.effects) {
        if (p.type === "interpret_effect") {
          interpretEffectCount += 1;
          continue;
        }
        if (p.type !== "grant_keyword") continue;
        const bucket = byKeyword.get(p.keyword) ?? { count: 0, sampleCardIds: [] };
        bucket.count += 1;
        if (bucket.sampleCardIds.length < 3) bucket.sampleCardIds.push(card.id);
        byKeyword.set(p.keyword, bucket);
      }
    }
  }

  const entries = [...byKeyword.entries()].map(([keyword, meta]) => ({
    keyword,
    cardCount: meta.count,
    sampleCardIds: meta.sampleCardIds,
    category: classifyKeyword(keyword),
  }));

  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.cardCount;
    return acc;
  }, {});

  if (interpretEffectCount > 0) {
    byCategory.interpret_effect = interpretEffectCount;
    byCategory.engine = (byCategory.engine ?? 0) + interpretEffectCount;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    uniqueKeywords: entries.length,
    interpretEffectCount,
    byCategory,
    topEffectDelegate: entries
      .filter((e) => e.category === "effect_delegate")
      .sort((a, b) => b.cardCount - a.cardCount)
      .slice(0, 20),
    topPassiveNative: entries
      .filter((e) => e.category === "passive_native")
      .sort((a, b) => b.cardCount - a.cardCount)
      .slice(0, 20),
    note: "M18 promotedKeywordBridge handles power_faceup / power_feature_bp_sp / sp_at_bp patterns.",
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ uniqueKeywords: entries.length, byCategory }, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
