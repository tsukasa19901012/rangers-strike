/**
 * RS-183 黒子ロボの記憶操作
 * 「この効果は、自分が行ったあとで相手も行う⇒3枚までドローする。そして、以下の手順を3回行う。
 * 自分の手札を相手に見せずに1枚選ばせ、選ばれたカードを自軍山札の上に戻す。
 * ただし、自軍コマンドを1つホールドすれば戻さなくてもよい。」
 *
 * ルール: R-WIN-04 — 「3枚まで」なので、山札を残す枚数だけ引いて敗北を避けられる。
 * その後の「山札に戻す」手順は、引いた枚数に関係なく手札がある限り必ず3回行う（faq-card-4 RS-183）。
 * ルール: R-START-04 — 効果の「ドロー」には超電子頭脳が適用される。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { applySuperBrainDraw } from "../effects/drawEffects";

export const KUROKO_MEMORY_EFFECT_ID = "kuroko_memory";
const KUROKO_CARD_ID = "RS-183";
const DRAW_LIMIT = 3;
const RETURN_STEPS = 3;

export type KurokoMemoryMeta = NonNullable<PendingEffectChoice["kurokoMeta"]>;

/** 効果の解決を始める（使用者 → 相手の順）。 */
export function startKurokoMemory(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  sourceCardId: string = KUROKO_CARD_ID,
): GameState {
  return continueKurokoMemory(
    state,
    { initiatorId: playerId, actorId: playerId, stage: "draw", drawn: 0, returnsLeft: RETURN_STEPS },
    phasePlayerId,
    sourceCardId,
  );
}

/**
 * 手札から1枚を山札の上に戻す。カードは相手が「見ずに」選ぶため、どれが選ばれるかは
 * 持ち主にも相手にも制御できない — エンジンは無作為に選ぶ。
 */
function returnBlindPickedHandCard(state: GameState, actorId: PlayerId): GameState {
  const actor = state.players[actorId];
  if (actor.hand.length === 0) return state;
  const index = Math.floor(Math.random() * actor.hand.length);
  const picked = actor.hand[index]!;
  const hand = actor.hand.filter((_, i) => i !== index);
  const next: GameState = {
    ...state,
    ...updatePlayer(state, actorId, { ...actor, hand, deck: [picked, ...actor.deck] }),
  };
  return {
    ...next,
    log: [
      ...next.log,
      buildLogEntry(actorId, "named_effect", KUROKO_CARD_ID, state.definitions, "kuroko_memory:return"),
    ],
  };
}

