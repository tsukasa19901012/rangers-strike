import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generatedCorePlayableCatalog as corePlayableCatalog, getFullPlayableCardById } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { effectiveBp } from "../core/catalog";
import { battleAttackerBpBonus } from "../rules/namedUnitEffects";
import { applyGrantKeyword } from "./grantKeyword";
import {
  rideAttackBpBoostAmount,
  rideBpBoostAmount,
  rideMountedVehicleBpBonus,
} from "./promotedKeywordBridge";
import { createTestState, inst, TEST_DEFINITIONS } from "../testing/fixtures";
import type { PendingBattle } from "../types/game";

const dslDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../cards/src/generated/dsl-stubs",
);

/** 定義済み grant_keyword パターン → ランタイム参照先（監査用）。 */
const PASSIVE_KEYWORD_RUNTIME_HOOKS: Array<{
  pattern: RegExp;
  hook: string;
  sampleCardId?: string;
}> = [
  { pattern: /^ride_bp_boost_\d+$/, hook: "rideMountedVehicleBpBonus/effectiveBp", sampleCardId: "RK-058" },
  { pattern: /^ride_attack_bp_boost_\d+$/, hook: "battleAttackerBpBonus", sampleCardId: "XG4-066" },
  { pattern: /^attacked_bp_boost_\d+$/, hook: "attackedBpBoostAmount/battleDefenderBp" },
  { pattern: /^power_faceup_bp_per_\d+$/, hook: "promotedKeywordBpBonus" },
  { pattern: /^sp_at_bp\d+_sp\d+$/, hook: "promotedKeywordSpFloor" },
  { pattern: /^cross\d+$/, hook: "crossAdjustedBattlePosition" },
];

function collectStubGrantKeywords(): Map<string, string[]> {
  const byKeyword = new Map<string, string[]>();
  for (const file of readdirSync(dslDir).filter((f) => f.endsWith(".dsl.json"))) {
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8")) as {
      id: string;
      effects?: Array<{ effects?: Array<{ type: string; keyword?: string }> }>;
    };
    for (const effect of doc.effects ?? []) {
      for (const primitive of effect.effects ?? []) {
        if (primitive.type !== "grant_keyword" || !primitive.keyword) continue;
        const list = byKeyword.get(primitive.keyword) ?? [];
        if (!list.includes(doc.id)) list.push(doc.id);
        byKeyword.set(primitive.keyword, list);
      }
    }
  }
  return byKeyword;
}

const defs: Record<string, CardDefinition> = Object.fromEntries(
  corePlayableCatalog.cards.map((card) => [card.id, card]),
);

describe("grant keyword runtime coverage", () => {
  const stubKeywords = collectStubGrantKeywords();

  it("maps every ride_bp_boost / ride_attack_bp_boost stub keyword to a runtime hook", () => {
    const unmapped: string[] = [];
    for (const keyword of stubKeywords.keys()) {
      if (!/^ride_(bp_boost|attack_bp_boost)_\d+$/.test(keyword)) continue;
      if (!PASSIVE_KEYWORD_RUNTIME_HOOKS.some((entry) => entry.pattern.test(keyword))) {
        unmapped.push(keyword);
      }
    }
    expect(unmapped, unmapped.join(", ")).toEqual([]);
  });

  it("ride_bp_boost applies from vehicle DSL (RK-058)", () => {
    expect(rideBpBoostAmount("RK-058")).toBe(500);
    const vehicle = inst("RK-058", "veh");
    const rider = inst("RK-061", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const state = createTestState({
      definitions: defs,
      player1: { battle: [vehicle, rider] },
    });
    expect(rideMountedVehicleBpBonus(state, "player1", rider)).toBe(500);
    expect(effectiveBp(state, "player1", rider)).toBe(2500);
  });

  it("ride_attack_bp_boost applies when attacking from battle-mounted vehicle", () => {
    expect(rideAttackBpBoostAmount("XG4-066")).toBe(1500);
    const vehicle = inst("XG4-066", "veh");
    const rider = inst("TST-UNIT-0", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const defender = inst("TST-UNIT-1", "def");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [vehicle, rider] },
      player2: { battle: [defender] },
    });
    const pending: PendingBattle = {
      attackerPlayerId: "player1",
      defenderPlayerId: "player2",
      attackerInstanceId: rider.instanceId,
      defenderInstanceId: defender.instanceId,
    };
    const attackerBp = battleAttackerBpBonus(state, pending);
    expect(attackerBp).toBeGreaterThanOrEqual(
      effectiveBp(state, "player1", rider) + 1500,
    );
  });

  it("XG7-048 grants SP1 when all enemy battle units are S-size", () => {
    const self = inst("XG7-048", "self");
    const enemyS = inst("TST-UNIT-0", "es");
    const enemyL = inst("TST-UNIT-7", "el");
    const xg7048 = getFullPlayableCardById("XG7-048");
    expect(xg7048).toBeDefined();
    const definitions: Record<string, CardDefinition> = {
      ...TEST_DEFINITIONS,
      "XG7-048": xg7048!,
    };

    const met = createTestState({
      definitions,
      player1: { battle: [self] },
      player2: { battle: [enemyS] },
    });
    const granted = applyGrantKeyword(met, {
      playerId: "player1",
      phasePlayerId: "player1",
      sourceCardId: "XG7-048",
      effectId: "kuwagatahon",
      triggerSourceInstanceId: self.instanceId,
    }, "sp1_if_enemy_battle_all_s");
    expect(granted.detail).toBe("sp1_if_enemy_battle_all_s");
    expect(granted.state.players.player1.battle[0]?.spModifier).toBe(1);

    const unmet = createTestState({
      definitions,
      player1: { battle: [self] },
      player2: { battle: [enemyL] },
    });
    const skipped = applyGrantKeyword(unmet, {
      playerId: "player1",
      phasePlayerId: "player1",
      sourceCardId: "XG7-048",
      effectId: "kuwagatahon",
      triggerSourceInstanceId: self.instanceId,
    }, "sp1_if_enemy_battle_all_s");
    expect(skipped.detail).toBe("sp1_if_enemy_battle_all_s:unmet");
    expect(skipped.state.players.player1.battle[0]?.spModifier).toBeUndefined();
  });
});
