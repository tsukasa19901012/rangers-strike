/**
 * クロスギャザー ザ・ベストパートナー XG7-047〜XG7-068（仮面ライダーオーズ・タカキリーター〜宇宙刑事シャリバン×ギャバン×シャイダー）のカード固有の効果
 * （cardSpec XG7-047-068 の監査）。
 * 選択・キーワードは rules/xg7/xg7Registry.ts に登録し、入口は rules/xg7/xg7Effects.ts。継続効果の判定は rules/xg7/xg7Fields.ts。
 * 選択の組み立ては rules/rm/rm1Effects.ts の部品と rules/xg7/xg7aEffects.ts・xg7bEffects.ts の共通部品を使う。
 */
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PendingStrike, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { listDslEffectsForTrigger } from "../../dsl/effectLookup";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { buildLogEntry } from "../../log/formatLog";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { markBattleBlocked } from "../turnModifiers";
import { recordReveal, revealedCards } from "../revealNotice";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { runRk10OnRush } from "../rk/rk10UnitEffects";
import {
  base,
  categoriesOf,
  close,
  ctxBase,
  fieldUnits,
  findField,
  isUnitCard,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  simpleSkip,
  skipLog,
  stripForZone,
  type BaseCtx,
} from "../rm/rm1Effects";
import { CHOICE_CONFIRMERS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG7_KEYWORDS, addFlag, costNumberOf, isCard, noop, printedFeatures } from "./xg7Registry";
import { boostBp, declineLeaveStay, leaveChoice, selectOne, selfUnit, stayed, xg7EffectBattle } from "./xg7aEffects";
import { areaCards, registerDestroyPick, setHeld, setSpOverride } from "./xg7bEffects";

// ---------------------------------------------------------------------------
// 共通

/** 「発動する／置き直す」の確認に使う疑似 ID（選ぶと実行、見送ると実行しない）。 */
const CONFIRM = "confirm";

function ownTurn(state: Pick<GameState, "activePlayer">, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

function isOperationCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "operation";
}

/** 捨札のカードをゲームから除外する。 */
function exileFromDiscard(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  if (ids.length === 0) return state;
  return patchPlayer(state, playerId, (p) => {
    const moved = p.discard.filter((c) => ids.includes(c.instanceId));
    return { ...p, discard: p.discard.filter((c) => !ids.includes(c.instanceId)), exile: [...(p.exile ?? []), ...moved.map(stripForZone)] };
  });
}

/** 自軍コマンドを捨札にする。 */
function discardCommand(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
}

/** 山札の上から1枚ひいて、コマンドゾーンに置く（held ならホールド状態）。山札がなければ何もしない。 */
function topDeckToCommand(state: GameState, playerId: PlayerId, held: (cardId: string) => boolean): GameState {
  return patchPlayer(state, playerId, (p) => {
    const top = p.deck[0];
    if (!top || p.command.length >= COMMAND_ZONE_MAX) return p;
    return { ...p, deck: p.deck.slice(1), command: [...p.command, { ...stripForZone(top), commandHeld: held(top.cardId) }] };
  });
}

/**
 * 「好きな枚数選ぶ」「N枚選ぶ」の複数の選択。1つ選ぶたびに候補を作りなおし、上限に達するか候補がなくなれば finish する。
 * mayStop なら、1つ以上選んだ後に CONFIRM（疑似 ID）か confirm_effect_choice で選び終えられる。
 */
