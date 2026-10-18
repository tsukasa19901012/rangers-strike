import type { CardDefinition } from "@rangers-strike/cards";
import { EFFECT_LABELS } from "@rangers-strike/cards";
import type { GameState } from "@rangers-strike/engine";
import { previewAttackHoldBp } from "@rangers-strike/engine";

export function sagasSniperDeckCardMeta(
  card: CardDefinition,
  maxPowerCost: number,
  selectable: boolean,
): string {
  if (selectable) return "手札に加える";
  if (card.type !== "unit") return "ユニット以外（選択不可）";
  const costLabel = card.powerCost !== undefined ? String(card.powerCost) : "?";
  return `必要パワー${costLabel}（上限${maxPowerCost}超過）`;
}

/**
 * 第7弾 RS-495〜RS-515 のカード固有の選択（engine rules/legend1/set7NamedEffectsD.ts）の表示名と案内文。
 * 「発動する／しない」の選択は、効果のユニット自身を選ぶと発動する。
 */
const SET7D_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  set7d_multi_destroy: { label: "撃破するユニットの選択", hint: "撃破する敵軍ユニットを1体ずつ選んでください（選び終えたら「スキップ」で確定）" },
  rs499_rourou_kick: { label: "狼狼蹴", hint: "このユニットをホールドして効果を発動しますか？（発動するならこのユニットを選ぶ）" },
  rs500_cyblade_cutter: { label: "サイブレードカッター", hint: "相手に見せる「激気」のユニットカードを手札から選んでください" },
  rs502_bat_lee: { label: "忘我の中に修行あり", hint: "かわりに捨札にするユニットカードを手札から選んでください" },
  rs502_bat_lee_destroy: { label: "忘我の中に修行あり", hint: "BP の合計と同じ BP の敵軍ユニットを1体選び撃破してください" },
  rs508_road_saber: { label: "ロードサーベル", hint: "このユニットとバトルさせる敵軍ユニットを選んでください" },
  rs509_garage_launcher: { label: "ガレージランチャー", hint: "手札に加えるオペレーションカードを自軍パワーゾーンから選んでください" },
  rs510_racing_bullet: { label: "レーシングバレット", hint: "自軍パワーゾーンに置く「車両」のユニットカードを手札から選んでください" },
  rs510_racing_bullet_send: { label: "レーシングバレット", hint: "自分のパワーゾーンに送る S ユニットを選んでください" },
  rs511_rod_mode: { label: "マンタンガン・ロッドモード", hint: "山札の上から1枚ひいてパワーゾーンに置きますか？（置くならこのユニットを選ぶ）" },
  rs512_mantangan: { label: "マンタンガン", hint: "ダメージにする敵軍パワーゾーンのオモテ向きのカードを選んでください" },
  rs514_dai_rourou_kick: { label: "大狼狼蹴", hint: "撃破する自分のユニットを1体選んでください" },
  rs515_go_on_sword: { label: "ゴーオンソード", hint: "必要パワーの勝負をしますか？（するならこのユニットを選ぶ）" },
  rs515_go_on_sword_order: { label: "ゴーオンソード", hint: "先に山札の下に置くカードを選んでください（あとから置くカードほど下になります）" },
  // 第7弾 RS-489（engine rules/legend1/set7NamedEffectsC.ts）。
  rs489_box_dimension_order: { label: "宇宙忍法・箱次元", hint: "先に山札の下に戻すユニットを選んでください（見送ると戻しません）" },
  // 第8弾 RS-538〜RS-559（engine rules/legend1/set8NamedEffectsB.ts）。
  rs546_empire_attack: { label: "エンパイアアタック", hint: "WB を持たないバトルエリアのユニットをすべて撃破します" },
  rs549_tricera_lance: { label: "トリケランス", hint: "ホールドする敵軍 S ユニットを1体ずつ選んでください（必要パワーの合計が敵軍ダメージまで。やめるなら「スキップ」）" },
  rs550_god_finish: { label: "鉄拳ゴッドフィニッシュ", hint: "パワーゾーンにダメージにして置く敵軍ユニットを選んでください（見送れます）" },
  rs551_gamma_dynamite: { label: "ガンマーダイナマイト", hint: "パワーゾーンにダメージにして置く、自分の「怪人」ユニットを1体選んでください" },
  rs554_flying_beam: { label: "フライングビーム", hint: "パワーゾーンにダメージにして置く敵軍ユニットを選んでください（見送れます）" },
  rs556_salda_claw: { label: "サルダークロー", hint: "敵軍山札の上からオモテにしますか？（するならこのユニットを選ぶ）" },
  rs556_salda_claw_order: { label: "サルダークロー", hint: "先に山札の下に戻すカードを選んでください（あとから戻すカードほど下になります）" },
  rs558_key_holder_wish: { label: "鍵の持ち主の願い", hint: "1枚ドローしますか？" },
  rs559_power_arrow: { label: "パワーアロー", hint: "撃破する BP8000 以下の敵軍ユニットを選んでください（見送れます）" },
};

/**
 * 第8弾 RS-582〜RS-604 のカード固有の選択（engine rules/legend1/set8NamedEffectsD.ts）の表示名と案内文。
 * 「発動する／しない」の選択は、効果のユニット自身を選ぶと発動する。
 */
