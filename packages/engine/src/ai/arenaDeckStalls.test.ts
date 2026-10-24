import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allCardsCatalog, expandDeck, type DeckDefinition } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import type { GameState } from "../types/game";
import { pickCpuAction } from "./index";

function arenaDeck(id: string) {
  const file = resolve(__dirname, "../../arena-decks", `${id}.json`);
  return expandDeck(JSON.parse(readFileSync(file, "utf8")) as DeckDefinition, allCardsCatalog);
}

/** Lv2 同士で指し進める。CPU の手をエンジンが受け付けなかったら、その手を返す。 */
function playLv2(deckId: string, seed: number): { state: GameState; rejected: string | null } {
  const deck = arenaDeck(deckId);
  let state = createStarterGame({ player1Deck: deck, player2Deck: deck, seed, firstPlayer: seed % 2 ? "player1" : "player2" });
  for (let step = 0; step < 6000 && !state.winner; step++) {
    const legal = getLegalActions(state);
    if (legal.length === 0) break;
    const action = pickCpuAction(state, legal[0]!.playerId, 2) ?? legal[0]!;
    const result = applyAction(state, action);
    if (!result.ok) return { state, rejected: JSON.stringify(action) };
    state = result.state;
  }
  return { state, rejected: null };
}

describe("atwiki のデッキで対戦が止まらない", () => {
  // 青緑ハイビート: XG2-069 NEW電王SF【カウント】（数字の宣言）の後、止めていたバトル進入を続けず、次のターンの効果の処理の
  // 後に前のターンのバトル進入が開き、相手のターンにストライクを選んでエンジンに断られていた（seed 9）。
  it("【カウント】の後にバトル進入を続ける", () => {
    const { state, rejected } = playLv2("wiki-1706", 9);
    expect(rejected).toBeNull();
    expect(state.winner).toBeDefined();
  }, 120_000);

  // モーフダイデンジン: CPU が RK-242 クライマックス刑事で、チャージしたパワーを毎ターン山札の上に戻し、パワー 0 のまま
  // 何百ターンも決着しなかった（seed 3・9）。
  it.each([3, 9])("パワーを戻すだけの常駐の起動を繰り返さない（seed %i）", (seed) => {
    const { state, rejected } = playLv2("wiki-1803", seed);
    expect(rejected).toBeNull();
    expect(state.winner).toBeDefined();
    const returned = state.log.filter((line) => line.includes("rk242_climax:imagin_police")).length;
    expect(returned).toBeLessThan(50);
  }, 120_000);
});
