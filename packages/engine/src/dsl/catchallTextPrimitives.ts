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

function selectEnemyUnit(then: EffectPrimitive[], count = 1): EffectPrimitive {
  return {
    type: "choose",
    kind: "select_unit",
    valid: { type: "zone", zone: "battle", owner: "opponent" },
    count,
    then,
  };
}

function selectOwnUnit(zone: "battle" | "rush", then: EffectPrimitive[], count = 1): EffectPrimitive {
  return {
    type: "choose",
    kind: "select_unit",
    valid: { type: "zone", zone, owner: "self" },
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
    case "deck_search_operation_to_power":
    case "rush_discard_deck_search": {
      if (/山札から.*選び.*手札/.test(body) || /手札に加え/.test(body)) {
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
      if (/パワーゾーンに置/.test(body)) {
        return [
          chooseDeck(1, [
            { type: "move", target: { type: "trigger_source" }, to: "power" },
          ]),
        ];
      }
      if (/山札を見/.test(body)) {
        return [chooseDeck(1, [])];
      }
      return null;
    }
    case "destroy_choose_enemy":
    case "destroy_enter_battle":
    case "destroy_on_rush":
    case "destroy_all_enemy":
    case "destroy_remaining": {
      if (/敵軍.*ユニット.*選び.*撃破/.test(body)) {
        const zone = /ラッシュ/.test(body) ? "rush" : "battle";
        return [
          {
            type: "choose",
            kind: "select_unit",
            valid: { type: "zone", zone, owner: "opponent" },
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
    case "enemy_to_power_damage_generic": {
      if (/パワーゾーンにダメージ/.test(body) && /敵軍/.test(body)) {
        const zone = /ラッシュ/.test(body) ? "rush" : "battle";
        return [
          {
            type: "choose",
            kind: "select_unit",
            valid: { type: "zone", zone, owner: "opponent" },
            count: 1,
            then: [
              {
                type: "move",
                target: { type: "trigger_source" },
                to: "power",
              },
            ],
          },
        ];
      }
      return null;
    }
    case "return_to_zone": {
      if (/手札に戻/.test(body)) {
        return [
          selectEnemyUnit(
            [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
            /2体/.test(body) ? 2 : 1,
          ),
        ];
      }
      if (/山札に戻|山札の下/.test(body)) {
        return [
          selectEnemyUnit(
            [{ type: "move", target: { type: "trigger_source" }, to: "deck" }],
            1,
          ),
        ];
      }
      return null;
    }
    case "power_zone_action": {
      if (/パワーゾーンに送|パワーゾーンに置/.test(body)) {
        return [
          selectOwnUnit(
            /ラッシュ/.test(body) ? "rush" : "battle",
            [{ type: "move", target: { type: "trigger_source" }, to: "power" }],
            /2体まで/.test(body) ? 2 : 1,
          ),
        ];
      }
      return null;
    }
    case "deploy_rush_area":
    case "deploy_battle_area": {
      if (/ラッシュエリアに出/.test(body)) {
        return [
          selectEnemyUnit(
            [{ type: "move", target: { type: "trigger_source" }, to: "rush" }],
            /すべて/.test(body) ? 99 : 1,
          ),
        ];
      }
      if (/バトルエリアに出/.test(body)) {
        return [
          selectOwnUnit("rush", [
            { type: "move", target: { type: "trigger_source" }, to: "battle" },
          ]),
        ];
      }
      return null;
    }
    case "hold_enemy_unit":
    case "hold_on_enter_battle": {
      if (/ホールド/.test(body)) {
        return [
          selectEnemyUnit([{ type: "hold", target: { type: "trigger_source" } }]),
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
      if (/捨札から.*選/.test(body)) {
        return [
          {
            type: "choose",
            kind: "select_unit",
            valid: { type: "zone", zone: "discard", owner: "self" },
            count: 1,
            then: [],
          },
        ];
      }
      return null;
    }
    case "discard_to_zone": {
      if (/捨札にし/.test(body) && /手札から/.test(body)) {
        return [
          {
            type: "choose",
            kind: "select_hand",
            valid: { type: "zone", zone: "hand", owner: "self" },
            count: /2枚/.test(body) ? 2 : 1,
            then: [{ type: "move", target: { type: "trigger_source" }, to: "discard" }],
          },
        ];
      }
      return null;
    }
    default:
      return null;
  }
}
