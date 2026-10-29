import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import { pickCpuAction, setCpuLevelOverrides } from "./index";

describe("同じカードの起動を繰り返さない", () => {
  // XG5-066 仮面ライダーベルデ【コピーベント】で、場のベルデとパワーゾーンのもう 1 枚のベルデを入れ替え続け、
  // 対戦が終わらなかった（ticket-breaker-b 同士、seed 11526、player2 はターン単位の読みなしの Lv5。2026-10-23 の対戦台）。
  it("ベルデの【コピーベント】を 1 フェイズに何度も使わず、対戦が終わる", () => {
    let state = createStarterGame({ player1Starter: "ticket-breaker-b", player2Starter: "ticket-breaker-b", seed: 11526, firstPlayer: "player1" });
    let maxPerPhase = 0;
    let inPhase = 0;
    // フェイズが変わったら数え直す（フェイズが変わった手でも、ログの最後の行が「phase:」で始まるとは限らない）。
    let phaseKey = "";
    try {
      for (let step = 0; step < 3000 && !state.winner; step++) {
        const legal = getLegalActions(state);
        if (legal.length === 0) break;
        const actor = legal[0]!.playerId;
        setCpuLevelOverrides(actor === "player2" ? { 5: { turnPlanSteps: 0 } } : {});
        const action = pickCpuAction(state, actor, 5) ?? legal[0]!;
        const key = `${state.turn}:${state.phase}`;
        if (key !== phaseKey) {
          phaseKey = key;
          inPhase = 0;
        }
        const result = applyAction(state, action);
        if (!result.ok) break;
        state = result.state;
        const last = state.log.at(-1) ?? "";
        if (last.includes("|activate_field_unit_ability|XG5-066|")) maxPerPhase = Math.max(maxPerPhase, ++inPhase);
        if (maxPerPhase > 1) break;
      }
    } finally {
      setCpuLevelOverrides({});
    }
    expect(maxPerPhase).toBeLessThanOrEqual(1);
    expect(state.winner).toBeDefined();
  }, 120_000);
});
