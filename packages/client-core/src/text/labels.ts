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
  raiaDiscard: "コマンドから捨札にして使う",
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
  // Reaction windows open at the same time (simultaneous_order): which one resolves first.
  pendingLeave: "場を離れたユニットへの反応を先に処理",
  pendingStrike: "ストライクへの反応を先に処理",
  pendingBattle: "アタックへの反応を先に処理",
  pendingRush: "ラッシュへの反応を先に処理",
  super_radar: "超電子レーダーを先に処理",
  // Option tokens the engine offers in resolve_effect_choice (branches and confirmations).
  accept: "使う",
  use: "使う",
  confirm: "決定",
  draw: "ドローする",
  hold: "ホールドする",
  destroy: "撃破する",
  release: "リリースする",
  shuffle: "シャッフルする",
  reveal: "山札の上をオモテにする",
  reveal_top: "山札の上をオモテにする",
  faceup: "オモテにする",
  exile: "ゲームから除外",
  return: "ラッシュエリアに戻す",
  place_in_power: "パワーゾーンに置く",
  to_command: "コマンドゾーンに置く",
  attack: "アタック",
  strike: "ストライク",
  bp: "BP",
  power_cost: "必要パワーの数字",
  number: "ナンバーの数字",
  deck_own: "自軍の山札",
  deck_enemy: "敵軍の山札",
  search: "山札から探して手札に加える",
  rush: "カードをラッシュエリアに出す",
  scry: "山札の上を見て上か下に戻す",
  add_feature: "特徴「仮面ライダー」を追加",
  discard_to_deck_bottom: "捨札のSユニットを山札の下に戻す",
  sp_1_2: "SユニットをSP1/2にする",
  sp_1_4: "SユニットをSP1/4にする",
  sp_1_5: "SユニットをSP1/5にする",
  air_battle: "航空機のMユニットとバトル",
  discard_to_command: "捨札の改造人間をコマンドゾーンへ",
  command_rush: "コマンドの改造人間をラッシュエリアへ",
  vehicle_without_ride: "ビークルをライドなしでバトルエリアへ",
  draw_return: "1枚ドローし、1枚を山札の上に戻す",
  mirror_cost: "ミラーライダーの必要パワーを減らす",
  deck_to_command: "山札の上をコマンドゾーンへ",
  accel_waive: "加速ユニットの追加条件をなくす",
  gavan_rush: "「宇宙刑事ギャバン」をラッシュ",
  sharivan_rush: "「宇宙刑事シャリバン」をラッシュ",
  shaider_rush: "「宇宙刑事シャイダー」をラッシュ",
  add_red: "特徴「レッド」を追加",
  add_blue: "特徴「ブルー」を追加",
  hibiki_rush: "「仮面ライダー響鬼」をラッシュ",
  reveal_draw: "敵軍山札の上をオモテにする",
  recruit_abaredo_on_destroy: "「アバレッド」を出す効果を先に処理",
  xg6_done: "選ぶのを終える",
  // 「好きな順で山札の下に戻す」（engine rules/deckOrder.ts）
  order_done: "この順で戻す",
  order_reset: "選び直す",
  plasma_done: "撃破するのを終える",
  __none__: "発動しない",
  __set9a_done__: "選ぶのを終える",
  mothership: "母艦で支払う",
  material: "素材で支払う",
};

/** Tokens whose meaning depends on the card: effectId -> token -> label. */
const EFFECT_VALUE_LABELS: Record<string, Record<string, string>> = {
  bk1_belt_mode: { release: "Sユニットを1体リリース" },
  xg5_007_gogo_change: { release: "リリース状態で置く", discard: "捨札にする" },
  xg1_076_decadriver: { mode_1: "「仮面ライダーディケイド」をラッシュ", mode_2: "ディケイドライバーのカードをパワーゾーンへ" },
  xg7054_ooo_driver: { mode1_rush: "オーズドライバーのカードをラッシュ", mode2_cost: "次のカードの必要パワーを3減らす" },
  sx010_movie_war_mode: { deck_bottom: "山札の下に戻す" },
};

/** Label for an option token (not a card instance) of the pending effect choice. */
function optionLabel(state: GameState, id: string): string | undefined {
  const choice = state.pendingEffectChoice;
  const own = choice ? EFFECT_VALUE_LABELS[choice.effectId]?.[id] : undefined;
  if (own) return own;
  if (VALUE_LABELS[id]) return VALUE_LABELS[id];
  const draws = /^draw:(\d+)$/.exec(id);
  if (draws) return `${draws[1]}枚ドロー`;
  // A lone confirmation named after the effect itself (e.g. "rs384_water_discharge").
  if (choice && (id === choice.effectId || id.endsWith(`_${choice.effectId}`) || (id.length > 4 && choice.effectId.endsWith(id)))) return "使う";
  return undefined;
}

const REVEAL_DESTINATIONS: Record<string, string> = {
  hand: "手札へ",
  deck_top: "山札の上へ",
  deck_bottom: "山札の下へ",
  discard: "捨札へ",
  rush: "ラッシュエリアへ",
  power: "パワーゾーンへ",
  command: "コマンドゾーンへ",
  deck_shuffle: "山札に戻した",
  stay: "そのまま",
};

const REVEAL_FROM: Record<string, string> = {
  deck_top: "山札の上",
  deck_bottom: "山札の下",
  hand: "手札",
  power: "パワーゾーン",
  discard: "捨札",
};

type RevealNoticeLike = NonNullable<GameState["lastReveal"]>;

/** 「CPUが山札の上から1枚オモテにした（潜行捜索）」: what a reveal notice (GameState.lastReveal) shows. */
export function revealSummary(state: GameState, reveal: RevealNoticeLike): string {
  const actor = PLAYER_LABELS[reveal.playerId] ?? reveal.playerId;
  const mutual = reveal.cards.some((c) => c.ownerId !== undefined && c.ownerId !== reveal.ownerId);
  const owner = mutual ? "お互いの" : reveal.ownerId === reveal.playerId ? "" : `${PLAYER_LABELS[reveal.ownerId] ?? reveal.ownerId}の`;
  const source = reveal.sourceCardId ? cardName(state, reveal.sourceCardId) : "";
  const label = reveal.effectLabel || source;
  const declared = reveal.declaredNumber !== undefined ? ` 宣言:${reveal.declaredNumber}${reveal.matched === undefined ? "" : reveal.matched ? "（一致）" : "（不一致）"}` : "";
  return `${actor}が${owner}${REVEAL_FROM[reveal.from] ?? reveal.from}から${reveal.cards.length}枚オモテにした${label ? `（${label}）` : ""}${declared}`;
}

/** Where a revealed card went: 「手札へ」. */
export function revealDestination(destination: string): string {
  return REVEAL_DESTINATIONS[destination] ?? destination;
}

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
    // The engine also passes option tokens in instanceId (e.g. "deck_top" for RK-002).
    // "effectId:instanceId" names one of two effects of the same card (battleDestroyOrderMeta).
    const name = (id: string) =>
      index.has(id) ? instanceName(state, id, index) : (optionLabel(state, id) ?? instanceName(state, id.replace(/^[^:]*:/, ""), index));
    return ids
      .map((id) => name(String(id)))
      .join("・");
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
  // Both answers are legal (ライドしたまま進むのも可 — atwiki p594 Q3): say plainly what each one does.
  if (action.type === "resolve_ride_off_choice") {
    return action.rideOff ? "ライドオフする（ビークルから降りる）" : "ライドしたまま進む";
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
