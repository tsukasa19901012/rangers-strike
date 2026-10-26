import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allCardsCatalog, expandDeck, type DeckDefinition } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import type { GameState } from "../types/game";
import { isCpuTurn, pickCpuAction, pickCpuFallbackAction } from "./index";

/** arena-decks/<id>.json があればそのデッキ、なければスターター。 */
function deckSide(id: string) {
  try {
    const deck = JSON.parse(readFileSync(resolve(__dirname, "../../arena-decks", `${id}.json`), "utf8")) as DeckDefinition;
    return { starter: "abarenoh", deck: expandDeck(deck, allCardsCatalog) };
  } catch {
    return { starter: id, deck: undefined };
  }
}

/**
 * Lv1 同士で指し進め、局面ごとに合法手（getLegalActions）を全部 applyAction に通す。合法手に出るのにエンジンが断る手が
 * あると、画面ではボタンを押してもエラーになり、CPU は指せずに対局が止まる（RS-255 巨大化爆弾の窓）。
 * 断られた手を「手の種類|フェイズ|エラー」で返す。
 */
function playChecked(a: string, b: string, seed: number): { state: GameState; rejected: string[] } {
  const p1 = deckSide(a);
  const p2 = deckSide(b);
  let state = createStarterGame({ player1Starter: p1.starter, player2Starter: p2.starter, player1Deck: p1.deck, player2Deck: p2.deck, seed } as Parameters<typeof createStarterGame>[0]);
  const rejected = new Set<string>();
  for (let step = 0; step < 4000 && !state.winner; step++) {
    const legal = getLegalActions(state);
    if (legal.length === 0) {
      rejected.add(`no_legal_actions|${state.phase}`);
      break;
    }
    for (const action of legal) {
      const r = applyAction(state, action);
      if (!r.ok) rejected.add(`${action.type}|${state.phase}|${JSON.stringify(r.error)}`);
    }
    const actor = isCpuTurn(state, "player2") ? "player2" : getActionPlayerId(state);
    let action = pickCpuAction(state, actor, 1) ?? pickCpuFallbackAction(state, actor);
    let result = action ? applyAction(state, action) : null;
    if (!result?.ok) {
      action = pickCpuFallbackAction(state, actor);
      result = action ? applyAction(state, action) : null;
    }
    if (!result?.ok) {
      rejected.add(`cpu_stuck|${state.phase}`);
      break;
    }
    state = result.state;
  }
  return { state, rejected: [...rejected] };
}

// 2026-10-26 の見直しで、全 182 デッキの CPU 同士の対戦で見つかった局面（デッキの組・seed はそのときの再現）。
describe("合法手に出る手は、エンジンがすべて受け付ける", () => {
  it.each([
    // RS-255 巨大化爆弾の窓が、相手のバトル進入中（XG2-037【スーパーシンケンマル】で RS-494 を撃破）に開き、見送りも使用も断られて止まった。
    ["wiki-1728", "seven-ninja-c", 2],
    ["wiki-1727", "w-impact-c", 4],
    // XG4-037 牛折神（ラッシュするとき可能ならバトルエリアに置く）: ラッシュフェイズのバトル進入にアタックの手が出ていた。
    ["blog-jimdo-shinken", "blog-tocage-1241455357", 4],
    ["wiki-1803", "blog-jimdo-shinken", 2],
    // XG1-097【ブルームキャノン】: 1体も選んでいないのに確定の手が出ていた。
    ["w-impact-c", "blog-rabbit-14610577", 4],
    // XG6-056（※リードET）でホールドして RK-012（カウンター）を使う支払いが、支払いの候補に出るのに断られていた。
    ["wiki-2030", "wiki-2365", 4],
    // RS-049【ピットインダイブ】: 敵軍ラッシュエリアの S のビークル（RK-043 ライドシューター）も出す候補に出て、選ぶと断られていた。
    ["roaring-wings", "rider-exp-1-b", 1],
  ] as const)("%s 対 %s（seed %i）", (a, b, seed) => {
    const { state, rejected } = playChecked(a, b, seed);
    expect(rejected).toEqual([]);
    expect(state.winner).toBeDefined();
  }, 120_000);
});
