import type {
  DamagePaymentResume,
  GameState,
  PendingDamagePayment,
  PlayerId,
  PlayerState,
} from "../types/game";
import { cardCategories, getDefinition } from "../core/catalog";
import { applyPlayerDamage, removeAt, updatePlayer } from "../core/helpers";
import { emitDamageAppliedAndResolve } from "../events/emitDamageApplied";
import {
  cardHasMorphKeyword,
  powerZoneHasMorphUnitCard,
} from "../keywords/battleKeywords";

export type { DamagePaymentResume };

export function damagePaymentChoosingPlayer(
  pending: PendingDamagePayment,
): PlayerId {
  return pending.choosingPlayerId ?? pending.playerId;
}

export function requiresDamagePowerChoice(player: PlayerState, amount: number): boolean {
  if (amount <= 0) return false;
  const faceUpCount = player.power.filter((c) => !c.faceDown).length;
  const flipsNeeded = Math.min(amount, faceUpCount);
  return flipsNeeded > 0 && faceUpCount > flipsNeeded;
}

export function getValidDamagePowerTargets(
  state: GameState,
  pending: PendingDamagePayment,
): string[] {
  const selected = new Set(pending.selectedFlipIds);
  const candidates = state.players[pending.playerId].power.filter(
    (c) => !c.faceDown && !selected.has(c.instanceId),
  );
  if (pending.bloodVesselPreferMorph && powerZoneHasMorphUnitCard(state, pending.playerId)) {
    const morphOnly = candidates.filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && cardHasMorphKeyword(state.definitions, c.cardId);
    });
    if (morphOnly.length > 0) {
      return morphOnly.map((c) => c.instanceId);
    }
  }
  return candidates.map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RK-086 アカネタカ（※カウンター）

const AKANETAKA_CARD_ID = "RK-086";
/** アカネタカを使わずにダメージを受ける（パワーに選べるカードがないとき用）。 */
export const DAMAGE_PAYMENT_DECLINE_COUNTER = "__decline_counter__";

/** アカネタカの使用コスト（同カテゴリのリリース状態コマンドを1つホールド）に使うコマンド。 */
function akanetakaHoldCommandId(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): string | undefined {
  const def = getDefinition(state.definitions, cardId);
  const cats = def ? cardCategories(def) : [];
  return state.players[playerId].command.find((c) => {
    if (c.commandHeld) return false;
    const cdef = getDefinition(state.definitions, c.cardId);
    return !!cdef && cardCategories(cdef).some((cat) => cats.includes(cat));
  })?.instanceId;
}

/**
 * ルール: R-ERR-RK086 — 敵軍ユニットにストライクされてダメージにするとき、手札のアカネタカを
 * かわりにダメージにできる（1つのタイミングに1枚だけ）。
 */
export function getAkanetakaCandidates(
  state: GameState,
  pending: PendingDamagePayment,
): string[] {
  if (pending.resume.kind !== "strike") return [];
  if (pending.resume.pending.strikerPlayerId === pending.playerId) return [];
  if (pending.akanetakaUsed) return [];
  if (pending.remainingFlips + pending.deckDraws <= 0) return [];
  const player = state.players[pending.playerId];
  return player.hand
    .filter(
      (c) =>
        c.cardId === AKANETAKA_CARD_ID &&
        !!akanetakaHoldCommandId(state, pending.playerId, c.cardId),
    )
    .map((c) => c.instanceId);
}

function hasAkanetakaOption(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  resume: DamagePaymentResume,
): boolean {
  if (resume.kind !== "strike") return false;
  return (
    getAkanetakaCandidates(state, {
      playerId,
      remainingFlips: amount,
      deckDraws: 0,
      totalDamage: amount,
      selectedFlipIds: [],
      resume,
    }).length > 0
  );
}

/** 支払い中に選べる操作（パワー・アカネタカ・使わない）。 */
export function getDamagePaymentChoices(
  state: GameState,
  pending: PendingDamagePayment,
): string[] {
  const power = getValidDamagePowerTargets(state, pending);
  const counters = getAkanetakaCandidates(state, pending);
  if (counters.length === 0) return power;
  return [
    ...power,
    ...counters,
    ...(pending.remainingFlips === 0 || power.length === 0 ? [DAMAGE_PAYMENT_DECLINE_COUNTER] : []),
  ];
}

