import type {
  EnterBattleResumeFrom,
  GameState,
  PendingBattle,
  Phase,
  PlayerId,
  ZoneName,
} from "../types/game";

export type { EnterBattleResumeFrom };

/** Phase 2 移行対象のゲーム事実イベント種別。 */
export type GameEventType =
  | "UnitRushed"
  | "UnitEnteredBattle"
  | "BattleDeclared"
  | "StrikeDeclared"
  | "UnitLeftZone"
  | "DamageApplied"
  | "TurnEnding";

/** 全イベント共通のコンテキスト（1 Action 内の解決順序を `seq` で追跡）。 */
export type GameEventBase = {
  id: string;
  seq: number;
  type: GameEventType;
  phasePlayerId: PlayerId;
  activePlayerId: PlayerId;
  phase: Phase;
};

export type UnitRushedEvent = GameEventBase & {
  type: "UnitRushed";
  rusherPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
};

export type UnitEnteredBattleEvent = GameEventBase & {
  type: "UnitEnteredBattle";
  playerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: "rush";
  battlePosition: number;
  battleBeforeEnterInstanceIds: string[];
  rideOff?: boolean;
  resumeFrom?: EnterBattleResumeFrom;
};

export type BattleDeclaredEvent = GameEventBase & {
  type: "BattleDeclared";
  attackerPlayerId: PlayerId;
  attackerInstanceId: string;
  attackerCardId: string;
  defenderPlayerId: PlayerId;
  defenderInstanceId: string;
  defenderCardId: string;
  pending: PendingBattle;
};

export type StrikeDeclaredEvent = GameEventBase & {
  type: "StrikeDeclared";
  strikerPlayerId: PlayerId;
  strikerInstanceId: string;
  strikerCardId: string;
  damage: number;
};

export type UnitLeftZoneEvent = GameEventBase & {
  type: "UnitLeftZone";
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: "rush" | "battle";
  toZone: ZoneName;
};

export type DamageAppliedEvent = GameEventBase & {
  type: "DamageApplied";
  playerId: PlayerId;
  amount: number;
  /** 将来: strike / effect / battle 等の由来識別子。 */
  source?: string;
};

export type TurnEndingEvent = GameEventBase & {
  type: "TurnEnding";
  playerId: PlayerId;
};

export type GameEvent =
  | UnitRushedEvent
  | UnitEnteredBattleEvent
  | BattleDeclaredEvent
  | StrikeDeclaredEvent
  | UnitLeftZoneEvent
  | DamageAppliedEvent
  | TurnEndingEvent;

/** Listener が返す解決結果。`stopResolution` でキュー走査を即停止（Pending 相当）。 */
export type EventListenerResult = {
  state: GameState;
  events?: GameEvent[];
  /** エンジンログ行（applyAction が state.log にマージする）。 */
  logs?: string[];
  stopResolution?: boolean;
  /** UnitEnteredBattle: コンボ選択で進入解決が中断された場合の再開位置。 */
  enterResumeFrom?: EnterBattleResumeFrom;
};

export type EventListener = (
  event: GameEvent,
  state: GameState,
) => EventListenerResult | GameState;

export type EventListenerRegistration = {
  type: GameEventType;
  listener: EventListener;
  id: string;
};

/** `GameState` からイベント共通フィールドを埋める。 */
export function eventContextFromState(
  state: GameState,
  phasePlayerId?: PlayerId,
): Pick<GameEventBase, "phasePlayerId" | "activePlayerId" | "phase"> {
  return {
    phasePlayerId: phasePlayerId ?? state.activePlayer,
    activePlayerId: state.activePlayer,
    phase: state.phase,
  };
}

let nextEventSeq = 0;

export function resetEventSeqForTests(): void {
  nextEventSeq = 0;
}

export function nextEventSeqNumber(): number {
  nextEventSeq += 1;
  return nextEventSeq;
}

export function createEventId(prefix = "evt"): string {
  return `${prefix}_${nextEventSeqNumber()}_${Date.now().toString(36)}`;
}

export function normalizeListenerResult(
  result: EventListenerResult | GameState,
): EventListenerResult {
  if ("turn" in result && "players" in result) {
    return { state: result };
  }
  return result;
}
