/**
 * クロスギャザー ザ・ファーストエンカウント XG1-061〜XG1-080（仮面ライダーカリス〜仮面ライダーアビス）のカード固有の効果
 * （cardSpec XG1-061-080 の監査）。
 *
 * - DSL の `xg1::XG1-NNN::name` から呼ばれる効果（RC・NC・バトルエリアに出たとき・オペレーション）。
 * - フックから呼ぶもの:
 *   - `xg1dTrackHandDiscards`: XG1-063【トルネードチェイサー】（core/applyAction.ts の後処理。手札のカードが捨札に置かれたか）。
 *   - `openXg1dBeforeFlip`: XG1-071 の【アタックライド】（rules/damagePayment.ts flipPowerForDamage。「ウラ返すとき」）。
 * 継続効果（XG1-068 の BP）は rules/xg1/xg1Fields.ts。
 */
import { isSameCardIdentity, fusionMaterialAliasNames } from "@rangers-strike/cards";
import type { GameAction } from "../../types/actions";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import type { DamagePaymentResume } from "../../types/game";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { unitFeatures } from "../addedFeatures";
import { patchPlayer } from "../playerPatches";
import { recordReveal, revealedCards } from "../revealNotice";
import { returnToDeckInOrder } from "../deckOrder";
import { openEffectChoice } from "../pendingChoices";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { RK11_RELEASE_AT_END_RULE, RK11_SP1_RULE } from "../rk/rk11Fields";
import { grantSp1ToRushUnit } from "../srEffects";
import {
  type BaseCtx,
  base,
  close,
  confirmChoice,
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
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
} from "../rm/rm1Effects";
import { XG1_068_KUUGA_RULE } from "./xg1Fields";
import { XG1_CONFIRMERS, XG1_KEYWORDS, XG1_RESOLVERS, XG1_SKIPPERS, noop } from "./xg1Core";
import { addTurnMark, costNumber, enemySUnits, hasTurnMark, holdCommands, isUnitDef, printedFeatures, releasedCommands, unitCatsNow } from "./xg1Shared";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";
import { gateReveal } from "../revealGate";

function pickOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function confirmOptions(ctx: BaseCtx, sourceCardId: string, effectId: string, options: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: options, selectCount: 1, optional, ...extra };
}

function ownTurn(ctx: GrantKeywordContext): boolean {
  return ctx.phasePlayerId === ctx.playerId;
}

/** 場のユニットをその場でホールド状態にする。 */
function holdFieldUnits(state: GameState, ownerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const hold = (c: CardInstance): CardInstance => (ids.includes(c.instanceId) ? { ...c, commandHeld: true } : c);
    return { ...p, rush: p.rush.map(hold), battle: p.battle.map(hold) };
  });
}

/** 敵軍バトルエリアの、選べる S ユニット。 */
function enemyBattleSUnits(state: GameState, playerId: PlayerId, sourceCardId: string, pred: (c: CardInstance) => boolean = () => true): string[] {
  return state.players[opponent(playerId)].battle
    .filter((c) => isUnitDef(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, playerId, sourceCardId, c) && pred(c))
    .map((c) => c.instanceId);
}

function registerDestroyPick(effectId: string, sourceCardId: string, after?: (state: GameState, pending: PendingEffectChoice) => GameState): void {
  XG1_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), sourceCardId, `${effectId}_destroy`, [instanceId]);
    return { state: after ? after(next, pending) : proceed(next, pending), log: logFor(state, playerId, sourceCardId, `${effectId}:${instanceId}`) };
  };
}

/**
 * 「自分の手札を N 枚選び、相手に見せてもよい」— 手札を1枚ずつ N 枚選ぶ選択（最初の1枚の前だけ見送れる）。選び終えたら done。
 * 手札が N 枚に足りなければ開かない。
 */
function registerHandShow(effectId: string, sourceCardId: string, n: number, done: (state: GameState, pending: PendingEffectChoice, shown: string[]) => GameState): void {
  XG1_RESOLVERS[effectId] = (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const log = logFor(state, playerId, sourceCardId, `${effectId}:${instanceId}`);
    if (selected.length < n) {
      return { state: { ...state, pendingEffectChoice: { ...pending, optional: false, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)) } }, log };
    }
    return { state: done(close(state, pending), pending, selected), log };
  };
  XG1_SKIPPERS[effectId] = simpleSkip();
}

