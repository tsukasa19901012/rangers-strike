import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { hitTestGui } from "../input/devices";
import { testPlatform } from "../testing/engine";
import { measureText } from "../text/wrap";
import { variantLabels, type GuiView } from "./guiMatch";

const VITA = { width: 480, height: 272 };

function startGui(seed: number, humanDeck?: string): AppController {
  const app = new AppController({
    platform: testPlatform(),
    viewport: VITA,
    cpuDelayFrames: 0,
    seed: () => seed,
    gui: true,
    defaults: humanDeck ? { humanDeck } : undefined,
  });
  app.dispatch(input.select(3, true));
  return app;
}

function humanTurn(app: AppController): boolean {
  return app.currentScreen === "match" && app.session!.turnOwner() === "human";
}

/** Drives one human decision the way a player would: pick a card, ○ through popup / targeting / list, R now and then. */
function playOneStep(app: AppController, step: number): void {
  const before = app.session!.version;
  const gui = app.view().gui!;
  if (step % 5 === 4 && !gui.dialog) app.dispatch(input.menu);
  if (app.session!.version !== before) return;
  if (!gui.dialog) {
    const actionable = gui.rows.flatMap((r, row) => r.tiles.map((t, slot) => ({ t, row, slot }))).filter((x) => x.t.actionable);
    const pick = actionable[(step * 7) % Math.max(1, actionable.length)];
    if (pick) app.dispatch(input.focusTile(pick.row, pick.slot));
  }
  app.dispatch(input.confirm);
  for (let n = 0; n < step % 3; n++) app.dispatch(input.next);
  for (let i = 0; i < 4 && app.session!.version === before; i++) app.dispatch(input.confirm);
  if (app.session!.version === before) {
    // Nothing applied through the card popup: fall back to the full list.
    app.dispatch(input.cancel);
    app.dispatch(input.cancel);
    app.dispatch(input.allActions);
    app.dispatch(input.confirm);
  }
}

