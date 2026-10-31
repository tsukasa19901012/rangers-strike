// One human-vs-CPU match. Owns the GameState, turns legal actions into labelled
// options, runs CPU moves and records per-move timing and memory samples.
import type { CpuLevel, EngineApi, GameAction, GameState, PlayerId } from "../engineApi";
import { CPU, HUMAN } from "../engineApi";
import { describeAction, humanizeLogEntry, indexInstances, isDuplicateSelfHoldPayment, PLAYER_LABELS } from "../text/labels";
import type { Clock, LogSink, MemoryProbe, MemorySample } from "../platform/interfaces";

/** A normal turn takes well under 100 CPU moves; far more means the CPU is looping. */
const CPU_MOVES_PER_TURN_LIMIT = 400;

export type ActionOption = { label: string; action: GameAction };

export type MoveMetrics = {
  /** CPU moves performed. */
  moves: number;
  /** pickCpuAction time of the last CPU move (ms). */
  lastThinkMs: number;
  avgThinkMs: number;
  maxThinkMs: number;
  /** applyAction time of the last move (ms). */
  lastApplyMs: number;
  totalThinkMs: number;
  memory: MemorySample | null;
};

export type SessionOptions = {
  engine: EngineApi;
  humanDeck: string;
  cpuDeck: string;
  seed: number;
  cpuLevel: CpuLevel;
  /** Autoplay (measurement): the human side is played by the CPU at this level. */
  humanLevel?: CpuLevel;
  /** Card lists of custom decks; when set they replace the starter ids above. */
  humanCards?: GameState["definitions"][string][];
  cpuCards?: GameState["definitions"][string][];
  clock: Clock;
  memory?: MemoryProbe;
  log?: LogSink;
  /** Formatted log lines kept in memory. */
  logLimit?: number;
  /** Sample memory every N CPU moves (sampling can be costly). */
  memoryEvery?: number;
};

export type StepResult = { ok: true; label: string } | { ok: false; error: string };

export class GameSession {
  readonly engine: EngineApi;
  readonly options: SessionOptions;
  state: GameState;
  /** Formatted (Japanese) game log, oldest first. */
  readonly log: string[] = [];
  private loggedEntries = 0;
  readonly metrics: MoveMetrics = {
    moves: 0,
    lastThinkMs: 0,
    avgThinkMs: 0,
    maxThinkMs: 0,
    lastApplyMs: 0,
    totalThinkMs: 0,
    memory: null,
  };
  /** Bumped whenever the state changes, for renderers that diff by version. */
  version = 0;
  private cachedOptions: { version: number; options: ActionOption[] } | null = null;
  lastError: string | null = null;
  /**
   * Every action applied since the match was created, in order: with the seed and the decks it replays
   * the whole match (app/gameRecord.ts). null after loadState (a shared board has no history from the start).
   */
  actions: GameAction[] | null = [];

  constructor(options: SessionOptions) {
    this.engine = options.engine;
    this.options = options;
    this.state = options.engine.createStarterGame({
      player1Starter: options.humanDeck,
      player2Starter: options.cpuDeck,
      player1Deck: options.humanCards,
      player2Deck: options.cpuCards,
      seed: options.seed,
    });
    this.syncLog();
    this.sampleMemory();
    options.log?.(`match start: ${options.humanDeck} vs ${options.cpuDeck} seed=${options.seed} cpu=Lv${options.cpuLevel}`);
  }

  get winner(): PlayerId | null {
    return this.state.winner;
  }

  /** Whose input the match waits for. */
  turnOwner(): "human" | "cpu" | "none" {
    if (this.state.winner) return "none";
    if (this.engine.isCpuTurn(this.state, CPU)) return "cpu";
    if (this.options.humanLevel) return this.engine.getLegalActions(this.state).length > 0 ? "cpu" : "none";
    if (this.humanOptions().length > 0) return "human";
    // Engine has legal actions but none belongs to the human: let the CPU
    // policy resolve the step for whoever acts (keeps the match moving).
    return this.engine.getLegalActions(this.state).length > 0 ? "cpu" : "none";
  }

  humanOptions(): ActionOption[] {
    if (this.cachedOptions?.version === this.version) return this.cachedOptions.options;
    const index = indexInstances(this.state);
    const legal = this.state.winner ? [] : this.engine.getLegalActions(this.state);
    const options = legal
      // 「これをホールドして発動」は選ぶだけで発動する。同じ手の支払い経由の行は出さない（text/labels.ts）。
      .filter((a) => (a as { playerId?: PlayerId }).playerId === HUMAN && !isDuplicateSelfHoldPayment(this.state, a, legal))
      .map((action) => ({ action, label: describeAction(this.state, action, index) }));
    this.cachedOptions = { version: this.version, options };
    return options;
  }

  chooseHuman(index: number): StepResult {
    const option = this.humanOptions()[index];
    if (!option) return { ok: false, error: "no_such_option" };
    const result = this.engine.applyAction(this.state, option.action);
    if (!result.ok) {
      this.lastError = this.engine.formatActionError(result.error);
      this.version++;
      return { ok: false, error: this.lastError };
    }
    this.commit(result.state, option.action);
    return { ok: true, label: option.label };
  }

  private turnMoves = { turn: -1, count: 0 };

