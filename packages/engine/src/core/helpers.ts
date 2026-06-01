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
  if (player.deck.length === 0) return player;
  const [drawn, deck] = removeAt(player.deck, 0);
  return {
    ...player,
    deck,
    hand: [...player.hand, drawn],
  };
}

/** Power zone total must meet cost; cards are not removed (official rules). */
export function canAffordPower(player: PlayerState, cost: number): boolean {
  return player.power.length >= cost;
}

/** @deprecated Use canAffordPower — power is a threshold, not consumed. */
export function payPowerCost(
  player: PlayerState,
  cost: number,
): PlayerState | null {
  if (cost <= 0) return player;
  return canAffordPower(player, cost) ? player : null;
}

/** Flip face-up power to face-down, then draw face-down power from deck if needed. */
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
