/**
 * 第6弾「紅き六戦士の帰還」監査で見つかったカード固有の効果の修正（set-6 audit）。
 *
 * - `trySet6AuditCardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet6AuditChoice` / `trySkipSet6AuditChoice` / `tryConfirmSet6AuditChoice`:
 *   このモジュールが開いた選択の解決。
 * - `applySet6TurnEnd`: 「自分がターンを終えるとき」の処理（RS-371【マスキーリボン】の後半）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardCategories, cardName, effectiveBp, getDefinition, isMediumUnit, parsePowerCost, rushPowerCost } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { redRacerPowerCostBonus } from "../../core/power";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { bounceToHand } from "../bounce";
import { hasAdditionalCondition } from "../dispatchOrder";
import { shuffleCards } from "../errataCardEffects";
import { applyReanimate } from "../reanimate";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { startGenericEnemyUnitChoice } from "../rs/rsCatchallChoices";
import { applyConfirmEffectChoice, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";
import { registerChoiceRefresher } from "../choiceRefreshers";
import { applyNumberComboEffect } from "../numberComboEffects";
import { getNumberComboEffect } from "@rangers-strike/cards";

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
type ChoiceConfirmer = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

/** 選択を閉じる（割り込み前の選択 resumeChoice があれば再開する）。 */
function finish(state: GameState, pending: PendingEffectChoice): GameState {
  const cleared = clearPending(state, pending.phasePlayerId);
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

/** 次の選択を開く（元の選択の resumeChoice を引き継ぐ）。 */
function reopen(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return openEffectChoice(clearPending(state, pending.phasePlayerId), {
    ...next,
    resumeChoice: pending.resumeChoice,
  });
}

function log(playerId: PlayerId, cardId: string, state: GameState, detail: string): string {
  return buildLogEntry(playerId, "named_effect", cardId, state.definitions, detail);
}

function damageCount(player: PlayerState): number {
  return Math.max(player.damage, player.power.filter((c) => c.faceDown).length);
}

// ---------------------------------------------------------------------------
// RS-353 デンジファイター【ファイターチェンジ】
// 「これをラッシュしたとき、自軍山札の上から、自軍パワーゾーンのカードの枚数までオモテにしてもよい。そうしたとき、
//  その中から特徴「メカ」を持つLユニットのカードをすべて手札に加え、それ以外は好きな順で山札の下に戻す。」（atwiki/page-551）
// - 1枚ずつオモテにし、好きな枚数で止められる（宣言不要。grnrngr/faq-card-6 RS-353 Q1）。
// - 選択肢は「次の1枚をオモテにする」（山札の次のカード）。見送り＝そこで止める。

export const FIGHTER_CHANGE_EFFECT_ID = "rs353_fighter_change_reveal";
export const FIGHTER_CHANGE_ORDER_EFFECT_ID = "rs353_fighter_change_order";

function beginFighterChange(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const player = state.players[ctx.playerId];
  const limit = player.power.length;
  const top = player.deck[0];
  if (limit <= 0 || !top) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: FIGHTER_CHANGE_EFFECT_ID,
    sourceCardId: "RS-353",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "scry_keep_one",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [top.instanceId],
    viewedInstanceIds: [],
    processedInstanceIds: [],
    selectCount: limit,
    optional: true,
  });
}

function isMechaL(state: GameState, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  return def?.type === "unit" && def.size === "L" && (def.features ?? []).includes("メカ");
}

function moveDeckCardToBottom(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const player = state.players[playerId];
  const idx = player.deck.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return state;
  const [card, rest] = removeAt(player.deck, idx);
  return { ...state, ...updatePlayer(state, playerId, { ...player, deck: [...rest, card] }) };
}

function finishFighterChange(state: GameState, pending: PendingEffectChoice, revealed: string[]): ChoiceOutcome {
  const playerId = pending.playerId;
  const player = state.players[playerId];
  const ids = new Set(revealed);
  const toHand = player.deck.filter((c) => ids.has(c.instanceId) && isMechaL(state, c));
  const handIds = new Set(toHand.map((c) => c.instanceId));
  let next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck: player.deck.filter((c) => !handIds.has(c.instanceId)),
      hand: [...player.hand, ...toHand],
    }),
  };
  const logs = [
    log(playerId, "RS-353", state, `fighter_change:${toHand.map((c) => cardName(state.definitions, c.cardId)).join(",") || "none"}`),
  ];
  const others = revealed.filter((id) => !handIds.has(id));
  if (others.length <= 1) {
    for (const id of others) next = moveDeckCardToBottom(next, playerId, id);
    return { state: finish(next, pending), logs };
  }
  // 「それ以外は好きな順で山札の下に戻す」— 先に選んだカードから順に山札の下へ。
  return {
    state: reopen(next, pending, {
      playerId,
      effectId: FIGHTER_CHANGE_ORDER_EFFECT_ID,
      sourceCardId: "RS-353",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: others,
      optional: false,
    }),
    logs,
  };
}

