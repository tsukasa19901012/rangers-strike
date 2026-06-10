import { resolvePlayableCard } from "@rangers-strike/cards";
import type { GameState, PendingEffectChoice, PlayerId, ZoneName } from "@rangers-strike/engine";
import { findCardTarget } from "./cardTargets";
import { effectChoiceHint, effectChoiceTitle } from "./effectChoiceHint";

type BoardTapZone = "command" | "power" | "rush" | "battle";

const BOARD_TAP_ZONES = new Set<ZoneName>(["command", "power", "rush", "battle"]);

function isBoardTapZone(zone: ZoneName): zone is BoardTapZone {
  return BOARD_TAP_ZONES.has(zone);
}

export type BoardTapZoneHighlights = {
  command: boolean;
  power: boolean;
  rush: boolean;
  battle: boolean;
};

export type BoardTapEffectChoiceView = {
  title: string;
  hint: string;
  zoneHint: string;
  sourceLine?: string;
  self: BoardTapZoneHighlights;
  opponent: BoardTapZoneHighlights;
};

function emptyHighlights(): BoardTapZoneHighlights {
  return { command: false, power: false, rush: false, battle: false };
}

function zoneOwnerKey(
  targetPlayerId: PlayerId,
  chooserPlayerId: PlayerId,
): "self" | "opponent" {
  return targetPlayerId === chooserPlayerId ? "self" : "opponent";
}

function zoneLabel(zone: ZoneName): string {
  switch (zone) {
    case "command":
      return "コマンドゾーン";
    case "power":
      return "パワーゾーン";
    case "rush":
      return "ラッシュエリア";
    case "battle":
      return "バトルエリア";
    default:
      return zone;
  }
}

function buildZoneHint(
  self: BoardTapZoneHighlights,
  opponent: BoardTapZoneHighlights,
): string {
  const parts: string[] = [];
  const add = (who: "自分" | "相手", highlights: BoardTapZoneHighlights) => {
    for (const zone of ["command", "power", "rush", "battle"] as const) {
      if (highlights[zone]) {
        parts.push(`${who}の${zoneLabel(zone)}`);
      }
    }
  };
  add("相手", opponent);
  add("自分", self);
  if (parts.length === 0) return "対象カードをタップ";
  if (parts.length === 1) return `${parts[0]}のカードをタップ`;
  return `${parts.join("・")}のカードをタップ`;
}

export function analyzeBoardTapEffectChoice(
  state: GameState,
  pending: PendingEffectChoice,
  chooserPlayerId: PlayerId,
): BoardTapEffectChoiceView | null {
  if (pending.kind !== "select_command") return null;
  if (pending.playerId !== chooserPlayerId) return null;
  if (pending.validInstanceIds.length === 0) return null;

  const self = emptyHighlights();
  const opponent = emptyHighlights();

  for (const instanceId of pending.validInstanceIds) {
    const target = findCardTarget(state, instanceId);
    if (!target || !isBoardTapZone(target.zone)) {
      return null;
    }
    const zone = target.zone;
    const board = zoneOwnerKey(target.playerId, chooserPlayerId);
    if (board === "self") {
      self[zone] = true;
    } else {
      opponent[zone] = true;
    }
  }

  const sourceCard = resolvePlayableCard(pending.sourceCardId);
  const sourceLine =
    sourceCard && pending.kind === "select_command"
      ? `「${sourceCard.name}」の効果`
      : undefined;

  return {
    title: effectChoiceTitle(pending),
    hint: effectChoiceHint(pending),
    zoneHint: buildZoneHint(self, opponent),
    sourceLine,
    self,
    opponent,
  };
}

export function effectChoiceSkipLabel(
  pending: PendingEffectChoice,
): string {
  if (pending.effectId === "earth_force") {
    return "アースの力を捨札にする";
  }
  if (pending.kind === "seabed_draw") return "上から引く";
  if (pending.kind === "optional_deck_draw") return "ドローしない";
  if (pending.effectId === "juu_kun_do") return "撃破しない";
  if (pending.effectId === "pit_in_dive") return "発動しない";
  if (pending.effectId === "dolphin_arrow") return "送らない";
  if (pending.effectId === "green_ground") return "戻さない";
  if (pending.effectId === "end_turn_effects") return "発動しない";
  if (pending.effectId === "sagas_sniper") return "手札に加えない";
  return "効果をスキップ";
}
