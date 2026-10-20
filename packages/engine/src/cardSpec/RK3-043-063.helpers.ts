/**
 * cardSpec RK-043〜RK-063（ザ・マスクドライダーEXP vol.1 ライドシューター〜仮面ライダー龍騎）用ヘルパー。
 * RK2-022-042.helpers.ts（RK1 のヘルパーを含む）をそのまま再エクスポートし、ラッシュ・NC 用の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { fillerEntries } from "../rulesSpec/01-helpers";
import { act, cardIn, inst, legal, tryAct } from "./RK2-022-042.helpers";

export * from "./RK2-022-042.helpers";

/** 「※このカードはデッキに好きな枚数入れてもよい。」— 10枚入れたデッキが構築ルールを満たすか。 */
export function deckWithTen(cardId: string, name: string): boolean {
  return validateDeckEntries([{ cardId, count: 10 }, ...fillerEntries(30, [name])]).ok;
}

/** 場の起動効果（activate_field_unit_ability。RK-043【突入】等）が合法手にあるか。 */
export function canActivateField(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "activate_field_unit_ability" && a.playerId === playerId && a.unitInstanceId === instanceId);
}

/** 場の起動効果を使う。 */
export function activateField(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "activate_field_unit_ability", playerId, unitInstanceId: instanceId });
}

/**
 * 手札のユニットのラッシュを宣言する（コマンドの支払いは先頭の有効なリリース状態コマンド）。
 * 相手の「ラッシュされたとき」の窓・選択はパスせずに残す。ラッシュできなければ ok=false。
 */
export function declareRush(s: GameState, playerId: PlayerId, instanceId: string): { ok: boolean; state: GameState; error?: string } {
  const direct = legal(s).find((a) => a.type === "rush" && a.playerId === playerId && a.instanceId === instanceId);
  let r = direct
    ? tryAct(s, direct)
    : tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId: instanceId });
  for (let i = 0; i < 6 && r.ok && r.state.pendingCommandPayment?.playerId === playerId; i += 1) {
    const p = r.state.pendingCommandPayment;
    r = tryAct(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
  }
  return r;
}

/** 手札からラッシュできる合法手があるか（コマンドのホールドを伴うもの・伴わないもの）。 */
export function rushOffered(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "rush" && a.instanceId === instanceId) ||
        (a.type === "initiate_command_payment" && a.kind === "category_use" && a.sourceInstanceId === instanceId) ||
        (a.type === "begin_zord_setup" && a.zordInstanceId === instanceId)),
  );
}

/** コマンドのホールドなし（rush アクション）でラッシュできるか。 */
export function rushWithoutHoldOffered(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "rush" && a.playerId === playerId && a.instanceId === instanceId);
}

/** ホールド状態のコマンドの数。 */
export function heldCount(s: GameState, playerId: PlayerId = "player1"): number {
  return s.players[playerId].command.filter((c) => c.commandHeld).length;
}

/** ライドしている先（mountedOnInstanceId）。 */
export function mountedOn(s: GameState, playerId: PlayerId, instanceId: string): string | undefined {
  return cardIn(s, playerId, instanceId)?.mountedOnInstanceId;
}

/** n 枚の同じカード。 */
export function copies(cardId: string, n: number, prefix: string): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst(cardId, `${prefix}${i}`));
}

/** 保留中の効果選択のプレイヤーと出典カード。 */
export function expectChoiceFrom(s: GameState, playerId: PlayerId, sourceCardId: string): void {
  expect(s.pendingEffectChoice?.playerId).toBe(playerId);
  expect(s.pendingEffectChoice?.sourceCardId).toBe(sourceCardId);
}

