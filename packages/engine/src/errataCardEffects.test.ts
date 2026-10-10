/**
 * エラッタ・公式回答（docs/rules/08-errata.md）と E7（docs/HANDOFF.md）のカード固有効果。
 * 08 章の仕様テスト（rulesSpec/08-errata.*）を補う、成立側・分岐側の挙動テスト。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "./types/game";
import {
  act,
  inst,
  legal,
  legalOfType,
  powerCards,
  released,
  specState,
  sUnit,
  zoneIds,
} from "./rulesSpec/08-helpers";

const TEST_VEHICLE = {
  id: "VEH",
  name: "VEH",
  type: "vehicle",
  category: "WB",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 2000,
  size: "S",
} as never;

function resolveFirst(s: GameState, max = 8): GameState {
  let next = s;
  for (let i = 0; i < max; i += 1) {
    const a = legal(next).find(
      (x) => x.type === "resolve_effect_choice" || x.type === "confirm_effect_choice",
    );
    if (!a) break;
    next = act(next, a);
  }
  return next;
}

// ---------------------------------------------------------------------------
describe("RK-125 仮面ライダーブレイド【ブレイラウザー】", () => {
  function bladeRideOff(hand: ReturnType<typeof inst>[]) {
    const v = inst("VEH", "v");
    const blade = { ...inst("RK-125", "blade"), mountedOnInstanceId: v.instanceId };
    const enemyS = inst("TST-UNIT-0", "enemy-s");
    const enemyS2 = inst("TST-UNIT-0", "enemy-s2");
    let s = specState(["RK-125"], {
      phase: "battle",
      player1: { rush: [blade, v], hand },
      player2: { battle: [enemyS, enemyS2], deck: [inst("TST-OP", "k")] },
    });
    s.definitions["VEH"] = TEST_VEHICLE;
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: blade.instanceId });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    return { s, enemyS: enemyS.instanceId, enemyS2: enemyS2.instanceId };
  }

  // ルール: R-ERR-RK125（出典: grnrngr/faq-rider-2 RK-125）
  it("RK-125: 手札3枚（カテゴリがすべて同じ）を見せると、敵軍Sユニットを1体ホールドし、敵軍バトルエリアのSユニットを1体撃破する", () => {
    const { s: s0, enemyS, enemyS2 } = bladeRideOff([
      inst("TST-OP", "h0"),
      inst("TST-OP", "h1"),
      inst("TST-OP", "h2"),
    ]);
    expect(s0.pendingEffectChoice?.effectId).toBe("blay_rouzer_show");
    let s = s0;
    for (const id of ["TST-OP:h0", "TST-OP:h1", "TST-OP:h2"]) {
      s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    }
    expect(s.pendingEffectChoice?.effectId).toBe("blay_rouzer_hold");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: enemyS });
    expect(s.pendingEffectChoice?.effectId).toBe("blay_rouzer_destroy");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: enemyS2 });
    const battle = s.players.player2.battle;
    expect(battle.find((c) => c.instanceId === enemyS)?.commandHeld).toBe(true);
    expect(zoneIds(s, "player2", "discard")).toContain(enemyS2);
  });

  it("RK-125: 見せたカードのカテゴリがそろっていなければホールドだけ", () => {
    const { s: s0, enemyS, enemyS2 } = bladeRideOff([
      inst("TST-OP", "h0"),
      inst("TST-OP-MA", "h1"),
      inst("TST-OP", "h2"),
    ]);
    const s = resolveFirst(s0);
    expect(s.players.player2.battle.find((c) => c.instanceId === enemyS)?.commandHeld).toBe(true);
    expect(zoneIds(s, "player2", "battle")).toContain(enemyS2);
  });
});