function registerPicks(
  effectId: string,
  candidates: (state: GameState, pending: PendingEffectChoice, selected: string[]) => string[],
  finish: (state: GameState, pending: PendingEffectChoice, selected: string[]) => GameState,
  mayStop: boolean,
): void {
  const done = (state: GameState, playerId: PlayerId, selected: string[]) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending, selected), log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${selected.length}`) };
  };
  CHOICE_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const before = pending.selectedInstanceIds ?? [];
    if (instanceId === CONFIRM) return done(state, playerId, before);
    const selected = [...before, instanceId];
    const limit = pending.xg7Meta?.limit ?? 1;
    const rest = candidates(state, pending, selected);
    if (selected.length >= limit || rest.length === 0) return done(state, playerId, selected);
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: mayStop ? [...rest, CONFIRM] : rest, mayConfirm: mayStop, optional: mayStop || pending.optional },
      },
    };
  };
  if (mayStop) CHOICE_CONFIRMERS[effectId] = (state, playerId) => done(state, playerId, state.pendingEffectChoice!.selectedInstanceIds ?? []);
  CHOICE_SKIPPERS[effectId] = (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const selected = pending.selectedInstanceIds ?? [];
    if (selected.length > 0) return done(state, playerId, selected);
    return simpleSkip()(state, playerId);
  };
}

/** 確認（CONFIRM）の選択。 */
function confirmOne(ctx: BaseCtx, cardId: string, effectId: string, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return selectOne(ctx, cardId, effectId, [CONFIRM], true, extra);
}

// ---------------------------------------------------------------------------
// 「手札からラッシュしたとき」（効果でラッシュエリアに出たときは発動しない）。
// rules/onRushUnitEffects.ts が「ラッシュしたとき」の DSL を処理する間、効果で出たユニットの instanceId を GameState.xg7.rushViaEffect に置く。

export function markXg7cRushOrigin(state: GameState, instanceId: string, viaEffect: boolean): GameState {
  const current = state.xg7?.rushViaEffect;
  const next = viaEffect ? instanceId : undefined;
  if (current === next) return state;
  return { ...state, xg7: { ...state.xg7, rushViaEffect: next } };
}

function rushedFromHand(state: GameState, instanceId: string): boolean {
  return state.xg7?.rushViaEffect !== instanceId;
}

// ---------------------------------------------------------------------------
// XG7-049 仮面ライダーオーズ・ガタキリバコンボ【分身体】
// 「これを手札からラッシュしたとき、自軍山札の上から2枚をオモテにして、その中から「仮面ライダーオーズ・ガタキリバコンボ」のカードをすべて
//  自軍ラッシュエリアに出し、それ以外は捨札にする。」出すのは効果のラッシュ（必要パワー・追加条件は問わない）。

const SPLIT_EFFECT_ID = "xg7049_split";
const GATAKIRIBA = "仮面ライダーオーズ・ガタキリバコンボ";

function applySplit(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId || !findField(state, ctx.playerId, selfId)) return { state, detail: "xg7049:no_self" };
  if (!rushedFromHand(state, selfId)) return { state, detail: "xg7049:not_from_hand" };
  const playerId = ctx.playerId;
  const top = state.players[playerId].deck.slice(0, 2);
  if (top.length === 0) return { state, detail: "xg7049:empty_deck" };
  const hits = top.filter((c) => sameCardName(cardName(state.definitions, c.cardId), GATAKIRIBA)).map((c) => c.instanceId);
  const rest = top.filter((c) => !hits.includes(c.instanceId));
  let next = recordReveal(state, {
    playerId,
    ownerId: playerId,
    sourceCardId: "XG7-049",
    effectLabel: "分身体",
    from: "deck_top",
    cards: revealedCards(top, (c) => (hits.includes(c.instanceId) ? "rush" : "discard")),
  });
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    deck: p.deck.filter((c) => !rest.some((r) => r.instanceId === c.instanceId)),
    discard: [...p.discard, ...rest.map(stripForZone)],
  }));
  if (hits.length > 0) {
    next = startEffectRush(next, {
      playerId,
      phasePlayerId: ctx.phasePlayerId,
      effectId: SPLIT_EFFECT_ID,
      sourceCardId: "XG7-049",
      sourceInstanceId: selfId,
      fromZone: "deck",
      candidates: hits,
      maxCount: hits.length,
      requireConditions: false,
      mandatory: true,
      forced: true,
    });
  }
  return { state: { ...next, log: [...next.log, buildLogEntry(playerId, "named_effect", "XG7-049", next.definitions, `${SPLIT_EFFECT_ID}:${hits.length}`)] }, detail: SPLIT_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// XG7-051 仮面ライダーオーズ・ラトラーターコンボ【ライオディアス】
// 「これをラッシュしたとき、自軍捨札を好きな枚数選びゲームから除外してもよい。そうしたとき、選んだ枚数と同じ数だけ相手は自分自身の捨札を選び
//  ゲームから除外する。」相手の捨札が足りなければ、あるだけ除外する。

const LION_EFFECT_ID = "xg7051_lion";
const LION_ENEMY_EFFECT_ID = "xg7051_lion_enemy";

function applyLion(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7051:no_discard" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-051", LION_EFFECT_ID, ids, true, { xg7Meta: { limit: ids.length } })), detail: LION_EFFECT_ID };
}

registerPicks(
  LION_EFFECT_ID,
  (state, pending, selected) => state.players[pending.playerId].discard.map((c) => c.instanceId).filter((id) => !selected.includes(id)),
  (state, pending, selected) => {
    const playerId = pending.playerId;
    const enemyId = opponent(playerId);
    let next = exileFromDiscard(close(state, pending), playerId, selected);
    const enemyIds = next.players[enemyId].discard.map((c) => c.instanceId);
    if (selected.length === 0 || enemyIds.length === 0) return proceed(next, pending);
    if (enemyIds.length <= selected.length) return proceed(exileFromDiscard(next, enemyId, enemyIds), pending);
    next = openNext(next, pending, {
      ...base({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG7-051"),
      effectId: LION_ENEMY_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: enemyIds,
      selectCount: 1,
      optional: false,
      xg7Meta: { limit: selected.length, owner: playerId },
    });
    return next;
  },
  true,
);

registerPicks(
  LION_ENEMY_EFFECT_ID,
  (state, pending, selected) => state.players[pending.playerId].discard.map((c) => c.instanceId).filter((id) => !selected.includes(id)),
  (state, pending, selected) => proceed(exileFromDiscard(close(state, pending), pending.playerId, selected), pending),
  false,
);

// ---------------------------------------------------------------------------
// XG7-052 仮面ライダーオーズ・タジャドルコンボ【タジャスピナー】
// 「これが自軍エリアにある間、WBを持つ自軍コマンドが3つ以上あれば、自軍バトルフェイズごとに1度だけ、敵軍Sユニットを1体選び、これとバトルさせてもよい。
//  （敵軍捨札が7枚以上あれば、敵軍Sユニットを1体選ぶかわりに、敵軍ユニットを1体選んでもよい）」
// 起動（rules/fieldActivatedAbilities.ts のバトルフェイズの能力）。バトルはアタックではない（effectBattle）。

const TAJA_EFFECT_ID = "xg7052_taja_spinner";

function tajaTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  const anySize = state.players[enemyId].discard.length >= 7;
  return fieldUnits(state, enemyId)
    .filter((c) => (anySize || rk1IsSmallNow(state, c)) && selectableEnemy(state, playerId, "XG7-052", c))
    .map((c) => c.instanceId);
}

function canActivateTaja(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!isCard(card.cardId, "XG7-052") || state.phase !== "battle" || !ownTurn(state, playerId)) return false;
  const wb = state.players[playerId].command.filter((c) => categoriesOf(state, c.cardId).includes("WB")).length;
  return wb >= 3 && tajaTargets(state, playerId).length > 0;
}

function activateTaja(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return openEffectChoice(state, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG7-052", TAJA_EFFECT_ID, tajaTargets(state, playerId), true));
}

CHOICE_RESOLVERS[TAJA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const next = close(state, pending);
  const enemyId = opponent(playerId);
  if (!selfId || !findField(next, playerId, selfId) || !findField(next, enemyId, instanceId)) return { state: proceed(next, pending) };
  return { state: xg7EffectBattle(next, pending, playerId, selfId, enemyId, instanceId), log: logFor(state, playerId, "XG7-052", `${TAJA_EFFECT_ID}:battle`) };
};
CHOICE_SKIPPERS[TAJA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-053 仮面ライダーオーズ・シャウタコンボ【水中からの強襲】
// 「自軍ターン中、これをラッシュしたとき、自軍捨札からナンバーにRCを持つカードを1枚選び、ゲームから除外してもよい。そうしたとき、そのカードのRCの効果を、
//  このユニットの効果として発動する。」そのカードの DSL の riding_combo の効果を、これを発動元として処理する。

const ASSAULT_EFFECT_ID = "xg7053_assault";

function applyAssault(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg7053:enemy_turn" };
  if (!selfUnit(state, ctx)) return { state, detail: "xg7053:no_self" };
  const ids = state.players[ctx.playerId].discard.filter((c) => getDefinition(state.definitions, c.cardId)?.comboNumber === "RC").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7053:no_rc" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-053", ASSAULT_EFFECT_ID, ids, true)), detail: ASSAULT_EFFECT_ID };
}

CHOICE_RESOLVERS[ASSAULT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  const selfId = pending.sourceInstanceId;
  let next = exileFromDiscard(close(state, pending), playerId, [instanceId]);
  if (card && selfId && findField(next, playerId, selfId)) {
    const fx = tryResolveDslTriggeredEffects({ state: next, cardId: card.cardId, instanceId: selfId, playerId, phasePlayerId: pending.phasePlayerId, triggerType: "riding_combo" });
    next = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-053", `${ASSAULT_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : "-"}`) };
};
CHOICE_SKIPPERS[ASSAULT_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-054 オーズドライバー
// 「次の効果から1つ選び発動する⇒◎自分の手札から本来の特徴に「オーズドライバー」を持つカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。
//  ◎このターン、次に自分が手札から使用するカードの必要パワーの数字は、3少なくなる。」
// ◎1 は効果のラッシュ（必要パワーは問わず、追加条件は満たす）。◎2 はこのターンの記録（rules/xg7/xg7Fields.ts xg7NextCardCostReduction。手札から
// ラッシュ・オペレーションを使ったときに消える）。

const OOO_EFFECT_ID = "xg7054_ooo_driver";
const OOO_MODE_RUSH = "mode1_rush";
const OOO_MODE_COST = "mode2_cost";
export const OOO_COST_FLAG = "xg7054_cost_minus3";

function applyOooDriver(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-054", OOO_EFFECT_ID, [OOO_MODE_RUSH, OOO_MODE_COST], false)), detail: OOO_EFFECT_ID };
}

CHOICE_RESOLVERS[OOO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (instanceId === OOO_MODE_COST) {
    next = addFlag(next, { key: OOO_COST_FLAG, playerId });
  } else {
    const ids = next.players[playerId].hand
      .filter((c) => getDefinition(next.definitions, c.cardId)?.type === "unit" && printedFeatures(next, c.cardId).includes("オーズドライバー"))
      .map((c) => c.instanceId);
    next = startEffectRush(next, {
      playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: `${OOO_EFFECT_ID}_rush`,
      sourceCardId: "XG7-054",
      sourceInstanceId: pending.sourceInstanceId,
      fromZone: "hand",
      candidates: ids,
      maxCount: 1,
      requireConditions: true,
      ignorePowerCost: true,
      alwaysAsk: true,
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-054", `${OOO_EFFECT_ID}:${instanceId}`) };
};

/** 手札からカードを使った（ラッシュ・オペレーション）。◎2 の記録を消す（rules/onRushUnitEffects.ts・core/applyAction.ts）。 */
export function consumeXg7cNextCardCost(state: GameState, playerId: PlayerId): GameState {
  const flags = state.xg7?.flags ?? [];
  if (!flags.some((f) => f.key === OOO_COST_FLAG && f.playerId === playerId)) return state;
  return { ...state, xg7: { ...state.xg7, flags: flags.filter((f) => !(f.key === OOO_COST_FLAG && f.playerId === playerId)) } };
}

// ---------------------------------------------------------------------------
// XG7-055 サイクロン・ドーパント【神出鬼没の疾風】
// 「これが自軍コマンドゾーンにある間、敵軍ターン中、自軍Sユニットがアタックされたとき、アタックされたユニットとこれを置き換えてもよい。そうしたとき、
//  アタックされたユニットのかわりにこのユニットがバトルする。」
// 置き換え（R-REPL-04）: これはアタックされたユニットのいた位置・状態でバトルエリアに出て、アタックされたユニットはこれのいた状態でコマンドゾーンに置かれる。
// アタックの「アタックされたとき」（カウンター窓の前。RM-062 テントリーナと同じ場所。core/applyAction.ts）に開く。

const CYCLONE_EFFECT_ID = "xg7055_cyclone_gale";

export function openXg7cOnAttacked(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.xg7AttackedOffered || battle.battleCancelled || battle.effectBattle) return null;
  const defenderId = battle.defenderPlayerId;
  if (battle.phasePlayerId === defenderId) return null;
  const defender = state.players[defenderId].battle.find((c) => c.instanceId === battle.defenderInstanceId);
  if (!defender || !isUnitCard(state, defender.cardId) || !rk1IsSmallNow(state, defender)) return null;
  const ids = state.players[defenderId].command.filter((c) => isCard(c.cardId, "XG7-055")).map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return {
    ...openEffectChoice(state, {
      ...selectOne({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: ids[0] }, "XG7-055", CYCLONE_EFFECT_ID, ids, true),
      xg7Meta: { battle: { ...battle, xg7AttackedOffered: true }, wingAttackFromRush },
    }),
    activePlayer: defenderId,
  };
}

export function isXg7cAttackedChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === CYCLONE_EFFECT_ID && !!pending.xg7Meta?.battle;
}

type AttackContinuation = { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean };

export function resolveXg7cAttacked(state: GameState, playerId: PlayerId, instanceId: string): AttackContinuation | { error: string } {
  const pending = state.pendingEffectChoice;
  const battle = pending?.xg7Meta?.battle;
  if (!pending || !isXg7cAttackedChoice(pending) || !battle || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const wing = !!pending.xg7Meta?.wingAttackFromRush;
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: battle.phasePlayerId };
  const p = next.players[playerId];
  const self = p.command.find((c) => c.instanceId === instanceId);
  const index = p.battle.findIndex((c) => c.instanceId === battle.defenderInstanceId);
  const attacked = p.battle[index];
  if (!self || !attacked) return { state: next, battle, wingAttackFromRush: wing };
  const entered: CardInstance = { ...stripForZone(self), commandHeld: attacked.commandHeld, mountedOnInstanceId: attacked.mountedOnInstanceId };
  next = patchPlayer(next, playerId, (pl) => ({
    ...pl,
    battle: pl.battle.map((c) => (c.instanceId === attacked.instanceId ? entered : c)),
    command: pl.command.map((c) => (c.instanceId === instanceId ? { ...stripForZone(attacked), commandHeld: !!self.commandHeld } : c)),
    discard: [...pl.discard, ...(attacked.stackedCards ?? []).map(stripForZone)],
  }));
  next = { ...next, log: [...next.log, logFor(state, playerId, "XG7-055", `${CYCLONE_EFFECT_ID}:swap`)] };
  return { state: next, battle: { ...battle, defenderInstanceId: instanceId }, wingAttackFromRush: wing };
}

export function skipXg7cAttacked(state: GameState, playerId: PlayerId): AttackContinuation | null {
  const pending = state.pendingEffectChoice;
  const battle = pending?.xg7Meta?.battle;
  if (!pending || !isXg7cAttackedChoice(pending) || !battle || pending.playerId !== playerId) return null;
  return {
    state: { ...state, pendingEffectChoice: undefined, activePlayer: battle.phasePlayerId, log: [...state.log, skipLog(state, playerId, "XG7-055", CYCLONE_EFFECT_ID)] },
    battle,
    wingAttackFromRush: !!pending.xg7Meta?.wingAttackFromRush,
  };
}

// legalActions に候補を出すために登録する（解決は core/applyAction.ts の resolveXg7Attacked・skipXg7Attacked）。
CHOICE_RESOLVERS[CYCLONE_EFFECT_ID] = () => ({ error: "xg7055_handled_by_attack" });
CHOICE_SKIPPERS[CYCLONE_EFFECT_ID] = () => ({ error: "xg7055_handled_by_attack" });

// ---------------------------------------------------------------------------
// XG7-056 ルナ・ドーパント【嫌いじゃないわ！】
// 「これが自分の手札にある間、特徴「男」を持つ敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい。そうしたとき、そのターン、
//  そのユニットはバトルエリアに出られない。」（ユニットがラッシュされたとき。rules/onRushUnitEffects.ts applyPassiveRushTriggers から呼ぶ）

const LUNA_EFFECT_ID = "xg7056_luna";

export function openXg7cOnUnitRushed(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  const rushed = findField(state, rusherPlayerId, rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId) || !rk1IsSmallNow(state, rushed)) return state;
  if (!unitFeatures(state, rusherPlayerId, rushed).includes("男")) return state;
  const holder = opponent(rusherPlayerId);
  let next = state;
  for (const card of next.players[holder].hand.filter((c) => isCard(c.cardId, "XG7-056"))) {
    next = openAfter(
      next,
      selectOne({ playerId: holder, phasePlayerId, sourceInstanceId: card.instanceId }, "XG7-056", LUNA_EFFECT_ID, [card.instanceId], true, {
        kind: "select_hand",
        xg7Meta: { target: rushedInstanceId, owner: rusherPlayerId },
      }),
    );
  }
  return next;
}

CHOICE_RESOLVERS[LUNA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!card) return { state: proceed(next, pending) };
  next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] }));
  const ownerId = pending.xg7Meta?.owner ?? opponent(playerId);
  const target = pending.xg7Meta?.target;
  if (target && findField(next, ownerId, target)) next = patchPlayer(next, ownerId, (p) => markBattleBlocked(p, target));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-056", `${LUNA_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[LUNA_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-057 ヒート・ドーパント【冷たいファイヤーガール】
// 「「SP1/2」 これがアタックしたとき、相手は自分自身の捨札を1枚選び、ゲームから除外する。」
// RC で SP1/2（このターン）。アタックしたときの除外は RC と別に、アタックするたびに発動する（XG7-judgments）。

const FIRE_GIRL_EFFECT_ID = "xg7057_fire_girl";

function applyFireGirlSp(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = selfUnit(state, ctx);
  if (!self) return { state, detail: "xg7057:no_self" };
  return { state: setSpOverride(state, ctx.playerId, self.instanceId, "1/2"), detail: "xg7057:sp_1_2" };
}

function applyFireGirlExile(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7057:no_discard" };
  if (ids.length === 1) return { state: exileFromDiscard(state, enemyId, ids), detail: `${FIRE_GIRL_EFFECT_ID}:auto` };
  const choice = selectOne({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG7-057", FIRE_GIRL_EFFECT_ID, ids, false, {
    xg7Meta: { owner: ctx.playerId },
  });
  return { state: openAfter(state, choice), detail: FIRE_GIRL_EFFECT_ID };
}

CHOICE_RESOLVERS[FIRE_GIRL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(exileFromDiscard(close(state, pending), playerId, [instanceId]), pending), log: logFor(state, playerId, "XG7-057", `${FIRE_GIRL_EFFECT_ID}:exile`) };
};

// ---------------------------------------------------------------------------
// XG7-058 メタル・ドーパント【鋼鉄のマッチョボディ】
// 「これがユニットでなくなるとき、これをホールドしてその場に留めてもよい。また、これはホールド状態なら、アタックするときBP+2000される。」
// 離場の置換（rules/operationCounters.ts tryLeaveField → openXg7LeaveStay）。リリース状態のときだけホールドできる。BP は rules/xg7/xg7Fields.ts。

const MUSCLE_EFFECT_ID = "xg7058_macho_body";

export function openXg7cLeaveStay(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.resumePendingStrike || state.pendingEffectChoice) return null;
  if ((intent.xg7Declined ?? []).includes(MUSCLE_EFFECT_ID)) return null;
  if (intent.fromZone !== "battle" && intent.fromZone !== "rush") return null;
  const unit = state.players[intent.ownerPlayerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || !isCard(unit.cardId, "XG7-058") || unit.commandHeld) return null;
  return openEffectChoice(state, leaveChoice(intent, "XG7-058", MUSCLE_EFFECT_ID, intent.instanceId, [intent.instanceId]));
}

