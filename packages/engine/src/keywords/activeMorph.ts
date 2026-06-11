import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import {
  featuresExactlyMatch,
  listMorphReplacementCandidates,
  type MorphReplacementCandidate,
} from "./morph";

type FieldZone = "rush" | "battle";

function findFieldUnit(
  player: PlayerState,
  instanceId: string,
): { zone: FieldZone; index: number; card: CardInstance } | null {
  for (const zone of ["rush", "battle"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}

function findReplacement(
  player: PlayerState,
  instanceId: string,
): { zone: MorphReplacementCandidate["zone"]; index: number; card: CardInstance } | null {
  for (const zone of ["hand", "rush", "power", "command"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}

function stripFieldState(card: CardInstance): CardInstance {
  const next: CardInstance = {
    instanceId: card.instanceId,
    cardId: card.cardId,
  };
  if (card.faceDown) next.faceDown = true;
  return next;
}

function inheritFieldState(from: CardInstance, to: CardInstance): CardInstance {
  return {
    ...to,
    commandHeld: from.commandHeld,
    mothershipHold: from.mothershipHold,
    registerHeld: from.registerHeld,
    mountedOnInstanceId: from.mountedOnInstanceId,
    bpModifier: from.bpModifier,
    spModifier: from.spModifier,
    spOverride: from.spOverride,
    battleActed: from.battleActed,
  };
}

function isFaceUpUnit(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
): boolean {
  if (card.faceDown) return false;
  return getDefinition(definitions, card.cardId)?.type === "unit";
}

function cardHasNamedEffect(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  effectName: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  return def?.text?.includes(`【${effectName}】`) ?? false;
}

/** 能動モーフ（カメンライド等）: 効果名付きユニット候補。 */
export function listActiveMorphCandidatesByEffectName(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  effectName: string,
  excludeInstanceId?: string,
): MorphReplacementCandidate[] {
  const results: MorphReplacementCandidate[] = [];
  for (const zone of ["hand", "rush", "power", "command"] as const) {
    for (const card of player[zone]) {
      if (!isFaceUpUnit(definitions, card)) continue;
      if (excludeInstanceId && card.instanceId === excludeInstanceId) continue;
      if (!cardHasNamedEffect(definitions, card.cardId, effectName)) continue;
      results.push({ zone, instanceId: card.instanceId, card });
    }
  }
  return results;
}

function applyZoneMorphSwap(
  state: GameState,
  playerId: PlayerId,
  fieldUnitInstanceId: string,
  replacementInstanceId: string,
  logAction: string,
): { state: GameState; log: string } | { error: string } {
  const player = state.players[playerId];
  const fieldFound = findFieldUnit(player, fieldUnitInstanceId);
  const replacementFound = findReplacement(player, replacementInstanceId);
  if (!fieldFound || !replacementFound) return { error: "invalid_target" };

  const replacementDef = getDefinition(state.definitions, replacementFound.card.cardId);
  if (!replacementDef || replacementDef.type !== "unit") {
    return { error: "invalid_target" };
  }

  let nextPlayer = { ...player };
  const [, fieldZoneCards] = removeAt(nextPlayer[fieldFound.zone], fieldFound.index);
  nextPlayer = { ...nextPlayer, [fieldFound.zone]: fieldZoneCards };

  const replacementIndex = nextPlayer[replacementFound.zone].findIndex(
    (c) => c.instanceId === replacementInstanceId,
  );
  if (replacementIndex < 0) return { error: "invalid_target" };
  const [, replacementZoneCards] = removeAt(nextPlayer[replacementFound.zone], replacementIndex);
  nextPlayer = { ...nextPlayer, [replacementFound.zone]: replacementZoneCards };

  const entering = inheritFieldState(fieldFound.card, replacementFound.card);
  const leaving = stripFieldState(fieldFound.card);

  nextPlayer = {
    ...nextPlayer,
    [fieldFound.zone]: [...nextPlayer[fieldFound.zone], entering],
    [replacementFound.zone]: [...nextPlayer[replacementFound.zone], leaving],
  };

  const log = buildLogEntry(
    playerId,
    logAction,
    fieldFound.card.cardId,
    state.definitions,
    replacementFound.card.cardId,
  );

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    log,
  };
}

/** 特徴完全一致での能動置換（モーフ反応と同条件）。 */
export function applyActiveFeatureMorphSwap(
  state: GameState,
  playerId: PlayerId,
  fieldUnitInstanceId: string,
  replacementInstanceId: string,
): { state: GameState; log: string } | { error: string } {
  const player = state.players[playerId];
  const fieldFound = findFieldUnit(player, fieldUnitInstanceId);
  if (!fieldFound) return { error: "invalid_target" };

  const fieldDef = getDefinition(state.definitions, fieldFound.card.cardId);
  const replacementFound = findReplacement(player, replacementInstanceId);
  const replacementDef = replacementFound
    ? getDefinition(state.definitions, replacementFound.card.cardId)
    : undefined;
  if (!fieldDef || !replacementDef || replacementDef.type !== "unit") {
    return { error: "invalid_target" };
  }

  const candidates = listMorphReplacementCandidates(
    player,
    state.definitions,
    fieldFound.card.cardId,
  );
  if (!candidates.some((c) => c.instanceId === replacementInstanceId)) {
    return { error: "invalid_target" };
  }
  if (!featuresExactlyMatch(fieldDef.features ?? [], replacementDef.features ?? [])) {
    return { error: "invalid_target" };
  }

  return applyZoneMorphSwap(
    state,
    playerId,
    fieldUnitInstanceId,
    replacementInstanceId,
    "active_morph_swap",
  );
}

/** カメンライド: 【アタックライド】名持ちユニットへの置換。 */
export function applyKamenRideMorphSwap(
  state: GameState,
  playerId: PlayerId,
  fieldUnitInstanceId: string,
  replacementInstanceId: string,
): { state: GameState; log: string } | { error: string } {
  const player = state.players[playerId];
  const candidates = listActiveMorphCandidatesByEffectName(
    player,
    state.definitions,
    "アタックライド",
    fieldUnitInstanceId,
  );
  if (!candidates.some((c) => c.instanceId === replacementInstanceId)) {
    return { error: "invalid_target" };
  }

  return applyZoneMorphSwap(
    state,
    playerId,
    fieldUnitInstanceId,
    replacementInstanceId,
    "kamen_ride_morph",
  );
}
