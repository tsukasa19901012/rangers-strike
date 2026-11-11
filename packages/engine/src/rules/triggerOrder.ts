import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";

/**
 * ルール: R-SIM-01 — 同時に誘発した 2 つの効果（どちらも選択を開く）の処理順は、発動したカードの持ち主に関係なく
 * ターンプレイヤーが選ぶ（docs/rules/06-effects-timing.md・atwiki/page-2167）。
 *
 * 撃破の誘発の順番（rules/destroyTriggerTiming.ts）と同じ simultaneous_order の選択（battleDestroyOrderMeta）を作る。
 * 候補は 2 つの効果の発動元（sourceInstanceId）で、選んだほうを先に開き、もう一方をその続き（resumeChoice）にする
 * （解決は rules/pendingChoices.ts の simultaneous_order。CPU は両方の順を試して評価の良いほう。ai/helpers.ts）。
 * 順番で結果が変わるときだけ呼ぶ（変わらなければ今までどおり片方の続きにもう一方を積む）。
 * 後に回す選択の候補が先の効果で変わるときは、その選択に refreshOnOpen を付けておく。
 */
export function triggerOrderChoice(
  chooser: PlayerId,
  first: PendingEffectChoice,
  second: PendingEffectChoice,
): PendingEffectChoice {
  const firstId = first.sourceInstanceId ?? first.effectId;
  let secondId = second.sourceInstanceId ?? second.effectId;
  if (secondId === firstId) secondId = `${second.effectId}:${secondId}`;
  return {
    playerId: chooser,
    effectId: "simultaneous_order",
    sourceCardId: first.sourceCardId,
    sourceInstanceId: first.sourceInstanceId,
    kind: "simultaneous_order",
    phasePlayerId: chooser,
    validInstanceIds: [firstId, secondId],
    optional: false,
    battleDestroyOrderMeta: { own: first, existing: second, existingId: secondId },
  };
}

/**
 * 「バトルエリアに出たとき」に、ほかのカードの効果と同時に誘発する効果の選択を取り出す関数の登録先
 * （import の循環を避けるため、効果のモジュールがここに登録する。例: RK-239 ウエイクアップ！ — rules/rk/rk12UnitEffects.ts）。
 * 取り出した効果は、その進入ではもう開かない（記録を使い切る）。
 */
export type EntryTriggerTaker = (
  state: GameState,
  playerId: PlayerId,
  enteredId: string,
) => { state: GameState; choice?: PendingEffectChoice };

/** RK-239 ウエイクアップ！（ホールド状態の自軍 S ユニットが出たとき）。 */
export const WAKE_UP_ENTRY_TAKER = "rk239_wake_up";

const ENTRY_TRIGGER_TAKERS: Record<string, EntryTriggerTaker> = {};

export function registerEntryTriggerTaker(key: string, taker: EntryTriggerTaker): void {
  ENTRY_TRIGGER_TAKERS[key] = taker;
}

export function takeEntryTrigger(
  key: string,
  state: GameState,
  playerId: PlayerId,
  enteredId: string,
): { state: GameState; choice?: PendingEffectChoice } {
  return ENTRY_TRIGGER_TAKERS[key]?.(state, playerId, enteredId) ?? { state };
}
