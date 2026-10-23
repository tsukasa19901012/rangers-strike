/**
 * クロスギャザー XG2-042〜XG2-061（仮面ライダーディケイドCF〜リョクオオザル）のカード固有の効果（cardSpec XG2-042-061 の監査）。
 * 登録は rules/xg2/xg2Core.ts。継続効果の判定（XG2-046・058・061 の BP、XG2-042 のナンバー、XG2-044 の追加条件等）は rules/xg2/xg2Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addNextTurnRuleModifier, addTurnRestrictionModifier, addTurnRuleModifier } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardHasGrantKeyword } from "../../dsl/promotedKeywordBridge";
import { FEATURE_KEYWORDS } from "../../dsl/featureKeywords";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { getDslOperationEffect } from "../../dsl/dslCatalog";
import { collectTargetInstanceIds } from "../../dsl/targetSelectors";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import { openEffectChoice } from "../pendingChoices";
import { finalizeLeaveReaction, resolveBattlePending, tryLeaveField } from "../operationCounters";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { moveToExile } from "../exile";
import { markRushedThisTurn } from "../turnModifiers";
import { rk12PlacesHeldOnRush } from "../rk/rk12Fields";
import { sendFieldCardsToCommandOrDiscard } from "../fieldLeaveQueue";
import { collectXg3TurnEndQueue, openXg3TurnEndEntry } from "../xg3/xg3Effects";
import { applyDamageToPlayer } from "../damagePayment";
import { filthyAirActive } from "../legend1/otherLinesNamedEffects";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { MUSIC_BOX_SKIP_BATTLE_RULE } from "../operationCounters";
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
import { XG2_FAR_KEY, XG2_HENSHIN_KEY, XG2_NO_STRIKE_RESTRICTION, XG2_RYOKU_KEY, type Xg2TurnEntry } from "./xg2Fields";
import {
  type ChoiceOutcome,
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

// ---------------------------------------------------------------------------
// 共通

function selectOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function defOf(state: GameState, cardId: string) {
  return getDefinition(state.definitions, cardId);
}

function hasCategory(state: GameState, cardId: string, cat: string): boolean {
  const c = defOf(state, cardId)?.category as string | string[] | undefined;
  return Array.isArray(c) ? c.includes(cat) : c === cat;
}

function printedFeatures(state: GameState, cardId: string): string[] {
  return defOf(state, cardId)?.features ?? [];
}

function holdCommand(state: GameState, playerId: PlayerId, commandId: string): GameState {
  return patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === commandId ? { ...c, commandHeld: true } : c)) }));
}

function setFieldHeld(state: GameState, playerId: PlayerId, ids: string[], held: boolean): GameState {
  return patchPlayer(state, playerId, (p) => {
    const set = (cards: CardInstance[]) => cards.map((c) => (ids.includes(c.instanceId) ? { ...c, commandHeld: held } : c));
    return { ...p, rush: set(p.rush), battle: set(p.battle) };
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

function addTurnEntry(state: GameState, key: string, ownerId: PlayerId, instanceId: string): GameState {
  return withXg2List(state, key, [...xg2List<Xg2TurnEntry>(state, key).filter((e) => e.turn === state.turn), { ownerId, instanceId, turn: state.turn }]);
}

function sourceCard(state: GameState, ctx: GrantKeywordContext): CardInstance | undefined {
  return ctx.triggerSourceInstanceId ? findField(state, ctx.playerId, ctx.triggerSourceInstanceId) : undefined;
}

function sortedIds(cards: CardInstance[]): string[] {
  return cards.map((c) => c.instanceId).sort();
}

/** 両軍の場の S ユニット（敵軍のものは選べるものだけ）。 */
function smallUnitsBothSides(state: GameState, playerId: PlayerId, sourceCardId: string): Array<{ ownerId: PlayerId; card: CardInstance }> {
  const out: Array<{ ownerId: PlayerId; card: CardInstance }> = [];
  for (const pid of [playerId, opponent(playerId)]) {
    for (const c of fieldUnits(state, pid)) {
      if (defOf(state, c.cardId)?.type !== "unit" || !rk1IsSmallNow(state, c)) continue;
      if (pid !== playerId && !selectableEnemy(state, playerId, sourceCardId, c)) continue;
      out.push({ ownerId: pid, card: c });
    }
  }
  return out;
}

function ownerOfField(state: GameState, instanceId: string): PlayerId | null {
  for (const pid of ["player1", "player2"] as const) if (findField(state, pid, instanceId)) return pid;
  return null;
}

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

// ---------------------------------------------------------------------------
// XG2-042 仮面ライダーディケイドCF
// 【ファイナルアタックライド】（NC）「オモテ向きの自軍パワーから特徴「仮面ライダー」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。
//  そうしたとき、この効果で出したユニットはナンバーに数字かRCを持っていれば、このターン、そのナンバーは「2」になり、自分がターンを終えるとき、
//  自軍エリアにあれば捨札にする。」（atwiki/page-1687）。出したユニットはナンバーに関わらずターンの終わりに捨札（Q1）。XG1-034【汚い大気】の下では
//  バトルフェイズ中は発動できない（Q3）。ナンバーの「2」は rules/xg2/xg2Fields.ts（数字）と下のコンビネーションの判定（RC）。

const FAR_EFFECT_ID = "xg2_042_final_attack_ride";

function farCandidates(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power
    .filter((c) => !c.faceDown && defOf(state, c.cardId)?.type === "unit" && printedFeatures(state, c.cardId).includes("仮面ライダー"))
    .map((c) => c.instanceId)
    .sort();
}

function applyFar(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (filthyAirActive(state)) return { state, detail: "xg2_042:filthy_air" };
  const ids = farCandidates(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: "xg2_042:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-042", FAR_EFFECT_ID, ids, true)), detail: FAR_EFFECT_ID };
}

