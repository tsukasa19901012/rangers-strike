/**
 * クロスギャザー XG2-082〜XG2-103（電子星獣ドル〜サイドマシーン）のカード固有の効果（cardSpec XG2-082-103 の監査）。
 * 登録は rules/xg2/xg2Core.ts。継続効果の判定（XG2-082 のビークルとしての扱い・XG2-083 のアタックされるときの BP・XG2-085 の BP・
 * XG2-088 の BP と SP・XG2-093 の選ばれない・XG2-099 のリリースできない・XG2-100・XG2-102 のアタックできない）は rules/xg2/xg2Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { applyDamageToPlayer } from "../damagePayment";
import { startEffectRush } from "../effectRush";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rk1GrantRcWithoutRideOff } from "../rk/rk1NamedEffects";
import { turnPlayerOf } from "../legend1/set6NamedEffectsB";
import {
  type BaseCtx,
  base,
  close,
  ctxBase,
  destroyAll,
  effectRushPicked,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  selectableOwnByEnemyEffect,
  printedBp,
  proceed,
  selectableEnemy,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { XG2_NIHONTO_KEY, XG2_ZENTOAKU_KEY, XG2_ZOOKA_KEY, xg2ActsAsVehicle } from "./xg2Fields";
import { xg2PutInOwnersZone } from "./xg2aEffects";
import { registerXg2FieldAbility, registerXg2MountedVehicleEnter } from "./xg2dEffects";
import {
  XG2_ZONE_COMMAND,
  costNumber,
  metaOf,
  ownTurn,
  placeInOwnersZone,
  registerXg2Choice,
  registerXg2Keyword,
  simpleSkipXg2,
  xg2Hook,
} from "./xg2Core";
import { gateReveal } from "../revealGate";

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

/** 印刷されたカテゴリ（1つなら文字列のこともある）。 */
function printedCategories(state: GameState, cardId: string): string[] {
  const cat = defOf(state, cardId)?.category as string | string[] | undefined;
  return cat === undefined ? [] : Array.isArray(cat) ? cat : [cat];
}

function categoriesNow(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  const zone = zoneOfField(state, ownerId, card.instanceId) ?? "battle";
  return unitEffectiveCategories(state, ownerId, card, zone) as string[];
}

function featuresNow(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  return unitFeatures(state, ownerId, card);
}

