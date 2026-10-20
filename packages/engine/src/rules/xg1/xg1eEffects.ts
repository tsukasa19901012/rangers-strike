/**
 * クロスギャザー ザ・ファーストエンカウント XG1-081〜XG1-100（磁雷神〜ロボコン）のカード固有の効果（cardSpec XG1-081-100 の監査）。
 *
 * - DSL の `xg1::XG1-NNN::name` から呼ばれる効果（RC・NC・バトルエリアに出たとき）。
 * - フックから呼ぶもの:
 *   - `xg1eAfterAction`: XG1-082【戦士シャイダーの遺産】（捨札になったとき）・XG1-092 の数え上げ（捨札から手札に加えた S ユニットのカード）
 *     （core/applyAction.ts の後処理）。
 *   - `xg1eOnEnterTail`: XG1-085【レディスナイパー】・「○○からコンビネーションするときはナンバーに関係なく発動する」RC（XG1-088・094・095・096）
 *     （rules/combo.ts の進入処理の最後）。
 *   - `openXg1eAttacked` / `resolveXg1eAttacked` / `skipXg1eAttacked`: XG1-084【人質と脅迫】の手札を捨てる・XG1-087【瞬間移動】（アタックされたとき。
 *     core/applyAction.ts continueAttackAfterDeclaration）。
 *   - `xg1eAfterBattle`: XG1-095【カブトランサー】（rules/xg1/xg1aEffects.ts xg1aAfterBattle から）。
 *   - `collectXg1eTurnEndQueue` / `openXg1eTurnEndEntry`: XG1-098【ポイズンアンカー】（rules/xg1/xg1cEffects.ts のターンを終えるときの列から）。
 *   - `xg1eBattleToRush`: XG1-100【お手伝いロボット】（rules/startPhase.ts）。
 *   - `canActivateXg1eFieldAbility` / `activateXg1eFieldAbility`: XG1-099【採点】（rules/fieldActivatedAbilities.ts）。
 * 継続効果（XG1-081 の選ばれない・XG1-084 のアタック／戻すの制限・XG1-085／092 の BP・XG1-086 の SP）は rules/xg1/xg1Fields.ts と xg1Shared.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { GameAction } from "../../types/actions";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { unitFeatures } from "../addedFeatures";
import { patchPlayer } from "../playerPatches";
import { openEffectChoice } from "../pendingChoices";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
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
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { XG1_085_LADY_RULE, XG1_092_KERBEROS_RULE, XG1_092_RECOVER_RULE, XG1_099_SAITEN_RULE } from "./xg1Fields";
import { XG1_CONFIRMERS, XG1_KEYWORDS, XG1_RESOLVERS, XG1_SKIPPERS, noop } from "./xg1Core";
import { addTurnMark, commandHasRoom, costNumber, hasTurnMark, holdCommands, holdThen, isUnitDef, printedFeatures, registerHold, releasedCommands, unitCatsNow } from "./xg1Shared";

function pickOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function confirmOptions(ctx: BaseCtx, sourceCardId: string, effectId: string, options: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: options, selectCount: 1, optional, ...extra };
}

function ownTurn(ctx: GrantKeywordContext): boolean {
  return ctx.phasePlayerId === ctx.playerId;
}

function isSUnitCard(state: GameState, cardId: string): boolean {
  return isUnitDef(state, cardId) && getDefinition(state.definitions, cardId)?.size === "S";
}

function holdFieldUnits(state: GameState, ownerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const hold = (c: CardInstance): CardInstance => (ids.includes(c.instanceId) ? { ...c, commandHeld: true } : c);
    return { ...p, rush: p.rush.map(hold), battle: p.battle.map(hold) };
  });
}

/** 山札の上の1枚を自軍コマンドゾーンにホールド状態で置く（置けなければ何もしない）。 */
function deckTopToCommandHeld(state: GameState, playerId: PlayerId): GameState {
  if (!commandHasRoom(state, playerId)) return state;
  return patchPlayer(state, playerId, (p) => {
    const [top, ...rest] = p.deck;
    if (!top) return p;
    return { ...p, deck: rest, command: [...p.command, { ...stripForZone(top), commandHeld: true }] };
  });
}

