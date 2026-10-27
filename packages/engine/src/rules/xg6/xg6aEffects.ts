/**
 * クロスギャザー ザ・ギガンティックタイタン XG6-001〜XG6-022（火の山、吠える〜リンカメレオン）のカード固有の効果（cardSpec XG6-001-022 の監査）。
 *
 * DSL の grant_keyword（`xg6::XG6-NNN::name`）から呼ばれる効果と、ほかの処理の場所から呼ばれる効果:
 * - `applyXg6OnUnitLeft`: XG6-001 火の山、吠える（※常駐。敵軍ターン中、自軍ユニットが撃破されて捨札になったとき。events/listeners/unitLeftZoneListener.ts）。
 * - `tryXg6OnEnterBattle`: XG6-008 炎神剣（コマンドゾーンから。OT の自軍 L ユニットがバトルエリアに出たとき。rules/combo.ts）。
 * - `openXg6OnAttacked`: XG6-005【マジカルショータイム】・XG6-019【奥の手】（アタックされたとき・アタックするとき。core/applyAction.ts）。
 * - `openXg6OnStrike`: XG6-019【奥の手】（ストライクをするとき。core/applyAction.ts）。
 * - `collectXg6TurnEndQueue` / `openXg6TurnEndEntry`: XG6-005（置き換えたターン終了時）・XG6-011【ラジアルボンバー】（rules/turnEndingEffects.ts）。
 * - `xg6HandActivations` / `activateXg6HandEffect`: XG6-009（手札から捨札にして発動）・XG6-014【英雄の遺産】（パワーゾーンから。
 *   core/legalActions.ts・core/applyAction.ts の activate_field_unit_ability）。
 * 継続効果（XG6-004 のブラスト・XG6-012・XG6-013・XG6-020・XG6-021 の能力）は rules/xg6/xg6Fields.ts。
 */
import { isSameCardIdentity, matchesJointLPartnerById, matchesJointRPartnerById } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingStrike, PlayerId, ZoneName } from "../../types/game";
import { cardCategories, effectiveBp, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { countAvailablePower } from "../../core/power";
import { addTurnRuleModifier } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { emitUnitLeftZoneAndResolve } from "../../events/emitUnitLeftZone";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { planEffectRush, startEffectRush } from "../effectRush";
import { applyDamageToPlayer } from "../damagePayment";
import { recordReveal } from "../revealNotice";
import { placeForDeckOrder, returnToDeckInOrder } from "../deckOrder";
import { isValidFusionMaterial, requiresAllFusionPartners } from "../zord";
import { rm1ResidentActive } from "../rm/rm1Fields";
import {
  type BaseCtx,
  base,
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  genericPick,
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
} from "../rm/rm1Effects";
import {
  CHOICE_CONFIRMERS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  XG6_ACTIVATIONS,
  XG6_KEYWORDS,
  XG6_TURN_END,
  XG6_UNIT_LEFT,
  costNumber,
  finish,
  isCard,
  nextMultiPick,
  noop,
  setHeld,
  skipped,
} from "./xg6Common";
import { XG6_BLAST_RULE_ID, addXg6Mark, hasXg6Mark, xg6Marks, xg6MultiCategoryDiscardCount } from "./xg6Fields";
import { loseDamageThreshold } from "../../core/createGame";

// ---------------------------------------------------------------------------
// 共通

export function def(state: Pick<GameState, "definitions">, cardId: string) {
  return getDefinition(state.definitions, cardId);
}

function printedCats(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return cardCategories(def(state, cardId)) as string[];
}

export function isUnitDef(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return def(state, cardId)?.type === "unit";
}

function comboNumberOf(state: Pick<GameState, "definitions">, cardId: string): unknown {
  return def(state, cardId)?.comboNumber;
}

function isLR(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const n = comboNumberOf(state, cardId);
  return n === "L" || n === "R";
}

function zoneOf(state: GameState, playerId: PlayerId, instanceId: string): "battle" | "rush" | undefined {
  return zoneOfField(state, playerId, instanceId) ?? undefined;
}

export function currentCats(state: GameState, playerId: PlayerId, card: CardInstance): string[] {
  const zone = zoneOf(state, playerId, card.instanceId);
  return zone ? (unitEffectiveCategories(state, playerId, card, zone) as string[]) : printedCats(state, card.cardId);
}

export function choice(
  ctx: BaseCtx,
  sourceCardId: string,
  effectId: string,
  kind: PendingEffectChoice["kind"],
  ids: string[],
  optional: boolean,
  extra: Partial<PendingEffectChoice> = {},
): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind, validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

/** ターンプレイヤー（反応・選択の間に activePlayer が移っていても）。 */
export function turnPlayer(state: GameState): PlayerId {
  if (state.pendingStrike) return state.pendingStrike.battlePhasePlayer;
  if (state.pendingBattle) return state.pendingBattle.phasePlayerId;
  if (state.pendingLeave) return state.pendingLeave.phasePlayerId;
  if (state.pendingEffectChoice) return state.pendingEffectChoice.phasePlayerId;
  return state.activePlayer;
}

/** 場のユニットを指定のゾーンへ移す（撃破ではない。離場の処理を通す）。toZone が command のとき place で置き方を変える。 */
export function relocateFieldUnit(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
  toZone: "command" | "power" | "exile",
  place: Partial<CardInstance> = {},
): GameState {
  const zone = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!zone || !found) return state;
  const card = { ...stripForZone(found), ...place };
  const moved = patchPlayer(state, ownerId, (p) => {
    const strip = (cards: CardInstance[]) =>
      cards.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    return {
      ...p,
      [zone]: strip(p[zone]),
      command: toZone === "command" ? [...p.command, card] : p.command,
      power: toZone === "power" ? [...p.power, card] : p.power,
      exile: toZone === "exile" ? [...(p.exile ?? []), card] : p.exile,
      discard: [...p.discard, ...(found.stackedCards ?? []).map(stripForZone)],
    };
  });
  const left = emitUnitLeftZoneAndResolve(moved, {
    ownerPlayerId: ownerId,
    instanceId,
    cardId: found.cardId,
    fromZone: zone,
    toZone: toZone as ZoneName,
    phasePlayerId,
    destroyed: false,
  });
  return { ...left.state, log: [...left.state.log, ...left.logs] };
}

/** 場以外のゾーンのカードを別のゾーンへ移す。 */
export function moveZoneCard(
  state: GameState,
  playerId: PlayerId,
  from: "hand" | "command" | "power" | "discard" | "deck",
  instanceId: string,
  to: "hand" | "discard" | "exile" | "deck_bottom",
): GameState {
  const found = state.players[playerId][from].find((c) => c.instanceId === instanceId);
  if (!found) return state;
  const card = stripForZone(found);
  return patchPlayer(state, playerId, (p) => {
    const next = { ...p, [from]: p[from].filter((c) => c.instanceId !== instanceId) };
    if (to === "hand") return { ...next, hand: [...next.hand, card] };
    if (to === "discard") return { ...next, discard: [...next.discard, card] };
    if (to === "deck_bottom") return { ...next, deck: [...next.deck, card] };
    return { ...next, exile: [...(next.exile ?? []), card] };
  });
}

/** 効果のラッシュ（選んだ1枚。requireConditions: 追加条件を満たす・ignorePowerCost: 必要パワーは問わない）。 */
function effectRush(
  state: GameState,
  pending: PendingEffectChoice,
  ownerId: PlayerId,
  instanceId: string,
  fromZone: "deck" | "power" | "discard" | "command" | "hand",
  requireConditions: boolean,
): GameState {
  return startEffectRush(state, {
    playerId: ownerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${pending.effectId}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone,
    candidates: [instanceId],
    maxCount: 1,
    requireConditions,
    ignorePowerCost: requireConditions,
    mandatory: true,
    forced: true,
  });
}

