import type { CardDefinition, Category } from "@rangers-strike/cards";
import {
  canonicalCardName,
  cardCategories,
  fusionMaterialAliasNames,
  needsZordDownPayment,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  canRushUnitExceptCommandHold,
  cardName,
  getDefinition,
  rushPowerCost,
} from "../core/catalog";
import { removeAt, updatePlayer } from "../core/helpers";
import { listDslEffectsForTrigger } from "../dsl/effectLookup";
import { payPowerCost } from "../core/power";
import { emitUnitRushedAndFinalize } from "../events/emitUnitRushed";
import { findZordDownMaterial, applyZordDownMaterial } from "./zordDown";
import { applyZordMaterial, findZordMaterial, needsZordMaterial } from "./zord";
import { openEffectChoice } from "./pendingChoices";
import { markRushedThisTurn } from "./turnModifiers";

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function parseCastoffTargetName(text: string): string | null {
  const match = text.match(/「([^」]+)」/);
  return match?.[1] ?? null;
}

export function castoffTargetNameForCard(cardId: string): string | null {
  for (const effect of listDslEffectsForTrigger(cardId, "on_rush")) {
    if (!effect.effects.some((p) => p.type === "grant_keyword" && p.keyword === "castoff_on_rush")) {
      continue;
    }
    const name = parseCastoffTargetName(effect.text ?? "");
    if (name) return name;
  }
  return null;
}

function deckCardsMatchingName(
  state: GameState,
  playerId: PlayerId,
  targetName: string,
): string[] {
  const player = state.players[playerId];
  const target = canonicalCardName(targetName);
  return player.deck
    .filter((card) => {
      if (canonicalCardName(cardName(state.definitions, card.cardId)) === target) {
        return true;
      }
      // 「〜としてつかえる」別名（XG1-070 ディケイド カブトRF 等）も対象にする
      const def = getDefinition(state.definitions, card.cardId);
      return fusionMaterialAliasNames(def?.text).includes(target);
    })
    .map((card) => card.instanceId);
}

/** キャストオフ元 MF（ラッシュ済み）を、山札からラッシュするカードの追加条件素材に使う。 */
function castoffZordMaterialInstanceId(
  definitions: Record<string, CardDefinition>,
  deckCardId: string,
  def: CardDefinition,
  mfInstanceId: string,
): string | undefined {
  if (needsZordDownPayment(deckCardId, def.powerCost, def)) {
    return mfInstanceId;
  }
  if (needsZordMaterial(definitions, deckCardId)) {
    return mfInstanceId;
  }
  return undefined;
}

function canCastoffRushDeckCard(
  state: GameState,
  playerId: PlayerId,
  deckInstanceId: string,
  mfInstanceId: string,
): boolean {
  const player = state.players[playerId];
  const deckCard = player.deck.find((c) => c.instanceId === deckInstanceId);
  if (!deckCard) return false;
  const def = getDefinition(state.definitions, deckCard.cardId);
  if (!def || def.type !== "unit") return false;

  const zordMaterialInstanceId = castoffZordMaterialInstanceId(
    state.definitions,
    deckCard.cardId,
    def,
    mfInstanceId,
  );

  return canRushUnitExceptCommandHold(
    player,
    state.definitions,
    def,
    deckInstanceId,
    zordMaterialInstanceId,
    undefined,
    undefined,
    undefined,
    { ...state, playerId },
  );
}

export function beginCastoffOnRush(
  state: GameState,
  params: {
    playerId: PlayerId;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const targetName = castoffTargetNameForCard(params.sourceCardId);
  if (!targetName) return null;

  const player = state.players[params.playerId];
  const otCommands = player.command
    .filter((cmd) => {
      if (cmd.commandHeld) return false;
      const cats = cardCategories(getDefinition(state.definitions, cmd.cardId));
      return cats.includes("OT" as Category);
    })
    .map((cmd) => cmd.instanceId);
  if (otCommands.length === 0) return null;

  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: "castoff_hold_command",
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "select_command",
    validInstanceIds: otCommands,
    selectCount: 1,
    optional: true,
    commandAction: "hold",
    castoffTargetName: targetName,
    castoffMfInstanceId: params.sourceInstanceId,
  });
}

