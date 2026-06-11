import type { CardDocument, EffectDefinition, EffectPrimitive } from "../dsl/types";
import {
  ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS,
  ENGINE_NATIVE_GRANT_KEYWORDS,
} from "../engineImplementedCatchall";
import { rematchExtractedEffect } from "./extractEffects";

const CATCHALL_PATTERN = "catchall_interpret";

/** Mirrors `interpretEffectRuntime.isUnresolvedStub` — rematch 結果が実効果にならない場合。 */
export function isUnresolvedRematchPrimitives(primitives: EffectPrimitive[]): boolean {
  if (primitives.length !== 1) return false;
  const only = primitives[0];
  if (!only) return false;
  if (only.type === "interpret_effect") return false;
  if (only.type === "grant_keyword" && only.keyword.startsWith("effect_")) return true;
  if (only.type === "enqueue_trigger") return true;
  return false;
}

export function isRematchSuccess(primitives: EffectPrimitive[] | undefined): boolean {
  if (!primitives || primitives.length === 0) return false;
  return !isUnresolvedRematchPrimitives(primitives);
}

function isEmptyEffectText(text: string | undefined): boolean {
  const t = (text ?? "").trim();
  return t.length === 0 || t === "なし" || t === "なし。";
}

function isInterpretEffectMarker(primitives: EffectPrimitive[]): boolean {
  return primitives.length === 1 && primitives[0]?.type === "interpret_effect";
}

function rematchOptionsForEffect(effect: EffectDefinition): Parameters<typeof rematchExtractedEffect>[1] {
  const text = effect.text ?? "";
  return {
    name: effect.name,
    kind: text.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  };
}

export type RematchClassification =
  | "effective"
  | "catchall_fallback"
  | "strict_unresolved";

function hasEngineNativeGrantPrimitive(primitives: EffectPrimitive[]): boolean {
  return primitives.some(
    (p) =>
      p.type === "grant_keyword" &&
      ENGINE_NATIVE_GRANT_KEYWORDS.has(p.keyword),
  );
}

export function classifyRuntimeRematch(
  effect: EffectDefinition,
  cardId?: string,
): RematchClassification {
  if (cardId && ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS.has(cardId)) {
    return "effective";
  }
  if (hasEngineNativeGrantPrimitive(effect.effects ?? [])) {
    return "effective";
  }
  if (isEmptyEffectText(effect.text)) return "strict_unresolved";
  const rematched = rematchExtractedEffect(effect.text ?? "", rematchOptionsForEffect(effect));
  if (!rematched || !isRematchSuccess(rematched.effects)) return "strict_unresolved";
  if (rematched.matchedPattern === CATCHALL_PATTERN) return "catchall_fallback";
  return "effective";
}

export function wouldRuntimeRematchResolve(effect: EffectDefinition): boolean {
  return classifyRuntimeRematch(effect) !== "strict_unresolved";
}

export type EffectResolutionSample = {
  cardId: string;
  effectId: string;
  textPreview: string;
};

export type EffectResolutionMetrics = {
  scope: "promoted" | "sample";
  sampleSize?: number;
  /** サンプル前の promoted 効果総数（空テキスト除く）。 */
  totalEffectsInCorpus: number;
  promotedCards: number;
  effectsWithText: number;
  interpretEffectMarkers: number;
  markersRematchResolved: number;
  markersRematchUnresolved: number;
  /** interpret_effect マーカーに対する unresolved 率（0–1）。マーカー 0 件なら 0。 */
  markerUnresolvedRate: number;
  rematchCoverageResolved: number;
  rematchCoverageUnresolved: number;
  /** 全 promoted 効果文に対する rematch 成功率（0–1）。strict_unresolved 以外。 */
  rematchCoverageRate: number;
  rematchEffectiveResolved: number;
  rematchCatchallFallback: number;
  /** 非 catchall の rematch 成功率（0–1）。G3.5 実効カバレッジ。 */
  effectiveRematchRate: number;
  dslRematchedEffects: number;
  topUnresolvedSamples: EffectResolutionSample[];
};

export type MeasureEffectResolutionOptions = {
  /** 指定時は promoted 効果からランダムサンプル（決定論的シード）。 */
  sampleSize?: number;
};

function seededShuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

type PromotedEffectRef = {
  cardId: string;
  effect: EffectDefinition;
};

