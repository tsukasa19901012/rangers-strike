import { describe, expect, it } from "vitest";
import { AppController } from "../app/controller";
import { input } from "../input/actions";
import { hitTestGui } from "../input/devices";
import { testPlatform } from "../testing/engine";
import type { Rect } from "./layout";
import { CPU, HUMAN } from "../engineApi";
import { computeWebDeckGeometry, computeWebGuiGeometry, isPortrait, webPileRect, WEB_GUI_ROWS, WEB_MIN_VIEWPORT } from "./webGui";

const SIZES = [
  { width: 1024, height: 640 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
];

// Phones held upright (logical px as the host picks them).
const PORTRAIT_SIZES = [
  { width: 430, height: 736 },
  { width: 430, height: 931 },
  { width: 600, height: 800 },
];

const within = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

describe("web geometry", () => {
  it("fits the match board, piles and side column inside the screen", () => {
    for (const size of SIZES) {
      const g = computeWebGuiGeometry(size);
      const screen = { x: 0, y: 0, w: size.width, h: size.height };
      for (const r of [g.topBar, g.footer, g.detail, g.board, g.side, g.endButton, ...g.phaseRects, ...g.strips]) expect(within(r, screen)).toBe(true);
      for (let i = 0; i < g.rows.length; i++) {
        const row = g.rows[i]!;
        expect(within(row, g.board)).toBe(true);
        expect(g.tilesPerRow * (g.tileW + g.tileGap) - g.tileGap).toBeLessThanOrEqual(row.w);
        if (i > 0) expect(row.y).toBeGreaterThanOrEqual(g.rows[i - 1]!.y + g.rows[i - 1]!.h);
      }
      // The pile columns sit between the rows and the board's right edge, CPU above the player.
      const cpuPile = webPileRect(g, CPU);
      const humanPile = webPileRect(g, HUMAN);
      for (const pile of [cpuPile, humanPile]) {
        expect(pile.x).toBeGreaterThan(g.rows[0]!.x + g.rows[0]!.w);
        expect(pile.x + pile.w).toBeLessThanOrEqual(g.board.x + g.board.w);
        expect(pile.w).toBeGreaterThanOrEqual(110);
      }
      expect(cpuPile.y + cpuPile.h).toBeLessThanOrEqual(humanPile.y);
      expect(g.tileH / g.tileW).toBeCloseTo(190 / 130, 1);
      expect(g.tilesPerRow).toBeGreaterThanOrEqual(7);
    }
  });

  it("shows both command zones as card rows", () => {
    const g = computeWebGuiGeometry(SIZES[1]!);
    expect(g.rowDefs).toBe(WEB_GUI_ROWS);
    expect(g.rows.length).toBe(WEB_GUI_ROWS.length);
    expect(WEB_GUI_ROWS.filter((r) => r.zone === "command").map((r) => r.player)).toEqual([CPU, HUMAN]);
  });

  it("stacks the match screen on a phone held upright", () => {
    for (const size of PORTRAIT_SIZES) {
      const g = computeWebGuiGeometry(size);
      expect(isPortrait(g)).toBe(true);
      const screen = { x: 0, y: 0, w: size.width, h: size.height };
      for (const r of [g.topBar, g.footer, g.detail, g.board, g.endButton, ...g.phaseRects, ...g.strips]) expect(within(r, screen)).toBe(true);
      // Phases, board, detail, buttons and footer from top to bottom.
      expect(g.phaseRects[0]!.y).toBeGreaterThanOrEqual(g.topBar.y + g.topBar.h);
      expect(g.board.y).toBeGreaterThanOrEqual(g.phaseRects[0]!.y + g.phaseRects[0]!.h);
      expect(g.detail.y).toBeGreaterThanOrEqual(g.board.y + g.board.h);
      expect(g.endButton.y).toBeGreaterThanOrEqual(g.detail.y + g.detail.h);
      expect(g.footer.y).toBeGreaterThanOrEqual(g.endButton.y + g.endButton.h);
      for (const row of g.rows) {
        expect(within(row, g.board)).toBe(true);
        expect(g.tilesPerRow * (g.tileW + g.tileGap) - g.tileGap).toBeLessThanOrEqual(row.w);
      }
      // The pile panel overhangs its rows by a few px, like the row backgrounds.
      const around = { x: g.board.x, y: g.board.y - 4, w: g.board.w, h: g.board.h + 8 };
      for (const player of [CPU, HUMAN]) expect(within(webPileRect(g, player), around)).toBe(true);
      expect(g.tilesPerRow).toBeGreaterThanOrEqual(5);
      expect(g.tileH).toBeGreaterThanOrEqual(50);
    }
  });

  it("fits the deck builder on a phone held upright", () => {
    for (const size of PORTRAIT_SIZES) {
      const g = computeWebDeckGeometry(size);
      expect(g.cols * (g.tileW + g.gap) - g.gap).toBeLessThanOrEqual(g.grid.w);
      expect(g.rows * (g.tileH + g.gap) - g.gap).toBeLessThanOrEqual(g.grid.h);
      expect(g.grid.y + g.grid.h).toBeLessThanOrEqual(g.detail.y);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(4);
    }
  });

  it("fills the deck builder grid with whole cards", () => {
    for (const size of SIZES) {
      const g = computeWebDeckGeometry(size);
      expect(g.cols * (g.tileW + g.gap) - g.gap).toBeLessThanOrEqual(g.grid.w);
      expect(g.rows * (g.tileH + g.gap) - g.gap).toBeLessThanOrEqual(g.grid.h);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(18);
    }
  });

  it("gives the deck builder non-overlapping chips, search and name fields", () => {
    const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const size of [...SIZES, ...PORTRAIT_SIZES]) {
      const g = computeWebDeckGeometry(size);
      const screen = { x: 0, y: 0, w: g.width, h: g.height };
      expect(g.chipKeys?.length).toBe(g.chips.length);
      const boxes = [...g.chips, g.search!, g.nameField!];
      for (const r of boxes) {
        expect(within(r, screen)).toBe(true);
        expect(overlap(r, g.grid)).toBe(false);
        expect(overlap(r, g.detail)).toBe(false);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
    }
  });

  it("never lays out below the minimum screen", () => {
    const g = computeWebGuiGeometry({ width: 640, height: 400 });
    expect(g.width).toBe(WEB_MIN_VIEWPORT.width);
    expect(g.height).toBe(WEB_MIN_VIEWPORT.height);
  });
});

describe("riding pairs", () => {
  it("stacks a riding unit on its vehicle, and a click on the overlap picks the unit", () => {
    const app = new AppController({
      platform: testPlatform(),
      viewport: { width: 1280, height: 720 },
      cpuDelayFrames: 0,
      seed: () => 11,
      gui: true,
      cardArt: true,
      layouts: { match: computeWebGuiGeometry, deck: computeWebDeckGeometry },
    });
    app.startMatch();
    const session = app.session!;
    const s = session.state;
    const inst = (cardId: string, suffix: string) => ({ instanceId: `${cardId}:${suffix}`, cardId });
    // The rider listed before its vehicle still draws on top of it.
    session.state = {
      ...s,
      players: {
        ...s.players,
        [HUMAN]: { ...s.players[HUMAN], battle: [{ ...inst("RK-023", "r"), mountedOnInstanceId: "RK-058:v" }, inst("RK-024", "x"), inst("RK-058", "v")] },
      },
    };
    session.version++;
    const gui = app.view().gui!;
    const row = gui.rows.find((r) => r.key === `${HUMAN}:battle`)!;
    expect(row.tiles.map((t) => t.instanceId)).toEqual(["RK-058:v", "RK-023:r", "RK-024:x"]);
    const [vehicle, rider, other] = row.tiles;
    expect(rider!.ridingOn).toBe("RK-058:v");
    expect(rider!.rect.x - vehicle!.rect.x).toBeGreaterThan(0);
    expect(rider!.rect.x - vehicle!.rect.x).toBeLessThan(vehicle!.rect.w);
    expect(other!.rect.x).toBeGreaterThanOrEqual(rider!.rect.x + rider!.rect.w);
    const r = gui.rows.indexOf(row);
    expect(hitTestGui(gui, { x: rider!.rect.x + 2, y: rider!.rect.y + 10 })).toMatchObject({ type: "focusTile", row: r, slot: 1 });
    expect(hitTestGui(gui, { x: vehicle!.rect.x + 2, y: vehicle!.rect.y + 10 })).toMatchObject({ type: "focusTile", row: r, slot: 0 });
  });
});

describe("pointer shell over the web layout", () => {
  it("plays a match by clicking at the drawn rectangles", () => {
    const app = new AppController({
      platform: testPlatform(),
      viewport: { width: 1280, height: 720 },
      cpuDelayFrames: 0,
      seed: () => 11,
      gui: true,
      cardArt: true,
      layouts: { match: computeWebGuiGeometry, deck: computeWebDeckGeometry },
    });
    const decks = app.deckChoices();
    expect(decks.length).toBeGreaterThan(10);
    app.updateSettings({ humanDeck: decks[2]!.id, cpuLevel: 9 });
    expect(app.matchSettings.humanDeck).toBe(decks[2]!.id);
    expect(app.matchSettings.cpuLevel).toBe(5);
    app.startMatch();
    expect(app.currentScreen).toBe("match");
    const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    let applied = 0;
    for (let step = 0; step < 3000 && app.currentScreen === "match"; step++) {
      if (app.session!.turnOwner() !== "human") {
        app.tick();
        continue;
      }
      const gui = app.view().gui!;
      const screen = { x: 0, y: 0, w: gui.geometry.width, h: gui.geometry.height };
      for (const box of [gui.popup, gui.list]) if (box) expect(within(box.rect, screen)).toBe(true);
      const before = app.session!.version;
      const box = gui.list ?? gui.popup;
      let target: Rect | undefined;
      if (box) target = box.rows[step % box.rows.length]!.rect;
      else if (gui.dialog) {
        const picks = [...gui.dialog.cards.map((c) => c.rect), ...gui.dialog.buttons.map((b) => b.rect)];
        target = picks[step % picks.length];
      } else if (gui.footerAccent) {
        target = gui.rows.flatMap((r) => r.tiles).find((t) => t.targetable)?.rect;
      } else {
        const tiles = gui.rows.flatMap((r) => r.tiles).filter((t) => t.actionable);
        target = step % 4 === 3 || tiles.length === 0 ? gui.endButton.rect : tiles[step % tiles.length]!.rect;
      }
      const event = target ? hitTestGui(gui, center(target)) : input.cancel;
      app.dispatch(event ?? input.cancel);
      if (app.session && app.session.version !== before) applied++;
    }
    expect(applied).toBeGreaterThan(20);
    if (app.currentScreen === "match") {
      app.leaveMatch();
      expect(app.currentScreen).toBe("title");
      expect(app.session).toBeNull();
    }
  });
});
