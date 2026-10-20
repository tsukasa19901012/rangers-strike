/**
 * cardSpec RS-001〜RS-023（英雄の再誕）用ヘルパー。
 * rulesSpec/08-helpers.ts・02-helpers.ts のパターンを写したもの（他の cardSpec からは import しない）。
 *
 * - カード定義はエンジンが実際に使うカタログ（resolvePlayableCard → extended）から引く。
 * - テキスト比較は全角／半角（NFKC）と空白の差だけを無視する。
 *   加えて、キーワードの注釈行「※常駐（…）」「※カウンター（…）」と「⇒」は、カタログでは
 *   tags（常駐／カウンター）で表しているため比較から外し、tags 側を別に確認する。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  allCardsCatalog,
  getCardEffect,
  getExtendedCardById,
  resolvePlayableCard,
} from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import { buildDefinitionMap, effectiveBp } from "../core/catalog";
import { strikeDamageFor } from "../rules/combo";
import { legendDefinitions } from "../testing/battleEntry";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { createTestState, inst, type TestStateOptions } from "../testing/fixtures";

export { inst };

export function norm(text: string | undefined | null): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, "");
}

/** キーワード注釈（※常駐（…）／※カウンター（…）／（常駐））と「⇒」を外して正規化する。 */
export function normBody(text: string | undefined | null): string {
  return norm(text)
    .replace(/※?常駐\(場に配置して、離れるまで効果が有効になる\)/g, "")
    .replace(/※?カウンター\(これは敵軍ターン中にのみ使用できる\)/g, "")
    .replace(/\(常駐\)/g, "")
    .replace(/⇒/g, "");
}

export function cardDef(id: string): CardDefinition | undefined {
  return resolvePlayableCard(id) ?? getExtendedCardById(id);
}

/** エンジンが使うカードテキスト（定義の text、なければ効果メタの text）。 */
export function engineText(id: string): string {
  const def = cardDef(id);
  if (def?.text?.trim()) return def.text;
  return getCardEffect(id)?.text ?? "";
}

/** カタログ本文が出典（修正後）本文と一致する（注釈行・⇒・全半角・空白は無視）。 */
export function expectSourceText(id: string, source: string): void {
  expect(cardDef(id), `${id} のカード定義がない`).toBeDefined();
  expect(normBody(engineText(id))).toBe(normBody(source));
}

export const EXTRA_DEFS: Record<string, CardDefinition> = {
  "CS-S1": sDef("CS-S1"),
  "CS-S2": sDef("CS-S2", { sp: 2 }),
  "CS-S-NOSP": sDef("CS-S-NOSP", { sp: undefined }),
  "CS-S-ET": sDef("CS-S-ET", { category: "ET" }),
  "CS-S-ET3": sDef("CS-S-ET3", { category: "ET", powerCost: 3, bp: 3000 }),
  "CS-S-ET9": sDef("CS-S-ET9", { category: "ET", powerCost: 9, bp: 9000 }),
  "CS-M": sDef("CS-M", { size: "M", bp: 4000 }),
  "CS-L": sDef("CS-L", { size: "L", bp: 13000, powerCost: 7 }),
  "CS-BIG": sDef("CS-BIG", { size: "M", bp: 9000 }),
  "CS-MECHA": sDef("CS-MECHA", { size: "M", features: ["メカ"] }),
};