function resolveFighterChange(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const revealed = [...(pending.processedInstanceIds ?? []), instanceId];
  const deck = state.players[playerId].deck;
  const nextCard = deck[revealed.length];
  const limit = pending.selectCount ?? 0;
  const entry = buildLogEntry(playerId, "resolve_effect_choice", "RS-353", state.definitions, `fighter_change_reveal:${cardName(state.definitions, deck.find((c) => c.instanceId === instanceId)?.cardId ?? "")}`);
  if (revealed.length < limit && nextCard) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          validInstanceIds: [nextCard.instanceId],
          viewedInstanceIds: revealed,
          processedInstanceIds: revealed,
        },
      },
      log: entry,
    };
  }
  const done = finishFighterChange(state, pending, revealed);
  if ("error" in done) return done;
  return { state: done.state, logs: [entry, ...(done.logs ?? [])] };
}

function skipFighterChange(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const revealed = pending.processedInstanceIds ?? [];
  if (revealed.length === 0) {
    return { state: finish(state, pending), log: log(pending.playerId, "RS-353", state, "fighter_change:skipped") };
  }
  return finishFighterChange(state, pending, revealed);
}

function resolveFighterChangeOrder(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  let next = moveDeckCardToBottom(state, playerId, instanceId);
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (remaining.length > 1) {
    return { state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: remaining } } };
  }
  for (const id of remaining) next = moveDeckCardToBottom(next, playerId, id);
  return { state: finish(next, pending) };
}

// ---------------------------------------------------------------------------
// RS-371 ピンクマスク【マスキーリボン】（NC）
// 「追加条件を持たない敵軍ユニットを、自軍ダメージの数まで選び持ち主の手札に戻す。その後、自分がターンを終えるとき、
//  相手は自分自身の手札からユニットカードを好きな枚数選び、自分自身のラッシュエリアに出してもよい
//  （ただし、必要パワーと追加条件は満たすこと）。このとき、出したユニットの効果は発動しない。」（atwiki/page-567）
// - エリア・サイズを問わない。任意の数を選べる（grnrngr/faq-card-6 RS-371 Q）。
// - ターン終了時に出せるのは、必要パワーを満たし追加条件を持たないユニットカード（追加条件の実行はこの処理では扱わない）。
//   出したユニットはラッシュではないので「ラッシュしたとき」の効果は発動しない。

export const MASKY_RIBBON_EFFECT_ID = "rs371_masky_ribbon_return";
export const MASKY_RIBBON_DEPLOY_EFFECT_ID = "rs371_masky_ribbon_deploy";
const MASKY_RIBBON_TURN_END_RULE = "rs371_masky_ribbon_turn_end";

function maskyRibbonCandidates(state: GameState, playerId: PlayerId): string[] {
  const enemy = state.players[opponent(playerId)];
  return [...enemy.battle, ...enemy.rush]
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || hasAdditionalCondition(def)) return false;
      return isSelectableByOpponentEffect(state, playerId, c.instanceId, "RS-371");
    })
    .map((c) => c.instanceId);
}

function beginMaskyRibbon(state: GameState, ctx: GrantKeywordContext): GameState {
  // 「その後、自分がターンを終えるとき…」を登録する。
  const actor = state.players[ctx.playerId];
  let next: GameState = {
    ...state,
    ...updatePlayer(state, ctx.playerId, {
      ...actor,
      modifiers: [
        ...(actor.modifiers ?? []),
        { kind: "rule", ruleId: MASKY_RIBBON_TURN_END_RULE, scope: "turn", sourceCardId: "RS-371" },
      ],
    }),
  };
  const limit = damageCount(next.players[ctx.playerId]);
  const valid = maskyRibbonCandidates(next, ctx.playerId);
  if (limit <= 0 || valid.length === 0) return next;
  next = openEffectChoice(next, {
    playerId: ctx.playerId,
    effectId: MASKY_RIBBON_EFFECT_ID,
    sourceCardId: "RS-371",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: valid,
    selectCount: limit,
    selectedInstanceIds: [],
    optional: true,
  });
  return next;
}

function locateField(state: GameState, instanceId: string): { playerId: PlayerId; zone: "battle" | "rush" } | null {
  for (const pid of ["player1", "player2"] as const) {
    for (const zone of ["battle", "rush"] as const) {
      if (state.players[pid][zone].some((c) => c.instanceId === instanceId)) return { playerId: pid, zone };
    }
  }
  return null;
}

function finishMaskyRibbon(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  let next = state;
  const names: string[] = [];
  for (const id of selected) {
    const at = locateField(next, id);
    if (!at) continue;
    const bounced = bounceToHand(next, { playerId: at.playerId, instanceId: id, fromZone: at.zone });
    if (!bounced.bounced) continue;
    next = bounced.state;
    names.push(cardName(state.definitions, bounced.bounced.cardId));
  }
  return {
    state: finish(next, pending),
    log: log(pending.playerId, "RS-371", state, `masky_ribbon:${names.join(",") || "none"}`),
  };
}

function resolveMaskyRibbon(state: GameState, _playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
    return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: remaining, selectedInstanceIds: selected } } };
  }
  return finishMaskyRibbon(state, pending, selected);
}

function confirmMaskyRibbon(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  return finishMaskyRibbon(state, pending, pending.selectedInstanceIds ?? []);
}

function maskyRibbonDeployCandidates(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || hasAdditionalCondition(def)) return false;
      return rushPowerCost({ ...state, activePlayer: playerId }, playerId, def) <= player.power.length;
    })
    .map((c) => c.instanceId);
}

