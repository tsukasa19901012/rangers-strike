/**
 * クロスギャザー ザ・ベストパートナー XG7-024〜XG7-046（獣拳神サイダイン〜仮面ライダーオーズ・サゴーゾコンボ）のカード固有の効果（cardSpec XG7-024-046 の監査）。
 * 選択・キーワードは rules/xg7/xg7Registry.ts に登録し、入口は rules/xg7/xg7Effects.ts。継続効果の判定は rules/xg7/xg7Fields.ts。
 * 選択の組み立ては rules/rm/rm1Effects.ts の部品と rules/xg7/xg7aEffects.ts の共通部品を使う。
 */
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { commandCategoriesOf, cardName, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { buildLogEntry } from "../../log/formatLog";
import { drawOne, opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { listCardGrantKeywords } from "../../dsl/promotedKeywordBridge";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";
import { crossValueForCard } from "../../keywords/battleKeywords";
import { openEffectChoice } from "../pendingChoices";
import { sendFieldCardsToCommandOrDiscard } from "../fieldLeaveQueue";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { applyDamageToPlayer } from "../damagePayment";
import { recordReveal, revealedCards } from "../revealNotice";
import { resolveDeckBottomOrderPick, returnToDeckBottomInOrder } from "../deckBottomOrder";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  base,
  categoriesOf,
  close,
  ctxBase,
  destroyAll,
  effectRushPicked,
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
  shuffleDeck,
  simpleSkip,
  skipLog,
  stripForZone,
  zoneOfField,
  type BaseCtx,
} from "../rm/rm1Effects";
import { CHOICE_RESOLVERS, CHOICE_SKIPPERS, XG7_KEYWORDS, addFlag, costNumberOf, hasFlag, isCard, noop } from "./xg7Registry";
import { addTurnCross, boostBp, registerMultiPick, selectOne, selfUnit } from "./xg7aEffects";

// ---------------------------------------------------------------------------
// 共通

const NONE = "__none__";

export function areaCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function ownTurn(state: Pick<GameState, "activePlayer">, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** 選んだ1体を撃破する（汎用の撃破の処理を通す）。 */
function destroyOne(state: GameState, pending: PendingEffectChoice, instanceId: string): GameState {
  return proceed(destroyAll(close(state, pending), pendingBase(pending), pending.sourceCardId, `${pending.effectId}_destroy`, [instanceId]), pending);
}

/** 撃破の選択（1体）。 */
export function registerDestroyPick(effectId: string): void {
  CHOICE_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    return { state: destroyOne(state, pending, instanceId), log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${instanceId}`) };
  };
  CHOICE_SKIPPERS[effectId] = simpleSkip();
}

/** 場のカードをゲームから除外する（撃破ではない。ライドしているビークル等の関係は外す）。 */
function exileFieldCard(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const card = findField(state, ownerId, instanceId);
  if (!zone || !card) return state;
  return patchPlayer(state, ownerId, (p) => {
    const strip = (cards: CardInstance[]) =>
      cards.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    return { ...p, [zone]: strip(p[zone]), exile: [...(p.exile ?? []), stripForZone(card)], discard: [...p.discard, ...(card.stackedCards ?? []).map(stripForZone)] };
  });
}

export function setHeld(state: GameState, playerId: PlayerId, instanceId: string, held: boolean): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: held } : c));
    return { ...p, battle: set(p.battle), rush: set(p.rush), command: set(p.command) };
  });
}

export function setSpOverride(state: GameState, playerId: PlayerId, instanceId: string, sp: NonNullable<CardInstance["spOverride"]>): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, spOverride: sp } : c));
    return { ...p, battle: set(p.battle), rush: set(p.rush) };
  });
}

function hasCrossOne(card: CardInstance): boolean {
  return crossValueForCard(card.cardId) + (card.xg7Turn?.cross ?? 0) >= 1;
}

// ---------------------------------------------------------------------------
// XG7-024 獣拳神サイダイン
// ※「これをラッシュしたとき、自軍「ゲキチョッパー」があれば、自分は1枚ドローする。」
// 【獣力開花】「これが自軍エリアにある間、カード名に「サイダイ」を含まない、特徴「激気」を持つユニットは次の能力を得る⇒これがバトルエリアに出たとき、
//  自分自身の手札から、これの必要パワーの数字よりも必要パワーの数字が小さいWBのMユニットのカードを1枚選び、自分自身のラッシュエリアに出してもよい。」
// 能力を得るのは自軍・敵軍のユニット（「自分自身の」）。出すのは効果のラッシュ（必要パワー・追加条件は問わない）。

const BLOOM_EFFECT_ID = "xg7024_bloom";

function applyChopperDraw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const has = areaCards(state, ctx.playerId).some((c) => c.instanceId !== ctx.triggerSourceInstanceId && sameCardName(cardName(state.definitions, c.cardId), "ゲキチョッパー"));
  if (!has) return { state, detail: "xg7024:no_chopper" };
  return { state: patchPlayer(state, ctx.playerId, drawOne), detail: "xg7024:draw" };
}

function bloomCandidates(state: GameState, playerId: PlayerId, entered: CardInstance): string[] {
  const cost = costNumberOf(state, entered.cardId);
  if (!Number.isFinite(cost)) return [];
  return state.players[playerId].hand
    .filter((c) => {
      if (!isUnitCard(state, c.cardId) || unitSizeOf(state.definitions, c) !== "M" || !categoriesOf(state, c.cardId).includes("WB")) return false;
      const n = costNumberOf(state, c.cardId);
      return Number.isFinite(n) && n < cost;
    })
    .map((c) => c.instanceId);
}

function openBloom(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (cardName(state.definitions, card.cardId).includes("サイダイ") || !unitFeatures(state, playerId, card).includes("激気")) return state;
  const holders = (["player1", "player2"] as const).some((pid) => areaCards(state, pid).some((c) => isCard(c.cardId, "XG7-024")));
  if (!holders) return state;
  const ids = bloomCandidates(state, playerId, card);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId }, "XG7-024", BLOOM_EFFECT_ID, ids, true, { kind: "select_hand" }));
}

CHOICE_RESOLVERS[BLOOM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${BLOOM_EFFECT_ID}_rush`,
    sourceCardId: "XG7-024",
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "hand",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: false,
    ignorePowerCost: true,
    mandatory: true,
    forced: true,
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-024", `${BLOOM_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[BLOOM_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-025 ゴーオンシルバー×ゴーオンゴールド【正義のツバサ】
// 「これがアタックして敵軍ユニットを撃破したとき、そのユニットと隣り合うSユニットを1体選び撃破してもよい。（この効果はこれがウイングでアタックするとき
//  ナンバーに関係なく発動する）」ナンバーの減少は rules/xg7/xg7Fields.ts xg7ComboNumberDelta。
// NC（アタックするとき）か、これ自身のウイングのアタックでこのアタックの記録を残し、撃破したとき（rules/operationCounters.ts）に選択を開く。
// 隣り合うのは撃破される前の敵軍バトルエリアの並びで両隣。

const WINGS_FLAG = "xg7025_wings";
const WINGS_EFFECT_ID = "xg7025_wings";

function applyWings(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self || hasFlag(state, WINGS_FLAG, ctx.playerId, self)) return { state, detail: "xg7025:already" };
  return { state: addFlag(state, { key: WINGS_FLAG, playerId: ctx.playerId, instanceId: self }), detail: WINGS_FLAG };
}

function applyWingsWing(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self || zoneOfField(state, ctx.playerId, self) !== "rush") return { state, detail: "xg7025:not_wing" };
  return applyWings(state, ctx);
}

registerDestroyPick(WINGS_EFFECT_ID);

// ---------------------------------------------------------------------------
// XG7-037 仮面ライダーカイザ×仮面ライダーファイズ ※
// 「これがアタックして、BPの下三桁が500の敵軍Sユニットを撃破したとき、相手に1点ダメージを与える。」（バトルの BP で見る）

/** アタックして敵軍ユニットを撃破したとき（rules/operationCounters.ts resolveBattlePendingCore）。before はバトルの直前の state。 */
export function xg7bOnAttackWin(state: GameState, before: GameState, attackerId: PlayerId, attackerInstanceId: string, defenderOwner: PlayerId, defenderInstanceId: string, defenderBp: number): GameState {
  const attacker = findField(state, attackerId, attackerInstanceId);
  const defender = findField(before, defenderOwner, defenderInstanceId);
  if (!attacker || !defender || findField(state, defenderOwner, defenderInstanceId)) return state;
  let next = state;
  if (isCard(attacker.cardId, "XG7-037") && rk1IsSmallNow(before, defender) && defenderBp % 1000 === 500) {
    next = applyDamageToPlayer(next, defenderOwner, 1, { kind: "none", activePlayer: next.activePlayer });
  }
  if (isCard(attacker.cardId, "XG7-025") && hasFlag(next, WINGS_FLAG, attackerId, attacker.instanceId)) {
    const row = before.players[defenderOwner].battle;
    const at = row.findIndex((c) => c.instanceId === defenderInstanceId);
    const ids = [row[at - 1], row[at + 1]]
      .filter((c): c is CardInstance => !!c && at >= 0)
      .filter((c) => findField(next, defenderOwner, c.instanceId) && isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && selectableEnemy(next, attackerId, "XG7-025", c))
      .map((c) => c.instanceId);
    if (ids.length > 0) {
      next = openAfter(next, selectOne({ playerId: attackerId, phasePlayerId: next.activePlayer, sourceInstanceId: attacker.instanceId }, "XG7-025", WINGS_EFFECT_ID, ids, true));
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG7-026 ゴセイブラック×ゴセイイエロー【ランドコンビアタック】（NC）
// 「レジストを持つ敵軍Sユニットを1体選ぶか、レジストを持つ敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く。」（エリアを問わない。見送れない）

const LAND_COMBI_EFFECT_ID = "xg7026_land_combi";

function applyLandCombi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const units = fieldUnits(state, enemyId).filter((c) => rk1IsSmallNow(state, c) && cardHasRegisterKeyword(state, c.cardId, enemyId) && selectableEnemy(state, ctx.playerId, "XG7-026", c));
  const commands = state.players[enemyId].command.filter((c) => cardHasRegisterKeyword(state, c.cardId, enemyId));
  const ids = [...units, ...commands].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7026:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-026", LAND_COMBI_EFFECT_ID, ids, false)), detail: LAND_COMBI_EFFECT_ID };
}

/** コマンドゾーンのカードを持ち主のパワーゾーンにダメージ（ウラ向き）で置く。 */
function commandToDamage(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), power: [...p.power, { ...stripForZone(card), faceDown: true }], damage: p.damage + 1 };
  });
}

