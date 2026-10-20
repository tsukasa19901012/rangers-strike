import { describe, expect, it } from "vitest";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@rangers-strike/engine";
import { applyAction } from "@rangers-strike/engine";
import { buildRevealNoticeView, pickNewReveal } from "./revealNoticeUi";

const ALL_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries(
  allCardsCatalog.cards.map((card) => [card.id, card]),
);

function inst(cardId: string, suffix: string): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId };
}

function emptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    damage: 0,
  };
}

/** RK-135 仮面ライダードレイクMF【潜行捜索】の数字宣言待ち。 */
function senkoSosaPending(actor: PlayerId, bottom: CardInstance): GameState {
  const self = inst("RK-135", "self");
  const players = {
    player1: emptyPlayer("player1"),
    player2: emptyPlayer("player2"),
  };
  players[actor] = {
    ...players[actor],
    battle: [self],
    deck: [inst("XG3-066", "d0"), bottom],
  };
  return {
    turn: 1,
    activePlayer: actor,
    firstPlayer: actor,
    phase: "battle",
    players,
    definitions: ALL_DEFINITIONS,
    log: [],
    winner: null,
    pendingEffectChoice: {
      playerId: actor,
      effectId: "senko_sosa_declare",
      sourceCardId: "RK-135",
      sourceInstanceId: self.instanceId,
      phasePlayerId: actor,
      kind: "declare_number",
      validInstanceIds: Array.from({ length: 13 }, (_, i) => String(i)),
      selectCount: 1,
      optional: true,
    },
  } as GameState;
}

function declare(state: GameState, playerId: PlayerId, n: number): GameState {
  const r = applyAction(state, {
    type: "resolve_effect_choice",
    playerId,
    instanceId: String(n),
  });
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(String(r.error));
  return r.state;
}

describe("revealNoticeUi", () => {
  it("潜行捜索で山札の下からオモテにしたカードを、使った本人に名前・必要パワー・行き先つきで見せる", () => {
    const bottom = inst("RK-135", "bottom"); // 必要パワー 1
    const after = declare(senkoSosaPending("player1", bottom), "player1", 1);

    const reveal = pickNewReveal(after, 0);
    expect(reveal).not.toBeNull();
    const view = buildRevealNoticeView(reveal!, after.definitions, "player1");
    expect(view.title).toBe("【潜行捜索】公開");
    expect(view.summary).toBe("自分が山札の下から1枚オモテにしました");
    expect(view.declaredText).toBe("宣言した数字: 1 → 一致");
    expect(view.cards).toEqual([
      {
        instanceId: bottom.instanceId,
        cardId: "RK-135",
        name: ALL_DEFINITIONS["RK-135"]!.name,
        powerCostText: String(ALL_DEFINITIONS["RK-135"]!.powerCost),
        destinationLabel: "手札に加えた",
      },
    ]);
  });

  it("相手（CPU）が潜行捜索を使ったときも、こちらに公開カードと山札の下に戻したことを見せる", () => {
    const bottom = inst("RK-135", "bottom");
    const after = declare(senkoSosaPending("player2", bottom), "player2", 5);

    const view = buildRevealNoticeView(pickNewReveal(after, 0)!, after.definitions, "player1");
    expect(view.summary).toBe("相手が山札の下から1枚オモテにしました");
    expect(view.declaredText).toBe("宣言した数字: 5 → 不一致");
    expect(view.cards[0]?.name).toBe(ALL_DEFINITIONS["RK-135"]!.name);
    expect(view.cards[0]?.destinationLabel).toBe("山札の下に戻した");
  });

  it("表示済みの公開は二度出さない", () => {
    const bottom = inst("RK-135", "bottom");
    const after = declare(senkoSosaPending("player1", bottom), "player1", 1);
    const seq = after.lastReveal!.seq;
    expect(pickNewReveal(after, seq)).toBeNull();
    expect(pickNewReveal({ lastReveal: undefined }, 0)).toBeNull();
  });
});
