import type { Category } from "@rangers-strike/cards";
import { DECK_BOTTOM_ORDER_RESET } from "../rules/deckBottomOrder";
import { pickSet8BCpuChoice } from "../rules/legend1/set8NamedEffectsB";
import { cpuAcceptsOptionalEffect } from "../rules/optionalEffects";
import { pickSet7DCpuChoice } from "../rules/legend1/set7NamedEffectsD";
import { pickSet8DCpuChoice } from "../rules/legend1/set8NamedEffectsD";
import { pickSet9ACpuChoice } from "../rules/legend1/set9NamedEffectsA";
import { pickSet9DCpuChoice } from "../rules/legend1/set9NamedEffectsD";
import { pickOtherLinesCpuChoice } from "../rules/legend1/otherLinesNamedEffects";
import { pickSet9BCpuChoice } from "../rules/legend1/set9NamedEffectsB";
import { ATTACK_HOLD_BONUS_EFFECT_ID, pickAttackHoldCount } from "../rules/attackHoldBonus";
import { RIDER_PASS_SEARCH_EFFECT_ID } from "../rules/rk/rk2UnitEffects";
import { RIDER_PASS_CARD, RIDER_PASS_UNIT } from "../rules/errataCardEffects";
import { HOMERUN_HOLD_EFFECT_ID, HOMERUN_REVEAL_EFFECT_ID } from "../rules/legend1/set5NamedEffectsA";
import { BOOK_EFFECT_ID } from "../rules/xg2/xg2dEffects";
import { getCardEffect, listZordFusionPartnerIds } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { memoizeInSearch } from "../core/searchCache";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  hasReleasedCommandForCategories,
  parsePowerCost,
} from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { findInZone, opponent } from "../core/helpers";
import { damagePaymentChoosingPlayer } from "../rules/damagePayment";
import { getLegalActions } from "../core/legalActions";
import {
  countHeldCommands,
  findMandatoryBattleEntries,
} from "../rules/restrictions";
import { findCardOwner } from "../rules/fieldLookup";
import { findDirectZordRushAction } from "../core/legalActions";
import { strikeDamageFor } from "../rules/combo";
import {
  hasAllRequiredFusionMaterials,
  needsZordMaterial,
  requiresAllFusionPartners,
} from "../rules/zord";
import {
  advanceZordSetup,
  canBeginZordSetup,
  listZordSetupResolveActions,
} from "../rules/zordSetup";
import {
  canToggleBpBudgetTarget,
  budgetBpForInstance,
} from "../rules/pendingChoices";
import { COMMAND_ZONE_MAX, WIN_DAMAGE } from "../types/game";
import { evaluateState } from "./scoring";
import { isSet7CChoiceEffect, QUIZ_DECLARE_EFFECT_ID, REVOLVER_PICK_EFFECT_ID } from "../rules/legend1/set7NamedEffectsC";
import { isSet8CChoiceEffect } from "../rules/legend1/set8NamedEffectsC";
import { isSet9CChoiceEffect } from "../rules/legend1/set9NamedEffectsC";
import {
  getBattleEntryPaymentNeeds,
  getCategoryPaymentOptions,
  needsEffectHoldPayment,
  validatePaymentSelection,
} from "../rules/commandPayment";

export function endPhase(actions: GameAction[]): GameAction | null {
  return actions.find((action) => action.type === "end_phase") ?? null;
}

export function actionsOfType<T extends GameAction["type"]>(
  actions: GameAction[],
  type: T,
): Extract<GameAction, { type: T }>[] {
  return actions.filter((action): action is Extract<GameAction, { type: T }> => action.type === type);
}

function categoriesNeededFromHand(
  state: GameState,
  playerId: PlayerId,
): Category[] {
  const player = state.players[playerId];
  const needed = new Set<Category>();
  for (const card of player.hand) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def) continue;
    if (def.type === "unit" || def.type === "operation") {
      for (const cat of cardCategories(def)) {
        needed.add(cat);
      }
    }
  }
  return [...needed];
}

function handNeedsCommandSupport(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const neededCats = categoriesNeededFromHand(state, playerId);
  if (neededCats.length === 0) return false;
  const player = state.players[playerId];
  return neededCats.some(
    (cat) => !hasReleasedCommandForCategories(player, state.definitions, [cat]),
  );
}

/** デッキまたは手札に残っているユニット/オペレーションカードの最大パワーコスト。 */
export function deckMaxRequiredPower(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  let max = 0;
  for (const card of [...player.deck, ...player.hand]) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || (def.type !== "unit" && def.type !== "operation")) continue;
    max = Math.max(max, parsePowerCost(def.powerCost));
  }
  return max;
}

function powerChargeAtCap(state: GameState, playerId: PlayerId): boolean {
  const cap = deckMaxRequiredPower(state, playerId);
  if (cap <= 0) return true;
  return state.players[playerId].power.length >= cap;
}

function maxRushPowerCostWithCommandSupport(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = state.players[playerId];
  let max = 0;
  for (const card of player.hand) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || def.type !== "unit") continue;
    if (!hasReleasedCommandForCategories(player, state.definitions, cardCategories(def))) {
      continue;
    }
    max = Math.max(max, parsePowerCost(def.powerCost));
  }
  return max;
}

function hasAdequatePowerForHandRushes(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  let needsAny = false;
  for (const card of player.hand) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || def.type !== "unit") continue;
    if (!hasReleasedCommandForCategories(player, state.definitions, cardCategories(def))) {
      continue;
    }
    needsAny = true;
    const cost = effectivePowerCost(state, playerId, parsePowerCost(def.powerCost));
    if (countAvailablePower(state, playerId) < cost) return false;
  }
  return needsAny;
}

function handNeedsPowerForRush(
  state: GameState,
  playerId: PlayerId,
): boolean {
  if (powerChargeAtCap(state, playerId)) return false;
  if (hasAdequatePowerForHandRushes(state, playerId)) return false;
  const player = state.players[playerId];
  for (const card of player.hand) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || def.type !== "unit") continue;
    if (!hasReleasedCommandForCategories(player, state.definitions, cardCategories(def))) {
      continue;
    }
    const cost = effectivePowerCost(state, playerId, parsePowerCost(def.powerCost));
    if (countAvailablePower(state, playerId) < cost) return true;
  }
  return false;
}

function handHasFusionZord(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return [...player.hand, ...player.deck].some((card) =>
    requiresAllFusionPartners(card.cardId),
  );
}

function isFusionPartnerForHandZord(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const player = state.players[playerId];
  for (const pileCard of [...player.hand, ...player.deck]) {
    if (!requiresAllFusionPartners(pileCard.cardId)) continue;
    if (listZordFusionPartnerIds(pileCard.cardId).includes(cardId)) return true;
  }
  return false;
}

function fusionPartnerOnField(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const player = state.players[playerId];
  return (
    player.rush.some((c) => c.cardId === cardId) ||
    player.battle.some((c) => c.cardId === cardId)
  );
}

/** 値が高いほど早くラッシュする。合体ゾードと致死ストライクダメージを優先。 */
export function scoreRushAction(
  state: GameState,
  action: Extract<GameAction, { type: "rush" }>,
): number {
  const playerId = action.playerId;
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === action.instanceId);
  if (!card) return Number.NEGATIVE_INFINITY;
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit") return Number.NEGATIVE_INFINITY;

  const bp = effectiveBp(state, playerId, card);
  const sp = strikeDamageFor(state.definitions, card, state, playerId);
  const enemy = state.players[opponent(playerId)];
  const lethalBonus = enemy.damage + sp >= WIN_DAMAGE ? 50_000 : 0;
  const deckLeft = player.deck.length;
  const deckPenalty = deckLeft < 10 ? (10 - deckLeft) * 400 : 0;
  // RS-586【魔神に不足する物】: 捨札にする「戦闘員」のユニットの損失。
  let score = bp + sp * 3_000 + lethalBonus - deckPenalty - godomDiscardPenalty(state, playerId, action.godomDiscardInstanceIds);

  if (requiresAllFusionPartners(card.cardId)) {
    if (
      hasAllRequiredFusionMaterials(
        player,
        state.definitions,
        card.cardId,
        card.instanceId,
      )
    ) {
      return 300_000 + score;
    }
    return 40_000 + score;
  }

  if (isFusionPartnerForHandZord(state, playerId, card.cardId)) {
    if (!fusionPartnerOnField(state, playerId, card.cardId)) {
      return 200_000 + score;
    }
    return 10_000 + score;
  }

  if (needsZordMaterial(state.definitions, card.cardId)) {
    return 100_000 + score;
  }

  if (handHasFusionZord(state, playerId)) {
    return score;
  }

  return score;
}

