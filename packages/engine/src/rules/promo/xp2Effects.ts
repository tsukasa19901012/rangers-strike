/**
 * クロスギャザー プロモーションカード XP-017〜XP-032 のカード固有の効果（cardSpec XP-017-032 の監査）。
 * 起点は DSL の grant_keyword（`promo::XP-NNN::name`。rules/promo/promoRegistry.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { commandCategoriesOf, cardCategories, effectiveBp, effectiveCommandCategories, getDefinition, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { countAvailablePower } from "../../core/power";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { resolveZordFusionPartnerSlots } from "../../dsl/zordBridge";
import { unitFeatures } from "../addedFeatures";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyDamageToPlayer } from "../damagePayment";
import { startEffectRush } from "../effectRush";
import { isSmallUnitNow, turnPlayerOf } from "../legend1/set6NamedEffectsB";
import { finalizeLeaveReaction } from "../operationCounters";
import { patchPlayer } from "../playerPatches";
import { recordReveal, revealedCards } from "../revealNotice";
import { base, close, ctxBase, fieldUnits, genericPick, logFor, moveFieldUnit, openAfter, openNext, proceed, selectableEnemy, shuffleDeck, simpleSkip } from "../rm/rm1Effects";
import { registerPromoAfterAction, registerPromoBpBonus, registerPromoChoice, registerPromoFieldAbility, registerPromoKeyword, registerPromoKeywordGrant, registerPromoStayOnLeave, registerPromoTurnEnd } from "./promoRegistry";
import { fillsSlot } from "./xpEffects";
import { registerPromoAttackerBpBonus, registerPromoOperationCostReduction } from "./promoHooks";
import { returnToDeckInOrder } from "../deckOrder";
import { gateReveal } from "../revealGate";

// ---------------------------------------------------------------------------
// XP-017 仮面ライダーディケイド激情態【世界の破壊者】（RC）
// 「自分と相手のパワーゾーンのカードの枚数をくらべ、枚数が多いパワーゾーンの持ち主は次のようにする⇒自分自身のパワーゾーンのカードの枚数が
//  対戦相手と同じになるまで、自分自身のオモテ向きのパワーを可能な限り選び捨札にする。」（atwiki/page-1981）
// 選ぶのは枚数が多いパワーゾーンの持ち主。オモテ向きが足りなければオモテ向きをすべて捨札にして終わる（ダメージは捨てない）。
// ※「手札からしかラッシュできない」はモーフの置き換え先から外す（keywords/morph.ts listMorphReplacementCandidates）。

const WORLD_DESTROYER = "xp017_world_destroyer";

function discardPower(state: GameState, ownerId: PlayerId, ids: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    power: p.power.filter((c) => !ids.includes(c.instanceId)),
    discard: [...p.discard, ...p.power.filter((c) => ids.includes(c.instanceId)).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
}

function applyWorldDestroyer(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const own = state.players[ctx.playerId].power.length;
  const enemyId = opponent(ctx.playerId);
  const other = state.players[enemyId].power.length;
  if (own === other) return { state, detail: `${WORLD_DESTROYER}:equal` };
  const ownerId = own > other ? ctx.playerId : enemyId;
  const need = Math.abs(own - other);
  const faceUp = state.players[ownerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (faceUp.length <= need) return { state: discardPower(state, ownerId, faceUp), detail: `${WORLD_DESTROYER}:${ownerId}:${faceUp.length}` };
  return {
    state: openAfter(state, {
      ...base({ playerId: ownerId, phasePlayerId: ctx.phasePlayerId, sourceInstanceId: ctxBase(ctx).sourceInstanceId }, ctx.sourceCardId),
      effectId: WORLD_DESTROYER,
      kind: "select_power",
      validInstanceIds: faceUp,
      selectCount: need,
      optional: false,
    }),
    detail: WORLD_DESTROYER,
  };
}

registerPromoChoice(WORLD_DESTROYER, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < (pending.selectCount ?? 1)) {
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) } } };
  }
  const next = discardPower(close(state, pending), playerId, selected);
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${WORLD_DESTROYER}:${selected.length}`) };
});
registerPromoKeyword("XP-017::world_destroyer", applyWorldDestroyer);

// ---------------------------------------------------------------------------
// XP-018 ゴールド寿司（※常駐）
// 「特徴に「シルバー」または「ゴールド」または「侍」を持つ自軍Sユニットは、自軍コマンドゾーンにあるカードのカテゴリごとに次の能力を得る⇒
//  WBがあればレジストを得る。MAがあればタクスMAを得る。OTがあればチェイスを得る。ETがあればコールETを得る。」（atwiki/page-2130）
// コマンドゾーンのカードはリリース・ホールドを問わない。特徴・サイズは今のもので見る。いまはレジストだけ（rules/resist.ts canOfferRegister）。
// タクスMA・チェイス・コールET の付与は未実装（XP-gaps.md の it.todo）。

const GOLD_SUSHI_ID = "XP-018";
const SUSHI_FEATURES = ["シルバー", "ゴールド", "侍"];
const SUSHI_GRANTS: Record<string, string> = { register: "WB" };

registerPromoKeywordGrant((state, ownerId, unit, keyword) => {
  const category = SUSHI_GRANTS[keyword];
  if (!category) return false;
  const owner = state.players[ownerId];
  if (!owner.operation.some((c) => isSameCardIdentity(c.cardId, GOLD_SUSHI_ID))) return false;
  if (getDefinition(state.definitions, unit.cardId)?.type !== "unit" || !isSmallUnitNow(state, ownerId, unit)) return false;
  if (!unitFeatures(state, ownerId, unit).some((f) => SUSHI_FEATURES.includes(f))) return false;
  return owner.command.some((c) => commandCategoriesOf(state, ownerId, c.cardId).includes(category as never));
});

// ---------------------------------------------------------------------------
// XP-020 護星天使（※常駐）
// 「カテゴリを2つ以上持つSユニットのうち、MAを持つSユニットは次の能力を得る⇒このユニットは敵軍ターン中BP+1000され、MAのオペレーション
//  カードを使用するためのコマンドとしてホールドできる。」（atwiki/page-2127）
// どちらの常駐置き場にあっても、お互いのユニットが得る（カード評価「自分だけでなく相手も効果の対象」）。2つの能力は独立（公式コラム）。
// 同じ能力を2枚の護星天使から得ても1回分（BP+1000）。カテゴリ・サイズは今のもので見る。コマンド扱いは「リードMA」と同じ処理（rules/callLead.ts）。

const GOSEI_ANGEL_ID = "XP-020";

function goseiAngelActive(state: GameState): boolean {
  return (["player1", "player2"] as const).some((pid) => state.players[pid].operation.some((c) => isSameCardIdentity(c.cardId, GOSEI_ANGEL_ID)));
}

function goseiAngelTarget(state: GameState, ownerId: PlayerId, unit: CardInstance): boolean {
  const cats = cardCategories(getDefinition(state.definitions, unit.cardId));
  return getDefinition(state.definitions, unit.cardId)?.type === "unit" && cats.length >= 2 && cats.includes("MA") && isSmallUnitNow(state, ownerId, unit);
}

registerPromoBpBonus((state, playerId, unit) => {
  if (!goseiAngelActive(state) || turnPlayerOf(state) === playerId) return 0;
  const onField = state.players[playerId].battle.some((c) => c.instanceId === unit.instanceId) || state.players[playerId].rush.some((c) => c.instanceId === unit.instanceId);
  return onField && goseiAngelTarget(state, playerId, unit) ? 1000 : 0;
});

registerPromoKeywordGrant((state, ownerId, unit, keyword) => keyword === "lead_MA" && goseiAngelActive(state) && goseiAngelTarget(state, ownerId, unit));

// ---------------------------------------------------------------------------
// XP-021 ファイナルカメンアタックフォームライド（オペレーション）
// 「※これは特徴「仮面ライダー」を持つユニット1体ごとと、特徴「仮面ライダー」を持つゾーンのオモテ向きのカード1枚ごとと、特徴「仮面ライダー」を
//  持つ捨札1枚ごとにつき、必要パワーの数字が1減る。 ◎敵軍ユニットを1体選び撃破する。」（atwiki/page-2078）
// お互いのエリアのユニット（今の特徴）・コマンドゾーンとパワーゾーンのオモテ向きのカード・捨札を数える（カード評価）。◎は強制で、
// エリア・サイズを問わない（撃破は rules/pendingChoices.ts の select_unit・unitDestination "discard"）。

const FINAL_ATTACK_ID = "XP-021";
const FINAL_ATTACK = "xp021_final_attack";
const RIDER = "仮面ライダー";

function riderCount(state: GameState): number {
  let n = 0;
  const printedRider = (cardId: string) => (getDefinition(state.definitions, cardId)?.features ?? []).includes(RIDER);
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    for (const c of [...p.battle, ...p.rush]) {
      if (getDefinition(state.definitions, c.cardId)?.type === "unit" && unitFeatures(state, pid, c).includes(RIDER)) n += 1;
    }
    for (const c of [...p.command, ...p.power]) if (!c.faceDown && printedRider(c.cardId)) n += 1;
    for (const c of p.discard) if (printedRider(c.cardId)) n += 1;
  }
  return n;
}

registerPromoOperationCostReduction((state, _playerId, cardId) => (isSameCardIdentity(cardId, FINAL_ATTACK_ID) ? riderCount(state) : 0));

function applyFinalAttack(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => selectableEnemy(state, ctx.playerId, ctx.sourceCardId, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${FINAL_ATTACK}:no_targets` };
  return { state: openAfter(state, genericPick(ctxBase(ctx), ctx.sourceCardId, FINAL_ATTACK, ids, false, "discard")), detail: FINAL_ATTACK };
}
registerPromoKeyword("XP-021::final_attack", applyFinalAttack);

// ---------------------------------------------------------------------------
// XP-022 ゴセイレッド【レッドブレイク】（CN1）
// 「敵軍Sユニットを1体選び、持ち主の手札に戻してもよい。（自分の手札が1枚以下なら、手札に戻すかわりに、持ち主のパワーゾーンにダメージに
//  して置いてもよい）」（atwiki/page-2234）
// 候補はエリアを問わない今の S ユニット。選ぶことが発動。効果を処理するときの自分の手札が1枚以下なら、手札に戻すかダメージにするかを選ぶ。

const RED_BREAK = "xp022_red_break";
const RED_BREAK_MODE = "xp022_red_break_mode";

function applyRedBreak(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => isSmallUnitNow(state, enemyId, c) && selectableEnemy(state, ctx.playerId, ctx.sourceCardId, c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: `${RED_BREAK}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: RED_BREAK, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: RED_BREAK,
  };
}

registerPromoChoice(
  RED_BREAK,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const log = logFor(state, playerId, pending.sourceCardId, `${RED_BREAK}:${instanceId}`);
    if (state.players[playerId].hand.length <= 1) {
      return {
        state: openNext(close(state, pending), pending, {
          ...pending,
          effectId: RED_BREAK_MODE,
          kind: "confirm",
          validInstanceIds: ["hand", "damage"],
          selectedInstanceIds: [],
          optional: false,
          promoMeta: { target: instanceId },
        }),
        log,
      };
    }
    const next = moveFieldUnit(close(state, pending), enemyId, instanceId, pending.phasePlayerId, "hand");
    return { state: proceed(next, pending), log };
  },
  simpleSkip(),
);

registerPromoChoice(RED_BREAK_MODE, (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const target = (pending.promoMeta?.target as string | undefined) ?? "";
  const next = moveFieldUnit(close(state, pending), opponent(playerId), target, pending.phasePlayerId, mode === "damage" ? "power_damage" : "hand");
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${RED_BREAK_MODE}:${mode}`) };
});
registerPromoKeyword("XP-022::red_break", applyRedBreak);

// ---------------------------------------------------------------------------
// XP-025 ダイカイシンケンオー【二天一流乱れ斬り】
// 「自軍ターン中、これがバトルエリアに出たとき、追加条件を持たない敵軍ユニットを2体まで選び、持ち主の手札に戻してもよい。」（atwiki/page-2256）
// 候補はエリア・サイズを問わない。1体ずつ選んで戻し、2体目は見送れる。

const NITEN = "xp025_niten_ichiryu";

function nitenCandidates(state: GameState, playerId: PlayerId, exclude: string[]): string[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId)
    .filter((c) => !exclude.includes(c.instanceId) && !getDefinition(state.definitions, c.cardId)?.rushAdditionalCondition && selectableEnemy(state, playerId, "XP-025", c))
    .map((c) => c.instanceId);
}

function applyNiten(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: `${NITEN}:not_own_turn` };
  const ids = nitenCandidates(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: `${NITEN}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: NITEN, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: NITEN,
  };
}

registerPromoChoice(
  NITEN,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const count = Number(pending.promoMeta?.count ?? 0) + 1;
    const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "hand");
    const log = logFor(state, playerId, pending.sourceCardId, `${NITEN}:${instanceId}`);
    const remaining = count < 2 ? nitenCandidates(next, playerId, []) : [];
    if (remaining.length === 0) return { state: proceed(next, pending), log };
    // 2体目（任意。見送れば1体で終わる）。
    return { state: openNext(next, pending, { ...pending, validInstanceIds: remaining, selectedInstanceIds: [], selectCount: 1, mayConfirm: undefined, promoMeta: { count } }), log };
  },
  simpleSkip(),
);
registerPromoKeyword("XP-025::niten_ichiryu", applyNiten);

// ---------------------------------------------------------------------------
// 場のユニット自身の BP の※（rules/promo/promoHooks.ts → core/catalog.ts effectiveBp）。
// - XP-029 仮面ライダーW・CAX「※これはホールド状態のコマンド1つにつきBP+1000される。」— お互いのコマンドゾーンを数える（カード評価）。
// - XP-030 オーズ・サゴーゾコンボ「※これはホールド状態なら、アタックするときBP+2000される。」— このユニットがアタックしているバトルの間。
// - XP-032 ゴーカイオー「※これは、自軍パワーの数5につきBP+2000される。」— パワーの数は R-POW-01（敵軍のマルチカテゴリのコマンドを含む）。

function onOwnField(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  const p = state.players[playerId];
  return p.battle.some((c) => c.instanceId === unit.instanceId) || p.rush.some((c) => c.instanceId === unit.instanceId);
}

registerPromoBpBonus((state, playerId, unit) => {
  if (!isSameCardIdentity(unit.cardId, "XP-029") || !onOwnField(state, playerId, unit)) return 0;
  const held = (["player1", "player2"] as const).reduce((n, pid) => n + state.players[pid].command.filter((c) => c.commandHeld).length, 0);
  return held * 1000;
});

registerPromoAttackerBpBonus((state, battle) => {
  if (battle.effectBattle) return 0;
  const unit = fieldUnits(state, battle.attackerPlayerId).find((c) => c.instanceId === battle.attackerInstanceId);
  return unit && unit.commandHeld && isSameCardIdentity(unit.cardId, "XP-030") ? 2000 : 0;
});

registerPromoBpBonus((state, playerId, unit) => {
  if (!isSameCardIdentity(unit.cardId, "XP-032") || !onOwnField(state, playerId, unit)) return 0;
  return Math.floor(countAvailablePower(state, playerId) / 5) * 2000;
});

// ---------------------------------------------------------------------------
// XP-029 仮面ライダーW・CAX【まだよ・・・まだまだ憎しみが足りないわ・・・】
// 「これがバトルエリアにある間、相手がターンを終えるとき、これのBPが9000以上なら、相手に1点ダメージを与える。8500以下なら、
//  自分は1点ダメージを受けるか、自軍ユニットを1体選び撃破するかを選ぶ。」（atwiki/page-2362）
// 相手のターンの終わり（rules/turnEndingEffects.ts → promoRegistry collectPromoTurnEndQueue）。BP は※の BP+1000 を含めたその時点の値。
// 撃破する自軍ユニットはエリアを問わず、これ自身も選べる。

const MADAYO = "xp029_madayo";
const MADAYO_DESTROY = "xp029_madayo_destroy";

function withLog(state: GameState, line: string): GameState {
  return { ...state, log: [...state.log, line] };
}

registerPromoTurnEnd("xp029", {
  collect: (state, endingPlayerId) =>
    state.players[opponent(endingPlayerId)].battle.filter((c) => isSameCardIdentity(c.cardId, "XP-029")).map((c) => c.instanceId),
  open: (state, endingPlayerId, instanceId) => {
    const ownerId = opponent(endingPlayerId);
    const self = state.players[ownerId].battle.find((c) => c.instanceId === instanceId);
    if (!self) return state;
    const bp = effectiveBp(state, ownerId, self);
    if (bp >= 9000) {
      const logged = withLog(state, logFor(state, ownerId, "XP-029", `${MADAYO}:damage_opponent:${bp}`));
      return applyDamageToPlayer(logged, endingPlayerId, 1, { kind: "none", activePlayer: endingPlayerId });
    }
    if (bp > 8500) return state;
    return openAfter(state, {
      ...base({ playerId: ownerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, self.cardId),
      effectId: MADAYO,
      kind: "confirm",
      validInstanceIds: ["damage", "destroy"],
      selectedInstanceIds: [],
      optional: false,
    });
  },
});

registerPromoChoice(MADAYO, (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  const log = logFor(state, playerId, pending.sourceCardId, `${MADAYO}:${mode}`);
  if (mode === "destroy") {
    const ids = fieldUnits(state, playerId).map((c) => c.instanceId);
    if (ids.length > 0) {
      const ctx = { playerId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId };
      return { state: openNext(close(state, pending), pending, genericPick(ctx, pending.sourceCardId, MADAYO_DESTROY, ids, false, "discard")), log };
    }
  } else if (mode !== "damage") {
    return { error: "invalid_target" };
  }
  const damaged = applyDamageToPlayer(close(state, pending), playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
  return { state: proceed(damaged, pending), log };
});
registerPromoKeyword("XP-029::madayo", (state) => ({ state, detail: `${MADAYO}:turn_end_only` }));

// ---------------------------------------------------------------------------
// XP-032 ゴーカイオー【レジェンドを求めて】（自軍ターン中、バトルエリアに出たとき）
// 「次の効果を発動できる⇒自軍山札を見て、Sユニット以外のユニットカードを1枚選び、自軍パワーゾーンに置いてもよい。その後、山札をシャッフルする。」
// （atwiki/page-2444）。選べるのは印刷のサイズが S でないユニットカード。発動するかを先に聞き（rules/revealGate.ts）、発動したら
// 選ばなくても（候補が無くても）山札はシャッフルする。発動しなければ山札はそのまま。

const LEGEND = "xp032_legend";

function applyLegend(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayerOf(state) !== ctx.playerId) return { state, detail: `${LEGEND}:not_own_turn` };
  const ids = state.players[ctx.playerId].deck
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && unitSizeOf(state.definitions, c) !== "S")
    .map((c) => c.instanceId);
  return {
    state: openAfter(state, gateReveal({ ...base(ctxBase(ctx), ctx.sourceCardId), effectId: LEGEND, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }, true)),
    detail: LEGEND,
  };
}

registerPromoChoice(
  LEGEND,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
    if (!card || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    let next = patchPlayer(close(state, pending), playerId, (p) => ({
      ...p,
      deck: p.deck.filter((c) => c.instanceId !== instanceId),
      power: [...p.power, { instanceId: card.instanceId, cardId: card.cardId }],
    }));
    next = shuffleDeck(next, playerId);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${LEGEND}:${instanceId}`) };
  },
  // 確認が付いたままの見送り＝発動しない。外れていれば発動して選ばなかった（シャッフルする）。
  simpleSkip((state, pending) => (pending.revealGate ? state : shuffleDeck(state, pending.playerId))),
);
registerPromoKeyword("XP-032::legend", applyLegend);

// ---------------------------------------------------------------------------
// XP-028 ワンダーゴセイグレート【サモン・ワンダーパワー】
// 「これが自分の手札にある間、相手が常駐以外のオペレーションカードを使用して、その処理をすべて終えたとき、MAとMA以外の自軍コマンドを1つずつ
//  ホールドして、これを自軍ラッシュエリアに出してもよい。そうしたとき、敵軍捨札からオペレーションカードを1枚選び、持ち主のパワーゾーンに
//  ダメージにして置いてもよい。」（atwiki/page-2369）
// - 発生: applyAction の後処理で、相手の手札（または使用中）のオペレーションが相手の捨札に置かれたこと（常駐は常駐置き場に置かれるので外れる）。
// - ホールドする2つ: 一方が MA を持ち、もう一方が MA 以外のカテゴリを持つリリース状態の自軍コマンド（Q1: MA だけのコマンドと MA を含む
//   マルチカテゴリのコマンドでもよい）。1つ目を選ぶことが発動の宣言（見送れば何もしない）。2つ目を選んだ時点でホールドして出す。
// - 出すのは効果のラッシュ（必要パワー・追加条件は問わない）。

const SUMMON = "xp028_summon_wonder_power";
const SUMMON_SECOND = "xp028_summon_wonder_power_second";
const SUMMON_DAMAGE = "xp028_summon_wonder_power_damage";

function releasedCommandCats(state: GameState, playerId: PlayerId): Map<string, string[]> {
  const p = state.players[playerId];
  return new Map(p.command.filter((c) => !c.commandHeld).map((c) => [c.instanceId, effectiveCommandCategories(p, state.definitions, c.cardId) as string[]]));
}

function summonPairOk(a: string[], b: string[]): boolean {
  return (a.includes("MA") && b.some((x) => x !== "MA")) || (b.includes("MA") && a.some((x) => x !== "MA"));
}

function summonPartners(state: GameState, playerId: PlayerId, firstId: string): string[] {
  const cats = releasedCommandCats(state, playerId);
  const first = cats.get(firstId);
  if (!first) return [];
  return [...cats.entries()].filter(([id, c]) => id !== firstId && summonPairOk(first, c)).map(([id]) => id);
}

function summonFirsts(state: GameState, playerId: PlayerId): string[] {
  return [...releasedCommandCats(state, playerId).keys()].filter((id) => summonPartners(state, playerId, id).length > 0);
}

registerPromoAfterAction(
  SUMMON,
  (before, after) => {
    const out: ReturnType<Parameters<typeof registerPromoAfterAction>[1]> = [];
    for (const pid of ["player1", "player2"] as const) {
      const holders = after.players[pid].hand.filter((c) => isSameCardIdentity(c.cardId, "XP-028"));
      if (holders.length === 0) continue;
      const enemyId = opponent(pid);
      const wasHand = new Set(before.players[enemyId].hand.map((c) => c.instanceId));
      const resolving = new Set((before.resolvingOperations ?? []).filter((e) => e.playerId === enemyId).map((e) => e.card.instanceId));
      const beforeDiscard = new Set(before.players[enemyId].discard.map((c) => c.instanceId));
      const finished = after.players[enemyId].discard.filter(
        (c) =>
          !beforeDiscard.has(c.instanceId) &&
          (wasHand.has(c.instanceId) || resolving.has(c.instanceId)) &&
          getDefinition(after.definitions, c.cardId)?.type === "operation" &&
          !(after.resolvingOperations ?? []).some((e) => e.card.instanceId === c.instanceId),
      );
      if (finished.length === 0) continue;
      out.push({ kind: SUMMON, playerId: pid, sourceInstanceId: holders[0]!.instanceId, phasePlayerId: turnPlayerOf(after) });
    }
    return out;
  },
  (state, trigger) => {
    const self = state.players[trigger.playerId].hand.find((c) => c.instanceId === trigger.sourceInstanceId);
    if (!self) return null;
    const ids = summonFirsts(state, trigger.playerId);
    if (ids.length === 0) return null;
    return {
      ...base({ playerId: trigger.playerId, phasePlayerId: trigger.phasePlayerId, sourceInstanceId: self.instanceId }, self.cardId),
      effectId: SUMMON,
      kind: "select_command",
      validInstanceIds: ids,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: true,
    };
  },
);

registerPromoChoice(
  SUMMON,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    return {
      state: openNext(close(state, pending), pending, {
        ...pending,
        effectId: SUMMON_SECOND,
        validInstanceIds: summonPartners(state, playerId, instanceId),
        selectedInstanceIds: [],
        optional: true,
        promoMeta: { first: instanceId },
      }),
      log: logFor(state, playerId, pending.sourceCardId, `${SUMMON}:${instanceId}`),
    };
  },
  simpleSkip(),
);

registerPromoChoice(
  SUMMON_SECOND,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const first = (pending.promoMeta?.first as string | undefined) ?? "";
    const self = state.players[playerId].hand.find((c) => c.instanceId === pending.sourceInstanceId);
    if (!self || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const held = new Set([first, instanceId]);
    let next = patchPlayer(close(state, pending), playerId, (p) => ({
      ...p,
      command: p.command.map((c) => (held.has(c.instanceId) ? { ...c, commandHeld: true } : c)),
    }));
    next = startEffectRush(next, {
      playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: `${SUMMON}_rush`,
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: self.instanceId,
      fromZone: "hand",
      candidates: [self.instanceId],
      maxCount: 1,
      requireConditions: false,
      ignorePowerCost: true,
      mandatory: true,
      forced: true,
    });
    const log = logFor(state, playerId, pending.sourceCardId, `${SUMMON_SECOND}:${first}+${instanceId}`);
    const rushed = !next.players[playerId].hand.some((c) => c.instanceId === self.instanceId);
    const enemyId = opponent(playerId);
    const ops = next.players[enemyId].discard.filter((c) => getDefinition(next.definitions, c.cardId)?.type === "operation").map((c) => c.instanceId);
    if (!rushed || ops.length === 0) return { state: proceed(next, pending), log };
    return {
      state: openAfter(next, { ...pending, effectId: SUMMON_DAMAGE, kind: "select_unit", validInstanceIds: ops, selectedInstanceIds: [], selectCount: 1, optional: true, promoMeta: undefined }),
      log,
    };
  },
  simpleSkip(),
);

registerPromoChoice(
  SUMMON_DAMAGE,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
    if (!card || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = patchPlayer(close(state, pending), enemyId, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      power: [...p.power, { instanceId: card.instanceId, cardId: card.cardId, faceDown: true }],
      damage: p.damage + 1,
    }));
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${SUMMON_DAMAGE}:${instanceId}`) };
  },
  simpleSkip(),
);

// ---------------------------------------------------------------------------
// XP-031 仮面ライダーオーズ・タトバコンボ×仮面ライダー電王SF【メダルと切符と40周年】（起動）
// 「これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、「ライダー」か「イマジン」か「ショッカー」のどれかを含む特徴を持つ自軍捨札を
//  1枚選び、ゲームから除外してもよい。そうしたとき、自軍山札の上から3枚をオモテにして、その中から1枚選び手札に加え、それ以外は好きな順で
//  山札の下に戻す。」（atwiki/page-2446）
// 起動は activate_field_unit_ability（rules/fieldActivatedAbilities.ts の promo 行。1ターンに1度）。捨札を選ぶことが除外（見送れば何もしない）。
// 特徴は印刷の特徴の部分一致（「仮面ライダー」は「ライダー」を含む）。山札の下に戻す2枚は番号を付けて順を選ぶ（rules/deckOrder.ts）。

const MEDAL = "xp031_medal_ticket";
const MEDAL_PICK = "xp031_medal_ticket_pick";
const MEDAL_WORDS = ["ライダー", "イマジン", "ショッカー"];

function medalTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].discard
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).some((f) => MEDAL_WORDS.some((w) => f.includes(w))))
    .map((c) => c.instanceId);
}

registerPromoFieldAbility({
  matches: (cardId) => isSameCardIdentity(cardId, "XP-031"),
  canActivate: (state, playerId) => state.phase === "rush" && turnPlayerOf(state) === playerId && medalTargets(state, playerId).length > 0,
  resolve: (state, playerId, card) =>
    openAfter(state, {
      ...base({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, card.cardId),
      effectId: MEDAL,
      kind: "select_unit",
      validInstanceIds: medalTargets(state, playerId),
      selectCount: 1,
      optional: true,
    }),
});

registerPromoChoice(
  MEDAL,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
    if (!card || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    let next = patchPlayer(close(state, pending), playerId, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      exile: [...(p.exile ?? []), { instanceId: card.instanceId, cardId: card.cardId }],
    }));
    const top = next.players[playerId].deck.slice(0, 3);
    const log = logFor(state, playerId, pending.sourceCardId, `${MEDAL}:${instanceId}`);
    if (top.length === 0) return { state: proceed(next, pending), log };
    next = recordReveal(next, { playerId, ownerId: playerId, sourceCardId: pending.sourceCardId, effectLabel: "メダルと切符と40周年", from: "deck_top", cards: revealedCards(top, "deck_bottom") });
    return {
      state: openNext(next, pending, { ...pending, effectId: MEDAL_PICK, validInstanceIds: top.map((c) => c.instanceId), selectedInstanceIds: [], optional: false }),
      log,
    };
  },
  simpleSkip(),
);

registerPromoChoice(MEDAL_PICK, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = patchPlayer(close(state, pending), playerId, (p) => {
    const picked = p.deck.find((c) => c.instanceId === instanceId);
    return { ...p, hand: picked ? [...p.hand, picked] : p.hand, deck: p.deck.filter((c) => c.instanceId !== instanceId) };
  });
  const rest = pending.validInstanceIds.filter((id) => id !== instanceId);
  return { state: returnToDeckInOrder(next, pending, rest), log: logFor(state, playerId, pending.sourceCardId, `${MEDAL_PICK}:${instanceId}`) };
});
registerPromoKeyword("XP-031::medal_ticket", (state) => ({ state, detail: `${MEDAL}:activated_ability` }));

// ---------------------------------------------------------------------------
// XP-027 ダイノミッション（オペレーション）
// 「合体が必要な自軍ユニットが１体もなければ、特徴「メカ」を持たない、５体以上の合体が必要な自分の手札を１枚選び相手に見せる。そうしたとき、
//  自軍ユニットまたは自軍ビークルを好きな数選び捨札にしてもよい。その後、見せたカードの５体以上の合体に必要な、ユニットまたはビークルのカードが
//  自軍捨札にすべてあれば、見せたカードをこのカードに重ねて自軍ラッシュエリアに出す。重ねたユニットがユニットでなくなるとき、このカードを
//  捨札にしてその場に留める。」（atwiki/page-2370）
// - 「合体が必要な」は合体―行の枠（resolveZordFusionPartnerSlots）を持つカード。「5体以上」は枠が5つ以上。
// - 捨札にするのは1体ずつ選ぶ（見送れば次へ。選べるものがなくなれば次へ）。捨札は「撃破」ではない。
// - 出すのは効果のラッシュ（必要パワー・追加条件は問わない。page-2370 カード評価）。このカードは出したユニットの下に重ねる
//   （rules/resolvingOperations.ts は重ねたカードを置き場所ありとして捨札にしない）。
// - その場に留める置き換えは rules/operationCounters.ts tryLeaveField → promoStayOnLeave（RK-250 サバイブと同じ扱い）。

const DINO = "xp027_dino_mission";
const DINO_DISCARD = "xp027_dino_mission_discard";

function needsFusion(cardId: string): boolean {
  return resolveZordFusionPartnerSlots(cardId).length > 0;
}

function dinoCandidates(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && !(d.features ?? []).includes("メカ") && resolveZordFusionPartnerSlots(c.cardId).length >= 5;
    })
    .map((c) => c.instanceId);
}

function applyDinoMission(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (fieldUnits(state, ctx.playerId).some((u) => needsFusion(u.cardId))) return { state, detail: `${DINO}:fusion_on_field` };
  const ids = dinoCandidates(state, ctx.playerId);
  if (ids.length === 0) return { state, detail: `${DINO}:no_targets` };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), ctx.sourceCardId), effectId: DINO, kind: "select_hand", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: DINO,
  };
}

function dinoDiscardIds(state: GameState, playerId: PlayerId): string[] {
  return [...state.players[playerId].battle, ...state.players[playerId].rush].map((c) => c.instanceId);
}

function dinoAllInDiscard(state: GameState, playerId: PlayerId, shownCardId: string): boolean {
  const used = new Set<string>();
  for (const slot of resolveZordFusionPartnerSlots(shownCardId)) {
    const hit = state.players[playerId].discard.find((c) => {
      if (used.has(c.instanceId)) return false;
      const t = getDefinition(state.definitions, c.cardId)?.type;
      return (t === "unit" || t === "vehicle") && fillsSlot(state, playerId, c, slot);
    });
    if (!hit) return false;
    used.add(hit.instanceId);
  }
  return true;
}

function dinoFinish(state: GameState, pending: PendingEffectChoice, playerId: PlayerId): GameState {
  const shownId = (pending.promoMeta?.shown as string | undefined) ?? "";
  const shown = state.players[playerId].hand.find((c) => c.instanceId === shownId);
  if (!shown || !dinoAllInDiscard(state, playerId, shown.cardId)) return proceed(state, pending);
  let next = startEffectRush(state, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: `${DINO}_rush`,
    sourceCardId: pending.sourceCardId,
    sourceInstanceId: pending.sourceInstanceId,
    fromZone: "hand",
    candidates: [shownId],
    maxCount: 1,
    requireConditions: false,
    ignorePowerCost: true,
    mandatory: true,
    forced: true,
  });
  const opId = pending.sourceInstanceId;
  const op = (next.resolvingOperations ?? []).find((e) => e.card.instanceId === opId)?.card ?? next.players[playerId].discard.find((c) => c.instanceId === opId);
  if (op) {
    const stackOn = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === shownId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { instanceId: op.instanceId, cardId: op.cardId }] } : c));
    next = patchPlayer(next, playerId, (p) =>
      [...p.rush, ...p.battle].some((c) => c.instanceId === shownId)
        ? { ...p, discard: p.discard.filter((c) => c.instanceId !== opId), rush: stackOn(p.rush), battle: stackOn(p.battle) }
        : p,
    );
  }
  return proceed(next, pending);
}

registerPromoChoice(DINO, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const shown = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!shown || !pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = recordReveal(close(state, pending), { playerId, ownerId: playerId, sourceCardId: pending.sourceCardId, effectLabel: "ダイノミッション", from: "hand", cards: revealedCards([shown], "hand") });
  const log = logFor(state, playerId, pending.sourceCardId, `${DINO}:${shown.cardId}`);
  const meta = { ...pending, promoMeta: { shown: instanceId } };
  const ids = dinoDiscardIds(next, playerId);
  if (ids.length === 0) return { state: dinoFinish(next, meta, playerId), log };
  return {
    state: openNext(next, pending, { ...meta, effectId: DINO_DISCARD, kind: "select_unit", validInstanceIds: ids, selectedInstanceIds: [], selectCount: 1, optional: true }),
    log,
  };
});

registerPromoChoice(
  DINO_DISCARD,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const next = moveFieldUnit(close(state, pending), playerId, instanceId, pending.phasePlayerId, "discard");
    const log = logFor(state, playerId, pending.sourceCardId, `${DINO_DISCARD}:${instanceId}`);
    const ids = dinoDiscardIds(next, playerId);
    if (ids.length === 0 || next.pendingEffectChoice || next.pendingLeave) {
      return { state: next.pendingEffectChoice || next.pendingLeave ? next : dinoFinish(next, pending, playerId), log };
    }
    return { state: openNext(next, pending, { ...pending, validInstanceIds: ids, selectedInstanceIds: [] }), log };
  },
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: dinoFinish(close(state, pending), pending, playerId), log: logFor(state, playerId, pending.sourceCardId, `${DINO_DISCARD}:done`) };
  },
);
registerPromoKeyword("XP-027::dino_mission", applyDinoMission);

registerPromoStayOnLeave((state, intent) => {
  if (intent.toZone === "battle") return null;
  const unit = state.players[intent.ownerPlayerId][intent.fromZone].find((c) => c.instanceId === intent.instanceId);
  const dino = (unit?.stackedCards ?? []).find((c) => isSameCardIdentity(c.cardId, "XP-027"));
  if (!unit || !dino) return null;
  let next = patchPlayer(state, intent.ownerPlayerId, (p) => {
    const drop = (cards: CardInstance[]) =>
      cards.map((c) => (c.instanceId === unit.instanceId ? { ...c, stackedCards: (c.stackedCards ?? []).filter((s) => s.instanceId !== dino.instanceId) } : c));
    return { ...p, rush: drop(p.rush), battle: drop(p.battle), discard: [...p.discard, { instanceId: dino.instanceId, cardId: dino.cardId }] };
  });
  next = withLog(next, logFor(state, intent.ownerPlayerId, "XP-027", `${DINO}:stay`));
  next = finalizeLeaveReaction({ ...next, pendingLeave: intent }, intent, true);
  return next.pendingEffectChoice || next.pendingLeave ? next : promoteDeferredBattleEntry(next);
});
