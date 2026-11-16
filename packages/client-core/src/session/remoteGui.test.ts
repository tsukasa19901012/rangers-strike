// 対人戦の画面は、サーバーから届いた「自分に見える盤面」（engine viewFor）を描く。CPU 同士の対戦の毎手で、
// 本物の盤面から作った画面と、見える盤面から作った画面が同じになることを確かめる（盤面の行・ボタン・
// 上下の帯・選択ウィンドウ・全操作の一覧・カードごとの操作）。カードの ID は別 ID になるので比べない。
// 見えない情報で変わる表示があれば、ここで違いとして出る。
import { describe, expect, it } from "vitest";
import * as engine from "@rangers-strike/engine";
import { arenaDeck, arenaDeckIds } from "../../../engine/scripts/arenaDecks";
import type { GameState, PlayerId } from "../engineApi";
import { GuiMatch, type GuiView } from "../app/guiMatch";
import { input } from "../input/actions";
import { testEngine } from "../testing/engine";
import { GameSession } from "./session";
import { REMOTE_LABELS, RemoteSession, type MatchTransport, type RemoteActRequest, type RemoteMatchView } from "./remoteSession";
import { swapPlayers, type RemotePlayerView } from "./remoteView";

const PLAYERS: PlayerId[] = ["player1", "player2"];
const VIEWPORTS = [
  { width: 480, height: 272 },
  { width: 1280, height: 720 },
];
const yieldToWorker = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A server that never answers, and keeps the moves sent to it. */
function recorder(): MatchTransport & { sent: RemoteActRequest[] } {
  const sent: RemoteActRequest[] = [];
  return {
    sent,
    fetchView: () => new Promise(() => {}),
    act: (request) => {
      sent.push(request);
      return new Promise(() => {});
    },
    resign: () => new Promise(() => {}),
  };
}

/**
 * The real board as the viewer's screen. When the viewer is player2 the board is swapped; the engine lists some
 * moves player by player, so the legal moves of the swapped board can come in another order than the server's.
 * The screen gets the server's order (the real board's moves, swapped), as the remote screen does.
 */
function localScreen(real: GameState, viewer: PlayerId): GameSession {
  const initialState = viewer === "player2" ? swapPlayers(real) : real;
  const legal = viewer === "player2" ? swapPlayers(engine.getLegalActions(real)) : null;
  const screenEngine = legal
    ? { ...testEngine, getLegalActions: (state: GameState) => (state === initialState ? legal : testEngine.getLegalActions(state)) }
    : testEngine;
  return new GameSession({
    engine: screenEngine,
    humanDeck: "",
    cpuDeck: "",
    seed: 0,
    cpuLevel: 1,
    clock: () => 0,
    labels: REMOTE_LABELS,
    initialState,
  });
}

function remoteScreen(view: RemotePlayerView, version: number, transport: MatchTransport): RemoteSession {
  const first: RemoteMatchView = {
    id: "eq",
    you: view.viewer,
    status: "playing",
    version,
    lastSeq: 0,
    timeouts: { player1: 0, player2: 0 },
    view: JSON.parse(JSON.stringify(view)) as RemotePlayerView,
  };
  return new RemoteSession({ engine: testEngine, transport, first, now: () => 0 });
}

/** The screen without card ids (real ids on one side, aliases on the other). */
function normalize(view: GuiView): string {
  return JSON.stringify(view, (key, value) => {
    if (key === "instanceId" || key === "ridingOn") return value ? "#" : value;
    if (key === "toast") return undefined;
    return value;
  });
}

type Probe = { label: string; run: (gui: GuiMatch) => void };

/** What the person sees: the board, the full list, and each card's popup. */
function probes(gui: GuiMatch): Probe[] {
  const out: Probe[] = [{ label: "board", run: () => {} }, { label: "all actions", run: (g) => g.dispatch(input.allActions) }];
  const view = gui.view();
  view.rows.forEach((row, r) =>
    row.tiles.forEach((tile, slot) => {
      if (tile.actionable) out.push({ label: `tile ${row.key} ${slot}`, run: (g) => (g.dispatch(input.focusTile(r, slot)), g.dispatch(input.confirm)) });
    }),
  );
  return out;
}

function diff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `…${a.slice(Math.max(0, i - 120), i + 80)}\n  vs\n…${b.slice(Math.max(0, i - 120), i + 80)}`;
}

