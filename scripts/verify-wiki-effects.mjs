#!/usr/bin/env node
/**
 * Compare card effect text in the repo against wikiwiki.jp/renst pages.
 * Usage: node scripts/verify-wiki-effects.mjs [--fix-report]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const l1 = JSON.parse(fs.readFileSync(path.join(root, "packages/cards/src/legend1/cards.json"), "utf8"));
const l2 = JSON.parse(fs.readFileSync(path.join(root, "packages/cards/src/legend2/cards.json"), "utf8"));
const ue1 = JSON.parse(fs.readFileSync(path.join(root, "packages/cards/src/legend1/unitEffects.json"), "utf8"));
const ue2 = JSON.parse(fs.readFileSync(path.join(root, "packages/cards/src/legend2/unitEffects.json"), "utf8"));

/** @type {Record<string, { effectId: string, text: string }>} */
const operations = {};
for (const line of fs
  .readFileSync(path.join(root, "packages/cards/src/effects.ts"), "utf8")
  .split("\n")) {
  const idMatch = line.match(/"(RS-\d+)":/);
  if (idMatch) operations[idMatch[1]] = { effectId: "", text: "" };
  const textMatch = line.match(/text: "(.+)",/);
  if (textMatch && Object.keys(operations).length) {
    const lastId = Object.keys(operations).at(-1);
    if (lastId && !operations[lastId].text) operations[lastId].text = textMatch[1];
  }
}

const errata = fs.readFileSync(path.join(root, "packages/cards/src/errata.ts"), "utf8");
for (const m of errata.matchAll(/"(RS-\d+)":\s*\n\s*"([^"]+)"/g)) {
  if (operations[m[1]]) operations[m[1]].text = m[2];
}

const allCards = [...l1.cards, ...l2.cards];

function canonicalText(card) {
  if (card.type === "operation") return operations[card.id]?.text ?? "";
  const block = ue1[card.id] ?? ue2[card.id];
  return card.text ?? block?.rawText ?? "";
}

function normalize(text) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "")
    .replace(/[＋+]/g, "＋")
    .replace(/[－-]/g, "－")
    .replace(/[！!]/g, "！")
    .replace(/⇒/g, "")
    .replace(/[「」]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/常駐.*?$/g, "")
    .replace(/・このテキスト.*?$/g, "")
    .replace(/※カウンター.*?$/g, "")
    .replace(/修正後は以下。.*$/g, "")
    .trim();
}

function extractWikiText(html, cardName) {
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const startIdx = lines.findIndex((l) => l === cardName || l.includes(cardName));
  if (startIdx < 0) return "";

  const stopWords = [
    "イラストレーター",
    "収録",
    "再録",
    "Q&A",
    "フレーバー",
    "カード評価",
    "関連カード",
    "コメント",
    "Menu",
    "メニュー",
  ];

  const chunks = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (stopWords.some((w) => line.startsWith(w))) break;
    if (line.startsWith("---")) break;
    if (line.includes("Wiki*")) continue;
    if (line.includes("ホーム|")) continue;
    chunks.push(line);
  }

  let text = chunks.join("");
  // Prefer errata-corrected text when present
  const errataMatch = plain.match(/修正後は以下。\s*([\s\S]*?)(?:イラストレーター|収録|Q&A|フレーバー|カード評価|$)/);
  if (errataMatch) {
    text = errataMatch[1].replace(/\s+/g, " ").trim();
  }

  return text.replace(/\s+/g, " ").trim();
}

async function fetchWiki(cardName) {
  const url = `https://wikiwiki.jp/renst/${encodeURIComponent(cardName)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "rangers-strike-verify/1.0" },
  });
  if (!res.ok) return { url, status: res.status, text: "" };
  const html = await res.text();
  return { url, status: res.status, text: extractWikiText(html, cardName) };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const results = { match: [], mismatch: [], missingWiki: [], missingLocal: [], fetchError: [] };

for (const card of allCards) {
  const local = canonicalText(card);
  if (!local) {
    results.missingLocal.push({ id: card.id, name: card.name, type: card.type });
    continue;
  }

  await sleep(120);
  let wiki;
  try {
    wiki = await fetchWiki(card.name);
  } catch (err) {
    results.fetchError.push({ id: card.id, name: card.name, error: String(err) });
    continue;
  }

  if (wiki.status === 404 || !wiki.text) {
    results.missingWiki.push({ id: card.id, name: card.name, url: wiki.url, status: wiki.status });
    continue;
  }

  const localNorm = normalize(local);
  const wikiNorm = normalize(wiki.text);

  if (localNorm === wikiNorm || localNorm.includes(wikiNorm) || wikiNorm.includes(localNorm)) {
    results.match.push(card.id);
  } else {
    results.mismatch.push({
      id: card.id,
      name: card.name,
      type: card.type,
      local,
      wiki: wiki.text,
      url: wiki.url,
    });
  }
}

console.log(JSON.stringify(results, null, 2));
console.error(
  `\nSummary: match=${results.match.length} mismatch=${results.mismatch.length} missingWiki=${results.missingWiki.length} missingLocal=${results.missingLocal.length} fetchError=${results.fetchError.length}`,
);
