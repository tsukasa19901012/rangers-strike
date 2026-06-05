import type { CardDefinition } from "@rangers-strike/cards";
import { getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId, ZoneName } from "@rangers-strike/engine";

const ZONE_LABELS: Record<ZoneName, string> = {
  hand: "手札",
  power: "パワー",
  command: "コマンド",
  rush: "ラッシュ",
  battle: "バトル",
  discard: "捨札",
  deck: "山札",
  operation: "常駐",
};

export type CardTarget = {
  instanceId: string;
  cardId: string;
  card: CardDefinition;
  playerId: PlayerId;
  zone: ZoneName;
  zoneLabel: string;
};

const FIELD_ZONES: ZoneName[] = [
  "hand",
  "power",
  "command",
  "rush",
  "battle",
  "discard",
  "deck",
  "operation",
];

export function findCardTarget(
  state: GameState,
  instanceId: string,
): CardTarget | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of FIELD_ZONES) {
      const inst = player[zone].find((c) => c.instanceId === instanceId);
      if (!inst) continue;
      const card = getCardById(inst.cardId) ?? state.definitions[inst.cardId];
      if (!card) continue;
      return {
        instanceId,
        cardId: inst.cardId,
        card,
        playerId,
        zone,
        zoneLabel: ZONE_LABELS[zone],
      };
    }
  }
  return null;
}

export function resolveCardTargets(
  state: GameState,
  instanceIds: string[],
): CardTarget[] {
  const out: CardTarget[] = [];
  for (const id of instanceIds) {
    const target = findCardTarget(state, id);
    if (target) out.push(target);
  }
  return out;
}

/** Owner label from the choosing player's perspective (e.g. RS-060 ピンクストーム). */
export function cardTargetOwnerLabel(
  target: CardTarget,
  chooserPlayerId: PlayerId,
): "自分" | "相手" {
  return target.playerId === chooserPlayerId ? "自分" : "相手";
}

export function cardTargetMetaLine(
  target: CardTarget,
  chooserPlayerId: PlayerId,
): string {
  return `${cardTargetOwnerLabel(target, chooserPlayerId)} · ${target.zoneLabel}`;
}
