export type CpuLevel = 1 | 2 | 3 | 4 | 5;

export const CPU_LEVELS: CpuLevel[] = [1, 2, 3, 4, 5];

export type CpuLevelConfig = {
  enableSearch: boolean;
  maxCandidates: number;
  maxResponseDepth: number;
};

const LEVEL_CONFIG: Record<CpuLevel, CpuLevelConfig> = {
  1: { enableSearch: false, maxCandidates: 0, maxResponseDepth: 0 },
  2: { enableSearch: true, maxCandidates: 16, maxResponseDepth: 5 },
  3: { enableSearch: true, maxCandidates: 28, maxResponseDepth: 8 },
  4: { enableSearch: true, maxCandidates: 40, maxResponseDepth: 10 },
  5: { enableSearch: true, maxCandidates: 50, maxResponseDepth: 100 },
};

export function getCpuLevelConfig(level: CpuLevel): CpuLevelConfig {
  return LEVEL_CONFIG[level];
}
