import type { CardInstance } from "../types/game";

/** バトル左隣が vehicle で、右隣ユニットがまだその vehicle にライド中。 */
export function isRiddenVehiclePair(battle: CardInstance[], vehicleIndex: number): boolean {
  const vehicle = battle[vehicleIndex];
  const rider = battle[vehicleIndex + 1];
  return (
    !!vehicle &&
    !!rider &&
    rider.mountedOnInstanceId === vehicle.instanceId
  );
}

/** ライド中ビークル＋ライダーは1コンボ枠として数える。 */
export function countLogicalBattleSlots(battle: CardInstance[]): number {
  let count = 0;
  let i = 0;
  while (i < battle.length) {
    if (isRiddenVehiclePair(battle, i)) {
      count += 1;
      i += 2;
    } else {
      count += 1;
      i += 1;
    }
  }
  return count;
}

export function logicalBattlePosition(
  battle: CardInstance[],
  instanceId: string,
): number | null {
  let slot = 0;
  let i = 0;
  while (i < battle.length) {
    slot += 1;
    if (isRiddenVehiclePair(battle, i)) {
      const vehicle = battle[i]!;
      const rider = battle[i + 1]!;
      if (vehicle.instanceId === instanceId || rider.instanceId === instanceId) {
        return slot;
      }
      i += 2;
    } else {
      const card = battle[i]!;
      if (card.instanceId === instanceId) return slot;
      i += 1;
    }
  }
  return null;
}
