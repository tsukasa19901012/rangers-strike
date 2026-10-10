/**
 * 「～してもよい」型の任意効果の共通処理。
 *
 * その場で解決していた効果（選択肢のない「すべて戻す」「すべてホールドする」等）を、
 * 行うかどうかをプレイヤーが選ぶ確認（pendingEffectChoice kind "confirm", mayConfirm）に置き換える。
 * - 行う: confirm_effect_choice → 登録された `apply` を実行
 * - 行わない: skip_effect_choice → 何もしない
 *
 * 選択肢をすでに持つ効果（山札を見て並べる等）は、その選択自体を optional にして
 * skip で何もしないようにする（rules/pendingChoices.ts の scry_keep_one / deck_top_or_bottom）。
 *
 * 出典: 各カードの「～してもよい」（例: RS-064 atwiki/page-268、RS-070 atwiki/page-24）。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";

export type OptionalEffectHandler = {
  /** 行うときの処理。新たな選択を開いてもよい。 */
  apply: (state: GameState, pending: PendingEffectChoice) => GameState;
  /** CPU が行うかどうか（省略時は行う）。 */
  cpuAccepts?: (state: GameState, pending: PendingEffectChoice) => boolean;
};

const HANDLERS = new Map<string, OptionalEffectHandler>();

/** DSL の任意効果（`optional: true` かつ「～してもよい」）を行う処理の登録キー。 */
export const DSL_OPTIONAL_EFFECT_HANDLER = "__dsl_optional__";

function handlerFor(pending: PendingEffectChoice): OptionalEffectHandler | undefined {
  return HANDLERS.get(pending.optionalDslMeta ? DSL_OPTIONAL_EFFECT_HANDLER : pending.effectId);
}

export function registerOptionalEffect(effectId: string, handler: OptionalEffectHandler): void {
  HANDLERS.set(effectId, handler);
}

/** 任意効果の「行う／行わない」確認を開く。 */
export function openOptionalEffectConfirm(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    optionalDslMeta?: PendingEffectChoice["optionalDslMeta"];
  },
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      ...params,
      kind: "confirm",
      validInstanceIds: [],
      selectedInstanceIds: [],
      optional: true,
      mayConfirm: true,
    },
    activePlayer: params.playerId,
  };
}

export function isOptionalEffectConfirm(pending: PendingEffectChoice | undefined): boolean {
  return !!pending?.mayConfirm;
}

/** 確認で「行う」を選んだ。選択を閉じてから登録処理を実行する。 */
export function acceptOptionalEffect(state: GameState, pending: PendingEffectChoice): GameState {
  const cleared: GameState = {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
  };
  const handler = handlerFor(pending);
  return handler ? handler.apply(cleared, pending) : cleared;
}

export function cpuAcceptsOptionalEffect(state: GameState, pending: PendingEffectChoice): boolean {
  const handler = handlerFor(pending);
  if (!handler) return false;
  return handler.cpuAccepts ? handler.cpuAccepts(state, pending) : true;
}
