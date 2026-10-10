/**
 * 第6弾「紅き六戦士の帰還」（legend1）RS-348〜RS-389 のカード固有の名前付き効果（set-6 監査で未実装だったもの）。
 *
 * - `trySet6LowCardEffect`: DSL の grant_keyword（`effect_card::cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet6LowChoice` / `trySkipSet6LowChoice`: このモジュールが開いた選択の解決。
 * - 継続効果・制限の参照関数（BP 補正、ターン終了時の撃破など）。
 * 型・構成は rules/legend1/set5NamedEffectsA.ts と同じ。
 */
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { findInZone, opponent, updatePlayer } from "../../core/helpers";
import { addNextTurnRuleModifier, addTurnRuleModifier, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { grantSp1ToBattleUnit } from "../namedUnitEffects";
import { CHIKARA_BATON_RULE } from "./set4NamedEffects";
import { buildLogEntry } from "../../log/formatLog";
import { unitFeatures } from "../addedFeatures";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

function finish(state: GameState, phasePlayerId: PlayerId): GameState {
  if (state.pendingEffectChoice || state.pendingLeave) return state;
  return promoteDeferredBattleEntry(clearPending(state, phasePlayerId));
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function inField(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return fieldUnits(state, playerId).some((c) => c.instanceId === instanceId);
}

/** 自軍ダメージ（パワーゾーンのウラ向きのカード）の数。 */
function ownDamage(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].power.filter((c) => c.faceDown).length;
}

export function isSet6LowChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveSet6LowChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet6LowChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

/** 単純な「選んだユニットを撃破する」選択の解決。 */
function destroyChosen(cardId: string, effectId: string): ChoiceResolver {
  return (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
    const name = cardName(state.definitions, findFieldCard(state, instanceId)?.cardId ?? instanceId);
    const cleared = clearPending(state, pending.phasePlayerId);
    const leave = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
    const next = "error" in leave ? cleared : leave.state;
    return { state: finish(next, pending.phasePlayerId), log: logFor(state, playerId, cardId, `${effectId}:${name}`) };
  };
}

function skipChoice(cardId: string, effectId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(clearPending(state, pending.phasePlayerId), pending.phasePlayerId), log: logFor(state, playerId, cardId, `${effectId}:skip`) };
  };
}

