/**
 * 実装ギャップの横断監査 — ルール・カード・UI の未完了を一覧化する。
 *
 * Usage:
 *   npx tsx packages/cards/scripts/audit-implementation-gaps.ts
 *   npx tsx packages/cards/scripts/audit-implementation-gaps.ts --json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCardById } from "../src/catalog";
import { fullPlayableCatalog } from "../src/catalog/unifiedCatalog";
import { resolvePlayableCard } from "../src/extendedCatalog";
import { loadFullPlayableDocuments } from "../src/dsl/loader";
import { cardCategories } from "../src/schema";
import { classifyRuntimeRematch } from "../src/pipeline/measureEffectResolution";
import { listImplementedOperations } from "../src/operationCatalog";
import { GLOSSARY_FRAMEWORK_ONLY, GLOSSARY_NOT_IMPLEMENTED } from "../src/glossaryImplementation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const dataDir = join(__dirname, "../pipeline/data");
const jsonPath = join(dataDir, "implementation-gaps.json");

type PartialCard = { id: string; name: string; reason: string; effectPreview?: string };
type MultiCategoryCard = { id: string; name: string; categories: string[]; type: string };

type ImplementationGapsReport = {
  generatedAt: string;
  summary: {
    catalogTotal: number;
    coreCards: number;
    promotedCards: number;
    dslRegistryImplemented: number;
    dslRegistryPartial: number;
    dslRegistryUnimplemented: number;
    multiCategoryCards: number;
    partialEffectCards: number;
    implementedOperations: number;
  };
  ruleGaps: Array<{
    id: string;
    title: string;
    priority: "P0" | "P1" | "P2" | "P3";
    status: "missing" | "partial";
    impact: string;
    refs: string[];
  }>;
  partialCards: PartialCard[];
  multiCategoryCards: MultiCategoryCard[];
  glossaryNotImplemented: typeof GLOSSARY_NOT_IMPLEMENTED;
  glossaryFrameworkOnly: typeof GLOSSARY_FRAMEWORK_ONLY;
  powerCalculationSites: string[];
};

const RULE_GAPS: ImplementationGapsReport["ruleGaps"] = [
  {
    id: "RULE-01",
    title: "パワー計算 — 敵マルチコマンド加算",
    priority: "P0",
    status: "partial",
    impact: "countAvailablePower 実装済み（packages/engine/src/core/power.ts）。",
    refs: [
      "packages/engine/src/core/helpers.ts",
      "packages/engine/src/core/catalog.ts",
      "docs/architecture/state-gap-analysis.md §1",
    ],
  },
  {
    id: "RULE-02",
    title: "同時効果のプレイヤー順序選択",
    priority: "P1",
    status: "partial",
    impact: "基盤配線済み。複雑な同時発動シナリオの網羅は継続。",
    refs: ["packages/engine/src/types/game.ts (simultaneousGroupId)", "docs/wiki/timing.md"],
  },
  {
    id: "RULE-03",
    title: "ウイング（空バトルエリア例外）",
    priority: "P1",
    status: "partial",
    impact: "ウイング持ちユニットのアタック制限・配置例外が未対応。",
    refs: ["docs/wiki/engine-gaps.md", "docs/architecture/implementation-roadmap.md T3-04"],
  },
  {
    id: "RULE-04",
    title: "チェイス（追撃・連鎖カウンター）",
    priority: "P2",
    status: "partial",
    impact: "チェイスキーワード依存カードが動作しない。",
    refs: ["docs/wiki/engine-gaps.md", "docs/architecture/implementation-roadmap.md T3-05"],
  },
  {
    id: "RULE-05",
    title: "JC / RC フレームワーク",
    priority: "P1",
    status: "partial",
    impact: "ジョイントコンボ・ライディングコンボの一部カードが不完全。",
    refs: ["packages/engine/src/rules/legend3/jointComboEffects.ts", "implementation-roadmap.md T3-02/03"],
  },
  {
    id: "RULE-06",
    title: "エンドフェイズ明示ステップ",
    priority: "P2",
    status: "partial",
    impact: "endPhaseStep 配線済み。ターン終了時効果の段階管理は継続拡充。",
    refs: ["docs/architecture/state-gap-analysis.md §3"],
  },
  {
    id: "RULE-07",
    title: "DSL インタープリタと TS ハンドラの二重経路",
    priority: "P1",
    status: "partial",
    impact: "スターターは TS、promoted は DSL。挙動差・検証漏れの温床。",
    refs: ["docs/architecture/vertical-slice-gaps.md VS-01"],
  },
];

const POWER_CALCULATION_SITES = [
  "packages/engine/src/core/helpers.ts — canAffordPower / payPowerCost",
  "packages/engine/src/core/catalog.ts — canRushUnit / canPlayOperation",
  "packages/engine/src/rules/commandPayment.ts — rush エラーメッセージ",
  "packages/engine/src/rules/zordSetup.ts — ゾード必要パワー",
  "packages/engine/src/rules/legend3/restrictions.ts — パワー予算",
  "packages/engine/src/ai/helpers.ts — CPU ラッシュ/オペ判定",
];

function buildReport(): ImplementationGapsReport {
  const cards = fullPlayableCatalog.cards;
  const docs = loadFullPlayableDocuments();
  const docById = new Map(docs.map((d) => [d.id, d]));

  const multiCategoryCards: MultiCategoryCard[] = [];
  for (const entry of cards) {
    const def = resolvePlayableCard(entry.id) ?? entry;
    const categories = cardCategories(def);
    if (categories.length >= 2) {
      multiCategoryCards.push({
        id: entry.id,
        name: def.name,
        categories,
        type: def.type,
      });
    }
  }

  const partialMap = new Map<string, PartialCard>();
  for (const card of docs) {
    for (const eff of card.effects ?? []) {
      const cls = classifyRuntimeRematch(eff, card.id);
      if (cls !== "catchall_fallback") continue;
      if (partialMap.has(card.id)) continue;
      partialMap.set(card.id, {
        id: card.id,
        name: card.name ?? card.id,
        reason: "catchall_interpret fallback（効果文はあるが専用実装なし）",
        effectPreview: (eff.text ?? "").slice(0, 120),
      });
    }
  }

  let dslImplemented = 0;
  let dslPartial = 0;
  let dslUnimplemented = 0;
  for (const card of docs) {
    const handler = card.implementation?.handler ?? "unimplemented";
    if (handler === "unimplemented") {
      dslUnimplemented++;
      continue;
    }
    const hasCatchall = (card.effects ?? []).some(
      (e) => classifyRuntimeRematch(e, card.id) === "catchall_fallback",
    );
    if (hasCatchall || handler === "typescript") dslPartial++;
    else dslImplemented++;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      catalogTotal: cards.length,
      coreCards: cards.filter((c) => getCardById(c.id)).length,
      promotedCards: cards.filter((c) => !getCardById(c.id)).length,
      dslRegistryImplemented: dslImplemented,
      dslRegistryPartial: dslPartial,
      dslRegistryUnimplemented: dslUnimplemented,
      multiCategoryCards: multiCategoryCards.length,
      partialEffectCards: partialMap.size,
      implementedOperations: listImplementedOperations().length,
    },
    ruleGaps: RULE_GAPS,
    partialCards: [...partialMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    multiCategoryCards: multiCategoryCards.sort((a, b) => a.id.localeCompare(b.id)),
    glossaryNotImplemented: GLOSSARY_NOT_IMPLEMENTED,
    glossaryFrameworkOnly: GLOSSARY_FRAMEWORK_ONLY,
    powerCalculationSites: POWER_CALCULATION_SITES,
  };
}

function main(): void {
  const report = buildReport();
  const jsonOnly = process.argv.includes("--json");

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  if (jsonOnly) {
    console.log(JSON.stringify(report.summary, null, 2));
    return;
  }

  console.log(`→ ${jsonPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main();