registerXg2Choice(FAR_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const card = next.players[playerId].power.find((c) => c.instanceId === instanceId);
    if (card) {
      next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, { instanceId: card.instanceId, cardId: card.cardId }] }));
      next = addTurnEntry(next, XG2_FAR_KEY, playerId, instanceId);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-042", `${FAR_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

/** RC を持つユニットはナンバーが「2」になる: バトルエリアの2番目に出たら NC（RC の欄の効果を発動する）。 */
xg2Hook("comboEnter", (state, playerId, card, battleBeforeEnter) => {
  if (!xg2List<Xg2TurnEntry>(state, XG2_FAR_KEY).some((e) => e.instanceId === card.instanceId && e.ownerId === playerId && e.turn === state.turn)) return state;
  if (defOf(state, card.cardId)?.comboNumber !== "RC") return state;
  if (battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).length + 1 !== 2) return state;
  const out = tryResolveDslTriggeredEffects({ state, cardId: card.cardId, instanceId: card.instanceId, playerId, phasePlayerId: state.activePlayer, triggerType: "riding_combo" });
  return { ...out.state, log: [...out.state.log, ...out.logs] };
});

// ※「これがユニットでなくなるとき、オモテ向きの自軍パワーから特徴「仮面ライダー」を持つカードを1枚選び捨札にすれば、その場に留まる。」
// 持つカードは DSL のキーワード（FEATURE_KEYWORDS.registerStayKamenRider。XP-005 も同じ）で判定する。

const STAY_EFFECT_ID = "xg2_042_stay";

function stayCandidates(state: GameState, ownerId: PlayerId): string[] {
  return state.players[ownerId].power
    .filter((c) => !c.faceDown && printedFeatures(state, c.cardId).includes("仮面ライダー"))
    .map((c) => c.instanceId)
    .sort();
}

xg2Hook("leaveStay", (state, intent) => {
  if (intent.toZone === "battle" || intent.xg2Declined?.includes(STAY_EFFECT_ID)) return null;
  if (state.pendingEffectChoice) return null;
  const unit = state.players[intent.ownerPlayerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || !cardHasGrantKeyword(unit.cardId, FEATURE_KEYWORDS.registerStayKamenRider)) return null;
  if (filthyAirActive(state)) return null;
  const ids = stayCandidates(state, intent.ownerPlayerId);
  if (ids.length === 0) return null;
  return openEffectChoice(
    state,
    selectOne({ playerId: intent.ownerPlayerId, phasePlayerId: intent.phasePlayerId, sourceInstanceId: unit.instanceId }, unit.cardId, STAY_EFFECT_ID, ids, true, { xg2Meta: { leave: intent } }),
  );
});

function settleLeave(next: GameState): GameState {
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
}