function openHandShow(state: GameState, ctx: BaseCtx, sourceCardId: string, effectId: string, n: number): GameState | null {
  const hand = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (hand.length < n) return null;
  return openAfter(state, { ...pickOne(ctx, sourceCardId, effectId, hand, true), kind: "select_hand", selectCount: n, selectedInstanceIds: [] });
}

function handCards(state: GameState, playerId: PlayerId, ids: string[]): CardInstance[] {
  return state.players[playerId].hand.filter((c) => ids.includes(c.instanceId));
}

/** 見せたカード（手札）のカテゴリがすべて同じか（共通のカテゴリが1つ以上ある）。 */
function shareCategory(state: GameState, cards: CardInstance[]): boolean {
  const sets = cards.map((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return new Set(d ? (cardCategories(d) as string[]) : []);
  });
  if (sets.length === 0) return false;
  return [...sets[0]!].some((cat) => sets.every((s) => s.has(cat)));
}

// ---------------------------------------------------------------------------
// XG1-061 仮面ライダーカリス【スピニングウェーブ】（RC）
// 「自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍コマンドをすべてホールドする。その後、見せたカードの必要パワーの数字が「3」と「6」なら、
//  敵軍バトルエリアからSユニットを1体選び撃破する。」（atwiki/page-1639）。見せたカードは手札に残る。

const SPINNING_WAVE_EFFECT_ID = "xg1_061_spinning_wave";
const SPINNING_WAVE_DESTROY_EFFECT_ID = "xg1_061_spinning_wave_destroy";

XG1_KEYWORDS["XG1-061::spinning_wave"] = (state, ctx) => {
  const opened = openHandShow(state, ctxBase(ctx), "XG1-061", SPINNING_WAVE_EFFECT_ID, 2);
  return opened ? { state: opened, detail: SPINNING_WAVE_EFFECT_ID } : { state, detail: "xg1_061:hand_short" };
};

registerHandShow(SPINNING_WAVE_EFFECT_ID, "XG1-061", 2, (state, pending, shown) => {
  const playerId = pending.playerId;
  const enemyId = opponent(playerId);
  const costs = handCards(state, playerId, shown).map((c) => costNumber(state, c.cardId)).sort((a, b) => a - b);
  let next = holdCommands(state, enemyId, state.players[enemyId].command.map((c) => c.instanceId));
  if (costs[0] !== 3 || costs[1] !== 6) return proceed(next, pending);
  const ids = enemyBattleSUnits(next, playerId, "XG1-061");
  if (ids.length === 0) return proceed(next, pending);
  next = openNext(next, pending, pickOne(pendingBase(pending), "XG1-061", SPINNING_WAVE_DESTROY_EFFECT_ID, ids, false));
  return next;
});
registerDestroyPick(SPINNING_WAVE_DESTROY_EFFECT_ID, "XG1-061");

// ---------------------------------------------------------------------------
// XG1-063 シャドーチェイサー【トルネードチェイサー】
// 「これにライドしたユニットがある間、自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒敵軍コマンドを1つ選びホールドする。」
// （atwiki/page-1606）。1つの処理（アクション）の前後で、手札から捨札に移ったカード1枚ごとに、リリース状態の敵軍コマンドを1つ選ぶ選択を開く
// （選ぶ＝発動する。見送れる）。使ったオペレーションが捨札になるのは「使った」のであって含めない。

const TORNADO_EFFECT_ID = "xg1_063_tornado_chaser";

XG1_KEYWORDS["XG1-063::tornado_chaser"] = noop("xg1_063:hand_discard");

function shadowChaserRidden(state: GameState, ownerId: PlayerId): string | undefined {
  const field = [...state.players[ownerId].rush, ...state.players[ownerId].battle];
  return field.find((v) => isSameVehicleTextIdentity(v.cardId, "XG1-063") && field.some((c) => c.mountedOnInstanceId === v.instanceId))?.instanceId;
}

function usedOperationId(before: GameState, action: GameAction): string | undefined {
  if (action.type === "play_operation") return action.instanceId;
  if (action.type === "initiate_command_payment") return action.sourceInstanceId;
  if (action.type === "resolve_command_payment") return before.pendingCommandPayment?.sourceInstanceId;
  return undefined;
}

