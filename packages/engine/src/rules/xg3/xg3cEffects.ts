/**
 * クロスギャザー ザ・Wインパクト XG3-043〜XG3-062（ライダーマン〜仮面ライダーガタックRF）のカード固有の効果（cardSpec XG3-043-062 の監査）。
 * 入口は rules/xg3/xg3Effects.ts、登録簿は rules/xg3/xg3Registry.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 * 継続効果（XG3-051・XG3-052 の BP、XG3-054 のアタックの制限）は rules/xg3/xg3Fields.ts、XG3-059 は rules/keywordGapRuntime.ts battleActBlocked。
 */
import { hasNameOrAlias } from "../../core/cardNames";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { effectiveBp, effectiveCommandCategories, getDefinition, isOperation, isPermanentOperation, parsePowerCost } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { markBattleBlocked } from "../turnModifiers";
import { finalizeLeaveReaction } from "../operationCounters";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { base, close, ctxBase, destroyAll, fieldUnits, isUnitCard, logFor, moveFieldUnit, openAfter, openNext, pendingBase, proceed, selectableEnemy, shuffleDeck, stripForZone, zoneOfField } from "../rm/rm1Effects";
import { AFTER_ACTION_HOOKS, BATTLE_DESTROY_HOOKS, CHOICE_RESOLVERS, CHOICE_SKIPPERS, ENTER_BATTLE_HOOKS, FIELD_ABILITIES, KEYWORDS, LEAVE_STAY_HOOKS, ZONE_ACTIVATIONS } from "./xg3Registry";
import { nameIs, printedFeatures, skipThen } from "./xg3Common";

/** 継続効果・別の入口で処理するカードのキーワード（DSL の grant_keyword から呼ばれても何もしない）。 */
for (const key of ["XG3-043::pluton", "XG3-051::matsuri", "XG3-052::kaiwan", "XG3-054::uketomeru", "XG3-057::ongekiko", "XG3-058::zanki_note", "XG3-058::yomigaeru"]) {
  KEYWORDS[key] = (state) => ({ state, detail: `${key}:static` });
}

function isOwnTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** 選択を開く（ほかの選択の途中ならその後に。resumeChoice を引き継ぐ）。 */
function openFollow(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return state.pendingEffectChoice ? openAfter(state, { ...next, resumeChoice: pending.resumeChoice }) : openNext(state, pending, next);
}

function discardFromHand(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
}

/** 印刷の必要パワーの数字（数字を持たなければ undefined）。 */
function costNumber(state: GameState, cardId: string): number | undefined {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  if (cost === undefined) return undefined;
  const n = parsePowerCost(cost);
  return Number.isFinite(n) ? n : undefined;
}

function printedSpBlank(state: GameState, cardId: string): boolean {
  const sp = getDefinition(state.definitions, cardId)?.sp;
  return sp === undefined || sp === null || (sp as unknown) === "";
}

// ---------------------------------------------------------------------------
// XG3-043 ライダーマン【プルトンロケット阻止】（atwiki/page-1911）
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、これを捨札にして次の効果を発動できる⇒敵軍山札の上から5枚をオモテにする。そうしたとき、
//  その中から常駐オペレーション以外のオペレーションカードを1枚選び捨札にする。その後、残りのカードを山札に戻してシャッフルする。」
// 起動は activate_field_unit_ability（1ターン1回）。これを捨札にしてから、敵軍山札の上5枚の常駐でないオペレーションを1枚選ぶ（強制）。
// 残りは山札に戻してシャッフルする（候補がなくてもシャッフルする）。

const PLUTON_EFFECT_ID = "xg3043_pluton";

function plutonIds(state: GameState, enemyId: PlayerId): string[] {
  return state.players[enemyId].deck
    .slice(0, 5)
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return isOperation(d) && !isPermanentOperation(d);
    })
    .map((c) => c.instanceId);
}

