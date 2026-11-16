#!/usr/bin/env node
// Browser check of 対人戦（オンライン）, two browsers against the local server (scripts/serve.mjs, in-memory rooms):
//   npm run web:build   (once; web:build:app after UI-only changes)
//   npm run web:online-test [-- --shots=<dir>] [-- --moves=<n>]
// The host (PC, 1280x800) opens the lobby, picks 自分が先攻 and makes a room; the guest (phone, 390x844) opens the
// invite URL (?m=<id>) and joins. Both then play random moves from their own screen's choices, each sent through
// the real fetch → /api/match → engine path, and the test checks that
//   - both screens reach the same server version (no freeze: a stall of 30 s fails),
//   - the host's answer from the server shows the guest's hand only as "?",
//   - a reload of the guest page goes back into the same match (the room is kept in localStorage),
//   - the guest resigns with the two-press 投了 and both screens show the result (host 勝利, guest 敗北),
//   - the board calls the other side 「相手」 (not 「CPU」),
//   - no page errors.
// With --shots, screenshots of the lobby, the waiting room, the join screen, the match and the results land there.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8130 + Math.floor(Math.random() * 30);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SHOTS = arg("shots", null);
const MOVES = Number(arg("moves", "60"));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

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

const browser = await chromium.launch().catch(() =>
  chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] }),
);

async function open(name, viewport, touch, url = base) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => globalThis.__rsApp?.controller, null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  return { name, ctx, page, errors };
}

const shot = async (who, file) => {
  if (!SHOTS) return;
  await who.page.waitForTimeout(400);
  await who.page.screenshot({ path: resolve(SHOTS, file) });
};
const lobbyKind = (who) => who.page.evaluate(() => globalThis.__rsApp.lobby.state().kind);
const status = (who) =>
  who.page.evaluate(() => {
    const app = globalThis.__rsApp;
    const s = app.controller.remoteSession;
    return s
      ? { version: s.match.version, status: s.match.status, busy: s.busy, owner: s.turnOwner(), screen: app.controller.view().screen, you: s.you }
      : { screen: app.controller.view().screen };
  });

