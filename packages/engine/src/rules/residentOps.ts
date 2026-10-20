/**
 * 常駐オペレーションのカード別ランタイム。
 *
 * DSL スタブが「resident」マーカーのみのカード（wiki テキストに実処理があるもの）を
 * ここで実装する。配置時 / 自軍ユニット被アタック時などのフックを提供する。
 */
import { applyXg2ResidentPlaced } from "./xg2/xg2Effects";
import { rk12ResidentsNegated } from "./rk/rk12Fields";
import { applyRk2ResidentPlaced } from "./rk/rk2UnitEffects";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../types/game";
import { isSameCardIdentity } from "@rangers-strike/cards";
import { openOptionalEffectConfirm, registerOptionalEffect } from "./optionalEffects";
import { getDefinition } from "../core/catalog";
import { takeFromDeckTop, updatePlayer } from "../core/helpers";
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
    // ルール: R-START-05, R-WIN-03 — 「ひいて」重ねる。ひけなければ敗北。
    const { player: afterTake, taken: takenCards } = takeFromDeckTop(player, count);
    const taken = takenCards.map((card) => ({ ...card, faceDown: true }));
    const withDeck = {
      ...state,
      ...updatePlayer(state, ownerId, afterTake),
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

/**
 * RK-081 ゲゲル「自軍バトルフェイズに敵軍ユニットを1体撃破するたび、自軍山札の上から1枚ひいて、ウラ向きのままこれに重ねてもよい。」
 * （atwiki/page-709）。重ねるかを確認する（任意）。オモテは見ない（grnrngr/faq-rider-2 RK-081 Q）。
 * 別の選択が開いていれば、その後に確認する。
 */
export const GEGERU_STACK_EFFECT_ID = "rk081_gegeru_stack";

export function applyGegeruOnEnemyDestroyed(
  state: GameState,
  destroyerPlayerId: PlayerId,
): GameState {
  if (state.phase !== "battle" || state.activePlayer !== destroyerPlayerId) return state;
  const player = state.players[destroyerPlayerId];
  const op = player.operation.find((c) => isSameCardIdentity(c.cardId, "RK-081"));
  if (!op || player.deck.length === 0) return state;
  const confirm: PendingEffectChoice = {
    playerId: destroyerPlayerId,
    phasePlayerId: destroyerPlayerId,
    effectId: GEGERU_STACK_EFFECT_ID,
    sourceCardId: op.cardId,
    sourceInstanceId: op.instanceId,
    kind: "confirm",
    validInstanceIds: [],
    selectedInstanceIds: [],
    optional: true,
    mayConfirm: true,
  };
  if (state.pendingEffectChoice) {
    const append = (c: PendingEffectChoice): PendingEffectChoice => ({ ...c, resumeChoice: c.resumeChoice ? append(c.resumeChoice) : confirm });
    return { ...state, pendingEffectChoice: append(state.pendingEffectChoice) };
  }
  return openOptionalEffectConfirm(state, confirm);
}

registerOptionalEffect(GEGERU_STACK_EFFECT_ID, {
  apply: (state, pending) => {
    const playerId = pending.playerId;
    const player = state.players[playerId];
    const op = player.operation.find((c) => c.instanceId === pending.sourceInstanceId);
    if (!op || player.deck.length === 0) return state;
    const [top, ...deck] = player.deck;
    const withDeck = { ...state, ...updatePlayer(state, playerId, { ...player, deck }) };
    return updateOperationCard(withDeck, playerId, op.instanceId, (card) => ({
      ...card,
      stackedCards: [...(card.stackedCards ?? []), { instanceId: top!.instanceId, cardId: top!.cardId, faceDown: true }],
    }));
  },
});

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
  // RK-022 ライダーパス: 配置するとき山札の「DEN-O」を4枚まで重ねる（rules/rk/rk2UnitEffects.ts）。
  if (cardId === "RK-022") return applyRk2ResidentPlaced(state, ownerId, opInstanceId, cardId);
  // XG2-070 ライドブッカー・ブックモード: 配置するとき山札のモーフを持つユニットカードを3枚まで重ねる（rules/xg2/xg2dEffects.ts）。
  const xg2Placed = applyXg2ResidentPlaced(state, ownerId, opInstanceId, cardId);
  if (xg2Placed) return xg2Placed;
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
  // RK-248 パラダイス・ロスト: このターン、相手の常駐オペレーションは無効（rules/rk/rk12Fields.ts）。
  if (rk12ResidentsNegated(state, ownerId)) return null;

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