CHOICE_RESOLVERS[LAND_COMBI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  next = state.players[enemyId].command.some((c) => c.instanceId === instanceId)
    ? commandToDamage(next, enemyId, instanceId)
    : moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-026", `${LAND_COMBI_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG7-027 雷撃ディスク（カウンター。「ラッシュされたとき」の反応窓。rules/operationCounters.ts・core/applyAction.ts）
// 「敵軍Sユニットがラッシュされたとき発動できる⇒自軍ラッシュエリアから、MAを持つ自軍Sユニットを1体選ぶ。そうしたとき、選んだユニットより必要パワーの
//  数字が大きい、追加条件を持たない敵軍Sユニットを1体選び撃破する。」撃破はエリアを問わない（いまラッシュされたユニットも選べる。atwiki カード評価）。

const DISC_EFFECT_ID = "xg7027_raigeki_disc";
const DISC_DESTROY_EFFECT_ID = "xg7027_raigeki_disc_destroy";

export function isXg7bRushCounterCard(cardId: string): boolean {
  return isCard(cardId, "XG7-027");
}

/** 「敵軍Sユニットがラッシュされたとき」（ラッシュされたユニットの持ち主がラッシュしたプレイヤー）。 */
export function xg7bRushCounterConditionMet(state: GameState, rushed: CardInstance, rushedOwnerId: PlayerId, rusherId: PlayerId, userId?: PlayerId): boolean {
  // 「敵軍Sユニット」— 使う人から見て相手のユニット（RS-284【スワンウィング】で相手に出された自軍ユニットは対象外。swanWingCounters.test.ts）。
  if (userId !== undefined && rushedOwnerId === userId) return false;
  return rushedOwnerId === rusherId && isUnitCard(state, rushed.cardId) && rk1IsSmallNow(state, rushed);
}

export function applyXg7bRushCounter(state: GameState, playerId: PlayerId, counterInstanceId: string, phasePlayerId: PlayerId): { state: GameState; log: string } {
  const card = state.players[playerId].hand.find((c) => c.instanceId === counterInstanceId);
  if (!card) return { state, log: logFor(state, playerId, "XG7-027", "failed") };
  let next = patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== counterInstanceId), discard: [...p.discard, stripForZone(card)] }));
  const ids = next.players[playerId].rush.filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && categoriesOf(next, c.cardId).includes("MA")).map((c) => c.instanceId);
  if (ids.length > 0) next = openAfter(next, selectOne({ playerId, phasePlayerId, sourceInstanceId: counterInstanceId }, "XG7-027", DISC_EFFECT_ID, ids, false));
  return { state: next, log: buildLogEntry(playerId, "play_counter", card.cardId, state.definitions, DISC_EFFECT_ID) };
}

