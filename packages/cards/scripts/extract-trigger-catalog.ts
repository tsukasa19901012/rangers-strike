import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import legend1UnitEffects from "../src/legend1/unitEffects.json";
import legend2UnitEffects from "../src/legend2/unitEffects.json";
import legend3UnitEffects from "../src/legend3/unitEffects.json";
import { getCardEffect } from "../src/effects";
import { dedupeEffectTexts, splitEffectSegments } from "../src/pipeline/parseWiki";
import {
  TRIGGER_CATALOG,
  inferWikiTrigger,
  triggerKey,
  type TriggerCatalogEntry,
} from "../src/pipeline/triggerCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = join(__dirname, "../../../docs/wiki/cards");
const OUT_PATH = join(__dirname, "../../../docs/architecture/trigger_catalog.md");

type TriggerStats = {
  entry: TriggerCatalogEntry;
  effectCount: number;
  cardIds: Set<string>;
  sources: Set<"wiki" | "unit_effects" | "operations">;
};

const UNIT_EFFECTS = {
  ...(legend1UnitEffects as Record<string, UnitEffectBlock>),
  ...(legend2UnitEffects as Record<string, UnitEffectBlock>),
  ...(legend3UnitEffects as Record<string, UnitEffectBlock>),
};

type UnitEffectBlock = {
  namedEffects?: Array<{
    name: string;
    text: string;
    effectId: string;
    trigger?: { type: string };
  }>;
  unnamedText?: Array<{ text: string; rule?: string }>;
};

const DSL_TO_ENTRY = new Map<string, TriggerCatalogEntry>();
for (const entry of TRIGGER_CATALOG) {
  DSL_TO_ENTRY.set(triggerKey(entry), entry);
}

function getStatsMap(): Map<string, TriggerStats> {
  const map = new Map<string, TriggerStats>();
  for (const entry of TRIGGER_CATALOG) {
    const key = triggerKey(entry);
    map.set(key, {
      entry,
      effectCount: 0,
      cardIds: new Set(),
      sources: new Set(),
    });
  }
  return map;
}

function addHit(
  map: Map<string, TriggerStats>,
  key: string,
  cardId: string,
  source: TriggerStats["sources"] extends Set<infer S> ? S : never,
  effects = 1,
): void {
  let stats = map.get(key);
  if (!stats) {
    const entry =
      DSL_TO_ENTRY.get(key) ??
      ({
        label: key,
        dslType: key,
        description: key,
        wikiTests: [],
      } as TriggerCatalogEntry);
    stats = { entry, effectCount: 0, cardIds: new Set(), sources: new Set() };
    map.set(key, stats);
  }
  stats.effectCount += effects;
  stats.cardIds.add(cardId);
  stats.sources.add(source);
}

function unitTriggerToKey(type: string): string {
  if (type === "operation") return "operation:rush";
  return type;
}

function operationKindToKey(kind: string): string {
  if (kind === "counter") return "operation:counter";
  if (kind === "permanent") return "operation:resident";
  return "operation:rush";
}

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

function extractCardType(content: string): string | undefined {
  const m = content.match(/種類:\s*(.+)/);
  return m?.[1]?.trim();
}

function analyzeWiki(map: Map<string, TriggerStats>): { total: number; withText: number } {
  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  let withText = 0;

  for (const file of files) {
    const cardId = file.replace(/\.md$/, "");
    const content = readFileSync(join(WIKI_DIR, file), "utf8");
    const texts = extractWikiEffectTexts(content);
    const cardType = extractCardType(content) ?? "";
    const isOperation = cardType.includes("オペレーション");

    if (texts.length === 0) {
      if (isOperation && /カウンター/.test(content)) {
        addHit(map, "operation:counter", cardId, "wiki");
      }
      continue;
    }
    withText += 1;

    const segments = texts.flatMap(splitEffectSegments);
    for (const segment of segments) {
      const body =
        segment.kind === "named" ? `【${segment.name}】${segment.body}` : segment.body;
      const inferred = inferWikiTrigger(body);
      if (inferred) {
        addHit(map, triggerKey(inferred), cardId, "wiki");
      }
    }
  }

  return { total: files.length, withText };
}

function analyzeUnitEffects(map: Map<string, TriggerStats>): void {
  for (const [cardId, block] of Object.entries(UNIT_EFFECTS)) {
    for (const named of block.namedEffects ?? []) {
      const t = named.trigger?.type ?? "nc";
      addHit(map, unitTriggerToKey(t), cardId, "unit_effects");
    }
    for (const unnamed of block.unnamedText ?? []) {
      const inferred = inferWikiTrigger(unnamed.text);
      if (inferred) {
        addHit(map, triggerKey(inferred), cardId, "unit_effects");
      } else {
        addHit(map, "while_in_field", cardId, "unit_effects");
      }
    }
  }
}

