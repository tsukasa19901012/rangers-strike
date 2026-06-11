import { isSpFraction, type SpFraction, type SpValue, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";

export function parseSpFraction(sp: SpValue | undefined): SpFraction | null {
  if (!isSpFraction(sp)) return null;
  return sp;
}

export function fractionDenominator(sp: SpFraction): number {
  const parts = sp.split("/");
  const denom = Number(parts[1]);
  return Number.isFinite(denom) ? denom : 0;
}

/** 分数 SP が並び成立時に与える実効 SP（公式: 分母位置なら SP1）。 */
export function alignedFractionSp(sp: SpFraction, battlePosition: number): number {
  return battlePosition === fractionDenominator(sp) ? 1 : 0;
}

export function battlePositionOneBased(
  battle: CardInstance[],
  instanceId: string,
): number | null {
  const index = battle.findIndex((card) => card.instanceId === instanceId);
  return index >= 0 ? index + 1 : null;
}

export function resolveInstanceSpValue(
  definition: CardDefinition | undefined,
  instance: CardInstance,
): SpValue | undefined {
  if (instance.spOverride !== undefined) return instance.spOverride;
  return definition?.sp;
}

/** カード定義・並びからの素の SP（modifier・フィールド効果前）。 */
export function printedSpBase(
  sp: SpValue | undefined,
  battlePosition: number | null,
): number {
  if (sp === undefined || sp === null) return 0;
  if (typeof sp === "number") return sp;
  if (sp === "special") return 0;
  if (isSpFraction(sp)) {
    if (battlePosition === null) return 0;
    return alignedFractionSp(sp, battlePosition);
  }
  return 0;
}

export function battlePrintedSpBase(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  const position = battlePositionOneBased(state.players[playerId].battle, instance.instanceId);
  return printedSpBase(resolveInstanceSpValue(def, instance), position);
}
