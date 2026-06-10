export const INTERPRET_EFFECT_UNRESOLVED = "interpret_effect_unresolved";

/** 効果解決ログとして数える action 種別（末尾スキャンのみ — ステップ毎コストなし）。 */
const EFFECT_LOG_ACTIONS = new Set([
  "named_effect",
  "number_combo",
  "play_operation",
  "rush_effect",
  "enter_battle",
  "resident_operation",
  "resolve_effect_choice",
]);

export type EffectResolutionTrace = {
  unresolvedCount: number;
  effectLogCount: number;
  unresolvedRate: number;
  byEffectId: Record<string, number>;
  byCardId: Record<string, number>;
};

export type AggregatedEffectResolutionMetrics = EffectResolutionTrace & {
  games: number;
  topUnresolvedByEffectId: Array<{ effectId: string; count: number }>;
  topUnresolvedByCardId: Array<{ cardId: string; count: number }>;
};

type ParsedLog = {
  action: string;
  cardId?: string;
  detail?: string;
};

function parseLogEntry(entry: string): ParsedLog | null {
  if (entry.startsWith("game_created") || entry.startsWith("phase:")) return null;
  const parts = entry.split("|");
  if (parts.length < 2) return null;
  return {
    action: parts[1]!,
    cardId: parts[2],
    detail: parts.length >= 5 ? parts.slice(4).join("|") : undefined,
  };
}

function unresolvedFromDetail(
  action: string,
  detail: string | undefined,
): { unresolved: boolean; effectId?: string } {
  if (!detail) return { unresolved: false };

  if (detail === INTERPRET_EFFECT_UNRESOLVED) {
    return { unresolved: true };
  }
  if (detail.startsWith(`${INTERPRET_EFFECT_UNRESOLVED}:`)) {
    return { unresolved: true, effectId: detail.slice(INTERPRET_EFFECT_UNRESOLVED.length + 1) };
  }

  if (action === "resolve_effect_choice") {
    const colon = detail.indexOf(":");
    if (colon < 0) return { unresolved: false };
    const effectId = detail.slice(0, colon);
    const outcome = detail.slice(colon + 1);
    if (outcome === INTERPRET_EFFECT_UNRESOLVED) {
      return { unresolved: true, effectId };
    }
    if (outcome.startsWith(`${INTERPRET_EFFECT_UNRESOLVED}:`)) {
      return {
        unresolved: true,
        effectId: outcome.slice(INTERPRET_EFFECT_UNRESOLVED.length + 1) || effectId,
      };
    }
  }

  return { unresolved: false };
}

/** 対戦ログ末尾を 1 回スキャンして G3.5 効果解決メトリクスを集計。 */
export function collectEffectResolutionMetrics(log: string[]): EffectResolutionTrace {
  let unresolvedCount = 0;
  let effectLogCount = 0;
  const byEffectId: Record<string, number> = {};
  const byCardId: Record<string, number> = {};

  for (const entry of log) {
    const parsed = parseLogEntry(entry);
    if (!parsed || !EFFECT_LOG_ACTIONS.has(parsed.action)) continue;

    effectLogCount += 1;
    const hit = unresolvedFromDetail(parsed.action, parsed.detail);
    if (!hit.unresolved) continue;

    unresolvedCount += 1;
    const effectKey = hit.effectId ?? parsed.detail ?? "unknown";
    byEffectId[effectKey] = (byEffectId[effectKey] ?? 0) + 1;
    if (parsed.cardId) {
      byCardId[parsed.cardId] = (byCardId[parsed.cardId] ?? 0) + 1;
    }
  }

  return {
    unresolvedCount,
    effectLogCount,
    unresolvedRate: effectLogCount > 0 ? unresolvedCount / effectLogCount : 0,
    byEffectId,
    byCardId,
  };
}

function topCounts(
  map: Record<string, number>,
  limit = 20,
): Array<{ key: string; count: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function mergeEffectResolutionTraces(
  traces: EffectResolutionTrace[],
): AggregatedEffectResolutionMetrics {
  let unresolvedCount = 0;
  let effectLogCount = 0;
  const byEffectId: Record<string, number> = {};
  const byCardId: Record<string, number> = {};

  for (const trace of traces) {
    unresolvedCount += trace.unresolvedCount;
    effectLogCount += trace.effectLogCount;
    for (const [effectId, count] of Object.entries(trace.byEffectId)) {
      byEffectId[effectId] = (byEffectId[effectId] ?? 0) + count;
    }
    for (const [cardId, count] of Object.entries(trace.byCardId)) {
      byCardId[cardId] = (byCardId[cardId] ?? 0) + count;
    }
  }

  return {
    games: traces.length,
    unresolvedCount,
    effectLogCount,
    unresolvedRate: effectLogCount > 0 ? unresolvedCount / effectLogCount : 0,
    byEffectId,
    byCardId,
    topUnresolvedByEffectId: topCounts(byEffectId).map(({ key, count }) => ({
      effectId: key,
      count,
    })),
    topUnresolvedByCardId: topCounts(byCardId).map(({ key, count }) => ({
      cardId: key,
      count,
    })),
  };
}
