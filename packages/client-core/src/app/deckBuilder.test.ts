import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { testPlatform } from "../testing/engine";
import { computeWebDeckGeometry } from "../view/webGui";

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

  it("narrows the catalog by free-text search and by every filter", () => {
    const app = openBuilder();
    pickMenu(app, /空のデッキ/);
    const total = () => Number(app.view().deck!.pageText.split(" ")[0]!.split("/")[1] ?? 0);
    const all = total();
    expect(all).toBeGreaterThan(1000);
    app.setDeckText("search", "レッド");
    const red = total();
    expect(red).toBeGreaterThan(0);
    expect(red).toBeLessThan(all);
    for (const tile of app.view().deck!.tiles) expect(tile.cardId).toBeTruthy();
    // Hiragana finds the same cards; a second word narrows further.
    app.setDeckText("search", "れっど");
    expect(total()).toBe(red);
    app.setDeckText("search", "れっど 登場");
    expect(total()).toBeLessThan(red);
    app.setDeckText("search", "存在しないカード名ああああ");
    expect(app.view().deck!.emptyText).toMatch(/条件に合う/);
    app.setDeckText("search", "");
    expect(total()).toBe(all);
    // The 絞り込み menu reaches the set / cost / BP filters too.
    app.dispatch(input.cancel);
    pickMenu(app, /^絞り込み/);
    pickMenu(app, /^コスト/);
    pickMenu(app, /コスト3/);
    const cost3 = total();
    expect(cost3).toBeLessThan(all);
    app.dispatch(input.cancel);
    pickMenu(app, /^絞り込み/);
    pickMenu(app, /^弾/);
    pickMenu(app, /^XG3$/);
    expect(total()).toBeLessThan(cost3);
    app.dispatch(input.cancel);
    pickMenu(app, /^絞り込み/);
    pickMenu(app, /すべて解除/);
    expect(total()).toBe(all);
  });

  it("names a new deck and renames a saved one", () => {
    const app = openBuilder();
    pickMenu(app, /空のデッキ/);
    app.dispatch(input.confirm);
    app.setDeckText("name", "  赤単アグロ  ");
    app.dispatch(input.cancel);
    pickMenu(app, /保存して戻る/);
    expect(app.deckChoices().find((d) => d.custom)!.name).toBe("自作: 赤単アグロ");
    app.openDeckBuilder();
    pickMenu(app, /編集: 赤単アグロ/);
    app.setDeckText("name", "新しい名前");
    app.dispatch(input.cancel);
    pickMenu(app, /保存して戻る/);
    const custom = app.deckChoices().filter((d) => d.custom);
    expect(custom.map((d) => d.name)).toEqual(["自作: 新しい名前"]);
    // An empty name saves as a default one; clearing it does not lose the open deck.
    app.openDeckBuilder();
    pickMenu(app, /編集: 新しい名前/);
    app.setDeckText("name", "");
    app.dispatch(input.cancel);
    expect(app.currentScreen).toBe("deck");
    pickMenu(app, /保存して戻る/);
    expect(app.deckChoices().filter((d) => d.custom)[0]!.name).toBe("自作: 自作デッキ");
  });

  it("shows text fields and filter chips on the web layout", () => {
    const app = new AppController({
      platform: testPlatform(),
      viewport: { width: 1280, height: 720 },
      cpuDelayFrames: 0,
      seed: () => 5,
      gui: true,
      cardArt: true,
      layouts: { deck: computeWebDeckGeometry },
    });
    app.openDeckBuilder();
    expect(app.view().deck!.textFields).toEqual([]);
    pickMenu(app, /空のデッキ/);
    const deck = app.view().deck!;
    expect(deck.textFields.map((f) => f.id)).toEqual(["name", "search"]);
    expect(deck.textFields[0]!.text).toBe("自作デッキ");
    expect(deck.chips.map((c) => c.key)).toEqual(["view", "type", "category", "set", "cost", "bp", "clear"]);
    // Tapping a filter chip opens its choices.
    app.dispatch({ type: "selectTab", tab: 4 });
    expect(app.view().deck!.menu!.title).toMatch(/コスト/);
    expect(app.view().deck!.textFields).toEqual([]);
  });

  it("shows the wiki-style attributes in the detail panel, and the whole card on a phone", () => {
    const open = (viewport: { width: number; height: number }) => {
      const app = new AppController({ platform: testPlatform(), viewport, cpuDelayFrames: 0, seed: () => 5, gui: true, cardArt: true, layouts: { deck: computeWebDeckGeometry } });
      app.openDeckBuilder();
      pickMenu(app, /空のデッキ/);
      return app.view().deck!;
    };
    const pc = open({ width: 1280, height: 720 });
    const lines = pc.detailLines.map((l) => l.text);
    expect(lines.some((t) => t.startsWith("カテゴリ："))).toBe(true);
    expect(lines.some((t) => t.startsWith("必要パワー："))).toBe(true);
    const phone = open({ width: 390, height: 844 });
    expect(phone.detailLines.some((l) => l.text.startsWith("カテゴリ："))).toBe(false);
    expect(phone.detailLines.at(-1)!.text).toMatch(/▼ タップで(詳細|全文)/);
    expect(phone.detailFull!.fields[0]).toMatch(/^カテゴリ：/);
  });
});
