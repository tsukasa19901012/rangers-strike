/**
 * docs/rules/05-battle-strike-damage.md 用のテストヘルパー。
 * 公開エンジン API（applyAction / getLegalActions / 状態参照）だけでゲーム状況を進める。
 */
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { legendDefinitions } from "../testing/battleEntry";
import { createTestState, inst, type TestStateOptions } from "../testing/fixtures";

export { inst, legendDefinitions };

/** 既定: 先攻 player1 の自軍バトルフェイズ、全レジェンドカード定義。 */
export function battleState(options: TestStateOptions = {}): GameState {
  return createTestState({
    phase: "battle",
    activePlayer: "player1",
    definitions: legendDefinitions,
    ...options,
  });
}

export function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) {
    throw new Error(`${action.type} failed: ${result.error ?? "unknown"}`);
  }
  return result.state;
}

export function canApply(state: GameState, action: GameAction): boolean {
  return applyAction(state, action).ok;
}

export function legal(state: GameState): GameAction[] {
  return getLegalActions(state);
}

export function legalOfType<T extends GameAction["type"]>(
  state: GameState,
  type: T,
): Extract<GameAction, { type: T }>[] {
  return legal(state).filter(
    (a): a is Extract<GameAction, { type: T }> => a.type === type,
  );
}

export function ids(cards: CardInstance[]): string[] {
  return cards.map((c) => c.instanceId);
}

export function cardIds(cards: CardInstance[]): string[] {
  return cards.map((c) => c.cardId);
}

export function find(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { zone: string; card: CardInstance } | undefined {
  const p = state.players[playerId];
  for (const zone of [
    "battle",
    "rush",
    "discard",
    "hand",
    "deck",
    "power",
    "command",
    "operation",
  ] as const) {
    const card = p[zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

export function zoneOf(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): string | undefined {
  return find(state, playerId, instanceId)?.zone;
}

export function enter(
  state: GameState,
  instanceId: string,
  playerId: PlayerId = "player1",
): GameState {
  return act(state, { type: "move_to_battle", playerId, instanceId });
}

export function passEntry(state: GameState, playerId: PlayerId = "player1"): GameState {
  return act(state, { type: "pass_battle_entry", playerId });
}

export function attack(
  state: GameState,
  attackerInstanceId: string,
  defenderInstanceId: string,
  playerId: PlayerId = "player1",
): GameState {
  return act(state, { type: "battle", playerId, attackerInstanceId, defenderInstanceId });
}

export function strike(
  state: GameState,
  instanceId: string,
  playerId: PlayerId = "player1",
): GameState {
  return act(state, { type: "strike", playerId, instanceId });
}

/** 相手側の反応ウィンドウ（バトル／ストライク／ラッシュ／離脱）をすべてパスし、ダメージ支払いも自動で進める。 */
export function settle(state: GameState, maxSteps = 30): GameState {
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    const actions = legal(s);
    const pass =
      actions.find((a) => a.type === "pass_battle_reaction") ??
      actions.find((a) => a.type === "pass_strike_reaction") ??
      actions.find((a) => a.type === "pass_leave_reaction") ??
      actions.find((a) => a.type === "pass_register") ??
      actions.find((a) => a.type === "pass_rush_reaction") ??
      (s.pendingDamagePayment
        ? actions.find((a) => a.type === "resolve_damage_payment")
        : undefined);
    if (!pass) return s;
    s = act(s, pass);
  }
  return s;
}

/** RS-018 等のカウンターを、カテゴリホールド支払い経由で使用する。 */
export function playCounter(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
  commandInstanceIds: string[],
  substituteInstanceId?: string,
): GameState {
  let s = act(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: counterInstanceId,
    substituteInstanceId,
  } as GameAction);
  const need = s.pendingCommandPayment?.totalNeeded ?? 0;
  if (s.pendingCommandPayment) {
    s = act(s, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: commandInstanceIds.slice(0, need),
    });
  }
  return s;
}

/** カウンター使用の開始が合法か（支払いウィンドウを開けるか）。 */
export function canStartCounter(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
): boolean {
  return legal(state).some(
    (a) =>
      a.type === "initiate_command_payment" &&
      a.playerId === playerId &&
      a.sourceInstanceId === counterInstanceId,
  ) ||
    legal(state).some(
      (a) =>
        a.type === "play_counter" &&
        a.playerId === playerId &&
        a.instanceId === counterInstanceId,
    );
}

/** バトル進入時ホールド（RS-097 等）を支払って出る。 */
export function enterWithHold(
  state: GameState,
  instanceId: string,
  commandInstanceIds: string[],
  playerId: PlayerId = "player1",
): GameState {
  let s = act(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "battle_entry",
    sourceInstanceId: instanceId,
  } as GameAction);
  if (s.pendingCommandPayment) {
    const need = s.pendingCommandPayment.totalNeeded;
    s = act(s, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: commandInstanceIds.slice(0, need),
    });
  }
  return s;
}

/** 現在のアクティブプレイヤーのターンを終える（バトル→エンド→相手スタート）。 */
export function endTurn(state: GameState): GameState {
  let s = settle(state);
  const startPlayer = s.activePlayer;
  for (let i = 0; i < 10 && s.activePlayer === startPlayer; i++) {
    const end = legal(s).find((a) => a.type === "end_phase");
    if (!end) break;
    s = act(s, end);
  }
  return s;
}

export function powerCards(count: number, prefix = "pw", faceDown = false): CardInstance[] {
  return Array.from({ length: count }, (_, i) => ({
    ...inst("TST-P", `${prefix}${i}`),
    faceDown,
  }));
}

export function deckCards(count: number, prefix = "dk"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

export function releasedCommands(count: number, cardId = "TST-OP", prefix = "cmd"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst(cardId, `${prefix}${i}`));
}

export function heldCommands(count: number, cardId = "TST-OP", prefix = "hcmd"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => ({
    ...inst(cardId, `${prefix}${i}`),
    commandHeld: true,
  }));
}

export function fillers(count: number, prefix = "fill", cardId = "TST-UNIT-0"): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst(cardId, `${prefix}${i}`));
}

export function ncLogged(state: GameState, cardId: string): boolean {
  return state.log.some((l) => l.includes("number_combo") && l.includes(cardId));
}

export function faceDownCount(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].power.filter((c) => c.faceDown).length;
}

/** あるユニットのストライクが合法か。 */
export function canStrike(state: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(state).some(
    (a) => a.type === "strike" && a.playerId === playerId && a.instanceId === instanceId,
  );
}

/** あるユニットのアタック対象一覧。 */
export function attackTargets(
  state: GameState,
  attackerInstanceId: string,
  playerId: PlayerId = "player1",
): string[] {
  return legal(state)
    .filter(
      (a): a is Extract<GameAction, { type: "battle" }> =>
        a.type === "battle" && a.playerId === playerId && a.attackerInstanceId === attackerInstanceId,
    )
    .map((a) => a.defenderInstanceId);
}
