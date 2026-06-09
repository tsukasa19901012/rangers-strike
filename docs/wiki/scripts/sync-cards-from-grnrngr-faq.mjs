#!/usr/bin/env node
/**
 * grnrngr faq/card_1.html, card_2.html から L1/L2 カード md に公式 Q&A を反映。
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../sources/grnrngr");
const CARDS = path.join(__dirname, "../cards");
const FAQ_FILES = [
  {
    file: "faq-card-1.html",
    url: "https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html",
  },
  {
    file: "faq-card-2.html",
    url: "https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html",
  },
];

function cleanHtml(text) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractQaPairs(sectionHtml) {
  const pairs = [];
  const re =
    /bgcolor="#FFEEEE"[^>]*>([\s\S]*?)<\/td>[\s\S]*?bgcolor="#EEFFFF"[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = re.exec(sectionHtml))) {
    const q = cleanHtml(m[1]);
    const a = cleanHtml(m[2]);
    if (q && a && !pairs.some((p) => p.q === q)) pairs.push({ q, a });
  }
  return pairs;
}

function parseFaqHtml(html) {
  const byCard = new Map();
  const sections = html.split(
    /<td[^>]*class="m_font_wb"[^>]*>●\s*<a[^>]*>[\s\S]*?<\/a><\/td>/i,
  );
  const headers = [
    ...html.matchAll(
      /<td[^>]*class="m_font_wb"[^>]*>●\s*<a[^>]*>[\s\S]*?(RS-\d{3})[^<]*<\/a><\/td>/gi,
    ),
  ];

  for (let i = 0; i < headers.length; i += 1) {
    const cardId = headers[i][1];
    const num = Number(cardId.slice(3));
    if (num > 122) continue;
    const start = headers[i].index ?? 0;
    const end = headers[i + 1]?.index ?? html.length;
    const section = html.slice(start, end);
    const pairs = extractQaPairs(section);
    if (!pairs.length) continue;
    if (!byCard.has(cardId)) byCard.set(cardId, []);
    const list = byCard.get(cardId);
    for (const p of pairs) {
      if (!list.some((x) => x.q === p.q)) list.push(p);
    }
  }
  return byCard;
}

async function main() {
  const merged = new Map();
  for (const { file, url } of FAQ_FILES) {
    const html = await readFile(path.join(SRC, file), "utf8");
    for (const [id, pairs] of parseFaqHtml(html)) {
      if (!merged.has(id)) merged.set(id, { pairs: [], sources: [] });
      const entry = merged.get(id);
      entry.sources.push(url);
      for (const p of pairs) {
        if (!entry.pairs.some((x) => x.q === p.q)) entry.pairs.push(p);
      }
    }
  }

  let updated = 0;
  for (const [cardId, { pairs, sources }] of merged) {
    if (!pairs.length) continue;
    const cardPath = path.join(CARDS, `${cardId}.md`);
    let md = "";
    try {
      md = await readFile(cardPath, "utf8");
    } catch {
      continue;
    }

    const qaBlock = pairs
      .slice(0, 5)
      .map((x) => `* Q: ${x.q}\n  A: ${x.a}`)
      .join("\n");
    const sourceLines = [...new Set(sources)].map((u) => `* ${u}`).join("\n");
    const section = `## grnrngr 公式FAQ

出典:
${sourceLines}

${qaBlock}

confidence: HIGH
`;

    if (md.includes("## grnrngr 公式FAQ")) {
      md = md.replace(
        /## grnrngr 公式FAQ[\s\S]*?(?=\n## |\nconfidence:|$)/,
        `${section.trim()}\n\n`,
      );
    } else if (md.includes("## atwiki 取得")) {
      md = md.replace(/(## atwiki 取得[\s\S]*?)\n\n/, `$1\n\n${section}\n`);
    } else {
      md = md.replace(/\nconfidence:.*\n?$/, `\n\n${section}`);
    }

    await writeFile(cardPath, md);
    updated += 1;
  }

  console.log(`updated ${updated} cards with grnrngr FAQ (${merged.size} had Q&A)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