CHOICE_RESOLVERS[DISC_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const own = findField(state, playerId, instanceId);
  if (!own) return { error: "invalid_target" };
  const cost = costNumberOf(state, own.cardId);
  const next = close(state, pending);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => {
      const d = getDefinition(next.definitions, c.cardId);
      const n = costNumberOf(next, c.cardId);
      return !!d && rk1IsSmallNow(next, c) && Number.isFinite(n) && n > cost && !resolveRushAdditionalCondition(c.cardId, d) && selectableEnemy(next, playerId, "XG7-027", c);
    })
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG7-027", `${DISC_EFFECT_ID}:${cardName(state.definitions, own.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG7-027", DISC_DESTROY_EFFECT_ID, ids, false)), log };
};
registerDestroyPick(DISC_DESTROY_EFFECT_ID);

// ---------------------------------------------------------------------------
// XG7-028 ゴセイアルティメット【アルティメットストライク】（自軍ターン中、バトルエリアに出たとき）
// 「「自軍コマンドを1つリリースするか、自軍ユニットを1体リリースする」を1～5回実行してもよい。そうしたとき、実行した回数以下の必要パワーの数字を持つ
//  敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」
// リリースするホールド状態のコマンド・ユニットを5つまで選ぶ（選んだところで確定できる）。2つ目の選択はエリア・サイズを問わず、見送れない。

const ULTIMATE_EFFECT_ID = "xg7028_ultimate_strike";
const ULTIMATE_TARGET_EFFECT_ID = "xg7028_ultimate_strike_target";

function heldOwn(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  const p = state.players[playerId];
  return [...p.command, ...fieldUnits(state, playerId)].filter((c) => c.commandHeld && !exclude.includes(c.instanceId)).map((c) => c.instanceId);
}

function applyUltimateStrike(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg7028:not_own_turn" };
  const ids = heldOwn(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: "xg7028:no_held" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-028", ULTIMATE_EFFECT_ID, ids, true, { selectCount: 5, xg7Meta: { limit: 5 } })), detail: ULTIMATE_EFFECT_ID };
}

registerMultiPick(
  ULTIMATE_EFFECT_ID,
  (state, pending, selected) => heldOwn(state, pending.playerId, selected),
  (state, pending, selected) => {
    const playerId = pending.playerId;
    let next = close(state, pending);
    for (const id of selected) next = setHeld(next, playerId, id, false);
    const enemyId = opponent(playerId);
    const ids = fieldUnits(next, enemyId)
      .filter((c) => {
        const n = costNumberOf(next, c.cardId);
        return Number.isFinite(n) && n <= selected.length && selectableEnemy(next, playerId, "XG7-028", c);
      })
      .map((c) => c.instanceId);
    if (ids.length === 0) return proceed(next, pending);
    return openNext(next, pending, selectOne(pendingBase(pending), "XG7-028", ULTIMATE_TARGET_EFFECT_ID, ids, false));
  },
);

CHOICE_RESOLVERS[ULTIMATE_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-028", `${ULTIMATE_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG7-029 ゴセイアルティメットMM【アルティメットグレートストライク】
// 「カテゴリを2つ以上持つLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒ウイングを持たない敵軍ユニットを1体選び撃破する。」
// これの右にそのユニットがバトルエリアに出たとき（rules/combo.ts）。エリア・サイズを問わない。

const GREAT_STRIKE_EFFECT_ID = "xg7029_great_strike";

function openGreatStrike(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || !isCard(left.cardId, "XG7-029")) return state;
  if (unitSizeOf(state.definitions, card) !== "L" || unitEffectiveCategories(state, playerId, card, "battle").length < 2) return state;
  const enemyId = opponent(playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !cardHasKeyword(state.definitions, c.cardId, "wing", { state, playerId: enemyId }) && selectableEnemy(state, playerId, "XG7-029", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: left.instanceId }, "XG7-029", GREAT_STRIKE_EFFECT_ID, ids, true));
}

registerDestroyPick(GREAT_STRIKE_EFFECT_ID);

// ---------------------------------------------------------------------------
// XG7-030 ゴセイヘッダー（オペレーション）
// 「ウイング、タクス、レジスト、リードのどれかを持つ自軍ユニットを1体選ぶ。このターン、選んだユニットはBP+1000され、ホールド状態ならリリースする。
//  （これが自軍コマンドゾーンにある間、カード名に「ゴセイ」を含む自軍ユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、
//  このカードの効果を発動する）」

const HEADER_EFFECT_ID = "xg7030_header";
const HEADER_COMMAND_EFFECT_ID = "xg7030_header_command";

function hasHeaderKeyword(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (cardHasKeyword(state.definitions, card.cardId, "wing", { state, playerId })) return true;
  if (cardHasRegisterKeyword(state, card.cardId, playerId)) return true;
  return listCardGrantKeywords(card.cardId).some((k) => /^(taxis|lead)(_|$)/.test(k));
}

function headerCandidates(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => hasHeaderKeyword(state, playerId, c))
    .map((c) => c.instanceId);
}

function headerChoice(ctx: BaseCtx, ids: string[]): PendingEffectChoice {
  return selectOne(ctx, "XG7-030", HEADER_EFFECT_ID, ids, false);
}

function applyHeader(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = headerCandidates(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "xg7030:no_targets" };
  return { state: openAfter(state, headerChoice(ctxBase(ctx), ids)), detail: HEADER_EFFECT_ID };
}

CHOICE_RESOLVERS[HEADER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = boostBp(close(state, pending), playerId, instanceId, 1000);
  if (findField(next, playerId, instanceId)?.commandHeld) next = setHeld(next, playerId, instanceId, false);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-030", `${HEADER_EFFECT_ID}:${instanceId}`) };
};

function openHeaderFromCommand(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (!cardName(state.definitions, card.cardId).includes("ゴセイ")) return state;
  if (headerCandidates(state, playerId).length === 0) return state;
  let next = state;
  for (const cz of state.players[playerId].command.filter((c) => isCard(c.cardId, "XG7-030") && !c.commandHeld)) {
    next = openAfter(next, selectOne({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: cz.instanceId }, "XG7-030", HEADER_COMMAND_EFFECT_ID, [cz.instanceId], true));
  }
  return next;
}