const SET8D_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rs582_mee_megalo: { label: "メー・メガロ", hint: "手札に加える同じカード名のカードを山札から選んでください（加えないなら「スキップ」。その後、山札をシャッフルします）" },
  rs583_take_the_blow: { label: "災いを受け止める覚悟", hint: "アタックの対象をこのユニットに代えますか？（代えるならこのユニットを選ぶ）" },
  set8d_opponent_self_destroy: { label: "撃破するユニットの選択", hint: "撃破する自分のユニットを1体選んでください" },
  rs587_fierce_fight: { label: "激しい闘争心", hint: "撃破する自軍 S ユニットを選んでください（相手も自分のユニットを1体撃破します）" },
  set8d_borrow_hand_combo: { label: "相手の手札の効果", hint: "相手の手札を見ますか？（見るならこのユニットを選ぶ）" },
  set8d_borrow_hand_combo_pick: { label: "相手の手札の効果", hint: "効果を発動する S ユニットのカードを相手の手札から選んでください" },
  set8d_borrow_hand_combo_branch: { label: "相手の手札の効果", hint: "発動する効果（NC／RC）を選んでください" },
  rs589_gray_blaster: { label: "グレイブラスター", hint: "ホールドする自軍 S ユニットを選んでください（相手は自分のユニットを1体撃破します）" },
  rs592_g6_grand_prix: { label: "G6グランプリ", hint: "パワーゾーンが6枚になるように捨札にするオモテ向きのカードを選んでください" },
  rs592_g6_grand_prix_destroy: { label: "G6グランプリ", hint: "撃破する BP6000 以下の敵軍ユニットを1体ずつ選んでください（選び終えたら「スキップ」で確定）" },
  rs593_balcutter: { label: "バルカッター", hint: "手札に戻すオモテ向きのカードを自分のパワーゾーンから選んでください（戻すと相手のバルカはストライクできません）" },
  rs594_gunpard_gun: { label: "ガンパードガン", hint: "相手の手札を見ないで3枚まで選んでください（選び終えたら「スキップ」で確定）" },
  rs594_gunpard_gun_place: { label: "ガンパードガン", hint: "持ち主のパワーゾーンに置く S ユニットのカードを選んでください" },
  rs594_gunpard_return: { label: "ガンパードガン", hint: "手札に戻すオモテ向きのカードをパワーゾーンから選んでください" },
  rs596_flame_sword: { label: "炎神剣", hint: "山札の上を1枚オモテにしますか？（するならこのユニットを選ぶ）" },
  rs598_justice_sortie: { label: "正義の出陣", hint: "リリースするホールド状態の敵軍コマンドを選んでください" },
  rs598_justice_sortie_deploy: { label: "正義の出陣", hint: "ラッシュエリアに出す「炎神」の M ユニットのカードをパワーゾーンから選んでください" },
  rs599_reclaim_flame: { label: "取り戻す炎心", hint: "手札に加えるダメージのカードを選んでください" },
  rs601_full_power: { label: "ミッション6 フルパワー", hint: "リリースする敵軍コマンドを1つずつ選んでください（3つまで。選び終えたら「スキップ」で確定）" },
  rs601_full_power_destroy: { label: "ミッション6 フルパワー", hint: "撃破する敵軍ユニットを選んでください" },
};

