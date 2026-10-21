// Graphical board view model (card tiles in zone rows) and its fixed geometry.
// Renderers place every element at the rectangles computed here, and
// hitTestGui uses the same rectangles, so touch always matches what is drawn.
//
// Screen (480x272 logical, Vita draws it at 2x):
//   [detail 118] [board: CPU rush/battle, own battle/rush/command, hand] [phase + end button 50]
import type { CardInstance, EngineApi, GameAction, GameState, PlayerId } from "../engineApi";
import { CPU, HUMAN } from "../engineApi";
import { PHASE_LABELS, PLAYER_LABELS } from "../text/labels";
import { clipLine, type WrapOptions } from "../text/wrap";
import type { Rect, Viewport } from "./layout";

export type GuiZone = "battle" | "rush" | "command" | "hand";

export type GuiRowKey = `${PlayerId}:${GuiZone}`;

export type GuiRowDef = { player: PlayerId; zone: GuiZone };

/** Rows from top to bottom. CPU command / power / operation and both piles are shown as counts in the strips. */
export const GUI_ROWS: readonly GuiRowDef[] = [
  { player: CPU, zone: "rush" },
  { player: CPU, zone: "battle" },
  { player: HUMAN, zone: "battle" },
  { player: HUMAN, zone: "rush" },
  { player: HUMAN, zone: "command" },
  { player: HUMAN, zone: "hand" },
];

export const PHASE_ORDER = ["start", "charge", "rush", "battle", "end"] as const;

export type GuiTileKind = "unit" | "command" | "operation" | "other" | "hidden";

export type GuiTile = {
  instanceId: string;
  cardId: string;
  /** Name clipped to the tile width (empty for hidden cards). */
  name: string;
  /** Second line: BP for units, a short type tag otherwise. */
  sub: string;
  kind: GuiTileKind;
  held: boolean;
  /** The human has at least one legal action that names this card. */
  actionable: boolean;
  /** Already picked in the pending effect choice. */
  selected: boolean;
  /** Board rows: the vehicle this unit rides (it is the tile just before; the two are drawn stacked). */
  ridingOn?: string;
};

export type GuiRow = {
  key: GuiRowKey;
  player: PlayerId;
  zone: GuiZone;
  tiles: GuiTile[];
};

export type GuiGeometry = {
  width: number;
  height: number;
  fontPx: number;
  lineHeight: number;
  topBar: Rect;
  footer: Rect;
  detail: Rect;
  board: Rect;
  side: Rect;
  /** One strip per player, CPU first. */
  strips: [Rect, Rect];
  rows: Rect[];
  /** Which zone each of `rows` shows; GUI_ROWS when absent. */
  rowDefs?: readonly GuiRowDef[];
  tileW: number;
  tileH: number;
  tileGap: number;
  tilesPerRow: number;
  phaseRects: Rect[];
  endButton: Rect;
  detailLines: number;
  detailTextWidth: number;
};

/** A detail panel much wider than tall (phone portrait) shows its text beside the card image. */
export function isWideDetail(detail: Rect): boolean {
  return detail.w > detail.h * 1.6;
}

/** Card image width in a wide detail panel: the image fills the panel height. */
export function detailArtWidth(detail: Rect): number {
  return Math.round(((detail.h - 8) * 130) / 190);
}

const FONT_PX = 12;
const LINE_H = 15;
const TILE_H = 32;
const ROW_GAP = 2;