CHOICE_RESOLVERS[HEADER_COMMAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cz = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (!cz || cz.commandHeld) return { state: proceed(next, pending) };
  next = setHeld(next, playerId, instanceId, true);
  const ids = headerCandidates(next, playerId);
  const log = logFor(state, playerId, "XG7-030", `${HEADER_COMMAND_EFFECT_ID}:hold`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, headerChoice(pendingBase(pending), ids)), log };
};
CHOICE_SKIPPERS[HEADER_COMMAND_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-032 仮面ライダー新2号×仮面ライダー新1号【ライダーダブルキック】（RC）
// 「SP1 このターン、これはBP+2000される。また、これがアタックするとき、バトル相手のユニットのBPをカードに表記された本来の値としてバトルし、
//  自分が次の行動を宣言するまで、すべての敵軍ユニットはホールドすることができない。」
// SP1・BP+2000 は DSL。アタックの部分はこのターンの記録で見る（rules/xg7/xg7Fields.ts xg7UsePrintedDefenderBp・xg7BlocksResist）。

const DOUBLE_KICK_FLAG = "xg7032_double_kick";

function applyDoubleKick(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self) return { state, detail: "xg7032:no_self" };
  return { state: addFlag(state, { key: DOUBLE_KICK_FLAG, playerId: ctx.playerId, instanceId: self }), detail: DOUBLE_KICK_FLAG };
}

// ---------------------------------------------------------------------------
// XG7-033 仮面ライダーV3×ライダーマン【復讐の果てに得たもの】
// 「これが自軍バトルエリアからラッシュエリアに戻ったとき、これをホールドしてもよい。そうしたとき、敵軍ラッシュエリアからユニットを1体選び、
//  可能ならバトルエリアに出す。」（スタートフェイズに戻ったとき。rules/startPhase.ts）。サイズを問わない。

const REVENGE_EFFECT_ID = "xg7033_revenge";
const REVENGE_TARGET_EFFECT_ID = "xg7033_revenge_target";

export function isXg7bBattleToRushTrigger(card: CardInstance): boolean {
  return isCard(card.cardId, "XG7-033");
}

export function tryXg7bBattleToRush(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  if (!isCard(card.cardId, "XG7-033") || card.commandHeld) return state;
  if (!state.players[playerId].rush.some((c) => c.instanceId === card.instanceId)) return state;
  return openAfter(state, selectOne({ playerId, phasePlayerId, sourceInstanceId: card.instanceId }, "XG7-033", REVENGE_EFFECT_ID, [card.instanceId], true));
}

CHOICE_RESOLVERS[REVENGE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = setHeld(close(state, pending), playerId, instanceId, true);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].rush.filter((c) => isUnitCard(next, c.cardId) && selectableEnemy(next, playerId, "XG7-033", c)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG7-033", `${REVENGE_EFFECT_ID}:hold`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG7-033", REVENGE_TARGET_EFFECT_ID, ids, false)), log };
};
CHOICE_SKIPPERS[REVENGE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[REVENGE_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.rush.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const riders = p.rush.filter((c) => c.mountedOnInstanceId === instanceId);
    const moving = new Set([instanceId, ...riders.map((c) => c.instanceId)]);
    return { ...p, rush: p.rush.filter((c) => !moving.has(c.instanceId)), battle: [...p.battle, card, ...riders] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-033", `${REVENGE_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG7-035 ヨロイ騎士【結束するデルザー改造魔人】（NC）
// 「自軍捨札を1枚選び、ゲームから除外してもよい。そうしたとき、このターン、これはクロス1を得る。その後、クロス1を持つ敵軍Sユニットを1体選び撃破する。」
// 撃破はエリアを問わず、見送れない。

const DELZER_EFFECT_ID = "xg7035_delzer";
const DELZER_DESTROY_EFFECT_ID = "xg7035_delzer_destroy";

function applyDelzer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7035:no_discard" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-035", DELZER_EFFECT_ID, ids, true, { kind: "select_discard" as PendingEffectChoice["kind"] })), detail: DELZER_EFFECT_ID };
}

CHOICE_RESOLVERS[DELZER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), exile: [...(p.exile ?? []), stripForZone(card)] }));
  if (pending.sourceInstanceId && findField(next, playerId, pending.sourceInstanceId)) next = addTurnCross(next, playerId, pending.sourceInstanceId, 1);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => rk1IsSmallNow(next, c) && hasCrossOne(c) && selectableEnemy(next, playerId, "XG7-035", c))
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG7-035", `${DELZER_EFFECT_ID}:exile:${cardName(state.definitions, card.cardId)}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG7-035", DELZER_DESTROY_EFFECT_ID, ids, false)), log };
};
CHOICE_SKIPPERS[DELZER_EFFECT_ID] = simpleSkip();
registerDestroyPick(DELZER_DESTROY_EFFECT_ID);

// ---------------------------------------------------------------------------
// XG7-036 仮面ライダーナイト×仮面ライダー龍騎【戦わなければ生き残れない】（場の起動型の能力。rules/fieldActivatedAbilities.ts）
// 「これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、SP1/2、コールWB、リードWB、クロス1のどれか1つを宣言してもよい。そうしたとき、
//  このターン、これは宣言した能力を得る。」
// 宣言できるのは SP1/2（このターンの SP の指定値）とクロス1（このターン得たクロス）。コールWB・リードWB をユニットに与える仕組みがまだない
// （docs/verification/unverified/XG7-judgments.md）。

const DECLARE_EFFECT_ID = "xg7036_declare";
const DECLARE_SP = "sp_1_2";
const DECLARE_CROSS = "cross1";

export function isXg7bFieldAbilityCard(cardId: string): boolean {
  return isCard(cardId, "XG7-036");
}

export function canActivateXg7bFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return isCard(card.cardId, "XG7-036") && state.phase === "rush" && ownTurn(state, playerId);
}