try {
  const host = await open("ホスト（PC）", { width: 1280, height: 800 }, false);
  await host.page.evaluate(() => globalThis.__rsApp.lobby.open());
  await shot(host, "1-lobby-pc.png");
  await host.page.evaluate(() => {
    const app = globalThis.__rsApp;
    app.lobby.setFirst("host");
    app.lobby.create(app.controller.onlineDeck());
  });
  await host.page.waitForFunction(() => globalThis.__rsApp.lobby.state().kind === "waiting", null, { timeout: 15000 });
  const invite = await host.page.evaluate(() => globalThis.__rsApp.lobby.state().url);
  check("ホスト: 部屋を作ると招待 URL（/?m=<8文字>）ができる", /\/\?m=[A-Za-z0-9]{8}$/.test(invite), invite);
  await shot(host, "2-waiting-pc.png");

  const guest = await open("ゲスト（スマホ）", { width: 390, height: 844 }, true, invite);
  check("ゲスト: 招待 URL を開くと参加画面", (await lobbyKind(guest)) === "join");
  check("ゲスト: 招待の ?m= はアドレスバーから消える", !(await guest.page.evaluate(() => location.search.includes("m="))));
  await shot(guest, "3-join-phone.png");
  await guest.page.evaluate(() => {
    const app = globalThis.__rsApp;
    app.lobby.join(app.controller.onlineDeck());
  });
  await guest.page.waitForFunction(() => globalThis.__rsApp.controller.remoteSession, null, { timeout: 15000 });
  await host.page.waitForFunction(() => globalThis.__rsApp.controller.remoteSession, null, { timeout: 15000 });
  const [h0, g0] = [await status(host), await status(guest)];
  check("両方の画面で対戦が始まる", h0.status === "playing" && g0.status === "playing", JSON.stringify([h0, g0]));
  check("ホストが先攻（自分が先攻を選んだ）", h0.owner === "human" && g0.owner === "remote", JSON.stringify([h0, g0]));
  const titles = await host.page.evaluate(() => globalThis.__rsApp.pile("player2").sections.map((x) => x.title));
  check("盤面では相手を「CPU」でなく「相手」と呼ぶ", titles.some((t) => t.startsWith("相手の")) && !titles.some((t) => t.includes("CPU")), JSON.stringify(titles));
  await shot(host, "4-match-pc.png");
  await shot(guest, "4-match-phone.png");

  // Both play random moves from their own choices until MOVES moves were sent.
  let rand = 12345;
  const next = () => ((rand = (Math.imul(rand, 1103515245) + 12345) >>> 0) / 2 ** 32);
  let moves = 0;
  let lastProgress = Date.now();
  let lastVersion = -1;
  let reloaded = false;
  let guestPage = guest;
  while (moves < MOVES) {
    if (Date.now() - lastProgress > 30000) {
      check("止まらずに進む", false, JSON.stringify([await status(host), await status(guestPage)]));
      break;
    }
    for (const who of [host, guestPage]) {
      const picked = await who.page.evaluate((r) => {
        const s = globalThis.__rsApp.controller.remoteSession;
        if (!s || s.over || s.busy || s.turnOwner() !== "human") return null;
        const options = s.humanOptions();
        if (options.length === 0) return null;
        const out = s.chooseHuman(Math.floor(r * options.length));
        return out.ok ? out.label ?? "" : `error ${out.error}`;
      }, next());
      if (picked !== null) {
        if (picked.startsWith("error")) check(`${who.name}: 選んだ手が送れる`, false, picked);
        moves++;
      }
    }
    const [h, g] = [await status(host), await status(guestPage)];
    if (h.status !== "playing" || g.status !== "playing") break;
    const v = Math.max(h.version, g.version);
    if (v !== lastVersion) {
      lastVersion = v;
      lastProgress = Date.now();
    }
    if (!reloaded && moves >= MOVES / 2) {
      // The host's answer from the server never carries the guest's hand.
      const leak = await host.page.evaluate(async () => {
        const room = JSON.parse(localStorage.getItem("rs.online.v1"));
        const text = await (await fetch(`/api/match?id=${room.id}&t=${room.token}`)).text();
        const hand = JSON.parse(text).view.view.state.players.player2.hand;
        // Real instance ids (RS-001-12 …) carry card numbers: the view has only aliases.
        const realIds = text.match(/"[A-Za-z]{1,4}\d?-\d{3}-\d+"/g) ?? [];
        return { size: hand.length, shown: hand.filter((c) => c.cardId !== "?").length, realIds: realIds.slice(0, 3) };
      });
      check("ホストに届く盤面では相手の手札が「?」", leak.size > 0 && leak.shown === 0, JSON.stringify(leak));
      check("ホストに届く盤面に本当のカード ID がない", leak.realIds.length === 0, JSON.stringify(leak.realIds));
      // A reload of the guest goes back into the same match.
      await guestPage.page.reload();
      await guestPage.page.waitForFunction(() => globalThis.__rsApp?.controller.remoteSession, null, { timeout: 30000 });
      const after = await status(guestPage);
      check("ゲスト: 再読み込みしても同じ対戦に戻る", after.status === "playing" && after.you === "player2", JSON.stringify(after));
      reloaded = true;
      lastProgress = Date.now();
    }
    await host.page.waitForTimeout(120);
  }
  check(`${MOVES} 手まで進む`, moves >= MOVES || (await status(host)).status === "finished", `${moves} 手`);
  // Both screens catch up with the server.
  await host.page.waitForTimeout(3500);
  const [h1, g1] = [await status(host), await status(guestPage)];
  check("両方の画面が同じ版の盤面", h1.version === g1.version, JSON.stringify([h1, g1]));
  await shot(host, "5-midgame-pc.png");
  await shot(guestPage, "5-midgame-phone.png");

  if (g1.status === "playing") {
    // 投了 is two presses of the leave button (the first one only asks).
    const tapLeave = async () => {
      const at = await guestPage.page.evaluate(() => {
        const app = globalThis.__rsApp;
        const r = app.buttons().leave;
        const scale = document.querySelector("canvas").getBoundingClientRect().width / app.controller.view().gui.geometry.width;
        return { x: (r.x + r.w / 2) * scale, y: (r.y + r.h / 2) * scale };
      });
      await guestPage.page.touchscreen.tap(at.x, at.y);
      await guestPage.page.waitForTimeout(400);
    };
    await tapLeave();
    await shot(guestPage, "5b-resign-ask-phone.png");
    check("ゲスト: 1回目の投了ボタンではまだ投了しない", (await status(guestPage)).status === "playing");
    await tapLeave();
    await guestPage.page.waitForFunction(() => globalThis.__rsApp.controller.view().screen === "result", null, { timeout: 15000 });
    await host.page.waitForFunction(() => globalThis.__rsApp.controller.view().screen === "result", null, { timeout: 15000 });
    const result = (who) =>
      who.page.evaluate(() => {
        const s = globalThis.__rsApp.controller.remoteSession;
        return { winner: s.winner, reason: s.match.result?.reason };
      });
    const [hr, gr] = [await result(host), await result(guestPage)];
    check("投了: ホストの画面は勝利", hr.winner === "player1" && hr.reason === "resign", JSON.stringify(hr));
    check("投了: ゲストの画面は敗北", gr.winner === "player2" && gr.reason === "resign", JSON.stringify(gr));
    await shot(host, "6-result-pc.png");
    await shot(guestPage, "6-result-phone.png");
  }
  // タイトルへ戻ると部屋は忘れる（再読み込みで戻らない）。
  await guestPage.page.evaluate(() => {
    const app = globalThis.__rsApp;
    localStorage.removeItem("rs.online.v1");
    app.controller.backToTitle();
  });
  check("ホスト: ページのエラーなし", host.errors.length === 0, host.errors.join(" / "));
  check("ゲスト: ページのエラーなし", guestPage.errors.length === 0, guestPage.errors.join(" / "));
} finally {
  await browser.close();
  server.kill();
}
console.log(failures ? `\n${failures} 件失敗` : "\nすべて通過");
process.exit(failures ? 1 : 0);
