#!/usr/bin/env node
// Finds text that runs out of its box, on the real screens (scripts/serve.mjs + the built dist/):
//   npm run web:build   (once; web:build:app after UI-only changes)
//   npm run web:overflow-check [-- --secs=120] [-- --viewports=phone,se,land,pc] [-- --shots=<dir>]
// Each viewport (phone 390x844, se 375x667, land 844x390, pc 1280x800) visits the title (and its 自動進行 panel),
// the deck builder, the 対人戦 lobby, then plays a CPU match with random moves for --secs seconds. Along the way it
// checks the board, the every-action list (Tab), a card's popup, the log, a long replay toast, the settings panel and
// the result screen.
//
// How: PocketJS draws text from a baked font into a canvas, so there is no DOM to measure. The page's `ui` ops are
// wrapped to keep the node tree (parents and texts); the core's DevTools op `debugInspect(id)` then reports each
// <Text> element's drawn rectangle (its width is the text's real width) and its ancestors' rectangles. A text wider
// than one of its four nearest ancestors, or past the screen's edge, is reported (with --shots, with a screenshot).
// Exits 1 when anything was found.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SECS = Number(arg("secs", "120"));
const SHOTS = arg("shots", null);
const VIEWPORTS = {
  phone: { width: 390, height: 844, mobile: true },
  se: { width: 375, height: 667, mobile: true },
  land: { width: 844, height: 390, mobile: true },
  pc: { width: 1280, height: 800, mobile: false },
};
const tags = arg("viewports", Object.keys(VIEWPORTS).join(",")).split(",");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PORT = 8160 + Math.floor(Math.random() * 20);
const server = spawn(process.execPath, [join(HERE, "serve.mjs"), `--port=${PORT}`], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}).catch(() =>
  chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] }),
);

/** Keeps the node tree the app builds through `globalThis.ui` (installed by host.js before the app starts). */
function trackTree() {
  const T = { parent: new Map(), text: new Map() };
  globalThis.__overflowTree = T;
  let real;
  Object.defineProperty(globalThis, "ui", {
    configurable: true,
    get: () => real,
    set: (ops) => {
      const w = { ...ops };
      Object.defineProperty(w, "__auxiliarySurface", { get: () => ops.__auxiliarySurface });
      w.destroyNode = (id) => (T.parent.delete(id), T.text.delete(id), ops.destroyNode(id));
      w.insertBefore = (p, c, a) => (T.parent.set(c, p), ops.insertBefore(p, c, a));
      w.removeChild = (p, c) => (T.parent.get(c) === p && T.parent.delete(c), ops.removeChild(p, c));
      w.setText = (id, s) => (T.text.set(id, String(s)), ops.setText(id, s));
      w.replaceText = (id, s) => (T.text.set(id, String(s)), ops.replaceText(id, s));
      T.ops = ops;
      real = w;
    },
  });
}

/** The texts on screen that run past an ancestor (up to 4 levels) or the screen's edge. */
function findOverflow() {
  return (async () => {
    const T = globalThis.__overflowTree;
    const ops = T.ops;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const texts = [...T.text.entries()].filter(([id, s]) => s.trim() && T.parent.has(id));
    const need = new Set();
    for (const [id] of texts) for (let p = T.parent.get(id), k = 0; p && k < 5; p = T.parent.get(p), k++) need.add(p);
    const rect = new Map();
    for (const id of need) {
      ops.debugInspect(id);
      await frame();
      const xy = ops.debugRectXY();
      const wh = ops.debugRectWH();
      if (xy !== -1 && wh !== -1) rect.set(id, { x: (xy << 16) >> 16, y: xy >> 16, w: wh & 0xffff, h: wh >> 16 });
    }
    ops.debugInspect(0);
    await frame();
    const screenW = ops.__viewport?.w ?? Infinity;
    const out = [];
    for (const [id, text] of texts) {
      const el = T.parent.get(id);
      const r = rect.get(el);
      if (!r) continue;
      let over = 0;
      for (let p = T.parent.get(el), k = 0; p && k < 4; p = T.parent.get(p), k++) {
        const a = rect.get(p);
        if (a && a.w >= 4) over = Math.max(over, r.x + r.w - (a.x + a.w), a.x - r.x);
      }
      over = Math.max(over, r.x + r.w - screenW, -r.x);
      if (over > 1) out.push({ text, over, rect: r });
    }
    return out;
  })();
}

