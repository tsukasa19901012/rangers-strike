// 常駐オペレーションで「常駐マーカーのみ・実処理なし」のカードを列挙
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// packages/ ディレクトリ（このスクリプトからの相対位置で解決）
const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
function collectSrc(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name === "node_modules") continue; collectSrc(full, acc); continue; }
    if (/\.(ts|tsx)$/.test(e.name) && !e.name.includes(".test.")) acc.push(full);
  }
}
const files = [];
collectSrc(join(packagesRoot, "engine/src"), files);
collectSrc(join(packagesRoot, "cards/src"), files);
const engineSrc = files.filter((f)=>!f.includes("generated")).map((f) => readFileSync(f, "utf8")).join("\n");
const bundle = JSON.parse(readFileSync(join(packagesRoot, "cards/src/generated/dsl-stubs/stubs-bundle.json"), "utf8"));
const GENERIC = new Set(["resident", "register", "tag", "deck_unlimited", "wing", "morph", "scrum", "cross1"]);
const hollow = [];
for (const [id, doc] of Object.entries(bundle)) {
  if (doc.type !== "operation") continue;
  const effects = doc.effects ?? [];
  if (effects.length === 0) continue;
  const allGeneric = effects.every((e) =>
    (e.effects ?? []).every((p) => p.type === "grant_keyword" && GENERIC.has(p.keyword)),
  );
  if (!allGeneric) continue;
  const text = (doc.text ?? "").replace(/※常駐[^。]*。?/, "").trim();
  if (text.length <= 25) continue;
  // カード ID がエンジン/カード実装に直書きされていれば実装済みとみなす
  if (engineSrc.includes(`"${id}"`) || engineSrc.includes(`'${id}'`)) continue;
  hollow.push({ id, name: doc.name, len: text.length, text: text.slice(0, 70) });
}
console.log("hollow resident ops:", hollow.length);
for (const h of hollow) console.log(h.id, h.name, "|", h.text);
