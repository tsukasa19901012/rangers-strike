// 対人戦の画面側（remoteSession.ts）を、同じプロセスのサーバー（engine match.ts）とつないで最後まで遊ぶ。
//  - 両者の画面が、送った操作・相手の操作・時間切れのたびにサーバーの表示と同じ盤面になること。
//  - 通信が切れる（届かない・返事が消える）と、同じ通し番号で送り直し、操作が2回適用されないこと。
//  - 画面（GuiMatch）を指で操作するのと同じ入力で、player1 側でも player2 側でも決着まで進むこと。
import { describe, expect, it } from "vitest";
import * as engine from "@rangers-strike/engine";
import type { DeckSpec } from "@rangers-strike/engine";
import type { GameState, PlayerId } from "../engineApi";
import { AppController } from "../app/controller";
import { input } from "../input/actions";
import { testEngine, testPlatform } from "../testing/engine";
import { flush, localServer, type Fault, type LocalServer } from "../testing/matchTransport";
import { RemoteSession, type RemoteMatchView } from "./remoteSession";
import { screenState } from "./remoteView";

const PLAYERS: PlayerId[] = ["player1", "player2"];
const STEP_MS = 100;
const yieldToWorker = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const board = (state: GameState) => {
  const { definitions: _d, ...rest } = state;
  return canonical(rest);
};

function decks(g: number): [DeckSpec, DeckSpec] {
  const ids = engine.ALL_STARTER_DECK_IDS as readonly string[];
  return [{ starter: ids[g % ids.length]! }, { starter: ids[(g * 7 + 3) % ids.length]! }];
}

function serverView(server: LocalServer, player: PlayerId): RemoteMatchView {
  return JSON.parse(JSON.stringify(engine.matchView(server.match, player, server.deps))) as RemoteMatchView;
}

function newSession(server: LocalServer, player: PlayerId): RemoteSession {
  return new RemoteSession({ engine: testEngine, transport: server.transport(player), first: serverView(server, player), now: () => server.deps.now });
}

/** The move the CPU (Lv1) would make for the actor, as an index into the session's options (-1: none of them). */
function cpuOption(server: LocalServer, session: RemoteSession): number {
  const game = server.match.game!;
  const actor = engine.getActionPlayerId(game);
  if (actor !== session.you) return -1;
  const legal = engine.getLegalActions(game);
  const pick = engine.pickCpuAction(game, actor, 1) ?? legal[0];
  const index = legal.findIndex((a) => JSON.stringify(a) === JSON.stringify(pick));
  const want = session.screenLegal[index];
  if (!want) return -1;
  return session.humanOptions().findIndex((o) => JSON.stringify(o.action) === JSON.stringify(want));
}

/** Plays a whole match through two RemoteSessions. `idle` makes a player sit out now and then (time-outs). */
async function playRemote(g: number, options: { faults?: (player: PlayerId, kind: string) => Fault; idle?: () => boolean; roundTrip?: boolean }) {
  const rand = mulberry32(900 + g);
  const [host, guest] = decks(g);
  const server = localServer({ seed: g, host, guest, faults: options.faults, roundTrip: options.roundTrip });
  const sessions = PLAYERS.map((p) => newSession(server, p));
  const problems: string[] = [];
  let moves = 0;
  let frames = 0;
  for (; frames < 60_000 && !sessions.every((s) => s.over); frames++) {
    if (frames % 200 === 0) await yieldToWorker();
    server.deps.now += STEP_MS;
    for (const s of sessions) {
      s.frame();
      if (s.turnOwner() !== "human") continue;
      // On the person's turn with nothing on its way, the screen shows exactly the server's board (unless the
      // server has moved on since: a time-out the session has not polled yet).
      const now = serverView(server, s.you);
      if (now.version === s.match.version && board(s.state) !== board(screenState(now.view!))) {
        problems.push(`frame ${frames} ${s.you}: screen differs from the server`);
      }
      if (options.idle?.()) {
        server.deps.now += 200_000; // longer than a turn: the server plays on for this player
        continue;
      }
      const index = cpuOption(server, s);
      const pick = index >= 0 ? index : Math.floor(rand() * s.humanOptions().length);
      const result = s.chooseHuman(pick);
      if (!result.ok) problems.push(`frame ${frames} ${s.you}: ${result.error}`);
      moves++;
    }
    await flush();
    if (problems.length > 5) break;
  }
  return { server, sessions, problems, moves, frames };
}

