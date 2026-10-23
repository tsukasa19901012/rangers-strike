/**
 * クロスギャザーのシークレットレア SX-001〜SX-010・レンジャーズストライクのシークレットレア SR-001〜SR-008 のカード固有の効果
 * （cardSpec PROMO2-SX-SR の監査）。起点は DSL の grant_keyword（`promo::<ID>::name`。rules/promo/promoRegistry.ts）と、
 * rules/promo/promoHooks.ts の継続効果の登録。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, cardWorks, effectiveCommandCategories, getDefinition, parsePowerCost, unitSizeOf } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { countAvailablePower } from "../../core/power";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardHasBattleKeyword } from "../../keywords/battleKeywords";
import { unitFeatures } from "../addedFeatures";
import { startEffectRush } from "../effectRush";
import { spBecomesInZone } from "../fractionalSp";
import { isSmallUnitNow, turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { applyUnitLeave } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import {
  base,
  close,
  ctxBase,
  fieldUnits,
  genericPick,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
} from "../rm/rm1Effects";
import { applyZorobTopDeckReveal } from "../batch06FieldEffects";
import { plasmaShockwaveActive, srBigBatonHasFeature } from "../srEffects";
import { SUPER_FORMATION_RULE } from "../zord";
import {
  registerPromoAttackerBpBonus,
  registerPromoDefenderBpBonus,
  registerPromoForcesAttack,
  registerPromoSpFloor,
  registerPromoUnnamedTextNegation,
} from "./promoHooks";
import {
  registerPromoAfterAction,
  registerPromoAttackStrikeBlock,
  registerPromoBattleDestroy,
  registerPromoBpBonus,
  registerPromoChoice,
  registerPromoDeckRevealIntercept,
  registerPromoFieldAbility,
  registerPromoKeyword,
  registerPromoKeywordGrant,
} from "./promoRegistry";

function onField(state: GameState, playerId: PlayerId, unit: Pick<CardInstance, "instanceId">): boolean {
  const p = state.players[playerId];
  return p.battle.some((c) => c.instanceId === unit.instanceId) || p.rush.some((c) => c.instanceId === unit.instanceId);
}

function fieldZoneOf(state: GameState, playerId: PlayerId, instanceId: string): "battle" | "rush" | null {
  const p = state.players[playerId];
  if (p.battle.some((c) => c.instanceId === instanceId)) return "battle";
  if (p.rush.some((c) => c.instanceId === instanceId)) return "rush";
  return null;
}

/** このターン「SP1」になる（場のユニット）。 */
function sp1ThisTurn(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const zone = fieldZoneOf(state, playerId, instanceId);
  return zone ? spBecomesInZone(state, playerId, zone, instanceId, 1) : state;
}

/** 場・捨札のカードをゲームから除外する（持ち主の除外ゾーン）。 */
function exileCard(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = [...p.battle, ...p.rush, ...p.discard].find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const drop = (cards: CardInstance[]) =>
      cards.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c));
    return {
      ...p,
      battle: drop(p.battle),
      rush: drop(p.rush),
      discard: [...drop(p.discard), ...(card.stackedCards ?? []).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
      exile: [...(p.exile ?? []), { instanceId: card.instanceId, cardId: card.cardId }],
    };
  });
}

function enemySUnits(state: GameState, playerId: PlayerId, sourceCardId: string): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => isSmallUnitNow(state, enemyId, c) && selectableEnemy(state, playerId, sourceCardId, c))
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// SX-001 仮面ライダー電王超CF【超ボイスターズキック】（自軍ターン中、バトルエリアに出たとき）
// 「自軍パワーゾーンから、オモテ向きのカードとウラ向きのカードをそれぞれ1枚ずつ選び捨札にしてもよい。そうしたとき、このターン、これは「SP1」になる。」
// （atwiki/page-1681）。オモテ向き→ウラ向きの順に選ぶ（1枚目を選ぶことが発動）。どちらかがなければ発動しない。
// ウラ向き（ダメージ）を捨札にした分、ダメージは1減る。

const VOICE = "sx001_voice_kick";
const VOICE_DOWN = "sx001_voice_kick_down";

