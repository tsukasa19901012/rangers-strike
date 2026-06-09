#!/usr/bin/env node
/**
 * docs/wiki/sources/atwiki/page-*-{CARD_ID}.md から
 * docs/wiki/cards/{CARD_ID}.md を更新（atwiki 効果文・Q&A 抜粋）
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../sources/atwiki");
const CARDS = path.join(__dirname, "../cards");

function extractSection(body, startLabel, endLabels) {
  const start = body.indexOf(startLabel);
  if (start < 0) return "";
  let chunk = body.slice(start + startLabel.length).trimStart();
  for (const end of endLabels) {
    const i = chunk.indexOf(end);
    if (i >= 0) chunk = chunk.slice(0, i);
  }
  return chunk.replace(/\n{2,}/g, "\n").trim();
}

function extractFeature(body) {
  const m = body.match(/特徴[：:]\s*([^\n]+)/);
  if (!m) return "";
  const v = m[1].trim();
  return v && v !== "なし" ? v : "";
}

function extractWork(body) {
  const m = body.match(/作品[：:]\s*([^\n]+)/);
  if (!m) return "";
  const v = m[1].trim();
  return v && v !== "なし" ? v : "";
}

function cleanRecording(value) {
  return value
    .replace(/[\s　]+(?:自販|パック[：:/／]).*$/u, "")
    .trim();
}

function extractRecording(body) {
  const m = body.match(/収録[：:]\s*([^\n]+)/);
  if (!m) return "";
  const v = cleanRecording(m[1]);
  return v && v !== "なし" ? v : "";
}

function migrateLegacyRecording(md) {
  if (/^収録:/m.test(md)) return md;
  const dan = md.match(/^弾:\s*(.+)$/m);
  if (dan) return md.replace(/^弾:\s*.+$/m, `収録: ${dan[1].trim()}`);
  const set = md.match(/^セット:\s*(.+)$/m);
  if (set) return md.replace(/^セット:\s*.+$/m, `収録: ${set[1].trim()}`);
  return md;
}

function applyFieldToMd(md, field, value, anchors) {
  if (!value) return md;
  const line = `${field}: ${value}`;
  if (new RegExp(`^${field}:`, "m").test(md)) {
    return md.replace(new RegExp(`^${field}:.*$`, "m"), line);
  }
  for (const anchor of anchors) {
    const re = new RegExp(`^(${anchor.replace(":", "\\:")}[^\n]*)$`, "m");
    if (re.test(md)) {
      return md.replace(re, `$1\n\n${line}`);
    }
  }
  return md.replace(/^(CARD_ID:[^\n]*)$/m, `$1\n\n${line}`);
}

function applyFeatureToMd(md, feature) {
  return applyFieldToMd(md, "特徴", feature, [
    "収録:",
    "作品:",
    "カテゴリ:",
    "カード名:",
  ]);
}

function applyWorkToMd(md, work) {
  return applyFieldToMd(md, "作品", work, [
    "収録:",
    "特徴:",
    "カテゴリ:",
    "カード名:",
  ]);
}

function applyRecordingToMd(md, recording) {
  return applyFieldToMd(md, "収録", recording, [
    "作品:",
    "特徴:",
    "カテゴリ:",
    "カード名:",
  ]);
}

function extractQa(body) {
  const qa = [];
  const numbered =
    /Q(\d+)\s*\n\s*(.+?)\s*\n\s*A\1\s*\n\s*(.+?)(?=\n\s*Q\d+|\n関連|\nコメント|\nカード評価|$)/gs;
  let m;
  while ((m = numbered.exec(body)) && qa.length < 5) {
    qa.push({ q: m[2].trim(), a: m[3].trim() });
  }
  if (qa.length) return qa;

  const tabbed =
    /Q\s*\n\s*(.+?)\s*\n\s*A\s*\n\s*(.+?)(?=\nカード評価|\n関連カード|\nコメント|\n\s*Q\s*\n|$)/gs;
  while ((m = tabbed.exec(body)) && qa.length < 5) {
    const q = m[1].replace(/\s+/g, " ").trim();
    const a = m[2].replace(/\s+/g, " ").trim();
    if (q && a && !qa.some((x) => x.q === q)) qa.push({ q, a });
  }
  return qa;
}

const WIKI_CARD_ID =
  /^(?:XG[1-7]|RS|SR|BK|RK|SK|RM|SM|SX|XP|PR|PK|PM|XC)-\d{3}$/;

function cardIdFromSourceFile(file) {
  const m = file.match(/^page-\d+-(.+)\.md$/);
  return m?.[1] ?? "";
}

async function main() {
  const files = (await readdir(SRC)).filter((f) =>
    WIKI_CARD_ID.test(cardIdFromSourceFile(f)),
  );
  let updated = 0;

  for (const file of files) {
    const cardId = cardIdFromSourceFile(file);
    if (!cardId) continue;

    const raw = await readFile(path.join(SRC, file), "utf8");
    const body = raw.split("\n---\n").slice(1).join("---") || raw;
    const pageMatch = raw.match(/page (\d+)/);
    const pageId = pageMatch?.[1] ?? "?";
    const url = `https://w.atwiki.jp/renst/pages/${pageId}.html`;

    const effectText = extractSection(body, "テキスト：", [
      "フレーバーテキスト",
      "イラストレーター",
      "レアリティ",
      "Q&A",
      "関連カード",
    ]);
    const feature =
      extractFeature(body) ||
      extractSection(body, "特徴：", ["\n"]) ||
      extractSection(body, "特徴:", ["\n"]);
    const work = extractWork(body);
    const recording = extractRecording(body);
    const stats = {
      種類: extractSection(body, "種類：", ["\n"]),
      カテゴリ: extractSection(body, "カテゴリ：", ["\n"]),
      必要パワー: extractSection(body, "必要パワー：", ["\n"]),
      追加条件: extractSection(body, "追加条件：", ["\n"]),
      BP: extractSection(body, "BP：", ["\n"]),
      SP: extractSection(body, "SP：", ["\n"]),
      CN: extractSection(body, "CN：", ["\n"]),
      ...(recording ? { 収録: recording } : {}),
      ...(work ? { 作品: work } : {}),
      ...(feature ? { 特徴: feature } : {}),
    };
    const qa = extractQa(body);

    const cardPath = path.join(CARDS, `${cardId}.md`);
    let md = "";
    try {
      md = await readFile(cardPath, "utf8");
    } catch {
      continue;
    }

    const qaBlock =
      qa.length > 0
        ? `\n\natwiki Q&A（抜粋）:\n${qa.map((x, i) => `* Q: ${x.q}\n  A: ${x.a}`).join("\n")}\n`
        : "";

    const statsLines = Object.entries(stats)
      .filter(([, v]) => v && v !== "なし")
      .map(([k, v]) => `* ${k}: ${v.split("\n")[0]}`)
      .join("\n");

    const effectBlock = effectText
      ? `atwiki 効果文:\n> ${effectText.replace(/\n/g, "\n> ")}\n`
      : "atwiki 効果文: UNKNOWN\n";

    const batchHint = raw.match(/バッチ: (.+)/)?.[1] ?? "atwiki";
    const newSection = `## atwiki 取得（${batchHint}）

出典:
* ${url}

${effectBlock}
${statsLines ? `atwiki ステータス:\n${statsLines}\n` : ""}${qaBlock}
confidence: ${effectText ? "HIGH" : "MEDIUM"}
`;

    if (md.includes("## atwiki 取得")) {
      md = md.replace(/## atwiki 取得[\s\S]*?(?=\n## |\nconfidence:|$)/, newSection.trim() + "\n\n");
    } else {
      md = md.replace(/\nconfidence:.*\n?$/, `\n\n${newSection}`);
    }

    if (!md.includes("confidence:")) {
      md += `\n${newSection}`;
    }

    md = migrateLegacyRecording(md);
    md = applyRecordingToMd(md, recording);
    md = applyWorkToMd(md, work);
    md = applyFeatureToMd(md, feature);

    await writeFile(cardPath, md);
    updated += 1;
  }

  console.log(`updated ${updated} card specs from atwiki sources`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