export function xg1dTrackHandDiscards(before: GameState, after: GameState, action: GameAction): GameState {
  if (after.winner) return after;
  let next = after;
  const used = usedOperationId(before, action);
  for (const pid of ["player1", "player2"] as const) {
    const chaser = shadowChaserRidden(after, pid);
    if (!chaser) continue;
    const prevDiscard = new Set(before.players[pid].discard.map((c) => c.instanceId));
    const nowHand = new Set(after.players[pid].hand.map((c) => c.instanceId));
    const nowDiscard = new Set(after.players[pid].discard.map((c) => c.instanceId));
    const moved = before.players[pid].hand.filter((c) => c.instanceId !== used && !nowHand.has(c.instanceId) && nowDiscard.has(c.instanceId) && !prevDiscard.has(c.instanceId));
    const phasePlayerId = after.pendingEffectChoice?.phasePlayerId ?? before.pendingEffectChoice?.phasePlayerId ?? after.activePlayer;
    for (const card of moved) {
      const ids = releasedCommands(next, opponent(pid));
      if (ids.length === 0) break;
      next = openAfter(next, { ...pickOne({ playerId: pid, phasePlayerId, sourceInstanceId: chaser }, "XG1-063", TORNADO_EFFECT_ID, ids, true), kind: "select_commands", xg1Meta: { target: card.instanceId } });
    }
  }
  return next;
}

XG1_RESOLVERS[TORNADO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdCommands(close(state, pending), opponent(playerId), [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-063", `${TORNADO_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[TORNADO_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-064 ディケイド アギトGF【アタックライド】（RC）「DAを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-1603）
// エリアを問わない。カテゴリはいまのカテゴリ。※「仮面ライダーアギトGF」としてつかえる、は rules/zordDown.ts・rules/zord.ts（カード名の照合）。

const DECADE_AGITO_EFFECT_ID = "xg1_064_attack_ride";

XG1_KEYWORDS["XG1-064::attack_ride"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = enemySUnits(state, ctx.playerId, "XG1-064", (c) => unitCatsNow(state, enemyId, c).includes("DA"));
  if (ids.length === 0) return { state, detail: "xg1_064:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-064", DECADE_AGITO_EFFECT_ID, ids, false)), detail: DECADE_AGITO_EFFECT_ID };
};
registerDestroyPick(DECADE_AGITO_EFFECT_ID, "XG1-064");

// ---------------------------------------------------------------------------
// XG1-065 ディケイド 龍騎【アタックライド】
// 「特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」」（atwiki/page-1636）
// 自軍ターンにバトルエリアに出たとき、バトルエリアで1つ前に並ぶユニットが特徴「ドラゴン」を持てば「SP1」。

XG1_KEYWORDS["XG1-065::attack_ride"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !ownTurn(ctx)) return { state, detail: "xg1_065:not_own_turn" };
  const battle = state.players[ctx.playerId].battle;
  const idx = battle.findIndex((c) => c.instanceId === id);
  const prev = idx > 0 ? battle[idx - 1] : undefined;
  if (!prev || !unitFeatures(state, ctx.playerId, prev).includes("ドラゴン")) return { state, detail: "xg1_065:no_dragon" };
  return { state: grantSp1ToRushUnit(state, ctx.playerId, id), detail: "xg1_065:sp1" };
};

// ---------------------------------------------------------------------------
// XG1-066 ディケイド ファイズ【アタックライド】（RC）「BPの下三桁が500の敵軍Sユニットを1体選び撃破する。」（atwiki/page-1626）
// いまの BP。エリアを問わない。XG1-078 コピーベントで別のユニットの【アタックライド】になっても、XG1-066 の効果として開く。

const DECADE_FAIZ_EFFECT_ID = "xg1_066_attack_ride";

XG1_KEYWORDS["XG1-066::attack_ride"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = enemySUnits(state, ctx.playerId, "XG1-066", (c) => effectiveBp(state, enemyId, c) % 1000 === 500);
  if (ids.length === 0) return { state, detail: "xg1_066:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-066", DECADE_FAIZ_EFFECT_ID, ids, false)), detail: DECADE_FAIZ_EFFECT_ID };
};
registerDestroyPick(DECADE_FAIZ_EFFECT_ID, "XG1-066");

// ---------------------------------------------------------------------------
// XG1-067 ディケイド ブレイド【アタックライド】（RC）
// 「自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの持つカテゴリがすべて同じなら、
//  敵軍バトルエリアからSユニットを1体選び撃破する。」（atwiki/page-1605）。ホールドする S ユニットはエリアを問わない（リリース状態のもの）。

const DECADE_BLADE_EFFECT_ID = "xg1_067_attack_ride";
const DECADE_BLADE_HOLD_EFFECT_ID = "xg1_067_attack_ride_hold";
const DECADE_BLADE_DESTROY_EFFECT_ID = "xg1_067_attack_ride_destroy";

