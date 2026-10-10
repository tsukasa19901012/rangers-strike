import type { Category } from "@rangers-strike/cards";
import { getCardEffect, winButDestroyedVsSp1 } from "@rangers-strike/cards";
import type {
  CardInstance,
  GameState,
  MutualDestructionMeta,
  PendingBattle,
  PendingLeave,
  PendingRush,
  PendingStrike,
  PlayerId,
  PlayerState,
} from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  allCategoriesExistInCommandZone,
  canPlayOperationExceptCommandHold,
  cardCategories,
  cardName,
  effectiveBp,
  getDefinition,
  hasHeldCommandForCategories,
  hasOperationEffect,
  hasReleasedCommandForCategories,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { countReleasedCommands } from "./restrictions";
import { findInZone, opponent, removeAt, takeFromDeckTop, updatePlayer } from "../core/helpers";
import { emitUnitLeftZoneAndResolve } from "../events/emitUnitLeftZone";
import { resolveDestroyedFactEffects } from "./leaveEffects";
import { isCostWindowSatisfied } from "../core/costWindow";
import { buildLogEntry } from "../log/formatLog";
import { finishBattleEntryIf, restorePhaseActivePlayerUnlessBlocked } from "./battleEntry";
import {
  attackerBlocksDefenderCounters,
  battleAttackerBpBonus,
  battleDefenderBp,
  resolveFocusedBreakthroughDamage,
  unitQualifiesForFocusedBreakthrough,
  resolveBlackCondorDestroyDamage,
  hasBattleNcEffect,
} from "./namedUnitEffects";
import { findCardOwner } from "./fieldLookup";
import { canOfferRegister, toPendingRegister } from "./resist";
import { canStrikeUnit } from "./combo";
import { effectiveRushAdditionalCondition } from "./rushAdditionalCondition";
import { opponentInfiniteChainBlocks } from "./turnModifiers";
import { shouldBattleDestroyToPower } from "./turnModifierBridge";
import { returnFusionPartnersFromDiscard } from "./fusionReturn";
import { resolveLegend3OnBattleWin } from "./legend3/destroyEffects";
import { shouldMedicalRescueToPower } from "./legend2/fieldEffects";
import {
  shouldOfferToPowerOnDestroy,
  startToPowerOnDestroyChoice,
} from "./toPowerOnDestroy";
import { emitBattleDeclaredAndResolve } from "../events/emitBattleDeclared";
import {
  buildPendingChaseFromIntent,
  buildPendingChaseOnVehicleDestroyed,
  canInitiateChase,
  restoreMountedVehicleIfMistakenlyDiscarded,
  sanitizeUnitLeavingField,
} from "../keywords";
import { findFieldInstanceByKeyword } from "../dsl/fieldKeywords";

function findUnitInRushOrBattle(
  player: PlayerState,
  instanceId: string,
): { zone: "rush" | "battle"; index: number; card: CardInstance } | null {
  for (const zone of ["battle", "rush"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}

function markUnitBattleActed(player: PlayerState, instanceId: string): PlayerState {
  for (const zone of ["battle", "rush"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index < 0) continue;
    return {
      ...player,
      [zone]: player[zone].map((c) =>
        c.instanceId === instanceId ? { ...c, battleActed: true } : c,
      ),
    };
  }
  return player;
}
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { registerBattlePendingResolver } from "../events/listeners/battleDeclaredListener";

function isEnemyTurn(state: GameState, counterPlayerId: PlayerId): boolean {
  return state.activePlayer !== counterPlayerId;
}

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function isWildBeastUnit(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!def || def.type !== "unit") return false;
  return categoriesInclude(def.category, "WB");
}

/** 超シールド進化 — WB味方を撃破する代わりにシールドを捨てる。 */
export function findSuperShieldSubstitute(
  state: GameState,
  intent: LeaveIntent,
): string | undefined {
  if (intent.toZone !== "discard") return undefined;
  if (!isWildBeastUnit(state.definitions, intent.leavingCardId)) return undefined;

  return findFieldInstanceByKeyword(
    state,
    intent.ownerPlayerId,
    "substitute_on_wb_destroy",
    ["battle"],
    intent.instanceId,
  );
}

export function applySuperShieldSubstitute(
  state: GameState,
  ownerId: PlayerId,
  shieldInstanceId: string,
): { state: GameState; log: string } {
  const owner = state.players[ownerId];
  const found = findInZone(owner, "battle", shieldInstanceId);
  if (!found) {
    return {
      state,
      log: buildLogEntry(ownerId, "named_effect", "RS-052", state.definitions, "super_shield_failed"),
    };
  }

  const [, battle] = removeAt(owner.battle, found.index);
  const nextOwner = {
    ...owner,
    battle,
    discard: [...owner.discard, found.card],
  };

  return {
    state: { ...state, ...updatePlayer(state, ownerId, nextOwner) },
    log: buildLogEntry(
      ownerId,
      "named_effect",
      found.card.cardId,
      state.definitions,
      "super_shield",
    ),
  };
}

export function isCounterReactionActive(state: GameState): boolean {
  return !!(state.pendingBattle || state.pendingRush || state.pendingLeave || state.pendingMorph);
}

export function isHandCounterCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const found = findInZone(state.players[playerId], "hand", instanceId);
  if (!found) return false;
  return getCardEffect(found.card.cardId)?.kind === "counter";
}

function counterDefinition(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
) {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found) return null;

  const effect = getCardEffect(found.card.cardId);
  if (effect?.kind !== "counter") return null;

  const definition = getDefinition(state.definitions, found.card.cardId);
  if (!definition) return null;

  return { player, found, definition };
}

export function canAffordCounterPower(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  return canPlayOperationExceptCommandHold(state, playerId, ctx.definition);
}

export function canPayCounterCategoryHold(
  player: GameState["players"][PlayerId],
  definitions: GameState["definitions"],
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;
  if (!allCategoriesExistInCommandZone(player, definitions, categories)) return false;
  if (hasReleasedCommandForCategories(player, definitions, categories)) return true;
  return (
    hasOperationEffect(player, "prism_power", definitions) &&
    countReleasedCommands(player) >= 2
  );
}

