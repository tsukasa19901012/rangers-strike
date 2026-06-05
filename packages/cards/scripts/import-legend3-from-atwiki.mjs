#!/usr/bin/env node
/**
 * Build legend3/cards.json from atwiki og:description metadata + grnrngr card list.
 * Images: run `node scripts/download-images.mjs legend3` after this script.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAtwikiEffectText } from "./atwikiText.js";
import { buildLegend3Card } from "./legend3CardBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const outPath = path.join(packageRoot, "src/legend3/cards.json");
const pagesPath = path.join(packageRoot, "src/legend3/atwiki-pages.json");

/** grnrngr.com series-3 list (RS-123 … RS-178, SR-001). */
const MANIFEST = [
  ["RS-123", "スーパーダイナマイト", "operation", "N"],
  ["RS-124", "超電子レーダー", "operation", "N"],
  ["RS-125", "百獣アニマルハート", "operation", "N"],
  ["RS-126", "アカレンジャー", "unit", "SR"],
  ["RS-127", "バイオロボ", "unit", "SR"],
  ["RS-128", "バイオジェット1号", "unit", "N"],
  ["RS-129", "バイオジェット2号", "unit", "N"],
  ["RS-130", "レッドワン", "unit", "N"],
  ["RS-131", "メッツラー", "unit", "R"],
  ["RS-132", "バルジオン", "unit", "R"],
  ["RS-133", "副官ブーバ", "unit", "N"],
  ["RS-134", "ライブロボ", "unit", "R"],
  ["RS-135", "ジェットファルコン", "unit", "N"],
  ["RS-136", "ランドライオン", "unit", "N"],
  ["RS-137", "アクアドルフィン", "unit", "N"],
  ["RS-138", "イエローライオン", "unit", "N"],
  ["RS-139", "ブルードルフィン", "unit", "N"],
  ["RS-140", "コロン", "unit", "N"],
  ["RS-141", "紐男爵", "unit", "N"],
  ["RS-142", "オーレンジャーロボ", "unit", "SR"],
  ["RS-143", "スカイフェニックス", "unit", "N"],
  ["RS-144", "グランタウラス", "unit", "N"],
  ["RS-145", "ダッシュレオン", "unit", "N"],
  ["RS-146", "ドグランダー", "unit", "N"],
  ["RS-147", "モアローダー", "unit", "N"],
  ["RS-148", "オーレッド", "unit", "N"],
  ["RS-149", "イエローレーサー", "unit", "N"],
  ["RS-150", "ピンクレーサー", "unit", "N"],
  ["RS-151", "ガオキング", "unit", "SR"],
  ["RS-152", "ガオライオン", "unit", "R"],
  ["RS-153", "ガオイーグル", "unit", "N"],
  ["RS-154", "ガオシャーク", "unit", "N"],
  ["RS-155", "ガオバイソン", "unit", "N"],
  ["RS-156", "ガオタイガー", "unit", "N"],
  ["RS-157", "ガオジュラフ", "unit", "N"],
  ["RS-158", "ガオエレファント", "unit", "N"],
  ["RS-159", "ガオコング", "unit", "N"],
  ["RS-160", "ガオレッド", "unit", "R"],
  ["RS-161", "ガオイエロー", "unit", "N"],
  ["RS-162", "ガオブルー", "unit", "N"],
  ["RS-163", "ガオブラック", "unit", "N"],
  ["RS-164", "ガオホワイト", "unit", "N"],
  ["RS-165", "狼鬼", "unit", "N"],
  ["RS-166", "ガインガイン", "unit", "R"],
  ["RS-167", "爆竜バキケロナグルス", "unit", "N"],
  ["RS-168", "爆竜ディメノコドン", "unit", "N"],
  ["RS-169", "ファンクラッシャー", "unit", "N"],
  ["RS-170", "エージェント・アブレラ", "unit", "N"],
  ["RS-171", "ゴーゴードリル", "unit", "N"],
  ["RS-172", "ゴーゴーショベル", "unit", "N"],
  ["RS-173", "ゴーゴーミキサー", "unit", "N"],
  ["RS-174", "ゴーゴークレーン", "unit", "N"],
  ["RS-175", "ガオナイト", "unit", "R"],
  ["RS-176", "ダイタンケン", "unit", "SR"],
  ["RS-177", "ゴーゴージェット", "unit", "R"],
  ["RS-178", "ボウケンシルバー", "unit", "SR"],
  ["SR-001", "ガオキング", "unit", "SC"],
];

const NAME_TO_ID = new Map(MANIFEST.map(([id, name]) => [name, id]));

const CAT_MAP = {
  アーステクノロジー: "ET",
  ワイルドビースト: "WB",
  オーバーテクノロジー: "OT",
  ミスティックアームズ: "MA",
  ダークアライアンス: "DA",
};

const SIZE_MAP = {
  Sユニット: "S",
  Mユニット: "M",
  Lユニット: "L",
  XLユニット: "XL",
  SCユニット: "SC",
};

function parseDesc(desc) {
  const out = {};
  for (const f of [
    "種類",
    "カテゴリ",
    "BP",
    "SP",
    "必要パワー",
    "追加条件",
    "CN",
    "特徴",
    "テキスト",
  ]) {
    const re = new RegExp(
      `${f}[：:]([^\\n]+?)(?=\\s*(?:種類|カテゴリ|BP|SP|必要パワー|追加条件|CN|特徴|テキスト)[：:]|$)`,
    );
    const m = desc.match(re);
    if (m) out[f] = m[1].trim();
  }
  return out;
}