registerXg2Choice(STAY_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const intent = metaOf<{ leave: PendingLeave }>(pending).leave;
    let next = patchPlayer(close(state, pending), playerId, (p) => {
      const card = p.power.find((c) => c.instanceId === instanceId);
      if (!card) return p;
      return { ...p, power: p.power.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, { instanceId: card.instanceId, cardId: card.cardId }] };
    });
    // その場に留まる（「ユニットでなくなる」ことは起きない。撃破された事実は残る。R-DESTROY-02）。
    next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
    const follow = intent.followUpAttackerLeave;
    if (follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) next = tryLeaveField(next, { ...follow }).state;
    return { state: settleLeave(next), log: logFor(state, playerId, pending.sourceCardId, `${STAY_EFFECT_ID}:stay`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const intent = metaOf<{ leave: PendingLeave }>(pending).leave;
    const leave = tryLeaveField(close(state, pending), { ...intent, xg2Declined: [...(intent.xg2Declined ?? []), STAY_EFFECT_ID] });
    let next = leave.state;
    const follow = intent.followUpAttackerLeave;
    if (!leave.deferred && follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) next = tryLeaveField(next, { ...follow }).state;
    return { state: settleLeave(next), log: logFor(state, playerId, pending.sourceCardId, `${STAY_EFFECT_ID}:skipped`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-044 仮面ライダーW・HM【メタルシャフト】「自軍ターン中、これがバトルエリアに出たとき、BP5000以下の敵軍ユニットを1体選びホールドしてもよい。」
// （atwiki/page-1815。エリア・サイズを問わない。ホールド状態のユニットは選ばない）。

const SHAFT_EFFECT_ID = "xg2_044_metal_shaft";

function applyShaft(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_044:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(
    fieldUnits(state, enemyId).filter((c) => !c.commandHeld && effectiveBp(state, enemyId, c) <= 5000 && selectableEnemy(state, ctx.playerId, "XG2-044", c)),
  );
  if (ids.length === 0) return { state, detail: "xg2_044:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-044", SHAFT_EFFECT_ID, ids, true)), detail: SHAFT_EFFECT_ID };
}

registerXg2Choice(SHAFT_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = setFieldHeld(close(state, pending), opponent(playerId), [instanceId], true);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-044", `${SHAFT_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-045 仮面ライダーW・LT【トリガーマグナム】「自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからホールド状態のSユニットを
// 1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1822）。

const MAGNUM_EFFECT_ID = "xg2_045_trigger_magnum";

function applyMagnum(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_045:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(
    state.players[enemyId].rush.filter(
      (c) => c.commandHeld && defOf(state, c.cardId)?.type === "unit" && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG2-045", c),
    ),
  );
  if (ids.length === 0) return { state, detail: "xg2_045:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-045", MAGNUM_EFFECT_ID, ids, true)), detail: MAGNUM_EFFECT_ID };
}

registerXg2Choice(MAGNUM_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-045", `${MAGNUM_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-047 仮面ライダースーパー1・RNH【超高火炎＆冷凍ガス】（RC）「WBかOTを持つ自軍コマンドを1つ選びホールドしてもよい。そうしたとき、ホールドしたコマンドの
// 持つカテゴリごとに、次の効果を発動する⇒WBなら追加条件を持たないSユニットを1体選び撃破してもよい。OTなら追加条件を持つSユニットを1体選び、
// 持ち主のパワーゾーンに送ってもよい。」（atwiki/page-1503）。WB と OT の両方を持つなら WB、OT の順に両方（Q1）。S ユニットは両軍の場から選ぶ。

const GAS_HOLD_EFFECT_ID = "xg2_047_gas_hold";
const GAS_WB_EFFECT_ID = "xg2_047_gas_wb";
const GAS_OT_EFFECT_ID = "xg2_047_gas_ot";

function hasRushCondition(state: GameState, cardId: string): boolean {
  const def = defOf(state, cardId);
  return !!def && !!resolveRushAdditionalCondition(def.id, def);
}

function gasStep(state: GameState, ctx: BaseCtx, wb: boolean): PendingEffectChoice | null {
  const ids = smallUnitsBothSides(state, ctx.playerId, "XG2-047")
    .filter((u) => hasRushCondition(state, u.card.cardId) !== wb)
    .map((u) => u.card.instanceId)
    .sort();
  if (ids.length === 0) return null;
  return selectOne(ctx, "XG2-047", wb ? GAS_WB_EFFECT_ID : GAS_OT_EFFECT_ID, ids, true);
}

function continueGas(state: GameState, pending: PendingEffectChoice, ot: boolean): GameState {
  const step = ot ? gasStep(state, pendingBase(pending), false) : null;
  return step ? openNext(state, pending, step) : proceed(state, pending);
}

function applyGas(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command
    .filter((c) => !c.commandHeld && (hasCategory(state, c.cardId, "WB") || hasCategory(state, c.cardId, "OT")))
    .map((c) => c.instanceId)
    .sort();
  if (ids.length === 0) return { state, detail: "xg2_047:no_command" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-047", GAS_HOLD_EFFECT_ID, ids, true, { kind: "select_command" })), detail: GAS_HOLD_EFFECT_ID };
}

registerXg2Choice(GAS_HOLD_EFFECT_ID, {
  resolve: (state, playerId, commandId) => {
    const pending = state.pendingEffectChoice!;
    const command = state.players[playerId].command.find((c) => c.instanceId === commandId);
    const wb = !!command && hasCategory(state, command.cardId, "WB");
    const ot = !!command && hasCategory(state, command.cardId, "OT");
    const next = holdCommand(close(state, pending), playerId, commandId);
    const log = logFor(state, playerId, "XG2-047", `${GAS_HOLD_EFFECT_ID}:${commandId}`);
    const first = wb ? gasStep(next, pendingBase(pending), true) : null;
    if (first) return { state: openNext(next, pending, { ...first, xg2Meta: { ot } }), log };
    return { state: continueGas(next, pending, ot), log };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(GAS_WB_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-047", `${GAS_WB_EFFECT_ID}_destroy`, [instanceId]);
    return { state: continueGas(next, pending, !!metaOf<{ ot?: boolean }>(pending).ot), log: logFor(state, playerId, "XG2-047", `${GAS_WB_EFFECT_ID}:${instanceId}`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: continueGas(close(state, pending), pending, !!metaOf<{ ot?: boolean }>(pending).ot), log: logFor(state, playerId, "XG2-047", `${GAS_WB_EFFECT_ID}:skipped`) };
  },
});

registerXg2Choice(GAS_OT_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const ownerId = ownerOfField(state, instanceId) ?? opponent(playerId);
    const next = moveFieldUnit(close(state, pending), ownerId, instanceId, pending.phasePlayerId, "power");
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-047", `${GAS_OT_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-048 仮面ライダースーパー1・RH【レーダーアイ】「これが自軍バトルエリアからラッシュエリアに戻るとき、お互いの山札の上から1枚をオモテにしてもよい。
// そうしたとき、オモテにしたカードを、それぞれ持ち主の山札の上に戻すか下に戻すか選択する。」（atwiki/page-1744）。
// 選ぶのはこれの持ち主（自分の山札の上のカード、相手の山札の上のカードの順）。

const RADAR_EFFECT_ID = "xg2_048_radar_eye";
const RADAR_PLACE_EFFECT_ID = "xg2_048_radar_place";
const DECK_TOP = "deck_top";
const DECK_BOTTOM = "deck_bottom";

function radarStep(state: GameState, ctx: BaseCtx, deckOwners: PlayerId[]): PendingEffectChoice | null {
  const [owner, ...rest] = deckOwners.filter((pid) => state.players[pid].deck.length > 0);
  if (!owner) return null;
  return selectOne(ctx, "XG2-048", RADAR_PLACE_EFFECT_ID, [DECK_TOP, DECK_BOTTOM], false, { xg2Meta: { owner, rest } });
}

/** XG2-048【レーダーアイ】を持つカード（rules/startPhase.ts collectBattleToRushEffectQueue でキューに積む）。 */
export function isXg2BattleToRushTrigger(card: CardInstance): boolean {
  return isSameCardIdentity(card.cardId, "XG2-048");
}

xg2Hook("battleToRush", (state, ownerId, card, phasePlayerId) => {
  if (!isXg2BattleToRushTrigger(card)) return state;
  if (state.players.player1.deck.length === 0 && state.players.player2.deck.length === 0) return state;
  return openAfter(state, confirmChoice({ playerId: ownerId, phasePlayerId, sourceInstanceId: card.instanceId }, "XG2-048", RADAR_EFFECT_ID));
});

registerXg2Choice(RADAR_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const next = close(state, pending);
    const step = radarStep(next, pendingBase(pending), [playerId, opponent(playerId)]);
    const log = logFor(state, playerId, "XG2-048", `${RADAR_EFFECT_ID}:reveal`);
    return { state: step ? openNext(next, pending, step) : proceed(next, pending), log };
  },
});

registerXg2Choice(RADAR_PLACE_EFFECT_ID, {
  resolve: (state, playerId, where) => {
    const pending = state.pendingEffectChoice!;
    const meta = metaOf<{ owner: PlayerId; rest: PlayerId[] }>(pending);
    let next = close(state, pending);
    if (where === DECK_BOTTOM) next = patchPlayer(next, meta.owner, (p) => (p.deck.length > 0 ? { ...p, deck: [...p.deck.slice(1), p.deck[0]!] } : p));
    const step = radarStep(next, pendingBase(pending), meta.rest);
    const log = logFor(state, playerId, "XG2-048", `${RADAR_PLACE_EFFECT_ID}:${meta.owner}:${where}`);
    return { state: step ? openNext(next, pending, step) : proceed(next, pending), log };
  },
});

// ---------------------------------------------------------------------------
// XG2-049 仮面ライダーギルス【デモンズファングクラッシャー】（RC）「敵軍山札の上から1枚をオモテにする。オモテにしたカードがSユニットのカードだったなら、
// 敵軍バトルエリアに出してもよい（出したユニットの効果は発動しない）。出さなかったか、Sユニットのカード以外だったなら、オモテにしたカードを山札の上に
// 戻す。」（atwiki/page-1759）。

const FANG_EFFECT_ID = "xg2_049_demons_fang";

function applyFang(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const top = state.players[enemyId].deck[0];
  if (!top) return { state, detail: "xg2_049:no_deck" };
  const def = defOf(state, top.cardId);
  if (def?.type !== "unit" || def.size !== "S") return { state, detail: `xg2_049:revealed:${top.cardId}` };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-049", FANG_EFFECT_ID, [top.instanceId], true)), detail: FANG_EFFECT_ID };
}

registerXg2Choice(FANG_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const next = patchPlayer(close(state, pending), enemyId, (p) => {
      const card = p.deck[0];
      if (!card || card.instanceId !== instanceId) return p;
      return { ...p, deck: p.deck.slice(1), battle: [...p.battle, { instanceId: card.instanceId, cardId: card.cardId }] };
    });
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-049", `${FANG_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-050 仮面ライダーエクシードギルス【ギルススティンガー】「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、
// 敵軍バトルエリアのユニットを必要パワーの数字の合計が3以下になるように2体まで選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1856）。
// 必要パワーに数字のないユニットは選べない。1体ずつ選び、2体選ぶか確定したら置く。

const STINGER_EFFECT_ID = "xg2_050_stinger";
const STINGER_PICK_EFFECT_ID = "xg2_050_stinger_pick";
const STINGER_BUDGET = 3;

function applyStinger(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_050:not_own_turn" };
  if (!sourceCard(state, ctx)) return { state, detail: "xg2_050:no_source" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG2-050", STINGER_EFFECT_ID)), detail: STINGER_EFFECT_ID };
}

function stingerIds(state: GameState, playerId: PlayerId, selected: string[]): string[] {
  const enemyId = opponent(playerId);
  const used = selected.reduce((n, id) => {
    const c = findField(state, enemyId, id);
    return n + (c ? costNumber(state, c.cardId) : 0);
  }, 0);
  return sortedIds(
    state.players[enemyId].battle.filter((c) => {
      if (selected.includes(c.instanceId) || !selectableEnemy(state, playerId, "XG2-050", c)) return false;
      const cost = costNumber(state, c.cardId);
      return Number.isFinite(cost) && used + cost <= STINGER_BUDGET;
    }),
  );
}

registerXg2Choice(STINGER_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    if (pending.sourceInstanceId) next = setFieldHeld(next, playerId, [pending.sourceInstanceId], true);
    const ids = stingerIds(next, playerId, []);
    const log = logFor(state, playerId, "XG2-050", `${STINGER_EFFECT_ID}:hold`);
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, { ...selectOne(pendingBase(pending), "XG2-050", STINGER_PICK_EFFECT_ID, ids, true), selectCount: 2, selectedInstanceIds: [] }), log };
  },
});

function finishStinger(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  let next = close(state, pending);
  for (const id of selected) next = moveFieldUnit(next, opponent(playerId), id, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-050", `${STINGER_PICK_EFFECT_ID}:${selected.length}`) };
}

registerXg2Choice(STINGER_PICK_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const rest = selected.length >= 2 ? [] : stingerIds(state, playerId, selected);
    const updated: GameState = { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } };
    if (rest.length === 0) return finishStinger(updated, playerId);
    return { state: updated, log: logFor(state, playerId, "XG2-050", `${STINGER_PICK_EFFECT_ID}:${instanceId}`) };
  },
  skip: (state, playerId) => finishStinger(state, playerId),
  confirm: (state, playerId) => finishStinger(state, playerId),
});

