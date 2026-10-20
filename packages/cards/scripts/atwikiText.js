/** atwiki ページ HTML（wikibody ブロック）からカード効果文を抽出。 */

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

/** 「テキスト」直上のステータスブロックを解析（種類/BP/特徴 等）。 */
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

/** atwiki スナップショット（docs/wiki/sources/atwiki/page-N-*.md）の本文で効果文の終わりを示す見出し。 */
const SOURCE_EFFECT_END_LABELS = [
  "フレーバーテキスト",
  // 表記ゆれ（atwiki/page-224 RK-052「フレーバテキスト」）。
  "フレーバテキスト",
  "イラストレーター",
  "レアリティ",
  "Q&A",
  "関連カード",
];

/**
 * 「テキスト」見出し。全角コロン「テキスト：」に加え、半角コロン「テキスト:」と
 * コロンなしで行が終わる「テキスト」も受け付ける（E7: これらを取りこぼすと効果文が空になる）。
 * 「フレーバーテキスト」「効果名を持つテキスト」などの本文中の語には一致させない。
 */
const SOURCE_EFFECT_LABEL =
  /(?:^|\n)[ \t]*テキスト[ \t]*(?:[：:][ \t]*|(?=\r?\n))/;

/**
 * atwiki スナップショット本文（プレーンテキスト）から効果文を抽出する。
 * 空行はまとめ、「テキスト」見出しがなければ空文字を返す。
 */
export function extractEffectTextFromAtwikiSource(body) {
  const m = SOURCE_EFFECT_LABEL.exec(body);
  if (!m) return "";
  let chunk = body.slice(m.index + m[0].length).trimStart();
  for (const end of SOURCE_EFFECT_END_LABELS) {
    const i = chunk.indexOf(end);
    if (i >= 0) chunk = chunk.slice(0, i);
  }
  return chunk.replace(/\n{2,}/g, "\n").trim();
}
