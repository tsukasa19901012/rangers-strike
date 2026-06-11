import type {
  CardInstance,
  GameState,
  PendingEffectChoice,
  PlayerId,
  PlayerState,
  SeabedDrawMeta,
} from "../types/game";
import { clearCostWindow, satisfyCostWindow } from "../core/costWindow";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitBp } from "../core/catalog";
import {
  startEndTurnBattleToRushChoiceForUnit,
  startJetSkateboardChoiceForUnit,
} from "./legend3/endTurnEffects";
import { applyRocketBoosterDeclaredName } from "./rocketBooster";
import { applySimultaneousOrderChoice } from "./simultaneousEffects";
import { applyAssaultToCommandHold } from "./legend3/restrictions";
import { findInZone, opponent, performDeckDraws, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { findCardOwner } from "./fieldLookup";
import { bounceToHand } from "./bounce";
import { applyReanimate } from "./reanimate";
import { tryLeaveField } from "./operationCounters";
import { hasSeabedSurvey } from "./legend2/fieldEffects";
import { promoteDeferredBattleEntry } from "./battleEntry";
import { continueDslAfterChoice } from "../dsl/cardInterpreter";
import { returnFusionPartnersFromDiscard } from "./fusionReturn";
import { applyCastoffDeckRush, continueCastoffAfterHold } from "./castoff";
import {
  beginAssaultVectorDestroy,
  beginDinoSlasherDiscard,
} from "./zoneCategoryEffects";
import { countDistinctCategoriesInCommandZone } from "./zoneCategoryLimit";
import {
  autoHoldForBattleEntry,
  canMoveUnitToBattle,
  markBattleEntryHoldReadyIfNoteSatisfied,
} from "./restrictions";

export type RequestDrawResult =
  | { state: GameState; pending: false; drawn: boolean }
  | { state: GameState; pending: true };

export function tryStartSeabedDrawChoice(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  meta: SeabedDrawMeta,
  sourceCardId = "RS-122",
): GameState | null {
  if (!hasSeabedSurvey(state, playerId)) return null;
  if (state.players[playerId].deck.length === 0) return null;
  if (state.pendingEffectChoice) return null;

  return openEffectChoice(state, {
    playerId,
    effectId: "seabed_survey",
    sourceCardId,
    kind: "seabed_draw",
    phasePlayerId,
    optional: true,
    validInstanceIds: [],
    seabedDrawMeta: meta,
  });
}

/** 手札へドロー；RS-122 がラッシュにいる場合海底選択を開く。 */
export function requestDrawFromDeck(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  options?: {
    count?: number;
    superBrainDiscardSecond?: boolean;
    sourceCardId?: string;
    seabedResume?: NonNullable<SeabedDrawMeta["resume"]>;
  },
): RequestDrawResult {
  const count = options?.count ?? 1;
  const player = state.players[playerId];
  if (player.deck.length === 0) {
    return { state, pending: false, drawn: false };
  }

  const opened = tryStartSeabedDrawChoice(
    state,
    playerId,
    phasePlayerId,
    {
      drawCount: count,
      superBrainDiscardSecond: options?.superBrainDiscardSecond,
      resume: options?.seabedResume,
    },
    options?.sourceCardId,
  );
  if (opened) {
    return { state: opened, pending: true };
  }

  const nextPlayer = performDeckDraws(
    player,
    count,
    "top",
    options?.superBrainDiscardSecond,
  );
  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending: false,
    drawn: true,
  };
}

export type ChoiceOutcome =
  | { state: GameState; log?: string; logs?: string[] }
  | { error: string };

function collectFieldUnitIds(
  state: GameState,
  playerId: PlayerId,
  maxBp: number,
  zones: Array<"rush" | "battle"> = ["rush", "battle"],
): string[] {
  const player = state.players[playerId];
  const ids: string[] = [];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (effectiveBp(state, playerId, card) <= maxBp) {
        ids.push(card.instanceId);
      }
    }
  }
  return ids;
}

function collectAnyFieldUnitIds(state: GameState, maxBp: number): string[] {
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    ids.push(...collectFieldUnitIds(state, pid, maxBp));
  }
  return ids;
}

function collectCommandIds(
  state: GameState,
  playerId: PlayerId,
  filter: "held" | "released" | "any",
): string[] {
  return state.players[playerId].command
    .filter((c) => {
      if (filter === "held") return !!c.commandHeld;
      if (filter === "released") return !c.commandHeld;
      return true;
    })
    .map((c) => c.instanceId);
}

function collectPowerIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
}

function collectHandIdsByName(
  state: GameState,
  playerId: PlayerId,
  name: string,
): string[] {
  return state.players[playerId].hand
    .filter((c) => cardName(state.definitions, c.cardId) === name)
    .map((c) => c.instanceId);
}

function collectHandIdsByCardId(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): string[] {
  return state.players[playerId].hand
    .filter((c) => c.cardId === cardId)
    .map((c) => c.instanceId);
}

function collectEnemyRushSmallIds(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.size === "S")
    .map((c) => c.instanceId);
}

export function openEffectChoice(
  state: GameState,
  choice: PendingEffectChoice,
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      ...choice,
      selectedInstanceIds: choice.selectedInstanceIds ?? [],
    },
    activePlayer: choice.playerId,
  };
}