/** 「自分がターンを終えるとき」— RS-371【マスキーリボン】の後半を開く（相手が選ぶ）。 */
export function applySet6TurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  if (state.pendingEffectChoice || state.winner) return state;
  const ending = state.players[endingPlayerId];
  const mods = ending.modifiers ?? [];
  const count = mods.filter((m) => m.kind === "rule" && m.ruleId === MASKY_RIBBON_TURN_END_RULE).length;
  if (count === 0) return state;
  const kept = mods.filter((m) => !(m.kind === "rule" && m.ruleId === MASKY_RIBBON_TURN_END_RULE));
  const next: GameState = {
    ...state,
    ...updatePlayer(state, endingPlayerId, { ...ending, modifiers: kept.length > 0 ? kept : undefined }),
  };
  const enemyId = opponent(endingPlayerId);
  const valid = maskyRibbonDeployCandidates(next, enemyId);
  if (valid.length === 0) return next;
  return openEffectChoice(next, {
    playerId: enemyId,
    effectId: MASKY_RIBBON_DEPLOY_EFFECT_ID,
    sourceCardId: "RS-371",
    kind: "select_hand",
    phasePlayerId: endingPlayerId,
    validInstanceIds: valid,
    selectedInstanceIds: [],
    optional: true,
  });
}

function resolveMaskyRibbonDeploy(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found) return { error: "invalid_target" };
  const [, hand] = removeAt(player.hand, found.index);
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, { ...player, hand, rush: [...player.rush, found.card] }),
  };
  const entry = buildLogEntry(playerId, "resolve_effect_choice", "RS-371", state.definitions, `masky_ribbon_deploy:${cardName(state.definitions, found.card.cardId)}`);
  const valid = maskyRibbonDeployCandidates(next, playerId);
  if (valid.length > 0) {
    return {
      state: {
        ...next,
        pendingEffectChoice: {
          ...pending,
          validInstanceIds: valid,
          selectedInstanceIds: [...(pending.selectedInstanceIds ?? []), instanceId],
        },
      },
      log: entry,
    };
  }
  return { state: finish(next, pending), log: entry };
}

// ---------------------------------------------------------------------------
// RS-384 ブルースローワー【放水作業】
// 「これをラッシュしたとき、敵軍コマンドの数が自軍コマンドの数より多ければ、同じ数になるまで、以下の手順を行ってもよい
//  ⇒自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置く。」（atwiki/page-529）

export const WATER_DISCHARGE_EFFECT_ID = "rs384_water_discharge";

function beginWaterDischarge(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const own = state.players[ctx.playerId];
  const enemy = state.players[opponent(ctx.playerId)];
  if (enemy.command.length <= own.command.length || own.deck.length === 0) return null;
  if (own.command.length >= COMMAND_ZONE_MAX) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: WATER_DISCHARGE_EFFECT_ID,
    sourceCardId: "RS-384",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "confirm",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [WATER_DISCHARGE_EFFECT_ID],
    optional: true,
  });
}

function applyWaterDischarge(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const playerId = pending.playerId;
  const enemyCount = state.players[opponent(playerId)].command.length;
  let player = state.players[playerId];
  let placed = 0;
  while (player.command.length < enemyCount && player.command.length < COMMAND_ZONE_MAX && player.deck.length > 0) {
    const [top, deck] = removeAt(player.deck, 0);
    player = { ...player, deck, command: [...player.command, { ...top, faceDown: false, commandHeld: true }] };
    placed += 1;
  }
  const next: GameState = { ...state, ...updatePlayer(state, playerId, player) };
  return { state: finish(next, pending), log: log(playerId, "RS-384", state, `water_discharge:${placed}`) };
}

// ---------------------------------------------------------------------------
// RS-387 ピンクエイダー【緊急車両誘導】
// 「これをラッシュしたとき、ライドされていないSビークルがあれば、すべて持ち主の山札の下に好きな順で戻してもよい。」（atwiki/page-532）
// - 行うかを確認（confirm）→ 持ち主ごとに、2枚以上なら戻す順を選ぶ（先に選んだものから山札の下へ）。

export const EMERGENCY_GUIDE_EFFECT_ID = "rs387_emergency_guide";
export const EMERGENCY_GUIDE_ORDER_EFFECT_ID = "rs387_emergency_guide_order";

function unriddenSVehicles(state: GameState, ownerId: PlayerId): string[] {
  const player = state.players[ownerId];
  return player.rush
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "vehicle" || def.size !== "S") return false;
      return !player.rush.some((r) => r.mountedOnInstanceId === c.instanceId && r.instanceId !== c.instanceId);
    })
    .map((c) => c.instanceId);
}

function beginEmergencyGuide(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (unriddenSVehicles(state, "player1").length + unriddenSVehicles(state, "player2").length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: EMERGENCY_GUIDE_EFFECT_ID,
    sourceCardId: "RS-387",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "confirm",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [EMERGENCY_GUIDE_EFFECT_ID],
    optional: true,
  });
}

function moveRushToDeckBottom(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const player = state.players[ownerId];
  const found = findInZone(player, "rush", instanceId);
  if (!found) return state;
  const [, rush] = removeAt(player.rush, found.index);
  const { mountedOnInstanceId: _m, commandHeld: _h, ...card } = found.card;
  return { ...state, ...updatePlayer(state, ownerId, { ...player, rush, deck: [...player.deck, card] }) };
}

