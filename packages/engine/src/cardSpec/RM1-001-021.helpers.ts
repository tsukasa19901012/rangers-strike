/**
 * cardSpec RM-001〜RM-021（スペシャルメタルエディション 蒸着〜ギラン円盤）用ヘルパー。
 * RK16-316-335.helpers.ts（RK1〜RK15 のヘルパーを含む）をそのまま再エクスポートし、オペレーションの盤面・カウンター・常駐の起動を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, attack, deckCards, legal, st } from "./RK16-316-335.helpers";

export * from "./RK16-316-335.helpers";

/** 自軍（player1）ラッシュフェイズの盤面。 */
export function rushBoard(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 手札のカウンターを使う（カテゴリの支払いは先頭の有効なコマンド）。 */
export function useCounter(s: GameState, id: string, playerId: PlayerId = "player1"): GameState {
  const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.playerId === playerId && "sourceInstanceId" in a && a.sourceInstanceId === id);
  let next = pay ? act(s, pay) : s;
  const play = legal(next).find((a) => a.type === "play_counter" && a.playerId === playerId && a.instanceId === id);
  if (play) next = act(next, play);
  return next;
}

/** 手札のカウンターを使える合法手があるか。 */
export function canCounter(s: GameState, id: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "initiate_command_payment" && "sourceInstanceId" in a && a.sourceInstanceId === id) || (a.type === "play_counter" && a.instanceId === id)),
  );
}

/** バトルの反応ウィンドウをパスし、撃破による離場の反応ウィンドウ（pendingLeave）まで進める。 */
export function toLeave(s: GameState): GameState {
  let n = s;
  for (let i = 0; i < 5 && !n.pendingLeave; i++) {
    const p = legal(n).find((a) => a.type === "pass_battle_reaction");
    if (!p) break;
    n = act(n, p);
  }
  return n;
}

/**
 * 敵軍（player2）ターン、自軍（player1）の victim が player2 の BP13000 のユニット（TST-UNIT-7）にアタックされて撃破され、
 * 離場の反応ウィンドウが開いたところ。
 */
export function destroyedInEnemyBattle(
  victim: CardInstance,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1, battle: [victim, ...(p1.battle ?? [])] },
      player2: { deck: deckCards(5, "e"), ...p2, battle: [{ instanceId: "TST-UNIT-7:atk", cardId: "TST-UNIT-7" }, ...(p2.battle ?? [])] },
    },
    extra,
  );
  return toLeave(attack(s, "TST-UNIT-7:atk", victim.instanceId, "player2"));
}

/** 常駐置き場のカード。 */
export function residentOp(cardId: string, suffix: string): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId };
}

/** ユニットの下に重なっているカードの instanceId。 */
export function stackedUnder(s: GameState, playerId: PlayerId, unitInstanceId: string): string[] {
  const p = s.players[playerId];
  const c = [...p.rush, ...p.battle].find((x) => x.instanceId === unitInstanceId);
  return (c?.stackedCards ?? []).map((x) => x.instanceId);
}

/** NC が成立したか（activatedNcEffects・選択・ログ）。 */
export function ncFired(s: GameState, playerId: PlayerId, instanceId: string, cardId: string): boolean {
  const c = s.players[playerId].battle.find((x) => x.instanceId === instanceId);
  return (c?.activatedNcEffects ?? []).length > 0 || s.pendingEffectChoice?.sourceCardId === cardId || s.log.some((l) => l.includes("number_combo") && l.includes(cardId));
}
