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

export function effectChoiceHint(
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): string {
  const set7d = SET7D_CHOICE_UI[pending.effectId];
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
    SET7D_CHOICE_UI[pending.effectId]?.label ??
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
  if (value === pending.effectId || value === pending.sourceInstanceId) return "効果を使う";
  if (value === "rs528_take_damage") return "1点ダメージを受ける";
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
