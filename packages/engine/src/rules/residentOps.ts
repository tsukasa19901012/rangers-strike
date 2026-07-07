/**
 * 常駐オペレーションのカード別ランタイム。
 *
 * DSL スタブが「resident」マーカーのみのカード（wiki テキストに実処理があるもの）を
 * ここで実装する。配置時 / 自軍ユニット被アタック時などのフックを提供する。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";

export type ResidentOpAttackedResult = {
  state: GameState;
  /** true ならこのバトルは行われない（アタック自体は消費される）。 */
  preventBattle: boolean;
  log?: string;
};

type ResidentOpRuntime = {
  cardIds: readonly string[];
  /** これを配置するとき。 */
  onPlace?: (
    state: GameState,
    ownerId: PlayerId,
    opInstanceId: string,
  ) => GameState;
  /** 自軍ユニットがアタックされるたび（バトル解決直前）。 */
  onAllyAttacked?: (
    state: GameState,
    ownerId: PlayerId,
    opInstanceId: string,
    pending: PendingBattle,
    defenderDef: CardDefinition | undefined,
  ) => ResidentOpAttackedResult | null;
};

function updateOperationCard(
  state: GameState,
  ownerId: PlayerId,
  opInstanceId: string,
  update: (card: CardInstance) => CardInstance,
): GameState {
  const player = state.players[ownerId];
  const operation = player.operation.map((card) =>
    card.instanceId === opInstanceId ? update(card) : card,
  );
  return { ...state, ...updatePlayer(state, ownerId, { ...player, operation }) };
}

/* --- クロックアップ（RK-021 / RK-078） --- */

const CLOCK_UP: ResidentOpRuntime = {
  cardIds: ["RK-021", "RK-078"],
  onPlace: (state, ownerId, opInstanceId) => {
    const player = state.players[ownerId];
    const count = player.power.length;
    if (count <= 0) return state;
    const taken = player.deck.slice(0, count).map((card) => ({
      ...card,
      faceDown: true,
    }));
    const deck = player.deck.slice(taken.length);
    const withDeck = {
      ...state,
      ...updatePlayer(state, ownerId, { ...player, deck }),
    };
    return updateOperationCard(withDeck, ownerId, opInstanceId, (card) => ({
      ...card,
      stackedCards: [...(card.stackedCards ?? []), ...taken],
    }));
  },
  onAllyAttacked: (state, ownerId, opInstanceId, pending, defenderDef) => {
    if (!(defenderDef?.features ?? []).includes("加速")) return null;
    const player = state.players[ownerId];
    const op = player.operation.find((c) => c.instanceId === opInstanceId);
    const stacked = op?.stackedCards ?? [];
    if (!op || stacked.length === 0) return null;

    // 重ねたカードを1枚、自軍山札の下に戻す（ウラ向き解除）
    const [returned, ...rest] = stacked;
    const { faceDown: _fd, ...clean } = returned!;
    const deck = [...player.deck, clean];
    const withDeck = {
      ...state,
      ...updatePlayer(state, ownerId, { ...player, deck }),
    };
    const next = updateOperationCard(withDeck, ownerId, opInstanceId, (card) => ({
      ...card,
      stackedCards: rest,
    }));
    return {
      state: next,
      preventBattle: true,
      log: buildLogEntry(
        ownerId,
        "named_effect",
        op.cardId,
        state.definitions,
        "クロックアップ: バトルは行われない",
      ),
    };
  },
};

/* --- ゲゲル（RK-081）: 敵撃破のたび山札トップを重ねる / スタートで10枚あれば全S SP1 --- */

const GEGERU: ResidentOpRuntime = {
  cardIds: ["RK-081"],
};

const RESIDENT_OP_RUNTIMES: readonly ResidentOpRuntime[] = [CLOCK_UP, GEGERU];

/** RK-081 ゲゲル: 自軍バトルフェイズに敵軍ユニットを撃破したとき山札の上を1枚重ねる。 */
export function applyGegeruOnEnemyDestroyed(
  state: GameState,
  destroyerPlayerId: PlayerId,
): GameState {
  if (state.phase !== "battle" || state.activePlayer !== destroyerPlayerId) return state;
  const player = state.players[destroyerPlayerId];
  const op = player.operation.find((c) => c.cardId === "RK-081");
  if (!op || player.deck.length === 0) return state;
  const [top, ...deck] = player.deck;
  const withDeck = {
    ...state,
    ...updatePlayer(state, destroyerPlayerId, { ...player, deck }),
  };
  return updateOperationCard(withDeck, destroyerPlayerId, op.instanceId, (card) => ({
    ...card,
    stackedCards: [...(card.stackedCards ?? []), { ...top!, faceDown: true }],
  }));
}

