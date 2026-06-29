import type { Category } from "@rangers-strike/cards";
import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../types/game";
import type { GrantKeywordContext } from "../dsl/grantKeyword";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { collectPowerIds, openEffectChoice } from "./pendingChoices";

const BIG_BATON_FEATURES = ["レッド", "ブルー", "グリーン", "ピンク"] as const;

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function playerZones(player: GameState["players"][PlayerId]): CardInstance[] {
  const p = player;
  return [...p.rush, ...p.battle, ...p.command];
}

function opponentHasMaChikara(state: GameState, playerId: PlayerId): boolean {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  return [...enemy.rush, ...enemy.battle].some((c) =>
    findNamedEffectByEffectId(c.cardId, "ma_chikara"),
  );
}

function commandZoneFeatures(
  state: GameState,
  playerId: PlayerId,
): Set<string> {
  const features = new Set<string>();
  for (const card of state.players[playerId].command) {
    const def = getDefinition(state.definitions, card.cardId);
    for (const feature of def?.features ?? []) {
      features.add(feature);
    }
  }
  return features;
}

export function plasmaShockwaveActive(state: GameState): boolean {
  for (const playerId of ["player1", "player2"] as const) {
    const zones = state.players[playerId];
    if (
      zones.rush.some((c) => c.cardId === "SR-007") ||
      zones.battle.some((c) => c.cardId === "SR-007")
    ) {
      return true;
    }
  }
  return false;
}

/** SR-004 妖魔力: 相手の OT/ET コマンドをリリース直後にホールド。 */
export function applyOpponentHoldOtEtOnCommandRelease(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (!opponentHasMaChikara(state, playerId)) return state;

  const player = state.players[playerId];
  let changed = false;
  const command = player.command.map((card) => {
    if (card.commandHeld) return card;
    const def = getDefinition(state.definitions, card.cardId);
    const cats = cardCategories(def);
    if (!cats.includes("OT") && !cats.includes("ET")) return card;
    changed = true;
    return { ...card, commandHeld: true, mothershipHold: false };
  });

  if (!changed) return state;
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}

/** SR-007: スタート終了時、大神龍以外がいなければ山札へ。 */
export function applyPlasmaShockwaveShuffleBack(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (!plasmaShockwaveActive(state)) return state;

  const player = state.players[playerId];
  const hasOtherUnits = player.battle.some((card) => {
    const name = getDefinition(state.definitions, card.cardId)?.name;
    return name !== "大神龍";
  });
  if (hasOtherUnits) return state;

  const toReturn = player.battle.filter((c) => c.cardId === "SR-007");
  if (toReturn.length === 0) return state;

  const remainingBattle = player.battle.filter((c) => c.cardId !== "SR-007");
  const deck = shuffleDeck([...player.deck, ...toReturn]);

  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle: remainingBattle,
      deck,
    }),
  };
}

/** SR-003 龍撃剣＆獣奏剣: 捨札の恐竜1枚につきBP+1000。 */
export function sr003DiscardDinoBpBonus(
  state: GameState,
  playerId: PlayerId,
): number {
  if (state.activePlayer !== playerId) return 0;
  const discard = state.players[playerId].discard;
  const count = discard.filter((c) =>
    getDefinition(state.definitions, c.cardId)?.features?.includes("恐竜"),
  ).length;
  return count * 1000;
}

/** SR-003: BP8000以上で SP1。 */
export function sr003SpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (instance.cardId !== "SR-003" || state.activePlayer !== playerId) return 0;
  const bp = effectiveBp(state, playerId, instance);
  return bp >= 8000 ? 1 : 0;
}

export function srBigBatonHasFeature(
  state: GameState,
  playerId: PlayerId,
  feature: (typeof BIG_BATON_FEATURES)[number],
): boolean {
  const onField = playerZones(state.players[playerId]).some((c) => c.cardId === "SR-008");
  if (!onField) return false;
  return commandZoneFeatures(state, playerId).has(feature);
}

export function srBigBatonRegisterActive(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  return cardId === "SR-008" && srBigBatonHasFeature(state, playerId, "レッド");
}

export function srBigBatonTaxisCategory(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): "ET" | null {
  if (cardId !== "SR-008") return null;
  return srBigBatonHasFeature(state, playerId, "ブルー") ? "ET" : null;
}

export function srBigBatonBpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (instance.cardId !== "SR-008") return 0;
  return srBigBatonHasFeature(state, playerId, "グリーン") ? 7000 : 0;
}

export function srBigBatonSpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (instance.cardId !== "SR-008") return 0;
  return srBigBatonHasFeature(state, playerId, "ピンク") ? 1 : 0;
}

/** SR-005 バトライズファイヤードライブ: パワー捨て後に同必要パワーの敵Sを撃破。 */
export function findEnemySWithPowerCost(
  state: GameState,
  enemyId: PlayerId,
  powerCost: number,
): CardInstance[] {
  const matches: CardInstance[] = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of state.players[enemyId][zone]) {
      if (!isSmallUnit(state.definitions, card.cardId)) continue;
      const cost = parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost ?? 99);
      if (cost === powerCost) matches.push(card);
    }
  }
  return matches;
}

const RUSH_SEND_CATEGORY_RE =
  /^on_rush_send_rush_(wb|ot|ma|et|da)_to_power_sp1$/;

