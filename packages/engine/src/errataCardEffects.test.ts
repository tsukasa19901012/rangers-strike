/**
 * エラッタ・公式回答（docs/rules/08-errata.md）と E7（docs/HANDOFF.md）のカード固有効果。
 * 08 章の仕様テスト（rulesSpec/08-errata.*）を補う、成立側・分岐側の挙動テスト。
 */
import { describe, expect, it } from "vitest";
import type { GameAction } from "./types/actions";
import type { GameState } from "./types/game";
import {
  applyDragonHarleyTurnEnd,
  applyElectroBeamTurnEnd,
  applyOrochiTurnEnd,
  tryErrataCardEffect,
} from "./rules/errataCardEffects";
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

const J = (a: GameAction) => JSON.stringify(a);

function actOn(s: GameState, pick: (a: GameAction) => boolean): GameState {
  const a = legal(s).find(pick);
  if (!a) throw new Error(`no legal action; legal=${legal(s).map((x) => x.type).join(",")}`);
  return act(s, a);
}

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

// ---------------------------------------------------------------------------
// E7（docs/HANDOFF.md）: 原文の効果テキストどおりの挙動

describe("XG1-029 アバレブラックAM【無敵の竜人魂】（出典: atwiki/page-1620）", () => {
  function blackEntered(targetCategory: "DA" | "WB") {
    const black = inst("XG1-029", "black");
    const l = inst("LOWL", "l");
    let s = specState(["XG1-029"], {
      phase: "battle",
      player1: { rush: [black] },
      player2: { battle: [l] },
    });
    s.definitions["LOWL"] = sUnit("LOWL", { size: "L", bp: 7000, category: targetCategory });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: black.instanceId });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: l.instanceId });
    return { s, black: black.instanceId, l: l.instanceId };
  }

  it("XG1-029: 撃破したLユニットがDAを持っていたなら、このターン「SP1」になる", () => {
    const { s, black, l } = blackEntered("DA");
    expect(zoneIds(s, "player2", "discard")).toContain(l);
    expect(s.players.player1.battle.find((c) => c.instanceId === black)?.spOverride).toBe(1);
  });

  it("XG1-029: DAを持たないLユニットなら撃破だけ", () => {
    const { s, black, l } = blackEntered("WB");
    expect(zoneIds(s, "player2", "discard")).toContain(l);
    expect(s.players.player1.battle.find((c) => c.instanceId === black)?.spOverride).toBeUndefined();
  });
});

describe("XG1-062 仮面ライダーワイルドカリス【ワイルドサイクロン】（出典: atwiki/page-1667）", () => {
  function wildEntered() {
    const wc = inst("XG1-062", "wc");
    let s = specState(["XG1-062"], {
      phase: "battle",
      player1: { rush: [wc] },
      player2: {
        battle: [inst("S6K", "a"), inst("S6K", "b")],
        deck: [inst("TST-OP", "k1"), inst("TST-OP", "k2")],
      },
    });
    s.definitions["S6K"] = sUnit("S6K", { bp: 6000 });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: wc.instanceId });
    return s;
  }

  it("XG1-062: 敵軍バトルエリアのSユニットを好きな数ホールドし、BP合計10000ごとに1点", () => {
    let s = wildEntered();
    expect(s.pendingEffectChoice?.effectId).toBe("wild_cyclone");
    s = resolveFirst(s);
    expect(s.players.player2.battle.every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("XG1-062: 1体だけ選んで確定すれば BP6000 なのでダメージなし", () => {
    let s = wildEntered();
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "S6K:a" });
    s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(s.players.player2.battle.filter((c) => c.commandHeld)).toHaveLength(1);
    expect(s.players.player2.damage).toBe(0);
  });
});

