import { describe, expect, it } from "vitest";
import { starterDecks } from "@rangers-strike/cards";
import { HUMAN, type GameAction, type GameState } from "../engineApi";
import { testEngine as E } from "../testing/engine";
import { buildPendingView } from "../view/board";

// 盤面で指す手（カードを触る・ドラッグ・終了ボタン）。これがあれば選択ウィンドウがなくても操作できる。
const BOARD_MOVES = new Set(["battle", "strike", "pass_battle_entry", "move_to_battle", "end_phase", "charge_power", "rush", "bonus_draw"]);

/**
 * 自分（HUMAN）が答える番なのに、選択ウィンドウ（buildPendingView）も盤面の手もない局面か。画面では何も起きず止まって見える
 * （RK-146 の後のモーフの順番。2026-10-23）。スタートフェイズはポップアップ（askStartPhase）、出すまで終われないバトルフェイズは
 * 終了ボタン（mandatoryEntryItems）が扱う。
 */
function looksFrozen(state: GameState, human: GameAction[]): boolean {
  if (state.phase === "start" && state.activePlayer === HUMAN) return false;
  if (human.some((a) => BOARD_MOVES.has(a.type))) return false;
  if (state.phase === "battle" && human.some((a) => a.type === "initiate_command_payment" && a.kind === "battle_entry")) return false;
  return buildPendingView(E, state) === null;
}

describe("CPU 同士の対戦で、自分の番なのに画面に選ぶものが出ない局面がない", () => {
  // 2026-10-26 の見直しで全 182 デッキ・724 試合を調べた方法を、スターターの一部で毎回流す。
  const decks = Object.keys(starterDecks);
  const pairs = [0, 7, 13, 21, 29, 37].map((i) => [decks[i % decks.length]!, decks[(i * 7 + 13) % decks.length]!] as const);

  it.each(pairs)("%s 対 %s", (a, b) => {
    let state = E.createStarterGame({ player1Starter: a, player2Starter: b, seed: 1 });
    const frozen: string[] = [];
    for (let step = 0; step < 4000 && !state.winner; step++) {
      const legal = E.getLegalActions(state);
      expect(legal.length).toBeGreaterThan(0);
      const human = legal.filter((x) => (x as { playerId?: string }).playerId === HUMAN);
      if (human.length > 0 && !E.isCpuTurn(state, "player2") && looksFrozen(state, human)) {
        frozen.push(`${state.phase}: ${[...new Set(human.map((x) => x.type))].join(",")}`);
      }
      const actor = E.isCpuTurn(state, "player2") ? "player2" : E.getActionPlayerId(state);
      const action = E.pickCpuAction(state, actor, 1) ?? E.pickCpuFallbackAction(state, actor);
      const result = action ? E.applyAction(state, action) : null;
      expect(result?.ok).toBe(true);
      state = result!.ok ? result!.state : state;
    }
    expect([...new Set(frozen)]).toEqual([]);
    expect(state.winner).toBeTruthy();
  }, 60_000);
});