CHOICE_RESOLVERS[MUSCLE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.xg7Meta?.intent;
  if (!intent) return { error: "invalid_choice" };
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  next = setHeld(next, playerId, intent.instanceId, true);
  return { state: stayed(next, intent), log: logFor(state, playerId, "XG7-058", `${MUSCLE_EFFECT_ID}:stay`) };
};
CHOICE_SKIPPERS[MUSCLE_EFFECT_ID] = declineLeaveStay(MUSCLE_EFFECT_ID, "XG7-058");

// ---------------------------------------------------------------------------
// XG7-059 トリガー・ドーパント【ゲームスタート……】
// 「これが自軍パワーゾーンでオモテ向きになっている間、効果に「ラッシュしたとき」とある敵軍ユニットがその効果を発動するとき、それを実行する前に、
//  これを自軍ラッシュエリアに出してもよい。そうしたとき、その効果は無効になる。」
// 手札からラッシュされた敵軍ユニットの強制の「ラッシュしたとき」を実行する前に開く（RK-208 クレインの窓と同じ場所。rules/onRushUnitEffects.ts）。
// 見送れば、その効果をそのまま実行する（runRk10OnRush）。任意の効果（相手が発動を宣言するもの）は対象外（XG7-judgments）。

const GAME_START_EFFECT_ID = "xg7059_game_start";