// ---------------------------------------------------------------------------
// XG2-051 地のエル【塵は塵に】「これをラッシュしたとき、敵軍捨札からSユニットのカードを1枚選んでもよい。そうしたとき、選んだカードと同じカード名の
// 敵軍ユニットがあれば、すべて撃破する。」（atwiki/page-1760）。

const DUST_EFFECT_ID = "xg2_051_dust_to_dust";

function applyDust(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = sortedIds(state.players[enemyId].discard.filter((c) => {
    const def = defOf(state, c.cardId);
    return def?.type === "unit" && def.size === "S";
  }));
  if (ids.length === 0) return { state, detail: "xg2_051:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-051", DUST_EFFECT_ID, ids, true)), detail: DUST_EFFECT_ID };
}

registerXg2Choice(DUST_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const chosen = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
    let next = close(state, pending);
    if (chosen) {
      const name = cardName(state.definitions, chosen.cardId);
      const ids = fieldUnits(next, enemyId)
        .filter((c) => cardName(next.definitions, c.cardId) === name && selectableEnemy(next, playerId, "XG2-051", c))
        .map((c) => c.instanceId);
      if (ids.length > 0) next = destroyAll(next, pendingBase(pending), "XG2-051", `${DUST_EFFECT_ID}_destroy`, ids);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-051", `${DUST_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-052 ユナイトベント「ターゲットがユニットでなくなるとき、ターゲットの下に重ねていたカードはすべて捨札になる。」（atwiki/page-1761）。
// 効果の本体は rules/legend1/otherLinesNamedEffects.ts。離場の処理のあと、どのゾーンにも置かれなかった下のカードを持ち主の捨札にする。

/**
 * XG2-052「ライドしていない特徴「獣」を持つ自軍ユニットを1体選びターゲットとする」— play_operation の targetInstanceId が DSL の choose の
 * 候補にないなら使えない（core/applyAction.ts）。対象外のカードは false。
 */
export function xg2RejectsOperationTarget(state: GameState, playerId: PlayerId, operationCard: CardInstance, targetInstanceId: string | undefined): boolean {
  if (!targetInstanceId || !isSameCardIdentity(operationCard.cardId, "XG2-052")) return false;
  const first = getDslOperationEffect(operationCard.cardId, "rush")?.effects[0];
  if (first?.type !== "choose") return false;
  return !collectTargetInstanceIds(state, playerId, first.valid, operationCard.instanceId, operationCard.cardId).includes(targetInstanceId);
}

xg2Hook("afterUnitLeft", (state, left) => {
  const stacked = left.card.stackedCards ?? [];
  if (!stacked.some((c) => isSameCardIdentity(c.cardId, "XG2-052") && !c.faceDown)) return state;
  if (findField(state, left.ownerPlayerId, left.card.instanceId)) return state;
  const p = state.players[left.ownerPlayerId];
  const placed = new Set([...p.discard, ...p.power, ...p.hand, ...p.command, ...p.deck, ...p.rush, ...p.battle, ...(p.exile ?? [])].map((c) => c.instanceId));
  const lost = stacked.filter((c) => !placed.has(c.instanceId));
  if (lost.length === 0) return state;
  return patchPlayer(state, left.ownerPlayerId, (q) => ({ ...q, discard: [...q.discard, ...lost.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))] }));
});