export function activateXg7bFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return openEffectChoice(state, {
    ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG7-036"),
    effectId: DECLARE_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [DECLARE_SP, DECLARE_CROSS],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[DECLARE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  if (selfId && findField(next, playerId, selfId)) {
    next = instanceId === DECLARE_SP ? setSpOverride(next, playerId, selfId, "1/2") : addTurnCross(next, playerId, selfId, 1);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-036", `${DECLARE_EFFECT_ID}:${instanceId}`) };
};
CHOICE_SKIPPERS[DECLARE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-037 仮面ライダーカイザ×仮面ライダーファイズ【紅と金】（自軍ターン中、バトルエリアに出たとき）
// 「次の効果を2回まで発動できる⇒自分の手札を1枚選び、自軍コマンドゾーンにホールド状態で置く。そうしたとき、敵軍ユニットを1体選び、このターン、
//  BP-1500する。」2回目は「発動しない」（__none__）も選べる。敵軍ユニットはエリア・サイズを問わず、見送れない。

const RED_GOLD_EFFECT_ID = "xg7037_red_gold";
const RED_GOLD_TARGET_EFFECT_ID = "xg7037_red_gold_target";
const COMMAND_ZONE_MAX = 5;

function redGoldChoice(state: GameState, ctx: BaseCtx, round: number): PendingEffectChoice | null {
  const p = state.players[ctx.playerId];
  if (p.hand.length === 0 || p.command.length >= COMMAND_ZONE_MAX) return null;
  const ids = p.hand.map((c) => c.instanceId);
  return selectOne(ctx, "XG7-037", RED_GOLD_EFFECT_ID, round > 1 ? [...ids, NONE] : ids, true, { kind: "select_hand", xg7Meta: { remaining: 2 - round } });
}

function applyRedGold(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg7037:not_own_turn" };
  const choice = redGoldChoice(state, ctxBase(ctx), 1);
  if (!choice) return { state, detail: "xg7037:no_hand" };
  return { state: openAfter(state, choice), detail: RED_GOLD_EFFECT_ID };
}

CHOICE_RESOLVERS[RED_GOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (instanceId === NONE) return { state: proceed(next, pending), log: skipLog(state, playerId, "XG7-037", RED_GOLD_EFFECT_ID) };
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), command: [...p.command, { ...stripForZone(card), commandHeld: true }] }));
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => selectableEnemy(next, playerId, "XG7-037", c)).map((c) => c.instanceId);
  const remaining = pending.xg7Meta?.remaining ?? 0;
  const log = logFor(state, playerId, "XG7-037", `${RED_GOLD_EFFECT_ID}:command`);
  const again = remaining > 0 ? redGoldChoice(next, pendingBase(pending), 2) : null;
  const resumed = again ? { ...pending, resumeChoice: pending.resumeChoice ? { ...again, resumeChoice: pending.resumeChoice } : again } : pending;
  if (ids.length === 0) return { state: proceed(next, resumed), log };
  return { state: openNext(next, resumed, selectOne(pendingBase(pending), "XG7-037", RED_GOLD_TARGET_EFFECT_ID, ids, false)), log };
};
CHOICE_SKIPPERS[RED_GOLD_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[RED_GOLD_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = boostBp(close(state, pending), opponent(playerId), instanceId, -1500);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG7-037", `${RED_GOLD_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG7-038 仮面ライダーギャレン×仮面ライダーブレイド【ライトニングブラスト&バーニングスマッシュ】（自軍ターン中、バトルエリアに出たとき）
// 「自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードのカテゴリが同じなら、
//  敵軍Sユニットを1体選び撃破する。」ホールド・撃破ともエリアを問わない。カテゴリが同じ＝2枚が同じカテゴリを持つ。

const BLAST_EFFECT_ID = "xg7038_blast";
const BLAST_HOLD_EFFECT_ID = "xg7038_blast_hold";
const BLAST_DESTROY_EFFECT_ID = "xg7038_blast_destroy";

function applyBlast(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg7038:not_own_turn" };
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "xg7038:no_hand" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-038", BLAST_EFFECT_ID, ids, true, { kind: "select_hand", selectCount: 2, xg7Meta: { limit: 2 } })), detail: BLAST_EFFECT_ID };
}

function enemySmall(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId).filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "XG7-038", c)).map((c) => c.instanceId);
}

registerMultiPick(
  BLAST_EFFECT_ID,
  (state, pending, selected) => state.players[pending.playerId].hand.map((c) => c.instanceId).filter((id) => !selected.includes(id)),
  (state, pending, selected) => {
    const playerId = pending.playerId;
    let next = close(state, pending);
    if (selected.length < 2) return proceed(next, pending);
    const cards = state.players[playerId].hand.filter((c) => selected.includes(c.instanceId));
    next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG7-038", effectLabel: "ライトニングブラスト&バーニングスマッシュ", from: "hand", cards: revealedCards(cards, "stay") });
    const [a, b] = cards.map((c) => categoriesOf(state, c.cardId));
    const same = !!a && !!b && a.some((cat) => b.includes(cat));
    const ids = enemySmall(next, playerId);
    if (ids.length === 0) return proceed(next, pending);
    return openNext(next, pending, selectOne(pendingBase(pending), "XG7-038", BLAST_HOLD_EFFECT_ID, ids, false, { xg7Meta: { tags: same ? ["same"] : [] } }));
  },
);

CHOICE_RESOLVERS[BLAST_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = setHeld(close(state, pending), opponent(playerId), instanceId, true);
  const log = logFor(state, playerId, "XG7-038", `${BLAST_HOLD_EFFECT_ID}:${instanceId}`);
  if (!(pending.xg7Meta?.tags ?? []).includes("same")) return { state: proceed(next, pending), log };
  const ids = enemySmall(next, playerId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG7-038", BLAST_DESTROY_EFFECT_ID, ids, false)), log };
};
registerDestroyPick(BLAST_DESTROY_EFFECT_ID);

// ---------------------------------------------------------------------------
// XG7-039 GOD SPEED LOVE（常駐。rules/permanentOperation.ts）
// 「自軍ラッシュフェイズごとに1度だけ、『特徴「加速」を持つ自軍ユニット1体をゲームから除外する』を実行してもよい。そうしたとき、次の効果を自分、
//  相手の順に行う⇒自分自身のパワーゾーンのカードを（ウラ向きのカードはウラ向きのまま）1枚選び、オモテにするか手札に戻す。」
// 選んだカードの後に「オモテにする（faceup）」「手札に戻す（hand）」を選ぶ（オモテ向きのカードは手札に戻すだけ）。

const GSL_EXILE_EFFECT_ID = "xg7039_exile";
const GSL_POWER_EFFECT_ID = "xg7039_power";
const GSL_MODE_EFFECT_ID = "xg7039_mode";
const MODE_FACEUP = "faceup";
const MODE_HAND = "hand";

function accelUnits(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId).filter((c) => unitFeatures(state, playerId, c).includes("加速")).map((c) => c.instanceId);
}

export function isXg7bActivatableResident(cardId: string): boolean {
  return isCard(cardId, "XG7-039");
}

export function canActivateXg7bResident(state: GameState, playerId: PlayerId, op: CardInstance): boolean | null {
  if (!isXg7bActivatableResident(op.cardId)) return null;
  if (state.phase !== "rush" || !ownTurn(state, playerId) || op.residentActivatedThisRush || op.faceDown) return false;
  return accelUnits(state, playerId).length > 0;
}

export function activateXg7bResident(state: GameState, playerId: PlayerId, op: CardInstance): GameState {
  return openEffectChoice(state, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: op.instanceId }, "XG7-039", GSL_EXILE_EFFECT_ID, accelUnits(state, playerId), true));
}