/** ownerIndex の持ち主から順に戻す。2枚以上なら順番の選択を開く。 */
function continueEmergencyGuide(state: GameState, pending: PendingEffectChoice, ownerIndex: number): GameState {
  const owners: PlayerId[] = ["player1", "player2"];
  let next = state;
  for (let i = ownerIndex; i < owners.length; i++) {
    const ownerId = owners[i]!;
    const ids = unriddenSVehicles(next, ownerId);
    if (ids.length >= 2) {
      return reopen(next, pending, {
        playerId: pending.playerId,
        effectId: EMERGENCY_GUIDE_ORDER_EFFECT_ID,
        sourceCardId: "RS-387",
        sourceInstanceId: pending.sourceInstanceId,
        kind: "select_unit",
        phasePlayerId: pending.phasePlayerId,
        validInstanceIds: ids,
        // 処理中の持ち主（own: 自分 / enemy: 相手）。
        step: ownerId === pending.playerId ? "own" : "enemy",
        optional: false,
      });
    }
    for (const id of ids) next = moveRushToDeckBottom(next, ownerId, id);
  }
  return finish(next, pending);
}

function applyEmergencyGuide(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  return {
    state: continueEmergencyGuide(state, pending, 0),
    log: log(pending.playerId, "RS-387", state, "emergency_guide"),
  };
}

function resolveEmergencyGuideOrder(state: GameState, _playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const ownerId: PlayerId = pending.step === "enemy" ? opponent(pending.playerId) : pending.playerId;
  const ownerIndex = ownerId === "player1" ? 0 : 1;
  let next = moveRushToDeckBottom(state, ownerId, instanceId);
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  if (remaining.length > 1) {
    return { state: { ...next, pendingEffectChoice: { ...pending, validInstanceIds: remaining } } };
  }
  for (const id of remaining) next = moveRushToDeckBottom(next, ownerId, id);
  return { state: continueEmergencyGuide(next, pending, ownerIndex + 1) };
}

// ---------------------------------------------------------------------------
// RS-389 ゴーブルー【人命検索】（NC）
// 「自軍捨札をすべてウラ向きにしてシャッフルしてもよい。そうしたとき、その中から相手にウラ向きのまま1枚選ばせてから、
//  すべてオモテにする。相手の選んだカードがSユニットのカードだったなら、そのユニットカードを自分の手札に加える。」（atwiki/page-533）
// - 捨札が1枚以下ならシャッフルできないので発動できない（atwiki/page-533 Q1）。

export const LIFE_SEARCH_EFFECT_ID = "rs389_life_search";
export const LIFE_SEARCH_PICK_EFFECT_ID = "rs389_life_search_pick";

function beginLifeSearch(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (state.players[ctx.playerId].discard.length < 2) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: LIFE_SEARCH_EFFECT_ID,
    sourceCardId: "RS-389",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "confirm",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [LIFE_SEARCH_EFFECT_ID],
    optional: true,
  });
}

function applyLifeSearch(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const ownerId = pending.playerId;
  const owner = state.players[ownerId];
  const shuffled = shuffleCards(owner.discard);
  const next: GameState = { ...state, ...updatePlayer(state, ownerId, { ...owner, discard: shuffled }) };
  return {
    state: reopen(next, pending, {
      playerId: opponent(ownerId),
      effectId: LIFE_SEARCH_PICK_EFFECT_ID,
      sourceCardId: "RS-389",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: shuffled.map((c) => c.instanceId),
      optional: false,
    }),
    log: log(ownerId, "RS-389", state, "life_search:shuffle"),
  };
}

function resolveLifeSearchPick(state: GameState, _playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const ownerId = opponent(pending.playerId);
  const owner = state.players[ownerId];
  const found = findInZone(owner, "discard", instanceId);
  if (!found) return { error: "invalid_target" };
  const def = getDefinition(state.definitions, found.card.cardId);
  let next = state;
  if (def?.type === "unit" && def.size === "S") {
    next = applyReanimate(state, { playerId: ownerId, instanceId, from: "discard", to: "hand" });
  }
  return {
    state: finish(next, pending),
    log: log(ownerId, "RS-389", state, `life_search:${cardName(state.definitions, found.card.cardId)}`),
  };
}

// ---------------------------------------------------------------------------
// RS-416 冥府神トード【魂のコレクション】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍パワーゾーンにダメージになっているカードがあれば1枚選び捨札にしてもよい。
//  そうしたとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-610）
// - 敵軍 S ユニットはエリアを問わない。パワーゾーンに置くのは撃破ではない（grnrngr/faq-card-6 RS-416 Q）。

export const SOUL_COLLECTION_EFFECT_ID = "rs416_soul_collection_discard_damage";

function beginSoulCollection(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (ctx.phasePlayerId !== ctx.playerId) return null;
  const enemy = state.players[opponent(ctx.playerId)];
  const damage = enemy.power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (damage.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: SOUL_COLLECTION_EFFECT_ID,
    sourceCardId: "RS-416",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_power",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: damage,
    optional: true,
  });
}