registerPromoKeyword("SX-001::voice_kick", (state, ctx) => {
  if (turnPlayerOf(state) !== ctx.playerId) return { state, detail: `${VOICE}:not_own_turn` };
  const p = state.players[ctx.playerId];
  const up = p.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  const down = p.power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (up.length === 0 || down.length === 0) return { state, detail: `${VOICE}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: VOICE, kind: "select_power", validInstanceIds: up, selectCount: 1, optional: true }),
    detail: VOICE,
  };
});

registerPromoChoice(
  VOICE,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const down = state.players[playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
    return {
      state: openNext(close(state, pending), pending, { ...pending, effectId: VOICE_DOWN, validInstanceIds: down, selectedInstanceIds: [], optional: false, promoMeta: { up: instanceId } }),
      log: logFor(state, playerId, pending.sourceCardId, `${VOICE}:${instanceId}`),
    };
  },
  simpleSkip(),
);

registerPromoChoice(VOICE_DOWN, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const ids = new Set([(pending.promoMeta?.up as string | undefined) ?? "", instanceId]);
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const picked = p.power.filter((c) => ids.has(c.instanceId));
    const removedDamage = picked.filter((c) => c.faceDown).length;
    return {
      ...p,
      power: p.power.filter((c) => !ids.has(c.instanceId)),
      discard: [...p.discard, ...picked.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
      damage: Math.max(0, p.damage - removedDamage),
    };
  });
  if (pending.sourceInstanceId) next = sp1ThisTurn(next, playerId, pending.sourceInstanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${VOICE_DOWN}:${instanceId}`) };
});

// ---------------------------------------------------------------------------
// SX-002 仮面ライダークウガRU【黒い瞳に映るもの】
// 「これが自軍バトルエリアにある間、特徴「仮面ライダー」を持つユニットは、アタックかストライクを選ぶとき、可能ならアタックを選ぶ。」（atwiki/page-1831）
// 敵味方を問わない。アタックできる相手がいればストライクの行動を出さない（何もしないことはできる。core/legalActions.ts）。

registerPromoForcesAttack(
  (state, ownerId, unit) =>
    (["player1", "player2"] as const).some((pid) => state.players[pid].battle.some((c) => isSameCardIdentity(c.cardId, "SX-002"))) &&
    unitFeatures(state, ownerId, unit).includes("仮面ライダー"),
);

// ---------------------------------------------------------------------------
// SX-003 仮面ライダーW・FJ
// ※「自軍ターン中、これが自軍バトルエリアにある間、敵軍バトルエリアにあるユニットの効果名を持たないテキストは無効になり、発動もできない。」
// （atwiki/page-2017）。無効にするのは※のうち、アタックされない等の守り（dsl/promotedKeywordBridge.ts）と※レジスト（rules/resist.ts）。
// 【アーム・ファング】「これはバトルするとき、BP+3000される。」— アタックしてもアタックされても。

function fjActiveAgainst(state: GameState, ownerId: PlayerId): boolean {
  const fjOwner = opponent(ownerId);
  return turnPlayerOf(state) === fjOwner && state.players[fjOwner].battle.some((c) => isSameCardIdentity(c.cardId, "SX-003"));
}
registerPromoUnnamedTextNegation((state, ownerId) => fjActiveAgainst(state, ownerId));

registerPromoAttackerBpBonus((state, battle) => {
  const attacker = state.players[battle.attackerPlayerId].battle.find((c) => c.instanceId === battle.attackerInstanceId);
  return attacker && isSameCardIdentity(attacker.cardId, "SX-003") ? 3000 : 0;
});
registerPromoDefenderBpBonus((_state, _ownerId, unit) => (isSameCardIdentity(unit.cardId, "SX-003") ? 3000 : 0));
registerPromoKeyword("SX-003::arm_fang", (state) => ({ state, detail: "sx003_arm_fang:battle_bp" }));

// ---------------------------------------------------------------------------
// SX-004 ハイパーゴーオンレッド【音速の赤き侍】（NC。CN4、ライドオフしたときはナンバーに関係なく発動する）
// 「「SP1」 敵軍バトルエリアから、ライドされている敵軍ビークルを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-2157）
// 「SP1」は DSL の grant_keyword。ビークルのサイズは問わない（カード評価）。

