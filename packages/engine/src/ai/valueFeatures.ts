// 学習用の盤面の特徴ベクトル（docs: CPU 学習ロードマップ Phase 1）。
// 指定プレイヤーから見える情報だけを使う。相手の手札と山札は枚数だけで、中身は入れない。
// 自分の山札は順番は分からないが、デッキリストから残りの顔ぶれは分かるので集計して入れる
// （必要パワー・ナンバー・カテゴリ別の枚数、ゾードアップとその素材、回収効果を持つカードが残っているか）。
// カードは ID ではなく性能（BP・SP・サイズ・必要パワー）で表し、新しいスターターでも学習し直さずに使えるようにする。
// 学習側（Python）は scripts/selfplay.ts が書いた名前つきの列を読むので、列を変えたら FEATURE_VERSION を上げる。
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import { effectiveBp, getDefinition, isCounterOperation, isPermanentOperation, parsePowerCost } from "../core/catalog";
import { strikeDamageFor } from "../rules/combo";
import { opponent } from "../core/helpers";
import { collectZordMaterials, isValidZordUpMaterial, needsZordMaterial } from "../rules/zord";
import { isZordUpCost } from "@rangers-strike/cards";
import { deckProfile } from "./deckProfile";
import { heuristicEvaluate } from "./scoring";

export const FEATURE_VERSION = 2;

const PHASES = ["start", "charge", "rush", "battle", "end"] as const;
const SIZES = ["S", "M", "L", "XL", "SC"] as const;
/** 場の枠の数。これより多いユニットは集計の列にだけ入る。 */
const BATTLE_SLOTS = 7;
const RUSH_SLOTS = 5;
/** 必要パワーのヒストグラムの区切り（0,1,…,7,8 以上）。 */
const COST_BINS = 9;

const CLOCK_UP_IDS = new Set(["RK-021", "RK-078"]);
const CATEGORIES = ["ET", "WB", "OT", "MA", "DA"] as const;
/** ナンバーの区切り（1〜5、6 以上、L、R、RC）。 */
const COMBO_BINS = ["1", "2", "3", "4", "5", "6+", "L", "R", "RC"] as const;

/**
 * カードを回収・サーチする効果の種類。効果文から見分ける（スターター 655 枚で確かめた言い回し）。
 * 相手のカードを戻す効果も混ざるが、学習の手がかりとしては十分。
 */
const RECOVERY_KINDS = {
  discard_to_hand: /捨札[^。]*?(?:手札に(?:加え|戻)|手札にする)/,
  discard_to_field: /捨札[^。]*?(?:ラッシュエリア|バトルエリア)に(?:出|置)/,
  deck_search: /山札[^。]*?(?:選び|探し|見て)[^。]*?手札に加え/,
  zone_to_hand: /(?:パワーゾーン|コマンドゾーン|パワー|コマンド)[^。]*?手札に(?:加え|戻)/,
} as const;
type RecoveryKind = keyof typeof RECOVERY_KINDS;
const recoveryCache = new Map<string, RecoveryKind[]>();

function recoveryKinds(state: GameState, cardId: string): RecoveryKind[] {
  let kinds = recoveryCache.get(cardId);
  if (!kinds) {
    const text = (getDefinition(state.definitions, cardId)?.text ?? "").normalize("NFKC");
    kinds = (Object.keys(RECOVERY_KINDS) as RecoveryKind[]).filter((k) => RECOVERY_KINDS[k].test(text));
    recoveryCache.set(cardId, kinds);
  }
  return kinds;
}

/** 効果の種類（効果文の言い回しから見分ける）。デッキの性格と、手札で何ができるかの手がかりにする。 */
const EFFECT_KINDS = {
  destroy: /撃破/,
  bp_up: /BP\+/,
  bp_down: /BP-|BP−/,
  damage: /ダメージ/,
  strike: /ストライク/,
  hold: /ホールド/,
  to_hand: /手札に(?:加え|戻)/,
  discard_ref: /捨札/,
  deck_ref: /山札/,
  power_ref: /パワーゾーン/,
  feature_ref: /特徴[「｢]/,
  name_ref: /[「｢][^」｣]+[」｣]のカード|[「｢][^」｣]+[」｣]のユニット/,
} as const;
const EFFECT_KIND_NAMES = [...Object.keys(EFFECT_KINDS), "counter", "permanent"];
const effectCache = new Map<string, number[]>();

