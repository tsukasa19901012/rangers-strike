const ERROR_LABELS: Record<string, string> = {
  illegal_action: "その操作は今はできません",
  wrong_phase: "このフェイズでは実行できません",
  game_already_over: "ゲームは終了しています",
  already_charged: "このターンはすでにチャージ済みです",
  already_drawn: "すでにドロー済みです",
  must_draw_first: "先にドローしてください",
  earth_force_upkeep_required: "アースの力の維持コストを支払ってください",
  insufficient_power: "パワーが足りません",
  insufficient_sp: "SPが足りないためストライクできません",
  already_acted: "このユニットはすでに行動済みです",
  command_not_held: "必要なコマンドがホールドされていません",
  target_required: "対象を選んでください",
  invalid_target: "無効な対象です",
  deck_out: "山札がなくドローできません",
  pending_strike: "ストライクへの応答中です",
  pending_battle: "アタックへの応答中です",
  no_pending_battle: "応答待ちのアタックがありません",
  no_pending_rush: "応答待ちのラッシュがありません",
  no_pending_leave: "応答待ちの離場がありません",
  no_pending_scry: "遺跡調査の選択待ちがありません",
  invalid_scry: "遺跡調査の対象カードが見つかりません",
  no_pending_reaction: "応答待ちの効果がありません",
  wrong_player: "あなたの応答ではありません",
  invalid_counter: "カウンターを使用できません",
  cannot_enter_battle: "バトルエリアに出せません",
  must_enter_battle: "「可能ならバトルエリアに出る」ユニットをバトルエリアに出してください",
  pending_battle_entry: "バトルエリアに出したユニットのアクションを選んでください",
  card_not_in_rush: "カードが見つかりません",
};

export function formatActionError(error: string): string {
  return ERROR_LABELS[error] ?? error;
}
