import { describe, expect, it } from "vitest";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@rangers-strike/engine";
import { applyAction, getLegalActions } from "@rangers-strike/engine";
import { godomChoiceNeeded, godomDiscardCandidates, listGodomRushVariants, matchGodomVariant } from "./godomRushUi";

const ALL_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries(
  allCardsCatalog.cards.map((card) => [card.id, card]),
);

function inst(cardId: string, suffix: string): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId };
}

function emptyPlayer(id: PlayerId): PlayerState {
  return { id, deck: [], hand: [], discard: [], power: [], command: [], rush: [], battle: [], operation: [], damage: 0 };
}

/** ゴードム（RS-586）が自軍ラッシュエリアにあり、手札のケガレシア（RS-602。DA・必要パワー3）をパワー1でラッシュする。 */
function godomState(grunts: number): GameState {
  return {
    turn: 1,
    activePlayer: "player1",
    firstPlayer: "player1",
    phase: "rush",
    players: {
      player1: {
        ...emptyPlayer("player1"),
        hand: [inst("RS-602", "k")],
        command: [{ ...inst("RS-604", "cmd"), commandHeld: false }],
        power: [inst("RS-001", "p1")],
        rush: [inst("RS-586", "gd"), ...Array.from({ length: grunts }, (_, i) => inst("RS-604", `g${i}`))],
        deck: [inst("RS-001", "d1"), inst("RS-001", "d2")],
      },
      player2: { ...emptyPlayer("player2"), deck: [inst("RS-001", "e1")] },
    },
    definitions: ALL_DEFINITIONS,
    log: [],
    winner: null,
  };
}

describe("godomRushUi（RS-586【魔神に不足する物】）", () => {
  it("捨札にする「戦闘員」の組が複数あれば、プレイヤーに選ばせる", () => {
    const state = godomState(3);
    const variants = listGodomRushVariants(getLegalActions(state), "RS-602:k");
    expect(variants.length).toBe(3);
    expect(godomChoiceNeeded(variants)).toBe(true);
    const { candidateIds, needed } = godomDiscardCandidates(variants);
    expect(needed).toBe(2);
    expect(candidateIds.sort()).toEqual(["RS-604:g0", "RS-604:g1", "RS-604:g2"]);
  });

  it("選んだ組の宣言でラッシュすると、選んだユニットだけが捨札になる", () => {
    const state = godomState(3);
    const variants = listGodomRushVariants(getLegalActions(state), "RS-602:k");
    const action = matchGodomVariant(variants, ["RS-604:g2", "RS-604:g1"]);
    expect(action).toBeDefined();
    let r = applyAction(state, action!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pending = r.state.pendingCommandPayment!;
    r = applyAction(r.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p1 = r.state.players.player1;
    expect(p1.rush.some((c) => c.instanceId === "RS-602:k")).toBe(true);
    expect(p1.discard.map((c) => c.instanceId).sort()).toEqual(["RS-604:g1", "RS-604:g2"]);
    expect(p1.rush.some((c) => c.instanceId === "RS-604:g0")).toBe(true);
  });

  it("候補がちょうど足りない数なら、選ぶ余地はない（1通り）", () => {
    const variants = listGodomRushVariants(getLegalActions(godomState(2)), "RS-602:k");
    expect(variants.length).toBe(1);
    expect(godomChoiceNeeded(variants)).toBe(false);
  });
});
