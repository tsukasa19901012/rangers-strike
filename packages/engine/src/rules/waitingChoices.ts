/**
 * 選択の後ろで待っている選択（resumeChoice）を、アクションの処理で落とさないための見張り。
 *
 * 効果の選択（A）の後ろに、別のカードの選択（B。例: 同じラッシュで出た RS-558【鍵の持ち主の願い】のドロー）が
 * 積まれていることがある。A を解決する処理は効果ごとに書かれていて、A を閉じるときに resumeChoice を引き継ぎ忘れると
 * B が消える（2026-11-06: RS-180 ライドラプターの選択を閉じるとガンマジンのドローが消えた。sweep/resumeChoiceAllCards.test.ts
 * で 30 枚ほど同じ形が見つかった）。
 *
 * いちばん外側の applyAction の後で、前の状態で待っていた「別のカードの」選択が、後の状態のどこにも残っていなければ
 * 付け直す。同じカード（同じ sourceInstanceId）の続きは、その効果が自分で打ち切ることがある（「そうしたとき」の続きを
 * 見送った等）ので触らない。
 */
import type { GameState, PendingEffectChoice } from "../types/game";
import { appendResumeChoice, openEffectChoice } from "./pendingChoices";

const keyOf = (c: Pick<PendingEffectChoice, "effectId" | "sourceInstanceId" | "playerId">) =>
  `${c.effectId}|${c.sourceInstanceId ?? ""}|${c.playerId}`;

/** 開いている選択の後ろで待っている、別のカードの選択（積まれた順）。 */
function waitingFromOtherCards(state: GameState): PendingEffectChoice[] {
  const top = state.pendingEffectChoice;
  if (!top) return [];
  const out: PendingEffectChoice[] = [];
  for (let c = top.resumeChoice; c; c = c.resumeChoice) {
    if (c.sourceInstanceId !== top.sourceInstanceId) out.push(c);
  }
  return out;
}

/** 状態のどこか（開いている選択・その続き・効果ラッシュの預かり・撃破の誘発の待ち行列等）に、その選択が残っているか。 */
function stillWaiting(state: GameState, keys: Set<string>): Set<string> {
  const found = new Set<string>();
  const walk = (v: unknown, depth: number): void => {
    if (found.size === keys.size || depth > 40 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    const o = v as Record<string, unknown>;
    if (typeof o.effectId === "string" && typeof o.playerId === "string") {
      const k = keyOf(o as unknown as PendingEffectChoice);
      if (keys.has(k)) found.add(k);
    }
    for (const [name, x] of Object.entries(o)) {
      if (name === "definitions" || name === "log") continue;
      walk(x, depth + 1);
    }
  };
  walk(state, 0);
  return found;
}

/** before で待っていた別のカードの選択が after で消えていたら、after の続きに付け直す。 */
export function keepWaitingChoices(before: GameState, after: GameState): GameState {
  const waiting = waitingFromOtherCards(before);
  if (waiting.length === 0) return after;
  const keys = new Set(waiting.map(keyOf));
  const present = stillWaiting(after, keys);
  const lost = waiting.filter((c) => !present.has(keyOf(c)));
  if (lost.length === 0) return after;
  // 落ちた選択を、積まれていた順のまま 1 本の続きにする（それぞれの元の続きは、残っていれば上で見つかっている）。
  const chain = lost.reduceRight<PendingEffectChoice | undefined>(
    (rest, c) => ({ ...c, resumeChoice: rest }),
    undefined,
  )!;
  if (after.pendingEffectChoice) {
    return { ...after, pendingEffectChoice: appendResumeChoice(after.pendingEffectChoice, chain) };
  }
  if (after.pendingEffectRush) {
    const rush = after.pendingEffectRush;
    return {
      ...after,
      pendingEffectRush: { ...rush, resumeChoice: rush.resumeChoice ? appendResumeChoice(rush.resumeChoice, chain) : chain },
    };
  }
  if (
    after.pendingDamagePayment ||
    after.pendingLeave ||
    after.pendingRegister ||
    after.pendingCommandPayment ||
    after.pendingZordSetup ||
    after.pendingStrike ||
    after.pendingBattle ||
    after.pendingRush ||
    after.pendingMorph ||
    after.pendingChase ||
    after.pendingRideOffChoice ||
    after.pendingScry
  ) {
    // 支払い・反応などの途中: 撃破の誘発の待ち行列（選択が開いていない間に順に開く）に積む。
    return {
      ...after,
      deferredDestroyTriggers: [...(after.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: chain }],
    };
  }
  return openEffectChoice(after, chain);
}
