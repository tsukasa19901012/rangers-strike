import type { EffectDefinition } from "../dsl/types";
import { canonicalCardName } from "../cardName";
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

/** SR カード向け catchall より前に挿入するパターン。 */
export const SR_NAMED_PATTERNS: PatternMatch[] = [
  {
    pattern: "sr_bp_per_discard_feature_sp_threshold",
    test: (body) =>
      /自軍ターン中、これは自軍捨札にある特徴「([^」]+)」を持つカード1枚につきBP[＋+](\d+)される。これはBP(\d+)以上のとき「SP1」になる/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = slugifyEffectId(body.match(/特徴「([^」]+)」/)?.[1] ?? "feature");
      const amount = body.match(/BP[＋+](\d+)される/)?.[1] ?? "1000";
      const threshold = body.match(/BP(\d+)以上/)?.[1] ?? "8000";
      return grantKw(
        `bp_plus_per_discard_feature_${feature}_${amount}_sp_at_${threshold}`,
        body,
        segment,
        trigger,
        "sr_bp_per_discard_feature_sp_threshold",
      );
    },
  },
  {
    pattern: "sr_opponent_hold_ot_et_on_release",
    test: (body) =>
      /相手は次の制限を受ける⇒自分自身のコマンドゾーンにOTまたはETのカードをリリース状態で置いたとき、そのカードをホールドする/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "opponent_must_hold_ot_et_on_command_release",
        body,
        segment,
        trigger,
        "sr_opponent_hold_ot_et_on_release",
      ),
  },
  {
    pattern: "sr_on_deck_reveal_swap_target",
    test: (body) =>
      /自軍山札の上のカードが1枚オモテになるたび、オモテにしたカードを効果の対象にする前に次の効果を発動できる⇒オモテにしたカードを手札に加える。そして、自分の手札からカードを1枚選び相手に見せ、オモテにしたカードのかわりに効果の対象にする/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "on_deck_reveal_swap_effect_target",
        body,
        segment,
        trigger,
        "sr_on_deck_reveal_swap_target",
        true,
      ),
  },
  {
    pattern: "sr_plasma_shockwave_start_phase",
    test: (body) =>
      /自分も相手も次のようにする⇒自分自身のスタートフェイズ中、バトルエリアのユニットをラッシュエリアに戻せない。そのかわりに、自分自身のバトルエリアのユニットを好きな数選び撃破できる。このスタートフェイズを終えるとき、自分自身のバトルエリアに「([^」]+)」以外のユニットが1体もなければ、これを持ち主の山札に戻してシャッフルする/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const name = canonicalCardName(body.match(/「([^」]+)」以外/)?.[1] ?? "named");
      return grantKw(
        `plasma_shockwave_start_phase::${name}`,
        body,
        segment,
        trigger,
        "sr_plasma_shockwave_start_phase",
      );
    },
  },
  {
    pattern: "sr_big_baton_command_features",
    test: (body) =>
      /これは、自軍コマンドゾーンにあるカードの特徴を見て、それぞれの特徴ごとに次の能力を得る⇒特徴「レッド」があればレジストを得る。特徴「ブルー」があればタクスETを得る。特徴「グリーン」があればBP7000になる。特徴「ピンク」があればSP1になる/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "big_baton_command_zone_features",
        body,
        segment,
        trigger,
        "sr_big_baton_command_features",
      ),
  },
];
