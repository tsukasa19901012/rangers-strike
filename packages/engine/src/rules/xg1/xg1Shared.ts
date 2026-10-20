/**
 * XG1 のカード固有の効果で共通に使う小さな部品（コマンドのホールド・候補の絞り込み）。
 * 選択の組み立て（openAfter・proceed 等）は rules/rm/rm1Effects.ts のものを使う。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, effectiveCommandCategories, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { type BaseCtx, base, close, fieldUnits, logFor, moveFieldUnit, selectableEnemy, zoneOfField } from "../rm/rm1Effects";
import { rm1CostNumber } from "../rm/rm1Fields";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { rk12TurnPayloads } from "../rk/rk12Fields";
import { XG1_HOLD_COMPLETERS, XG1_RESOLVERS } from "./xg1Core";

export function holdCommands(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (ids.includes(c.instanceId) && !c.commandHeld ? { ...c, commandHeld: true } : c)) }));
}

/** カテゴリ cat を持つ（cat を省略すればすべての）リリース状態の自軍コマンド。 */
export function releasedCommands(state: GameState, playerId: PlayerId, cat?: string): string[] {
  const p = state.players[playerId];
  return p.command
    .filter((c) => !c.commandHeld && (!cat || (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes(cat)))
    .map((c) => c.instanceId);
}

/**
 * ホールドするコマンドを選ぶ選択を開く（候補が n 以下なら選ばずにホールドして続ける）。コマンドは1つずつ選ぶ（resolve_effect_choice）。
 * 続きは registerHold で登録したもの。
 */
export function holdThen(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], n: number, extra: Partial<PendingEffectChoice> = {}): GameState {
  const choice: PendingEffectChoice = {
    ...base(ctx, sourceCardId),
    effectId,
    kind: "select_commands",
    validInstanceIds: ids,
    selectCount: n,
    selectedInstanceIds: [],
    optional: false,
    ...extra,
  };
  if (ids.length <= n) return XG1_HOLD_COMPLETERS[effectId]!(holdCommands(state, ctx.playerId, ids), choice, ids);
  return openEffectChoice(state, choice);
}

/** ホールドするコマンドを選ぶ選択（holdThen）の続きを登録する。 */
export function registerHold(effectId: string, completer: (state: GameState, pending: PendingEffectChoice, holdIds: string[]) => GameState): void {
  XG1_HOLD_COMPLETERS[effectId] = completer;
  XG1_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const log = logFor(state, playerId, pending.sourceCardId, `${effectId}:hold:${instanceId}`);
    if (selected.length >= (pending.selectCount ?? 1)) {
      const held = holdCommands(close(state, pending), playerId, selected);
      return { state: completer(held, pending, selected), log };
    }
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)) } }, log };
  };
}

export function isUnitDef(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

export function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

export function printedCategories(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const d = getDefinition(state.definitions, cardId);
  return d ? (cardCategories(d) as string[]) : [];
}

/** 場のユニットのいまのカテゴリ。 */
export function unitCatsNow(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  const zone = zoneOfField(state, ownerId, card.instanceId) ?? "rush";
  return unitEffectiveCategories(state, ownerId, card, zone) as string[];
}

/** 敵軍の効果で選べる、エリアを問わない敵軍の S ユニット（pred で絞る）。 */
export function enemySUnits(state: GameState, playerId: PlayerId, sourceCardId: string, pred: (c: CardInstance) => boolean = () => true): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, sourceCardId, c) && pred(c))
    .map((c) => c.instanceId);
}

/** 必要パワーの数字（「+」「-」を除く）。数字でなければ NaN。 */
export const costNumber = rm1CostNumber;

export function isSCard(state: Pick<GameState, "definitions">, card: CardInstance): boolean {
  return unitSizeOf(state.definitions, card) === "S";
}

/** コマンドゾーンに置ける（5枚未満）か。 */
export function commandHasRoom(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].command.length < COMMAND_ZONE_MAX;
}

/** 場のユニットを持ち主のコマンドゾーンにリリース状態で置く（置けなければ捨札。撃破ではない）。 */
export function fieldUnitToCommandReleased(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const room = state.players[ownerId].command.length < COMMAND_ZONE_MAX;
  const next = moveFieldUnit(state, ownerId, instanceId, phasePlayerId, room ? "command_held" : "discard");
  if (!room) return next;
  return patchPlayer(next, ownerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)) }));
}

/** 常駐置き場のカード（置かれた常駐と、常駐に重ねたカード。ウラ向きのものも）。parent は重ねた先の常駐。 */
export function residentZoneCards(state: GameState, ownerId: PlayerId): Array<{ card: CardInstance; parent?: string }> {
  const out: Array<{ card: CardInstance; parent?: string }> = [];
  for (const op of state.players[ownerId].operation) {
    out.push({ card: op });
    for (const s of op.stackedCards ?? []) out.push({ card: s, parent: op.instanceId });
  }
  return out;
}

/**
 * XG1-081 磁雷神【パコの守護神】「これが自軍エリアにある間、自軍常駐置き場にあるカードは相手に選ばれない。」（atwiki/page-1587）。
 * ownerId の常駐置き場のカードが相手に選ばれないか。
 */
export function residentsGuarded(state: GameState, ownerId: PlayerId): boolean {
  return fieldUnits(state, ownerId).some((c) => isSameCardIdentity(c.cardId, "XG1-081"));
}

/** このターンの記録（kind "rule"・scope "turn"、payload に instanceId）を付ける。 */
export function addTurnMark(state: GameState, playerId: PlayerId, ruleId: string, sourceCardId: string, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId, scope: "turn", sourceCardId, payload: { instanceId } }] }));
}

/** このターン、instanceId に ruleId の記録があるか。 */
export function hasTurnMark(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return rk12TurnPayloads<{ instanceId?: string }>(state, playerId, ruleId).some((p) => p.instanceId === instanceId);
}
