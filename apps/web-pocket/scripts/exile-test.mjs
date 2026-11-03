#!/usr/bin/env node
// Browser check of the 除外 (removed from the game) display, PC and phone:
//   npm run web:build   (once; web:build:app after UI-only changes)
//   npm run web:exile-test
// Serves dist/ on a spare port, starts a match, moves deck cards to both
// players' exile zones and checks that
//   - nothing about 除外 shows while the zone is empty,
//   - the pile column gets a 「除外 N」 row (under 山札/捨札, above パワー) and the strip 除N,
//   - hovering (PC) / tapping (phone) the row shows every removed card, newest first.
// Uses the Playwright + Chromium preinstalled in the dev container (or any `playwright` on the path).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8100 + Math.floor(Math.random() * 30);
const HUMAN = "player1";
const CPU = "player2";

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

const server = spawn(process.execPath, [resolve(HERE, "serve.mjs"), `--port=${PORT}`], { stdio: "ignore" });
const base = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

// A project-local playwright may not match the preinstalled browsers: fall back to the container's Chromium.
const browser = await chromium.launch().catch(() =>
  chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] }),
);
try {
  for (const [name, viewport, touch] of [
    ["PC", { width: 1280, height: 800 }, false],
    ["スマホ", { width: 390, height: 844 }, true],
  ]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(() => globalThis.__rsApp?.controller, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => globalThis.__rsApp.controller.startMatch());
    await page.waitForFunction(() => globalThis.__rsApp.controller.session, null, { timeout: 30000 });
    // Redraw (a key press rebuilds the view from the current state).
    const redraw = async () => {
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(300);
    };
    await redraw();
    const read = () =>
      page.evaluate(([h, c]) => {
        const app = globalThis.__rsApp;
        const state = app.controller.session.state;
        const gui = app.controller.view().gui;
        return {
          piles: [h, c].map((p) => app.pile(p).sections.map((s) => ({ label: s.label, rect: s.labelRect }))),
          counts: [h, c].map((p) => app.pile(p).counts.map((r) => r.rect)),
          strips: gui.strips,
          exile: [h, c].map((p) => (state.players[p].exile ?? []).map((x) => x.cardId)),
        };
      }, [HUMAN, CPU]);

    let v = await read();
    check(`${name}: 除外 0 枚ではパイル列に「除外」が出ない`, v.piles.every((s) => !s.some((x) => x.label.startsWith("除外"))), JSON.stringify(v.piles));
    check(`${name}: 除外 0 枚では帯に「除」が出ない`, v.strips.every((t) => !t.includes("除")), JSON.stringify(v.strips));

    await page.evaluate(([h, c]) => {
      const state = globalThis.__rsApp.controller.session.state;
      state.players[h].exile = state.players[h].deck.splice(0, 3);
      state.players[c].exile = state.players[c].deck.splice(0, 2);
    }, [HUMAN, CPU]);
    await redraw();
    v = await read();

    for (const [i, who, n] of [[0, "自分", 3], [1, "CPU", 2]]) {
      const sections = v.piles[i];
      const row = sections.find((s) => s.label.startsWith("除外"));
      const power = sections.find((s) => s.label.startsWith("パワー"));
      check(`${name}: ${who}のパイル列に「除外 ${n}」`, row?.label === `除外 ${n}`, JSON.stringify(sections.map((s) => s.label)));
      if (!row || !power) continue;
      const countsBottom = Math.max(...v.counts[i].map((r) => r.y + r.h));
      check(`${name}: ${who}の「除外」行は山札・捨札の下、パワーの上で重ならない`, row.rect.y >= countsBottom && row.rect.y + row.rect.h <= power.rect.y, JSON.stringify({ row: row.rect, power: power.rect, countsBottom }));
      // gui.strips is [CPU, あなた].
      const strip = v.strips[i === 0 ? 1 : 0];
      check(`${name}: ${who}の帯に「除${n}」`, strip.includes(` 除${n} `), strip);
    }

    // Hover (PC) or tap (phone) the own 除外 row: the enlarged view lists every removed card, newest first.
    const row = v.piles[0].find((s) => s.label.startsWith("除外"));
    if (row) {
      const scale = await page.evaluate(() => {
        const g = globalThis.__rsApp.controller.view().gui.geometry;
        return document.querySelector("canvas").getBoundingClientRect().width / g.width;
      });
      const x = (row.rect.x + row.rect.w / 2) * scale;
      const y = (row.rect.y + row.rect.h / 2) * scale;
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.move(x, y);
      await page.waitForTimeout(400);
      const peek = await page.evaluate(() => {
        const p = globalThis.__rsApp.peek();
        return p && { title: p.title, cards: p.cards.map((c) => c.cardId) };
      });
      check(`${name}: 「除外」に${touch ? "タップ" : "マウスを乗せる"}と「自分の除外（3枚）」が開く`, peek?.title === "自分の除外（3枚）", JSON.stringify(peek));
      check(`${name}: 除外カードが新しい順に全部並ぶ`, JSON.stringify(peek?.cards) === JSON.stringify([...v.exile[0]].reverse()), JSON.stringify({ shown: peek?.cards, exile: v.exile[0] }));
      const shown = await page.evaluate(() => globalThis.__rsApp.peekCards()?.length ?? 0);
      check(`${name}: 拡大表示に 3 枚描かれる`, shown === 3, String(shown));
    }
    check(`${name}: ページのエラーなし`, errors.length === 0, errors.join(" / "));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failures ? `\n${failures} 件失敗` : "\nすべて通過");
process.exit(failures ? 1 : 0);
