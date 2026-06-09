#!/usr/bin/env node
/**
 * プロモーションカードの atwiki ページマップ
 * 出典: pages/513.html（PR/PK, PM-001, XGプロモ XP-[RS/RK], 大会専用 XC-*）
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT = path.join(packageRoot, "src/promo-atwiki-pages.json");

const INDEX_PAGE = 513;
const PM_PAGE = 743;
const SET_TITLE = "プロモーションカード";

/** 大会専用コマンダー（pages/513 クロスギャザー節・カードナンバーなし） */
const TOURNAMENT_PAGES = [
  { page: 2158, id: "XC-001", name: "ゾル大佐" },
  { page: 2159, id: "XC-002", name: "ヌマ・O長官" },
  { page: 2160, id: "XC-003", name: "マスター・シャーフー" },
  { page: 2161, id: "XC-004", name: "天空大聖者マジエル" },
  { page: 2162, id: "XC-005", name: "仮面ライダー1号・本郷猛" },
  { page: 2163, id: "XC-006", name: "ボウケンレッド・明石暁" },
  { page: 2164, id: "XC-007", name: "宇宙刑事ギャバン・一条寺烈" },
  { page: 2165, id: "XC-008", name: "シンケンレッド・志葉丈瑠" },
];

async function fetchHtml(pageId) {
  const res = await fetch(`https://w.atwiki.jp/renst/pages/${pageId}.html`, {
    headers: { "User-Agent": "rangers-strike-wiki-agent/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageId}`);
  return res.text();
}

function parsePrPk(html) {
  const slice = html.slice(html.indexOf("wikibody"));
  const map = {};
  const re =
    /pages\/(\d+)\.html[^>]*title="((?:PR|PK)-\d{3})[^"]*"[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(slice))) {
    const cardId = m[2].toUpperCase();
    const name = m[3].trim().replace(/^(?:PR|PK)-\d{3}\s+/, "");
    if (!map[cardId]) {
      map[cardId] = { page: Number(m[1]), name, setTitle: SET_TITLE, kind: "pr-pk" };
    }
  }
  return map;
}

function parseXpPromos(html) {
  const slice = html.slice(html.indexOf("クロスギャザー"));
  const end = slice.indexOf("トップページ");
  const body = end > 0 ? slice.slice(0, end) : slice;
  const map = {};
  const re =
    /pages\/(\d+)\.html[^>]*title="(XP-\d{3})\[(RS|RK)\][^"]*"[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(body))) {
    const cardId = m[2].toUpperCase();
    const edition = m[3];
    const name = m[4].trim().replace(/^XP-\d{3}\[(?:RS|RK)\]\s+/, "");
    if (!map[cardId]) {
      map[cardId] = {
        page: Number(m[1]),
        name,
        edition,
        setTitle: "プロモーションカード（クロスギャザー）",
        kind: "xp-promo",
      };
    }
  }
  return map;
}

function parsePm001() {
  return {
    "PM-001": {
      page: PM_PAGE,
      name: "ジライヤ",
      setTitle: "プロモーションカード（七忍の炎陣）",
      kind: "pm",
    },
  };
}

function parseTournament() {
  return Object.fromEntries(
    TOURNAMENT_PAGES.map(({ page, id, name }) => [
      id,
      {
        page,
        name,
        setTitle: "プロモーションカード（大会専用）",
        kind: "xc",
      },
    ]),
  );
}

function sortIds(ids) {
  return ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function main() {
  const html = await fetchHtml(INDEX_PAGE);
  const map = {
    ...parsePrPk(html),
    ...parsePm001(),
    ...parseXpPromos(html),
    ...parseTournament(),
  };

  const sorted = Object.fromEntries(
    sortIds(Object.keys(map)).map((id) => [id, map[id]]),
  );

  await writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  const counts = { "pr-pk": 0, pm: 0, "xp-promo": 0, xc: 0 };
  for (const v of Object.values(sorted)) counts[v.kind] = (counts[v.kind] ?? 0) + 1;
  console.log(`Wrote ${Object.keys(sorted).length} → ${OUT}`, counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