function resolveSoulCollection(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "power", instanceId);
  if (!found || !found.card.faceDown) return { error: "invalid_target" };
  const [, power] = removeAt(enemy.power, found.index);
  let next: GameState = {
    ...state,
    ...updatePlayer(state, enemyId, {
      ...enemy,
      power,
      discard: [...enemy.discard, { ...found.card, faceDown: false }],
      damage: Math.max(0, enemy.damage - 1),
    }),
  };
  const entry = buildLogEntry(playerId, "resolve_effect_choice", "RS-416", state.definitions, `soul_collection_discard:${cardName(state.definitions, found.card.cardId)}`);
  next = clearPending(next, pending.phasePlayerId);
  const withChoice = startGenericEnemyUnitChoice(next, {
    playerId,
    effectId: "nokorekushon",
    sourceCardId: "RS-416",
    sourceInstanceId: pending.sourceInstanceId,
    phasePlayerId: pending.phasePlayerId,
    filter: { zone: "both", size: "S" },
    destination: "power",
    optional: false,
    placeAsDamage: true,
  });
  if (withChoice) {
    const opened = withChoice.pendingEffectChoice!;
    return { state: { ...withChoice, pendingEffectChoice: { ...opened, resumeChoice: pending.resumeChoice } }, log: entry };
  }
  return { state: finish(next, pending), log: entry };
}

// ---------------------------------------------------------------------------
// RS-426 スーパーゲキレッド
// 「※これが撃破されて捨札になったとき、自分の手札の｢スーパーゲキレッド｣か、自軍捨札の｢ゲキレッド｣か、どちらか1枚を選び、
//  自軍ラッシュエリアに出す。」（atwiki/page-509）— 両方の候補があればプレイヤーが選ぶ（見送れない）。

export const SUPER_GEKI_RED_EFFECT_ID = "rs426_super_geki_red_reanimate";

export function startSuperGekiRedChoice(
  state: GameState,
  ownerId: PlayerId,
  phasePlayerId: PlayerId,
  handIds: string[],
  discardIds: string[],
): GameState {
  return openEffectChoice(state, {
    playerId: ownerId,
    effectId: SUPER_GEKI_RED_EFFECT_ID,
    sourceCardId: "RS-426",
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: [...discardIds, ...handIds],
    optional: false,
  });
}

function resolveSuperGekiRed(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  let next = state;
  const inHand = findInZone(player, "hand", instanceId);
  if (inHand) {
    const [, hand] = removeAt(player.hand, inHand.index);
    next = { ...state, ...updatePlayer(state, playerId, { ...player, hand, rush: [...player.rush, inHand.card] }) };
  } else if (findInZone(player, "discard", instanceId)) {
    next = applyReanimate(state, { playerId, instanceId, from: "discard", to: "rush" });
  } else {
    return { error: "invalid_target" };
  }
  return {
    state: finish(next, pending),
    log: buildLogEntry(playerId, "destroy_effect", "RS-426", state.definitions, "super_geki_red_reanimate"),
  };
}

// ---------------------------------------------------------------------------
// RS-421 アカレッド【ソウル降臨】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンから、特徴「レッド」とＮＣの効果を持つユニットカードを
//  1枚選びホールドしてもよい。そうしたとき、ホールドしたユニットカードのNCの効果を、このユニットの効果として発動する。
//  ただしストライクはできない。」（atwiki/page-574）
// - ホールドしたカードの CN を満たしていなくても発動でき、NC の効果として扱われる（grnrngr/faq-card-6 RS-421 Q1/Q2/Q6）。

/** ホールドしたコマンドのカードの NC の効果を、アカレッド（akaRedInstanceId）の効果として発動する。 */
export function fireAkaRedSoulNc(
  state: GameState,
  playerId: PlayerId,
  akaRedInstanceId: string,
  heldCardId: string,
): GameState {
  const akaRed = state.players[playerId].battle.find((c) => c.instanceId === akaRedInstanceId);
  if (!akaRed) return state;
  const borrowed: CardInstance = { ...akaRed, cardId: heldCardId };
  const outcome = applyNumberComboEffect(state, playerId, borrowed, getNumberComboEffect(heldCardId));
  return {
    ...outcome.state,
    log: [...outcome.state.log, log(playerId, "RS-421", state, `soul_descent:${cardName(state.definitions, heldCardId)}`), ...outcome.logs],
  };
}

// ---------------------------------------------------------------------------
// RK-062 仮面ライダー電王AF【ダイナミックチョップ】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンのダメージ以外のカードを好きな枚数捨札にしてもよい。
//  そうしたとき、このターン、これは捨札にしたカード1枚につきBP+1000される」（atwiki/page-167）
// - 選んだパワーゾーンのカードを実際に捨札にしてから、その枚数だけ BP を上げる。

export const DYNAMIC_CHOP_EFFECT_ID = "rk062_dynamic_chop";

function beginDynamicChop(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (ctx.phasePlayerId !== ctx.playerId || !ctx.triggerSourceInstanceId) return null;
  const valid = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: DYNAMIC_CHOP_EFFECT_ID,
    sourceCardId: "RK-062",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_power",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: valid,
    selectCount: valid.length,
    selectedInstanceIds: [],
    optional: true,
  });
}

function resolveDynamicChop(state: GameState, _playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
  if (remaining.length > 0) {
    return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: remaining, selectedInstanceIds: selected } } };
  }
  return finishDynamicChop(state, pending, selected);
}

