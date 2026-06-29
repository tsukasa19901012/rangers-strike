/**
 * grant_keyword のハッシュスタブ実装状況を監査する。
 *
 * Usage: npx tsx packages/cards/scripts/audit-hash-grant-keywords.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_NATIVE_GRANT_KEYWORDS } from "../src/engineImplementedCatchall";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";
import { isHashGrantKeywordStub } from "../src/pipeline/hashGrantKeywords";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const outPath = join(root, "pipeline/data/hash-grant-keyword-audit.json");

function isHashKeyword(keyword: string): boolean {
  return isHashGrantKeywordStub(keyword);
}

function isStructuredRematch(primitives: Array<{ type: string; keyword?: string }>): boolean {
  return primitives.some(
    (p) =>
      p.type !== "grant_keyword" ||
      (!isHashKeyword(p.keyword ?? "") && p.keyword !== undefined),
  );
}

function main(): void {
  let total = 0;
  let passiveNative = 0;
  let rematchStructured = 0;
  let interpretOnly = 0;
  let stubOnly = 0;
  const byPrefix: Record<string, number> = {};
  const stubSamples: Array<{ cardId: string; effectId: string; keyword: string; name?: string }> = [];

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8"));
    for (const effect of doc.effects ?? []) {
      for (const p of effect.effects ?? []) {
        if (p.type !== "grant_keyword") continue;
        const kw = p.keyword ?? "";
        if (!isHashKeyword(kw)) continue;
        total += 1;
        const prefix = kw.replace(/_[a-f0-9]{6,}$/, "_<hash>").replace(/_[a-f0-9]{12}$/, "_<hash>");
        byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;

        if (ENGINE_NATIVE_GRANT_KEYWORDS.has(kw)) {
          passiveNative += 1;
          continue;
        }

        if (effect.effects.every((x) => x.type === "interpret_effect")) {
          interpretOnly += 1;
          continue;
        }

        const rematched = rematchExtractedEffect(effect.text ?? "", {
          name: effect.name,
          kind: effect.text?.startsWith("※") ? "note" : effect.name ? "named" : "body",
          trigger: effect.trigger,
        });
        if (rematched && isStructuredRematch(rematched.effects)) {
          rematchStructured += 1;
          continue;
        }

        stubOnly += 1;
        if (stubSamples.length < 25) {
          stubSamples.push({
            cardId: doc.id,
            effectId: effect.id,
            keyword: kw,
            name: effect.name,
          });
        }
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalHashGrantKeywords: total,
      engineNativeOrPassive: passiveNative,
      interpretEffectDelegate: interpretOnly,
      rematchWouldResolve: rematchStructured,
      stubOnlyNoRuntime: stubOnly,
      stubOnlyRate: total === 0 ? 0 : stubOnly / total,
    },
    note:
      "stubOnly = grant_keyword ハッシュのみで、エンジン grantKeyword の default 分岐（no-op）に落ちる。note_other_* 等は一部カード ID 別途 TS 実装あり。",
    byPrefix: Object.fromEntries(
      Object.entries(byPrefix).sort((a, b) => b[1] - a[1]).slice(0, 25),
    ),
    stubSamples,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`→ ${outPath}`);
}

main();
