export type CpuLevel = 1 | 2 | 3 | 4 | 5;

export const CPU_LEVELS: CpuLevel[] = [1, 2, 3, 4, 5];

export type CpuLevelConfig = {
  enableSearch: boolean;
  maxCandidates: number;
  maxResponseDepth: number;
  /** 1=手応答のみ、2+=相手の次手まで読む negamax 深さ */
  searchPly: number;
  /** ルートの上位何手を、相手の次のターンの終わりまで進めて評価し直すか（0で行わない）。 */
  rolloutTopK?: number;
  /** チャージ・ラッシュ・バトル進入の決定を先まで進めて比べる試行回数（0／省略で行わない）。 */
  planSamples?: number;
  planPhases?: Array<"charge" | "rush" | "entry">;
  planTurns?: number;
  planChargeTop?: number;
  planMaxSteps?: number;
};

let overrides: Partial<Record<CpuLevel, Partial<CpuLevelConfig>>> = {};
/** 対戦台（scripts/cpu-arena.ts）でレベルの設定を試しに変える。 */
export function setCpuLevelOverrides(next: Partial<Record<CpuLevel, Partial<CpuLevelConfig>>>): void {
  overrides = next;
}

const LEVEL_CONFIG: Record<CpuLevel, CpuLevelConfig> = {
  1: { enableSearch: false, maxCandidates: 0, maxResponseDepth: 0, searchPly: 0 },
  2: { enableSearch: true, maxCandidates: 28, maxResponseDepth: 10, searchPly: 1 },
  // Lv3 以上はチャージの判断を、探索なしの CPU で相手の次のターンの終わりまで進めて比べる。
  // 探索の広さ・深さだけを増やした以前の Lv3〜5 は、Lv2 と同じ手しか選ばなかった（2026-10-20 scripts/cpu-arena.ts、
  // 340 局面で差 0）。対 Lv2 の勝率（各 300 局、席入れ替え）: Lv3 53.7%、Lv4 54〜58%、Lv5 56.3%。
  3: { enableSearch: true, maxCandidates: 44, maxResponseDepth: 14, searchPly: 1, planSamples: 1, planPhases: ["charge"], planChargeTop: 2 },
  4: { enableSearch: true, maxCandidates: 56, maxResponseDepth: 20, searchPly: 2, planSamples: 1, planPhases: ["charge"] },
  5: { enableSearch: true, maxCandidates: 64, maxResponseDepth: 28, searchPly: 2, planSamples: 1, planPhases: ["charge", "entry"] },
};

export function getCpuLevelConfig(level: CpuLevel): CpuLevelConfig {
  const extra = overrides[level];
  return extra ? { ...LEVEL_CONFIG[level], ...extra } : LEVEL_CONFIG[level];
}
