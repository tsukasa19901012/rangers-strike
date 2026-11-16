// Test-only: a 対人戦 server in the same process (the engine's match.ts), with a transport for each player.
// `faults` makes the network misbehave: a request that never reaches the server, or one whose answer is lost
// after the server applied it (the client must resend it with the same number).
import * as engine from "@rangers-strike/engine";
import type { DeckSpec, FirstPlayerChoice, MatchDeps, MatchState } from "@rangers-strike/engine";
import type { PlayerId } from "../engineApi";
import type { MatchTransport, RemoteMatchView } from "../session/remoteSession";

export type Fault = "none" | "lost_request" | "lost_answer";

export type LocalServer = {
  match: MatchState;
  deps: MatchDeps;
  transport(player: PlayerId): MatchTransport;
  /** Requests sent so far (all players). */
  requests: number;
  /** Save and load the match now and then, like the real server (Upstash) does on every request. */
  roundTrip: boolean;
};

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

/** A copy through JSON, as the network gives it. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function localServer(options: {
  seed: number;
  host: DeckSpec;
  guest: DeckSpec;
  firstPlayer?: FirstPlayerChoice;
  faults?: (player: PlayerId, kind: "view" | "act" | "resign") => Fault;
  roundTrip?: boolean;
}): LocalServer {
  const rand = mulberry32(options.seed);
  const deps: MatchDeps = {
    now: 1_700_000_000_000,
    newAliasBody: () => Math.floor(rand() * 2 ** 40).toString(36),
    randomSeed: () => Math.floor(rand() * 2 ** 32),
  };
  const server: LocalServer = {
    match: engine.createMatch({ id: `m${options.seed}`, engineVersion: "test", hostDeck: options.host, firstPlayer: options.firstPlayer ?? "random", now: deps.now }),
    deps,
    requests: 0,
    roundTrip: options.roundTrip ?? false,
    transport(player) {
      const fault = (kind: "view" | "act" | "resign") => options.faults?.(player, kind) ?? "none";
      const store = () => {
        if (server.roundTrip && server.requests % 5 === 0) server.match = engine.deserializeMatch(engine.serializeMatch(server.match), "test", deps);
      };
      const view = () => wire(engine.matchView(server.match, player, deps)) as unknown as RemoteMatchView;
      const call = <T>(kind: "view" | "act" | "resign", run: () => T): Promise<T> => {
        server.requests++;
        const f = fault(kind);
        if (f === "lost_request") return Promise.reject(new Error("network"));
        engine.matchTick(server.match, deps);
        const out = run();
        store();
        if (f === "lost_answer") return Promise.reject(new Error("network"));
        return Promise.resolve(out);
      };
      return {
        fetchView: () => call("view", view),
        act: (request) =>
          call("act", () => {
            const result = engine.matchAct(server.match, player, wire(request), deps);
            return { result: wire(result), view: view() };
          }),
        resign: () =>
          call("resign", () => {
            engine.matchResign(server.match, player, deps);
            return view();
          }),
      };
    },
  };
  engine.joinMatch(server.match, options.guest, deps);
  return server;
}

/** Lets the transport's answers arrive (they are promises). */
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) await Promise.resolve();
}
