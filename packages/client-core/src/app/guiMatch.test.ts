import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AppController } from "./controller";
import { input } from "../input/actions";
import { hitTestGui } from "../input/devices";
import { testEngine, testPlatform } from "../testing/engine";
import { measureText } from "../text/wrap";
import { dropCardName, variantLabels, type GuiView } from "./guiMatch";
import { parseSharePayload } from "./share";

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

  it("asks a unit that entered the battle area in a popup, and a tap on a lit enemy attacks it", () => {
    let attacked = false;
    let passed = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = startGui(seed);
      for (let i = 0; i < 6000 && app.currentScreen === "match" && !(attacked && passed); i++) {
        if (!humanTurn(app)) {
          app.tick();
          continue;
        }
        const state = app.session!.state;
        const options = app.session!.humanOptions();
        const entering = state.pendingBattleEntry?.playerId === "player1" ? state.pendingBattleEntry.instanceId : null;
        const battles = options.filter((o) => o.action.type === "battle");
        if (!entering || battles.length === 0) {
          playOneStep(app, i);
          continue;
        }
        const gui = app.view().gui!;
        expect(gui.battleEntry).toBe(true);
        const rows = gui.popup!.rows.map((r) => r.text);
        expect(rows[0]).toMatch(/^アタック/);
        expect(rows[rows.length - 1]).toBe("何もしない");
        if (options.some((o) => o.action.type === "strike")) expect(rows).toContain("ストライク");
        const version = app.session!.version;
        if (!attacked) {
          const defender = (battles[0]!.action as { defenderInstanceId: string }).defenderInstanceId;
          const row = gui.rows.findIndex((r) => r.tiles.some((t) => t.instanceId === defender));
          const slot = gui.rows[row]!.tiles.findIndex((t) => t.instanceId === defender);
          // Hovering the defender shows it and keeps the popup open.
          app.dispatch(input.focusTile(row, slot, false));
          expect(app.view().gui!.battleEntry).toBe(true);
          expect(app.view().gui!.detailLines.some((l) => l.text.includes(app.session!.state.definitions[gui.rows[row]!.tiles[slot]!.cardId]!.name))).toBe(true);
          const session = app.session!;
          const chosen: string[] = [];
          const choose = session.chooseHuman.bind(session);
          session.chooseHuman = (index) => {
            const action = session.humanOptions()[index]!.action as { type: string; defenderInstanceId?: string };
            chosen.push(`${action.type}:${action.defenderInstanceId}`);
            return choose(index);
          };
          app.dispatch(input.focusTile(row, slot, true));
          if (app.view().gui?.list) app.dispatch(input.confirm);
          session.chooseHuman = choose;
          expect(session.version).toBeGreaterThan(version);
          expect(chosen).toEqual([`battle:${defender}`]);
          attacked = true;
        } else {
          app.dispatch(input.select(rows.length - 1, true));
          expect(app.session!.version).toBeGreaterThan(version);
          expect(app.session!.state.pendingBattleEntry?.instanceId).not.toBe(entering);
          passed = true;
        }
      }
      if (attacked && passed) break;
    }
    expect(attacked && passed).toBe(true);
  });

  it("asks the start phase's steps in a popup when assist leaves them to the player", () => {
    const app = startGui(3);
    app.updateSettings({ autoStart: false });
    let steps = 0;
    for (let i = 0; i < 6000 && app.currentScreen === "match" && steps < 3; i++) {
      const state = app.session!.state;
      if (!humanTurn(app) || state.phase !== "start" || state.activePlayer !== "player1" || app.view().gui!.dialog) {
        if (humanTurn(app)) playOneStep(app, i);
        else app.tick();
        continue;
      }
      const gui = app.view().gui!;
      expect(gui.startPhase).toBe(true);
      expect(gui.popup!.title).toBe("スタートフェイズ");
      const labels = app.session!.humanOptions().filter((o) => o.action.type !== "end_phase").map((o) => o.label);
      expect(gui.popup!.rows.map((r) => r.text).slice(0, labels.length).sort()).toEqual([...labels].sort());
      const version = app.session!.version;
      app.dispatch(input.select(0, true));
      expect(app.session!.version).toBeGreaterThan(version);
      steps++;
    }
    expect(steps).toBeGreaterThanOrEqual(3);
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

describe("dropCardName", () => {
  it("drops the card's own name", () => {
    expect(dropCardName("アタック: アバレッド → アバレッド", "アバレッド")).toBe("アタック → アバレッド");
    expect(dropCardName("コマンドを支払って使う: 芋長の芋ヨーカン（種類:カテゴリ）", "芋長の芋ヨーカン")).toBe("コマンドを支払って使う（種類:カテゴリ）");
  });

  it("keeps a longer name that starts with it", () => {
    expect(dropCardName("ラッシュ: アバレッドAM / アバレッド", "アバレッド")).toBe("ラッシュ: アバレッドAM / アバレッド");
  });
});

describe("morph order", () => {
  // A shared board (RK-146 デネブ rushed; two CPU morph units can react). The turn player orders them
  // (wiki p1827), so the human picks a CPU unit. Without a selection window the board looked frozen.
  it("asks the rusher which of the opponent's morph units goes first in the selection window", () => {
    const app = startGui(5);
    const payload = parseSharePayload(JSON.parse(readFileSync(new URL("./fixtures/share-rk146-morph-order.json", import.meta.url), "utf8")))!;
    app.startSharedMatch(payload);
    for (let i = 0; i < 5; i++) app.tick();
    const dialog = app.view().gui!.dialog!;
    expect(dialog.titleLines[0]!.text).toContain("モーフの順番");
    expect(dialog.cards.map((c) => c.instanceId)).toEqual(["XG5-052-41", "XG2-045-59"]);
    app.dispatch(input.confirm);
    for (let i = 0; i < 50; i++) app.tick();
    const session = app.session!;
    expect(session.state.pendingMorph).toBeUndefined();
    expect(session.humanOptions().some((o) => o.action.type === "end_phase")).toBe(true);
  });
});

describe("rush with an extra command hold", () => {
  // A shared board: XG7-037 (ET, 「追加で自軍コマンドを1つホールドする」) in hand, power 3, and only unit cards
  // in the command zone. Commands are any cards there (atwiki/page-151), but only operations used to count as
  // the extra hold, so the rush was never offered.
  it("offers XG7-037's rush when the only spare commands are unit cards", () => {
    const app = startGui(5);
    const payload = parseSharePayload(JSON.parse(readFileSync(new URL("./fixtures/share-xg7-037-rush.json", import.meta.url), "utf8")))!;
    app.startSharedMatch(payload);
    const rushes = app.session!.humanOptions().filter((o) => o.action.type === "initiate_command_payment" && o.action.sourceInstanceId === "XG7-037-1");
    expect(rushes.length).toBeGreaterThan(0);
  });
});

describe("battle phase that cannot end yet", () => {
  // RS-022 アースの力「すべてのユニットは可能なら毎ターンバトルエリアに出る」: ホールドして出せるなら出す義務がある（公式 FAQ1 RS-022）。
  // エンジンは出すまで end_phase を出さないので、以前は終了ボタンが効かず、理由も出ず止まって見えた。
  // CPU 同士（Lv1）で アバレンジャー 対 青のナイン B を seed 1 で進めると、472 手目でこの局面になる。
  function earthForceBoard() {
    let state = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "blue-nine-b", seed: 1 });
    for (let step = 0; step < 472; step++) {
      const actor = testEngine.isCpuTurn(state, "player2") ? "player2" : testEngine.getActionPlayerId(state);
      const action = testEngine.pickCpuAction(state, actor, 1) ?? testEngine.pickCpuFallbackAction(state, actor)!;
      const result = testEngine.applyAction(state, action);
      state = (result.ok ? result : testEngine.applyAction(state, testEngine.pickCpuFallbackAction(state, actor)!)).state!;
    }
    return state;
  }

  it("says which units must enter, and R offers their entry instead of the full menu", () => {
    const app = startGui(5);
    const session = app.session!;
    session.state = earthForceBoard();
    session.version++;
    const types = session.humanOptions().map((o) => o.action.type);
    expect(session.state.phase).toBe("battle");
    expect(types).not.toContain("end_phase");
    expect(types).toContain("initiate_command_payment");
    const gui = app.view().gui!;
    expect(gui.footer).toContain("出すまで終われません");
    expect(gui.footer).toContain("爆竜ティラノサウルス");
    expect(gui.endButton.enabled).toBe(true);
    app.dispatch(input.menu);
    const popup = app.view().gui!.popup!;
    expect(popup.title).toContain("バトルエリアに出す");
    expect(app.view().gui!.toast).toContain("可能ならバトルエリアに出る");
  });
});

