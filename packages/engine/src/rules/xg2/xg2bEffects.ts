/**
 * クロスギャザー XG2-021〜XG2-041（重騎士〜スーパーシンケンイエロー）のカード固有の効果（cardSpec XG2-021-041 の監査）。
 * 登録は rules/xg2/xg2Core.ts。継続効果の判定（XG2-028・029 の SP・BP、XG2-031 の BP、XG2-038 のアタック先等）は rules/xg2/xg2Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, effectiveBp, getDefinition, unitEffectiveCategories as unitEffectiveCategoriesSafe, unitSizeOf } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { addTurnRestrictionModifier } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { openEffectChoice } from "../pendingChoices";
import { resolveBattlePending, tryLeaveField } from "../operationCounters";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { moveToExile } from "../exile";
import { grantSp1ToBattleUnit, hasBattleNcEffect, markBattleNcEffect } from "../namedUnitEffects";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { loseDamageThreshold } from "../../core/createGame";
import {
  type BaseCtx,
  base,
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  zoneOfField,
} from "../rm/rm1Effects";
import { XG2_KIJOU_KEY, XG2_NO_STRIKE_RESTRICTION, XG2_SUIRYU_MARK, type Xg2KijouEntry, xg2FaceDownStacked } from "./xg2Fields";
import { type ChoiceOutcome, metaOf, ownTurn, registerXg2Choice, registerXg2Keyword, simpleSkipXg2, xg2Hook } from "./xg2Core";

// ---------------------------------------------------------------------------
// 共通

function selectOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function enemyUnits(state: GameState, playerId: PlayerId, sourceCardId: string, zones: Array<"battle" | "rush"> = ["battle", "rush"]): CardInstance[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId).filter(
    (c) => zones.includes(zoneOfField(state, enemyId, c.instanceId) ?? "battle") && selectableEnemy(state, playerId, sourceCardId, c),
  );
}

function hasCategory(state: GameState, cardId: string, cat: string): boolean {
  const c = getDefinition(state.definitions, cardId)?.category as string | string[] | undefined;
  return Array.isArray(c) ? c.includes(cat) : c === cat;
}

function holdCommand(state: GameState, playerId: PlayerId, commandId: string): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === commandId ? { ...c, commandHeld: true } : c)) }));
}

function holdFieldUnits(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, playerId, (p) => {
    const hold = (cards: CardInstance[]) => cards.map((c) => (ids.includes(c.instanceId) ? { ...c, commandHeld: true } : c));
    return { ...p, rush: hold(p.rush), battle: hold(p.battle) };
  });
}

function xg2List<T>(state: GameState, key: string): T[] {
  return ((state.xg2?.[key] as T[] | undefined) ?? []);
}

function withXg2List<T>(state: GameState, key: string, entries: T[]): GameState {
  const rest = { ...(state.xg2 ?? {}) };
  if (entries.length > 0) rest[key] = entries;
  else delete rest[key];
  return { ...state, xg2: Object.keys(rest).length > 0 ? rest : undefined };
}

function sourceCard(state: GameState, ctx: GrantKeywordContext): CardInstance | undefined {
  return ctx.triggerSourceInstanceId ? findField(state, ctx.playerId, ctx.triggerSourceInstanceId) : undefined;
}

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

/** 「まで選ぶ」の選択（上限に達するか確定したら finish）。 */
function multiPick(effectId: string, finish: (state: GameState, playerId: PlayerId, pending: PendingEffectChoice, selected: string[]) => GameState) {
  const done = (state: GameState, playerId: PlayerId): ChoiceOutcome => {
    const pending = state.pendingEffectChoice!;
    const selected = pending.selectedInstanceIds ?? [];
    const next = finish(close(state, pending), playerId, pending, selected);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${selected.length}`) };
  };
  registerXg2Choice(effectId, {
    resolve: (state, playerId, instanceId) => {
      const pending = state.pendingEffectChoice!;
      const limit = metaOf<{ limit: number }>(pending).limit;
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
      const updated: GameState = { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } };
      if (selected.length >= limit || rest.length === 0) return done(updated, playerId);
      return { state: updated, log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${instanceId}`) };
    },
    skip: (state, playerId) => {
      if ((state.pendingEffectChoice!.selectedInstanceIds ?? []).length > 0) return done(state, playerId);
      return simpleSkipXg2()(state, playerId);
    },
    confirm: done,
  });
}

function multiChoice(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], limit: number, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: limit, optional: true, xg2Meta: { limit }, ...extra };
}

// ---------------------------------------------------------------------------
// XG2-021 重騎士【騎乗】（自軍ターン中、バトルエリアに出たとき）
// 「「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれている自軍ユニットを1体選んでもよい。このターン、選んだユニットを
//  バトルエリアに出すとき、自軍コマンドを1つホールドするかわりに、相手は自分自身のコマンドを1つ選びホールドする。」（atwiki/page-1192）。
// 選んだユニットは、このターン、出るときのホールドが1つ少なくなる（rules/restrictions.ts requiredBattleEntryHolds。rules/xg2/xg2Fields.ts）。
// 出たら相手がリリース状態の自分のコマンドを1つ選びホールドする（なければ何もしない。questions U-15 (a)）。

