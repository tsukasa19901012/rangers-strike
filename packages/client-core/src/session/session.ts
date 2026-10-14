// One human-vs-CPU match. Owns the GameState, turns legal actions into labelled
// options, runs CPU moves and records per-move timing and memory samples.
import type { CpuLevel, EngineApi, GameAction, GameState, PlayerId } from "../engineApi";
import { CPU, HUMAN } from "../engineApi";
import { describeAction, humanizeLogEntry, indexInstances, PLAYER_LABELS } from "../text/labels";
import type { Clock, LogSink, MemoryProbe, MemorySample } from "../platform/interfaces";

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

  constructor(options: SessionOptions) {
    this.engine = options.engine;
    this.options = options;
    this.state = options.engine.createStarterGame({
      player1Starter: options.humanDeck,
      player2Starter: options.cpuDeck,
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
    if (this.humanOptions().length > 0) return "human";
    // Engine has legal actions but none belongs to the human: let the CPU
    // policy resolve the step for whoever acts (keeps the match moving).
    return this.engine.getLegalActions(this.state).length > 0 ? "cpu" : "none";
  }

  humanOptions(): ActionOption[] {
    if (this.cachedOptions?.version === this.version) return this.cachedOptions.options;
    const index = indexInstances(this.state);
    const options = this.state.winner
      ? []
      : this.engine
          .getLegalActions(this.state)
          .filter((a) => (a as { playerId?: PlayerId }).playerId === HUMAN)
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
    this.commit(result.state);
    return { ok: true, label: option.label };
  }

  /** Performs one CPU move (or an auto-resolved step). Timed with the injected clock. */
  cpuStep(): StepResult {
    if (this.state.winner) return { ok: false, error: "game_over" };
    const engine = this.engine;
    const actor = engine.isCpuTurn(this.state, CPU) ? CPU : engine.getActionPlayerId(this.state);
    const t0 = this.options.clock();
    let action =
      engine.pickCpuAction(this.state, actor, this.options.cpuLevel) ??
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
    m.moves++;
    m.lastThinkMs = think;
    m.lastApplyMs = t2 - t1;
    m.totalThinkMs += think;
    m.avgThinkMs = m.totalThinkMs / m.moves;
    m.maxThinkMs = Math.max(m.maxThinkMs, think);
    this.commit(result.state);
    if (m.moves % (this.options.memoryEvery ?? 10) === 0 || this.state.winner) this.sampleMemory();
    this.options.log?.(
      `cpu move=${m.moves} actor=${actor} think=${think.toFixed(1)}ms apply=${m.lastApplyMs.toFixed(1)}ms ` +
        `${m.memory ? `mem=${m.memory.label}` : ""} ${action.type}`,
    );
    return { ok: true, label: `${PLAYER_LABELS[actor]}: ${label}` };
  }

  private commit(next: GameState): void {
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
