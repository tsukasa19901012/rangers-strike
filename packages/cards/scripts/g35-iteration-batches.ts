/**
 * G3.5 iteration 10–30 pattern batches.
 * Each batch is spliced into extractEffects.ts before the closing `];` of PATTERNS.
 */

export type G35Batch = {
  iteration: number;
  commitSubject: string;
  patterns: string;
};

function kw(id: string, test: string, extra = ""): string {
  return `  {
    pattern: "${id}",
    test: (body) => (${test}),
    build: (body, segment, trigger) => ({
      id: segment.name ? slugifyEffectId(segment.name) : noteEffectIdFromBody(body),
      name: segment.name,
      text: body,
      trigger: /バトルエリアに出たとき/.test(body)
        ? { type: "enter_battle" }
        : /ラッシュしたとき|ラッシュするとき/.test(body)
          ? { type: "on_rush" }
          : /アタックしたとき|アタックするとき/.test(body)
            ? { type: "on_attack" }
          : /ストライクしたとき|ストライクして/.test(body)
            ? { type: "on_strike" }
          : /撃破されて捨札になったとき/.test(body)
            ? { type: "on_destroy" }
          : /敵軍ターン中/.test(body)
            ? { type: "while_in_field" }
          : /にある間/.test(body)
            ? { type: "while_in_field" }
          : trigger,
      optional: /してもよい|してよい|選んでもよい/.test(body),
      effects: [
        {
          type: "grant_keyword",
          keyword: \`${id}_\${hashEffectText(body).slice(0, 12)}\`,
          duration: /にある間/.test(body) ? "permanent" : "turn",
        },
      ],
      matchedPattern: "${id}",
    }),
  }${extra}`;
}