export function continueKurokoMemory(
  state: GameState,
  meta: KurokoMemoryMeta,
  phasePlayerId: PlayerId,
  sourceCardId: string,
): GameState {
  let s = state;
  let m = meta;
  for (let guard = 0; guard < 32; guard += 1) {
    const actor = s.players[m.actorId];
    if (m.stage === "draw") {
      if (m.drawn < DRAW_LIMIT && actor.deck.length > 0) {
        return {
          ...s,
          pendingEffectChoice: {
            playerId: m.actorId,
            effectId: KUROKO_MEMORY_EFFECT_ID,
            sourceCardId,
            kind: "optional_deck_draw",
            phasePlayerId,
            validInstanceIds: ["draw"],
            selectedInstanceIds: [],
            optional: true,
            kurokoMeta: m,
          },
          activePlayer: m.actorId,
        };
      }
      m = { ...m, stage: "return" };
      continue;
    }

    if (m.returnsLeft > 0 && actor.hand.length > 0) {
      const released = actor.command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
      if (released.length > 0) {
        // 「ただし、自軍コマンドを1つホールドすれば戻さなくてもよい」— スキップで戻す。
        return {
          ...s,
          pendingEffectChoice: {
            playerId: m.actorId,
            effectId: KUROKO_MEMORY_EFFECT_ID,
            sourceCardId,
            kind: "select_command",
            phasePlayerId,
            validInstanceIds: released,
            selectedInstanceIds: [],
            optional: true,
            commandAction: "hold",
            commandFilter: "released",
            kurokoMeta: m,
          },
          activePlayer: m.actorId,
        };
      }
      s = returnBlindPickedHandCard(s, m.actorId);
      m = { ...m, returnsLeft: m.returnsLeft - 1 };
      continue;
    }

    if (m.actorId === m.initiatorId) {
      // 「自分が行ったあとで相手も行う」
      m = {
        initiatorId: m.initiatorId,
        actorId: opponent(m.initiatorId),
        stage: "draw",
        drawn: 0,
        returnsLeft: RETURN_STEPS,
      };
      continue;
    }
    break;
  }
  return { ...s, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

/** ドロー（海底サーチ等の割り込み後を含む）を1回行ったあとの続行。 */
export function continueKurokoMemoryAfterDraw(state: GameState, pending: PendingEffectChoice): GameState {
  const meta = pending.kurokoMeta!;
  return continueKurokoMemory(
    { ...state, pendingEffectChoice: undefined },
    { ...meta, drawn: meta.drawn + 1 },
    pending.phasePlayerId,
    pending.sourceCardId,
  );
}

/** 「自軍コマンドを1つホールドすれば戻さなくてもよい」— ホールド後（effect_hold 支払い経路を含む）の続行。 */
export function continueKurokoMemoryAfterHold(state: GameState, pending: PendingEffectChoice): GameState {
  const meta = pending.kurokoMeta!;
  return continueKurokoMemory(
    { ...state, pendingEffectChoice: undefined },
    { ...meta, returnsLeft: meta.returnsLeft - 1 },
    pending.phasePlayerId,
    pending.sourceCardId,
  );
}

export function resolveKurokoMemoryChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; log?: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.kurokoMeta;
  if (!pending || !meta || pending.effectId !== KUROKO_MEMORY_EFFECT_ID) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined };

  if (meta.stage === "draw") {
    const actor = cleared.players[playerId];
    if (actor.deck.length === 0) return { error: "empty_deck" };
    const drawn = applySuperBrainDraw(cleared, playerId, actor, pending.phasePlayerId, {
      pending,
      detail: "draw",
    });
    if (drawn.pending) return { state: drawn.state };
    return {
      state: continueKurokoMemoryAfterDraw(drawn.state, pending),
      log: buildLogEntry(playerId, "resolve_effect_choice", pending.sourceCardId, state.definitions, "kuroko_memory:draw"),
    };
  }

  const actor = cleared.players[playerId];
  const command = actor.command.find((c) => c.instanceId === instanceId && !c.commandHeld);
  if (!command) return { error: "invalid_target" };
  const held: GameState = {
    ...cleared,
    ...updatePlayer(cleared, playerId, {
      ...actor,
      command: actor.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    }),
  };
  return {
    state: continueKurokoMemoryAfterHold(held, pending),
    log: buildLogEntry(playerId, "resolve_effect_choice", pending.sourceCardId, state.definitions, "kuroko_memory:hold"),
  };
}

export function skipKurokoMemoryChoice(
  state: GameState,
  playerId: PlayerId,
): { state: GameState; log?: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  const meta = pending?.kurokoMeta;
  if (!pending || !meta || pending.effectId !== KUROKO_MEMORY_EFFECT_ID) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  const cleared: GameState = { ...state, pendingEffectChoice: undefined };
  if (meta.stage === "draw") {
    // 「3枚まで」— ここでドローをやめる。
    return {
      state: continueKurokoMemory(cleared, { ...meta, stage: "return" }, pending.phasePlayerId, pending.sourceCardId),
      log: buildLogEntry(playerId, "skip_effect_choice", pending.sourceCardId, state.definitions, `kuroko_memory:drew_${meta.drawn}`),
    };
  }
  const returned = returnBlindPickedHandCard(cleared, playerId);
  return {
    state: continueKurokoMemory(
      returned,
      { ...meta, returnsLeft: meta.returnsLeft - 1 },
      pending.phasePlayerId,
      pending.sourceCardId,
    ),
  };
}
