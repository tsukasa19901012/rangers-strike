import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import legend1Cards from "../src/legend1/cards.json";
import legend2Cards from "../src/legend2/cards.json";
import legend3Cards from "../src/legend3/cards.json";
import { dedupeEffectTexts, splitEffectSegments } from "../src/pipeline/parseWiki";
import {
  CATEGORY_PRIORITY,
  RULING_CATEGORY_META,
  matchRulingPatterns,
  pickPrimaryCategory,
  type RulingCategory,
  type RulingMatch,
} from "../src/pipeline/rulingCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = join(__dirname, "../../../docs/wiki/cards");
const OUT_MD = join(__dirname, "../../../docs/architecture/special-ruling-cards.md");
const OUT_JSON = join(__dirname, "../pipeline/data/special-ruling-cards.json");

type CardRuling = {
  id: string;
  name: string;
  primaryCategory: RulingCategory;
  categories: RulingCategory[];
  patterns: RulingMatch[];
  effectSnippet: string;
  hasFaq: boolean;
};

const NAME_MAP = new Map<string, string>();
for (const catalog of [legend1Cards, legend2Cards, legend3Cards]) {
  for (const c of catalog.cards) {
    NAME_MAP.set(c.id, c.name);
  }
}

function extractField(content: string, label: string): string | undefined {
  const m = content.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim();
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

function snippet(text: string, max = 100): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function analyzeCard(cardId: string, content: string): CardRuling | null {
  const texts = extractWikiEffectTexts(content);
  if (texts.length === 0) return null;

  const combined = texts.join(" ");
  const segments = texts.flatMap(splitEffectSegments);
  const scanTexts = [
    combined,
    ...segments.map((s) => (s.kind === "named" ? `【${s.name}】${s.body}` : s.body)),
  ];

  const patternMap = new Map<string, RulingMatch>();
  for (const t of scanTexts) {
    for (const hit of matchRulingPatterns(t)) {
      patternMap.set(`${hit.category}:${hit.patternId}`, hit);
    }
  }

  if (patternMap.size === 0) return null;

  const patterns = [...patternMap.values()];
  const categories = new Set(patterns.map((p) => p.category));
  const primaryCategory = pickPrimaryCategory(categories);
  const hasFaq = /## grnrngr 公式FAQ|atwiki Q&A/.test(content);

  return {
    id: cardId,
    name: NAME_MAP.get(cardId) ?? extractField(content, "カード名") ?? cardId,
    primaryCategory,
    categories: CATEGORY_PRIORITY.filter((c) => categories.has(c)),
    patterns,
    effectSnippet: snippet(combined),
    hasFaq,
  };
}

function renderCategorySection(
  category: RulingCategory,
  cards: CardRuling[],
): string[] {
  const meta = RULING_CATEGORY_META[category];
  const subset = cards
    .filter((c) => c.categories.includes(category))
    .sort((a, b) => a.id.localeCompare(b.id));

  const lines = [
    `## ${meta.labelJa}（${category}）`,
    "",
    meta.description,
    "",
    `**該当:** ${subset.length} 枚`,
    "",
    "| カードID | カード名 | 主分類 | 裁定タグ | FAQ | 効果文（抜粋） |",
    "|----------|----------|--------|----------|-----|----------------|",
  ];

  for (const c of subset) {
    const tags = [...new Set(c.patterns.filter((p) => p.category === category).map((p) => p.label))]
      .slice(0, 4)
      .join(", ");
    const primaryMark = c.primaryCategory === category ? "★" : "";
    lines.push(
      `| ${c.id} | ${c.name} | ${primaryMark} | ${tags.replace(/\|/g, "\\|")} | ${c.hasFaq ? "あり" : "—"} | ${c.effectSnippet.replace(/\|/g, "\\|")} |`,
    );
  }

  lines.push("");
  return lines;
}

function renderMarkdown(cards: CardRuling[], wikiTotal: number): string {
  const byPrimary = Object.fromEntries(
    CATEGORY_PRIORITY.map((c) => [c, cards.filter((x) => x.primaryCategory === c).length]),
  ) as Record<RulingCategory, number>;

  const lines = [
    "# 特殊裁定カード一覧",
    "",
    "**生成:** `npm run extract-ruling-cards -w @rangers-strike/cards`",
    `**日付:** ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## サマリー",
    "",
    "| 指標 | 値 |",
    "|------|-----|",
    `| Wiki カード総数 | ${wikiTotal} |`,
    `| 特殊裁定該当 | ${cards.length} |`,
    `| 該当率 | ${((cards.length / wikiTotal) * 100).toFixed(1)}% |`,
    "",
    "### 主分類（1カード1区分）",
    "",
    "| 分類 | 説明 | 枚数 |",
    "|------|------|------|",
  ];

  for (const cat of CATEGORY_PRIORITY) {
    const meta = RULING_CATEGORY_META[cat];
    lines.push(`| **${meta.labelJa}** | ${meta.description} | ${byPrimary[cat]} |`);
  }

  lines.push(
    "",
    "> 1枚が複数カテゴリに該当する場合あり。主分類は state_rewrite > rule_override > replacement > timing > continuous の優先順。",
    "",
    "## 分類定義",
    "",
    "| 分類 | 英名 | 典型例 |",
    "|------|------|--------|",
    "| State Rewrite | `state_rewrite` | 母艦、コマンダー、デッキ増減、コピー |",
    "| Rule Override | `rule_override` | ウイング、チェイス、レジスト、NC無視 |",
    "| Timing Exception | `timing_exception` | ゲーム開始時、相手ターン、モード選択 |",
    "| Replacement Effect | `replacement_effect` | かわりに、場に留まる、超シールド |",
    "| Continuous Effect | `continuous_effect` | ※常時、常駐OP、毎ターン自動進入 |",
    "",
  );

  for (const cat of CATEGORY_PRIORITY) {
    lines.push(...renderCategorySection(cat, cards));
  }

  lines.push(
    "## データ",
    "",
    `- JSON: \`packages/cards/pipeline/data/special-ruling-cards.json\``,
    "- ソース: `docs/wiki/cards/*.md` 効果文パターンマッチ",
    "",
  );

  return lines.join("\n");
}

function main(): void {
  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  const cards: CardRuling[] = [];

  for (const file of files) {
    const cardId = file.replace(/\.md$/, "");
    const content = readFileSync(join(WIKI_DIR, file), "utf8");
    const ruling = analyzeCard(cardId, content);
    if (ruling) cards.push(ruling);
  }

  cards.sort((a, b) => a.id.localeCompare(b.id));

  const md = renderMarkdown(cards, files.length);
  mkdirSync(dirname(OUT_MD), { recursive: true });
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_MD, md);

  const json = {
    generatedAt: new Date().toISOString(),
    totalWikiCards: files.length,
    rulingCardCount: cards.length,
    byPrimaryCategory: Object.fromEntries(
      CATEGORY_PRIORITY.map((c) => [
        c,
        cards.filter((x) => x.primaryCategory === c).length,
      ]),
    ),
    byCategoryMembership: Object.fromEntries(
      CATEGORY_PRIORITY.map((c) => [
        c,
        cards.filter((x) => x.categories.includes(c)).length,
      ]),
    ),
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      primaryCategory: c.primaryCategory,
      categories: c.categories,
      patternIds: c.patterns.map((p) => p.patternId),
      patternLabels: c.patterns.map((p) => p.label),
      hasFaq: c.hasFaq,
      effectSnippet: c.effectSnippet,
    })),
  };
  writeFileSync(OUT_JSON, `${JSON.stringify(json, null, 2)}\n`);

  console.log(`Wrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Ruling cards: ${cards.length} / ${files.length}`);
  for (const c of CATEGORY_PRIORITY) {
    const n = cards.filter((x) => x.primaryCategory === c).length;
    console.log(`  ${c}: ${n}`);
  }
}

main();
