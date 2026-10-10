/**
 * RS-118 ゴーゴーダンプ【プレシャスの護り手】（エラッタ後テキスト、R-ERR-RS118）。
 */
import { describe, expect, it } from "vitest";
import { legend2Catalog, type CardDefinition } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { tryStartLegend2ConditionalChoice } from "./rules/legend2/battleEffects";
import { isBattleBlocked } from "./rules/turnModifiers";
import { createTestState, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const defs: Record<string, CardDefinition> = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

describe("RS-118 precious_guardian", () => {
  it("R-ERR-RS118: 置きかえたSユニットは同じ位置から退き、重ねたカードごとラッシュエリアへ戻り、このターン再び出られない", () => {
    const dump = inst("RS-118", "dump");
    const left = inst("TST-UNIT-0", "left");
    const replaced = {
      ...inst("TST-UNIT-0", "replaced"),
      stackedCards: [inst("TST-OP", "under")],
    };
    const right = inst("TST-UNIT-0", "right");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [dump], battle: [left, replaced, right] },
    });

    const opened = tryStartLegend2ConditionalChoice(
      state,
      "player1",
      dump,
      "precious_guardian",
      "player1",
    );
    expect(opened?.pendingEffectChoice?.effectId).toBe("precious_guardian");

    const result = applyAction(opened!, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: replaced.instanceId,
    });
    if (!result.ok) throw new Error(result.error);
    const p1 = result.state.players.player1;
    expect(p1.battle.map((c) => c.instanceId)).toEqual([
      left.instanceId,
      dump.instanceId,
      right.instanceId,
    ]);
    expect(p1.battle[1]?.battleActed).toBe(true);
    const back = p1.rush.find((c) => c.instanceId === replaced.instanceId);
    expect(back?.stackedCards?.map((c) => c.instanceId)).toEqual(["TST-OP:under"]);
    expect(isBattleBlocked(p1, replaced.instanceId)).toBe(true);
  });
});
