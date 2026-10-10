import pr015 from "./PR-015.json";
import sk000 from "./SK-000.json";
import xg1029 from "./XG1-029.json";
import xg1030 from "./XG1-030.json";
import xg3005 from "./XG3-005.json";
import xg5014 from "./XG5-014.json";
import type { CardDocument } from "../types";
import { mergeCardDocument } from "../cardDocumentMerge";

const CARD_OVERRIDES: Record<string, Partial<CardDocument>> = {
  // E7: 通常版 RS-127 と同文。「出るとき」がパイプラインで while_in_field になるため enter_battle に揃える。
  "PR-015": pr015 as Partial<CardDocument>,
  "SK-000": sk000 as Partial<CardDocument>,
  // E7: 効果文が補われたカードのうち、パイプライン出力が原文とずれる効果を人手で修正。
  // 【無敵の竜人魂】対象を本来BP8000以下のLユニットに限定（DA なら SP1 は未実装）。
  "XG1-029": xg1029 as Partial<CardDocument>,
  // 【キラークロー】NC で「SP1」+ BP+2000（RS-031 と同形）。ウイング時のナンバー不問は未実装。
  "XG1-030": xg1030 as Partial<CardDocument>,
  // 【マックスノバ】CN なしのため常時効果。捨札6枚につき SP+1。
  "XG3-005": xg3005 as Partial<CardDocument>,
  // ※SP1 条件と【マックスビクトリープロミネンス】は CN なしの常時効果。
  "XG5-014": xg5014 as Partial<CardDocument>,
};

let cachedOverrides: Map<string, Partial<CardDocument>> | null = null;

/** 人手修正 DSL（`src/dsl/overrides/{cardId}.json`）。 */
export function loadCardOverrides(): Map<string, Partial<CardDocument>> {
  if (cachedOverrides) return cachedOverrides;
  cachedOverrides = new Map(Object.entries(CARD_OVERRIDES));
  return cachedOverrides;
}

export function resetCardOverrideCache(): void {
  cachedOverrides = null;
}

export function applyCardOverride(base: CardDocument): CardDocument {
  const overlay = loadCardOverrides().get(base.id);
  if (!overlay) return base;
  return mergeCardDocument(base, overlay);
}

export function listCardOverrideIds(): string[] {
  return [...loadCardOverrides().keys()];
}
