/**
 * docs/rules/08-errata.md 用のテストヘルパー。
 *
 * - カード定義はエンジンが実際に使うカタログ（core → full-playable → extended）から引く。
 * - テキスト比較は全角／半角（NFKC）と空白の差だけを無視する（08 章冒頭「全角／半角の数字表記の違いは…無視する」）。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  getCardEffect,
  getExtendedCardById,
  resolvePlayableCard,
} from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  MERGED_DEFINITIONS,
  createTestState,
  inst,
  type TestStateOptions,
} from "../testing/fixtures";

export { inst };

/** 全角／半角・空白の差を無視するための正規化。 */
export function norm(text: string | undefined | null): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, "");
}

/** エンジンが使うカード定義。 */
export function cardDef(id: string): CardDefinition | undefined {
  return resolvePlayableCard(id) ?? getExtendedCardById(id);
}

/** エンジンが使うカードテキスト（定義の text、なければ効果メタの text）。 */
export function engineText(id: string): string {
  const def = cardDef(id);
  if (def?.text?.trim()) return def.text;
  return getCardEffect(id)?.text ?? "";
}

/** 修正後テキスト（の一部）がエンジンのテキストに含まれることを確認する。 */
export function expectCorrectedText(id: string, corrected: string): void {
  expect(cardDef(id), `${id} のカード定義がない`).toBeDefined();
  expect(norm(engineText(id))).toContain(norm(corrected));
}

/** 実カード定義を載せたテスト用状態。 */
export function specState(
  cardIds: string[],
  options: Omit<TestStateOptions, "definitions"> = {},
): GameState {
  const definitions: Record<string, CardDefinition> = { ...MERGED_DEFINITIONS };
  for (const id of cardIds) {
    const def = cardDef(id);
    if (!def) throw new Error(`missing card definition ${id}`);
    definitions[id] = def;
  }
  return createTestState({ ...options, definitions });
}

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.error}`);
  return result.state;
}

export function legal(state: GameState): GameAction[] {
  return getLegalActions(state);
}

export function legalOfType<T extends GameAction["type"]>(
  state: GameState,
  type: T,
): Extract<GameAction, { type: T }>[] {
  return getLegalActions(state).filter(
    (a): a is Extract<GameAction, { type: T }> => a.type === type,
  );
}

/**
 * アクションを適用し、同じプレイヤーのコマンド支払いが求められたら
 * 有効なリリース状態コマンドを先頭から必要数だけ選んで支払う。
 */
export function act(state: GameState, action: GameAction): GameState {
  let next = unwrap(applyAction(state, action));
  for (let i = 0; i < 4; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending) break;
    const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
    if (ids.length < pending.totalNeeded) break;
    next = unwrap(
      applyAction(next, {
        type: "resolve_command_payment",
        playerId: pending.playerId,
        commandInstanceIds: ids,
      }),
    );
  }
  return next;
}

/** 合法手のうち、条件に合うものを1つ選んで適用する（なければ例外）。 */
export function actLegal(
  state: GameState,
  pick: (a: GameAction) => boolean,
): GameState {
  const action = getLegalActions(state).find(pick);
  if (!action) {
    throw new Error(
      `no legal action matched; legal=${getLegalActions(state)
        .map((a) => a.type)
        .join(",")}`,
    );
  }
  return act(state, action);
}

export function zoneIds(
  state: GameState,
  playerId: PlayerId,
  zone: "hand" | "discard" | "power" | "command" | "rush" | "battle" | "operation" | "deck",
): string[] {
  return state.players[playerId][zone].map((c) => c.instanceId);
}

export function released(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: false };
}

export function held(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

/** 表向きパワーを n 枚。 */
export function powerCards(n: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

/** テスト用の S ユニット定義（BP/SP/カテゴリを指定）。 */
export function sUnit(
  id: string,
  options: Partial<CardDefinition> = {},
): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
    ...options,
  } as CardDefinition;
}
