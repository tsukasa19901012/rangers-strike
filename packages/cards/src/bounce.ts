/** バウンス元ゾーン（場・パワー・コマンド等から手札へ戻す）。 */
export type BounceSourceZone =
  | "rush"
  | "battle"
  | "command"
  | "power"
  | "operation";

export const BOUNCE_SOURCE_ZONES: BounceSourceZone[] = [
  "rush",
  "battle",
  "command",
  "power",
  "operation",
];

/** 用語集「バウンス」: カードを持ち主の手札に戻す（撃破・捨札ではない）。 */
export function isBounceSourceZone(zone: string): zone is BounceSourceZone {
  return (BOUNCE_SOURCE_ZONES as string[]).includes(zone);
}
