// 除外ゾーン（rules/exile.ts）と、実際のカード効果で除外したときの状態。
// UI（web-pocket の「除外 N」・帯の除N）は players[x].exile だけを見るので、
// 除外されたカードがそこに入り、他のどのゾーンにも残らず、枚数が増減しないことを確かめる。
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { createTestState, inst } from "../testing/fixtures";
import { deckCards, enter, resolveAll, st, sUnit, zoneOf } from "../cardSpec/XG3-002-021.helpers";
import { findCardInAnyZone, findInExile, moveFromExile, moveToExile } from "./exile";

const ZONES = ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation", "exile"] as const;

/** そのプレイヤーの全カード（重ねたカードも数える）の instanceId。 */
function allIds(s: GameState, playerId: PlayerId): string[] {
  const p = s.players[playerId];
  const ids: string[] = [];
  const walk = (cards: readonly CardInstance[]) => {
    for (const c of cards) {
      ids.push(c.instanceId);
      walk(c.stackedCards ?? []);
    }
  };
  for (const zone of ZONES) walk((p[zone] as CardInstance[] | undefined) ?? []);
  return ids.sort();
}

/** 除外以外のゾーンにあるか。 */
function outsideExile(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  const p = s.players[playerId];
  return ZONES.filter((z) => z !== "exile").some((z) => ((p[z] as CardInstance[] | undefined) ?? []).some((c) => c.instanceId === instanceId));
}

describe("除外ゾーン（rules/exile.ts）", () => {
  const fieldZones = ["hand", "rush", "battle", "command", "power", "discard", "operation"] as const;

  for (const zone of fieldZones) {
    it(`moveToExile: ${zone} から除外ゾーンの末尾へ移す（元のゾーンから消え、枚数は変わらない）`, () => {
      const card = inst(zone === "operation" ? "TST-OP" : "TST-UNIT-0", `x-${zone}`);
      const already = inst("TST-UNIT-0", "old");
      const s = createTestState({ player1: { [zone]: [card], exile: [already] } });
      const before = allIds(s, "player1");
      const next = moveToExile(s, "player1", zone, card.instanceId);
      expect(next.players.player1.exile!.map((c) => c.instanceId)).toEqual(["TST-UNIT-0:old", card.instanceId]);
      expect(next.players.player1[zone].some((c) => c.instanceId === card.instanceId)).toBe(false);
      expect(allIds(next, "player1")).toEqual(before);
    });
  }

  it("moveToExile: そのゾーンにないカードなら何もしない", () => {
    const s = createTestState({ player1: { hand: [inst("TST-UNIT-0", "h")] } });
    expect(moveToExile(s, "player1", "battle", "TST-UNIT-0:h")).toBe(s);
  });

  it("moveToExile: 相手のカードは動かさない", () => {
    const s = createTestState({ player1: { battle: [inst("TST-UNIT-0", "a")] }, player2: { battle: [inst("TST-UNIT-0", "b")] } });
    const next = moveToExile(s, "player1", "battle", "TST-UNIT-0:a");
    expect(next.players.player2).toEqual(s.players.player2);
  });

  it("moveFromExile: 除外されたカードはそのゲーム中戻らない（R-ZONE-11）", () => {
    const s = createTestState({ player1: { exile: [inst("TST-UNIT-0", "e")] } });
    for (const to of ["hand", "discard", "battle", "rush", "power", "command"] as const) {
      expect(moveFromExile(s, "player1", "TST-UNIT-0:e", to)).toBe(s);
    }
  });

  it("findInExile / findCardInAnyZone: 除外ゾーンのカードを見つける", () => {
    const s = createTestState({ player1: { exile: [inst("TST-UNIT-0", "e")], hand: [inst("TST-UNIT-0", "h")] } });
    expect(findInExile(s.players.player1, "TST-UNIT-0:e")?.cardId).toBe("TST-UNIT-0");
    expect(findInExile(s.players.player1, "TST-UNIT-0:h")).toBeUndefined();
    expect(findCardInAnyZone(s, "player1", "TST-UNIT-0:e")?.zone).toBe("exile");
    expect(findCardInAnyZone(s, "player1", "TST-UNIT-0:h")?.zone).toBe("hand");
  });

  it("新しいゲームは両プレイヤーとも除外 0 枚で始まる", () => {
    const s = createTestState();
    expect(s.players.player1.exile ?? []).toEqual([]);
    expect(s.players.player2.exile ?? []).toEqual([]);
  });
});

describe("カード効果での除外（XG3-012【閃光星獣剣】）", () => {
  const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
  const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, [E4000]);

  it("選んだ敵ユニットは相手の除外ゾーンに入り、他のどのゾーンにも残らず、両プレイヤーの枚数は変わらない", () => {
    const s0 = battle({ rush: [inst("XG3-012", "g")] }, { battle: [inst("TST-UNIT-0", "e"), inst("SPEC-E4000", "k")] });
    const before = { p1: allIds(s0, "player1"), p2: allIds(s0, "player2") };
    const s = resolveAll(enter(s0, "XG3-012:g"), ["TST-UNIT-0:e"]);
    expect((s.players.player2.exile ?? []).map((c) => c.instanceId)).toEqual(["TST-UNIT-0:e"]);
    expect(outsideExile(s, "player2", "TST-UNIT-0:e")).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBeNull();
    // 選ばなかったユニットはそのまま。
    expect(zoneOf(s, "player2", "SPEC-E4000:k")).toBe("battle");
    expect(allIds(s, "player1")).toEqual(before.p1);
    expect(allIds(s, "player2")).toEqual(before.p2);
  });

  it("除外されたカードはバトル中の状態（BP 修正・バトル済み）を持ち越さない", () => {
    const s0 = battle({ rush: [inst("XG3-012", "g")] }, { battle: [{ ...inst("TST-UNIT-0", "e"), bpModifier: 2000, battleActed: true }] });
    const s = resolveAll(enter(s0, "XG3-012:g"), ["TST-UNIT-0:e"]);
    const card = findInExile(s.players.player2, "TST-UNIT-0:e");
    expect(card).toBeDefined();
    expect(card!.bpModifier).toBeUndefined();
    expect(card!.battleActed).toBeUndefined();
  });
});
