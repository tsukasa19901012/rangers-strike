/**
 * cardSpec RK-232〜RK-252（ザ・マスクドライダーEXP vol.3 火焔大将〜vol.4 変身音叉 音角）用ヘルパー。
 * RK11-211-231.helpers.ts（RK1〜RK10 のヘルパーを含む）をそのまま再エクスポートし、スタートフェイズ・常駐・相手の手番の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { act, legal } from "./RK11-211-231.helpers";

export * from "./RK11-211-231.helpers";

/**
 * 敵軍ターンの終わりから who のスタートフェイズを始め（呼ぶ側が endTurn で始める）、コマンドのリリース・バトルエリアのユニットを戻す・ドローを進める。
 * sourceCardId の選択が開いたら、そこで止める。チャージフェイズになったら止める。
 */
export function toStartEnd(s: GameState, sourceCardId: string, who: PlayerId = "player1"): GameState {
  let n = s;
  for (let i = 0; i < 20; i++) {
    if (n.pendingEffectChoice?.sourceCardId === sourceCardId) return n;
    if (n.activePlayer === who && n.phase === "charge" && !n.pendingEffectChoice) return n;
    const acts = legal(n);
    const a = ["release_start_commands", "return_all_battle_to_rush", "draw", "skip_bonus_draw", "end_phase"]
      .map((t) => acts.find((x) => x.type === t && x.playerId === who && !("instanceId" in x && x.instanceId)))
      .find(Boolean);
    if (!a) break;
    n = act(n, a);
  }
  return n;
}

/** 開いている選択の effectId。 */
export function choiceEffect(s: GameState): string | undefined {
  return s.pendingEffectChoice?.effectId;
}
