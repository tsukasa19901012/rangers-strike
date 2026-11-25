/**
 * 「選ばれない」の個別の確認（notSelectableAllCards.test.ts の補足。2026-11-25 の報告「パトアーマーの効果で選ばれないサソードRFを
 * 選ぶことができる」の横展開）。盤面は effectBoard.ts。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { allFieldCards, checkEnterBattle, checkOnRush, mk, type Probe, type Tweak } from "./effectBoard";

const def = (id: string) => allFieldCards.find((d) => d.id === id) as CardDefinition;
const P = (id: string, tag: string, extra: Partial<CardInstance> = {}) => mk(id, { instanceId: `${id}~P${tag}`, ...extra });
const enemy = (zones: Partial<GameState["players"]["player2"]>): Tweak => (s) => ({
  ...s,
  players: { ...s.players, player2: { ...s.players.player2, ...zones } },
});
const zoneOf = (s: GameState, id: string) => {
  for (const [z, v] of Object.entries(s.players.player2)) if (Array.isArray(v) && v.some((c: CardInstance) => c?.instanceId === id)) return z;
  return null;
};
const offered = (): { ids: Set<string>; probe: Probe } => {
  const ids = new Set<string>();
  return { ids, probe: { see: (s) => (s.pendingEffectChoice?.validInstanceIds ?? []).forEach((id) => ids.add(id)) } };
};

describe("「選ばれない」の横展開（2026-11-25）", () => {
  it("RS-319【ディーソードベガ】「BPの下三桁が500の敵軍Sユニットをすべて撃破する」は選んでいないので、XG3-066 サソードRF（BP2500）も撃破する", () => {
    const o = checkEnterBattle(def("RS-319"), "first", undefined, enemy({ battle: [P("XG3-066", "b")], rush: [] }));
    expect(o.state && zoneOf(o.state, "XG3-066~Pb")).toBe("discard");
  });

  it("RS-679 シンケンオー【ダイシンケン】「相手は自分自身のバトルエリアからユニットを1体選び」: ブレイカー持ちは持ち主でも選べない（R-KW-BREAKER-03）", () => {
    const o = checkEnterBattle(def("RS-679"), "first", undefined, enemy({ battle: [P("XG6-035", "b"), P("RK-135", "b")], rush: [] }));
    expect(o.state && zoneOf(o.state, "XG6-035~Pb")).toBe("battle");
    expect(o.state && zoneOf(o.state, "RK-135~Pb")).toBe("power");
  });

  it("RS-046 パトアーマー: ブレイカー持ちは選べない。XG7-023 サイダイオー（ブレイカー持ち）の効果では選べる（R-KW-BREAKER-01）", () => {
    const a = offered();
    checkOnRush(def("RS-046"), "first", undefined, enemy({ battle: [P("XG6-035", "b"), P("RK-135", "b")] }), a.probe);
    expect(a.ids.has("RK-135~Pb")).toBe(true);
    expect(a.ids.has("XG6-035~Pb")).toBe(false);
    const b = offered();
    checkEnterBattle(def("XG7-023"), "first", undefined, enemy({ battle: [P("XG6-035", "b")] }), b.probe);
    expect(b.ids.has("XG6-035~Pb")).toBe(true);
  });

  it("RS-620 ジェットガルーダ【ガルーダクロー】: オモテ向きの敵軍パワーの XG3-066 サソードRF は選べない（docs/rules/README.md §5.7 j）", () => {
    const a = offered();
    checkOnRush(def("RS-620"), "first", undefined, enemy({ power: [P("XG3-066", "p", { faceDown: false }), P("RK-135", "p", { faceDown: false })] }), a.probe);
    expect(a.ids.has("RK-135~Pp")).toBe(true);
    expect(a.ids.has("XG3-066~Pp")).toBe(false);
  });

  it("XG2-051 地のエル【塵は塵に】: 敵軍捨札の XG3-066 サソードRF は選べない", () => {
    const a = offered();
    checkOnRush(def("XG2-051"), "first", undefined, enemy({ discard: [P("XG3-066", "d"), P("RK-135", "d")] }), a.probe);
    expect(a.ids.has("RK-135~Pd")).toBe(true);
    expect(a.ids.has("XG3-066~Pd")).toBe(false);
  });
});
