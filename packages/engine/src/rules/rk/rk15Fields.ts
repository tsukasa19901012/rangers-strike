/**
 * ザ・マスクドライダーEXP vol.4 RK-295〜RK-315 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk15UnitEffects.ts が記録を書く）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る。特徴は呼び出し側から関数で受け取る）。
 *
 * - `rk15FieldBpBonus`: RK-295【頂点に立つ男】（rules/fieldAuras.ts）。
 * - `rk15EffectiveSp`: RK-295【頂点に立つ男】・RK-299【ダークライダーキック】の「SP1」（rules/legend3/fieldEffects.ts）。
 * - `rk15BlocksAttackStrike`: RK-295 の※（1番目でなければアタックもストライクもできない）・RK-302【ワームの頂点に立つ男】（rules/restrictions.ts）。
 * - `rk15DefenderBlocksAttack`: RK-300【クロックアップ】（rules/legend3/restrictions.ts）。
 * - `rk15RequiresBattleEntry`: RK-308 の※（敵軍バトルエリアにユニットがあれば可能なら出る。rules/restrictions.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { battlePositionOneBased } from "../fractionalSp";
import { unitSizeOf } from "../../core/catalog";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";

/** RK-295【頂点に立つ男】の NC が成立した（payload: { instanceId }。このターン）。 */
export const RK15_APEX_RULE = "rk295_apex";
/** RK-299【ダークライダーキック】で敵軍コマンドを3つリリースした（payload: { instanceId }。このターン）。 */
export const RK15_DARK_KICK_RULE = "rk299_dark_rider_kick";
/** RK-311【俺の強さにお前が泣いた】の NC が成立した（payload: { instanceId }。次の相手ターン）。 */
export const RK15_KINTAROS_RULE = "rk311_kintaros_tears";

type FeaturesOf = (state: GameState, playerId: PlayerId, instance: CardInstance) => string[];

function other(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

/** playerId の、このターンの ruleId の記録に instanceId があるか。 */
export function rk15HasTurnInstance(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return getPlayerModifiers(state.players[playerId]).some(
    (m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn" && (m.payload as { instanceId?: string } | undefined)?.instanceId === instanceId,
  );
}

function isUnit(state: Pick<GameState, "definitions">, card: Pick<CardInstance, "cardId">): boolean {
  return state.definitions[card.cardId]?.type === "unit";
}

function isSmall(state: Pick<GameState, "definitions">, card: Pick<CardInstance, "cardId" | "sizeOverride">): boolean {
  return (card.sizeOverride ?? unitSizeOf(state.definitions, card)) === "S";
}

/**
 * RK-295【頂点に立つ男】「このターン、これは自軍パワーゾーンのカード枚数が敵軍パワーゾーンのカード枚数よりも1枚多いごとにBP+1000され、
 * BP5000以上のとき「SP1」になる。」（atwiki/page-1341。CN：1）。NC が成立したターンの間、いまの枚数で数える。
 */
export function rk15FieldBpBonus(state: Pick<GameState, "players">, playerId: PlayerId, instance: CardInstance): number {
  if (!isSameCardIdentity(instance.cardId, "RK-295")) return 0;
  if (!rk15HasTurnInstance(state, playerId, RK15_APEX_RULE, instance.instanceId)) return 0;
  const diff = state.players[playerId].power.length - state.players[other(playerId)].power.length;
  return diff > 0 ? diff * 1000 : 0;
}

/** SP の指定（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。 */
export function rk15EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
): number {
  // RK-295「BP5000以上のとき「SP1」になる」（NC が成立したターンだけ）。
  if (isSameCardIdentity(instance.cardId, "RK-295") && rk15HasTurnInstance(state, playerId, RK15_APEX_RULE, instance.instanceId) && bpOf(state, playerId, instance) >= 5000) {
    sp = Math.max(sp, 1);
  }
  // RK-299「そうしたとき、このターン、これは「SP1」になる。」（atwiki/page-1383）。
  if (isSameCardIdentity(instance.cardId, "RK-299") && rk15HasTurnInstance(state, playerId, RK15_DARK_KICK_RULE, instance.instanceId)) sp = Math.max(sp, 1);
  return sp;
}

/** RK-302 スコルピオワームが playerId の場（バトル・ラッシュ）にあるか。 */
function hasScorpioWorm(state: Pick<GameState, "players">, playerId: PlayerId): boolean {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].some((c) => isSameCardIdentity(c.cardId, "RK-302"));
}

/**
 * アタックもストライクもできない（rules/restrictions.ts cannotAttackOrStrikeThisTurn から呼ぶ）。
 * - RK-295 ※「これはバトルエリアの1番目に並んでいないときアタックもストライクもできない。」（atwiki/page-1341）。並び順はライドしたペアを1つに数える。
 * - RK-302【ワームの頂点に立つ男】「これが自軍エリアにある間、特徴「ワーム」または特徴「怪人」を持つ敵軍ユニットはアタックもストライクも出来ない。」
 *   （atwiki/page-1342）。特徴は今の特徴。
 */
export function rk15BlocksAttackStrike(state: GameState, playerId: PlayerId, unit: CardInstance, featuresOf: FeaturesOf): boolean {
  if (isSameCardIdentity(unit.cardId, "RK-295")) {
    const position = battlePositionOneBased(state.players[playerId].battle, unit.instanceId);
    if (position !== null && position !== 1) return true;
  }
  if (hasScorpioWorm(state, other(playerId)) && isUnit(state, unit)) {
    const features = featuresOf(state, playerId, unit);
    if (features.includes("ワーム") || features.includes("怪人")) return true;
  }
  return false;
}

/**
 * RK-300 カブトエクステンダー【クロックアップ】「これにライドしているユニットは、特徴「加速」を持たないSユニットにアタックされない。」
 * （atwiki/page-1372）。M ユニットはアタックできる（コメント欄）。アタックする側の特徴・サイズは今のもの。
 */
export function rk15DefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
  featuresOf: FeaturesOf,
): boolean {
  if (attackerPlayerId === defenderPlayerId || !defender.mountedOnInstanceId) return false;
  const dp = state.players[defenderPlayerId];
  const vehicle = [...dp.battle, ...dp.rush].find((c) => c.instanceId === defender.mountedOnInstanceId);
  if (!vehicle || !isSameVehicleTextIdentity(vehicle.cardId, "RK-300")) return false;
  if (!isUnit(state, attacker) || !isSmall(state, attacker)) return false;
  return !featuresOf(state, attackerPlayerId, attacker).includes("加速");
}

/**
 * RK-308 リュウタロス（2nd）※「自軍ターン中、これは、敵軍バトルエリアにユニットがあれば、可能ならバトルエリアに出る。」（atwiki/page-1282）。
 */
export function rk15RequiresBattleEntry(state: Pick<GameState, "players" | "definitions" | "activePlayer">, playerId: PlayerId, card: CardInstance): boolean {
  if (!isSameCardIdentity(card.cardId, "RK-308") || state.activePlayer !== playerId) return false;
  return state.players[other(playerId)].battle.some((c) => isUnit(state, c));
}

/** 名前が「ワームサナギ体」のカードか（RK-137「ワームサナギ体」・RK-303「ワームサナギ体」）。 */
export function rk15IsWormPupa(state: Pick<GameState, "definitions">, cardId: string): boolean {
  if (isSameCardIdentity(cardId, "RK-303") || isSameCardIdentity(cardId, "RK-137")) return true;
  const name = state.definitions[cardId]?.name;
  return !!name && name === "ワームサナギ体";
}
