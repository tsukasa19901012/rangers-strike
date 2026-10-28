/**
 * 「山札の上から…をオモテにしてもよい」「次の効果を発動できる⇒山札の上から…」の発動の確認（rules/revealGate.ts）を答えるヘルパー。
 */
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import type { GameState } from "../types/game";

/** 発動の確認で「発動する」を選ぶ（確認でなければ何もしない）。 */
export function activate(s: GameState): GameState {
  const pending = s.pendingEffectChoice;
  if (!pending?.revealGate) return s;
  const r = applyAction(s, { type: "confirm_effect_choice", playerId: pending.playerId });
  if (!r.ok) throw new Error(`confirm_effect_choice failed: ${r.error ?? "unknown"}`);
  return r.state;
}

/** 発動の確認の間で、選べるのが「発動する」「発動しない」だけで、山札のカードを選べないか。 */
export function onlyActivateOrSkip(s: GameState): boolean {
  if (!s.pendingEffectChoice?.revealGate) return false;
  const types = getLegalActions(s).map((a) => a.type).sort();
  return types.length === 2 && types[0] === "confirm_effect_choice" && types[1] === "skip_effect_choice";
}
