import type { EffectDefinition } from "../dsl/types";
import type { ExtractedEffect, WikiEffectSegment } from "./types";
import { noteEffectIdFromBody, slugifyEffectId } from "./metaMaps";

type PatternMatch = {
  pattern: string;
  test: (body: string) => boolean;
  build: (
    body: string,
    segment: WikiEffectSegment,
    trigger: EffectDefinition["trigger"],
  ) => Omit<ExtractedEffect, "segmentIndex" | "needsFallback">;
};

/** RM カード向け catchall より前に挿入するパターン。 */
export const RM_NAMED_PATTERNS: PatternMatch[] = [
  {
    pattern: "rm_while_riding_stagger_tank_block_return_held_mecha",
    test: (body) =>
      /これがライドされている間、自軍エリアに「スタッガータンク」があれば、相手はスタートフェイズ中に自分自身のバトルエリアのユニットをラッシュエリアに戻すとき、特徴「メカ」を持つホールド状態のユニットは戻せない/.test(
        body,
      ),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : noteEffectIdFromBody(body),
      name: segment.name,
      text: body,
      trigger,
      optional: false,
      effects: [
        {
          type: "grant_keyword",
          keyword: "while_riding_stagger_tank_block_return_held_mecha",
          duration: "permanent",
        },
      ],
      matchedPattern: "rm_while_riding_stagger_tank_block_return_held_mecha",
    }),
  },
];
