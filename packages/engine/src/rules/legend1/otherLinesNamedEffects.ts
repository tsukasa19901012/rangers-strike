/**
 * RS 以外のライン（XG1〜7・XP・RM・SK …）のカード固有の名前付き効果と継続効果。
 * 対戦カタログ（full-playable）に入った実カードで RS の Q&A を再現したときに見つかった未接続の効果をここで扱う。
 *
 * - `tryOtherLinesCardEffect`: DSL の grant_keyword から呼ばれる起点（`other::cardId::name`）。
 * - `tryResolveOtherLinesChoice` / `trySkipOtherLinesChoice`: このモジュールが開いた選択の解決。
 * 構成は rules/legend1/set9NamedEffectsD.ts と同じ。
 */
import type { CardInstance, DeferredDestroyTrigger, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { namedTextNegated } from "./set6NamedEffects348";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isOtherLinesChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveOtherLinesChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipOtherLinesChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

/** 選択を閉じた state（resumeChoice はまだ開かない）。 */
function close(state: GameState, pending: PendingEffectChoice): GameState {
  return state.pendingEffectChoice === pending
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
}

/** 効果の処理を終える（割り込みがなければ resumeChoice を開くかバトル進入を続ける）。 */
function proceed(state: GameState, pending: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) {
    return pending.resumeChoice ? { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, pending.resumeChoice) } : state;
  }
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    if (!pending.resumeChoice) return state;
    const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
  }
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function findField(state: GameState, playerId: PlayerId, instanceId: string): { zone: "battle" | "rush"; card: CardInstance } | undefined {
  for (const zone of ["battle", "rush"] as const) {
    const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// XG3-036 ダイカイオーヒガシ【海老ばさみ本手返し】
// 「これをラッシュしたとき、そのターン中、これは、BP+3000される。」（atwiki/page-1873）
// ターン中の BP 修正（CardInstance.bpModifier。ターン終了時にクリア）。

export const EBI_BASAMI_EFFECT_ID = "xg3036_ebi_basami";

function applyEbiBasami(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const found = selfId ? findField(state, ctx.playerId, selfId) : undefined;
  if (!found) return { state, detail: `${EBI_BASAMI_EFFECT_ID}:not_in_field` };
  const next = patchPlayer(state, ctx.playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => (c.instanceId === selfId ? { ...c, bpModifier: (c.bpModifier ?? 0) + 3000 } : c)),
  }));
  return { state: next, detail: EBI_BASAMI_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// XG1-034 害気大臣キタネイダス【汚い大気】
// 「これが自軍エリアにある間、自分も相手も次の制限を受ける⇒バトルフェイズ中、パワーゾーンからカードが離れる処理を含む効果は
//  すべて無効になる。」（atwiki/page-1582）
// 他の選択肢を含む効果も（パワーゾーンのカードが動く可能性があれば）無効（Q6 Vレックスロボ・カード評価）。
// 適用箇所: RS-265【ラウンドレーダー】と※（Q3/Q4）、RS-235 ※（Q5）、RS-301【リボルバーミサイル】（Q6）、モーフ（Q2）、
// XG2-042 ※「その場に留まる」（Q1）、DSL の誘発効果でパワーゾーンのカードを選ぶもの。

export const FILTHY_AIR_CARD_ID = "XG1-034";

/** 【汚い大気】がいま有効か（バトルフェイズ中で、どちらかの自軍エリアにキタネイダスがあり、効果名のテキストが無効でない）。 */
export function filthyAirActive(state: Pick<GameState, "phase" | "players" | "definitions">): boolean {
  if (state.phase !== "battle") return false;
  for (const pid of ["player1", "player2"] as const) {
    for (const card of fieldUnits(state, pid)) {
      if (card.cardId !== FILTHY_AIR_CARD_ID) continue;
      if (!namedTextNegated(state, pid, card)) return true;
    }
  }
  return false;
}

/** DSL の効果がパワーゾーンのカードを選ぶ（＝パワーゾーンからカードが離れる処理を含む）か。 */
export function dslEffectSelectsPowerCards(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(dslEffectSelectsPowerCards);
  const rec = node as Record<string, unknown>;
  if (rec.type === "zone" && rec.zone === "power") return true;
  return Object.values(rec).some(dslEffectSelectsPowerCards);
}

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const OTHER_LINES_KEYWORD_PREFIX = "other::";

const OTHER_LINES_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "XG3-036::ebi_basami": applyEbiBasami,
  // 継続効果（filthyAirActive を各効果の側で参照する。ここでは何もしない）。
  "XG1-034::filthy_air": (state) => ({ state, detail: "xg1034_filthy_air" }),
};

export function tryOtherLinesCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(OTHER_LINES_KEYWORD_PREFIX)) return null;
  const handler = OTHER_LINES_KEYWORDS[keyword.slice(OTHER_LINES_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールが開いた選択の CPU の手。対象外なら null。 */
export function pickOtherLinesCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const picks = actions.filter((a) => a.type === "resolve_effect_choice");
  return picks[0] ?? actions.find((a) => a.type === "skip_effect_choice") ?? null;
}

// 未使用警告を避けるための参照（後続の効果で使う）。
void close;
void proceed;
void fieldUnits;
void logFor;
void skipLog;
void CHOICE_SKIPPERS;