export function openXg7cBeforeOnRush(state: GameState, ownerId: PlayerId, instanceId: string, cardId: string, phasePlayerId: PlayerId): GameState | null {
  const holder = opponent(ownerId);
  const trigger = state.players[holder].power.find((c) => isCard(c.cardId, "XG7-059") && !c.faceDown);
  if (!trigger) return null;
  const effects = listDslEffectsForTrigger(cardId, "on_rush");
  if (!effects.some((e) => !e.optional)) return null;
  return openAfter(
    state,
    selectOne({ playerId: holder, phasePlayerId, sourceInstanceId: trigger.instanceId }, "XG7-059", GAME_START_EFFECT_ID, [trigger.instanceId], true, {
      xg7Meta: { owner: ownerId, target: instanceId },
    }),
  );
}

CHOICE_RESOLVERS[GAME_START_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = pending.xg7Meta?.owner ?? opponent(playerId);
  const target = pending.xg7Meta?.target;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] }));
  }
  // その効果は無効（そのユニット自身の「ラッシュしたとき」だけを止め、ほかのカードのラッシュの処理は続ける）。
  if (target && findField(next, ownerId, target)) next = runRk10OnRush(next, ownerId, target, pending.phasePlayerId, true);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-059", `${GAME_START_EFFECT_ID}:nullify`) };
};
CHOICE_SKIPPERS[GAME_START_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = pending.xg7Meta?.owner ?? opponent(playerId);
  const target = pending.xg7Meta?.target;
  let next = close(state, pending);
  if (target && findField(next, ownerId, target)) next = runRk10OnRush(next, ownerId, target, pending.phasePlayerId, false);
  return { state: proceed(next, pending), log: skipLog(state, playerId, "XG7-059", GAME_START_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// XG7-060 ドデカブタック【射手座のスターピース】・XG7-061 トンデモジョーズ【蠍座のスターピース】
// 060「これをラッシュしたとき、自軍パワーゾーンからウラ向きのカードを1枚選び、捨札にしてもよい。そうしたとき、捨札にしたカードがオペレーションカードなら、
//      自軍パワーゾーンにオモテ向きで置き直してもよい。」
// 061「これをラッシュしたとき、敵軍パワーゾーンからオモテ向きのカードを1枚選び、捨札にしてもよい。そうしたとき、捨札にしたカードがオペレーションカードなら、
//      敵軍パワーゾーンにダメージにして置き直してもよい。」
// ウラ向きのパワー＝ダメージなので、ウラ向きのカードを捨札にするとダメージの数が1減り、ダメージにして置き直すと1増える。

const SAGITTARIUS_EFFECT_ID = "xg7060_sagittarius";
const SAGITTARIUS_BACK_EFFECT_ID = "xg7060_sagittarius_back";
const SCORPIO_EFFECT_ID = "xg7061_scorpio";
const SCORPIO_BACK_EFFECT_ID = "xg7061_scorpio_back";

function applySagittarius(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7060:no_face_down" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-060", SAGITTARIUS_EFFECT_ID, ids, true)), detail: SAGITTARIUS_EFFECT_ID };
}