export function enemyUnitsWhere(state: GameState, playerId: PlayerId, sourceCardId: string, pred: (c: CardInstance) => boolean): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => pred(c) && selectableEnemy(state, playerId, sourceCardId, c))
    .map((c) => c.instanceId);
}

/** JC のパートナー（L なら次・R なら前）。XG6-003【爆竜マルチコンバイン】で手札から発動したときは XG6-003。 */
function jcPartner(state: GameState, playerId: PlayerId, selfInstanceId: string, side: "l" | "r"): CardInstance | undefined {
  const battle = state.players[playerId].battle;
  const idx = battle.findIndex((c) => c.instanceId === selfInstanceId);
  if (idx >= 0) return battle[side === "l" ? idx + 1 : idx - 1];
  const mark = xg6Marks(state, "XG6-003", playerId, selfInstanceId)[0];
  return mark?.ref ? findField(state, playerId, mark.ref) : undefined;
}

// ---------------------------------------------------------------------------
// XG6-001 火の山、吠える（※常駐）
// 「敵軍ターン中、自軍ユニットが撃破されて捨札になるたび、次の効果を発動できる⇒ 自軍ダメージの数まで、自軍山札の上をオモテにして、その中から撃破された
//  ユニットと同じカテゴリを持つ、Sユニット以外のカードを１枚まで選び自軍ラッシュエリアに出す。ただし、自軍ダメージの数だけ必要パワーを少なくした上で、
//  必要パワーと追加条件は満たすこと。その後、残りのカードを山札の下に好きな順番で戻す。」（atwiki/page-2332）
// オモテにするのは山札の上からダメージの数（山札が少なければ全部）。選べるのはユニットカード（Q1: オペレーションは選べない）。カテゴリは撃破された
// ユニットの印刷のカテゴリ。残りは、2枚以上なら番号を付けて山札の下の順を選ぶ（rules/deckOrder.ts）。

const FIRE_MOUNTAIN_CONFIRM = "xg6001_fire_mountain_confirm";
const FIRE_MOUNTAIN_PICK = "xg6001_fire_mountain_pick";

type LeaveEvent = { ownerPlayerId: PlayerId; instanceId: string; cardId: string; fromZone: string; toZone: string; destroyed?: boolean; phasePlayerId?: PlayerId };

export function applyXg6OnUnitLeft(state: GameState, event: LeaveEvent): GameState {
  const others = XG6_UNIT_LEFT.reduce((s, f) => f(s, event), state);
  return applyFireMountainOnUnitLeft(others, event);
}

function applyFireMountainOnUnitLeft(state: GameState, event: LeaveEvent): GameState {
  if (event.toZone !== "discard" || event.destroyed === false || (event.fromZone !== "battle" && event.fromZone !== "rush")) return state;
  const owner = event.ownerPlayerId;
  const tp = event.phasePlayerId ?? turnPlayer(state);
  if (tp === owner) return state;
  if (!isUnitDef(state, event.cardId) || !rm1ResidentActive(state, owner, "XG6-001")) return state;
  let next = state;
  for (const op of state.players[owner].operation.filter((c) => isCard(c.cardId, "XG6-001"))) {
    next = openAfter(next, {
      ...confirmChoice({ playerId: owner, phasePlayerId: tp, sourceInstanceId: op.instanceId }, "XG6-001", FIRE_MOUNTAIN_CONFIRM),
      xg6Meta: { tags: printedCats(state, event.cardId) },
    });
  }
  return next;
}

CHOICE_RESOLVERS[FIRE_MOUNTAIN_CONFIRM] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[FIRE_MOUNTAIN_CONFIRM] = simpleSkip();
CHOICE_CONFIRMERS[FIRE_MOUNTAIN_CONFIRM] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const p = state.players[playerId];
  const dmg = p.damage;
  const revealed = p.deck.slice(0, Math.max(0, dmg));
  let next = close(state, pending);
  if (revealed.length > 0) {
    next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG6-001", effectLabel: "火の山、吠える", cards: revealed.map(stripForZone) } as never);
  }
  const cats = pending.xg6Meta?.tags ?? [];
  const power = countAvailablePower(next, playerId);
  const ids = revealed
    .filter((c) => {
      const d = def(next, c.cardId);
      if (d?.type !== "unit" || d.size === "S") return false;
      if (!printedCats(next, c.cardId).some((cat) => cats.includes(cat))) return false;
      if (costNumber(next, c.cardId) - dmg > power) return false;
      return planEffectRush(next, playerId, c, true, true) !== null;
    })
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG6-001", `${FIRE_MOUNTAIN_CONFIRM}:${revealed.length}`);
  if (ids.length === 0) return { state: returnToDeckInOrder(next, pending, revealed.map((c) => c.instanceId)), log };
  return {
    state: openNext(next, pending, {
      ...choice(pendingBase(pending), "XG6-001", FIRE_MOUNTAIN_PICK, "select_hand", ids, true),
      xg6Meta: { ids: revealed.map((c) => c.instanceId) },
    }),
    log,
  };
};

/** 残りのカード（keep 以外）を山札の下に戻す（2枚以上なら順を選ぶ）。 */
function fireMountainRest(state: GameState, pending: PendingEffectChoice, keep?: string): GameState {
  return returnToDeckInOrder(state, pending, (pending.xg6Meta?.ids ?? []).filter((id) => id !== keep));
}

CHOICE_RESOLVERS[FIRE_MOUNTAIN_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = effectRush(close(state, pending), pending, playerId, instanceId, "deck", true);
  return { state: fireMountainRest(next, pending, instanceId), log: logFor(state, playerId, "XG6-001", `${FIRE_MOUNTAIN_PICK}:${instanceId}`) };
};
CHOICE_SKIPPERS[FIRE_MOUNTAIN_PICK] = (state) => {
  const pending = state.pendingEffectChoice!;
  return { state: fireMountainRest(close(state, pending), pending), log: skipLog(state, pending.playerId, "XG6-001", pending.effectId) };
};

// ---------------------------------------------------------------------------
// XG6-002 銀河超越・三神合体（オペレーション）
// 「自分の手札から合体を必要とするユニットカードを1枚選び相手に見せる。その後、自分の手札から特徴「人型」を持つユニットカードを3枚選び捨札にする。
//  ただし、見せたカードの合体に必要なユニットのカードを1枚以上含むように捨札にすること。そうしたとき、見せたカードを自軍ラッシュエリアに出す。」
//  （atwiki/page-2283）
// 見せられるのは、条件どおりの3枚を選べるカードだけ（選べなければ何もしない）。出すのは効果のラッシュ（必要パワー・追加条件は問わない。カード評価）。

const TRINITY_SHOW = "xg6002_trinity_show";
const TRINITY_DISCARD = "xg6002_trinity_discard";

function humanoidHand(state: GameState, playerId: PlayerId, exclude: string[]): CardInstance[] {
  return state.players[playerId].hand.filter(
    (c) => !exclude.includes(c.instanceId) && isUnitDef(state, c.cardId) && (def(state, c.cardId)?.features ?? []).includes("人型"),
  );
}

function isFusionPart(state: GameState, shownCardId: string, card: CardInstance): boolean {
  return isValidFusionMaterial(state.definitions, shownCardId, card, "");
}

function trinityCandidates(state: GameState, playerId: PlayerId, shown: CardInstance, picked: string[]): string[] {
  const pool = humanoidHand(state, playerId, [shown.instanceId, ...picked]);
  const hasPart = picked.some((id) => {
    const c = state.players[playerId].hand.find((h) => h.instanceId === id);
    return !!c && isFusionPart(state, shown.cardId, c);
  });
  const left = 3 - picked.length;
  if (pool.length < left) return [];
  if (hasPart) return pool.map((c) => c.instanceId);
  if (!pool.some((c) => isFusionPart(state, shown.cardId, c))) return [];
  // 最後の1枚は合体に必要なユニットのカードでなければならない。
  return pool.filter((c) => left > 1 || isFusionPart(state, shown.cardId, c)).map((c) => c.instanceId);
}

