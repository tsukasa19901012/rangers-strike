/**
 * E7 監査: atwiki 原文（docs/wiki/sources/atwiki/page-N-{ID}.md）に効果テキストがあるのに、
 * ローダーが返す CardDocument の効果定義（effects + unnamedRules）が 0 件のカードを検出する。
 * テキスト抽出の取りこぼし（「テキスト:」半角コロン・コロンなし見出し等）で
 * カードがバニラとして動く状態を防ぐ。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogTier } from "../../src/catalog/tiers";
import { loadCards } from "../../src/dsl/loader";
import type { CardDocument } from "../../src/dsl/types";
import { extractEffectTextFromAtwikiSource } from "../atwikiText.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_ATWIKI_SOURCE_DIR = join(
  __dirname,
  "../../../../docs/wiki/sources/atwiki",
);

export type SourceEffectCoverageEntry = {
  cardId: string;
  sourceFile: string;
  /** 原文から抽出した効果テキスト（先頭のみ）。 */
  sourceText: string;
  /** effects.length + unnamedRules.length */
  definitionCount: number;
  /** カタログ text が空か。 */
  catalogTextEmpty: boolean;
};

export type SourceEffectCoverageReport = {
  scanned: number;
  withSourceText: number;
  missingSource: string[];
  /** 原文に効果テキストがあるのに効果定義 0 件（失敗扱い）。 */
  noDefinitions: SourceEffectCoverageEntry[];
  /** 原文に効果テキストがあるのにカタログ text が空（効果定義はある。参考情報）。 */
  emptyCatalogText: SourceEffectCoverageEntry[];
};

/** 原文本文（frontmatter 区切り `---` 以降）。 */
export function atwikiSourceBody(raw: string): string {
  return raw.split("\n---\n").slice(1).join("---") || raw;
}

/** `page-N-{CARD_ID}.md` をカード ID で索引する。 */
export function indexAtwikiSources(sourceDir = DEFAULT_ATWIKI_SOURCE_DIR): Map<string, string> {
  const index = new Map<string, string>();
  if (!existsSync(sourceDir)) return index;
  for (const file of readdirSync(sourceDir)) {
    const id = file.match(/^page-\d+-(.+)\.md$/)?.[1];
    if (id && !index.has(id)) index.set(id, file);
  }
  return index;
}

export function countEffectDefinitions(doc: Pick<CardDocument, "effects" | "unnamedRules">): number {
  return (doc.effects?.length ?? 0) + (doc.unnamedRules?.length ?? 0);
}

/** 原文テキストが「効果あり」とみなせるか（空・「なし」は効果なし）。 */
export function hasSourceEffectText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed !== "" && trimmed !== "なし";
}

export function auditSourceEffectCoverage(
  docs: Array<Pick<CardDocument, "id" | "text" | "effects" | "unnamedRules">>,
  readSource: (cardId: string) => { file: string; raw: string } | undefined,
): SourceEffectCoverageReport {
  const report: SourceEffectCoverageReport = {
    scanned: docs.length,
    withSourceText: 0,
    missingSource: [],
    noDefinitions: [],
    emptyCatalogText: [],
  };

  for (const doc of docs) {
    const source = readSource(doc.id);
    if (!source) {
      report.missingSource.push(doc.id);
      continue;
    }
    const sourceText = extractEffectTextFromAtwikiSource(atwikiSourceBody(source.raw));
    if (!hasSourceEffectText(sourceText)) continue;
    report.withSourceText += 1;

    const entry: SourceEffectCoverageEntry = {
      cardId: doc.id,
      sourceFile: source.file,
      sourceText: sourceText.slice(0, 80),
      definitionCount: countEffectDefinitions(doc),
      catalogTextEmpty: !doc.text?.trim(),
    };
    if (entry.definitionCount === 0) report.noDefinitions.push(entry);
    else if (entry.catalogTextEmpty) report.emptyCatalogText.push(entry);
  }

  return report;
}

/** tier のカードを atwiki 原文と照合する。 */
export function runSourceEffectCoverageAudit(
  tier: CatalogTier = "full-playable",
  sourceDir = DEFAULT_ATWIKI_SOURCE_DIR,
): SourceEffectCoverageReport {
  const index = indexAtwikiSources(sourceDir);
  return auditSourceEffectCoverage(loadCards(tier), (cardId) => {
    const file = index.get(cardId);
    if (!file) return undefined;
    return { file, raw: readFileSync(join(sourceDir, file), "utf8") };
  });
}