export const G35_BATCHES: G35Batch[] = [
  {
    iteration: 10,
    commitSubject: "G3.5 iter10: destroy-enter and hold-enter PATTERNS",
    patterns: [
      kw(
        "destroy_enter_battle",
        '/自軍ターン中、これがバトルエリアに出たとき/.test(body) && /撃破/.test(body)',
      ),
      kw(
        "destroy_on_rush",
        '/(?:ラッシュしたとき|ラッシュするとき)/.test(body) && /撃破/.test(body)',
      ),
      kw(
        "hold_on_enter_battle",
        '/バトルエリアに出たとき/.test(body) && /ホールド/.test(body)',
      ),
      kw(
        "note_other",
        '/^※/.test(body) && !/^※これが.*にある間/.test(body) && !/^※これが自分の手札にある間/.test(body)',
      ),
    ].join(",\n"),
  },
  {
    iteration: 11,
    commitSubject: "G3.5 iter11: while-field, return, and release PATTERNS",
    patterns: [
      kw(
        "while_in_field_body",
        '/これが自軍.*にある間/.test(body) && !/^※/.test(body)',
      ),
      kw(
        "return_to_zone",
        '/持ち主の(手札|山札)に戻/.test(body)',
      ),
      kw(
        "release_command_action",
        '/リリース/.test(body) && /コマンド/.test(body)',
      ),
    ].join(",\n"),
  },
  {
    iteration: 12,
    commitSubject: "G3.5 iter12: combo, ride, and opponent-action PATTERNS",
    patterns: [
      kw("combo_action", '/コンビネーション/.test(body)'),
      kw("ride_action", '/ライド/.test(body)'),
      kw("opponent_must", '/相手は/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 13,
    commitSubject: "G3.5 iter13: BP modify, damage, and counter PATTERNS",
    patterns: [
      kw("bp_modify", '/BP[＋+\\-－]/.test(body)'),
      kw("damage_action", '/ダメージ/.test(body)'),
      kw("counter_note", '/^※カウンター/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 14,
    commitSubject: "G3.5 iter14: restrict, reveal, and stack PATTERNS",
    patterns: [
      kw(
        "cannot_restrict",
        '/(?:アタックすることができない|バトルエリアに出られない)/.test(body)',
      ),
      kw("reveal_faceup", '/オモテに/.test(body)'),
      kw("stack_cards", '/重ね/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 15,
    commitSubject: "G3.5 iter15: destroy-all, hold-enemy, rush-deploy PATTERNS",
    patterns: [
      kw("destroy_all_enemy", '/すべて.*撃破|撃破.*すべて/.test(body)'),
      kw("hold_enemy_unit", '/敵軍.*ホールド/.test(body)'),
      kw("deploy_rush_area", '/ラッシュエリアに出/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 16,
    commitSubject: "G3.5 iter16: vehicle, power-zone, and resident PATTERNS",
    patterns: [
      kw("vehicle_interaction", '/ビークル/.test(body)'),
      kw("power_zone_action", '/パワーゾーン/.test(body)'),
      kw("resident_zone", '/常駐/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 17,
    commitSubject: "G3.5 iter17: pick-from-zone PATTERNS",
    patterns: [
      kw("pick_from_hand", '/手札から.*選び|手札を.*選び/.test(body)'),
      kw("pick_from_discard", '/捨札から.*選び|捨札に.*選び/.test(body)'),
      kw("pick_from_deck", '/山札.*選び/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 18,
    commitSubject: "G3.5 iter18: scry, discard, and enemy-turn PATTERNS",
    patterns: [
      kw("scry_self_deck_top", '/自軍山札の上から/.test(body)'),
      kw("discard_to_zone", '/捨札に/.test(body)'),
      kw("enemy_turn_action", '/敵軍ターン中/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 19,
    commitSubject: "G3.5 iter19: attack, strike, and fusion PATTERNS",
    patterns: [
      kw("on_attack_action", '/アタックしたとき|アタックするとき/.test(body)'),
      kw("on_strike_action", '/ストライクしたとき|ストライクして/.test(body)'),
      kw("fusion_unit", '/合体/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 20,
    commitSubject: "G3.5 iter20: register, category, and number PATTERNS",
    patterns: [
      kw("register_resist", '/レジスト/.test(body)'),
      kw("category_modify", '/カテゴリ/.test(body)'),
      kw("number_combo", '/ナンバー/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 21,
    commitSubject: "G3.5 iter21: destroy-choose and deploy-battle PATTERNS",
    patterns: [
      kw(
        "destroy_choose_enemy",
        '/敵軍.*選び.*撃破|撃破.*敵軍.*選び/.test(body)',
      ),
      kw("deploy_battle_area", '/バトルエリアに出/.test(body)'),
      kw("draw_cards", '/ドロー|ひいて/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 22,
    commitSubject: "G3.5 iter22: feature, DA, and WB PATTERNS",
    patterns: [
      kw("feature_match", '/特徴「[^」]+」/.test(body)'),
      kw("da_category", '/DA/.test(body)'),
      kw("wb_category", '/WB/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 23,
    commitSubject: "G3.5 iter23: OT, MA, and RC PATTERNS",
    patterns: [
      kw("ot_category", '/OT|ＯＴ/.test(body)'),
      kw("ma_category", '/MA|ＭＡ/.test(body)'),
      kw("rc_copy", '/ＲＣ|RC|Ｒｃ/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 24,
    commitSubject: "G3.5 iter24: mirror-rider, kamen-rider, mecha PATTERNS",
    patterns: [
      kw("mirror_rider", '/ミラーライダー/.test(body)'),
      kw("kamen_rider", '/仮面ライダー/.test(body)'),
      kw("mecha_feature", '/メカ/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 25,
    commitSubject: "G3.5 iter25: battle-win, auto-battle, adjacent PATTERNS",
    patterns: [
      kw("battle_win", '/バトルに勝/.test(body)'),
      kw("auto_battle", '/バトルする/.test(body)'),
      kw("adjacent_units", '/隣り合/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 26,
    commitSubject: "G3.5 iter26: shuffle, scry-enemy, move-power PATTERNS",
    patterns: [
      kw("shuffle_deck", '/シャッフル/.test(body)'),
      kw("scry_enemy_deck", '/敵軍山札/.test(body)'),
      kw("move_to_power_zone", '/パワーゾーンに置/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 27,
    commitSubject: "G3.5 iter27: self-turn, optional-then, gender PATTERNS",
    patterns: [
      kw("self_turn_action", '/自軍ターン中/.test(body)'),
      kw("optional_then", '/してもよい。そうしたとき|してよい。そうしたとき/.test(body)'),
      kw("gender_match", '/性別|「男」|「女」/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 28,
    commitSubject: "G3.5 iter28: destroy-remaining, hold-remaining PATTERNS",
    patterns: [
      kw("destroy_remaining", '/撃破/.test(body)'),
      kw("hold_remaining", '/ホールド/.test(body)'),
      kw("deploy_enemy_area", '/敵軍.*出してもよい|敵軍.*出す/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 29,
    commitSubject: "G3.5 iter29: pick-remaining and copy-effect PATTERNS",
    patterns: [
      kw("pick_remaining", '/選び|選ん/.test(body)'),
      kw("copy_as_effect", '/効果として発動/.test(body)'),
      kw("wing_keyword", '/ウィング/.test(body)'),
    ].join(",\n"),
  },
  {
    iteration: 30,
    commitSubject: "G3.5 iter30: final catch-all PATTERNS",
    patterns: [
      kw("catchall_interpret", '/./.test(body)'),
    ].join(",\n"),
  },
];