describe("RemoteSession: 同じプロセスのサーバーと最後まで", () => {
  it.each([0, 1, 2, 3])("試合 %i: 両者の画面がサーバーと同じ盤面のまま決着まで進む", async (g) => {
    const { server, sessions, problems, moves } = await playRemote(g, { roundTrip: g % 2 === 1 });
    expect(problems).toEqual([]);
    expect(server.match.status).toBe("finished");
    expect(server.match.result?.reason).toBe("win");
    expect(moves).toBeGreaterThan(50);
    for (const s of sessions) {
      expect(s.over).toBe(true);
      expect(s.winner).toBe(server.match.result!.winner === s.you ? "player1" : "player2");
      expect(s.turnOwner()).toBe("none");
    }
    // The person who is player2 on the server is player1 on their own screen.
    expect(sessions[1]!.state.players.player1.damage).toBe(server.match.game!.players.player2.damage);
  }, 180_000);

  it.each([4, 5])("試合 %i: 通信が切れても同じ通し番号で送り直し、操作が2回適用されない", async (g) => {
    const rand = mulberry32(77 + g);
    const faults = (): Fault => {
      const r = rand();
      return r < 0.08 ? "lost_request" : r < 0.16 ? "lost_answer" : "none";
    };
    const { server, sessions, problems } = await playRemote(g, { faults });
    expect(problems).toEqual([]);
    expect(server.match.status).toBe("finished");
    expect(server.match.result?.reason).toBe("win");
    // Every move the server took was one the client meant once: replaying them gives the same board.
    const replayed = engine.replayMatch(server.match)!;
    expect(replayed.winner).toBe(server.match.game!.winner);
    for (const s of sessions) expect(s.winner).toBe(server.match.result!.winner === s.you ? "player1" : "player2");
  }, 180_000);

  it.each([6, 7])("試合 %i: ときどき放置して時間切れになっても、画面は止まらず決着まで進む", async (g) => {
    const rand = mulberry32(300 + g);
    const { server, sessions, problems } = await playRemote(g, { idle: () => rand() < 0.03 });
    expect(problems).toEqual([]);
    expect(server.match.status).toBe("finished");
    expect(server.match.autoActions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.over).toBe(true);
      const winner = server.match.result!.winner;
      expect(s.winner).toBe(winner === null ? null : winner === s.you ? "player1" : "player2");
    }
  }, 180_000);

  it("投了すると両者の画面が終わる", async () => {
    const [host, guest] = decks(8);
    const server = localServer({ seed: 8, host, guest });
    const sessions = PLAYERS.map((p) => newSession(server, p));
    sessions[1]!.resign();
    for (let i = 0; i < 20 && !sessions.every((s) => s.over); i++) {
      server.deps.now += 2_000;
      for (const s of sessions) s.frame();
      await flush();
    }
    expect(sessions.map((s) => s.over)).toEqual([true, true]);
    expect(sessions[0]!.winner).toBe("player1");
    expect(sessions[1]!.winner).toBe("player2");
    expect(server.match.result?.reason).toBe("resign");
  });

  it("古い表示が後から届いても、盤面は戻らない", async () => {
    const [host, guest] = decks(9);
    const server = localServer({ seed: 9, host, guest, firstPlayer: "host" });
    const s = newSession(server, "player1");
    const old = serverView(server, "player1");
    expect(s.turnOwner()).toBe("human");
    s.chooseHuman(0);
    await flush();
    s.frame();
    expect(s.match.version).toBeGreaterThan(old.version);
    const after = board(s.state);
    // A poll answered before the move arrives late.
    (s as unknown as { incoming: RemoteMatchView }).incoming = old;
    s.frame();
    expect(board(s.state)).toBe(after);
    expect(s.match.version).toBeGreaterThan(old.version);
  });

  it("送信中は次の操作を受け付けない", async () => {
    const [host, guest] = decks(10);
    const server = localServer({ seed: 10, host, guest, firstPlayer: "host" });
    const s = newSession(server, "player1");
    expect(s.chooseHuman(0).ok).toBe(true);
    expect(s.turnOwner()).toBe("remote");
    expect(s.waitingText()).toBe("送信中…");
    expect(s.chooseHuman(0)).toEqual({ ok: false, error: "送信中です" });
    await flush();
    s.frame();
    expect(server.match.lastSeq.player1).toBe(1);
  });
});

