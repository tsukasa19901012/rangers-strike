import type { EffectDefinition } from "../dsl/types";
import type { CardAnalysis, ExtractedTrigger, WikiEffectSegment, WikiParseResult } from "./types";

function inferTriggerFromText(
  body: string,
  segment: WikiEffectSegment,
  cardType: CardAnalysis["cardType"],
): { trigger: EffectDefinition["trigger"]; confidence: ExtractedTrigger["confidence"]; reason: string } {
  if (cardType === "operation") {
    if (/カウンター/.test(body) || segment.kind === "note" && /アタックされた/.test(body)) {
      return { trigger: { type: "operation", timing: "counter" }, confidence: "high", reason: "counter_operation" };
    }
    if (/常駐/.test(body)) {
      return { trigger: { type: "operation", timing: "resident" }, confidence: "high", reason: "resident_operation" };
    }
    return { trigger: { type: "operation", timing: "rush" }, confidence: "high", reason: "default_operation_rush" };
  }

  if (/撃破されたとき/.test(body)) {
    return { trigger: { type: "on_destroy" }, confidence: "medium", reason: "destroy_text" };
  }
  if (/ストライクされたとき|ストライクしたとき/.test(body)) {
    return { trigger: { type: "on_strike" }, confidence: "high", reason: "strike_text" };
  }
  if (/アタックしたとき|アタックするとき/.test(body)) {
    return { trigger: { type: "on_attack" }, confidence: "high", reason: "attack_text" };
  }
  if (/ラッシュしたとき/.test(body)) {
    return { trigger: { type: "on_rush" }, confidence: "high", reason: "rush_text" };
  }
  if (/バトルエリアに出たとき/.test(body)) {
    return { trigger: { type: "enter_battle" }, confidence: "high", reason: "enter_battle_text" };
  }
  if (/ターン終了時/.test(body)) {
    return { trigger: { type: "on_turn_end" }, confidence: "high", reason: "turn_end_text" };
  }
  if (/としてつかえる|毎ターン|ホールドしなければ|バトルエリアに出る/.test(body)) {
    return { trigger: { type: "while_in_field" }, confidence: "high", reason: "static_rule_note" };
  }
  if (segment.kind === "named" || /^「SP\d+」/.test(body)) {
    return { trigger: { type: "nc" }, confidence: "high", reason: "named_or_sp_keyword" };
  }

  return { trigger: { type: "nc" }, confidence: "low", reason: "default_nc" };
}

export function extractTriggers(
  parse: WikiParseResult,
  analysis: CardAnalysis,
): ExtractedTrigger[] {
  if (parse.segments.length === 0) return [];

  return parse.segments.map((segment, segmentIndex) => {
    const body = segment.body;
    const { trigger, confidence, reason } = inferTriggerFromText(body, segment, analysis.cardType);
    return { segmentIndex, trigger, confidence, reason };
  });
}