/** 手札に、今すぐまたはカテゴリ支援取得後にラッシュできるユニットがある。 */
export function handHasRushUnits(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  return player.hand.some((card) => {
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit";
  });
}

function unitCanRushNow(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === instanceId);
  if (!card) return false;
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit") return false;
  const categories = cardCategories(def);
  if (!hasReleasedCommandForCategories(player, state.definitions, categories)) {
    return false;
  }
  const cost = effectivePowerCost(state, playerId, parsePowerCost(def.powerCost));
  return countAvailablePower(state, playerId) >= cost;
}

function scoreChargeCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  mode: "command" | "power",
): number {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === instanceId);
  if (!card) return -1;
  const def = getDefinition(state.definitions, card.cardId);
  if (!def) return -1;

  let score = 0;
  const neededCats = categoriesNeededFromHand(state, playerId);

  if (mode === "power" && def.type === "unit") {
    score += 120 + parsePowerCost(def.powerCost) * 15;
    if (isFusionPartnerForHandZord(state, playerId, card.cardId)) score += 250;
    if (requiresAllFusionPartners(card.cardId) || needsZordMaterial(state.definitions, card.cardId)) {
      score += 180;
    }
    if (unitCanRushNow(state, playerId, instanceId)) score += 80;
    else if (handNeedsPowerForRush(state, playerId)) score += 40;
  }

  if (mode === "command") {
    if (def.type === "operation") score += 40;
    for (const cat of cardCategories(def)) {
      if (neededCats.includes(cat)) score += 25;
    }
    if (def.type === "unit") score -= 60;
  }

  return score;
}

