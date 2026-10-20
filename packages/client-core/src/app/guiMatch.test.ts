import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { hitTestGui } from "../input/devices";
import { testPlatform } from "../testing/engine";
import { measureText } from "../text/wrap";

const VITA = { width: 480, height: 272 };

function startGui(seed: number): AppController {
  const app = new AppController({ platform: testPlatform(), viewport: VITA, cpuDelayFrames: 0, seed: () => seed, gui: true });
  app.dispatch(input.select(3, true));
  return app;
}

describe("GUI match", () => {
  it("plays a whole match with GUI input only (tile menus, R menu, × pass)", () => {
    const app = startGui(5);
    expect(app.view().gui).toBeDefined();
    let humanMoves = 0;
    for (let frame = 0; frame < 30000 && app.currentScreen === "match"; frame++) {
      if (app.tick()) continue;
      const gui = app.view().gui!;
      // Prefer the focused tile's first action; fall back to the global menu, then to all actions.
      app.dispatch(input.confirm);
      if (!app.view().gui?.menuOpen) app.dispatch(input.menu);
      if (!app.view().gui?.menuOpen) app.dispatch(input.allActions);
      if (app.view().gui?.menuOpen) {
        // Walk to a pass-like option every few moves so phases advance.
        if (frame % 3 === 0) {
          app.dispatch(input.cancel);
          app.dispatch(input.cancel);
        }
        if (app.view().gui?.menuOpen) {
          app.dispatch(input.confirm);
          humanMoves++;
        }
      } else {
        expect(gui.panelLines.length).toBeGreaterThan(0);
      }
    }
    expect(app.currentScreen).toBe("result");
    expect(humanMoves).toBeGreaterThan(5);
  });

  it("lists every legal human action in the △ menu", () => {
    const app = startGui(9);
    for (let i = 0; i < 200 && app.currentScreen === "match"; i++) {
      if (app.tick()) continue;
      const options = app.session!.humanOptions();
      if (options.length === 0) continue;
      app.dispatch(input.allActions);
      const view = app.view().gui!;
      expect(view.menuTitle).toContain(`/${options.length}`);
      app.dispatch(input.confirm);
    }
  });

  it("keeps tiles, strips and panel text inside the 480x272 screen", () => {
    const app = startGui(11);
    for (let i = 0; i < 120 && app.currentScreen === "match"; i++) {
      if (!app.tick()) {
        app.dispatch(input.confirm);
        app.dispatch(input.confirm);
      }
      const gui = app.view().gui;
      if (!gui) break;
      const g = gui.geometry;
      for (const row of gui.rows) {
        expect(row.tiles.length).toBeLessThanOrEqual(g.tilesPerRow);
        for (const tile of row.tiles) {
          expect(tile.rect.x + tile.rect.w).toBeLessThanOrEqual(g.panel.x);
          expect(tile.rect.y + tile.rect.h).toBeLessThanOrEqual(g.footer.y);
          expect(measureText(tile.name, g.fontPx)).toBeLessThanOrEqual(tile.rect.w - 4);
        }
      }
      for (const line of [...gui.panelLines, ...gui.menuRows]) {
        expect(line.rect.y + line.rect.h).toBeLessThanOrEqual(g.footer.y + 1);
        expect(measureText(line.text, g.fontPx)).toBeLessThanOrEqual(g.panelTextWidth);
      }
    }
  });

  it("maps a tap on a tile to that tile and opens its menu", () => {
    const app = startGui(3);
    for (let i = 0; i < 50 && app.session!.turnOwner() !== "human"; i++) app.tick();
    const gui = app.view().gui!;
    const hand = gui.rows[gui.rows.length - 1]!;
    const tile = hand.tiles[1]!;
    const event = hitTestGui(gui, { x: tile.rect.x + 2, y: tile.rect.y + 2 });
    expect(event).toEqual({ type: "focusTile", row: gui.rows.length - 1, slot: 1, open: true });
    app.dispatch(event!);
    const after = app.view().gui!;
    expect(after.rows[after.rows.length - 1]!.tiles[1]!.focused).toBe(true);
  });
});
