import type { EffectDefinition, EffectPrimitive } from "../dsl/types";
import { canonicalCardName } from "../cardName";
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

function triggerFromBody(
  body: string,
  fallback: EffectDefinition["trigger"],
): EffectDefinition["trigger"] {
  if (/バトルエリアに出たとき/.test(body)) return { type: "enter_battle" };
  if (/ラッシュしたとき|ラッシュするとき/.test(body)) return { type: "on_rush" };
  if (/アタックしたとき|アタックするとき/.test(body)) return { type: "on_attack" };
  if (/ストライクしたとき|ストライクして/.test(body)) return { type: "on_strike" };
  if (/撃破されて捨札になったとき/.test(body)) return { type: "on_destroy" };
  if (/敵軍ターン中/.test(body) || /にある間/.test(body)) return { type: "while_in_field" };
  return fallback;
}

function grantKw(
  keyword: string,
  body: string,
  segment: WikiEffectSegment,
  trigger: EffectDefinition["trigger"],
  matchedPattern: string,
  optional?: boolean,
): Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> {
  return {
    id: segment.name ? slugifyEffectId(segment.name) : noteEffectIdFromBody(body),
    name: segment.name,
    text: body,
    trigger: triggerFromBody(body, trigger),
    optional: optional ?? /してもよい|してよい|選んでもよい/.test(body),
    effects: [
      {
        type: "grant_keyword",
        keyword,
        duration: /にある間/.test(body) ? "permanent" : "turn",
      },
    ],
    matchedPattern,
  };
}

/** ※ 系 note_other より前に挿入する RK パターン。 */
export const RK_NOTE_PATTERNS: PatternMatch[] = [
  {
    pattern: "rk_note_bp_per_held_enemy_command",
    test: (body) => /^※これはホールド状態の敵軍ユニット1体につきBP\+(\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = body.match(/BP\+(\d+)/)?.[1] ?? "1000";
      return grantKw(`note_bp_per_held_enemy_command::${amount}`, body, segment, trigger, "rk_note_bp_per_held_enemy_command", false);
    },
  },
  {
    pattern: "rk_note_bp_per_opponent_hand",
    test: (body) => /^※これは相手の手札1枚につきBP\+(\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = body.match(/BP\+(\d+)/)?.[1] ?? "2000";
      return grantKw(`note_bp_per_opponent_hand::${amount}`, body, segment, trigger, "rk_note_bp_per_opponent_hand", false);
    },
  },
  {
    pattern: "rk_note_attack_require_discard_feature",
    test: (body) =>
      /^※これは自軍捨札に特徴「([^」]+)」を持つユニットカードがなければ、特徴「([^」]+)」または「([^」]+)」を持つユニットにアタックすることができない/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const required = body.match(/捨札に特徴「([^」]+)」/)?.[1] ?? "feature";
      return grantKw(
        `note_attack_require_discard_feature::${canonicalCardName(required)}`,
        body,
        segment,
        trigger,
        "rk_note_attack_require_discard_feature",
        false,
      );
    },
  },
  {
    pattern: "rk_note_substitute_on_destroy_feature_s",
    test: (body) =>
      /^※これが撃破されて捨札になるとき、かわりに.*を持つ自軍Sユニットを1体選び捨札にしてもよい/.test(body),
    build: (body, segment, trigger) => {
      const feature =
        body.match(/特徴「([^」]+)」/)?.[1] ??
        body.match(/「([^」]+)」を持つ/)?.[1] ??
        "feature";
      return grantKw(
        `note_substitute_on_destroy_feature_s::${feature}`,
        body,
        segment,
        trigger,
        "rk_note_substitute_on_destroy_feature_s",
        true,
      );
    },
  },
  {
    pattern: "rk_note_substitute_on_destroy_rush_feature",
    test: (body) =>
      /^※これが撃破されて捨札になるとき、かわりに自軍ラッシュエリアにある特徴「([^」]+)」を持つユニット1体を捨札にすれば、これはその場に留まる/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      return grantKw(
        `note_substitute_on_destroy_rush_feature::${feature}`,
        body,
        segment,
        trigger,
        "rk_note_substitute_on_destroy_rush_feature",
        true,
      );
    },
  },
  {
    pattern: "rk_note_on_rush_return_enemy_kamen_s_to_deck",
    test: (body) =>
      /^※これをラッシュしたとき、特徴「([^」]+)」を持つ敵軍Sユニットを1体選び、持ち主の山札の下に戻す/.test(body),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      return grantKw(
        `on_rush_return_enemy_feature_s_to_deck_bottom::${feature}`,
        body,
        segment,
        trigger,
        "rk_note_on_rush_return_enemy_kamen_s_to_deck",
        false,
      );
    },
  },
];

