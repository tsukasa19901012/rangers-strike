/**
 * runtime_* デリゲートの監査（M7 — Legacy TS 除去の進捗可視化）。
 *
 * Usage:
 *   npm run audit:runtime-delegates
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dispatchPath = join(
  root,
  "../engine/src/dsl/runtimeEffectDispatch.ts",
);
const outputPath = join(root, "pipeline/data/runtime-delegate-audit.json");

type AuditEntry = {
  delegate: string;
  condition: string;
  category: "operation" | "nc" | "enter_battle" | "on_rush" | "fallback";
};

const DELEGATE_PATTERNS: Array<{
  pattern: RegExp;
  delegate: string;
  category: AuditEntry["category"];
  condition: string;
}> = [
  {
    pattern: /resolveOperationEffect\(/,
    delegate: "resolveOperationEffect",
    category: "operation",
    condition: "opMeta.effectId matches && operationInstanceId",
  },
  {
    pattern: /applyLegacyNumberComboEffect\(/,
    delegate: "applyLegacyNumberComboEffect",
    category: "nc",
    condition: "nc trigger effect id match",
  },
  {
    pattern: /resolveLegend2EnterBattle\(/,
    delegate: "resolveLegend2EnterBattle",
    category: "enter_battle",
    condition: "LEGEND2_ENTER_BATTLE set",
  },
  {
    pattern: /resolveLegend3EnterBattle\(/,
    delegate: "resolveLegend3EnterBattle",
    category: "enter_battle",
    condition: "isLegend3EnterBattleEffect",
  },
  {
    pattern: /resolveNamedOnRushEffects\(/,
    delegate: "resolveNamedOnRushEffects",
    category: "on_rush",
    condition: "rushNamed effectId match",
  },
];

function main(): void {
  const source = readFileSync(dispatchPath, "utf8");
  const fnMatch = source.match(
    /export function applyRuntimeGrantKeyword[\s\S]*?^}/m,
  );
  const fnBody = fnMatch?.[0] ?? source;

  const entries: AuditEntry[] = DELEGATE_PATTERNS.filter((p) =>
    p.pattern.test(fnBody),
  ).map((p) => ({
    delegate: p.delegate,
    condition: p.condition,
    category: p.category,
  }));

  if (!fnBody.includes("return { state, detail: `runtime:")) {
    entries.push({
      delegate: "noop",
      condition: "unmatched effectId",
      category: "fallback",
    });
  }

  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: "packages/engine/src/dsl/runtimeEffectDispatch.ts",
    entryPoint: "applyRuntimeGrantKeyword",
    legacyDelegatePaths: entries.length,
    byCategory,
    entries,
    note: "Playable 179 cards route through runtime_* keywords; replace each delegate with native interpreter primitives incrementally.",
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ legacyDelegatePaths: entries.length, byCategory }, null, 2),
  );
  console.log(`→ ${outputPath}`);
}

main();
