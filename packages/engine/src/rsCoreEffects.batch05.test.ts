import { describe, expect, it } from "vitest";
import { applyAction, effectiveBp } from "./index";
import { passiveNamedFieldBpBonus } from "./rules/fieldAuras";
import { finalizeLeaveReaction } from "./rules/operationCounters";
import { applyPromotedNcEffect } from "./rules/promotedNcEffects";
import { battleAttackerBpBonus } from "./rules/namedUnitEffects";
import { resolveTurnEndingEffectsImpl } from "./rules/turnEndingEffects";
import { legend3EffectiveSp } from "./rules/legend3/fieldEffects";
import { resolveNoteOtherOnRushEffects } from "./rules/noteOtherRushEffects";
import { resolveRushTriggeredEffects } from "./rules/rushEffects";
import {
  battleFillers,
  battleUnit,
  legendDefinitions,
  moveToBattle,
} from "./testing/battleEntry";
import { createTestState, inst } from "./testing/fixtures";

const defs = legendDefinitions;

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(result.error ?? "unknown");
  return result.state;
}

/** RS-179..350: 172 cards. */
const RS_CORE_BATCH05 = Array.from({ length: 172 }, (_, i) =>
  `RS-${String(179 + i).padStart(3, "0")}`,
);

describe("RS core batch05 catalog coverage (RS-179..350)", () => {
  it.each(RS_CORE_BATCH05)("catalog includes %s", (cardId) => {
    expect(defs[cardId]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// NC SP1 effects (DSL grant_keyword: SP1)
// ---------------------------------------------------------------------------

describe("RS-191 ダイナブラック NC SP1", () => {
  it("grants SP1 when placed at battle position 5 (comboNumber 5)", () => {
    const unit = inst("RS-191", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(4),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-199 アバレブラック NC SP1", () => {
  it("grants SP1 when placed at battle position 4 (comboNumber 4)", () => {
    const unit = inst("RS-199", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(3),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-204 デカグリーン NC SP1", () => {
  it("grants SP1 when placed at battle position 5 (comboNumber 5)", () => {
    const unit = inst("RS-204", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(4),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-205 デカピンク NC SP1", () => {
  it("grants SP1 when placed at battle position 3 (comboNumber 3)", () => {
    const unit = inst("RS-205", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(2),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-233 アバレブラックAM NC SP1", () => {
  it("grants SP1 when placed at battle position 2 (comboNumber 2)", () => {
    const unit = inst("RS-233", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(1),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-234 アバレイエローAM NC SP1", () => {
  it("grants SP1 when placed at battle position 1 (comboNumber 1)", () => {
    const unit = inst("RS-234", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: [],
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-278 ブラックバイソン bison_rod (promoted NC)", () => {
  it("grants SP1 when placed at battle position 5 (comboNumber 5)", () => {
    const bison = inst("RS-278", "bison");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [bison],
        battle: battleFillers(4),
      },
    });
    const next = moveToBattle(state, bison.instanceId);
    expect(battleUnit(next, "player1", bison.instanceId)?.spModifier).toBe(1);
  });

  it("opens destroy choice for enemy unit with powerCost '-' suffix", () => {
    const bison = inst("RS-278", "bison");
    // RS-231 has powerCost "7-" — a valid bison_rod destroy target
    const target = inst("RS-231", "target");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [bison],
        battle: battleFillers(4),
      },
      player2: {
        battle: [target],
      },
    });
    const next = moveToBattle(state, bison.instanceId);
    expect(next.pendingEffectChoice?.effectId).toBe("bison_rod");
    expect(next.pendingEffectChoice?.validInstanceIds).toContain(target.instanceId);
  });
});

describe("RS-306 カクレンジャーロボ NC SP1", () => {
  it("grants SP1 when placed at battle position 3 (comboNumber 3)", () => {
    const unit = inst("RS-306", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(2),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-340 ゲキレッド NC SP1", () => {
  it("grants SP1 when placed at battle position 2 (comboNumber 2)", () => {
    const unit = inst("RS-340", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(1),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

describe("RS-341 ゲキブルー NC SP1", () => {
  it("grants SP1 when placed at battle position 2 (comboNumber 2)", () => {
    const unit = inst("RS-341", "u");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        battle: battleFillers(1),
      },
    });
    const next = moveToBattle(state, unit.instanceId);
    expect(battleUnit(next, "player1", unit.instanceId)?.spModifier).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RS-188 アチャとコチャ — on_rush power discard
// ---------------------------------------------------------------------------

describe("RS-188 アチャとコチャ on_rush power discard", () => {
  it("opens power-discard choice when own power count exceeds 6", () => {
    const acha = inst("RS-188", "acha");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        rush: [acha],
        // 7 face-up power cards → toDiscard = min(7, 7-6) = 1
        power: Array.from({ length: 7 }, (_, i) => inst("TST-P", `pw${i}`)),
      },
    });
    const result = resolveNoteOtherOnRushEffects(
      state,
      "player1",
      acha.instanceId,
      "player1",
      "RS-188",
    );
    expect(result.state.pendingEffectChoice?.effectId).toBe("acha_kocha_power_discard");
  });

  it("does not open choice when own power count is exactly 6", () => {
    const acha = inst("RS-188", "acha");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        rush: [acha],
        power: Array.from({ length: 6 }, (_, i) => inst("TST-P", `pw${i}`)),
      },
    });
    const result = resolveNoteOtherOnRushEffects(
      state,
      "player1",
      acha.instanceId,
      "player1",
      "RS-188",
    );
    expect(result.state.pendingEffectChoice).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RS-216 暴走皇帝エグゾス — turn-end deck return
// ---------------------------------------------------------------------------

describe("RS-216 暴走皇帝エグゾス turn-end return to deck", () => {
  it("returns to deck on turn end when no own 車両 unit is present", () => {
    const egzosu = inst("RS-216", "egzosu");
    const state = createTestState({
      definitions: defs,
      activePlayer: "player1",
      player1: {
        battle: [egzosu],
        deck: [inst("TST-OP", "deck1")],
      },
    });
    const result = resolveTurnEndingEffectsImpl(state, "player1");
    expect(result.state.players.player1.battle).toHaveLength(0);
    expect(
      result.state.players.player1.deck.some(
        (c) => c.instanceId === egzosu.instanceId,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RS-281 ブラックコンドル — conditional SP1 + turn-end hand return
// ---------------------------------------------------------------------------

describe("RS-281 ブラックコンドル conditional SP1", () => {
  it("has SP1 when own rush contains 2+ female units", () => {
    const condor = inst("RS-281", "condor");
    // RS-201 and RS-202 both have features: ["女"]
    const female1 = inst("RS-201", "f1");
    const female2 = inst("RS-202", "f2");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [condor],
        rush: [female1, female2],
      },
    });
    const sp = legend3EffectiveSp(state, "player1", condor);
    expect(sp).toBeGreaterThanOrEqual(1);
  });

  it("has no conditional SP1 when own rush has fewer than 2 female units", () => {
    const condor = inst("RS-281", "condor");
    const female1 = inst("RS-201", "f1");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [condor],
        rush: [female1],
      },
    });
    const sp = legend3EffectiveSp(state, "player1", condor);
    expect(sp).toBe(0);
  });

  it("returns to hand on turn end when no other female unit is present", () => {
    const condor = inst("RS-281", "condor");
    const state = createTestState({
      definitions: defs,
      activePlayer: "player1",
      player1: {
        battle: [condor],
      },
    });
    const result = resolveTurnEndingEffectsImpl(state, "player1");
    expect(result.state.players.player1.battle).toHaveLength(0);
    expect(
      result.state.players.player1.hand.some(
        (c) => c.instanceId === condor.instanceId,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RS-305 ガオパンダ — on_rush holds all enemy commands
// ---------------------------------------------------------------------------

describe("RS-305 ガオパンダ バンブーハリケーン on_rush", () => {
  it("holds all enemy commands when rushed", () => {
    const panda = inst("RS-305", "panda");
    const cmd1 = inst("TST-OP", "c1");
    const cmd2 = inst("TST-OP-ET", "c2");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [panda] },
      player2: { command: [cmd1, cmd2] },
    });
    const result = resolveRushTriggeredEffects(state, "player1", panda.instanceId);
    expect(result.state.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("no-ops when enemy has no commands", () => {
    const panda = inst("RS-305", "panda");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [panda] },
      player2: { command: [] },
    });
    const result = resolveRushTriggeredEffects(state, "player1", panda.instanceId);
    expect(result.state.players.player2.command).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Known gap fixes: RS-231/286/333-337
// ---------------------------------------------------------------------------

describe("RS-286 守護獣の神 field aura", () => {
  it("grants +2000 BP to other WB units in battle", () => {
    const god = inst("RS-286", "god");
    const ally = inst("RS-035", "ally");
    const state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: { battle: [god, ally] },
    });
    expect(passiveNamedFieldBpBonus(state, "player1", ally, "general")).toBe(2000);
  });
});

describe("RS-231 destroy recruit", () => {
  it("reanimates アバレブルー from discard on destroy", () => {
    const am = inst("RS-231", "am");
    const base = inst("RS-055", "base");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: am.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: am.cardId,
      phasePlayerId: "player1" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: { battle: [am], discard: [base], rush: [] },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.players.player1.rush.some((c) => c.cardId === "RS-055")).toBe(true);
  });
});

describe("RS-335 destroy recruit", () => {
  it("reanimates マジブルー from discard on destroy", () => {
    const legend = inst("RS-335", "legend");
    const base = inst("RS-059", "base");
    const pendingLeave = {
      ownerPlayerId: "player1" as const,
      instanceId: legend.instanceId,
      fromZone: "battle" as const,
      toZone: "discard" as const,
      leavingCardId: legend.cardId,
      phasePlayerId: "player1" as const,
    };
    const state = createTestState({
      definitions: defs,
      pendingLeave,
      player1: { battle: [legend], discard: [base], rush: [] },
    });
    const after = finalizeLeaveReaction(state, pendingLeave, false);
    expect(after.players.player1.rush.some((c) => c.cardId === "RS-059")).toBe(true);
  });
});

describe("RS-333 マジボルト attack BP", () => {
  it("adds +1000 BP per released command when NC activated", () => {
    const red = inst("RS-333", "red");
    red.activatedNcEffects = ["magi_red_bolt"];
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [red],
        command: [
          { ...inst("TST-OP", "c1"), commandHeld: false },
          { ...inst("TST-OP-ET", "c2"), commandHeld: false },
        ],
      },
      player2: { battle: [inst("TST-UNIT-0", "enemy")] },
    });
    const pending = {
      attackerPlayerId: "player1" as const,
      defenderPlayerId: "player2" as const,
      attackerInstanceId: red.instanceId,
      defenderInstanceId: "TST-UNIT-0:enemy",
      phasePlayerId: "player1" as const,
    };
    expect(battleAttackerBpBonus(state, pending)).toBeGreaterThanOrEqual(2000);
  });
});

describe("RS-335 マジボルト NC draw", () => {
  it("opens optional self draw choice", () => {
    const blue = inst("RS-335", "blue");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        battle: [blue, ...battleFillers(4)],
        deck: [inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")],
      },
    });
    const { state: after } = applyPromotedNcEffect(state, "player1", blue);
    expect(after.pendingEffectChoice?.effectId).toBe("magi_blue_self_draw_1");
  });
});
