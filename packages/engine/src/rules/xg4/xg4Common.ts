/**
 * クロスギャザー ザ・ジェットアクセル XG4-001〜XG4-102 のカード固有の効果の共通部品（cardSpec XG4-* の監査）。
 *
 * - 選択の登録（`XG4_CHOICES`）と解決の起点（`tryResolveXg4Choice` / `trySkipXg4Choice` / `tryConfirmXg4Choice`）。各バッチのモジュール
 *   （rules/xg4/xg4aEffects.ts 等）が自分の選択を登録する。
 * - `XG4_KEYWORDS`: DSL の grant_keyword（`xg4::cardId::name`）の処理の登録。
 * - ターンの記録（スコープ付きのルール修飾子）の読み書き。
 * 選択の組み立ては rules/rm/rm1Effects.ts と同じ（openAfter・close・proceed 等をそのまま使う）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { getDefinition, unitSizeOf } from "../../core/catalog";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { fieldUnits, findField, stripForZone, zoneOfField } from "../rm/rm1Effects";

export type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
export type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

export const XG4_RESOLVERS: Record<string, ChoiceResolver> = {};
export const XG4_SKIPPERS: Record<string, ChoiceSkipper> = {};
export const XG4_CONFIRMERS: Record<string, ChoiceSkipper> = {};

export type Xg4Handler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;
export const XG4_KEYWORDS: Record<string, Xg4Handler> = {};

export const XG4_KEYWORD_PREFIX = "xg4::";

export function isXg4ChoiceEffect(effectId: string): boolean {
  return effectId in XG4_RESOLVERS;
}

export function tryResolveXg4Choice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = XG4_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipXg4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  if (!(pending.effectId in XG4_RESOLVERS)) return null;
  const skipper = XG4_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function canConfirmXg4Choice(pending: PendingEffectChoice): boolean {
  if (!(pending.effectId in XG4_CONFIRMERS)) return false;
  return pending.kind === "confirm" || (pending.mayConfirm === true && (pending.selectedInstanceIds?.length ?? 0) > 0);
}

export function tryConfirmXg4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = XG4_CONFIRMERS[pending.effectId];
  if (!confirmer) return null;
  if (!canConfirmXg4Choice(pending)) return { error: "no_selection" };
  return confirmer(state, playerId);
}

/** DSL の grant_keyword（`xg4::`）の起点。 */
export function tryXg4CardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(XG4_KEYWORD_PREFIX)) return null;
  const handler = XG4_KEYWORDS[keyword.slice(XG4_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

export const noop = (detail: string): Xg4Handler => (state) => ({ state, detail });

// ---------------------------------------------------------------------------
// ターンの記録

/** playerId のこのターンの ruleId の記録（payload）を足す。 */
export function addTurnRecord(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, payload: Record<string, unknown> = {}): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload }],
  }));
}

/** playerId のこのターンの ruleId の記録の payload。 */
export function turnRecords(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): Array<Record<string, unknown>> {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => ((m as { payload?: unknown }).payload ?? {}) as Record<string, unknown>);
}

export function hasTurnRecordFor(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return turnRecords(state, playerId, ruleId).some((p) => p.instanceId === instanceId);
}

// ---------------------------------------------------------------------------
// カードの判定

export function defOf(state: Pick<GameState, "definitions">, cardId: string) {
  return getDefinition(state.definitions, cardId);
}

export function isCard(cardId: string, id: string): boolean {
  return isSameCardIdentity(cardId, id);
}

export function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return defOf(state, cardId)?.features ?? [];
}

export function isSUnitCard(state: Pick<GameState, "definitions">, card: Pick<CardInstance, "cardId">): boolean {
  return defOf(state, card.cardId)?.type === "unit" && unitSizeOf(state.definitions, card) === "S";
}

/** 場（ラッシュ・バトル）に cardId のカードが何枚あるか。 */
export function fieldCopies(state: Pick<GameState, "players">, playerId: PlayerId, cardId: string): number {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].filter((c) => isSameCardIdentity(c.cardId, cardId)).length;
}

/**
 * 場のユニットをゲームから除外する（ライドしているビークルはそのまま場に残り、下に重ねたカードは捨札）。
 * 離場の通知（emitUnitLeftZone）を通す。
 */
export function exileFieldUnit(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!zone || !found) return state;
  const moved = patchPlayer(state, ownerId, (p) => {
    const strip = (cards: CardInstance[]) =>
      cards.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    return {
      ...p,
      [zone]: strip(p[zone]),
      exile: [...(p.exile ?? []), stripForZone(found)],
      discard: [...p.discard, ...(found.stackedCards ?? []).map(stripForZone)],
    };
  });
  const left = emitUnitLeftZoneAndResolve(moved, {
    ownerPlayerId: ownerId,
    instanceId,
    cardId: found.cardId,
    fromZone: zone,
    toZone: "exile",
    phasePlayerId,
    destroyed: false,
  });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

/** 場のユニット（両軍）。 */
export function allFieldUnits(state: Pick<GameState, "players" | "definitions">): Array<{ owner: PlayerId; card: CardInstance }> {
  return (["player1", "player2"] as const).flatMap((owner) => fieldUnits(state, owner).map((card) => ({ owner, card })));
}