const SONIC = "sx004_sonic_samurai";
registerPromoKeyword("SX-004::sonic_samurai", (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const ids = enemy.battle
    .filter(
      (c) =>
        getDefinition(state.definitions, c.cardId)?.type === "vehicle" &&
        enemy.battle.some((u) => u.mountedOnInstanceId === c.instanceId) &&
        selectableEnemy(state, ctx.playerId, ctx.sourceCardId, c),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${SONIC}:no_targets` };
  return { state: openAfter(state, genericPick(ctxBase(ctx), ctx.sourceCardId, SONIC, ids, false, "power")), detail: SONIC };
});

// ---------------------------------------------------------------------------
// SX-005 仮面ライダーW・CJX【ビッカーファイナリュージョン】
// 「このユニットは自軍コマンドゾーンにあるカードのカテゴリごとに次の能力を得る⇒WBがあればレジストを得る。MAがあれば、これが敵軍ユニットを
//  バトルで撃破したとき、撃破したユニットを捨札にするかわりに持ち主のパワーゾーンにダメージにして置いてもよい。ETがあればBP+3000される。
//  DAがあれば「SP1」になる。」（atwiki/page-2267）
// カテゴリはコマンドゾーンのカード（リリース・ホールドを問わない。マルチカテゴリはそれぞれ）。MA の置き換えは、撃破して捨札になった直後に
// 捨札から持ち主のパワーゾーンにウラ向きで移す（任意）。

function commandCats(state: GameState, playerId: PlayerId): Set<string> {
  const p = state.players[playerId];
  return new Set(p.command.flatMap((c) => effectiveCommandCategories(p, state.definitions, c.cardId) as string[]));
}

function isCjx(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  return isSameCardIdentity(unit.cardId, "SX-005") && onField(state, playerId, unit);
}

registerPromoKeywordGrant((state, ownerId, unit, keyword) => keyword === "register" && isCjx(state, ownerId, unit) && commandCats(state, ownerId).has("WB"));
registerPromoBpBonus((state, playerId, unit) => (isCjx(state, playerId, unit) && commandCats(state, playerId).has("ET") ? 3000 : 0));
registerPromoSpFloor((state, playerId, unit) => (isCjx(state, playerId, unit) && commandCats(state, playerId).has("DA") ? 1 : 0));

const CJX_DAMAGE = "sx005_finalization_damage";
registerPromoBattleDestroy(
  CJX_DAMAGE,
  (state, winnerId, winnerInstanceId, defeated) => {
    if (defeated.ownerId === winnerId) return [];
    const winner = fieldUnits(state, winnerId).find((c) => c.instanceId === winnerInstanceId);
    if (!winner || !isSameCardIdentity(winner.cardId, "SX-005") || !commandCats(state, winnerId).has("MA")) return [];
    return [{ kind: CJX_DAMAGE, playerId: winnerId, sourceInstanceId: winnerInstanceId, phasePlayerId: turnPlayerOf(state), data: { target: defeated.instanceId, owner: defeated.ownerId, sourceCardId: winner.cardId } }];
  },
  (state, trigger) => {
    const { target, owner, sourceCardId } = (trigger.data ?? {}) as { target: string; owner: PlayerId; sourceCardId: string };
    if (!state.players[owner].discard.some((c) => c.instanceId === target)) return null;
    const ctx = { playerId: trigger.playerId, phasePlayerId: trigger.phasePlayerId, sourceInstanceId: trigger.sourceInstanceId };
    return { ...base(ctx, sourceCardId), effectId: CJX_DAMAGE, kind: "select_unit", validInstanceIds: [target], selectCount: 1, optional: true, promoMeta: { owner } };
  },
);

registerPromoChoice(
  CJX_DAMAGE,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const owner = (pending.promoMeta?.owner as PlayerId | undefined) ?? opponent(playerId);
    const card = state.players[owner].discard.find((c) => c.instanceId === instanceId);
    if (!card || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = patchPlayer(close(state, pending), owner, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      power: [...p.power, { instanceId: card.instanceId, cardId: card.cardId, faceDown: true }],
      damage: p.damage + 1,
    }));
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${CJX_DAMAGE}:${instanceId}`) };
  },
  simpleSkip(),
);

// ---------------------------------------------------------------------------
// SX-006 仮面ライダーG電王【時間警察の使者】（ラッシュしたとき）
// 「必要パワーを満たしていないSユニットとSビークルを可能な限りすべて選び、捨札にする。」（atwiki/page-2269）
// 敵味方を問わない。満たしているかは持ち主のパワーの数（R-POW-01）と印刷の必要パワーの数字で比べる。「選び」なので選ばれない敵軍のカード
// （ブレイカー等）は残る。捨札は撃破ではない。

