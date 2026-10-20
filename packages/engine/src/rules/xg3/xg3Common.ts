/**
 * クロスギャザー ザ・Wインパクト（XG3）のバッチのファイルが共通で使う小さな部品（rules/rm/rm1Effects.ts の部品に足りないもの）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { effectiveCommandCategories, getDefinition, unitEffectiveCategories } from "../../core/catalog";
import { sameCardName } from "../../core/cardNames";
import { openEffectChoice } from "../pendingChoices";
import { buildEffectHoldPayment } from "../commandPayment";
import { patchPlayer } from "../playerPatches";
import { type BaseCtx, base, simpleSkip, zoneOfField } from "../rm/rm1Effects";
import { type ChoiceSkipper, HOLD_COMPLETERS } from "./xg3Registry";

export function nameIs(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  return sameCardName(getDefinition(state.definitions, cardId)?.name, name);
}

/** 見送り（読み込みの順に依らないよう、呼ばれたときに rm1Effects の simpleSkip を組み立てる）。 */
export function skipThen(after?: (state: GameState, pending: PendingEffectChoice) => GameState): ChoiceSkipper {
  return (state, playerId) => simpleSkip(after)(state, playerId);
}

/** リリース状態の自軍コマンド（category を渡せば、いまそのカテゴリを持つものだけ）。 */
export function releasedCommandIds(state: GameState, playerId: PlayerId, category?: string): string[] {
  const p = state.players[playerId];
  return p.command
    .filter((c) => !c.commandHeld && (!category || (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes(category)))
    .map((c) => c.instanceId);
}

export function holdCommands(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (ids.includes(c.instanceId) && !c.commandHeld ? { ...c, commandHeld: true } : c)) }));
}

/**
 * ids からホールドするコマンドを n 個選ぶ（コマンドの支払い effect_hold）。候補がちょうど n なら選ばずにホールドして続ける。
 * 続きは HOLD_COMPLETERS[effectId]（ホールドしたあとの state・選択・ホールドしたコマンド）。
 */
export function holdThen(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], n: number, extra: Partial<PendingEffectChoice> = {}): GameState {
  const choice: PendingEffectChoice = {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "select_commands",
    validInstanceIds: ids,
    selectCount: n,
    selectedInstanceIds: [],
    optional: false,
    commandAction: "hold",
    commandFilter: "released",
    ...extra,
  };
  if (ids.length <= n) return HOLD_COMPLETERS[effectId]!(holdCommands(state, ctx.playerId, ids), choice, ids);
  const opened = openEffectChoice(state, choice);
  const payment = buildEffectHoldPayment(opened);
  return payment ? { ...opened, pendingCommandPayment: payment } : opened;
}

/** 場のユニットのいまのカテゴリ（場にあるゾーンで判定する）。 */
export function fieldCategories(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  return unitEffectiveCategories(state, ownerId, card, zoneOfField(state, ownerId, card.instanceId) ?? "battle") as string[];
}

/** 印刷のカテゴリ・特徴。 */
export function printedCategories(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category;
  return c === undefined ? [] : Array.isArray(c) ? (c as string[]) : [c as string];
}

export function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

/** ownerId の場（バトル・ラッシュエリア）に cardId（再録を含む）のカードがあるか。 */
export function fieldHas(state: Pick<GameState, "players">, ownerId: PlayerId, match: (cardId: string) => boolean): CardInstance[] {
  const p = state.players[ownerId];
  return [...p.battle, ...p.rush].filter((c) => match(c.cardId));
}
