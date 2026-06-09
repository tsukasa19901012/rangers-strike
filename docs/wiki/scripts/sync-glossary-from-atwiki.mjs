#!/usr/bin/env node
/**
 * docs/wiki/sources/atwiki/page-{id}-{slug}.md から
 * docs/wiki/glossary/{slug}.md を更新
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../sources/atwiki");
const GLOSSARY = path.join(__dirname, "../glossary");
const CARD_ID_RE = /^(RS|SR|BK|RK|SK|RM|SM)-\d{3}$/;

function extractDefinition(body) {
  let chunk = body.trim();
  const stops = [
    "\nタグ：",
    "\n- タグ：",
    "\nカード評価",
    "\n関連カード",
    "\nコメント",
    "\n編集",
    "\nページを更新",
  ];
  for (const end of stops) {
    const i = chunk.indexOf(end);
    if (i >= 0) chunk = chunk.slice(0, i);
  }
  const lines = chunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
  return lines.join("\n");
}

async function main() {
  const files = (await readdir(SRC)).filter((f) => {
    if (!/^page-\d+-.+\.md$/.test(f)) return false;
    const label = f.replace(/^page-\d+-/, "").replace(/\.md$/, "");
    return !CARD_ID_RE.test(label);
  });

  let updated = 0;
  for (const file of files) {
    const slug = file.replace(/^page-\d+-/, "").replace(/\.md$/, "");
    const glossaryPath = path.join(GLOSSARY, `${slug}.md`);
    let md = "";
    try {
      md = await readFile(glossaryPath, "utf8");
    } catch {
      continue;
    }

    const raw = await readFile(path.join(SRC, file), "utf8");
    const body = raw.split("\n---\n").slice(1).join("---") || raw;
    const pageId = raw.match(/page (\d+)/)?.[1] ?? "?";
    const title = raw.match(/^# (.+?) \(page/m)?.[1] ?? slug;
    const url = `https://w.atwiki.jp/renst/pages/${pageId}.html`;
    const definition = extractDefinition(body);
    const batchHint = raw.match(/バッチ: (.+)/)?.[1] ?? "atwiki";

    const defBlock = definition
      ? `atwiki 定義:\n${definition
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}\n`
      : "atwiki 定義: UNKNOWN\n";

    const newSection = `## atwiki 取得（${batchHint}）

出典:
* ${url}

${defBlock}
confidence: ${definition ? "HIGH" : "MEDIUM"}
`;

    if (md.includes("## atwiki 取得")) {
      md = md.replace(
        /## atwiki 取得[\s\S]*?(?=\n## |\nconfidence:|$)/,
        `${newSection.trim()}\n\n`,
      );
    } else {
      md = md.replace(
        /^定義:\n> （atwiki 未取得）/m,
        `定義:\n> （下記 atwiki 定義参照）`,
      );
      md = md.replace(/\nconfidence:.*\n?$/, `\n\n${newSection}`);
      if (!md.includes("## atwiki 取得")) md += `\n\n${newSection}`;
    }

    if (!/^# /m.test(md)) {
      md = `# ${title}\n\n${md}`;
    }

    await writeFile(glossaryPath, md);
    updated += 1;
  }

  console.log(`updated ${updated} glossary entries from atwiki sources`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
