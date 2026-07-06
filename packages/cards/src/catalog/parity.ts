import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyRecommendedReplacementText } from "../cardText";
import { findNamedEffectByEffectId } from "../unitEffects";
import { loadCards, loadFullPlayableDocuments } from "../dsl/loader";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "../dsl/registry";
import type { CardDefinition } from "../schema";
import {
  diffCardStats,
  EMIT_DSL_ENRICH_FIELDS,
  fingerprintCardDocuments,
} from "./statsParity";
import {
  CORE_PLAYABLE_CARD_COUNT,
  FULL_PLAYABLE_CARD_COUNT,
  type CatalogTier,
} from "./tiers";
import { loadCorePlayableCards } from "./coreCatalogSources";
import {
  allCardsCatalog,
  complexityPromotedCatalog,
  corePlayableCatalog,
  fullPlayableCatalog,
  generatedCorePlayableCatalog,
  getCatalog,
  listCoreCardIds,
  vanillaPromotedCatalog,
  wikiStubsCatalog,
} from "./unifiedCatalog";

export type ParityGateStatus = "pass" | "fail" | "partial";

export type ParityGate = {
  id: string;
  name: string;
  status: ParityGateStatus;
  target: string;
  current: string;
  details?: string[];
};

export type CatalogParityReport = {
  generatedAt: string;
  gates: ParityGate[];
  gatesPassed: number;
  gatesTotal: number;
  summary: {
    coreCount: number;
    fullPlayableCount: number;
    uniqueFullPlayableIds: number;
    dslReady: number;
    loaderFingerprint: string;
  };
  samples: {
    coreStatsDiffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }>;
    coreDslStatsDiffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }>;
    promotedDslStatsDiffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }>;
    tierOverlaps: Array<{ tier: CatalogTier; overlapWithCore: string[] }>;
  };
};

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadDslStubCard(id: string): CardDefinition | undefined {
  const dslPath = join(packageRoot, "src/generated/dsl-stubs", `${id}.dsl.json`);
  if (!existsSync(dslPath)) return undefined;
  return JSON.parse(readFileSync(dslPath, "utf8")) as CardDefinition;
}

function gate(
  id: string,
  name: string,
  status: ParityGateStatus,
  target: string,
  current: string,
  details?: string[],
): ParityGate {
  return { id, name, status, target, current, details };
}

function evaluateGeneratedCoreCount(): ParityGate {
  const count = generatedCorePlayableCatalog.cards.length;
  const status: ParityGateStatus = count === CORE_PLAYABLE_CARD_COUNT ? "pass" : "fail";

  return gate(
    "U2-a",
    "core-playable emit",
    status,
    `generated core-playable = ${CORE_PLAYABLE_CARD_COUNT}`,
    `generated=${count}`,
  );
}

function evaluateCoreCatalogIntegrity(): {
  gate: ParityGate;
  diffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }>;
} {
  const cards = loadCorePlayableCards();
  const diffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }> = [];

  for (const card of cards) {
    if (!card.id || !card.name || !card.type || !card.expansion) {
      diffs.push({
        id: card.id ?? "(missing id)",
        diffs: [{ field: "name", left: card.name, right: undefined }],
      });
    }
  }

  const status: ParityGateStatus =
    diffs.length === 0 && cards.length === CORE_PLAYABLE_CARD_COUNT ? "pass" : "fail";
  return {
    diffs: diffs.slice(0, 20),
    gate: gate(
      "U2-b",
      "core catalog integrity",
      status,
      `generated core ${CORE_PLAYABLE_CARD_COUNT} 枚すべて必須 stats あり`,
      `cards=${cards.length}, invalid=${diffs.length}`,
      diffs.length > 0 ? diffs.slice(0, 5).map((d) => d.id) : undefined,
    ),
  };
}

function evaluateCoreDslStubs(): ParityGate {
  const coreIds = listCoreCardIds();
  const missing: string[] = [];

  for (const id of coreIds) {
    const dslPath = join(packageRoot, "src/generated/dsl-stubs", `${id}.dsl.json`);
    if (!existsSync(dslPath)) {
      missing.push(id);
    }
  }

  return gate(
    "U2-c",
    "core DSL stubs",
    missing.length === 0 ? "pass" : "fail",
    `core ${CORE_PLAYABLE_CARD_COUNT} 枚すべて dsl-stubs/{id}.dsl.json あり`,
    `missing=${missing.length}`,
    missing.length > 0 ? missing.slice(0, 10) : undefined,
  );
}