// ---------------------------------------------------------------------------
// XG2-053 仮面ライダータイガ【間違った英雄】「自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「仮面ライダー」を持つ自軍ユニットを
// 1体選び捨札にしてもよい。そうしたとき、このターン、このユニットのBPは、捨札にしたユニットの本来のBPを「+」した値になる。」（atwiki/page-1762）。

const HERO_EFFECT_ID = "xg2_053_wrong_hero";

function applyHero(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_053:not_own_turn" };
  const ids = sortedIds(
    state.players[ctx.playerId].rush.filter(
      (c) => c.instanceId !== ctx.triggerSourceInstanceId && defOf(state, c.cardId)?.type === "unit" && unitFeatures(state, ctx.playerId, c).includes("仮面ライダー"),
    ),
  );
  if (ids.length === 0) return { state, detail: "xg2_053:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-053", HERO_EFFECT_ID, ids, true)), detail: HERO_EFFECT_ID };
}

registerXg2Choice(HERO_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = findField(state, playerId, instanceId);
    const printed = card ? Number(defOf(state, card.cardId)?.bp ?? 0) : 0;
    let next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
    const self = pending.sourceInstanceId;
    if (self && printed > 0) {
      next = patchPlayer(next, playerId, (p) => {
        const add = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === self ? { ...c, bpModifier: (c.bpModifier ?? 0) + printed } : c));
        return { ...p, battle: add(p.battle), rush: add(p.rush) };
      });
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-053", `${HERO_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-054 アビスハンマー【土中からの奇襲】「これが自軍捨札にある間、自軍ラッシュフェイズ中、自軍ダメージの数がこれの必要パワーの数字以上あれば、
// WBを持つ自軍コマンドを2つホールドしてから、これを自軍ラッシュエリアに出してもよい。」（atwiki/page-1763）。
// 合法手は self_rush_from_zone（zone: discard。rules/keywordGapRuntime.ts）。リリース状態の WB のコマンドがちょうど2つならそれをホールドし、
// 3つ以上なら2つ選ぶ。

const AMBUSH_EFFECT_ID = "xg2_054_ambush_hold";

function wbReleased(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld && hasCategory(state, c.cardId, "WB")).map((c) => c.instanceId).sort();
}

export function xg2CanDeployFromDiscard(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!isSameCardIdentity(card.cardId, "XG2-054")) return false;
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  const cost = costNumber(state, card.cardId);
  if (!Number.isFinite(cost) || state.players[playerId].damage < cost) return false;
  return wbReleased(state, playerId).length >= 2;
}

function deployFromDiscard(state: GameState, playerId: PlayerId, instanceId: string, holdIds: string[]): GameState {
  let next = state;
  for (const id of holdIds) next = holdCommand(next, playerId, id);
  return patchPlayer(next, playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, { instanceId: card.instanceId, cardId: card.cardId }] };
  });
}

export function xg2DeployFromDiscard(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card || !xg2CanDeployFromDiscard(state, playerId, card)) return null;
  const ids = wbReleased(state, playerId);
  if (ids.length === 2) return deployFromDiscard(state, playerId, instanceId, ids);
  return openEffectChoice(state, {
    ...selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG2-054", AMBUSH_EFFECT_ID, ids, false, { kind: "select_command" }),
    selectCount: 2,
    selectedInstanceIds: [],
  });
}

registerXg2Choice(AMBUSH_EFFECT_ID, {
  resolve: (state, playerId, commandId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), commandId];
    if (selected.length < 2) {
      return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== commandId) } }, log: logFor(state, playerId, "XG2-054", `${AMBUSH_EFFECT_ID}:${commandId}`) };
    }
    const next = deployFromDiscard(close(state, pending), playerId, pending.sourceInstanceId!, selected);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-054", `${AMBUSH_EFFECT_ID}:deployed`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-055 変身一発「自分の手札から特徴「男」または「女」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。このとき、出したユニットの
// 効果は発動しない。また、この効果で出したユニットは、このターン、ストライクすることができず、自分がターンを終えるとき、自軍エリアにあれば持ち主の
// コマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1764）。必要パワー・追加条件は問わない。「ラッシュしたとき」の効果は
// 発動しない（Q1）。

