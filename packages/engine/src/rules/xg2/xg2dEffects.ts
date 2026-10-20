/**
 * クロスギャザー XG2-062〜XG2-081（仮面ライダー装甲響鬼〜デンオウモモタロス）のカード固有の効果（cardSpec XG2-062-081 の監査）。
 * 登録は rules/xg2/xg2Core.ts。継続効果の判定（XG2-065 のアタックされない・XG2-067 の SP・XG2-068 の「可能なら出る」・XG2-074 のライドなしの進入・
 * XG2-080 の BP）は rules/xg2/xg2Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { markFieldEntryHandled } from "../../events/emitUnitRushed";
import { buildLogEntry } from "../../log/formatLog";
import { openEffectChoice } from "../pendingChoices";
import { finalizeLeaveReaction, tryLeaveField } from "../operationCounters";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { moveToExile } from "../exile";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  type BaseCtx,
  base,
  close,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  printedBp,
  proceed,
  selectableEnemy,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { XG2_DECADE_NAMES } from "./xg2Fields";
import {
  costNumber,
  metaOf,
  ownTurn,
  registerXg2Choice,
  registerXg2Keyword,
  simpleSkipXg2,
  xg2Hook,
} from "./xg2Core";

// ---------------------------------------------------------------------------
// 共通

function selectOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function defOf(state: GameState, cardId: string) {
  return getDefinition(state.definitions, cardId);
}

function isUnit(state: GameState, cardId: string): boolean {
  return defOf(state, cardId)?.type === "unit";
}

function sortedIds(cards: CardInstance[]): string[] {
  return cards.map((c) => c.instanceId).sort();
}

function sourceCard(state: GameState, ctx: GrantKeywordContext): CardInstance | undefined {
  return ctx.triggerSourceInstanceId ? findField(state, ctx.playerId, ctx.triggerSourceInstanceId) : undefined;
}

function setFieldHeld(state: GameState, playerId: PlayerId, id: string, held: boolean): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === id ? { ...c, commandHeld: held } : c));
    return { ...p, rush: set(p.rush), battle: set(p.battle) };
  });
}

function xg2List<T>(state: GameState, key: string): T[] {
  return (state.xg2?.[key] as T[] | undefined) ?? [];
}

function withXg2List<T>(state: GameState, key: string, entries: T[]): GameState {
  const rest = { ...(state.xg2 ?? {}) };
  if (entries.length > 0) rest[key] = entries;
  else delete rest[key];
  return { ...state, xg2: Object.keys(rest).length > 0 ? rest : undefined };
}

type TurnEntry = { ownerId: PlayerId; instanceId: string; turn: number };

function addTurnEntry(state: GameState, key: string, ownerId: PlayerId, instanceId: string): GameState {
  return withXg2List(state, key, [...xg2List<TurnEntry>(state, key).filter((e) => e.turn === state.turn), { ownerId, instanceId, turn: state.turn }]);
}

/** 敵軍の場のユニットで、効果で選べるもの。 */
function enemyUnits(state: GameState, playerId: PlayerId, sourceCardId: string, filter: (c: CardInstance) => boolean, area?: "battle" | "rush"): CardInstance[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId).filter((c) => {
    if (area && zoneOfField(state, enemyId, c.instanceId) !== area) return false;
    return selectableEnemy(state, playerId, sourceCardId, c) && filter(c);
  });
}

function isDecadeName(state: GameState, cardId: string): boolean {
  return XG2_DECADE_NAMES.includes(cardName(state.definitions, cardId));
}

/** 撃破されて捨札になったカードを、持ち主のパワーゾーンにダメージ（ウラ向き）として置き直す。 */
function discardToDamage(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), power: [...p.power, { ...stripForZone(card), faceDown: true }], damage: p.damage + 1 };
  });
}

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

// ---------------------------------------------------------------------------
// XG2-062 仮面ライダー装甲響鬼【鬼神覚声】「自軍ターン中、これがバトルエリアに出たとき、これをホールドするかリリースしてもよい。そうしたとき、
// 必要パワーの数字が4以下の敵軍ユニットを１体選び、持ち主のパワーゾーンへダメージにして置く。」（atwiki/page-1855）。
// リリース状態で出たらホールドし、ホールド状態で出たらリリースする。対象はエリア・サイズを問わない。

const KISHIN_EFFECT_ID = "xg2_062_kishin_kakusei";

function applyKishin(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_062:not_own_turn" };
  if (!sourceCard(state, ctx)) return { state, detail: "xg2_062:no_source" };
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-062", (c) => costNumber(state, c.cardId) <= 4));
  if (ids.length === 0) return { state, detail: "xg2_062:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-062", KISHIN_EFFECT_ID, ids, true)), detail: KISHIN_EFFECT_ID };
}