function pickBestChargeAction(
  state: GameState,
  playerId: PlayerId,
  actions: Extract<GameAction, { type: "charge_command" | "charge_power" }>[],
  mode: "command" | "power",
): GameAction | null {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    const score = scoreChargeCard(state, playerId, action.instanceId, mode);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

/** 先読みで比べるチャージの候補: パワー・コマンドそれぞれ評価の高いカード perMode 枚と、チャージしない。 */
export function chargeCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  perMode: number,
): GameAction[] {
  const top = (mode: "command" | "power") =>
    actionsOfType(actions, mode === "power" ? "charge_power" : "charge_command")
      .map((action) => ({ action, score: scoreChargeCard(state, playerId, action.instanceId, mode) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, perMode)
      .map((e) => e.action);
  const end = endPhase(actions);
  return [...top("power"), ...top("command"), ...(end ? [end] : [])];
}

/** チャージフェイズで charge_power と charge_command のどちらを選ぶか。 */
export function pickChargeAction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const player = state.players[playerId];
  const commands = actionsOfType(actions, "charge_command");
  const powers = actionsOfType(actions, "charge_power");
  const end = endPhase(actions);

  const emptyCommandZone = player.command.length === 0;
  const needsCommand = handNeedsCommandSupport(state, playerId);
  const needsPower = handNeedsPowerForRush(state, playerId);
  const hasRushUnits = handHasRushUnits(state, playerId);
  const thinDeck = player.deck.length < 12;

  if (
    emptyCommandZone &&
    needsCommand &&
    hasRushUnits &&
    commands.length > 0
  ) {
    return pickBestChargeAction(state, playerId, commands, "command");
  }

  if (needsPower && powers.length > 0) {
    return pickBestChargeAction(state, playerId, powers, "power");
  }

  if (needsCommand && commands.length > 0) {
    return pickBestChargeAction(state, playerId, commands, "command");
  }

  if (hasAdequatePowerForHandRushes(state, playerId) || powerChargeAtCap(state, playerId)) {
    if (
      emptyCommandZone &&
      needsCommand &&
      hasRushUnits &&
      commands.length > 0
    ) {
      return pickBestChargeAction(state, playerId, commands, "command");
    }
    return end;
  }

  if (thinDeck && end && !needsCommand && !needsPower) {
    return end;
  }

  if (powers.length > 0) {
    return pickBestChargeAction(state, playerId, powers, "power");
  }

  if (commands.length > 0) {
    return pickBestChargeAction(state, playerId, commands, "command");
  }

  return end;
}

export function pickMandatoryBattleMove(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const mandatory = new Set(
    findMandatoryBattleEntries(state, playerId).map((card) => card.instanceId),
  );
  if (mandatory.size === 0) return null;

  const moves = actionsOfType(actions, "move_to_battle").filter((action) =>
    mandatory.has(action.instanceId),
  );
  if (moves.length === 0) return null;

  let best = moves[0]!;
  let bestBp = -1;
  for (const move of moves) {
    const player = state.players[playerId];
    const card =
      player.rush.find((c) => c.instanceId === move.instanceId) ??
      player.hand.find((c) => c.instanceId === move.instanceId);
    if (!card) continue;
    const bp = effectiveBp(state, playerId, card);
    if (bp > bestBp) {
      bestBp = bp;
      best = move;
    }
  }
  return best;
}

function battleEntryUnitBp(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): number {
  const player = state.players[playerId];
  const card =
    player.rush.find((c) => c.instanceId === instanceId) ??
    player.hand.find((c) => c.instanceId === instanceId);
  return card ? effectiveBp(state, playerId, card) : 0;
}

/** バトル進入候補のうち BP が最も高い move_to_battle。 */
export function pickBestMoveToBattle(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): Extract<GameAction, { type: "move_to_battle" }> | null {
  const moves = actionsOfType(actions, "move_to_battle");
  if (moves.length === 0) return null;

  let best = moves[0]!;
  let bestBp = battleEntryUnitBp(state, playerId, best.instanceId);
  for (const move of moves.slice(1)) {
    const bp = battleEntryUnitBp(state, playerId, move.instanceId);
    if (bp > bestBp) {
      bestBp = bp;
      best = move;
    }
  }
  return best;
}

/** ライドしてバトル進入する mount_ride のうち、進入後評価が最も高い手。 */
export function pickBestMountRide(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): Extract<GameAction, { type: "mount_ride" }> | null {
  const mounts = actionsOfType(actions, "mount_ride");
  if (mounts.length === 0) return null;

  let best: Extract<GameAction, { type: "mount_ride" }> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of mounts) {
    const result = applyAction(state, action);
    if (!result.ok) continue;
    const score = evaluateState(result.state, playerId);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

/** バトル進入（通常 or ライド）の最善手。 */
export function pickBestBattleEntry(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const move = pickBestMoveToBattle(state, playerId, actions);
  const mount = pickBestMountRide(state, playerId, actions);
  if (!move && !mount) return null;
  if (!mount) return move;
  if (!move) return mount;

  const moveResult = applyAction(state, move);
  const mountResult = applyAction(state, mount);
  if (moveResult.ok && mountResult.ok) {
    const moveScore = evaluateState(moveResult.state, playerId);
    const mountScore = evaluateState(mountResult.state, playerId);
    return mountScore >= moveScore ? mount : move;
  }
  return mountResult.ok ? mount : move;
}

/** チェイス先ビークルのうち、進入後評価が最も高い手。 */
export function pickBestChase(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): Extract<GameAction, { type: "resolve_chase" }> | null {
  const chases = actionsOfType(actions, "resolve_chase");
  if (chases.length === 0) return null;

  let best: Extract<GameAction, { type: "resolve_chase" }> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of chases) {
    const result = applyAction(state, action);
    if (!result.ok) continue;
    const score = evaluateState(result.state, playerId);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best ?? chases[0] ?? null;
}

/** ライドオフ選択: 乗ったまま vs 降りて RC 発動。 */
export function pickRideOffChoice(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): Extract<GameAction, { type: "resolve_ride_off_choice" }> | null {
  const choices = actions.filter(
    (a): a is Extract<GameAction, { type: "resolve_ride_off_choice" }> =>
      a.type === "resolve_ride_off_choice",
  );
  if (choices.length === 0) return null;

  let best: Extract<GameAction, { type: "resolve_ride_off_choice" }> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of choices) {
    const result = applyAction(state, action);
    if (!result.ok) continue;
    const score = evaluateState(result.state, playerId);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best ?? choices.find((c) => !c.rideOff) ?? choices[0] ?? null;
}

/** ユニットをバトルへ移動する前にバトル登場ホールドを支払う。 */
export function pickHoldBeforeBattle(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  for (const action of actionsOfType(actions, "move_to_battle")) {
    const card = state.players[playerId].rush.find(
      (c) => c.instanceId === action.instanceId,
    );
    if (!card) continue;
    if (getBattleEntryPaymentNeeds(state, playerId, card)) {
      return {
        type: "initiate_command_payment",
        playerId,
        kind: "battle_entry",
        sourceInstanceId: card.instanceId,
        rideOff: action.rideOff,
      };
    }
  }
  // 「自軍コマンドを1つホールドしなければバトルエリアに出られない」ユニット（ガオイーグル等）は、
  // 払うまで move_to_battle が合法手に無く、battle_entry の支払いの開始だけが並ぶ。
  // 上のループでは見つからず、ラッシュエリアに置いたまま出さずにいた（XG3 スターターB、2026-10-20）。
  let best: GameAction | null = null;
  let bestBp = Number.NEGATIVE_INFINITY;
  for (const action of actionsOfType(actions, "initiate_command_payment")) {
    if (action.kind !== "battle_entry" || action.playerId !== playerId) continue;
    const card = state.players[playerId].rush.find((c) => c.instanceId === action.sourceInstanceId);
    if (!card) continue;
    const bp = effectiveBp(state, playerId, card);
    if (bp > bestBp) {
      bestBp = bp;
      best = action;
    }
  }
  return best;
}

/** このターンユニットがラッシュできるようカテゴリホールドを支払う。 */
export function pickRushCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const payments = actionsOfType(actions, "initiate_command_payment").filter(
    (action) => action.kind === "category_use" && action.playerId === playerId,
  );
  if (payments.length === 0) return null;

  const scored: { action: GameAction; score: number }[] = [];
  for (const action of payments) {
    const card = state.players[playerId].hand.find(
      (c) => c.instanceId === action.sourceInstanceId,
    );
    if (!card) continue;
    const rushAction = actions.find(
      (a): a is Extract<GameAction, { type: "rush" }> =>
        a.type === "rush" &&
        a.playerId === playerId &&
        a.instanceId === action.sourceInstanceId,
    );
    const score =
      (rushAction
        ? scoreRushAction(state, rushAction)
        : effectiveBp(state, playerId, card) +
          strikeDamageFor(state.definitions, card, state, playerId) * 3_000) -
      godomDiscardPenalty(state, playerId, action.godomDiscardInstanceIds);
    scored.push({ action, score });
  }
  // 払えずに取り消すことになる支払いは選ばない（選び続けると始めては取り消すのを繰り返す。
  // 先読みの試し打ちがこれで毎回 400 手まで回り、Lv5 の 1 手が 5 秒以上かかっていた）。
  return bestNotCancelled(state, playerId, scored);
}

/**
 * 点の高い順に、CPU が最後まで払えずに取り消すもの（cpuWouldCancelProcedure）を除いた最初の手（同点なら先に並んだ手）。
 * 取り消すかの判定は手を試しに打つので重い（全体の約 12%）。全部の候補で調べず、選ぶ手が決まるまでだけ調べる。
 */
function bestNotCancelled(state: GameState, playerId: PlayerId, scored: { action: GameAction; score: number }[]): GameAction | null {
  const ordered = scored.filter((s) => s.score > Number.NEGATIVE_INFINITY).sort((a, b) => b.score - a.score);
  for (const { action } of ordered) if (!cpuWouldCancelProcedure(state, playerId, action)) return action;
  return null;
}

export function pickHoldBeforeRush(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  rushAction: GameAction,
): GameAction | null {
  if (rushAction.type !== "rush") return null;

  const matchingRush = actions.some(
    (a) =>
      a.type === "rush" &&
      a.playerId === rushAction.playerId &&
      a.instanceId === rushAction.instanceId &&
      (a.zordMaterialInstanceId ?? "") === (rushAction.zordMaterialInstanceId ?? "") &&
      (a.zordMaterialDestination ?? "") === (rushAction.zordMaterialDestination ?? "") &&
      [...(a.zordMothershipHoldInstanceIds ?? [])].sort().join(",") ===
        [...(rushAction.zordMothershipHoldInstanceIds ?? [])].sort().join(","),
  );
  if (matchingRush) return null;

  const card = state.players[playerId].hand.find(
    (c) => c.instanceId === rushAction.instanceId,
  );
  if (!card) return null;
  const unitDef = getDefinition(state.definitions, card.cardId);
  if (!unitDef) return null;
  const options = getCategoryPaymentOptions(
    state,
    playerId,
    cardCategories(unitDef),
    { perRushPayment: true },
  );
  if (!options) return null;
  return {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: rushAction.instanceId,
    zordMaterialInstanceId: rushAction.zordMaterialInstanceId,
    zordMaterialDestination: rushAction.zordMaterialDestination,
    zordMothershipHoldInstanceIds: rushAction.zordMothershipHoldInstanceIds,
    godomDiscardInstanceIds: rushAction.godomDiscardInstanceIds,
  };
}

/**
 * RS-586【魔神に不足する物】で捨札にする「戦闘員」のユニットの損失（BP の低いユニットを捨札にする組を選ぶ）。
 * 選ぶ組ごとに分かれたラッシュの宣言の比較に使う。
 */
export function godomDiscardPenalty(state: GameState, playerId: PlayerId, ids: string[] | undefined): number {
  if (!ids || ids.length === 0) return 0;
  const player = state.players[playerId];
  return ids.reduce((sum, id) => {
    const card = [...player.rush, ...player.battle].find((c) => c.instanceId === id);
    return sum + 1_000 + (card ? effectiveBp(state, playerId, card) : 0);
  }, 0);
}

/**
 * 始めても CPU 自身が途中で取り消す手順（支払えない合体・コマンドの支払い）か。
 * 取り消すと元の状態に戻るので、選び続けると同じ手を永久に繰り返す（2026-10-20 対戦台で確認）。
 */
export function cpuWouldCancelProcedure(state: GameState, playerId: PlayerId, action: GameAction): boolean {
  // 探索の間は同じ状態・同じ手の結果を使い回す（候補を作るたびに試し打ちしていた。Lv5 の思考時間の約 14%）。
  return memoizeInSearch(state, `wouldCancel:${playerId}:${JSON.stringify(action)}`, () =>
    cpuWouldCancelProcedureUncached(state, playerId, action),
  );
}

function cpuWouldCancelProcedureUncached(state: GameState, playerId: PlayerId, action: GameAction): boolean {
  const first = applyAction(state, action);
  if (!first.ok) return true;
  let current = first.state;
  for (let i = 0; i < 12; i++) {
    const step = pickZordSetupStep(current, playerId) ?? pickCommandPaymentResolve(current, playerId);
    if (!step) return false;
    if (step.type === "cancel_command_payment" || step.type === "cancel_zord_setup") return true;
    const next = applyAction(current, step);
    if (!next.ok) return true;
    current = next.state;
  }
  return false;
}

export function pickBeginZordSetup(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const scored: { action: GameAction; score: number }[] = [];

  for (const action of actions) {
    if (action.type !== "begin_zord_setup" || action.playerId !== playerId) continue;
    if (!canBeginZordSetup(state, playerId, action.zordInstanceId)) continue;
    if (findDirectZordRushAction(state, playerId, action.zordInstanceId)) continue;

    const card = state.players[playerId].hand.find(
      (c) => c.instanceId === action.zordInstanceId,
    );
    if (!card) continue;
    const score =
      scoreRushAction(state, {
        type: "rush",
        playerId,
        instanceId: action.zordInstanceId,
      }) +
      25_000 -
      godomDiscardPenalty(state, playerId, action.godomDiscardInstanceIds);
    scored.push({ action, score });
  }

  return bestNotCancelled(state, playerId, scored);
}

export function pickDamagePayment(
  state: GameState,
  playerId: PlayerId,
): GameAction | null {
  const pending = state.pendingDamagePayment;
  if (!pending || damagePaymentChoosingPlayer(pending) !== playerId) return null;
  const targets = state.players[pending.playerId].power.filter(
    (c) => !c.faceDown && !pending.selectedFlipIds.includes(c.instanceId),
  );
  if (targets.length === 0) return null;
  return {
    type: "resolve_damage_payment",
    playerId,
    instanceId: targets[targets.length - 1]!.instanceId,
  };
}

export function pickCommandPaymentResolve(
  state: GameState,
  playerId: PlayerId,
): GameAction | null {
  const pending = state.pendingCommandPayment;
  if (!pending || pending.playerId !== playerId) return null;
  const needed = pending.totalNeeded;
  const valid = pending.validInstanceIds;
  if (valid.length < needed) {
    return { type: "cancel_command_payment", playerId };
  }

  const candidates: string[][] = [];
  // RS-429 代用の effect_hold（minNeeded）: 少ない枚数で足りるならそちらを優先する（MA のコマンド1つ）。
  if (pending.minNeeded !== undefined && pending.minNeeded < needed) {
    for (const id of valid) candidates.push([id]);
  }
  candidates.push(valid.slice(0, needed), valid.slice(-needed));
  for (let i = 0; i <= valid.length - needed; i += 1) {
    candidates.push(valid.slice(i, i + needed));
  }

  for (const ids of candidates) {
    if (validatePaymentSelection(state, pending, ids) === null) {
      return {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: ids,
      };
    }
  }

  return { type: "cancel_command_payment", playerId };
}

export function pickZordSetupStep(
  state: GameState,
  playerId: PlayerId,
): GameAction | null {
  const setup = state.pendingZordSetup;
  if (!setup || setup.playerId !== playerId) return null;

  const resolves = listZordSetupResolveActions(state, setup);
  if (resolves.length === 0) {
    return { type: "cancel_zord_setup", playerId };
  }

  if (setup.step === "destination") {
    return (
      resolves.find((a) => a.destination === "command") ?? resolves[0]!
    );
  }

  let best = resolves[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of resolves) {
    const advanced = advanceZordSetup(state, setup, {
      materialInstanceId: action.materialInstanceId,
      destination: action.destination,
      paymentPath: action.paymentPath,
    });
    if (advanced.kind === "rush") {
      const score = scoreRushAction(state, advanced.action);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    } else if (advanced.kind === "payment" && 40_000 > bestScore) {
      bestScore = 40_000;
      best = action;
    }
  }
  return best;
}

export function pickBestRushByScore(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "rush") continue;
    const score = scoreRushAction(state, action);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

/** 敵のバトルまたはラッシュに対する勝てるバトル（イエローサンダー等）。 */
export function pickFavorableBattle(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestDelta = Number.NEGATIVE_INFINITY;

  for (const action of actionsOfType(actions, "battle")) {
    const player = state.players[action.playerId];
    const enemy = state.players[opponent(action.playerId)];
    const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
    const defender =
      enemy.battle.find((c) => c.instanceId === action.defenderInstanceId) ??
      enemy.rush.find((c) => c.instanceId === action.defenderInstanceId);
    if (!attacker || !defender) continue;

    const delta =
      effectiveBp(state, action.playerId, attacker) -
      effectiveBp(state, opponent(action.playerId), defender);
    if (delta > 0 && delta > bestDelta) {
      bestDelta = delta;
      best = action;
    }
  }

  return best;
}

export function pickWinningBattle(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestDelta = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "battle") continue;
    const player = state.players[action.playerId];
    const enemy = state.players[opponent(action.playerId)];
    const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
    const defender = enemy.battle.find((c) => c.instanceId === action.defenderInstanceId);
    if (!attacker || !defender) continue;

    const attackerBp = effectiveBp(state, action.playerId, attacker);
    const defenderBp = effectiveBp(state, opponent(action.playerId), defender);
    const delta = attackerBp - defenderBp;
    if (delta <= 0) continue;
    if (delta > bestDelta) {
      bestDelta = delta;
      best = action;
    }
  }

  return best;
}

