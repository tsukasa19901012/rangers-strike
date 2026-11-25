import type { CardDefinition } from "@rangers-strike/cards";
import { getEffectLabel } from "@rangers-strike/cards";
import type { PlayerId } from "../types/game";
import {
  formatResolveEffectChoiceNotice,
  isNoteworthyResolveEffectChoice,
  readableEffectLabel,
} from "./effectChoiceNotice";

export {
  formatResolveEffectChoiceNotice,
  isNoteworthyResolveEffectChoice,
  quoteChoiceTargets,
  shouldSuppressChoiceNoticeEffect,
  SUPPRESSED_CHOICE_NOTICE_EFFECT_IDS,
} from "./effectChoiceNotice";

/** 構造化ログエントリを生成: player|action|cardId|cardName|detail */
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

/** Actions with no sentence of their own: what the card did, after 「（プレイヤー）の「カード」」. */
const ACTION_SUFFIX: Record<string, string> = {
  activate_field_unit_ability: "の能力を使用",
  activate_resident_operation: "（常駐オペ）を使用",
  battle_dance: "のバトルダンス",
  denji_machine: "（デンジマシーン）の効果",
  destroy_effect: "の撃破されたときの効果",
  morph_swap: "がモーフで入れ替わった",
  operation_effect: "の効果",
  reveal: "の効果で山札を公開",
  rule_destroy: "がルールで撃破された",
  s_combo_finisher: "のSコンボ",
  shiron_light: "の効果",
  skip_effect_choice: "の効果を使わなかった",
  strike_effect: "のストライク時の効果",
};

/** An effect id the player can read (its label), or null when only the internal id is known (it never shows). */
function effectName(id: string | undefined): string | null {
  if (!id) return null;
  return readableEffectLabel(id.replace(/^choice:/, "").split(":")[0]!);
}

/** Internal markers and ids (snake_case, "rk_passive:...") are not something to show the player. */
const isInternal = (text: string | undefined) => !!text && /^[a-z0-9_:.\-]+$/.test(text) && /[a-z]/.test(text);

/** A card name from a log part: the name itself, or a card / instance id (RS-454-60) looked up in the definitions. */
function nameOfPart(part: string, definitions: Record<string, CardDefinition>): string {
  if (definitions[part]) return definitions[part]!.name;
  const card = /^([A-Z]+\d*-\d+[A-Za-z]?)-\d+$/.exec(part)?.[1];
  return (card && definitions[card]?.name) || part;
}

/**
 * `labels`: what each player is called (default 「あなた」「CPU」). 対人戦では「あなた」「相手」。
 */