const HENSHIN_EFFECT_ID = "xg2_055_henshin_ippatsu";

function applyHenshin(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = sortedIds(
    state.players[ctx.playerId].hand.filter((c) => {
      const def = defOf(state, c.cardId);
      if (def?.type !== "unit" || def.size !== "S") return false;
      const f = def.features ?? [];
      return f.includes("男") || f.includes("女");
    }),
  );
  if (ids.length === 0) return { state, detail: "xg2_055:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-055", HENSHIN_EFFECT_ID, ids, true)), detail: HENSHIN_EFFECT_ID };
}

registerXg2Choice(HENSHIN_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const card = next.players[playerId].hand.find((c) => c.instanceId === instanceId);
    if (card) {
      next = patchPlayer(next, playerId, (p) =>
        addTurnRestrictionModifier(
          markRushedThisTurn(
            {
              ...p,
              hand: p.hand.filter((c) => c.instanceId !== instanceId),
              // RK-245 等「※これはラッシュするとき、可能ならホールド状態で置く。」はラッシュする時点の制限なので発動する（atwiki/page-1764 Q2・page-876 Q2）。
              rush: [...p.rush, { instanceId: card.instanceId, cardId: card.cardId, ...(rk12PlacesHeldOnRush(next, card.cardId) ? { commandHeld: true } : {}) }],
            },
            instanceId,
          ),
          instanceId,
          XG2_NO_STRIKE_RESTRICTION,
        ),
      );
      // ラッシュとして扱うが、出したユニット自身の「ラッシュしたとき」は発動しない（Q1）。「ラッシュされたとき」の窓だけ開く。
      next = { ...next, effectRushTriggerQueue: [...(next.effectRushTriggerQueue ?? []), { rusherPlayerId: playerId, instanceId, phasePlayerId: pending.phasePlayerId, windowOnly: true }] };
      next = addTurnEntry(next, XG2_HENSHIN_KEY, playerId, instanceId);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-055", `${HENSHIN_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// 自分がターンを終えるときの XG2-042・XG2-055 の移動と、そのユニット自身の XG3 の「自分がターンを終えるとき」（XG3-045 チャージアップストロンガーの
// 置き換え等）は同タイミングなので、ターンプレイヤーが処理順を選ぶ（atwiki/page-1764 Q3・R-SIM-01）。そのユニットを選べば XG3 の効果を先に処理し
// （置き換えで場を離れたユニットは XG2 の移動の対象外）、選ばなければ XG2 の移動を先に処理する（場を離れたので XG3 の効果は処理されない）。
const TURN_END_ORDER_EFFECT_ID = "xg2_055_turn_end_order";
const XG2_TURN_END_ORDER_KEY = "turnEndOrderAsked";

function turnEndOrderCandidate(state: GameState, endingPlayerId: PlayerId): { instanceId: string; sourceCardId: string } | undefined {
  const asked = xg2List<string>(state, XG2_TURN_END_ORDER_KEY);
  const xg3Entries = collectXg3TurnEndQueue(state, endingPlayerId);
  for (const [key, sourceCardId] of [[XG2_FAR_KEY, "XG2-042"], [XG2_HENSHIN_KEY, "XG2-055"]] as const) {
    for (const e of xg2List<Xg2TurnEntry>(state, key)) {
      if (e.ownerId !== endingPlayerId || asked.includes(e.instanceId) || !findField(state, e.ownerId, e.instanceId)) continue;
      if (xg3Entries.some((x) => x.endsWith(`:${e.instanceId}`))) return { instanceId: e.instanceId, sourceCardId };
    }
  }
  return undefined;
}

const markOrderAsked = (state: GameState, instanceId: string) => withXg2List(state, XG2_TURN_END_ORDER_KEY, [...xg2List<string>(state, XG2_TURN_END_ORDER_KEY), instanceId]);

registerXg2Choice(TURN_END_ORDER_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = markOrderAsked(close(state, pending), instanceId);
    for (const entry of collectXg3TurnEndQueue(next, playerId).filter((x) => x.endsWith(`:${instanceId}`))) {
      next = openXg3TurnEndEntry(next, playerId, entry);
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${TURN_END_ORDER_EFFECT_ID}:xg3_first:${instanceId}`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const next = markOrderAsked(close(state, pending), pending.validInstanceIds[0]!);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${TURN_END_ORDER_EFFECT_ID}:xg2_first`) };
  },
});

/**
 * 自分がターンを終えるとき: XG2-042 で出したユニットは捨札、XG2-055 で出したユニットはコマンドゾーンにホールド状態（置けなければ捨札）。
 * どちらも撃破ではない離場として処理を通す（チェイス・XG2-042 の「その場に留まる」・RK-250 サバイブの機会を出す）。
 * 処理順の選択を開いたら移動はせずに返す（rules/turnEndingEffects.ts は選択の解決後にもう一度呼ぶ。移動を済ませた後の呼び出しは何もしない）。
 */
xg2Hook("turnEnd", (state, endingPlayerId) => {
  let next = state;
  const ask = turnEndOrderCandidate(next, endingPlayerId);
  if (ask) {
    return openAfter(
      next,
      selectOne({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: ask.instanceId }, ask.sourceCardId, TURN_END_ORDER_EFFECT_ID, [ask.instanceId], true),
    );
  }
  next = withXg2List(next, XG2_TURN_END_ORDER_KEY, []);
  const far = xg2List<Xg2TurnEntry>(next, XG2_FAR_KEY);
  if (far.length > 0) {
    next = withXg2List(next, XG2_FAR_KEY, far.filter((e) => e.ownerId !== endingPlayerId));
    const ids = far.filter((e) => e.ownerId === endingPlayerId && findField(next, e.ownerId, e.instanceId)).map((e) => e.instanceId);
    next = sendFieldCardsToCommandOrDiscard(next, endingPlayerId, [], ids, endingPlayerId);
  }
  const henshin = xg2List<Xg2TurnEntry>(next, XG2_HENSHIN_KEY);
  if (henshin.length > 0) {
    next = withXg2List(next, XG2_HENSHIN_KEY, henshin.filter((e) => e.ownerId !== endingPlayerId));
    const ids = henshin.filter((e) => e.ownerId === endingPlayerId && findField(next, e.ownerId, e.instanceId)).map((e) => e.instanceId);
    const room = Math.max(0, COMMAND_ZONE_MAX - next.players[endingPlayerId].command.length);
    next = sendFieldCardsToCommandOrDiscard(next, endingPlayerId, ids.slice(0, room), ids.slice(room), endingPlayerId);
  }
  return next;
});

