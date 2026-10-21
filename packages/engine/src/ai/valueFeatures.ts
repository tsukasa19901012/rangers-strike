// 学習用の盤面の特徴ベクトル（docs: CPU 学習ロードマップ Phase 1）。
// 指定プレイヤーから見える情報だけを使う。相手の手札と山札は枚数だけで、中身は入れない。
// 自分の山札は順番は分からないが、デッキリストから残りの顔ぶれは分かるので集計して入れる。
// カードは ID ではなく性能（BP・SP・サイズ・必要パワー）で表し、新しいスターターでも学習し直さずに使えるようにする。
// 学習側（Python）は scripts/selfplay.ts が書いた名前つきの列を読むので、列を変えたら FEATURE_VERSION を上げる。
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import { effectiveBp, getDefinition, parsePowerCost } from "../core/catalog";
import { strikeDamageFor } from "../rules/combo";
import { opponent } from "../core/helpers";
import { deckProfile } from "./deckProfile";
import { evaluateState } from "./scoring";

export const FEATURE_VERSION = 1;

const PHASES = ["start", "charge", "rush", "battle", "end"] as const;
const SIZES = ["S", "M", "L", "XL", "SC"] as const;
/** 場の枠の数。これより多いユニットは集計の列にだけ入る。 */
const BATTLE_SLOTS = 7;
const RUSH_SLOTS = 5;
/** 必要パワーのヒストグラムの区切り（0,1,…,7,8 以上）。 */
const COST_BINS = 9;

const CLOCK_UP_IDS = new Set(["RK-021", "RK-078"]);

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
  return names;
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
  put(Math.tanh(evaluateState(state, playerId) / 20_000));

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

  if (k !== FEATURE_DIM) throw new Error(`encodeState wrote ${k} of ${FEATURE_DIM} features`);
  return out;
}