describe("GUI match (commercial-style controls)", () => {
  it("plays whole matches with GUI input only", () => {
    for (const seed of [5, 17]) {
      const app = startGui(seed);
      let humanSteps = 0;
      for (let frame = 0; frame < 40000 && app.currentScreen === "match"; frame++) {
        if (!humanTurn(app)) {
          app.tick();
          continue;
        }
        playOneStep(app, humanSteps++);
      }
      expect(app.currentScreen).toBe("result");
      expect(humanSteps).toBeGreaterThan(10);
    }
  });

  it("lists every legal human action in the △ list", () => {
    const app = startGui(9);
    let checked = 0;
    for (let i = 0; i < 400 && app.currentScreen === "match"; i++) {
      if (!humanTurn(app)) {
        app.tick();
        continue;
      }
      const options = app.session!.humanOptions();
      app.dispatch(input.allActions);
      const view = app.view().gui!;
      expect(view.list?.title).toContain(`/${options.length}`);
      checked++;
      app.dispatch(input.confirm);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("enters targeting for an attack and applies it on the chosen defender", () => {
    let found = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = startGui(seed);
      for (let i = 0; i < 6000 && app.currentScreen === "match" && !found; i++) {
        if (!humanTurn(app)) {
          app.tick();
          continue;
        }
        const options = app.session!.humanOptions();
        const battles = options.filter((o) => o.action.type === "battle");
        const attackers = new Set(battles.map((o) => (o.action as { attackerInstanceId: string }).attackerInstanceId));
        const attacker = [...attackers].find(
          (id) => battles.filter((o) => (o.action as { attackerInstanceId: string }).attackerInstanceId === id).length > 1,
        );
        if (!attacker) {
          playOneStep(app, i);
          continue;
        }
        // Tap the attacker, choose the attack verb, then the second target.
        const gui = app.view().gui!;
        const row = gui.rows.findIndex((r) => r.tiles.some((t) => t.instanceId === attacker));
        const slot = gui.rows[row]!.tiles.findIndex((t) => t.instanceId === attacker);
        app.dispatch(input.focusTile(row, slot, true));
        const popup = app.view().gui!.popup!;
        const attackRow = popup.rows.findIndex((r) => r.text.startsWith("アタック"));
        expect(attackRow).toBeGreaterThanOrEqual(0);
        app.dispatch(input.select(attackRow, true));
        const targeting = app.view().gui!;
        expect(targeting.footer).toContain("アタックする相手");
        const targets = targeting.rows.flatMap((r) => r.tiles.filter((t) => t.targetable));
        expect(targets.length).toBeGreaterThan(1);
        expect(targeting.rows.flatMap((r) => r.tiles).some((t) => t.dimmed)).toBe(true);
        const version = app.session!.version;
        app.dispatch(input.next);
        app.dispatch(input.confirm);
        if (app.view().gui?.list) app.dispatch(input.confirm);
        expect(app.session!.version).toBeGreaterThan(version);
        found = true;
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  it("opens a selection window for pending decisions and resolves it", () => {
    let seen = 0;
    for (const seed of [3, 11, 21]) {
      const app = startGui(seed);
      for (let i = 0; i < 8000 && app.currentScreen === "match" && seen < 3; i++) {
        if (!humanTurn(app)) {
          app.tick();
          continue;
        }
        const gui = app.view().gui!;
        if (gui.dialog) {
          seen++;
          expect(gui.dialog.titleLines.length).toBeGreaterThan(0);
          expect(gui.dialog.cards.length + gui.dialog.buttons.length).toBeGreaterThan(0);
          // L peeks at the board, × returns to the window.
          app.dispatch(input.toggleLog);
          expect(app.view().gui!.dialog).toBeUndefined();
          app.dispatch(input.cancel);
          expect(app.view().gui!.dialog).toBeDefined();
        }
        playOneStep(app, i);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("keeps everything inside the 480x272 screen", () => {
    const app = startGui(11);
    const within = (view: GuiView, r: { x: number; y: number; w: number; h: number }) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(-4);
      expect(r.x + r.w).toBeLessThanOrEqual(view.geometry.width);
      expect(r.y + r.h).toBeLessThanOrEqual(view.geometry.height);
    };
    for (let i = 0; i < 600 && app.currentScreen === "match"; i++) {
      if (!humanTurn(app)) {
        app.tick();
        continue;
      }
      app.dispatch(input.confirm);
      const gui = app.view().gui!;
      const g = gui.geometry;
      for (const row of gui.rows) {
        expect(row.tiles.length).toBeLessThanOrEqual(g.tilesPerRow);
        for (const tile of row.tiles) {
          within(gui, tile.rect);
          expect(tile.rect.x + tile.rect.w).toBeLessThanOrEqual(g.side.x);
          expect(measureText(tile.name, g.fontPx)).toBeLessThanOrEqual(tile.rect.w - 4);
        }
      }
      for (const line of gui.detailLines) {
        expect(line.rect.y + line.rect.h).toBeLessThanOrEqual(g.footer.y + 1);
        expect(measureText(line.text, g.fontPx)).toBeLessThanOrEqual(g.detailTextWidth);
      }
      for (const box of [gui.popup, gui.list]) if (box) [box.rect, ...box.rows.map((r) => r.rect)].forEach((r) => within(gui, r));
      if (gui.dialog) [gui.dialog.rect, ...gui.dialog.cards.map((c) => c.rect)].forEach((r) => within(gui, r));
      playOneStep(app, i);
    }
  });

  it("maps taps to tiles, popup rows and the end button", () => {
    const app = startGui(3);
    for (let i = 0; i < 200 && !(humanTurn(app) && !app.view().gui!.dialog); i++) {
      if (humanTurn(app)) playOneStep(app, i);
      else app.tick();
    }
    const gui = app.view().gui!;
    const handRow = gui.rows.length - 1;
    const tile = gui.rows[handRow]!.tiles[1]!;
    const event = hitTestGui(gui, { x: tile.rect.x + 2, y: tile.rect.y + 4 });
    expect(event).toEqual({ type: "focusTile", row: handRow, slot: 1, open: true });
    expect(hitTestGui(gui, { x: gui.endButton.rect.x + 2, y: gui.endButton.rect.y + 2 })).toEqual({ type: "menu" });
    app.dispatch(event!);
    const after = app.view().gui!;
    if (after.popup) {
      const r = after.popup.rows[0]!.rect;
      expect(hitTestGui(after, { x: r.x + 2, y: r.y + 2 })).toEqual({ type: "select", row: 0, confirm: true });
      expect(hitTestGui(after, { x: 1, y: 1 })).toEqual({ type: "cancel" });
    }
  });
});

describe("GuiMatch card art", () => {
  it("leaves room for the card image above the detail text", () => {
    const app = new AppController({ platform: testPlatform(), viewport: VITA, cpuDelayFrames: 0, seed: () => 3, gui: true, cardArt: true });
    app.dispatch(input.select(3, true));
    const gui = app.view().gui!;
    const art = gui.detailArt!;
    expect(art.cardId).not.toBe("");
    const d = gui.geometry.detail;
    expect(art.rect.x).toBeGreaterThanOrEqual(d.x);
    expect(art.rect.x + art.rect.w).toBeLessThanOrEqual(d.x + d.w);
    expect(art.rect.y + art.rect.h).toBeLessThanOrEqual(d.y + d.h);
    for (const line of gui.detailLines) {
      const beside = line.rect.x >= art.rect.x + art.rect.w;
      const below = line.rect.y >= art.rect.y + art.rect.h;
      expect(beside || below).toBe(true);
      expect(line.rect.y + line.rect.h).toBeLessThanOrEqual(d.y + d.h);
    }
  });
});

describe("variantLabels", () => {
  it("drops the start the variants share so the differing part stays visible", () => {
    expect(
      variantLabels([
        "コマンドを支払って使う: ロボタックSM / ロボタック（種類:カテゴリ・捨札）",
        "コマンドを支払って使う: ロボタックSM / ロボタック（種類:カテゴリ・コマンド）",
      ]),
    ).toEqual(["（種類:カテゴリ・捨札）", "（種類:カテゴリ・コマンド）"]);
  });

  it("keeps full labels when nothing sensible is shared", () => {
    expect(variantLabels(["ドロー", "フェイズ終了"])).toEqual(["ドロー", "フェイズ終了"]);
  });
});