export function continueCastoffAfterHold(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): GameState | null {
  const targetName = pending.castoffTargetName;
  const mfInstanceId = pending.castoffMfInstanceId;
  if (!targetName || !mfInstanceId) return null;

  const validInstanceIds = deckCardsMatchingName(state, pending.playerId, targetName).filter(
    (id) => canCastoffRushDeckCard(state, pending.playerId, id, mfInstanceId),
  );
  if (validInstanceIds.length === 0) return null;

  const player = state.players[pending.playerId];
  const viewedInstanceIds = player.deck.map((c) => c.instanceId);

  return openEffectChoice(state, {
    playerId: pending.playerId,
    effectId: "castoff_deck_rush",
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    phasePlayerId: pending.phasePlayerId,
    kind: "scry_keep_one",
    validInstanceIds,
    viewedInstanceIds,
    selectCount: 1,
    optional: false,
    unitDestination: "rush",
    castoffTargetName: targetName,
    castoffMfInstanceId: mfInstanceId,
  });
}

export function applyCastoffDeckRush(
  state: GameState,
  playerId: PlayerId,
  deckInstanceId: string,
  mfInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; log?: string } | null {
  const player = state.players[playerId];
  const deckIndex = player.deck.findIndex((c) => c.instanceId === deckInstanceId);
  if (deckIndex < 0) return null;

  const [deckCard] = player.deck.slice(deckIndex, deckIndex + 1);
  if (!deckCard) return null;
  const def = getDefinition(state.definitions, deckCard.cardId);
  if (!def) return null;

  const zordMaterialInstanceId = castoffZordMaterialInstanceId(
    state.definitions,
    deckCard.cardId,
    def,
    mfInstanceId,
  );

  if (
    !canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      deckInstanceId,
      zordMaterialInstanceId,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }

  let nextPlayer = player;
  const cost = rushPowerCost(
    { ...state, players: { ...state.players, [playerId]: nextPlayer } },
    playerId,
    def,
    { zordMaterialInstanceId },
  );

  if (zordMaterialInstanceId) {
    if (needsZordDownPayment(deckCard.cardId, def.powerCost, def)) {
      const applied = applyZordDownMaterial(
        nextPlayer,
        state.definitions,
        deckCard.cardId,
        deckInstanceId,
        zordMaterialInstanceId,
        undefined,
      );
      if (!applied) return null;
      nextPlayer = applied;
    } else if (needsZordMaterial(state.definitions, deckCard.cardId)) {
      const applied = applyZordMaterial(
        nextPlayer,
        state.definitions,
        deckCard.cardId,
        deckInstanceId,
        zordMaterialInstanceId,
      );
      if (!applied) return null;
      nextPlayer = applied;
    }
  }

  if (!payPowerCost({ ...state, players: { ...state.players, [playerId]: nextPlayer } }, playerId, cost)) {
    return null;
  }

  const [, remainingDeck] = removeAt(nextPlayer.deck, deckIndex);
  let rushCard = deckCard;
  if (zordMaterialInstanceId) {
    const material =
      findZordDownMaterial(
        player,
        state.definitions,
        deckCard.cardId,
        deckInstanceId,
        zordMaterialInstanceId,
      ) ??
      findZordMaterial(
        player,
        state.definitions,
        deckCard.cardId,
        deckInstanceId,
        zordMaterialInstanceId,
      );
    if (material) {
      rushCard = { ...rushCard, zordMaterialCardId: material.card.cardId };
    }
  }

  nextPlayer = {
    ...nextPlayer,
    deck: shuffleDeck(remainingDeck),
    rush: [...nextPlayer.rush, rushCard],
  };
  nextPlayer = markRushedThisTurn(nextPlayer, deckInstanceId);

  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, playerId, nextPlayer),
  };

  const rushFinal = emitUnitRushedAndFinalize(
    nextState,
    playerId,
    deckInstanceId,
    phasePlayerId,
  );

  return {
    state: {
      ...rushFinal.state,
      log: [...rushFinal.state.log, ...rushFinal.logs],
    },
    log: cardName(state.definitions, deckCard.cardId),
  };
}
