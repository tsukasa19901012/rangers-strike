/**
 * 第4弾「四雄の覚醒」（legend1）のカード固有の名前付き効果。
 *
 * - `trySet4CardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet4Choice` / `trySkipSet4Choice` / `tryConfirmSet4Choice`: このモジュールが開いた選択の解決。
 * - バトル解決・アタック対象の判定から呼ばれる参照関数（RS-212 / RS-213 / RS-220 / RS-225 / RS-226）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { findCardInField } from "../fieldLookup";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardName, effectiveBp, getDefinition, isSmallUnit } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import {
  addNextTurnRuleModifier,
  addTurnRuleModifier,
  getPlayerModifiers,
  hasTurnRuleModifier,
} from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { hasBattleNcEffect } from "../namedUnitEffects";
import { countJointLGrant } from "../jointComboGrants";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";

// ---------------------------------------------------------------------------
// 共通

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

/**
 * 選択を閉じる。割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入（NC 等）を続ける。
 * 再開する選択の候補は、この効果の解決前と同じ場所に残っているカードだけにする（移動したカードは選べない）。
 */
function finish(state: GameState, phasePlayerId: PlayerId, before?: GameState): GameState {
  const resume = (before ?? state).pendingEffectChoice?.resumeChoice;
  const cleared = clearPending(state, phasePlayerId);
  if (resume) {
    const prev = before ?? state;
    const valid = resume.validInstanceIds.filter((id) => {
      const was = findCardInField(prev, id);
      const now = findCardInField(cleared, id);
      return !!was && !!now && was.playerId === now.playerId && was.zone === now.zone;
    });
    if (valid.length > 0) return openEffectChoice(cleared, { ...resume, validInstanceIds: valid });
  }
  return promoteDeferredBattleEntry(cleared);
}

/**
 * 同時に誘発した相手の効果の選択（撃破されたユニットの「撃破されたとき」等）が既に開いていれば、
 * ターンプレイヤーのこの効果を先に処理し、相手の選択はその後に再開する（R-SIM-01。faq-card-4 RS-212 Q1・RS-226 Q1）。
 */