export function formatGameLog(
  entry: string,
  definitions: Record<string, CardDefinition>,
  labels: Readonly<Record<PlayerId, string>> = PLAYER_LABELS,
): string {
  if (entry.startsWith("game_created")) return "ゲーム開始";

  const parts = entry.split("|");
  const playerId = parts[0] as PlayerId;
  const player = labels[playerId] ?? playerId;

  if (parts[1] === "draw") {
    return `${player}が1枚ドローした`;
  }

  if (parts[1] === "bonus_draw") {
    return `${player}が追加ドローした（手札＜ダメージ）`;
  }

  if (parts[1] === "skip_bonus_draw") {
    return `${player}が追加ドローを行わずチャージフェイズへ進んだ`;
  }

  if (parts[1] === "release_start_commands") {
    return `${player}がホールド中のコマンドをリリースした`;
  }

  if (parts[1] === "return_all_battle_to_rush") {
    return `${player}がバトルエリアのユニットをすべてラッシュエリアに戻した`;
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
    const cardName = nameOfPart(parts[3]!, definitions);
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
        // The partner's card or instance id; a triggered effect logs its own reference instead, which says nothing.
        const partnerName = detail && !isInternal(detail) ? nameOfPart(detail, definitions) : detail && definitions[detail] ? definitions[detail]!.name : "Lユニット";
        return `${player}の「${cardName}」がジョイントLコンボを発動 → 「${partnerName}」にSP+1`;
      }
      case "joint_combo_r":
        return `${player}の「${cardName}」がジョイントRコンボを発動（SP+1）`;
      case "riding_combo":
        return `${player}の「${cardName}」がライディングコンボを発動（SP+1）`;
      case "xg2_042_number_two":
        return `${player}の「${cardName}」はファイナルアタックライドでナンバー「2」になり、バトルエリアの2番目に出たのでNC`;
      case "number_combo":
        if (detail?.startsWith("ruin_survey:")) {
          const seen = detail.replace("ruin_survey:", "");
          return `${player}の「${cardName}」が遺跡調査を発動 → 山札上「${seen}」を確認`;
        }
        if (detail === "eagle_diving") {
          return `${player}の「${cardName}」がイーグルダイビングを発動（SP1、BP+2000）`;
        }
        if (detail === "moss_breaker") {
          return `${player}の「${cardName}」がモスブレイカーを発動`;
        }
        if (detail === "sp1") {
          return `${player}の「${cardName}」がNCを発動（SP1）`;
        }
        if (detail?.startsWith("future_sight:")) {
          const drawn = detail.slice("future_sight:".length);
          return `${player}の「${cardName}」が未来予知を発動 → 「${drawn}」をドロー`;
        }
        if (detail === "future_sight") {
          return `${player}の「${cardName}」が未来予知を発動（1枚ドロー）`;
        }
        if (detail?.startsWith("choice:")) {
          const name = effectName(detail);
          return name ? `${player}の「${cardName}」がNCで${name}の対象選択` : `${player}の「${cardName}」のNCの対象選択`;
        }
        if (detail) {
          const name = effectName(detail);
          return name ? `${player}の「${cardName}」が${name}を発動` : `${player}の「${cardName}」がNCを発動`;
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
          return `${player}の「${cardName}」のバトルエリアに出たときの効果で「${target}」を撃破`;
        }
        if (detail === "destroy_choice") {
          return `${player}の「${cardName}」のバトルエリアに出たときの効果の対象選択`;
        }
        if (detail === "sky_magic_slash") {
          return `${player}の「${cardName}」が天空魔法斬りを発動（敵コマンドをホールド）`;
        }
        return `${player}の「${cardName}」のバトルエリアに出たときの効果`;
      }
      case "named_effect": {
        if (detail === "super_shield") {
          return `${player}の「${cardName}」が超シールド進化を発動（かわりに捨札）`;
        }
        if (detail === "focused_breakthrough") {
          return `${player}の「${cardName}」が一点突破を発動（相手に1ダメージ）`;
        }
        if (detail?.startsWith("choice:")) {
          const name = effectName(detail);
          return name ? `${player}の「${cardName}」が${name}の対象選択` : `${player}の「${cardName}」の効果の対象選択`;
        }
        if (detail) {
          const name = effectName(detail);
          return name ? `${player}の「${cardName}」が${name}を発動` : `${player}の「${cardName}」の効果が発動`;
        }
        return `${player}の「${cardName}」の効果`;
      }
      case "resolve_effect_choice": {
        if (detail && isNoteworthyResolveEffectChoice(detail)) {
          return formatResolveEffectChoiceNotice(player, cardName, detail, definitions);
        }
        const name = effectName(detail);
        return name ? `${player}の「${cardName}」の${name}を解決` : `${player}の「${cardName}」の効果を解決`;
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
        // A marker instead of 「相手:BP」: the battle stopped or waits for an effect before it.
        if (isInternal(detail) && !detail!.includes(":")) {
          if (detail === "cancelled") return `${player}の「${cardName}」のバトルは行われなかった`;
          if (detail === "failed") return `${player}の「${cardName}」のバトルは行えなかった`;
          return `${player}の「${cardName}」のバトルの前に効果を処理`;
        }
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
      case "deck_search_reveal": {
        // 「山札から…を1枚選び、相手に見せてから手札に加える」（rules/deckSearchReveal.ts）: 詳しい部分は「効果名:カード番号,…」。
        const [rawLabel, ids] = (detail ?? "").split(":");
        // 効果名は日本語のときだけ（内部の印は出さない）。カードは定義があるものだけ名前で出す。
        const label = rawLabel && !/^[\x00-\x7f]*$/.test(rawLabel) ? rawLabel : "";
        const names = (ids ?? "").split(",").filter((id) => definitions[id]?.name).map((id) => `「${definitions[id]!.name}」`).join("・");
        return `${player}が「${cardName}」${label ? `（${label}）` : ""}で山札から${names || "カード"}を見せて手札に加えた`;
      }
      case "play_counter": {
        if (detail?.startsWith("dino_guts:")) {
          const count = detail.split(":")[1] ?? "0";
          return `${player}が「${cardName}」（${getEffectLabel("dino_guts")}）を使用 → ユニットが場に留まる（山札${count}枚を捨札）`;
        }
        return `${player}がカウンター「${cardName}」を使用`;
      }
      default: {
        const name = effectName(detail);
        const suffix = ACTION_SUFFIX[action] ?? "の効果";
        return `${player}の「${cardName}」${suffix}${name ? `（${name}）` : ""}`;
      }
    }
  }

  return entry;
}
