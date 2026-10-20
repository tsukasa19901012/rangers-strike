/**
 * クロスギャザー ザ・ファーストエンカウント XG1-001〜XG1-100 のカード固有の効果の共通部分（選択の登録表と起点）。
 *
 * - `XG1_KEYWORDS`: DSL の grant_keyword（`xg1::cardId::name`）から呼ばれる効果。各カードのモジュール（rules/xg1/xg1aEffects.ts 等）が登録する。
 * - `XG1_RESOLVERS` / `XG1_SKIPPERS` / `XG1_CONFIRMERS` / `XG1_HOLD_COMPLETERS`: このシリーズが開いた選択の解決。
 * 選択の組み立ては rules/rm/rm1Effects.ts の共通の部品（openAfter・proceed・moveFieldUnit 等）を使う。
 * 公開の入口（grantKeyword・pendingChoices・legalActions から呼ぶもの）は rules/xg1/xg1Effects.ts。
 */
import type { GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import type { ChoiceOutcome } from "../rm/rm1Effects";

export type Xg1Resolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type Xg1Skipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type Xg1Keyword = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;

export const XG1_KEYWORD_PREFIX = "xg1::";

export const XG1_RESOLVERS: Record<string, Xg1Resolver> = {};
export const XG1_SKIPPERS: Record<string, Xg1Skipper> = {};
export const XG1_CONFIRMERS: Record<string, Xg1Skipper> = {};
/** コマンドの支払い（effect_hold）でホールドを選び終えたときの続き（resolve_effect_choice では答えない）。 */
export const XG1_HOLD_COMPLETERS: Record<string, (state: GameState, pending: PendingEffectChoice, holdIds: string[]) => GameState> = {};
export const XG1_KEYWORDS: Record<string, Xg1Keyword> = {};

export const noop = (detail: string): Xg1Keyword => (state) => ({ state, detail });