XG1_KEYWORDS["XG1-067::attack_ride"] = (state, ctx) => {
  const opened = openHandShow(state, ctxBase(ctx), "XG1-067", DECADE_BLADE_EFFECT_ID, 3);
  return opened ? { state: opened, detail: DECADE_BLADE_EFFECT_ID } : { state, detail: "xg1_067:hand_short" };
};

function bladeDestroyStep(state: GameState, pending: PendingEffectChoice): GameState {
  if (!pending.xg1Meta?.count) return proceed(state, pending);
  const ids = enemyBattleSUnits(state, pending.playerId, "XG1-067");
  if (ids.length === 0) return proceed(state, pending);
  return openNext(state, pending, pickOne(pendingBase(pending), "XG1-067", DECADE_BLADE_DESTROY_EFFECT_ID, ids, false));
}

registerHandShow(DECADE_BLADE_EFFECT_ID, "XG1-067", 3, (state, pending, shown) => {
  const same = shareCategory(state, handCards(state, pending.playerId, shown));
  const meta = { xg1Meta: { count: same ? 1 : 0 } };
  const ids = enemySUnits(state, pending.playerId, "XG1-067", (c) => !c.commandHeld);
  if (ids.length === 0) return bladeDestroyStep(state, { ...pending, ...meta });
  return openNext(state, pending, pickOne(pendingBase(pending), "XG1-067", DECADE_BLADE_HOLD_EFFECT_ID, ids, false, meta));
});

XG1_RESOLVERS[DECADE_BLADE_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdFieldUnits(close(state, pending), opponent(playerId), [instanceId]);
  return { state: bladeDestroyStep(next, pending), log: logFor(state, playerId, "XG1-067", `${DECADE_BLADE_HOLD_EFFECT_ID}:${instanceId}`) };
};
registerDestroyPick(DECADE_BLADE_DESTROY_EFFECT_ID, "XG1-067");

// ---------------------------------------------------------------------------
// XG1-068 ディケイド クウガMF【アタックライド】（RC）「このターン、これは特徴「警察」を持つ自軍ユニット1体につきBP+1000される。」（atwiki/page-1668）
// 発動したことを記録し、BP は rules/xg1/xg1Fields.ts xg1BpBonus で数える（エリアを問わない。いまの数）。


XG1_KEYWORDS["XG1-068::attack_ride"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg1_068:no_source" };
  return { state: addTurnMark(state, ctx.playerId, XG1_068_KUUGA_RULE, "XG1-068", id), detail: "xg1_068:police_bp" };
};

// ---------------------------------------------------------------------------
// XG1-069 ディケイド 響鬼【アタックライド】（NC1）
// 「自分の手札からオペレーションカードを1枚選び、捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」になり、このターンを終えるとき
//  ホールド状態なら、リリースしてもよい。」（atwiki/page-1604）。発動するかを確認し、発動すれば手札のオペレーションを1枚選ぶ。
// 得る能力は RK-221 仮面ライダー響鬼【音撃打・火炎連打】と同じ記録（rules/rk/rk11Fields.ts の SP1・ターンを終えるときのリリース）。

const DECADE_HIBIKI_EFFECT_ID = "xg1_069_attack_ride";
const DECADE_HIBIKI_PICK_EFFECT_ID = "xg1_069_attack_ride_pick";

function handOperations(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "operation").map((c) => c.instanceId);
}

