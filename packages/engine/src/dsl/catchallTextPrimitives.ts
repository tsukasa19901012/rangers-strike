import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";

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

/** catchall 再マッチ後、構造化 primitive に落とせる文言だけ変換する。 */
export function buildCatchallStructuredPrimitives(
  body: string,
  matchedPattern: string,
): EffectPrimitive[] | null {
  switch (matchedPattern) {
    case "reveal_faceup":
    case "scry_self_deck_top": {
      const countMatch = body.match(/上から(\d+)枚/);
      const count = countMatch ? Number(countMatch[1]) : 1;
      if (/捨札にする/.test(body) && /ラッシュエリアに出/.test(body)) {
        return [
          scryTop(count, [
            { type: "move", target: { type: "trigger_source" }, to: "rush" },
          ]),
        ];
      }
      if (/捨札にする/.test(body)) {
        return [
          scryTop(count, [
            { type: "move", target: { type: "trigger_source" }, to: "discard" },
          ]),
        ];
      }
      if (/手札に加え/.test(body)) {
        return [
          scryTop(count, [
            { type: "move", target: { type: "trigger_source" }, to: "hand" },
          ]),
        ];
      }
      return [scryTop(count, [])];
    }
    case "deck_search_generic":
    case "deck_search_feature_reorder_top":
    case "deck_search_rush_feature":
    case "deck_search_minus_power_rush":
    case "deck_search_operation_to_power": {
      if (/山札から.*選び.*手札/.test(body)) {
        return [
          chooseDeck(1, [
            { type: "move", target: { type: "trigger_source" }, to: "hand" },
          ]),
        ];
      }
      if (/山札から.*選び.*ラッシュ/.test(body)) {
        return [
          chooseDeck(1, [
            { type: "move", target: { type: "trigger_source" }, to: "rush" },
          ]),
        ];
      }
      return null;
    }
    case "destroy_choose_enemy":
    case "destroy_enter_battle":
    case "destroy_on_rush":
    case "destroy_all_enemy":
    case "destroy_remaining": {
      if (/敵軍.*ユニット.*選び.*撃破/.test(body)) {
        return [
          {
            type: "choose",
            kind: "select_unit",
            valid: { type: "zone", zone: "battle", owner: "opponent" },
            count: 1,
            then: [
              {
                type: "move",
                target: { type: "trigger_source" },
                to: "discard",
              },
            ],
          },
        ];
      }
      return null;
    }
    case "hand_pick_show_opponent":
    case "pick_from_hand":
    case "pick_from_discard":
    case "pick_from_deck":
    case "pick_remaining": {
      if (/手札から.*選/.test(body) && /見せ/.test(body)) {
        return [
          {
            type: "choose",
            kind: "select_hand",
            valid: { type: "zone", zone: "hand", owner: "self" },
            count: 1,
            then: [],
          },
        ];
      }
      return null;
    }
    default:
      return null;
  }
}