registerXg2Choice(KISHIN_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const self = pending.sourceInstanceId ? findField(next, playerId, pending.sourceInstanceId) : undefined;
    if (self) next = setFieldHeld(next, playerId, self.instanceId, !self.commandHeld);
    next = moveFieldUnit(next, opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-062", `${KISHIN_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-063 仮面ライダー響鬼【鬼幻術・鬼火】「これが自軍エリアにある間、自軍バトルフェイズ中、敵軍ユニットがラッシュされたとき、これをホールドしてもよい。
// そうしたとき、ラッシュされたユニットを持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1770）。リリース状態の響鬼から1体選ぶ。

const ONIBI_EFFECT_ID = "xg2_063_onibi";

xg2Hook("unitRushed", (state, rusherPlayerId, rushedInstanceId, phasePlayerId) => {
  const ownerId = opponent(rusherPlayerId);
  if (state.activePlayer !== ownerId || state.phase !== "battle") return state;
  const rushed = findField(state, rusherPlayerId, rushedInstanceId);
  if (!rushed || !isUnit(state, rushed.cardId)) return state;
  const ids = sortedIds(fieldUnits(state, ownerId).filter((c) => isSameCardIdentity(c.cardId, "XG2-063") && !c.commandHeld));
  if (ids.length === 0) return state;
  return openAfter(
    state,
    selectOne({ playerId: ownerId, phasePlayerId, sourceInstanceId: ids[0] }, "XG2-063", ONIBI_EFFECT_ID, ids, true, { xg2Meta: { target: rushedInstanceId, targetOwner: rusherPlayerId } }),
  );
});

registerXg2Choice(ONIBI_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const meta = metaOf<{ target: string; targetOwner: PlayerId }>(pending);
    let next = setFieldHeld(close(state, pending), playerId, instanceId, true);
    if (findField(next, meta.targetOwner, meta.target)) next = moveFieldUnit(next, meta.targetOwner, meta.target, pending.phasePlayerId, "power_damage");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-063", `${ONIBI_EFFECT_ID}:${meta.target}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-067 仮面ライダー電王GF【邪魔するなら撃つよ】「これがバトルエリアに出たとき、BP3000のユニットを1体選び撃破する。」（atwiki/page-1772）。
// 自軍・敵軍、エリアを問わない。強制。ターンの限定はない（モーフで出たときも）。※ の SP1 は rules/xg2/xg2Fields.ts。

const JAMA_EFFECT_ID = "xg2_067_jama_suru_nara";

function applyJama(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const own = fieldUnits(state, ctx.playerId).filter((c) => effectiveBp(state, ctx.playerId, c) === 3000);
  const enemy = enemyUnits(state, ctx.playerId, "XG2-067", (c) => effectiveBp(state, opponent(ctx.playerId), c) === 3000);
  const ids = sortedIds([...own, ...enemy]);
  if (ids.length === 0) return { state, detail: "xg2_067:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-067", JAMA_EFFECT_ID, ids, false)), detail: JAMA_EFFECT_ID };
}

// モーフの置き換えでバトルエリアに出たときも「バトルエリアに出た」（R-REPL-04）。DSL の enter_battle はモーフの置き換えでは発火しないので、
// 置き換えの選択を解決したアクションのあとに発動する（コメント欄「効果はターンを問わないならモーフで出たときに使ってもいい」）。
xg2Hook("afterAction", (before, after) => {
  if (before.pendingEffectChoice?.effectId !== "morph_replacement") return after;
  let next = after;
  for (const playerId of ["player1", "player2"] as const) {
    const wasInBattle = new Set(before.players[playerId].battle.map((c) => c.instanceId));
    for (const card of after.players[playerId].battle) {
      if (wasInBattle.has(card.instanceId) || !isSameCardIdentity(card.cardId, "XG2-067")) continue;
      next = applyJama(next, { playerId, phasePlayerId: next.activePlayer, sourceCardId: "XG2-067", effectId: `${JAMA_EFFECT_ID}:morph`, triggerSourceInstanceId: card.instanceId }).state;
    }
  }
  return next;
});

registerXg2Choice(JAMA_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-067", `${JAMA_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-067", `${JAMA_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-068 リュウタロス【憑依】「自軍ラッシュフェイズ中、ライドしていない自軍Sユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられて
// いる間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒これが自軍バトルエリアにある間、
// すべての敵軍Sユニットは、可能ならバトルエリアに出る。」（atwiki/page-1773）。起動（rules/fieldActivatedAbilities.ts）。選んだユニットは今の場所のまま、
// 下にオモテ向きでこれを重ねる。与える能力は rules/xg2/xg2Fields.ts xg2RequiresBattleEntry。

const HYOUI_EFFECT_ID = "xg2_068_hyoui";

function hyouiHosts(state: GameState, playerId: PlayerId, self: CardInstance): string[] {
  return sortedIds(fieldUnits(state, playerId).filter((c) => c.instanceId !== self.instanceId && !c.mountedOnInstanceId && rk1IsSmallNow(state, c)));
}

/** 自軍ラッシュフェイズの場の起動効果（rules/fieldActivatedAbilities.ts）。カードごとに登録する（XG2-068【憑依】・XG2-082 のホールド／リリース）。 */
type Xg2FieldAbility = {
  canActivate: (state: GameState, playerId: PlayerId, card: CardInstance) => boolean;
  activate: (state: GameState, playerId: PlayerId, card: CardInstance) => GameState;
};
const FIELD_ABILITIES: Record<string, Xg2FieldAbility> = {};

export function registerXg2FieldAbility(cardId: string, ability: Xg2FieldAbility): void {
  FIELD_ABILITIES[cardId] = ability;
}

function fieldAbilityOf(cardId: string): Xg2FieldAbility | undefined {
  const id = Object.keys(FIELD_ABILITIES).find((k) => isSameCardIdentity(cardId, k));
  return id ? FIELD_ABILITIES[id] : undefined;
}

export function isXg2FieldAbilityCard(cardId: string): boolean {
  return fieldAbilityOf(cardId) !== undefined;
}

export function canActivateXg2FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const ability = fieldAbilityOf(card.cardId);
  if (!ability || state.phase !== "rush" || state.activePlayer !== playerId) return false;
  return ability.canActivate(state, playerId, card);
}

export function activateXg2FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return fieldAbilityOf(card.cardId)?.activate(state, playerId, card) ?? state;
}

registerXg2FieldAbility("XG2-068", {
  canActivate: (state, playerId, card) => {
    if (card.mountedOnInstanceId) return false;
    if (!state.players[playerId].rush.some((c) => c.instanceId === card.instanceId)) return false;
    return hyouiHosts(state, playerId, card).length > 0;
  },
  activate: (state, playerId, card) => {
    const ids = hyouiHosts(state, playerId, card);
    if (ids.length === 0) return state;
    return openEffectChoice(state, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG2-068", HYOUI_EFFECT_ID, ids, true));
  },
});

registerXg2Choice(HYOUI_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selfId = pending.sourceInstanceId!;
    let next = close(state, pending);
    const self = next.players[playerId].rush.find((c) => c.instanceId === selfId);
    if (self) {
      next = patchPlayer(next, playerId, (p) => {
        const stack = (cards: CardInstance[]) =>
          cards.filter((c) => c.instanceId !== selfId).map((c) => (c.instanceId === instanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { ...stripForZone(self), faceDown: false }] } : c));
        return { ...p, rush: stack(p.rush), battle: stack(p.battle) };
      });
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-068", `${HYOUI_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// 重ねたユニットがユニットでなくなるとき、下のリュウタロスは捨札になる（離場の処理でどのゾーンにも置かれなかったとき）。
xg2Hook("afterUnitLeft", (state, left) => {
  const ryu = (left.card.stackedCards ?? []).filter((c) => !c.faceDown && isSameCardIdentity(c.cardId, "XG2-068"));
  if (ryu.length === 0 || findField(state, left.ownerPlayerId, left.card.instanceId)) return state;
  const p = state.players[left.ownerPlayerId];
  const placed = new Set([...p.discard, ...p.power, ...p.hand, ...p.command, ...p.deck, ...p.rush, ...p.battle, ...(p.exile ?? [])].map((c) => c.instanceId));
  const lost = ryu.filter((c) => !placed.has(c.instanceId));
  if (lost.length === 0) return state;
  return patchPlayer(state, left.ownerPlayerId, (q) => ({ ...q, discard: [...q.discard, ...lost.map(stripForZone)] }));
});

// ---------------------------------------------------------------------------
// XG2-070 ライドブッカー・ブックモード（※常駐）「これを配置するとき、自軍山札からモーフを持つユニットカードを3枚まで選び、相手に見せてからこれに重ねて
// 置いた後、山札をシャッフルする。これが自軍常駐置き場にある間、モーフの効果で自軍コマンドゾーンか自軍パワーゾーンのオモテ向きのカードからユニットカードを
// 選ぶとき、かわりにこれに重ねたカードから選んでもよい。…」（atwiki/page-1774）。重ねたカードとモーフすると、モーフしたユニットは同じ位置に重なる（Q1・Q2）。

const BOOK_EFFECT_ID = "xg2_070_book_search";
const BOOK_MAX = 3;

function bookSearchIds(state: GameState, playerId: PlayerId): string[] {
  return sortedIds(state.players[playerId].deck.filter((c) => isUnit(state, c.cardId) && cardHasKeyword(state.definitions, c.cardId, "morph", { state, playerId })));
}

function finishBook(state: GameState, pending: PendingEffectChoice): GameState {
  const shuffled = patchPlayer(state, pending.playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return proceed(close(shuffled, pending), pending);
}

xg2Hook("residentPlaced", (state, ownerId, opInstanceId, cardId) => {
  if (!isSameCardIdentity(cardId, "XG2-070")) return null;
  const ids = bookSearchIds(state, ownerId);
  if (ids.length === 0) return patchPlayer(state, ownerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return openAfter(state, selectOne({ playerId: ownerId, phasePlayerId: state.activePlayer, sourceInstanceId: opInstanceId }, "XG2-070", BOOK_EFFECT_ID, ids, true));
});

registerXg2Choice(BOOK_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
    if (!card) return { error: "invalid_target" };
    const opId = pending.sourceInstanceId;
    const placed = patchPlayer(state, playerId, (p) => ({
      ...p,
      deck: p.deck.filter((c) => c.instanceId !== instanceId),
      operation: p.operation.map((c) => (c.instanceId === opId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { ...stripForZone(card), faceDown: false }] } : c)),
    }));
    const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
    const log = logFor(state, playerId, "XG2-070", `${BOOK_EFFECT_ID}:${card.cardId}`);
    const rest = bookSearchIds(placed, playerId);
    if (picked.length >= BOOK_MAX || rest.length === 0) return { state: finishBook({ ...placed, pendingEffectChoice: pending }, pending), log };
    return { state: { ...placed, pendingEffectChoice: { ...pending, validInstanceIds: rest, selectedInstanceIds: picked } }, log };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finishBook(state, pending), log: logFor(state, playerId, "XG2-070", `${BOOK_EFFECT_ID}:done`) };
  },
});

function featuresExactlyMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((f, i) => f === b[i]);
}

/** モーフの置き換え先に加える、自軍常駐置き場の XG2-070 に重ねたカード（keywords/morph.ts listPlaceableMorphReplacementCandidates）。 */
export function xg2MorphStackCandidates(state: GameState, playerId: PlayerId, morphUnitCardId: string): Array<{ zone: "command"; instanceId: string; card: CardInstance }> {
  const morphFeatures = defOf(state, morphUnitCardId)?.features ?? [];
  if (morphFeatures.length === 0) return [];
  const out: Array<{ zone: "command"; instanceId: string; card: CardInstance }> = [];
  for (const op of state.players[playerId].operation) {
    if (!isSameCardIdentity(op.cardId, "XG2-070")) continue;
    for (const c of op.stackedCards ?? []) {
      if (c.faceDown || !isUnit(state, c.cardId)) continue;
      if (featuresExactlyMatch(defOf(state, c.cardId)?.features ?? [], morphFeatures)) out.push({ zone: "command", instanceId: c.instanceId, card: c });
    }
  }
  return out;
}

/**
 * XG2-070 に重ねたカードとモーフする（keywords/morphReaction.ts applyMorphSwap で、置き換え先がゾーンにないとき）。
 * 重ねたカードがモーフ持ちユニットの位置に出て、モーフ持ちユニットは重ねたカードと同じ位置に重なる（Q1・Q2）。対象外なら null。
 */