/** 敵軍の場のユニット（ビークルとして扱うものを除く）で、効果で選べるもの。 */
function enemyUnits(state: GameState, playerId: PlayerId, sourceCardId: string, filter: (c: CardInstance) => boolean, area?: "battle" | "rush"): CardInstance[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId).filter((c) => {
    if (area && zoneOfField(state, enemyId, c.instanceId) !== area) return false;
    if (xg2ActsAsVehicle(state.players[enemyId], c)) return false;
    return selectableEnemy(state, playerId, sourceCardId, c) && filter(c);
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

/** このターン（turn）の記録を足す（古いターンの記録は捨てる）。 */
function addTurnEntry(state: GameState, key: string, ownerId: PlayerId, instanceId: string, turn = state.turn): GameState {
  return withXg2List(state, key, [...xg2List<TurnEntry>(state, key).filter((e) => e.turn >= state.turn), { ownerId, instanceId, turn }]);
}

/** 「持ち主のコマンドゾーンに置く。置けなければ捨札にする。」 */
function toCommandOrDiscard(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, held: boolean): GameState {
  if (state.players[ownerId].command.length >= COMMAND_ZONE_MAX) return moveFieldUnit(state, ownerId, instanceId, phasePlayerId, "discard");
  return held ? moveFieldUnit(state, ownerId, instanceId, phasePlayerId, "command_held") : placeInOwnersZone(state, ownerId, instanceId, phasePlayerId, XG2_ZONE_COMMAND);
}

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

// ---------------------------------------------------------------------------
// XG2-082 電子星獣ドル（atwiki/page-1807）
// 「※これは、自軍エリアでホールド状態かライドされている間、Lビークルとして扱う。 ※自軍ラッシュフェイズ中、このユニットをホールドしてもよい。
//  ※自軍ラッシュフェイズ中、このビークルがライドされていないなら、リリースしてもよい。 【ドルファイヤー】このビークルがチェイスの効果でライドされたとき、
//  敵軍バトルエリアから本来のBPが5000以下のユニットを1体選び撃破してもよい。」
// ホールド・リリースは自軍ラッシュフェイズの場の起動効果（rules/fieldActivatedAbilities.ts）。ビークルとしての扱いは rules/xg2/xg2Fields.ts xg2ActsAsVehicle。

const DOL_FIRE_EFFECT_ID = "xg2_082_dol_fire";

function dolRidden(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].some((c) => c.mountedOnInstanceId === card.instanceId && c.instanceId !== card.instanceId);
}

registerXg2FieldAbility("XG2-082", {
  canActivate: (state, playerId, card) => {
    if (!state.players[playerId].rush.some((c) => c.instanceId === card.instanceId)) return false;
    return !card.commandHeld || !dolRidden(state, playerId, card);
  },
  activate: (state, playerId, card) => {
    const held = !card.commandHeld;
    const next = patchPlayer(state, playerId, (p) => {
      const stacked = held ? (p.rush.find((c) => c.instanceId === card.instanceId)?.stackedCards ?? []) : [];
      return {
        ...p,
        rush: p.rush.map((c) => {
          if (c.instanceId !== card.instanceId) return c;
          // ホールドしてビークルとして扱えば、ユニットでなくなるので重ねたカードは捨札（RK-280 と同じ。rules/rk/rk14Fields.ts rk14HoldSelf）。
          const { stackedCards: _s, ...rest } = c;
          return { ...(held ? (rest as CardInstance) : c), commandHeld: held };
        }),
        discard: [...p.discard, ...stacked.map(stripForZone)],
      };
    });
    return { ...next, log: [...next.log, logFor(state, playerId, "XG2-082", `xg2_082_${held ? "hold" : "release"}`)] };
  },
});

xg2Hook("afterAction", (before, after) => {
  const chase = before.pendingChase;
  if (!chase || after.pendingChase === chase) return after;
  const ownerId = chase.chaserPlayerId;
  const chaser = findField(after, ownerId, chase.chaserInstanceId);
  const vehicleId = chaser?.mountedOnInstanceId;
  if (!vehicleId || vehicleId === findField(before, ownerId, chase.chaserInstanceId)?.mountedOnInstanceId) return after;
  const vehicle = findField(after, ownerId, vehicleId);
  if (!vehicle || !isSameCardIdentity(vehicle.cardId, "XG2-082")) return after;
  const ids = sortedIds(enemyUnits(after, ownerId, "XG2-082", (c) => printedBp(after, c.cardId) <= 5000, "battle"));
  if (ids.length === 0) return after;
  return openAfter(after, selectOne({ playerId: ownerId, phasePlayerId: turnPlayerOf(after), sourceInstanceId: vehicle.instanceId }, "XG2-082", DOL_FIRE_EFFECT_ID, ids, true));
});

registerXg2Choice(DOL_FIRE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-082", `${DOL_FIRE_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-082", `${DOL_FIRE_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-083 宇宙刑事ギャバン【銀河パトロール隊隊長】（RC）「自軍ラッシュエリアから、RCを持つユニットを1体選んでもよい。そうしたとき、このターン、
// 選んだユニットは、バトルエリアに出たとき、ライドオフしなくてもその効果を発動できる。」（atwiki/page-981）。RK-017 ミッションメモリーと同じ記録を使う。
// ※2つ目（アタックされるときの BP+1000）は rules/xg2/xg2Fields.ts xg2DefenderBattleBonus。

const PATROL_EFFECT_ID = "xg2_083_patrol";

function applyPatrol(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = sortedIds(state.players[ctx.playerId].rush.filter((c) => c.instanceId !== ctx.triggerSourceInstanceId && isUnit(state, c.cardId) && defOf(state, c.cardId)?.comboNumber === "RC" && !xg2ActsAsVehicle(state.players[ctx.playerId], c)));
  if (ids.length === 0) return { state, detail: "xg2_083:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-083", PATROL_EFFECT_ID, ids, true)), detail: PATROL_EFFECT_ID };
}

registerXg2Choice(PATROL_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = rk1GrantRcWithoutRideOff(close(state, pending), playerId, "XG2-083", instanceId);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-083", `${PATROL_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-084 バビロス【バビロスレーザー】「自軍ターン中、これがバトルエリアに出たとき、敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、
// オモテにしたカードと同じカード名の敵軍ユニットをすべて撃破する。その後、オモテにしたカードは山札の下に戻す。」（atwiki/page-1808）。
// 選択の候補は敵軍山札の上のカード（選べばオモテにする）。撃破する敵軍ユニットのエリアは問わない。

const LASER_EFFECT_ID = "xg2_084_babylos_laser";

function applyLaser(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_084:not_own_turn" };
  const top = state.players[opponent(ctx.playerId)].deck[0];
  if (!top) return { state, detail: "xg2_084:empty_deck" };
  return { state: openAfter(state, gateReveal({ ...selectOne(ctxBase(ctx), "XG2-084", LASER_EFFECT_ID, [top.instanceId], true), kind: "confirm" })), detail: LASER_EFFECT_ID };
}

registerXg2Choice(LASER_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const top = state.players[enemyId].deck[0];
    if (!top || top.instanceId !== instanceId) return { error: "invalid_target" };
    const name = cardName(state.definitions, top.cardId);
    const ids = sortedIds(fieldUnits(state, enemyId).filter((c) => !xg2ActsAsVehicle(state.players[enemyId], c) && cardName(state.definitions, c.cardId) === name));
    let next = destroyAll(close(state, pending), pendingBase(pending), "XG2-084", `${LASER_EFFECT_ID}_destroy`, ids);
    next = patchPlayer(next, enemyId, (p) => {
      const card = p.deck.find((c) => c.instanceId === instanceId);
      return card ? { ...p, deck: [...p.deck.filter((c) => c.instanceId !== instanceId), card] } : p;
    });
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-084", `${LASER_EFFECT_ID}:${top.cardId}:${ids.length}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-085 隊員コード153 ショウ【日本刀】（NC）「このターン、OTまたはDAを持つすべての敵軍SユニットはBP-1000される。（BP0以下になったユニットは
// 撃破される）」（atwiki/page-1780）。BP は rules/xg2/xg2Fields.ts xg2FieldBpBonus。BP0 以下の撃破はルールの撃破（core/applyAction.ts）。

function applyNihonto(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: addTurnEntry(state, XG2_NIHONTO_KEY, ctx.playerId, ctx.triggerSourceInstanceId ?? "XG2-085"), detail: "xg2_085_nihonto" };
}

// ---------------------------------------------------------------------------
// XG2-086 ハイパーショウ【ドラムガンファイヤー】（NC）「敵軍バトルエリアから、OTまたはDAを持つユニットを1体選び、持ち主のゾーンに置いてもよい。」
// （atwiki/page-97）。サイズを問わない。行き先は持ち主のゾーン（パワーゾーンかコマンドゾーン。questions Q1）。

const DRUM_EFFECT_ID = "xg2_086_drum_gun_fire";

function applyDrum(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-086", (c) => categoriesNow(state, enemyId, c).some((cat) => cat === "OT" || cat === "DA"), "battle"));
  if (ids.length === 0) return { state, detail: "xg2_086:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-086", DRUM_EFFECT_ID, ids, true)), detail: DRUM_EFFECT_ID };
}

registerXg2Choice(DRUM_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    return { state: xg2PutInOwnersZone(state, pending, opponent(playerId), instanceId), log: logFor(state, playerId, "XG2-086", `${DRUM_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-087 ゴールドプラチナム【エネルギー照射】「これをラッシュしたとき、自軍山札を見て、カテゴリを2つ以上持つSユニットのカードを1枚選び、
// 自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。」（atwiki/page-1781）。
// 効果のラッシュ（R-RUSH-21。rules/effectRush.ts）。

function applyEnergy(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const deck = state.players[ctx.playerId].deck;
  const candidates = deck
    .filter((c) => isUnit(state, c.cardId) && unitSizeOf(state.definitions, c) === "S" && printedCategories(state, c.cardId).length >= 2)
    .map((c) => c.instanceId);
  let next = startEffectRush(state, {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    effectId: "xg2_087_energy",
    sourceCardId: "XG2-087",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    fromZone: "deck",
    candidates,
    maxCount: 1,
    requireConditions: true,
    alwaysAsk: true,
  });
  next = patchPlayer(next, ctx.playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return { state: next, detail: "xg2_087_energy" };
}

// ---------------------------------------------------------------------------
// XG2-089 機動刑事ジバン【ジバンエンド】（RC）「DAを持つ敵軍Sユニットを1体選び、持ち主のコマンドゾーンに置く。置けなければ捨札にする。」
// （atwiki/page-134）。エリアを問わない。強制。コマンドゾーンにはリリース状態で置く。

const JIBAN_END_EFFECT_ID = "xg2_089_jiban_end";

function applyJibanEnd(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-089", (c) => rk1IsSmallNow(state, c) && categoriesNow(state, enemyId, c).includes("DA")));
  if (ids.length === 0) return { state, detail: "xg2_089:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-089", JIBAN_END_EFFECT_ID, ids, false)), detail: JIBAN_END_EFFECT_ID };
}

registerXg2Choice(JIBAN_END_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = toCommandOrDiscard(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, false);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-089", `${JIBAN_END_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-090 レゾン【第六世代コンピューター】「これが自軍バトルエリアにあり、ユニットにライドされていなければ、敵軍ターン中、自軍バトルエリアのSユニットが
// ホールド状態になったとき、そのユニットをこのビークルにライドさせてから、ラッシュエリアに戻してもよい。」（atwiki/page-1811）。
// ライドさせられるのは RC を持つユニットだけ（Q1）。ホールド状態になったアクションのあと（xg2 の afterAction）に選択を開く。

const COMPUTER_EFFECT_ID = "xg2_090_computer";

type ComputerMeta = { vehicleId: string };

xg2Hook("afterAction", (before, after) => {
  let next = after;
  for (const playerId of ["player1", "player2"] as const) {
    if (turnPlayerOf(after) === playerId) continue;
    const vehicle = after.players[playerId].battle.find((c) => isSameCardIdentity(c.cardId, "XG2-090") && !dolRidden(after, playerId, c));
    if (!vehicle) continue;
    const wasReleased = new Set(before.players[playerId].battle.filter((c) => !c.commandHeld).map((c) => c.instanceId));
    const ids = sortedIds(
      after.players[playerId].battle.filter(
        (c) =>
          c.commandHeld &&
          wasReleased.has(c.instanceId) &&
          !c.mountedOnInstanceId &&
          isUnit(after, c.cardId) &&
          rk1IsSmallNow(after, c) &&
          defOf(after, c.cardId)?.comboNumber === "RC",
      ),
    );
    if (ids.length === 0) continue;
    next = openAfter(next, selectOne({ playerId, phasePlayerId: turnPlayerOf(after), sourceInstanceId: vehicle.instanceId }, "XG2-090", COMPUTER_EFFECT_ID, ids, true, { xg2Meta: { vehicleId: vehicle.instanceId } satisfies ComputerMeta }));
  }
  return next;
});

registerXg2Choice(COMPUTER_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const { vehicleId } = metaOf<ComputerMeta>(pending);
    const p = state.players[playerId];
    const unit = p.battle.find((c) => c.instanceId === instanceId);
    const vehicle = p.battle.find((c) => c.instanceId === vehicleId);
    if (!unit || !vehicle) return { error: "invalid_target" };
    const next = patchPlayer(close(state, pending), playerId, (pl) => ({
      ...pl,
      battle: pl.battle.filter((c) => c.instanceId !== instanceId && c.instanceId !== vehicleId),
      rush: [...pl.rush, vehicle, { ...unit, mountedOnInstanceId: vehicleId }],
    }));
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-090", `${COMPUTER_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-092 ナイトファイヤー【パイルトルネード】（NC）「「SP1」相手は自分自身のユニットを1体選び、自分自身のコマンドゾーンにホールド状態で置く。
// 置けなければ捨札にする。（この効果は、ライドオフしたときナンバーに関係なく発動する）」（atwiki/page-132）。サイズ・エリアを問わない。強制。
// ライドオフしたときは DSL の riding_combo（本文の但し書きで nc の効果をライドオフでも使う。dsl/effectLookup.ts）。

const PILE_EFFECT_ID = "xg2_092_pile_tornado";

function applyPile(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(
    fieldUnits(state, enemyId).filter((c) => !xg2ActsAsVehicle(state.players[enemyId], c) && selectableOwnByEnemyEffect(state, enemyId, ctx.playerId, "XG2-092", c)),
  );
  if (ids.length === 0) return { state, detail: "xg2_092:no_targets" };
  return {
    state: openAfter(state, selectOne({ playerId: enemyId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctx.triggerSourceInstanceId }, "XG2-092", PILE_EFFECT_ID, ids, false)),
    detail: PILE_EFFECT_ID,
  };
}

registerXg2Choice(PILE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = toCommandOrDiscard(close(state, pending), playerId, instanceId, pending.phasePlayerId, true);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-092", `${PILE_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-095 ブラックビート【スティンガービュート】（NC）「敵軍バトルエリアから、「BP」「必要パワーの数字」「ナンバーの数字」の3つのうちのいずれかの値が、
// このユニットよりも低いユニットを1体選び撃破してもよい。そうして撃破したユニットの3つの値すべてがこのユニットよりも低かったなら、相手に1点ダメージを
// 与える。」（atwiki/page-152）。BP は今の BP。ナンバーがない（数字でない）値は比べられないので「低い」とはしない（コメント欄）。

const STINGER_EFFECT_ID = "xg2_095_stinger_whip";

type StingerValues = { bp: number; cost: number; number: number };

function stingerValues(state: GameState, ownerId: PlayerId, card: CardInstance): StingerValues {
  const n = defOf(state, card.cardId)?.comboNumber;
  return { bp: effectiveBp(state, ownerId, card), cost: costNumber(state, card.cardId), number: typeof n === "number" ? n : Number.NaN };
}

function lowerCount(target: StingerValues, self: StingerValues): number {
  return (["bp", "cost", "number"] as const).filter((k) => Number.isFinite(target[k]) && Number.isFinite(self[k]) && target[k] < self[k]).length;
}

function applyStinger(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId ? findField(state, ctx.playerId, ctx.triggerSourceInstanceId) : undefined;
  if (!self) return { state, detail: "xg2_095:no_source" };
  const enemyId = opponent(ctx.playerId);
  const mine = stingerValues(state, ctx.playerId, self);
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-095", (c) => lowerCount(stingerValues(state, enemyId, c), mine) > 0, "battle"));
  if (ids.length === 0) return { state, detail: "xg2_095:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-095", STINGER_EFFECT_ID, ids, true, { xg2Meta: { self: mine } })), detail: STINGER_EFFECT_ID };
}

registerXg2Choice(STINGER_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const target = findField(state, enemyId, instanceId);
    if (!target) return { error: "invalid_target" };
    const all = lowerCount(stingerValues(state, enemyId, target), metaOf<{ self: StingerValues }>(pending).self) === 3;
    let next = destroyAll(close(state, pending), pendingBase(pending), "XG2-095", `${STINGER_EFFECT_ID}_destroy`, [instanceId]);
    if (all) next = applyDamageToPlayer(next, enemyId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-095", `${STINGER_EFFECT_ID}:${instanceId}${all ? ":damage" : ""}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-097 ビーファイターゲンジ【ライトニングキャノン】（NC）「自軍コマンドゾーンから、カテゴリを2つ以上持つカードを1枚選び、自分の手札に戻してもよい。
// そうしたとき、戻したカードの持つカテゴリと同じカテゴリを1つ以上持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-1783）。
// 撃破する敵軍 S ユニットのエリアは問わない。戻したら選ぶのは強制。

const CANNON_RETURN_EFFECT_ID = "xg2_097_lightning_cannon";
const CANNON_DESTROY_EFFECT_ID = "xg2_097_lightning_cannon_destroy";

function applyCannon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.filter((c) => printedCategories(state, c.cardId).length >= 2).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_097:no_commands" };
  return { state: openAfter(state, { ...selectOne(ctxBase(ctx), "XG2-097", CANNON_RETURN_EFFECT_ID, ids, true), kind: "select_command" }), detail: CANNON_RETURN_EFFECT_ID };
}

registerXg2Choice(CANNON_RETURN_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].command.find((c) => c.instanceId === instanceId);
    if (!card) return { error: "invalid_target" };
    const cats = printedCategories(state, card.cardId);
    const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
    const enemyId = opponent(playerId);
    const ids = sortedIds(enemyUnits(next, playerId, "XG2-097", (c) => rk1IsSmallNow(next, c) && categoriesNow(next, enemyId, c).some((cat) => cats.includes(cat))));
    const log = logFor(state, playerId, "XG2-097", `${CANNON_RETURN_EFFECT_ID}:${instanceId}`);
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG2-097", CANNON_DESTROY_EFFECT_ID, ids, false)), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(CANNON_DESTROY_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-097", `${CANNON_DESTROY_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-097", `${CANNON_DESTROY_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-099 カメロックSM（atwiki/page-1785）
// ※「これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「カメロック」のカードを1枚選び、自軍ラッシュエリアに出す。」強制。
// 【カメラズーカ】（NC）「「SP1」敵軍コマンドゾーンから、Sユニットのカードを1枚選んでもよい。そうしたとき、次の相手のターン、選んだカードは
// リリースできない。」リリースできないのは rules/xg2/xg2Fields.ts xg2BlocksRelease（rules/startPhase.ts releaseAllCommands）。

const KAMEROCK_EFFECT_ID = "xg2_099_kamerock_return";
const ZOOKA_EFFECT_ID = "xg2_099_camera_zooka";

function applyKamerockReturn(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const p = state.players[ctx.playerId];
  const named = (c: CardInstance) => !c.faceDown && isUnit(state, c.cardId) && cardName(state.definitions, c.cardId) === "カメロック";
  const ids = [...p.command.filter(named), ...p.discard.filter(named)].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_099:no_kamerock" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-099", KAMEROCK_EFFECT_ID, ids, false)), detail: KAMEROCK_EFFECT_ID };
}

registerXg2Choice(KAMEROCK_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const p = state.players[playerId];
    const from = p.command.some((c) => c.instanceId === instanceId) ? "command" : p.discard.some((c) => c.instanceId === instanceId) ? "discard" : null;
    if (!from) return { error: "invalid_target" };
    return { state: effectRushPicked(state, pending, playerId, instanceId, from), log: logFor(state, playerId, "XG2-099", `${KAMEROCK_EFFECT_ID}:${instanceId}`) };
  },
});

function applyZooka(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].command.filter((c) => isUnit(state, c.cardId) && unitSizeOf(state.definitions, c) === "S").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_099:no_targets" };
  return { state: openAfter(state, { ...selectOne(ctxBase(ctx), "XG2-099", ZOOKA_EFFECT_ID, ids, true), kind: "select_command" }), detail: ZOOKA_EFFECT_ID };
}

registerXg2Choice(ZOOKA_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    // 「次の相手のターン」: 相手のターン（このターンの次のターン）の記録。
    const next = addTurnEntry(close(state, pending), XG2_ZOOKA_KEY, opponent(playerId), instanceId, state.turn + 1);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-099", `${ZOOKA_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-100 善と悪（常駐）「特徴「メカ」を持つユニットは次の能力を得る⇒自分自身のターン中、これがバトルエリアに出たとき、自分自身の山札の上から1枚を
// オモテにする。オモテにしたカードがユニットカードなら、このターン、これは特徴「男」または「女」を持つユニットにアタックできない。その後、オモテにした
// カードは、山札の下に戻す。」（atwiki/page-52）。能力を得るのは自軍のユニットだけ（ユーザー決定 2026-10-19）。強制。
// アタックできないのは rules/xg2/xg2Fields.ts xg2DefenderBlocksAttack。

xg2Hook("comboEnter", (state, playerId, card) => {
  if (!ownTurn(state, playerId)) return state;
  if (!state.players[playerId].operation.some((c) => isSameCardIdentity(c.cardId, "XG2-100"))) return state;
  if (!isUnit(state, card.cardId) || !featuresNow(state, playerId, card).includes("メカ")) return state;
  const top = state.players[playerId].deck[0];
  if (!top) return state;
  let next = patchPlayer(state, playerId, (p) => ({ ...p, deck: [...p.deck.slice(1), top] }));
  if (isUnit(state, top.cardId)) next = addTurnEntry(next, XG2_ZENTOAKU_KEY, playerId, card.instanceId);
  return { ...next, log: [...next.log, logFor(state, playerId, "XG2-100", `xg2_100_reveal:${top.cardId}`)] };
});

// ---------------------------------------------------------------------------
// XG2-101 ハカイダー【ハカイダーショット】（RC）「敵軍バトルエリアから、特徴「メカ」を持つ、SユニットまたはMユニットを1体選び撃破してもよい。」
// （atwiki/page-1817）。

const HAKAIDER_EFFECT_ID = "xg2_101_hakaider_shot";

function applyHakaider(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(
    enemyUnits(state, ctx.playerId, "XG2-101", (c) => {
      const size = unitSizeOf(state.definitions, c);
      return (size === "S" || size === "M") && featuresNow(state, enemyId, c).includes("メカ");
    }, "battle"),
  );
  if (ids.length === 0) return { state, detail: "xg2_101:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-101", HAKAIDER_EFFECT_ID, ids, true)), detail: HAKAIDER_EFFECT_ID };
}