describe("cards an effect shows", () => {
  it("opens a reveal window for a new lastReveal and holds the CPU until it is closed", () => {
    const app = startGui(5);
    const session = app.session!;
    const card = session.state.players.player2.deck[0]!;
    session.state = {
      ...session.state,
      lastReveal: { seq: 1, playerId: "player2", ownerId: "player2", effectLabel: "潜行捜索", from: "deck_top", cards: [{ instanceId: card.instanceId, cardId: card.cardId, destination: "hand" }] },
    };
    session.version++;
    const dialog = app.view().gui!.dialog!;
    expect(dialog.titleLines[0]!.text).toContain("CPUが山札の上から1枚オモテにした");
    expect(dialog.cards.map((c) => c.caption)).toEqual(["手札へ"]);
    expect(dialog.cards[0]!.kind).not.toBe("hidden");
    const version = session.version;
    for (let i = 0; i < 20; i++) app.tick();
    expect(session.version).toBe(version);
    app.dispatch(input.confirm);
    expect(app.view().gui!.dialog?.buttons.map((b) => b.text)).not.toEqual(["閉じる"]);
  });

  it("shows the deck card a choice is looking at (RM-017 オメデトロフィー)", () => {
    const app = startGui(5);
    const session = app.session!;
    const top = session.state.players.player1.deck[0]!;
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "rm017_omedetrophy",
        sourceCardId: "RM-017",
        kind: "confirm",
        validInstanceIds: ["deck_top", "deck_bottom"],
        selectCount: 1,
        optional: false,
        rm1Meta: { topInstanceId: top.instanceId },
      } as never,
    };
    session.version++;
    const dialog = app.view().gui!.dialog!;
    expect(dialog.cards.map((c) => [c.instanceId, c.caption])).toEqual([[top.instanceId, "見ている"]]);
    expect(dialog.buttons.map((b) => b.text)).toEqual(["選ぶ: 山札の上", "選ぶ: 山札の下"]);
    // Picking the card itself does nothing; the buttons still answer the choice.
    app.dispatch(input.confirm);
    expect(session.state.pendingEffectChoice?.effectId).toBe("rm017_omedetrophy");
  });

  it("says in the selection window what an optional effect does (XG3-046 撃破されたとき)", () => {
    for (const viewport of [VITA, { width: 390, height: 844 }]) {
      const app = new AppController({ platform: testPlatform(), viewport, cpuDelayFrames: 0, seed: () => 5, gui: true });
      app.dispatch(input.select(3, true));
      const session = app.session!;
      session.state = {
        ...session.state,
        activePlayer: "player2",
        pendingEffectChoice: {
          playerId: "player1",
          phasePlayerId: "player2",
          effectId: "xg3046_black_damage",
          sourceCardId: "XG3-046",
          kind: "confirm",
          validInstanceIds: ["accept"],
          optional: true,
        } as never,
      };
      session.version++;
      const dialog = app.view().gui!.dialog!;
      const text = dialog.titleLines.map((l) => l.text).join("");
      expect(text).toContain("※敵軍ターン中、これが撃破されて");
      // Only the effect asked about, not the card's other one.
      expect(text).not.toContain("キングストーンフラッシュ");
      expect(dialog.buttons.map((b) => b.text)).toEqual(["選ぶ: 使う", "選ばない"]);
      // The text sits above the buttons, inside the window.
      const last = dialog.titleLines[dialog.titleLines.length - 1]!;
      expect(last.rect.y + last.rect.h).toBeLessThanOrEqual(dialog.buttons[0]!.rect.y);
    }
  });

  it("opens a whole-deck search on the card that can be picked (XG3-061【キャストオフ】)", () => {
    const app = startGui(5);
    const session = app.session!;
    const deck = session.state.players.player1.deck.map((c) => c.instanceId);
    const pick = deck[deck.length - 1]!;
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "castoff_deck_rush",
        sourceCardId: "XG3-061",
        kind: "scry_keep_one",
        validInstanceIds: [pick],
        viewedInstanceIds: deck,
        selectCount: 1,
        optional: false,
        unitDestination: "rush",
      } as never,
    };
    session.version++;
    const dialog = app.view().gui!.dialog!;
    // The deck cards shown only to look at come after it, not in front of it on the first page.
    expect(dialog.cards[0]).toMatchObject({ instanceId: pick, actionable: true, focused: true });
    expect(dialog.cards.slice(1).every((c) => !c.actionable)).toBe(true);
    const version = session.version;
    app.dispatch(input.confirm);
    expect(session.version).not.toBe(version);
  });

  it("asks whether to activate before showing the deck top (XG7-042【ライダー大戦の世界】, engine rules/revealGate.ts)", () => {
    const app = startGui(5);
    const session = app.session!;
    const top = session.state.players.player1.deck.slice(0, 5).map((c) => c.instanceId);
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "xg7042_rider_war",
        sourceCardId: "XG7-042",
        kind: "select_unit",
        validInstanceIds: top,
        selectCount: 1,
        optional: true,
        revealGate: true,
      },
    };
    session.version++;
    let dialog = app.view().gui!.dialog!;
    // Before activating: no deck card, only 発動する / 発動しない.
    expect(dialog.cards).toEqual([]);
    expect(dialog.buttons.map((b) => b.text)).toEqual(["発動する", "発動しない"]);
    // The cursor starts on 発動する.
    expect(dialog.buttons.find((b) => b.selected)?.text).toBe("発動する");
    app.dispatch(input.confirm);
    // After activating: the five cards are shown to pick from, and it can no longer be declined.
    dialog = app.view().gui!.dialog!;
    expect(dialog.cards.length).toBeGreaterThan(0);
    expect(dialog.cards.map((c) => c.instanceId)).toEqual(top.slice(0, dialog.cards.length));
    expect(dialog.cards.every((c) => c.actionable)).toBe(true);
    expect(dialog.buttons.map((b) => b.text)).not.toContain("選ばない");
  });
});