function applyTrinity(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const hand = state.players[ctx.playerId].hand;
  const ids = hand
    .filter((c) => isUnitDef(state, c.cardId) && requiresAllFusionPartners(c.cardId) && trinityCandidates(state, ctx.playerId, c, []).length > 0)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6002:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-002", TRINITY_SHOW, "select_hand", ids, false)), detail: TRINITY_SHOW };
}

CHOICE_RESOLVERS[TRINITY_SHOW] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const shown = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  let next = close(state, pending);
  next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG6-002", effectLabel: "銀河超越・三神合体", cards: [stripForZone(shown)] } as never);
  const ids = trinityCandidates(next, playerId, shown, []);
  return {
    state: openNext(next, pending, { ...choice(pendingBase(pending), "XG6-002", TRINITY_DISCARD, "select_hand", ids, false), xg6Meta: { ids: [instanceId] } }),
    log: logFor(state, playerId, "XG6-002", `${TRINITY_SHOW}:${instanceId}`),
  };
};

CHOICE_RESOLVERS[TRINITY_DISCARD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const shownId = pending.xg6Meta?.ids?.[0];
  const shown = state.players[playerId].hand.find((c) => c.instanceId === shownId);
  const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG6-002", `${TRINITY_DISCARD}:${instanceId}`);
  if (!shown) return { state: proceed(close(state, pending), pending), log };
  if (picked.length < 3) {
    const ids = trinityCandidates(state, playerId, shown, picked);
    if (ids.length > 0) {
      return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: picked, validInstanceIds: ids } }, log };
    }
    return { state: proceed(close(state, pending), pending), log };
  }
  let next = close(state, pending);
  next = picked.reduce((s, id) => moveZoneCard(s, playerId, "hand", id, "discard"), next);
  next = effectRush(next, pending, playerId, shown.instanceId, "hand", false);
  return { state: proceed(next, pending), log };
};

// ---------------------------------------------------------------------------
// XG6-003 キラーアバレンオー【爆竜マルチコンバイン】
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札から ナンバーに「L」または「R」を持つカードを1枚選び、相手に見せてもよい。そうしたとき、
//  これが見せたカードのJCの対象として適切なら、これとコンビネーションしたかのように、そのJCの効果を発動する。」（atwiki/page-2335）
// 見せたカードは手札に残る。R のカードならこれが左のパートナー、L のカードならこれが右のパートナーとして判定する（印刷のスペック）。

const MULTI_COMBINE = "xg6003_multi_combine";

function applyMultiCombine(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId || !ctx.triggerSourceInstanceId) return { state, detail: "xg6003:not_own_turn" };
  const ids = state.players[ctx.playerId].hand.filter((c) => isLR(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6003:no_lr" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-003", MULTI_COMBINE, "select_hand", ids, true)), detail: MULTI_COMBINE };
}

CHOICE_RESOLVERS[MULTI_COMBINE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const shown = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  const self = pending.sourceInstanceId ? findField(state, playerId, pending.sourceInstanceId) : undefined;
  let next = close(state, pending);
  next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG6-003", effectLabel: "爆竜マルチコンバイン", cards: [stripForZone(shown)] } as never);
  const log = logFor(state, playerId, "XG6-003", `${MULTI_COMBINE}:${instanceId}`);
  const shownDef = def(next, shown.cardId);
  const selfDef = self ? def(next, self.cardId) : undefined;
  if (!self || !shownDef || !selfDef) return { state: proceed(next, pending), log };
  const side = shownDef.comboNumber === "L" ? "l" : "r";
  const valid = side === "l" ? matchesJointLPartnerById(shown.cardId, shownDef, selfDef) : matchesJointRPartnerById(shown.cardId, shownDef, selfDef);
  if (!valid) return { state: proceed(next, pending), log: `${log}:not_valid` };
  next = addXg6Mark(next, { key: "XG6-003", playerId, instanceId: shown.instanceId, ref: self.instanceId });
  const fx = tryResolveDslTriggeredEffects({
    state: next,
    cardId: shown.cardId,
    instanceId: shown.instanceId,
    playerId,
    phasePlayerId: pending.phasePlayerId,
    triggerType: side === "l" ? "joint_combo_l" : "joint_combo_r",
    logAction: side === "l" ? "joint_combo_l" : "joint_combo_r",
  });
  next = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
  return { state: proceed(next, pending), log };
};
CHOICE_SKIPPERS[MULTI_COMBINE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-004 フルブラスト・アクション（オペレーション）
// 「自軍パワーゾーンのオモテ向きのカードを好きな枚数選びウラ向きにしてもよい。 ただし、自分がゲームに負ける点数以上ウラ向きにすることはできない。
//  その後、自分の手札にあるBP16000以下のLユニットのカードは、このターン、ブラストを得る。」（atwiki/page-2331）
// 選べるのは「負ける点数 - 1 - いまのダメージ」枚まで。ブラストはこのターンの自分のルール（rules/xg6/xg6Fields.ts xg6GrantsBlast）。

const FULL_BLAST = "xg6004_full_blast";

function grantFullBlast(state: GameState, playerId: PlayerId): GameState {
  return patchPlayer(state, playerId, (p) => addTurnRuleModifier(p, XG6_BLAST_RULE_ID, { sourceCardId: "XG6-004" }));
}

function applyFullBlast(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const p = state.players[ctx.playerId];
  const limit = loseDamageThreshold(state, ctx.playerId) - 1 - p.damage;
  const ids = p.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (limit <= 0 || ids.length === 0) return { state: grantFullBlast(state, ctx.playerId), detail: "xg6004:no_flip" };
  return {
    state: openAfter(state, { ...choice(ctxBase(ctx), "XG6-004", FULL_BLAST, "select_power", ids, true), xg6Meta: { limit } }),
    detail: FULL_BLAST,
  };
}

function finishFullBlast(state: GameState, pending: PendingEffectChoice, ids: string[]): GameState {
  const flipped = patchPlayer(state, pending.playerId, (p) => ({
    ...p,
    power: p.power.map((c) => (ids.includes(c.instanceId) ? { ...c, faceDown: true } : c)),
    damage: p.damage + ids.length,
  }));
  return grantFullBlast(flipped, pending.playerId);
}

CHOICE_RESOLVERS[FULL_BLAST] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const more = nextMultiPick(pending, instanceId, pending.validInstanceIds, pending.xg6Meta?.limit ?? 1);
  if (more) return { state: { ...state, pendingEffectChoice: more }, log: logFor(state, playerId, "XG6-004", `${FULL_BLAST}:${instanceId}`) };
  const ids = [...(pending.selectedInstanceIds ?? []), instanceId];
  return finish(state, pending, `flip:${ids.length}`, (s) => finishFullBlast(s, pending, ids));
};
CHOICE_CONFIRMERS[FULL_BLAST] = (state) => {
  const pending = state.pendingEffectChoice!;
  const ids = pending.selectedInstanceIds ?? [];
  return finish(state, pending, `flip:${ids.length}`, (s) => finishFullBlast(s, pending, ids));
};
CHOICE_SKIPPERS[FULL_BLAST] = (state) => {
  const pending = state.pendingEffectChoice!;
  const ids = pending.selectedInstanceIds ?? [];
  return skipped(state, pending, (s) => finishFullBlast(s, pending, ids));
};

