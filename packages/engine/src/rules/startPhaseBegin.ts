import type { GameState, PlayerId } from "../types/game";
import { beginTurnStartSwaps } from "./keywordGapRuntime";
import { applyGegeruStartPhase } from "./residentOps";
import { applyXg6StartPhaseBegin } from "./xg6/xg6Hooks";

/**
 * スタートフェイズに入った直後（3行程より前）に処理する効果。
 *
 * ルール: R-START-06, R-TIME-06 — 「フェイズ開始時」の効果はフェイズ中の行動を一切行う前に
 * 発動・解決する。以前は `release_start_commands` の中でだけ呼ばれていたため、
 * ホールド中のコマンドが無いターンは発動しなかった（E17）。
 *
 * - XG4-049〜051 「※自軍ターン開始時、…置き換えてもよい」（任意。選択を開く）
 * - RK-081 ゲゲル「自軍スタートフェイズに重ねたカードが10枚以上あれば…」（判定のみ。
 *   「開始時」ではないが、3行程と好きな順に行えるため最初に判定してよい — R-START-06）
 */
export function applyStartPhaseBeginEffects(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "start" || state.activePlayer !== playerId) return state;
  let next = applyGegeruStartPhase(state, playerId);
  next = beginTurnStartSwaps(next, playerId);
  // XG6-042【ゼロのスタート】（このスタートフェイズ中、山札からドローできない。rules/xg6/xg6bEffects.ts）。
  next = applyXg6StartPhaseBegin(next, playerId);
  return next;
}
