import type {
  DamagePaymentResume,
  DeferredPowerFlip,
  GameState,
  PendingDamagePayment,
  PlayerId,
  PlayerState,
} from "../types/game";
import { cardCategories, getDefinition } from "../core/catalog";
import { meditationActive } from "../core/createGame";
import { applyPlayerDamage, removeAt, updatePlayer } from "../core/helpers";
import { emitDamageAppliedAndResolve } from "../events/emitDamageApplied";
import { applyPowerFlipBeforeDamage, openBreakActionBeforeFlip } from "./powerFlipEffects";
import { openRk4BeforeFlip } from "./rk/rk4UnitEffects";
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
  if (state.pendingDamagePayment) {
    // 支払い中に同時に発生したダメージは上書きせず、先の支払いのあとに処理する。
    return {
      ...state,
      queuedDamagePayments: [
        ...(state.queuedDamagePayments ?? []),
        { playerId, amount, resume, choosingPlayerId, bloodVesselPreferMorph: options?.bloodVesselPreferMorph },
      ],
    };
  }
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
  if (meditationActive(state, playerId)) {
    amount = amount * 2;
  }
  return applyDamageAmount(state, playerId, amount, resume, choosingPlayerId, options);
}

/** 後回しにしたダメージ（queuedDamagePayments）を1件処理する。 */
export function startNextQueuedDamage(state: GameState): GameState {
  const [next, ...rest] = state.queuedDamagePayments ?? [];
  if (!next || state.pendingDamagePayment) return state;
  return applyDamageAmount(
    { ...state, queuedDamagePayments: rest.length > 0 ? rest : undefined },
    next.playerId,
    next.amount,
    next.resume,
    next.choosingPlayerId,
    // 後回しにしたダメージは、ウラ返したあとでストライクの処理を終えない（従来どおり）。
    { bloodVesselPreferMorph: next.bloodVesselPreferMorph, finishStrike: false },
  );
}

/** メディテーション等の倍化を適用済みのダメージを処理する。 */
function applyDamageAmount(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  resume: DamagePaymentResume,
  choosingPlayerId?: PlayerId,
  options?: { bloodVesselPreferMorph?: boolean; finishStrike?: boolean },
): GameState {
  const player = state.players[playerId];
  if (
    requiresDamagePowerChoice(player, amount) ||
    hasAkanetakaOption(state, playerId, amount, resume)
  ) {
    return startDamagePayment(state, playerId, amount, resume, choosingPlayerId, options);
  }
  const damaged = applyPlayerDamage(player, amount);
  // damage_gate_battle_entry: 敵軍ターン中の被ダメージを記録
  // （効果の選択中は activePlayer が選ぶプレイヤーに替わるので、ターンのプレイヤーは resume から得る）
  const phasePlayerId =
    resume.kind === "none" ? resume.activePlayer : resume.pending.battlePhasePlayer;
  const flipIds = newlyFlippedIds(player, damaged);
  return flipPowerForDamage(state, {
    playerId,
    flipIds,
    deckDraws: amount - flipIds.length,
    totalDamage: amount,
    damagedOnEnemyTurn: phasePlayerId !== playerId,
    eventAmount: amount,
    eventPhasePlayerId: phasePlayerId,
    resume,
    finishStrike: options?.finishStrike ?? true,
  });
}

/** player → damaged で新しくウラ向きになったパワーのカード。 */
function newlyFlippedIds(player: PlayerState, damaged: PlayerState): string[] {
  const faceUp = new Set(player.power.filter((c) => !c.faceDown).map((c) => c.instanceId));
  return damaged.power.filter((c) => c.faceDown && faceUp.has(c.instanceId)).map((c) => c.instanceId);
}

/**
 * パワーのカードをウラ返してダメージにする（ウラ返すカードは決まっている）。
 * ルール: R-TIME-01 — 「ウラ返すとき」（RS-199【ブレイクアクション】）は実際にウラ返す前に解決する。
 * その選択が開いたら、ウラ返しを deferredPowerFlip に待たせて返す（解決後に completeDeferredPowerFlip）。
 */