const KIJOU_EFFECT_ID = "xg2_021_kijou";
const KIJOU_HOLD_EFFECT_ID = "xg2_021_kijou_enemy_hold";
const HOLD_TEXT = "自軍コマンドを1つホールドしなければバトルエリアに出られない";

function applyKijou(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_021:not_own_turn" };
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => c.instanceId !== ctx.triggerSourceInstanceId && (getDefinition(state.definitions, c.cardId)?.text ?? "").normalize("NFKC").includes(HOLD_TEXT))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_021:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-021", KIJOU_EFFECT_ID, ids, true)), detail: KIJOU_EFFECT_ID };
}

registerXg2Choice(KIJOU_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const entries = xg2List<Xg2KijouEntry>(state, XG2_KIJOU_KEY).filter((e) => e.turn === state.turn);
    const next = withXg2List(close(state, pending), XG2_KIJOU_KEY, [...entries, { ownerId: playerId, instanceId, turn: state.turn }]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-021", `${KIJOU_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(KIJOU_HOLD_EFFECT_ID, {
  resolve: (state, playerId, commandId) => {
    const pending = state.pendingEffectChoice!;
    return { state: proceed(holdCommand(close(state, pending), playerId, commandId), pending), log: logFor(state, playerId, "XG2-021", `${KIJOU_HOLD_EFFECT_ID}:${commandId}`) };
  },
});