/** カードごとの効果の種類（EFFECT_KIND_NAMES の順に 0/1）。 */
function effectKinds(state: GameState, cardId: string): number[] {
  let kinds = effectCache.get(cardId);
  if (!kinds) {
    const def = getDefinition(state.definitions, cardId);
    const text = (def?.text ?? "").normalize("NFKC");
    kinds = [...Object.values(EFFECT_KINDS).map((re) => (re.test(text) ? 1 : 0)), isCounterOperation(def) ? 1 : 0, isPermanentOperation(def) ? 1 : 0];
    effectCache.set(cardId, kinds);
  }
  return kinds;
}

function comboBin(state: GameState, card: CardInstance): number {
  const cn = getDefinition(state.definitions, card.cardId)?.comboNumber;
  if (cn === null || cn === undefined) return -1;
  if (typeof cn === "number") return cn >= 6 ? 5 : cn - 1;
  return COMBO_BINS.indexOf(cn as (typeof COMBO_BINS)[number]);
}

function buildNames(): string[] {
  const names: string[] = [];
  for (const p of PHASES) names.push(`phase_${p}`);
  names.push("self_active", "self_first", "turn", "pending_battle", "pending_strike", "pending_rush", "eval");
  for (const side of ["self", "enemy"]) {
    names.push(
      ...[
        "damage", "damage_to_win", "deck", "hand", "discard", "power_up", "power_down", "command", "command_held",
        "operation", "rush", "battle", "field_bp", "strike_total", "strike_max", "clock_up", "discard_units",
        "discard_ops", "battle_acted", "battle_bp_max", "rush_bp_max",
      ].map((n) => `${side}_${n}`),
    );
    for (let i = 0; i < BATTLE_SLOTS; i++) {
      names.push(...["on", "bp", "sp", "acted", "cn", ...SIZES.map((s) => `size_${s}`)].map((n) => `${side}_b${i}_${n}`));
    }
    for (let i = 0; i < RUSH_SLOTS; i++) {
      names.push(...["on", "bp", "sp", "cost", ...SIZES.map((s) => `size_${s}`)].map((n) => `${side}_r${i}_${n}`));
    }
  }
  names.push("self_hand_units", "self_hand_ops", "self_hand_other", "self_hand_playable", "self_hand_bp_max");
  for (let i = 0; i < COST_BINS; i++) names.push(`self_hand_cost${i}`);
  names.push("self_deck_units", "self_deck_ops", "self_deck_cost_avg", "self_deck_bp_avg", "self_max_power_cost");
  for (let i = 0; i < COST_BINS; i++) names.push(`self_deck_cost${i}`);
  for (const b of COMBO_BINS) names.push(`self_deck_cn_${b}`);
  for (const c of CATEGORIES) names.push(`self_deck_cat_${c}`);
  names.push(
    "self_zord_hand", "self_zord_hand_ready", "self_zord_deck", "self_zord_material_field", "self_zord_material_hand",
    "self_zord_material_deck",
  );
  for (const k of Object.keys(RECOVERY_KINDS)) names.push(`self_recover_${k}_hand`, `self_recover_${k}_deck`);
  for (const k of EFFECT_KIND_NAMES) names.push(`self_hand_fx_${k}`);
  for (const n of RECIPE_NAMES) names.push(`self_recipe_${n}`);
  return names;
}

const RECIPE_NAMES = [
  "cards", "units", "ops", "vehicles", "bp_avg",
  ...Array.from({ length: COST_BINS }, (_, i) => `cost${i}`),
  ...COMBO_BINS.map((b) => `cn_${b}`),
  ...CATEGORIES.map((c) => `cat_${c}`),
  ...SIZES.map((s) => `size_${s}`),
  "sp_none", "sp_special", "sp1", "sp2plus", "sp_fraction",
  "zord_up", "zord_material", "top_feature_share",
  ...Object.keys(RECOVERY_KINDS).map((k) => `recover_${k}`),
  ...EFFECT_KIND_NAMES.map((k) => `fx_${k}`),
];
const recipeCache = new WeakMap<object, Partial<Record<PlayerId, Float32Array>>>();

