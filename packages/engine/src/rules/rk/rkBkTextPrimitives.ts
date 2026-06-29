import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { buildCatchallStructuredPrimitives } from "../../dsl/catchallTextPrimitives";

function chooseDeck(count: number, then: EffectPrimitive[]): EffectPrimitive {
  return {
    type: "choose",
    kind: "optional_deck_draw",
    valid: { type: "zone", zone: "deck", owner: "self" },
    count,
    then,
  };
}

function scryTop(count: number, then: EffectPrimitive[]): EffectPrimitive {
  return {
    type: "choose",
    kind: "scry_keep_one",
    valid: { type: "zone", zone: "deck", owner: "self" },
    count,
    then,
  };
}

/** RK/BK grant_keyword 用の追加 primitive 変換。 */
export function buildRkBkStructuredPrimitives(
  body: string,
  matchedPattern: string,
): EffectPrimitive[] | null {
  const base = buildCatchallStructuredPrimitives(body, matchedPattern);
  if (base) return base;

  switch (matchedPattern) {
    case "deck_scry_three_reorder":
    case "deck_scry_one_optional":
      return [scryTop(matchedPattern.includes("three") ? 3 : 1, [])];
    case "recruit_feature_deck_or_resident":
    case "deck_named_rush_shuffle":
      if (/ラッシュエリアに出/.test(body)) {
        return [
          chooseDeck(1, [
            { type: "move", target: { type: "trigger_source" }, to: "rush" },
          ]),
        ];
      }
      return [chooseDeck(1, [])];
    case "enter_hold_enemy_s_command": {
      const minBp = Number(body.match(/BP(\d+)以上/)?.[1] ?? 4000);
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: {
            type: "zone",
            zone: "battle",
            owner: "opponent",
            filter: { size: "S", minBp },
          },
          count: 1,
          then: [{ type: "hold_command", target: { type: "trigger_source" } }],
        },
      ];
    }
    case "stack_s_on_self_rush":
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: { type: "zone", zone: "rush", owner: "self", filter: { size: "S" } },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "rush" }],
        },
      ];
    case "command_return_then_recruit_discard":
      return [
        {
          type: "choose",
          kind: "select_command",
          valid: { type: "zone", zone: "command", owner: "self", filter: { size: "S" } },
          count: 1,
          then: [],
        },
      ];
    case "return_kamen_to_rush":
    case "return_rider_to_rush_end_turn":
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: { type: "zone", zone: "battle", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "rush" }],
        },
      ];
    case "reveal_enemy_deck_hold":
    case "reveal_faceup_enemy_deck":
      return [scryTop(Number(body.match(/(\d+)枚/)?.[1] ?? 3), [])];
    case "rush_discard_search_named":
    case "rush_discard_deck_search":
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: { type: "zone", zone: "discard", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "rush" }],
        },
      ];
    case "dual_bp_rush_discard_combine":
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: { type: "zone", zone: "rush", owner: "self", filter: { size: "S" } },
          count: 1,
          then: [],
        },
      ];
    case "destroy_advent_power_sum":
      return [
        {
          type: "choose",
          kind: "select_unit",
          valid: { type: "zone", zone: "discard", owner: "self" },
          count: 2,
          then: [
            {
              type: "choose",
              kind: "select_unit",
              valid: { type: "zone", zone: "battle", owner: "opponent" },
              count: 1,
              then: [{ type: "move", target: { type: "trigger_source" }, to: "discard" }],
            },
          ],
        },
      ];
    default:
      if (/敵軍.*ユニット.*選び.*撃破/.test(body)) {
        const zone = /ラッシュ/.test(body) ? "rush" : "battle";
        return [
          {
            type: "choose",
            kind: "select_unit",
            valid: { type: "zone", zone, owner: "opponent" },
            count: 1,
            then: [{ type: "move", target: { type: "trigger_source" }, to: "discard" }],
          },
        ];
      }
      if (/パワーゾーンにダメージ/.test(body) && /敵軍/.test(body)) {
        return [
          {
            type: "choose",
            kind: "select_unit",
            valid: {
              type: "zone",
              zone: /ラッシュ/.test(body) ? "rush" : "battle",
              owner: "opponent",
            },
            count: 1,
            then: [{ type: "move", target: { type: "trigger_source" }, to: "power" }],
          },
        ];
      }
      if (/山札から.*選び.*手札|手札に加え/.test(body)) {
        return [
          chooseDeck(1, [
            { type: "move", target: { type: "trigger_source" }, to: "hand" },
          ]),
        ];
      }
      if (/山札から.*選び.*ラッシュ|ラッシュエリアに出/.test(body)) {
        return [
          chooseDeck(1, [
            { type: "move", target: { type: "trigger_source" }, to: "rush" },
          ]),
        ];
      }
      return null;
  }
}
