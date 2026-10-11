import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { cardCategories, effectiveBp, getDefinition, parsePowerCost } from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { unitFeatures } from "./addedFeatures";
import { namedTextNegated } from "./legend1/set6NamedEffects348";
import { turnPlayerOf } from "./legend1/set6NamedEffectsB";

/**
 * RS-586 巨神ゴードム【魔神に不足する物】
 * 「これが自軍エリアにある間、自軍ラッシュフェイズ中、自分の手札からDAを持つユニットカードをラッシュするとき、そのパワーを満たすために
 *  次のようにしてもよい⇒必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする。」（atwiki/page-1221）
 * 捨札にするのは場（自軍エリア）の「戦闘員」のユニット（捨札の「戦闘員」のカードはユニットではない）。足りない数ちょうどを捨札にする
 * （効果での撃破ではない）。どのユニットを捨札にするかは、BP の低い順（同じなら自軍ラッシュエリアにあるものから）に選ぶ。
 */
function godomActive(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "rush" || turnPlayerOf(state) !== playerId) return false;
  const player = state.players[playerId];
  return [...player.rush, ...player.battle].some(
    (card) => card.cardId === "RS-586" && !namedTextNegated(state, playerId, card),
  );
}

/** 捨札にできる「戦闘員」のユニット（捨札にする順）。 */
function fieldGrunts(state: GameState, playerId: PlayerId, player: PlayerState): CardInstance[] {
  const withZone = [
    ...player.rush.map((card) => ({ card, zone: 0 })),
    ...player.battle.map((card) => ({ card, zone: 1 })),
  ].filter(({ card }) => {
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit" && unitFeatures(state, playerId, card).includes("戦闘員");
  });
  return withZone
    .sort((a, b) => effectiveBp(state, playerId, a.card) - effectiveBp(state, playerId, b.card) || a.zone - b.zone)
    .map(({ card }) => card);
}

function appliesTo(state: GameState, playerId: PlayerId, unitDefinition: CardDefinition): boolean {
  return unitDefinition.type === "unit" && cardCategories(unitDefinition).includes("DA") && godomActive(state, playerId);
}

/** 旧来の「捨札の戦闘員をパワーに数える」加算は行わない（core/power.ts から呼ぶ。常に 0）。 */
export function godomDiscardPowerBonus(_state: GameState, _playerId: PlayerId): number {
  return 0;
}

export function godomRushPowerBudget(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
): number {
  const budget = countAvailablePower(state, playerId);
  const cost = effectivePowerCost(state, playerId, parsePowerCost(unitDefinition.powerCost));
  if (budget >= cost) return budget;
  if (!appliesTo(state, playerId, unitDefinition)) return budget;
  return budget + fieldGrunts(state, playerId, player).length;
}

/**
 * 足りない必要パワー（shortage）の数だけ「戦闘員」のユニットを捨札にする。足りなければ null。
 * 返り値の covered は補った数（shortage と同じ）。
 */
export function applyGodomSenshoDiscardPay(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
  shortage: number,
): { player: PlayerState; covered: number } | null {
  if (shortage <= 0) return { player, covered: 0 };
  if (!appliesTo(state, playerId, unitDefinition)) return null;
  const grunts = fieldGrunts(state, playerId, player).slice(0, shortage);
  if (grunts.length < shortage) return null;
  const ids = new Set(grunts.map((c) => c.instanceId));
  return {
    player: {
      ...player,
      rush: player.rush.filter((c) => !ids.has(c.instanceId)),
      battle: player.battle.filter((c) => !ids.has(c.instanceId)),
      discard: [...player.discard, ...grunts.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
    },
    covered: shortage,
  };
}
