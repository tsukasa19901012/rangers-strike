// Japanese labels for phases, players and engine actions. Labels are derived
// generically from the action payload so new engine action types still get a
// readable (if plain) label without a UI change.
import type { GameAction, GameState, PlayerId } from "../engineApi";

export const PHASE_LABELS: Record<string, string> = {
  start: "スタート",
  charge: "チャージ",
  rush: "ラッシュ",
  battle: "バトル",
  end: "エンド",
};

export const PLAYER_LABELS: Record<PlayerId, string> = {
  player1: "あなた",
  player2: "CPU",
};

export const ACTION_LABELS: Record<string, string> = {
  activate_field_unit_ability: "ユニット能力を起動",
  activate_resident_operation: "常駐オペレーションを起動",
  battle_dance_retreat: "バトルダンス撤退",
  battle: "アタック",
  begin_zord_setup: "ゾードラッシュ準備",
  bonus_draw: "追加ドロー",
  cancel_command_payment: "支払いをやめる",
  cancel_wing_hold: "ウイングのホールドをやめる",
  cancel_zord_setup: "ゾードラッシュをやめる",
  charge_command: "コマンドにチャージ",
  charge_power: "パワーにチャージ",
  confirm_denji_reveal: "公開を確認",
  confirm_effect_choice: "選択を確定",
  confirm_shiron_reveal: "公開を確認",
  draw: "ドロー",
  end_phase: "フェイズ終了",
  five_tech_intercept: "ファイブテクノロジー",
  hidora_egg: "ヒドラの卵",
  hold_for_wing: "ウイングのためホールド",
  initiate_command_payment: "コマンドを支払って使う",
  mount_ride: "ライドしてバトルへ",
  move_to_battle: "バトルエリアへ進入",
  pass_battle_entry: "進入を終える",
  pass_battle_reaction: "反応しない",
  pass_chase: "チェイスしない",
  pass_leave_reaction: "反応しない",
  pass_morph_reaction: "モーフしない",
  pass_register: "レジストしない",
  pass_rush_reaction: "反応しない",
  pass_strike_reaction: "反応しない",
  play_counter: "カウンター",
  play_operation: "オペレーション",
  release_start_commands: "コマンドをリリース",
  resolve_chase: "チェイス",
  resolve_command_payment: "ホールドして支払う",
  resolve_damage_payment: "ダメージで裏返す",
  resolve_effect_choice: "選ぶ",
  resolve_ride_off_choice: "ライドオフ選択",
  resolve_ruin_survey: "遺跡調査",
  resolve_seabed_draw: "海底ドロー",
  resolve_zord_setup: "ゾード素材を選ぶ",
  return_all_battle_to_rush: "バトルエリアをラッシュへ戻す",
  rush: "ラッシュ",
  select_morph_unit: "モーフするユニット",
  self_rush_from_zone: "自身をラッシュ",
  shiron_light: "シロンの光",
  skip_bonus_draw: "追加ドローしない",
  skip_effect_choice: "選ばない",
  strike: "ストライク",
  use_juu_kun_do: "ジュウクンドー",
  use_magi_ticket: "マジチケット",
  use_plasma_energy: "プラズマエネルギー",
  use_register: "レジスト",
  use_super_shield: "スーパーシールド",
};

const FIELD_LABELS: Record<string, string> = {
  zone: "ゾーン",
  kind: "種類",
  destination: "行き先",
  position: "位置",
  number: "数字",
  branch: "分岐",
  rideOff: "降りる",
  prismSubstitute: "プリズム代用",
};

const VALUE_LABELS: Record<string, string> = {
  hand: "手札",
  command: "コマンド",
  power: "パワー",
  discard: "捨札",
  deck_top: "山札の上",
  deck_bottom: "山札の下",
  top: "上",
  bottom: "下",
  battle_entry: "バトル進入",
  category_use: "カテゴリ",
  mothership_hold: "母艦",
  effect_hold: "効果",
};

/**
 * Readable fallback for log entries the engine's formatGameLog leaves in the
 * structured "player|action|..." / "phase:a->b" form. Returns null for purely
 * internal markers (e.g. "*_pending") that should not be shown.
 */