function applyScorpio(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[opponent(ctx.playerId)].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7061:no_face_up" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-061", SCORPIO_EFFECT_ID, ids, true)), detail: SCORPIO_EFFECT_ID };
}

/** パワーのカードを捨札にする（ウラ向きならダメージが1減る）。 */
function powerToDiscard(state: GameState, ownerId: PlayerId, instanceId: string): { state: GameState; card?: CardInstance } {
  const card = state.players[ownerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { state };
  const next = patchPlayer(state, ownerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, stripForZone(card)],
    damage: card.faceDown ? Math.max(0, p.damage - 1) : p.damage,
  }));
  return { state: next, card };
}

/** 捨札のカードをパワーゾーンに置き直す（faceDown ならダメージにする）。 */
function discardToPower(state: GameState, ownerId: PlayerId, instanceId: string, faceDown: boolean): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return {
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      power: [...p.power, { ...stripForZone(card), faceDown }],
      damage: faceDown ? p.damage + 1 : p.damage,
    };
  });
}

function registerStarPiece(cardId: string, pickId: string, backId: string, owner: (playerId: PlayerId) => PlayerId, backFaceDown: boolean): void {
  CHOICE_RESOLVERS[pickId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const ownerId = owner(playerId);
    const moved = powerToDiscard(close(state, pending), ownerId, instanceId);
    const log = logFor(state, playerId, cardId, `${pickId}:${moved.card ? cardName(state.definitions, moved.card.cardId) : "-"}`);
    if (!moved.card || !isOperationCard(state, moved.card.cardId)) return { state: proceed(moved.state, pending), log };
    return { state: openNext(moved.state, pending, confirmOne(pendingBase(pending), cardId, backId, { xg7Meta: { target: instanceId, owner: ownerId } })), log };
  };
  CHOICE_SKIPPERS[pickId] = simpleSkip();
  CHOICE_RESOLVERS[backId] = (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const target = pending.xg7Meta?.target;
    const ownerId = pending.xg7Meta?.owner ?? owner(playerId);
    let next = close(state, pending);
    if (target) next = discardToPower(next, ownerId, target, backFaceDown);
    return { state: proceed(next, pending), log: logFor(state, playerId, cardId, `${backId}:back`) };
  };
  CHOICE_SKIPPERS[backId] = simpleSkip();
}

