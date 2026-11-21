// 対人戦（オンライン）の1試合。盤面はサーバーが持ち（engine match/match.ts）、この画面は自分用の表示を
// 受け取って描き（remoteView.ts で自分を player1 にする）、選んだ操作をサーバーに送るだけ。
//  - 操作は1つずつ送る。返事が来るまで次は送らない（チェックウィンドウの「N枚選んで確定」は順に送る）。
//  - 送った操作には通し番号を付け、通信が切れたら同じ番号で送り直す（サーバーは同じ番号を2回適用しない）。
//  - 自分の番でなくても、表示を定期的に取りに行く（相手の操作・時間切れの自動進行を拾う）。
// サーバーとのやり取りは MatchTransport に任せる（web-pocket は fetch、テストは同じプロセスの match.ts）。
import type { CardInstance, EngineApi, GameAction, GameState, PlayerId } from "../engineApi";
import type { Clock } from "../platform/interfaces";
import { GameSession, type StepResult } from "./session";
import { screenActions, screenState, serverAction, type RemotePlayerView } from "./remoteView";

export type RemoteMatchStatus = "waiting" | "playing" | "finished";
export type RemoteEndReason = "win" | "resign" | "timeout" | "void";

/** What the server sends a player (engine MatchView). */
export type RemoteMatchView = {
  id: string;
  you: PlayerId;
  status: RemoteMatchStatus;
  version: number;
  lastSeq: number;
  timeouts: Record<PlayerId, number>;
  result?: { winner: PlayerId | null; reason: RemoteEndReason; detail?: string };
  clock?: { actor: PlayerId; turnPlayer: PlayerId; deadline: number; turnRemainingMs: number; autoTurn: boolean };
  view?: RemotePlayerView;
};

export type RemoteActRequest = { seq: number; version: number; action: GameAction };
export type RemoteActResult = { ok: true; duplicate?: boolean } | { ok: false; reason: string; error?: string };

export interface MatchTransport {
  /** The current view (poll). */
  fetchView(): Promise<RemoteMatchView>;
  /** Sends a move; the server answers with the result and, when it can, the view after it. */
  act(request: RemoteActRequest): Promise<{ result: RemoteActResult; view?: RemoteMatchView }>;
  /** Gives up the match. */
  resign(): Promise<RemoteMatchView | undefined>;
}

export const REMOTE_LABELS: Readonly<Record<PlayerId, string>> = { player1: "あなた", player2: "相手" };

/** Poll every second while the other side plays, every 3 s on the person's own turn (time-outs, a resignation). */
export const POLL_WAIT_MS = 1_000;
export const POLL_OWN_TURN_MS = 3_000;
/** Resend a move after a network error after this long (doubling, up to RETRY_MAX_MS). */
const RETRY_MS = 500;
const RETRY_MAX_MS = 8_000;

const REJECT_MESSAGES: Record<string, string> = {
  stale: "盤面が変わったため、操作をやり直してください",
  not_your_turn: "相手の手番です",
  unknown_card: "そのカードは選べなくなりました",
  illegal: "その操作はできなくなりました",
  rejected: "その操作はできませんでした",
  finished: "対戦は終わっています",
  not_started: "対戦はまだ始まっていません",
  old_seq: "操作をやり直してください",
  bad_request: "操作を送れませんでした",
};

export type RemoteSessionOptions = {
  engine: EngineApi;
  transport: MatchTransport;
  /** The first view (the match has started: it has a board). */
  first: RemoteMatchView;
  /** Milliseconds (Date.now on the device). */
  now: Clock;
  labels?: Readonly<Record<PlayerId, string>>;
};

type Sent = { seq: number; version: number; action: GameAction; label: string; attempts: number };

/**
 * The engine as the remote match screen uses it: the legal moves of the board on screen are the ones the
 * server sent; other boards (previews of a move: check windows, コール) run the real engine on the person's
 * view, and a preview that fails (a card the person cannot see) is "not possible" instead of an error.
 */
function remoteEngine(base: EngineApi, current: () => RemoteSession | null): EngineApi {
  const live = (state: GameState) => {
    const session = current();
    return session && session.state === state ? session : null;
  };
  return {
    ...base,
    getLegalActions(state) {
      const session = live(state);
      if (session) return session.screenLegal;
      try {
        return base.getLegalActions(state);
      } catch {
        return [];
      }
    },
    getActionPlayerId(state) {
      const session = live(state);
      if (session) return session.screenActor;
      return base.getActionPlayerId(state);
    },
    applyAction(state, action) {
      try {
        return base.applyAction(state, action);
      } catch {
        return { ok: false, error: "preview_failed" } as ReturnType<EngineApi["applyAction"]>;
      }
    },
    isCpuTurn: () => false,
    pickCpuAction: () => null,
    pickCpuFallbackAction: () => null,
    effectiveBp(state, playerId, instance: CardInstance) {
      try {
        return base.effectiveBp(state, playerId, instance);
      } catch {
        return state.definitions[instance.cardId]?.bp ?? 0;
      }
    },
    countAvailablePower(state, playerId) {
      try {
        return base.countAvailablePower(state, playerId);
      } catch {
        return state.players[playerId]?.power.filter((c) => !c.faceDown).length ?? 0;
      }
    },
    countOpponentMultiCategoryCommands(state, playerId) {
      try {
        return base.countOpponentMultiCategoryCommands(state, playerId);
      } catch {
        return 0;
      }
    },
  };
}

