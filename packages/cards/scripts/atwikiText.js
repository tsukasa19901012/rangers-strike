/** Extract card effect text from atwiki page HTML (wikibody block). */

function htmlFragmentToText(fragment) {
  return fragment
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#[0-9]+;/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEffectTextFromAtwikiHtml(html) {
  const bodyIdx = html.indexOf('wikibody"');
  const slice = bodyIdx >= 0 ? html.slice(bodyIdx) : html;

  const errataMatch = slice.match(
    /修正後は以下。[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (errataMatch) {
    const text = htmlFragmentToText(errataMatch[1]);
    if (text) return text;
  }

  const textHeading = slice.match(
    /<h3[^>]*>[\s\S]*?テキスト[\s\S]*?<\/h3>\s*<div[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (textHeading) {
    const text = htmlFragmentToText(textHeading[1]);
    if (text && text !== "なし") return text;
  }

  return "";
}

function wikibodySlice(html) {
  const bodyIdx = html.indexOf('wikibody"');
  return bodyIdx >= 0 ? html.slice(bodyIdx) : html;
}

/** Parse the stat block above テキスト (種類/BP/特徴 etc.). */
export function extractCardMetaFromAtwikiHtml(html) {
  const slice = wikibodySlice(html);
  const statsMatch = slice.match(
    /<blockquote>[\s\S]*?<h3[^>]*>[\s\S]*?<\/h3>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<h3[^>]*>[\s\S]*?テキスト/i,
  );
  if (!statsMatch) return {};

  const plain = htmlFragmentToText(statsMatch[1])
    .replace(/種類：/g, "\n種類：")
    .replace(/カテゴリ：/g, "\nカテゴリ：")
    .replace(/BP：/g, "\nBP：")
    .replace(/SP：/g, "\nSP：")
    .replace(/必要パワー：/g, "\n必要パワー：")
    .replace(/追加条件：/g, "\n追加条件：")
    .replace(/CN：/g, "\nCN：")
    .replace(/特徴：/g, "\n特徴：");

  const pick = (label) => {
    const m = plain.match(new RegExp(`${label}：([^\\n]+)`));
    return m?.[1]?.trim() ?? "";
  };

  const featuresRaw = pick("特徴");
  return {
    種類: pick("種類"),
    カテゴリ: pick("カテゴリ"),
    BP: pick("BP"),
    SP: pick("SP"),
    必要パワー: pick("必要パワー"),
    追加条件: pick("追加条件"),
    CN: pick("CN"),
    特徴: featuresRaw,
  };
}

export async function fetchAtwikiPage(page) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${page}.html`, {
    headers: { "User-Agent": "rangers-strike-text-import/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for page ${page}`);
  return res.text();
}

export async function fetchAtwikiEffectText(page) {
  const html = await fetchAtwikiPage(page);
  return extractEffectTextFromAtwikiHtml(html);
}