export function canInitiateCounterCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  if (!isCounterReactionActive(state)) return false;

  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  // ルール: R-CTR-03 — パンサークロー等のアタック処理中は、撃破時のカウンター（ダイノガッツ等）も発動できない。
  if (state.counterLockedPlayerId === playerId) return false;
  if (!canPlayOperationExceptCommandHold(state, playerId, ctx.definition)) {
    return false;
  }

  const categories = cardCategories(ctx.definition);
  if (!canPayCounterCategoryHold(ctx.player, state.definitions, categories)) {
    return false;
  }
  if (isCostWindowSatisfied(ctx.player, "counter_category")) return false;
  if (canExecuteHandCounter(state, playerId, instanceId)) return false;

  return canPayCounterCategoryHold(ctx.player, state.definitions, categories);
}

export function canExecuteHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  if (!canPlayOperationExceptCommandHold(state, playerId, ctx.definition)) {
    return false;
  }

  const categories = cardCategories(ctx.definition);
  if (categories.length === 0) return true;

  return (
    isCostWindowSatisfied(ctx.player, "counter_category") &&
    hasHeldCommandForCategories(ctx.player, state.definitions, categories)
  );
}

/** 反応窓を開くかどうかの判定（窓が未成立でも使用可）。 */
export function canPlayHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  if (!canPlayOperationExceptCommandHold(state, playerId, ctx.definition)) {
    return false;
  }

  const categories = cardCategories(ctx.definition);
  if (categories.length === 0) return true;
  if (canExecuteHandCounter(state, playerId, instanceId)) return true;
  return canPayCounterCategoryHold(ctx.player, state.definitions, categories);
}

function discardHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; cardId: string } | null {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found) return null;

  const [, hand] = removeAt(player.hand, found.index);
  const nextPlayer = {
    ...player,
    hand,
    discard: [...player.discard, found.card],
  };

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    cardId: found.card.cardId,
  };
}

export function hasBattleCounterReactions(
  state: GameState,
  defenderId: PlayerId,
  defenderInstanceId: string,
  attackerPlayerId?: PlayerId,
  attackerInstanceId?: string,
): boolean {
  if (
    attackerPlayerId &&
    attackerInstanceId &&
    attackerBlocksDefenderCounters(state, attackerPlayerId, attackerInstanceId)
  ) {
    return false;
  }

  if (!isEnemyTurn(state, defenderId)) return false;
  if (opponentInfiniteChainBlocks(state, defenderId)) return false;

  const defender = state.players[defenderId];
  // ラッシュエリアのユニットがアタックされたとき（ガオシャーク等）もカウンターを使える（faq-card-1 RS-018 Q10）。
  const defenderCard =
    findInZone(defender, "battle", defenderInstanceId)?.card ??
    findInZone(defender, "rush", defenderInstanceId)?.card;
  if (!defenderCard) return false;

  for (const card of defender.hand) {
    if (!canPlayHandCounter(state, defenderId, card.instanceId)) continue;
    const effectId = getCardEffect(card.cardId)?.effectId;
    if (effectId === "new_gymnastics" && isSmallUnit(state.definitions, defenderCard.cardId)) {
      return true;
    }
    if (effectId === "hidden_ninja") return true;
    if (isMechanicNinjaCounter(card.cardId) && isSmallUnit(state.definitions, defenderCard.cardId)) {
      return true;
    }
  }

  return false;
}

export const INAZUMA_TONFA_CHOICE_EFFECT_ID = "chikara_tonfua_command_to_damage";

/**
 * RS-211 オーブルー【稲妻超力トンファ】（NC）: 自軍ターン中、これがバトルでユニットを撃破したとき、
 * 相手は自分自身のコマンドゾーンからカードを1枚選び、自分自身のパワーゾーンにダメージにして置く。
 * 撃破したユニットの持ち主は問わない（隠流忍術で選ばれた自軍ユニットでもよい。faq-card-1 RS-018 Q4）。
 */
function openInazumaTonfaChoice(
  state: GameState,
  strikerPlayerId: PlayerId,
  strikerInstanceId: string,
): GameState {
  // アタックしたユニット側の処理なので、常に自軍ターン中（アタックするのはターンプレイヤー）。
  const striker = state.players[strikerPlayerId].battle.find((c) => c.instanceId === strikerInstanceId);
  if (!striker || striker.cardId !== "RS-211" || !hasBattleNcEffect(striker, "chikara_tonfua")) return state;
  const enemyId = opponent(strikerPlayerId);
  const commandIds = state.players[enemyId].command.map((c) => c.instanceId);
  if (commandIds.length === 0) return state;
  return {
    ...state,
    pendingEffectChoice: {
      playerId: enemyId,
      effectId: INAZUMA_TONFA_CHOICE_EFFECT_ID,
      sourceCardId: "RS-211",
      sourceInstanceId: strikerInstanceId,
      kind: "select_command",
      phasePlayerId: strikerPlayerId,
      validInstanceIds: commandIds,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
    },
    activePlayer: enemyId,
  };
}

/** RK-008 メカニック忍者（自軍Sユニットがアタックされたときのカウンター）。 */
export function isMechanicNinjaCounter(cardId: string): boolean {
  return cardId === "RK-008";
}

/** RK-008: 自軍コマンドゾーンの、追加条件を持たない特徴「改造人間」の S ユニットのカード。 */
export function collectMechanicNinjaRecruits(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => {
      const def = state.definitions[c.cardId];
      if (!def || def.type !== "unit") return false;
      if (!isSmallUnit(state.definitions, c.cardId)) return false;
      if (!(def.features ?? []).includes("改造人間")) return false;
      return !effectiveRushAdditionalCondition(state, playerId, c.cardId, def);
    })
    .map((c) => c.instanceId);
}

/**
 * RK-008 メカニック忍者: 改造人間の S ユニットのカードをコマンドゾーンからラッシュエリアに出し、
 * その後アタックされたユニットをコマンドゾーンにホールド状態で置く（このときバトルは行われない）。
 * ルール: R-ZONE-08 — コマンドゾーンが5枚で置けないときはその場に留まり、バトルは通常通り行う。
 */