export function xg2MorphSwapFromStack(state: GameState, defenderId: PlayerId, morphUnitInstanceId: string, replacementInstanceId: string): { state: GameState; log: string } | null {
  const player = state.players[defenderId];
  const zone = zoneOfField(state, defenderId, morphUnitInstanceId);
  const morph = zone ? player[zone].find((c) => c.instanceId === morphUnitInstanceId) : undefined;
  if (!zone || !morph) return null;
  if (!xg2MorphStackCandidates(state, defenderId, morph.cardId).some((c) => c.instanceId === replacementInstanceId)) return null;
  const op = player.operation.find((c) => (c.stackedCards ?? []).some((s) => s.instanceId === replacementInstanceId));
  const replacement = op?.stackedCards?.find((s) => s.instanceId === replacementInstanceId);
  if (!op || !replacement) return null;
  const entering: CardInstance = {
    ...stripForZone(replacement),
    commandHeld: morph.commandHeld,
    mothershipHold: morph.mothershipHold,
    registerHeld: morph.registerHeld,
    mountedOnInstanceId: morph.mountedOnInstanceId,
    bpModifier: morph.bpModifier,
    spModifier: morph.spModifier,
    spOverride: morph.spOverride,
    battleActed: morph.battleActed,
  };
  let next = patchPlayer(state, defenderId, (p) => ({
    ...p,
    [zone]: p[zone].map((c) => (c.instanceId === morphUnitInstanceId ? entering : c)),
    operation: p.operation.map((c) =>
      c.instanceId === op.instanceId ? { ...c, stackedCards: (c.stackedCards ?? []).map((s) => (s.instanceId === replacementInstanceId ? stripForZone(morph) : s)) } : c,
    ),
  }));
  const swapEntry = <T extends { instanceId: string } | undefined>(entry: T): T =>
    entry && entry.instanceId === morphUnitInstanceId ? ({ ...entry, instanceId: replacementInstanceId } as T) : entry;
  next = { ...next, pendingBattleEntry: swapEntry(next.pendingBattleEntry), deferredBattleEntry: swapEntry(next.deferredBattleEntry) };
  return {
    state: markFieldEntryHandled(next, [replacementInstanceId]),
    log: buildLogEntry(defenderId, "morph_swap", morph.cardId, state.definitions, replacement.cardId),
  };
}