function gslPowerChoice(state: GameState, chooser: PlayerId, pending: PendingEffectChoice, owner: PlayerId): PendingEffectChoice | null {
  const ids = state.players[chooser].power.map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return selectOne({ playerId: chooser, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG7-039", GSL_POWER_EFFECT_ID, ids, false, { kind: "select_power", xg7Meta: { owner } });
}

/** 自分の次は相手（相手の選択がなければ終わる）。 */
function gslNext(state: GameState, pending: PendingEffectChoice): GameState {
  const owner = pending.xg7Meta?.owner ?? pending.playerId;
  if (pending.playerId !== owner) return proceed(state, pending);
  const enemy = gslPowerChoice(state, opponent(owner), pending, owner);
  return enemy ? openNext(state, pending, enemy) : proceed(state, pending);
}

CHOICE_RESOLVERS[GSL_EXILE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = exileFieldCard(close(state, pending), playerId, instanceId);
  next = patchPlayer(next, playerId, (p) => ({ ...p, operation: p.operation.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, residentActivatedThisRush: true } : c)) }));
  const log = logFor(state, playerId, "XG7-039", `${GSL_EXILE_EFFECT_ID}:${instanceId}`);
  const own = gslPowerChoice(next, playerId, pending, playerId);
  if (own) return { state: openNext(next, pending, own), log };
  return { state: gslNext(next, { ...pending, xg7Meta: { owner: playerId } }), log };
};
CHOICE_SKIPPERS[GSL_EXILE_EFFECT_ID] = simpleSkip();

CHOICE_RESOLVERS[GSL_POWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const modes = card.faceDown ? [MODE_FACEUP, MODE_HAND] : [MODE_HAND];
  return {
    state: openNext(close(state, pending), pending, selectOne(pendingBase(pending), "XG7-039", GSL_MODE_EFFECT_ID, modes, false, { xg7Meta: { ...pending.xg7Meta, target: instanceId } })),
  };
};

CHOICE_RESOLVERS[GSL_MODE_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.xg7Meta?.target;
  const card = state.players[playerId].power.find((c) => c.instanceId === target);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, playerId, (p) =>
      mode === MODE_FACEUP
        ? { ...p, power: p.power.map((c) => (c.instanceId === card.instanceId ? { ...c, faceDown: false } : c)), damage: card.faceDown ? Math.max(0, p.damage - 1) : p.damage }
        : { ...p, power: p.power.filter((c) => c.instanceId !== card.instanceId), hand: [...p.hand, stripForZone(card)], damage: card.faceDown ? Math.max(0, p.damage - 1) : p.damage },
    );
  }
  return { state: gslNext(next, pending), log: logFor(state, playerId, "XG7-039", `${GSL_MODE_EFFECT_ID}:${mode}`) };
};

// ---------------------------------------------------------------------------
// XG7-040 仮面ライダー電王LF×モモタロス【ダブルアクション】（手札。rules/combo.ts）
// 「これが自分の手札にある間、敵軍ユニットがバトルエリアに出たとき、自軍ユニットが1体もなければ、OTの自軍コマンドを2つホールドしてから、これを
//  自軍バトルエリアに出してもよい。そうしたとき、敵軍バトルエリアのSユニットをすべて持ち主のパワーゾーンに送る。」
// ホールドするのはリリース状態の OT のコマンド（3つ以上あれば2つ選ぶ）。

const DOUBLE_ACTION_EFFECT_ID = "xg7040_double_action";
const DOUBLE_ACTION_COST_EFFECT_ID = "xg7040_double_action_cost";

function releasedOt(state: GameState, playerId: PlayerId, exclude: string[] = []): string[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld && commandCategoriesOf(state, playerId, c.cardId).includes("OT") && !exclude.includes(c.instanceId)).map((c) => c.instanceId);
}

function openDoubleAction(state: GameState, enteredOwner: PlayerId): GameState {
  const holder = opponent(enteredOwner);
  if (fieldUnits(state, holder).length > 0 || releasedOt(state, holder).length < 2) return state;
  let next = state;
  for (const card of state.players[holder].hand.filter((c) => isCard(c.cardId, "XG7-040"))) {
    next = openAfter(next, selectOne({ playerId: holder, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId }, "XG7-040", DOUBLE_ACTION_EFFECT_ID, [card.instanceId], true, { kind: "select_hand" }));
  }
  return next;
}

function deployDoubleAction(state: GameState, pending: PendingEffectChoice, commandIds: string[]): GameState {
  const playerId = pending.playerId;
  const selfId = pending.sourceInstanceId;
  const card = state.players[playerId].hand.find((c) => c.instanceId === selfId);
  let next = close(state, pending);
  if (!card || commandIds.length < 2) return proceed(next, pending);
  for (const id of commandIds) next = setHeld(next, playerId, id, true);
  next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== card.instanceId), battle: [...p.battle, stripForZone(card)] }));
  const enemyId = opponent(playerId);
  for (const unit of next.players[enemyId].battle.filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c))) {
    next = moveFieldUnit(next, enemyId, unit.instanceId, pending.phasePlayerId, "power");
  }
  return proceed(next, pending);
}

CHOICE_RESOLVERS[DOUBLE_ACTION_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  if (fieldUnits(state, playerId).length > 0) return { state: proceed(close(state, pending), pending) };
  const ids = releasedOt(state, playerId);
  const log = logFor(state, playerId, "XG7-040", `${DOUBLE_ACTION_EFFECT_ID}:deploy`);
  if (ids.length <= 2) return { state: deployDoubleAction(state, pending, ids), log };
  return { state: openNext(close(state, pending), pending, selectOne(pendingBase(pending), "XG7-040", DOUBLE_ACTION_COST_EFFECT_ID, ids, false, { selectCount: 2, xg7Meta: { limit: 2 } })), log };
};
CHOICE_SKIPPERS[DOUBLE_ACTION_EFFECT_ID] = simpleSkip();

registerMultiPick(
  DOUBLE_ACTION_COST_EFFECT_ID,
  (state, pending, selected) => releasedOt(state, pending.playerId, selected),
  (state, pending, selected) => deployDoubleAction(state, pending, selected),
);

// ---------------------------------------------------------------------------
// XG7-041 仮面ライダーW・CJGX
// ※「これが自軍エリアにある間、自分がターンを終えるとき、これをゲームから除外する。」（rules/turnEndingEffects.ts）
// 【黄金の希望】「これを手札からラッシュしたとき、自軍コマンドをすべて捨札にする。そうしたとき、捨札にしたコマンドと同じカテゴリを持つ敵軍Sユニットを
//  すべて撃破する。その後、自軍捨札が敵軍捨札より多ければ、これはSP2になる。」（エリアを問わない。捨札の枚数は解決するときに数える。atwiki Q1）

