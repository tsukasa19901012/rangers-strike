import { getCardById } from "@rangers-strike/cards";
import type { GameState, PendingZordSetup, PlayerId } from "@rangers-strike/engine";
import { listZordSetupResolveActions } from "@rangers-strike/engine";

export function zordSetupTitle(setup: PendingZordSetup): string {
  const card = getCardById(setup.zordCardId);
  const name = card?.name ?? setup.zordCardId;
  return `追加条件 — ${name}をラッシュ`;
}

export function zordSetupHint(setup: PendingZordSetup): string {
  if (setup.step === "destination") {
    return "Sユニットをコマンドゾーンに置くか、捨て札にするか選んでください。";
  }
  if (setup.step === "material") {
    if (setup.materialDestination === "command") {
      return "コマンドゾーンに置くSユニットを選んでください。";
    }
    if (setup.materialDestination === "discard") {
      return "捨て札にするSユニットを選んでください。";
    }
    return "追加条件の素材を選んでください。";
  }
  return "母艦の支払いに使うコマンドを、次の画面で選びます。";
}

export function zordSetupZoneHint(
  state: GameState,
  playerId: PlayerId,
  validTargetIds: Set<string>,
): string | undefined {
  if (validTargetIds.size === 0) return undefined;
  const player = state.players[playerId];
  const rush = player.rush.some((c) => validTargetIds.has(c.instanceId));
  const battle = player.battle.some((c) => validTargetIds.has(c.instanceId));
  if (rush && battle) return "ラッシュ／バトルエリアのカードをタップ";
  if (rush) return "ラッシュエリアのカードをタップ";
  if (battle) return "バトルエリアのカードをタップ";
  return undefined;
}

export function zordSetupLegalFlags(
  state: GameState,
  setup: PendingZordSetup,
): {
  canPickCommand: boolean;
  canPickDiscard: boolean;
  canUseMothership: boolean;
} {
  const legalResolves = listZordSetupResolveActions(state, setup);
  return {
    canPickCommand: legalResolves.some((a) => a.destination === "command"),
    canPickDiscard: legalResolves.some((a) => a.destination === "discard"),
    canUseMothership: legalResolves.some((a) => a.paymentPath === "mothership"),
  };
}

export function zordSetupHighlightZones(
  state: GameState,
  playerId: PlayerId,
  validTargetIds: Set<string>,
): { rush: boolean; battle: boolean } {
  if (validTargetIds.size === 0) {
    return { rush: false, battle: false };
  }
  const player = state.players[playerId];
  return {
    rush: player.rush.some((c) => validTargetIds.has(c.instanceId)),
    battle: player.battle.some((c) => validTargetIds.has(c.instanceId)),
  };
}
