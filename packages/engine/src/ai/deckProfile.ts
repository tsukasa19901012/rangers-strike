// 対戦の始めに自分のデッキの中身から決める、プレイの方針。
// 自分のカード（全ゾーン）は対戦中ずっと同じ顔ぶれなので、定義表（対戦ごとに作られる）ごとに 1 度だけ数える。
import type { GameState, PlayerId } from "../types/game";
import { getDefinition, parsePowerCost } from "../core/catalog";

export type DeckProfile = {
  /** デッキで一番重いユニット・オペレーションの必要パワー。これ以上パワーを溜めても使い道がない。 */
  maxPowerCost: number;
};

const cache = new WeakMap<object, Partial<Record<PlayerId, DeckProfile>>>();

export function deckProfile(state: GameState, playerId: PlayerId): DeckProfile {
  const byPlayer = cache.get(state.definitions) ?? {};
  const cached = byPlayer[playerId];
  if (cached) return cached;
  const p = state.players[playerId];
  let maxPowerCost = 0;
  for (const card of [...p.deck, ...p.hand, ...p.rush, ...p.battle, ...p.power, ...p.command, ...p.operation, ...p.discard]) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || (def.type !== "unit" && def.type !== "operation")) continue;
    maxPowerCost = Math.max(maxPowerCost, parsePowerCost(def.powerCost));
  }
  const profile = { maxPowerCost };
  byPlayer[playerId] = profile;
  cache.set(state.definitions, byPlayer);
  return profile;
}