registerXg2Choice(HAKAIDER_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-101", `${HAKAIDER_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-101", `${HAKAIDER_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-102 キカイダー【デンジエンド】（RC）「特徴「メカ」または「人型」を持つ敵軍Sユニットを1体選び撃破してもよい。」（atwiki/page-1816）。
// エリアを問わない。※（DA のコマンドがないときのアタックの制限）は rules/xg2/xg2Fields.ts xg2DefenderBlocksAttack。

const DENJI_END_EFFECT_ID = "xg2_102_denji_end";

function applyDenjiEnd(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(
    enemyUnits(state, ctx.playerId, "XG2-102", (c) => {
      const features = featuresNow(state, enemyId, c);
      return rk1IsSmallNow(state, c) && (features.includes("メカ") || features.includes("人型"));
    }),
  );
  if (ids.length === 0) return { state, detail: "xg2_102:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-102", DENJI_END_EFFECT_ID, ids, true)), detail: DENJI_END_EFFECT_ID };
}

registerXg2Choice(DENJI_END_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-102", `${DENJI_END_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-102", `${DENJI_END_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-103 サイドマシーン【ドリル攻撃】「自軍ターン中、これがバトルエリアに出たとき、特徴を4つ以上持つ敵軍Sユニットを1体選び、持ち主のコマンドゾーンに
// ホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1812）。エリアを問わない。強制。ライドしたユニットと一緒に出たときも発動する
// （rules/xg2/xg2dEffects.ts の、ライドして出たビークルの「これがバトルエリアに出たとき」）。

const DRILL_EFFECT_ID = "xg2_103_drill";

function applyDrill(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_103:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(enemyUnits(state, ctx.playerId, "XG2-103", (c) => rk1IsSmallNow(state, c) && featuresNow(state, enemyId, c).length >= 4));
  if (ids.length === 0) return { state, detail: "xg2_103:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-103", DRILL_EFFECT_ID, ids, false)), detail: DRILL_EFFECT_ID };
}