export function applyMechanicNinjaCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  recruitInstanceId: string | undefined,
  pending: PendingBattle,
): { state: GameState; log: string; battleCancelled: boolean } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(defenderId, "play_counter", "RK-008", state.definitions, "failed"),
      battleCancelled: false,
    };
  }
  let nextState = discarded.state;
  let defender = nextState.players[defenderId];
  if (recruitInstanceId && collectMechanicNinjaRecruits(nextState, defenderId).includes(recruitInstanceId)) {
    const found = findInZone(defender, "command", recruitInstanceId);
    if (found) {
      const [, command] = removeAt(defender.command, found.index);
      const recruit = { ...found.card };
      delete recruit.commandHeld;
      defender = { ...defender, command, rush: [...defender.rush, recruit] };
    }
  }
  let battleCancelled = false;
  const attacked = findInZone(defender, "battle", pending.defenderInstanceId);
  if (attacked && defender.command.length < COMMAND_ZONE_MAX) {
    const [, battle] = removeAt(defender.battle, attacked.index);
    defender = {
      ...defender,
      battle,
      command: [...defender.command, { instanceId: attacked.card.instanceId, cardId: attacked.card.cardId, commandHeld: true }],
    };
    battleCancelled = true;
  }
  nextState = { ...nextState, ...updatePlayer(nextState, defenderId, defender) };
  return {
    state: nextState,
    log: buildLogEntry(
      defenderId,
      "play_counter",
      "RK-008",
      nextState.definitions,
      battleCancelled ? "mechanic_ninja" : "mechanic_ninja:stay",
    ),
    battleCancelled,
  };
}

export function hasRushCounterReactions(
  state: GameState,
  defenderId: PlayerId,
  rushedInstanceId: string,
  rusherId: PlayerId,
): boolean {
  if (!isEnemyTurn(state, defenderId)) return false;
  if (opponentInfiniteChainBlocks(state, defenderId)) return false;

  const rusher = state.players[rusherId];
  const rushed = findInZone(rusher, "rush", rushedInstanceId)?.card;
  if (!rushed) return false;
  if (effectiveBp(state, rusherId, rushed) > 8000) return false;

  const defender = state.players[defenderId];
  for (const card of defender.hand) {
    if (card.cardId !== "RS-026") continue;
    if (canPlayHandCounter(state, defenderId, card.instanceId)) return true;
  }

  return false;
}

export function canPlayDinoGutsLeaveCounter(
  state: GameState,
  ownerId: PlayerId,
  _leavingCardId: string,
  counterInstanceId: string,
  options?: { requireEnemyTurn?: boolean },
): boolean {
  if (options?.requireEnemyTurn !== false && !isEnemyTurn(state, ownerId)) return false;

  const found = findInZone(state.players[ownerId], "hand", counterInstanceId);
  if (!found || found.card.cardId !== "RS-027") return false;
  if (!canPlayHandCounter(state, ownerId, counterInstanceId)) return false;

  // ルール: R-WIN-04 — ダイノガッツは山札が足りなくても使える（途中でひけなければ敗北。公式FAQ RS-027）。
  return true;
}

export function hasPlayableDinoChronicleCounter(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  options?: { requireEnemyTurn?: boolean },
): boolean {
  if (options?.requireEnemyTurn !== false && !isEnemyTurn(state, ownerId)) return false;

  const owner = state.players[ownerId];
  const sameNameInDiscard = owner.discard.some(
    (c) => cardName(state.definitions, c.cardId) === cardName(state.definitions, leavingCardId),
  );
  if (!sameNameInDiscard) return false;

  for (const card of owner.hand) {
    if (card.cardId !== "RS-016") continue;
    if (canPlayHandCounter(state, ownerId, card.instanceId)) return true;
  }

  return false;
}

export function hasDinoChronicleLeaveReaction(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
): boolean {
  return hasPlayableDinoChronicleCounter(state, ownerId, leavingCardId);
}

export function hasDinoGutsLeaveReaction(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
): boolean {
  const owner = state.players[ownerId];
  for (const card of owner.hand) {
    if (card.cardId !== "RS-027") continue;
    if (canPlayDinoGutsLeaveCounter(state, ownerId, leavingCardId, card.instanceId)) {
      return true;
    }
  }
  return false;
}

/** @deprecated hasDinoChronicleLeaveReaction を使用 */
export function hasLeaveCounterReactions(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
): boolean {
  return hasDinoChronicleLeaveReaction(state, ownerId, leavingCardId);
}

/** XG3-055 (セイガエル): own S-unit with BP≤3000 destroyed in battle → return to hand. */
export function canPlaySageAelLeaveCounter(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  fromZone: "rush" | "battle",
  counterInstanceId: string,
): boolean {
  if (fromZone !== "battle") return false;
  if (!isSmallUnit(state.definitions, leavingCardId)) return false;
  const found = findInZone(state.players[ownerId], "hand", counterInstanceId);
  if (!found || found.card.cardId !== "XG3-055") return false;
  if (!canPlayHandCounter(state, ownerId, counterInstanceId)) return false;
  const leavingDef = getDefinition(state.definitions, leavingCardId);
  const rawBp = typeof leavingDef?.bp === "number" ? leavingDef.bp : 0;
  return rawBp <= 3000;
}

export function hasSageAelLeaveReaction(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  fromZone: "rush" | "battle",
): boolean {
  const owner = state.players[ownerId];
  for (const card of owner.hand) {
    if (card.cardId !== "XG3-055") continue;
    if (canPlaySageAelLeaveCounter(state, ownerId, leavingCardId, fromZone, card.instanceId)) {
      return true;
    }
  }
  return false;
}

export function applySageAelCounter(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
  pending: PendingLeave,
): { state: GameState; log: string; prevented: boolean } {
  const discarded = discardHandCounter(state, playerId, counterInstanceId);
  if (!discarded) {
    return { state, log: buildLogEntry(playerId, "play_counter", "XG3-055", state.definitions, "failed"), prevented: false };
  }
  let nextState = discarded.state;
  const player = nextState.players[pending.ownerPlayerId];
  const found = findInZone(player, pending.fromZone, pending.instanceId);
  if (!found) {
    return { state: nextState, log: buildLogEntry(playerId, "play_counter", "XG3-055", nextState.definitions, "failed"), prevented: false };
  }
  const [, zone] = removeAt(player[pending.fromZone], found.index);
  const nextPlayer = {
    ...player,
    [pending.fromZone]: zone,
    hand: [...player.hand, found.card],
  };
  nextState = { ...nextState, ...updatePlayer(nextState, pending.ownerPlayerId, nextPlayer) };
  return { state: nextState, log: buildLogEntry(playerId, "play_counter", "XG3-055", nextState.definitions, "sage_ael"), prevented: true };
}

/** XG5-083 (マグロード): own S-unit destroyed in battle → put in command held (or hand). */
export function canPlayMagLoadLeaveCounter(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  fromZone: "rush" | "battle",
  counterInstanceId: string,
): boolean {
  if (fromZone !== "battle") return false;
  if (!isSmallUnit(state.definitions, leavingCardId)) return false;
  const found = findInZone(state.players[ownerId], "hand", counterInstanceId);
  if (!found || found.card.cardId !== "XG5-083") return false;
  return canPlayHandCounter(state, ownerId, counterInstanceId);
}