export class RemoteSession extends GameSession {
  readonly transport: MatchTransport;
  /** The latest view from the server. */
  match: RemoteMatchView;
  /** The person's legal moves on the board on screen (the person as player1). */
  screenLegal: GameAction[] = [];
  screenActor: PlayerId = "player1";
  private screenActorBefore: PlayerId = "player1";
  private readonly now: Clock;
  private seq: number;
  private queue: Array<{ action: GameAction; label: string }> = [];
  private sent: Sent | null = null;
  private retryAt = 0;
  private fetching = false;
  private nextPollAt = 0;
  private incoming: RemoteMatchView | null = null;
  /** Card definitions seen so far (a view carries only the cards visible now; the log still names the others). */
  private readonly seenDefinitions: GameState["definitions"] = {};
  /** The connection failed and has not come back yet. */
  offline = false;
  /** Short notices for the screen (a refused move, the other side's moves), oldest first. */
  private notices: string[] = [];
  /** A move was answered without the board after it: the person waits for the next view. */
  private awaitingView = false;

  constructor(options: RemoteSessionOptions) {
    if (!options.first.view) throw new Error("RemoteSession: the match has not started");
    const holder: { session: RemoteSession | null } = { session: null };
    const engine = remoteEngine(options.engine, () => holder.session);
    const labels = options.labels ?? REMOTE_LABELS;
    super({
      engine,
      humanDeck: "",
      cpuDeck: "",
      seed: 0,
      cpuLevel: 1,
      clock: options.now,
      labels,
      initialState: screenState(options.first.view),
    });
    holder.session = this;
    this.transport = options.transport;
    this.now = options.now;
    this.match = options.first;
    this.seq = options.first.lastSeq;
    this.actions = null;
    this.adopt(options.first, true);
  }

  /** The player the person plays on the server. */
  get you(): PlayerId {
    return this.match.you;
  }

  override get winner(): PlayerId | null {
    if (this.match.status === "finished") return this.match.result?.winner ? this.screenPlayer(this.match.result.winner) : null;
    return this.state.winner;
  }

  override get over(): boolean {
    return this.match.status === "finished";
  }

  /** A server player id as the screen calls it (the person is always player1 on screen). */
  screenPlayer(player: PlayerId): PlayerId {
    return player === this.match.you ? "player1" : "player2";
  }

  /** A move is on its way to the server (the person waits for its answer). */
  get busy(): boolean {
    return this.sent !== null || this.queue.length > 0 || this.incoming !== null || this.awaitingView;
  }

  /** The next notice to show (null when there is none). */
  takeNotice(): string | null {
    return this.notices.shift() ?? null;
  }

  override waitingText(): string {
    if (this.offline) return "通信が切れています。再接続中…";
    if (this.busy) return "送信中…";
    return `${this.labels.player2} の手番`;
  }

  override turnOwner(): "human" | "cpu" | "none" | "remote" {
    if (this.over || this.state.winner) return "none";
    if (this.busy) return "remote";
    return this.humanOptions().length > 0 ? "human" : "remote";
  }

  override chooseHuman(index: number): StepResult {
    if (this.busy) return { ok: false, error: "送信中です" };
    const option = this.humanOptions()[index];
    if (!option) return { ok: false, error: "no_such_option" };
    this.queue.push({ action: option.action, label: option.label });
    this.pump();
    return { ok: true, label: option.label };
  }

  override chooseHumanActions(actions: readonly GameAction[]): StepResult | null {
    if (this.busy) return { ok: false, error: "送信中です" };
    if (actions.length === 0) return null;
    const first = this.humanOptions().find((o) => JSON.stringify(o.action) === JSON.stringify(actions[0]));
    if (!first) return { ok: false, error: "選択できませんでした" };
    // Each pick is sent once the one before it is taken (the next is looked up among the moves the server sends then).
    for (const action of actions) this.queue.push({ action, label: "" });
    this.queue[0]!.label = first.label;
    this.pump();
    return { ok: true, label: first.label };
  }

  override cpuStep(): StepResult {
    return { ok: false, error: "remote" };
  }

  override loadState(): void {
    // A remote match is the server's: a shared board cannot be loaded into it.
  }

  /** Gives up the match (the result comes with the next view). */
  resign(): void {
    this.queue = [];
    void this.transport.resign().then(
      (view) => {
        if (view) this.incoming = view;
        this.nextPollAt = 0;
      },
      () => {
        this.nextPollAt = 0;
      },
    );
  }