// ---------------------------------------------------------------------------
// XG6-005 セイントカイザー【マジカルショータイム】
// 「これが自分の手札にある間、敵軍ターン中、特徴「魔法」を持つ自軍ユニットがアタックされたとき、アタックされたユニットとこれを置き換えてもよい。そうしたとき、
//  アタックされたユニットのかわりにこのユニットがバトルする。そのターン終了時に、このユニットを捨札にするか山札の下に戻す。」（atwiki/page-2330）
// 置き換え: アタックされたユニットは手札に戻り、これがその位置に出る。置き換えもラッシュとして扱い、「ラッシュしたとき」の1枚ドローを行う（Q1・カード評価）。
// XG6-019 ダイボウケン【奥の手】「これが自軍バトルエリアにある間、敵軍ユニットがアタックまたはストライクをするとき、これをホールドしてもよい。
//  そうしたとき、そのアタックまたはストライクは無効になる。」（atwiki/page-2328）
// アタックを無効にしたら、バトルは行わない（アタックしたユニットはアタックしたものとして扱う）。ストライクを無効にしたらダメージを与えない。

const SHOWTIME = "xg6005_magical_showtime";
const SHOWTIME_END = "xg6005_showtime_turn_end";
const TRUMP_ATTACK = "xg6019_trump_attack";
const TRUMP_STRIKE = "xg6019_trump_strike";

function releasedTrump(state: GameState, playerId: PlayerId): CardInstance | undefined {
  return state.players[playerId].battle.find((c) => isCard(c.cardId, "XG6-019") && !c.commandHeld);
}

/** アタックの続き（deferredAttack）を待たせて選択を開く。 */
function parkAttack(state: GameState, battle: PendingBattle, wing: boolean, choiceToOpen: PendingEffectChoice): GameState {
  let next = openEffectChoice({ ...state, deferredAttack: { battle, wingAttackFromRush: wing } }, choiceToOpen);
  next = { ...next, activePlayer: choiceToOpen.playerId };
  if (next.pendingBattleEntry?.instanceId === battle.attackerInstanceId) next = { ...next, pendingBattleEntry: undefined };
  return next;
}

export function openXg6OnAttacked(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.battleCancelled || battle.effectBattle) return null;
  const defenderId = battle.defenderPlayerId;
  if (battle.phasePlayerId === defenderId) return null;
  const offered = battle.xg6Offered ?? [];
  const ctx = { playerId: defenderId, phasePlayerId: battle.phasePlayerId };
  // XG6-019【奥の手】（アタックするとき）。
  const trump = releasedTrump(state, defenderId);
  if (trump && !offered.includes("XG6-019")) {
    return parkAttack(state, { ...battle, xg6Offered: [...offered, "XG6-019"] }, wingAttackFromRush, confirmChoice({ ...ctx, sourceInstanceId: trump.instanceId }, "XG6-019", TRUMP_ATTACK));
  }
  // XG6-005【マジカルショータイム】（アタックされたとき）。
  const kaiser = state.players[defenderId].hand.find((c) => isCard(c.cardId, "XG6-005"));
  const defender = state.players[defenderId].battle.find((c) => c.instanceId === battle.defenderInstanceId);
  if (kaiser && defender && !offered.includes("XG6-005") && isUnitDef(state, defender.cardId) && unitFeatures(state, defenderId, defender).includes("魔法")) {
    return parkAttack(state, { ...battle, xg6Offered: [...offered, "XG6-005"] }, wingAttackFromRush, confirmChoice({ ...ctx, sourceInstanceId: kaiser.instanceId }, "XG6-005", SHOWTIME));
  }
  return null;
}

function patchDeferredAttack(state: GameState, f: (b: PendingBattle) => PendingBattle): GameState {
  return state.deferredAttack ? { ...state, deferredAttack: { ...state.deferredAttack, battle: f(state.deferredAttack.battle) } } : state;
}

CHOICE_RESOLVERS[TRUMP_ATTACK] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TRUMP_ATTACK] = simpleSkip();
CHOICE_CONFIRMERS[TRUMP_ATTACK] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, "cancel_attack", (s) => patchDeferredAttack(setHeld(s, playerId, pending.sourceInstanceId!, true), (b) => ({ ...b, battleCancelled: true })));
};

CHOICE_RESOLVERS[SHOWTIME] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SHOWTIME] = simpleSkip();
CHOICE_CONFIRMERS[SHOWTIME] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const battle = state.deferredAttack?.battle;
  const kaiserId = pending.sourceInstanceId!;
  const kaiser = state.players[playerId].hand.find((c) => c.instanceId === kaiserId);
  if (!battle || !kaiser) return finish(state, pending, "gone");
  const defenderId = battle.defenderInstanceId;
  let next = close(state, pending);
  // 置き換え: アタックされたユニットを手札に、これを同じ位置に出す。
  const defender = next.players[playerId].battle.find((c) => c.instanceId === defenderId);
  if (!defender) return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-005", `${SHOWTIME}:no_defender`) };
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    hand: [...p.hand.filter((c) => c.instanceId !== kaiserId), stripForZone(defender)],
    battle: p.battle.map((c) => (c.instanceId === defenderId ? { ...stripForZone(kaiser), rushedThisTurn: true } : c)),
    discard: [...p.discard, ...(defender.stackedCards ?? []).map(stripForZone)],
  }));
  next = patchDeferredAttack(next, (b) => ({ ...b, defenderInstanceId: kaiserId }));
  next = addXg6Mark(next, { key: "XG6-005", playerId, instanceId: kaiserId });
  // 置き換えもラッシュとして扱う（「ラッシュしたとき」1枚ドロー）。
  const fx = tryResolveDslTriggeredEffects({
    state: next,
    cardId: kaiser.cardId,
    instanceId: kaiserId,
    playerId,
    phasePlayerId: pending.phasePlayerId,
    triggerType: "on_rush",
    logAction: "on_rush",
  });
  next = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-005", `${SHOWTIME}:swap`) };
};

CHOICE_RESOLVERS[SHOWTIME_END] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unitId = pending.sourceInstanceId!;
  const next = close(state, pending);
  const to = instanceId === "deck_bottom" ? "deck_bottom" : "discard";
  return { state: moveFieldUnit(next, playerId, unitId, pending.phasePlayerId, to), log: logFor(state, playerId, "XG6-005", `${SHOWTIME_END}:${to}`) };
};

export function openXg6OnStrike(state: GameState, pending: PendingStrike): GameState | null {
  const defenderId = opponent(pending.strikerPlayerId);
  if (pending.damageCancelled || pending.battlePhasePlayer === defenderId) return null;
  if ((pending.xg6Offered ?? []).includes("XG6-019")) return null;
  const trump = releasedTrump(state, defenderId);
  if (!trump) return null;
  const opened = openEffectChoice(
    { ...state, deferredStrike: { ...pending, xg6Offered: [...(pending.xg6Offered ?? []), "XG6-019"] } },
    confirmChoice({ playerId: defenderId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: trump.instanceId }, "XG6-019", TRUMP_STRIKE),
  );
  return { ...opened, activePlayer: defenderId };
}

CHOICE_RESOLVERS[TRUMP_STRIKE] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TRUMP_STRIKE] = simpleSkip();
CHOICE_CONFIRMERS[TRUMP_STRIKE] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, "cancel_strike", (s) => {
    const held = setHeld(s, playerId, pending.sourceInstanceId!, true);
    return held.deferredStrike ? { ...held, deferredStrike: { ...held.deferredStrike, damageCancelled: true } } : held;
  });
};

// ---------------------------------------------------------------------------
// XG6-006 ダイタンケン【ボウケンフラッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンからナンバーに「L」または「R」を持つユニットカードを1枚選び捨札にしてもよい。そうしたとき、
//  捨札にしたカードの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-2329）

const BOUKEN_COMMAND = "xg6006_bouken_command";
const BOUKEN_TARGET = "xg6006_bouken_target";

function applyBoukenFlash(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId) return { state, detail: "xg6006:not_own_turn" };
  const ids = state.players[ctx.playerId].command.filter((c) => isUnitDef(state, c.cardId) && isLR(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6006:no_command" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-006", BOUKEN_COMMAND, "select_command", ids, true)), detail: BOUKEN_COMMAND };
}

