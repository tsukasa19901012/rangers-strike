export type CpuLevel = 1 | 2 | 3 | 4 | 5;

export const CPU_LEVELS: CpuLevel[] = [1, 2, 3, 4, 5];

export type CpuLevelConfig = {
  enableSearch: boolean;
  maxCandidates: number;
  maxResponseDepth: number;
};

const LEVEL_CONFIG: Record<CpuLevel, CpuLevelConfig> = {
  1: { enableSearch: false, maxCandidates: 0, maxResponseDepth: 0 },
  2: { enableSearch: true, maxCandidates: 12, maxResponseDepth: 4 },
  3: { enableSearch: true, maxCandidates: 22, maxResponseDepth: 6 },
  4: { enableSearch: true, maxCandidates: 35, maxResponseDepth: 8 },
  5: { enableSearch: true, maxCandidates: 42, maxResponseDepth: 100 },
};

export function getCpuLevelConfig(level: CpuLevel): CpuLevelConfig {
  return LEVEL_CONFIG[level];
}