export function humanizeLogEntry(entry: string, state: GameState): string | null {
  const phase = /^phase:(\w+)->(\w+)$/.exec(entry);
  if (phase) return `── ${PHASE_LABELS[phase[2]!] ?? phase[2]}フェイズ ──`;
  if (!entry.includes("|")) return entry;
  const [player, action, ...rest] = entry.split("|");
  if (!action || /_pending(_|$)/.test(action)) return null;
  const who = PLAYER_LABELS[player as PlayerId] ?? player;
  const label = ACTION_LABELS[action] ?? action;
  const details = rest
    .filter((part) => part && part !== "unknown")
    .map((part) => (/^[A-Z]{2,3}-\d{3}$/.test(part) ? null : (state.definitions[part]?.name ?? part)))
    .filter((part): part is string => !!part);
  return details.length ? `${who}: ${label} ${details.join(" ")}` : `${who}: ${label}`;
}

/** instanceId -> cardId for every card both players own (all zones). */
export function indexInstances(state: GameState): Map<string, string> {
  const map = new Map<string, string>();
  for (const player of Object.values(state.players)) {
    for (const zone of [
      player.deck,
      player.hand,
      player.discard,
      player.power,
      player.command,
      player.rush,
      player.battle,
      player.operation,
      player.exile ?? [],
      player.commander ?? [],
    ]) {
      for (const card of zone) map.set(card.instanceId, card.cardId);
    }
  }
  return map;
}

export function cardName(state: GameState, cardId: string | undefined): string {
  if (!cardId) return "?";
  return state.definitions[cardId]?.name ?? cardId;
}

export function instanceName(
  state: GameState,
  instanceId: string,
  index: Map<string, string> = indexInstances(state),
): string {
  const cardId = index.get(instanceId) ?? instanceId.replace(/-\d+$/, "");
  return cardName(state, cardId);
}

function formatValue(
  state: GameState,
  key: string,
  value: unknown,
  index: Map<string, string>,
): string | null {
  if (value === undefined || value === null) return null;
  if (/InstanceIds?$/.test(key) || key === "instanceId") {
    const ids = Array.isArray(value) ? value : [value];
    if (ids.length === 0) return "なし";
    return ids.map((id) => instanceName(state, String(id), index)).join("・");
  }
  if (typeof value === "boolean") return value ? (FIELD_LABELS[key] ?? key) : null;
  if (typeof value === "string" || typeof value === "number") {
    const text = VALUE_LABELS[String(value)] ?? String(value);
    return key in FIELD_LABELS ? `${FIELD_LABELS[key]}:${text}` : text;
  }
  if (Array.isArray(value)) {
    return value.map((v) => VALUE_LABELS[String(v)] ?? String(v)).join("・");
  }
  return null;
}

/** Human-readable one-line label for an engine action. */
export function describeAction(
  state: GameState,
  action: GameAction,
  index: Map<string, string> = indexInstances(state),
): string {
  const base = ACTION_LABELS[action.type] ?? action.type;
  const record = action as unknown as Record<string, unknown>;
  if (action.type === "battle") {
    const attacker = formatValue(state, "attackerInstanceId", record.attackerInstanceId, index);
    const defender = formatValue(state, "defenderInstanceId", record.defenderInstanceId, index);
    return `${base}: ${attacker} → ${defender}`;
  }
  if (action.type === "end_phase") {
    return `${PHASE_LABELS[state.phase] ?? state.phase}${base}`;
  }
  // Card names first (they matter most when a narrow screen truncates the row),
  // then the remaining fields in parentheses.
  const cards: string[] = [];
  const extra: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "type" || key === "playerId") continue;
    const text = formatValue(state, key, value, index);
    if (!text) continue;
    if (/InstanceIds?$/.test(key) || key === "instanceId") cards.push(text);
    else extra.push(text);
  }
  const head = cards.length ? `${base}: ${cards.join(" / ")}` : base;
  return extra.length ? `${head}（${extra.join("・")}）` : head;
}
