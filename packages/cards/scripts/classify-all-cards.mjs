/**
 * 全 Wiki カード（docs/wiki/cards/*.md）を A〜E に分類し集計する。
 *
 * A: Vanilla — 効果文なし
 * B: 単純 Effect — 単一 primitive 相当
 * C: 中程度 Effect — 複合 DSL / 常駐 / 条件付き
 * D: 特殊裁定 — キーワード・FAQ 依存・コンボ特例
 * E: エンジン変更 — コマンダー・母艦・多段ウィザード・新 State
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wikiDir = join(__dirname, "../../../docs/wiki/cards");
const outDir = join(__dirname, "../pipeline/data");
mkdirSync(outDir, { recursive: true });

const FORCE_E = new Set([
  "RS-001", "RS-002", "RS-004", "RS-008", "RS-009", "RS-013", "RS-003",
  "RS-115", "RS-124", "RS-125", "RS-140", "RS-071", "RS-072",
]);

const COMMANDER_ID = /^(XC-|SM-)/;

const ENGINE_RE = [
  /次の効果から1つ選び/,
  /ゲーム開始/,
  /コマンダーゾーン/,
  /コピーして|コピーする/,
  /デッキを.{0,10}枚.{0,8}増やす/,
  /コンビネーションナンバー.{0,15}(すべて|全て).{0,8}(少なく|１少なく|1少なく)/,
  /(?<!\d)\d+番目のユニット|(?<!\d)\d+番目にコンビネーション/,
  /山札の上から3枚をオモテにして相手に見せ/,
  /オモテにして相手に見せ.{0,20}手札に加え/,
  /合体に必要なユニットのカードを捨札から探して/,
  /常駐オペレーションは無効になり/,
  /レジスト/,
  /母艦|モノシップ/,
  /デッキの上から\d+枚.{0,30}デッキの下から\d+枚/,
  /山札.{0,6}枚.{0,6}デッキの.{0,6}上.{0,30}下/,
];

const RULING_RE = [
  /ウイング/,
  /チェイス/,
  /ジョイントコンボ/,
  /ライディングコンボ/,
  /コンビネーションするときは.{0,24}ナンバーに関係なく/,
  /本来の値としてバトル/,
  /相手に1枚選ばせ|相手は.{0,12}選んでホールド/,
  /かわりにバトル|かわりに捨札/,
  /ストライク.{0,10}無効/,
  /BPの合計が\d+/,
  /すべてホールドしてもよい/,
  /同じようにする/,
  /効果は発動しない/,
  /公開して/,
  /同時に発動/,
];

const SIMPLE_BODY_RE = [
  /^「SP\d+」$/,
  /^自分は1枚ドローする/,
  /^自分は\d+枚ドローする/,
  /このカードを自軍パワーゾーンに置く/,
  /自軍捨札からSユニット1枚を選び、手札に加える/,
  /自軍捨札からカード1枚を選び、手札に加える/,
  /自軍ユニットを1体選ぶ。このターン、選んだユニットはBP＋\d+される/,
  /敵軍バトルエリアからBP\d+以下のユニットを1体選んで撃破/,
  /これがバトルエリアに出たとき、敵軍バトルエリアからBP\d+以下のユニットを1体選んで撃破/,
  /これをラッシュしたとき発動できる。敵軍バトルエリアからBP\d+以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る/,
  /BP\d+以下のユニットを1体選んで持ち主の山札の上に戻してもよい/,
  /敵軍コマンドゾーンからカードを1枚選んで、持ち主の手札に戻してもよい/,
  /自軍Sユニットがアタックされたとき発動できる。アタックされたユニットをラッシュエリアに戻す/,
  /アタックされたユニットをラッシュエリアに戻す。このときバトルは行われない/,
  /「SP1」$/,
  /「SP1」これは/,
  /BP8000以下の敵軍ユニットを1体選ぶ。選んだユニットを持ち主のコマンドゾーンにホールド/,
  /BP8000以下のユニットを1体選ぶ。選んだユニットを持ち主のパワーゾーンに送る/,
  /敵軍Lユニットを1体選んで撃破する/,
  /山札の上から1枚を見てもよい。そうしたとき、それを元に戻すか、山札の下に戻すかを選択/,
  /山札の上から3枚を見てもよい。そうしたとき、1枚選んで山札の上に戻し、それ以外を捨札にする/,
];

const SIMPLE_NOTE_RE = [
  /^※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。$/,
  /^※これは「.+」としてつかえる。$/,
];

function extractEffectTexts(content) {
  const texts = [];
  const re = /(?:^|\n)(?:atwiki 効果文|効果文[^:\n]*):\s*\n> (.+?)(?=\n\n|\natwiki ステータス|\n## |\nconfidence:|\n発動条件:)/gs;
  let m;
  while ((m = re.exec(content)) !== null) {
    const t = m[1].replace(/\n> /g, "\n").trim();
    if (t && !t.includes("atwiki 未取得") && t !== "—" && t !== "UNKNOWN") {
      texts.push(t.replace(/\s+/g, " ").trim());
    }
  }
  return [...new Set(texts)];
}

function extractCardType(content) {
  const m = content.match(/種類:\s*(.+)/);
  return m ? m[1].trim() : undefined;
}

function splitSegments(text) {
  const named = [...text.matchAll(/【([^】]+)】([^【※]*)/g)].map((x) => ({
    kind: "named",
    name: x[1],
    body: x[2].trim(),
  }));
  const notes = [...text.matchAll(/※([^【※]+)/g)].map((x) => ({
    kind: "note",
    body: `※${x[1].trim()}`,
  }));
  return [...named, ...notes];
}

function matchesAny(text, patterns) {
  return patterns.some((p) => p.test(text));
}

function isSimpleBody(body) {
  const b = body.replace(/\s+/g, "");
  return SIMPLE_BODY_RE.some((p) => p.test(body) || p.test(b));
}

function isAliasOrSimpleNote(body) {
  return SIMPLE_NOTE_RE.some((p) => p.test(body)) || /としてつかえる/.test(body);
}

function classifySegments(segments) {
  if (segments.length === 0) return "A";

  const named = segments.filter((s) => s.kind === "named");
  const notes = segments.filter((s) => s.kind === "note");

  if (segments.every((s) => s.kind === "note" && isAliasOrSimpleNote(s.body))) return "B";

  if (named.length === 1 && notes.every((n) => isAliasOrSimpleNote(n.body)) && isSimpleBody(named[0].body)) {
    return "B";
  }
  if (named.length === 1 && notes.length === 0 && isSimpleBody(named[0].body)) return "B";
  if (named.length === 0 && notes.length === 1 && isAliasOrSimpleNote(notes[0].body)) return "B";

  if (named.length === 1 && isSimpleBody(named[0].body) && notes.length <= 1) return "B";

  return "C";
}

function classifyCard(id, content) {
  const reasons = [];
  const effectTexts = extractEffectTexts(content);
  const combined = effectTexts.join("\n");
  const hasFaq = /## grnrngr 公式FAQ|atwiki Q&A/.test(content);
  const cardType = extractCardType(content);

  if (FORCE_E.has(id) || COMMANDER_ID.test(id)) {
    return { id, grade: "E", reasons: ["forced_e"], effectTexts };
  }
  if (cardType?.includes("コマンダー") || (/コマンダー/.test(combined) && COMMANDER_ID.test(id) === false && /種類:\s*コマンダー/.test(content))) {
    return { id, grade: "E", reasons: ["commander_type"], effectTexts };
  }
  if (matchesAny(combined, ENGINE_RE)) {
    return { id, grade: "E", reasons: ["engine_pattern"], effectTexts };
  }

  if (effectTexts.length === 0) {
    return { id, grade: "A", reasons: ["no_effect_text"], effectTexts };
  }

  const segments = effectTexts.flatMap(splitSegments);
  let base = classifySegments(segments);

  if (base === "C" && segments.length <= 2) {
    const bodies = segments.map((s) => s.body).join(" ");
    if (isSimpleBody(bodies)) base = "B";
  }

  if (matchesAny(combined, RULING_RE)) {
    return { id, grade: "D", reasons: ["ruling_keyword"], effectTexts };
  }

  if (hasFaq && base === "C") {
    const named = segments.filter((s) => s.kind === "named");
    const uniqueNamed = [...new Map(named.map((n) => [n.name + n.body, n])).values()];
    const complexFaq =
      uniqueNamed.length > 1 ||
      uniqueNamed.some((n) => !isSimpleBody(n.body)) ||
      /ただし|すべて|同時|無効|コンビネーションナンバー/.test(combined);
    if (complexFaq) {
      return { id, grade: "D", reasons: ["faq_complex"], effectTexts };
    }
  }

  return { id, grade: base, reasons: [base === "B" ? "simple_effect" : base === "A" ? "vanilla" : "medium"], effectTexts };
}

const files = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
const results = files.map((f) => classifyCard(f.replace(/\.md$/, ""), readFileSync(join(wikiDir, f), "utf8")));

const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
for (const r of results) counts[r.grade] += 1;

const byPrefix = {};
for (const r of results) {
  const prefix = r.id.replace(/-\d+$/, "");
  if (!byPrefix[prefix]) byPrefix[prefix] = { A: 0, B: 0, C: 0, D: 0, E: 0, total: 0 };
  byPrefix[prefix][r.grade] += 1;
  byPrefix[prefix].total += 1;
}

const byType = {};
for (const r of results) {
  const content = readFileSync(join(wikiDir, `${r.id}.md`), "utf8");
  const t = extractCardType(content) ?? "unknown";
  if (!byType[t]) byType[t] = { A: 0, B: 0, C: 0, D: 0, E: 0, total: 0 };
  byType[t][r.grade] += 1;
  byType[t].total += 1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  counts,
  percentages: Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, Math.round((v / results.length) * 1000) / 10]),
  ),
  byPrefix,
  byType,
};

writeFileSync(join(outDir, "card-classification.json"), JSON.stringify({ summary, cards: results }, null, 2));

console.log("=== 全カード分類 A〜E ===");
console.log(`total: ${summary.total}`);
for (const g of ["A", "B", "C", "D", "E"]) {
  console.log(`  ${g}: ${counts[g]} (${summary.percentages[g]}%)`);
}