/** 選んだユニットがバトルエリアに出たら、相手にコマンドを選ばせる。ターンが変わったら記録を消す。 */
xg2Hook("afterAction", (before, after) => {
  const entries = xg2List<Xg2KijouEntry>(after, XG2_KIJOU_KEY);
  if (entries.length === 0) return after;
  let next = after;
  const keep: Xg2KijouEntry[] = [];
  for (const e of entries) {
    if (e.turn !== next.turn) continue;
    const wasRush = before.players[e.ownerId].rush.some((c) => c.instanceId === e.instanceId);
    const nowBattle = next.players[e.ownerId].battle.some((c) => c.instanceId === e.instanceId);
    if (!(wasRush && nowBattle)) {
      keep.push(e);
      continue;
    }
    const enemyId = opponent(e.ownerId);
    const ids = next.players[enemyId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
    if (ids.length > 0) {
      next = openAfter(next, { ...selectOne({ playerId: enemyId, phasePlayerId: e.ownerId, sourceInstanceId: e.instanceId }, "XG2-021", KIJOU_HOLD_EFFECT_ID, ids, false), kind: "select_command" as PendingEffectChoice["kind"] });
    }
  }
  return withXg2List(next, XG2_KIJOU_KEY, keep);
});

// ---------------------------------------------------------------------------
// XG2-022 重星獣・ゴウタウラス【騎獣激突】（NC。「人型」の M ユニットからコンビネーションするときはナンバーに関係なく）
// 「自軍コマンドを1つ選びホールドしてもよい。そうしたとき、ホールド状態の敵軍コマンドを1つ選び捨札にする。」（atwiki/page-1794）。
// ホールド状態の敵軍コマンドがないときは確かめない（「そうしたとき」の処理ができないので）。NC と「人型」からのコンビネーションが重なっても1回。

const KIJU_MARK = "xg2_022_kiju";
const KIJU_HOLD_EFFECT_ID = "xg2_022_kiju_hold";
const KIJU_DISCARD_EFFECT_ID = "xg2_022_kiju_discard";

function openKiju(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, card: CardInstance): GameState {
  const fresh = findField(state, playerId, card.instanceId);
  if (!fresh || hasBattleNcEffect(fresh, KIJU_MARK)) return state;
  const enemyId = opponent(playerId);
  if (!state.players[enemyId].command.some((c) => c.commandHeld)) return state;
  const ids = state.players[playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  const marked = markBattleNcEffect(state, playerId, card.instanceId, KIJU_MARK);
  return openAfter(marked, { ...selectOne({ playerId, phasePlayerId, sourceInstanceId: card.instanceId }, "XG2-022", KIJU_HOLD_EFFECT_ID, ids, true), kind: "select_command" as PendingEffectChoice["kind"] });
}

function applyKiju(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const card = sourceCard(state, ctx);
  if (!card) return { state, detail: "xg2_022:no_source" };
  return { state: openKiju(state, ctx.playerId, ctx.phasePlayerId, card), detail: KIJU_HOLD_EFFECT_ID };
}

xg2Hook("comboEnter", (state, playerId, card, battleBeforeEnter) => {
  if (!isSameCardIdentity(card.cardId, "XG2-022")) return state;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || getDefinition(state.definitions, left.cardId)?.type !== "unit" || unitSizeOf(state.definitions, left) !== "M") return state;
  if (!unitFeatures(state, playerId, left).includes("人型")) return state;
  return openKiju(state, playerId, state.activePlayer, card);
});

registerXg2Choice(KIJU_HOLD_EFFECT_ID, {
  resolve: (state, playerId, commandId) => {
    const pending = state.pendingEffectChoice!;
    const next = holdCommand(close(state, pending), playerId, commandId);
    const ids = next.players[opponent(playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
    const log = logFor(state, playerId, "XG2-022", `${KIJU_HOLD_EFFECT_ID}:${commandId}`);
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, { ...selectOne(pendingBase(pending), "XG2-022", KIJU_DISCARD_EFFECT_ID, ids, false), kind: "select_command" as PendingEffectChoice["kind"] }), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(KIJU_DISCARD_EFFECT_ID, {
  resolve: (state, playerId, commandId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const next = patchPlayer(close(state, pending), enemyId, (p) => {
      const card = p.command.find((c) => c.instanceId === commandId);
      if (!card) return p;
      return { ...p, command: p.command.filter((c) => c.instanceId !== commandId), discard: [...p.discard, { instanceId: card.instanceId, cardId: card.cardId }] };
    });
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-022", `${KIJU_DISCARD_EFFECT_ID}:${commandId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-023 黒騎士ブルブラック【黒の一撃】（NC）
// 「敵軍バトルエリアからナンバーを持たないSユニットを1体選び、撃破してもよい。また、DAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、
//  このターン、これは「SP1」になる。」（atwiki/page-1795）。2つの「してもよい」は別々に確かめる（撃破を見送ってもホールドは選べる）。

const BLACK_DESTROY_EFFECT_ID = "xg2_023_black_destroy";
const BLACK_HOLD_EFFECT_ID = "xg2_023_black_hold";

function blackHoldChoice(state: GameState, ctx: BaseCtx): PendingEffectChoice | null {
  const ids = state.players[ctx.playerId].command.filter((c) => !c.commandHeld && hasCategory(state, c.cardId, "DA")).map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return { ...selectOne(ctx, "XG2-023", BLACK_HOLD_EFFECT_ID, ids, true), kind: "select_command" as PendingEffectChoice["kind"] };
}

function applyBlackStrike(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const bctx = ctxBase(ctx);
  const ids = enemyUnits(state, ctx.playerId, "XG2-023", ["battle"])
    .filter((c) => rk1IsSmallNow(state, c) && getDefinition(state.definitions, c.cardId)?.comboNumber === undefined)
    .map((c) => c.instanceId);
  if (ids.length > 0) return { state: openAfter(state, selectOne(bctx, "XG2-023", BLACK_DESTROY_EFFECT_ID, ids, true)), detail: BLACK_DESTROY_EFFECT_ID };
  const hold = blackHoldChoice(state, bctx);
  return hold ? { state: openAfter(state, hold), detail: BLACK_HOLD_EFFECT_ID } : { state, detail: "xg2_023:no_targets" };
}

function continueBlack(state: GameState, pending: PendingEffectChoice): GameState {
  const hold = blackHoldChoice(state, pendingBase(pending));
  return hold ? openNext(state, pending, hold) : proceed(state, pending);
}

registerXg2Choice(BLACK_DESTROY_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-023", `${BLACK_DESTROY_EFFECT_ID}_destroy`, [instanceId]);
    return { state: continueBlack(next, pending), log: logFor(state, playerId, "XG2-023", `${BLACK_DESTROY_EFFECT_ID}:${instanceId}`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: continueBlack(close(state, pending), pending), log: logFor(state, playerId, "XG2-023", `${BLACK_DESTROY_EFFECT_ID}:skipped`) };
  },
});

registerXg2Choice(BLACK_HOLD_EFFECT_ID, {
  resolve: (state, playerId, commandId) => {
    const pending = state.pendingEffectChoice!;
    let next = holdCommand(close(state, pending), playerId, commandId);
    if (pending.sourceInstanceId) next = grantSp1ToBattleUnit(next, playerId, pending.sourceInstanceId);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-023", `${BLACK_HOLD_EFFECT_ID}:${commandId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-024 剣将ブドー【一騎打ち】（NC）
// 「敵軍バトルエリアのユニットが1体だけなら、これのBPを+4000してもよい。そうしたとき、自軍バトルフェイズ終了時にこれを撃破する。」（atwiki/page-1741）。

const IKKI_EFFECT_ID = "xg2_024_ikkiuchi";
const IKKI_KEY = "ikkiuchi";
type IkkiEntry = { ownerId: PlayerId; instanceId: string; turn: number };

function applyIkki(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.players[opponent(ctx.playerId)].battle.length !== 1) return { state, detail: "xg2_024:not_one" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG2-024", IKKI_EFFECT_ID)), detail: IKKI_EFFECT_ID };
}

registerXg2Choice(IKKI_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const id = pending.sourceInstanceId;
    let next = close(state, pending);
    if (id) {
      next = patchPlayer(next, playerId, (p) => ({ ...p, battle: p.battle.map((c) => (c.instanceId === id ? { ...c, bpModifier: (c.bpModifier ?? 0) + 4000 } : c)) }));
      next = withXg2List(next, IKKI_KEY, [...xg2List<IkkiEntry>(next, IKKI_KEY).filter((e) => e.turn === state.turn), { ownerId: playerId, instanceId: id, turn: state.turn }]);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-024", `${IKKI_EFFECT_ID}:bp+4000`) };
  },
});

xg2Hook("battlePhaseEnd", (state, endingPlayerId) => {
  const entries = xg2List<IkkiEntry>(state, IKKI_KEY);
  if (entries.length === 0) return state;
  let next = withXg2List(state, IKKI_KEY, entries.filter((e) => e.ownerId !== endingPlayerId && e.turn === state.turn));
  for (const e of entries) {
    if (e.ownerId !== endingPlayerId || e.turn !== state.turn) continue;
    const from = zoneOfField(next, e.ownerId, e.instanceId);
    const card = findField(next, e.ownerId, e.instanceId);
    if (!from || !card) continue;
    next = tryLeaveField(next, { ownerPlayerId: e.ownerId, instanceId: e.instanceId, fromZone: from, toZone: "discard", leavingCardId: card.cardId, phasePlayerId: endingPlayerId }).state;
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG2-025 ギンガレッド【二刃一閃】（NC）
// 「自分も相手も次のようにする⇒自分自身のエリアに同名ユニットが2体以上あれば、1体選びゲームから除外する」（atwiki/page-1233）。
// 自分から順に、それぞれのプレイヤーが自分のエリアの同名ユニットから1体選ぶ（強制）。除外は撃破ではない。

const NIJIN_EFFECT_ID = "xg2_025_nijin";

function duplicateNamedUnits(state: GameState, pid: PlayerId): string[] {
  const units = fieldUnits(state, pid);
  const count = new Map<string, number>();
  for (const u of units) count.set(cardName(state.definitions, u.cardId), (count.get(cardName(state.definitions, u.cardId)) ?? 0) + 1);
  return units.filter((u) => (count.get(cardName(state.definitions, u.cardId)) ?? 0) >= 2).map((u) => u.instanceId);
}

function applyNijin(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  let next = state;
  for (const pid of [ctx.playerId, opponent(ctx.playerId)]) {
    const ids = duplicateNamedUnits(next, pid);
    if (ids.length === 0) continue;
    next = openAfter(next, selectOne({ playerId: pid, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG2-025", NIJIN_EFFECT_ID, ids, false));
  }
  return { state: next, detail: NIJIN_EFFECT_ID };
}

export function xg2ExileFieldUnit(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const from = zoneOfField(state, ownerId, instanceId);
  const card = findField(state, ownerId, instanceId);
  if (!from || !card) return state;
  let next = patchPlayer(state, ownerId, (p) => {
    const unmount = (cards: CardInstance[]) => cards.map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    return { ...p, rush: unmount(p.rush), battle: unmount(p.battle), discard: [...p.discard, ...(card.stackedCards ?? []).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))] };
  });
  next = moveToExile(next, ownerId, from, instanceId);
  next = patchPlayer(next, ownerId, (p) => ({ ...p, exile: (p.exile ?? []).map((c) => (c.instanceId === instanceId ? { instanceId: c.instanceId, cardId: c.cardId } : c)) }));
  const left = emitUnitLeftZoneAndResolve(next, { ownerPlayerId: ownerId, instanceId, cardId: card.cardId, fromZone: from, toZone: "exile", phasePlayerId, destroyed: false });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

registerXg2Choice(NIJIN_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = xg2ExileFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-025", `${NIJIN_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-026 ギンガブルー【激流一刀】（NC）「「SP1」これが敵軍ユニットをバトルで撃破したとき、1枚ドローしてもよい。」（atwiki/page-1749）。
// NC で印を付け（ターンの終わりに消える）、印のあるこれがバトルで敵軍ユニットを撃破して捨札にしたときに確かめる。
// XG2-029 幽魔王サラマンデス【災魔ツリー】「これが自軍エリアにある間、敵軍ユニットが撃破されたとき、自軍山札の上から1枚ひいて、これの下にウラ向きで
// 重ねてもよい。」（atwiki/page-1798）。撃破されて場を離れたとき（行き先を問わない）にコピーごとに確かめる。

const GEKIRYU_MARK = "xg2_026_gekiryu";
/** NC が成立したときに記録される【激流一刀】の効果の id（DSL の効果の id。NC の効果が「SP1」だけの経路で処理されても残る）。 */
const GEKIRYU_NC_EFFECT_ID = "to_e6bf80";
const GEKIRYU_EFFECT_ID = "xg2_026_gekiryu_draw";
const SAIMA_EFFECT_ID = "xg2_029_saima_tree";

function applyGekiryu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ctx.triggerSourceInstanceId) return { state, detail: "xg2_026:no_source" };
  return { state: markBattleNcEffect(state, ctx.playerId, ctx.triggerSourceInstanceId, GEKIRYU_MARK), detail: GEKIRYU_MARK };
}

xg2Hook("unitLeftZone", (state, event) => {
  if (event.destroyed === false) return state;
  const killerOwner = opponent(event.ownerPlayerId);
  let next = state;
  const phasePlayerId = event.phasePlayerId ?? state.activePlayer;
  if (event.toZone === "discard" && event.battleOpponentInstanceId) {
    const killer = findField(next, killerOwner, event.battleOpponentInstanceId);
    if (killer && isSameCardIdentity(killer.cardId, "XG2-026") && (hasBattleNcEffect(killer, GEKIRYU_MARK) || hasBattleNcEffect(killer, GEKIRYU_NC_EFFECT_ID))) {
      next = openAfter(next, confirmChoice({ playerId: killerOwner, phasePlayerId, sourceInstanceId: killer.instanceId }, "XG2-026", GEKIRYU_EFFECT_ID));
    }
  }
  for (const tree of fieldUnits(next, killerOwner).filter((c) => isSameCardIdentity(c.cardId, "XG2-029"))) {
    if (next.players[killerOwner].deck.length === 0) break;
    next = openAfter(next, confirmChoice({ playerId: killerOwner, phasePlayerId, sourceInstanceId: tree.instanceId }, "XG2-029", SAIMA_EFFECT_ID));
  }
  return next;
});

registerXg2Choice(GEKIRYU_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const next = patchPlayer(close(state, pending), playerId, drawOne);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-026", `${GEKIRYU_EFFECT_ID}:draw`) };
  },
});

/** 場のユニットの下にカードをウラ向きで重ねる。 */
function stackFaceDown(state: GameState, ownerId: PlayerId, unitId: string, card: { instanceId: string; cardId: string }): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const put = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === unitId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { instanceId: card.instanceId, cardId: card.cardId, faceDown: true }] } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle) };
  });
}

registerXg2Choice(SAIMA_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const top = next.players[playerId].deck[0];
    if (top && pending.sourceInstanceId && findField(next, playerId, pending.sourceInstanceId)) {
      next = patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.slice(1) }));
      next = stackFaceDown(next, playerId, pending.sourceInstanceId, top);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-029", `${SAIMA_EFFECT_ID}:stacked`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-027 ギンガイエロー【雷一掃】（NC）
// 「「SP1」特徴「メカ」を持つ敵軍Sユニットを好きな数選びホールドしてもよい。ただし、選べるユニットの数は、リリース状態の自軍コマンドの数までとする。」
// （atwiki/page-1796）。敵軍の場（エリアを問わない）の、リリース状態の「メカ」の S ユニット。

const RAI_EFFECT_ID = "xg2_027_rai_issou";

function applyRai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const limit = state.players[ctx.playerId].command.filter((c) => !c.commandHeld).length;
  if (limit <= 0) return { state, detail: "xg2_027:no_command" };
  const enemyId = opponent(ctx.playerId);
  const ids = enemyUnits(state, ctx.playerId, "XG2-027")
    .filter((c) => !c.commandHeld && rk1IsSmallNow(state, c) && unitFeatures(state, enemyId, c).includes("メカ"))
    .map((c) => c.instanceId)
    .sort();
  if (ids.length === 0) return { state, detail: "xg2_027:no_targets" };
  return { state: openAfter(state, multiChoice(ctxBase(ctx), "XG2-027", RAI_EFFECT_ID, ids, limit)), detail: RAI_EFFECT_ID };
}

multiPick(RAI_EFFECT_ID, (state, playerId, _pending, selected) => holdFieldUnits(state, opponent(playerId), selected));

// ---------------------------------------------------------------------------
// XG2-028 サラマンデスドラゴン【マイナスエネルギー吸収】
// 「これが自軍ラッシュエリアにある間、自軍バトルフェイズを終えるときに1度だけ、自軍捨札から必要パワーに「－」を持つカードを1枚選び、これの下に
//  ウラ向きで重ねてもよい。…これがユニットでなくなるとき、この下に重ねたウラ向きのカードをすべて捨札にする。」（atwiki/page-1797）。
// SP は rules/xg2/xg2Fields.ts。ユニットでなくなるときは離場の処理のあと（applyXg2AfterUnitLeft）。

const MINUS_EFFECT_ID = "xg2_028_minus_energy";

function hasMinusCost(state: GameState, cardId: string): boolean {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  return typeof cost === "string" && /[-－−]$/.test(cost.trim());
}

xg2Hook("battlePhaseEnd", (state, endingPlayerId) => {
  let next = state;
  for (const dragon of next.players[endingPlayerId].rush.filter((c) => isSameCardIdentity(c.cardId, "XG2-028"))) {
    const ids = next.players[endingPlayerId].discard.filter((c) => hasMinusCost(next, c.cardId)).map((c) => c.instanceId);
    if (ids.length === 0) break;
    next = openAfter(next, { ...selectOne({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: dragon.instanceId }, "XG2-028", MINUS_EFFECT_ID, ids, true), kind: "select_unit" });
  }
  return next;
});

registerXg2Choice(MINUS_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const card = next.players[playerId].discard.find((c) => c.instanceId === instanceId);
    if (card && pending.sourceInstanceId && findField(next, playerId, pending.sourceInstanceId)) {
      next = patchPlayer(next, playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId) }));
      next = stackFaceDown(next, playerId, pending.sourceInstanceId, card);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-028", `${MINUS_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// XG2-029「これがユニットでなくなるとき、この下に重ねたウラ向きのカードから、ウラ向きのまま1枚選び手札に加えて、残りを捨札にする。」

const SAIMA_LEAVE_EFFECT_ID = "xg2_029_saima_leave";

/** 場を離れたカード（どのゾーンにあっても）から、下に重ねたウラ向きのカードを外す。 */
function detachFaceDown(state: GameState, ownerId: PlayerId, instanceId: string): { state: GameState; cards: Array<{ instanceId: string; cardId: string }> } {
  const p = state.players[ownerId];
  let cards: Array<{ instanceId: string; cardId: string }> = [];
  const strip = (list: CardInstance[]) =>
    list.map((c) => {
      if (c.instanceId !== instanceId || !c.stackedCards?.length) return c;
      cards = xg2FaceDownStacked(c).map((s) => ({ instanceId: s.instanceId, cardId: s.cardId }));
      const rest = c.stackedCards.filter((s) => !s.faceDown);
      return { ...c, stackedCards: rest.length > 0 ? rest : undefined };
    });
  const next = { ...p, discard: strip(p.discard), power: strip(p.power), hand: strip(p.hand), command: strip(p.command), deck: strip(p.deck), exile: p.exile ? strip(p.exile) : p.exile };
  return { state: patchPlayer(state, ownerId, () => next), cards };
}

xg2Hook("afterUnitLeft", (state, left) => {
  const isDragon = isSameCardIdentity(left.card.cardId, "XG2-028");
  const isTree = isSameCardIdentity(left.card.cardId, "XG2-029");
  if ((!isDragon && !isTree) || xg2FaceDownStacked(left.card).length === 0) return state;
  if (findField(state, left.ownerPlayerId, left.card.instanceId)) return state;
  const detached = detachFaceDown(state, left.ownerPlayerId, left.card.instanceId);
  if (detached.cards.length === 0) return state;
  if (isDragon) {
    return patchPlayer(detached.state, left.ownerPlayerId, (p) => ({ ...p, discard: [...p.discard, ...detached.cards] }));
  }
  const parked = patchPlayer(detached.state, left.ownerPlayerId, (p) => ({ ...p, discard: [...p.discard, ...detached.cards] }));
  return openAfter(parked, {
    ...selectOne({ playerId: left.ownerPlayerId, phasePlayerId: left.phasePlayerId }, "XG2-029", SAIMA_LEAVE_EFFECT_ID, detached.cards.map((c) => c.instanceId), false),
    kind: "select_unit",
  });
});

registerXg2Choice(SAIMA_LEAVE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = patchPlayer(close(state, pending), playerId, (p) => {
      const card = p.discard.find((c) => c.instanceId === instanceId);
      if (!card) return p;
      return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, { instanceId: card.instanceId, cardId: card.cardId }] };
    });
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-029", `${SAIMA_LEAVE_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-032 デカレンジャーロボ【ジャイロワッパー】
// 「これが敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主のパワーゾーンに送ってもよい。」（atwiki/page-1800）。
// カウンターの窓のあと、バトルの解決の直前に、そのときのバトル相手（RS-018 隠流忍術で変わったユニットも。Q1）を選ぶ（見送れる）。
// 送ったらバトルは行わない。