// ---------------------------------------------------------------------------
// XG2-071 仮面ライダーディエンド【ディメンションシュート】「自軍ターン中、これがバトルエリアに出たとき、これ以外の特徴「仮面ライダー」を持つ自軍ユニットを
// 2体選び、パワーゾーンに送ってもよい。そうしたとき、本来のBPが8000以下の敵軍ユニットを1体選び撃破する。」（atwiki/page-1819）。
// 送るユニットの場所は問わない。2体選べないなら発動しない。撃破の対象はエリア・サイズを問わない。

const DIMENSION_EFFECT_ID = "xg2_071_dimension_shoot";
const DIMENSION_DESTROY_EFFECT_ID = "xg2_071_destroy";

function dimensionRiders(state: GameState, playerId: PlayerId, selfId: string, picked: string[]): string[] {
  return sortedIds(fieldUnits(state, playerId).filter((c) => c.instanceId !== selfId && !picked.includes(c.instanceId) && unitFeatures(state, playerId, c).includes("仮面ライダー")));
}

function applyDimension(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_071:not_own_turn" };
  const self = sourceCard(state, ctx);
  if (!self) return { state, detail: "xg2_071:no_source" };
  const ids = dimensionRiders(state, ctx.playerId, self.instanceId, []);
  if (ids.length < 2) return { state, detail: "xg2_071:no_riders" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-071", DIMENSION_EFFECT_ID, ids, true, { xg2Meta: { picked: [] } })), detail: DIMENSION_EFFECT_ID };
}

registerXg2Choice(DIMENSION_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const picked = [...(metaOf<{ picked: string[] }>(pending).picked ?? []), instanceId];
    const log = logFor(state, playerId, "XG2-071", `${DIMENSION_EFFECT_ID}:${instanceId}`);
    if (picked.length < 2) {
      const rest = dimensionRiders(state, playerId, pending.sourceInstanceId ?? "", picked);
      if (rest.length === 0) return { state: proceed(close(state, pending), pending), log };
      return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: rest, xg2Meta: { picked } } }, log };
    }
    let next = close(state, pending);
    for (const id of picked) next = moveFieldUnit(next, playerId, id, pending.phasePlayerId, "power");
    const enemyId = opponent(playerId);
    const ids = sortedIds(enemyUnits(next, playerId, "XG2-071", (c) => printedBp(next, c.cardId) <= 8000));
    void enemyId;
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG2-071", DIMENSION_DESTROY_EFFECT_ID, ids, false)), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(DIMENSION_DESTROY_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-071", `${DIMENSION_DESTROY_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-071", `${DIMENSION_DESTROY_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-072 トライゴウラム【トライゴウラムアタック】「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからSユニットを1体選び、持ち主の
// コマンドゾーンにホールド状態で置く。置けなければ、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1810）。強制。

const TRIGOURAM_EFFECT_ID = "xg2_072_trigouram_attack";

function applyTrigouram(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_072:not_own_turn" };
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-072", (c) => rk1IsSmallNow(state, c), "battle"));
  if (ids.length === 0) return { state, detail: "xg2_072:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-072", TRIGOURAM_EFFECT_ID, ids, false)), detail: TRIGOURAM_EFFECT_ID };
}

registerXg2Choice(TRIGOURAM_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    let next = close(state, pending);
    const full = next.players[enemyId].command.length >= COMMAND_ZONE_MAX;
    next = moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, full ? "power_damage" : "command_held");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-072", `${TRIGOURAM_EFFECT_ID}:${full ? "damage" : "command"}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-073 仮面ライダークウガ【笑顔の為に】（RC）「自軍ラッシュエリアから特徴「警察」を持つSユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、
// このターン、これとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1743）。

const SMILE_EFFECT_ID = "xg2_073_egao_no_tame";
const XG2_SMILE_KEY = "smile";

function applySmile(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = sortedIds(state.players[ctx.playerId].rush.filter((c) => isUnit(state, c.cardId) && rk1IsSmallNow(state, c) && unitFeatures(state, ctx.playerId, c).includes("警察")));
  if (ids.length === 0) return { state, detail: "xg2_073:no_targets" };
  // 同じカードの XP-009（cards reprints.ts）も同じ処理。選択の出どころは発動したカードにする。
  return { state: openAfter(state, selectOne(ctxBase(ctx), ctx.sourceCardId || "XG2-073", SMILE_EFFECT_ID, ids, true)), detail: SMILE_EFFECT_ID };
}

