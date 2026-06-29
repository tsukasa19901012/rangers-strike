/**
 * 公式効果文分類（wikiwiki.jp/renst）。
 *
 * - 効果名: カード上の白抜き/反転テキストのみ。Wiki では【名前】表記。
 * - 効果名を持つテキスト / 効果名を持つ効果: 効果名の下の本文。NC（CN）や
 *   本文に書かれた条件を満たしたとき発動。
 * - 効果名を持たないテキスト: ※ 行や共通ルール（例: レジスト）で効果名なし。
 */

/** エンジンでの効果名付き効果の発動タイミング。 */
export type NamedEffectTrigger =
  /** NC/CN: バトル位置と comboNumber が一致（RS-015 補正後）。 */
  | { type: "nc" }
  /** NC/CN または既にバトルにいる combo-from パートナーユニット（エラッタ/文面上書き）。 */
  | { type: "nc_or_combo_from"; partnerCardIds: string[] }
  /** バトルゾーンに出たとき（NC 条件なし）。 */
  | { type: "enter_battle" }
  /** このユニットがラッシュされたとき。 */
  | { type: "on_rush" }
  /** このユニットがアタックしたとき（カード文面でコンボパートナー上書き可）。 */
  | { type: "on_attack"; comboPartnerCardIds?: string[] }
  /** ジョイントコンボ L: 同カテゴリの右隣 L パートナーに効果を付与。 */
  | { type: "joint_combo_l" }
  /** ジョイントコンボ R: 同カテゴリ L の右隣に出たとき、このユニットが効果を得る。 */
  | { type: "joint_combo_r" }
  /** ライディングコンボ RC: ビークルから降りてバトル投入したとき発動。 */
  | { type: "riding_combo" }
  /** 場にいる間継続（メタデータ。エンジンは別途実装可）。 */
  | { type: "while_in_field" }
  /** 自分がターンを終えるとき（バトルエリア等）。 */
  | { type: "on_turn_end" }
  /** 自軍ユニットがストライクしたとき（相手ターン中の誘発等）。 */
  | { type: "on_strike" }
  /** その他条件付き文面。未実装。 */
  | { type: "conditional" }
  /** オペレーションカードの発動タイミング。 */
  | { type: "operation"; timing: "rush" | "battle" | "counter" | "resident" };

/** Rush 追加条件 ID（+ = ゾードアップ、zord_down_* = ゾードダウン）。 */
export type ZordConditionId =
  | "discard_fusion_unit"
  | "send_s_unit_to_power"
  | "send_s_unit_to_discard"
  | "send_s_unit_to_command_or_discard"
  | "discard_named_unit"
  | "discard_feature_unit"
  | "discard_vehicle_unit"
  | "discard_fusion_vehicle"
  | "discard_operation_cards"
  | "discard_name_contains_unit"
  | "discard_category_l_unit"
  | "return_named_to_hand"
  | "hold_extra_command"
  | "send_s_units_to_zones"
  | "state_gate"
  | "discard_command_card"
  | "discard_all_hand"
  | "discard_hand_card"
  | "discard_generic_unit"
  | "discard_all_face_up_power"
  | "opponent_draw"
  | "zord_down_discard_fusion"
  | "zord_down_discard_named"
  | "zord_down_discard_feature"
  | "zord_down_send_to_power"
  | "zord_down_send_to_command_or_discard"
  | "zord_down_discard_power_cards";

/** Rush 追加条件（atwiki 追加条件：…）。 */
export type RushAdditionalCondition = {
  conditionId: ZordConditionId;
  /** 公式文言（例: 自軍Sユニットを1体パワーゾーンに送る）。 */
  text: string;
  /** S ユニット送付条件の体数（既定 1）。 */
  unitCount?: number;
  /** ゾードダウン: カード名に含まれる指定名（例: アバレッド）。 */
  partnerName?: string;
  /** ゾードダウン: 捨てるユニットが持つ特徴。 */
  requiredFeature?: string;
  /** ゾードダウン: 捨てるパワーの最低必要パワー数字。 */
  minPrintedPowerCost?: number;
  /** カード名部分一致（discard_name_contains_unit 等）。 */
  nameContains?: string;
  /** L ユニット追加条件のカテゴリ名（日本語またはコード）。 */
  requiredCategory?: string;
  /** 捨て札にするユニットのサイズ制限（例: S）。 */
  requiredSize?: "S" | "M" | "L";
};

