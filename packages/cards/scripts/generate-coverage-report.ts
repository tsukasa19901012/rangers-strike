/**
 * 全カード（1,849 枚）の実装カバレッジレポートを生成する。
 *
 * Usage:
 *   npx tsx packages/cards/scripts/generate-coverage-report.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCardById } from "../src/catalog";
import { loadAllCardDocuments, loadFullPlayableDocuments } from "../src/dsl/loader";
import { createFullPlayableRegistry } from "../src/dsl/registry";
import type { CardDocument, EffectDefinition, EffectPrimitive } from "../src/dsl/types";
import { fullPlayableCatalog } from "../src/extendedCatalog";
import { isOperationImplemented } from "../src/operationCatalog";
import { isUnitEffectImplemented } from "../src/unitEffectCatalog";
import {
  classifyRuntimeRematch,
  isUnresolvedRematchPrimitives,
} from "../src/pipeline/measureEffectResolution";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const outputPath = join(repoRoot, "coverage-report.md");

type DisplayCategory =
  | "Unit"
  | "Operation"
  | "Counter"
  | "Commander"
  | "Vehicle"
  | "Megazord";

type CardStatus = "implemented" | "partial" | "unimplemented";
type EffectStatus = "implemented" | "partial" | "unimplemented";

type CategoryBucket = {
  total: number;
  implemented: number;
  partial: number;
  unimplemented: number;
};

type EffectBucket = {
  effectId: string;
  status: EffectStatus;
  cardCount: number;
  sampleCardIds: string[];
  reason: string;
};

function emptyBucket(): CategoryBucket {
  return { total: 0, implemented: 0, partial: 0, unimplemented: 0 };
}

function isZordPowerCost(powerCost: CardDocument["powerCost"]): boolean {
  const s = String(powerCost);
  return s.endsWith("+") || s.endsWith("-");
}

function isCounterOperation(card: CardDocument): boolean {
  if (card.type !== "operation") return false;
  const fromEffects = (card.effects ?? []).some(
    (e) => e.trigger.type === "operation" && e.trigger.timing === "counter",
  );
  if (fromEffects) return true;
  const text = card.text ?? "";
  return /※カウンター|カウンター（これは敵軍ターン/.test(text);
}

export function getDisplayCategory(card: CardDocument): DisplayCategory {
  if (card.type === "commander") return "Commander";
  if (card.type === "vehicle") return "Vehicle";
  if (card.type === "operation") {
    return isCounterOperation(card) ? "Counter" : "Operation";
  }
  if (card.type === "unit" && isZordPowerCost(card.powerCost)) return "Megazord";
  return "Unit";
}

function hasBridgePrimitives(primitives: EffectPrimitive[]): boolean {
  return primitives.some(
    (p) =>
      p.type === "fallback_handler" ||
      p.type === "enqueue_trigger" ||
      (p.type === "grant_keyword" && p.keyword.startsWith("effect_")),
  );
}

function isLegacyEffectImplemented(effectId: string): boolean {
  return isOperationImplemented(effectId) || isUnitEffectImplemented(effectId);
}

function classifyEffect(effect: EffectDefinition, card: CardDocument): EffectStatus {
  const handler = card.implementation?.handler ?? "unimplemented";
  if (handler === "unimplemented") return "unimplemented";

  if (isLegacyEffectImplemented(effect.id)) return "implemented";

  const primitives = effect.effects;
  if (hasBridgePrimitives(primitives)) return "partial";

  if (
    getCardById(card.id) &&
    handler === "interpreter" &&
    primitives.some((p) => p.type === "interpret_effect")
  ) {
    return "implemented";
  }

  if (primitives.some((p) => p.type === "interpret_effect")) {
    const rematch = classifyRuntimeRematch(effect);
    if (rematch === "strict_unresolved") return "unimplemented";
    if (rematch === "catchall_fallback") return "partial";
    return "implemented";
  }

  if (isUnresolvedRematchPrimitives(primitives)) return "partial";

  const text = (effect.text ?? "").trim();
  if (text.length === 0) return "implemented";

  const rematch = classifyRuntimeRematch(effect);
  if (rematch === "strict_unresolved") return "unimplemented";
  if (rematch === "catchall_fallback") return "partial";
  return "implemented";
}

function classifyCard(card: CardDocument): CardStatus {
  const handler = card.implementation?.handler ?? "unimplemented";
  if (handler === "unimplemented") return "unimplemented";
  if (handler === "typescript") return "partial";

  const effects = card.effects ?? [];
  if (effects.length === 0) {
    return handler === "interpreter" ? "implemented" : "partial";
  }

  let worst: CardStatus = "implemented";
  for (const effect of effects) {
    const status = classifyEffect(effect, card);
    if (status === "unimplemented") return "unimplemented";
    if (status === "partial") worst = "partial";
  }
  return worst;
}

function cardStatusReason(card: CardDocument, status: CardStatus): string {
  const handler = card.implementation?.handler ?? "unimplemented";
  if (status === "unimplemented") return `handler=${handler}`;
  if (status === "partial" && handler === "typescript") return "legacy typescript handler";
  const effects = card.effects ?? [];
  if (effects.some((e) => hasBridgePrimitives(e.effects))) return "bridge primitive (enqueue/fallback/effect_*)";
  if (effects.some((e) => classifyRuntimeRematch(e) === "catchall_fallback")) {
    return "catchall_interpret fallback";
  }
  if (getCardById(card.id)) return "core + DSL interpreter";
  return "DSL interpreter";
}

function effectStatusReason(effect: EffectDefinition, card: CardDocument, status: EffectStatus): string {
  if (status === "implemented") return "resolved via DSL / legacy handler";
  if (hasBridgePrimitives(effect.effects)) return "bridge primitive";
  const rematch = classifyRuntimeRematch(effect);
  if (rematch === "catchall_fallback") return "catchall_interpret";
  if (rematch === "strict_unresolved") return "strict_unresolved rematch";
  if ((card.implementation?.handler ?? "unimplemented") === "unimplemented") return "card unimplemented";
  return "partial resolution";
}

function statusPriority(status: CardStatus | EffectStatus): number {
  if (status === "unimplemented") return 0;
  if (status === "partial") return 1;
  return 2;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function main(): void {
  const registry = createFullPlayableRegistry();
  const docs = loadFullPlayableDocuments();
  const coreIds = new Set(loadAllCardDocuments().map((c) => c.id));

  const categories: Record<DisplayCategory, CategoryBucket> = {
    Unit: emptyBucket(),
    Operation: emptyBucket(),
    Counter: emptyBucket(),
    Commander: emptyBucket(),
    Vehicle: emptyBucket(),
    Megazord: emptyBucket(),
  };

  const cardRows: Array<{
    id: string;
    name: string;
    category: DisplayCategory;
    status: CardStatus;
    reason: string;
    tier: "core" | "promoted";
  }> = [];

  const effectMap = new Map<string, EffectBucket>();

  for (const card of docs) {
    const category = getDisplayCategory(card);
    const status = classifyCard(card);
    const bucket = categories[category];
    bucket.total += 1;
    bucket[status] += 1;

    cardRows.push({
      id: card.id,
      name: card.name,
      category,
      status,
      reason: cardStatusReason(card, status),
      tier: coreIds.has(card.id) ? "core" : "promoted",
    });

    for (const effect of card.effects ?? []) {
      const effectStatus = classifyEffect(effect, card);
      const existing = effectMap.get(effect.id);
      if (!existing) {
        effectMap.set(effect.id, {
          effectId: effect.id,
          status: effectStatus,
          cardCount: 1,
          sampleCardIds: [card.id],
          reason: effectStatusReason(effect, card, effectStatus),
        });
        continue;
      }
      existing.cardCount += 1;
      if (existing.sampleCardIds.length < 5 && !existing.sampleCardIds.includes(card.id)) {
        existing.sampleCardIds.push(card.id);
      }
      if (statusPriority(effectStatus) < statusPriority(existing.status)) {
        existing.status = effectStatus;
        existing.reason = effectStatusReason(effect, card, effectStatus);
      }
    }
  }

  const total = fullPlayableCatalog.cards.length;
  const implemented = cardRows.filter((r) => r.status === "implemented").length;
  const partial = cardRows.filter((r) => r.status === "partial").length;
  const unimplemented = cardRows.filter((r) => r.status === "unimplemented").length;

  const registrySnap = registry.snapshot();
  const effectRows = [...effectMap.values()].sort((a, b) => {
    const p = statusPriority(a.status) - statusPriority(b.status);
    if (p !== 0) return p;
    return b.cardCount - a.cardCount;
  });

  const implementedEffects = effectRows.filter((e) => e.status === "implemented");
  const partialEffects = effectRows.filter((e) => e.status === "partial");
  const unimplementedEffects = effectRows.filter((e) => e.status === "unimplemented");

  const priorityCards = [...cardRows]
    .filter((r) => r.status !== "implemented")
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || a.id.localeCompare(b.id));

  const lines: string[] = [
    "# カード実装カバレッジレポート",
    "",
    `生成日時: ${new Date().toISOString()}`,
    "",
    "## サマリー",
    "",
    "| 指標 | 件数 | 割合 |",
    "|------|------|------|",
    `| 総カード数 | ${total} | 100% |`,
    `| 実装済み | ${implemented} | ${pct(implemented, total)} |`,
    `| 部分実装 | ${partial} | ${pct(partial, total)} |`,
    `| 未実装 | ${unimplemented} | ${pct(unimplemented, total)} |`,
    "",
    "### レジストリ参考値",
    "",
    `- DSL interpreter: ${registrySnap.dslReady.length}`,
    `- legacy handler: ${registrySnap.legacyHandler.length}`,
    `- unimplemented handler: ${registrySnap.unimplemented.length}`,
    `- core: ${coreIds.size} / promoted: ${total - coreIds.size}`,
    "",
    "## カテゴリ別",
    "",
    "| カテゴリ | 総数 | 実装済み | 部分実装 | 未実装 | 実装率 |",
    "|----------|------|----------|----------|--------|--------|",
  ];

  const categoryOrder: DisplayCategory[] = [
    "Unit",
    "Operation",
    "Counter",
    "Commander",
    "Vehicle",
    "Megazord",
  ];

  for (const cat of categoryOrder) {
    const b = categories[cat];
    lines.push(
      `| ${cat} | ${b.total} | ${b.implemented} | ${b.partial} | ${b.unimplemented} | ${pct(b.implemented, b.total)} |`,
    );
  }

  lines.push(
    "",
    "## Effect 別",
    "",
    "| 指標 | 件数 |",
    "|------|------|",
    `| ユニーク effect ID | ${effectRows.length} |`,
    `| 実装済み effect | ${implementedEffects.length} |`,
    `| 部分実装 effect | ${partialEffects.length} |`,
    `| 未実装 effect | ${unimplementedEffects.length} |`,
    "",
    "### 優先度: 未実装 effect（カード数降順）",
    "",
  );

  if (unimplementedEffects.length === 0) {
    lines.push("_なし_");
  } else {
    lines.push("| effect ID | カード数 | サンプル | 理由 |");
    lines.push("|-----------|----------|----------|------|");
    for (const e of unimplementedEffects.sort((a, b) => b.cardCount - a.cardCount)) {
      lines.push(
        `| \`${e.effectId}\` | ${e.cardCount} | ${e.sampleCardIds.join(", ")} | ${e.reason} |`,
      );
    }
  }

  lines.push("", "### 優先度: 部分実装 effect（カード数降順、上位 30）", "");

  if (partialEffects.length === 0) {
    lines.push("_なし_");
  } else {
    lines.push("| effect ID | カード数 | サンプル | 理由 |");
    lines.push("|-----------|----------|----------|------|");
    for (const e of partialEffects.sort((a, b) => b.cardCount - a.cardCount).slice(0, 30)) {
      lines.push(
        `| \`${e.effectId}\` | ${e.cardCount} | ${e.sampleCardIds.join(", ")} | ${e.reason} |`,
      );
    }
    if (partialEffects.length > 30) {
      lines.push("", `_他 ${partialEffects.length - 30} 件（省略）_`);
    }
  }

  lines.push("", "### 実装済み effect（カード数降順、上位 20）", "");
  lines.push("| effect ID | カード数 | サンプル |");
  lines.push("|-----------|----------|----------|");
  for (const e of implementedEffects.sort((a, b) => b.cardCount - a.cardCount).slice(0, 20)) {
    lines.push(`| \`${e.effectId}\` | ${e.cardCount} | ${e.sampleCardIds.join(", ")} |`);
  }
  if (implementedEffects.length > 20) {
    lines.push("", `_他 ${implementedEffects.length - 20} 件（省略）_`);
  }

  lines.push("", "## 優先度: 要対応カード", "");
  if (priorityCards.length === 0) {
    lines.push("_全カード実装済み_");
  } else {
    lines.push("| 優先 | ID | 名前 | カテゴリ | 状態 | 理由 |");
    lines.push("|------|-----|------|----------|------|------|");
    for (const row of priorityCards) {
      const label = row.status === "unimplemented" ? "P0" : "P1";
      lines.push(
        `| ${label} | ${row.id} | ${row.name} | ${row.category} | ${row.status} | ${row.reason} |`,
      );
    }
  }

  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(`→ ${outputPath}`);
  console.log(
    JSON.stringify({ total, implemented, partial, unimplemented, effects: effectRows.length }, null, 2),
  );
}

main();