registerXg2Choice(DRILL_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = toCommandOrDiscard(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, true);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-103", `${DRILL_EFFECT_ID}:${instanceId}`) };
  },
});

registerXg2MountedVehicleEnter("XG2-103", applyDrill);

// ---------------------------------------------------------------------------
// キーワードの登録

registerXg2Keyword("XG2-082::vehicle_unit", noop("xg2_082:continuous"));
registerXg2Keyword("XG2-082::dol_fire", noop("xg2_082:chase_ride"));
registerXg2Keyword("XG2-083::uchu_keiji_bp", noop("xg2_083:continuous"));
registerXg2Keyword("XG2-083::patrol", applyPatrol);
registerXg2Keyword("XG2-084::babylos_laser", applyLaser);
registerXg2Keyword("XG2-085::nihonto", applyNihonto);
registerXg2Keyword("XG2-086::drum_gun_fire", applyDrum);
registerXg2Keyword("XG2-087::energy", applyEnergy);
registerXg2Keyword("XG2-088::jiban_killer", noop("xg2_088:continuous"));
registerXg2Keyword("XG2-089::jiban_end", applyJibanEnd);
registerXg2Keyword("XG2-090::computer", noop("xg2_090:hold_trigger"));
registerXg2Keyword("XG2-092::pile_tornado", applyPile);
registerXg2Keyword("XG2-093::road_block", noop("xg2_093:continuous"));
registerXg2Keyword("XG2-095::stinger_whip", applyStinger);
registerXg2Keyword("XG2-097::lightning_cannon", applyCannon);
registerXg2Keyword("XG2-099::kamerock_return", applyKamerockReturn);
registerXg2Keyword("XG2-099::camera_zooka", applyZooka);
registerXg2Keyword("XG2-101::hakaider_shot", applyHakaider);
registerXg2Keyword("XG2-102::denji_end", applyDenjiEnd);
registerXg2Keyword("XG2-103::drill", applyDrill);
