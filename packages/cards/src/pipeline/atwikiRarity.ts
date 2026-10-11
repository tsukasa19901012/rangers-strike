/**
 * atwiki のカードページ（docs/wiki/sources/atwiki/page-N-<ID>.md）の「レアリティ：…」行からレアリティを読む。
 *
 * カタログのレアリティは、Wiki スタブ生成（scripts/generate-wiki-catalog-stubs.ts）と DSL 生成
 * （src/pipeline/generateDsl.ts）が既定値 "N" を入れていたため、第4弾以降の多くのカードが誤って "N" になっていた。
 * 生成時・修復時（scripts/repair-rarity-from-atwiki.ts）はこのモジュールで atwiki の表記から決める。
 */
import type { Rarity } from "../schema";

/** atwiki の表記 → カタログのレアリティ。長い表記を先に照合する（「ノーマルレア」は「ノーマル」より先）。 */
const LABELS: Array<[RegExp, Rarity]> = [
  [/^ノーマルレア/, "NR"],
  [/^スーパーレア/, "SR"],
  [/^シークレットレア/, "SC"],
  [/^メモリアルレア/, "MR"],
  [/^リミテッドレア/, "LR"],
  [/^プロモーション/, "PR"],
  [/^レア/, "R"],
  [/^ノーマル/, "N"],
];

/** 「レアリティ：」の値（例「メモリアルレア　（スターター版はノーマル）」）をレアリティに変換する。括弧の注記は無視する。 */
export function rarityFromAtwikiLabel(label: string): Rarity | undefined {
  const head = label.normalize("NFKC").trim();
  for (const [re, rarity] of LABELS) {
    if (re.test(head)) return rarity;
  }
  return undefined;
}

/** ページ本文に現れるレアリティ（収録順。同じカードの別版が複数載る場合は複数）。 */
export function parseAtwikiRarities(markdown: string): Rarity[] {
  const out: Rarity[] = [];
  for (const m of markdown.matchAll(/^レアリティ：(.*)$/gm)) {
    const r = rarityFromAtwikiLabel(m[1] ?? "");
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

/**
 * カタログに入れるレアリティ。現在の値が atwiki の版のいずれかと一致すればそのまま（SR-001 のシークレットレア版等）、
 * そうでなければ atwiki の最初の版。atwiki に記載がなければ現在の値。
 */
export function resolveCatalogRarity(current: Rarity | undefined, atwiki: readonly Rarity[]): Rarity | undefined {
  if (atwiki.length === 0) return current;
  if (current && atwiki.includes(current)) return current;
  return atwiki[0];
}