function evaluateFullPlayableCount(): ParityGate {
  const ids = fullPlayableCatalog.cards.map((card) => card.id);
  const unique = new Set(ids);
  const countOk = ids.length === FULL_PLAYABLE_CARD_COUNT;
  const uniqueOk = unique.size === ids.length;
  const status: ParityGateStatus = countOk && uniqueOk ? "pass" : "fail";

  return gate(
    "U0-b",
    "full-playable 件数",
    status,
    `cards=${FULL_PLAYABLE_CARD_COUNT}, unique=${FULL_PLAYABLE_CARD_COUNT}`,
    `cards=${ids.length}, unique=${unique.size}`,
  );
}

function evaluateDslReady(): ParityGate {
  const metrics = snapshotFullPlayableRegistryMetrics(createFullPlayableRegistry());
  const status: ParityGateStatus =
    metrics.dslReady === FULL_PLAYABLE_CARD_COUNT ? "pass" : metrics.dslReady >= FULL_PLAYABLE_CARD_COUNT * 0.99 ? "partial" : "fail";

  return gate(
    "U0-c",
    "DSL 登録",
    status,
    `dslReady=${FULL_PLAYABLE_CARD_COUNT}`,
    `dslReady=${metrics.dslReady}, unimplemented=${metrics.unimplemented}, legacy=${metrics.legacyHandler}`,
  );
}

function evaluateTierOverlaps(): {
  gate: ParityGate;
  overlaps: Array<{ tier: CatalogTier; overlapWithCore: string[] }>;
} {
  const coreIds = listCoreCardIds();
  const tiers: CatalogTier[] = ["vanilla-promoted", "complexity-promoted", "wiki-stubs"];
  const overlaps = tiers.map((tier) => {
    const overlapWithCore = getCatalog(tier).cards
      .map((card) => card.id)
      .filter((id) => coreIds.has(id));
    return { tier, overlapWithCore };
  });

  const promotedOverlap = overlaps
    .filter((entry) => entry.tier !== "wiki-stubs")
    .flatMap((entry) => entry.overlapWithCore);

  const status: ParityGateStatus = promotedOverlap.length === 0 ? "pass" : "fail";

  return {
    overlaps,
    gate: gate(
      "U0-a2",
      "tier と core の ID 重複",
      status,
      "promoted tiers と core の重複 = 0",
      `promoted_overlap=${promotedOverlap.length}, wiki_stub_overlap=${overlaps.find((o) => o.tier === "wiki-stubs")?.overlapWithCore.length ?? 0}`,
      promotedOverlap.length > 0 ? promotedOverlap.slice(0, 10) : undefined,
    ),
  };
}

function diffCatalogAgainstDsl(
  cards: CardDefinition[],
): Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }> {
  const diffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }> = [];

  for (const card of cards) {
    const dsl = loadDslStubCard(card.id);
    if (!dsl) continue;
    // emit（enrichFromDsl）と同様にエラッタ読み替えを適用してから比較する
    const expected = { ...dsl, text: applyRecommendedReplacementText(dsl.text) };
    const cardDiffs = diffCardStats(card, expected, { only: EMIT_DSL_ENRICH_FIELDS }).filter(
      (entry) => entry.left !== null && entry.left !== undefined,
    );
    if (cardDiffs.length > 0) {
      diffs.push({ id: card.id, diffs: cardDiffs });
    }
  }

  return diffs;
}

function evaluatePromotedDslStatsParity(): {
  gate: ParityGate;
  diffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }>;
} {
  const promoted = [
    ...vanillaPromotedCatalog.cards,
    ...complexityPromotedCatalog.cards,
  ];
  const diffs = diffCatalogAgainstDsl(promoted);
  const status: ParityGateStatus = diffs.length === 0 ? "pass" : "fail";

  return {
    diffs: diffs.slice(0, 20),
    gate: gate(
      "U0-a3",
      "promoted catalog vs DSL stub stats",
      status,
      "emit enrich フィールドの矛盾 = 0",
      `mismatches=${diffs.length}`,
      diffs.length > 0 ? diffs.slice(0, 5).map((d) => d.id) : undefined,
    ),
  };
}

