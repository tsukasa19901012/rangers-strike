import { describe, expect, it } from "vitest";
import { rematchEffectPrimitives } from "@rangers-strike/cards/pipeline/extractEffects";
import { applyGrantKeyword } from "./dsl/grantKeyword";
import { battleAttackerBpBonus } from "./rules/namedUnitEffects";
import { cannotAttackOrStrikeThisTurn } from "./rules/restrictions";
import { createTestState, inst } from "./testing/fixtures";
import { isHashGrantKeywordStub } from "./dsl/hashGrantKeywordStub";

describe("XP-024 hash stub resolution", () => {
  it("rematch resolves 力の2号 and note effects to structured primitives", () => {
    const battle = rematchEffectPrimitives(
      "BP4000以上の敵軍Sユニットを1体選び、このユニットと選んだユニットでバトルしてもよい。そうしたとき、このターン、これはアタックする事ができない。",
      { name: "力の2号", kind: "named", trigger: { type: "nc" } },
    );
    expect(battle?.some((p) => p.type === "choose")).toBe(true);
    expect(
      battle?.every(
        (p) => !(p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword)),
      ),
    ).toBe(true);

    const note = rematchEffectPrimitives(
      "※これは自軍ターン中、バトルするとき、BP+2000される。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(note?.[0]).toMatchObject({
      type: "grant_keyword",
      keyword: "bp_plus_on_battle_own_turn_2000",
    });
  });

  it("starts optional enemy battle via grant_keyword handler", () => {
    const rider = inst("XP-024", "rider");
    const enemy = inst("TST-UNIT-0", "enemy");
    const state = createTestState({
      definitions: {
        ...createTestState({}).definitions,
        "XP-024": {
          id: "XP-024",
          name: "仮面ライダー2号",
          type: "unit",
          category: "ET",
          rarity: "N",
          expansion: "legend1",
          powerCost: 3,
          bp: 3000,
          size: "S",
        },
        "TST-UNIT-0": {
          id: "TST-UNIT-0",
          name: "High BP Striker",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "test",
          powerCost: 0,
          bp: 5000,
          sp: 1,
          size: "S",
        },
      },
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [rider] },
      player2: { battle: [enemy] },
    });

    const result = applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "XP-024",
        effectId: "chikara_no_2_go",
        triggerSourceInstanceId: enemy.instanceId,
      },
      "optional_enemy_battle_min_bp_4000_no_attack",
    );

    expect(result.state.pendingBattle?.defenderInstanceId).toBe(enemy.instanceId);
    const riderInBattle = result.state.players.player1.battle.find(
      (c) => c.instanceId === rider.instanceId,
    );
    expect(riderInBattle?.activatedNcEffects).toContain("optional_battle_no_attack");
    expect(cannotAttackOrStrikeThisTurn(result.state.players.player1, riderInBattle!)).toBe(
      true,
    );
  });

  it("resolves legacy hash grant_keyword via rematch bridge", () => {
    const rider = inst("XP-024", "rider");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [rider] },
    });
    const result = applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "XP-024",
        effectId: "note_e280bbe38193e3828ce381af",
        triggerSourceInstanceId: rider.instanceId,
      },
      "note_other_e280bbe38193",
    );
    expect(result.detail).toBe("bp_plus_on_battle_own_turn_2000");
  });

  it("grants BP+2000 when battling on own turn", () => {
    const rider = inst("XP-024", "rider");
    const enemy = inst("TST-UNIT-0", "enemy");
    const state = createTestState({
      definitions: {
        ...createTestState({}).definitions,
        "XP-024": {
          id: "XP-024",
          name: "仮面ライダー2号",
          type: "unit",
          category: "ET",
          rarity: "N",
          expansion: "legend1",
          powerCost: 3,
          bp: 3000,
          size: "S",
        },
      },
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [rider],
      },
      player2: {
        battle: [enemy],
      },
    });

    applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "XP-024",
        effectId: "note_e280bbe38193e3828ce381af",
        triggerSourceInstanceId: rider.instanceId,
      },
      "note_other_e280bbe38193",
    );

    const pending = {
      attackerPlayerId: "player1" as const,
      attackerInstanceId: rider.instanceId,
      defenderPlayerId: "player2" as const,
      defenderInstanceId: enemy.instanceId,
      phasePlayerId: "player1" as const,
    };
    expect(battleAttackerBpBonus(state, pending)).toBeGreaterThanOrEqual(2000);
  });
});
