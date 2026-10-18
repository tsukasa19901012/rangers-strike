import { isSpFraction, type SpFraction, type SpValue, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { rk6RidingSpValue } from "./rk/rk6Fields";
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
  // RK-106 仮面ライダーアギトFF「※これはライド中、「SP1/3」になる。」（rules/rk/rk6Fields.ts）。
  const riding = rk6RidingSpValue(instance);
  if (riding !== undefined) return riding;
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

/**
 * 「「SPn」になる」「次の能力を得る⇒「SPn」」の付与: SP に n を加算するのではなく、その値に置き換える
 * （faq-card-4 RS-234 Q2「ＳＰに１を加算するという意味ではなく…その値に置き換わる」・atwiki/page-1291「SPを1にする」）。
 * 付与した時点の SP（印刷値・並び順の分数・これまでの増減）との差を spModifier に入れるので、
 * もともと SP1 のユニットは SP1 のまま（SP2 にならない）、SP！／空欄のユニットは SP1 になり、
 * その後の「SP+n」はその上に加算される（atwiki/page-104 の適用順の例）。
 * battle を渡さない（ラッシュエリア等）ときは並び順による分数 SP を 0 とみなす。
 */
export function withSpBecomes<T extends CardInstance>(
  definitions: Record<string, CardDefinition>,
  battle: CardInstance[] | undefined,
  instance: T,
  sp: number,
): T {
  const def = getDefinition(definitions, instance.cardId);
  const inBattle = battle?.some((c) => c.instanceId === instance.instanceId) ?? false;
  const base = printedSpBase(
    resolveInstanceSpValue(def, instance),
    inBattle ? battlePositionOneBased(battle!, instance.instanceId) : null,
    inBattle ? crossReductionFor(battle!, instance.instanceId) : 0,
  );
  const current = base + (instance.spModifier ?? 0);
  if (current === sp) return instance;
  return { ...instance, spModifier: (instance.spModifier ?? 0) + (sp - current) };
}

/** 盤面上のユニットを「SPn」にする（withSpBecomes の GameState 版）。 */
export function spBecomesInZone(
  state: GameState,
  playerId: PlayerId,
  zone: "battle" | "rush",
  instanceId: string,
  sp: number,
): GameState {
  const player = state.players[playerId];
  const cards = player[zone].map((c) =>
    c.instanceId === instanceId ? withSpBecomes(state.definitions, player.battle, c, sp) : c,
  );
  return { ...state, players: { ...state.players, [playerId]: { ...player, [zone]: cards } } };
}
