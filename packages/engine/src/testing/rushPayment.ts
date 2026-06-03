import { applyAction } from "../core/applyAction";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";

type RushPaymentZord = Pick<
  GameAction,
  | "zordMaterialInstanceId"
  | "zordMaterialDestination"
  | "zordMothershipHoldInstanceIds"
>;

/** カテゴリホールド支払いを挟んでラッシュする（テスト用）。 */
export function rushWithCategoryHold(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceId: string,
  zord?: RushPaymentZord,
) {
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
    commandInstanceIds: [commandInstanceId],
  });
}
