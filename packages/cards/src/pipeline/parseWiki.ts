import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WikiEffectSegment, WikiParseResult, WikiStatus } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WIKI_DIR = join(__dirname, "../../../../docs/wiki/cards");

function extractField(content: string, label: string): string | undefined {
  const m = content.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim();
}

export function extractEffectTexts(content: string): string[] {
  const texts: string[] = [];
  const re =
    /(?:^|\n)(?:atwiki 効果文|効果文[^:\n]*):\s*\n> (.+?)(?=\n\n|\natwiki ステータス|\n## |\nconfidence:|\n発動条件:)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    const t = raw.replace(/\n> /g, "\n").trim();
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

/** リポジトリ参照と atwiki で同一効果が重複する場合は長い方のみ残す */
export function dedupeEffectTexts(texts: string[]): string[] {
  const normalized = (t: string) => t.replace(/\s+/g, "");
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const n = normalized(text);
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push(text);
  }
  return unique.filter((text, i) => {
    const n = normalized(text);
    return !unique.some((other, j) => {
      if (i === j) return false;
      const o = normalized(other);
      return o.includes(n) && o.length > n.length;
    });
  });
}

export function dedupeSegments(segments: WikiEffectSegment[]): WikiEffectSegment[] {
  const seen = new Set<string>();
  return segments.filter((s) => {
    const key = `${s.kind}|${s.name ?? ""}|${s.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitEffectSegments(text: string): WikiEffectSegment[] {
  type Tagged =
    | { index: number; kind: "named"; name: string; body: string }
    | { index: number; kind: "note"; body: string };

  const tagged: Tagged[] = [];

  for (const m of text.matchAll(/【([^】]+)】([^【※]*)/g)) {
    const name = m[1]?.trim();
    const body = m[2]?.trim();
    if (!name) continue;
    tagged.push({
      index: m.index ?? 0,
      kind: "named",
      name,
      body: body ?? "",
    });
  }
  for (const m of text.matchAll(/※([^【※]+)/g)) {
    const noteBody = m[1]?.trim();
    if (!noteBody) continue;
    tagged.push({
      index: m.index ?? 0,
      kind: "note",
      body: `※${noteBody}`,
    });
  }

  if (tagged.length === 0) {
    return text.trim() ? [{ kind: "body", body: text.trim() }] : [];
  }

  tagged.sort((a, b) => a.index - b.index);
  return tagged.map((t) =>
    t.kind === "named"
      ? { kind: "named" as const, name: t.name, body: t.body }
      : { kind: "note" as const, body: t.body },
  );
}

function parseAtwikiStatus(content: string): WikiStatus {
  const block = content.match(/atwiki ステータス:\s*\n([\s\S]*?)(?=\n\n|atwiki Q&A|confidence:)/);
  if (!block?.[1]) return {};
  const status: WikiStatus = {};
  for (const line of block[1].split("\n")) {
    const m = line.match(/^\*\s*([^:]+):\s*(.+)$/);
    if (m?.[1] && m[2]) status[m[1].trim() as keyof WikiStatus] = m[2].trim();
  }
  return status;
}

function inferConfidence(content: string): WikiParseResult["confidence"] {
  const last = [...content.matchAll(/confidence:\s*(HIGH|MEDIUM|LOW)/gi)].pop()?.[1];
  if (last === "HIGH" || last === "MEDIUM" || last === "LOW") return last;
  return "UNKNOWN";
}

export function parseWikiMarkdown(
  cardId: string,
  wikiDir: string = DEFAULT_WIKI_DIR,
): WikiParseResult {
  const sourcePath = join(wikiDir, `${cardId}.md`);
  if (!existsSync(sourcePath)) {
    throw new Error(`Wiki file not found: ${sourcePath}`);
  }
  const content = readFileSync(sourcePath, "utf8");
  const effectTexts = extractEffectTexts(content);
  const segments = dedupeSegments(effectTexts.flatMap(splitEffectSegments));

  return {
    cardId,
    name: extractField(content, "カード名") ?? cardId,
    categoryLabel: extractField(content, "カテゴリ"),
    featuresLabel: extractField(content, "特徴"),
    expansionLabel: extractField(content, "収録"),
    effectTexts,
    segments,
    status: parseAtwikiStatus(content),
    confidence: inferConfidence(content),
    sourcePath,
  };
}
