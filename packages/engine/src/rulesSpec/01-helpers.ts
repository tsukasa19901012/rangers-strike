/**
 * docs/rules/01-overview-deck.md 用のテストヘルパー。
 * エンジンの公開 API（applyAction / getLegalActions / createGame）だけで局面を進める。
 */
import {
  allCardsCatalog,
  type CardCatalog,
  type CardDefinition,
  type DeckEntry,
} from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { inst } from "../testing/fixtures";

export function def(id: string, catalog: CardCatalog = allCardsCatalog): CardDefinition {
  const card = catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing card ${id}`);
  return card;
}

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** ウラ向き（ダメージ）のパワーカードを n 枚。 */
export function faceDownPower(prefix: string, n: number): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({ ...inst("TST-P", `${prefix}${i}`), faceDown: true }));
}

export function deckOf(prefix: string, n: number, cardId = "TST-OP"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst(cardId, `${prefix}${i}`));
}

/**
 * 同名カードが重ならない（コマンダー以外の）ユニット/オペレーションを n 種類。
 * 名前は wiki 区別表記を除いた素の名前で重複排除する。
 */
export function distinctNamedCards(
  n: number,
  catalog: CardCatalog = allCardsCatalog,
  filter: (c: CardDefinition) => boolean = () => true,
  excludeNames: string[] = [],
): CardDefinition[] {
  const seen = new Set<string>(excludeNames);
  const out: CardDefinition[] = [];
  for (const card of catalog.cards) {
    if (card.type === "commander") continue;
    if (card.text?.includes("好きな枚数入れてもよい") || card.text?.includes("3枚以上入れてもよい")) continue;
    if (!filter(card)) continue;
    const base = card.name.replace(/（[^）]*）$/, "");
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(card);
    if (out.length >= n) break;
  }
  if (out.length < n) throw new Error(`only ${out.length} distinct cards`);
  return out;
}

/** 別名の 3 枚ずつで合計 total 枚になるデッキエントリ（端数は最後の種類で調整）。 */
export function fillerEntries(
  total: number,
  excludeNames: string[] = [],
  catalog: CardCatalog = allCardsCatalog,
  filter?: (c: CardDefinition) => boolean,
): DeckEntry[] {
  const kinds = Math.ceil(total / 3);
  const cards = distinctNamedCards(kinds, catalog, filter, excludeNames);
  const entries: DeckEntry[] = [];
  let remaining = total;
  for (const card of cards) {
    const count = Math.min(3, remaining);
    if (count <= 0) break;
    entries.push({ cardId: card.id, count });
    remaining -= count;
  }
  return entries;
}

const STEP_PRIORITY: GameAction["type"][] = [
  "draw",
  "return_all_battle_to_rush",
  "release_start_commands",
  "skip_bonus_draw",
  "end_phase",
];

/**
 * フェイズ進行に必要な最小限の行動（ドロー・終了宣言など）だけを選んで、
 * predicate が真になるまで進める。
 */
export function advanceUntil(
  state: GameState,
  predicate: (s: GameState) => boolean,
  maxSteps = 60,
): GameState {
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    if (predicate(current) || current.winner) return current;
    const legal = getLegalActions(current);
    let action: GameAction | undefined;
    for (const type of STEP_PRIORITY) {
      action = legal.find((a) => a.type === type);
      if (action) break;
    }
    if (!action) throw new Error(`no progress action in phase ${current.phase}`);
    current = unwrap(applyAction(current, action));
  }
  throw new Error("advanceUntil: max steps exceeded");
}

export function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}
