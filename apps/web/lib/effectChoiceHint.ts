import type { CardDefinition } from "@rangers-strike/cards";
import { EFFECT_LABELS } from "@rangers-strike/cards";
import type { GameState } from "@rangers-strike/engine";

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

export function effectChoiceHint(
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): string {
  const label = EFFECT_LABELS[pending.effectId] ?? pending.effectId;
  switch (pending.kind) {
    case "end_turn_menu":
      return "ターン終了時に発動できるカードを選んでください";
    case "deck_top_or_bottom":
      return `見えたカードを山札の上か下に戻してください`;
    case "seabed_draw":
      return `山札の上から引くか、下から引くか選んでください`;
    case "optional_deck_draw":
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
    case "select_hand": {
      if (pending.effectId === "battle_entry_hand_discard") {
        const picked = pending.selectedInstanceIds?.length ?? 0;
        const total = pending.selectCount ?? 2;
        return `バトルエリアに出すには手札から${total}枚捨札してください（${picked}/${total}）`;
      }
      return `手札から選んでください`;
    }
    case "select_command":
      return `コマンドを選んでください`;
    case "pit_in_dive_order": {
      const picked = pending.selectedInstanceIds?.length ?? 0;
      const total = pending.selectCount ?? 1;
      return `順番にSユニットを選んでください（${picked + 1}/${total}）`;
    }
    case "select_unit_step":
      return pending.step === "enemy"
        ? `相手のユニットを選んでください`
        : `自分のユニットを選んでください`;
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
      return "対象を選んでください";
    default:
      return `対象を選んでください`;
  }
}

export function effectChoiceTitle(
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): string {
  const label = EFFECT_LABELS[pending.effectId] ?? pending.effectId;
  return `【${label}】`;
}