function useAkanetaka(
  state: GameState,
  pending: PendingDamagePayment,
  instanceId: string,
): { state: GameState; pending: PendingDamagePayment } {
  const playerId = pending.playerId;
  const player = state.players[playerId];
  const handIdx = player.hand.findIndex((c) => c.instanceId === instanceId);
  const [card, hand] = removeAt(player.hand, handIdx);
  const holdId = akanetakaHoldCommandId(state, playerId, card.cardId);
  const command = player.command.map((c) =>
    c.instanceId === holdId ? { ...c, commandHeld: true } : c,
  );
  // ダメージにするカードのかわりに、このカードをパワーゾーンにダメージ（ウラ向き）として置く。
  let next: PlayerState = {
    ...player,
    hand,
    command,
    power: [...player.power, { ...card, faceDown: true }],
    damage: player.damage + 1,
  };
  // その後、自分は1枚ドローする。
  if (next.deck.length > 0) {
    const [drawn, deck] = removeAt(next.deck, 0);
    next = { ...next, deck, hand: [...next.hand, drawn] };
  } else {
    next = { ...next, deckedOut: true };
  }
  const nextPending: PendingDamagePayment = {
    ...pending,
    akanetakaUsed: true,
    replacedDamage: (pending.replacedDamage ?? 0) + 1,
    totalDamage: pending.totalDamage - 1,
    deckDraws: pending.deckDraws > 0 ? pending.deckDraws - 1 : 0,
    remainingFlips: pending.deckDraws > 0 ? pending.remainingFlips : pending.remainingFlips - 1,
  };
  return { state: { ...state, ...updatePlayer(state, playerId, next) }, pending: nextPending };
}

function stillRequiresDamagePowerChoice(
  pending: PendingDamagePayment,
  faceUpRemaining: number,
): boolean {
  return pending.remainingFlips > 0 && faceUpRemaining > pending.remainingFlips;
}

function applyResolvedDamage(
  player: PlayerState,
  flipInstanceIds: string[],
  deckDraws: number,
  totalDamage: number,
  damagedOnEnemyTurn?: boolean,
): PlayerState {
  const flipSet = new Set(flipInstanceIds);
  const power = player.power.map((c) =>
    flipSet.has(c.instanceId) && !c.faceDown ? { ...c, faceDown: true } : { ...c },
  );
  let deck = [...player.deck];
  for (let i = 0; i < deckDraws; i += 1) {
    if (deck.length === 0) break;
    const [drawn, rest] = removeAt(deck, 0);
    deck = rest;
    power.push({ ...drawn, faceDown: true });
  }
  return {
    ...player,
    power,
    deck,
    // ルール: R-DMG-01 ダメージはパワーゾーンのウラ向き枚数（独立カウンタとの乖離を防ぐ）
    damage: Math.max(player.damage + totalDamage, power.filter((c) => c.faceDown).length),
    ...(damagedOnEnemyTurn ? { damagedOnEnemyTurn: true } : {}),
  };
}

function autoPickRemainingFlips(
  player: PlayerState,
  alreadySelected: string[],
  count: number,
): string[] {
  const picked = [...alreadySelected];
  let remaining = count;
  while (remaining > 0) {
    const next = player.power.find(
      (c) => !c.faceDown && !picked.includes(c.instanceId),
    );
    if (!next) break;
    picked.push(next.instanceId);
    remaining -= 1;
  }
  return picked;
}

export function startDamagePayment(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  resume: DamagePaymentResume,
  choosingPlayerId?: PlayerId,
  options?: { bloodVesselPreferMorph?: boolean },
): GameState {
  const player = state.players[playerId];
  const faceUpCount = player.power.filter((c) => !c.faceDown).length;
  const flipsFromPower = Math.min(amount, faceUpCount);
  const chooser = choosingPlayerId ?? playerId;

  return {
    ...state,
    pendingDamagePayment: {
      playerId,
      choosingPlayerId: choosingPlayerId !== playerId ? choosingPlayerId : undefined,
      remainingFlips: flipsFromPower,
      deckDraws: amount - flipsFromPower,
      totalDamage: amount,
      selectedFlipIds: [],
      resume,
      bloodVesselPreferMorph: options?.bloodVesselPreferMorph,
    },
    activePlayer: chooser,
  };
}