XG1_KEYWORDS["XG1-069::attack_ride"] = (state, ctx) => {
  if (handOperations(state, ctx.playerId).length === 0) return { state, detail: "xg1_069:no_operation" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG1-069", DECADE_HIBIKI_EFFECT_ID)), detail: DECADE_HIBIKI_EFFECT_ID };
};

XG1_CONFIRMERS[DECADE_HIBIKI_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ids = handOperations(state, playerId);
  const log = logFor(state, playerId, "XG1-069", `${DECADE_HIBIKI_EFFECT_ID}:accept`);
  if (ids.length === 0) return { state: proceed(close(state, pending), pending), log };
  return { state: openNext(close(state, pending), pending, { ...pickOne(pendingBase(pending), "XG1-069", DECADE_HIBIKI_PICK_EFFECT_ID, ids, false), kind: "select_hand" }), log };
};
XG1_RESOLVERS[DECADE_HIBIKI_EFFECT_ID] = () => ({ error: "invalid_target" });
XG1_SKIPPERS[DECADE_HIBIKI_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[DECADE_HIBIKI_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] }));
  const selfId = pending.sourceInstanceId;
  if (selfId) {
    next = addTurnMark(next, playerId, RK11_SP1_RULE, "XG1-069", selfId);
    next = addTurnMark(next, playerId, RK11_RELEASE_AT_END_RULE, "XG1-069", selfId);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-069", `${DECADE_HIBIKI_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-070 ディケイド カブトRF【アタックライド】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを3つホールドしてもよい。そうしたとき、このターン、これは「SP1」になる。」（atwiki/page-1602）
// RK-065 と同じ選択（hold_ot_commands_then_sp。rules/pendingChoices.ts で SP1 にする）で、コマンドのカテゴリを問わない。

XG1_KEYWORDS["XG1-070::attack_ride"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !ownTurn(ctx)) return { state, detail: "xg1_070:not_own_turn" };
  const ids = releasedCommands(state, ctx.playerId);
  if (ids.length < 3) return { state, detail: "xg1_070:commands_short" };
  return {
    state: openAfter(state, {
      ...base(ctxBase(ctx), "XG1-070"),
      effectId: "hold_ot_commands_then_sp",
      kind: "select_command",
      validInstanceIds: ids,
      selectCount: 3,
      optional: true,
      commandAction: "hold",
    }),
    detail: "xg1_070:hold_3",
  };
};

// ---------------------------------------------------------------------------
// XG1-071 ディケイド 電王SF【アタックライド】（RC）
// 「「SP1」これがストライクして相手がパワーゾーンのカードをウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選び撃破する。」
// （atwiki/page-1600）。「SP1」は DSL。RC を発動したことを記録し、「ウラ返すとき」（RK-066 と同じ所）で撃破するユニットを選ぶ（見送れない）。

const DECADE_DEN_O_EFFECT_ID = "xg1_071_attack_ride";
const XG1_071_DEN_O_RULE = "xg1_071_den_o_sf";

XG1_KEYWORDS["XG1-071::attack_ride"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg1_071:no_source" };
  return { state: addTurnMark(state, ctx.playerId, XG1_071_DEN_O_RULE, "XG1-071", id), detail: "xg1_071:before_flip" };
};

