import { canonicalCardName } from "@rangers-strike/cards";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { findInZone } from "../core/helpers";
import type { GrantKeywordContext } from "../dsl/grantKeyword";
import { findCardOwner } from "./fieldLookup";
import { openEffectChoice } from "./pendingChoices";

export const MURPHY_CHASE_EFFECT_ID = "fx_unknown_e8bfbd";

export function collectMurphyChaseUnitTargets(state: GameState): string[] {
  const ids: string[] = [];
  for (const playerId of ["player1", "player2"] as const) {
    for (const zone of ["rush", "battle"] as const) {
      for (const card of state.players[playerId][zone]) {
        const def = getDefinition(state.definitions, card.cardId);
        if (def?.type !== "unit" || def.size !== "S") continue;
        if ((def.features ?? []).includes("メカ")) continue;
        ids.push(card.instanceId);
      }
    }
  }
  return ids;
}

export function collectMurphyChaseDeckTargets(
  state: GameState,
  playerId: PlayerId,
  referenceInstanceId: string,
): { validInstanceIds: string[]; viewedInstanceIds: string[] } {
  const located = findCardOwner(state, referenceInstanceId);
  if (!located) return { validInstanceIds: [], viewedInstanceIds: [] };

  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, referenceInstanceId);
  if (!found) return { validInstanceIds: [], viewedInstanceIds: [] };

  const targetName = canonicalCardName(cardName(state.definitions, found.card.cardId));
  const player = state.players[playerId];
  const viewedInstanceIds = player.deck.map((c) => c.instanceId);
  const validInstanceIds = player.deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit") return false;
      return canonicalCardName(cardName(state.definitions, c.cardId)) === targetName;
    })
    .map((c) => c.instanceId);

  return { validInstanceIds, viewedInstanceIds };
}

export function startMurphyChaseChoice(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const validInstanceIds = collectMurphyChaseUnitTargets(state);
  if (validInstanceIds.length === 0) return null;

  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: MURPHY_CHASE_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds,
    selectCount: 1,
    optional: ctx.optional ?? true,
  });
}

export function openMurphyChaseDeckChoice(
  state: GameState,
  pending: PendingEffectChoice,
  selectedInstanceId: string,
): GameState | null {
  const player = state.players[pending.playerId];
  if (player.deck.length === 0 || player.hand.length >= 6) return null;

  const { validInstanceIds, viewedInstanceIds } = collectMurphyChaseDeckTargets(
    state,
    pending.playerId,
    selectedInstanceId,
  );
  if (validInstanceIds.length === 0) return null;

  return openEffectChoice(state, {
    playerId: pending.playerId,
    effectId: pending.effectId,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    phasePlayerId: pending.phasePlayerId,
    kind: "scry_keep_one",
    validInstanceIds,
    viewedInstanceIds,
    selectCount: 1,
    optional: true,
    unitDestination: "hand",
  });
}