function openBeforeExisting(state: GameState, choice: PendingEffectChoice): GameState {
  const existing = state.pendingEffectChoice;
  return openEffectChoice(state, existing ? { ...choice, resumeChoice: existing } : choice);
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

// ---------------------------------------------------------------------------
// RS-212 オーグリーン【爆烈ミラージュナックル】（NC）
// 「自軍ターン中、これがバトルでユニットを撃破したとき、敵軍捨札からカードを1枚選び、敵軍パワーゾーンにダメージにして置く。
//  （カードを選ぶとき、これが撃破したユニットが捨札になるなら捨札にしたあとで選ぶ）」

export const MIRAGE_KNUCKLE_EFFECT_ID = "baku_mirajunakuru_discard_to_damage";

/** バトルで撃破した直後（撃破されたユニットが捨札に置かれたあと）に呼ぶ。 */
export function openMirageKnuckleChoice(
  state: GameState,
  attackerId: PlayerId,
  attackerInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (phasePlayerId !== attackerId) return state;
  const striker = fieldUnits(state, attackerId).find((c) => c.instanceId === attackerInstanceId);
  if (!striker || striker.cardId !== "RS-212" || !hasBattleNcEffect(striker, "baku_mirajunakuru")) return state;
  const enemyId = opponent(attackerId);
  const ids = state.players[enemyId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openBeforeExisting(state, {
    playerId: attackerId,
    effectId: MIRAGE_KNUCKLE_EFFECT_ID,
    sourceCardId: "RS-212",
    sourceInstanceId: attackerInstanceId,
    kind: "select_unit",
    unitDestination: "power",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

function resolveMirageKnuckle(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "discard", instanceId);
  if (!found) return { error: "invalid_target" };
  const [card, discard] = removeAt(enemy.discard, found.index);
  const nextEnemy = {
    ...enemy,
    discard,
    power: [...enemy.power, { instanceId: card.instanceId, cardId: card.cardId, faceDown: true }],
    damage: enemy.damage + 1,
  };
  const next = { ...state, ...updatePlayer(state, enemyId, nextEnemy) };
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, "RS-212", `${MIRAGE_KNUCKLE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
}

// ---------------------------------------------------------------------------
// RS-213 オーイエロー【炸裂超力バトン】（NC）
// 「相手は自分自身のラッシュエリアからユニットを1体選ぶ。このターン、このユニットは、相手の選んだユニットにアタックできる。」

export const CHIKARA_BATON_EFFECT_ID = "chikara_baton_opponent_pick_rush";
const CHIKARA_BATON_RULE = "rs213_chikara_baton";

type BatonPayload = { attackerInstanceId: string; targetInstanceId: string };

function beginChikaraBaton(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const attackerInstanceId = ctx.triggerSourceInstanceId;
  if (!attackerInstanceId) return null;
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].rush.map((c) => c.instanceId);
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: enemyId,
    effectId: CHIKARA_BATON_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: attackerInstanceId,
    kind: "select_unit",
    unitDestination: "rush",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

function resolveChikaraBaton(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  if (!findInZone(state.players[playerId], "rush", instanceId)) return { error: "invalid_target" };
  const ownerId = opponent(playerId);
  const payload: BatonPayload = { attackerInstanceId: pending.sourceInstanceId ?? "", targetInstanceId: instanceId };
  const owner = addTurnRuleModifier(
    state.players[ownerId],
    `${CHIKARA_BATON_RULE}::${payload.attackerInstanceId}::${instanceId}`,
    { sourceCardId: pending.sourceCardId, payload },
  );
  const next = { ...state, ...updatePlayer(state, ownerId, owner) };
  return {
    state: finish(next, pending.phasePlayerId, state),
    log: logFor(state, playerId, pending.sourceCardId, `${CHIKARA_BATON_EFFECT_ID}:${cardName(state.definitions, findInZone(state.players[playerId], "rush", instanceId)!.card.cardId)}`),
  };
}

/** RS-213: このターン、相手の選んだラッシュエリアのユニットにアタックできるか。 */
export function chikaraBatonAllowsAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string,
): boolean {
  return getPlayerModifiers(state.players[attackerPlayerId]).some((m) => {
    if (m.kind !== "rule" || m.scope !== "turn" || !m.ruleId.startsWith(`${CHIKARA_BATON_RULE}::`)) return false;
    const p = m.payload as BatonPayload | undefined;
    return p?.attackerInstanceId === attackerInstanceId && p.targetInstanceId === defenderInstanceId;
  });
}

// ---------------------------------------------------------------------------
// RS-217 SSスタタンゾ【家出したくなるガソリン】（NC）
// 「バトルエリアにある特徴「車両」を持つユニットを1体選び、持ち主の山札の下に戻してもよい。」

export const RUNAWAY_GASOLINE_EFFECT_ID = "shitakunarugasorin_deck_bottom";

function battleUnitsWithFeature(state: GameState, feature: string): string[] {
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    for (const c of state.players[pid].battle) {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type === "unit" && (def.features ?? []).includes(feature)) ids.push(c.instanceId);
    }
  }
  return ids;
}

function beginRunawayGasoline(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const ids = battleUnitsWithFeature(state, "車両");
  if (ids.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: RUNAWAY_GASOLINE_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

function resolveRunawayGasoline(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  for (const ownerId of ["player1", "player2"] as const) {
    const owner = state.players[ownerId];
    const found = findInZone(owner, "battle", instanceId);
    if (!found) continue;
    const [card, battle] = removeAt(owner.battle, found.index);
    const returned: CardInstance = { instanceId: card.instanceId, cardId: card.cardId };
    const next = { ...state, ...updatePlayer(state, ownerId, { ...owner, battle, deck: [...owner.deck, returned] }) };
    return {
      state: finish(next, pending.phasePlayerId, state),
      log: logFor(state, playerId, pending.sourceCardId, `${RUNAWAY_GASOLINE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
    };
  }
  return { error: "invalid_target" };
}

// ---------------------------------------------------------------------------
// RS-220 タイムグリーン【反射バリア】（NC）
// 「次の相手ターン、自軍Sユニットとバトルした敵軍Sユニットは、バトルに勝っても撃破される。」
// 相手（撃破される側）に次のターンだけ有効な修飾子を付ける。

export const REFLECT_BARRIER_RULE = "rs220_reflect_barrier";

function applyReflectBarrier(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const enemy = addNextTurnRuleModifier(state.players[enemyId], REFLECT_BARRIER_RULE, {
    sourceCardId: ctx.sourceCardId,
  });
  return { ...state, ...updatePlayer(state, enemyId, enemy) };
}

/**
 * RS-220: 勝った winner（winnerOwner の S ユニット）が、反射バリアの持ち主の S ユニット（loser）とバトルしたので撃破されるか。
 */
export function reflectBarrierDestroysWinner(
  state: GameState,
  winnerOwner: PlayerId,
  winnerCardId: string,
  loserCardId: string,
): boolean {
  if (!hasTurnRuleModifier(state.players[winnerOwner], REFLECT_BARRIER_RULE)) return false;
  return isSmallUnit(state.definitions, winnerCardId) && isSmallUnit(state.definitions, loserCardId);
}

// ---------------------------------------------------------------------------
// RS-225 ガトリングレオ【大回転獅子爆裂弾】
// 「このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる。」
// 能力の付与（同カテゴリの L ユニットへの JC）は jointComboGrants に記録される。

export function lionBlastAllowsRushAttack(card: CardInstance): boolean {
  return countJointLGrant(card, "shi_baku_dan") > 0;
}

// ---------------------------------------------------------------------------
// RS-226 キラーオー【爆竜必殺デススティンガー】
// 「自軍ターン中、これがバトルでユニットを撃破したとき、これがバトルで撃破したユニットよりBPの低いユニットを、
//  相手は自分自身のユニットの中から1体選び撃破する。」
// 撃破したユニットの BP はバトルの時点の BP（faq-card-4 RS-226 Q2・Q3）。

export const DEATH_STINGER_EFFECT_ID = "baku_desusuteinga_destroy_lower";

export function openDeathStingerChoice(
  state: GameState,
  attackerId: PlayerId,
  attackerInstanceId: string,
  destroyedBattleBp: number,
  phasePlayerId: PlayerId,
): GameState {
  if (phasePlayerId !== attackerId) return state;
  const striker = fieldUnits(state, attackerId).find((c) => c.instanceId === attackerInstanceId);
  if (!striker || striker.cardId !== "RS-226") return state;
  const enemyId = opponent(attackerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) < destroyedBattleBp)
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openBeforeExisting(state, {
    playerId: enemyId,
    effectId: DEATH_STINGER_EFFECT_ID,
    sourceCardId: "RS-226",
    sourceInstanceId: attackerInstanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

function resolveDeathStinger(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const card = fieldUnits(state, playerId).find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const cleared = clearPending(state, pending.phasePlayerId);
  const left = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  let next: GameState;
  if (left.state.pendingEffectChoice) {
    // 撃破で誘発した選択の後で、割り込まれていた選択を再開する。
    const opened = left.state.pendingEffectChoice;
    next = pending.resumeChoice
      ? { ...left.state, pendingEffectChoice: { ...opened, resumeChoice: opened.resumeChoice ?? pending.resumeChoice } }
      : left.state;
  } else if (left.state.pendingLeave) {
    next = left.state;
  } else {
    next = finish(left.state, pending.phasePlayerId, state);
  }
  return {
    state: next,
    log: logFor(state, playerId, "RS-226", `${DEATH_STINGER_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
  };
}

// ---------------------------------------------------------------------------
// 登録

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [MIRAGE_KNUCKLE_EFFECT_ID]: resolveMirageKnuckle,
  [CHIKARA_BATON_EFFECT_ID]: resolveChikaraBaton,
  [RUNAWAY_GASOLINE_EFFECT_ID]: resolveRunawayGasoline,
  [DEATH_STINGER_EFFECT_ID]: resolveDeathStinger,
};

export function isSet4ChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。 */
export function tryResolveSet4Choice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet4Choice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || !(pending.effectId in CHOICE_RESOLVERS)) return null;
  if (!pending.optional) return null;
  return {
    state: finish(state, pending.phasePlayerId),
    log: buildLogEntry(playerId, "skip_effect_choice", pending.sourceCardId, state.definitions, `${pending.effectId}:skipped`),
  };
}

/** DSL grant_keyword（`cardId::effectId`）からの起点。対象外なら null。 */
export function trySet4CardEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  _keyword: string,
): GrantKeywordResult | null {
  const id = `${ctx.sourceCardId}::${ctx.effectId}`;
  switch (id) {
    // RS-212 / RS-226: 撃破時の処理はバトル解決（operationCounters）。ここでは何もしない。
    case "RS-212::baku_mirajunakuru":
    case "RS-226::baku_desusuteinga":
    case "RS-225::shi_baku_dan":
      return { state, detail: ctx.effectId };
    case "RS-213::chikara_baton": {
      const next = beginChikaraBaton(state, ctx);
      return next ? { state: next, detail: CHIKARA_BATON_EFFECT_ID } : { state, detail: `${CHIKARA_BATON_EFFECT_ID}:no_targets` };
    }
    case "RS-217::shitakunarugasorin": {
      const next = beginRunawayGasoline(state, ctx);
      return next ? { state: next, detail: RUNAWAY_GASOLINE_EFFECT_ID } : { state, detail: `${RUNAWAY_GASOLINE_EFFECT_ID}:no_targets` };
    }
    case "RS-220::baria_e58f8d":
      return { state: applyReflectBarrier(state, ctx), detail: REFLECT_BARRIER_RULE };
    default:
      return null;
  }
}