/** while_in_field_body より前に挿入する RK パターン。 */
export const RK_WHILE_PATTERNS: PatternMatch[] = [
  {
    pattern: "rk_while_feature_s_add_category",
    test: (body) =>
      /これが自軍.*にある間、特徴「([^」]+)」を持つ自軍Sユニットはカテゴリに(WB|OT|MA|DA|ET)が追加される/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      const category = body.match(/カテゴリに(WB|OT|MA|DA|ET)/)?.[1] ?? "WB";
      return grantKw(
        `while_feature_s_add_category::${feature}::${category}`,
        body,
        segment,
        trigger,
        "rk_while_feature_s_add_category",
        false,
      );
    },
  },
  {
    pattern: "rk_while_feature_bp_plus",
    test: (body) =>
      /これが自軍.*にある間、特徴「([^」]+)」を持つ自軍ユニットはBP\+(\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      const amount = body.match(/BP\+(\d+)/)?.[1] ?? "1000";
      return grantKw(
        `while_feature_bp_plus::${feature}::${amount}`,
        body,
        segment,
        trigger,
        "rk_while_feature_bp_plus",
        false,
      );
    },
  },
  {
    pattern: "rk_while_command_hold_immune",
    test: (body) =>
      /これが自軍バトルエリアにある間、自軍コマンドゾーンのカードは敵軍ユニットの効果によってホールドされない/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw("while_command_hold_immune", body, segment, trigger, "rk_while_command_hold_immune", false),
  },
  {
    pattern: "rk_while_hold_s_add_feature",
    test: (body) =>
      /これが自軍エリアにある間、ホールド状態の自軍Sユニットは特徴「([^」]+)」が追加される/.test(body),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      return grantKw(
        `while_hold_s_add_feature::${feature}`,
        body,
        segment,
        trigger,
        "rk_while_hold_s_add_feature",
        false,
      );
    },
  },
];

