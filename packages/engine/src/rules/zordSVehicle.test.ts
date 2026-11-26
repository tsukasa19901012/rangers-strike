/**
 * 「自軍Sユニットを…送る／捨札にする」型の追加条件は S ユニットだけで満たす。S ビークルは使えない。
 * 報告（2026-11-25）: RK-058 マシンゼクトロン（S ビークル）で RK-147 デンライナーイスルギをラッシュできていた。
 */
import { isSendSUnitZordCondition, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import { releasedCat, st } from "../cardSpec/RK1-001-021.helpers";
import { describe, expect, it } from "vitest";
import { getLegalActions } from "../core/legalActions";
import { inst } from "../testing/fixtures";
import { collectZordMaterials, isValidZordUpMaterial } from "./zord";

const S_UNIT_CONDITIONS = ["send_s_unit_to_power", "send_s_unit_to_discard", "send_s_unit_to_command_or_discard", "send_s_units_to_zones"];

function rushState() {
  return st({
    phase: "rush",
    player1: {
      hand: [inst("RK-147", "is")],
      rush: [inst("RK-058", "zect")],
      power: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `pw${i}`)),
      command: releasedCat("OT", 4),
    },
  });
}

describe("S ユニット型の追加条件に S ビークルは使えない", () => {
  it("RK-147 デンライナーイスルギ: RK-058 マシンゼクトロン（S ビークル）は素材にならない", () => {
    const s = rushState();
    const p = s.players.player1;
    expect(s.definitions["RK-058"]?.type).toBe("vehicle");
    expect(s.definitions["RK-058"]?.size).toBe("S");
    expect(isValidZordUpMaterial(s.definitions, "RK-147", "RK-147:is", p.rush[0]!)).toBe(false);
    expect(collectZordMaterials(p, s.definitions, "RK-147", "RK-147:is")).toEqual([]);
  });

  it("RK-147: S ビークルしかなければラッシュの合法手に出ない／S ユニットがあれば出る", () => {
    const vehicleOnly = rushState();
    const rushOf = (st: ReturnType<typeof rushState>) =>
      getLegalActions(st).filter((a) => JSON.stringify(a).includes("RK-147:is"));
    expect(rushOf(vehicleOnly)).toEqual([]);

    const withUnit = rushState();
    withUnit.players.player1.rush.push(inst("TST-UNIT-0", "su"));
    expect(isValidZordUpMaterial(withUnit.definitions, "RK-147", "RK-147:is", withUnit.players.player1.rush[1]!)).toBe(true);
    expect(rushOf(withUnit).length).toBeGreaterThan(0);
    expect(JSON.stringify(rushOf(withUnit))).not.toContain("RK-058:zect");
  });

  it("全カード: 「自軍Sユニット」型の追加条件（パワーゾーン・捨札・コマンドゾーン・自軍ゾーン）で S ビークルは素材にならない", () => {
    const s = st();
    const vehicles = Object.values(s.definitions).filter((c) => c.type === "vehicle" && c.size === "S");
    expect(vehicles.length).toBeGreaterThan(10);
    const rushers = Object.values(s.definitions).filter((c) => {
      const id = resolveRushAdditionalCondition(c.id)?.conditionId;
      return !!id && (S_UNIT_CONDITIONS.includes(id) || isSendSUnitZordCondition(id as Parameters<typeof isSendSUnitZordCondition>[0]));
    });
    expect(rushers.map((c) => c.id)).toContain("RK-147");
    const wrong: string[] = [];
    for (const rusher of rushers) {
      for (const v of vehicles) {
        if (isValidZordUpMaterial(s.definitions, rusher.id, `${rusher.id}:r`, inst(v.id, "v"))) wrong.push(`${rusher.id}←${v.id}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
