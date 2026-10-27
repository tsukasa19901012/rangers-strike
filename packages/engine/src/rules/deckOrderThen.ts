/**
 * 「好きな順で山札の下（上）に戻す」の順を確定した後の続き（rules/deckOrder.ts の deckOrderMeta.then の key）。
 * 効果の続きが resumeChoice で表せないとき（「相手、自分の順に行う」等）に使う。受け取る state は選択を閉じて並べなおした後で、
 * 返した state がそのまま結果になる（続きの proceed は登録側で行う）。
 * 弾ごとのファイルから登録するので、import の循環で未定義にならないよう、ほかのモジュールを import しない。
 */
import type { GameState, PendingEffectChoice } from "../types/game";

export const DECK_ORDER_THEN: Record<string, (state: GameState, pending: PendingEffectChoice, data: unknown) => GameState> = {};