export function computeGuiGeometry(viewport: Viewport): GuiGeometry {
  const width = Math.max(400, Math.floor(viewport.width));
  const height = Math.max(240, Math.floor(viewport.height));
  const detailW = Math.round(width * 0.245);
  const sideW = Math.max(52, Math.round(width * 0.115));
  const topBar: Rect = { x: 0, y: 0, w: width, h: LINE_H };
  const footer: Rect = { x: 0, y: height - LINE_H, w: width, h: LINE_H };
  const board: Rect = { x: detailW + 2, y: topBar.h, w: width - detailW - sideW - 4, h: footer.y - topBar.h };
  const detail: Rect = { x: 0, y: topBar.h, w: detailW, h: footer.y - topBar.h };
  const side: Rect = { x: width - sideW, y: topBar.h, w: sideW, h: footer.y - topBar.h };
  const rows: Rect[] = [];
  let y = board.y;
  const strip = (): Rect => {
    const r = { x: board.x, y, w: board.w, h: LINE_H - 1 };
    y += LINE_H - 1;
    return r;
  };
  const cpuStrip = strip();
  let humanStrip = cpuStrip;
  for (const def of GUI_ROWS) {
    if (def.player === HUMAN && def.zone === "battle") {
      y += 2;
      humanStrip = strip();
    }
    rows.push({ x: board.x, y, w: board.w, h: TILE_H });
    y += TILE_H + ROW_GAP;
  }
  const tileGap = 2;
  const tilesPerRow = Math.max(3, Math.floor((board.w + tileGap) / (56 + tileGap)));
  const tileW = Math.floor((board.w + tileGap) / tilesPerRow) - tileGap;
  const phaseRects = PHASE_ORDER.map((_, i) => ({ x: side.x + 2, y: side.y + 2 + i * (LINE_H + 1), w: side.w - 4, h: LINE_H }));
  const endTop = phaseRects[phaseRects.length - 1]!.y + LINE_H + 8;
  const endButton: Rect = { x: side.x + 2, y: endTop, w: side.w - 4, h: LINE_H * 3 + 6 };
  return {
    width,
    height,
    fontPx: FONT_PX,
    lineHeight: LINE_H,
    topBar,
    footer,
    detail,
    board,
    side,
    strips: [cpuStrip, humanStrip],
    rows,
    tileW,
    tileH: TILE_H,
    tileGap,
    tilesPerRow,
    phaseRects,
    endButton,
    detailLines: Math.max(4, Math.floor((detail.h - 6) / LINE_H)),
    detailTextWidth: detail.w - 8,
  };
}

const SUBJECT_KEYS = [
  "instanceId",
  "attackerInstanceId",
  "riderInstanceId",
  "operationInstanceId",
  "unitInstanceId",
  "interceptInstanceId",
  "morphUnitInstanceId",
  "zordInstanceId",
  "sourceInstanceId",
  "battleInstanceId",
  "materialInstanceId",
];
const TARGET_KEYS = [
  "defenderInstanceId",
  "targetInstanceId",
  "vehicleInstanceId",
  "newVehicleInstanceId",
  "extraInstanceId",
  "substituteInstanceId",
];

/** Every card instance id a legal action names (instanceId, attackerInstanceId, selectedInstanceIds...). */
export function actionInstanceIds(action: GameAction): string[] {
  const ids: string[] = [];
  for (const [key, value] of Object.entries(action as unknown as Record<string, unknown>)) {
    if (!(/InstanceIds?$/.test(key) || key === "instanceId")) continue;
    if (Array.isArray(value)) for (const v of value) ids.push(String(v));
    else if (typeof value === "string") ids.push(value);
  }
  return ids;
}

/** The card that performs the action (the one you "pick up"), if any. */
export function actionSubjectId(action: GameAction): string | undefined {
  const record = action as unknown as Record<string, unknown>;
  for (const key of SUBJECT_KEYS) if (typeof record[key] === "string") return record[key] as string;
  return undefined;
}

/** The single card the action points at (attack defender, operation target, vehicle...), if any. */
export function actionTargetId(action: GameAction): string | undefined {
  const record = action as unknown as Record<string, unknown>;
  for (const key of TARGET_KEYS) if (typeof record[key] === "string") return record[key] as string;
  return undefined;
}

