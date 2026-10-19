/**
 * クロスギャザー ザ・Wインパクト（XG3）のカード固有の効果の登録簿（rules/xg3/xg3Effects.ts が公開する入口から引く）。
 *
 * バッチごとのファイル（xg3aEffects.ts 等）が、grant_keyword のキーワード（`xg3::cardId::name`）・選択の解決・見送り・確定・
 * コマンドの支払い（effect_hold）の続きをここに登録する。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 */
import type { CardInstance, DeferredPowerFlip, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import type { ChoiceOutcome } from "../rm/rm1Effects";

export type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type KeywordHandler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;

export const XG3_KEYWORD_PREFIX = "xg3::";

export const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
export const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
export const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
/** コマンドの支払い（effect_hold）でホールドを選び終えたときの続き（resolve_effect_choice では答えない）。 */
export const HOLD_COMPLETERS: Record<string, (state: GameState, pending: PendingEffectChoice, holdIds: string[]) => GameState> = {};
/** `xg3::` の後ろ（`XG3-NNN::name`）→ 処理。 */
export const KEYWORDS: Record<string, KeywordHandler> = {};
/** applyAction の後処理（深さ0の行動のあと。core/applyAction.ts）。 */
export const AFTER_ACTION_HOOKS: Array<(before: GameState, after: GameState) => GameState> = [];
/** 「自分がターンを終えるとき」: 処理待ちの項目（"kind:instanceId"）を集める・1つ開く（rules/turnEndingEffects.ts）。 */
export const TURN_END_HOOKS: Array<{
  collect: (state: GameState, endingPlayerId: PlayerId) => string[];
  kind: string;
  open: (state: GameState, endingPlayerId: PlayerId, instanceId: string) => GameState;
}> = [];
/** 自軍のパワーゾーン等から起動する効果（self_rush_from_zone の合法手。rules/keywordGapRuntime.ts）。 */
export const ZONE_ACTIVATIONS: Array<{
  zone: "power" | "command" | "hand";
  matches: (cardId: string) => boolean;
  canActivate: (state: GameState, playerId: PlayerId, instanceId: string) => boolean;
  activate: (state: GameState, playerId: PlayerId, instanceId: string) => GameState;
}> = [];
/** パワーのカードをウラ返してダメージにする前（「ウラ返すとき」。rules/damagePayment.ts flipPowerForDamage）。選択を開いたら state を返す。 */
export const BEFORE_FLIP_HOOKS: Array<(state: GameState, flip: DeferredPowerFlip) => GameState | null> = [];
/** 自軍ユニットがバトルエリアに出たとき（「〜からコンビネーションするとき」を含む。rules/combo.ts）。選択を開いたら pendingEffectChoice を残す。 */
export const ENTER_BATTLE_HOOKS: Array<(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]) => GameState> = [];
/** 自分がユニットをラッシュしたとき（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。 */
export const UNIT_RUSHED_HOOKS: Array<(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId) => GameState> = [];
/** 「自軍スタートフェイズ開始時」（rules/startPhaseBegin.ts。3行程より前）。 */
export const START_PHASE_HOOKS: Array<(state: GameState, playerId: PlayerId) => GameState> = [];
/** ユニットがストライクしたとき（events/listeners/strikeDeclaredListener.ts）。 */
export const STRIKE_HOOKS: Array<(state: GameState, strikerPlayerId: PlayerId, striker: CardInstance) => GameState> = [];
/** 場のユニットの起動（activate_field_unit_ability。rules/fieldActivatedAbilities.ts）。 */
export const FIELD_ABILITIES: Array<{
  matches: (cardId: string) => boolean;
  canActivate: (state: GameState, playerId: PlayerId, card: CardInstance) => boolean;
  resolve: (state: GameState, playerId: PlayerId, card: CardInstance) => GameState;
}> = [];