registerPromoKeyword("SX-006::time_police", (state, ctx) => {
  let next = state;
  const hits: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    const power = countAvailablePower(state, pid);
    for (const c of [...state.players[pid].battle, ...state.players[pid].rush]) {
      const d = getDefinition(state.definitions, c.cardId);
      if (!d || (d.type !== "unit" && d.type !== "vehicle") || unitSizeOf(state.definitions, c) !== "S") continue;
      if (parsePowerCost(d.powerCost) <= power) continue;
      if (pid !== ctx.playerId && !selectableEnemy(state, ctx.playerId, ctx.sourceCardId, c)) continue;
      hits.push(`${pid}|${c.instanceId}`);
    }
  }
  for (const hit of hits) {
    const [pid, id] = hit.split("|") as [PlayerId, string];
    next = moveFieldUnit(next, pid, id, ctx.phasePlayerId, "discard");
  }
  return { state: next, detail: `sx006_time_police:${hits.length}` };
});

// ---------------------------------------------------------------------------
// SX-007 スーパーゴセイレッド【スーパースカイダイナミック】（NC。CN1）
// 「敵軍Sユニットを1体選び持ち主のパワーゾーンにダメージにして置く。そうしたとき、これをリリースしてもよい。」（atwiki/page-2356）
// 敵軍 S ユニットはエリアを問わない（L は選べない）。これがホールド状態のときだけ、リリースするかを尋ねる。

const SKY = "sx007_sky_dynamic";
const SKY_RELEASE = "sx007_sky_dynamic_release";
registerPromoKeyword("SX-007::sky_dynamic", (state, ctx) => {
  const ids = enemySUnits(state, ctx.playerId, ctx.sourceCardId);
  if (ids.length === 0) return { state, detail: `${SKY}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: SKY, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: SKY,
  };
});

registerPromoChoice(SKY, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  const log = logFor(state, playerId, pending.sourceCardId, `${SKY}:${instanceId}`);
  const self = fieldUnits(next, playerId).find((c) => c.instanceId === pending.sourceInstanceId);
  if (!self?.commandHeld) return { state: proceed(next, pending), log };
  return {
    state: openAfter(next, { ...pending, effectId: SKY_RELEASE, kind: "confirm", validInstanceIds: ["release"], selectedInstanceIds: [], optional: true }),
    log,
  };
});

registerPromoChoice(
  SKY_RELEASE,
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const id = pending.sourceInstanceId;
    const release = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === id ? { ...c, commandHeld: false } : c));
    const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, battle: release(p.battle), rush: release(p.rush) }));
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${SKY_RELEASE}:release`) };
  },
  simpleSkip(),
);

// ---------------------------------------------------------------------------
// SX-008 超・電王トリロジー（オペレーション）
// 「これを使用するためにホールドしたコマンドのカテゴリごとに、次の効果を発動できる→ ◎WBなら、敵軍Sユニットを１体選び、ゲームから除外する。
//  ◎OTなら、自軍Sユニットを１体選ぶ。このターン、選んだユニットは「SP1」になる。 ◎MAなら、自分は３枚ドローする。」（atwiki/page-2357）
// ホールドしたコマンドは支払いの記録（state.rk12OpPaid）。コマンドゾーンのカードはそのカテゴリ（マルチカテゴリはそれぞれ）、リードで
// ホールドしたユニットはそのユニットのカテゴリ（Q1「ＭＡとＷＢになります」）。WB→OT→MA の順に処理し、WB・OT は選ばずに見送れる。
// MA のドローは選択を開かずに行う。

const TRI_WB = "sx008_trilogy_wb";
const TRI_OT = "sx008_trilogy_ot";

function trilogyCats(state: GameState, ctx: GrantKeywordContext): Set<string> {
  const paid = state.rk12OpPaid && state.rk12OpPaid.instanceId === ctx.operationInstanceId ? state.rk12OpPaid.commandIds : [];
  const p = state.players[ctx.playerId];
  const cats = new Set<string>();
  for (const id of paid) {
    const command = p.command.find((c) => c.instanceId === id);
    if (command) {
      for (const c of effectiveCommandCategories(p, state.definitions, command.cardId)) cats.add(c);
      continue;
    }
    const unit = [...p.battle, ...p.rush].find((c) => c.instanceId === id);
    if (unit) for (const c of cardCategories(getDefinition(state.definitions, unit.cardId))) cats.add(c);
  }
  return cats;
}