function evaluateCoreDslStatsParity(): {
  gate: ParityGate;
  diffs: Array<{ id: string; diffs: ReturnType<typeof diffCardStats> }>;
} {
  const diffs = diffCatalogAgainstDsl(loadCorePlayableCards());
  const status: ParityGateStatus = diffs.length === 0 ? "pass" : "fail";

  return {
    diffs: diffs.slice(0, 20),
    gate: gate(
      "U2-d",
      "core catalog vs DSL stub stats",
      status,
      "emit enrich フィールドの矛盾 = 0",
      `mismatches=${diffs.length}`,
      diffs.length > 0 ? diffs.slice(0, 5).map((d) => d.id) : undefined,
    ),
  };
}

function evaluateLoaderFingerprint(): { gate: ParityGate; fingerprint: string } {
  const docs = loadCards("full-playable");
  const fingerprint = fingerprintCardDocuments(docs);
  const countOk = docs.length === FULL_PLAYABLE_CARD_COUNT;

  return {
    fingerprint,
    gate: gate(
      "U0-b2",
      "loader フィンガープリント",
      countOk ? "pass" : "fail",
      `loadCards(full-playable).length=${FULL_PLAYABLE_CARD_COUNT}`,
      `length=${docs.length}, fingerprint=${fingerprint.slice(0, 12)}…`,
    ),
  };
}

const U4_RUNTIME_SOURCES = [
  "src/unitEffects.ts",
  "src/unitEffectCatalog.ts",
  "src/dsl/loader.ts",
  "src/effects.ts",
] as const;

const U5_FORBIDDEN_IMPORTS = [
  "legend1/cards.json",
  "legend2/cards.json",
  "legend3/cards.json",
  "legend1/unitEffects.json",
  "legend2/unitEffects.json",
  "legend3/unitEffects.json",
] as const;

const U5_SCAN_DIRS = ["src", "scripts"] as const;

function evaluateU5NoLegendJsonImports(): ParityGate {
  const violations: string[] = [];

  for (const scanDir of U5_SCAN_DIRS) {
    const base = join(packageRoot, scanDir);
    if (!existsSync(base)) continue;
    walkTsFiles(base, (filePath) => {
      const relative = filePath.slice(packageRoot.length + 1);
      if (relative === "src/catalog/parity.ts") return;
      const content = readFileSync(filePath, "utf8");
      for (const forbidden of U5_FORBIDDEN_IMPORTS) {
        if (content.includes(forbidden)) {
          violations.push(`${relative} → ${forbidden}`);
        }
      }
    });
  }

  return gate(
    "U5-a",
    "legend JSON import ゼロ",
    violations.length === 0 ? "pass" : "fail",
    "src/ scripts/ に legend*/cards.json / unitEffects.json import なし",
    `violations=${violations.length}`,
    violations.length > 0 ? violations.slice(0, 10) : undefined,
  );
}

function evaluateU5LegendJsonDeleted(): ParityGate {
  const remaining: string[] = [];
  for (const forbidden of U5_FORBIDDEN_IMPORTS) {
    const fullPath = join(packageRoot, "src", forbidden);
    if (existsSync(fullPath)) {
      remaining.push(forbidden);
    }
  }

  return gate(
    "U5-b",
    "legend JSON ファイル削除",
    remaining.length === 0 ? "pass" : "fail",
    "legend1–3 の cards.json / unitEffects.json が存在しない",
    `remaining=${remaining.length}`,
    remaining.length > 0 ? remaining : undefined,
  );
}

function walkTsFiles(dir: string, visit: (filePath: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      walkTsFiles(full, visit);
      continue;
    }
    if (/\.(ts|tsx|mts|mjs|js)$/.test(entry.name)) {
      visit(full);
    }
  }
}
function evaluateU4NoRuntimeJsonImports(): ParityGate {
  const violations: string[] = [];
  for (const relativePath of U4_RUNTIME_SOURCES) {
    const content = readFileSync(join(packageRoot, relativePath), "utf8");
    if (content.includes("unitEffects.json")) {
      violations.push(relativePath);
    }
  }
  const loaderContent = readFileSync(join(packageRoot, "src/dsl/loader.ts"), "utf8");
  if (
    loaderContent.includes("loadCardByIdLegacy") ||
    loaderContent.includes("cardDefinitionToDocument(def")
  ) {
    violations.push("loader:legacy-compose");
  }

  return gate(
    "U4-a",
    "runtime unitEffects.json 参照ゼロ",
    violations.length === 0 ? "pass" : "fail",
    "unitEffects.ts / catalog / loader に legend unitEffects.json import なし",
    `violations=${violations.length}`,
    violations.length > 0 ? violations : undefined,
  );
}

