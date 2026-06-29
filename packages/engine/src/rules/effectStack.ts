import type {
  EffectStack,
  EffectStackFrame,
  EffectStackFrameKind,
  GameState,
  PlayerId,
} from "../types/game";
import { opponent } from "../core/helpers";
import { damagePaymentChoosingPlayer } from "./damagePayment";
import {
  ensureSimultaneousReactionGroup,
  maybeOpenSimultaneousOrderAfterSync,
} from "./simultaneousEffects";

/** 反応窓の優先順位（小さいほど先に解決）。公式: 離場 → ストライク → バトル → ラッシュ。 */
const FRAME_PRIORITY: Record<EffectStackFrameKind, number> = {
  leave_reaction: 0,
  register_choice: 1,
  strike_reaction: 2,
  battle_reaction: 3,
  morph_reaction: 4,
  rush_reaction: 5,
  damage_payment: 6,
  effect_choice: 7,
  battle_entry: 8,
  command_payment: 9,
  zord_setup: 10,
};

function frame(
  id: string,
  kind: EffectStackFrameKind,
  actorPlayerId?: PlayerId,
  simultaneousGroupId?: string,
): EffectStackFrame {
  return {
    id,
    kind,
    actorPlayerId,
    simultaneousGroupId,
    priority: FRAME_PRIORITY[kind],
  };
}

function reactionFrame(
  state: GameState,
  id: string,
  kind: EffectStackFrameKind,
  actorPlayerId?: PlayerId,
): EffectStackFrame {
  return frame(id, kind, actorPlayerId, state.activeSimultaneousGroupId);
}

/** pending* フィールドから効果スタックを構築する。 */
export function buildEffectStack(state: GameState): EffectStack {
  const frames: EffectStackFrame[] = [];

  if (state.pendingLeave) {
    frames.push(
      reactionFrame(
        state,
        "pendingLeave",
        "leave_reaction",
        state.pendingLeave.ownerPlayerId,
      ),
    );
  }
  if (state.pendingRegister) {
    frames.push(
      frame(
        "pendingRegister",
        "register_choice",
        state.pendingRegister.ownerPlayerId,
      ),
    );
  }
  if (state.pendingStrike) {
    frames.push(
      reactionFrame(
        state,
        "pendingStrike",
        "strike_reaction",
        opponent(state.pendingStrike.strikerPlayerId),
      ),
    );
  }
  if (state.pendingBattle) {
    frames.push(
      reactionFrame(
        state,
        "pendingBattle",
        "battle_reaction",
        state.pendingBattle.defenderPlayerId,
      ),
    );
  }
  if (state.pendingMorph) {
    frames.push(
      reactionFrame(
        state,
        "pendingMorph",
        "morph_reaction",
        state.pendingMorph.defenderPlayerId,
      ),
    );
  }
  if (state.pendingRush) {
    frames.push(
      reactionFrame(
        state,
        "pendingRush",
        "rush_reaction",
        opponent(state.pendingRush.rusherPlayerId),
      ),
    );
  }
  if (state.pendingDamagePayment) {
    frames.push(
      frame(
        "pendingDamagePayment",
        "damage_payment",
        damagePaymentChoosingPlayer(state.pendingDamagePayment),
      ),
    );
  }
  if (state.pendingEffectChoice && state.pendingEffectChoice.effectId !== "morph_replacement") {
    frames.push(
      frame(
        "pendingEffectChoice",
        "effect_choice",
        state.pendingEffectChoice.playerId,
      ),
    );
  }
  if (state.pendingBattleEntry) {
    frames.push(
      frame(
        "pendingBattleEntry",
        "battle_entry",
        state.pendingBattleEntry.playerId,
      ),
    );
  }
  if (state.pendingCommandPayment) {
    frames.push(
      frame(
        "pendingCommandPayment",
        "command_payment",
        state.pendingCommandPayment.playerId,
      ),
    );
  }
  if (state.pendingChase) {
    frames.push(
      frame("pendingChase", "effect_choice", state.pendingChase.chaserPlayerId),
    );
  }
  if (state.pendingRideOffChoice) {
    frames.push(
      frame(
        "pendingRideOffChoice",
        "effect_choice",
        state.pendingRideOffChoice.playerId,
      ),
    );
  }
  if (state.pendingZordSetup) {
    frames.push(
      frame("pendingZordSetup", "zord_setup", state.pendingZordSetup.playerId),
    );
  }

  const order = state.reactionResolutionOrder;
  frames.sort((a, b) => {
    if (order?.length) {
      const aIdx = order.indexOf(a.id);
      const bIdx = order.indexOf(b.id);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
    }
    return a.priority - b.priority || a.id.localeCompare(b.id);
  });
  return { frames };
}

export function withSyncedEffectStack(state: GameState): GameState {
  let next = ensureSimultaneousReactionGroup(state);
  next = { ...next, effectStack: buildEffectStack(next) };
  next = maybeOpenSimultaneousOrderAfterSync(next);
  if (next.pendingEffectChoice?.kind === "simultaneous_order") {
    next = { ...next, effectStack: buildEffectStack(next) };
  }
  return next;
}

/** pending* から毎回導出する（state.effectStack キャッシュは読み取りに使わない）。 */
function resolveEffectStack(state: GameState): EffectStack {
  return buildEffectStack(state);
}

export function peekEffectStackTop(state: GameState): EffectStackFrame | undefined {
  return resolveEffectStack(state).frames[0];
}

/** スタック最上位フレームの応答プレイヤー。 */
export function getStackActorPlayerId(state: GameState): PlayerId | undefined {
  return peekEffectStackTop(state)?.actorPlayerId;
}

/** 同時解決グループの先頭フレーム群を返す。 */
export function getSimultaneousGroup(
  state: GameState,
): EffectStackFrame[] {
  const stack = resolveEffectStack(state);
  const top = stack.frames[0];
  if (!top?.simultaneousGroupId) return top ? [top] : [];
  return stack.frames.filter(
    (f) => f.simultaneousGroupId === top.simultaneousGroupId,
  );
}

export function hasOpenEffectStack(state: GameState): boolean {
  return resolveEffectStack(state).frames.length > 0;
}

/** 反応窓が開いているか（ダメージ支払い・効果選択を除く）。 */
export function hasOpenReactionWindow(state: GameState): boolean {
  const top = peekEffectStackTop(state);
  if (!top) return false;
  return (
    top.kind === "leave_reaction" ||
    top.kind === "register_choice" ||
    top.kind === "strike_reaction" ||
    top.kind === "battle_reaction" ||
    top.kind === "morph_reaction" ||
    top.kind === "rush_reaction"
  );
}