export function openXg1dBeforeFlip(state: GameState, damagedPlayerId: PlayerId, flipIds: string[], resume: DamagePaymentResume): GameState | null {
  if (flipIds.length === 0 || resume.kind !== "strike" || state.pendingEffectChoice) return null;
  const strikerId = opponent(damagedPlayerId);
  if (resume.pending.strikerPlayerId !== strikerId) return null;
  const striker = state.players[strikerId].battle.find((c) => c.instanceId === resume.pending.strikerInstanceId);
  if (!striker || !isSameCardIdentity(striker.cardId, "XG1-071") || !hasTurnMark(state, strikerId, XG1_071_DEN_O_RULE, striker.instanceId)) return null;
  const costs = new Set(state.players[damagedPlayerId].power.filter((c) => flipIds.includes(c.instanceId)).map((c) => costNumber(state, c.cardId)).filter((n) => Number.isFinite(n)));
  const ids = fieldUnits(state, damagedPlayerId)
    .filter((c) => costs.has(costNumber(state, c.cardId)) && selectableEnemy(state, strikerId, "XG1-071", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, pickOne({ playerId: strikerId, phasePlayerId: resume.pending.battlePhasePlayer, sourceInstanceId: striker.instanceId }, "XG1-071", DECADE_DEN_O_EFFECT_ID, ids, false));
}
registerDestroyPick(DECADE_DEN_O_EFFECT_ID, "XG1-071");

// ---------------------------------------------------------------------------
// XG1-072 ディケイド キバ【アタックライド】
// 「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンに
//  ダメージにして置く。」（atwiki/page-1601）
// XG1-075 仮面ライダーダークキバ【キングスバーストエンド】
// 「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍パワーゾーンのオモテ向きのカードを1枚選び、選んだカードの
//  必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットがあればすべて撃破する。このとき、1体以上撃破したなら、選んだカードをダメージにする。」
// （atwiki/page-1662）。どちらも「ホールドする」を確認してから対象を選ぶ（対象は見送れない）。

const DECADE_KIVA_EFFECT_ID = "xg1_072_attack_ride";
const DECADE_KIVA_PICK_EFFECT_ID = "xg1_072_attack_ride_pick";
const DARK_KIVA_EFFECT_ID = "xg1_075_kings_burst_end";
const DARK_KIVA_PICK_EFFECT_ID = "xg1_075_kings_burst_end_pick";

function holdSelfPrompt(cardId: string, effectId: string) {
  return (state: GameState, ctx: GrantKeywordContext) => {
    const id = ctx.triggerSourceInstanceId;
    if (!id || !ownTurn(ctx)) return { state, detail: `${effectId}:not_own_turn` };
    const self = findField(state, ctx.playerId, id);
    if (!self || self.commandHeld) return { state, detail: `${effectId}:cannot_hold` };
    return { state: openAfter(state, confirmOptions(ctxBase(ctx), cardId, effectId, ["accept"], true)), detail: effectId };
  };
}

function holdSelf(state: GameState, pending: PendingEffectChoice): GameState {
  return pending.sourceInstanceId ? holdFieldUnits(state, pending.playerId, [pending.sourceInstanceId]) : state;
}

XG1_KEYWORDS["XG1-072::attack_ride"] = holdSelfPrompt("XG1-072", DECADE_KIVA_EFFECT_ID);

XG1_RESOLVERS[DECADE_KIVA_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdSelf(close(state, pending), pending);
  const ids = enemyBattleSUnits(next, playerId, "XG1-072");
  const log = logFor(state, playerId, "XG1-072", `${DECADE_KIVA_EFFECT_ID}:hold`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, pickOne(pendingBase(pending), "XG1-072", DECADE_KIVA_PICK_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[DECADE_KIVA_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[DECADE_KIVA_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-072", `${DECADE_KIVA_PICK_EFFECT_ID}:${instanceId}`) };
};

XG1_KEYWORDS["XG1-075::kings_burst_end"] = holdSelfPrompt("XG1-075", DARK_KIVA_EFFECT_ID);

XG1_RESOLVERS[DARK_KIVA_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdSelf(close(state, pending), pending);
  const ids = next.players[opponent(playerId)].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG1-075", `${DARK_KIVA_EFFECT_ID}:hold`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, pickOne(pendingBase(pending), "XG1-075", DARK_KIVA_PICK_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[DARK_KIVA_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[DARK_KIVA_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const n = costNumber(state, card.cardId);
  let next = close(state, pending);
  const targets = Number.isFinite(n) ? enemySUnits(next, playerId, "XG1-075", (c) => costNumber(next, c.cardId) === n) : [];
  if (targets.length > 0) {
    next = destroyAll(next, pendingBase(pending), "XG1-075", `${DARK_KIVA_PICK_EFFECT_ID}_destroy`, targets);
    next = patchPlayer(next, enemyId, (p) => {
      const hit = p.power.some((c) => c.instanceId === instanceId && !c.faceDown);
      return hit ? { ...p, power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: true } : c)), damage: p.damage + 1 } : p;
    });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-075", `${DARK_KIVA_PICK_EFFECT_ID}:${instanceId}:${targets.length}`) };
};

// ---------------------------------------------------------------------------
// XG1-076 ディケイドライバー（オペレーション）
// 「次の効果から1つ選び発動する⇒ ◎自軍山札を見て、「仮面ライダーディケイド」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後山札をシャッフル
//  する。 ◎自軍山札を見て、特徴「ディケイドライバー」を持つユニットカードを1枚選び、自軍パワーゾーンに置いてもよい。その後山札をシャッフルする。」
// （atwiki/page-1616）。ラッシュエリアに出すのは効果のラッシュ（コメント「場に出たら「ラッシュ」扱い」）。「仮面ライダーディケイド」は
// カード名（「○○としてつかえる」を含む）のユニットカード。選ばなくても山札はシャッフルする。選べるカードがなくても山札を見る窓を開く
// （山札の全部を見るだけのカードとして見せ、見送ると山札をシャッフルする）。

const DECADRIVER_EFFECT_ID = "xg1_076_decadriver";
const DECADRIVER_RUSH_EFFECT_ID = "xg1_076_decadriver_rush";
const DECADRIVER_POWER_EFFECT_ID = "xg1_076_decadriver_power";

function namedDecade(state: GameState, cardId: string): boolean {
  const d = getDefinition(state.definitions, cardId);
  if (d?.type !== "unit") return false;
  return sameCardName(d.name, "仮面ライダーディケイド") || fusionMaterialAliasNames(d.text).some((n) => sameCardName(n, "仮面ライダーディケイド"));
}

XG1_KEYWORDS["XG1-076::decadriver"] = (state, ctx) => ({
  state: openAfter(state, confirmOptions(ctxBase(ctx), "XG1-076", DECADRIVER_EFFECT_ID, ["mode_1", "mode_2"], false)),
  detail: DECADRIVER_EFFECT_ID,
});

XG1_RESOLVERS[DECADRIVER_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const deck = cleared.players[playerId].deck;
  const ids = (mode === "mode_1" ? deck.filter((c) => namedDecade(cleared, c.cardId)) : deck.filter((c) => isUnitDef(cleared, c.cardId) && printedFeatures(cleared, c.cardId).includes("ディケイドライバー"))).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG1-076", `${DECADRIVER_EFFECT_ID}:${mode}`);
  if (deck.length === 0) return { state: proceed(shuffleDeck(cleared, playerId), pending), log };
  // 「山札を見て」: 選べるカードがなくても山札の全部を見せる（見るだけのカードは viewedInstanceIds）。選べるカードがなければ見送るだけ。
  const effectId = mode === "mode_1" ? DECADRIVER_RUSH_EFFECT_ID : DECADRIVER_POWER_EFFECT_ID;
  const viewedInstanceIds = deck.map((c) => c.instanceId);
  return { state: openNext(cleared, pending, pickOne(pendingBase(pending), "XG1-076", effectId, ids, true, { viewedInstanceIds })), log };
};

XG1_RESOLVERS[DECADRIVER_RUSH_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: effectRushPicked(state, pending, playerId, instanceId, "deck", (s) => shuffleDeck(s, playerId)), log: logFor(state, playerId, "XG1-076", `${DECADRIVER_RUSH_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[DECADRIVER_RUSH_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

XG1_RESOLVERS[DECADRIVER_POWER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), power: [...p.power, stripForZone(card)] }));
  next = shuffleDeck(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-076", `${DECADRIVER_POWER_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[DECADRIVER_POWER_EFFECT_ID] = simpleSkip((s, pending) => shuffleDeck(s, pending.playerId));

// ---------------------------------------------------------------------------
// XG1-077 仮面ライダーディケイド【ライドブッカー】（RC）
// 「自軍山札の上から3枚をオモテにしてもよい。そうしたとき、オモテにしたカードの中から、特徴「仮面ライダー」を持つユニットカードを1枚選び、自軍パワー
//  ゾーンに置く。その後、それ以外のカードは好きな順で山札の下に戻す。」（atwiki/page-1542）
// オモテにする（任意）と置くカードを選ぶ（あれば必ず）を1つの選択にまとめる（XG1-054 と同じ）: 該当するカードがあればその中から選ぶ（選ぶ＝オモテに
// する）、なければ「オモテにする」を選ぶ。オモテにした3枚は公開表示に出す（lastReveal）。残りが2枚以上なら山札の下に戻す順を1枚ずつ選ぶ
// （rules/deckOrder.ts）。

const RIDE_BOOKER_EFFECT_ID = "xg1_077_ride_booker";

XG1_KEYWORDS["XG1-077::ride_booker"] = (state, ctx) => {
  const top = state.players[ctx.playerId].deck.slice(0, 3);
  if (top.length === 0) return { state, detail: "xg1_077:empty_deck" };
  const ids = top.filter((c) => isUnitDef(state, c.cardId) && printedFeatures(state, c.cardId).includes("仮面ライダー")).map((c) => c.instanceId);
  const meta = { xg1Meta: { steps: top.map((c) => c.instanceId) } };
  const choice = ids.length > 0 ? pickOne(ctxBase(ctx), "XG1-077", RIDE_BOOKER_EFFECT_ID, ids, true, meta) : confirmOptions(ctxBase(ctx), "XG1-077", RIDE_BOOKER_EFFECT_ID, ["accept"], true, meta);
  return { state: openAfter(state, gateReveal(choice)), detail: RIDE_BOOKER_EFFECT_ID };
};

XG1_RESOLVERS[RIDE_BOOKER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const revealedIds = pending.xg1Meta?.steps ?? [];
  const revealed = state.players[playerId].deck.filter((c) => revealedIds.includes(c.instanceId));
  const picked = revealed.find((c) => c.instanceId === instanceId);
  let next = recordReveal(close(state, pending), {
    playerId,
    ownerId: playerId,
    sourceCardId: "XG1-077",
    effectLabel: "ライドブッカー",
    from: "deck_top",
    cards: revealedCards(revealed, (c) => (c.instanceId === instanceId ? "power" : "deck_bottom")),
  });
  if (picked) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), power: [...p.power, stripForZone(picked)] }));
  }
  const rest = revealed.filter((c) => c.instanceId !== instanceId).map((c) => c.instanceId);
  return {
    state: returnToDeckInOrder(next, pending, rest),
    log: logFor(state, playerId, "XG1-077", `${RIDE_BOOKER_EFFECT_ID}:${instanceId}`),
  };
};
XG1_SKIPPERS[RIDE_BOOKER_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-079 アビスラッシャー【高圧の水流】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP3000以下のSユニットを好きな数選びホールドしてもよい。」（atwiki/page-1588）
// 1体ずつ選び、選び終えたら（確定・見送り、または候補がなくなったら）選んだユニットをその場でホールドする。BP はいまの BP。

const HIGH_PRESSURE_EFFECT_ID = "xg1_079_high_pressure";

XG1_KEYWORDS["XG1-079::high_pressure"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg1_079:not_own_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = enemyBattleSUnits(state, ctx.playerId, "XG1-079", (c) => !c.commandHeld && effectiveBp(state, enemyId, c) <= 3000);
  if (ids.length === 0) return { state, detail: "xg1_079:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-079", HIGH_PRESSURE_EFFECT_ID, ids, true, { selectCount: ids.length, mayConfirm: true })), detail: HIGH_PRESSURE_EFFECT_ID };
};

