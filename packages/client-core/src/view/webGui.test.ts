import { describe, expect, it } from "vitest";
import { AppController } from "../app/controller";
import { input } from "../input/actions";
import { hitTestGui } from "../input/devices";
import { testPlatform } from "../testing/engine";
import type { Rect } from "./layout";
import { computeWebDeckGeometry, computeWebGuiGeometry, webPileWidth, WEB_MIN_VIEWPORT } from "./webGui";

const SIZES = [
  { width: 1024, height: 640 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
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
        // The pile column sits between the row and the board's right edge.
        expect(row.x + row.w + 10 + webPileWidth(g.tileW)).toBeLessThanOrEqual(g.board.x + g.board.w);
      }
      expect(g.tileH / g.tileW).toBeCloseTo(190 / 130, 1);
      expect(g.tilesPerRow).toBeGreaterThanOrEqual(7);
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

  it("never lays out below the minimum screen", () => {
    const g = computeWebGuiGeometry({ width: 640, height: 400 });
    expect(g.width).toBe(WEB_MIN_VIEWPORT.width);
    expect(g.height).toBe(WEB_MIN_VIEWPORT.height);
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
