/** コスト支払いウィンドウの種別（hold-ready 6 フラグを統合）。 */
export type CostWindowKind =
  | "battle_entry_hold"
  | "rush_category"
  | "counter_category"
  | "battle_entry_rush_discard"
  | "battle_entry_hand_discard";

export type CostWindowMetadata = {
  /** RS-132: 捨札した S ユニット cardId（反バイオ粒子砲判定用）。 */
  discardedCardId?: string;
};

export type CostWindow = {
  kind: CostWindowKind;
  satisfied: boolean;
  metadata?: CostWindowMetadata;
};

export type PlayerCostWindows = Partial<Record<CostWindowKind, CostWindow>>;
