export type CpuLevel = 1 | 2 | 3 | 4 | 5;

export const CPU_LEVELS: CpuLevel[] = [1, 2, 3, 4, 5];

export type CpuLevelConfig = {
  enableSearch: boolean;
  maxCandidates: number;
  maxResponseDepth: number;
  /** 1=手応答のみ、2+=相手の次手まで読む negamax 深さ */
  searchPly: number;
};

const LEVEL_CONFIG: Record<CpuLevel, CpuLevelConfig> = {
  1: { enableSearch: false, maxCandidates: 0, maxResponseDepth: 0, searchPly: 0 },
  2: { enableSearch: true, maxCandidates: 28, maxResponseDepth: 10, searchPly: 1 },
  3: { enableSearch: true, maxCandidates: 44, maxResponseDepth: 14, searchPly: 1 },
  4: { enableSearch: true, maxCandidates: 56, maxResponseDepth: 20, searchPly: 2 },
  5: { enableSearch: true, maxCandidates: 64, maxResponseDepth: 28, searchPly: 2 },
};

export function getCpuLevelConfig(level: CpuLevel): CpuLevelConfig {
  return LEVEL_CONFIG[level];
}