function finishDynamicChop(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  const playerId = pending.playerId;
  const player = state.players[playerId];
  const ids = new Set(selected);
  const discarded = player.power.filter((c) => ids.has(c.instanceId) && !c.faceDown);
  if (discarded.length === 0) {
    return { state: finish(state, pending), log: log(playerId, "RK-062", state, "dynamic_chop:0") };
  }
  const discardedIds = new Set(discarded.map((c) => c.instanceId));
  const battle = player.battle.map((c) =>
    c.instanceId === pending.sourceInstanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + 1000 * discarded.length } : c,
  );
  const next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      power: player.power.filter((c) => !discardedIds.has(c.instanceId)),
      discard: [...player.discard, ...discarded],
      battle,
    }),
  };
  return { state: finish(next, pending), log: log(playerId, "RK-062", state, `dynamic_chop:${discarded.length}`) };
}

function confirmDynamicChop(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  return finishDynamicChop(state, pending, pending.selectedInstanceIds ?? []);
}

// ---------------------------------------------------------------------------
// RS-423 ゲキタイガー【咆咆弾】
// 「これをラッシュしたとき、特徴「メカ」を持たない敵軍ユニットを、BPの合計が5000以下になるように選んで撃破してもよい。
//  ただし選べるユニットの数は、WBの自軍Mユニットの数までとする。」（atwiki/page-519）
// - エリアを問わない。1体ずつ選び（合計が5000を超えるユニットは候補から外れる）、少なくても確定できる。
// - BP は補正後の BP で数える（RS-125【天地轟鳴アニマルハート】と同じ「BPの合計」。faq-card-3 RS-125 Q1）。
// - 選び終えたら、選んだユニットを1体ずつ撃破する（select_units_bp_budget の確定処理を共用）。

export const HOUHOU_DAN_EFFECT_ID = "rs423_houhou_dan";
const HOUHOU_DAN_DESTROY_EFFECT_ID = "rs423_houhou_dan_destroy";
const HOUHOU_DAN_BP_BUDGET = 5000;

function fieldBp(state: GameState, instanceId: string): number {
  for (const pid of ["player1", "player2"] as const) {
    const card = [...state.players[pid].battle, ...state.players[pid].rush].find((c) => c.instanceId === instanceId);
    if (card) return effectiveBp(state, pid, card);
  }
  return 0;
}

function houhouDanCandidates(state: GameState, playerId: PlayerId, selected: string[]): string[] {
  const enemy = state.players[opponent(playerId)];
  const used = selected.reduce((sum, id) => sum + fieldBp(state, id), 0);
  return [...enemy.battle, ...enemy.rush]
    .filter((c) => {
      if (selected.includes(c.instanceId)) return false;
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || (def.features ?? []).includes("メカ")) return false;
      if (!isSelectableByOpponentEffect(state, playerId, c.instanceId, "RS-423")) return false;
      return used + effectiveBp(state, opponent(playerId), c) <= HOUHOU_DAN_BP_BUDGET;
    })
    .map((c) => c.instanceId);
}

function ownWbMediumCount(state: GameState, playerId: PlayerId): number {
  const own = state.players[playerId];
  return [...own.battle, ...own.rush].filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return !!def && cardCategories(def).includes("WB") && isMediumUnit(state.definitions, c.cardId);
  }).length;
}

function beginHouhouDan(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const limit = ownWbMediumCount(state, ctx.playerId);
  const valid = houhouDanCandidates(state, ctx.playerId, []);
  if (limit <= 0 || valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: HOUHOU_DAN_EFFECT_ID,
    sourceCardId: "RS-423",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: valid,
    selectCount: limit,
    selectedInstanceIds: [],
    bpBudget: HOUHOU_DAN_BP_BUDGET,
    optional: true,
  });
}

function finishHouhouDan(state: GameState, pending: PendingEffectChoice, selected: string[]): ChoiceOutcome {
  if (selected.length === 0) {
    return { state: finish(state, pending), log: log(pending.playerId, "RS-423", state, "houhou_dan:none") };
  }
  return applyConfirmEffectChoice(
    {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: HOUHOU_DAN_DESTROY_EFFECT_ID,
        kind: "select_units_bp_budget",
        selectedInstanceIds: selected,
        processedInstanceIds: [],
        optional: false,
      },
    },
    pending.playerId,
  );
}

function resolveHouhouDan(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = houhouDanCandidates(state, playerId, selected);
  if (selected.length < (pending.selectCount ?? 1) && remaining.length > 0) {
    return { state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: remaining, selectedInstanceIds: selected } } };
  }
  return finishHouhouDan(state, pending, selected);
}

function confirmHouhouDan(state: GameState, _playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  return finishHouhouDan(state, pending, pending.selectedInstanceIds ?? []);
}

// ---------------------------------------------------------------------------
// RS-425 ゲキジャガー【転転弾】
// 「これをラッシュしたとき、敵軍ユニットを1体選んで撃破してもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下の
//  ユニットしか選べない。」（atwiki/page-521）
// - エリアを問わない。場のユニットの必要パワーは印刷の数字（「7-」は7）で、RS-375 の※は場のユニットに及ばない
//   （faq-card-6 RS-375 Q2/Q4）。RS-428【ファンタスティック・テクニック】で発動したときも同じ。

function beginTentenDan(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const damage = damageCount(enemy);
  const valid = [...enemy.battle, ...enemy.rush]
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit") return false;
      if (!isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId, "RS-425")) return false;
      return parsePowerCost(def.powerCost) <= damage;
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: "RS-425",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: valid,
    unitDestination: "discard",
    selectCount: 1,
    optional: true,
  });
}

