import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { testPlatform } from "../testing/engine";

const VITA = { width: 480, height: 272 };

function openBuilder() {
  const app = new AppController({ platform: testPlatform(), viewport: VITA, cpuDelayFrames: 0, seed: () => 5, gui: true, cardArt: true });
  app.dispatch(input.select(4, true));
  expect(app.currentScreen).toBe("deck");
  return app;
}

function pickMenu(app: AppController, label: RegExp) {
  const menu = app.view().deck!.menu!;
  for (let guard = 0; guard < 200; guard++) {
    const row = app.view().deck!.menu!.rows.find((r) => r.selected)!;
    if (label.test(row.text)) {
      app.dispatch(input.confirm);
      return;
    }
    app.dispatch(input.next);
  }
  throw new Error(`menu row ${label} not found in ${menu.title}`);
}

describe("DeckBuilder", () => {
  it("starts from a starter, edits, saves and plays the custom deck", () => {
    const app = openBuilder();
    pickMenu(app, /元にする/);
    let deck = app.view().deck!;
    expect(deck.menu).toBeUndefined();
    expect(deck.topBar).toMatch(/40枚 対戦可/);
    // Remove one copy from the deck view, add it back from the same tile.
    app.dispatch(input.toggleLog);
    deck = app.view().deck!;
    expect(deck.tiles[0]!.count).toBeGreaterThan(0);
    app.dispatch(input.alt);
    expect(app.view().deck!.topBar).toMatch(/39枚 あと1枚/);
    app.dispatch(input.confirm);
    expect(app.view().deck!.topBar).toMatch(/40枚 対戦可/);
    // Category / type filters narrow the catalog.
    app.dispatch(input.toggleLog);
    const all = app.view().deck!.pageText;
    app.dispatch(input.menu);
    expect(app.view().deck!.pageText).not.toBe(all);
    // Save and start a match with it.
    app.dispatch(input.cancel);
    pickMenu(app, /保存して戻る/);
    expect(app.currentScreen).toBe("title");
    expect(app.view().rows[0]!.text).toMatch(/自作:/);
    app.dispatch(input.select(3, true));
    expect(app.currentScreen).toBe("match");
    expect(app.session!.state.players.player1.deck.length + app.session!.state.players.player1.hand.length).toBe(40);
  });

  it("enforces the copy limit and refuses to start an illegal deck", () => {
    const app = openBuilder();
    pickMenu(app, /空のデッキ/);
    for (let i = 0; i < 5; i++) app.dispatch(input.confirm);
    const deck = app.view().deck!;
    expect(deck.tiles[0]!.count).toBe(3);
    expect(deck.toast).toMatch(/これ以上/);
    app.dispatch(input.cancel);
    pickMenu(app, /保存して戻る/);
    app.dispatch(input.select(3, true));
    expect(app.currentScreen).toBe("title");
  });

  it("keeps tiles and detail inside the screen", () => {
    const app = openBuilder();
    pickMenu(app, /元にする/);
    const deck = app.view().deck!;
    expect(deck.tiles.length).toBe(deck.geometry.cols * deck.geometry.rows);
    for (const t of deck.tiles) {
      expect(t.rect.x + t.rect.w).toBeLessThanOrEqual(480);
      expect(t.rect.y + t.rect.h).toBeLessThanOrEqual(deck.geometry.footer.y);
    }
    expect(deck.detailArt).toBeDefined();
  });
});
