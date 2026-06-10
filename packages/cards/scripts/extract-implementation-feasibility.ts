import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import legend1UnitEffects from "../src/legend1/unitEffects.json";
import legend2UnitEffects from "../src/legend2/unitEffects.json";
import legend3UnitEffects from "../src/legend3/unitEffects.json";
import { NUMBER_COMBO_EFFECTS } from "../src/comboEffects";
import { getCardEffect } from "../src/effects";
import { isOperationImplemented } from "../src/operationCatalog";
import { isUnitEffectImplemented } from "../src/unitEffectCatalog";
import { matchEffectPatterns } from "../src/pipeline/effectPatternCatalog";
import { matchRulingPatterns, pickPrimaryCategory } from "../src/pipeline/rulingCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLASSIFICATION_PATH = join(__dirname, "../pipeline/data/card-classification.json");
const OUT_MD = join(__dirname, "../../../docs/architecture/implementation-feasibility.md");
const OUT_JSON = join(__dirname, "../pipeline/data/implementation-feasibility.json");

type AbcdeGrade = "A" | "B" | "C" | "D" | "E";
type FeasibilityTier = "A" | "B" | "C";

type ClassifiedCard = {
  id: string;
  grade: AbcdeGrade;
  reasons: string[];
  effectTexts: string[];
};

type FeasibilityResult = {
  id: string;
  tier: FeasibilityTier;
  reason: string;
  abcde: AbcdeGrade;
  implemented: boolean;
};

const UNIT_EFFECTS = {
  ...(legend1UnitEffects as Record<string, UnitEffectBlock>),
  ...(legend2UnitEffects as Record<string, UnitEffectBlock>),
  ...(legend3UnitEffects as Record<string, UnitEffectBlock>),
};

type UnitEffectBlock = {
  namedEffects?: Array<{ effectId: string }>;
};

/** エンジン本体改修が必要なキーワード・裁定（未実装モジュール） */
const ENGINE_RE = [
  /次の効果から1つ選び/,
  /ゲーム開始時/,
  /コマンダーゾーン|コマンダーカード/,
  /コピーして|コピーする/,
  /デッキを.{0,10}枚.{0,8}増やす/,
  /母艦|モノシップ|ゾードアップ/,
  /レジスト/,
  /ウイング/,
  /チェイス/,
  /ジョイントコンボ|ライディングコンボ/,
  /コンビネーションナンバー.{0,15}(すべて|全て).{0,8}(少なく|１少なく|1少なく)/,
  /常駐オペレーションは無効になり/,
];

const ENGINE_PATTERN_IDS = new Set([
  "wing",
  "chase",
  "register",
  "joint_riding_combo",
  "mothership_zord",
  "commander_zone",
  "card_copy",
  "deck_resize",
  "mode_choice",
  "game_start",
  "cn_count_modify",
  "disable_resident_ops",
]);

function isCardImplemented(cardId: string): boolean {
  const op = getCardEffect(cardId);
  if (op && isOperationImplemented(op.effectId)) return true;

  if (NUMBER_COMBO_EFFECTS[cardId]) return true;

  const block = UNIT_EFFECTS[cardId];
  if (block) {
    for (const named of block.namedEffects ?? []) {
      if (isUnitEffectImplemented(named.effectId)) return true;
    }
  }
  return false;
}

function combinedText(card: ClassifiedCard): string {
  return card.effectTexts.join(" ");
}

function needsEngineRewrite(card: ClassifiedCard): string | null {
  if (card.grade === "E") return "abcde_E";

  const text = combinedText(card);
  if (ENGINE_RE.some((re) => re.test(text))) return "engine_pattern_text";

  const rulingHits = matchRulingPatterns(text);
  if (rulingHits.some((h) => ENGINE_PATTERN_IDS.has(h.patternId))) {
    return `ruling:${rulingHits.find((h) => ENGINE_PATTERN_IDS.has(h.patternId))!.patternId}`;
  }

  const primary = pickPrimaryCategory(new Set(rulingHits.map((h) => h.category)));
  if (primary === "state_rewrite") return "ruling_state_rewrite";

  if (card.grade === "D") {
    if (/ウイング|チェイス|レジスト|ジョイントコンボ|ライディングコンボ/.test(text)) {
      return "abcde_D_engine_keyword";
    }
  }

  return null;
}