function starterGame(g: number): GameState {
  const ids = engine.ALL_STARTER_DECK_IDS as readonly string[];
  return engine.createStarterGame({ player1Starter: ids[g % ids.length] as never, player2Starter: ids[(g * 5 + 2) % ids.length] as never, seed: 600 + g });
}

function arenaGame(g: number): GameState {
  const ids = arenaDeckIds();
  return engine.createGameForDecks(arenaDeck(ids[(g * 41 + 3) % ids.length]!)!, arenaDeck(ids[(g * 59 + 17) % ids.length]!)!, { seed: 1600 + g });
}

async function compareGame(start: GameState, seed: number): Promise<{ steps: number; checked: number; problems: string[] }> {
  let n = 0;
  const aliases = { player1: engine.createIdAliasTable(), player2: engine.createIdAliasTable() };
  const newAliasBody = () => `${seed}a${(n++).toString(36)}`;
  const logs: Record<PlayerId, string[]> = { player1: [], player2: [] };
  const problems: string[] = [];
  let state = start;
  let steps = 0;
  let checked = 0;
  for (; steps < 1500 && !state.winner; steps++) {
    if (steps % 20 === 0) await yieldToWorker();
    for (const viewer of PLAYERS) {
      const view = engine.viewFor(state, viewer, { aliases: aliases[viewer], newAliasBody, log: logs[viewer] }) as unknown as RemotePlayerView;
      const viewport = VIEWPORTS[(steps + (viewer === "player2" ? 1 : 0)) % VIEWPORTS.length]!;
      const screen = localScreen(state, viewer);
      const local = new GuiMatch(screen.engine, screen, viewport);
      for (const probe of probes(local)) {
        const localSession = localScreen(state, viewer);
        const transport = recorder();
        const remoteSession = remoteScreen(view, steps, transport);
        const a = new GuiMatch(localSession.engine, localSession, viewport);
        const b = new GuiMatch(remoteSession.engine, remoteSession, viewport);
        probe.run(a);
        probe.run(b);
        checked++;
        if (localSession.version !== 0) {
          // The probe made a move: the remote screen sent the same move (in the viewer's aliases) and waits.
          const made = localSession.actions![0]!;
          const real = viewer === "player2" ? swapPlayers(made) : made;
          const sent = transport.sent.map((req) => engine.resolveViewAction(req.action, aliases[viewer]));
          if (sent.length !== 1 || JSON.stringify(sent[0]) !== JSON.stringify(real)) {
            problems.push(`step ${steps} ${viewer} ${probe.label}: made ${JSON.stringify(real)} sent ${JSON.stringify(sent)}`);
          }
          if (!remoteSession.busy) problems.push(`step ${steps} ${viewer} ${probe.label}: not waiting after a move`);
          continue;
        }
        if (transport.sent.length > 0) problems.push(`step ${steps} ${viewer} ${probe.label}: sent a move the local screen did not make`);
        const x = normalize(a.view());
        const y = normalize(b.view());
        if (x !== y) problems.push(`step ${steps} ${viewer} ${probe.label}:\n${diff(x, y)}`);
      }
    }
    if (problems.length > 3) break;
    const actor = engine.getActionPlayerId(state);
    const legal = engine.getLegalActions(state);
    const action = engine.pickCpuAction(state, actor, 1) ?? legal[0];
    if (!action) break;
    const result = engine.applyAction(state, action);
    if (!result.ok) break;
    for (const p of PLAYERS) logs[p].push(...engine.redactNewLogLines(state, result.state, p));
    state = result.state;
  }
  return { steps, checked, problems };
}

describe("見える盤面から作った画面が、本物の盤面から作った画面と同じ", () => {
  it.each([0, 1, 2])("スターター同士の試合 %i", async (g) => {
    const result = await compareGame(starterGame(g), g);
    expect(result.problems).toEqual([]);
    expect(result.steps).toBeGreaterThan(100);
  }, 600_000);

  it.each([0, 1, 2])("ブログ・大会デッキ同士の試合 %i", async (g) => {
    const result = await compareGame(arenaGame(g), 100 + g);
    expect(result.problems).toEqual([]);
    expect(result.steps).toBeGreaterThan(100);
  }, 600_000);
});