function applyGoldenHope(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = selfUnit(state, ctx);
  const commands = state.players[ctx.playerId].command;
  if (!self || commands.length === 0) return { state, detail: "xg7041:no_commands" };
  let next = patchPlayer(state, ctx.playerId, (p) => ({ ...p, command: [], discard: [...p.discard, ...p.command.map(stripForZone)] }));
  const cats = new Set(commands.flatMap((c) => commandCategoriesOf(state, ctx.playerId, c.cardId)));
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => {
      const zone = zoneOfField(next, enemyId, c.instanceId) ?? "battle";
      return rk1IsSmallNow(next, c) && unitEffectiveCategories(next, enemyId, c, zone).some((cat) => cats.has(cat));
    })
    .map((c) => c.instanceId);
  next = destroyAll(next, ctxBase(ctx), "XG7-041", "xg7041_golden_hope_destroy", ids);
  if (next.players[ctx.playerId].discard.length > next.players[enemyId].discard.length && findField(next, ctx.playerId, self.instanceId)) {
    next = setSpOverride(next, ctx.playerId, self.instanceId, 2);
  }
  return { state: next, detail: `xg7041:golden_hope:${ids.length}` };
}

// ---------------------------------------------------------------------------
// XG7-042 仮面ライダークウガ×仮面ライダーディケイド【ライダー大戦の世界】（自分がターンを終えるとき。rules/turnEndingEffects.ts）
// 「次の効果を発動できる⇒自軍山札の上から5枚をオモテにして、その中から1枚を選び手札に加える。その後、残りのカードとこのユニットを好きな順で
//  山札の下に戻す。」選ぶ選択を見送れば発動しない。手札に加えた後、残りのカードとこのユニットをいったん山札の下に置き（ユニットの離場はここで処理）、
//  2枚以上あれば山札の下に戻す順を1枚ずつ選ぶ（xg7042_rider_war_order。rules/deckBottomOrder.ts）。

const RIDER_WAR_EFFECT_ID = "xg7042_rider_war";
const RIDER_WAR_ORDER_EFFECT_ID = "xg7042_rider_war_order";

export function collectXg7bTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return areaCards(state, endingPlayerId)
    .filter((c) => isCard(c.cardId, "XG7-041") || isCard(c.cardId, "XG7-042"))
    .map((c) => `${isCard(c.cardId, "XG7-041") ? "exile" : "search"}:${c.instanceId}`);
}

export function openXg7bTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  if (!findField(state, endingPlayerId, instanceId)) return state;
  if (kind === "exile") {
    const next = exileFieldCard(state, endingPlayerId, instanceId);
    return { ...next, log: [...next.log, logFor(state, endingPlayerId, "XG7-041", "xg7041:exile")] };
  }
  const top = state.players[endingPlayerId].deck.slice(0, 5).map((c) => c.instanceId);
  if (top.length === 0) return state;
  return openEffectChoice(state, selectOne({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, "XG7-042", RIDER_WAR_EFFECT_ID, top, true));
}

CHOICE_RESOLVERS[RIDER_WAR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const p0 = state.players[playerId];
  const revealed = p0.deck.slice(0, 5);
  const picked = revealed.find((c) => c.instanceId === instanceId);
  if (!picked) return { error: "invalid_target" };
  const self = pending.sourceInstanceId ? findField(state, playerId, pending.sourceInstanceId) : undefined;
  let next = close(state, pending);
  next = recordReveal(next, {
    playerId,
    ownerId: playerId,
    sourceCardId: "XG7-042",
    effectLabel: "ライダー大戦の世界",
    from: "deck_top",
    cards: revealedCards(revealed, (c) => (c.instanceId === instanceId ? "hand" : "deck_bottom")),
  });
  const rest = revealed.filter((c) => c.instanceId !== instanceId);
  next = patchPlayer(next, playerId, (p) => ({ ...p, deck: [...p.deck.slice(revealed.length), ...rest], hand: [...p.hand, stripForZone(picked)] }));
  if (self) next = moveFieldUnit(next, playerId, self.instanceId, pending.phasePlayerId, "deck_bottom");
  const ids = [...rest.map((c) => c.instanceId), ...(self ? [self.instanceId] : [])];
  return {
    state: returnToDeckBottomInOrder(next, pending, RIDER_WAR_ORDER_EFFECT_ID, ids),
    log: logFor(state, playerId, "XG7-042", `${RIDER_WAR_EFFECT_ID}:${cardName(state.definitions, picked.cardId)}`),
  };
};
CHOICE_RESOLVERS[RIDER_WAR_ORDER_EFFECT_ID] = resolveDeckBottomOrderPick;
CHOICE_SKIPPERS[RIDER_WAR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "XG7-042", RIDER_WAR_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// XG7-043 仮面ライダーパンチホッパー×仮面ライダーキックホッパー【地獄の兄弟】（パワーゾーン。rules/operationCounters.ts finalizeLeavePending）
// 「これが自軍パワーゾーンにある間、敵軍ターン中、特徴「加速」を持つ自軍ユニットが撃破されて捨札になったとき、これを自軍ラッシュエリアに出してもよい。」
// オモテ向きのとき。出すのは効果のラッシュ（必要パワー・追加条件は問わない）。BP-6000・ストライク不可は rules/xg7/xg7Fields.ts。

const HELL_BROTHERS_EFFECT_ID = "xg7043_hell_brothers";

export function openXg7bAfterUnitLeft(state: GameState, before: GameState, intent: PendingLeave, card: CardInstance, toZone: string, destroyed: boolean): GameState {
  const ownerId = intent.ownerPlayerId;
  if (!destroyed || toZone !== "discard" || ownTurn(state, ownerId)) return state;
  if (!isUnitCard(before, card.cardId) || !unitFeatures(before, ownerId, card).includes("加速")) return state;
  let next = state;
  for (const pw of state.players[ownerId].power.filter((c) => isCard(c.cardId, "XG7-043") && !c.faceDown)) {
    next = openAfter(next, selectOne({ playerId: ownerId, phasePlayerId: intent.phasePlayerId, sourceInstanceId: pw.instanceId }, "XG7-043", HELL_BROTHERS_EFFECT_ID, [pw.instanceId], true, { kind: "select_power" }));
  }
  return next;
}

CHOICE_RESOLVERS[HELL_BROTHERS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!state.players[playerId].power.some((c) => c.instanceId === instanceId)) return { state: proceed(close(state, pending), pending) };
  return { state: effectRushPicked(state, pending, playerId, instanceId, "power"), log: logFor(state, playerId, "XG7-043", `${HELL_BROTHERS_EFFECT_ID}:rush`) };
};
CHOICE_SKIPPERS[HELL_BROTHERS_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-044 仮面ライダーアクセル×仮面ライダーW・CJ【風都の護り手】（コマンドゾーン）
// 「これがリリース状態で自軍コマンドゾーンにある間、相手の手札以外から敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい。
//  そうしたとき、ラッシュされた敵軍ユニットを持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（自軍・敵軍ターンを問わない）
// 手札以外からのラッシュとして、ゾーンからのラッシュ（self_rush_from_zone。core/applyAction.ts）を見る。

const WIND_CITY_EFFECT_ID = "xg7044_wind_city";

export function openXg7bOnSelfRushFromZone(state: GameState, rusherId: PlayerId, zone: string, rushedInstanceId: string): GameState {
  if (zone === "hand") return state;
  const rushed = findField(state, rusherId, rushedInstanceId);
  if (!rushed || !isUnitCard(state, rushed.cardId) || !rk1IsSmallNow(state, rushed)) return state;
  const holder = opponent(rusherId);
  let next = state;
  for (const card of state.players[holder].command.filter((c) => isCard(c.cardId, "XG7-044") && !c.commandHeld)) {
    next = openAfter(next, selectOne({ playerId: holder, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId }, "XG7-044", WIND_CITY_EFFECT_ID, [card.instanceId], true, { xg7Meta: { target: rushedInstanceId, owner: rusherId } }));
  }
  return next;
}

CHOICE_RESOLVERS[WIND_CITY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const self = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!self || self.commandHeld) return { state: proceed(close(state, pending), pending) };
  const ownerId = pending.xg7Meta?.owner ?? opponent(playerId);
  const target = pending.xg7Meta?.target;
  const log = logFor(state, playerId, "XG7-044", `${WIND_CITY_EFFECT_ID}:rush`);
  return {
    state: effectRushPicked(state, pending, playerId, instanceId, "command", (next) => {
      if (!target || !findField(next, ownerId, target)) return next;
      const full = next.players[ownerId].command.length >= COMMAND_ZONE_MAX;
      return sendFieldCardsToCommandOrDiscard(next, ownerId, full ? [] : [target], full ? [target] : [], pending.phasePlayerId);
    }),
    log,
  };
};
CHOICE_SKIPPERS[WIND_CITY_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG7-045 ロストドライバー ◎（オペレーション）
// 「自軍山札を見て、これを使用するためにホールドしたコマンドと同じ必要パワーを持つSユニットのカードを1枚選び、相手に見せてから手札に加えてもよい。
//  その後、山札をシャッフルする。」同じ必要パワーは「+」「-」を除いた数字で比べる（カテゴリ・追加条件は問わない）。
// 使用のためにホールドしたコマンドは支払いの記録（state.rk12OpPaid）。

const LOST_SEARCH_EFFECT_ID = "xg7045_lost_search";

function applyLostSearch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const paid = state.rk12OpPaid && state.rk12OpPaid.instanceId === ctx.operationInstanceId ? state.rk12OpPaid.commandIds : [];
  const p = state.players[ctx.playerId];
  const numbers = paid
    .map((id) => [...p.command, ...p.battle, ...p.rush].find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c)
    .map((c) => costNumberOf(state, c.cardId))
    .filter((n) => Number.isFinite(n));
  const ids = p.deck
    .filter((c) => isUnitCard(state, c.cardId) && unitSizeOf(state.definitions, c) === "S" && numbers.includes(costNumberOf(state, c.cardId)))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: shuffleDeck(state, ctx.playerId), detail: "xg7045:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-045", LOST_SEARCH_EFFECT_ID, ids, true)), detail: LOST_SEARCH_EFFECT_ID };
}