// ---------------------------------------------------------------------------
// XG2-056 仮面ライダーファイズBF【強化クリムゾンスマッシュ】「これが、BPが本来のBPでない敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットを
// 持ち主のコマンドゾーンに置いてもよい。置けなければ捨札にする。そうしたとき、バトル相手のユニットのBPの下三桁が500だったなら、相手に1点ダメージを
// 与える。」（atwiki/page-1814）。BP の条件はアタックしたユニットで見て、置くのはそのときのバトル相手（RS-018 隠流忍術で変わったユニットも。Q1）。
// 置いたらバトルは行わない。

const SMASH_HOOK_ID = "xg2_056";
const SMASH_EFFECT_ID = "xg2_056_crimson_smash";

function battleOpponentOf(state: GameState, battle: PendingBattle): { ownerId: PlayerId; card: CardInstance } | null {
  const id = battle.substituteInstanceId ?? battle.defenderInstanceId;
  const ownerId = ownerOfField(state, id);
  const card = ownerId ? findField(state, ownerId, id) : undefined;
  return ownerId && card ? { ownerId, card } : null;
}

xg2Hook("beforeBattle", {
  id: SMASH_HOOK_ID,
  open: (state, battle) => {
    if (battle.effectBattle) return null;
    const attacker = findField(state, battle.attackerPlayerId, battle.attackerInstanceId);
    if (!attacker || !isSameCardIdentity(attacker.cardId, "XG2-056")) return null;
    const enemyId = opponent(battle.attackerPlayerId);
    const attacked = findField(state, enemyId, battle.defenderInstanceId);
    if (!attacked) return null;
    const printed = defOf(state, attacked.cardId)?.bp;
    if (typeof printed !== "number" || effectiveBp(state, enemyId, attacked) === printed) return null;
    const opp = battleOpponentOf(state, battle);
    if (!opp || opp.ownerId === battle.attackerPlayerId) return null;
    return openEffectChoice(
      { ...state, pendingBattle: undefined },
      selectOne({ playerId: battle.attackerPlayerId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: attacker.instanceId }, "XG2-056", SMASH_EFFECT_ID, [opp.card.instanceId], true, { xg2Meta: { battle } }),
    );
  },
});