export function pickBestStrike(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const enemy = state.players[opponent(playerId)];
  let best: GameAction | null = null;
  let bestPriority = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "strike") continue;
    const player = state.players[action.playerId];
    const card = player.battle.find((c) => c.instanceId === action.instanceId);
    if (!card) continue;

    const damage = strikeDamageFor(state.definitions, card, state, action.playerId);
    const lethal = enemy.damage + damage >= WIN_DAMAGE;
    const nearLethal = enemy.damage + damage >= WIN_DAMAGE - 1;
    const closing = enemy.damage >= WIN_DAMAGE - 3;
    const priority =
      (lethal ? 20_000 : nearLethal ? 8_000 : closing ? 2_500 : 0) + damage * 150;
    if (priority > bestPriority) {
      bestPriority = priority;
      best = action;
    }
  }

  return best;
}

export function pickWeakestEffectTarget(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let weakestBp = Number.POSITIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    const located = findCardOwner(state, action.instanceId);
    if (!located) continue;
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, action.instanceId);
    if (!found) continue;
    const bp = effectiveBp(state, located.playerId, found.card);
    if (bp < weakestBp) {
      weakestBp = bp;
      best = action;
    }
  }

  return best;
}

export function pickBestOperationTarget(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  const destroyOps = actionsOfType(actions, "play_operation").filter((action) => {
    const player = state.players[action.playerId];
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    return card && ["RS-007", "RS-028", "RS-009", "RS-024"].includes(card.cardId);
  });
  if (destroyOps.length === 0) return null;

  let best = destroyOps[0]!;
  let weakestBp = Number.POSITIVE_INFINITY;
  for (const action of destroyOps) {
    if (!action.targetInstanceId) continue;
    const located = findCardOwner(state, action.targetInstanceId);
    if (!located) continue;
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, action.targetInstanceId);
    if (!found) continue;
    const bp = effectiveBp(state, located.playerId, found.card);
    if (bp < weakestBp) {
      weakestBp = bp;
      best = action;
    }
  }
  return best;
}

export function pickBestOperation(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  const targeted = pickBestOperationTarget(state, actions);
  if (targeted) return targeted;

  const ops = actionsOfType(actions, "play_operation");
  const powerAccel = ops.find((a) => {
    const player = state.players[a.playerId];
    const card = player.hand.find((c) => c.instanceId === a.instanceId);
    return card?.cardId === "RS-020";
  });
  if (powerAccel) return powerAccel;

  const permanent = ops.find((a) => {
    const player = state.players[a.playerId];
    const card = player.hand.find((c) => c.instanceId === a.instanceId);
    if (!card) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return def?.tags?.includes("常駐");
  });
  if (permanent) return permanent;

  return ops[0] ?? null;
}

function powerDiscardPriority(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): number {
  const player = state.players[playerId];
  const card = player.power.find((c) => c.instanceId === instanceId);
  if (!card) return Number.POSITIVE_INFINITY;
  const def = getDefinition(state.definitions, card.cardId);
  const cost = def ? parsePowerCost(def.powerCost ?? 1) : 1;
  return cost + (card.faceDown ? 0 : 2);
}

function battleSourceStrikeValue(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string | undefined,
): number {
  if (!sourceInstanceId) return 0;
  const unit = state.players[playerId].battle.find((c) => c.instanceId === sourceInstanceId);
  if (!unit) return 0;
  return strikeDamageFor(state.definitions, unit, state, playerId) + (unit.spModifier ?? 0);
}

function worthJudgmentSwordPayment(
  state: GameState,
  playerId: PlayerId,
  pending: PendingEffectChoice,
): boolean {
  const player = state.players[playerId];
  const need = pending.selectCount ?? 2;
  if (player.power.length < need) return false;
  return battleSourceStrikeValue(state, playerId, pending.sourceInstanceId) >= 2;
}

function worthJusticeFlasherPayment(
  state: GameState,
  playerId: PlayerId,
  pending: PendingEffectChoice,
): boolean {
  const player = state.players[playerId];
  const need = pending.selectCount ?? 5;
  if (player.power.length < need) return false;
  return battleSourceStrikeValue(state, playerId, pending.sourceInstanceId) >= 4;
}

function pickLowestPowerDiscard(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  exclude: Set<string>,
): GameAction | null {
  let best: GameAction | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    if (exclude.has(action.instanceId)) continue;
    const priority = powerDiscardPriority(state, playerId, action.instanceId);
    if (priority < bestPriority) {
      bestPriority = priority;
      best = action;
    }
  }

  return best;
}

