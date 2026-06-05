import type { CardDefinition } from "@rangers-strike/cards";
import { getEffectLabel } from "@rangers-strike/cards";
import type { PlayerId } from "../types/game";
import {
  formatResolveEffectChoiceNotice,
  isNoteworthyResolveEffectChoice,
} from "./effectChoiceNotice";

export {
  formatResolveEffectChoiceNotice,
  isNoteworthyResolveEffectChoice,
  quoteChoiceTargets,
  shouldSuppressChoiceNoticeEffect,
  SUPPRESSED_CHOICE_NOTICE_EFFECT_IDS,
} from "./effectChoiceNotice";

/** Build a structured log entry: player|action|cardId|cardName|detail */
export function buildLogEntry(
  playerId: PlayerId,
  action: string,
  cardId: string,
  definitions: Record<string, CardDefinition>,
  detail?: string,
): string {
  const name = definitions[cardId]?.name ?? cardId;
  return detail
    ? `${playerId}|${action}|${cardId}|${name}|${detail}`
    : `${playerId}|${action}|${cardId}|${name}`;
}

export function buildSimpleLogEntry(
  playerId: PlayerId,
  action: string,
  detail?: string,
): string {
  return detail ? `${playerId}|${action}|${detail}` : `${playerId}|${action}`;
}

const PLAYER_LABELS: Record<PlayerId, string> = {
  player1: "あなた",
  player2: "CPU",
};

const PHASE_LABELS: Record<string, string> = {
  start: "スタート",
  charge: "チャージ",
  rush: "ラッシュ",
  battle: "バトル",
  end: "エンド",
};