export function hasMagLoadLeaveReaction(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  fromZone: "rush" | "battle",
): boolean {
  const owner = state.players[ownerId];
  for (const card of owner.hand) {
    if (card.cardId !== "XG5-083") continue;
    if (canPlayMagLoadLeaveCounter(state, ownerId, leavingCardId, fromZone, card.instanceId)) {
      return true;
    }
  }
  return false;
}

export function applyMagLoadCounter(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
  pending: PendingLeave,
): { state: GameState; log: string; prevented: boolean } {
  const discarded = discardHandCounter(state, playerId, counterInstanceId);
  if (!discarded) {
    return { state, log: buildLogEntry(playerId, "play_counter", "XG5-083", state.definitions, "failed"), prevented: false };
  }
  let nextState = discarded.state;
  const player = nextState.players[pending.ownerPlayerId];
  const found = findInZone(player, pending.fromZone, pending.instanceId);
  if (!found) {
    return { state: nextState, log: buildLogEntry(playerId, "play_counter", "XG5-083", nextState.definitions, "failed"), prevented: false };
  }
  const [, zone] = removeAt(player[pending.fromZone], found.index);
  const canAddToCommand = player.command.length < COMMAND_ZONE_MAX;
  const nextPlayer = canAddToCommand
    ? { ...player, [pending.fromZone]: zone, command: [...player.command, { ...found.card, commandHeld: true }] }
    : { ...player, [pending.fromZone]: zone, hand: [...player.hand, found.card] };
  nextState = { ...nextState, ...updatePlayer(nextState, pending.ownerPlayerId, nextPlayer) };
  return { state: nextState, log: buildLogEntry(playerId, "play_counter", "XG5-083", nextState.definitions, "mag_load"), prevented: true };
}

export function collectHiddenNinjaSubstitutes(
  state: GameState,
  excludeInstanceIds: string[],
): Array<{ playerId: PlayerId; instanceId: string }> {
  const excluded = new Set(excludeInstanceIds);
  const results: Array<{ playerId: PlayerId; instanceId: string }> = [];
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const card of [...player.rush, ...player.battle]) {
      if (excluded.has(card.instanceId)) continue;
      results.push({ playerId: pid, instanceId: card.instanceId });
    }
  }
  return results;
}

export function applyNewGymnasticsCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  pending: PendingBattle,
): { state: GameState; log: string } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(defenderId, "play_counter", "RS-006", state.definitions, "failed"),
    };
  }

  let nextState = discarded.state;
  const defender = nextState.players[defenderId];
  const found = findInZone(defender, "battle", pending.defenderInstanceId);
  if (!found || !isSmallUnit(nextState.definitions, found.card.cardId)) {
    return {
      state: nextState,
      log: buildLogEntry(defenderId, "play_counter", "RS-006", state.definitions, "failed"),
    };
  }

  const [, battle] = removeAt(defender.battle, found.index);
  const nextDefender = {
    ...defender,
    battle,
    rush: [...defender.rush, found.card],
  };

  nextState = {
    ...nextState,
    ...updatePlayer(nextState, defenderId, nextDefender),
  };

  return {
    state: nextState,
    log: buildLogEntry(defenderId, "play_counter", "RS-006", state.definitions, "new_gymnastics"),
  };
}

export function applyHiddenNinjaCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  substituteInstanceId: string,
  pending: PendingBattle,
): { state: GameState; pending: PendingBattle; log: string } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      pending,
      log: buildLogEntry(defenderId, "play_counter", "RS-018", state.definitions, "failed"),
    };
  }

  const located = findCardOwner(discarded.state, substituteInstanceId);
  if (!located) {
    return {
      state: discarded.state,
      pending,
      log: buildLogEntry(defenderId, "play_counter", "RS-018", state.definitions, "failed"),
    };
  }

  return {
    state: discarded.state,
    pending: { ...pending, substituteInstanceId },
    log: buildLogEntry(
      defenderId,
      "play_counter",
      "RS-018",
      discarded.state.definitions,
      substituteInstanceId,
    ),
  };
}

export function applyShippuNinjaCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  pending: PendingRush,
): { state: GameState; log: string } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(defenderId, "play_counter", "RS-026", state.definitions, "failed"),
    };
  }

  const rusher = discarded.state.players[pending.rusherPlayerId];
  const found = findInZone(rusher, "rush", pending.rushedInstanceId);
  if (!found) {
    return {
      state: discarded.state,
      log: buildLogEntry(defenderId, "play_counter", "RS-026", state.definitions, "failed"),
    };
  }

  const [, rush] = removeAt(rusher.rush, found.index);
  const nextRusher = {
    ...rusher,
    rush,
    deck: [{ ...found.card, faceDown: true }, ...rusher.deck],
  };

  return {
    state: {
      ...discarded.state,
      ...updatePlayer(discarded.state, pending.rusherPlayerId, nextRusher),
    },
    log: buildLogEntry(defenderId, "play_counter", "RS-026", state.definitions, "shippu_ninja"),
  };
}

export function applyDinoGutsCounter(
  state: GameState,
  ownerId: PlayerId,
  counterInstanceId: string,
  leavingCardId: string,
): { state: GameState; log: string; prevented: boolean } {
  const discarded = discardHandCounter(state, ownerId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(ownerId, "play_counter", "RS-027", state.definitions, "failed"),
      prevented: false,
    };
  }

  const leavingDef = getDefinition(discarded.state.definitions, leavingCardId);
  const drawCost = parsePowerCost(leavingDef?.powerCost ?? 0);
  const owner = discarded.state.players[ownerId];
  // ルール: R-START-05, R-WIN-03 — ひくべきときにひけなければ敗北（公式FAQ RS-027 Q4）。
  const { player: afterTake, taken: drawn } = takeFromDeckTop(owner, drawCost);
  const nextOwner = {
    ...afterTake,
    discard: [...afterTake.discard, ...drawn],
  };

  return {
    state: { ...discarded.state, ...updatePlayer(discarded.state, ownerId, nextOwner) },
    log: buildLogEntry(
      ownerId,
      "play_counter",
      "RS-027",
      discarded.state.definitions,
      `dino_guts:${drawCost}`,
    ),
    prevented: true,
  };
}

