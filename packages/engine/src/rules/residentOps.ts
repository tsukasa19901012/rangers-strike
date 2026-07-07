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

const RESIDENT_OP_RUNTIMES: readonly ResidentOpRuntime[] = [CLOCK_UP];

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