/** ダメージを適用。裏返し対象を選べる場合は支払い選択を開始する。 */
export function applyDamageToPlayer(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  resume: DamagePaymentResume,
  choosingPlayerId?: PlayerId,
  options?: { bloodVesselPreferMorph?: boolean },
): GameState {
  if (amount <= 0) return state;
  // RS-348 メディテーション: 1点受けるたび追加1点（追加分に追加はない）
  if (state.players[playerId].operation.some((c) => c.cardId === "RS-348")) {
    amount = amount * 2;
  }
  const player = state.players[playerId];
  if (
    requiresDamagePowerChoice(player, amount) ||
    hasAkanetakaOption(state, playerId, amount, resume)
  ) {
    return startDamagePayment(state, playerId, amount, resume, choosingPlayerId, options);
  }
  const damaged = applyPlayerDamage(player, amount);
  // damage_gate_battle_entry: 敵軍ターン中の被ダメージを記録
  const nextPlayer =
    state.activePlayer !== playerId ? { ...damaged, damagedOnEnemyTurn: true } : damaged;
  const phasePlayerId =
    resume.kind === "none" ? resume.activePlayer : resume.pending.battlePhasePlayer;
  let nextState = emitDamageAppliedAndResolve(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    { playerId, amount, source: resume.kind, phasePlayerId },
  );
  if (resume.kind === "none") {
    nextState = { ...nextState, activePlayer: resume.activePlayer };
  }
  return nextState;
}

export function resolveDamagePaymentSelect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; resume: DamagePaymentResume } | { error: string } {
  const initial = state.pendingDamagePayment;
  if (!initial || damagePaymentChoosingPlayer(initial) !== playerId) {
    return { error: "no_pending_damage" };
  }
  let pending: PendingDamagePayment = initial;
  if (!getDamagePaymentChoices(state, pending).includes(instanceId)) {
    return { error: "invalid_target" };
  }

  let selectedFlipIds = pending.selectedFlipIds;
  let remainingFlips = pending.remainingFlips;
  if (getAkanetakaCandidates(state, pending).includes(instanceId)) {
    const used = useAkanetaka(state, pending, instanceId);
    state = used.state;
    pending = used.pending;
    remainingFlips = pending.remainingFlips;
  } else if (instanceId === DAMAGE_PAYMENT_DECLINE_COUNTER) {
    pending = { ...pending, akanetakaUsed: true };
  } else {
    selectedFlipIds = [...pending.selectedFlipIds, instanceId];
    remainingFlips = pending.remainingFlips - 1;
  }
  const faceUpRemaining = getValidDamagePowerTargets(state, {
    ...pending,
    selectedFlipIds,
  }).length;

  if (
    stillRequiresDamagePowerChoice(
      { ...pending, selectedFlipIds, remainingFlips },
      faceUpRemaining,
    ) ||
    (remainingFlips + pending.deckDraws > 0 &&
      getAkanetakaCandidates(state, { ...pending, selectedFlipIds, remainingFlips }).length > 0)
  ) {
    return {
      state: {
        ...state,
        pendingDamagePayment: {
          ...pending,
          selectedFlipIds,
          remainingFlips,
        },
      },
      resume: pending.resume,
    };
  }

  const defenderId = pending.playerId;
  const defender = state.players[defenderId];
  const allFlipIds = autoPickRemainingFlips(defender, selectedFlipIds, remainingFlips);
  const nextPlayer = applyResolvedDamage(
    defender,
    allFlipIds,
    pending.deckDraws,
    pending.totalDamage,
    state.activePlayer !== defenderId,
  );

  const resume = pending.resume;
  let nextState: GameState = emitDamageAppliedAndResolve(
    {
      ...state,
      ...updatePlayer(state, defenderId, nextPlayer),
      pendingDamagePayment: undefined,
    },
    {
      playerId: defenderId,
      amount: pending.totalDamage + (pending.replacedDamage ?? 0),
      source: pending.resume.kind,
      phasePlayerId: state.activePlayer,
    },
  );

  if (resume.kind === "none") {
    nextState = { ...nextState, activePlayer: resume.activePlayer };
  }

  return { state: nextState, resume };
}
