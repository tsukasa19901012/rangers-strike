/**
 * クロスギャザー XG5 の各バッチで使う小さな部品（rules/rm/rm1Effects.ts の共通の部品の上に足したもの）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { sameCardName } from "../../core/cardNames";
import { base, type BaseCtx, fieldUnits, stripForZone, zoneOfField } from "../rm/rm1Effects";
import { patchPlayer } from "../playerPatches";
import type { Xg5Flag, Xg5State, Xg5Watch } from "./xg5Types";

export function opp(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

/** 進行中の処理（選択・反応・支払い等）があるか。 */
export function xg5Busy(state: GameState): boolean {
  return !!(
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRideOffChoice ||
    state.pendingRegister ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingDamagePayment ||
    state.pendingScry ||
    state.pendingEffectRush ||
    (state.deferredDestroyTriggers?.length ?? 0) > 0
  );
}

export function patchXg5(state: GameState, f: (x: Xg5State) => Xg5State): GameState {
  return { ...state, xg5: f(state.xg5 ?? {}) };
}

export function addFlag(state: GameState, flag: Xg5Flag): GameState {
  return patchXg5(state, (x) => ({ ...x, flags: [...(x.flags ?? []), flag] }));
}

export function addWatch(state: GameState, watch: Xg5Watch): GameState {
  return patchXg5(state, (x) => ({ ...x, watches: [...(x.watches ?? []), watch] }));
}

export function selectOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional };
}

export function defOf(state: Pick<GameState, "definitions">, cardId: string) {
  return getDefinition(state.definitions, cardId);
}

export function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return defOf(state, cardId)?.features ?? [];
}

export function isNamed(state: Pick<GameState, "definitions">, cardId: string, name: string): boolean {
  return sameCardName(defOf(state, cardId)?.name, name);
}

export function printedCategories(state: Pick<GameState, "definitions">, cardId: string): string[] {
  const d = defOf(state, cardId);
  return d ? (cardCategories(d) as string[]) : [];
}

/** 場のユニットのいまのカテゴリ。 */
export function fieldCategories(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  const zone = zoneOfField(state, ownerId, card.instanceId) ?? "rush";
  return unitEffectiveCategories(state, ownerId, card, zone) as string[];
}

export function sizeOf(state: Pick<GameState, "definitions">, card: CardInstance): string | undefined {
  return unitSizeOf(state.definitions, card);
}

/** before になく after で owner のバトルエリアにあるユニット。 */
export function newBattleUnits(before: GameState, after: GameState, ownerId: PlayerId): CardInstance[] {
  const had = new Set(before.players[ownerId].battle.map((c) => c.instanceId));
  return after.players[ownerId].battle.filter((c) => !had.has(c.instanceId) && defOf(after, c.cardId)?.type === "unit");
}

export function fieldUnitCount(state: GameState, ownerId: PlayerId): number {
  return fieldUnits(state, ownerId).length;
}

/**
 * 山札・捨札・手札のカードを持ち主のコマンドゾーンにホールド状態で置く（空きは呼び出し側で確かめる）。
 * 選んだカードがもうそのゾーンにないときは何もしない。選択の途中に割り込んだ効果がそのカードを動かすことがある
 * （XG5-008 で山札の L ユニットを選ぶ前に、RM-017【オメデトロフィー】がそのカードをコマンドゾーンに置いた。自己対戦 seed 1 game 4907）。
 */
export function cmdHeldPut(state: GameState, ownerId: PlayerId, card: CardInstance | undefined, from: "deck" | "discard" | "hand"): GameState {
  if (!card || !state.players[ownerId][from].some((c) => c.instanceId === card.instanceId)) return state;
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    [from]: p[from].filter((c) => c.instanceId !== card.instanceId),
    command: [...p.command, { ...stripForZone(card), commandHeld: true }],
  }));
}

/** 場のユニットの BP を増減する（このターン。bpModifier はターン終了時に消える）。 */
export function addBp(state: GameState, ownerId: PlayerId, instanceId: string, amount: number): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const f = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + amount } : c));
    return { ...p, rush: f(p.rush), battle: f(p.battle) };
  });
}

/** 場のユニットのホールド状態を変える（その場で）。 */
export function setFieldHeld(state: GameState, ownerId: PlayerId, instanceId: string, held: boolean): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const f = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: held, paymentHeld: held ? c.paymentHeld : undefined } : c));
    return { ...p, rush: f(p.rush), battle: f(p.battle), command: f(p.command) };
  });
}
