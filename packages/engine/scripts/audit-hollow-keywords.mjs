// 全カードの grant_keyword がエンジン内で参照されているかの静的監査
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/tsukasa_yamato/Projects/rangers-strike/packages";
const bundle = JSON.parse(readFileSync(join(root, "cards/src/generated/dsl-stubs/stubs-bundle.json"), "utf8"));

// エンジンソースを全結合（generated 含む: specs にキーワードが載っていれば消費側とみなす候補）
function collectSrc(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name === "node_modules") continue; collectSrc(full, acc); continue; }
    if (/\.(ts|tsx)$/.test(e.name) && !e.name.includes(".test.")) acc.push(full);
  }
}
const files = [];
collectSrc(join(root, "engine/src"), files);
const engineSrc = files.map((f) => readFileSync(f, "utf8")).join("\n");

// キーワード収集
const keywordCards = new Map(); // keyword -> Set(cardId)
for (const [cardId, doc] of Object.entries(bundle)) {
  for (const effect of doc.effects ?? []) {
    for (const p of effect.effects ?? []) {
      if (p.type !== "grant_keyword") continue;
      const kw = p.keyword;
      if (!keywordCards.has(kw)) keywordCards.set(kw, new Set());
      keywordCards.get(kw).add(cardId);
    }
  }
}

// 動的キーワード（::区切り / 末尾パラメータ）: プレフィックスハンドラで消費されるか
const PREFIX_HANDLED = [
  "rk_fx::", "rm_fx::", "pr_fx::", "effect_card::", "note_card::",
];
// エンジンが startsWith / 正規表現で扱う既知プレフィックス（ソース中の startsWith を抽出）
const startsWithMatches = [...engineSrc.matchAll(/startsWith\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1]);
const includesMatches = [...engineSrc.matchAll(/keyword\.includes\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1]);
const prefixes = [...new Set([...PREFIX_HANDLED, ...startsWithMatches])].filter((p) => p.length >= 4);

// エンジン内の正規表現リテラルを収集してキーワードマッチ判定に使う
const regexLiterals = [];
for (const m of engineSrc.matchAll(/\/((?:[^\/\\\n]|\\.)+)\/[gimsuy]*/g)) {
  const src = m[1];
  if (src.length < 6) continue;
  if (!/[_a-z]{3,}/.test(src)) continue;
  try { regexLiterals.push(new RegExp(src)); } catch { /* ignore */ }
}
function regexConsumed(kw) {
  for (const re of regexLiterals) {
    try {
      const m = kw.match(re);
      // キーワード全体か大部分にマッチし、regex が固有語を含む場合のみ消費とみなす
      if (m && m[0].length >= Math.min(kw.length, 6) && /[a-z]{3,}/.test(re.source)) return true;
    } catch { /* ignore */ }
  }
  return false;
}

let unconsumed = [];
for (const [kw, cards] of keywordCards) {
  // 1) エンジンソースに完全一致文字列があれば消費とみなす
  if (engineSrc.includes(`"${kw}"`) || engineSrc.includes(`'${kw}'`) || engineSrc.includes("`" + kw + "`")) continue;
  // 2) 既知プレフィックス
  if (prefixes.some((p) => kw.startsWith(p))) continue;
  // 3) :: 付きは base 部で判定
  const base = kw.includes("::") ? kw.split("::")[0] + "::" : null;
  if (base && (engineSrc.includes(`"${base}`) || prefixes.some((p) => base.startsWith(p)))) continue;
  // 4) パラメータ付き keyword_1234 → ベース名で判定
  const paramBase = kw.replace(/_\d+$/, "_");
  if (paramBase !== kw && (engineSrc.includes(`"${paramBase}`) || engineSrc.includes(`'${paramBase}`) || engineSrc.includes("`" + paramBase))) continue;
  // 5) エンジン内正規表現でマッチするキーワードは消費とみなす
  if (regexConsumed(kw)) continue;
  // 6) 全該当カードの ID がエンジンソースに直書きされていれば実装済みとみなす
  const allByCardId = [...cards].every((id) => engineSrc.includes(`"${id}"`) || engineSrc.includes(`'${id}'`));
  if (allByCardId) continue;
  unconsumed.push({ kw, count: cards.size, sample: [...cards].slice(0, 4) });
}
unconsumed.sort((a, b) => b.count - a.count);
console.log("total keywords:", keywordCards.size, " unconsumed:", unconsumed.length);
const totalCards = new Set(unconsumed.flatMap((u) => u.sample));
let cardSet = new Set();
for (const u of unconsumed) for (const c of keywordCards.get(u.kw)) cardSet.add(c);
console.log("cards affected:", cardSet.size);
for (const u of unconsumed.slice(0, 60)) console.log(String(u.count).padStart(3), u.kw, "->", u.sample.join(","));