function evaluateU4RegistryEffectLookup(): ParityGate {
  const samples = [
    { cardId: "RS-046", effectId: "armor_attack" },
    { cardId: "RS-066", effectId: "ruin_survey" },
    { cardId: "RS-031", effectId: "eagle_diving" },
  ];
  const missing = samples.filter(
    (sample) => !findNamedEffectByEffectId(sample.cardId, sample.effectId),
  );

  return gate(
    "U4-b",
    "registry effect lookup",
    missing.length === 0 ? "pass" : "fail",
    "findNamedEffectByEffectId がコア代表カードで解決",
    `missing=${missing.length}`,
    missing.length > 0 ? missing.map((m) => m.cardId) : undefined,
  );
}

function evaluateUnifiedLoaderParity(): ParityGate {
  const unified = loadCards("full-playable");
  const legacy = loadFullPlayableDocuments();
  const sameFingerprint =
    fingerprintCardDocuments(unified) === fingerprintCardDocuments(legacy);

  return gate(
    "U3-a",
    "unified loader parity",
    sameFingerprint && unified.length === legacy.length ? "pass" : "fail",
    "loadCards と loadFullPlayableDocuments の fingerprint 一致",
    `unified=${unified.length}, legacy=${legacy.length}, match=${sameFingerprint}`,
  );
}

function evaluateWikiStubExclusion(): ParityGate {
  const coreIds = listCoreCardIds();
  const wikiCoreOverlap = wikiStubsCatalog.cards
    .map((card) => card.id)
    .filter((id) => coreIds.has(id));

  return gate(
    "U0-a4",
    "wiki-stubs と core 排他",
    wikiCoreOverlap.length === 0 ? "pass" : "fail",
    "wiki-stubs に core ID が含まれない",
    `overlap=${wikiCoreOverlap.length}`,
    wikiCoreOverlap.length > 0 ? wikiCoreOverlap.slice(0, 10) : undefined,
  );
}

export function runCatalogParityAudit(): CatalogParityReport {
  const coreIntegrity = evaluateCoreCatalogIntegrity();
  const coreDsl = evaluateCoreDslStatsParity();
  const tierOverlaps = evaluateTierOverlaps();
  const promotedDsl = evaluatePromotedDslStatsParity();
  const loader = evaluateLoaderFingerprint();

  const gates = [
    evaluateGeneratedCoreCount(),
    coreIntegrity.gate,
    evaluateCoreDslStubs(),
    coreDsl.gate,
    tierOverlaps.gate,
    evaluateWikiStubExclusion(),
    promotedDsl.gate,
    evaluateFullPlayableCount(),
    loader.gate,
    evaluateUnifiedLoaderParity(),
    evaluateU4NoRuntimeJsonImports(),
    evaluateU4RegistryEffectLookup(),
    evaluateU5NoLegendJsonImports(),
    evaluateU5LegendJsonDeleted(),
    evaluateDslReady(),
  ];

  const gatesPassed = gates.filter((g) => g.status === "pass").length;
  const metrics = snapshotFullPlayableRegistryMetrics(createFullPlayableRegistry());
  const fullIds = fullPlayableCatalog.cards.map((card) => card.id);

  return {
    generatedAt: new Date().toISOString(),
    gates,
    gatesPassed,
    gatesTotal: gates.length,
    summary: {
      coreCount: allCardsCatalog.cards.length,
      fullPlayableCount: fullIds.length,
      uniqueFullPlayableIds: new Set(fullIds).size,
      dslReady: metrics.dslReady,
      loaderFingerprint: loader.fingerprint,
    },
    samples: {
      coreStatsDiffs: coreIntegrity.diffs,
      coreDslStatsDiffs: coreDsl.diffs,
      promotedDslStatsDiffs: promotedDsl.diffs,
      tierOverlaps: tierOverlaps.overlaps,
    },
  };
}

export function allParityGatesPassed(report: CatalogParityReport): boolean {
  return report.gates.every((g) => g.status === "pass");
}
