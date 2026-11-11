import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";

/**
 * ルール: R-SIM-02 — 止められない無限ループ（継続効果どうしが互いの条件を崩し合う等）になったときは、発動したカードの持ち主に
 * 関係なく、ターンプレイヤーが優先する効果を選び、そこで処理を止める（docs/rules/06-effects-timing.md・atwiki/page-2167）。
 *
 * - 各カードのモジュールが `registerLoopDetector` で「いまループになっている組」（LoopConflict）を返す関数を登録する。
 *   検出は選んだ結果（`state.loopPriority`）を見ずに行う（`withoutLoopPriority` の状態で判定する）。見ると、選んだ結果で
 *   ループが消えたように見えて、また選ばせてしまう。
 * - このモジュールは他のモジュールを import しない（効果のモジュールがモジュールの初期化で登録するため）。
 * - いちばん外側の applyAction の後（core/applyAction.ts）に `openLoopPriorityIfNeeded` が、まだ選んでいない組があれば
 *   ターンプレイヤーに「どちらの効果を優先するか」の選択（effectId `loop_priority`、kind simultaneous_order、候補は効果の発動元）を開く。
 *   選んだ結果は `state.loopPriority[key]` に残り、各効果は `loopWinner` を見て優先しなかった側を適用しない。
 * - 組が無くなったら（カードが場を離れた等）結果を消す。同じ組がまた起きたら選び直す。
 * - 選ぶまで（探索の途中など）は今までの扱いのまま（各効果の既定）。
 */
export const LOOP_PRIORITY_EFFECT_ID = "loop_priority";

export type LoopConflict = {
  /** 組の ID（カードのインスタンス ID を含めて一意にする）。 */
  key: string;
  /** 優先できる効果の発動元（インスタンス ID）。2 つ以上。 */
  options: string[];
  sourceCardId: string;
  sourceInstanceId?: string;
};

type LoopDetector = (state: GameState) => LoopConflict[];

const DETECTORS: LoopDetector[] = [];

export function registerLoopDetector(detector: LoopDetector): void {
  DETECTORS.push(detector);
}

/** 組 key でターンプレイヤーが優先した効果の発動元（まだ選んでいなければ undefined）。 */
export function loopWinner(state: Partial<Pick<GameState, "loopPriority">>, key: string): string | undefined {
  return state.loopPriority?.[key];
}

/** 選んだ結果を見ない状態（ループの検出用）。 */
export function withoutLoopPriority<T extends Partial<Pick<GameState, "loopPriority">>>(state: T): T {
  return state.loopPriority ? { ...state, loopPriority: undefined } : state;
}

function detectAll(state: GameState): LoopConflict[] {
  if (DETECTORS.length === 0) return [];
  const raw = withoutLoopPriority(state);
  return DETECTORS.flatMap((d) => d(raw)).filter((c) => c.options.length >= 2);
}

/**
 * ループになった組のうち、まだ優先を選んでいないものがあれば選択を開く。無くなった組の結果は消す。
 * 他の選択・反応の窓が開いている間は canOpen を偽にして呼ぶ（呼ぶ側で hasBlockingInteraction を見る）。CPU は両方を試して評価の良いほう（ai/helpers.ts）。
 */
export function openLoopPriorityIfNeeded(state: GameState, chooser: PlayerId, canOpen = true): GameState {
  if (DETECTORS.length === 0) return state;
  const conflicts = detectAll(state);
  let next = state;
  if (state.loopPriority) {
    const live = new Set(conflicts.map((c) => c.key));
    const kept = Object.fromEntries(Object.entries(state.loopPriority).filter(([k, v]) => live.has(k) && conflicts.some((c) => c.key === k && c.options.includes(v))));
    if (Object.keys(kept).length !== Object.keys(state.loopPriority).length) {
      next = { ...next, loopPriority: Object.keys(kept).length > 0 ? kept : undefined };
    }
  }
  if (!canOpen || next.pendingEffectChoice) return next;
  const open = conflicts.find((c) => loopWinner(next, c.key) === undefined);
  if (!open) return next;
  const choice: PendingEffectChoice = {
    playerId: chooser,
    effectId: LOOP_PRIORITY_EFFECT_ID,
    sourceCardId: open.sourceCardId,
    sourceInstanceId: open.sourceInstanceId,
    kind: "simultaneous_order",
    phasePlayerId: chooser,
    validInstanceIds: open.options,
    optional: false,
    loopPriorityMeta: { key: open.key },
  };
  // import の循環を避けるため、openEffectChoice を使わずに開く（refreshOnOpen 等は付けない選択なので同じ）。
  return { ...next, pendingEffectChoice: { ...choice, selectedInstanceIds: [] }, activePlayer: chooser };
}

/** 優先する効果を選んだ（rules/pendingChoices.ts の simultaneous_order から）。選択はまだ閉じない。 */
export function recordLoopPriority(state: GameState, key: string, winnerId: string): GameState {
  return { ...state, loopPriority: { ...(state.loopPriority ?? {}), [key]: winnerId } };
}

/**
 * XG6-053 仮面ライダーアーク（※これ以外のユニットが S ユニットだけなら L）と、「自分か相手のLユニットがあれば、これはLユニットになる」
 * ユニット（RS-558 ガンマジン・RS-420・RS-454）のループの組の ID（atwiki/page-1186 Q6。rules/legend1/set8NamedEffectsB.ts）。
 */
export function arkLargeLoopKey(arkInstanceId: string, otherInstanceId: string): string {
  return `xg6053_large:${arkInstanceId}:${otherInstanceId}`;
}

/** アークとのループで、アークでない側（ガンマジン等）が優先されている組があるか。 */
export function arkLargeLoopLost(state: Partial<Pick<GameState, "loopPriority">>, arkInstanceId: string): boolean {
  const prefix = `xg6053_large:${arkInstanceId}:`;
  return Object.entries(state.loopPriority ?? {}).some(([k, v]) => k.startsWith(prefix) && v !== arkInstanceId);
}

/** アークとのループで、otherInstanceId（ガンマジン等）が優先されているか。 */
export function arkLargeLoopWonBy(state: Partial<Pick<GameState, "loopPriority">>, otherInstanceId: string): boolean {
  const suffix = `:${otherInstanceId}`;
  return Object.entries(state.loopPriority ?? {}).some(([k, v]) => k.startsWith("xg6053_large:") && k.endsWith(suffix) && v === otherInstanceId);
}
