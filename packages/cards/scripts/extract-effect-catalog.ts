import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCoreRegistryUnitEffects } from "./shared/registryUnitEffects";
import { isOperationImplemented } from "../src/operationCatalog";
import { isUnitEffectImplemented } from "../src/unitEffectCatalog";
import {
  EFFECT_PATTERN_CATALOG,
  matchEffectPatterns,
  type EffectPatternEntry,
} from "../src/pipeline/effectPatternCatalog";
import { dedupeEffectTexts, splitEffectSegments } from "../src/pipeline/parseWiki";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = join(__dirname, "../../../docs/wiki/cards");
const OUT_PATH = join(__dirname, "../../../docs/architecture/effect_catalog.md");

type CatalogRow = {
  id: string;
  name: string;
  description: string;
  cardIds: Set<string>;
  sources: Set<"wiki_pattern" | "unit_effects" | "unnamed_rule">;
  primitiveReady: boolean;
  implemented: boolean;
};

const UNIT_EFFECTS = loadCoreRegistryUnitEffects();

type UnitEffectBlock = {
  rawText?: string;
  namedEffects?: Array<{ name: string; text: string; effectId: string }>;
  unnamedText?: Array<{ text: string; rule?: string }>;
};

function extractWikiEffectTexts(content: string): string[] {
  const texts: string[] = [];
  const re =
    /(?:^|\n)(?:atwiki 効果文|効果文[^:\n]*):\s*\n> (.+?)(?=\n\n|\natwiki ステータス|\n## |\nconfidence:|\n発動条件:)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const t = m[1].replace(/\n> /g, "\n").trim();
    if (
      t &&
      !t.includes("atwiki 未取得") &&
      t !== "—" &&
      t !== "UNKNOWN" &&
      !t.includes("cards.jsonに効果文未収録")
    ) {
      texts.push(t.replace(/\s+/g, " ").trim());
    }
  }
  return dedupeEffectTexts([...new Set(texts)]);
}

function isEffectImplemented(effectId: string): boolean {
  return isOperationImplemented(effectId) || isUnitEffectImplemented(effectId);
}

function getOrCreate(
  map: Map<string, CatalogRow>,
  entry: EffectPatternEntry,
): CatalogRow {
  let row = map.get(entry.id);
  if (!row) {
    row = {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      cardIds: new Set(),
      sources: new Set(),
      primitiveReady: entry.primitiveReady,
      implemented: entry.implemented ?? isEffectImplemented(entry.id),
    };
    map.set(entry.id, row);
  }
  return row;
}

function inferPriority(row: CatalogRow): string {
  const n = row.cardIds.size;
  if (row.implemented) return "Done（実装済）";
  if (!row.primitiveReady) {
    if (n >= 10) return "P1（高）— 複雑だが使用多数";
    if (n >= 3) return "P2（中）— 複雑";
    return "P3（低）— 複雑・少数";
  }
  if (n >= 20) return "P0（最優先）";
  if (n >= 8) return "P1（高）";
  if (n >= 3) return "P2（中）";
  return "P3（低）";
}

function analyzeWikiCards(map: Map<string, CatalogRow>): { total: number; withText: number } {
  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  let withText = 0;

  for (const file of files) {
    const cardId = file.replace(/\.md$/, "");
    const content = readFileSync(join(WIKI_DIR, file), "utf8");
    const texts = extractWikiEffectTexts(content);
    if (texts.length === 0) continue;
    withText += 1;

    const segments = texts.flatMap(splitEffectSegments);
    const bodies = segments.map((s) => (s.kind === "named" ? `【${s.name}】${s.body}` : s.body));

    const matchedForCard = new Set<string>();
    for (const body of bodies) {
      for (const patternId of matchEffectPatterns(body)) {
        matchedForCard.add(patternId);
      }
    }

    for (const patternId of matchedForCard) {
      const entry = EFFECT_PATTERN_CATALOG.find((e) => e.id === patternId)!;
      const row = getOrCreate(map, entry);
      row.cardIds.add(cardId);
      row.sources.add("wiki_pattern");
      row.implemented = row.implemented || isEffectImplemented(patternId);
    }
  }

  return { total: files.length, withText };
}

function analyzeUnitEffects(map: Map<string, CatalogRow>): void {
  const UNNAMED_RULE_MAP: Record<string, string> = {
    destroy_self_damage: "destroy_self_damage",
    auto_battle_entry_each_turn: "auto_battle_entry",
    fusion_material_alias: "alias_fusion_material",
    command_hold_required: "require_command_hold_entry",
  };

  for (const [cardId, block] of Object.entries(UNIT_EFFECTS)) {
    for (const named of block.namedEffects ?? []) {
      const pattern =
        EFFECT_PATTERN_CATALOG.find((e) => e.id === named.effectId) ??
        ({
          id: named.effectId,
          name: named.name,
          description: named.text.slice(0, 80),
          test: /.*/,
          primitiveReady: isEffectImplemented(named.effectId),
          implemented: isEffectImplemented(named.effectId),
        } as EffectPatternEntry);

      const row = getOrCreate(map, pattern);
      row.name = named.name || row.name;
      if (named.text) row.description = named.text.slice(0, 120);
      row.cardIds.add(cardId);
      row.sources.add("unit_effects");
      row.implemented = isEffectImplemented(named.effectId);
      row.primitiveReady = row.primitiveReady || isEffectImplemented(named.effectId);
    }

    for (const unnamed of block.unnamedText ?? []) {
      const ruleId = unnamed.rule ? UNNAMED_RULE_MAP[unnamed.rule] : undefined;
      const patternIds = ruleId ? [ruleId] : matchEffectPatterns(unnamed.text);
      for (const pid of patternIds) {
        const entry = EFFECT_PATTERN_CATALOG.find((e) => e.id === pid);
        if (!entry) continue;
        const row = getOrCreate(map, entry);
        row.cardIds.add(cardId);
        row.sources.add("unnamed_rule");
      }
    }
  }
}