describe("対人戦の画面（GuiMatch）を指の操作で", () => {
  function startRemoteApp(server: LocalServer, player: PlayerId): AppController {
    const app = new AppController({ platform: testPlatform(), viewport: { width: 480, height: 272 }, cpuDelayFrames: 0, seed: () => 1, gui: true });
    app.startRemoteMatch(newSession(server, player));
    return app;
  }

  /** One decision the way a person makes it: tap a card, ○ through the popup, now and then R or the full list. */
  function playOneStep(app: AppController, step: number): void {
    const session = app.session!;
    const gui = app.view().gui!;
    if (step % 5 === 4 && !gui.dialog) app.dispatch(input.menu);
    if (session.turnOwner() !== "human") return;
    if (!gui.dialog) {
      const actionable = gui.rows.flatMap((r, row) => r.tiles.map((t, slot) => ({ t, row, slot }))).filter((x) => x.t.actionable);
      const pick = actionable[(step * 7) % Math.max(1, actionable.length)];
      if (pick) app.dispatch(input.focusTile(pick.row, pick.slot));
    }
    app.dispatch(input.confirm);
    for (let n = 0; n < step % 3; n++) app.dispatch(input.next);
    for (let i = 0; i < 4 && session.turnOwner() === "human"; i++) app.dispatch(input.confirm);
    if (session.turnOwner() === "human") {
      app.dispatch(input.cancel);
      app.dispatch(input.cancel);
      app.dispatch(input.allActions);
      app.dispatch(input.confirm);
    }
  }

  it.each(["player1", "player2"] as PlayerId[])("%s 側を画面で、相手を CPU の手で遊び、決着まで進む", async (gui) => {
    const [host, guest] = decks(gui === "player1" ? 11 : 12);
    const server = localServer({ seed: gui === "player1" ? 11 : 12, host, guest });
    const app = startRemoteApp(server, gui);
    const other = newSession(server, gui === "player1" ? "player2" : "player1");
    let humanSteps = 0;
    for (let frame = 0; frame < 80_000 && app.currentScreen === "match"; frame++) {
      if (frame % 200 === 0) await yieldToWorker();
      server.deps.now += STEP_MS;
      app.tick();
      other.frame();
      if (other.turnOwner() === "human") {
        const index = cpuOption(server, other);
        other.chooseHuman(index >= 0 ? index : 0);
      }
      if (app.currentScreen === "match" && app.session!.turnOwner() === "human") playOneStep(app, humanSteps++);
      await flush();
    }
    expect(app.currentScreen).toBe("result");
    expect(server.match.status).toBe("finished");
    expect(humanSteps).toBeGreaterThan(10);
    expect(app.session!.winner).toBe(server.match.result!.winner === gui ? "player1" : server.match.result!.winner ? "player2" : null);
    // The log calls the other side 「相手」, never 「CPU」.
    expect(app.session!.log.some((line) => line.includes("相手"))).toBe(true);
    expect(app.session!.log.some((line) => line.includes("CPU"))).toBe(false);
  }, 180_000);
});
