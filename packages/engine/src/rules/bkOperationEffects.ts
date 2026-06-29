import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { canonicalCardName } from "@rangers-strike/cards";
import { rematchEffectPrimitives, splitChoiceBranches } from "@rangers-strike/cards/pipeline/extractEffects";
import { isCatchallGrantKeyword } from "../dsl/hashGrantKeywordStub";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName, getDefinition, isSmallUnit } from "../core/catalog";
import { findInZone, updatePlayer } from "../core/helpers";
import { getDslEffectById } from "../dsl/effectLookup";
import { interpretEffectPrimitives } from "../dsl/cardInterpreter";
import type { GrantKeywordContext } from "../dsl/grantKeyword";
import { requestDrawFromDeck } from "./drawFromDeck";
import { openEffectChoice } from "./pendingChoices";
import {
  addAccelerateRushWaiveRule,
  addMirrorRiderPowerMinusRule,
  markVehicleBattleWithoutRide,
} from "./bkOperationTurnRules";

function parseKeywordPayload(keyword: string, prefix: string): string | null {
  const marker = `${prefix}::`;
  if (!keyword.startsWith(marker)) return null;
  return keyword.slice(marker.length);
}

function collectHandByCanonicalName(
  state: GameState,
  playerId: PlayerId,
  targetName: string,
): string[] {
  const target = canonicalCardName(targetName);
  const player = state.players[playerId];
  return player.hand
    .filter((c) => canonicalCardName(cardName(state.definitions, c.cardId)) === target)
    .map((c) => c.instanceId);
}

function collectDeckByCanonicalName(
  state: GameState,
  playerId: PlayerId,
  targetName: string,
): string[] {
  const target = canonicalCardName(targetName);
  const player = state.players[playerId];
  return player.deck
    .filter((c) => canonicalCardName(cardName(state.definitions, c.cardId)) === target)
    .map((c) => c.instanceId);
}

function collectHandByFeature(state: GameState, playerId: PlayerId, feature: string): string[] {
  const player = state.players[playerId];
  return player.hand
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes(feature))
    .map((c) => c.instanceId);
}

function collectOwnSVehicles(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.rush
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "vehicle" && def.size === "S";
    })
    .map((c) => c.instanceId);
}

function collectOwnSUnitsInCommand(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

function collectDeckByName(state: GameState, playerId: PlayerId, name: string): string[] {
  const target = canonicalCardName(name);
  const player = state.players[playerId];
  const viewedInstanceIds = player.deck.map((c) => c.instanceId);
  const validInstanceIds = player.deck
    .filter((c) => canonicalCardName(cardName(state.definitions, c.cardId)) === target)
    .map((c) => c.instanceId);
  return viewedInstanceIds.length > 0 && validInstanceIds.length > 0
    ? validInstanceIds
    : [];
}

function openChoice(
  state: GameState,
  ctx: GrantKeywordContext,
  choice: Omit<PendingEffectChoice, "playerId" | "effectId" | "sourceCardId" | "phasePlayerId"> & {
    sourceInstanceId?: string;
  },
): GameState | null {
  if (choice.validInstanceIds.length === 0 && choice.optional !== false) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    optional: ctx.optional ?? true,
    ...choice,
  });
}

export function applyHandNamedToRush(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState | null {
  const targetName = parseKeywordPayload(keyword, "hand_named_to_rush");
  if (!targetName) return null;
  const valid = collectHandByCanonicalName(state, ctx.playerId, targetName);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_hand",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "rush",
  });
}

export function applyDeckNamedRushShuffle(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState | null {
  const targetName = parseKeywordPayload(keyword, "deck_named_rush_shuffle");
  if (!targetName) return null;
  const player = state.players[ctx.playerId];
  if (player.deck.length === 0) return null;
  const valid = collectDeckByCanonicalName(state, ctx.playerId, targetName);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "scry_keep_one",
    validInstanceIds: valid,
    viewedInstanceIds: player.deck.map((c) => c.instanceId),
    selectCount: 1,
    unitDestination: "rush",
  });
}