registerStarPiece("XG7-060", SAGITTARIUS_EFFECT_ID, SAGITTARIUS_BACK_EFFECT_ID, (pid) => pid, false);
registerStarPiece("XG7-061", SCORPIO_EFFECT_ID, SCORPIO_BACK_EFFECT_ID, (pid) => opponent(pid), true);

// ---------------------------------------------------------------------------
// XG7-062 シャークラー【シャーブラシ】・XG7-066 ドラフトキース【ハイドランダー】
// 062「これをラッシュしたとき、ホールド状態の自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、自軍山札の上から1枚ひいて、そのカードが特徴「メカ」を
//      持つならリリース状態で、持たないならホールド状態で自軍コマンドゾーンに置く。」
// 066「自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにリリース状態で置く。」（NC）

const BRUSH_EFFECT_ID = "xg7062_shark_brush";
const HYDRA_EFFECT_ID = "xg7066_hydrander";

function applyBrush(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7062:no_held" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-062", BRUSH_EFFECT_ID, ids, true, { kind: "select_command" })), detail: BRUSH_EFFECT_ID };
}

function applyHydra(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7066:no_command" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-066", HYDRA_EFFECT_ID, ids, true, { kind: "select_command" })), detail: HYDRA_EFFECT_ID };
}

function registerCommandSwap(cardId: string, effectId: string, held: (state: GameState, cardId: string) => boolean): void {
  CHOICE_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = discardCommand(close(state, pending), playerId, instanceId);
    next = topDeckToCommand(next, playerId, (top) => held(next, top));
    return { state: proceed(next, pending), log: logFor(state, playerId, cardId, `${effectId}:swap`) };
  };
  CHOICE_SKIPPERS[effectId] = simpleSkip();
}

