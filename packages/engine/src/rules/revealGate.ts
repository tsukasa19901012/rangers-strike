/**
 * 「山札の上から…をオモテにしてもよい（見てもよい）」「次の効果を発動できる⇒山札の上から…」の、発動するかの確認。
 *
 * 山札のカードを選択の候補にする選択（「その中から1枚選び」等）をそのまま開くと、発動するかを決める前に候補の山札のカードが
 * 見えてしまう（XG7-042【ライダー大戦の世界】ほか）。開くときに revealGate を付けると、その間は「発動する」（confirm_effect_choice）と
 * 「発動しない」（skip_effect_choice）だけを選べる。発動すると確認を外し、同じ選択がそのまま続く（もう見送れない）。
 * 見えるカードは client-core の viewedCardIds も確認の間は出さない。
 *
 * 「次の効果を発動できる⇒自軍山札を見て…その後、山札をシャッフルする」のように、発動したら候補が無くても続きの処理（シャッフル等）が
 * あるものは、候補が空の選択に確認を付ける。発動すると、確認を外した選択を見送ったのと同じ処理（＝発動して何も選ばなかった）になる。
 * そのため見送りの処理（CHOICE_SKIPPERS 等）は、確認が付いたまま（revealGate が true）なら発動しなかった、外れていれば発動して選ばなかった、
 * として分ける。
 */
import type { GameAction } from "../types/actions";
import type { GameState, PendingEffectChoice } from "../types/game";

/** 発動するかを先に聞く選択にする。keepOptional なら、発動した後も見送れる（「…選び、…してもよい」）。 */
export function gateReveal(choice: PendingEffectChoice, keepOptional = false): PendingEffectChoice {
  return { ...choice, revealGate: true, ...(keepOptional ? { revealKeepsOptional: true } : {}) };
}

/** 確認の間の合法手（発動しない・発動する）。確認の選択が答える番でなければ null（getLegalActions の後で差し替える）。 */
export function revealGateActions(state: GameState, actions: GameAction[]): GameAction[] | null {
  const pending = state.pendingEffectChoice;
  if (!pending?.revealGate) return null;
  const playerId = pending.playerId;
  if (!actions.some((a) => a.type === "skip_effect_choice" && a.playerId === playerId)) return null;
  return [
    { type: "skip_effect_choice", playerId },
    { type: "confirm_effect_choice", playerId },
  ];
}

/** 確認の間は、発動する・発動しない以外の答え（候補を選ぶ等）を受け付けない。 */
export function blockedByRevealGate(state: GameState, action: GameAction): boolean {
  const pending = state.pendingEffectChoice;
  if (!pending?.revealGate || !("playerId" in action) || action.playerId !== pending.playerId) return false;
  if (action.type === "skip_effect_choice" || action.type === "confirm_effect_choice") return false;
  return /^(resolve|confirm)_/.test(action.type);
}

/**
 * 発動する: 確認を外して、同じ選択を続ける。確認の選択でなければ null。
 * 候補が無ければ empty を true にして返す（呼び出し側が、確認を外した選択を見送ったのと同じ処理をする）。
 */
export function openRevealGate(state: GameState): { state: GameState; empty: boolean } | null {
  const pending = state.pendingEffectChoice;
  if (!pending?.revealGate) return null;
  const { revealGate: _g, revealKeepsOptional: keep, ...rest } = pending;
  const empty = pending.validInstanceIds.length === 0;
  return { state: { ...state, pendingEffectChoice: { ...rest, optional: empty || keep === true ? true : false } }, empty };
}