export function pickScryKeepOne(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  pending?: PendingEffectChoice,
): GameAction | null {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  const choice = pending ?? state.pendingEffectChoice;
  const selectable = choice?.validInstanceIds?.length
    ? new Set(choice.validInstanceIds)
    : null;

  const viewedIds = choice?.viewedInstanceIds ?? [];
  const player = state.players[playerId];
  const viewedCards = new Map(
    viewedIds
      .map((id) => player.deck.find((c) => c.instanceId === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => [c.instanceId, c] as const),
  );

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    if (selectable && !selectable.has(action.instanceId)) continue;
    const card =
      viewedCards.get(action.instanceId) ??
      player.deck.find((c) => c.instanceId === action.instanceId);
    if (!card) continue;
    const bp = effectiveBp(state, playerId, card);
    const sp = strikeDamageFor(state.definitions, card, state, playerId);
    const score = bp * 10 + sp * 500;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

function handDiscardPriority(
  definitions: GameState["definitions"],
  cardId: string,
): number {
  const def = getDefinition(definitions, cardId);
  if (!def) return 500;
  if (def.type === "unit") return 1000 + (def.bp ?? 0);
  if (def.type === "operation") return 100;
  return 50;
}

function pickSelectHandChoice(
  state: GameState,
  playerId: PlayerId,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  const selected = new Set(pending.selectedInstanceIds ?? []);
  const selectCount = pending.selectCount ?? 1;
  if (selected.size >= selectCount) return null;

  let best: GameAction | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;
  // 超電子頭脳（RS-008）は「手札に残す1枚」を選ぶので、捨てる優先度が最も低いカードを選ぶ。
  const keepChoice = pending.effectId === "super_brain_keep";

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    if (selected.has(action.instanceId)) continue;
    const found = findInZone(state.players[playerId], "hand", action.instanceId);
    if (!found) continue;
    const raw = handDiscardPriority(state.definitions, found.card.cardId);
    const priority = keepChoice ? -raw : raw;
    if (priority < bestPriority) {
      bestPriority = priority;
      best = action;
    }
  }

  return best;
}

function pickSelectCommandsChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  if (needsEffectHoldPayment(pending, state)) {
    const initiate = actions.find(
      (a) =>
        a.type === "initiate_command_payment" &&
        "kind" in a &&
        a.kind === "effect_hold",
    );
    if (initiate) return initiate;
  }

  const selected = new Set(pending.selectedInstanceIds ?? []);
  const selectCount = pending.selectCount ?? 1;
  if (selected.size >= selectCount) return null;

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    if (selected.has(action.instanceId)) continue;
    return action;
  }

  return null;
}

/** ヒューリスティックが null を返したときの CPU 最終手段（UI フリーズ回避）。 */
export function pickCpuFallbackAction(
  state: GameState,
  playerId: PlayerId,
): GameAction | null {
  const actions = getLegalActions(state).filter((a) => a.playerId === playerId);
  if (actions.length === 0) return null;

  const preferTypes: GameAction["type"][] = [
    "skip_effect_choice",
    "pass_register",
    "use_register",
    "pass_chase",
    "resolve_chase",
    "pass_battle_entry",
    "pass_battle_reaction",
    "pass_strike_reaction",
    "pass_rush_reaction",
    "pass_leave_reaction",
    "cancel_command_payment",
    "cancel_zord_setup",
    "resolve_effect_choice",
    "confirm_effect_choice",
    "confirm_denji_reveal",
    "confirm_shiron_reveal",
    "resolve_ruin_survey",
    "resolve_seabed_draw",
    "end_phase",
  ];

  for (const type of preferTypes) {
    const found = actions.find((a) => a.type === type);
    if (found) return found;
  }

  return actions[0] ?? null;
}

/** 配置するとき自軍山札のカードを「～枚まで」重ねる常駐（RK-022 ライダーパス・XG2-070 ライドブッカー・ブックモード）。 */
const DECK_STACK_EFFECT_IDS = new Set([RIDER_PASS_SEARCH_EFFECT_ID, BOOK_EFFECT_ID]);

/**
 * 配置するときに山札から重ねる選択は、上限まで重ねる。重ねたカードは後で場のユニットと置き換えて使える（山札から引くのを
 * 待たずに出せる）が、盤面評価は重ねたカードを数えず山札が減る分だけ下がるので、読みで比べると毎回「重ねない」を選んでいた。
 * まだ重ねていないカード名を優先し、同じなら BP の高いものから選ぶ。
 */
export function pickDeckStackChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  if (!DECK_STACK_EFFECT_IDS.has(pending.effectId)) return null;
  const p = state.players[pending.playerId];
  const op = p.operation.find((c) => c.instanceId === pending.sourceInstanceId);
  const stackedIds = new Set((op?.stackedCards ?? []).map((c) => c.cardId));
  let best: GameAction | null = null;
  let bestScore = -Infinity;
  for (const a of actions) {
    if (a.type !== "resolve_effect_choice") continue;
    const card = p.deck.find((c) => c.instanceId === a.instanceId);
    if (!card) continue;
    const score = (stackedIds.has(card.cardId) ? 0 : 100000) + (getDefinition(state.definitions, card.cardId)?.bp ?? 0);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

/**
 * RS-257 野球仮面【予告ホームラン】: 敵軍山札の上をオモテにするか。同じ必要パワーの自軍コマンドをホールドできればダメージ、
 * できなければ相手の手札が増える。オモテにする前なので上のカードは見ず、相手の見えていないカードの必要パワーの割合で、半分以上の見込みで
 * ホールドできるならオモテにする。ホールドできるなら必ずする（しなければ相手の手札に加わるだけ）。
 * 以前は「1 枚選ぶ」形の選択として簡易の選び方が見送り、一度も使わなかった（2026-10-26 の見直し）。
 */
export function pickHomerunChoice(state: GameState, pending: PendingEffectChoice, actions: GameAction[]): GameAction | null {
  if (pending.effectId === HOMERUN_HOLD_EFFECT_ID) return actions.find((a) => a.type === "resolve_effect_choice") ?? null;
  if (pending.effectId !== HOMERUN_REVEAL_EFFECT_ID) return null;
  const costs = new Set(
    state.players[pending.playerId].command
      .filter((c) => !c.commandHeld)
      .map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)),
  );
  // 相手の山札の並びも中身も見ない。見えていないカード（山札と手札を合わせたもの。Lv5 の hideOpponentHand と同じ見方）の割合で決める。
  const enemy = state.players[opponent(pending.playerId)];
  const unseen = [...enemy.deck, ...enemy.hand];
  if (enemy.deck.length === 0 || costs.size === 0) return actions.find((a) => a.type === "skip_effect_choice") ?? null;
  const hits = unseen.filter((c) => costs.has(parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost))).length;
  const reveal = actions.find((a) => a.type === "resolve_effect_choice");
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  return (hits * 2 >= unseen.length ? reveal : skip) ?? skip ?? reveal ?? null;
}

/** pickChoiceByEvaluation の入れ子の深さ（選んだ後に続く選択も同じ選び方で済ませるが、その先は読まない）。 */
let evaluationChoiceDepth = 0;

/**
 * 場に無いカード（手札・山札）を選ぶ選択。pickWeakestEffectTarget は場のユニットしか見ず、何も返さなかったので、選択の途中の
 * 盤面で評価して「行う」が選ばれなかった（XG3-068【この世界でやるべきこと】の山札から出すカード等。2026-10-26 の見直し）。
 * 1 枚選べば終わる選択で、選択肢ごとに、続く自分の選択まで済ませた盤面を評価して一番良いものを選ぶ。見送れるなら見送りとも比べる。
 */
function pickChoiceByEvaluation(state: GameState, pending: PendingEffectChoice, actions: GameAction[]): GameAction | null {
  const playerId = pending.playerId;
  const picks = actions.filter((a) => a.type === "resolve_effect_choice" || a.type === "skip_effect_choice");
  if (picks.length === 0 || evaluationChoiceDepth > 1) return null;
  // 相手の手札・山札（見えていないカード）から選ぶ選択は、選んで評価すると中身を見ることになるので扱わない。
  const enemy = state.players[opponent(playerId)];
  const hidden = new Set([...enemy.hand, ...enemy.deck].map((c) => c.instanceId));
  if (picks.some((a) => a.type === "resolve_effect_choice" && hidden.has(a.instanceId))) return null;
  evaluationChoiceDepth++;
  try {
    let best: GameAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const a of picks) {
      const result = applyAction(state, a);
      if (!result.ok) continue;
      // 何枚か選んでから確定する選択（選ぶたびに印が付くだけ）は扱わない。選んでは外すのを繰り返していた（XG5-079）。
      if (result.state.pendingEffectChoice?.effectId === pending.effectId) return null;
      let next = result.state;
      for (let i = 0; i < 3 && !next.winner && next.pendingEffectChoice?.playerId === playerId; i++) {
        const follow = pickEffectChoice(next, next.pendingEffectChoice, getLegalActions(next));
        const r = follow ? applyAction(next, follow) : null;
        if (!r?.ok) break;
        next = r.state;
      }
      const score = evaluateState(next, playerId);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  } finally {
    evaluationChoiceDepth--;
  }
}

/** 置き換えた後の盤面が、置き換えない盤面よりこれだけ良いときだけ置き換える（同じくらいなら場をそのままにする）。 */
const RESIDENT_SWAP_MARGIN = 50;