CHOICE_RESOLVERS[BOUKEN_COMMAND] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId)!;
  const cost = costNumber(state, card.cardId);
  let next = moveZoneCard(close(state, pending), playerId, "command", instanceId, "discard");
  const ids = enemyUnitsWhere(next, playerId, "XG6-006", (c) => costNumber(next, c.cardId) <= cost);
  const log = logFor(state, playerId, "XG6-006", `${BOUKEN_COMMAND}:${instanceId}:${cost}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, genericPick(pendingBase(pending), "XG6-006", BOUKEN_TARGET, ids, false, "discard"));
  return { state: next, log };
};
CHOICE_SKIPPERS[BOUKEN_COMMAND] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-007 ゲキリントージャ【激激臨臨斬】
// 「自軍ターン中、これがバトルエリアに出たとき、WBのみを持つ自軍捨札とDAのみを持つ自軍捨札を1枚ずつ選びゲームから除外するか、WBとDAの両方を持つ自軍
//  捨札を1枚選んでもよい。そうしたとき、このユニットのBP以下のBPを持つ敵軍ユニットを1体選びゲームから除外する。」（atwiki/page-2352）
// 両方を持つカード（WB と DA を含むマルチカテゴリ）を選んだときも、そのカードを除外する。BP は今の BP で比べる。

const ZAN_FIRST = "xg6007_zan_first";
const ZAN_SECOND = "xg6007_zan_second";
const ZAN_TARGET = "xg6007_zan_target";

function catsKind(state: GameState, cardId: string): "wb" | "da" | "both" | null {
  const cats = printedCats(state, cardId);
  const wb = cats.includes("WB");
  const da = cats.includes("DA");
  if (wb && da) return "both";
  if (cats.length === 1 && wb) return "wb";
  if (cats.length === 1 && da) return "da";
  return null;
}

function applyZan(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId) return { state, detail: "xg6007:not_own_turn" };
  const discard = state.players[ctx.playerId].discard;
  const kinds = discard.map((c) => catsKind(state, c.cardId));
  const pair = kinds.includes("wb") && kinds.includes("da");
  const ids = discard.filter((c, i) => kinds[i] === "both" || (pair && (kinds[i] === "wb" || kinds[i] === "da"))).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6007:no_cost" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-007", ZAN_FIRST, "select_hand", ids, true)), detail: ZAN_FIRST };
}

function openZanTarget(state: GameState, pending: PendingEffectChoice, exiled: string[]): ChoiceOutcome2 {
  const playerId = pending.playerId;
  let next = exiled.reduce((s, id) => moveZoneCard(s, playerId, "discard", id, "exile"), close(state, pending));
  const self = pending.sourceInstanceId ? findField(next, playerId, pending.sourceInstanceId) : undefined;
  const bp = self ? effectiveBp(next, playerId, self) : Number.NaN;
  const enemyId = opponent(playerId);
  const ids = Number.isFinite(bp) ? enemyUnitsWhere(next, playerId, "XG6-007", (c) => effectiveBp(next, enemyId, c) <= bp) : [];
  const log = logFor(state, playerId, "XG6-007", `exile:${exiled.join(",")}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, choice(pendingBase(pending), "XG6-007", ZAN_TARGET, "select_unit", ids, false));
  return { state: next, log };
}

type ChoiceOutcome2 = { state: GameState; log?: string };

CHOICE_RESOLVERS[ZAN_FIRST] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId)!;
  const kind = catsKind(state, card.cardId);
  if (kind === "both") return openZanTarget(state, pending, [instanceId]);
  const want = kind === "wb" ? "da" : "wb";
  const ids = state.players[playerId].discard.filter((c) => catsKind(state, c.cardId) === want).map((c) => c.instanceId);
  return {
    state: { ...state, pendingEffectChoice: { ...pending, effectId: ZAN_SECOND, validInstanceIds: ids, selectedInstanceIds: [instanceId], optional: false } },
    log: logFor(state, playerId, "XG6-007", `${ZAN_FIRST}:${instanceId}`),
  };
};
CHOICE_SKIPPERS[ZAN_FIRST] = simpleSkip();
CHOICE_RESOLVERS[ZAN_SECOND] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return openZanTarget(state, pending, [...(pending.selectedInstanceIds ?? []), instanceId]);
};
CHOICE_RESOLVERS[ZAN_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = relocateFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "exile");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-007", `${ZAN_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG6-008 炎神剣（オペレーション）
// 「お互いに山札の上から１枚をオモテにし、必要パワーの数字を比べる勝負を２回繰り返す。数字の大きい方を勝ちとして、自分が２回連続で勝ったなら、敵軍ユニットを
//  １体選び撃破する。２回連続で負けたなら、相手に自軍ユニットを１体選ばせて、選ばれたユニットを撃破する。その後、オモテにしたカードは、好きな順番で持ち主の
//  山札の下に戻す。（これが自軍コマンドゾーンにある間、OTを持つ自軍Lユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの
//  効果を発動する）」（atwiki/page-2345）
// 同じ数字は引き分け（勝ちでも負けでもない）。山札がなければその勝負はしない。撃破の選択の前に、オモテにしたカードを山札の下に置き（選択の結果に影響しない）、
// 撃破の後で、2枚以上ある持ち主ごとに番号を付けて山札の下の順を選ぶ（rules/deckOrder.ts。効果を使ったプレイヤーが選ぶ）。

const SWORD_WIN = "xg6008_sword_win";
const SWORD_LOSE = "xg6008_sword_lose";
const SWORD_COMMAND = "xg6008_sword_command";

function runSword(state: GameState, ctx: BaseCtx): GameState {
  const me = ctx.playerId;
  const enemyId = opponent(me);
  let next = state;
  let wins = 0;
  let losses = 0;
  const shown: Record<PlayerId, CardInstance[]> = { player1: [], player2: [] };
  for (let round = 0; round < 2; round++) {
    const mine = next.players[me].deck[shown[me].length];
    const theirs = next.players[enemyId].deck[shown[enemyId].length];
    if (!mine || !theirs) break;
    shown[me].push(mine);
    shown[enemyId].push(theirs);
    const a = costNumber(next, mine.cardId);
    const b = costNumber(next, theirs.cardId);
    if (a > b) wins++;
    else if (a < b) losses++;
  }
  const orders: PendingEffectChoice[] = [];
  for (const pid of [me, enemyId] as const) {
    if (shown[pid].length === 0) continue;
    next = recordReveal(next, { playerId: me, ownerId: pid, sourceCardId: "XG6-008", effectLabel: "炎神剣", cards: shown[pid].map(stripForZone) } as never);
    const placed = placeForDeckOrder(next, { playerId: me, phasePlayerId: ctx.phasePlayerId, sourceCardId: "XG6-008", sourceInstanceId: ctx.sourceInstanceId }, shown[pid].map((c) => c.instanceId), "bottom");
    next = placed.state;
    if (placed.order) orders.push(placed.order);
  }
  if (wins === 2) {
    const ids = enemyUnitsWhere(next, me, "XG6-008", () => true);
    if (ids.length > 0) next = openAfter(next, genericPick(ctx, "XG6-008", SWORD_WIN, ids, false, "discard"));
  } else if (losses === 2) {
    const ids = fieldUnits(next, me).map((c) => c.instanceId);
    if (ids.length > 0) next = openAfter(next, genericPick({ ...ctx, playerId: enemyId }, "XG6-008", SWORD_LOSE, ids, false, "discard"));
  }
  return orders.reduce((s, order) => openAfter(s, order), next);
}

function applySword(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: runSword(state, ctxBase(ctx)), detail: "xg6008_sword" };
}