/** RK-081 ゲゲル: スタート時に重ね10枚以上→このターン自軍S全員SP1、ターン終了時に捨札。 */
export function applyGegeruStartPhase(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  const op = player.operation.find((c) => c.cardId === "RK-081");
  if (!op || (op.stackedCards ?? []).length < 10) return state;
  const mark = (cards: typeof player.rush) =>
    cards.map((c) => ({
      ...c,
      activatedNcEffects: [...(c.activatedNcEffects ?? []), "gegeru_sp1"],
    }));
  const operation = player.operation.map((c) =>
    c.instanceId === op.instanceId ? { ...c, residentActivatedThisRush: true, gegeruDiscardAtEnd: true } : c,
  );
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      rush: mark(player.rush),
      battle: mark(player.battle),
      operation,
    }),
  };
}

/** ゲゲル: ターン終了時、発動済みなら捨札にする（重ねは operationCardsToDiscardWithStack）。 */
export function applyGegeruTurnEnd(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const op = player.operation.find((c) => c.cardId === "RK-081" && c.gegeruDiscardAtEnd);
  if (!op) return state;
  const stacked = (op.stackedCards ?? []).map(({ faceDown: _fd, ...c }) => c);
  const { stackedCards: _sc, gegeruDiscardAtEnd: _g, ...clean } = op;
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      operation: player.operation.filter((c) => c.instanceId !== op.instanceId),
      discard: [...player.discard, clean, ...stacked],
    }),
  };
}

/** RS-124 超電子レーダー: 両者、Sユニットをラッシュしたときパワーの非ダメージ1枚を手札へ。 */
export function applyRadarOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedCardId: string,
): GameState {
  const anyRadar = (["player1", "player2"] as const).some((pid) =>
    state.players[pid].operation.some((c) => c.cardId === "RS-124"),
  );
  if (!anyRadar) return state;
  const def = getDefinition(state.definitions, rushedCardId);
  if (!def || def.type !== "unit" || def.size !== "S") return state;
  const player = state.players[rusherPlayerId];
  const idx = player.power.findIndex((c) => !c.faceDown);
  if (idx < 0) return state;
  const card = player.power[idx]!;
  return {
    ...state,
    ...updatePlayer(state, rusherPlayerId, {
      ...player,
      power: player.power.filter((_, i) => i !== idx),
      hand: [...player.hand, card],
    }),
  };
}

function runtimeForCard(cardId: string): ResidentOpRuntime | undefined {
  return RESIDENT_OP_RUNTIMES.find((r) => r.cardIds.includes(cardId));
}

/** 配置時フック。placePermanentOperation の直後に呼ぶ。 */
export function applyResidentOpOnPlace(
  state: GameState,
  ownerId: PlayerId,
  opInstanceId: string,
  cardId: string,
): GameState {
  const runtime = runtimeForCard(cardId);
  if (!runtime?.onPlace) return state;
  return runtime.onPlace(state, ownerId, opInstanceId);
}

/**
 * 自軍ユニットが被アタック時のフック。バトル解決の直前に呼ぶ。
 * バトルを行わない場合は preventBattle: true を返す。
 */
export function applyResidentOpsOnAllyAttacked(
  state: GameState,
  pending: PendingBattle,
): ResidentOpAttackedResult | null {
  const ownerId = pending.defenderPlayerId;
  const player = state.players[ownerId];
  const defender =
    player.battle.find((c) => c.instanceId === pending.defenderInstanceId) ??
    player.rush.find((c) => c.instanceId === pending.defenderInstanceId);
  if (!defender) return null;
  const defenderDef = getDefinition(state.definitions, defender.cardId);

  for (const op of player.operation) {
    const runtime = runtimeForCard(op.cardId);
    if (!runtime?.onAllyAttacked) continue;
    const result = runtime.onAllyAttacked(
      state,
      ownerId,
      op.instanceId,
      pending,
      defenderDef,
    );
    if (result) return result;
  }
  return null;
}