CHOICE_RESOLVERS[LOST_SEARCH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
    next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG7-045", effectLabel: "ロストドライバー", from: "deck_top", cards: revealedCards([card], "hand") });
  }
  return { state: proceed(shuffleDeck(next, playerId), pending), log: logFor(state, playerId, "XG7-045", `${LOST_SEARCH_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : "-"}`) };
};
CHOICE_SKIPPERS[LOST_SEARCH_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

// ---------------------------------------------------------------------------
// XG7-046 仮面ライダーオーズ・サゴーゾコンボ【ゴリバゴーン】
// 「自軍ターン中、これをラッシュしたとき、ライドしている敵軍Sユニットを1体選び、撃破してもよい。」（エリアを問わない）

const GORIBAGON_EFFECT_ID = "xg7046_goribagon";

function applyGoribagon(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg7046:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => !!c.mountedOnInstanceId && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG7-046", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg7046:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG7-046", GORIBAGON_EFFECT_ID, ids, true)), detail: GORIBAGON_EFFECT_ID };
}

registerDestroyPick(GORIBAGON_EFFECT_ID);

// ---------------------------------------------------------------------------
// バトルエリアに出たとき（rules/combo.ts resolveEnterBattleEffectsImpl）

export function tryXg7bOnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): GameState {
  if (!isUnitCard(state, card.cardId) || !state.players[playerId].battle.some((c) => c.instanceId === card.instanceId)) return state;
  let next = openBloom(state, playerId, card);
  next = openGreatStrike(next, playerId, card, battleBeforeEnter);
  next = openHeaderFromCommand(next, playerId, card);
  next = openDoubleAction(next, playerId);
  return next;
}

// ---------------------------------------------------------------------------
// キーワード

Object.assign(XG7_KEYWORDS, {
  "XG7-024::chopper_draw": applyChopperDraw,
  "XG7-025::wings": applyWings,
  "XG7-025::wings_wing": applyWingsWing,
  "XG7-026::land_combi": applyLandCombi,
  "XG7-028::ultimate_strike": applyUltimateStrike,
  "XG7-030::header": applyHeader,
  "XG7-032::double_kick": applyDoubleKick,
  "XG7-035::delzer": applyDelzer,
  "XG7-037::red_gold": applyRedGold,
  "XG7-038::blast": applyBlast,
  "XG7-041::golden_hope": applyGoldenHope,
  "XG7-045::lost_search": applyLostSearch,
  "XG7-046::goribagon": applyGoribagon,
  // 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない（rules/xg7/xg7Fields.ts 等）。
  "XG7-024::bloom": noop("xg7024:bloom"),
  "XG7-025::number_reduction": noop("xg7025:number"),
  "XG7-029::great_strike": noop("xg7029:on_combo"),
  "XG7-031::cyclone": noop("xg7031:static"),
  "XG7-033::revenge": noop("xg7033:battle_to_rush"),
  "XG7-034::heaven_earth_man": noop("xg7034:static"),
  "XG7-036::declare": noop("xg7036:field_ability"),
  "XG7-037::kaixa_damage": noop("xg7037:on_attack_win"),
  "XG7-040::double_action": noop("xg7040:hand"),
  "XG7-041::exile_at_end": noop("xg7041:turn_end"),
  "XG7-042::rider_war": noop("xg7042:turn_end"),
  "XG7-043::static": noop("xg7043:static"),
  "XG7-043::hell_brothers": noop("xg7043:power"),
});