registerCommandSwap("XG7-062", BRUSH_EFFECT_ID, (state, top) => !printedFeatures(state, top).includes("メカ"));
registerCommandSwap("XG7-066", HYDRA_EFFECT_ID, () => false);

// ---------------------------------------------------------------------------
// XG7-063 シャークラーSM【コブンザメ】
// 「自軍ラッシュフェイズ中、このユニットをホールドしてもよい。そうしたとき、BP2000以下の敵軍ユニットを1体選び撃破する。」
// 起動（rules/fieldActivatedAbilities.ts のラッシュフェイズの能力）。リリース状態のときだけ。敵軍ユニットはエリアを問わない。

const KOBUN_EFFECT_ID = "xg7063_kobunzame";

function canActivateKobun(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return isCard(card.cardId, "XG7-063") && state.phase === "rush" && ownTurn(state, playerId) && !card.commandHeld;
}

function activateKobun(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const next = setHeld(state, playerId, card.instanceId, true);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => effectiveBp(next, enemyId, c) <= 2000 && selectableEnemy(next, playerId, "XG7-063", c))
    .map((c) => c.instanceId);
  const logged = { ...next, log: [...next.log, buildLogEntry(playerId, "named_effect", "XG7-063", next.definitions, `${KOBUN_EFFECT_ID}:hold`)] };
  if (ids.length === 0) return logged;
  return openEffectChoice(logged, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG7-063", KOBUN_EFFECT_ID, ids, false));
}

registerDestroyPick(KOBUN_EFFECT_ID);
delete CHOICE_SKIPPERS[KOBUN_EFFECT_ID];

// ---------------------------------------------------------------------------
// XG7-064 ドラフトレッダー【リボルバックG-3】（NC）
// 「特徴「警察」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。
//  置けなければ捨札にする。」自軍ユニットはエリアを問わず、これ自身も数える。

const REVOLVER_EFFECT_ID = "xg7064_revolver";

function applyRevolver(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const playerId = ctx.playerId;
  const police = fieldUnits(state, playerId).filter((c) => unitFeatures(state, playerId, c).includes("警察")).length;
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumberOf(state, c.cardId);
      return Number.isFinite(n) && n <= police && selectableEnemy(state, playerId, "XG7-064", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7064:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-064", REVOLVER_EFFECT_ID, ids, true)), detail: REVOLVER_EFFECT_ID };
}

CHOICE_RESOLVERS[REVOLVER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  if (findField(next, enemyId, instanceId)) next = moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-064", `${REVOLVER_EFFECT_ID}:command`) };
};
CHOICE_SKIPPERS[REVOLVER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-065 ドラフトブルース【トライキャノン】（NC）
// 「自軍ラッシュエリアから、特徴「メカ」を持つビークルを1体選んでもよい。そうしたとき、このターン、これは選んだビークルの必要パワーの数字1ごとにBP+1000される。」

const CANNON_EFFECT_ID = "xg7065_tri_cannon";

function applyCannon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!selfUnit(state, ctx)) return { state, detail: "xg7065:no_self" };
  const ids = state.players[ctx.playerId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "vehicle" && unitFeatures(state, ctx.playerId, c).includes("メカ"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7065:no_vehicle" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-065", CANNON_EFFECT_ID, ids, true)), detail: CANNON_EFFECT_ID };
}