function trilogyStep(state: GameState, choiceBase: PendingEffectChoice | null, ctx: { playerId: PlayerId; phasePlayerId: PlayerId; sourceInstanceId?: string; sourceCardId: string }, steps: string[]): GameState {
  let next = state;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const rest = steps.slice(i + 1);
    if (step === "WB") {
      const ids = enemySUnits(next, ctx.playerId, ctx.sourceCardId);
      if (ids.length === 0) continue;
      const choice: PendingEffectChoice = { ...base(ctx, ctx.sourceCardId), effectId: TRI_WB, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, promoMeta: { rest } };
      return choiceBase ? openNext(next, choiceBase, choice) : openAfter(next, choice);
    }
    if (step === "OT") {
      const ids = fieldUnits(next, ctx.playerId).filter((c) => isSmallUnitNow(next, ctx.playerId, c)).map((c) => c.instanceId);
      if (ids.length === 0) continue;
      const choice: PendingEffectChoice = { ...base(ctx, ctx.sourceCardId), effectId: TRI_OT, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, promoMeta: { rest } };
      return choiceBase ? openNext(next, choiceBase, choice) : openAfter(next, choice);
    }
    if (step === "MA") {
      for (let n = 0; n < 3; n++) next = patchPlayer(next, ctx.playerId, (p) => drawOne(p));
    }
  }
  return choiceBase ? proceed(next, choiceBase) : next;
}

registerPromoKeyword("SX-008::trilogy", (state, ctx) => {
  const cats = trilogyCats(state, ctx);
  const steps = ["WB", "OT", "MA"].filter((c) => cats.has(c));
  const c = { ...ctxBase(ctx), sourceCardId: ctx.sourceCardId };
  return { state: trilogyStep(state, null, c, steps), detail: `sx008_trilogy:${steps.join("+")}` };
});

function trilogyResume(state: GameState, pending: PendingEffectChoice): GameState {
  const rest = (pending.promoMeta?.rest as string[] | undefined) ?? [];
  return trilogyStep(state, pending, { playerId: pending.playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId, sourceCardId: pending.sourceCardId }, rest);
}

registerPromoChoice(
  TRI_WB,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = exileCard(close(state, pending), opponent(playerId), instanceId);
    return { state: trilogyResume(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${TRI_WB}:${instanceId}`) };
  },
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: trilogyResume(close(state, pending), pending), log: logFor(state, playerId, pending.sourceCardId, `${TRI_WB}:skip`) };
  },
);

registerPromoChoice(
  TRI_OT,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = sp1ThisTurn(close(state, pending), playerId, instanceId);
    return { state: trilogyResume(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${TRI_OT}:${instanceId}`) };
  },
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: trilogyResume(close(state, pending), pending), log: logFor(state, playerId, pending.sourceCardId, `${TRI_OT}:skip`) };
  },
);

// ---------------------------------------------------------------------------
// SX-009 ゴセイレッド×ゴーカイレッド【バトンタッチ】（起動。自軍ラッシュフェイズごとに1度だけ）
// 「これ以外の自軍Sユニットを捨札にしてもよい。そうしたとき、自軍山札を見て、捨札にしたユニットと作品名が異なるSユニットのカードを1枚選び
//  自軍ラッシュエリアに出す（必要パワーと追加条件は満たすこと）。このとき、捨札にしたユニットの作品名が「天装戦隊ゴセイジャー」、
//  ラッシュしたユニットの作品名が「海賊戦隊ゴーカイジャー」だったなら、敵軍Sユニットを1体選び撃破する。その後、山札をシャッフルする。」
// （atwiki/page-2457）。作品名はカタログの works（atwiki の「作品：」）。「作品名が異なる」は作品名を 1 つも共有しないこと
// （SX-009 のように 2 作品を持つカードは、どちらかが同じなら異なるとしない）。作品名の分からないカード（works なし）は除かない。

const BATON = "sx009_baton_touch";
const BATON_PICK = "sx009_baton_touch_pick";
const BATON_DESTROY = "sx009_baton_touch_destroy";

const GOSEIGER = "天装戦隊ゴセイジャー";
const GOKAIGER = "海賊戦隊ゴーカイジャー";