function canAddEffectsOnly(card: ClassifiedCard): boolean {
  if (card.grade === "A") return false;
  if (card.effectTexts.length === 0) return false;

  const text = combinedText(card);
  const effectPatterns = matchEffectPatterns(text);
  const primitiveOnly =
    effectPatterns.length > 0 &&
    effectPatterns.every((id) => {
      const entry = matchEffectPatterns(text);
      return entry.length > 0;
    });

  // ABCDE B は単純 primitive 相当
  if (card.grade === "B") return true;

  // 既知 primitive パターンに一致
  if (primitiveOnly) return true;

  // 中程度・FAQ 裁定は effectId / DSL 追加で対応可能とみなす
  if (card.grade === "C" || card.grade === "D") return true;

  return true;
}

function classifyFeasibility(card: ClassifiedCard): FeasibilityResult {
  const implemented = isCardImplemented(card.id);

  if (implemented) {
    return {
      id: card.id,
      tier: "A",
      reason: "ts_handler_implemented",
      abcde: card.grade,
      implemented: true,
    };
  }

  if (card.grade === "A" || card.effectTexts.length === 0) {
    return {
      id: card.id,
      tier: "A",
      reason: "vanilla_no_effect",
      abcde: card.grade,
      implemented: false,
    };
  }

  const engineReason = needsEngineRewrite(card);
  if (engineReason) {
    return {
      id: card.id,
      tier: "C",
      reason: engineReason,
      abcde: card.grade,
      implemented: false,
    };
  }

  if (canAddEffectsOnly(card)) {
    return {
      id: card.id,
      tier: "B",
      reason: card.grade === "B" ? "simple_effect_pattern" : "effect_handler_or_dsl",
      abcde: card.grade,
      implemented: false,
    };
  }

  return {
    id: card.id,
    tier: "C",
    reason: "unclassified_engine",
    abcde: card.grade,
    implemented: false,
  };
}

function pct(n: number, total: number): string {
  return `${((n / total) * 100).toFixed(1)}%`;
}

