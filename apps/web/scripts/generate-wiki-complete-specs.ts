/**
 * wiki + full-playable カタログから完成版テスト仕様を生成する。
 *
 * Usage:
 *   npx tsx apps/web/scripts/generate-wiki-complete-specs.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fullPlayableCatalog } from "../../../packages/cards/src/catalog/unifiedCatalog";
import { getCardEffect } from "../../../packages/cards/src/effects";
import {
  inferCatalogTierForCardId,
  loadCardById,
} from "../../../packages/cards/src/dsl/loader";
import { parsePowerCost } from "../../../packages/cards/src/pipeline/metaMaps";
import { parseWikiMarkdown } from "../../../packages/cards/src/pipeline/parseWiki";
import { DEFAULT_WIKI_DIR } from "../../../packages/cards/src/pipeline/runPipeline";
import type { WikiCardCompleteSpec } from "../lib/wikiTestSpecs/types";
import { OPERATION_UI_MECHANISMS } from "../lib/operationUiMechanisms";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../lib/wikiTestSpecs/generated");

function listDslGrantKeywords(cardId: string): string[] {
  const doc = loadCardById(cardId, inferCatalogTierForCardId(cardId));
  const keywords = new Set<string>();
  for (const effect of doc.effects ?? []) {
    for (const primitive of effect.effects) {
      if (primitive.type === "grant_keyword") {
        keywords.add(primitive.keyword);
      }
    }
  }
  return [...keywords];
}

type OperationKind = NonNullable<WikiCardCompleteSpec["operationKind"]>;

function inferOperationKind(effectTexts: string[]): OperationKind {
  const joined = effectTexts.join(" ");
  if (joined.includes("※常駐")) return "permanent";
  if (joined.includes("※カウンター")) return "counter";
  return "instant";
}

/** カタログ text から検証用スニペットを抽出（wiki 文言は表記揺れがあるため catalog を正とする）。 */
function buildCatalogTextSnippets(catalogText: string): string[] {
  const snippets: string[] = [];
  if (catalogText.includes("※常駐")) snippets.push("※常駐");
  if (catalogText.includes("※カウンター")) snippets.push("※カウンター");
  for (const match of catalogText.matchAll(/【([^】]+)】/g)) {
    if (match[1]) snippets.push(`【${match[1]}】`);
  }
  if (snippets.length === 0) {
    const normalized = catalogText.replace(/\s+/g, " ").trim();
    if (normalized.length >= 8) snippets.push(normalized.slice(0, 24));
  }
  return [...new Set(snippets)].slice(0, 6);
}

function resolveOperationMechanisms(
  cardId: string,
  kind: NonNullable<WikiCardCompleteSpec["operationKind"]>,
): WikiCardCompleteSpec["expectedMechanisms"] {
  const effect = getCardEffect(cardId);
  if (effect?.effectId && OPERATION_UI_MECHANISMS[effect.effectId]) {
    return OPERATION_UI_MECHANISMS[effect.effectId]!;
  }
  switch (kind) {
    case "permanent":
      return ["operation_permanent_place", "passive_engine_only"];
    case "counter":
      return ["operation_counter_reaction"];
    case "instant": {
      if (effect?.effectId === "cyber_s_rider") {
        return ["operation_cyber_s_rider_modal"];
      }
      if (effect?.target) return ["operation_drag_target_modal"];
      return ["operation_drag_direct"];
    }
    default:
      return ["passive_engine_only"];
  }
}

function resolveInstantDropRoute(cardId: string): WikiCardCompleteSpec["expectedDropRoute"] {
  const effect = getCardEffect(cardId);
  if (effect?.effectId === "cyber_s_rider") return "cyber_s_rider_modal";
  if (effect?.target) return "target_modal";
  return "direct_play";
}