function batonOthers(state: GameState, playerId: PlayerId, selfId: string): string[] {
  return fieldUnits(state, playerId)
    .filter((c) => c.instanceId !== selfId && isSmallUnitNow(state, playerId, c))
    .map((c) => c.instanceId);
}

registerPromoFieldAbility({
  matches: (cardId) => isSameCardIdentity(cardId, "SX-009"),
  canActivate: (state, playerId, card) => state.phase === "rush" && turnPlayerOf(state) === playerId && batonOthers(state, playerId, card.instanceId).length > 0,
  resolve: (state, playerId, card) =>
    openAfter(state, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, card.cardId),
      effectId: BATON,
      kind: "select_unit",
      validInstanceIds: batonOthers(state, playerId, card.instanceId),
      selectCount: 1,
      optional: true,
    }),
});

registerPromoChoice(
  BATON,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const discarded = fieldUnits(state, playerId).find((c) => c.instanceId === instanceId);
    if (!discarded || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const works = cardWorks(state.definitions, discarded.cardId);
    const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
    const log = logFor(state, playerId, pending.sourceCardId, `${BATON}:${instanceId}`);
    const ids = next.players[playerId].deck
      .filter((c) => {
        const d = getDefinition(next.definitions, c.cardId);
        return d?.type === "unit" && unitSizeOf(next.definitions, c) === "S" && !cardWorks(next.definitions, c.cardId).some((w) => works.includes(w));
      })
      .map((c) => c.instanceId);
    if (ids.length === 0) return { state: proceed(shuffleDeck(next, playerId), pending), log };
    return {
      state: openNext(next, pending, { ...pending, effectId: BATON_PICK, validInstanceIds: ids, selectedInstanceIds: [], optional: false, promoMeta: { gosei: works.includes(GOSEIGER) } }),
      log,
    };
  },
  simpleSkip(),
);

registerPromoChoice(BATON_PICK, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId)!;
  let next = startEffectRush(close(state, pending), {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${BATON}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "deck",
    candidates: [instanceId],
    maxCount: 1,
    requireConditions: true,
    mandatory: true,
    forced: true,
  });
  const rushed = onField(next, playerId, card);
  next = shuffleDeck(next, playerId);
  const log = logFor(state, playerId, pending.sourceCardId, `${BATON_PICK}:${instanceId}:${rushed ? "rushed" : "not_rushed"}`);
  const combo = rushed && pending.promoMeta?.gosei === true && cardWorks(next.definitions, card.cardId).includes(GOKAIGER);
  const targets = combo ? enemySUnits(next, playerId, pending.sourceCardId) : [];
  if (targets.length === 0) return { state: proceed(next, pending), log };
  const ctx = { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
  return { state: openAfter(next, { ...genericPick(ctx, pending.sourceCardId, BATON_DESTROY, targets, false, "discard"), resumeChoice: pending.resumeChoice }), log };
});

// ---------------------------------------------------------------------------
// SX-010 オーズ・タトバ×W・CJ【MOVIE大戦】（NC。CN2）
// 「「SP1」 自軍捨札からクロスを持つカードを1枚選び、山札の下に戻すか、ゲームから除外してもよい。そうしたとき、山札の下に戻したなら、
//  このターン、これはBP+4000される。ゲームから除外したなら、敵軍Sユニット1体か敵軍捨札1枚を選びゲームから除外する。」（atwiki/page-2459）
// 「SP1」は DSL の grant_keyword。カードを選んだあと、戻すか除外するかを選ぶ（deck_bottom / exile）。

const MOVIE = "sx010_movie_war";
const MOVIE_MODE = "sx010_movie_war_mode";
const MOVIE_EXILE = "sx010_movie_war_exile";

registerPromoKeyword("SX-010::movie_war", (state, ctx) => {
  const ids = state.players[ctx.playerId].discard.filter((c) => cardHasBattleKeyword(state.definitions, c.cardId, "cross1")).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${MOVIE}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: MOVIE, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: MOVIE,
  };
});

registerPromoChoice(
  MOVIE,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    return {
      state: openNext(close(state, pending), pending, { ...pending, effectId: MOVIE_MODE, kind: "confirm", validInstanceIds: ["deck_bottom", "exile"], selectedInstanceIds: [], optional: false, promoMeta: { card: instanceId } }),
      log: logFor(state, playerId, pending.sourceCardId, `${MOVIE}:${instanceId}`),
    };
  },
  simpleSkip(),
);