describe("PR-015 バイオロボ【バイオ粒子斬り】（出典: atwiki/page-989）", () => {
  it("PR-015: OT コマンド2つをパワーゾーンに送ると、このターン「SP2」「BP+3000」", () => {
    const robo = inst("PR-015", "robo");
    let s = specState(["PR-015"], {
      phase: "battle",
      player1: {
        rush: [robo],
        command: [released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")],
      },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: robo.instanceId });
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(1);
    s = resolveFirst(s);
    const unit = s.players.player1.battle.find((c) => c.instanceId === robo.instanceId)!;
    expect(unit.spOverride).toBe(2);
    expect(unit.bpModifier).toBe(3000);
    expect(zoneIds(s, "player1", "power").sort()).toEqual(["TST-OP-OT:o1", "TST-OP-OT:o2"]);
  });
});

describe("RK-140 / RK-334 仮面ライダー電王LF（出典: atwiki/page-671, page-1369）", () => {
  it("RK-140: 場にある間、必要パワーの数字が2以下のユニットは（敵軍も）バトルエリアに出られない", () => {
    const low = inst("LOW2", "low");
    const s = specState(["RK-140"], {
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [inst("RK-140", "lf")] },
      player2: { rush: [low] },
    });
    s.definitions["LOW2"] = sUnit("LOW2", { powerCost: 2 });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === low.instanceId)).toBe(false);
    s.definitions["LOW2"] = sUnit("LOW2", { powerCost: 3 });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === low.instanceId)).toBe(true);
  });

  it("RK-140【電車斬り】: 常駐置き場の DEN-O ユニットカードを捨札にして相手に1点", () => {
    const lf = inst("RK-140", "lf");
    const res = { ...inst("TST-OP", "res"), stackedCards: [inst("DENO", "deno")] };
    let s = specState(["RK-140"], {
      phase: "battle",
      player1: { rush: [lf], operation: [res] },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: [inst("TST-OP", "k")] },
    });
    s.definitions["DENO"] = sUnit("DENO", { features: ["DEN-O"] });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: lf.instanceId });
    expect(s.pendingEffectChoice?.effectId).toBe("densha_giri");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "DENO:deno" });
    expect(zoneIds(s, "player1", "discard")).toContain("DENO:deno");
    expect(s.players.player2.damage).toBe(1);
  });

  it("RK-334【電車斬り】: 自軍ラッシュエリアにモモタロス・ウラタロス・キンタロス・リュウタロスがあれば「SP2」", () => {
    const lf = inst("RK-334", "lf");
    let s = specState(["RK-334", "RK-142", "RK-143", "RK-144", "RK-145"], {
      phase: "battle",
      player1: {
        rush: [lf, inst("RK-142", "m"), inst("RK-143", "u"), inst("RK-144", "k"), inst("RK-145", "r")],
      },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: lf.instanceId });
    s = resolveFirst(s);
    expect(s.players.player1.battle.find((c) => c.instanceId === lf.instanceId)?.spOverride).toBe(2);
  });
});