const GYRO_HOOK_ID = "xg2_032";
const GYRO_EFFECT_ID = "xg2_032_gyro_wapper";

function battleOpponentOf(state: GameState, battle: PendingBattle): { ownerId: PlayerId; card: CardInstance } | null {
  const id = battle.substituteInstanceId ?? battle.defenderInstanceId;
  for (const pid of ["player1", "player2"] as const) {
    const card = findField(state, pid, id);
    if (card) return { ownerId: pid, card };
  }
  return null;
}

xg2Hook("beforeBattle", {
  id: GYRO_HOOK_ID,
  open: (state, battle) => {
    if (battle.effectBattle) return null;
    const attacker = findField(state, battle.attackerPlayerId, battle.attackerInstanceId);
    if (!attacker || !isSameCardIdentity(attacker.cardId, "XG2-032")) return null;
    const opp = battleOpponentOf(state, battle);
    if (!opp || opp.ownerId === battle.attackerPlayerId) return null;
    return openEffectChoice(
      { ...state, pendingBattle: undefined },
      selectOne({ playerId: battle.attackerPlayerId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: attacker.instanceId }, "XG2-032", GYRO_EFFECT_ID, [opp.card.instanceId], true, { xg2Meta: { battle } }),
    );
  },
});

registerXg2Choice(GYRO_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const battle = metaOf<{ battle: PendingBattle }>(pending).battle;
    const opp = battleOpponentOf(state, battle);
    let next = close(state, pending);
    if (opp && opp.card.instanceId === instanceId) next = moveFieldUnit(next, opp.ownerId, instanceId, battle.phasePlayerId, "power");
    next = resolveBattlePending(next, { ...battle, battleCancelled: true }).state;
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-032", `${GYRO_EFFECT_ID}:${instanceId}`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const battle = metaOf<{ battle: PendingBattle }>(pending).battle;
    return { state: proceed(resolveBattlePending(close(state, pending), battle).state, pending), log: logFor(state, playerId, "XG2-032", `${GYRO_EFFECT_ID}:skipped`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-033 デカブライト
// ※「これが自軍パワーゾーンにある間、「デカブライト」以外の自軍パワーゾーンのカードは相手に選ばれない。」（atwiki/page-133）。
// 相手が開いた選択から、デカブライトの持ち主のパワーゾーンの（デカブライト以外の）カードを外す（applyAction の後処理）。
// 【防御拳バリアーフィスト】「このユニットが自軍ラッシュエリアにある間、敵軍ターン中、自分がダメージを受けたとき、このユニットをホールドしてもよい。
// そうしたとき、そのターン中、敵軍Sユニットはストライクすることができない。」ストライクでダメージを受けたときに確かめる。止めるのはそのとき敵軍の場に
// ある S ユニット（ターン限定の制限。rules/keywordGapRuntime.ts）。

const BARRIER_EFFECT_ID = "xg2_033_barrier_fist";

xg2Hook("afterAction", (_before, after) => {
  const pending = after.pendingEffectChoice;
  if (!pending) return after;
  const ownerId = opponent(pending.playerId);
  const power = after.players[ownerId].power;
  if (!power.some((c) => isSameCardIdentity(c.cardId, "XG2-033"))) return after;
  const blocked = new Set(power.filter((c) => !isSameCardIdentity(c.cardId, "XG2-033")).map((c) => c.instanceId));
  if (!pending.validInstanceIds.some((id) => blocked.has(id))) return after;
  const valid = pending.validInstanceIds.filter((id) => !blocked.has(id));
  return { ...after, pendingEffectChoice: { ...pending, validInstanceIds: valid, ...(valid.length === 0 ? { optional: true } : {}) } };
});

xg2Hook("strikeDamage", (state, pending) => {
  const victim = opponent(pending.strikerPlayerId);
  if (state.activePlayer !== pending.strikerPlayerId) return state;
  let next = state;
  for (const db of next.players[victim].rush.filter((c) => isSameCardIdentity(c.cardId, "XG2-033") && !c.commandHeld)) {
    next = openAfter(next, confirmChoice({ playerId: victim, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: db.instanceId }, "XG2-033", BARRIER_EFFECT_ID));
  }
  return next;
});

registerXg2Choice(BARRIER_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const id = pending.sourceInstanceId;
    if (id && next.players[playerId].rush.some((c) => c.instanceId === id && !c.commandHeld)) {
      next = holdFieldUnits(next, playerId, [id]);
      const enemyId = opponent(playerId);
      for (const u of fieldUnits(next, enemyId).filter((c) => rk1IsSmallNow(next, c))) {
        next = patchPlayer(next, enemyId, (p) => addTurnRestrictionModifier(p, u.instanceId, XG2_NO_STRIKE_RESTRICTION));
      }
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-033", `${BARRIER_EFFECT_ID}:held`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-035 デカレンジャーロボFC【フルブラストランチャー】（自軍ターン中、バトルエリアに出たとき）
// 「自分がゲームに負けるまで残りダメージ1点なら、…オモテ向きの自軍パワーを好きな枚数選び捨札にしてもよい。そうしたとき、捨札にしたカード1枚につき、
//  敵軍ユニット1体か敵軍パワーゾーンのカードを1枚選び捨札にする。」（atwiki/page-1820）。パワーを選び終えてから1枚ずつ選ぶ（強制）。
// 敵軍パワーゾーンのカードはオモテ向き（ダメージになっていない）カード。敵軍ユニットはエリア・サイズを問わず、捨札にする（撃破ではない）。

const FBL_POWER_EFFECT_ID = "xg2_035_full_blast_power";
const FBL_TARGET_EFFECT_ID = "xg2_035_full_blast_target";

function applyFullBlast(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_035:not_own_turn" };
  if (loseDamageThreshold(state, ctx.playerId) - state.players[ctx.playerId].damage !== 1) return { state, detail: "xg2_035:not_last" };
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_035:no_power" };
  return { state: openAfter(state, { ...multiChoice(ctxBase(ctx), "XG2-035", FBL_POWER_EFFECT_ID, ids, ids.length), kind: "select_power" as PendingEffectChoice["kind"] }), detail: FBL_POWER_EFFECT_ID };
}

function fullBlastTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return [
    ...enemyUnits(state, playerId, "XG2-035").map((c) => c.instanceId),
    ...state.players[enemyId].power.filter((c) => !c.faceDown).map((c) => c.instanceId),
  ];
}

function openFullBlastTarget(state: GameState, pending: PendingEffectChoice, rest: number): GameState {
  const ids = fullBlastTargets(state, pending.playerId);
  if (rest <= 0 || ids.length === 0) return proceed(state, pending);
  return openNext(state, pending, selectOne(pendingBase(pending), "XG2-035", FBL_TARGET_EFFECT_ID, ids, false, { xg2Meta: { rest } }));
}

multiPick(FBL_POWER_EFFECT_ID, (state, playerId, pending, selected) => {
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => !selected.includes(c.instanceId)),
    discard: [...p.discard, ...p.power.filter((c) => selected.includes(c.instanceId)).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
  // 対象を選ぶ選択は proceed の前に開く（multiPick が続きを開く）。
  return openFullBlastTarget(next, { ...pending, resumeChoice: undefined }, selected.length);
});

registerXg2Choice(FBL_TARGET_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    let next = close(state, pending);
    if (findField(next, enemyId, instanceId)) {
      next = moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "discard");
    } else {
      next = patchPlayer(next, enemyId, (p) => {
        const card = p.power.find((c) => c.instanceId === instanceId);
        if (!card) return p;
        return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, { instanceId: card.instanceId, cardId: card.cardId }] };
      });
    }
    const rest = metaOf<{ rest: number }>(pending).rest - 1;
    return { state: openFullBlastTarget(next, pending, rest), log: logFor(state, playerId, "XG2-035", `${FBL_TARGET_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-036 トラシンケンオー【虎ドリル突撃】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍バトルエリアからBP8000以下のユニットを1体選び持ち主のパワーゾーンにダメージにして置いてもよい。そうしたとき、敵軍ラッシュエリアから
//  BP4000以下のユニットを1体選び持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1755）。今の BP で見る。サイズを問わない。

const DRILL_BATTLE_EFFECT_ID = "xg2_036_drill_battle";
const DRILL_RUSH_EFFECT_ID = "xg2_036_drill_rush";

function drillIds(state: GameState, playerId: PlayerId, zone: "battle" | "rush", maxBp: number): string[] {
  const enemyId = opponent(playerId);
  return enemyUnits(state, playerId, "XG2-036", [zone])
    .filter((c) => effectiveBp(state, enemyId, c) <= maxBp)
    .map((c) => c.instanceId)
    .sort();
}

function applyDrill(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_036:not_own_turn" };
  const ids = drillIds(state, ctx.playerId, "battle", 8000);
  if (ids.length === 0) return { state, detail: "xg2_036:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-036", DRILL_BATTLE_EFFECT_ID, ids, true)), detail: DRILL_BATTLE_EFFECT_ID };
}

registerXg2Choice(DRILL_BATTLE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
    const ids = drillIds(next, playerId, "rush", 4000);
    const log = logFor(state, playerId, "XG2-036", `${DRILL_BATTLE_EFFECT_ID}:${instanceId}`);
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG2-036", DRILL_RUSH_EFFECT_ID, ids, false)), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(DRILL_RUSH_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-036", `${DRILL_RUSH_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-037 スーパーシンケンレッド【スーパーシンケンマル】（NC）「DAを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-1853）。
// 敵軍の場（エリアを問わない）の DA の S ユニット（今のカテゴリ）。強制。

const SHINKENMARU_EFFECT_ID = "xg2_037_shinkenmaru";

function applyShinkenmaru(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = enemyUnits(state, ctx.playerId, "XG2-037")
    .filter((c) => rk1IsSmallNow(state, c) && hasCategoryNow(state, enemyId, c, "DA"))
    .map((c) => c.instanceId)
    .sort();
  if (ids.length === 0) return { state, detail: "xg2_037:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-037", SHINKENMARU_EFFECT_ID, ids, false)), detail: SHINKENMARU_EFFECT_ID };
}

function hasCategoryNow(state: GameState, ownerId: PlayerId, card: CardInstance, cat: string): boolean {
  const zone = zoneOfField(state, ownerId, card.instanceId) ?? "battle";
  return (unitEffectiveCategoriesSafe(state, ownerId, card, zone) as string[]).includes(cat);
}

registerXg2Choice(SHINKENMARU_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-037", `${SHINKENMARU_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-037", `${SHINKENMARU_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-038 スーパーシンケンブルー【真・水流の舞い】（NC）「これは敵軍ラッシュエリアのユニットにアタックできる。」（atwiki/page-1854）。
// NC が成立したら印を付ける（rules/xg2/xg2Fields.ts xg2AllowsRushAttack。RS-675【ウォーターアロー】と同じ）。
// XG2-039 スーパーシンケンピンク【真・天空の舞い】（NC）「「SP1」自分は1枚ドローする。」（atwiki/page-1756）。


function applySuiryu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ctx.triggerSourceInstanceId) return { state, detail: "xg2_038:no_source" };
  return { state: markBattleNcEffect(state, ctx.playerId, ctx.triggerSourceInstanceId, XG2_SUIRYU_MARK), detail: XG2_SUIRYU_MARK };
}

function applyTenku(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: patchPlayer(state, ctx.playerId, drawOne), detail: "xg2_039:draw" };
}

// ---------------------------------------------------------------------------
// 起点


registerXg2Keyword("XG2-021::kijou", applyKijou);
registerXg2Keyword("XG2-022::kiju_gekitotsu", applyKiju);
registerXg2Keyword("XG2-023::kuro_no_ichigeki", applyBlackStrike);
registerXg2Keyword("XG2-024::ikkiuchi", applyIkki);
registerXg2Keyword("XG2-025::nijin_issen", applyNijin);
registerXg2Keyword("XG2-026::gekiryu_itto", applyGekiryu);
registerXg2Keyword("XG2-027::rai_issou", applyRai);
registerXg2Keyword("XG2-035::full_blast_launcher", applyFullBlast);
registerXg2Keyword("XG2-036::tora_drill", applyDrill);
registerXg2Keyword("XG2-037::super_shinkenmaru", applyShinkenmaru);
registerXg2Keyword("XG2-038::shin_suiryu", applySuiryu);
registerXg2Keyword("XG2-039::shin_tenku", applyTenku);
// 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
registerXg2Keyword("XG2-028::minus_energy", noop("xg2_028:battle_phase_end"));
registerXg2Keyword("XG2-029::saima_tree", noop("xg2_029:unit_destroyed"));
registerXg2Keyword("XG2-031::backup", noop("xg2_031:bp"));
registerXg2Keyword("XG2-032::gyro_wapper", noop("xg2_032:before_battle"));
registerXg2Keyword("XG2-033::barrier_fist", noop("xg2_033:strike_damage"));
registerXg2Keyword("XG2-033::power_guard", noop("xg2_033:power_guard"));