describe("picking a card stacked in the operation zone", () => {
  it("lists cards stacked on a resident operation as pickable cards (XG6-048【鏡像の戦士】)", () => {
    const app = startGui(5);
    const session = app.session!;
    const p1 = session.state.players.player1;
    const [host, up, down, ...deck] = p1.deck;
    session.state = {
      ...session.state,
      activePlayer: "player1",
      players: {
        ...session.state.players,
        player1: { ...p1, deck, operation: [{ ...host!, stackedCards: [up!, { ...down!, faceDown: true }] }] },
      },
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "xg6048_mirror",
        sourceCardId: "XG6-048",
        kind: "select_hand",
        validInstanceIds: [host!.instanceId, up!.instanceId, down!.instanceId],
        selectCount: 1,
        optional: true,
      },
    };
    session.version++;
    const dialog = app.view().gui!.dialog!;
    expect(dialog.cards.map((c) => c.instanceId)).toEqual([host!.instanceId, up!.instanceId, down!.instanceId]);
    expect(dialog.cards.every((c) => c.actionable)).toBe(true);
    expect(dialog.cards.map((c) => c.caption)).toEqual(["自常駐", "自重ね", "自重ね"]);
    // A face-down stacked card (クロックアップ) shows its back.
    expect(dialog.cards[2]!.kind).toBe("hidden");
    expect(dialog.cards[1]!.kind).not.toBe("hidden");
  });
});

