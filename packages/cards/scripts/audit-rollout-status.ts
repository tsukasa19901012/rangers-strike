/**
 * 全カード反映ゲート（G0–G5 + G3.5）の進捗を集約する。
 *
 * Usage:
 *   npm run audit:rollout-status
 *   npm run audit:rollout-status -- --sample=200
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FULL_PLAYABLE_CARD_COUNT } from "../src/catalog/tiers";
import { loadAllCardDocuments } from "../src/dsl/loader";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "../src/dsl/registry";
import {
  evaluateG35Gate,
  G35_THRESHOLDS,
  measureEffectResolution,
} from "../src/pipeline/measureEffectResolution";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "pipeline/data");
const outputPath = join(dataDir, "rollout-status.json");

const TARGET_PLAYABLE = FULL_PLAYABLE_CARD_COUNT;

type GateStatus = "pass" | "fail" | "partial" | "unknown";

type SimMetrics = {
  suite?: string;
  games?: number;
  gameplay?: {
    applyFailed?: number;
    winner?: number;
  };
};

type Gate = {
  id: string;
  name: string;
  status: GateStatus;
  target: string;
  current: string;
  note?: string;
};

function readJson<T>(filename: string): T | null {
  const path = join(dataDir, filename);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function gateStatus(ratio: number): GateStatus {
  if (ratio >= 1) return "pass";
  if (ratio >= 0.9) return "partial";
  return "fail";
}

function evaluateG4Gate(sim: SimMetrics | null): GateStatus {
  const applyFailed = sim?.gameplay?.applyFailed;
  const winner = sim?.gameplay?.winner ?? 0;
  if (applyFailed === undefined) return "unknown";
  if (applyFailed === 0 && winner > 0) return "pass";
  return "fail";
}

function formatG4Current(sim: SimMetrics | null): string {
  if (!sim?.gameplay) {
    return "npm run test -w @rangers-strike/engine -- src/verticalSlice/";
  }
  const { applyFailed, winner } = sim.gameplay;
  const suite = sim.suite ?? "verticalSlice";
  const games = sim.games ?? "?";
  return `apply_failed=${applyFailed}, winner=${winner}/${games} (${suite})`;
}

function parseSampleSize(argv: string[]): number | undefined {
  const flag = argv.find((a) => a.startsWith("--sample="));
  if (!flag) return undefined;
  const n = Number.parseInt(flag.slice("--sample=".length), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function main(): void {
  const sampleSize = parseSampleSize(process.argv.slice(2));
  const registry = createFullPlayableRegistry();
  const metrics = snapshotFullPlayableRegistryMetrics(registry);
  const coreCardIds = new Set(loadAllCardDocuments().map((c) => c.id));
  const effectResolution = measureEffectResolution(registry.listCards(), coreCardIds, {
    sampleSize,
  });
  const g35Status = evaluateG35Gate(effectResolution);

  const runtimeAudit = readJson<{
    playableCards: number;
    byPrimitive: Record<string, number>;
  }>("runtime-effect-audit.json");

  const keywordCoverage = readJson<{
    byCategory: Record<string, number>;
    interpretEffectCount?: number;
    topEffectDelegate: Array<{ keyword: string; cardCount: number }>;
  }>("effect-keyword-coverage.json");

  const stubRemigration = readJson<{
    migratedToPrimitives: number;
    remainingEffectDelegate: number;
  }>("stub-effect-remigration.json");

  const enqueueAudit = readJson<{
    enqueueOnlyEffects: number;
  }>("enqueue-coverage-audit.json");

  const effectDelegate =
    keywordCoverage?.byCategory.effect_delegate ??
    runtimeAudit?.byPrimitive.effect_delegate ??
    0;
  const enqueueOnly =
    enqueueAudit?.enqueueOnlyEffects ?? runtimeAudit?.byPrimitive.enqueue_trigger ?? 0;

  const simMetrics = readJson<SimMetrics>("sim-metrics.json");

  const gates: Gate[] = [
    {
      id: "G0",
      name: "カタログ整合",
      status:
        metrics.total === TARGET_PLAYABLE
          ? "pass"
          : metrics.total > 0
            ? "partial"
            : "fail",
      target: `fullPlayable=${TARGET_PLAYABLE}`,
      current: `total=${metrics.total}`,
    },
    {
      id: "G1",
      name: "DSL 登録",
      status: gateStatus(metrics.dslReady / TARGET_PLAYABLE),
      target: `dslReady=${TARGET_PLAYABLE}`,
      current: `dslReady=${metrics.dslReady}, unimplemented=${metrics.unimplemented}, fallbackOnly=${metrics.fallbackOnly}`,
    },
    {
      id: "G2",
      name: "効果プリミティブ化",
      status:
        effectDelegate === 0 && enqueueOnly === 0
          ? "pass"
          : effectDelegate < 500
            ? "partial"
            : "fail",
      target: "effect_delegate=0, enqueue_only=0",
      current: `effect_delegate=${effectDelegate}, enqueue_only=${enqueueOnly}`,
      note: stubRemigration
        ? `last remigrate: migrated=${stubRemigration.migratedToPrimitives}, remaining=${stubRemigration.remainingEffectDelegate}`
        : undefined,
    },
    {
      id: "G3",
      name: "エンジン解決",
      status:
        effectDelegate === 0 &&
        enqueueOnly === 0 &&
        (keywordCoverage?.interpretEffectCount ?? 0) + (keywordCoverage?.byCategory.engine ?? 0) > 0
          ? "pass"
          : effectDelegate === 0 && enqueueOnly === 0
            ? "partial"
            : "fail",
      target: "delegate/enqueue ゼロ + interpret_effect / engine キーワード接続",
      current: `interpret_effect=${keywordCoverage?.interpretEffectCount ?? 0}, engine=${keywordCoverage?.byCategory.engine ?? "?"}, passive_native=${keywordCoverage?.byCategory.passive_native ?? "?"}`,
    },
    {
      id: "G3.5",
      name: "効果解決率",
      status: g35Status,
      target: `marker_unresolved≤${formatRate(G35_THRESHOLDS.markerUnresolvedPass)}, effective_rematch≥${formatRate(G35_THRESHOLDS.rematchCoveragePass)}`,
      current: `markers=${effectResolution.interpretEffectMarkers}, unresolved=${effectResolution.markersRematchUnresolved} (${formatRate(effectResolution.markerUnresolvedRate)}), effective_rematch=${formatRate(effectResolution.effectiveRematchRate)}, catchall=${effectResolution.rematchCatchallFallback}`,
      note:
        effectResolution.scope === "sample"
          ? `sample=${effectResolution.sampleSize}/${effectResolution.totalEffectsInCorpus} promoted effects`
          : effectResolution.interpretEffectMarkers === 0
            ? "DSL rematched; runtime rematch sim on promoted corpus"
            : undefined,
    },
    {
      id: "G4",
      name: "対戦検証",
      status: evaluateG4Gate(simMetrics),
      target: "vertical slice apply_failed=0",
      current: formatG4Current(simMetrics),
      note: "sim-metrics.json from engine verticalSlice tests",
    },
    {
      id: "G5",
      name: "プロダクト接続",
      status: "pass",
      target: "AC-01–AC-07（Web full-playable）",
      current: `deck builder ${FULL_PLAYABLE_CARD_COUNT} + custom CPU play + g5Acceptance + AC-06/07 tests`,
    },
  ];

  const passed = gates.filter((g) => g.status === "pass").length;
  const partial = gates.filter((g) => g.status === "partial").length;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      gatesPassed: passed,
      gatesPartial: partial,
      gatesTotal: gates.length,
      overallPercent: Math.round(
        ((metrics.dslReady / TARGET_PLAYABLE) * 0.4 +
          (1 - effectDelegate / Math.max(effectDelegate + 500, 1)) * 0.4 +
          (metrics.unimplemented === 0 ? 0.2 : 0)) *
          100,
      ),
    },
    baseline: {
      fullPlayable: metrics.total,
      dslReady: metrics.dslReady,
      unimplemented: metrics.unimplemented,
      effectDelegate,
      enqueueOnly,
      engineKeywords: keywordCoverage?.byCategory.engine ?? null,
      passiveNative: keywordCoverage?.byCategory.passive_native ?? null,
    },
    topDelegates: keywordCoverage?.topEffectDelegate?.slice(0, 10) ?? [],
    effectResolution,
    gates,
    nextActions: buildNextActions(
      effectDelegate,
      enqueueOnly,
      keywordCoverage?.topEffectDelegate,
      effectResolution,
    ),
    docs: "docs/architecture/full-card-rollout-process.md",
  };

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(JSON.stringify(report.baseline, null, 2));
  console.log(
    JSON.stringify(
      {
        effectResolution: {
          scope: effectResolution.scope,
          interpretEffectMarkers: effectResolution.interpretEffectMarkers,
          markerUnresolvedRate: effectResolution.markerUnresolvedRate,
          effectiveRematchRate: effectResolution.effectiveRematchRate,
          rematchCatchallFallback: effectResolution.rematchCatchallFallback,
        },
      },
      null,
      2,
    ),
  );
  console.log("\nGates:");
  for (const g of gates) {
    console.log(`  ${g.id} [${g.status}] ${g.name}: ${g.current}`);
  }
  console.log(`\n→ ${outputPath}`);
}

function buildNextActions(
  effectDelegate: number,
  enqueueOnly: number,
  topDelegates?: Array<{ keyword: string; cardCount: number }>,
  effectResolution?: ReturnType<typeof measureEffectResolution>,
): string[] {
  const actions: string[] = [];
  if (
    effectResolution &&
    (effectResolution.markersRematchUnresolved > 0 || effectResolution.rematchCoverageUnresolved > 0)
  ) {
    const sample = effectResolution.topUnresolvedSamples[0];
    actions.push(
      sample
        ? `G3.5: extractEffects PATTERNS 追加（例: ${sample.cardId}/${sample.effectId}）`
        : "G3.5: extractEffects.ts に PATTERNS 追加",
    );
  }
  if (effectDelegate > 0) {
    const top = topDelegates?.[0];
    actions.push(
      top
        ? `extractEffects.ts にパターン追加（優先: ${top.keyword}, ${top.cardCount} 枚）`
        : "extractEffects.ts に PATTERNS 追加",
    );
    actions.push("npm run remigrate-stub-effects -w @rangers-strike/cards");
  }
  if (enqueueOnly > 0) {
    actions.push("npm run remigrate-enqueue-effects -w @rangers-strike/cards");
  }
  actions.push("npm run pipeline:rollout-sync -w @rangers-strike/cards");
  actions.push("npm run test -w @rangers-strike/engine");
  return actions;
}

main();