function renderMarkdown(
  rows: CatalogRow[],
  stats: { wikiTotal: number; wikiWithText: number; uniqueEffects: number },
): string {
  const sorted = [...rows].sort((a, b) => {
    const pri = (r: CatalogRow) => {
      const p = inferPriority(r);
      if (p.startsWith("P0")) return 0;
      if (p.startsWith("P1")) return 1;
      if (p.startsWith("P2")) return 2;
      if (p.startsWith("P3")) return 3;
      return 4;
    };
    const d = pri(a) - pri(b);
    if (d !== 0) return d;
    return b.cardIds.size - a.cardIds.size;
  });

  const lines: string[] = [
    "# 共通 Effect カタログ",
    "",
    "**生成:** `npm run extract-effect-catalog -w @rangers-strike/cards`",
    `**日付:** ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## サマリー",
    "",
    "| 指標 | 値 |",
    "|------|-----|",
    `| Wiki カード総数 | ${stats.wikiTotal} |`,
    `| 効果文あり | ${stats.wikiWithText} |`,
    `| 共通 Effect 候補 | ${stats.uniqueEffects} |`,
    `| 実装済み | ${sorted.filter((r) => r.implemented).length} |`,
    `| 未実装（P0–P3） | ${sorted.filter((r) => !r.implemented).length} |`,
    "",
    "## 優先度の基準",
    "",
    "| 優先度 | 条件 |",
    "|--------|------|",
    "| **P0（最優先）** | 未実装・primitive 対応可・使用カード ≥20 |",
    "| **P1（高）** | 未実装・使用カード ≥8、または複雑だが ≥10 |",
    "| **P2（中）** | 未実装・使用カード 3–7 |",
    "| **P3（低）** | 未実装・1–2枚、または裁定依存 |",
    "| **Done** | エンジン TS ハンドラ実装済み |",
    "",
    "## Effect 一覧",
    "",
    "| Effect名 | ID | 説明 | 使用カード数 | primitive | 実装 | 優先度 |",
    "|----------|-----|------|-------------|-----------|------|--------|",
  ];

  for (const row of sorted) {
    const pri = inferPriority(row);
    const impl = row.implemented ? "済" : "未";
    const prim = row.primitiveReady ? "可" : "要TS";
    lines.push(
      `| ${row.name} | \`${row.id}\` | ${row.description.replace(/\|/g, "\\|")} | ${row.cardIds.size} | ${prim} | ${impl} | ${pri} |`,
    );
  }

  lines.push(
    "",
    "## P0–P1 未実装（実装ロードマップ候補）",
    "",
  );

  const roadmap = sorted.filter(
    (r) => !r.implemented && (inferPriority(r).startsWith("P0") || inferPriority(r).startsWith("P1")),
  );
  if (roadmap.length === 0) {
    lines.push("_該当なし_");
  } else {
    for (const row of roadmap) {
      lines.push(
        `- **${row.name}** (\`${row.id}\`) — ${row.cardIds.size}枚 — ${row.description}`,
      );
    }
  }

  lines.push(
    "",
    "## 注記",
    "",
    "- **パターン行**（`grant_sp`, `bp_boost` 等）は Wiki 全文スキャンによる共通構文の出現回数",
    "- **固有 effectId 行**（`future_sight`, `red_fire` 等）は registry の named 効果",
    "- 同一カードが複数パターンに該当する場合があり、枚数の合計はカード総数を超えうる",
    "",
    "## データソース",
    "",
    "- Wiki: `docs/wiki/cards/*.md` 効果文パターンマッチ",
    "- `loadCoreRegistryUnitEffects()`（Legend 1–3 コア）の `namedEffects` / `unnamedText`",
    "- 実装状態: `unitEffectCatalog.ts` / `operationCatalog.ts`",
    "",
  );

  return lines.join("\n");
}

function main(): void {
  const map = new Map<string, CatalogRow>();
  const wikiStats = analyzeWikiCards(map);
  analyzeUnitEffects(map);

  const rows = [...map.values()];
  const md = renderMarkdown(rows, {
    wikiTotal: wikiStats.total,
    wikiWithText: wikiStats.withText,
    uniqueEffects: rows.length,
  });

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, md);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Effects: ${rows.length} | Wiki with text: ${wikiStats.withText}/${wikiStats.total}`);
  const p0 = rows.filter((r) => inferPriority(r).startsWith("P0") && !r.implemented);
  console.log(`P0 unimplemented: ${p0.length}`);
}

main();