/** XG6-008 の（）内: OT を持つ自軍 L ユニットがバトルエリアに出たとき、コマンドゾーンのリリース状態のこれをホールドしてもよい。 */
export function tryXg6OnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (!isUnitDef(state, card.cardId) || unitSizeOf(state.definitions, card) !== "L") return state;
  if (!currentCats(state, playerId, card).includes("OT")) return state;
  let next = state;
  for (const cmd of state.players[playerId].command.filter((c) => isCard(c.cardId, "XG6-008") && !c.commandHeld)) {
    next = openAfter(next, confirmChoice({ playerId, phasePlayerId: turnPlayer(state), sourceInstanceId: cmd.instanceId }, "XG6-008", SWORD_COMMAND));
  }
  return next;
}

CHOICE_RESOLVERS[SWORD_COMMAND] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[SWORD_COMMAND] = simpleSkip();
CHOICE_CONFIRMERS[SWORD_COMMAND] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === pending.sourceInstanceId);
  if (!cmd || cmd.commandHeld) return finish(state, pending, "not_released");
  return finish(state, pending, "hold", (s) => runSword(setHeld(s, playerId, cmd.instanceId, true), pendingBase(pending)));
};

// ---------------------------------------------------------------------------
// XG6-009 キョウリュウシンケンオー【キョウリュウマル天地一閃】
// 「これをラッシュしたとき、次の効果を発動できる→DAを持つBP8000以下の敵軍ユニットをすべて撃破する。（この効果は自軍ラッシュフェイズ中、自軍パワーが6以上
//  あれば、自分の手札からこのカードを捨札にして発動できる）」（atwiki/page-2302）

const TENCHI = "xg6009_tenchi_issen";

function tenchiTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => currentCats(state, enemyId, c).includes("DA") && effectiveBp(state, enemyId, c) <= 8000)
    .map((c) => c.instanceId);
}

function applyTenchi(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG6-009", TENCHI)), detail: TENCHI };
}

CHOICE_RESOLVERS[TENCHI] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TENCHI] = simpleSkip();
CHOICE_CONFIRMERS[TENCHI] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, "destroy", (s) => destroyAll(s, pendingBase(pending), "XG6-009", `${TENCHI}_destroy`, tenchiTargets(s, playerId)));
};

// ---------------------------------------------------------------------------
// XG6-010 グレートタイタン【タイタンノバ】
// 「自軍ターン中、これがバトルエリアに出たとき、カード名に「タイタン」を含む自軍コマンドか追加条件を持つオモテ向きの自軍パワーを、2枚まで選び捨札にしても
//  よい。そうしたとき、捨札にした枚数と同じ数だけ、相手にダメージを与える。」（atwiki/page-2313）
// カード名はルビを含む（RK-104 仮面ライダークウガTF「タイタンフォーム」。Q1）。追加条件を持つパワーはカード名を問わない（Q2）。

const TITAN_NOVA = "xg6010_titan_nova";
/** ルビに「タイタン」を含むカード（カタログのカード名にはルビがない）。 */
const TITAN_RUBY = ["RK-104"];

function hasTitanName(state: GameState, cardId: string): boolean {
  return (def(state, cardId)?.name ?? "").includes("タイタン") || TITAN_RUBY.some((id) => isCard(cardId, id));
}

function applyTitanNova(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId) return { state, detail: "xg6010:not_own_turn" };
  const p = state.players[ctx.playerId];
  const ids = [
    ...p.command.filter((c) => hasTitanName(state, c.cardId)),
    ...p.power.filter((c) => !c.faceDown && !!def(state, c.cardId)?.rushAdditionalCondition),
  ].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6010:no_cost" };
  return { state: openAfter(state, { ...choice(ctxBase(ctx), "XG6-010", TITAN_NOVA, "select_power", ids, true), xg6Meta: { limit: 2 } }), detail: TITAN_NOVA };
}

function finishTitanNova(state: GameState, pending: PendingEffectChoice, ids: string[]): ChoiceOutcome2 {
  const playerId = pending.playerId;
  return finish(state, pending, `discard:${ids.length}`, (s) => {
    let next = ids.reduce((acc, id) => {
      const from = acc.players[playerId].command.some((c) => c.instanceId === id) ? "command" : "power";
      return moveZoneCard(acc, playerId, from, id, "discard");
    }, s);
    if (ids.length > 0) next = applyDamageToPlayer(next, opponent(playerId), ids.length, { kind: "none", activePlayer: next.activePlayer });
    return next;
  });
}

CHOICE_RESOLVERS[TITAN_NOVA] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const more = nextMultiPick(pending, instanceId, pending.validInstanceIds, 2);
  if (more) return { state: { ...state, pendingEffectChoice: more }, log: logFor(state, playerId, "XG6-010", `${TITAN_NOVA}:${instanceId}`) };
  return finishTitanNova(state, pending, [...(pending.selectedInstanceIds ?? []), instanceId]);
};
CHOICE_CONFIRMERS[TITAN_NOVA] = (state) => finishTitanNova(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);
CHOICE_SKIPPERS[TITAN_NOVA] = (state) => {
  const pending = state.pendingEffectChoice!;
  const ids = pending.selectedInstanceIds ?? [];
  return ids.length > 0 ? finishTitanNova(state, pending, ids) : skipped(state, pending);
};

// ---------------------------------------------------------------------------
// XG6-011 タイタンボーイ【ラジアルボンバー】
// 「これが自軍バトルエリアにある間、自分がターンを終えるとき、これを自軍パワーゾーンに送ってもよい。そうしたとき、BP4000以下の敵軍ユニットを1体選び持ち主の
//  パワーゾーンに送る。」（atwiki/page-2346）

const RADIAL = "xg6011_radial_bomber";
const RADIAL_TARGET = "xg6011_radial_target";

export function collectXg6TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const entries: string[] = [];
  for (const m of xg6Marks(state, "XG6-005")) {
    if (m.instanceId && findField(state, m.playerId, m.instanceId)) entries.push(`showtime:${m.playerId}:${m.instanceId}`);
  }
  for (const c of state.players[endingPlayerId].battle.filter((x) => isCard(x.cardId, "XG6-011"))) entries.push(`radial:${endingPlayerId}:${c.instanceId}`);
  for (const h of XG6_TURN_END) entries.push(...h.collect(state, endingPlayerId));
  return entries;
}

export function openXg6TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, owner, instanceId] = entry.split(":") as [string, PlayerId, string];
  const rest = entry.slice(kind.length + owner.length + 2);
  const id = rest || instanceId;
  if (kind === "showtime") {
    if (!findField(state, owner, id)) return state;
    return openEffectChoice(state, {
      ...base({ playerId: owner, phasePlayerId: endingPlayerId, sourceInstanceId: id }, "XG6-005"),
      effectId: SHOWTIME_END,
      kind: "pick_effect_branch",
      validInstanceIds: ["discard", "deck_bottom"],
      selectCount: 1,
      optional: false,
    });
  }
  if (kind === "radial") {
    if (!state.players[owner].battle.some((c) => c.instanceId === id)) return state;
    return openEffectChoice(state, confirmChoice({ playerId: owner, phasePlayerId: endingPlayerId, sourceInstanceId: id }, "XG6-011", RADIAL));
  }
  for (const h of XG6_TURN_END) {
    const opened = h.open(state, endingPlayerId, entry);
    if (opened) return opened;
  }
  return state;
}

CHOICE_RESOLVERS[RADIAL] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[RADIAL] = simpleSkip();
CHOICE_CONFIRMERS[RADIAL] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = moveFieldUnit(close(state, pending), playerId, pending.sourceInstanceId!, pending.phasePlayerId, "power");
  const enemyId = opponent(playerId);
  const ids = enemyUnitsWhere(next, playerId, "XG6-011", (c) => effectiveBp(next, enemyId, c) <= 4000);
  const log = logFor(state, playerId, "XG6-011", `${RADIAL}:power`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  next = openNext(next, pending, genericPick(pendingBase(pending), "XG6-011", RADIAL_TARGET, ids, false, "power"));
  return { state: next, log };
};

