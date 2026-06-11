/** エンジン TS ハンドラで catchall を置き換え済みのカード ID。 */
export const ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS = new Set([
  "RK-282",
  "RS-006",
  "RS-026",
  "RS-129",
  "RS-382",
  "RS-397",
  "RS-427",
  "RS-622",
  "XG1-041",
  "XG4-031",
  "XG4-058",
  "XG5-003",
  "XG5-032",
]);

/** grant_keyword でエンジンが解釈するキーワード（catchall 置換後）。 */
export const ENGINE_NATIVE_GRANT_KEYWORDS = new Set([
  "scissors_attack",
  "victory_robo_strike",
  "invalidate_next_opponent_turn",
  "release_self",
  "last_battle_protect_other_s",
  "enemy_power_cost_minus",
  "end_turn_battle_to_rush",
  "reorder_enemy_battle",
  "rocket_booster",
  "attack_rush_zone",
  "not_selectable",
  "wing",
  "chase",
  "register",
  "morph",
  "resident",
  "commander",
  "mothership",
]);
