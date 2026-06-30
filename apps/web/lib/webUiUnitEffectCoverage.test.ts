import { describe, expect, it } from "vitest";
import { getCardById } from "@rangers-strike/cards";
import {
  listWiredConditionalEffects,
  listWiredEnterBattleEffects,
  listWiredOnAttackEffects,
  listWiredOnRushEffects,
  listWiredPassiveEffects,
} from "@rangers-strike/cards";
import { listUnitEffectCoverageGaps } from "./webUiEffectCoverage";

describe("Web UI unit effect coverage", () => {
  const onRush = listWiredOnRushEffects(getCardById);
  const conditional = listWiredConditionalEffects(getCardById);
  const onAttack = listWiredOnAttackEffects(getCardById);
  const enterBattle = listWiredEnterBattleEffects(getCardById);
  const passive = listWiredPassiveEffects(getCardById);

  it("maps every wired unit effect trigger to a UI mechanism", () => {
    expect(listUnitEffectCoverageGaps()).toEqual([]);
  });

  it("covers wired unit effects across all trigger types", () => {
    const total =
      onRush.length +
      conditional.length +
      onAttack.length +
      enterBattle.length +
      passive.length;
    expect(onRush.length).toBeGreaterThanOrEqual(17);
    expect(conditional.length).toBeGreaterThanOrEqual(14);
    expect(onAttack.length).toBeGreaterThanOrEqual(11);
    expect(enterBattle.length).toBeGreaterThanOrEqual(10);
    expect(passive.length).toBeGreaterThanOrEqual(25);
    expect(total).toBeGreaterThanOrEqual(69);
  });
});
