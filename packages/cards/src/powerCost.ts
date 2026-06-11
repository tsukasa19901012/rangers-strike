/** 必要パワー表記の正規化（全角記号 → 半角サフィックス）。 */
export function normalizePowerCostRaw(raw: string): string {
  return raw.replace(/[＋+]/g, "+").replace(/[－-]/g, "-").trim();
}

export function isZordUpCost(powerCost: number | string): boolean {
  return typeof powerCost === "string" && powerCost.endsWith("+");
}

export function isZordDownCost(powerCost: number | string): boolean {
  return typeof powerCost === "string" && powerCost.endsWith("-");
}

/** 必要パワーの数字に「－」があるか（効果の対象判定用）。 */
export function hasPowerCostMinusSuffix(
  powerCost: number | string | undefined,
): boolean {
  return typeof powerCost === "string" && powerCost.endsWith("-");
}

/** カードに印刷された必要パワーの数字（+/- サフィックスを除く）。 */
export function printedPowerCostNumber(
  powerCost: number | string | undefined,
): number {
  if (powerCost === undefined) return 0;
  if (typeof powerCost === "number") return powerCost;
  const parsed = Number.parseInt(powerCost.replace(/[+-]$/, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}
