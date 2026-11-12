/**
 * ターンの持ち主の不変条件: ターンの持ち主以外のプレイヤーが end_phase / end_turn を指すことはない（ターンが入れ替わらない）。
 * また、中断したバトル進入（deferredBattleEntry）を次のターンへ持ち越さない。
 *
 * 効果の選択・ダメージの支払い・反応窓の間は activePlayer が相手に移るので、その間に作った処理がターンプレイヤーを
 * activePlayer から取ると、解決後にターンが相手に渡る（2026-11-12 報告: CPU のモーフ後にターンが入れ替わる）。
 * scripts/turn-owner-sweep.ts（多数の CPU 対戦で探す）と verticalSlice/turnOwner.test.ts（見つかった試合の回帰）で使う。
 */
import { applyAction } from "../core/applyAction";
import { getLegalActions, isLegalAction } from "../core/legalActions";
import { pickCpuAction } from "../ai/index";
import type { CpuLevel } from "../ai/types";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { createStarterGame } from "../verticalSlice/createStarterGame";

export type TurnOwnerViolation = {
  turn: number;
  phase: string;
  action: GameAction;
  owner: PlayerId;
  logTail: string[];
};

export type StaleBattleEntry = {
  entry: NonNullable<GameState["deferredBattleEntry"]>;
  /** deferredBattleEntry が残ったきっかけのアクションと、その直後のログ。 */
  setBy: { action: GameAction; logTail: string[] } | null;
};

export type TurnOwnerGameResult = {
  violation: TurnOwnerViolation | null;
  stale: StaleBattleEntry[];
  steps: number;
  winner: PlayerId | null | undefined;
  trace?: Array<{ turn: number; action: GameAction; activePlayer: PlayerId; log: string[] }>;
};

const text = (e: unknown) => (typeof e === "string" ? e : JSON.stringify(e)).slice(0, 160);

/**
 * CPU 同士で 1 試合指す。explore の確率で CPU の手のかわりに無作為な合法手を指す（いろいろな局面を通るように）。
 * 最初の違反で止める。
 */
export function playTurnOwnerGame(opts: {
  deck1Id: string;
  deck2Id: string;
  deck1?: CardDefinition[];
  deck2?: CardDefinition[];
  seed: number;
  rand: () => number;
  explore: number;
  level?: CpuLevel;
  maxSteps?: number;
  trace?: boolean;
}): TurnOwnerGameResult {
  const { rand } = opts;
  let state: GameState = createStarterGame({
    player1Starter: opts.deck1Id as never,
    player2Starter: opts.deck2Id as never,
    player1Deck: opts.deck1,
    player2Deck: opts.deck2,
    seed: opts.seed,
    firstPlayer: rand() < 0.5 ? "player1" : "player2",
  });
  let owner: PlayerId = state.firstPlayer;
  let deferredAt: StaleBattleEntry["setBy"] = null;
  const stale: StaleBattleEntry[] = [];
  const trace: TurnOwnerGameResult["trace"] = opts.trace ? [] : undefined;
  let step = 0;
  for (; step < (opts.maxSteps ?? 6000) && !state.winner; step++) {
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const actor = actions[0]!.playerId;
    const mine = actions.filter((a) => a.playerId === actor);
    const picked = rand() < opts.explore ? mine[Math.floor(rand() * mine.length)]! : pickCpuAction(state, actor, opts.level ?? 1);
    let used = picked;
    let result = picked && isLegalAction(state, picked) ? applyAction(state, picked) : null;
    for (const c of mine) {
      if (result?.ok) break;
      used = c;
      result = applyAction(state, c);
    }
    if (!result?.ok || !used) break;
    const next = result.state;
    trace?.push({ turn: state.turn, action: used, activePlayer: next.activePlayer, log: next.log.slice(state.log.length).map(text) });
    if ((used.type === "end_phase" || used.type === "end_turn") && used.playerId !== owner) {
      return { violation: { turn: state.turn, phase: state.phase, action: used, owner, logTail: next.log.slice(-14).map(text) }, stale, steps: step, winner: state.winner, trace };
    }
    if (next.deferredBattleEntry && !state.deferredBattleEntry) deferredAt = { action: used, logTail: next.log.slice(-6).map(text) };
    if (!next.deferredBattleEntry) deferredAt = null;
    if (next.turn !== state.turn) {
      owner = next.activePlayer;
      if (next.deferredBattleEntry) {
        stale.push({ entry: next.deferredBattleEntry, setBy: deferredAt });
        deferredAt = null;
      }
    }
    state = next;
  }
  return { violation: null, stale, steps: step, winner: state.winner, trace };
}

/** scripts/selfplay.ts と同じ、試合番号から決まる乱数（mulberry32）。 */
export function sweepRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