// ---------------------------------------------------------------------------
// XG6-012 フラッシュタイタン【フラッシュターン】
// 「これをラッシュしたとき、ウラ向きの自軍パワーを1枚選び、オモテにしてもよい。このとき、オモテにしたカードが「タイタンボーイ」以外ならウラ向きに戻す。
//  その後、オモテ向きの自軍パワーから「タイタンボーイ」のカードを1枚選び、ラッシュエリアに出してもよい。」（atwiki/page-2284）
// オモテにしたタイタンボーイはオモテ向きのまま（ダメージが1点減る）。出すのは効果のラッシュ（必要パワー・追加条件は問わない）。

const FLASH_FLIP = "xg6012_flash_flip";
const FLASH_RUSH = "xg6012_flash_rush";

function titanBoyPower(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown && def(state, c.cardId)?.name === "タイタンボーイ").map((c) => c.instanceId);
}

function openFlashRush(state: GameState, ctx: BaseCtx, pending?: PendingEffectChoice): GameState {
  const ids = titanBoyPower(state, ctx.playerId);
  if (ids.length === 0) return pending ? proceed(state, pending) : state;
  const next = choice(ctx, "XG6-012", FLASH_RUSH, "select_power", ids, true);
  return pending ? openNext(state, pending, next) : openAfter(state, next);
}

function applyFlashTurn(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state: openFlashRush(state, ctxBase(ctx)), detail: FLASH_RUSH };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-012", FLASH_FLIP, "select_power", ids, true)), detail: FLASH_FLIP };
}

CHOICE_RESOLVERS[FLASH_FLIP] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId)!;
  const boy = def(state, card.cardId)?.name === "タイタンボーイ";
  let next = close(state, pending);
  if (boy) {
    next = patchPlayer(next, playerId, (p) => ({
      ...p,
      power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: false } : c)),
      damage: Math.max(0, p.damage - 1),
    }));
  }
  next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: "XG6-012", effectLabel: "フラッシュターン", cards: [stripForZone(card)] } as never);
  return { state: openFlashRush(next, pendingBase(pending), pending), log: logFor(state, playerId, "XG6-012", `${FLASH_FLIP}:${instanceId}:${boy ? "keep" : "back"}`) };
};
CHOICE_SKIPPERS[FLASH_FLIP] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: openFlashRush(close(state, pending), pendingBase(pending), pending), log: logFor(state, playerId, "XG6-012", `${FLASH_FLIP}:skipped`) };
};
CHOICE_RESOLVERS[FLASH_RUSH] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = effectRush(close(state, pending), pending, playerId, instanceId, "power", false);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-012", `${FLASH_RUSH}:${instanceId}`) };
};
CHOICE_SKIPPERS[FLASH_RUSH] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-014 レー・バラキ【英雄の遺産】
// 「自軍パワーゾーンのオモテ向きのカードがこれだけなら、自軍ラッシュフェイズ中、次の効果を発動できる→自軍山札を見て、OTを持ち合体を必要としない、 Sユニット
//  以外のユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーは満たすこと。その後、山札をシャッフルし、これを捨札にする。」
//  （atwiki/page-2304）
// パワーゾーンのこれから発動する（activate_field_unit_ability）。必要パワーは必要パワーの数字と自軍パワーで比べる（追加条件は問わない）。

const HERITAGE = "xg6014_heritage";

function heritageAvailable(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!isCard(card.cardId, "XG6-014") || card.faceDown) return false;
  const faceUp = state.players[playerId].power.filter((c) => !c.faceDown);
  return faceUp.length === 1 && faceUp[0]!.instanceId === card.instanceId;
}

function activateHeritage(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const power = countAvailablePower(state, playerId);
  const ids = state.players[playerId].deck
    .filter((c) => {
      const d = def(state, c.cardId);
      if (d?.type !== "unit" || d.size === "S") return false;
      if (!printedCats(state, c.cardId).includes("OT") || requiresAllFusionPartners(c.cardId)) return false;
      return costNumber(state, c.cardId) <= power;
    })
    .map((c) => c.instanceId);
  const ctx = { playerId, phasePlayerId: playerId, sourceInstanceId: instanceId };
  if (ids.length === 0) return finishHeritage(state, ctx);
  return openEffectChoice(state, choice(ctx, "XG6-014", HERITAGE, "select_hand", ids, true));
}

function finishHeritage(state: GameState, ctx: BaseCtx): GameState {
  const shuffled = shuffleDeck(state, ctx.playerId);
  return ctx.sourceInstanceId ? moveZoneCard(shuffled, ctx.playerId, "power", ctx.sourceInstanceId, "discard") : shuffled;
}

CHOICE_RESOLVERS[HERITAGE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = effectRush(close(state, pending), pending, playerId, instanceId, "deck", false);
  next = finishHeritage(next, pendingBase(pending));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-014", `${HERITAGE}:${instanceId}`) };
};
CHOICE_SKIPPERS[HERITAGE] = (state) => skipped(state, state.pendingEffectChoice!, (s) => finishHeritage(s, pendingBase(state.pendingEffectChoice!)));

// ---------------------------------------------------------------------------
// XG6-009（手札から）・XG6-014（パワーゾーンから）の発動。

function handActivationAvailable(state: GameState, playerId: PlayerId, card: CardInstance, zone: "hand" | "power"): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId || turnPlayer(state) !== playerId) return false;
  if (state.pendingEffectChoice || state.pendingRush || state.pendingLeave || state.pendingZordSetup || state.pendingCommandPayment) return false;
  if (zone === "hand") return isCard(card.cardId, "XG6-009") && countAvailablePower(state, playerId) >= 6;
  return heritageAvailable(state, playerId, card);
}

/** 手札・パワーゾーンから発動できるカード（core/legalActions.ts appendActivateFieldUnitAbilityActions から呼ぶ）。 */
export function xg6HandActivations(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return [
    ...p.hand.filter((c) => handActivationAvailable(state, playerId, c, "hand")),
    ...p.power.filter((c) => handActivationAvailable(state, playerId, c, "power")),
  ]
    .map((c) => c.instanceId)
    .concat(XG6_ACTIVATIONS.flatMap((a) => a.list(state, playerId)));
}

/** 手札・パワーゾーンのこのカードの効果を発動する（core/applyAction.ts activate_field_unit_ability から呼ぶ）。対象外なら null。 */
export function activateXg6HandEffect(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const p = state.players[playerId];
  const inHand = p.hand.find((c) => c.instanceId === instanceId);
  if (inHand && handActivationAvailable(state, playerId, inHand, "hand")) {
    const discarded = moveZoneCard(state, playerId, "hand", instanceId, "discard");
    return applyTenchi(discarded, { playerId, phasePlayerId: playerId, sourceCardId: inHand.cardId, effectId: "hand_activation", triggerSourceInstanceId: instanceId }).state;
  }
  const inPower = p.power.find((c) => c.instanceId === instanceId);
  if (inPower && handActivationAvailable(state, playerId, inPower, "power")) return activateHeritage(state, playerId, instanceId);
  for (const a of XG6_ACTIVATIONS) {
    if (!a.list(state, playerId).includes(instanceId)) continue;
    const activated = a.activate(state, playerId, instanceId);
    if (activated) return activated;
  }
  return null;
}

// ---------------------------------------------------------------------------
// XG6-016 爆竜アンキロベイルス【爆竜必殺ダブルトルネード】
// 「これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる→コンビネーションしたユニットが持つ、効果名を持つテキスト中の
//  「これがバトルエリアに出たとき」以降の効果を発動する。（この効果は1ターンにつき1回しか発動できない）」（atwiki/page-2303）
// パートナーの「これがバトルエリアに出たとき」の効果名を持つ効果（DSL の enter_battle の名前つきの効果）をもう1度発動する。1ターンに1回はこのカード
// （instanceId）ごと。