export function applyDinoChronicleCounter(
  state: GameState,
  ownerId: PlayerId,
  counterInstanceId: string,
): { state: GameState; log: string; prevented: boolean } {
  const discarded = discardHandCounter(state, ownerId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(ownerId, "play_counter", "RS-016", state.definitions, "failed"),
      prevented: false,
    };
  }

  return {
    state: discarded.state,
    log: buildLogEntry(ownerId, "play_counter", "RS-016", state.definitions, "dino_chronicle"),
    prevented: true,
  };
}

type MutualDestructionContext = MutualDestructionMeta;

/**
 * ルール: R-BTL-02, R-SIM-01 — 相打ちで撃破された 2 体を、firstInstanceId のユニットから順に処理する。
 * 守り側を撃破したことによる攻撃側の効果（一点突破・ブラックコンドル）は処理順に依存しない。
 */
export function processMutualDestruction(
  state: GameState,
  ctx: MutualDestructionContext,
  firstInstanceId: string,
): { state: GameState; deferred: boolean } {
  const defenderFirst = firstInstanceId !== ctx.attackerInstanceId;
  const [first, second] = defenderFirst
    ? [ctx.defenderIntent, ctx.attackerIntent]
    : [ctx.attackerIntent, ctx.defenderIntent];
  const applyDefenderDestroyedEffects = (base: GameState): GameState => {
    let next = base;
    if (ctx.attackerCardId === "RS-065") {
      const fb = resolveFocusedBreakthroughDamage(
        next,
        ctx.attackerPlayerId,
        ctx.attackerInstanceId,
        ctx.defenderOwner,
        ctx.defenderCard,
        ctx.focusedBreakthroughQualifies,
      );
      next = { ...fb.state, log: [...fb.state.log, ...fb.logs] };
    }
    if (ctx.attackerCardId === "RS-685") {
      const bc = resolveBlackCondorDestroyDamage(
        next,
        ctx.attackerPlayerId,
        ctx.attackerInstanceId,
        ctx.defenderOwner,
        ctx.defenderCard,
      );
      next = { ...bc.state, log: [...bc.state.log, ...bc.logs] };
    }
    return next;
  };

  // 攻撃側が守り側を撃破した事実（R-BTL-02「互いに相手を撃破したことになる」）による効果は、
  // 攻撃側がまだ並びにある時点で処理順に関係なく解決する。
  const withDestroyFx = applyDefenderDestroyedEffects(state);
  const r1 = tryLeaveField(withDestroyFx, { ...first, followUpAttackerLeave: second });
  if (r1.deferred) return r1;
  const r2 = tryLeaveField(r1.state, second);
  if (r2.deferred) return r2;
  return { state: r2.state, deferred: false };
}

function zoneFingerprint(state: GameState): string {
  const zones = ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation"] as const;
  const parts: string[] = [String(state.winner)];
  for (const playerId of Object.keys(state.players).sort() as PlayerId[]) {
    const player = state.players[playerId];
    parts.push(`${playerId}:dmg=${player.damage}`);
    for (const zone of zones) {
      const cards = (player[zone] ?? []) as CardInstance[];
      parts.push(`${playerId}.${zone}=${cards.map((c) => `${c.instanceId}${c.faceDown ? "~" : ""}`).sort().join(",")}`);
    }
  }
  return parts.join("|");
}

/**
 * 相打ちの処理順で結果（各カードの置き場・ダメージ・勝敗）が変わるか。
 * どちらかの順で離場の対応（反応窓・選択）が挟まる場合は、従来どおり守り側から処理する。
 */
function mutualDestructionOrderMatters(state: GameState, ctx: MutualDestructionContext): boolean {
  const defenderFirst = processMutualDestruction(state, ctx, ctx.defenderIntent.instanceId);
  const attackerFirst = processMutualDestruction(state, ctx, ctx.attackerInstanceId);
  if (defenderFirst.deferred || attackerFirst.deferred) return false;
  return zoneFingerprint(defenderFirst.state) !== zoneFingerprint(attackerFirst.state);
}

