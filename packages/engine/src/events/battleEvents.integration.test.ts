import { describe, expect, it } from "vitest";
import { getEngineEventDispatcher } from "./globalDispatcher";
import { resolveEnterBattleEffectsImpl } from "../rules/combo";
import { resolveBattlePendingCore } from "../rules/operationCounters";
import { registerEnterBattleEffectsImpl } from "./listeners/unitEnteredBattleListener";
import { registerBattlePendingResolver } from "./listeners/battleDeclaredListener";

describe("battle event integration", () => {
  it("registers UnitEnteredBattle and BattleDeclared listeners", () => {
    registerEnterBattleEffectsImpl(resolveEnterBattleEffectsImpl);
    registerBattlePendingResolver(resolveBattlePendingCore);

    const dispatcher = getEngineEventDispatcher();
    expect(dispatcher.hasListeners("UnitEnteredBattle")).toBe(true);
    expect(dispatcher.hasListeners("BattleDeclared")).toBe(true);
  });
});
