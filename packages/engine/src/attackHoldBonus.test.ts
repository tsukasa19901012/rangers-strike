/**
 * 「アタックするとき、自軍コマンドを好きな数ホールド…1つにつき BP+1000」のホールド数選択
 * （rules/attackHoldBonus.ts）: RS-019 超力・RK-186 仮面ライダーJ【Jパンチ】と CPU の選び方。
 */
import { describe, expect, it } from "vitest";
import { pickCpuAction } from "./ai";
import {
  act,
  bpOf,
  inst,
  legal,
  legalOfType,
  released,
  specState,
  zoneOf,
} from "./cardSpec/RS1-001-023.helpers";
import type { GameState } from "./types/game";

function settle(s: GameState): GameState {
  let n = s;
  for (let i = 0; i < 10; i += 1) {
    const step =
      legal(n).find(
        (a) =>
          a.type === "pass_battle_reaction" ||
          a.type === "pass_leave_reaction" ||
          a.type === "pass_strike_reaction" ||
          a.type === "pass_register",
      ) ?? legal(n).find((a) => a.type === "resolve_damage_payment");
    if (!step) break;
    n = act(n, step);
  }
  return n;
}

function choose(s: GameState, n: number): GameState {
  expect(s.pendingEffectChoice?.effectId).toBe("attack_hold_bonus");
  return act(s, { type: "resolve_effect_choice", playerId: s.pendingEffectChoice!.playerId, instanceId: String(n) });
}

describe("RK-186 仮面ライダーJ【Jパンチ】（出典: カードテキスト「これがアタックするとき、自軍コマンドを好きな数ホールドしてもよい。そうしたとき、このターン、これはホールドしたコマンド1つにつきBP+1000される」）", () => {
  function jState(defBp: number, releasedN = 3) {
    const j = inst("RK-186", "j");
    const def = { ...inst("CS-S1", "def"), bpModifier: defBp - 1000 };
    const s = specState(["RK-186"], {
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [j],
        command: Array.from({ length: releasedN }, (_, i) => released("TST-OP-MA", `r${i}`)),
      },
      player2: { battle: [def] },
    });
    return {
      s: act(s, { type: "battle", playerId: "player1", attackerInstanceId: j.instanceId, defenderInstanceId: def.instanceId }),
      j,
      def,
    };
  }

  it("アタックするとホールド数（0〜3）の選択が開き、選ぶまでバトルしない", () => {
    const { s, def } = jState(2500);
    expect(legalOfType(s, "resolve_effect_choice").map((a) => a.instanceId)).toEqual(["0", "1", "2", "3"]);
    expect(zoneOf(s, "player2", def.instanceId)).toBe("battle");
  });

  it("2 を選ぶと BP3000 で BP2500 に勝ち、BP+2000 はこのターン残る", () => {
    const { s: s0, j, def } = jState(2500);
    const s = settle(choose(s0, 2));
    expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
    expect(zoneOf(s, "player1", j.instanceId)).toBe("battle");
    expect(bpOf(s, "player1", j.instanceId)).toBe(3000);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("0 を選ぶとホールドせず BP1000 のまま負ける", () => {
    const { s: s0, j } = jState(2500);
    const s = settle(choose(s0, 0));
    expect(zoneOf(s, "player1", j.instanceId)).toBe("discard");
    expect(s.players.player1.command.some((c) => c.commandHeld)).toBe(false);
  });

  it("リリース状態のコマンドがなければ選択は開かない", () => {
    const { s, def } = jState(500, 0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(settle(s), "player2", def.instanceId)).toBe("discard");
  });

  it("超力の下では効果ごとに順に選ぶ（超力 → Jパンチ。2 つ目はリリース状態の残りまで）", () => {
    const j = inst("RK-186", "j");
    const def = { ...inst("CS-S1", "def"), bpModifier: 2500 };
    let s = specState(["RK-186", "RS-019"], {
      phase: "battle",
      activePlayer: "player1",
      player1: {
        operation: [inst("RS-019", "ch")],
        battle: [j],
        command: Array.from({ length: 3 }, (_, i) => released("TST-OP-MA", `r${i}`)),
      },
      player2: { battle: [def] },
    });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: j.instanceId, defenderInstanceId: def.instanceId });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-019");
    s = choose(s, 1);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-186");
    expect(legalOfType(s, "resolve_effect_choice").map((a) => a.instanceId)).toEqual(["0", "1", "2"]);
    s = settle(choose(s, 2));
    // BP1000 + 超力1000 + Jパンチ2000 = 4000 > 3500
    expect(zoneOf(s, "player2", def.instanceId)).toBe("discard");
    expect(bpOf(s, "player1", j.instanceId)).toBe(3000);
  });
});

describe("CPU のホールド数選択", () => {
  function superPowerAttack(defBp: number) {
    const atk = inst("CS-S1", "atk");
    const def = { ...inst("CS-S1", "def"), bpModifier: defBp - 1000 };
    const s = specState(["RS-019"], {
      phase: "battle",
      activePlayer: "player1",
      player1: {
        operation: [inst("RS-019", "ch")],
        battle: [atk],
        command: Array.from({ length: 4 }, (_, i) => released("TST-OP-MA", `r${i}`)),
      },
      player2: { battle: [def] },
    });
    return act(s, { type: "battle", playerId: "player1", attackerInstanceId: atk.instanceId, defenderInstanceId: def.instanceId });
  }

  it("勝てる最小の数を選ぶ（BP2500 相手なら 2）", () => {
    const action = pickCpuAction(superPowerAttack(2500), "player1");
    expect(action).toMatchObject({ type: "resolve_effect_choice", instanceId: "2" });
  });

  it("全部ホールドしても勝てなければ 0（コマンドを温存）", () => {
    const action = pickCpuAction(superPowerAttack(9000), "player1");
    expect(action).toMatchObject({ type: "resolve_effect_choice", instanceId: "0" });
  });
});