function registerDestroyPick(effectId: string, sourceCardId: string): void {
  XG1_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), sourceCardId, `${effectId}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, sourceCardId, `${effectId}:${instanceId}`) };
  };
}

/** 直前に出たユニット（ビークルは飛ばす）。 */
function comboPartner(state: GameState, battleBeforeEnter: CardInstance[]): CardInstance | undefined {
  for (let i = battleBeforeEnter.length - 1; i >= 0; i--) {
    const c = battleBeforeEnter[i]!;
    if (isUnitDef(state, c.cardId)) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// XG1-081 磁雷神【パコの守護神】「これが自軍エリアにある間、自軍常駐置き場にあるカードは相手に選ばれない。」（atwiki/page-1587）
// 判定は rules/xg1/xg1Shared.ts residentsGuarded（敵軍の常駐置き場のカードを選ぶ XG1-002・XG1-051 の候補から除く）。

XG1_KEYWORDS["XG1-081::paco_guardian"] = noop("xg1_081:resident_guard");

// ---------------------------------------------------------------------------
// XG1-082 ブルホーク【戦士シャイダーの遺産】
// 「このビークルが捨札になったとき、自軍パワーゾーンのオモテ向きのカードからビークルカードを1枚選び、自分の手札に加えてもよい。」（atwiki/page-1566）
// 場（ラッシュエリア・バトルエリア）から持ち主の捨札に移ったとき（チェイスで乗り換えられたとき等。いちばん外側のアクションの前後で見る）。

const SHAIDER_LEGACY_EFFECT_ID = "xg1_082_shaider_legacy";

XG1_KEYWORDS["XG1-082::shaider_legacy"] = noop("xg1_082:on_discard");

function faceUpVehicles(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown && getDefinition(state.definitions, c.cardId)?.type === "vehicle").map((c) => c.instanceId);
}

XG1_RESOLVERS[SHAIDER_LEGACY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-082", `${SHAIDER_LEGACY_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[SHAIDER_LEGACY_EFFECT_ID] = simpleSkip();

function phaseOf(before: GameState, after: GameState): PlayerId {
  return (
    before.pendingStrike?.battlePhasePlayer ??
    before.pendingBattle?.phasePlayerId ??
    before.pendingEffectChoice?.phasePlayerId ??
    after.pendingBattle?.phasePlayerId ??
    after.pendingEffectChoice?.phasePlayerId ??
    after.activePlayer
  );
}

function ownsCardAnywhere(state: GameState, playerId: PlayerId, cardId: string): boolean {
  const p = state.players[playerId];
  return [...p.hand, ...p.rush, ...p.battle, ...p.deck, ...p.command, ...p.discard, ...p.power].some((c) => isSameCardIdentity(c.cardId, cardId));
}

/**
 * アクションの後処理（core/applyAction.ts。いちばん外側のアクションの前後で見る）。
 * - XG1-082: 場から持ち主の捨札に移ったブルホーク1枚ごとに、パワーゾーンのオモテ向きのビークルカードを選ぶ選択を開く（見送れる）。
 * - XG1-092: このターンに自軍捨札から手札に加えた S ユニットのカードを記録する（XG1-092 を持つプレイヤーだけ）。
 */
export function xg1eAfterAction(before: GameState, after: GameState, _action: GameAction): GameState {
  if (after.winner || before === after) return after;
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const was = before.players[pid];
    const now = after.players[pid];
    if (was.discard === now.discard && was.hand === now.hand) continue;
    const prevField = [...was.rush, ...was.battle].filter((c) => isSameCardIdentity(c.cardId, "XG1-082"));
    if (prevField.length > 0) {
      const nowDiscard = new Set(now.discard.map((c) => c.instanceId));
      const nowField = new Set([...now.rush, ...now.battle].map((c) => c.instanceId));
      for (const v of prevField) {
        if (!nowDiscard.has(v.instanceId) || nowField.has(v.instanceId)) continue;
        const ids = faceUpVehicles(next, pid);
        if (ids.length === 0) continue;
        next = openAfter(next, pickOne({ playerId: pid, phasePlayerId: phaseOf(before, after), sourceInstanceId: v.instanceId }, "XG1-082", SHAIDER_LEGACY_EFFECT_ID, ids, true));
      }
    }
    if (ownsCardAnywhere(after, pid, "XG1-092")) {
      const prevHand = new Set(was.hand.map((c) => c.instanceId));
      const prevDiscard = new Set(was.discard.map((c) => c.instanceId));
      for (const c of now.hand) {
        if (prevHand.has(c.instanceId) || !prevDiscard.has(c.instanceId) || !isSUnitCard(after, c.cardId)) continue;
        next = addTurnMark(next, pid, XG1_092_RECOVER_RULE, "XG1-092", c.instanceId);
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG1-083 宇宙刑事シャイダー【シャイダーブルーフラッシュ】（RC）
// 「敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が3以下のカードを1枚選び、ダメージにしてもよい。」（atwiki/page-1611）

const BLUE_FLASH_EFFECT_ID = "xg1_083_blue_flash";

XG1_KEYWORDS["XG1-083::blue_flash"] = (state, ctx) => {
  const ids = state.players[opponent(ctx.playerId)].power.filter((c) => !c.faceDown && costNumber(state, c.cardId) <= 3).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_083:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-083", BLUE_FLASH_EFFECT_ID, ids, true)), detail: BLUE_FLASH_EFFECT_ID };
};

XG1_RESOLVERS[BLUE_FLASH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  if (!state.players[enemyId].power.some((c) => c.instanceId === instanceId && !c.faceDown)) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)), damage: p.damage + 1 }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-083", `${BLUE_FLASH_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[BLUE_FLASH_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// アタックされたとき（core/applyAction.ts continueAttackAfterDeclaration）。
// XG1-084 マッドギャラン【人質と脅迫】「…自分自身の手札を1枚選び捨札にしなければ、このユニットにアタックすることができない。」（atwiki/page-1677）
//   これ（自軍バトルエリア）にアタックしたとき、アタックした相手が手札を1枚選び捨札にする（見送れない）。手札がなければアタックできない
//   （rules/xg1/xg1Fields.ts xg1DefenderBlocksAttack）。
// XG1-087 少女仮面ヘルバイラ【瞬間移動】「敵軍ターン中、これがアタックされたとき、これのバトルエリアでの並び順が自分から見て左から1番目以外なら、
//   これを自分から見て左隣のユニットと置き替えてもよい。そうしたとき、バトルは行われない。」（atwiki/page-1568）

const HOSTAGE_DISCARD_EFFECT_ID = "xg1_084_hostage_discard";
const TELEPORT_EFFECT_ID = "xg1_087_teleport";

XG1_KEYWORDS["XG1-084::hostage"] = noop("xg1_084:restriction");
XG1_KEYWORDS["XG1-087::teleport"] = noop("xg1_087:attacked");

function battleUnitsOf(state: GameState, playerId: PlayerId): CardInstance[] {
  return state.players[playerId].battle.filter((c) => isUnitDef(state, c.cardId) && getDefinition(state.definitions, c.cardId)?.type !== "vehicle");
}

export function openXg1eAttacked(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  if (battle.xg1eAttackedOffered || battle.battleCancelled || battle.effectBattle) return null;
  const defenderId = battle.defenderPlayerId;
  const attackerId = battle.attackerPlayerId;
  if (defenderId === attackerId) return null;
  const defender = state.players[defenderId].battle.find((c) => c.instanceId === battle.defenderInstanceId);
  if (!defender) return null;
  const xg1Meta = { battle: { ...battle, xg1eAttackedOffered: true }, wingAttackFromRush };
  if (isSameCardIdentity(defender.cardId, "XG1-084")) {
    const ids = state.players[attackerId].hand.map((c) => c.instanceId);
    if (ids.length === 0) return null;
    return openEffectChoice(state, {
      ...pickOne({ playerId: attackerId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: defender.instanceId }, "XG1-084", HOSTAGE_DISCARD_EFFECT_ID, ids, false),
      kind: "select_hand",
      xg1Meta,
    });
  }
  if (isSameCardIdentity(defender.cardId, "XG1-087") && battle.phasePlayerId !== defenderId) {
    const units = battleUnitsOf(state, defenderId);
    if (units.findIndex((c) => c.instanceId === defender.instanceId) <= 0) return null;
    return openEffectChoice(state, {
      ...confirmOptions({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: defender.instanceId }, "XG1-087", TELEPORT_EFFECT_ID, ["accept"], true),
      xg1Meta,
    });
  }
  return null;
}

export function isXg1eAttackedChoice(pending: PendingEffectChoice | undefined): boolean {
  return (pending?.effectId === HOSTAGE_DISCARD_EFFECT_ID || pending?.effectId === TELEPORT_EFFECT_ID) && !!pending.xg1Meta?.battle;
}

type AttackResume = { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean };

export function resolveXg1eAttacked(state: GameState, playerId: PlayerId, instanceId: string): AttackResume | { error: string } {
  const pending = state.pendingEffectChoice;
  const battle = pending?.xg1Meta?.battle;
  if (!pending || !battle || !isXg1eAttackedChoice(pending) || pending.playerId !== playerId) return { error: "no_pending" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  let next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: battle.phasePlayerId };
  const wing = !!pending.xg1Meta?.wingAttackFromRush;
  if (pending.effectId === HOSTAGE_DISCARD_EFFECT_ID) {
    const card = next.players[playerId].hand.find((c) => c.instanceId === instanceId);
    if (!card) return { error: "invalid_target" };
    next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
    next = { ...next, log: [...next.log, logFor(state, playerId, "XG1-084", `${HOSTAGE_DISCARD_EFFECT_ID}:${instanceId}`)] };
    return { state: next, battle, wingAttackFromRush: wing };
  }
  // XG1-087: 左隣のユニットと並び順を置き替え、バトルを行わない。
  const selfId = battle.defenderInstanceId;
  next = patchPlayer(next, playerId, (p) => {
    const units = p.battle.filter((c) => isUnitDef(next, c.cardId) && getDefinition(next.definitions, c.cardId)?.type !== "vehicle");
    const ui = units.findIndex((c) => c.instanceId === selfId);
    if (ui <= 0) return p;
    const leftId = units[ui - 1]!.instanceId;
    const a = p.battle.findIndex((c) => c.instanceId === leftId);
    const b = p.battle.findIndex((c) => c.instanceId === selfId);
    const battleArr = [...p.battle];
    [battleArr[a], battleArr[b]] = [battleArr[b]!, battleArr[a]!];
    return { ...p, battle: battleArr };
  });
  next = { ...next, log: [...next.log, logFor(state, playerId, "XG1-087", `${TELEPORT_EFFECT_ID}:swap`)] };
  return { state: next, battle: { ...battle, battleCancelled: true }, wingAttackFromRush: wing };
}

export function skipXg1eAttacked(state: GameState, playerId: PlayerId): AttackResume | null {
  const pending = state.pendingEffectChoice;
  const battle = pending?.xg1Meta?.battle;
  if (!pending || !battle || !isXg1eAttackedChoice(pending) || pending.playerId !== playerId || !pending.optional) return null;
  const next: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: battle.phasePlayerId, log: [...state.log, logFor(state, playerId, pending.sourceCardId, `${pending.effectId}:skip`)] };
  return { state: next, battle, wingAttackFromRush: !!pending.xg1Meta?.wingAttackFromRush };
}

// 通常の resolve・skip の入口から来たとき（ここには来ない想定。xg1Meta.battle のない選択は開かない）。
XG1_RESOLVERS[HOSTAGE_DISCARD_EFFECT_ID] = () => ({ error: "invalid_target" });
XG1_RESOLVERS[TELEPORT_EFFECT_ID] = () => ({ error: "invalid_target" });

// ---------------------------------------------------------------------------
// 進入処理の最後（rules/combo.ts。自軍バトルフェイズにバトルエリアに出たとき）。
// XG1-085 ダイアナレディ【レディスナイパー】「このユニットからコンビネーションするOTを持ち特徴「男」を持つSユニットは、このターン、次の能力を得る⇒
//   BP+2000され、ナンバーにＲＣを持っていれば、ライドオフしなくてもその効果を発動できる。」（atwiki/page-1567）
//   BP は rules/xg1/xg1Fields.ts xg1BpBonus（記録 XG1_085_LADY_RULE）。カテゴリ・特徴はいまのもの。
// 「（この効果は○○からコンビネーションするときはナンバーに関係なく発動する）」の RC（R-CN-05）:
//   XG1-088 バイクル（「ファイヤー」「ウォルター」）、XG1-094・095・096（特徴「昆虫」を持つユニット）。直前のユニットが指定どおりなら、ライドオフしなくても
//   RC の効果を発動する（ライドオフしたときはふつうに発動するので重ねない）。

XG1_KEYWORDS["XG1-085::lady_sniper"] = noop("xg1_085:combo_grant");

function partnerRcMatches(state: GameState, playerId: PlayerId, cardId: string, left: CardInstance): boolean {
  if (isSameCardIdentity(cardId, "XG1-088")) {
    const name = getDefinition(state.definitions, left.cardId)?.name;
    return sameCardName(name, "ファイヤー") || sameCardName(name, "ウォルター");
  }
  if (["XG1-094", "XG1-095", "XG1-096"].some((id) => isSameCardIdentity(cardId, id))) {
    const current = findField(state, playerId, left.instanceId) ?? left;
    return unitFeatures(state, playerId, current).includes("昆虫");
  }
  return false;
}

export function xg1eOnEnterTail(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
  rideOff: boolean,
): { state: GameState; logs: string[] } {
  const left = comboPartner(state, battleBeforeEnter);
  const self = findField(state, playerId, card.instanceId);
  if (!left || !self) return { state, logs: [] };
  let next = state;
  let rcNow = false;
  if (
    isSameCardIdentity(left.cardId, "XG1-085") &&
    rk1IsSmallNow(next, self) &&
    unitCatsNow(next, playerId, self).includes("OT") &&
    unitFeatures(next, playerId, self).includes("男")
  ) {
    next = addTurnMark(next, playerId, XG1_085_LADY_RULE, "XG1-085", self.instanceId);
    if (getDefinition(next.definitions, self.cardId)?.comboNumber === "RC") rcNow = true;
  }
  if (partnerRcMatches(next, playerId, self.cardId, left)) rcNow = true;
  if (!rcNow || rideOff) return { state: next, logs: [] };
  return resolveRidingComboOnRideOff(next, playerId, self);
}

// ---------------------------------------------------------------------------
// XG1-086 スピルバン【アークインパルス】（RC）「このユニットのBP以下のBPを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送ってもよい。」
// （atwiki/page-1674）。エリアを問わない（カード評価）。BP はいまの BP。※「BP5000以上のとき「SP1」」は rules/xg1/xg1Fields.ts。

const ARC_IMPULSE_EFFECT_ID = "xg1_086_arc_impulse";

XG1_KEYWORDS["XG1-086::arc_impulse"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  const self = id ? findField(state, ctx.playerId, id) : undefined;
  if (!self) return { state, detail: "xg1_086:no_source" };
  const bp = effectiveBp(state, ctx.playerId, self);
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG1-086", c) && effectiveBp(state, enemyId, c) <= bp)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_086:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-086", ARC_IMPULSE_EFFECT_ID, ids, true)), detail: ARC_IMPULSE_EFFECT_ID };
};