function analyzeOperations(map: Map<string, TriggerStats>): void {
  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const cardId = file.replace(/\.md$/, "");
    const meta = getCardEffect(cardId);
    if (!meta) continue;
    addHit(map, operationKindToKey(meta.kind), cardId, "operations");
  }
}

function renderMarkdown(
  rows: TriggerStats[],
  stats: { wikiTotal: number; wikiWithText: number; totalEffects: number },
): string {
  const sorted = [...rows].sort((a, b) => b.effectCount - a.effectCount);
  const totalCards = stats.wikiTotal;

  const lines: string[] = [
    "# Trigger 一覧（出現頻度）",
    "",
    "**生成:** `npm run extract-trigger-catalog -w @rangers-strike/cards`",
    `**日付:** ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## サマリー",
    "",
    "| 指標 | 値 |",
    "|------|-----|",
    `| Wiki カード総数 | ${stats.wikiTotal} |`,
    `| 効果文あり（Wiki） | ${stats.wikiWithText} |`,
    `| 検出 Trigger ヒット総数 | ${stats.totalEffects} |`,
    `| Trigger 種類 | ${sorted.filter((r) => r.effectCount > 0).length} |`,
    "",
    "## 用語対応",
    "",
    "| 一覧名（camelCase） | DSL type | 説明 |",
    "|--------------------|----------|------|",
  ];

  for (const row of TRIGGER_CATALOG) {
    const timing =
      row.operationTiming != null ? ` (\`${row.operationTiming}\`)` : "";
    lines.push(
      `| \`${row.label}\` | \`${row.dslType}\`${timing} | ${row.description} |`,
    );
  }

  lines.push(
    "",
    "## 出現頻度（効果セグメント単位）",
    "",
    "| Trigger | DSL | 説明 | 効果数 | カード数 | カード率 | ソース |",
    "|---------|-----|------|--------|----------|----------|--------|",
  );

  for (const row of sorted) {
    if (row.effectCount === 0) continue;
    const pct = ((row.cardIds.size / totalCards) * 100).toFixed(1);
    const src = [...row.sources].join("+");
    const timing = row.entry.operationTiming ? `:${row.entry.operationTiming}` : "";
    lines.push(
      `| \`${row.entry.label}\` | \`${row.entry.dslType}${timing}\` | ${row.entry.description} | ${row.effectCount} | ${row.cardIds.size} | ${pct}% | ${src} |`,
    );
  }

  lines.push(
    "",
    "## ユーザー指定 Trigger（抜粋）",
    "",
    "| Trigger | 効果数 | カード数 |",
    "|---------|--------|----------|",
  );

  const highlight = [
    "onRush",
    "onBattle",
    "onEnterBattle",
    "onStrike",
    "onLeave",
    "onDamage",
    "onDestroy",
    "onCounter",
    "onNc",
    "whileInField",
    "onOperationRush",
    "onOperationResident",
  ];
  for (const label of highlight) {
    const row = sorted.find((r) => r.entry.label === label);
    if (row && row.effectCount > 0) {
      lines.push(`| \`${label}\` | ${row.effectCount} | ${row.cardIds.size} |`);
    } else {
      lines.push(`| \`${label}\` | 0 | 0 |`);
    }
  }

  lines.push(
    "",
    "## 集計方法",
    "",
    "1. **Wiki 全文スキャン** — `docs/wiki/cards/*.md` の効果文をセグメント分割し、正規表現で Trigger 推論",
    "2. **unitEffects.json** — Legend 1–3 の `namedEffects[].trigger.type` を加算",
    "3. **operations** — `effects.ts` のオペ `kind`（instant→rush, counter, permanent→resident）",
    "",
    "同一カードが複数 Trigger に該当する場合あり。効果数はセグメント／named 効果の件数。",
    "",
  );

  return lines.join("\n");
}

function main(): void {
  const map = getStatsMap();
  const wikiStats = analyzeWiki(map);
  analyzeUnitEffects(map);
  analyzeOperations(map);

  const rows = [...map.values()];
  const totalEffects = rows.reduce((s, r) => s + r.effectCount, 0);

  const md = renderMarkdown(rows, {
    wikiTotal: wikiStats.total,
    wikiWithText: wikiStats.withText,
    totalEffects,
  });

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, md);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Triggers with hits: ${rows.filter((r) => r.effectCount > 0).length}`);
  console.log(`Total effect hits: ${totalEffects}`);
}

main();