function collectPromotedEffects(
  cards: CardDocument[],
  coreCardIds: Set<string>,
): PromotedEffectRef[] {
  const refs: PromotedEffectRef[] = [];
  for (const card of cards) {
    if (coreCardIds.has(card.id)) continue;
    for (const effect of card.effects ?? []) {
      if (isEmptyEffectText(effect.text)) continue;
      refs.push({ cardId: card.id, effect });
    }
  }
  return refs;
}

export function measureEffectResolution(
  cards: CardDocument[],
  coreCardIds: Set<string>,
  options: MeasureEffectResolutionOptions = {},
): EffectResolutionMetrics {
  const allRefs = collectPromotedEffects(cards, coreCardIds);
  const promotedCardIds = new Set(allRefs.map((r) => r.cardId));

  let refs = allRefs;
  let scope: EffectResolutionMetrics["scope"] = "promoted";
  let sampleSize: number | undefined;

  if (options.sampleSize !== undefined && options.sampleSize < allRefs.length) {
    refs = seededShuffle(allRefs, 42).slice(0, options.sampleSize);
    scope = "sample";
    sampleSize = options.sampleSize;
  }

  let interpretEffectMarkers = 0;
  let markersRematchResolved = 0;
  let markersRematchUnresolved = 0;
  let rematchCoverageResolved = 0;
  let rematchCoverageUnresolved = 0;
  let rematchEffectiveResolved = 0;
  let rematchCatchallFallback = 0;
  let dslRematchedEffects = 0;
  const unresolvedSamples: EffectResolutionSample[] = [];

  for (const { cardId, effect } of refs) {
    const marker = isInterpretEffectMarker(effect.effects);
    const classification = classifyRuntimeRematch(effect);
    const rematchOk = classification !== "strict_unresolved";

    if (marker) {
      interpretEffectMarkers += 1;
      if (rematchOk) markersRematchResolved += 1;
      else markersRematchUnresolved += 1;
    } else {
      dslRematchedEffects += 1;
    }

    if (classification === "effective") rematchEffectiveResolved += 1;
    else if (classification === "catchall_fallback") rematchCatchallFallback += 1;

    if (rematchOk) {
      rematchCoverageResolved += 1;
    } else {
      rematchCoverageUnresolved += 1;
      if (unresolvedSamples.length < 15) {
        const text = (effect.text ?? "").trim();
        unresolvedSamples.push({
          cardId,
          effectId: effect.id,
          textPreview: text.length > 80 ? `${text.slice(0, 77)}...` : text,
        });
      }
    }
  }

  const effectsWithText = refs.length;
  const markerUnresolvedRate =
    interpretEffectMarkers === 0 ? 0 : markersRematchUnresolved / interpretEffectMarkers;
  const rematchCoverageRate =
    effectsWithText === 0 ? 0 : rematchCoverageResolved / effectsWithText;
  const effectiveRematchRate =
    effectsWithText === 0 ? 0 : rematchEffectiveResolved / effectsWithText;

  return {
    scope,
    sampleSize,
    totalEffectsInCorpus: allRefs.length,
    promotedCards: promotedCardIds.size,
    effectsWithText,
    interpretEffectMarkers,
    markersRematchResolved,
    markersRematchUnresolved,
    markerUnresolvedRate,
    rematchCoverageResolved,
    rematchCoverageUnresolved,
    rematchCoverageRate,
    rematchEffectiveResolved,
    rematchCatchallFallback,
    effectiveRematchRate,
    dslRematchedEffects,
    topUnresolvedSamples: unresolvedSamples,
  };
}

/** G3.5 ゲート判定用しきい値（full-card-rollout-process.md §4.5 と同期）。 */
export const G35_THRESHOLDS = {
  markerUnresolvedPass: 0.05,
  markerUnresolvedPartial: 0.5,
  rematchCoveragePass: 0.95,
  rematchCoveragePartial: 0.8,
} as const;

export type G35GateStatus = "pass" | "partial" | "fail";

export function evaluateG35Gate(metrics: EffectResolutionMetrics): G35GateStatus {
  if (
    metrics.interpretEffectMarkers === 0 &&
    metrics.effectiveRematchRate >= G35_THRESHOLDS.rematchCoveragePass
  ) {
    return "pass";
  }
  if (metrics.markerUnresolvedRate <= G35_THRESHOLDS.markerUnresolvedPass) {
    return "pass";
  }
  if (
    metrics.markerUnresolvedRate <= G35_THRESHOLDS.markerUnresolvedPartial ||
    metrics.effectiveRematchRate >= G35_THRESHOLDS.rematchCoveragePartial
  ) {
    return "partial";
  }
  return "fail";
}
