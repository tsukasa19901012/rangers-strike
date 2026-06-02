import type { CardInstance, PlayerId, ZoneName } from "@rangers-strike/engine";
import type { EffectTarget } from "@rangers-strike/cards";

export const DND_MIME = "application/x-rangers-strike-card";

export type DragCardPayload = {
  instanceId: string;
  cardId: string;
  fromZone: ZoneName | "hand";
  playerId: PlayerId;
};

export function serializeDragPayload(payload: DragCardPayload): string {
  return JSON.stringify(payload);
}

export function parseDragPayload(raw: string): DragCardPayload | null {
  try {
    return JSON.parse(raw) as DragCardPayload;
  } catch {
    return null;
  }
}

export type DropTarget =
  | "power"
  | "command"
  | "operation"
  | "rush"
  | "battle";

export type PendingOperation = {
  instanceId: string;
  cardId: string;
  effectId: string;
  targetType: EffectTarget;
};

export type PendingZordRush = {
  instanceId: string;
  cardId: string;
  /** Set after S-unit material tap when command vs discard is required. */
  materialInstanceId?: string;
  materialDestination?: "command" | "discard";
};