export function sDef(id: string, options: Partial<CardDefinition> = {}): CardDefinition {
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

export const DEFS: Record<string, CardDefinition> = {
  ...buildDefinitionMap([allCardsCatalog.cards]),
  ...legendDefinitions,
  ...EXTRA_DEFS,
};

/** 実カード定義（エンジンのカタログ）を載せたテスト用状態。 */
export function specState(
  cardIds: string[],
  options: Omit<TestStateOptions, "definitions"> & {
    extraDefs?: Record<string, CardDefinition>;
  } = {},
): GameState {
  const { extraDefs, ...rest } = options;
  const definitions: Record<string, CardDefinition> = { ...DEFS, ...(extraDefs ?? {}) };
  for (const id of cardIds) {
    const def = cardDef(id);
    if (!def) throw new Error(`missing card definition ${id}`);
    definitions[id] = def;
  }
  return createTestState({ ...rest, definitions });
}

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.error}`);
  return result.state;
}

export function tryAct(state: GameState, action: GameAction): GameState | null {
  const r = applyAction(state, action);
  return r.ok ? r.state : null;
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

/** アクションを適用し、コマンド支払いが求められたら先頭から必要数を支払う。 */
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

export function actLegal(state: GameState, pick: (a: GameAction) => boolean): GameState {
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

export function hasLegal(state: GameState, pick: (a: GameAction) => boolean): boolean {
  return getLegalActions(state).some(pick);
}

type Zone = "hand" | "discard" | "power" | "command" | "rush" | "battle" | "operation" | "deck";

export function zoneIds(state: GameState, playerId: PlayerId, zone: Zone): string[] {
  return state.players[playerId][zone].map((c) => c.instanceId);
}

export function zoneOf(state: GameState, playerId: PlayerId, instanceId: string): Zone | null {
  for (const zone of ["hand", "discard", "power", "command", "rush", "battle", "operation", "deck"] as const) {
    if (state.players[playerId][zone].some((c) => c.instanceId === instanceId)) return zone;
  }
  return null;
}

export function findCard(state: GameState, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  const p = state.players[playerId];
  for (const zone of ["hand", "discard", "power", "command", "rush", "battle", "operation", "deck"] as const) {
    const c = p[zone].find((x) => x.instanceId === instanceId);
    if (c) return c;
  }
  return undefined;
}

export function released(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: false };
}

export function held(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

export function powerCards(n: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

export function deckCards(n: number, prefix = "dk"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

export function bpOf(state: GameState, playerId: PlayerId, instanceId: string): number {
  const card = findCard(state, playerId, instanceId);
  if (!card) throw new Error(`card not found ${instanceId}`);
  return effectiveBp(state, playerId, card);
}

export function spOf(state: GameState, playerId: PlayerId, instanceId: string): number {
  const card = findCard(state, playerId, instanceId);
  if (!card) throw new Error(`card not found ${instanceId}`);
  return strikeDamageFor(state.definitions, card, state, playerId);
}

/** 手札のオペレーションを（対象つきで）使用する。 */
export function playOp(
  state: GameState,
  instanceId: string,
  extra: { targetInstanceId?: string; extraInstanceId?: string } = {},
  playerId: PlayerId = "player1",
): GameState {
  return actLegal(
    state,
    (a) =>
      a.type === "play_operation" &&
      a.playerId === playerId &&
      a.instanceId === instanceId &&
      (extra.targetInstanceId === undefined || a.targetInstanceId === extra.targetInstanceId) &&
      (extra.extraInstanceId === undefined || a.extraInstanceId === extra.extraInstanceId),
  );
}

export function canPlayOp(state: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return hasLegal(
    state,
    (a) =>
      (a.type === "play_operation" && a.instanceId === instanceId && a.playerId === playerId) ||
      (a.type === "initiate_command_payment" &&
        a.playerId === playerId &&
        "sourceInstanceId" in a &&
        a.sourceInstanceId === instanceId),
  );
}

/** カウンター（手札）を使用する: 合法な支払い開始 → 支払い → play_counter。 */
export function playCounter(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  let s = state;
  const pay = getLegalActions(s).find(
    (a) =>
      a.type === "initiate_command_payment" &&
      a.playerId === playerId &&
      a.sourceInstanceId === instanceId,
  );
  if (pay) s = act(s, pay);
  const direct = getLegalActions(s).find(
    (a) => a.type === "play_counter" && a.playerId === playerId && a.instanceId === instanceId,
  );
  if (direct) s = act(s, direct);
  return s;
}

export function canUseCounter(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return hasLegal(
    state,
    (a) =>
      (a.type === "initiate_command_payment" &&
        a.playerId === playerId &&
        a.sourceInstanceId === instanceId) ||
      (a.type === "play_counter" && a.playerId === playerId && a.instanceId === instanceId),
  );
}