/** RS-115: このユニットが戦闘進入したとき相手が1枚ドローできる。 */
export function startOpponentMayDrawChoice(
  state: GameState,
  enemyId: PlayerId,
  phasePlayerId: PlayerId,
): GameState | null {
  if (state.players[enemyId].deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: enemyId,
    effectId: "opponent_may_draw_on_enter",
    sourceCardId: "RS-115",
    kind: "optional_deck_draw",
    phasePlayerId,
    validInstanceIds: ["draw"],
    optional: true,
  });
}

export function applySeabedDrawPlacement(
  state: GameState,
  playerId: PlayerId,
  placement: "top" | "bottom",
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "seabed_draw") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const meta = pending.seabedDrawMeta ?? { drawCount: 1 };
  const from = placement === "bottom" ? "bottom" : "top";
  const player = state.players[playerId];
  const nextPlayer = performDeckDraws(
    player,
    meta.drawCount,
    from,
    meta.superBrainDiscardSecond,
  );

  return finishSeabedDrawChoice(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending,
    from,
  );
}

export function applySeabedDrawSkip(state: GameState, playerId: PlayerId): ChoiceOutcome {
  return applySeabedDrawPlacement(state, playerId, "top");
}

export function startRuinSurveyChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
): GameState | null {
  const top = state.players[playerId].deck[0];
  if (!top) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "ruin_survey",
    sourceCardId,
    kind: "deck_top_or_bottom",
    phasePlayerId: playerId,
    validInstanceIds: [top.instanceId],
    viewedInstanceIds: [top.instanceId],
  });
}

export function startSelectUnitChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    validInstanceIds: string[];
    unitDestination: PendingEffectChoice["unitDestination"];
    optional?: boolean;
  },
): GameState | null {
  if (params.validInstanceIds.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    selectCount: 1,
  });
}

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** RS-178 sagas_sniper: 山札全体を確認；対象ユニット1枚を選択（パワーコスト ≤ 上限）、その後シャッフル。 */
export function startSagasSniperChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    maxPowerCost: number;
  },
): GameState | null {
  const player = state.players[params.playerId];
  if (player.deck.length === 0) return null;

  const viewedInstanceIds = player.deck.map((c) => c.instanceId);
  const validInstanceIds = player.deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit") return false;
      return parsePowerCost(def.powerCost ?? 99) <= params.maxPowerCost;
    })
    .map((c) => c.instanceId);

  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: "sagas_sniper",
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "scry_keep_one",
    viewedInstanceIds,
    validInstanceIds,
    maxPowerCost: params.maxPowerCost,
    selectCount: 1,
    optional: true,
  });
}

/** RS-177 airlift: 山札からJC L/Rを選択してラッシュ、残りをシャッフル。 */
export function startDeckJointComboSearch(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    optional?: boolean;
  },
): GameState | null {
  const player = state.players[params.playerId];
  const valid = player.deck
    .filter((c) => {
      const cn = getDefinition(state.definitions, c.cardId)?.comboNumber;
      return cn === "L" || cn === "R";
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: valid,
    unitDestination: "rush",
    selectCount: 1,
    optional: params.optional ?? true,
  });
}

/** RS-106 ジュウクンドー: 敵ラッシュユニットを複数選択（印刷BP合計 ≤ 予算）。 */
export function startJuuKunDoChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    optional?: boolean;
  },
): GameState | null {
  const enemyId = opponent(params.playerId);
  const validInstanceIds = state.players[enemyId].rush.map((c) => c.instanceId);
  const optional = params.optional ?? true;
  if (validInstanceIds.length === 0 && !optional) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_units_bp_budget",
    validInstanceIds,
    bpBudget: 3000,
    selectedInstanceIds: [],
    optional,
  });
}

export function printedBpForInstance(
  state: GameState,
  instanceId: string,
): number | null {
  const located = findCardOwner(state, instanceId);
  if (!located) return null;
  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, instanceId);
  if (!found) return null;
  return unitBp(getDefinition(state.definitions, found.card.cardId));
}

export function selectedPrintedBpSum(
  state: GameState,
  selectedIds: string[],
): number {
  let sum = 0;
  for (const id of selectedIds) {
    sum += printedBpForInstance(state, id) ?? 0;
  }
  return sum;
}

export function canToggleBpBudgetTarget(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): boolean {
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.includes(instanceId)) return true;
  const bp = printedBpForInstance(state, instanceId);
  if (bp === null) return false;
  const budget = pending.bpBudget ?? 3000;
  if (selectedPrintedBpSum(state, selected) + bp > budget) return false;
  const maxCount = pending.selectCount;
  if (maxCount !== undefined && selected.length >= maxCount) return false;
  return true;
}

/** RS-125 天地轟鳴アニマルハート: 印刷BP予算内の敵ユニットを複数選択。 */
export function startAnimalHeartChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    validInstanceIds: string[];
    bpBudget: number;
    selectCount: number;
    optional?: boolean;
  },
): GameState | null {
  if (params.validInstanceIds.length === 0 && !params.optional) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_units_bp_budget",
    selectedInstanceIds: [],
    optional: params.optional ?? true,
  });
}

