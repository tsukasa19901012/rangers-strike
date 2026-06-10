import type { EnterBattleResumeFrom, GameState, PendingBattle, PlayerId } from "../types/game";
import type {
  BattleDeclaredEvent,
  DamageAppliedEvent,
  GameEvent,
  StrikeDeclaredEvent,
  TurnEndingEvent,
  UnitEnteredBattleEvent,
  UnitLeftZoneEvent,
  UnitRushedEvent,
} from "./types";
import { createEventId, eventContextFromState, nextEventSeqNumber } from "./types";

type EventBaseInput = {
  state: GameState;
  phasePlayerId?: PlayerId;
  id?: string;
  seq?: number;
};

function baseFields(input: EventBaseInput) {
  return {
    id: input.id ?? createEventId(),
    seq: input.seq ?? nextEventSeqNumber(),
    ...eventContextFromState(input.state, input.phasePlayerId),
  };
}

export function buildUnitRushedEvent(
  input: EventBaseInput & {
    rusherPlayerId: PlayerId;
    instanceId: string;
    cardId: string;
  },
): UnitRushedEvent {
  return {
    type: "UnitRushed",
    ...baseFields(input),
    rusherPlayerId: input.rusherPlayerId,
    instanceId: input.instanceId,
    cardId: input.cardId,
  };
}

export function buildUnitEnteredBattleEvent(
  input: EventBaseInput & {
    playerId: PlayerId;
    instanceId: string;
    cardId: string;
    battlePosition: number;
    battleBeforeEnterInstanceIds: string[];
    rideOff?: boolean;
    resumeFrom?: EnterBattleResumeFrom;
  },
): UnitEnteredBattleEvent {
  return {
    type: "UnitEnteredBattle",
    ...baseFields(input),
    playerId: input.playerId,
    instanceId: input.instanceId,
    cardId: input.cardId,
    fromZone: "rush",
    battlePosition: input.battlePosition,
    battleBeforeEnterInstanceIds: input.battleBeforeEnterInstanceIds,
    rideOff: input.rideOff,
    resumeFrom: input.resumeFrom,
  };
}

export function buildBattleDeclaredEvent(
  input: EventBaseInput & {
    attackerPlayerId: PlayerId;
    attackerInstanceId: string;
    attackerCardId: string;
    defenderPlayerId: PlayerId;
    defenderInstanceId: string;
    defenderCardId: string;
    pending: PendingBattle;
  },
): BattleDeclaredEvent {
  return {
    type: "BattleDeclared",
    ...baseFields(input),
    attackerPlayerId: input.attackerPlayerId,
    attackerInstanceId: input.attackerInstanceId,
    attackerCardId: input.attackerCardId,
    defenderPlayerId: input.defenderPlayerId,
    defenderInstanceId: input.defenderInstanceId,
    defenderCardId: input.defenderCardId,
    pending: input.pending,
  };
}

export function buildStrikeDeclaredEvent(
  input: EventBaseInput & {
    strikerPlayerId: PlayerId;
    strikerInstanceId: string;
    strikerCardId: string;
    damage: number;
  },
): StrikeDeclaredEvent {
  return {
    type: "StrikeDeclared",
    ...baseFields(input),
    strikerPlayerId: input.strikerPlayerId,
    strikerInstanceId: input.strikerInstanceId,
    strikerCardId: input.strikerCardId,
    damage: input.damage,
  };
}

export function buildUnitLeftZoneEvent(
  input: EventBaseInput & {
    ownerPlayerId: PlayerId;
    instanceId: string;
    cardId: string;
    fromZone: "rush" | "battle";
    toZone: UnitLeftZoneEvent["toZone"];
  },
): UnitLeftZoneEvent {
  return {
    type: "UnitLeftZone",
    ...baseFields(input),
    ownerPlayerId: input.ownerPlayerId,
    instanceId: input.instanceId,
    cardId: input.cardId,
    fromZone: input.fromZone,
    toZone: input.toZone,
  };
}

export function buildDamageAppliedEvent(
  input: EventBaseInput & {
    playerId: PlayerId;
    amount: number;
    source?: string;
  },
): DamageAppliedEvent {
  return {
    type: "DamageApplied",
    ...baseFields(input),
    playerId: input.playerId,
    amount: input.amount,
    source: input.source,
  };
}

export function buildTurnEndingEvent(
  input: EventBaseInput & {
    playerId: PlayerId;
  },
): TurnEndingEvent {
  return {
    type: "TurnEnding",
    ...baseFields(input),
    playerId: input.playerId,
  };
}

export function isGameEvent(value: unknown): value is GameEvent {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: string }).type;
  return (
    type === "UnitRushed" ||
    type === "UnitEnteredBattle" ||
    type === "BattleDeclared" ||
    type === "StrikeDeclared" ||
    type === "UnitLeftZone" ||
    type === "DamageApplied" ||
    type === "TurnEnding"
  );
}