/** Event Listener から呼ばれるバトル解決の実装本体。 */
export function resolveBattlePendingCore(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  const finish = (nextState: GameState, log: string) => {
    let resolved = nextState;
    if (pending.mirageBeamDiscard) {
      const player = resolved.players[pending.attackerPlayerId];
      resolved = {
        ...resolved,
        ...updatePlayer(resolved, pending.attackerPlayerId, {
          ...player,
          discard: [...player.discard, pending.mirageBeamDiscard],
        }),
      };
    }
    return {
      state: finishBattleEntryIf(
        restorePhaseActivePlayerUnlessBlocked(
          { ...resolved, pendingBattle: undefined },
          pending.phasePlayerId,
        ),
        pending.attackerInstanceId,
      ),
      log,
    };
  };

  if (pending.battleCancelled) {
    const attacker = state.players[pending.attackerPlayerId];
    const nextAttacker = markUnitBattleActed(attacker, pending.attackerInstanceId);
    return finish(
      {
        ...state,
        ...updatePlayer(state, pending.attackerPlayerId, nextAttacker),
      },
      buildLogEntry(
        pending.attackerPlayerId,
        "battle",
        pending.attackerInstanceId,
        state.definitions,
        "cancelled",
      ),
    );
  }

  const attackerId = pending.attackerPlayerId;
  const defenderId = pending.defenderPlayerId;
  let battleState = state;
  const attacker = battleState.players[attackerId];
  const defenderInstanceId = pending.substituteInstanceId ?? pending.defenderInstanceId;

  let defenderOwner = defenderId;
  let defenderZone: "rush" | "battle" = "battle";
  if (pending.substituteInstanceId) {
    const located = findCardOwner(battleState, pending.substituteInstanceId);
    if (located) {
      defenderOwner = located.playerId;
      defenderZone = located.zone;
    }
  } else if (
    findInZone(battleState.players[defenderId], "rush", pending.defenderInstanceId)
  ) {
    defenderZone = "rush";
  }

  const defenderPlayer = battleState.players[defenderOwner];
  const attackerFound =
    findInZone(attacker, "battle", pending.attackerInstanceId) ??
    findInZone(attacker, "rush", pending.attackerInstanceId);
  const defenderFound = findInZone(defenderPlayer, defenderZone, defenderInstanceId);

  if (attackerFound) {
    battleState = tryResolveDslTriggeredEffects({
      state: battleState,
      cardId: attackerFound.card.cardId,
      instanceId: pending.attackerInstanceId,
      playerId: attackerId,
      phasePlayerId: pending.phasePlayerId,
      triggerType: "on_attack",
    }).state;
  }

  const refreshedAttacker = battleState.players[attackerId];
  const refreshedAttackerFound = findUnitInRushOrBattle(
    refreshedAttacker,
    pending.attackerInstanceId,
  );
  const refreshedDefenderPlayer = battleState.players[defenderOwner];
  const refreshedDefenderFound = findInZone(
    refreshedDefenderPlayer,
    defenderZone,
    defenderInstanceId,
  );

  if (!refreshedAttackerFound || !refreshedDefenderFound) {
    const markAttackerActedOnFail = (base: GameState): GameState => {
      if (!refreshedAttackerFound) return base;
      const currentAttacker = base.players[attackerId];
      return {
        ...base,
        ...updatePlayer(base, attackerId, markUnitBattleActed(
          currentAttacker,
          pending.attackerInstanceId,
        )),
      };
    };
    const logCardId = refreshedAttackerFound?.card.cardId ?? pending.attackerInstanceId;
    return finish(
      markAttackerActedOnFail({ ...battleState }),
      buildLogEntry(attackerId, "battle", logCardId, battleState.definitions, "failed"),
    );
  }

  const attackerBp = battleAttackerBpBonus(battleState, pending);
  const defenderBp = battleDefenderBp(battleState, pending);

  const destroyAttacker = attackerBp <= defenderBp;
  const destroyDefender = defenderBp <= attackerBp;

  const winButSelfDestruct =
    !destroyAttacker &&
    destroyDefender &&
    battleState.activePlayer !== attackerId &&
    winButDestroyedVsSp1(refreshedAttackerFound.card.cardId) &&
    canStrikeUnit(battleState.definitions, refreshedDefenderFound.card, battleState, defenderOwner);

  const winButDefenderSelfDestruct =
    destroyAttacker &&
    !destroyDefender &&
    battleState.activePlayer !== defenderOwner &&
    winButDestroyedVsSp1(refreshedDefenderFound.card.cardId) &&
    canStrikeUnit(
      battleState.definitions,
      refreshedAttackerFound.card,
      battleState,
      attackerId,
    );

  const finalDestroyDefender = destroyDefender || winButDefenderSelfDestruct;

  // XG2-086: during enemy turn (attacker's turn), units that win are also destroyed
  // XG3-087: same but only for S-units
  const defenderCausesWinnerDestruction =
    !destroyAttacker &&
    destroyDefender &&
    battleState.activePlayer === attackerId &&
    (() => {
      const defCardId = refreshedDefenderFound.card.cardId;
      if (defCardId === "XG2-086") return true;
      if (defCardId === "XG3-087") return isSmallUnit(battleState.definitions, refreshedAttackerFound.card.cardId);
      return false;
    })();

  const finalDestroyAttacker = destroyAttacker || winButSelfDestruct || defenderCausesWinnerDestruction;
  const detail = `${cardName(battleState.definitions, refreshedDefenderFound.card.cardId)}:${attackerBp}vs${defenderBp}`;
  const log = buildLogEntry(
    attackerId,
    "battle",
    refreshedAttackerFound.card.cardId,
    battleState.definitions,
    detail,
  );

  const markAttackerActed = (base: GameState): GameState => {
    const currentAttacker = base.players[attackerId];
    return {
      ...base,
      ...updatePlayer(base, attackerId, markUnitBattleActed(
        currentAttacker,
        pending.attackerInstanceId,
      )),
    };
  };

  const attackerZone = refreshedAttackerFound.zone;
  const defenderLeaveZone = shouldBattleDestroyToPower(
    battleState,
    pending,
    defenderInstanceId,
  )
    ? "power"
    : "discard";
  const attackerLeaveZone = shouldBattleDestroyToPower(
    battleState,
    pending,
    pending.attackerInstanceId,
  )
    ? "power"
    : "discard";
  const attackerLeaveIntent: LeaveIntent = {
    ownerPlayerId: attackerId,
    instanceId: pending.attackerInstanceId,
    fromZone: attackerZone,
    toZone: attackerLeaveZone,
    leavingCardId: refreshedAttackerFound.card.cardId,
    phasePlayerId: pending.phasePlayerId,
    // ルール: R-KW-RESIST-03 — 「バトルに勝っても撃破される」効果での撃破はレジスト不可。
    registerEligible:
      finalDestroyAttacker &&
      !winButSelfDestruct &&
      !defenderCausesWinnerDestruction &&
      attackerZone === "battle",
  };

  let nextState = battleState;
  let extraLogs: string[] = [];
  // ルール: R-ERR-RS065 — 分数SPは並びにある間の値で判定する（撃破されて並びから外れる前に判定）。
  const focusedBreakthroughQualifies =
    refreshedAttackerFound.card.cardId === "RS-065" &&
    unitQualifiesForFocusedBreakthrough(battleState, defenderOwner, refreshedDefenderFound.card);

  const defenderLeaveIntent: LeaveIntent = {
    ownerPlayerId: defenderOwner,
    instanceId: defenderInstanceId,
    fromZone: defenderZone,
    toZone: defenderLeaveZone,
    leavingCardId: refreshedDefenderFound.card.cardId,
    phasePlayerId: pending.phasePlayerId,
    // ルール: R-KW-RESIST-03 — 防御側も「勝っても撃破」で倒された場合はレジスト不可（BP で負けたときだけ可）。
    registerEligible: destroyDefender && !winButDefenderSelfDestruct && defenderZone === "battle",
  };

  if (finalDestroyDefender && finalDestroyAttacker) {
    // ルール: R-BTL-02, R-SIM-01 — 相打ちの 2 体は同時に撃破された扱い。その後の処理順は
    // ターンプレイヤーが決める。順番で結果が変わるときだけ選択を開く（例: プテラノドンと
    // レスキューファイター。faq-card-1 RS-018 Q12）。
    const ctx: MutualDestructionContext = {
      attackerPlayerId: attackerId,
      attackerInstanceId: pending.attackerInstanceId,
      attackerCardId: refreshedAttackerFound.card.cardId,
      defenderOwner,
      defenderCard: refreshedDefenderFound.card,
      defenderIntent: defenderLeaveIntent,
      attackerIntent: attackerLeaveIntent,
      focusedBreakthroughQualifies,
    };
    const chooser = pending.phasePlayerId;
    if (mutualDestructionOrderMatters(nextState, ctx)) {
      const withChoice: GameState = {
        ...nextState,
        pendingEffectChoice: {
          playerId: chooser,
          effectId: "simultaneous_order",
          sourceCardId: "engine",
          kind: "simultaneous_order",
          phasePlayerId: chooser,
          validInstanceIds: [defenderInstanceId, pending.attackerInstanceId],
          selectedInstanceIds: [],
          optional: false,
          mutualDestructionMeta: ctx,
        },
        activePlayer: chooser,
      };
      return finish(withChoice, log);
    }
    const processed = processMutualDestruction(nextState, ctx, defenderInstanceId);
    return finish(processed.state, log);
  }

  if (finalDestroyDefender) {
    const leaveResult = tryLeaveField(nextState, defenderLeaveIntent);
    if (leaveResult.deferred) {
      const withAttacker = finalDestroyAttacker ? leaveResult.state : markAttackerActed(leaveResult.state);
      return finish(withAttacker, log);
    }
    nextState = leaveResult.state;

    if (refreshedAttackerFound.card.cardId === "RS-065") {
      const fb = resolveFocusedBreakthroughDamage(
        nextState,
        attackerId,
        pending.attackerInstanceId,
        defenderOwner,
        refreshedDefenderFound.card,
        focusedBreakthroughQualifies,
      );
      nextState = fb.state;
      extraLogs = fb.logs;
    }
    nextState = openInazumaTonfaChoice(nextState, attackerId, pending.attackerInstanceId);
    if (refreshedAttackerFound.card.cardId === "RS-685") {
      const bc = resolveBlackCondorDestroyDamage(
        nextState,
        attackerId,
        pending.attackerInstanceId,
        defenderOwner,
        refreshedDefenderFound.card,
      );
      nextState = bc.state;
      extraLogs = [...extraLogs, ...bc.logs];
    }
  }

  if (finalDestroyAttacker) {
    const leaveResult = tryLeaveField(nextState, attackerLeaveIntent);
    if (leaveResult.deferred) {
      return finish(leaveResult.state, log);
    }
    nextState = leaveResult.state;
  } else if (destroyDefender) {
    const winFx = resolveLegend3OnBattleWin(
      nextState,
      pending,
      refreshedDefenderFound.card,
      defenderOwner,
    );
    nextState = {
      ...winFx.state,
      log: [...nextState.log, ...winFx.logs, ...extraLogs],
    };
    extraLogs = [];
    if (!winFx.skipMarkAttackerActed) {
      nextState = markAttackerActed(nextState);
    }
  } else {
    nextState = markAttackerActed(nextState);
  }

  let finishedState: GameState = {
    ...nextState,
    log: [...nextState.log, ...extraLogs],
  };
  return finish(finishedState, log);
}

