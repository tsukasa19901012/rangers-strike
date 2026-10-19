/**
 * RS-318 ドギー・クルーガー【出動指令】
 * 「これが自軍ラッシュエリアにある間、敵軍ユニットがラッシュされたとき、そのユニットのカテゴリが「DA」なら、
 * 自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが追加条件を持たない特徴「警察」を
 * 持つSユニットのカードならラッシュエリアに出し、それ以外なら手札に加える。」
 *
 * ルール: R-RUSH-20 — 効果でラッシュエリアに出すのにコマンドのホールドは不要（RS-318 Q1）。
 * ルール: R-ADD-02 — 「－」も「追加条件を持つ」（RS-318 Q3）。
 */
import { recordReveal } from "./revealNotice";
import type { CardDefinition } from "@rangers-strike/cards";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName, getDefinition, unitEffectiveCategories } from "../core/catalog";
import { openEffectChoice } from "./pendingChoices";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { finalizeEffectRush } from "../events/emitUnitRushed";

export const DISPATCH_ORDER_EFFECT_ID = "dispatch_order";
const DOGGIE_CARD_ID = "RS-318";

/** 「追加条件」の欄に記述があるか（「＋」「－」とも）。ルール: R-ADD-02 */
export function hasAdditionalCondition(def: CardDefinition): boolean {
  if (def.rushAdditionalCondition) return true;
  return typeof def.powerCost === "string" && /[+\-＋－]/.test(def.powerCost);
}

/** 敵軍ユニットのラッシュで【出動指令】の選択を開く。 */
export function tryDispatchOrderOnEnemyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.pendingEffectChoice) return state;
  const rushed = findInZone(state.players[rusherPlayerId], "rush", rushedInstanceId);
  if (!rushed) return state;
  // 効果で追加されたカテゴリ（RS-339 闇のヤイバ【闇への誘い】の DA 等）も含める（faq-card-5 RS-318 Q4）。
  if (!unitEffectiveCategories(state, rusherPlayerId, rushed.card, "rush").includes("DA")) {
    return state;
  }
  const ownerId = opponent(rusherPlayerId);
  const owner = state.players[ownerId];
  // ドギー・クルーガーが複数あれば体数分発動する（faq-card-5 RS-318 Q2・R-CONT-01）。
  const doggies = owner.rush.filter((c) => isSameCardIdentity(c.cardId, DOGGIE_CARD_ID));
  if (doggies.length === 0 || owner.deck.length === 0) return state;
  let choice: PendingEffectChoice | undefined;
  for (const doggie of [...doggies].reverse()) {
    choice = {
      playerId: ownerId,
      effectId: DISPATCH_ORDER_EFFECT_ID,
      sourceCardId: doggie.cardId,
      sourceInstanceId: doggie.instanceId,
      kind: "confirm",
      phasePlayerId,
      validInstanceIds: ["reveal"],
      selectedInstanceIds: [],
      optional: true,
      ...(choice ? { resumeChoice: choice } : {}),
    };
  }
  return { ...state, pendingEffectChoice: choice, activePlayer: ownerId };
}

/** 【出動指令】: 山札の上をオモテにして、条件を満たせばラッシュエリア、それ以外は手札へ。 */
export function resolveDispatchOrder(
  state: GameState,
  playerId: PlayerId,
  choice: string,
): { state: GameState; log?: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.effectId !== DISPATCH_ORDER_EFFECT_ID) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (choice !== "reveal") return { error: "invalid_target" };

  const result = revealDispatchOrder(state, playerId, pending);
  // 2体目以降のドギー・クルーガーの【出動指令】（重複）を続けて処理する。
  if (pending.resumeChoice && !result.state.pendingEffectChoice && result.state.players[playerId].deck.length > 0) {
    return { ...result, state: openEffectChoice(result.state, pending.resumeChoice) };
  }
  return result;
}

function revealDispatchOrder(
  state: GameState,
  playerId: PlayerId,
  pending: PendingEffectChoice,
): { state: GameState; log?: string } {
  const cleared: GameState = {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
  };
  const owner = cleared.players[playerId];
  const top = owner.deck[0];
  if (!top) return { state: cleared };
  const def = getDefinition(cleared.definitions, top.cardId);
  const toRush =
    !!def &&
    def.type === "unit" &&
    def.size === "S" &&
    (def.features ?? []).includes("警察") &&
    !hasAdditionalCondition(def);
  const deck = owner.deck.slice(1);
  const nextOwner = toRush
    ? { ...owner, deck, rush: [...owner.rush, top] }
    : { ...owner, deck, hand: [...owner.hand, top] };
  let next: GameState = { ...cleared, ...updatePlayer(cleared, playerId, nextOwner) };
  if (toRush) {
    const rushed = finalizeEffectRush(next, playerId, [top.instanceId], pending.phasePlayerId);
    next = { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] };
  }
  next = recordReveal(next, {
    playerId,
    ownerId: playerId,
    sourceCardId: pending.sourceCardId ?? DOGGIE_CARD_ID,
    effectLabel: "出動指令",
    from: "deck_top",
    matched: toRush,
    cards: [{ instanceId: top.instanceId, cardId: top.cardId, destination: toRush ? "rush" : "hand" }],
  });
  return {
    state: next,
    log: buildLogEntry(
      playerId,
      "named_effect",
      DOGGIE_CARD_ID,
      state.definitions,
      `dispatch_order:${toRush ? "rush" : "hand"}:${cardName(state.definitions, top.cardId)}`,
    ),
  };
}