function flipPowerForDamage(state: GameState, flip: DeferredPowerFlip): GameState {
  // RK-066【俺の必殺技！】も RS-199 と同じ「ストライクして相手がパワーゾーンのカードをウラ返すとき」（rules/rk/rk4UnitEffects.ts）。
  const opened =
    openBreakActionBeforeFlip(state, flip.playerId, flip.flipIds, flip.resume) ??
    openRk4BeforeFlip(state, flip.playerId, flip.flipIds, flip.resume);
  if (opened) {
    // ストライクの反応窓（pendingStrike）は閉じ、ストライクの残りはウラ返したあとで終える（resume.pending に保持）。
    const strikeClosed = flip.resume.kind === "strike" && flip.finishStrike ? { pendingStrike: undefined } : {};
    return { ...opened, ...strikeClosed, pendingDamagePayment: undefined, deferredPowerFlip: flip };
  }
  return applyPowerFlip(state, flip);
}

/** 実際にウラ返し、「ウラ返してダメージにするとき」（RS-202）→ ダメージになったときの誘発の順に解決する。 */
function applyPowerFlip(state: GameState, flip: DeferredPowerFlip): GameState {
  const player = state.players[flip.playerId];
  // 「ウラ返すとき」の効果の解決中にウラ返せなくなったカードがあれば、かわりのカードを選ぶ（atwiki/page-407 のコメント）。
  const stillFaceUp = flip.flipIds.filter((id) => player.power.some((c) => c.instanceId === id && !c.faceDown));
  const flipIds = autoPickRemainingFlips(player, stillFaceUp, flip.flipIds.length - stillFaceUp.length);
  const nextPlayer = applyResolvedDamage(
    player,
    flipIds,
    flip.deckDraws + (flip.flipIds.length - flipIds.length),
    flip.totalDamage,
    flip.damagedOnEnemyTurn,
  );
  const flipped: GameState = {
    ...state,
    ...updatePlayer(state, flip.playerId, nextPlayer),
    pendingDamagePayment: undefined,
  };
  // ルール: R-TIME-01 — 「ウラ返してダメージにするとき」（RS-202）は、ダメージになったときの誘発より前。
  let nextState = emitDamageAppliedAndResolve(
    applyPowerFlipBeforeDamage(state, flipped, flip.playerId, flip.resume),
    {
      playerId: flip.playerId,
      amount: flip.eventAmount,
      source: flip.resume.kind,
      phasePlayerId: flip.eventPhasePlayerId,
    },
  );
  if (flip.resume.kind === "none") {
    nextState = { ...nextState, activePlayer: flip.resume.activePlayer };
  }
  return nextState;
}

/**
 * 待たせていたウラ返し（deferredPowerFlip）を行う。「ウラ返すとき」の選択・その中で開いた選択や反応が
 * すべて終わってから呼ぶ（core/applyAction.ts continueDeferredPowerFlip）。
 */
export function completeDeferredPowerFlip(state: GameState): { state: GameState; flip: DeferredPowerFlip } | null {
  const flip = state.deferredPowerFlip;
  if (!flip) return null;
  return { state: applyPowerFlip({ ...state, deferredPowerFlip: undefined }, flip), flip };
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
  const resume = pending.resume;
  const nextState = flipPowerForDamage(
    { ...state, pendingDamagePayment: undefined },
    {
      playerId: defenderId,
      flipIds: allFlipIds,
      deckDraws: pending.deckDraws,
      totalDamage: pending.totalDamage,
      damagedOnEnemyTurn:
        (resume.kind === "none" ? resume.activePlayer : resume.pending.battlePhasePlayer) !== defenderId,
      eventAmount: pending.totalDamage + (pending.replacedDamage ?? 0),
      eventPhasePlayerId: state.activePlayer,
      resume,
      finishStrike: true,
    },
  );

  return { state: nextState, resume };
}
