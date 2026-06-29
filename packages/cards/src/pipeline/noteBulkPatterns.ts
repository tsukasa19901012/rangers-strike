import type { EffectDefinition } from "../dsl/types";
import { canonicalCardName } from "../cardName";
import type { ExtractedEffect, WikiEffectSegment } from "./types";
import { slugifyEffectId, noteEffectIdFromBody } from "./metaMaps";

type PatternMatch = {
  pattern: string;
  test: (body: string, segment?: WikiEffectSegment) => boolean;
  build: (
    body: string,
    segment: WikiEffectSegment,
    trigger: EffectDefinition["trigger"],
  ) => Omit<ExtractedEffect, "segmentIndex" | "needsFallback">;
};

function noteKw(
  keyword: string,
  body: string,
  segment: WikiEffectSegment,
  trigger: EffectDefinition["trigger"],
  matchedPattern: string,
  optional?: boolean,
): Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> {
  return {
    id: noteEffectIdFromBody(body).replace(/^note_/, "unnamed_"),
    name: segment.name,
    text: body,
    trigger,
    optional,
    effects: [{ type: "grant_keyword", keyword, duration: "permanent" }],
    matchedPattern,
  };
}

/** note_other / while_note catchall より前に挿入する一括 ※ パターン。 */
export const NOTE_BULK_PATTERNS: PatternMatch[] = [
  {
    pattern: "while_in_hand_rush_deploy",
    test: (body) =>
      /^※これが自分の手札にある間、自軍ラッシュフェイズ中、.+、これを自軍ラッシュエリアに出してもよい/.test(
        body,
      ),
    build: (body, segment) => {
      const condition =
        body.match(
          /^※これが自分の手札にある間、自軍ラッシュフェイズ中、(.+)、これを自軍ラッシュエリアに出してもよい/,
        )?.[1] ?? "cond";
      const slug = slugifyEffectId(condition).slice(0, 24);
      return noteKw(
        `while_in_hand_rush_deploy::${slug}`,
        body,
        segment,
        { type: "while_in_field" },
        "while_in_hand_rush_deploy",
        true,
      );
    },
  },
  {
    pattern: "while_in_discard_rush_deploy",
    test: (body) =>
      /^※これが自軍捨札にある間、.+ラッシュフェイズ中、.+これを自軍ラッシュエリアに出してもよい/.test(
        body,
      ),
    build: (body, segment) => {
      const slug = slugifyEffectId(body.slice(0, 60)).slice(0, 20);
      return noteKw(
        `while_in_discard_rush_deploy::${slug}`,
        body,
        segment,
        { type: "while_in_field" },
        "while_in_discard_rush_deploy",
        true,
      );
    },
  },
  {
    pattern: "while_in_command_rush_deploy",
    test: (body) =>
      /^※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、.+これを自軍ラッシュエリアに出してもよい/.test(
        body,
      ),
    build: (body, segment) => {
      const slug = slugifyEffectId(body.slice(0, 60)).slice(0, 20);
      return noteKw(
        `while_in_command_rush_deploy::${slug}`,
        body,
        segment,
        { type: "while_in_field" },
        "while_in_command_rush_deploy",
        true,
      );
    },
  },
  {
    pattern: "counter_note_generic",
    test: (body) => /^※カウンター/.test(body),
    build: (body, segment) => {
      const slug = slugifyEffectId(body.slice(0, 48)).slice(0, 20);
      return noteKw(
        `counter_note::${slug}`,
        body,
        segment,
        { type: "nc" },
        "counter_note_generic",
        true,
      );
    },
  },
  {
    pattern: "on_destroy_deploy_named_to_rush",
    test: (body) =>
      /^※これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「([^」]+)」のカードを1枚選び、自軍ラッシュエリアに出す/.test(
        body,
      ),
    build: (body, segment) => {
      const name = canonicalCardName(body.match(/「([^」]+)」/)?.[1] ?? "named");
      return noteKw(
        `on_destroy_deploy_named_to_rush::${name}`,
        body,
        segment,
        { type: "on_destroy" },
        "on_destroy_deploy_named_to_rush",
        false,
      );
    },
  },
  {
    pattern: "becomes_l_bp_if_any_l",
    test: (body) =>
      /^※自分か相手のLユニットがあれば、これはLユニットになり、BP[＋+](\d+)される/.test(body),
    build: (body, segment) => {
      const amount = body.match(/BP[＋+](\d+)/)?.[1] ?? "3000";
      return noteKw(
        `becomes_l_bp_if_any_l_on_field_${amount}`,
        body,
        segment,
        { type: "while_in_field" },
        "becomes_l_bp_if_any_l",
        false,
      );
    },
  },
  {
    pattern: "turn_start_swap_hand_named",
    test: (body) =>
      /^※自軍ターン開始時、自分の手札から「([^」]+)」か「([^」]+)」のカードを1枚選び、これと置き換えてもよい/.test(
        body,
      ),
    build: (body, segment) => {
      const names = [...body.matchAll(/「([^」]+)」/g)].map((m) => canonicalCardName(m[1] ?? ""));
      const slug = names.map((n) => n.slice(0, 8)).join("_") || "named";
      return noteKw(
        `turn_start_swap_hand_named::${slug}`,
        body,
        segment,
        { type: "while_in_field" },
        "turn_start_swap_hand_named",
        true,
      );
    },
  },
  {
    pattern: "on_rush_swap_from_power_except_named",
    test: (body) =>
      /^※これをラッシュしたとき、「([^」]+)」以外のオモテ向きの自軍パワーから/.test(body),
    build: (body, segment) => {
      const name = canonicalCardName(body.match(/「([^」]+)」/)?.[1] ?? "named");
      return noteKw(
        `on_rush_swap_from_power_except_named::${name}`,
        body,
        segment,
        { type: "on_rush" },
        "on_rush_swap_from_power_except_named",
        true,
      );
    },
  },
  {
    pattern: "dual_name_alias_note",
    test: (body) => /^※これは「([^」]+)」または「([^」]+)」としてつかえる/.test(body),
    build: (body, segment) => {
      const names = [...body.matchAll(/「([^」]+)」/g)].map((m) => canonicalCardName(m[1] ?? ""));
      const slug = names.join("_or_").slice(0, 32);
      return noteKw(`dual_name_alias::${slug}`, body, segment, { type: "while_in_field" }, "dual_name_alias_note");
    },
  },
  {
    pattern: "ride_named_becomes_named",
    test: (body) => /^※これにライドしているユニットは、「([^」]+)」なら「([^」]+)」になる/.test(body),
    build: (body, segment) => {
      const names = [...body.matchAll(/「([^」]+)」/g)].map((m) => canonicalCardName(m[1] ?? ""));
      return noteKw(
        `ride_named_becomes::${names[0] ?? "a"}::${names[1] ?? "b"}`,
        body,
        segment,
        { type: "while_in_field" },
        "ride_named_becomes_named",
      );
    },
  },
  {
    pattern: "bp_if_named_ally_present",
    test: (body) => /^※これは自軍「([^」]+)」があればBP[＋+](\d+)される/.test(body),
    build: (body, segment) => {
      const name = canonicalCardName(body.match(/「([^」]+)」/)?.[1] ?? "ally");
      const amount = body.match(/BP[＋+](\d+)/)?.[1] ?? "3000";
      return noteKw(
        `bp_plus_if_named_ally_${name}_${amount}`,
        body,
        segment,
        { type: "while_in_field" },
        "bp_if_named_ally_present",
      );
    },
  },
  {
    pattern: "ride_attack_bp_boost_note",
    test: (body) => /^※これにライドしているユニットは、アタックするときBP[＋+](\d+)される/.test(body),
    build: (body, segment) => {
      const amount = body.match(/BP[＋+](\d+)/)?.[1] ?? "1000";
      return noteKw(
        `ride_attack_bp_boost_${amount}`,
        body,
        segment,
        { type: "while_in_field" },
        "ride_attack_bp_boost_note",
      );
    },
  },
  {
    pattern: "feature_s_ride_vehicle_hold_commands",
    test: (body) =>
      /^※特徴「([^」]+)」を持つ自軍Sユニットは、自軍コマンドを(\d+)つホールドすればＲＣを持っていなくてもこのビークルにライドできる/.test(
        body,
      ),
    build: (body, segment) => {
      const feature = slugifyEffectId(body.match(/特徴「([^」]+)」/)?.[1] ?? "feature");
      const holds = body.match(/コマンドを(\d+)つ/)?.[1] ?? "2";
      return noteKw(
        `feature_s_ride_vehicle_hold_${holds}_commands::${feature}`,
        body,
        segment,
        { type: "while_in_field" },
        "feature_s_ride_vehicle_hold_commands",
      );
    },
  },
  {
    pattern: "rush_pay_discard_named_substitute",
    test: (body) =>
      /^※これが自分の手札にある間、自分が「([^」]+)」をラッシュするとき、これを捨札にすれば、.+捨札にしたことにできる/.test(
        body,
      ),
    build: (body, segment) => {
      const name = canonicalCardName(body.match(/自分が「([^」]+)」をラッシュ/)?.[1] ?? "named");
      return noteKw(
        `rush_discard_substitute_for_named::${name}`,
        body,
        segment,
        { type: "while_in_field" },
        "rush_pay_discard_named_substitute",
        true,
      );
    },
  },
];