/** 第9弾 RS-605〜RS-626 の選択（engine rules/legend1/set9NamedEffectsA.ts）の表示名と案内文。 */
const SET9A_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rs9a_command_overflow: { label: "コマンドゾーンに置けないユニット", hint: "コマンドゾーンに置ききれないので、かわりに捨札にするユニットを選んでください" },
  rs605_wing_from_deck: { label: "異次元からの翼", hint: "ラッシュエリアに出すウイングを持つユニットのカードを山札から選んでください（その後、山札をシャッフルします）" },
  rs606_hikarimaru_release: { label: "雷鳴剣ヒカリマル", hint: "リリースするホールド状態のウイングを持つ自軍ユニットを選んでください（しないなら「スキップ」）" },
  rs606_hikarimaru_target: { label: "雷鳴剣ヒカリマル", hint: "ダメージにして置く敵軍バトルエリアのユニットを選んでください" },
  rs607_falcon_continue: { label: "ファルコンサモナー", hint: "もう1回、山札の上をオモテにしますか？（やめるなら「スキップ」）" },
  rs607_falcon_discard: { label: "ファルコンサモナー", hint: "捨札にするカードを手札から1枚選んでください" },
  rs608_goshoku_hold: { label: "五色の戦士", hint: "ホールドする WB の自軍コマンドを選んでください" },
  rs608_goshoku_unit: { label: "五色の戦士", hint: "特徴を追加する自軍 S ユニットを選んでください" },
  rs608_goshoku_feature: { label: "五色の戦士", hint: "追加する特徴を宣言してください" },
  rs609_soul_cost: { label: "戦士の魂", hint: "コマンドゾーンに送るか捨札にする自軍ラッシュエリアの S ユニットを選んでください" },
  rs609_soul_cost_destination: { label: "戦士の魂", hint: "送り先を選んでください" },
  rs609_soul_battle: { label: "戦士の魂", hint: "NC の効果を貸すバトルエリアの S ユニットを選んでください" },
  rs609_soul_rush: { label: "戦士の魂", hint: "NC の効果を置き換えるラッシュエリアの S ユニットを選んでください" },
  rs609_soul_nc: { label: "戦士の魂", hint: "発動する NC の効果のユニットを選んでください（本来の効果ならこのユニット）" },
  rs612_sky_container_command: { label: "スカイコンテナ", hint: "捨札にする自軍コマンドを1つずつ選んでください（選び終えたら「選び終える」）" },
  rs612_sky_container_deck: { label: "スカイコンテナ", hint: "コマンドゾーンにホールド状態で置く「メカ」の S ユニットのカードを山札から選んでください" },
  rs613_diamond_sword: { label: "ダイヤソード", hint: "撃破する敵軍ユニットを選んでください（しないなら「スキップ」）" },
  rs614_club_megaton: { label: "クラブメガトン", hint: "BP4000 の敵軍 S ユニットをすべてコマンドゾーンに置きますか？（置くならいずれかを選ぶ）" },
  rs615_jakka_koback: { label: "ジャッカーコバック", hint: "ホールドするブルー・レッド・グリーンの S ユニットを1体ずつ選んでください" },
  rs620_garuda_claw: { label: "ガルーダクロー", hint: "山札の上に戻す敵軍パワーゾーンのカードを選んでください" },
  rs621_diamond_blizzard: { label: "ダイヤブリザード", hint: "パワーゾーンに送る敵軍ユニットを1体ずつ選んでください（本来の BP の合計8000まで。選び終えたら「スキップ」で送る）" },
  rs624_winger_cannon: { label: "ウインガーキャノン", hint: "効果を発動しますか？（するならこのユニットを選ぶ）" },
  rs626_mega_shield: { label: "メガシールド", hint: "撃破する敵軍ユニット、またはラッシュエリアに出す捨札のウイングを持つ S ユニットのカードを選んでください" },
  rs626_mega_shield_deploy: { label: "メガシールド", hint: "ラッシュエリアに出すカードを選んでください（5枚まで。選び終えたら「スキップ」で出す）" },
  rk322_blizzard_claw_execution: { label: "ブリザードクロー・エクスキュージョン", hint: "このユニットをホールドして BP+4000 しますか？（するならこのユニットを選ぶ）" },
};

/** ライダーEXP vol.1 RK-001〜RK-021 のカード固有の選択（engine rules/rk/rk1NamedEffects.ts）の表示名と案内文。 */
const RK1_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rk002_v3_pick: { label: "V3ホッパー", hint: "山札の上か下に戻すカードを1枚選んでください（上に戻したカードは後から戻したものほど上、下に戻したカードは後から戻したものほど下になります）" },
  rk002_v3_place: { label: "V3ホッパー", hint: "選んだカードを山札の上と下のどちらに戻すか選んでください" },
  rk003_kaizorg: { label: "カイゾーグ", hint: "自軍コマンドを1つホールドして、このユニットカードを自軍山札の下に戻しますか？（戻すならカードを選ぶ）" },
  rk005_dynamo: { label: "超電子ダイナモ", hint: "能力を与える特徴「改造人間」の自軍 S ユニットを選んでください" },
  rk007_maintenance_return: { label: "メンテナンス", hint: "手札に戻すリリース状態の S ユニットのカードを自軍コマンドゾーンから選んでください" },
  rk007_maintenance_place: { label: "メンテナンス", hint: "自軍コマンドゾーンにホールド状態で置く「改造人間」の S ユニットのカードを捨札から選んでください" },
  rk011_third_eye: { label: "第三の眼", hint: "相手のカウンターを無効にするために捨札にするカードを手札から選んでください（無効にしないなら「スキップ」）" },
  rk013_j_power: { label: "Jパワー", hint: "Jパワーを重ねて L ユニットにする自軍 S ユニットを選んでください" },
  rk015_human_evolution: { label: "人類の進化", hint: "ひいたカードを自軍ラッシュエリアに出しますか？（出すならカードを選ぶ。出さなければ手札に加えます）" },
  rk016_mirror_world_stack: { label: "ミラーワールド", hint: "ミラーワールドに重ねる自軍 S ユニットを選んでください" },
  rk017_mission_memory: { label: "ミッションメモリー", hint: "RC を持つ自軍 S ユニットを選んでください" },
  rk018_rouse_rush: { label: "ラウズカード", hint: "BP を上げる自軍ラッシュエリアの S ユニットを選んでください" },
  rk018_rouse_discard: { label: "ラウズカード", hint: "BP を加える S ユニットのカードを自軍捨札から選んでください" },
  rk019_ongeki: { label: "音撃", hint: "特徴「メカ」を持たない敵軍ユニットを選んでください" },
  rk020_double_kick_pick: { label: "ダブルライダーキック", hint: "自軍ラッシュエリアの「仮面ライダー」のユニットを2体選んでください" },
  rk020_double_kick_destroy: { label: "ダブルライダーキック", hint: "撃破する敵軍バトルエリアの BP8000 以下のユニットを選んでください" },
};

