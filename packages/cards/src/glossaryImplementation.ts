/**
 * 用語集との実装ギャップ（意図的に未対応の項目を記録）。
 * @see https://w.atwiki.jp/renst/pages/57.html
 */

export const GLOSSARY_NOT_IMPLEMENTED = [
  { term: "タッグストライク", wikiPage: 750, reason: "2体同時ストライク未実装" },
  { term: "先攻1ターン目スタート省略の差異", wikiPage: null, reason: "簡略化のまま維持" },
  { term: "バウンス（汎用）", wikiPage: null, reason: "return_hand 等の個別効果のみ" },
] as const;

export const GLOSSARY_FRAMEWORK_ONLY = [
  { term: "コマンダーカード", module: "commander" },
  { term: "除外", module: "exile" },
  { term: "リアニメイト", module: "reanimate" },
] as const;
