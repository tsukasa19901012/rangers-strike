/**
 * 撃破に関わる誘発のタイミング（R-TIME-01・R-SIM-01・R-DESTROY-02。ユーザー決定 2026-10-11）。
 *
 * 撃破は次の 4 段階で進み、段階の違う誘発は同時ではない（処理順の選択はなく、この順に解決する）:
 *   1. 「撃破したとき」（撃破した側）                               — "destroyer"
 *   2. 「撃破されたとき」（撃破された側。場に留まっても発動する）     — "destroyed"
 *   3. 撃破されたカードが捨札に移る
 *   4. 「撃破されて捨札になったとき」「捨札になったとき」（実際に捨札に置かれたときだけ） — "after_discard"
 * 根拠: faq-card-4 RS-226 Q1 — キラーオーの【爆竜必殺デススティンガー】（撃破したとき）はアバレッドAM
 * （撃破されて捨札になったとき）より先に対象を選ぶ（段階 1 → 4）。
 * 同じ段階の効果どうしだけが同時で、ターンプレイヤーが順番を決める（R-SIM-01）。
 * RS-212【爆烈ミラージュナックル】の「カードを選ぶとき、…捨札になるなら捨札にしたあとで選ぶ」は選ぶのが段階 4。
 */
import type { DestroyTriggerTiming, GameState, PendingEffectChoice } from "../types/game";
import { openEffectChoice } from "./pendingChoices";

/** 段階 4: 捨札に移ったあとで発動する・選ぶ文言。 */
const AFTER_DISCARD_RE = /捨札にしたあとで選ぶ|捨札になったとき|捨札になるたび|捨札に置かれたとき/;
/** 段階 2: 撃破された側の文言。 */
const DESTROYED_RE = /撃破されたとき|撃破されるたび/;
/** 段階 1: 撃破した側の文言。 */
const DESTROYER_RE = /撃破したとき|撃破するたび/;

/** 段階の順（小さいほど先に解決する）。 */
const STEP: Record<DestroyTriggerTiming, number> = { destroyer: 1, destroyed: 2, after_discard: 4 };

/** 効果文（1つの効果）の文言から、撃破に関わる誘発のタイミングを判定する。撃破の誘発でなければ undefined。 */
export function destroyTriggerTimingOfText(text: string | undefined): DestroyTriggerTiming | undefined {
  if (!text) return undefined;
  if (AFTER_DISCARD_RE.test(text)) return "after_discard";
  if (DESTROYED_RE.test(text)) return "destroyed";
  if (DESTROYER_RE.test(text)) return "destroyer";
  return undefined;
}

/** カード本文から【effectName】の効果の文（次の【 / ※ の手前まで）を取り出す。見つからなければ本文全体。 */
export function namedEffectText(cardText: string | undefined, effectName: string): string | undefined {
  if (!cardText) return undefined;
  const start = cardText.indexOf(`【${effectName}】`);
  if (start < 0) return cardText;
  const rest = cardText.slice(start + effectName.length + 2);
  const end = rest.search(/【|※/);
  return end < 0 ? rest : rest.slice(0, end);
}

/** カード定義の【effectName】の文言からタイミングを判定する。 */
export function destroyTriggerTimingOfNamedEffect(
  state: GameState,
  cardId: string,
  effectName: string,
): DestroyTriggerTiming | undefined {
  return destroyTriggerTimingOfText(namedEffectText(state.definitions[cardId]?.text, effectName));
}

/**
 * 撃破の誘発で開いた選択のうち、まだタイミングが付いていないものに付ける（同じ選択を作り直さない）。
 * before と同じ選択（この処理で開いていない）には付けない。
 */
export function tagOpenedDestroyTrigger(
  before: GameState,
  after: GameState,
  timing: DestroyTriggerTiming,
): GameState {
  const choice = after.pendingEffectChoice;
  if (!choice || choice === before.pendingEffectChoice || choice.destroyTriggerTiming) return after;
  return { ...after, pendingEffectChoice: { ...choice, destroyTriggerTiming: timing } };
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

/**
 * 撃破の誘発の選択 `choice` を開く。既に別の選択が開いていれば、タイミングで順番を決める:
 * - 違う段階（R-TIME-01）: 段階の早いほう（撃破した → 撃破された → 捨札になった）を先に処理する（選択なし）。
 * - 同じ段階・段階不明: ターンプレイヤーが順番を選ぶ（simultaneous_order。R-SIM-01）。
 * 後に回した選択は refreshOnOpen があれば開くときに候補を作り直す。
 */
export function openDestroyTimedChoice(state: GameState, choice: PendingEffectChoice): GameState {
  const existing = state.pendingEffectChoice;
  if (!existing) return openEffectChoice(state, choice);
  const own = choice.destroyTriggerTiming;
  const other = existing.destroyTriggerTiming;
  if (own && other && own !== other) {
    // R-TIME-01: 1 撃破したとき → 2 撃破されたとき → 3 捨札へ → 4 捨札になったとき。faq-card-4 RS-226 Q1。
    if (STEP[own] < STEP[other]) return openEffectChoice(state, appendResume(choice, existing));
    return openEffectChoice(state, appendResume(existing, choice));
  }
  const ownId = choice.sourceInstanceId ?? choice.effectId;
  let existingId = existing.sourceInstanceId ?? existing.effectId;
  if (existingId === ownId) existingId = `${existing.effectId}:${existingId}`;
  const chooser = choice.phasePlayerId;
  return openEffectChoice(state, {
    playerId: chooser,
    effectId: "simultaneous_order",
    sourceCardId: choice.sourceCardId,
    sourceInstanceId: choice.sourceInstanceId,
    kind: "simultaneous_order",
    phasePlayerId: chooser,
    validInstanceIds: [ownId, existingId],
    optional: false,
    battleDestroyOrderMeta: { own: choice, existing, existingId },
  });
}