/** 汎用 catchall より前に挿入する RK アクティブパターン。 */
export const RK_ACTION_PATTERNS: PatternMatch[] = [
  {
    pattern: "rk_enemy_battle_held_s_to_power",
    test: (body) =>
      /敵軍バトルエリアから、ホールド状態のSユニットを1体選び、持ち主のパワーゾーンにダメージにして置/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw("enemy_battle_held_s_to_power", body, segment, trigger, "rk_enemy_battle_held_s_to_power"),
  },
  {
    pattern: "rk_hold_self_enemy_battle_s_to_power",
    test: (body) =>
      /このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw("hold_self_enemy_battle_s_to_power", body, segment, trigger, "rk_hold_self_enemy_battle_s_to_power"),
  },
  {
    pattern: "rk_release_command_feature_s_to_rush",
    test: (body) =>
      /自軍コマンドゾーンのリリース状態のカードから、特徴「([^」]+)」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      return grantKw(
        `release_command_feature_s_to_rush::${feature}`,
        body,
        segment,
        trigger,
        "rk_release_command_feature_s_to_rush",
      );
    },
  },
  {
    pattern: "rk_reveal_top3_all_feature_to_rush",
    test: (body) =>
      /自軍山札の上から3枚をオモテにする。その中から特徴「([^」]+)」を持つユニットカードをすべて自軍ラッシュエリアに出す/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      return grantKw(
        `reveal_top3_all_feature_to_rush::${feature}`,
        body,
        segment,
        trigger,
        "rk_reveal_top3_all_feature_to_rush",
      );
    },
  },
  {
    pattern: "rk_mirror_rider_destroy_enemy_s_by_power",
    test: (body) =>
      /特徴「ミラーライダー」を持つ自軍ユニットを1体選び、必要パワーの数字を見る。その後、敵軍バトルエリアから、その数字以下の必要パワーの数字を持つSユニットを1体選び、撃破する/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "mirror_rider_destroy_enemy_s_by_power",
        body,
        segment,
        trigger,
        "rk_mirror_rider_destroy_enemy_s_by_power",
      ),
  },
  {
    pattern: "rk_return_enemy_power_sum_shuffle",
    test: (body) =>
      /敵軍ユニットを、必要パワーの数字の合計が(\d+)になるまで好きな数選び、持ち主の山札に戻してシャッフルしてもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const budget = body.match(/合計が(\d+)/)?.[1] ?? "3";
      return grantKw(
        `return_enemy_power_sum_shuffle::${budget}`,
        body,
        segment,
        trigger,
        "rk_return_enemy_power_sum_shuffle",
      );
    },
  },
  {
    pattern: "rk_combo_named_discard_enemy_command",
    test: (body) =>
      /「([^」]+)」からコンビネーションしたとき発動できる⇒敵軍コマンドゾーンから、ユニットカードを1枚選び捨札にしてもよい/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const name = body.match(/「([^」]+)」からコンビネーション/)?.[1] ?? "named";
      return grantKw(
        `combo_named_discard_enemy_command::${canonicalCardName(name)}`,
        body,
        segment,
        trigger,
        "rk_combo_named_discard_enemy_command",
      );
    },
  },
  {
    pattern: "rk_ride_release_on_mount",
    test: (body) => /ホールド状態のユニットがこれにライドするとき、そのユニットをリリースしてもよい/.test(body),
    build: (body, segment, trigger) =>
      grantKw("ride_release_on_mount", body, segment, trigger, "rk_ride_release_on_mount", true),
  },
  {
    pattern: "rk_on_rush_enemy_s_ride_off",
    test: (body) => /これをラッシュしたとき、ライド中の敵軍Sユニットを1体選び、ライドオフさせてもよい/.test(body),
    build: (body, segment, trigger) =>
      grantKw("on_rush_enemy_s_ride_off", body, segment, trigger, "rk_on_rush_enemy_s_ride_off", true),
  },
  {
    pattern: "rk_enter_battle_destroy_enemy_unridden_s_vehicle",
    test: (body) =>
      /自軍ターン中、これがバトルエリアに出たとき、ライドされていない敵軍Sビークルを1体選び、捨札にしてもよい/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "enter_battle_destroy_enemy_unridden_s_vehicle",
        body,
        segment,
        trigger,
        "rk_enter_battle_destroy_enemy_unridden_s_vehicle",
        true,
      ),
  },
  {
    pattern: "rk_rush_turn_enemy_s_bp_minus",
    test: (body) => /これをラッシュしたターン、敵軍SユニットはBP-(\d+)される/.test(body),
    build: (body, segment, trigger) => {
      const amount = body.match(/BP-(\d+)/)?.[1] ?? "500";
      return grantKw(
        `rush_turn_enemy_s_bp_minus::${amount}`,
        body,
        segment,
        trigger,
        "rk_rush_turn_enemy_s_bp_minus",
        false,
      );
    },
  },
  {
    pattern: "rk_combo_feature_bp_attack_rush",
    test: (body) =>
      /特徴「([^」]+)」を持つ自軍ユニットからコンビネーションするときBP\+(\d+)され、敵軍ラッシュエリアのユニットにアタックできる/.test(
        body,
      ),
    build: (body, segment, trigger) => {
      const feature = body.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
      const amount = body.match(/BP\+(\d+)/)?.[1] ?? "3000";
      return grantKw(
        `combo_feature_bp_attack_rush::${feature}::${amount}`,
        body,
        segment,
        trigger,
        "rk_combo_feature_bp_attack_rush",
        false,
      );
    },
  },
  {
    pattern: "rk_destroy_enemy_cannot_enter_battle",
    test: (body) =>
      /「これはバトルエリアに出られない」または「これは自軍ターン中、バトルエリアに出られない」と書かれた敵軍ユニットを1体選び撃破してもよい/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "destroy_enemy_cannot_enter_battle_text",
        body,
        segment,
        trigger,
        "rk_destroy_enemy_cannot_enter_battle",
        true,
      ),
  },
  {
    pattern: "rk_hold_on_enter_enemy_s_no_resist",
    test: (body) =>
      /自軍ターン中、これがバトルエリアに出たとき、レジストを持たない敵軍Sユニットを1体選びホールドしてもよい/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "hold_on_enter_enemy_s_no_resist",
        body,
        segment,
        trigger,
        "rk_hold_on_enter_enemy_s_no_resist",
        true,
      ),
  },
  {
    pattern: "rk_enemy_rush_s_count_power_match_to_power",
    test: (body) =>
      /敵軍ラッシュエリアのSユニットの数を数えて、その数と同じ必要パワーの数字を持つ敵軍Sユニットがあれば1体選び、持ち主のパワーゾーンに送る/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "enemy_rush_s_count_power_match_to_power",
        body,
        segment,
        trigger,
        "rk_enemy_rush_s_count_power_match_to_power",
        true,
      ),
  },
  {
    pattern: "rk_force_enemy_s_rush_to_battle_reorder",
    test: (body) =>
      /敵軍ラッシュエリアにあるすべてのSユニットをバトルエリアに出してもよい.*その後、敵軍バトルエリアのユニットを、好きな順に並べ替える/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "force_enemy_s_rush_to_battle_reorder",
        body,
        segment,
        trigger,
        "rk_force_enemy_s_rush_to_battle_reorder",
        true,
      ),
  },
  {
    pattern: "rk_counter_mirror_rider_cancel_battle",
    test: (body) =>
      /^※カウンター.*特徴「ミラーライダー」を持つ自軍ユニットがアタックされたとき発動できる⇒そのバトルは行われない/.test(
        body,
      ),
    build: (body, segment, trigger) =>
      grantKw(
        "counter_mirror_rider_cancel_battle",
        body,
        segment,
        { type: "operation", timing: "counter" },
        "rk_counter_mirror_rider_cancel_battle",
        true,
      ),
  },
];
