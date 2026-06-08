import type { CardInstance, PlayerState } from "../types/game";
import { emptyTurnModifiers } from "../rules/turnModifiers";

export function clearTurnModifiers(player: PlayerState): PlayerState {
  const clear = (cards: CardInstance[]) =>
    cards.map((card) => {
      if (
        card.bpModifier === undefined &&
        card.spModifier === undefined &&
        card.battleActed === undefined &&
        card.activatedNcEffects === undefined
      ) {
        return card;
      }
      const next = { ...card };
      delete next.bpModifier;
      delete next.spModifier;
      delete next.battleActed;
      delete next.activatedNcEffects;
      return next;
    });

  return {
    ...player,
    hand: clear(player.hand),
    rush: clear(player.rush),
    battle: clear(player.battle),
    turnModifiers: emptyTurnModifiers(),
  };
}

export function findCardInPlayer(
  player: PlayerState,
  instanceId: string,
): { zone: keyof Pick<PlayerState, "hand" | "power" | "rush" | "battle" | "discard" | "operation">; index: number; card: CardInstance } | null {
  const zones: Array<keyof Pick<PlayerState, "hand" | "power" | "rush" | "battle" | "discard" | "operation">> = [
    "hand",
    "power",
    "rush",
    "battle",
    "discard",
    "operation",
  ];

  for (const zone of zones) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) {
      return { zone, index, card: player[zone][index]! };
    }
  }

  return null;
}

export function findOwnUnit(
  player: PlayerState,
  instanceId: string,
): { zone: "rush" | "battle"; index: number; card: CardInstance } | null {
  for (const zone of ["rush", "battle"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}
