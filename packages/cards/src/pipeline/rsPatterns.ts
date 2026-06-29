import type { EffectDefinition } from "../dsl/types";
import type { ExtractedEffect, WikiEffectSegment } from "./types";
import { slugifyEffectId } from "./metaMaps";

type PatternMatch = {
  pattern: string;
  test: (body: string, segment?: WikiEffectSegment) => boolean;
  build: (
    body: string,
    segment: WikiEffectSegment,
    trigger: EffectDefinition["trigger"],
  ) => Omit<ExtractedEffect, "segmentIndex" | "needsFallback">;
};

function grantKw(
  keyword: string,
  body: string,
  segment: WikiEffectSegment,
  trigger: EffectDefinition["trigger"],
  matchedPattern: string,
  optional?: boolean,
): Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> {
  return {
    id: segment.name ? slugifyEffectId(segment.name) : slugifyEffectId(keyword),
    name: segment.name,
    text: body,
    trigger,
    optional,
    effects: [
      {
        type: "grant_keyword",
        keyword,
        duration: trigger.type === "while_in_field" ? "permanent" : "turn",
      },
    ],
    matchedPattern,
  };
}

/** RS 向け catchall より前に挿入するパターン。 */
export const RS_NAMED_PATTERNS: PatternMatch[] = [
  {
    pattern: "rs_rush_send_category_unit_to_power_sp1",
    test: (body) =>
      /自軍ラッシュエリアから、「(WB|OT|MA|ET|DA)」のユニットを1体選び自軍パワーゾーンに送ってもよい。そうしたとき、このターン、これは「SP1」になる/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const category = body.match(/「(WB|OT|MA|ET|DA)」/)?.[1] ?? "MA";
      return grantKw(
        `on_rush_send_rush_${category.toLowerCase()}_to_power_sp1`,
        body,
        segment,
        trigger,
        "rs_rush_send_category_unit_to_power_sp1",
        true,
      );
    },
  },
  {
    pattern: "rs_combo_l_attack_strike_repeat",
    test: (body) =>
      /このユニットからコンビネーションする同カテゴリのLユニットがアタックまたはストライクしたとき、その処理をすべて終えてから、そのLユニットはもう一度アタックまたはストライクしてもよい/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "combo_l_repeat_attack_strike_after_combo",
        body,
        segment,
        trigger,
        "rs_combo_l_attack_strike_repeat",
      ),
  },
];
