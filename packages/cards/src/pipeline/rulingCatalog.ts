/**
 * 特殊裁定カード分類（5 カテゴリ）
 */

export type RulingCategory =
  | "state_rewrite"
  | "rule_override"
  | "timing_exception"
  | "replacement_effect"
  | "continuous_effect";

export type RulingPattern = {
  id: string;
  category: RulingCategory;
  label: string;
  test: RegExp;
};

export const RULING_CATEGORY_META: Record<
  RulingCategory,
  { labelJa: string; description: string }
> = {
  state_rewrite: {
    labelJa: "State Rewrite",
    description: "ゲーム状態・ゾーン構造・枚数など根本的な State 書き換え",
  },
  rule_override: {
    labelJa: "Rule Override",
    description: "通常ルール・勝敗・優先順位・キーワードによる例外上書き",
  },
  timing_exception: {
    labelJa: "Timing Exception",
    description: "フェイズ・誘発タイミング・順序の例外",
  },
  replacement_effect: {
    labelJa: "Replacement Effect",
    description: "「～するかわりに」型の置換・留保効果",
  },
  continuous_effect: {
    labelJa: "Continuous Effect",
    description: "常時・毎ターン・常駐による継続効果・制限",
  },
};

/** 優先度: 先にマッチしたカテゴリを主分類の tie-break に使用 */
export const CATEGORY_PRIORITY: RulingCategory[] = [
  "state_rewrite",
  "rule_override",
  "replacement_effect",
  "timing_exception",
  "continuous_effect",
];

