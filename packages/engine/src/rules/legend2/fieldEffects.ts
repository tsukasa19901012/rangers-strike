import {
  findNamedEffectByEffectId,
  playerHasNamedEffectInZones,
} from "@rangers-strike/cards";
import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit, unitBp } from "../../core/catalog";
import {
  battlePositionOneBased,
  printedSpBase,
  resolveInstanceSpValue,
} from "../fractionalSp";
import {
  crossAdjustedBattlePosition,
  taxisSpFloor,
} from "../../keywords/battleKeywords";

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function findControllerOfNamedEffect(
  state: GameState,
  effectId: string,
  zones: Array<"rush" | "battle">,
): { playerId: PlayerId; cardId: string } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of zones) {
      for (const card of player[zone]) {
        if (findNamedEffectByEffectId(card.cardId, effectId)) {
          return { playerId, cardId: card.cardId };
        }
      }
    }
  }
  return null;
}

/** Legend2 フィールド常駐 BP / SP パッシブ。 */
export function legend2FieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit") return 0;

  let bonus = 0;

  if (findNamedEffectByEffectId(instance.cardId, "bio_buster")) {
    const enemyId = playerId === "player1" ? "player2" : "player1";
    const otHeld = state.players[enemyId].command.filter((c) => {
      if (!c.commandHeld) return false;
      const cmdDef = getDefinition(state.definitions, c.cardId);
      return cmdDef && categoriesInclude(cmdDef.category, "OT");
    }).length;
    bonus += otHeld * 1000;
  }

  if (findNamedEffectByEffectId(instance.cardId, "fire_spin_blade")) {
    const released = state.players[playerId].command.filter((c) => !c.commandHeld).length;
    bonus += released * 1000;
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
  const battle = state.players[playerId].battle;
  const battlePosition = crossAdjustedBattlePosition(battle, instance.instanceId)
    ?? battlePositionOneBased(battle, instance.instanceId);
  const printed = resolveInstanceSpValue(def, instance);
  let sp = printedSpBase(printed, battlePosition) + modifier;
  sp = Math.max(sp, taxisSpFloor(state, playerId, instance));

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

  if (
    findNamedEffectByEffectId(instance.cardId, "bio_buster") ||
    findNamedEffectByEffectId(instance.cardId, "fire_spin_blade")
  ) {
    const bp =
      unitBp(def) +
      (instance.bpModifier ?? 0) +
      legend2FieldBpBonus(state, playerId, instance, "general");
    const threshold = findNamedEffectByEffectId(instance.cardId, "fire_spin_blade") ? 10000 : 5000;
    if (bp >= threshold) {
      sp = Math.max(sp, 1);
    }
  }

  return sp;
}

/** RS-089 救護活動: WB Mユニット撃破時、捨札の代わりにパワーへ。 */
export function shouldMedicalRescueToPower(
  state: GameState,
  ownerId: PlayerId,
  cardId: string,
): boolean {
  if (!playerHasNamedEffectInZones(state.players[ownerId], "medical_rescue", ["rush"])) {
    return false;
  }
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.size !== "M") return false;
  return categoriesInclude(def.category, "WB");
}

/** RS-086 交通整理: 戦闘進入時、敵は同じサイズを使わなければならない。 */
export function trafficControlRequiresSameSize(
  state: GameState,
  playerId: PlayerId,
  unitSize: string | undefined,
): boolean {
  const controller = findControllerOfNamedEffect(state, "traffic_control", ["battle"]);
  if (!controller || controller.playerId === playerId) return false;
  const battle = state.players[playerId].battle;
  if (battle.length === 0) return false;
  const firstSize = getDefinition(state.definitions, battle[0]!.cardId)?.size;
  return unitSize !== firstSize;
}

/** RS-097 連獅子: SP1+ または ! の敵ユニットは戦闘進入にホールドが必要。 */
export function karakuriLionChainBlocksEntry(
  state: GameState,
  defenderId: PlayerId,
  unit: CardInstance,
  heldCount: number,
): boolean {
  const controller = findControllerOfNamedEffect(state, "karakuri_lion_chain", ["battle"]);
  if (!controller || controller.playerId === defenderId) return false;

  const def = getDefinition(state.definitions, unit.cardId);
  const hasBang = def?.sp === "special" || def?.features?.includes("!");
  const effectiveSp = legend2EffectiveSp(state, defenderId, unit);
  if (effectiveSp >= 1 || hasBang) {
    return heldCount < 1;
  }
  return false;
}

export function findLegend2NamedEffectOnField(
  state: GameState,
  effectId: string,
  zones: Array<"rush" | "battle"> = ["rush", "battle"],
): { playerId: PlayerId; cardId: string } | null {
  return findControllerOfNamedEffect(state, effectId, zones);
}

export function hasSeabedSurvey(state: GameState, playerId: PlayerId): boolean {
  return playerHasNamedEffectInZones(state.players[playerId], "seabed_survey", ["rush"]);
}

export function hasJaguarMothership(state: GameState, playerId: PlayerId): boolean {
  return playerHasNamedEffectInZones(state.players[playerId], "jaguar_mothership", ["rush"]);
}

export function hasDekabaseMothership(state: GameState, playerId: PlayerId): boolean {
  return playerHasNamedEffectInZones(state.players[playerId], "dekabase_mothership", ["rush"]);
}
