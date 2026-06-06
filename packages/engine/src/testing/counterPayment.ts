import { applyAction } from "../core/applyAction";
import type { GameState, PlayerId } from "../types/game";

function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error ?? "illegal_action");
  return result.state;
}

/** カテゴリホールド支払いを挟んでカウンターを発動する（テスト用）。 */
export function counterWithCategoryHold(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
  commandInstanceId: string,
  options?: { substituteInstanceId?: string; prismSubstitute?: boolean },
): ReturnType<typeof applyAction> {
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: counterInstanceId,
    substituteInstanceId: options?.substituteInstanceId,
    prismSubstitute: options?.prismSubstitute,
  });
  if (!initiated.ok) return initiated;

  let next = initiated.state;
  const pending = next.pendingCommandPayment;
  if (!pending || pending.playerId !== playerId) {
    return { ok: false, error: "payment_not_pending" };
  }

  const commandInstanceIds =
    pending.prismSubstitute === true
      ? next.players[playerId].command
          .filter((c) => !c.commandHeld)
          .slice(0, pending.totalNeeded)
          .map((c) => c.instanceId)
      : [commandInstanceId];

  if (commandInstanceIds.length !== pending.totalNeeded) {
    return { ok: false, error: "wrong_command_count" };
  }

  try {
    return { ok: true, state: unwrap(
      applyAction(next, {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds,
      }),
    ) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "counter_failed" };
  }
}