export function applyConfirmEffectChoice(
  state: GameState,
  playerId: PlayerId,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  if (pending.kind === "select_units_bp_budget") {
    const selected = pending.selectedInstanceIds ?? [];
    let nextState = state;
    for (const instanceId of selected) {
      const leave = applyUnitLeave(
        nextState,
        instanceId,
        "discard",
        pending.phasePlayerId,
      );
      if ("error" in leave) return leave;
      nextState = leave.state;
      if (nextState.pendingLeave) {
        return { state: nextState };
      }
    }
    const names = selected
      .map((id) => cardName(nextState.definitions, findFieldUnitCardId(nextState, id)))
      .join(",");
    return finishChoice(nextState, pending, names || "none");
  }

  return { error: "invalid_choice_kind" };
}

export function startTyrannoSonicChoice(
  state: GameState,
  rusherId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const ownTargets = collectFieldUnitIds(state, rusherId, 5000);
  if (ownTargets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: rusherId,
    effectId: "tyranno_sonic",
    sourceCardId,
    kind: "select_unit_step",
    step: "own",
    phasePlayerId,
    validInstanceIds: ownTargets,
    maxBp: 5000,
    unitDestination: "discard",
    optional: true,
  });
}

export function startMultiCommandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    selectCount: number;
    commandFilter: "held" | "released" | "any";
    commandAction: PendingEffectChoice["commandAction"];
    optional?: boolean;
    validInstanceIds?: string[];
    sourceInstanceId?: string;
  },
): GameState | null {
  const valid =
    params.validInstanceIds ??
    collectCommandIds(state, params.playerId, params.commandFilter);
  if (valid.length === 0 && !params.optional) return null;
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "select_commands",
    validInstanceIds: valid,
    selectCount: Math.min(params.selectCount, valid.length),
    commandFilter: params.commandFilter,
    commandAction: params.commandAction,
    optional: params.optional,
  });
}

export function startSelectCommandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    commandFilter: "held" | "released" | "any";
    commandAction: PendingEffectChoice["commandAction"];
    optional?: boolean;
    validInstanceIds?: string[];
    sourceInstanceId?: string;
  },
): GameState | null {
  const valid =
    params.validInstanceIds ??
    collectCommandIds(state, params.playerId, params.commandFilter);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    kind: "select_command",
    phasePlayerId: params.phasePlayerId,
    validInstanceIds: valid,
    selectCount: 1,
    commandAction: params.commandAction,
    commandFilter: params.commandFilter,
    optional: params.optional,
  });
}

export function startSelectPowerChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
    selectCount: number;
    optional?: boolean;
  },
): GameState | null {
  const valid = collectPowerIds(state, params.playerId);
  if (valid.length < params.selectCount) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_power",
    validInstanceIds: valid,
    selectCount: params.selectCount,
    optional: params.optional ?? true,
  });
}

export function startSelectHandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
    cardId?: string;
    cardName?: string;
    optional?: boolean;
  },
): GameState | null {
  const valid = params.cardId
    ? collectHandIdsByCardId(state, params.playerId, params.cardId)
    : params.cardName
      ? collectHandIdsByName(state, params.playerId, params.cardName)
      : [];
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    kind: "select_hand",
    phasePlayerId: params.phasePlayerId,
    validInstanceIds: valid,
    selectCount: 1,
    optional: params.optional ?? true,
  });
}

export function startRadialHammerChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  const player = state.players[playerId];
  if (player.deck.length === 0) return null;
  const count = Math.min(3, player.deck.length);
  const viewed = player.deck.slice(0, count).map((c) => c.instanceId);
  return openEffectChoice(state, {
    playerId,
    effectId: "radial_hammer",
    sourceCardId,
    sourceInstanceId,
    kind: "scry_keep_one",
    phasePlayerId: playerId,
    validInstanceIds: viewed,
    viewedInstanceIds: viewed,
    selectCount: 1,
  });
}

export function startPitInDiveOrderChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  const valid = collectEnemyRushSmallIds(state, playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "pit_in_dive",
    sourceCardId,
    sourceInstanceId,
    kind: "pit_in_dive_order",
    phasePlayerId: playerId,
    validInstanceIds: valid,
    selectCount: valid.length,
    optional: true,
  });
}

function clearChoice(state: GameState, phasePlayerId: PlayerId): GameState {
  return {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: phasePlayerId,
  };
}

function applyUnitLeave(
  state: GameState,
  instanceId: string,
  destination: "power" | "discard" | "deck_top",
  phasePlayerId: PlayerId,
): ChoiceOutcome {
  const located = findCardOwner(state, instanceId);
  if (!located || (located.zone !== "rush" && located.zone !== "battle")) {
    return { error: "invalid_target" };
  }

  if (destination === "deck_top") {
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, instanceId);
    if (!found) return { error: "invalid_target" };
    const [, zoneCards] = removeAt(owner[located.zone], found.index);
    const nextOwner = {
      ...owner,
      [located.zone]: zoneCards,
      deck: [found.card, ...owner.deck],
    };
    return {
      state: { ...state, ...updatePlayer(state, located.playerId, nextOwner) },
    };
  }

  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, instanceId);
  if (!found) return { error: "invalid_target" };

  const toZone = destination === "power" ? "power" : "discard";
  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: located.playerId,
    instanceId,
    fromZone: located.zone,
    toZone,
    leavingCardId: found.card.cardId,
    phasePlayerId,
  });

  if (leaveResult.deferred) {
    return { state: leaveResult.state };
  }
  return { state: leaveResult.state };
}

