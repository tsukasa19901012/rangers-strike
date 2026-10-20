/**
 * cardSpec XP-017〜XP-032（クロスギャザー プロモーションカード 仮面ライダーディケイド激情態〜ゴーカイオー）用ヘルパー。
 * XP-001-016.helpers.ts（RS・RK・RM・BK のヘルパーの連なりを含む）をそのまま再エクスポートし、盤面の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { deckCards, inst, legal, raw, st } from "./XP-001-016.helpers";

export * from "./XP-001-016.helpers";

/** 同じカードを n 枚（instanceId は `${cardId}:${prefix}${i}`）。faceUp を true にするとオモテ向き（faceDown: false）を明示する。 */
export function many(cardId: string, n: number, prefix: string, faceUp = false): CardInstance[] {
  return Array.from({ length: n }, (_, i) => (faceUp ? { ...inst(cardId, `${prefix}${i}`), faceDown: false } : inst(cardId, `${prefix}${i}`)));
}

/** 自軍（player1）ラッシュフェイズの盤面（山札は両軍5枚を既定にする）。 */
export function rushPhase(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 敵軍（player2）ターンの盤面（既定はバトルフェイズ）。 */
export function enemyTurnBoard(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  phase: GameState["phase"] = "battle",
): GameState {
  return st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 場の起動型の能力（activate_field_unit_ability）か、常駐の起動（activate_resident_operation）が unit について合法手にあるか。 */
export function canActivateUnit(s: GameState, unitInstanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "activate_field_unit_ability" && a.unitInstanceId === unitInstanceId) ||
        (a.type === "activate_resident_operation" && a.operationInstanceId === unitInstanceId)),
  );
}

/**
 * source（手札のカード）の使用・ラッシュのコマンド支払いを始め、ホールドに選べるもの（pendingCommandPayment.validInstanceIds）を返す。
 * 支払いを始められなければ null（rulesSpec/07-call-read の payableFor と同じ。支払いは自動で済ませない）。
 */
export function payableFor(s: GameState, sourceInstanceId: string, playerId: PlayerId = "player1"): string[] | null {
  const start = legal(s).find((a) => a.type === "initiate_command_payment" && a.playerId === playerId && a.sourceInstanceId === sourceInstanceId);
  if (!start) return null;
  return [...(raw(s, start).pendingCommandPayment?.validInstanceIds ?? [])].sort();
}