/** ライダーEXP vol.1 RK-022〜RK-042 のカード固有の選択（engine rules/rk/rk2UnitEffects.ts）の表示名と案内文。 */
const RK2_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rk022_pass_search: { label: "ライダーパス", hint: "ライダーパスに重ねる特徴「DEN-O」のユニットカードを自軍山札から選んでください（4枚まで。やめるなら「スキップ」）" },
  rk024_cyclone_crusher: { label: "サイクロンクラッシャー", hint: "持ち主のコマンドゾーンにホールド状態で置く、追加条件を持たない BP4000 以上の敵軍 S ユニットを選んでください" },
  rk025_denpa_order: { label: "電波投げ", hint: "山札の上に戻すカードを、上に置くものから1枚ずつ選んでください" },
  rk026_seigi_no_mikata: { label: "日本一の正義の味方", hint: "ラッシュエリアに戻す特徴「仮面ライダー」の自軍ユニットを選んでください（戻さないなら「スキップ」）" },
  rk027_rider_kick: { label: "ライダーキック", hint: "持ち主のパワーゾーンにダメージにして置く敵軍 S ユニットを選んでください" },
  rk028_dynamic_smash: { label: "ダイナミックスマッシュ", hint: "持ち主の手札に戻す敵軍バトルエリアの S ユニットを選んでください" },
  rk030_radio_look: { label: "無線通信", hint: "自軍山札の上から1枚を見ますか？（見るならカードを選ぶ）" },
  rk030_radio_place: { label: "無線通信", hint: "見たカードを山札の上と下のどちらに戻すか選んでください" },
  rk031_battery: { label: "バッテリー交換", hint: "自軍山札の上から1枚を自軍コマンドゾーンにホールド状態で置きますか？" },
  rk032_another_punch: { label: "アナザーパンチ", hint: "持ち主のパワーゾーンにダメージにして置く敵軍バトルエリアの「仮面ライダー」の S ユニットを選んでください" },
  rk038_heavy_pressure: { label: "ヘビープレッシャー", hint: "撃破する敵軍ユニットを選んでください（必要パワーの数字が敵軍ダメージの点数以下。撃破しないなら「スキップ」）" },
  rk039_charge: { label: "突進", hint: "ライドオフさせるライド中の敵軍 S ユニットを選んでください" },
  rk042_flash_wing_hold: { label: "閃光の翼", hint: "ホールドする自分自身のコマンドを選んでください" },
};

/** ライダーEXP vol.1 RK-043〜RK-063 のカード固有の選択（engine rules/rk/rk3UnitEffects.ts）の表示名と案内文。 */
const RK3_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rk047_raiden_target: { label: "音撃斬・雷電激震", hint: "敵軍バトルエリアのユニットを1体選んでください" },
  rk047_raiden_hold: { label: "音撃斬・雷電激震", hint: "ホールドする自軍コマンドを選んでください（選んだユニットの必要パワーの数字＋1つ。撃破しないなら「スキップ」）" },
  rk050_enma_sabaki: { label: "音撃斬・閻魔裁き", hint: "お互いにバトルする数字（BP・必要パワーの数字・ナンバーの数字）を選んでください" },
  rk051_hissatsu_hicchu: { label: "音撃打・必殺必中", hint: "撃破する「…バトルに勝っても撃破される」と書かれた敵軍ユニットを選んでください" },
  rk053_gatack_vulcan: { label: "ガタックバルカン", hint: "捨札にする自軍パワーゾーンのダメージ以外のカードを選んでください（ラッシュされたユニットはこのターンバトルエリアに出られない。使わないなら「スキップ」）" },
  rk054_rider_cutting_first: { label: "ライダーカッティング", hint: "撃破する、BP の合計が 6000 になる隣り合う2体の敵軍 S ユニットの1体目を選んでください" },
  rk054_rider_cutting_second: { label: "ライダーカッティング", hint: "撃破するもう1体（1体目と隣り合い、BP の合計が 6000）を選んでください" },
  rk055_rider_punch: { label: "ライダーパンチ", hint: "ラッシュエリアに戻す敵軍バトルエリアの S ユニットを選び、選び終えたら「決定」（戻さないなら「スキップ」）" },
  rk057_rider_sting: { label: "ライダースティング", hint: "持ち主のパワーゾーンに置く敵軍バトルエリアの BP4000 以上の S ユニットを選んでください" },
  rk061_ippon_zuri: { label: "一本釣り", hint: "敵軍バトルエリアに出す、敵軍パワーゾーンのダメージ以外の S ユニットのカードを選んでください（出さないなら「スキップ」）" },
  rk061_ippon_zuri_discard: { label: "一本釣り", hint: "アナザーアギトを出すために捨札にする、自軍ラッシュエリアの特徴「仮面ライダー」のユニットを選んでください" },
};