describe("choosing the order to put cards on the deck bottom", () => {
  it("numbers the cards as they are picked, keeps them in place, then offers to confirm the order (XG1-077【ライドブッカー】)", () => {
    const app = startGui(5);
    const session = app.session!;
    const bottom = session.state.players.player1.deck.slice(-3).map((c) => c.instanceId);
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "deck_bottom_order",
        sourceCardId: "XG1-077",
        kind: "select_unit",
        validInstanceIds: bottom,
        selectedInstanceIds: [],
        selectCount: 3,
        optional: false,
        deckOrderMeta: { ids: bottom, undos: 0, to: "bottom" },
      },
    };
    session.version++;
    let dialog = app.view().gui!.dialog!;
    expect(dialog.titleLines.map((l) => l.text).join("")).toContain("山札の下に戻す順");
    expect(dialog.cards.map((c) => c.instanceId)).toEqual(bottom);
    expect(dialog.cards.every((c) => c.actionable && !c.order)).toBe(true);
    app.dispatch(input.confirm);
    dialog = app.view().gui!.dialog!;
    expect(dialog.cards.map((c) => c.instanceId)).toEqual(bottom);
    expect(dialog.cards.map((c) => c.order ?? 0)).toEqual([1, 0, 0]);
    expect(dialog.cards[0]!.note).toBe("1番目");
    expect(dialog.buttons.map((b) => b.text)).toEqual(["選ぶ: 選び直す"]);
  });

  it("keeps numbered cards in place and offers to confirm once every card has a number", () => {
    const app = startGui(5);
    const session = app.session!;
    const bottom = session.state.players.player1.deck.slice(-3).map((c) => c.instanceId);
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "deck_bottom_order",
        sourceCardId: "XG1-077",
        kind: "select_unit",
        validInstanceIds: ["order_done", bottom[2]!, bottom[0]!, bottom[1]!, "order_reset"],
        selectedInstanceIds: [bottom[2]!, bottom[0]!, bottom[1]!],
        selectCount: 3,
        optional: false,
        deckOrderMeta: { ids: bottom, undos: 0, to: "bottom" },
      },
    };
    session.version++;
    const dialog = app.view().gui!.dialog!;
    expect(dialog.cards.map((c) => c.instanceId)).toEqual(bottom);
    expect(dialog.cards.map((c) => c.order)).toEqual([2, 3, 1]);
    // A numbered card can be picked again to take its number off.
    expect(dialog.cards.every((c) => c.actionable)).toBe(true);
    expect(dialog.buttons.map((b) => b.text)).toEqual(["選ぶ: この順で戻す", "選ぶ: 選び直す"]);
  });

  it("draws every line of a two-line question in the accent colour", () => {
    const app = startGui(5);
    const session = app.session!;
    const bottom = session.state.players.player1.deck.slice(-3).map((c) => c.instanceId);
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "deck_bottom_order",
        sourceCardId: "XG7-042",
        kind: "select_unit",
        validInstanceIds: bottom,
        selectedInstanceIds: [],
        selectCount: 3,
        optional: false,
        deckOrderMeta: { ids: bottom, undos: 0, to: "bottom" },
      },
    };
    session.version++;
    const lines = app.view().gui!.dialog!.titleLines;
    const source = lines.findIndex((l) => l.text.startsWith("カード:"));
    expect(source).toBeGreaterThan(1);
    expect(lines.slice(0, source).every((l) => l.tone === "accent")).toBe(true);
    expect(lines[source]!.tone).toBe("dim");
  });
});

