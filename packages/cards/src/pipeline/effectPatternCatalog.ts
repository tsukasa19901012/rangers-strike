/**
 * 共通 Effect 候補カタログ（Wiki 効果文パターンマッチ用）
 * extract-effect-catalog と extractEffects で共有
 */

export type EffectPatternEntry = {
  id: string;
  name: string;
  description: string;
  /** 代表的正規表現（数値は \d+ で一般化） */
  test: RegExp;
  /** DSL primitive 相当か */
  primitiveReady: boolean;
  /** エンジン TS ハンドラ実装済みか（catalog 生成時に上書き可） */
  implemented?: boolean;
};

export const EFFECT_PATTERN_CATALOG: EffectPatternEntry[] = [
  {
    id: "place_in_power",
    name: "パワー配置",
    description: "このカードを自軍パワーゾーンに置く",
    test: /このカードを自軍パワーゾーンに置く/,
    primitiveReady: true,
  },
  {
    id: "draw_cards",
    name: "ドロー",
    description: "自分はN枚ドローする",
    test: /自分は\d+枚ドローする/,
    primitiveReady: true,
  },
  {
    id: "grant_sp",
    name: "SP付与",
    description: "「SPN」キーワード付与（NC）",
    test: /「SP\d+」/,
    primitiveReady: true,
  },
  {
    id: "bp_boost",
    name: "BP強化",
    description: "このターン、ユニットのBPを+Nする",
    test: /BP[＋+]\d+|BPが\d+アップ|BP＋\d+される/,
    primitiveReady: true,
  },
  {
    id: "destroy_enemy_bp",
    name: "BP条件撃破",
    description: "敵軍バトルエリアからBP以下のユニットを撃破",
    test: /敵軍バトルエリアからBP\d+以下のユニットを1体選んで撃破|バトルエリアに出たとき、敵軍バトルエリアからBP\d+以下/,
    primitiveReady: true,
  },
  {
    id: "move_enemy_to_power",
    name: "敵ユニット→パワー",
    description: "敵軍ユニットを持ち主のパワーゾーンに送る",
    test: /選んだユニットを持ち主のパワーゾーンに送る/,
    primitiveReady: true,
  },
  {
    id: "move_enemy_to_command_hold",
    name: "敵ユニット→コマンドホールド",
    description: "BP以下の敵ユニットをコマンドゾーンにホールド",
    test: /持ち主のコマンドゾーンにホールド/,
    primitiveReady: true,
  },
  {
    id: "return_enemy_to_deck",
    name: "敵ユニット→山札上",
    description: "ユニットを持ち主の山札の上に戻す",
    test: /持ち主の山札の上に戻してもよい/,
    primitiveReady: true,
  },
  {
    id: "return_command_to_hand",
    name: "敵コマンド→手札",
    description: "敵軍コマンドゾーンのカードを手札に戻す",
    test: /敵軍コマンドゾーンからカードを1枚選んで、持ち主の手札に戻してもよい/,
    primitiveReady: true,
  },
  {
    id: "discard_s_to_hand",
    name: "捨札Sユニット→手札",
    description: "自軍捨札からSユニットを手札に加える",
    test: /自軍捨札からSユニット1枚を選び、手札に加える/,
    primitiveReady: true,
  },
  {
    id: "discard_any_to_hand",
    name: "捨札→手札",
    description: "自軍捨札からカードを手札に加える",
    test: /自軍捨札からカード1枚を選び、手札に加える/,
    primitiveReady: true,
  },
  {
    id: "counter_retreat_rush",
    name: "カウンター：ラッシュへ退避",
    description: "アタックされたユニットをラッシュエリアに戻す",
    test: /アタックされたユニットをラッシュエリアに戻す/,
    primitiveReady: true,
  },
  {
    id: "scry_one",
    name: "山札見て上下選択",
    description: "山札の上から1枚を見て、上か下に戻す",
    test: /山札の上から1枚を見てもよい/,
    primitiveReady: true,
  },
  {
    id: "scry_keep_one",
    name: "山札3枚スクリー",
    description: "山札の上から3枚を見て1枚を山札上に残す",
    test: /山札の上から3枚を見てもよい/,
    primitiveReady: true,
  },
  {
    id: "destroy_enemy_l",
    name: "敵Lユニット撃破",
    description: "敵軍Lユニットを1体選んで撃破",
    test: /敵軍Lユニットを1体選んで撃破/,
    primitiveReady: true,
  },
  {
    id: "alias_fusion_material",
    name: "合体素材エイリアス",
    description: "※これは「○○」としてつかえる",
    test: /^※これは「[^」]+」としてつかえる/,
    primitiveReady: true,
  },
  {
    id: "destroy_self_damage",
    name: "撃破時自ダメージ",
    description: "※これが撃破されたとき、N点ダメージを受ける",
    test: /^※これが撃破されたとき、\d+点ダメージを受ける/,
    primitiveReady: true,
  },
  {
    id: "auto_battle_entry",
    name: "毎ターン自動バトル進入",
    description: "※これは毎ターン、可能ならバトルエリアに出る",
    test: /^※これは毎ターン、可能ならバトルエリアに出る/,
    primitiveReady: true,
  },
  {
    id: "require_command_hold_entry",
    name: "コマンドホールド必須進入",
    description: "※自軍コマンドをホールドしなければバトルエリアに出られない",
    test: /^※これは自軍コマンドを1つホールドしなければバトルエリアに出られない/,
    primitiveReady: true,
  },
  {
    id: "usable_as_keyword",
    name: "別名として使用",
    description: "※これは「○○」としてつかえる（ユニット名）",
    test: /としてつかえる/,
    primitiveReady: false,
  },
  {
    id: "on_rush_optional",
    name: "ラッシュ時任意発動",
    description: "これをラッシュしたとき発動できる",
    test: /これをラッシュしたとき発動できる/,
    primitiveReady: false,
  },
  {
    id: "enter_battle_trigger",
    name: "バトル進入時",
    description: "これがバトルエリアに出たとき",
    test: /これがバトルエリアに出たとき/,
    primitiveReady: false,
  },
  {
    id: "on_attack_trigger",
    name: "アタック時",
    description: "これがアタックしたとき / アタックするとき",
    test: /アタックしたとき|アタックするとき/,
    primitiveReady: false,
  },
  {
    id: "on_strike_trigger",
    name: "ストライク時",
    description: "ストライクしたとき / ストライクされたとき",
    test: /ストライクしたとき|ストライクされたとき/,
    primitiveReady: false,
  },
  {
    id: "combo_from_partner",
    name: "コンボ元指定NC",
    description: "「○○」からコンビネーションするとき",
    test: /からコンビネーションするとき/,
    primitiveReady: false,
  },
  {
    id: "hold_all_enemy_command",
    name: "敵コマンド全ホールド",
    description: "敵軍コマンドをすべてホールド",
    test: /敵軍コマンドをすべてホールド/,
    primitiveReady: false,
  },
  {
    id: "deal_damage",
    name: "プレイヤーダメージ",
    description: "N点ダメージを与える / 受ける",
    test: /\d+点ダメージを(与える|受ける)/,
    primitiveReady: true,
  },
  {
    id: "prevent_battle",
    name: "バトル無効",
    description: "バトルは行われない",
    test: /バトルは行われない/,
    primitiveReady: true,
  },
  {
    id: "deck_manipulation",
    name: "山札操作",
    description: "山札の上/下、シャッフル、戻す",
    test: /山札に戻す|山札をシャッフル|デッキの上|デッキの下/,
    primitiveReady: false,
  },
  {
    id: "choice_one_of",
    name: "複数効果から選択",
    description: "次の効果から1つ選び",
    test: /次の効果から1つ選び|次から1つ選/,
    primitiveReady: false,
  },
  {
    id: "game_start_once",
    name: "ゲーム開始時1回",
    description: "ゲーム開始時、一度だけ",
    test: /ゲーム開始時、一度だけ/,
    primitiveReady: false,
  },
  {
    id: "resident_operation",
    name: "常駐オペレーション",
    description: "常駐置き場 / 常駐のオペレーション",
    test: /常駐置き場|常駐のオペレーション|常駐オペ/,
    primitiveReady: false,
  },
  {
    id: "register_reaction",
    name: "レジスト",
    description: "レジスト / 場に留まる",
    test: /レジスト|場に留ま/,
    primitiveReady: false,
  },
  {
    id: "wing_chase",
    name: "ウイング/チェイス",
    description: "ウイングまたはチェイスキーワード",
    test: /ウイング|チェイス/,
    primitiveReady: false,
  },
  {
    id: "joint_riding_combo",
    name: "ジョイント/ライディング",
    description: "ジョイントコンボ / ライディングコンボ",
    test: /ジョイントコンボ|ライディングコンボ/,
    primitiveReady: false,
  },
  {
    id: "zord_mothership",
    name: "ゾード/母艦",
    description: "ゾードアップ / 母艦 / モノシップ",
    test: /ゾード|母艦|モノシップ/,
    primitiveReady: false,
  },
  {
    id: "copy_effect",
    name: "コピー",
    description: "コピーして同じようにする",
    test: /コピーして|コピーする/,
    primitiveReady: false,
  },
  {
    id: "reveal_look",
    name: "公開/見せる",
    description: "オモテにして相手に見せる",
    test: /オモテにして相手に見せ|公開して/,
    primitiveReady: false,
  },
];

export function matchEffectPatterns(text: string): string[] {
  const matched: string[] = [];
  for (const entry of EFFECT_PATTERN_CATALOG) {
    if (entry.test.test(text)) matched.push(entry.id);
  }
  return matched;
}