/** ライダーEXP RK-064〜RK-084 のカード固有の選択（engine rules/rk/rk4UnitEffects.ts・rules/residentOps.ts）の表示名と案内文。 */
const RK4_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rk064_faiz_edge: { label: "ファイズエッジ", hint: "撃破する、敵軍バトルエリアの BP の下三桁が 500 の S ユニットを選んでください" },
  rk066_ore_no_hissatsu: { label: "俺の必殺技！", hint: "撃破する、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを選んでください" },
  rk067_hishouzan: { label: "飛翔斬", hint: "このターン、敵軍ユニットの BP を本来の値としてバトルしますか？" },
  rk068_veno_crash: { label: "ベノクラッシュ", hint: "捨札にする敵軍コマンドゾーンのユニットカードを選んでください（必要パワーの数字が敵軍ダメージ以下。使わないなら「スキップ」）" },
  rk070_avalanche_break: { label: "アバランチブレイク", hint: "持ち主のパワーゾーンに送る敵軍 S ユニットを、自軍 S ユニットと同じ数になるまで選んでください" },
  rk071_rider_kick: { label: "ライダーキック", hint: "持ち主のパワーゾーンに送る敵軍 S ユニットを選んでください" },
  rk074_kagizume_arm: { label: "カギ爪アーム", hint: "敵軍バトルエリアに出す、敵軍ラッシュエリアの S ユニットを選んでください（出さないなら「スキップ」）" },
  rk079_kamen_rider_title: { label: "仮面ライダーの称号", hint: "このカードを重ねる、ナンバーに数字を持つ自軍 S ユニットを選んでください" },
  rk080_stack_from_hand: { label: "重ねて置く", hint: "これに重ねる手札のユニットカードを選び、選び終えたら「決定」（置いた枚数をドロー。置かないなら「スキップ」）" },
  rk081_gegeru_stack: { label: "ゲゲル", hint: "自軍山札の上から1枚ひいて、ウラ向きのままゲゲルに重ねますか？" },
};

/** ライダーEXP vol.2 RK-085〜RK-105 のカード固有の選択（engine rules/rk/rk5UnitEffects.ts）の表示名と案内文。 */
const RK5_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rk085_guard_vent: { label: "ガードベント", hint: "撃破する、アタックされたユニットの必要パワーの数字以下の敵軍ユニットを選んでください" },
  rk087_zectmizer: { label: "ゼクトマイザー", hint: "敵軍ラッシュエリアの S ユニットをすべてバトルエリアに出しますか？（出さなくても並べ替えは行います）" },
  rk087_zectmizer_enter: { label: "ゼクトマイザー", hint: "次にバトルエリアに出す敵軍ユニットを選んでください" },
  rk087_zectmizer_order: { label: "ゼクトマイザー", hint: "敵軍バトルエリアの並び順で、次に並べるユニットを選んでください" },
  rk088_imagin_contract: { label: "イマジンとの契約", hint: "このカードを重ねる、特徴「イマジン」を持たない自軍 S ユニットを選んでください" },
  rk089_boarding_refusal_order: { label: "乗車拒否", hint: "山札の下に戻すカードを、戻す順に選んでください" },
  rk093_assassination: { label: "要人の暗殺", hint: "撃破する、「これはバトルエリアに出られない」等と書かれた敵軍ユニットを選んでください（しないなら「スキップ」）" },
  rk096_cut_melt: { label: "切断溶解", hint: "撃破する、レジストを持つ敵軍 S ユニットを選んでください" },
  rk097_ridol_stick: { label: "ライドルスティック", hint: "手札に戻す、ホールド状態の RC を持つユニットカードを選んでください（その RC の効果を発動します。しないなら「スキップ」）" },
  rk098_underwater: { label: "水中走行", hint: "自軍山札の下から1枚ひいて、自軍コマンドゾーンにホールド状態で置きますか？" },
  rk098_underwater_enemy: { label: "水中走行", hint: "自軍山札の下から1枚ひいて、自軍コマンドゾーンにホールド状態で置きますか？" },
  rk099_kaijin_watch: { label: "怪人の監視権限", hint: "捨札にする、自軍ラッシュエリアの特徴「怪人」を持つユニットを選んでください（このターン SP1 になります。しないなら「スキップ」）" },
  rk102_splash_dragon: { label: "スプラッシュドラゴン", hint: "持ち主の手札に戻す、敵軍常駐置き場のカード枚数以下の必要パワーの敵軍ユニットを選んでください（しないなら「スキップ」）" },
  rk105_halberd_spin: { label: "ハルバードスピン", hint: "持ち主の山札に戻す敵軍ユニットを、必要パワーの合計が3になるまで選び、選び終えたら「決定」" },
  rk095_hurricane_dash: { label: "ハリケーンダッシュ", hint: "ライドしているユニットをハリケーンごとラッシュエリアに戻しますか？" },
  rk103_stack_on_chouhenshin: { label: "クウガPF", hint: "このユニットを常駐の「超変身」に重ねて置きますか？" },
};

/** 好きな数を選ぶ選択の「選び終える」（engine SET9A_DONE と同じ値）。 */
export const SET9A_DONE_CHOICE = "__set9a_done__";

/** 相手の手札を見ないで選ぶ選択か（カードの中身を見せない）。 */
export function isBlindHandChoice(pending: NonNullable<GameState["pendingEffectChoice"]>): boolean {
  return pending.effectId === "rs594_gunpard_gun";
}