/**
 * デッキレシピ全体（自分の全ゾーンのカード）の性格。対戦中は変わらないので定義表ごとに 1 度だけ作る。
 * 残りの山札の列と違い、「このデッキは何をしたいデッキか」（NC 寄り、ゾード寄り、回収で粘る、など）を表す。
 */
function recipeSummary(state: GameState, playerId: PlayerId): Float32Array {
  const byPlayer = recipeCache.get(state.definitions) ?? {};
  const cached = byPlayer[playerId];
  if (cached) return cached;
  const p = state.players[playerId];
  const cards = [...p.deck, ...p.hand, ...p.discard, ...p.power, ...p.command, ...p.rush, ...p.battle, ...p.operation, ...(p.exile ?? [])];
  const defs = cards.map((c) => getDefinition(state.definitions, c.cardId));
  const units = defs.filter((d) => d?.type === "unit");
  const out: number[] = [];
  const n = Math.max(1, cards.length);
  out.push(cards.length / 50, units.length / n, defs.filter((d) => d?.type === "operation").length / n, defs.filter((d) => d?.type === "vehicle").length / n);
  out.push(units.reduce((a, d) => a + (d?.bp ?? 0), 0) / Math.max(1, units.length) / 10_000);
  const cost = new Array<number>(COST_BINS).fill(0);
  const combo = new Array<number>(COMBO_BINS.length).fill(0);
  for (const c of cards) {
    cost[Math.min(COST_BINS - 1, costOf(state, c))]!++;
    const b = comboBin(state, c);
    if (b >= 0) combo[b]!++;
  }
  out.push(...cost.map((x) => x / n), ...combo.map((x) => x / n));
  out.push(...CATEGORIES.map((cat) => defs.filter((d) => d && [d.category].flat().includes(cat)).length / n));
  out.push(...SIZES.map((sz) => units.filter((d) => d?.size === sz).length / n));
  const sp = [0, 0, 0, 0, 0];
  for (const d of units) {
    const v = d?.sp;
    if (v === undefined || v === null) sp[0]!++;
    else if (v === "special") sp[1]!++;
    else if (typeof v === "number") sp[v >= 2 ? 3 : 2]!++;
    else sp[4]!++;
  }
  out.push(...sp.map((x) => x / n));
  const zordIds = [...new Set(defs.filter((d) => d && isZordUpCost(d.powerCost) && needsZordMaterial(state.definitions, d.id)).map((d) => d!.id))];
  out.push(defs.filter((d) => d && isZordUpCost(d.powerCost)).length / n);
  out.push(cards.filter((c) => zordIds.some((id) => id !== c.cardId && isValidZordUpMaterial(state.definitions, id, "", c))).length / n);
  const featureCount = new Map<string, number>();
  for (const d of units) for (const f of d?.features ?? []) featureCount.set(f, (featureCount.get(f) ?? 0) + 1);
  out.push(Math.max(0, ...featureCount.values()) / Math.max(1, units.length));
  for (const k of Object.keys(RECOVERY_KINDS) as RecoveryKind[]) out.push(cards.filter((c) => recoveryKinds(state, c.cardId).includes(k)).length / n);
  const fx = new Array<number>(EFFECT_KIND_NAMES.length).fill(0);
  for (const c of cards) effectKinds(state, c.cardId).forEach((v, i) => (fx[i]! += v));
  out.push(...fx.map((x) => x / n));
  if (out.length !== RECIPE_NAMES.length) throw new Error(`recipeSummary wrote ${out.length} of ${RECIPE_NAMES.length}`);
  const arr = Float32Array.from(out);
  byPlayer[playerId] = arr;
  recipeCache.set(state.definitions, byPlayer);
  return arr;
}

export const FEATURE_NAMES: readonly string[] = buildNames();
export const FEATURE_DIM = FEATURE_NAMES.length;

function costOf(state: GameState, card: CardInstance): number {
  return parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost);
}

function sizeOf(state: GameState, card: CardInstance): string | undefined {
  return card.sizeOverride ?? getDefinition(state.definitions, card.cardId)?.size;
}

