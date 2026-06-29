/** grant_keyword ハッシュ／semantic catchall スタブ — engine 側コピー。 */

const HASH_STUB_SUFFIX = /_[a-f0-9]{6,}$/;

const CATCHALL_GRANT_KEYWORD_PREFIXES =
  /^(opponent_must_|category_modify_|bp_modify_|note_other_|optional_then_|while_in_field_body_|while_note_|grant_effect_|grant_ability_|choice_one_of_|combo_action_|destroy_enter_battle_|hold_on_enter_battle_|enemy_power_damage_|destroy_on_rush_|ride_action_|power_zone_action_|hand_resident_rush_named_|hand_rush_named_|per_ally_named_|adjacent_named_|ally_named_|power_faceup_named_|release_command_action_|deploy_rush_area_|damage_action_|exclude_game_|return_to_zone_|discard_to_zone_|destroy_choose_enemy_|reveal_faceup_|deck_search_|hold_enemy_unit_|self_turn_action_|catchall_interpret_|wing_keyword_|combo_from_named_|draw_cards_|deploy_battle_area_|feature_match_|number_combo_|scry_self_deck_top_|move_to_power_zone_|pick_remaining_|ignore_rule_text_|combo_l_ability_|combo_l_effect_|return_self_on_ally_rush_|return_ally_on_rush_|combo_l_attack_strike_|combo_l_process_|hand_pick_show_|enter_hold_enemy_|combo_hold_s_|rush_discard_instead_|ride_discard_trigger_|rush_discard_search_|opponent_self_order_|ride_s_ability_|counter_note_|cannot_restrict_|stack_cards_|destroy_all_enemy_|vehicle_interaction_|resident_zone_|pick_from_hand_|pick_from_discard_|pick_from_deck_|enemy_turn_action_|on_attack_action_|on_strike_action_|fusion_unit_|register_resist_|da_category_|wb_category_|ot_category_|ma_category_|rc_copy_|mirror_rider_|kamen_rider_|mecha_feature_|battle_win_|auto_battle_|adjacent_units_|shuffle_deck_|scry_enemy_deck_|gender_match_|destroy_remaining_|hold_remaining_|deploy_enemy_area_|copy_as_effect_)/;

export function isHashGrantKeywordStub(keyword: string): boolean {
  if (!HASH_STUB_SUFFIX.test(keyword)) return false;
  return CATCHALL_GRANT_KEYWORD_PREFIXES.test(keyword);
}

export function isCatchallGrantKeyword(keyword: string): boolean {
  if (isHashGrantKeywordStub(keyword)) return true;
  return CATCHALL_GRANT_KEYWORD_PREFIXES.test(keyword);
}