/** 第8弾 RS-560〜RS-581 のカード固有の選択（engine rules/legend1/set8NamedEffectsC.ts）の表示名と案内文。 */
const SET8C_CHOICE_UI: Record<string, { label: string; hint: string }> = {
  rs563_raising_horn: { label: "突き上げる角", hint: "ホールドする敵軍ユニットを1体選んでください（必要パワーの数字が敵軍ダメージ以下。見送ってもよい）" },
  rs565_rolling_thunder: { label: "ローリングサンダーハリケーン", hint: "敵軍ラッシュエリアの S ユニットをすべて手札に戻しますか？（戻すならこのユニットを選ぶ）" },
  rs565_rolling_thunder_return: { label: "ローリングサンダーハリケーン", hint: "自分の山札に戻す手札のカードを1枚選んでください" },
  rs567_vanish_rush: { label: "カラクリ忍法・消身の術", hint: "パワーゾーンのこのユニットカードを自軍ラッシュエリアに出しますか？（出すならカードを選ぶ）" },
  rs568_fusion_call_reveal: { label: "各々方、合体で御座る！", hint: "相手に見せる特徴「メカ」の L ユニットのカードを手札から選んでください" },
  rs568_fusion_call_put: { label: "各々方、合体で御座る！", hint: "ラッシュエリアに出す合体ユニットの M ユニットを1枚ずつ選び、組み合わせがそろったら確定してください" },
  rs569_gatling_punch: { label: "ガトリングパンチ", hint: "捨札にするオモテ向きの自軍パワーを1枚ずつ選び、確定してください（3枚につき SP+1）" },
  rs572_d_sword_vega: { label: "ディーソードベガ", hint: "撃破する自分のユニットを1体選ぶか、1点ダメージを受けるならデカマスターを選んでください" },
  rs573_bari_lancer_confirm: { label: "バリランサー", hint: "このユニットをホールドしますか？（ホールドするならこのユニットを選ぶ）" },
  rs574_saint_horn_finish: { label: "セイントホーンフィニッシュ", hint: "撃破する DA の敵軍ユニットを1体選んでください" },
  rs576_release_held_s: { label: "マジフェニックス", hint: "ホールド状態の自軍 S ユニットをすべてリリースしますか？（リリースするならこのユニットを選ぶ）" },
};

