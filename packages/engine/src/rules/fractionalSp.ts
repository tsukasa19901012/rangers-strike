import { isSpFraction, type SpFraction, type SpValue, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { logicalBattlePosition } from "../rules/battleLine";
import { crossReducedNumber, crossReductionFor } from "../keywords/battleKeywords";

export function parseSpFraction(sp: SpValue | undefined): SpFraction | null {
  if (!isSpFraction(sp)) return null;
  return sp;
}

export function fractionDenominator(sp: SpFraction): number {
  const parts = sp.split("/");
  const denom = Number(parts[1]);
  return Number.isFinite(denom) ? denom : 0;
}

/**
 * 分数 SP が並び成立時に与える実効 SP（公式: 分母位置なら SP1）。
 * 左側のクロスで分母は X 少なくなる（2 未満にはならない）。ルール: R-KW-CROSS-01
 */
export function alignedFractionSp(
  sp: SpFraction,
  battlePosition: number,
  crossReduction = 0,
): number {
  return battlePosition === crossReducedNumber(fractionDenominator(sp), crossReduction) ? 1 : 0;
}

export function battlePositionOneBased(
  battle: CardInstance[],
  instanceId: string,
): number | null {
  return logicalBattlePosition(battle, instanceId);
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
  crossReduction = 0,
): number {
  if (sp === undefined || sp === null) return 0;
  if (typeof sp === "number") return sp;
  if (sp === "special") return 0;
  if (isSpFraction(sp)) {
    if (battlePosition === null) return 0;
    return alignedFractionSp(sp, battlePosition, crossReduction);
  }
  return 0;
}

export function battlePrintedSpBase(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  const battle = state.players[playerId].battle;
  const position = battlePositionOneBased(battle, instance.instanceId);
  return printedSpBase(
    resolveInstanceSpValue(def, instance),
    position,
    crossReductionFor(battle, instance.instanceId),
  );
}