registerXg2Choice(SMILE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "hand");
    if (pending.sourceInstanceId) next = addTurnEntry(next, XG2_SMILE_KEY, playerId, pending.sourceInstanceId);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId || "XG2-073", `${SMILE_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

xg2Hook("unitLeftZone", (state, event) => {
  if (event.destroyed === false || event.toZone !== "discard" || !event.battleOpponentInstanceId) return state;
  const entries = xg2List<TurnEntry>(state, XG2_SMILE_KEY);
  if (!entries.some((e) => e.instanceId === event.battleOpponentInstanceId && e.ownerId !== event.ownerPlayerId && e.turn === state.turn)) return state;
  return discardToDamage(state, event.ownerPlayerId, event.instanceId);
});

// ---------------------------------------------------------------------------
// XG2-074 クウガゴウラム【ファイナルアタックライド 】「自軍ターン中、これがバトルエリアに出たとき、BP4000以上の敵軍Sユニットを1体選び撃破してもよい。」
// （atwiki/page-1775）。※2つ目（ライドなしの進入）は rules/xg2/xg2Fields.ts。

const GOURAM_EFFECT_ID = "xg2_074_final_attack_ride";

function applyGouram(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_074:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-074", (c) => rk1IsSmallNow(state, c) && effectiveBp(state, enemyId, c) >= 4000));
  if (ids.length === 0) return { state, detail: "xg2_074:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-074", GOURAM_EFFECT_ID, ids, true)), detail: GOURAM_EFFECT_ID };
}

registerXg2Choice(GOURAM_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-074", `${GOURAM_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-074", `${GOURAM_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ライドしたユニットと一緒にビークル（XG2-072・XG2-074）がバトルエリアに出たとき、ビークルの「これがバトルエリアに出たとき」を発動する
// （DSL の enter_battle はバトルエリアに出たユニット＝ライドした側にだけ発火するため。RK-024 等と同じ扱い。rules/rk/rk2UnitEffects.ts tryRk2OnEnterBattle）。
// ライドオフの選択があるときは、その選択のあと（ライドオフしたときも、これはバトルエリアに出ている。カード評価「RCを発動しても乗せっぱなしでも強い」）。
const MOUNTED_VEHICLE_ENTER: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "XG2-072": applyTrigouram,
  "XG2-074": applyGouram,
};

export function registerXg2MountedVehicleEnter(cardId: string, apply: (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult): void {
  MOUNTED_VEHICLE_ENTER[cardId] = apply;
}

function mountedVehicleCardId(cardId: string): string | undefined {
  return Object.keys(MOUNTED_VEHICLE_ENTER).find((id) => isSameCardIdentity(cardId, id));
}

function fireMountedVehicleEnter(state: GameState, playerId: PlayerId, vehicleInstanceId: string): GameState {
  const vehicle = state.players[playerId].battle.find((c) => c.instanceId === vehicleInstanceId);
  const vehicleCardId = vehicle ? mountedVehicleCardId(vehicle.cardId) : undefined;
  if (!vehicle || !vehicleCardId) return state;
  const ctx: GrantKeywordContext = { playerId, phasePlayerId: state.activePlayer, sourceCardId: vehicleCardId, effectId: `${vehicleCardId}:mounted_enter`, triggerSourceInstanceId: vehicle.instanceId };
  return MOUNTED_VEHICLE_ENTER[vehicleCardId]!(state, ctx).state;
}

xg2Hook("afterAction", (before, after) => {
  if (after.pendingRideOffChoice) return after;
  const resolved = before.pendingRideOffChoice;
  if (resolved) return fireMountedVehicleEnter(after, resolved.playerId, resolved.vehicleInstanceId);
  let next = after;
  for (const playerId of ["player1", "player2"] as const) {
    const wasInBattle = new Set(before.players[playerId].battle.map((c) => c.instanceId));
    for (const rider of after.players[playerId].battle) {
      if (!rider.mountedOnInstanceId || wasInBattle.has(rider.instanceId) || wasInBattle.has(rider.mountedOnInstanceId)) continue;
      next = fireMountedVehicleEnter(next, playerId, rider.mountedOnInstanceId);
    }
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG2-075 仮面ライダーブレイド【ブレイドブレード】・XG2-076 仮面ライダーキバ【キバアロー】・XG2-078 仮面ライダーファイズ【ファイズブラスター】
// 「自軍バトルフェイズ中、このユニットからSユニットがコンビネーションするとき、これをホールドして次の効果を発動できる⇒…（コンビネーションしたSユニットが
// 「仮面ライダーディケイド」または「仮面ライダーディエンド」なら、…）」（atwiki/page-1776・page-982・page-1777）。
// これがバトルエリアの最後にあり、次に S ユニットがバトルエリアに出たとき。これ自身をホールドする支払い（effect_hold。xg2Meta.selfHold）か、選択で発動する。

const FFR_HOLD_EFFECT_ID = "xg2_ffr_hold";
const BLADE_EFFECT_ID = "xg2_075_blade_blade";
const KIBA_EFFECT_ID = "xg2_076_kiba_arrow";
const BLASTER_EFFECT_ID = "xg2_078_faiz_blaster";
const FFR_CARDS = ["XG2-075", "XG2-076", "XG2-078"];

xg2Hook("comboEnter", (state, playerId, card, battleBeforeEnter) => {
  if (state.phase !== "battle" || !ownTurn(state, playerId)) return state;
  const ffr = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!ffr || ffr.commandHeld) return state;
  const ffrCardId = FFR_CARDS.find((id) => isSameCardIdentity(ffr.cardId, id));
  if (!ffrCardId || !isUnit(state, card.cardId) || !rk1IsSmallNow(state, card)) return state;
  if (!findField(state, playerId, ffr.instanceId)) return state;
  return openAfter(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: ffr.instanceId }, ffrCardId),
    effectId: FFR_HOLD_EFFECT_ID,
    kind: "select_command",
    commandAction: "hold",
    validInstanceIds: [ffr.instanceId],
    selectCount: 1,
    optional: true,
    xg2Meta: { selfHold: true, decade: isDecadeName(state, card.cardId) },
  });
});

