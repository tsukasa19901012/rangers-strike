#!/usr/bin/env node
/**
 * リポジトリ内のカード効果テキストを公式 Wiki ページと照合する。
 * - レジェンド1 / 2: wikiwiki.jp/renst/{cardName}
 * - レジェンド3: w.atwiki.jp/renst/pages/{page}.html
 *
 * 使い方:
 *   node scripts/verify-wiki-effects.mjs
 *   node scripts/verify-wiki-effects.mjs --expansion legend3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractEffectTextFromAtwikiHtml,
  fetchAtwikiPage,
} from "../packages/cards/scripts/atwikiText.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardsRoot = path.join(root, "packages/cards/src");

const expansionArg = process.argv.find((arg) => arg.startsWith("--expansion="));
const expansionFilter = expansionArg?.split("=")[1] ?? "all";

const l1 = JSON.parse(fs.readFileSync(path.join(cardsRoot, "legend1/cards.json"), "utf8"));
const l2 = JSON.parse(fs.readFileSync(path.join(cardsRoot, "legend2/cards.json"), "utf8"));
const l3 = JSON.parse(fs.readFileSync(path.join(cardsRoot, "legend3/cards.json"), "utf8"));
const ue1 = JSON.parse(fs.readFileSync(path.join(cardsRoot, "legend1/unitEffects.json"), "utf8"));
const ue2 = JSON.parse(fs.readFileSync(path.join(cardsRoot, "legend2/unitEffects.json"), "utf8"));
const ue3 = JSON.parse(fs.readFileSync(path.join(cardsRoot, "legend3/unitEffects.json"), "utf8"));
const atwikiPages = JSON.parse(
  fs.readFileSync(path.join(cardsRoot, "legend3/atwiki-pages.json"), "utf8"),
);

/** @type {Record<string, string>} */
const wikiOps = {};
const wikiRef = fs.readFileSync(path.join(cardsRoot, "wikiReference.ts"), "utf8");
for (const match of wikiRef.matchAll(/"(RS-\d+|SR-\d+)":\s*(?:"([^"]+)"|(?:\n\s*"([^"]+)"))/g)) {
  wikiOps[match[1]] = match[2] ?? match[3] ?? "";
}

/** @type {Record<string, string>} */
const errata = {};
const errataSrc = fs.readFileSync(path.join(cardsRoot, "errata.ts"), "utf8");
for (const match of errataSrc.matchAll(/"(RS-\d+|SR-\d+)":\s*\n\s*"([^"]+)"/g)) {
  errata[match[1]] = match[2];
}

/** @type {{ expansion: string, cards: object[] }[]} */
const expansions = [
  { expansion: "legend1", cards: l1.cards },
  { expansion: "legend2", cards: l2.cards },
  { expansion: "legend3", cards: l3.cards },
].filter(
  (entry) => expansionFilter === "all" || entry.expansion === expansionFilter,
);

function canonicalText(card) {
  if (card.type === "operation") {
    return errata[card.id] ?? wikiOps[card.id] ?? card.text ?? "";
  }
  const block = ue1[card.id] ?? ue2[card.id] ?? ue3[card.id];
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
    .replace(/※常駐.*?$/g, "")
    .replace(/修正後は以下。.*$/g, "")
    .trim();
}

function textsMatch(local, wiki) {
  const localNorm = normalize(local);
  const wikiNorm = normalize(wiki);
  return (
    localNorm === wikiNorm ||
    localNorm.includes(wikiNorm) ||
    wikiNorm.includes(localNorm)
  );
}