/**
 * 重ねたカードと場のユニットの置き換え（RK-022 ライダーパス・RK-080 超変身・RK-082 オルタフォース）。重ねたカードを選ぶ選択は
 * 「1 枚選ぶ」形（scry_keep_one）で読みの対象にならず、簡易の選び方は見送っていたので、起動しても一度も置き換えなかった
 * （2026-10-26 の見直し）。重ねたカードと場のユニットの組を全部置き換えてみて、盤面の評価が一番良い組を選ぶ。
 */
export function pickResidentSwapChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  if (pending.effectId !== RIDER_PASS_CARD && pending.effectId !== RIDER_PASS_UNIT) return null;
  const playerId = pending.playerId;
  const scoreOf = (action: GameAction): number => {
    const result = applyAction(state, action);
    if (!result.ok) return Number.NEGATIVE_INFINITY;
    if (pending.effectId === RIDER_PASS_UNIT) return evaluateState(result.state, playerId);
    // 重ねたカードを選んだ後: 置き換える場のユニットの選択で一番良いもの。
    let best = Number.NEGATIVE_INFINITY;
    for (const unit of getLegalActions(result.state)) {
      if (unit.type !== "resolve_effect_choice") continue;
      const swapped = applyAction(result.state, unit);
      if (swapped.ok) best = Math.max(best, evaluateState(swapped.state, playerId));
    }
    return best;
  };
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const a of actions) {
    if (a.type !== "resolve_effect_choice") continue;
    const score = scoreOf(a);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  const skip = actions.find((a) => a.type === "skip_effect_choice");
  if (!skip) return best;
  const skipped = applyAction(state, skip);
  const skipScore = skipped.ok ? evaluateState(skipped.state, playerId) : Number.NEGATIVE_INFINITY;
  return best && bestScore > skipScore + RESIDENT_SWAP_MARGIN ? best : skip;
}

export function pickEffectChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  const playerId = pending.playerId;
  const skip = actions.find((a) => a.type === "skip_effect_choice");

  // 「好きな順で山札の下に戻す」（rules/deckBottomOrder.ts）: 選び直さず、並びどおりに番号を付けて確定する。
  if (pending.deckBottomOrderMeta) {
    return actions.find((a) => a.type === "resolve_effect_choice" && a.instanceId !== DECK_BOTTOM_ORDER_RESET) ?? null;
  }

  const deckStack = pickDeckStackChoice(state, pending, actions);
  if (deckStack) return deckStack;
  const residentSwap = pickResidentSwapChoice(state, pending, actions);
  if (residentSwap) return residentSwap;
  const homerun = pickHomerunChoice(state, pending, actions);
  if (homerun) return homerun;

  // 第7弾 RS-474〜RS-494 の選択（rules/legend1/set7NamedEffectsC.ts）。
  if (isSet7CChoiceEffect(pending.effectId)) {
    const picked = pickSet7CEffectChoice(state, pending, actions);
    if (picked) return picked;
  }
  // 第9弾 RS-605〜RS-626 の選択（rules/legend1/set9NamedEffectsA.ts）。
  const set9a = pickSet9ACpuChoice(state, pending, actions);
  if (set9a) return set9a;
  // 第8弾 RS-560〜RS-581 の選択（rules/legend1/set8NamedEffectsC.ts）。
  if (isSet8CChoiceEffect(pending.effectId)) {
    const picked = pickSet8CEffectChoice(state, pending, actions);
    if (picked) return picked;
  }
  // 第9弾 RS-648〜RS-669 の選択（rules/legend1/set9NamedEffectsC.ts）。行動ごとに局面を評価して選ぶ。
  if (isSet9CChoiceEffect(pending.effectId)) {
    const picked = pickSet8CEffectChoice(state, pending, actions);
    if (picked) return picked;
  }
  // 第7弾 RS-495〜RS-515 の選択（rules/legend1/set7NamedEffectsD.ts）。
  const set7d = pickSet7DCpuChoice(state, pending, actions);
  if (set7d) return set7d;
  // 第8弾 RS-582〜RS-604 の選択（rules/legend1/set8NamedEffectsD.ts）。
  const set8d = pickSet8DCpuChoice(state, pending, actions);
  if (set8d) return set8d;
  // 第9弾 RS-670〜RS-690 の選択（rules/legend1/set9NamedEffectsD.ts）。
  const set9d = pickSet9DCpuChoice(state, pending, actions);
  if (set9d) return set9d;
  // RS 以外のライン（XG・XP・RM・SK …）の選択（rules/legend1/otherLinesNamedEffects.ts）。
  const otherLines = pickOtherLinesCpuChoice(state, pending, actions);
  if (otherLines) return otherLines;
  // 第9弾 RS-627〜RS-647 の選択（rules/legend1/set9NamedEffectsB.ts）。
  const set9b = pickSet9BCpuChoice(state, pending, actions);
  if (set9b) return set9b;
  // 第8弾 RS-538〜RS-559 の選択（rules/legend1/set8NamedEffectsB.ts）。
  const set8b = pickSet8BCpuChoice(state, pending, actions);
  if (set8b) return set8b;

  // 「～してもよい」の任意効果の確認（rules/optionalEffects.ts）。
  if (pending.mayConfirm) {
    const confirm = actions.find((a) => a.type === "confirm_effect_choice");
    return (cpuAcceptsOptionalEffect(state, pending) ? confirm : skip) ?? skip ?? confirm ?? null;
  }

  if (pending.kind === "simultaneous_order" && (pending.mutualDestructionMeta || pending.battleDestroyOrderMeta)) {
    // ルール: R-BTL-02, R-SIM-01 — 相打ちの処理順: 各順で処理した結果を評価し、自分に有利な順を選ぶ。
    let best: GameAction | null = null;
    let bestScore = -Infinity;
    for (const action of actions) {
      if (action.type !== "resolve_effect_choice") continue;
      const result = applyAction(state, action);
      if (!result.ok) continue;
      const score = evaluateState(result.state, playerId);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }
    return best;
  }

  if (pending.kind === "simultaneous_order") {
    const prefer =
      pending.validInstanceIds.find((id) => id === "pendingLeave") ??
      pending.validInstanceIds[0];
    return (
      actions.find(
        (a) =>
          a.type === "resolve_effect_choice" &&
          a.instanceId === prefer,
      ) ?? null
    );
  }

  if (pending.kind === "optional_deck_draw") {
    const draw = actions.find(
      (a) => a.type === "resolve_effect_choice" && a.instanceId === "draw",
    );
    if (draw && state.players[playerId].deck.length > 0 && state.players[playerId].hand.length < 6) {
      return draw;
    }
    return skip ?? null;
  }

  if (pending.kind === "declare_number" && pending.effectId === ATTACK_HOLD_BONUS_EFFECT_ID) {
    // RS-019 超力／RK-186【Jパンチ】: バトルに勝てる最小のホールド数（勝てなければ 0）。
    const count = pickAttackHoldCount(state, playerId);
    return (
      actions.find((a) => a.type === "resolve_effect_choice" && a.instanceId === count) ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      null
    );
  }

  if (pending.kind === "declare_number") {
    if (pending.optional && skip) return skip;
    return (
      actions.find(
        (a) => a.type === "resolve_effect_choice" && a.instanceId === "0",
      ) ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      skip ??
      null
    );
  }

  if (pending.kind === "select_units_bp_budget") {
    const selected = pending.selectedInstanceIds ?? [];
    const budget = pending.bpBudget ?? 3000;
    const enemyId = opponent(pending.playerId);
    const candidates = [...state.players[enemyId].rush, ...state.players[enemyId].battle]
      .filter((c) => pending.validInstanceIds.includes(c.instanceId))
      .map((c) => ({
        instanceId: c.instanceId,
        bp: budgetBpForInstance(state, c.instanceId, pending) ?? 0,
      }))
      .filter((c) => c.bp > 0)
      .sort((a, b) => b.bp - a.bp);

    const planned: string[] = [];
    let sum = 0;
    for (const c of candidates) {
      if (sum + c.bp > budget) continue;
      planned.push(c.instanceId);
      sum += c.bp;
    }

    const nextPick = planned.find((id) => !selected.includes(id));
    if (nextPick && canToggleBpBudgetTarget(state, pending, nextPick)) {
      return { type: "resolve_effect_choice", playerId: pending.playerId, instanceId: nextPick };
    }
    if (selected.length === 0 && !planned.length) {
      return skip ?? actions.find((a) => a.type === "confirm_effect_choice") ?? null;
    }
    return actions.find((a) => a.type === "confirm_effect_choice") ?? skip ?? null;
  }

  if (pending.kind === "shiron_light") {
    if (pending.shironLightMeta?.step === "reveal") {
      return actions.find((a) => a.type === "confirm_shiron_reveal") ?? null;
    }
    if (pending.shironLightMeta?.step === "pick") {
      const ownerId = pending.shironLightMeta.ownerId;
      const owner = state.players[ownerId];
      const picks = actions.filter((a) => a.type === "resolve_effect_choice");
      if (picks.length === 0) return null;
      let best = picks[0]!;
      let bestScore = -Infinity;
      for (const pick of picks) {
        if (pick.type !== "resolve_effect_choice") continue;
        const card = owner.hand.find((c) => c.instanceId === pick.instanceId);
        if (!card) continue;
        const def = state.definitions[card.cardId];
        const score =
          def?.type === "unit"
            ? (def.bp ?? 0) + parsePowerCost(def.powerCost) * 100
            : -1000;
        if (score > bestScore) {
          bestScore = score;
          best = pick;
        }
      }
      return best;
    }
    return null;
  }

  if (pending.kind === "denji_machine") {
    if (pending.denjiMachineMeta?.step === "reveal") {
      return actions.find((a) => a.type === "confirm_denji_reveal") ?? null;
    }
    if (pending.denjiMachineMeta?.step === "order_bottom") {
      const pick = actions.find((a) => a.type === "resolve_effect_choice");
      return pick ?? null;
    }
    return null;
  }

  if (pending.kind === "seabed_draw") {
    const bottom = actions.find(
      (a) => a.type === "resolve_seabed_draw" && a.placement === "bottom",
    );
    const top = actions.find(
      (a) => a.type === "resolve_seabed_draw" && a.placement === "top",
    );
    return bottom ?? top ?? skip ?? null;
  }

  if (pending.kind === "scry_keep_one") {
    return pickScryKeepOne(state, playerId, actions, pending) ?? skip ?? null;
  }

  if (pending.kind === "end_turn_menu") {
    if (pending.optional && skip) return skip;
    return (
      actions.find((a) => a.type === "resolve_effect_choice") ??
      skip ??
      null
    );
  }

  if (pending.kind === "select_hand") {
    return (
      pickSelectHandChoice(state, playerId, pending, actions) ??
      skip ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      null
    );
  }

  if (pending.kind === "select_commands") {
    return (
      pickSelectCommandsChoice(state, pending, actions) ??
      skip ??
      null
    );
  }

  if (pending.kind === "pit_in_dive_order") {
    return (
      pickWeakestEffectTarget(state, actions) ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      skip ??
      null
    );
  }

  if (pending.effectId === "battle_entry_discard") {
    return (
      pickWeakestEffectTarget(state, actions) ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      null
    );
  }

  if (
    pending.effectId === "jet_skateboard" ||
    pending.effectId === "falcon_claw"
  ) {
    if (pending.optional && skip) return skip;
    return (
      actions.find((a) => a.type === "resolve_effect_choice") ??
      skip ??
      null
    );
  }

  if (pending.kind === "select_power") {
    const selected = new Set(pending.selectedInstanceIds ?? []);
    const selectCount = pending.selectCount ?? 1;

    if (pending.effectId === "judgment_sword") {
      if (pending.optional && selected.size === 0 && !worthJudgmentSwordPayment(state, playerId, pending)) {
        return skip ?? null;
      }
    } else if (pending.effectId === "justice_flasher") {
      if (pending.optional && selected.size === 0 && !worthJusticeFlasherPayment(state, playerId, pending)) {
        return skip ?? null;
      }
    } else if (pending.effectId === "earth_force" && pending.optional) {
      const enemy = state.players[opponent(playerId)];
      if (enemy.damage < 2 && maxSelfStrikeThreat(state, playerId) < 2) {
        return skip ?? null;
      }
    }

    if (selected.size >= selectCount) {
      return skip ?? null;
    }

    return (
      pickLowestPowerDiscard(state, playerId, actions, selected) ??
      skip ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      null
    );
  }

  if (pending.effectId === "earth_force" && !pending.optional) {
    const picks: GameAction[] = [];
    const exclude = new Set<string>();
    const upkeepCount = pending.selectCount ?? 3;
    for (let i = 0; i < upkeepCount; i++) {
      const pick = pickLowestPowerDiscard(state, playerId, actions, exclude);
      if (!pick || pick.type !== "resolve_effect_choice") break;
      picks.push(pick);
      exclude.add(pick.instanceId);
    }
    return picks[0] ?? null;
  }

  if (pending.kind === "select_unit" || pending.kind === "select_unit_step") {
    return pickWeakestEffectTarget(state, actions) ?? pickChoiceByEvaluation(state, pending, actions);
  }

  // RS-029【勇気の魔法】「リリースしてもよい」— ホールド状態のコマンドのリリースは常に得なのでする。
  if (pending.effectId === "courage_magic") {
    return actions.find((a) => a.type === "resolve_effect_choice") ?? skip ?? null;
  }

  if (needsEffectHoldPayment(pending, state)) {
    const initiate = actions.find(
      (a) =>
        a.type === "initiate_command_payment" &&
        "kind" in a &&
        a.kind === "effect_hold",
    );
    if (initiate) return initiate;
  }

  return skip ?? actions.find((a) => a.type === "resolve_effect_choice") ?? null;
}

