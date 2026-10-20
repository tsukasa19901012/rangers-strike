/**
 * 06-effects-timing ルール仕様テスト用ヘルパ（公開 API のみ使用）。
 */
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { legendDefinitions } from "../testing/battleEntry";
import { createTestState, inst } from "../testing/fixtures";
import type { TestStateOptions } from "../testing/fixtures";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId, ZoneName } from "../types/game";

export { applyAction, getLegalActions, inst };
export type { GameAction, GameState, CardInstance, PlayerId };

export const defs = legendDefinitions;

/** legend1〜3 の実カード定義入りテスト状態。 */
export function st(options: TestStateOptions = {}): GameState {
  return createTestState({ definitions: { ...defs }, ...options });
}

/** 成功を前提にアクションを適用する。 */
export function run(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`${action.type} failed: ${result.error ?? "unknown"}`);
  return result.state;
}

/** アクションを試し、成否を返す。 */
export function tryRun(state: GameState, action: GameAction): GameState | null {
  const result = applyAction(state, action);
  return result.ok ? result.state : null;
}

export function legal(state: GameState): GameAction[] {
  return getLegalActions(state);
}

export function legalOf<T extends GameAction["type"]>(
  state: GameState,
  type: T,
): Extract<GameAction, { type: T }>[] {
  return legal(state).filter((a) => a.type === type) as Extract<GameAction, { type: T }>[];
}

export function ids(state: GameState, player: PlayerId, zone: ZoneName): string[] {
  const cards = (state.players[player][zone] ?? []) as CardInstance[];
  return cards.map((c) => c.instanceId);
}

export function inZone(
  state: GameState,
  player: PlayerId,
  zone: ZoneName,
  instanceId: string,
): boolean {
  return ids(state, player, zone).includes(instanceId);
}

export function card(
  state: GameState,
  player: PlayerId,
  zone: ZoneName,
  instanceId: string,
): CardInstance | undefined {
  const cards = (state.players[player][zone] ?? []) as CardInstance[];
  return cards.find((c) => c.instanceId === instanceId);
}

/** n 枚の表向きパワー。 */
export function powers(n: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

/** n 枚のデッキカード。 */
export function deck(n: number, prefix = "dk"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

/** 指定カードIDのリリース状態コマンド。 */
export function cmd(cardId: string, suffix: string, held = false): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: held };
}

/**
 * 合法手からカード使用アクションを探して実行する（カテゴリホールド支払い込み）。
 * extra に target/substitute を指定するとその値が一致する手だけを使う。
 */
export function use(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  extra: { targetInstanceId?: string; substituteInstanceId?: string } = {},
): GameState {
  const matches = (a: Record<string, unknown>) =>
    (extra.targetInstanceId === undefined || a.targetInstanceId === extra.targetInstanceId) &&
    (extra.substituteInstanceId === undefined ||
      a.substituteInstanceId === extra.substituteInstanceId);
  const actions = legal(state) as unknown as Record<string, unknown>[];
  const pays = actions.filter(
    (a) =>
      a.type === "initiate_command_payment" &&
      a.playerId === playerId &&
      a.sourceInstanceId === sourceInstanceId,
  );
  const pay =
    pays.find(matches) ?? (pays[0] ? { ...pays[0], ...extra } : undefined);
  if (pay) {
    let next = run(state, pay as unknown as GameAction);
    const pending = next.pendingCommandPayment;
    if (pending && pending.playerId === playerId) {
      next = run(next, {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
      });
    }
    return next;
  }
  const directs = actions.filter(
    (a) =>
      (a.type === "play_operation" || a.type === "play_counter" || a.type === "rush") &&
      a.playerId === playerId &&
      a.instanceId === sourceInstanceId,
  );
  const direct =
    directs.find(matches) ?? (directs[0] ? { ...directs[0], ...extra } : undefined);
  if (!direct) throw new Error(`no legal use of ${sourceInstanceId}`);
  return run(state, direct as unknown as GameAction);
}

/** sourceInstanceId を使う合法手があるか。 */
export function canUse(state: GameState, playerId: PlayerId, sourceInstanceId: string): boolean {
  return (legal(state) as unknown as Record<string, unknown>[]).some(
    (a) =>
      a.playerId === playerId &&
      (a.sourceInstanceId === sourceInstanceId || a.instanceId === sourceInstanceId) &&
      ["initiate_command_payment", "play_operation", "play_counter", "rush"].includes(
        a.type as string,
      ),
  );
}

/** ターンプレイヤーが end_phase を繰り返してターンを終える（保留中の選択は先頭の合法手で進める）。 */
export function endTurn(state: GameState): GameState {
  const player = state.activePlayer;
  let s = state;
  for (let i = 0; i < 20 && s.activePlayer === player && !s.winner; i += 1) {
    const actions = legal(s);
    const end = actions.find((a) => a.type === "end_phase" && a.playerId === player);
    const next = end ?? actions[0];
    if (!next) break;
    s = run(s, next);
  }
  return s;
}

/** カウンター/オペレーションをカテゴリホールド支払い込みで使用する。 */
export function payAndUse(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  commandInstanceIds: string[],
  extra: { targetInstanceId?: string; substituteInstanceId?: string } = {},
): GameState {
  const initiated = run(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId,
    ...extra,
  });
  if (!initiated.pendingCommandPayment) return initiated;
  return run(initiated, {
    type: "resolve_command_payment",
    playerId,
    commandInstanceIds,
  });
}