export function effectChoiceHint(
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): string {
  const set8c = SET8C_CHOICE_UI[pending.effectId];
  if (set8c) return set8c.hint;
  const set7d =
    SET7D_CHOICE_UI[pending.effectId] ??
    SET8D_CHOICE_UI[pending.effectId] ??
    SET9A_CHOICE_UI[pending.effectId] ??
    RK1_CHOICE_UI[pending.effectId] ??
    RK2_CHOICE_UI[pending.effectId] ??
    RK3_CHOICE_UI[pending.effectId] ??
    RK4_CHOICE_UI[pending.effectId] ??
    RK5_CHOICE_UI[pending.effectId];
  if (set7d) return set7d.hint;
  const label = EFFECT_LABELS[pending.effectId] ?? pending.effectId;
  switch (pending.kind) {
    case "end_turn_menu":
      return "ターン終了時に発動できるカードを選んでください";
    case "deck_top_or_bottom":
      return `見えたカードを山札の上か下に戻してください`;
    case "seabed_draw":
      return `山札の上から引くか、下から引くか選んでください`;
    case "optional_deck_draw":
      if (pending.effectId === "kuroko_memory") {
        return `1枚ドローしますか？（3枚まで・${pending.kurokoMeta?.drawn ?? 0}枚ドロー済み）`;
      }
      return `1枚ドローしますか？`;
    case "denji_machine": {
      if (pending.denjiMachineMeta?.step === "order_bottom") {
        const picked = pending.denjiMachineMeta.orderedBottomIds?.length ?? 0;
        const total = pending.denjiMachineMeta.toBottomInstanceIds.length;
        return `山札の下に戻す順に選んでください（${picked + 1}/${total}枚目・先に選んだほど下）`;
      }
      return `山札の上3枚を相手に見せています`;
    }
    case "scry_keep_one":
      if (pending.effectId === "sagas_sniper") {
        const cap = pending.maxPowerCost ?? 0;
        const eligible = pending.validInstanceIds.length;
        const total = pending.viewedInstanceIds?.length ?? 0;
        return `山札${total}枚を確認してください。必要パワー${cap}以下のユニットのみ手札に加えられます（${eligible}枚選択可）`;
      }
      return `残す1枚を選んでください`;
    case "select_commands": {
      const picked = pending.selectedInstanceIds?.length ?? 0;
      const total = pending.selectCount ?? 1;
      return `コマンドを${total}枚選んでください（${picked}/${total}）`;
    }
    case "select_power": {
      if (pending.effectId === "earth_force") {
        const picked = pending.selectedInstanceIds?.length ?? 0;
        return `維持コスト：パワーから3枚捨札（${picked}/3）`;
      }
      const picked = pending.selectedInstanceIds?.length ?? 0;
      const total = pending.selectCount ?? 1;
      return `パワーから${total}枚選んで捨札にしてください（${picked}/${total}）`;
    }
    case "shiron_light": {
      if (pending.shironLightMeta?.step === "pick") {
        return "相手の手札（裏向き）から1枚選んでください";
      }
      return "選ばれたカードを相手に公開してください";
    }
    case "select_hand": {
      if (pending.effectId === "super_brain_keep") {
        return "超電子頭脳：手札に加える1枚を選んでください（もう1枚は捨札）";
      }
      if (pending.effectId === "battle_entry_hand_discard") {
        const picked = pending.selectedInstanceIds?.length ?? 0;
        const total = pending.selectCount ?? 2;
        return `バトルエリアに出すには手札から${total}枚捨札してください（${picked}/${total}）`;
      }
      return `手札から選んでください`;
    }
    case "select_command":
      if (pending.effectId === "dolphin_arrow") {
        return "相手のホールド中コマンドを1枚選んで、相手のパワーゾーンに送ります";
      }
      if (pending.effectId === "green_ground") {
        return "敵軍コマンドゾーンから1枚選び、持ち主の手札に戻します";
      }
      if (pending.effectId === "dark_dual_blade") {
        return "相手のパワーまたはコマンドを1枚選んで捨札にします";
      }
      if (pending.effectId === "dark_dual_blade_command") {
        return "相手のコマンドを1枚選んで捨札にします";
      }
      if (pending.effectId === "chikara_tonfua_command_to_damage") {
        return "稲妻超力トンファ：自分のコマンドを1枚選んで、パワーゾーンにダメージとして置きます";
      }
      if (pending.effectId === "ptera_arrow") {
        return "相手のホールド中コマンドを1枚選んで捨札にします";
      }
      if (pending.effectId === "tricera_lance") {
        return "相手の未ホールドコマンドを1枚選んでホールドします";
      }
      if (pending.effectId === "kuroko_memory") {
        const left = pending.kurokoMeta?.returnsLeft ?? 0;
        return `コマンドを1つホールドすれば手札を山札に戻さずに済みます（スキップで相手が選んだ1枚を戻す・残り${left}回）`;
      }
      return `コマンドを選んでください`;
    case "pit_in_dive_order": {
      const picked = pending.selectedInstanceIds?.length ?? 0;
      const total = pending.selectCount ?? 1;
      return `バトルに出すSユニットを順番に選んでください（${picked + 1}/${total}）`;
    }
    case "select_unit_step":
      return pending.step === "enemy"
        ? `相手のユニットを選んでください`
        : `自分のユニットを選んでください`;
    case "confirm":
      if (pending.effectId === "rs385_special_extinguisher") {
        return "特殊消化弾：自軍コマンドゾーンにホールド状態で置くカードを、かわりにリリース状態で置きますか？";
      }
      if (pending.effectId === "reorder_enemy_battle") {
        return "敵軍バトルエリアのユニットを並び替えますか？（逆順にするか、新しい並びの1番目にするユニットを選ぶ）";
      }
      if (pending.effectId === "swan_wing_deploy_enemy_command_s") {
        return "スワンウィング：敵軍コマンドゾーンのSユニットをすべてラッシュエリアに出しますか？";
      }
      return "宣言するカード名を選んでください";
    case "select_units_bp_budget": {
      const budget = pending.bpBudget ?? 3000;
      const picked = pending.selectedInstanceIds?.length ?? 0;
      return `撃破するユニットを選んでください（表記BP合計 ${budget} 以下・${picked}枚選択中）`;
    }
    case "select_unit":
      if (pending.effectId === "pink_storm") {
        return "BP3000以下のユニットを1体選んでください（自分・相手のユニットが対象）";
      }
      if (pending.effectId === "karakuri_great_tsunami") {
        return "BP3000以下の相手ユニットを1体選んでください";
      }
      if (pending.effectId === "rescue_activity") {
        return "捨札のメカを1体選んで手札に戻してください";
      }
      if (pending.effectId === "jet_skateboard") {
        return "このユニットをラッシュエリアに戻しますか？対象を選んでください";
      }
      if (pending.effectId === "super_geki_yellow_reanimate") {
        return "捨札の「ゲキイエロー」を1体選んでラッシュエリアに出してください";
      }
      if (pending.effectId === "morph_replacement") {
        return "特徴が一致するユニットカードを選び、モーフで置き換えてください";
      }
      if (pending.effectId === "swan_wing_order") {
        // ルール: R-SIM-01 — 同時に出たユニットの処理順はターンプレイヤーが決める。
        return "スワンウィングで出たユニットを、「ラッシュされたとき」を処理する順に選んでください";
      }
      return "対象を選んでください";
    case "declare_number":
      if (pending.effectId === "attack_hold_bonus") {
        return "アタックするとき、ホールドする自軍コマンドの数を選んでください（1つにつきBP+1000・0でホールドしない）";
      }
      return "数字を宣言してください";
    case "simultaneous_order":
      // ルール: R-SIM-01, R-BTL-02 — 同時に起きた処理の順番はターンプレイヤーが決める。
      if (pending.mutualDestructionMeta) {
        return "相打ちで同時に撃破されました。先に処理するユニットを選んでください";
      }
      if (pending.battleDestroyOrderMeta) {
        return "撃破に関わる効果が同じタイミングで発動しました。先に処理する効果のユニットを選んでください";
      }
      return "同時に起きた処理です。先に解決するものを選んでください";
    default:
      return `対象を選んでください`;
  }
}

