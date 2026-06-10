import type { EffectTrigger } from "@rangers-strike/cards/dsl/types";

/** cardInterpreter + triggerResolver 直結済みトリガー（Event registry と二重解決しない）。 */
export const DIRECT_DSL_TRIGGER_TYPES = new Set<EffectTrigger["type"]>([
  "on_rush",
  "enter_battle",
  "on_attack",
  "on_destroy",
  "on_leave",
  "on_strike",
  "on_turn_end",
  "nc",
  "conditional",
]);

export function isDirectDslTrigger(type: EffectTrigger["type"]): boolean {
  return DIRECT_DSL_TRIGGER_TYPES.has(type);
}

/** Phase 2: 高頻度トリガー配線一覧（監査・テスト用）。 */
export const HIGH_FREQUENCY_TRIGGER_WIRING = {
  enter_battle: "rules/combo.ts → tryResolveDslTriggeredEffects",
  on_rush: "events/listeners/unitRushedListener.ts",
  while_in_field: "dsl/fieldKeywords.ts + rules/fieldAuras.ts + rules/restrictions.ts",
  on_attack: "rules/operationCounters.ts → resolveBattlePendingCore",
  on_destroy: "rules/leaveEffects.ts → resolveUnitLeftZoneEffectsImpl",
} as const;
