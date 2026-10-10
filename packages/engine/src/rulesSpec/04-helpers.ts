/**
 * 04 ラッシュ章（docs/rules/04-rush.md）ルールテスト用ヘルパー。
 * 公開 API（applyAction / getLegalActions）でゲーム状況を駆動するための薄いラッパーのみ。
 */
import { fullPlayableCatalog, type CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import type { GameAction } from "../types/actions";
import { rushReactorId } from "../core/helpers";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  createTestState,
  inst,
  TEST_DEFINITIONS,
  type TestStateOptions,
} from "../testing/fixtures";
import { wasRushedThisTurn } from "../rules/turnModifiers";

export { inst };

/** 全プレイアブルカード + テスト用カードの定義。 */
export const DEFS: Record<string, CardDefinition> = {
  ...Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c])),
  ...TEST_DEFINITIONS,
};

export function mk(options: TestStateOptions = {}): GameState {
  return createTestState({
    phase: "rush",
    activePlayer: "player1",
    ...options,
    definitions: { ...DEFS, ...(options.definitions ?? {}) },
  });
}

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.error}`);
  return result.state;
}

export function act(state: GameState, action: GameAction): GameState {
  return unwrap(applyAction(state, action));
}

export function legal(state: GameState): GameAction[] {
  return getLegalActions(state);
}

/** n 枚のパワー（TST-OP）。 */
export function powers(n: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

/** リリース状態のコマンド。 */
export function released(cardId: string, suffix: string): CardInstance {
  return inst(cardId, suffix);
}

/** ホールド状態のコマンド。 */
export function held(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

export type RushExtra = Partial<
  Pick<
    Extract<GameAction, { type: "initiate_command_payment" }>,
    | "zordMaterialInstanceId"
    | "zordMaterialInstanceIds"
    | "zordMaterialDestination"
    | "zordMothershipHoldInstanceIds"
    | "zordExtraCommandHoldInstanceIds"
  >
>;

/**
 * 手札から通常ラッシュ: カテゴリホールド支払い（category_use）を開始し、
 * 指定コマンドで支払う。失敗時は { ok:false } を返す。
 */
export function tryRushFromHand(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceIds: string[],
  extra: RushExtra = {},
): ReturnType<typeof applyAction> {
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: unitInstanceId,
    ...extra,
  });
  if (!initiated.ok) return initiated;
  let next = initiated.state;
  let remaining = [...commandInstanceIds];
  for (let i = 0; i < 6; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending || pending.playerId !== playerId) break;
    const take = remaining.slice(0, pending.totalNeeded);
    remaining = remaining.slice(pending.totalNeeded);
    const resolved = applyAction(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: take,
    });
    if (!resolved.ok) return resolved;
    next = resolved.state;
  }
  return { ok: true, state: next } as ReturnType<typeof applyAction>;
}

export function rushFromHand(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceIds: string[],
  extra: RushExtra = {},
): GameState {
  return unwrap(tryRushFromHand(state, playerId, unitInstanceId, commandInstanceIds, extra));
}

/** 手札からラッシュ開始が合法手に含まれるか（category_use 支払い開始）。 */
export function canStartRush(state: GameState, playerId: PlayerId, unitInstanceId: string): boolean {
  return legal(state).some(
    (a) =>
      (a.type === "initiate_command_payment" &&
        a.kind === "category_use" &&
        a.playerId === playerId &&
        a.sourceInstanceId === unitInstanceId) ||
      (a.type === "rush" && a.playerId === playerId && a.instanceId === unitInstanceId) ||
      (a.type === "begin_zord_setup" &&
        a.playerId === playerId &&
        a.zordInstanceId === unitInstanceId),
  );
}

/** そのインスタンスが今ターン「ラッシュされた」扱いか（ラッシュ記録の観測）。 */
export function rushedThisTurn(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return wasRushedThisTurn(state.players[playerId], instanceId);
}

export function zoneOf(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): string | null {
  const p = state.players[playerId];
  for (const zone of [
    "hand",
    "deck",
    "discard",
    "power",
    "command",
    "rush",
    "battle",
    "operation",
    "exile",
  ] as const) {
    if (p[zone]?.some((c) => c.instanceId === instanceId)) return zone;
  }
  return null;
}

export function cardIn(
  state: GameState,
  playerId: PlayerId,
  zone: "hand" | "deck" | "discard" | "power" | "command" | "rush" | "battle" | "operation",
  instanceId: string,
): CardInstance | undefined {
  return state.players[playerId][zone].find((c) => c.instanceId === instanceId);
}

/** 疾風流超忍法（RS-026, MA カウンター）を構えた相手側プレイヤー設定。 */
export function counterReadyOpponent(extra: Partial<GameState["players"]["player2"]> = {}) {
  return {
    hand: [inst("RS-026", "shippu")],
    command: [released("TST-OP-MA", "ma-cmd")],
    power: powers(4, "opp-pw"),
    ...extra,
  };
}

/** 相手（player2）が疾風流超忍法を使える合法手があるか。 */
export function opponentCanCounterRush(state: GameState): boolean {
  return legal(state).some(
    (a) =>
      a.playerId === "player2" &&
      ((a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-026:shippu") ||
        (a.type === "play_counter" && a.instanceId === "RS-026:shippu")),
  );
}

/** 保留中のコマンド支払いを、validInstanceIds の先頭から必要枚数選んで解決する。 */
export function payPendingFirst(state: GameState, playerId: PlayerId): GameState {
  let next = state;
  for (let i = 0; i < 8; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending || pending.playerId !== playerId) break;
    next = act(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
    });
  }
  return next;
}

/**
 * バトルエリアへ出す（battle_entry のホールド支払いが合法手にあればそれを使い、
 * 無ければ move_to_battle）。失敗時は { ok:false }。
 */
export function tryEnterBattle(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
): ReturnType<typeof applyAction> {
  // battle_entry のホールド支払いは合法手一覧に列挙されない（UI が自動で開始する）ため直接試す。
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "battle_entry",
    sourceInstanceId: unitInstanceId,
  });
  if (initiated.ok && initiated.state.pendingCommandPayment) {
    try {
      return { ok: true, state: payPendingFirst(initiated.state, playerId) } as ReturnType<
        typeof applyAction
      >;
    } catch (e) {
      return { ok: false, error: String(e) } as ReturnType<typeof applyAction>;
    }
  }
  return applyAction(state, { type: "move_to_battle", playerId, instanceId: unitInstanceId });
}

/** バトル進入のために要求されるホールド枚数（battle_entry 支払いの totalNeeded。不要なら 0、出られなければ null）。 */
export function battleEntryHoldsRequired(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
): number | null {
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "battle_entry",
    sourceInstanceId: unitInstanceId,
  });
  if (initiated.ok && initiated.state.pendingCommandPayment) {
    return initiated.state.pendingCommandPayment.totalNeeded;
  }
  const direct = legal(state).some(
    (a) => a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === unitInstanceId,
  );
  return direct ? 0 : null;
}

export function heldCount(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].command.filter((c) => c.commandHeld).length;
}

/** ゾード（追加条件付き）ラッシュをウィザード経由で行う。 */
export function tryRushZord(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  choice: {
    destination?: "command" | "discard";
    material?: string;
    mothership?: boolean;
  },
  commandInstanceIds: string[],
): ReturnType<typeof applyAction> {
  const fail = (error: string) => ({ ok: false, error }) as ReturnType<typeof applyAction>;
  let r = applyAction(state, { type: "begin_zord_setup", playerId, zordInstanceId: unitInstanceId });
  if (!r.ok) return r;
  let next = r.state;
  for (let i = 0; i < 6 && next.pendingZordSetup; i += 1) {
    const setup = next.pendingZordSetup;
    if (setup.step === "destination") {
      if (!choice.destination) return fail("destination_required");
      r = applyAction(next, { type: "resolve_zord_setup", playerId, destination: choice.destination });
    } else if (setup.step === "material") {
      if (choice.mothership && !choice.material) {
        r = applyAction(next, { type: "resolve_zord_setup", playerId, paymentPath: "mothership" });
      } else {
        if (!choice.material) return fail("material_required");
        r = applyAction(next, {
          type: "resolve_zord_setup",
          playerId,
          materialInstanceId: choice.material,
        });
      }
    } else {
      r = applyAction(next, { type: "resolve_zord_setup", playerId });
    }
    if (!r.ok) return r;
    next = r.state;
  }
  let remaining = [...commandInstanceIds];
  for (let i = 0; i < 6; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending || pending.playerId !== playerId) break;
    const take = remaining.slice(0, pending.totalNeeded);
    remaining = remaining.slice(pending.totalNeeded);
    r = applyAction(next, { type: "resolve_command_payment", playerId, commandInstanceIds: take });
    if (!r.ok) return r;
    next = r.state;
  }
  return { ok: true, state: next } as ReturnType<typeof applyAction>;
}

/** 指定プレイヤーが指定カウンターを使える合法手があるか。 */
export function canCounter(state: GameState, playerId: PlayerId, counterInstanceId: string): boolean {
  return legal(state).some(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "initiate_command_payment" && a.sourceInstanceId === counterInstanceId) ||
        (a.type === "play_counter" && a.instanceId === counterInstanceId)),
  );
}

/** ラッシュ反応窓が開いていれば防御側がパスして閉じる。 */
export function passRushWindow(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 4 && next.pendingRush; i += 1) {
    const defender = rushReactorId(next.pendingRush);
    next = act(next, { type: "pass_rush_reaction", playerId: defender });
  }
  return next;
}