/** simultaneous_order の反応窓フレーム ID の表示名（ユニットでない選択肢）。 */
export const SIMULTANEOUS_FRAME_LABELS: Record<string, string> = {
  pendingLeave: "離場への対応",
  pendingStrike: "ストライクへの対応",
  pendingBattle: "アタックへの対応",
  pendingRush: "ラッシュへの対応",
};

/**
 * riderKickEffects ランタイム由来の effectId → 日本語効果名（UI 表示専用）。
 * EFFECT_LABELS には入れない（cards の effectIdFromName 逆引きを汚染し、
 * 同名の実カード効果名の解決を壊すため）。
 */
const RIDER_EFFECT_UI_LABELS: Record<string, string> = {
  simultaneous_order: "処理順の選択",
  attack_hold_bonus: "アタック時のホールド",
  swan_wing_order: "スワンウィング（処理順）",
  kuroko_memory: "黒子ロボの記憶操作",
  rider_slash_destroy: "ライダースラッシュ",
  rider_kick_send_power: "ライダーキック",
  rider_kick_discard_power_sp1: "ライダーキック",
  hold_ot_commands_then_sp: "ライダーキック",
  senko_sosa_declare: "潜行捜索",
  extend_rider_drop: "エクステンドライダー落とし",
  kamen_ride_deploy: "カメンライド",
  power_faceup_sp1_grant: "最初からクライマックスだぜ",
};

export function effectChoiceTitle(
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): string {
  const label =
    SET8C_CHOICE_UI[pending.effectId]?.label ??
    SET7D_CHOICE_UI[pending.effectId]?.label ??
    SET8D_CHOICE_UI[pending.effectId]?.label ??
    SET9A_CHOICE_UI[pending.effectId]?.label ??
    RK1_CHOICE_UI[pending.effectId]?.label ??
    RK2_CHOICE_UI[pending.effectId]?.label ??
    RK3_CHOICE_UI[pending.effectId]?.label ??
    RK4_CHOICE_UI[pending.effectId]?.label ??
    RK5_CHOICE_UI[pending.effectId]?.label ??
    RIDER_EFFECT_UI_LABELS[pending.effectId] ??
    EFFECT_LABELS[pending.effectId] ??
    pending.effectId;
  return `【${label}】`;
}

/**
 * RS-019 超力／RK-186【Jパンチ】のホールド数ボタンの表示（「2（BP3000 vs 2500）」）。
 * アタック側 BP はその数をホールドしたときのこのバトルでの値。
 */
/** RS-397【予期せぬ出現】の選択肢（「逆順に並び替える」か、新しい並びの1番目にするユニット）の表示名。 */
export function reorderOptionLabel(state: GameState, value: string): string {
  for (const pid of ["player1", "player2"] as const) {
    const card = state.players[pid].battle.find((c) => c.instanceId === value);
    if (card) return `${state.definitions[card.cardId]?.name ?? card.cardId}を1番目に`;
  }
  return value;
}

/**
 * 確認（kind "confirm"）の選択肢の表示名。発動元（効果 id・発動元のユニット）は「効果を使う」、場のカードはカード名。
 * RS-528【バイオ粒子反応アリ！】の相手の選択（engine rules/legend1/set8NamedEffectsA.ts）は「撃破する／1点ダメージを受ける」。
 */
export function confirmOptionLabel(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  value: string,
): string {
  if (pending.effectId === "reorder_enemy_battle") return reorderOptionLabel(state, value);
  if (pending.effectId === "tag_bold_pick") {
    // ※タッグ: どの常駐の太字部分を実行するか（value は自軍常駐置き場のカード）。
    const op = state.players[pending.playerId].operation.find((c) => c.instanceId === value);
    if (op) return `「${state.definitions[op.cardId]?.name ?? op.cardId}」の太字部分を実行する`;
  }
  if (value === pending.effectId || value === pending.sourceInstanceId) return "効果を使う";
  if (value === "rs528_take_damage") return "1点ダメージを受ける";
  if (value === "command") return "コマンドゾーンに送る";
  // RK-002 V3ホッパー（engine rules/rk/rk1NamedEffects.ts）。
  if (value === "deck_top") return "山札の上に戻す";
  if (value === "deck_bottom") return "山札の下に戻す";
  // RK-031 バッテリー交換（engine rules/rk/rk2UnitEffects.ts）。
  if (value === "use" && pending.effectId === "rk031_battery") return "コマンドゾーンに置く";
  if (value === "discard") return "捨札にする";
  for (const pid of ["player1", "player2"] as const) {
    const card = [...state.players[pid].battle, ...state.players[pid].rush].find((c) => c.instanceId === value);
    if (!card) continue;
    const name = state.definitions[card.cardId]?.name ?? card.cardId;
    return pending.effectId === "rs528_bio_particle_answer" ? `「${name}」を撃破する` : name;
  }
  return value;
}

export function attackHoldOptionLabel(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  value: string,
): string {
  const preview = previewAttackHoldBp(state, pending.playerId, value);
  if (!preview) return value;
  return `${value}（BP${preview.attackerBp} vs ${preview.defenderBp}）`;
}
