import { applyAction } from "../core/applyAction";
import { getDefinition, isUnit } from "../core/catalog";
import { findInZone } from "../core/helpers";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { canBeginZordSetup } from "../rules/zordSetup";
import { needsZordMaterial } from "../rules/zord";

type RushPaymentZord = Pick<
  GameAction,
  | "zordMaterialInstanceId"
  | "zordMaterialDestination"
  | "zordMothershipHoldInstanceIds"
>;

function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error ?? "illegal_action");
  return result.state;
}

function resolveZordSetupPayment(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceId: string,
  zord: RushPaymentZord,
): ReturnType<typeof applyAction> {
  let next = unwrap(
    applyAction(state, {
      type: "begin_zord_setup",
      playerId,
      zordInstanceId: unitInstanceId,
    }),
  );

  if (next.pendingZordSetup?.step === "destination" && zord.zordMaterialDestination) {
    next = unwrap(
      applyAction(next, {
        type: "resolve_zord_setup",
        playerId,
        destination: zord.zordMaterialDestination,
      }),
    );
  }

  if (next.pendingZordSetup?.step === "mothership") {
    next = unwrap(
      applyAction(next, {
        type: "resolve_zord_setup",
        playerId,
        paymentPath: "mothership",
      }),
    );
  }

  if (next.pendingZordSetup && zord.zordMaterialInstanceId) {
    const resolved = applyAction(next, {
      type: "resolve_zord_setup",
      playerId,
      materialInstanceId: zord.zordMaterialInstanceId,
    });
    if (!resolved.ok) return resolved;
    next = resolved.state;
  }

  if (next.pendingCommandPayment) {
    return applyAction(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: zord.zordMothershipHoldInstanceIds ?? [commandInstanceId],
    });
  }

  if (next.players[playerId].rush.some((c) => c.instanceId === unitInstanceId)) {
    return { ok: true, state: next };
  }

  return { ok: false, error: "zord_setup_incomplete" };
}

/** カテゴリホールド支払いを挟んでラッシュする（テスト用）。 */
export function rushWithCategoryHold(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceId: string,
  zord?: RushPaymentZord,
) {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", unitInstanceId);
  const def = found ? getDefinition(state.definitions, found.card.cardId) : null;

  if (
    found &&
    def &&
    isUnit(def) &&
    needsZordMaterial(state.definitions, found.card.cardId) &&
    canBeginZordSetup(state, playerId, unitInstanceId) &&
    (zord?.zordMaterialInstanceId || (zord?.zordMothershipHoldInstanceIds?.length ?? 0) > 0)
  ) {
    return resolveZordSetupPayment(
      state,
      playerId,
      unitInstanceId,
      commandInstanceId,
      zord ?? {},
    );
  }

  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: unitInstanceId,
    zordMaterialInstanceId: zord?.zordMaterialInstanceId,
    zordMaterialDestination: zord?.zordMaterialDestination,
    zordMothershipHoldInstanceIds: zord?.zordMothershipHoldInstanceIds,
  });
  if (!initiated.ok) return initiated;
  return applyAction(initiated.state, {
    type: "resolve_command_payment",
    playerId,
    commandInstanceIds: zord?.zordMothershipHoldInstanceIds ?? [commandInstanceId],
  });
}