function clockUpShields(state: GameState, playerId: PlayerId): number {
  let stacked = 0;
  for (const op of state.players[playerId].operation) if (CLOCK_UP_IDS.has(op.cardId)) stacked += op.stackedCards?.length ?? 0;
  return stacked;
}

/** `playerId` から見た盤面を FEATURE_DIM 個の数値にする。値はだいたい 0〜数の範囲に揃える。 */
export function encodeState(state: GameState, playerId: PlayerId): Float32Array {
  const out = new Float32Array(FEATURE_DIM);
  let k = 0;
  const put = (v: number) => {
    out[k++] = Number.isFinite(v) ? v : 0;
  };
  const enemyId = opponent(playerId);

  for (const p of PHASES) put(state.phase === p ? 1 : 0);
  put(state.activePlayer === playerId ? 1 : 0);
  put(state.firstPlayer === playerId ? 1 : 0);
  put(Math.min(state.turn, 40) / 20);
  put(state.pendingBattle ? 1 : 0);
  put(state.pendingStrike ? 1 : 0);
  put(state.pendingRush ? 1 : 0);
  // 今の手書き評価も入れておく。ネットはここから補正を学べばよいので、少ないデータでも今より悪くなりにくい。
  put(Math.tanh(heuristicEvaluate(state, playerId) / 20_000));

  for (const id of [playerId, enemyId]) {
    const p = state.players[id];
    const strikes = p.battle.map((c) => strikeDamageFor(state.definitions, c, state, id));
    const discardDefs = p.discard.map((c) => getDefinition(state.definitions, c.cardId));
    const battleBp = p.battle.map((c) => effectiveBp(state, id, c));
    const rushBp = p.rush.map((c) => effectiveBp(state, id, c));
    const faceDown = p.power.filter((c) => c.faceDown).length;
    put(p.damage / WIN_DAMAGE);
    put(Math.max(0, WIN_DAMAGE - p.damage) / WIN_DAMAGE);
    put(p.deck.length / 40);
    put(p.hand.length / 10);
    put(p.discard.length / 40);
    put((p.power.length - faceDown) / 10);
    put(faceDown / 10);
    put(p.command.length / 10);
    put(p.command.filter((c) => c.commandHeld).length / 10);
    put(p.operation.length / 5);
    put(p.rush.length / 5);
    put(p.battle.length / 7);
    put([...battleBp, ...rushBp].reduce((a, b) => a + b, 0) / 50_000);
    put(strikes.reduce((a, b) => a + b, 0) / WIN_DAMAGE);
    put(Math.max(0, ...strikes) / WIN_DAMAGE);
    put(clockUpShields(state, id) / 5);
    put(discardDefs.filter((d) => d?.type === "unit").length / 40);
    put(discardDefs.filter((d) => d?.type === "operation").length / 40);
    put(p.battle.filter((c) => c.battleActed).length / 7);
    put(Math.max(0, ...battleBp) / 10_000);
    put(Math.max(0, ...rushBp) / 10_000);

    for (let i = 0; i < BATTLE_SLOTS; i++) {
      const c = p.battle[i];
      const def = c && getDefinition(state.definitions, c.cardId);
      const size = c && sizeOf(state, c);
      put(c ? 1 : 0);
      put(c ? battleBp[i]! / 10_000 : 0);
      put(c ? strikes[i]! : 0);
      put(c?.battleActed ? 1 : 0);
      // ナンバーが今の位置（1 始まり）と合っていれば 1（NC が成立している並び）。
      put(def && typeof def.comboNumber === "number" && def.comboNumber === i + 1 ? 1 : 0);
      for (const s of SIZES) put(size === s ? 1 : 0);
    }
    for (let i = 0; i < RUSH_SLOTS; i++) {
      const c = p.rush[i];
      const def = c && getDefinition(state.definitions, c.cardId);
      const size = c && sizeOf(state, c);
      put(c ? 1 : 0);
      put(c ? rushBp[i]! / 10_000 : 0);
      put(c ? strikeDamageFor(state.definitions, c, state, id) : 0);
      put(def ? parsePowerCost(def.powerCost) / 10 : 0);
      for (const s of SIZES) put(size === s ? 1 : 0);
    }
  }

  const self = state.players[playerId];
  const handDefs = self.hand.map((c) => getDefinition(state.definitions, c.cardId));
  const powerUp = self.power.filter((c) => !c.faceDown).length;
  put(handDefs.filter((d) => d?.type === "unit").length / 10);
  put(handDefs.filter((d) => d?.type === "operation").length / 10);
  put(handDefs.filter((d) => d && d.type !== "unit" && d.type !== "operation").length / 10);
  put(self.hand.filter((c) => costOf(state, c) <= powerUp).length / 10);
  put(Math.max(0, ...handDefs.map((d) => (d?.type === "unit" ? (d.bp ?? 0) : 0))) / 10_000);
  const bins = new Array<number>(COST_BINS).fill(0);
  for (const c of self.hand) bins[Math.min(COST_BINS - 1, costOf(state, c))]!++;
  for (const b of bins) put(b / 5);

  const deckDefs = self.deck.map((c) => getDefinition(state.definitions, c.cardId));
  const deckN = Math.max(1, deckDefs.length);
  put(deckDefs.filter((d) => d?.type === "unit").length / 40);
  put(deckDefs.filter((d) => d?.type === "operation").length / 40);
  put(deckDefs.reduce((a, d) => a + parsePowerCost(d?.powerCost), 0) / deckN / 10);
  put(deckDefs.reduce((a, d) => a + (d?.type === "unit" ? (d.bp ?? 0) : 0), 0) / deckN / 10_000);
  put(deckProfile(state, playerId).maxPowerCost / 10);

  const deckCost = new Array<number>(COST_BINS).fill(0);
  const deckCombo = new Array<number>(COMBO_BINS.length).fill(0);
  for (const c of self.deck) {
    deckCost[Math.min(COST_BINS - 1, costOf(state, c))]!++;
    const b = comboBin(state, c);
    if (b >= 0) deckCombo[b]!++;
  }
  for (const n of deckCost) put(n / 10);
  for (const n of deckCombo) put(n / 10);
  for (const cat of CATEGORIES) put(deckDefs.filter((d) => d && [d.category].flat().includes(cat)).length / 20);

  // ゾードアップ: 手札と山札に残っている枚数、手札のうち今すぐ素材がそろっているもの、
  // 場・手札・山札にある素材（自分のゾードアップのどれかに使えるカード）の枚数。
  const isZord = (c: CardInstance) => isZordUpCost(getDefinition(state.definitions, c.cardId)?.powerCost ?? 0);
  const zordIds = [...new Set([...self.hand, ...self.deck].filter(isZord).map((c) => c.cardId))].filter((id) =>
    needsZordMaterial(state.definitions, id),
  );
  const isMaterial = (c: CardInstance) => zordIds.some((id) => id !== c.cardId && isValidZordUpMaterial(state.definitions, id, "", c));
  put(self.hand.filter(isZord).length / 5);
  put(
    self.hand.filter(
      (c) => isZord(c) && (!needsZordMaterial(state.definitions, c.cardId) || collectZordMaterials(self, state.definitions, c.cardId, c.instanceId).length > 0),
    ).length / 5,
  );
  put(self.deck.filter(isZord).length / 5);
  put([...self.rush, ...self.battle].filter(isMaterial).length / 5);
  put(self.hand.filter(isMaterial).length / 5);
  put(self.deck.filter(isMaterial).length / 10);

  // 回収・サーチの効果を持つカードが手札と山札に何枚あるか。
  for (const k of Object.keys(RECOVERY_KINDS) as RecoveryKind[]) {
    put(self.hand.filter((c) => recoveryKinds(state, c.cardId).includes(k)).length / 5);
    put(self.deck.filter((c) => recoveryKinds(state, c.cardId).includes(k)).length / 5);
  }
  const handFx = new Array<number>(EFFECT_KIND_NAMES.length).fill(0);
  for (const c of self.hand) effectKinds(state, c.cardId).forEach((v, i) => (handFx[i]! += v));
  for (const x of handFx) put(x / 5);
  for (const x of recipeSummary(state, playerId)) put(x);

  if (k !== FEATURE_DIM) throw new Error(`encodeState wrote ${k} of ${FEATURE_DIM} features`);
  return out;
}