/** 効果名を持つ効果 — 実装時は engine effectId に対応。 */
export type NamedUnitEffect = {
  /** 【】内の表示名（括弧は含まない）。 */
  name: string;
  /** エンジンハンドラ id（comboEffects / バトルルール）。 */
  effectId: string;
  /** 効果名の下の本文。 */
  text: string;
  trigger: NamedEffectTrigger;
};

/**
 * 効果名を持たないテキスト（※ 行）の機械可読 id。
 * エンジンとデッキルールは `text` の部分一致ではなくこれを使うこと。
 */
export type UnnamedUnitRule =
  | "battle_entry_hold"
  | "auto_battle_entry_each_turn"
  | "auto_battle_entry_on_rush"
  | "destroy_self_damage"
  | "deck_copy_unlimited"
  | "needs_ally_s_in_battle"
  | "win_but_destroyed_vs_sp1"
  /** 敵ターン中 SP1 以上相手へ勝利しても自身は破壊（pipeline 生成カード）。 */
  | "destroy_on_win_vs_sp1"
  | "return_to_hand_at_6_damage"
  | "no_battle_entry_turn_rushed"
  | "no_attack_turn_rushed"
  | "no_strike_turn_rushed"
  | "cannot_enter_battle"
  /** ゾード合体素材を別カード名として扱える（表示 / デッキ構築）。 */
  | "fusion_material_alias"
  /** 投入時任意。エンジンは後日実装可。 */
  | "opponent_may_draw_on_enter"
  /** ラッシュ: ダメージ以外のパワーカードを捨札へ（RS-128 / RS-129）。 */
  | "rush_power_to_discard"
  /** 自分のターン中はバトル投入不可（RS-170）。 */
  | "cannot_enter_battle_own_turn"
  /** 自軍ターン中バトルエリアに出られない（pipeline 生成カード）。 */
  | "no_enter_battle_own_turn"
  /** バトル投入: 先に自軍ラッシュから S ユニットを捨札（RS-132）。 */
  | "battle_entry_discard_s_from_rush"
  /** 敵ラッシュゾーンの S ユニットをアタック可能（RS-154）。 */
  | "can_attack_enemy_rush_s"
  /** 敵バトルゾーンの S ユニットはアタック不可（RS-154）。 */
  | "cannot_attack_enemy_battle_s"
  /** 特徴「航空機」を持つユニットのみがアタック可能（RS-135）。 */
  | "requires_aircraft_attacker"
  /** バトル投入: partnerCardIds の cardId を持つ味方が既にバトルにいる必要（RS-147）。 */
  | "battle_entry_combo_from"
  /** 自軍ターン中のみ、partnerCardIds からコンビネーション必須（RS-146）。 */
  | "battle_entry_combo_from_own_turn"
  /** バトル投入: 先に手札から捨札（RS-165）。 */
  | "battle_entry_discard_from_hand"
  /** バトル中、このユニットは MA カテゴリも持つ（RS-166）。 */
  | "battle_adds_ma_category";

/** 効果名を持たないテキスト — 静的ルール、※ 制限、ゾード素材行。 */
export type UnnamedUnitText = {
  kind: "note" | "zord" | "fusion";
  text: string;
  /** 実装済みまたはカタログ済みのエンジンルール id。 */
  rule?: UnnamedUnitRule;
  /** `battle_entry_hold`: 必要コマンド数（既定 1）。 */
  holdCount?: number;
  /** `destroy_self_damage`: 捨札破壊時にコントローラーが受けるダメージ。 */
  damage?: number;
  /** `rush_power_to_discard` / `battle_entry_discard_from_hand` 用。 */
  discardCount?: number;
  /** `battle_entry_combo_from` またはゾードアップ合体パートナー（合体― 行）用。 */
  partnerCardIds?: string[];
  /** ゾード合体の各枠ごとに使える cardId。 */
  partnerSlotCardIds?: string[][];
};

export type UnitEffectBlock = {
  /** Rush ゾードアップ要件（Wiki 追加条件フィールド。テキストとは別）。 */
  rushAdditionalCondition?: RushAdditionalCondition;
  unnamedText: UnnamedUnitText[];
  namedEffects: NamedUnitEffect[];
  /** カード効果文（【】能力 / ※ 注記）。追加条件は含まない。 */
  rawText: string;
};
