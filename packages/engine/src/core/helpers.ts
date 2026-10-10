import type { CardInstance, PendingRush, PlayerId, PlayerState } from "../types/game";

export function opponent(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

/**
 * ラッシュ反応窓（pendingRush）で応答するプレイヤー（ターンプレイヤーの相手。R-CTR-01）。
 * 相手の効果で出された自軍ユニット（RS-284【スワンウィング】）には持ち主が応答する。
 */
export function rushReactorId(pending: PendingRush): PlayerId {
  return pending.reactorPlayerId ?? opponent(pending.rusherPlayerId);
}

export function updatePlayer(
  state: { players: Record<PlayerId, PlayerState> },
  playerId: PlayerId,
  player: PlayerState,
): { players: Record<PlayerId, PlayerState> } {
  return {
    players: {
      ...state.players,
      [playerId]: player,
    },
  };
}

export function findInZone(
  player: PlayerState,
  zone: keyof Pick<PlayerState, "hand" | "power" | "command" | "rush" | "battle" | "discard" | "operation">,
  instanceId: string,
) {
  const index = player[zone].findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return null;
  return { index, card: player[zone][index]! };
}

/** Wing attacks from rush; normal attacks from battle. */
export function findBattleAttacker(
  player: PlayerState,
  attackerInstanceId: string,
): CardInstance | null {
  const found =
    findInZone(player, "battle", attackerInstanceId) ??
    findInZone(player, "rush", attackerInstanceId);
  return found?.card ?? null;
}

export function removeAt<T>(items: T[], index: number): [T, T[]] {
  const copy = [...items];
  const [removed] = copy.splice(index, 1);
  return [removed!, copy];
}

export function drawOne(player: PlayerState): PlayerState {
  return performDeckDraws(player, 1, "top");
}

/** 山札の上または下から手札へドロー（超電子頭脳の2枚目が引けなくても敗北にしない）。 */
export function performDeckDraws(
  player: PlayerState,
  count: number,
  from: "top" | "bottom",
  superBrainDiscardSecond?: boolean,
): PlayerState {
  let next = player;
  for (let i = 0; i < count; i++) {
    if (next.deck.length === 0) {
      // 引くべきときに引けなければ敗北（公式FAQ RS-027 Q4）。超電子頭脳の2枚目は本来のドローではない。
      if (!(superBrainDiscardSecond && i === 1)) next = { ...next, deckedOut: true };
      break;
    }
    const index = from === "top" ? 0 : next.deck.length - 1;
    const [drawn, deck] = removeAt(next.deck, index);
    // 超電子頭脳の2枚目もいったん手札に入れ、どちらを残すかは呼び出し側の選択（super_brain_keep）で決める。
    next = { ...next, deck, hand: [...next.hand, drawn] };
  }
  return next;
}

/**
 * 山札の上から count 枚「ひく」（手札に加えないドロー以外の「ひく」も含む）。
 * 足りなければ引けるだけ引き、引くべきときに引けなかったので敗北フラグを立てる。
 * ルール: R-START-05, R-WIN-03（ダイノガッツ RS-027 のような「ひく」だけの効果でも敗北）
 */
export function takeFromDeckTop(
  player: PlayerState,
  count: number,
): { player: PlayerState; taken: CardInstance[] } {
  const want = Math.max(0, count);
  const taken = player.deck.slice(0, want);
  const deck = player.deck.slice(taken.length);
  const short = taken.length < want;
  return {
    player: { ...player, deck, ...(short ? { deckedOut: true } : {}) },
    taken,
  };
}

export {
  canAffordPower,
  canAffordAvailablePower,
  countAvailablePower,
  countOpponentMultiCategoryCommands,
  effectivePowerCost,
  enemyPowerCostReduction,
  ENEMY_POWER_COST_MINUS_RULE,
  isMultiCategoryCommand,
  payPowerCost,
} from "./power";

/** 表向きパワーを裏向きにし、必要なら山札から裏向きパワーをドロー。 */
export function applyPlayerDamage(
  player: PlayerState,
  amount: number,
): PlayerState {
  if (amount <= 0) return player;

  let remaining = amount;
  const power = player.power.map((card) => ({ ...card }));
  let deck = [...player.deck];

  for (let i = 0; i < power.length && remaining > 0; i++) {
    const card = power[i]!;
    if (!card.faceDown) {
      power[i] = { ...card, faceDown: true };
      remaining -= 1;
    }
  }

  while (remaining > 0 && deck.length > 0) {
    const [drawn, rest] = removeAt(deck, 0);
    deck = rest;
    power.push({ ...drawn, faceDown: true });
    remaining -= 1;
  }

  return {
    ...player,
    power,
    deck,
    // ルール: R-DMG-01 ダメージはパワーゾーンのウラ向き枚数（独立カウンタとの乖離を防ぐ）
    damage: Math.max(player.damage + amount, power.filter((c) => c.faceDown).length),
  };
}
