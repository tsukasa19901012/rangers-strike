// 払えないカテゴリ使用（RK-214 仮面ライダーランス等）の支払いを、簡易判断の CPU が始めては取り消すのを
// 繰り返し、ゲームが進まなくなっていた（best-partner-c 同士の Lv1、30 局中 6 局が 3000 手で止まった）。
// Lv5 の先読みの試し打ちもこの判断で回るので、1 手に 5〜12 秒かかっていた。
import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import { pickCpuAction } from "./index";

describe("支払いの取り消しの繰り返し", () => {
  it.each([8, 21])("best-partner-c 同士の Lv1（seed %i）は取り消しを繰り返さず決着する", (seed) => {
    let state = createStarterGame({ player1Starter: "best-partner-c", player2Starter: "best-partner-c", seed, firstPlayer: seed % 2 ? "player1" : "player2" });
    let cancels = 0;
    for (let step = 0; step < 3000 && !state.winner; step++) {
      const legal = getLegalActions(state);
      if (legal.length === 0) break;
      const action = pickCpuAction(state, legal[0]!.playerId, 1) ?? legal[0]!;
      if (action.type === "cancel_command_payment") cancels++;
      const result = applyAction(state, action);
      if (!result.ok) break;
      state = result.state;
    }
    expect(cancels).toBeLessThan(5);
    expect(state.winner).not.toBeNull();
  }, 60_000);
});