registerBattlePendingResolver(resolveBattlePendingCore);

/** `BattleDeclared` イベント経由でバトルを解決する（後方互換 API）。 */
export function resolveBattlePending(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  return emitBattleDeclaredAndResolve(state, pending);
}

export function finalizeBattlePending(
  state: GameState,
  pending: PendingBattle,
): GameState {
  return resolveBattlePending(state, pending).state;
}

export function finalizeRushPending(state: GameState, pending: PendingRush): GameState {
  return {
    ...state,
    pendingRush: undefined,
    activePlayer: pending.phasePlayerId,
  };
}

/**
 * この離場が撃破によるものか。
 * ルール: R-DESTROY-01 — 離場パイプラインで捨札へ送るのは撃破。バトルの BP 比較による撃破
 * （registerEligible）は置き先がパワーゾーンでも撃破。効果でパワー／コマンドゾーンに置くのは撃破ではない。
 */
export function isDestructionLeave(
  pending: Pick<PendingLeave, "toZone" | "registerEligible">,
): boolean {
  return pending.toZone === "discard" || pending.registerEligible === true;
}

export function finalizeLeavePending(
  state: GameState,
  pending: PendingLeave,
  prevented: boolean,
): GameState {
  if (prevented) {
    const base: GameState = {
      ...state,
      pendingLeave: undefined,
      activePlayer: pending.phasePlayerId,
    };
    // ルール: R-DESTROY-02 — 置換・カウンターで場に留まっても「撃破された」事実は残り、
    // 「撃破されたとき」の効果は発動する（「撃破されて捨札になったとき」は発動しない）。
    if (!isDestructionLeave(pending)) return base;
    const fact = resolveDestroyedFactEffects(base, pending.ownerPlayerId, pending.leavingCardId);
    return fact.logs.length > 0 ? { ...fact.state, log: [...fact.state.log, ...fact.logs] } : fact.state;
  }

  if (canOfferRegister(state, pending)) {
    return {
      ...state,
      pendingRegister: toPendingRegister(pending),
      activePlayer: pending.ownerPlayerId,
    };
  }

  const owner = state.players[pending.ownerPlayerId];
  const found = findInZone(owner, pending.fromZone, pending.instanceId);
  if (!found) {
    return {
      ...state,
      pendingLeave: undefined,
      activePlayer: pending.phasePlayerId,
    };
  }

  if (pending.toZone === "battle") {
    // ルール: R-MOVE-01 — ラッシュエリア→バトルエリアの移動（ピットインダイブ等）。撃破ではない。
    const [, rest] = removeAt(owner[pending.fromZone], found.index);
    const moved = {
      ...owner,
      [pending.fromZone]: rest,
      battle: [...(pending.fromZone === "battle" ? rest : owner.battle), found.card],
    };
    return {
      ...state,
      pendingLeave: undefined,
      activePlayer: pending.phasePlayerId,
      ...updatePlayer(state, pending.ownerPlayerId, moved),
    };
  }

  const [, fromCards] = removeAt(owner[pending.fromZone], found.index);
  const leavingCard = sanitizeUnitLeavingField(
    found.card,
    pending.fromZone,
    pending.toZone === "deck_top" ? "deck" : pending.toZone,
  );
  let nextOwner: typeof owner;
  let medicalRescueToPower = false;

  if (pending.toZone === "deck_top") {
    // ルール: R-MOVE-01 — 山札に戻すのも「場を離れる」移動（ウラ向きで山札の上へ）。
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      deck: [{ instanceId: leavingCard.instanceId, cardId: leavingCard.cardId }, ...owner.deck],
    };
  } else if (pending.toZone === "command") {
    if (owner.command.length < COMMAND_ZONE_MAX) {
      nextOwner = {
        ...owner,
        [pending.fromZone]: fromCards,
        command: [...owner.command, { ...leavingCard, commandHeld: true }],
      };
    } else {
      nextOwner = {
        ...owner,
        [pending.fromZone]: fromCards,
        discard: [...owner.discard, leavingCard],
      };
    }
  } else if (
    pending.toZone === "discard" &&
    (medicalRescueToPower = shouldMedicalRescueToPower(state, pending.ownerPlayerId, found.card.cardId))
  ) {
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      power: [...owner.power, { ...leavingCard, faceDown: false }],
    };
  } else if (
    pending.toZone === "discard" &&
    shouldOfferToPowerOnDestroy(pending)
  ) {
    return startToPowerOnDestroyChoice(state, pending, leavingCard, fromCards);
  } else if (pending.toZone === "discard") {
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      discard: [...owner.discard, leavingCard],
    };
  } else {
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      power: [...owner.power, { ...leavingCard, faceDown: false }],
    };
  }

  if (pending.fromZone === "rush" || pending.fromZone === "battle") {
    nextOwner = restoreMountedVehicleIfMistakenlyDiscarded(
      nextOwner,
      found.card,
      pending.fromZone,
    );
  }

  let nextStateBase = {
    ...state,
    pendingLeave: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, pending.ownerPlayerId, nextOwner),
  };

  const effectiveToZone = medicalRescueToPower
    ? "power" // ルール: R-REPL-02 — 捨札を経由しないので「撃破されて捨札になったとき」は発動しない
    : pending.toZone === "command" && owner.command.length >= COMMAND_ZONE_MAX
      ? "discard"
      : pending.toZone === "deck_top"
        ? "deck"
        : pending.toZone;

  const leaveFx = emitUnitLeftZoneAndResolve(nextStateBase, {
    ownerPlayerId: pending.ownerPlayerId,
    instanceId: pending.instanceId,
    cardId: found.card.cardId,
    fromZone: pending.fromZone,
    toZone: effectiveToZone,
    phasePlayerId: pending.phasePlayerId,
    // ルール: R-DESTROY-01/02 — 撃破による離場か（置き先が捨札でなくても撃破の事実は残る）
    destroyed: isDestructionLeave(pending),
  });

  let resolvedState = leaveFx.state;
  if (
    pending.fusionReturnOnDiscard === "battle" &&
    effectiveToZone === "discard" &&
    nextOwner.discard.some((c) => c.instanceId === pending.instanceId)
  ) {
    resolvedState = returnFusionPartnersFromDiscard(
      resolvedState,
      pending.ownerPlayerId,
      found.card.cardId,
      "battle",
    );
  }

  return {
    ...resolvedState,
    log: [...resolvedState.log, ...leaveFx.logs],
  };
}

