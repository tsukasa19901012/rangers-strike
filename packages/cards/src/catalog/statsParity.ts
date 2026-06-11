import { createHash } from "node:crypto";
import type { CardDefinition } from "../schema";
import type { CardDocument } from "../dsl/types";

/** stats 比較対象（imageUrl は配信パス差分のため除外）。 */
export const STATS_PARITY_FIELDS = [
  "name",
  "type",
  "category",
  "rarity",
  "expansion",
  "powerCost",
  "bp",
  "sp",
  "size",
  "comboNumber",
  "text",
  "rushAdditionalCondition",
  "effectId",
  "tags",
  "features",
] as const;

export type StatsParityField = (typeof STATS_PARITY_FIELDS)[number];

/** emitCoreCatalog / emitPromotedCatalog の enrichFromDsl が DSL から上書きするフィールド。 */
export const EMIT_DSL_ENRICH_FIELDS: readonly StatsParityField[] = [
  "powerCost",
  "rushAdditionalCondition",
  "bp",
  "sp",
  "size",
  "comboNumber",
  "text",
  "features",
];

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value].sort();
  }
  return value ?? null;
}

/** カード stats の正規化スナップショット（parity 比較用）。 */
export function snapshotCardStats(card: CardDefinition): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of STATS_PARITY_FIELDS) {
    snapshot[field] = normalizeValue(card[field as keyof CardDefinition]);
  }
  return snapshot;
}

export type StatsDiff = {
  field: StatsParityField;
  left: unknown;
  right: unknown;
};

export function diffCardStats(
  left: CardDefinition,
  right: CardDefinition,
  options?: { exclude?: StatsParityField[]; only?: readonly StatsParityField[] },
): StatsDiff[] {
  const exclude = new Set(options?.exclude ?? []);
  const fields = options?.only ?? STATS_PARITY_FIELDS;
  const diffs: StatsDiff[] = [];
  for (const field of fields) {
    if (exclude.has(field)) continue;
    const leftValue = normalizeValue(left[field as keyof CardDefinition]);
    const rightValue = normalizeValue(right[field as keyof CardDefinition]);
    if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
      diffs.push({ field, left: leftValue, right: rightValue });
    }
  }
  return diffs;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/** CardDocument の effects / unnamedRules フィンガープリント（loader parity 用）。 */
export function fingerprintCardDocument(doc: CardDocument): string {
  const payload = {
    implementation: doc.implementation ?? null,
    effects: doc.effects ?? null,
    unnamedRules: doc.unnamedRules ?? null,
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex").slice(0, 16);
}

export function fingerprintCardDocuments(docs: CardDocument[]): string {
  const entries = [...docs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((doc) => `${doc.id}:${fingerprintCardDocument(doc)}`);
  return createHash("sha256").update(entries.join("\n")).digest("hex");
}