export function applyTurnVehicleBattleWithoutRide(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectOwnSVehicles(state, ctx.playerId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "vehicle_battle_without_ride",
  });
}

export function applyDrawThenHandToDeckTop(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const player = state.players[ctx.playerId];
  if (player.deck.length === 0 || player.hand.length >= 6) return null;
  const drawn = requestDrawFromDeck(state, ctx.playerId, ctx.phasePlayerId, {
    count: 1,
    sourceCardId: ctx.sourceCardId,
  });
  if (drawn.pending) return drawn.state;
  const afterDraw = drawn.state;
  const handIds = afterDraw.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (handIds.length === 0) return null;
  return openChoice(afterDraw, ctx, {
    kind: "select_hand",
    validInstanceIds: handIds,
    selectCount: 1,
    unitDestination: "deck_top",
  });
}

export function applyTurnSUnitSpHalf(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectOwnSUnitsInCommand(state, ctx.playerId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_command",
    validInstanceIds: valid,
    selectCount: 1,
    commandAction: "sp_half",
  });
}

export function applyReleaseOwnSUnit(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectOwnSUnitsInCommand(state, ctx.playerId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_command",
    validInstanceIds: valid,
    selectCount: 1,
    commandAction: "release",
  });
}

export function applyHandOriginalFeatureMaouToRush(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectHandByFeature(state, ctx.playerId, "魔皇力");
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_hand",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "rush",
  });
}

export function applyTurnMirrorRiderPowerMinus(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState {
  const player = state.players[ctx.playerId];
  return {
    ...state,
    ...updatePlayer(state, ctx.playerId, addMirrorRiderPowerMinusRule(player, ctx.sourceCardId)),
  };
}

export function applyTurnAccelerateRushWaive(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState {
  const player = state.players[ctx.playerId];
  return {
    ...state,
    ...updatePlayer(state, ctx.playerId, addAccelerateRushWaiveRule(player, ctx.sourceCardId)),
  };
}

export function applyVehicleBattleWithoutRideChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    ...updatePlayer(state, playerId, markVehicleBattleWithoutRide(player, instanceId)),
  };
}

export function applyCommandSpHalfChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const found = findInZone(player, "command", instanceId);
  if (!found) return state;
  const command = [...player.command];
  command[found.index] = { ...found.card, spOverride: "1/2" };
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}

export function applyCommandReleaseChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const found = findInZone(player, "command", instanceId);
  if (!found) return state;
  const command = [...player.command];
  command[found.index] = { ...found.card, commandHeld: false };
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}

function rematchBranchPrimitives(
  branchText: string,
  effect: NonNullable<ReturnType<typeof getDslEffectById>>,
): EffectPrimitive[] | null {
  const rematched = rematchEffectPrimitives(branchText, {
    name: effect.name,
    kind: "body",
    trigger: effect.trigger,
  });
  if (!rematched) return null;
  if (
    rematched.some(
      (p) => p.type === "grant_keyword" && isCatchallGrantKeyword(p.keyword),
    )
  ) {
    return null;
  }
  return rematched;
}

export function applyPickEffectBranch(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  if (!effect?.text) return null;
  const branches = splitChoiceBranches(effect.text);
  if (!branches) return null;

  const branchPrimitives: EffectPrimitive[][] = [];
  const validInstanceIds: string[] = [];
  for (let i = 0; i < branches.length; i += 1) {
    const primitives = rematchBranchPrimitives(branches[i]!, effect);
    if (!primitives) return null;
    branchPrimitives.push(primitives);
    validInstanceIds.push(String(i));
  }
  if (validInstanceIds.length < 2) return null;

  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "pick_effect_branch",
    validInstanceIds,
    selectCount: 1,
    optional: ctx.optional ?? true,
    choiceBranchMeta: { branchPrimitives },
  });
}

function decodeFeatureSlug(slug: string): string | null {
  if (slug === "amadamu") return "アマダム";
  if (slug === "no_seki") return "賢者の石";
  if (slug === "den_o") return "DEN-O";
  try {
    const decoded = Buffer.from(slug, "hex").toString("utf8");
    if (decoded.length >= 1 && /[\u3040-\u9fff]/.test(decoded)) return decoded;
  } catch {
    /* ignore */
  }
  return null;
}