CHOICE_RESOLVERS[CANNON_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const vehicle = findField(state, playerId, instanceId);
  const n = vehicle ? costNumberOf(state, vehicle.cardId) : 0;
  let next = close(state, pending);
  const selfId = pending.sourceInstanceId;
  if (selfId && Number.isFinite(n) && n > 0) next = boostBp(next, playerId, selfId, 1000 * n);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-065", `${CANNON_EFFECT_ID}:+${Number.isFinite(n) ? n * 1000 : 0}`) };
};
CHOICE_SKIPPERS[CANNON_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-067 シンクレッダー ※
// 「これがリリース状態で自軍コマンドゾーンにある間、相手にストライクされたとき、これを捨札にしてそのストライクを無効にしてもよい。」
// ストライクの宣言の直後（RS-196 ダイナモビル【迎撃モビルミサイル】と同じ場所。core/applyAction.ts）に開く。

const SINK_EFFECT_ID = "xg7067_sink_redder";

export function openXg7cOnStrike(state: GameState, strike: PendingStrike): GameState | null {
  const defenderId = opponent(strike.strikerPlayerId);
  const ids = state.players[defenderId].command.filter((c) => isCard(c.cardId, "XG7-067") && !c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return {
    ...state,
    pendingEffectChoice: {
      ...selectOne({ playerId: defenderId, phasePlayerId: strike.battlePhasePlayer, sourceInstanceId: ids[0] }, "XG7-067", SINK_EFFECT_ID, ids, true),
      xg7Meta: { strike },
    },
    activePlayer: defenderId,
  };
}

export function isXg7cStrikeChoice(pending: PendingEffectChoice | undefined): boolean {
  return pending?.effectId === SINK_EFFECT_ID && !!pending.xg7Meta?.strike;
}

/** 捨札にしてストライクを無効にした。続けるストライク（damageCancelled）を返す。 */
export function resolveXg7cStrike(state: GameState, playerId: PlayerId, instanceId: string): { state: GameState; strike: PendingStrike; log: string } | { error: string } {
  const pending = state.pendingEffectChoice;
  const strike = pending?.xg7Meta?.strike;
  if (!pending || !isXg7cStrikeChoice(pending) || !strike || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = discardCommand({ ...state, pendingEffectChoice: undefined }, playerId, instanceId);
  return { state: next, strike: { ...strike, damageCancelled: true }, log: logFor(state, playerId, "XG7-067", `${SINK_EFFECT_ID}:strike_nullified`) };
}

export function skipXg7cStrike(state: GameState, playerId: PlayerId): { state: GameState; strike: PendingStrike } | null {
  const pending = state.pendingEffectChoice;
  const strike = pending?.xg7Meta?.strike;
  if (!pending || !isXg7cStrikeChoice(pending) || !strike || pending.playerId !== playerId) return null;
  return { state: { ...state, pendingEffectChoice: undefined, log: [...state.log, skipLog(state, playerId, "XG7-067", SINK_EFFECT_ID)] }, strike };
}

CHOICE_RESOLVERS[SINK_EFFECT_ID] = () => ({ error: "xg7067_handled_by_strike" });
CHOICE_SKIPPERS[SINK_EFFECT_ID] = () => ({ error: "xg7067_handled_by_strike" });

// ---------------------------------------------------------------------------
// XG7-068 宇宙刑事シャリバン×ギャバン×シャイダー【蒸着・赤射・焼結】
// 「これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、特徴「宇宙刑事」を持つ自軍ユニットがなければ、自軍コマンドゾーンから
//  オペレーションカードを3枚選びホールドしてもよい。そうしたとき、これを自軍ラッシュエリアに出す。」
// self_rush_from_zone（条件は rules/xg7/xg7Fields.ts xg7CanDeployFromPower）。出した後に、リリース状態のオペレーションカード3枚をホールドする
// （3枚より多ければ選ぶ）。

const STEAM_EFFECT_ID = "xg7068_jouchaku";

function releasedOperationCommands(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld && isOperationCard(state, c.cardId)).map((c) => c.instanceId);
}

function holdCommands(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (ids.includes(c.instanceId) ? { ...c, commandHeld: true } : c)) }));
}

export function openXg7cOnSelfRushFromZone(state: GameState, rusherId: PlayerId, zone: string, rushedInstanceId: string): GameState {
  if (zone !== "power") return state;
  const card = state.players[rusherId].rush.find((c) => c.instanceId === rushedInstanceId);
  if (!card || !isCard(card.cardId, "XG7-068")) return state;
  const ids = releasedOperationCommands(state, rusherId);
  if (ids.length <= 3) return holdCommands(state, rusherId, ids);
  return openAfter(state, {
    ...selectOne({ playerId: rusherId, phasePlayerId: state.activePlayer, sourceInstanceId: rushedInstanceId }, "XG7-068", STEAM_EFFECT_ID, ids, false, { kind: "select_command" }),
    xg7Meta: { limit: 3 },
  });
}

registerPicks(
  STEAM_EFFECT_ID,
  (state, pending, selected) => releasedOperationCommands(state, pending.playerId).filter((id) => !selected.includes(id)),
  (state, pending, selected) => proceed(holdCommands(close(state, pending), pending.playerId, selected), pending),
  false,
);

// ---------------------------------------------------------------------------
// 場の起動型の能力（rules/fieldActivatedAbilities.ts）

export function isXg7cRushFieldAbilityCard(cardId: string): boolean {
  return isCard(cardId, "XG7-063");
}

export function isXg7cBattleFieldAbilityCard(cardId: string): boolean {
  return isCard(cardId, "XG7-052");
}

export function canActivateXg7cFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return canActivateKobun(state, playerId, card) || canActivateTaja(state, playerId, card);
}

export function activateXg7cFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (isCard(card.cardId, "XG7-063")) return activateKobun(state, playerId, card);
  return activateTaja(state, playerId, card);
}

// ---------------------------------------------------------------------------
// キーワード

Object.assign(XG7_KEYWORDS, {
  "XG7-049::split": applySplit,
  "XG7-051::lion": applyLion,
  "XG7-053::assault": applyAssault,
  "XG7-054::ooo_driver": applyOooDriver,
  "XG7-057::fire_girl_sp": applyFireGirlSp,
  "XG7-057::fire_girl_exile": applyFireGirlExile,
  "XG7-060::sagittarius": applySagittarius,
  "XG7-061::scorpio": applyScorpio,
  "XG7-062::shark_brush": applyBrush,
  "XG7-064::revolver": applyRevolver,
  "XG7-065::tri_cannon": applyCannon,
  "XG7-066::hydrander": applyHydra,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない（rules/xg7/xg7Fields.ts 等）。
  "XG7-047::kamakiri_sword": noop("xg7047:static"),
  "XG7-049::gata_count": noop("xg7049:static"),
  "XG7-052::wing_bonus": noop("xg7052:static"),
  "XG7-052::taja_spinner": noop("xg7052:field_ability"),
  "XG7-053::hand_count": noop("xg7053:static"),
  "XG7-055::cyclone_gale": noop("xg7055:on_attacked"),
  "XG7-056::luna": noop("xg7056:on_rushed"),
  "XG7-058::macho_body": noop("xg7058:leave_replacement"),
  "XG7-059::game_start": noop("xg7059:before_on_rush"),
  "XG7-063::kobunzame": noop("xg7063:field_ability"),
  "XG7-068::jouchaku": noop("xg7068:self_rush_from_power"),
});

void areaCards;