// ---------------------------------------------------------------------------
// RS-377 ギンガグリーン【キバショット】（NC。「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒」は rules/holdToActivate.ts）
// 「このターン、リリース状態の敵軍コマンドがホールドされたとき、ホールドされたコマンドの必要パワーの数字と同じ必要パワーの数字を持つ
//  敵軍Sユニットを1体選び撃破する。」（atwiki/page-502）
// - applyAction の後処理で、リリース状態からホールド状態になった敵軍コマンドを積み、進行中の選択・支払いがなければ開く。
// - コマンドゾーンのユニットカードの必要パワーには RS-375 レッドレーサー（2nd）の※が及ぶ（faq-card-6 RS-375 Q3）。
//   場の S ユニットの必要パワーは印刷の数字（場のユニットには※が及ばない。同 Q2/Q4）。
// - 発動したら何回でも（このターン中にホールドされるたび）誘発する。2回発動していればそれぞれ誘発する。

const KIBA_SHOT_RULE = "rs377_kiba_shot";
export const KIBA_SHOT_EFFECT_ID = "rs377_kiba_shot_destroy";

export function registerKibaShot(state: GameState, playerId: PlayerId, sourceInstanceId: string): GameState {
  // 発動するたびに1つずつ（重複して誘発する）。addTurnRuleModifier は同じルールをまとめるので直接積む。
  const player = state.players[playerId];
  const modifiers = [
    ...getPlayerModifiers(player),
    { kind: "rule" as const, ruleId: KIBA_SHOT_RULE, scope: "turn" as const, sourceCardId: "RS-377", payload: { sourceInstanceId } },
  ];
  return { ...state, ...updatePlayer(state, playerId, { ...player, modifiers }) };
}

function kibaShotSources(state: GameState, playerId: PlayerId): Array<string | undefined> {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === KIBA_SHOT_RULE && m.scope === "turn")
    .map((m) => (m.kind === "rule" ? (m.payload as { sourceInstanceId?: string } | undefined)?.sourceInstanceId : undefined));
}

/** applyAction の後処理: 【キバショット】の発動中に、リリース状態からホールド状態になった敵軍コマンドを積む。 */
export function queueKibaShot(before: GameState, after: GameState): GameState {
  let queue = after.kibaShotQueue ?? [];
  for (const pid of ["player1", "player2"] as const) {
    const sources = kibaShotSources(after, pid);
    if (sources.length === 0) continue;
    const enemyId = opponent(pid);
    const wasReleased = new Set(before.players[enemyId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId));
    for (const c of after.players[enemyId].command) {
      if (!c.commandHeld || !wasReleased.has(c.instanceId)) continue;
      const def = getDefinition(after.definitions, c.cardId);
      const powerCost = parsePowerCost(def?.powerCost) + redRacerPowerCostBonus(after, enemyId, c.cardId);
      queue = [...queue, ...sources.map((sourceInstanceId) => ({ playerId: pid, powerCost, sourceInstanceId }))];
    }
  }
  return queue === (after.kibaShotQueue ?? []) ? after : { ...after, kibaShotQueue: queue };
}

function kibaShotTargets(state: GameState, playerId: PlayerId, powerCost: number): string[] {
  const enemy = state.players[opponent(playerId)];
  return [...enemy.battle, ...enemy.rush]
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "S") return false;
      if (parsePowerCost(def.powerCost) !== powerCost) return false;
      return isSelectableByOpponentEffect(state, playerId, c.instanceId, "RS-377");
    })
    .map((c) => c.instanceId);
}