FIELD_ABILITIES.push({
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-043"),
  canActivate: (state, playerId) => state.phase === "rush" && isOwnTurn(state, playerId) && !state.pendingEffectChoice && !state.pendingEffectRush,
  resolve: (state, playerId, card) => {
    const enemyId = opponent(playerId);
    const next = moveFieldUnit(state, playerId, card.instanceId, playerId, "discard");
    const ids = plutonIds(next, enemyId);
    if (ids.length === 0) return shuffleDeck(next, enemyId);
    return openAfter(next, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG3-043"), effectId: PLUTON_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
  },
});
CHOICE_RESOLVERS[PLUTON_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
  next = shuffleDeck(next, enemyId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-043", `${PLUTON_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-044 仮面ライダーストロンガー【エレクトロファイヤー】（RC。atwiki/page-1912）
// 「敵軍コマンドゾーンから、SPが空欄ではないユニットカードを1枚選び、敵軍ラッシュエリアにホールド状態で出してもよい。」

const ELECTRO_EFFECT_ID = "xg3044_electro_fire";

KEYWORDS["XG3-044::electro_fire"] = (state, ctx) => {
  const enemy = state.players[opponent(ctx.playerId)];
  const ids = enemy.command.filter((c) => isUnitCard(state, c.cardId) && !printedSpBlank(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3044:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-044"), effectId: ELECTRO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: ELECTRO_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[ELECTRO_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[ELECTRO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), opponent(playerId), (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, { ...stripForZone(card), commandHeld: true }] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-044", `${ELECTRO_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-045 チャージアップストロンガー【超電稲妻キック】（RC。atwiki/page-2015）
// 「このターン、これがSPが空欄ではないユニットをバトルで撃破したとき、相手に1点ダメージを与える。」
// RC で、このターンの能力として記録する（state.xg3.choudenKick）。バトルで撃破したとき（rules/operationCounters.ts）に、撃破したユニットの
// 印刷の SP が空欄でなければ相手に1点ダメージ。

KEYWORDS["XG3-045::chouden_kick"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self) return { state, detail: "xg3045:no_source" };
  const list = (state.xg3?.choudenKick ?? []).filter((k) => k.turn === state.turn);
  return { state: { ...state, xg3: { ...state.xg3, choudenKick: [...list, { instanceId: self, turn: state.turn }] } }, detail: "xg3045_chouden_kick" };
};

BATTLE_DESTROY_HOOKS.push((state, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId) => {
  if (winnerId === defeatedOwnerId) return state;
  if (!(state.xg3?.choudenKick ?? []).some((k) => k.instanceId === winnerInstanceId && k.turn === state.turn)) return state;
  const p = state.players[defeatedOwnerId];
  const victim = [...p.discard, ...p.power, ...p.hand, ...p.deck, ...p.command, ...p.battle, ...p.rush].find((c) => c.instanceId === defeatedInstanceId);
  if (!victim || printedSpBlank(state, victim.cardId)) return state;
  return applyDamageToPlayer(state, defeatedOwnerId, 1, { kind: "none", activePlayer: state.activePlayer });
});

// ---------------------------------------------------------------------------
// XG3-046 仮面ライダーBLACK（atwiki/page-1967）
// ※「敵軍ターン中、これが撃破されて捨札になったとき、これを自軍パワーゾーンにダメージにして置いてもよい。そうしたとき、自分の手札から
//  「仮面ライダーBLACK RX」のカードを1枚選び、自軍ラッシュエリアに出す。」
// 【キングストーンフラッシュ】（RC）「自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。そうしたとき、捨札にしたカードの必要パワーの
//  数字以下の必要パワーを持つ敵軍Sユニットを1体選び、持ち主の山札の下に戻す。」

const BLACK_EFFECT_ID = "xg3046_black_damage";
const BLACK_RX_EFFECT_ID = "xg3046_black_rx";
const KINGSTONE_EFFECT_ID = "xg3046_kingstone";
const KINGSTONE_PICK_EFFECT_ID = "xg3046_kingstone_pick";

KEYWORDS["XG3-046::black_note"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self || ctx.phasePlayerId === ctx.playerId || state.activePlayer === ctx.playerId) return { state, detail: "xg3046:not_enemy_turn" };
  if (!state.players[ctx.playerId].discard.some((c) => c.instanceId === self)) return { state, detail: "xg3046:not_discard" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-046"), effectId: BLACK_EFFECT_ID, kind: "confirm", validInstanceIds: ["accept"], optional: true }),
    detail: BLACK_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[BLACK_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[BLACK_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId;
  let next = close(state, pending);
  const log = logFor(state, playerId, "XG3-046", `${BLACK_EFFECT_ID}:damage`);
  if (!self || !next.players[playerId].discard.some((c) => c.instanceId === self)) return { state: proceed(next, pending), log };
  next = patchPlayer(next, playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === self)!;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== self), power: [...p.power, { ...stripForZone(card), faceDown: true }], damage: p.damage + 1 };
  });
  const rx = next.players[playerId].hand.filter((c) => nameIs(next, c.cardId, "仮面ライダーBLACK RX")).map((c) => c.instanceId);
  if (rx.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-046"), effectId: BLACK_RX_EFFECT_ID, kind: "select_unit", validInstanceIds: rx, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[BLACK_RX_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, stripForZone(card)] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-046", `${BLACK_RX_EFFECT_ID}:${instanceId}`) };
};

KEYWORDS["XG3-046::kingstone"] = (state, ctx) => {
  const next = patchPlayer(state, ctx.playerId, drawOne);
  const ids = next.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "xg3046:no_hand" };
  return {
    state: openAfter(next, { ...base(ctxBase(ctx), "XG3-046"), effectId: KINGSTONE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: KINGSTONE_EFFECT_ID,
  };
};
CHOICE_RESOLVERS[KINGSTONE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const n = card ? costNumber(state, card.cardId) : undefined;
  const next = discardFromHand(close(state, pending), playerId, instanceId);
  const log = logFor(state, playerId, "XG3-046", `${KINGSTONE_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const ids =
    n === undefined
      ? []
      : fieldUnits(next, enemyId)
          .filter((c) => {
            const m = costNumber(next, c.cardId);
            return rk1IsSmallNow(next, c) && m !== undefined && m <= n && selectableEnemy(next, playerId, "XG3-046", c);
          })
          .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-046"), effectId: KINGSTONE_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[KINGSTONE_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "deck_bottom");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-046", `${KINGSTONE_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-047 シャドームーン【シャドーフラッシュ】（RC。atwiki/page-1968）
// 「自分の手札からユニットカードを1枚選び、捨札にしてもよい。そうしたとき、捨札にしたカードのBP以下の本来のBPを持つ敵軍ユニットを1体選び撃破する。」
// 比べるのは印刷の BP どうし。敵軍ユニットはエリア・サイズを問わない。

const SHADOW_EFFECT_ID = "xg3047_shadow_flash";
const SHADOW_PICK_EFFECT_ID = "xg3047_shadow_flash_pick";

function printedBpOf(state: GameState, cardId: string): number | undefined {
  const bp = getDefinition(state.definitions, cardId)?.bp;
  return typeof bp === "number" ? bp : undefined;
}

KEYWORDS["XG3-047::shadow_flash"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand.filter((c) => isUnitCard(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3047:no_hand" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-047"), effectId: SHADOW_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SHADOW_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[SHADOW_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[SHADOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const bp = card ? printedBpOf(state, card.cardId) : undefined;
  const next = discardFromHand(close(state, pending), playerId, instanceId);
  const log = logFor(state, playerId, "XG3-047", `${SHADOW_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const ids =
    bp === undefined
      ? []
      : fieldUnits(next, enemyId)
          .filter((c) => {
            const b = printedBpOf(next, c.cardId);
            return b !== undefined && b <= bp && selectableEnemy(next, playerId, "XG3-047", c);
          })
          .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-047"), effectId: SHADOW_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[SHADOW_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-047", SHADOW_PICK_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-047", `${SHADOW_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-048 仮面ライダーBLACK RX【リボルクラッシュ】（RC。atwiki/page-2008）
// 「敵軍バトルエリアのユニットがSユニット1体だけなら、そのユニットを持ち主のパワーゾーンにダメージにして置いてもよい。」

const REVOL_EFFECT_ID = "xg3048_revol_crash";

KEYWORDS["XG3-048::revol_crash"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const battle = state.players[enemyId].battle;
  const only = battle.length === 1 ? battle[0]! : undefined;
  if (!only || !isUnitCard(state, only.cardId) || !rk1IsSmallNow(state, only) || !selectableEnemy(state, ctx.playerId, "XG3-048", only)) return { state, detail: "xg3048:not_met" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-048"), effectId: REVOL_EFFECT_ID, kind: "select_unit", validInstanceIds: [only.instanceId], selectCount: 1, optional: true }),
    detail: REVOL_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[REVOL_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[REVOL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-048", `${REVOL_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-049 ストレンジベント（オペレーション。atwiki/page-1913）
// 「自軍捨札にある「ストレンジベント」以外のカードを、すべてウラ向きにしてシャッフルする。その後、その中から相手にウラ向きのまま1枚選ばせてから、
//  すべてオモテにする。選ばれたカードが通常のオペレーションカードなら、その効果を発動してもよい。発動しなかったか、それ以外のカードだったなら、
//  特徴「ミラーライダー」を持つユニットを1体選び、このターン、BP+2000する。」
// 対象のカードが1枚以下なら、そこで処理を終える（Q1・Q2）。相手が1枚選ぶ（ウラ向きのまま）。通常のオペレーションなら、その効果（DSL の operation）を
// 発動するか選ぶ（任意）。発動しなかったか、それ以外なら、特徴「ミラーライダー」を持つユニット（両軍のエリア）を1体選び、このターン BP+2000。

const STRANGE_EFFECT_ID = "xg3049_strange_vent";
const STRANGE_OP_EFFECT_ID = "xg3049_strange_vent_op";
const STRANGE_MIRROR_EFFECT_ID = "xg3049_strange_vent_mirror";

KEYWORDS["XG3-049::strange_vent"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].discard.filter((c) => !nameIs(state, c.cardId, "ストレンジベント")).map((c) => c.instanceId);
  if (ids.length <= 1) return { state, detail: "xg3049:too_few" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-049"), playerId: opponent(ctx.playerId), effectId: STRANGE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: STRANGE_EFFECT_ID,
  };
};

function mirrorChoice(state: GameState, pending: PendingEffectChoice, ownerId: PlayerId): GameState {
  const ids = (["player1", "player2"] as const).flatMap((pid) => fieldUnits(state, pid).filter((c) => unitFeatures(state, pid, c).includes("ミラーライダー") && (pid === ownerId || selectableEnemy(state, ownerId, "XG3-049", c))).map((c) => c.instanceId));
  if (ids.length === 0) return proceed(state, pending);
  return openFollow(state, pending, { ...base(pendingBase(pending), "XG3-049"), playerId: ownerId, effectId: STRANGE_MIRROR_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
}

CHOICE_RESOLVERS[STRANGE_EFFECT_ID] = (state, _chooser, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ownerId = opponent(pending.playerId);
  const next = close(state, pending);
  const card = next.players[ownerId].discard.find((c) => c.instanceId === instanceId);
  const def = card && getDefinition(next.definitions, card.cardId);
  const log = logFor(state, pending.playerId, "XG3-049", `${STRANGE_EFFECT_ID}:${instanceId}`);
  if (card && isOperation(def) && !isPermanentOperation(def) && !/※カウンター/.test(def?.text ?? "")) {
    return {
      state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-049"), playerId: ownerId, effectId: STRANGE_OP_EFFECT_ID, kind: "confirm", validInstanceIds: ["accept"], optional: true, xg3Meta: { targetInstanceId: instanceId } }),
      log,
    };
  }
  return { state: mirrorChoice(next, pending, ownerId), log };
};
CHOICE_SKIPPERS[STRANGE_OP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: mirrorChoice(close(state, pending), pending, playerId), log: logFor(state, playerId, "XG3-049", `${STRANGE_OP_EFFECT_ID}:skip`) };
};
CHOICE_RESOLVERS[STRANGE_OP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const opId = pending.xg3Meta?.targetInstanceId;
  const card = opId ? state.players[playerId].discard.find((c) => c.instanceId === opId) : undefined;
  let next = close(state, pending);
  const logs: string[] = [];
  let handled = false;
  if (card) {
    const r = tryResolveDslTriggeredEffects({ state: next, cardId: card.cardId, instanceId: card.instanceId, playerId, phasePlayerId: pending.phasePlayerId, triggerType: "operation" });
    next = r.state;
    logs.push(...r.logs);
    handled = r.handled;
  }
  // 発動できなかった（効果がない）なら、発動しなかったときと同じ。
  const done = handled ? proceed(next, pending) : mirrorChoice(next, pending, playerId);
  return { state: { ...done, log: [...done.log, ...logs] }, log: logFor(state, playerId, "XG3-049", `${STRANGE_OP_EFFECT_ID}:${opId ?? ""}`) };
};
CHOICE_RESOLVERS[STRANGE_MIRROR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const done: GameState = { ...next, xg3: { ...next.xg3, turnBuffs: [...(next.xg3?.turnBuffs ?? []).filter((b) => b.turn === next.turn), { instanceId, turn: next.turn, bp: 2000 }] } };
  return { state: proceed(done, pending), log: logFor(state, playerId, "XG3-049", `${STRANGE_MIRROR_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-050 仮面ライダーゾルダ【ギガランチャー】（atwiki/page-1914）
// 「これをラッシュしたとき、カテゴリにWBを持つ自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、BP5000以下の敵軍ユニットを1体選び撃破する。」
// コマンドはホールド状態でもよい（カード評価）。敵軍ユニットはエリア・サイズを問わない。

const GIGA_EFFECT_ID = "xg3050_giga_launcher";
const GIGA_PICK_EFFECT_ID = "xg3050_giga_launcher_pick";

KEYWORDS["XG3-050::giga_launcher"] = (state, ctx) => {
  const p = state.players[ctx.playerId];
  const ids = p.command.filter((c) => (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes("WB")).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3050:no_command" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-050"), effectId: GIGA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: GIGA_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[GIGA_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[GIGA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
  const log = logFor(state, playerId, "XG3-050", `${GIGA_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => effectiveBp(next, enemyId, c) <= 5000 && selectableEnemy(next, playerId, "XG3-050", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-050"), effectId: GIGA_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[GIGA_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-050", GIGA_PICK_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-050", `${GIGA_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-053 港区のウワン【分裂】（atwiki/page-1917）
// 「自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から2枚をオモテにしてもよい。オモテにしたカードが「港区のウワン」なら自軍ラッシュエリアに
//  出し、それ以外なら捨札にする。この効果で出したユニットは、このターン、バトルエリアに出られない。」

const BUNRETSU_EFFECT_ID = "xg3053_bunretsu";

KEYWORDS["XG3-053::bunretsu"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3053:enemy_turn" };
  if (state.players[ctx.playerId].deck.length === 0) return { state, detail: "xg3053:no_deck" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-053"), effectId: BUNRETSU_EFFECT_ID, kind: "confirm", validInstanceIds: ["accept"], optional: true }),
    detail: BUNRETSU_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[BUNRETSU_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[BUNRETSU_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const top = p.deck.slice(0, 2);
    let pl = { ...p, deck: p.deck.slice(2) };
    for (const c of top) {
      if (nameIs(state, c.cardId, "港区のウワン") && isUnitCard(state, c.cardId)) pl = markBattleBlocked({ ...pl, rush: [...pl.rush, stripForZone(c)] }, c.instanceId);
      else pl = { ...pl, discard: [...pl.discard, stripForZone(c)] };
    }
    return pl;
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-053", `${BUNRETSU_EFFECT_ID}:reveal`) };
};

// ---------------------------------------------------------------------------
// XG3-056 仮面ライダー響鬼【集う音撃】（atwiki/page-1920）
// 「自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアにある、本来の特徴に「猛士」を持つユニットの数を数えてもよい。そうしたとき、
//  敵軍バトルエリアからその数と同じ必要パワーの数字を持つユニットを1体選び撃破する。」
// 数えるか（＝発動するか）は撃破するユニットの選択で答える（見送れる）。サイズは問わない（カード評価）。

const ONGEKI_EFFECT_ID = "xg3056_ongeki";

KEYWORDS["XG3-056::ongeki"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3056:enemy_turn" };
  const n = state.players[ctx.playerId].battle.filter((c) => isUnitCard(state, c.cardId) && printedFeatures(state, c.cardId).includes("猛士")).length;
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle.filter((c) => isUnitCard(state, c.cardId) && costNumber(state, c.cardId) === n && selectableEnemy(state, ctx.playerId, "XG3-056", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3056:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-056"), effectId: ONGEKI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: ONGEKI_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[ONGEKI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[ONGEKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-056", ONGEKI_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-056", `${ONGEKI_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-057 ヒビキアカネタカ【ヒビキオンゲキコ】（atwiki/page-1921）
// 「ホールド状態のこのユニットから、「仮面ライダーディケイド」または「仮面ライダーディエンド」または特徴「猛士」を持つユニットがコンビネーションした
//  とき、次の効果を発動できる⇒敵軍バトルエリアから特徴「男」または「女」または「人型」を持たないユニットを1体選び撃破する。」
// バトルエリアに出たユニットの直前に、ホールド状態のこれが並んでいれば発動できる（撃破するユニットの選択で答える。見送れる）。

const ONGEKIKO_EFFECT_ID = "xg3057_ongekiko";

ENTER_BATTLE_HOOKS.push((state, playerId, card, battleBeforeEnter) => {
  const left = battleBeforeEnter[battleBeforeEnter.length - 1];
  if (!left || !left.commandHeld || !isSameCardIdentity(left.cardId, "XG3-057")) return state;
  const d = state.definitions[card.cardId];
  // 「※これは「仮面ライダーディケイド」…としてつかえる」（XG7-042）も含む（atwiki/page-1668 Q1）。
  const fits = hasNameOrAlias(d, "仮面ライダーディケイド") || hasNameOrAlias(d, "仮面ライダーディエンド") || unitFeatures(state, playerId, card).includes("猛士");
  if (!fits) return state;
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && !unitFeatures(state, enemyId, c).some((f) => f === "男" || f === "女" || f === "人型") && selectableEnemy(state, playerId, "XG3-057", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, { ...base({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: left.instanceId }, "XG3-057"), effectId: ONGEKIKO_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
});
CHOICE_SKIPPERS[ONGEKIKO_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[ONGEKIKO_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-057", ONGEKIKO_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-057", `${ONGEKIKO_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-058 仮面ライダー斬鬼（atwiki/page-1922）
// ※「自軍ラッシュフェイズ中、このユニットをホールドしてもよい。そうしたとき、このユニット以外の自軍Sユニットを1体選びリリースする。」
//  起動は activate_field_unit_ability（リリース状態のこれ。ホールド状態のほかの自軍 S ユニットがあるとき）。選ぶのは強制。
// 【蘇る雷】「これが自軍捨札にある間、自軍ラッシュフェイズ中、自分の手札から特徴「ディスクアニマル」を持つカードを1枚選び捨札にしてもよい。そうしたとき、
//  これを自軍ラッシュエリアに出す。」起動は self_rush_from_zone（zone discard）。

const ZANKI_EFFECT_ID = "xg3058_zanki_release";
const YOMIGAERU_EFFECT_ID = "xg3058_yomigaeru";

function zankiTargets(state: GameState, playerId: PlayerId, selfId: string): string[] {
  return fieldUnits(state, playerId).filter((c) => c.instanceId !== selfId && c.commandHeld && rk1IsSmallNow(state, c)).map((c) => c.instanceId);
}

FIELD_ABILITIES.push({
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-058"),
  canActivate: (state, playerId, card) =>
    state.phase === "rush" && isOwnTurn(state, playerId) && !state.pendingEffectChoice && !card.commandHeld && zankiTargets(state, playerId, card.instanceId).length > 0,
  resolve: (state, playerId, card) => {
    const zone = zoneOfField(state, playerId, card.instanceId);
    if (!zone) return state;
    const held = patchPlayer(state, playerId, (p) => ({ ...p, [zone]: p[zone].map((c) => (c.instanceId === card.instanceId ? { ...c, commandHeld: true } : c)) }));
    return openAfter(held, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG3-058"), effectId: ZANKI_EFFECT_ID, kind: "select_unit", validInstanceIds: zankiTargets(held, playerId, card.instanceId), selectCount: 1, optional: false });
  },
});
CHOICE_RESOLVERS[ZANKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const zone = zoneOfField(state, playerId, instanceId);
  let next = close(state, pending);
  if (zone) next = patchPlayer(next, playerId, (p) => ({ ...p, [zone]: p[zone].map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)) }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-058", `${ZANKI_EFFECT_ID}:${instanceId}`) };
};

function discAnimalHand(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand.filter((c) => printedFeatures(state, c.cardId).includes("ディスクアニマル")).map((c) => c.instanceId);
}

ZONE_ACTIVATIONS.push({
  zone: "discard",
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-058"),
  canActivate: (state, playerId) => state.phase === "rush" && isOwnTurn(state, playerId) && !state.pendingEffectChoice && !state.pendingEffectRush && discAnimalHand(state, playerId).length > 0,
  activate: (state, playerId, instanceId) =>
    openAfter(state, { ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG3-058"), effectId: YOMIGAERU_EFFECT_ID, kind: "select_unit", validInstanceIds: discAnimalHand(state, playerId), selectCount: 1, optional: true }),
});
CHOICE_SKIPPERS[YOMIGAERU_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[YOMIGAERU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId!;
  let next = discardFromHand(close(state, pending), playerId, instanceId);
  next = patchPlayer(next, playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === self);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== self), rush: [...p.rush, { ...stripForZone(card), rushedThisTurn: true }] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-058", `${YOMIGAERU_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-060 仮面ライダー天鬼【助ける仲間】（NC。atwiki/page-1924）
// 「自分の手札から特徴「ディスクアニマル」を持つオペレーションカードを1枚選び、自軍ラッシュエリアに出してもよい。そうしたとき、そのカードは「BP500」
//  「SP1/3」のSユニットとして扱い、本来のテキストを失うかわりに次のテキストを得る⇒本来の特徴に「猛士」を持つ自軍ユニットがユニットでなくなるとき、
//  これを捨札にして、そのユニットをその場に留める。」
// 出したカードは、そのカードの定義を写した S ユニットの定義（カード ID `XG3-060~<元の ID>`、BP500・SP1/3・本文は得たテキスト。Q2 の本来の BP）
// として場に置く。場を離れたら元のカードに戻す（後処理）。守るのは強制（カード評価「強制発動する」）: 本来の特徴「猛士」を持つ自軍ユニットが場を
// 離れるとき（rules/operationCounters.ts tryLeaveField）、これを1枚捨札にしてそのユニットをその場に留める。

const TASUKERU_EFFECT_ID = "xg3060_tasukeru";
export const DISC_UNIT_PREFIX = "XG3-060~";
const DISC_UNIT_TEXT = "本来の特徴に「猛士」を持つ自軍ユニットがユニットでなくなるとき、これを捨札にして、そのユニットをその場に留める。";

function isDiscUnit(cardId: string): boolean {
  return cardId.startsWith(DISC_UNIT_PREFIX);
}

function discUnitDefinition(orig: CardDefinition, id: string): CardDefinition {
  return { ...orig, id, type: "unit", bp: 500, sp: "1/3", size: "S", text: DISC_UNIT_TEXT, rawText: DISC_UNIT_TEXT, effects: [] } as CardDefinition;
}

KEYWORDS["XG3-060::tasukeru"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand
    .filter((c) => isOperation(getDefinition(state.definitions, c.cardId)) && printedFeatures(state, c.cardId).includes("ディスクアニマル"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3060:no_hand" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-060"), effectId: TASUKERU_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: TASUKERU_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[TASUKERU_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[TASUKERU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const card = next.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const orig = card && getDefinition(next.definitions, card.cardId);
  if (card && orig) {
    const id = `${DISC_UNIT_PREFIX}${card.cardId}`;
    next = { ...next, definitions: next.definitions[id] ? next.definitions : { ...next.definitions, [id]: discUnitDefinition(orig, id) } };
    next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), rush: [...p.rush, { instanceId, cardId: id }] }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-060", `${TASUKERU_EFFECT_ID}:${instanceId}`) };
};

/** 場を離れたディスクアニマルを元のカードに戻す。 */
function restoreDiscUnits(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const p = next.players[pid];
    const zones = ["hand", "deck", "discard", "power", "command", "operation"] as const;
    if (!zones.some((z) => p[z].some((c) => isDiscUnit(c.cardId))) && !(p.exile ?? []).some((c) => isDiscUnit(c.cardId))) continue;
    const fix = (cards: CardInstance[]) => cards.map((c) => (isDiscUnit(c.cardId) ? { ...c, cardId: c.cardId.slice(DISC_UNIT_PREFIX.length) } : c));
    next = patchPlayer(next, pid, (pl) => ({
      ...pl,
      hand: fix(pl.hand),
      deck: fix(pl.deck),
      discard: fix(pl.discard),
      power: fix(pl.power),
      command: fix(pl.command),
      operation: fix(pl.operation),
      ...(pl.exile ? { exile: fix(pl.exile) } : {}),
    }));
  }
  return next;
}
AFTER_ACTION_HOOKS.push((_before, after) => restoreDiscUnits(after));

LEAVE_STAY_HOOKS.push((state: GameState, intent: PendingLeave) => {
  if (intent.toZone === "battle" || state.pendingEffectChoice) return null;
  const ownerId = intent.ownerPlayerId;
  const unit = state.players[ownerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  if (!unit || isDiscUnit(unit.cardId) || !printedFeatures(state, unit.cardId).includes("猛士")) return null;
  const guard = fieldUnits(state, ownerId).find((c) => isDiscUnit(c.cardId) && c.instanceId !== unit.instanceId);
  if (!guard) return null;
  let next = moveFieldUnit(state, ownerId, guard.instanceId, intent.phasePlayerId, "discard");
  next = restoreDiscUnits(next);
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  next = { ...next, log: [...next.log, logFor(state, ownerId, "XG3-060", `${TASUKERU_EFFECT_ID}:stay:${unit.instanceId}`)] };
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
});
