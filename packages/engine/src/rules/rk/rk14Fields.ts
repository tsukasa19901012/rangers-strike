/**
 * ザ・マスクドライダーEXP vol.4 RK-274〜RK-294 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk14UnitEffects.ts が記録を書く）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - RK-280 ダークレイダー・RK-281 ドラグランザーの※「自軍エリアでホールド状態かライドされている間、Sビークルとして扱う」:
 *   `rk14ActsAsVehicle`（core/legalActions.ts のライド）・`rk14NeedsEntryHold`（ユニットの間の「ホールドしなければ出られない」。rules/restrictions.ts）・
 *   `rk14CanHoldSelf`（「自軍ラッシュフェイズ中、これをホールドしてもよい」。rules/fieldActivatedAbilities.ts）。
 * - RK-280【疾風断】の特徴の扱いは rules/rk/rk14Features.ts（rules/rk/rk2Features.ts から呼ぶ）。
 * - `rk14GrantsRegister`: RK-278 仮面ライダーナイト（2nd）の※（keywords/registerReaction.ts）。
 * - `rk14EffectiveSp`: RK-281【ドラゴンファイヤーストーム】・RK-282【シザースアタック】・RK-292 の※（rules/legend3/fieldEffects.ts）。
 * - `rk14FieldBpBonus`: RK-288【デルタムーバー】（rules/fieldAuras.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { alignedFractionSp, battlePositionOneBased } from "../fractionalSp";
import { crossReductionFor } from "../../keywords/battleKeywords";
import { unitSizeOf } from "../../core/catalog";

/** RK-288【デルタムーバー】を発動した（payload: { instanceId }。発動したプレイヤーの記録）。 */
export const RK14_DELTA_MOVER_RULE = "rk288_delta_mover";

const VEHICLE_UNIT_IDS = ["RK-280", "RK-281"];