export function getCounterEffectId(state: GameState, playerId: PlayerId, instanceId: string): string | undefined {
  const found = findInZone(state.players[playerId], "hand", instanceId);
  if (!found) return undefined;
  return getCardEffect(found.card.cardId)?.effectId;
}

export type LeaveIntent = PendingLeave;

export function finalizeLeaveReaction(
  state: GameState,
  pending: PendingLeave,
  prevented: boolean,
): GameState {
  let nextState = finalizeLeavePending(state, pending, prevented);

  if (prevented) {
    if (pending.resumePendingStrike && state.pendingStrike) {
      return {
        ...nextState,
        activePlayer: pending.phasePlayerId,
        pendingStrike: state.pendingStrike,
      };
    }
    return nextState;
  }

  if (pending.followUpAttackerLeave) {
    const followUp = tryLeaveField(nextState, {
      ...pending.followUpAttackerLeave,
      phasePlayerId: pending.followUpAttackerLeave.phasePlayerId,
    });
    if (followUp.deferred) return followUp.state;
    nextState = followUp.state;
  }

  return nextState;
}

export function tryLeaveField(
  state: GameState,
  intent: LeaveIntent,
): { state: GameState; deferred: boolean } {
  const superShieldInstanceId = findSuperShieldSubstitute(state, intent);
  const dinoChronicle = hasDinoChronicleLeaveReaction(
    state,
    intent.ownerPlayerId,
    intent.leavingCardId,
  );
  const dinoGuts = hasDinoGutsLeaveReaction(
    state,
    intent.ownerPlayerId,
    intent.leavingCardId,
  );
  const sageAel = intent.toZone === "discard" && hasSageAelLeaveReaction(
    state,
    intent.ownerPlayerId,
    intent.leavingCardId,
    intent.fromZone,
  );
  const magLoad = intent.toZone === "discard" && hasMagLoadLeaveReaction(
    state,
    intent.ownerPlayerId,
    intent.leavingCardId,
    intent.fromZone,
  );

  if (!dinoChronicle && !dinoGuts && !superShieldInstanceId && !sageAel && !magLoad) {
    const owner = state.players[intent.ownerPlayerId];
    const found = findInZone(owner, intent.fromZone, intent.instanceId);

    const vehicleChase = buildPendingChaseOnVehicleDestroyed(state, intent);
    if (vehicleChase) {
      return {
        state: {
          ...state,
          pendingChase: vehicleChase,
          activePlayer: intent.ownerPlayerId,
        },
        deferred: true,
      };
    }

    if (found && canInitiateChase(state, intent.ownerPlayerId, found.card)) {
      const pendingChase = buildPendingChaseFromIntent(state, intent);
      if (pendingChase) {
        return {
          state: {
            ...state,
            pendingChase,
            activePlayer: intent.ownerPlayerId,
          },
          deferred: true,
        };
      }
    }

    const next = finalizeLeavePending(state, intent, false);
    if (next.pendingRegister) {
      return { state: next, deferred: true };
    }
    if (next.pendingEffectChoice) {
      return { state: next, deferred: true };
    }
    return { state: next, deferred: false };
  }

  return {
    state: {
      ...state,
      pendingLeave: {
        ...intent,
        superShieldInstanceId,
      },
      activePlayer: intent.ownerPlayerId,
    },
    deferred: true,
  };
}

export function tryDestroyStrikerForStrike(
  state: GameState,
  pending: PendingStrike,
  damageCancelled: boolean,
): { state: GameState; deferred: boolean } {
  const strikerPlayerId = pending.strikerPlayerId;
  const strikerPlayer = state.players[strikerPlayerId];
  const found = findInZone(strikerPlayer, "battle", pending.strikerInstanceId);
  if (!found) return { state, deferred: false };

  const defenderId = opponent(strikerPlayerId);
  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: strikerPlayerId,
    instanceId: pending.strikerInstanceId,
    fromZone: "battle",
    toZone: "discard",
    leavingCardId: found.card.cardId,
    phasePlayerId: defenderId,
    resumePendingStrike: { damageCancelled },
  });
  if (leaveResult.deferred) {
    return {
      state: { ...leaveResult.state, pendingStrike: pending },
      deferred: true,
    };
  }
  return { state: leaveResult.state, deferred: false };
}
