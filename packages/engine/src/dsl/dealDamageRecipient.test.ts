/**
 * DSL の受け手（PlayerRef）の回帰テスト。
 *
 * 以前の cardInterpreter は `deal_damage` の target を逆に解決していた
 * （"opponent" → 効果の使用者、"controller" → 相手）。そのため「相手に1点ダメージを与える」の
 * DSL スタブは使用者自身にダメージを与え、一部のデータは補償のため "controller" で書かれていた。
 * また `draw` の player（「相手は1枚ドローしてもよい」= "opponent"）は無視され、常に使用者がドローしていた。
 */
import { describe, expect, it } from "vitest";
import { getCardDslDocument } from "./effectLookup";
import { interpretEffectPrimitives, resolvePlayerRef, type DslCardContext } from "./cardInterpreter";
import { createTestState } from "../testing/fixtures";
import { tryResolveDslTriggeredEffects } from "./triggerResolver";
import {
  confirmIfAsked,
  deckCards,
  enter,
  inst,
  powerCards,
  settle,
  st,
} from "../cardSpec/RS4-201-221.helpers";

function ctx(playerId: "player1" | "player2", phasePlayerId = playerId): DslCardContext {
  return {
    effectId: "test",
    sourceCardId: "RS-TEST",
    playerId,
    phasePlayerId,
    discardOperation: false,
  };
}

describe("cardInterpreter — PlayerRef の解決（回帰）", () => {
  it("resolvePlayerRef: controller = 使用者、opponent = 使用者の相手、phase_player = ターンプレイヤー", () => {
    const c = ctx("player2", "player1");
    expect(resolvePlayerRef(c, "controller")).toBe("player2");
    expect(resolvePlayerRef(c, "opponent")).toBe("player1");
    expect(resolvePlayerRef(c, "phase_player")).toBe("player1");
    expect(resolvePlayerRef(c, "player2")).toBe("player2");
  });

  it.each(["player1", "player2"] as const)(
    "deal_damage target=opponent は使用者（%s）の相手にダメージ、使用者は受けない",
    (user) => {
      const state = createTestState({ player1: { damage: 0 }, player2: { damage: 0 } });
      const out = interpretEffectPrimitives(state, ctx(user, "player1"), [
        { type: "deal_damage", amount: 2, target: "opponent" },
      ]);
      const enemy = user === "player1" ? "player2" : "player1";
      expect(out.state.players[enemy].damage).toBe(2);
      expect(out.state.players[user].damage).toBe(0);
    },
  );

  it("deal_damage target=controller は使用者自身にダメージ（「自分は1点ダメージを受ける」）", () => {
    const state = createTestState({ player1: { damage: 0 }, player2: { damage: 0 } });
    const out = interpretEffectPrimitives(state, ctx("player1"), [
      { type: "deal_damage", amount: 1, target: "controller" },
    ]);
    expect(out.state.players.player1.damage).toBe(1);
    expect(out.state.players.player2.damage).toBe(0);
  });

  it("draw player=opponent は相手がドロー、player 省略時は使用者がドロー", () => {
    const state = createTestState({
      player1: { hand: [], deck: deckCards(3) },
      player2: { hand: [], deck: deckCards(3, "e") },
    });
    const opp = interpretEffectPrimitives(state, ctx("player1"), [
      { type: "draw", amount: 1, player: "opponent" },
    ]);
    expect(opp.state.players.player2.hand).toHaveLength(1);
    expect(opp.state.players.player1.hand).toHaveLength(0);
    const self = interpretEffectPrimitives(state, ctx("player1"), [{ type: "draw", amount: 1 }]);
    expect(self.state.players.player1.hand).toHaveLength(1);
    expect(self.state.players.player2.hand).toHaveLength(0);
  });
});

describe("DSL データの受け手（カード本文と一致）", () => {
  // 本文の受け手はすべて相手（「相手にN点ダメージを与える」「相手は1点ダメージを受けるか…選ぶ」）。
  // 旧データは逆転バグの補償で "controller" になっていた（PR-026/RS-084/RS-462/RS-528/RS-572/XG5-019）。
  it.each(["PR-024", "PR-026", "RS-084", "RS-405", "RS-462", "RS-528", "RS-572", "XG5-019", "XP-008"])(
    "%s の deal_damage は opponent",
    (cardId) => {
      const doc = getCardDslDocument(cardId);
      const targets = (doc?.effects ?? []).flatMap((e) =>
        e.effects.flatMap((p) => (p.type === "deal_damage" ? [p.target] : [])),
      );
      expect(targets.length).toBeGreaterThan(0);
      expect(new Set(targets)).toEqual(new Set(["opponent"]));
    },
  );
});

describe("カード: 「これをラッシュしたとき、相手に1点ダメージを与える」— XP-008 仮面ライダーNEW電王VF【最初に言っておく】", () => {
  // 出典: atwiki page-1719「【最初に言っておく】これをラッシュしたとき、相手に1点ダメージを与える。」
  it("XP-008: ラッシュ時の DSL 効果で相手に1点、自分は0点", () => {
    const s = st({
      player1: { rush: [inst("XP-008", "m")], power: powerCards(4), deck: deckCards(3) },
      player2: { power: powerCards(2, "e"), deck: deckCards(3, "e") },
    });
    const out = tryResolveDslTriggeredEffects({
      state: s,
      cardId: "XP-008",
      instanceId: "XP-008:m",
      playerId: "player1",
      phasePlayerId: "player1",
      triggerType: "on_rush",
    });
    expect(out.handled).toBe(true);
    const after = settle(out.state);
    expect(after.players.player2.damage).toBe(1);
    expect(after.players.player1.damage).toBe(0);
  });
});

describe("カード: 「相手は1点ダメージを受けるか…選ぶ」— RS-572 デカマスター（2nd）【ディーソードベガ】", () => {
  // 出典: atwiki page-1215「自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、
  // 自分自身のユニットを1体選び撃破するかを選ぶ。」敵軍ユニットが無ければ相手は必ずダメージを受ける。
  it("RS-572: 敵軍ユニットが無いとき、相手が1点受け、自分は受けない", () => {
    let s = st({
      player1: { rush: [inst("RS-572", "m")], power: powerCards(2), deck: deckCards(3) },
      player2: { power: powerCards(2, "e"), deck: deckCards(3, "e") },
    });
    s = settle(confirmIfAsked(enter(s, "RS-572:m"), "player1"));
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player1.damage).toBe(0);
  });
});