export const RULING_PATTERNS: RulingPattern[] = [
  // --- state_rewrite ---
  {
    id: "deck_resize",
    category: "state_rewrite",
    label: "デッキ枚数変更",
    test: /デッキを.{0,12}枚.{0,8}増やす|山札を.{0,8}枚.{0,8}増やす/,
  },
  {
    id: "card_copy",
    category: "state_rewrite",
    label: "カードコピー",
    test: /コピーして|コピーする|同じようにする/,
  },
  {
    id: "commander_zone",
    category: "state_rewrite",
    label: "コマンダーゾーン",
    test: /コマンダーゾーン|コマンダーカード/,
  },
  {
    id: "mothership_zord",
    category: "state_rewrite",
    label: "母艦・ゾード・モノシップ",
    test: /母艦|モノシップ|ゾードアップ|ホールド置き場/,
  },
  {
    id: "deck_split_manipulation",
    category: "state_rewrite",
    label: "山札上下分割操作",
    test: /デッキの上から\d+枚.{0,30}デッキの下から|山札.{0,6}上.{0,20}下.{0,20}戻す/,
  },
  {
    id: "fusion_recovery",
    category: "state_rewrite",
    label: "合体カード捨札から復元",
    test: /合体に必要なユニットのカードを捨札から探して/,
  },
  {
    id: "reveal_to_hand",
    category: "state_rewrite",
    label: "公開→手札（非標準ドロー）",
    test: /オモテにして相手に見せ.{0,24}手札に加え|公開して.{0,20}手札/,
  },
  {
    id: "disable_resident_ops",
    category: "state_rewrite",
    label: "常駐オペ無効化",
    test: /常駐オペレーションは無効になり/,
  },
  {
    id: "cn_count_modify",
    category: "state_rewrite",
    label: "CN数の書き換え",
    test: /コンビネーションナンバー.{0,15}(すべて|全て).{0,8}(少なく|１少なく|1少なく)|\d+番目のユニット|\d+番目にコンビネーション/,
  },

  // --- rule_override ---
  {
    id: "wing",
    category: "rule_override",
    label: "ウイング",
    test: /ウイング/,
  },
  {
    id: "chase",
    category: "rule_override",
    label: "チェイス",
    test: /チェイス/,
  },
  {
    id: "joint_riding_combo",
    category: "rule_override",
    label: "ジョイント/ライディングコンボ",
    test: /ジョイントコンボ|ライディングコンボ/,
  },
  {
    id: "nc_ignore_combo",
    category: "rule_override",
    label: "NCナンバー無視発動",
    test: /コンビネーションするときは.{0,24}ナンバーに関係なく|ナンバーに関係なく発動/,
  },
  {
    id: "battle_as_original_bp",
    category: "rule_override",
    label: "本来BPとしてバトル",
    test: /本来の値としてバトル|本来のBP/,
  },
  {
    id: "strike_invalid",
    category: "rule_override",
    label: "ストライク無効",
    test: /ストライク.{0,10}無効/,
  },
  {
    id: "combined_bp_rule",
    category: "rule_override",
    label: "BP合計ルール",
    test: /BPの合計が\d+/,
  },
  {
    id: "register",
    category: "rule_override",
    label: "レジスト",
    test: /レジスト/,
  },
  {
    id: "simultaneous_effects",
    category: "rule_override",
    label: "同時発動・順序裁定",
    test: /同時に発動|同時に条件を満たす|適用する順番を決めて/,
  },
  {
    id: "effect_suppressed",
    category: "rule_override",
    label: "効果不発",
    test: /効果は発動しない|無効になる/,
  },
  {
    id: "opponent_chooses",
    category: "rule_override",
    label: "相手選択裁定",
    test: /相手に1枚選ばせ|相手は.{0,12}選んでホールド|相手に選ばせ/,
  },
  {
    id: "turn_player_wins_tie",
    category: "rule_override",
    label: "同時敗北時ターンプレイヤー勝利",
    test: /同時に\d+点目のダメージ|ターンプレイヤーがゲームに勝利/,
  },

  // --- timing_exception ---
  {
    id: "game_start",
    category: "timing_exception",
    label: "ゲーム開始時",
    test: /ゲーム開始時/,
  },
  {
    id: "mode_choice",
    category: "timing_exception",
    label: "モード選択（次から1つ）",
    test: /次の効果から1つ選び|次から1つ選/,
  },
  {
    id: "attack_instead",
    category: "timing_exception",
    label: "アタック代替タイミング",
    test: /アタックするかわりに|アタックできるかわりに/,
  },
  {
    id: "resident_timing_gate",
    category: "timing_exception",
    label: "常駐適用開始タイミング",
    test: /ラッシュフェイズ開始時.{0,30}以降|配置したときに発動する効果は/,
  },
  {
    id: "opponent_turn",
    category: "timing_exception",
    label: "相手ターン発動",
    test: /相手ターン|相手のターン/,
  },
  {
    id: "skip_battle",
    category: "timing_exception",
    label: "バトル不実行",
    test: /バトルは行われない/,
  },
  {
    id: "combo_from_timing",
    category: "timing_exception",
    label: "コンボ元指定タイミング",
    test: /からコンビネーションするとき/,
  },
  {
    id: "end_phase",
    category: "timing_exception",
    label: "エンドフェイズ誘発",
    test: /エンドフェイズ|ターン終了時/,
  },

  // --- replacement_effect ---
  {
    id: "instead_generic",
    category: "replacement_effect",
    label: "かわりに（一般）",
    test: /かわりに|代わりに/,
  },
  {
    id: "stay_on_field",
    category: "replacement_effect",
    label: "場に留まる",
    test: /場に留ま|留まらせ/,
  },
  {
    id: "discard_instead_destroy",
    category: "replacement_effect",
    label: "撃破→捨札置換",
    test: /撃破されて.{0,12}かわりに捨札|かわりに捨札になる/,
  },
  {
    id: "battle_instead_strike",
    category: "replacement_effect",
    label: "ストライク→バトル置換",
    test: /かわりにバトル/,
  },
  {
    id: "super_shield_evolution",
    category: "replacement_effect",
    label: "超シールド進化（捨札代替）",
    test: /超シールド進化/,
  },

  // --- continuous_effect ---
  {
    id: "note_rule",
    category: "continuous_effect",
    label: "※常時ルール",
    test: /^※|※これは毎ターン|※これは自軍コマンド/,
  },
  {
    id: "resident_operation",
    category: "continuous_effect",
    label: "常駐オペレーション",
    test: /常駐置き場|常駐のオペレーション|常駐オペ/,
  },
  {
    id: "passive_bp_modifier",
    category: "continuous_effect",
    label: "常時BP修正",
    test: /にある.{0,20}につきBP|があるとき.{0,30}BP＋|常にBP/,
  },
  {
    id: "alias_name",
    category: "continuous_effect",
    label: "別名として使用",
    test: /としてつかえる/,
  },
  {
    id: "auto_battle_each_turn",
    category: "continuous_effect",
    label: "毎ターン自動バトル進入",
    test: /毎ターン、可能ならバトルエリアに出る/,
  },
  {
    id: "hold_required_entry",
    category: "continuous_effect",
    label: "進入制限（ホールド必須）",
    test: /ホールドしなければバトルエリアに出られない/,
  },
  {
    id: "while_condition_modifier",
    category: "continuous_effect",
    label: "状態依存の継続修正",
    test: /あるとき、.{0,40}(必要パワー|BP|SP).{0,12}(なる|される|できる)/,
  },
];

export type RulingMatch = {
  patternId: string;
  category: RulingCategory;
  label: string;
};

export function matchRulingPatterns(text: string): RulingMatch[] {
  const hits: RulingMatch[] = [];
  for (const p of RULING_PATTERNS) {
    if (p.test.test(text)) {
      hits.push({ patternId: p.id, category: p.category, label: p.label });
    }
  }
  return hits;
}

export function pickPrimaryCategory(categories: Set<RulingCategory>): RulingCategory {
  for (const c of CATEGORY_PRIORITY) {
    if (categories.has(c)) return c;
  }
  return "continuous_effect";
}