export function grantSp1ToRushUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const rush = player.rush.map((c) =>
    c.instanceId === instanceId
      ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
      : c,
  );
  return { ...state, ...updatePlayer(state, playerId, { ...player, rush }) };
}

export function playerHasShurikenFm(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return [...player.rush, ...player.battle].some((c) => c.cardId === "SR-006");
}

function collectRushUnitsByCategory(
  state: GameState,
  playerId: PlayerId,
  category: Category,
): string[] {
  return state.players[playerId].rush
    .filter((c) => cardCategories(getDefinition(state.definitions, c.cardId)).includes(category))
    .map((c) => c.instanceId);
}

export function startOnRushSendToPowerSp1(
  state: GameState,
  ctx: GrantKeywordContext,
  category: Category,
): GameState | null {
  const valid = collectRushUnitsByCategory(state, ctx.playerId, category);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: `on_rush_send_rush_${category.toLowerCase()}_to_power_sp1`,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "power",
    optional: ctx.optional ?? true,
  });
}

export function startDestroyPowerMatchOnRush(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectPowerIds(state, ctx.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "destroy_power_match_on_rush",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_power",
    validInstanceIds: valid,
    selectCount: 1,
    optional: ctx.optional ?? true,
  });
}

/** SR-006: 山札公開前に分身魔球の任意差し替えを挟む。 */
export function maybeInterceptDeckRevealForShuriken(
  state: GameState,
  choice: PendingEffectChoice,
): GameState | null {
  if (choice.kind !== "scry_keep_one") return null;
  if (choice.skipShurikenIntercept) return null;
  if (choice.effectId?.startsWith("shuriken_")) return null;
  if (choice.shurikenMeta) return null;
  if (!playerHasShurikenFm(state, choice.playerId)) return null;

  const viewed = choice.viewedInstanceIds ?? [];
  if (viewed.length !== 1) return null;
  const player = state.players[choice.playerId];
  const top = player.deck[0];
  if (!top || top.instanceId !== viewed[0]) return null;
  if (player.hand.length === 0) return null;

  return openEffectChoice(state, {
    playerId: choice.playerId,
    effectId: "shuriken_deck_reveal_swap",
    sourceCardId: "SR-006",
    phasePlayerId: choice.phasePlayerId,
    kind: "confirm",
    validInstanceIds: ["accept", "decline"],
    optional: true,
    shurikenMeta: {
      step: "confirm",
      revealedInstanceId: top.instanceId,
      resume: choice,
    },
  });
}

export function applyShurikenRevealToHand(
  state: GameState,
  playerId: PlayerId,
  revealedInstanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "deck", revealedInstanceId);
  if (!found) return null;
  const [, deck] = removeAt(player.deck, found.index);
  const revealed = { ...found.card, faceDown: false };
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck,
      hand: [...player.hand, revealed],
    }),
  };
}

export function completeShurikenDeckRevealSwap(
  state: GameState,
  pending: PendingEffectChoice,
  substituteInstanceId: string,
): { state: GameState; detail: string } | { error: string } {
  const meta = pending.shurikenMeta;
  if (!meta) return { error: "invalid_meta" };

  const player = state.players[pending.playerId];
  const substituteFound = findInZone(player, "hand", substituteInstanceId);
  if (!substituteFound) return { error: "invalid_target" };

  const resume = meta.resume;
  const substitute = substituteFound.card;
  const [, handWithoutSub] = removeAt(player.hand, substituteFound.index);

  let nextPlayer: PlayerState;
  if (resume.unitDestination === "rush") {
    nextPlayer = {
      ...player,
      hand: handWithoutSub,
      deck: shuffleDeck([...player.deck]),
      rush: [...player.rush, substitute],
    };
  } else {
    nextPlayer = {
      ...player,
      hand: handWithoutSub,
      deck: [substitute, ...player.deck],
    };
  }

  return {
    state: { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
    detail: substitute.cardId,
  };
}

export function matchSrGrantKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): { state: GameState; detail?: string } | null {
  if (keyword === "destroy_power_match_on_rush") {
    const next = startDestroyPowerMatchOnRush(state, ctx);
    return next
      ? { state: next, detail: keyword }
      : { state, detail: `${keyword}:no_targets` };
  }

  const rushSend = keyword.match(RUSH_SEND_CATEGORY_RE);
  if (rushSend) {
    const category = rushSend[1]!.toUpperCase() as Category;
    const next = startOnRushSendToPowerSp1(state, ctx, category);
    return next
      ? { state: next, detail: keyword }
      : { state, detail: `${keyword}:no_targets` };
  }

  if (keyword === "on_deck_reveal_swap_effect_target") {
    return { state, detail: keyword };
  }

  if (
    keyword === "mecha_fusion_command_substitute" ||
    keyword === "opponent_must_hold_ot_et_on_command_release" ||
    keyword.startsWith("plasma_shockwave_start_phase") ||
    keyword === "big_baton_command_zone_features" ||
    keyword === "bp_plus_per_discard_feature_fx_unknown_1000_sp_at_8000" ||
    keyword === "destroy_on_win_vs_sp1" ||
    keyword === "attacked_bp_boost_5000" ||
    keyword === "cannot_attack"
  ) {
    return { state, detail: keyword };
  }

  return null;
}