/** Fields other than type/player/subject/target, as a stable string (variants of the same move differ here). */
export function actionExtrasKey(action: GameAction): string {
  const record = action as unknown as Record<string, unknown>;
  // Only the subject and the target the menus already picked: a second card (extraInstanceId next to
  // targetInstanceId, RS-021 サイバースライダー) still tells the variants apart.
  const subject = SUBJECT_KEYS.find((k) => typeof record[k] === "string");
  const target = TARGET_KEYS.find((k) => typeof record[k] === "string");
  const skip = new Set(["type", "playerId", subject, target]);
  return Object.keys(record)
    .filter((k) => !skip.has(k) && record[k] !== undefined)
    .sort()
    .map((k) => `${k}=${JSON.stringify(record[k])}`)
    .join("&");
}

function zoneCards(state: GameState, player: PlayerId, zone: GuiZone): CardInstance[] {
  const p = state.players[player];
  return zone === "hand" ? p.hand : p[zone];
}

/** A row's cards with each vehicle placed just before the unit riding it (in the zone's own order otherwise). */
function ridingOrder(cards: readonly CardInstance[]): CardInstance[] {
  const ids = new Set(cards.map((c) => c.instanceId));
  const ridden = new Set(cards.flatMap((c) => (c.mountedOnInstanceId && ids.has(c.mountedOnInstanceId) ? [c.mountedOnInstanceId] : [])));
  const out: CardInstance[] = [];
  for (const card of cards) {
    if (ridden.has(card.instanceId)) continue;
    const vehicle = card.mountedOnInstanceId && ridden.has(card.mountedOnInstanceId) ? cards.find((c) => c.instanceId === card.mountedOnInstanceId) : undefined;
    if (vehicle && !out.includes(vehicle)) out.push(vehicle);
    out.push(card);
  }
  // A vehicle whose rider is listed twice or not at all keeps its place at the end.
  for (const card of cards) if (!out.includes(card)) out.push(card);
  return out;
}

/** Tile for any card instance (board rows, dialogs). */
export function cardTile(
  engine: EngineApi,
  state: GameState,
  player: PlayerId,
  zone: string,
  card: CardInstance,
  fit: WrapOptions,
  actionable = false,
  selected = false,
): GuiTile {
  const def = state.definitions[card.cardId];
  const hidden = player !== HUMAN && (zone === "hand" || zone === "deck");
  let kind: GuiTileKind = hidden ? "hidden" : "other";
  let sub = "";
  if (!hidden && def) {
    if (zone === "command") {
      kind = "command";
      sub = "コマンド";
    } else if (def.type === "unit") {
      kind = "unit";
      let bp: number | undefined = def.bp;
      if (zone === "battle" || zone === "rush") {
        try {
          bp = engine.effectiveBp(state, player, card);
        } catch {
          // keep printed BP
        }
      }
      sub = bp !== undefined ? String(bp) : "";
    } else if (def.type === "operation") {
      kind = "operation";
      sub = "オペ";
    } else {
      sub = def.type === "vehicle" ? "ビークル" : "コマンダー";
    }
  }
  if (card.commandHeld) sub = "ホールド";
  if (zone === "power") sub = card.faceDown ? "パワー裏" : "パワー";
  return {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: hidden ? "" : clipLine(def?.name ?? card.cardId, fit),
    sub: clipLine(sub, fit),
    kind,
    held: !!card.commandHeld,
    actionable,
    selected,
  };
}

export function buildGuiRows(
  engine: EngineApi,
  state: GameState,
  geometry: GuiGeometry,
  humanActions: readonly GameAction[],
): GuiRow[] {
  const actionable = new Set(humanActions.flatMap(actionInstanceIds));
  const selected = new Set(state.pendingEffectChoice?.selectedInstanceIds ?? []);
  const fit: WrapOptions = { fontPx: geometry.fontPx, maxWidthPx: geometry.tileW - 4 };
  return (geometry.rowDefs ?? GUI_ROWS).map((def) => ({
    key: `${def.player}:${def.zone}` as GuiRowKey,
    player: def.player,
    zone: def.zone,
    tiles: ridingOrder(zoneCards(state, def.player, def.zone)).map((card, i, cards) => {
      const tile = cardTile(engine, state, def.player, def.zone, card, fit, actionable.has(card.instanceId), selected.has(card.instanceId));
      return card.mountedOnInstanceId && cards[i - 1]?.instanceId === card.mountedOnInstanceId ? { ...tile, ridingOn: card.mountedOnInstanceId } : tile;
    }),
  }));
}