function parseHandResidentFeature(keyword: string): string | null {
  const m = keyword.match(/^hand_resident_rush_(.+)$/);
  if (!m) return null;
  return decodeFeatureSlug(m[1]!) ?? m[1]!;
}

function parseRecruitFeature(keyword: string): string | null {
  const m = keyword.match(/^recruit_(.+)_deck_resident$/);
  if (!m) return null;
  return decodeFeatureSlug(m[1]!) ?? m[1]!;
}

function unitHasOriginalFeature(
  definitions: GameState["definitions"],
  cardId: string,
  feature: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  return def?.type === "unit" && (def.features ?? []).includes(feature);
}

function collectHandOrResidentFeatureUnits(
  state: GameState,
  playerId: PlayerId,
  feature: string,
): string[] {
  const player = state.players[playerId];
  const ids: string[] = [];
  for (const card of player.hand) {
    if (unitHasOriginalFeature(state.definitions, card.cardId, feature)) {
      ids.push(card.instanceId);
    }
  }
  for (const card of player.operation) {
    if (card.faceDown) continue;
    if (unitHasOriginalFeature(state.definitions, card.cardId, feature)) {
      ids.push(card.instanceId);
    }
  }
  return ids;
}

function collectDeckOrResidentFeatureUnits(
  state: GameState,
  playerId: PlayerId,
  feature: string,
): { deckIds: string[]; residentIds: string[] } {
  const player = state.players[playerId];
  const deckIds = player.deck
    .filter((c) => unitHasOriginalFeature(state.definitions, c.cardId, feature))
    .map((c) => c.instanceId);
  const residentIds = player.operation
    .filter((c) => !c.faceDown && unitHasOriginalFeature(state.definitions, c.cardId, feature))
    .map((c) => c.instanceId);
  return { deckIds, residentIds };
}

/** BK-011/012: 手札または常駐から特徴ユニットをラッシュへ。 */
export function applyHandOrResidentFeatureToRush(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState | null {
  const feature = parseHandResidentFeature(keyword);
  if (!feature) return null;
  const valid = collectHandOrResidentFeatureUnits(state, ctx.playerId, feature);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_hand",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "rush",
    optional: ctx.optional ?? true,
    handResidentRushMeta: { feature, drawIfFromHand: true },
  });
}

/** BK-018: 山札または常駐から特徴ユニットをラッシュへ。 */
export function applyDeckOrResidentFeatureToRush(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState | null {
  const feature = parseRecruitFeature(keyword);
  if (!feature) return null;
  const { deckIds, residentIds } = collectDeckOrResidentFeatureUnits(
    state,
    ctx.playerId,
    feature,
  );
  const valid = [...deckIds, ...residentIds];
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_hand",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "rush",
    optional: ctx.optional ?? true,
    handResidentRushMeta: {
      feature,
      shuffleIfFromDeck: deckIds.length > 0,
      residentIds,
    },
  });
}

export function continuePickEffectBranch(
  state: GameState,
  pending: PendingEffectChoice,
  branchIndex: string,
): { state: GameState; pending?: boolean; detail?: string } {
  const meta = pending.choiceBranchMeta;
  if (!meta) return { state, detail: "no_branch_meta" };
  const index = Number(branchIndex);
  const primitives = meta.branchPrimitives[index];
  if (!primitives) return { state, detail: "invalid_branch" };

  const ctx = {
    effectId: pending.effectId,
    sourceCardId: pending.sourceCardId,
    playerId: pending.playerId,
    phasePlayerId: pending.phasePlayerId,
    operationInstanceId: pending.sourceInstanceId,
    discardOperation: true,
    optional: pending.optional,
  };
  const cleared = { ...state, pendingEffectChoice: undefined };
  const outcome = interpretEffectPrimitives(cleared, ctx, primitives);
  return {
    state: outcome.state,
    pending: !!outcome.state.pendingEffectChoice,
    detail: outcome.detail,
  };
}
