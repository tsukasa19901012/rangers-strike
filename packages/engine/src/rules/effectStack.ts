import type {
  EffectStack,
  EffectStackFrame,
  EffectStackFrameKind,
  GameState,
  PlayerId,
} from "../types/game";
import { opponent } from "../core/helpers";
import { damagePaymentChoosingPlayer } from "./damagePayment";

/** 反応窓の優先順位（小さいほど先に解決）。公式: 離場 → ストライク → バトル → ラッシュ。 */
const FRAME_PRIORITY: Record<EffectStackFrameKind, number> = {
  leave_reaction: 0,
  register_choice: 1,
  strike_reaction: 2,
  battle_reaction: 3,
  rush_reaction: 4,
  damage_payment: 5,
  effect_choice: 6,
  battle_entry: 7,
  command_payment: 8,
  zord_setup: 9,
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

/** pending* フィールドから効果スタックを構築する。 */
export function buildEffectStack(state: GameState): EffectStack {
  const frames: EffectStackFrame[] = [];

  if (state.pendingLeave) {
    frames.push(
      frame("pendingLeave", "leave_reaction", state.pendingLeave.ownerPlayerId),
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
      frame(
        "pendingStrike",
        "strike_reaction",
        opponent(state.pendingStrike.strikerPlayerId),
      ),
    );
  }
  if (state.pendingBattle) {
    frames.push(
      frame(
        "pendingBattle",
        "battle_reaction",
        state.pendingBattle.defenderPlayerId,
      ),
    );
  }
  if (state.pendingRush) {
    frames.push(
      frame(
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
  if (state.pendingEffectChoice) {
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
  if (state.pendingZordSetup) {
    frames.push(
      frame("pendingZordSetup", "zord_setup", state.pendingZordSetup.playerId),
    );
  }

  frames.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return { frames };
}

export function withSyncedEffectStack(state: GameState): GameState {
  return { ...state, effectStack: buildEffectStack(state) };
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
    top.kind === "rush_reaction"
  );
}