export function formatGameLog(
  entry: string,
  definitions: Record<string, CardDefinition>,
): string {
  if (entry.startsWith("game_created")) return "ゲーム開始";

  const parts = entry.split("|");
  const playerId = parts[0] as PlayerId;
  const player = PLAYER_LABELS[playerId] ?? playerId;

  if (parts[1] === "draw") {
    return `${player}が1枚ドローした`;
  }

  if (parts[1] === "bonus_draw") {
    return `${player}が追加ドローした（手札＜ダメージ）`;
  }

  if (parts[1] === "release_start_commands") {
    return `${player}がホールド中のコマンドをリリースした`;
  }

  if (parts[1] === "return_all_battle_to_rush") {
    return `${player}がバトルエリアのユニットをすべてラッシュに戻した`;
  }

  if (parts[1] === "end_phase") {
    const phase = PHASE_LABELS[parts[2] ?? ""] ?? parts[2];
    return `${player}が${phase}フェイズを終了`;
  }

  if (parts[1] === "end_turn") {
    return `${player}のターン終了`;
  }

  if (parts[1] === "deck_out") {
    return `${player}は山札がなくドローできず敗北`;
  }

  if (parts[1] === "strike_pending") {
    return `${player}がストライク！（${parts[2] ?? "1"}ダメージ）→ 相手の応答待ち`;
  }

  if (parts.length >= 4) {
    const action = parts[1]!;
    const cardName = parts[3]!;
    const detail = parts[4];

    switch (action) {
      case "charge_power":
        return `${player}が「${cardName}」をパワーにチャージ`;
      case "charge_command":
        return `${player}が「${cardName}」をコマンドゾーンにチャージ`;
      case "hold_command":
        return `${player}が「${cardName}」のコマンドをホールド`;
      case "release_command":
        return `${player}が「${cardName}」のコマンドをリリース`;
      case "rush":
        return `${player}が「${cardName}」をラッシュ`;
      case "move_to_battle":
        return `${player}が「${cardName}」をバトルエリアへ移動`;
      case "joint_combo_l": {
        const partnerName = detail ?? "Lユニット";
        return `${player}の「${cardName}」がジョイントLコンボを発動 → 「${partnerName}」にSP+1`;
      }
      case "joint_combo_r":
        return `${player}の「${cardName}」がジョイントRコンボを発動（SP+1）`;
      case "riding_combo":
        return `${player}の「${cardName}」がライディングコンボを発動（SP+1）`;
      case "number_combo":
        if (detail?.startsWith("ruin_survey:")) {
          const seen = detail.replace("ruin_survey:", "");
          return `${player}の「${cardName}」が遺跡調査を発動 → 山札上「${seen}」を確認`;
        }
        if (detail === "eagle_diving") {
          return `${player}の「${cardName}」がイーグルダイビングを発動（SP+1、BP+2000）`;
        }
        if (detail === "moss_breaker") {
          return `${player}の「${cardName}」がモスブレイカーを発動`;
        }
        if (detail === "sp1") {
          return `${player}の「${cardName}」がNCを発動（SP+1）`;
        }
        if (detail?.startsWith("future_sight:")) {
          const drawn = detail.slice("future_sight:".length);
          return `${player}の「${cardName}」が未来予知を発動 → 「${drawn}」をドロー`;
        }
        if (detail === "future_sight") {
          return `${player}の「${cardName}」が未来予知を発動（1枚ドロー）`;
        }
        if (detail) {
          return `${player}の「${cardName}」が${getEffectLabel(detail)}を発動`;
        }
        return `${player}の「${cardName}」がNCを発動`;
      case "resolve_ruin_survey": {
        if (detail?.startsWith("bottom:")) {
          const seen = detail.replace("bottom:", "");
          return `${player}が遺跡調査 → 「${seen}」を山札の下へ`;
        }
        if (detail?.startsWith("top:")) {
          const seen = detail.replace("top:", "");
          return `${player}が遺跡調査 → 「${seen}」を山札の上に戻した`;
        }
        return `${player}が遺跡調査を完了`;
      }
      case "enter_battle": {
        if (detail?.startsWith("destroy:")) {
          const target = detail.replace("destroy:", "");
          return `${player}の「${cardName}」登場効果で「${target}」を撃破`;
        }
        if (detail === "destroy_choice") {
          return `${player}の「${cardName}」の登場効果の対象選択`;
        }
        if (detail === "sky_magic_slash") {
          return `${player}の「${cardName}」が天空魔法斬りを発動（敵コマンドをホールド）`;
        }
        return `${player}の「${cardName}」の登場効果`;
      }
      case "named_effect": {
        if (detail === "super_shield") {
          return `${player}の「${cardName}」が超シールド進化を発動（かわりに捨札）`;
        }
        if (detail === "focused_breakthrough") {
          return `${player}の「${cardName}」が一点突破を発動（相手に1ダメージ）`;
        }
        if (detail?.startsWith("choice:")) {
          const effectId = detail.replace("choice:", "");
          return `${player}の「${cardName}」が${getEffectLabel(effectId)}の対象選択`;
        }
        if (detail) {
          return `${player}の「${cardName}」が${getEffectLabel(detail)}を発動`;
        }
        return `${player}の「${cardName}」の効果`;
      }
      case "resolve_effect_choice": {
        if (detail && isNoteworthyResolveEffectChoice(detail)) {
          return formatResolveEffectChoiceNotice(player, cardName, detail);
        }
        return `${player}の「${cardName}」の効果を解決`;
      }
      case "rush_effect": {
        if (detail === "draw_1") {
          return `${player}の「${cardName}」がラッシュ時ドロー`;
        }
        return `${player}の「${cardName}」のラッシュ効果`;
      }
      case "play_operation": {
        if (detail?.startsWith("bp+")) {
          const target = detail.split(":")[1] ?? "";
          return `${player}が「${cardName}」を使用 → ${target}のBP+4000（このターン）`;
        }
        if (detail?.startsWith("recover")) {
          const target = detail.includes(":") ? detail.split(":")[1] : "カード";
          return `${player}が「${cardName}」を使用 → 「${target}」を手札に回収`;
        }
        if (detail?.startsWith("recover_s:")) {
          const target = detail.split(":")[1] ?? "Sユニット";
          return `${player}が「${cardName}」を使用 → 「${target}」を手札に回収`;
        }
        if (detail?.startsWith("aura_power:")) {
          const target = detail.split(":")[1] ?? "Sユニット";
          return `${player}が「${cardName}」を使用 → 「${target}」にオーラパワー（自軍ダメージ1点につきBP+2000）`;
        }
        if (detail === "place_in_power") {
          return `${player}が「${cardName}」を使用 → パワーゾーンに配置`;
        }
        if (detail?.startsWith("judgment:hit:")) {
          const [, , target, revealed] = detail.split(":");
          return `${player}が「${cardName}」（${getEffectLabel("judgment")}）を使用 → 山札「${revealed}」で「${target}」を撃破`;
        }
        if (detail?.startsWith("judgment:miss:")) {
          const [, , target, revealed] = detail.split(":");
          return `${player}が「${cardName}」（${getEffectLabel("judgment")}）を使用 → 山札「${revealed}」は不一致（ターゲット「${target}」）`;
        }
        if (detail === "draw:1") {
          return `${player}が「${cardName}」を使用 → 1枚ドロー`;
        }
        if (detail === "damage:1") {
          return `${player}が「${cardName}」を使用 → 相手に1ダメージ`;
        }
        if (detail === "damage:2") {
          return `${player}が「${cardName}」を使用 → 相手に2ダメージ`;
        }
        if (detail === "placed") {
          return `${player}が常駐オペ「${cardName}」を配置`;
        }
        if (detail === "denji:reveal") {
          return `${player}が「${cardName}」（${getEffectLabel("denji_machine")}）を使用 → 山札上3枚を公開`;
        }
        if (detail?.startsWith("denji:")) {
          return `${player}が「${cardName}」（${getEffectLabel("denji_machine")}）を使用`;
        }
        if (detail?.startsWith("land_balkan:")) {
          return `${player}が「${cardName}」（${getEffectLabel("land_balkan")}）を使用`;
        }
        if (detail?.startsWith("cyber:")) {
          return `${player}が「${cardName}」（${getEffectLabel("cyber_s_rider")}）を使用`;
        }
        if (detail?.startsWith("freeze")) {
          return `${player}が「${cardName}」（${getEffectLabel("compression_freeze")}）を使用`;
        }
        if (detail?.startsWith("dynamite")) {
          const target = detail.split(":")[1] ?? "ユニット";
          if (detail.startsWith("dynamite_discard:")) {
            return `${player}が「${cardName}」（${getEffectLabel("dynamite_power")}）を使用 → 「${target}」を捨札`;
          }
          return `${player}が「${cardName}」（${getEffectLabel("dynamite_power")}）を使用 → 「${target}」をコマンドにホールド`;
        }
        return `${player}が「${cardName}」を使用`;
      }
      case "strike": {
        const damage = detail ?? "1";
        return `${player}が「${cardName}」でストライク！（${damage}ダメージ）`;
      }
      case "battle": {
        const defenderName = detail?.split(":")[0] ?? "相手ユニット";
        const bpInfo = detail?.split(":")[1] ?? "";
        return `${player}の「${cardName}」が「${defenderName}」とバトル（${bpInfo}）`;
      }
      case "plasma_energy": {
        return `${player}の「${cardName}」効果でストライクユニット「${detail ?? ""}」を撃破`;
      }
      case "five_tech": {
        if (detail?.includes("vs")) {
          return `${player}がファイブテクターで「${detail.split(":")[0]}」を迎撃（${detail.split(":")[1] ?? ""}）`;
        }
        return `${player}がファイブテクターで迎撃`;
      }
      case "courage_magic": {
        return `${player}の勇気の魔法でコマンドを1つリリース`;
      }
      case "earth_force_upkeep": {
        if (detail === "failed") {
          return `${player}はアースの力の維持コストを払えず「${cardName}」を捨札にした`;
        }
        if (detail === "declined") {
          return `${player}は維持コストを払わず「${cardName}」を捨札にした`;
        }
        return `${player}が「${cardName}」の維持コストを支払った`;
      }
      case "play_counter": {
        if (detail?.startsWith("dino_guts:")) {
          const count = detail.split(":")[1] ?? "0";
          return `${player}が「${cardName}」（${getEffectLabel("dino_guts")}）を使用 → ユニットが場に留まる（山札${count}枚を捨札）`;
        }
        return `${player}がカウンター「${cardName}」を使用`;
      }
      default:
        return `${player}: ${cardName} (${action})`;
    }
  }

  return entry;
}
