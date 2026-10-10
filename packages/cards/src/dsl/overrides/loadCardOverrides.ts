import pr015 from "./PR-015.json";
import sk000 from "./SK-000.json";
import rs003 from "./RS-003.json";
import rs043 from "./RS-043.json";
import rs051 from "./RS-051.json";
import rs052 from "./RS-052.json";
import rs058 from "./RS-058.json";
import rs065 from "./RS-065.json";
import rs106 from "./RS-106.json";
import rs118 from "./RS-118.json";
import rs036 from "./RS-036.json";
import rs365 from "./RS-365.json";
import rk043 from "./RK-043.json";
import rk125 from "./RK-125.json";
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
  // E14: エラッタ・読み替えの修正後テキスト（docs/rules/08-errata.md）。カード本文と効果文を修正後に揃える。
  // ルール: R-ERR-RS003 — 「2つホールドするごとに」→「2つホールドして」（挙動は従来どおり1回2ホールドで1体）。
  "RS-003": rs003 as Partial<CardDocument>,
  // ルール: R-ERR-RS043 — 発動タイミングを「自軍ターン中、これがバトルエリアに出たとき」に限定。
  "RS-043": rs043 as Partial<CardDocument>,
  // ルール: R-ERR-RS051 — 同上（【超ドリル進化】）。
  "RS-051": rs051 as Partial<CardDocument>,
  // ルール: R-ERR-RS052 — 「これを」→「このユニットを」（場にあるときだけ発動）。
  "RS-052": rs052 as Partial<CardDocument>,
  // ルール: R-ERR-RS058 — 「これはアタックするとき、」を追加。
  "RS-058": rs058 as Partial<CardDocument>,
  // ルール: R-ERR-RS065 — 対象を「SP1 以上または SP！」に。【一点突破】は NC（CN3）成立時のみ有効なので nc トリガー。
  "RS-065": rs065 as Partial<CardDocument>,
  // ルール: R-ERR-RS106 — 「アタックするかわりに」→「アタックできるとき…そうしたとき、これはアタックすることができない」。
  "RS-106": rs106 as Partial<CardDocument>,
  // ルール: R-ERR-RS118 — 置きかえる S ユニットの下に重ねたカードは重ねたまま置きかえる。
  "RS-118": rs118 as Partial<CardDocument>,
  // ルール: R-ERR-RS036 — 「リリース状態のコマンドを2つ…1つしかなければ1つ」。
  "RS-036": rs036 as Partial<CardDocument>,
  // ルール: R-ERR-RS365 — 追加条件は「これ以外の自分の手札を全て捨札にする」（挙動は従来から自身を除外）。
  "RS-365": rs365 as Partial<CardDocument>,
  // ルール: R-ERR-RK043 — 【突入】に「このターン、」を追加（公式読み替え文）。
  "RK-043": rk043 as Partial<CardDocument>,
  // ルール: R-ERR-RK125 — wiki 注記「※赤文字は…」が本文・効果に混入していたのを除去。
  "RK-125": rk125 as Partial<CardDocument>,
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
