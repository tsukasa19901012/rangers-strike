import { EFFECT_LABELS } from "../effectLabels";

/** 日本語効果名 → 安定 effect ID（slugifyEffectId / スタブ修復用）。 */
const EFFECT_NAME_TO_ID: Record<string, string> = {};

for (const [id, label] of Object.entries(EFFECT_LABELS)) {
  if (!EFFECT_NAME_TO_ID[label]) {
    EFFECT_NAME_TO_ID[label] = id;
  }
}

/** effectLabels / 手動カタログに無い効果名。 */
const ADDITIONAL_EFFECT_NAME_TO_ID: Record<string, string> = {
  ディスコダンス: "disco_dance",
  忍法花爆弾: "flower_bomb",
  灼熱の獅子: "scorching_lion",
  ジェットボード: "jet_board",
  未来予知: "future_sight",
  ティラノロッド: "grant_sp1",
  クルマジックパワー: "place_in_power",
  灼熱の咆哮: "scorching_roar",
  レッドビュート: "red_beet",
  バイオ粒子斬り: "bio_particle_slash",
  ステルス: "stealth",
  ファイヤーソード: "fire_sword",
  反バイオ粒子砲: "anti_bio_cannon",
  ブルバドス活人剣: "blue_bados_life_sword",
  スーパーライブクラッシュ: "super_live_crush",
  強襲: "assault",
  潜航: "submerge",
  データ解析: "data_analysis",
  紐拳: "string_fist",
  クラウンファイナルクラッシュ: "crown_final_crush",
  タウラスダイブ: "taurus_dive",
  超文明の守護: "hyper_civilization_guard",
  スターライザー: "star_raiser",
  サイドナックル: "side_knuckle",
  バンパーボウ: "bumper_bow",
  怒涛裂断シャークショット: "furious_shark_shot",
  天地轟鳴アニマルハート: "heaven_earth_animal_heart",
  フェザーボム: "feather_bomb",
  鋼の角: "steel_horn",
  鋭い爪: "sharp_claw",
  悪鬼貫徹ネックスラスト: "oni_neck_last",
  エレファントシールド: "elephant_shield",
  ブレイジングファイヤー: "blazing_fire",
  ノーブルスラッシュ: "noble_slash",
  アイアンブロークン: "iron_broken",
  白虎十文字斬り: "white_tiger_cross_slash",
  爆竜必殺バキバキパンチ: "baki_baki_punch",
  爆竜必殺クロスサンダー: "cross_thunder",
  地球資源吸収: "earth_resource_absorb",
  マキシマムペネトレーション: "maximum_penetration",
  ショベルディフェンス: "shovel_defense",
  ウォールシュート: "wall_shoot",
  リフトアップ: "lift_up",
  大突撃: "great_assault",
  空輸: "airlift",
  サガスナイパー: "sagas_sniper",
  森羅万象ビッグバンファイナル: "nature_big_bang_final",
  音撃打・灼熱真紅の型: "sound_strike_scorching_form",
};

function normalizeEffectName(name: string): string {
  return name.split("（")[0]?.trim() ?? name;
}

/** 日本語効果名から既知の semantic effect ID を返す。 */
export function effectIdFromName(name: string): string | undefined {
  const key = normalizeEffectName(name);
  return ADDITIONAL_EFFECT_NAME_TO_ID[key] ?? EFFECT_NAME_TO_ID[key];
}

/** slugifyEffectId 用の KNOWN マップ（読み取り専用）。 */
export function knownEffectNameIds(): Readonly<Record<string, string>> {
  return { ...EFFECT_NAME_TO_ID, ...ADDITIONAL_EFFECT_NAME_TO_ID };
}
