import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit, unitBp } from "../../core/catalog";

function playerHasInRush(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].rush.some((c) => c.cardId === cardId);
}

function playerHasInBattle(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].battle.some((c) => c.cardId === cardId);
}

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

/** Legend2 while_in_field BP / SP passives. */
export function legend2FieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit") return 0;

  let bonus = 0;

  if (playerHasInRush(state, playerId, "RS-079") || playerHasInBattle(state, playerId, "RS-079")) {
    const enemyId = playerId === "player1" ? "player2" : "player1";
    const otHeld = state.players[enemyId].command.filter((c) => {
      if (!c.commandHeld) return false;
      const cmdDef = getDefinition(state.definitions, c.cardId);
      return cmdDef && categoriesInclude(cmdDef.category, "OT");
    }).length;
    if (instance.cardId === "RS-079") {
      bonus += otHeld * 1000;
    }
  }

  if (playerHasInBattle(state, playerId, "RS-113")) {
    if (instance.cardId === "RS-113") {
      const released = state.players[playerId].command.filter((c) => !c.commandHeld).length;
      bonus += released * 1000;
    }
  }

  return bonus;
}

export function legend2EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  const modifier = instance.spModifier ?? 0;
  let sp =
    def?.sp === "special"
      ? modifier
      : typeof def?.sp === "number"
        ? def.sp + modifier
        : modifier;

  /** RS-073 バルシールド: 自軍ダメージ6点で SP2。 */
  if (instance.cardId === "RS-073" && state.players[playerId].damage >= 6) {
    sp = Math.max(sp, 2);
  }

  /** RS-078 闇の舞: 敵にレッドがいれば SP1。 */
  if (instance.cardId === "RS-078") {
    const enemyId = playerId === "player1" ? "player2" : "player1";
    const hasRed = [...state.players[enemyId].rush, ...state.players[enemyId].battle].some(
      (c) => getDefinition(state.definitions, c.cardId)?.features?.includes("レッド"),
    );
    if (hasRed) {
      sp = Math.max(sp, 1);
    }
  }

  if (instance.cardId === "RS-079" || instance.cardId === "RS-113") {
    const bp =
      unitBp(def) +
      (instance.bpModifier ?? 0) +
      legend2FieldBpBonus(state, playerId, instance, "general");
    if (bp >= (instance.cardId === "RS-113" ? 10000 : 5000)) {
      sp = Math.max(sp, 1);
    }
  }

  const shiftUp = state.players[playerId].turnModifiers?.shiftUpSp1InstanceIds ?? [];
  if (shiftUp.includes(instance.instanceId)) {
    sp = Math.max(sp, 1);
  }

  return sp;
}

/** RS-089: WB M units go to power instead of discard when destroyed. */
export function shouldMedicalRescueToPower(
  state: GameState,
  ownerId: PlayerId,
  cardId: string,
): boolean {
  if (!playerHasInRush(state, ownerId, "RS-089")) return false;
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.size !== "M") return false;
  return categoriesInclude(def.category, "WB");
}

/** RS-086: enemy must use same size when entering battle. */
export function trafficControlRequiresSameSize(
  state: GameState,
  playerId: PlayerId,
  unitSize: string | undefined,
): boolean {
  for (const pid of ["player1", "player2"] as const) {
    if (!playerHasInBattle(state, pid, "RS-086")) continue;
    if (pid === playerId) continue;
    const battle = state.players[playerId].battle;
    if (battle.length === 0) return false;
    const firstSize = getDefinition(state.definitions, battle[0]!.cardId)?.size;
    return unitSize !== firstSize;
  }
  return false;
}

/** RS-097: SP1+ or ! enemy units need hold to enter battle. */
export function karakuriLionChainBlocksEntry(
  state: GameState,
  defenderId: PlayerId,
  unit: CardInstance,
  heldCount: number,
): boolean {
  for (const pid of ["player1", "player2"] as const) {
    if (!playerHasInBattle(state, pid, "RS-097")) continue;
    if (pid === defenderId) continue;
    const def = getDefinition(state.definitions, unit.cardId);
    const sp = def?.sp;
    const hasBang = def?.features?.includes("!");
    const mod = unit.spModifier ?? 0;
    const effectiveSp = typeof sp === "number" ? sp + mod : mod;
    if (effectiveSp >= 1 || hasBang) {
      return heldCount < 1;
    }
  }
  return false;
}

export function hasSeabedSurvey(state: GameState, playerId: PlayerId): boolean {
  return playerHasInRush(state, playerId, "RS-122");
}

export function hasJaguarMothership(state: GameState, playerId: PlayerId): boolean {
  return playerHasInRush(state, playerId, "RS-076");
}

export function hasDekabaseMothership(state: GameState, playerId: PlayerId): boolean {
  return playerHasInRush(state, playerId, "RS-105");
}