/** Where a card instance currently is (any zone of either player). */
export function locateInstance(
  state: GameState,
  instanceId: string,
): { player: PlayerId; zone: string; card: CardInstance } | null {
  for (const player of [HUMAN, CPU] as PlayerId[]) {
    const p = state.players[player] as unknown as Record<string, unknown>;
    for (const [zone, cards] of Object.entries(p)) {
      if (!Array.isArray(cards)) continue;
      const card = (cards as CardInstance[]).find((c) => c && typeof c === "object" && c.instanceId === instanceId);
      if (card) return { player, zone, card };
    }
  }
  return null;
}

const ZONE_LABELS: Record<string, string> = {
  hand: "手札",
  deck: "山札",
  discard: "捨札",
  power: "パワー",
  command: "コマンド",
  rush: "ラッシュ",
  battle: "バトル",
  operation: "常駐",
  exile: "除外",
  commander: "コマンダー",
};

export function zoneLabel(zone: string): string {
  return ZONE_LABELS[zone] ?? zone;
}

/** "CPU ダメージ2/7 手5 山30 捨3 P4(裏1) C3" — the zones not drawn as rows. */
export function playerStrip(engine: EngineApi, state: GameState, player: PlayerId): string {
  const p = state.players[player];
  const faceDown = p.power.filter((c) => c.faceDown).length;
  const parts = [
    `${PLAYER_LABELS[player]} ダメージ${p.damage}/${engine.WIN_DAMAGE}`,
    player === HUMAN ? "" : `手${p.hand.length}`,
    `山${p.deck.length}`,
    `捨${p.discard.length}`,
    `P${p.power.length}${faceDown ? `(裏${faceDown})` : ""}`,
    player === HUMAN ? "" : `C${p.command.length}`,
    p.operation.length ? `常${p.operation.length}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function topBarText(state: GameState): string {
  if (state.winner) return `決着: ${PLAYER_LABELS[state.winner]}の勝利`;
  return `ターン${state.turn} ${PLAYER_LABELS[turnPlayer(state)]}の番`;
}

/**
 * Whose turn it is. activePlayer is whoever must act, which is the other
 * player while they answer an attack, a rush or an effect; the open
 * window's phasePlayerId names the turn's player.
 */
function turnPlayer(state: GameState): PlayerId {
  for (const [key, value] of Object.entries(state)) {
    if (!key.startsWith("pending") || !value || typeof value !== "object") continue;
    const phasePlayer = (value as { phasePlayerId?: PlayerId }).phasePlayerId;
    if (phasePlayer) return phasePlayer;
  }
  return state.activePlayer;
}

/** How far a riding unit's tile sits right of its vehicle's (the vehicle shows on its left). */
export function ridingStep(geometry: GuiGeometry): number {
  return Math.round(geometry.tileW * 0.42);
}

/**
 * Tile rectangles of the visible window of a row: one slot per card, except that a riding unit is
 * stacked on its vehicle (shifted right by `ridingStep`), so the pair takes about one and a half slots.
 */
export function rowTileRects(geometry: GuiGeometry, row: number, tiles: readonly Pick<GuiTile, "ridingOn" | "instanceId">[]): Rect[] {
  const base = tileRect(geometry, row, 0);
  let x = base.x;
  return tiles.map((tile, slot) => {
    if (slot > 0) x += tile.ridingOn && tiles[slot - 1]!.instanceId === tile.ridingOn ? ridingStep(geometry) : geometry.tileW + geometry.tileGap;
    return { ...base, x };
  });
}

/** Tile rectangle for slot `slot` (0-based within the visible window) of row `row`. */
export function tileRect(geometry: GuiGeometry, row: number, slot: number): Rect {
  const r = geometry.rows[row]!;
  return {
    x: r.x + slot * (geometry.tileW + geometry.tileGap),
    y: r.y,
    w: geometry.tileW,
    h: geometry.tileH,
  };
}
