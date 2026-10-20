/**
 * クロスギャザー ザ・Wインパクト XG3-084〜XG3-103（大甲神カブテリオス〜ライジンゴー）のカード固有の効果（cardSpec XG3-084-103 の監査）。
 * 入口は rules/xg3/xg3Effects.ts、登録簿は rules/xg3/xg3Registry.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 * 継続効果（XG3-085・XG3-094・XG3-103 の BP、XG3-103 のバトルエリアへの進入）は rules/xg3/xg3Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingLeave, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition, isVehicle, parsePowerCost, unitBp, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addTurnRestrictionModifier } from "../../core/scopedModifiers";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { battleDefenderBp } from "../namedUnitEffects";
import { finalizeLeaveReaction, resolveBattlePending, tryLeaveField } from "../operationCounters";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { type BaseCtx, base, close, ctxBase, destroyAll, fieldUnits, findField, isUnitCard, logFor, moveFieldUnit, openAfter, openNext, pendingBase, proceed, selectableEnemy, shuffleDeck, stripForZone } from "../rm/rm1Effects";
import {
  AFTER_ACTION_HOOKS,
  BEFORE_BATTLE_HOOKS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  ENTER_BATTLE_HOOKS,
  FIELD_ABILITIES,
  HOLD_COMPLETERS,
  KEYWORDS,
  LEAVE_STAY_HOOKS,
  START_PHASE_HOOKS,
  UNIT_RUSHED_HOOKS,
} from "./xg3Registry";
import { holdCommands, holdThen, nameIs, printedCategories, printedFeatures, releasedCommandIds, skipThen } from "./xg3Common";

/** 継続効果・別の入口で処理するカードのキーワード（DSL の grant_keyword から呼ばれても何もしない）。 */
for (const key of [
  "XG3-085::titanic_flare",
  "XG3-086::hundred_feeler",
  "XG3-088::hardock_shocker",
  "XG3-091::pulse_saber",
  "XG3-094::yujo",
  "XG3-097::roulette",
  "XG3-098::jishaku_change",
  "XG3-102::chorikishorai",
  "XG3-103::kamitsuki",
]) {
  KEYWORDS[key] = (state) => ({ state, detail: `${key}:static` });
}

function isOwnTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** いまのターンのプレイヤー（反応の途中で activePlayer が入れ替わっていても）。 */
function turnPlayer(state: GameState): PlayerId {
  if (state.pendingStrike) return state.pendingStrike.battlePhasePlayer;
  if (state.pendingBattle) return state.pendingBattle.phasePlayerId;
  if (state.pendingRush) return state.pendingRush.phasePlayerId;
  if (state.pendingLeave) return state.pendingLeave.phasePlayerId;
  if (state.pendingEffectChoice) return state.pendingEffectChoice.phasePlayerId;
  return state.activePlayer;
}

function openFollow(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return state.pendingEffectChoice ? openAfter(state, { ...next, resumeChoice: pending.resumeChoice }) : openNext(state, pending, next);
}

/** 印刷の必要パワーの数字（数字を持たなければ undefined）。 */
function costNumber(state: GameState, cardId: string): number | undefined {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  if (cost === undefined) return undefined;
  const n = parsePowerCost(cost);
  return Number.isFinite(n) ? n : undefined;
}

function printedBp(state: GameState, cardId: string): number {
  return unitBp(getDefinition(state.definitions, cardId));
}

function holdFieldCard(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
}