describe("RS-288 守護獣ドラゴンシーザー（出典: atwiki/page-99）", () => {
  it("RS-288: 獣奏剣を持つ自軍ユニットがなく、ホールドできる「獣奏剣」もなければバトルエリアに出られない", () => {
    const dc = inst("RS-288", "dc");
    const s = specState(["RS-288", "RS-243"], {
      phase: "battle",
      player1: { rush: [dc], command: [released("TST-OP", "c")] },
    });
    expect(legal(s).some((a) => a.type !== "end_phase" && J(a).includes(dc.instanceId))).toBe(false);
  });

  it("RS-288: リリース状態の「獣奏剣」をホールドしてバトルエリアに出る", () => {
    const dc = inst("RS-288", "dc");
    let s = specState(["RS-288", "RS-243"], {
      phase: "battle",
      player1: { rush: [dc], command: [released("RS-243", "sword")] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: dc.instanceId });
    expect(zoneIds(s, "player1", "battle")).toContain(dc.instanceId);
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("RS-288【ドラゴンハーレー】: ラッシュエリアにある間、ターンを終えるとき BP3000 のユニットを1体撃破", () => {
    const s0 = specState(["RS-288"], {
      phase: "battle",
      player1: { rush: [inst("RS-288", "dc")] },
      player2: { battle: [inst("B3K", "m3000"), inst("TST-UNIT-0", "s1000")] },
    });
    s0.definitions["B3K"] = sUnit("B3K", { bp: 3000 });
    let s = applyDragonHarleyTurnEnd(s0, "player1");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["B3K:m3000"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "B3K:m3000" });
    expect(zoneIds(s, "player2", "discard")).toContain("B3K:m3000");
  });
});

describe("XG1-028 アバレンオージ（出典: atwiki/page-1665）", () => {
  it("XG1-028: 自軍ラッシュフェイズ中にこれを捨札にし、手札の「アバレンオー」をラッシュエリアに出せる", () => {
    const oj = inst("XG1-028", "oj");
    const ao = inst("RS-050", "ao");
    let s = specState(["XG1-028", "RS-050"], {
      phase: "rush",
      player1: { rush: [oj], hand: [ao] },
    });
    s = actOn(s, (a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === oj.instanceId);
    expect(zoneIds(s, "player1", "discard")).toContain(oj.instanceId);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: ao.instanceId });
    expect(zoneIds(s, "player1", "rush")).toContain(ao.instanceId);
  });

  it("XG1-028: ※ホールド状態のときストライクできない", () => {
    const oj = { ...inst("XG1-028", "oj"), commandHeld: true };
    const s = specState(["XG1-028"], { phase: "battle", player1: { battle: [oj] } });
    expect(legal(s).some((a) => a.type === "strike" && a.instanceId === oj.instanceId)).toBe(false);
  });
});

describe("XG6-015 爆竜パラサロッキル【爆竜必殺チョキチョキシザース】（出典: atwiki/page-2298）", () => {
  it("XG6-015: L からのコンビネーション時、相手はオモテ向きのカードか手札を1枚捨札にする", () => {
    const s0 = specState(["XG6-015"], {
      phase: "battle",
      player1: { battle: [inst("XG6-015", "p")] },
      player2: { hand: [inst("TST-OP", "h")] },
    });
    const r = tryErrataCardEffect(
      s0,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "XG6-015",
        effectId: "baku_chokichokishizasu",
        triggerSourceInstanceId: "XG6-015:p",
      },
      "effect_card::XG6-015::baku_chokichokishizasu",
    );
    expect(r?.state.pendingEffectChoice?.playerId).toBe("player2");
    const s = act(r!.state, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:h" });
    expect(zoneIds(s, "player2", "discard")).toEqual(["TST-OP:h"]);
  });
});

// ---------------------------------------------------------------------------
// 08 章の補足（成立側）

describe("XG1-048【エレキ光線】のターン終了時（出典: atwiki/page-1632 Q1）", () => {
  it("XG1-048: 選ばれたユニットがバトルエリアにあれば、ターン終了時に隣り合うユニットだけ撃破", () => {
    const s0 = specState([], {
      phase: "battle",
      activePlayer: "player2",
      player2: {
        battle: [
          inst("TST-UNIT-0", "a"),
          { ...inst("TST-UNIT-0", "marked"), electroBeamTurn: 5 },
          inst("TST-UNIT-0", "c"),
          inst("TST-UNIT-0", "d"),
        ],
      },
    });
    const s = applyElectroBeamTurnEnd({ ...s0, turn: 5 }, "player2");
    expect(zoneIds(s, "player2", "battle")).toEqual(["TST-UNIT-0:marked", "TST-UNIT-0:d"]);
  });
});

describe("RK-231 オロチ【潜水】のターン終了時（出典: atwiki/page-948）", () => {
  it("RK-231: ターンを終えるとき、ホールドするかを選べる（選べばホールド状態）", () => {
    const s0 = specState(["RK-231"], { phase: "battle", player1: { battle: [inst("RK-231", "o")] } });
    let s = applyOrochiTurnEnd(s0, "player1");
    expect(s.pendingEffectChoice?.effectId).toBe("orochi_dive");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RK-231:o" });
    expect(s.players.player1.battle[0]?.commandHeld).toBe(true);
  });
});

describe("RK-086 アカネタカ（出典: grnrngr/faq-rider-2 RK-086）", () => {
  it("RK-086: かわりにダメージにした後、1枚ドローする", () => {
    let s = specState(["RK-086"], {
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-0", "st")] },
      player2: {
        hand: [inst("RK-086", "a1")],
        command: [released("TST-OP-MA", "m1")],
        power: powerCards(2),
        deck: [inst("TST-OP", "e0")],
      },
    });
    s = act(s, { type: "strike", playerId: "player1", instanceId: "TST-UNIT-0:st" });
    s = act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: "RK-086:a1" });
    expect(s.players.player2.damage).toBe(1);
    expect(zoneIds(s, "player2", "hand")).toEqual(["TST-OP:e0"]);
    expect(s.players.player2.power.filter((c) => !c.faceDown)).toHaveLength(2);
  });
});
