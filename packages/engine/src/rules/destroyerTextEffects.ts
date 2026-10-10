/**
 * 本文の文言で処理する「これが（S/M/L）ユニットを撃破したとき、相手に N 点ダメージを与える」
 * （R-TIME-01 段階 1「撃破したとき」。例: RS-346 バトルフィーバーロボ【雷光剣唐竹割り】）。
 *
 * DSL スタブはこの条件を落としてアタックしたとき（on_attack）にダメージを与えていたため、
 * dsl/effectTextNormalization がその処理を取り除き、撃破の段階でこちらが処理する。
 * CN を持つカード（NC の欄の効果）は NC の成立が必要なので対象外（各カードの実装に任せる）。
 * 自軍ターンに限る文言（「自軍ターン中、」）があれば自軍ターンだけ。アタックしたとき以外（アタックされて勝ったとき）も対象。
 */
import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { opponent } from "../core/helpers";
import { applyDamageToPlayer } from "./damagePayment";
import { buildLogEntry } from "../log/formatLog";

const DESTROYER_DAMAGE_RE =
  /(自軍ターン中、)?これが(バトルで)?(?:敵軍)?([SML])?ユニットを(?:バトルで)?撃破したとき、相手に(\d+)点ダメージを与える/;

export function resolveDestroyerDamageByText(
  state: GameState,
  winnerOwner: PlayerId,
  winnerCardId: string,
  destroyedCardId: string,
): { state: GameState; logs: string[] } {
  const def = getDefinition(state.definitions, winnerCardId);
  if (!def?.text || def.comboNumber !== undefined) return { state, logs: [] };
  const m = DESTROYER_DAMAGE_RE.exec(def.text.normalize("NFKC"));
  if (!m) return { state, logs: [] };
  if (m[1] && state.activePlayer !== winnerOwner) return { state, logs: [] };
  const size = m[3];
  if (size && getDefinition(state.definitions, destroyedCardId)?.size !== size) return { state, logs: [] };
  const amount = Number(m[4]);
  const next = applyDamageToPlayer(state, opponent(winnerOwner), amount, {
    kind: "none",
    activePlayer: state.activePlayer,
  });
  return {
    state: next,
    logs: [buildLogEntry(winnerOwner, "named_effect", winnerCardId, state.definitions, `destroyer_damage_${amount}`)],
  };
}
