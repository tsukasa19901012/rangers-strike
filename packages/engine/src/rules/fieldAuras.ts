import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { legend2FieldBpBonus } from "./legend2/fieldEffects";

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function playerHasInRush(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].rush.some((c) => c.cardId === cardId);
}

function playerHasInBattle(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].battle.some((c) => c.cardId === cardId);
}

/** RS-034 / RS-045 / RS-037 passive BP auras. */
export function passiveNamedFieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  const def = state.definitions[instance.cardId];
  if (!def || def.type !== "unit") return 0;

  let bonus = 0;

  if (
    playerHasInBattle(state, playerId, "RS-034") &&
    instance.cardId !== "RS-034" &&
    categoriesInclude(def.category, "WB")
  ) {
    bonus += 2000;
  }

  if (role === "defending" && def.size === "M" && categoriesInclude(def.category, "OT")) {
    if (playerHasInRush(state, playerId, "RS-045")) {
      bonus += 1000;
    }
  }

  if (role === "attacking" && def.size === "M" && categoriesInclude(def.category, "WB")) {
    if (playerHasInRush(state, playerId, "RS-037")) {
      bonus += 1000;
    }
  }

  bonus += legend2FieldBpBonus(state, playerId, instance, role);

  return bonus;
}
