// Graphical board view model (card tiles in zone rows) and its fixed geometry.
// Renderers place every tile and menu row at the rectangles computed here, and
// hitTestGui uses the same rectangles, so touch always matches what is drawn.
import type { CardInstance, EngineApi, GameAction, GameState, PlayerId } from "../engineApi";
import { CPU, HUMAN } from "../engineApi";
import { PHASE_LABELS, PLAYER_LABELS } from "../text/labels";
import { clipLine, fitLine, type WrapOptions } from "../text/wrap";
import type { Rect, Viewport } from "./layout";

export type GuiZone = "battle" | "rush" | "command" | "hand";

export type GuiRowKey = `${PlayerId}:${GuiZone}`;

/** Rows from top to bottom. CPU command / power / operation and both piles are shown as counts in the strips. */
export const GUI_ROWS: readonly { player: PlayerId; zone: GuiZone; label: string }[] = [
  { player: CPU, zone: "rush", label: "ラ" },
  { player: CPU, zone: "battle", label: "バ" },
  { player: HUMAN, zone: "battle", label: "バ" },
  { player: HUMAN, zone: "rush", label: "ラ" },
  { player: HUMAN, zone: "command", label: "コ" },
  { player: HUMAN, zone: "hand", label: "手" },
];

export type GuiTileKind = "unit" | "command" | "operation" | "other" | "hidden";

export type GuiTile = {
  instanceId: string;
  cardId: string;
  /** Name fitted to the tile width (empty for hidden cards). */
  name: string;
  /** Second line: BP for units, a short type tag otherwise. */
  sub: string;
  kind: GuiTileKind;
  held: boolean;
  /** The human has at least one legal action that names this card. */
  actionable: boolean;
  /** Already picked in the pending effect choice. */
  selected: boolean;
};

export type GuiRow = {
  key: GuiRowKey;
  player: PlayerId;
  zone: GuiZone;
  label: string;
  tiles: GuiTile[];
};

export type GuiGeometry = {
  fontPx: number;
  lineHeight: number;
  topBar: Rect;
  footer: Rect;
  /** One strip per player, CPU first. */
  strips: [Rect, Rect];
  rows: Rect[];
  /** Left edge of the first tile in a row and the tile pitch. */
  tileX: number;
  tileW: number;
  tileH: number;
  tileGap: number;
  tilesPerRow: number;
  panel: Rect;
  panelLines: number;
  panelTextWidth: number;
};

const FONT_PX = 12;
const LINE_H = 15;
const TILE_H = 32;
const ROW_GAP = 2;
const LABEL_W = 14;

export function computeGuiGeometry(viewport: Viewport): GuiGeometry {
  const width = Math.max(400, Math.floor(viewport.width));
  const height = Math.max(240, Math.floor(viewport.height));
  const panelW = Math.max(150, Math.round(width * 0.37));
  const boardW = width - panelW;
  const topBar: Rect = { x: 0, y: 0, w: width, h: LINE_H };
  const footer: Rect = { x: 0, y: height - LINE_H, w: width, h: LINE_H };
  const rowH = TILE_H + ROW_GAP;
  const rows: Rect[] = [];
  let y = topBar.h;
  const strip = (): Rect => {
    const r = { x: 0, y, w: boardW, h: LINE_H - 1 };
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
    rows.push({ x: 0, y, w: boardW, h: TILE_H });
    y += rowH;
  }
  const tileGap = 2;
  // Fit the tile pitch to the board: at least 54px so 4 kana of the name fit.
  const usable = boardW - LABEL_W - 2;
  const tilesPerRow = Math.max(3, Math.floor((usable + tileGap) / (54 + tileGap)));
  const tileW = Math.floor((usable + tileGap) / tilesPerRow) - tileGap;
  const panel: Rect = { x: boardW, y: topBar.h, w: panelW, h: footer.y - topBar.h };
  return {
    fontPx: FONT_PX,
    lineHeight: LINE_H,
    topBar,
    footer,
    strips: [cpuStrip, humanStrip],
    rows,
    tileX: LABEL_W + 2,
    tileW,
    tileH: TILE_H,
    tileGap,
    tilesPerRow,
    panel,
    panelLines: Math.max(4, Math.floor((panel.h - 4) / LINE_H)),
    panelTextWidth: panel.w - 8,
  };
}

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

function zoneCards(state: GameState, player: PlayerId, zone: GuiZone): CardInstance[] {
  const p = state.players[player];
  return zone === "hand" ? p.hand : p[zone];
}

function tileFor(
  engine: EngineApi,
  state: GameState,
  player: PlayerId,
  zone: GuiZone,
  card: CardInstance,
  actionable: ReadonlySet<string>,
  selected: ReadonlySet<string>,
  fit: WrapOptions,
): GuiTile {
  const def = state.definitions[card.cardId];
  const hidden = player !== HUMAN && zone === "hand";
  let kind: GuiTileKind = hidden ? "hidden" : "other";
  let sub = "";
  if (!hidden && def) {
    if (zone === "command") {
      kind = "command";
      sub = "コマンド";
    } else if (def.type === "unit") {
      kind = "unit";
      let bp: number | undefined = def.bp;
      try {
        bp = engine.effectiveBp(state, player, card);
      } catch {
        // keep printed BP
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
  return {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: hidden ? "" : clipLine(def?.name ?? card.cardId, fit),
    sub: fitLine(sub, fit),
    kind,
    held: !!card.commandHeld,
    actionable: actionable.has(card.instanceId),
    selected: selected.has(card.instanceId),
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
  return GUI_ROWS.map((def) => ({
    key: `${def.player}:${def.zone}` as GuiRowKey,
    player: def.player,
    zone: def.zone,
    label: def.label,
    tiles: zoneCards(state, def.player, def.zone).map((card) =>
      tileFor(engine, state, def.player, def.zone, card, actionable, selected, fit),
    ),
  }));
}

/** "CPU D2/7 手5 山30 捨3 P4(裏1) C3" — the zones not drawn as rows. */
export function playerStrip(engine: EngineApi, state: GameState, player: PlayerId): string {
  const p = state.players[player];
  const faceDown = p.power.filter((c) => c.faceDown).length;
  const parts = [
    `${PLAYER_LABELS[player]} D${p.damage}/${engine.WIN_DAMAGE}`,
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
  const phase = PHASE_LABELS[state.phase] ?? state.phase;
  return `ターン${state.turn} ${PLAYER_LABELS[state.activePlayer]}の${phase}フェイズ`;
}

/** Tile rectangle for slot `slot` (0-based within the visible window) of row `row`. */
export function tileRect(geometry: GuiGeometry, row: number, slot: number): Rect {
  const r = geometry.rows[row]!;
  return {
    x: r.x + geometry.tileX + slot * (geometry.tileW + geometry.tileGap),
    y: r.y,
    w: geometry.tileW,
    h: geometry.tileH,
  };
}