  /**
   * Safety net against a CPU that repeats a cancelled procedure forever (the
   * game would hang on the device): after too many CPU moves in one turn,
   * take a legal action that moves the game on (end the phase, skip, pass).
   */
  private loopBreakAction(actor: PlayerId): GameAction | null {
    if (this.turnMoves.turn !== this.state.turn) this.turnMoves = { turn: this.state.turn, count: 0 };
    this.turnMoves.count++;
    if (this.turnMoves.count <= CPU_MOVES_PER_TURN_LIMIT) return null;
    const legal = this.engine.getLegalActions(this.state).filter((a) => (a as { playerId?: PlayerId }).playerId === actor);
    const rank = (a: GameAction) =>
      a.type === "end_phase" ? 0 : a.type.startsWith("skip_") ? 1 : a.type.startsWith("pass_") ? 2 : 3;
    const pick = [...legal].sort((a, b) => rank(a) - rank(b))[0];
    if (pick && rank(pick) < 3) {
      this.options.log?.(`cpu loop guard: ${this.turnMoves.count} moves in turn ${this.state.turn}, forcing ${pick.type}`);
      return pick;
    }
    return null;
  }

  /** Performs one CPU move (or an auto-resolved step). Timed with the injected clock. */
  cpuStep(): StepResult {
    if (this.state.winner) return { ok: false, error: "game_over" };
    const engine = this.engine;
    const actor = engine.isCpuTurn(this.state, CPU) ? CPU : engine.getActionPlayerId(this.state);
    const t0 = this.options.clock();
    let action =
      this.loopBreakAction(actor) ??
      engine.pickCpuAction(this.state, actor, actor === HUMAN && this.options.humanLevel ? this.options.humanLevel : this.options.cpuLevel) ??
      engine.pickCpuFallbackAction(this.state, actor);
    const t1 = this.options.clock();
    let result = action ? engine.applyAction(this.state, action) : null;
    if (!result || !result.ok) {
      const fallback = engine.pickCpuFallbackAction(this.state, actor);
      if (fallback) {
        action = fallback;
        result = engine.applyAction(this.state, fallback);
      }
    }
    if (!result || !result.ok) {
      // Last resort: first legal action of the actor that applies.
      for (const candidate of engine.getLegalActions(this.state)) {
        const r = engine.applyAction(this.state, candidate);
        if (r.ok) {
          action = candidate;
          result = r;
          break;
        }
      }
    }
    const t2 = this.options.clock();
    if (!action || !result || !result.ok) {
      this.lastError = "CPU が行動できません";
      return { ok: false, error: this.lastError };
    }
    const label = describeAction(this.state, action);
    const think = t1 - t0;
    const m = this.metrics;
    if (actor === HUMAN && this.options.humanLevel) {
      // Autoplay: only the CPU side's thinking is measured.
      this.commit(result.state, action);
      return { ok: true, label: `${PLAYER_LABELS[actor]}: ${label}` };
    }
    m.moves++;
    m.lastThinkMs = think;
    m.lastApplyMs = t2 - t1;
    m.totalThinkMs += think;
    m.avgThinkMs = m.totalThinkMs / m.moves;
    m.maxThinkMs = Math.max(m.maxThinkMs, think);
    this.commit(result.state, action);
    if (m.moves % (this.options.memoryEvery ?? 10) === 0 || this.state.winner) this.sampleMemory();
    this.options.log?.(
      `cpu move=${m.moves} actor=${actor} think=${think.toFixed(1)}ms apply=${m.lastApplyMs.toFixed(1)}ms ` +
        `${m.memory ? `mem=${m.memory.label}` : ""} ${action.type}`,
    );
    return { ok: true, label: `${PLAYER_LABELS[actor]}: ${label}` };
  }

  /**
   * Continues from another match's state (a shared board): the log is rebuilt
   * from the loaded state's entries and the CPU timings start over.
   */
  loadState(next: GameState): void {
    this.state = next;
    this.actions = null;
    this.lastError = null;
    this.version++;
    this.cachedOptions = null;
    this.log.length = 0;
    this.loggedEntries = 0;
    this.turnMoves = { turn: -1, count: 0 };
    this.syncLog();
  }

  private commit(next: GameState, action: GameAction): void {
    this.actions?.push(action);
    this.state = next;
    this.lastError = null;
    this.version++;
    this.syncLog();
    if (next.winner) {
      this.options.log?.(
        `match end: winner=${next.winner} turn=${next.turn} cpuMoves=${this.metrics.moves} ` +
          `avgThink=${this.metrics.avgThinkMs.toFixed(1)}ms maxThink=${this.metrics.maxThinkMs.toFixed(1)}ms`,
      );
    }
  }

  private syncLog(): void {
    const entries = this.state.log;
    for (let i = this.loggedEntries; i < entries.length; i++) {
      const formatted = this.engine.formatGameLog(entries[i]!, this.state.definitions);
      const text = formatted ? humanizeLogEntry(formatted, this.state) : null;
      if (text) this.log.push(text);
    }
    this.loggedEntries = entries.length;
    const limit = this.options.logLimit ?? 200;
    if (this.log.length > limit) this.log.splice(0, this.log.length - limit);
  }

  sampleMemory(): void {
    const sample = this.options.memory?.sample(this.state) ?? null;
    if (sample) this.metrics.memory = sample;
  }
}
