import { EFFECT_LABELS } from "@rangers-strike/cards";
import type { GameState } from "@rangers-strike/engine";

export function effectChoiceHint(
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): string {
  const label = EFFECT_LABELS[pending.effectId] ?? pending.effectId;
  switch (pending.kind) {
    case "deck_top_or_bottom":
      return `見えたカードを山札の上か下に戻してください`;
    case "seabed_draw":
      return `山札の上から引くか、下から引くか選んでください`;
    case "optional_deck_draw":
      return `1枚ドローしますか？`;
    case "scry_keep_one":
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
    case "select_hand":
      return `手札から選んでください`;
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