  /**
   * Call once per frame: takes in a view that arrived, sends the next move, polls when it is time.
   * Returns true when the board on screen changed.
   */
  frame(): boolean {
    let changed = false;
    if (this.incoming) {
      const view = this.incoming;
      this.incoming = null;
      changed = this.adopt(view, false) || changed;
    }
    changed = this.pump() || changed;
    const now = this.now();
    if (this.sent && this.sent.attempts > 0 && now >= this.retryAt && !this.inFlight) this.send(this.sent);
    if (!this.sent && !this.fetching && this.queue.length === 0 && now >= this.nextPollAt && this.match.status !== "finished") this.poll();
    return changed;
  }

  private inFlight = false;

  /** Sends the next queued move when nothing is on its way. Returns true when a dropped move changed the screen. */
  private pump(): boolean {
    if (this.sent || this.queue.length === 0 || this.incoming) return false;
    const next = this.queue[0]!;
    const key = JSON.stringify(next.action);
    if (this.match.status !== "playing" || !this.screenLegal.some((a) => JSON.stringify(a) === key)) {
      // The board moved on (a time-out, or the pick before it ended the choice): the rest is not sent.
      this.queue = [];
      this.lastError = "選択できませんでした";
      this.notices.push(this.lastError);
      this.version++;
      return true;
    }
    this.queue.shift();
    this.seq += 1;
    this.sent = { seq: this.seq, version: this.match.version, action: serverAction(this.match.you, next.action), label: next.label, attempts: 0 };
    this.send(this.sent);
    return false;
  }

  private send(sent: Sent): void {
    this.inFlight = true;
    sent.attempts += 1;
    this.transport.act({ seq: sent.seq, version: sent.version, action: sent.action }).then(
      ({ result, view }) => {
        this.inFlight = false;
        if (this.sent !== sent) return;
        this.sent = null;
        this.offline = false;
        if (!result.ok) {
          // The next move gets the next number (the server takes any number above the last it took).
          this.queue = [];
          this.lastError = REJECT_MESSAGES[result.reason] ?? `操作できませんでした（${result.reason}）`;
          this.notices.push(this.lastError);
        }
        if (view) this.incoming = view;
        else {
          this.awaitingView = true;
          this.nextPollAt = 0;
        }
      },
      () => {
        // No answer (offline, server down): send the same move with the same number again; the server applies it once.
        this.inFlight = false;
        if (this.sent !== sent) return;
        this.offline = true;
        this.retryAt = this.now() + Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.min(4, sent.attempts - 1));
      },
    );
  }

  private poll(): void {
    this.fetching = true;
    this.transport.fetchView().then(
      (view) => {
        this.fetching = false;
        this.offline = false;
        this.incoming = view;
      },
      () => {
        this.fetching = false;
        this.offline = true;
        this.nextPollAt = this.now() + POLL_OWN_TURN_MS;
        if (this.awaitingView) this.nextPollAt = this.now() + RETRY_MS;
      },
    );
  }

  /** Takes in a view from the server. Returns true when the screen changed. */
  private adopt(view: RemoteMatchView, first: boolean): boolean {
    // A poll sent before a move can come back after the move's answer: an older board is never shown again.
    if (!first && view.version < this.match.version) return false;
    this.awaitingView = false;
    const own = view.view?.actionPlayerId === view.you;
    this.nextPollAt = this.now() + (own ? POLL_OWN_TURN_MS : POLL_WAIT_MS);
    if (view.lastSeq > this.seq && !this.sent) this.seq = view.lastSeq;
    const sameBoard = !first && view.version === this.match.version && view.status === this.match.status;
    this.match = view;
    if (sameBoard || !view.view) {
      if (!sameBoard) this.version++;
      return !sameBoard;
    }
    Object.assign(this.seenDefinitions, view.view.state.definitions);
    const state = screenState(view.view);
    const next: GameState = { ...state, definitions: { ...this.seenDefinitions } };
    this.screenActorBefore = this.screenActor;
    this.screenLegal = view.status === "playing" ? screenActions(view.view) : [];
    this.screenActor = view.view.actionPlayerId === view.you ? "player1" : "player2";
    if (first) {
      this.state = next;
      this.cachedOptions = null;
      return true;
    }
    const before = this.log.length + this.logDropped;
    const wasOwn = this.screenActorBefore === "player1";
    // A poll after the person's own move carries that move; otherwise it is the other side's.
    this.commit(next, null, wasOwn ? "player1" : "player2");
    // The other side's moves show as a notice, like the CPU's moves (the last line they added to the log).
    if (!wasOwn && this.log.length + this.logDropped > before) {
      const line = this.log[this.log.length - 1];
      if (line && !line.startsWith("━━")) this.notices.push(line);
    }
    return true;
  }
}