const TORNADO = "xg6016_double_tornado";

function applyDoubleTornado(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  if (!self || hasXg6Mark(state, "XG6-016", ctx.playerId, self)) return { state, detail: "xg6016:used" };
  const partner = jcPartner(state, ctx.playerId, self, "l");
  if (!partner) return { state, detail: "xg6016:no_partner" };
  return {
    state: openAfter(state, { ...confirmChoice(ctxBase(ctx), "XG6-016", TORNADO), xg6Meta: { ids: [partner.instanceId] } }),
    detail: TORNADO,
  };
}

CHOICE_RESOLVERS[TORNADO] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TORNADO] = simpleSkip();
CHOICE_CONFIRMERS[TORNADO] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const partnerId = pending.xg6Meta?.ids?.[0];
  const partner = partnerId ? findField(state, playerId, partnerId) : undefined;
  let next = close(state, pending);
  if (pending.sourceInstanceId) next = addXg6Mark(next, { key: "XG6-016", playerId, instanceId: pending.sourceInstanceId });
  if (!partner) return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-016", `${TORNADO}:no_partner`) };
  const fx = tryResolveDslTriggeredEffects({
    state: next,
    cardId: partner.cardId,
    instanceId: partner.instanceId,
    playerId,
    phasePlayerId: pending.phasePlayerId,
    triggerType: "enter_battle",
    logAction: "enter_battle",
    effectFilter: (e) => !!e.name,
  });
  next = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-016", `${TORNADO}:${partner.cardId}`) };
};

// ---------------------------------------------------------------------------
// XG6-017 ヤツデンワニ【どこにでも繋がる電話】（NC）
// 「自軍ゾーンのオモテ向きのカードから1枚選び、手札に加えてもよい。そうしたとき、このユニットをそのカードがあった場所に置く。」（atwiki/page-2290）
// 選べるのはコマンドゾーンのカードとオモテ向きのパワー（ダメージ・エリアのユニットは除く）。コマンドゾーンに置くときは、手札に加えたカードと同じ状態
// （リリース・ホールド）で置く。手札から出す※は rules/keywordGapRuntime.ts handDeployConditionMet。

const PHONE = "xg6017_phone";

function applyPhone(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const p = state.players[ctx.playerId];
  const ids = [...p.command, ...p.power.filter((c) => !c.faceDown)].map((c) => c.instanceId);
  if (ids.length === 0 || !ctx.triggerSourceInstanceId) return { state, detail: "xg6017:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-017", PHONE, "select_command", ids, true)), detail: PHONE };
}

CHOICE_RESOLVERS[PHONE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const p = state.players[playerId];
  const fromCommand = p.command.find((c) => c.instanceId === instanceId);
  let next = moveZoneCard(close(state, pending), playerId, fromCommand ? "command" : "power", instanceId, "hand");
  const self = pending.sourceInstanceId;
  if (self && findField(next, playerId, self)) {
    next = relocateFieldUnit(next, playerId, self, pending.phasePlayerId, fromCommand ? "command" : "power", fromCommand ? { commandHeld: fromCommand.commandHeld } : {});
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-017", `${PHONE}:${instanceId}`) };
};
CHOICE_SKIPPERS[PHONE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-018 アバレキラー【ゲームはここまでだ】（NC）
// 「「SP1」自分の手札から特徴「恐竜」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。そうしたとき、これを
//  捨札にする。」（atwiki/page-2334）。「SP1」は DSL の SP1。出すのは効果のラッシュ（必要パワーは問わない）。

const GAME_OVER = "xg6018_game_over";

function applyGameOver(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].hand
    .filter((c) => isUnitDef(state, c.cardId) && (def(state, c.cardId)?.features ?? []).includes("恐竜") && planEffectRush(state, ctx.playerId, c, true, true) !== null)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6018:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-018", GAME_OVER, "select_hand", ids, true)), detail: GAME_OVER };
}

CHOICE_RESOLVERS[GAME_OVER] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = effectRush(close(state, pending), pending, playerId, instanceId, "hand", true);
  if (pending.sourceInstanceId && findField(next, playerId, pending.sourceInstanceId)) {
    next = moveFieldUnit(next, playerId, pending.sourceInstanceId, pending.phasePlayerId, "discard");
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-018", `${GAME_OVER}:${instanceId}`) };
};
CHOICE_SKIPPERS[GAME_OVER] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-021 リンライオン【激臨剣】（JC。L ナンバー）
// 「このユニットからコンビネーションする同カテゴリのLユニットは、このターン、次の能力を得る⇒これは、自軍捨札にあるカテゴリを2つ以上持つカード1枚につき
//  BP+2000され、BP20000以上のとき「SP2」になる。」（atwiki/page-2351）。能力は rules/xg6/xg6Fields.ts（このターンの記録）。

function applyGekirinken(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId;
  const partner = self ? jcPartner(state, ctx.playerId, self, "l") : undefined;
  if (!partner) return { state, detail: "xg6021:no_partner" };
  return { state: addXg6Mark(state, { key: "XG6-021", playerId: ctx.playerId, instanceId: partner.instanceId }), detail: "xg6021:granted" };
}

// ---------------------------------------------------------------------------
// XG6-022 リンカメレオン【リンギ・がんじがため】（JC。R ナンバー）
// 「これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍ユニットを1体選ぶ。そうしたとき、選んだユニットがリリース状態なら
//  ホールドし、ホールド状態なら撃破する。ただし、必要パワーの数字が、自軍捨札にあるカテゴリを2つ以上持つカードの枚数以下のユニットしか選べない。」
//  （atwiki/page-2306）

const GANJI = "xg6022_ganjigarame";

function applyGanjigarame(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const limit = xg6MultiCategoryDiscardCount(state, ctx.playerId);
  const ids = enemyUnitsWhere(state, ctx.playerId, "XG6-022", (c) => costNumber(state, c.cardId) <= limit);
  if (ids.length === 0) return { state, detail: "xg6022:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-022", GANJI, "select_unit", ids, true)), detail: GANJI };
}

CHOICE_RESOLVERS[GANJI] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = findField(state, enemyId, instanceId);
  let next = close(state, pending);
  if (target && !target.commandHeld) next = setHeld(next, enemyId, instanceId, true);
  else if (target) next = destroyAll(next, pendingBase(pending), "XG6-022", `${GANJI}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-022", `${GANJI}:${instanceId}:${target?.commandHeld ? "destroy" : "hold"}`) };
};
CHOICE_SKIPPERS[GANJI] = simpleSkip();

// ---------------------------------------------------------------------------
// 起点

Object.assign(XG6_KEYWORDS, {
  "XG6-001::fire_mountain": noop("xg6001:resident"),
  "XG6-002::trinity": applyTrinity,
  "XG6-003::multi_combine": applyMultiCombine,
  "XG6-004::full_blast": applyFullBlast,
  "XG6-005::magical_showtime": noop("xg6005:attacked"),
  "XG6-006::bouken_flash": applyBoukenFlash,
  "XG6-007::zan": applyZan,
  "XG6-008::enjinken": applySword,
  "XG6-009::tenchi_issen": applyTenchi,
  "XG6-010::titan_nova": applyTitanNova,
  "XG6-011::radial_bomber": noop("xg6011:turn_end"),
  "XG6-012::flash_turn": applyFlashTurn,
  "XG6-013::mirai": noop("xg6013:field"),
  "XG6-014::heritage": noop("xg6014:power_activation"),
  "XG6-016::double_tornado": applyDoubleTornado,
  "XG6-017::phone": applyPhone,
  "XG6-018::game_over": applyGameOver,
  "XG6-019::trump": noop("xg6019:attack_or_strike"),
  "XG6-020::ultimate": noop("xg6020:lose_threshold"),
  "XG6-021::gekirinken": applyGekirinken,
  "XG6-022::ganjigarame": applyGanjigarame,
});