function findFieldCard(state: GameState, instanceId: string): CardInstance | undefined {
  for (const pid of ["player1", "player2"] as const) {
    const c = fieldUnits(state, pid).find((x) => x.instanceId === instanceId);
    if (c) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// RS-372 X1マスク【チェンジパワー】
// 「これは自軍ダメージ1点につきBP＋1000され、自分がターンを終えるときBP8000以上なら撃破される。」（atwiki/page-568）
// ナンバーを持たない継続効果（場にある間、エリアを問わない）。BP8000 以上の判定は他の効果の修正込み（faq-card-6 RS-372）。

export function changePowerBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (instance.cardId !== "RS-372") return 0;
  if (!inField(state, playerId, instance.instanceId)) return 0;
  return ownDamage(state, playerId) * 1000;
}

/** 自分がターンを終えるとき、BP8000 以上の X1マスクを撃破する（R-END-01）。 */
export function applyChangePowerTurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  let next = state;
  for (const card of fieldUnits(state, endingPlayerId)) {
    if (card.cardId !== "RS-372") continue;
    const now = fieldUnits(next, endingPlayerId).find((c) => c.instanceId === card.instanceId);
    if (!now || effectiveBp(next, endingPlayerId, now) < 8000) continue;
    const leave = applyUnitLeave(next, card.instanceId, "discard", endingPlayerId);
    if (!("error" in leave)) next = leave.state;
    if (next.pendingEffectChoice || next.pendingLeave) break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-360 ヘドリアン女王【宇宙で一番美しいのは誰？】
// 「これが自軍ラッシュエリアにある間、相手は次の制限を受ける⇒自分自身のターンを終えるとき、特徴「女」を持つ
//  自分自身のユニットを1体選び撃破する。」（atwiki/page-601）
// 女王が2体あれば2体撃破する（faq-card-6 RS-360 Q1）。選ぶのは制限を受ける相手（ターンを終えるプレイヤー）で、強制。

export const HEDRIAN_BEAUTY_EFFECT_ID = "rs360_most_beautiful";

/** ターンを終えるプレイヤーが受ける撃破の回数（相手のラッシュエリアにあるヘドリアン女王の数）。 */
export function hedrianBeautyCount(state: GameState, endingPlayerId: PlayerId): number {
  return state.players[opponent(endingPlayerId)].rush.filter((c) => c.cardId === "RS-360").length;
}

/** 「女」の自軍ユニットを1体選ぶ選択を開く。候補がなければ null。 */
export function openHedrianBeautyChoice(state: GameState, endingPlayerId: PlayerId): GameState | null {
  const ids = fieldUnits(state, endingPlayerId)
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .filter((c) => unitFeatures(state, endingPlayerId, c).includes("女"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return null;
  const queen = state.players[opponent(endingPlayerId)].rush.find((c) => c.cardId === "RS-360");
  return openEffectChoice(state, {
    playerId: endingPlayerId,
    effectId: HEDRIAN_BEAUTY_EFFECT_ID,
    sourceCardId: "RS-360",
    sourceInstanceId: queen?.instanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId: endingPlayerId,
    validInstanceIds: ids,
    selectedInstanceIds: [],
    optional: false,
  });
}

CHOICE_RESOLVERS[HEDRIAN_BEAUTY_EFFECT_ID] = destroyChosen("RS-360", HEDRIAN_BEAUTY_EFFECT_ID);

// ---------------------------------------------------------------------------
// RS-369 ブルーマスク【双手剣】（NC: CN3）
// 「SP1 相手は自分自身のラッシュエリアからユニットを1体選ぶ（自軍ダメージが4点以上あれば自分が選ぶ）。
//  このターン、このユニットは、選んだユニットにアタックできる。」（atwiki/page-565）
// アタックの許可は RS-213【炸裂超力バトン】と同じターン修飾子（chikaraBatonAllowsAttack）で表す。

export const SOUSHUKEN_EFFECT_ID = "rs369_soushuken_pick_rush";

function beginSoushuken(state: GameState, ctx: GrantKeywordContext): GameState {
  const attackerId = ctx.triggerSourceInstanceId;
  if (!attackerId) return state;
  let next = grantSp1ToBattleUnit(state, ctx.playerId, attackerId);
  const enemyId = opponent(ctx.playerId);
  const ids = next.players[enemyId].rush.map((c) => c.instanceId);
  if (ids.length === 0) return next;
  const chooser = ownDamage(next, ctx.playerId) >= 4 ? ctx.playerId : enemyId;
  next = openEffectChoice(next, {
    playerId: chooser,
    effectId: SOUSHUKEN_EFFECT_ID,
    sourceCardId: "RS-369",
    sourceInstanceId: attackerId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
  return next;
}

CHOICE_RESOLVERS[SOUSHUKEN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const attackerId = pending.sourceInstanceId ?? "";
  const ownerId = fieldUnits(state, playerId).some((c) => c.instanceId === attackerId) ? playerId : opponent(playerId);
  const target = findInZone(state.players[opponent(ownerId)], "rush", instanceId);
  if (!target) return { error: "invalid_target" };
  const payload = { attackerInstanceId: attackerId, targetInstanceId: instanceId };
  const owner = addTurnRuleModifier(state.players[ownerId], `${CHIKARA_BATON_RULE}::${attackerId}::${instanceId}`, {
    sourceCardId: "RS-369",
    payload,
  });
  const next = { ...state, ...updatePlayer(state, ownerId, owner) };
  return {
    state: finish(clearPending(next, pending.phasePlayerId), pending.phasePlayerId),
    log: logFor(state, playerId, "RS-369", `${SOUSHUKEN_EFFECT_ID}:${cardName(state.definitions, target.card.cardId)}`),
  };
};

// ---------------------------------------------------------------------------
// RS-375 レッドレーサー（2nd）【ツインソード・ツインカムクラッシュ】（NC: CN4）
// 「「SP1」 敵軍バトルエリアから、本来のBPが2000か、必要パワーの数字が2か、ナンバーが2のユニットを1体選び、撃破してもよい。」
// 「SP1」は DSL の SP1。ここでは撃破の選択だけを開く（任意）。場のユニットの必要パワーは※の影響を受けない（faq-card-6 RS-375 Q2）。

export const TWIN_CAM_CRASH_EFFECT_ID = "rs375_twin_cam_crash";

function hasComboNumber(cardId: string, state: GameState, n: number): boolean {
  const cn = (getDefinition(state.definitions, cardId) as { comboNumber?: number | number[] } | undefined)?.comboNumber;
  return Array.isArray(cn) ? cn.includes(n) : cn === n;
}

function beginTwinCamCrash(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit") return false;
      return def.bp === 2000 || parsePowerCost(def.powerCost) === 2 || hasComboNumber(c.cardId, state, 2);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: TWIN_CAM_CRASH_EFFECT_ID,
    sourceCardId: "RS-375",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[TWIN_CAM_CRASH_EFFECT_ID] = destroyChosen("RS-375", TWIN_CAM_CRASH_EFFECT_ID);
CHOICE_SKIPPERS[TWIN_CAM_CRASH_EFFECT_ID] = skipChoice("RS-375", TWIN_CAM_CRASH_EFFECT_ID);

// ---------------------------------------------------------------------------
// RS-356 デンジイエロー【ハンマーパンチ】（NC: CN5）
// 「次の相手ターン、必要パワーの数字が3以下の敵軍ユニットは、ターンが終わるまでバトルエリアに出られない。」（atwiki/page-544）
// 相手側に「次のターン」のルール修飾子を置く（相手のターンに turn へ繰り上がり、そのターンの終わりに消える）。
// 場のユニットの必要パワーは RS-375 の※を受けない（faq-card-6 RS-375 Q）— 印刷値で判定する。

const HAMMER_PUNCH_RULE = "rs356_hammer_punch";

export function hammerPunchBlocksEntry(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  if (state.activePlayer !== playerId) return false;
  if (!hasTurnRuleModifier(state.players[playerId], HAMMER_PUNCH_RULE)) return false;
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || def.powerCost === undefined) return false;
  return parsePowerCost(def.powerCost) <= 3;
}

function applyHammerPunch(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const enemy = addNextTurnRuleModifier(state.players[enemyId], HAMMER_PUNCH_RULE, { sourceCardId: "RS-356" });
  return { ...state, ...updatePlayer(state, enemyId, enemy) };
}

// ---------------------------------------------------------------------------
// DSL の grant_keyword からの起点

export function trySet6LowCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  switch (keyword) {
    case "effect_card::RS-369::ken":
      return { state: beginSoushuken(state, ctx), detail: SOUSHUKEN_EFFECT_ID };
    case "effect_card::RS-375::twin_cam_crash":
      return { state: beginTwinCamCrash(state, ctx), detail: TWIN_CAM_CRASH_EFFECT_ID };
    case "effect_card::RS-356::hanmapanchi":
      return { state: applyHammerPunch(state, ctx), detail: HAMMER_PUNCH_RULE };
    default:
      return null;
  }
}

