import type { PlayerId, PlayerState } from "../types/game";

export function opponent(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

export function updatePlayer(
  state: { players: Record<PlayerId, PlayerState> },
  playerId: PlayerId,
  player: PlayerState,
): { players: Record<PlayerId, PlayerState> } {
  return {
    players: {
      ...state.players,
      [playerId]: player,
    },
  };
}

export function findInZone(
  player: PlayerState,
  zone: keyof Pick<PlayerState, "hand" | "power" | "command" | "rush" | "battle" | "discard" | "operation">,
  instanceId: string,
) {
  const index = player[zone].findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return null;
  return { index, card: player[zone][index]! };
}

export function removeAt<T>(items: T[], index: number): [T, T[]] {
  const copy = [...items];
  const [removed] = copy.splice(index, 1);
  return [removed!, copy];
}

export function drawOne(player: PlayerState): PlayerState {
  return performDeckDraws(player, 1, "top");
}

/** 山札の上または下から手札へドロー（任意で2枚目の超脳カードを捨てる）。 */
export function performDeckDraws(
  player: PlayerState,
  count: number,
  from: "top" | "bottom",
  superBrainDiscardSecond?: boolean,
): PlayerState {
  let next = player;
  for (let i = 0; i < count; i++) {
    if (next.deck.length === 0) break;
    const index = from === "top" ? 0 : next.deck.length - 1;
    const [drawn, deck] = removeAt(next.deck, index);
    if (superBrainDiscardSecond && i === 1) {
      next = { ...next, deck, discard: [...next.discard, drawn] };
    } else {
      next = { ...next, deck, hand: [...next.hand, drawn] };
    }
  }
  return next;
}

/** パワーゾーン合計がコストを満たす必要あり；カードは除去しない（公式ルール）。 */
export function canAffordPower(player: PlayerState, cost: number): boolean {
  return player.power.length >= cost;
}

/** @deprecated canAffordPower を使用 — パワーは閾値であり消費されない。 */
export function payPowerCost(
  player: PlayerState,
  cost: number,
): PlayerState | null {
  if (cost <= 0) return player;
  return canAffordPower(player, cost) ? player : null;
}

/** 表向きパワーを裏向きにし、必要なら山札から裏向きパワーをドロー。 */
export function applyPlayerDamage(
  player: PlayerState,
  amount: number,
): PlayerState {
  if (amount <= 0) return player;

  let remaining = amount;
  const power = player.power.map((card) => ({ ...card }));
  let deck = [...player.deck];

  for (let i = 0; i < power.length && remaining > 0; i++) {
    const card = power[i]!;
    if (!card.faceDown) {
      power[i] = { ...card, faceDown: true };
      remaining -= 1;
    }
  }

  while (remaining > 0 && deck.length > 0) {
    const [drawn, rest] = removeAt(deck, 0);
    deck = rest;
    power.push({ ...drawn, faceDown: true });
    remaining -= 1;
  }

  return {
    ...player,
    power,
    deck,
    damage: player.damage + amount,
  };
}
