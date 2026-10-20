/**
 * 特徴名 slug の修復: 漢字を含む特徴（「航空機」「警察」「女」など）が `fx_unknown` や
 * 欠けたローマ字（魔皇力 → `ma_chikara`）に潰れていた grant_keyword / effect id を、
 * 可逆な `featureKeywordSlug`（`named_<utf8 hex>`）へ置き換える。
 *
 * 置換候補は、効果テキストの 特徴「X」 から旧 slug（slugifyEffectId）→ 新 slug を作り、
 * パイプライン（rematchExtractedEffect）が同じキーワードを生成することを確認したものだけ適用する。
 * ファイルは該当文字列だけを書き換える（整形・他フィールドは不変）。
 *
 * Usage:
 *   npx tsx scripts/repair-feature-slug-keywords.ts [--dry-run]
 *   node scripts/bundle-dsl-overlays.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../src/dsl/types";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";
import { featureKeywordSlug } from "../src/pipeline/featureSlug";
import { slugifyEffectId } from "../src/pipeline/metaMaps";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const DIRS = [join(root, "src/generated/dsl-stubs"), join(root, "src/dsl/generated")];
const dryRun = process.argv.includes("--dry-run");

function collectKeywords(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectKeywords(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "keyword" && typeof v === "string") out.push(v);
      else collectKeywords(v, out);
    }
  }
  return out;
}

function replaceToken(text: string, from: string, to: string): string {
  const re = new RegExp(`(^|_)${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=_|$)`, "g");
  return text.replace(re, (_m, pre: string) => `${pre}${to}`);
}

const unverified: string[] = [];
let filesChanged = 0;
const changes: string[] = [];

for (const dir of DIRS) {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dir, file);
    let raw = readFileSync(path, "utf8");
    const doc = JSON.parse(raw) as CardDocument;
    const replacements = new Map<string, string>();

    for (const effect of doc.effects ?? []) {
      const text = effect.text ?? "";
      const features = [...text.matchAll(/特徴に?「([^」]+)」/g)].map((m) => m[1]!);
      if (features.length === 0) continue;
      const slugPairs = features
        .map((f) => [slugifyEffectId(f), featureKeywordSlug(f)] as const)
        .filter(([a, b]) => a !== b);
      if (slugPairs.length === 0) continue;

      let rematchedKeywords: Set<string> | null = null;
      let rematchedId: string | undefined;
      const rematch = () => {
        if (rematchedKeywords) return;
        const built = rematchExtractedEffect(text, {
          name: effect.name,
          kind: text.startsWith("※") ? "note" : effect.name ? "named" : "body",
          trigger: effect.trigger,
          cardId: doc.id,
        });
        rematchedKeywords = new Set(collectKeywords(built?.effects ?? []));
        rematchedId = built?.id;
      };

      const candidates = [...new Set([...collectKeywords(effect.effects), effect.id])];
      for (const original of candidates) {
        let next = original;
        for (const [from, to] of slugPairs) next = replaceToken(next, from, to);
        if (next === original) continue;
        rematch();
        if (rematchedKeywords!.has(next) || rematchedId === next) {
          replacements.set(original, next);
        } else {
          unverified.push(`${file}: ${original} -> ${next}`);
        }
      }
    }

    if (replacements.size === 0) continue;
    for (const [from, to] of replacements) {
      raw = raw.split(`"${from}"`).join(`"${to}"`);
      changes.push(`${doc.id}: ${from} -> ${to}`);
    }
    filesChanged += 1;
    if (!dryRun) writeFileSync(path, raw);
  }
}

console.log([...new Set(changes)].sort().join("\n"));
if (unverified.length) console.log(`\nunverified (not applied):\n${unverified.join("\n")}`);
console.log(`\nfiles changed: ${filesChanged}${dryRun ? " (dry run)" : ""}`);