function other(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

function turnRuleCount(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): number {
  return getPlayerModifiers(state.players[playerId]).filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn").length;
}

function nameIs(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  const n = state.definitions[cardId]?.name;
  return !!n && n === name;
}

/** RK-280・RK-281（ホールドするとビークルとして扱うユニット）か。 */
export function rk14IsVehicleUnitCard(cardId: string): boolean {
  return VEHICLE_UNIT_IDS.some((id) => isSameCardIdentity(cardId, id));
}

function riddenIn(player: Pick<PlayerState, "battle" | "rush">, instanceId: string): boolean {
  return [...player.battle, ...player.rush].some((c) => c.mountedOnInstanceId === instanceId && c.instanceId !== instanceId);
}

/** 「自軍エリアでホールド状態かライドされている間、Sビークルとして扱う」（RK-280・RK-281。atwiki/page-1375・page-1367・page-1011 Q1）。 */
export function rk14ActsAsVehicle(player: Pick<PlayerState, "battle" | "rush">, card: Pick<CardInstance, "cardId" | "instanceId" | "commandHeld">): boolean {
  if (!rk14IsVehicleUnitCard(card.cardId)) return false;
  return card.commandHeld === true || riddenIn(player, card.instanceId);
}

/** ユニットの間の「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」（RK-280・RK-281）。 */
export function rk14NeedsEntryHold(state: Pick<GameState, "players">, playerId: PlayerId, unit: Pick<CardInstance, "cardId" | "instanceId" | "commandHeld">): boolean {
  return rk14IsVehicleUnitCard(unit.cardId) && !rk14ActsAsVehicle(state.players[playerId], unit);
}

/** ユニットの間の「自軍ラッシュフェイズ中、これをホールドしてもよい」を使えるか（RK-280・RK-281）。 */
export function rk14CanHoldSelf(state: Pick<GameState, "players">, playerId: PlayerId, card: Pick<CardInstance, "cardId" | "instanceId" | "commandHeld">): boolean {
  return rk14IsVehicleUnitCard(card.cardId) && !rk14ActsAsVehicle(state.players[playerId], card);
}

/** RK-278 仮面ライダーナイト（2nd）の※「これは自軍捨札に特徴「女」を持つユニットカードがあれば次の能力を得る⇒レジスト」（atwiki/page-1382）。 */
export function rk14GrantsRegister(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, cardId: string): boolean {
  if (!isSameCardIdentity(cardId, "RK-278")) return false;
  return state.players[ownerId].discard.some((c) => {
    const d = state.definitions[c.cardId];
    return d?.type === "unit" && (d.features ?? []).includes("女");
  });
}

/**
 * SP の指定（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。
 * - RK-281【ドラゴンファイヤーストーム】「これにライドしている特徴「サバイブ」を持つユニットは「SP1」になる。」（atwiki/page-1367）
 * - RK-282【シザースアタック】「自軍ラッシュエリアに「ボルキャンサー」があれば、このユニットは「SP1/2」になる。」（atwiki/page-1244）。
 *   「1/2」はバトルエリアの2番目にいる間 SP1（docs/rules/05）。ボルキャンサーが自軍ラッシュエリアにある間だけ。
 * - RK-292 の※「これはBP5000以上のとき「SP1」になる。」（atwiki/page-1360）
 */
export function rk14EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
  featuresOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => string[],
): number {
  const player = state.players[playerId];
  if (instance.mountedOnInstanceId) {
    const vehicle = [...player.battle, ...player.rush].find((c) => c.instanceId === instance.mountedOnInstanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-281") && featuresOf(state, playerId, instance).includes("サバイブ")) sp = Math.max(sp, 1);
  }
  if (isSameCardIdentity(instance.cardId, "RK-282") && player.rush.some((c) => nameIs(state, c.cardId, "ボルキャンサー"))) {
    const position = battlePositionOneBased(player.battle, instance.instanceId);
    if (position !== null) sp = Math.max(sp, alignedFractionSp("1/2", position, crossReductionFor(player.battle, instance.instanceId)));
  }
  if (isSameCardIdentity(instance.cardId, "RK-292") && bpOf(state, playerId, instance) >= 5000) sp = Math.max(sp, 1);
  return sp;
}

/** RK-288【デルタムーバー】「このターン、敵軍バトルエリアのすべてのSユニットはBP-500される。」（atwiki/page-1381。rules/fieldAuras.ts から呼ぶ）。 */
export function rk14FieldBpBonus(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instance: CardInstance): number {
  const movers = turnRuleCount(state, other(playerId), RK14_DELTA_MOVER_RULE);
  if (movers === 0) return 0;
  if (!state.players[playerId].battle.some((c) => c.instanceId === instance.instanceId)) return 0;
  const d = state.definitions[instance.cardId];
  if (d?.type !== "unit") return 0;
  if (instance.sizeOverride !== "S" && unitSizeOf(state.definitions, instance) !== "S") return 0;
  return -500 * movers;
}

/**
 * RK-280・RK-281 ※「自軍ラッシュフェイズ中、これをホールドしてもよい」（rules/fieldActivatedAbilities.ts から呼ぶ）。ホールドするとビークルとして扱い、
 * ユニットでなくなるので、これに重ねたカード（RK-250 サバイブ等）は捨札になる（atwiki/page-1375 Q2・page-1367 Q1）。
 */
export function rk14HoldSelf(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const player = state.players[playerId];
  const card = [...player.battle, ...player.rush].find((c) => c.instanceId === instanceId);
  if (!card) return state;
  const stacked = (card.stackedCards ?? []).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }));
  const patch = (c: CardInstance): CardInstance => {
    if (c.instanceId !== instanceId) return c;
    const { stackedCards: _s, ...rest } = c;
    return { ...(rest as CardInstance), commandHeld: true };
  };
  const next: PlayerState = { ...player, battle: player.battle.map(patch), rush: player.rush.map(patch), discard: [...player.discard, ...stacked] };
  return { ...state, players: { ...state.players, [playerId]: next } };
}