function findFieldUnitCardId(state: GameState, instanceId: string): string {
  const located = findCardOwner(state, instanceId);
  if (!located) return instanceId;
  const found = findInZone(state.players[located.playerId], located.zone, instanceId);
  return found?.card.cardId ?? instanceId;
}

function cardNameForInstance(state: GameState, instanceId: string): string {
  const located = findCardOwner(state, instanceId);
  if (located) {
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, instanceId);
    if (found) return cardName(state.definitions, found.card.cardId);
  }
  const command = findCommandCard(state, instanceId);
  if (command) return cardName(state.definitions, command.card.cardId);
  return instanceId;
}

function formatInstanceIdsAsNames(state: GameState, instanceIds: string[]): string {
  return instanceIds.map((id) => cardNameForInstance(state, id)).join("、");
}

function findCommandCard(
  state: GameState,
  instanceId: string,
): { playerId: PlayerId; index: number; card: CardInstance } | null {
  for (const pid of ["player1", "player2"] as const) {
    const found = findInZone(state.players[pid], "command", instanceId);
    if (found) {
      return { playerId: pid, index: found.index, card: found.card };
    }
  }
  return null;
}

function finishSeabedDrawChoice(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
): ChoiceOutcome {
  const cleared = clearChoice(state, pending.phasePlayerId);
  const resume = pending.seabedDrawMeta?.resume;
  if (resume) {
    return finishChoice(cleared, resume.pending, resume.detail);
  }
  return finishChoice(cleared, pending, detail);
}

function finishChoice(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
): ChoiceOutcome {
  const log = buildLogEntry(
    pending.playerId,
    "resolve_effect_choice",
    pending.sourceCardId,
    state.definitions,
    `${pending.effectId}:${detail}`,
  );
  return {
    state: promoteDeferredBattleEntry(clearChoice(state, pending.phasePlayerId)),
    log,
  };
}

export function completeEffectHoldChoice(
  state: GameState,
  playerId: PlayerId,
  commandInstanceIds: string[],
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (pending.commandAction !== "hold") return { error: "invalid_payment" };
  const selectCount = pending.selectCount ?? 1;
  if (commandInstanceIds.length !== selectCount) return { error: "wrong_count" };
  for (const id of commandInstanceIds) {
    if (!pending.validInstanceIds.includes(id)) return { error: "invalid_target" };
  }
  return finishChoice(state, pending, formatInstanceIdsAsNames(state, commandInstanceIds));
}

export function skipEffectChoice(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.optional) return { error: "cannot_skip" };
  if (pending.kind === "seabed_draw") {
    return applySeabedDrawSkip(state, playerId);
  }
  if (pending.kind === "optional_deck_draw") {
    return finishChoice(state, pending, "skipped");
  }
  return finishChoice(state, pending, "skipped");
}

export function applyEffectChoicePlacement(
  state: GameState,
  playerId: PlayerId,
  placement: "top" | "bottom",
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "deck_top_or_bottom") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const player = state.players[playerId];
  const top = player.deck[0];
  if (!top || top.instanceId !== pending.viewedInstanceIds?.[0]) {
    return { error: "invalid_scry" };
  }

  let nextPlayer = player;
  if (placement === "bottom") {
    const [card, rest] = removeAt(player.deck, 0);
    nextPlayer = { ...player, deck: [...rest, card] };
  }

  return finishChoice(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending,
    placement,
  );
}