/**
 * 第7弾 RS-474〜RS-494 の選択: 候補の行動（解決・見送り）をそれぞれ適用して局面を評価し、最も良いものを選ぶ。
 * 隠れた情報を当てる選択（RS-475 ウラ向きの捨札から選ぶ・RS-493 必要パワーの数字の宣言）は結果を先読みしない。
 */
function pickSet7CEffectChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  const candidates = actions.filter((a) => a.type === "resolve_effect_choice" || a.type === "skip_effect_choice");
  if (candidates.length === 0) return null;
  if (pending.effectId === REVOLVER_PICK_EFFECT_ID) {
    return candidates.find((a) => a.type === "resolve_effect_choice") ?? null;
  }
  if (pending.effectId === QUIZ_DECLARE_EFFECT_ID) {
    return candidates.find((a) => a.type === "resolve_effect_choice" && a.instanceId === "3") ?? candidates[0] ?? null;
  }
  let best: GameAction | null = null;
  let bestScore = -Infinity;
  for (const action of candidates) {
    const result = applyAction(state, action);
    if (!result.ok) continue;
    const score = evaluateState(result.state, pending.playerId);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best ?? candidates[0] ?? null;
}

/**
 * 第8弾 RS-560〜RS-581 の選択: 候補の行動（解決・確定・見送り）をそれぞれ適用して局面を評価し、最も良いものを選ぶ。
 * 1枚ずつ選んで確定する選択（RS-568・RS-569）は、確定できるならその局面も比べる（選び続けるより悪くなければ確定する）。
 */
function pickSet8CEffectChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  const candidates = actions.filter(
    (a) => a.type === "resolve_effect_choice" || a.type === "skip_effect_choice" || a.type === "confirm_effect_choice",
  );
  if (candidates.length === 0) return null;
  let best: GameAction | null = null;
  let bestScore = -Infinity;
  for (const action of candidates) {
    const result = applyAction(state, action);
    if (!result.ok) continue;
    const score = evaluateState(result.state, pending.playerId);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best ?? candidates[0] ?? null;
}

function maxSelfStrikeThreat(state: GameState, playerId: PlayerId): number {
  let max = 0;
  for (const card of state.players[playerId].battle) {
    max = Math.max(max, strikeDamageFor(state.definitions, card, state, playerId));
  }
  return max;
}

export function pickStrikeReaction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const pending = state.pendingStrike;
  if (!pending) return actions.find((a) => a.type === "pass_strike_reaction") ?? null;

  const strikerPlayer = state.players[pending.strikerPlayerId];
  const striker = strikerPlayer.battle.find((c) => c.instanceId === pending.strikerInstanceId);
  const strikerBp = striker ? effectiveBp(state, pending.strikerPlayerId, striker) : 0;
  const incomingDamage = pending.damage;

  for (const action of actions) {
    if (action.type !== "five_tech_intercept") continue;
    const defender = state.players[playerId];
    const interceptor = defender.rush.find((c) => c.instanceId === action.interceptInstanceId);
    if (!interceptor) continue;
    const interceptorBp = effectiveBp(state, playerId, interceptor);
    if (interceptorBp >= strikerBp) {
      return action;
    }
  }

  const self = state.players[playerId];
  const lethal = self.damage + incomingDamage >= WIN_DAMAGE;
  if (
    actions.some((a) => a.type === "use_plasma_energy") &&
    incomingDamage > 0 &&
    (lethal || incomingDamage >= 2)
  ) {
    return actions.find((a) => a.type === "use_plasma_energy") ?? null;
  }

  return actions.find((a) => a.type === "pass_strike_reaction") ?? null;
}

function isCounterCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
): action is Extract<GameAction, { type: "initiate_command_payment" }> {
  if (action.type !== "initiate_command_payment" || action.kind !== "category_use") {
    return false;
  }
  const found = state.players[playerId].hand.find(
    (c) => c.instanceId === action.sourceInstanceId,
  );
  return !!found && getCardEffect(found.cardId)?.kind === "counter";
}

function simulateCounterOutcome(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
): GameState | null {
  if (action.type === "play_counter") {
    const result = applyAction(state, action);
    return result.ok ? result.state : null;
  }

  if (!isCounterCategoryPayment(state, playerId, action)) return null;

  const initiated = applyAction(state, action);
  if (!initiated.ok) return null;

  const resolve = pickCommandPaymentResolve(initiated.state, playerId);
  if (!resolve || resolve.type === "cancel_command_payment") return null;

  const resolved = applyAction(initiated.state, resolve);
  return resolved.ok ? resolved.state : null;
}

export function pickBestCounter(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
): GameAction | null {
  const pass = actions.find((a) => a.type === passType);
  const counterCandidates: GameAction[] = [
    ...actionsOfType(actions, "play_counter"),
    ...actionsOfType(actions, "initiate_command_payment").filter((action) =>
      isCounterCategoryPayment(state, playerId, action),
    ),
  ];

  let passScore = Number.NEGATIVE_INFINITY;
  if (pass) {
    const passResult = applyAction(state, pass);
    if (passResult.ok) {
      passScore = evaluateState(passResult.state, playerId);
    }
  }

  let bestCounter: GameAction | null = null;
  let bestCounterScore = Number.NEGATIVE_INFINITY;

  for (const counter of counterCandidates) {
    const nextState = simulateCounterOutcome(state, playerId, counter);
    if (!nextState) continue;
    const score = evaluateState(nextState, playerId);
    if (score > bestCounterScore) {
      bestCounterScore = score;
      bestCounter = counter;
    }
  }

  if (bestCounter && bestCounterScore > passScore) {
    return bestCounter;
  }

  return pass ?? bestCounter ?? null;
}

export function pickSimpleReaction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
): GameAction | null {
  if (passType === "pass_strike_reaction") {
    return (
      pickStrikeReaction(state, playerId, actions) ??
      pickBestCounter(state, playerId, actions, passType)
    );
  }

  return pickBestCounter(state, playerId, actions, passType);
}

/** 探索で有望なアクションを残すための高速並べ替え。 */
export function quickActionPriority(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
): number {
  if (action.type === "end_phase") {
    const player = state.players[playerId];
    const deckLeft = player.deck.length;
    const deckGuard = deckLeft < 8 ? (8 - deckLeft) * 1_500 : 0;
    let phasePenalty =
      state.phase === "rush" || state.phase === "charge" ? -10_000 : -5_000;
    if (state.phase === "battle") {
      const hasRush = player.rush.length > 0;
      const hasBattleUnits = player.battle.length > 0;
      if (hasRush) phasePenalty -= 28_000;
      if (hasBattleUnits) phasePenalty -= 8_000;
    }
    return phasePenalty - deckGuard;
  }

  if (action.type === "rush") {
    const base = scoreRushAction(state, action);
    return state.phase === "rush" ? base + 15_000 : base;
  }

  if (action.type === "begin_zord_setup") {
    const base = scoreRushAction(state, {
      type: "rush",
      playerId: action.playerId,
      instanceId: action.zordInstanceId,
    });
    return state.phase === "rush" ? base + 30_000 : base;
  }

  if (action.type === "strike") {
    const player = state.players[action.playerId];
    const card = player.battle.find((c) => c.instanceId === action.instanceId);
    if (!card) return 0;
    const enemy = state.players[opponent(action.playerId)];
    const damage = strikeDamageFor(state.definitions, card, state, action.playerId);
    const lethal = enemy.damage + damage >= WIN_DAMAGE;
    const nearLethal = enemy.damage + damage >= WIN_DAMAGE - 1;
    return (lethal ? 80_000 : nearLethal ? 25_000 : 0) + damage * 800;
  }

  if (action.type === "hold_for_wing") {
    const player = state.players[action.playerId];
    const unit = player.rush.find((c) => c.instanceId === action.instanceId);
    if (!unit) return 0;
    return effectiveBp(state, action.playerId, unit) + 6_000;
  }

  if (action.type === "battle") {
    const player = state.players[action.playerId];
    const enemy = state.players[opponent(action.playerId)];
    const attacker =
      player.battle.find((c) => c.instanceId === action.attackerInstanceId) ??
      player.rush.find((c) => c.instanceId === action.attackerInstanceId);
    const defender = enemy.battle.find((c) => c.instanceId === action.defenderInstanceId)
      ?? enemy.rush.find((c) => c.instanceId === action.defenderInstanceId);
    if (!attacker || !defender) return 0;
    const delta =
      effectiveBp(state, action.playerId, attacker) -
      effectiveBp(state, opponent(action.playerId), defender);
    return delta > 0 ? delta * 100 : delta;
  }

  if (action.type === "move_to_battle") {
    const player = state.players[action.playerId];
    const card =
      player.rush.find((c) => c.instanceId === action.instanceId) ??
      player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return 0;
    return effectiveBp(state, action.playerId, card) + 500;
  }

  if (action.type === "mount_ride") {
    const player = state.players[action.playerId];
    const rider = player.rush.find((c) => c.instanceId === action.riderInstanceId);
    const vehicle = player.rush.find((c) => c.instanceId === action.vehicleInstanceId);
    if (!rider || !vehicle) return 0;
    return (
      effectiveBp(state, action.playerId, rider) +
      effectiveBp(state, action.playerId, vehicle) +
      1_200
    );
  }

  if (action.type === "play_operation") {
    if (state.phase === "rush") {
      const player = state.players[action.playerId];
      const card = player.hand.find((c) => c.instanceId === action.instanceId);
      if (!card) return -8_000;
      if (["RS-007", "RS-028", "RS-009", "RS-024"].includes(card.cardId)) {
        return -4_000;
      }
      return -8_000;
    }
    const player = state.players[action.playerId];
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return 1_000;
    if (["RS-007", "RS-028", "RS-009", "RS-024"].includes(card.cardId)) {
      return 3_000;
    }
    if (card.cardId === "RS-020") return 2_500;
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.tags?.includes("常駐")) return 2_200;
    return 1_500;
  }

  if (
    action.type === "initiate_command_payment" ||
    action.type === "resolve_command_payment"
  ) {
    if (action.type === "initiate_command_payment" && action.kind === "category_use") {
      const card = state.players[action.playerId].hand.find(
        (c) => c.instanceId === action.sourceInstanceId,
      );
      if (card && getCardEffect(card.cardId)?.kind === "counter") {
        return 2_500;
      }
      if (state.phase === "rush") {
        return 14_000;
      }
    }
    return 600;
  }
  if (action.type === "charge_power") {
    return state.phase === "charge" ? 2_500 : 400;
  }
  if (action.type === "charge_command") {
    return state.phase === "charge" ? 1_200 : 800;
  }

  if (action.type === "use_plasma_energy") {
    const pending = state.pendingStrike;
    if (pending) {
      const self = state.players[playerId];
      const lethal = self.damage + pending.damage >= WIN_DAMAGE;
      return lethal ? 45_000 : 4_000;
    }
    return 4_000;
  }
  if (action.type === "five_tech_intercept") return 3_500;
  if (action.type === "play_counter") return 2_000;
  if (action.type === "pass_strike_reaction") return -500;
  if (action.type === "pass_battle_reaction" || action.type === "pass_rush_reaction") {
    return -200;
  }

  return 0;
}

export function affordableRushes(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): Extract<GameAction, { type: "rush" }>[] {
  const player = state.players[playerId];
  return actionsOfType(actions, "rush").filter((action) => {
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return false;
    const cost = effectivePowerCost(
      state,
      playerId,
      parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost ?? 99),
    );
    return countAvailablePower(state, playerId) >= cost;
  });
}