function parseSp(raw) {
  if (!raw || raw === "なし" || raw === "－" || raw === "-") return null;
  if (raw === "！" || raw === "!") return "special";
  const n = Number(raw.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseComboNumber(raw) {
  if (!raw || raw === "なし") return null;
  if (raw === "L" || raw === "R" || raw === "RC") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parsePowerCost(raw) {
  if (!raw) return 0;
  const normalized = raw.replace(/[＋+]/g, "+").replace(/[－-]/g, "-").trim();
  if (normalized.endsWith("+") || normalized.endsWith("-")) return normalized;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : normalized;
}

function inferRushAdditionalCondition(addCond, powerCost) {
  if (!addCond || addCond === "なし") return undefined;
  if (!String(powerCost).includes("+")) return undefined;
  if (addCond.includes("合体ユニット")) {
    return { conditionId: "discard_fusion_unit", text: addCond };
  }
  const countMatch = addCond.match(/(\d+)体/);
  const unitCount = countMatch ? Number(countMatch[1]) : 1;
  if (addCond.includes("コマンドゾーンに送るか捨札")) {
    return {
      conditionId: "send_s_unit_to_command_or_discard",
      text: addCond,
      unitCount,
    };
  }
  if (addCond.includes("捨札") && addCond.includes("Sユニット")) {
    return { conditionId: "send_s_unit_to_discard", text: addCond, unitCount };
  }
  if (addCond.includes("パワーゾーン")) {
    return { conditionId: "send_s_unit_to_power", text: addCond, unitCount };
  }
  return undefined;
}

function buildCard(id, name, typeHint, rarity, meta) {
  const category = CAT_MAP[meta["カテゴリ"]] ?? "ET";
  const cardType =
    meta["種類"] === "オペレーション" ? "operation" : typeHint === "unit" ? "unit" : typeHint;
  const powerCost = parsePowerCost(meta["必要パワー"]);
  const card = {
    id,
    name,
    type: cardType,
    category,
    rarity,
    expansion: "legend3",
    powerCost,
  };

  if (cardType === "unit") {
    card.size = SIZE_MAP[meta["種類"]] ?? "S";
    const bp = Number(meta["BP"]);
    if (Number.isFinite(bp)) card.bp = bp;
    const sp = parseSp(meta["SP"]);
    if (sp !== null) card.sp = sp;
    const combo = parseComboNumber(meta["CN"]);
    if (combo !== null) card.comboNumber = combo;
    if (meta["特徴"] && meta["特徴"] !== "なし") {
      card.features = meta["特徴"].split(/[／/]/).map((s) => s.trim()).filter(Boolean);
    }
    const rush = inferRushAdditionalCondition(meta["追加条件"], powerCost);
    if (rush) card.rushAdditionalCondition = rush;
  }

  return card;
}

async function fetchPageMeta(page) {
  const html = await fetch(`https://w.atwiki.jp/renst/pages/${page}.html`, {
    headers: { "User-Agent": "rangers-strike-import/1.0" },
  }).then((r) => (r.ok ? r.text() : ""));
  if (!html) return null;
  const desc = html
    .match(/og:description" content="([^"]+)"/)?.[1]
    ?.replace(/&quot;/g, '"')
    ?.replace(/&amp;/g, "&");
  const title = html.match(/og:title" content="([^"]+) -/)?.[1];
  if (!desc || !title || !desc.startsWith(`${title} `)) return null;
  const id = NAME_TO_ID.get(title);
  if (!id) return null;
  return { id, title, meta: parseDesc(desc) };
}

async function scanAtwiki() {
  const byId = {};
  for (let start = 1; start <= 1200; start += 25) {
    const pages = Array.from({ length: 25 }, (_, i) => start + i);
    const results = await Promise.all(pages.map(fetchPageMeta));
    for (const r of results) {
      if (r) byId[r.id] = r.meta;
    }
    await new Promise((r) => setTimeout(r, 60));
    process.stderr.write(`scanned ${start}…\n`);
  }
  return byId;
}

async function main() {
  const metaById = await scanAtwiki();

  // RS-151 shares the ガオキング page with SR-001 (page 17 metadata).
  if (!metaById["RS-151"] && metaById["SR-001"]) {
    metaById["RS-151"] = metaById["SR-001"];
  }

  const missing = MANIFEST.filter(([id]) => !metaById[id]).map(([id]) => id);
  if (missing.length > 0) {
    throw new Error(`Missing atwiki metadata for: ${missing.join(", ")}`);
  }

  let pageMap = {};
  try {
    pageMap = JSON.parse(await readFile(pagesPath, "utf8"));
  } catch {
    /* generated on first import run */
  }

  const cards = [];
  for (const [id, name, type, rarity] of MANIFEST) {
    const card = buildCard(id, name, type, rarity, metaById[id]);
    const page = pageMap[id]?.page;
    if (page) {
      const text = await fetchAtwikiEffectText(page);
      if (text) card.text = text;
      await new Promise((r) => setTimeout(r, 60));
    }
    cards.push(card);
  }
  cards.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const catalog = { expansion: "legend3", cards };
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${cards.length} cards to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
