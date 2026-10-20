/**
 * 撃破の誘発を段階の順に解決するための待ち行列（R-TIME-01・R-SIM-01・R-DESTROY-02。ユーザー決定 2026-10-11）。
 *
 * 1「撃破したとき」→ 2「撃破されたとき」→ 3 捨札へ移動 → 4「撃破されて捨札になったとき」「捨札になったとき」。
 * 先の段階の効果は、自動処理か選択かを問わず、後の段階の効果より先にすべて解決する。
 *
 * 使い方（バトルで撃破したとき。rules/operationCounters.ts）:
 *   1. beginDestroyTriggerHold で保留を立てて撃破する — 撃破された側の誘発（段階 2・4）は解決されず
 *      deferredDestroyTriggers に積まれる（rules/leaveEffects.ts）。
 *   2. endDestroyTriggerHold で保留を下ろしてから、撃破した側の段階 1 の効果（自動処理・選択）を処理する。
 *   3. drainDeferredDestroyTriggers で積んだ誘発を段階の順に解決する。選択が開けばそこで止まり、
 *      その選択（と再開する選択）がすべて解決したあと（core/applyAction.ts の後処理）に続きを解決する。
 * 同じ段階の効果どうしは同時（R-SIM-01）。撃破した側の選択（RS-212）が、同じ段階の選択が開いているときに来たら
 * openDestroyTimedChoice でターンプレイヤーが順番を選ぶ（faq-card-4 RS-212 Q1）。
 */
import type {
  DeferredDestroyTrigger,
  DestroyTriggerTiming,
  GameState,
  PendingEffectChoice,
  PlayerId,
} from "../types/game";
import { resolveAfterDiscardDestroyEffects, resolveDestroyedFactEffects } from "./leaveEffects";
import { openMirageKnuckleChoice } from "./legend1/set4NamedEffects";
import { applyConfirmEffectChoice, openEffectChoice } from "./pendingChoices";

const STEP: Record<DestroyTriggerTiming, number> = { destroyer: 1, destroyed: 2, after_discard: 4 };

/** 撃破された側の誘発を積み始める（撃破の直前に呼ぶ）。 */
export function beginDestroyTriggerHold(state: GameState): GameState {
  return state.destroyTriggerHold ? state : { ...state, destroyTriggerHold: true };
}

/** 積むのをやめる（積んだ誘発はそのまま。drainDeferredDestroyTriggers で解決する）。 */
export function endDestroyTriggerHold(state: GameState): GameState {
  if (!state.destroyTriggerHold) return state;
  const { destroyTriggerHold: _h, ...rest } = state;
  return rest as GameState;
}

/** 撃破した側の RS-212【爆烈ミラージュナックル】（段階 4）を待ち行列に積む。 */
export function queueMirageKnuckle(
  state: GameState,
  attackerId: PlayerId,
  attackerInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (phasePlayerId !== attackerId) return state;
  const player = state.players[attackerId];
  const striker = [...player.battle, ...player.rush].find((c) => c.instanceId === attackerInstanceId);
  if (striker?.cardId !== "RS-212") return state;
  const frame: DeferredDestroyTrigger = {
    kind: "mirage_knuckle",
    step: "after_discard",
    attackerId,
    attackerInstanceId,
    phasePlayerId,
  };
  return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
}

function isBlocked(state: GameState): boolean {
  return !!(state.pendingEffectChoice || state.pendingDamagePayment || state.pendingLeave || state.pendingRegister);
}

function runFrame(state: GameState, frame: DeferredDestroyTrigger): { state: GameState; logs: string[] } {
  switch (frame.kind) {
    case "destroyed_fact":
      return resolveDestroyedFactEffects(state, frame.ownerPlayerId, frame.cardId, frame.battleDestroyInfo);
    case "after_discard":
      return resolveAfterDiscardDestroyEffects(state, frame.ctx);
    case "mirage_knuckle":
      return {
        state: openMirageKnuckleChoice(state, frame.attackerId, frame.attackerInstanceId, frame.phasePlayerId),
        logs: [],
      };
    case "resume_multi_destroy": {
      const resumed = applyConfirmEffectChoice(
        { ...state, pendingEffectChoice: frame.pending },
        frame.pending.playerId,
      );
      if ("error" in resumed) return { state, logs: [] };
      return { state: resumed.state, logs: resumed.log ? [resumed.log] : [] };
    }
    case "open_choice":
      return { state: openEffectChoice(state, frame.pending), logs: [] };
  }
}

