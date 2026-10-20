/**
 * RS-284 ホワイトスワン【スワンウィング】で出たユニットへの「ラッシュされたとき」の反応。
 *
 * 出典:
 *  - grnrngr faq/rider_1.html RS-284 の問・atwiki/page-472 コメント — スワンウィングで出したユニットは
 *    「ラッシュされた」扱い（ラッシュしたとき／ラッシュされたときの効果が発動する）。
 *  - grnrngr faq/card_1.html RS-026 Q2 — 疾風流超忍法は相手に出された自軍ユニットにも使える。
 *  - atwiki/page-1295 — ※カウンターは敵軍ターン中にのみ使用できる（R-CTR-01）。スワンウィングを使った
 *    プレイヤーは自軍ターンなので使えず、応答するのは出されたユニットの持ち主。
 *  - RK-012 本文「BP4000以上のSユニットがラッシュされたとき発動できる⇒このターン、相手はバトルフェイズを飛ばす」
 */
import { describe, expect, it } from "vitest";
import {
  act,
  canUse,
  CMD,
  deck,
  inst,
  legal,
  mk,
  payAndUse,
  powers,
  released,
  zoneOf,
} from "./cardSpec/RS1-024-046.helpers";
import type { GameState } from "./types/game";

function swanScene(p2: { hand: ReturnType<typeof inst>[]; command: ReturnType<typeof inst>[] }, p1Hand: ReturnType<typeof inst>[] = []) {
  let s = mk({
    phase: "battle",
    activePlayer: "player1",
    player1: {
      battle: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2")],
      rush: [inst("RS-284", "swan"), inst("RS-062", "ma")],
      hand: p1Hand,
      power: powers(6, "p1pw"),
      command: [released(CMD.MA, "p1m"), released(CMD.ET, "p1e")],
      deck: deck(5, "p1d"),
    },
    player2: { ...p2, power: powers(6, "p2pw"), deck: deck(5, "p2d") },
  });
  s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-284:swan" });
  const use = legal(s).find(
    (a) => a.type === "resolve_effect_choice" && a.playerId === "player1" && a.instanceId === "swan_wing_deploy_enemy_command_s",
  );
  expect(use, "スワンウィングを使える").toBeDefined();
  return act(s, use!);
}

function passRush(s: GameState): GameState {
  return act(s, { type: "pass_rush_reaction", playerId: "player2" });
}

describe("RS-284【スワンウィング】で出たユニットの「ラッシュされたとき」の窓", () => {
  it("出たユニットの持ち主（敵軍ターン中）に窓が開く — RK-012 宏のオルゴール時計: BP4000以上の S ユニットなら、スワンウィングの使用者はこのターンのバトルフェイズを飛ばす", () => {
    const clock = inst("RK-012", "clock");
    let s = swanScene({
      hand: [clock],
      command: [released("SPEC-S-5000", "big"), released(CMD.ET, "e")],
    });
    expect(zoneOf(s, "player2", "SPEC-S-5000:big")).toBe("rush");
    expect(s.pendingRush?.rushedInstanceId).toBe("SPEC-S-5000:big");
    expect(s.activePlayer).toBe("player2");
    expect(canUse(s, "player2", clock.instanceId)).toBe(true);
    s = payAndUse(s, "player2", clock.instanceId);
    expect(zoneOf(s, "player2", clock.instanceId)).toBe("discard");
    expect(s.pendingRush).toBeUndefined();
    // バトルフェイズを飛ばす: 残りのユニットはアタック・ストライクもバトル進入もできない
    for (let i = 0; i < 4 && legal(s).some((a) => a.type === "pass_battle_entry"); i += 1) {
      s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    }
    expect(legal(s).some((a) => a.type === "battle" || a.type === "strike" || a.type === "move_to_battle")).toBe(false);
  });

  it("RS-247 疾風流超忍法: 相手に出された自軍ユニット（BP8000以下）を持ち主の山札の上に戻せる", () => {
    const ninja = inst("RS-247", "ninja");
    let s = swanScene({
      hand: [ninja],
      command: [released("SPEC-S-1000", "small"), released(CMD.MA, "m")],
    });
    expect(s.pendingRush?.rushedInstanceId).toBe("SPEC-S-1000:small");
    expect(canUse(s, "player2", ninja.instanceId)).toBe(true);
    s = payAndUse(s, "player2", ninja.instanceId);
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-S-1000:small");
    expect(zoneOf(s, "player2", "SPEC-S-1000:small")).toBe("deck");
  });

  it("RS-026 疾風流超忍法: 2 体出たら使用者（ターンプレイヤー）が処理順を選び、1 体ずつ窓が開く（2 体目に使う）", () => {
    const ninja = inst("RS-026", "ninja");
    let s = swanScene({
      hand: [ninja],
      command: [released("SPEC-S-1000", "a"), released("SPEC-S-3000", "b"), released(CMD.MA, "m")],
    });
    // R-SIM-01 — 同時に出たユニットの処理順はターンプレイヤーが決める
    expect(s.pendingEffectChoice?.effectId).toBe("swan_wing_order");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(zoneOf(s, "player2", "SPEC-S-1000:a")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-S-3000:b")).toBe("rush");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-S-3000:b" });
    expect(s.pendingRush?.rushedInstanceId).toBe("SPEC-S-3000:b");
    s = passRush(s);
    expect(s.pendingRush?.rushedInstanceId).toBe("SPEC-S-1000:a");
    s = payAndUse(s, "player2", ninja.instanceId);
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-S-1000:a");
    expect(zoneOf(s, "player2", "SPEC-S-3000:b")).toBe("rush");
    expect(s.pendingRush).toBeUndefined();
  });

  it("出たユニットはラッシュ扱いでも、窓が閉じればスワンウィングの使用者はバトルフェイズを続けられる", () => {
    let s = swanScene({ hand: [inst("RS-247", "ninja")], command: [released("SPEC-S-1000", "small"), released(CMD.MA, "m")] });
    s = passRush(s);
    expect(s.pendingRush).toBeUndefined();
    expect(s.activePlayer).toBe("player1");
    expect(legal(s).some((a) => a.playerId === "player1")).toBe(true);
  });

  it("XG7-027 雷撃ディスク: どちらのプレイヤーも使えない（使用者は自軍ターン、持ち主には出たユニットが敵軍ではない）（出典: atwiki/page-1295）", () => {
    const p1Disk = inst("XG7-027", "d1");
    const p2Disk = inst("XG7-027", "d2");
    let s = swanScene(
      {
        hand: [p2Disk, inst("RS-247", "ninja")],
        command: [released("SPEC-S-1000", "small"), released(CMD.MA, "m")],
      },
      [p1Disk],
    );
    expect(s.pendingRush).toBeDefined();
    expect(canUse(s, "player2", p2Disk.instanceId)).toBe(false);
    expect(canUse(s, "player1", p1Disk.instanceId)).toBe(false);
    s = passRush(s);
    expect(canUse(s, "player1", p1Disk.instanceId)).toBe(false);
  });
});