XG1_RESOLVERS[ARC_IMPULSE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-086", `${ARC_IMPULSE_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[ARC_IMPULSE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-088 バイクル【避難経路の確保】（RC）「自軍コマンドを1つ選び、自分の手札に戻してもよい。そうしたとき、自軍山札の上から1枚引いて、自軍コマンド
// ゾーンにホールド状態で置く。」（atwiki/page-1578）。コマンドはホールド・リリースを問わない。

const ESCAPE_ROUTE_EFFECT_ID = "xg1_088_escape_route";

XG1_KEYWORDS["XG1-088::escape_route"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_088:no_commands" };
  return { state: openAfter(state, { ...pickOne(ctxBase(ctx), "XG1-088", ESCAPE_ROUTE_EFFECT_ID, ids, true), kind: "select_command" }), detail: ESCAPE_ROUTE_EFFECT_ID };
};

XG1_RESOLVERS[ESCAPE_ROUTE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  next = deckTopToCommandHeld(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-088", `${ESCAPE_ROUTE_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[ESCAPE_ROUTE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-089 ファイヤー【警視庁特別救急警察隊】（NC5）「「SP1」自軍捨札から特徴「警察」を持たないSユニットのカードを1枚選び、自軍コマンドゾーンにホールド
// 状態で置いてもよい。置けなければ手札に加える。」（atwiki/page-1664）。「SP1」は DSL。特徴は印刷された特徴。
// XG1-090 ウォルター【救助と安全確保】（NC2）「自軍捨札からSユニットのカードを1枚選び、自軍山札の上に置いてもよい。」（atwiki/page-1579）
// 「ウォルター」「バイクル」等からのコンビネーション（ナンバーに関係なく）は NC の成立として判定済み（rules/ncGatedEffects.ts）。

const POLICE_RESCUE_EFFECT_ID = "xg1_089_police_rescue";
const RESCUE_EFFECT_ID = "xg1_090_rescue";

XG1_KEYWORDS["XG1-089::police_rescue"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].discard.filter((c) => isSUnitCard(state, c.cardId) && !printedFeatures(state, c.cardId).includes("警察")).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_089:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-089", POLICE_RESCUE_EFFECT_ID, ids, true)), detail: POLICE_RESCUE_EFFECT_ID };
};

XG1_RESOLVERS[POLICE_RESCUE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const room = commandHasRoom(state, playerId);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    command: room ? [...p.command, { ...stripForZone(card), commandHeld: true }] : p.command,
    hand: room ? p.hand : [...p.hand, stripForZone(card)],
  }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-089", `${POLICE_RESCUE_EFFECT_ID}:${instanceId}:${room ? "command" : "hand"}`) };
};
XG1_SKIPPERS[POLICE_RESCUE_EFFECT_ID] = simpleSkip();

XG1_KEYWORDS["XG1-090::rescue"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].discard.filter((c) => isSUnitCard(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_090:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-090", RESCUE_EFFECT_ID, ids, true)), detail: RESCUE_EFFECT_ID };
};

XG1_RESOLVERS[RESCUE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), deck: [stripForZone(card), ...p.deck] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-090", `${RESCUE_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[RESCUE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-091 ブライアン【外された安全装置】「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからナンバーにＲＣを持つSユニットを1体選び撃破して
// もよい。」（atwiki/page-1678）。ナンバーは印刷されたナンバー。

const SAFETY_OFF_EFFECT_ID = "xg1_091_safety_off";

XG1_KEYWORDS["XG1-091::safety_off"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg1_091:not_own_turn" };
  const ids = state.players[opponent(ctx.playerId)].battle
    .filter((c) => isUnitDef(state, c.cardId) && rk1IsSmallNow(state, c) && getDefinition(state.definitions, c.cardId)?.comboNumber === "RC" && selectableEnemy(state, ctx.playerId, "XG1-091", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_091:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-091", SAFETY_OFF_EFFECT_ID, ids, true)), detail: SAFETY_OFF_EFFECT_ID };
};
registerDestroyPick(SAFETY_OFF_EFFECT_ID, "XG1-091");
XG1_SKIPPERS[SAFETY_OFF_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-092 ソルブレイバー【ケルベロスΔ】「自軍ターン中、これがバトルエリアに出たとき、このターン、これは次の能力を得る⇒このターン中に自軍捨札から手札に
// 加えたSユニットのカード1枚につきBP+2000される。」（atwiki/page-1679。Q1「CN2で発動する」）。発動の記録は XG1_092_KERBEROS_RULE、手札に加えた
// カードの記録は xg1eAfterAction、BP は rules/xg1/xg1Fields.ts xg1BpBonus。

XG1_KEYWORDS["XG1-092::kerberos_delta"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !ownTurn(ctx)) return { state, detail: "xg1_092:not_own_turn" };
  return { state: addTurnMark(state, ctx.playerId, XG1_092_KERBEROS_RULE, "XG1-092", id), detail: "xg1_092:recover_bp" };
};

// ---------------------------------------------------------------------------
// XG1-093 ソルジャンヌ【メディカルパック】（NC1）「自分の手札から1枚選び捨札にしてもよい。そうしたとき、自軍捨札からSユニットのカードを1枚選び、手札に
// 加える。」（atwiki/page-1610）。手札を選ぶ（見送れる）→ 捨札の S ユニットのカードを選ぶ（あれば必ず）。

const MEDICAL_PACK_EFFECT_ID = "xg1_093_medical_pack";
const MEDICAL_PACK_PICK_EFFECT_ID = "xg1_093_medical_pack_pick";

XG1_KEYWORDS["XG1-093::medical_pack"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_093:no_hand" };
  return { state: openAfter(state, { ...pickOne(ctxBase(ctx), "XG1-093", MEDICAL_PACK_EFFECT_ID, ids, true), kind: "select_hand" }), detail: MEDICAL_PACK_EFFECT_ID };
};

XG1_RESOLVERS[MEDICAL_PACK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  const ids = next.players[playerId].discard.filter((c) => isSUnitCard(next, c.cardId)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG1-093", `${MEDICAL_PACK_EFFECT_ID}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, pickOne(pendingBase(pending), "XG1-093", MEDICAL_PACK_PICK_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[MEDICAL_PACK_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[MEDICAL_PACK_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-093", `${MEDICAL_PACK_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-094 ビーファイターテントウ【テントウスピアー】（RC）「敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードを持ち主の山札の上に
// 戻すか、持ち主のコマンドゾーンにホールド状態で置く。」（atwiki/page-1645）。Q1: 敵軍コマンドゾーンが5枚なら必ず山札の上に戻す（選ばない）。

const TENTOU_SPEAR_EFFECT_ID = "xg1_094_tentou_spear";
const TENTOU_SPEAR_PLACE_EFFECT_ID = "xg1_094_tentou_spear_place";

XG1_KEYWORDS["XG1-094::tentou_spear"] = (state, ctx) => {
  if (state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: "xg1_094:empty_deck" };
  return { state: openAfter(state, confirmOptions(ctxBase(ctx), "XG1-094", TENTOU_SPEAR_EFFECT_ID, ["accept"], true)), detail: TENTOU_SPEAR_EFFECT_ID };
};

XG1_RESOLVERS[TENTOU_SPEAR_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = close(state, pending);
  const top = next.players[enemyId].deck[0];
  const log = logFor(state, playerId, "XG1-094", `${TENTOU_SPEAR_EFFECT_ID}:reveal:${top?.instanceId ?? "none"}`);
  if (!top || !commandHasRoom(next, enemyId)) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, confirmOptions(pendingBase(pending), "XG1-094", TENTOU_SPEAR_PLACE_EFFECT_ID, ["deck_top", "command"], false, { xg1Meta: { target: top.instanceId } })), log };
};
XG1_SKIPPERS[TENTOU_SPEAR_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[TENTOU_SPEAR_PLACE_EFFECT_ID] = (state, playerId, option) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  if (option === "command") {
    const id = pending.xg1Meta?.target;
    next = patchPlayer(next, enemyId, (p) => {
      const top = p.deck[0];
      if (!top || top.instanceId !== id) return p;
      return { ...p, deck: p.deck.slice(1), command: [...p.command, { ...stripForZone(top), commandHeld: true }] };
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-094", `${TENTOU_SPEAR_PLACE_EFFECT_ID}:${option}`) };
};

// ---------------------------------------------------------------------------
// XG1-095 ビーファイターカブト【カブトランサー】（RC）「これがバトルで敵軍ユニットを撃破したとき、これが撃破したユニットと同じ特徴を1つ以上持つ敵軍
// コマンドを1つ選び捨札にしてもよい。」（atwiki/page-1523）。RC（「昆虫」からのコンビネーションを含む）を発動したターンに、バトルで撃破したとき。
// 撃破したユニットの特徴はバトルのときの特徴、コマンドの特徴は印刷された特徴。

const KABUTO_LANCER_EFFECT_ID = "xg1_095_kabuto_lancer";
const XG1_095_KABUTO_RULE = "xg1_095_kabuto_lancer";

XG1_KEYWORDS["XG1-095::kabuto_lancer"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg1_095:no_source" };
  return { state: addTurnMark(state, ctx.playerId, XG1_095_KABUTO_RULE, "XG1-095", id), detail: "xg1_095:after_battle" };
};

export function xg1eAfterBattle(
  state: GameState,
  pending: { attackerPlayerId: PlayerId; phasePlayerId: PlayerId; effectBattle?: boolean },
  r: { attacker: CardInstance; defender: CardInstance; defenderOwner: PlayerId; defenderDestroyed: boolean; attackerDestroyed: boolean },
): ((s: GameState) => GameState) | undefined {
  const steps: Array<(s: GameState) => GameState> = [];
  const sides = [
    { self: r.attacker, selfOwner: pending.attackerPlayerId, enemy: r.defender, enemyOwner: r.defenderOwner, enemyDestroyed: r.defenderDestroyed },
    { self: r.defender, selfOwner: r.defenderOwner, enemy: r.attacker, enemyOwner: pending.attackerPlayerId, enemyDestroyed: r.attackerDestroyed },
  ];
  for (const side of sides) {
    if (side.selfOwner === side.enemyOwner || !side.enemyDestroyed || !isSameCardIdentity(side.self.cardId, "XG1-095")) continue;
    if (!hasTurnMark(state, side.selfOwner, XG1_095_KABUTO_RULE, side.self.instanceId)) continue;
    const features = new Set(unitFeatures(state, side.enemyOwner, side.enemy));
    const { selfOwner, enemyOwner } = side;
    const sourceInstanceId = side.self.instanceId;
    steps.push((s) => {
      const ids = s.players[enemyOwner].command.filter((c) => printedFeatures(s, c.cardId).some((f) => features.has(f))).map((c) => c.instanceId);
      if (ids.length === 0) return s;
      return openAfter(s, { ...pickOne({ playerId: selfOwner, phasePlayerId: pending.phasePlayerId, sourceInstanceId }, "XG1-095", KABUTO_LANCER_EFFECT_ID, ids, true), kind: "select_command" });
    });
  }
  if (steps.length === 0) return undefined;
  return (s) => steps.reduce((acc, f) => f(acc), s);
}

XG1_RESOLVERS[KABUTO_LANCER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].command.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-095", `${KABUTO_LANCER_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[KABUTO_LANCER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-096 ビーファイタークワガー【クワガーチョッパー】（RC）「敵軍バトルエリアからリリース状態のSユニットを2体選んでもよい。そうしたとき、相手は次のように
// する⇒その2体をホールドするか、どちらか1体選び撃破する。」（atwiki/page-1661）。2体を1体ずつ選ぶ（最初の1体の前だけ見送れる）。相手は
// 「hold」（2体ともホールド）か、撃破する1体を選ぶ。

const KUWAGA_CHOPPER_EFFECT_ID = "xg1_096_kuwaga_chopper";
const KUWAGA_CHOPPER_ANSWER_EFFECT_ID = "xg1_096_kuwaga_chopper_answer";

XG1_KEYWORDS["XG1-096::kuwaga_chopper"] = (state, ctx) => {
  const ids = state.players[opponent(ctx.playerId)].battle
    .filter((c) => isUnitDef(state, c.cardId) && !c.commandHeld && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG1-096", c))
    .map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "xg1_096:targets_short" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-096", KUWAGA_CHOPPER_EFFECT_ID, ids, true, { selectCount: 2 })), detail: KUWAGA_CHOPPER_EFFECT_ID };
};

XG1_RESOLVERS[KUWAGA_CHOPPER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG1-096", `${KUWAGA_CHOPPER_EFFECT_ID}:${instanceId}`);
  if (selected.length < 2) {
    return { state: { ...state, pendingEffectChoice: { ...pending, optional: false, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)) } }, log };
  }
  const enemyId = opponent(playerId);
  const next = close(state, pending);
  const answer = confirmOptions({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG1-096", KUWAGA_CHOPPER_ANSWER_EFFECT_ID, ["hold", ...selected], false, {
    xg1Meta: { steps: selected, ownerId: playerId },
  });
  return { state: openNext(next, pending, answer), log };
};
XG1_SKIPPERS[KUWAGA_CHOPPER_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[KUWAGA_CHOPPER_ANSWER_EFFECT_ID] = (state, playerId, option) => {
  const pending = state.pendingEffectChoice!;
  const ids = pending.xg1Meta?.steps ?? [];
  const effectOwner = pending.xg1Meta?.ownerId ?? opponent(playerId);
  let next = close(state, pending);
  if (option === "hold") next = holdFieldUnits(next, playerId, ids);
  else next = destroyAll(next, { playerId: effectOwner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG1-096", `${KUWAGA_CHOPPER_ANSWER_EFFECT_ID}_destroy`, [option]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-096", `${KUWAGA_CHOPPER_ANSWER_EFFECT_ID}:${option}`) };
};

// ---------------------------------------------------------------------------
// XG1-097 ビーファイターアゲハ【ブルームキャノン】（NC4）「敵軍ユニットをBPの合計が5000以下になるように選び撃破してもよい。ただし選べるユニットの数は、
// これ以外の特徴「昆虫」を持つ自軍バトルエリアのユニットの数までとする。」（atwiki/page-1577）。エリア・サイズを問わない（カード評価）。
// 1体ずつ選び、数の上限に達するか、残りの BP に収まる候補がなくなるか、確定すれば撃破する。BP はいまの BP。

const BLOOM_CANNON_EFFECT_ID = "xg1_097_bloom_cannon";
const BLOOM_BUDGET = 5000;

function bloomCandidates(state: GameState, playerId: PlayerId, exclude: string[], budget: number): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => !exclude.includes(c.instanceId) && selectableEnemy(state, playerId, "XG1-097", c) && effectiveBp(state, enemyId, c) <= budget)
    .map((c) => c.instanceId);
}

XG1_KEYWORDS["XG1-097::bloom_cannon"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  const limit = battleUnitsOf(state, ctx.playerId).filter((c) => c.instanceId !== id && unitFeatures(state, ctx.playerId, c).includes("昆虫")).length;
  if (limit === 0) return { state, detail: "xg1_097:no_insects" };
  const ids = bloomCandidates(state, ctx.playerId, [], BLOOM_BUDGET);
  if (ids.length === 0) return { state, detail: "xg1_097:no_targets" };
  return {
    state: openAfter(state, pickOne(ctxBase(ctx), "XG1-097", BLOOM_CANNON_EFFECT_ID, ids, true, { selectCount: limit, mayConfirm: true, xg1Meta: { count: limit } })),
    detail: BLOOM_CANNON_EFFECT_ID,
  };
};

function bloomFinish(state: GameState, pending: PendingEffectChoice, selected: string[]) {
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG1-097", `${BLOOM_CANNON_EFFECT_ID}_destroy`, selected);
  return { state: proceed(next, pending), log: logFor(state, pending.playerId, "XG1-097", `${BLOOM_CANNON_EFFECT_ID}:${selected.join(",")}`) };
}

XG1_RESOLVERS[BLOOM_CANNON_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const limit = pending.xg1Meta?.count ?? 1;
  const enemyId = opponent(playerId);
  const used = selected.reduce((acc, id) => {
    const c = findField(state, enemyId, id);
    return acc + (c ? effectiveBp(state, enemyId, c) : 0);
  }, 0);
  if (used > BLOOM_BUDGET) return { error: "bp_budget_exceeded" };
  const rest = bloomCandidates(state, playerId, selected, BLOOM_BUDGET - used);
  if (selected.length >= limit || rest.length === 0) return bloomFinish(state, pending, selected);
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest } } };
};
XG1_CONFIRMERS[BLOOM_CANNON_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return bloomFinish(state, pending, pending.selectedInstanceIds ?? []);
};
XG1_SKIPPERS[BLOOM_CANNON_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  if ((pending.selectedInstanceIds?.length ?? 0) > 0) return bloomFinish(state, pending, pending.selectedInstanceIds ?? []);
  return simpleSkip()(state, playerId);
};

// ---------------------------------------------------------------------------
// XG1-098 猛毒鎧将デスコーピオン【ポイズンアンカー】「これが自軍エリアにある間、自分も相手も次のようにする⇒自分自身のターンを終えるとき、特徴「男」
// または「女」または「獣」または「恐竜」を持つホールド状態のユニットを1体選び撃破する。」（atwiki/page-1562）
// どちらの場にあっても、ターンを終えるプレイヤーが（デスコーピオン1体につき1回）選ぶ。自軍・敵軍、エリア・サイズを問わない（カード評価）。見送れない。

const POISON_ANCHOR_EFFECT_ID = "xg1_098_poison_anchor";
const POISON_FEATURES = ["男", "女", "獣", "恐竜"];

XG1_KEYWORDS["XG1-098::poison_anchor"] = noop("xg1_098:turn_end");

export function collectXg1eTurnEndQueue(state: GameState): string[] {
  const out: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    for (const c of fieldUnits(state, pid)) if (isSameCardIdentity(c.cardId, "XG1-098")) out.push(`poison:${pid}:${c.instanceId}`);
  }
  return out;
}

/** collectXg1eTurnEndQueue の1件を開く（xg1e の件でなければ null）。 */
export function openXg1eTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState | null {
  const m = entry.match(/^poison:(player[12]):(.*)$/s);
  if (!m) return null;
  const ownerId = m[1] as PlayerId;
  const sourceInstanceId = m[2]!;
  if (!zoneOfField(state, ownerId, sourceInstanceId)) return state;
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    for (const c of fieldUnits(state, pid)) {
      if (!c.commandHeld || !unitFeatures(state, pid, c).some((f) => POISON_FEATURES.includes(f))) continue;
      if (pid !== endingPlayerId && !selectableEnemy(state, endingPlayerId, "XG1-098", c)) continue;
      ids.push(c.instanceId);
    }
  }
  if (ids.length === 0) return state;
  return openEffectChoice(state, pickOne({ playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId }, "XG1-098", POISON_ANCHOR_EFFECT_ID, ids, false));
}

XG1_RESOLVERS[POISON_ANCHOR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG1-098", `${POISON_ANCHOR_EFFECT_ID}_destroy`, [instanceId]);
  return { state: next, log: logFor(state, playerId, "XG1-098", `${POISON_ANCHOR_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-099 ガンツ先生【採点】「これが自軍エリアにある間、自軍バトルフェイズ中、次の効果を発動できる⇒Sユニットを1体選んでから、自軍コマンドを1つ
// ホールドする。このターン、選んだユニットの必要パワーの数字は、ホールドした自軍コマンドの必要パワーの数字になる。」（atwiki/page-1590）
// 起動（rules/fieldActivatedAbilities.ts）。S ユニットはどちらの軍でもよい（敵軍は選べるものだけ）。必要パワーの数字は記録（XG1_099_SAITEN_RULE。
// payload { instanceId, cost }）するが、必要パワーを読む処理の多くはカードの印刷された値を見る（XG1-gaps.md）。

const SAITEN_EFFECT_ID = "xg1_099_saiten";
const SAITEN_HOLD_EFFECT_ID = "xg1_099_saiten_hold";

XG1_KEYWORDS["XG1-099::saiten"] = noop("xg1_099:field_ability");

function saitenTargets(state: GameState, playerId: PlayerId): string[] {
  const own = fieldUnits(state, playerId).filter((c) => rk1IsSmallNow(state, c));
  const enemy = fieldUnits(state, opponent(playerId)).filter((c) => rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, "XG1-099", c));
  return [...own, ...enemy].map((c) => c.instanceId);
}

export function isXg1eFieldAbilityCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, "XG1-099");
}

export function canActivateXg1eFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!isSameCardIdentity(card.cardId, "XG1-099") || state.activePlayer !== playerId || state.phase !== "battle") return false;
  if (!zoneOfField(state, playerId, card.instanceId)) return false;
  return releasedCommands(state, playerId).length > 0 && saitenTargets(state, playerId).length > 0;
}

export function activateXg1eFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return openEffectChoice(state, pickOne({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG1-099", SAITEN_EFFECT_ID, saitenTargets(state, playerId), false));
}

XG1_RESOLVERS[SAITEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const log = logFor(state, playerId, "XG1-099", `${SAITEN_EFFECT_ID}:${instanceId}`);
  return { state: holdThen(next, pendingBase(pending), "XG1-099", SAITEN_HOLD_EFFECT_ID, releasedCommands(next, playerId), 1, { xg1Meta: { target: instanceId } }), log };
};

registerHold(SAITEN_HOLD_EFFECT_ID, (state, pending, holdIds) => {
  const target = pending.xg1Meta?.target;
  const cmd = state.players[pending.playerId].command.find((c) => c.instanceId === holdIds[0]);
  if (!target || !cmd) return proceed(state, pending);
  const cost = costNumber(state, cmd.cardId);
  const next = patchPlayer(state, pending.playerId, (p) => ({
    ...p,
    modifiers: [...(p.modifiers ?? []), { kind: "rule", ruleId: XG1_099_SAITEN_RULE, scope: "turn", sourceCardId: "XG1-099", payload: { instanceId: target, cost } }],
  }));
  return proceed(next, pending);
});

// ---------------------------------------------------------------------------
// XG1-100 ロボコン【お手伝いロボット】「これが自軍バトルエリアからラッシュエリアに戻るとき、自軍山札の上から1枚引いて、そのカードを自軍コマンドゾーンに
// ホールド状態で置いてもよい。置けなければこの効果は発動できない。」（atwiki/page-1669）。スタートフェイズに戻すとき（rules/startPhase.ts）。

const HELPER_ROBOT_EFFECT_ID = "xg1_100_helper_robot";

XG1_KEYWORDS["XG1-100::helper_robot"] = noop("xg1_100:battle_to_rush");

export function xg1eBattleToRush(state: GameState, ownerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  if (!isSameCardIdentity(card.cardId, "XG1-100")) return state;
  if (!commandHasRoom(state, ownerId) || state.players[ownerId].deck.length === 0) return state;
  return openEffectChoice(state, confirmOptions({ playerId: ownerId, phasePlayerId, sourceInstanceId: card.instanceId }, "XG1-100", HELPER_ROBOT_EFFECT_ID, ["accept"], true));
}

XG1_RESOLVERS[HELPER_ROBOT_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = deckTopToCommandHeld(close(state, pending), playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-100", `${HELPER_ROBOT_EFFECT_ID}:accept`) };
};
XG1_SKIPPERS[HELPER_ROBOT_EFFECT_ID] = simpleSkip();