/** 待ち行列の先頭から、撃破する敵軍 S ユニットの選択を開く（候補がなければ飛ばす）。 */
export function openKibaShotIfReady(state: GameState, phasePlayerId: PlayerId): GameState {
  let next = state;
  for (let guard = 0; guard < 20; guard += 1) {
    const queue = next.kibaShotQueue ?? [];
    const head = queue[0];
    if (!head) return next;
    const rest = queue.slice(1);
    next = { ...next, kibaShotQueue: rest.length > 0 ? rest : undefined };
    const valid = kibaShotTargets(next, head.playerId, head.powerCost);
    if (valid.length === 0) continue;
    return openEffectChoice(next, {
      playerId: head.playerId,
      effectId: KIBA_SHOT_EFFECT_ID,
      sourceCardId: "RS-377",
      sourceInstanceId: head.sourceInstanceId,
      kind: "select_unit",
      phasePlayerId,
      validInstanceIds: valid,
      unitDestination: "discard",
      selectCount: 1,
      optional: false,
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-141 紐男爵【紐拳】の後半「敵軍ラッシュエリアのユニットを1体選んで、可能ならバトルエリアに出す」:
// 前半で戻したユニットの誘発（RS-417【消滅の緋色】等）を先に解決したあとで開くので、
// その間に撃破されて場を離れたユニットを候補から外す（atwiki/page-336・grnrngr/faq-card-6 RS-417 Q4）。

export const STRING_FIST_SECOND_STEP_REFRESH = "rs141_string_fist_second_step";

registerChoiceRefresher(STRING_FIST_SECOND_STEP_REFRESH, (state, choice) => {
  const rush = state.players[opponent(choice.playerId)].rush;
  const valid = choice.validInstanceIds.filter((id) => rush.some((c) => c.instanceId === id));
  return valid.length > 0 ? { ...choice, validInstanceIds: valid } : null;
});

// ---------------------------------------------------------------------------
// 共通の入口

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [FIGHTER_CHANGE_EFFECT_ID]: resolveFighterChange,
  [FIGHTER_CHANGE_ORDER_EFFECT_ID]: resolveFighterChangeOrder,
  [MASKY_RIBBON_EFFECT_ID]: resolveMaskyRibbon,
  [MASKY_RIBBON_DEPLOY_EFFECT_ID]: resolveMaskyRibbonDeploy,
  [WATER_DISCHARGE_EFFECT_ID]: (s, p) => applyWaterDischarge(s, p),
  [EMERGENCY_GUIDE_EFFECT_ID]: (s, p) => applyEmergencyGuide(s, p),
  [EMERGENCY_GUIDE_ORDER_EFFECT_ID]: resolveEmergencyGuideOrder,
  [LIFE_SEARCH_EFFECT_ID]: (s, p) => applyLifeSearch(s, p),
  [LIFE_SEARCH_PICK_EFFECT_ID]: resolveLifeSearchPick,
  [SOUL_COLLECTION_EFFECT_ID]: resolveSoulCollection,
  [SUPER_GEKI_RED_EFFECT_ID]: resolveSuperGekiRed,
  [DYNAMIC_CHOP_EFFECT_ID]: resolveDynamicChop,
  [HOUHOU_DAN_EFFECT_ID]: resolveHouhouDan,
};

function skipSimple(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return {
      state: finish(state, pending),
      log: buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${pending.effectId}:skipped`),
    };
  };
}

const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {
  [FIGHTER_CHANGE_EFFECT_ID]: skipFighterChange,
  [MASKY_RIBBON_EFFECT_ID]: (s, p) => confirmMaskyRibbon(s, p),
  [MASKY_RIBBON_DEPLOY_EFFECT_ID]: skipSimple("RS-371"),
  [WATER_DISCHARGE_EFFECT_ID]: skipSimple("RS-384"),
  [EMERGENCY_GUIDE_EFFECT_ID]: skipSimple("RS-387"),
  [LIFE_SEARCH_EFFECT_ID]: skipSimple("RS-389"),
  [SOUL_COLLECTION_EFFECT_ID]: skipSimple("RS-416"),
  [DYNAMIC_CHOP_EFFECT_ID]: (s, p) => confirmDynamicChop(s, p),
  [HOUHOU_DAN_EFFECT_ID]: (s, p) => confirmHouhouDan(s, p),
};

/** confirm_effect_choice で確定できる選択（「まで」「好きな枚数」・行うかの確認）。 */
const CHOICE_CONFIRMERS: Record<string, ChoiceConfirmer> = {
  [MASKY_RIBBON_EFFECT_ID]: confirmMaskyRibbon,
  [MASKY_RIBBON_DEPLOY_EFFECT_ID]: skipSimple("RS-371"),
  [WATER_DISCHARGE_EFFECT_ID]: applyWaterDischarge,
  [EMERGENCY_GUIDE_EFFECT_ID]: applyEmergencyGuide,
  [LIFE_SEARCH_EFFECT_ID]: applyLifeSearch,
  [DYNAMIC_CHOP_EFFECT_ID]: confirmDynamicChop,
  [HOUHOU_DAN_EFFECT_ID]: confirmHouhouDan,
};

export function isSet6AuditChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

export function isSet6AuditConfirmableChoice(effectId: string): boolean {
  return effectId in CHOICE_CONFIRMERS;
}

export function tryResolveSet6AuditChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

export function trySkipSet6AuditChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return null;
  return skipper(state, playerId);
}

export function tryConfirmSet6AuditChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  return confirmer ? confirmer(state, playerId) : null;
}

/** DSL grant_keyword（`cardId::effectId`）からの起点。対象外なら null。 */
export function trySet6AuditCardEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  _keyword: string,
): GrantKeywordResult | null {
  const open = (next: GameState | null, id: string): GrantKeywordResult =>
    next ? { state: next, detail: id } : { state, detail: `${id}:no_targets` };
  switch (`${ctx.sourceCardId}::${ctx.effectId}`) {
    case "RS-353::fuaitachienji":
      return open(beginFighterChange(state, ctx), FIGHTER_CHANGE_EFFECT_ID);
    case "RS-371::masukiribon":
      return { state: beginMaskyRibbon(state, ctx), detail: MASKY_RIBBON_EFFECT_ID };
    case "RS-384::mizu":
      return open(beginWaterDischarge(state, ctx), WATER_DISCHARGE_EFFECT_ID);
    case "RS-387::ryo":
      return open(beginEmergencyGuide(state, ctx), EMERGENCY_GUIDE_EFFECT_ID);
    case "RS-389::fx_unknown_e4baba":
      return open(beginLifeSearch(state, ctx), LIFE_SEARCH_EFFECT_ID);
    case "RK-062::dainamikuchopu":
      return open(beginDynamicChop(state, ctx), DYNAMIC_CHOP_EFFECT_ID);
    case "RS-423::dan_e59286":
      return open(beginHouhouDan(state, ctx), HOUHOU_DAN_EFFECT_ID);
    case "RS-425::dan_e8bba2":
      return open(beginTentenDan(state, ctx), ctx.effectId);
    case "RS-416::nokorekushon":
      return open(beginSoulCollection(state, ctx), SOUL_COLLECTION_EFFECT_ID);
    default:
      return null;
  }
}