function extractWikiwikiText(html, cardName) {
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
    .map((line) => line.trim())
    .filter(Boolean);

  const startIdx = lines.findIndex((line) => line === cardName || line.includes(cardName));
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
    if (stopWords.some((word) => line.startsWith(word))) break;
    if (line.startsWith("---")) break;
    if (line.includes("Wiki*")) continue;
    if (line.includes("ホーム|")) continue;
    chunks.push(line);
  }

  let text = chunks.join("");
  const errataMatch = plain.match(
    /修正後は以下。\s*([\s\S]*?)(?:イラストレーター|収録|Q&A|フレーバー|カード評価|$)/,
  );
  if (errataMatch) {
    text = errataMatch[1].replace(/\s+/g, " ").trim();
  }

  return text.replace(/\s+/g, " ").trim();
}

async function fetchWikiwiki(cardName) {
  const url = `https://wikiwiki.jp/renst/${encodeURIComponent(cardName)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "rangers-strike-verify/1.0" },
  });
  if (!res.ok) return { url, status: res.status, text: "" };
  const html = await res.text();
  return { url, status: res.status, text: extractWikiwikiText(html, cardName) };
}

async function fetchAtwiki(cardId) {
  const meta = atwikiPages[cardId];
  if (!meta) {
    return { url: "", status: 0, text: "" };
  }
  const url = `https://w.atwiki.jp/renst/pages/${meta.page}.html`;
  try {
    const html = await fetchAtwikiPage(meta.page);
    return { url, status: 200, text: extractEffectTextFromAtwikiHtml(html) };
  } catch (err) {
    const status = String(err).includes("HTTP 404") ? 404 : 0;
    return { url, status, text: "", error: String(err) };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyResults() {
  return {
    match: [],
    mismatch: [],
    missingWiki: [],
    missingLocal: [],
    fetchError: [],
  };
}

/** @type {Record<string, ReturnType<typeof emptyResults>>} */
const byExpansion = {};
/** @type {ReturnType<typeof emptyResults>} */
const total = emptyResults();

for (const { expansion, cards } of expansions) {
  byExpansion[expansion] = emptyResults();

  for (const card of cards) {
    const bucket = byExpansion[expansion];
    const local = canonicalText(card);
    if (!local) {
      bucket.missingLocal.push({ id: card.id, name: card.name, type: card.type });
      total.missingLocal.push({ id: card.id, name: card.name, type: card.type, expansion });
      continue;
    }

    await sleep(120);

    let wiki;
    try {
      wiki =
        expansion === "legend3"
          ? await fetchAtwiki(card.id)
          : await fetchWikiwiki(card.name);
    } catch (err) {
      const entry = { id: card.id, name: card.name, error: String(err) };
      bucket.fetchError.push(entry);
      total.fetchError.push({ ...entry, expansion });
      continue;
    }

    if (wiki.error) {
      const entry = { id: card.id, name: card.name, error: wiki.error, url: wiki.url };
      bucket.fetchError.push(entry);
      total.fetchError.push({ ...entry, expansion });
      continue;
    }

    if (wiki.status === 404 || !wiki.text) {
      const entry = { id: card.id, name: card.name, url: wiki.url, status: wiki.status };
      bucket.missingWiki.push(entry);
      total.missingWiki.push({ ...entry, expansion });
      continue;
    }

    if (textsMatch(local, wiki.text)) {
      bucket.match.push(card.id);
      total.match.push(card.id);
    } else {
      const entry = {
        id: card.id,
        name: card.name,
        type: card.type,
        local,
        wiki: wiki.text,
        url: wiki.url,
      };
      bucket.mismatch.push(entry);
      total.mismatch.push({ ...entry, expansion });
    }
  }
}

console.log(JSON.stringify({ byExpansion, total }, null, 2));

for (const [expansion, results] of Object.entries(byExpansion)) {
  console.error(
    `\n[${expansion}] match=${results.match.length} mismatch=${results.mismatch.length} missingWiki=${results.missingWiki.length} missingLocal=${results.missingLocal.length} fetchError=${results.fetchError.length}`,
  );
}

console.error(
  `\nTotal: match=${total.match.length} mismatch=${total.mismatch.length} missingWiki=${total.missingWiki.length} missingLocal=${total.missingLocal.length} fetchError=${total.fetchError.length}`,
);