function renderMarkdown(
  results: FeasibilityResult[],
  total: number,
): string {
  const counts = { A: 0, B: 0, C: 0 };
  const byAbcde: Record<FeasibilityTier, Record<string, number>> = {
    A: {},
    B: {},
    C: {},
  };
  const reasons: Record<string, number> = {};

  for (const r of results) {
    counts[r.tier] += 1;
    byAbcde[r.tier][r.abcde] = (byAbcde[r.tier][r.abcde] ?? 0) + 1;
    reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  }

  const implCount = results.filter((r) => r.implemented).length;

  const lines = [
    "# 実装可能性分析（A / B / C）",
    "",
    "**生成:** `npm run extract-implementation-feasibility -w @rangers-strike/cards`",
    `**日付:** ${new Date().toISOString().slice(0, 10)}`,
    `**対象:** Wiki 全カード ${total} 枚`,
    "",
    "## 結論",
    "",
    "| 区分 | 意味 | 枚数 | 割合 |",
    "|------|------|------|------|",
    `| **A** そのまま実装可能 | バニラ、または TS 効果ハンドラ接続済み | ${counts.A} | **${pct(counts.A, total)}** |`,
    `| **B** Effect 追加で可能 | 新規 effectId / DSL primitive 追加で対応（エンジン構造は現状のまま） | ${counts.B} | **${pct(counts.B, total)}** |`,
    `| **C** Engine 改修必要 | コマンダー・母艦・ウイング・レジスト等の基盤未実装 | ${counts.C} | **${pct(counts.C, total)}** |`,
    "",
    "```",
    `A ████████████████████ ${pct(counts.A, total)}`,
    `B ████████████████████ ${pct(counts.B, total)}`,
    `C ████████████████████ ${pct(counts.C, total)}`,
    "```",
    "",
    `- うち **TS 実装済み**（A に含む）: ${implCount} 枚 (${pct(implCount, total)})`,
    `- **A+B 合計**（現エンジン拡張のみ）: ${counts.A + counts.B} 枚 (${pct(counts.A + counts.B, total)})`,
    "",
    "## 区分定義",
    "",
    "### A — そのまま実装可能",
    "",
    "- 効果文なし（バニラ）— ステータス・CN のみで対戦可能",
    "- `operationCatalog` / `unitEffectCatalog` / `NUMBER_COMBO_EFFECTS` に接続済み",
    "",
    "### B — Effect 追加で実装可能",
    "",
    "- 既存フェイズ・誘発・`pending*` フローで表現可能",
    "- 新規 `effectId` ハンドラ、または DSL primitive + インタープリタ接続で対応",
    "- ABCDE の B/C 大半、FAQ 依存の D の一部",
    "",
    "### C — Engine 改修必要",
    "",
    "- ABCDE **E**（コマンダー・多段ウィザード・母艦・State 書き換え）",
    "- **ウイング / チェイス / レジスト / JC・RC** キーワード未実装",
    "- `state_rewrite` 裁定（デッキ増減・コピー・コマンダーゾーン等）",
    "",
    "## ABCDE → A/B/C クロス集計",
    "",
    "| 旧区分 | A | B | C | 合計 |",
    "|--------|---|---|---|------|",
  ];

  for (const g of ["A", "B", "C", "D", "E"] as AbcdeGrade[]) {
    const a = byAbcde.A[g] ?? 0;
    const b = byAbcde.B[g] ?? 0;
    const c = byAbcde.C[g] ?? 0;
    lines.push(`| ${g} | ${a} | ${b} | ${c} | ${a + b + c} |`);
  }

  lines.push(
    "",
    "## C 区分の主な理由",
    "",
    "| 理由 | 枚数 |",
    "|------|------|",
  );

  const cReasons = results
    .filter((r) => r.tier === "C")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.reason] = (acc[r.reason] ?? 0) + 1;
      return acc;
    }, {});

  for (const [reason, n] of Object.entries(cReasons).sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${reason}\` | ${n} |`);
  }

  lines.push(
    "",
    "## データソース",
    "",
    "- `pipeline/data/card-classification.json`（ABCDE 区分）",
    "- `unitEffectCatalog.ts` / `operationCatalog.ts` / `comboEffects.ts`（実装済み判定）",
    "- `rulingCatalog.ts` / `effectPatternCatalog.ts`（裁定・Effect パターン）",
    "",
    "## 限界・注意",
    "",
    "- **DSL インタープリタ未接続**のカードは多くが B（Effect 層）— A には TS 接続済みのみカウント",
    "- B の工数は effectId 数に比例。913 枚の C 区分も個別ハンドラで B に落ちる",
    "- 本分析は静的テキスト分類。実装順序は [effect_catalog.md](./effect_catalog.md) の優先度を参照",
    "",
  );

  return lines.join("\n");
}

function main(): void {
  const data = JSON.parse(readFileSync(CLASSIFICATION_PATH, "utf8")) as {
    summary: { total: number };
    cards: ClassifiedCard[];
  };

  const results = data.cards.map(classifyFeasibility);
  const total = data.summary.total;

  const counts = { A: 0, B: 0, C: 0 };
  for (const r of results) counts[r.tier] += 1;

  mkdirSync(dirname(OUT_MD), { recursive: true });
  writeFileSync(OUT_MD, renderMarkdown(results, total));

  const json = {
    generatedAt: new Date().toISOString(),
    total,
    counts,
    percentages: {
      A: Math.round((counts.A / total) * 1000) / 10,
      B: Math.round((counts.B / total) * 1000) / 10,
      C: Math.round((counts.C / total) * 1000) / 10,
    },
    aPlusB: counts.A + counts.B,
    aPlusBPercent: Math.round(((counts.A + counts.B) / total) * 1000) / 10,
    implementedNow: results.filter((r) => r.implemented).length,
    cards: results,
  };
  writeFileSync(OUT_JSON, `${JSON.stringify(json, null, 2)}\n`);

  console.log(`Wrote ${OUT_MD}`);
  console.log(`Total: ${total}`);
  console.log(`A: ${counts.A} (${pct(counts.A, total)})`);
  console.log(`B: ${counts.B} (${pct(counts.B, total)})`);
  console.log(`C: ${counts.C} (${pct(counts.C, total)})`);
  console.log(`A+B: ${counts.A + counts.B} (${pct(counts.A + counts.B, total)})`);
}

main();