registerXg2Choice(SMASH_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const battle = metaOf<{ battle: PendingBattle }>(pending).battle;
    const opp = battleOpponentOf(state, battle);
    let next = close(state, pending);
    if (opp && opp.card.instanceId === instanceId) {
      const bp = effectiveBp(state, opp.ownerId, opp.card);
      next =
        next.players[opp.ownerId].command.length < COMMAND_ZONE_MAX
          ? placeInOwnersZone(next, opp.ownerId, instanceId, battle.phasePlayerId, XG2_ZONE_COMMAND)
          : moveFieldUnit(next, opp.ownerId, instanceId, battle.phasePlayerId, "discard");
      if (bp % 1000 === 500) next = applyDamageToPlayer(next, opp.ownerId, 1, { kind: "none", activePlayer: battle.phasePlayerId });
    }
    if (!next.winner) next = resolveBattlePending(next, { ...battle, battleCancelled: true }).state;
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-056", `${SMASH_EFFECT_ID}:${instanceId}`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const battle = metaOf<{ battle: PendingBattle }>(pending).battle;
    return { state: proceed(resolveBattlePending(close(state, pending), battle).state, pending), log: logFor(state, playerId, "XG2-056", `${SMASH_EFFECT_ID}:skipped`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-057 ローズオルフェノク【ラッキークローバー招集】「これが自軍エリアにある間、自軍スタートフェイズを終えるとき、自軍ユニットが4体以下なら、これを
// リリースしてもよい。」（atwiki/page-1765）。ホールド状態のときだけ確かめる。

const CLOVER_EFFECT_ID = "xg2_057_lucky_clover";

xg2Hook("startPhaseEnd", (state, playerId) => {
  let next = state;
  const units = fieldUnits(next, playerId);
  if (units.length > 4) return next;
  for (const rose of units.filter((c) => isSameCardIdentity(c.cardId, "XG2-057") && c.commandHeld)) {
    next = openAfter(next, confirmChoice({ playerId, phasePlayerId: playerId, sourceInstanceId: rose.instanceId }, "XG2-057", CLOVER_EFFECT_ID));
  }
  return next;
});

registerXg2Choice(CLOVER_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    if (pending.sourceInstanceId) next = setFieldHeld(next, playerId, [pending.sourceInstanceId], false);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-057", `${CLOVER_EFFECT_ID}:release`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-059 仮面ライダーレンゲル【力の誇示】（RC）「自分の手札をすべて相手に見せてもよい。そうしたとき、見せた枚数以下の必要パワーの数字を持つ敵軍Sユニットを
// 1体選び撃破する。」（atwiki/page-1767）。敵軍の場（エリアを問わない）の S ユニット。

const POWER_SHOW_EFFECT_ID = "xg2_059_show_hand";
const POWER_DESTROY_EFFECT_ID = "xg2_059_destroy";

function applyShow(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG2-059", POWER_SHOW_EFFECT_ID)), detail: POWER_SHOW_EFFECT_ID };
}

registerXg2Choice(POWER_SHOW_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const next = close(state, pending);
    const shown = next.players[playerId].hand.length;
    const enemyId = opponent(playerId);
    const ids = sortedIds(
      fieldUnits(next, enemyId).filter((c) => {
        if (defOf(next, c.cardId)?.type !== "unit" || !rk1IsSmallNow(next, c) || !selectableEnemy(next, playerId, "XG2-059", c)) return false;
        const cost = costNumber(next, c.cardId);
        return Number.isFinite(cost) && cost <= shown;
      }),
    );
    const log = logFor(state, playerId, "XG2-059", `${POWER_SHOW_EFFECT_ID}:${shown}`);
    if (ids.length === 0) return { state: proceed(next, pending), log };
    return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG2-059", POWER_DESTROY_EFFECT_ID, ids, false)), log };
  },
});

registerXg2Choice(POWER_DESTROY_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-059", `${POWER_DESTROY_EFFECT_ID}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-059", `${POWER_DESTROY_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-060 スカラベアンデッド【スペード10―タイム】「自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりにゲームから除外して、
// 次の効果を発動できる⇒このターンと、次の相手ターン、バトルフェイズは行われない。」（atwiki/page-1768）。
// ラッシュしたときに確かめ、除外するならラッシュエリアから除外する（出したことによる効果は発動していない）。

const SPADE_EFFECT_ID = "xg2_060_spade_ten";

function applySpade(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.phase !== "rush" || !ownTurn(state, ctx.playerId)) return { state, detail: "xg2_060:not_rush_phase" };
  if (!sourceCard(state, ctx)) return { state, detail: "xg2_060:no_source" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG2-060", SPADE_EFFECT_ID)), detail: SPADE_EFFECT_ID };
}

registerXg2Choice(SPADE_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = close(state, pending);
    const id = pending.sourceInstanceId;
    const zone = id ? zoneOfField(next, playerId, id) : undefined;
    if (id && zone) {
      next = moveToExile(next, playerId, zone, id);
      next = patchPlayer(next, playerId, (p) => addTurnRuleModifier(p, MUSIC_BOX_SKIP_BATTLE_RULE, { sourceCardId: "XG2-060" }));
      next = patchPlayer(next, opponent(playerId), (p) => addNextTurnRuleModifier(p, MUSIC_BOX_SKIP_BATTLE_RULE, { sourceCardId: "XG2-060" }));
    }
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-060", `${SPADE_EFFECT_ID}:exile`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-061 リョクオオザル（※カウンター）「敵軍ユニットにアタックされたとき発動できる⇒このターン、すべての自軍ユニットは、カテゴリを2つ以上持つ自軍コマンド
// 1つにつきBP+1000される。」（atwiki/page-1769。マークの「タッグ」は誤植でカウンター。Q1）。BP は rules/xg2/xg2Fields.ts。

type Xg2BattleRef = Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId" | "defenderInstanceId"> & { effectBattle?: boolean; battleCancelled?: boolean };

/** バトルの「アタックされたとき」に使うカウンター（rules/operationCounters.ts・core/legalActions.ts・core/applyAction.ts）。 */
export function isXg2BattleCounterCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, "XG2-061");
}

/** 「敵軍ユニットにアタックされたとき」が成り立っているか（コストは別に判定する）。 */
export function xg2BattleCounterConditionMet(state: GameState, defenderId: PlayerId, cardId: string, battle: Xg2BattleRef): boolean {
  if (!isXg2BattleCounterCard(cardId)) return false;
  if (battle.defenderPlayerId !== defenderId || battle.attackerPlayerId === defenderId || battle.effectBattle || battle.battleCancelled) return false;
  if (!findField(state, battle.attackerPlayerId, battle.attackerInstanceId)) return false;
  return fieldUnits(state, defenderId).some((c) => c.instanceId === battle.defenderInstanceId);
}

/** カウンターの効果（使ったカードを捨札にするのは呼び出し側）。バトルは行われる。 */
export function applyXg2BattleCounter(state: GameState, defenderId: PlayerId, counterInstanceId: string): { state: GameState; cancel: boolean; detail: string } {
  return { state: addTurnEntry(state, XG2_RYOKU_KEY, defenderId, counterInstanceId), cancel: false, detail: "xg2_061:bp" };
}

function applyRyoku(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: addTurnEntry(state, XG2_RYOKU_KEY, ctx.playerId, ctx.operationInstanceId ?? "XG2-061"), detail: "xg2_061:bp" };
}

// ---------------------------------------------------------------------------
// 起点

registerXg2Keyword("XG2-042::final_attack_ride", applyFar);
registerXg2Keyword("XG2-044::metal_shaft", applyShaft);
registerXg2Keyword("XG2-045::trigger_magnum", applyMagnum);
registerXg2Keyword("XG2-047::super_gas", applyGas);
registerXg2Keyword("XG2-049::demons_fang", applyFang);
registerXg2Keyword("XG2-050::gills_stinger", applyStinger);
registerXg2Keyword("XG2-051::dust_to_dust", applyDust);
registerXg2Keyword("XG2-053::wrong_hero", applyHero);
registerXg2Keyword("XG2-055::henshin_ippatsu", applyHenshin);
registerXg2Keyword("XG2-059::show_of_power", applyShow);
registerXg2Keyword("XG2-060::spade_ten_time", applySpade);
registerXg2Keyword("XG2-061::ryoku_oozaru", applyRyoku);
// 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
registerXg2Keyword("XG2-046::kairiki", noop("xg2_046:bp"));
registerXg2Keyword("XG2-048::radar_eye", noop("xg2_048:battle_to_rush"));
registerXg2Keyword("XG2-054::ambush", noop("xg2_054:self_rush_from_discard"));
registerXg2Keyword("XG2-056::crimson_smash", noop("xg2_056:before_battle"));
registerXg2Keyword("XG2-057::lucky_clover", noop("xg2_057:start_phase_end"));
registerXg2Keyword("XG2-058::species_battle", noop("xg2_058:bp"));
registerXg2Keyword("XG2-058::rengel_bonus", noop("xg2_058:bp"));