async function checkViewport(tag) {
  const vp = VIEWPORTS[tag];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: vp.mobile, isMobile: vp.mobile });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(trackTree);
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => globalThis.__rsApp?.controller, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const found = new Map();
  const ctl = (fn, a) => page.evaluate(fn, a);
  // The app redraws on input: a key press after a controller call shows its screen.
  const settle = async (ms = 600) => {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(ms);
  };
  const tapAt = async (x, y) => {
    if (vp.mobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForTimeout(500);
  };
  const tapBox = (b) => tapAt(b.x + b.w / 2, b.y + b.h / 2);
  const tapText = async (needle) => {
    const at = await page.evaluate(async (needle) => {
      const T = globalThis.__overflowTree;
      const hit = [...T.text.entries()].filter(([id, s]) => s.includes(needle) && T.parent.has(id)).pop();
      if (!hit) return null;
      T.ops.debugInspect(T.parent.get(hit[0]));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const xy = T.ops.debugRectXY();
      const wh = T.ops.debugRectWH();
      T.ops.debugInspect(0);
      return xy === -1 ? null : { x: ((xy << 16) >> 16) + (wh & 0xffff) / 2, y: (xy >> 16) + (wh >> 16) / 2 };
    }, needle);
    if (at) await tapAt(at.x, at.y);
    return !!at;
  };
  const check = async (name) => {
    // Hold the match still (no CPU move, no replay frame) while the rectangles are read.
    await ctl(() => {
      const c = globalThis.__rsApp.controller;
      c.__tick = c.tick;
      c.tick = () => false;
    });
    const hits = await page.evaluate(findOverflow);
    await ctl(() => {
      const c = globalThis.__rsApp.controller;
      c.tick = c.__tick;
    });
    const fresh = hits.filter((h) => !found.has(h.text));
    for (const h of fresh) found.set(h.text, { ...h, screen: name });
    if (fresh.length && SHOTS) await page.screenshot({ path: join(SHOTS, `${tag}-${name}.png`) });
  };

  await check("title");
  if (await tapText("自動進行の設定")) {
    await check("title-auto");
    await tapText("閉じる");
  }
  await ctl(() => globalThis.__rsApp.controller.openDeckBuilder());
  await settle();
  await check("deck");
  await ctl(() => globalThis.__rsApp.controller.backToTitle());
  await settle();
  if (await tapText("対人戦（オンライン）")) await check("online");
  await ctl(() => globalThis.__rsApp.controller.backToTitle());
  await settle();

  await ctl(() => globalThis.__rsApp.controller.startMatch());
  await settle(1000);
  const end = Date.now() + SECS * 1000;
  for (let n = 1; Date.now() < end; n++) {
    const state = await ctl(() => {
      const c = globalThis.__rsApp.controller;
      const s = c.session;
      const r = c.replayView();
      if (!s || s.over) return "over";
      if (s.turnOwner() !== "human" || (r && r.event)) return "cpu";
      const options = s.humanOptions();
      if (options.length && Math.random() < 0.5) s.chooseHuman(Math.floor(Math.random() * options.length));
      return "human";
    });
    if (state === "over") {
      await settle();
      await check("result");
      await ctl(() => globalThis.__rsApp.controller.startMatch());
      await settle(1000);
      continue;
    }
    await page.waitForTimeout(150);
    if (n % 12 !== 0) continue;
    await settle(200);
    await check("board");
    if (state === "human") {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(400);
      await check("every-action");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const tile = await ctl(() => {
        const tiles = globalThis.__rsApp.controller.view().gui?.rows.flatMap((r) => r.tiles).filter((t) => t.actionable) ?? [];
        return tiles[Math.floor(Math.random() * tiles.length)]?.rect ?? null;
      });
      if (tile) {
        await tapBox(tile);
        await check("popup");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }
    if (n % 48 === 0) {
      await page.keyboard.press("KeyL");
      await page.waitForTimeout(400);
      await check("log");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }
  await ctl(() => {
    const c = globalThis.__rsApp.controller;
    c.replay?.clear();
    c.replay?.push([
      {
        kind: "effect",
        actor: "player2",
        cardId: "RS-001",
        title: "【アーマーアタック】超重甲ビーファイターカブト・ゴールデンアーマー の効果を発動した",
        detail: "【アーマーアタック】敵軍バトル・ラッシュエリアにいるユニット1体を選び、そのユニットを撃破する。あなたのコマンド「ビートルボーグ」をホールドした",
      },
    ]);
  });
  await settle(700);
  await check("toast");
  const buttons = await ctl(() => globalThis.__rsApp.buttons());
  if (buttons) {
    await tapBox(buttons.settings);
    await check("settings");
    await tapText("閉じる");
    await tapBox(buttons.leave);
    await tapBox(buttons.leave);
    await page.waitForTimeout(1000);
    await check("result");
  }
  await context.close();
  return { tag, found: [...found.values()], errors };
}

let failed = false;
try {
  const results = await Promise.all(tags.map(checkViewport));
  for (const { tag, found, errors } of results) {
    console.log(`${tag}: ${found.length ? `${found.length} text(s) run out of their box` : "no overflow"}`);
    for (const f of found) console.log(`  [${f.screen}] ${f.over}px: ${f.text}`);
    for (const e of errors) console.log(`  page error: ${e}`);
    if (found.length || errors.length) failed = true;
  }
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