function highPressureFinish(state: GameState, pending: PendingEffectChoice, selected: string[]) {
  const next = holdFieldUnits(close(state, pending), opponent(pending.playerId), selected);
  return { state: proceed(next, pending), log: logFor(state, pending.playerId, "XG1-079", `${HIGH_PRESSURE_EFFECT_ID}:${selected.join(",")}`) };
}

XG1_RESOLVERS[HIGH_PRESSURE_EFFECT_ID] = (state, _playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (rest.length === 0) return highPressureFinish(state, pending, selected);
  return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest } } };
};
XG1_CONFIRMERS[HIGH_PRESSURE_EFFECT_ID] = (state) => {
  const pending = state.pendingEffectChoice!;
  return highPressureFinish(state, pending, pending.selectedInstanceIds ?? []);
};
XG1_SKIPPERS[HIGH_PRESSURE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  if ((pending.selectedInstanceIds?.length ?? 0) > 0) return highPressureFinish(state, pending, pending.selectedInstanceIds ?? []);
  return simpleSkip()(state, playerId);
};

// ---------------------------------------------------------------------------
// XG1-080 仮面ライダーアビス【アビスダイブ】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから、特徴「ミラーモンスター」を持つ自軍ユニットを2体選んでもよい。そうしたとき、
//  選んだ2体のBPの合計以下のBPを持つ敵軍Sユニットを1体選び撃破する。」（atwiki/page-1563）
// 2体を1体ずつ選ぶ（最初の1体の前だけ見送れる）。BP はいまの BP。敵軍 S ユニットはエリアを問わない（カード評価「ラッシュエリアにも届く」）。