/** 撃破した側の段階 1（「撃破したとき」「撃破するたび」「撃破する。そうしたとき」）の文言をカード本文が持つか。 */
const DESTROYER_STEP1_RE = /撃破したとき|撃破するたび|撃破(?:する|してもよい)。そうしたとき/;

export function hasDestroyerStep1Text(text: string | undefined): boolean {
  return !!text && DESTROYER_STEP1_RE.test(text);
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

/**
 * 効果で撃破したとき（R-TIME-01）: 撃破した効果の処理（段階 1 を含む）を終えた状態 `state` で保留を下ろし、
 * 積んだ撃破された側の誘発（段階 2・4）を段階の順に解決する。`hadHold` は効果の処理の前から保留が立っていたか
 * （バトルの撃破の途中など。そのときは呼び出し元が解決する）。
 * 効果の続きの選択（resumeChoice 等）が開いていれば、撃破された側の誘発を先に解決し、その選択はあとに回す
 * （R-TIME-04 入れ子: 撃破された側の誘発が割り込む）。
 */
export function releaseDestroyTriggerHold(state: GameState, hadHold: boolean): GameState {
  if (hadHold) return state;
  const released = endDestroyTriggerHold(state);
  if (!released.deferredDestroyTriggers?.length) return released;
  if (released.pendingDamagePayment || released.pendingLeave || released.pendingRegister) return released;
  const open = released.pendingEffectChoice;
  const drained = drainDeferredDestroyTriggers(open ? { ...released, pendingEffectChoice: undefined } : released);
  if (!open) return drained;
  if (drained.pendingEffectChoice) {
    return { ...drained, pendingEffectChoice: appendResume(drained.pendingEffectChoice, open) };
  }
  return { ...drained, pendingEffectChoice: open, activePlayer: open.playerId };
}

/**
 * 積んだ撃破の誘発を段階の順（同じ段階は積んだ順）に解決する。
 * 選択・ダメージの支払い・離場の反応が開いていれば、そこで止める（続きは後で再び呼ぶ）。
 */
export function drainDeferredDestroyTriggers(state: GameState): GameState {
  let next = state;
  for (let guard = 0; guard < 100; guard += 1) {
    const queue = next.deferredDestroyTriggers;
    if (!queue || queue.length === 0) break;
    if (next.destroyTriggerHold || next.winner) return next;
    let index = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (STEP[queue[i]!.step] < STEP[queue[index]!.step]) index = i;
    }
    const frame = queue[index]!;
    if (isBlocked(next)) {
      // R-SIM-01: 撃破した側の選択が、開いている同じ段階の選択と同時なら、今開いて順番をターンプレイヤーが選ぶ。
      const open = next.pendingEffectChoice;
      const sameStepChoice =
        frame.kind === "mirage_knuckle" &&
        !!open &&
        open.destroyTriggerTiming === frame.step &&
        !next.pendingDamagePayment &&
        !next.pendingLeave &&
        !next.pendingRegister;
      if (!sameStepChoice) return next;
    }
    const rest = queue.filter((_, i) => i !== index);
    const base: GameState = { ...next, deferredDestroyTriggers: rest.length > 0 ? rest : undefined };
    const ran = runFrame(base, frame);
    next = ran.logs.length > 0 ? { ...ran.state, log: [...ran.state.log, ...ran.logs] } : ran.state;
  }
  if (next.deferredDestroyTriggers && next.deferredDestroyTriggers.length === 0) {
    const { deferredDestroyTriggers: _q, ...rest } = next;
    return rest as GameState;
  }
  return next;
}