function buildSpec(card: (typeof fullPlayableCatalog.cards)[number]): WikiCardCompleteSpec | null {
  let parsed;
  try {
    parsed = parseWikiMarkdown(card.id, DEFAULT_WIKI_DIR);
  } catch {
    return null;
  }

  const wikiPower = parsed.status.必要パワー ?? parsed.status.BP;
  const parsedPower =
    wikiPower !== undefined ? parsePowerCost(String(wikiPower)) : card.powerCost;
  const powerCost =
    typeof parsedPower === "string" || Number.isFinite(parsedPower)
      ? parsedPower
      : card.powerCost;
  const category = card.category;
  const doc = loadCardById(card.id, inferCatalogTierForCardId(card.id));
  const catalogText = card.text ?? doc.text ?? doc.rawText ?? "";
  const textSnippets = buildCatalogTextSnippets(catalogText);
  const expectedDslKeywords = listDslGrantKeywords(card.id);

  const spec: WikiCardCompleteSpec = {
    cardId: card.id,
    wikiRef: `docs/wiki/cards/${card.id}.md`,
    name: card.name,
    cardType: card.type as WikiCardCompleteSpec["cardType"],
    powerCost,
    category: Array.isArray(card.category)
      ? card.category
      : card.category,
    textSnippets,
    expectedDslKeywords:
      expectedDslKeywords.length > 0 ? expectedDslKeywords : undefined,
  };

  if (card.type === "unit" || card.type === "vehicle") {
    spec.bp = card.bp;
    spec.sp = card.sp ?? null;
    spec.size = card.size;
  }

  if (card.type === "operation") {
    const operationKind =
      getCardEffect(card.id)?.kind ?? inferOperationKind(parsed.effectTexts);
    spec.operationKind = operationKind;
    spec.expectedMechanisms = resolveOperationMechanisms(card.id, operationKind);
    if (operationKind === "instant") {
      spec.expectedDropRoute = resolveInstantDropRoute(card.id);
    }
  }

  return spec;
}

function main(): void {
  const specs: WikiCardCompleteSpec[] = [];
  const missingWiki: string[] = [];

  for (const card of fullPlayableCatalog.cards) {
    const spec = buildSpec(card);
    if (!spec) {
      missingWiki.push(card.id);
      continue;
    }
    specs.push(spec);
  }

  specs.sort((a, b) => a.cardId.localeCompare(b.cardId, undefined, { numeric: true }));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "all-specs.json"),
    `${JSON.stringify(specs, null, 2)}\n`,
    "utf8",
  );

  const byPrefix: Record<string, WikiCardCompleteSpec[]> = {};
  for (const spec of specs) {
    const prefix = spec.cardId.split("-")[0] ?? "OTHER";
    (byPrefix[prefix] ??= []).push(spec);
  }

  for (const [prefix, prefixSpecs] of Object.entries(byPrefix)) {
    writeFileSync(
      join(OUT_DIR, `${prefix.toLowerCase()}-specs.json`),
      `${JSON.stringify(prefixSpecs, null, 2)}\n`,
      "utf8",
    );
  }

  writeFileSync(
    join(OUT_DIR, "index.ts"),
    `/** Auto-generated by apps/web/scripts/generate-wiki-complete-specs.ts — do not edit. */
import allSpecsJson from "./all-specs.json";
import type { WikiCardCompleteSpec } from "../types";

export const WIKI_COMPLETE_SPECS = allSpecsJson as WikiCardCompleteSpec[];
export const WIKI_COMPLETE_SPEC_COUNT = WIKI_COMPLETE_SPECS.length;

export function specsByPrefix(prefix: string): WikiCardCompleteSpec[] {
  return WIKI_COMPLETE_SPECS.filter((s) => s.cardId.startsWith(\`\${prefix}-\`));
}
`,
    "utf8",
  );

  const byType: Record<string, number> = {};
  for (const spec of specs) {
    byType[spec.cardType] = (byType[spec.cardType] ?? 0) + 1;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    total: specs.length,
    missingWiki,
    byType,
    byPrefix: Object.fromEntries(
      Object.entries(byPrefix).map(([k, v]) => [k, v.length]),
    ),
  };
  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated ${specs.length} specs (${missingWiki.length} missing wiki)`);
  console.log(JSON.stringify(summary.byPrefix, null, 2));
}

main();