export function applyEffectChoiceSelect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const dslResumeSimpleKinds = new Set([
    "select_unit",
    "select_command",
    "select_hand",
    "select_power",
  ]);
  if (pending.dslResume && dslResumeSimpleKinds.has(pending.kind)) {
    const result = continueDslAfterChoice(state, playerId, instanceId, pending);
    if (result.error) return { error: result.error };
    return { state: result.state, log: result.log };
  }

  const selectedSoFar = pending.selectedInstanceIds ?? [];
  if (pending.kind === "select_units_bp_budget") {
    if (
      !pending.validInstanceIds.includes(instanceId) &&
      !selectedSoFar.includes(instanceId)
    ) {
      return { error: "invalid_target" };
    }
  } else if (!pending.validInstanceIds.includes(instanceId)) {
    return { error: "invalid_target" };
  }

  switch (pending.kind) {
    case "select_units_bp_budget": {
      const selected = pending.selectedInstanceIds ?? [];
      if (selected.includes(instanceId)) {
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected.filter((id) => id !== instanceId),
            },
            activePlayer: playerId,
          },
        };
      }
      if (!canToggleBpBudgetTarget(state, pending, instanceId)) {
        return { error: "bp_budget_exceeded" };
      }
      return {
        state: {
          ...state,
          pendingEffectChoice: {
            ...pending,
            selectedInstanceIds: [...selected, instanceId],
          },
          activePlayer: playerId,
        },
      };
    }
    case "optional_deck_draw": {
      if (instanceId !== "draw") return { error: "invalid_target" };
      const player = state.players[playerId];
      if (player.deck.length === 0) return { error: "empty_deck" };
      const drawResult = requestDrawFromDeck(state, playerId, pending.phasePlayerId, {
        count: 1,
        sourceCardId: pending.sourceCardId,
        seabedResume: { pending, detail: "draw" },
      });
      if (drawResult.pending) {
        return { state: drawResult.state };
      }
      return finishChoice(drawResult.state, pending, "draw");
    }
    case "select_unit": {
      const dest = pending.unitDestination ?? "discard";
      if (dest === "rush") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "battle") return { error: "invalid_target" };
        const owner = state.players[located.playerId];
        const found = findInZone(owner, "battle", instanceId);
        if (!found) return { error: "invalid_target" };
        const [, battle] = removeAt(owner.battle, found.index);
        return finishChoice(
          { ...state, ...updatePlayer(state, located.playerId, { ...owner, battle, rush: [...owner.rush, found.card] }) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "enemy_command") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "battle") return { error: "invalid_target" };
        const nextState = applyAssaultToCommandHold(state, located.playerId, instanceId);
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      if (pending.effectId === "battle_entry_discard") {
        const player = state.players[pending.playerId];
        const found = findInZone(player, "rush", instanceId);
        if (!found || pending.sourceInstanceId === instanceId) return { error: "invalid_target" };
        const [, rush] = removeAt(player.rush, found.index);
        const nextPlayer = satisfyCostWindow(
          {
            ...player,
            rush,
            discard: [...player.discard, found.card],
          },
          "battle_entry_rush_discard",
          { discardedCardId: found.card.cardId },
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "hand" || dest === "hand_from_discard" || dest === "hand_from_power") {
        if (dest === "hand_from_discard") {
          const ownerId = pending.playerId;
          const owner = state.players[ownerId];
          const found = findInZone(owner, "discard", instanceId);
          if (!found) return { error: "invalid_target" };
          const nextState = applyReanimate(state, {
            playerId: ownerId,
            instanceId,
            from: "discard",
            to: "hand",
          });
          return finishChoice(
            nextState,
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }

        const located = findCardOwner(state, instanceId);
        const ownerId =
          dest === "hand_from_power" ? pending.playerId : located?.playerId;
        if (!ownerId) return { error: "invalid_target" };
        const fromZone =
          dest === "hand_from_power" ? "power" : located!.zone;
        const bounced = bounceToHand(state, {
          playerId: ownerId,
          instanceId,
          fromZone,
          faceUpPowerOnly: fromZone === "power",
        });
        if (!bounced.bounced) return { error: "invalid_target" };
        let nextState = bounced.state;
        if (pending.effectId === "ghost_absorption" && pending.sourceInstanceId) {
          const actor = nextState.players[pending.playerId];
          const returnedBp = unitBp(
            getDefinition(state.definitions, bounced.bounced.cardId),
          );
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...actor,
              battle: actor.battle.map((c) =>
                c.instanceId === pending.sourceInstanceId
                  ? {
                      ...c,
                      spModifier: (c.spModifier ?? 0) + 1,
                      bpModifier: returnedBp,
                    }
                  : c,
              ),
            }),
          };
        }
        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, bounced.bounced.cardId),
        );
      }
      if (dest === "enemy_battle") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "rush") return { error: "invalid_target" };
        const owner = state.players[located.playerId];
        const found = findInZone(owner, "rush", instanceId);
        if (!found) return { error: "invalid_target" };
        const prepared = autoHoldForBattleEntry(owner, found.card);
        if (!prepared) return { error: "cannot_enter_battle" };
        const readyOwner = markBattleEntryHoldReadyIfNoteSatisfied(prepared, found.card);
        const withPrepared = {
          ...state,
          ...updatePlayer(state, located.playerId, readyOwner),
        };
        if (!canMoveUnitToBattle(withPrepared, located.playerId, found.card, "rush")) {
          return { error: "cannot_enter_battle" };
        }
        const [, rush] = removeAt(readyOwner.rush, found.index);
        const nextOwner = clearCostWindow(
          {
            ...readyOwner,
            rush,
            battle: [...readyOwner.battle, found.card],
          },
          "battle_entry_hold",
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, located.playerId, nextOwner) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "swap_battle" && pending.sourceInstanceId) {
        const player = state.players[pending.playerId];
        const swapTarget = findInZone(player, "battle", instanceId);
        const entering = findInZone(player, "rush", pending.sourceInstanceId);
        if (!swapTarget || !entering) return { error: "invalid_target" };
        const prepared = autoHoldForBattleEntry(player, entering.card);
        if (!prepared) return { error: "cannot_enter_battle" };
        const readyPlayer = markBattleEntryHoldReadyIfNoteSatisfied(prepared, entering.card);
        const withPrepared = {
          ...state,
          ...updatePlayer(state, pending.playerId, readyPlayer),
        };
        if (!canMoveUnitToBattle(withPrepared, pending.playerId, entering.card, "rush")) {
          return { error: "cannot_enter_battle" };
        }
        let battle = readyPlayer.battle.filter((c) => c.instanceId !== instanceId);
        battle = [...battle, { ...entering.card, battleActed: true }];
        const rush = readyPlayer.rush.filter((c) => c.instanceId !== pending.sourceInstanceId);
        const nextPlayer = clearCostWindow(
          {
            ...readyPlayer,
            battle,
            rush: [...rush, swapTarget.card],
          },
          "battle_entry_hold",
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          cardName(state.definitions, swapTarget.card.cardId),
        );
      }
      const located = findCardOwner(state, instanceId);
      const destroyedCardId = located
        ? findInZone(state.players[located.playerId], located.zone, instanceId)?.card.cardId
        : undefined;
      const leave = applyUnitLeave(state, instanceId, dest === "power" ? "power" : dest === "deck_top" ? "deck_top" : "discard", pending.phasePlayerId);
      if ("error" in leave) return leave;
      let nextState = leave.state;
      if (
        pending.effectId === "great_assault" &&
        dest === "discard" &&
        located &&
        destroyedCardId
      ) {
        nextState = returnFusionPartnersFromDiscard(
          nextState,
          located.playerId,
          destroyedCardId,
          "hand",
        );
      }
      return finishChoice(
        nextState,
        pending,
        cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
      );
    }

    case "select_unit_step": {
      if (pending.effectId === "string_fist") {
        if (pending.step === "own") {
          const located = findCardOwner(state, instanceId);
          if (!located || located.zone !== "battle") return { error: "invalid_target" };
          const owner = state.players[located.playerId];
          const found = findInZone(owner, "battle", instanceId);
          if (!found) return { error: "invalid_target" };
          const [, battle] = removeAt(owner.battle, found.index);
          let nextState = {
            ...state,
            ...updatePlayer(state, located.playerId, {
              ...owner,
              battle,
              rush: [...owner.rush, found.card],
            }),
          };
          const enemyId = opponent(pending.playerId);
          const enemyTargets = nextState.players[enemyId].rush.map((c) => c.instanceId);
          if (enemyTargets.length === 0) {
            return finishChoice(nextState, pending, cardName(state.definitions, found.card.cardId));
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              kind: "select_unit",
              step: undefined,
              validInstanceIds: enemyTargets,
              unitDestination: "enemy_battle",
            }),
          };
        }
        return { error: "invalid_step" };
      }
      if (pending.effectId === "tyranno_sonic") {
        const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
        if ("error" in leave) return leave;
        let nextState = leave.state;

        if (pending.step === "own") {
          const enemyId = opponent(pending.playerId);
          const enemyTargets = collectFieldUnitIds(nextState, enemyId, pending.maxBp ?? 5000);
          if (enemyTargets.length === 0) {
            return finishChoice(nextState, pending, "own_only");
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              step: "enemy",
              validInstanceIds: enemyTargets,
            }),
          };
        }

        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      return { error: "invalid_step" };
    }

    case "select_command": {
      if (pending.effectId === "dark_dual_blade") {
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const powerFound = findInZone(enemy, "power", instanceId);
        if (powerFound) {
          const [, power] = removeAt(enemy.power, powerFound.index);
          let nextState = {
            ...state,
            ...updatePlayer(state, enemyId, {
              ...enemy,
              power,
              discard: [...enemy.discard, powerFound.card],
            }),
          };
          const commandTargets = collectCommandIds(nextState, enemyId, "any");
          if (commandTargets.length === 0) {
            return finishChoice(nextState, pending, cardName(state.definitions, powerFound.card.cardId));
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              effectId: "dark_dual_blade_command",
              playerId: pending.playerId,
              validInstanceIds: commandTargets,
              commandAction: "discard",
            }),
          };
        }
      }
      if (pending.effectId === "dark_dual_blade_command") {
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const found = findInZone(enemy, "command", instanceId);
        if (!found) return { error: "invalid_target" };
        const [, command] = removeAt(enemy.command, found.index);
        const nextEnemy = {
          ...enemy,
          command,
          discard: [...enemy.discard, found.card],
        };
        return finishChoice(
          { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }

      const located = findCommandCard(state, instanceId);
      if (!located) {
        for (const playerId of ["player1", "player2"] as const) {
          const owner = state.players[playerId];
          const found = findInZone(owner, "power", instanceId);
          if (!found) continue;
          const [, power] = removeAt(owner.power, found.index);
          const nextOwner = {
            ...owner,
            power,
            discard: [...owner.discard, found.card],
          };
          return finishChoice(
            { ...state, ...updatePlayer(state, playerId, nextOwner) },
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }
        return { error: "invalid_target" };
      }
      const owner = located.playerId;
      const player = state.players[owner];
      const found = findInZone(player, "command", instanceId);
      if (!found) return { error: "invalid_target" };

      let nextPlayer = player;
      if (pending.commandAction === "discard") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          discard: [...player.discard, found.card],
        };
      } else if (pending.commandAction === "hold") {
        const command = [...player.command];
        command[found.index] = { ...found.card, commandHeld: true };
        nextPlayer = { ...player, command };
      } else if (pending.commandAction === "return_hand") {
        const bounced = bounceToHand(state, {
          playerId: owner,
          instanceId,
          fromZone: "command",
        });
        if (!bounced.bounced) return { error: "invalid_target" };
        return finishChoice(bounced.state, pending, cardName(state.definitions, found.card.cardId));
      } else if (pending.commandAction === "rush" || pending.commandAction === "rush_silent") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          rush: [...player.rush, found.card],
        };
      } else if (pending.commandAction === "power") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          power: [...player.power, { ...found.card, faceDown: false }],
        };
      }

      let nextState = { ...state, ...updatePlayer(state, owner, nextPlayer) };
      if (pending.effectId === "castoff_hold_command") {
        const continued = continueCastoffAfterHold(nextState, pending);
        if (continued) {
          return { state: continued };
        }
      }
      if (pending.effectId === "shift_up" && pending.sourceInstanceId) {
        const actor = nextState.players[pending.playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pending.playerId, {
            ...actor,
            battle: actor.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId
                ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
                : c,
            ),
          }),
        };
      }

      if (
        pending.effectId === "dino_slasher_category_balance" &&
        pending.zoneCategoryBalanceOwnerId !== undefined &&
        pending.zoneCategoryTargetCount !== undefined
      ) {
        const ownerId = pending.zoneCategoryBalanceOwnerId;
        const enemyCount = countDistinctCategoriesInCommandZone(
          nextState.players[pending.playerId],
          nextState.definitions,
        );
        if (enemyCount > pending.zoneCategoryTargetCount) {
          const continued = beginDinoSlasherDiscard(nextState, {
            effectOwnerId: ownerId,
            effectId: pending.effectId,
            sourceCardId: pending.sourceCardId,
            sourceInstanceId: pending.sourceInstanceId,
            phasePlayerId: pending.phasePlayerId,
          });
          if (continued) {
            return { state: continued };
          }
        }
      }

      return finishChoice(
        nextState,
        pending,
        cardName(state.definitions, found.card.cardId),
      );
    }

    case "select_commands": {
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const selectCount = pending.selectCount ?? 1;
      if (selected.length < selectCount) {
        const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
          },
        };
      }

      let nextState = state;
      for (const cmdId of selected) {
        const player = nextState.players[pending.playerId];
        const found = findInZone(player, "command", cmdId);
        if (!found) continue;
        if (pending.commandAction === "hold") {
          const command = [...player.command];
          command[found.index] = { ...found.card, commandHeld: true };
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, { ...player, command }),
          };
        } else if (pending.commandAction === "power") {
          const [, command] = removeAt(player.command, found.index);
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, pending.playerId, {
              ...player,
              command,
              power: [...player.power, { ...found.card, faceDown: false }],
            }),
          };
        }
      }
      if (pending.effectId === "bio_particle_slash" && pending.sourceCardId) {
        const player = nextState.players[pending.playerId];
        const battle = player.battle.map((c) =>
          c.cardId === pending.sourceCardId
            ? {
                ...c,
                spModifier: (c.spModifier ?? 0) + 2,
                bpModifier: (c.bpModifier ?? 0) + 3000,
              }
            : c,
        );
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pending.playerId, { ...player, battle }),
        };
      }
      return finishChoice(nextState, pending, formatInstanceIdsAsNames(nextState, selected));
    }

    case "select_power": {
      const prev = pending.selectedInstanceIds ?? [];
      if (prev.includes(instanceId)) return { error: "already_selected" };
      const selected = [...prev, instanceId];
      const selectCount = pending.selectCount ?? 1;
      if (selected.length < selectCount) {
        const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
          },
        };
      }

      const player = state.players[pending.playerId];
      const discardIds = new Set(selected);
      const toDiscard = player.power.filter((c) => discardIds.has(c.instanceId));
      let nextPlayer = {
        ...player,
        power: player.power.filter((c) => !discardIds.has(c.instanceId)),
        discard: [...player.discard, ...toDiscard],
      };

      if (pending.effectId === "earth_force") {
        nextPlayer = { ...nextPlayer, hasPaidEarthForceUpkeep: true };
      }

      if (pending.sourceInstanceId) {
        const needsFullPayment =
          pending.effectId === "judgment_sword" || pending.effectId === "justice_flasher";
        const paidEnough = !needsFullPayment || toDiscard.length >= selectCount;
        const spGain = paidEnough
          ? pending.effectId === "justice_flasher"
            ? 3
            : pending.effectId === "judgment_sword"
              ? 1
              : 0
          : 0;
        if (spGain > 0) {
          nextPlayer = {
            ...nextPlayer,
            battle: nextPlayer.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId
                ? { ...c, spModifier: (c.spModifier ?? 0) + spGain }
                : c,
            ),
          };
        }
      }

      return finishChoice(
        { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
        pending,
        formatInstanceIdsAsNames(state, selected),
      );
    }

    case "select_hand": {
      const selectCount = pending.selectCount ?? 1;
      if (selectCount > 1) {
        const prev = pending.selectedInstanceIds ?? [];
        if (prev.includes(instanceId)) return { error: "already_selected" };
        const selected = [...prev, instanceId];
        if (selected.length < selectCount) {
          const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
          return {
            state: {
              ...state,
              pendingEffectChoice: {
                ...pending,
                selectedInstanceIds: selected,
                validInstanceIds: remaining,
              },
            },
          };
        }

        const player = state.players[pending.playerId];
        const discardIds = new Set(selected);
        const toDiscard = player.hand.filter((c) => discardIds.has(c.instanceId));
        const basePlayer = {
          ...player,
          hand: player.hand.filter((c) => !discardIds.has(c.instanceId)),
          discard: [...player.discard, ...toDiscard],
        };
        const nextPlayer =
          pending.effectId === "battle_entry_hand_discard"
            ? satisfyCostWindow(basePlayer, "battle_entry_hand_discard")
            : basePlayer;
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          formatInstanceIdsAsNames(state, selected),
        );
      }

      const player = state.players[pending.playerId];
      const found = findInZone(player, "hand", instanceId);
      if (!found) return { error: "invalid_target" };
      const [, hand] = removeAt(player.hand, found.index);
      let nextPlayer = {
        ...player,
        hand,
        discard: [...player.discard, found.card],
      };
      if (pending.sourceInstanceId) {
        nextPlayer = {
          ...nextPlayer,
          battle: nextPlayer.battle.map((c) =>
            c.instanceId === pending.sourceInstanceId
              ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
              : c,
          ),
        };
      }
      return finishChoice(
        { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
        pending,
        cardName(state.definitions, found.card.cardId),
      );
    }

    case "scry_keep_one": {
      const player = state.players[pending.playerId];
      const viewed = (pending.viewedInstanceIds ?? [])
        .map((id) => player.deck.find((c) => c.instanceId === id))
        .filter((c): c is CardInstance => !!c);
      const kept = viewed.find((c) => c.instanceId === instanceId);
      if (!kept) return { error: "invalid_target" };
      const rest = viewed.filter((c) => c.instanceId !== instanceId);
      const deckTail = player.deck.filter(
        (c) => !viewed.some((v) => v.instanceId === c.instanceId),
      );
      let nextPlayer: PlayerState;
      if (pending.effectId === "sagas_sniper") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck([...rest, ...deckTail]),
          hand: [...player.hand, kept],
        };
      } else if (
        pending.unitDestination === "rush" &&
        pending.effectId === "castoff_deck_rush" &&
        pending.castoffMfInstanceId
      ) {
        const castoff = applyCastoffDeckRush(
          state,
          pending.playerId,
          instanceId,
          pending.castoffMfInstanceId,
          pending.phasePlayerId,
        );
        if (!castoff) return { error: "invalid_target" };
        return finishChoice(castoff.state, pending, castoff.log ?? cardName(state.definitions, kept.cardId));
      } else if (pending.unitDestination === "rush") {
        nextPlayer = {
          ...player,
          deck: shuffleDeck([...rest, ...deckTail]),
          rush: [...player.rush, kept],
        };
      } else {
        nextPlayer = {
          ...player,
          deck: [kept, ...deckTail],
          discard: [...player.discard, ...rest],
        };
      }
      const nextState = { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
      return finishChoice(nextState, pending, cardName(state.definitions, kept.cardId));
    }

    case "simultaneous_order": {
      if (!pending.validInstanceIds.includes(instanceId)) {
        return { error: "invalid_target" };
      }
      const nextState = applySimultaneousOrderChoice(state, instanceId);
      return finishChoice(nextState, pending, instanceId);
    }

    case "end_turn_menu": {
      const cleared = clearChoice(state, pending.phasePlayerId);
      const jet = startJetSkateboardChoiceForUnit(cleared, playerId, instanceId);
      if (jet) return { state: jet };
      const geki = startEndTurnBattleToRushChoiceForUnit(cleared, playerId, instanceId);
      if (geki) return { state: geki };
      return { error: "unsupported_end_turn_effect" };
    }

    case "confirm": {
      if (pending.effectId === "rocket_booster") {
        const declaredName = pending.validInstanceIds.find((name) => name === instanceId)
          ?? instanceId;
        if (!pending.validInstanceIds.includes(declaredName)) {
          return { error: "invalid_target" };
        }
        const nextState = applyRocketBoosterDeclaredName(state, playerId, declaredName);
        return finishChoice(nextState, pending, declaredName);
      }
      return { error: "unsupported_confirm" };
    }

    case "pit_in_dive_order": {
      const actorId = pending.playerId;
      const enemyId = opponent(actorId);
      const enemy = state.players[enemyId];
      const found = findInZone(enemy, "rush", instanceId);
      if (!found) return { error: "invalid_target" };

      const prepared = autoHoldForBattleEntry(enemy, found.card);
      if (!prepared) return { error: "cannot_enter_battle" };
      const readyEnemy = markBattleEntryHoldReadyIfNoteSatisfied(prepared, found.card);
      const withPrepared = { ...state, ...updatePlayer(state, enemyId, readyEnemy) };
      if (!canMoveUnitToBattle(withPrepared, enemyId, found.card, "rush")) {
        return { error: "cannot_enter_battle" };
      }

      const [, rush] = removeAt(prepared.rush, found.index);
      const nextEnemy = clearCostWindow(
        {
          ...readyEnemy,
          rush,
          battle: [...readyEnemy.battle, found.card],
        },
        "battle_entry_hold",
      );
      let nextState = { ...state, ...updatePlayer(state, enemyId, nextEnemy) };

      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
      if (remaining.length > 0) {
        return {
          state: {
            ...nextState,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
            activePlayer: pending.playerId,
          },
        };
      }

      return finishChoice(nextState, pending, formatInstanceIdsAsNames(nextState, selected));
    }

    default:
      return { error: "invalid_choice_kind" };
  }
}

export function getValidTargetsForChoice(state: GameState): string[] {
  return state.pendingEffectChoice?.validInstanceIds ?? [];
}

export {
  collectFieldUnitIds,
  collectAnyFieldUnitIds,
  collectCommandIds,
  collectPowerIds,
  collectEnemyRushSmallIds,
};