registerPromoChoice(MOVIE_MODE, (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const cardId = (pending.promoMeta?.card as string | undefined) ?? "";
  const log = logFor(state, playerId, pending.sourceCardId, `${MOVIE_MODE}:${mode}`);
  if (mode === "deck_bottom") {
    const selfId = pending.sourceInstanceId;
    const buff = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === selfId ? { ...c, bpModifier: (c.bpModifier ?? 0) + 4000 } : c));
    const next = patchPlayer(close(state, pending), playerId, (p) => {
      const card = p.discard.find((c) => c.instanceId === cardId);
      if (!card) return p;
      return { ...p, discard: p.discard.filter((c) => c.instanceId !== cardId), deck: [...p.deck, card], battle: buff(p.battle), rush: buff(p.rush) };
    });
    return { state: proceed(next, pending), log };
  }
  if (mode !== "exile") return { error: "invalid_target" };
  const next = exileCard(close(state, pending), playerId, cardId);
  const enemyId = opponent(playerId);
  const ids = [...enemySUnits(next, playerId, pending.sourceCardId), ...next.players[enemyId].discard.map((c) => c.instanceId)];
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...pending, effectId: MOVIE_EXILE, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], optional: false, promoMeta: undefined }),
    log,
  };
});

registerPromoChoice(MOVIE_EXILE, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = exileCard(close(state, pending), opponent(playerId), instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${MOVIE_EXILE}:${instanceId}`) };
});

// ---------------------------------------------------------------------------
// SR-002 スーパーフォーメーション（RS-347 と同じ本文）— このターン、合体ユニットの不足分を自軍コマンドゾーンのリリース状態の同名カードで
// 補える（rules/zord.ts の SUPER_FORMATION_RULE。atwiki/page-388）。

registerPromoKeyword("SR-002::super_formation", (state, ctx) => ({
  state: patchPlayer(state, ctx.playerId, (p) => addTurnRuleModifier(p, SUPER_FORMATION_RULE, { sourceCardId: ctx.sourceCardId })),
  detail: "sr002_super_formation",
}));

// ---------------------------------------------------------------------------
// SR-007 大神龍【プラズマ衝撃波】の「そのかわりに、自分自身のバトルエリアのユニットを好きな数選び撃破できる」（atwiki/page-1235）。
// スタートフェイズに入ったとき、バトルエリアにユニットがあれば選択を開く（先頭の "plasma_done" で終える）。選ばずに残したユニットは、
// このターン、アタックもストライクもできない（Q2）。山札に戻す処理は rules/srEffects.ts applyPlasmaShockwaveShuffleBack。

const PLASMA = "sr007_plasma_destroy";
const PLASMA_DONE = "plasma_done";
const PLASMA_STAY_RULE = "sr007_plasma_stay";

function plasmaIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].battle.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit").map((c) => c.instanceId);
}

function plasmaChoice(state: GameState, playerId: PlayerId): PendingEffectChoice {
  return {
    ...base({ playerId, phasePlayerId: playerId }, "SR-007"),
    effectId: PLASMA,
    kind: "select_unit",
    validInstanceIds: [PLASMA_DONE, ...plasmaIds(state, playerId)],
    selectCount: 1,
    optional: true,
  };
}

function markPlasmaStay(state: GameState, playerId: PlayerId): GameState {
  const ids = plasmaIds(state, playerId);
  if (ids.length === 0) return state;
  return patchPlayer(state, playerId, (p) => addTurnRuleModifier(p, PLASMA_STAY_RULE, { sourceCardId: "SR-007", payload: ids }));
}

registerPromoAfterAction(
  PLASMA,
  (before, after) => {
    if (after.phase !== "start" || (before.phase === "start" && before.activePlayer === after.activePlayer)) return [];
    if (!plasmaShockwaveActive(after) || after.pendingEffectChoice) return [];
    const pid = after.activePlayer;
    return plasmaIds(after, pid).length > 0 ? [{ kind: PLASMA, playerId: pid, sourceInstanceId: "", phasePlayerId: pid }] : [];
  },
  (state, trigger) => (state.phase === "start" && plasmaIds(state, trigger.playerId).length > 0 ? plasmaChoice(state, trigger.playerId) : null),
);

registerPromoChoice(
  PLASMA,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const closed = close(state, pending);
    if (instanceId === PLASMA_DONE) return { state: proceed(markPlasmaStay(closed, playerId), pending), log: logFor(state, playerId, "SR-007", `${PLASMA}:done`) };
    const r = applyUnitLeave(closed, instanceId, "discard", playerId);
    if ("error" in r) return r;
    const log = logFor(state, playerId, "SR-007", `${PLASMA}:${instanceId}`);
    if (plasmaIds(r.state, playerId).length === 0) return { state: proceed(r.state, pending), log };
    return { state: openAfter(r.state, plasmaChoice(r.state, playerId)), log };
  },
  simpleSkip((state, pending) => markPlasmaStay(state, pending.playerId)),
);

registerPromoAttackStrikeBlock((state, playerId, unit) =>
  getPlayerModifiers(state.players[playerId]).some(
    (m) => m.kind === "rule" && m.ruleId === PLASMA_STAY_RULE && Array.isArray(m.payload) && (m.payload as string[]).includes(unit.instanceId),
  ),
);

// ---------------------------------------------------------------------------
// SR-008 ビッグワン【ビッグ・バトン】の「特徴「レッド」があればレジストを得る」（atwiki/page-1524。ほかの能力は rules/srEffects.ts）。

registerPromoKeywordGrant(
  (state, ownerId, unit, keyword) => keyword === "register" && isSameCardIdentity(unit.cardId, "SR-008") && srBigBatonHasFeature(state, ownerId, "レッド"),
);

// ---------------------------------------------------------------------------
// SR-006 シュリケンジャーFM【超忍法・分身魔球】（atwiki/page-811）
// 「これが自軍エリアにある間、自軍山札の上のカードが1枚オモテになるたび、オモテにしたカードを効果の対象にする前に次の効果を発動できる⇒
//  オモテにしたカードを手札に加える。そして、自分の手札からカードを1枚選び相手に見せ、オモテにしたカードのかわりに効果の対象にする。」
// 割り込むのは RS-367【軍隊アリの遺伝子】（rules/pendingChoices.ts）。手札のカード（加えたオモテのカードを含む）を選ぶことが発動、
// 見送れば元の効果がオモテのカードを対象にする。選んだカードは山札の上に置いたものとして元の効果（applyZorobTopDeckReveal）を処理する。

const BUNSHIN = "sr006_bunshin_makyu";

registerPromoDeckRevealIntercept((state, pending, topInstanceId) => {
  if (pending.effectId !== "arino") return null;
  const playerId = pending.playerId;
  const p = state.players[playerId];
  const fm = [...p.rush, ...p.battle].find((c) => isSameCardIdentity(c.cardId, "SR-006"));
  if (!fm) return null;
  const choice: PendingEffectChoice = {
    ...base({ playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: fm.instanceId }, "SR-006"),
    effectId: BUNSHIN,
    kind: "select_hand",
    // 先頭はオモテにしたカード自身（それを選べば元の効果の対象は変わらない）。
    validInstanceIds: [topInstanceId, ...p.hand.map((c) => c.instanceId)],
    selectCount: 1,
    optional: true,
    promoMeta: { top: topInstanceId },
  };
  return openNext(close(state, pending), pending, choice);
});

registerPromoChoice(
  BUNSHIN,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const topId = (pending.promoMeta?.top as string | undefined) ?? "";
    // オモテにしたカードを手札に加え、選んだ手札のカードを（山札の上にあるものとして）元の効果の対象にする。
    const next = patchPlayer(close(state, pending), playerId, (p) => {
      const top = p.deck.find((c) => c.instanceId === topId);
      const hand = top ? [...p.hand, { ...top, faceDown: false }] : p.hand;
      const chosen = hand.find((c) => c.instanceId === instanceId);
      if (!chosen) return p;
      return { ...p, deck: [chosen, ...p.deck.filter((c) => c.instanceId !== topId)], hand: hand.filter((c) => c.instanceId !== instanceId) };
    });
    return { state: proceed(applyZorobTopDeckReveal(next, playerId, instanceId), pending), log: logFor(state, playerId, "SR-006", `${BUNSHIN}:${instanceId}`) };
  },
  simpleSkip((state, pending) => applyZorobTopDeckReveal(state, pending.playerId, (pending.promoMeta?.top as string | undefined) ?? "")),
);