const ABYSS_DIVE_EFFECT_ID = "xg1_080_abyss_dive";
const ABYSS_DIVE_DESTROY_EFFECT_ID = "xg1_080_abyss_dive_destroy";

XG1_KEYWORDS["XG1-080::abyss_dive"] = (state, ctx) => {
  if (!ownTurn(ctx)) return { state, detail: "xg1_080:not_own_turn" };
  const ids = state.players[ctx.playerId].rush.filter((c) => isUnitDef(state, c.cardId) && unitFeatures(state, ctx.playerId, c).includes("ミラーモンスター")).map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "xg1_080:mirror_monsters_short" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-080", ABYSS_DIVE_EFFECT_ID, ids, true, { selectCount: 2 })), detail: ABYSS_DIVE_EFFECT_ID };
};

XG1_RESOLVERS[ABYSS_DIVE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG1-080", `${ABYSS_DIVE_EFFECT_ID}:${instanceId}`);
  if (selected.length < 2) {
    return { state: { ...state, pendingEffectChoice: { ...pending, optional: false, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)) } }, log };
  }
  const next = close(state, pending);
  const sum = selected.reduce((acc, id) => {
    const c = findField(next, playerId, id);
    return acc + (c ? effectiveBp(next, playerId, c) : 0);
  }, 0);
  const enemyId = opponent(playerId);
  const ids = enemySUnits(next, playerId, "XG1-080", (c) => effectiveBp(next, enemyId, c) <= sum);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, pickOne(pendingBase(pending), "XG1-080", ABYSS_DIVE_DESTROY_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[ABYSS_DIVE_EFFECT_ID] = simpleSkip();
registerDestroyPick(ABYSS_DIVE_DESTROY_EFFECT_ID, "XG1-080");
