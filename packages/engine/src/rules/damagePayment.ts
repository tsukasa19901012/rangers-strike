import type {
  DamagePaymentResume,
  GameState,
  PendingDamagePayment,
  PlayerId,
  PlayerState,
} from "../types/game";
import { applyPlayerDamage, removeAt, updatePlayer } from "../core/helpers";

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
  return state.players[pending.playerId].power
    .filter((c) => !c.faceDown && !selected.has(c.instanceId))
    .map((c) => c.instanceId);
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
    damage: player.damage + totalDamage,
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
    },
    activePlayer: chooser,
  };
}

/** Apply damage; opens payment choice when defender may pick which face-up power flips. */
export function applyDamageToPlayer(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  resume: DamagePaymentResume,
  choosingPlayerId?: PlayerId,
): GameState {
  if (amount <= 0) return state;
  const player = state.players[playerId];
  if (requiresDamagePowerChoice(player, amount)) {
    return startDamagePayment(state, playerId, amount, resume, choosingPlayerId);
  }
  const nextPlayer = applyPlayerDamage(player, amount);
  const nextState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
  if (resume.kind === "none") {
    return { ...nextState, activePlayer: resume.activePlayer };
  }
  return nextState;
}

export function resolveDamagePaymentSelect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; resume: DamagePaymentResume } | { error: string } {
  const pending = state.pendingDamagePayment;
  if (!pending || damagePaymentChoosingPlayer(pending) !== playerId) {
    return { error: "no_pending_damage" };
  }
  if (!getValidDamagePowerTargets(state, pending).includes(instanceId)) {
    return { error: "invalid_target" };
  }

  const selectedFlipIds = [...pending.selectedFlipIds, instanceId];
  const remainingFlips = pending.remainingFlips - 1;
  const faceUpRemaining =
    getValidDamagePowerTargets(state, pending).filter((id) => id !== instanceId).length;

  if (
    stillRequiresDamagePowerChoice(
      { ...pending, selectedFlipIds, remainingFlips },
      faceUpRemaining,
    )
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
  );

  const resume = pending.resume;
  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, defenderId, nextPlayer),
    pendingDamagePayment: undefined,
  };

  if (resume.kind === "none") {
    nextState = { ...nextState, activePlayer: resume.activePlayer };
  }

  return { state: nextState, resume };
}