describe("windows that keep cards or rows out of view", () => {
  it("pages the selection window's cards and buttons with ▲▼ marks (a phone has no wheel)", () => {
    const app = startGui(5);
    const session = app.session!;
    const deck = session.state.players.player1.deck.slice(0, 20).map((c) => c.instanceId);
    session.state = {
      ...session.state,
      activePlayer: "player1",
      pendingEffectChoice: {
        playerId: "player1",
        phasePlayerId: "player1",
        effectId: "rk319_deck_search",
        sourceCardId: "RK-319",
        kind: "select_unit",
        validInstanceIds: deck,
        selectCount: 1,
        optional: true,
      } as never,
    };
    session.version++;
    let dialog = app.view().gui!.dialog!;
    const shownCards = dialog.cards.length;
    expect(shownCards).toBeLessThan(deck.length);
    const next = dialog.marks.find((m) => m.area === "cards" && m.direction === 1)!;
    expect(next.text).toBe(`▼ 次へ（${deck.length - shownCards}枚）`);
    // A tap on the mark shows the next page.
    app.dispatch(hitTestGui(app.view().gui!, { x: next.rect.x + 2, y: next.rect.y + 2 })!);
    dialog = app.view().gui!.dialog!;
    expect(dialog.moreLeft).toBe(shownCards);
    expect(dialog.marks.some((m) => m.area === "cards" && m.direction === -1)).toBe(true);
    // Every card can be reached, the last one included.
    for (let i = 0; i < 10; i++) app.dispatch(input.scroll("cards", 1));
    dialog = app.view().gui!.dialog!;
    expect(dialog.cards.map((c) => c.instanceId)).toContain(deck[deck.length - 1]);
    expect(dialog.moreRight).toBe(0);
  });

  it("pages a list longer than its window", () => {
    const app = startGui(5);
    const gui = () => app.view().gui!;
    app.dispatch(input.allActions);
    const list = gui().list;
    expect(list?.marks?.length).toBeGreaterThan(0);
    const before = list.rows[0]!.text;
    app.dispatch(input.scroll("rows", 1));
    expect(gui().list!.rows[0]!.text).not.toBe(before);
  });
});