registerXg2Choice(FFR_HOLD_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const decade = metaOf<{ decade: boolean }>(pending).decade === true;
    const next = setFieldHeld(close(state, pending), playerId, instanceId, true);
    const ctx = pendingBase(pending);
    const enemyId = opponent(playerId);
    const log = logFor(state, playerId, pending.sourceCardId, `${FFR_HOLD_EFFECT_ID}:hold`);
    let step: PendingEffectChoice | null = null;
    if (pending.sourceCardId === "XG2-075") {
      const ids = sortedIds(enemyUnits(next, playerId, "XG2-075", (c) => rk1IsSmallNow(next, c), "battle"));
      if (ids.length > 0) step = selectOne(ctx, "XG2-075", BLADE_EFFECT_ID, ids, false, { xg2Meta: { decade } });
    } else if (pending.sourceCardId === "XG2-076") {
      const ids = sortedIds(fieldUnits(next, enemyId).filter((c) => rk1IsSmallNow(next, c)));
      if (ids.length > 0) step = selectOne({ ...ctx, playerId: enemyId }, "XG2-076", KIBA_EFFECT_ID, ids, false, { xg2Meta: { decade } });
    } else {
      const ids = sortedIds(enemyUnits(next, playerId, "XG2-078", (c) => effectiveBp(next, enemyId, c) % 1000 === 500, decade ? undefined : "battle"));
      if (ids.length > 0) step = selectOne(ctx, "XG2-078", BLASTER_EFFECT_ID, ids, false);
    }
    return { state: step ? openNext(next, pending, step) : proceed(next, pending), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(BLADE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    let next = close(state, pending);
    const zone = zoneOfField(next, enemyId, instanceId);
    if (metaOf<{ decade: boolean }>(pending).decade && zone) next = moveToExile(next, enemyId, zone, instanceId);
    else next = destroyAll(next, pendingBase(pending), "XG2-075", `${BLADE_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-075", `${BLADE_EFFECT_ID}:${instanceId}`) };
  },
});

registerXg2Choice(KIBA_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const to = metaOf<{ decade: boolean }>(pending).decade ? "power_damage" : "discard";
    const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, to);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-076", `${KIBA_EFFECT_ID}:${to}`) };
  },
});

registerXg2Choice(BLASTER_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-078", `${BLASTER_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-078", `${BLASTER_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-079 仮面ライダー龍騎【タイムベント】「敵軍ターン中、これが自軍エリアにある間、これ以外の自軍Sユニットがバトルで撃破されたとき、捨札にするかわりに
// 手札から1枚選びゲームから除外してよい。そうしたとき、撃破されたユニットはその場に留まる。」（atwiki/page-1541）。

const TIMEVENT_EFFECT_ID = "xg2_079_time_vent";

xg2Hook("leaveStay", (state, intent) => {
  if (intent.toZone !== "discard" || !intent.battleOpponentInstanceId || intent.xg2Declined?.includes(TIMEVENT_EFFECT_ID)) return null;
  if (state.pendingEffectChoice || state.activePlayer === intent.ownerPlayerId) return null;
  const owner = intent.ownerPlayerId;
  const unit = state.players[owner][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || !isUnit(state, unit.cardId) || !rk1IsSmallNow(state, unit)) return null;
  const ryuki = fieldUnits(state, owner).find((c) => c.instanceId !== unit.instanceId && isSameCardIdentity(c.cardId, "XG2-079"));
  if (!ryuki) return null;
  const ids = sortedIds(state.players[owner].hand);
  if (ids.length === 0) return null;
  return openEffectChoice(
    state,
    selectOne({ playerId: owner, phasePlayerId: intent.phasePlayerId, sourceInstanceId: ryuki.instanceId }, "XG2-079", TIMEVENT_EFFECT_ID, ids, true, { kind: "select_hand", xg2Meta: { leave: intent } }),
  );
});

function settleLeave(next: GameState): GameState {
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
}

registerXg2Choice(TIMEVENT_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const intent = metaOf<{ leave: PendingLeave }>(pending).leave;
    let next = moveToExile(close(state, pending), playerId, "hand", instanceId);
    next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
    const follow = intent.followUpAttackerLeave;
    if (follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) next = tryLeaveField(next, { ...follow }).state;
    return { state: settleLeave(next), log: logFor(state, playerId, "XG2-079", `${TIMEVENT_EFFECT_ID}:stay`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const intent = metaOf<{ leave: PendingLeave }>(pending).leave;
    const leave = tryLeaveField(close(state, pending), { ...intent, xg2Declined: [...(intent.xg2Declined ?? []), TIMEVENT_EFFECT_ID] });
    let next = leave.state;
    const follow = intent.followUpAttackerLeave;
    if (!leave.deferred && follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) next = tryLeaveField(next, { ...follow }).state;
    return { state: settleLeave(next), log: logFor(state, playerId, "XG2-079", `${TIMEVENT_EFFECT_ID}:skipped`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-081 デンオウモモタロス【俺の必殺技・ディケイドバージョン】「自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアからホールド状態のSユニットを
// 1体選んでもよい。そうしたとき、選んだユニットをパワーゾーンに送ってから、そのユニットのBP以下のBPを持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに
// 送る。」（atwiki/page-1779）。比べる BP はラッシュエリアにあったときの BP。送ったユニットはオモテ向き。

const MOMO_EFFECT_ID = "xg2_081_ore_no_hissatsu";
const MOMO_SEND_EFFECT_ID = "xg2_081_send";

function applyMomo(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_081:not_own_turn" };
  const ids = sortedIds(state.players[ctx.playerId].rush.filter((c) => c.commandHeld && isUnit(state, c.cardId) && rk1IsSmallNow(state, c)));
  if (ids.length === 0) return { state, detail: "xg2_081:no_held" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-081", MOMO_EFFECT_ID, ids, true)), detail: MOMO_EFFECT_ID };
}

registerXg2Choice(MOMO_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const unit = findField(state, playerId, instanceId);
    const bp = unit ? effectiveBp(state, playerId, unit) : Number.NaN;
    const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "power");
    const enemyId = opponent(playerId);
    const ids = sortedIds(enemyUnits(next, playerId, "XG2-081", (c) => effectiveBp(next, enemyId, c) <= bp));
    const log = logFor(state, playerId, "XG2-081", `${MOMO_EFFECT_ID}:${instanceId}`);
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG2-081", MOMO_SEND_EFFECT_ID, ids, false)), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(MOMO_SEND_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-081", `${MOMO_SEND_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// キーワード（DSL スタブの grant_keyword `xg2::cardId::name`）

registerXg2Keyword("XG2-062::kishin_kakusei", applyKishin);
registerXg2Keyword("XG2-063::onibi", noop("xg2_063:on_rushed"));
registerXg2Keyword("XG2-065::hyper_clock_up", noop("xg2_065:continuous"));
registerXg2Keyword("XG2-067::ryutaros_sp", noop("xg2_067:continuous"));
registerXg2Keyword("XG2-067::jama_suru_nara", applyJama);
registerXg2Keyword("XG2-068::hyoui", noop("xg2_068:activated"));
registerXg2Keyword("XG2-071::dimension_shoot", applyDimension);
registerXg2Keyword("XG2-072::trigouram_attack", applyTrigouram);
registerXg2Keyword("XG2-073::egao_no_tame", applySmile);
registerXg2Keyword("XG2-074::decade_enter", noop("xg2_074:continuous"));
registerXg2Keyword("XG2-074::final_attack_ride", applyGouram);
registerXg2Keyword("XG2-075::blade_blade", noop("xg2_075:on_combo"));
registerXg2Keyword("XG2-076::kiba_arrow", noop("xg2_076:on_combo"));
registerXg2Keyword("XG2-078::faiz_blaster", noop("xg2_078:on_combo"));
registerXg2Keyword("XG2-079::time_vent", noop("xg2_079:on_destroyed"));
registerXg2Keyword("XG2-080::final_attack_ride", noop("xg2_080:continuous"));
registerXg2Keyword("XG2-081::ore_no_hissatsu", applyMomo);
