/**
 * フリーズ・ループの回帰テスト用の進行ドライバ。
 *
 * 盤面から CPU（Lv1/3/5）（または「いつも最初の手」「いつも最後の手」を選ぶ人役）でゲームを進め、
 *  - 勝者が決まっていないのに合法手がない（止まる）
 *  - 同じ局面（ゾーンの中身・選択・フェイズ）に何度も戻る（ループ）
 *  - 見張る選択（effectId）が何度も開き直す
 * を数える。新しい選択や再開処理（ループの優先・処理順・途中の割り込み等）を足したら、その盤面でこれを回す。
 */
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { pickCpuAction } from "../ai";
import type { CpuLevel } from "../ai/types";
import type { GameAction } from "../types/actions";
import type { GameState } from "../types/game";

export type Driver = { kind: "cpu"; level: CpuLevel } | { kind: "first" } | { kind: "last" };

export type DriveResult = {
  driver: string;
  steps: number;
  /** 勝者がいないのに合法手がない、またはどの手も適用できなかった。 */
  stuck: boolean;
  /** 同じ局面に戻った最大回数。 */
  maxRepeat: number;
  /** 見張る effectId ごとの、選択が新しく開いた回数。 */
  opened: Record<string, number>;
  winner: string | null;
};

const ZONES = ["hand", "rush", "battle", "command", "power", "discard", "deck", "exile", "operation"] as const;

function positionKey(s: GameState): string {
  const zones: Record<string, unknown> = {};
  for (const pid of ["player1", "player2"] as const) {
    const p = s.players[pid] as unknown as Record<string, unknown>;
    for (const z of ZONES) {
      const list = p[z];
      if (!Array.isArray(list)) continue;
      zones[`${pid}.${z}`] = list.map((c: { instanceId?: string; commandHeld?: boolean }) => `${c.instanceId}${c.commandHeld ? "*" : ""}`);
    }
  }
  const choice = s.pendingEffectChoice;
  return JSON.stringify({
    t: s.turn,
    ph: s.phase,
    ap: s.activePlayer,
    c: choice ? [choice.effectId, choice.playerId, choice.validInstanceIds] : null,
    zones,
  });
}

function label(d: Driver): string {
  return d.kind === "cpu" ? `cpu Lv${d.level}` : d.kind;
}

function choose(s: GameState, legal: GameAction[], d: Driver): GameAction {
  if (d.kind === "first") return legal[0]!;
  if (d.kind === "last") return legal[legal.length - 1]!;
  return pickCpuAction(s, legal[0]!.playerId, d.level) ?? legal[0]!;
}

export function drive(start: GameState, driver: Driver, opts: { steps?: number; watch?: string[] } = {}): DriveResult {
  const steps = opts.steps ?? 300;
  const watch = new Set(opts.watch ?? []);
  const opened: Record<string, number> = {};
  const seen = new Map<string, number>();
  let s = start;
  let prevChoiceKey: string | undefined;
  let maxRepeat = 0;
  let stuck = false;
  let i = 0;
  for (; i < steps && !s.winner; i++) {
    const choice = s.pendingEffectChoice;
    const choiceKey = choice ? `${choice.effectId}|${choice.playerId}|${(choice.validInstanceIds ?? []).join(",")}` : undefined;
    if (choice && watch.has(choice.effectId) && choiceKey !== prevChoiceKey) opened[choice.effectId] = (opened[choice.effectId] ?? 0) + 1;
    prevChoiceKey = choiceKey;
    const key = positionKey(s);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > maxRepeat) maxRepeat = n;
    const legal = getLegalActions(s);
    if (legal.length === 0) {
      stuck = true;
      break;
    }
    const picked = choose(s, legal, driver);
    let r = applyAction(s, picked);
    if (!r.ok) r = applyAction(s, legal[0]!);
    if (!r.ok) {
      stuck = true;
      break;
    }
    s = r.state;
  }
  return { driver: label(driver), steps: i, stuck, maxRepeat, opened, winner: s.winner ?? null };
}

export const DEFAULT_DRIVERS: Driver[] = [{ kind: "cpu", level: 1 }, { kind: "cpu", level: 3 }, { kind: "cpu", level: 5 }, { kind: "first" }, { kind: "last" }];

/**
 * すべてのドライバで進めて、止まらない・同じ局面に maxRepeat 回より多く戻らない・見張る選択が maxOpen 回より多く開かないことを返す。
 * 失敗した結果だけを返す（空ならよい）。
 */
export function freezeProblems(
  start: () => GameState,
  opts: { watch?: string[]; maxOpen?: number; maxRepeat?: number; steps?: number; drivers?: Driver[] } = {},
): DriveResult[] {
  const maxOpen = opts.maxOpen ?? 3;
  const maxRepeat = opts.maxRepeat ?? 3;
  const out: DriveResult[] = [];
  for (const d of opts.drivers ?? DEFAULT_DRIVERS) {
    const r = drive(start(), d, opts);
    const tooOpen = Object.values(r.opened).some((n) => n > maxOpen);
    if (r.stuck || r.maxRepeat > maxRepeat || tooOpen) out.push(r);
  }
  return out;
}

/** 見張る選択が、少なくとも1つのドライバで実際に開いたか（盤面が仕組みを通っているかの確認）。 */
export function watchedOpened(start: () => GameState, watch: string[], drivers: Driver[] = DEFAULT_DRIVERS): boolean {
  return drivers.some((d) => {
    const r = drive(start(), d, { watch, steps: 40 });
    return watch.some((w) => (r.opened[w] ?? 0) > 0);
  });
}
