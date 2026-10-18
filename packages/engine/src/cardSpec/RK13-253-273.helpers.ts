/**
 * cardSpec RK-253〜RK-273（ザ・マスクドライダーEXP vol.4 親子の絆〜仮面ライダークウガRP）用ヘルパー。
 * RK12-232-252.helpers.ts（RK1〜RK11 のヘルパーを含む）をそのまま再エクスポートし、モーフ・相手の手番の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, deckCards, inst, legal, mount, releasedCat, rideOff, rushFromHand, st } from "./RK12-232-252.helpers";

export * from "./RK12-232-252.helpers";

/** 敵軍（player2）のターン（既定はバトルフェイズ）の盤面。 */
export function enemyBoard(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  phase: GameState["phase"] = "battle",
): GameState {
  return st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/**
 * 敵軍（player2）のラッシュフェイズに、player2 が手札の rusherId（必要パワー0・WB の S ユニットを想定）を通常の手段でラッシュする。
 * player1 のモーフの選択（morph_replacement）が開いたところで止める。
 */
export function enemyRushes(
  p1: Partial<GameState["players"]["player1"]>,
  rusherId: string,
  extra: CardDefinition[] = [],
  p2: Partial<GameState["players"]["player2"]> = {},
): GameState {
  const [cid, suf] = rusherId.split(":") as [string, string];
  const s = enemyBoard(p1, { hand: [inst(cid, suf)], command: releasedCat("WB", 1), ...p2 }, extra, "rush");
  const r = rushFromHand(s, "player2", rusherId);
  if (!r.ok) throw new Error(`enemyRushes: ${r.error}`);
  return r.state;
}

/** モーフの置き換え先の候補（morph_replacement の選択が開いていなければ空）。 */
export function morphCandidates(s: GameState): string[] {
  return s.pendingEffectChoice?.effectId === "morph_replacement" ? [...s.pendingEffectChoice.validInstanceIds].sort() : [];
}

/** 敵軍（player2）が自軍バトルフェイズに rider を vehicle にライドさせて出し、ライドオフする（RC の選択は残す）。 */
export function enemyRcRideOff(s: GameState, rider: string, vehicle: string): GameState {
  return rideOff(mount(s, rider, vehicle, "player2"), true, "player2");
}

/** 合法手の「アタック」の defender（attacker の playerId 側から見た候補）。 */
export function canAttack(s: GameState, attacker: string, defender: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "battle" && a.playerId === playerId && a.attackerInstanceId === attacker && a.defenderInstanceId === defender);
}

/** 重ねたカード付きのユニット（ユニットの下に重ねたカード）。 */
export function withStacked(card: CardInstance, stacked: CardInstance[]): CardInstance {
  return { ...card, stackedCards: stacked };
}

/** 選択の持ち主。 */
export function choicePlayer(s: GameState): PlayerId | undefined {
  return s.pendingEffectChoice?.playerId;
}

/** 選択を player が解決する（resolve_effect_choice）。 */
export function pickAs(s: GameState, playerId: PlayerId, instanceId: string): GameState {
  return act(s, { type: "resolve_effect_choice", playerId, instanceId });
}
