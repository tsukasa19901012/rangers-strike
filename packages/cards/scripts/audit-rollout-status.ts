/**
 * 全カード反映ゲート（G0–G4）の進捗を集約する。
 *
 * Usage:
 *   npm run audit:rollout-status
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "../src/dsl/registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "pipeline/data");
const outputPath = join(dataDir, "rollout-status.json");

const TARGET_PLAYABLE = 1849;

type GateStatus = "pass" | "fail" | "partial" | "unknown";

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

function main(): void {
  const registry = createFullPlayableRegistry();
  const metrics = snapshotFullPlayableRegistryMetrics(registry);

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
      id: "G4",
      name: "対戦検証",
      status: "unknown",
      target: "vertical slice apply_failed=0",
      current: "npm run test -w @rangers-strike/engine -- src/verticalSlice/",
      note: "手動または CI で確認",
    },
    {
      id: "G5",
      name: "プロダクト接続",
      status: "unknown",
      target: "Web GameApp full-playable",
      current: "未接続",
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
    gates,
    nextActions: buildNextActions(effectDelegate, enqueueOnly, keywordCoverage?.topEffectDelegate),
    docs: "docs/architecture/full-card-rollout-process.md",
  };

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(JSON.stringify(report.baseline, null, 2));
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
): string[] {
  const actions: string[] = [];
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
