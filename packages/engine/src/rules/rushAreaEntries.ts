import { addTurnRestrictionModifier, hasScopedRestriction, hasTurnRuleModifier } from "../core/scopedModifiers";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { TURN_RULE_IDS } from "../types/scopedModifiers";

/**
 * 「新しくラッシュエリアに出たユニット」の判定（RS-110【ゼニボム】・RS-660【SPインカム】で共通）。
 *
 * ユーザー決定（2026-10-19）:「ゼニボムとSPインカム両方とも相手ユニットが対象。新しくラッシュエリアに出たユニットに
 * 関しては、ゼニボムとSPインカム両方とも手段は問わない。」（docs/rules/README.md §5.7）
 *
 * - 場の外（手札・山札・捨札・コマンドゾーン・パワーゾーン等）から playerId のラッシュエリアに出たユニット
 *   （ラッシュ・効果で出す・モーフの置き換え等、手段を問わない）。
 * - 前の状態でどちらかの軍のエリア（ラッシュ・バトル）にあったユニットは含まない（バトルエリアから戻ったユニットなど）。
 * - applyAction の前後（before/after）を比べて求める。
 */
export function newlyEnteredRushUnitIds(before: GameState, after: GameState, playerId: PlayerId): string[] {
  const onField = new Set<string>();
  for (const pid of ["player1", "player2"] as const) {
    for (const c of [...before.players[pid].rush, ...before.players[pid].battle]) onField.add(c.instanceId);
  }
  return after.players[playerId].rush.map((c) => c.instanceId).filter((id) => !onField.has(id));
}

/** 【ゼニボム】の対象になる「このターン新しくラッシュエリアに出た」ユニットの目印（ターン終了で消える）。 */
export const ZENIBOMB_NEW_RUSH_ENTRY_RESTRICTION = "zenibomb_new_rush_entry";

/**
 * applyAction の後処理: 【ゼニボム】が有効なターン（その軍に ZENIBOMB のターン修飾子がある）に、
 * その軍のラッシュエリアに場の外から出たユニットに目印を付ける（rules/restrictions.ts zenibombBlocksBattleEntry）。
 */
export function trackZenibombEntries(before: GameState, after: GameState): GameState {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const player: PlayerState = next.players[pid];
    if (!hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB)) continue;
    const entered = newlyEnteredRushUnitIds(before, next, pid);
    if (entered.length === 0) continue;
    let marked = player;
    for (const id of entered) marked = addTurnRestrictionModifier(marked, id, ZENIBOMB_NEW_RUSH_ENTRY_RESTRICTION);
    if (marked !== player) next = { ...next, players: { ...next.players, [pid]: marked } };
  }
  return next;
}

export function enteredRushAreaUnderZenibomb(player: PlayerState, instanceId: string): boolean {
  return hasScopedRestriction(player, instanceId, ZENIBOMB_NEW_RUSH_ENTRY_RESTRICTION);
}