function moveHandToRush(state: GameState, playerId: PlayerId, instanceIds: string[]): GameState {
  return patchPlayer(state, playerId, (p) => {
    const cards = instanceIds.map((id) => p.hand.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
    return { ...p, hand: p.hand.filter((c) => !instanceIds.includes(c.instanceId)), rush: [...p.rush, ...cards.map(stripForZone)] };
  });
}

/** 「特徴「昆虫」を持つユニットからコンビネーションするとき」: 直前に並ぶユニットが「昆虫」で、ライドして出たのでない。 */
function insectCombo(state: GameState, playerId: PlayerId, card: CardInstance, battleBeforeEnter: CardInstance[]): boolean {
  const left = battleBeforeEnter[battleBeforeEnter.length - 1];
  return !!left && !card.mountedOnInstanceId && unitFeatures(state, playerId, left).includes("昆虫");
}

// ---------------------------------------------------------------------------
// XG3-084 大甲神カブテリオス【ビッグフレア】（atwiki/page-1939）
// 「自軍ターン中、これがバトルエリアに出たとき、WBを持つ自軍コマンドを1つ選びホールドしてもよい。そうしたとき、本来のBPが5000以下の敵軍ユニットを
//  1体選び撃破する。」ホールドするかは WB のコマンドの選択で答える（見送れる）。撃破はサイズ・エリアを問わない（カード評価）。選ぶのは強制。

const BIG_FLARE_EFFECT_ID = "xg3084_big_flare";
const BIG_FLARE_PICK_EFFECT_ID = "xg3084_big_flare_pick";

KEYWORDS["XG3-084::big_flare"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3084:enemy_turn" };
  const ids = releasedCommandIds(state, ctx.playerId, "WB");
  if (ids.length === 0) return { state, detail: "xg3084:no_wb" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-084"), effectId: BIG_FLARE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: BIG_FLARE_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[BIG_FLARE_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[BIG_FLARE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdCommands(close(state, pending), playerId, [instanceId]);
  const log = logFor(state, playerId, "XG3-084", `${BIG_FLARE_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const ids = fieldUnits(next, enemyId)
    .filter((c) => printedBp(next, c.cardId) <= 5000 && selectableEnemy(next, playerId, "XG3-084", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-084"), effectId: BIG_FLARE_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[BIG_FLARE_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-084", BIG_FLARE_PICK_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-084", `${BIG_FLARE_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-086 冷血鎧将ムカデリンガー【ハンドレットフィーラー】（atwiki/page-1941）
// 「これが自軍バトルエリアにある間、相手が自分自身のリリース状態のSユニットをバトルエリアに出すために選んだとき、そのユニットの必要パワーの数字を見て、
//  自軍捨札から同じ必要パワーの数字を持つカードを1枚選びゲームから除外してもよい。そうしたとき、そのユニットをホールドする。」
// 相手のユニットがバトルエリアに出たとき（rules/combo.ts の進入の後処理）に、リリース状態の S ユニットなら発動できる（除外するカードの選択で答える）。

const FEELER_EFFECT_ID = "xg3086_hundred_feeler";

ENTER_BATTLE_HOOKS.push((state, playerId, card) => {
  if (card.commandHeld || !isUnitCard(state, card.cardId) || unitSizeOf(state.definitions, card) !== "S") return state;
  const ownerId = opponent(playerId);
  const centipedes = state.players[ownerId].battle.filter((c) => isSameCardIdentity(c.cardId, "XG3-086"));
  if (centipedes.length === 0) return state;
  const n = costNumber(state, card.cardId);
  if (n === undefined) return state;
  const ids = state.players[ownerId].discard.filter((c) => costNumber(state, c.cardId) === n).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  let next = state;
  for (const centipede of centipedes) {
    next = openAfter(next, {
      ...base({ playerId: ownerId, phasePlayerId: turnPlayer(state), sourceInstanceId: centipede.instanceId }, "XG3-086"),
      effectId: FEELER_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
      xg3Meta: { targetInstanceId: card.instanceId, ownerId: playerId },
    });
  }
  return next;
});
CHOICE_SKIPPERS[FEELER_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[FEELER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.xg3Meta?.targetInstanceId;
  const targetOwner = pending.xg3Meta?.ownerId ?? opponent(playerId);
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), exile: [...(p.exile ?? []), stripForZone(card)] };
  });
  if (target) next = holdFieldCard(next, targetOwner, target);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-086", `${FEELER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-087 魔剣鎧将キルマンティス【フェリンガースナイプ】（atwiki/page-1942）
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから特徴「メカ」または「昆虫」を持つSユニットを1体選びホールドしてもよい。」

const SNIPE_EFFECT_ID = "xg3087_feelinger_snipe";

KEYWORDS["XG3-087::feelinger_snipe"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3087:enemy_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && unitFeatures(state, enemyId, c).some((f) => f === "メカ" || f === "昆虫") && selectableEnemy(state, ctx.playerId, "XG3-087", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3087:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-087"), effectId: SNIPE_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: SNIPE_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[SNIPE_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[SNIPE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdFieldCard(close(state, pending), opponent(playerId), instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-087", `${SNIPE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-088 変幻鎧将ビーザック【ハードックショッカー】（atwiki/page-1943）
// 「これが自軍の手札にある間、レジストまたはウイングを持つ敵軍Sユニットがラッシュされたとき、DAを持つ自軍コマンドを1つホールドしてから、
//  これを自軍ラッシュエリアに出してもよい。そうしたとき、ラッシュされた敵軍ユニットをホールドする。」
// 相手がユニットをラッシュしたとき（rules/onRushUnitEffects.ts）に、手札のこれを選ぶ選択を開く（任意）。選んだら DA のコマンドを1つホールドして
// （候補が1つなら選ばない）、これを自軍ラッシュエリアに出し、ラッシュされたユニットをホールドする。

const HARDOCK_EFFECT_ID = "xg3088_hardock_shocker";
const HARDOCK_HOLD_EFFECT_ID = "xg3088_hardock_shocker_hold";

UNIT_RUSHED_HOOKS.push((state, rusherPlayerId, rushedInstanceId, phasePlayerId) => {
  const rushed = fieldUnits(state, rusherPlayerId).find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || unitSizeOf(state.definitions, rushed) !== "S") return state;
  const ctx = { state, playerId: rusherPlayerId };
  if (!cardHasKeyword(state.definitions, rushed.cardId, "register", ctx) && !cardHasKeyword(state.definitions, rushed.cardId, "wing", ctx)) return state;
  const ownerId = opponent(rusherPlayerId);
  if (releasedCommandIds(state, ownerId, "DA").length === 0) return state;
  const ids = state.players[ownerId].hand.filter((c) => isSameCardIdentity(c.cardId, "XG3-088")).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, {
    ...base({ playerId: ownerId, phasePlayerId }, "XG3-088"),
    effectId: HARDOCK_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
    xg3Meta: { targetInstanceId: rushedInstanceId, ownerId: rusherPlayerId },
  });
});
CHOICE_SKIPPERS[HARDOCK_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[HARDOCK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const ctx: BaseCtx = { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: instanceId };
  const held = holdThen(next, ctx, "XG3-088", HARDOCK_HOLD_EFFECT_ID, releasedCommandIds(next, playerId, "DA"), 1, { xg3Meta: pending.xg3Meta, resumeChoice: pending.resumeChoice });
  return { state: held, log: logFor(state, playerId, "XG3-088", `${HARDOCK_EFFECT_ID}:${instanceId}`) };
};
HOLD_COMPLETERS[HARDOCK_HOLD_EFFECT_ID] = (state, pending) => {
  const self = pending.sourceInstanceId!;
  let next = moveHandToRush(state, pending.playerId, [self]);
  const target = pending.xg3Meta?.targetInstanceId;
  if (target) next = holdFieldCard(next, pending.xg3Meta?.ownerId ?? opponent(pending.playerId), target);
  next = { ...next, log: [...next.log, logFor(state, pending.playerId, "XG3-088", `${HARDOCK_HOLD_EFFECT_ID}:${target ?? ""}`)] };
  return proceed(next, pending);
};

// ---------------------------------------------------------------------------
// RC の効果で、「この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する」もの（XG3-089・XG3-091・XG3-092）。
// RC は DSL の riding_combo、「昆虫」からのコンビネーションはバトルエリアに出たとき（rules/combo.ts の進入の後処理）に同じ効果を発動する。

const INSECT_COMBO: Record<string, (state: GameState, ctx: BaseCtx) => GameState> = {};

ENTER_BATTLE_HOOKS.push((state, playerId, card, battleBeforeEnter) => {
  const run = Object.entries(INSECT_COMBO).find(([id]) => isSameCardIdentity(card.cardId, id))?.[1];
  if (!run || !insectCombo(state, playerId, card, battleBeforeEnter)) return state;
  return run(state, { playerId, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId });
});

// XG3-089 ブルービート【スティンガードリル】「敵軍バトルエリアから、レジストを持つSユニットを1体選び撃破してもよい。」（atwiki/page-1973）

const STINGER_EFFECT_ID = "xg3089_stinger_drill";

function openStinger(state: GameState, ctx: BaseCtx): GameState {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && cardHasKeyword(state.definitions, c.cardId, "register", { state, playerId: enemyId }) && selectableEnemy(state, ctx.playerId, "XG3-089", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, { ...base(ctx, "XG3-089"), effectId: STINGER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
}
INSECT_COMBO["XG3-089"] = openStinger;
KEYWORDS["XG3-089::stinger_drill"] = (state, ctx) => ({ state: openStinger(state, ctxBase(ctx)), detail: STINGER_EFFECT_ID });
CHOICE_SKIPPERS[STINGER_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[STINGER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-089", STINGER_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-089", `${STINGER_EFFECT_ID}:${instanceId}`) };
};

// XG3-091 ジースタッグ【パルセイバー】「これが敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットのBPを-2000してもよい。
//  （BP0以下になったユニットは撃破される）」（CN：RC。atwiki/page-1944）
// RC か「昆虫」からのコンビネーションで出たターンに、その記録（state.xg3.pulseSaber）を残す。アタックのバトルを解決する直前
// （rules/operationCounters.ts。RK-050 と同じ場所）に、バトル相手を選ぶ選択を開く（任意）。選んだらこのバトルの間 BP-2000。BP0 以下になるなら
// バトルの前に撃破し、バトルは行わない。

const PULSE_EFFECT_ID = "xg3091_pulse_saber";

/** バトルを解決し直す（バトルのログを state.log に残す）。 */
function resolveBattleLogged(state: GameState, battle: PendingBattle): GameState {
  const r = resolveBattlePending(state, battle);
  return { ...r.state, log: [...r.state.log, r.log] };
}

function markPulse(state: GameState, ctx: BaseCtx): GameState {
  const id = ctx.sourceInstanceId;
  if (!id) return state;
  return { ...state, xg3: { ...state.xg3, pulseSaber: [...(state.xg3?.pulseSaber ?? []).filter((m) => m.turn === state.turn && m.instanceId !== id), { instanceId: id, turn: state.turn }] } };
}
INSECT_COMBO["XG3-091"] = markPulse;
KEYWORDS["XG3-091::rc_mark"] = (state, ctx) => ({ state: markPulse(state, ctxBase(ctx)), detail: "xg3091:rc_mark" });

BEFORE_BATTLE_HOOKS.push((state, pending) => {
  if (pending.xg3PulseDone || pending.effectBattle || pending.substituteInstanceId) return null;
  const attacker = state.players[pending.attackerPlayerId].battle.find((c) => c.instanceId === pending.attackerInstanceId);
  if (!attacker || !isSameCardIdentity(attacker.cardId, "XG3-091")) return null;
  if (!(state.xg3?.pulseSaber ?? []).some((m) => m.instanceId === attacker.instanceId && m.turn === state.turn)) return null;
  if (!findField(state, pending.defenderPlayerId, pending.defenderInstanceId)) return null;
  return openAfter(
    { ...state, pendingBattle: undefined },
    {
      ...base({ playerId: pending.attackerPlayerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: attacker.instanceId }, "XG3-091"),
      effectId: PULSE_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [pending.defenderInstanceId],
      selectCount: 1,
      optional: true,
      xg3Meta: { battle: { ...pending, xg3PulseDone: true } },
    },
  );
});
CHOICE_SKIPPERS[PULSE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const battle = pending.xg3Meta?.battle;
  if (!battle) return { error: "invalid_choice" };
  const resolved = resolveBattleLogged(close(state, pending), battle);
  return { state: proceed(resolved, pending), log: logFor(state, playerId, "XG3-091", `${PULSE_EFFECT_ID}:skip`) };
};
CHOICE_RESOLVERS[PULSE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const battle = pending.xg3Meta?.battle;
  if (!battle) return { error: "invalid_choice" };
  let next = close(state, pending);
  const lowered: PendingBattle = { ...battle, defenderBpBonus: (battle.defenderBpBonus ?? 0) - 2000 };
  if (battleDefenderBp(next, lowered) <= 0) {
    next = destroyAll(next, pendingBase(pending), "XG3-091", PULSE_EFFECT_ID, [instanceId]);
    // バトル相手がいなくなったので、バトルは行わない（アタックは済ませた扱い）。
    next = resolveBattleLogged(next, battle);
  } else {
    next = resolveBattleLogged(next, lowered);
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-091", `${PULSE_EFFECT_ID}:${instanceId}`) };
};

// XG3-092 レッドル【セイバーマグナム】「自軍コマンドを1つ選びホールドしてもよい。そうしたとき、ホールドしたコマンドの必要パワーの数字を見て、その数字と
//  同じ必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び撃破する。」（CN：RC。atwiki/page-1945）
// ホールドするのはリリース状態の自軍コマンド（見送れる）。撃破するユニットを選ぶのは強制。

const MAGNUM_EFFECT_ID = "xg3092_saber_magnum";
const MAGNUM_PICK_EFFECT_ID = "xg3092_saber_magnum_pick";

function openMagnum(state: GameState, ctx: BaseCtx): GameState {
  const ids = releasedCommandIds(state, ctx.playerId);
  if (ids.length === 0) return state;
  return openAfter(state, { ...base(ctx, "XG3-092"), effectId: MAGNUM_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true });
}
INSECT_COMBO["XG3-092"] = openMagnum;
KEYWORDS["XG3-092::saber_magnum"] = (state, ctx) => ({ state: openMagnum(state, ctxBase(ctx)), detail: MAGNUM_EFFECT_ID });
CHOICE_SKIPPERS[MAGNUM_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[MAGNUM_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const command = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  const next = holdCommands(close(state, pending), playerId, [instanceId]);
  const log = logFor(state, playerId, "XG3-092", `${MAGNUM_EFFECT_ID}:${instanceId}`);
  const n = command ? costNumber(next, command.cardId) : undefined;
  if (n === undefined) return { state: proceed(next, pending), log };
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].battle
    .filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && costNumber(next, c.cardId) === n && selectableEnemy(next, playerId, "XG3-092", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-092"), effectId: MAGNUM_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[MAGNUM_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-092", MAGNUM_PICK_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-092", `${MAGNUM_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-090 スーパーブルービート【スーパーファイナルブロー】（atwiki/page-1958）
// 「これをラッシュしたとき、次の効果を発動できる⇒ユニット1体につきBP2000として、特徴「昆虫」を持つ自軍ユニットの数分のBPを計算し、そのBP以下の
//  敵軍ユニットを1体選び撃破する。」数えるのは自軍のエリアのユニット（これを含む。いまの特徴）。撃破はサイズ・エリアを問わない（カード評価）。
// 発動するかは撃破するユニットの選択で答える（見送れる）。

const FINAL_BLOW_EFFECT_ID = "xg3090_super_final_blow";

KEYWORDS["XG3-090::super_final_blow"] = (state, ctx) => {
  const limit = 2000 * fieldUnits(state, ctx.playerId).filter((c) => unitFeatures(state, ctx.playerId, c).includes("昆虫")).length;
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= limit && selectableEnemy(state, ctx.playerId, "XG3-090", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3090:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-090"), effectId: FINAL_BLOW_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: FINAL_BLOW_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[FINAL_BLOW_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[FINAL_BLOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-090", FINAL_BLOW_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-090", `${FINAL_BLOW_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-095 カブタックSM【ビリットショック】（atwiki/page-2001）
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから、本来のBPが8000以下のユニットを1体選び、持ち主のコマンドゾーンにホールド状態で
//  置く。置けなければ敵軍コマンドを1つ選び、捨札にしてから置く。」選ぶのは強制。コマンドゾーンが5枚（R-ZONE-08）なら、捨札にする敵軍コマンドを選ぶ。
// ※（ターンを終えるときの置き換え）は rules/xg3/xg3aEffects.ts。

const BILLIT_EFFECT_ID = "xg3095_billit_shock";
const BILLIT_DISCARD_EFFECT_ID = "xg3095_billit_shock_discard";
const COMMAND_ZONE_LIMIT = 5;

KEYWORDS["XG3-095::billit_shock"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3095:enemy_turn" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && printedBp(state, c.cardId) <= 8000 && selectableEnemy(state, ctx.playerId, "XG3-095", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3095:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-095"), effectId: BILLIT_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: BILLIT_EFFECT_ID,
  };
};
CHOICE_RESOLVERS[BILLIT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = close(state, pending);
  const log = logFor(state, playerId, "XG3-095", `${BILLIT_EFFECT_ID}:${instanceId}`);
  const command = next.players[enemyId].command;
  if (command.length >= COMMAND_ZONE_LIMIT) {
    return {
      state: openFollow(next, pending, {
        ...base(pendingBase(pending), "XG3-095"),
        effectId: BILLIT_DISCARD_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: command.map((c) => c.instanceId),
        selectCount: 1,
        optional: false,
        xg3Meta: { targetInstanceId: instanceId },
      }),
      log,
    };
  }
  return { state: proceed(moveFieldUnit(next, enemyId, instanceId, pending.phasePlayerId, "command_held"), pending), log };
};
CHOICE_RESOLVERS[BILLIT_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = patchPlayer(close(state, pending), enemyId, (p) => {
    const card = p.command.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
  const target = pending.xg3Meta?.targetInstanceId;
  if (target) next = moveFieldUnit(next, enemyId, target, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-095", `${BILLIT_DISCARD_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-096 ミミーナ（atwiki/page-1948）
// ※「これをラッシュしたとき、「ミミーナ」以外のリリース状態の自軍Sユニットを1体選び、可能ならホールドする。」（強制）
// 【修理サービス】「これをラッシュしたとき、自軍捨札から特徴「メカ」を持つSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。
//  置けなければこの効果は発動しない。」特徴・サイズは印刷のもの。選ぶのは強制。

const MIMINA_HOLD_EFFECT_ID = "xg3096_hold_ally";
const REPAIR_EFFECT_ID = "xg3096_repair_service";

// DSL の on_rush の効果は、選択が開くとその後の効果を処理しない（dsl/triggerResolver.ts）ので、※のキーワードで【修理サービス】もまとめて開く
// （【修理サービス】のキーワードは何もしない）。
KEYWORDS["XG3-096::hold_ally"] = (state, ctx) => {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => !c.commandHeld && rk1IsSmallNow(state, c) && !nameIs(state, c.cardId, "ミミーナ"))
    .map((c) => c.instanceId);
  const held = ids.length === 0 ? state : openAfter(state, { ...base(ctxBase(ctx), "XG3-096"), effectId: MIMINA_HOLD_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
  return { state: openRepair(held, ctx), detail: MIMINA_HOLD_EFFECT_ID };
};
CHOICE_RESOLVERS[MIMINA_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdFieldCard(close(state, pending), playerId, instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-096", `${MIMINA_HOLD_EFFECT_ID}:${instanceId}`) };
};

function openRepair(state: GameState, ctx: GrantKeywordContext): GameState {
  const p = state.players[ctx.playerId];
  if (p.command.length >= COMMAND_ZONE_LIMIT) return state;
  const ids = p.discard
    .filter((c) => isUnitCard(state, c.cardId) && getDefinition(state.definitions, c.cardId)?.size === "S" && printedFeatures(state, c.cardId).includes("メカ"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, { ...base(ctxBase(ctx), "XG3-096"), effectId: REPAIR_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
}
KEYWORDS["XG3-096::repair_service"] = (state) => ({ state, detail: "xg3096:repair_service:with_hold_ally" });
CHOICE_RESOLVERS[REPAIR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card || p.command.length >= COMMAND_ZONE_LIMIT) return p;
    return { ...p, discard: p.discard.filter((c) => c.instanceId !== instanceId), command: [...p.command, { ...stripForZone(card), commandHeld: true }] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-096", `${REPAIR_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-097 キャプテントンボーグ【キャプテンルーレット】（atwiki/page-1949）
// 「これが自軍エリアにある間、すべてのユニットは次の能力を得る⇒同じサイズのユニットにアタックするとき、バトルの前に自分自身の山札の上から1枚を
//  オモテにする。オモテにしたカードの必要パワーの数字が「1」か「3」か「5」なら必要パワーの数字、「2」か「4」か「6」なら特徴の数、それ以外ならBPを
//  参照し、お互いにその数字でバトルする。その後、オモテにしたカードは山札の下に戻す。」
// どちらかの軍のエリアにこれがあれば、アタックのバトルを解決する直前（rules/operationCounters.ts。RK-050 と同じ場所）に、アタックした側の山札の上を
// オモテにして山札の下に戻し、比べる数字を決める（必要パワーは印刷の数字、特徴はいまの特徴の数）。

BEFORE_BATTLE_HOOKS.push((state, pending) => {
  if (pending.xg3RouletteDone || pending.effectBattle || pending.rk050Mode) return null;
  const anyCaptain = (["player1", "player2"] as const).some((pid) => [...state.players[pid].battle, ...state.players[pid].rush].some((c) => isSameCardIdentity(c.cardId, "XG3-097")));
  if (!anyCaptain) return null;
  const attackerId = pending.attackerPlayerId;
  const attacker = findField(state, attackerId, pending.attackerInstanceId);
  const defenderId = pending.substituteInstanceId ?? pending.defenderInstanceId;
  const defenderOwner = findField(state, pending.defenderPlayerId, defenderId) ? pending.defenderPlayerId : opponent(pending.defenderPlayerId);
  const defender = findField(state, defenderOwner, defenderId);
  if (!attacker || !defender) return null;
  const size = unitSizeOf(state.definitions, attacker);
  if (!size || size !== unitSizeOf(state.definitions, defender)) return null;
  const top = state.players[attackerId].deck[0];
  if (!top) return null;
  const n = costNumber(state, top.cardId);
  let values: { attacker: number; defender: number } | undefined;
  if (n === 1 || n === 3 || n === 5) {
    values = { attacker: costNumber(state, attacker.cardId) ?? 0, defender: costNumber(state, defender.cardId) ?? 0 };
  } else if (n === 2 || n === 4 || n === 6) {
    values = { attacker: unitFeatures(state, attackerId, attacker).length, defender: unitFeatures(state, defenderOwner, defender).length };
  }
  let next = patchPlayer(state, attackerId, (p) => ({ ...p, deck: [...p.deck.slice(1), p.deck[0]!] }));
  next = { ...next, log: [...next.log, logFor(state, attackerId, "XG3-097", `xg3097_roulette:${top.instanceId}:${values ? `${values.attacker}-${values.defender}` : "bp"}`)] };
  return resolveBattleLogged(next, { ...pending, xg3RouletteDone: true, ...(values ? { xg3Values: values } : {}) });
});

// ---------------------------------------------------------------------------
// XG3-098 ロボタック【ジシャックチェンジ】（atwiki/page-1950）
// 「これが自軍バトルエリアからラッシュエリアに戻るとき、これをホールドして次の効果を発動できる⇒自軍山札から特徴「スペシャルモード」を持つカードを
//  1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。」
// バトルエリアからラッシュエリアに戻ったあと（行動の後処理）に、発動するか選ぶ（任意。これを選んで答える）。特徴は印刷のもの。選ぶのは強制。

const JISHAKU_EFFECT_ID = "xg3098_jishaku_change";
const JISHAKU_PICK_EFFECT_ID = "xg3098_jishaku_change_pick";

AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    for (const card of before.players[pid].battle.filter((c) => isSameCardIdentity(c.cardId, "XG3-098"))) {
      const now = after.players[pid].rush.find((c) => c.instanceId === card.instanceId);
      if (!now || now.commandHeld) continue;
      next = openAfter(next, {
        ...base({ playerId: pid, phasePlayerId: turnPlayer(after), sourceInstanceId: card.instanceId }, "XG3-098"),
        effectId: JISHAKU_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: [card.instanceId],
        selectCount: 1,
        optional: true,
      });
    }
  }
  return next;
});
CHOICE_SKIPPERS[JISHAKU_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[JISHAKU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = holdFieldCard(close(state, pending), playerId, instanceId);
  const log = logFor(state, playerId, "XG3-098", `${JISHAKU_EFFECT_ID}:${instanceId}`);
  const ids = next.players[playerId].deck.filter((c) => printedFeatures(next, c.cardId).includes("スペシャルモード")).map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(shuffleDeck(next, playerId), pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-098"), effectId: JISHAKU_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[JISHAKU_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] };
  });
  next = shuffleDeck(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-098", `${JISHAKU_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-099 ロボタックSM【RKバー】（NC5。atwiki/page-2010）
// 「敵軍バトルエリアからSユニットを1体選んでもよい。そうしたとき、選んだユニットは、次の相手ターン、アタックもストライクもできない。」
// 選んだユニットを記録し（state.xg3.rkBar）、持ち主の次のターンのスタートフェイズ開始時に「そのターン、アタックもストライクもできない」制限
// （RS-326 と同じ制限。rules/keywordGapRuntime.ts battleActBlocked）を付ける。

const RK_BAR_EFFECT_ID = "xg3099_rk_bar";

KEYWORDS["XG3-099::rk_bar"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG3-099", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3099:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-099"), effectId: RK_BAR_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: RK_BAR_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[RK_BAR_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[RK_BAR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const done: GameState = { ...next, xg3: { ...next.xg3, rkBar: [...(next.xg3?.rkBar ?? []), { ownerId: opponent(playerId), instanceId, turn: next.turn }] } };
  return { state: proceed(done, pending), log: logFor(state, playerId, "XG3-099", `${RK_BAR_EFFECT_ID}:${instanceId}`) };
};
START_PHASE_HOOKS.push((state, playerId) => {
  const bars = state.xg3?.rkBar ?? [];
  const due = bars.filter((b) => b.ownerId === playerId && b.turn !== state.turn);
  if (due.length === 0) return state;
  let next = patchPlayer(state, playerId, (p) => due.reduce((acc, b) => addTurnRestrictionModifier(acc, b.instanceId, "neko_damashi_no_attack_strike"), p));
  next = { ...next, xg3: { ...next.xg3, rkBar: bars.filter((b) => !due.includes(b)) } };
  return next;
});

// ---------------------------------------------------------------------------
// XG3-100 少年同盟（オペレーション。atwiki/page-2012）
// 「自分の手札から、Sビークルのカードと、MAを持ちRCを持つSユニットのカードをそれぞれ1枚ずつ選び、相手に見せてもよい。そうしたとき、見せた2枚の
//  カードを好きな順番で自軍ラッシュエリアに出す。ただし、追加条件はそれぞれ満たすこと。」
// ビークルはカテゴリを問わない（コメント欄）。カテゴリ・CN は印刷のもの。追加条件を持つカードは候補にしない（満たす手順を用意していない）。
// 見せるかはビークルの選択で答える（見送れる）。両方の候補があるときだけ発動できる。

const DOMEI_EFFECT_ID = "xg3100_shonen_domei";
const DOMEI_UNIT_EFFECT_ID = "xg3100_shonen_domei_unit";

function noCondition(state: GameState, cardId: string): boolean {
  return !getDefinition(state.definitions, cardId)?.rushAdditionalCondition;
}

function domeiVehicles(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return isVehicle(d) && d?.size === "S" && noCondition(state, c.cardId);
    })
    .map((c) => c.instanceId);
}

function domeiUnits(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.size === "S" && d.comboNumber === "RC" && printedCategories(state, c.cardId).includes("MA") && noCondition(state, c.cardId);
    })
    .map((c) => c.instanceId);
}

KEYWORDS["XG3-100::shonen_domei"] = (state, ctx) => {
  const vehicles = domeiVehicles(state, ctx.playerId);
  if (vehicles.length === 0 || domeiUnits(state, ctx.playerId).length === 0) return { state, detail: "xg3100:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-100"), effectId: DOMEI_EFFECT_ID, kind: "select_unit", validInstanceIds: vehicles, selectCount: 1, optional: true }),
    detail: DOMEI_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[DOMEI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[DOMEI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  return {
    state: openFollow(next, pending, {
      ...base(pendingBase(pending), "XG3-100"),
      effectId: DOMEI_UNIT_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: domeiUnits(next, playerId),
      selectCount: 1,
      optional: false,
      xg3Meta: { picked: [instanceId] },
    }),
    log: logFor(state, playerId, "XG3-100", `${DOMEI_EFFECT_ID}:${instanceId}`),
  };
};
CHOICE_RESOLVERS[DOMEI_UNIT_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveHandToRush(close(state, pending), playerId, [...(pending.xg3Meta?.picked ?? []), instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-100", `${DOMEI_UNIT_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-101 イナズマン【逆転チェスト】（CN：RC。atwiki/page-1966）
// 「次の相手ターン中、1度だけ次の効果を発動できる⇒これがユニットでなくなるとき、これをホールドしてその場に留めてもよい。そうしたとき、これのBP以下の
//  BPを持つ敵軍ユニットを1体選び撃破する。」
// RC したターンを記録し（state.xg3.chest）、相手のターン中にこれが場を離れるとき（rules/operationCounters.ts tryLeaveField）、留めるか選ぶ（任意。
// これを選んで答える）。留めたら、これをホールドし、これの BP 以下の敵軍ユニットを選んで撃破する（強制）。記録は持ち主の次のターンの開始時に消す。

const CHEST_EFFECT_ID = "xg3101_chest";
const CHEST_PICK_EFFECT_ID = "xg3101_chest_pick";

KEYWORDS["XG3-101::chest"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id) return { state, detail: "xg3101:no_source" };
  return { state: { ...state, xg3: { ...state.xg3, chest: [...(state.xg3?.chest ?? []).filter((c) => c.instanceId !== id), { ownerId: ctx.playerId, instanceId: id, turn: state.turn }] } }, detail: "xg3101:chest" };
};
START_PHASE_HOOKS.push((state, playerId) => {
  const chest = state.xg3?.chest ?? [];
  const keep = chest.filter((c) => c.ownerId !== playerId || c.turn === state.turn);
  return keep.length === chest.length ? state : { ...state, xg3: { ...state.xg3, chest: keep } };
});

function markChestUsed(state: GameState, instanceId: string): GameState {
  return { ...state, xg3: { ...state.xg3, chest: (state.xg3?.chest ?? []).map((c) => (c.instanceId === instanceId ? { ...c, used: true } : c)) } };
}

LEAVE_STAY_HOOKS.push((state: GameState, intent: PendingLeave) => {
  if (intent.toZone === "battle" || state.pendingEffectChoice) return null;
  const ownerId = intent.ownerPlayerId;
  const rec = (state.xg3?.chest ?? []).find((c) => c.instanceId === intent.instanceId && c.ownerId === ownerId && !c.used && c.turn !== state.turn);
  if (!rec || turnPlayer(state) === ownerId) return null;
  if (!findField(state, ownerId, intent.instanceId)) return null;
  return {
    ...state,
    pendingEffectChoice: {
      ...base({ playerId: ownerId, phasePlayerId: intent.phasePlayerId, sourceInstanceId: intent.instanceId }, "XG3-101"),
      effectId: CHEST_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: [intent.instanceId],
      selectCount: 1,
      optional: true,
      xg3Meta: { leave: intent },
    },
    activePlayer: ownerId,
  };
});
CHOICE_RESOLVERS[CHEST_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.xg3Meta?.leave;
  if (!intent) return { error: "invalid_choice" };
  let next: GameState = markChestUsed({ ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }, instanceId);
  next = holdFieldCard(next, playerId, instanceId);
  // その場に留まる（撃破された事実は残る。R-DESTROY-02）。
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  const self = findField(next, playerId, instanceId);
  const bp = self ? effectiveBp(next, playerId, self) : 0;
  const enemyId = opponent(playerId);
  const ids = self ? fieldUnits(next, enemyId).filter((c) => effectiveBp(next, enemyId, c) <= bp && selectableEnemy(next, playerId, "XG3-101", c)).map((c) => c.instanceId) : [];
  const log = logFor(state, playerId, "XG3-101", `${CHEST_EFFECT_ID}:stay`);
  if (ids.length > 0) {
    next = openAfter(next, { ...base({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: instanceId }, "XG3-101"), effectId: CHEST_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false });
  }
  const follow = intent.followUpAttackerLeave;
  if (follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) next = tryLeaveField(next, { ...follow }).state;
  const settled = next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
  return { state: settled, log };
};
CHOICE_SKIPPERS[CHEST_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const intent = pending.xg3Meta?.leave;
  if (!intent) return { error: "invalid_choice" };
  const cleared = markChestUsed({ ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }, intent.instanceId);
  const leave = tryLeaveField(cleared, intent);
  let next = leave.state;
  const follow = intent.followUpAttackerLeave;
  if (!leave.deferred && follow && !next.pendingLeave && !next.pendingEffectChoice && !next.pendingRegister) next = tryLeaveField(next, { ...follow }).state;
  const settled = next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
  return { state: settled, log: logFor(state, playerId, "XG3-101", `${CHEST_EFFECT_ID}:skip`) };
};
CHOICE_RESOLVERS[CHEST_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-101", CHEST_PICK_EFFECT_ID, [instanceId]);
  const settled = next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
  return { state: proceed(settled, pending), log: logFor(state, playerId, "XG3-101", `${CHEST_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-102 サナギマン【チョーリキショーライ！】（atwiki/page-1952）
// 「敵軍ターン中、このユニットがホールド状態になったとき、MAを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒これをリリースするか、
//  自分の手札から「イナズマン」のユニットカードを1枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。」
// ホールド状態になった行動のあと（後処理）に、発動するか選ぶ（任意。これを選んで答える）。MA のコマンドを1つホールドしてから（候補が1つなら選ばない）、
// これ（リリースする）か手札の「イナズマン」を選ぶ。イナズマンは追加条件（自軍「サナギマン」1体を捨札）だけ満たして出す（必要パワーは要らない。
// コメント欄）。捨札にするサナギマンが2体以上なら選ぶ。

const SANAGI_EFFECT_ID = "xg3102_chorikishorai";
const SANAGI_HOLD_EFFECT_ID = "xg3102_chorikishorai_hold";
const SANAGI_MODE_EFFECT_ID = "xg3102_chorikishorai_mode";
const SANAGI_DISCARD_EFFECT_ID = "xg3102_chorikishorai_discard";

AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    if (turnPlayer(after) === pid) continue;
    const was = [...before.players[pid].battle, ...before.players[pid].rush].filter((c) => isSameCardIdentity(c.cardId, "XG3-102") && !c.commandHeld);
    for (const card of was) {
      const now = findField(after, pid, card.instanceId);
      if (!now?.commandHeld) continue;
      if (releasedCommandIds(after, pid, "MA").length === 0) continue;
      next = openAfter(next, {
        ...base({ playerId: pid, phasePlayerId: turnPlayer(after), sourceInstanceId: card.instanceId }, "XG3-102"),
        effectId: SANAGI_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: [card.instanceId],
        selectCount: 1,
        optional: true,
      });
    }
  }
  return next;
});
CHOICE_SKIPPERS[SANAGI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[SANAGI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const held = holdThen(next, { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: instanceId }, "XG3-102", SANAGI_HOLD_EFFECT_ID, releasedCommandIds(next, playerId, "MA"), 1, { resumeChoice: pending.resumeChoice });
  return { state: held, log: logFor(state, playerId, "XG3-102", `${SANAGI_EFFECT_ID}:${instanceId}`) };
};

function sanagiIds(state: GameState, playerId: PlayerId): string[] {
  return fieldUnits(state, playerId).filter((c) => nameIs(state, c.cardId, "サナギマン")).map((c) => c.instanceId);
}

HOLD_COMPLETERS[SANAGI_HOLD_EFFECT_ID] = (state, pending) => {
  const self = pending.sourceInstanceId!;
  const inazuman = sanagiIds(state, pending.playerId).length > 0
    ? state.players[pending.playerId].hand.filter((c) => isUnitCard(state, c.cardId) && nameIs(state, c.cardId, "イナズマン")).map((c) => c.instanceId)
    : [];
  const options = [...(findField(state, pending.playerId, self) ? [self] : []), ...inazuman];
  if (options.length === 0) return proceed(state, pending);
  return openFollow(state, pending, { ...base(pendingBase(pending), "XG3-102"), effectId: SANAGI_MODE_EFFECT_ID, kind: "select_unit", validInstanceIds: options, selectCount: 1, optional: false });
};
CHOICE_RESOLVERS[SANAGI_MODE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const log = logFor(state, playerId, "XG3-102", `${SANAGI_MODE_EFFECT_ID}:${instanceId}`);
  if (instanceId === pending.sourceInstanceId) {
    next = patchPlayer(next, playerId, (p) => ({
      ...p,
      battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)),
      rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)),
    }));
    return { state: proceed(next, pending), log };
  }
  const sanagi = sanagiIds(next, playerId);
  if (sanagi.length === 1) {
    next = moveFieldUnit(next, playerId, sanagi[0]!, pending.phasePlayerId, "discard");
    return { state: proceed(moveHandToRush(next, playerId, [instanceId]), pending), log };
  }
  return {
    state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-102"), effectId: SANAGI_DISCARD_EFFECT_ID, kind: "select_unit", validInstanceIds: sanagi, selectCount: 1, optional: false, xg3Meta: { targetInstanceId: instanceId } }),
    log,
  };
};
CHOICE_RESOLVERS[SANAGI_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
  const target = pending.xg3Meta?.targetInstanceId;
  if (target) next = moveHandToRush(next, playerId, [target]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-102", `${SANAGI_DISCARD_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-103 ライジンゴー【噛みつき】（Sビークル。atwiki/page-1884）
// 「自軍バトルフェイズ中、このビークルが自軍ラッシュエリアでライドされていなければ、自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、
//  これは本来のテキストを持たないSユニットとして扱い、次の情報とテキストが追加される⇒「BP2000」「SP空欄」「ウイング」」
// 起動は activate_field_unit_ability（バトルフェイズ・1ターン1回）。リリース状態の自軍コマンドを1つホールドし（候補が1つなら選ばない）、
// このターンの記録（state.xg3.raijingo）を残す。記録がある間、ライドされていなくてもバトルエリアに出られ、BP2000 として扱う（rules/xg3/xg3Fields.ts）。

const RAIJINGO_HOLD_EFFECT_ID = "xg3103_kamitsuki";

function raijingoMounted(state: GameState, playerId: PlayerId, vehicleId: string): boolean {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].some((c) => c.mountedOnInstanceId === vehicleId);
}

FIELD_ABILITIES.push({
  phase: "battle",
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-103"),
  canActivate: (state, playerId, card) =>
    state.phase === "battle" &&
    isOwnTurn(state, playerId) &&
    !state.pendingEffectChoice &&
    state.players[playerId].rush.some((c) => c.instanceId === card.instanceId) &&
    !raijingoMounted(state, playerId, card.instanceId) &&
    releasedCommandIds(state, playerId).length > 0,
  resolve: (state, playerId, card) =>
    holdThen(state, { playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, "XG3-103", RAIJINGO_HOLD_EFFECT_ID, releasedCommandIds(state, playerId), 1),
});
HOLD_COMPLETERS[RAIJINGO_HOLD_EFFECT_ID] = (state, pending) => {
  const self = pending.sourceInstanceId!;
  const next: GameState = { ...state, xg3: { ...state.xg3, raijingo: [...(state.xg3?.raijingo ?? []).filter((r) => r.turn === state.turn && r.instanceId !== self), { instanceId: self, turn: state.turn }] } };
  return proceed({ ...next, log: [...next.log, logFor(state, pending.playerId, "XG3-103", `${RAIJINGO_HOLD_EFFECT_ID}:${self}`)] }, pending);
};
